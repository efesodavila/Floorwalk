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
const KIND_ORDER = ['coordena', 'produz', 'atende', 'opera', 'revisa', 'pesquisa', 'entrega'];
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
// sala grande (equipe de 7 a 10): a parede direita vai de x=16 para x=22; as vagas da borda direita acompanham
const BIG = { width: 22, dx: 6 };
const slotsFor = (big) => SLOTS.map(s => big && s.x === 15 ? { ...s, x: 15 + BIG.dx } : s).concat(big ? [{ x: 17, z: 10, len: 3, rot: 2 }] : []);
// lugares de partida das pessoas 7 a 10 (na ala nova)
const BIG_STARTS = [[16.5, 6.25], [20.5, 6.25], [20.75, 8.75], [17.25, 9.25]];
// planta em L: uma ala na frente, à esquerda (x 0..6, z 11..15), com a porta de entrada e uma sala de espera.
// A frente e a direita da ala ficam abertas para a câmera (como o resto da sala), então o L aparece inteiro.
const WING = { x0: 0, x1: 7, z0: 11, z1: 16 };
const WING_OBJECTS = [
  { id: 'ala-tapete', item: 'rug', x: 2, z: 12, rot: 0 }, { id: 'ala-mesa', item: 'ctable', x: 2, z: 12, rot: 0 },
  { id: 'ala-sofa', item: 'sofa', x: 2, z: 14, rot: 2 }, { id: 'ala-poltrona', item: 'armchair', x: 5, z: 12, rot: 3 },
  { id: 'ala-palmeira', item: 'palm', x: 6, z: 15, rot: 0 }, { id: 'ala-luz', item: 'floorlamp', x: 6, z: 14, rot: 0 },
];
// põe cada móvel na primeira vaga livre em que ele cabe; o que não couber fica de fora
function placeExtras(ids, objects, big = false) {
  const free = slotsFor(big).filter(s => !s.needs || s.needs(objects)).map(s => ({ ...s, used: false })), out = [];
  for (const id of ids) {
    const it = ITEMS[id]; if (!it || it.d !== 1) continue;
    // a menor vaga em que cabe (na ordem da lista quando empata): móvel pequeno não ocupa vaga grande
    const slot = free.filter(s => !s.used && s.len >= it.w).sort((p, q) => p.len - q.len)[0]; if (!slot) continue;
    slot.used = true; out.push({ id: 'extra-' + out.length + '-' + id, item: id, x: slot.x, z: slot.z, rot: slot.rot });
    if (slot.replaces) objects.splice(0, objects.length, ...objects.filter(o => !slot.replaces.includes(o.id)));
  }
  return out;
}

