// Popula o banco com dados de desenvolvimento: usuários, salas, conversas e anexos.
//
//   npm run seed                      -> adiciona os dados (aborta se a seed já foi aplicada)
//   npm run seed -- --reset           -> apaga TUDO (banco e uploads) e recria
//   npm run seed -- --messages 1500   -> quantidade aproximada de mensagens (padrão: 600)
//   npm run seed -- --days 60         -> período coberto pelas conversas (padrão: 30 dias)
//   npm run seed -- --seed 42         -> semente do gerador (mesma semente = mesmos dados)
//
// Todos os usuários criados usam a senha SEED_PASSWORD (abaixo).
import { config } from '../config/env.js'; // precisa ser o primeiro import (carrega o .env)
import { randomUUID } from 'node:crypto';
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { crc32, deflateSync } from 'node:zlib';
import { hashPassword } from '../lib/auth.js';
import { db, transaction } from './index.js';

export const SEED_PASSWORD = 'senha123';

// ---------- Argumentos ----------

const { values: args } = parseArgs({
  options: {
    reset: { type: 'boolean', default: false },
    force: { type: 'boolean', default: false },
    messages: { type: 'string', default: '600' },
    days: { type: 'string', default: '30' },
    seed: { type: 'string', default: '2026' },
  },
});

const TARGET_MESSAGES = Math.max(10, Number(args.messages) || 600);
const DAYS = Math.max(1, Number(args.days) || 30);

if (config.isProd && !args.force) {
  console.error('Seed bloqueada em produção. Use --force se tiver certeza.');
  process.exit(1);
}

// ---------- Gerador pseudoaleatório determinístico (mulberry32) ----------

let state = (Number(args.seed) || 2026) >>> 0;
function random(): number {
  state = (state + 0x6d2b79f5) >>> 0;
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const int = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));
const pick = <T>(list: readonly T[]): T => list[Math.floor(random() * list.length)]!;
const chance = (p: number) => random() < p;
function sample<T>(list: readonly T[], n: number): T[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy.slice(0, n);
}

// ---------- Dados base ----------

const USERS = [
  { username: 'ana.souza', displayName: 'Ana Souza' },
  { username: 'bruno.lima', displayName: 'Bruno Lima' },
  { username: 'carla.mendes', displayName: 'Carla Mendes' },
  { username: 'diego.alves', displayName: 'Diego Alves' },
  { username: 'elisa.rocha', displayName: 'Elisa Rocha' },
  { username: 'felipe.costa', displayName: 'Felipe Costa' },
  { username: 'gabi.nunes', displayName: 'Gabi Nunes' },
  { username: 'heitor.dias', displayName: 'Heitor Dias' },
  { username: 'isabela.martins', displayName: 'Isabela Martins' },
  { username: 'joao.pereira', displayName: 'João Pereira' },
  { username: 'larissa.gomes', displayName: 'Larissa Gomes' },
  { username: 'marcos.ribeiro', displayName: 'Marcos Ribeiro' },
] as const;

interface RoomSeed {
  name: string;
  description: string;
  weight: number; // participação relativa no total de mensagens
  threads: string[][]; // conversas roteirizadas: cada linha é uma fala, autores alternam
}

