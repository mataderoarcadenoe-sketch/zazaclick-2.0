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
   * Resuelve el motor correspondiente a partir del nombre de instancia
   */
  public async getEngineForInstance(instanceName: string): Promise<WhatsAppEngine> {
    if (!instanceName) {
      throw new Error('[EngineRouter] El nombre de la instancia es requerido.');
    }

    const engineType = await this.resolveEngineType(instanceName);
    return this.registry.get(engineType);
  }

  /**
   * Resuelve directamente un motor dado su tipo
   */
  public getEngineByType(engineType: EngineType): WhatsAppEngine {
    return this.registry.get(engineType);
  }

  /**
   * Consulta el engine_type asignado en Redis o PostgreSQL
   */
  public async resolveEngineType(instanceName: string): Promise<EngineType> {
    const cacheKey = `inst:engine:${instanceName}`;
    try {
      const cached = await redis.get(cacheKey);
      if (cached === 'evolution_api' || cached === 'evolution_go') {
        return cached as EngineType;
      }
    } catch (redisErr: any) {
      console.warn(`[EngineRouter] Fallo al consultar caché de Redis para ${instanceName}:`, redisErr.message);
    }

    try {
      const res = await pool.query('SELECT engine_type FROM instances WHERE instance_name = $1 LIMIT 1', [instanceName]);
      let resolvedType: EngineType = 'evolution_api';

      if (res.rows.length > 0 && res.rows[0].engine_type) {
        const dbType = res.rows[0].engine_type;
        if (dbType === 'evolution_api' || dbType === 'evolution_go') {
          resolvedType = dbType as EngineType;
        }
      }

      // Guardar en caché Redis por 60 segundos
      try {
        await redis.set(cacheKey, resolvedType, 'EX', 60);
      } catch {}

      return resolvedType;
    } catch (dbErr: any) {
      console.error(`[EngineRouter] Error consultando base de datos para ${instanceName}:`, dbErr.message);
      // Fallback seguro a evolution_api
      return 'evolution_api';
    }
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
