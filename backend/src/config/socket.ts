import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { authenticate, Principal } from '../middleware/auth.middleware';
import pool from './database';

let io: SocketIOServer;

export function initSocket(server: HttpServer): SocketIOServer {
  io = new SocketIOServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      const principal = typeof token === 'string' ? await authenticate(token) : null;
      if (!principal || principal.environment !== 'live') return next(new Error('UNAUTHORIZED'));
      socket.data.principal = principal;
      next();
    } catch { next(new Error('AUTH_UNAVAILABLE')); }
  });
  io.on('connection', (socket) => {
    console.log(`🔌 [Socket.io] Nuevo cliente conectado: ${socket.id}`);

    // Unirse a una sala de la instancia para recibir mensajes dirigidos
    socket.on('join_instance', async (instanceName: string, ack?: (value: any) => void) => {
      if (typeof instanceName === 'string' && /^[A-Za-z0-9_-]{1,255}$/.test(instanceName)) {
        try {
          // Revalidate credentials on each join (revocation/account changes).
          const principal = await authenticate(socket.handshake.auth.token) as Principal | null;
          if (!principal || principal.environment !== 'live' || (principal.scopes && !principal.scopes.includes('instances:read'))) {
            if (typeof ack === 'function') ack({ok: false}); return;
          }
          const result = await pool.query(`SELECT i.id FROM instances i JOIN users u ON u.id=i.user_id
            WHERE i.instance_name=$1 AND i.is_enabled IS NOT FALSE AND u.status NOT IN ('blocked','suspended')
            AND (($2::text IS NOT NULL AND u.partner_id=$2) OR ($2::text IS NULL AND i.user_id=$3))
            AND ($4::text IS NULL OR i.id=$4)`, [instanceName, principal.partnerId || null, principal.userId, principal.instanceId || null]);
          if (!result.rows.length) { if (typeof ack === 'function') ack({ok: false}); return; }
        const roomName = `instance_${instanceName}`;
        await socket.join(roomName);
        if (typeof ack === 'function') ack({ok: true});
        console.log(`👥 [Socket.io] Cliente ${socket.id} se unió a la sala: ${roomName}`);
        } catch { if (typeof ack === 'function') ack({ok: false}); }
      }
    });

    socket.on('disconnect', () => {
      console.log(`🔌 [Socket.io] Cliente desconectado: ${socket.id}`);
    });
  });

  return io;
}

export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error('[Socket.io] El servidor Socket.io no está inicializado.');
  }
  return io;
}
