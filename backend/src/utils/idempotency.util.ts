import redis from '../config/redis';

export interface IdempotencyRecord {
  status: 'IN_PROGRESS' | 'SUCCESS' | 'FAILED';
  response?: any;
  statusCode?: number;
  createdAt: number;
}

const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60; // 24 horas

/**
 * Consulta el estado de una clave de idempotencia en Redis
 */
export async function getIdempotencyRecord(instanceName: string, idempotencyKey: string): Promise<IdempotencyRecord | null> {
  if (!idempotencyKey) return null;
  try {
    const redisKey = `idemp:${instanceName}:${idempotencyKey}`;
    const raw = await redis.get(redisKey);
    if (!raw) return null;
    return JSON.parse(raw) as IdempotencyRecord;
  } catch (err: any) {
    console.warn(`[Idempotency] Error consultando clave ${idempotencyKey}:`, err.message);
    return null;
  }
}

/**
 * Marca una solicitud como en progreso (IN_PROGRESS)
 */
export async function setIdempotencyInProgress(instanceName: string, idempotencyKey: string): Promise<boolean> {
  if (!idempotencyKey) return false;
  try {
    const redisKey = `idemp:${instanceName}:${idempotencyKey}`;
    const record: IdempotencyRecord = {
      status: 'IN_PROGRESS',
      createdAt: Date.now()
    };
    // SET NX (solo si no existe) con expiración
    const res = await redis.set(redisKey, JSON.stringify(record), 'EX', IDEMPOTENCY_TTL_SECONDS, 'NX');
    return res === 'OK';
  } catch (err: any) {
    console.warn(`[Idempotency] Error marcando IN_PROGRESS:`, err.message);
    return false;
  }
}

/**
 * Guarda el resultado final de la operación idempotente
 */
export async function saveIdempotencyResult(
  instanceName: string,
  idempotencyKey: string,
  status: 'SUCCESS' | 'FAILED',
  response: any,
  statusCode: number = 200
): Promise<void> {
  if (!idempotencyKey) return;
  try {
    const redisKey = `idemp:${instanceName}:${idempotencyKey}`;
    const record: IdempotencyRecord = {
      status,
      response,
      statusCode,
      createdAt: Date.now()
    };
    await redis.set(redisKey, JSON.stringify(record), 'EX', IDEMPOTENCY_TTL_SECONDS);
  } catch (err: any) {
    console.warn(`[Idempotency] Error guardando resultado:`, err.message);
  }
}
