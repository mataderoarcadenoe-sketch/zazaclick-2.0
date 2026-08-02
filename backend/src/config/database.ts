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

    // 5. Asegurar rol Administrador para tu correo principal
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
