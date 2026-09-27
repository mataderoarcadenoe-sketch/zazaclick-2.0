import { Router } from 'express';
import pool from '../config/database';
import * as bcrypt from 'bcryptjs';
import { authMiddleware, adminMiddleware, AuthenticatedRequest } from '../middleware/auth.middleware';
import { EvolutionService } from '../services/evolution.service';
import { AuditService } from '../services/audit.service';
import { PartnerService } from '../services/partner.service';

const router = Router();

// Proteger todas las rutas con autenticación y rol SuperAdmin
router.use(authMiddleware);
router.use(adminMiddleware);

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

/**
 * GET /stats - KPIs globales del SaaS en tiempo real con alertas operativas
 */
router.get('/stats', async (req: AuthenticatedRequest, res) => {
  try {
    const statsQuery = `
      SELECT 
        (SELECT json_build_object(
          'total_users', COALESCE(COUNT(*), 0)::int,
          'active_users', COALESCE(COUNT(*) FILTER (WHERE status = 'active'), 0)::int,
          'suspended_users', COALESCE(COUNT(*) FILTER (WHERE status = 'suspended'), 0)::int,
          'blocked_users', COALESCE(COUNT(*) FILTER (WHERE status = 'blocked'), 0)::int
        ) FROM users WHERE role = 'client') as users,
        (SELECT json_build_object(
          'total_instances', COALESCE(COUNT(*), 0)::int,
          'connected_instances', COALESCE(COUNT(*) FILTER (WHERE status = 'connected'), 0)::int,
          'disabled_instances', COALESCE(COUNT(*) FILTER (WHERE is_enabled = false), 0)::int
        ) FROM instances) as instances,
        (SELECT json_build_object(
          'active_subscriptions', COALESCE(COUNT(*) FILTER (WHERE status = 'active' AND end_date >= CURRENT_TIMESTAMP), 0)::int,
          'trial_subscriptions', COALESCE(COUNT(*) FILTER (WHERE status = 'trial' AND end_date >= CURRENT_TIMESTAMP), 0)::int,
          'expired_subscriptions', COALESCE(COUNT(*) FILTER (WHERE end_date < CURRENT_TIMESTAMP OR status = 'expired'), 0)::int,
          'expiring_soon', COALESCE(COUNT(*) FILTER (WHERE end_date >= CURRENT_TIMESTAMP AND end_date <= CURRENT_TIMESTAMP + INTERVAL '3 days'), 0)::int,
          'quota_exhausted', COALESCE(COUNT(*) FILTER (WHERE messages_used >= messages_limit AND status IN ('active', 'trial')), 0)::int
        ) FROM subscriptions) as subscriptions,
        (SELECT json_build_object(
          'total_messages', COALESCE(COUNT(*), 0)::int,
          'successful_messages', COALESCE(COUNT(*) FILTER (WHERE status = 'SUCCESS'), 0)::int,
          'failed_messages', COALESCE(COUNT(*) FILTER (WHERE status = 'FAILED'), 0)::int
        ) FROM usage_logs) as traffic,
        (SELECT json_build_object(
          'total_revenue', COALESCE(SUM(amount) FILTER (WHERE status = 'paid'), 0)::numeric,
          'pending_payments', COALESCE(COUNT(*) FILTER (WHERE status = 'pending'), 0)::int
        ) FROM payments) as financial;
    `;

    const result = await pool.query(statsQuery);
    const row = result.rows[0] || {};

    res.json({
      success: true,
      data: {
        users: row.users || { total_users: 0, active_users: 0, suspended_users: 0, blocked_users: 0 },
        instances: row.instances || { total_instances: 0, connected_instances: 0, disabled_instances: 0 },
        subscriptions: row.subscriptions || { active_subscriptions: 0, trial_subscriptions: 0, expired_subscriptions: 0, expiring_soon: 0, quota_exhausted: 0 },
        traffic: row.traffic || { total_messages: 0, successful_messages: 0, failed_messages: 0 },
        financial: row.financial || { total_revenue: 0, pending_payments: 0 }
      }
    });
  } catch (error: any) {
    console.error('[AdminStats Error]:', error.message);
    res.status(500).json({ success: false, error: 'Error al cargar estadísticas globales', detail: error.message });
  }
});

