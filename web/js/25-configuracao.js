'use strict';

/* ---------- Início com o servidor ----------
   Só roda quando a página vem do servidor do Floorwalk (window.FLOORWALK_BRIDGE). Não há o que configurar: as sessões do
   Claude Code chegam pelos hooks. A página só avisa se os hooks ainda não estão instalados. */
async function setupApi(path, body) {
  const r = await fetch(path, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {});
  const data = await r.json().catch(() => ({}));
  if (!r.ok && !('ok' in data)) throw new Error(data.error || `Erro ${r.status}`);
  return data;
}
async function setupInit() {
  loadStep(.4, 'Conectando ao servidor…');
  // servidor rodando código velho (arquivos mudaram depois que ele subiu): avisa, senão as melhorias não valem
  fetch('/api/stale').then(r => r.json()).then(s => { if (s?.stale) toast('O servidor está com código antigo: pare (Ctrl+C) e rode npm start de novo para as melhorias valerem.'); }).catch(() => {});
  document.body.classList.add('has-office', 'so-claude');
  renderMenu();
  document.body.classList.remove('booting');
  hooksHint();
}
// os hooks estão ligados? o aviso fixo do canto (26-estado.js) diz o que falta e fica até resolver
function hooksHint() { pollHooks(); }
// nome no topo da página
function renderBrand() { const el = $('.brand span'); if (el) el.textContent = 'Claude Code'; }
// "Restaurar a sala padrão" (menu): a sala deste navegador volta a ser a sala de dev pronta; as sessões continuam
function resetRoom() {
  try { localStorage.setItem('floorwalk.tour.v1', '1'); localStorage.setItem(STORE, JSON.stringify(tplClaude())); } catch {}
  location.reload();
}
