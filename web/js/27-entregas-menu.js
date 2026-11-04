'use strict';

/* ---------- Markdown simples e seguro ----------
   O texto vem da IA: tudo é escapado antes; só criamos títulos, negrito, itálico, código, listas e links http(s). */
function md(src) {
  const esc = (t) => escapeHTML(t).replace(/'/g, '&#39;');
  const inline = (t) => esc(t)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*([^*\s][^*]*)\*(?!\w)/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  const out = []; let list = null, para = [], code = null;
  const flushPara = () => { if (para.length) { out.push(`<p>${para.map(inline).join('<br>')}</p>`); para = []; } };
  const flushList = () => { if (list) { out.push(`<${list.tag}>${list.items.map(i => `<li>${inline(i)}</li>`).join('')}</${list.tag}>`); list = null; } };
  for (const line of String(src || '').replace(/\r/g, '').split('\n')) {
    if (code !== null) { if (/^```/.test(line)) { out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`); code = null; } else code.push(line); continue; }
    if (/^```/.test(line)) { flushPara(); flushList(); code = []; continue; }
    let m;
    if ((m = /^(#{1,4})\s+(.*)$/.exec(line))) { flushPara(); flushList(); const n = Math.min(4, m[1].length + 2); out.push(`<h${n}>${inline(m[2])}</h${n}>`); continue; }
    if ((m = /^\s*[-*•]\s+(.*)$/.exec(line))) { flushPara(); if (list?.tag !== 'ul') { flushList(); list = { tag: 'ul', items: [] }; } list.items.push(m[1]); continue; }
    if ((m = /^\s*\d+[.)]\s+(.*)$/.exec(line))) { flushPara(); if (list?.tag !== 'ol') { flushList(); list = { tag: 'ol', items: [] }; } list.items.push(m[1]); continue; }
    if (/^\s*(---|\*\*\*)\s*$/.test(line)) { flushPara(); flushList(); out.push('<hr>'); continue; }
    if (!line.trim()) { flushPara(); flushList(); continue; }
    flushList(); para.push(line);
  }
  if (code !== null) out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`);
  flushPara(); flushList();
  return out.join('');
}

/* ---------- Resultado da tarefa: a resposta primeiro; as etapas da equipe recolhidas ---------- */
const resultEl = $('#result');
const ACTION_LABEL = { pesquisar: 'Pesquisa', produzir: 'Produção', revisar: 'Revisão', entregar: 'Entrega' };
function openResult(id) {
  const ms = MISSIONS.find(q => q.id === id); if (!ms) return;
  const res = ms.results || [];
  const main = [...res].reverse().find(r => r.action === 'entregar') || [...res].reverse().find(r => r.action === 'produzir') || res[res.length - 1];
  const mainText = main?.text || ms.output || '';
  const people = [...new Set(res.map(r => r.agent))];
  const reviewer = res.find(r => r.action === 'revisar')?.agent;
  const by = people.length <= 1 ? `Por ${people[0] || 'a equipe'}` : `Feito por ${people.filter(p => p !== reviewer).join(', ')}${reviewer ? ` · revisado por ${reviewer}` : ''}`;
  const steps = res.filter(r => r !== main);
  resultEl.innerHTML = `<button type="button" class="close" data-r="close" aria-label="Fechar resultado">✕</button>
    <h2 id="result-title">${escapeHTML(ms.text)}</h2>
    <p class="meta">${escapeHTML(by)}</p>
    <div class="md answer">${md(mainText)}</div>
    <div class="r-actions"><button type="button" data-r="copy">Copiar resposta</button></div>
    ${steps.length ? `<details class="steps"><summary>Como a equipe chegou aqui (${steps.length} ${steps.length === 1 ? 'etapa' : 'etapas'})</summary>
      ${steps.map(r => `<details><summary>${escapeHTML(r.title)}</summary><div class="md">${md(r.text)}</div></details>`).join('')}</details>` : ''}
    ${ms.folder ? `<p class="folder hint">Salvo em <code>${escapeHTML(ms.folder)}</code></p>` : ''}`;
  resultEl.hidden = false; drawerMode = null; renderDrawer();
  resultEl.querySelector('[data-r="close"]').focus();
  const copy = resultEl.querySelector('[data-r="copy"]');
  copy.onclick = async () => {
    try { await navigator.clipboard.writeText(mainText); copy.textContent = 'Copiado'; }
    catch { const r = document.createRange(); r.selectNodeContents(resultEl.querySelector('.answer')); getSelection().removeAllRanges(); getSelection().addRange(r); copy.textContent = 'Texto selecionado: use Ctrl+C'; }
    setTimeout(() => (copy.textContent = 'Copiar resposta'), 2000);
  };
  resultEl.querySelector('[data-r="close"]').onclick = closeResult;
}
function closeResult() { resultEl.hidden = true; }
resultEl.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeResult(); e.stopPropagation(); } });