const ROOMS: RoomSeed[] = [
  {
    name: 'geral',
    description: 'Sala aberta para todos',
    weight: 3,
    threads: [
      ['Bom dia, pessoal! ☀️', 'Bom dia!', 'Bom dia! Café já tá pronto aí?', 'Acabei de passar, pode vir 😄'],
      [
        'Alguém vai no almoço de sexta?',
        'Eu vou! Onde vai ser?',
        'Pensamos naquele italiano perto do escritório',
        'Fechado, conta comigo',
        'Vou tentar, tenho reunião até 12h30',
      ],
      [
        'Lembrete: amanhã a internet do prédio vai ficar fora das 8h às 9h',
        'Valeu pelo aviso!',
        'Vou trabalhar de casa então 😅',
      ],
      [
        'Parabéns, {nome}! 🎉🎂',
        'Parabéns!! Muitas felicidades',
        'Feliz aniversário! 🥳',
        'Obrigado(a), gente! ❤️',
      ],
      [
        'Alguém tem indicação de série pra maratonar?',
        'Dark, se ainda não viu',
        'The Bear é muito boa também',
        'Anotei as duas, valeu!',
      ],
    ],
  },
  {
    name: 'dev',
    description: 'Discussões técnicas, deploys e code review',
    weight: 4,
    threads: [
      [
        'Subi o PR da paginação das mensagens, quem puder revisar 🙏',
        'Vejo depois do almoço',
        'Deixei dois comentários, mas no geral tá ótimo',
        'Ajustei, pode dar uma olhada de novo?',
        'Aprovado ✅',
      ],
      [
        'O build da main quebrou depois do último merge',
        'Foi o typecheck do client, faltou atualizar um tipo em shared/types.ts',
        'Já mandei o fix',
        'Voltou a passar, obrigado!',
      ],
      [
        'Vocês preferem Zod ou Valibot pra validação?',
        'Zod, principalmente porque já compartilhamos os schemas com o front',
        'Valibot é menor no bundle, mas a migração não compensa agora',
        'Concordo, fica Zod',
      ],
      [
        'Deploy em produção agendado pras 18h',
        'Tem migração de banco?',
        'Tem uma, só adiciona índice',
        'Ok, vou acompanhar os logs',
        'Deploy concluído sem erros 🚀',
      ],
      [
        'Como vocês estão debugando o Socket.IO localmente?',
        'Uso DEBUG=socket.io* no terminal',
        'A aba Network do Chrome mostra os frames do WebSocket também',
        'Boa, não sabia dessa',
      ],
      [
        'Achei um vazamento de memória no listener de typing',
        'Era o setTimeout que não era limpo no unmount?',
        'Exatamente',
        'Clássico 😂',
      ],
    ],
  },
  {
    name: 'design',
    description: 'Interface, protótipos e identidade visual',
    weight: 2,
    threads: [
      [
        'Subi a nova versão do layout da sidebar',
        'Ficou bem mais limpa!',
        'Só acho que o contraste do texto secundário no tema escuro tá baixo',
        'Boa, vou ajustar pra passar no WCAG AA',
      ],
      [
        'Qual fonte vamos usar nos títulos?',
        'Inter continua sendo a mais segura',
        'Testei com Manrope e ficou interessante',
        'Manda um print das duas lado a lado?',
      ],
      [
        'Os ícones novos estão no Figma',
        'Vamos manter o Tabler no código ou exportar os nossos?',
        'Tabler por enquanto, só trocamos os que não existem lá',
      ],
    ],
  },
  {
    name: 'suporte',
    description: 'Dúvidas e problemas reportados pelos usuários',
    weight: 2,
    threads: [
      [
        'Cliente relatando que o upload de PDF falha acima de 10 MB',
        'É o limite configurado em MAX_UPLOAD_MB',
        'Vamos aumentar ou orientar o cliente?',
        'Por enquanto orienta a compactar, discutimos o limite na planning',
      ],
      [
        'Usuário não consegue fazer login depois de trocar de navegador',
        'Ele está usando o usuário em minúsculas?',
        'O login já normaliza, deve ser senha mesmo',
        'Confirmado, era senha. Resolvido ✅',
      ],
      [
        'As mensagens às vezes chegam duplicadas no mobile',
        'Consegue o horário aproximado? Vou olhar os logs',
        'Por volta das 14h20',
        'Achei: reconexão do socket reenviando. Abrindo issue',
      ],
    ],
  },
  {
    name: 'random',
    description: 'Assuntos aleatórios, memes e afins',
    weight: 2,
    threads: [
      ['Olha esse gato 🐈', 'KKKKKK', 'Ele tá julgando a gente', 'Melhor coisa do dia'],
      [
        'Qual o melhor café da região?',
        'A padaria da esquina é imbatível',
        'Discordo, o café do shopping é melhor',
        'Polêmica ☕🔥',
      ],
      [
        'Quem vai assistir o jogo hoje?',
        'Eu! Vai ser no telão do bar?',
        'Vai sim, a partir das 21h',
        'Tô dentro ⚽',
      ],
    ],
  },
  {
    name: 'anuncios',
    description: 'Comunicados oficiais da equipe',
    weight: 1,
    threads: [
      [
        '📢 Na próxima segunda teremos o all-hands às 10h. Presença importante!',
        'Vai ter gravação pra quem não puder?',
        'Sim, o link sai no mesmo dia',
      ],
      [
        '📢 Nova política de férias publicada na wiki. Leiam com atenção.',
        'Mudou o prazo pra solicitar?',
        'Agora são 30 dias de antecedência',
      ],
      ['📢 Bem-vindos aos novos integrantes do time! 👋', 'Sejam bem-vindos!', 'Bem-vindos! Qualquer coisa, chama aqui'],
    ],
  },
];

// Respostas curtas para preencher as conversas entre os roteiros
const FILLER = [
  'Show!',
  'Boa!',
  'Perfeito 👍',
  'Concordo',
  'Faz sentido',
  'Vou ver e te falo',
  'Obrigado!',
  'Valeu!',
  'Haha 😂',
  'Pode deixar',
  'Alguém sabe se isso já foi resolvido?',
  'Acho que sim, mas vou confirmar',
  'Me chama no privado depois?',
  'Combinado',
  'Daqui a pouco eu vejo',
  'Fechou ✅',
  'Interessante, não tinha pensado nisso',
  'Top demais',
  '+1',
  'Exato!',
];

