import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ActionIcon, CloseButton, FileButton, Group, Loader, Paper, Text, Textarea, Tooltip } from '@mantine/core';
import { Dropzone } from '@mantine/dropzone';
import { notifications } from '@mantine/notifications';
import { IconFile, IconPaperclip, IconSend2, IconUpload } from '@tabler/icons-react';
import { MAX_MESSAGE_LENGTH } from '@shared/schemas';
import type { Attachment } from '@shared/types';
import { useChat } from '@/chat/ChatProvider';
import { api, errorMessage } from '@/lib/api';
import { formatBytes } from '@/lib/format';
import './Composer.scss';

const TYPING_THROTTLE_MS = 3000; // reenvia "digitando" no máximo a cada 3 s
const TYPING_IDLE_MS = 2500; // sem digitar por 2,5 s = parou de digitar

export function Composer() {
  const { activeRoom, connection, typingInActive, sendMessage, setTyping } = useChat();
  const [content, setContent] = useState('');
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const lastTypingSent = useRef(0);
  const idleTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const stopTyping = () => {
    clearTimeout(idleTimer.current);
    if (lastTypingSent.current) {
      lastTypingSent.current = 0;
      setTyping(false);
    }
  };

  // Ao trocar de sala: limpa o rascunho e avisa que parou de digitar na sala anterior
  useEffect(() => {
    setContent('');
    setAttachment(null);
    textareaRef.current?.focus();
    return stopTyping; // roda com o setTyping da sala anterior
  }, [activeRoom?.id]); // eslint-disable-line react-hooks/exhaustive-deps -- só ao trocar de sala

  const handleChange = (value: string) => {
    setContent(value);
    if (!value.trim()) return stopTyping();

    const now = Date.now();
    if (now - lastTypingSent.current > TYPING_THROTTLE_MS) {
      lastTypingSent.current = now;
      setTyping(true);
    }
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(stopTyping, TYPING_IDLE_MS);
  };

  async function upload(file: File | null) {
    if (!file) return;
    setUploading(true);
    try {
      const body = new FormData();
      body.append('file', file);
      setAttachment(await api<Attachment>('/uploads', { method: 'POST', body }));
      textareaRef.current?.focus();
    } catch (err) {
      notifications.show({ color: 'red', title: 'Falha no envio do arquivo', message: errorMessage(err) });
    } finally {
      setUploading(false);
    }
  }

  const canSend = !sending && !uploading && connection === 'online' && (!!content.trim() || !!attachment);

  async function submit() {
    if (!canSend) return;
    setSending(true);
    try {
      await sendMessage(content.trim(), attachment?.id);
      setContent('');
      setAttachment(null);
      lastTypingSent.current = 0; // o servidor já avisa que parou de digitar ao receber a mensagem
      clearTimeout(idleTimer.current);
    } catch (err) {
      notifications.show({ color: 'red', title: 'Mensagem não enviada', message: (err as Error).message });
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter envia; Shift+Enter quebra linha (e não envia durante composição de acentos/IME)
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void submit();
    }
  };

  const typingText =
    typingInActive.length === 0
      ? ''
      : typingInActive.length === 1
        ? `${typingInActive[0]!.displayName} está digitando…`
        : typingInActive.length === 2
          ? `${typingInActive[0]!.displayName} e ${typingInActive[1]!.displayName} estão digitando…`
          : 'Várias pessoas estão digitando…';

  if (!activeRoom) return null;

  return (
    <div className="composer">
      {/* Solte um arquivo em qualquer lugar da tela para anexar */}
      <Dropzone.FullScreen
        active={!uploading && !attachment}
        multiple={false}
        onDrop={(files) => void upload(files[0] ?? null)}
      >
        <Group className="composer__drop" justify="center" gap="md">
          <IconUpload size={48} stroke={1.4} />
          <Text size="xl">Solte o arquivo para anexar em #{activeRoom.name}</Text>
        </Group>
      </Dropzone.FullScreen>

      {(uploading || attachment) && (
        <Paper className="composer__attachment" withBorder p="xs" radius="md">
          <Group gap="sm" wrap="nowrap">
            {uploading ? <Loader size="sm" /> : <IconFile size={22} stroke={1.5} />}
            <div className="composer__attachment-info">
              <Text size="sm" fw={500} className="composer__attachment-name">
                {attachment ? attachment.originalName : 'Enviando arquivo…'}
              </Text>
              {attachment && (
                <Text size="xs" c="dimmed">
                  {formatBytes(attachment.size)}
                </Text>
              )}
            </div>
            {attachment && <CloseButton aria-label="Remover anexo" onClick={() => setAttachment(null)} />}
          </Group>
        </Paper>
      )}

      <div className="composer__box">
        <FileButton onChange={(file) => void upload(file)} disabled={uploading || !!attachment}>
          {(props) => (
            <Tooltip label="Anexar arquivo">
              <ActionIcon
                {...props}
                variant="subtle"
                size="lg"
                aria-label="Anexar arquivo"
                disabled={uploading || !!attachment}
              >
                <IconPaperclip size={20} />
              </ActionIcon>
            </Tooltip>
          )}
        </FileButton>

        <Textarea
          ref={textareaRef}
          className="composer__input"
          variant="unstyled"
          placeholder={`Mensagem em #${activeRoom.name}`}
          autosize
          minRows={1}
          maxRows={6}
          maxLength={MAX_MESSAGE_LENGTH}
          value={content}
          onChange={(e) => handleChange(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          aria-label="Mensagem"
        />

        <Tooltip label="Enviar (Enter)">
          <ActionIcon size="lg" aria-label="Enviar" onClick={() => void submit()} disabled={!canSend} loading={sending}>
            <IconSend2 size={18} />
          </ActionIcon>
        </Tooltip>
      </div>

      <Text className="composer__hint" size="xs" c="dimmed" aria-live="polite">
        {connection !== 'online' ? 'Reconectando ao servidor…' : typingText || ' '}
      </Text>
    </div>
  );
}
