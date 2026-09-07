(() => {
  const uniq = arr => [...new Set(arr.filter(Boolean))];
  const range = (start, end, step = 1, decimals = 0) => {
    const out = [];
    for (let value = start; value <= end + 1e-9; value += step) out.push(Number(value.toFixed(decimals)));
    return out;
  };

  const RACES = [
    'Humano','Elfo','Anão','Orc','Goblin','Hobgoblin','Troll','Ogro','Gigante','Gnomo',
    'Halfling','Fada','Pixie','Sereiano','Tritão','Atlante','Vampiro','Dhampir','Lobisomem','Metamorfo',
    'Demônio','Oni','Diabo','Anjo','Nephilim','Anjo Caído','Espírito','Fantasma','Espectro','Revenante',
    'Esqueleto','Lich','Zumbi','Múmia','Dullahan','Golem','Autômato','Constructo Arcano','Slime','Mímico',
    'Ent','Dríade','Mandrágora','Fungóide','Homem-Fera','Felinoide','Caninoide','Ursino','Lagartoide','Draconato',
    'Dragão','Kobold','Nagá','Serpentídeo','Centauro','Minotauro','Sátiro','Harpia','Ave-Humana','Aracnídeo',
    'Escorpiônida','Insetoide','Abissal','Filho do Kraken','Celestial','Elemental','Djinn','Ifrit','Sylph','Undine',
    'Alienígena','Ciborgue','Androide','Mutante','Parasita','Simbionte','Clone','Nascido do Vazio','Nascido das Estrelas','Nascido dos Sonhos',
    'Nascido dos Pesadelos','Nascido das Sombras','Nascido da Luz','Nascido do Cristal','Nascido do Magma','Nascido do Gelo','Nascido da Tempestade','Nascido da Areia','Nascido do Pântano','Reptiliano',
    'Anfíbio','Povo-Tubarão','Povo-Coelho','Povo-Corvo','Povo-Raposa','Povo-Cervo','Povo-Bode','Povo-Javali','Ciclope','Quimera'
  ];

  const FAMILY = {
    human:['Humano','Clone'], elf:['Elfo','Fada','Pixie','Gnomo','Halfling','Dríade'], dwarf:['Anão'],
    orc:['Orc','Goblin','Hobgoblin','Troll','Ogro','Gigante','Kobold'],
    aquatic:['Sereiano','Tritão','Atlante','Filho do Kraken','Undine','Anfíbio','Povo-Tubarão'],
    vampire:['Vampiro','Dhampir'],
    beast:['Lobisomem','Homem-Fera','Felinoide','Caninoide','Ursino','Povo-Coelho','Povo-Corvo','Povo-Raposa','Povo-Cervo','Povo-Bode','Povo-Javali','Centauro','Minotauro','Sátiro','Harpia','Ave-Humana'],
    shapeshifter:['Metamorfo','Mímico','Simbionte','Parasita','Quimera'], demon:['Demônio','Oni','Diabo','Abissal'],
    celestial:['Anjo','Nephilim','Anjo Caído','Celestial'],
    undead:['Fantasma','Espectro','Revenante','Esqueleto','Lich','Zumbi','Múmia','Dullahan'],
    spirit:['Espírito','Djinn','Ifrit','Sylph'], construct:['Golem','Autômato','Constructo Arcano','Ciborgue','Androide'],
    plant:['Ent','Mandrágora','Fungóide'], slime:['Slime'],
    reptile:['Lagartoide','Draconato','Dragão','Nagá','Serpentídeo','Reptiliano'],
    arthropod:['Aracnídeo','Escorpiônida','Insetoide'],
    elemental:['Elemental','Nascido do Cristal','Nascido do Magma','Nascido do Gelo','Nascido da Tempestade','Nascido da Areia','Nascido do Pântano','Nascido das Sombras','Nascido da Luz'],
    cosmic:['Alienígena','Mutante','Nascido do Vazio','Nascido das Estrelas','Nascido dos Sonhos','Nascido dos Pesadelos'],
    cyclops:['Ciclope']
  };
  const familyOf = race => Object.entries(FAMILY).find(([,members]) => members.includes(race))?.[0] || 'other';

  const SPECIFIC_SUBRACES = {
    Humano:['Comum','Desperto','Abençoado','Amaldiçoado','Nobre','Nômade','Descendente de Herói','Descendente Arcano','Artificial','Marcado pelo Destino','Viajante Dimensional','Reencarnado'],
    Elfo:['Alto Elfo','Elfo da Floresta','Elfo Sombrio','Elfo Lunar','Elfo Solar','Elfo do Gelo','Elfo do Mar','Elfo das Cinzas','Elfo das Estrelas','Elfo Rúnico','Elfo do Crepúsculo','Elfo Primordial'],
    Anão:['Anão da Montanha','Anão das Profundezas','Anão Rúnico','Anão de Ferro','Anão do Gelo','Anão do Magma','Anão de Cristal','Anão da Forja','Anão Astral','Anão do Trovão'],
    Vampiro:['Sangue Puro','Nobre da Noite','Bestial','Sombrio','Arcano','Ancestral','Carmesim','Lunar','do Crepúsculo','de Sangue Estelar','Errante','Rei da Noite'],
    Lobisomem:['Lobo Cinzento','Lobo Branco','Lobo Negro','Lobo Carmesim','Lobo Lunar','Lobo Primordial','Lobo da Tempestade','Lobo Ártico','Lobo Sombrio','Lobo Astral','Lobo Dourado'],
    Demônio:['Infernal','Abissal','Sombrio','Bestial','Arcano','do Caos','Antigo','Arquidemônio','Carmesim','do Vazio','Onírico','da Ruína','da Tentação','da Fome','da Guerra'],
    Oni:['Oni Vermelho','Oni Azul','Oni Negro','Oni Branco','Oni da Tempestade','Oni das Montanhas','Oni Espiritual','Oni de Jade','Oni de Cinzas','Oni Carmesim'],
    Anjo:['Guardião','Guerreiro','Curador','Arauto','Vigia','Serafim','Querubim','Arcanjo','Solar','Lunar','Astral','do Julgamento'],
    Dragão:['Dragão de Fogo','Dragão de Gelo','Dragão da Tempestade','Dragão de Terra','Dragão do Mar','Dragão de Luz','Dragão Sombrio','Dragão Astral','Dragão do Vazio','Dragão Ancestral','Dragão de Cristal','Dragão de Magma','Dragão Celestial','Dragão Onírico'],
    Elemental:['Elemental de Fogo','Elemental de Água','Elemental de Terra','Elemental de Ar','Elemental de Raio','Elemental de Gelo','Elemental de Luz','Elemental de Sombra','Elemental de Cristal','Elemental de Magma','Elemental de Plasma','Elemental de Névoa','Elemental de Som'],
    Alienígena:['Humanoide','Insectoide','Reptiliano','Aquático','Silício','Energia Viva','Colmeia','Metamorfo Cósmico','Fotônico','Gravitacional','Nanobiológico','Cristalino'],
    Mutante:['Estável','Adaptativo','Psíquico','Elemental','Bestial','Regenerativo','Cósmico','Tecnorgânico','Quântico','Simbiótico','Onírico'],
    Golem:['Golem de Pedra','Golem de Ferro','Golem de Cristal','Golem de Madeira','Golem Rúnico','Golem de Magma','Golem de Gelo','Golem de Vidro','Golem Celestial','Golem do Vazio'],
    Slime:['Slime Comum','Slime Ácido','Slime de Cristal','Slime de Fogo','Slime de Gelo','Slime Sombrio','Slime Metamorfo','Slime Rei','Slime de Mana','Slime Astral','Slime Dourado'],
    Espírito:['Espírito da Natureza','Espírito Ancestral','Espírito Elemental','Espírito Guardião','Espírito Errante','Espírito Astral','Espírito dos Sonhos','Espírito das Sombras','Espírito do Tempo','Espírito da Memória'],
    Ciclope:['Ciclope das Montanhas','Ciclope da Forja','Ciclope do Trovão','Ciclope Ancestral','Ciclope Marinho','Ciclope Rúnico','Ciclope de Cristal','Ciclope Sombrio'],
    Quimera:['Quimera Dracônica','Quimera Felina','Quimera Aviária','Quimera Aquática','Quimera Abissal','Quimera Celestial','Quimera Elemental','Quimera Arcana','Quimera do Vazio']
  };

  const FAMILY_SUBRACE_MODS = {
    human:['Comum','Desperto','Arcano','Nômade','Nobre','Antigo','Dimensional','Estelar','Amaldiçoado','Abençoado'],
    elf:['da Aurora','do Crepúsculo','da Floresta','da Lua','do Sol','do Gelo','das Sombras','das Estrelas','Rúnico','Primordial'],
    dwarf:['da Montanha','das Profundezas','de Ferro','Rúnico','de Cristal','do Magma','do Gelo','Astral','Ancestral'],
    orc:['Comum','de Guerra','Xamânico','Sombrio','do Gelo','de Cinzas','do Trovão','Ancestral','Rúnico','do Pântano'],
    aquatic:['Abissal','Coralino','das Marés','do Recife','das Profundezas','Bioluminescente','Tempestuoso','do Gelo','Ancestral','Astral'],
    vampire:['Sangue Puro','da Noite','Carmesim','Arcano','Ancestral','Lunar','Sombrio','Bestial','do Crepúsculo','Estelar'],
    beast:['da Floresta','das Montanhas','do Gelo','do Deserto','da Tempestade','Lunar','Sombrio','Dourado','Ancestral','Arcano'],
    shapeshifter:['Parcial','Perfeito','Bestial','Elemental','Sombrio','Espiritual','Arcano','Onírico','Cósmico','Ancestral'],
    demon:['Infernal','Abissal','Sombrio','Bestial','Arcano','do Caos','Antigo','do Vazio','Carmesim','Onírico'],
    celestial:['Guardião','Guerreiro','Radiante','Solar','Lunar','Astral','do Julgamento','da Cura','Ancestral','do Destino'],
    undead:['Errante','Ancestral','Sombrio','Arcano','do Gelo','Carmesim','Rúnico','do Vazio','Real','Astral'],
    spirit:['da Natureza','Ancestral','Elemental','Guardião','Errante','Astral','Onírico','do Tempo','da Memória','do Destino'],
    construct:['de Ferro','de Cristal','Rúnico','Arcano','Autônomo','Ancestral','Tecnorgânico','Solar','do Vazio','de Mana'],
    plant:['da Floresta','do Pântano','do Deserto','do Gelo','Bioluminescente','Carnívoro','Ancestral','Arcano','Onírico','Cristalino'],
    slime:['Comum','Elemental','Arcano','Metamorfo','Rei','Sombrio','Astral','de Cristal','de Mana','Ancestral'],
    reptile:['de Fogo','de Gelo','de Raio','de Terra','de Luz','Sombrio','Arcano','Ancestral','Astral','do Vazio'],
    arthropod:['da Colmeia','Caçador','Venenoso','Cristalino','Sombrio','do Deserto','da Floresta','Arcano','Ancestral','Cósmico'],
    elemental:['de Fogo','de Água','de Terra','de Ar','de Raio','de Gelo','de Luz','de Sombra','de Cristal','de Magma','de Plasma','de Névoa'],
    cosmic:['Estelar','Nebular','Lunar','Solar','do Vazio','Quântico','Onírico','Psíquico','Dimensional','Ancestral','Mutável'],
    cyclops:['da Montanha','da Forja','do Trovão','Ancestral','Marinho','Rúnico','de Cristal','Sombrio'],
    other:['Comum','Antigo','Arcano','Sombrio','Elemental','Astral','Rúnico','Ancestral']
  };

  function subracesFor(race) {
    if (SPECIFIC_SUBRACES[race]) return SPECIFIC_SUBRACES[race];
    const mods = FAMILY_SUBRACE_MODS[familyOf(race)] || FAMILY_SUBRACE_MODS.other;
    return mods.map(mod => `${race} ${mod}`);
  }

  const RACE_BRANCH = {
    human:['Marca de nascença incomum','Olhos heterocromáticos','Sangue arcano adormecido','Eco de outra linha temporal','Memória de vida passada','Resistência anormal à magia','Afinidade rara','Nenhuma anomalia'],
    elf:['Olhos Astrais','Ouvido da Floresta','Passos Sem Som','Afinidade Arcana','Memória Ancestral','Graça Lunar','Marca Solar','Canto das Folhas','Visão do Crepúsculo','Sangue Rúnico'],
    dwarf:['Barba Rúnica','Mãos da Forja','Pele de Ferro','Olhos de Cristal','Coração de Magma','Eco das Profundezas','Marca Ancestral','Resistência à Mana'],
    orc:['Presa Imperial','Sangue de Guerra','Marca Xamânica','Pele de Pedra','Olhos da Caçada','Totem Ancestral','Fúria Serena','Coração da Tribo'],
    aquatic:['Brânquias Astrais','Escamas Coralinas','Bioluminescência','Voz das Marés','Olhos Abissais','Sangue de Leviatã','Nado Etéreo','Marca do Oceano'],
    vampire:['Olhos Carmesins','Névoa Noturna','Passo Sombrio','Presença Hipnótica','Regeneração Noturna','Sentidos Predatórios','Sangue Arcano','Marca Lunar','Forma de Névoa','Eco Ancestral'],
    beast:['Presa Ancestral','Garras Etéreas','Olhos de Caçador','Faro Astral','Pelagem Rúnica','Instinto Lunar','Passos Selvagens','Marca da Matilha','Forma Parcial','Rugido Espiritual'],
    shapeshifter:['Forma Perfeita','Forma Parcial','Forma Instável','Mímica de Voz','Mímica de Aura','Memória Corporal','Corpo Fluido','Identidade Múltipla','Forma Onírica'],
    demon:['Chifres de Obsidiana','Olhos Carmesins','Aura de Medo','Sombra Viva','Fogo Negro','Runas na Pele','Asas Rasgadas','Coroa Abissal','Cauda Rúnica','Olhar do Vazio','Marca do Caos','Sangue Infernal'],
    celestial:['Asas Radiantes','Halo Dourado','Olhos de Luz','Voz Sagrada','Marca Solar','Plumas Prateadas','Aura Serena','Coroa Celestial','Runas Divinas','Luz Estelar'],
    undead:['Chama da Alma','Olhos Vazios','Névoa Fúnebre','Runas Mortuárias','Memória Perdida','Coração Parado','Eco Ancestral','Corpo Intangível','Âncora Espiritual'],
    spirit:['Aura Etérea','Corpo Translúcido','Marca Elemental','Olhos Astrais','Voz de Eco','Laço Ancestral','Halo Onírico','Forma Fluida','Núcleo Espiritual'],
    construct:['Núcleo de Mana','Núcleo Rúnico','Núcleo de Cristal','Núcleo Solar','Núcleo do Vazio','Consciência Emergente','Carcaça Adaptativa','Circuitos Arcanos','Memória Antiga','Forma Modular'],
    plant:['Seiva de Mana','Folhas Rúnicas','Casca Ancestral','Flores Astrais','Esporos Luminosos','Raízes Móveis','Coração de Madeira','Semente Primordial','Espinhos de Cristal'],
    slime:['Núcleo Colorido','Corpo Translúcido','Mímica Parcial','Absorção de Mana','Forma Compacta','Forma Gigante','Corpo de Cristal','Corpo Astral','Núcleo Real'],
    reptile:['Escamas Imperiais','Sopro Elemental','Olhos Dracônicos','Coração Elemental','Presença Ancestral','Chifres Rúnicos','Asas Etéreas','Cauda de Cristal','Sangue Primordial','Marca Estelar'],
    arthropod:['Carapaça Rúnica','Olhos Compostos Astrais','Fios de Mana','Ferrão Etéreo','Asas Prismáticas','Instinto de Colmeia','Carapaça de Cristal','Marca Ancestral'],
    elemental:['Corpo Fluido','Corpo Cristalino','Corpo Incandescente','Corpo Gasoso','Corpo Tempestuoso','Corpo Rúnico','Núcleo Primordial','Aura Elemental','Forma Humanoide','Forma Pura'],
    cosmic:['Olhos Estelares','Pele Nebular','Sangue Quântico','Aura do Vazio','Marca de Constelação','Eco Dimensional','Corpo Fotônico','Memória Cósmica','Núcleo Gravitacional','Forma Onírica'],
    cyclops:['Olho Rúnico','Olho do Trovão','Olho da Forja','Olho Astral','Olho de Cristal','Visão Ancestral','Marca da Montanha','Sangue de Titã'],
    other:['Marca Arcana','Traço Ancestral','Olhos Incomuns','Aura Rara','Sangue Elemental','Sinal do Destino','Eco Astral','Nenhum traço especial']
  };

  const RACE_RANK = {
    human:['Pessoa comum','Talento local','Prodígio','Elite','Herói em potencial','Lenda em formação','Anomalia','Singularidade'],
    elf:['Jovem do Bosque','Guardião','Nobre Élfico','Ancião','Sábio','Alto Guardião','Primordial'],
    dwarf:['Aprendiz da Forja','Artesão','Mestre Ferreiro','Guardião Rúnico','Lorde da Montanha','Ancião da Forja','Primordial'],
    orc:['Membro da Tribo','Caçador','Guerreiro','Campeão','Chefe','Senhor de Guerra','Lenda Tribal'],
    aquatic:['Habitante das Marés','Caçador Abissal','Guardião do Recife','Nobre das Profundezas','Arauto das Marés','Soberano Abissal','Primordial Oceânico'],
    vampire:['Recém-desperto','Sangue Jovem','Nobre','Ancião','Lorde da Noite','Progenitor','Primordial'],
    beast:['Filhote','Caçador','Alfa','Alfa Ancestral','Rei da Matilha','Fera Mítica','Primordial'],
    shapeshifter:['Instável','Adepto','Mímico Perfeito','Metamorfo Mestre','Sem-Forma','Arquétipo Vivo','Primordial'],
    demon:['Ímpio Menor','Demônio Comum','Elite Infernal','Nobre Demoníaco','Arquidemônio','Lorde Abissal','Rei Demoníaco','Primordial'],
    celestial:['Iniciado','Guardião','Arauto','Trono','Dominador','Arcanjo','Serafim','Primordial Celeste'],
    undead:['Recém-erguido','Errante','Assombrador','Ancião','Lorde Morto','Rei Espectral','Imortal Ancestral'],
    spirit:['Eco','Espírito Menor','Guardião','Espírito Maior','Ancião','Grande Espírito','Primordial'],
    construct:['Protótipo','Unidade Comum','Modelo de Elite','Modelo Real','Relíquia Viva','Núcleo Ancestral','Entidade Autônoma'],
    plant:['Brotamento','Guardião Verde','Ancião','Coração da Floresta','Rei Verde','Primordial da Natureza'],
    slime:['Slime Menor','Slime Comum','Slime Evoluído','Slime Nobre','Slime Rei','Slime Imperador','Slime Primordial'],
    reptile:['Jovem','Adulto','Ancião','Nobre Dracônico','Lorde Escamado','Dragão-Rei','Primordial'],
    arthropod:['Solitário','Batedor','Guardião','Elite da Colmeia','Nobre da Colmeia','Rainha/Rei','Primordial'],
    elemental:['Centelha','Elemental Menor','Elemental','Elemental Maior','Lorde Elemental','Avatar Elemental','Primordial'],
    cosmic:['Desconhecido','Viajante Estelar','Ser Cósmico','Entidade Dimensional','Arauto Cósmico','Anomalia Universal','Primordial Cósmico'],
    cyclops:['Jovem','Guerreiro','Ferreiro','Ancião','Lorde de Um Olho','Titã Ciclópico','Primordial'],
    other:['Comum','Treinado','Elite','Nobre','Ancião','Lendário','Primordial']
  };

  const POWER_CONCEPTS = ['Fogo','Água','Gelo','Terra','Ar','Raio','Luz','Sombra','Plantas','Gravidade','Telecinese','Telepatia','Ilusão','Cura','Espaço','Tempo','Energia','Mana','Runas','Espíritos','Sonhos','Emoções','Cristais','Tecnologia','Magnetismo','Vibração','Astral','Vazio','Névoa','Areia','Metal','Plasma','Fumaça','Som','Natureza','Tempestade','Lava','Estrelas','Lua','Sol','Cinzas','Vidro','Papel','Madeira','Sangue','Veneno','Ácido','Lodo','Ossos','Memória','Almas','Portais','Dimensões','Probabilidade','Vetores','Inércia','Densidade','Massa','Fricção','Pressão','Calor','Frio','Ondas','Radiação Fictícia','Prismas','Espelhos','Tinta','Correntes Místicas','Selos','Constelações','Nebulosas','Cometas','Ecos','Música','Silêncio','Nuvens','Marés','Tempestades Solares','Aurora','Pesadelos','Desejos','Destino'];
  const POWER_FORMS = ['Manipulação de','Criação de','Corpo de','Barreira de','Absorção de','Campo de','Passo de','Sentido de','Invocação de','Revestimento de','Armazenamento de','Transmutação de'];
  const SPECIAL_POWERS = ['Superforça','Supervelocidade','Superagilidade','Superresistência','Reflexos Aprimorados','Sentidos Aprimorados','Visão Noturna','Visão Térmica','Sentido de Perigo','Regeneração','Metamorfose','Transformação Animal','Transformação Elemental','Alteração de Tamanho','Elasticidade','Clonagem','Duplicação Temporária','Teletransporte','Portal Espacial','Troca de Posição','Projeção Astral','Invocação de Familiar','Comunicação com Espíritos','Invisibilidade Óptica','Camuflagem Sombria','Sorte Sobrenatural','Azar Sobrenatural','Intuição Perfeita','Adaptação Evolutiva','Aprendizado Acelerado','Memória Perfeita','Análise de Habilidades','Imitação de Técnicas','Cópia Limitada de Poder','Anulação Temporária de Poder','Amplificação de Poder','Compartilhamento de Poder','Armazenamento de Poder','Evolução de Poder','Combinação de Poderes','Resistência a Poderes','Detecção de Poderes','Entrada em Sonhos','Sonho Lúcido Perfeito','Empatia Sobrenatural','Aura de Coragem','Aura de Calma','Leitura de Intenção','Sala Dimensional','Corpo Estelar','Interface Mental','Controle de Máquinas','Consciência Dividida','Eco Temporal','Passos no Ar','Respiração Mística','Voz Hipnótica','Olhar Petrificante Fictício','Olhar de Verdade','Visão de Fluxo','Leitura de Aura','Ocultação de Presença','Presença Dominante','Presença Serena','Memória Ancestral','Mente Paralela','Cálculo Instantâneo','Idioma Universal','Comunicação Animal','Comunicação Cósmica','Voo Místico','Levitação','Faseamento','Intangibilidade','Distorção Visual','Mímica de Aura','Mímica de Voz','Mímica de Aparência','Sintonia com Relíquias','Sintonia com Familiares','Contrato Espiritual','Contrato Elemental','Pacto Estelar','Evolução Reativa','Forma Berserker Fictícia','Forma Celestial','Forma Abissal','Forma Dracônica','Forma Astral','Forma do Vazio','Forma de Cristal','Forma de Luz','Forma de Sombra','Forma de Névoa','Forma de Tempestade','Corpo Adaptativo','Pele de Pedra Mística','Pele de Cristal','Escamas Arcanas','Asas Etéreas','Halo Energético','Núcleo de Mana','Núcleo Estelar','Núcleo Espiritual','Reserva Infinita Fictícia','Recuperação Acelerada','Purificação de Maldição','Quebra de Ilusão','Detecção de Mentira Mística','Navegação Dimensional','Cartografia Astral','Encantamento Instantâneo','Criação de Runas','Criação de Selos','Biblioteca Mental','Arquivo de Memórias','Sincronia de Equipe','Aura de Inspiração','Campo de Lentidão Fictício','Campo de Aceleração Fictício','Campo Anti-Magia Fictício'];
  const POWERS = uniq([...POWER_CONCEPTS.flatMap(c => POWER_FORMS.map(f => `${f} ${c}`)), ...SPECIAL_POWERS]);

  const POWER_STYLE = ['Bruto e direto','Preciso e cirúrgico','Defensivo','Suporte','Área ampla','Curto alcance','Longo alcance','Automático','Reativo','Canalizado','Rúnico','Ritualístico','Instintivo','Técnico','Elegante','Caótico','Silencioso','Explosivo fictício','Em camadas','Por contato','Por aura','Por olhar','Por voz','Por gestos','Por marca','Por contrato','Por familiar','Por objeto focal','Por emoção','Por concentração'];
  const POWER_RANKS = ['Quase inútil','Muito fraco','Fraco','Comum','Acima da média','Raro','Muito raro','Épico','Lendário','Mítico','Transcendente','Anômalo','Conceitual','Primordial'];
  const POWER_CONTROL = ['Sem controle','Instável','Muito baixo','Baixo','Básico','Treinado','Bom','Avançado','Especialista','Mestre','Grão-Mestre','Perfeito','Instintivo absoluto'];
  const POWER_COST = ['Quase nenhum','Baixo','Moderado','Alto','Muito alto','Exige concentração','Exige descanso','Cresce com uso','Varia com emoção','Varia com ambiente','Varia com fase do dia','Varia com distância','Sem custo aparente'];

  const ARCHETYPES = ['Herói','Anti-herói','Trapaceiro','Sábio','Explorador','Guardião','Rebelde','Criador','Governante','Mago','Inocente','Cuidador','Bobo','Forasteiro','Sobrevivente','Rival','Mentor','Prodígio','Errante','Campeão','Monstro de um Soco','Híbrido','NPC misterioso','Reencarnado','Arauto da Destruição','Legado do Campeão','Campeão Primordial','Aura Farmer','Senhor da Guerra','Receptáculo','Falsa Divindade','Máquina de Guerra Colossal','Amaldiçoado','Druida','Paladino','Oráculo','Caçador','Nômade','Rei sem Reino','Príncipe Exilado','Último Herdeiro','Pesquisador Arcano','Alquimista','Artesão','Inventor','Detetive','Mercador','Diplomata','Artista','Curandeiro','Invocador','Domador','Sentinela','Espião','Ilusionista','Cronista','Bibliotecário','Peregrino','Astrólogo','Cartógrafo Dimensional','Viajante do Tempo','Andarilho do Vazio','Nobre Decadente','Camponês Ascendente','Soberano','Mestre de Guilda','Lenda Urbana','Guardião de Portal','Guardião de Relíquia','Colecionador','Portador de Maldição','Escolhido Relutante','Falso Escolhido','Herdeiro de Profecia','Quebrador de Profecia','Avatar Elemental','Avatar Estelar','Avatar do Vazio','Espírito Livre','Discípulo','Mestre','Grão-Mestre','Estrategista','Tático','Comandante','Pacifista Poderoso','Gladiador Fictício','Aventureiro','Caçador de Relíquias','Arqueólogo Arcano','Navegador Estelar','Guardião da Natureza','Místico','Monge','Bardo','Xamã','Tecnomago','Psíquico','Médium','Oráculo Cego','Visionário','Duelista Fictício','Cavaleiro Rúnico','Cavaleiro Dracônico','Sacerdote Solar','Sacerdote Lunar','Sacerdote Estelar','Feiticeiro Errante','Bruxo de Contrato','Mago de Academia','Autodidata','Gênio Excêntrico','Andarilho Solitário','Líder Carismático','Rei Louco Fictício','Imperador Relutante','Guardião Silencioso','Arauto do Fim','Arauto do Começo'];

  const TITLE_PREFIX = ['O','A','Último','Primeiro','Eterno','Solitário','Errante','Esquecido','Dourado','Carmesim','Prateado','Sombrio','Celestial','Abissal','Astral','Rúnico','Arcano','Lunar','Solar','Estelar','Ancestral','Silencioso','Imortal Fictício','Implacável','Gentil','Caótico','Sereno','Oculto','Vazio','Infinito Fictício','Quebrado','Perfeito','Desperto'];
  const TITLE_NOUN = ['Andarilho','Guardião','Mago','Caçador','Sábio','Lobo','Corvo','Dragão','Rei','Rainha','Príncipe','Princesa','Herói','Vilão Fictício','Campeão','Arauto','Oráculo','Trapaceiro','Guerreiro','Monge','Peregrino','Viajante','Alquimista','Invocador','Sonhador','Pesadelo','Fantasma','Titã','Anjo','Demônio','Mortal','Imortal Fictício','Nômade','Sentinela','Soberano','Discípulo','Mestre','Prodígio','Escolhido','Exilado','Sem-Nome','Sem-Reino'];
  const TITLES = uniq(['O Solitário','O Passo Veloz','O Mais Fraco','O Rei dos Humanos','O Lendário','O Cafajeste das Almas','O Desbravador do Tempo','O Espadachim Negro','O Tolo','O Demônio do Trevo Negro','O Senhor das Cinzas',...TITLE_PREFIX.flatMap(p => TITLE_NOUN.map(n => `${p} ${n}`))]).slice(0, 420);

  const CLASSES = ['Guerreiro Fictício','Mago','Arqueiro Arcano','Ladino','Paladino','Clérigo','Monge','Bardo','Druida','Feiticeiro','Bruxo','Cavaleiro Rúnico','Espadachim Místico','Invocador','Alquimista','Xamã','Guardião','Caçador','Explorador','Domador de Feras','Mestre de Runas','Tecnomago','Psíquico','Oráculo','Ilusionista','Curandeiro','Místico','Elementalista','Geomante','Piromante','Hidromante','Criomante','Aeromante','Eletromante','Astrólogo','Cronomante','Espacialista','Artífice','Berserker Fictício','Sentinela','Duelista Fictício','Acrobata','Mestre de Familiares','Guardião Astral','Cavaleiro Dracônico','Monge Astral','Sacerdote Solar','Sacerdote Lunar','Explorador do Vazio','Andarilho Dimensional','Caçador de Relíquias','Mestre de Barreiras','Tecelão de Mana','Mestre de Selos','Mestre de Cristais','Invocador Celestial','Invocador Abissal','Aventureiro','Erudito Arcano','Guardião de Portais','Cartógrafo Astral','Navegador Estelar','Médium','Mestre de Pactos','Mestre de Aura','Mestre de Ilusões','Mestre de Gravidade','Mestre de Sonhos','Mestre de Ecos','Mestre de Sombras','Mestre da Luz','Mestre de Tempestades','Mestre de Cristal','Mestre de Magma','Mestre de Névoa','Mestre do Mar','Mestre das Marés','Mestre das Estrelas','Guardião Rúnico','Guardião da Natureza','Guardião Celestial','Guardião Abissal','Guardião do Tempo','Guardião do Espaço'];
  const AFFINITIES = ['Fogo','Água','Gelo','Terra','Ar','Raio','Luz','Sombra','Natureza','Metal','Cristal','Magma','Areia','Névoa','Som','Gravidade','Espaço','Tempo','Astral','Solar','Lunar','Estelar','Vazio','Espiritual','Psíquica','Ilusão','Runas','Mana Pura','Tecnologia','Sonho','Tempestade','Fumaça','Cinzas','Vidro','Papel','Madeira','Plasma','Magnetismo','Vibração','Energia','Cura','Invocação','Bestial','Caos','Ordem','Destino','Mar','Floresta','Montanha','Memória','Almas','Portais','Probabilidade','Constelações','Nebulosas','Aurora','Pesadelos','Desejos','Nenhuma'];

  const FANTASY_ITEMS_BASE = ['Auréola de Anjo','Cetro Solar','Orbe do Vazio','Grimório Vivo','Escudo Etéreo','Lâmina de Luz Fictícia','Cajado de Cristal','Anel Rúnico','Manopla Astral','Relógio Arcano','Máscara do Crepúsculo','Fita de Selos','Corrente Astral Fictícia','Lanterna de Almas','Livro das Marés','Prisma Estelar','Coroa Abissal','Totem Ancestral','Rosa de Cristal','Chave Dimensional','Esfera de Mana','Espelho Lunar','Leque da Tempestade','Sino Espiritual','Medalhão Solar','Relíquia Sem Forma','Instrumento Místico','Bússola Astral','Cubo Rúnico','Fragmento de Cometa'];
  const ITEM_CORES = ['Carmesim','Azul','Dourado','Prateado','Negro','Branco','Violeta','Esmeralda','Ciano','Âmbar'];
  const ITEM_ESSENCES = ['Solar','Lunar','Estelar','Abissal','Celestial','Rúnico','Arcano','Onírico','do Vazio','da Tempestade','de Cristal','Ancestral'];
  const FANTASY_ITEMS = uniq([...FANTASY_ITEMS_BASE,...ITEM_CORES.flatMap(c => ['Orbe','Cetro','Grimório','Máscara','Coroa','Anel','Prisma','Totem'].map(i => `${i} ${c}`)),...ITEM_ESSENCES.flatMap(e => ['Relíquia','Orbe','Cajado','Grimório','Escudo Etéreo','Artefato'].map(i => `${i} ${e}`))]);

  const ENCHANT_CONCEPTS = ['Fogo','Gelo','Raio','Luz','Sombra','Marés','Tempestade','Cristal','Vazio','Estrelas','Lua','Sol','Runas','Almas','Ecos','Névoa','Areia','Magma','Madeira','Metal','Gravidade','Espaço','Tempo','Sonhos','Pesadelos','Memória','Mana','Espíritos','Aurora','Prismas','Constelações','Portais','Selos','Natureza','Som','Silêncio','Fumaça','Cinzas'];
  const ENCHANT_FORMS = ['Toque de','Marca de','Núcleo de','Aura de','Eco de','Bênção de','Selo de'];
  const ENCHANTMENTS = uniq(['Cócegas Mortais (efeito cômico)','Retorno Automático Fictício','Forma Adaptativa','Peso Variável','Brilho Astral','Vínculo com Usuário Fictício','Memória de Batalha Fictícia','Voz Própria','Mudança de Forma','Flutuação','Camuflagem Arcana','Sintonia Elemental','Sintonia Lunar','Sintonia Solar','Sintonia Estelar',...ENCHANT_CONCEPTS.flatMap(c => ENCHANT_FORMS.map(f => `${f} ${c}`))]);
  const MASTERY = ['Não sabe usar','Iniciante','Novato','Aprendiz','Competente','Veterano','Elite','Especialista','Mestre','Grão-Mestre','Lendário','Mítico','Transcendente','Perfeito'];

  const INTELLIGENCE = ['Muito abaixo da média','Abaixo da média','Normal','Acima da média','Inteligente','Muito inteligente','Gênio','Supergênio','Prodígio impossível','Mente paralela','Quase onisciente'];
  const COMBAT = ['Nem braço tem','Fraco','Novato','Aprendiz','Competente','Veterano','Elite','Especialista','Mestre','Grão-Mestre','Lendário','Mítico','Transcendente'];
  const SPEED = ['O mais lento','Velho capenga','Abaixo da média','Normal','Acima da média','Atlético fictício','Super-humano','Subsônico','Sônico','Supersônico','Hipersônico','Relativístico','Velocidade da Luz','Mais rápido que a luz (ficção)','Imensurável (ficção)'];
  const SCALE = ['O mais fraco','Homem velho','Abaixo da média','Normal','Acima da média','Super-humano','Nível Parede','Nível Prédio','Nível Cidade','Nível Montanha','Nível Ilha','Nível País','Nível Continente','Nível Lua','Nível Planeta','Nível Estelar','Nível Sistema Solar','Nível Galáxia','Universal','Multiversal','Multiversal+','Complexo Multiversal','Complexo Hiperversal','Transcendental','Boundless (ficção)'];
  const HEIGHTS = [...range(0.60, 1.20, 0.05, 2),...range(1.21, 2.20, 0.01, 2),...range(2.25, 3.50, 0.05, 2),4,5,6,8,10,15,20,'Gigantesco','Colossal','Tamanho variável'].map(v => typeof v === 'number' ? `${v.toFixed(2).replace('.',',')} m` : v);
  const AGES = ['Recém-nascido','Criança','Adolescente','Jovem adulto','Adulto','Meia-idade','Idoso','Ancião','Centenário','Milenar','Antiquíssimo','Idade desconhecida','Não envelhece','Nasceu ontem, memória antiga'];

  const TALENTS = ['Prodígio Arcano','Corpo Abençoado','Memória Perfeita','Instinto de Batalha Fictício','Afinidade Dupla','Mana Abundante','Regeneração Natural','Aprendizado Rápido','Vontade Inabalável','Sorte Incomum','Olhos Místicos','Ouvido Absoluto','Passos Silenciosos','Presença Imponente','Mestre Improvisador','Controle Fino de Mana','Grande Reserva Física Fictícia','Resistência Elemental','Resistência Mental','Resistência Espiritual','Talento para Runas','Talento para Invocação','Talento para Cura','Talento para Ilusão','Talento para Alquimia','Talento para Tecnologia','Talento para Estratégia','Talento para Sobrevivência Fictícia','Despertar Precoce','Potencial Oculto','Adaptação Rápida','Evolução em Combate Fictício','Sincronia Elemental','Sincronia Astral','Visão de Fluxo','Percepção de Fraquezas Fictícia','Intuição de Perigo Fictícia','Reflexos Naturais','Disciplina Mental','Criatividade Mágica','Talento Social','Talento Diplomático','Talento Artístico','Talento Musical','Talento de Pesquisa','Leitura Rápida','Cálculo Mental','Orientação Perfeita','Memória Espacial','Sintonia com Animais','Sintonia com Espíritos'];
  const LIMITS = ['Mana limitada','Recarga longa após técnicas grandes','Poder instável sob estresse','Baixa resistência física fictícia','Baixa resistência mágica','Dificuldade contra ilusões','Dificuldade contra efeitos mentais','Perde força longe do próprio elemento','Precisa de concentração','Poderes deixam rastros visíveis','Só usa o máximo por pouco tempo','Afinidade bloqueia o elemento oposto','Teletransporte exige destino conhecido','Cura funciona pior em si mesmo','Clones dividem energia','Invocações consomem muita mana','Barreiras reduzem mobilidade','Transformação tem tempo limitado','Poder cresce devagar','Poder forte porém pouco preciso','Vulnerável enquanto canaliza magia','Ambientes sem mana enfraquecem','Espaços fechados limitam voo fictício','Poderes psíquicos exigem foco visual','Ilusões quebram sob distração','Runas precisam ser preparadas','Poderes de tempo têm alcance curto','Poderes espaciais exigem precisão','Regeneração consome energia','Supervelocidade exige pausas fictícias','Forma astral deixa o corpo imóvel fictício','Poderes lunares variam com a noite','Poderes solares diminuem à noite','Vazio é difícil de controlar','Sentidos ampliados podem sobrecarregar','Absorção tem limite','Cópia de poder dura pouco','Adaptação precisa de exposição prévia','Não possui limitação aparente','Fraqueza desconhecida'];
  const ORIGINS = ['Vila esquecida','Capital imperial','Floresta ancestral','Montanhas proibidas','Deserto de vidro','Ilha flutuante','Cidade subterrânea','Reino costeiro','Templo em ruínas','Academia arcana','Laboratório abandonado fictício','Nave perdida','Outro planeta','Lua distante','Plano astral','Dimensão sombria','Reino celestial','Abismo antigo','Pântano encantado','Vale dos dragões','Cidade tecnológica','Metrópole comum','Aldeia de caçadores fictícios','Clã nômade','Orfanato mágico','Família nobre','Família de aventureiros','Família desconhecida','Criado por espíritos','Criado por feras fictícias','Despertou sem memória','Reencarnado em outro mundo','Invocado por acidente','Criado artificialmente','Encontrado dentro de um cristal','Surgiu de uma tempestade','Caiu do céu','Veio do fundo do mar','Nasceu durante um eclipse','Nasceu durante chuva de meteoros','Sobreviveu a uma fenda dimensional fictícia','Veio de uma linha do tempo perdida','Escapou de um reino destruído fictício','Herdeiro de um pacto antigo','Último de um pequeno clã','Origem totalmente desconhecida'];
  const MORALITY = ['Altruísta','Bondoso','Gentil','Justo','Protetor','Neutro','Pragmático','Caótico bondoso','Caótico neutro','Egoísta','Ambicioso','Frio','Misterioso','Imprevisível','Honrado','Curioso','Pacifista','Competitivo','Arrogante','Humilde','Calculista','Idealista','Cético','Leal','Rebelde','Trapaceiro'];
  const SOCIAL = ['Desconhecido','Pessoa comum','Popular local','Aventureiro conhecido','Celebridade regional','Herói nacional fictício','Lenda continental','Figura mundial','Lenda viva','Mito conhecido em vários mundos','Nome apagado da história'];
  const LUCK = ['Azar absurdo','Muito azarado','Azarado','Normal','Sortudo','Muito sortudo','Abençoado pela sorte','Sorte absurda fictícia','Probabilidade parece favorecer você'];
  const WHAT_NOW = ['Se aposenta','Dá uma cagada','Você treina','Você tenta arrumar namorada/o no futuro','Some do mapa','Viaja pelo mundo','Entra para uma guilda','Cria uma guilda','Vira professor','Vira pesquisador','Explora ruínas','Procura sua origem','Vira mercador','Protege uma cidade','Vira aventureiro','Procura um mestre','Se torna mestre','Viaja entre dimensões','Vai estudar magia','Vai estudar tecnologia','Cria uma oficina','Vira nômade','Procura uma relíquia','Escreve um livro','Se torna diplomata','Abre uma loja','Vira cartógrafo','Explora o espaço','Vira guardião de portal','Fica de boa','Tenta viver anonimamente','Reúne uma equipe','Segue sozinho','Procura respostas','Muda completamente de vida'];

  const HAS_POWER = ['Sim','Sim','Sim','Sim','Sim','Não'];
  const POWER_COUNT = ['1','1','2','2','2','3','3','4','5','6'];
  const HAS_ITEM = ['Sim','Sim','Sim','Não'];
  const ENCHANT_COUNT = ['0','1','1','1','2','2','3','4'];

  window.ROULETTE_DATA = { RACES, familyOf, subracesFor, RACE_BRANCH, RACE_RANK, POWERS, POWER_STYLE, POWER_RANKS, POWER_CONTROL, POWER_COST, ARCHETYPES, TITLES, CLASSES, AFFINITIES, FANTASY_ITEMS, ENCHANTMENTS, MASTERY, INTELLIGENCE, COMBAT, SPEED, SCALE, HEIGHTS, AGES, TALENTS, LIMITS, ORIGINS, MORALITY, SOCIAL, LUCK, WHAT_NOW, HAS_POWER, POWER_COUNT, HAS_ITEM, ENCHANT_COUNT };
})();