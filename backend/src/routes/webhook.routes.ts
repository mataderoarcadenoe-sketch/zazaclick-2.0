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

  try {
    const io = getIO();
    const roomName = `instance_${instance}`;

    if (event === 'messages.upsert') {
      const msg = data.message || data;
      const key = msg.key;
      if (key) {
        const fromMe = key.fromMe;
        const remoteJid = key.remoteJid;

        // Limpiar el JID
        let cleanJid = remoteJid;
        if (cleanJid.includes(':0@s.whatsapp.net')) {
          cleanJid = cleanJid.replace(':0@s.whatsapp.net', '@s.whatsapp.net');
        }

        // Si es un mensaje nuevo entrante, incrementamos contador en Redis
        if (!fromMe && remoteJid) {
          const redisKey = `unread:${instance}:${cleanJid}`;
          await redis.incr(redisKey);
          const newCount = await redis.get(redisKey);

          // Emitir el cambio del contador de no leídos a la sala
          io.to(roomName).emit('unread_update', {
            remoteJid: cleanJid,
            unreadCount: Number(newCount) || 0
          });
        }

        // Emitir el mensaje recibido para que la UI lo pinte al instante
        io.to(roomName).emit('message:received', msg);
      }
    } 
    else if (event === 'chats.update') {
      const chatUpdates = Array.isArray(data) ? data : [data];
      for (const update of chatUpdates) {
        const remoteJid = update.id || update.remoteJid;
        if (remoteJid) {
          let cleanJid = remoteJid;
          if (cleanJid.includes(':0@s.whatsapp.net')) {
            cleanJid = cleanJid.replace(':0@s.whatsapp.net', '@s.whatsapp.net');
          }

          // Si el unreadCount viene en 0
          if (update.unreadCount === 0 || update.unreadMessages === 0) {
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

    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('⚠️ [Webhook] Error al procesar evento:', error.message);
    // Devolvemos 200 igualmente para no reintentar webhook fallido indefinidamente
    res.status(200).json({ success: false, error: error.message });
  }
});

export default router;