/* ---------- Menu do canto superior direito ---------- */
const menuEl = $('#menu'), menuBtn = $('#menu-btn');
// modo desenvolvedor: só pelo endereço (?dev); não aparece mais no menu
let devMode = new URLSearchParams(location.search).has('dev');
function renderMenu() {
  document.body.classList.toggle('bridge', !!window.PIXELHQ_BRIDGE);
  document.body.classList.toggle('dev', devMode);
  document.body.classList.toggle('clean', document.body.classList.contains('has-office') && !devMode);
  $('#m-dev').setAttribute('aria-pressed', String(devMode));
  $('#m-3d').setAttribute('aria-pressed', String(!!window.R3D?.wanted));
  { const v = typeof setupState !== 'undefined' ? setupState.view : null; $('#m-web').setAttribute('aria-pressed', String(v?.web !== false)); }
  $('#m-edit').textContent = mode === 'build' ? 'Voltar ao trabalho (ao vivo)' : 'Editar a sala e as pessoas';
  const v = typeof setupState !== 'undefined' ? setupState.view : null;
  const name = W.officeId ? W.name : null;
  $('#menu-head').innerHTML = name || v?.configured ? `<b>${escapeHTML(name || 'Pixel HQ')}</b><small>${v?.configured ? escapeHTML(`${aiLabel()} · ${v.model}`) : 'Sem IA conectada'}</small>` : '';
}
function openMenu() { renderMenu(); menuEl.hidden = false; menuBtn.setAttribute('aria-expanded', 'true'); menuEl.querySelector('button:not([hidden])')?.focus(); }
function closeMenu(focusBtn) { menuEl.hidden = true; menuBtn.setAttribute('aria-expanded', 'false'); if (focusBtn) menuBtn.focus(); }
menuBtn.onclick = () => (menuEl.hidden ? openMenu() : closeMenu());
document.addEventListener('pointerdown', (e) => { if (!menuEl.hidden && !e.target.closest('.top-right')) closeMenu(); });
menuEl.addEventListener('keydown', (e) => {
  e.stopPropagation();
  const items = [...menuEl.querySelectorAll('button')].filter(b => b.offsetParent);
  const i = items.indexOf(document.activeElement);
  if (e.key === 'Escape') closeMenu(true);
  if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length]?.focus(); }
  if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length]?.focus(); }
});
// itens que fecham o menu ao clicar (iluminação e ferramentas ficam abertos para ver a mudança)
for (const id of ['m-team', 'm-edit', 'm-office', 'ai-btn', 'open-rules', 'open-test', 'open-changes']) $('#' + id).addEventListener('click', () => closeMenu());
$('#m-edit').onclick = () => { setMode(mode === 'build' ? 'live' : 'build'); renderMenu(); };
$('#m-office').onclick = () => openOfficeStep();
// começar do zero: confirma, apaga o escritório no servidor e a sala salva neste navegador, e volta para "descrever o negócio"
$('#m-reset').onclick = async () => {
  closeMenu();
  const ok = confirm('Começar do zero?\n\nApaga o negócio atual: a equipe, a sala que você montou e o histórico de tarefas. Não dá para desfazer.\n\nContinuam: a IA conectada e os arquivos que os agentes já entregaram.');
  if (!ok) return;
  try { await setupApi('/api/office/reset', {}); }
  catch (e) { toast?.('Não consegui apagar: ' + e.message); return; }
  try { localStorage.setItem(STORE, JSON.stringify(tplVazio())); } catch {}
  location.reload();
};
// pesquisa na internet: liga/desliga no servidor (vale para as próximas tarefas)
$('#m-web').onclick = async () => {
  const on = !(setupState.view?.web !== false);
  try { const r = await setupApi('/api/settings/web', { web: on }); setupState.view = { ...setupState.view, ...r.settings }; toast?.(on ? 'Os agentes podem pesquisar na internet.' : 'Pesquisa na internet desligada: os agentes usam só o que já sabem.'); }
  catch (e) { toast?.('Não consegui mudar: ' + e.message); }
  renderMenu();
};
$('#m-3d').onclick = () => {
  const on = !window.R3D?.wanted;
  try { localStorage.setItem('pixelhq.3d', on ? '1' : '0'); } catch {}
  location.reload();
};
$('#m-dev').onclick = () => { devMode = !devMode; try { localStorage.setItem('pixelhq.dev', devMode ? '1' : '0'); } catch {} renderMenu(); if (devMode && mode === 'live') { sim.playing = true; updatePlayer(); } };

$('#done-edit').onclick = () => { setMode('live'); renderMenu(); setTimeout(() => $('#ask-in')?.focus(), 50); };

/* ---------- Animação só durante as tarefas ----------
   Com o servidor, a equipe fica parada até chegar uma tarefa. Depois que a última tarefa termina,
   espera alguns segundos (comemoração, volta para o lugar) e pausa quando ninguém está andando. */
let lastTaskEnd = 0;
function quietOffice() { return !!window.PIXELHQ_BRIDGE && !devMode; }
const WALKING = new Set(['walk', 'approach', 'leave']);

