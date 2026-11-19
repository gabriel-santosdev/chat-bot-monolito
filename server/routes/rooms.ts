import { Router } from 'express';
import { z } from 'zod';
import { createRoomSchema } from '../../shared/schemas.js';
import type { MessagePage, Room } from '../../shared/types.js';
import { messages, rooms } from '../db/repositories.js';
import { currentUser, requireAuth } from '../lib/auth.js';
import { AppError, parse } from '../lib/errors.js';
import type { IoServer } from '../socket.js';

const positiveInt = (error: string) => z.coerce.number({ error }).int({ error }).positive({ error });

const idParam = positiveInt('ID de sala inválido');

const pageQuery = z.object({
  before: positiveInt('Parâmetro "before" inválido').default(Number.MAX_SAFE_INTEGER),
  limit: positiveInt('Parâmetro "limit" inválido').max(100, { error: 'Parâmetro "limit" deve ser no máximo 100' }).default(50),
});

export function roomsRouter(io: IoServer) {
  const router = Router();
  router.use(requireAuth);

  router.get('/', (_req, res) => {
    res.json(rooms.list() satisfies Room[]);
  });

  router.post('/', (req, res) => {
    const { name, description } = parse(createRoomSchema, req.body);
    if (rooms.existsByName(name)) throw new AppError(409, 'Já existe uma sala com esse nome');

    const room = rooms.create(name, description, currentUser(req).id);
    io.emit('room:new', room);
    res.status(201).json(room satisfies Room);
  });

  router.get('/:id/messages', (req, res) => {
    const roomId = parse(idParam, req.params.id);
    const { before, limit } = parse(pageQuery, req.query);
    if (!rooms.findById(roomId)) throw new AppError(404, 'Sala não encontrada');

    res.json(messages.page(roomId, before, limit) satisfies MessagePage);
  });

  return router;
}
