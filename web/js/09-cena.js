'use strict';

let needs = true; function dirty() { needs = true; }
let lastT = performance.now();
function frame(now) {
  const dt = Math.min(.1, (now - lastT) / 1000); lastT = now;
  if (mode === 'live') simStep(dt);
  doorStep(dt);
  ambUpdate();
  // com o 3D ligado, quem desenha a sala é web/js3d/cena3d.js; no modo Construir, este canvas (transparente,
  // por cima) desenha só as marcas do editor, projetadas pela câmera 3D
  if (!(window.R3D && window.R3D.active())) draw(now / 1000);
  else if (mode === 'build') drawOverlay3D(now / 1000);

  requestAnimationFrame(frame);
}
function draw(T = performance.now() / 1000) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const bg = ctx.createRadialGradient(VW * .55, VH * .45, 0, VW * .55, VH * .45, Math.max(VW, VH) * .75);
  bg.addColorStop(0, '#F2F1F4'); bg.addColorStop(1, '#E1DFE4');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, VW, VH);
  ctx.imageSmoothingEnabled = false;
  const V = view, bd = bounds();
  const tiles = Object.entries(W.tiles).map(([k, m]) => { const [x, z] = k.split(',').map(Number); return { x, z, m }; }).sort((a, b) => (a.x + a.z) - (b.x + b.z));
  const has = (x, z) => !!W.tiles[key(x, z)];

  drawGrid(V, bd);
  // sombra suave sob a sala e laje
  poly(ctx, [iso(bd.x0 + .4, bd.z1 + .9, -.45), iso(bd.x1 + .9, bd.z1 + .9, -.45), iso(bd.x1 + .9, bd.z0 + .4, -.45), iso(bd.x1, bd.z0, -.45), iso(bd.x0, bd.z1, -.45)], 'rgba(60,50,70,0.07)');
  for (const t of tiles) {
    if (!has(t.x, t.z + 1)) poly(ctx, [iso(t.x, t.z + 1), iso(t.x + 1, t.z + 1), iso(t.x + 1, t.z + 1, -.45), iso(t.x, t.z + 1, -.45)], '#D3C9CE', '#BDB1B7');
    if (!has(t.x + 1, t.z)) poly(ctx, [iso(t.x + 1, t.z), iso(t.x + 1, t.z + 1), iso(t.x + 1, t.z + 1, -.45), iso(t.x + 1, t.z, -.45)], '#BBAEB4', '#A69AA0');
  }
  for (const t of tiles) drawTile(ctx, t.x, t.z, t.m, V);
  // oclusão no pé das paredes do fundo
  for (const t of tiles) {
    if (!has(t.x, t.z - 1)) poly(ctx, [iso(t.x, t.z), iso(t.x + 1, t.z), iso(t.x + 1, t.z + .35), iso(t.x, t.z + .35)], 'rgba(50,40,60,0.07)');
    if (!has(t.x - 1, t.z)) poly(ctx, [iso(t.x, t.z), iso(t.x, t.z + 1), iso(t.x + .35, t.z + 1), iso(t.x + .35, t.z)], 'rgba(50,40,60,0.06)');
  }
  // paredes do perímetro (fundo), com rodapé e acabamento no topo
  const wc = W.wall;
  for (const t of tiles) {
    if (!has(t.x, t.z - 1)) {
      const q = [iso(t.x, t.z), iso(t.x + 1, t.z), iso(t.x + 1, t.z, WH), iso(t.x, t.z, WH)];
      const g = ctx.createLinearGradient(0, q[3][1], 0, q[0][1]); g.addColorStop(0, shade(faceR(wc), 1.12)); g.addColorStop(1, faceR(wc));
      poly(ctx, q, g); poly(ctx, [iso(t.x, t.z), iso(t.x + 1, t.z), iso(t.x + 1, t.z, .14), iso(t.x, t.z, .14)], shade(faceR(wc), .82));
    }
    if (!has(t.x - 1, t.z)) {
      const q = [iso(t.x, t.z), iso(t.x, t.z + 1), iso(t.x, t.z + 1, WH), iso(t.x, t.z, WH)];
      const g = ctx.createLinearGradient(0, q[3][1], 0, q[0][1]); g.addColorStop(0, shade(faceL(wc), 1.1)); g.addColorStop(1, faceL(wc));
      poly(ctx, q, g); poly(ctx, [iso(t.x, t.z), iso(t.x, t.z + 1), iso(t.x, t.z + 1, .14), iso(t.x, t.z, .14)], shade(faceL(wc), .82));
    }
  }
  for (const t of tiles) {
    const lw = Math.max(2, Math.round(V.z * 2));
    if (!has(t.x, t.z - 1)) line(ctx, iso(t.x, t.z, WH), iso(t.x + 1, t.z, WH), shade(wc, 1.14), lw);
    if (!has(t.x - 1, t.z)) line(ctx, iso(t.x, t.z, WH), iso(t.x, t.z + 1, WH), shade(wc, 1.14), lw);
  }

  // sombras de contato sob móveis e paredes internas
  const sh = 'rgba(40,30,50,0.10)';
  for (const o of W.objects) {
    if (ITEMS[o.item].flat || (drag?.kind === 'move' && drag.sel.id === o.id)) continue;
    const [w, d] = dims(o); poly(ctx, footPoly(o.x + .06, o.z + .1, w, d, .01), sh);
  }
  for (const s of W.walls) {
    if (drag?.kind === 'move' && drag.sel.id === s.id) continue;
    const I = segInfo(s); if (I.alongX) poly(ctx, footPoly(I.u0, I.c, I.len, .35, .01), sh); else poly(ctx, footPoly(I.c, I.u0, .35, I.len, .01), sh);
  }

  drawMarks();
  // objetos, paredes internas e pessoas, em ordem de profundidade
  const items = [];
  ACTIVE = computeActive();
  for (const o of W.objects) { if (drag?.kind === 'move' && drag.sel.id === o.id) continue; for (const b of worldBoxes(o)) items.push(animBox(b, T)); }
  for (const s of W.walls) { if (drag?.kind === 'move' && drag.sel.id === s.id) continue; for (const b of segBoxes(s, null, DOORS.get(s.id) || 0)) items.push(b); }
  for (const it of peopleDrawables(T)) items.push(it);
  const sorted = depthSort(items, V);
  for (const it of sorted) {
    if (it.person) drawPerson(ctx, it.person, V, { ...it.opts, layer: 'body' });
    else { drawBox(ctx, it, V); if (it.screen) drawScreen(ctx, it, V, T); }
  }
  // luz ambiente do horário: escurece/aquece a cena; as luzes acesas brilham por cima
  if (!AMB.white) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = AMB.tint; ctx.fillRect(0, 0, cv.width, cv.height); ctx.restore(); }
  if (AMB.k > 1.05) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (const it of sorted) if (it.g) drawGlow(ctx, it, V, (AMB.k - 1) * .35); ctx.restore(); }
  for (const it of sorted) if (it.g) drawGlow(ctx, it, V, AMB.k);
  for (const it of sorted) if (it.person && (it.opts?.label || it.opts?.icon)) drawPerson(ctx, it.person, V, { ...it.opts, layer: 'tag' });
  for (const it of sorted) if (it.steam && ACTIVE.has(it.obj)) drawSteam(ctx, it, V, T);

  drawEditing(T, V);
}

