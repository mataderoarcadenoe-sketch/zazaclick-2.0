import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import { initDatabase } from './config/database';
import authRoutes from './routes/auth.routes';
import instanceRoutes from './routes/instance.routes';

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

// Start Server
async function startServer() {
  try {
    console.log('🔄 Inicializando base de datos...');
    await initDatabase();
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Servidor ejecutándose exitosamente en http://0.0.0.0:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Error fatal al iniciar el servidor:', error);
  }
}

startServer();
