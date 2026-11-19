import './env.js'; // precisa ser o primeiro import
import express from 'express';
import { resolve } from 'node:path';

const isProd = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT) || 3001;

const app = express();
app.use(express.json({ limit: '100kb' }));

// ---------- API ----------
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, env: isProd ? 'production' : 'development' });
});

// Rota temporária: devolve a mensagem recebida (eco).
// Será substituída pelo motor de regras + SQLite nas próximas etapas.
app.post('/api/chat', (req, res) => {
  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  if (!text) return res.status(400).json({ error: 'O campo "text" é obrigatório' });
  res.json({ reply: `Você disse: "${text}"` });
});

app.use('/api', (_req, res) => res.status(404).json({ error: 'Rota não encontrada' }));

// ---------- Front-end ----------
if (isProd) {
  // Produção: serve o build estático do React
  const dist = resolve('dist');
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(resolve(dist, 'index.html')));
} else {
  // Desenvolvimento: Vite como middleware (hot reload no mesmo processo e porta)
  const { createServer } = await import('vite');
  // Porta própria para o WebSocket do hot reload, para não conflitar com outros projetos Vite
  const hmrPort = Number(process.env.HMR_PORT) || 24679;
  const vite = await createServer({
    server: { middlewareMode: true, hmr: { port: hmrPort } },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

// ---------- Erros ----------
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.expose ? err.message : 'Erro interno do servidor' });
});

app.listen(PORT, () => {
  console.log(`Chat bot rodando em http://localhost:${PORT} (${isProd ? 'produção' : 'desenvolvimento'})`);
});
