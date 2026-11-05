'use strict';

/* ---------- Menu do canto superior direito ---------- */
const menuEl = $('#menu'), menuBtn = $('#menu-btn');
// modo desenvolvedor: só pelo endereço (?dev); não aparece no menu
let devMode = new URLSearchParams(location.search).has('dev');
function renderMenu() {
  document.body.classList.toggle('bridge', !!window.FLOORWALK_BRIDGE);
  document.body.classList.toggle('dev', devMode);
  document.body.classList.toggle('clean', document.body.classList.contains('has-office') && !devMode);
  $('#m-dev').setAttribute('aria-pressed', String(devMode));
  $('#m-3d').setAttribute('aria-pressed', String(!!window.R3D?.wanted));
  $('#m-lang').textContent = LANG === 'pt' ? 'Language: English' : 'Idioma: Português';
  $('#m-edit').textContent = mode === 'build' ? 'Voltar ao trabalho (ao vivo)' : 'Editar a sala e as pessoas';
  $('#menu-head').innerHTML = '<b>Floorwalk</b><small>Claude Code</small>';
}
// separador só entre itens visíveis: some quando um dos lados ficou vazio (itens escondidos pelo modo)
function tidyMenuLines() {
  const shown = (el) => !el.hidden && getComputedStyle(el).display !== 'none';
  let seen = false, pending = null;
  for (const el of menuEl.children) {
    if (el.tagName === 'HR') { el.style.display = 'none'; if (seen) pending = el; seen = false; continue; }
    if (el.tagName !== 'BUTTON' || !shown(el)) continue;
    if (pending) { pending.style.display = ''; pending = null; }
    seen = true;
  }
}
function openMenu() { renderMenu(); tidyMenuLines(); menuEl.hidden = false; menuBtn.setAttribute('aria-expanded', 'true'); menuEl.querySelector('button:not([hidden])')?.focus(); }
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
for (const id of ['m-team', 'm-edit', 'open-rules', 'open-test', 'open-changes']) $('#' + id).addEventListener('click', () => closeMenu());
$('#m-edit').onclick = () => { setMode(mode === 'build' ? 'live' : 'build'); renderMenu(); };
$('#m-lang').onclick = () => setLang(LANG === 'pt' ? 'en' : 'pt');
// restaurar a sala padrão: só troca a sala deste navegador pela sala de dev pronta; as sessões continuam
$('#m-reset').onclick = async () => {
  closeMenu();
  if (await askConfirm({ title: 'Restaurar a sala padrão?', text: 'A sala que você montou neste navegador volta a ser a sala de dev pronta. As sessões do Claude Code continuam.', ok: 'Restaurar', danger: true })) resetRoom();
};
$('#m-3d').onclick = () => {
  const on = !window.R3D?.wanted;
  try { localStorage.setItem('floorwalk.3d', on ? '1' : '0'); } catch {}
  location.reload();
};
$('#m-dev').onclick = () => { devMode = !devMode; try { localStorage.setItem('floorwalk.dev', devMode ? '1' : '0'); } catch {} renderMenu(); if (devMode && mode === 'live') { sim.playing = true; updatePlayer(); } };

$('#done-edit').onclick = () => { setMode('live'); renderMenu(); };

/* ---------- Sala quieta ----------
   Com o servidor, ninguém anda à toa: cada sessão do Claude Code entra pela porta quando começa e sai quando termina.
   Com a sala vazia, a animação pausa até a próxima sessão. */
function quietOffice() { return !!window.FLOORWALK_BRIDGE && !devMode; }
const WALKING = new Set(['walk', 'approach', 'leave']);

/* Entrada e saída: quem chega entra pela porta e sai por ela no fim. */
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
  if (e && planTo(a, e.cell)) { a.mv = 'walk'; a.leaving = true; a.decision = 'Saindo: sessão encerrada'; }
  else a.present = false;
}
setInterval(() => {
  if (!quietOffice() || mode !== 'live' || !sim.playing) return;
  for (const a of sim.agents) {
    if (a.present === false || a.held) continue;
    // sessão de fora (Claude Code) ainda aberta: fica na sala; só sai quando a sessão termina (offline)
    if (a.ext && a.status !== 'offline' && !a.gone) continue;
    // chegou à saída: some
    if (a.leaving) {
      // some ao chegar perto da porta (não espera a fila dos outros terminar o caminho)
      const e = entrance(), near = e && Math.hypot(a.x - e.pt[0], a.z - e.pt[1]) < .9;
      if (!WALKING.has(a.mv) || near) { a.present = false; a.leaving = false; a.path = []; a.mv = 'act'; }
      continue;
    }
    // quem não é de uma sessão aberta (ou ficou sem saída) vai embora
    if (!WALKING.has(a.mv)) { if (a.status !== 'ocioso') { a.status = 'ocioso'; a.task = ''; } leaveOffice(a); }
  }
  // sala vazia: pausa a animação até a próxima sessão
  if (sim.agents.every(a => a.present === false)) { sim.playing = false; updatePlayer(); }
}, 400);

/* ---------- Gaveta: as sessões do Claude Code abertas ---------- */
function renderTeamDrawer() {
  const ext = sim.agents.filter(a => a.ext && !a.gone && personOf(a));
  drawer.innerHTML = `<button type="button" class="close" id="d-close" aria-label="Fechar">✕</button><h2>Sessões do Claude Code</h2>
    ${ext.length ? `<ul class="team-list">${ext.map(a => { const p = personOf(a), R = RULES[a.status]; return `<li><button type="button" data-p="${p.id}"><img src="${avatar(p, 3)}" alt="" width="36" height="42"><span><b data-no-i18n>${escapeHTML(p.name)}</b> <i class="chip" style="background:${R.c}">${R.n}</i>${a.detail ? `<small>${escapeHTML(a.detail)}</small>` : ''}</span></button></li>`; }).join('')}</ul>`
    : '<p class="hint">Nenhuma sessão do Claude Code aberta. Abra uma no terminal e ela entra pela porta.</p>'}`;
  drawer.querySelectorAll('[data-p]').forEach(b => b.onclick = () => {
    if (mode !== 'live') setMode('live');
    if (sim.agents.some(a => a.id === b.dataset.p)) { drawerMode = null; renderDrawer(); openFicha(b.dataset.p); }
  });
}
$('#m-team').onclick = () => { drawerMode = 'team'; renderDrawer(); };
