import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { extname } from 'node:path';
import express, { Router, type ErrorRequestHandler } from 'express';
import multer from 'multer';
import type { Attachment } from '../../shared/types.js';
import { config } from '../config/env.js';
import { attachments } from '../db/repositories.js';
import { currentUser, requireAuth } from '../lib/auth.js';
import { AppError } from '../lib/errors.js';

mkdirSync(config.uploadDir, { recursive: true });

// Arquivos são salvos com nome aleatório (UUID); o nome original fica só no banco.
const upload = multer({
  storage: multer.diskStorage({
    destination: config.uploadDir,
    filename: (_req, file, cb) => {
      const ext = extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, '').slice(0, 10);
      cb(null, `${randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: config.maxUploadBytes, files: 1 },
});

// Multer decodifica o nome do arquivo como latin1; convertemos para UTF-8 (acentos)
const decodeName = (name: string) => Buffer.from(name, 'latin1').toString('utf8');

// POST /api/uploads (multipart, campo "file") -> Attachment ainda não vinculado a mensagem
export const uploadsApiRouter = Router();

uploadsApiRouter.post('/', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) throw new AppError(400, 'Nenhum arquivo enviado (campo "file")');

  const { filename, originalname, mimetype, size } = req.file;
  const attachment = attachments.create(currentUser(req).id, filename, decodeName(originalname), mimetype, size);
  res.status(201).json(attachment satisfies Attachment);
});

export const uploadErrorHandler: ErrorRequestHandler = (err, _req, _res, next) => {
  if (err instanceof multer.MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? `Arquivo maior que o limite de ${Math.round(config.maxUploadBytes / 1024 / 1024)} MB`
        : 'Falha no envio do arquivo';
    return next(new AppError(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400, message));
  }
  next(err);
};

// GET /uploads/<arquivo>: arquivos enviados pelos usuários.
// Só imagens "seguras" abrem no navegador; o resto é forçado a download, e tudo roda em sandbox
// (evita que um HTML/SVG enviado execute scripts na origem do app).
const INLINE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif']);

export const uploadsStatic = express.static(config.uploadDir, {
  index: false,
  dotfiles: 'deny',
  maxAge: '30d',
  immutable: true,
  setHeaders: (res, path) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    if (!INLINE_EXTENSIONS.has(extname(path).toLowerCase())) {
      res.setHeader('Content-Disposition', 'attachment');
    }
  },
});
