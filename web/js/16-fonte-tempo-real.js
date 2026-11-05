'use strict';

/* ---------- Fonte: tempo real (WebSocket, postMessage ou window.floorwalk.emit) ---------- */
let socket = null;
function connectWS(url) {
  try { socket?.close(); } catch {}
  try {
    socket = new WebSocket(url);
    socket.onopen = () => { toast('Conectado. Aguardando eventos.'); sim.wsState = 'conectado'; renderSourceBox(); };
    socket.onmessage = (m) => { let d; try { d = JSON.parse(m.data); } catch { logFeed({ name: 'Conexão', st: null, text: 'Mensagem ignorada: não é um evento JSON válido.' }); return; } onBridgeMsg(d); };
    socket.onerror = () => { sim.wsState = 'erro'; renderSourceBox(); };
    socket.onclose = () => { if (sim.wsState !== 'erro') sim.wsState = 'desconectado'; renderSourceBox(); if (window.FLOORWALK_BRIDGE && sim.source === 'tempo_real') setTimeout(() => { if (!socket || socket.readyState > 1) connectWS(url); }, 2500); };
    sim.wsState = 'conectando'; renderSourceBox();
  } catch { sim.wsState = 'erro'; renderSourceBox(); }
}
// sessão de fora que terminou: sai pela porta e some da equipe (a sessão não existe mais).
// A saída é daqui, e não da "sala quieta" (27-entregas-menu.js), que para no modo desenvolvedor e durante tarefas da equipe de IA
setInterval(() => {
  for (const a of sim.agents) if (a.ext && a.gone && a.present !== false && mode === 'live') {
    if (!sim.playing) { a.present = false; continue; } // animação parada: ninguém andaria até a porta
    if (a.leaving) { const e = entrance(); if (!WALKING.has(a.mv) || (e && Math.hypot(a.x - e.pt[0], a.z - e.pt[1]) < .9)) { a.present = false; a.leaving = false; a.path = []; } }
    else if (!a.held) leaveOffice(a);
  }
  for (const a of [...sim.agents]) if (a.ext && a.gone && (a.present === false || mode !== 'live')) {
    if (sim.inspect === a.id) closeFicha();
    if (sim.following === a.id) sim.following = null;
    try { release(a); } catch {}
    sim.agents.splice(sim.agents.indexOf(a), 1);
    const i = W.people.findIndex(p => p.id === a.id); if (i >= 0) W.people.splice(i, 1);
    teamHTML = ''; if (typeof drawerMode !== 'undefined' && drawerMode === 'team') renderDrawer();
  }
}, 1500);
// sessões de fora (Claude Code) que chegaram enquanto a sala estava em edição: entram quando ela volta ao escritório
const extWaiting = { team: new Map(), state: new Map() };
function flushExtWaiting() {
  if (mode !== 'live' || !extWaiting.team.size) return;
  const agents = [...extWaiting.team.values()], states = [...extWaiting.state.values()];
  extWaiting.team.clear(); extWaiting.state.clear();
  onBridgeMsg({ type: 'team', agents }); states.forEach(onBridgeMsg);
}
/* Protocolo Floorwalk v1: mensagens com "type" (hello, team, state, log, task). Evento sem "type" = state (compatível com o formato antigo). */
function onBridgeMsg(m) {
  if (Array.isArray(m)) { m.forEach(onBridgeMsg); return; }
  if (!m || typeof m !== 'object') return;
  const t = m.type || 'state';
  if (t === 'hello') { sim.bridge = m; logFeed({ name: 'Conexão', st: null, text: `Ponte conectada: ${m.server || 'servidor'} (protocolo ${m.protocol ?? '?'})` }); return; }
  if (t === 'team') {
    // equipe de IA desligada: a equipe do negócio que o servidor guarda não entra na sala (nem fica salva nela); só as sessões de fora
    if (!m.source && !(typeof aiTeamOn === 'function' ? aiTeamOn() : true) && !sim.bridge?.demo) return;
    // fora do escritório (editando a sala): guarda quem é de fora para pôr na sala ao voltar
    if (mode !== 'live') {
      if (m.source) for (const [k, x] of extWaiting.team) if (x.source === m.source && !(m.agents || []).some(y => String(y.name).toLowerCase() === k)) { extWaiting.team.delete(k); extWaiting.state.delete(k); }
      for (const x of m.agents || []) if (x.source) extWaiting.team.set(String(x.name).toLowerCase(), x);
      return;
    }
    // lista completa de uma origem (ex.: todas as sessões do Claude Code abertas): quem não está nela terminou
    if (m.source) for (const a of sim.agents) if (a.ext === m.source && !(m.agents || []).some(y => String(y.name).toLowerCase() === nameOf(a).toLowerCase())) a.gone = true;
    for (const x of m.agents || []) {
      const a = syncAgent(x.name, ensureRole(x.role, x.roleName, x.kind));
      // agente de fora (ex.: sessão do Claude Code): fica na sala enquanto a sessão existir e não é salvo no escritório
      if (a && x.source) { a.gone = false; a.ext = String(x.source); const p = personOf(a); if (p && !p.ext) { p.ext = a.ext; try { save(); } catch {} } }
    }
    return;
  }
  if (t === 'task') { bridgeTask(m); return; }
  if (t === 'result') { missionResult(m); return; }
  if (t === 'log') { const a = agentByRef(m.agent); logFeed({ name: a ? nameOf(a) : String(m.agent || 'Sistema'), st: null, text: String(m.text || '') }); if (a) histPush(a, { text: String(m.text || ''), src: 'log' }); return; }
  if (t === 'state' && mode !== 'live' && extWaiting.team.has(String(m.agent).toLowerCase())) { extWaiting.state.set(String(m.agent).toLowerCase(), m); return; }
  if (t === 'state') { applyEvent(m); if (m.run) missionAddStep(m); if (agentByRef(m.agent)?.ext && !sim.playing) { sim.playing = true; updatePlayer(); } }
}
// d.pixelHQ / window.pixelHQ: nome antigo do projeto, continua aceito
window.addEventListener('message', (e) => { const d = e.data; if (d && typeof d === 'object' && (d.floorwalk || d.pixelHQ)) onBridgeMsg(d.floorwalk || d.pixelHQ); });
window.floorwalk = { emit: (ev) => onBridgeMsg(ev), states: Object.keys(RULES), agents: () => sim.agents.map(a => ({ name: nameOf(a), role: a.role, state: a.status, task: a.task, decision: a.decision })) };
window.pixelHQ = window.floorwalk; // nome antigo

