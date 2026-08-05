import { Router, Response } from 'express';
import pool from '../config/database';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.middleware';
import { GoogleService } from '../services/google.service';
import { GoogleContactsService } from '../services/google-contacts.service';

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
    const assignedRole = email.toLowerCase() === 'syscomecosistemadigital@gmail.com' ? 'admin' : 'client';

    // Iniciar transacción para crear usuario y asignar suscripción básica
    await pool.query('BEGIN');

    await pool.query(
      'INSERT INTO users (id, email, password, role) VALUES ($1, $2, $3, $4)',
      [userId, email, hashedPassword, assignedRole]
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
    const token = jwt.sign({ id: userId, role: assignedRole, tenantId: userId }, JWT_SECRET, { expiresIn: '7d' });

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

    const tenantId = user.parent_id || user.id;
    const token = jwt.sign({ id: user.id, role: user.role, tenantId }, JWT_SECRET, { expiresIn: '7d' });

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
    const targetUserId = req.agentId || req.userId;
    const userRes = await pool.query('SELECT id, email, role, created_at FROM users WHERE id = $1', [targetUserId]);
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

/**
 * POST /google-login - Iniciar sesión o registrarse usando Google ID Token
 */
router.post('/google-login', async (req, res) => {
  const { credential } = req.body;

  if (!credential) {
    return res.status(400).json({ success: false, error: 'Token de Google (credential) es requerido' });
  }

  try {
    // 1. Verificar el token JWT con Google
    const googleUser = await GoogleService.verifyToken(credential);

    if (!googleUser || !googleUser.email) {
      return res.status(401).json({ success: false, error: 'Token de Google inválido o expirado' });
    }

    const email = googleUser.email.toLowerCase();

    // 2. Buscar si el usuario ya existe en nuestra base de datos
    let userRes = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    let user;

    if (userRes.rows.length === 0) {
      // 3. Registrar al usuario si es su primer ingreso
      const userId = generateId('user');
      const assignedRole = email === 'syscomecosistemadigital@gmail.com' ? 'admin' : 'client';
      const randomPassword = await bcrypt.hash(Math.random().toString(36), 10); // Generar contraseña aleatoria inútil para la cuenta OAuth

      await pool.query('BEGIN');

      // Crear registro de usuario
      await pool.query(
        'INSERT INTO users (id, email, password, role) VALUES ($1, $2, $3, $4)',
        [userId, email, randomPassword, assignedRole]
      );

      // Crear suscripción por defecto al plan básico
      const subId = generateId('sub');
      const now = new Date();
      const endDate = new Date();
      endDate.setMonth(now.getMonth() + 1);

      await pool.query(`
        INSERT INTO subscriptions (id, user_id, plan_id, status, start_date, end_date)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [subId, userId, 'plan_basic', 'active', now, endDate]);

      await pool.query('COMMIT');

      // Obtener el registro de usuario recién creado
      const freshUserRes = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
      user = freshUserRes.rows[0];
    } else {
      user = userRes.rows[0];
      
      // Asegurar que syscomecosistemadigital@gmail.com sea admin incluso si ya existía como client
      if (email === 'syscomecosistemadigital@gmail.com' && user.role !== 'admin') {
        await pool.query('UPDATE users SET role = \'admin\' WHERE id = $1', [user.id]);
        user.role = 'admin';
      }
    }

    // 4. Generar Token JWT de Zaza.click
    const tenantId = user.parent_id || user.id;
    const token = jwt.sign({ id: user.id, role: user.role, tenantId }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      success: true,
      message: 'Autenticación con Google exitosa',
      token,
      user: { id: user.id, email: user.email, role: user.role }
    });

  } catch (error: any) {
    console.error('[GoogleLogin] Error:', error.message);
    res.status(500).json({ success: false, error: 'Error en el servidor al autenticar con Google' });
  }
});

/**
 * GET /google-contacts/connect - Iniciar flujo OAuth de Google Contactos
 */
router.get('/google-contacts/connect', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).send('Falta token de autorización');
  
  try {
    const decoded = jwt.verify(token as string, JWT_SECRET) as any;
    const state = decoded.id; // userId
    const authUrl = GoogleContactsService.getAuthUrl(state);
    res.redirect(authUrl);
  } catch (err) {
    res.status(401).send('Token inválido');
  }
});

/**
 * GET /google-contacts/callback - Callback de OAuth de Google Contactos
 */
router.get('/google-contacts/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code || !state) return res.status(400).send('Parámetros inválidos de Google Callback');

  try {
    const userId = state as string;
    const tokens = await GoogleContactsService.getTokensFromCode(code as string);

    if (!tokens.access_token || !tokens.refresh_token) {
      return res.status(400).send('No se recibió el token de actualización de Google. Revoca los accesos de Zaza en tu cuenta de Google e inténtalo de nuevo.');
    }

    // Decodificar email de Google si viene id_token
    let googleEmail = '';
    if (tokens.id_token) {
      try {
        const decodedToken = jwt.decode(tokens.id_token) as any;
        googleEmail = decodedToken?.email || '';
      } catch (e) {}
    }

    await GoogleContactsService.saveCredentials(
      userId,
      tokens.access_token,
      tokens.refresh_token,
      tokens.expiry_date!,
      googleEmail
    );

    // Redirigir dinámicamente según el host (local o producción)
    const host = req.get('host') || 'zaza-click-20-production.up.railway.app';
    const protocol = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https';
    
    // Si viene de Vite en dev port 5173
    const redirectHost = host.includes('localhost:5000') ? 'localhost:5173' : host;
    
    res.redirect(`${protocol}://${redirectHost}/?google_contacts=success`);
  } catch (err: any) {
    console.error('[GoogleContactsCallback] Error:', err.message);
    const host = req.get('host') || 'zaza-click-20-production.up.railway.app';
    const protocol = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https';
    const redirectHost = host.includes('localhost:5000') ? 'localhost:5173' : host;
    res.redirect(`${protocol}://${redirectHost}/?google_contacts=error`);
  }
});

export default router;
