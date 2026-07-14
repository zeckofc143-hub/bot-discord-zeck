const state = {
  me: null,
  guilds: [],
  guildId: null,
  data: null,
  page: 'overview',
};

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

const pageTitles = {
  overview: 'Visão geral',
  tickets: 'Tickets',
  appearance: 'Aparência',
  protections: 'Proteções',
  community: 'Comunidade',
  logs: 'Logs',
};

const statusMeta = {
  open: { label: 'Aberto', className: 'badge-status-open' },
  awaiting: { label: 'Aguardando', className: 'badge-status-awaiting' },
  in_progress: { label: 'Em andamento', className: 'badge-status-in_progress' },
  resolved: { label: 'Resolvido', className: 'badge-status-resolved' },
};

const categoryClass = {
  suporte: 'badge-support',
  denuncia: 'badge-moderation',
  parceria: 'badge-suggestion',
  compras: 'badge-commerce',
  outros: 'badge-other',
};

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function initials(name = '?') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase() || '?';
}

function setAvatar(element, url, name) {
  if (!element) return;
  element.textContent = url ? '' : initials(name);
  element.style.backgroundImage = url ? `url("${String(url).replaceAll('"', '')}")` : '';
}

function avatarMarkup(user, size = 'small') {
  const name = user?.displayName || user?.username || 'Usuário';
  const style = user?.avatar ? ` style="background-image:url('${escapeHtml(user.avatar)}')"` : '';
  return `<span class="avatar avatar-${size}"${style}>${user?.avatar ? '' : escapeHtml(initials(name))}</span>`;
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  let payload = null;
  try { payload = await response.json(); } catch { payload = null; }
  if (response.status === 401) {
    showAuth();
    throw new Error('AUTH_REQUIRED');
  }
  if (!response.ok) {
    const error = new Error(payload?.error || `HTTP_${response.status}`);
    error.payload = payload;
    throw error;
  }
  return payload;
}

function toast(message, type = 'success') {
  const node = document.createElement('div');
  node.className = `toast ${type}`;
  node.innerHTML = `<span>${type === 'success' ? '✓' : '!'}</span><span>${escapeHtml(message)}</span>`;
  $('#toast-region').append(node);
  setTimeout(() => node.remove(), 3600);
}

function formatRelative(timestamp) {
  if (!timestamp) return '—';
  const delta = Date.now() - timestamp;
  const seconds = Math.floor(delta / 1000);
  if (seconds < 60) return 'agora';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min atrás`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h atrás`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} d atrás`;
  return new Date(timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function formatDate(timestamp) {
  if (!timestamp) return '—';
  return new Date(timestamp).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function formatUptime(seconds) {
  if (!Number.isFinite(seconds)) return '—';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${days}d ${hours}h ${minutes}m`;
}

function categoryBadge(ticket) {
  return `<span class="badge ${categoryClass[ticket.type] || 'badge-other'}">${escapeHtml(ticket.category)}</span>`;
}

function statusBadge(status) {
  const meta = statusMeta[status] || statusMeta.open;
  return `<span class="badge ${meta.className}">${meta.label}</span>`;
}

function priorityOptions(ticket) {
  return ['baixa', 'normal', 'alta', 'urgente'].map(priority => `<option value="${priority}" ${ticket.priority === priority ? 'selected' : ''}>${priority[0].toUpperCase()}${priority.slice(1)}</option>`).join('');
}

function showAuth() {
  $('#app').classList.add('hidden');
  $('#auth-screen').classList.remove('hidden');
}

function showApp() {
  $('#auth-screen').classList.add('hidden');
  $('#app').classList.remove('hidden');
}

async function configureAuthScreen() {
  const params = new URLSearchParams(location.search);
  const config = await api('/api/public/config').catch(() => null);
  const help = $('#auth-help');
  if (params.get('setup') === 'oauth' || (config && !config.authConfigured && !config.demoMode)) {
    $('#auth-description').textContent = 'O dashboard está instalado, mas o login do Discord ainda precisa ser configurado no arquivo .env.';
    $('#login-button').classList.add('hidden');
    help.classList.remove('hidden');
    help.innerHTML = 'Preencha <strong>DISCORD_CLIENT_ID</strong>, <strong>DISCORD_CLIENT_SECRET</strong>, <strong>DASHBOARD_URL</strong> e <strong>SESSION_SECRET</strong>. Depois adicione a URL de callback mostrada no README ao Discord Developer Portal.';
  }
  const error = params.get('error');
  if (error) {
    help.classList.remove('hidden');
    help.textContent = error === 'denied' ? 'A autorização foi cancelada.' : 'Não foi possível concluir o login. Confira a URL de redirecionamento e tente novamente.';
  }
}

async function init() {
  await configureAuthScreen();
  try {
    state.me = await api('/api/me');
    state.guilds = await api('/api/guilds');
  } catch (error) {
    if (error.message !== 'AUTH_REQUIRED') console.error(error);
    showAuth();
    return;
  }

  if (!state.guilds.length) {
    showAuth();
    $('#auth-description').textContent = 'Você não possui servidores administráveis onde o bot esteja instalado.';
    $('#login-button').textContent = 'Entrar com outra conta';
    return;
  }

  const rememberedGuild = localStorage.getItem('luckers_guild');
  state.guildId = state.guilds.some(guild => guild.id === rememberedGuild) ? rememberedGuild : state.guilds[0].id;
  renderIdentity();
  renderGuildSelect();
  bindEvents();
  showApp();
  await loadDashboard();
  setInterval(() => {
    if (!document.hidden && ['overview', 'tickets', 'logs'].includes(state.page)) loadDashboard({ quiet: true });
  }, 30_000);
}

