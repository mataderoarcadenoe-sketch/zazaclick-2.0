import { Router, Response } from 'express';
import pool from '../config/database';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.middleware';
import { EvolutionService } from '../services/evolution.service';
import { engineRouter } from '../engines/core/EngineRouter';
import { EngineType } from '../engines/contracts/engine.types';
import redis from '../config/redis';
import * as fs from 'fs';
import * as path from 'path';

const router = Router();

/**
 * Generar ID aleatorio
 */
function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

/**
 * POST / y POST /create - Crear una nueva instancia de WhatsApp
 */
const createInstanceHandler = async (req: AuthenticatedRequest, res: Response) => {
  const { instanceName, engineType } = req.body;

  console.log(`[Create] INICIO — userId=${req.userId} instanceName=${instanceName} engineType=${engineType}`);

  if (!instanceName || !/^[a-zA-Z0-9_-]+$/.test(instanceName)) {
    return res.status(400).json({ success: false, error: 'Nombre de instancia inválido. Solo letras, números, guiones y guiones bajos.' });
  }

  try {
    // 1. Verificar límites de la suscripción del usuario
    console.log(`[Create] PASO 1 — Consultando suscripción para userId=${req.userId}`);
    const subRes = await pool.query(`
      SELECT p.max_instances
      FROM subscriptions s
      JOIN plans p ON s.plan_id = p.id
      WHERE s.user_id = $1 AND s.status = 'active'
      ORDER BY s.created_at DESC LIMIT 1
    `, [req.userId]);

    console.log(`[Create] PASO 1 result — rows=${subRes?.rows?.length}`);

    if (!subRes || !subRes.rows || subRes.rows.length === 0) {
      return res.status(403).json({ success: false, error: 'No tienes una suscripción activa para crear instancias.' });
    }

    const maxInstances = subRes.rows[0].max_instances;
    console.log(`[Create] PASO 2 — maxInstances=${maxInstances}`);

    // Contar instancias actuales creadas por el usuario
    const currentInstancesRes = await pool.query('SELECT COUNT(*) FROM instances WHERE user_id = $1', [req.userId]);
    const currentCount = parseInt(currentInstancesRes.rows[0].count);
    console.log(`[Create] PASO 2 — currentCount=${currentCount}`);

    if (currentCount >= maxInstances) {
      return res.status(400).json({ success: false, error: `Límite alcanzado: Tu plan actual solo permite un máximo de ${maxInstances} instancia(s). Elimina una instancia primero.` });
    }

    // 2. Verificar si el nombre de instancia ya está tomado en nuestra BD
    console.log(`[Create] PASO 3 — Verificando nombre ${instanceName}`);
    const nameCheck = await pool.query('SELECT id FROM instances WHERE instance_name = $1', [instanceName]);
    if (nameCheck.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'El nombre de esta instancia ya está en uso. Elige otro.' });
    }

    // 3. Resolver motor solicitado (default: evolution_api)
    const targetEngine: EngineType = (engineType === 'evolution_go' && process.env.EVOLUTION_GO_ENABLED === 'true')
      ? 'evolution_go'
      : 'evolution_api';

    console.log(`[Create] PASO 4 — Creando instancia en motor ${targetEngine} para ${instanceName}`);
    const engine = engineRouter.getEngineByType(targetEngine);
    const evoResult = await engine.createInstance(instanceName);
    console.log(`[Create] PASO 4 result — success=${evoResult.success}`);

    if (!evoResult.success || !evoResult.data?.token) {
      const statusCode = evoResult.error?.statusCode || 500;
      return res.status(statusCode).json({ success: false, error: evoResult.error?.message || 'Error al crear la instancia en el motor de WhatsApp' });
    }

    // 4. Guardar la instancia en la base de datos de Zaza
    console.log(`[Create] PASO 5 — Guardando instancia en BD con engine_type=${targetEngine}`);
    const instanceId = generateId('inst');
    const apiKey = evoResult.data.token;

    await pool.query(`
      INSERT INTO instances (id, user_id, instance_name, status, api_key, engine_type)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [instanceId, req.userId, instanceName, 'disconnected', apiKey, targetEngine]);

    console.log(`[Create] ÉXITO — Instancia ${instanceName} creada correctamente`);

    res.status(201).json({
      success: true,
      message: 'Instancia creada exitosamente.',
      data: {
        id: instanceId,
        instance_name: instanceName,
        status: 'disconnected',
        api_key: apiKey,
        engine_type: targetEngine
      }
    });

  } catch (error: any) {
    console.error('[Create] ERROR en POST /create:', error.message);
    res.status(500).json({ success: false, error: `Error en el servidor: ${error.message}` });
  }
};
router.post('/create', authMiddleware, createInstanceHandler);
router.post('/', authMiddleware, createInstanceHandler);


/**
 * GET / y GET /list - Listar instancias del cliente y actualizar sus estados en vivo
 */
const getInstancesListHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const instancesRes = await pool.query(
      'SELECT id, instance_name, phone, status, api_key, engine_type, created_at FROM instances WHERE user_id = $1 ORDER BY created_at DESC',
      [req.userId]
    );
    const dbInstances = instancesRes.rows;

    // Auto-sincronizar el estado de conexión con el motor en segundo plano o paralelo
    const updatedInstances = await Promise.all(dbInstances.map(async (inst) => {
      try {
        const engine = await engineRouter.getEngineForInstance(inst.instance_name);
        const stateRes = await engine.getConnectionState(inst.instance_name);
        const actualStatus = stateRes.data?.isConnected ? 'connected' : 'disconnected';
        
        if (inst.status !== actualStatus) {
          console.log(`🔄 [InstanceList] Sincronizando estado de "${inst.instance_name}": ${inst.status} -> ${actualStatus}`);
          await pool.query(
            'UPDATE instances SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [actualStatus, inst.id]
          );
          inst.status = actualStatus;
        }
      } catch (err: any) {
        console.warn(`[InstanceList] No se pudo verificar estado de "${inst.instance_name}":`, err.message);
      }
      return inst;
    }));

    res.json({
      success: true,
      data: updatedInstances
    });

  } catch (error: any) {
    console.error('[Instance] Error en GET /list:', error.message);
    res.status(500).json({ success: false, error: 'Error en el servidor al listar instancias' });
  }
};
router.get('/list', authMiddleware, getInstancesListHandler);
router.get('/', authMiddleware, getInstancesListHandler);

/**
 * GET /qr/:instanceName y GET /:instanceName/connect - Obtener código QR para vincular
 */
const getQrHandler = async (req: AuthenticatedRequest, res: Response) => {
  const { instanceName } = req.params;

  try {
    // Verificar que la instancia pertenezca al usuario
    const verifyRes = await pool.query('SELECT id FROM instances WHERE user_id = $1 AND instance_name = $2', [req.userId, instanceName]);
    if (verifyRes.rows.length === 0) {
      return res.status(403).json({ success: false, error: 'Acceso no autorizado a esta instancia.' });
    }

    // Solicitar el QR al motor asignado
    const engine = await engineRouter.getEngineForInstance(instanceName);
    const qrRes = await engine.getQRCode(instanceName);
    if (!qrRes.success || !qrRes.data?.qrcode) {
      return res.status(500).json({ success: false, error: qrRes.error?.message || 'Error al obtener código QR.' });
    }

    res.json({
      success: true,
      qrcode: qrRes.data.qrcode,
      base64: qrRes.data.qrcode
    });

  } catch (error: any) {
    console.error('[Instance] Error en GET /qr:', error.message);
    res.status(500).json({ success: false, error: 'Error en el servidor al generar QR' });
  }
};
router.get('/qr/:instanceName', authMiddleware, getQrHandler);
router.get('/:instanceName/connect', authMiddleware, getQrHandler);

/**
 * POST /logout/:instanceName y POST /:instanceName/logout - Cerrar sesión de WhatsApp
 */
const logoutHandler = async (req: AuthenticatedRequest, res: Response) => {
  const { instanceName } = req.params;

  try {
    const verifyRes = await pool.query('SELECT id FROM instances WHERE user_id = $1 AND instance_name = $2', [req.userId, instanceName]);
    if (verifyRes.rows.length === 0) {
      return res.status(403).json({ success: false, error: 'Acceso no autorizado.' });
    }

    const engine = await engineRouter.getEngineForInstance(instanceName);
    const outRes = await engine.logout(instanceName);
    if (outRes.success) {
      await pool.query('UPDATE instances SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE instance_name = $2', ['disconnected', instanceName]);
      return res.json({ success: true, message: 'Sesión cerrada exitosamente.' });
    }
    res.status(500).json({ success: false, error: outRes.error?.message || 'No se pudo cerrar la sesión en el motor de WhatsApp.' });

  } catch (error: any) {
    console.error('[Instance] Error en POST /logout:', error.message);
    res.status(500).json({ success: false, error: 'Error interno' });
  }
};
router.post('/logout/:instanceName', authMiddleware, logoutHandler);
router.post('/:instanceName/logout', authMiddleware, logoutHandler);

/**
 * GET /status/:instanceName y GET /:instanceName/status - Consultar estado de conexión en tiempo real
 */
const getStatusHandler = async (req: AuthenticatedRequest, res: Response) => {
  const { instanceName } = req.params;
  try {
    const verifyRes = await pool.query('SELECT id, status FROM instances WHERE user_id = $1 AND instance_name = $2', [req.userId, instanceName]);
    if (verifyRes.rows.length === 0) {
      return res.status(403).json({ success: false, error: 'Acceso no autorizado.' });
    }

    const engine = await engineRouter.getEngineForInstance(instanceName);
    const stateRes = await engine.getConnectionState(instanceName);
    const isConnected = Boolean(stateRes.data?.isConnected);
    const state = stateRes.data?.state || (isConnected ? 'connected' : 'disconnected');

    if (isConnected && verifyRes.rows[0].status !== 'connected') {
      console.log(`✅ [StatusCheck] Instancia "${instanceName}" vinculada con éxito. Actualizando BD a connected.`);
      await pool.query(
        "UPDATE instances SET status = 'connected', updated_at = CURRENT_TIMESTAMP WHERE instance_name = $1",
        [instanceName]
      );
    }

    res.json({
      success: true,
      instanceName,
      state,
      isConnected
    });
  } catch (err: any) {
    console.error('[StatusCheck] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};
router.get('/status/:instanceName', authMiddleware, getStatusHandler);
router.get('/:instanceName/status', authMiddleware, getStatusHandler);

/**
 * POST /reconnect/:instanceName y POST /:instanceName/reconnect - Reconectar sesión existente sin requerir nuevo QR
 */
const reconnectHandler = async (req: AuthenticatedRequest, res: Response) => {
  const { instanceName } = req.params;
  try {
    const verifyRes = await pool.query('SELECT id, status FROM instances WHERE user_id = $1 AND instance_name = $2', [req.userId, instanceName]);
    if (verifyRes.rows.length === 0) {
      return res.status(403).json({ success: false, error: 'Acceso no autorizado a esta instancia.' });
    }

    const engine = await engineRouter.getEngineForInstance(instanceName);
    let reconnectRes: any;
    if (typeof (engine as any).reconnect === 'function') {
      reconnectRes = await (engine as any).reconnect(instanceName);
    } else {
      await engine.getQRCode(instanceName);
      reconnectRes = await engine.getConnectionState(instanceName);
    }

    const isConnected = Boolean(reconnectRes.data?.isConnected);
    const state = reconnectRes.data?.state || (isConnected ? 'connected' : 'disconnected');
    const requiresQr = Boolean(reconnectRes.data?.requiresQr);
    const newDbStatus = isConnected ? 'connected' : (state === 'connecting' ? 'reconnecting' : 'disconnected');

    await pool.query(
      "UPDATE instances SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE instance_name = $2",
      [newDbStatus, instanceName]
    );

    res.json({
      success: true,
      instanceName,
      state,
      status: newDbStatus,
      isConnected,
      requiresQr
    });
  } catch (err: any) {
    console.error('[Reconnect] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};
router.post('/reconnect/:instanceName', authMiddleware, reconnectHandler);
router.post('/:instanceName/reconnect', authMiddleware, reconnectHandler);

/**
 * DELETE /delete/:instanceName y DELETE /:instanceName - Eliminar instancia
 */
const deleteInstanceHandler = async (req: AuthenticatedRequest, res: Response) => {
  const { instanceName } = req.params;

  try {
    const verifyRes = await pool.query('SELECT id FROM instances WHERE user_id = $1 AND instance_name = $2', [req.userId, instanceName]);
    if (verifyRes.rows.length === 0) {
      return res.status(403).json({ success: false, error: 'Acceso no autorizado.' });
    }

    // 1. Eliminar del motor asignado
    const engine = await engineRouter.getEngineForInstance(instanceName);
    await engine.deleteInstance(instanceName);

    // 2. Eliminar de la base de datos de Zaza
    await pool.query('DELETE FROM instances WHERE instance_name = $1', [instanceName]);

    // 3. Invalidar caché en EngineRouter
    await engineRouter.invalidateCache(instanceName);

    // 4. Limpiar claves de Redis asociadas (contactos y contadores de no leídos)
    try {
      const contactKeys = await redis.keys(`contact:${instanceName}:*`);
      const unreadKeys = await redis.keys(`unread:${instanceName}:*`);
      const allKeys = [...(contactKeys || []), ...(unreadKeys || [])];
      
      if (allKeys.length > 0) {
        await redis.del(...allKeys);
        console.log(`🧹 [Redis] Limpiadas ${allKeys.length} llaves huérfanas al eliminar instancia ${instanceName}`);
      }
    } catch (redisErr: any) {
      console.warn(`[Redis] Error al limpiar llaves huérfanas de ${instanceName}:`, redisErr.message);
    }

    res.json({
      success: true,
      message: 'Instancia eliminada correctamente tanto en el servidor como en la base de datos.'
    });

  } catch (error: any) {
    console.error('[Instance] Error en DELETE:', error.message);
    res.status(500).json({ success: false, error: 'Error en el servidor al eliminar instancia' });
  }
};
router.delete('/delete/:instanceName', authMiddleware, deleteInstanceHandler);
router.delete('/:instanceName', authMiddleware, deleteInstanceHandler);




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

    // Obtener los contadores de no leídos en tiempo real consultando findMessages de la API REST
    const dbUnreadCounts = await EvolutionService.getUnreadCountsFromApi(instanceName);

    // Filtrar broadcasts y unificar chats @lid usando la nueva utilidad
    const cleanChats = await EvolutionService.mergeChats(instanceName, chatsResult.data || [], dbUnreadCounts);

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

    // Fetch para remoteJid con sufijo :0 si es de whatsapp y no tiene sufijo
    if (remoteJid.endsWith('@s.whatsapp.net') && !remoteJid.includes(':')) {
      const suffixJid = remoteJid.replace('@s.whatsapp.net', ':0@s.whatsapp.net');
      if (suffixJid !== originalJid) {
        const suffixMessagesResult = await EvolutionService.getChatMessages(instanceName, suffixJid);
        if (suffixMessagesResult.success) {
          const suffixRecords = suffixMessagesResult.data?.messages?.records || suffixMessagesResult.data?.records || suffixMessagesResult.data || [];
          allRecords = allRecords.concat(suffixRecords);
        }
      }
    }

    // Eliminar duplicados y ordenar por timestamp
    const uniqueMessages = new Map();
    for (const msg of allRecords) {
      const msgId = msg.id || msg.key?.id;
      if (msgId) uniqueMessages.set(msgId, msg);
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

  if (!messageKey || !messageContent || !messageKey.id) {
    return res.status(400).json({ success: false, error: 'Faltan parámetros requeridos (messageKey, messageContent)' });
  }

  try {
    // Verificar propiedad de la instancia
    const verifyRes = await pool.query('SELECT id FROM instances WHERE user_id = $1 AND instance_name = $2', [req.userId, instanceName]);
    if (verifyRes.rows.length === 0) {
      return res.status(403).json({ success: false, error: 'Acceso no autorizado.' });
    }

    // Definir ruta y directorio de caché local usando directorio de trabajo actual (writeable en Railway)
    const cacheDir = path.resolve(process.cwd(), 'media_cache');
    if (!fs.existsSync(cacheDir)) {
      try {
        fs.mkdirSync(cacheDir, { recursive: true });
        console.log(`💾 [MediaCache] Directorio creado en ${cacheDir}`);
      } catch (err: any) {
        console.error(`[MediaCache] Error creando directorio ${cacheDir}:`, err.message);
      }
    }
    const cacheFilePath = path.join(cacheDir, `${messageKey.id}.json`);

    // Intentar leer de la caché de disco local
    if (fs.existsSync(cacheFilePath)) {
      try {
        const cachedData = JSON.parse(fs.readFileSync(cacheFilePath, 'utf8'));
        if (cachedData && cachedData.error) {
          console.log(`💾 [MediaCache] Sirviendo error de descarga ${messageKey.id} desde caché local de disco.`);
          return res.status(410).json({ success: false, error: cachedData.error, cached: true });
        }
        console.log(`💾 [MediaCache] Sirviendo archivo ${messageKey.id} desde caché local de disco.`);
        return res.json({ success: true, data: cachedData });
      } catch (err: any) {
        console.warn(`[MediaCache] Fallo al leer archivo de caché de disco, consultando Evolution API:`, err.message);
      }
    }

    // Si no está en caché, solicitar a Evolution API
    const mediaResult = await EvolutionService.getMediaMessageBase64(instanceName, messageKey, messageContent);
    if (!mediaResult.success) {
      const errorMsg = mediaResult.error || 'Error al obtener base64 del archivo';
      
      // Guardar el fallo en caché de disco de forma asíncrona para no saturar a la API en el futuro
      try {
        await fs.promises.writeFile(cacheFilePath, JSON.stringify({ error: errorMsg }), 'utf8');
        console.log(`💾 [MediaCache] Guardado error de descarga para ${messageKey.id} en caché local de disco.`);
      } catch (writeErr: any) {
        console.error(`[MediaCache] Error al guardar error en caché local ${messageKey.id}:`, writeErr.message);
      }
      
      return res.status(410).json({ success: false, error: errorMsg });
    }

    // Guardar en caché de disco de forma asíncrona con manejo de errores
    try {
      await fs.promises.writeFile(cacheFilePath, JSON.stringify(mediaResult.data), 'utf8');
      console.log(`💾 [MediaCache] Guardado archivo ${messageKey.id} en caché local de disco.`);
    } catch (err: any) {
      console.error(`[MediaCache] Error al guardar en caché local ${messageKey.id}:`, err.message);
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

    const sentResult = await EvolutionService.sendTextMessage(instanceName, remoteJid, text);
    if (sentResult.success) {
      return res.json({ success: true, message: 'Mensaje enviado exitosamente.' });
    }
    res.status(500).json({ 
      success: false, 
      error: `Error en el servidor al enviar el mensaje: ${sentResult.error || ''}`,
      details: sentResult.details
    });
  } catch (error: any) {
    console.error('[Instance] Error en POST /chats/send:', error.message);
    res.status(500).json({ success: false, error: 'Error interno en el servidor.' });
  }
});

/**
 * POST /chats/:instanceName/send-media - Enviar mensaje multimedia (imagen, video, documento, audio) desde el chat en vivo
 */
router.post('/chats/:instanceName/send-media', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { instanceName } = req.params;
  const { remoteJid, media, mediatype, mimetype, caption, fileName } = req.body;

  if (!remoteJid || !media || !mediatype || !mimetype) {
    return res.status(400).json({ success: false, error: 'Faltan parámetros requeridos (remoteJid, media, mediatype, mimetype)' });
  }

  try {
    // Verificar propiedad de la instancia
    const verifyRes = await pool.query('SELECT id FROM instances WHERE user_id = $1 AND instance_name = $2', [req.userId, instanceName]);
    if (verifyRes.rows.length === 0) {
      return res.status(403).json({ success: false, error: 'Acceso no autorizado.' });
    }

    const sentResult = await EvolutionService.sendMediaMessage(instanceName, remoteJid, media, mediatype, mimetype, caption, fileName);
    if (sentResult.success) {
      return res.json({ success: true, message: 'Mensaje multimedia enviado exitosamente.' });
    }
    res.status(500).json({ 
      success: false, 
      error: `Error en el servidor al enviar el mensaje multimedia: ${sentResult.error || ''}`,
      details: sentResult.details 
    });
  } catch (error: any) {
    console.error('[Instance] Error en POST /chats/send-media:', error.message);
    res.status(500).json({ success: false, error: 'Error interno en el servidor.' });
  }
});

/**
 * POST /chats/:instanceName/read - Marcar mensajes como leídos
 */
router.post('/chats/:instanceName/read', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { instanceName } = req.params;
  const { remoteJid, phoneJid, messageIds } = req.body;

  if (!remoteJid) {
    return res.status(400).json({ success: false, error: 'Faltan parámetros requeridos (remoteJid)' });
  }

  try {
    // Verificar propiedad de la instancia
    const verifyRes = await pool.query('SELECT id FROM instances WHERE user_id = $1 AND instance_name = $2', [req.userId, instanceName]);
    if (verifyRes.rows.length === 0) {
      return res.status(403).json({ success: false, error: 'Acceso no autorizado.' });
    }

    const cleanIds = messageIds && Array.isArray(messageIds)
      ? messageIds.filter((id: string) => id && !id.startsWith('temp_'))
      : [];

    if (cleanIds.length > 0) {
      const markResult = await EvolutionService.markMessagesAsRead(instanceName, remoteJid, cleanIds, phoneJid);
      if (!markResult.success) {
        console.warn(`⚠️ [ReadEndpoint] Error no crítico al marcar como leído en la API de Evolution:`, markResult.error);
      }
    } else {
      // Registrar de todos modos el timestamp en la caché local para forzar el contador a 0 en la UI
      EvolutionService.recordReadTimestamp(instanceName, remoteJid, phoneJid);
    }

    res.json({ success: true, message: 'Mensajes marcados como leídos.' });
  } catch (error: any) {
    console.error('[Instance] Error en POST /chats/read:', error.message);
    res.status(500).json({ success: false, error: 'Error interno en el servidor.' });
  }
});

/**
 * GET /webhook-diag/:instanceName - Diagnosticar webhook en Evolution API
 */
router.get('/webhook-diag/:instanceName', async (req, res) => {
  const { instanceName } = req.params;
  try {
    const diag = await EvolutionService.getWebhookConfig(instanceName);
    res.json({
      instanceName,
      diag,
      env: {
        BACKEND_URL: process.env.BACKEND_URL,
        PORT: process.env.PORT,
        RAILWAY_PRIVATE_DOMAIN: process.env.RAILWAY_PRIVATE_DOMAIN
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /db-diag - Diagnosticar tablas de instancias en producción
 */
router.get('/db-diag', async (req, res) => {
  try {
    const dbInstances = await pool.query('SELECT id, instance_name, status, phone FROM instances');
    res.json({
      success: true,
      instances: dbInstances.rows
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /restart-diag/:instanceName - Forzar reinicio de conexión de la instancia
 */
router.get('/restart-diag/:instanceName', async (req, res) => {
  const { instanceName } = req.params;
  try {
    const result = await EvolutionService.restartInstance(instanceName);
    res.json({
      instanceName,
      result
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /redis-diag - Diagnosticar claves de Redis en producción
 */
router.get('/redis-diag', async (req, res) => {
  try {
    const keys = await redis.keys('unread:*');
    const result: Record<string, string | null> = {};
    for (const key of keys) {
      result[key] = await redis.get(key);
    }
    res.json({
      success: true,
      keys: result
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /chat-diag/:instanceName - Diagnosticar estructura de chats cruda de la Evolution API
 */
router.get('/chat-diag/:instanceName', async (req, res) => {
  const { instanceName } = req.params;
  try {
    const rawChats = await EvolutionService.getRawChats(instanceName);
    res.json({
      instanceName,
      chatsCount: Array.isArray(rawChats) ? rawChats.length : 'no-array',
      firstChat: Array.isArray(rawChats) && rawChats.length > 0 ? rawChats[0] : null,
      allChatsSample: Array.isArray(rawChats) ? rawChats.slice(0, 5) : rawChats
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /contact-diag/:instanceName - Diagnosticar estructura de contactos de Evolution API
 */
router.get('/contact-diag/:instanceName', async (req, res) => {
  const { instanceName } = req.params;
  try {
    const rawContacts = await EvolutionService.getRawContacts(instanceName);
    res.json({
      instanceName,
      contactsCount: Array.isArray(rawContacts) ? rawContacts.length : 'no-array',
      firstContact: Array.isArray(rawContacts) && rawContacts.length > 0 ? rawContacts[0] : null,
      allContactsSample: Array.isArray(rawContacts) ? rawContacts.slice(0, 5) : rawContacts
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /sync-contacts/:instanceName - Forzar sincronización de todos los contactos a Redis
 */
router.post('/sync-contacts/:instanceName', async (req, res) => {
  const { instanceName } = req.params;
  try {
    const rawContacts = await EvolutionService.getRawContacts(instanceName);
    if (!Array.isArray(rawContacts)) {
      return res.json({ success: false, error: 'No se obtuvieron contactos', data: rawContacts });
    }

    let savedCount = 0;
    let withName = 0;
    let withNotify = 0;

    for (const contact of rawContacts) {
      const jid = contact.id || contact.remoteJid;
      if (!jid) continue;

      const agendaName = contact.name || undefined;
      const notifyName = contact.notify || contact.pushName || undefined;

      if (agendaName) withName++;
      if (notifyName) withNotify++;

      if (agendaName || notifyName) {
        await EvolutionService.saveContactName(instanceName, jid, agendaName, notifyName);
        savedCount++;
      }
    }

    res.json({
      success: true,
      totalContacts: rawContacts.length,
      savedToRedis: savedCount,
      withAgendaName: withName,
      withNotifyName: withNotify,
      sample: rawContacts.slice(0, 3).map((c: any) => ({
        id: c.id,
        name: c.name,
        notify: c.notify,
        pushName: c.pushName
      }))
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});



/**
 * GET /instances/groups/:instanceName - Obtener todos los grupos de la instancia
 */
router.get('/groups/:instanceName', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { instanceName } = req.params;

  try {
    // Verificar propiedad de la instancia
    const verifyRes = await pool.query('SELECT id FROM instances WHERE user_id = $1 AND instance_name = $2', [req.userId, instanceName]);
    if (verifyRes.rows.length === 0) {
      return res.status(403).json({ success: false, error: 'Acceso no autorizado.' });
    }

    const groupsResult = await EvolutionService.getGroups(instanceName);
    if (!groupsResult.success) {
      return res.status(500).json({ success: false, error: groupsResult.error || 'Error al obtener grupos' });
    }

    res.json({ success: true, data: groupsResult.data });
  } catch (error: any) {
    console.error('[Instance] Error en GET /groups:', error.message);
    res.status(500).json({ success: false, error: 'Error interno en el servidor.' });
  }
});

/**
 * POST /instances/groups/:instanceName/create - Crear un grupo
 */
router.post('/groups/:instanceName/create', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { instanceName } = req.params;
  const { subject, participants } = req.body;

  if (!subject) {
    return res.status(400).json({ success: false, error: 'El nombre del grupo (subject) es requerido.' });
  }

  try {
    // Verificar propiedad
    const verifyRes = await pool.query('SELECT id FROM instances WHERE user_id = $1 AND instance_name = $2', [req.userId, instanceName]);
    if (verifyRes.rows.length === 0) {
      return res.status(403).json({ success: false, error: 'Acceso no autorizado.' });
    }

    // Limpiar teléfonos de los participantes (formato JID esperado por Evolution)
    const cleanedParticipants = (participants || []).map((num: string) => {
      const cleanNum = num.split('@')[0].replace(/\D/g, '');
      return `${cleanNum}@s.whatsapp.net`;
    });

    const createResult = await EvolutionService.createGroup(instanceName, subject, cleanedParticipants);
    if (!createResult.success) {
      return res.status(500).json({ success: false, error: createResult.error || 'Error al crear el grupo' });
    }

    res.json({ success: true, data: createResult.data });
  } catch (error: any) {
    console.error('[Instance] Error en POST /groups/create:', error.message);
    res.status(500).json({ success: false, error: 'Error interno en el servidor.' });
  }
});

/**
 * PUT /instances/groups/:instanceName/participants - Gestionar miembros (add, remove, promote, demote)
 */
router.put('/groups/:instanceName/participants', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { instanceName } = req.params;
  const { groupJid, action, participants } = req.body;

  if (!groupJid || !action || !participants || !Array.isArray(participants)) {
    return res.status(400).json({ success: false, error: 'Parámetros inválidos (groupJid, action, participants son requeridos).' });
  }

  try {
    // Verificar propiedad
    const verifyRes = await pool.query('SELECT id FROM instances WHERE user_id = $1 AND instance_name = $2', [req.userId, instanceName]);
    if (verifyRes.rows.length === 0) {
      return res.status(403).json({ success: false, error: 'Acceso no autorizado.' });
    }

    // Limpiar teléfonos de los participantes (formato JID esperado por Evolution)
    const cleanParticipants = participants.map((num: string) => {
      const cleanNum = num.split('@')[0].replace(/\D/g, '');
      return `${cleanNum}@s.whatsapp.net`;
    });

    const updateResult = await EvolutionService.updateGroupParticipants(instanceName, groupJid, action, cleanParticipants);
    if (!updateResult.success) {
      return res.status(500).json({ success: false, error: updateResult.error || 'Error al actualizar participantes del grupo' });
    }

    res.json({ success: true, data: updateResult.data });
  } catch (error: any) {
    console.error('[Instance] Error en PUT /groups/participants:', error.message);
    res.status(500).json({ success: false, error: 'Error interno en el servidor.' });
  }
});

/**
 * GET /instances/groups/:instanceName/invite-code - Obtener enlace de invitación
 */
router.get('/groups/:instanceName/invite-code', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { instanceName } = req.params;
  const { groupJid } = req.query;

  if (!groupJid) {
    return res.status(400).json({ success: false, error: 'El parámetro groupJid es requerido.' });
  }

  try {
    // Verificar propiedad
    const verifyRes = await pool.query('SELECT id FROM instances WHERE user_id = $1 AND instance_name = $2', [req.userId, instanceName]);
    if (verifyRes.rows.length === 0) {
      return res.status(403).json({ success: false, error: 'Acceso no autorizado.' });
    }

    const codeResult = await EvolutionService.getGroupInviteCode(instanceName, groupJid as string);
    if (!codeResult.success) {
      return res.status(500).json({ success: false, error: codeResult.error || 'Error al obtener enlace de invitación' });
    }

    res.json({ success: true, data: codeResult.data });
  } catch (error: any) {
    console.error('[Instance] Error en GET /groups/invite-code:', error.message);
    res.status(500).json({ success: false, error: 'Error interno en el servidor.' });
  }
});

/**
 * POST /instances/groups/:instanceName/revoke-invite - Revocar enlace de invitación
 */
router.post('/groups/:instanceName/revoke-invite', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { instanceName } = req.params;
  const { groupJid } = req.body;

  if (!groupJid) {
    return res.status(400).json({ success: false, error: 'El parámetro groupJid es requerido.' });
  }

  try {
    // Verificar propiedad
    const verifyRes = await pool.query('SELECT id FROM instances WHERE user_id = $1 AND instance_name = $2', [req.userId, instanceName]);
    if (verifyRes.rows.length === 0) {
      return res.status(403).json({ success: false, error: 'Acceso no autorizado.' });
    }

    const revokeResult = await EvolutionService.revokeGroupInviteCode(instanceName, groupJid);
    if (!revokeResult.success) {
      return res.status(500).json({ success: false, error: revokeResult.error || 'Error al revocar enlace de invitación' });
    }

    res.json({ success: true, data: revokeResult.data });
  } catch (error: any) {
    console.error('[Instance] Error en POST /groups/revoke-invite:', error.message);
    res.status(500).json({ success: false, error: 'Error interno en el servidor.' });
  }
});

export default router;
