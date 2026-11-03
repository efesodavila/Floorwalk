'use strict';

/* ---------- Entrada ---------- */
function resize() {
  dpr = Math.min(2, window.devicePixelRatio || 1); VW = window.innerWidth; VH = window.innerHeight;
  cv.width = Math.round(VW * dpr); cv.height = Math.round(VH * dpr); cv.style.width = VW + 'px'; cv.style.height = VH + 'px'; dirty();
}
function sceneArea() {
  if (VW <= 760) return mode === 'live' ? { x0: 0, y0: 100, x1: VW, y1: VH * .8 - 150 } : { x0: 0, y0: 60, x1: VW, y1: VH * .5 };
  const left = mode === 'live' ? (UI.team.c ? 16 : UI.team.b ? 436 : 296) : (UI.panel ? 92 : 336);
  const right = mode === 'live' && !UI.feed.c ? (UI.feed.b ? 476 : 316) : 0;
  return { x0: left + 16, y0: 64, x1: VW - right, y1: VH - (mode === 'live' ? 100 : 60) };
}
function fit() {
  const b = bounds(), A = sceneArea();
  const wpx = (b.x1 - b.x0 + b.z1 - b.z0) * TW / 2, hpx = (b.x1 - b.x0 + b.z1 - b.z0) * TH / 2 + WH * UH;
  const z = Math.max(.75, Math.min(3, Math.min((A.x1 - A.x0 - 80) / wpx, (A.y1 - A.y0 - 60) / hpx)));
  view.z = Math.round(z * 4) / 4;
  view.cx = 0; view.cy = 0; const [sx, sy] = iso((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2, WH / 2);
  view.cx = (A.x0 + A.x1) / 2 - sx; view.cy = (A.y0 + A.y1) / 2 - sy; dirty();
}
function fitIfNeeded() {
  const b = bounds(), A = sceneArea();
  const pts = [iso(b.x0 - 2, b.z0 - 2, WH), iso(b.x1 + 2, b.z0 - 2), iso(b.x0 - 2, b.z1 + 2), iso(b.x1 + 2, b.z1 + 2)];
  if (pts.some(([x, y]) => x < A.x0 || x > A.x1 || y < A.y0 || y > A.y1)) fit();
}
function zoomAt(f, sx, sy) {
  const nz = Math.max(.75, Math.min(4, view.z * f)); if (nz === view.z) return;
  const w = unIso(sx, sy); view.z = nz; const [nx, ny] = iso(w.x, w.z); view.cx += sx - nx; view.cy += sy - ny; dirty();
}
// editor sobre o 3D: câmera (mover, girar, aproximar) é a do 3D
const ed3d = () => !!window.R3D?.editing?.();
function evPos(e) { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
function hitHandle(sx, sy) { if (tab !== 'planta') return null; for (const h of handles()) if (Math.hypot(sx - h.s[0], sy - h.s[1]) <= 17) return h.side; return null; }
function hitPerson(sx, sy) {
  const s = spriteScale(view.z);
  for (const p of [...W.people].reverse()) { const [fx, fy] = iso(p.pos[0], p.pos[1]); if (sx > fx - 6 * s && sx < fx + 6 * s && sy > fy - 27 * s && sy < fy + 3) return p; }
  return null;
}
function inPoly(x, y, pts) { let ins = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi + 1e-9) + xi)) ins = !ins; } return ins; }
function boxHit(b, sx, sy) {
  const P = (X, Z, Y) => iso(X, Z, Y);
  return [
    [P(b.x, b.z, b.y + b.h), P(b.x + b.w, b.z, b.y + b.h), P(b.x + b.w, b.z + b.d, b.y + b.h), P(b.x, b.z + b.d, b.y + b.h)],
    [P(b.x, b.z + b.d, b.y), P(b.x + b.w, b.z + b.d, b.y), P(b.x + b.w, b.z + b.d, b.y + b.h), P(b.x, b.z + b.d, b.y + b.h)],
    [P(b.x + b.w, b.z, b.y), P(b.x + b.w, b.z + b.d, b.y), P(b.x + b.w, b.z + b.d, b.y + b.h), P(b.x + b.w, b.z, b.y + b.h)]].some(f => inPoly(sx, sy, f));
}
// devolve o item mais à frente sob o cursor: {type:'obj'|'wall', id}
function hitAny(sx, sy, only) {
  let best = null, bestKey = -Infinity;
  const test = (b, sel, flat) => { if (boxHit(b, sx, sy)) { const k = b.x + b.w + b.z + b.d + b.y * .1 - (flat ? 100 : 0); if (k > bestKey) { bestKey = k; best = sel; } } };
  if (only !== 'wall') for (const o of W.objects) for (const b of worldBoxes(o)) test(b, { type: 'obj', id: o.id }, ITEMS[o.item].flat);
  if (only !== 'obj') for (const s of W.walls) for (const b of segBoxes(s)) test(b, { type: 'wall', id: s.id }, false);
  return best;
}

cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('wheel', e => { e.preventDefault(); const [sx, sy] = evPos(e); if (ed3d()) R3D.zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, sx, sy); else zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, sx, sy); }, { passive: false });
cv.addEventListener('pointerdown', e => {
  closePop();
  const [sx, sy] = evPos(e), w = unIso(sx, sy);
  hover = w;
  // 3D: botão direito (ou Shift sem nada para arrastar) gira a vista; meio ou espaço move
  if (ed3d() && e.button === 2) { drag = { kind: 'rot', sx }; R3D.rotStart(sx); cv.setPointerCapture(e.pointerId); return; }
  if (e.button === 1 || e.button === 2 || spaceHeld) { drag = { kind: 'pan', sx, sy, cx: view.cx, cy: view.cy }; if (ed3d()) R3D.panStart(sx, sy); cv.setPointerCapture(e.pointerId); return; }
  if (e.button !== 0) return;
  cv.setPointerCapture(e.pointerId);
  if (mode === 'live') {
    const a = hitAgent(sx, sy);
    drag = a ? { kind: 'agent', id: a.id, sx, sy, moved: false, from: [a.x, a.z] } : { kind: 'pan', sx, sy, cx: view.cx, cy: view.cy, click: true };
    return;
  }
  if (placing) {
    const o = { item: placing.item, rot: placing.rot, color: ITEMS[placing.item].color }, [ww, d] = dims(o);
    const at = { x: Math.floor(w.x - ww / 2 + .5), z: Math.floor(w.z - d / 2 + .5) }, res = footprintOk(o, at);
    if (res === 'off') return toast('Esse lugar está fora do piso. Escolha um ponto dentro da sala.');
    if (res.startsWith('overlap')) return toast(`Já tem "${res.slice(8)}" aí. Escolha outro lugar.`);
    const id = nid(placing.item);
    change(() => W.objects.push({ id, item: placing.item, x: at.x, z: at.z, rot: placing.rot }), `${ITEMS[placing.item].n} colocado`);
    if (!e.shiftKey) { placing = null; selected = { type: 'obj', id }; renderBanner(); renderPanel(); renderCtx(); }
    return;
  }
  if (walling) { const a = [Math.round(w.x), Math.round(w.z)]; drag = { kind: 'wall', a, b: a }; dirty(); return; }
  if (tab === 'planta' && tool !== 'select') { drag = { kind: 'stroke', before: snapshot(), warned: false }; paintAt(w); return; }
  const hh = hitHandle(sx, sy); if (hh) { grow(hh, 1); return; }
  const per = hitPerson(sx, sy);
  if (per) { selected = null; renderCtx(); drag = { kind: 'person', id: per.id, sx, sy, moved: false, at: per.pos }; return; }
  const hit = hitAny(sx, sy);
  if (hit) {
    selected = hit; renderCtx();
    const base = hit.type === 'obj' ? objById(hit.id) : null;
    drag = { kind: 'move', sel: hit, start: w, at: base ? { x: base.x, z: base.z } : null, dx: base ? w.x - base.x : 0, dz: base ? w.z - base.z : 0, off: [0, 0], moved: false, sx, sy };
    dirty(); return;
  }
  drag = { kind: 'pan', sx, sy, cx: view.cx, cy: view.cy, click: true };
  if (ed3d()) R3D.panStart(sx, sy);
});
cv.addEventListener('pointermove', e => {
  const [sx, sy] = evPos(e), w = unIso(sx, sy); hover = w;
  hoverHandle = !drag ? hitHandle(sx, sy) : null;
  if (drag?.kind === 'rot') R3D.rotMove(sx);
  else if (drag?.kind === 'pan') { if (ed3d()) R3D.panMove(sx, sy); else { view.cx = drag.cx + sx - drag.sx; view.cy = drag.cy + sy - drag.sy; } if (Math.hypot(sx - drag.sx, sy - drag.sy) > 4) { drag.click = false; if (sim.following) { sim.following = null; teamHTML = ''; renderTeam(); } } }
  else if (drag?.kind === 'person') { if (Math.hypot(sx - drag.sx, sy - drag.sy) > 4) drag.moved = true; if (drag.moved) drag.at = [Math.round(w.x * 4) / 4, Math.round(w.z * 4) / 4]; }
  else if (drag?.kind === 'agent') {
    if (!drag.moved && Math.hypot(sx - drag.sx, sy - drag.sy) > 4) { drag.moved = true; const a = sim.agents.find(q => q.id === drag.id); if (a) { release(a); a.spot = null; a.path = []; a.state = 'idle'; a.held = true; } }
    if (drag.moved) { const a = sim.agents.find(q => q.id === drag.id); if (a) { a.x = w.x; a.z = w.z; } }
  }
  else if (drag?.kind === 'stroke') paintAt(w);
  else if (drag?.kind === 'wall') { const c = [Math.round(w.x), Math.round(w.z)]; drag.b = Math.abs(c[0] - drag.a[0]) >= Math.abs(c[1] - drag.a[1]) ? [c[0], drag.a[1]] : [drag.a[0], c[1]]; }
  else if (drag?.kind === 'move') {
    if (Math.hypot(sx - drag.sx, sy - drag.sy) > 4) drag.moved = true;
    if (drag.moved) {
      if (drag.sel.type === 'obj') drag.at = { x: Math.round(w.x - drag.dx), z: Math.round(w.z - drag.dz) };
      else drag.off = [Math.round(w.x - drag.start.x), Math.round(w.z - drag.start.z)];
    }
  }
  updateCursor(sx, sy); dirty();
});
function endDrag() {
  if (!drag) return;
  const d = drag; drag = null;
  if (d.kind === 'rot') { R3D.rotEnd(); return; }
  if (d.kind === 'pan' && d.click && selected) { selected = null; renderCtx(); }
  if (d.kind === 'pan' && d.click && mode === 'live' && sim.inspect) closeFicha();
  if (d.kind === 'person') {
    const p = W.people.find(q => q.id === d.id);
    if (!d.moved) { editing = d.id; if (tab !== 'pessoas') setTab('pessoas'); else renderPanel(); editing = d.id; renderPanel(); }
    else if (freePoint(d.at[0], d.at[1])) change(() => { W.people.find(q => q.id === d.id).pos = d.at; }, `${p.name} mudou de lugar`);
    else toast('Esse lugar está ocupado por um móvel ou parede. Solte num espaço livre do piso.');
  }
  if (d.kind === 'agent') {
    const a = sim.agents.find(q => q.id === d.id), p = W.people.find(q => q.id === d.id);
    if (a && !d.moved) { if (sim.inspect === a.id) closeFicha(); else openFicha(a.id); }
    else if (a) {
      a.held = false;
      if (freePoint(a.x, a.z, NAV.sol)) { a.pinned = true; a.mv = 'act'; histPush(a, { text: 'Movido por você e fixado neste lugar', auto: true }); toast(`${p.name} vai ficar aqui. Para voltar à rotina, use o botão na lista.`); }
      else { a.x = d.from[0]; a.z = d.from[1]; a.state = 'idle'; a.t = .5; toast('Esse lugar está ocupado. A pessoa voltou para onde estava.'); }
      teamHTML = ''; renderTeam();
    }
  }
  if (d.kind === 'stroke') pushBefore(d.before, tool === 'add' ? 'Piso acrescentado' : tool === 'remove' ? 'Piso removido' : 'Piso trocado nessa área');
  if (d.kind === 'wall') {
    const s = { id: nid('parede'), kind: walling.kind, a: d.a, b: d.b }, prob = wallProblem(s);
    if (prob) toast(prob);
    else change(() => W.walls.push(s), `${WALLKINDS[s.kind].n} criada`);
  }
  if (d.kind === 'move' && d.moved) {
    if (d.sel.type === 'obj') {
      const o = objById(d.sel.id), res = footprintOk(o, d.at, o.id);
      if (res === 'ok') change(() => { const q = objById(d.sel.id); q.x = d.at.x; q.z = d.at.z; }, 'Movido');
      else toast(res === 'off' ? 'Não dá para soltar fora do piso. Voltou para onde estava.' : `Já tem "${res.slice(8)}" ali. Voltou para onde estava.`);
    } else {
      const s = wallById(d.sel.id), m = { ...s, a: [s.a[0] + d.off[0], s.a[1] + d.off[1]], b: [s.b[0] + d.off[0], s.b[1] + d.off[1]] }, prob = wallProblem(m, s.id);
      if (!prob) change(() => { const q = wallById(d.sel.id); q.a = m.a; q.b = m.b; }, 'Movida');
      else toast(prob + '. Voltou para onde estava.');
    }
  }
  dirty();
}
cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', endDrag);
cv.addEventListener('pointerleave', () => { if (!drag) { hover = null; hoverHandle = null; dirty(); } });
function paintAt(w) {
  const x = Math.floor(w.x), z = Math.floor(w.z), k = key(x, z);
  if (tool === 'add') {
    if (W.tiles[k]) return; const next = { ...W.tiles, [k]: W.floorMat || 'lilas' };
    if (!spanOk(next)) { if (!drag.warned) { toast(`Tamanho máximo: ${MAXS} × ${MAXS} quadrados`); drag.warned = true; } return; }
    W.tiles = next;
  } else if (tool === 'remove') {
    if (!W.tiles[k] || Object.keys(W.tiles).length <= 4) return; delete W.tiles[k];
  } else if (tool === 'mat') { if (W.tiles[k] && W.tiles[k] !== brushMat) W.tiles[k] = brushMat; }
  dirty();
}
function updateCursor(sx, sy) {
  let c = 'grab';
  if (drag?.kind === 'pan') c = 'grabbing';
  else if (drag?.kind === 'move') c = 'move';
  else if (placing || walling || (tab === 'planta' && tool !== 'select')) c = 'crosshair';
  else if (drag?.kind === 'person' || drag?.kind === 'agent') c = 'grabbing';
  else if (mode === 'live') c = hitAgent(sx, sy) ? 'pointer' : 'grab';
  else if (hoverHandle || hitPerson(sx, sy) || hitAny(sx, sy)) c = 'pointer';
  cv.style.cursor = c;
}

