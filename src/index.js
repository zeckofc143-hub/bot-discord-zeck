import 'dotenv/config';
import fs from 'node:fs';
import express from 'express';
import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  MessageFlags,
  ModalBuilder,
  Partials,
  PermissionFlagsBits,
  RoleSelectMenuBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
} from 'discord.js';
import { auditFor, closeDatabase, db, deleteGuild, guildData, initializeDatabase, nextCase, recordAudit, save, userData, warningsFor } from './database.js';
import { installDashboard } from './dashboard.js';
import { detectBlockedTerm, findBlockedLink } from './moderation.js';

if (!process.env.DISCORD_TOKEN) {
  console.error('ERRO: DISCORD_TOKEN não foi definido. Copie .env.example para .env.');
  process.exit(1);
}

try {
  await initializeDatabase();
} catch (error) {
  console.error(`[DATABASE] Falha ao iniciar o armazenamento persistente: ${error.message}`);
  process.exit(1);
}

// ── Logger ────────────────────────────────────────────────────────────────────
const LOG_FILE = 'data/bot.log';
const MAX_LOG_BYTES = 2 * 1024 * 1024; // 2 MB
function writeLog(level, ...args) {
  const line = `[${new Date().toLocaleString('pt-BR')}] [${level}] ${args.map(a => (typeof a === 'object' ? JSON.stringify(a, null, 0) : String(a))).join(' ')}\n`;
  process.stdout.write(line);
  try {
    if (fs.existsSync(LOG_FILE) && fs.statSync(LOG_FILE).size > MAX_LOG_BYTES) fs.writeFileSync(LOG_FILE, line);
    else fs.appendFileSync(LOG_FILE, line);
  } catch { /* sem crash se o disco falhar */ }
}
const log = { info: (...a) => writeLog('INFO', ...a), warn: (...a) => writeLog('WARN', ...a), error: (...a) => writeLog('ERROR', ...a) };
// ─────────────────────────────────────────────────────────────────────────────


const COLORS = { primary: 0x5865f2, success: 0x57f287, danger: 0xed4245, warning: 0xfee75c };
const PRIVATE = MessageFlags.Ephemeral;
const shop = {
  vip: { name: 'Distintivo VIP', price: 2500 },
  caixa: { name: 'Caixa Misteriosa', price: 900 },
  trofeu: { name: 'Troféu Dourado', price: 5000 },
};
const TICKET_TYPES = {
  suporte: { label: 'Suporte geral', emoji: '🛠️', description: 'Dúvidas, problemas e ajuda com o servidor', priority: 'normal' },
  denuncia: { label: 'Denúncia', emoji: '🚨', description: 'Denuncie um membro ou uma situação', priority: 'alta' },
  parceria: { label: 'Parceria', emoji: '🤝', description: 'Propostas de parceria e divulgação', priority: 'normal' },
  compras: { label: 'Compras', emoji: '🛒', description: 'Pagamentos, produtos e atendimento comercial', priority: 'alta' },
  outros: { label: 'Outros assuntos', emoji: '📝', description: 'Solicitações que não se encaixam acima', priority: 'normal' },
};
const spamTracker = new Map();

function ticketTypesForGuild(guildId) {
  return guildData(guildId).ticketTypes || TICKET_TYPES;
}

function ticketSupportRoleId(config, type, record = null) {
  return record?.supportRoleId || type?.roleId || config.supportRoleId || null;
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.GuildMember],
});

function embed(title, description, color = COLORS.primary) {
  return new EmbedBuilder().setTitle(title).setDescription(description).setColor(color).setTimestamp();
}

async function sendLog(guild, title, description, color = COLORS.primary, files = []) {
  recordAudit(guild.id, { type: title.includes('🎫') || title.includes('🔒') ? 'ticket' : title.includes('🛡️') || title.includes('🚨') || title.includes('🔗') || title.includes('🧹') ? 'moderation' : title.includes('👋') || title.includes('📥') || title.includes('📤') ? 'community' : 'system', title, description }, false);
  save();
  const channel = guild.channels.cache.get(guildData(guild.id).logsChannelId);
  if (!channel?.isTextBased()) return false;
  await channel.send({ embeds: [embed(title, description, color)], files, allowedMentions: { parse: [] } }).catch(() => {});
  return true;
}

function formatTime(ms) {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.ceil((ms % 3_600_000) / 60_000);
  return h ? `${h}h ${m}min` : `${m}min`;
}

function isTicket(channel) {
  return channel?.type === ChannelType.GuildText
    && (channel.topic?.startsWith('ticket:') || channel.topic?.startsWith('ticket-owner:'));
}

function ticketOwnerId(channel) {
  return channel.topic?.match(/(?:owner:|ticket-owner:)(\d+)/)?.[1];
}

function ticketIdFrom(channel) {
  return channel.topic?.match(/^ticket:([^|]+)/)?.[1];
}

function ticketRecord(channel) {
  const id = ticketIdFrom(channel);
  return id ? db.tickets[id] : Object.values(db.tickets).find(ticket => ticket.channelId === channel.id);
}

function ticketTopic(ticket) {
  return `ticket:${ticket.id}|owner:${ticket.ownerId}|type:${ticket.type}|priority:${ticket.priority}|claimed:${ticket.claimedBy || '0'}`;
}

function safeUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    // aceita qualquer URL https válida — Discord faz o próprio proxy/embed
    return url.toString();
  } catch { return null; }
}

function safeChannelName(value) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'ticket';
}

function escapeHtml(value = '') {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function staffAllowed(interaction) {
  const config = guildData(interaction.guild.id);
  const record = ticketRecord(interaction.channel);
  const type = record ? ticketTypesForGuild(interaction.guild.id)[record.type] : null;
  const roleIds = new Set([config.supportRoleId, ticketSupportRoleId(config, type, record)].filter(Boolean));
  return interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)
    || [...roleIds].some(roleId => interaction.member.roles.cache.has(roleId));
}

function canActOn(executor, target) {
  if (!target || target.id === executor.id || target.id === client.user.id) return false;
  if (executor.guild.ownerId === executor.id) return true;
  return executor.roles.highest.comparePositionTo(target.roles.highest) > 0;
}

