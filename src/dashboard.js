import crypto from 'node:crypto';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectBlockedTerm, sanitizeAllowedDomains, sanitizeBlockedTerms } from './moderation.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, '../public/dashboard');
const DISCORD_API = 'https://discord.com/api/v10';
const MANAGE_GUILD = 1n << 5n;
const ADMINISTRATOR = 1n << 3n;
const sessions = new Map();

function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').map(part => part.trim()).filter(Boolean).map(part => {
    const index = part.indexOf('=');
    return [decodeURIComponent(part.slice(0, index)), decodeURIComponent(part.slice(index + 1))];
  }));
}

function timingSafeEqualText(a, b) {
  const aBuffer = Buffer.from(String(a));
  const bBuffer = Buffer.from(String(b));
  return aBuffer.length === bBuffer.length && crypto.timingSafeEqual(aBuffer, bBuffer);
}

function signer(secret) {
  return value => crypto.createHmac('sha256', secret).update(value).digest('base64url');
}

function avatarUrl(user, size = 96) {
  if (!user?.id || !user.avatar) return null;
  const extension = user.avatar.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${extension}?size=${size}`;
}

function guildIconUrl(guild, size = 96) {
  if (!guild?.id || !guild.icon) return null;
  const extension = guild.icon.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.${extension}?size=${size}`;
}