function renderIdentity() {
  $('#user-name').textContent = state.me.displayName;
  setAvatar($('#user-avatar'), state.me.avatar, state.me.displayName);
  if (state.me.demo) toast('Dashboard em modo de demonstração local.', 'success');
}

function renderGuildSelect() {
  const select = $('#guild-select');
  select.innerHTML = state.guilds.map(guild => `<option value="${guild.id}" ${guild.id === state.guildId ? 'selected' : ''}>${escapeHtml(guild.name)}</option>`).join('');
  updateGuildHeader();
}

function updateGuildHeader() {
  const guild = state.guilds.find(item => item.id === state.guildId);
  if (!guild) return;
  setAvatar($('#guild-icon'), guild.icon, guild.name);
}

async function loadDashboard({ quiet = false } = {}) {
  if (!quiet) {
    $('#loading').classList.remove('hidden');
    $('#content').classList.add('hidden');
  }
  try {
    state.data = await api(`/api/dashboard/${state.guildId}`);
    applyAccent(state.data.config.dashboardAccent || '#6C63FF');
    renderAll();
    $('#loading').classList.add('hidden');
    $('#content').classList.remove('hidden');
  } catch (error) {
    if (error.message !== 'AUTH_REQUIRED') {
      console.error(error);
      toast('Não foi possível carregar os dados do servidor.', 'error');
    }
  }
}

function applyAccent(color) {
  document.documentElement.style.setProperty('--accent', color);
  $('#preview-embed')?.style.setProperty('border-left-color', color);
}

function renderAll() {
  const data = state.data;
  $('#brand-name').textContent = data.bot.name;
  $('#bot-status-text').textContent = data.bot.online ? 'Bot online' : 'Bot offline';
  $('#bot-status-dot').style.background = data.bot.online ? 'var(--green)' : 'var(--red)';
  $('#bot-uptime').textContent = `Uptime: ${formatUptime(data.bot.uptime)}`;
  $('#nav-ticket-count').textContent = data.stats.open;
  renderStats();
  renderChart();
  renderRecentTickets();
  renderOverviewTable();
  renderTicketsPage();
  renderAppearance();
  renderProtections();
  renderResources();
  renderAudits();
}

function renderStats() {
  const stats = state.data.stats;
  const cards = [
    {
      label: 'Tickets abertos', value: stats.open, delta: stats.openDelta, deltaText: 'em relação a ontem', goodWhenPositive: false,
      icon: '<svg viewBox="0 0 24 24"><path d="M5 6h14v12H5zM8 10h8M8 14h5"/></svg>',
      ghost: '<svg viewBox="0 0 24 24"><path d="M4 7h16v4a3 3 0 0 0 0 6v1H4v-1a3 3 0 0 0 0-6z"/></svg>',
    },
    {
      label: 'Tempo de resposta', value: stats.averageResponse, delta: -stats.responseDelta, deltaText: 'comparado à semana anterior', goodWhenPositive: true,
      icon: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/></svg>',
      ghost: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/></svg>',
    },
    {
      label: 'Satisfação', value: stats.satisfaction == null ? '—' : `${stats.satisfaction}%`, delta: stats.satisfactionDelta, deltaText: 'comparado ao mês anterior', goodWhenPositive: true,
      icon: '<svg viewBox="0 0 24 24"><path d="m12 4 2.3 4.7 5.2.8-3.8 3.7.9 5.2-4.6-2.5-4.6 2.5.9-5.2-3.8-3.7 5.2-.8z"/></svg>',
      ghost: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/></svg>',
    },
    {
      label: 'Membros do servidor', value: state.data.guild.memberCount.toLocaleString('pt-BR'), delta: 0, deltaText: `${stats.total} tickets registrados`, goodWhenPositive: true,
      icon: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2"/><path d="M4 20v-2a5 5 0 0 1 10 0v2M15 16a4 4 0 0 1 5 4"/></svg>',
      ghost: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2"/><path d="M4 20v-2a5 5 0 0 1 10 0v2M15 16a4 4 0 0 1 5 4"/></svg>',
    },
  ];

  $('#stats-grid').innerHTML = cards.map(card => {
    const isPositive = card.delta > 0;
    const isGood = card.delta === 0 || (isPositive === card.goodWhenPositive);
    const sign = card.delta > 0 ? '+' : '';
    const arrow = card.delta > 0 ? '↑' : card.delta < 0 ? '↓' : '•';
    return `<article class="stat-card">
      <div class="stat-icon">${card.icon}</div>
      <div class="stat-copy"><span>${card.label}</span><strong>${card.value}</strong></div>
      <div class="stat-ghost">${card.ghost}</div>
      <div class="stat-delta ${isGood ? 'positive' : 'negative'}"><b>${arrow} ${sign}${card.delta}${typeof card.delta === 'number' && card.label !== 'Tickets abertos' ? '%' : ''}</b><span>${card.deltaText}</span></div>
    </article>`;
  }).join('');
}

