'use strict';

/* ---------- Tour: mostra o que o dono pode fazer e como ----------
   Abre sozinho na primeira vez que um negócio é criado (applyOffice) e fica no menu ☰ ("Como usar").
   Cada passo destaca uma parte da tela e explica em uma ou duas frases. Esc ou "Pular" fecha; setas navegam. */
const TOUR_KEY = 'floorwalk.tour.v1';
const TOUR = [
  { t: 'Bem-vindo ao seu escritório', x: 'A IA montou a equipe do seu negócio. Agora é a sua vez de montar o lugar onde ela trabalha. Este tour leva um minuto.' },
  { sel: '#modes', mode: 'build', t: 'Construir e Ao vivo', x: '<b>Construir</b>: você monta a sala. <b>Ao vivo</b>: a equipe trabalha e você acompanha. Você pode trocar a qualquer hora.' },
  { sel: '#tab-planta', mode: 'build', tab: 'planta', t: 'Passo 1 · Planta', x: 'Mude o tamanho da sala (botões + e −, ou os + roxos nas bordas), o piso e a cor das paredes. Aqui também se desenham paredes internas, portas, vidro e divisórias: escolha o tipo e arraste no piso.' },
  { sel: '#tab-elementos', mode: 'build', tab: 'elementos', t: 'Passo 2 · Elementos', x: 'Escolha um móvel na lista e clique no piso para colocar. Arraste para mudar de lugar. Clique num móvel para girar, trocar a cor ou apagar. Monte com o que o seu negócio usa: é para esses móveis que a equipe vai.' },
  { sel: '#tab-pessoas', mode: 'build', tab: 'pessoas', t: 'Passo 3 · Pessoas', x: 'Sua equipe aparece aqui. Mude a aparência, o papel e onde cada pessoa começa. Fora desta aba, os avatares saem da frente para você montar a sala.' },
  { sel: '.panel-foot', mode: 'build', tab: 'planta', t: 'Errou? Tem volta', x: '<b>Desfazer</b> (Ctrl+Z) e <b>Refazer</b>. O aviso ao lado mostra se algum móvel ficou sem passagem ou encavalado.' },
  { sel: '.zoom', mode: 'build', t: 'Olhar a sala', x: 'Arraste com o botão <b>esquerdo</b> para girar a sala e com o <b>direito</b> para mover. A roda do mouse aproxima. Setas ou W A S D também movem. <b>Centralizar</b> volta ao começo.' },
  { sel: '#done-edit', mode: 'build', t: 'Terminou de montar?', x: '<b>Concluir edição</b> leva para o modo Ao vivo. Dá para voltar e mexer depois.' },
  { sel: '#ask', mode: 'live', t: 'Pedir trabalho à equipe', x: 'No Ao vivo, escreva o que a equipe deve fazer e clique em <b>Delegar</b>. A IA divide em passos, cada pessoa vai até o móvel certo e você vê tudo acontecer. O resultado aparece nas entregas.' },
  { sel: '#menu-btn', mode: 'build', t: 'Menu', x: 'Equipe, trocar a IA, pesquisa na internet, rever este tour e <b>começar do zero</b>.' },
  { t: 'Pronto!', x: 'Comece pela <b>Planta</b> e depois coloque os <b>Elementos</b>. Bom trabalho!', mode: 'build', tab: 'planta' },
];
let tourAt = -1, tourEl = null;
function tourStart() {
  if (tourEl) return;
  tourEl = document.createElement('div'); tourEl.className = 'tour'; tourEl.setAttribute('role', 'dialog'); tourEl.setAttribute('aria-modal', 'true'); tourEl.setAttribute('aria-label', 'Tour: como usar');
  tourEl.innerHTML = '<div class="tour-hole"></div><div class="tour-card"><small class="tour-n"></small><h3></h3><p></p><div class="tour-actions"><button type="button" class="tour-skip">Pular</button><span class="grow"></span><button type="button" class="tour-back">Voltar</button><button type="button" class="primary tour-next">Próximo</button></div></div>';
  document.body.append(tourEl);
  tourEl.querySelector('.tour-skip').onclick = () => tourEnd();
  tourEl.querySelector('.tour-back').onclick = () => tourGo(tourAt - 1);
  tourEl.querySelector('.tour-next').onclick = () => tourAt >= TOUR.length - 1 ? tourEnd() : tourGo(tourAt + 1);
  addEventListener('resize', tourPlace); addEventListener('keydown', tourKey, true);
  tourGo(0);
}
function tourKey(e) {
  if (!tourEl) return;
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); tourEnd(); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); tourAt >= TOUR.length - 1 ? tourEnd() : tourGo(tourAt + 1); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); tourGo(tourAt - 1); }
}
function tourGo(i) {
  if (i < 0 || i >= TOUR.length) return;
  tourAt = i; const s = TOUR[i];
  // deixa a tela no estado do passo (modo e aba) antes de destacar
  try { if (s.mode && mode !== s.mode) setMode(s.mode); if (s.tab && tab !== s.tab) setTab(s.tab); } catch {}
  tourEl.querySelector('.tour-n').textContent = `${i + 1} de ${TOUR.length}`;
  tourEl.querySelector('h3').textContent = s.t;
  tourEl.querySelector('p').innerHTML = s.x;
  tourEl.querySelector('.tour-back').hidden = i === 0;
  tourEl.querySelector('.tour-next').textContent = i === TOUR.length - 1 ? 'Começar' : 'Próximo';
  requestAnimationFrame(() => { tourPlace(); tourEl.querySelector('.tour-next').focus(); });
}
// recorte em volta do elemento do passo e o cartão ao lado (abaixo, acima ou no meio, o que couber)
function tourPlace() {
  if (!tourEl) return;
  const s = TOUR[tourAt], hole = tourEl.querySelector('.tour-hole'), card = tourEl.querySelector('.tour-card');
  // visível = tem tamanho na tela (offsetParent é null em elemento "position: fixed", como o painel e o campo de tarefa)
  const el = s.sel ? document.querySelector(s.sel) : null, r0 = el ? el.getBoundingClientRect() : null, r = r0 && r0.width > 0 && r0.height > 0 ? r0 : null;
  const VW = innerWidth, VH = innerHeight, pad = 8, cw = Math.min(360, VW - 32);
  card.style.width = cw + 'px';
  if (!r) { hole.style.cssText = `left:${VW / 2}px;top:${VH / 2}px;width:0;height:0`; card.style.left = (VW - cw) / 2 + 'px'; card.style.top = Math.max(16, VH / 2 - card.offsetHeight / 2) + 'px'; return; }
  hole.style.cssText = `left:${r.left - pad}px;top:${r.top - pad}px;width:${r.width + pad * 2}px;height:${r.height + pad * 2}px`;
  const ch = card.offsetHeight, below = r.bottom + pad + 12, above = r.top - pad - 12 - ch;
  let top = below + ch <= VH - 16 ? below : above >= 16 ? above : Math.max(16, (VH - ch) / 2);
  let left = Math.min(VW - cw - 16, Math.max(16, r.left + r.width / 2 - cw / 2));
  // elemento alto (painel da esquerda): cartão ao lado dele
  if (top === Math.max(16, (VH - ch) / 2) && r.right + 16 + cw < VW) { left = r.right + 16; top = Math.min(VH - ch - 16, Math.max(16, r.top)); }
  card.style.left = left + 'px'; card.style.top = top + 'px';
}
function tourEnd() {
  if (!tourEl) return;
  tourEl.remove(); tourEl = null; tourAt = -1;
  removeEventListener('resize', tourPlace); removeEventListener('keydown', tourKey, true);
  try { localStorage.setItem(TOUR_KEY, '1'); } catch {}
}
// primeira vez (negócio novo): abre sozinho, uma vez só
function tourMaybe() { let seen = false; try { seen = localStorage.getItem(TOUR_KEY) === '1'; } catch {} if (!seen) setTimeout(tourStart, 600); }
$('#m-tour')?.addEventListener('click', () => { closeMenu(); tourStart(); });