window.addEventListener('keydown', e => {
  const typing = e.target.matches('input, textarea, select');
  const k = e.key.toLowerCase();
  if (k === 'escape') { cancelModes(); return; }
  if (typing) return;
  if (mode === 'live') { if (e.code === 'Space') { e.preventDefault(); sim.playing = !sim.playing; updatePlayer(); } return; }
  if (e.code === 'Space') { spaceHeld = true; e.preventDefault(); return; }
  if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); redo(); return; }
  if ((e.ctrlKey || e.metaKey) && k === 'd') { e.preventDefault(); duplicate(); return; }
  if (k === 'r') { rotate(); return; }
  if (k === 'delete' || k === 'backspace') { removeSelected(); return; }
});
window.addEventListener('keyup', e => { if (e.code === 'Space') spaceHeld = false; });
let rsT = null; window.addEventListener('resize', () => { resize(); clearTimeout(rsT); rsT = setTimeout(fit, 120); });

function cancelModes() {
  if (popMode) { closePop(); return; }
  if (mode === 'live' && sim.inspect) { closeFicha(); return; }
  placing = null; walling = null; picking = null; drag = null;
  if (tab === 'planta') tool = 'select';
  selected = null; renderBanner(); renderPanel(); renderCtx(); dirty();
}
function rotate() {
  if (placing) { placing.rot = (placing.rot + 1) % 4; dirty(); return; }
  if (selected?.type !== 'obj') return;
  const o = objById(selected.id), test = { ...o, rot: (o.rot + 1) % 4 }, res = footprintOk(test, { x: o.x, z: o.z }, o.id);
  if (res !== 'ok') return toast(res === 'off' ? 'Girado ele sairia do piso. Mova para um lugar com mais espaço.' : `Girado ele ficaria em cima de "${res.slice(8)}"`);
  change(() => { objById(selected.id).rot = test.rot; }, 'Girado');
}
function duplicate() {
  if (selected?.type !== 'obj') return;
  const o = objById(selected.id), [w, d] = dims(o);
  for (const [dx, dz] of [[w, 0], [0, d], [-w, 0], [0, -d], [w, d], [-w, -d]]) {
    const at = { x: o.x + dx, z: o.z + dz };
    if (footprintOk(o, at) === 'ok') { const id = nid(o.item); change(() => W.objects.push({ ...o, id, x: at.x, z: at.z }), 'Duplicado ao lado'); selected = { type: 'obj', id }; renderCtx(); return; }
  }
  toast('Sem espaço livre ao lado para duplicar');
}
function removeSelected() {
  if (!selected) return;
  if (selected.type === 'obj') {
    const id = selected.id, name = ITEMS[objById(id).item].n;
    change(() => { W.objects = W.objects.filter(o => o.id !== id); }, `${name} apagado`);
  } else { const id = selected.id, name = WALLKINDS[wallById(id).kind].n; change(() => { W.walls = W.walls.filter(s => s.id !== id); }, `${name} apagada`); }
  selected = null; renderCtx();
}
