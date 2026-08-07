import { Queue, Worker, Job } from 'bullmq';
import redis from '../config/redis';
import { getIO } from '../config/socket';
import pool from '../config/database';
import { EvolutionService } from '../services/evolution.service';

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

// Crear el procesador (Worker) de la cola
const worker = new Worker('webhook-queue', async (job: Job) => {
  const { event, instance, data } = job.data;
  const eventUpper = event.toUpperCase().replace('.', '_').replace('-', '_');
  const roomName = `instance:${instance}`;
  const io = getIO();

  console.log(`默默 [QueueWorker] Procesando evento encolado: ${eventUpper} para ${instance}`);

  try {
    if (eventUpper === 'MESSAGES_UPSERT') {
      const msgId = data.key?.id;
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

      const remoteJid = data.key?.remoteJid;
      if (remoteJid) {
        let cleanJid = remoteJid.replace(/:\d+@s\.whatsapp\.net/g, '@s.whatsapp.net');
        
        // Caching automático del nombre si viene en pushName / notify
        const pushName = data.pushName || data.key?.pushName;
        if (pushName) {
          await EvolutionService.saveContactName(instance, cleanJid, undefined, pushName);
        }

        // Emitir mensaje por Socket.io
        io.to(roomName).emit('message:received', data);
        
        // Incrementar contador de no leídos en Redis si el mensaje no es del asesor (fromMe !== true)
        if (!data.key.fromMe) {
          const redisKey = `unread:${instance}:${cleanJid}`;
          await redis.incr(redisKey);
          
          const countVal = await redis.get(redisKey);
          io.to(roomName).emit('unread_update', {
            remoteJid: cleanJid,
            unreadCount: Number(countVal) || 0
          });
        }
      }
    } 
    else if (eventUpper === 'CONNECTION_UPDATE') {
      const connection = data.connection;
      if (connection) {
        const isConnected = connection === 'open';
        const dbStatus = isConnected ? 'connected' : 'disconnected';
        
        console.log(`🔌 [QueueWorker] CONNECTION_UPDATE para "${instance}": ${connection} -> ${dbStatus}`);
        
        await pool.query(
          'UPDATE instances SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE instance_name = $2',
          [dbStatus, instance]
        );
        
        io.to(roomName).emit('connection_status', {
          instance: instance,
          status: dbStatus,
          connectionState: connection
        });
      }
    }
    else if (eventUpper === 'QRCODE_UPDATED') {
      const qrcode = data.qrcode || data;
      const base64 = qrcode.base64;
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
          let cleanJid = remoteJid.replace(/:\d+@s\.whatsapp\.net/g, '@s.whatsapp.net');
          if (update.unreadCount === 0 || update.unreadMessages === 0) {
            const redisKey = `unread:${instance}:${cleanJid}`;
            await redis.set(redisKey, 0);

            console.log(`📉 [QueueWorker] CHATS_UPDATE: Limpiado no leídos para ${cleanJid} en ${instance}`);

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
          let cleanJid = remoteJid.replace(/:\d+@s\.whatsapp\.net/g, '@s.whatsapp.net');
          const isRead = update.update?.status === 3 || update.status === 'READ' || update.unreadCount === 0;
          if (isRead) {
            const redisKey = `unread:${instance}:${cleanJid}`;
            await redis.set(redisKey, 0);

            console.log(`📉 [QueueWorker] MESSAGES_UPDATE: Limpiado no leídos para ${cleanJid} en ${instance}`);

            io.to(roomName).emit('unread_update', {
              remoteJid: cleanJid,
              unreadCount: 0
            });
          }
        }
      }
    }
    else if (eventUpper === 'CONTACTS_UPSERT' || eventUpper === 'CONTACTS_UPDATE') {
      const contacts = Array.isArray(data) ? data : [data];
      let savedCount = 0;
      
      for (const contact of contacts) {
        const jid = contact.id || contact.remoteJid;
        if (!jid) continue;
        
        const agendaName = contact.name || undefined;
        const notifyName = contact.notify || contact.pushName || undefined;
        
        if (agendaName || notifyName) {
          await EvolutionService.saveContactName(instance, jid, agendaName, notifyName);
          savedCount++;
        }
      }
      if (savedCount > 0) {
        console.log(`📇 [QueueWorker] CONTACTS_UPSERT: ${savedCount} contactos guardados en caché.`);
      }
    }
    else if (eventUpper === 'PRESENCE_UPDATE') {
      const remoteJid = data.id || data.remoteJid;
      if (remoteJid && data.presences) {
        let cleanJid = remoteJid.replace(/:\d+@s\.whatsapp\.net/g, '@s.whatsapp.net');
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
