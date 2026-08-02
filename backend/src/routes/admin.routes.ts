import { Router, Response } from 'express';
import pool from '../config/database';
import { authMiddleware, adminMiddleware, AuthenticatedRequest } from '../middleware/auth.middleware';
import { EvolutionService } from '../services/evolution.service';

const router = Router();

// Apply auth and admin middleware to all routes in this router
router.use(authMiddleware);
router.use(adminMiddleware);

/**
 * GET /stats - Obtener estadísticas globales del sistema
 */
router.get('/stats', async (req: AuthenticatedRequest, res) => {
  try {
    const usersCount = await pool.query('SELECT COUNT(*) FROM users WHERE role = \'client\'');
    const instancesCount = await pool.query('SELECT COUNT(*) FROM instances');
    const connectedInstances = await pool.query('SELECT COUNT(*) FROM instances WHERE status = \'connected\'');
    
    const activeSubscriptions = await pool.query(
      'SELECT COUNT(*) FROM subscriptions WHERE status = \'active\' AND end_date > CURRENT_TIMESTAMP'
    );

    res.json({
      success: true,
      stats: {
        total_users: parseInt(usersCount.rows[0].count),
        total_instances: parseInt(instancesCount.rows[0].count),
        connected_instances: parseInt(connectedInstances.rows[0].count),
        active_subscriptions: parseInt(activeSubscriptions.rows[0].count),
      }
    });
  } catch (error: any) {
    console.error('[AdminStats] Error:', error.message);
    res.status(500).json({ success: false, error: 'Error al cargar estadísticas' });
  }
});

/**
 * GET /users - Listar todos los usuarios y sus suscripciones
 */
router.get('/users', async (req: AuthenticatedRequest, res) => {
  try {
    const query = `
      SELECT 
        u.id, 
        u.email, 
        u.role, 
        u.created_at,
        s.id as subscription_id,
        s.plan_id,
        p.name as plan_name,
        s.status as subscription_status,
        s.end_date as subscription_end_date,
        (SELECT COUNT(*) FROM instances WHERE user_id = u.id) as instances_count
      FROM users u
      LEFT JOIN subscriptions s ON u.id = s.user_id AND s.status = 'active'
      LEFT JOIN plans p ON s.plan_id = p.id
      WHERE u.role = 'client'
      ORDER BY u.created_at DESC
    `;
    const result = await pool.query(query);
    res.json({ success: true, users: result.rows });
  } catch (error: any) {
    console.error('[AdminUsers] Error:', error.message);
    res.status(500).json({ success: false, error: 'Error al listar usuarios' });
  }
});

/**
 * GET /instances - Listar todas las instancias del sistema con info de usuario
 */
router.get('/instances', async (req: AuthenticatedRequest, res) => {
  try {
    const query = `
      SELECT 
        i.id, 
        i.instance_name, 
        i.phone, 
        i.status, 
        i.api_key, 
        i.created_at,
        u.email as owner_email
      FROM instances i
      JOIN users u ON i.user_id = u.id
      ORDER BY i.created_at DESC
    `;
    const result = await pool.query(query);
    res.json({ success: true, instances: result.rows });
  } catch (error: any) {
    console.error('[AdminInstances] Error:', error.message);
    res.status(500).json({ success: false, error: 'Error al listar instancias' });
  }
});

/**
 * PUT /users/:id/subscription - Modificar suscripción de un cliente
 */
router.put('/users/:id/subscription', async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { planId, status, durationMonths } = req.body;

  if (!planId || !status) {
    return res.status(400).json({ success: false, error: 'planId y status son requeridos' });
  }

  try {
    // Verificar si el usuario existe
    const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }

    // Iniciar transacción
    await pool.query('BEGIN');

    // Desactivar cualquier suscripción activa previa
    await pool.query(
      'UPDATE subscriptions SET status = \'expired\' WHERE user_id = $1 AND status = \'active\'',
      [id]
    );

    // Crear nueva suscripción
    const subId = `sub_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const now = new Date();
    const endDate = new Date();
    const months = parseInt(durationMonths || '1', 10);
    endDate.setMonth(now.getMonth() + months);

    await pool.query(`
      INSERT INTO subscriptions (id, user_id, plan_id, status, start_date, end_date)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [subId, id, planId, status, now, endDate]);

    await pool.query('COMMIT');

    res.json({
      success: true,
      message: 'Suscripción actualizada exitosamente'
    });
  } catch (error: any) {
    await pool.query('ROLLBACK');
    console.error('[AdminSubUpdate] Error:', error.message);
    res.status(500).json({ success: false, error: 'Error al actualizar suscripción' });
  }
});

/**
 * GET /license/status - Obtener el estado de la licencia de Evolution API
 */
router.get('/license/status', async (req: AuthenticatedRequest, res) => {
  try {
    const result = await EvolutionService.getLicenseStatus();
    if (result.success) {
      return res.json({ success: true, data: result.data });
    }
    res.status(500).json({ success: false, error: result.error || 'Error al obtener estado de licencia' });
  } catch (error: any) {
    console.error('[AdminLicenseStatus] Error:', error.message);
    res.status(500).json({ success: false, error: 'Error interno al consultar licencia' });
  }
});

/**
 * POST /license/register - Generar link de activación de licencia
 */
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
    console.error('[AdminLicenseRegister] Error:', error.message);
    res.status(500).json({ success: false, error: 'Error interno al registrar licencia' });
  }
});

/**
 * POST /license/activate - Activar la licencia con el código recibido
 */
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
    console.error('[AdminLicenseActivate] Error:', error.message);
    res.status(500).json({ success: false, error: 'Error interno al activar licencia' });
  }
});

export default router;
