// Tudo que trafega pela API REST ou pelo Socket.IO deve ser tipado aqui.

export interface HealthResponse {
  ok: boolean;
  env: 'development' | 'production' | 'test';
  uptime: number;
}

export interface ApiError {
  error: string;
}

export interface User {
  id: number;
  username: string;
  displayName: string;
  createdAt: string;
}

export interface Room {
  id: number;
  name: string;
  description: string | null;
  createdBy: number | null;
  createdAt: string;
}

export interface Attachment {
  id: number;
  url: string;
  originalName: string;
  mimeType: string;
  size: number;
}

export interface Message {
  id: number;
  roomId: number;
  author: User;
  content: string;
  attachment: Attachment | null;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface MessagePage {
  messages: Message[]; // em ordem cronológica (mais antiga primeiro)
  hasMore: boolean;
}

export type Ack<T> = (res: { ok: true; data: T } | { ok: false; error: string }) => void;

export interface TypingEvent {
  roomId: number;
  user: Pick<User, 'id' | 'displayName'>;
  isTyping: boolean;
}

export interface ServerToClientEvents {
  'message:new': (message: Message) => void;
  'room:new': (room: Room) => void;
  'typing:update': (event: TypingEvent) => void;
  'presence:update': (onlineUserIds: number[]) => void;
}

export interface ClientToServerEvents {
  'message:send': (payload: { roomId: number; content: string; attachmentId?: number }, ack: Ack<Message>) => void;
  'typing:set': (payload: { roomId: number; isTyping: boolean }) => void;
}

export interface SocketData {
  user: User;
}
