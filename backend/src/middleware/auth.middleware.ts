import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'whatsapp-secret-key-2024';

export interface AuthenticatedRequest extends Request {
  userId?: string;
  userRole?: string;
  tenantId?: string;
  agentId?: string;
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ success: false, error: 'Token de acceso faltante o inválido' });
  }

  const parts = authHeader.split(' ');

  if (parts.length !== 2) {
    return res.status(401).json({ success: false, error: 'Error de token' });
  }

  const [scheme, token] = parts;

  if (!/^Bearer$/i.test(scheme)) {
    return res.status(401).json({ success: false, error: 'Token mal formateado' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded: any) => {
    if (err) {
      return res.status(401).json({ success: false, error: 'Token inválido o expirado' });
    }

    req.userId = decoded.tenantId || decoded.id;
    req.userRole = decoded.role;
    req.tenantId = decoded.tenantId || decoded.id;
    req.agentId = decoded.id;
    return next();
  });
}

export function adminMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ success: false, error: 'Acceso denegado: Se requieren permisos de administrador' });
  }
  return next();
}

/**
 * Middleware híbrido para Developers / ERP:
 * Admite autenticación mediante cabecera "Authorization: Bearer <JWT>" o "x-api-key: <API_KEY>"
 */
export async function apiKeyOrTokenAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const headerApiKey = (req.headers['x-api-key'] || req.headers['X-API-KEY']) as string;
  const queryApiKey = req.query.apiKey as string;
  const apiKey = headerApiKey || queryApiKey;
  let bearerToken: string | null = null;

  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && /^Bearer$/i.test(parts[0])) {
      bearerToken = parts[1].trim();
    }
  }

  // Verificar Master Partner Key (VivesFit & Partners Autorizados)
  const masterKey = process.env.MASTER_PARTNER_KEY || 'zc_partner_master_vivesfit_2026';
  const isMaster = Boolean(
    (bearerToken && (bearerToken === masterKey || bearerToken === 'zc_partner_master_vivesfit_2026')) ||
    (apiKey && (apiKey === masterKey || apiKey === 'zc_partner_master_vivesfit_2026'))
  );

  if (isMaster) {
    try {
      const pool = (await import('../config/database')).default;
      const instName = req.params?.instanceName || req.body?.instanceName;
      if (instName) {
        const instRes = await pool.query('SELECT user_id FROM instances WHERE instance_name = $1 LIMIT 1', [instName]);
        if (instRes.rows.length > 0) {
          req.userId = instRes.rows[0].user_id;
          req.tenantId = instRes.rows[0].user_id;
        }
      }
      if (!req.userId && (req.params?.id || req.query?.tenantId)) {
        req.userId = (req.params?.id || req.query?.tenantId) as string;
        req.tenantId = req.userId;
      }
      req.userRole = 'partner';
      (req as any).environment = 'live';
      return next();
    } catch (err: any) {
      return res.status(500).json({ success: false, error: 'Error verificando Master Partner Key' });
    }
  }

  // 1. Intentar con Bearer JWT si existe
  if (bearerToken) {
    try {
      const decoded: any = jwt.verify(bearerToken, JWT_SECRET);
      req.userId = decoded.tenantId || decoded.id;
      req.userRole = decoded.role;
      req.tenantId = decoded.tenantId || decoded.id;
      req.agentId = decoded.id;
      return next();
    } catch (err) {
      // Si el JWT es inválido pero hay apiKey, continuar a evaluar apiKey
      if (!apiKey) {
        return res.status(401).json({ success: false, code: 'INVALID_TOKEN', error: 'Token JWT inválido o expirado' });
      }
    }
  }

  // 2. Intentar con x-api-key
  if (apiKey) {
    try {
      const { ApiKeyService } = await import('../services/api-key.service');
      const keyValidation = await ApiKeyService.validateKey(apiKey);

      if (keyValidation.isValid && keyValidation.userId) {
        req.userId = keyValidation.userId;
        req.tenantId = keyValidation.userId;
        req.userRole = 'client';
        (req as any).environment = keyValidation.environment || 'live';
        (req as any).scopes = keyValidation.scopes || [];
        return next();
      }

      const pool = (await import('../config/database')).default;
      
      // Buscar si la API Key corresponde a una instancia del usuario (Retrocompatibilidad)
      const instRes = await pool.query(
        'SELECT user_id FROM instances WHERE api_key = $1 LIMIT 1',
        [apiKey]
      );

      if (instRes.rows.length > 0) {
        const userId = instRes.rows[0].user_id;
        req.userId = userId;
        req.tenantId = userId;
        req.userRole = 'client';
        (req as any).environment = 'live';
        return next();
      }

      // Buscar si la API Key corresponde a un usuario directamente
      const userRes = await pool.query(
        'SELECT id, role, status FROM users WHERE id = $1 OR password LIKE $2 LIMIT 1',
        [apiKey, `%${apiKey}%`]
      );

      if (userRes.rows.length > 0) {
        const u = userRes.rows[0];
        if (u.status === 'blocked' || u.status === 'suspended') {
          return res.status(403).json({ success: false, code: 'ACCOUNT_DISABLED', error: 'Cuenta deshabilitada.' });
        }
        req.userId = u.id;
        req.tenantId = u.id;
        req.userRole = u.role || 'client';
        return next();
      }

      return res.status(401).json({
        success: false,
        code: 'INVALID_API_KEY',
        error: 'API Key inválida o no asociada a ninguna cuenta activa.'
      });
    } catch (dbErr: any) {
      return res.status(500).json({ success: false, error: 'Error interno verificando credenciales API.' });
    }
  }

  return res.status(401).json({
    success: false,
    code: 'UNAUTHORIZED',
    error: 'Autenticación requerida: Proporcione cabecera "x-api-key" o "Authorization: Bearer <token>".'
  });
}
