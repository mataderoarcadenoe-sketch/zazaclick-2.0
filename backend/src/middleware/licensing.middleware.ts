import { Request, Response, NextFunction } from 'express';
import pool from '../config/database';
import { 
  getIdempotencyRecord, 
  setIdempotencyInProgress, 
  saveIdempotencyResult 
} from '../utils/idempotency.util';

export interface LicensingContext {
  userId: string;
  userEmail: string;
  subscriptionId: string;
  planId: string;
  instanceName: string;
  instanceId: string;
  idempotencyKey?: string;
  confirmSuccess: (messageType: string, evolutionMsgId?: string, clientResponseData?: any) => Promise<void>;
  rollback: (messageType: string, errorReason?: string) => Promise<void>;
}

export interface LicensedRequest extends Request {
  licensingContext?: LicensingContext;
}

/**
 * Middleware Central de Licenciamiento, Cuotas Atómicas y Aislamiento Multi-Tenant
 */
export async function licensingMiddleware(req: LicensedRequest, res: Response, next: NextFunction) {
  const headerKey = (req.headers['x-api-key'] || req.headers['X-API-KEY']) as string;
  const { instanceName: bodyInstance, apiKey: bodyApiKey } = req.body || {};
  const instanceName = bodyInstance || (req.params?.instanceName as string);
  const apiKey = headerKey || bodyApiKey;
  const idempotencyKey = req.headers['idempotency-key'] as string;

  // 1. Verificación básica de presencia de credenciales
  if (!instanceName || !apiKey) {
    return res.status(401).json({
      success: false,
      code: 'INVALID_API_KEY',
      message: 'Credenciales faltantes: Se requiere el nombre de la instancia y la cabecera x-api-key.'
    });
  }

  // 2. Control de Idempotencia (si el cliente envía Idempotency-Key)
  if (idempotencyKey) {
    const existingRecord = await getIdempotencyRecord(instanceName, idempotencyKey);
    if (existingRecord) {
      if (existingRecord.status === 'IN_PROGRESS') {
        return res.status(409).json({
          success: false,
          code: 'IDEMPOTENCY_CONFLICT',
          message: 'Una solicitud idéntica está siendo procesada en este momento. Espera unos segundos antes de reintentar.'
        });
      }
      if (existingRecord.status === 'SUCCESS' && existingRecord.response) {
        return res.status(existingRecord.statusCode || 200).json({
          ...existingRecord.response,
          _cachedIdempotent: true
        });
      }
    }
    // Marcar como en progreso
    await setIdempotencyInProgress(instanceName, idempotencyKey);
  }

  try {
    // 3. Consulta unificada de Autoridad en PostgreSQL
    const lookupQuery = `
      SELECT 
        i.id as instance_id,
        i.instance_name,
        i.is_enabled as instance_is_enabled,
        u.id as user_id,
        u.email as user_email,
        u.status as user_status,
        s.id as subscription_id,
        s.plan_id,
        s.status as subscription_status,
        s.start_date,
        s.end_date,
        s.messages_limit,
        s.messages_used,
        p.name as plan_name
      FROM instances i
      JOIN users u ON i.user_id = u.id
      LEFT JOIN subscriptions s ON u.id = s.user_id AND s.status IN ('active', 'trial')
      LEFT JOIN plans p ON s.plan_id = p.id
      WHERE i.instance_name = $1 AND i.api_key = $2
      ORDER BY s.created_at DESC
      LIMIT 1;
    `;

    const result = await pool.query(lookupQuery, [instanceName, apiKey]);

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        code: 'INVALID_API_KEY',
        message: 'Credenciales inválidas: La API Key no pertenece a la instancia especificada.'
      });
    }

    const row = result.rows[0];

    // 4. Validación de Instancia Habilitada
    if (row.instance_is_enabled === false) {
      return res.status(403).json({
        success: false,
        code: 'INSTANCE_DISABLED',
        message: 'Esta línea de WhatsApp ha sido deshabilitada administrativamente.'
      });
    }

    // 5. Validación de Estado del Usuario
    if (row.user_status === 'suspended') {
      return res.status(403).json({
        success: false,
        code: 'USER_SUSPENDED',
        message: 'Tu cuenta de usuario se encuentra temporalmente suspendida. Contacta a soporte.'
      });
    }

    if (row.user_status === 'blocked') {
      return res.status(403).json({
        success: false,
        code: 'USER_BLOCKED',
        message: 'Acceso bloqueado permanentemente por administración.'
      });
    }

    // 6. Validación de Suscripción Existente
    if (!row.subscription_id) {
      return res.status(403).json({
        success: false,
        code: 'SUBSCRIPTION_REQUIRED',
        message: 'No tienes una suscripción activa o período de prueba asignado.'
      });
    }

    // 7. Validación de Vencimiento de Fecha en Tiempo Real
    const now = new Date();
    const endDate = new Date(row.end_date);

    if (now.getTime() > endDate.getTime()) {
      // Marcar suscripción como expired si no lo estaba
      await pool.query('UPDATE subscriptions SET status = \'expired\' WHERE id = $1', [row.subscription_id]);
      return res.status(403).json({
        success: false,
        code: 'SUBSCRIPTION_EXPIRED',
        message: `Tu suscripción venció el ${endDate.toLocaleDateString()}. Contacta al administrador para renovar tu servicio.`
      });
    }

    // 8. Reserva Atómica de Cuota en PostgreSQL
    const atomicReservationQuery = `
      UPDATE subscriptions
      SET messages_used = messages_used + 1
      WHERE id = $1 
        AND messages_used < messages_limit 
        AND status IN ('active', 'trial') 
        AND end_date >= CURRENT_TIMESTAMP
      RETURNING messages_used, messages_limit;
    `;

    const reserveRes = await pool.query(atomicReservationQuery, [row.subscription_id]);

    if (reserveRes.rows.length === 0) {
      return res.status(429).json({
        success: false,
        code: 'MESSAGE_LIMIT_REACHED',
        message: `Has alcanzado el límite máximo de ${row.messages_limit} mensajes permitidos en tu plan actual.`
      });
    }

    // 9. Inyección del Contexto de Licenciamiento con Callbacks Atómicos
    const subscriptionId = row.subscription_id;
    const userId = row.user_id;
    const instanceId = row.instance_id;

    req.licensingContext = {
      userId,
      userEmail: row.user_email,
      subscriptionId,
      planId: row.plan_id,
      instanceName,
      instanceId,
      idempotencyKey,

      // Confirmar envío exitoso
      confirmSuccess: async (messageType: string, evolutionMsgId?: string, clientResponseData?: any) => {
        try {
          const logId = `log_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
          await pool.query(`
            INSERT INTO usage_logs (id, user_id, subscription_id, instance_name, message_type, status, evolution_message_id)
            VALUES ($1, $2, $3, $4, $5, 'SUCCESS', $6)
          `, [logId, userId, subscriptionId, instanceName, messageType, evolutionMsgId || null]);

          // Actualizar última actividad de la instancia
          await pool.query(`
            UPDATE instances 
            SET messages_sent = messages_sent + 1, last_activity_at = CURRENT_TIMESTAMP 
            WHERE id = $1
          `, [instanceId]);

          if (idempotencyKey) {
            await saveIdempotencyResult(instanceName, idempotencyKey, 'SUCCESS', clientResponseData, 200);
          }
        } catch (err: any) {
          console.error('[Licensing] Error confirmando consumo:', err.message);
        }
      },

      // Rollback de cuota si Evolution API falló
      rollback: async (messageType: string, errorReason?: string) => {
        try {
          console.warn(`⚠️ [Licensing] Ejecutando Rollback de cuota para usuario ${userId} en instancia ${instanceName}. Motivo: ${errorReason}`);
          await pool.query(`
            UPDATE subscriptions 
            SET messages_used = GREATEST(0, messages_used - 1) 
            WHERE id = $1
          `, [subscriptionId]);

          const logId = `log_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
          await pool.query(`
            INSERT INTO usage_logs (id, user_id, subscription_id, instance_name, message_type, status, evolution_message_id)
            VALUES ($1, $2, $3, $4, $5, 'FAILED', $6)
          `, [logId, userId, subscriptionId, instanceName, messageType, errorReason || 'SEND_ERROR']);

          if (idempotencyKey) {
            await saveIdempotencyResult(instanceName, idempotencyKey, 'FAILED', { error: errorReason }, 502);
          }
        } catch (err: any) {
          console.error('[Licensing] Error ejecutando Rollback:', err.message);
        }
      }
    };

    return next();
  } catch (error: any) {
    console.error('❌ [Licensing Middleware Error]:', error.message);
    return res.status(500).json({
      success: false,
      code: 'INTERNAL_ERROR',
      message: `Error interno de validación de licenciamiento: ${error.message}`
    });
  }
}
