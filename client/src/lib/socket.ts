import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@shared/types';

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// Mesma origem do front-end: o Express serve a página e o Socket.IO na mesma porta.
export const socket: AppSocket = io({
  autoConnect: true,
  transports: ['websocket'],
});
