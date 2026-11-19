# chat-bot-monolito

Sistema de comunicação em tempo real: **Node.js (Express + Socket.IO)** servindo um front-end **React** no mesmo processo e na mesma porta, tudo em **TypeScript**.

## Stack

- **Back-end:** Express 5, Socket.IO, Zod (validação do `.env`), SQLite, JWT, Multer (uploads)
- **Front-end:** React 19, Mantine (componentes e tema claro/escuro), SCSS no padrão BEM, Tabler Icons
- **Ferramentas:** TypeScript, Vite (middleware em dev), tsx

## Requisitos

- Node.js 22.13 ou superior

## Como rodar

```bash
npm install
cp .env.example .env   # opcional: sem .env, os valores padrão são usados
npm run dev
```

Acesse http://localhost:3001

## Scripts

| Script              | Descrição                                                              |
| ------------------- | ---------------------------------------------------------------------- |
| `npm run dev`       | Desenvolvimento: Express + Vite como middleware, com hot reload        |
| `npm run typecheck` | Checa os tipos do back-end e do front-end                              |
| `npm run build`     | Typecheck + build do React em `dist/` + compila o servidor em `build/` |
| `npm start`         | Produção: Express serve a API, o WebSocket e o build de `dist/`        |

Em produção, `JWT_SECRET` é obrigatório (mínimo 32 caracteres).

## Estrutura

```
server/            back-end
  config/env.ts    leitura e validação das variáveis de ambiente
  app.ts           app Express e rotas da API (/api)
  socket.ts        servidor Socket.IO
  index.ts         ponto de entrada (HTTP + Vite em dev / estáticos em prod)
client/            front-end (React + Vite)
  src/components/  componentes, cada um com seu .tsx e .scss (BEM)
  src/lib/         cliente da API e do Socket.IO
  src/styles/      estilos globais, variáveis e mixins SCSS
shared/types.ts    tipos compartilhados entre back e front (API e eventos do socket)
data/              banco SQLite (não versionado)
```
