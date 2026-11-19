import { useState, type FormEvent } from 'react';
import { Button, Group, Modal, Stack, TextInput } from '@mantine/core';
import { createRoomSchema } from '@shared/schemas';
import { useChat } from '@/chat/ChatProvider';
import { errorMessage } from '@/lib/api';

interface Props {
  opened: boolean;
  onClose: () => void;
}

export function CreateRoomModal({ opened, onClose }: Props) {
  const { createRoom } = useChat();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const close = () => {
    setName('');
    setDescription('');
    setError(null);
    onClose();
  };

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const input = { name, description };
    const parsed = createRoomSchema.safeParse(input);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Dados inválidos');

    setSubmitting(true);
    try {
      await createRoom(input);
      close();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal opened={opened} onClose={close} title="Nova sala" centered>
      <form onSubmit={handleSubmit} noValidate>
        <Stack gap="sm">
          <TextInput
            label="Nome"
            placeholder="ex.: suporte"
            value={name}
            onChange={(e) => {
              setName(e.currentTarget.value);
              setError(null);
            }}
            error={error}
            required
            data-autofocus
          />
          <TextInput
            label="Descrição"
            placeholder="Opcional"
            value={description}
            onChange={(e) => setDescription(e.currentTarget.value)}
          />
          <Group justify="flex-end" mt="xs">
            <Button variant="default" onClick={close}>
              Cancelar
            </Button>
            <Button type="submit" loading={submitting}>
              Criar sala
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
