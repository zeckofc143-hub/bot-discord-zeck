(()=>{'use strict';const D=window.ROULETTE_DATA;if(!D)return;
const rows=`
Humano~Original / fantasia geral~mortal~Espécie-base versátil: cresce por treino, estudo, magia ou tecnologia.~Curta a média~Humanoide~Comum
Vampiro~Folclore / fantasia~undead~Predador sobrenatural alimentado por sangue ou energia vital; troca limitações ambientais por sentidos, regeneração e físico superiores.~Muito longa~Humanoide~Incomum
Lobisomem~Folclore / fantasia~beast~Humanoide ligado a uma forma lupina que amplifica corpo e sentidos, mas intensifica impulsos.~Longa~Humanoide mutável~Incomum
Demônio~Fantasia sobrenatural~infernal~Ser de energia infernal, abissal ou caótica, forte física e magicamente, porém difícil de ocultar e controlar.~Muito longa~Humanoide variável~Raro
Diabo~Fantasia sobrenatural~infernal~Entidade infernal voltada a pactos, influência, magia e presença opressora.~Muito longa~Humanoide variável~Raro
Anjo~Tradições religiosas / fantasia~celestial~Ser celestial ligado a energia sagrada, voo, proteção e grande resistência espiritual.~Muito longa~Humanoide alado~Raro
Anjo Caído~Fantasia sobrenatural~fallen~Ser celestial alterado pela queda, misturando capacidades angelicais com energia sombria e conflitos internos.~Muito longa~Humanoide alado~Raro
Dragão~Mitologia / fantasia~dragon~Criatura dracônica de enorme potencial físico, elemental e mágico; idade e tamanho mudam muito sua escala.~Centenária a milenar~Dracônico~Raro
Elfo~Fantasia clássica~fae~Humanoide longevo de sentidos finos e forte afinidade com natureza, magia ou tradição.~Longa~Humanoide~Comum
Anão~Fantasia clássica~mortal~Humanoide compacto e resistente, associado a ofícios, técnica e persistência.~Média a longa~Humanoide compacto~Comum
Orc~Fantasia clássica~beast~Humanoide robusto com grande presença física e aptidão para combate e sobrevivência.~Média~Humanoide robusto~Comum
Goblin~Fantasia clássica~small~Humanoide pequeno, furtivo e improvisador; ganha mobilidade e perde alcance físico.~Curta a média~Humanoide pequeno~Comum
Troll~Folclore / fantasia~beast~Criatura grande e resistente, normalmente marcada por força e regeneração.~Longa~Humanoide grande~Incomum
Ogro~Folclore / fantasia~beast~Humanoide enorme focado em força e resistência, com baixa furtividade.~Média~Humanoide grande~Incomum
Gigante~Mitologia / fantasia~giant~Humanoide colossal; massa e alcance enormes cobram mobilidade e discrição.~Longa~Gigante~Raro
Fada~Folclore / fantasia~fae~Ser feérico mágico, móvel e imprevisível, geralmente melhor em truques do que força bruta.~Longa~Feérico variável~Incomum
Sereia~Mitologia / fantasia~aquatic~Humanoide aquático muito eficiente submerso e menos confortável em ambientes secos.~Longa~Aquático~Incomum
Tritão~Mitologia / fantasia~aquatic~Humanoide aquático robusto, adaptado a pressão, natação e combate submerso.~Longa~Aquático~Incomum
Centauro~Mitologia grega~beast~Híbrido humanoide-quadrúpede com excelente deslocamento, estabilidade e força.~Média a longa~Quadrúpede humanoide~Incomum
Minotauro~Mitologia grega~beast~Humanoide taurino de enorme força, resistência e presença intimidadora.~Média a longa~Humanoide robusto~Incomum
Sátiro~Mitologia grega~fae~Humanoide feérico ágil, social e ligado a natureza, música e instinto.~Longa~Humanoide caprino~Incomum
Harpia~Mitologia / fantasia~beast~Humanoide alado construído para percepção e mobilidade aérea.~Média~Humanoide alado~Incomum
Fênix~Mitologia / fantasia~celestial~Ave sobrenatural ligada a fogo, renovação e ciclos de renascimento.~Cíclica / muito longa~Ave sobrenatural~Raro
Grifo~Mitologia / fantasia~beast~Criatura alada híbrida de força, sentidos e mobilidade aérea elevados.~Longa~Quadrúpede alado~Raro
Golem~Folclore / fantasia~construct~Constructo animado por magia, runas ou núcleo; muito resistente, mas dependente da fonte de animação.~Indefinida enquanto ativo~Constructo~Incomum
Slime~Fantasia / RPG~amorphous~Organismo amorfo capaz de deformar o corpo, absorver impacto e se adaptar.~Variável~Amorfo~Comum
Zumbi~Horror / fantasia~undead~Morto-vivo corporal com baixa necessidade biológica e grande tolerância a dano comum.~Indefinida enquanto preservado~Cadavérico~Comum
Esqueleto~Fantasia / RPG~undead~Morto-vivo sem órgãos comuns, sustentado por energia, magia ou núcleo espiritual.~Indefinida enquanto animado~Esquelético~Comum
Fantasma~Folclore / horror~spirit~Consciência sem corpo físico estável, focada em mobilidade e intangibilidade.~Indefinida~Espiritual~Incomum
Espectro~Fantasia sombria~spirit~Entidade espiritual densa e hostil, ligada a aura, medo e intangibilidade.~Indefinida~Espiritual~Raro
Lich~Fantasia / RPG~undead~Mago morto-vivo que preserva mente e magia por um vínculo externo ou foco de existência.~Indefinida~Morto-vivo arcano~Raro
Djinn~Folclore árabe / fantasia~spirit~Entidade espiritual associada a energia, contratos, desejos e formas variáveis.~Muito longa~Espiritual variável~Raro
Oni~Folclore japonês~infernal~Humanoide demoníaco robusto, forte e frequentemente ligado a energia elemental ou espiritual.~Longa~Humanoide robusto~Incomum
Kitsune~Folclore japonês~fae~Espírito-raposa ligado a transformação, ilusão e crescimento de poder com idade ou caudas.~Longa a milenar~Metamorfo~Raro
Tengu~Folclore japonês~fae~Yokai aéreo ligado a agilidade, percepção, vento e artes marciais.~Longa~Humanoide alado~Incomum
Nagá~Mitologias asiáticas~serpent~Ser serpentino inteligente ligado a água, veneno, magia ou espiritualidade.~Longa~Serpentino~Raro
Lâmia~Mitologia / fantasia~serpent~Humanoide serpentino de sentidos fortes, mobilidade sinuosa e afinidades venenosas ou mágicas.~Longa~Serpentino humanoide~Incomum
Gárgula~Fantasia gótica~construct~Criatura pétrea de defesa elevada, vigília e possível voo pesado.~Muito longa~Pétreo humanoide~Incomum
Ciclope~Mitologia grega~giant~Gigante de um olho com força enorme e percepção focal, mas visão periférica limitada.~Longa~Gigante humanoide~Incomum
Metamorfo~Fantasia geral~shifter~Ser capaz de alterar aparência e anatomia, excelente para infiltração e adaptação.~Variável~Mutável~Raro
Elemental~Fantasia geral~elemental~Manifestação viva de um elemento, resistente ao próprio tipo e vulnerável a contramedidas opostas.~Muito longa~Elemental~Raro
Espírito~Fantasia / animismo~spirit~Entidade não física ligada a emoção, lugar, natureza ou conceito.~Indefinida ou cíclica~Espiritual~Incomum
Deus~Mitologia / fantasia cósmica~divine~Entidade divina de escala acima do mortal, com enorme aura, energia e restrições conceituais próprias.~Imensamente longa~Variável~Extremamente raro
Semideus~Mitologia / fantasia~divine~Ser parcialmente divino que mistura adaptabilidade mortal e herança sobrenatural.~Muito longa~Humanoide~Muito raro
Mutante~HQ / ficção científica~mutant~Indivíduo cuja mutação altera fisiologia, energia ou capacidades; vantagens e custos dependem da mutação.~Variável~Variável~Incomum
Ciborgue~Ficção científica~machine~Organismo biológico ampliado por componentes mecânicos; ganha módulos e manutenção como novo custo.~Variável~Bio-mecânico~Incomum
Androide~Ficção científica~machine~Ser artificial humanoide de precisão elevada e poucas necessidades biológicas.~Muito longa com manutenção~Sintético~Incomum
Alienígena~Ficção científica geral~alien~Espécie extraterrestre genérica cuja fisiologia pode trazer adaptações não humanas.~Variável~Variável~Variável
Simbionte~HQ / ficção científica~symbiote~Organismo que se liga a um hospedeiro e amplifica capacidades, criando dependência mútua.~Muito longa~Simbiótico~Raro
Viltrumita~Invincible~alienPower~Espécie humanoide extraterrestre de força, voo, velocidade, durabilidade e longevidade extremas.~Extremamente longa~Humanoide~Muito raro
Kryptoniano~DC~alienPower~Humanoide de Krypton que sob energia solar adequada manifesta força, voo, sentidos e resistência extraordinários.~Muito longa~Humanoide~Muito raro
Marciano~DC~alienPower~Espécie marciana de grande plasticidade corporal e capacidades mentais, acompanhadas de vulnerabilidades específicas.~Muito longa~Metamorfo humanoide~Muito raro
Asgardiano~Marvel~divine~Povo de Asgard com físico e longevidade superiores ao humano e forte ligação com tradição guerreira e magia.~Muito longa~Humanoide~Raro
Eterno~Marvel~cosmic~Ser aprimorado por energia cósmica, de fisiologia extremamente estável e múltiplas formas de manifestação de poder.~Imensamente longa~Humanoide cósmico~Muito raro
Inumano~Marvel~mutant~Humanoide cujo potencial desperta por transformação específica, gerando poderes muito variados.~Variável~Humanoide variável~Raro
Klyntar~Marvel~symbiote~Espécie simbionte alienígena que se funde a hospedeiros e cria uma forma compartilhada de combate.~Muito longa~Simbiótico~Raro
Celestial~Marvel~cosmic~Entidade cósmica colossal de tecnologia e energia muito acima de civilizações comuns.~Imensamente longa~Cósmico colossal~Extremamente raro
Saiyajin~Dragon Ball~animePower~Espécie guerreira de alto potencial de crescimento, Ki e transformações.~Longa~Humanoide~Muito raro
Namekuseijin~Dragon Ball~animeMystic~Espécie de Namek com regeneração, elasticidade, energia espiritual e linhagens guerreiras ou místicas.~Muito longa~Humanoide~Raro
Majin~Dragon Ball~amorphous~Ser mágico de corpo maleável, regeneração extrema e capacidades incomuns de absorção e transformação.~Muito longa~Amorfo humanoide~Muito raro
Raça do Freeza~Dragon Ball~alienPower~Espécie alienígena de enorme potencial natural e resistência ambiental, capaz de usar formas de contenção ou liberação.~Muito longa~Humanoide alienígena~Muito raro
Kaioshin~Dragon Ball~divine~Entidade divina ligada à criação, observação e equilíbrio de mundos.~Imensamente longa~Humanoide divino~Extremamente raro
Ghoul~Tokyo Ghoul~monster~Humanoide predador com fisiologia RC, regeneração e Kagune, mas dieta incompatível com humanos comuns.~Humana a longa~Humanoide~Raro
Titã~Attack on Titan~giant~Forma humanoide gigante com regeneração e subtipos que alteram radicalmente função e poder.~Variável~Gigante humanoide~Raro
Shinigami~Bleach~spiritWarrior~Ser espiritual treinado para combate e manipulação de energia espiritual.~Muito longa~Espiritual humanoide~Raro
Hollow~Bleach~spiritMonster~Espírito monstruoso movido por fome e evolução através de estágios cada vez superiores.~Indefinida~Espiritual monstruoso~Raro
Quincy~Bleach~spiritWarrior~Linhagem espiritual especializada em absorver e controlar partículas espirituais com alta precisão.~Humana a longa~Humanoide~Raro
Arrancar~Bleach~spiritWarrior~Hollow que ganhou forma e técnicas mais humanoides sem perder sua origem monstruosa.~Indefinida~Espiritual humanoide~Muito raro
Fullbringer~Bleach~spiritWarrior~Humano capaz de extrair propriedades espirituais especiais de objetos e ambientes.~Humana~Humanoide~Raro
Otsutsuki~Naruto / Boruto~cosmic~Clã extraterrestre de chakra excepcional, ligado a técnicas dimensionais e evolução por energia planetária.~Extremamente longa~Humanoide alienígena~Extremamente raro
Espírito Amaldiçoado~Jujutsu Kaisen~curse~Entidade formada por energia amaldiçoada e emoções negativas, com técnica ligada ao medo ou conceito de origem.~Indefinida~Espiritual monstruoso~Raro
Demônio de Kimetsu~Demon Slayer~monster~Humano transformado em demônio com regeneração, força e Arte Demoníaca de Sangue, mas limitações ambientais severas.~Muito longa~Humanoide monstruoso~Raro
Quimera Ant~Hunter x Hunter~evolution~Espécie que incorpora características de organismos consumidos, criando castas e indivíduos muito diferentes.~Variável~Híbrido biológico~Muito raro
Homúnculo~Fullmetal Alchemist / fantasia alquímica~construct~Ser artificial criado por alquimia ou energia equivalente, sustentado por uma fonte de existência não convencional.~Muito longa~Humanoide artificial~Raro
Homem-Peixe~One Piece~aquatic~Humanoide aquático de força natural elevada e enorme desempenho submerso.~Longa~Aquático humanoide~Raro
Mink~One Piece~beast~Povo mamífero humanoide de sentidos fortes, afinidade elétrica e transformação especial condicionada.~Humana a longa~Humanoide animal~Raro
Lunarian~One Piece~alienPower~Povo alado de resistência extrema ligado a chamas e alternância entre defesa e velocidade.~Muito longa~Humanoide alado~Extremamente raro
Seraphim~One Piece~construct~Ser artificial de combate que combina bioengenharia, durabilidade extrema e capacidades integradas.~Variável~Bioengenharia humanoide~Extremamente raro
Hylian~The Legend of Zelda~fae~Povo humanoide de Hyrule com forte afinidade espiritual, histórica e mágica.~Humana a longa~Humanoide~Comum
Gerudo~The Legend of Zelda~mortal~Povo resistente do deserto, adaptado a clima extremo, disciplina e tradição guerreira.~Humana~Humanoide~Comum
Goron~The Legend of Zelda~construct~Povo rochoso muito resistente, adaptado a calor, montanhas e impacto físico.~Longa~Pétreo humanoide~Incomum
Zora~The Legend of Zelda~aquatic~Povo aquático humanoide de grande mobilidade na água e adaptação anfíbia.~Longa~Aquático humanoide~Incomum
Rito~The Legend of Zelda~beast~Povo aviário humanoide especializado em voo, percepção e deslocamento vertical.~Humana~Humanoide alado~Incomum
Tiefling~Dungeons & Dragons~infernal~Humanoide com herança infernal, resistências e magia inata.~Humana a longa~Humanoide~Incomum
Dragonborn~Dungeons & Dragons~dragon~Humanoide dracônico robusto com sopro e ancestralidade elemental.~Humana~Humanoide dracônico~Incomum
Aasimar~Dungeons & Dragons~celestial~Humanoide com herança celestial ligado a energia radiante, cura ou resistência espiritual.~Humana a longa~Humanoide~Incomum
Warforged~Dungeons & Dragons~machine~Constructo consciente criado para agir como pessoa e combatente, com poucas necessidades biológicas.~Indefinida com manutenção~Constructo humanoide~Incomum
Yautja~Predator~hunter~Espécie alienígena de caçadores fisicamente superiores, disciplinados e guiados por código cultural rígido.~Longa~Humanoide alienígena~Muito raro
Xenomorfo~Alien~hive~Organismo extraterrestre predatório de adaptação extrema, comportamento de colmeia e fisiologia altamente hostil.~Variável~Xenoforme~Muito raro
Na’vi~Avatar~alien~Povo humanoide de Pandora, alto, ágil e profundamente conectado ao ecossistema local.~Longa~Humanoide alto~Raro
Cybertroniano~Transformers~machine~Forma de vida mecânica consciente capaz de transformação física e enorme durabilidade estrutural.~Extremamente longa~Mecânico transformável~Muito raro
Wookiee~Star Wars~beast~Espécie humanoide alta, forte, longeva e de sentidos apurados, com cultura de lealdade intensa.~Longa~Humanoide alto~Raro
Pokémon~Pokémon~creature~Categoria ampla de criaturas com tipos, habilidades e evoluções radicalmente diferentes; as sub-roletas definem o indivíduo.~Variável~Variável~Variável
Digimon~Digimon~digital~Forma de vida digital cujo nível e atributos podem mudar drasticamente por digievolução.~Variável / digital~Digital variável~Variável
Kaiju~Tokusatsu / ficção de monstros~kaiju~Criatura colossal cuja massa altera combate, mobilidade, resistência e impacto ambiental.~Muito longa~Colossal~Extremamente raro`.trim().split('\n');
const META={};for(const r of rows){const[a,source,kind,summary,life,body,rarity]=r.split('~');META[a]={source,kind,summary,life,body,rarity}}
D.V13_RACE_META=META;})();