function simStep(dtReal) {
  if (!NAV) buildNav();
  if (sim.following) {
    const a = sim.agents.find(q => q.id === sim.following);
    if (a) { const A = sceneArea(), [sx, sy] = iso(a.x, a.z, 1); view.cx += ((A.x0 + A.x1) / 2 - sx) * .08; view.cy += ((A.y0 + A.y1) / 2 - sy) * .08; }
  }
  if (sim.playing) {
    const dt = dtReal * sim.speed;
    sim.clock += dt; sim.playedFor += dtReal;
    if (sim.source === 'demo') demoTick(dt);
    if (sim.source === 'arquivo') replayTick(dt);
    missionTick();
    for (const a of sim.agents) { stepAgent(a, dt); a.timeIn ||= {}; a.timeIn[a.status] = (a.timeIn[a.status] || 0) + dt; }
  }
  uiTick += dtReal; if (uiTick > .25) { uiTick = 0; updatePlayer(); renderTeam(); renderFeed(); renderFicha(); }
}
let uiTick = 0;
function peopleDrawables(T) {
  const out = [];
  if (mode === 'build') {
    // construindo a sala, os avatares saem da frente (decisão do dono); só aparecem na aba Pessoas (ou enquanto um é
    // arrastado/editado), onde o dono vê e ajusta a equipe
    if (tab !== 'pessoas' && !editing && drag?.kind !== 'person') return out;
    for (const p of W.people) {
      let at = p.pos, lift = 0;
      if (drag?.kind === 'person' && drag.id === p.id && drag.moved) { at = drag.at; lift = .35; }
      out.push({ x: at[0] - .2, z: at[1] - .2, w: .4, d: .4, y: 0, h: 1.7, person: p, opts: { at, lift, label: tab === 'pessoas' || editing === p.id || lift > 0, hot: editing === p.id, dot: ROLES[p.role]?.c } });
    }
    return out;
  }
  for (const a of sim.agents) {
    if (a.present === false) continue;
    const p = personOf(a); if (!p) continue;
    const sit = a.mv === 'act' && a.spot?.sit > 0, seatY = sit ? a.spot.sit : 0, f = faceOf(a.fx, a.fz), R = RULES[a.status];
    const moving = ['walk', 'approach', 'leave'].includes(a.mv) && sim.playing;
    const frame = moving ? Math.floor(a.walkDist * 4.5) % 4 : 0;
    const typing = sit && a.mv === 'act' && a.status === 'trabalhando';
    const act = typing ? Math.floor(T * 6) % 2 : (sit ? 0 : undefined);
    const icon = a.held ? null : a.pinned ? 'pin' : (a.idleAct && a.mv === 'act') ? ACTS[a.idleAct].icon : R.icon;
    const hop = a.status === 'concluido' && sim.playing ? Math.abs(Math.sin(T * 9)) * .18 : 0;
    out.push({ x: a.x - .2, z: a.z - .2, w: .4, d: .4, y: sit ? seatY : 0, h: 1.4, person: p,
      opts: { at: [a.x, a.z], sit, seatY, back: f.back, mirror: f.mirror, frame, act, icon, t: T, label: sim.names || sim.following === a.id, hot: sim.following === a.id || sim.inspect === a.id, ring: sim.inspect === a.id, lift: a.held ? .35 : hop, dim: R.dim, dot: R.c } });
  }
  return out;
}
function setMode(m) {
  if (m === mode) return;
  mode = m; const live = m === 'live';
  document.querySelectorAll('#modes button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === m)));
  $('#modes').classList.toggle('live', live); document.body.classList.toggle('is-live', live);
  $('.panel').hidden = live; $('#player').hidden = !live; $('#team').hidden = !live; $('#feed').hidden = !live; $('#ask').hidden = !live; $('#srcbox').hidden = true;
  placing = null; walling = null; selected = null; drag = null; tool = 'select'; closePop();
  // no escritório de verdade a equipe fica parada até chegar uma tarefa
  if (live) { startSim(); sim.playing = !quietOffice(); flushExtWaiting(); }
  else { sim.playing = false; sim.agents = []; sim.reserved.clear(); sim.following = null; sim.inspect = null; ficha.hidden = true; renderPanel(); }
  renderBanner(); renderCtx(); updatePlayer(); renderTeam(); renderFeed(); fit(); dirty();
}
document.querySelectorAll('#modes button').forEach(b => b.onclick = () => setMode(b.dataset.mode));
const fmtClock = (s) => { s = Math.floor(s); const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = s % 60; return (h ? h + ':' : '') + String(m).padStart(2, '0') + ':' + String(x).padStart(2, '0'); };
const SOURCES = { demo: 'Projeto demo (simulado)', manual: 'Manual', arquivo: 'Arquivo de eventos', tempo_real: 'Tempo real' };
function updatePlayer() {
  if (mode !== 'live') return;
  $('#pl-clock').textContent = fmtClock(sim.clock);
  const prog = sim.source === 'demo' && demo.a ? `${demo.done}/${demoTasks().length} tarefas entregues` : sim.source === 'arquivo' && sim.replay ? `${sim.replay.i}/${sim.replay.events.length} eventos` : sim.source === 'tempo_real' ? (sim.wsState ? 'Conexão: ' + sim.wsState : 'Sem conexão') : 'Eventos enviados por você';
  $('#pl-phase').textContent = prog;
  const frac = sim.source === 'demo' && demo.a ? demo.done / demoTasks().length : sim.source === 'arquivo' && sim.replay?.events.length ? sim.replay.i / sim.replay.events.length : 0;
  $('#pl-fill').style.width = (frac * 100).toFixed(1) + '%';
  $('#pl-play').innerHTML = sim.playing ? '<svg class="i" viewBox="0 0 20 20"><path d="M7 4.5v11M13 4.5v11"/></svg>Pausar' : '<svg class="i" viewBox="0 0 20 20"><path d="M6 4.5v11l9-5.5z"/></svg>Play';
  document.querySelectorAll('#player [data-speed]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.speed) === sim.speed)));
  $('#pl-names').setAttribute('aria-pressed', String(sim.names));
  $('#pl-source').value = sim.source;
}
$('#pl-play').onclick = () => { sim.playing = !sim.playing; updatePlayer(); };
$('#pl-restart').onclick = () => { startSim(); sim.playing = true; updatePlayer(); renderTeam(); toast(sim.source === 'demo' ? 'Projeto demo recomeçado' : 'Equipe reiniciada'); };
document.querySelectorAll('#player [data-speed]').forEach(b => b.onclick = () => { sim.speed = Number(b.dataset.speed); updatePlayer(); });
$('#pl-names').onclick = () => { sim.names = !sim.names; updatePlayer(); dirty(); };
$('#pl-source').onchange = (e) => { sim.source = e.target.value; startSim(); sim.playing = true; updatePlayer(); renderSourceBox(true); };
$('#pl-send').onclick = () => { const box = $('#srcbox'); if (!box.hidden && box.dataset.kind === 'send') { box.hidden = true; return; } renderSourceBox(true, 'send'); };
/* caixa de controle da fonte: envio manual, arquivo e conexão */
function renderSourceBox(open, force) {
  const box = $('#srcbox'); const kind = force || (sim.source === 'arquivo' ? 'arquivo' : sim.source === 'tempo_real' ? 'tempo_real' : sim.source === 'manual' ? 'send' : null);
  if (!open && box.hidden) return;
  if (!kind) { box.hidden = true; return; }
  box.hidden = false; box.dataset.kind = kind;
  const agentsOpts = sim.agents.map(a => `<option value="${escapeHTML(nameOf(a))}" data-no-i18n>${escapeHTML(nameOf(a))}</option>`).join('');
  if (kind === 'send') {
    box.innerHTML = `<h4>Enviar um evento</h4>
      <div class="frow"><label for="ev-agent">Agente</label><select id="ev-agent">${agentsOpts}</select></div>
      <div class="frow"><label for="ev-state">Estado</label><select id="ev-state">${Object.entries(RULES).map(([k, R]) => `<option value="${k}">${R.n}</option>`).join('')}</select></div>
      <div class="frow"><label for="ev-task">Tarefa</label><input id="ev-task" class="text" placeholder="Ex.: Tela de login"></div>
      <div class="frow"><span class="flabel">Com quem</span><div class="looks" id="ev-with">${sim.agents.map(a => `<button type="button" data-w="${escapeHTML(nameOf(a))}" aria-pressed="false" data-no-i18n>${escapeHTML(nameOf(a))}</button>`).join('')}</div></div>
      <p class="hint" id="ev-why" style="margin:0"></p>
      <div class="row"><button type="button" class="primary" id="ev-go">Enviar</button><button type="button" id="ev-close">Fechar</button></div>`;
    const why = () => { const R = RULES[$('#ev-state').value]; $('#ev-why').textContent = R.does; };
    $('#ev-state').onchange = why; why();
    box.querySelectorAll('[data-w]').forEach(b => b.onclick = () => b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true')));
    $('#ev-go').onclick = () => {
      const ev = { agent: $('#ev-agent').value, state: $('#ev-state').value, task: $('#ev-task').value || undefined, with: [...box.querySelectorAll('[data-w][aria-pressed="true"]')].map(b => b.dataset.w).filter(n => n !== $('#ev-agent').value), source: 'manual' };
      applyEvent(ev); if (!sim.playing) toast('O evento entrou, mas o player está pausado');
    };
    $('#ev-close').onclick = () => { box.hidden = true; };
  } else if (kind === 'arquivo') {
    box.innerHTML = `<h4>Reproduzir um arquivo de eventos</h4>
      <p class="hint" style="margin:0">Um evento JSON por linha, ou uma lista JSON. Use "t" (segundos desde o início) ou "ts" (data e hora) para o ritmo.</p>
      <label class="filebtn" for="ev-file">Escolher arquivo…</label><input type="file" id="ev-file" accept=".json,.jsonl,.txt,application/json">
      <button type="button" id="ev-sample">Carregar exemplo</button>
      <p class="hint" style="margin:0">${sim.replay ? `${sim.replay.events.length} eventos carregados.` : 'Nenhum arquivo carregado.'}</p>`;
    $('#ev-file').onchange = (e) => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = () => { try { const n = loadReplay(r.result); startSim(); sim.playing = true; toast(`${n} eventos carregados`); renderSourceBox(true); } catch { toast('Não consegui ler esse arquivo. Confira se cada linha é um JSON válido.'); } }; r.readAsText(f); };
    $('#ev-sample').onclick = () => { const n = loadReplay(SAMPLE_LOG()); startSim(); sim.playing = true; toast(`Exemplo com ${n} eventos carregado`); renderSourceBox(true); };
  } else {
    box.innerHTML = `<h4>Conectar em tempo real</h4>
      <p class="hint" style="margin:0">Endereço WebSocket que envia eventos JSON. Neste link de visualização a conexão costuma ser bloqueada por segurança. Ela funciona quando a página roda no seu servidor ou dentro do seu painel (via postMessage).</p>
      <div class="frow"><label for="ws-url">Endereço</label><input id="ws-url" class="text" placeholder="wss://seu-servidor/eventos" value="${sim.wsUrl || ''}"></div>
      <div class="row"><button type="button" class="primary" id="ws-go">Conectar</button></div>
      <p class="hint" style="margin:0">Estado: <b>${sim.wsState || 'sem conexão'}</b>${sim.wsState === 'erro' ? '. Verifique o endereço ou rode a página fora deste visualizador.' : ''}</p>`;
    $('#ws-go').onclick = () => { sim.wsUrl = $('#ws-url').value.trim(); if (!/^wss?:\/\//.test(sim.wsUrl)) return toast('O endereço precisa começar com ws:// ou wss://'); connectWS(sim.wsUrl); };
  }
}
function SAMPLE_LOG() {
  const n = sim.agents.map(nameOf), [A, Bn, C, D] = [n[0], n[1] || n[0], n[2] || n[0], n[3] || n[0]];
  const ev = [
    [0, A, 'planejando', 'Sprint 12'], [2, Bn, 'trabalhando', 'Checkout'], [3, C, 'trabalhando', 'Carrinho'], [4, D, 'pesquisando', 'Gateway de pagamento'],
    [14, Bn, 'bloqueado', 'Checkout: teste quebrando'], [24, Bn, 'trabalhando', 'Checkout'], [30, C, 'concluido', 'Carrinho'], [33, C, 'aguardando', 'Revisão do carrinho'],
    [34, D, 'revisando', 'Carrinho', [C]], [46, D, 'revisando', 'Carrinho'], [48, C, 'ocioso'], [52, A, 'reuniao', 'Alinhamento', [Bn, C, D]], [52, Bn, 'reuniao', 'Alinhamento', [A, C, D]],
    [52, C, 'reuniao', 'Alinhamento', [A, Bn, D]], [52, D, 'reuniao', 'Alinhamento', [A, Bn, C]], [64, A, 'entregando', 'Carrinho v1'], [64, Bn, 'trabalhando', 'Checkout'], [64, C, 'ocioso'], [64, D, 'ocioso'], [74, A, 'concluido', 'Carrinho no ar'],
  ];
  return ev.map(([t, agent, state, task, w]) => JSON.stringify({ t, agent, state, task, with: w })).join('\n');
}
let teamHTML = '', feedHTML = '';
function renderTeam() {
  if (mode !== 'live') return;
  const html = sim.agents.map(a => {
    const p = personOf(a); if (!p) return '';
    const R = RULES[a.status], label = a.held ? 'Mudando de lugar' : a.pinned ? 'Fica onde você deixou' : a.decision;
    return `<li><div class="trow"><button type="button" data-follow="${a.id}" aria-pressed="${sim.inspect === a.id}"><img src="${avatar(p, 3)}" alt=""><span><b><span data-no-i18n>${escapeHTML(p.name)}</span> <em style="color:${ROLES[a.role]?.c || '#5C5866'}">${ROLES[a.role]?.n || ''}</em></b>
      <small><i class="chip" style="background:${R.c}">${R.n}</i>${a.task ? ' ' + escapeHTML(a.task) : ''}</small><small class="dec">→ ${escapeHTML(label)}</small></span></button>
      ${a.pinned ? `<button type="button" class="pin" data-unpin="${a.id}">Voltar à rotina</button>` : ''}</div></li>`;
  }).join('') || '<li class="hint">Ninguém na equipe. Adicione pessoas no modo Construir.</li>';
  if (html === teamHTML) return; teamHTML = html;
  const cnt = {}; for (const a of sim.agents) cnt[a.status] = (cnt[a.status] || 0) + 1;
  $('#team-sum').textContent = `${sim.agents.length} agentes · ` + Object.entries(cnt).sort((p, q) => q[1] - p[1]).slice(0, 3).map(([k, n]) => `${n} ${RULES[k].n.toLowerCase()}`).join(', ');
  const ul = $('#team-list'); ul.innerHTML = html;
  ul.querySelectorAll('[data-follow]').forEach(b => b.onclick = () => { if (sim.inspect === b.dataset.follow) closeFicha(); else openFicha(b.dataset.follow); });
  ul.querySelectorAll('[data-unpin]').forEach(b => b.onclick = () => { const a = sim.agents.find(q => q.id === b.dataset.unpin); if (a) { a.pinned = false; const it = decide(a, a.status, {}); setIntent(a, it); } teamHTML = ''; renderTeam(); });
}
function escapeHTML(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
const FEED_SYS = new Set(['Conexão', 'Você', 'Equipe', 'Sistema']);
function renderFeed() {
  if (mode !== 'live') return;
  const e0 = sim.feed[0]; $('#feed-sum').textContent = e0 ? `${e0.name}: ${e0.st ? RULES[e0.st].n : e0.text}` : 'Sem eventos';
  // nome de pessoa ou sessão não passa pela tradução (F4); "Conexão", "Você" e "Equipe" são da página e passam
  const html = sim.feed.slice(0, UI.feed.b ? 60 : 12).map(e => `<li><time>${fmtClock(e.t)}</time><span><b${FEED_SYS.has(e.name) ? '' : ' data-no-i18n'}>${escapeHTML(e.name)}</b>${e.st ? ` <i class="chip" style="background:${RULES[e.st].c}">${RULES[e.st].n}</i>` : ''}${e.task ? ` <span class="task">${escapeHTML(e.task)}</span>` : ''}<small>${e.st ? '→ ' : ''}${escapeHTML(e.text)}</small></span></li>`).join('') || '<li class="hint">Os eventos aparecem aqui, com a decisão tomada para cada um.</li>';
  if (html === feedHTML) return; feedHTML = html; $('#feed-list').innerHTML = html;
}
function hitAgent(sx, sy) {
  const s = spriteScale(view.z);
  for (const a of [...sim.agents].reverse()) {
    if (a.present === false) continue;
    const sit = a.mv === 'act' && a.spot?.sit > 0, [fx, fy] = iso(a.x, a.z, sit ? Math.max(0, a.spot.sit - .46) : 0), h = sit ? 23 : 27;
    if (sx > fx - 6 * s && sx < fx + 6 * s && sy > fy - h * s && sy < fy + 3) return a;
  }
  return null;
}
