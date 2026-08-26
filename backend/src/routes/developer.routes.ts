import { Router, Response } from 'express';
import { apiKeyOrTokenAuth, AuthenticatedRequest } from '../middleware/auth.middleware';
import { ApiKeyService } from '../services/api-key.service';
import { ApiLogService } from '../services/api-log.service';
import { WebhookDispatcherService } from '../services/webhook-dispatcher.service';
import { DeveloperUsageService } from '../services/developer-usage.service';
import { DeveloperStatusService } from '../services/developer-status.service';

const router = Router();

// ====================================================
// 1. DEVELOPER OVERVIEW & USAGE
// ====================================================

router.get('/overview', apiKeyOrTokenAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const overview = await DeveloperUsageService.getOverview(req.userId!);
    res.json({ success: true, data: overview });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/usage', apiKeyOrTokenAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const period = (req.query.period as 'today' | '7d' | '30d') || '7d';
    const usage = await DeveloperUsageService.getUsageSeries(req.userId!, period);
    res.json({ success: true, data: usage });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ====================================================
// 2. API KEY MANAGEMENT
// ====================================================

router.get('/api-keys', apiKeyOrTokenAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const keys = await ApiKeyService.listApiKeys(req.userId!);
    res.json({ success: true, data: keys });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/api-keys', apiKeyOrTokenAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, environment, scopes } = req.body;
    const key = await ApiKeyService.createApiKey(
      req.userId!,
      name || 'Default API Key',
      environment === 'test' ? 'test' : 'live',
      scopes || ['instances:read', 'instances:write', 'messages:send', 'webhooks:read', 'webhooks:write', 'usage:read', 'logs:read'],
      req.ip
    );
    res.status(201).json({
      success: true,
      message: 'API Key creada exitosamente. Guarda el secreto ahora, no se volverá a mostrar.',
      data: key
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/api-keys/:id/revoke', apiKeyOrTokenAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const ok = await ApiKeyService.revokeApiKey(req.userId!, req.params.id, req.ip);
    if (!ok) {
      return res.status(404).json({ success: false, error: 'API Key no encontrada o ya revocada.' });
    }
    res.json({ success: true, message: 'API Key revocada exitosamente.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/api-keys/:id/rotate', apiKeyOrTokenAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rotated = await ApiKeyService.rotateApiKey(req.userId!, req.params.id, req.ip);
    if (!rotated) {
      return res.status(404).json({ success: false, error: 'API Key no encontrada.' });
    }
    res.json({
      success: true,
      message: 'API Key rotada exitosamente. La anterior ha sido revocada.',
      data: rotated
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ====================================================
// 3. API REQUEST LOGS
// ====================================================

router.get('/logs', apiKeyOrTokenAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const statusCategory = req.query.status as any;
    const method = req.query.method as string;
    const limit = parseInt(req.query.limit as string || '30', 10);
    const offset = parseInt(req.query.offset as string || '0', 10);
    const environment = req.query.environment as any;

    const result = await ApiLogService.getLogsForUser(req.userId!, {
      statusCategory,
      method,
      limit,
      offset,
      environment
    });

    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ====================================================
// 4. WEBHOOK DELIVERIES, REPLAY & TESTER
// ====================================================

router.get('/webhooks/deliveries', apiKeyOrTokenAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string || '30', 10);
    const offset = parseInt(req.query.offset as string || '0', 10);
    const data = await WebhookDispatcherService.getDeliveries(req.userId!, limit, offset);
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/webhooks/deliveries/:id/replay', apiKeyOrTokenAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await WebhookDispatcherService.replayDelivery(req.userId!, req.params.id);
    res.json({
      success: true,
      message: result.success ? 'Webhook reenviado exitosamente.' : 'Reintento falló en el servidor destino.',
      data: result
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/webhooks/test', apiKeyOrTokenAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { instanceName, eventType } = req.body;
    if (!instanceName) {
      return res.status(400).json({ success: false, error: 'Se requiere instanceName.' });
    }

    const testResult = await WebhookDispatcherService.sendTestEvent(req.userId!, instanceName, eventType || 'MESSAGE_RECEIVED');
    res.json({
      success: testResult.success,
      message: testResult.success ? 'Evento de prueba entregado y validado con éxito.' : 'El servidor del ERP respondió con error o no está disponible.',
      data: testResult
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ====================================================
// 5. SYSTEM STATUS & HEALTH (SAFE PUBLIC)
// ====================================================

router.get('/status', async (req, res) => {
  try {
    const status = await DeveloperStatusService.getSystemStatus();
    res.json({ success: true, data: status });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
