'use strict';

/* ---------- Agentes: estado vindo de eventos → decisão de elemento → movimento ---------- */
function makeAgent(p) {
  let x = p.pos[0], z = p.pos[1];
  if (!freePoint(x, z, NAV.sol)) { const c = nearestCell(x, z, 12); if (c) [x, z] = cellC(c[0], c[1]); }
  // present: no escritório de verdade a pessoa só aparece quando entra numa tarefa
  return { id: p.id, present: !quietOffice(), role: p.role || defaultRole(), x, z, mv: 'idle', t: .5 + Math.random() * 2, path: [], spot: null, stand: null, fx: .7, fz: .7, walkDist: 0,
    status: 'ocioso', task: '', decision: 'Livre, circulando pela sala', intent: { kind: 'idle' }, idleAct: null, pending: false, home: null, pinned: false, held: false, since: 0 };
}
function startSim() {
  buildNav(); sim.reserved.clear(); sim.groups = new Map(); sim.feed = []; sim.clock = 0;
  sim.agents = W.people.map(makeAgent); feedHTML = ''; teamHTML = ''; MISSIONS.length = 0;
  if (sim.source === 'demo') demoReset();
  if (sim.source === 'arquivo' && sim.replay) sim.replay.i = 0, sim.replay.t = 0;
}
function release(a) { if (a.spot && sim.reserved.get(a.spot.id) === a.id) sim.reserved.delete(a.spot.id); }
function planTo(a, cell) {
  const s = nearestCell(a.x, a.z, 6); if (!s) return false;
  const p = findPath(s[0], s[1], cell[0], cell[1]); if (!p) return false;
  a.path = smooth([[a.x, a.z], ...p]).slice(1); return true;
}
const personOf = a => W.people.find(p => p.id === a.id);
const nameOf = a => personOf(a)?.name || '?';
const objName = sp => { const o = objById(sp.id.split('#')[0]); return o ? ITEMS[o.item].n : 'elemento'; };
function agentByRef(ref) {
  if (!ref) return null; const r = String(ref).toLowerCase();
  return sim.agents.find(a => a.id.toLowerCase() === r || nameOf(a).toLowerCase() === r) || null;
}
function posOf(a) { return a.mv === 'act' && a.spot ? [a.spot.x, a.spot.z] : [a.x, a.z]; }
// ponto livre ao lado de outra pessoa, alcançável, o mais perto de quem está indo
function nearPoint(target, from) {
  const [tx, tz] = posOf(target); let best = null, bd = Infinity;
  for (const r of [.9, 1.2, 1.6]) {
    for (let k = 0; k < 12; k++) {
      const ang = k / 12 * Math.PI * 2, x = tx + Math.cos(ang) * r, z = tz + Math.sin(ang) * r;
      if (!freePoint(x, z, NAV.sol) || crosses(x, z, tx, tz)) continue;
      if (sim.agents.some(b => b !== from && Math.hypot(b.x - x, b.z - z) < .5)) continue;
      const d = Math.hypot(x - from.x, z - from.z); if (d < bd) { bd = d; best = { x, z, fx: tx - x, fz: tz - z }; }
    }
    if (best) return best;
  }
  return null;
}
// escolhe o melhor ponto de uso para uma lista de afinidades, explicando o motivo
// dá para chegar até o lugar? (ex.: a TV atrás da mesa de reunião não tem acesso)
function reachable(a, sp) {
  NAV.reach ??= new Map();
  const s = nearestCell(a.x, a.z, 6), k = sp.id + '@' + (s ? s.join(',') : '-');
  if (!NAV.reach.has(k)) NAV.reach.set(k, !!(s && findPath(s[0], s[1], sp.stand[0], sp.stand[1])));
  return NAV.reach.get(k);
}
// móvel de um ponto de uso ("objId#i" → item do catálogo)
const itemOfSpot = (sp) => W.objects.find(o => o.id === sp.id.split('#')[0])?.item;
// hint = texto do passo: o móvel cujo uso combina com ele ganha preferência (ITEM_HINT, em 01-catalogo.js)
function bestSpot(a, affs, R, hint = '') {
  for (let i = 0; i < affs.length; i++) {
    const cands = NAV.spots.filter(sp => sp.act === affs[i] && (!sim.reserved.has(sp.id) || sim.reserved.get(sp.id) === a.id) && reachable(a, sp));
    if (!cands.length) continue;
    let best = null, bs = Infinity;
    for (const sp of cands) {
      let s = Math.hypot(sp.x - a.x, sp.z - a.z);
      if (R.home && a.home === sp.id) s -= 30;
      if (hint && ITEM_HINT[itemOfSpot(sp)]?.test(hint)) s -= 60;
      if (s < bs) { bs = s; best = sp; }
    }
    const why = [];
    if (i > 0) why.push(`não há ${AFFN[affs[0]].toLowerCase()} livre`);
    why.push(R.home && a.home === best.id ? 'lugar habitual' : 'o livre mais perto');
    return { spot: best, why };
  }
  return null;
}
function decide(a, st, ev) {
  const R = RULES[st], withA = (ev.with || []).map(agentByRef).filter(b => b && b !== a);
  if (R.stay) return { kind: 'stay', transient: R.transient, then: 'ocioso', reason: 'Fica onde está' };
  if (R.idle) return { kind: 'idle', reason: 'Livre, circulando pela sala' };
  if (R.seekKind && !ev._noSeek) {
    const helper = sim.agents.find(b => b !== a && kindOf(b.role) === R.seekKind);
    if (helper) { const pt = nearPoint(helper, a); if (pt) return { kind: 'point', ...pt, transient: R.transient, after: 'solo', reason: `Vai pedir ajuda a ${nameOf(helper)} (${roleInfo(helper.role).n.toLowerCase()})` }; }
  }
  // lugar escolhido para o passo (computador, estúdio, recepção…): vale para quem trabalha sozinho
  const P = PLACES[ev.place];
  if (P && st !== 'reuniao' && !(R.visit && withA.length)) {
    const pick = bestSpot(a, P.acts, R, ev.detail || '');
    if (pick) return { kind: 'spot', spot: pick.spot, reason: `${objName(pick.spot)}: ${P.why}` };
  }
  if (R.visit && withA.length) {
    const pt = nearPoint(withA[0], a);
    if (pt) return { kind: 'point', ...pt, reason: `Vai até ${nameOf(withA[0])}` };
  }
  if (R.group && withA.length) {
    const key = ev.group || [a.id, ...withA.map(b => b.id)].sort().join('+'), size = 1 + withA.length;
    let objId = sim.groups.get(key);
    if (!objId) {
      const all = [a, ...withA], cx = all.reduce((s, b) => s + b.x, 0) / all.length, cz = all.reduce((s, b) => s + b.z, 0) / all.length;
      let best = null, bs = Infinity;
      for (const aff of R.group) {
        const byObj = new Map();
        for (const sp of NAV.spots) if (sp.act === aff && !sim.reserved.has(sp.id)) { const o = sp.id.split('#')[0]; byObj.set(o, [...(byObj.get(o) || []), sp]); }
        for (const [o, list] of byObj) { if (list.length < size) continue; const d = Math.hypot(list[0].x - cx, list[0].z - cz); if (d < bs) { bs = d; best = o; } }
        if (best) break;
      }
      if (best) { objId = best; sim.groups.set(key, best); }
    }
    if (objId) {
      const free = NAV.spots.filter(sp => sp.id.startsWith(objId + '#') && !sim.reserved.has(sp.id));
      if (free.length) {
        free.sort((p, q) => Math.hypot(p.x - a.x, p.z - a.z) - Math.hypot(q.x - a.x, q.z - a.z));
        return { kind: 'spot', spot: free[0], reason: `${objName(free[0])} com ${withA.map(nameOf).join(', ')}` };
      }
    }
  }
  const pick = bestSpot(a, R.solo || [], R);
  if (pick) {
    if (R.home && pick.spot.act === 'work' && !a.home) a.home = pick.spot.id;
    return { kind: 'spot', spot: pick.spot, reason: `${objName(pick.spot)}: ${pick.why.join(', ')}` };
  }
  return { kind: 'stay', reason: `Sem ${AFFN[(R.solo || ['work'])[0]].toLowerCase()} na sala. Fica onde está.`, missing: (R.solo || [])[0] };
}
function setIntent(a, it) {
  if (it.kind !== 'stay' || a.mv !== 'act') release(a);
  a.idleAct = null; a.intent = it; a.decision = it.reason;
  if (it.kind === 'spot') sim.reserved.set(it.spot.id, a.id);
  if (a.pinned || a.held) return;
  if ((a.mv === 'act' || a.mv === 'approach') && a.spot?.sit > 0) { a.mv = 'leave'; a.pending = true; return; }
  execIntent(a);
}
function execIntent(a) {
  const it = a.intent; a.pending = false; a.path = [];
  if (it.kind === 'spot') {
    a.spot = it.spot; a.stand = it.spot.standPt;
    if (planTo(a, it.spot.stand)) a.mv = 'walk'; else { a.mv = 'idle'; a.decision = 'Não encontrou caminho até ' + objName(it.spot); release(a); a.spot = null; }
  } else if (it.kind === 'point') {
    a.spot = null; const c = nearestCell(it.x, it.z, 3);
    if (c && planTo(a, c)) { a.path.push([it.x, it.z]); a.mv = 'walk'; } else a.mv = 'act';
  } else if (it.kind === 'stay') { a.spot = a.mv === 'act' ? a.spot : null; if (a.mv !== 'act') a.mv = 'act'; a.t = it.transient || 0; }
  else { a.spot = null; a.mv = 'idle'; a.t = .5 + Math.random(); }
  if (it.transient) a.t = it.transient;
}
// aplica um evento externo (ou da demo) a um agente
function applyEvent(raw) {
  const ev = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (Array.isArray(ev)) { ev.forEach(applyEvent); return; }
  const a = agentByRef(ev.agent ?? ev.agente ?? ev.name);
  const st = normState(ev.state ?? ev.estado ?? ev.status);
  if (!a) { logFeed({ name: String(ev.agent ?? '?'), st: null, text: 'Agente desconhecido. Cadastre com esse nome no modo Construir.' }); return; }
  if (!st) { logFeed({ name: nameOf(a), st: null, text: `Estado "${ev.state ?? ''}" não reconhecido.` }); return; }
  // histórico guardado pelo servidor (quem conecta depois recebe o que já aconteceu): só entra na ficha, não move ninguém
  if (ev.replay) { histPush(a, { st, task: ev.task || '', detail: ev.detail || '', text: ev.detail || '', at: Number(ev.at) || Date.now(), replay: true }); fichaHTML = ''; return; }
  if (mode !== 'live') return;
  if (a.present === false) enterOffice(a);
  a.detail = ev.detail ? String(ev.detail).slice(0, 140) : '';
  if (ev.task ?? ev.tarefa) a.task = ev.task ?? ev.tarefa; else if (st === 'ocioso' || st === 'offline') a.task = '';
  // since: relógio da simulação (para quando a aba some); sinceAt: hora real, a que vale para sessões de fora (o servidor manda "at" ao reconectar)
  const at = Number(ev.at) > 1e12 ? Number(ev.at) : Date.now(); // só hora absoluta (ms); arquivos de eventos podem usar "at" relativo
  if (st !== a.status) { a.since = sim.clock; a.sinceAt = at; }
  a.sinceAt ||= at;
  a.status = st; a.withNames = (ev.with || []).map(w => { const b = agentByRef(w); return b ? nameOf(b) : String(w); });
  // sessão encerrada já saindo pela porta: o "offline" atrasado não a manda de volta ao sofá
  const it = decide(a, st, ev); if (!(a.ext && a.gone && a.leaving)) setIntent(a, it);
  const why = ev.detail ? `${String(ev.detail).slice(0, 140)} · ${it.reason}` : it.reason;
  logFeed({ name: nameOf(a), st, task: a.task, text: why, src: ev.source });
  histPush(a, { st, task: a.task, text: why, detail: a.detail, at, src: ev.source });
  teamHTML = '';
  if (ev.source === 'manual' && test && !test.finished) checkTasks();
}
function applyAuto(a, st) { if (st !== a.status) a.since = sim.clock; a.status = st; a.withNames = []; if (st === 'ocioso') a.task = ''; const it = decide(a, st, {}); setIntent(a, it); histPush(a, { st, task: a.task, text: it.reason, auto: true }); teamHTML = ''; }
function logFeed(e) { sim.feed.unshift({ t: sim.clock, ...e }); if (sim.feed.length > 60) sim.feed.pop(); feedHTML = ''; }

