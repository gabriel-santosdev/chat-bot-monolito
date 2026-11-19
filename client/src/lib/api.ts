import type { ApiError } from '@shared/types';

const TOKEN_KEY = 'chat.token';

export const session = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token: string | null) {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      // sem armazenamento: a sessão dura só enquanto a aba estiver aberta
    }
  },
};

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
  }
}

// Chamado quando a API responde 401 (token expirado/inválido); registrado pelo AuthProvider
let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: (() => void) | null) => {
  onUnauthorized = fn;
};

export async function api<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const token = session.get();

  const res = await fetch(`/api${path}`, {
    ...rest,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    headers: {
      ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...rest.headers,
    },
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiError | null;
    if (res.status === 401 && token) onUnauthorized?.();
    throw new HttpError(res.status, body?.error ?? `Erro ${res.status}`);
  }

  return (res.status === 204 ? undefined : await res.json()) as T;
}

export const errorMessage = (err: unknown) =>
  err instanceof HttpError ? err.message : 'Não foi possível falar com o servidor';
