/**
 * Tipos Canónicos del Sistema Multi-Engine — Zaza Click 2.0
 */

export type EngineType = 'evolution_api' | 'evolution_go';

export type EngineErrorCode =
  | 'ENGINE_TIMEOUT'
  | 'ENGINE_UNAVAILABLE'
  | 'ENGINE_AUTH_FAILED'
  | 'ENGINE_INSTANCE_NOT_FOUND'
  | 'ENGINE_INSTANCE_DISCONNECTED'
  | 'ENGINE_RATE_LIMITED'
  | 'ENGINE_SEND_FAILED'
  | 'ENGINE_UNSUPPORTED'
  | 'ENGINE_INVALID_REQUEST'
  | 'ENGINE_INTERNAL_ERROR'
  | 'UNKNOWN_DELIVERY';

export interface EngineError {
  code: EngineErrorCode;
  message: string;
  isRetryable: boolean;
  statusCode: number;
  details?: any;
  providerError?: any;
}

export interface EngineResult<T = any> {
  success: boolean;
  engine: EngineType;
  data?: T;
  error?: EngineError;
  latencyMs?: number;
  messageId?: string;
  correlationId?: string;
}

export interface EngineCapabilities {
  sendText: boolean;
  sendMedia: boolean;
  sendAudio: boolean;
  sendLocation: boolean;
  sendContact: boolean;
  webhooks: boolean;
  groups: boolean;
  chatsHistory: boolean;
}

export type EngineHealthStatus = 'ONLINE' | 'DEGRADED' | 'OFFLINE' | 'NOT_CONFIGURED' | 'DISABLED';

export interface EngineHealth {
  engine: EngineType;
  status: EngineHealthStatus;
  latencyMs: number;
  version?: string;
  configured: boolean;
  lastCheck: string;
  capabilities: EngineCapabilities;
  error?: string;
}
