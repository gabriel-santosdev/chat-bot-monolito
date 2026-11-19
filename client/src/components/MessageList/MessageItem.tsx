import { memo } from 'react';
import { Anchor, Avatar, Group, Paper, Text, Tooltip } from '@mantine/core';
import { IconDownload, IconFile } from '@tabler/icons-react';
import type { Attachment, Message } from '@shared/types';
import { formatBytes, formatFull, formatTime } from '@/lib/format';

interface Props {
  message: Message;
  compact: boolean; // continuação de mensagens do mesmo autor: sem avatar/nome
  mine: boolean;
  onMediaLoad?: () => void;
}

// SVG pode conter scripts; só formatos de imagem "seguros" são exibidos inline
const INLINE_IMAGE = /^image\/(png|jpe?g|gif|webp|avif)$/;

function AttachmentView({ attachment, onMediaLoad }: { attachment: Attachment; onMediaLoad?: () => void }) {
  if (INLINE_IMAGE.test(attachment.mimeType)) {
    return (
      <a className="message__image-link" href={attachment.url} target="_blank" rel="noreferrer">
        <img
          className="message__image"
          src={attachment.url}
          alt={attachment.originalName}
          loading="lazy"
          onLoad={onMediaLoad}
        />
      </a>
    );
  }

  return (
    <Paper className="message__file" withBorder p="xs" radius="md">
      <Group gap="sm" wrap="nowrap">
        <IconFile size={28} stroke={1.4} className="message__file-icon" />
        <div className="message__file-info">
          <Text size="sm" fw={500} className="message__file-name">
            {attachment.originalName}
          </Text>
          <Text size="xs" c="dimmed">
            {formatBytes(attachment.size)}
          </Text>
        </div>
        <Anchor href={attachment.url} download={attachment.originalName} aria-label="Baixar arquivo">
          <IconDownload size={18} />
        </Anchor>
      </Group>
    </Paper>
  );
}

export const MessageItem = memo(function MessageItem({ message, compact, mine, onMediaLoad }: Props) {
  const time = (
    <Tooltip label={formatFull(message.createdAt)} openDelay={400}>
      <Text component="time" dateTime={message.createdAt} size="xs" c="dimmed" className="message__time">
        {formatTime(message.createdAt)}
      </Text>
    </Tooltip>
  );

  return (
    <div className={`message${compact ? ' message--compact' : ''}${mine ? ' message--mine' : ''}`}>
      <div className="message__gutter">
        {compact ? time : <Avatar name={message.author.displayName} color="initials" size="md" />}
      </div>

      <div className="message__body">
        {!compact && (
          <Group gap="xs" className="message__header">
            <Text fw={600} size="sm">
              {message.author.displayName}
            </Text>
            {time}
          </Group>
        )}
        {message.content && <Text className="message__content">{message.content}</Text>}
        {message.attachment && <AttachmentView attachment={message.attachment} onMediaLoad={onMediaLoad} />}
      </div>
    </div>
  );
});
