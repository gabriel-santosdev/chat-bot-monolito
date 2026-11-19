import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@shared/types';

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// Mesma origem do front-end: o Express serve a página e o Socket.IO na mesma porta.
// A conexão só é aberta depois do login (o token vai em `auth`).
export const socket: AppSocket = io({
  autoConnect: false,
  transports: ['websocket'],
});

export function connectSocket(token: string) {
  socket.auth = { token };
  socket.connect();
}

export function disconnectSocket() {
  socket.disconnect();
}
