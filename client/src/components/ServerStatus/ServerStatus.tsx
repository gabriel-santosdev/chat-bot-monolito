import { useEffect, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Card,
  Group,
  Stack,
  Text,
  Title,
  useComputedColorScheme,
  useMantineColorScheme,
} from '@mantine/core';
import { IconMessages, IconMoon, IconSun } from '@tabler/icons-react';
import type { HealthResponse } from '@shared/types';
import { api } from '@/lib/api';
import { socket } from '@/lib/socket';
import './ServerStatus.scss';

type Status = 'checking' | 'online' | 'offline';

const LABEL: Record<Status, string> = {
  checking: 'verificando…',
  online: 'online',
  offline: 'offline',
};

const COLOR: Record<Status, string> = {
  checking: 'gray',
  online: 'teal',
  offline: 'red',
};

// Tela provisória da fundação: confirma que API, WebSocket e tema estão funcionando.
export function ServerStatus() {
  const [apiStatus, setApiStatus] = useState<Status>('checking');
  const [wsStatus, setWsStatus] = useState<Status>(socket.connected ? 'online' : 'checking');
  const [env, setEnv] = useState<HealthResponse['env'] | null>(null);

  const { setColorScheme } = useMantineColorScheme();
  const scheme = useComputedColorScheme('light');

  useEffect(() => {
    api<HealthResponse>('/health')
      .then((data) => {
        setApiStatus('online');
        setEnv(data.env);
      })
      .catch(() => setApiStatus('offline'));

    const onConnect = () => setWsStatus('online');
    const onDisconnect = () => setWsStatus('offline');
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onDisconnect);
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onDisconnect);
    };
  }, []);

  const items: { label: string; status: Status }[] = [
    { label: 'API REST', status: apiStatus },
    { label: 'WebSocket (Socket.IO)', status: wsStatus },
  ];

  return (
    <main className="server-status">
      <Card className="server-status__card" shadow="md" padding="xl" withBorder>
        <Group justify="space-between" mb="lg">
          <Group gap="sm">
            <IconMessages className="server-status__logo" size={32} stroke={1.6} />
            <Title order={2} className="server-status__title">
              Chat Monolito
            </Title>
          </Group>
          <ActionIcon
            variant="default"
            size="lg"
            aria-label="Alternar tema claro/escuro"
            onClick={() => setColorScheme(scheme === 'dark' ? 'light' : 'dark')}
          >
            {scheme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
          </ActionIcon>
        </Group>

        <Stack gap="xs">
          {items.map((item) => (
            <Group key={item.label} className="server-status__item" justify="space-between">
              <Group gap="xs">
                <span className={`server-status__dot server-status__dot--${item.status}`} />
                <Text fw={500}>{item.label}</Text>
              </Group>
              <Badge color={COLOR[item.status]} variant="light">
                {LABEL[item.status]}
              </Badge>
            </Group>
          ))}
        </Stack>

        <Text className="server-status__footer" size="sm" c="dimmed" mt="lg">
          Ambiente: {env ?? '—'} · Fundação pronta: TypeScript, Mantine, SCSS (BEM) e Socket.IO.
        </Text>
      </Card>
    </main>
  );
}
