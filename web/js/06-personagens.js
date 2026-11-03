'use strict';

/* ---------- Personagens: sprite 18×30 em pixel art; contorno fino aplicado na escala final, igual ao dos elementos ---------- */
const SPRITES = new Map(), SPRITES_S = new Map();
// mesma cor de aresta usada em drawBox: tom escuro da própria cor vizinha
const edgeOf = (r, g, b) => hexRgb(mix(shade(rgbHex(r, g, b), .5), '#24252B', .35));
function spriteCanvas(p, o, s = 1) {
  const base = spriteBase(p, o), k = base._k + '|' + s;
  let c = SPRITES_S.get(k); if (c) return c;
  const W = 18 * s, H = 30 * s;
  c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  g.imageSmoothingEnabled = false; g.drawImage(base, 0, 0, W, H);
  const img = g.getImageData(0, 0, W, H), d = img.data, a = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 0 : d[(y * W + x) * 4 + 3];
  const add = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (a(x, y)) continue;
    let n = -1;
    for (const [dx, dy] of [[0, 1], [0, -1], [-1, 0], [1, 0]]) if (a(x + dx, y + dy)) { n = ((y + dy) * W + x + dx) * 4; break; }
    if (n >= 0) add.push((y * W + x) * 4, ...edgeOf(d[n], d[n + 1], d[n + 2]));
  }
  // vãos fechados (ex.: entre as pernas) viram aresta inteira, não um anel com miolo vazado
  const out = new Uint8Array(W * H), st = [];
  for (let x = 0; x < W; x++) st.push(x, 0, x, H - 1);
  for (let y = 0; y < H; y++) st.push(0, y, W - 1, y);
  while (st.length) { const y = st.pop(), x = st.pop(), i = y * W + x; if (x < 0 || y < 0 || x >= W || y >= H || out[i] || a(x, y)) continue; out[i] = 1; st.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1); }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; if (out[i] || a(x, y)) continue;
    let n = -1; for (let r = 1; r < W && n < 0; r++) for (const [dx, dy] of [[0, r], [0, -r], [-r, 0], [r, 0]]) if (a(x + dx, y + dy)) { n = ((y + dy) * W + x + dx) * 4; break; }
    if (n >= 0) add.push(i * 4, ...edgeOf(d[n], d[n + 1], d[n + 2]));
  }
  for (let i = 0; i < add.length; i += 4) { const j = add[i]; d[j] = add[i + 1]; d[j + 1] = add[i + 2]; d[j + 2] = add[i + 3]; d[j + 3] = 255; }
  g.putImageData(img, 0, 0);
  SPRITES_S.set(k, c); return c;
}
function spriteScale(z) { return Math.max(1, Math.round(z * 1.2)); }
// o: { back, frame (0-3 passos), sit, act (0/1 digitando), held }
function spriteBase(p, o) {
  const ex = p.extras || {};
  const k = [p.skin, p.hair, p.hairStyle, p.top, p.shirt, p.pants, p.shoes, +!!ex.cracha, +!!ex.oculos, +!!ex.fone, +!!ex.barba, +!!o.back, o.frame || 0, +!!o.sit, o.act ?? -1, +!!o.held].join('|');
  let c = SPRITES.get(k); if (c) return c;
  c = document.createElement('canvas'); c.width = 18; c.height = 30; const g = c.getContext('2d');
  const P = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x + 1, y + 1, w, h); };
  const sk = p.skin, skD = shade(sk, .86), hr = p.hair, hrD = shade(hr, .7), hrL = mix(hr, '#FFFFFF', .28);
  const sh = p.shirt, shD = shade(sh, .78), shL = mix(sh, '#FFFFFF', .18), pa = p.pants, paD = shade(pa, .78), so = p.shoes || '#2C2E34', soL = mix(so, '#FFFFFF', .3);
  const ink = '#24252B', back = !!o.back, frame = o.sit ? 0 : (o.frame || 0);
  const bob = (frame === 1 || frame === 3) ? -1 : 0, dy = o.sit ? 4 : 0;
  const Y = y => y + dy + bob;
  const longSleeve = p.top !== 'camiseta';

  // pernas
  if (o.held) {
    P(4, Y(20), 4, 4, pa); P(8, Y(20), 4, 5, pa); P(11, Y(20), 1, 5, paD); P(4, Y(24), 4, 1, so); P(8, Y(25), 4, 1, so);
  } else if (o.sit) {
    P(4, Y(20), 8, 2, pa); P(11, Y(20), 1, 2, paD);
    if (!back) { P(4, Y(22), 3, 1, paD); P(9, Y(22), 3, 1, paD); P(4, Y(23), 3, 1, so); P(9, Y(23), 3, 1, so); }
  } else {
    const fl = frame === 1 ? 1 : frame === 3 ? -1 : 0, fr = -fl;
    const leg = (x, d, dark) => { const top = Y(20), bottom = 25 + d; P(x, top, 4, bottom - top, pa); if (dark) P(x + 3, top, 1, bottom - top, paD); P(x, bottom, 4, 2, so); P(x, bottom, 4, 1, soL); };
    leg(4, fl, false); leg(8, fr, true);
    if (!back) g.clearRect(8, Y(23) + 1, 2, 25 - Y(23));
  }
  // tronco
  P(4, Y(13), 8, 6, sh); P(4, Y(13), 1, 6, shL); P(11, Y(13), 1, 6, shD); P(4, Y(19), 8, 1, paD);
  // braços
  const swing = o.sit ? 0 : frame === 1 ? -1 : frame === 3 ? 1 : 0;
  const arm = (x, s) => {
    const sl = longSleeve ? 6 : 2;
    P(x, Y(13), 1, sl, x < 8 ? shL : shD); if (!longSleeve) P(x, Y(15), 1, 4, sk);
    P(x, Y(19) + s, 1, 1, sk);
  };
  if (o.act != null && o.act >= 0 && o.sit && !back) {
    // digitando: mãos à frente do corpo
    P(3, Y(13), 1, longSleeve ? 4 : 2, shL); P(12, Y(13), 1, longSleeve ? 4 : 2, shD);
    if (!longSleeve) { P(3, Y(15), 1, 2, sk); P(12, Y(15), 1, 2, sk); }
    P(4, Y(17) + (o.act ? 0 : 1), 2, 1, sk); P(10, Y(17) + (o.act ? 1 : 0), 2, 1, sk);
  } else if (o.held) {
    P(3, Y(9), 1, 6, longSleeve ? shL : sk); P(12, Y(9), 1, 6, longSleeve ? shD : sk); P(3, Y(8), 1, 1, sk); P(12, Y(8), 1, 1, sk);
  } else {
    arm(3, o.act != null && o.act >= 0 && back ? (o.act ? -1 : 0) : swing);
    arm(12, o.act != null && o.act >= 0 && back ? (o.act ? 0 : -1) : -swing);
  }
  // detalhes da roupa
  if (!back) {
    if (p.top === 'camiseta') P(7, Y(13), 2, 1, skD);
    if (p.top === 'camisa') { P(5, Y(13), 2, 1, '#FFFFFF'); P(9, Y(13), 2, 1, '#FFFFFF'); P(7, Y(13), 2, 1, skD); P(7, Y(15), 1, 1, shD); P(7, Y(17), 1, 1, shD); }
    if (p.top === 'jaqueta') { P(6, Y(13), 4, 6, '#F2EFEA'); P(6, Y(13), 1, 3, shD); P(9, Y(13), 1, 3, shD); P(7, Y(13), 2, 1, skD); }
    if (p.top === 'moletom') { P(5, Y(16), 6, 2, shD); P(6, Y(13), 1, 2, '#FFFFFF'); P(9, Y(13), 1, 2, '#FFFFFF'); }
    if (ex.cracha) { P(6, Y(13), 1, 2, '#8C4FE0'); P(9, Y(13), 1, 2, '#8C4FE0'); P(7, Y(15), 2, 1, '#8C4FE0'); P(7, Y(16), 2, 2, '#FFFFFF'); P(7, Y(17), 2, 1, '#8C4FE0'); }
  } else if (p.top === 'moletom') { P(5, Y(13), 6, 2, shD); }
  // pescoço e cabeça
  P(6, Y(12), 4, 1, skD);
  P(3, Y(8), 1, 2, sk); P(12, Y(8), 1, 2, skD);
  P(4, Y(4), 8, 8, sk); P(11, Y(4), 1, 8, skD);
  if (p.top === 'moletom' && !back) P(4, Y(12), 8, 1, shD);
  if (!back) {
    P(6, Y(8), 1, 2, ink); P(9, Y(8), 1, 2, ink);
    P(5, Y(10), 1, 1, mix(sk, '#E8675C', .35)); P(10, Y(10), 1, 1, mix(sk, '#E8675C', .35));
    P(7, Y(10), 2, 1, shade(sk, .78));
  }
  // cabelo
  const hs = p.hairStyle || 'curto', shaved = mix(hr, sk, .45);
  const cap = () => { P(5, Y(2), 6, 1, hr); P(4, Y(3), 8, 3, hr); P(6, Y(3), 2, 1, hrL); };
  if (!back) {
    if (hs === 'curto') { cap(); P(4, Y(6), 1, 2, hr); P(11, Y(6), 1, 2, hr); P(5, Y(6), 2, 1, hr); }
    if (hs === 'franja') { cap(); P(4, Y(6), 8, 1, hr); P(3, Y(5), 1, 6, hr); P(12, Y(5), 1, 6, hr); P(4, Y(7), 1, 4, hr); P(11, Y(7), 1, 4, hr); P(6, Y(6), 1, 1, hrD); P(9, Y(6), 1, 1, hrD); }
    if (hs === 'longo') { cap(); P(3, Y(4), 1, 12, hr); P(12, Y(4), 1, 12, hrD); P(4, Y(6), 1, 4, hr); P(11, Y(6), 1, 4, hr); P(5, Y(6), 3, 1, hr); P(2, Y(12), 2, 4, hr); P(12, Y(12), 2, 4, hrD); }
    if (hs === 'coque') { cap(); P(4, Y(6), 1, 2, hr); P(11, Y(6), 1, 2, hr); P(6, Y(0), 4, 2, hr); P(7, Y(0), 2, 1, hrL); P(5, Y(1), 6, 1, hrD); }
    if (hs === 'rabo') { cap(); P(4, Y(6), 1, 2, hr); P(11, Y(6), 1, 2, hr); P(12, Y(4), 2, 2, hr); P(13, Y(6), 1, 6, hrD); }
    if (hs === 'cacheado') { P(4, Y(1), 8, 1, hr); P(3, Y(2), 10, 4, hr); P(3, Y(6), 2, 4, hr); P(11, Y(6), 2, 4, hr); for (const [x, y] of [[4, 2], [7, 2], [10, 2], [5, 4], [9, 4], [3, 7], [12, 8]]) P(x, Y(y), 1, 1, hrL); P(6, Y(5), 1, 1, hrD); P(9, Y(5), 1, 1, hrD); }
    if (hs === 'raspado') { P(4, Y(3), 8, 2, shaved); P(4, Y(5), 1, 2, shaved); P(11, Y(5), 1, 2, shaved); }
  } else {
    if (hs === 'raspado') P(4, Y(3), 8, 7, shaved);
    else if (hs === 'cacheado') { P(3, Y(1), 10, 10, hr); for (const [x, y] of [[4, 2], [8, 3], [11, 5], [5, 6], [9, 8], [6, 9]]) P(x, Y(y), 1, 1, hrL); }
    else if (hs === 'longo') { P(5, Y(2), 6, 1, hr); P(3, Y(3), 10, 13, hr); P(11, Y(3), 2, 13, hrD); P(6, Y(4), 3, 1, hrL); }
    else {
      P(5, Y(2), 6, 1, hr); P(4, Y(3), 8, hs === 'franja' ? 9 : 8, hr); P(11, Y(3), 1, 8, hrD); P(6, Y(4), 3, 1, hrL);
      if (hs === 'coque') { P(6, Y(0), 4, 3, hr); P(7, Y(0), 2, 1, hrL); }
      if (hs === 'rabo') { P(7, Y(10), 2, 6, hr); P(8, Y(10), 1, 6, hrD); }
    }
  }
  // acessórios
  if (ex.barba && !back) { P(4, Y(9), 1, 2, hr); P(11, Y(9), 1, 2, hr); P(5, Y(10), 2, 1, hr); P(9, Y(10), 2, 1, hr); P(5, Y(11), 6, 1, hr); }
  if (ex.oculos && !back) { P(5, Y(7), 3, 1, ink); P(8, Y(7), 3, 1, ink); P(5, Y(8), 1, 1, ink); P(10, Y(8), 1, 1, ink); P(7, Y(8), 2, 1, ink); }
  if (ex.fone) { P(4, Y(2), 8, 1, '#2C2E34'); P(3, Y(3), 1, 4, '#2C2E34'); P(12, Y(3), 1, 4, '#2C2E34'); P(2, Y(7), 2, 3, '#2C2E34'); P(12, Y(7), 2, 3, '#2C2E34'); P(2, Y(8), 1, 1, '#8C4FE0'); P(13, Y(8), 1, 1, '#8C4FE0'); }

  c._k = k; SPRITES.set(k, c); return c;
}
// desenha o sprite com o pé em (fx, fy)
function blitSprite(c, cnv, fx, fy, s, mirror) {
  c.save(); c.imageSmoothingEnabled = false;
  if (mirror) { c.translate(Math.round(fx), 0); c.scale(-1, 1); c.drawImage(cnv, -9 * s, Math.round(fy) - 28 * s, 18 * s, 30 * s); }
  else c.drawImage(cnv, Math.round(fx) - 9 * s, Math.round(fy) - 28 * s, 18 * s, 30 * s);
  c.restore();
}
/* ícones dos balões de atividade (grade 9×8) */
function drawIcon(c, name, x, y, q, t) {
  const R = (a, b, w, h, col) => { c.fillStyle = col; c.fillRect(x + a * q, y + b * q, w * q, h * q); };
  switch (name) {
    case 'typing': { const k = Math.floor(t * 3) % 3; [1, 4, 7].forEach((px, i) => R(px, i === k ? 3 : 4, 2, 2, '#8C4FE0')); break; }
    case 'coffee': R(1, 3, 5, 4, '#C98F57'); R(2, 3, 3, 1, '#5A3A22'); R(6, 4, 2, 1, '#C98F57'); R(7, 4, 1, 2, '#C98F57'); R(6, 5, 1, 1, '#C98F57'); R(2, 7, 3, 1, '#A8743F'); { const k = Math.floor(t * 2) % 2; R(2, k, 1, 2, '#B8B3BE'); R(4, 1 - k, 1, 2, '#B8B3BE'); } break;
    case 'can': R(3, 0, 3, 1, '#B8B3BE'); R(3, 1, 3, 6, '#E0473B'); R(3, 3, 3, 1, '#FFFFFF'); R(3, 7, 3, 1, '#B8B3BE'); break;
    case 'chart': R(1, 5, 2, 2, '#2F5FD0'); R(4, 3, 2, 4, '#3AA655'); R(7, 1, 2, 6, '#F2B630'); R(0, 7, 9, 1, '#5C5866'); break;
    case 'music': { const k = Math.floor(t * 2) % 2; R(5, k, 1, 5, '#8C4FE0'); R(6, k, 2, 1, '#8C4FE0'); R(7, 1 + k, 1, 1, '#8C4FE0'); R(3, 4 + k, 3, 2, '#8C4FE0'); break; }
    case 'drop': R(4, 0, 1, 1, '#3E8EDE'); R(3, 1, 3, 2, '#3E8EDE'); R(2, 3, 5, 3, '#3E8EDE'); R(3, 6, 3, 1, '#3E8EDE'); R(3, 3, 1, 1, '#FFFFFF'); break;
    case 'paper': R(2, 0, 5, 7, '#D9D6DE'); R(3, 2, 3, 1, '#5C5866'); R(3, 4, 3, 1, '#5C5866'); break;
    case 'camera': R(1, 2, 7, 4, '#24252B'); R(3, 3, 3, 2, '#7A7484'); R(7, 1, 1, 1, Math.floor(t * 2) % 2 ? '#E0473B' : '#FF9A90'); break;
    case 'kanban': R(0, 0, 9, 8, '#E4E1E0'); R(1, 1, 2, 2, '#F2B630'); R(1, 4, 2, 2, '#E0473B'); R(4, 1, 2, 2, '#7FC4E8'); R(7, 1, 1, 2, '#3AA655'); R(7, 4, 1, 2, '#3AA655'); break;
    case 'magnifier': R(1, 0, 4, 1, '#2FA5A0'); R(0, 1, 1, 4, '#2FA5A0'); R(5, 1, 1, 4, '#2FA5A0'); R(1, 5, 4, 1, '#2FA5A0'); R(1, 1, 4, 4, '#CFEFEA'); R(5, 5, 2, 2, '#24252B'); R(7, 7, 1, 1, '#24252B'); break;
    case 'flask': R(3, 0, 3, 1, '#5C5866'); R(3, 1, 3, 2, '#D9D6DE'); R(2, 3, 5, 2, '#F2B630'); R(1, 5, 7, 2, '#F2B630'); R(3, 4, 1, 1, '#FFFFFF'); { const k = Math.floor(t * 3) % 2; R(4 + k, 5, 1, 1, '#FFFFFF'); } break;
    case 'book': R(0, 1, 4, 6, '#3AA655'); R(5, 1, 4, 6, '#2F9A4C'); R(4, 1, 1, 6, '#24252B'); R(1, 2, 2, 1, '#FFFFFF'); R(6, 2, 2, 1, '#FFFFFF'); break;
    case 'rocket': { const k = Math.floor(t * 6) % 2; R(4, 0, 1, 1, '#E0473B'); R(3, 1, 3, 4, '#E4E1E0'); R(4, 2, 1, 1, '#2F5FD0'); R(2, 4, 1, 2, '#E0473B'); R(6, 4, 1, 2, '#E0473B'); R(3, 5, 3, 1, '#9AA0A8'); R(4, 6, 1, 1 + k, '#F2B630'); break; }
    case 'chat': R(0, 0, 6, 4, '#8C4FE0'); R(1, 4, 1, 1, '#8C4FE0'); R(4, 3, 5, 4, '#7FC4E8'); R(7, 7, 1, 1, '#7FC4E8'); break;
    case 'hourglass': { const k = Math.floor(t * 1.5) % 2; R(2, 0, 5, 1, '#5C5866'); R(2, 7, 5, 1, '#5C5866'); R(3, 1, 3, 2, k ? '#F2B630' : '#E4E1E0'); R(4, 3, 1, 2, '#F2B630'); R(3, 5, 3, 2, k ? '#E4E1E0' : '#F2B630'); break; }
    case 'alert': { const k = Math.floor(t * 4) % 2; R(4, 0, 1, 1, '#E0473B'); R(3, 1, 3, 2, '#E0473B'); R(2, 3, 5, 2, '#E0473B'); R(1, 5, 7, 2, '#E0473B'); R(4, 2, 1, 3, '#FFFFFF'); R(4, 6, 1, 1, k ? '#FFFFFF' : '#FFB3AC'); break; }
    case 'check': R(1, 4, 1, 1, '#2F7A3E'); R(2, 5, 1, 1, '#2F7A3E'); R(3, 6, 1, 1, '#2F7A3E'); R(4, 5, 1, 1, '#2F7A3E'); R(5, 4, 1, 1, '#2F7A3E'); R(6, 3, 1, 1, '#2F7A3E'); R(7, 2, 1, 1, '#2F7A3E'); R(1, 3, 1, 1, '#2F7A3E'); R(2, 4, 1, 1, '#2F7A3E'); R(3, 5, 1, 1, '#2F7A3E'); R(6, 2, 1, 1, '#2F7A3E'); R(7, 1, 1, 1, '#2F7A3E'); break;
    case 'zzz': { const k = Math.floor(t * 1.5) % 2; R(1, 4 - k, 3, 1, '#5C5866'); R(2, 5 - k, 1, 1, '#5C5866'); R(1, 6 - k, 3, 1, '#5C5866'); R(5, 0 + k, 3, 1, '#9AA0A8'); R(6, 1 + k, 1, 1, '#9AA0A8'); R(5, 2 + k, 3, 1, '#9AA0A8'); break; }
    case 'pin': R(3, 0, 3, 3, '#E0473B'); R(4, 3, 1, 4, '#5C5866'); R(3, 1, 1, 1, '#FF9A90'); break;
  }
}
// pessoa completa: sombra, sprite, balão e nome
function drawPerson(c, p, V, opts = {}) {
  const [px, pz] = opts.at || p.pos, lift = opts.lift || 0;
  const [fx, fy] = iso(px, pz, lift + (opts.sit ? Math.max(0, opts.seatY - .46) : 0), V), [gx, gy] = iso(px, pz, 0, V), s = spriteScale(V.z);
  if (opts.layer !== 'tag') {
  c.fillStyle = lift ? 'rgba(36,37,43,0.12)' : 'rgba(36,37,43,0.2)'; c.beginPath(); c.ellipse(gx, gy, 5 * s, 2 * s, 0, 0, Math.PI * 2); c.fill();
  if (opts.ring) { c.strokeStyle = '#8C4FE0'; c.lineWidth = 2; c.beginPath(); c.ellipse(gx, gy, 8 * s, 3.4 * s, 0, 0, Math.PI * 2); c.stroke(); c.strokeStyle = 'rgba(140,79,224,0.35)'; c.lineWidth = 4; c.beginPath(); c.ellipse(gx, gy, 9.5 * s, 4.2 * s, 0, 0, Math.PI * 2); c.stroke(); c.lineWidth = 1; }
  if (opts.dim) c.globalAlpha = .45;
  blitSprite(c, spriteCanvas(p, { back: opts.back, frame: opts.frame || 0, sit: opts.sit, act: opts.act, held: lift > .2 }, s), fx, fy, s, opts.mirror);
  c.globalAlpha = 1;
  if (opts.layer === 'body') return;
  }
  const top = fy - (opts.sit ? 24 : 28) * s;
  let labelY = top - 6;
  if (opts.icon) {
    const q = Math.max(2, Math.round(s * .9)), bw = 11 * q, bh = 10 * q, bx = Math.round(fx - bw / 2), by = Math.round(top - bh - 6);
    c.fillStyle = '#FFFFFF'; c.strokeStyle = '#24252B'; c.lineWidth = 1.5;
    c.beginPath(); c.roundRect ? c.roundRect(bx, by, bw, bh, 3 * q / 2) : c.rect(bx, by, bw, bh); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(fx - 3, by + bh - .5); c.lineTo(fx + 3, by + bh - .5); c.lineTo(fx, by + bh + 4); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(fx - 3, by + bh); c.lineTo(fx, by + bh + 4); c.lineTo(fx + 3, by + bh); c.stroke();
    drawIcon(c, opts.icon, bx + q, by + q, q, opts.t || 0);
    labelY = by - 4;
  }
  if (opts.label) {
    c.font = `600 ${Math.max(11, Math.round(5 * s))}px "IBM Plex Sans", system-ui, sans-serif`;
    const tw = c.measureText(p.name).width, bh = Math.max(19, Math.round(7.5 * s)), bx = Math.round(fx - tw / 2 - 7), by = Math.round(labelY - bh - 2);
    c.fillStyle = opts.hot ? '#8C4FE0' : 'rgba(36,37,43,0.88)';
    c.beginPath(); c.roundRect ? c.roundRect(bx, by, tw + 14, bh, 6) : c.rect(bx, by, tw + 14, bh); c.fill();
    if (!opts.icon) { c.beginPath(); c.moveTo(fx - 4, by + bh); c.lineTo(fx + 4, by + bh); c.lineTo(fx, by + bh + 4); c.closePath(); c.fill(); }
    c.fillStyle = '#FFFFFF'; c.textBaseline = 'middle'; c.fillText(p.name, bx + 7, by + bh / 2 + 1);
    if (opts.dot) { c.fillStyle = opts.dot; c.strokeStyle = '#FFFFFF'; c.lineWidth = 1.5; c.beginPath(); c.arc(bx + tw + 14, by + 1, 4, 0, Math.PI * 2); c.fill(); c.stroke(); }
  }
}
function avatar(p, s = 3) {
  const c = document.createElement('canvas'); c.width = 12 * s; c.height = 14 * s; const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  g.drawImage(spriteCanvas(p, { frame: 0 }, s), 0, 0, 18 * s, 15 * s, -3 * s, 0, 18 * s, 15 * s);
  return c.toDataURL();
}
function fullAvatar(p, s = 4) {
  const c = document.createElement('canvas'); c.width = 18 * s; c.height = 30 * s; const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  g.drawImage(spriteCanvas(p, { frame: 0 }, s), 0, 0); return c.toDataURL();
}
function drawGlow(c, b, V, k = 1) {
  const [sx, sy] = iso(b.x + b.w / 2, b.z + b.d / 2, b.y + b.h / 2, V), r = (10 + 24 * Math.min(1, Math.max(b.w, b.h, b.d))) * V.z * (1 + (k - 1) * .2);
  const g = c.createRadialGradient(sx, sy, 0, sx, sy, r);
  g.addColorStop(0, rgba(b.g, Math.min(.85, .38 * (b.ga ?? 1) * k))); g.addColorStop(1, rgba(b.g, 0));
  c.fillStyle = g; c.fillRect(sx - r, sy - r, r * 2, r * 2);
}

