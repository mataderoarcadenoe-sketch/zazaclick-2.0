import { Request, Response, NextFunction } from 'express';

export interface TracedRequest extends Request {
  requestId?: string;
  correlationId?: string;
}

/**
 * Middleware universal de observabilidad y trazabilidad distribuida
 * Inyecta X-Request-Id y X-Correlation-Id en cada solicitud y respuesta HTTP
 */
export function requestIdMiddleware(req: TracedRequest, res: Response, next: NextFunction) {
  const incomingReqId = req.headers['x-request-id'] as string;
  const incomingCorrId = req.headers['x-correlation-id'] as string;

  const requestId = incomingReqId && /^[a-zA-Z0-9_-]{8,64}$/.test(incomingReqId)
    ? incomingReqId
    : `zc_req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const correlationId = incomingCorrId && /^[a-zA-Z0-9_-]{8,64}$/.test(incomingCorrId)
    ? incomingCorrId
    : `zc_corr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  req.requestId = requestId;
  req.correlationId = correlationId;

  res.setHeader('X-Request-Id', requestId);
  res.setHeader('X-Correlation-Id', correlationId);

  return next();
}