/* comportamento livre (estado "ocioso"): pequenas pausas pela sala */
const IDLE_ACTS = ['coffee', 'fridge', 'relax', 'plants', 'print', 'tv', 'read', 'wander'];
function pickIdle(a) {
  // no escritório de verdade, quem está livre fica onde está (sem passeios entre tarefas)
  if (quietOffice()) { a.mv = 'idle'; a.t = 3; return; }
  const avail = {}; for (const sp of NAV.spots) if (!sim.reserved.has(sp.id)) (avail[sp.act] ||= []).push(sp);
  const opts = IDLE_ACTS.filter(k => k === 'wander' || avail[k]?.length).map(k => [k, ACTS[k].w * (k === a.idleLast ? .3 : 1)]);
  const total = opts.reduce((s, o) => s + o[1], 0);
  let r = Math.random() * total, k = 'wander'; for (const [n, w] of opts) if ((r -= w) <= 0) { k = n; break; }
  a.idleLast = k;
  if (k !== 'wander') {
    const list = avail[k], sp = list[Math.floor(Math.random() * list.length)];
    if (planTo(a, sp.stand)) { a.spot = sp; a.stand = sp.standPt; sim.reserved.set(sp.id, a.id); a.idleAct = k; a.mv = 'walk'; a.decision = `Livre: ${ACTS[k].go.toLowerCase()}`; return; }
  }
  for (let n = 0; n < 12; n++) {
    const i = Math.floor(Math.random() * NAV.nx), j = Math.floor(Math.random() * NAV.nz); if (!okCell(i, j)) continue;
    const [cx, cz] = cellC(i, j); if (Math.hypot(cx - a.x, cz - a.z) > 7) continue;
    if (planTo(a, [i, j])) { a.spot = null; a.idleAct = 'wander'; a.mv = 'walk'; a.decision = 'Livre: dando uma volta'; return; }
  }
  a.mv = 'idle'; a.t = 2;
}
const SPEED = 2.1;
// outra pessoa no caminho: alguém a menos de meio quadrado e ficando mais perto
function blockerFor(a, nx, nz) {
  for (const b of sim.agents) {
    if (b === a || b.held || b.present === false) continue;
    const [bx, bz] = posOf(b), now = Math.hypot(bx - a.x, bz - a.z), next = Math.hypot(bx - nx, bz - nz);
    if (next < .5 && next < now) return b;
  }
  return null;
}
function moveToward(a, tx, tz, dt) {
  const dx = tx - a.x, dz = tz - a.z, d = Math.hypot(dx, dz), step = SPEED * dt;
  if (d < 1e-6) return true;
  const ux = dx / d, uz = dz / d, nx = d <= step ? tx : a.x + ux * step, nz = d <= step ? tz : a.z + uz * step;
  if (blockerFor(a, nx, nz)) {
    a.wait = (a.wait || 0) + dt; a.fx = ux; a.fz = uz;
    // tenta contornar pelo lado; se não der, espera a vez
    for (const sgn of [1, -1]) {
      const sx = a.x + (ux * .4 - uz * sgn * .9) * step, sz = a.z + (uz * .4 + ux * sgn * .9) * step;
      if (!blockerFor(a, sx, sz) && freePoint(sx, sz, NAV.sol, .12) && !crosses(a.x, a.z, sx, sz)) { a.x = sx; a.z = sz; a.walkDist += step; return false; }
    }
    if (a.wait < 4) return false;
  }
  if (!a.wait) a.replanned = false;
  a.wait = 0;
  if (d <= step) { a.x = tx; a.z = tz; a.walkDist += d; return true; }
  a.x = nx; a.z = nz; a.fx = ux; a.fz = uz; a.walkDist += step; return false;
}
function finishAct(a) {
  if (a.idleAct) {
    release(a); a.idleAct = null;
    if (a.spot) { a.mv = 'leave'; } else { a.mv = 'idle'; a.t = 1 + Math.random() * 2; }
    return;
  }
  const it = a.intent;
  if (it.after === 'solo') { const ev = { _noSeek: true }; const n = decide(a, a.status, ev); n.reason = 'Voltou para a mesa: ' + n.reason; setIntent(a, n); a.decision = n.reason; teamHTML = ''; return; }
  if (it.then) applyAuto(a, it.then);
}
function stepAgent(a, dt) {
  if (a.held || a.pinned) return;
  switch (a.mv) {
    case 'idle':
      if (a.status === 'ocioso' && !a.pending) { a.t -= dt; if (a.t <= 0) pickIdle(a); }
      break;
    case 'walk': {
      // travado por outra pessoa: recalcula a rota contornando quem está no caminho
      if (a.wait > 1.2 && !a.replanned && a.path.length) {
        a.replanned = true;
        const goal = a.path[a.path.length - 1], others = sim.agents.filter(b => b !== a && !b.held && b.present !== false).map(posOf);
        NAV.tmp = new Set(); NAV.tmpPts = others;
        for (const [ox, oz] of others) for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) { const [ci, cj] = cellOf(ox, oz), i = ci + di, j = cj + dj; const [cx, cz] = [NAV.ox + (i + .5) / NAV.R, NAV.oz + (j + .5) / NAV.R]; if (Math.hypot(cx - ox, cz - oz) < .55) NAV.tmp.add(j * NAV.nx + i); }
        const gc = cellOf(goal[0], goal[1]); NAV.tmp.delete(gc[1] * NAV.nx + gc[0]);
        const keep = a.path; if (!planTo(a, gc)) a.path = keep; else { const last = a.path[a.path.length - 1]; if (Math.hypot(last[0] - goal[0], last[1] - goal[1]) > .05) a.path.push(goal); a.wait = 0; }
        NAV.tmp = null; NAV.tmpPts = null;
      }
      const tg = a.path[0];
      if (!tg) {
        if (a.spot) a.mv = 'approach';
        else if (a.intent.kind === 'point' && !a.idleAct) { a.mv = 'act'; a.fx = a.intent.fx; a.fz = a.intent.fz; }
        else { a.mv = 'idle'; a.idleAct = null; a.t = 1 + Math.random() * 2; }
        break;
      }
      if (moveToward(a, tg[0], tg[1], dt)) a.path.shift(); break;
    }
    case 'approach':
      if (moveToward(a, a.spot.x, a.spot.z, dt)) {
        a.mv = 'act'; a.fx = a.spot.fx; a.fz = a.spot.fz;
        if (a.idleAct) { const A = ACTS[a.idleAct]; a.t = A.dur[0] + Math.random() * (A.dur[1] - A.dur[0]); }
      }
      break;
    case 'act':
      if (a.idleAct || a.intent?.transient) { a.t -= dt; if (a.t <= 0) finishAct(a); }
      break;
    case 'leave':
      if (moveToward(a, a.stand[0], a.stand[1], dt)) { a.spot = null; if (a.pending) execIntent(a); else { a.mv = 'idle'; a.t = .5 + Math.random(); } }
      break;
  }
}
function faceOf(fx, fz) { return { back: fx + fz < -1e-6, mirror: fx - fz < -1e-6 }; }