/**
 * GET /users - Listar clientes con dossier completo de suscripción, cuotas y días restantes
 */
router.get('/users', async (req: AuthenticatedRequest, res) => {
  try {
    const query = `
      SELECT 
        u.id, 
        u.email, 
        u.role, 
        u.status,
        u.status as user_status,
        u.external_id,
        u.partner_id,
        pt.name as partner_name,
        pt.slug as partner_slug,
        u.trial_used,
        u.company_name,
        u.phone,
        u.created_at,
        u.last_login_at,
        s.id as subscription_id,
        s.plan_id,
        p.name as plan_name,
        p.price as plan_price,
        p.max_instances,
        s.status as subscription_status,
        s.messages_limit,
        s.messages_used,
        s.payment_status,
        s.start_date as subscription_start_date,
        s.end_date as subscription_end_date,
        (SELECT COUNT(*) FROM instances WHERE user_id = u.id) as instances_count,
        (SELECT COUNT(*) FROM instances WHERE user_id = u.id AND status = 'connected') as connected_instances_count
      FROM users u
      LEFT JOIN partners pt ON u.partner_id = pt.id
      LEFT JOIN subscriptions s ON u.id = s.user_id AND s.id = (
        SELECT id FROM subscriptions WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1
      )
      LEFT JOIN plans p ON s.plan_id = p.id
      WHERE u.role = 'client'
      ORDER BY u.created_at DESC;
    `;

    const result = await pool.query(query);
    const now = new Date();

    const formattedUsers = result.rows.map(user => {
      let daysRemaining = 0;
      let isExpired = false;

      if (user.subscription_end_date) {
        const endDate = new Date(user.subscription_end_date);
        const diffMs = endDate.getTime() - now.getTime();
        daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
        isExpired = diffMs <= 0 || user.subscription_status === 'expired';
      }

      const limit = user.messages_limit || 1000;
      const used = user.messages_used || 0;
      const percentage = limit > 0 ? Math.min(100, Math.round((used / limit) * 1000) / 10) : 100;

      return {
        ...user,
        days_remaining: daysRemaining,
        is_expired: isExpired,
        consumption_percentage: percentage
      };
    });

    res.json({ success: true, data: formattedUsers });
  } catch (error: any) {
    console.error('[AdminUsers Error]:', error.message);
    res.status(500).json({ success: false, error: 'Error al listar clientes', detail: error.message });
  }
});

/**
 * POST /users - Crear un cliente manualmente por el SuperAdmin
 */
router.post('/users', async (req: AuthenticatedRequest, res) => {
  const { email, password, companyName, phone, planId, durationMonths } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Correo y contraseña requeridos' });
  }

  try {
    const cleanEmail = email.trim().toLowerCase();
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [cleanEmail]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'El correo electrónico ya está registrado.' });
    }

    const targetPlanId = planId || 'plan_basic';
    const planRes = await pool.query('SELECT * FROM plans WHERE id = $1', [targetPlanId]);
    const plan = planRes.rows[0] || { max_messages: 1000, duration_months: 1 };

    const userId = generateId('user');
    const hashedPassword = await bcrypt.hash(password, 10);
    const months = parseInt(durationMonths || plan.duration_months || '1', 10);

    const now = new Date();
    const endDate = new Date();
    endDate.setMonth(now.getMonth() + months);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(`
        INSERT INTO users (id, email, password, role, status, company_name, phone, trial_used)
        VALUES ($1, $2, $3, 'client', 'active', $4, $5, false)
      `, [userId, cleanEmail, hashedPassword, companyName || null, phone || null]);

      const subId = generateId('sub');
      await client.query(`
        INSERT INTO subscriptions (id, user_id, plan_id, status, messages_limit, messages_used, payment_status, start_date, end_date)
        VALUES ($1, $2, $3, 'active', $4, 0, 'paid', $5, $6)
      `, [subId, userId, targetPlanId, plan.max_messages || 1000, now, endDate]);

      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }

    // Registrar bitácora de auditoría
    await AuditService.logAction({
      adminId: req.userId || 'admin',
      adminEmail: (req as any).userEmail || 'zaza.click.app@gmail.com',
      action: 'USER_CREATED',
      entity: 'user',
      entityId: userId,
      details: { email: cleanEmail, planId: targetPlanId, months, endDate }
    });

    res.status(201).json({
      success: true,
      message: 'Cliente creado exitosamente con suscripción activa.',
      data: { id: userId, email: cleanEmail }
    });
  } catch (error: any) {
    console.error('[AdminCreateUser Error]:', error.message);
    res.status(500).json({ success: false, error: 'Error al crear cliente', detail: error.message });
  }
});