async function createTranscript(channel) {
  const messages = [];
  let before;
  while (messages.length < 500) {
    const batch = await channel.messages.fetch({ limit: 100, before });
    if (!batch.size) break;
    messages.push(...batch.values());
    before = batch.last().id;
    if (batch.size < 100) break;
  }
  messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
  const record = ticketRecord(channel);
  const lines = [
    `TRANSCRIÇÃO: #${channel.name}`,
    `Servidor: ${channel.guild.name} (${channel.guild.id})`,
    `Ticket: ${record?.id || 'legado'} | Tipo: ${record?.type || 'não informado'} | Prioridade: ${record?.priority || 'não informada'}`,
    `Gerada: ${new Date().toLocaleString('pt-BR')}`,
    `Mensagens: ${messages.length}`,
    '-'.repeat(70),
    ...messages.map(message => {
      const when = new Date(message.createdTimestamp).toLocaleString('pt-BR');
      const attachments = [...message.attachments.values()].map(a => a.url).join(' ');
      return `[${when}] ${message.author?.tag || 'Usuário desconhecido'} (${message.author?.id || 'N/A'}): ${message.cleanContent || '*sem texto*'} ${attachments}`.trim();
    }),
  ];
  const htmlMessages = messages.map(message => {
    const when = new Date(message.createdTimestamp).toLocaleString('pt-BR');
    const attachments = [...message.attachments.values()].map(file => `<a href="${escapeHtml(file.url)}">${escapeHtml(file.name || 'anexo')}</a>`).join(' ');
    return `<article><img src="${escapeHtml(message.author?.displayAvatarURL({ size: 64 }) || '')}" alt=""><div><header><strong>${escapeHtml(message.author?.tag || 'Usuário desconhecido')}</strong><time>${escapeHtml(when)}</time></header><p>${escapeHtml(message.cleanContent || '*sem texto*').replaceAll('\n', '<br>')}</p>${attachments ? `<p>${attachments}</p>` : ''}</div></article>`;
  }).join('\n');
  const typeLabel = ticketTypesForGuild(channel.guild.id)[record?.type]?.label || record?.type || 'não informado';
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Transcrição ${escapeHtml(channel.name)}</title><style>body{margin:0;background:#313338;color:#dbdee1;font:15px Arial,sans-serif}main{max-width:900px;margin:auto;padding:32px}h1{color:#fff}.meta{background:#2b2d31;border-left:4px solid #5865f2;padding:16px;border-radius:6px;margin-bottom:24px}article{display:flex;gap:12px;padding:12px;border-top:1px solid #3f4147}article:hover{background:#2e3035}img{width:40px;height:40px;border-radius:50%}header{display:flex;gap:10px;align-items:center}strong{color:#fff}time{font-size:12px;color:#949ba4}p{margin:5px 0;line-height:1.4;word-break:break-word}a{color:#00a8fc}</style></head><body><main><h1>#${escapeHtml(channel.name)}</h1><section class="meta">Servidor: ${escapeHtml(channel.guild.name)}<br>Ticket: ${escapeHtml(record?.id || 'legado')}<br>Tipo: ${escapeHtml(typeLabel)}<br>Mensagens: ${messages.length}</section>${htmlMessages || '<p>Nenhuma mensagem.</p>'}</main></body></html>`;
  return {
    count: messages.length,
    files: [
      new AttachmentBuilder(Buffer.from(lines.join('\n'), 'utf8'), { name: `transcript-${channel.name}.txt` }),
      new AttachmentBuilder(Buffer.from(html, 'utf8'), { name: `transcript-${channel.name}.html` }),
    ],
  };
}

client.once(Events.ClientReady, ready => {
  log.info(`✅ ${ready.user.tag} online em ${ready.guilds.cache.size} servidor(es).`);
  ready.user.setPresence({ activities: [{ name: '/ajuda • Atendimento e moderação' }], status: 'online' });
});

client.on(Events.InteractionCreate, async interaction => {
  try {
    if (interaction.isButton()) return handleButton(interaction);
    if (interaction.isStringSelectMenu()) return handleTicketTypeSelect(interaction);
    if (interaction.isChannelSelectMenu()) return handleAdminChannelSelect(interaction);
    if (interaction.isRoleSelectMenu()) return handleAdminRoleSelect(interaction);
    if (interaction.isUserSelectMenu()) return handleTicketUserSelect(interaction);
    if (interaction.isModalSubmit()) return handleModal(interaction);
    if (!interaction.isChatInputCommand() || !interaction.inGuild()) return;

    switch (interaction.commandName) {
      case 'ajuda': return handleHelp(interaction);
      case 'ping': return interaction.reply({ embeds: [embed('🏓 Estado do bot', `WebSocket: **${client.ws.ping} ms**\nProcesso ativo: **${formatTime(process.uptime() * 1000)}**\nServidores: **${client.guilds.cache.size}**`, COLORS.success)] });
      case 'servidor': return handleServerInfo(interaction);
      case 'usuario': return handleUserInfo(interaction);
      case 'central': return renderAdminCentral(interaction);
      case 'dashboard': return handleDashboardCommand(interaction);
      case 'falar': return showSpeakModal(interaction);
      case 'configurar': return handleConfiguration(interaction);
      case 'painel-ticket': return sendTicketPanel(interaction);
      case 'ticket': return handleTicketCommand(interaction);
      case 'mod': return handleModeration(interaction);
      case 'economia': return handleEconomy(interaction);
      case 'diversao': return handleFun(interaction);
      case 'sugerir': return handleSuggestion(interaction);
    }
  } catch (error) {
    log.error(`[INTERAÇÃO ${interaction.id}] cmd=${interaction.commandName || interaction.customId || '?'} user=${interaction.user?.tag} guild=${interaction.guild?.id}`, error?.message || error, error?.stack?.split('\n')[1] || '');
    const payload = { content: `❌ Não consegui concluir esta ação. Código: \`${interaction.id}\``, flags: PRIVATE };
    if (interaction.deferred || interaction.replied) await interaction.followUp(payload).catch(() => {});
    else await interaction.reply(payload).catch(() => {});
  }
});

function handleDashboardCommand(interaction) {
  const url = process.env.DASHBOARD_URL;
  if (!url) return interaction.reply({ content: 'O dashboard está instalado, mas `DASHBOARD_URL` ainda não foi definido no arquivo `.env`.', flags: PRIVATE });
  const button = new ButtonBuilder().setLabel('Abrir dashboard').setStyle(ButtonStyle.Link).setURL(url.replace(/\/$/, '') + '/dashboard').setEmoji('🌐');
  return interaction.reply({ embeds: [embed('🌐 Dashboard administrativo', 'Acesse métricas, tickets, aparência, proteções, comunidade e logs pelo painel web.')], components: [new ActionRowBuilder().addComponents(button)], flags: PRIVATE });
}

function handleHelp(interaction) {
  const card = embed('📚 Central de ajuda', 'Para configurar sem decorar comandos, use `/central`. Os comandos avançados continuam disponíveis para quem quiser controle manual.')
    .addFields(
      { name: '🎫 Atendimento', value: '`/painel-ticket` e `/ticket` — abertura, equipe, membros, transcrição e fechamento.' },
      { name: '🎛️ Configuração fácil', value: '`/central` — configuração automática, canais, cargo, aparência, proteção e comunidade por botões.' },
      { name: '🌐 Dashboard', value: '`/dashboard` — abre o painel web com métricas, tickets, aparência, proteções, comunidade e logs.' },
      { name: '🛡️ Administração avançada', value: '`/configurar`, `/mod` e `/falar` — logs, proteção, avisos e punições.' },
      { name: '👋 Comunidade', value: '`/sugerir`, boas-vindas, saídas, cargo automático e votação.' },
      { name: '💰 Economia', value: '`/economia` — saldo, daily, trabalho, pagamentos, ranking, loja e inventário.' },
      { name: '🎲 Utilidades', value: '`/diversao`, `/usuario`, `/servidor` e `/ping`.' },
    );
  return interaction.reply({ embeds: [card], flags: PRIVATE });
}

function handleServerInfo(interaction) {
  const guild = interaction.guild;
  return interaction.reply({ embeds: [embed(`🏠 ${guild.name}`, `**ID:** ${guild.id}\n**Dono:** <@${guild.ownerId}>\n**Membros:** ${guild.memberCount.toLocaleString('pt-BR')}\n**Canais:** ${guild.channels.cache.size}\n**Cargos:** ${guild.roles.cache.size}\n**Criado:** <t:${Math.floor(guild.createdTimestamp / 1000)}:F>`).setThumbnail(guild.iconURL({ size: 256 }))] });
}

async function handleUserInfo(interaction) {
  const user = interaction.options.getUser('membro') || interaction.user;
  const member = await interaction.guild.members.fetch(user.id).catch(() => null);
  const description = [
    `**ID:** ${user.id}`,
    `**Conta criada:** <t:${Math.floor(user.createdTimestamp / 1000)}:F>`,
    member ? `**Entrou no servidor:** <t:${Math.floor(member.joinedTimestamp / 1000)}:F>` : '**Não está mais no servidor**',
    member ? `**Cargo principal:** ${member.roles.highest}` : '',
    `**Avisos:** ${warningsFor(interaction.guild.id, user.id).length}`,
  ].filter(Boolean).join('\n');
  return interaction.reply({ embeds: [embed(`👤 ${user.tag}`, description).setThumbnail(user.displayAvatarURL({ size: 256 }))] });
}

function showSpeakModal(interaction) {
  const target = interaction.options.getChannel('canal') || interaction.channel;
  if (!target?.isTextBased()) return interaction.reply({ content: 'Escolha um canal de texto.', flags: PRIVATE });
  const modal = new ModalBuilder().setCustomId(`speak_modal:${target.id}`).setTitle('📢 Criar anúncio / board');
  const title = new TextInputBuilder().setCustomId('title').setLabel('Título (deixe vazio pra mensagem simples)').setStyle(TextInputStyle.Short).setMaxLength(256).setRequired(false).setPlaceholder('Ex: 📢 NOVIDADES DO SERVIDOR');
  const text = new TextInputBuilder().setCustomId('message').setLabel('Texto / descrição').setStyle(TextInputStyle.Paragraph).setMinLength(1).setMaxLength(4000).setRequired(true).setPlaceholder('Escreva o conteúdo aqui...');
  const color = new TextInputBuilder().setCustomId('color').setLabel('Cor hex (opcional, ex: #FF0000)').setStyle(TextInputStyle.Short).setMaxLength(7).setRequired(false).setPlaceholder('#5865F2');
  const image = new TextInputBuilder().setCustomId('image').setLabel('URL da imagem grande (opcional)').setStyle(TextInputStyle.Short).setMaxLength(500).setRequired(false).setPlaceholder('https://...');
  const footer = new TextInputBuilder().setCustomId('footer').setLabel('Rodapé (opcional)').setStyle(TextInputStyle.Short).setMaxLength(200).setRequired(false).setPlaceholder('Ex: kurogiri gang • julho 2026');
  return interaction.showModal(modal.addComponents(
    new ActionRowBuilder().addComponents(title),
    new ActionRowBuilder().addComponents(text),
    new ActionRowBuilder().addComponents(color),
    new ActionRowBuilder().addComponents(image),
    new ActionRowBuilder().addComponents(footer),
  ));
}

function adminCentralPayload(guild, mode = 'main', notice = null) {
  const config = guildData(guild.id);
  const status = [
    `${config.logsChannelId && guild.channels.cache.has(config.logsChannelId) ? '✅' : '❌'} Canal de logs: ${config.logsChannelId ? `<#${config.logsChannelId}>` : 'não escolhido'}`,
    `${config.ticketCategoryId && guild.channels.cache.has(config.ticketCategoryId) ? '✅' : '❌'} Categoria dos tickets: ${config.ticketCategoryId ? `<#${config.ticketCategoryId}>` : 'não escolhida'}`,
    `${config.supportRoleId && guild.roles.cache.has(config.supportRoleId) ? '✅' : '❌'} Cargo de suporte: ${config.supportRoleId ? `<@&${config.supportRoleId}>` : 'não escolhido'}`,
    `${config.ticketPanelChannelId && guild.channels.cache.has(config.ticketPanelChannelId) ? '✅' : '❌'} Canal do painel: ${config.ticketPanelChannelId ? `<#${config.ticketPanelChannelId}>` : 'não escolhido'}`,
  ].join('\n');
  const card = embed('🎛️ Central de administração', `${notice ? `${notice}\n\n` : ''}${status}\n\nUse os controles abaixo. Cada alteração é salva automaticamente.`)
    .addFields(
      { name: 'Painel', value: `**${config.ticketPanelTitle}** • ${config.ticketPanelColor}` },
      { name: 'Proteções', value: `Anti-link: **${config.antiLink ? 'ligado' : 'desligado'}**\nAnti-spam: **${config.antiSpam ? 'ligado' : 'desligado'}**` },
      { name: 'Limite', value: `**${config.maxOpenTickets}** ticket(s) por membro` },
    ).setFooter({ text: 'Somente você consegue ver este painel' });

  if (mode === 'resources') {
    card.setDescription('Escolha os recursos existentes. As alterações são salvas assim que você seleciona.');
    return { embeds: [card], components: [
      new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('admin:channel:logs').setPlaceholder('🧾 Escolher canal de logs').addChannelTypes(ChannelType.GuildText)),
      new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('admin:channel:category').setPlaceholder('📁 Escolher categoria dos tickets').addChannelTypes(ChannelType.GuildCategory)),
      new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId('admin:role:support').setPlaceholder('🛡️ Escolher cargo da equipe')),
      new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('admin:channel:panel').setPlaceholder('🎫 Escolher canal do painel').addChannelTypes(ChannelType.GuildText)),
      new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('admin:back').setLabel('Voltar').setEmoji('↩️').setStyle(ButtonStyle.Secondary)),
    ] };
  }
  if (mode === 'community') {
    card.setDescription('Configure a comunidade selecionando os canais e o cargo automático.');
    return { embeds: [card], components: [
      new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('admin:channel:welcome').setPlaceholder('👋 Canal de boas-vindas').addChannelTypes(ChannelType.GuildText)),
      new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('admin:channel:leave').setPlaceholder('🚪 Canal de saídas').addChannelTypes(ChannelType.GuildText)),
      new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('admin:channel:suggestions').setPlaceholder('💡 Canal de sugestões').addChannelTypes(ChannelType.GuildText)),
      new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId('admin:role:auto').setPlaceholder('🎭 Cargo automático')),
      new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('admin:back').setLabel('Voltar').setEmoji('↩️').setStyle(ButtonStyle.Secondary)),
    ] };
  }
  if (mode === 'protection') {
    card.setDescription('Clique para ligar ou desligar cada proteção. Moderadores com permissão de gerenciar mensagens não são afetados.');
    return { embeds: [card], components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('admin:toggle_link').setLabel(`Anti-link: ${config.antiLink ? 'Ligado' : 'Desligado'}`).setEmoji('🔗').setStyle(config.antiLink ? ButtonStyle.Success : ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('admin:toggle_spam').setLabel(`Anti-spam: ${config.antiSpam ? 'Ligado' : 'Desligado'}`).setEmoji('🚨').setStyle(config.antiSpam ? ButtonStyle.Success : ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('admin:back').setLabel('Voltar').setEmoji('↩️').setStyle(ButtonStyle.Secondary),
      ),
    ] };
  }
  if (mode === 'limits') {
    card.setDescription('Escolha quantos tickets cada membro pode manter aberto ao mesmo tempo.');
    return { embeds: [card], components: [
      new ActionRowBuilder().addComponents([1, 2, 3, 4, 5].map(value => new ButtonBuilder().setCustomId(`admin:limit:${value}`).setLabel(String(value)).setStyle(config.maxOpenTickets === value ? ButtonStyle.Success : ButtonStyle.Secondary))),
      new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('admin:back').setLabel('Voltar').setEmoji('↩️').setStyle(ButtonStyle.Secondary)),
    ] };
  }
  if (mode === 'confirm_auto') {
    card.setDescription('O bot criará automaticamente o cargo **Equipe de Suporte**, a categoria **ATENDIMENTO**, o canal privado **bot-logs** e o canal público **abrir-ticket**. Recursos já configurados serão mantidos.');
    return { embeds: [card], components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('admin:auto_confirm').setLabel('Confirmar criação').setEmoji('✅').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('admin:back').setLabel('Cancelar').setEmoji('✖️').setStyle(ButtonStyle.Secondary),
    )] };
  }
  return { embeds: [card], components: [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('admin:auto_setup').setLabel('Configurar sozinho').setEmoji('✨').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('admin:resources').setLabel('Canais e cargo').setEmoji('⚙️').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('admin:publish').setLabel('Publicar painel').setEmoji('🎫').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('admin:customize').setLabel('Personalizar').setEmoji('🎨').setStyle(ButtonStyle.Secondary),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('admin:community').setLabel('Comunidade').setEmoji('👋').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('admin:protection').setLabel('Proteções').setEmoji('🛡️').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('admin:limits').setLabel('Limites').setEmoji('🔢').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('admin:refresh').setLabel('Atualizar').setEmoji('🔄').setStyle(ButtonStyle.Secondary),
    ),
  ] };
}

function renderAdminCentral(interaction, mode = 'main', notice = null) {
  const payload = adminCentralPayload(interaction.guild, mode, notice);
  return interaction.isChatInputCommand() ? interaction.reply({ ...payload, flags: PRIVATE }) : interaction.update(payload);
}

