'use strict';

/* ---------- Montagem do escritório a partir da ficha gerada pela IA ----------
   A IA decide o conteúdo (equipe, papéis, nomes, estilo, áreas). O espaço sai daqui:
   a planta-base testada, com trocas que ocupam o mesmo lugar. Assim nunca sai móvel
   encavalado nem caminho bloqueado. officeProblems() confere isso. */
const STYLE_PRESETS = {
  moderno:      { floor: 'porcelanato', wall: '#C2D2DE' },
  aconchegante: { floor: 'madeira_clara', wall: '#ECE5D6' },
  clinico:      { floor: 'porcelanato', wall: '#CAD8C1' },
  criativo:     { floor: 'lilas', wall: '#EBCBB7', extra: true },
  industrial:   { floor: 'cimento', wall: '#3A3C44' },
};
const KIND_ORDER = ['coordena', 'produz', 'revisa', 'pesquisa', 'entrega'];
// Vagas para móveis extras (catálogo ou criados pela IA): junto às paredes, 1 quadrado de fundo,
// com o lado de uso virado para dentro da sala. Testadas por npm run check:layouts.
const SLOTS = [
  { x: 0, z: 2, len: 3, rot: 3 },   // parede esquerda
  { x: 2, z: 10, len: 3, rot: 2 },  // frente, à esquerda da entrada
  { x: 0, z: 5, len: 2, rot: 3 },   // parede esquerda, mais à frente
  { x: 15, z: 7, len: 2, rot: 1 },  // borda direita, perto do lounge
  { x: 10, z: 9, len: 3, rot: 2, replaces: ['sofa', 'centro'], needs: (o) => !o.some(x => x.item === 'chroma') }, // lugar do sofá
  { x: 8, z: 0, len: 1, rot: 0 },   // parede do fundo, ao lado da geladeira
];
// põe cada móvel na primeira vaga livre em que ele cabe; o que não couber fica de fora
function placeExtras(ids, objects) {
  const free = SLOTS.filter(s => !s.needs || s.needs(objects)).map(s => ({ ...s, used: false })), out = [];
  for (const id of ids) {
    const it = ITEMS[id]; if (!it || it.d !== 1) continue;
    // a menor vaga em que cabe (na ordem da lista quando empata): móvel pequeno não ocupa vaga grande
    const slot = free.filter(s => !s.used && s.len >= it.w).sort((p, q) => p.len - q.len)[0]; if (!slot) continue;
    slot.used = true; out.push({ id: 'extra-' + out.length + '-' + id, item: id, x: slot.x, z: slot.z, rot: slot.rot });
    if (slot.replaces) objects.splice(0, objects.length, ...objects.filter(o => !slot.replaces.includes(o.id)));
  }
  return out;
}

function officeWorld(spec) {
  const base = tplSala(), st = STYLE_PRESETS[spec.style] || STYLE_PRESETS.moderno;
  const starts = base.people.map(p => p.pos);
  let objects = base.objects.map(o => ({ ...o }));
  const swap = (id, o) => { objects = objects.map(x => x.id === id ? { ...o, id } : x); };
  const drop = (...ids) => { objects = objects.filter(x => !ids.includes(x.id)); };
  if (spec.delivery === 'impressora') swap('rack', { item: 'printer', x: 15, z: 1, rot: 0 });
  if (spec.areas?.reception) swap('mesa-1', { item: 'reception', x: 2, z: 7, rot: 0 });
  if (spec.areas?.studio) {
    drop('sofa', 'centro', 'tapete');
    objects.push({ id: 'chroma', item: 'chroma', x: 10, z: 10, rot: 0 }, { id: 'camera', item: 'tripod', x: 11, z: 7, rot: 2 }, { id: 'refletor', item: 'softbox', x: 10, z: 7, rot: 2 }, { id: 'pufe', item: 'pouf', x: 12, z: 9, rot: 0 });
  }
  if (st.extra) objects.push({ id: 'luz-cor', item: 'colorlight', x: 14, z: 9, rot: 0, color: '#A855F7' });
  objects.push({ id: 'entrada', item: 'capacho', x: 5, z: 10, rot: 0 });
  // móveis do catálogo escolhidos pela IA + móveis criados por ela (registrados antes, em registerCustom)
  for (const c of spec.custom || []) registerCustom(c);
  objects.push(...placeExtras([...(spec.custom || []).map(c => c.id), ...(spec.extras || [])], objects));

  // papéis: cores seguem o tipo, para a equipe ficar legível
  const roles = {}; const usedColors = new Set();
  for (const r of [...spec.roles].sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind))) {
    const c = ROLE_COLORS.find(x => !usedColors.has(x)) || '#5C5866'; usedColors.add(c);
    roles[r.id] = { n: r.name, c, kind: KINDS[r.kind] ? r.kind : 'produz' };
  }
  const people = spec.team.slice(0, starts.length).map((m, i) => ({
    id: 'p-' + i + '-' + m.name.toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, ''),
    name: m.name, ...randomLook(), role: m.role, bio: m.bio || '', pos: starts[i],
  }));
  return normalize({
    name: spec.name, service: spec.service || '', officeId: spec.createdAt || null,
    tiles: rectTiles(16, 11, st.floor), wall: st.wall, floorMat: st.floor,
    objects, walls: base.walls.map(w => ({ ...w })), people, roles, labels: { ...(spec.labels || {}) },
    demo: { tasks: spec.tasks || [], research: spec.research || [] },
    custom: spec.custom || [],
  });
}