/**
 * PUT /users/:id/status - Cambiar estado de usuario (active, suspended, blocked)
 */
router.put('/users/:id/status', async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ['active', 'suspended', 'blocked'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, error: `Estado inválido. Opciones: ${validStatuses.join(', ')}` });
  }

  try {
    const userRes = await pool.query('SELECT id, email, status FROM users WHERE id = $1', [id]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }

    const prevStatus = userRes.rows[0].status;
    await pool.query('UPDATE users SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [status, id]);

    await AuditService.logAction({
      adminId: req.userId || 'admin',
      adminEmail: (req as any).userEmail || 'zaza.click.app@gmail.com',
      action: 'USER_STATUS_UPDATED',
      entity: 'user',
      entityId: id,
      details: { email: userRes.rows[0].email, previousStatus: prevStatus, newStatus: status }
    });

    res.json({ success: true, message: `Estado de usuario actualizado a "${status.toUpperCase()}".` });
  } catch (error: any) {
    console.error('[AdminUserStatus Error]:', error.message);
    res.status(500).json({ success: false, error: 'Error al actualizar estado del usuario' });
  }
});

/**
 * PUT /users/:id/subscription - Modificar suscripción, cambiar plan, extender días y gestionar downgrade
 */
router.put('/users/:id/subscription', async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { planId, status, durationDays, durationMonths, customEndDate, resetQuota } = req.body;

  try {
    const userRes = await pool.query('SELECT id, email FROM users WHERE id = $1', [id]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }

    // Obtener la suscripción actual más reciente
    const currentSubRes = await pool.query(`
      SELECT * FROM subscriptions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1
    `, [id]);

    const currentSub = currentSubRes.rows[0];
    const targetPlanId = planId || currentSub?.plan_id || 'plan_basic';
    const planRes = await pool.query('SELECT * FROM plans WHERE id = $1', [targetPlanId]);
    const plan = planRes.rows[0];

    // Cálculo de la nueva fecha (Rolling Renewal o Mantener Fecha)
    let newEndDate = new Date();
    const now = new Date();

    if (customEndDate) {
      newEndDate = new Date(customEndDate);
    } else if (durationDays === 'reset_30') {
      newEndDate = new Date(now);
      newEndDate.setDate(now.getDate() + 30);
    } else if (durationDays !== undefined && String(durationDays) === '0') {
      // Mantener fecha actual exacta del cliente sin extender
      newEndDate = (currentSub?.end_date && new Date(currentSub.end_date) > now) 
        ? new Date(currentSub.end_date) 
        : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    } else if (durationDays && parseInt(durationDays, 10) > 0) {
      const baseDate = (currentSub && new Date(currentSub.end_date) > now) ? new Date(currentSub.end_date) : now;
      newEndDate = new Date(baseDate);
      newEndDate.setDate(baseDate.getDate() + parseInt(durationDays, 10));
    } else if (durationMonths && parseInt(durationMonths, 10) > 0) {
      const baseDate = (currentSub && new Date(currentSub.end_date) > now) ? new Date(currentSub.end_date) : now;
      newEndDate = new Date(baseDate);
      newEndDate.setMonth(baseDate.getMonth() + parseInt(durationMonths, 10));
    } else {
      // Si no se especifica extensión, conservar la fecha previa
      newEndDate = (currentSub?.end_date && new Date(currentSub.end_date) > now) 
        ? new Date(currentSub.end_date) 
        : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    }

    const newStatus = status || 'active';
    const newLimit = plan?.max_messages || currentSub?.messages_limit || 1000;
    const newUsed = resetQuota ? 0 : (currentSub?.messages_used || 0);
    const subId = generateId('sub');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Desactivar suscripciones previas
      await client.query('UPDATE subscriptions SET status = \'cancelled\' WHERE user_id = $1 AND status IN (\'active\', \'trial\')', [id]);

      // Insertar nueva suscripción
      await client.query(`
        INSERT INTO subscriptions (id, user_id, plan_id, status, messages_limit, messages_used, payment_status, start_date, end_date)
        VALUES ($1, $2, $3, $4, $5, $6, 'paid', $7, $8)
      `, [subId, id, targetPlanId, newStatus, newLimit, newUsed, now, newEndDate]);

      // Reactivar usuario si estaba suspendido
      await client.query('UPDATE users SET status = \'active\' WHERE id = $1 AND status = \'suspended\'', [id]);

      // Manejo de Downgrade / Upgrade en Instancias:
      const maxInstAllowed = plan?.max_instances || 1;
      const userInstancesRes = await client.query('SELECT id FROM instances WHERE user_id = $1 ORDER BY created_at ASC', [id]);
      const instances = userInstancesRes.rows;

      for (let i = 0; i < instances.length; i++) {
        const isEnabled = i < maxInstAllowed;
        await client.query('UPDATE instances SET is_enabled = $1 WHERE id = $2', [isEnabled, instances[i].id]);
      }

      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }

    await AuditService.logAction({
      adminId: req.userId || 'admin',
      adminEmail: (req as any).userEmail || 'zaza.click.app@gmail.com',
      action: 'SUBSCRIPTION_UPDATED',
      entity: 'subscription',
      entityId: subId,
      details: { userId: id, planId: targetPlanId, status: newStatus, endDate: newEndDate, resetQuota }
    });

    res.json({
      success: true,
      message: 'Suscripción actualizada exitosamente.',
      data: { subscriptionId: subId, endDate: newEndDate, plan: plan?.name }
    });

  } catch (error: any) {
    console.error('[AdminSubUpdate Error]:', error.message);
    res.status(500).json({ success: false, error: 'Error al actualizar suscripción', detail: error.message });
  }
});