async function handleAdminChannelSelect(interaction) {
  if (!interaction.customId.startsWith('admin:channel:') || !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return;
  const key = interaction.customId.split(':')[2];
  const map = { logs: 'logsChannelId', category: 'ticketCategoryId', panel: 'ticketPanelChannelId', welcome: 'welcomeChannelId', leave: 'leaveChannelId', suggestions: 'suggestionsChannelId' };
  if (!map[key]) return;
  guildData(interaction.guild.id)[map[key]] = interaction.values[0];
  save();
  return renderAdminCentral(interaction, ['welcome', 'leave', 'suggestions'].includes(key) ? 'community' : 'resources', '✅ Seleção salva.');
}

async function handleAdminRoleSelect(interaction) {
  if (!interaction.customId.startsWith('admin:role:') || !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return;
  const key = interaction.customId.split(':')[2];
  const map = { support: 'supportRoleId', auto: 'autoRoleId' };
  if (!map[key]) return;
  guildData(interaction.guild.id)[map[key]] = interaction.values[0];
  save();
  return renderAdminCentral(interaction, key === 'auto' ? 'community' : 'resources', '✅ Cargo salvo.');
}

async function handleConfiguration(interaction) {
  const sub = interaction.options.getSubcommand();
  const config = guildData(interaction.guild.id);
  if (sub === 'principal') {
    config.logsChannelId = interaction.options.getChannel('canal_logs').id;
    config.ticketCategoryId = interaction.options.getChannel('categoria_tickets').id;
    config.supportRoleId = interaction.options.getRole('cargo_suporte').id;
  } else if (sub === 'comunidade') {
    const welcome = interaction.options.getChannel('boas_vindas');
    const leave = interaction.options.getChannel('saidas');
    const role = interaction.options.getRole('cargo_automatico');
    const suggestions = interaction.options.getChannel('sugestoes');
    if (!welcome && !leave && !role && !suggestions) return interaction.reply({ content: 'Selecione pelo menos uma opção para alterar.', flags: PRIVATE });
    if (welcome) config.welcomeChannelId = welcome.id;
    if (leave) config.leaveChannelId = leave.id;
    if (role) config.autoRoleId = role.id;
    if (suggestions) config.suggestionsChannelId = suggestions.id;
  } else if (sub === 'protecao') {
    const antiLink = interaction.options.getBoolean('anti_link');
    const antiSpam = interaction.options.getBoolean('anti_spam');
    const limit = interaction.options.getInteger('limite_spam');
    if (antiLink === null && antiSpam === null && limit === null) return interaction.reply({ content: 'Informe pelo menos uma opção.', flags: PRIVATE });
    if (antiLink !== null) config.antiLink = antiLink;
    if (antiSpam !== null) config.antiSpam = antiSpam;
    if (limit !== null) config.spamLimit = limit;
  } else if (sub === 'painel_ticket') {
    const title = interaction.options.getString('titulo');
    const description = interaction.options.getString('descricao');
    const color = interaction.options.getString('cor');
    const banner = interaction.options.getString('banner');
    const thumbnail = interaction.options.getString('miniatura');
    const limit = interaction.options.getInteger('limite');
    if (!title && !description && !color && !banner && !thumbnail && limit === null) return interaction.reply({ content: 'Informe pelo menos uma opção para personalizar.', flags: PRIVATE });
    if (color && !/^#[0-9a-f]{6}$/i.test(color)) return interaction.reply({ content: 'A cor precisa estar no formato hexadecimal, por exemplo `#5865F2`.', flags: PRIVATE });
    if (banner && banner.toLowerCase() !== 'remover' && !safeUrl(banner)) return interaction.reply({ content: 'O banner precisa ser uma URL válida começando com `http://` ou `https://`.', flags: PRIVATE });
    if (thumbnail && thumbnail.toLowerCase() !== 'remover' && !safeUrl(thumbnail)) return interaction.reply({ content: 'A miniatura precisa ser uma URL válida começando com `http://` ou `https://`.', flags: PRIVATE });
    if (title) config.ticketPanelTitle = title;
    if (description) config.ticketPanelDescription = description;
    if (color) config.ticketPanelColor = color.toUpperCase();
    if (banner) config.ticketPanelBanner = banner.toLowerCase() === 'remover' ? null : safeUrl(banner);
    if (thumbnail) config.ticketPanelThumbnail = thumbnail.toLowerCase() === 'remover' ? null : safeUrl(thumbnail);
    if (limit !== null) config.maxOpenTickets = limit;
  } else {
    const value = [
      `Logs: ${config.logsChannelId ? `<#${config.logsChannelId}>` : 'não configurado'}`,
      `Tickets: ${config.ticketCategoryId ? `<#${config.ticketCategoryId}>` : 'não configurado'}`,
      `Suporte: ${config.supportRoleId ? `<@&${config.supportRoleId}>` : 'não configurado'}`,
      `Avaliações: ${config.ticketReviewChannelId ? `<#${config.ticketReviewChannelId}>` : 'canal não configurado'}`,
      `Boas-vindas: ${config.welcomeChannelId ? `<#${config.welcomeChannelId}>` : 'desativado'}`,
      `Saídas: ${config.leaveChannelId ? `<#${config.leaveChannelId}>` : 'desativado'}`,
      `Cargo automático: ${config.autoRoleId ? `<@&${config.autoRoleId}>` : 'desativado'}`,
      `Sugestões: ${config.suggestionsChannelId ? `<#${config.suggestionsChannelId}>` : 'não configurado'}`,
      `Painel de tickets: **${config.ticketPanelTitle}** • ${config.ticketPanelColor}`,
      `Limite de tickets: **${config.maxOpenTickets} por membro**`,
      `Anti-link: **${config.antiLink ? 'ligado' : 'desligado'}**`,
      `Anti-spam: **${config.antiSpam ? `ligado (${config.spamLimit}/${config.spamWindowSeconds || 8}s • timeout ${config.spamMuteDuration || 5}min)` : 'desligado'}**`,
      `Filtro de conteúdo: **${config.antiSwear ? `ligado (${config.swearWords?.length || 0} regra(s))` : 'desligado'}**`,
    ].join('\n');
    return interaction.reply({ embeds: [embed('⚙️ Configuração atual', value)], flags: PRIVATE });
  }
  save();
  await sendLog(interaction.guild, '⚙️ Configuração alterada', `${interaction.user.tag} alterou **${sub}**.`);
  return interaction.reply({ content: '✅ Configuração salva.', flags: PRIVATE });
}

function ticketPanelPayload(guild) {
  const config = guildData(guild.id);
  const types = ticketTypesForGuild(guild.id);
  const entries = Object.entries(types).slice(0, 25);
  const menu = new StringSelectMenuBuilder()
    .setCustomId('ticket:type')
    .setPlaceholder(config.ticketPanelMenuPlaceholder || '📨 Selecione o setor do atendimento')
    .setMinValues(1).setMaxValues(1)
    .addOptions(entries.map(([value, type]) =>
      new StringSelectMenuOptionBuilder().setLabel(type.label).setValue(value).setDescription(type.description || 'Abra um atendimento com esta equipe.').setEmoji(type.emoji || '🎫')));
  const row = new ActionRowBuilder().addComponents(menu);
  const panelTitle = String(config.ticketPanelTitle || 'CENTRAL DE ATENDIMENTO').slice(0, 256);
  const panelDescription = String(config.ticketPanelDescription || 'Selecione um setor para abrir seu atendimento.').slice(0, 2600);
  const sectorsTitle = String(config.ticketPanelSectorsTitle || 'Setores disponíveis').slice(0, 256);
  const howTitle = String(config.ticketPanelHowTitle || 'Como funciona?').slice(0, 256);
  const howText = `${config.ticketPanelHowText || 'Escolha um setor, preencha o formulário e aguarde em seu canal privado.'} Você pode manter até **${config.maxOpenTickets}** ticket(s) aberto(s).`.slice(0, 800);
  const footer = String(config.ticketPanelFooter || `${guild.name} • Atendimento seguro e registrado`).slice(0, 200);
  const fixedSize = panelTitle.length + panelDescription.length + sectorsTitle.length + howTitle.length + howText.length + footer.length + 100;
  const categoriesBudget = Math.max(250, 5600 - fixedSize);
  const categoryLines = [];
  let categoriesSize = 0;
  let omitted = 0;
  for (const [, type] of entries) {
    const line = `${type.emoji || '🎫'} **${type.label}** — ${type.description || 'Abra um atendimento com esta equipe.'}`.slice(0, 180);
    if (categoriesSize + line.length + 1 > categoriesBudget) {
      omitted += 1;
      continue;
    }
    categoryLines.push(line);
    categoriesSize += line.length + 1;
  }
  if (omitted > 0) categoryLines.push(`… e mais **${omitted}** setor(es) disponíveis no menu abaixo.`);
  const categoryFields = [];
  let current = '';
  for (const line of categoryLines) {
    if (current && current.length + line.length + 1 > 1000) {
      categoryFields.push(current);
      current = '';
    }
    current += `${current ? '\n' : ''}${line}`;
  }
  if (current) categoryFields.push(current);
  const card = embed(panelTitle, panelDescription, Number.parseInt(config.ticketPanelColor.slice(1), 16))
    .addFields(
      ...categoryFields.map((value, index) => ({ name: index === 0 ? sectorsTitle : `${sectorsTitle} • continuação`, value })),
      { name: howTitle, value: howText },
    )
    .setFooter({ text: footer });
  if (config.ticketPanelBanner) card.setImage(config.ticketPanelBanner);
  if (config.ticketPanelThumbnail) card.setThumbnail(config.ticketPanelThumbnail);
  return { embeds: [card], components: [row] };
}

async function sendTicketPanel(interaction) {
  const config = guildData(interaction.guild.id);
  const types = ticketTypesForGuild(interaction.guild.id);
  if (!config.ticketCategoryId || Object.values(types).some(type => !interaction.guild.roles.cache.has(ticketSupportRoleId(config, type)))) return interaction.reply({ content: 'Configure a categoria e um cargo responsável válido para cada setor no dashboard.', flags: PRIVATE });
  await interaction.channel.send(ticketPanelPayload(interaction.guild));
  return interaction.reply({ content: '✅ Painel publicado.', flags: PRIVATE });
}

async function handleTicketCommand(interaction) {
  const sub = interaction.options.getSubcommand();
  if (sub === 'estatisticas') return showTicketStats(interaction);
  if (!isTicket(interaction.channel)) return interaction.reply({ content: 'Este canal não é um ticket.', flags: PRIVATE });
  const ownerId = ticketOwnerId(interaction.channel);
  const privileged = staffAllowed(interaction);
  const record = ticketRecord(interaction.channel);
  if (sub === 'fechar') return showTicketCloseModal(interaction);
  if (sub === 'transcript') {
    if (!privileged && interaction.user.id !== ownerId) return interaction.reply({ content: 'Sem permissão.', flags: PRIVATE });
    await interaction.deferReply({ flags: PRIVATE });
    const transcript = await createTranscript(interaction.channel);
    return interaction.editReply({ content: `📄 Transcrição gerada com ${transcript.count} mensagem(ns).`, files: transcript.files });
  }
  if (!privileged) return interaction.reply({ content: 'Apenas a equipe pode usar esta ação.', flags: PRIVATE });
  if (sub === 'assumir') {
    if (record?.claimedBy && record.claimedBy !== interaction.user.id && !interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) return interaction.reply({ content: `Este ticket já está com <@${record.claimedBy}>.`, flags: PRIVATE });
    if (record) {
      record.claimedBy = interaction.user.id;
      record.claimedAt ??= Date.now();
      await interaction.channel.setTopic(ticketTopic(record));
      save();
    }
    await interaction.channel.send(`🧑‍💼 ${interaction.user} assumiu este atendimento.`);
    return interaction.reply({ content: '✅ Ticket assumido.', flags: PRIVATE });
  }
  if (sub === 'liberar') {
    if (!record?.claimedBy) return interaction.reply({ content: 'Este ticket já está livre.', flags: PRIVATE });
    if (record.claimedBy !== interaction.user.id && !interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) return interaction.reply({ content: 'Somente o atendente responsável ou um gerente pode liberar.', flags: PRIVATE });
    record.claimedBy = null;
    await interaction.channel.setTopic(ticketTopic(record));
    save();
    await interaction.channel.send(`↩️ ${interaction.user} liberou o ticket para a equipe.`);
    return interaction.reply({ content: '✅ Ticket liberado.', flags: PRIVATE });
  }
  if (sub === 'renomear') {
    const name = safeChannelName(interaction.options.getString('nome'));
    await interaction.channel.setName(name, `Renomeado por ${interaction.user.tag}`);
    return interaction.reply({ content: `✅ Canal renomeado para **${name}**.`, flags: PRIVATE });
  }
  if (sub === 'prioridade') {
    if (!record) return interaction.reply({ content: 'Registro deste ticket não encontrado.', flags: PRIVATE });
    record.priority = interaction.options.getString('nivel');
    await interaction.channel.setTopic(ticketTopic(record));
    save();
    const icons = { baixa: '🟢', normal: '🟡', alta: '🟠', urgente: '🔴' };
    await interaction.channel.send(`${icons[record.priority]} Prioridade alterada para **${record.priority}** por ${interaction.user}.`);
    return interaction.reply({ content: '✅ Prioridade atualizada.', flags: PRIVATE });
  }
  if (sub === 'nota') {
    if (!record) return interaction.reply({ content: 'Registro deste ticket não encontrado.', flags: PRIVATE });
    const text = interaction.options.getString('texto');
    record.notes ??= [];
    record.notes.push({ authorId: interaction.user.id, text, createdAt: Date.now() });
    save();
    await sendLog(interaction.guild, `📝 Nota interna • ${record.id}`, `Por ${interaction.user}:\n${text}`, COLORS.warning);
    return interaction.reply({ content: '✅ Nota interna registrada nos logs.', flags: PRIVATE });
  }
  const member = interaction.options.getUser('membro');
  if (member.id === ownerId && sub === 'remover') return interaction.reply({ content: 'O criador do ticket não pode ser removido.', flags: PRIVATE });
  await interaction.channel.permissionOverwrites.edit(member.id, sub === 'adicionar'
    ? { ViewChannel: true, SendMessages: true, ReadMessageHistory: true }
    : { ViewChannel: false });
  await interaction.channel.send(`${sub === 'adicionar' ? '➕' : '➖'} ${member} foi ${sub === 'adicionar' ? 'adicionado ao' : 'removido do'} ticket por ${interaction.user}.`);
  return interaction.reply({ content: '✅ Permissões atualizadas.', flags: PRIVATE });
}

function showTicketStats(interaction) {
  const config = guildData(interaction.guild.id);
  const types = ticketTypesForGuild(interaction.guild.id);
  const staffRoles = new Set([config.supportRoleId, ...Object.values(types).map(type => type.roleId)].filter(Boolean));
  const allowed = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels) || [...staffRoles].some(roleId => interaction.member.roles.cache.has(roleId));
  if (!allowed) return interaction.reply({ content: 'Apenas a equipe pode ver as métricas.', flags: PRIVATE });
  const tickets = Object.values(db.tickets).filter(ticket => ticket.guildId === interaction.guild.id);
  const open = tickets.filter(ticket => ticket.status === 'open').length;
  const closed = tickets.filter(ticket => ticket.status === 'closed');
  const responseTimes = tickets.filter(ticket => ticket.firstResponseAt).map(ticket => ticket.firstResponseAt - ticket.openedAt);
  const ratings = closed.filter(ticket => ticket.rating).map(ticket => ticket.rating);
  const averageResponse = responseTimes.length ? formatTime(responseTimes.reduce((sum, value) => sum + value, 0) / responseTimes.length) : 'sem dados';
  const averageRating = ratings.length ? `${(ratings.reduce((sum, value) => sum + value, 0) / ratings.length).toFixed(1)}/5` : 'sem avaliações';
  const byType = Object.entries(types).map(([id, type]) => `${type.emoji} ${type.label}: **${tickets.filter(ticket => ticket.type === id).length}**`).join('\n');
  return interaction.reply({ embeds: [embed('📊 Métricas do atendimento', `**Abertos agora:** ${open}\n**Finalizados:** ${closed.length}\n**Total:** ${tickets.length}\n**Tempo médio da primeira resposta:** ${averageResponse}\n**Satisfação média:** ${averageRating}\n\n${byType}`)], flags: PRIVATE });
}

async function handleModeration(interaction) {
  const sub = interaction.options.getSubcommand();
  if (sub === 'limpar') {
    await interaction.deferReply({ flags: PRIVATE });
    const deleted = await interaction.channel.bulkDelete(interaction.options.getInteger('quantidade'), true);
    await sendLog(interaction.guild, '🧹 Limpeza', `${interaction.user} apagou **${deleted.size}** mensagens em ${interaction.channel}.`, COLORS.warning);
    return interaction.editReply(`✅ ${deleted.size} mensagem(ns) apagada(s). Mensagens com mais de 14 dias são ignoradas pelo Discord.`);
  }
  const targetUser = interaction.options.getUser('membro');
  const target = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
  if (sub === 'avisos') {
    const warnings = warningsFor(interaction.guild.id, targetUser.id);
    const lines = warnings.slice(-10).map(w => `**Caso #${w.caseId}** — ${w.reason}\nPor <@${w.moderatorId}> em <t:${Math.floor(w.createdAt / 1000)}:f>`);
    return interaction.reply({ embeds: [embed(`⚠️ Avisos de ${targetUser.tag}`, lines.join('\n\n') || 'Nenhum aviso registrado.')], flags: PRIVATE });
  }
  if (sub === 'remover_aviso') {
    const warnings = warningsFor(interaction.guild.id, targetUser.id);
    const index = warnings.findIndex(w => w.caseId === interaction.options.getInteger('caso'));
    if (index === -1) return interaction.reply({ content: 'Caso não encontrado para esse membro.', flags: PRIVATE });
    const [removed] = warnings.splice(index, 1); save();
    await sendLog(interaction.guild, '🧽 Aviso removido', `Caso #${removed.caseId} de ${targetUser} removido por ${interaction.user}.`, COLORS.warning);
    return interaction.reply({ content: `✅ Caso #${removed.caseId} removido.`, flags: PRIVATE });
  }
  if (!target || !canActOn(interaction.member, target)) return interaction.reply({ content: 'Você não pode moderar esse membro por causa da hierarquia de cargos.', flags: PRIVATE });
  const reason = interaction.options.getString('motivo') || 'Não informado';
  const caseId = nextCase(interaction.guild.id);
  if (sub === 'avisar') {
    warningsFor(interaction.guild.id, targetUser.id).push({ caseId, moderatorId: interaction.user.id, reason, createdAt: Date.now() });
    save();
    await targetUser.send(`⚠️ Você recebeu um aviso no servidor **${interaction.guild.name}**.\nMotivo: ${reason}\nCaso: #${caseId}`).catch(() => {});
  } else if (sub === 'kick') {
    if (!target.kickable) return interaction.reply({ content: 'Meu cargo não permite expulsar esse membro.', flags: PRIVATE });
    await target.kick(`${reason} | Caso #${caseId} | ${interaction.user.tag}`);
  } else if (sub === 'ban') {
    if (!target.bannable) return interaction.reply({ content: 'Meu cargo não permite banir esse membro.', flags: PRIVATE });
    await target.ban({ reason: `${reason} | Caso #${caseId} | ${interaction.user.tag}` });
  } else if (sub === 'timeout') {
    if (!target.moderatable) return interaction.reply({ content: 'Meu cargo não permite silenciar esse membro.', flags: PRIVATE });
    await target.timeout(interaction.options.getInteger('minutos') * 60_000, `${reason} | Caso #${caseId}`);
  }
  save();
  await sendLog(interaction.guild, `🔨 ${sub.toUpperCase()} • Caso #${caseId}`, `Membro: ${targetUser}\nModerador: ${interaction.user}\nMotivo: ${reason}`, COLORS.danger);
  return interaction.reply({ content: `✅ **${sub}** aplicado em ${targetUser.tag}. Caso #${caseId}.`, flags: PRIVATE });
}

async function handleEconomy(interaction) {
  const sub = interaction.options.getSubcommand();
  if (sub === 'saldo') {
    const target = interaction.options.getUser('membro') || interaction.user;
    const user = userData(interaction.guild.id, target.id);
    return interaction.reply({ embeds: [embed('💰 Perfil econômico', `${target}\n**Carteira:** ${user.wallet.toLocaleString('pt-BR')} moedas\n**Nível:** ${user.level}\n**XP:** ${user.xp}/${user.level * 100}`)] });
  }
  if (sub === 'daily') {
    const user = userData(interaction.guild.id, interaction.user.id);
    const wait = 86_400_000 - (Date.now() - user.dailyAt);
    if (wait > 0) return interaction.reply({ content: `⏳ Volte em **${formatTime(wait)}**.`, flags: PRIVATE });
    user.wallet += 500; user.dailyAt = Date.now(); save();
    return interaction.reply(`🎁 ${interaction.user} recebeu **500 moedas**.`);
  }
  if (sub === 'trabalhar') {
    const user = userData(interaction.guild.id, interaction.user.id);
    const wait = 3_600_000 - (Date.now() - user.workAt);
    if (wait > 0) return interaction.reply({ content: `⏳ Trabalhe novamente em **${formatTime(wait)}**.`, flags: PRIVATE });
    const coins = Math.floor(Math.random() * 301) + 200;
    const xp = Math.floor(Math.random() * 21) + 15;
    user.wallet += coins; user.xp += xp; user.workAt = Date.now();
    let leveled = false;
    while (user.xp >= user.level * 100) { user.xp -= user.level * 100; user.level += 1; leveled = true; }
    save();
    return interaction.reply(`🛠️ ${interaction.user} recebeu **${coins} moedas** e **${xp} XP**.${leveled ? ` Subiu para o nível **${user.level}**!` : ''}`);
  }
  if (sub === 'pagar') {
    const target = interaction.options.getUser('membro');
    const amount = interaction.options.getInteger('quantidade');
    if (target.bot || target.id === interaction.user.id) return interaction.reply({ content: 'Escolha outro membro humano.', flags: PRIVATE });
    const from = userData(interaction.guild.id, interaction.user.id);
    if (from.wallet < amount) return interaction.reply({ content: 'Saldo insuficiente.', flags: PRIVATE });
    from.wallet -= amount; userData(interaction.guild.id, target.id).wallet += amount; save();
    return interaction.reply(`💸 ${interaction.user} enviou **${amount.toLocaleString('pt-BR')} moedas** para ${target}.`);
  }
  if (sub === 'ranking') {
    const prefix = `${interaction.guild.id}:`;
    const top = Object.entries(db.users).filter(([key]) => key.startsWith(prefix)).sort((a, b) => b[1].wallet - a[1].wallet).slice(0, 10);
    const lines = top.map(([key, user], index) => `**${index + 1}.** <@${key.slice(prefix.length)}> — ${user.wallet.toLocaleString('pt-BR')} moedas`);
    return interaction.reply({ embeds: [embed('🏆 Ranking econômico', lines.join('\n') || 'Ainda não há participantes.')] });
  }
  if (sub === 'loja') {
    const lines = Object.entries(shop).map(([id, item]) => `**${item.name}** — ${item.price.toLocaleString('pt-BR')} moedas \`(${id})\``);
    return interaction.reply({ embeds: [embed('🛒 Loja', `${lines.join('\n')}\n\nUse \`/economia comprar\`.`)] });
  }
  if (sub === 'comprar') {
    const id = interaction.options.getString('item');
    const item = shop[id];
    const user = userData(interaction.guild.id, interaction.user.id);
    if (user.wallet < item.price) return interaction.reply({ content: 'Saldo insuficiente.', flags: PRIVATE });
    user.wallet -= item.price; user.inventory.push(id); save();
    return interaction.reply(`✅ ${interaction.user} comprou **${item.name}** por ${item.price.toLocaleString('pt-BR')} moedas.`);
  }
  const user = userData(interaction.guild.id, interaction.user.id);
  const counts = user.inventory.reduce((result, id) => ({ ...result, [id]: (result[id] || 0) + 1 }), {});
  const lines = Object.entries(counts).map(([id, count]) => `**${shop[id]?.name || id}** × ${count}`);
  return interaction.reply({ embeds: [embed('🎒 Inventário', lines.join('\n') || 'Seu inventário está vazio.')] });
}

function handleFun(interaction) {
  const sub = interaction.options.getSubcommand();
  if (sub === 'moeda') return interaction.reply(`🪙 A moeda caiu em **${Math.random() < 0.5 ? 'cara' : 'coroa'}**!`);
  if (sub === 'dado') return interaction.reply(`🎲 O dado caiu em **${Math.floor(Math.random() * 6) + 1}**!`);
  const target = interaction.options.getUser('membro') || interaction.user;
  return interaction.reply({ embeds: [new EmbedBuilder().setTitle(`Avatar de ${target.username}`).setImage(target.displayAvatarURL({ size: 1024 })).setColor(COLORS.primary)] });
}

async function handleSuggestion(interaction) {
  const channel = interaction.guild.channels.cache.get(guildData(interaction.guild.id).suggestionsChannelId);
  if (!channel?.isTextBased()) return interaction.reply({ content: 'O canal de sugestões ainda não foi configurado.', flags: PRIVATE });
  const card = embed('💡 Nova sugestão', interaction.options.getString('texto')).setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() }).setFooter({ text: 'Use os botões para votar' });
  const row = suggestionButtons(0, 0);
  const message = await channel.send({ embeds: [card], components: [row], allowedMentions: { parse: [] } });
  db.suggestions[message.id] = { guildId: interaction.guild.id, channelId: channel.id, authorId: interaction.user.id, yes: [], no: [] };
  save();
  return interaction.reply({ content: `✅ Sugestão publicada em ${channel}.`, flags: PRIVATE });
}

