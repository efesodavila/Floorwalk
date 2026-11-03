'use strict';

/* ---------- Geometria ---------- */
function iso(x, z, y = 0, V = view) { return [Math.round(V.cx + (x - z) * TW / 2 * V.z), Math.round(V.cy + (x + z) * TH / 2 * V.z - y * UH * V.z)]; }
function unIso(sx, sy) { const a = (sx - view.cx) / (TW / 2 * view.z), b = (sy - view.cy) / (TH / 2 * view.z); return { x: (a + b) / 2, z: (b - a) / 2 }; }
function rotRect(bx, bz, bw, bd, Wd, Dd, rot) { for (let i = 0; i < (rot % 4); i++) { [bx, bz, bw, bd] = [Dd - bz - bd, bx, bd, bw];[Wd, Dd] = [Dd, Wd]; } return [bx, bz, bw, bd]; }
function dims(o) { const it = ITEMS[o.item]; return o.rot % 2 ? [it.d, it.w] : [it.w, it.d]; }
function objColor(o) { return o.color || ITEMS[o.item].color; }
function worldBoxes(o, at) {
  const it = ITEMS[o.item], px = at ? at.x : o.x, pz = at ? at.z : o.z, col = objColor(o);
  const list = it.dyn === 'kanban' ? [...it.boxes, ...kanbanNotes()] : it.boxes;
  return list.map(b => {
    const [bx, bz, bw, bd] = rotRect(b.x, b.z, b.w, b.d, it.w, it.d, o.rot), r = { ...b, x: px + bx, z: pz + bz, w: bw, d: bd, c: b.c === 'C' ? col : b.c, g: b.g === 'C' ? col : b.g, obj: o.id };
    if (b.screen) { let vx = 0, vz = 1; for (let k = 0; k < o.rot % 4; k++) [vx, vz] = [-vz, vx]; r.n = [vx, vz]; }
    return r;
  });
}
function seatsWorld(o) { const it = ITEMS[o.item]; return (it.seats || []).map(([sx, sz]) => { const [rx, rz] = rotRect(sx, sz, 0, 0, it.w, it.d, o.rot); return [o.x + rx, o.z + rz]; }); }
function objById(id) { return W.objects.find(o => o.id === id); }
function wallById(id) { return W.walls.find(s => s.id === id); }
function personPos(p) { return p.pos; }
/* corpos sólidos para pessoas: tudo que não dá para atravessar */
function solidBoxes() {
  const out = [];
  for (const o of W.objects) { if (ITEMS[o.item].flat) continue; for (const b of worldBoxes(o)) if (b.h > .05 && b.y < 1.6 && b.note == null) out.push(b); }
  for (const s of W.walls) for (const b of segBoxes(s)) if (!b.leaf && b.y < 1.6 && b.h > .05) out.push({ ...b, isWall: 1 });
  return out;
}
function freePoint(x, z, solids = solidBoxes(), margin = .14) {
  if (!W.tiles[key(Math.floor(x), Math.floor(z))]) return false;
  for (const b of solids) { const m = b.isWall ? .1 : margin; if (x > b.x - m && x < b.x + b.w + m && z > b.z - m && z < b.z + b.d + m) return false; }
  return true;
}
function bounds() {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const k in W.tiles) { const [x, z] = k.split(',').map(Number); x0 = Math.min(x0, x); z0 = Math.min(z0, z); x1 = Math.max(x1, x + 1); z1 = Math.max(z1, z + 1); }
  if (x0 === Infinity) return { x0: 0, z0: 0, x1: 1, z1: 1, empty: true };
  return { x0, z0, x1, z1 };
}