// Confere a planta: móveis sem sobreposição, pessoas em lugar livre e todo lugar de uso alcançável.
function officeProblems(w) {
  const keep = W, keepNav = NAV, out = [];
  try {
    W = w; NAV = null;
    for (const o of W.objects) { const r = footprintOk(o, o, o.id); if (r !== 'ok') out.push(`${ITEMS[o.item].n}: ${r}`); }
    for (const x of warnings()) out.push(x.text);
    buildNav();
    const start = nearestCell(W.people[0]?.pos[0] ?? 1.5, W.people[0]?.pos[1] ?? 1.5, 6);
    if (!start) out.push('sem ponto de partida livre');
    else {
      for (const p of W.people) { const c = nearestCell(p.pos[0], p.pos[1], 3); if (!c || !findPath(start[0], start[1], c[0], c[1])) out.push(`${p.name} não alcança o resto da sala`); }
      // TV e plantas são decorativas: nenhum estado de trabalho depende delas
      const needed = (o) => (SPOTS[o.item] || []).some(sp => sp[2] !== 'plants');
      const objsWithSpots = new Set(W.objects.filter(needed).map(o => o.id)), reached = new Set();
      for (const sp of NAV.spots) if (findPath(start[0], start[1], sp.stand[0], sp.stand[1])) reached.add(sp.id.split('#')[0]);
      for (const id of objsWithSpots) if (!reached.has(id)) out.push(`${ITEMS[W.objects.find(o => o.id === id).item].n}: ninguém consegue usar`);
    }
  } finally { W = keep; NAV = keepNav; }
  return out;
}

// carrega o escritório da ficha e entra no modo ao vivo, com o campo de tarefa em foco
function applyOffice(spec) {
  const w = officeWorld(spec), problems = officeProblems(w);
  if (problems.length) console.warn('Planta com problemas:', problems);
  loadWorld(w, `Escritório "${spec.name}" pronto`);
  renderBrand();
  if (window.PIXELHQ_BRIDGE) { setMode('live'); }
  renderMenu();
  const ex = spec.tasks?.[0];
  if (ex) $('#ask-in').placeholder = `Descreva uma tarefa para a equipe. Ex.: ${ex}`;
  setTimeout(() => $('#ask-in')?.focus(), 50);
}
function renderBrand() {
  const el = $('.brand span'); if (!el) return;
  el.textContent = W.officeId ? W.name : 'Novo editor · protótipo para teste';
}

/* ---------- Móveis criados pela IA ----------
   Chegam do servidor já validados (server/furniture.mjs). Aqui só conferimos de novo o formato,
   registramos o móvel no catálogo desta sessão e criamos o lugar com a finalidade dele. */
const HEX = /^#[0-9a-f]{6}$/i;
function registerCustom(c) {
  if (!c || !/^c_[a-z0-9_]{1,40}$/.test(c.id) || !/^x_[a-z0-9_]{1,40}$/.test(c.act) || !/^p_[a-z0-9_]{1,40}$/.test(c.place)) return false;
  const w = Math.max(1, Math.min(3, c.w | 0)), ok = (n) => Number.isFinite(n);
  let boxes;
  if (c.base && ITEMS[c.base] && SPOTS[c.base]) {
    // plano B: um móvel do catálogo com outro nome e outra finalidade
    boxes = ITEMS[c.base].boxes; ITEMS[c.id] = { ...ITEMS[c.base], n: String(c.name).slice(0, 40), cat: 'personalizado', boxes };
    SPOTS[c.id] = SPOTS[c.base].map(sp => [sp[0], sp[1], c.act, sp[3], sp[4], sp[5]]);
  } else {
    boxes = (c.boxes || []).filter(b => Array.isArray(b) && b.slice(0, 6).every(ok) && HEX.test(b[6])).slice(0, 16)
      .map(([x, z, bw, bd, y, h, col, glow]) => B(x, z, bw, bd, y, h, col, glow ? { g: col } : undefined));
    if (!boxes.length) return false;
    ITEMS[c.id] = { n: String(c.name).slice(0, 40), cat: 'personalizado', w, d: 1, boxes };
    SPOTS[c.id] = [[w / 2, 1.45, c.act, 0, 0, -1]];
  }
  AFFN[c.act] = String(c.name).slice(0, 40);
  ACTS[c.act] = { label: String(c.purpose || c.name).slice(0, 30), go: 'Indo usar ' + String(c.name).slice(0, 30), icon: null, w: 0, dur: [8, 12], lunch: 0 };
  PLACES[c.place] = { acts: [c.act, 'work'], why: String(c.purpose || c.name).slice(0, 60) };
  return true;
}
