import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

let io: SocketIOServer;

export function initSocket(server: HttpServer): SocketIOServer {
  io = new SocketIOServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔌 [Socket.io] Nuevo cliente conectado: ${socket.id}`);

    // Unirse a una sala de la instancia para recibir mensajes dirigidos
    socket.on('join_instance', (instanceName: string) => {
      if (instanceName) {
        const roomName = `instance_${instanceName}`;
        socket.join(roomName);
        console.log(`👥 [Socket.io] Cliente ${socket.id} se unió a la sala: ${roomName}`);
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
