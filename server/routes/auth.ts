import { Router } from 'express';
import { loginSchema, registerSchema } from '../../shared/schemas.js';
import type { AuthResponse, User } from '../../shared/types.js';
import { users } from '../db/repositories.js';
import { currentUser, hashPassword, requireAuth, signToken, verifyPassword } from '../lib/auth.js';
import { AppError, parse } from '../lib/errors.js';

export const authRouter = Router();

authRouter.post('/register', async (req, res) => {
  const { username, displayName, password } = parse(registerSchema, req.body);

  if (users.findByUsernameWithHash(username)) throw new AppError(409, 'Este usuário já está em uso');

  const user = users.create(username, displayName, await hashPassword(password));
  res.status(201).json({ token: signToken(user), user } satisfies AuthResponse);
});

authRouter.post('/login', async (req, res) => {
  const { username, password } = parse(loginSchema, req.body);

  const found = users.findByUsernameWithHash(username);
  const ok = await verifyPassword(password, found?.passwordHash ?? null);
  if (!found || !ok) throw new AppError(401, 'Usuário ou senha incorretos');

  res.json({ token: signToken(found.user), user: found.user } satisfies AuthResponse);
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json(currentUser(req) satisfies User);
});
