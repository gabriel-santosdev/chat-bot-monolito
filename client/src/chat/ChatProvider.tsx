import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { notifications } from '@mantine/notifications';
import type { CreateRoomInput } from '@shared/schemas';
import type { Message, MessagePage, Room, User } from '@shared/types';
import { useAuth, useCurrentUser } from '@/auth/AuthProvider';
import { api, errorMessage } from '@/lib/api';
import { connectSocket, disconnectSocket, socket } from '@/lib/socket';

const PAGE_SIZE = 50;
const TYPING_TIMEOUT_MS = 6000; // remove o "digitando" se o aviso de parada se perder
const ACTIVE_ROOM_KEY = 'chat.activeRoom';

export type ConnectionStatus = 'connecting' | 'online' | 'offline';

export interface RoomMessages {
  items: Message[];
  hasMore: boolean;
  loading: boolean;
  loaded: boolean;
}

export interface TypingUser {
  id: number;
  displayName: string;
}

interface ChatContextValue {
  connection: ConnectionStatus;
  rooms: Room[];
  activeRoom: Room | null;
  activeMessages: RoomMessages | null;
  unread: Record<number, number>;
  typingInActive: TypingUser[];
  users: User[];
  onlineIds: Set<number>;
  selectRoom: (roomId: number) => void;
  loadOlder: () => Promise<void>;
  sendMessage: (content: string, attachmentId?: number) => Promise<void>;
  setTyping: (isTyping: boolean) => void;
  createRoom: (input: CreateRoomInput) => Promise<Room>;
}

const ChatContext = createContext<ChatContextValue | null>(null);

const readSavedRoom = () => {
  try {
    return Number(localStorage.getItem(ACTIVE_ROOM_KEY)) || null;
  } catch {
    return null;
  }
};

const appendUnique = (items: Message[], message: Message) =>
  items.some((m) => m.id === message.id) ? items : [...items, message];

