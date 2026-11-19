import express, { type ErrorRequestHandler, type Express } from 'express';
import { config } from './config/env.js';
import type { ApiError, HealthResponse } from '../shared/types.js';

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));

  // ---------- API ----------
  const api = express.Router();

  api.get('/health', (_req, res) => {
    const body: HealthResponse = { ok: true, env: config.env, uptime: Math.round(process.uptime()) };
    res.json(body);
  });

  api.use((_req, res) => {
    res.status(404).json({ error: 'Rota não encontrada' } satisfies ApiError);
  });

  app.use('/api', api);

  return app;
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err);
  const status = typeof err?.status === 'number' ? err.status : 500;
  const message = err?.expose ? String(err.message) : 'Erro interno do servidor';
  res.status(status).json({ error: message } satisfies ApiError);
};
