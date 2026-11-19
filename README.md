# chat-bot-monolito

Chat bot monolito com **Node.js (Express)** servindo um front-end **React** no mesmo processo e na mesma porta.

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

| Script          | Descrição                                                        |
| --------------- | ---------------------------------------------------------------- |
| `npm run dev`   | Desenvolvimento: Express + Vite como middleware, com hot reload  |
| `npm run build` | Gera o build do React em `dist/`                                 |
| `npm start`     | Produção: Express serve a API e o build estático de `dist/`      |

## Estrutura

```
server/   back-end (Express)
client/   front-end (React + Vite)
data/     banco SQLite (não versionado)
```
