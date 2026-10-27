import { Router, Response } from 'express';
import * as crypto from 'crypto';
import pool from '../config/database';
import { apiKeyOrTokenAuth, AuthenticatedRequest } from '../middleware/auth.middleware';
import { licensingMiddleware, LicensedRequest } from '../middleware/licensing.middleware';
import { engineRouter } from '../engines/core/EngineRouter';
import { EngineType } from '../engines/contracts/engine.types';
import { validateWebhookUrl } from '../utils/ssrf-validator.util';
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

    // 2. Validar que el nombre de instancia no exista globalmente bajo otro usuario
    const nameCheck = await pool.query('SELECT id, user_id FROM instances WHERE instance_name = $1 OR name = $1', [instanceName]);
    if (nameCheck.rows.length > 0 && nameCheck.rows[0].user_id && nameCheck.rows[0].user_id !== req.userId) {
      return res.status(409).json({
        success: false,
        code: 'INSTANCE_NAME_TAKEN',
        error: 'El nombre de esta instancia ya se encuentra registrado. Utiliza un nombre único.'
      });
    }

    // 3. Resolver motor solicitado (evolution_go por defecto)
    const targetEngine: EngineType = (targetEngineParam === 'evolution_api' && process.env.EVOLUTION_GO_ENABLED === 'false')
      ? 'evolution_api'
      : 'evolution_go';

    const engine = engineRouter.getEngineByType(targetEngine);
    const evoResult = await engine.createInstance(instanceName);

    if (!evoResult.success || !evoResult.data?.token) {
      const statusCode = evoResult.error?.statusCode && evoResult.error.statusCode !== 502 ? evoResult.error.statusCode : 422;
      return res.status(statusCode).json({
        success: false,
        code: evoResult.error?.code || 'ENGINE_CREATE_FAILED',
        error: evoResult.error?.message || 'Error al aprovisionar la instancia en el motor de WhatsApp.'
      });
    }

    // 4. Guardar o vincular en base de datos
    const fallbackId = crypto.randomUUID();
    const apiKey = evoResult.data.token;

    const upsertRes = await pool.query(`
      INSERT INTO instances (id, user_id, instance_name, name, status, api_key, token, engine_type)
      VALUES ($1, $2, $3, $3, $4, $5, $5, $6)
      ON CONFLICT (instance_name) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        status = EXCLUDED.status,
        api_key = COALESCE(EXCLUDED.api_key, instances.api_key),
        token = COALESCE(EXCLUDED.token, instances.token),
        engine_type = EXCLUDED.engine_type,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id, api_key
    `, [fallbackId, req.userId, instanceName, 'disconnected', apiKey, targetEngine]);

    const finalId = upsertRes.rows[0]?.id || fallbackId;
    const finalApiKey = upsertRes.rows[0]?.api_key || apiKey;

    return res.status(201).json({
      success: true,
      message: 'Instancia creada exitosamente.',
      data: {
        id: finalId,
        instanceName: instanceName,
        status: 'disconnected',
        apiKey: finalApiKey,
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
    const isElevated = req.userRole === 'partner' || req.userRole === 'admin';
    const instRes = isElevated
      ? await pool.query(
          'SELECT id, instance_name, phone, status, api_key, engine_type, is_enabled, messages_sent, last_activity_at, created_at FROM instances WHERE instance_name = $1 OR name = $1',
          [instanceName]
        )
      : await pool.query(
          'SELECT id, instance_name, phone, status, api_key, engine_type, is_enabled, messages_sent, last_activity_at, created_at FROM instances WHERE user_id = $1 AND (instance_name = $2 OR name = $2)',
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
const getQrEndpointHandler = async (req: AuthenticatedRequest, res: Response) => {
  const { instanceName } = req.params;

  try {
    const isElevated = req.userRole === 'partner' || req.userRole === 'admin';
    const verifyRes = isElevated
      ? await pool.query('SELECT id FROM instances WHERE instance_name = $1 OR name = $1', [instanceName])
      : await pool.query('SELECT id FROM instances WHERE user_id = $1 AND (instance_name = $2 OR name = $2)', [req.userId, instanceName]);

    if (verifyRes.rows.length === 0) {
      if (isElevated) {
        let tenantUserId: string | null = null;
        try {
          const uRes = await pool.query(
            `SELECT id FROM users
             WHERE external_id IS NOT NULL AND ($1 = external_id OR $1 LIKE (external_id || '__%'))
             LIMIT 1`,
            [instanceName]
          );
          if (uRes.rows.length > 0) {
            tenantUserId = uRes.rows[0].id;
          }
        } catch {}

        // Crear primero en Evolution Go para que el motor inserte su propio UUID en memoria y BD
        const goEngine = engineRouter.getEngineByType('evolution_go');
        const created = await goEngine.createInstance(instanceName);
        const fallbackId = crypto.randomUUID();
        const token = created.data?.token || crypto.randomUUID().toUpperCase();

        await pool.query(
          `INSERT INTO instances (id, user_id, instance_name, name, status, api_key, token, engine_type)
           VALUES ($1, $2, $3, $3, 'disconnected', $4, $4, 'evolution_go')
           ON CONFLICT (instance_name) DO UPDATE SET
             user_id = COALESCE(instances.user_id, EXCLUDED.user_id),
             api_key = COALESCE(EXCLUDED.api_key, instances.api_key),
             token = COALESCE(EXCLUDED.token, instances.token),
             engine_type = 'evolution_go',
             updated_at = CURRENT_TIMESTAMP`,
          [fallbackId, tenantUserId, instanceName, token]
        );
      } else {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          error: 'Acceso no autorizado a esta instancia.'
        });
      }
    }

    let engine = await engineRouter.getEngineForInstance(instanceName);

    // 0. Si la instancia ya está físicamente conectada en WhatsApp, responder inmediatamente con 200 OK
    try {
      const liveStateRes = await engine.getConnectionState(instanceName);
      if (liveStateRes.data?.isConnected) {
        await pool.query("UPDATE instances SET status = 'connected', updated_at = CURRENT_TIMESTAMP WHERE instance_name = $1", [instanceName]);
        return res.json({
          success: true,
          instanceName,
          alreadyConnected: true,
          isConnected: true,
          status: 'connected',
          state: 'connected',
          qrcode: null,
          base64: null,
          qr: null,
          data: {
            alreadyConnected: true,
            isConnected: true,
            status: 'connected'
          },
          message: 'La instancia ya se encuentra conectada y activa en WhatsApp.'
        });
      }
    } catch {}

    let qrRes = await engine.getQRCode(instanceName);

    if (qrRes.success && (qrRes.data as any)?.alreadyConnected) {
      await pool.query("UPDATE instances SET status = 'connected', updated_at = CURRENT_TIMESTAMP WHERE instance_name = $1", [instanceName]);
      return res.json({
        success: true,
        instanceName,
        alreadyConnected: true,
        isConnected: true,
        status: 'connected',
        state: 'connected',
        qrcode: null,
        base64: null,
        qr: null,
        data: {
          alreadyConnected: true,
          isConnected: true,
          status: 'connected'
        },
        message: 'La instancia ya se encuentra conectada y activa en WhatsApp.'
      });
    }

    // Fallback reactivo inteligente: Si evolution_api falla en generar QR, intentar inmediatamente con evolution_go
    if ((!qrRes.success || !qrRes.data?.qrcode) && engine.engineType !== 'evolution_go') {
      try {
        console.log(`⚠️ [v1/qr] Motor ${engine.engineType} no retornó QR para "${instanceName}". Intentando fallback a Evolution Go...`);
        const goEngine = engineRouter.getEngineByType('evolution_go');
        const goRes = await goEngine.getQRCode(instanceName);
        if (goRes.success && goRes.data?.qrcode) {
          console.log(`✅ [v1/qr] Fallback exitoso con Evolution Go para "${instanceName}". Actualizando base de datos.`);
          qrRes = goRes;
          await pool.query("UPDATE instances SET engine_type = 'evolution_go', updated_at = CURRENT_TIMESTAMP WHERE instance_name = $1", [instanceName]);
          await engineRouter.invalidateCache(instanceName);
        }
      } catch (fbErr: any) {
        console.warn(`[v1/qr] Fallback a Go falló:`, fbErr.message);
      }
    }

    if (!qrRes.success || !qrRes.data?.qrcode) {
      return res.status(422).json({
        success: false,
        code: qrRes.error?.code || 'QR_FETCH_FAILED',
        error: qrRes.error?.message || 'No se pudo generar el código QR. Verifica si la instancia ya está conectada.'
      });
    }

    return res.json({
      success: true,
      instanceName,
      qrcode: qrRes.data.qrcode,
      base64: qrRes.data.qrcode,
      qr: qrRes.data.qrcode,
      data: {
        qrcode: qrRes.data.qrcode,
        base64: qrRes.data.qrcode,
        qr: qrRes.data.qrcode
      }
    });
  } catch (err: any) {
    console.error('[v1/instances/qr] Error:', err.message);
    return res.status(500).json({
      success: false,
      code: 'INTERNAL_ERROR',
      error: `Error interno al obtener código QR: ${err.message}`
    });
  }
};

router.get('/instances/:instanceName/qr', apiKeyOrTokenAuth, getQrEndpointHandler);
router.get('/instances/:instanceName/connect', apiKeyOrTokenAuth, getQrEndpointHandler);
router.get('/instances/qr/:instanceName', apiKeyOrTokenAuth, getQrEndpointHandler);
router.get('/instances/connect/:instanceName', apiKeyOrTokenAuth, getQrEndpointHandler);
router.get('/instance/connect/:instanceName', apiKeyOrTokenAuth, getQrEndpointHandler);
router.get('/instance/qr/:instanceName', apiKeyOrTokenAuth, getQrEndpointHandler);

/**
 * GET /v1/instances/:instanceName/status — Consultar estado de conexión en vivo
 */
const getStatusEndpointHandler = async (req: AuthenticatedRequest, res: Response) => {
  const { instanceName } = req.params;

  try {
    const isElevated = req.userRole === 'partner' || req.userRole === 'admin';
    const verifyRes = isElevated
      ? await pool.query('SELECT id, status FROM instances WHERE instance_name = $1 OR name = $1', [instanceName])
      : await pool.query('SELECT id, status FROM instances WHERE user_id = $1 AND (instance_name = $2 OR name = $2)', [req.userId, instanceName]);

    if (verifyRes.rows.length === 0) {
      if (isElevated) {
        return res.json({
          success: true,
          instanceName,
          state: 'disconnected',
          isConnected: false,
          status: 'disconnected'
        });
      }
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
      isConnected,
      status: state
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      code: 'INTERNAL_ERROR',
      error: err.message
    });
  }
};

router.get('/instances/:instanceName/status', apiKeyOrTokenAuth, getStatusEndpointHandler);
router.get('/instances/status/:instanceName', apiKeyOrTokenAuth, getStatusEndpointHandler);
router.get('/instance/status/:instanceName', apiKeyOrTokenAuth, getStatusEndpointHandler);
router.get('/instance/:instanceName/status', apiKeyOrTokenAuth, getStatusEndpointHandler);
router.get('/instances/:instanceName/connectionState', apiKeyOrTokenAuth, getStatusEndpointHandler);
router.get('/instance/connectionState/:instanceName', apiKeyOrTokenAuth, getStatusEndpointHandler);

// ==========================================
// 1.1. GESTIÓN DE GRUPOS DE WHATSAPP (ERP / API)
// ==========================================

/**
 * GET /v1/instances/:instanceName/groups — Listar todos los grupos de WhatsApp de la instancia
 */
router.get('/instances/:instanceName/groups', apiKeyOrTokenAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { instanceName } = req.params;
  const getParticipants = req.query.getParticipants !== 'false';

  try {
    // 1. Validar propiedad y autorización del tenant sobre la instancia
    const verifyRes = await pool.query(
      'SELECT id, status, engine_type FROM instances WHERE user_id = $1 AND instance_name = $2',
      [req.userId, instanceName]
    );

    if (verifyRes.rows.length === 0) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        error: 'Acceso no autorizado a esta instancia.'
      });
    }

    // 2. Obtener motor asignado
    const engine = await engineRouter.getEngineForInstance(instanceName);

    if (typeof (engine as any).getGroups !== 'function') {
      return res.status(501).json({
        success: false,
        code: 'NOT_SUPPORTED',
        error: `El motor ${engine.engineType} no tiene implementado soporte de grupos.`
      });
    }

    // 3. Consultar grupos en el motor de WhatsApp
    const groupsRes = await (engine as any).getGroups(instanceName, getParticipants);

    if (!groupsRes.success) {
      return res.status(groupsRes.error?.statusCode && groupsRes.error.statusCode !== 502 ? groupsRes.error.statusCode : 422).json({
        success: false,
        code: groupsRes.error?.code || 'GROUPS_FETCH_FAILED',
        error: groupsRes.error?.message || 'Error al obtener la lista de grupos desde WhatsApp.'
      });
    }

    // 4. Normalizar formato canónico para ERPs e integraciones
    const rawGroups = Array.isArray(groupsRes.data) ? groupsRes.data : [];
    const formattedGroups = rawGroups.map((g: any) => ({
      id: g.id || g.jid || g.groupJid,
      subject: g.subject || g.name || 'Sin Asunto',
      subjectOwner: g.subjectOwner || null,
      size: g.size !== undefined ? g.size : (Array.isArray(g.participants) ? g.participants.length : 0),
      creation: g.creation || g.creationTime || null,
      owner: g.owner || null,
      desc: g.desc || g.description || null,
      restrict: Boolean(g.restrict),
      announce: Boolean(g.announce),
      participants: getParticipants ? (g.participants || []) : undefined
    }));

    return res.json({
      success: true,
      instanceName,
      total: formattedGroups.length,
      data: formattedGroups
    });
  } catch (err: any) {
    console.error('[v1/instances/groups] Error:', err.message);
    return res.status(500).json({
      success: false,
      code: 'INTERNAL_ERROR',
      error: `Error interno al consultar grupos: ${err.message}`
    });
  }
});

