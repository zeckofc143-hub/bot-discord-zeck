(()=>{'use strict';const D=window.ROULETTE_DATA;if(!D)return;
const uniq=a=>[...new Set(a)];
const seq=(a,b,s=1)=>{const out=[];for(let v=a;v<=b+1e-9;v+=s)out.push(Number(v.toFixed(2)));return out};
const fmtM=n=>`${Number(n).toFixed(2).replace('.',',')} m`;
let currentRace='Humano';
const oldRaceEffects=D.raceEffectsFor;
D.raceEffectsFor=r=>{currentRace=r||currentRace;return oldRaceEffects?oldRaceEffects(r):[]};
D.currentRaceForNumbers=()=>currentRace;
const mortal=new Set(['Humano','Ghoul','Shinigami','Quincy','Fullbringer','Homúnculo','Homem-Peixe','Mink','Skypiean','Buccaneer','Hylian','Gerudo','Goron','Zora','Rito','Sheikah','Argoniano','Khajiit','Draenei','Elfo Noturno','Elfo Sangrento','Tauren','Worgen','Tiefling','Dragonborn','Aasimar','Asari','Krogan','Sangheili','Yautja','Na’vi','Wookiee','Twi’lek','Togruta','Zabrak']);
const shortLived=new Set(['Pokémon','Quimera Ant','Demônio de Kimetsu','Titã']);
const longLived=new Set(['Elfo','Anão','Orc','Goblin','Troll','Ogro','Fada','Sereia','Tritão','Centauro','Minotauro','Sátiro','Harpia','Fênix','Grifo','Golem','Slime','Djinn','Oni','Kitsune','Tengu','Nagá','Lâmia','Gárgula','Ciclope','Metamorfo','Elemental','Espírito','Namekuseijin','Majin','Saiyajin','Cybertroniano','Klyntar','Simbionte','Warforged','Digimon','Protoss','Zerg','Necron','Tyranid','Xenomorfo','Kaiju']);
const ancient=new Set(['Vampiro','Lobisomem','Demônio','Diabo','Anjo','Anjo Caído','Dragão','Viltrumita','Kryptoniano','Tamaraneano','Marciano','Asgardiano','Eterno','Inumano','Celestial','Raça do Freeza','Kaioshin','Hollow','Arrancar','Otsutsuki','Espírito Amaldiçoado']);
const cosmic=new Set(['Deus','Semideus','Novo Deus']);
const BASE_AGE=['Recém-nascido','1–9 anos','10 anos','11–19 anos','20 anos','21–39 anos','40–80 anos','81–99 anos','100 anos','101–499 anos','500 anos','501–999 anos','1k anos','Desconhecida'];
const LONG_AGE=['Recém-nascido','1–9 anos','10 anos','11–19 anos','20 anos','21–39 anos','40–80 anos','81–99 anos','100 anos','101–499 anos','500 anos','501–999 anos','1k anos','1k–2k anos','2k–5k anos','5k–10k anos','10k anos','Desconhecida'];
const ANCIENT_AGE=['Recém-nascido','1–9 anos','10 anos','11–19 anos','20 anos','21–39 anos','40–80 anos','81–99 anos','100 anos','101–499 anos','500 anos','501–999 anos','1k anos','1k–5k anos','5k–10k anos','10k–50k anos','50k anos','Desconhecida'];
const COSMIC_AGE=['Recém-nascido','10 anos','20 anos','40–80 anos','100 anos','500 anos','1k anos','1k–10k anos','10k–100k anos','100k–1M anos','1M anos','1M–10M anos','10M–100M anos','100M–1B anos','1B+ anos','Desconhecida'];
function agesFor(r){
 if(cosmic.has(r))return COSMIC_AGE;
 if(ancient.has(r))return ANCIENT_AGE;
 if(longLived.has(r))return LONG_AGE;
 if(shortLived.has(r))return BASE_AGE;
 if(mortal.has(r))return BASE_AGE;
 return BASE_AGE;
}
function heightsFor(r){
 if(r==='Slime')return seq(.20,3,.05).map(fmtM);
 if(r==='Fada')return seq(.10,1.20,.02).map(fmtM);
 if(r==='Anão'||r==='Goblin')return seq(.80,1.65,.01).map(fmtM);
 if(r==='Goron')return seq(1.20,3.50,.02).map(fmtM);
 if(r==='Gigante')return seq(2.50,30,.25).map(fmtM);
 if(r==='Titã')return seq(3,60,.25).map(fmtM);
 if(r==='Kaiju')return seq(10,300,2).map(fmtM);
 if(r==='Dragão')return uniq([...seq(.50,10,.10),...seq(10.5,50,.5),...seq(52,200,2)]).map(fmtM);
 if(r==='Xenomorfo'||r==='Yautja'||r==='Sangheili')return seq(1.70,3.20,.01).map(fmtM);
 if(r==='Krogan')return seq(1.70,2.80,.01).map(fmtM);
 if(r==='Viltrumita'||r==='Kryptoniano'||r==='Saiyajin'||r==='Ghoul'||r==='Shinigami'||r==='Quincy'||r==='Otsutsuki'||r==='Humano')return seq(1.40,2.30,.01).map(fmtM);
 if(cosmic.has(r)||r==='Celestial'||r==='Novo Deus')return uniq([...seq(1.40,3,.02),...seq(3.25,20,.25),...seq(21,100,1)]).map(fmtM);
 return seq(.60,3.50,.02).map(fmtM);
}
Object.defineProperty(D,'AGES',{configurable:true,enumerable:true,get(){return agesFor(currentRace)}});
Object.defineProperty(D,'HEIGHTS',{configurable:true,enumerable:true,get(){return heightsFor(currentRace)}});
D.ageOptionsFor=agesFor;D.heightOptionsFor=heightsFor;
})();