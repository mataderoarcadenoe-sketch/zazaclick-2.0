import { Router, Response } from 'express';
import pool from '../config/database';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.middleware';
import { EvolutionService } from '../services/evolution.service';

const router = Router();

/**
 * Generar ID aleatorio
 */
function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

/**
 * POST /create - Crear una nueva instancia de WhatsApp
 */
router.post('/create', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { instanceName } = req.body;

  if (!instanceName || !/^[a-zA-Z0-9_-]+$/.test(instanceName)) {
    return res.status(400).json({ success: false, error: 'Nombre de instancia inválido. Solo letras, números, guiones y guiones bajos.' });
  }

  try {
    // 1. Verificar límites de la suscripción del usuario
    const subRes = await pool.query(`
      SELECT p.max_instances
      FROM subscriptions s
      JOIN plans p ON s.plan_id = p.id
      WHERE s.user_id = $1 AND s.status = 'active'
      ORDER BY s.created_at DESC LIMIT 1
    `, [req.userId]);

    if (subRes.rows.length === 0) {
      return res.status(403).json({ success: false, error: 'No tienes una suscripción activa para crear instancias.' });
    }

    const maxInstances = subRes.rows[0].max_instances;

    // Contar instancias actuales creadas por el usuario
    const currentInstancesRes = await pool.query('SELECT COUNT(*) FROM instances WHERE user_id = $1', [req.userId]);
    const currentCount = parseInt(currentInstancesRes.rows[0].count);

    if (currentCount >= maxInstances) {
      return res.status(400).json({ success: false, error: `Límite alcanzado: Tu plan actual solo permite un máximo de ${maxInstances} instancia(s).` });
    }

    // 2. Verificar si el nombre de instancia ya está tomado en nuestra BD
    const nameCheck = await pool.query('SELECT id FROM instances WHERE instance_name = $1', [instanceName]);
    if (nameCheck.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'El nombre de esta instancia ya está en uso. Elige otro.' });
    }

    // 3. Crear la instancia en el motor de Evolution API
    console.log(`[Instance] Creando instancia ${instanceName} en Evolution API...`);
    const evoResult = await EvolutionService.createInstance(instanceName);

    if (!evoResult.success || !evoResult.instance) {
      const statusCode = evoResult.status || 500;
      return res.status(statusCode).json({ success: false, error: evoResult.error || 'Error al crear la instancia en Evolution API' });
    }

    // 4. Guardar la instancia en la base de datos de Zaza
    const instanceId = generateId('inst');
    const apiKey = evoResult.instance.token;

    await pool.query(`
      INSERT INTO instances (id, user_id, instance_name, status, api_key)
      VALUES ($1, $2, $3, $4, $5)
    `, [instanceId, req.userId, instanceName, 'disconnected', apiKey]);

    res.status(201).json({
      success: true,
      message: 'Instancia creada exitosamente.',
      data: {
        id: instanceId,
        instance_name: instanceName,
        status: 'disconnected',
        api_key: apiKey
      }
    });

  } catch (error: any) {
    console.error('[Instance] Error en POST /create:', error.message);
    res.status(500).json({ success: false, error: 'Error en el servidor al crear la instancia' });
  }
});

/**
 * GET /list - Listar instancias del cliente y actualizar sus estados en vivo
 */
router.get('/list', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const instancesRes = await pool.query(
      'SELECT id, instance_name, phone, status, api_key, created_at FROM instances WHERE user_id = $1 ORDER BY created_at DESC',
      [req.userId]
    );

    const updatedInstances = [];

    // Validar el estado de cada instancia con la API en vivo de Evolution
    for (const inst of instancesRes.rows) {
      const liveState = await EvolutionService.getConnectionState(inst.instance_name);
      const isConnected = liveState === 'open' || liveState === 'connected';
      const status = isConnected ? 'connected' : 'disconnected';

      if (status !== inst.status) {
        // Actualizar el estado en nuestra BD
        await pool.query('UPDATE instances SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [status, inst.id]);
        inst.status = status;
      }
      updatedInstances.push(inst);
    }

    res.json({
      success: true,
      data: updatedInstances
    });

  } catch (error: any) {
    console.error('[Instance] Error en GET /list:', error.message);
    res.status(500).json({ success: false, error: 'Error en el servidor al listar instancias' });
  }
});

