'use strict';

/* ---------- Animações dos elementos ---------- */
// marca as peças que se mexem
for (const k of ['desk', 'island']) ITEMS[k].boxes.forEach(b => { if (b.g === '#9D6BFF') b.screen = 1; });
ITEMS.tv.boxes.slice(4).forEach((b, i) => { b.bar = i; });
ITEMS.rack.boxes.forEach((b, i) => { if (b.g) b.led = i; });
ITEMS.coffee.boxes[5].steam = 1;
ITEMS.tripod.boxes[4].blink = 1;
ITEMS.colorlight.boxes[2].pulse = 1;
ITEMS.palm.boxes.slice(2).forEach(b => { b.sway = 1; });
ITEMS.planter.boxes.slice(1).forEach(b => { b.sway = 1; });
ITEMS.printer.boxes.push(B(.3, .48, .4, .03, .73, .01, '#FFFFFF', { paper: 1 }));
ITEMS.kanban.boxes = ITEMS.kanban.boxes.slice(0, 6); ITEMS.kanban.dyn = 'kanban';
const WORK_ST = new Set(['trabalhando', 'revisando', 'planejando', 'entregando', 'pesquisando', 'reuniao']);
let ACTIVE = new Map();
function computeActive() {
  const m = new Map(); if (mode !== 'live') return m;
  for (const a of sim.agents) { if (a.mv !== 'act' || !a.spot) continue; const o = a.spot.id.split('#')[0]; if (!m.has(o)) m.set(o, new Set()); m.get(o).add(a.idleAct || a.status); }
  return m;
}
/* quadro kanban: as colunas mostram o andamento real do projeto */
function kanbanCounts() {
  if (mode !== 'live') return [4, 2, 3];
  const doing = sim.agents.filter(a => ['trabalhando', 'revisando', 'entregando'].includes(a.status)).length;
  if (sim.source === 'demo' && demo.a) return [demoTasks().length - demo.idx, doing, demo.done];
  const tasks = new Set(sim.feed.filter(e => e.task).map(e => e.task)), done = new Set(sim.feed.filter(e => e.st === 'concluido' && e.task).map(e => e.task)).size;
  return [Math.max(0, tasks.size - done - doing), doing, done];
}
function kanbanNotes() {
  const cnt = kanbanCounts(), cols = ['#F2B630', '#7FC4E8', '#3AA655'], out = [];
  cnt.forEach((n, c) => { for (let i = 0; i < Math.min(6, n); i++) { const r = Math.floor(i / 2), s = i % 2; out.push(B(.1 + c * .65 + s * .27, .5, .22, .01, 1.66 - r * .3, .22, cols[c], { note: c * 6 + i })); } });
  return out;
}
function animBox(b, T) {
  if (b.bar != null) { const k = .5 + .5 * (.5 + .5 * Math.sin(T * 1.3 + b.bar * 1.7)); return { ...b, h: b.h * k }; }
  if (b.led != null) {
    const fast = ACTIVE.get(b.obj)?.has('entregando'), ph = Math.sin(T * (fast ? 9 : 1.6) * (1 + b.led * .31) + b.led * 2.3);
    return ph > (fast ? 0 : -.35) ? b : { ...b, c: '#1F3326', g: null };
  }
  if (b.blink) return Math.floor(T * 1.6) % 2 ? b : { ...b, c: '#4A1C19', g: null };
  if (b.pulse) return { ...b, ga: .55 + .45 * Math.sin(T * 1.2) };
  if (b.paper) return ACTIVE.get(b.obj)?.has('print') ? { ...b, d: .03 + ((T * .7) % 1) * .42 } : b;
  if (b.sway) { const s = Math.sin(T * 1.1 + b.y * 4 + (b.obj || '').length) * .025; return { ...b, x: b.x + s, z: b.z - s * .5 }; }
  if (b.note != null && ACTIVE.get(b.obj)?.has('planejando')) return { ...b, y: b.y + Math.max(0, Math.sin(T * 5 + b.note)) * .05 };
  return b;
}
/* conteúdo das telas: código rolando quando alguém trabalha ali; descanso de tela no resto do tempo */
function drawScreen(c, b, V, T) {
  const n = b.n || [0, 1]; if (n[0] < -.5 || n[1] < -.5) return;
  const onZ = n[1] > .5;
  const P = (u, v) => onZ ? iso(b.x + u * b.w, b.z + b.d, b.y + v * b.h, V) : iso(b.x + b.w, b.z + b.d * (1 - u), b.y + v * b.h, V);
  const quad = [P(0, 0), P(1, 0), P(1, 1), P(0, 1)];
  const busy = ACTIVE.get(b.obj), working = busy && [...busy].some(s => WORK_ST.has(s));
  c.save(); c.beginPath(); quad.forEach((q, i) => i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1])); c.closePath(); c.clip();
  c.fillStyle = working ? '#1C1636' : '#2B2742'; c.fill();
  const lw = Math.max(1, Math.round(V.z * .8));
  if (working) {
    const scroll = T * 1.6 + b.x * 3, rows = 5;
    for (let r = 0; r <= rows; r++) {
      const k = Math.floor(scroll) + r, v = 1 - (r + 1 - (scroll % 1)) / (rows + 1); if (v < .08 || v > .92) continue;
      const ind = Math.floor(hash(k, 3) * 3) * .09, len = .18 + hash(k * 7, 5) * .5, col = ['#B79CFF', '#7FE0B0', '#FFD36B', '#E9E4F5'][Math.floor(hash(k, 11) * 4)];
      line(c, P(.08 + ind, v), P(Math.min(.92, .08 + ind + len), v), col, lw);
    }
  } else {
    const a = .3 + .25 * Math.sin(T * 1.4 + b.x), m = P(.5 + .25 * Math.sin(T * .5 + b.z), .5);
    c.fillStyle = `rgba(157,107,255,${a.toFixed(2)})`; c.fillRect(m[0] - 2 * lw, m[1] - 2 * lw, 4 * lw, 4 * lw);
  }
  c.restore();
}
/* porta (folha giratória) desenhada como prisma */
function drawPrism(c, b, V, alpha = 1) {
  const P = b.prism, y = b.y, h = b.h, p = (X, Z, Y) => iso(X, Z, Y, V);
  const cx = P.reduce((s, q) => s + q[0], 0) / 4, cz = P.reduce((s, q) => s + q[1], 0) / 4, faces = [];
  for (let i = 0; i < 4; i++) { const A = P[i], Bq = P[(i + 1) % 4], mx = (A[0] + Bq[0]) / 2, mz = (A[1] + Bq[1]) / 2; if ((mx - cx) + (mz - cz) <= 1e-6) continue; faces.push({ A, B: Bq, k: mx + mz }); }
  faces.sort((f, g) => f.k - g.k);
  c.globalAlpha = alpha;
  for (const f of faces) {
    const q = [p(f.A[0], f.A[1], y), p(f.B[0], f.B[1], y), p(f.B[0], f.B[1], y + h), p(f.A[0], f.A[1], y + h)];
    const alongX = Math.abs(f.B[0] - f.A[0]) > Math.abs(f.B[1] - f.A[1]);
    if (b.glass) poly(c, q, 'rgba(185,218,240,0.34)', 'rgba(94,130,160,0.7)');
    else poly(c, q, alongX ? faceL(b.c) : faceR(b.c), shade(b.c, .55));
  }
  const top = P.map(q => p(q[0], q[1], y + h));
  if (b.glass) poly(c, top, 'rgba(200,230,245,0.5)', 'rgba(94,130,160,0.7)'); else poly(c, top, b.c, shade(b.c, .55));
  if (!b.glass) { const kx = P[1][0] * .82 + P[0][0] * .18 + (P[3][0] - P[0][0]) * 1.4, kz = P[1][1] * .82 + P[0][1] * .18 + (P[3][1] - P[0][1]) * 1.4, k = p(kx, kz, 1.0); c.fillStyle = '#F2B630'; c.fillRect(k[0] - 1, k[1] - 1, Math.max(2, V.z * 1.5), Math.max(2, V.z * 1.5)); }
  c.globalAlpha = 1;
}
/* portas abrem quando alguém chega perto e fecham depois */
const DOORS = new Map();
function doorCenter(s) { const I = segInfo(s), d = I.u0 + Math.floor((I.len - 1) / 2) + .5; return I.alongX ? [d, I.c] : [I.c, d]; }
function doorStep(dt) {
  for (const s of W.walls) {
    if (s.kind !== 'porta' && s.kind !== 'vidro_porta') continue;
    const [cx, cz] = doorCenter(s);
    const near = mode === 'live' && sim.agents.some(a => !a.held && Math.hypot(a.x - cx, a.z - cz) < 1.25);
    const cur = DOORS.get(s.id) || 0, target = near ? 1 : 0;
    DOORS.set(s.id, cur + (target - cur) * Math.min(1, dt * (near ? 7 : 3)));
  }
}
/* vapor da máquina de café */
function drawSteam(c, b, V, T) {
  const top = b.y + b.h, cx = b.x + b.w / 2, cz = b.z + b.d / 2, s = Math.max(2, Math.round(V.z * 1.5));
  for (let k = 0; k < 4; k++) {
    const ph = (T * .55 + k / 4) % 1, [sx, sy] = iso(cx + Math.sin(T * 2 + k) * .08, cz, top + ph * 1.1, V);
    c.fillStyle = `rgba(255,255,255,${((1 - ph) * .7).toFixed(2)})`; const r = s * (1 + ph * 1.5); c.fillRect(Math.round(sx - r / 2), Math.round(sy - r / 2), Math.round(r), Math.round(r));
  }
}
