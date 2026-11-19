import { z } from 'zod';

export const MAX_MESSAGE_LENGTH = 4000;

export const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'Usuário precisa ter pelo menos 3 caracteres')
    .max(32, 'Usuário pode ter no máximo 32 caracteres')
    .regex(/^[a-z0-9_.]+$/, 'Use apenas letras, números, "_" e "."'),
  displayName: z
    .string()
    .trim()
    .min(1, 'Informe seu nome')
    .max(60, 'Nome pode ter no máximo 60 caracteres'),
  password: z
    .string()
    .min(8, 'Senha precisa ter pelo menos 8 caracteres')
    .max(72, 'Senha pode ter no máximo 72 caracteres'),
});

export const loginSchema = z.object({
  username: z.string().trim().toLowerCase().min(1, 'Informe o usuário'),
  password: z.string().min(1, 'Informe a senha'),
});

export const createRoomSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Nome precisa ter pelo menos 2 caracteres')
    .max(40, 'Nome pode ter no máximo 40 caracteres'),
  description: z
    .string()
    .trim()
    .max(200, 'Descrição pode ter no máximo 200 caracteres')
    .optional()
    .transform((v) => v || null),
});

export const sendMessageSchema = z
  .object({
    roomId: z.number().int().positive(),
    content: z.string().trim().max(MAX_MESSAGE_LENGTH, `Mensagem pode ter no máximo ${MAX_MESSAGE_LENGTH} caracteres`),
    attachmentId: z.number().int().positive().optional(),
  })
  .refine((m) => m.content.length > 0 || m.attachmentId !== undefined, 'Mensagem vazia');

export const typingSchema = z.object({
  roomId: z.number().int().positive(),
  isTyping: z.boolean(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateRoomInput = z.input<typeof createRoomSchema>;
