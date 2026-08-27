import pool from '../config/database';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { ApiKeyService } from './api-key.service';
import { engineRouter } from '../engines/core/EngineRouter';
import { EngineType } from '../engines/contracts/engine.types';
import { validateWebhookUrl } from '../utils/ssrf-validator.util';
import redis from '../config/redis';

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

export interface ProvisionTenantInput {
  companyName: string;
  externalId?: string;
  email: string;
  password?: string;
  phone?: string;
  planId?: string;
  durationMonths?: number;
  instanceName?: string;
  engineType?: 'evolution_api' | 'evolution_go';
  webhookUrl?: string;
}

export class PartnerProvisioningService {
  /**
   * Resuelve el userId de un tenant ya sea por su ID interno (user_xxx) o externalId (gym_xxx)
   */
  public static async resolveTenantId(tenantIdOrExternalId: string, partnerId?: string): Promise<string | null> {
    const res = await pool.query(
      `SELECT id FROM users
       WHERE (id = $1 OR external_id = $1)
       ${partnerId ? 'AND (partner_id = $2 OR partner_id IS NULL)' : ''}
       LIMIT 1`,
      partnerId ? [tenantIdOrExternalId, partnerId] : [tenantIdOrExternalId]
    );

    if (res.rows.length === 0) return null;
    return res.rows[0].id;
  }

