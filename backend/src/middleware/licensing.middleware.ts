import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';
import pool from '../config/database';
import { authenticate, credential } from './auth.middleware';
import { MessageOperationService, requestHash, replay } from '../services/message-operation.service';
import { outgoingDocumentError } from '../utils/outgoing-document.util';

export interface LicensingContext {
  userId: string; userEmail: string; subscriptionId: string; planId: string;
  instanceName: string; instanceId: string; engineType?: string; idempotencyKey?: string; operationId: string;
  confirmSuccess: (messageType: string, evolutionMsgId?: string, clientResponseData?: any) => Promise<void>;
  rollback: (messageType: string, errorReason?: string) => Promise<void>;
}
export interface LicensedRequest extends Request { licensingContext?: LicensingContext; }
/** Authorize, persist one operation and reserve quota atomically BEFORE invoking an engine. */
export async function licensingMiddleware(req: LicensedRequest, res: Response, next: NextFunction) {
  const instanceName = req.body?.instanceName || req.params?.instanceName;
  const suppliedKey = req.headers['idempotency-key'];
  if (typeof instanceName !== 'string' || !/^[A-Za-z0-9_-]{1,255}$/.test(instanceName) ||
    (suppliedKey !== undefined && (typeof suppliedKey !== 'string' || !/^[A-Za-z0-9_.:-]{1,128}$/.test(suppliedKey)))) {
    return res.status(400).json({success: false, code: 'INVALID_REQUEST', message: 'Instancia o Idempotency-Key no válidas.'});
  }
  try {
    const token = credential(req);
    const principal = token ? await authenticate(token) : null;
    if (!principal) return res.status(401).json({success: false, code: 'INVALID_API_KEY', message: 'Credencial inválida o cuenta no disponible.'});
    if (principal.scopes && !principal.scopes.includes('messages:send')) return res.status(403).json({success: false, code: 'INSUFFICIENT_SCOPE', message: 'La clave no permite enviar mensajes.'});
    if (principal.environment !== 'live') return res.status(403).json({success: false, code: 'TEST_KEY_SEND_DISABLED', message: 'Una clave de prueba no puede enviar mensajes reales.'});
    const owned = await pool.query(`SELECT i.id AS instance_id,i.instance_name,i.engine_type,i.is_enabled,
      u.id AS user_id,u.email AS user_email,u.status AS user_status,s.id AS subscription_id,s.plan_id,s.end_date
      FROM instances i JOIN users u ON u.id=i.user_id
      LEFT JOIN LATERAL (SELECT id,plan_id,end_date FROM subscriptions WHERE user_id=u.id AND status IN ('active','trial') ORDER BY created_at DESC LIMIT 1) s ON true
      WHERE i.instance_name=$1 AND (($2::text IS NOT NULL AND u.partner_id=$2) OR ($2::text IS NULL AND u.id=$3))
      AND ($4::text IS NULL OR i.id=$4)`, [instanceName, principal.partnerId || null, principal.userId, principal.instanceId || null]);
    const row = owned.rows[0];
    if (!row) return res.status(403).json({success: false, code: 'FORBIDDEN_INSTANCE', message: 'Instancia no autorizada.'});
    if (row.is_enabled === false || ['blocked', 'suspended'].includes(row.user_status)) return res.status(403).json({success: false, code: 'ACCOUNT_DISABLED', message: 'Cuenta o instancia deshabilitada.'});
    if (!row.subscription_id || !Number.isFinite(new Date(row.end_date).getTime()) || new Date(row.end_date).getTime() < Date.now()) {
      return res.status(403).json({success: false, code: 'SUBSCRIPTION_REQUIRED', message: 'Revisa la vigencia de la suscripción.'});
    }
    Object.assign(req, {userId: row.user_id, environment: principal.environment});
    const key = suppliedKey as string || crypto.randomUUID();
    const kind = req.path.split('/').filter(Boolean).pop()!.replace(/^send-/, '');
    const documentError = kind === 'media' ? outgoingDocumentError(req.body) : null;
    if (documentError) return res.status(400).json({success: false, code: 'INVALID_DOCUMENT', message: documentError});
    const hash = requestHash(kind, req.body);
    const result = await MessageOperationService.begin(row.user_id, row.instance_id, row.subscription_id, key, hash, principal.environment);
    const operation = result.operation;
    res.setHeader('X-Operation-Id', operation.id);
    if (!result.fresh) { const cached = replay(operation, hash); return res.status(cached.status).json(cached.body); }
    let outcome = 'PROCESSING';
    const json = res.json.bind(res);
    res.json = (body: any) => {
      if (outcome === 'UNKNOWN') {
        res.status(409);
        return json({success: false, code: 'DELIVERY_UNCERTAIN', operationId: operation.id, deliveryState: outcome,
          message: 'No se pudo confirmar el resultado. Consulta la operación antes de reenviar.'});
      }
      return json(body && typeof body === 'object' ? {...body, operationId: operation.id, deliveryState: outcome} : body);
    };
    req.licensingContext = {
      userId: row.user_id, userEmail: row.user_email, subscriptionId: row.subscription_id,
      planId: row.plan_id, instanceName, instanceId: row.instance_id, engineType: row.engine_type,
      idempotencyKey: key, operationId: operation.id,
      confirmSuccess: async (type, messageId, payload) => {
        const response = {...payload, operationId: operation.id, deliveryState: 'ACCEPTED'};
        outcome = await MessageOperationService.finish(operation, 'ACCEPTED', type, response, 200, messageId);
      },
      rollback: async (type, reason = '') => {
        const rejected = /^INVALID_(PARAMS|MEDIATYPE|CONTACT|COORDINATES)$/.test(reason);
        const state = rejected ? 'REJECTED' : 'UNKNOWN';
        const response = {success: false, code: rejected ? 'INVALID_REQUEST' : 'DELIVERY_UNCERTAIN',
          operationId: operation.id, deliveryState: state,
          message: rejected ? 'Solicitud inválida; no se envió el mensaje.' : 'No se pudo confirmar el resultado. Consulta la operación antes de reenviar.'};
        try {
          outcome = await MessageOperationService.finish(operation, state, type, response, rejected ? 400 : 409);
        } catch { outcome = 'UNKNOWN'; }
      }
    };
    return next();
  } catch {
    return res.status(503).json({success: false, code: 'OPERATION_UNAVAILABLE',
      message: 'No se pudo verificar o reservar la operación. Si ya tienes una clave de envío, consulta su estado antes de reenviar.'});
  }
}
