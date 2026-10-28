import * as crypto from 'crypto';
import pool from '../config/database';
import { ApiLogService } from './api-log.service';

export type OperationState = 'PROCESSING' | 'ACCEPTED' | 'REJECTED' | 'UNKNOWN';
export interface MessageOperation {
  id: string; user_id: string; instance_id: string; idempotency_key: string;
  request_hash: string; state: OperationState; response: any; http_status: number | null;
  created_at: string; updated_at: string; message_id?: string;
}
export class OperationUnavailable extends Error {}

/** Deterministic across JSON property order; never stores the PDF or credential. */
export function requestHash(kind: string, body: any): string {
  function canonical(value: any): string {
    if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
    if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
    return '{' + Object.keys(value).filter(k => k !== 'apiKey').sort()
      .map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  }
  return crypto.createHash('sha256').update(kind + '\n' + canonical(body)).digest('hex');
}
export function replay(operation: MessageOperation, hash: string): {status: number; body: any} {
  if (operation.request_hash !== hash) return {status: 409, body: {success: false,
    code: 'IDEMPOTENCY_PAYLOAD_MISMATCH', operationId: operation.id, message: 'La clave ya corresponde a otro contenido. No se envió otro mensaje.'}};
  if (['ACCEPTED', 'REJECTED'].includes(operation.state) && operation.response) {
    return {status: operation.http_status || 200, body: {...operation.response, operationId: operation.id, _cachedIdempotent: true}};
  }
  return {status: 409, body: {success: false, code: operation.state === 'UNKNOWN' ? 'DELIVERY_UNCERTAIN' : 'IDEMPOTENCY_CONFLICT',
    operationId: operation.id, deliveryState: operation.state,
    message: 'La operación ya existe. Consulta su estado; no se volvió a enviar.'}};
}
export class MessageOperationService {
  static async begin(userId: string, instanceId: string, subscriptionId: string, key: string, hash: string, environment: string) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SET LOCAL lock_timeout = '5s'");
      await client.query("SET LOCAL statement_timeout = '10s'");
      const inserted = await client.query(`INSERT INTO message_operations
        (id, user_id, instance_id, idempotency_key, request_hash, state, subscription_id, environment)
        VALUES ($1,$2,$3,$4,$5,'PROCESSING',$6,$7)
        ON CONFLICT (user_id, instance_id, idempotency_key) DO NOTHING RETURNING *`,
        [crypto.randomUUID(), userId, instanceId, key, hash, subscriptionId, environment]);
      if (!inserted.rows.length) {
        const existing = await client.query('SELECT * FROM message_operations WHERE user_id=$1 AND instance_id=$2 AND idempotency_key=$3', [userId, instanceId, key]);
        if (!existing.rows[0]) throw new OperationUnavailable('No se pudo reconciliar la operación.');
        await client.query('COMMIT');
        return {fresh: false, operation: existing.rows[0] as MessageOperation};
      }
      const operation = inserted.rows[0] as MessageOperation;
      const quota = await client.query(`UPDATE subscriptions SET messages_used = messages_used + 1
        WHERE id=$1 AND user_id=$2 AND messages_used < messages_limit AND status IN ('active','trial')
        AND end_date >= CURRENT_TIMESTAMP RETURNING messages_used`, [subscriptionId, userId]);
      if (!quota.rows.length) {
        const response = {success: false, code: 'MESSAGE_LIMIT_REACHED', operationId: operation.id,
          deliveryState: 'REJECTED', message: 'No hay cuota disponible. No se envió el mensaje.'};
        const rejected = await client.query(`UPDATE message_operations SET state='REJECTED', response=$2::jsonb,
          http_status=429, updated_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING *`, [operation.id, JSON.stringify(response)]);
        await client.query('COMMIT');
        return {fresh: false, operation: rejected.rows[0] as MessageOperation};
      }
      await client.query('COMMIT');
      return {fresh: true, operation};
    } catch {
      await client.query('ROLLBACK').catch(() => {});
      throw new OperationUnavailable('No se pudo reservar el envío de forma segura.');
    } finally { client.release(); }
  }
  static async finish(operation: MessageOperation, state: Exclude<OperationState, 'PROCESSING'>,
    messageType: string, response: any, status: number, messageId?: string) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SET LOCAL lock_timeout = '5s'");
      await client.query("SET LOCAL statement_timeout = '10s'");
      const changed = await client.query(`UPDATE message_operations SET state=$2, response=$3::jsonb,
        http_status=$4, message_id=$5, updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND state='PROCESSING' RETURNING subscription_id`,
        [operation.id, state, JSON.stringify(ApiLogService.sanitizeData(response)), status, messageId || null]);
      if (changed.rows.length) {
        // UNKNOWN retains the reservation: a timeout is not proof of non-delivery.
        if (state === 'REJECTED') await client.query('UPDATE subscriptions SET messages_used=GREATEST(0,messages_used-1) WHERE id=$1', [changed.rows[0].subscription_id]);
        await client.query(`INSERT INTO usage_logs (id,user_id,subscription_id,instance_name,message_type,status,evolution_message_id)
          SELECT $1,o.user_id,o.subscription_id,i.instance_name,$2,$3,$4 FROM message_operations o JOIN instances i ON i.id=o.instance_id WHERE o.id=$5`,
          [crypto.randomUUID(), messageType, state === 'ACCEPTED' ? 'SUCCESS' : state === 'REJECTED' ? 'FAILED' : 'UNKNOWN', messageId || null, operation.id]);
        if (state === 'ACCEPTED') await client.query('UPDATE instances SET messages_sent=messages_sent+1,last_activity_at=CURRENT_TIMESTAMP WHERE id=$1', [operation.instance_id]);
      } else {
        const existing = await client.query('SELECT state FROM message_operations WHERE id=$1', [operation.id]);
        if (!existing.rows[0]) throw new OperationUnavailable('Operación no disponible.');
        await client.query('COMMIT');
        return existing.rows[0].state as OperationState;
      }
      await client.query('COMMIT');
      return state;
    } catch {
      await client.query('ROLLBACK').catch(() => {});
      throw new OperationUnavailable('No se pudo guardar el resultado. Consulta la operación antes de reenviar.');
    } finally { client.release(); }
  }
}
