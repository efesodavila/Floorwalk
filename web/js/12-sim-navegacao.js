'use strict';

/* ---------- Ao vivo: navegação, rotina e player ---------- */
function buildNav() {
  const b = bounds(), R = 2, ox = b.x0, oz = b.z0, nx = (b.x1 - b.x0) * R, nz = (b.z1 - b.z0) * R, sol = solidBoxes();
  const walk = new Uint8Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) walk[j * nx + i] = freePoint(ox + (i + .5) / R, oz + (j + .5) / R, sol, .22) ? 1 : 0;
  const runs = [];
  for (const s of W.walls) {
    const I = segInfo(s), door = (s.kind === 'porta' || s.kind === 'vidro_porta') ? I.u0 + Math.floor((I.len - 1) / 2) : null;
    if (door == null) runs.push({ ...I, a: I.u0, b: I.u1 });
    else { if (door > I.u0) runs.push({ ...I, a: I.u0, b: door }); if (door + 1 < I.u1) runs.push({ ...I, a: door + 1, b: I.u1 }); }
  }
  NAV = { R, ox, oz, nx, nz, walk, runs, sol, spots: [] };
  for (const o of W.objects) {
    const list = SPOTS[o.item]; if (!list) continue; const it = ITEMS[o.item];
    list.forEach((sp, i) => {
      const [x, z, act, sit, fx, fz] = sp, [rx, rz] = rotRect(x, z, 0, 0, it.w, it.d, o.rot);
      let vx = fx, vz = fz; for (let k = 0; k < o.rot % 4; k++) [vx, vz] = [-vz, vx];
      const spot = { id: o.id + '#' + i, x: o.x + rx, z: o.z + rz, act, sit, fx: vx, fz: vz };
      if (!sit && !freePoint(spot.x, spot.z, sol)) return;
      const st = nearestCell(spot.x, spot.z, 4); if (!st) return;
      spot.stand = st; spot.standPt = cellC(st[0], st[1]); NAV.spots.push(spot);
    });
  }
  return NAV;
}
const cellC = (i, j) => [NAV.ox + (i + .5) / NAV.R, NAV.oz + (j + .5) / NAV.R];
const cellOf = (x, z) => [Math.floor((x - NAV.ox) * NAV.R), Math.floor((z - NAV.oz) * NAV.R)];
const okCell = (i, j) => i >= 0 && j >= 0 && i < NAV.nx && j < NAV.nz && NAV.walk[j * NAV.nx + i] === 1 && !(NAV.tmp && NAV.tmp.has(j * NAV.nx + i));
function crosses(x1, z1, x2, z2) {
  for (const r of NAV.runs) {
    const p1 = r.alongX ? z1 : x1, p2 = r.alongX ? z2 : x2, q1 = r.alongX ? x1 : z1, q2 = r.alongX ? x2 : z2;
    const d1 = p1 - r.c, d2 = p2 - r.c;
    if (d1 * d2 < 0) { const t = d1 / (d1 - d2), q = q1 + (q2 - q1) * t; if (q > r.a - .08 && q < r.b + .08) return true; }
  }
  return false;
}
function nearestCell(x, z, maxR = 6) {
  const [ci, cj] = cellOf(x, z);
  for (let r = 0; r <= maxR; r++) {
    let best = null, bd = Infinity;
    for (let di = -r; di <= r; di++) for (let dj = -r; dj <= r; dj++) {
      if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
      const i = ci + di, j = cj + dj; if (!okCell(i, j)) continue;
      const [cx, cz] = cellC(i, j), d = Math.hypot(cx - x, cz - z);
      if (d < bd && !crosses(x, z, cx, cz)) { bd = d; best = [i, j]; }
    }
    if (best) return best;
  }
  return null;
}
function findPath(si, sj, ti, tj) {
  const { nx, nz } = NAV, N = nx * nz, g = new Float32Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
  const s = sj * nx + si, t = tj * nx + ti, H = (i, j) => { const dx = Math.abs(i - ti), dz = Math.abs(j - tj); return Math.max(dx, dz) + .414 * Math.min(dx, dz); };
  const heap = [];
  const push = (f, n) => { heap.push([f, n]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
  g[s] = 0; push(H(si, sj), s);
  const dirs = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
  while (heap.length) {
    const [, n] = pop(); if (closed[n]) continue; closed[n] = 1;
    if (n === t) break;
    const i = n % nx, j = (n - i) / nx, [cx, cz] = cellC(i, j);
    for (const [di, dj, cost] of dirs) {
      const a = i + di, b = j + dj; if (!okCell(a, b)) continue;
      if (di && dj && (!okCell(i + di, j) || !okCell(i, j + dj))) continue;
      const m = b * nx + a; if (closed[m]) continue;
      const [mx, mz] = cellC(a, b); if (crosses(cx, cz, mx, mz)) continue;
      const ng = g[n] + cost; if (ng < g[m]) { g[m] = ng; came[m] = n; push(ng + H(a, b), m); }
    }
  }
  if (!closed[t]) return null;
  const out = []; for (let n = t; n !== -1; n = came[n]) { const i = n % nx; out.push(cellC(i, (n - i) / nx)); if (n === s) break; }
  return out.reverse();
}
function los(x1, z1, x2, z2) {
  if (crosses(x1, z1, x2, z2)) return false;
  const n = Math.ceil(Math.hypot(x2 - x1, z2 - z1) / .1);
  for (let k = 1; k < n; k++) { const x = x1 + (x2 - x1) * k / n, z = z1 + (z2 - z1) * k / n; if (!freePoint(x, z, NAV.sol, .2)) return false; if (NAV.tmpPts && NAV.tmpPts.some(q => Math.hypot(q[0] - x, q[1] - z) < .5)) return false; }
  return true;
}
function smooth(pts) {
  if (pts.length < 3) return pts;
  const out = [pts[0]]; let i = 0;
  while (i < pts.length - 1) { let j = pts.length - 1; while (j > i + 1 && !los(pts[i][0], pts[i][1], pts[j][0], pts[j][1])) j--; out.push(pts[j]); i = j; }
  return out;
}
