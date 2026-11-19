import type { NextFunction, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { users } from '../db/repositories.js';
import type { User } from '../../shared/types.js';
import { AppError } from './errors.js';

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

const TOKEN_TTL = '7d';
const BCRYPT_ROUNDS = 10;

// Hash usado quando o usuário não existe, para o login levar o mesmo tempo nos dois casos
const DUMMY_HASH = bcrypt.hashSync('senha-inexistente', BCRYPT_ROUNDS);

export const hashPassword = (password: string) => bcrypt.hash(password, BCRYPT_ROUNDS);

export const verifyPassword = (password: string, hash: string | null) =>
  bcrypt.compare(password, hash ?? DUMMY_HASH).then((ok) => ok && hash !== null);

export function signToken(user: User): string {
  return jwt.sign({}, config.jwtSecret, { subject: String(user.id), expiresIn: TOKEN_TTL, algorithm: 'HS256' });
}

// Retorna o usuário dono do token, ou null se o token for inválido/expirado
export function userFromToken(token: unknown): User | null {
  if (typeof token !== 'string' || !token) return null;
  try {
    const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
    const id = typeof payload === 'object' ? Number(payload.sub) : NaN;
    return Number.isInteger(id) ? users.findById(id) : null;
  } catch {
    return null;
  }
}

// Middleware: exige "Authorization: Bearer <token>" e preenche req.user
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const user = userFromToken(token);
  if (!user) return next(new AppError(401, 'Sessão inválida ou expirada'));
  req.user = user;
  next();
}

// Uso dentro de rotas protegidas por requireAuth
export function currentUser(req: Request): User {
  if (!req.user) throw new AppError(401, 'Não autenticado');
  return req.user;
}
