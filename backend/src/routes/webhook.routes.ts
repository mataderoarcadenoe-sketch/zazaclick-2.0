import { Router, Response } from 'express';
import { webhookQueue } from '../queues/webhookQueue';
import { EvolutionService } from '../services/evolution.service';
import { licensingMiddleware, LicensedRequest } from '../middleware/licensing.middleware';

const router = Router();

/**
 * POST /api/webhooks/whatsapp - Recibir eventos de Evolution API 2.4.0-rc2 y encolarlos asíncronamente en Redis
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
 * POST /api/webhooks/send-text - Envío de texto protegido por Licenciamiento y Cuotas
 */
router.post('/send-text', licensingMiddleware, async (req: LicensedRequest, res: Response) => {
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
    const sentResult = await EvolutionService.sendTextMessage(instanceName, number, text);

    if (sentResult.success) {
      const msgId = sentResult.data?.key?.id;
      await ctx.confirmSuccess('text', msgId, {
        success: true,
        message: 'Mensaje de texto enviado exitosamente a WhatsApp.',
        data: sentResult.data
      });

      return res.json({
        success: true,
        message: 'Mensaje de texto enviado exitosamente a WhatsApp.',
        data: sentResult.data
      });
    }

    // Rollback si Evolution rechazó el mensaje
    await ctx.rollback('text', sentResult.error || 'EVOLUTION_SEND_FAILED');
    return res.status(502).json({
      success: false,
      code: 'SEND_FAILED',
      message: sentResult.error || 'Error al enviar mensaje de texto en WhatsApp.',
      details: sentResult.details
    });
  } catch (error: any) {
    console.error('❌ [SendText Error]:', error.message);
    await ctx.rollback('text', error.message);
    res.status(500).json({
      success: false,
      code: 'INTERNAL_ERROR',
      message: `Error interno en el servidor: ${error.message}`
    });
  }
});

/**
 * POST /api/webhooks/send-media - Envío de multimedia protegido por Licenciamiento y Cuotas
 */
router.post('/send-media', licensingMiddleware, async (req: LicensedRequest, res: Response) => {
  const { instanceName, number, mediatype, mimetype, media, caption, fileName } = req.body;
  const ctx = req.licensingContext!;

  if (!instanceName || !number || !mediatype || !mimetype || !media) {
    await ctx.rollback('media', 'INVALID_PARAMS');
    return res.status(400).json({
      success: false,
      code: 'INVALID_REQUEST',
      message: 'Campos requeridos faltantes: instanceName, number, mediatype (image|video|document|audio), mimetype y media.'
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
      const msgId = sentResult.data?.key?.id;
      await ctx.confirmSuccess(mediatype, msgId, {
        success: true,
        message: `Mensaje multimedia (${mediatype}) enviado exitosamente a WhatsApp.`,
        data: sentResult.data
      });

      return res.json({
        success: true,
        message: `Mensaje multimedia (${mediatype}) enviado exitosamente a WhatsApp.`,
        data: sentResult.data
      });
    }

    await ctx.rollback(mediatype, sentResult.error || 'EVOLUTION_MEDIA_FAILED');
    return res.status(502).json({
      success: false,
      code: 'SEND_FAILED',
      message: sentResult.error || 'Error al enviar archivo multimedia en WhatsApp.',
      details: sentResult.details
    });
  } catch (error: any) {
    console.error('❌ [SendMedia Error]:', error.message);
    await ctx.rollback('media', error.message);
    res.status(500).json({
      success: false,
      code: 'INTERNAL_ERROR',
      message: `Error interno en el servidor: ${error.message}`
    });
  }
});

/**
 * POST /api/webhooks/send-audio - Envío de notas de voz PTT protegido por Licenciamiento y Cuotas
 */
router.post('/send-audio', licensingMiddleware, async (req: LicensedRequest, res: Response) => {
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
    const sentResult = await EvolutionService.sendWhatsAppAudio(instanceName, number, audio);

    if (sentResult.success) {
      const msgId = sentResult.data?.key?.id;
      await ctx.confirmSuccess('audio_ptt', msgId, {
        success: true,
        message: 'Nota de voz PTT enviada exitosamente a WhatsApp.',
        data: sentResult.data
      });

      return res.json({
        success: true,
        message: 'Nota de voz PTT enviada exitosamente a WhatsApp.',
        data: sentResult.data
      });
    }

    await ctx.rollback('audio_ptt', sentResult.error || 'EVOLUTION_AUDIO_FAILED');
    return res.status(502).json({
      success: false,
      code: 'SEND_FAILED',
      message: sentResult.error || 'Error al enviar nota de voz en WhatsApp.',
      details: sentResult.details
    });
  } catch (error: any) {
    console.error('❌ [SendAudio Error]:', error.message);
    await ctx.rollback('audio_ptt', error.message);
    res.status(500).json({
      success: false,
      code: 'INTERNAL_ERROR',
      message: `Error interno en el servidor: ${error.message}`
    });
  }
});

