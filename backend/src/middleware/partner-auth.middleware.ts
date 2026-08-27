import { Request, Response, NextFunction } from 'express';
import pool from '../config/database';
import { ApiKeyService } from '../services/api-key.service';

export interface PartnerRequest extends Request {
  partnerId?: string;
  partnerName?: string;
  isPartner?: boolean;
  scopes?: string[];
}

const DEFAULT_PARTNER_KEY = process.env.MASTER_PARTNER_KEY || 'zc_partner_master_vivesfit_2026';

/**
 * Middleware de Autenticación para la API B2B de Partners (VivesFit & ERPs)
 */
export async function partnerAuthMiddleware(req: PartnerRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const headerPartnerKey = (req.headers['x-partner-key'] || req.headers['X-PARTNER-KEY']) as string;
  const headerApiKey = (req.headers['x-api-key'] || req.headers['X-API-KEY']) as string;
  
  let candidateKey = headerPartnerKey || headerApiKey;

  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && /^Bearer$/i.test(parts[0])) {
      candidateKey = parts[1];
    }
  }

  if (!candidateKey) {
    return res.status(401).json({
      success: false,
      code: 'UNAUTHORIZED_PARTNER',
      error: 'Autenticación B2B requerida. Proporcione la cabecera "x-partner-key" o "Authorization: Bearer <MASTER_PARTNER_KEY>".'
    });
  }

  // 1. Verificación contra Master Partner Key de entorno
  if (candidateKey === DEFAULT_PARTNER_KEY || (process.env.MASTER_PARTNER_KEY && candidateKey === process.env.MASTER_PARTNER_KEY)) {
    req.partnerId = 'partner_vivesfit_core';
    req.partnerName = 'VivesFit SaaS Platform';
    req.isPartner = true;
    req.scopes = ['partner:all', 'partner:tenants:write', 'partner:tenants:read', 'partner:subscriptions:write'];
    return next();
  }

  // 2. Verificación contra base de datos (api_keys con prefijo zc_partner_ o scope partner:all)
  try {
    const keyHash = ApiKeyService.hashKey(candidateKey);
    const dbRes = await pool.query(
      `SELECT id, user_id, name, scopes, environment, is_active
       FROM api_keys
       WHERE (key_hash = $1 OR masked_key = $2) AND is_active = true
       LIMIT 1`,
      [keyHash, candidateKey]
    );

    if (dbRes.rows.length > 0) {
      const keyRow = dbRes.rows[0];
      const scopes = typeof keyRow.scopes === 'string' ? JSON.parse(keyRow.scopes) : keyRow.scopes;

      if (keyRow.environment === 'partner' || scopes.includes('partner:all') || scopes.includes('partner:tenants:write')) {
        req.partnerId = keyRow.user_id || keyRow.id;
        req.partnerName = keyRow.name;
        req.isPartner = true;
        req.scopes = scopes;

        // Actualizar último uso
        pool.query('UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = $1', [keyRow.id]).catch(() => {});
        return next();
      }
    }

    return res.status(403).json({
      success: false,
      code: 'FORBIDDEN_PARTNER',
      error: 'La clave proporcionada no posee permisos de Partner B2B para aprovisionar tenants.'
    });
  } catch (err: any) {
    console.error('[PartnerAuth Error]:', err.message);
    return res.status(500).json({
      success: false,
      code: 'INTERNAL_ERROR',
      error: 'Error interno verificando credenciales B2B.'
    });
  }
}
