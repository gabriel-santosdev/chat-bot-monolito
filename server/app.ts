import express, { type ErrorRequestHandler, type Express } from 'express';
import { config } from './config/env.js';
import type { ApiError, HealthResponse } from '../shared/types.js';
import { authRouter } from './routes/auth.js';
import { roomsRouter } from './routes/rooms.js';
import { uploadErrorHandler, uploadsApiRouter, uploadsStatic } from './routes/uploads.js';
import { usersRouter } from './routes/users.js';
import type { IoServer } from './socket.js';

export function createApp(io: IoServer): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));

  const api = express.Router();

  api.get('/health', (_req, res) => {
    const body: HealthResponse = { ok: true, env: config.env, uptime: Math.round(process.uptime()) };
    res.json(body);
  });

  api.use('/auth', authRouter);
  api.use('/users', usersRouter);
  api.use('/rooms', roomsRouter(io));
  api.use('/uploads', uploadsApiRouter, uploadErrorHandler);

  api.use((_req, res) => {
    res.status(404).json({ error: 'Rota não encontrada' } satisfies ApiError);
  });

  app.use('/api', api);

  app.use('/uploads', uploadsStatic, (_req, res) => {
    res.status(404).json({ error: 'Arquivo não encontrado' } satisfies ApiError);
  });

  return app;
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  // Erros de JSON malformado no corpo da requisição (express.json)
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON inválido' } satisfies ApiError);
  }

  const status = typeof err?.status === 'number' ? err.status : 500;
  if (status >= 500) console.error(err);

  const message = err?.expose ? String(err.message) : 'Erro interno do servidor';
  res.status(status).json({ error: message } satisfies ApiError);
};
