'use strict';

/* ---------- Delegar tarefa em texto: a IA monta o plano e a equipe executa ---------- */

let askBusy = false, sampleFn; const samplePromise = (window.claude?.use ? window.claude.use('sample').catch(() => null) : Promise.resolve(null)).then(f => (sampleFn = f));
const askSt = (html, err) => { const el = $('#ask-st'); el.innerHTML = html; el.classList.toggle('err', !!err); };
function teamBrief() {
  return sim.agents.map(a => ({ nome: nameOf(a), papel: a.role, tipo: kindOf(a.role), estado: a.status, tarefa: a.task || null }));
}
function buildPrompt(text) {
  const states = Object.entries(RULES).map(([k, r]) => `- ${k}: ${r.n}. ${r.does}`).join('\n');
  const roles = Object.entries(ROLES).map(([k, r]) => `- ${k}: ${r.n} (tipo ${r.kind}: ${KINDS[r.kind].does})`).join('\n');
  return `Você coordena um escritório de agentes de IA mostrado como uma simulação visual. O usuário escreveu uma tarefa. Divida a tarefa em passos e diga qual agente faz o quê, em que estado e quando.

TAREFA DO USUÁRIO:
<<<${text}>>>

EQUIPE ATUAL (JSON):
${JSON.stringify(teamBrief())}

PAPÉIS POSSÍVEIS:
${roles}

ESTADOS POSSÍVEIS (use exatamente a chave):
${states}

REGRAS:
- Prefira agentes da equipe cujo papel combina com o passo. Um papel novo precisa de "nome_papel" e "tipo" (coordena, produz, revisa, pesquisa ou entrega). Só crie agente novo ("novos") se nenhum papel necessário existir na equipe; no máximo 2 novos, com nome brasileiro curto que não repita os atuais.
- "t" é o segundo, contado a partir de agora, em que o passo começa (0 a 150). Passos de um mesmo agente não se sobrepõem; deixe de 8 a 25 s entre eles.
- "com" lista nomes de outros agentes envolvidos (obrigatório em reuniao; em revisando, o autor do trabalho).
- Use bloqueado só se a tarefa sugerir risco real. Termine o trabalho de cada agente envolvido com "concluido".
- "tarefa" é um rótulo curto em português (até 40 caracteres).
- Entre 3 e 12 passos.

Responda SOMENTE com JSON neste formato:
{"resumo":"uma frase sobre o plano","novos":[{"nome":"...","papel":"${defaultRole()}","nome_papel":"(só se o papel for novo)","tipo":"produz"}],"passos":[{"t":0,"agente":"Nome","estado":"planejando","tarefa":"...","com":[]}]}`;
}
// sem IA disponível: plano simples por palavras-chave, para o protótipo funcionar fora do claude.ai
function localPlan(text) {
  const T = text.toLowerCase(), has = (...w) => w.some(x => T.includes(x));
  const byKind = k => sim.agents.find(a => kindOf(a.role) === k);
  const pick = (...ks) => { for (const k of ks) { const a = byKind(k); if (a) return nameOf(a); } return sim.agents[0] ? nameOf(sim.agents[0]) : null; };
  const label = text.length > 38 ? text.slice(0, 37) + '…' : text;
  const research = has('pesquis', 'estudo', 'compar', 'analis'), lead = pick('coordena', 'produz'), maker = research ? pick('pesquisa', 'produz') : pick('produz'), rev = pick('revisa', 'coordena');
  const st = research ? 'pesquisando' : 'trabalhando';
  const P = [{ t: 0, agente: lead, estado: 'planejando', tarefa: label, com: maker !== lead ? [maker] : [] }];
  if (maker !== lead) P.push({ t: 0, agente: maker, estado: 'planejando', tarefa: label, com: [lead] });
  P.push({ t: 12, agente: maker, estado: st, tarefa: label });
  if (rev && rev !== maker) { P.push({ t: 40, agente: maker, estado: 'aguardando', tarefa: 'Revisão: ' + label }); P.push({ t: 40, agente: rev, estado: 'revisando', tarefa: label, com: [maker] }); P.push({ t: 58, agente: rev, estado: 'concluido', tarefa: 'Revisão aprovada' }); }
  if (has('deploy', 'publicar', 'publica', 'subir', 'no ar', 'lançar', 'enviar', 'entregar')) { const ops = pick('entrega', 'produz'); P.push({ t: 62, agente: ops, estado: 'entregando', tarefa: label }); P.push({ t: 78, agente: ops, estado: 'concluido', tarefa: 'No ar' }); }
  P.push({ t: 64, agente: maker, estado: 'concluido', tarefa: label });
  return { resumo: 'Plano automático simples (sem IA): planejar, executar, revisar' + (P.some(x => x.estado === 'entregando') ? ' e entregar.' : '.'), novos: [], passos: P };
}
function addAgentLive(nome, papel) {
  if (!nome || agentByRef(nome)) return agentByRef(nome);
  const b = bounds(), id = nid('p'), pos = freeSpotNear((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2);
  const p = { id, name: String(nome).slice(0, 14), ...randomLook(), role: ROLES[papel] ? papel : defaultRole(), pos };
  W.people.push(p); try { save(); } catch (e) {}
  const a = makeAgent(p); sim.agents.push(a); teamHTML = '';
  logFeed({ name: p.name, st: null, text: `Entrou na equipe como ${ROLES[p.role].n.toLowerCase()} para esta tarefa` });
  return a;
}
function startMission(text, plan, engine) {
  const m = { id: 'm' + Date.now(), text, resumo: String(plan.resumo || ''), engine, start: sim.clock, steps: [] };
  for (const n of (plan.novos || []).slice(0, 2)) addAgentLive(n.nome, ROLES[n.papel] ? n.papel : ensureRole(n.papel, n.nome_papel, n.tipo));
  for (const x of (plan.passos || []).slice(0, 14)) {
    const a = agentByRef(x.agente); if (!a) continue;
    const st = normState(x.estado); if (!st) continue;
    m.steps.push({ t: Math.max(0, Math.min(180, Number(x.t) || 0)), agent: a.id, st, task: String(x.tarefa || '').slice(0, 60), with: (x.com || []).filter(w => agentByRef(w)), done: false });
  }
  m.steps.sort((p, q) => p.t - q.t);
  if (!m.steps.length) throw { code: 'empty' };
  // tarefas delegadas assumem a sala: a demo e o arquivo param de mandar eventos
  if (sim.source === 'demo' || sim.source === 'arquivo') { sim.source = 'manual'; $('#pl-source').value = 'manual'; }
  for (const id of new Set(m.steps.map(x => x.agent))) { const a = sim.agents.find(q => q.id === id); if (a) { a.pinned = false; (a.missions ||= []).unshift(m.id); } }
  MISSIONS.unshift(m); sim.playing = true; updatePlayer();
  logFeed({ name: 'Você', st: null, text: `Nova tarefa: ${text}` });
  missionTick();
  return m;
}
function missionTick() {
  for (const m of MISSIONS) for (const x of m.steps) {
    if (x.done || sim.clock - m.start < x.t) continue;
    x.done = true; const a = sim.agents.find(q => q.id === x.agent); if (!a) continue;
    applyEvent({ agent: a.id, state: x.st, task: x.task, with: x.with, source: m.engine === 'ia' ? 'ia' : 'plano' });
  }
}
function syncAgent(nome, papel) {
  const a = agentByRef(nome);
  if (!a) return addAgentLive(nome, papel);
  if (ROLES[papel] && a.role !== papel) { a.role = papel; const p = personOf(a); if (p) { p.role = papel; try { save(); } catch (e) {} } teamHTML = ''; }
  return a;
}
function bridgeTask(m) {
  let ms = MISSIONS.find(q => q.id === m.id);
  if (!ms) { ms = { id: String(m.id || 'run' + Date.now()), text: String(m.text || ''), resumo: '', engine: 'real', start: sim.clock, steps: [] }; MISSIONS.unshift(ms); }
  ms.status = m.status; if (m.output) ms.output = String(m.output); if (m.error) ms.error = String(m.error);
  if (m.folder) ms.folder = String(m.folder);
  const L = { na_fila: 'Na fila', em_andamento: 'Em andamento', concluida: 'Concluída', erro: 'Erro', cancelada: 'Cancelada' };
  if (m.status === 'na_fila' || m.status === 'em_andamento') logFeed({ name: 'Você', st: null, text: `${L[m.status]}: ${ms.text}` });
  if (m.status === 'concluida') logFeed({ name: 'Equipe', st: null, text: `Tarefa concluída: ${ms.text}` });
  if (m.status === 'erro') logFeed({ name: 'Equipe', st: null, text: `Falhou: ${ms.error || 'erro desconhecido'}` });
  if (m.status === 'cancelada') logFeed({ name: 'Você', st: null, text: `Cancelada: ${ms.text}` });
  const running = m.status === 'na_fila' || m.status === 'em_andamento';
  ms.fix = m.fix; if (!running) ms.now = null;
  renderAsk(ms);
  if (m.status === 'concluida' && ms.results?.length) openResult(ms.id);
  if (m.status === 'concluida' || m.status === 'erro') refreshSettings();
  if (!running) lastTaskEnd = Date.now();
  sim.playing = true; updatePlayer(); fichaHTML = '';
}
// linha de status embaixo do campo: situação da tarefa e, enquanto roda, quem está fazendo o quê
function renderAsk(ms) {
  const L = { na_fila: 'Na fila', em_andamento: 'Em andamento', concluida: 'Concluída', erro: 'Erro', cancelada: 'Cancelada' };
  const running = ms.status === 'na_fila' || ms.status === 'em_andamento';
  askSt(`<span><b>${L[ms.status] || ms.status}:</b> ${escapeHTML(ms.text)}${ms.status === 'erro' ? ' · ' + escapeHTML(ms.error || '') : ''}${running && ms.now ? `<br><span class="now">${escapeHTML(ms.now)}</span>` : ''}</span>`
    + (running ? `<button type="button" data-ask="cancel">Cancelar</button>` : '')
    + (ms.status === 'concluida' ? `<button type="button" class="primary" data-ask="open">Ver resultado</button>` : '')
    + (ms.fix === 'ai' ? `<button type="button" class="primary" data-ask="ai">Trocar a IA</button>` : '')
    + `<span class="eng">${sim.bridge?.demo ? 'demo, sem IA' : 'agentes · ' + aiLabel()}</span>`, ms.status === 'erro');
  $('#ask-st').querySelector('[data-ask="cancel"]')?.addEventListener('click', () => { socket?.readyState === 1 && socket.send(JSON.stringify({ type: 'cancel', id: ms.id })); askSt('<b>Cancelando…</b>'); });
  $('#ask-st').querySelector('[data-ask="open"]')?.addEventListener('click', () => openResult(ms.id));
  $('#ask-st').querySelector('[data-ask="ai"]')?.addEventListener('click', () => openSetup(true, ms.error));
}
// entrega de uma pessoa: guarda na missão, avisa no feed e no histórico dela
function missionResult(m) {
  const ms = MISSIONS.find(q => q.id === m.run); if (!ms) return;
  const item = { agent: String(m.agent || ''), action: String(m.action || ''), title: String(m.title || 'Entrega'), text: String(m.text || '') };
  (ms.results ||= []).push(item);
  const a = agentByRef(item.agent);
  logFeed({ name: a ? nameOf(a) : item.agent, st: null, text: `Entregou: ${item.title.split(' · ')[0]}` });
  if (a) { histPush(a, { text: `Entregou: ${item.title}`, src: 'result' }); if (!(a.missions ||= []).includes(ms.id)) a.missions.unshift(ms.id); }
  fichaHTML = '';
}
function missionAddStep(ev) {
  const ms = MISSIONS.find(q => q.id === ev.run), a = agentByRef(ev.agent); if (!ms || !a) return;
  const st = normState(ev.state); if (!st) return;
  ms.steps.push({ t: sim.clock - ms.start, agent: a.id, st, task: String(ev.task || '').slice(0, 60), with: (ev.with || []).filter(w => agentByRef(w)), done: true });
  // "Marina está trabalhando · Ilha com 4 estações" na linha de status
  if (ms.status === 'em_andamento' && !['concluido', 'ocioso', 'aguardando'].includes(st)) {
    const where = a.spot ? ' · ' + objName(a.spot) : '';
    ms.now = `${nameOf(a)}: ${RULES[st].n.toLowerCase()}${st === 'reuniao' && ev.with?.length ? ' com ' + ev.with.join(', ') : where}`;
    renderAsk(ms);
  }
  if (!(a.missions ||= []).includes(ms.id)) a.missions.unshift(ms.id);
}
function missionHTML(a) {
  const m = MISSIONS.find(q => (a.missions || []).includes(q.id)); if (!m) return '';
  const mine = m.steps.filter(x => x.agent === a.id).slice(-10), cur = [...mine].reverse().find(x => x.done);
  const head = m.engine === 'real' ? `(${sim.bridge?.demo ? 'demo, sem IA' : 'agentes · ' + aiLabel()} · ${({ na_fila: 'na fila', em_andamento: 'em andamento', concluida: 'concluída', erro: 'erro' })[m.status] || ''})` : m.engine === 'ia' ? '(planejada pela IA)' : '(plano automático)';
  const out = m.engine === 'real' && m.error ? `<p class="f-out">${escapeHTML(m.error.slice(0, 600))}</p>` : '';
  const mineRes = (m.results || []).filter(r => agentByRef(r.agent) === a);
  const resHTML = mineRes.map(r => `<details open><summary>${escapeHTML(r.title)}</summary><div class="md">${md(r.text.slice(0, 6000))}</div></details>`).join('');
  return `<section class="f-mis"><h4>${m.engine === 'real' ? `Tarefa ${({ na_fila: 'na fila', em_andamento: 'em andamento', concluida: 'concluída', erro: 'com erro', cancelada: 'cancelada' })[m.status] || ''}` : `Missão ${head}`}</h4><q>${escapeHTML(m.text)}</q>${out}${resHTML}
    <ol class="f-dev">${mine.map(x => `<li class="${x === cur ? 'now' : x.done ? 'done' : ''}"><i class="chip" style="background:${RULES[x.st].c}">${RULES[x.st].n}</i><span>${escapeHTML(x.task)}${x.with.length ? ' · com ' + x.with.map(w => escapeHTML(nameOf(agentByRef(w)))).join(', ') : ''}</span>${x.done ? '' : `<small>em ${fmtDur(Math.max(0, m.start + x.t - sim.clock))}</small>`}</li>`).join('')}</ol></section>`;
}
const SAMPLE_ERR = { not_granted: 'Você não autorizou o uso do Claude nesta página. Usei o plano automático.', rate_limited: 'Muitos pedidos seguidos. Espere um pouco e tente de novo.', cancelled: 'Pedido cancelado.' };
$('#ask-form').addEventListener('submit', async (e) => {
  e.preventDefault(); if (askBusy) return;
  const text = $('#ask-in').value.trim(); if (!text) return;
  if (!sim.agents.length) { askSt('Adicione pelo menos uma pessoa no modo Construir.', true); return; }
  if (socket && socket.readyState === 1 && sim.source === 'tempo_real') {
    const id = 'run-' + Date.now().toString(36);
    socket.send(JSON.stringify({ type: 'task', id, text }));
    bridgeTask({ id, text, status: 'na_fila' }); $('#ask-in').value = ''; return;
  }
  askBusy = true; $('#ask-go').disabled = true;
  let plan = null, engine = 'local', note = '';
  try {
    const sample = sampleFn !== undefined ? sampleFn : await Promise.race([samplePromise, new Promise(r => setTimeout(() => r(null), 1500))]);
    if (sample) {
      askSt('<b>Pensando…</b> a IA está montando o plano da equipe');
      try { plan = await sample.json(buildPrompt(text), { modelTier: 'quick', cache: false }); engine = 'ia'; }
      catch (err) { if (err?.code === 'rate_limited') { askSt(SAMPLE_ERR.rate_limited, true); return; } note = SAMPLE_ERR[err?.code] || 'A IA não respondeu direito. Usei o plano automático.'; }
    } else note = 'IA indisponível aqui (abra pelo link do claude.ai). Usei o plano automático.';
    if (!plan) plan = localPlan(text);
    let m; try { m = startMission(text, plan, engine); } catch (err) { if (engine !== 'ia') throw err; m = startMission(text, localPlan(text), 'local'); note = 'O plano da IA veio sem passos válidos. Usei o plano automático.'; }
    const who = [...new Set(m.steps.map(x => nameOf(sim.agents.find(a => a.id === x.agent))))];
    askSt(`<span><b>${escapeHTML(m.resumo || 'Plano pronto.')}</b> ${who.map(escapeHTML).join(', ')} · ${m.steps.length} passos. Clique num personagem para ver a ficha.</span><span class="eng">${engine === 'ia' ? 'IA' : 'sem IA'}</span>` + (note ? `<span class="eng">${escapeHTML(note)}</span>` : ''), false);
    $('#ask-in').value = '';
  } catch (err) { askSt('Não consegui montar um plano para essa tarefa. Tente descrever de outro jeito.', true); }
  finally { askBusy = false; $('#ask-go').disabled = false; }
});