// ---------- marcas do editor ----------
/* Uma lista só, em coordenadas da sala, que dois desenhistas usam: o 3D (web/js3d/cena3d.js, malhas no piso, com
   profundidade: móvel na frente esconde a marca) e o 2D de reserva (sem WebGL). Itens:
   {k:'quad', x, z, w, d, fill, a, line, dash, y}  área no piso (cor de preenchimento, opacidade, borda opcional)
   {k:'dot', x, z, c, r}                            ponto no piso (grade de expansão, ponta da parede)
   {k:'handle', x, z, hot, side, label}             alça "+" para aumentar a sala
   {k:'label', x, z, y, text, bad}                  etiqueta de texto (fica numa camada de texto por cima, como os nomes) */
const MK = { sel: '#8C4FE0', bad: '#E0473B', ok: '#2F7A3E', add: '#2F5FD0', ink: '#24252B' };
function wallQuad(s, fill, a, line) { const I = segInfo(s); return I.alongX ? { k: 'quad', x: I.u0, z: I.c - .25, w: I.len, d: .5, fill, a, line } : { k: 'quad', x: I.c - .25, z: I.u0, w: .5, d: I.len, fill, a, line }; }
function editorMarks() {
  const out = [];
  if (mode !== 'build') return out;
  const bd = bounds();
  // grade de expansão (mostra até onde dá para crescer)
  if (tab === 'planta' || walling) {
    const span = 5;
    for (let x = bd.x0 - span; x <= bd.x1 + span; x++) for (let z = bd.z0 - span; z <= bd.z1 + span; z++) out.push({ k: 'dot', x, z, c: MK.sel, r: .05, a: .45 });
  }
  // seleção e avisos
  const warnIds = new Set(cachedWarnings().filter(w => w.sel).map(w => w.sel.id));
  for (const o of W.objects) {
    if (drag?.kind === 'move' && drag.moved && drag.sel.id === o.id) continue;
    const sel = selected?.type === 'obj' && selected.id === o.id; if (!sel && !warnIds.has(o.id)) continue;
    const [w, d] = dims(o), c = sel ? MK.sel : MK.bad;
    out.push({ k: 'quad', x: o.x, z: o.z, w, d, fill: c, a: .28, line: c, dash: true });
  }
  for (const s of W.walls) {
    const sel = selected?.type === 'wall' && selected.id === s.id; if (!sel && !warnIds.has(s.id)) continue;
    const c = sel ? MK.sel : MK.bad; out.push(wallQuad(s, c, .25, c));
  }
  // item sendo arrastado: verde cabe, vermelho não
  if (drag?.kind === 'move' && drag.moved) {
    if (drag.sel.type === 'obj') {
      const o0 = objById(drag.sel.id), o = { ...o0, rot: drag.rot ?? o0.rot }, ok = footprintOk(o, drag.at, o.id) === 'ok', [w, d] = dims(o);
      out.push({ k: 'quad', x: drag.at.x, z: drag.at.z, w, d, fill: ok ? MK.ok : MK.bad, a: .32, line: ok ? MK.ok : MK.bad });
    } else {
      const s = wallById(drag.sel.id), m = { ...s, a: [s.a[0] + drag.off[0], s.a[1] + drag.off[1]], b: [s.b[0] + drag.off[0], s.b[1] + drag.off[1]] }, ok = !wallProblem(m, s.id);
      out.push(wallQuad(m, ok ? MK.ok : MK.bad, .32));
    }
  }
  // móvel sendo colocado
  if (placing && hover) {
    const o = { item: placing.item, rot: placing.rot, color: ITEMS[placing.item].color }, at = placeAt(o, hover), [w, d] = dims(o), ok = footprintOk(o, at) === 'ok';
    out.push({ k: 'quad', x: at.x, z: at.z, w, d, fill: ok ? MK.ok : MK.bad, a: .32, line: ok ? MK.ok : MK.bad });
  }
  // parede sendo desenhada, com o tamanho
  const gw = wallGhost();
  if (gw) {
    const prob = wallProblem(gw), I = segInfo(gw);
    if (I.len > 0) {
      out.push(wallQuad(gw, prob ? MK.bad : MK.ok, .3));
      out.push({ k: 'label', x: I.alongX ? (I.u0 + I.u1) / 2 : I.c, z: I.alongX ? I.c : (I.u0 + I.u1) / 2, y: WH + .5, text: `${I.len} ${I.len === 1 ? 'quadrado' : 'quadrados'}`, bad: !!prob });
    }
  }
  if (walling && hover && !drag) out.push({ k: 'dot', x: Math.round(hover.x), z: Math.round(hover.z), c: MK.sel, r: .16, a: 1, ring: true });
  // pincel de piso
  if (tab === 'planta' && hover && ['add', 'remove', 'mat'].includes(tool)) {
    out.push({ k: 'quad', x: Math.floor(hover.x), z: Math.floor(hover.z), w: 1, d: 1, fill: tool === 'remove' ? MK.bad : tool === 'mat' ? MK.sel : MK.add, a: .4, line: MK.ink, y: .03 });
  }
  // alças "+" nas bordas
  if (tab === 'planta' && !drag) for (const h of handles()) out.push({ k: 'handle', x: h.x, z: h.z, side: h.side, hot: hoverHandle === h.side, label: h.label });
  return out;
}
function pillLabel(text, sx, sy, bg) {
  ctx.font = '600 12px "IBM Plex Sans", system-ui, sans-serif'; const tw = ctx.measureText(text).width;
  ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(sx - tw / 2 - 7, sy - 11, tw + 14, 21, 6) : ctx.rect(sx - tw / 2 - 7, sy - 11, tw + 14, 21); ctx.fill();
  ctx.fillStyle = '#FFFFFF'; ctx.textBaseline = 'middle'; ctx.fillText(text, sx - tw / 2, sy);
}
// textos das marcas (no 3D só eles ficam neste canvas; o resto é malha na cena)
function drawMarkLabels(list) {
  for (const m of list) {
    if (m.k === 'label') { const q = iso(m.x, m.z, m.y); pillLabel(m.text, q[0], q[1], m.bad ? '#B3261E' : MK.ink); }
    if (m.k === 'handle' && m.hot) { const q = iso(m.x, m.z, 0); pillLabel(m.label, q[0], q[1] - 31, MK.ink); }
  }
}
// desenho 2D de reserva (sem WebGL)
function drawMarks2D(list, V = view) {
  for (const m of list) {
    if (m.k === 'quad') {
      const fp = footPoly(m.x, m.z, m.w, m.d, m.y ?? .02);
      if (m.dash) { poly(ctx, fp, rgba(m.fill, m.a)); ctx.setLineDash([4, 3]); poly(ctx, fp, null, rgba(m.line, .95), 2); ctx.setLineDash([]); }
      else poly(ctx, fp, rgba(m.fill, m.a), m.line || null, m.line ? 2 : 1);
    } else if (m.k === 'dot') {
      const q = iso(m.x, m.z);
      if (m.ring) { ctx.fillStyle = m.c; ctx.beginPath(); ctx.arc(q[0], q[1], 4 + V.z, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 2; ctx.stroke(); ctx.lineWidth = 1; }
      else { const ds = Math.max(1, Math.round(V.z)); ctx.fillStyle = rgba(m.c, .28); ctx.fillRect(q[0] - ds / 2, q[1] - ds / 2, ds + 1, ds); }
    } else if (m.k === 'handle') {
      const [x, y] = iso(m.x, m.z, 0), r = 14;
      ctx.fillStyle = 'rgba(36,37,43,0.14)'; ctx.beginPath(); ctx.arc(x, y + 2, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = m.hot ? MK.sel : '#FFFFFF'; ctx.strokeStyle = MK.sel; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = m.hot ? '#FFFFFF' : MK.sel; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.lineTo(x + 6, y); ctx.moveTo(x, y - 6); ctx.lineTo(x, y + 6); ctx.stroke(); ctx.lineCap = 'butt'; ctx.lineWidth = 1;
    }
  }
  drawMarkLabels(list);
}
function drawGrid() {} // a grade agora faz parte de editorMarks()
function drawMarks() {}
function drawEditing(T, V = view) {
  // 2D de reserva: o móvel/parede fantasma em caixas, depois as marcas
  if (drag?.kind === 'move' && drag.moved) {
    if (drag.sel.type === 'obj') { const o0 = objById(drag.sel.id), o = { ...o0, rot: drag.rot ?? o0.rot }; for (const b of depthSort(worldBoxes(o, drag.at), V)) drawBox(ctx, b, V, .85); }
    else { const s = wallById(drag.sel.id), m = { ...s, a: [s.a[0] + drag.off[0], s.a[1] + drag.off[1]], b: [s.b[0] + drag.off[0], s.b[1] + drag.off[1]] }; for (const b of depthSort(segBoxes(m), V)) drawBox(ctx, b, V, .85); }
  } else if (drag?.kind === 'move') {
    const target = drag.sel.type === 'obj' ? depthSort(worldBoxes(objById(drag.sel.id)), V) : depthSort(segBoxes(wallById(drag.sel.id)), V);
    for (const b of target) drawBox(ctx, b, V);
  }
  if (placing && hover) { const o = { item: placing.item, rot: placing.rot, color: ITEMS[placing.item].color }, at = placeAt(o, hover); for (const b of depthSort(worldBoxes(o, at), V)) drawBox(ctx, b, V, .75); }
  const gw = wallGhost(); if (gw && segInfo(gw).len > 0) for (const b of depthSort(segBoxes(gw), V)) drawBox(ctx, b, V, .85);
  drawMarks2D(editorMarks(), V);
}
// modo Construir com o 3D: as marcas são malhas na cena 3D; este canvas transparente fica só com os textos
function drawOverlay3D(T) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, VW, VH); ctx.imageSmoothingEnabled = false;
  drawMarkLabels(editorMarks());
}
