(()=>{'use strict';
const D=window.ROULETTE_DATA;if(!D)throw Error('ROULETTE_DATA ausente');
const $=i=>document.getElementById(i);
const A=(k,f=['Nenhum'])=>D[k]?.length?D[k]:f;
const R=n=>{if(n<=1)return 0;const a=new Uint32Array(1);return globalThis.crypto?.getRandomValues?(crypto.getRandomValues(a),a[0]%n):Math.floor(Math.random()*n)};
const sh=a=>{a=[...a];for(let i=a.length-1;i;i--){const j=R(i+1);[a[i],a[j]]=[a[j],a[i]]}return a};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clean=v=>D.cleanWeightedValue?D.cleanWeightedValue(v):String(v??'').replace(/\u200B/g,'');

const c=$('wheel'),x=c.getContext('2d'),btn=$('spinBtn');
const pal=['#ef233c','#ff6b00','#ffb703','#80b918','#00b894','#00b4d8','#168aad','#4361ee','#7209b7','#b5179e','#f72585','#6a4c93'];

const M={
 race:['Raça','🧬'],raceType:['Sub-raça / tipo','🧬'],raceLineage:['Linhagem','🩸'],raceTrait:['Característica racial','✨'],
 age:['Idade','⌛'],height:['Tamanho','📐'],archetype:['Arquétipo','🃏'],title:['Título','📕'],morality:['Personalidade','🎭'],
 social:['Reputação','🌐'],role:['Ocupação','🧭'],faction:['Facção','🏛️'],hasPower:['Você tem poder?','❓'],
 powerCount:['Quantidade de poderes','🔢'],power:['Poder','⚡'],powerSource:['Origem do poder','🌌'],powerStyle:['Manifestação','✨'],
 powerRank:['Rank do poder','📈'],powerControl:['Controle','🎯'],powerCost:['Custo / condição','⏳'],hasMagic:['Usa magia?','🔮'],
 magicSource:['Fonte mágica','🔮'],manaReserve:['Reserva de mana','💠'],magicRank:['Rank mágico','🪄'],
 hasTransformation:['Transformação?','🌕'],transformType:['Tipo de transformação','🐉'],transformLevel:['Nível da transformação','📶'],
 hasCompanion:['Companheiro?','🐾'],companionType:['Companheiro','🐉'],companionBond:['Vínculo','🤝'],
 hasBlessing:['Bênção?','🌟'],blessing:['Bênção','🌟'],hasCurse:['Maldição?','🌑'],curse:['Maldição','🌑'],
 class:['Classe','🧭'],affinity:['Afinidade','🔮'],talent:['Talento','🌟'],limit:['Limitação','⛓️'],
 intelligence:['Inteligência','🧠'],combat:['Combate','🤼'],speed:['Velocidade','⚡'],resistance:['Resistência','🛡️'],
 strength:['Força','💪'],luck:['Sorte','🍀'],aura:['Aura','🌈'],specialSense:['Sentido especial','👁️'],
 regen:['Regeneração','♻️'],potential:['Potencial','📊'],evolution:['Evolução','🧬'],hasItem:['Artefato fantástico?','💎'],
 item:['Artefato','💠'],mastery:['Maestria','✨'],enchantCount:['Encantamentos','🔢'],enchant:['Encantamento','💎'],
 origin:['Origem','🗺️'],goal:['Objetivo','🎯'],whatNow:['O que faz agora?','🧭']
};
Object.assign(M,D.V5_META||{});

const statNames={strength:'Força',resistance:'Resistência',speed:'Velocidade',intelligence:'Inteligência',combat:'Combate',luck:'Sorte',regen:'Regeneração'};
const S={q:[],i:0,cur:null,entries:[],vis:[],ang:0,sp:0,res:[],sheet:{},p:0,pi:0,e:0,ei:0,usedP:new Set,usedE:new Set,effects:[],stats:{strength:0,resistance:0,speed:0,intelligence:0,combat:0,luck:0,regen:0},base:{}};

const st=(id,o,z={})=>({id,o,...z});
const ins=a=>S.q.splice(S.i+1,0,...a);
const lab=s=>typeof s.label==='function'?s.label():s.label||(M[s.id]?.[0]||s.id);

function entriesFrom(raw){
  const map=new Map();
  for(const original of (raw||[])){
    const value=clean(original);
    if(!value)continue;
    const e=map.get(value);
    if(e)e.weight++;
    else map.set(value,{value,weight:1});
  }
  return [...map.values()];
}
function stageEntries(s){
  const raw=typeof s.o==='function'?s.o():s.o;
  return entriesFrom(raw);
}
function totalWeight(entries){return entries.reduce((n,e)=>n+Math.max(1,e.weight||1),0)}
function pickWeighted(entries){
  let n=R(totalWeight(entries));
  for(const e of entries){n-=Math.max(1,e.weight||1);if(n<0)return e}
  return entries[entries.length-1];
}
function visualEntries(entries,winner=null){
  if(entries.length<=64)return entries.map(e=>({...e}));
  const pool=entries.filter(e=>!winner||e.value!==winner.value);
  const out=winner?[{...winner}]:[];
  while(out.length<64&&pool.length){
    const idx=R(pool.length);out.push({...pool.splice(idx,1)[0]});
  }
  return sh(out);
}

function queue(){
 const q=[
  st('race',()=>A('RACES')),
  st('raceType',()=>D.raceTypesFor?D.raceTypesFor(S.sheet.race):['Comum'],{label:()=>D.raceTypeLabelFor?D.raceTypeLabelFor(S.sheet.race):`Que tipo de ${S.sheet.race||'raça'}?`}),
  st('raceLineage',()=>D.raceLineageFor?D.raceLineageFor(S.sheet.race):['Sem linhagem'],{label:()=>D.raceLineageLabelFor?D.raceLineageLabelFor(S.sheet.race):'Linhagem'}),
  st('raceTrait',()=>D.raceTraitFor?D.raceTraitFor(S.sheet.race):['Traço natural'],{label:()=>D.raceTraitLabelFor?D.raceTraitLabelFor(S.sheet.race):'Característica racial'})
 ];
 for(const[id,k]of[['age','AGES'],['height','HEIGHTS'],['archetype','ARCHETYPES'],['title','TITLES'],['morality','MORALITY'],['social','SOCIAL'],['role','ROLES'],['faction','FACTIONS']])q.push(st(id,()=>A(k)));
 q.push(
  st('hasPower',()=>A('HAS_POWER',['Sim','Não']),{after:pow}),
  st('hasMagic',()=>A('HAS_MAGIC',['Sim','Não']),{after:magic}),
  st('hasTransformation',()=>A('HAS_TRANSFORMATION',['Sim','Não']),{after:trans}),
  st('hasCompanion',()=>A('HAS_COMPANION',['Sim','Não']),{after:comp}),
  st('hasBlessing',()=>A('HAS_BLESSING',['Sim','Não']),{after:bless}),
  st('hasCurse',()=>A('HAS_CURSE',['Sim','Não']),{after:curse})
 );
 for(const[id,k]of[['class','CLASSES'],['affinity','AFFINITIES'],['talent','TALENTS'],['limit','LIMITS'],['intelligence','INTELLIGENCE'],['combat','COMBAT'],['speed','SPEED'],['resistance','SCALE'],['strength','SCALE'],['luck','LUCK'],['aura','AURA'],['specialSense','SPECIAL_SENSE'],['regen','REGEN'],['potential','POTENTIAL'],['evolution','EVOLUTION']])q.push(st(id,()=>A(k)));
 if(D.MEGA12)for(const[id,r]of Object.entries(D.MEGA12)){
   q.push(st(id,()=>r.main,{label:r.label}));
   r.subs.forEach((a,j)=>q.push(st(`${id}Sub${j+1}`,()=>a,{label:`${r.label} • detalhe ${j+1}`})));
 }
 q.push(st('hasItem',()=>A('HAS_ITEM',['Sim','Não']),{after:item}),st('origin',()=>A('ORIGINS')),st('goal',()=>A('GOALS',['Explorar o mundo'])),st('whatNow',()=>A('WHAT_NOW',['Seguir viagem'])));
 return q;
}
function pow(v){if(v!=='Sim')return;ins([st('powerCount',()=>A('POWER_COUNT',['1','2','3','4','5']),{after:n=>{S.p=Math.min(8,parseInt(n)||1);S.pi=0;nextP()}})])}
function nextP(){const n=++S.pi;ins([
 st('power',()=>A('POWERS').filter(v=>!S.usedP.has(clean(v))),{label:`Poder ${n}/${S.p}`,key:`power_${n}`,after:v=>S.usedP.add(v)}),
 st('powerSource',()=>A('POWER_SOURCES',['Nascença','Despertar','Herança','Evento cósmico']),{key:`powerSource_${n}`}),
 st('powerStyle',()=>A('POWER_STYLE',['Aura','Campo','Projeção']),{key:`powerStyle_${n}`}),
 st('powerRank',()=>A('POWER_RANKS',['C','B','A','S']),{key:`powerRank_${n}`}),
 st('powerControl',()=>A('POWER_CONTROL',['Instável','Bom','Perfeito']),{key:`powerControl_${n}`}),
 st('powerCost',()=>A('POWER_COST',['Baixo','Moderado','Alto','Condição especial']),{key:`powerCost_${n}`,after:()=>{if(S.pi<S.p)nextP()}})
])}
function magic(v){if(v==='Sim')ins([st('magicSource',()=>A('MAGIC_SOURCE',['Mana interna','Ambiente','Runas','Espíritos'])),st('manaReserve',()=>A('MANA_RESERVE',['Baixa','Média','Alta','Imensa'])),st('magicRank',()=>A('MAGIC_RANK',['Aprendiz','Mago','Arquimago']))])}
function trans(v){if(v==='Sim')ins([st('transformType',()=>A('TRANSFORM_TYPE',['Forma bestial','Forma elemental','Forma cósmica'])),st('transformLevel',()=>A('TRANSFORM_LEVEL',['Inicial','Treinada','Perfeita']))])}
function comp(v){if(v==='Sim')ins([st('companionType',()=>A('COMPANION_TYPE',['Familiar espiritual','Criatura fantástica','Constructo mágico'])),st('companionBond',()=>A('COMPANION_BOND',['Amizade','Pacto','Família','Parceria']))])}
function bless(v){if(v==='Sim')ins([st('blessing',()=>A('BLESSINGS',['Bênção astral','Bênção da memória','Bênção da sorte']))])}
function curse(v){if(v==='Sim')ins([st('curse',()=>A('CURSES',['Maldição do eco','Maldição do sono','Maldição da memória']))])}
function item(v){if(v==='Sim')ins([st('item',()=>A('FANTASY_ITEMS')),st('mastery',()=>A('MASTERY',['Novato','Treinado','Mestre','Grão-Mestre'])),st('enchantCount',()=>A('ENCHANT_COUNT',['0','1','2','3','4','5']),{after:n=>{S.e=Math.min(8,parseInt(n)||0);S.ei=0;if(S.e)nextE()}})])}
function nextE(){const n=++S.ei;ins([st('enchant',()=>A('ENCHANTMENTS').filter(v=>!S.usedE.has(clean(v))),{label:`Encantamento ${n}/${S.e}`,key:`enchant_${n}`,after:v=>{S.usedE.add(v);if(S.ei<S.e)nextE()}})])}

function addEffect(kind,text,source){S.effects.push({kind,text,source});if(S.effects.length>120)S.effects.shift()}
function stat(k,n,source){S.stats[k]=(S.stats[k]||0)+n;addEffect(n>=0?'buff':'debuff',`${n>=0?'+':''}${n} ${statNames[k]||k}`,source)}
function applyTuple(e,source){if(e[0]==='stat')stat(e[1],Number(e[2])||0,source);else addEffect(e[0]==='loss'?'debuff':'gain',`${e[0]==='loss'?'-':'+'}${e[1]}`,source)}
function inferTrait(v,source){
 const t=String(v).toLowerCase();
 if(t.includes('força'))stat('strength',1,source);if(t.includes('resist'))stat('resistance',1,source);if(t.includes('veloc'))stat('speed',1,source);if(t.includes('regenera'))stat('regen',2,source);
 if(t.includes('sentido'))addEffect('gain','+Sentidos aprimorados',source);if(t.includes('voo'))addEffect('gain','+Voo',source);if(t.includes('potencial'))addEffect('gain','+Potencial elevado',source);
 if(!/(força|resist|veloc|regenera|sentido|voo|potencial)/.test(t))addEffect('gain',`+${v}`,source);
}
function inferPower(v,source){
 const t=String(v).toLowerCase();addEffect('gain',`+Poder: ${v}`,source);
 if(t.includes('força'))stat('strength',2,source);if(t.includes('resist')||t.includes('barreira'))stat('resistance',2,source);if(t.includes('veloc')||t.includes('acelera'))stat('speed',2,source);
 if(t.includes('regenera')||t.includes('cura'))stat('regen',2,source);if(t.includes('telepat'))addEffect('gain','+Telepatia',source);if(t.includes('imortal'))addEffect('gain','+Imortalidade',source);
 if(t.includes('voo')||t.includes('levita'))addEffect('gain','+Voo',source);if(t.includes('tempo'))addEffect('gain','+Afinidade temporal',source);if(t.includes('gravidade'))addEffect('gain','+Manipulação gravitacional',source);
 if(t.includes('mente')||t.includes('psíqu'))stat('intelligence',1,source);
}
function applyResult(id,v,label,key){
 const source=`${label}: ${v}`;
 if(id==='race')(D.raceEffectsFor?.(v)||[]).forEach(e=>applyTuple(e,source));
 else if(id==='raceType')(D.typeEffectsFor?.(v)||[]).forEach(e=>applyTuple(e,source));
 else if(id==='raceTrait')inferTrait(v,source);
 else if(id==='power')inferPower(v,source);
 else if(['strength','resistance','speed','intelligence','combat','luck','regen'].includes(id))S.base[id]=v;
 else if(id==='blessing')addEffect('gain',`+${v}`,source);
 else if(id==='curse')addEffect('debuff',`-${v}`,source);
 else if(id==='transformType')addEffect('gain',`+Transformação: ${v}`,source);
 else if(id==='specialSense')addEffect('gain',`+Sentido: ${v}`,source);
 else if(id==='item')addEffect('gain',`+Artefato: ${v}`,source);
 else if(id==='enchant')addEffect('gain',`+Encantamento: ${v}`,source);
 else if(id==='class'){const t=String(v).toLowerCase();if(/guerreiro|lutador|cavaleiro|samurai/.test(t))stat('combat',2,source);if(/mago|feiticeiro|bruxo|arquimago/.test(t))stat('intelligence',2,source)}
}

function begin(){
 if(S.i>=S.q.length)return done();
 S.cur=S.q[S.i];S.entries=stageEntries(S.cur);S.vis=visualEntries(S.entries);
 const m=M[S.cur.id]||['Roleta','🎲'],L=lab(S.cur),weighted=S.entries.some(e=>e.weight>1);
 $('stageTitle').textContent=L;$('stageIcon').textContent=m[1]||'🎲';$('stageQuestion').textContent=`Gire: ${L}`;
 $('stageHint').textContent=`${S.entries.length.toLocaleString('pt-BR')} opções${weighted?' • fatias proporcionais à chance':''}`;
 $('resultText').textContent='Toque em GIRAR';$('stepLabel').textContent=`Etapa ${S.i+1} de ${S.q.length}`;
 $('progressFill').style.width=`${Math.max(2,S.i/S.q.length*100)}%`;btn.disabled=false;btn.textContent='GIRAR';
 draw();renderOptions();renderLive();
}
function short(t){t=String(t).replace(/^Título\s+/,'').replace(/^Artefato\s+/,'').replace(/^Encantamento\s+/,'');return t.length>22?t.slice(0,21)+'…':t}

function geometry(entries){
 const total=totalWeight(entries),out=[];let acc=0;
 for(const e of entries){
   const a=-Math.PI/2+(acc/total)*Math.PI*2;
   acc+=Math.max(1,e.weight||1);
   const b=-Math.PI/2+(acc/total)*Math.PI*2;
   out.push({e,a,b,c:(a+b)/2,span:b-a});
 }
 return out;
}
function draw(){
 const entries=S.vis.length?S.vis:[{value:'Nenhum',weight:1}],g=geometry(entries),w=c.width,h=c.height,cx=w/2,cy=h/2,r=Math.min(w,h)*.48;
 x.clearRect(0,0,w,h);x.save();x.translate(cx,cy);x.rotate(S.ang);
 g.forEach((s,i)=>{
   x.beginPath();x.moveTo(0,0);x.arc(0,0,r,s.a,s.b);x.closePath();x.fillStyle=pal[i%pal.length];x.fill();x.strokeStyle='rgba(255,255,255,.16)';x.lineWidth=2;x.stroke();
   if(s.span>.035){
     x.save();x.rotate(s.c);x.translate(r*.70,0);x.rotate(Math.PI/2);
     const deg=s.span*180/Math.PI,fs=deg>40?30:deg>25?25:deg>14?20:deg>7?15:12;
     x.font=`800 ${fs}px system-ui`;x.fillStyle='#fff';x.textAlign='center';x.textBaseline='middle';x.shadowColor='rgba(0,0,0,.85)';x.shadowBlur=4;
     x.fillText(short(s.e.value),0,0);x.restore();
   }
 });
 x.restore();x.beginPath();x.arc(cx,cy,r*.225,0,Math.PI*2);x.fillStyle='#171a22';x.fill();x.strokeStyle='rgba(255,255,255,.18)';x.lineWidth=8;x.stroke();
}
function normalizePositive(a){const t=Math.PI*2;return((a%t)+t)%t}
function spin(){
 if(S.sp||!S.entries.length)return;S.sp=1;btn.disabled=true;document.querySelector('.wheel-wrap')?.classList.add('spinning');
 const win=pickWeighted(S.entries);S.vis=visualEntries(S.entries,win);
 const g=geometry(S.vis),sector=g.find(s=>s.e.value===win.value),start=S.ang;
 const desired=-Math.PI/2-sector.c;
 const delta=normalizePositive(desired-start);
 const target=start+(6+R(4))*Math.PI*2+delta,t0=performance.now();
 function f(now){const t=Math.min(1,(now-t0)/2800),e=1-Math.pow(1-t,4);S.ang=start+(target-start)*e;draw();t<1?requestAnimationFrame(f):resolve(win.value)}
 requestAnimationFrame(f);
}
function resolve(v){
 S.sp=0;document.querySelector('.wheel-wrap')?.classList.remove('spinning');
 const s=S.cur,k=s.key||s.id,L=lab(s),value=clean(v);
 S.sheet[k]=value;S.res.push({l:L,v:value,id:s.id,key:k});applyResult(s.id,value,L,k);
 $('resultText').textContent=value;renderPath();renderSheet();renderLive();s.after?.(value);
 btn.textContent='PRÓXIMA';btn.disabled=false;btn.onclick=()=>{btn.onclick=spin;S.i++;begin()};
}
function renderLive(){
 const box=$('liveStatus');if(!box)return;const obtained=S.res.slice(-10),effects=S.effects.slice(-14),statOrder=['strength','resistance','speed','intelligence','combat','luck','regen'];
 box.innerHTML=`<div class="v7-live-head"><div><p class="eyebrow">PERSONAGEM ATUAL</p><h3>${esc(S.sheet.race||'Ainda não definido')}</h3></div><span class="counter">${S.res.length}</span></div>
 <div class="v7-block"><h4>🎲 OBTIVE</h4><div class="obtained-grid">${obtained.length?obtained.map(r=>`<div class="obtained-item"><span>${esc(r.l)}</span><strong>${esc(r.v)}</strong></div>`).join(''):'<span class="empty">Nada ainda.</span>'}</div></div>
 <div class="v7-block"><h4>⚡ EFEITOS GANHOS</h4><div class="effect-list">${effects.length?effects.map(e=>`<div class="effect ${e.kind}"><b>${esc(e.text)}</b><small>${esc(e.source)}</small></div>`).join(''):'<span class="empty">Nenhum efeito aplicado ainda.</span>'}</div></div>
 <div class="v7-block"><h4>📊 STATUS ATUAL</h4><div class="derived-grid">${statOrder.map(k=>`<div class="derived"><span>${statNames[k]}</span><strong>${S.base[k]?esc(S.base[k]):'Base não rolada'}</strong><b class="${S.stats[k]<0?'neg':'pos'}">${S.stats[k]>=0?'+':''}${S.stats[k]} bônus</b></div>`).join('')}</div></div>`;
}
function renderPath(){
 $('pathCount').textContent=S.res.length;
 $('pathList').innerHTML=S.res.length?S.res.slice(-20).map(r=>`<span class="path-chip"><b>${esc(r.l)}</b>${esc(r.v)}</span>`).join(''):'<span class="empty">Nada rolado ainda.</span>';
}
function renderSheet(){
 $('sheetContent').innerHTML=S.res.length?S.res.map(r=>`<div class="sheet-row"><span>${esc(r.l)}</span><strong>${esc(r.v)}</strong></div>`).join('')+`<h3 class="sheet-subtitle">Efeitos ganhos</h3>`+S.effects.map(e=>`<div class="sheet-row"><span>${esc(e.kind)}</span><strong>${esc(e.text)}</strong></div>`).join(''):'<span class="empty">Ainda não há resultados.</span>';
}
function renderOptions(){
 const q=($('optionSearch').value||'').toLowerCase(),total=totalWeight(S.entries);
 const a=S.entries.filter(e=>!q||e.value.toLowerCase().includes(q));
 $('optionsTitle').textContent=`${S.cur?lab(S.cur):'Opções'} • ${a.length.toLocaleString('pt-BR')}`;
 $('optionsGrid').innerHTML=a.slice(0,400).map(e=>{
   const pct=total?(e.weight/total*100):0;
   return `<div class="option-item" title="${pct.toFixed(2).replace('.',',')}%">${esc(e.value)}${e.weight>1?` • ${pct.toFixed(pct>=10?0:1).replace('.',',')}%`:''}</div>`;
 }).join('')+(a.length>400?`<div class="option-item">+ ${a.length-400} opções…</div>`:'');
}
function done(){
 $('stageTitle').textContent='Ficha concluída';$('stageIcon').textContent='✅';$('stageQuestion').textContent='Seu personagem está pronto.';
 $('stageHint').textContent=`${S.res.length} resultados • ${S.effects.length} efeitos`;$('resultText').textContent=S.sheet.title||S.sheet.race||'PERSONAGEM CONCLUÍDO';
 $('progressFill').style.width='100%';btn.disabled=true;btn.textContent='CONCLUÍDO';renderSheet();renderLive();
}
function reset(){
 Object.assign(S,{q:[],i:0,cur:null,entries:[],vis:[],ang:0,sp:0,res:[],sheet:{},p:0,pi:0,e:0,ei:0,usedP:new Set,usedE:new Set,effects:[],stats:{strength:0,resistance:0,speed:0,intelligence:0,combat:0,luck:0,regen:0},base:{}});
 S.q=queue();btn.onclick=spin;renderPath();renderSheet();renderLive();begin();
}
btn.onclick=spin;$('resetBtn').onclick=reset;
$('optionsBtn').onclick=()=>$('optionsPanel').classList.remove('hidden');
$('sheetBtn').onclick=()=>{renderSheet();$('sheetPanel').classList.remove('hidden')};
document.querySelectorAll('[data-close="options"]').forEach(b=>b.onclick=()=>$('optionsPanel').classList.add('hidden'));
document.querySelectorAll('[data-close="sheet"]').forEach(b=>b.onclick=()=>$('sheetPanel').classList.add('hidden'));
$('optionSearch').oninput=renderOptions;
$('copyBtn').onclick=()=>navigator.clipboard?.writeText([...S.res.map(r=>`${r.l}: ${r.v}`),'','EFEITOS:',...S.effects.map(e=>e.text)].join('\n'));
reset();
})();