/* paredes: geometria */
function segInfo(s) {
  const [ax, az] = s.a, [bx, bz] = s.b, alongX = az === bz;
  return { alongX, u0: alongX ? Math.min(ax, bx) : Math.min(az, bz), u1: alongX ? Math.max(ax, bx) : Math.max(az, bz), c: alongX ? az : ax, len: alongX ? Math.abs(bx - ax) : Math.abs(bz - az) };
}
function wallCol(s) {
  const K = WALLKINDS[s.kind];
  return s.color || K.def || (K.colors === 'walls' ? shade(W.wall, 1.03) : '#FFFFFF');
}
function wallPalette(s) { const K = WALLKINDS[s.kind]; return K.colors === 'walls' ? WALLS.map(w => w[0]) : K.colors === 'woods' ? WOODS : K.colors === 'sw' ? SW : null; }
function segBoxes(s, off, open = 0) {
  const I = segInfo(s), dx = off ? off[0] : 0, dz = off ? off[1] : 0, col = wallCol(s), out = [];
  const T = .18;
  const mk = (u0, u1, y, h, c, t = T, extra) => {
    if (u1 - u0 <= 1e-6) return;
    const b = I.alongX ? { x: u0 + dx, z: I.c - t / 2 + dz, w: u1 - u0, d: t } : { x: I.c - t / 2 + dx, z: u0 + dz, w: t, d: u1 - u0 };
    out.push({ ...b, y, h, c, wall: s.id, ...(extra || {}) });
  };
  const leaf = (u, len, h, c, t, extra) => {
    const op = Math.max(0, Math.min(1, open)), ang = I.alongX ? op * Math.PI / 2 : Math.PI / 2 * (1 - op);
    const hx = I.alongX ? u + dx : I.c + dx, hz = I.alongX ? I.c + dz : u + dz, d = [Math.cos(ang), Math.sin(ang)], n = [-d[1], d[0]];
    const P = [[hx - n[0] * t / 2, hz - n[1] * t / 2], [hx + d[0] * len - n[0] * t / 2, hz + d[1] * len - n[1] * t / 2], [hx + d[0] * len + n[0] * t / 2, hz + d[1] * len + n[1] * t / 2], [hx + n[0] * t / 2, hz + n[1] * t / 2]];
    const xs = P.map(p => p[0]), zs = P.map(p => p[1]);
    out.push({ x: Math.min(...xs), z: Math.min(...zs), w: Math.max(...xs) - Math.min(...xs), d: Math.max(...zs) - Math.min(...zs), y: .02, h, c, wall: s.id, leaf: 1, prism: P, ...(extra || {}) });
  };
  const { u0, u1, len } = I, door = u0 + Math.floor((len - 1) / 2);
  const glassRun = (from, to, skip) => {
    if (skip == null) mk(from, to, 0, .1, FRAME, .1); else { mk(from, skip, 0, .1, FRAME, .1); mk(skip + 1, to, 0, .1, FRAME, .1); }
    mk(from, to, WH - .1, .1, FRAME, .1);
    for (let u = from; u <= to; u++) mk(Math.max(from, u - .03), Math.min(to, u + .03), .1, WH - .2, FRAME, .1);
    for (let u = from; u < to; u++) if (u !== skip) mk(u + .03, u + .97, .1, WH - .2, null, .05, { glass: 1 });
  };
  switch (s.kind) {
    case 'alvenaria': mk(u0, u1, 0, .12, shade(col, .78), T + .03); mk(u0, u1, .12, WH - .12, col); break;
    case 'porta':
      mk(u0, door, 0, WH, col); mk(door + 1, u1, 0, WH, col);
      mk(door, door + .07, 0, 2.05, '#8E6A4A'); mk(door + .93, door + 1, 0, 2.05, '#8E6A4A'); mk(door, door + 1, 2.05, WH - 2.05, col);
      leaf(door + .07, .86, 2.0, '#C08A58', .06); break;
    case 'janela':
      mk(u0, u1, 0, .9, col); mk(u0, u1, .9, .06, '#F2EFEA', T + .08); mk(u0, u1, 2.1, WH - 2.1, col);
      for (let u = u0; u <= u1; u++) mk(Math.max(u0, u - .04), Math.min(u1, u + .04), .96, 1.14, FRAME, .1);
      for (let u = u0; u < u1; u++) mk(u + .04, u + .96, .96, 1.14, null, .05, { glass: 1 });
      break;
    case 'meia': mk(u0, u1, 0, 1.0, col); mk(u0, u1, 1.0, .08, '#C98F57', T + .08); break;
    case 'vidro': glassRun(u0, u1, null); break;
    case 'vidro_porta': glassRun(u0, u1, door); leaf(door + .05, .86, WH - .25, null, .05, { glass: 1 }); break;
    case 'ripado':
      mk(u0, u1, 0, .1, '#3A3C42', .16);
      for (let u = u0 + .06; u + .1 <= u1 + 1e-6; u += .25) mk(u, u + .1, .1, 2.2, col, .12);
      mk(u0, u1, 2.3, .1, shade(col, .82), .16); break;
    case 'biombo':
      for (let u = u0; u < u1; u++) { mk(u + .12, u + .22, 0, .15, MET, .34); mk(u + .78, u + .88, 0, .15, MET, .34); mk(u + .04, u + .96, .15, 1.45, col, .12); }
      break;
  }
  return out;
}
function wallCrossesObj(s, o, at) {
  const I = segInfo(s), [w, d] = dims(o), x = at ? at.x : o.x, z = at ? at.z : o.z, e = 1e-6;
  if (I.alongX) return I.c > z + e && I.c < z + d - e && I.u0 < x + w - e && I.u1 > x + e;
  return I.c > x + e && I.c < x + w - e && I.u0 < z + d - e && I.u1 > z + e;
}
function wallOnFloor(s) {
  const I = segInfo(s);
  for (let u = I.u0; u < I.u1; u++) {
    const ok = I.alongX ? (W.tiles[key(u, I.c)] || W.tiles[key(u, I.c - 1)]) : (W.tiles[key(I.c, u)] || W.tiles[key(I.c - 1, u)]);
    if (!ok) return false;
  }
  return true;
}
function wallsOverlap(a, b) { const A = segInfo(a), Bb = segInfo(b); return A.alongX === Bb.alongX && A.c === Bb.c && A.u0 < Bb.u1 && Bb.u0 < A.u1; }
function wallProblem(s, ignoreId) {
  const K = WALLKINDS[s.kind], I = segInfo(s);
  if (I.len < K.min) return K.min > 1 ? `Arraste pelo menos ${K.min} quadrados para caber a porta` : 'Arraste ao longo da grade para desenhar';
  if (!wallOnFloor(s)) return 'A parede precisa ficar sobre o piso';
  const o = W.objects.find(o2 => !ITEMS[o2.item].flat && wallCrossesObj(s, o2)); if (o) return `A parede passaria por cima de "${ITEMS[o.item].n}"`;
  if (W.walls.some(w2 => w2.id !== ignoreId && wallsOverlap(s, w2))) return 'Já existe uma parede nesse trecho';
  return null;
}
function footprintOk(o, at, ignoreId) {
  const [w, d] = dims(o), x = at.x, z = at.z;
  for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) if (!W.tiles[key(x + i, z + j)]) return 'off';
  if (ITEMS[o.item].flat) return 'ok';
  for (const p of W.objects) {
    if (p.id === ignoreId || ITEMS[p.item].flat) continue;
    const [pw, pd] = dims(p);
    if (x < p.x + pw && x + w > p.x && z < p.z + pd && z + d > p.z) return 'overlap:' + ITEMS[p.item].n;
  }
  const s = W.walls.find(s2 => wallCrossesObj(s2, o, at)); if (s) return 'overlap:' + WALLKINDS[s.kind].n;
  return 'ok';
}
function warnings() {
  const out = [];
  for (const o of W.objects) {
    const [w, d] = dims(o); let off = false;
    for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) if (!W.tiles[key(o.x + i, o.z + j)]) off = true;
    if (off) out.push({ text: `${ITEMS[o.item].n}: parte está fora do piso`, sel: { type: 'obj', id: o.id } });
  }
  for (const s of W.walls) if (!wallOnFloor(s)) out.push({ text: `${WALLKINDS[s.kind].n}: parte está fora do piso`, sel: { type: 'wall', id: s.id } });
  const sol = solidBoxes();
  for (const p of W.people) if (!freePoint(p.pos[0], p.pos[1], sol)) out.push({ text: `${p.name} está num lugar bloqueado. Arraste para um espaço livre.`, person: p.id });
  return out;
}
let WARN_CACHE = null;
function cachedWarnings() { return WARN_CACHE ??= warnings(); }
