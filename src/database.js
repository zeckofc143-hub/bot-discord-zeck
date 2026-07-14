import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const { Pool } = pg;

const dataDir = path.resolve('data');
const dbFile = path.join(dataDir, 'database.json');
const backupFile = path.join(dataDir, 'database.backup.json');
const tempFile = path.join(dataDir, 'database.tmp.json');

fs.mkdirSync(dataDir, { recursive: true });

const emptyDatabase = () => ({
  version: 6,
  guilds: {},
  users: {},
  warnings: {},
  suggestions: {},
  tickets: {},
  audit: {},
});

export let db = emptyDatabase();

let postgresPool = null;
let persistenceQueue = Promise.resolve();

function normalizeDatabase(value) {
  const normalized = { ...emptyDatabase(), ...(value || {}) };
  normalized.guilds ??= {};
  normalized.users ??= {};
  normalized.warnings ??= {};
  normalized.suggestions ??= {};
  normalized.tickets ??= {};
  normalized.audit ??= {};
  normalized.version = 6;
  return normalized;
}

for (const candidate of [dbFile, backupFile]) {
  if (!fs.existsSync(candidate)) continue;
  try {
    db = normalizeDatabase(JSON.parse(fs.readFileSync(candidate, 'utf8')));
    break;
  } catch (error) {
    console.warn(`Banco inválido em ${candidate}: ${error.message}`);
  }
}

function databaseSeed() {
  if (!process.env.DATABASE_SEED_BASE64) return db;
  try {
    const decoded = Buffer.from(process.env.DATABASE_SEED_BASE64, 'base64').toString('utf8');
    return normalizeDatabase(JSON.parse(decoded));
  } catch (error) {
    throw new Error(`DATABASE_SEED_BASE64 inválido: ${error.message}`);
  }
}