/**
 * POST /v1/instances/:instanceName/groups — Crear un nuevo grupo de WhatsApp desde ERP
 */
router.post('/instances/:instanceName/groups', apiKeyOrTokenAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { instanceName } = req.params;
  const { subject, description, participants } = req.body;

  if (!subject || typeof subject !== 'string') {
    return res.status(400).json({
      success: false,
      code: 'INVALID_REQUEST',
      error: 'El campo "subject" (nombre del grupo) es requerido.'
    });
  }

  if (!participants || !Array.isArray(participants) || participants.length === 0) {
    return res.status(400).json({
      success: false,
      code: 'INVALID_REQUEST',
      error: 'El campo "participants" debe ser un arreglo con al menos 1 número o JID.'
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
        error: 'Acceso no autorizado a esta instancia.'
      });
    }

    // Limpiar teléfonos a formato JID canónico
    const cleanedParticipants = participants.map((num: string) => {
      const cleanNum = num.split('@')[0].replace(/\D/g, '');
      return `${cleanNum}@s.whatsapp.net`;
    });

    const engine = await engineRouter.getEngineForInstance(instanceName);
    if (typeof (engine as any).createGroup !== 'function') {
      return res.status(501).json({
        success: false,
        code: 'NOT_SUPPORTED',
        error: `El motor ${engine.engineType} no soporta creación de grupos.`
      });
    }

    const createRes = await (engine as any).createGroup(instanceName, subject, cleanedParticipants);

    if (!createRes.success) {
      return res.status(createRes.error?.statusCode && createRes.error.statusCode !== 502 ? createRes.error.statusCode : 422).json({
        success: false,
        code: createRes.error?.code || 'GROUP_CREATE_FAILED',
        error: createRes.error?.message || 'Error al crear grupo en WhatsApp.'
      });
    }

    return res.status(201).json({
      success: true,
      message: `Grupo "${subject}" creado exitosamente en WhatsApp.`,
      data: createRes.data
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
 * POST /v1/instances/:instanceName/groups/participants — Gestionar miembros del grupo (add, remove, promote, demote)
 */
router.post('/instances/:instanceName/groups/participants', apiKeyOrTokenAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { instanceName } = req.params;
  const { groupJid, action, participants } = req.body;

  const validActions = ['add', 'remove', 'promote', 'demote'];
  if (!groupJid || !action || !validActions.includes(action) || !Array.isArray(participants) || participants.length === 0) {
    return res.status(400).json({
      success: false,
      code: 'INVALID_REQUEST',
      error: `Parámetros inválidos. Requiere groupJid, action (${validActions.join(', ')}) y arreglo participants.`
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
        error: 'Acceso no autorizado a esta instancia.'
      });
    }

    const cleanParticipants = participants.map((num: string) => {
      const cleanNum = num.split('@')[0].replace(/\D/g, '');
      return `${cleanNum}@s.whatsapp.net`;
    });

    const engine = await engineRouter.getEngineForInstance(instanceName);
    if (typeof (engine as any).updateGroupParticipants !== 'function') {
      return res.status(501).json({
        success: false,
        code: 'NOT_SUPPORTED',
        error: `El motor ${engine.engineType} no soporta administración de miembros de grupo.`
      });
    }

    const updateRes = await (engine as any).updateGroupParticipants(instanceName, groupJid, action, cleanParticipants);

    if (!updateRes.success) {
      return res.status(updateRes.error?.statusCode && updateRes.error.statusCode !== 502 ? updateRes.error.statusCode : 422).json({
        success: false,
        code: updateRes.error?.code || 'GROUP_UPDATE_FAILED',
        error: updateRes.error?.message || 'Error al actualizar miembros del grupo.'
      });
    }

    return res.json({
      success: true,
      message: `Acción "${action}" ejecutada exitosamente para ${cleanParticipants.length} participante(s).`,
      data: updateRes.data
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
 * GET /v1/instances/:instanceName/groups/:groupId/invite-code — Obtener enlace de invitación a un grupo
 */
router.get('/instances/:instanceName/groups/:groupId/invite-code', apiKeyOrTokenAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { instanceName, groupId } = req.params;

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

    const groupJid = groupId.includes('@') ? groupId : `${groupId}@g.us`;
    const engine = await engineRouter.getEngineForInstance(instanceName);

    if (typeof (engine as any).getGroupInviteCode !== 'function') {
      return res.status(501).json({
        success: false,
        code: 'NOT_SUPPORTED',
        error: `El motor ${engine.engineType} no soporta enlaces de invitación de grupos.`
      });
    }

    const inviteRes = await (engine as any).getGroupInviteCode(instanceName, groupJid);

    if (!inviteRes.success) {
      return res.status(inviteRes.error?.statusCode && inviteRes.error.statusCode !== 502 ? inviteRes.error.statusCode : 422).json({
        success: false,
        code: inviteRes.error?.code || 'INVITE_CODE_FAILED',
        error: inviteRes.error?.message || 'Error al obtener enlace de invitación.'
      });
    }

    return res.json({
      success: true,
      instanceName,
      groupJid,
      data: inviteRes.data
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
 * POST /v1/instances/:instanceName/reconnect — Reconectar sesión activa sin solicitar nuevo QR
 */
router.post('/instances/:instanceName/reconnect', apiKeyOrTokenAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { instanceName } = req.params;

  try {
    const isElevated = req.userRole === 'partner' || req.userRole === 'admin';
    const verifyRes = isElevated
      ? await pool.query('SELECT id, status FROM instances WHERE instance_name = $1 OR name = $1', [instanceName])
      : await pool.query('SELECT id, status FROM instances WHERE user_id = $1 AND (instance_name = $2 OR name = $2)', [req.userId, instanceName]);

    if (verifyRes.rows.length === 0) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        error: 'Acceso no autorizado a esta instancia.'
      });
    }

    const engine = await engineRouter.getEngineForInstance(instanceName);
    let reconnectRes: any;
    if (typeof (engine as any).reconnect === 'function') {
      reconnectRes = await (engine as any).reconnect(instanceName);
    } else {
      reconnectRes = await engine.getConnectionState(instanceName);
    }

    const isConnected = Boolean(reconnectRes.data?.isConnected);
    const state = reconnectRes.data?.state || (isConnected ? 'connected' : 'reconnecting');
    const newDbStatus = isConnected ? 'connected' : 'reconnecting';

    await pool.query(
      "UPDATE instances SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE instance_name = $2",
      [newDbStatus, instanceName]
    );

    return res.json({
      success: true,
      instanceName,
      state,
      status: newDbStatus,
      isConnected,
      requiresQr: false
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
 * POST /v1/instances/:instanceName/restart — Reiniciar conexión de la instancia
 */
router.post('/instances/:instanceName/restart', apiKeyOrTokenAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { instanceName } = req.params;

  try {
    const isElevated = req.userRole === 'partner' || req.userRole === 'admin';
    const verifyRes = isElevated
      ? await pool.query('SELECT id FROM instances WHERE instance_name = $1 OR name = $1', [instanceName])
      : await pool.query('SELECT id FROM instances WHERE user_id = $1 AND (instance_name = $2 OR name = $2)', [req.userId, instanceName]);

    if (verifyRes.rows.length === 0) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        error: 'Acceso no autorizado a esta instancia.'
      });
    }

    const engine = await engineRouter.getEngineForInstance(instanceName);
    let restartRes: any;
    if (typeof (engine as any).reconnect === 'function') {
      restartRes = await (engine as any).reconnect(instanceName);
    } else {
      restartRes = await engine.getConnectionState(instanceName);
    }

    return res.json({
      success: true,
      instanceName,
      message: 'Instancia reiniciada correctamente.',
      data: restartRes.data
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
 * POST /v1/instances/:instanceName/clean-reset — Reinicio limpio completo (purga sesión previa y recrea en Evolution Go)
 */
router.post('/instances/:instanceName/clean-reset', apiKeyOrTokenAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { instanceName } = req.params;

  try {
    const isElevated = req.userRole === 'partner' || req.userRole === 'admin';
    const verifyRes = isElevated
      ? await pool.query('SELECT id FROM instances WHERE instance_name = $1 OR name = $1', [instanceName])
      : await pool.query('SELECT id FROM instances WHERE user_id = $1 AND (instance_name = $2 OR name = $2)', [req.userId, instanceName]);

    if (verifyRes.rows.length === 0) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        error: 'Acceso no autorizado a esta instancia.'
      });
    }

    // 1. Desconectar y purgar en motor actual
    try {
      const currentEngine = await engineRouter.getEngineForInstance(instanceName);
      await currentEngine.logout(instanceName);
      await currentEngine.deleteInstance(instanceName);
    } catch {}

    // 2. Recrear limpia en Evolution Go
    const goEngine = engineRouter.getEngineByType('evolution_go');
    const evoRes = await goEngine.createInstance(instanceName);
    const token = evoRes.data?.token || `token_${Date.now()}`;

    // 3. Actualizar Postgres a Evolution Go
    await pool.query(
      "UPDATE instances SET engine_type = 'evolution_go', status = 'disconnected', api_key = $1, token = $1, updated_at = CURRENT_TIMESTAMP WHERE instance_name = $2",
      [token, instanceName]
    );
    await engineRouter.invalidateCache(instanceName);

    return res.json({
      success: true,
      instanceName,
      message: 'Reinicio limpio completado exitosamente en Evolution Go.',
      data: evoRes.data
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
    const isElevated = req.userRole === 'partner' || req.userRole === 'admin';
    const verifyRes = isElevated
      ? await pool.query('SELECT id FROM instances WHERE instance_name = $1 OR name = $1', [instanceName])
      : await pool.query('SELECT id FROM instances WHERE user_id = $1 AND (instance_name = $2 OR name = $2)', [req.userId, instanceName]);

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
      await pool.query("UPDATE instances SET status = 'logged_out', updated_at = CURRENT_TIMESTAMP WHERE instance_name = $1", [instanceName]);
      return res.json({
        success: true,
        message: 'Sesión de WhatsApp cerrada exitosamente.'
      });
    }

    return res.status(422).json({
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
    const isElevated = req.userRole === 'partner' || req.userRole === 'admin';
    const verifyRes = isElevated
      ? await pool.query('SELECT id FROM instances WHERE instance_name = $1 OR name = $1', [instanceName])
      : await pool.query('SELECT id FROM instances WHERE user_id = $1 AND (instance_name = $2 OR name = $2)', [req.userId, instanceName]);

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
 * POST /v1/instances/:instanceName/webhook — Configurar URL de webhook para ERP externo con firma HMAC
 */
router.post('/instances/:instanceName/webhook', apiKeyOrTokenAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { instanceName } = req.params;
  const { url, enabled } = req.body;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({
      success: false,
      code: 'INVALID_WEBHOOK_URL',
      error: 'Se requiere una URL válida que empiece con http:// o https://.'
    });
  }

  // 1. Validación estricta anti-SSRF (bloquea IPs privadas, loopback, cloud metadata y DNS rebinding)
  const ssrfCheck = await validateWebhookUrl(url);
  if (!ssrfCheck.isValid) {
    return res.status(400).json({
      success: false,
      code: 'SSRF_BLOCKED',
      error: ssrfCheck.reason || 'URL rechazada por política de seguridad anti-SSRF.'
    });
  }

  try {
    const verifyRes = await pool.query(
      'SELECT id, webhook_secret FROM instances WHERE user_id = $1 AND instance_name = $2',
      [req.userId, instanceName]
    );

    if (verifyRes.rows.length === 0) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        error: 'Acceso no autorizado a esta instancia.'
      });
    }

    // 2. Generar o recuperar secreto de firma HMAC-SHA256
    const webhookSecret = verifyRes.rows[0].webhook_secret || `whsec_${crypto.randomBytes(24).toString('hex')}`;
    const isEnabled = enabled !== false;

    // 3. Guardar configuración en PostgreSQL
    await pool.query(`
      UPDATE instances
      SET webhook_url = $1, webhook_secret = $2, webhook_enabled = $3, updated_at = CURRENT_TIMESTAMP
      WHERE instance_name = $4
    `, [ssrfCheck.normalizedUrl || url, webhookSecret, isEnabled, instanceName]);

    // 4. Invalidar caché en Redis para actualización inmediata del dispatcher
    try {
      await redis.del(`inst_wh:${instanceName}`);
    } catch {}

    return res.json({
      success: true,
      message: 'URL de webhook para ERP y firma HMAC-SHA256 configuradas exitosamente.',
      data: {
        instanceName,
        webhookUrl: ssrfCheck.normalizedUrl || url,
        webhookSecret: webhookSecret,
        enabled: isEnabled,
        signatureHeader: 'X-Zaza-Signature',
        timestampHeader: 'X-Zaza-Timestamp',
        eventHeader: 'X-Zaza-Event',
        deliveryIdHeader: 'X-Zaza-Delivery-Id',
        algorithm: 'HMAC-SHA256',
        format: 'sha256=<hex_digest>'
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
    return res.status(sentResult.error?.statusCode || 422).json({
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
    return res.status(sentResult.error?.statusCode || 422).json({
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
    return res.status(sentResult.error?.statusCode || 422).json({
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
    return res.status(sentResult.error?.statusCode && sentResult.error.statusCode !== 502 ? sentResult.error.statusCode : 422).json({
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
    return res.status(sentResult.error?.statusCode && sentResult.error.statusCode !== 502 ? sentResult.error.statusCode : 422).json({
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
