'use strict';

let needs = true; function dirty() { needs = true; }
let lastT = performance.now();
function frame(now) {
  const dt = Math.min(.1, (now - lastT) / 1000); lastT = now;
  if (mode === 'live') simStep(dt);
  doorStep(dt);
  ambUpdate();
  // com o 3D ligado (modo ao vivo), quem desenha é web/js3d/cena3d.js
  if (!(window.R3D && window.R3D.active())) draw(now / 1000);

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

  // grade de expansão (mostra até onde dá para crescer)
  if (mode === 'build' && (tab === 'planta' || walling)) {
    const span = 5, gx0 = bd.x0 - span, gx1 = bd.x1 + span, gz0 = bd.z0 - span, gz1 = bd.z1 + span;
    ctx.fillStyle = 'rgba(140,79,224,0.28)';
    const ds = Math.max(1, Math.round(V.z));
    for (let x = gx0; x <= gx1; x++) for (let z = gz0; z <= gz1; z++) { const q = iso(x, z); ctx.fillRect(q[0] - ds / 2, q[1] - ds / 2, ds + 1, ds); }
  }
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

  // marcação no piso: seleção, mesas livres (escolha de mesa), avisos
  const warnIds = new Set(mode === 'build' ? cachedWarnings().filter(w => w.sel).map(w => w.sel.id) : []);
  for (const o of W.objects) {
    const [w, d] = dims(o); let col = null;
    if (warnIds.has(o.id)) col = 'rgba(224,71,59,';
    if (selected?.type === 'obj' && selected.id === o.id) col = 'rgba(140,79,224,';
    if (col) { poly(ctx, footPoly(o.x, o.z, w, d), col + '0.28)'); ctx.setLineDash([4, 3]); poly(ctx, footPoly(o.x, o.z, w, d), null, col + '0.95)', 2); ctx.setLineDash([]); }
  }
  for (const s of W.walls) {
    const sel = selected?.type === 'wall' && selected.id === s.id; if (!sel && !warnIds.has(s.id)) continue;
    const I = segInfo(s), col = sel ? '#8C4FE0' : '#E0473B';
    const fp = I.alongX ? footPoly(I.u0, I.c - .25, I.len, .5) : footPoly(I.c - .25, I.u0, .5, I.len);
    poly(ctx, fp, rgba(col, .25), col, 2);
  }

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

  // item sendo arrastado
  if (drag?.kind === 'move' && drag.moved) {
    if (drag.sel.type === 'obj') {
      const o = objById(drag.sel.id), ok = footprintOk(o, drag.at, o.id) === 'ok', [w, d] = dims(o);
      poly(ctx, footPoly(drag.at.x, drag.at.z, w, d), ok ? 'rgba(47,122,62,0.3)' : 'rgba(224,71,59,0.35)', ok ? '#2F7A3E' : '#E0473B', 2);
      for (const b of depthSort(worldBoxes(o, drag.at), V)) drawBox(ctx, b, V, .85);
    } else {
      const s = wallById(drag.sel.id), m = { ...s, a: [s.a[0] + drag.off[0], s.a[1] + drag.off[1]], b: [s.b[0] + drag.off[0], s.b[1] + drag.off[1]] }, ok = !wallProblem(m, s.id);
      const I = segInfo(m); poly(ctx, I.alongX ? footPoly(I.u0, I.c - .25, I.len, .5) : footPoly(I.c - .25, I.u0, .5, I.len), ok ? 'rgba(47,122,62,0.3)' : 'rgba(224,71,59,0.35)');
      for (const b of depthSort(segBoxes(m), V)) drawBox(ctx, b, V, .85);
    }
  } else if (drag?.kind === 'move') {
    const target = drag.sel.type === 'obj' ? depthSort(worldBoxes(objById(drag.sel.id)), V) : depthSort(segBoxes(wallById(drag.sel.id)), V);
    for (const b of target) drawBox(ctx, b, V);
  }
  // fantasma do móvel sendo colocado
  if (placing && hover) {
    const o = { item: placing.item, rot: placing.rot, color: ITEMS[placing.item].color }, [w, d] = dims(o);
    const at = { x: Math.floor(hover.x - w / 2 + .5), z: Math.floor(hover.z - d / 2 + .5) };
    const ok = footprintOk(o, at) === 'ok';
    poly(ctx, footPoly(at.x, at.z, w, d), ok ? 'rgba(47,122,62,0.3)' : 'rgba(224,71,59,0.35)', ok ? '#2F7A3E' : '#E0473B', 2);
    for (const b of depthSort(worldBoxes(o, at), V)) drawBox(ctx, b, V, .75);
  }
  // parede sendo desenhada
  const gw = wallGhost();
  if (gw) {
    const prob = wallProblem(gw), I = segInfo(gw);
    if (I.len > 0) {
      poly(ctx, I.alongX ? footPoly(I.u0, I.c - .25, I.len, .5) : footPoly(I.c - .25, I.u0, .5, I.len), prob ? 'rgba(224,71,59,0.3)' : 'rgba(47,122,62,0.3)');
      for (const b of depthSort(segBoxes(gw), V)) drawBox(ctx, b, V, .85);
      const mid = iso(I.alongX ? (I.u0 + I.u1) / 2 : I.c, I.alongX ? I.c : (I.u0 + I.u1) / 2, WH + .5);
      const label = `${I.len} ${I.len === 1 ? 'quadrado' : 'quadrados'}`;
      ctx.font = '600 12px "IBM Plex Sans", system-ui, sans-serif'; const tw = ctx.measureText(label).width;
      ctx.fillStyle = prob ? '#B3261E' : '#24252B'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(mid[0] - tw / 2 - 7, mid[1] - 11, tw + 14, 21, 6) : ctx.rect(mid[0] - tw / 2 - 7, mid[1] - 11, tw + 14, 21); ctx.fill();
      ctx.fillStyle = '#FFFFFF'; ctx.textBaseline = 'middle'; ctx.fillText(label, mid[0] - tw / 2, mid[1]);
    }
  }
  if (walling && hover && !drag) {
    const q = iso(Math.round(hover.x), Math.round(hover.z));
    ctx.fillStyle = '#8C4FE0'; ctx.beginPath(); ctx.arc(q[0], q[1], 4 + V.z, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 2; ctx.stroke();
  }
  // pincel de piso
  if (tab === 'planta' && hover && ['add', 'remove', 'mat'].includes(tool)) {
    const x = Math.floor(hover.x), z = Math.floor(hover.z), col = tool === 'remove' ? 'rgba(224,71,59,0.4)' : tool === 'mat' ? 'rgba(140,79,224,0.4)' : 'rgba(47,95,208,0.35)';
    poly(ctx, footPoly(x, z, 1, 1, .03), col, '#24252B', 1.5);
  }
  // alças "+" nas bordas
  if (mode === 'build' && tab === 'planta' && !drag) {
    for (const h of handles()) {
      const r = 14, hot = hoverHandle === h.side;
      ctx.fillStyle = 'rgba(36,37,43,0.14)'; ctx.beginPath(); ctx.arc(h.s[0], h.s[1] + 2, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = hot ? '#8C4FE0' : '#FFFFFF'; ctx.strokeStyle = '#8C4FE0'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(h.s[0], h.s[1], r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = hot ? '#FFFFFF' : '#8C4FE0'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(h.s[0] - 6, h.s[1]); ctx.lineTo(h.s[0] + 6, h.s[1]); ctx.moveTo(h.s[0], h.s[1] - 6); ctx.lineTo(h.s[0], h.s[1] + 6); ctx.stroke(); ctx.lineCap = 'butt';
      if (hot) {
        ctx.font = '600 12px "IBM Plex Sans", system-ui, sans-serif'; const tw = ctx.measureText(h.label).width;
        ctx.fillStyle = '#24252B'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(h.s[0] - tw / 2 - 7, h.s[1] - r - 28, tw + 14, 21, 6) : ctx.rect(h.s[0] - tw / 2 - 7, h.s[1] - r - 28, tw + 14, 21); ctx.fill();
        ctx.fillStyle = '#FFFFFF'; ctx.textBaseline = 'middle'; ctx.fillText(h.label, h.s[0] - tw / 2, h.s[1] - r - 17);
      }
      ctx.lineWidth = 1;
    }
  }
}