function postgresOptions() {
  const connectionString = process.env.DATABASE_URL;
  const requiresSsl = process.env.DATABASE_SSL === 'true' || /sslmode=(require|verify-ca|verify-full)/i.test(connectionString || '');
  return {
    connectionString,
    max: 2,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ...(requiresSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  };
}

async function persistPostgres(serialized) {
  if (!postgresPool) return;
  await postgresPool.query(
    `INSERT INTO bot_state (id, payload, updated_at)
     VALUES (1, $1::jsonb, NOW())
     ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()`,
    [serialized],
  );
}

export async function initializeDatabase() {
  if (!process.env.DATABASE_URL) {
    console.log('[DATABASE] Usando armazenamento local em data/database.json.');
    return { adapter: 'file' };
  }

  postgresPool = new Pool(postgresOptions());
  postgresPool.on('error', error => console.error('[DATABASE] Erro inesperado no PostgreSQL:', error.message));
  await postgresPool.query(`
    CREATE TABLE IF NOT EXISTS bot_state (
      id SMALLINT PRIMARY KEY CHECK (id = 1),
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const result = await postgresPool.query('SELECT payload FROM bot_state WHERE id = 1');
  if (result.rowCount) {
    db = normalizeDatabase(result.rows[0].payload);
    console.log('[DATABASE] Dados carregados do PostgreSQL.');
  } else {
    db = databaseSeed();
    await persistPostgres(JSON.stringify(db));
    console.log('[DATABASE] PostgreSQL iniciado com os dados existentes.');
  }
  return { adapter: 'postgresql' };
}

export function save() {
  const serialized = JSON.stringify(db, null, 2);
  try {
    fs.writeFileSync(tempFile, serialized);
    if (fs.existsSync(dbFile)) fs.copyFileSync(dbFile, backupFile);
    fs.renameSync(tempFile, dbFile);
  } catch (error) {
    console.warn(`[DATABASE] Não foi possível atualizar a cópia local: ${error.message}`);
  }

  if (postgresPool) {
    persistenceQueue = persistenceQueue
      .then(() => persistPostgres(serialized))
      .catch(error => console.error('[DATABASE] Falha ao salvar no PostgreSQL:', error.message));
  }
  return persistenceQueue;
}

export async function closeDatabase() {
  await persistenceQueue;
  if (postgresPool) {
    const pool = postgresPool;
    postgresPool = null;
    await pool.end();
  }
}

export function guildData(id) {
  const defaults = {
    logsChannelId: null,
    ticketCategoryId: null,
    supportRoleId: null,
    ticketPanelChannelId: null,
    ticketReviewChannelId: null,
    welcomeChannelId: null,
    leaveChannelId: null,
    autoRoleId: null,
    suggestionsChannelId: null,
    antiLink: false,
    antiSpam: false,
    spamLimit: 6,
    spamWindowSeconds: 8,
    spamMuteDuration: 5,
    allowedLinkDomains: [],
    ticketCounter: 0,
    caseCounter: 0,
    ticketPanelTitle: 'CENTRAL DE ATENDIMENTO',
    ticketPanelDescription: 'Selecione abaixo o setor que melhor corresponde à sua solicitação. Nossa equipe responderá assim que possível.',
    ticketPanelColor: '#5865F2',
    ticketPanelBanner: null,
    ticketPanelThumbnail: null,
    maxOpenTickets: 3,
    dashboardAccent: '#6C63FF',
    ticketPanelMenuPlaceholder: '📨 Selecione o setor do atendimento',
    ticketPanelSectorsTitle: 'Setores disponíveis',
    ticketPanelHowTitle: 'Como funciona?',
    ticketPanelHowText: 'Escolha um setor, preencha o formulário e aguarde em seu canal privado.',
    ticketPanelFooter: null,
    ticketTypes: null,
    antiSwear: false,
    swearWords: [],
    swearAction: 'timeout',
    swearWarnCount: 3,
    swearMuteDuration: 30,
    swearWarnWindowHours: 24,
    swearNotice: 'Sua mensagem foi removida por conter conteúdo bloqueado.',
    swearExemptChannelIds: [],
    swearExemptRoleIds: [],
  };
  db.guilds[id] = { ...defaults, ...(db.guilds[id] || {}) };
  return db.guilds[id];
}

export function userData(guildId, userId) {
  const key = `${guildId}:${userId}`;
  const defaults = { wallet: 0, bank: 0, dailyAt: 0, workAt: 0, inventory: [], xp: 0, level: 1 };
  db.users[key] = { ...defaults, ...(db.users[key] || {}) };
  return db.users[key];
}

export function warningsFor(guildId, userId) {
  const key = `${guildId}:${userId}`;
  db.warnings[key] ??= [];
  return db.warnings[key];
}

export function auditFor(guildId) {
  db.audit[guildId] ??= [];
  return db.audit[guildId];
}

export function recordAudit(guildId, entry, persist = true) {
  const audit = auditFor(guildId);
  audit.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: entry.type || 'system',
    title: String(entry.title || 'Evento'),
    description: String(entry.description || '').slice(0, 4000),
    actorId: entry.actorId || null,
    createdAt: entry.createdAt || Date.now(),
  });
  if (audit.length > 600) audit.splice(0, audit.length - 600);
  if (persist) save();
  return audit.at(-1);
}

export function nextCase(guildId) {
  const guild = guildData(guildId);
  guild.caseCounter += 1;
  return guild.caseCounter;
}

export function deleteGuild(guildId) {
  delete db.guilds[guildId];
  delete db.audit[guildId];
  for (const section of ['users', 'warnings']) {
    for (const key of Object.keys(db[section])) {
      if (key.startsWith(`${guildId}:`)) delete db[section][key];
    }
  }
  for (const [messageId, suggestion] of Object.entries(db.suggestions)) {
    if (suggestion.guildId === guildId) delete db.suggestions[messageId];
  }
  for (const [ticketId, ticket] of Object.entries(db.tickets)) {
    if (ticket.guildId === guildId) delete db.tickets[ticketId];
  }
  save();
}
