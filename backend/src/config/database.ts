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
  console.log('✅ [Database] Conectado exitosamente a PostgreSQL (Zaza Click 2.0 WhatsApp API SaaS).');
});

pool.on('error', (err) => {
  console.error('⚠️ [Database] Error en el pool de conexiones:', err.message);
});

/**
 * Inicializar tablas requeridas para el SaaS Core de WhatsApp API
 */
export async function initDatabase() {
  try {
    if (!dbUrl) {
      console.warn('⚠️ Skipping DB init: DATABASE_URL missing.');
      return;
    }

    // 1. Tabla de Usuarios (SaaS Multi-tenant)
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

    // 2. Tabla de Planes de Suscripción API
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
        ('plan_basic', 'Plan Developer (1 línea)', 1, 15.00, 1),
        ('plan_medium', 'Plan Business (3 líneas)', 3, 35.00, 1),
        ('plan_premium', 'Plan Enterprise (ILIMITADO)', 99, 79.00, 1)
      `);
      console.log('📦 [Database] Planes SaaS creados.');
    }

    // 3. Tabla de Suscripciones Activas
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

    // 4. Tabla de Instancias de WhatsApp API
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

    // Asegurar columna parent_id en users
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS parent_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE;
    `);

    // 5. Asegurar rol SuperAdmin para el correo principal
    await pool.query(`
      UPDATE users 
      SET role = 'admin' 
      WHERE email = 'syscomecosistemadigital@gmail.com'
    `);

    // 6. Limpieza y Purga Automática de Tablas Legacy del Antiguo CRM
    const legacyCrmTables = [
      'crm_order_items',
      'crm_orders',
      'crm_client_tasks',
      'crm_client_notes',
      'crm_contacts',
      'crm_contact_categories',
      'crm_clients',
      'agent_profiles',
      'billing_configs',
      'google_contacts_credentials'
    ];

    for (const table of legacyCrmTables) {
      await pool.query(`DROP TABLE IF EXISTS ${table} CASCADE;`);
    }

    console.log('🚀 [Database] Estructura SaaS Core inicializada y tablas CRM purgadas exitosamente.');
  } catch (error: any) {
    console.error('❌ [Database] Error inicializando tablas:', error.message);
  }
}

export default pool;
