import type { z } from 'zod';

// Erro "esperado": a mensagem é segura para mostrar ao usuário (expose = true).
export class AppError extends Error {
  readonly expose = true;

  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
  }
}

export function parse<S extends z.ZodType>(schema: S, data: unknown): z.output<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new AppError(400, result.error.issues[0]?.message ?? 'Dados inválidos');
  }
  return result.data;
}