/**
 * POST /users/:id/reset-quota - Resetear a 0 el consumo de mensajes del cliente
 */
router.post('/users/:id/reset-quota', async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;

  try {
    const subRes = await pool.query(`
      UPDATE subscriptions
      SET messages_used = 0
      WHERE user_id = $1 AND status IN ('active', 'trial')
      RETURNING id, messages_limit;
    `, [id]);

    await AuditService.logAction({
      adminId: req.userId || 'admin',
      adminEmail: (req as any).userEmail || 'zaza.click.app@gmail.com',
      action: 'QUOTA_RESET',
      entity: 'subscription',
      entityId: subRes.rows[0]?.id || id,
      details: { userId: id, messagesUsedNow: 0 }
    });

    res.json({ success: true, message: 'Cuota de mensajes reseteada a 0 exitosamente.' });
  } catch (error: any) {
    console.error('[AdminResetQuota Error]:', error.message);
    res.status(500).json({ success: false, error: 'Error al resetear cuota' });
  }
});

/**
 * POST /users/:id/reset-password - Cambiar contraseña de un cliente
 */
router.post('/users/:id/reset-password', async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;

  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ success: false, error: 'La nueva contraseña debe tener al menos 6 caracteres' });
  }

  try {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [hashedPassword, id]);

    await AuditService.logAction({
      adminId: req.userId || 'admin',
      adminEmail: (req as any).userEmail || 'zaza.click.app@gmail.com',
      action: 'PASSWORD_RESET',
      entity: 'user',
      entityId: id
    });

    res.json({ success: true, message: 'Contraseña actualizada exitosamente.' });
  } catch (error: any) {
    console.error('[AdminResetPassword Error]:', error.message);
    res.status(500).json({ success: false, error: 'Error al actualizar contraseña' });
  }
});

