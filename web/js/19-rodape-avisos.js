'use strict';

/* ---------- Rodapé, avisos e menu ---------- */
const pop = $('#pop'), moreBtn = $('#more-btn'), warnBtn = $('#warn-btn');
function renderFoot() {
  $('#undo').disabled = !past.length; $('#redo').disabled = !future.length;
  const ws = warnings();
  warnBtn.className = 'badge ' + (ws.length ? 'has' : 'clear');
  warnBtn.innerHTML = ws.length ? `${IC.warn}${ws.length} ${ws.length === 1 ? 'aviso' : 'avisos'}` : `${IC.check}Tudo certo`;
  warnBtn.disabled = !ws.length;
  if (popMode === 'warn') openWarn();
}
$('#undo').onclick = undo; $('#redo').onclick = redo;
function closePop() { popMode = null; pop.hidden = true; moreBtn.setAttribute('aria-expanded', 'false'); }
function openWarn() {
  const ws = warnings(); if (!ws.length) return closePop();
  popMode = 'warn'; pop.hidden = false;
  pop.innerHTML = `<h4>Para resolver</h4>` + ws.map((w, i) => `<button type="button" class="warnitem" data-w="${i}">${w.text}</button>`).join('');
  pop.querySelectorAll('[data-w]').forEach(b => b.onclick = () => {
    const w = ws[Number(b.dataset.w)]; closePop();
    if (w.person) { editing = w.person; setTab('pessoas'); }
    else { if (tab === 'pessoas') setTab('elementos'); selected = w.sel; renderCtx(); dirty(); }
  });
}
warnBtn.onclick = () => popMode === 'warn' ? closePop() : openWarn();
moreBtn.onclick = () => {
  if (popMode === 'more') return closePop();
  popMode = 'more'; pop.hidden = false; moreBtn.setAttribute('aria-expanded', 'true');
  pop.innerHTML = `<h4>Começar de novo</h4>
    <button type="button" data-tpl="sala">Modelo: Sala pequena</button>
    <button type="button" data-tpl="vazio">Ambiente vazio</button>
    <hr><h4>Guardar e abrir</h4>
    <button type="button" id="copy-env">${IC.copy}Copiar ambiente</button>
    <label class="filelike" for="open-file">Abrir arquivo de ambiente…</label><input type="file" id="open-file" accept=".json,application/json">`;
  pop.querySelectorAll('[data-tpl]').forEach(b => b.onclick = () => {
    if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = 'Isso troca a sala atual. Clique de novo'; return; }
    loadWorld(b.dataset.tpl === 'sala' ? tplSala() : tplVazio(), b.dataset.tpl === 'sala' ? 'Modelo "Sala pequena" carregado' : 'Ambiente vazio criado'); closePop();
  });
  pop.querySelector('#copy-env').onclick = async () => {
    try { await navigator.clipboard.writeText(JSON.stringify(W)); toast('Ambiente copiado. Cole num arquivo de texto para guardar.'); }
    catch { toast('Não foi possível copiar neste navegador'); }
    closePop();
  };
  pop.querySelector('#open-file').onchange = (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader(); r.onload = () => {
      try { const d = JSON.parse(r.result); if (!d.tiles || !Array.isArray(d.objects)) throw 0; loadWorld(normalize(d), 'Ambiente aberto'); }
      catch { toast('Esse arquivo não é um ambiente do Floorwalk'); }
      closePop();
    }; r.readAsText(f);
  };
};
function loadWorld(w, msg) { if (mode === 'live') setMode('build'); change(() => { W = w; }, msg); selected = null; editing = null; placing = null; walling = null; renderPanel(); renderBanner(); renderCtx(); fit(); }
document.addEventListener('pointerdown', e => { if (popMode && !pop.contains(e.target) && !moreBtn.contains(e.target) && !warnBtn.contains(e.target)) closePop(); });

