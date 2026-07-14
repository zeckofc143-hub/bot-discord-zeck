import assert from 'node:assert/strict';
import test from 'node:test';
import {
  detectBlockedTerm,
  findBlockedLink,
  moderationSkeleton,
  sanitizeAllowedDomains,
  sanitizeBlockedTerms,
} from '../src/moderation.js';

test('filtro detecta desvios com leetspeak, símbolos e repetições', () => {
  const terms = ['porra'];
  for (const text of ['porr4', 'p0r64', 'p.o.r.r.a', 'poooorrra', 'PÔRRA']) {
    assert.equal(detectBlockedTerm(text, terms)?.term, 'porra', `deveria detectar ${text}`);
  }
});

test('filtro respeita limites de palavra para evitar falso positivo', () => {
  assert.equal(detectBlockedTerm('meu computador chegou', ['puta']), null);
  assert.equal(detectBlockedTerm('isso aconteceu por acaso', ['porra']), null);
  assert.equal(detectBlockedTerm('isso é puta sacanagem', ['puta'])?.term, 'puta');
});

test('lista bloqueada é limpa e deduplicada pelo formato normalizado', () => {
  assert.deepEqual(sanitizeBlockedTerms([' Porra ', 'p0rr4', '', 'a']), ['Porra']);
  assert.equal(moderationSkeleton('p0r64'), 'pora');
});

test('anti-link permite somente domínios explicitamente liberados', () => {
  const allowed = sanitizeAllowedDomains(['https://youtube.com/', 'www.exemplo.com']);
  assert.deepEqual(allowed, ['youtube.com', 'exemplo.com']);
  assert.equal(findBlockedLink('veja https://music.youtube.com/abc', allowed), null);
  assert.equal(findBlockedLink('entre em discord.gg/teste', allowed), 'discord.gg/teste');
});