function renderChart() {
  const activity = state.data.activity;
  const width = 720;
  const height = 250;
  const pad = { top: 24, right: 18, bottom: 36, left: 34 };
  const max = Math.max(5, ...activity.map(item => item.value));
  const ceiling = Math.ceil(max / 5) * 5;
  const xStep = (width - pad.left - pad.right) / Math.max(1, activity.length - 1);
  const y = value => pad.top + (height - pad.top - pad.bottom) * (1 - value / ceiling);
  const points = activity.map((item, index) => ({ x: pad.left + index * xStep, y: y(item.value), ...item }));
  const linePath = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
  const areaPath = `${linePath} L ${points.at(-1).x} ${height - pad.bottom} L ${points[0].x} ${height - pad.bottom} Z`;
  const gridValues = [0, .25, .5, .75, 1].map(ratio => Math.round(ceiling * ratio));

  $('#activity-chart').innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Tickets abertos nos últimos sete dias">
    <defs><linearGradient id="ticketGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".62"/><stop offset="1" stop-color="var(--accent)" stop-opacity=".04"/></linearGradient></defs>
    ${gridValues.map(value => `<line class="chart-grid" x1="${pad.left}" y1="${y(value)}" x2="${width - pad.right}" y2="${y(value)}"/><text class="chart-axis-label" x="2" y="${y(value) + 4}">${value}</text>`).join('')}
    <path class="chart-area" d="${areaPath}"/>
    <path class="chart-line" d="${linePath}"/>
    ${points.map(point => `<circle class="chart-point" cx="${point.x}" cy="${point.y}" r="4"/><rect class="chart-hit" x="${point.x - xStep / 2}" y="0" width="${xStep}" height="${height - pad.bottom}"/><g class="chart-tooltip"><rect x="${point.x - 24}" y="${Math.max(2, point.y - 34)}" width="48" height="24" rx="6" fill="#18263a" stroke="rgba(255,255,255,.15)"/><text x="${point.x}" y="${Math.max(18, point.y - 18)}" text-anchor="middle" fill="#fff" font-size="10">${point.value}</text></g>`).join('')}
    ${points.map(point => `<text class="chart-axis-label" x="${point.x}" y="${height - 10}" text-anchor="middle">${escapeHtml(point.label)}</text>`).join('')}
  </svg>`;
}

function renderRecentTickets() {
  const tickets = state.data.recentTickets;
  if (!tickets.length) {
    $('#recent-ticket-list').innerHTML = '<div class="empty-mini">Ainda não existem tickets.</div>';
    return;
  }
  $('#recent-ticket-list').innerHTML = tickets.map(ticket => `<div class="recent-ticket-item">
    ${avatarMarkup(ticket.owner)}
    <div class="ticket-main"><strong>${escapeHtml(ticket.subject)}</strong><small>${escapeHtml(ticket.displayId)}</small></div>
    ${statusBadge(ticket.status)}
    <span class="ticket-time">${formatRelative(ticket.openedAt)}</span>
  </div>`).join('');
}

function overviewRow(ticket) {
  return `<tr>
    <td><div class="ticket-cell">${avatarMarkup(ticket.owner)}<div class="ticket-cell-copy"><strong>${escapeHtml(ticket.subject)}</strong><small>${escapeHtml(ticket.displayId)}</small></div></div></td>
    <td>${categoryBadge(ticket)}</td>
    <td>${statusBadge(ticket.status)}</td>
    <td>${ticket.assignee ? `<div class="assignee-cell">${avatarMarkup(ticket.assignee, 'tiny')}<span>${escapeHtml(ticket.assignee.displayName)}</span></div>` : '<span class="muted">Não atribuído</span>'}</td>
    <td><span class="priority priority-${ticket.priority}">● ${escapeHtml(ticket.priority)}</span></td>
    <td>${formatRelative(ticket.openedAt)}</td>
    <td>${ticket.discordUrl ? `<a class="icon-link" href="${escapeHtml(ticket.discordUrl)}" target="_blank" rel="noreferrer">↗</a>` : '—'}</td>
  </tr>`;
}

function renderOverviewTable() {
  const tickets = state.data.tickets.slice(0, 8);
  $('#overview-ticket-table').innerHTML = tickets.length ? tickets.map(overviewRow).join('') : '<tr><td colspan="7" class="empty-state">Nenhum ticket registrado.</td></tr>';
}

function renderTicketsPage() {
  const categoryFilter = $('#ticket-category-filter');
  const current = categoryFilter.value || 'all';
  categoryFilter.innerHTML = '<option value="all">Todas categorias</option>' + state.data.categories.map(category => `<option value="${category.id}">${escapeHtml(category.label)}</option>`).join('');
  categoryFilter.value = [...categoryFilter.options].some(option => option.value === current) ? current : 'all';

  const counts = {
    total: state.data.tickets.length,
    open: state.data.tickets.filter(ticket => ticket.status === 'open').length,
    progress: state.data.tickets.filter(ticket => ticket.status === 'in_progress').length,
    resolved: state.data.tickets.filter(ticket => ticket.status === 'resolved').length,
  };
  $('#ticket-summary-row').innerHTML = [
    ['Total', counts.total], ['Abertos', counts.open], ['Em andamento', counts.progress], ['Resolvidos', counts.resolved],
  ].map(([label, value]) => `<div class="summary-chip"><small>${label}</small><strong>${value}</strong></div>`).join('');
  applyTicketFilters();
}

function applyTicketFilters() {
  if (!state.data) return;
  const query = $('#ticket-search').value.trim().toLowerCase();
  const status = $('#ticket-status-filter').value;
  const category = $('#ticket-category-filter').value;
  const tickets = state.data.tickets.filter(ticket => {
    const haystack = `${ticket.subject} ${ticket.displayId} ${ticket.owner?.displayName || ''} ${ticket.category}`.toLowerCase();
    return (!query || haystack.includes(query)) && (status === 'all' || ticket.status === status) && (category === 'all' || ticket.type === category);
  });
  $('#all-ticket-table').innerHTML = tickets.map(ticket => `<tr>
    <td><div class="ticket-cell"><div class="ticket-cell-copy"><strong>${escapeHtml(ticket.subject)}</strong><small>${escapeHtml(ticket.displayId)}</small></div></div></td>
    <td><div class="user-cell">${avatarMarkup(ticket.owner, 'tiny')}<span>${escapeHtml(ticket.owner?.displayName || 'Usuário')}</span></div></td>
    <td>${categoryBadge(ticket)}</td>
    <td>${statusBadge(ticket.status)}</td>
    <td>${ticket.assignee ? `<div class="assignee-cell">${avatarMarkup(ticket.assignee, 'tiny')}<span>${escapeHtml(ticket.assignee.displayName)}</span></div>` : '<span class="muted">Fila geral</span>'}</td>
    <td><select class="inline-select ticket-role-select" data-role-ticket="${escapeHtml(ticket.id)}" ${ticket.rawStatus === 'closed' ? 'disabled' : ''}>${selectOptions(state.data.resources.roles, ticket.supportRoleId, 'Escolha um cargo', '@ ')}</select></td>
    <td><select class="inline-select" data-priority-ticket="${escapeHtml(ticket.id)}" ${ticket.rawStatus === 'closed' ? 'disabled' : ''}>${priorityOptions(ticket)}</select></td>
    <td>${formatDate(ticket.openedAt)}</td>
    <td><div class="row-actions">
      ${ticket.rawStatus === 'open' ? `<button class="mini-button" data-ticket-action="${ticket.assignee ? 'release' : 'claim'}" data-ticket-id="${escapeHtml(ticket.id)}">${ticket.assignee ? 'Liberar' : 'Assumir'}</button>` : ''}
      ${ticket.discordUrl ? `<a class="icon-link" href="${escapeHtml(ticket.discordUrl)}" target="_blank" rel="noreferrer">Abrir ↗</a>` : ''}
    </div></td>
  </tr>`).join('');
  $('#ticket-empty').classList.toggle('hidden', tickets.length > 0);
}

const DEFAULT_TICKET_TYPES = {
  suporte: { label: 'Suporte geral', emoji: '🛠️', description: 'Dúvidas, problemas e ajuda com o servidor', priority: 'normal' },
  denuncia: { label: 'Denúncia', emoji: '🚨', description: 'Denuncie um membro ou uma situação', priority: 'alta' },
  parceria: { label: 'Parceria', emoji: '🤝', description: 'Propostas de parceria e divulgação', priority: 'normal' },
  compras: { label: 'Compras', emoji: '🛒', description: 'Pagamentos, produtos e atendimento comercial', priority: 'alta' },
  outros: { label: 'Outros assuntos', emoji: '📝', description: 'Solicitações que não se encaixam acima', priority: 'normal' },
};

function slugify(text) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 32) || `setor_${Date.now()}`;
}

function typeRowHtml(id, type) {
  return `<div class="ticket-type-row" data-type-id="${escapeHtml(id)}">
    <div class="type-row-main">
      <input class="ticket-type-emoji" data-field="emoji" value="${escapeHtml(type.emoji)}" maxlength="8" title="Emoji">
      <input data-field="label" value="${escapeHtml(type.label)}" maxlength="80" placeholder="Nome do setor">
      <select class="ticket-type-priority" data-field="priority">
        ${['baixa','normal','alta','urgente'].map(p => `<option value="${p}" ${type.priority===p?'selected':''}>${p[0].toUpperCase()}${p.slice(1)}</option>`).join('')}
      </select>
      <button type="button" class="remove-type-btn mini-button" title="Remover setor">✕</button>
    </div>
    <input class="type-desc-input" data-field="description" value="${escapeHtml(type.description)}" maxlength="100" placeholder="Descrição curta (aparece no menu)">
    <label class="ticket-type-role-row"><span>Cargo responsável pelo setor</span><select data-field="roleId">${selectOptions(state.data.resources.roles, type.roleId || '', 'Usar cargo de suporte padrão', '@ ')}</select></label>
  </div>`;
}

function renderAppearance() {
  const config = state.data.config;
  const types = config.ticketTypes || DEFAULT_TICKET_TYPES;
  $('#panel-title-input').value = config.ticketPanelTitle || '';
  $('#panel-description-input').value = config.ticketPanelDescription || '';
  $('#panel-color-input').value = config.ticketPanelColor || '#5865F2';
  $('#panel-color-text').value = config.ticketPanelColor || '#5865F2';
  $('#accent-color-input').value = config.dashboardAccent || '#6C63FF';
  $('#accent-color-text').value = config.dashboardAccent || '#6C63FF';
  $('#panel-banner-input').value = config.ticketPanelBanner || '';
  $('#panel-thumbnail-input').value = config.ticketPanelThumbnail || '';
  $('#max-tickets-input').value = String(config.maxOpenTickets || 3);
  $('#panel-sectors-title-input').value = config.ticketPanelSectorsTitle || '';
  $('#panel-how-title-input').value = config.ticketPanelHowTitle || '';
  $('#panel-how-text-input').value = config.ticketPanelHowText || '';
  $('#panel-menu-placeholder-input').value = config.ticketPanelMenuPlaceholder || '';
  $('#panel-footer-input').value = config.ticketPanelFooter || '';
  renderTypeRows(types);
  const { resources } = state.data;
  $('#appearance-ticket-category-input').innerHTML = selectOptions(resources.categories, config.ticketCategoryId, 'Selecione a categoria', '▣ ');
  $('#appearance-support-role-input').innerHTML = selectOptions(resources.roles, config.supportRoleId, 'Selecione o cargo padrão', '@ ');
  $('#appearance-review-channel-input').innerHTML = selectOptions(resources.textChannels, config.ticketReviewChannelId, 'Selecione o canal de avaliações', '# ');
  $('#appearance-publish-channel').innerHTML = selectOptions(resources.textChannels, config.ticketPanelChannelId, 'Selecione o canal', '# ');
  updatePreview();
}

function renderTypeRows(types) {
  const editor = $('#ticket-types-editor');
  editor.innerHTML = Object.entries(types).map(([id, type]) => typeRowHtml(id, type)).join('');
}

function bindTypeEditor() {
  const editor = $('#ticket-types-editor');
  editor.addEventListener('click', event => {
    const btn = event.target.closest('.remove-type-btn');
    if (!btn) return;
    const row = btn.closest('.ticket-type-row');
    if (editor.querySelectorAll('.ticket-type-row').length <= 1) { toast('O painel precisa ter pelo menos 1 setor.', 'error'); return; }
    if (editor.querySelectorAll('.ticket-type-row').length > 25) { toast('Máximo de 25 setores.', 'error'); return; }
    row.remove();
  });
  $('#add-type-btn').addEventListener('click', () => {
    const count = editor.querySelectorAll('.ticket-type-row').length;
    if (count >= 25) { toast('Máximo de 25 setores.', 'error'); return; }
    const id = `setor_${Date.now()}`;
    const div = document.createElement('div');
    div.innerHTML = typeRowHtml(id, { emoji: '🎫', label: '', description: '', priority: 'normal', roleId: null });
    editor.append(div.firstElementChild);
    editor.lastElementChild.querySelector('[data-field="label"]').focus();
  });
}

function updatePreview() {
  const title = $('#panel-title-input').value || 'CENTRAL DE ATENDIMENTO';
  const description = $('#panel-description-input').value || 'Selecione abaixo o setor que melhor corresponde à sua solicitação.';
  const color = $('#panel-color-text').value;
  const accent = $('#accent-color-text').value;
  $('#preview-title').textContent = title;
  $('#preview-description').textContent = description;
  if (/^#[0-9a-f]{6}$/i.test(color)) $('#preview-embed').style.borderLeftColor = color;
  if (/^#[0-9a-f]{6}$/i.test(accent)) applyAccent(accent);
  const banner = $('#panel-banner-input').value;
  $('#preview-banner').src = banner || '';
  $('#preview-banner').classList.toggle('hidden', !banner);
  const thumbnail = $('#panel-thumbnail-input').value;
  $('#preview-thumbnail').src = thumbnail || '';
  $('#preview-thumbnail').classList.toggle('hidden', !thumbnail);
}

function renderProtections() {
  const config = state.data.config;
  const { resources } = state.data;
  $('#anti-link-input').checked = Boolean(config.antiLink);
  $('#allowed-domains-input').value = (config.allowedLinkDomains || []).join(', ');
  $('#anti-spam-input').checked = Boolean(config.antiSpam);
  $('#spam-limit-input').value = config.spamLimit || 6;
  $('#spam-limit-output').value = config.spamLimit || 6;
  $('#spam-window-input').value = config.spamWindowSeconds || 8;
  $('#spam-window-output').value = config.spamWindowSeconds || 8;
  $('#spam-mute-input').value = config.spamMuteDuration || 5;
  $('#spam-mute-output').value = config.spamMuteDuration || 5;
  $('#anti-swear-input').checked = Boolean(config.antiSwear);
  $('#swear-action-input').value = config.swearAction || 'timeout';
  $('#swear-warn-input').value = config.swearWarnCount || 3;
  $('#swear-warn-output').value = config.swearWarnCount || 3;
  $('#swear-mute-input').value = config.swearMuteDuration || 30;
  $('#swear-window-input').value = config.swearWarnWindowHours || 24;
  $('#swear-notice-input').value = config.swearNotice || 'Sua mensagem foi removida por conter conteúdo bloqueado.';
  $('#swear-exempt-channels-input').innerHTML = multiSelectOptions(resources.textChannels, config.swearExemptChannelIds, '# ');
  $('#swear-exempt-roles-input').innerHTML = multiSelectOptions(resources.roles, config.swearExemptRoleIds, '@ ');
  renderSwearTags(config.swearWords || []);
  updateSwearEnabledState();
  updateSwearActionVisibility();
  updateSecurityScore();
}

function renderSwearTags(words) {
  const area = $('#swear-tag-area');
  if (!area) return;
  area.innerHTML = words.map(w => `<span class="swear-tag">${escapeHtml(w)}<button type="button" data-word="${escapeHtml(w)}" aria-label="Remover">&times;</button></span>`).join('');
  area.querySelectorAll('button[data-word]').forEach(btn => {
    btn.addEventListener('click', () => renderSwearTags(getSwearWords().filter(x => x !== btn.dataset.word)));
  });
}

function getSwearWords() {
  return [...$('#swear-tag-area').querySelectorAll('[data-word]')].map(b => b.dataset.word);
}

function updateSwearActionVisibility() {
  $('#swear-escalation-settings').classList.toggle('hidden', $('#swear-action-input').value !== 'timeout');
}

function updateSwearEnabledState() {
  const enabled = $('#anti-swear-input').checked;
  $('#swear-status-note').textContent = enabled
    ? 'Filtro ativo: mensagens que baterem com esta lista serão apagadas e receberão a ação escolhida.'
    : 'Filtro desligado: você pode preparar e salvar a lista agora; ative o botão acima para começar a moderar.';
  $('#swear-status-note').dataset.status = enabled ? 'enabled' : 'disabled';
}

function selectedValues(select) {
  return [...select.selectedOptions].map(option => option.value).filter(Boolean);
}

function updateSecurityScore() {
  const link = $('#anti-link-input').checked;
  const spam = $('#anti-spam-input').checked;
  const swear = $('#anti-swear-input').checked;
  const score = 25 + (link ? 25 : 0) + (spam ? 25 : 0) + (swear ? 25 : 0);
  $('#security-score').textContent = score;
  $('.score-ring').style.setProperty('--score', `${score}%`);
  $('#check-link').textContent = `${link ? '✓' : '○'} Anti-link`;
  $('#check-spam').textContent = `${spam ? '✓' : '○'} Anti-spam`;
  const cs = $('#check-swear'); if (cs) cs.textContent = `${swear ? '✓' : '○'} Filtro de conteúdo`;
  $('#security-message').textContent = score === 100 ? 'Todas as proteções estão ativas!' : 'Ative as proteções recomendadas para melhorar a segurança.';
}

function selectOptions(items, selected, placeholder, icon = '') {
  return `<option value="">${placeholder}</option>` + items.map(item => `<option value="${item.id}" ${item.id === selected ? 'selected' : ''}>${icon}${escapeHtml(item.name)}</option>`).join('');
}

function multiSelectOptions(items, selected = [], icon = '') {
  const selectedIds = new Set(Array.isArray(selected) ? selected : []);
  return items.map(item => `<option value="${item.id}" ${selectedIds.has(item.id) ? 'selected' : ''}>${icon}${escapeHtml(item.name)}</option>`).join('');
}

function renderResources() {
  const { config, resources } = state.data;
  const channelFields = [
    ['logs-channel-input', config.logsChannelId], ['panel-channel-input', config.ticketPanelChannelId],
    ['welcome-channel-input', config.welcomeChannelId], ['leave-channel-input', config.leaveChannelId],
    ['suggestions-channel-input', config.suggestionsChannelId],
  ];
  for (const [id, selected] of channelFields) $( `#${id}`).innerHTML = selectOptions(resources.textChannels, selected, 'Nenhum canal', '# ');
  $('#ticket-category-input').innerHTML = selectOptions(resources.categories, config.ticketCategoryId, 'Nenhuma categoria', '▣ ');
  $('#support-role-input').innerHTML = selectOptions(resources.roles, config.supportRoleId, 'Nenhum cargo', '@ ');
  $('#auto-role-input').innerHTML = selectOptions(resources.roles, config.autoRoleId, 'Nenhum cargo', '@ ');
  $('#publish-channel-select').innerHTML = selectOptions(resources.textChannels, config.ticketPanelChannelId, 'Selecione um canal', '# ');
}

