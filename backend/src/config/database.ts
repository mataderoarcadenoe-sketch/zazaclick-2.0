import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as crypto from 'crypto';

dotenv.config();

const rawDbUrl = process.env.DATABASE_URL;
const dbUrl = rawDbUrl ? rawDbUrl.replace('pooler.supabase.com:5432', 'pooler.supabase.com:6543') : rawDbUrl;

if (!dbUrl) {
  console.warn('⚠️ WARNING: DATABASE_URL no configurada en el entorno.');
}

const isLocalOrInternal = !dbUrl || dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1') || dbUrl.includes('railway.internal');

const pool = new Pool({
  connectionString: dbUrl,
  ssl: isLocalOrInternal ? false : { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 15000,
  allowExitOnIdle: true
});

pool.on('connect', () => {
  console.log('✅ [Database] Conectado exitosamente a PostgreSQL (Zaza Click 2.0 WhatsApp API SaaS Gateway).');
});

pool.on('error', (err) => {
  console.error('⚠️ [Database] Error en el pool de conexiones:', err.message);
});

async function safeQuery(label: string, queryText: string, params: any[] = []) {
  try {
    return await pool.query(queryText, params);
  } catch (err: any) {
    console.warn(`⚠️ [Database SafeQuery] ${label}:`, err.message);
    return null;
  }
}

/**
 * Inicializar y migrar de forma segura y no destructiva las tablas del SaaS Core
 */
export async function initDatabase() {
  if (!dbUrl) {
    console.warn('⚠️ Skipping DB init: DATABASE_URL missing.');
    return;
  }

  console.log('🔄 [Database] Verificando e inicializando esquema de datos Zaza Click 2.0...');

  // 1. Tabla de Usuarios
  await safeQuery('Tabla users', `
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

  await safeQuery('Columnas users', `
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
  await safeQuery('Tabla plans', `
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

  await safeQuery('Columnas plans', `
    ALTER TABLE plans ADD COLUMN IF NOT EXISTS max_messages INTEGER DEFAULT 1000;
    ALTER TABLE plans ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
    ALTER TABLE plans ADD COLUMN IF NOT EXISTS is_trial BOOLEAN DEFAULT false;
    ALTER TABLE plans ADD COLUMN IF NOT EXISTS trial_days INTEGER DEFAULT 7;
    ALTER TABLE plans ADD COLUMN IF NOT EXISTS trial_messages INTEGER DEFAULT 100;
    ALTER TABLE plans ADD COLUMN IF NOT EXISTS description TEXT NULL;
  `);

  await safeQuery('Seed plans', `
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
  await safeQuery('Tabla subscriptions', `
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

  await safeQuery('Columnas subscriptions', `
    ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS messages_limit INTEGER DEFAULT 1000;
    ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS messages_used INTEGER DEFAULT 0;
    ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'paid';
  `);

  // 4. Tabla de Instancias de WhatsApp API
  await safeQuery('Tabla instances', `
    CREATE TABLE IF NOT EXISTS instances (
      id VARCHAR(255) PRIMARY KEY,
      user_id VARCHAR(255) NULL REFERENCES users(id) ON DELETE CASCADE,
      instance_name VARCHAR(255) UNIQUE NOT NULL,
      phone VARCHAR(50),
      status VARCHAR(50) DEFAULT 'disconnected',
      is_enabled BOOLEAN DEFAULT true,
      messages_sent INTEGER DEFAULT 0,
      last_activity_at TIMESTAMP NULL,
      api_key VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await safeQuery('Columnas instances', `
    ALTER TABLE instances ALTER COLUMN instance_name DROP NOT NULL;
    ALTER TABLE instances ALTER COLUMN user_id DROP NOT NULL;
    ALTER TABLE instances ALTER COLUMN api_key DROP NOT NULL;
    ALTER TABLE instances ADD COLUMN IF NOT EXISTS name VARCHAR(255);
    ALTER TABLE instances ADD COLUMN IF NOT EXISTS token VARCHAR(255);
    ALTER TABLE instances ADD COLUMN IF NOT EXISTS connection_status VARCHAR(50);
    ALTER TABLE instances ADD COLUMN IF NOT EXISTS owner_jid VARCHAR(255);
    ALTER TABLE instances ADD COLUMN IF NOT EXISTS profile_name VARCHAR(255);
    ALTER TABLE instances ADD COLUMN IF NOT EXISTS profile_pic_url TEXT;
    ALTER TABLE instances ADD COLUMN IF NOT EXISTS integration VARCHAR(50) DEFAULT 'WHATSAPP-BAILEYS';
    ALTER TABLE instances ADD COLUMN IF NOT EXISTS number VARCHAR(50);
    ALTER TABLE instances ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN DEFAULT true;
    ALTER TABLE instances ADD COLUMN IF NOT EXISTS messages_sent INTEGER DEFAULT 0;
    ALTER TABLE instances ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP NULL;
    ALTER TABLE instances ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE instances ADD COLUMN IF NOT EXISTS engine_type VARCHAR(50) DEFAULT 'evolution_go';
    ALTER TABLE instances ADD COLUMN IF NOT EXISTS webhook_url TEXT NULL;
    ALTER TABLE instances ADD COLUMN IF NOT EXISTS webhook_secret VARCHAR(255) NULL;
    ALTER TABLE instances ADD COLUMN IF NOT EXISTS webhook_enabled BOOLEAN DEFAULT true;

    -- Evolution Go GORM columns (snake_case)
    ALTER TABLE instances ADD COLUMN IF NOT EXISTS "name" VARCHAR(255);
    ALTER TABLE instances ADD COLUMN IF NOT EXISTS "token" VARCHAR(255);
    ALTER TABLE instances ADD COLUMN IF NOT EXISTS "always_online" BOOLEAN DEFAULT false;
    ALTER TABLE instances ADD COLUMN IF NOT EXISTS "reject_call" BOOLEAN DEFAULT false;
    ALTER TABLE instances ADD COLUMN IF NOT EXISTS "msg_reject_call" TEXT DEFAULT '';
    ALTER TABLE instances ADD COLUMN IF NOT EXISTS "read_messages" BOOLEAN DEFAULT false;
    ALTER TABLE instances ADD COLUMN IF NOT EXISTS "ignore_groups" BOOLEAN DEFAULT false;
    ALTER TABLE instances ADD COLUMN IF NOT EXISTS "ignore_status" BOOLEAN DEFAULT false;
    ALTER TABLE instances ADD COLUMN IF NOT EXISTS "web_socket_enable" TEXT DEFAULT '';
    ALTER TABLE instances ADD COLUMN IF NOT EXISTS "rabbitmq_enable" TEXT DEFAULT '';
    ALTER TABLE instances ADD COLUMN IF NOT EXISTS "nats_enable" TEXT DEFAULT '';
    ALTER TABLE instances ADD COLUMN IF NOT EXISTS "disconnect_reason" TEXT DEFAULT '';
    ALTER TABLE instances ADD COLUMN IF NOT EXISTS "events" TEXT DEFAULT 'MESSAGE';
    ALTER TABLE instances ADD COLUMN IF NOT EXISTS "os_name" TEXT DEFAULT '';
    ALTER TABLE instances ADD COLUMN IF NOT EXISTS "proxy" TEXT DEFAULT '';
    ALTER TABLE instances ADD COLUMN IF NOT EXISTS "client_name" TEXT DEFAULT '';
    ALTER TABLE instances ADD COLUMN IF NOT EXISTS "expiration" BIGINT DEFAULT 0;
    ALTER TABLE instances ADD COLUMN IF NOT EXISTS "connected" BOOLEAN DEFAULT false;
    ALTER TABLE instances ADD COLUMN IF NOT EXISTS "jid" TEXT DEFAULT '';
    ALTER TABLE instances ADD COLUMN IF NOT EXISTS "qrcode" TEXT DEFAULT '';
    ALTER TABLE instances ADD COLUMN IF NOT EXISTS "webhook" TEXT DEFAULT '';

    -- Limpiar columnas camelCase huérfanas de Prisma/Evolution Node
    ALTER TABLE instances DROP COLUMN IF EXISTS "createdAt";
    ALTER TABLE instances DROP COLUMN IF EXISTS "alwaysOnline";
    ALTER TABLE instances DROP COLUMN IF EXISTS "rejectCall";
    ALTER TABLE instances DROP COLUMN IF EXISTS "msgRejectCall";
    ALTER TABLE instances DROP COLUMN IF EXISTS "readMessages";
    ALTER TABLE instances DROP COLUMN IF EXISTS "ignoreGroups";
    ALTER TABLE instances DROP COLUMN IF EXISTS "ignoreStatus";
    ALTER TABLE instances DROP COLUMN IF EXISTS "websocketEnable";
    ALTER TABLE instances DROP COLUMN IF EXISTS "rabbitmqEnable";
    ALTER TABLE instances DROP COLUMN IF EXISTS "natsEnable";
  `);

  // Sincronizar name <-> instance_name y migrar engine_type
  await safeQuery('Sync name/instance_name', `
    UPDATE instances SET name = instance_name WHERE name IS NULL AND instance_name IS NOT NULL;
    UPDATE instances SET instance_name = name WHERE instance_name IS NULL AND name IS NOT NULL;
    UPDATE instances SET engine_type = 'evolution_go' WHERE engine_type IS NULL OR engine_type = 'evolution_api';
  `);

  // Normalizar IDs a formato UUID canónico de 36 caracteres para compatibilidad estricta con GORM Go
  try {
    const instRows = await pool.query(`SELECT id FROM instances WHERE id IS NULL OR length(id) != 36 OR id NOT LIKE '%-%-%-%-%'`);
    if (instRows.rows.length > 0) {
      for (const row of instRows.rows) {
        const canonicalUuid = crypto.randomUUID();
        await pool.query('UPDATE instances SET id = $1 WHERE id = $2', [canonicalUuid, row.id]);
      }
      console.log(`✅ [Database] ${instRows.rows.length} IDs de instancias normalizados a UUID v4 canónico.`);
    }
  } catch (uuidErr: any) {
    console.warn('⚠️ [Database] UUID Normalization:', uuidErr.message);
  }

  // Trigger de sincronización de instancias
  await safeQuery('Trigger sync_instances_columns', `
    CREATE OR REPLACE FUNCTION sync_instances_columns() 
    RETURNS TRIGGER AS $$
    BEGIN
      IF NEW.instance_name IS NULL AND NEW.name IS NOT NULL THEN
        NEW.instance_name := NEW.name;
      END IF;
      IF NEW.name IS NULL AND NEW.instance_name IS NOT NULL THEN
        NEW.name := NEW.instance_name;
      END IF;
      IF NEW.id IS NULL OR length(NEW.id) != 36 OR NEW.id NOT LIKE '%-%-%-%-%' THEN
        NEW.id := md5(random()::text || clock_timestamp()::text)::uuid::text;
      END IF;
      IF NEW.api_key IS NULL AND NEW.token IS NOT NULL THEN
        NEW.api_key := NEW.token;
      END IF;
      IF NEW.token IS NULL AND NEW.api_key IS NOT NULL THEN
        NEW.token := NEW.api_key;
      END IF;
      IF NEW.jid IS NOT NULL AND NEW.jid != '' THEN
        NEW.phone := split_part(split_part(NEW.jid, '@', 1), ':', 1);
      END IF;
      IF NEW.connected = true AND NEW.jid IS NOT NULL AND NEW.jid != '' THEN
        NEW.status := 'connected';
      ELSIF TG_OP = 'UPDATE' AND NEW.connected = false AND OLD.connected = true THEN
        IF NEW.jid IS NULL OR NEW.jid = '' THEN
          NEW.status := 'disconnected';
        ELSIF NEW.status = 'connected' THEN
          NEW.status := 'reconnecting';
        END IF;
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_sync_instances_columns ON instances;
    CREATE TRIGGER trg_sync_instances_columns
    BEFORE INSERT OR UPDATE ON instances
    FOR EACH ROW EXECUTE FUNCTION sync_instances_columns();
  `);

  // Sincronizar estado inicial de instancias ya vinculadas en Whatsmeow
  await safeQuery('Sincronizar instancias conectadas con JID', `
    UPDATE instances
    SET status = 'connected',
        phone = split_part(split_part(jid, '@', 1), ':', 1)
    WHERE connected = true AND jid IS NOT NULL AND jid != '';
  `);

  // Migrar IDs legacy a UUIDs válidos para compatibilidad estricta con Evolution Go (GORM)
  await safeQuery('Migrar IDs de instancias a UUIDs', `
    UPDATE instances 
    SET id = md5(random()::text || clock_timestamp()::text)::uuid::text 
    WHERE length(id) != 36 OR id NOT LIKE '%-%-%-%-%';
  `);

  // 5. Tabla de Pagos Administrativos
  await safeQuery('Tabla payments', `
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

  // 6. Tabla de Métricas de Consumo Ligeras
  await safeQuery('Tabla usage_logs', `
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
  await safeQuery('Tabla admin_audit_logs', `
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

  // 8. Tabla de API Keys
  await safeQuery('Tabla api_keys', `
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

  // 9. Tabla de Logs de Solicitudes API
  await safeQuery('Tabla api_request_logs', `
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

  // 10. Tabla de Entregas de Webhooks
  await safeQuery('Tabla webhook_deliveries', `
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

  // 11. Tabla de Auditoría de Seguridad de Desarrolladores
  await safeQuery('Tabla developer_security_logs', `
    CREATE TABLE IF NOT EXISTS developer_security_logs (
      id VARCHAR(255) PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      action VARCHAR(100) NOT NULL,
      details JSONB NULL,
      ip_address VARCHAR(50) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 12. Tabla de Partners Oficiales B2B
  await safeQuery('Tabla partners', `
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
  await safeQuery('Índices', `
    CREATE INDEX IF NOT EXISTS idx_instances_lookup ON instances (instance_name, api_key);
    CREATE INDEX IF NOT EXISTS idx_instances_user_id ON instances (user_id);
    CREATE INDEX IF NOT EXISTS idx_instances_name ON instances (name);
    CREATE INDEX IF NOT EXISTS idx_instances_user_status ON instances (user_id, status);
    CREATE INDEX IF NOT EXISTS idx_instances_status ON instances (status);
    CREATE INDEX IF NOT EXISTS idx_instances_engine_type ON instances (engine_type);
    CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status ON subscriptions (user_id, status, end_date);
    CREATE INDEX IF NOT EXISTS idx_usage_logs_user ON usage_logs (user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_payments_user ON payments (user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON admin_audit_logs (created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_api_keys_lookup ON api_keys (key_hash, is_active);
    CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys (user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_api_logs_user ON api_request_logs (user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_api_logs_created ON api_request_logs (created_at);
    CREATE INDEX IF NOT EXISTS idx_api_logs_req_id ON api_request_logs (request_id);
    CREATE INDEX IF NOT EXISTS idx_wh_deliveries_user ON webhook_deliveries (user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_wh_deliveries_event ON webhook_deliveries (event_id);
    CREATE INDEX IF NOT EXISTS idx_sec_logs_user ON developer_security_logs (user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_users_external_partner ON users (external_id, partner_id);
    CREATE INDEX IF NOT EXISTS idx_partners_hash ON partners (master_key_hash, is_active);
    CREATE INDEX IF NOT EXISTS idx_partners_slug ON partners (slug);
  `);

  // 14. SuperAdmin Role Update
  await safeQuery('SuperAdmin Role', `
    UPDATE users 
    SET role = 'admin', status = 'active'
    WHERE email = 'syscomecosistemadigital@gmail.com';

    UPDATE users
    SET role = 'client'
    WHERE role = 'admin' AND email != 'syscomecosistemadigital@gmail.com';
  `);

  // Partners and tenant membership are provisioned explicitly; startup never restores public keys.


  console.log('🚀 [Database] Estructura SaaS Core, Licenciamiento, Partners Multi-Tenant y Auditoría inicializadas exitosamente.');
}

export default pool;
