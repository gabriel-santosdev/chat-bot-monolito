import { Router } from 'express';
import type { User } from '../../shared/types.js';
import { users } from '../db/repositories.js';
import { requireAuth } from '../lib/auth.js';

export const usersRouter = Router();

// Lista de usuários (sem dados sensíveis), usada para exibir quem está online
usersRouter.get('/', requireAuth, (_req, res) => {
  res.json(users.list() satisfies User[]);
});