function suggestionButtons(yes, no) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('suggestion:yes').setLabel(`Aprovar • ${yes}`).setEmoji('👍').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('suggestion:no').setLabel(`Reprovar • ${no}`).setEmoji('👎').setStyle(ButtonStyle.Danger),
  );
}

async function handleTicketTypeSelect(interaction) {
  if (interaction.customId === 'ticket:manage_priority') {
    if (!isTicket(interaction.channel) || !staffAllowed(interaction)) return interaction.reply({ content: 'Apenas a equipe pode alterar a prioridade.', flags: PRIVATE });
    const record = ticketRecord(interaction.channel);
    if (!record) return interaction.reply({ content: 'Registro do ticket não encontrado.', flags: PRIVATE });
    record.priority = interaction.values[0];
    await interaction.channel.setTopic(ticketTopic(record));
    save();
    await interaction.channel.send(`🚦 ${interaction.user} alterou a prioridade para **${record.priority}**.`);
    return interaction.reply({ content: '✅ Prioridade atualizada.', flags: PRIVATE });
  }
  if (interaction.customId !== 'ticket:type') return;
  if (!interaction.inGuild()) return interaction.reply({ content: 'Este painel funciona somente dentro de servidores.' });
  const typeId = interaction.values[0];
  const config = guildData(interaction.guild.id);
  const types = ticketTypesForGuild(interaction.guild.id);
  const type = types[typeId];
  if (!type) return interaction.reply({ content: 'Setor inválido.', flags: PRIVATE });
  const supportRoleId = ticketSupportRoleId(config, type);
  if (!config.ticketCategoryId || !supportRoleId || !interaction.guild.roles.cache.has(supportRoleId)) return interaction.reply({ content: 'A categoria ou o cargo responsável por este setor ainda não foi configurado.', flags: PRIVATE });
  const openTickets = Object.values(db.tickets).filter(ticket => ticket.guildId === interaction.guild.id && ticket.ownerId === interaction.user.id && ticket.status === 'open');
  const sameType = openTickets.find(ticket => ticket.type === typeId);
  if (sameType) return interaction.reply({ content: `Você já possui um ticket de **${type.label}**: <#${sameType.channelId}>`, flags: PRIVATE });
  if (openTickets.length >= config.maxOpenTickets) return interaction.reply({ content: `Você atingiu o limite de **${config.maxOpenTickets}** ticket(s) aberto(s).`, flags: PRIVATE });
  const modal = new ModalBuilder().setCustomId(`ticket_modal:${typeId}`).setTitle(`${type.emoji} ${type.label}`);
  const subject = new TextInputBuilder().setCustomId('subject').setLabel('Resumo do assunto').setStyle(TextInputStyle.Short).setMinLength(3).setMaxLength(80).setRequired(true);
  const reason = new TextInputBuilder().setCustomId('reason').setLabel('Explique com todos os detalhes').setStyle(TextInputStyle.Paragraph).setMinLength(15).setMaxLength(2000).setRequired(true);
  return interaction.showModal(modal.addComponents(new ActionRowBuilder().addComponents(subject), new ActionRowBuilder().addComponents(reason)));
}