  /**
   * Aprovisiona de forma atómica un nuevo Tenant/Gimnasio con Plan, Suscripción, API Key e Instancia
   */
  public static async provisionTenant(partnerId: string, data: ProvisionTenantInput) {
    const {
      companyName,
      externalId,
      email,
      password,
      phone,
      planId = 'plan_basic',
      durationMonths = 1,
      instanceName,
      engineType = 'evolution_api',
      webhookUrl
    } = data;

    if (!companyName || !email) {
      throw new Error('companyName y email son obligatorios.');
    }

    const cleanEmail = email.trim().toLowerCase();

    // 1. Validar que el email no esté tomado
    const emailCheck = await pool.query('SELECT id FROM users WHERE email = $1', [cleanEmail]);
    if (emailCheck.rows.length > 0) {
      throw new Error(`El correo electrónico ${cleanEmail} ya se encuentra registrado.`);
    }

    // 2. Si se proporciona externalId, validar unicidad
    if (externalId) {
      const extCheck = await pool.query('SELECT id FROM users WHERE external_id = $1', [externalId]);
      if (extCheck.rows.length > 0) {
        throw new Error(`El externalId "${externalId}" ya está asignado a otro tenant.`);
      }
    }

    // 3. Si se proporciona instanceName, validar formato y unicidad global
    if (instanceName) {
      if (!/^[a-zA-Z0-9_-]+$/.test(instanceName)) {
        throw new Error('instanceName inválido. Solo letras, números, guiones y guiones bajos.');
      }
      const instCheck = await pool.query('SELECT id FROM instances WHERE instance_name = $1', [instanceName]);
      if (instCheck.rows.length > 0) {
        throw new Error(`El nombre de instancia "${instanceName}" ya se encuentra en uso. Elija otro.`);
      }
    }

    // 4. Validar plan
    const planRes = await pool.query('SELECT * FROM plans WHERE id = $1', [planId]);
    const plan = planRes.rows[0] || {
      id: 'plan_basic',
      name: 'Plan Developer / B2B',
      max_instances: 1,
      max_messages: 1000,
      price: 15.00
    };

    // 5. Validar webhook URL si se proporcionó
    let normalizedWebhookUrl: string | null = null;
    if (webhookUrl) {
      const ssrf = await validateWebhookUrl(webhookUrl);
      if (!ssrf.isValid) {
        throw new Error(ssrf.reason || 'Webhook URL rechazada por política anti-SSRF.');
      }
      normalizedWebhookUrl = ssrf.normalizedUrl || webhookUrl;
    }

    const userId = generateId('user');
    const autoPassword = password || `Zz_${crypto.randomBytes(6).toString('hex')}!`;
    const hashedPassword = await bcrypt.hash(autoPassword, 10);
    const now = new Date();
    const endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() + Math.max(1, durationMonths));

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // A. Crear Tenant en users
      await client.query(
        `INSERT INTO users (id, email, password, role, status, company_name, phone, external_id, partner_id, created_at, updated_at)
         VALUES ($1, $2, $3, 'client', 'active', $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [userId, cleanEmail, hashedPassword, companyName, phone || null, externalId || null, partnerId]
      );

      // B. Crear Suscripción Activa
      const subId = generateId('sub');
      const messagesLimit = plan.max_messages || 1000;
      await client.query(
        `INSERT INTO subscriptions (id, user_id, plan_id, status, messages_limit, messages_used, payment_status, start_date, end_date)
         VALUES ($1, $2, $3, 'active', $4, 0, 'paid', $5, $6)`,
        [subId, userId, plan.id, messagesLimit, now, endDate]
      );

      // C. Registrar Transacción Inicial de Pago B2B
      const payId = generateId('pay');
      await client.query(
        `INSERT INTO payments (id, user_id, subscription_id, amount, currency, payment_method, status, notes, created_by)
         VALUES ($1, $2, $3, $4, 'USD', 'b2b_partner', 'paid', $5, $6)`,
        [payId, userId, subId, plan.price || 0.00, `Aprovisionamiento B2B Partner: ${partnerId}`, partnerId]
      );

      await client.query('COMMIT');
    } catch (dbErr: any) {
      await client.query('ROLLBACK');
      throw dbErr;
    } finally {
      client.release();
    }

    // D. Generar API Key dedicada para el Tenant
    const apiKeyRecord = await ApiKeyService.createApiKey(
      userId,
      `${companyName} API Key (B2B)`,
      'live',
      ['instances:read', 'instances:write', 'messages:send', 'webhooks:read', 'webhooks:write', 'usage:read', 'logs:read']
    );

    // E. Si se solicitó instancia inicial, crearla en el motor de WhatsApp
    let instanceResultData: any = null;
    if (instanceName) {
      const targetEngine: EngineType = (engineType === 'evolution_go' && process.env.EVOLUTION_GO_ENABLED === 'true')
        ? 'evolution_go'
        : 'evolution_api';

      try {
        const engine = engineRouter.getEngineByType(targetEngine);
        const evoRes = await engine.createInstance(instanceName);
        const evoToken = evoRes.data?.token || `token_${Date.now()}`;
        const instanceId = generateId('inst');
        const webhookSecret = `whsec_${crypto.randomBytes(24).toString('hex')}`;

        await pool.query(
          `INSERT INTO instances (id, user_id, instance_name, status, api_key, engine_type, webhook_url, webhook_secret, webhook_enabled)
           VALUES ($1, $2, $3, 'disconnected', $4, $5, $6, $7, $8)`,
          [instanceId, userId, instanceName, evoToken, targetEngine, normalizedWebhookUrl, webhookSecret, Boolean(normalizedWebhookUrl)]
        );

        instanceResultData = {
          id: instanceId,
          instanceName,
          status: 'disconnected',
          engine: targetEngine,
          qrcode: evoRes.data?.qrcode || null,
          webhookUrl: normalizedWebhookUrl,
          webhookSecret: normalizedWebhookUrl ? webhookSecret : null
        };
      } catch (evoErr: any) {
        console.warn(`[PartnerProvisioning] Instancia ${instanceName} falló en motor pero tenant fue creado:`, evoErr.message);
      }
    }

    return {
      zazaTenantId: userId,
      externalId: externalId || null,
      companyName,
      email: cleanEmail,
      status: 'active',
      plan: {
        id: plan.id,
        name: plan.name,
        maxInstances: plan.max_instances,
        maxMessages: plan.max_messages,
        expiresAt: endDate.toISOString()
      },
      apiKey: apiKeyRecord.secretKey, // Revelado solo en esta respuesta
      maskedApiKey: apiKeyRecord.maskedKey,
      instance: instanceResultData
    };
  }

  /**
   * Renovación programática de la suscripción de un tenant
   */
  public static async renewTenantSubscription(partnerId: string, tenantIdOrExternalId: string, months: number = 1, resetQuota: boolean = true) {
    const userId = await this.resolveTenantId(tenantIdOrExternalId, partnerId);
    if (!userId) {
      throw new Error(`Tenant "${tenantIdOrExternalId}" no encontrado.`);
    }

    const currentSubRes = await pool.query(
      `SELECT s.*, p.max_messages, p.name as plan_name, p.price
       FROM subscriptions s
       JOIN plans p ON s.plan_id = p.id
       WHERE s.user_id = $1
       ORDER BY s.created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (currentSubRes.rows.length === 0) {
      throw new Error('No se encontró una suscripción previa para renovar.');
    }

    const currentSub = currentSubRes.rows[0];
    const now = new Date();
    const baseDate = (currentSub.end_date && new Date(currentSub.end_date) > now) ? new Date(currentSub.end_date) : now;
    const newEndDate = new Date(baseDate);
    newEndDate.setMonth(baseDate.getMonth() + Math.max(1, months));

    const newLimit = currentSub.max_messages || currentSub.messages_limit || 1000;
    const newUsed = resetQuota ? 0 : (currentSub.messages_used || 0);

    const client = await pool.connect();
    const newSubId = generateId('sub');
    const payId = generateId('pay');

    try {
      await client.query('BEGIN');

      // Cancelar anteriores
      await client.query('UPDATE subscriptions SET status = \'cancelled\' WHERE user_id = $1 AND status IN (\'active\', \'trial\', \'expired\')', [userId]);

      // Insertar nueva
      await client.query(
        `INSERT INTO subscriptions (id, user_id, plan_id, status, messages_limit, messages_used, payment_status, start_date, end_date)
         VALUES ($1, $2, $3, 'active', $4, $5, 'paid', $6, $7)`,
        [newSubId, userId, currentSub.plan_id, newLimit, newUsed, now, newEndDate]
      );

      // Reactivar usuario
      await client.query('UPDATE users SET status = \'active\' WHERE id = $1', [userId]);

      // Registrar pago
      await client.query(
        `INSERT INTO payments (id, user_id, subscription_id, amount, currency, payment_method, status, notes, created_by)
         VALUES ($1, $2, $3, $4, 'USD', 'b2b_renew', 'paid', $5, $6)`,
        [payId, userId, newSubId, currentSub.price || 0.00, `Renovación B2B +${months} mes(es)`, partnerId]
      );

      await client.query('COMMIT');
    } catch (err: any) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    return {
      zazaTenantId: userId,
      subscriptionId: newSubId,
      plan: currentSub.plan_name,
      status: 'active',
      messagesLimit: newLimit,
      messagesUsed: newUsed,
      expiresAt: newEndDate.toISOString()
    };
  }

