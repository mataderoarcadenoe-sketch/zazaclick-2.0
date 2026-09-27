import * as crypto from 'crypto';
import pool from '../config/database';

export interface PartnerRecord {
  id: string;
  name: string;
  slug: string;
  category: string;
  contactEmail: string;
  masterKey?: string;
  masterKeyHash: string;
  maskedKey: string;
  webhookUrl: string | null;
  isActive: boolean;
  tenantsCount?: number;
  connectedInstancesCount?: number;
  messagesSent?: number;
  createdAt: string;
  updatedAt: string;
}

export class PartnerService {
  /**
   * Hashea una clave maestra B2B con SHA-256
   */
  public static hashKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  /**
   * Enmascara la Master Key para mostrarla segura en el panel
   */
  public static maskKey(key: string): string {
    if (key.length <= 12) return 'zc_••••••••';
    const prefix = key.slice(0, 11); // ej: zc_partner_
    const suffix = key.slice(-4);
    return `${prefix}••••••••${suffix}`;
  }

  /**
   * Lista todos los partners registrados junto con sus métricas consolidadas
   */
  public static async listPartners(): Promise<PartnerRecord[]> {
    const query = `
      SELECT 
        p.id,
        p.name,
        p.slug,
        p.category,
        p.contact_email,
        p.master_key,
        p.master_key_hash,
        p.masked_key,
        p.webhook_url,
        p.is_active,
        p.created_at,
        p.updated_at,
        COALESCE(COUNT(DISTINCT u.id), 0)::int as tenants_count,
        COALESCE(COUNT(DISTINCT CASE WHEN i.status = 'connected' THEN i.id END), 0)::int as connected_instances_count,
        COALESCE(SUM(s.messages_used), 0)::int as messages_sent
      FROM partners p
      LEFT JOIN users u ON u.partner_id = p.id AND u.role = 'client'
      LEFT JOIN instances i ON i.user_id = u.id
      LEFT JOIN subscriptions s ON s.user_id = u.id AND s.status IN ('active', 'trial')
      GROUP BY p.id, p.name, p.slug, p.category, p.contact_email, p.master_key, p.master_key_hash, p.masked_key, p.webhook_url, p.is_active, p.created_at, p.updated_at
      ORDER BY p.created_at ASC;
    `;

    const res = await pool.query(query);

    return res.rows.map(r => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      category: r.category,
      contactEmail: r.contact_email,
      masterKey: r.master_key,
      masterKeyHash: r.master_key_hash,
      maskedKey: r.masked_key,
      webhookUrl: r.webhook_url,
      isActive: r.is_active,
      tenantsCount: r.tenants_count,
      connectedInstancesCount: r.connected_instances_count,
      messagesSent: r.messages_sent,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  }

  /**
   * Obtiene un partner validando su Master Key (en O(1) vía hash)
   */
  public static async getPartnerByKey(candidateKey: string): Promise<PartnerRecord | null> {
    if (!candidateKey) return null;

    const cleanKey = candidateKey.trim();
    const keyHash = this.hashKey(cleanKey);

    // 1. Fallback explícito inmediato para Master Partner Keys oficiales de confianza
    if (cleanKey === 'zc_partner_master_vivesfit_2026' || cleanKey === 'zc_partner_vivesfit_live_2026') {
      return {
        id: 'partner_vivesfit_core',
        name: 'VivesFit Gym SaaS',
        slug: 'vivesfit',
        category: 'fitness',
        contactEmail: 'soporte@vivesfit.com',
        masterKey: 'zc_partner_master_vivesfit_2026',
        masterKeyHash: this.hashKey('zc_partner_master_vivesfit_2026'),
        maskedKey: 'zc_partner_master_••••••••2026',
        webhookUrl: null,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }

    if (cleanKey === 'zc_partner_krono_live_2026') {
      return {
        id: 'partner_krono_core',
        name: 'Krono - Gestión de Personal & Asistencias',
        slug: 'krono',
        category: 'hr_attendance',
        contactEmail: 'soporte@krono.com',
        masterKey: 'zc_partner_krono_live_2026',
        masterKeyHash: this.hashKey('zc_partner_krono_live_2026'),
        maskedKey: 'zc_partner_krono_••••••••2026',
        webhookUrl: null,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }

    // 2. Consulta en base de datos por hash SHA-256 o coincidencia exacta
    try {
      const res = await pool.query(
        `SELECT * FROM partners 
         WHERE (master_key_hash = $1 OR master_key = $2) AND is_active = true 
         LIMIT 1`,
        [keyHash, cleanKey]
      );

      if (res.rows.length > 0) {
        const r = res.rows[0];
        return {
          id: r.id,
          name: r.name,
          slug: r.slug,
          category: r.category,
          contactEmail: r.contact_email,
          masterKey: r.master_key,
          masterKeyHash: r.master_key_hash,
          maskedKey: r.masked_key,
          webhookUrl: r.webhook_url,
          isActive: r.is_active,
          createdAt: r.created_at,
          updatedAt: r.updated_at
        };
      }
    } catch (err: any) {
      console.warn('[PartnerService] Error consultando partners en DB:', err.message);
    }

    // 3. Fallback variable de entorno
    const legacyKey = process.env.MASTER_PARTNER_KEY;
    if (legacyKey && cleanKey === legacyKey) {
      return {
        id: 'partner_vivesfit_core',
        name: 'VivesFit Gym SaaS',
        slug: 'vivesfit',
        category: 'fitness',
        contactEmail: 'soporte@vivesfit.com',
        masterKey: legacyKey,
        masterKeyHash: keyHash,
        maskedKey: this.maskKey(legacyKey),
        webhookUrl: null,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }

    return null;
  }

  /**
   * Crea un nuevo Partner B2B con Master Key única generada criptográficamente
   */
  public static async createPartner(data: {
    name: string;
    slug: string;
    category?: string;
    contactEmail: string;
    webhookUrl?: string;
  }): Promise<{ partner: PartnerRecord; secretKey: string }> {
    const { name, slug, category = 'general', contactEmail, webhookUrl } = data;

    if (!name || !slug || !contactEmail) {
      throw new Error('name, slug y contactEmail son obligatorios.');
    }

    const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9_-]/g, '');

    // Verificar si ya existe el slug
    const existing = await pool.query('SELECT id FROM partners WHERE slug = $1', [cleanSlug]);
    if (existing.rows.length > 0) {
      throw new Error(`El identificador (slug) "${cleanSlug}" ya se encuentra registrado por otro Partner.`);
    }

    const partnerId = `partner_${cleanSlug}_${Date.now()}`;
    const randomSecret = crypto.randomBytes(16).toString('hex');
    const fullSecretKey = `zc_partner_${cleanSlug}_${randomSecret}`;
    const keyHash = this.hashKey(fullSecretKey);
    const maskedKey = this.maskKey(fullSecretKey);

    await pool.query(
      `INSERT INTO partners (id, name, slug, category, contact_email, master_key, master_key_hash, masked_key, webhook_url, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)`,
      [partnerId, name, cleanSlug, category, contactEmail, fullSecretKey, keyHash, maskedKey, webhookUrl || null]
    );

    return {
      partner: {
        id: partnerId,
        name,
        slug: cleanSlug,
        category,
        contactEmail,
        masterKey: fullSecretKey,
        masterKeyHash: keyHash,
        maskedKey,
        webhookUrl: webhookUrl || null,
        isActive: true,
        tenantsCount: 0,
        connectedInstancesCount: 0,
        messagesSent: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      secretKey: fullSecretKey
    };
  }

  /**
   * Suspender o reactivar un Partner
   */
  public static async toggleStatus(partnerId: string, isActive: boolean) {
    const res = await pool.query(
      'UPDATE partners SET is_active = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [isActive, partnerId]
    );
    if (res.rows.length === 0) {
      throw new Error(`Partner "${partnerId}" no encontrado.`);
    }
    return res.rows[0];
  }

  /**
   * Rotar la Master Key de un Partner
   */
  public static async rotateKey(partnerId: string): Promise<{ newSecretKey: string; maskedKey: string }> {
    const current = await pool.query('SELECT slug FROM partners WHERE id = $1', [partnerId]);
    if (current.rows.length === 0) {
      throw new Error(`Partner "${partnerId}" no encontrado.`);
    }

    const slug = current.rows[0].slug;
    const randomSecret = crypto.randomBytes(16).toString('hex');
    const newSecretKey = `zc_partner_${slug}_${randomSecret}`;
    const keyHash = this.hashKey(newSecretKey);
    const maskedKey = this.maskKey(newSecretKey);

    await pool.query(
      'UPDATE partners SET master_key = $1, master_key_hash = $2, masked_key = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4',
      [newSecretKey, keyHash, maskedKey, partnerId]
    );

    return { newSecretKey, maskedKey };
  }
}
