/**
 * Enrutador Dinámico de Instancias hacia Motores WhatsApp — Zaza Click 2.0
 */

import pool from '../../config/database';
import redis from '../../config/redis';
import { EngineRegistry, engineRegistry } from './EngineRegistry';
import { WhatsAppEngine } from '../contracts/WhatsAppEngine';
import { EngineType } from '../contracts/engine.types';

export class EngineRouter {
  private registry: EngineRegistry;
  private static instance: EngineRouter;

  constructor(registry: EngineRegistry = engineRegistry) {
    this.registry = registry;
  }

  public static getInstance(): EngineRouter {
    if (!EngineRouter.instance) {
      EngineRouter.instance = new EngineRouter();
    }
    return EngineRouter.instance;
  }

  /**
   * Resuelve el motor correspondiente a partir del nombre de instancia (Unificado en Evolution Go)
   */
  public async getEngineForInstance(instanceName: string): Promise<WhatsAppEngine> {
    if (!instanceName) {
      throw new Error('[EngineRouter] El nombre de la instancia es requerido.');
    }

    return this.registry.get('evolution_go');
  }

  /**
   * Resuelve directamente un motor dado su tipo (Normalizado hacia Evolution Go)
   */
  public getEngineByType(_engineType?: EngineType): WhatsAppEngine {
    return this.registry.get('evolution_go');
  }

  /**
   * Retorna el motor unificado Evolution Go sin sobrecarga de consultas de red
   */
  public async resolveEngineType(_instanceName: string): Promise<EngineType> {
    return 'evolution_go';
  }

  /**
   * Invalida la caché del motor asignado a una instancia (usado tras migraciones)
   */
  public async invalidateCache(instanceName: string): Promise<void> {
    try {
      await redis.del(`inst:engine:${instanceName}`);
    } catch (err: any) {
      console.warn(`[EngineRouter] Error invalidando caché de ${instanceName}:`, err.message);
    }
  }
}

export const engineRouter = EngineRouter.getInstance();
