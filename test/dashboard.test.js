import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const html = fs.readFileSync(new URL('../public/dashboard/index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../public/dashboard/styles.css', import.meta.url), 'utf8');
const js = fs.readFileSync(new URL('../public/dashboard/app.js', import.meta.url), 'utf8');

test('dashboard inclui todas as áreas principais', () => {
  for (const page of ['overview', 'tickets', 'appearance', 'protections', 'community', 'logs']) {
    assert.match(html, new RegExp(`data-page-panel="${page}"`));
  }
});

test('dashboard é responsivo e respeita redução de movimento', () => {
  assert.match(css, /@media \(max-width: 860px\)/);
  assert.match(css, /prefers-reduced-motion/);
});

test('frontend usa endpoints protegidos do dashboard', () => {
  assert.match(js, /\/api\/dashboard\//);
  assert.match(js, /\/api\/config\//);
  assert.match(js, /\/api\/panel\//);
  assert.match(js, /\/api\/moderation\//);
});

test('todos os controles estáticos usados pelo frontend existem no HTML', () => {
  const ids = [...js.matchAll(/\$\('#([a-z0-9-]+)'\)/gi)].map(match => match[1]);
  for (const id of new Set(ids)) assert.match(html, new RegExp(`id=["']${id}["']`), `controle ausente: ${id}`);
});

test('dashboard permite configurar filtro avançado e cargo dos tickets', () => {
  for (const id of ['anti-swear-input', 'swear-word-input', 'swear-test-input', 'swear-action-input', 'support-role-input', 'appearance-review-channel-input']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(js, /data-role-ticket/);
  assert.match(js, /data-field="roleId"/);
});