  /**
   * Actualiza el plan asignado al tenant (Upgrade / Downgrade)
   */
  public static async updateTenantPlan(partnerId: string, tenantIdOrExternalId: string, newPlanId: string) {
    const userId = await this.resolveTenantId(tenantIdOrExternalId, partnerId);
    if (!userId) {
      throw new Error(`Tenant "${tenantIdOrExternalId}" no encontrado.`);
    }

    const planRes = await pool.query('SELECT * FROM plans WHERE id = $1', [newPlanId]);
    if (planRes.rows.length === 0) {
      throw new Error(`Plan "${newPlanId}" no existe.`);
    }
    const newPlan = planRes.rows[0];

    // Actualizar suscripción activa
    await pool.query(
      `UPDATE subscriptions
       SET plan_id = $1, messages_limit = $2
       WHERE user_id = $3 AND status IN ('active', 'trial')`,
      [newPlan.id, newPlan.max_messages || 1000, userId]
    );

    // Ajustar instancias habilitadas según max_instances
    const instRes = await pool.query('SELECT id FROM instances WHERE user_id = $1 ORDER BY created_at ASC', [userId]);
    for (let i = 0; i < instRes.rows.length; i++) {
      const isEnabled = i < (newPlan.max_instances || 1);
      await pool.query('UPDATE instances SET is_enabled = $1 WHERE id = $2', [isEnabled, instRes.rows[i].id]);
    }

    return {
      zazaTenantId: userId,
      planId: newPlan.id,
      planName: newPlan.name,
      maxInstances: newPlan.max_instances,
      maxMessages: newPlan.max_messages
    };
  }

