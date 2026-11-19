import { config } from './config/env.js'; // precisa ser o primeiro import (carrega o .env)
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import express from 'express';
import { createApp, errorHandler } from './app.js';
import { createSocketServer } from './socket.js';
import './db/index.js'; // abre o banco e aplica as migrações antes de aceitar conexões

// O Socket.IO precisa do servidor HTTP, e as rotas precisam do Socket.IO (para emitir eventos)
const httpServer = createServer();
const io = createSocketServer(httpServer);
const app = createApp(io);
httpServer.on('request', app);

if (config.isProd) {
  app.use(express.static(config.clientDistDir));
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    res.sendFile(resolve(config.clientDistDir, 'index.html'));
  });
} else {
  // Vite como middleware; o WebSocket do hot reload usa porta própria para não conflitar com outros projetos.
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
