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
      // Ignorar rate limiter para health check raíz
      if (req.path === '/' || req.path === '/health') {
        return next();
      }

      const apiKey = (req.headers['x-api-key'] || req.headers['X-API-KEY']) as string;
      const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
      const identifier = apiKey ? `key:${apiKey}` : `ip:${clientIp}`;

      const currentWindow = Math.floor(Date.now() / 1000 / windowSeconds);
      const redisKey = `rl:${identifier}:${currentWindow}`;

      const currentCount = await redis.incr(redisKey);

      if (currentCount === 1) {
        await redis.expire(redisKey, windowSeconds + 5);
      }

      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - currentCount));

      if (currentCount > maxRequests) {
        const retryAfter = windowSeconds - (Math.floor(Date.now() / 1000) % windowSeconds);
        res.setHeader('Retry-After', String(retryAfter));

        return res.status(429).json({
          success: false,
          code: 'RATE_LIMIT_EXCEEDED',
          error: `Has excedido el límite de velocidad permitido (${maxRequests} req/${windowSeconds}s). Por favor espera antes de reintentar.`,
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
