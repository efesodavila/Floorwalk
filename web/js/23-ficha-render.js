'use strict';

// segundos em cada estado, pela hora de cada entrada do histórico: cada estado dura até o próximo (o último, até agora)
function wallTimes(hist, now = Date.now()) {
  const h = (hist || []).filter(x => x.st && x.at && !x.auto).sort((x, y) => x.at - y.at), out = {};
  for (let i = 0; i < h.length; i++) { const end = i + 1 < h.length ? h[i + 1].at : now; out[h[i].st] = (out[h[i].st] || 0) + Math.max(0, (end - h[i].at) / 1000); }
  return out;
}

function renderFicha() {
  if (mode !== 'live' || !sim.inspect) { ficha.hidden = true; return; }
  const a = sim.agents.find(q => q.id === sim.inspect), p = a && personOf(a);
  if (!a || !p) { closeFicha(); return; }
  const R = RULES[a.status], role = ROLES[a.role] || { n: 'Sem papel', c: '#5C5866' };
  const withN = (a.withNames || []).filter(Boolean);
  // sessão de fora (Claude Code): tempo pelo relógio de verdade, a partir do histórico com hora (vale com a aba em segundo
  // plano e depois de recarregar). Os outros usam o relógio da simulação, que para quando a aba some.
  const now = Date.now(), ago = a.ext && a.sinceAt ? (now - a.sinceAt) / 1000 : sim.clock - (a.since || 0);
  const timeIn = a.ext ? wallTimes(a.hist, now) : a.timeIn;
  const times = Object.entries(timeIn || {}).filter(([, v]) => v > .5).sort((x, y) => y[1] - x[1]), total = times.reduce((s, [, v]) => s + v, 0) || 1;
  const hist = a.hist || [], done = hist.filter(h => h.st === 'concluido' && h.task).length, blocks = hist.filter(h => h.st === 'bloqueado').length, evs = hist.filter(h => !h.auto).length;
  const shown = fichaAll ? hist : hist.slice(0, 8);
  const html = `
    <div class="f-head"><img src="${avatar(p, 4)}" alt="" width="48" height="56"><div><b data-no-i18n>${escapeHTML(p.name)}</b><span style="color:${role.c}">${role.n}</span></div>
      <button type="button" class="icon" data-f="close" aria-label="Fechar ficha" title="Fechar (Esc)">✕</button></div>
    <section class="f-now"><h4>Agora</h4>
      <div class="f-state"><i class="chip" style="background:${R.c}">${R.n}</i><span>há ${fmtDur(ago)}</span></div>
      <dl>
        ${p.bio ? `<dt>Função</dt><dd>${escapeHTML(p.bio)}</dd>` : ''}
        ${a.detail ? `<dt>Fazendo</dt><dd>${escapeHTML(a.detail)}</dd>` : ''}
        <dt>${a.ext ? 'Projeto' : 'Tarefa'}</dt><dd>${a.task ? escapeHTML(a.task) : '<span class="muted">Nenhuma</span>'}</dd>
        <dt>Onde</dt><dd>${escapeHTML(whereOf(a))}</dd>
        <dt class="f-dev">Por quê</dt><dd class="f-dev">${escapeHTML(a.decision || '')}</dd>
        ${withN.length ? `<dt>Com</dt><dd>${withN.map(escapeHTML).join(', ')}</dd>` : ''}
      </dl></section>
    ${missionHTML(a)}
    <section><h4>Tempo por atividade</h4>
      ${times.length ? `<div class="f-bar">${times.map(([k, v]) => `<span style="width:${(v / total * 100).toFixed(1)}%;background:${RULES[k].c}" title="${RULES[k].n}: ${fmtDur(v)}"></span>`).join('')}</div>
      <ul class="f-legend">${times.slice(0, 5).map(([k, v]) => `<li><i style="background:${RULES[k].c}"></i>${RULES[k].n}<b>${Math.round(v / total * 100)}%</b><small>${fmtDur(v)}</small></li>`).join('')}</ul>` : '<p class="muted">Ainda sem dados: aparece conforme o trabalho acontece.</p>'}
    </section>
    <section class="f-dev"><h4>Números</h4><div class="f-nums"><div><b>${done}</b><small>tarefas concluídas</small></div><div><b>${blocks}</b><small>bloqueios</small></div><div><b>${evs}</b><small>eventos recebidos</small></div></div></section>
    <section><h4>Histórico</h4>
      ${shown.length ? `<ol class="f-hist">${shown.map(h => `<li><time>${h.at ? new Date(h.at).toLocaleTimeString('pt-BR') : fmtClock(h.t)}</time><div>${h.st ? `<i class="chip" style="background:${RULES[h.st].c}">${RULES[h.st].n}</i>` : ''}${h.task && !a.ext ? ` <span>${escapeHTML(h.task)}</span>` : ''}${h.auto ? ' <em>automático</em>' : ''}<small>${escapeHTML(h.detail || h.text || '')}</small></div></li>`).join('')}</ol>` : '<p class="muted">Nenhuma ação ainda.</p>'}
      ${hist.length > 8 ? `<button type="button" class="linkish" data-f="all">${fichaAll ? 'Mostrar menos' : `Ver todas (${hist.length})`}</button>` : ''}
    </section>
    <div class="f-actions f-dev">
      <button type="button" data-f="follow" aria-pressed="${sim.following === a.id}">${sim.following === a.id ? 'Parar de seguir' : 'Seguir com a câmera'}</button>
      ${a.pinned ? '<button type="button" data-f="unpin">Voltar à rotina</button>' : '<button type="button" data-f="pin">Fixar aqui</button>'}
      <button type="button" data-f="send">Enviar evento</button>
    </div>`;
  ficha.hidden = false;
  if (html === fichaHTML) return; fichaHTML = html;
  const sc = ficha.scrollTop; ficha.innerHTML = html; ficha.scrollTop = sc;
}
ficha.addEventListener('click', (e) => {
  const b = e.target.closest('[data-f]'); if (!b) return;
  const a = sim.agents.find(q => q.id === sim.inspect); if (!a) return;
  const act = b.dataset.f;
  if (act === 'close') return closeFicha();
  if (act === 'all') fichaAll = !fichaAll;
  if (act === 'follow') { sim.following = sim.following === a.id ? null : a.id; teamHTML = ''; renderTeam(); }
  if (act === 'pin') { release(a); a.spot = null; a.path = []; a.mv = 'act'; a.pinned = true; histPush(a, { text: 'Fixado por você neste lugar', auto: true }); }
  if (act === 'unpin') { a.pinned = false; histPush(a, { text: 'Voltou à rotina automática', auto: true }); setIntent(a, decide(a, a.status, {})); }
  if (act === 'send') { renderSourceBox(true, 'send'); const sel = $('#ev-agent'); if (sel) sel.value = nameOf(a); }
  fichaHTML = ''; renderFicha(); teamHTML = ''; renderTeam();
});
// a ficha acompanha o personagem na tela, presa à altura da cabeça (no celular vira uma folha fixa embaixo)
let fichaPos = null, fichaAnchor = null;
function placeFicha() {
  // a ficha fica fixa no lado direito da tela; não acompanha o personagem
  ficha.style.left = ''; ficha.style.top = ''; fichaAnchor = null; return;
  if (ficha.hidden || VW <= 520) { ficha.style.left = ''; ficha.style.top = ''; fichaPos = null; fichaAnchor = null; return; }
  const a = sim.agents.find(q => q.id === sim.inspect); if (!a) return;
  const sit = a.mv === 'act' && a.spot?.sit > 0, [hx, hy] = iso(a.x, a.z, sit ? 1.3 : 1.75);
  const w = ficha.offsetWidth, h = ficha.offsetHeight, gap = 34 + 6 * view.z;
  let side = 1, left = hx + gap;
  if (left + w > VW - 16) { side = -1; left = hx - gap - w; }
  if (left < 16) { side = 0; left = Math.max(16, Math.min(VW - w - 16, hx - w / 2)); }
  let top = hy - 48;
  if (side === 0) { const fy = iso(a.x, a.z, 0)[1]; top = hy - h - 26 >= 64 ? hy - h - 26 : fy + 18; }
  top = Math.max(64, Math.min(VH - h - 96, top));
  if (!fichaPos) fichaPos = [left, top];
  fichaPos[0] += (left - fichaPos[0]) * .35; fichaPos[1] += (top - fichaPos[1]) * .35;
  ficha.style.left = Math.round(fichaPos[0]) + 'px'; ficha.style.top = Math.round(fichaPos[1]) + 'px';
  const bx = side === 1 ? fichaPos[0] : side === -1 ? fichaPos[0] + w : Math.max(fichaPos[0], Math.min(fichaPos[0] + w, hx));
  const by = side === 0 ? (fichaPos[1] > hy ? fichaPos[1] : fichaPos[1] + h) : Math.max(fichaPos[1] + 14, Math.min(fichaPos[1] + h - 14, hy));
  fichaAnchor = { hx, hy, bx, by };
}
// linha tracejada ligando a ficha ao personagem
function drawFichaLink(c) {
  if (!fichaAnchor || ficha.hidden || mode !== 'live') return;
  const { hx, hy, bx, by } = fichaAnchor;
  c.save(); c.strokeStyle = 'rgba(140,79,224,0.85)'; c.lineWidth = 2; c.setLineDash([5, 4]);
  c.beginPath(); c.moveTo(hx, hy); c.lineTo(bx, by); c.stroke(); c.setLineDash([]);
  c.fillStyle = '#8C4FE0'; c.beginPath(); c.arc(hx, hy, 3.5, 0, Math.PI * 2); c.fill(); c.restore();
}
