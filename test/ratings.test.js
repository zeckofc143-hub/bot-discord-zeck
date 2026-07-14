import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const bot = fs.readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
const dashboard = fs.readFileSync(new URL('../src/dashboard.js', import.meta.url), 'utf8');
const database = fs.readFileSync(new URL('../src/database.js', import.meta.url), 'utf8');

test('avaliação exige estrelas e aceita comentário opcional', () => {
  assert.match(bot, /ticket_rating_modal:/);
  assert.match(bot, /setCustomId\('rating_comment'\)/);
  assert.match(bot, /setRequired\(false\)/);
  assert.match(bot, /record\.ratingComment = comment \|\| null/);
});

test('avaliação é publicada no canal escolhido no dashboard', () => {
  assert.match(bot, /ticketReviewChannelId/);
  assert.match(bot, /Nova avaliação do suporte/);
  assert.match(dashboard, /ticketReviewChannelId/);
  assert.match(database, /ticketReviewChannelId: null/);
});

test('ticket aceita apenas uma avaliação', () => {
  assert.match(bot, /if \(record\.rating\).*já avaliou este atendimento/);
});