function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return 'Sem dados';
  const minutes = Math.max(1, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} h ${remainder} min` : `${hours} h`;
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function percentageDelta(current, previous) {
  if (!previous && !current) return 0;
  if (!previous) return 100;
  return Math.round(((current - previous) / previous) * 100);
}

function getDayStart(date = new Date()) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy.getTime();
}

function derivedStatus(ticket) {
  if (ticket.status === 'closed') return 'resolved';
  if (ticket.claimedBy) return 'in_progress';
  if (Date.now() - ticket.openedAt > 30 * 60_000) return 'awaiting';
  return 'open';
}

async function discordFetch(route, accessToken, options = {}) {
  const response = await fetch(`${DISCORD_API}${route}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Discord API ${response.status}: ${text.slice(0, 300)}`);
  }
  return response.status === 204 ? null : response.json();
}

function hasGuildPermission(oauthGuild) {
  try {
    const permissions = BigInt(oauthGuild.permissions || '0');
    return Boolean(oauthGuild.owner) || (permissions & ADMINISTRATOR) === ADMINISTRATOR || (permissions & MANAGE_GUILD) === MANAGE_GUILD;
  } catch {
    return false;
  }
}

async function userSummary(client, id) {
  if (!id) return null;
  const cached = client.users.cache.get(id);
  const user = cached || await client.users.fetch(id).catch(() => null);
  if (!user) return { id, username: `Usuário ${id.slice(-4)}`, displayName: `Usuário ${id.slice(-4)}`, avatar: null };
  return {
    id: user.id,
    username: user.username,
    displayName: user.globalName || user.username,
    avatar: user.displayAvatarURL({ extension: 'png', size: 128 }),
  };
}

function sanitizeConfig(config) {
  const fields = [
    'logsChannelId', 'ticketCategoryId', 'supportRoleId', 'ticketPanelChannelId', 'ticketReviewChannelId',
    'welcomeChannelId', 'leaveChannelId', 'autoRoleId', 'suggestionsChannelId',
    'antiLink', 'antiSpam', 'spamLimit', 'spamWindowSeconds', 'spamMuteDuration',
    'allowedLinkDomains', 'ticketPanelTitle', 'ticketPanelDescription',
    'ticketPanelColor', 'ticketPanelBanner', 'ticketPanelThumbnail', 'maxOpenTickets',
    'dashboardAccent', 'ticketPanelMenuPlaceholder', 'ticketPanelSectorsTitle',
    'ticketPanelHowTitle', 'ticketPanelHowText', 'ticketPanelFooter', 'ticketTypes',
    'antiSwear', 'swearWords', 'swearAction', 'swearWarnCount', 'swearMuteDuration',
    'swearWarnWindowHours', 'swearNotice', 'swearExemptChannelIds', 'swearExemptRoleIds',
  ];
  return Object.fromEntries(fields.map(field => [field, config[field] ?? null]));
}

function validateUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}
export function installDashboard(app, {
  client,
  db,
  guildData,
  save,
  auditFor,
  recordAudit,
  ticketTypes,
  publishTicketPanel,
  buildTicketTopic,
}) {
  const baseUrl = (process.env.DASHBOARD_URL || `http://localhost:${process.env.PORT || 8000}`).replace(/\/$/, '');
  const redirectUri = process.env.DISCORD_REDIRECT_URI || `${baseUrl}/auth/discord/callback`;
  const clientId = process.env.DISCORD_CLIENT_ID || '';
  const clientSecret = process.env.DISCORD_CLIENT_SECRET || '';
  const demoMode = process.env.DASHBOARD_DEMO_MODE === 'true';
  const sessionSecret = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
  const sign = signer(sessionSecret);

  if (!process.env.SESSION_SECRET) console.warn('⚠️ SESSION_SECRET não definido. Sessões do dashboard serão invalidadas ao reiniciar.');

  function setCookie(res, name, value, { maxAge = 7 * 24 * 60 * 60, httpOnly = true } = {}) {
    const secure = process.env.NODE_ENV === 'production';
    const parts = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`, 'Path=/', `Max-Age=${maxAge}`, 'SameSite=Lax'];
    if (httpOnly) parts.push('HttpOnly');
    if (secure) parts.push('Secure');
    res.append('Set-Cookie', parts.join('; '));
  }

  function clearCookie(res, name) {
    res.append('Set-Cookie', `${encodeURIComponent(name)}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
  }

  function signedValue(value) {
    return `${value}.${sign(value)}`;
  }

  function verifySigned(value) {
    if (!value) return null;
    const split = value.lastIndexOf('.');
    if (split < 1) return null;
    const raw = value.slice(0, split);
    const signature = value.slice(split + 1);
    return timingSafeEqualText(signature, sign(raw)) ? raw : null;
  }

  async function refreshSession(session) {
    if (!session?.refreshToken || session.expiresAt > Date.now() + 60_000) return session;
    const body = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: session.refreshToken });
    const response = await fetch(`${DISCORD_API}/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body,
    });
    if (!response.ok) throw new Error('Não foi possível renovar a sessão do Discord.');
    const token = await response.json();
    session.accessToken = token.access_token;
    session.refreshToken = token.refresh_token || session.refreshToken;
    session.expiresAt = Date.now() + token.expires_in * 1000;
    session.guilds = await discordFetch('/users/@me/guilds', session.accessToken);
    return session;
  }

  async function resolveSession(req) {
    const cookies = parseCookies(req.headers.cookie);
    const sessionId = verifySigned(cookies.luckers_session);
    if (sessionId && sessions.has(sessionId)) {
      const session = sessions.get(sessionId);
      try {
        await refreshSession(session);
        return session;
      } catch {
        sessions.delete(sessionId);
      }
    }
    if (!demoMode) return null;
    const firstGuild = client.guilds.cache.first();
    if (!firstGuild) return null;
    return {
      id: 'demo',
      demo: true,
      user: { id: firstGuild.ownerId, username: 'Administrador', global_name: 'Administrador', avatar: null },
      guilds: [...client.guilds.cache.values()].map(guild => ({ id: guild.id, name: guild.name, icon: guild.icon, owner: true, permissions: '8' })),
    };
  }

  async function requireAuth(req, res, next) {
    const session = await resolveSession(req);
    if (!session) return res.status(401).json({ error: 'AUTH_REQUIRED', loginUrl: '/auth/discord' });
    req.dashboardSession = session;
    next();
  }

  function requireSameOrigin(req, res, next) {
    const origin = req.get('origin');
    let expectedOrigin = null;
    try { expectedOrigin = new URL(baseUrl).origin; } catch { expectedOrigin = null; }
    if (origin && expectedOrigin && origin !== expectedOrigin) return res.status(403).json({ error: 'INVALID_ORIGIN' });
    next();
  }

  function requireGuild(req, res, next) {
    const guildId = req.params.guildId || req.query.guildId || req.body?.guildId;
    const oauthGuild = req.dashboardSession.guilds?.find(guild => guild.id === guildId);
    const guild = client.guilds.cache.get(guildId);
    if (!guild || !oauthGuild || !hasGuildPermission(oauthGuild)) return res.status(403).json({ error: 'GUILD_FORBIDDEN' });
    req.dashboardGuild = guild;
    req.oauthGuild = oauthGuild;
    next();
  }

  app.use((req, res, next) => {
    if (req.path.startsWith('/dashboard') || req.path.startsWith('/api/') || req.path.startsWith('/auth/')) {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('Referrer-Policy', 'no-referrer');
      res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
      res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data: https://cdn.discordapp.com https://media.discordapp.net; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://discord.com");
    }
    next();
  });

  app.use('/dashboard-assets', express.static(publicDir, { maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0, etag: true }));

  app.get('/dashboard', (_req, res) => res.sendFile(path.join(publicDir, 'index.html')));

  app.get('/auth/discord', (req, res) => {
    if (!clientId || !clientSecret) return res.redirect('/dashboard?setup=oauth');
    const state = crypto.randomBytes(24).toString('base64url');
    setCookie(res, 'luckers_oauth_state', signedValue(state), { maxAge: 600 });
    const url = new URL('https://discord.com/oauth2/authorize');
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('scope', 'identify guilds');
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('state', state);
    url.searchParams.set('prompt', 'consent');
    res.redirect(url.toString());
  });

  app.get('/auth/discord/callback', async (req, res) => {
    try {
      const cookies = parseCookies(req.headers.cookie);
      const expectedState = verifySigned(cookies.luckers_oauth_state);
      clearCookie(res, 'luckers_oauth_state');
      if (!expectedState || !req.query.state || !timingSafeEqualText(expectedState, req.query.state)) return res.redirect('/dashboard?error=state');
      if (!req.query.code) return res.redirect('/dashboard?error=denied');
      const body = new URLSearchParams({ grant_type: 'authorization_code', code: String(req.query.code), redirect_uri: redirectUri });
      const tokenResponse = await fetch(`${DISCORD_API}/oauth2/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        },
        body,
      });
      if (!tokenResponse.ok) throw new Error(`Falha ao trocar código OAuth: ${tokenResponse.status}`);
      const token = await tokenResponse.json();
      const [user, guilds] = await Promise.all([
        discordFetch('/users/@me', token.access_token),
        discordFetch('/users/@me/guilds', token.access_token),
      ]);
      const sessionId = crypto.randomBytes(32).toString('base64url');
      sessions.set(sessionId, {
        id: sessionId,
        user,
        guilds,
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        expiresAt: Date.now() + token.expires_in * 1000,
        createdAt: Date.now(),
      });
      setCookie(res, 'luckers_session', signedValue(sessionId));
      res.redirect('/dashboard');
    } catch (error) {
      console.error('[DASHBOARD OAUTH]', error);
      res.redirect('/dashboard?error=oauth');
    }
  });

  app.post('/auth/logout', requireAuth, requireSameOrigin, async (req, res) => {
    const cookies = parseCookies(req.headers.cookie);
    const sessionId = verifySigned(cookies.luckers_session);
    const session = sessionId ? sessions.get(sessionId) : null;
    if (session?.accessToken && clientId && clientSecret) {
      fetch(`${DISCORD_API}/oauth2/token/revoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        },
        body: new URLSearchParams({ token: session.accessToken, token_type_hint: 'access_token' }),
      }).catch(() => {});
    }
    if (sessionId) sessions.delete(sessionId);
    clearCookie(res, 'luckers_session');
    res.json({ ok: true });
  });

  app.get('/api/public/config', (_req, res) => res.json({
    authConfigured: Boolean(clientId && clientSecret),
    demoMode,
    botReady: client.isReady(),
    botName: client.user?.username || 'Luckers Bot',
  }));

  app.get('/api/me', requireAuth, (req, res) => {
    const user = req.dashboardSession.user;
    res.json({
      id: user.id,
      username: user.username,
      displayName: user.global_name || user.username,
      avatar: avatarUrl(user),
      demo: Boolean(req.dashboardSession.demo),
    });
  });

  app.get('/api/guilds', requireAuth, (req, res) => {
    const guilds = req.dashboardSession.guilds
      .filter(hasGuildPermission)
      .map(oauthGuild => {
        const guild = client.guilds.cache.get(oauthGuild.id);
        if (!guild) return null;
        return {
          id: guild.id,
          name: guild.name,
          icon: guildIconUrl(guild),
          memberCount: guild.memberCount,
          owner: Boolean(oauthGuild.owner),
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    res.json(guilds);
  });

  app.get('/api/dashboard/:guildId', requireAuth, requireGuild, async (req, res) => {
    const guild = req.dashboardGuild;
    const config = guildData(guild.id);
    const configuredTicketTypes = config.ticketTypes || ticketTypes;
    const tickets = Object.values(db.tickets).filter(ticket => ticket.guildId === guild.id);
    const sortedTickets = [...tickets].sort((a, b) => (b.openedAt || 0) - (a.openedAt || 0));
    const openTickets = tickets.filter(ticket => ticket.status === 'open');
    const closedTickets = tickets.filter(ticket => ticket.status === 'closed');
    const responseTimes = tickets.filter(ticket => ticket.firstResponseAt && ticket.openedAt).map(ticket => ticket.firstResponseAt - ticket.openedAt);
    const ratings = closedTickets.map(ticket => Number(ticket.rating)).filter(value => value > 0);

    const today = getDayStart();
    const yesterday = today - 86_400_000;
    const todayOpened = tickets.filter(ticket => ticket.openedAt >= today).length;
    const yesterdayOpened = tickets.filter(ticket => ticket.openedAt >= yesterday && ticket.openedAt < today).length;
    const currentWeekResponses = tickets.filter(ticket => ticket.firstResponseAt >= today - 7 * 86_400_000 && ticket.openedAt).map(ticket => ticket.firstResponseAt - ticket.openedAt);
    const previousWeekResponses = tickets.filter(ticket => ticket.firstResponseAt >= today - 14 * 86_400_000 && ticket.firstResponseAt < today - 7 * 86_400_000 && ticket.openedAt).map(ticket => ticket.firstResponseAt - ticket.openedAt);
    const currentRatings = closedTickets.filter(ticket => ticket.closedAt >= today - 30 * 86_400_000 && ticket.rating).map(ticket => Number(ticket.rating));
    const previousRatings = closedTickets.filter(ticket => ticket.closedAt >= today - 60 * 86_400_000 && ticket.closedAt < today - 30 * 86_400_000 && ticket.rating).map(ticket => Number(ticket.rating));

    const activity = [];
    for (let offset = 6; offset >= 0; offset -= 1) {
      const start = today - offset * 86_400_000;
      const end = start + 86_400_000;
      const date = new Date(start);
      activity.push({
        label: date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '').replace(/^./, char => char.toUpperCase()),
        value: tickets.filter(ticket => ticket.openedAt >= start && ticket.openedAt < end).length,
      });
    }

    const categoryStats = Object.entries(configuredTicketTypes).map(([id, type]) => ({
      id,
      label: type.label,
      emoji: type.emoji,
      total: tickets.filter(ticket => ticket.type === id).length,
      open: openTickets.filter(ticket => ticket.type === id).length,
    }));

    const visibleTickets = sortedTickets.slice(0, 100);
    const userIds = [...new Set(visibleTickets.flatMap(ticket => [ticket.ownerId, ticket.claimedBy]).filter(Boolean))];
    const users = new Map((await Promise.all(userIds.slice(0, 80).map(id => userSummary(client, id)))).filter(Boolean).map(user => [user.id, user]));
    const enrichedTickets = visibleTickets.map(ticket => ({
      id: ticket.id,
      displayId: ticket.displayId || ticket.id,
      subject: ticket.subject || 'Sem assunto',
      description: ticket.reason || '',
      type: ticket.type || 'outros',
      category: configuredTicketTypes[ticket.type]?.label || ticket.type || 'Outros',
      categoryEmoji: configuredTicketTypes[ticket.type]?.emoji || '🎫',
      priority: ticket.priority || 'normal',
      status: derivedStatus(ticket),
      rawStatus: ticket.status,
      openedAt: ticket.openedAt || null,
      firstResponseAt: ticket.firstResponseAt || null,
      closedAt: ticket.closedAt || null,
      rating: ticket.rating || null,
      owner: users.get(ticket.ownerId) || { id: ticket.ownerId, displayName: 'Usuário', avatar: null },
      assignee: users.get(ticket.claimedBy) || null,
      supportRoleId: ticket.supportRoleId || configuredTicketTypes[ticket.type]?.roleId || config.supportRoleId || null,
      channelId: ticket.channelId,
      discordUrl: ticket.channelId ? `https://discord.com/channels/${guild.id}/${ticket.channelId}` : null,
    }));

    const audits = auditFor(guild.id).slice(-80).reverse();
    const auditActorIds = [...new Set(audits.map(item => item.actorId).filter(Boolean))];
    const auditUsers = new Map((await Promise.all(auditActorIds.slice(0, 40).map(id => userSummary(client, id)))).filter(Boolean).map(user => [user.id, user]));

    res.json({
      guild: {
        id: guild.id,
        name: guild.name,
        icon: guild.iconURL({ extension: 'png', size: 128 }),
        memberCount: guild.memberCount,
      },
      bot: {
        online: client.isReady(),
        ping: client.ws.ping,
        uptime: process.uptime(),
        name: client.user?.username || 'Luckers Bot',
        avatar: client.user?.displayAvatarURL({ extension: 'png', size: 128 }) || null,
      },
      stats: {
        open: openTickets.length,
        total: tickets.length,
        closed: closedTickets.length,
        averageResponse: responseTimes.length ? formatDuration(average(responseTimes)) : 'Sem dados',
        averageResponseMs: average(responseTimes),
        satisfaction: ratings.length ? Math.round((average(ratings) / 5) * 100) : null,
        averageRating: ratings.length ? Number(average(ratings).toFixed(1)) : null,
        todayOpened,
        openDelta: todayOpened - yesterdayOpened,
        responseDelta: currentWeekResponses.length && previousWeekResponses.length
          ? percentageDelta(average(currentWeekResponses), average(previousWeekResponses)) : 0,
        satisfactionDelta: currentRatings.length && previousRatings.length
          ? percentageDelta(average(currentRatings), average(previousRatings)) : 0,
      },
      activity,
      categories: categoryStats,
      recentTickets: enrichedTickets.slice(0, 5),
      tickets: enrichedTickets,
      config: sanitizeConfig(config),
      resources: {
        textChannels: [...guild.channels.cache.values()].filter(channel => channel.isTextBased() && !channel.isThread()).map(channel => ({ id: channel.id, name: channel.name, parentId: channel.parentId })).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
        categories: [...guild.channels.cache.values()].filter(channel => channel.type === 4).map(channel => ({ id: channel.id, name: channel.name })).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
        roles: [...guild.roles.cache.values()].filter(role => role.id !== guild.id && !role.managed).map(role => ({ id: role.id, name: role.name, color: role.hexColor })).sort((a, b) => b.position - a.position),
      },
      audits: audits.map(item => ({ ...item, actor: auditUsers.get(item.actorId) || null })),
    });
  });

  app.patch('/api/config/:guildId', requireAuth, requireSameOrigin, requireGuild, (req, res) => {
    const guild = req.dashboardGuild;
    const config = guildData(guild.id);
    const body = req.body || {};
    const booleanFields = ['antiLink', 'antiSpam', 'antiSwear'];
    for (const field of booleanFields) if (typeof body[field] === 'boolean') config[field] = body[field];

    if (Number.isInteger(body.spamLimit)) config.spamLimit = Math.min(10, Math.max(3, body.spamLimit));
    if (Number.isInteger(body.spamWindowSeconds)) config.spamWindowSeconds = Math.min(30, Math.max(3, body.spamWindowSeconds));
    if (Number.isInteger(body.spamMuteDuration)) config.spamMuteDuration = Math.min(1440, Math.max(1, body.spamMuteDuration));
    if (Array.isArray(body.allowedLinkDomains)) config.allowedLinkDomains = sanitizeAllowedDomains(body.allowedLinkDomains);
    if (Number.isInteger(body.swearWarnCount)) config.swearWarnCount = Math.min(10, Math.max(1, body.swearWarnCount));
    if (Number.isInteger(body.swearMuteDuration)) config.swearMuteDuration = Math.min(1440, Math.max(1, body.swearMuteDuration));
    if (Number.isInteger(body.swearWarnWindowHours)) config.swearWarnWindowHours = Math.min(720, Math.max(1, body.swearWarnWindowHours));
    if (Array.isArray(body.swearWords)) config.swearWords = sanitizeBlockedTerms(body.swearWords);
    if (['delete', 'warn', 'timeout'].includes(body.swearAction)) config.swearAction = body.swearAction;
    if (typeof body.swearNotice === 'string') config.swearNotice = body.swearNotice.trim().slice(0, 180) || 'Sua mensagem foi removida por conter conteúdo bloqueado.';
    if (Number.isInteger(body.maxOpenTickets)) config.maxOpenTickets = Math.min(5, Math.max(1, body.maxOpenTickets));
    if (typeof body.ticketPanelTitle === 'string') config.ticketPanelTitle = body.ticketPanelTitle.trim().slice(0, 256) || config.ticketPanelTitle;
    if (typeof body.ticketPanelDescription === 'string') config.ticketPanelDescription = body.ticketPanelDescription.trim().slice(0, 3000) || config.ticketPanelDescription;
    if (typeof body.ticketPanelColor === 'string' && /^#[0-9a-f]{6}$/i.test(body.ticketPanelColor)) config.ticketPanelColor = body.ticketPanelColor.toUpperCase();
    if (typeof body.dashboardAccent === 'string' && /^#[0-9a-f]{6}$/i.test(body.dashboardAccent)) config.dashboardAccent = body.dashboardAccent.toUpperCase();
    if ('ticketPanelBanner' in body) config.ticketPanelBanner = validateUrl(body.ticketPanelBanner);
    if ('ticketPanelThumbnail' in body) config.ticketPanelThumbnail = validateUrl(body.ticketPanelThumbnail);
    if (typeof body.ticketPanelMenuPlaceholder === 'string') config.ticketPanelMenuPlaceholder = body.ticketPanelMenuPlaceholder.trim().slice(0, 150) || config.ticketPanelMenuPlaceholder;
    if (typeof body.ticketPanelSectorsTitle === 'string') config.ticketPanelSectorsTitle = body.ticketPanelSectorsTitle.trim().slice(0, 256) || config.ticketPanelSectorsTitle;
    if (typeof body.ticketPanelHowTitle === 'string') config.ticketPanelHowTitle = body.ticketPanelHowTitle.trim().slice(0, 256) || config.ticketPanelHowTitle;
    if (typeof body.ticketPanelHowText === 'string') config.ticketPanelHowText = body.ticketPanelHowText.trim().slice(0, 1000) || config.ticketPanelHowText;
    if (typeof body.ticketPanelFooter === 'string') config.ticketPanelFooter = body.ticketPanelFooter.trim().slice(0, 200) || null;
    if (body.ticketTypes && typeof body.ticketTypes === 'object' && !Array.isArray(body.ticketTypes)) {
      const validPriorities = ['baixa', 'normal', 'alta', 'urgente'];
      const cleaned = {};
      for (const [id, type] of Object.entries(body.ticketTypes)) {
        if (Object.keys(cleaned).length >= 25) break;
        if (!type || typeof type !== 'object' || typeof type.label !== 'string' || !type.label.trim()) continue;
        const safeId = String(id).toLowerCase().replace(/[^a-z0-9_-]/g, '_').replace(/_+/g, '_').slice(0, 32);
        if (!safeId || safeId === '__proto__' || safeId === 'constructor') continue;
        cleaned[safeId] = {
          label: type.label.trim().slice(0, 80),
          emoji: ((typeof type.emoji === 'string' ? type.emoji.trim() : '') || '🎫').slice(0, 32),
          description: ((typeof type.description === 'string' ? type.description.trim() : '') || 'Abra um atendimento com esta equipe.').slice(0, 100),
          priority: validPriorities.includes(type.priority) ? type.priority : 'normal',
          roleId: type.roleId && guild.roles.cache.has(type.roleId) && !guild.roles.cache.get(type.roleId)?.managed ? type.roleId : null,
        };
      }
      if (Object.keys(cleaned).length > 0) config.ticketTypes = cleaned;
    }

    const channelFields = ['logsChannelId', 'ticketPanelChannelId', 'ticketReviewChannelId', 'welcomeChannelId', 'leaveChannelId', 'suggestionsChannelId'];
    for (const field of channelFields) {
      if (!(field in body)) continue;
      const channel = body[field] ? guild.channels.cache.get(body[field]) : null;
      config[field] = channel?.isTextBased() ? channel.id : null;
    }
    if ('ticketCategoryId' in body) {
      const category = body.ticketCategoryId ? guild.channels.cache.get(body.ticketCategoryId) : null;
      config.ticketCategoryId = category?.type === 4 ? category.id : null;
    }
    for (const field of ['supportRoleId', 'autoRoleId']) {
      if (!(field in body)) continue;
      const role = body[field] ? guild.roles.cache.get(body[field]) : null;
      config[field] = role && role.id !== guild.id && !role.managed ? role.id : null;
    }
    if (Array.isArray(body.swearExemptChannelIds)) {
      config.swearExemptChannelIds = [...new Set(body.swearExemptChannelIds)]
        .filter(id => guild.channels.cache.get(id)?.isTextBased()).slice(0, 25);
    }
    if (Array.isArray(body.swearExemptRoleIds)) {
      config.swearExemptRoleIds = [...new Set(body.swearExemptRoleIds)]
        .filter(id => guild.roles.cache.has(id) && id !== guild.id && !guild.roles.cache.get(id)?.managed).slice(0, 25);
    }

    save();
    recordAudit(guild.id, {
      type: 'settings',
      title: 'Configuração alterada pelo dashboard',
      description: 'As configurações do servidor foram atualizadas.',
      actorId: req.dashboardSession.user.id,
    });
    res.json({ ok: true, config: sanitizeConfig(config) });
  });

  app.post('/api/moderation/:guildId/test', requireAuth, requireSameOrigin, requireGuild, (req, res) => {
    const text = typeof req.body?.text === 'string' ? req.body.text.slice(0, 2000) : '';
    const configuredWords = guildData(req.dashboardGuild.id).swearWords;
    const words = Array.isArray(req.body?.words) ? sanitizeBlockedTerms(req.body.words) : configuredWords;
    const match = detectBlockedTerm(text, words);
    res.json({ matched: Boolean(match), term: match?.term || null });
  });

  app.post('/api/panel/:guildId/publish', requireAuth, requireSameOrigin, requireGuild, async (req, res) => {
    try {
      const guild = req.dashboardGuild;
      const config = guildData(guild.id);
      const requestedChannelId = req.body?.channelId || config.ticketPanelChannelId;
      const channel = guild.channels.cache.get(requestedChannelId);
      if (!channel?.isTextBased()) return res.status(400).json({ error: 'PANEL_CHANNEL_REQUIRED' });
      config.ticketPanelChannelId = channel.id;
      save();
      await publishTicketPanel(guild, channel);
      recordAudit(guild.id, {
        type: 'ticket',
        title: 'Painel de tickets publicado',
        description: `Painel publicado em #${channel.name}.`,
        actorId: req.dashboardSession.user.id,
      });
      res.json({ ok: true, channelId: channel.id });
    } catch (error) {
      console.error('[DASHBOARD PUBLISH]', error);
      res.status(500).json({ error: 'PUBLISH_FAILED' });
    }
  });

  app.post('/api/tickets/:guildId/:ticketId/claim', requireAuth, requireSameOrigin, requireGuild, async (req, res) => {
    const ticket = db.tickets[req.params.ticketId];
    if (!ticket || ticket.guildId !== req.dashboardGuild.id || ticket.status !== 'open') return res.status(404).json({ error: 'TICKET_NOT_FOUND' });
    ticket.claimedBy = req.dashboardSession.user.id;
    ticket.claimedAt = Date.now();
    save();
    const channel = req.dashboardGuild.channels.cache.get(ticket.channelId);
    if (channel?.isTextBased()) {
      await channel.setTopic(buildTicketTopic(ticket)).catch(() => {});
      await channel.send(`🙋 <@${req.dashboardSession.user.id}> assumiu este atendimento pelo dashboard.`).catch(() => {});
    }
    recordAudit(req.dashboardGuild.id, {
      type: 'ticket',
      title: `${ticket.displayId || ticket.id} assumido`,
      description: 'O atendimento foi assumido pelo dashboard.',
      actorId: req.dashboardSession.user.id,
    });
    res.json({ ok: true });
  });

  app.post('/api/tickets/:guildId/:ticketId/release', requireAuth, requireSameOrigin, requireGuild, async (req, res) => {
    const ticket = db.tickets[req.params.ticketId];
    if (!ticket || ticket.guildId !== req.dashboardGuild.id || ticket.status !== 'open') return res.status(404).json({ error: 'TICKET_NOT_FOUND' });
    ticket.claimedBy = null;
    ticket.claimedAt = null;
    save();
    const channel = req.dashboardGuild.channels.cache.get(ticket.channelId);
    if (channel?.isTextBased()) {
      await channel.setTopic(buildTicketTopic(ticket)).catch(() => {});
      await channel.send(`↩️ <@${req.dashboardSession.user.id}> liberou este atendimento pelo dashboard.`).catch(() => {});
    }
    recordAudit(req.dashboardGuild.id, {
      type: 'ticket',
      title: `${ticket.displayId || ticket.id} liberado`,
      description: 'O atendimento voltou para a fila.',
      actorId: req.dashboardSession.user.id,
    });
    res.json({ ok: true });
  });

  app.patch('/api/tickets/:guildId/:ticketId', requireAuth, requireSameOrigin, requireGuild, async (req, res) => {
    const ticket = db.tickets[req.params.ticketId];
    if (!ticket || ticket.guildId !== req.dashboardGuild.id) return res.status(404).json({ error: 'TICKET_NOT_FOUND' });
    if (['baixa', 'normal', 'alta', 'urgente'].includes(req.body?.priority)) ticket.priority = req.body.priority;
    const channel = req.dashboardGuild.channels.cache.get(ticket.channelId);
    let roleChanged = false;
    if ('supportRoleId' in (req.body || {})) {
      const role = req.body.supportRoleId ? req.dashboardGuild.roles.cache.get(req.body.supportRoleId) : null;
      if (!role || role.id === req.dashboardGuild.id || role.managed) return res.status(400).json({ error: 'INVALID_SUPPORT_ROLE' });
      const config = guildData(req.dashboardGuild.id);
      const previousRoleId = ticket.supportRoleId || config.ticketTypes?.[ticket.type]?.roleId || config.supportRoleId;
      roleChanged = previousRoleId !== role.id;
      if (channel?.isTextBased() && roleChanged) {
        const permissionUpdated = await channel.permissionOverwrites.edit(role.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true, ManageMessages: true }).then(() => true).catch(() => false);
        if (!permissionUpdated) return res.status(500).json({ error: 'ROLE_PERMISSION_UPDATE_FAILED' });
        if (previousRoleId) await channel.permissionOverwrites.delete(previousRoleId, 'Cargo responsável alterado pelo dashboard').catch(() => {});
        await channel.send({ content: `👥 O cargo responsável por este ticket agora é <@&${role.id}>.`, allowedMentions: { roles: [role.id] } }).catch(() => {});
      }
      ticket.supportRoleId = role.id;
    }
    save();
    if (channel?.isTextBased()) await channel.setTopic(buildTicketTopic(ticket)).catch(() => {});
    recordAudit(req.dashboardGuild.id, {
      type: 'ticket',
      title: `${ticket.displayId || ticket.id} atualizado`,
      description: roleChanged ? `Cargo responsável alterado. Prioridade atual: ${ticket.priority}.` : `Prioridade alterada para ${ticket.priority}.`,
      actorId: req.dashboardSession.user.id,
    });
    res.json({ ok: true, priority: ticket.priority, supportRoleId: ticket.supportRoleId || null });
  });

  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [id, session] of sessions) {
      if (now - session.createdAt > 30 * 24 * 60 * 60_000) sessions.delete(id);
    }
  }, 60 * 60_000);
  cleanup.unref();
}
