import { Router } from 'express';
import { webhookQueue } from '../queues/webhookQueue';
import pool from '../config/database';
import { EvolutionService } from '../services/evolution.service';

const router = Router();

/**
 * POST /api/webhooks/whatsapp - Recibir eventos de Evolution API y encolarlos asíncronamente
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
    // Encolar evento para procesamiento asíncrono en background
    await webhookQueue.add('process-event', { event, instance, data });
    
    // Responder al instante al emisor
    res.status(200).json({ success: true, message: 'Evento encolado correctamente' });
  } catch (error: any) {
    console.error('⚠️ [Webhook] Error al encolar evento:', error.message);
    res.status(200).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/webhooks/send-text - Endpoint REST para envío de mensajes con x-api-key o apiKey
 */
router.post('/send-text', async (req, res) => {
  const headerKey = (req.headers['x-api-key'] || req.headers['X-API-KEY']) as string;
  const { instanceName, number, text, apiKey: bodyApiKey } = req.body;
  const apiKey = headerKey || bodyApiKey;

  if (!instanceName || !apiKey || !number || !text) {
    return res.status(400).json({
      success: false,
      error: 'Parámetros requeridos faltantes (instanceName, number, text y cabecera x-api-key o apiKey).'
    });
  }

  try {
    // 1. Validar la instancia y API Key en PostgreSQL
    const instCheck = await pool.query(
      'SELECT id, instance_name, status FROM instances WHERE instance_name = $1 AND api_key = $2',
      [instanceName, apiKey]
    );

    if (instCheck.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Credenciales de API inválidas: La API Key o el nombre de la instancia no coinciden.'
      });
    }

    // 2. Ejecutar envío mediante Evolution API
    const sentResult = await EvolutionService.sendTextMessage(instanceName, number, text);

    if (sentResult.success) {
      return res.json({
        success: true,
        message: 'Mensaje de WhatsApp enviado exitosamente vía API.',
        data: sentResult.data
      });
    }

    return res.status(500).json({
      success: false,
      error: sentResult.error || 'Error al enviar el mensaje de WhatsApp.',
      details: sentResult.details
    });

  } catch (error: any) {
    console.error('❌ [Webhook SendText Error]:', error.message);
    res.status(500).json({
      success: false,
      error: `Error interno en el servidor: ${error.message}`
    });
  }
});

export default router;
