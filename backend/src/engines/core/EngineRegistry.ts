/**
 * Registro Central de Motores WhatsApp — Zaza Click 2.0
 */

import { WhatsAppEngine } from '../contracts/WhatsAppEngine';
import { EngineType, EngineHealth } from '../contracts/engine.types';

export class EngineRegistry {
  private static instance: EngineRegistry;
  private engines: Map<EngineType, WhatsAppEngine> = new Map();

  private constructor() {}

  /**
   * Obtiene la instancia singleton del registro
   */
  public static getInstance(): EngineRegistry {
    if (!EngineRegistry.instance) {
      EngineRegistry.instance = new EngineRegistry();
    }
    return EngineRegistry.instance;
  }

  /**
   * Registra un motor en el sistema
   */
  public register(engine: WhatsAppEngine): void {
    if (this.engines.has(engine.engineType)) {
      console.warn(`⚠️ [EngineRegistry] Motor ${engine.engineType} ya estaba registrado. Reemplazando instancia.`);
    }
    this.engines.set(engine.engineType, engine);
    console.log(`🔌 [EngineRegistry] Motor registrado con éxito: ${engine.engineType}`);
  }

  /**
   * Obtiene un motor por su tipo
   */
  public get(engineType: EngineType): WhatsAppEngine {
    const engine = this.engines.get(engineType);
    if (!engine) {
      throw new Error(`[EngineRegistry] Motor no disponible o no registrado: ${engineType}`);
    }
    return engine;
  }

  /**
   * Verifica si un motor está registrado
   */
  public has(engineType: EngineType): boolean {
    return this.engines.has(engineType);
  }

  /**
   * Lista todos los motores registrados
   */
  public getAll(): WhatsAppEngine[] {
    return Array.from(this.engines.values());
  }

  /**
   * Ejecuta health checks en todos los motores registrados
   */
  public async healthCheckAll(): Promise<EngineHealth[]> {
    const results: EngineHealth[] = [];
    for (const engine of this.engines.values()) {
      try {
        const health = await engine.healthCheck();
        results.push(health);
      } catch (err: any) {
        results.push({
          engine: engine.engineType,
          status: 'OFFLINE',
          latencyMs: 0,
          configured: true,
          lastCheck: new Date().toISOString(),
          capabilities: engine.capabilities,
          error: err.message || 'Error desconocido en health check'
        });
      }
    }
    return results;
  }

  /**
   * Limpia el registro (útil para pruebas unitarias)
   */
  public clear(): void {
    this.engines.clear();
  }
}

export const engineRegistry = EngineRegistry.getInstance();
