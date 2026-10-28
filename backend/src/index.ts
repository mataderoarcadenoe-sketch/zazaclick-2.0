import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import { createServer } from 'http';
import { initSocket } from './config/socket';
import pool, { initDatabase } from './config/database';
import authRoutes from './routes/auth.routes';
import instanceRoutes from './routes/instance.routes';
import adminRoutes from './routes/admin.routes';
import webhookRoutes from './routes/webhook.routes';
import v1Routes from './routes/v1.routes';
import openapiRoutes from './routes/openapi.routes';
import developerRoutes from './routes/developer.routes';
import b2bRoutes from './routes/b2b.routes';
import { ApiLogService } from './services/api-log.service';
import { startSubscriptionScheduler } from './jobs/subscription-scheduler.job';
import { startInstanceWatchdog } from './jobs/instance-watchdog.job';
import { engineRegistry } from './engines/core/EngineRegistry';
import { evolutionGoEngine } from './engines/evolution-go/EvolutionGoEngine';
import { requestIdMiddleware } from './middleware/request-id.middleware';
import { globalRateLimiter } from './middleware/rate-limiter.middleware';
import redis from './config/redis';
import { jwtSecret } from './config/security';
import { MESSAGE_OPERATIONS_SCHEMA } from './config/message-operations-schema';
import messageOperationRoutes from './routes/message-operation.routes';

dotenv.config();
jwtSecret();

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Configuración de orígenes autorizados para desarrollo y producción (Railway y zazaclick.sbs)
const allowedOrigins = [
  'https://zazaclick.sbs',
  'https://app.zazaclick.sbs',
  'https://admin.zazaclick.sbs',
  'https://api.zazaclick.sbs',
  process.env.FRONTEND_URL,
  process.env.CLIENT_URL,
  process.env.CORS_ORIGIN
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    if (
      allowedOrigins.includes(origin) ||
      origin.includes('localhost') ||
      origin.includes('127.0.0.1') ||
      origin.includes('zazaclick.sbs') ||
      origin.includes('railway.app') ||
      origin.includes('web.app') ||
      origin.includes('firebaseapp.com') ||
      origin.includes('vivesfit') ||
      origin.includes('krono')
    ) {
      return callback(null, true);
    }

    // Permitir acceso B2B Partner y clientes API
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'x-api-key',
    'X-API-KEY',
    'x-tenant-id',
    'idempotency-key',
    'Idempotency-Key',
    'x-request-id',
    'X-Request-Id',
    'x-correlation-id',
    'X-Correlation-Id',
    'Accept',
    'X-Requested-With'
  ],
  exposedHeaders: [
    'Content-Range',
    'X-Content-Range',
    'X-Request-Id',
    'X-Correlation-Id',
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'Retry-After',
    'X-Operation-Id'
  ],
  credentials: true,
  optionsSuccessStatus: 200
}));

// Middlewares Globales de Seguridad, Observabilidad y Rate Limiting
app.use(requestIdMiddleware);
app.use(globalRateLimiter);
app.use(ApiLogService.middleware());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// SaaS Core API Routes Mount (Legacy & Modern v1)
app.use('/api/auth', authRoutes);
app.use('/api/instances', instanceRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/webhooks', webhookRoutes);

// Developer Portal & API Management Routes
app.use('/api/developer', developerRoutes);
app.use('/v1/developer', developerRoutes);

// B2B Partner Provisioning & Management Routes (VivesFit & ERPs)
app.use('/v1/b2b', b2bRoutes);
app.use('/api/v1/b2b', b2bRoutes);

// Developer Platform v1 API Routes & OpenAPI Specification
app.use('/v1', v1Routes);
app.use('/api/v1', v1Routes);
app.use('/v1/message-operations', messageOperationRoutes);
app.use('/api/v1/message-operations', messageOperationRoutes);
app.use('/instances', v1Routes);
app.use('/instance', v1Routes);
app.use('/', openapiRoutes);
app.use('/v1', openapiRoutes);

// Root Health Check Route
app.get(['/', '/health'], (req, res) => {
  res.json({
    status: 'ok',
    service: 'Zaza Click 2.0 — WhatsApp API SaaS Gateway',
    version: '2.0.1',
    message_operations: 'durable-v1',
    documentation: 'https://api.zazaclick.sbs/openapi.json',
    developer_platform: 'https://app.zazaclick.sbs',
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

// Deep Health Check Route (Verificación exhaustiva de dependencias)
app.get('/health/deep', async (req, res) => {
  const start = Date.now();
  const checks: any = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    components: {}
  };

  // 1. PostgreSQL check
  try {
    const dbStart = Date.now();
    await pool.query('SELECT 1');
    checks.components.database = {
      status: 'up',
      latencyMs: Date.now() - dbStart,
      pool: {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount,
        maxLimit: 10
      }
    };
  } catch (dbErr: any) {
    checks.status = 'degraded';
    checks.components.database = {
      status: 'down',
      error: dbErr.message
    };
  }

  // 2. Redis check
  try {
    const redisStart = Date.now();
    await redis.ping();
    checks.components.redis = {
      status: 'up',
      latencyMs: Date.now() - redisStart
    };
  } catch (redisErr: any) {
    checks.status = 'degraded';
    checks.components.redis = {
      status: 'down',
      error: redisErr.message
    };
  }

  // 3. WhatsApp Engine check
  try {
    const engineStart = Date.now();
    const engineHealth = await evolutionGoEngine.healthCheck();
    checks.components.engine = {
      status: engineHealth.status === 'ONLINE' ? 'up' : 'degraded',
      type: 'evolution_go',
      latencyMs: engineHealth.latencyMs || (Date.now() - engineStart),
      engineStatus: engineHealth.status,
      configured: engineHealth.configured,
      error: engineHealth.error
    };
  } catch (engineErr: any) {
    checks.status = 'degraded';
    checks.components.engine = {
      status: 'down',
      type: 'evolution_go',
      error: engineErr.message
    };
  }

  checks.totalLatencyMs = Date.now() - start;
  const statusCode = checks.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(checks);
});

// Start Server
async function startServer() {
  try {
    console.log('🔄 Inicializando base de datos SaaS Core...');
    await initDatabase();
    await pool.query(MESSAGE_OPERATIONS_SCHEMA);

    console.log('🔌 [Engines] Registrando motor oficial Evolution Go (Whatsmeow)...');
    engineRegistry.register(evolutionGoEngine);
    
    const server = createServer(app);
    initSocket(server);
    
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Servidor Express + Socket.io ejecutándose exitosamente en http://0.0.0.0:${PORT}`);
      // Iniciar scheduler de sincronización de vencimientos
      startSubscriptionScheduler();
      // Iniciar centinela de auto-reconexión de instancias WhatsApp
      startInstanceWatchdog();
      // Depuración inicial y programada de logs antiguos (> 7 días) para proteger almacenamiento
      ApiLogService.purgeOldLogs(7);
      setInterval(() => {
        ApiLogService.purgeOldLogs(7);
      }, 24 * 60 * 60 * 1000);
    });
  } catch (error) {
    console.error('❌ Error fatal al iniciar el servidor:', error);
    process.exit(1);
  }
}

startServer();
