import { Router, Request, Response } from 'express';
import { webhookQueue } from '../queues/webhookQueue';
import pool from '../config/database';
import { EvolutionService } from '../services/evolution.service';

const router = Router();

/**
 * Helper de validación multi-tenant estricta para API Keys
 */
async function authenticateApiKey(req: Request, instanceName: string): Promise<{ valid: boolean; status?: number; error?: string }> {
  const headerKey = (req.headers['x-api-key'] || req.headers['X-API-KEY']) as string;
  const apiKey = headerKey || req.body?.apiKey;

  if (!instanceName || !apiKey) {
    return {
      valid: false,
      status: 400,
      error: 'Parámetros de autenticación faltantes: Se requiere instanceName y cabecera x-api-key o campo apiKey.'
    };
  }

  try {
    const instCheck = await pool.query(
      'SELECT id, instance_name, status FROM instances WHERE instance_name = $1 AND api_key = $2',
      [instanceName, apiKey]
    );

    if (instCheck.rows.length === 0) {
      return {
        valid: false,
        status: 401,
        error: 'Credenciales inválidas: La API Key no coincide o no tiene autorización para esta instancia.'
      };
    }

    return { valid: true };
  } catch (err: any) {
    return {
      valid: false,
      status: 500,
      error: `Error interno de autenticación: ${err.message}`
    };
  }
}

/**
 * POST /api/webhooks/whatsapp - Recibir eventos de Evolution API 2.4.0-rc2 y encolarlos asíncronamente
 */
