(()=>{'use strict';const D=window.ROULETTE_DATA;if(!D)return;
const uniq=a=>[...new Set(a)];
const seq=(a,b,s=1)=>{const out=[];for(let v=a;v<=b+1e-9;v+=s)out.push(Number(v.toFixed(2)));return out};
const fmtInt=n=>`${Math.round(n).toLocaleString('pt-BR')} anos`;
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
function agesFor(r){
 if(cosmic.has(r))return uniq([...seq(0,200,1),...seq(210,1000,10),...seq(1050,10000,50),...seq(10100,100000,100),...seq(101000,1000000,1000),...seq(1010000,10000000,10000)]).map(fmtInt);
 if(ancient.has(r))return uniq([...seq(0,200,1),...seq(205,1000,5),...seq(1025,5000,25),...seq(5100,50000,100)]).map(fmtInt);
 if(longLived.has(r))return uniq([...seq(0,200,1),...seq(205,1000,5),...seq(1025,5000,25)]).map(fmtInt);
 if(shortLived.has(r))return seq(0,200,1).map(fmtInt);
 if(mortal.has(r))return seq(0,120,1).map(fmtInt);
 return seq(0,200,1).map(fmtInt);
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