/**
 * GET /qr/:instanceName - Obtener código QR para vincular
 */
router.get('/qr/:instanceName', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { instanceName } = req.params;

  try {
    // Verificar que la instancia pertenezca al usuario
    const verifyRes = await pool.query('SELECT id FROM instances WHERE user_id = $1 AND instance_name = $2', [req.userId, instanceName]);
    if (verifyRes.rows.length === 0) {
      return res.status(403).json({ success: false, error: 'Acceso no autorizado a esta instancia.' });
    }

    // Solicitar el QR a Evolution API
    const qrRes = await EvolutionService.getQRCode(instanceName);
    if (!qrRes.success || !qrRes.qrcode) {
      return res.status(500).json({ success: false, error: qrRes.error || 'Error al obtener código QR.' });
    }

    res.json({
      success: true,
      qrcode: qrRes.qrcode
    });

  } catch (error: any) {
    console.error('[Instance] Error en GET /qr:', error.message);
    res.status(500).json({ success: false, error: 'Error en el servidor al generar QR' });
  }
});

/**
 * POST /logout/:instanceName - Cerrar sesión de WhatsApp
 */
router.post('/logout/:instanceName', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { instanceName } = req.params;

  try {
    const verifyRes = await pool.query('SELECT id FROM instances WHERE user_id = $1 AND instance_name = $2', [req.userId, instanceName]);
    if (verifyRes.rows.length === 0) {
      return res.status(403).json({ success: false, error: 'Acceso no autorizado.' });
    }

    const success = await EvolutionService.logout(instanceName);
    if (success) {
      await pool.query('UPDATE instances SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE instance_name = $2', ['disconnected', instanceName]);
      return res.json({ success: true, message: 'Sesión cerrada exitosamente.' });
    }
    res.status(500).json({ success: false, error: 'No se pudo cerrar la sesión en Evolution API.' });

  } catch (error: any) {
    console.error('[Instance] Error en POST /logout:', error.message);
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

/**
 * DELETE /delete/:instanceName - Eliminar instancia
 */
router.delete('/delete/:instanceName', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { instanceName } = req.params;

  try {
    const verifyRes = await pool.query('SELECT id FROM instances WHERE user_id = $1 AND instance_name = $2', [req.userId, instanceName]);
    if (verifyRes.rows.length === 0) {
      return res.status(403).json({ success: false, error: 'Acceso no autorizado.' });
    }

    // 1. Eliminar de Evolution API
    const success = await EvolutionService.deleteInstance(instanceName);

    // 2. Eliminar de la base de datos de Zaza
    await pool.query('DELETE FROM instances WHERE instance_name = $1', [instanceName]);

    res.json({
      success: true,
      message: 'Instancia eliminada correctamente tanto en el servidor como en la base de datos.'
    });

  } catch (error: any) {
    console.error('[Instance] Error en DELETE:', error.message);
    res.status(500).json({ success: false, error: 'Error en el servidor al eliminar instancia' });
  }
});

/**
 * POST /send - Endpoint público para enviar mensajes utilizando API Key del cliente
 */
router.post('/send', async (req, res) => {
  const { instanceName, apiKey, number, text } = req.body;

  if (!instanceName || !apiKey || !number || !text) {
    return res.status(400).json({ success: false, error: 'Faltan parámetros requeridos (instanceName, apiKey, number, text)' });
  }

  try {
    // Validar las credenciales contra la BD de Zaza
    const instanceCheck = await pool.query(
      'SELECT id, status FROM instances WHERE instance_name = $1 AND api_key = $2',
      [instanceName, apiKey]
    );

    if (instanceCheck.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Credenciales de API inválidas (Nombre de instancia o API Key incorrecta)' });
    }

    // Verificar si la instancia está conectada
    const liveState = await EvolutionService.getConnectionState(instanceName);
    const isConnected = liveState === 'open' || liveState === 'connected';

    if (!isConnected) {
      return res.status(400).json({ success: false, error: 'La instancia de WhatsApp no está conectada. Escanea el código QR primero.' });
    }

    // Enviar el mensaje
    const sent = await EvolutionService.sendTextMessage(instanceName, number, text);

    if (sent) {
      return res.json({ success: true, message: 'Mensaje enviado exitosamente.' });
    }
    res.status(500).json({ success: false, error: 'Error en el servidor al enviar el mensaje de WhatsApp.' });

  } catch (error: any) {
    console.error('[Instance] Error en POST /send:', error.message);
    res.status(500).json({ success: false, error: 'Error interno en el servidor.' });
  }
});

/**
 * GET /chats/:instanceName - Obtener chats activos del usuario
 */
router.get('/chats/:instanceName', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { instanceName } = req.params;

  try {
    // Verificar propiedad de la instancia
    const verifyRes = await pool.query('SELECT id FROM instances WHERE user_id = $1 AND instance_name = $2', [req.userId, instanceName]);
    if (verifyRes.rows.length === 0) {
      return res.status(403).json({ success: false, error: 'Acceso no autorizado.' });
    }

    const chatsResult = await EvolutionService.getChats(instanceName);
    if (!chatsResult.success) {
      const statusCode = chatsResult.status === 404 ? 404 : 500;
      const cleanError = chatsResult.status === 404 ? 'La instancia de WhatsApp no está conectada o no existe.' : (chatsResult.error || 'Error al obtener chats');
      return res.status(statusCode).json({ success: false, error: cleanError });
    }

    // Filtrar broadcasts y unificar chats @lid usando la nueva utilidad
    const cleanChats = EvolutionService.mergeChats(instanceName, chatsResult.data || []);

    res.json({ success: true, data: cleanChats });
  } catch (error: any) {
    console.error('[Instance] Error en GET /chats:', error.message);
    res.status(500).json({ success: false, error: 'Error interno en el servidor.' });
  }
});

