import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import pool from '../config/database';
import { jwtSecret, isRetiredCredential } from '../config/security';
import { ApiKeyService } from '../services/api-key.service';
import { PartnerService } from '../services/partner.service';

export interface Principal {
  userId: string; role: string; agentId?: string; email?: string; partnerId?: string;
  instanceId?: string; scopes?: string[]; environment: 'live' | 'test';
}
export interface AuthenticatedRequest extends Request {
  userId?: string; userRole?: string; tenantId?: string; agentId?: string; userEmail?: string; principal?: Principal;
}
export function credential(req: Request): string | null {
  const key = req.headers['x-api-key'];
  if (typeof key === 'string' && key.length <= 4096) return key.trim();
  const auth = req.headers.authorization;
  const match = typeof auth === 'string' && auth.length <= 4096 ? /^Bearer\s+(\S+)$/i.exec(auth) : null;
  return match ? match[1] : null;
}
export async function authenticate(token: string, jwtOnly = false): Promise<Principal | null> {
  if (!token || token.length > 4096 || isRetiredCredential(token)) return null;
  if (token.split('.').length === 3) {
    let decoded: jwt.JwtPayload;
    try {
      const value = jwt.verify(token, jwtSecret(), { algorithms: ['HS256'] });
      if (typeof value === 'string') return null;
      decoded = value;
    } catch { return null; }
    if (typeof decoded.id !== 'string' || typeof decoded.exp !== 'number') return null;
    const result = await pool.query('SELECT id, parent_id, role, email, status FROM users WHERE id = $1', [decoded.id]);
    const user = result.rows[0];
    if (!user || ['blocked', 'suspended'].includes(user.status)) return null;
    if (user.parent_id) {
      const owner = await pool.query('SELECT status FROM users WHERE id = $1', [user.parent_id]);
      if (!owner.rows[0] || ['blocked', 'suspended'].includes(owner.rows[0].status)) return null;
    }
    return {userId: user.parent_id || user.id, agentId: user.id, role: user.role || 'client', email: user.email, environment: 'live'};
  }
  if (jwtOnly) return null;
  const partner = await PartnerService.getPartnerByKey(token);
  if (partner?.isActive) return {userId: `partner_${partner.id}`, partnerId: partner.id, role: 'partner', environment: 'live'};
  const key = await ApiKeyService.validateKey(token);
  if (key.isValid && key.userId) return {userId: key.userId, role: 'client', scopes: key.scopes || [], environment: key.environment || 'live'};
  const instance = await pool.query('SELECT id, user_id FROM instances WHERE api_key = $1 OR token = $1 LIMIT 1', [token]);
  const row = instance.rows[0];
  return row?.user_id ? {userId: row.user_id, instanceId: row.id, role: 'client', environment: 'live'} : null;
}
function assign(req: AuthenticatedRequest, principal: Principal) {
  req.principal = principal; req.userId = principal.userId; req.tenantId = principal.userId;
  req.userRole = principal.role; req.agentId = principal.agentId; req.userEmail = principal.email;
  Object.assign(req, {partnerId: principal.partnerId, environment: principal.environment, scopes: principal.scopes});
}
export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) { return authorize(req, res, next, true); }
export function apiKeyOrTokenAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) { return authorize(req, res, next, false); }
async function authorize(req: AuthenticatedRequest, res: Response, next: NextFunction, jwtOnly: boolean) {
  try {
    const token = credential(req);
    const principal = token ? await authenticate(token, jwtOnly) : null;
    if (!principal) return res.status(401).json({success: false, code: 'UNAUTHORIZED', error: 'Credencial inválida, revocada o cuenta no disponible.'});
    if (principal.instanceId) {
      const name = req.params.instanceName || req.body?.instanceName;
      if (typeof name !== 'string') return res.status(403).json({success: false, code: 'INSTANCE_CREDENTIAL_SCOPE', error: 'Esta credencial está limitada a su instancia.'});
      const own = await pool.query('SELECT id FROM instances WHERE id=$1 AND (instance_name=$2 OR name=$2)', [principal.instanceId, name]);
      if (!own.rows.length) return res.status(403).json({success: false, code: 'FORBIDDEN_INSTANCE', error: 'Instancia no autorizada.'});
    }
    assign(req, principal); return next();
  } catch {
    return res.status(503).json({success: false, code: 'AUTH_UNAVAILABLE', error: 'No se pudo verificar el acceso. No se ejecutó la operación.'});
  }
}
export function adminMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (req.userRole !== 'admin' || (req.userEmail || '').toLowerCase().trim() !== 'syscomecosistemadigital@gmail.com') {
    return res.status(403).json({success: false, error: 'Acceso denegado: Se requieren permisos de SuperAdmin'});
  }
  return next();
}
