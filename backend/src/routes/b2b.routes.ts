import { Router, Response } from 'express';
import { partnerAuthMiddleware, PartnerRequest } from '../middleware/partner-auth.middleware';
import { PartnerProvisioningService } from '../services/partner-provisioning.service';

const router = Router();

// Proteger todas las rutas con autenticación Master Partner Key
router.use(partnerAuthMiddleware);

/**
 * POST /v1/b2b/tenants — Aprovisionamiento atómico de un nuevo gimnasio/tenant
 */
router.post('/tenants', async (req: PartnerRequest, res: Response) => {
  try {
    const result = await PartnerProvisioningService.provisionTenant(req.partnerId!, req.body);
    res.status(201).json({
      success: true,
      message: 'Gimnasio/Tenant aprovisionado exitosamente en ZazaClick 2.0.',
      data: result
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      code: 'PROVISION_FAILED',
      error: err.message
    });
  }
});

/**
 * GET /v1/b2b/tenants — Listar todos los gimnasios aprovisionados por el partner
 */
router.get('/tenants', async (req: PartnerRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string || '50', 10);
    const offset = parseInt(req.query.offset as string || '0', 10);
    const search = req.query.search as string;

    const tenants = await PartnerProvisioningService.listPartnerTenants(req.partnerId!, limit, offset, search);
    res.json({
      success: true,
      data: tenants
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      code: 'INTERNAL_ERROR',
      error: err.message
    });
  }
});

/**
 * GET /v1/b2b/tenants/:id — Consultar dossier completo de un gimnasio específico
 */
router.get('/tenants/:id', async (req: PartnerRequest, res: Response) => {
  try {
    const overview = await PartnerProvisioningService.getTenantOverview(req.partnerId!, req.params.id);
    res.json({
      success: true,
      data: overview
    });
  } catch (err: any) {
    res.status(404).json({
      success: false,
      code: 'TENANT_NOT_FOUND',
      error: err.message
    });
  }
});

/**
 * POST /v1/b2b/tenants/:id/renew — Renovación programática de la suscripción de un gimnasio
 */
router.post('/tenants/:id/renew', async (req: PartnerRequest, res: Response) => {
  try {
    const { months = 1, resetQuota = true } = req.body;
    const result = await PartnerProvisioningService.renewTenantSubscription(
      req.partnerId!,
      req.params.id,
      parseInt(months, 10),
      Boolean(resetQuota)
    );

    res.json({
      success: true,
      message: `Suscripción renovada por +${months} mes(es) exitosamente.`,
      data: result
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      code: 'RENEW_FAILED',
      error: err.message
    });
  }
});

/**
 * PUT /v1/b2b/tenants/:id/plan — Cambio de plan (Upgrade / Downgrade)
 */
router.put('/tenants/:id/plan', async (req: PartnerRequest, res: Response) => {
  try {
    const { planId } = req.body;
    if (!planId) {
      return res.status(400).json({ success: false, error: 'planId es requerido.' });
    }

    const result = await PartnerProvisioningService.updateTenantPlan(req.partnerId!, req.params.id, planId);
    res.json({
      success: true,
      message: `Plan actualizado a "${planId}" exitosamente.`,
      data: result
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      code: 'PLAN_UPDATE_FAILED',
      error: err.message
    });
  }
});

/**
 * PUT /v1/b2b/tenants/:id/status — Suspensión / Reactivación comercial
 */
router.put('/tenants/:id/status', async (req: PartnerRequest, res: Response) => {
  try {
    const { status } = req.body;
    if (status !== 'active' && status !== 'suspended') {
      return res.status(400).json({ success: false, error: 'Estado inválido. Valores permitidos: "active" | "suspended".' });
    }

    const result = await PartnerProvisioningService.setTenantStatus(req.partnerId!, req.params.id, status);
    res.json({
      success: true,
      message: `Estado del gimnasio actualizado a "${status.toUpperCase()}".`,
      data: result
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      code: 'STATUS_UPDATE_FAILED',
      error: err.message
    });
  }
});

/**
 * POST /v1/b2b/tenants/:id/reset-quota — Reseteo de mensajes consumidos a 0
 */
router.post('/tenants/:id/reset-quota', async (req: PartnerRequest, res: Response) => {
  try {
    const result = await PartnerProvisioningService.resetTenantQuota(req.partnerId!, req.params.id);
    res.json({
      success: true,
      message: 'Cuota de mensajes consumidos reseteada a 0 exitosamente.',
      data: result
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      code: 'RESET_QUOTA_FAILED',
      error: err.message
    });
  }
});

/**
 * DELETE /v1/b2b/tenants/:id — Baja y eliminación permanente de un gimnasio en cascada
 */
router.delete('/tenants/:id', async (req: PartnerRequest, res: Response) => {
  try {
    const result = await PartnerProvisioningService.deleteTenant(req.partnerId!, req.params.id);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({
      success: false,
      code: 'DELETE_FAILED',
      error: err.message
    });
  }
});

export default router;
