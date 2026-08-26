import { Router } from 'express';
import pool from '../config/database';
import * as bcrypt from 'bcryptjs';
import { authMiddleware, adminMiddleware, AuthenticatedRequest } from '../middleware/auth.middleware';
import { EvolutionService } from '../services/evolution.service';
import { AuditService } from '../services/audit.service';

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
    const [
      usersStats,
      instStats,
      subStats,
      trafficStats,
      paymentStats
    ] = await Promise.all([
      // 1. Métricas de Usuarios
      pool.query(`
        SELECT 
          COUNT(*) as total_users,
          COUNT(*) FILTER (WHERE status = 'active') as active_users,
          COUNT(*) FILTER (WHERE status = 'suspended') as suspended_users,
          COUNT(*) FILTER (WHERE status = 'blocked') as blocked_users
        FROM users WHERE role = 'client'
      `),
      // 2. Métricas de Instancias
      pool.query(`
        SELECT 
          COUNT(*) as total_instances,
          COUNT(*) FILTER (WHERE status = 'connected') as connected_instances,
          COUNT(*) FILTER (WHERE is_enabled = false) as disabled_instances
        FROM instances
      `),
      // 3. Métricas de Suscripciones y Vencimientos
      pool.query(`
        SELECT 
          COUNT(*) FILTER (WHERE status = 'active' AND end_date >= CURRENT_TIMESTAMP) as active_subscriptions,
          COUNT(*) FILTER (WHERE status = 'trial' AND end_date >= CURRENT_TIMESTAMP) as trial_subscriptions,
          COUNT(*) FILTER (WHERE end_date < CURRENT_TIMESTAMP OR status = 'expired') as expired_subscriptions,
          COUNT(*) FILTER (WHERE end_date >= CURRENT_TIMESTAMP AND end_date <= CURRENT_TIMESTAMP + INTERVAL '3 days') as expiring_soon,
          COUNT(*) FILTER (WHERE messages_used >= messages_limit AND status IN ('active', 'trial')) as quota_exhausted
        FROM subscriptions
      `),
      // 4. Métricas de Tráfico Total
      pool.query(`
        SELECT 
          COUNT(*) as total_messages,
          COUNT(*) FILTER (WHERE status = 'SUCCESS') as successful_messages,
          COUNT(*) FILTER (WHERE status = 'FAILED') as failed_messages
        FROM usage_logs
      `),
      // 5. Métricas Financieras
      pool.query(`
        SELECT 
          COALESCE(SUM(amount) FILTER (WHERE status = 'paid'), 0) as total_revenue,
          COUNT(*) FILTER (WHERE status = 'pending') as pending_payments
        FROM payments
      `)
    ]);

    res.json({
      success: true,
      data: {
        users: usersStats.rows[0],
        instances: instStats.rows[0],
        subscriptions: subStats.rows[0],
        traffic: trafficStats.rows[0],
        financial: paymentStats.rows[0]
      }
    });
  } catch (error: any) {
    console.error('[AdminStats Error]:', error.message);
    res.status(500).json({ success: false, error: 'Error al cargar estadísticas globales' });
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
        u.status as user_status,
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
    res.status(500).json({ success: false, error: 'Error al listar clientes' });
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

    await pool.query('BEGIN');

    await pool.query(`
      INSERT INTO users (id, email, password, role, status, company_name, phone, trial_used)
      VALUES ($1, $2, $3, 'client', 'active', $4, $5, false)
    `, [userId, cleanEmail, hashedPassword, companyName || null, phone || null]);

    const subId = generateId('sub');
    await pool.query(`
      INSERT INTO subscriptions (id, user_id, plan_id, status, messages_limit, messages_used, payment_status, start_date, end_date)
      VALUES ($1, $2, $3, 'active', $4, 0, 'paid', $5, $6)
    `, [subId, userId, targetPlanId, plan.max_messages || 1000, now, endDate]);

    await pool.query('COMMIT');

    // Registrar bitácora de auditoría
    await AuditService.logAction({
      adminId: req.userId || 'admin',
      adminEmail: 'syscomecosistemadigital@gmail.com',
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
    await pool.query('ROLLBACK');
    console.error('[AdminCreateUser Error]:', error.message);
    res.status(500).json({ success: false, error: 'Error al crear cliente' });
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
      adminEmail: 'syscomecosistemadigital@gmail.com',
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

    // Cálculo de la nueva fecha (Rolling Renewal)
    let newEndDate = new Date();
    const now = new Date();

    if (customEndDate) {
      newEndDate = new Date(customEndDate);
    } else if (durationDays) {
      const baseDate = (currentSub && new Date(currentSub.end_date) > now) ? new Date(currentSub.end_date) : now;
      newEndDate = new Date(baseDate);
      newEndDate.setDate(baseDate.getDate() + parseInt(durationDays, 10));
    } else if (durationMonths) {
      const baseDate = (currentSub && new Date(currentSub.end_date) > now) ? new Date(currentSub.end_date) : now;
      newEndDate = new Date(baseDate);
      newEndDate.setMonth(baseDate.getMonth() + parseInt(durationMonths, 10));
    } else {
      newEndDate.setMonth(now.getMonth() + 1);
    }

    const newStatus = status || 'active';
    const newLimit = plan?.max_messages || currentSub?.messages_limit || 1000;
    const newUsed = resetQuota ? 0 : (currentSub?.messages_used || 0);

    await pool.query('BEGIN');

    // Desactivar suscripciones previas
    await pool.query('UPDATE subscriptions SET status = \'cancelled\' WHERE user_id = $1 AND status IN (\'active\', \'trial\')', [id]);

    // Insertar nueva suscripción
    const subId = generateId('sub');
    await pool.query(`
      INSERT INTO subscriptions (id, user_id, plan_id, status, messages_limit, messages_used, payment_status, start_date, end_date)
      VALUES ($1, $2, $3, $4, $5, $6, 'paid', $7, $8)
    `, [subId, id, targetPlanId, newStatus, newLimit, newUsed, now, newEndDate]);

    // Reactivar usuario si estaba suspendido
    await pool.query('UPDATE users SET status = \'active\' WHERE id = $1 AND status = \'suspended\'', [id]);

    // Manejo de Downgrade / Upgrade en Instancias:
    const maxInstAllowed = plan?.max_instances || 1;
    const userInstancesRes = await pool.query('SELECT id FROM instances WHERE user_id = $1 ORDER BY created_at ASC', [id]);
    const instances = userInstancesRes.rows;

    for (let i = 0; i < instances.length; i++) {
      const isEnabled = i < maxInstAllowed;
      await pool.query('UPDATE instances SET is_enabled = $1 WHERE id = $2', [isEnabled, instances[i].id]);
    }

    await pool.query('COMMIT');

    await AuditService.logAction({
      adminId: req.userId || 'admin',
      adminEmail: 'syscomecosistemadigital@gmail.com',
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
    await pool.query('ROLLBACK');
    console.error('[AdminSubUpdate Error]:', error.message);
    res.status(500).json({ success: false, error: 'Error al actualizar suscripción' });
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
      adminEmail: 'syscomecosistemadigital@gmail.com',
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
      adminEmail: 'syscomecosistemadigital@gmail.com',
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
      adminEmail: 'syscomecosistemadigital@gmail.com',
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
 * GET /instances - Listar todas las instancias del sistema con estado administrativo
 */
router.get('/instances', async (req: AuthenticatedRequest, res) => {
  try {
    const query = `
      SELECT 
        i.id, 
        i.instance_name, 
        i.phone, 
        i.status as connection_status, 
        i.is_enabled,
        i.messages_sent,
        i.last_activity_at,
        i.api_key, 
        i.created_at,
        u.id as user_id,
        u.email as owner_email,
        u.company_name,
        p.name as plan_name,
        s.status as subscription_status,
        s.end_date as subscription_end_date
      FROM instances i
      JOIN users u ON i.user_id = u.id
      LEFT JOIN subscriptions s ON u.id = s.user_id AND s.id = (
        SELECT id FROM subscriptions WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1
      )
      LEFT JOIN plans p ON s.plan_id = p.id
      ORDER BY i.created_at DESC;
    `;
    const result = await pool.query(query);
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error('[AdminInstances Error]:', error.message);
    res.status(500).json({ success: false, error: 'Error al listar instancias' });
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
      adminEmail: 'syscomecosistemadigital@gmail.com',
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
    res.status(500).json({ success: false, error: 'Error al consultar planes' });
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
      JOIN users u ON p.user_id = u.id
      LEFT JOIN subscriptions s ON p.subscription_id = s.id
      LEFT JOIN plans pl ON s.plan_id = pl.id
      ORDER BY p.created_at DESC;
    `;
    const result = await pool.query(query);
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Error al consultar pagos' });
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

    await pool.query('BEGIN');

    // Desactivar previa
    await pool.query('UPDATE subscriptions SET status = \'cancelled\' WHERE user_id = $1 AND status IN (\'active\', \'trial\')', [userId]);

    // Nueva suscripción activa
    const subId = generateId('sub');
    await pool.query(`
      INSERT INTO subscriptions (id, user_id, plan_id, status, messages_limit, messages_used, payment_status, start_date, end_date)
      VALUES ($1, $2, $3, 'active', $4, 0, 'paid', $5, $6)
    `, [subId, userId, targetPlanId, plan?.max_messages || 1000, now, newEndDate]);

    // Registrar el pago
    const paymentId = generateId('pay');
    await pool.query(`
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
    await pool.query('UPDATE users SET status = \'active\' WHERE id = $1', [userId]);

    await pool.query('COMMIT');

    await AuditService.logAction({
      adminId: req.userId || 'admin',
      adminEmail: 'syscomecosistemadigital@gmail.com',
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
    await pool.query('ROLLBACK');
    console.error('[AdminPayment Error]:', error.message);
    res.status(500).json({ success: false, error: 'Error al registrar pago' });
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
    res.status(500).json({ success: false, error: 'Error al consultar logs de auditoría' });
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
      JOIN users u ON l.user_id = u.id
      ORDER BY l.created_at DESC 
      LIMIT 100;
    `;
    const result = await pool.query(query);
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Error al consultar métricas de uso' });
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

export default router;