/**
 * POST /chats/:instanceName/messages - Obtener historial de mensajes de un chat
 */
router.post('/chats/:instanceName/messages', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { instanceName } = req.params;
  const { remoteJid, originalJid } = req.body;

  if (!remoteJid) {
    return res.status(400).json({ success: false, error: 'Falta el parámetro remoteJid' });
  }

  try {
    // Verificar propiedad de la instancia
    const verifyRes = await pool.query('SELECT id FROM instances WHERE user_id = $1 AND instance_name = $2', [req.userId, instanceName]);
    if (verifyRes.rows.length === 0) {
      return res.status(403).json({ success: false, error: 'Acceso no autorizado.' });
    }

    let allRecords: any[] = [];
    
    // Fetch para remoteJid principal
    const messagesResult = await EvolutionService.getChatMessages(instanceName, remoteJid);
    if (!messagesResult.success) {
      const statusCode = messagesResult.status === 404 ? 404 : 500;
      const cleanError = messagesResult.status === 404 ? 'La instancia de WhatsApp no está conectada o no existe.' : (messagesResult.error || 'Error al obtener mensajes');
      return res.status(statusCode).json({ success: false, error: cleanError });
    }
    const records = messagesResult.data?.messages?.records || messagesResult.data?.records || messagesResult.data || [];
    allRecords = allRecords.concat(records);

    // Fetch para originalJid si existe y es diferente (ej. LID unificado)
    if (originalJid && originalJid !== remoteJid) {
      const altMessagesResult = await EvolutionService.getChatMessages(instanceName, originalJid);
      if (altMessagesResult.success) {
        const altRecords = altMessagesResult.data?.messages?.records || altMessagesResult.data?.records || altMessagesResult.data || [];
        allRecords = allRecords.concat(altRecords);
      }
    }

    // Eliminar duplicados y ordenar por timestamp
    const uniqueMessages = new Map();
    for (const msg of allRecords) {
      if (msg.id) uniqueMessages.set(msg.id, msg);
    }
    
    // Se devuelven tal como los espera el frontend (sin reverse aquí porque el frontend hace slice().reverse())
    // El frontend renderiza y ordena. Retornaremos la lista descendente como la API original (los más nuevos primero)
    const sortedMessages = Array.from(uniqueMessages.values()).sort((a, b) => {
      return (b.messageTimestamp || 0) - (a.messageTimestamp || 0);
    });

    res.json({ success: true, data: sortedMessages });
  } catch (error: any) {
    console.error('[Instance] Error en POST /chats/messages:', error.message);
    res.status(500).json({ success: false, error: 'Error interno en el servidor.' });
  }
});

