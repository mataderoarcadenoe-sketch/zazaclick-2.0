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
  const { webhookUrl, webhookSecret, event } = job.data as {
    webhookUrl: string;
    webhookSecret: string;
    event: CanonicalWebhookEvent;
  };

  const timestamp = Math.floor(Date.now() / 1000);
  const rawBody = JSON.stringify(event);
  const signaturePayload = `${timestamp}.${rawBody}`;
  const signature = crypto.createHmac('sha256', webhookSecret || 'default_secret').update(signaturePayload).digest('hex');
  const deliveryId = `del_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  const startTime = Date.now();

  try {
    const res = await axios.post(webhookUrl, event, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ZazaClick-Webhook-Dispatcher/2.0',
        'X-Zaza-Signature': `sha256=${signature}`,
        'X-Zaza-Timestamp': String(timestamp),
        'X-Zaza-Event': event.type,
        'X-Zaza-Event-Id': event.id,
        'X-Zaza-Delivery-Id': deliveryId
      },
      timeout: 5000,
      maxRedirects: 0, // Protección estricta anti-SSRF de redirecciones
      validateStatus: (status) => status >= 200 && status < 300
    });

    const latencyMs = Date.now() - startTime;
    console.log(`🚀 [OutboundWebhook] Evento ${event.type} entregado a ${event.instanceName} (${latencyMs}ms, HTTP ${res.status})`);
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    const statusCode = err.response?.status || 500;
    console.warn(`⚠️ [OutboundWebhook] Intento ${job.attemptsMade + 1}/4 falló para ${event.instanceName} (HTTP ${statusCode}, ${latencyMs}ms): ${err.message}`);
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
}
