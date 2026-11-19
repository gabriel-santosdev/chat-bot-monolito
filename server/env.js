// Carrega o arquivo .env (se existir) para process.env.
// Se não houver .env, o servidor usa os valores padrão definidos no código.
import { existsSync } from 'node:fs';

if (existsSync('.env')) {
  process.loadEnvFile('.env');
}