function showTicketCloseModal(interaction) {
  if (!isTicket(interaction.channel)) return interaction.reply({ content: 'Este canal não é um ticket.', flags: PRIVATE });
  const ownerId = ticketOwnerId(interaction.channel);
  if (interaction.user.id !== ownerId && !staffAllowed(interaction)) return interaction.reply({ content: 'Você não pode finalizar este ticket.', flags: PRIVATE });
  const record = ticketRecord(interaction.channel);
  const modal = new ModalBuilder().setCustomId(`ticket_close_modal:${record?.id || interaction.channel.id}`).setTitle('Finalizar atendimento');
  const reason = new TextInputBuilder().setCustomId('close_reason').setLabel('Motivo do fechamento').setStyle(TextInputStyle.Short).setMinLength(3).setMaxLength(200).setRequired(true);
  const resolution = new TextInputBuilder().setCustomId('resolution').setLabel('Resumo da solução (opcional)').setStyle(TextInputStyle.Paragraph).setMaxLength(1000).setRequired(false);
  return interaction.showModal(modal.addComponents(new ActionRowBuilder().addComponents(reason), new ActionRowBuilder().addComponents(resolution)));
}

function ticketManagerPayload(channel) {
  const record = ticketRecord(channel);
  const card = embed(`🧰 Gerenciar ${record?.displayId || channel.name}`, `Responsável: ${record?.claimedBy ? `<@${record.claimedBy}>` : 'ninguém'}\nPrioridade: **${record?.priority || 'normal'}**\n\nEscolha uma ação abaixo. Somente a equipe vê este painel.`);
  const priority = new StringSelectMenuBuilder().setCustomId('ticket:manage_priority').setPlaceholder('🚦 Alterar prioridade').addOptions(
    new StringSelectMenuOptionBuilder().setLabel('Baixa').setValue('baixa').setEmoji('🟢'),
    new StringSelectMenuOptionBuilder().setLabel('Normal').setValue('normal').setEmoji('🟡'),
    new StringSelectMenuOptionBuilder().setLabel('Alta').setValue('alta').setEmoji('🟠'),
    new StringSelectMenuOptionBuilder().setLabel('Urgente').setValue('urgente').setEmoji('🔴'),
  );
  return { embeds: [card], components: [
    new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId('ticket:add_user').setPlaceholder('➕ Adicionar participante').setMinValues(1).setMaxValues(5)),
    new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId('ticket:remove_user').setPlaceholder('➖ Remover participante').setMinValues(1).setMaxValues(5)),
    new ActionRowBuilder().addComponents(priority),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket:rename_button').setLabel('Renomear').setEmoji('✏️').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('ticket:note_button').setLabel('Nota interna').setEmoji('📝').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('ticket:release_button').setLabel('Liberar').setEmoji('↩️').setStyle(ButtonStyle.Secondary),
    ),
  ] };
}

async function handleTicketUserSelect(interaction) {
  if (!['ticket:add_user', 'ticket:remove_user'].includes(interaction.customId)) return;
  if (!isTicket(interaction.channel) || !staffAllowed(interaction)) return interaction.reply({ content: 'Apenas a equipe pode gerenciar participantes.', flags: PRIVATE });
  const adding = interaction.customId === 'ticket:add_user';
  const ownerId = ticketOwnerId(interaction.channel);
  const changed = [];
  for (const userId of interaction.values) {
    if (!adding && userId === ownerId) continue;
    await interaction.channel.permissionOverwrites.edit(userId, adding
      ? { ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true }
      : { ViewChannel: false });
    changed.push(`<@${userId}>`);
  }
  if (!changed.length) return interaction.reply({ content: 'O criador do ticket não pode ser removido.', flags: PRIVATE });
  await interaction.channel.send(`${adding ? '➕' : '➖'} ${changed.join(', ')} ${adding ? 'adicionado(s)' : 'removido(s)'} por ${interaction.user}.`);
  return interaction.reply({ content: '✅ Participantes atualizados.', flags: PRIVATE });
}

async function createAutomaticStructure(guild) {
  const config = guildData(guild.id);
  let supportRole = guild.roles.cache.get(config.supportRoleId);
  if (!supportRole) supportRole = await guild.roles.create({ name: 'Equipe de Suporte', color: COLORS.primary, reason: 'Configuração automática da central' });
  let category = guild.channels.cache.get(config.ticketCategoryId);
  if (!category || category.type !== ChannelType.GuildCategory) category = await guild.channels.create({ name: 'ATENDIMENTO', type: ChannelType.GuildCategory, reason: 'Configuração automática da central' });
  let logs = guild.channels.cache.get(config.logsChannelId);
  if (!logs?.isTextBased()) logs = await guild.channels.create({
    name: 'bot-logs', type: ChannelType.GuildText, parent: category.id, reason: 'Configuração automática da central',
    permissionOverwrites: [
      { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: supportRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory] },
      { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AttachFiles] },
    ],
  });
  let panel = guild.channels.cache.get(config.ticketPanelChannelId);
  if (!panel?.isTextBased()) panel = await guild.channels.create({
    name: 'abrir-ticket', type: ChannelType.GuildText, parent: category.id, reason: 'Configuração automática da central',
    permissionOverwrites: [
      { id: guild.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory], deny: [PermissionFlagsBits.SendMessages] },
      { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks] },
    ],
  });
  config.supportRoleId = supportRole.id;
  config.ticketCategoryId = category.id;
  config.logsChannelId = logs.id;
  config.ticketPanelChannelId = panel.id;
  save();
  await panel.send(ticketPanelPayload(guild));
  return { supportRole, category, logs, panel };
}

