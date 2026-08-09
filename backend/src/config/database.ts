import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.warn('⚠️ WARNING: DATABASE_URL no configurada en el entorno.');
}

const isLocalOrInternal = !dbUrl || dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1') || dbUrl.includes('railway.internal');

const pool = new Pool({
  connectionString: dbUrl,
  ssl: isLocalOrInternal ? false : { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('connect', () => {
  console.log('✅ [Database] Conectado exitosamente a PostgreSQL.');
});

pool.on('error', (err) => {
  console.error('⚠️ [Database] Error en el pool de conexiones:', err.message);
});

/**
 * Inicializar tablas requeridas para el SaaS
 */
export async function initDatabase() {
  try {
    if (!dbUrl) {
      console.warn('⚠️ Skipping DB init: DATABASE_URL missing.');
      return;
    }

    // 1. Tabla de Usuarios
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'client',
        parent_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Tabla de Planes
    await pool.query(`
      CREATE TABLE IF NOT EXISTS plans (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        max_instances INTEGER DEFAULT 1,
        price NUMERIC(10,2) NOT NULL,
        duration_months INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Inyectar planes por defecto si no existen
    const planCheck = await pool.query('SELECT COUNT(*) FROM plans');
    if (parseInt(planCheck.rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO plans (id, name, max_instances, price, duration_months) VALUES
        ('plan_basic', 'Plan Básico (1 número)', 1, 15.00, 1),
        ('plan_medium', 'Plan Estándar (3 números)', 3, 35.00, 1),
        ('plan_premium', 'Plan Pro (ILIMITADO)', 99, 79.00, 1)
      `);
      console.log('📦 [Database] Planes por defecto creados.');
    }

    // 3. Tabla de Suscripciones
    await pool.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        plan_id VARCHAR(255) NOT NULL REFERENCES plans(id),
        status VARCHAR(50) DEFAULT 'active',
        start_date TIMESTAMP NOT NULL,
        end_date TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 4. Tabla de Instancias de WhatsApp
    await pool.query(`
      CREATE TABLE IF NOT EXISTS instances (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        instance_name VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(50),
        status VARCHAR(50) DEFAULT 'disconnected',
        api_key VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 5. Tabla de Credenciales de Google Contactos
    await pool.query(`
      CREATE TABLE IF NOT EXISTS google_contacts_credentials (
        user_id VARCHAR(255) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        access_token TEXT NOT NULL,
        refresh_token TEXT NOT NULL,
        expiry_date BIGINT NOT NULL,
        google_email VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 6. Tabla de Clientes CRM
    await pool.query(`
      CREATE TABLE IF NOT EXISTS crm_clients (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        doc_type VARCHAR(10) NOT NULL,
        doc_number VARCHAR(20) NOT NULL,
        name VARCHAR(255) NOT NULL,
        address TEXT,
        email VARCHAR(255),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_user_doc UNIQUE (user_id, doc_type, doc_number)
      );
    `);

    // 7. Tabla de Categorías de Contacto CRM
    await pool.query(`
      CREATE TABLE IF NOT EXISTS crm_contact_categories (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_user_category UNIQUE (user_id, name)
      );
    `);

    // 8. Tabla de Contactos CRM
    await pool.query(`
      CREATE TABLE IF NOT EXISTS crm_contacts (
        id SERIAL PRIMARY KEY,
        client_id INTEGER NOT NULL REFERENCES crm_clients(id) ON DELETE CASCADE,
        user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        phone_number VARCHAR(50) NOT NULL,
        category_id INTEGER REFERENCES crm_contact_categories(id) ON DELETE SET NULL,
        is_active BOOLEAN DEFAULT TRUE,
        pipeline_stage VARCHAR(50) DEFAULT 'Nuevo',
        tags JSONB DEFAULT '[]',
        assigned_agent_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_user_phone UNIQUE (user_id, phone_number)
      );
    `);

    // 9. Tabla de Perfiles de Asesores (Colaboradores)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS agent_profiles (
        user_id VARCHAR(255) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'available',
        response_time_sec INTEGER DEFAULT 45,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Asegurar columna pipeline_stage en bases de datos existentes
    await pool.query(`
      ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS pipeline_stage VARCHAR(50) DEFAULT 'Nuevo';
    `);

    // Asegurar columna tags en bases de datos existentes
    await pool.query(`
      ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]';
    `);

    // Asegurar columna parent_id en bases de datos existentes (users)
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS parent_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE;
    `);

    // Asegurar columna assigned_agent_id en bases de datos existentes (crm_contacts)
    await pool.query(`
      ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS assigned_agent_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL;
    `);

    // 10. Tabla de Notas Internas de Clientes (Multiples Notas)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS crm_client_notes (
        id SERIAL PRIMARY KEY,
        client_id INTEGER NOT NULL REFERENCES crm_clients(id) ON DELETE CASCADE,
        user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        agent_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 11. Tabla de Tareas de Clientes
    await pool.query(`
      CREATE TABLE IF NOT EXISTS crm_client_tasks (
        id SERIAL PRIMARY KEY,
        client_id INTEGER NOT NULL REFERENCES crm_clients(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        completed BOOLEAN DEFAULT false,
        due_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 12. Tabla de Configuración del Facturador (SaaS Integración)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS billing_configs (
        user_id VARCHAR(255) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        billing_subdomain VARCHAR(255) NOT NULL,
        billing_token TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    // Asegurar columnas de cumpleaños, idioma, empresa, departamento, provincia y distrito en crm_clients
    await pool.query(`
      ALTER TABLE crm_clients ADD COLUMN IF NOT EXISTS birthday DATE;
      ALTER TABLE crm_clients ADD COLUMN IF NOT EXISTS idioma VARCHAR(50) DEFAULT 'Español';
      ALTER TABLE crm_clients ADD COLUMN IF NOT EXISTS empresa VARCHAR(255);
      ALTER TABLE crm_clients ADD COLUMN IF NOT EXISTS departamento VARCHAR(100);
      ALTER TABLE crm_clients ADD COLUMN IF NOT EXISTS provincia VARCHAR(100);
      ALTER TABLE crm_clients ADD COLUMN IF NOT EXISTS distrito VARCHAR(100);
    `);

    // 13. Tabla de Pedidos/Cotizaciones del CRM
    await pool.query(`
      CREATE TABLE IF NOT EXISTS crm_orders (
        id SERIAL PRIMARY KEY,
        quote_id VARCHAR(50) UNIQUE NOT NULL,
        contact_id INTEGER NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
        user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        phone_number VARCHAR(50) NOT NULL,
        total_amount NUMERIC(10,2) NOT NULL,
        status VARCHAR(50) DEFAULT 'PENDIENTE',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 14. Tabla de Líneas de Detalle de los Pedidos/Cotizaciones
    await pool.query(`
      CREATE TABLE IF NOT EXISTS crm_order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES crm_orders(id) ON DELETE CASCADE,
        product_id VARCHAR(50) NOT NULL,
        product_name VARCHAR(255) NOT NULL,
        quantity INTEGER NOT NULL,
        price NUMERIC(10,2) NOT NULL,
        unit_type VARCHAR(50),
        price_description VARCHAR(100)
      );
    `);

    // 6. Asegurar rol Administrador para tu correo principal
    await pool.query(`
      UPDATE users 
      SET role = 'admin' 
      WHERE email = 'syscomecosistemadigital@gmail.com'
    `);

    console.log('🚀 [Database] Estructura de base de datos inicializada exitosamente.');
  } catch (error: any) {
    console.error('❌ [Database] Error inicializando tablas:', error.message);
  }
}

export default pool;