/* ordenação por profundidade: grafo "fica atrás de" entre caixas que se sobrepõem na tela */
function screenRect(b, V) {
  const xs = [], ys = [];
  for (const [X, Z] of [[b.x, b.z], [b.x + b.w, b.z], [b.x, b.z + b.d], [b.x + b.w, b.z + b.d]]) for (const Y of [b.y, b.y + b.h]) { const q = iso(X, Z, Y, V); xs.push(q[0]); ys.push(q[1]); }
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}
function behind(A, B2) {
  const e = 1e-3;
  const ox = A.x < B2.x + B2.w - e && B2.x < A.x + A.w - e, oz = A.z < B2.z + B2.d - e && B2.z < A.z + A.d - e;
  if (ox && oz) { if (A.u && B2.person) return true; if (B2.u && A.person) return false; return A.y + A.h <= B2.y + e; }
  const ax = A.x + A.w <= B2.x + e, az = A.z + A.d <= B2.z + e, bx = B2.x + B2.w <= A.x + e, bz = B2.z + B2.d <= A.z + e;
  if ((ax && !bz) || (az && !bx)) return true;
  if (ax || az) return (A.x + A.w + A.z + A.d) < (B2.x + B2.w + B2.z + B2.d);
  return false;
}
function depthSort(items, V) {
  const n = items.length, rects = items.map(b => screenRect(b, V)), indeg = new Array(n).fill(0), adj = items.map(() => []);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    if (i === j) continue; const a = rects[i], b = rects[j];
    if (a[2] <= b[0] || b[2] <= a[0] || a[3] <= b[1] || b[3] <= a[1]) continue;
    if (behind(items[i], items[j])) { adj[i].push(j); indeg[j]++; }
  }
  const out = [], done = new Array(n).fill(false);
  const k2 = (b) => b.x + b.w / 2 + b.z + b.d / 2 + b.y * .01;
  let ready = []; for (let i = 0; i < n; i++) if (!indeg[i]) ready.push(i);
  while (out.length < n) {
    if (!ready.length) { let best = -1; for (let i = 0; i < n; i++) if (!done[i] && (best < 0 || k2(items[i]) < k2(items[best]))) best = i; ready.push(best); }
    ready.sort((a, b) => k2(items[a]) - k2(items[b]));
    const i = ready.shift(); if (done[i]) continue; done[i] = true; out.push(items[i]);
    for (const j of adj[i]) { indeg[j]--; if (!indeg[j] && !done[j]) ready.push(j); }
  }
  return out;
}

function handles() {
  const b = bounds(), mx = (b.x0 + b.x1) / 2, mz = (b.z0 + b.z1) / 2;
  return [
    { side: 'z-', x: mx, z: b.z0 - 1.2, label: 'Aumentar para ↗' }, { side: 'x+', x: b.x1 + 1.2, z: mz, label: 'Aumentar para ↘' },
    { side: 'z+', x: mx, z: b.z1 + 1.2, label: 'Aumentar para ↙' }, { side: 'x-', x: b.x0 - 1.2, z: mz, label: 'Aumentar para ↖' },
  ].map(h => ({ ...h, s: iso(h.x, h.z, 0) }));
}
function footPoly(x, z, w, d, y = .02) { return [iso(x, z, y), iso(x + w, z, y), iso(x + w, z + d, y), iso(x, z + d, y)]; }
function wallGhost() {
  if (!walling || !drag || drag.kind !== 'wall') return null;
  return { id: '__ghost', kind: walling.kind, a: drag.a, b: drag.b, color: null };
}
