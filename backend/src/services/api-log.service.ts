import * as crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import pool from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { TracedRequest } from '../middleware/request-id.middleware';

export interface ApiLogFilter {
  statusCategory?: '2xx' | '4xx' | '5xx' | 'all';
  method?: string;
  endpoint?: string;
  limit?: number;
  offset?: number;
  environment?: 'live' | 'test' | 'all';
}

export class ApiLogService {
  /**
   * Sanitiza objetos y cabeceras eliminando o enmascarando información confidencial
   */
  public static sanitizeData(data: any): any {
    if (!data || typeof data !== 'object') return data;

    const sanitized = Array.isArray(data) ? [...data] : { ...data };

    for (const key of Object.keys(sanitized)) {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes('password') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('token') ||
        lowerKey.includes('key') ||
        lowerKey.includes('authorization')
      ) {
        const val = String(sanitized[key]);
        sanitized[key] = val.length > 8 ? `${val.slice(0, 4)}********${val.slice(-4)}` : '********';
      } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = this.sanitizeData(sanitized[key]);
      }
    }

    return sanitized;
  }

  /**
   * Middleware de Express para registrar automáticamente el tráfico API de Desarrolladores (/v1 y /api)
   */
  public static middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Registrar únicamente rutas relevantes de API de desarrolladores y ERP (/v1), ignorando admin interno y health checks
      if (!req.path.startsWith('/v1') && !req.path.startsWith('/api/v1')) {
        return next();
      }

      if (req.path.startsWith('/api/admin') || req.path.startsWith('/admin') || req.path === '/health' || req.path === '/') {
        return next();
      }

      const startTime = Date.now();
      const authReq = req as AuthenticatedRequest & TracedRequest;

      // Capturar body de respuesta interceptando res.json y res.send
      let responseBody: any = null;
      const originalJson = res.json.bind(res);
      const originalSend = res.send.bind(res);

      res.json = (body: any) => {
        responseBody = body;
        return originalJson(body);
      };

      res.send = (body: any) => {
        if (!responseBody) {
          try {
            responseBody = typeof body === 'string' ? JSON.parse(body) : body;
          } catch {
            responseBody = typeof body === 'string' && body.length > 500 ? `${body.substring(0, 500)}...` : body;
          }
        }
        return originalSend(body);
      };

      res.on('finish', () => {
        const statusCode = res.statusCode;

        // Optimización de Almacenamiento: Omitir en BD sondeos repetitivos de alta frecuencia (heartbeats GET exitosos)
        if (req.method === 'GET' && statusCode < 400) {
          const isHeartbeatPoll = req.path.includes('/status') ||
                                  req.path.includes('/connectionState') ||
                                  req.path.includes('/qr') ||
                                  req.path.includes('/connect') ||
                                  req.path.includes('/tenants/');
          if (isHeartbeatPoll) {
            return;
          }
        }

        const latencyMs = Date.now() - startTime;
        const requestId = authReq.requestId || (res.getHeader('X-Request-Id') as string) || `zc_req_${Date.now()}`;
        const correlationId = authReq.correlationId || (res.getHeader('X-Correlation-Id') as string) || null;
        const userId = authReq.userId || null;
        const environment = (authReq as any).environment || 'live';
        const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
        const userAgent = req.headers['user-agent'] || null;

        // Extraer instanceName si está en params o body
        const instanceName = req.params?.instanceName || req.body?.instanceName || null;

        const safeHeaders = ApiLogService.sanitizeData({ ...req.headers });
        const safeBody = ApiLogService.sanitizeData(req.body);
        const safeResponse = ApiLogService.sanitizeData(responseBody);

        // Inserción asíncrona no bloqueante
        const logId = `log_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
        pool.query(
          `INSERT INTO api_request_logs (
            id, user_id, instance_name, method, endpoint, status_code, latency_ms,
            request_id, correlation_id, ip_address, user_agent, request_headers,
            request_body, response_body, environment, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, CURRENT_TIMESTAMP)`,
          [
            logId,
            userId,
            instanceName,
            req.method,
            req.originalUrl || req.path,
            statusCode,
            latencyMs,
            requestId,
            correlationId,
            clientIp,
            userAgent,
            JSON.stringify(safeHeaders),
            JSON.stringify(safeBody),
            JSON.stringify(safeResponse),
            environment
          ]
        ).catch(() => {});
      });

      return next();
    };
  }

  /**
   * Obtiene logs de peticiones API paginados y filtrados para el desarrollador autenticado
   */
  public static async getLogsForUser(userId: string, filter: ApiLogFilter = {}) {
    const limit = Math.min(100, filter.limit || 30);
    const offset = filter.offset || 0;

    let query = `
      SELECT id, instance_name, method, endpoint, status_code, latency_ms,
             request_id, correlation_id, ip_address, user_agent, request_headers,
             request_body, response_body, environment, created_at
      FROM api_request_logs
      WHERE user_id = $1
    `;
    const params: any[] = [userId];

    if (filter.statusCategory === '2xx') {
      query += ` AND status_code >= 200 AND status_code < 300`;
    } else if (filter.statusCategory === '4xx') {
      query += ` AND status_code >= 400 AND status_code < 500`;
    } else if (filter.statusCategory === '5xx') {
      query += ` AND status_code >= 500`;
    }

    if (filter.method) {
      params.push(filter.method.toUpperCase());
      query += ` AND method = $${params.length}`;
    }

    if (filter.environment && filter.environment !== 'all') {
      params.push(filter.environment);
      query += ` AND environment = $${params.length}`;
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const res = await pool.query(query, params);

    // Contar total
    const countRes = await pool.query(
      `SELECT COUNT(*) FROM api_request_logs WHERE user_id = $1`,
      [userId]
    );

    return {
      total: parseInt(countRes.rows[0].count, 10),
      limit,
      offset,
      logs: res.rows.map(r => ({
        id: r.id,
        instanceName: r.instance_name,
        method: r.method,
        endpoint: r.endpoint,
        statusCode: r.status_code,
        latencyMs: r.latency_ms,
        requestId: r.request_id,
        correlationId: r.correlation_id,
        ipAddress: r.ip_address,
        userAgent: r.user_agent,
        requestHeaders: typeof r.request_headers === 'string' ? JSON.parse(r.request_headers) : r.request_headers,
        requestBody: typeof r.request_body === 'string' ? JSON.parse(r.request_body) : r.request_body,
        responseBody: typeof r.response_body === 'string' ? JSON.parse(r.response_body) : r.response_body,
        environment: r.environment,
        createdAt: r.created_at ? r.created_at.toISOString() : new Date().toISOString()
      }))
    };
  }

  /**
   * Depuración periódica de logs antiguos para evitar saturar el disco de PostgreSQL (Supabase 500MB limit)
   */
  public static async purgeOldLogs(retentionDays: number = 7): Promise<number> {
    try {
      const res = await pool.query(
        `DELETE FROM api_request_logs 
         WHERE created_at < CURRENT_TIMESTAMP - (INTERVAL '1 day' * $1)
         RETURNING id`,
        [retentionDays]
      );
      const count = res.rowCount || 0;
      if (count > 0) {
        console.log(`🧹 [ApiLogService] Depuración: Se purgaron ${count} logs antiguos (> ${retentionDays} días).`);
      }
      return count;
    } catch (err: any) {
      console.warn('⚠️ [ApiLogService] Error al purgar logs antiguos:', err.message);
      return 0;
    }
  }
}
