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
import { EvolutionService } from './services/evolution.service';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Configuración de orígenes autorizados para desarrollo y producción en Railway
const allowedOrigins = [
  'https://zaza-click-frontend-production.up.railway.app',
  'https://zaza-click-20-production.up.railway.app',
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
    'Accept',
    'X-Requested-With'
  ],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  credentials: true,
  optionsSuccessStatus: 200
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// SaaS Core API Routes Mount
app.use('/api/auth', authRoutes);
app.use('/api/instances', instanceRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/webhooks', webhookRoutes);

// Root Health Check Route
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Zaza.click 2.0 - WhatsApp API SaaS Gateway',
    version: '2.0.0',
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
    
    const server = createServer(app);
    initSocket(server);
    
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Servidor Express + Socket.io ejecutándose exitosamente en http://0.0.0.0:${PORT}`);
      // Configurar automáticamente los webhooks para todas las instancias existentes
      configureAllWebhooks();
    });
  } catch (error) {
    console.error('❌ Error fatal al iniciar el servidor:', error);
  }
}

startServer();