async function handleAdminButton(interaction) {
  if (!interaction.inGuild() || !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return interaction.reply({ content: 'Apenas administradores podem usar esta central.', flags: PRIVATE });
  const action = interaction.customId.split(':')[1];
  if (action === 'auto_setup') return renderAdminCentral(interaction, 'confirm_auto');
  if (action === 'resources') return renderAdminCentral(interaction, 'resources');
  if (action === 'community') return renderAdminCentral(interaction, 'community');
  if (action === 'protection') return renderAdminCentral(interaction, 'protection');
  if (action === 'limits') return renderAdminCentral(interaction, 'limits');
  if (['back', 'refresh'].includes(action)) return renderAdminCentral(interaction);
  if (action === 'auto_confirm') {
    await interaction.deferUpdate();
    const result = await createAutomaticStructure(interaction.guild);
    return interaction.editReply(adminCentralPayload(interaction.guild, 'main', `✅ Estrutura criada. Entregue ${result.supportRole} aos atendentes. O painel foi publicado em ${result.panel}.`));
  }
  if (action === 'publish') {
    const config = guildData(interaction.guild.id);
    const channel = interaction.guild.channels.cache.get(config.ticketPanelChannelId);
    if (!channel?.isTextBased()) return renderAdminCentral(interaction, 'main', '❌ Escolha o canal do painel em **Canais e cargo**.');
    if (!config.ticketCategoryId || !config.supportRoleId) return renderAdminCentral(interaction, 'main', '❌ Termine a configuração dos recursos primeiro.');
    await channel.send(ticketPanelPayload(interaction.guild));
    return renderAdminCentral(interaction, 'main', `✅ Painel publicado em ${channel}.`);
  }
  if (action === 'customize') {
    const config = guildData(interaction.guild.id);
    const modal = new ModalBuilder().setCustomId('admin_panel_modal').setTitle('Personalizar painel de tickets');
    const fields = [
      new TextInputBuilder().setCustomId('panel_title').setLabel('Título').setStyle(TextInputStyle.Short).setMaxLength(256).setRequired(true).setValue(config.ticketPanelTitle),
      new TextInputBuilder().setCustomId('panel_description').setLabel('Descrição').setStyle(TextInputStyle.Paragraph).setMaxLength(3000).setRequired(true).setValue(config.ticketPanelDescription),
      new TextInputBuilder().setCustomId('panel_color').setLabel('Cor hexadecimal').setStyle(TextInputStyle.Short).setMaxLength(7).setRequired(true).setValue(config.ticketPanelColor),
      new TextInputBuilder().setCustomId('panel_banner').setLabel('URL do banner (vazio para remover)').setStyle(TextInputStyle.Short).setMaxLength(500).setRequired(false),
      new TextInputBuilder().setCustomId('panel_thumbnail').setLabel('URL da miniatura (vazio para remover)').setStyle(TextInputStyle.Short).setMaxLength(500).setRequired(false),
    ];
    if (config.ticketPanelBanner) fields[3].setValue(config.ticketPanelBanner);
    if (config.ticketPanelThumbnail) fields[4].setValue(config.ticketPanelThumbnail);
    return interaction.showModal(modal.addComponents(fields.map(field => new ActionRowBuilder().addComponents(field))));
  }
  if (action === 'toggle_link' || action === 'toggle_spam') {
    const config = guildData(interaction.guild.id);
    if (action === 'toggle_link') config.antiLink = !config.antiLink;
    else config.antiSpam = !config.antiSpam;
    save();
    return renderAdminCentral(interaction, 'protection', '✅ Proteção atualizada.');
  }
  if (action === 'limit') {
    guildData(interaction.guild.id).maxOpenTickets = Number(interaction.customId.split(':')[2]);
    save();
    return renderAdminCentral(interaction, 'limits', '✅ Limite atualizado.');
  }
}

async function handleButton(interaction) {
  if (interaction.customId.startsWith('admin:')) return handleAdminButton(interaction);
  if (interaction.customId === 'ticket:manage') {
    if (!isTicket(interaction.channel) || !staffAllowed(interaction)) return interaction.reply({ content: 'Apenas a equipe pode abrir o gerenciamento.', flags: PRIVATE });
    return interaction.reply({ ...ticketManagerPayload(interaction.channel), flags: PRIVATE });
  }
  if (interaction.customId === 'ticket:rename_button') {
    if (!isTicket(interaction.channel) || !staffAllowed(interaction)) return interaction.reply({ content: 'Sem permissão.', flags: PRIVATE });
    const field = new TextInputBuilder().setCustomId('new_name').setLabel('Novo nome do canal').setStyle(TextInputStyle.Short).setMinLength(2).setMaxLength(40).setRequired(true).setValue(interaction.channel.name);
    return interaction.showModal(new ModalBuilder().setCustomId('ticket_rename_modal').setTitle('Renomear ticket').addComponents(new ActionRowBuilder().addComponents(field)));
  }
  if (interaction.customId === 'ticket:note_button') {
    if (!isTicket(interaction.channel) || !staffAllowed(interaction)) return interaction.reply({ content: 'Sem permissão.', flags: PRIVATE });
    const field = new TextInputBuilder().setCustomId('note_text').setLabel('Nota interna').setStyle(TextInputStyle.Paragraph).setMinLength(2).setMaxLength(1000).setRequired(true);
    return interaction.showModal(new ModalBuilder().setCustomId('ticket_note_modal').setTitle('Adicionar nota interna').addComponents(new ActionRowBuilder().addComponents(field)));
  }
  if (interaction.customId === 'ticket:release_button') {
    if (!isTicket(interaction.channel) || !staffAllowed(interaction)) return interaction.reply({ content: 'Sem permissão.', flags: PRIVATE });
    const record = ticketRecord(interaction.channel);
    if (!record?.claimedBy) return interaction.reply({ content: 'Este ticket já está livre.', flags: PRIVATE });
    if (record.claimedBy !== interaction.user.id && !interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) return interaction.reply({ content: 'Somente o responsável ou um gerente pode liberar.', flags: PRIVATE });
    record.claimedBy = null;
    await interaction.channel.setTopic(ticketTopic(record));
    save();
    await interaction.channel.send(`↩️ ${interaction.user} liberou o atendimento.`);
    return interaction.reply({ content: '✅ Ticket liberado.', flags: PRIVATE });
  }
  if (interaction.customId.startsWith('ticket:rate:')) {
    const [, , ticketId, ratingText] = interaction.customId.split(':');
    const record = db.tickets[ticketId];
    if (!record || record.ownerId !== interaction.user.id) return interaction.reply({ content: 'Esta avaliação não pertence a você.' });
    if (record.rating) return interaction.reply({ content: `Você já avaliou este atendimento com **${record.rating}/5**.` });
    const rating = Number(ratingText);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return interaction.reply({ content: 'Escolha uma nota de 1 a 5 estrelas.' });
    const comment = new TextInputBuilder()
      .setCustomId('rating_comment')
      .setLabel('Comentário sobre o atendimento (opcional)')
      .setStyle(TextInputStyle.Paragraph)
      .setMaxLength(1000)
      .setRequired(false)
      .setPlaceholder('Conte como foi sua experiência com o suporte...');
    const modal = new ModalBuilder()
      .setCustomId(`ticket_rating_modal:${ticketId}:${rating}`)
      .setTitle(`${'⭐'.repeat(rating)} Avaliar atendimento`)
      .addComponents(new ActionRowBuilder().addComponents(comment));
    return interaction.showModal(modal);
  }
  if (interaction.customId === 'ticket:open') {
    const menu = new StringSelectMenuBuilder().setCustomId('ticket:type').setPlaceholder('Selecione o setor').addOptions(Object.entries(TICKET_TYPES).map(([value, type]) => new StringSelectMenuOptionBuilder().setLabel(type.label).setValue(value).setDescription(type.description).setEmoji(type.emoji)));
    return interaction.reply({ content: 'Escolha o setor do atendimento:', components: [new ActionRowBuilder().addComponents(menu)], flags: PRIVATE });
  }
  if (interaction.customId === 'ticket:close') return showTicketCloseModal(interaction);
  if (interaction.customId === 'ticket:claim') {
    if (!staffAllowed(interaction)) return interaction.reply({ content: 'Apenas a equipe pode assumir tickets.', flags: PRIVATE });
    const record = ticketRecord(interaction.channel);
    if (record?.claimedBy && record.claimedBy !== interaction.user.id && !interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) return interaction.reply({ content: `Este ticket já está com <@${record.claimedBy}>.`, flags: PRIVATE });
    if (record) {
      record.claimedBy = interaction.user.id;
      record.claimedAt ??= Date.now();
      await interaction.channel.setTopic(ticketTopic(record));
      save();
    }
    await interaction.channel.send(`🧑‍💼 ${interaction.user} assumiu este atendimento.`);
    return interaction.reply({ content: '✅ Ticket assumido.', flags: PRIVATE });
  }
  if (interaction.customId === 'ticket:transcript') {
    if (!isTicket(interaction.channel)) return interaction.reply({ content: 'Canal inválido.', flags: PRIVATE });
    await interaction.deferReply({ flags: PRIVATE });
    const transcript = await createTranscript(interaction.channel);
    return interaction.editReply({ content: `${transcript.count} mensagem(ns) exportada(s).`, files: transcript.files });
  }
  if (interaction.customId.startsWith('suggestion:')) {
    const suggestion = db.suggestions[interaction.message.id];
    if (!suggestion) return interaction.reply({ content: 'Esta votação expirou.', flags: PRIVATE });
    const choice = interaction.customId.endsWith('yes') ? 'yes' : 'no';
    const other = choice === 'yes' ? 'no' : 'yes';
    suggestion[other] = suggestion[other].filter(id => id !== interaction.user.id);
    if (suggestion[choice].includes(interaction.user.id)) suggestion[choice] = suggestion[choice].filter(id => id !== interaction.user.id);
    else suggestion[choice].push(interaction.user.id);
    save();
    await interaction.update({ components: [suggestionButtons(suggestion.yes.length, suggestion.no.length)] });
  }
}

async function handleModal(interaction) {
  if (interaction.customId.startsWith('ticket_rating_modal:')) {
    const [, ticketId, ratingText] = interaction.customId.split(':');
    const record = db.tickets[ticketId];
    const rating = Number(ratingText);
    if (!record || record.ownerId !== interaction.user.id) return interaction.reply({ content: 'Esta avaliação não pertence a você.' });
    if (record.rating) return interaction.reply({ content: `Você já avaliou este atendimento com **${record.rating}/5**.` });
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return interaction.reply({ content: 'A nota precisa estar entre 1 e 5 estrelas.' });

    const comment = interaction.fields.getTextInputValue('rating_comment').trim();
    record.rating = rating;
    record.ratingComment = comment || null;
    record.ratedAt = Date.now();

    const guild = client.guilds.cache.get(record.guildId);
    const config = guild ? guildData(guild.id) : null;
    const reviewChannel = config?.ticketReviewChannelId ? guild.channels.cache.get(config.ticketReviewChannelId) : null;
    let published = false;
    if (reviewChannel?.isTextBased()) {
      const type = ticketTypesForGuild(guild.id)[record.type];
      const attendantId = record.claimedBy || record.closedBy;
      const ratingColor = rating >= 4 ? COLORS.success : rating === 3 ? COLORS.warning : COLORS.danger;
      const card = embed('⭐ Nova avaliação do suporte', `Uma avaliação foi enviada após o encerramento do atendimento **${record.displayId || record.id}**.`, ratingColor)
        .addFields(
          { name: 'Nota', value: `${'⭐'.repeat(rating)}${'☆'.repeat(5 - rating)}  **${rating}/5**`, inline: true },
          { name: 'Setor', value: `${type?.emoji || '🎫'} ${type?.label || record.type || 'Atendimento'}`, inline: true },
          { name: 'Cliente', value: `${interaction.user} (${interaction.user.tag})` },
          { name: 'Atendido por', value: attendantId ? `<@${attendantId}>` : 'Equipe de suporte' },
          { name: 'Assunto', value: String(record.subject || 'Não informado').slice(0, 1024) },
          { name: 'Comentário', value: comment || '*Nenhum comentário informado.*' },
        )
        .setThumbnail(interaction.user.displayAvatarURL({ size: 128 }))
        .setFooter({ text: `${record.displayId || record.id} • Avaliação verificada` });
      published = await reviewChannel.send({ embeds: [card], allowedMentions: { parse: [] } }).then(() => true).catch(error => {
        log.warn('[AVALIAÇÃO] Não foi possível publicar no canal configurado:', error?.message || error);
        return false;
      });
    }
    record.reviewPublishedAt = published ? Date.now() : null;
    if (guild) recordAudit(guild.id, {
      type: 'ticket',
      title: `${record.displayId || record.id} avaliado com ${rating}/5`,
      description: comment ? `Comentário: ${comment.slice(0, 500)}` : 'Avaliação enviada sem comentário.',
      actorId: interaction.user.id,
    }, false);
    save();

    const response = {
      content: published
        ? `⭐ Obrigado! Sua avaliação de **${rating}/5** foi enviada para a equipe.`
        : `⭐ Obrigado! Sua avaliação de **${rating}/5** foi registrada.`,
      components: [],
    };
    if (interaction.isFromMessage()) return interaction.update(response);
    return interaction.reply(response);
  }
  if (interaction.customId === 'admin_panel_modal') {
    if (!interaction.inGuild() || !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return interaction.reply({ content: 'Sem permissão.', flags: PRIVATE });
    const title = interaction.fields.getTextInputValue('panel_title').trim();
    const description = interaction.fields.getTextInputValue('panel_description').trim();
    const color = interaction.fields.getTextInputValue('panel_color').trim().toUpperCase();
    const bannerValue = interaction.fields.getTextInputValue('panel_banner').trim();
    const thumbnailValue = interaction.fields.getTextInputValue('panel_thumbnail').trim();
    if (!/^#[0-9A-F]{6}$/.test(color)) return interaction.reply({ content: 'A cor precisa estar no formato `#5865F2`.', flags: PRIVATE });
    if (bannerValue && !safeUrl(bannerValue)) return interaction.reply({ content: 'A URL do banner é inválida.', flags: PRIVATE });
    if (thumbnailValue && !safeUrl(thumbnailValue)) return interaction.reply({ content: 'A URL da miniatura é inválida.', flags: PRIVATE });
    const config = guildData(interaction.guild.id);
    config.ticketPanelTitle = title;
    config.ticketPanelDescription = description;
    config.ticketPanelColor = color;
    config.ticketPanelBanner = bannerValue ? safeUrl(bannerValue) : null;
    config.ticketPanelThumbnail = thumbnailValue ? safeUrl(thumbnailValue) : null;
    save();
    return interaction.reply({ ...adminCentralPayload(interaction.guild, 'main', '✅ Aparência salva. Clique em **Publicar painel** para enviar a nova versão.'), flags: PRIVATE });
  }
  if (interaction.customId === 'ticket_rename_modal') {
    if (!isTicket(interaction.channel) || !staffAllowed(interaction)) return interaction.reply({ content: 'Sem permissão.', flags: PRIVATE });
    const name = safeChannelName(interaction.fields.getTextInputValue('new_name'));
    await interaction.channel.setName(name, `Renomeado por ${interaction.user.tag}`);
    return interaction.reply({ content: `✅ Canal renomeado para **${name}**.`, flags: PRIVATE });
  }
  if (interaction.customId === 'ticket_note_modal') {
    if (!isTicket(interaction.channel) || !staffAllowed(interaction)) return interaction.reply({ content: 'Sem permissão.', flags: PRIVATE });
    const record = ticketRecord(interaction.channel);
    if (!record) return interaction.reply({ content: 'Registro não encontrado.', flags: PRIVATE });
    const text = interaction.fields.getTextInputValue('note_text');
    record.notes ??= [];
    record.notes.push({ authorId: interaction.user.id, text, createdAt: Date.now() });
    save();
    await sendLog(interaction.guild, `📝 Nota interna • ${record.displayId}`, `Por ${interaction.user}:\n${text}`, COLORS.warning);
    return interaction.reply({ content: '✅ Nota registrada somente nos logs.', flags: PRIVATE });
  }
  if (interaction.customId.startsWith('speak_modal:')) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return interaction.reply({ content: 'Sem permissão.', flags: PRIVATE });
    const channelId = interaction.customId.split(':')[1];
    const channel = interaction.guild.channels.cache.get(channelId);
    if (!channel?.isTextBased()) return interaction.reply({ content: 'Canal indisponível.', flags: PRIVATE });
    const title = interaction.fields.getTextInputValue('title').trim();
    const message = interaction.fields.getTextInputValue('message');
    const colorInput = interaction.fields.getTextInputValue('color').trim();
    const imageInput = interaction.fields.getTextInputValue('image').trim();
    const footerInput = interaction.fields.getTextInputValue('footer').trim();
    log.info(`[FALAR] user=${interaction.user.tag} canal=${channel.name} titulo="${title}" cor="${colorInput}" imagem="${imageInput}"`);
    const resolvedImage = safeUrl(imageInput);
    if (imageInput && !resolvedImage) log.warn(`[FALAR] URL de imagem rejeitada: "${imageInput}"`);
    let payload;
    if (title) {
      const resolvedColor = /^#[0-9a-f]{6}$/i.test(colorInput)
        ? Number.parseInt(colorInput.slice(1), 16)
        : COLORS.primary;
      const embedObj = new EmbedBuilder()
        .setTitle(title)
        .setDescription(message)
        .setColor(resolvedColor)
        .setTimestamp();
      const resolvedImage = safeUrl(imageInput);
      if (resolvedImage) {
        // GIFs do Tenor precisam de URL direta (.gif) — tenta extrair se for link de página
        const isGifPage = /tenor\.com\/view|giphy\.com\/gifs/.test(resolvedImage);
        if (!isGifPage) embedObj.setImage(resolvedImage);
        else embedObj.setDescription(`${message}\n${resolvedImage}`); // fallback: coloca o link no texto
      }
      if (footerInput) embedObj.setFooter({ text: footerInput });
      payload = { embeds: [embedObj] };
    } else if (safeUrl(imageInput)) {
      // sem título mas tem imagem: manda como embed simples só com imagem
      payload = { embeds: [new EmbedBuilder().setDescription(message).setImage(safeUrl(imageInput)).setColor(COLORS.primary)] };
    } else {
      payload = { content: message };
    }
    await channel.send({ ...payload, allowedMentions: { parse: [] } });
    await sendLog(interaction.guild, '🗣️ Publicação administrativa', `${interaction.user} publicou em ${channel}:\n${message.slice(0, 1000)}`);
    return interaction.reply({ content: `✅ Mensagem publicada em ${channel}.`, flags: PRIVATE });
  }
  if (interaction.customId.startsWith('ticket_close_modal:')) {
    if (!isTicket(interaction.channel)) return interaction.reply({ content: 'Este canal não é um ticket.', flags: PRIVATE });
    const ownerId = ticketOwnerId(interaction.channel);
    if (interaction.user.id !== ownerId && !staffAllowed(interaction)) return interaction.reply({ content: 'Você não pode finalizar este ticket.', flags: PRIVATE });
    await interaction.deferReply();
    return finalizeTicketClose(interaction, interaction.fields.getTextInputValue('close_reason'), interaction.fields.getTextInputValue('resolution').trim());
  }
  if (interaction.customId.startsWith('ticket_modal:')) {
    await interaction.deferReply({ flags: PRIVATE });
    const typeId = interaction.customId.split(':')[1];
    const config = guildData(interaction.guild.id);
    const type = ticketTypesForGuild(interaction.guild.id)[typeId];
    if (!type) return interaction.editReply('Setor inválido. Atualize o painel de tickets e tente novamente.');
    const supportRoleId = ticketSupportRoleId(config, type);
    if (!config.ticketCategoryId || !supportRoleId || !interaction.guild.roles.cache.has(supportRoleId)) return interaction.editReply('A categoria ou o cargo responsável por este setor não foi configurado.');
    const openTickets = Object.values(db.tickets).filter(ticket => ticket.guildId === interaction.guild.id && ticket.ownerId === interaction.user.id && ticket.status === 'open');
    const existing = openTickets.find(ticket => ticket.type === typeId);
    if (existing) return interaction.editReply(`Você já possui um ticket de **${type.label}**: <#${existing.channelId}>`);
    if (openTickets.length >= config.maxOpenTickets) return interaction.editReply(`Você atingiu o limite de ${config.maxOpenTickets} ticket(s) aberto(s).`);
    const subject = interaction.fields.getTextInputValue('subject');
    const reason = interaction.fields.getTextInputValue('reason');
    config.ticketCounter += 1;
    const id = `${interaction.guild.id}-${config.ticketCounter}`;
    const displayId = `T-${String(config.ticketCounter).padStart(5, '0')}`;
    const record = {
      id, displayId, guildId: interaction.guild.id, channelId: null, ownerId: interaction.user.id,
      type: typeId, priority: type.priority, supportRoleId, subject, reason, status: 'open', claimedBy: null,
      openedAt: Date.now(), claimedAt: null, firstResponseAt: null, closedAt: null,
      closedBy: null, closeReason: null, resolution: null, rating: null, notes: [],
    };
    const channel = await interaction.guild.channels.create({
      name: safeChannelName(`${typeId}-${interaction.user.username}-${config.ticketCounter}`),
      type: ChannelType.GuildText,
      parent: config.ticketCategoryId,
      topic: ticketTopic(record),
      permissionOverwrites: [
        { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] },
        { id: supportRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages] },
        { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageMessages] },
      ],
    });
    record.channelId = channel.id;
    db.tickets[id] = record;
    save();
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket:claim').setLabel('Assumir').setEmoji('🙋').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('ticket:manage').setLabel('Gerenciar').setEmoji('🧰').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('ticket:transcript').setLabel('Transcrição').setEmoji('📄').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('ticket:close').setLabel('Finalizar').setEmoji('🔒').setStyle(ButtonStyle.Danger),
    );
    const priorityIcon = { baixa: '🟢', normal: '🟡', alta: '🟠', urgente: '🔴' }[record.priority];
    const card = embed(`${type.emoji} ${type.label} • ${displayId}`, `Olá ${interaction.user}, seu atendimento foi criado. Explique informações adicionais abaixo e aguarde a equipe.`)
      .addFields(
        { name: 'Assunto', value: subject },
        { name: 'Descrição', value: reason },
        { name: 'Informações', value: `**Prioridade:** ${priorityIcon} ${record.priority}\n**Status:** 🔵 Aguardando atendente\n**Responsável:** ninguém` },
      ).setFooter({ text: 'Use os botões abaixo ou /ticket para gerenciar' });
    await channel.send({ content: `${interaction.user} <@&${supportRoleId}>`, embeds: [card], components: [row], allowedMentions: { users: [interaction.user.id], roles: [supportRoleId] } });
    await sendLog(interaction.guild, `🎫 ${displayId} aberto`, `${interaction.user} abriu ${channel}.\nSetor: ${type.label}\nAssunto: ${subject}`);
    return interaction.editReply(`✅ Atendimento criado: ${channel}`);
  }
}

