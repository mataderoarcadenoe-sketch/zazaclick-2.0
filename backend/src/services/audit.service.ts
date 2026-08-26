import pool from '../config/database';

export class AuditService {
  /**
   * Registrar una acción administrativa en admin_audit_logs
   */
  public static async logAction(params: {
    adminId: string;
    adminEmail: string;
    action: string;
    entity: 'user' | 'subscription' | 'instance' | 'plan' | 'payment';
    entityId: string;
    details?: any;
  }): Promise<void> {
    try {
      const id = `audit_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      await pool.query(`
        INSERT INTO admin_audit_logs (id, admin_id, admin_email, action, entity, entity_id, details)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        id,
        params.adminId,
        params.adminEmail,
        params.action,
        params.entity,
        params.entityId,
        JSON.stringify(params.details || {})
      ]);
    } catch (err: any) {
      console.error('[AuditService] Error registrando bitácora de auditoría:', err.message);
    }
  }
}
