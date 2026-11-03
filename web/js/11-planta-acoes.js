'use strict';

/* ---------- Ações na planta ---------- */
function spanOk(tiles) {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const k in tiles) { const [x, z] = k.split(',').map(Number); x0 = Math.min(x0, x); z0 = Math.min(z0, z); x1 = Math.max(x1, x + 1); z1 = Math.max(z1, z + 1); }
  return x1 - x0 <= MAXS && z1 - z0 <= MAXS;
}
const SIDE_NAME = { 'z-': '↗', 'x+': '↘', 'z+': '↙', 'x-': '↖' };
function grow(side, dir) {
  const cols = new Map(), axis = side[0], sign = side[1] === '+' ? 1 : -1;
  for (const k in W.tiles) {
    const [x, z] = k.split(',').map(Number), ln = axis === 'z' ? x : z, depth = axis === 'z' ? z : x;
    const cur = cols.get(ln); if (cur === undefined || (sign > 0 ? depth > cur : depth < cur)) cols.set(ln, depth);
  }
  if (dir > 0) {
    const next = { ...W.tiles };
    for (const [ln, depth] of cols) { const d2 = depth + sign, k = axis === 'z' ? key(ln, d2) : key(d2, ln), src = axis === 'z' ? key(ln, depth) : key(depth, ln); next[k] = W.tiles[src]; }
    if (!spanOk(next)) return toast(`A sala chegou ao tamanho máximo (${MAXS} × ${MAXS})`);
    change(() => { W.tiles = next; }, `Sala aumentada para ${SIDE_NAME[side]}`);
  } else {
    const rm = [];
    for (const [ln, depth] of cols) rm.push(axis === 'z' ? key(ln, depth) : key(depth, ln));
    if (Object.keys(W.tiles).length - rm.length < 4) return toast('A sala não pode ficar menor que isso');
    const blocked = W.objects.find(o => { const [w, d] = dims(o); for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) if (rm.includes(key(o.x + i, o.z + j))) return true; return false; });
    if (blocked) { selected = { type: 'obj', id: blocked.id }; renderCtx(); dirty(); return toast(`Tire "${ITEMS[blocked.item].n}" dessa borda antes de diminuir`); }
    const trial = { ...W.tiles }; for (const k of rm) delete trial[k];
    const keep = W.tiles; W.tiles = trial; const bw = W.walls.find(s => !wallOnFloor(s)); W.tiles = keep;
    if (bw) { selected = { type: 'wall', id: bw.id }; renderCtx(); dirty(); return toast(`Tire "${WALLKINDS[bw.kind].n}" dessa borda antes de diminuir`); }
    change(() => { for (const k of rm) delete W.tiles[k]; }, `Sala diminuída em ${SIDE_NAME[side]}`);
  }
  fitIfNeeded();
}
function applyMatAll(m) { change(() => { for (const k in W.tiles) W.tiles[k] = m; W.floorMat = m; }, `Piso trocado para ${MATS[m].n}`); }
