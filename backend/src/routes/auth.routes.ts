import { Router, Response } from 'express';
import pool from '../config/database';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.middleware';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'whatsapp-secret-key-2024';

/**
 * Generar ID aleatorio
 */
function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

/**
 * POST /register - Registro de clientes
 */
router.post('/register', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Correo y contraseña requeridos' });
  }

  try {
    // Verificar si el usuario ya existe
    const userCheck = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userCheck.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'El correo electrónico ya está registrado' });
    }

    const userId = generateId('user');
    const hashedPassword = await bcrypt.hash(password, 10);

    // Iniciar transacción para crear usuario y asignar suscripción básica
    await pool.query('BEGIN');

    await pool.query(
      'INSERT INTO users (id, email, password, role) VALUES ($1, $2, $3, $4)',
      [userId, email, hashedPassword, 'client']
    );

    // Asignar suscripción por defecto al plan básico por 1 mes
    const subId = generateId('sub');
    const now = new Date();
    const endDate = new Date();
    endDate.setMonth(now.getMonth() + 1);

    await pool.query(`
      INSERT INTO subscriptions (id, user_id, plan_id, status, start_date, end_date)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [subId, userId, 'plan_basic', 'active', now, endDate]);

    await pool.query('COMMIT');

    // Generar token JWT
    const token = jwt.sign({ id: userId, role: 'client' }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente',
      token,
      user: { id: userId, email, role: 'client' }
    });

  } catch (error: any) {
    await pool.query('ROLLBACK');
    console.error('[Auth] Error en registro:', error.message);
    res.status(500).json({ success: false, error: 'Error en el servidor al registrar usuario' });
  }
});

/**
 * POST /login - Inicio de sesión
 */
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Correo y contraseña requeridos' });
  }

  try {
    const userRes = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userRes.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Credenciales inválidas' });
    }

    const user = userRes.rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ success: false, error: 'Credenciales inválidas' });
    }

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      success: true,
      message: 'Inicio de sesión exitoso',
      token,
      user: { id: user.id, email: user.email, role: user.role }
    });

  } catch (error: any) {
    console.error('[Auth] Error en login:', error.message);
    res.status(500).json({ success: false, error: 'Error en el servidor al iniciar sesión' });
  }
});

/**
 * GET /me - Obtener perfil del usuario autenticado
 */
router.get('/me', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const userRes = await pool.query('SELECT id, email, role, created_at FROM users WHERE id = $1', [req.userId]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }

    const user = userRes.rows[0];

    // Obtener su suscripción activa y límites del plan
    const subRes = await pool.query(`
      SELECT s.status, s.start_date, s.end_date, p.name as plan_name, p.max_instances
      FROM subscriptions s
      JOIN plans p ON s.plan_id = p.id
      WHERE s.user_id = $1 AND s.status = 'active'
      ORDER BY s.created_at DESC LIMIT 1
    `, [req.userId]);

    res.json({
      success: true,
      user,
      subscription: subRes.rows[0] || null
    });

  } catch (error: any) {
    console.error('[Auth] Error en GET /me:', error.message);
    res.status(500).json({ success: false, error: 'Error en el servidor' });
  }
});

export default router;
