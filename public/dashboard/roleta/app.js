(() => {
  'use strict';
  const D = window.ROULETTE_DATA;
  if (!D) throw new Error('ROULETTE_DATA não carregado.');

  const $ = id => document.getElementById(id);
  const canvas = $('wheel');
  const ctx = canvas.getContext('2d');
  const spinBtn = $('spinBtn');
  const resetBtn = $('resetBtn');
  const stageTitle = $('stageTitle');
  const stageIcon = $('stageIcon');
  const stageQuestion = $('stageQuestion');
  const stageHint = $('stageHint');
  const resultText = $('resultText');
  const stepLabel = $('stepLabel');
  const progressFill = $('progressFill');
  const pathList = $('pathList');
  const pathCount = $('pathCount');
  const optionsBtn = $('optionsBtn');
  const sheetBtn = $('sheetBtn');
  const optionsPanel = $('optionsPanel');
  const sheetPanel = $('sheetPanel');
  const optionsTitle = $('optionsTitle');
  const optionsGrid = $('optionsGrid');
  const optionSearch = $('optionSearch');
  const sheetContent = $('sheetContent');
  const copyBtn = $('copyBtn');
  const toast = $('toast');

  const palette = ['#ff3b30','#ff9500','#ffcc00','#34c759','#00c7be','#32ade6','#007aff','#5856d6','#af52de','#ff2d55'];
  const darkPalette = ['#4b0a0a','#6a2200','#6f5600','#0d4d20','#064a45','#0b3857','#092f66','#28225f','#512066','#6b1033'];

  const META = {
    race:['Raça','🧬','Qual será sua raça?','100 raças. O resultado abre sub-roletas próprias.'],
    subtype:['Sub-raça / linhagem','🧬','Que tipo da sua raça você é?','Cada raça possui sua própria linhagem.'],
    raceTrait:['Traço racial','✨','Qual traço especial veio junto?','Esse traço depende da família da raça.'],
    raceRank:['Posição racial','👑','Qual é seu nível dentro da própria espécie?','A escala muda conforme a raça.'],
    age:['Idade','⌛','Qual é sua idade aparente?','Algumas raças vivem muito mais que outras.'],
    height:['Tamanho','📐','Qual é seu tamanho?','Valores comuns e anormais estão misturados.'],
    archetype:['Arquétipo','🃏','Qual é seu arquétipo?','Mais de 100 papéis narrativos.'],
    title:['Título','📕','Qual é seu título?','Centenas de títulos possíveis.'],
    morality:['Personalidade-base','🎭','Qual é sua tendência de personalidade?','Isso não prende o personagem; é só o ponto de partida.'],
    social:['Reputação','🌐','Quão conhecido você é?','De desconhecido a lenda de vários mundos.'],
    hasPower:['Você tem algum poder?','❓','Você nasceu/despertou com poderes?','Se cair sim, abre várias sub-roletas.'],
    powerCount:['Quantidade de poderes','🔢','Quantos poderes você possui?','Cada poder ganha estilo, rank, controle e custo.'],
    power:['Poder','⚡','Qual poder você recebeu?','Mais de mil combinações no banco.'],
    powerStyle:['Forma do poder','🌀','Como esse poder se manifesta?','A forma muda como ele aparece na história.'],
    powerRank:['Rank do poder','📈','Qual é a raridade/escala desse poder?','Escala puramente fictícia.'],
    powerControl:['Controle','🎯','Quanto controle você tem desse poder?','De instável a perfeito.'],
    powerCost:['Custo / condição','⏳','Qual é o custo narrativo desse poder?','Uma limitação deixa o resultado mais interessante.'],
    class:['Classe','🧭','Qual é sua classe?','A classe não precisa combinar com a raça.'],
    affinity:['Afinidade','🔮','Qual é sua afinidade principal?','Elemental, abstrata, cósmica e outras.'],
    talent:['Talento','🌟','Qual talento natural você possui?','É uma vantagem adicional.'],
    limit:['Limitação geral','⛓️','Qual é sua principal limitação?','Pode afetar poderes, magia ou estilo geral.'],
    intelligence:['Inteligência','🧠','Qual é sua inteligência?','Escala fictícia, indo do comum ao absurdo.'],
    combat:['Combate','🤼','Qual é seu domínio de combate fictício?','Mede experiência narrativa, não técnica real.'],
    speed:['Velocidade','⚡','Qual é sua velocidade?','Escala de power-scaling fictícia.'],
    resistance:['Resistência','🛡️','Qual é sua resistência?','Escala fictícia de power-scaling.'],
    strength:['Força','💪','Qual é sua força?','Escala fictícia de power-scaling.'],
    luck:['Sorte','🍀','Quanta sorte você tem?','Pode mudar totalmente o personagem.'],
    hasItem:['Artefato fantástico?','💎','Você possui um artefato puramente fictício?','Se cair sim, abre sub-roletas do artefato.'],
    item:['Artefato fictício','💠','Qual artefato fantástico você possui?','Somente itens fictícios/mágicos nesta roleta.'],
    mastery:['Maestria com artefato','✨','Qual seu nível de maestria?','É apenas escala narrativa.'],
    enchantCount:['Encantamentos','🔢','Quantos encantamentos o artefato possui?','Pode cair zero.'],
    enchant:['Encantamento do artefato','💎','Qual encantamento ele recebeu?','Centenas de efeitos fictícios.'],
    origin:['Origem','🗺️','De onde você veio?','Mundo, plano, cidade ou origem estranha.'],
    whatNow:['O que faz agora?','🧭','Depois de tudo isso, o que você faz?','Última roleta da ficha.'],
    done:['Ficha concluída','✅','Seu personagem está pronto.','Você pode copiar a ficha ou reiniciar.']
  };

  const state = {
    queue: [], cursor: 0, current: null, options: [], angle: 0, spinning: false,
    results: [], sheet: {}, powerCount: 0, powerIndex: 0, enchantCount: 0, enchantIndex: 0,
    usedPowers: new Set(), usedEnchants: new Set()
  };

  const stage = (id, options, cfg = {}) => ({ id, options, ...cfg });
  const family = () => D.familyOf(state.sheet.race);
  const raceTraitOptions = () => D.RACE_BRANCH[family()] || D.RACE_BRANCH.other;
  const raceRankOptions = () => D.RACE_RANK[family()] || D.RACE_RANK.other;

  function initialQueue() {
    return [
      stage('race', () => D.RACES),
      stage('subtype', () => D.subracesFor(state.sheet.race)),
      stage('raceTrait', raceTraitOptions),
      stage('raceRank', raceRankOptions),
      stage('age', () => D.AGES),
      stage('height', () => D.HEIGHTS),
      stage('archetype', () => D.ARCHETYPES),
      stage('title', () => D.TITLES),
      stage('morality', () => D.MORALITY),
      stage('social', () => D.SOCIAL),
      stage('hasPower', () => D.HAS_POWER, { after: onHasPower }),
      stage('class', () => D.CLASSES),
      stage('affinity', () => D.AFFINITIES),
      stage('talent', () => D.TALENTS),
      stage('limit', () => D.LIMITS),
      stage('intelligence', () => D.INTELLIGENCE),
      stage('combat', () => D.COMBAT),
      stage('speed', () => D.SPEED),
      stage('resistance', () => D.SCALE),
      stage('strength', () => D.SCALE),
      stage('luck', () => D.LUCK),
      stage('hasItem', () => D.HAS_ITEM, { after: onHasItem }),
      stage('origin', () => D.ORIGINS),
      stage('whatNow', () => D.WHAT_NOW)
    ];
  }

  function insertAfterCurrent(stages) { state.queue.splice(state.cursor + 1, 0, ...stages); }

  function onHasPower(value) {
    if (value !== 'Sim') return;
    insertAfterCurrent([stage('powerCount', () => D.POWER_COUNT, { after: onPowerCount })]);
  }

  function onPowerCount(value) {
    state.powerCount = Math.max(1, Number(value) || 1);
    state.powerIndex = 0;
    insertPowerBundle();
  }

  function insertPowerBundle() {
    state.powerIndex += 1;
    const n = state.powerIndex;
    const remaining = () => D.POWERS.filter(p => !state.usedPowers.has(p));
    insertAfterCurrent([
      stage('power', remaining, { label: `Poder ${n}/${state.powerCount}`, key: `power_${n}`, after: value => state.usedPowers.add(value) }),
      stage('powerStyle', () => D.POWER_STYLE, { label: `Forma do poder ${n}/${state.powerCount}`, key: `powerStyle_${n}` }),
      stage('powerRank', () => D.POWER_RANKS, { label: `Rank do poder ${n}/${state.powerCount}`, key: `powerRank_${n}` }),
      stage('powerControl', () => D.POWER_CONTROL, { label: `Controle do poder ${n}/${state.powerCount}`, key: `powerControl_${n}` }),
      stage('powerCost', () => D.POWER_COST, {
        label: `Custo do poder ${n}/${state.powerCount}`, key: `powerCost_${n}`,
        after: () => { if (state.powerIndex < state.powerCount) insertPowerBundle(); }
      })
    ]);
  }

  function onHasItem(value) {
    if (value !== 'Sim') return;
    insertAfterCurrent([
      stage('item', () => D.FANTASY_ITEMS),
      stage('mastery', () => D.MASTERY),
      stage('enchantCount', () => D.ENCHANT_COUNT, { after: onEnchantCount })
    ]);
  }

  function onEnchantCount(value) {
    state.enchantCount = Math.max(0, Number(value) || 0);
    state.enchantIndex = 0;
    if (state.enchantCount > 0) insertEnchant();
  }

  function insertEnchant() {
    state.enchantIndex += 1;
    const n = state.enchantIndex;
    insertAfterCurrent([
      stage('enchant', () => D.ENCHANTMENTS.filter(e => !state.usedEnchants.has(e)), {
        label: `Encantamento ${n}/${state.enchantCount}`, key: `enchant_${n}`,
        after: value => {
          state.usedEnchants.add(value);
          if (state.enchantIndex < state.enchantCount) insertEnchant();
        }
      })
    ]);
  }

  function resolveOptions(stageObj) {
    const source = typeof stageObj.options === 'function' ? stageObj.options() : stageObj.options;
    return Array.isArray(source) && source.length ? source.slice() : ['Nenhum'];
  }

  function currentMeta() {
    const m = META[state.current?.id] || META.done;
    return { title: state.current?.label || m[0], icon: m[1], question: m[2], hint: m[3] };
  }

  function beginStage() {
    if (state.cursor >= state.queue.length) return finish();
    state.current = state.queue[state.cursor];
    state.options = resolveOptions(state.current);
    const meta = currentMeta();
    stageTitle.textContent = meta.title;
    stageIcon.textContent = meta.icon;
    stageQuestion.textContent = meta.question;
    stageHint.textContent = `${meta.hint} • ${state.options.length} opções`;
    resultText.textContent = 'Toque em GIRAR';
    stepLabel.textContent = `Etapa ${state.cursor + 1} de ${state.queue.length}`;
    progressFill.style.width = `${Math.max(2, (state.cursor / Math.max(1, state.queue.length)) * 100)}%`;
    spinBtn.disabled = false;
    spinBtn.textContent = 'GIRAR';
    drawWheel();
    renderOptions();
  }

  function finish() {
    state.current = null;
    state.options = [];
    const m = META.done;
    stageTitle.textContent = m[0];
    stageIcon.textContent = m[1];
    stageQuestion.textContent = m[2];
    stageHint.textContent = m[3];
    resultText.textContent = state.sheet.title || 'PERSONAGEM CONCLUÍDO';
    stepLabel.textContent = `Concluído • ${state.results.length} resultados`;
    progressFill.style.width = '100%';
    spinBtn.disabled = true;
    spinBtn.textContent = 'CONCLUÍDO';
    drawFinished();
    renderSheet();
  }

  function drawFinished() {
    const { width, height } = canvas;
    ctx.clearRect(0,0,width,height);
    const g = ctx.createRadialGradient(width/2,height/2,20,width/2,height/2,width/2);
    g.addColorStop(0,'#262a36'); g.addColorStop(1,'#080a10');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(width/2,height/2,width*0.47,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '700 62px system-ui';
    ctx.fillText('FICHA',width/2,height/2-26);
    ctx.font = '500 28px system-ui'; ctx.fillStyle = '#aab2c8';
    ctx.fillText(`${state.results.length} resultados`,width/2,height/2+44);
  }

  function drawWheel() {
    const opts = state.options;
    const n = Math.max(1, opts.length);
    const w = canvas.width, h = canvas.height, cx = w/2, cy = h/2, radius = Math.min(w,h)*0.46;
    ctx.clearRect(0,0,w,h);
    ctx.save(); ctx.translate(cx,cy); ctx.rotate(state.angle);
    for (let i=0;i<n;i++) {
      const start = (i/n)*Math.PI*2 - Math.PI/2;
      const end = ((i+1)/n)*Math.PI*2 - Math.PI/2;
      ctx.beginPath(); ctx.moveTo(0,0); ctx.arc(0,0,radius,start,end); ctx.closePath();
      const colors = n > 45 ? palette : darkPalette;
      ctx.fillStyle = colors[i % colors.length]; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.10)'; ctx.lineWidth = n > 80 ? 1 : 2; ctx.stroke();
      if (n <= 160) {
        const mid = (start+end)/2;
        ctx.save(); ctx.rotate(mid); ctx.translate(radius*0.68,0); ctx.rotate(Math.PI/2);
        const label = String(opts[i]);
        const fontSize = n > 100 ? 12 : n > 60 ? 15 : n > 35 ? 19 : n > 18 ? 24 : 31;
        ctx.font = `600 ${fontSize}px system-ui`; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const max = n > 60 ? 18 : 24;
        ctx.fillText(label.length > max ? `${label.slice(0,max-1)}…` : label,0,0);
        ctx.restore();
      }
    }
    ctx.restore();
    ctx.beginPath(); ctx.arc(cx,cy,radius*0.25,0,Math.PI*2); ctx.fillStyle = '#151820'; ctx.fill();
    ctx.beginPath(); ctx.arc(cx,cy,radius*0.11,0,Math.PI*2); ctx.fillStyle = '#303541'; ctx.fill();
    ctx.beginPath(); ctx.arc(cx,cy,radius*0.075,0,Math.PI*2); ctx.fillStyle = '#14171d'; ctx.fill();
  }

  function spin() {
    if (state.spinning || !state.current || !state.options.length) return;
    state.spinning = true; spinBtn.disabled = true; resultText.textContent = 'Girando…';
    const n = state.options.length;
    const targetIndex = Math.floor(Math.random()*n);
    const slice = Math.PI*2/n;
    const targetAngle = -(targetIndex*slice + slice/2);
    const startAngle = state.angle;
    const turns = 6 + Math.floor(Math.random()*5);
    const rawEnd = targetAngle - turns*Math.PI*2;
    const duration = 3000 + Math.random()*1200;
    const startTime = performance.now();
    const ease = t => 1 - Math.pow(1-t,4);
    function frame(now) {
      const t = Math.min(1,(now-startTime)/duration);
      state.angle = startAngle + (rawEnd-startAngle)*ease(t);
      drawWheel();
      if (t < 1) return requestAnimationFrame(frame);
      state.angle = targetAngle; drawWheel(); state.spinning = false; spinBtn.disabled = false;
      acceptResult(state.options[targetIndex]);
    }
    requestAnimationFrame(frame);
  }

  function storeResult(stageObj, value) {
    const meta = currentMeta();
    const key = stageObj.key || stageObj.id;
    state.sheet[key] = value;
    state.results.push({ id: stageObj.id, key, label: meta.title, value });
    renderPath(); renderSheet();
  }

  function acceptResult(value) {
    const stageObj = state.current;
    resultText.textContent = value;
    storeResult(stageObj, value);
    if (typeof stageObj.after === 'function') stageObj.after(value);
    spinBtn.textContent = 'PRÓXIMA';
    spinBtn.onclick = nextStage;
  }

  function nextStage() {
    spinBtn.onclick = spin;
    state.cursor += 1;
    beginStage();
  }

  function renderPath() {
    pathCount.textContent = String(state.results.length);
    if (!state.results.length) { pathList.innerHTML = '<span class="empty">Nada rolado ainda.</span>'; return; }
    pathList.innerHTML = state.results.slice().reverse().map(item => `
      <div class="path-chip"><b>${escapeHtml(item.label)}</b><span>${escapeHtml(String(item.value))}</span></div>
    `).join('');
  }

  function renderSheet() {
    if (!state.results.length) { sheetContent.innerHTML = '<p class="empty">Gire a primeira roleta para começar.</p>'; return; }
    sheetContent.innerHTML = state.results.map(item => `
      <div class="sheet-row"><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(String(item.value))}</strong></div>
    `).join('');
  }

  function renderOptions(filter='') {
    if (!state.current) { optionsTitle.textContent = 'Sem etapa ativa'; optionsGrid.innerHTML = ''; return; }
    optionsTitle.textContent = `${currentMeta().title} • ${state.options.length}`;
    const q = filter.trim().toLocaleLowerCase('pt-BR');
    const visible = state.options.filter(x => String(x).toLocaleLowerCase('pt-BR').includes(q));
    optionsGrid.innerHTML = visible.map(x => `<div class="option-item">${escapeHtml(String(x))}</div>`).join('');
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }

  function openPanel(panel) { panel.classList.remove('hidden'); panel.setAttribute('aria-hidden','false'); }
  function closePanel(panel) { panel.classList.add('hidden'); panel.setAttribute('aria-hidden','true'); }
  function showToast(message) {
    toast.textContent = message; toast.classList.add('show'); clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove('show'), 1800);
  }
  function sheetText() {
    const title = state.sheet.title ? `— ${state.sheet.title} —\n` : '';
    return `${title}${state.results.map(r => `${r.label}: ${r.value}`).join('\n')}`;
  }
  async function copySheet() {
    try { await navigator.clipboard.writeText(sheetText()); showToast('Ficha copiada.'); }
    catch { showToast('Não foi possível copiar automaticamente.'); }
  }

  function resetAll() {
    if (state.spinning) return;
    state.queue = initialQueue(); state.cursor = 0; state.current = null; state.options = []; state.angle = 0;
    state.results = []; state.sheet = {}; state.powerCount = 0; state.powerIndex = 0; state.enchantCount = 0; state.enchantIndex = 0;
    state.usedPowers = new Set(); state.usedEnchants = new Set(); spinBtn.onclick = spin;
    renderPath(); renderSheet(); beginStage(); showToast('Roleta reiniciada.');
  }

  spinBtn.onclick = spin;
  resetBtn.addEventListener('click', resetAll);
  optionsBtn.addEventListener('click', () => openPanel(optionsPanel));
  sheetBtn.addEventListener('click', () => { renderSheet(); openPanel(sheetPanel); });
  copyBtn.addEventListener('click', copySheet);
  optionSearch.addEventListener('input', e => renderOptions(e.target.value));
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.close === 'options') closePanel(optionsPanel);
      if (btn.dataset.close === 'sheet') closePanel(sheetPanel);
    });
  });
  [optionsPanel,sheetPanel].forEach(panel => panel.addEventListener('click', e => { if (e.target === panel) closePanel(panel); }));

  resetAll();
})();