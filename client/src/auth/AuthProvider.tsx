import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { LoginInput, RegisterInput } from '@shared/schemas';
import type { AuthResponse, User } from '@shared/types';
import { api, session, setUnauthorizedHandler } from '@/lib/api';

type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  token: string | null;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => session.get());
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>(token ? 'loading' : 'anonymous');

  const logout = useCallback(() => {
    session.set(null);
    setToken(null);
    setUser(null);
    setStatus('anonymous');
  }, []);

  const applyAuth = useCallback(({ token, user }: AuthResponse) => {
    session.set(token);
    setToken(token);
    setUser(user);
    setStatus('authenticated');
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  // Ao abrir o app com um token salvo, confirma que ele ainda é válido
  useEffect(() => {
    if (!token || user) return;
    let cancelled = false;
    api<User>('/auth/me')
      .then((me) => {
        if (cancelled) return;
        setUser(me);
        setStatus('authenticated');
      })
      .catch(() => !cancelled && logout());
    return () => {
      cancelled = true;
    };
  }, [token, user, logout]);

  const login = useCallback(
    async (input: LoginInput) => applyAuth(await api<AuthResponse>('/auth/login', { method: 'POST', json: input })),
    [applyAuth]
  );

  const register = useCallback(
    async (input: RegisterInput) =>
      applyAuth(await api<AuthResponse>('/auth/register', { method: 'POST', json: input })),
    [applyAuth]
  );

  const value = useMemo(
    () => ({ status, user, token, login, register, logout }),
    [status, user, token, login, register, logout]
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const ctx = use(AuthContext);
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  return ctx;
}

// Atalho para componentes que só existem com usuário logado
export function useCurrentUser(): User {
  const { user } = useAuth();
  if (!user) throw new Error('Nenhum usuário logado');
  return user;
}
