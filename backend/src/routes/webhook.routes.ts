import { Router } from 'express';
import redis from '../config/redis';
import { getIO } from '../config/socket';
import { EvolutionService } from '../services/evolution.service';
import pool from '../config/database';

const router = Router();

/**
 * POST /api/webhooks/whatsapp - Recibir eventos de Evolution API
 */
router.post(['/whatsapp', '/whatsapp/:event'], async (req, res) => {
  let { event, instance, data } = req.body;
  if (!event && req.params.event) {
    event = req.params.event;
  }

  if (!event || !instance || !data) {
    return res.status(200).json({ success: false, error: 'Payload de webhook incompleto' });
  }

  // No loguear cada evento de contacto para no saturar los logs
  const eventUpper = event.toUpperCase().replace('.', '_').replace('-', '_');
  if (eventUpper !== 'CONTACTS_UPSERT' && eventUpper !== 'CONTACTS_UPDATE') {
    console.log(`📬 [Webhook] Recibido evento "${event}" para la instancia "${instance}"`);
  }

  try {
    const io = getIO();
    const roomName = `instance_${instance}`;

    if (eventUpper === 'MESSAGES_UPSERT') {
      // En Evolution API v2, data contiene el objeto del mensaje completo de Baileys
      // data.key tiene las propiedades fromMe, remoteJid, id
      // data.message tiene el contenido del mensaje
      const key = data.key;
      if (key) {
        const fromMe = key.fromMe;
        const remoteJid = key.remoteJid;
        const msgId = key.id;

        console.log(`📬 [Webhook] Procesando mensaje. id: ${msgId}, fromMe: ${fromMe}, remoteJid: ${remoteJid}`);

        let cleanJid = remoteJid.replace(/:\d+@s\.whatsapp\.net/g, '@s.whatsapp.net');

        // Deduplicación preventiva por ID de mensaje
        let isDuplicate = false;
        if (msgId) {
          const dupKey = `dup:${instance}:${msgId}`;
          // Usar SET con NX y PX para crear la clave solo si no existe, expirando en 15 segundos
          const setDup = await redis.set(dupKey, '1', 'PX', 15000, 'NX');
          if (setDup !== 'OK') {
            isDuplicate = true;
            console.log(`⏭️ [Webhook] Mensaje duplicado omitido: ${msgId}`);
          }
        }

        // Si es un mensaje nuevo entrante y no es un duplicado, incrementamos contador en Redis
        if (!fromMe && remoteJid && !isDuplicate) {
          const redisKey = `unread:${instance}:${cleanJid}`;
          await redis.incr(redisKey);
          const newCount = await redis.get(redisKey);

          console.log(`📈 [Webhook] Incrementado no leídos para ${cleanJid} en ${instance} a ${newCount}`);

          // Emitir el cambio del contador de no leídos a la sala
          io.to(roomName).emit('unread_update', {
            remoteJid: cleanJid,
            unreadCount: Number(newCount) || 0
          });
        }

        // Emitir el mensaje recibido para que la UI lo pinte al instante si no es un duplicado de renderizado
        if (!isDuplicate) {
          io.to(roomName).emit('message:received', data);
        }
      } else {
        console.warn('⚠️ [Webhook] No se pudo extraer la propiedad "key" de data:', data);
      }
    } 
    else if (eventUpper === 'CONNECTION_UPDATE') {
      const connection = data.connection;
      if (connection) {
        const isConnected = connection === 'open';
        const dbStatus = isConnected ? 'connected' : 'disconnected';
        
        console.log(`🔌 [Webhook] CONNECTION_UPDATE para "${instance}": ${connection} -> ${dbStatus}`);
        
        // Actualizar en la BD
        pool.query(
          'UPDATE instances SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE instance_name = $2',
          [dbStatus, instance]
        ).catch(err => {
          console.error(`[Webhook] Error actualizando estado de conexión de ${instance}:`, err.message);
        });
        
        // Emitir a la sala de Socket.io
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
        console.log(`📷 [Webhook] QRCODE_UPDATED para la instancia "${instance}"`);
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

            console.log(`📉 [Webhook] CHATS_UPDATE: Limpiado no leídos para ${cleanJid} en ${instance}`);

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
          // status === 3 significa READ (leído) en Baileys/WhatsApp
          const isRead = update.update?.status === 3 || update.status === 'READ' || update.unreadCount === 0;
          if (isRead) {
            const redisKey = `unread:${instance}:${cleanJid}`;
            await redis.set(redisKey, 0);

            console.log(`📉 [Webhook] MESSAGES_UPDATE: Limpiado no leídos para ${cleanJid} en ${instance}`);

            io.to(roomName).emit('unread_update', {
              remoteJid: cleanJid,
              unreadCount: 0
            });
          }
        }
      }
    }
    else if (eventUpper === 'CONTACTS_UPSERT' || eventUpper === 'CONTACTS_UPDATE') {
      // Procesar sincronización de nombres de contactos (agenda y pushName)
      const contacts = Array.isArray(data) ? data : [data];
      let savedCount = 0;
      
      for (const contact of contacts) {
        const jid = contact.id || contact.remoteJid;
        if (!jid) continue;
        
        // 'name' = nombre guardado en la agenda del celular (si llega)
        // 'notify' = pushName / nombre de perfil de WhatsApp
        const agendaName = contact.name || undefined;
        const notifyName = contact.notify || contact.pushName || undefined;
        
        if (agendaName || notifyName) {
          await EvolutionService.saveContactName(instance, jid, agendaName, notifyName);
          savedCount++;
        }
      }
      
      if (savedCount > 0) {
        console.log(`📇 [Webhook] CONTACTS_UPSERT: ${savedCount} contactos procesados para ${instance}`);
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
          console.log(`📬 [Webhook] PRESENCE_UPDATE: JID ${cleanJid} -> ${status} en la instancia ${instance}`);
          
          io.to(roomName).emit('presence_update', {
            remoteJid: cleanJid,
            status: status
          });
        }
      }
    }

    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('⚠️ [Webhook] Error al procesar evento:', error.message);
    // Devolvemos 200 igualmente para no reintentar webhook fallido indefinidamente
    res.status(200).json({ success: false, error: error.message });
  }
});

export default router;
