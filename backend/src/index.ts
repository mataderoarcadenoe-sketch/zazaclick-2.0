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
// Default to 3000 to match Railway default target port or process.env.PORT
const PORT = parseInt(process.env.PORT || '3000', 10);

// Middlewares
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-id']
}));
app.use(express.json());

// Routes Mount
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
    console.log('🔄 Inicializando base de datos...');
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