function auditIcon(type) {
  return { ticket: '🎫', settings: '⚙️', moderation: '🛡️', community: '👥', system: '●' }[type] || '●';
}

function renderAudits() {
  applyLogFilter();
}

function applyLogFilter() {
  if (!state.data) return;
  const query = $('#log-search').value.trim().toLowerCase();
  const logs = state.data.audits.filter(log => `${log.title} ${log.description} ${log.actor?.displayName || ''}`.toLowerCase().includes(query));
  $('#audit-list').innerHTML = logs.map(log => `<div class="audit-item">
    <div class="audit-icon">${auditIcon(log.type)}</div>
    <div class="audit-copy"><strong>${escapeHtml(log.title)}</strong><p>${escapeHtml(log.description)}</p></div>
    <div class="audit-meta"><span>${formatRelative(log.createdAt)}</span>${log.actor ? `<span class="audit-actor">${avatarMarkup(log.actor, 'tiny')}${escapeHtml(log.actor.displayName)}</span>` : '<span>Sistema</span>'}</div>
  </div>`).join('');
  $('#audit-empty').classList.toggle('hidden', logs.length > 0);
}

function setPage(page) {
  state.page = page;
  $$('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.page === page));
  $$('[data-page-panel]').forEach(panel => panel.classList.toggle('active-page', panel.dataset.pagePanel === page));
  $('#page-title').textContent = pageTitles[page] || 'Dashboard';
  closeSidebar();
}

function openSidebar() {
  $('#sidebar').classList.add('open');
  $('#sidebar-overlay').classList.add('open');
}

function closeSidebar() {
  $('#sidebar').classList.remove('open');
  $('#sidebar-overlay').classList.remove('open');
}

async function saveConfig(payload, successMessage) {
  await api(`/api/config/${state.guildId}`, { method: 'PATCH', body: JSON.stringify(payload) });
  toast(successMessage);
  await loadDashboard({ quiet: true });
}

function buildAppearancePayload() {
  const ticketTypes = {};
  $$('#ticket-types-editor .ticket-type-row').forEach(row => {
    const label = row.querySelector('[data-field="label"]').value.trim();
    if (!label) return;
    const id = row.dataset.typeId.startsWith('setor_') ? slugify(label) : row.dataset.typeId;
    ticketTypes[id] = {
      emoji: row.querySelector('[data-field="emoji"]').value.trim() || '🎫',
      label,
      description: row.querySelector('[data-field="description"]').value.trim(),
      priority: row.querySelector('[data-field="priority"]').value,
      roleId: row.querySelector('[data-field="roleId"]').value || null,
    };
  });
  return {
    ticketPanelTitle: $('#panel-title-input').value,
    ticketPanelDescription: $('#panel-description-input').value,
    ticketPanelColor: $('#panel-color-text').value,
    dashboardAccent: $('#accent-color-text').value,
    ticketPanelBanner: $('#panel-banner-input').value || null,
    ticketPanelThumbnail: $('#panel-thumbnail-input').value || null,
    maxOpenTickets: Number($('#max-tickets-input').value),
    ticketCategoryId: $('#appearance-ticket-category-input').value || null,
    supportRoleId: $('#appearance-support-role-input').value || null,
    ticketReviewChannelId: $('#appearance-review-channel-input').value || null,
    ticketPanelSectorsTitle: $('#panel-sectors-title-input').value.trim() || null,
    ticketPanelHowTitle: $('#panel-how-title-input').value.trim() || null,
    ticketPanelHowText: $('#panel-how-text-input').value.trim() || null,
    ticketPanelMenuPlaceholder: $('#panel-menu-placeholder-input').value.trim() || null,
    ticketPanelFooter: $('#panel-footer-input').value.trim() || null,
    ticketTypes: Object.keys(ticketTypes).length ? ticketTypes : null,
  };
}

function bindEvents() {
  $$('.nav-item').forEach(item => item.addEventListener('click', () => setPage(item.dataset.page)));
  $$('[data-go-page]').forEach(item => item.addEventListener('click', () => setPage(item.dataset.goPage)));
  $('#mobile-menu').addEventListener('click', openSidebar);
  $('#sidebar-overlay').addEventListener('click', closeSidebar);
  bindTypeEditor();

  $('#guild-select').addEventListener('change', async event => {
    state.guildId = event.target.value;
    localStorage.setItem('luckers_guild', state.guildId);
    updateGuildHeader();
    await loadDashboard();
  });

  $('#user-menu-button').addEventListener('click', () => {
    const dropdown = $('#user-dropdown');
    dropdown.classList.toggle('hidden');
    $('#user-menu-button').setAttribute('aria-expanded', String(!dropdown.classList.contains('hidden')));
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('.user-menu-wrap')) $('#user-dropdown').classList.add('hidden');
  });
  $('#refresh-data').addEventListener('click', async () => {
    $('#user-dropdown').classList.add('hidden');
    await loadDashboard();
    toast('Dados atualizados.');
  });
  $('#logout-button').addEventListener('click', async () => {
    await api('/auth/logout', { method: 'POST', body: JSON.stringify({}) }).catch(() => null);
    location.href = '/dashboard';
  });

  $('#ticket-search').addEventListener('input', applyTicketFilters);
  $('#ticket-status-filter').addEventListener('change', applyTicketFilters);
  $('#ticket-category-filter').addEventListener('change', applyTicketFilters);
  $('#log-search').addEventListener('input', applyLogFilter);

  $('#all-ticket-table').addEventListener('click', async event => {
    const button = event.target.closest('[data-ticket-action]');
    if (!button) return;
    button.disabled = true;
    try {
      await api(`/api/tickets/${state.guildId}/${encodeURIComponent(button.dataset.ticketId)}/${button.dataset.ticketAction}`, { method: 'POST', body: JSON.stringify({}) });
      toast(button.dataset.ticketAction === 'claim' ? 'Ticket assumido.' : 'Ticket liberado.');
      await loadDashboard({ quiet: true });
    } catch (error) {
      console.error(error);
      toast('Não foi possível atualizar o ticket.', 'error');
      button.disabled = false;
    }
  });

  $('#all-ticket-table').addEventListener('change', async event => {
    const select = event.target.closest('[data-priority-ticket], [data-role-ticket]');
    if (!select) return;
    const ticketId = select.dataset.priorityTicket || select.dataset.roleTicket;
    const payload = select.dataset.roleTicket ? { supportRoleId: select.value } : { priority: select.value };
    if (select.dataset.roleTicket && !select.value) { toast('Escolha um cargo responsável.', 'error'); return; }
    try {
      await api(`/api/tickets/${state.guildId}/${encodeURIComponent(ticketId)}`, { method: 'PATCH', body: JSON.stringify(payload) });
      toast(select.dataset.roleTicket ? 'Cargo responsável atualizado.' : 'Prioridade atualizada.');
      await loadDashboard({ quiet: true });
    } catch (error) {
      console.error(error);
      toast('Não foi possível atualizar o ticket.', 'error');
    }
  });

  ['panel-title-input', 'panel-description-input', 'panel-color-text', 'accent-color-text', 'panel-banner-input', 'panel-thumbnail-input'].forEach(id => $(`#${id}`).addEventListener('input', updatePreview));
  $('#panel-color-input').addEventListener('input', event => { $('#panel-color-text').value = event.target.value.toUpperCase(); updatePreview(); });
  $('#panel-color-text').addEventListener('input', event => { if (/^#[0-9a-f]{6}$/i.test(event.target.value)) $('#panel-color-input').value = event.target.value; });
  $('#accent-color-input').addEventListener('input', event => { $('#accent-color-text').value = event.target.value.toUpperCase(); updatePreview(); });
  $('#accent-color-text').addEventListener('input', event => { if (/^#[0-9a-f]{6}$/i.test(event.target.value)) $('#accent-color-input').value = event.target.value; });

  $('#appearance-form').addEventListener('submit', async event => {
    event.preventDefault();
    const payload = buildAppearancePayload();
    try { await saveConfig(payload, 'Aparência salva com sucesso.'); }
    catch (error) { console.error(error); toast('Revise os campos e tente novamente.', 'error'); }
  });

  $('#btn-save-and-publish').addEventListener('click', async () => {
    const channelId = $('#appearance-publish-channel').value;
    if (!channelId) { toast('Selecione um canal para publicar.', 'error'); return; }
    const btn = $('#btn-save-and-publish');
    btn.disabled = true;
    const payload = { ...buildAppearancePayload(), ticketPanelChannelId: channelId };
    try {
      await api(`/api/config/${state.guildId}`, { method: 'PATCH', body: JSON.stringify(payload) });
      await api(`/api/panel/${state.guildId}/publish`, { method: 'POST', body: JSON.stringify({ channelId }) });
      toast('Painel salvo e publicado com sucesso! 🎉');
      await loadDashboard({ quiet: true });
    } catch (error) {
      console.error(error);
      toast('Não foi possível publicar. Verifique o canal e tente novamente.', 'error');
    } finally {
      btn.disabled = false;
    }
  });

  $('#spam-limit-input').addEventListener('input', event => { $('#spam-limit-output').value = event.target.value; });
  $('#spam-window-input').addEventListener('input', event => { $('#spam-window-output').value = event.target.value; });
  $('#spam-mute-input').addEventListener('input', event => { $('#spam-mute-output').value = event.target.value; });
  $('#anti-link-input').addEventListener('change', updateSecurityScore);
  $('#anti-spam-input').addEventListener('change', updateSecurityScore);
  $('#anti-swear-input').addEventListener('change', () => {
    updateSwearEnabledState();
    updateSecurityScore();
  });
  $('#swear-warn-input').addEventListener('input', e => $('#swear-warn-output').value = e.target.value);
  $('#swear-action-input').addEventListener('change', updateSwearActionVisibility);
  function addSwearWord() {
    const input = $('#swear-word-input');
    const current = getSwearWords();
    const additions = input.value.split(/[\n,;]+/).map(value => value.trim()).filter(Boolean);
    const next = [...current];
    for (const value of additions) {
      if (next.length >= 100) break;
      if (!next.some(item => item.toLocaleLowerCase('pt-BR') === value.toLocaleLowerCase('pt-BR'))) next.push(value.slice(0, 60));
    }
    renderSwearTags(next);
    input.value = '';
  }
  $('#swear-add-btn').addEventListener('click', addSwearWord);
  $('#swear-word-input').addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); addSwearWord(); } });
  $('#swear-test-btn').addEventListener('click', async () => {
    const text = $('#swear-test-input').value.trim();
    const result = $('#swear-test-result');
    if (!text) { result.textContent = 'Digite uma mensagem para testar.'; result.dataset.status = 'neutral'; return; }
    try {
      const response = await api(`/api/moderation/${state.guildId}/test`, { method: 'POST', body: JSON.stringify({ text, words: getSwearWords() }) });
      result.textContent = response.matched ? `Bloqueado pela regra: “${response.term}”.` : 'Mensagem permitida pelo filtro atual.';
      result.dataset.status = response.matched ? 'blocked' : 'allowed';
    } catch (error) {
      console.error(error);
      result.textContent = 'Não foi possível testar agora.';
      result.dataset.status = 'blocked';
    }
  });
  $('#protection-form').addEventListener('submit', async event => {
    event.preventDefault();
    try {
      const allowedLinkDomains = $('#allowed-domains-input').value.split(/[,;\s]+/).map(value => value.trim()).filter(Boolean);
      await saveConfig({
        antiLink: $('#anti-link-input').checked,
        allowedLinkDomains,
        antiSpam: $('#anti-spam-input').checked,
        spamLimit: Number($('#spam-limit-input').value),
        spamWindowSeconds: Number($('#spam-window-input').value),
        spamMuteDuration: Number($('#spam-mute-input').value),
        antiSwear: $('#anti-swear-input').checked,
        swearAction: $('#swear-action-input').value,
        swearWarnCount: Number($('#swear-warn-input').value),
        swearMuteDuration: Number($('#swear-mute-input').value),
        swearWarnWindowHours: Number($('#swear-window-input').value),
        swearNotice: $('#swear-notice-input').value,
        swearWords: getSwearWords(),
        swearExemptChannelIds: selectedValues($('#swear-exempt-channels-input')),
        swearExemptRoleIds: selectedValues($('#swear-exempt-roles-input')),
      }, 'Proteções atualizadas.');
    } catch (error) { console.error(error); toast('Não foi possível salvar as proteções.', 'error'); }
  });

  $('#community-form').addEventListener('submit', async event => {
    event.preventDefault();
    const payload = {};
    for (const id of ['logsChannelId', 'ticketPanelChannelId', 'ticketCategoryId', 'supportRoleId', 'welcomeChannelId', 'leaveChannelId', 'suggestionsChannelId', 'autoRoleId']) {
      const elementId = {
        logsChannelId: 'logs-channel-input', ticketPanelChannelId: 'panel-channel-input', ticketCategoryId: 'ticket-category-input', supportRoleId: 'support-role-input',
        welcomeChannelId: 'welcome-channel-input', leaveChannelId: 'leave-channel-input', suggestionsChannelId: 'suggestions-channel-input', autoRoleId: 'auto-role-input',
      }[id];
      payload[id] = $(`#${elementId}`).value || null;
    }
    try { await saveConfig(payload, 'Canais e cargos atualizados.'); }
    catch (error) { console.error(error); toast('Não foi possível salvar os recursos.', 'error'); }
  });

  $('#publish-panel').addEventListener('click', () => {
    renderResources();
    $('#publish-dialog').showModal();
  });
  $('#publish-form').addEventListener('submit', async event => {
    event.preventDefault();
    const submitter = event.submitter;
    if (submitter?.value === 'cancel') { $('#publish-dialog').close(); return; }
    const channelId = $('#publish-channel-select').value;
    if (!channelId) { toast('Escolha um canal.', 'error'); return; }
    $('#confirm-publish').disabled = true;
    try {
      await api(`/api/panel/${state.guildId}/publish`, { method: 'POST', body: JSON.stringify({ channelId }) });
      $('#publish-dialog').close();
      toast('Painel publicado no Discord.');
      await loadDashboard({ quiet: true });
    } catch (error) {
      console.error(error);
      toast('Não foi possível publicar o painel.', 'error');
    } finally {
      $('#confirm-publish').disabled = false;
    }
  });
}

init();
