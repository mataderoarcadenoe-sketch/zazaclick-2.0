import { Router, Response } from 'express';
import * as crypto from 'crypto';
import pool from '../config/database';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.middleware';
import { engineRouter } from '../engines/core/EngineRouter';
import { EngineType } from '../engines/contracts/engine.types';
import redis from '../config/redis';

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
    // 1. Verificar límites de la suscripción del usuario (o permitir libre creación si es SuperAdmin)
    let maxInstances = 1;

    if (req.userRole === 'admin') {
      maxInstances = 99;
    } else {
      console.log(`[Create] PASO 1 — Consultando suscripción para userId=${req.userId}`);
      const subRes = await pool.query(`
        SELECT p.max_instances
        FROM subscriptions s
        JOIN plans p ON s.plan_id = p.id
        WHERE s.user_id = $1 AND s.status IN ('active', 'trial')
        ORDER BY s.created_at DESC LIMIT 1
      `, [req.userId]);

      console.log(`[Create] PASO 1 result — rows=${subRes?.rows?.length}`);

      if (!subRes || !subRes.rows || subRes.rows.length === 0) {
        return res.status(403).json({ success: false, error: 'No tienes una suscripción activa o de prueba para crear instancias.' });
      }

      maxInstances = subRes.rows[0].max_instances;
    }

    console.log(`[Create] PASO 2 — maxInstances=${maxInstances}`);

    // Contar instancias actuales creadas por el usuario
    const currentInstancesRes = await pool.query('SELECT COUNT(*) FROM instances WHERE user_id = $1', [req.userId]);
    const currentCount = parseInt(currentInstancesRes.rows[0].count);
    console.log(`[Create] PASO 2 — currentCount=${currentCount}`);

    if (currentCount >= maxInstances) {
      return res.status(400).json({ success: false, error: `Límite alcanzado: Tu plan actual solo permite un máximo de ${maxInstances} instancia(s). Elimina una instancia primero.` });
    }

    // 2. Verificar si el nombre de instancia ya está tomado en nuestra BD por otro usuario
    console.log(`[Create] PASO 3 — Verificando nombre ${instanceName}`);
    const nameCheck = await pool.query('SELECT id, user_id FROM instances WHERE instance_name = $1 OR name = $1', [instanceName]);
    if (nameCheck.rows.length > 0 && nameCheck.rows[0].user_id && nameCheck.rows[0].user_id !== req.userId) {
      return res.status(400).json({ success: false, error: 'El nombre de esta instancia ya está en uso. Elige otro.' });
    }

    // 3. Resolver motor oficial unificado (Evolution Go / Whatsmeow)
    const targetEngine: EngineType = 'evolution_go';

    console.log(`[Create] PASO 4 — Creando instancia en motor ${targetEngine} para ${instanceName}`);
    const engine = engineRouter.getEngineByType(targetEngine);
    const evoResult = await engine.createInstance(instanceName);
    console.log(`[Create] PASO 4 result — success=${evoResult.success}`);

    if (!evoResult.success || !evoResult.data?.token) {
      const statusCode = evoResult.error?.statusCode || 500;
      return res.status(statusCode).json({ success: false, error: evoResult.error?.message || 'Error al crear la instancia en el motor de WhatsApp' });
    }

    // 4. Guardar o vincular la instancia en la base de datos de Zaza (Evolution Go ya inserta la fila en `instances`)
    console.log(`[Create] PASO 5 — Guardando instancia en BD con engine_type=${targetEngine}`);
    const fallbackId = crypto.randomUUID();
    const apiKey = evoResult.data.token;

    const upsertRes = await pool.query(`
      INSERT INTO instances (id, user_id, instance_name, name, status, api_key, token, engine_type)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (instance_name) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        status = EXCLUDED.status,
        api_key = COALESCE(EXCLUDED.api_key, instances.api_key),
        token = COALESCE(EXCLUDED.token, instances.token),
        engine_type = EXCLUDED.engine_type,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id, api_key
    `, [fallbackId, req.userId, instanceName, instanceName, 'disconnected', apiKey, apiKey, targetEngine]);

    const finalId = upsertRes.rows[0]?.id || fallbackId;
    const finalApiKey = upsertRes.rows[0]?.api_key || apiKey;

    console.log(`[Create] ÉXITO — Instancia ${instanceName} creada correctamente (id=${finalId})`);

    res.status(201).json({
      success: true,
      message: 'Instancia creada exitosamente.',
      data: {
        id: finalId,
        instance_name: instanceName,
        status: 'disconnected',
        api_key: finalApiKey,
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
        const isConnected = Boolean(stateRes.data?.isConnected);
        
        // Si el motor reporta conectada y en BD no figuraba connected, sincronizar a connected
        if (isConnected && inst.status !== 'connected') {
          console.log(`🔄 [InstanceList] Sincronizando estado de "${inst.instance_name}": ${inst.status} -> connected`);
          await pool.query(
            "UPDATE instances SET status = 'connected', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
            [inst.id]
          );
          inst.status = 'connected';
        } else if (!isConnected && inst.status === 'connected') {
          // Si el socket tuvo un corte temporal, marcar como reconnecting (NUNCA disconnected de golpe)
          console.log(`🔄 [InstanceList] Socket en reposo para "${inst.instance_name}": connected -> reconnecting`);
          await pool.query(
            "UPDATE instances SET status = 'reconnecting', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
            [inst.id]
          );
          inst.status = 'reconnecting';
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
    const isElevated = req.userRole === 'partner' || req.userRole === 'admin';
    const verifyRes = isElevated
      ? await pool.query('SELECT id FROM instances WHERE instance_name = $1 OR name = $1', [instanceName])
      : await pool.query('SELECT id FROM instances WHERE user_id = $1 AND (instance_name = $2 OR name = $2)', [req.userId, instanceName]);
    if (verifyRes.rows.length === 0) {
      return res.status(403).json({ success: false, error: 'Acceso no autorizado a esta instancia.' });
    }

    // Solicitar el QR al motor asignado
    const engine = await engineRouter.getEngineForInstance(instanceName);
    const qrRes = await engine.getQRCode(instanceName);

    if (qrRes.success && (qrRes.data as any)?.alreadyConnected) {
      return res.json({
        success: true,
        alreadyConnected: true,
        isConnected: true,
        status: 'connected',
        state: 'connected',
        qrcode: null,
        base64: null
      });
    }

    if (!qrRes.success || !qrRes.data?.qrcode) {
      return res.status(422).json({ success: false, error: qrRes.error?.message || 'Error al obtener código QR.' });
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
      await pool.query("UPDATE instances SET status = 'logged_out', updated_at = CURRENT_TIMESTAMP WHERE instance_name = $1", [instanceName]);
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
      reconnectRes = await engine.getConnectionState(instanceName);
    }

    const isConnected = Boolean(reconnectRes.data?.isConnected);
    const state = reconnectRes.data?.state || (isConnected ? 'connected' : 'reconnecting');
    const newDbStatus = isConnected ? 'connected' : 'reconnecting';

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
      requiresQr: false
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

    const engine = await engineRouter.getEngineForInstance(instanceName);
    const groupsResult = await (engine as any).getGroups(instanceName);

    if (!groupsResult.success) {
      return res.status(500).json({ success: false, error: groupsResult.error?.message || groupsResult.error || 'Error al obtener grupos' });
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

    // Limpiar teléfonos de los participantes (formato JID esperado por Whatsmeow)
    const cleanedParticipants = (participants || []).map((num: string) => {
      const cleanNum = num.split('@')[0].replace(/\D/g, '');
      return `${cleanNum}@s.whatsapp.net`;
    });

    const engine = await engineRouter.getEngineForInstance(instanceName);
    const createResult = await (engine as any).createGroup(instanceName, subject, cleanedParticipants);

    if (!createResult.success) {
      return res.status(500).json({ success: false, error: createResult.error?.message || createResult.error || 'Error al crear el grupo' });
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

    // Limpiar teléfonos de los participantes (formato JID esperado por Whatsmeow)
    const cleanParticipants = participants.map((num: string) => {
      const cleanNum = num.split('@')[0].replace(/\D/g, '');
      return `${cleanNum}@s.whatsapp.net`;
    });

    const engine = await engineRouter.getEngineForInstance(instanceName);
    const updateResult = await (engine as any).updateGroupParticipants(instanceName, groupJid, action, cleanParticipants);

    if (!updateResult.success) {
      return res.status(500).json({ success: false, error: updateResult.error?.message || updateResult.error || 'Error al actualizar participantes del grupo' });
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

    const engine = await engineRouter.getEngineForInstance(instanceName);
    const codeResult = await (engine as any).getGroupInviteCode(instanceName, groupJid as string);

    if (!codeResult.success) {
      return res.status(500).json({ success: false, error: codeResult.error?.message || codeResult.error || 'Error al obtener enlace de invitación' });
    }

    res.json({ success: true, data: codeResult.data });
  } catch (error: any) {
    console.error('[Instance] Error en GET /groups/invite-code:', error.message);
    res.status(500).json({ success: false, error: 'Error interno en el servidor.' });
  }
});

export default router;
