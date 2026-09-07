import { Router } from 'express';
import pool from '../config/database';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.middleware';
import { GoogleService } from '../services/google.service';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'whatsapp-secret-key-2024';

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

export function isSuperAdminEmail(email: string): boolean {
  const clean = email.toLowerCase().trim();
  return clean === 'zaza.click.app@gmail.com' || clean === 'syscomecosistemadigital@gmail.com';
}

/**
 * POST /register - Registro de nuevos desarrolladores / clientes con Trial controlado
 */
router.post('/register', async (req, res) => {
  const { email, password, companyName, phone } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Correo y contraseña son requeridos' });
  }

  try {
    const cleanEmail = email.toLowerCase().trim();

    // 1. Verificar si el usuario ya existe
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [cleanEmail]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, error: 'El correo electrónico ya está registrado' });
    }

    // 2. Obtener plan trial configurado
    const trialPlanRes = await pool.query('SELECT * FROM plans WHERE id = \'plan_trial\' LIMIT 1');
    const trialPlan = trialPlanRes.rows[0] || {
      id: 'plan_trial',
      name: 'Prueba Gratuita',
      trial_days: 7,
      trial_messages: 100,
      max_instances: 1
    };

    const userId = generateId('user');
    const hashedPassword = await bcrypt.hash(password, 10);
    const assignedRole = isSuperAdminEmail(cleanEmail) ? 'admin' : 'client';

    const now = new Date();
    const trialEndDate = new Date();
    trialEndDate.setDate(now.getDate() + (trialPlan.trial_days || 7));

    await pool.query('BEGIN');

    // 3. Crear usuario con estado activo y trial registrado
    await pool.query(`
      INSERT INTO users (id, email, password, role, status, trial_used, trial_started_at, trial_end_date, company_name, phone, last_login_at)
      VALUES ($1, $2, $3, $4, 'active', true, $5, $6, $7, $8, $5)
    `, [userId, cleanEmail, hashedPassword, assignedRole, now, trialEndDate, companyName || null, phone || null]);

    // 4. Crear suscripción de prueba con cuotas atómicas
    const subId = generateId('sub');
    await pool.query(`
      INSERT INTO subscriptions (id, user_id, plan_id, status, messages_limit, messages_used, payment_status, start_date, end_date)
      VALUES ($1, $2, $3, 'trial', $4, 0, 'trial', $5, $6)
    `, [subId, userId, trialPlan.id, trialPlan.trial_messages || 100, now, trialEndDate]);

    await pool.query('COMMIT');

    // 5. Generar token JWT
    const token = jwt.sign({ id: userId, role: assignedRole, tenantId: userId, email: cleanEmail }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente con período de prueba activo.',
      token,
      user: {
        id: userId,
        email: cleanEmail,
        role: assignedRole,
        status: 'active',
        trialUsed: true
      }
    });

  } catch (error: any) {
    await pool.query('ROLLBACK');
    console.error('[Auth] Error en registro:', error.message);
    res.status(500).json({ success: false, error: 'Error en el servidor al registrar usuario' });
  }
});

/**
 * POST /login - Inicio de sesión con verificación de estados
 */
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Correo y contraseña requeridos' });
  }

  try {
    const cleanEmail = email.trim().toLowerCase();
    const userRes = await pool.query('SELECT * FROM users WHERE email = $1', [cleanEmail]);

    if (userRes.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Credenciales inválidas' });
    }

    const user = userRes.rows[0];

    // Verificar si el usuario está bloqueado
    if (user.status === 'blocked') {
      return res.status(403).json({
        success: false,
        code: 'USER_BLOCKED',
        error: 'Tu cuenta ha sido bloqueada permanentemente por administración.'
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, error: 'Credenciales inválidas' });
    }

    // Actualizar última fecha de login
    await pool.query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

    const tenantId = user.parent_id || user.id;
    const token = jwt.sign({ id: user.id, role: user.role, tenantId, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      success: true,
      message: 'Inicio de sesión exitoso',
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status || 'active',
        company_name: user.company_name,
        phone: user.phone
      }
    });

  } catch (error: any) {
    console.error('[Auth] Error en login:', error.message);
    res.status(500).json({ success: false, error: 'Error en el servidor al iniciar sesión' });
  }
});

/**
 * POST /google-login - Login o auto-registro mediante Google OAuth
 */
