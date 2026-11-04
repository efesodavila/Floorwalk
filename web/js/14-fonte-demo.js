'use strict';

/* ---------- Fonte demo: a equipe simula um projeto, decidindo pelo TIPO de papel ----------
   Funciona com qualquer ambiente: usa os tipos (coordena, produz, revisa, pesquisa, entrega),
   não os nomes dos papéis. As tarefas vêm do ambiente (W.demo) ou de uma lista genérica. */
const DEMO_DEFAULT = {
  tasks: ['Proposta para o cliente', 'Planejamento do mês', 'Material de divulgação', 'Relatório de resultados', 'Atendimento de pedidos', 'Revisão de processos', 'Apresentação para a diretoria', 'Pesquisa de satisfação'],
  research: ['Referências do mercado', 'Concorrentes', 'Dúvidas do cliente', 'Normas do setor', 'Boas práticas'],
};
const demoTasks = () => (W.demo?.tasks?.length ? W.demo.tasks : DEMO_DEFAULT.tasks);
const demoResearch = () => (W.demo?.research?.length ? W.demo.research : DEMO_DEFAULT.research);
const demo = { t: 0 };
const rnd = (a, b) => a + Math.random() * (b - a);
function demoReset() {
  Object.assign(demo, { t: 0, a: {}, reviewQ: [], deliverQ: [], fixes: {}, idx: 0, done: 0, nextSync: 75, syncN: 0, finishedAt: null });
  for (const a of sim.agents) demo.a[a.id] = { until: 0, phase: 'new', task: null };
  const ids = sim.agents.map(a => a.id);
  for (const id of ids) demoEmit(id, 'reuniao', 12, { task: 'Início do projeto', with: ids.filter(x => x !== id), group: 'kickoff' }, true);
}
// na demo, quem atende ou opera trabalha como quem produz (pega tarefa, faz, passa para revisão)
const demoKind = (k) => (k === 'atende' || k === 'opera' ? 'produz' : k);
const idsOfKind = (k) => sim.agents.filter(a => demoKind(kindOf(a.role)) === k).map(a => a.id);
const hasKind = (k) => idsOfKind(k).length > 0;
function demoEmit(id, state, dur, extra = {}, noResume) {
  const s = demo.a[id]; if (!s) return;
  const a = sim.agents.find(q => q.id === id), withNames = (extra.with || []).map(w => nameOf(sim.agents.find(q => q.id === w) || {}));
  applyEvent({ agent: nameOf(a), state, task: extra.task, with: withNames, group: extra.group, source: 'demo' });
  s.until = demo.t + dur; if (!noResume) s.last = { state, extra, dur };
}
function release2(prodId) { const s = demo.a[prodId]; if (s) { s.waiting = false; s.until = demo.t; s.resume = null; } }
function demoTick(dt) {
  demo.t += dt;
  if (demo.t >= demo.nextSync && sim.agents.length > 1) {
    demo.nextSync = demo.t + 95; demo.syncN++;
    const ids = sim.agents.map(a => a.id).filter(id => demo.a[id].phase !== 'delivering');
    for (const id of ids) { const s = demo.a[id]; s.resume = s.last ? { ...s.last, dur: s.waiting ? Infinity : Math.max(3, s.until - demo.t) } : null; demoEmit(id, 'reuniao', 11, { task: `Alinhamento ${demo.syncN}`, with: ids.filter(x => x !== id), group: 'sync' + demo.syncN }, true); }
  }
  for (const a of sim.agents) { const s = demo.a[a.id]; if (s && demo.t >= s.until) demoBrain(a.id, s, demoKind(kindOf(a.role))); }
  const total = demoTasks().length;
  if (demo.idx >= total && demo.done >= total && !demo.finishedAt) {
    demo.finishedAt = demo.t; toast('Projeto entregue! Recomeçando em alguns segundos.');
    for (const a of sim.agents) demoEmit(a.id, 'concluido', 8, { task: 'Projeto entregue' }, true);
  }
  if (demo.finishedAt && demo.t - demo.finishedAt > 14) { startSim(); }
}
// sem ninguém de um tipo, outro tipo assume a função
function demoBrain(id, s, kind) {
  if (s.resume) { const r = s.resume; s.resume = null; demoEmit(id, r.state, r.dur, r.extra); return; }
  if (s.waiting) return;
  const lead = idsOfKind('coordena')[0];
  const producers = hasKind('produz') ? 'produz' : 'coordena';
  if (kind === producers || (kind === 'pesquisa' && !hasKind('produz') && !lead)) {
    if (s.phase === 'work') {
      if (Math.random() < .2 && !s.blockedOnce && lead && lead !== id) { s.blockedOnce = true; demoEmit(id, 'bloqueado', 9, { task: `${s.task}: dúvida travando`, with: [lead] }); return; }
      s.blockedOnce = false; s.phase = 'handoff'; demoEmit(id, 'concluido', 3, { task: s.task }); return;
    }
    if (s.phase === 'handoff') {
      if (hasKind('revisa') || (lead && lead !== id)) { demo.reviewQ.push({ prod: id, task: s.task }); s.waiting = true; s.phase = 'new'; demoEmit(id, 'aguardando', Infinity, { task: `Revisão de ${s.task}` }); }
      else { demo.done++; s.phase = 'new'; demoEmit(id, 'ocioso', 3); }
      return;
    }
    if (demo.fixes[id]?.length) { s.task = demo.fixes[id].shift(); s.phase = 'work'; demoEmit(id, 'trabalhando', rnd(10, 15), { task: `Ajustar ${s.task}` }); return; }
    const list = demoTasks();
    if (demo.idx < list.length) { s.task = list[demo.idx++]; s.phase = 'work'; demoEmit(id, 'trabalhando', rnd(18, 28), { task: s.task }); return; }
    if (kind !== 'coordena') { demoEmit(id, 'ocioso', 8); return; }
  }
  if (kind === 'revisa') {
    if (s.reviewing) {
      const c = s.reviewing; s.reviewing = null;
      if (Math.random() < .75) demo.deliverQ.push(c); else (demo.fixes[c.prod] ||= []).push(c.task);
      release2(c.prod);
    }
    if (demo.reviewQ.length) { const c = demo.reviewQ.shift(); s.reviewing = c; demoEmit(id, 'revisando', rnd(9, 13), { task: c.task, with: [c.prod] }); return; }
    demoEmit(id, Math.random() < .5 ? 'ocioso' : 'pesquisando', rnd(6, 10), { task: 'Estudando o material' }); return;
  }
  if (kind === 'entrega' || (kind === 'coordena' && !hasKind('entrega') && demo.deliverQ.length)) {
    if (s.delivering) { s.delivering = null; s.phase = 'new'; demo.done++; demoEmit(id, 'concluido', 3, { task: 'Entregue' }); return; }
    if (demo.deliverQ.length) { const c = demo.deliverQ.shift(); s.delivering = c; s.phase = 'delivering'; demoEmit(id, 'entregando', rnd(7, 11), { task: c.task }); return; }
    if (kind === 'entrega') { demoEmit(id, Math.random() < .5 ? 'ocioso' : 'pesquisando', rnd(7, 12), { task: 'Acompanhando entregas' }); return; }
  }
  if (kind === 'coordena') {
    // sem revisor, quem coordena revisa
    if (!hasKind('revisa') && demo.reviewQ.length) { const c = demo.reviewQ.shift(); release2(c.prod); demo.deliverQ.push(c); demoEmit(id, 'revisando', 8, { task: c.task, with: [c.prod] }); return; }
    const step = (s.cycle = ((s.cycle || 0) + 1) % 3);
    const busy = sim.agents.filter(a => a.id !== id && demo.a[a.id]?.phase === 'work');
    if (step === 1) { demoEmit(id, 'planejando', rnd(10, 14), { task: 'Organizar prioridades' }); return; }
    if (step === 2 && busy.length) { const d = busy[Math.floor(Math.random() * busy.length)]; demoEmit(id, 'revisando', 8, { task: `Acompanhar ${demo.a[d.id].task}`, with: [d.id] }); return; }
    demoEmit(id, 'ocioso', rnd(5, 8)); return;
  }
  if (kind === 'pesquisa') {
    const R = demoResearch();
    if (s.phase !== 'research') { s.phase = 'research'; demoEmit(id, 'pesquisando', rnd(15, 22), { task: R[Math.floor(Math.random() * R.length)] }); return; }
    s.phase = 'new'; demoEmit(id, Math.random() < .5 ? 'planejando' : 'concluido', rnd(4, 7), { task: 'Resumo da pesquisa' }); return;
  }
  demoEmit(id, 'ocioso', 8);
}
