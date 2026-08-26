import * as crypto from 'crypto';
import pool from '../config/database';

export interface ApiKeyRecord {
  id: string;
  userId: string;
  name: string;
  keyPrefix: string;
  maskedKey: string;
  environment: 'live' | 'test';
  scopes: string[];
  isActive: boolean;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  secretKey?: string; // Solo presente al momento de la creación/rotación
}

export class ApiKeyService {
  /**
   * Hashea una API Key con SHA-256 para almacenamiento y validación segura en Base de Datos
   */
  public static hashKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  /**
   * Enmascara una API Key para visualización segura en interfaces de usuario
   */
  public static maskKey(key: string, environment: 'live' | 'test' = 'live'): string {
    const last4 = key.slice(-4);
    const prefix = environment === 'test' ? 'zc_test_' : 'zc_live_';
    return `${prefix}********${last4}`;
  }

  /**
   * Genera una nueva API Key de grado criptográfico
   */
  public static async createApiKey(
    userId: string,
    name: string = 'Default API Key',
    environment: 'live' | 'test' = 'live',
    scopes: string[] = ['instances:read', 'instances:write', 'messages:send', 'webhooks:read', 'webhooks:write', 'usage:read', 'logs:read'],
    ipAddress?: string
  ): Promise<ApiKeyRecord> {
    const keyId = `key_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const prefix = environment === 'test' ? 'zc_test_' : 'zc_live_';
    const randomSecret = crypto.randomBytes(24).toString('hex');
    const fullSecretKey = `${prefix}${randomSecret}`;
    const keyHash = this.hashKey(fullSecretKey);
    const maskedKey = this.maskKey(fullSecretKey, environment);

    await pool.query(
      `INSERT INTO api_keys (id, user_id, name, key_prefix, key_hash, masked_key, environment, scopes, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, CURRENT_TIMESTAMP)`,
      [keyId, userId, name, prefix, keyHash, maskedKey, environment, JSON.stringify(scopes)]
    );

    // Registrar en auditoría de seguridad
    try {
      await pool.query(
        `INSERT INTO developer_security_logs (id, user_id, action, details, ip_address, created_at)
         VALUES ($1, $2, 'API_KEY_CREATED', $3, $4, CURRENT_TIMESTAMP)`,
        [`sec_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`, userId, JSON.stringify({ keyId, name, environment, maskedKey }), ipAddress || null]
      );
    } catch {}

    return {
      id: keyId,
      userId,
      name,
      keyPrefix: prefix,
      maskedKey,
      environment,
      scopes,
      isActive: true,
      lastUsedAt: null,
      revokedAt: null,
      createdAt: new Date().toISOString(),
      secretKey: fullSecretKey // Única vez que se expone
    };
  }

  /**
   * Lista todas las API Keys activas e históricas de un desarrollador (con secreto enmascarado)
   */
  public static async listApiKeys(userId: string): Promise<ApiKeyRecord[]> {
    const res = await pool.query(
      `SELECT id, user_id, name, key_prefix, masked_key, environment, scopes, is_active, last_used_at, revoked_at, created_at
       FROM api_keys
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    return res.rows.map(r => ({
      id: r.id,
      userId: r.user_id,
      name: r.name,
      keyPrefix: r.key_prefix,
      maskedKey: r.masked_key,
      environment: r.environment as 'live' | 'test',
      scopes: typeof r.scopes === 'string' ? JSON.parse(r.scopes) : r.scopes,
      isActive: r.is_active,
      lastUsedAt: r.last_used_at ? r.last_used_at.toISOString() : null,
      revokedAt: r.revoked_at ? r.revoked_at.toISOString() : null,
      createdAt: r.created_at ? r.created_at.toISOString() : new Date().toISOString()
    }));
  }

  /**
   * Revoca una API Key existente de forma permanente
   */
  public static async revokeApiKey(userId: string, keyId: string, ipAddress?: string): Promise<boolean> {
    const res = await pool.query(
      `UPDATE api_keys
       SET is_active = false, revoked_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2 AND is_active = true
       RETURNING masked_key, name`,
      [keyId, userId]
    );

    if (res.rows.length === 0) return false;

    // Registrar en auditoría de seguridad
    try {
      await pool.query(
        `INSERT INTO developer_security_logs (id, user_id, action, details, ip_address, created_at)
         VALUES ($1, $2, 'API_KEY_REVOKED', $3, $4, CURRENT_TIMESTAMP)`,
        [`sec_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`, userId, JSON.stringify({ keyId, name: res.rows[0].name, maskedKey: res.rows[0].masked_key }), ipAddress || null]
      );
    } catch {}

    return true;
  }

  /**
   * Rota una API Key: revoca la anterior y emite una nueva
   */
  public static async rotateApiKey(userId: string, keyId: string, ipAddress?: string): Promise<ApiKeyRecord | null> {
    const existing = await pool.query(
      `SELECT name, environment, scopes FROM api_keys WHERE id = $1 AND user_id = $2 LIMIT 1`,
      [keyId, userId]
    );

    if (existing.rows.length === 0) return null;

    const { name, environment, scopes } = existing.rows[0];
    const parsedScopes = typeof scopes === 'string' ? JSON.parse(scopes) : scopes;

    // Revocar la anterior
    await this.revokeApiKey(userId, keyId, ipAddress);

    // Crear la nueva
    const newKey = await this.createApiKey(userId, `${name} (Rotada)`, environment, parsedScopes, ipAddress);

    // Registrar rotación
    try {
      await pool.query(
        `INSERT INTO developer_security_logs (id, user_id, action, details, ip_address, created_at)
         VALUES ($1, $2, 'API_KEY_ROTATED', $3, $4, CURRENT_TIMESTAMP)`,
        [`sec_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`, userId, JSON.stringify({ oldKeyId: keyId, newKeyId: newKey.id }), ipAddress || null]
      );
    } catch {}

    return newKey;
  }

  /**
   * Valida una API Key entrante contra PostgreSQL y actualiza su fecha de último uso
   */
  public static async validateKey(apiKey: string): Promise<{ isValid: boolean; userId?: string; environment?: 'live' | 'test'; scopes?: string[] }> {
    if (!apiKey) return { isValid: false };

    const keyHash = this.hashKey(apiKey);

    const res = await pool.query(
      `SELECT id, user_id, environment, scopes, is_active
       FROM api_keys
       WHERE key_hash = $1 AND is_active = true
       LIMIT 1`,
      [keyHash]
    );

    if (res.rows.length > 0) {
      const row = res.rows[0];

      // Actualizar last_used_at de forma no bloqueante
      pool.query(`UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = $1`, [row.id]).catch(() => {});

      return {
        isValid: true,
        userId: row.user_id,
        environment: row.environment as 'live' | 'test',
        scopes: typeof row.scopes === 'string' ? JSON.parse(row.scopes) : row.scopes
      };
    }

    return { isValid: false };
  }
}