/**
 * POST /api/webhooks/send-location - Envío de coordenadas GPS protegido por Licenciamiento y Cuotas
 */
router.post('/send-location', licensingMiddleware, async (req: LicensedRequest, res: Response) => {
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
      message: 'Coordenadas geográficas inválidas: latitude debe estar entre -90 y 90, longitude entre -180 y 180.'
    });
  }

  try {
    const sentResult = await EvolutionService.sendLocation(instanceName, number, name, address, lat, lon);

    if (sentResult.success) {
      const msgId = sentResult.data?.key?.id;
      await ctx.confirmSuccess('location', msgId, {
        success: true,
        message: 'Ubicación geográfica enviada exitosamente a WhatsApp.',
        data: sentResult.data
      });

      return res.json({
        success: true,
        message: 'Ubicación geográfica enviada exitosamente a WhatsApp.',
        data: sentResult.data
      });
    }

    await ctx.rollback('location', sentResult.error || 'EVOLUTION_LOCATION_FAILED');
    return res.status(502).json({
      success: false,
      code: 'SEND_FAILED',
      message: sentResult.error || 'Error al enviar ubicación en WhatsApp.',
      details: sentResult.details
    });
  } catch (error: any) {
    console.error('❌ [SendLocation Error]:', error.message);
    await ctx.rollback('location', error.message);
    res.status(500).json({
      success: false,
      code: 'INTERNAL_ERROR',
      message: `Error interno en el servidor: ${error.message}`
    });
  }
});

/**
 * POST /api/webhooks/send-contact - Envío de tarjeta de contacto vCard protegido por Licenciamiento y Cuotas
 */
router.post('/send-contact', licensingMiddleware, async (req: LicensedRequest, res: Response) => {
  const { instanceName, number, contact } = req.body;
  const ctx = req.licensingContext!;

  if (!instanceName || !number || !contact || !Array.isArray(contact) || contact.length === 0) {
    await ctx.rollback('contact', 'INVALID_PARAMS');
    return res.status(400).json({
      success: false,
      code: 'INVALID_REQUEST',
      message: 'Campos requeridos faltantes: instanceName, number y contact (arreglo con al menos un contacto).'
    });
  }

  try {
    const sentResult = await EvolutionService.sendContact(instanceName, number, contact);

    if (sentResult.success) {
      const msgId = sentResult.data?.key?.id;
      await ctx.confirmSuccess('contact', msgId, {
        success: true,
        message: 'Contacto vCard enviado exitosamente a WhatsApp.',
        data: sentResult.data
      });

      return res.json({
        success: true,
        message: 'Contacto vCard enviado exitosamente a WhatsApp.',
        data: sentResult.data
      });
    }

    await ctx.rollback('contact', sentResult.error || 'EVOLUTION_CONTACT_FAILED');
    return res.status(502).json({
      success: false,
      code: 'SEND_FAILED',
      message: sentResult.error || 'Error al enviar contacto en WhatsApp.',
      details: sentResult.details
    });
  } catch (error: any) {
    console.error('❌ [SendContact Error]:', error.message);
    await ctx.rollback('contact', error.message);
    res.status(500).json({
      success: false,
      code: 'INTERNAL_ERROR',
      message: `Error interno en el servidor: ${error.message}`
    });
  }
});

export default router;
