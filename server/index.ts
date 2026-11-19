import { config } from './config/env.js'; // precisa ser o primeiro import (carrega o .env)
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import express from 'express';
import { createApp, errorHandler } from './app.js';
import { createSocketServer } from './socket.js';

const app = createApp();
const httpServer = createServer(app);
createSocketServer(httpServer);

// ---------- Front-end ----------
if (config.isProd) {
  // Produção: serve o build estático do React (pasta dist/)
  app.use(express.static(config.clientDistDir));
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    res.sendFile(resolve(config.clientDistDir, 'index.html'));
  });
} else {
  // Desenvolvimento: Vite como middleware (hot reload no mesmo processo e porta).
  // O WebSocket do hot reload usa porta própria para não conflitar com outros projetos.
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true, hmr: { port: config.hmrPort } },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

app.use(errorHandler);

httpServer.listen(config.port, () => {
  console.log(`Servidor rodando em http://localhost:${config.port} (${config.env})`);
});
