import { Queue, Worker, Job } from 'bullmq';
import redis from '../config/redis';
import { getIO } from '../config/socket';
import pool from '../config/database';
import { WebhookDispatcherService } from '../services/webhook-dispatcher.service';

const redisUrl = process.env.REDIS_PRIVATE_URL || process.env.REDIS_URL;
const connectionConfig: any = redisUrl ? { url: redisUrl, maxRetriesPerRequest: null } : {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null
};

// Crear la cola de tareas
export const webhookQueue = new Queue('webhook-queue', {
  connection: connectionConfig
});

// Normalizar JID eliminando sufijos de dispositivo (:0@s.whatsapp.net -> @s.whatsapp.net)
function normalizeJid(jid: string): string {
  if (!jid) return jid;
  return jid.replace(/:\d+@s\.whatsapp\.net/g, '@s.whatsapp.net');
}

// Crear el procesador (Worker) de la cola
const worker = new Worker('webhook-queue', async (job: Job) => {
  const { event, instance, data } = job.data;
  const eventUpper = event.toUpperCase().replace('.', '_').replace('-', '_');
  const roomName = `instance_${instance}`;
  const io = getIO();

  console.log(`📨 [QueueWorker] Procesando evento encolado: ${eventUpper} para ${instance}`);

  try {
    if (eventUpper === 'MESSAGES_UPSERT' || eventUpper === 'MESSAGE' || eventUpper === 'MESSAGES_RECEIVE') {
      const msgId = data?.key?.id || data?.Info?.ID || data?.id;
      let isDuplicate = false;

      if (msgId) {
        const dupKey = `dup:${instance}:${msgId}`;
        const setDup = await redis.set(dupKey, '1', 'PX', 15000, 'NX');
        if (setDup !== 'OK') {
          isDuplicate = true;
        }
      }

      if (isDuplicate) {
        console.log(`⚠️ [QueueWorker] Mensaje duplicado omitido: ${msgId}`);
        return;
      }

      const remoteJid = data?.key?.remoteJid || data?.Info?.Chat || data?.Info?.Sender;
      if (remoteJid) {
        const cleanJid = normalizeJid(remoteJid);
        
        // Actualizar el JID en el mensaje para que el frontend/ERP reciba el número limpio
        if (data?.key) {
          data.key.remoteJid = cleanJid;
        }

        // Emitir mensaje por Socket.io
        io.to(roomName).emit('message:received', data);
        
        // Incrementar contador de no leídos en Redis si el mensaje no es saliente (fromMe !== true)
        const isFromMe = Boolean(data?.key?.fromMe ?? data?.Info?.IsFromMe);
        if (!isFromMe) {
          const redisKey = `unread:${instance}:${cleanJid}`;
          await redis.incr(redisKey);
          await redis.expire(redisKey, 86400 * 30); // 30 días de TTL para prevenir fugas de memoria
          
          const countVal = await redis.get(redisKey);
          io.to(roomName).emit('unread_update', {
            remoteJid: cleanJid,
            unreadCount: Number(countVal) || 0
          });
        }
      }
    } 
    else if (
      eventUpper === 'CONNECTION_UPDATE' ||
      eventUpper === 'CONNECTION' ||
      eventUpper === 'CONNECTED' ||
      eventUpper === 'PAIR_SUCCESS' ||
      eventUpper === 'DISCONNECTED' ||
      eventUpper === 'LOGGED_OUT'
    ) {
      const connection = data?.connection || (eventUpper === 'CONNECTED' || eventUpper === 'PAIR_SUCCESS' ? 'open' : (eventUpper === 'LOGGED_OUT' || eventUpper === 'DISCONNECTED' ? 'close' : data?.state));
      if (connection) {
        // Ignorar transiciones intermedias 'connecting' durante la generación/escaneo de QR
        if (connection === 'connecting') {
          return;
        }

        const isConnected = connection === 'open' || connection === 'connected' || data?.LoggedIn === true;
        const reasonCode = data?.disconnectionReasonCode || data?.reason || data?.statusCode || data?.disconnectionObject?.output?.statusCode;
        const isDeviceRemoved = eventUpper === 'LOGGED_OUT' || reasonCode === 401 || data?.disconnectionObject?.attrs?.type === 'device_removed';

        // Verificar si la instancia ya tenía un JID vinculado en base de datos
        const instCheck = await pool.query('SELECT jid, qrcode FROM instances WHERE instance_name = $1 OR name = $1 LIMIT 1', [instance]);
        const hasPairedJid = Boolean(instCheck.rows[0]?.jid);
        const hasActiveQr = Boolean(instCheck.rows[0]?.qrcode && String(instCheck.rows[0]?.qrcode).length > 10);

        if (!isConnected && (!hasPairedJid || hasActiveQr) && !isDeviceRemoved) {
          // La instancia aún no ha sido vinculada o está esperando escaneo de QR: no interferir con el socket
          return;
        }

        let dbStatus = 'reconnecting';
        if (isConnected) {
          dbStatus = 'connected';
        } else if (isDeviceRemoved) {
          // Cierre de sesión voluntario explícito por parte del usuario en el teléfono móvil
          dbStatus = 'logged_out';
        } else {
          // Desconexión temporal/recuperable por red o reposo del teléfono (408, 515, close, etc.)
          dbStatus = 'reconnecting';
        }
        
        console.log(`🔌 [QueueWorker] CONNECTION_UPDATE para "${instance}": connection=${connection}, reason=${reasonCode || 'N/A'} -> dbStatus=${dbStatus}`);
        
        await pool.query(
          'UPDATE instances SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE instance_name = $2 OR name = $2',
          [dbStatus, instance]
        );
        
        io.to(roomName).emit('connection_status', {
          instance: instance,
          status: dbStatus,
          connectionState: connection,
          reasonCode: reasonCode || null
        });

        // Si fue una desconexión recuperable de una sesión ya vinculada, verificar estado tras backoff
        if (!isConnected && !isDeviceRemoved && hasPairedJid) {
          setTimeout(async () => {
            const lockKey = `lock:reconnect:${instance}`;
            try {
              // Mutex distribuido en Redis para evitar tormenta de reinicios concurrentes
              const acquired = await redis.set(lockKey, '1', 'PX', 45000, 'NX');
              if (acquired !== 'OK') {
                return; // Ya hay un ciclo de reconexión activo para esta instancia
              }

              const { engineRouter } = await import('../engines/core/EngineRouter');
              const engine = await engineRouter.getEngineForInstance(instance);

              // 1. Verificar si ya se auto-reconectó por sí solo durante los 12 segundos
              const liveState = await engine.getConnectionState(instance);
              if (liveState.data?.isConnected) {
                await pool.query("UPDATE instances SET status = 'connected', updated_at = CURRENT_TIMESTAMP WHERE instance_name = $1 OR name = $1", [instance]);
                io.to(roomName).emit('connection_status', { instance, status: 'connected', connectionState: 'open' });
                console.log(`✅ [QueueWorker] Instancia "${instance}" recuperada automáticamente.`);
                await redis.del(lockKey);
                return;
              }

              // 2. Si sigue caída, ejecutar reinicio silencioso de socket con credenciales guardadas
              if (typeof (engine as any).reconnect === 'function') {
                console.log(`🔄 [QueueWorker] Centinela: Reactivando silenciosamente instancia "${instance}"...`);
                const recRes = await (engine as any).reconnect(instance);
                if (recRes.data?.isConnected) {
                  await pool.query("UPDATE instances SET status = 'connected', updated_at = CURRENT_TIMESTAMP WHERE instance_name = $1 OR name = $1", [instance]);
                  io.to(roomName).emit('connection_status', { instance, status: 'connected', connectionState: 'open' });
                  console.log(`✅ [QueueWorker] Instancia "${instance}" auto-reconectada con éxito.`);
                }
              }
            } catch (recErr: any) {
              console.warn(`[QueueWorker] Reintento de auto-reconexión para "${instance}" falló:`, recErr.message);
            } finally {
              try {
                await redis.del(lockKey);
              } catch {}
            }
          }, 12000);
        }
      }
    }
    else if (eventUpper === 'QRCODE_UPDATED' || eventUpper === 'QRCODE' || eventUpper === 'QR') {
      const qrcode = data?.qrcode || data;
      const rawBase64 = typeof qrcode === 'string' ? qrcode : (qrcode?.base64 || qrcode?.qrcode);
      const base64 = rawBase64 ? String(rawBase64).split('|')[0] : null;
      if (base64) {
        console.log(`📷 [QueueWorker] QRCODE_UPDATED para la instancia "${instance}"`);
        io.to(roomName).emit('qrcode_updated', {
          instance: instance,
          qrcode: base64
        });
      }
    }
    else if (eventUpper === 'CHATS_UPDATE') {
      const chatUpdates = Array.isArray(data) ? data : [data];
      for (const update of chatUpdates) {
        const remoteJid = update.id || update.remoteJid;
        if (remoteJid) {
          const cleanJid = normalizeJid(remoteJid);
          if (update.id) update.id = cleanJid;
          if (update.remoteJid) update.remoteJid = cleanJid;
          if (update.unreadCount === 0 || update.unreadMessages === 0) {
            const redisKey = `unread:${instance}:${cleanJid}`;
            await redis.del(redisKey);

            io.to(roomName).emit('unread_update', {
              remoteJid: cleanJid,
              unreadCount: 0
            });
          }
        }
      }
    }
    else if (eventUpper === 'MESSAGES_UPDATE') {
      const msgUpdates = Array.isArray(data) ? data : [data];
      for (const update of msgUpdates) {
        const remoteJid = update.key?.remoteJid || update.remoteJid;
        if (remoteJid) {
          const cleanJid = normalizeJid(remoteJid);
          if (update.key) update.key.remoteJid = cleanJid;
          if (update.remoteJid) update.remoteJid = cleanJid;
          const isRead = update.update?.status === 3 || update.status === 'READ' || update.unreadCount === 0;
          if (isRead) {
            const redisKey = `unread:${instance}:${cleanJid}`;
            await redis.set(redisKey, 0);

            io.to(roomName).emit('unread_update', {
              remoteJid: cleanJid,
              unreadCount: 0
            });
          }
        }
      }
    }
    else if (eventUpper === 'PRESENCE_UPDATE') {
      const remoteJid = data.id || data.remoteJid;
      if (remoteJid && data.presences) {
        const cleanJid = normalizeJid(remoteJid);
        if (data.id) data.id = cleanJid;
        if (data.remoteJid) data.remoteJid = cleanJid;
        const jids = Object.keys(data.presences);
        const targetKey = jids.find(k => k.includes(cleanJid.split('@')[0])) || jids[0];
        
        if (targetKey && data.presences[targetKey]) {
          const status = data.presences[targetKey].lastKnownPresence;
          io.to(roomName).emit('presence_update', {
            remoteJid: cleanJid,
            status: status
          });
        }
      }
    }

    // Despacho asíncrono y seguro hacia el ERP del cliente con firma HMAC
    await WebhookDispatcherService.dispatchEvent(instance, event, data);

  } catch (err: any) {
    console.error(`❌ [QueueWorker] Error procesando evento ${eventUpper}:`, err.message);
    throw err; // Permite reintentar si el error es transitorio
  }
}, {
  connection: connectionConfig,
  concurrency: 5 // Procesar hasta 5 tareas en paralelo en este worker
});

worker.on('failed', (job: Job | undefined, err: Error) => {
  console.error(`❌ [QueueWorker] Job ${job?.id} falló con error:`, err.message);
});

worker.on('completed', (job: Job) => {
  // Opcional log
});
