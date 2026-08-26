/**
 * Circuit Breaker Independiente por Motor — Zaza Click 2.0
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  failureThreshold?: number;
  cooldownPeriodMs?: number;
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private readonly failureThreshold: number;
  private readonly cooldownPeriodMs: number;
  private readonly engineName: string;

  constructor(engineName: string, config?: CircuitBreakerConfig) {
    this.engineName = engineName;
    this.failureThreshold = config?.failureThreshold ?? 5;
    this.cooldownPeriodMs = config?.cooldownPeriodMs ?? 30000; // 30 segundos
  }

  /**
   * Verifica si el circuito permite ejecutar peticiones
   */
  public canExecute(): boolean {
    if (this.state === 'CLOSED') {
      return true;
    }

    const now = Date.now();
    if (this.state === 'OPEN') {
      if (now - this.lastFailureTime >= this.cooldownPeriodMs) {
        this.state = 'HALF_OPEN';
        console.log(`🟡 [CircuitBreaker:${this.engineName}] Cooldown expirado. Pasando a estado HALF_OPEN.`);
        return true;
      }
      return false;
    }

    if (this.state === 'HALF_OPEN') {
      return true;
    }

    return false;
  }

  /**
   * Registra una ejecución exitosa
   */
  public recordSuccess(): void {
    if (this.state !== 'CLOSED') {
      console.log(`🟢 [CircuitBreaker:${this.engineName}] Operación exitosa recibida. Circuito restaurado a CLOSED.`);
    }
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  /**
   * Registra un fallo de red o servidor. Solo activa el breaker en errores de infraestructura.
   */
  public recordFailure(err?: any): void {
    const isInfraError = this.isInfrastructureError(err);
    if (!isInfraError) {
      // Errores funcionales (400, 401, 404, 422) no deben abrir el circuito
      return;
    }

    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === 'HALF_OPEN' || this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      console.warn(`🔴 [CircuitBreaker:${this.engineName}] Umbral de fallos alcanzado (${this.failureCount}/${this.failureThreshold}). Circuito abierto a OPEN por ${this.cooldownPeriodMs / 1000}s.`);
    }
  }

  /**
   * Determina si el error es de infraestructura (Timeout, Connection refused, 5xx)
   */
  private isInfrastructureError(err?: any): boolean {
    if (!err) return true;
    const code = err.code || err.error?.code;
    const status = err.status || err.statusCode || err.response?.status;

    if (code === 'ECONNREFUSED' || code === 'ETIMEDOUT' || code === 'ECONNABORTED' || code === 'ENGINE_TIMEOUT' || code === 'ENGINE_UNAVAILABLE') {
      return true;
    }

    if (status >= 500 && status <= 599) {
      return true;
    }

    return false;
  }

  public getState(): { state: CircuitState; failureCount: number; lastFailureTime: number } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime
    };
  }

  public reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.lastFailureTime = 0;
  }
}
