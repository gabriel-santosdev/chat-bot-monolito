import { ActionIcon, Avatar, Badge, Group, Indicator, NavLink, ScrollArea, Text, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconHash, IconPlus } from '@tabler/icons-react';
import { useCurrentUser } from '@/auth/AuthProvider';
import { useChat } from '@/chat/ChatProvider';
import { CreateRoomModal } from './CreateRoomModal';
import './Sidebar.scss';

interface Props {
  onNavigate?: () => void; // fecha o menu no celular ao escolher uma sala
}

export function Sidebar({ onNavigate }: Props) {
  const me = useCurrentUser();
  const { rooms, activeRoom, unread, users, onlineIds, selectRoom } = useChat();
  const [modalOpened, modal] = useDisclosure(false);

  // Online primeiro, depois em ordem alfabética
  const people = [...users].sort(
    (a, b) => Number(onlineIds.has(b.id)) - Number(onlineIds.has(a.id)) || a.displayName.localeCompare(b.displayName)
  );

  return (
    <div className="sidebar">
      <ScrollArea className="sidebar__scroll" scrollbars="y">
        <section className="sidebar__section">
          <Group className="sidebar__heading" justify="space-between">
            <Text size="xs" fw={700} c="dimmed" tt="uppercase">
              Salas
            </Text>
            <Tooltip label="Nova sala">
              <ActionIcon variant="subtle" size="sm" aria-label="Nova sala" onClick={modal.open}>
                <IconPlus size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>

          {rooms.map((room) => {
            const count = unread[room.id] ?? 0;
            return (
              <NavLink
                key={room.id}
                className="sidebar__room"
                label={room.name}
                description={room.description ?? undefined}
                leftSection={<IconHash size={16} />}
                rightSection={
                  count > 0 ? (
                    <Badge size="sm" circle={count < 10}>
                      {count > 99 ? '99+' : count}
                    </Badge>
                  ) : null
                }
                active={room.id === activeRoom?.id}
                fw={count > 0 ? 700 : undefined}
                onClick={() => {
                  selectRoom(room.id);
                  onNavigate?.();
                }}
              />
            );
          })}
        </section>

        <section className="sidebar__section">
          <Group className="sidebar__heading">
            <Text size="xs" fw={700} c="dimmed" tt="uppercase">
              Pessoas · {onlineIds.size} online
            </Text>
          </Group>

          {people.map((user) => {
            const online = onlineIds.has(user.id);
            return (
              <Group
                key={user.id}
                className={`sidebar__person${online ? '' : ' sidebar__person--offline'}`}
                gap="sm"
                wrap="nowrap"
              >
                <Indicator color={online ? 'teal' : 'gray'} size={9} offset={4} position="bottom-end" withBorder>
                  <Avatar name={user.displayName} color="initials" size="sm" />
                </Indicator>
                <Text size="sm" className="sidebar__person-name">
                  {user.displayName}
                  {user.id === me.id && (
                    <Text span c="dimmed" size="xs">
                      {' '}
                      (você)
                    </Text>
                  )}
                </Text>
              </Group>
            );
          })}
        </section>
      </ScrollArea>

      <CreateRoomModal opened={modalOpened} onClose={modal.close} />
    </div>
  );
}
