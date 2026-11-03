'use strict';

/* ---------- Miniaturas ---------- */
// miniaturas geradas na resolução real da tela (sem esticar depois)
const TS = Math.max(2, Math.min(4, Math.ceil((window.devicePixelRatio || 1) * 1.4)));
function thumbOf(boxes, wpx, hpx) {
  wpx *= TS; hpx *= TS;
  const c = document.createElement('canvas'); c.width = wpx; c.height = hpx; const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  const x0 = Math.min(...boxes.map(b => b.x)), z0 = Math.min(...boxes.map(b => b.z)), x1 = Math.max(...boxes.map(b => b.x + b.w)), z1 = Math.max(...boxes.map(b => b.z + b.d));
  const top = Math.max(...boxes.map(b => b.y + b.h)), W2 = x1 - x0, D2 = z1 - z0;
  const zf = Math.min((wpx - 16 * TS) / ((W2 + D2) * TW / 2), (hpx - 14 * TS) / ((W2 + D2) * TH / 2 + top * UH));
  const V = { z: zf, cx: 0, cy: 0 };
  const [mx, my] = iso(x0 + W2 / 2, z0 + D2 / 2, top / 2, V); V.cx = wpx / 2 - mx; V.cy = hpx / 2 - my;
  g.fillStyle = 'rgba(40,30,50,0.10)'; poly(g, [iso(x0 + .05, z0 + .1, 0, V), iso(x1 + .05, z0 + .1, 0, V), iso(x1 + .05, z1 + .1, 0, V), iso(x0 + .05, z1 + .1, 0, V)], 'rgba(40,30,50,0.10)');
  const sorted = depthSort(boxes, V); for (const b of sorted) drawBox(g, b, V); for (const b of sorted) if (b.g) drawGlow(g, b, V);
  return c.toDataURL();
}
function matThumb(m) {
  const c = document.createElement('canvas'); c.width = 96 * TS; c.height = 72 * TS; const g = c.getContext('2d');
  const V = { z: TS, cx: 48 * TS, cy: 12 * TS };
  for (let x = 0; x < 3; x++) for (let z = 0; z < 3; z++) drawTile(g, x, z, m, V);
  return c.toDataURL();
}
const THUMBS = {};
for (const k in ITEMS) { const it = ITEMS[k]; THUMBS[k] = thumbOf(worldBoxes({ item: k, rot: 0, x: 0, z: 0, color: it.color }), 120, 90); }
for (const k in WALLKINDS) THUMBS['w:' + k] = thumbOf(segBoxes({ id: 't', kind: k, a: [0, 0], b: [3, 0] }), 120, 90);
const MTHUMBS = {}; for (const k in MATS) MTHUMBS[k] = matThumb(k);
