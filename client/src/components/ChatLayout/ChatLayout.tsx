import { AppShell, Avatar, Badge, Burger, Group, Menu, Text, Title, UnstyledButton } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconChevronDown, IconHash, IconLogout, IconMessages } from '@tabler/icons-react';
import { useAuth, useCurrentUser } from '@/auth/AuthProvider';
import { useChat, type ConnectionStatus } from '@/chat/ChatProvider';
import { ColorSchemeToggle } from '@/components/ColorSchemeToggle/ColorSchemeToggle';
import { Composer } from '@/components/Composer/Composer';
import { MessageList } from '@/components/MessageList/MessageList';
import { Sidebar } from '@/components/Sidebar/Sidebar';
import './ChatLayout.scss';

const CONNECTION: Record<ConnectionStatus, { label: string; color: string }> = {
  connecting: { label: 'conectando…', color: 'gray' },
  online: { label: 'online', color: 'teal' },
  offline: { label: 'sem conexão', color: 'red' },
};

export function ChatLayout() {
  const { logout } = useAuth();
  const me = useCurrentUser();
  const { activeRoom, connection } = useChat();
  const [navOpened, nav] = useDisclosure(false);

  return (
    <AppShell
      className="chat-layout"
      header={{ height: 60 }}
      navbar={{ width: 300, breakpoint: 'sm', collapsed: { mobile: !navOpened } }}
      padding={0}
    >
      <AppShell.Header className="chat-layout__header">
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap" className="chat-layout__brand">
            <Burger opened={navOpened} onClick={nav.toggle} hiddenFrom="sm" size="sm" aria-label="Abrir menu" />
            <IconMessages className="chat-layout__logo" size={28} stroke={1.6} />
            <Title order={4} visibleFrom="xs">
              Chat Monolito
            </Title>
            <Badge color={CONNECTION[connection].color} variant="dot" visibleFrom="xs">
              {CONNECTION[connection].label}
            </Badge>
          </Group>

          <Group gap="sm" wrap="nowrap">
            <ColorSchemeToggle />
            <Menu position="bottom-end" width={200}>
              <Menu.Target>
                <UnstyledButton className="chat-layout__user" aria-label="Menu do usuário">
                  <Group gap="xs" wrap="nowrap">
                    <Avatar name={me.displayName} color="initials" size="sm" />
                    <Text size="sm" fw={500} visibleFrom="sm" className="chat-layout__user-name">
                      {me.displayName}
                    </Text>
                    <IconChevronDown size={14} />
                  </Group>
                </UnstyledButton>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>@{me.username}</Menu.Label>
                <Menu.Item color="red" leftSection={<IconLogout size={16} />} onClick={logout}>
                  Sair
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar>
        <Sidebar onNavigate={nav.close} />
      </AppShell.Navbar>

      <AppShell.Main className="chat-layout__main">
        {activeRoom && (
          <header className="chat-layout__room">
            <Group gap={6} wrap="nowrap">
              <IconHash size={18} className="chat-layout__room-icon" />
              <Text fw={700}>{activeRoom.name}</Text>
            </Group>
            {activeRoom.description && (
              <Text size="sm" c="dimmed" className="chat-layout__room-description">
                {activeRoom.description}
              </Text>
            )}
          </header>
        )}
        <MessageList />
        <Composer />
      </AppShell.Main>
    </AppShell>
  );
}
