// Carrega o .env (se existir) e valida as variáveis de ambiente.
// Sem .env, os valores padrão abaixo são usados (exceto JWT_SECRET em produção).
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

const DEV_JWT_SECRET = 'dev-only-secret-nao-use-em-producao-0000000000';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  HMR_PORT: z.coerce.number().int().positive().default(24679),
  DB_PATH: z.string().default('data/chat.db'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET precisa ter pelo menos 32 caracteres').optional(),
  UPLOAD_DIR: z.string().default('uploads'),
  MAX_UPLOAD_MB: z.coerce.number().positive().default(10),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('Variáveis de ambiente inválidas:');
  console.error(z.prettifyError(parsed.error));
  process.exit(1);
}

const env = parsed.data;
const isProd = env.NODE_ENV === 'production';

if (isProd && !env.JWT_SECRET) {
  console.error('JWT_SECRET é obrigatório em produção.');
  process.exit(1);
}

export const config = {
  env: env.NODE_ENV,
  isProd,
  port: env.PORT,
  hmrPort: env.HMR_PORT,
  dbPath: resolve(env.DB_PATH),
  jwtSecret: env.JWT_SECRET ?? DEV_JWT_SECRET,
  uploadDir: resolve(env.UPLOAD_DIR),
  maxUploadBytes: env.MAX_UPLOAD_MB * 1024 * 1024,
  clientDistDir: resolve('dist'),
} as const;
