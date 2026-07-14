import { commandsJson } from './commands.js';

const names = new Set();
for (const command of commandsJson) {
  if (names.has(command.name)) throw new Error(`Comando duplicado: ${command.name}`);
  names.add(command.name);
  if (!command.description || command.description.length > 100) throw new Error(`Descrição inválida: ${command.name}`);
  if ((command.options?.length || 0) > 25) throw new Error(`Opções demais: ${command.name}`);
}

console.log(`✅ ${commandsJson.length} comandos validados.`);