function wingTiles(m) { const t = {}; for (let x = WING.x0; x < WING.x1; x++) for (let z = WING.z0; z < WING.z1; z++) t[key(x, z)] = m; return t; }
function officeWorld(spec) {
  const base = tplSala(), st = STYLE_PRESETS[spec.style] || STYLE_PRESETS.moderno;
  const big = (spec.team?.length || 0) > base.people.length, L = spec.layout === 'L';
  const starts = base.people.map(p => p.pos).concat(big ? BIG_STARTS : []);
  let objects = base.objects.map(o => ({ ...o }));
  if (big) {
    // ala nova à direita: o que encostava na parede direita muda para a nova parede; segunda ilha e mais uma mesa
    objects = objects.map(o => o.id === 'rack' || o.id === 'palmeira-2' ? { ...o, x: o.x + BIG.dx } : o);
    objects.push({ id: 'ilha-2', item: 'island', x: 17, z: 1, rot: 0 }, { id: 'mesa-3', item: 'desk', x: 18, z: 6, rot: 0 }, { id: 'palmeira-3', item: 'palm', x: 16, z: 0, rot: 0 });
  }
  const swap = (id, o) => { objects = objects.map(x => x.id === id ? { ...o, id } : x); };
  const drop = (...ids) => { objects = objects.filter(x => !ids.includes(x.id)); };
  if (spec.delivery === 'impressora') swap('rack', { item: 'printer', x: big ? 15 + BIG.dx : 15, z: 1, rot: 0 });
  if (spec.areas?.reception) swap('mesa-1', { item: 'reception', x: 2, z: 7, rot: 0 });
  if (spec.areas?.studio) {
    drop('sofa', 'centro', 'tapete');
    objects.push({ id: 'chroma', item: 'chroma', x: 10, z: 10, rot: 0 }, { id: 'camera', item: 'tripod', x: 11, z: 7, rot: 2 }, { id: 'refletor', item: 'softbox', x: 10, z: 7, rot: 2 }, { id: 'pufe', item: 'pouf', x: 12, z: 9, rot: 0 });
  }
  if (st.extra) objects.push({ id: 'luz-cor', item: 'colorlight', x: 14, z: 9, rot: 0, color: '#A855F7' });
  // em L: a floreira do canto vai para o fundo da ala (o canto vira passagem) e a ala ganha a sala de espera
  if (L) { objects = objects.map(o => o.id === 'floreira' ? { ...o, x: 0, z: WING.z1 - 1 } : o); objects.push(...WING_OBJECTS.map(o => ({ ...o }))); }
  // entrada: porta na parede da esquerda (na ala, quando em L); o 3D abre ali a porta por onde a equipe entra e sai
  objects.push(L ? { id: 'entrada', item: 'capacho', x: 0, z: 12, rot: 3 } : { id: 'entrada', item: 'capacho', x: 0, z: 8, rot: 1 });
  // móveis do catálogo escolhidos pela IA + móveis criados por ela (registrados antes, em registerCustom)
  for (const c of spec.custom || []) registerCustom(c);
  objects.push(...placeExtras([...(spec.custom || []).map(c => c.id), ...(spec.extras || [])], objects, big));

  // papéis: cores seguem o tipo, para a equipe ficar legível
  const roles = {}; const usedColors = new Set();
  for (const r of [...spec.roles].sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind))) {
    const c = ROLE_COLORS.find(x => !usedColors.has(x)) || '#5C5866'; usedColors.add(c);
    roles[r.id] = { n: r.name, c, kind: KINDS[r.kind] ? r.kind : 'produz' };
  }
  const people = spec.team.slice(0, starts.length).map((m, i) => ({
    id: 'p-' + i + '-' + m.name.toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, ''),
    name: m.name, ...randomLook(genderOfName(m.name)), role: m.role, bio: m.bio || '', pos: starts[i],
  }));
  return normalize({
    name: spec.name, service: spec.service || '', officeId: spec.createdAt || null,
    tiles: { ...rectTiles(big ? BIG.width : 16, 11, st.floor), ...(L ? wingTiles(st.floor) : {}) }, wall: st.wall, floorMat: st.floor,
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
    boxes = ITEMS[c.base].boxes; ITEMS[c.id] = { ...ITEMS[c.base], n: String(c.name).slice(0, 40), cat: 'personalizado', boxes, look3d: ITEMS[c.base].look3d || c.base };
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

/* ---------- Crítica visual dos móveis criados pela IA ----------
   A IA que desenha o móvel não vê o resultado. Aqui a página tira uma foto 3D de cada móvel desenhado (não os de
   plano B, que já são do catálogo) e manda ao servidor. Se a nota for baixa, a IA propõe outro desenho; a página tira
   a foto do desenho proposto e manda de novo: ele só fica se a nota subir. No máximo 2 chamadas por móvel, uma vez. */
let reviewing = false;
const postCritique = (body) => fetch('/api/office/critique', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(x => x.json());
async function reviewCustomFurniture(spec) {
  if (reviewing || !window.PIXELHQ_BRIDGE || !spec?.custom?.length) return;
  const todo = spec.custom.filter(c => !c.reviewed && !c.base && Array.isArray(c.boxes));
  if (!todo.length) return;
  reviewing = true;
  try {
    // o 3D carrega depois dos scripts: espera até 20 s pela câmera de fotos
    for (let i = 0; i < 40 && !window.R3D?.itemShot; i++) await new Promise(r => setTimeout(r, 500));
    if (!window.R3D?.itemShot) return;
    for (const c of todo) {
      if (!ITEMS[c.id] && !registerCustom(c)) continue;
      let r;
      try {
        r = c.pending ? { ok: true, pending: true, custom: c } : await postCritique({ id: c.id, image: R3D.itemShot(c.id) });
        if (r?.ok && r.pending && r.custom?.pending) {
          // foto do desenho proposto num item temporário, só para a avaliação
          const cand = { ...c, ...r.custom, id: c.id + '__cand', w: r.custom.pending.w, boxes: r.custom.pending.boxes };
          registerCustom(cand); const image = R3D.itemShot(cand.id); delete ITEMS[cand.id];
          r = await postCritique({ id: c.id, image, candidate: true });
        }
      } catch { continue; }
      if (!r?.ok || !r.custom) continue;
      Object.assign(c, r.custom); delete c.pending;
      const mine = (W.custom || []).find(x => x.id === c.id); if (mine) { Object.assign(mine, r.custom); delete mine.pending; }
      if (r.changed) { registerCustom(c); save(); window.R3D?.rebuild?.(); renderPanel(); toast(`A IA olhou o desenho de "${c.name}" e melhorou (nota ${r.score} de 5).`); }
    }
  } finally { reviewing = false; }
}
