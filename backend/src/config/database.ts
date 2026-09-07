import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as crypto from 'crypto';

dotenv.config();

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.warn('⚠️ WARNING: DATABASE_URL no configurada en el entorno.');
}

const isLocalOrInternal = !dbUrl || dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1') || dbUrl.includes('railway.internal');

const pool = new Pool({
  connectionString: dbUrl,
  ssl: isLocalOrInternal ? false : { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('connect', () => {
  console.log('✅ [Database] Conectado exitosamente a PostgreSQL (Zaza Click 2.0 WhatsApp API SaaS Gateway).');
});

pool.on('error', (err) => {
  console.error('⚠️ [Database] Error en el pool de conexiones:', err.message);
});

/**
 * Inicializar y migrar de forma segura y no destructiva las tablas del SaaS Core
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
        status VARCHAR(20) DEFAULT 'active',
        trial_used BOOLEAN DEFAULT false,
        trial_started_at TIMESTAMP NULL,
        trial_end_date TIMESTAMP NULL,
        company_name VARCHAR(255) NULL,
        phone VARCHAR(50) NULL,
        last_login_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Columnas agregadas a users
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS parent_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_used BOOLEAN DEFAULT false;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMP NULL;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_end_date TIMESTAMP NULL;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS company_name VARCHAR(255) NULL;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50) NULL;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS external_id VARCHAR(255) NULL;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS partner_id VARCHAR(255) NULL;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP NULL;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    `);

    // 2. Tabla de Planes de Suscripción API
    await pool.query(`
      CREATE TABLE IF NOT EXISTS plans (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        max_instances INTEGER DEFAULT 1,
        price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
        duration_months INTEGER DEFAULT 1,
        max_messages INTEGER DEFAULT 1000,
        is_active BOOLEAN DEFAULT true,
        is_trial BOOLEAN DEFAULT false,
        trial_days INTEGER DEFAULT 7,
        trial_messages INTEGER DEFAULT 100,
        description TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Columnas agregadas a plans
    await pool.query(`
      ALTER TABLE plans ADD COLUMN IF NOT EXISTS max_messages INTEGER DEFAULT 1000;
      ALTER TABLE plans ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
      ALTER TABLE plans ADD COLUMN IF NOT EXISTS is_trial BOOLEAN DEFAULT false;
      ALTER TABLE plans ADD COLUMN IF NOT EXISTS trial_days INTEGER DEFAULT 7;
      ALTER TABLE plans ADD COLUMN IF NOT EXISTS trial_messages INTEGER DEFAULT 100;
      ALTER TABLE plans ADD COLUMN IF NOT EXISTS description TEXT NULL;
    `);

    // Inyectar o actualizar planes base
    await pool.query(`
      INSERT INTO plans (id, name, max_instances, price, duration_months, max_messages, is_active, is_trial, trial_days, trial_messages, description)
      VALUES
        ('plan_trial', 'Prueba Gratuita (Trial 7 días)', 1, 0.00, 1, 100, true, true, 7, 100, 'Plan de prueba para nuevos desarrolladores'),
        ('plan_basic', 'Plan Developer (1 línea)', 1, 15.00, 1, 1000, true, false, 7, 100, 'Ideal para proyectos iniciales y microempresas'),
        ('plan_medium', 'Plan Business (3 líneas)', 3, 35.00, 1, 5000, true, false, 7, 100, 'Para empresas con múltiples líneas de atención o sucursales'),
        ('plan_premium', 'Plan Enterprise (ILIMITADO)', 99, 79.00, 1, 50000, true, false, 7, 100, 'Para integradores y alto tráfico corporativo')
      ON CONFLICT (id) DO UPDATE SET
        max_messages = EXCLUDED.max_messages,
        is_trial = EXCLUDED.is_trial,
        trial_days = EXCLUDED.trial_days,
        trial_messages = EXCLUDED.trial_messages,
        description = EXCLUDED.description;
    `);

    // 3. Tabla de Suscripciones Activas
    await pool.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        plan_id VARCHAR(255) NOT NULL REFERENCES plans(id),
        status VARCHAR(50) DEFAULT 'active',
        messages_limit INTEGER DEFAULT 1000,
        messages_used INTEGER DEFAULT 0,
        payment_status VARCHAR(20) DEFAULT 'paid',
        start_date TIMESTAMP NOT NULL,
        end_date TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Columnas agregadas a subscriptions
    await pool.query(`
      ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS messages_limit INTEGER DEFAULT 1000;
      ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS messages_used INTEGER DEFAULT 0;
      ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'paid';
    `);

    // 4. Tabla de Instancias de WhatsApp API
    await pool.query(`
      CREATE TABLE IF NOT EXISTS instances (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        instance_name VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(50),
        status VARCHAR(50) DEFAULT 'disconnected',
        is_enabled BOOLEAN DEFAULT true,
        messages_sent INTEGER DEFAULT 0,
        last_activity_at TIMESTAMP NULL,
        api_key VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Columnas agregadas a instances
    await pool.query(`
      ALTER TABLE instances ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN DEFAULT true;
      ALTER TABLE instances ADD COLUMN IF NOT EXISTS messages_sent INTEGER DEFAULT 0;
      ALTER TABLE instances ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP NULL;
      ALTER TABLE instances ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
      ALTER TABLE instances ADD COLUMN IF NOT EXISTS engine_type VARCHAR(50) DEFAULT 'evolution_api';
      ALTER TABLE instances ADD COLUMN IF NOT EXISTS webhook_url TEXT NULL;
      ALTER TABLE instances ADD COLUMN IF NOT EXISTS webhook_secret VARCHAR(255) NULL;
      ALTER TABLE instances ADD COLUMN IF NOT EXISTS webhook_enabled BOOLEAN DEFAULT true;
    `);

    // Restricción CHECK de engine_type no destructiva
    await pool.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'chk_instances_engine_type'
        ) THEN 
          ALTER TABLE instances 
          ADD CONSTRAINT chk_instances_engine_type 
          CHECK (engine_type IN ('evolution_api', 'evolution_go')); 
        END IF; 
      END $$;
    `);

    // 5. Tabla de Pagos Administrativos
    await pool.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        subscription_id VARCHAR(255) REFERENCES subscriptions(id) ON DELETE SET NULL,
        amount NUMERIC(10,2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'USD',
        payment_method VARCHAR(50) DEFAULT 'manual',
        reference VARCHAR(255) NULL,
        status VARCHAR(20) DEFAULT 'paid',
        notes TEXT NULL,
        created_by VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 6. Tabla de Métricas de Consumo Ligeras (Sin almacenar conversaciones)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS usage_logs (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        subscription_id VARCHAR(255) REFERENCES subscriptions(id) ON DELETE SET NULL,
        instance_name VARCHAR(255) NOT NULL,
        message_type VARCHAR(50) NOT NULL,
        status VARCHAR(20) NOT NULL,
        evolution_message_id VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 7. Tabla de Trazabilidad Administrativa (Audit Logs)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_audit_logs (
        id VARCHAR(255) PRIMARY KEY,
        admin_id VARCHAR(255) NOT NULL,
        admin_email VARCHAR(255) NOT NULL,
        action VARCHAR(100) NOT NULL,
        entity VARCHAR(50) NOT NULL,
        entity_id VARCHAR(255) NOT NULL,
        details JSONB NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 8. Tabla de API Keys para Desarrolladores y Sistemas ERP
    await pool.query(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL DEFAULT 'Default API Key',
        key_prefix VARCHAR(50) NOT NULL,
        key_hash VARCHAR(255) NOT NULL,
        masked_key VARCHAR(50) NOT NULL,
        environment VARCHAR(20) NOT NULL DEFAULT 'live',
        scopes JSONB NOT NULL DEFAULT '["instances:read","instances:write","messages:send","webhooks:read","webhooks:write","usage:read","logs:read"]'::jsonb,
        is_active BOOLEAN DEFAULT true,
        last_used_at TIMESTAMP NULL,
        revoked_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 9. Tabla de Logs de Solicitudes API (Observabilidad y Depuración para Developers)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS api_request_logs (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NULL REFERENCES users(id) ON DELETE SET NULL,
        instance_name VARCHAR(255) NULL,
        method VARCHAR(10) NOT NULL,
        endpoint VARCHAR(255) NOT NULL,
        status_code INTEGER NOT NULL,
        latency_ms INTEGER NOT NULL,
        request_id VARCHAR(100) NOT NULL,
        correlation_id VARCHAR(100) NULL,
        ip_address VARCHAR(50) NULL,
        user_agent TEXT NULL,
        request_headers JSONB NULL,
        request_body JSONB NULL,
        response_body JSONB NULL,
        environment VARCHAR(20) DEFAULT 'live',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 10. Tabla de Entregas y Replay de Webhooks para ERP
    await pool.query(`
      CREATE TABLE IF NOT EXISTS webhook_deliveries (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NULL REFERENCES users(id) ON DELETE SET NULL,
        instance_name VARCHAR(255) NOT NULL,
        event_id VARCHAR(100) NOT NULL,
        delivery_id VARCHAR(100) NOT NULL,
        event_type VARCHAR(100) NOT NULL,
        target_url TEXT NOT NULL,
        status VARCHAR(20) NOT NULL,
        http_status INTEGER NULL,
        latency_ms INTEGER NULL,
        attempts INTEGER DEFAULT 1,
        request_headers JSONB NULL,
        payload JSONB NOT NULL,
        response_body TEXT NULL,
        error_message TEXT NULL,
        is_replay BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_attempt_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 11. Tabla de Auditoría de Seguridad para Desarrolladores
    await pool.query(`
      CREATE TABLE IF NOT EXISTS developer_security_logs (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        action VARCHAR(100) NOT NULL,
        details JSONB NULL,
        ip_address VARCHAR(50) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 12. Tabla de Partners Oficiales B2B (Ecosistema Multi-Software)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS partners (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(100) UNIQUE NOT NULL,
        category VARCHAR(100) DEFAULT 'general',
        contact_email VARCHAR(255) NOT NULL,
        master_key VARCHAR(255) NOT NULL,
        master_key_hash VARCHAR(255) NOT NULL,
        masked_key VARCHAR(100) NOT NULL,
        webhook_url VARCHAR(500) NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 13. Índices de Alto Rendimiento
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_instances_lookup ON instances (instance_name, api_key);
      CREATE INDEX IF NOT EXISTS idx_instances_engine_type ON instances (engine_type);
      CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status ON subscriptions (user_id, status, end_date);
      CREATE INDEX IF NOT EXISTS idx_usage_logs_user ON usage_logs (user_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_payments_user ON payments (user_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON admin_audit_logs (created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_api_keys_lookup ON api_keys (key_hash, is_active);
      CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys (user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_api_logs_user ON api_request_logs (user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_api_logs_req_id ON api_request_logs (request_id);
      CREATE INDEX IF NOT EXISTS idx_wh_deliveries_user ON webhook_deliveries (user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_wh_deliveries_event ON webhook_deliveries (event_id);
      CREATE INDEX IF NOT EXISTS idx_sec_logs_user ON developer_security_logs (user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_users_external_partner ON users (external_id, partner_id);
      CREATE INDEX IF NOT EXISTS idx_partners_hash ON partners (master_key_hash, is_active);
      CREATE INDEX IF NOT EXISTS idx_partners_slug ON partners (slug);
    `);

    // 14. Asegurar rol SuperAdmin para las cuentas autorizadas
    await pool.query(`
      UPDATE users 
      SET role = 'admin', status = 'active'
      WHERE email IN ('zaza.click.app@gmail.com', 'syscomecosistemadigital@gmail.com');
    `);

    // 15. Seed de Partners Oficiales (VivesFit + Krono) y Migración de Aislamiento
    const vivesfitKey = process.env.MASTER_PARTNER_KEY || 'zc_partner_master_vivesfit_2026';
    const vivesfitHash = crypto.createHash('sha256').update(vivesfitKey).digest('hex');
    const vivesfitMasked = 'zc_partner_master_••••••••2026';

    await pool.query(`
      INSERT INTO partners (id, name, slug, category, contact_email, master_key, master_key_hash, masked_key, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
      ON CONFLICT (id) DO UPDATE SET 
        name = EXCLUDED.name,
        master_key = EXCLUDED.master_key, 
        master_key_hash = EXCLUDED.master_key_hash, 
        masked_key = EXCLUDED.masked_key;
    `, [
      'partner_vivesfit_core',
      'VivesFit Gym SaaS',
      'vivesfit',
      'fitness',
      'soporte@vivesfit.com',
      vivesfitKey,
      vivesfitHash,
      vivesfitMasked
    ]);

    const kronoKey = 'zc_partner_krono_live_2026';
    const kronoHash = crypto.createHash('sha256').update(kronoKey).digest('hex');
    const kronoMasked = 'zc_partner_krono_••••••••2026';

    await pool.query(`
      INSERT INTO partners (id, name, slug, category, contact_email, master_key, master_key_hash, masked_key, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
      ON CONFLICT (id) DO UPDATE SET 
        name = EXCLUDED.name,
        master_key = EXCLUDED.master_key, 
        master_key_hash = EXCLUDED.master_key_hash, 
        masked_key = EXCLUDED.masked_key;
    `, [
      'partner_krono_core',
      'Krono - Gestión de Personal & Asistencias',
      'krono',
      'hr_attendance',
      'soporte@krono.com',
      kronoKey,
      kronoHash,
      kronoMasked
    ]);

    // Asignar los gimnasios existentes formalmente a partner_vivesfit_core
    await pool.query(`
      UPDATE users 
      SET partner_id = 'partner_vivesfit_core' 
      WHERE (external_id LIKE 'gym_%' OR email LIKE '%vivesfit%' OR email LIKE '%gymbra%')
        AND (partner_id IS NULL OR partner_id = '');
    `);

    console.log('🚀 [Database] Estructura SaaS Core, Licenciamiento, Partners Multi-Tenant y Auditoría inicializadas exitosamente.');
  } catch (error: any) {
    console.error('❌ [Database] Error inicializando tablas:', error.message);
  }
}

export default pool;
