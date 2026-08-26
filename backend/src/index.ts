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
import { EvolutionService } from './services/evolution.service';
import { startSubscriptionScheduler } from './jobs/subscription-scheduler.job';
import { engineRegistry } from './engines/core/EngineRegistry';
import { evolutionApiEngine } from './engines/evolution-api/EvolutionApiEngine';
import { evolutionGoEngine } from './engines/evolution-go/EvolutionGoEngine';
import { requestIdMiddleware } from './middleware/request-id.middleware';
import { globalRateLimiter } from './middleware/rate-limiter.middleware';

dotenv.config();

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
      origin.includes('railway.app')
    ) {
      return callback(null, true);
    }

    return callback(new Error(`Origen no permitido por política CORS: ${origin}`));
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
    'Retry-After'
  ],
  credentials: true,
  optionsSuccessStatus: 200
}));

// Middlewares Globales de Seguridad, Observabilidad y Rate Limiting
app.use(requestIdMiddleware);
app.use(globalRateLimiter);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// SaaS Core API Routes Mount (Legacy & Modern v1)
app.use('/api/auth', authRoutes);
app.use('/api/instances', instanceRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/webhooks', webhookRoutes);

// Developer Platform v1 API Routes & OpenAPI Specification
app.use('/v1', v1Routes);
app.use('/api/v1', v1Routes);
app.use('/', openapiRoutes);
app.use('/v1', openapiRoutes);

// Root Health Check Route
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Zaza Click 2.0 — WhatsApp API SaaS Gateway',
    version: '2.0.0',
    documentation: 'https://api.zazaclick.sbs/openapi.json',
    developer_platform: 'https://app.zazaclick.sbs',
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

/**
 * Configurar de forma automática los webhooks para todas las instancias registradas en base de datos al arrancar
 */
async function configureAllWebhooks() {
  try {
    console.log('🔄 [Webhooks] Sincronizando configuración de webhooks en Evolution API...');
    const result = await pool.query('SELECT instance_name FROM instances');
    const instances = result.rows;
    
    for (const inst of instances) {
      const name = inst.instance_name;
      console.log(`[Webhooks] Sincronizando webhook para la instancia: ${name}`);
      const success = await EvolutionService.configureWebhook(name);
      if (success) {
        console.log(`✅ [Webhooks] Webhook configurado con éxito para: ${name}`);
      } else {
        console.warn(`⚠️ [Webhooks] No se pudo configurar el webhook para: ${name}`);
      }
    }
  } catch (err: any) {
    console.error('❌ [Webhooks] Error al sincronizar webhooks:', err.message);
  }
}

// Start Server
async function startServer() {
  try {
    console.log('🔄 Inicializando base de datos SaaS Core...');
    await initDatabase();

    console.log('🔌 [Engines] Registrando motores WhatsApp disponibles...');
    engineRegistry.register(evolutionApiEngine);
    if (process.env.EVOLUTION_GO_ENABLED === 'true' || process.env.EVOLUTION_GO_URL) {
      engineRegistry.register(evolutionGoEngine);
    }
    
    const server = createServer(app);
    initSocket(server);
    
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Servidor Express + Socket.io ejecutándose exitosamente en http://0.0.0.0:${PORT}`);
      // Iniciar scheduler de sincronización de vencimientos
      startSubscriptionScheduler();
      // Configurar automáticamente los webhooks para todas las instancias existentes
      configureAllWebhooks();
    });
  } catch (error) {
    console.error('❌ Error fatal al iniciar el servidor:', error);
  }
}

startServer();
