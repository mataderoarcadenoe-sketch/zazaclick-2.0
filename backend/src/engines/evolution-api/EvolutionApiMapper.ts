/**
 * Mapeador Canónico de Respuestas y Errores para Evolution API 2.4.0-rc2 — Zaza Click 2.0
 */

import { EngineError, EngineResult, EngineErrorCode } from '../contracts/engine.types';

export class EvolutionApiMapper {
  /**
   * Mapea un error de Evolution API / Axios a un EngineError canónico
   */
  public static mapError(err: any): EngineError {
    const isTimeout = err.code === 'ECONNABORTED' || err.message?.includes('timeout');
    const status = err.response?.status || (isTimeout ? 504 : 500);

    let code: EngineErrorCode = 'ENGINE_SEND_FAILED';
    let isRetryable = false;

    if (isTimeout) {
      code = 'ENGINE_TIMEOUT';
      isRetryable = true;
    } else if (status === 401 || status === 403) {
      code = 'ENGINE_AUTH_FAILED';
      isRetryable = false;
    } else if (status === 404) {
      code = 'ENGINE_INSTANCE_NOT_FOUND';
      isRetryable = false;
    } else if (status === 429) {
      code = 'ENGINE_RATE_LIMITED';
      isRetryable = true;
    } else if (status >= 500) {
      code = 'ENGINE_UNAVAILABLE';
      isRetryable = true;
    }

    let message = err.message || 'Error desconocido en Evolution API';
    if (err.response?.data) {
      const data = err.response.data;
      if (typeof data === 'string') {
        message = data;
      } else if (typeof data === 'object') {
        const nestedMsg = data.response?.message || data.message || data.error;
        if (Array.isArray(nestedMsg)) {
          message = nestedMsg.join(', ');
        } else if (nestedMsg) {
          message = String(nestedMsg);
        }
      }
    }

    return {
      code,
      message,
      isRetryable,
      statusCode: status,
      details: err.response?.data,
      providerError: err
    };
  }

  /**
   * Mapea una respuesta exitosa a un EngineResult canónico
   */
  public static mapSuccess<T>(data: T, latencyMs?: number, messageId?: string): EngineResult<T> {
    return {
      success: true,
      engine: 'evolution_api',
      data,
      latencyMs,
      messageId
    };
  }

  /**
   * Mapea un fallo capturado a un EngineResult canónico
   */
  public static mapFailure(err: any, latencyMs?: number): EngineResult {
    const error = this.mapError(err);
    return {
      success: false,
      engine: 'evolution_api',
      error,
      latencyMs
    };
  }
}