/**
 * DELETE /users/:id - Eliminar cliente y sus datos en cascada
 */
router.delete('/users/:id', async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;

  try {
    // 1. Obtener nombres de instancias para eliminarlas en Evolution API
    const instRes = await pool.query('SELECT instance_name FROM instances WHERE user_id = $1', [id]);
    for (const row of instRes.rows) {
      try {
        await EvolutionService.deleteInstance(row.instance_name);
      } catch (err: any) {
        console.warn(`No se pudo eliminar instancia ${row.instance_name} en Evolution:`, err.message);
      }
    }

    // 2. Eliminar usuario de PostgreSQL (las FK en cascada eliminan instancias, suscripciones y pagos)
    await pool.query('DELETE FROM users WHERE id = $1', [id]);

    await AuditService.logAction({
      adminId: req.userId || 'admin',
      adminEmail: (req as any).userEmail || 'zaza.click.app@gmail.com',
      action: 'USER_DELETED',
      entity: 'user',
      entityId: id
    });

    res.json({ success: true, message: 'Cliente e instancias eliminados permanentemente.' });
  } catch (error: any) {
    console.error('[AdminDeleteUser Error]:', error.message);
    res.status(500).json({ success: false, error: 'Error al eliminar cliente' });
  }
});

/**
 * GET /engines/health - Estado de salud, latencia y capacidades de todos los motores WhatsApp
 */
router.get('/engines/health', async (req: AuthenticatedRequest, res) => {
  try {
    const { engineRegistry } = await import('../engines/core/EngineRegistry');
    const healths = await engineRegistry.healthCheckAll();
    res.json({ success: true, data: healths });
  } catch (error: any) {
    console.error('[AdminEnginesHealth Error]:', error.message);
    res.status(500).json({ success: false, error: 'Error al consultar estado de los motores de WhatsApp' });
  }
});

/**
 * GET /instances - Listar todas las instancias del sistema con estado administrativo y motor asignado
 */
function maskApiKey(key: string | null | undefined): string {
  if (!key) return '';
  if (key.length <= 8) return '********';
  const last4 = key.slice(-4);
  return `zc_live_********${last4}`;
}

router.get('/instances', async (req: AuthenticatedRequest, res) => {
  try {
    const query = `
      SELECT 
        i.id, 
        i.instance_name, 
        i.phone, 
        i.status as connection_status, 
        i.is_enabled,
        i.engine_type,
        i.messages_sent,
        i.last_activity_at,
        i.api_key, 
        i.webhook_url,
        i.webhook_enabled,
        i.created_at,
        u.id as user_id,
        u.email as owner_email,
        u.company_name,
        p.name as plan_name,
        s.status as subscription_status,
        s.end_date as subscription_end_date
      FROM instances i
      LEFT JOIN users u ON i.user_id = u.id
      LEFT JOIN subscriptions s ON u.id = s.user_id AND s.id = (
        SELECT id FROM subscriptions WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1
      )
      LEFT JOIN plans p ON s.plan_id = p.id
      ORDER BY i.created_at DESC;
    `;
    const result = await pool.query(query);
    const maskedRows = result.rows.map(row => ({
      ...row,
      api_key: maskApiKey(row.api_key)
    }));
    res.json({ success: true, data: maskedRows });
  } catch (error: any) {
    console.error('[AdminInstances Error]:', error.message);
    res.status(500).json({ success: false, error: 'Error al listar instancias', detail: error.message });
  }
});

/**
 * PUT /instances/:id/toggle - Habilitar o deshabilitar una instancia administrativamente
 */
