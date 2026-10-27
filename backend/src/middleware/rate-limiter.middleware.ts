import { Request, Response, NextFunction } from 'express';
import redis from '../config/redis';

export interface RateLimitOptions {
  windowSeconds?: number;
  maxRequests?: number;
}

/**
 * Middleware de Rate Limiting distribuido respaldado por Redis
 * Protege la infraestructura contra ráfagas de tráfico y ataques de denegación de servicio (DDoS)
 */
export function createRateLimiter(options: RateLimitOptions = {}) {
  const windowSeconds = options.windowSeconds || 60; // 1 minuto
  const maxRequests = options.maxRequests || 120; // 120 peticiones por minuto

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // 1. Excluir endpoints críticos del rate limiting: health checks, docs y webhooks internos de WhatsApp
      if (
        req.path === '/' ||
        req.path === '/health' ||
        req.path === '/health/deep' ||
        req.path === '/openapi.json' ||
        req.path.startsWith('/api/webhooks/whatsapp')
      ) {
        return next();
      }

      const apiKey = (req.headers['x-api-key'] || req.headers['X-API-KEY']) as string;
      const authHeader = req.headers['authorization'] || '';
      const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';

      // 2. Detectar si es un Partner Master (VivesFit, Krono) para asignar cuota de alto rendimiento
      const isMasterPartner = Boolean(
        (apiKey && (apiKey.includes('partner_master') || apiKey.includes('zc_partner_'))) ||
        authHeader.includes('partner_master') ||
        authHeader.includes('zc_partner_')
      );

      const effectiveLimit = isMasterPartner ? 1200 : maxRequests; // 1200 req/min para partners, 120 req/min estándar
      const identifier = apiKey ? `key:${apiKey}` : (authHeader.startsWith('Bearer ') ? `tok:${authHeader.slice(7, 24)}` : `ip:${clientIp}`);

      const currentWindow = Math.floor(Date.now() / 1000 / windowSeconds);
      const redisKey = `rl:${identifier}:${currentWindow}`;

      const currentCount = await redis.incr(redisKey);

      if (currentCount === 1) {
        await redis.expire(redisKey, windowSeconds + 5);
      }

      res.setHeader('X-RateLimit-Limit', effectiveLimit);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, effectiveLimit - currentCount));

      if (currentCount > effectiveLimit) {
        const retryAfter = windowSeconds - (Math.floor(Date.now() / 1000) % windowSeconds);
        res.setHeader('Retry-After', String(retryAfter));

        return res.status(429).json({
          success: false,
          code: 'RATE_LIMIT_EXCEEDED',
          error: `Has excedido el límite de velocidad permitido (${effectiveLimit} req/${windowSeconds}s). Por favor espera antes de reintentar.`,
          retryAfterSeconds: retryAfter
        });
      }

      return next();
    } catch (err: any) {
      // Si Redis tiene un fallo temporal, no bloquear el tráfico legítimo pero registrar advertencia
      console.warn('[RateLimiter] Advertencia al consultar Redis:', err.message);
      return next();
    }
  };
}

export const globalRateLimiter = createRateLimiter({ windowSeconds: 60, maxRequests: 120 });