router.post('/google-login', async (req, res) => {
  const { credential } = req.body;

  if (!credential) {
    return res.status(400).json({ success: false, error: 'Token de Google es requerido' });
  }

  try {
    const googleUser = await GoogleService.verifyToken(credential);
    if (!googleUser || !googleUser.email) {
      return res.status(401).json({ success: false, error: 'Token de Google inválido o expirado' });
    }

    const cleanEmail = googleUser.email.toLowerCase();
    let userRes = await pool.query('SELECT * FROM users WHERE email = $1', [cleanEmail]);
    let user;

    if (userRes.rows.length === 0) {
      // Registrar usuario con Trial activo
      const trialPlanRes = await pool.query('SELECT * FROM plans WHERE is_trial = true AND is_active = true LIMIT 1');
      const trialPlan = trialPlanRes.rows[0] || {
        id: 'plan_trial',
        name: 'Prueba Gratuita',
        trial_days: 7,
        trial_messages: 100,
        max_instances: 1
      };

      const userId = generateId('user');
      const assignedRole = isSuperAdminEmail(cleanEmail) ? 'admin' : 'client';
      const randomPassword = await bcrypt.hash(Math.random().toString(36), 10);
      const now = new Date();
      const trialEndDate = new Date();
      trialEndDate.setDate(now.getDate() + (trialPlan.trial_days || 7));

      await pool.query('BEGIN');

      await pool.query(`
        INSERT INTO users (id, email, password, role, status, trial_used, trial_started_at, trial_end_date, last_login_at)
        VALUES ($1, $2, $3, $4, 'active', true, $5, $6, $5)
      `, [userId, cleanEmail, randomPassword, assignedRole, now, trialEndDate]);

      const subId = generateId('sub');
      await pool.query(`
        INSERT INTO subscriptions (id, user_id, plan_id, status, messages_limit, messages_used, payment_status, start_date, end_date)
        VALUES ($1, $2, $3, 'trial', $4, 0, 'trial', $5, $6)
      `, [subId, userId, trialPlan.id, trialPlan.trial_messages || 100, now, trialEndDate]);

      await pool.query('COMMIT');

      const freshUser = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
      user = freshUser.rows[0];
    } else {
      user = userRes.rows[0];

      if (user.status === 'blocked') {
        return res.status(403).json({
          success: false,
          code: 'USER_BLOCKED',
          error: 'Tu cuenta ha sido bloqueada permanentemente por administración.'
        });
      }

      // Asegurar rol admin para cuentas superadmin
      if (isSuperAdminEmail(cleanEmail) && user.role !== 'admin') {
        await pool.query('UPDATE users SET role = \'admin\' WHERE id = $1', [user.id]);
        user.role = 'admin';
      }

      await pool.query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);
    }

    const tenantId = user.parent_id || user.id;
    const token = jwt.sign({ id: user.id, role: user.role, tenantId, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      success: true,
      message: 'Autenticación exitosa',
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status || 'active',
        company_name: user.company_name,
        phone: user.phone
      }
    });

  } catch (error: any) {
    console.error('[GoogleLogin Error]:', error.message);
    res.status(500).json({ success: false, error: 'Error al autenticar con Google' });
  }
});

/**
 * GET /me - Perfil del usuario con métricas de suscripción, cuotas y días restantes
 */
router.get('/me', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const targetUserId = req.agentId || req.userId;
    const userRes = await pool.query(`
      SELECT id, email, role, status, trial_used, company_name, phone, created_at, last_login_at 
      FROM users WHERE id = $1
    `, [targetUserId]);

    if (userRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }

    const user = userRes.rows[0];

    // Obtener la suscripción más reciente
    const subRes = await pool.query(`
      SELECT 
        s.id,
        s.status,
        s.start_date,
        s.end_date,
        s.messages_limit,
        s.messages_used,
        s.payment_status,
        p.id as plan_id,
        p.name as plan_name,
        p.max_instances
      FROM subscriptions s
      JOIN plans p ON s.plan_id = p.id
      WHERE s.user_id = $1
      ORDER BY s.created_at DESC LIMIT 1
    `, [req.userId]);

    let subscriptionData = null;
    if (subRes.rows.length > 0) {
      const sub = subRes.rows[0];
      const now = new Date();
      const endDate = new Date(sub.end_date);
      const diffMs = endDate.getTime() - now.getTime();
      const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      const isExpired = diffMs <= 0 || sub.status === 'expired';

      const limit = sub.messages_limit || 1000;
      const used = sub.messages_used || 0;
      const percentage = limit > 0 ? Math.min(100, Math.round((used / limit) * 1000) / 10) : 100;

      subscriptionData = {
        ...sub,
        days_remaining: daysRemaining,
        is_expired: isExpired,
        consumption_percentage: percentage,
        available_messages: Math.max(0, limit - used)
      };
    }

    res.json({
      success: true,
      user,
      subscription: subscriptionData
    });

  } catch (error: any) {
    console.error('[Auth] Error en GET /me:', error.message);
    res.status(500).json({ success: false, error: 'Error interno en el servidor' });
  }
});

export default router;