  /**
   * Modifica el estado del tenant (Suspensión / Reactivación Comercial)
   */
  public static async setTenantStatus(partnerId: string, tenantIdOrExternalId: string, status: 'active' | 'suspended') {
    const userId = await this.resolveTenantId(tenantIdOrExternalId, partnerId);
    if (!userId) {
      throw new Error(`Tenant "${tenantIdOrExternalId}" no encontrado.`);
    }

    await pool.query('UPDATE users SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [status, userId]);

    return {
      zazaTenantId: userId,
      status
    };
  }

  /**
   * Resetea la cuota de mensajes consumidos a 0
   */
  public static async resetTenantQuota(partnerId: string, tenantIdOrExternalId: string) {
    const userId = await this.resolveTenantId(tenantIdOrExternalId, partnerId);
    if (!userId) {
      throw new Error(`Tenant "${tenantIdOrExternalId}" no encontrado.`);
    }

    const subRes = await pool.query(
      `UPDATE subscriptions
       SET messages_used = 0
       WHERE user_id = $1 AND status IN ('active', 'trial')
       RETURNING id, messages_limit`,
      [userId]
    );

    return {
      zazaTenantId: userId,
      subscriptionId: subRes.rows[0]?.id,
      messagesUsed: 0,
      messagesLimit: subRes.rows[0]?.messages_limit
    };
  }

  /**
   * Obtiene el dossier completo de un tenant
   */
  public static async getTenantOverview(partnerId: string, tenantIdOrExternalId: string) {
    const userId = await this.resolveTenantId(tenantIdOrExternalId, partnerId);
    if (!userId) {
      throw new Error(`Tenant "${tenantIdOrExternalId}" no encontrado.`);
    }

    const userRes = await pool.query('SELECT id, email, company_name, phone, external_id, status, created_at FROM users WHERE id = $1', [userId]);
    const user = userRes.rows[0];

    const subRes = await pool.query(
      `SELECT s.*, p.name as plan_name, p.max_instances
       FROM subscriptions s
       JOIN plans p ON s.plan_id = p.id
       WHERE s.user_id = $1
       ORDER BY s.created_at DESC
       LIMIT 1`,
      [userId]
    );
    const sub = subRes.rows[0];

    const instRes = await pool.query(
      `SELECT id, instance_name, phone, status, engine_type, is_enabled, messages_sent, webhook_url, created_at
       FROM instances
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    const now = new Date();
    let daysRemaining = 0;
    let isExpired = false;

    if (sub && sub.end_date) {
      const end = new Date(sub.end_date);
      const diff = end.getTime() - now.getTime();
      daysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
      isExpired = diff <= 0 || sub.status === 'expired';
    }

    return {
      zazaTenantId: user.id,
      externalId: user.external_id,
      companyName: user.company_name,
      email: user.email,
      phone: user.phone,
      status: user.status,
      subscription: sub ? {
        id: sub.id,
        plan: sub.plan_name,
        status: isExpired ? 'expired' : sub.status,
        messagesLimit: sub.messages_limit,
        messagesUsed: sub.messages_used,
        messagesRemaining: Math.max(0, (sub.messages_limit || 0) - (sub.messages_used || 0)),
        startDate: sub.start_date,
        endDate: sub.end_date,
        daysRemaining,
        isExpired
      } : null,
      instances: instRes.rows.map(i => ({
        id: i.id,
        instanceName: i.instance_name,
        phone: i.phone,
        status: i.status,
        engine: i.engine_type,
        isEnabled: i.is_enabled,
        messagesSent: i.messages_sent,
        webhookConfigured: Boolean(i.webhook_url),
        createdAt: i.created_at
      }))
    };
  }

  /**
   * Lista todos los tenants aprovisionados por el partner
   */
  public static async listPartnerTenants(partnerId: string, limit: number = 50, offset: number = 0, search?: string) {
    let query = `
      SELECT 
        u.id as tenant_id,
        u.external_id,
        u.company_name,
        u.email,
        u.status as user_status,
        u.created_at,
        s.id as subscription_id,
        s.status as subscription_status,
        s.messages_limit,
        s.messages_used,
        s.end_date,
        p.name as plan_name,
        (SELECT COUNT(*) FROM instances WHERE user_id = u.id) as instances_count,
        (SELECT COUNT(*) FROM instances WHERE user_id = u.id AND status = 'connected') as connected_count
      FROM users u
      LEFT JOIN subscriptions s ON u.id = s.user_id AND s.id = (
        SELECT id FROM subscriptions WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1
      )
      LEFT JOIN plans p ON s.plan_id = p.id
      WHERE u.role = 'client' AND (u.partner_id = $1 OR $1 = 'partner_vivesfit_core')
    `;

    const params: any[] = [partnerId];

    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      query += ` AND (LOWER(u.company_name) LIKE $${params.length} OR LOWER(u.email) LIKE $${params.length} OR LOWER(u.external_id) LIKE $${params.length})`;
    }

    query += ` ORDER BY u.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const res = await pool.query(query, params);

    return res.rows.map(r => ({
      tenantId: r.tenant_id,
      externalId: r.external_id,
      companyName: r.company_name,
      email: r.email,
      status: r.user_status,
      plan: r.plan_name || 'Sin Plan',
      subscriptionStatus: r.subscription_status || 'none',
      messagesLimit: r.messages_limit || 0,
      messagesUsed: r.messages_used || 0,
      expiresAt: r.end_date,
      instancesCount: parseInt(r.instances_count || '0', 10),
      connectedCount: parseInt(r.connected_count || '0', 10),
      createdAt: r.created_at
    }));
  }

  /**
   * Elimina un tenant y todas sus instancias asociadas en cascada
   */
  public static async deleteTenant(partnerId: string, tenantIdOrExternalId: string) {
    const userId = await this.resolveTenantId(tenantIdOrExternalId, partnerId);
    if (!userId) {
      throw new Error(`Tenant "${tenantIdOrExternalId}" no encontrado.`);
    }

    // 1. Eliminar instancias en el motor de WhatsApp
    const instRes = await pool.query('SELECT instance_name FROM instances WHERE user_id = $1', [userId]);
    for (const row of instRes.rows) {
      try {
        const engine = await engineRouter.getEngineForInstance(row.instance_name);
        await engine.deleteInstance(row.instance_name);
        await engineRouter.invalidateCache(row.instance_name);
      } catch (err: any) {
        console.warn(`[PartnerDelete] Error eliminando ${row.instance_name} en motor:`, err.message);
      }
    }

    // 2. Eliminar de Postgres (cascada)
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);

    return {
      success: true,
      message: `Tenant "${tenantIdOrExternalId}" e instancias eliminados permanentemente.`
    };
  }
}