export function ChatProvider({ children }: { children: ReactNode }) {
  const { token, logout } = useAuth();
  const me = useCurrentUser();

  const [connection, setConnection] = useState<ConnectionStatus>('connecting');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<number | null>(readSavedRoom);
  const [messages, setMessages] = useState<Record<number, RoomMessages>>({});
  const [unread, setUnread] = useState<Record<number, number>>({});
  const [typing, setTypingState] = useState<Record<number, TypingUser[]>>({});
  const [users, setUsers] = useState<User[]>([]);
  const [onlineIds, setOnlineIds] = useState<Set<number>>(new Set());

  // Refs para os handlers do socket (registrados uma vez) lerem o estado atual
  const activeRoomRef = useRef(activeRoomId);
  activeRoomRef.current = activeRoomId;
  const knownUserIds = useRef(new Set<number>());
  const loadingRooms = useRef(new Set<number>());

  // ---------- Carregamento via API ----------

  const fetchRooms = useCallback(async () => {
    const list = await api<Room[]>('/rooms');
    setRooms(list);
    setActiveRoomId((current) => (current && list.some((r) => r.id === current) ? current : (list[0]?.id ?? null)));
  }, []);

  const fetchUsers = useCallback(async () => {
    const list = await api<User[]>('/users');
    knownUserIds.current = new Set(list.map((u) => u.id));
    setUsers(list);
  }, []);

  const loadPage = useCallback(async (roomId: number, beforeId?: number) => {
    if (loadingRooms.current.has(roomId)) return;
    loadingRooms.current.add(roomId);
    setMessages((prev) => ({
      ...prev,
      [roomId]: { items: [], hasMore: false, loaded: false, ...prev[roomId], loading: true },
    }));

    try {
      const query = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (beforeId) query.set('before', String(beforeId));
      const page = await api<MessagePage>(`/rooms/${roomId}/messages?${query}`);

      setMessages((prev) => {
        const current = prev[roomId];
        // Na primeira carga, mensagens recebidas pelo socket durante o fetch são preservadas
        const existing = current?.items ?? [];
        const merged = [...page.messages, ...existing.filter((m) => !page.messages.some((p) => p.id === m.id))];
        return {
          ...prev,
          [roomId]: { items: merged, hasMore: page.hasMore, loaded: true, loading: false },
        };
      });
    } catch (err) {
      notifications.show({ color: 'red', title: 'Erro ao carregar mensagens', message: errorMessage(err) });
      // Marca como carregada (sem repetir sozinho em loop) e deixa o botão "carregar anteriores"
      // visível para o usuário tentar de novo
      setMessages((prev) => {
        const current = prev[roomId];
        if (!current) return prev;
        return { ...prev, [roomId]: { ...current, loading: false, loaded: true, hasMore: true } };
      });
    } finally {
      loadingRooms.current.delete(roomId);
    }
  }, []);

  // ---------- Conexão em tempo real ----------

  useEffect(() => {
    if (!token) return;

    const typingTimers = new Map<string, ReturnType<typeof setTimeout>>();
    let connectedBefore = false;

    const removeTyping = (roomId: number, userId: number) => {
      const key = `${roomId}:${userId}`;
      clearTimeout(typingTimers.get(key));
      typingTimers.delete(key);
      setTypingState((prev) => {
        const list = prev[roomId];
        if (!list?.some((u) => u.id === userId)) return prev;
        return { ...prev, [roomId]: list.filter((u) => u.id !== userId) };
      });
    };

    const onConnect = () => {
      setConnection('online');
      // Numa reconexão podem ter chegado mensagens/salas que perdemos: recarrega tudo
      if (connectedBefore) {
        loadingRooms.current.clear();
        setMessages({});
        void fetchRooms().catch(() => {});
        void fetchUsers().catch(() => {});
      }
      connectedBefore = true;
    };

    const onDisconnect = () => setConnection('offline');

    const onConnectError = (err: Error) => {
      if (err.message === 'unauthorized') logout();
      else setConnection('offline');
    };

    const onMessage = (message: Message) => {
      setMessages((prev) => {
        const current = prev[message.roomId];
        if (!current?.loaded) return prev; // será carregada quando a sala for aberta
        return { ...prev, [message.roomId]: { ...current, items: appendUnique(current.items, message) } };
      });
      if (message.roomId !== activeRoomRef.current && message.author.id !== me.id) {
        setUnread((prev) => ({ ...prev, [message.roomId]: (prev[message.roomId] ?? 0) + 1 }));
      }
      removeTyping(message.roomId, message.author.id);
    };

    const onRoom = (room: Room) => setRooms((prev) => (prev.some((r) => r.id === room.id) ? prev : [...prev, room]));

    const onTyping = ({ roomId, user, isTyping }: { roomId: number; user: TypingUser; isTyping: boolean }) => {
      if (user.id === me.id) return;
      if (!isTyping) return removeTyping(roomId, user.id);

      const key = `${roomId}:${user.id}`;
      clearTimeout(typingTimers.get(key));
      typingTimers.set(
        key,
        setTimeout(() => removeTyping(roomId, user.id), TYPING_TIMEOUT_MS)
      );
      setTypingState((prev) => {
        const list = prev[roomId] ?? [];
        return list.some((u) => u.id === user.id) ? prev : { ...prev, [roomId]: [...list, user] };
      });
    };

    const onPresence = (ids: number[]) => {
      setOnlineIds(new Set(ids));
      // Alguém novo se cadastrou: atualiza a lista de usuários
      if (ids.some((id) => !knownUserIds.current.has(id))) void fetchUsers().catch(() => {});
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('message:new', onMessage);
    socket.on('room:new', onRoom);
    socket.on('typing:update', onTyping);
    socket.on('presence:update', onPresence);
    connectSocket(token);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('message:new', onMessage);
      socket.off('room:new', onRoom);
      socket.off('typing:update', onTyping);
      socket.off('presence:update', onPresence);
      typingTimers.forEach(clearTimeout);
      disconnectSocket();
    };
  }, [token, me.id, logout, fetchRooms, fetchUsers]);

  // Carga inicial
  useEffect(() => {
    fetchRooms().catch((err) =>
      notifications.show({ color: 'red', title: 'Erro ao carregar salas', message: errorMessage(err) })
    );
    fetchUsers().catch(() => {});
  }, [fetchRooms, fetchUsers]);

  // Abre a sala ativa: carrega o histórico (se preciso), zera não lidas e lembra a escolha
  const activeMessages = activeRoomId ? (messages[activeRoomId] ?? null) : null;
  useEffect(() => {
    if (!activeRoomId) return;
    if (!activeMessages?.loaded && !activeMessages?.loading) void loadPage(activeRoomId);
  }, [activeRoomId, activeMessages?.loaded, activeMessages?.loading, loadPage]);

  useEffect(() => {
    if (!activeRoomId) return;
    setUnread((prev) => (prev[activeRoomId] ? { ...prev, [activeRoomId]: 0 } : prev));
    try {
      localStorage.setItem(ACTIVE_ROOM_KEY, String(activeRoomId));
    } catch {
      // ignorado: só serve para reabrir a mesma sala
    }
  }, [activeRoomId]);

  // ---------- Ações ----------

  const selectRoom = useCallback((roomId: number) => setActiveRoomId(roomId), []);

  const loadOlder = useCallback(async () => {
    if (!activeRoomId || !activeMessages?.hasMore || activeMessages.loading) return;
    await loadPage(activeRoomId, activeMessages.items[0]?.id);
  }, [activeRoomId, activeMessages, loadPage]);

  const sendMessage = useCallback(
    (content: string, attachmentId?: number) =>
      new Promise<void>((resolve, reject) => {
        if (!activeRoomId) return reject(new Error('Nenhuma sala selecionada'));
        if (!socket.connected) return reject(new Error('Sem conexão com o servidor'));

        socket.timeout(10_000).emit('message:send', { roomId: activeRoomId, content, attachmentId }, (err, res) => {
          if (err) return reject(new Error('O servidor não respondeu a tempo'));
          if (!res.ok) return reject(new Error(res.error));

          const message = res.data;
          setMessages((prev) => {
            const current = prev[message.roomId];
            if (!current?.loaded) return prev;
            return { ...prev, [message.roomId]: { ...current, items: appendUnique(current.items, message) } };
          });
          resolve();
        });
      }),
    [activeRoomId]
  );

  const setTyping = useCallback(
    (isTyping: boolean) => {
      if (activeRoomId && socket.connected) socket.emit('typing:set', { roomId: activeRoomId, isTyping });
    },
    [activeRoomId]
  );

  const createRoom = useCallback(async (input: CreateRoomInput) => {
    const room = await api<Room>('/rooms', { method: 'POST', json: input });
    setRooms((prev) => (prev.some((r) => r.id === room.id) ? prev : [...prev, room]));
    setActiveRoomId(room.id);
    return room;
  }, []);

  const value = useMemo<ChatContextValue>(
    () => ({
      connection,
      rooms,
      activeRoom: rooms.find((r) => r.id === activeRoomId) ?? null,
      activeMessages,
      unread,
      typingInActive: activeRoomId ? (typing[activeRoomId] ?? []) : [],
      users,
      onlineIds,
      selectRoom,
      loadOlder,
      sendMessage,
      setTyping,
      createRoom,
    }),
    [
      connection,
      rooms,
      activeRoomId,
      activeMessages,
      unread,
      typing,
      users,
      onlineIds,
      selectRoom,
      loadOlder,
      sendMessage,
      setTyping,
      createRoom,
    ]
  );

  return <ChatContext value={value}>{children}</ChatContext>;
}

export function useChat(): ChatContextValue {
  const ctx = use(ChatContext);
  if (!ctx) throw new Error('useChat precisa estar dentro de <ChatProvider>');
  return ctx;
}
