import Redis from 'ioredis';
import * as dotenv from 'dotenv';

dotenv.config();

const redisUrl = process.env.REDIS_PRIVATE_URL || process.env.REDIS_URL;

let redis: Redis;

if (redisUrl) {
  console.log('🔌 [Redis] Inicializando cliente de Redis con URL...');
  redis = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
} else {
  console.warn('⚠️ [Redis] REDIS_PRIVATE_URL ni REDIS_URL configurados en el entorno. Conectando a localhost:6379 de respaldo.');
  redis = new Redis({
    host: 'localhost',
    port: 6379,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

redis.on('connect', () => {
  console.log('✅ [Redis] Conectado exitosamente a Redis.');
});

redis.on('error', (err) => {
  console.error('❌ [Redis] Error en la conexión:', err.message);
});

export default redis;
