import Redis from 'ioredis';
import * as dotenv from 'dotenv';

dotenv.config();

const rawRedisUrl = process.env.REDIS_PRIVATE_URL || process.env.REDIS_URL;
const isValidUrl = rawRedisUrl && !rawRedisUrl.startsWith('${{') && (rawRedisUrl.startsWith('redis://') || rawRedisUrl.startsWith('rediss://'));

const redisHost = process.env.REDISHOST || process.env.REDIS_HOST;
const redisPort = parseInt(process.env.REDISPORT || process.env.REDIS_PORT || '6379', 10);
const redisPassword = process.env.REDISPASSWORD || process.env.REDIS_PASSWORD;
const redisUser = process.env.REDISUSER || process.env.REDIS_USER;

let redis: Redis;

const commonOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  enableOfflineQueue: true,
  retryStrategy(times: number) {
    return Math.min(times * 1000, 10000);
  },
  reconnectOnError(err: Error) {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      return true;
    }
    return false;
  }
};

if (isValidUrl) {
  console.log('🔌 [Redis] Inicializando cliente de Redis con URL...');
  redis = new Redis(rawRedisUrl!, commonOptions);
} else if (redisHost && !redisHost.startsWith('${{')) {
  console.log(`🔌 [Redis] Inicializando cliente de Redis con Host ${redisHost}:${redisPort}...`);
  redis = new Redis({
    host: redisHost,
    port: redisPort,
    password: redisPassword,
    username: redisUser,
    ...commonOptions
  });
} else {
  console.warn('⚠️ [Redis] Variables de Redis no configuradas. Usando cliente local con reintentos controlados.');
  redis = new Redis({
    host: '127.0.0.1',
    port: 6379,
    ...commonOptions
  });
}

redis.on('connect', () => {
  console.log('✅ [Redis] Conectado exitosamente a Redis.');
});

redis.on('error', (err) => {
  // Loggear sólo como advertencia para no saturar los logs en caso de reconexión
  console.warn('⚠️ [Redis] Aviso de conexión:', err.message);
});

export default redis;