async function finalizeTicketClose(interaction, reason, resolution) {
  const ownerId = ticketOwnerId(interaction.channel);
  let record = ticketRecord(interaction.channel);
  if (!record) {
    const id = interaction.channel.id;
    record = { id, displayId: `LEGADO-${id}`, guildId: interaction.guild.id, channelId: interaction.channel.id, ownerId, type: 'outros', priority: 'normal', subject: 'Ticket legado', status: 'open', openedAt: interaction.channel.createdTimestamp, claimedBy: null, notes: [] };
    db.tickets[id] = record;
  }
  await interaction.channel.permissionOverwrites.edit(ownerId, { SendMessages: false }).catch(() => {});
  await interaction.channel.setName(safeChannelName(`fechado-${interaction.channel.name}`)).catch(() => {});
  const transcript = await createTranscript(interaction.channel);
  record.status = 'closed';
  record.closedAt = Date.now();
  record.closedBy = interaction.user.id;
  record.closeReason = reason;
  record.resolution = resolution || null;
  record.messageCount = transcript.count;
  save();
  const typeLabel = ticketTypesForGuild(interaction.guild.id)[record.type]?.label || record.type;
  await sendLog(interaction.guild, `🔒 ${record.displayId} finalizado`, `Criador: <@${ownerId}>\nFinalizado por: ${interaction.user}\nSetor: ${typeLabel}\nMotivo: ${reason}\nSolução: ${resolution || 'não informada'}\nMensagens: ${transcript.count}`, COLORS.danger, transcript.files);
  const ratingRow = new ActionRowBuilder().addComponents([1, 2, 3, 4, 5].map(value => new ButtonBuilder().setCustomId(`ticket:rate:${record.id}:${value}`).setLabel(String(value)).setEmoji('⭐').setStyle(value === 5 ? ButtonStyle.Success : ButtonStyle.Secondary)));
  const owner = await client.users.fetch(ownerId).catch(() => null);
  if (owner) {
    const dmFiles = transcript.files.map(file => new AttachmentBuilder(file.attachment, { name: file.name }));
    await owner.send({ content: `Seu atendimento **${record.displayId}** em **${interaction.guild.name}** foi finalizado.\n**Motivo:** ${reason}\n${resolution ? `**Solução:** ${resolution}\n` : ''}Escolha de **1 a 5 estrelas**. Depois, você poderá escrever um comentário opcional:`, components: [ratingRow], files: dmFiles }).catch(() => {});
  }
  await interaction.editReply('🔒 Atendimento finalizado, transcrição salva e avaliação enviada ao usuário. Este canal será excluído em 10 segundos.');
  setTimeout(() => interaction.channel.delete(`Ticket ${record.displayId} finalizado por ${interaction.user.tag}`).catch(() => {}), 10_000);
}