/* Entrada e saída: quem participa da tarefa chega pela frente da sala e sai por ela no fim. */
function entrance() {
  if (!NAV) buildNav();
  // a entrada é a porta (item "Porta de entrada", sempre encostada numa parede); sem ela, um ponto na frente da sala
  const D = doorInfo(), b = bounds();
  const mid = D && (D.u0 + D.u1) / 2;
  const c = D ? nearestCell(D.side === 'x' ? D.c + .4 : mid, D.side === 'x' ? mid : D.c + .4, 6) : nearestCell(b.x0 + (b.x1 - b.x0) * .35, b.z1 - .4, 8);
  return c ? { cell: c, pt: cellC(c[0], c[1]), face: D ? D.face : [0, -1] } : null;
}
function enterOffice(a) {
  const e = entrance();
  a.present = true; a.leaving = false; a.path = []; a.spot = null; a.idleAct = null; a.mv = 'idle'; a.t = .2;
  if (e) { a.x = e.pt[0]; a.z = e.pt[1]; [a.fx, a.fz] = e.face; }
}
// saída escalonada: um de cada vez (intervalo LEAVE_GAP), para não se amontoarem na porta
const LEAVE_GAP = 900; let lastLeave = 0;
function leaveOffice(a) {
  if (Date.now() - lastLeave < LEAVE_GAP) return;
  lastLeave = Date.now();
  const e = entrance();
  release(a); a.spot = null; a.idleAct = null; a.pending = false; a.intent = { kind: 'idle' };
  if (e && planTo(a, e.cell)) { a.mv = 'walk'; a.leaving = true; a.decision = 'Saindo: parte entregue'; }
  else a.present = false;
}
const taskRunning = () => MISSIONS.some(m => m.status === 'na_fila' || m.status === 'em_andamento');
setInterval(() => {
  if (!quietOffice() || mode !== 'live' || !sim.playing) return;
  if (taskRunning()) return;
  for (const a of sim.agents) {
    if (a.present === false || a.held) continue;
    // sessão de fora (Claude Code) ainda aberta: fica na sala; só sai quando a sessão termina (offline)
    if (a.ext && a.status !== 'offline') continue;
    // chegou à saída: some
    if (a.leaving) {
      // some ao chegar perto da porta (não espera a fila dos outros terminar o caminho)
      const e = entrance(), near = e && Math.hypot(a.x - e.pt[0], a.z - e.pt[1]) < .9;
      if (!WALKING.has(a.mv) || near) { a.present = false; a.leaving = false; a.path = []; a.mv = 'act'; }
      continue;
    }
    // terminou a parte (comemoração já passou): vai embora
    if (Date.now() - lastTaskEnd > 2500 && a.status === 'ocioso' && !WALKING.has(a.mv)) leaveOffice(a);
    // tarefa acabou e alguém ficou num estado sem saída (ex.: esperando algo que não veio): sai também
    else if (Date.now() - lastTaskEnd > 6000 && !WALKING.has(a.mv)) { a.status = 'ocioso'; a.task = ''; leaveOffice(a); }
  }
  // sala vazia: pausa a animação até a próxima tarefa
  if (Date.now() - lastTaskEnd > 2500 && sim.agents.every(a => a.present === false)) { sim.playing = false; updatePlayer(); }
}, 400);

/* ---------- Equipe: quem é quem, mesmo antes da primeira tarefa ---------- */
function renderTeamDrawer() {
  const extras = W.objects.filter(o => (SPOTS[o.item] || []).some(sp => /^(care|cook|stock|sell|craft|attend|record|x_)/.test(sp[2]))).map(o => ITEMS[o.item].n);
  drawer.innerHTML = `<button type="button" class="close" id="d-close" aria-label="Fechar">✕</button><h2>Equipe${W.officeId ? ' · ' + escapeHTML(W.name) : ''}</h2>
    <p>As pessoas entram na sala quando uma tarefa precisa delas. Clique para ver a ficha.</p>
    <ul class="team-list">${W.people.map(p => { const r = roleInfo(p.role); return `<li><button type="button" data-p="${p.id}"><img src="${avatar(p, 3)}" alt="" width="36" height="42"><span><b>${escapeHTML(p.name)}</b> <em style="color:${r.c}">${escapeHTML(r.n)}</em>${p.bio ? `<small>${escapeHTML(p.bio)}</small>` : ''}</span></button></li>`; }).join('')}</ul>
    ${extras.length ? `<p class="hint">Na sala também há: ${extras.map(escapeHTML).join(', ')}.</p>` : ''}`;
  drawer.querySelectorAll('[data-p]').forEach(b => b.onclick = () => {
    if (mode !== 'live') setMode('live');
    if (sim.agents.some(a => a.id === b.dataset.p)) { drawerMode = null; renderDrawer(); openFicha(b.dataset.p); }
  });
}
$('#m-team').onclick = () => { drawerMode = 'team'; closeResult(); renderDrawer(); };
