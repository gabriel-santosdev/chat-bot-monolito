import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '../shared/types.js';

export type IoServer = Server<ClientToServerEvents, ServerToClientEvents>;

export function createSocketServer(httpServer: HttpServer): IoServer {
  const io: IoServer = new Server(httpServer, {
    // Front-end e back-end rodam na mesma origem, então não é preciso CORS
    serveClient: false,
  });

  io.on('connection', (socket) => {
    console.log(`[socket] conectado: ${socket.id}`);

    socket.on('disconnect', (reason) => {
      console.log(`[socket] desconectado: ${socket.id} (${reason})`);
    });
  });

  return io;
}
