import { sendMessageSchema } from '../../shared/schemas.js';
import type { Message, User } from '../../shared/types.js';
import { transaction } from '../db/index.js';
import { attachments, messages, rooms } from '../db/repositories.js';
import { AppError, parse } from '../lib/errors.js';

// Valida e grava uma mensagem (com anexo opcional). Retorna a mensagem completa.
export function createMessage(author: User, input: unknown): Message {
  const { roomId, content, attachmentId } = parse(sendMessageSchema, input);

  if (!rooms.findById(roomId)) throw new AppError(404, 'Sala não encontrada');

  if (attachmentId !== undefined) {
    const attachment = attachments.findRawById(attachmentId);
    if (!attachment || attachment.uploader_id !== author.id) throw new AppError(404, 'Anexo não encontrado');
    if (attachment.message_id !== null) throw new AppError(409, 'Anexo já foi enviado');
  }

  const id = transaction(() => {
    const messageId = messages.insert(roomId, author.id, content);
    if (attachmentId !== undefined && !attachments.linkToMessage(attachmentId, messageId)) {
      throw new AppError(409, 'Anexo já foi enviado');
    }
    return messageId;
  });

  return messages.findById(id)!;
}
