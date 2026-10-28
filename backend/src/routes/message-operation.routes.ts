import { Router, Response } from 'express';
import pool from '../config/database';
import { apiKeyOrTokenAuth, AuthenticatedRequest } from '../middleware/auth.middleware';

const router = Router();
router.use(apiKeyOrTokenAuth);
async function read(req: AuthenticatedRequest, res: Response) {
  try {
    const principal = req.principal!;
    if (principal.scopes && !principal.scopes.some(s => ['messages:send','logs:read'].includes(s))) {
      return res.status(403).json({success: false, code: 'INSUFFICIENT_SCOPE'});
    }
    const byKey = !!req.params.instanceName;
    const id = req.params.operationId;
    if ((!byKey && !/^[a-f0-9-]{36}$/i.test(id || '')) || (byKey &&
      (!/^[A-Za-z0-9_-]{1,255}$/.test(req.params.instanceName) || !/^[A-Za-z0-9_.:-]{1,128}$/.test(req.params.key)))) {
      return res.status(400).json({success: false, code: 'INVALID_REQUEST'});
    }
    const result = await pool.query(`SELECT o.id,o.state,o.message_id,o.created_at,o.updated_at,o.http_status
      FROM message_operations o JOIN users u ON u.id=o.user_id JOIN instances i ON i.id=o.instance_id
      WHERE (($1::text IS NOT NULL AND u.partner_id=$1) OR ($1::text IS NULL AND o.user_id=$2))
      AND ($3::text IS NULL OR o.instance_id=$3) AND o.environment=$4
      AND ${byKey ? 'i.instance_name=$5 AND o.idempotency_key=$6' : 'o.id=$5::uuid'}`,
      [principal.partnerId || null, principal.userId, principal.instanceId || null, principal.environment,
        byKey ? req.params.instanceName : id, ...(byKey ? [req.params.key] : [])]);
    const row = result.rows[0];
    if (!row) return res.status(404).json({success: false, code: 'OPERATION_NOT_FOUND'});
    // Old PROCESSING is not inferred to be delivered or safe to retry.
    const stale = row.state === 'PROCESSING' && Date.now() - new Date(row.updated_at).getTime() > 120000;
    res.setHeader('Cache-Control', 'no-store');
    return res.json({success: true, data: {operationId: row.id, state: row.state,
      reviewRequired: row.state === 'UNKNOWN' || stale, messageId: row.message_id,
      createdAt: row.created_at, updatedAt: row.updated_at, acceptedByEngine: row.state === 'ACCEPTED',
      delivered: null, read: null}});
  } catch { return res.status(503).json({success: false, code: 'OPERATION_STATUS_UNAVAILABLE'}); }
}
router.get('/by-key/:instanceName/:key', read);
router.get('/:operationId', read);
export default router;
