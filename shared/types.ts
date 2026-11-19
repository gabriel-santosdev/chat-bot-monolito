// Tipos compartilhados entre back-end (server/) e front-end (client/).
// Tudo que trafega pela API REST ou pelo Socket.IO deve ser tipado aqui.

export interface HealthResponse {
  ok: boolean;
  env: 'development' | 'production' | 'test';
  uptime: number;
}

export interface ApiError {
  error: string;
}

// ---------- Socket.IO ----------
// Os eventos serão adicionados conforme as funcionalidades forem criadas
// (mensagens, digitação, presença, salas...).

export interface ServerToClientEvents {}

export interface ClientToServerEvents {}
