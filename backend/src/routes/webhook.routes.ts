import { Router } from 'express';
import { webhookQueue } from '../queues/webhookQueue';

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

export default router;