router.put('/instances/:id/toggle', async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { isEnabled } = req.body;

  try {
    await pool.query('UPDATE instances SET is_enabled = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [Boolean(isEnabled), id]);

    await AuditService.logAction({
      adminId: req.userId || 'admin',
      adminEmail: (req as any).userEmail || 'zaza.click.app@gmail.com',
      action: isEnabled ? 'INSTANCE_ENABLED' : 'INSTANCE_DISABLED',
      entity: 'instance',
      entityId: id
    });

    res.json({ success: true, message: `Instancia ${isEnabled ? 'habilitada' : 'deshabilitada'} correctamente.` });
  } catch (error: any) {
    console.error('[AdminToggleInstance Error]:', error.message);
    res.status(500).json({ success: false, error: 'Error al modificar estado de la instancia' });
  }
});

/**
 * CRUD DE PLANES: GET, POST, PUT, DELETE /plans
 */
router.get('/plans', async (req: AuthenticatedRequest, res) => {
  try {
    const result = await pool.query('SELECT * FROM plans ORDER BY price ASC');
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error('[AdminPlans Error]:', error.message);
    res.status(500).json({ success: false, error: 'Error al consultar planes', detail: error.message });
  }
});

router.post('/plans', async (req: AuthenticatedRequest, res) => {
  const { id, name, maxInstances, price, durationMonths, maxMessages, isTrial, trialDays, trialMessages, description } = req.body;

  if (!id || !name) {
    return res.status(400).json({ success: false, error: 'ID y Nombre del plan son requeridos' });
  }

  try {
    await pool.query(`
      INSERT INTO plans (id, name, max_instances, price, duration_months, max_messages, is_active, is_trial, trial_days, trial_messages, description)
      VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8, $9, $10)
    `, [
      id.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'),
      name,
      maxInstances || 1,
      price || 0.00,
      durationMonths || 1,
      maxMessages || 1000,
      Boolean(isTrial),
      trialDays || 7,
      trialMessages || 100,
      description || ''
    ]);

    res.status(201).json({ success: true, message: 'Plan creado exitosamente.' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/plans/:id', async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { name, maxInstances, price, durationMonths, maxMessages, isActive, isTrial, trialDays, trialMessages, description } = req.body;

  try {
    await pool.query(`
      UPDATE plans 
      SET 
        name = COALESCE($1, name),
        max_instances = COALESCE($2, max_instances),
        price = COALESCE($3, price),
        duration_months = COALESCE($4, duration_months),
        max_messages = COALESCE($5, max_messages),
        is_active = COALESCE($6, is_active),
        is_trial = COALESCE($7, is_trial),
        trial_days = COALESCE($8, trial_days),
        trial_messages = COALESCE($9, trial_messages),
        description = COALESCE($10, description)
      WHERE id = $11
    `, [name, maxInstances, price, durationMonths, maxMessages, isActive, isTrial, trialDays, trialMessages, description, id]);

    res.json({ success: true, message: 'Plan actualizado exitosamente.' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GESTIÓN DE PAGOS: GET, POST /payments
 */
router.get('/payments', async (req: AuthenticatedRequest, res) => {
  try {
    const query = `
      SELECT 
        p.*,
        u.email as user_email,
        u.company_name,
        pl.name as plan_name
      FROM payments p
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN subscriptions s ON p.subscription_id = s.id
      LEFT JOIN plans pl ON s.plan_id = pl.id
      ORDER BY p.created_at DESC;
    `;
    const result = await pool.query(query);
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error('[AdminPayments Error]:', error.message);
    res.status(500).json({ success: false, error: 'Error al consultar pagos', detail: error.message });
  }
});

router.post('/payments', async (req: AuthenticatedRequest, res) => {
  const { userId, amount, currency, paymentMethod, reference, notes, renewMonths, planId } = req.body;

  if (!userId || !amount) {
    return res.status(400).json({ success: false, error: 'userId y amount son requeridos' });
  }

  try {
    // 1. Obtener la suscripción actual o plan
    const subRes = await pool.query('SELECT * FROM subscriptions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [userId]);
    const currentSub = subRes.rows[0];
    const targetPlanId = planId || currentSub?.plan_id || 'plan_basic';
    const planRes = await pool.query('SELECT * FROM plans WHERE id = $1', [targetPlanId]);
    const plan = planRes.rows[0];

    const months = parseInt(renewMonths || plan?.duration_months || '1', 10);
    const now = new Date();
    const baseDate = (currentSub && new Date(currentSub.end_date) > now) ? new Date(currentSub.end_date) : now;
    const newEndDate = new Date(baseDate);
    newEndDate.setMonth(baseDate.getMonth() + months);

    const client = await pool.connect();
    const paymentId = generateId('pay');

    try {
      await client.query('BEGIN');

      // Desactivar previa
      await client.query('UPDATE subscriptions SET status = \'cancelled\' WHERE user_id = $1 AND status IN (\'active\', \'trial\')', [userId]);

      // Nueva suscripción activa
      const subId = generateId('sub');
      await client.query(`
        INSERT INTO subscriptions (id, user_id, plan_id, status, messages_limit, messages_used, payment_status, start_date, end_date)
        VALUES ($1, $2, $3, 'active', $4, 0, 'paid', $5, $6)
      `, [subId, userId, targetPlanId, plan?.max_messages || 1000, now, newEndDate]);

      // Registrar el pago
      await client.query(`
        INSERT INTO payments (id, user_id, subscription_id, amount, currency, payment_method, reference, status, notes, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'paid', $8, $9)
      `, [
        paymentId,
        userId,
        subId,
        amount,
        currency || 'USD',
        paymentMethod || 'manual',
        reference || null,
        notes || `Pago registrado manualmente por administración (${months} meses)`,
        req.userId || 'admin'
      ]);

      // Reactivar usuario si estaba suspendido
      await client.query('UPDATE users SET status = \'active\' WHERE id = $1', [userId]);

      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }

    await AuditService.logAction({
      adminId: req.userId || 'admin',
      adminEmail: (req as any).userEmail || 'zaza.click.app@gmail.com',
      action: 'PAYMENT_RECORDED',
      entity: 'payment',
      entityId: paymentId,
      details: { userId, amount, currency: currency || 'USD', newEndDate, months }
    });

    res.status(201).json({
      success: true,
      message: 'Pago registrado exitosamente y servicio renovado.',
      data: { paymentId, newEndDate }
    });

  } catch (error: any) {
    console.error('[AdminPayment Error]:', error.message);
    res.status(500).json({ success: false, error: 'Error al registrar pago', detail: error.message });
  }
});

/**
 * GET /audit-logs - Consultar bitácora administrativa
 */
router.get('/audit-logs', async (req: AuthenticatedRequest, res) => {
  try {
    const result = await pool.query('SELECT * FROM admin_audit_logs ORDER BY created_at DESC LIMIT 100');
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error('[AdminAuditLogs Error]:', error.message);
    res.status(500).json({ success: false, error: 'Error al consultar logs de auditoría', detail: error.message });
  }
});

/**
 * GET /usage-logs - Consultar métricas recientes de tráfico
 */
router.get('/usage-logs', async (req: AuthenticatedRequest, res) => {
  try {
    const query = `
      SELECT l.*, u.email as user_email 
      FROM usage_logs l
      LEFT JOIN users u ON l.user_id = u.id
      ORDER BY l.created_at DESC 
      LIMIT 100;
    `;
    const result = await pool.query(query);
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error('[AdminUsageLogs Error]:', error.message);
    res.status(500).json({ success: false, error: 'Error al consultar métricas de uso', detail: error.message });
  }
});

/**
 * Licenciamiento Evolution API
 */
router.get('/license/status', async (req: AuthenticatedRequest, res) => {
  try {
    const result = await EvolutionService.getLicenseStatus();
    if (result.success) {
      return res.json({ success: true, data: result.data });
    }
    res.status(500).json({ success: false, error: result.error || 'Error al obtener estado de licencia' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Error interno al consultar licencia' });
  }
});

router.post('/license/register', async (req: AuthenticatedRequest, res) => {
  const { redirectUri } = req.body;
  if (!redirectUri) {
    return res.status(400).json({ success: false, error: 'redirectUri es requerido' });
  }
  try {
    const result = await EvolutionService.registerLicense(redirectUri);
    if (result.success) {
      return res.json({ success: true, registerUrl: result.registerUrl });
    }
    res.status(500).json({ success: false, error: result.error || 'Error al registrar licencia' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Error interno al registrar licencia' });
  }
});

router.post('/license/activate', async (req: AuthenticatedRequest, res) => {
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ success: false, error: 'code es requerido' });
  }
  try {
    const result = await EvolutionService.activateLicense(code);
    if (result.success) {
      return res.json({ success: true, data: result.data });
    }
    res.status(500).json({ success: false, error: result.error || 'Error al activar la licencia' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Error interno al activar licencia' });
  }
});

/**
 * Partner B2B Ecosystem Endpoints
 */

/**
 * GET /partners - Listar todos los Partners B2B con métricas consolidadas
 */
router.get('/partners', async (req: AuthenticatedRequest, res) => {
  try {
    const partners = await PartnerService.listPartners();
    res.json({ success: true, data: partners });
  } catch (error: any) {
    console.error('[AdminPartners Error]:', error.message);
    res.status(500).json({ success: false, error: 'Error al listar partners B2B', detail: error.message });
  }
});

/**
 * POST /partners - Registrar nuevo Partner B2B
 */
router.post('/partners', async (req: AuthenticatedRequest, res) => {
  try {
    const { name, slug, category, contactEmail, webhookUrl } = req.body;
    if (!name || !slug || !contactEmail) {
      return res.status(400).json({ success: false, error: 'Nombre, slug y correo de contacto son requeridos.' });
    }

    const result = await PartnerService.createPartner({
      name,
      slug,
      category,
      contactEmail,
      webhookUrl
    });

    await AuditService.logAction({
      adminId: req.userId || 'admin',
      adminEmail: (req as any).userEmail || 'zaza.click.app@gmail.com',
      action: 'CREATE_PARTNER',
      entity: 'partner',
      entityId: result.partner.id,
      details: { name, slug, category, contactEmail }
    });

    res.json({ success: true, data: result.partner, secretKey: result.secretKey });
  } catch (error: any) {
    console.error('[AdminCreatePartner Error]:', error.message);
    res.status(400).json({ success: false, error: error.message || 'Error al crear partner B2B' });
  }
});

/**
 * PUT /partners/:id/status - Suspender o reactivar Partner B2B
 */
router.put('/partners/:id/status', async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ success: false, error: 'isActive (booleano) es requerido.' });
    }

    const updated = await PartnerService.toggleStatus(id, isActive);

    await AuditService.logAction({
      adminId: req.userId || 'admin',
      adminEmail: (req as any).userEmail || 'zaza.click.app@gmail.com',
      action: isActive ? 'ACTIVATE_PARTNER' : 'DEACTIVATE_PARTNER',
      entity: 'partner',
      entityId: id,
      details: { isActive }
    });

    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message || 'Error al actualizar estado del partner' });
  }
});

/**
 * POST /partners/:id/rotate-key - Rotar Master Key de Partner B2B
 */
router.post('/partners/:id/rotate-key', async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const result = await PartnerService.rotateKey(id);

    await AuditService.logAction({
      adminId: req.userId || 'admin',
      adminEmail: (req as any).userEmail || 'zaza.click.app@gmail.com',
      action: 'ROTATE_PARTNER_KEY',
      entity: 'partner',
      entityId: id,
      details: { maskedKey: result.maskedKey }
    });

    res.json({ success: true, newSecretKey: result.newSecretKey, maskedKey: result.maskedKey });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message || 'Error al rotar clave del partner' });
  }
});

export default router;
