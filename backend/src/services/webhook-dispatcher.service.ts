import axios from 'axios';
import * as crypto from 'crypto';
import pool from '../config/database';
import redis from '../config/redis';
import { Queue, Worker, Job } from 'bullmq';

export interface CanonicalWebhookEvent {
  id: string;
  type: string;
  timestamp: number;
  instanceName: string;
  tenantId?: string;
  engine?: string;
  data: any;
}

const connectionConfig = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null as any
};

// Cola dedicada para despacho saliente de webhooks a ERPs externos con reintentos exponenciales
export const outboundWebhookQueue = new Queue('outbound-webhook-queue', {
  connection: connectionConfig,
  defaultJobOptions: {
    attempts: 4, // 4 intentos
    backoff: {
      type: 'exponential',
      delay: 30000 // 30s, 60s, 120s, 240s
    },
    removeOnComplete: { age: 86400, count: 5000 },
    removeOnFail: { age: 604800, count: 5000 }
  }
});

// Worker que ejecuta las llamadas HTTP salientes hacia los ERPs
const outboundWorker = new Worker('outbound-webhook-queue', async (job: Job) => {
  const { webhookUrl, webhookSecret, event, isReplay } = job.data as {
    webhookUrl: string;
    webhookSecret: string;
    event: CanonicalWebhookEvent;
    isReplay?: boolean;
  };

  const timestamp = Math.floor(Date.now() / 1000);
  const rawBody = JSON.stringify(event);
  const signaturePayload = `${timestamp}.${rawBody}`;
  const signature = crypto.createHmac('sha256', webhookSecret || 'default_secret').update(signaturePayload).digest('hex');
  const deliveryId = `del_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  const startTime = Date.now();
  const requestHeaders = {
    'Content-Type': 'application/json',
    'User-Agent': 'ZazaClick-Webhook-Dispatcher/2.0',
    'X-Zaza-Signature': `sha256=${signature}`,
    'X-Zaza-Timestamp': String(timestamp),
    'X-Zaza-Event': event.type,
    'X-Zaza-Event-Id': event.id,
    'X-Zaza-Delivery-Id': deliveryId
  };

  try {
    const res = await axios.post(webhookUrl, event, {
      headers: requestHeaders,
      timeout: 5000,
      maxRedirects: 0, // Protección estricta anti-SSRF de redirecciones
      validateStatus: (status) => status >= 200 && status < 300
    });

    const latencyMs = Date.now() - startTime;
    console.log(`🚀 [OutboundWebhook] Evento ${event.type} entregado a ${event.instanceName} (${latencyMs}ms, HTTP ${res.status})`);

    // Registrar entrega exitosa en Base de Datos
    pool.query(`
      INSERT INTO webhook_deliveries (
        id, user_id, instance_name, event_id, delivery_id, event_type,
        target_url, status, http_status, latency_ms, attempts,
        request_headers, payload, response_body, is_replay, created_at, last_attempt_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'DELIVERED', $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [
      deliveryId,
      event.tenantId || null,
      event.instanceName,
      event.id,
      deliveryId,
      event.type,
      webhookUrl,
      res.status,
      latencyMs,
      job.attemptsMade + 1,
      JSON.stringify(requestHeaders),
      JSON.stringify(event),
      typeof res.data === 'string' ? res.data.substring(0, 1000) : JSON.stringify(res.data).substring(0, 1000),
      isReplay || false
    ]).catch(() => {});

  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    const statusCode = err.response?.status || 500;
    const errorMsg = err.message || 'Error de conexión con ERP';
    console.warn(`⚠️ [OutboundWebhook] Intento ${job.attemptsMade + 1}/4 falló para ${event.instanceName} (HTTP ${statusCode}, ${latencyMs}ms): ${errorMsg}`);

    // Registrar o actualizar entrega fallida en Base de Datos
    pool.query(`
      INSERT INTO webhook_deliveries (
        id, user_id, instance_name, event_id, delivery_id, event_type,
        target_url, status, http_status, latency_ms, attempts,
        request_headers, payload, error_message, is_replay, created_at, last_attempt_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'FAILED', $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [
      deliveryId,
      event.tenantId || null,
      event.instanceName,
      event.id,
      deliveryId,
      event.type,
      webhookUrl,
      statusCode,
      latencyMs,
      job.attemptsMade + 1,
      JSON.stringify(requestHeaders),
      JSON.stringify(event),
      errorMsg,
      isReplay || false
    ]).catch(() => {});

    throw err; // Provoca el reintento automático con backoff exponencial
  }
}, {
  connection: connectionConfig,
  concurrency: 10
});

outboundWorker.on('failed', (job, err) => {
  if (job && job.attemptsMade >= 4) {
    console.error(`❌ [OutboundWebhook] Entrega FAILED definitivamente para evento ${job.data?.event?.id} en ${job.data?.event?.instanceName}: ${err.message}`);
  }
});

export class WebhookDispatcherService {
  /**
   * Mapea un evento nativo de Evolution API / Go a un evento canónico de Zaza Click
   */
  public static normalizeEventType(rawEvent: string): string {
    const clean = (rawEvent || '').toUpperCase().replace(/[.-]/g, '_');
    switch (clean) {
      case 'MESSAGES_UPSERT':
      case 'MESSAGES_RECEIVE':
      case 'MESSAGE_RECEIVED':
        return 'MESSAGE_RECEIVED';
      case 'MESSAGES_UPDATE':
      case 'MESSAGE_STATUS':
        return 'MESSAGE_STATUS_UPDATE';
      case 'CONNECTION_UPDATE':
      case 'CONNECTION':
        return 'CONNECTION_UPDATE';
      case 'QRCODE_UPDATED':
      case 'QR_UPDATE':
        return 'QRCODE_UPDATED';
      case 'CHATS_UPDATE':
      case 'CHATS_SET':
        return 'CHATS_UPDATE';
      case 'CONTACTS_UPSERT':
      case 'CONTACTS_UPDATE':
        return 'CONTACTS_UPDATE';
      case 'PRESENCE_UPDATE':
        return 'PRESENCE_UPDATE';
      default:
        return clean;
    }
  }

  /**
   * Despacha un evento hacia el ERP configurado para la instancia si existe
   */
  public static async dispatchEvent(instanceName: string, rawEvent: string, rawData: any): Promise<void> {
    try {
      // 1. Consultar configuración de webhook en PostgreSQL (con caché Redis de 60s)
      const cacheKey = `inst_wh:${instanceName}`;
      let configJson = await redis.get(cacheKey);
      let config: { webhook_url?: string; webhook_secret?: string; webhook_enabled?: boolean; user_id?: string; engine_type?: string } | null = null;

      if (configJson) {
        config = JSON.parse(configJson);
      } else {
        const dbRes = await pool.query(
          'SELECT webhook_url, webhook_secret, webhook_enabled, user_id, engine_type FROM instances WHERE instance_name = $1 LIMIT 1',
          [instanceName]
        );
        if (dbRes.rows.length > 0) {
          config = dbRes.rows[0];
          await redis.set(cacheKey, JSON.stringify(config), 'EX', 60);
        }
      }

      if (!config || !config.webhook_url || config.webhook_enabled === false) {
        return; // No hay webhook configurado por el cliente para esta instancia
      }

      // 2. Construir evento canónico normalizado
      const canonicalType = this.normalizeEventType(rawEvent);
      const eventId = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      const canonicalEvent: CanonicalWebhookEvent = {
        id: eventId,
        type: canonicalType,
        timestamp: Math.floor(Date.now() / 1000),
        instanceName,
        tenantId: config.user_id,
        engine: config.engine_type || 'evolution_api',
        data: rawData
      };

      // 3. Encolar en BullMQ para entrega asíncrona confiable
      await outboundWebhookQueue.add(`dispatch_${instanceName}_${canonicalType}`, {
        webhookUrl: config.webhook_url,
        webhookSecret: config.webhook_secret,
        event: canonicalEvent
      });

    } catch (err: any) {
      console.warn(`[WebhookDispatcher] Error despachando evento para ${instanceName}:`, err.message);
    }
  }

  /**
   * Obtiene la lista de entregas de webhooks para el portal de desarrolladores
   */
  public static async getDeliveries(userId: string, limit: number = 30, offset: number = 0) {
    const res = await pool.query(`
      SELECT id, instance_name, event_id, delivery_id, event_type, target_url,
             status, http_status, latency_ms, attempts, request_headers,
             payload, response_body, error_message, is_replay, created_at, last_attempt_at
      FROM webhook_deliveries
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `, [userId, limit, offset]);

    const countRes = await pool.query(`SELECT COUNT(*) FROM webhook_deliveries WHERE user_id = $1`, [userId]);

    return {
      total: parseInt(countRes.rows[0].count, 10),
      limit,
      offset,
      deliveries: res.rows.map(r => ({
        id: r.id,
        instanceName: r.instance_name,
        eventId: r.event_id,
        deliveryId: r.delivery_id,
        eventType: r.event_type,
        targetUrl: r.target_url,
        status: r.status,
        httpStatus: r.http_status,
        latencyMs: r.latency_ms,
        attempts: r.attempts,
        requestHeaders: typeof r.request_headers === 'string' ? JSON.parse(r.request_headers) : r.request_headers,
        payload: typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload,
        responseBody: r.response_body,
        errorMessage: r.error_message,
        isReplay: r.is_replay,
        createdAt: r.created_at ? r.created_at.toISOString() : new Date().toISOString(),
        lastAttemptAt: r.last_attempt_at ? r.last_attempt_at.toISOString() : new Date().toISOString()
      }))
    };
  }

  /**
   * Reejecuta la entrega de un webhook histórico (Webhook Replay)
   */
  public static async replayDelivery(userId: string, deliveryId: string) {
    const res = await pool.query(`
      SELECT d.*, i.webhook_secret
      FROM webhook_deliveries d
      JOIN instances i ON d.instance_name = i.instance_name
      WHERE d.id = $1 AND d.user_id = $2
      LIMIT 1
    `, [deliveryId, userId]);

    if (res.rows.length === 0) {
      throw new Error('Entrega de webhook no encontrada o no pertenece al usuario.');
    }

    const row = res.rows[0];
    const event = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;

    // Despachar inmediatamente como Replay
    const newDeliveryId = `del_replay_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const timestamp = Math.floor(Date.now() / 1000);
    const rawBody = JSON.stringify(event);
    const signature = crypto.createHmac('sha256', row.webhook_secret || 'default_secret').update(`${timestamp}.${rawBody}`).digest('hex');

    const startTime = Date.now();
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'ZazaClick-Webhook-Dispatcher/2.0 (Replay)',
      'X-Zaza-Signature': `sha256=${signature}`,
      'X-Zaza-Timestamp': String(timestamp),
      'X-Zaza-Event': event.type,
      'X-Zaza-Event-Id': event.id,
      'X-Zaza-Delivery-Id': newDeliveryId,
      'X-Zaza-Replay': 'true'
    };

    try {
      const httpRes = await axios.post(row.target_url, event, {
        headers,
        timeout: 5000,
        maxRedirects: 0,
        validateStatus: (s) => s >= 200 && s < 300
      });

      const latencyMs = Date.now() - startTime;

      await pool.query(`
        INSERT INTO webhook_deliveries (
          id, user_id, instance_name, event_id, delivery_id, event_type,
          target_url, status, http_status, latency_ms, attempts,
          request_headers, payload, response_body, is_replay, created_at, last_attempt_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'DELIVERED', $8, $9, 1, $10, $11, $12, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, [
        newDeliveryId,
        userId,
        row.instance_name,
        event.id,
        newDeliveryId,
        event.type,
        row.target_url,
        httpRes.status,
        latencyMs,
        JSON.stringify(headers),
        JSON.stringify(event),
        typeof httpRes.data === 'string' ? httpRes.data.substring(0, 1000) : JSON.stringify(httpRes.data).substring(0, 1000)
      ]);

      return {
        success: true,
        deliveryId: newDeliveryId,
        httpStatus: httpRes.status,
        latencyMs,
        responseBody: httpRes.data
      };
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      const statusCode = err.response?.status || 500;

      await pool.query(`
        INSERT INTO webhook_deliveries (
          id, user_id, instance_name, event_id, delivery_id, event_type,
          target_url, status, http_status, latency_ms, attempts,
          request_headers, payload, error_message, is_replay, created_at, last_attempt_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'FAILED', $8, $9, 1, $10, $11, $12, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, [
        newDeliveryId,
        userId,
        row.instance_name,
        event.id,
        newDeliveryId,
        event.type,
        row.target_url,
        statusCode,
        latencyMs,
        JSON.stringify(headers),
        JSON.stringify(event),
        err.message
      ]);

      return {
        success: false,
        deliveryId: newDeliveryId,
        httpStatus: statusCode,
        latencyMs,
        error: err.message
      };
    }
  }

  /**
   * Envía un evento de prueba en vivo para verificar la conexión y la validación de firma HMAC en el ERP
   */
  public static async sendTestEvent(userId: string, instanceName: string, eventType: string = 'MESSAGE_RECEIVED') {
    const instRes = await pool.query(
      `SELECT webhook_url, webhook_secret, webhook_enabled, engine_type FROM instances WHERE user_id = $1 AND instance_name = $2 LIMIT 1`,
      [userId, instanceName]
    );

    if (instRes.rows.length === 0 || !instRes.rows[0].webhook_url) {
      throw new Error(`La instancia ${instanceName} no tiene una URL de webhook configurada.`);
    }

    const { webhook_url, webhook_secret, engine_type } = instRes.rows[0];

    const testEventId = `evt_test_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const timestamp = Math.floor(Date.now() / 1000);
    const deliveryId = `del_test_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    let sampleData: any = {};
    if (eventType === 'MESSAGE_RECEIVED') {
      sampleData = {
        key: { remoteJid: '51999888777@s.whatsapp.net', fromMe: false, id: 'TEST_MSG_12345' },
        pushName: 'Cliente de Prueba (ERP)',
        message: { conversation: 'Hola, este es un evento de prueba emitido desde Zaza Click Developer Portal.' },
        messageTimestamp: timestamp
      };
    } else if (eventType === 'CONNECTION_UPDATE') {
      sampleData = { state: 'open', statusReason: 200 };
    } else if (eventType === 'QRCODE_UPDATED') {
      sampleData = { qrcode: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAADIC...', attempt: 1 };
    } else {
      sampleData = { status: 'TEST_EVENT_OK', timestamp };
    }

    const canonicalEvent: CanonicalWebhookEvent = {
      id: testEventId,
      type: eventType,
      timestamp,
      instanceName,
      tenantId: userId,
      engine: engine_type || 'evolution_api',
      data: sampleData
    };

    const rawBody = JSON.stringify(canonicalEvent);
    const signature = crypto.createHmac('sha256', webhook_secret || 'default_secret').update(`${timestamp}.${rawBody}`).digest('hex');

    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'ZazaClick-Webhook-Tester/2.0',
      'X-Zaza-Signature': `sha256=${signature}`,
      'X-Zaza-Timestamp': String(timestamp),
      'X-Zaza-Event': eventType,
      'X-Zaza-Event-Id': testEventId,
      'X-Zaza-Delivery-Id': deliveryId,
      'X-Zaza-Test': 'true'
    };

    const startTime = Date.now();

    try {
      const res = await axios.post(webhook_url, canonicalEvent, {
        headers,
        timeout: 5000,
        maxRedirects: 0,
        validateStatus: (s) => s >= 200 && s < 300
      });

      const latencyMs = Date.now() - startTime;

      // Registrar en log
      pool.query(`
        INSERT INTO webhook_deliveries (
          id, user_id, instance_name, event_id, delivery_id, event_type,
          target_url, status, http_status, latency_ms, attempts,
          request_headers, payload, response_body, is_replay, created_at, last_attempt_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'DELIVERED', $8, $9, 1, $10, $11, $12, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, [
        deliveryId,
        userId,
        instanceName,
        testEventId,
        deliveryId,
        eventType,
        webhook_url,
        res.status,
        latencyMs,
        JSON.stringify(headers),
        rawBody,
        typeof res.data === 'string' ? res.data.substring(0, 1000) : JSON.stringify(res.data).substring(0, 1000)
      ]).catch(() => {});

      return {
        success: true,
        deliveryId,
        httpStatus: res.status,
        latencyMs,
        targetUrl: webhook_url,
        signatureHeader: `sha256=${signature}`,
        responseBody: res.data
      };
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      const statusCode = err.response?.status || 500;

      pool.query(`
        INSERT INTO webhook_deliveries (
          id, user_id, instance_name, event_id, delivery_id, event_type,
          target_url, status, http_status, latency_ms, attempts,
          request_headers, payload, error_message, is_replay, created_at, last_attempt_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'FAILED', $8, $9, 1, $10, $11, $12, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, [
        deliveryId,
        userId,
        instanceName,
        testEventId,
        deliveryId,
        eventType,
        webhook_url,
        statusCode,
        latencyMs,
        JSON.stringify(headers),
        rawBody,
        err.message
      ]).catch(() => {});

      return {
        success: false,
        deliveryId,
        httpStatus: statusCode,
        latencyMs,
        targetUrl: webhook_url,
        signatureHeader: `sha256=${signature}`,
        error: err.message,
        responseBody: err.response?.data || null
      };
    }
  }
}