/* ---------- Faixas de contexto ---------- */
const banner = $('#banner'), ctxBar = $('#ctx');
function renderBanner() {
  if (mode === 'live') { banner.hidden = true; return; }
  let t = null;
  if (placing) t = `Colocando <b>${ITEMS[placing.item].n}</b>: clique na sala · <kbd>R</kbd> gira`;
  else if (walling) t = `Desenhando <b>${WALLKINDS[walling.kind].n}</b>: arraste ao longo da grade`;
  else if (tab === 'planta' && tool === 'add') t = 'Arraste sobre a grade para <b>acrescentar piso</b>';
  else if (tab === 'planta' && tool === 'remove') t = 'Arraste sobre o piso para <b>remover</b>';
  else if (tab === 'planta' && tool === 'mat') t = `Arraste sobre o piso para aplicar <b>${MATS[brushMat].n}</b>`;
  if (!t) { banner.hidden = true; return; }
  banner.hidden = false;
  // traduzido inteiro aqui: com <b> no meio, a tradução automática da tela pegaria a frase em pedaços
  banner.innerHTML = `<span>${T(t)}</span>${placing ? `<button type="button" id="b-rot">${IC.rotate}Girar</button>` : ''}<button type="button" id="b-done">${placing ? 'Cancelar' : 'Concluir'}</button>`;
  const r = banner.querySelector('#b-rot'); if (r) r.onclick = rotate;
  banner.querySelector('#b-done').onclick = cancelModes;
}
function renderCtx() {
  if (mode === 'live' || !selected || placing || walling) { ctxBar.hidden = true; return; }
  if (selected.type === 'wall') {
    const s = wallById(selected.id); if (!s) { ctxBar.hidden = true; return; }
    const I = segInfo(s), pal = wallPalette(s);
    ctxBar.hidden = false;
    ctxBar.innerHTML = `<span class="title"><b>${WALLKINDS[s.kind].n}</b><small>${I.len} ${I.len === 1 ? 'quadrado' : 'quadrados'} · arraste para mover</small></span><span class="sep"></span>
      <label class="sr" for="c-kind" hidden>Tipo</label>
      <select id="c-kind" aria-label="Trocar tipo">${Object.entries(WALLKINDS).map(([k, K]) => `<option value="${k}" ${k === s.kind ? 'selected' : ''}>${K.n}</option>`).join('')}</select>
      ${pal ? '<span class="sep"></span>' + pal.map(c => `<button type="button" class="sw" data-wc="${c}" aria-label="Cor ${c}" aria-pressed="${wallCol(s) === c || s.color === c}" style="background:${c}"></button>`).join('') : ''}
      <span class="sep"></span><button type="button" id="c-del" class="danger">${IC.trash}Apagar</button>`;
    ctxBar.querySelector('#c-kind').onchange = (e) => {
      const kind = e.target.value, m = { ...s, kind, color: null }, prob = WALLKINDS[kind].min > I.len ? `Esse trecho é curto demais para "${WALLKINDS[kind].n}"` : null;
      if (prob) { toast(prob); e.target.value = s.kind; return; }
      change(() => { const q = wallById(s.id); q.kind = kind; delete q.color; }, `Trocado para ${WALLKINDS[kind].n}`);
    };
    ctxBar.querySelectorAll('[data-wc]').forEach(b => b.onclick = () => change(() => { wallById(s.id).color = b.dataset.wc; }, 'Cor trocada'));
    ctxBar.querySelector('#c-del').onclick = removeSelected; return;
  }
  const o = objById(selected.id); if (!o) { ctxBar.hidden = true; return; }
  const it = ITEMS[o.item]; ctxBar.hidden = false;
  if (it.door) { ctxBar.innerHTML = `<span class="title"><b>${it.n}</b><small>a equipe entra e sai por aqui · arraste para outra parede</small></span>`; return; }
  ctxBar.innerHTML = `<span class="title"><b>${it.n}</b><small>arraste para mover</small></span><span class="sep"></span>
    <button type="button" id="c-rot">${IC.rotate}Girar <kbd>R</kbd></button>
    <button type="button" id="c-dup">${IC.copy}Duplicar</button>
    <button type="button" id="c-del" class="danger">${IC.trash}Apagar</button>
    ${it.color ? '<span class="sep"></span>' + SW.map(c => `<button type="button" class="sw" data-oc="${c}" aria-label="Cor ${c}" aria-pressed="${objColor(o) === c}" style="background:${c}"></button>`).join('') : ''}`;
  ctxBar.querySelector('#c-rot').onclick = rotate; ctxBar.querySelector('#c-dup').onclick = duplicate; ctxBar.querySelector('#c-del').onclick = removeSelected;
  ctxBar.querySelectorAll('[data-oc]').forEach(b => b.onclick = () => change(() => { objById(selected.id).color = b.dataset.oc; }, 'Cor trocada'));
}
