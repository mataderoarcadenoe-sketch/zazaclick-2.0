import { Router, Response } from 'express';
import pool from '../config/database';
import { apiKeyOrTokenAuth, AuthenticatedRequest } from '../middleware/auth.middleware';
import { licensingMiddleware, LicensedRequest } from '../middleware/licensing.middleware';
import { engineRouter } from '../engines/core/EngineRouter';
import { EngineType } from '../engines/contracts/engine.types';
import redis from '../config/redis';

const router = Router();

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

// ==========================================
// 1. GESTIÓN DE INSTANCIAS (ERP / DEVELOPERS)
// ==========================================

/**
 * POST /v1/instances — Crear una nueva instancia de WhatsApp desde ERP
 */
router.post('/instances', apiKeyOrTokenAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { instanceName, engine: requestedEngine, engineType } = req.body;
  const targetEngineParam = requestedEngine || engineType || 'evolution_api';

  if (!instanceName || !/^[a-zA-Z0-9_-]+$/.test(instanceName)) {
    return res.status(400).json({
      success: false,
      code: 'INVALID_INSTANCE_NAME',
      error: 'Nombre de instancia inválido. Solo letras, números, guiones y guiones bajos (sin espacios).'
    });
  }

  try {
    // 1. Verificar suscripción y límites de instancia del tenant
    const subRes = await pool.query(`
      SELECT p.max_instances, s.status, s.end_date
      FROM subscriptions s
      JOIN plans p ON s.plan_id = p.id
      WHERE s.user_id = $1 AND s.status IN ('active', 'trial')
      ORDER BY s.created_at DESC LIMIT 1
    `, [req.userId]);

    if (!subRes || subRes.rows.length === 0) {
      return res.status(403).json({
        success: false,
        code: 'SUBSCRIPTION_REQUIRED',
        error: 'No tienes una suscripción activa o período de prueba para crear instancias.'
      });
    }

    const { max_instances: maxInstances, end_date: endDate } = subRes.rows[0];

    if (new Date().getTime() > new Date(endDate).getTime()) {
      return res.status(403).json({
        success: false,
        code: 'SUBSCRIPTION_EXPIRED',
        error: 'Tu suscripción ha vencido. Renueva tu plan para crear nuevas instancias.'
      });
    }

    const currentCountRes = await pool.query('SELECT COUNT(*) FROM instances WHERE user_id = $1', [req.userId]);
    const currentCount = parseInt(currentCountRes.rows[0].count, 10);

    if (currentCount >= maxInstances) {
      return res.status(400).json({
        success: false,
        code: 'INSTANCE_LIMIT_REACHED',
        error: `Límite alcanzado: Tu plan actual permite un máximo de ${maxInstances} instancia(s).`
      });
    }

    // 2. Validar que el nombre de instancia no exista globalmente
    const nameCheck = await pool.query('SELECT id FROM instances WHERE instance_name = $1', [instanceName]);
    if (nameCheck.rows.length > 0) {
      return res.status(409).json({
        success: false,
        code: 'INSTANCE_NAME_TAKEN',
        error: 'El nombre de esta instancia ya se encuentra registrado. Utiliza un nombre único.'
      });
    }

    // 3. Resolver motor solicitado (evolution_api o evolution_go)
    const targetEngine: EngineType = (targetEngineParam === 'evolution_go' && process.env.EVOLUTION_GO_ENABLED === 'true')
      ? 'evolution_go'
      : 'evolution_api';

    const engine = engineRouter.getEngineByType(targetEngine);
    const evoResult = await engine.createInstance(instanceName);

    if (!evoResult.success || !evoResult.data?.token) {
      const statusCode = evoResult.error?.statusCode || 502;
      return res.status(statusCode).json({
        success: false,
        code: evoResult.error?.code || 'ENGINE_CREATE_FAILED',
        error: evoResult.error?.message || 'Error al aprovisionar la instancia en el motor de WhatsApp.'
      });
    }

    // 4. Guardar en base de datos
    const instanceId = generateId('inst');
    const apiKey = evoResult.data.token;

    await pool.query(`
      INSERT INTO instances (id, user_id, instance_name, status, api_key, engine_type)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [instanceId, req.userId, instanceName, 'disconnected', apiKey, targetEngine]);

    return res.status(201).json({
      success: true,
      message: 'Instancia creada exitosamente.',
      data: {
        id: instanceId,
        instanceName: instanceName,
        status: 'disconnected',
        apiKey: apiKey,
        engine: targetEngine,
        qrcode: evoResult.data.qrcode || null
      }
    });

  } catch (err: any) {
    console.error('[v1/instances/create] Error:', err.message);
    return res.status(500).json({
      success: false,
      code: 'INTERNAL_ERROR',
      error: `Error interno al crear instancia: ${err.message}`
    });
  }
});

/**
 * GET /v1/instances — Listar instancias del tenant autenticado
 */
router.get('/instances', apiKeyOrTokenAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const instancesRes = await pool.query(
      'SELECT id, instance_name, phone, status, api_key, engine_type, is_enabled, messages_sent, created_at FROM instances WHERE user_id = $1 ORDER BY created_at DESC',
      [req.userId]
    );

    const formatted = instancesRes.rows.map(inst => ({
      id: inst.id,
      instanceName: inst.instance_name,
      phone: inst.phone,
      status: inst.status,
      apiKey: inst.api_key,
      engine: inst.engine_type || 'evolution_api',
      isEnabled: inst.is_enabled !== false,
      messagesSent: inst.messages_sent || 0,
      createdAt: inst.created_at
    }));

    return res.json({
      success: true,
      data: formatted
    });
  } catch (err: any) {
    console.error('[v1/instances/list] Error:', err.message);
    return res.status(500).json({
      success: false,
      code: 'INTERNAL_ERROR',
      error: 'Error interno al consultar instancias.'
    });
  }
});

/**
 * GET /v1/instances/:instanceName — Consultar detalles de una instancia
 */
router.get('/instances/:instanceName', apiKeyOrTokenAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { instanceName } = req.params;

  try {
    const instRes = await pool.query(
      'SELECT id, instance_name, phone, status, api_key, engine_type, is_enabled, messages_sent, last_activity_at, created_at FROM instances WHERE user_id = $1 AND instance_name = $2',
      [req.userId, instanceName]
    );

    if (instRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        code: 'INSTANCE_NOT_FOUND',
        error: `La instancia "${instanceName}" no fue encontrada en tu cuenta.`
      });
    }

    const inst = instRes.rows[0];

    // Consultar estado en vivo del motor
    let liveState = inst.status;
    try {
      const engine = await engineRouter.getEngineForInstance(instanceName);
      const stateRes = await engine.getConnectionState(instanceName);
      liveState = stateRes.data?.isConnected ? 'connected' : 'disconnected';
    } catch {}

    return res.json({
      success: true,
      data: {
        id: inst.id,
        instanceName: inst.instance_name,
        phone: inst.phone,
        status: liveState,
        apiKey: inst.api_key,
        engine: inst.engine_type || 'evolution_api',
        isEnabled: inst.is_enabled !== false,
        messagesSent: inst.messages_sent || 0,
        lastActivityAt: inst.last_activity_at,
        createdAt: inst.created_at
      }
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      code: 'INTERNAL_ERROR',
      error: err.message
    });
  }
});

/**
 * GET /v1/instances/:instanceName/qr — Obtener código QR en Base64 para embeber en ERP
 */
router.get('/instances/:instanceName/qr', apiKeyOrTokenAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { instanceName } = req.params;

  try {
    const verifyRes = await pool.query(
      'SELECT id FROM instances WHERE user_id = $1 AND instance_name = $2',
      [req.userId, instanceName]
    );

    if (verifyRes.rows.length === 0) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        error: 'Acceso no autorizado a esta instancia.'
      });
    }

    const engine = await engineRouter.getEngineForInstance(instanceName);
    const qrRes = await engine.getQRCode(instanceName);

    if (!qrRes.success || !qrRes.data?.qrcode) {
      return res.status(502).json({
        success: false,
        code: qrRes.error?.code || 'QR_FETCH_FAILED',
        error: qrRes.error?.message || 'No se pudo generar el código QR. Verifica si la instancia ya está conectada.'
      });
    }

    return res.json({
      success: true,
      instanceName,
      qrcode: qrRes.data.qrcode,
      base64: qrRes.data.qrcode
    });
  } catch (err: any) {
    console.error('[v1/instances/qr] Error:', err.message);
    return res.status(500).json({
      success: false,
      code: 'INTERNAL_ERROR',
      error: 'Error interno al obtener código QR.'
    });
  }
});

/**
 * GET /v1/instances/:instanceName/status — Consultar estado de conexión en vivo
 */
router.get('/instances/:instanceName/status', apiKeyOrTokenAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { instanceName } = req.params;

  try {
    const verifyRes = await pool.query(
      'SELECT id, status FROM instances WHERE user_id = $1 AND instance_name = $2',
      [req.userId, instanceName]
    );

    if (verifyRes.rows.length === 0) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        error: 'Acceso no autorizado a esta instancia.'
      });
    }

    const engine = await engineRouter.getEngineForInstance(instanceName);
    const stateRes = await engine.getConnectionState(instanceName);
    const isConnected = Boolean(stateRes.data?.isConnected);
    const state = stateRes.data?.state || (isConnected ? 'connected' : 'disconnected');

    if (isConnected && verifyRes.rows[0].status !== 'connected') {
      await pool.query(
        "UPDATE instances SET status = 'connected', updated_at = CURRENT_TIMESTAMP WHERE instance_name = $1",
        [instanceName]
      );
    }

    return res.json({
      success: true,
      instanceName,
      state,
      isConnected
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      code: 'INTERNAL_ERROR',
      error: err.message
    });
  }
});

/**
 * POST /v1/instances/:instanceName/logout — Desconectar WhatsApp de la instancia
 */
router.post('/instances/:instanceName/logout', apiKeyOrTokenAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { instanceName } = req.params;

  try {
    const verifyRes = await pool.query(
      'SELECT id FROM instances WHERE user_id = $1 AND instance_name = $2',
      [req.userId, instanceName]
    );

    if (verifyRes.rows.length === 0) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        error: 'Acceso no autorizado.'
      });
    }

    const engine = await engineRouter.getEngineForInstance(instanceName);
    const outRes = await engine.logout(instanceName);

    if (outRes.success) {
      await pool.query("UPDATE instances SET status = 'disconnected', updated_at = CURRENT_TIMESTAMP WHERE instance_name = $1", [instanceName]);
      return res.json({
        success: true,
        message: 'Sesión de WhatsApp cerrada exitosamente.'
      });
    }

    return res.status(502).json({
      success: false,
      code: 'LOGOUT_FAILED',
      error: outRes.error?.message || 'No se pudo cerrar la sesión en el motor de WhatsApp.'
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      code: 'INTERNAL_ERROR',
      error: err.message
    });
  }
});

/**
 * DELETE /v1/instances/:instanceName — Eliminar instancia
 */
router.delete('/instances/:instanceName', apiKeyOrTokenAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { instanceName } = req.params;

  try {
    const verifyRes = await pool.query(
      'SELECT id FROM instances WHERE user_id = $1 AND instance_name = $2',
      [req.userId, instanceName]
    );

    if (verifyRes.rows.length === 0) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        error: 'Acceso no autorizado.'
      });
    }

    // 1. Eliminar del motor
    const engine = await engineRouter.getEngineForInstance(instanceName);
    await engine.deleteInstance(instanceName);

    // 2. Eliminar de Postgres
    await pool.query('DELETE FROM instances WHERE instance_name = $1', [instanceName]);

    // 3. Invalidar caché en memoria
    await engineRouter.invalidateCache(instanceName);

    // 4. Limpiar claves huérfanas en Redis
    try {
      const contactKeys = await redis.keys(`contact:${instanceName}:*`);
      const unreadKeys = await redis.keys(`unread:${instanceName}:*`);
      const allKeys = [...(contactKeys || []), ...(unreadKeys || [])];
      if (allKeys.length > 0) {
        await redis.del(...allKeys);
      }
    } catch {}

    return res.json({
      success: true,
      message: `Instancia "${instanceName}" eliminada correctamente.`
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      code: 'INTERNAL_ERROR',
      error: err.message
    });
  }
});

/**
 * POST /v1/instances/:instanceName/webhook — Configurar URL de webhook para la instancia
 */
router.post('/instances/:instanceName/webhook', apiKeyOrTokenAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { instanceName } = req.params;
  const { url } = req.body;

  if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
    return res.status(400).json({
      success: false,
      code: 'INVALID_WEBHOOK_URL',
      error: 'Se requiere una URL válida que empiece con http:// o https://.'
    });
  }

  try {
    const verifyRes = await pool.query(
      'SELECT id FROM instances WHERE user_id = $1 AND instance_name = $2',
      [req.userId, instanceName]
    );

    if (verifyRes.rows.length === 0) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        error: 'Acceso no autorizado.'
      });
    }

    const engine = await engineRouter.getEngineForInstance(instanceName);
    const setRes = await engine.configureWebhook(instanceName, url);

    if (setRes.success) {
      return res.json({
        success: true,
        message: 'URL de webhook configurada exitosamente.',
        data: { instanceName, webhookUrl: url }
      });
    }

    return res.status(502).json({
      success: false,
      code: 'WEBHOOK_CONFIG_FAILED',
      error: setRes.error?.message || 'No se pudo configurar el webhook en el motor.'
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      code: 'INTERNAL_ERROR',
      error: err.message
    });
  }
});

// ==========================================
// 2. ENVÍO DE MENSAJES CANÓNICO (/v1/messages)
// ==========================================

/**
 * POST /v1/messages/text — Envío de texto con cuotas atómicas e idempotencia
 */
router.post('/messages/text', licensingMiddleware, async (req: LicensedRequest, res: Response) => {
  const { instanceName, number, text } = req.body;
  const ctx = req.licensingContext!;

  if (!instanceName || !number || !text) {
    await ctx.rollback('text', 'INVALID_PARAMS');
    return res.status(400).json({
      success: false,
      code: 'INVALID_REQUEST',
      message: 'Campos requeridos faltantes: instanceName, number y text.'
    });
  }

  try {
    const engine = await engineRouter.getEngineForInstance(instanceName);
    const sentResult = await engine.sendTextMessage({ instanceName, number, text });

    if (sentResult.success) {
      const msgId = sentResult.messageId || sentResult.data?.key?.id || sentResult.data?.id;
      const responsePayload = {
        success: true,
        message: 'Mensaje de texto enviado exitosamente a WhatsApp.',
        data: sentResult.data,
        messageId: msgId
      };

      await ctx.confirmSuccess('text', msgId, responsePayload);
      return res.json(responsePayload);
    }

    const errorReason = sentResult.error?.message || 'ENGINE_SEND_FAILED';
    await ctx.rollback('text', errorReason);
    return res.status(sentResult.error?.statusCode || 502).json({
      success: false,
      code: sentResult.error?.code || 'SEND_FAILED',
      message: sentResult.error?.message || 'Error al enviar mensaje de texto en WhatsApp.',
      details: sentResult.error?.details
    });
  } catch (error: any) {
    await ctx.rollback('text', error.message);
    return res.status(500).json({
      success: false,
      code: 'INTERNAL_ERROR',
      message: `Error interno en el servidor: ${error.message}`
    });
  }
});

/**
 * POST /v1/messages/media — Envío de multimedia (imagen, video, documento)
 */
router.post('/messages/media', licensingMiddleware, async (req: LicensedRequest, res: Response) => {
  const { instanceName, number, mediatype, mimetype, media, caption, fileName } = req.body;
  const ctx = req.licensingContext!;

  if (!instanceName || !number || !mediatype || !mimetype || !media) {
    await ctx.rollback('media', 'INVALID_PARAMS');
    return res.status(400).json({
      success: false,
      code: 'INVALID_REQUEST',
      message: 'Campos requeridos faltantes: instanceName, number, mediatype, mimetype y media.'
    });
  }

  const validTypes = ['image', 'video', 'document', 'audio'];
  if (!validTypes.includes(mediatype)) {
    await ctx.rollback('media', 'INVALID_MEDIATYPE');
    return res.status(400).json({
      success: false,
      code: 'INVALID_MEDIATYPE',
      message: `mediatype inválido. Tipos permitidos: ${validTypes.join(', ')}`
    });
  }

  try {
    const engine = await engineRouter.getEngineForInstance(instanceName);
    const sentResult = await engine.sendMediaMessage({
      instanceName,
      number,
      media,
      mediatype,
      mimetype,
      caption,
      fileName
    });

    if (sentResult.success) {
      const msgId = sentResult.messageId || sentResult.data?.key?.id || sentResult.data?.id;
      const responsePayload = {
        success: true,
        message: `Mensaje multimedia (${mediatype}) enviado exitosamente.`,
        data: sentResult.data,
        messageId: msgId
      };

      await ctx.confirmSuccess(mediatype, msgId, responsePayload);
      return res.json(responsePayload);
    }

    const errorReason = sentResult.error?.message || 'ENGINE_MEDIA_FAILED';
    await ctx.rollback(mediatype, errorReason);
    return res.status(sentResult.error?.statusCode || 502).json({
      success: false,
      code: sentResult.error?.code || 'SEND_FAILED',
      message: sentResult.error?.message || 'Error al enviar archivo multimedia en WhatsApp.'
    });
  } catch (error: any) {
    await ctx.rollback(mediatype, error.message);
    return res.status(500).json({
      success: false,
      code: 'INTERNAL_ERROR',
      message: `Error interno en el servidor: ${error.message}`
    });
  }
});

/**
 * POST /v1/messages/audio — Envío de audio PTT (nota de voz directa)
 */
router.post('/messages/audio', licensingMiddleware, async (req: LicensedRequest, res: Response) => {
  const { instanceName, number, audio } = req.body;
  const ctx = req.licensingContext!;

  if (!instanceName || !number || !audio) {
    await ctx.rollback('audio', 'INVALID_PARAMS');
    return res.status(400).json({
      success: false,
      code: 'INVALID_REQUEST',
      message: 'Campos requeridos faltantes: instanceName, number y audio (URL o Base64).'
    });
  }

  try {
    const engine = await engineRouter.getEngineForInstance(instanceName);
    const sentResult = await engine.sendAudioMessage({ instanceName, number, audio });

    if (sentResult.success) {
      const msgId = sentResult.messageId || sentResult.data?.key?.id || sentResult.data?.id;
      const responsePayload = {
        success: true,
        message: 'Nota de voz PTT enviada exitosamente a WhatsApp.',
        data: sentResult.data,
        messageId: msgId
      };

      await ctx.confirmSuccess('audio_ptt', msgId, responsePayload);
      return res.json(responsePayload);
    }

    const errorReason = sentResult.error?.message || 'ENGINE_AUDIO_FAILED';
    await ctx.rollback('audio_ptt', errorReason);
    return res.status(sentResult.error?.statusCode || 502).json({
      success: false,
      code: sentResult.error?.code || 'SEND_FAILED',
      message: sentResult.error?.message || 'Error al enviar nota de voz en WhatsApp.'
    });
  } catch (error: any) {
    await ctx.rollback('audio_ptt', error.message);
    return res.status(500).json({
      success: false,
      code: 'INTERNAL_ERROR',
      message: `Error interno en el servidor: ${error.message}`
    });
  }
});

/**
 * POST /v1/messages/location — Envío de ubicación GPS
 */
router.post('/messages/location', licensingMiddleware, async (req: LicensedRequest, res: Response) => {
  const { instanceName, number, name, address, latitude, longitude } = req.body;
  const ctx = req.licensingContext!;

  if (!instanceName || !number || latitude === undefined || longitude === undefined) {
    await ctx.rollback('location', 'INVALID_PARAMS');
    return res.status(400).json({
      success: false,
      code: 'INVALID_REQUEST',
      message: 'Campos requeridos faltantes: instanceName, number, latitude y longitude.'
    });
  }

  const lat = Number(latitude);
  const lon = Number(longitude);

  if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    await ctx.rollback('location', 'INVALID_COORDINATES');
    return res.status(400).json({
      success: false,
      code: 'INVALID_COORDINATES',
      message: 'Coordenadas geográficas inválidas: latitude [-90, 90], longitude [-180, 180].'
    });
  }

  try {
    const engine = await engineRouter.getEngineForInstance(instanceName);
    const sentResult = await engine.sendLocationMessage({
      instanceName,
      number,
      name,
      address,
      latitude: lat,
      longitude: lon
    });

    if (sentResult.success) {
      const msgId = sentResult.messageId || sentResult.data?.key?.id || sentResult.data?.id;
      const responsePayload = {
        success: true,
        message: 'Ubicación enviada exitosamente a WhatsApp.',
        data: sentResult.data,
        messageId: msgId
      };

      await ctx.confirmSuccess('location', msgId, responsePayload);
      return res.json(responsePayload);
    }

    const errorReason = sentResult.error?.message || 'ENGINE_LOCATION_FAILED';
    await ctx.rollback('location', errorReason);
    return res.status(sentResult.error?.statusCode || 502).json({
      success: false,
      code: sentResult.error?.code || 'SEND_FAILED',
      message: sentResult.error?.message || 'Error al enviar ubicación en WhatsApp.'
    });
  } catch (error: any) {
    await ctx.rollback('location', error.message);
    return res.status(500).json({
      success: false,
      code: 'INTERNAL_ERROR',
      message: `Error interno en el servidor: ${error.message}`
    });
  }
});

/**
 * POST /v1/messages/contact — Envío de contacto vCard
 */
router.post('/messages/contact', licensingMiddleware, async (req: LicensedRequest, res: Response) => {
  const { instanceName, number, contact } = req.body;
  const ctx = req.licensingContext!;

  if (!instanceName || !number || !contact || !Array.isArray(contact) || contact.length === 0) {
    await ctx.rollback('contact', 'INVALID_PARAMS');
    return res.status(400).json({
      success: false,
      code: 'INVALID_REQUEST',
      message: 'Campos requeridos faltantes: instanceName, number y contact (arreglo con al menos 1 contacto).'
    });
  }

  try {
    const engine = await engineRouter.getEngineForInstance(instanceName);
    const sentResult = await engine.sendContactMessage({
      instanceName,
      number,
      contact
    });

    if (sentResult.success) {
      const msgId = sentResult.messageId || sentResult.data?.key?.id || sentResult.data?.id;
      const responsePayload = {
        success: true,
        message: 'Contacto enviado exitosamente a WhatsApp.',
        data: sentResult.data,
        messageId: msgId
      };

      await ctx.confirmSuccess('contact', msgId, responsePayload);
      return res.json(responsePayload);
    }

    const errorReason = sentResult.error?.message || 'ENGINE_CONTACT_FAILED';
    await ctx.rollback('contact', errorReason);
    return res.status(sentResult.error?.statusCode || 502).json({
      success: false,
      code: sentResult.error?.code || 'SEND_FAILED',
      message: sentResult.error?.message || 'Error al enviar tarjeta de contacto en WhatsApp.'
    });
  } catch (error: any) {
    await ctx.rollback('contact', error.message);
    return res.status(500).json({
      success: false,
      code: 'INTERNAL_ERROR',
      message: `Error interno en el servidor: ${error.message}`
    });
  }
});

export default router;
