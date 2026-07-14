import assert from 'node:assert/strict';
import test from 'node:test';
import { commandsJson } from '../src/commands.js';

test('nomes de comandos são únicos', () => {
  const names = commandsJson.map(command => command.name);
  assert.equal(new Set(names).size, names.length);
});

test('comandos administrativos têm permissões padrão', () => {
  for (const name of ['central', 'falar', 'configurar', 'painel-ticket', 'mod']) {
    const command = commandsJson.find(item => item.name === name);
    assert.ok(command, `${name} deve existir`);
    assert.ok(command.default_member_permissions, `${name} deve exigir permissão`);
  }
});

test('opções obrigatórias aparecem antes das opcionais', () => {
  function validate(options = []) {
    let optionalSeen = false;
    for (const option of options) {
      if (!option.required) optionalSeen = true;
      if (option.required) assert.equal(optionalSeen, false, `ordem inválida em ${option.name}`);
      validate(option.options);
    }
  }
  for (const command of commandsJson) validate(command.options);
});

test('ticket possui o fluxo profissional completo', () => {
  const ticket = commandsJson.find(command => command.name === 'ticket');
  const names = ticket.options.map(option => option.name);
  for (const required of ['fechar', 'assumir', 'liberar', 'adicionar', 'remover', 'renomear', 'prioridade', 'nota', 'transcript', 'estatisticas']) {
    assert.ok(names.includes(required), `subcomando ausente: ${required}`);
  }
});

test('painel de ticket pode ser personalizado', () => {
  const configure = commandsJson.find(command => command.name === 'configurar');
  const panel = configure.options.find(option => option.name === 'painel_ticket');
  assert.ok(panel);
  const names = panel.options.map(option => option.name);
  for (const required of ['titulo', 'descricao', 'cor', 'banner', 'miniatura', 'limite']) assert.ok(names.includes(required));
});

test('dashboard possui comando administrativo', () => {
  const dashboard = commandsJson.find(command => command.name === 'dashboard');
  assert.ok(dashboard, 'comando /dashboard deve existir');
  assert.ok(dashboard.default_member_permissions, '/dashboard deve exigir permissão administrativa');
});
