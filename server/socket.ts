import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { typingSchema } from '../shared/schemas.js';
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from '../shared/types.js';
import { userFromToken } from './lib/auth.js';
import { AppError } from './lib/errors.js';
import { createMessage } from './services/messages.js';

export type IoServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

export function createSocketServer(httpServer: HttpServer): IoServer {
  const io: IoServer = new Server(httpServer, {
    // Front-end e back-end rodam na mesma origem, então não é preciso CORS
    serveClient: false,
    maxHttpBufferSize: 64 * 1024, // mensagens de texto; arquivos vão pela API REST
  });

  // ---------- Autenticação: o cliente envia o JWT em `auth.token` ----------
  io.use((socket, next) => {
    const user = userFromToken(socket.handshake.auth?.token);
    if (!user) return next(new Error('unauthorized'));
    socket.data.user = user;
    next();
  });

  // ---------- Presença: usuário online enquanto tiver ao menos uma conexão ----------
  const connections = new Map<number, number>();
  const broadcastPresence = () => io.emit('presence:update', [...connections.keys()]);

  io.on('connection', (socket) => {
    const { user } = socket.data;
    connections.set(user.id, (connections.get(user.id) ?? 0) + 1);
    broadcastPresence();

    // Salas onde este socket está "digitando", para limpar ao desconectar
    const typingIn = new Set<number>();

    socket.on('message:send', (payload, ack) => {
      if (typeof ack !== 'function') return;
      try {
        const message = createMessage(user, payload);
        io.emit('message:new', message);
        ack({ ok: true, data: message });

        if (typingIn.delete(message.roomId)) {
          socket.broadcast.emit('typing:update', {
            roomId: message.roomId,
            user: { id: user.id, displayName: user.displayName },
            isTyping: false,
          });
        }
      } catch (err) {
        if (!(err instanceof AppError)) console.error(err);
        ack({ ok: false, error: err instanceof AppError ? err.message : 'Erro ao enviar mensagem' });
      }
    });

    socket.on('typing:set', (payload) => {
      const parsed = typingSchema.safeParse(payload);
      if (!parsed.success) return;
      const { roomId, isTyping } = parsed.data;

      if (isTyping) typingIn.add(roomId);
      else typingIn.delete(roomId);
      socket.broadcast.emit('typing:update', {
        roomId,
        user: { id: user.id, displayName: user.displayName },
        isTyping,
      });
    });

    socket.on('disconnect', () => {
      for (const roomId of typingIn) {
        socket.broadcast.emit('typing:update', {
          roomId,
          user: { id: user.id, displayName: user.displayName },
          isTyping: false,
        });
      }

      const count = (connections.get(user.id) ?? 1) - 1;
      if (count > 0) connections.set(user.id, count);
      else connections.delete(user.id);
      broadcastPresence();
    });
  });

  return io;
}
