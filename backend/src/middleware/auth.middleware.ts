import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'whatsapp-secret-key-2024';

export interface AuthenticatedRequest extends Request {
  userId?: string;
  userRole?: string;
  tenantId?: string;
  agentId?: string;
  userEmail?: string;
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
    req.userEmail = decoded.email;
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

  // Verificar Master Partner Key (VivesFit, Krono & Partners Autorizados)
  const candidatePartnerKey = bearerToken || apiKey;
  if (candidatePartnerKey) {
    try {
      const { PartnerService } = await import('../services/partner.service');
      const partner = await PartnerService.getPartnerByKey(candidatePartnerKey);
      if (partner) {
        const pool = (await import('../config/database')).default;
        const instName = req.params?.instanceName || req.body?.instanceName || (req.query?.instanceName as string);
        if (instName) {
          const instRes = await pool.query(
            `SELECT i.user_id 
             FROM instances i
             JOIN users u ON i.user_id = u.id
             WHERE (i.instance_name = $1 OR i.name = $1)
             LIMIT 1`,
            [instName]
          );
          if (instRes.rows.length > 0) {
            req.userId = instRes.rows[0].user_id;
            req.tenantId = instRes.rows[0].user_id;
          }
        }
        if (!req.userId && (req.params?.id || req.query?.tenantId || req.query?.gymId)) {
          req.userId = (req.params?.id || req.query?.tenantId || req.query?.gymId) as string;
          req.tenantId = req.userId;
        }
        if (!req.userId) {
          const uRes = await pool.query(
            `SELECT id FROM users WHERE partner_id = $1 OR role = 'admin' ORDER BY created_at ASC LIMIT 1`,
            [partner.id]
          );
          if (uRes.rows.length > 0) {
            req.userId = uRes.rows[0].id;
            req.tenantId = uRes.rows[0].id;
          }
        }
        req.userRole = 'partner';
        (req as any).partnerId = partner.id;
        (req as any).environment = 'live';
        return next();
      }
    } catch (err: any) {
      console.error('[authMiddleware] Error verificando Master Partner Key:', err.message);
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
      // Si el JWT es inválido, continuar para evaluar si el token es una API Key
    }
  }

  // 2. Intentar con x-api-key o bearerToken como API Key
  const effectiveApiKey = apiKey || bearerToken;
  if (effectiveApiKey) {
    try {
      const { ApiKeyService } = await import('../services/api-key.service');
      const keyValidation = await ApiKeyService.validateKey(effectiveApiKey);

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
        'SELECT user_id FROM instances WHERE api_key = $1 OR token = $1 LIMIT 1',
        [effectiveApiKey]
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
        [effectiveApiKey, `%${effectiveApiKey}%`]
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
        error: 'API Key inválida o no autorizada.'
      });
    } catch (dbErr: any) {
      console.error('[apiKeyOrTokenAuth] Error en validación de API Key:', dbErr.message);
      return res.status(500).json({ success: false, error: 'Error interno verificando credenciales API: ' + dbErr.message });
    }
  }

  return res.status(401).json({
    success: false,
    code: 'UNAUTHORIZED',
    error: 'Autenticación requerida: Proporcione cabecera "x-api-key" o "Authorization: Bearer <token>".'
  });
}