client.on(Events.GuildMemberAdd, async member => {
  const config = guildData(member.guild.id);
  const role = member.guild.roles.cache.get(config.autoRoleId);
  if (role && role.editable) await member.roles.add(role, 'Cargo automático').catch(() => {});
  const channel = member.guild.channels.cache.get(config.welcomeChannelId);
  if (channel?.isTextBased()) {
    const card = embed('👋 Bem-vindo(a)!', `${member}, você é o membro **${member.guild.memberCount}** de **${member.guild.name}**.`, COLORS.success).setThumbnail(member.user.displayAvatarURL({ size: 256 }));
    await channel.send({ content: `${member}`, embeds: [card], allowedMentions: { users: [member.id] } }).catch(() => {});
  }
  await sendLog(member.guild, '📥 Membro entrou', `${member} (${member.user.tag}) entrou.`, COLORS.success);
});

client.on(Events.GuildMemberRemove, async member => {
  const channel = member.guild.channels.cache.get(guildData(member.guild.id).leaveChannelId);
  if (channel?.isTextBased()) await channel.send({ embeds: [embed('👋 Membro saiu', `**${member.user.tag}** saiu do servidor.`, COLORS.danger)] }).catch(() => {});
  await sendLog(member.guild, '📤 Membro saiu', `${member.user.tag} (${member.id}) saiu.`, COLORS.danger);
});

async function temporaryModerationNotice(message, text, lifetime = 8000) {
  if (!text) return;
  const notice = await message.channel.send({
    content: `${message.author} ${text}`,
    allowedMentions: { users: [message.author.id] },
  }).catch(() => null);
  if (notice) setTimeout(() => notice.delete().catch(() => {}), lifetime);
}

function isProtectionExempt(message, config) {
  if (message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return true;
  if ((config.swearExemptChannelIds || []).includes(message.channel.id)) return true;
  return (config.swearExemptRoleIds || []).some(roleId => message.member.roles.cache.has(roleId));
}

async function applyBlockedContentFilter(message, config) {
  if (!config.antiSwear || !config.swearWords?.length || isProtectionExempt(message, config)) return false;
  const match = detectBlockedTerm(message.content, config.swearWords);
  if (!match) return false;

  await message.delete().catch(() => {});
  const action = ['delete', 'warn', 'timeout'].includes(config.swearAction) ? config.swearAction : 'timeout';
  const limit = Math.max(1, Number(config.swearWarnCount) || 3);
  const muteMinutes = Math.max(1, Number(config.swearMuteDuration) || 30);
  const now = Date.now();
  let activeWarnings = 0;

  if (action !== 'delete') {
    const warnings = warningsFor(message.guild.id, message.author.id);
    const windowStart = now - Math.max(1, Number(config.swearWarnWindowHours) || 24) * 3_600_000;
    const lastTimeoutAt = warnings.filter(warning => warning.autoFilterTimeout).reduce((latest, warning) => Math.max(latest, warning.createdAt || 0), 0);
    const warning = {
      caseId: nextCase(message.guild.id),
      moderatorId: message.client.user.id,
      reason: 'Filtro automático de conteúdo bloqueado',
      createdAt: now,
      auto: true,
      autoFilter: true,
    };
    warnings.push(warning);
    activeWarnings = warnings.filter(item => item.autoFilter && item.createdAt >= windowStart && item.createdAt > lastTimeoutAt).length;
    if (action === 'timeout' && activeWarnings >= limit && message.member.moderatable) {
      warning.autoFilterTimeout = true;
      await message.member.timeout(muteMinutes * 60_000, 'Filtro automático: limite de avisos').catch(() => {});
    }
    save();
  }

  const customNotice = String(config.swearNotice || 'Sua mensagem foi removida por conter conteúdo bloqueado.').slice(0, 180);
  if (action === 'timeout' && activeWarnings >= limit && message.member.moderatable) {
    await temporaryModerationNotice(message, `🔇 ${customNotice} Você recebeu timeout de **${muteMinutes} min**.`);
    await sendLog(message.guild, '🔇 Timeout • filtro de conteúdo', `${message.author} atingiu ${limit} avisos e recebeu timeout de ${muteMinutes} min em ${message.channel}.`, COLORS.danger);
  } else {
    const progress = action === 'delete' ? '' : action === 'warn' ? ` Aviso **${activeWarnings}**.` : ` Aviso **${activeWarnings}/${limit}**.`;
    await temporaryModerationNotice(message, `⚠️ ${customNotice}${progress}`);
    await sendLog(message.guild, '🛡️ Conteúdo bloqueado', `${message.author} teve uma mensagem removida em ${message.channel}. Regra: ${match.term}.`, COLORS.warning);
  }
  return true;
}

async function runAutomaticProtections(message, { trackSpam = true } = {}) {
  if (!message.guild || message.author?.bot || !message.member || !message.content) return false;
  const config = guildData(message.guild.id);
  if (message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return false;

  if (await applyBlockedContentFilter(message, config)) return true;

  const blockedLink = config.antiLink ? findBlockedLink(message.content, config.allowedLinkDomains) : null;
  if (blockedLink) {
    await message.delete().catch(() => {});
    await temporaryModerationNotice(message, 'links não autorizados não são permitidos aqui.', 5000);
    await sendLog(message.guild, '🔗 Link bloqueado', `Autor: ${message.author}\nCanal: ${message.channel}\nLink: ${blockedLink}`, COLORS.warning);
    return true;
  }

  if (config.antiSpam && trackSpam) {
    const key = `${message.guild.id}:${message.author.id}`;
    const now = Date.now();
    const windowSeconds = Math.max(3, Number(config.spamWindowSeconds) || 8);
    const timestamps = (spamTracker.get(key) || []).filter(time => now - time < windowSeconds * 1000);
    timestamps.push(now);
    spamTracker.set(key, timestamps);
    if (timestamps.length >= config.spamLimit) {
      const muteMinutes = Math.max(1, Number(config.spamMuteDuration) || 5);
      spamTracker.delete(key);
      await message.delete().catch(() => {});
      if (message.member.moderatable) await message.member.timeout(muteMinutes * 60_000, 'Anti-spam automático').catch(() => {});
      await sendLog(message.guild, '🚨 Anti-spam acionado', `${message.author} excedeu ${config.spamLimit} mensagens em ${windowSeconds} segundos em ${message.channel} e recebeu timeout de ${muteMinutes} min.`, COLORS.danger);
      return true;
    }
  }
  return false;
}

client.on(Events.MessageCreate, async message => {
  if (!message.guild || message.author.bot || !message.member) return;
  const config = guildData(message.guild.id);
  if (isTicket(message.channel)) {
    const record = ticketRecord(message.channel);
    const type = record ? ticketTypesForGuild(message.guild.id)[record.type] : null;
    const supportRoleId = ticketSupportRoleId(config, type, record);
    const isStaff = message.member.permissions.has(PermissionFlagsBits.ManageChannels) || (supportRoleId && message.member.roles.cache.has(supportRoleId));
    if (record && isStaff && message.author.id !== record.ownerId && !record.firstResponseAt) {
      record.firstResponseAt = Date.now();
      save();
    }
  }
  await runAutomaticProtections(message);
});

client.on(Events.MessageDelete, message => {
  if (!message.guild || message.author?.bot) return;
  sendLog(message.guild, '🗑️ Mensagem apagada', `Autor: ${message.author || 'desconhecido'}\nCanal: ${message.channel}\nConteúdo: ${message.content?.slice(0, 1000) || '*indisponível*'}`, COLORS.warning);
});

client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
  if (!oldMessage.guild || oldMessage.author?.bot || oldMessage.content === newMessage.content) return;
  const completeMessage = newMessage.partial ? await newMessage.fetch().catch(() => null) : newMessage;
  if (completeMessage && await runAutomaticProtections(completeMessage, { trackSpam: false })) return;
  await sendLog(oldMessage.guild, '✏️ Mensagem editada', `Autor: ${oldMessage.author}\nCanal: ${oldMessage.channel}\nAntes: ${oldMessage.content?.slice(0, 450) || '*indisponível*'}\nDepois: ${newMessage.content?.slice(0, 450) || '*indisponível*'}`);
});

client.on(Events.GuildDelete, guild => deleteGuild(guild.id));
client.on(Events.Error, error => log.error('[CLIENT ERROR]', error?.message || error));
client.on(Events.Warn, warning => log.warn('[CLIENT WARN]', warning));

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));
installDashboard(app, {
  client, db, guildData, save, auditFor, recordAudit, ticketTypes: TICKET_TYPES,
  publishTicketPanel: async (guild, channel) => channel.send(ticketPanelPayload(guild)),
  buildTicketTopic: ticketTopic,
});
app.get('/', (_req, res) => res.redirect('/dashboard'));
app.get('/health', (_req, res) => res.json({ ok: client.isReady(), ping: client.ws.ping, uptime: process.uptime(), guilds: client.guilds.cache.size, dashboard: true }));
app.get('/logs/bot', async (req, res) => {
  try {
    const text = fs.existsSync(LOG_FILE) ? fs.readFileSync(LOG_FILE, 'utf8') : '(sem logs ainda)';
    const lines = text.trim().split('\n').slice(-300).reverse().join('\n');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Bot Logs</title><meta http-equiv="refresh" content="10"><style>body{margin:0;background:#0d1117;color:#c9d1d9;font:13px/1.6 monospace;padding:20px}h1{color:#58a6ff;margin:0 0 16px}pre{white-space:pre-wrap;word-break:break-all}.error{color:#ff7b72}.warn{color:#e3b341}.info{color:#7ee787}small{color:#8b949e}</style></head><body><h1>🪵 Bot Logs <small>(últimas 300 linhas — atualiza a cada 10s)</small></h1><pre>${lines.replace(/\[ERROR\]/g,'<span class="error">[ERROR]</span>').replace(/\[WARN\]/g,'<span class="warn">[WARN]</span>').replace(/\[INFO\]/g,'<span class="info">[INFO]</span>')}</pre></body></html>`);
  } catch (error) {
    res.status(500).send('Erro ao ler o arquivo de log.');
  }
});
const server = app.listen(process.env.PORT || 8000, '0.0.0.0', () => log.info(`🌐 Bot e dashboard na porta ${process.env.PORT || 8000}.`));

async function shutdown(signal) {
  console.log(`\n${signal}: encerrando com segurança...`);
  server.close();
  client.destroy();
  await closeDatabase();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', error => log.error('[UNHANDLED REJECTION]', error?.message || error, error?.stack || ''));
process.on('uncaughtException', error => { log.error('[UNCAUGHT EXCEPTION]', error?.message || error, error?.stack || ''); process.exit(1); });

client.login(process.env.DISCORD_TOKEN);
