'use strict';

/* ---------- Desenho ---------- */
function hexRgb(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgbHex(r, g, b) { const c = v => Math.max(0, Math.min(255, Math.round(v))); return '#' + ((1 << 24) | (c(r) << 16) | (c(g) << 8) | c(b)).toString(16).slice(1); }
function shade(hex, f) { const [r, g, b] = hexRgb(hex); return rgbHex(r * f, g * f, b * f); }
function mix(hex, hex2, t) { const a = hexRgb(hex), b = hexRgb(hex2); return rgbHex(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t); }
function rgba(hex, a) { const [r, g, b] = hexRgb(hex); return `rgba(${r},${g},${b},${a})`; }
// luz vinda do fundo à esquerda: face esquerda levemente fria, face direita mais escura e quente
const faceL = c => mix(shade(c, .86), '#5C6C9E', .08), faceR = c => mix(shade(c, .7), '#4A3550', .1);
function poly(c, pts, fill, stroke, lw = 1) {
  c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath();
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); }
}
function line(c, a, b, col, lw = 1) { c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
function hash(x, z) { let h = (x * 374761393 + z * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function drawTile(c, x, z, m, V) {
  const M = MATS[m] || MATS.lilas, p = (X, Z) => iso(X, Z, 0, V);
  const corners = [p(x, z), p(x + 1, z), p(x + 1, z + 1), p(x, z + 1)];
  let base = M.b;
  if (M.k === 'checker' || M.k === 'tile') base = (x + z) % 2 === 0 ? M.b : M.a;
  else base = mix(M.b, M.a, hash(x, z) * .8);
  poly(c, corners, base);
  c.strokeStyle = M.l; c.lineWidth = 1;
  if (M.k === 'wood') {
    const off = hash(x, z) * .6 + .2;
    for (const t of [1 / 3, 2 / 3]) line(c, p(x, z + t), p(x + 1, z + t), M.l);
    line(c, p(x + off, z), p(x + off, z + 1 / 3), M.l);
    line(c, p(x + ((off + .5) % 1), z + 2 / 3), p(x + ((off + .5) % 1), z + 1), M.l);
    line(c, p(x + ((off + .3) % 1), z + 1 / 3), p(x + ((off + .3) % 1), z + 2 / 3), M.l);
  } else if (M.k === 'speck') {
    c.fillStyle = M.l; const s = Math.max(1, Math.round(V.z * .8));
    for (let i = 0; i < 4; i++) { const q = p(x + .12 + hash(x + i * 7, z) * .76, z + .12 + hash(x, z + i * 13) * .76); c.fillRect(q[0], q[1], s, s); }
  } else if (M.k === 'tile') {
    const q = p(x + .5, z + .5); c.fillStyle = rgba(M.l, .5); c.fillRect(q[0], q[1], 1, 1);
  }
  poly(c, corners, null, rgba(M.l, .55));
}
function drawBox(c, b, V, alpha = 1) {
  if (b.prism) return drawPrism(c, b, V, alpha);
  if (b.glass) return drawGlassBox(c, b, V, alpha);
  const p = (X, Z, Y) => iso(X, Z, Y, V);
  const { x, z, w, d, y, h } = b, col = b.c, edge = mix(shade(col, .5), '#24252B', .35);
  c.globalAlpha = alpha;
  const A = p(x, z, y + h), Bt = p(x + w, z, y + h), C = p(x + w, z + d, y + h), D = p(x, z + d, y + h);
  if (h > .015) {
    poly(c, [p(x, z + d, y), p(x + w, z + d, y), C, D], faceL(col), edge);
    poly(c, [p(x + w, z, y), p(x + w, z + d, y), C, Bt], faceR(col), edge);
  }
  poly(c, [A, Bt, C, D], col, edge);
  if (h > .04 && w > .15 && d > .15) { line(c, D, C, rgba('#FFFFFF', .35)); line(c, C, Bt, rgba('#FFFFFF', .22)); }
  c.globalAlpha = 1;
}
function drawGlassBox(c, b, V, alpha = 1) {
  const p = (X, Z, Y) => iso(X, Z, Y, V);
  const { x, z, w, d, y, h } = b;
  c.globalAlpha = alpha;
  const fl = [p(x, z + d, y), p(x + w, z + d, y), p(x + w, z + d, y + h), p(x, z + d, y + h)];
  const fr = [p(x + w, z, y), p(x + w, z + d, y), p(x + w, z + d, y + h), p(x + w, z, y + h)];
  poly(c, fr, 'rgba(160,196,222,0.30)', 'rgba(110,150,180,0.55)');
  poly(c, fl, 'rgba(190,222,242,0.30)', 'rgba(110,150,180,0.55)');
  const big = w >= d ? fl : fr, lerp = (a, b2, t) => [a[0] + (b2[0] - a[0]) * t, a[1] + (b2[1] - a[1]) * t];
  if (Math.max(w, d) > .3) {
    c.save(); c.beginPath(); c.moveTo(big[0][0], big[0][1]); for (const q of big.slice(1)) c.lineTo(q[0], q[1]); c.closePath(); c.clip();
    const s1 = lerp(big[0], big[1], .18), e1 = lerp(big[3], big[2], .5), s2 = lerp(big[0], big[1], .34), e2 = lerp(big[3], big[2], .66);
    line(c, s1, e1, 'rgba(255,255,255,0.55)', Math.max(1, V.z)); line(c, s2, e2, 'rgba(255,255,255,0.3)', Math.max(1, V.z * .6));
    c.restore();
  }
  c.globalAlpha = 1;
}
