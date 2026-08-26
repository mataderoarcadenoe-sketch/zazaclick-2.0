import pool from '../config/database';

export class DeveloperUsageService {
  /**
   * Métricas en vivo del Developer Dashboard
   */
  public static async getOverview(userId: string) {
    // 1. Instancias y estados de conexión
    const instRes = await pool.query(
      `SELECT COUNT(*) as total_instances,
              COUNT(*) FILTER (WHERE status = 'open' OR status = 'connected') as connected_instances,
              COALESCE(SUM(messages_sent), 0) as total_messages_sent
       FROM instances
       WHERE user_id = $1`,
      [userId]
    );

    const instancesData = instRes.rows[0];

    // 2. Cuotas de suscripción
    const subRes = await pool.query(
      `SELECT messages_limit, messages_used, status, end_date
       FROM subscriptions
       WHERE user_id = $1 AND status = 'active'
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );

    const quotaLimit = subRes.rows.length > 0 ? (subRes.rows[0].messages_limit || 1000) : 1000;
    const quotaUsed = subRes.rows.length > 0 ? (subRes.rows[0].messages_used || 0) : 0;
    const quotaRemaining = Math.max(0, quotaLimit - quotaUsed);

    // 3. Métricas de tráfico API en api_request_logs
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const logsRes = await pool.query(
      `SELECT 
        COUNT(*) as total_requests,
        COUNT(*) FILTER (WHERE created_at >= $2) as requests_today,
        COUNT(*) FILTER (WHERE created_at >= $3) as requests_month,
        COUNT(*) FILTER (WHERE status_code >= 400 AND status_code < 500) as errors_4xx,
        COUNT(*) FILTER (WHERE status_code >= 500) as errors_5xx,
        COUNT(*) FILTER (WHERE status_code = 429) as rate_limit_events,
        COALESCE(AVG(latency_ms), 0) as avg_latency_ms
       FROM api_request_logs
       WHERE user_id = $1`,
      [userId, startOfToday, startOfMonth]
    );

    const logsData = logsRes.rows[0];

    // 4. Métricas de entregas de webhooks
    const whRes = await pool.query(
      `SELECT 
        COUNT(*) as total_webhooks,
        COUNT(*) FILTER (WHERE status = 'DELIVERED') as webhooks_delivered,
        COUNT(*) FILTER (WHERE status = 'FAILED') as webhooks_failed,
        COALESCE(AVG(latency_ms), 0) as avg_webhook_latency
       FROM webhook_deliveries
       WHERE user_id = $1`,
      [userId]
    );

    const whData = whRes.rows[0];

    return {
      requests: {
        total: parseInt(logsData.total_requests || '0', 10),
        today: parseInt(logsData.requests_today || '0', 10),
        month: parseInt(logsData.requests_month || '0', 10),
        avgLatencyMs: Math.round(parseFloat(logsData.avg_latency_ms || '0'))
      },
      instances: {
        total: parseInt(instancesData.total_instances || '0', 10),
        connected: parseInt(instancesData.connected_instances || '0', 10)
      },
      messages: {
        sent: parseInt(instancesData.total_messages_sent || '0', 10),
        quotaUsed,
        quotaLimit,
        quotaRemaining
      },
      errors: {
        clientErrors4xx: parseInt(logsData.errors_4xx || '0', 10),
        serverErrors5xx: parseInt(logsData.errors_5xx || '0', 10),
        rateLimitEvents: parseInt(logsData.rate_limit_events || '0', 10)
      },
      webhooks: {
        total: parseInt(whData.total_webhooks || '0', 10),
        delivered: parseInt(whData.webhooks_delivered || '0', 10),
        failed: parseInt(whData.webhooks_failed || '0', 10),
        avgLatencyMs: Math.round(parseFloat(whData.avg_webhook_latency || '0'))
      }
    };
  }

  /**
   * Serie temporal de consumo API (Hoy, 7 días, 30 días)
   */
  public static async getUsageSeries(userId: string, period: 'today' | '7d' | '30d' = '7d') {
    let days = 7;
    if (period === 'today') days = 1;
    if (period === '30d') days = 30;

    const intervalSql = `${days} days`;

    // 1. Serie diaria de requests
    const dailyRes = await pool.query(
      `SELECT 
        DATE_TRUNC('day', created_at) as date,
        COUNT(*) as total_requests,
        COUNT(*) FILTER (WHERE status_code >= 200 AND status_code < 400) as success_requests,
        COUNT(*) FILTER (WHERE status_code >= 400) as error_requests,
        COALESCE(AVG(latency_ms), 0) as avg_latency
       FROM api_request_logs
       WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '${intervalSql}'
       GROUP BY DATE_TRUNC('day', created_at)
       ORDER BY date ASC`,
      [userId]
    );

    // 2. Top endpoints utilizados
    const endpointsRes = await pool.query(
      `SELECT 
        endpoint,
        method,
        COUNT(*) as count,
        COALESCE(AVG(latency_ms), 0) as avg_latency
       FROM api_request_logs
       WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '${intervalSql}'
       GROUP BY endpoint, method
       ORDER BY count DESC
       LIMIT 10`,
      [userId]
    );

    // 3. Distribución de códigos de respuesta
    const statusCodesRes = await pool.query(
      `SELECT 
        status_code,
        COUNT(*) as count
       FROM api_request_logs
       WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '${intervalSql}'
       GROUP BY status_code
       ORDER BY count DESC`,
      [userId]
    );

    return {
      period,
      days,
      timeseries: dailyRes.rows.map(r => ({
        date: r.date ? new Date(r.date).toISOString().split('T')[0] : '',
        totalRequests: parseInt(r.total_requests, 10),
        successRequests: parseInt(r.success_requests, 10),
        errorRequests: parseInt(r.error_requests, 10),
        avgLatencyMs: Math.round(parseFloat(r.avg_latency || '0'))
      })),
      topEndpoints: endpointsRes.rows.map(r => ({
        endpoint: r.endpoint,
        method: r.method,
        count: parseInt(r.count, 10),
        avgLatencyMs: Math.round(parseFloat(r.avg_latency || '0'))
      })),
      statusCodes: statusCodesRes.rows.map(r => ({
        statusCode: r.status_code,
        count: parseInt(r.count, 10)
      }))
    };
  }
}
