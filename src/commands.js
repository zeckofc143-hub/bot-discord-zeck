import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

const textChannel = option => option.addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement);

export const commandBuilders = [
  new SlashCommandBuilder().setName('ajuda').setDescription('Mostra todos os sistemas e comandos do bot'),
  new SlashCommandBuilder().setName('ping').setDescription('Mostra a latência e o estado do bot'),
  new SlashCommandBuilder().setName('servidor').setDescription('Mostra informações profissionais do servidor'),
  new SlashCommandBuilder().setName('usuario').setDescription('Mostra informações de um usuário')
    .addUserOption(o => o.setName('membro').setDescription('Membro opcional')),
  new SlashCommandBuilder().setName('central').setDescription('Abre o painel visual para configurar e administrar o bot')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder().setName('dashboard').setDescription('Abre o dashboard web administrativo do bot')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder().setName('falar').setDescription('Abre uma caixa para o bot publicar uma mensagem')
    .addChannelOption(o => textChannel(o.setName('canal').setDescription('Canal de destino; o atual é o padrão')))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder().setName('configurar').setDescription('Configura os sistemas do bot')
    .addSubcommand(s => s.setName('principal').setDescription('Configura logs e tickets')
      .addChannelOption(o => textChannel(o.setName('canal_logs').setDescription('Canal dos logs').setRequired(true)))
      .addChannelOption(o => o.setName('categoria_tickets').setDescription('Categoria dos tickets').addChannelTypes(ChannelType.GuildCategory).setRequired(true))
      .addRoleOption(o => o.setName('cargo_suporte').setDescription('Cargo da equipe de suporte').setRequired(true)))
    .addSubcommand(s => s.setName('comunidade').setDescription('Configura boas-vindas, saídas, cargo automático e sugestões')
      .addChannelOption(o => textChannel(o.setName('boas_vindas').setDescription('Canal de boas-vindas')))
      .addChannelOption(o => textChannel(o.setName('saidas').setDescription('Canal de saídas')))
      .addRoleOption(o => o.setName('cargo_automatico').setDescription('Cargo entregue ao entrar'))
      .addChannelOption(o => textChannel(o.setName('sugestoes').setDescription('Canal de sugestões'))))
    .addSubcommand(s => s.setName('protecao').setDescription('Configura anti-link e anti-spam')
      .addBooleanOption(o => o.setName('anti_link').setDescription('Apagar links enviados por membros'))
      .addBooleanOption(o => o.setName('anti_spam').setDescription('Conter spam automaticamente'))
      .addIntegerOption(o => o.setName('limite_spam').setDescription('Mensagens em 8 segundos').setMinValue(3).setMaxValue(10)))
    .addSubcommand(s => s.setName('painel_ticket').setDescription('Personaliza a aparência e os limites do painel de tickets')
      .addStringOption(o => o.setName('titulo').setDescription('Título do painel').setMaxLength(256))
      .addStringOption(o => o.setName('descricao').setDescription('Texto principal do painel').setMaxLength(3000))
      .addStringOption(o => o.setName('cor').setDescription('Cor hexadecimal, exemplo: #5865F2').setMaxLength(7))
      .addStringOption(o => o.setName('banner').setDescription('URL da imagem grande do painel').setMaxLength(500))
      .addStringOption(o => o.setName('miniatura').setDescription('URL da miniatura do painel').setMaxLength(500))
      .addIntegerOption(o => o.setName('limite').setDescription('Máximo de tickets abertos por membro').setMinValue(1).setMaxValue(5)))
    .addSubcommand(s => s.setName('ver').setDescription('Mostra a configuração atual'))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder().setName('painel-ticket').setDescription('Publica o painel profissional de atendimento')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder().setName('ticket').setDescription('Gerencia o ticket atual')
    .addSubcommand(s => s.setName('fechar').setDescription('Abre o formulário de finalização do ticket'))
    .addSubcommand(s => s.setName('assumir').setDescription('Marca você como responsável pelo ticket'))
    .addSubcommand(s => s.setName('liberar').setDescription('Libera o ticket para outro atendente'))
    .addSubcommand(s => s.setName('adicionar').setDescription('Adiciona um membro ao ticket').addUserOption(o => o.setName('membro').setDescription('Membro').setRequired(true)))
    .addSubcommand(s => s.setName('remover').setDescription('Remove um membro do ticket').addUserOption(o => o.setName('membro').setDescription('Membro').setRequired(true)))
    .addSubcommand(s => s.setName('renomear').setDescription('Altera o nome do canal').addStringOption(o => o.setName('nome').setDescription('Novo nome').setMinLength(2).setMaxLength(40).setRequired(true)))
    .addSubcommand(s => s.setName('prioridade').setDescription('Altera a prioridade do atendimento').addStringOption(o => o.setName('nivel').setDescription('Prioridade').setRequired(true).addChoices(
      { name: '🟢 Baixa', value: 'baixa' }, { name: '🟡 Normal', value: 'normal' }, { name: '🟠 Alta', value: 'alta' }, { name: '🔴 Urgente', value: 'urgente' },
    )))
    .addSubcommand(s => s.setName('nota').setDescription('Registra uma nota interna visível somente nos logs').addStringOption(o => o.setName('texto').setDescription('Nota interna').setMaxLength(1000).setRequired(true)))
    .addSubcommand(s => s.setName('transcript').setDescription('Gera as transcrições TXT e HTML sem fechar'))
    .addSubcommand(s => s.setName('estatisticas').setDescription('Mostra as métricas da central de atendimento')),
  new SlashCommandBuilder().setName('mod').setDescription('Ferramentas de moderação')
    .addSubcommand(s => s.setName('limpar').setDescription('Apaga mensagens').addIntegerOption(o => o.setName('quantidade').setDescription('De 1 a 100').setMinValue(1).setMaxValue(100).setRequired(true)))
    .addSubcommand(s => s.setName('kick').setDescription('Expulsa um membro').addUserOption(o => o.setName('membro').setDescription('Membro').setRequired(true)).addStringOption(o => o.setName('motivo').setDescription('Motivo').setMaxLength(500)))
    .addSubcommand(s => s.setName('ban').setDescription('Bane um membro').addUserOption(o => o.setName('membro').setDescription('Membro').setRequired(true)).addStringOption(o => o.setName('motivo').setDescription('Motivo').setMaxLength(500)))
    .addSubcommand(s => s.setName('timeout').setDescription('Silencia temporariamente um membro').addUserOption(o => o.setName('membro').setDescription('Membro').setRequired(true)).addIntegerOption(o => o.setName('minutos').setDescription('De 1 a 40320').setMinValue(1).setMaxValue(40320).setRequired(true)).addStringOption(o => o.setName('motivo').setDescription('Motivo').setMaxLength(500)))
    .addSubcommand(s => s.setName('avisar').setDescription('Registra um aviso no histórico').addUserOption(o => o.setName('membro').setDescription('Membro').setRequired(true)).addStringOption(o => o.setName('motivo').setDescription('Motivo').setMaxLength(500).setRequired(true)))
    .addSubcommand(s => s.setName('avisos').setDescription('Mostra o histórico de avisos').addUserOption(o => o.setName('membro').setDescription('Membro').setRequired(true)))
    .addSubcommand(s => s.setName('remover_aviso').setDescription('Remove um aviso pelo número do caso').addUserOption(o => o.setName('membro').setDescription('Membro').setRequired(true)).addIntegerOption(o => o.setName('caso').setDescription('Número do caso').setMinValue(1).setRequired(true)))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  new SlashCommandBuilder().setName('economia').setDescription('Economia, loja e progressão')
    .addSubcommand(s => s.setName('saldo').setDescription('Mostra o saldo').addUserOption(o => o.setName('membro').setDescription('Membro opcional')))
    .addSubcommand(s => s.setName('daily').setDescription('Coleta a recompensa diária'))
    .addSubcommand(s => s.setName('trabalhar').setDescription('Trabalha e recebe moedas e XP'))
    .addSubcommand(s => s.setName('pagar').setDescription('Transfere moedas').addUserOption(o => o.setName('membro').setDescription('Membro').setRequired(true)).addIntegerOption(o => o.setName('quantidade').setDescription('Quantidade').setMinValue(1).setRequired(true)))
    .addSubcommand(s => s.setName('ranking').setDescription('Mostra os membros mais ricos'))
    .addSubcommand(s => s.setName('loja').setDescription('Mostra os itens disponíveis'))
    .addSubcommand(s => s.setName('comprar').setDescription('Compra um item').addStringOption(o => o.setName('item').setDescription('Item').setRequired(true).addChoices(
      { name: 'Distintivo VIP — 2.500', value: 'vip' },
      { name: 'Caixa Misteriosa — 900', value: 'caixa' },
      { name: 'Troféu Dourado — 5.000', value: 'trofeu' },
    )))
    .addSubcommand(s => s.setName('inventario').setDescription('Mostra seu inventário')),
  new SlashCommandBuilder().setName('diversao').setDescription('Comandos leves e divertidos')
    .addSubcommand(s => s.setName('moeda').setDescription('Joga cara ou coroa'))
    .addSubcommand(s => s.setName('dado').setDescription('Joga um dado'))
    .addSubcommand(s => s.setName('avatar').setDescription('Mostra um avatar').addUserOption(o => o.setName('membro').setDescription('Membro opcional'))),
  new SlashCommandBuilder().setName('sugerir').setDescription('Envia uma sugestão para votação')
    .addStringOption(o => o.setName('texto').setDescription('Sua sugestão').setMinLength(5).setMaxLength(1500).setRequired(true)),
];

export const commandsJson = commandBuilders.map(command => command.toJSON());
