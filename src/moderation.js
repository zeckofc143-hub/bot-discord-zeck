const CHAR_MAP = new Map(Object.entries({
  '0': 'o', '1': 'i', '2': 'z', '3': 'e', '4': 'a', '5': 's',
  '6': 'r', '7': 't', '8': 'b', '9': 'g', '@': 'a', '$': 's',
  '!': 'i', '|': 'i', '+': 't',
  'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'х': 'x', 'у': 'y',
}));

export function foldModerationText(value = '') {
  const source = String(value).toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '');
  let result = '';
  for (const character of source) {
    const mapped = CHAR_MAP.get(character) ?? character;
    result += /[a-z]/.test(mapped) ? mapped : ' ';
  }
  return result.replace(/\s+/g, ' ').trim();
}

export function moderationSkeleton(value = '') {
  return foldModerationText(value).replace(/[^a-z]/g, '').replace(/(.)\1+/g, '$1');
}

function matchesBlockedTerm(textTokens, term) {
  const termTokens = foldModerationText(term).split(' ').filter(Boolean).map(moderationSkeleton);
  if (!termTokens.length) return false;

  if (termTokens.length > 1) {
    for (let start = 0; start <= textTokens.length - termTokens.length; start += 1) {
      if (termTokens.every((token, offset) => moderationSkeleton(textTokens[start + offset]) === token)) return true;
    }
    return false;
  }

  const target = termTokens[0];
  const skeletons = textTokens.map(moderationSkeleton);
  if (skeletons.includes(target)) return true;

  // Detecta letras separadas sem juntar palavras normais inteiras, reduzindo falsos positivos.
  for (let start = 0; start < skeletons.length; start += 1) {
    let joined = '';
    for (let index = start; index < skeletons.length; index += 1) {
      const token = skeletons[index];
      if (!token || token.length > 2) break;
      joined += token;
      const collapsed = joined.replace(/(.)\1+/g, '$1');
      if (collapsed === target) return true;
      if (collapsed.length >= target.length || !target.startsWith(collapsed)) break;
    }
  }
  return false;
}

export function sanitizeBlockedTerms(values, limit = 100) {
  const result = [];
  const seen = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    if (typeof value !== 'string') continue;
    const term = value.trim().replace(/\s+/g, ' ').slice(0, 60);
    const skeleton = moderationSkeleton(term);
    if (skeleton.length < 2 || seen.has(skeleton)) continue;
    seen.add(skeleton);
    result.push(term);
    if (result.length >= limit) break;
  }
  return result;
}

export function detectBlockedTerm(text, terms) {
  const folded = foldModerationText(text);
  if (!folded) return null;
  const textTokens = folded.split(' ').filter(Boolean);
  for (const term of sanitizeBlockedTerms(terms)) {
    if (matchesBlockedTerm(textTokens, term)) return { term, normalizedText: folded };
  }
  return null;
}

export function sanitizeAllowedDomains(values, limit = 50) {
  const result = [];
  const seen = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    if (typeof value !== 'string') continue;
    let domain = value.trim().toLowerCase();
    if (!domain) continue;
    try {
      domain = new URL(domain.includes('://') ? domain : `https://${domain}`).hostname;
    } catch {
      continue;
    }
    domain = domain.replace(/^www\./, '').replace(/\.$/, '');
    if (!domain || seen.has(domain)) continue;
    seen.add(domain);
    result.push(domain.slice(0, 253));
    if (result.length >= limit) break;
  }
  return result;
}

function isAllowedDomain(hostname, allowedDomains) {
  const host = hostname.toLowerCase().replace(/^www\./, '');
  return allowedDomains.some(domain => host === domain || host.endsWith(`.${domain}`));
}

export function findBlockedLink(text, allowedDomains = []) {
  const allowed = sanitizeAllowedDomains(allowedDomains);
  const candidates = String(text).match(/(?:https?:\/\/|www\.|discord\.gg\/|discord(?:app)?\.com\/invite\/)[^\s<>()]+/gi) || [];
  for (const candidate of candidates) {
    const raw = candidate.replace(/[),.;!?]+$/, '');
    try {
      const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
      if (!isAllowedDomain(url.hostname, allowed)) return raw;
    } catch {
      return raw;
    }
  }
  return null;
}
