import type { Attachment, Message, Room, User } from '../../shared/types.js';
import { db } from './index.js';

interface UserRow {
  id: number;
  username: string;
  display_name: string;
  password_hash: string;
  created_at: string;
}

const toUser = (r: UserRow): User => ({
  id: r.id,
  username: r.username,
  displayName: r.display_name,
  createdAt: r.created_at,
});

const userStmts = {
  all: db.prepare('SELECT * FROM users ORDER BY display_name'),
  byId: db.prepare('SELECT * FROM users WHERE id = ?'),
  byUsername: db.prepare('SELECT * FROM users WHERE username = ?'),
  insert: db.prepare('INSERT INTO users (username, display_name, password_hash) VALUES (?, ?, ?) RETURNING *'),
};

export const users = {
  list(): User[] {
    return (userStmts.all.all() as unknown as UserRow[]).map(toUser);
  },

  findById(id: number): User | null {
    const row = userStmts.byId.get(id) as UserRow | undefined;
    return row ? toUser(row) : null;
  },

  findByUsernameWithHash(username: string): { user: User; passwordHash: string } | null {
    const row = userStmts.byUsername.get(username) as UserRow | undefined;
    return row ? { user: toUser(row), passwordHash: row.password_hash } : null;
  },

  create(username: string, displayName: string, passwordHash: string): User {
    return toUser(userStmts.insert.get(username, displayName, passwordHash) as unknown as UserRow);
  },
};

interface RoomRow {
  id: number;
  name: string;
  description: string | null;
  created_by: number | null;
  created_at: string;
}

const toRoom = (r: RoomRow): Room => ({
  id: r.id,
  name: r.name,
  description: r.description,
  createdBy: r.created_by,
  createdAt: r.created_at,
});

const roomStmts = {
  all: db.prepare('SELECT * FROM rooms ORDER BY id'),
  byId: db.prepare('SELECT * FROM rooms WHERE id = ?'),
  byName: db.prepare('SELECT * FROM rooms WHERE name = ?'),
  insert: db.prepare('INSERT INTO rooms (name, description, created_by) VALUES (?, ?, ?) RETURNING *'),
};

export const rooms = {
  list(): Room[] {
    return (roomStmts.all.all() as unknown as RoomRow[]).map(toRoom);
  },

  findById(id: number): Room | null {
    const row = roomStmts.byId.get(id) as RoomRow | undefined;
    return row ? toRoom(row) : null;
  },

  existsByName(name: string): boolean {
    return roomStmts.byName.get(name) !== undefined;
  },

  create(name: string, description: string | null, createdBy: number): Room {
    return toRoom(roomStmts.insert.get(name, description, createdBy) as unknown as RoomRow);
  },
};

interface AttachmentRow {
  id: number;
  uploader_id: number;
  message_id: number | null;
  stored_name: string;
  original_name: string;
  mime_type: string;
  size: number;
}

export const attachmentUrl = (storedName: string) => `/uploads/${storedName}`;

const toAttachment = (r: AttachmentRow): Attachment => ({
  id: r.id,
  url: attachmentUrl(r.stored_name),
  originalName: r.original_name,
  mimeType: r.mime_type,
  size: r.size,
});

const attachmentStmts = {
  byId: db.prepare('SELECT * FROM attachments WHERE id = ?'),
  insert: db.prepare(
    'INSERT INTO attachments (uploader_id, stored_name, original_name, mime_type, size) VALUES (?, ?, ?, ?, ?) RETURNING *'
  ),
  link: db.prepare('UPDATE attachments SET message_id = ? WHERE id = ? AND message_id IS NULL'),
};

export const attachments = {
  create(uploaderId: number, storedName: string, originalName: string, mimeType: string, size: number): Attachment {
    const row = attachmentStmts.insert.get(uploaderId, storedName, originalName, mimeType, size);
    return toAttachment(row as unknown as AttachmentRow);
  },

  findRawById(id: number) {
    return (attachmentStmts.byId.get(id) as AttachmentRow | undefined) ?? null;
  },

  linkToMessage(attachmentId: number, messageId: number): boolean {
    return Number(attachmentStmts.link.run(messageId, attachmentId).changes) === 1;
  },
};

interface MessageRow {
  id: number;
  room_id: number;
  content: string;
  created_at: string;
  u_id: number;
  u_username: string;
  u_display_name: string;
  u_created_at: string;
  a_id: number | null;
  a_stored_name: string | null;
  a_original_name: string | null;
  a_mime_type: string | null;
  a_size: number | null;
}

const MESSAGE_SELECT = `
  SELECT m.id, m.room_id, m.content, m.created_at,
         u.id AS u_id, u.username AS u_username, u.display_name AS u_display_name, u.created_at AS u_created_at,
         a.id AS a_id, a.stored_name AS a_stored_name, a.original_name AS a_original_name,
         a.mime_type AS a_mime_type, a.size AS a_size
  FROM messages m
  JOIN users u ON u.id = m.user_id
  LEFT JOIN attachments a ON a.message_id = m.id
`;

const toMessage = (r: MessageRow): Message => ({
  id: r.id,
  roomId: r.room_id,
  content: r.content,
  createdAt: r.created_at,
  author: { id: r.u_id, username: r.u_username, displayName: r.u_display_name, createdAt: r.u_created_at },
  attachment:
    r.a_id === null
      ? null
      : {
          id: r.a_id,
          url: attachmentUrl(r.a_stored_name!),
          originalName: r.a_original_name!,
          mimeType: r.a_mime_type!,
          size: r.a_size!,
        },
});

const messageStmts = {
  byId: db.prepare(`${MESSAGE_SELECT} WHERE m.id = ?`),
  page: db.prepare(`${MESSAGE_SELECT} WHERE m.room_id = ? AND m.id < ? ORDER BY m.id DESC LIMIT ?`),
  insert: db.prepare('INSERT INTO messages (room_id, user_id, content) VALUES (?, ?, ?) RETURNING id'),
};

export const messages = {
  findById(id: number): Message | null {
    const row = messageStmts.byId.get(id) as MessageRow | undefined;
    return row ? toMessage(row) : null;
  },

  // Paginação por cursor: mensagens com id menor que `beforeId`, da mais nova para a mais antiga
  page(roomId: number, beforeId: number, limit: number): { messages: Message[]; hasMore: boolean } {
    const rows = messageStmts.page.all(roomId, beforeId, limit + 1) as unknown as MessageRow[];
    const hasMore = rows.length > limit;
    return { messages: rows.slice(0, limit).reverse().map(toMessage), hasMore };
  },

  insert(roomId: number, userId: number, content: string): number {
    const { id } = messageStmts.insert.get(roomId, userId, content) as { id: number };
    return id;
  },
};
