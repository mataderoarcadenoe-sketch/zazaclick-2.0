import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import { initDatabase } from './config/database';
import authRoutes from './routes/auth.routes';
import instanceRoutes from './routes/instance.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors({
  origin: '*', // Permitir conexiones desde cualquier origen para desarrollo
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
    timestamp: new Date().toISOString()
  });
});

// Start Server
async function startServer() {
  try {
    console.log('🔄 Inicializando base de datos...');
    await initDatabase();
    
    app.listen(PORT, () => {
      console.log(`🚀 Servidor ejecutándose en el puerto http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Error al iniciar el servidor:', error);
    process.exit(1);
  }
}

startServer();