router.post(['/whatsapp', '/whatsapp/:event'], async (req, res) => {
  let { event, instance, data } = req.body;
  if (!event && req.params.event) {
    event = req.params.event;
  }

  if (!event || !instance || !data) {
    return res.status(200).json({ success: false, error: 'Payload de webhook incompleto' });
  }

  try {
    // Encolar evento para procesamiento asíncrono en background (BullMQ + Redis)
    await webhookQueue.add('process-event', { event, instance, data });
    
    // Responder al instante al emisor
    res.status(200).json({ success: true, message: 'Evento encolado correctamente' });
  } catch (error: any) {
    console.error('⚠️ [Webhook] Error al encolar evento:', error.message);
    res.status(200).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/webhooks/send-text - Endpoint REST para envío de mensajes de texto (Evolution API 2.4.0-rc2)
 */
router.post('/send-text', async (req: Request, res: Response) => {
  const { instanceName, number, text } = req.body;

  if (!instanceName || !number || !text) {
    return res.status(400).json({
      success: false,
      error: 'Campos requeridos faltantes: instanceName, number y text.'
    });
  }

  const auth = await authenticateApiKey(req, instanceName);
  if (!auth.valid) {
    return res.status(auth.status || 401).json({ success: false, error: auth.error });
  }

  try {
    const sentResult = await EvolutionService.sendTextMessage(instanceName, number, text);

    if (sentResult.success) {
      return res.json({
        success: true,
        message: 'Mensaje de texto enviado exitosamente a WhatsApp.',
        data: sentResult.data
      });
    }

    return res.status(500).json({
      success: false,
      error: sentResult.error || 'Error al enviar mensaje de texto.',
      details: sentResult.details
    });
  } catch (error: any) {
    console.error('❌ [SendText Error]:', error.message);
    res.status(500).json({ success: false, error: `Error interno en el servidor: ${error.message}` });
  }
});

/**
 * POST /api/webhooks/send-media - Endpoint REST para envío de multimedia (Imágenes, Videos, Documentos, Audios)
 */
router.post('/send-media', async (req: Request, res: Response) => {
  const { instanceName, number, mediatype, mimetype, media, caption, fileName } = req.body;

  if (!instanceName || !number || !mediatype || !mimetype || !media) {
    return res.status(400).json({
      success: false,
      error: 'Campos requeridos faltantes: instanceName, number, mediatype (image|video|document|audio), mimetype y media (URL o Base64).'
    });
  }

  const validTypes = ['image', 'video', 'document', 'audio'];
  if (!validTypes.includes(mediatype)) {
    return res.status(400).json({
      success: false,
      error: `mediatype inválido. Tipos permitidos: ${validTypes.join(', ')}`
    });
  }

  const auth = await authenticateApiKey(req, instanceName);
  if (!auth.valid) {
    return res.status(auth.status || 401).json({ success: false, error: auth.error });
  }

  try {
    const sentResult = await EvolutionService.sendMediaMessage(
      instanceName,
      number,
      media,
      mediatype,
      mimetype,
      caption,
      fileName
    );

    if (sentResult.success) {
      return res.json({
        success: true,
        message: `Mensaje multimedia (${mediatype}) enviado exitosamente a WhatsApp.`,
        data: sentResult.data
      });
    }

    return res.status(500).json({
      success: false,
      error: sentResult.error || 'Error al enviar archivo multimedia.',
      details: sentResult.details
    });
  } catch (error: any) {
    console.error('❌ [SendMedia Error]:', error.message);
    res.status(500).json({ success: false, error: `Error interno en el servidor: ${error.message}` });
  }
});

/**
 * POST /api/webhooks/send-audio - Endpoint REST para envío de notas de voz reales PTT (Evolution API 2.4.0-rc2)
 */
router.post('/send-audio', async (req: Request, res: Response) => {
  const { instanceName, number, audio } = req.body;

  if (!instanceName || !number || !audio) {
    return res.status(400).json({
      success: false,
      error: 'Campos requeridos faltantes: instanceName, number y audio (URL o Base64).'
    });
  }

  const auth = await authenticateApiKey(req, instanceName);
  if (!auth.valid) {
    return res.status(auth.status || 401).json({ success: false, error: auth.error });
  }

  try {
    const sentResult = await EvolutionService.sendWhatsAppAudio(instanceName, number, audio);

    if (sentResult.success) {
      return res.json({
        success: true,
        message: 'Nota de voz PTT enviada exitosamente a WhatsApp.',
        data: sentResult.data
      });
    }

    return res.status(500).json({
      success: false,
      error: sentResult.error || 'Error al enviar nota de voz.',
      details: sentResult.details
    });
  } catch (error: any) {
    console.error('❌ [SendAudio Error]:', error.message);
    res.status(500).json({ success: false, error: `Error interno en el servidor: ${error.message}` });
  }
});

/**
 * POST /api/webhooks/send-location - Endpoint REST para envío de coordenadas GPS (Evolution API 2.4.0-rc2)
 */
router.post('/send-location', async (req: Request, res: Response) => {
  const { instanceName, number, name, address, latitude, longitude } = req.body;

  if (!instanceName || !number || latitude === undefined || longitude === undefined) {
    return res.status(400).json({
      success: false,
      error: 'Campos requeridos faltantes: instanceName, number, latitude y longitude.'
    });
  }

  const lat = Number(latitude);
  const lon = Number(longitude);

  if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return res.status(400).json({
      success: false,
      error: 'Coordenadas geográficas inválidas: latitude debe estar entre -90 y 90, longitude entre -180 y 180.'
    });
  }

  const auth = await authenticateApiKey(req, instanceName);
  if (!auth.valid) {
    return res.status(auth.status || 401).json({ success: false, error: auth.error });
  }

  try {
    const sentResult = await EvolutionService.sendLocation(instanceName, number, name, address, lat, lon);

    if (sentResult.success) {
      return res.json({
        success: true,
        message: 'Ubicación geográfica enviada exitosamente a WhatsApp.',
        data: sentResult.data
      });
    }

    return res.status(500).json({
      success: false,
      error: sentResult.error || 'Error al enviar ubicación.',
      details: sentResult.details
    });
  } catch (error: any) {
    console.error('❌ [SendLocation Error]:', error.message);
    res.status(500).json({ success: false, error: `Error interno en el servidor: ${error.message}` });
  }
});

/**
 * POST /api/webhooks/send-contact - Endpoint REST para envío de tarjetas de contacto vCard (Evolution API 2.4.0-rc2)
 */
router.post('/send-contact', async (req: Request, res: Response) => {
  const { instanceName, number, contact } = req.body;

  if (!instanceName || !number || !contact || !Array.isArray(contact) || contact.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Campos requeridos faltantes: instanceName, number y contact (arreglo con al menos un contacto con fullName y phoneNumber).'
    });
  }

  const auth = await authenticateApiKey(req, instanceName);
  if (!auth.valid) {
    return res.status(auth.status || 401).json({ success: false, error: auth.error });
  }

  try {
    const sentResult = await EvolutionService.sendContact(instanceName, number, contact);

    if (sentResult.success) {
      return res.json({
        success: true,
        message: 'Contacto vCard enviado exitosamente a WhatsApp.',
        data: sentResult.data
      });
    }

    return res.status(500).json({
      success: false,
      error: sentResult.error || 'Error al enviar contacto.',
      details: sentResult.details
    });
  } catch (error: any) {
    console.error('❌ [SendContact Error]:', error.message);
    res.status(500).json({ success: false, error: `Error interno en el servidor: ${error.message}` });
  }
});

export default router;
