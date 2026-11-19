import { Fragment, useCallback, useLayoutEffect, useRef } from 'react';
import { Button, Center, Divider, Loader, ScrollArea, Stack, Text, ThemeIcon } from '@mantine/core';
import { IconMessageCircle } from '@tabler/icons-react';
import type { Message } from '@shared/types';
import { useCurrentUser } from '@/auth/AuthProvider';
import { useChat } from '@/chat/ChatProvider';
import { formatDay, sameDay } from '@/lib/format';
import { MessageItem } from './MessageItem';
import './MessageList.scss';

const GROUP_WINDOW_MS = 5 * 60 * 1000; // mensagens do mesmo autor em até 5 min ficam agrupadas
const NEAR_BOTTOM_PX = 120;

const isCompact = (prev: Message | undefined, current: Message) =>
  !!prev &&
  prev.author.id === current.author.id &&
  sameDay(prev.createdAt, current.createdAt) &&
  new Date(current.createdAt).getTime() - new Date(prev.createdAt).getTime() < GROUP_WINDOW_MS;

export function MessageList() {
  const me = useCurrentUser();
  const { activeRoom, activeMessages, loadOlder } = useChat();
  const items = activeMessages?.items ?? [];

  const viewportRef = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const snapshot = useRef<{ roomId?: number; firstId?: number; lastId?: number; scrollHeight: number }>({
    scrollHeight: 0,
  });

  const scrollToBottom = useCallback((smooth = false) => {
    const vp = viewportRef.current;
    if (vp) vp.scrollTo({ top: vp.scrollHeight, behavior: smooth ? 'smooth' : 'instant' });
  }, []);

  // Mantém a rolagem no lugar certo conforme mensagens entram (no fim) ou são carregadas (no topo)
  useLayoutEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;

    const prev = snapshot.current;
    const firstId = items[0]?.id;
    const last = items.at(-1);

    if (prev.roomId !== activeRoom?.id || prev.lastId === undefined) {
      scrollToBottom(); // abriu a sala ou chegou a primeira página
    } else if (firstId !== prev.firstId && last?.id === prev.lastId) {
      vp.scrollTop += vp.scrollHeight - prev.scrollHeight; // mensagens antigas no topo
    } else if (last && last.id !== prev.lastId && (nearBottom.current || last.author.id === me.id)) {
      scrollToBottom(true); // mensagem nova
    }

    snapshot.current = { roomId: activeRoom?.id, firstId, lastId: last?.id, scrollHeight: vp.scrollHeight };
  }, [items, activeRoom?.id, me.id, scrollToBottom]);

  const handleScroll = () => {
    const vp = viewportRef.current;
    if (vp) nearBottom.current = vp.scrollHeight - vp.scrollTop - vp.clientHeight < NEAR_BOTTOM_PX;
  };

  // Imagens mudam a altura ao carregar; se o usuário estava no fim, continua no fim
  const handleMediaLoad = useCallback(() => {
    if (nearBottom.current) scrollToBottom();
  }, [scrollToBottom]);

  if (!activeMessages?.loaded) {
    return (
      <Center className="message-list message-list--center">
        <Loader />
      </Center>
    );
  }

  return (
    <ScrollArea
      className="message-list"
      viewportRef={viewportRef}
      onScrollPositionChange={handleScroll}
      scrollbars="y"
      type="auto"
    >
      <div className="message-list__inner">
        {activeMessages.hasMore && (
          <Center py="sm">
            <Button variant="subtle" size="xs" loading={activeMessages.loading} onClick={() => void loadOlder()}>
              Carregar mensagens anteriores
            </Button>
          </Center>
        )}

        {items.length === 0 && (
          <Stack className="message-list__empty" align="center" gap="xs">
            <ThemeIcon size={56} radius="xl" variant="light">
              <IconMessageCircle size={30} />
            </ThemeIcon>
            <Text fw={600}>Nenhuma mensagem em #{activeRoom?.name}</Text>
            <Text size="sm" c="dimmed">
              Seja o primeiro a dizer olá!
            </Text>
          </Stack>
        )}

        {items.map((message, index) => {
          const prev = items[index - 1];
          const newDay = !prev || !sameDay(prev.createdAt, message.createdAt);
          return (
            <Fragment key={message.id}>
              {newDay && (
                <Divider
                  className="message-list__day"
                  label={formatDay(message.createdAt)}
                  labelPosition="center"
                />
              )}
              <MessageItem
                message={message}
                compact={!newDay && isCompact(prev, message)}
                mine={message.author.id === me.id}
                onMediaLoad={handleMediaLoad}
              />
            </Fragment>
          );
        })}
      </div>
    </ScrollArea>
  );
}