const FILE_CAPTIONS = ['Segue o arquivo', 'Dá uma olhada nisso', 'Print do que comentei', 'Aqui está', ''];

// ---------- Geração de anexos (PNG gerado em memória, sem dependências) ----------

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData) >>> 0);
  return Buffer.concat([len, typeAndData, crc]);
}

// Imagem RGB com gradiente diagonal entre duas cores
function makeGradientPng(width: number, height: number, from: number[], to: number[]): Buffer {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 3 + 1);
    raw[row] = 0; // filtro "none"
    for (let x = 0; x < width; x++) {
      const t = (x / width + y / height) / 2;
      for (let c = 0; c < 3; c++) {
        raw[row + 1 + x * 3 + c] = Math.round(from[c]! + (to[c]! - from[c]!) * t);
      }
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // profundidade de bits
  ihdr.writeUInt8(2, 9); // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

const PALETTE = [
  [99, 102, 241],
  [236, 72, 153],
  [34, 197, 94],
  [249, 115, 22],
  [14, 165, 233],
  [168, 85, 247],
];

interface GeneratedFile {
  originalName: string;
  mimeType: string;
  content: Buffer;
}

function makeAttachmentFile(): GeneratedFile {
  const kind = pick(['image', 'image', 'image', 'csv', 'txt'] as const);
  if (kind === 'image') {
    const [from, to] = sample(PALETTE, 2);
    return {
      originalName: `${pick(['print', 'captura', 'mockup', 'foto', 'tela'])}-${int(1, 999)}.png`,
      mimeType: 'image/png',
      content: makeGradientPng(int(240, 640), int(160, 420), from!, to!),
    };
  }
  if (kind === 'csv') {
    const rows = ['data;usuarios_ativos;mensagens'];
    for (let i = 1; i <= 15; i++) rows.push(`2026-10-${String(i).padStart(2, '0')};${int(20, 90)};${int(200, 2000)}`);
    return { originalName: 'relatorio-uso.csv', mimeType: 'text/csv', content: Buffer.from(rows.join('\n'), 'utf8') };
  }
  return {
    originalName: pick(['anotacoes-reuniao.txt', 'checklist-deploy.txt', 'ideias.txt']),
    mimeType: 'text/plain',
    content: Buffer.from(
      ['Pontos discutidos:', '- revisar paginação', '- ajustar tema escuro', '- testar upload no mobile'].join('\n'),
      'utf8'
    ),
  };
}

// ---------- Linha do tempo ----------

// Horário "realista": maioria em horário comercial, poucas mensagens à noite/fim de semana
function randomMoment(start: number, end: number): number {
  for (;;) {
    const t = start + random() * (end - start);
    const d = new Date(t);
    const hour = d.getHours();
    const weekend = d.getDay() === 0 || d.getDay() === 6;
    const p = hour >= 9 && hour < 19 ? 1 : hour >= 7 && hour < 23 ? 0.25 : 0.03;
    if (random() < (weekend ? p * 0.3 : p)) return t;
  }
}

interface PlannedMessage {
  at: number;
  roomName: string;
  username: string;
  content: string;
  file: GeneratedFile | null;
}

function planMessages(): PlannedMessage[] {
  const end = Date.now() - 5 * 60_000;
  const start = end - DAYS * 24 * 60 * 60_000;
  const totalWeight = ROOMS.reduce((s, r) => s + r.weight, 0);
  const planned: PlannedMessage[] = [];

  for (const room of ROOMS) {
    const budget = Math.round((TARGET_MESSAGES * room.weight) / totalWeight);
    const members = sample(USERS, int(Math.min(5, USERS.length), USERS.length));
    let count = 0;

    while (count < budget) {
      // Uma "rodada" de conversa: começa num momento e segue com respostas em sequência
      let at = randomMoment(start, end);
      const participants = sample(members, int(2, Math.min(5, members.length)));
      const scripted = chance(0.6);
      const lines: string[] = scripted
        ? [...pick(room.threads)]
        : Array.from({ length: int(2, 6) }, () => pick(FILLER));

      let speaker = 0;
      for (const line of lines) {
        if (count >= budget) break;
        const author = participants[speaker % participants.length]!;
        // Nos roteiros os autores sempre alternam; no papo solto às vezes a mesma pessoa manda duas seguidas
        if (scripted || chance(0.7)) speaker++;

        const other = pick(USERS.filter((u) => u.username !== author.username)).displayName.split(' ')[0]!;
        const withFile = chance(0.06);
        planned.push({
          at,
          roomName: room.name,
          username: author.username,
          content: withFile ? pick(FILE_CAPTIONS) : line.replace('{nome}', other),
          file: withFile ? makeAttachmentFile() : null,
        });
        count++;
        at = Math.min(end, at + int(10, 600) * 1000); // próxima resposta entre 10s e 10min depois
      }
    }
  }

  // Ids crescentes precisam acompanhar a ordem cronológica (a paginação usa o id)
  return planned.sort((a, b) => a.at - b.at);
}

// ---------- Execução ----------

function resetAll() {
  transaction(() => {
    db.exec('DELETE FROM attachments; DELETE FROM messages; DELETE FROM rooms; DELETE FROM users;');
  });
  mkdirSync(config.uploadDir, { recursive: true });
  for (const name of readdirSync(config.uploadDir)) {
    if (!name.startsWith('.')) rmSync(join(config.uploadDir, name), { force: true });
  }
  console.log('[seed] banco e uploads limpos');
}

// Arquivos gravados em uploads/, para remover se a transação falhar
const writtenFiles: string[] = [];

async function main() {
  if (args.reset) {
    resetAll();
  } else {
    const exists = db.prepare('SELECT 1 FROM users WHERE username = ?').get(USERS[0].username);
    if (exists) {
      console.error('[seed] a seed já foi aplicada. Use "npm run seed -- --reset" para recriar do zero.');
      process.exit(1);
    }
  }

  const passwordHash = await hashPassword(SEED_PASSWORD);
  const plan = planMessages();
  mkdirSync(config.uploadDir, { recursive: true });

  const iso = (ms: number) => new Date(ms).toISOString();
  const firstAt = plan[0]?.at ?? Date.now();

  const stats = transaction(() => {
    const insertUser = db.prepare(
      'INSERT INTO users (username, display_name, password_hash, created_at) VALUES (?, ?, ?, ?) RETURNING id'
    );
    const userIds = new Map<string, number>();
    for (const u of USERS) {
      const createdAt = iso(firstAt - int(1, 60) * 24 * 60 * 60_000);
      const { id } = insertUser.get(u.username, u.displayName, passwordHash, createdAt) as { id: number };
      userIds.set(u.username, id);
    }

    const findRoom = db.prepare('SELECT id FROM rooms WHERE name = ?');
    const insertRoom = db.prepare(
      'INSERT INTO rooms (name, description, created_by, created_at) VALUES (?, ?, ?, ?) RETURNING id'
    );
    const roomIds = new Map<string, number>();
    for (const r of ROOMS) {
      const existing = findRoom.get(r.name) as { id: number } | undefined;
      const id =
        existing?.id ??
        (insertRoom.get(r.name, r.description, userIds.get(pick(USERS).username)!, iso(firstAt - 60_000)) as { id: number })
          .id;
      roomIds.set(r.name, id);
    }

    const insertMessage = db.prepare(
      'INSERT INTO messages (room_id, user_id, content, created_at) VALUES (?, ?, ?, ?) RETURNING id'
    );
    const insertAttachment = db.prepare(
      `INSERT INTO attachments (uploader_id, message_id, stored_name, original_name, mime_type, size, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );

    let files = 0;
    for (const m of plan) {
      const userId = userIds.get(m.username)!;
      const createdAt = iso(m.at);
      const { id } = insertMessage.get(roomIds.get(m.roomName)!, userId, m.content, createdAt) as { id: number };

      if (m.file) {
        const ext = m.file.originalName.slice(m.file.originalName.lastIndexOf('.'));
        const storedName = `${randomUUID()}${ext}`;
        const path = join(config.uploadDir, storedName);
        writeFileSync(path, m.file.content);
        writtenFiles.push(path);
        insertAttachment.run(userId, id, storedName, m.file.originalName, m.file.mimeType, m.file.content.length, createdAt);
        files++;
      }
    }

    return { users: userIds.size, rooms: roomIds.size, messages: plan.length, files };
  });

  console.log(
    `[seed] ${stats.users} usuários, ${stats.rooms} salas, ${stats.messages} mensagens, ${stats.files} anexos (${DAYS} dias)`
  );
  console.log(`[seed] login: qualquer usuário (ex.: ${USERS[0].username}) com a senha "${SEED_PASSWORD}"`);
}

try {
  await main();
} catch (err) {
  // A transação já foi desfeita; remove os arquivos que chegaram a ser gravados
  for (const path of writtenFiles) rmSync(path, { force: true });
  console.error('[seed] falhou:', err);
  process.exitCode = 1;
} finally {
  db.close();
}
