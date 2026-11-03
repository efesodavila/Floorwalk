'use strict';

/* ---------- Quadros que expandem e retraem ---------- */
let UI = { panel: false, team: { c: false, b: false }, feed: { c: false, b: false } };
try { UI = { ...UI, ...(JSON.parse(localStorage.getItem('pixelhq.ui') || 'null') || {}) }; } catch {}
if (!localStorage.getItem?.('pixelhq.ui') && window.innerWidth <= 760) UI.team.c = true;
function saveUI() { try { localStorage.setItem('pixelhq.ui', JSON.stringify(UI)); } catch {} }
function applyUI() {
  const panel = $('.panel'); panel.classList.toggle('collapsed', UI.panel && VW > 760);
  $('#panel-collapse').setAttribute('aria-expanded', String(!UI.panel)); $('#panel-collapse').title = UI.panel ? 'Abrir painel' : 'Recolher painel';
  if (VW > 760) document.documentElement.style.setProperty('--panel-w', UI.panel ? '76px' : '320px'); else document.documentElement.style.removeProperty('--panel-w');
  for (const k of ['team', 'feed']) {
    const el = $('#' + k); el.classList.toggle('collapsed', UI[k].c); el.classList.toggle('big', UI[k].b && !UI[k].c);
    el.querySelector('[data-card-toggle]').setAttribute('aria-expanded', String(!UI[k].c)); el.querySelector('[data-card-toggle]').title = UI[k].c ? 'Abrir' : 'Retrair';
    el.querySelector('[data-card-grow]').setAttribute('aria-pressed', String(UI[k].b)); el.querySelector('[data-card-grow]').title = UI[k].b ? 'Reduzir' : 'Expandir';
  }
  teamHTML = ''; feedHTML = ''; renderTeam(); renderFeed(); renderBanner(); renderCtx();
}
$('#panel-collapse').onclick = () => { UI.panel = !UI.panel; saveUI(); applyUI(); };
document.querySelectorAll('.tabs [data-tab]').forEach(b => b.addEventListener('click', () => { if (UI.panel) { UI.panel = false; saveUI(); applyUI(); } }));
document.querySelectorAll('[data-card-toggle]').forEach(b => b.onclick = () => { const k = b.dataset.cardToggle; UI[k].c = !UI[k].c; saveUI(); applyUI(); });
document.querySelectorAll('[data-card-grow]').forEach(b => b.onclick = () => { const k = b.dataset.cardGrow; UI[k].b = !UI[k].b; UI[k].c = false; saveUI(); applyUI(); });
