import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { commandsJson } from './commands.js';

if (!process.env.DISCORD_TOKEN) throw new Error('DISCORD_TOKEN não definido.');

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
const currentUser = await rest.get(Routes.user());
const route = process.env.TEST_GUILD_ID
  ? Routes.applicationGuildCommands(currentUser.id, process.env.TEST_GUILD_ID)
  : Routes.applicationCommands(currentUser.id);

await rest.put(route, { body: commandsJson });
console.log(`✅ ${commandsJson.length} comandos registrados ${process.env.TEST_GUILD_ID ? 'no servidor de testes' : 'globalmente'}.`);
