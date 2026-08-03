import { Router } from 'express';
import redis from '../config/redis';
import { getIO } from '../config/socket';

const router = Router();

/**
 * POST /api/webhooks/whatsapp - Recibir eventos de Evolution API
 */
router.post('/whatsapp', async (req, res) => {
  const { event, instance, data } = req.body;

  if (!event || !instance || !data) {
    return res.status(200).json({ success: false, error: 'Payload de webhook incompleto' });
  }

  console.log(`📬 [Webhook] Recibido evento "${event}" para la instancia "${instance}"`);

  try {
    const io = getIO();
    const roomName = `instance_${instance}`;
    const eventUpper = event.toUpperCase().replace('.', '_');

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

        // Limpiar el JID
        let cleanJid = remoteJid;
        if (cleanJid.includes(':0@s.whatsapp.net')) {
          cleanJid = cleanJid.replace(':0@s.whatsapp.net', '@s.whatsapp.net');
        }

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
    else if (eventUpper === 'CHATS_UPDATE' || eventUpper === 'MESSAGES_UPDATE') {
      const chatUpdates = Array.isArray(data) ? data : [data];
      for (const update of chatUpdates) {
        const remoteJid = update.id || update.remoteJid;
        if (remoteJid) {
          let cleanJid = remoteJid;
          if (cleanJid.includes(':0@s.whatsapp.net')) {
            cleanJid = cleanJid.replace(':0@s.whatsapp.net', '@s.whatsapp.net');
          }

          // Si el unreadCount viene en 0
          if (update.unreadCount === 0 || update.unreadMessages === 0 || update.status === 'READ') {
            const redisKey = `unread:${instance}:${cleanJid}`;
            await redis.set(redisKey, 0);

            console.log(`📉 [Webhook] Limpiado contador de no leídos para ${cleanJid} en ${instance}`);

            io.to(roomName).emit('unread_update', {
              remoteJid: cleanJid,
              unreadCount: 0
            });
          }
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