/**
 * POST /chats/:instanceName/media - Descargar archivo multimedia codificado en Base64
 */
router.post('/chats/:instanceName/media', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { instanceName } = req.params;
  const { messageKey, messageContent } = req.body;

  if (!messageKey || !messageContent) {
    return res.status(400).json({ success: false, error: 'Faltan parámetros requeridos (messageKey, messageContent)' });
  }

  try {
    // Verificar propiedad de la instancia
    const verifyRes = await pool.query('SELECT id FROM instances WHERE user_id = $1 AND instance_name = $2', [req.userId, instanceName]);
    if (verifyRes.rows.length === 0) {
      return res.status(403).json({ success: false, error: 'Acceso no autorizado.' });
    }

    const mediaResult = await EvolutionService.getMediaMessageBase64(instanceName, messageKey, messageContent);
    if (!mediaResult.success) {
      return res.status(500).json({ success: false, error: mediaResult.error || 'Error al obtener base64 del archivo' });
    }

    res.json({ success: true, data: mediaResult.data });
  } catch (error: any) {
    console.error('[Instance] Error en POST /chats/media:', error.message);
    res.status(500).json({ success: false, error: 'Error interno en el servidor.' });
  }
});

/**
 * POST /chats/:instanceName/send - Enviar mensaje de texto desde el chat en vivo
 */
router.post('/chats/:instanceName/send', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { instanceName } = req.params;
  const { remoteJid, text } = req.body;

  if (!remoteJid || !text) {
    return res.status(400).json({ success: false, error: 'Faltan parámetros requeridos (remoteJid, text)' });
  }

  try {
    // Verificar propiedad de la instancia
    const verifyRes = await pool.query('SELECT id FROM instances WHERE user_id = $1 AND instance_name = $2', [req.userId, instanceName]);
    if (verifyRes.rows.length === 0) {
      return res.status(403).json({ success: false, error: 'Acceso no autorizado.' });
    }

    const number = remoteJid.split('@')[0];

    const sent = await EvolutionService.sendTextMessage(instanceName, number, text);
    if (sent) {
      return res.json({ success: true, message: 'Mensaje enviado exitosamente.' });
    }
    res.status(500).json({ success: false, error: 'Error en el servidor al enviar el mensaje.' });
  } catch (error: any) {
    console.error('[Instance] Error en POST /chats/send:', error.message);
    res.status(500).json({ success: false, error: 'Error interno en el servidor.' });
  }
});

/**
 * POST /chats/:instanceName/read - Marcar mensajes como leídos
 */
router.post('/chats/:instanceName/read', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { instanceName } = req.params;
  const { remoteJid, messageIds } = req.body;

  if (!remoteJid || !messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
    return res.status(400).json({ success: false, error: 'Faltan parámetros requeridos (remoteJid, messageIds array)' });
  }

  try {
    // Verificar propiedad de la instancia
    const verifyRes = await pool.query('SELECT id FROM instances WHERE user_id = $1 AND instance_name = $2', [req.userId, instanceName]);
    if (verifyRes.rows.length === 0) {
      return res.status(403).json({ success: false, error: 'Acceso no autorizado.' });
    }

    const markResult = await EvolutionService.markMessagesAsRead(instanceName, remoteJid, messageIds);
    if (!markResult.success) {
      return res.status(500).json({ success: false, error: markResult.error || 'Error al marcar mensajes como leídos' });
    }

    res.json({ success: true, message: 'Mensajes marcados como leídos.' });
  } catch (error: any) {
    console.error('[Instance] Error en POST /chats/read:', error.message);
    res.status(500).json({ success: false, error: 'Error interno en el servidor.' });
  }
});

export default router;
