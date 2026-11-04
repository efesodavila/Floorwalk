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
  // palmeira e abajur virados para dentro da ala (rot 1): o ponto de uso de cada um cai num quadrado livre
  // (antes o do abajur caía na palmeira e o da palmeira fora da sala)
  { id: 'ala-palmeira', item: 'palm', x: 6, z: 15, rot: 1 }, { id: 'ala-luz', item: 'floorlamp', x: 6, z: 13, rot: 1 },
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

/* ---------- Gerador de planta (decisão do dono, 2026-11-04) ----------
   Cada negócio pedido de novo ganha uma sala NOVA, montada do zero com os móveis da biblioteca: tamanho pela equipe,
   móveis de parede nas paredes (virados para dentro), ilhas/reunião/lounge no meio com corredor em volta, sorteio
   próprio do pedido (createdAt). officeProblems() confere cada tentativa; sem nenhuma boa, fica a planta-base. */
function seededRandom(seedText) {
  let h = 2166136261; for (const ch of String(seedText)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function generateOffice(spec, attempt) {
  const rnd = seededRandom(`${spec.createdAt || ''}|${spec.name || ''}|${attempt}`);
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const n = Math.max(1, spec.team?.length || 1), grow = Math.floor(attempt / 8);
  // Ficha nova: a IA escolheu TODOS os móveis (spec.furniture) — a sala tem só eles, nada de pacote de escritório.
  // Ficha antiga (sem a lista): o programa padrão de escritório de antes. take(id) tira um da sacola (sempre true sem lista).
  const listMode = Array.isArray(spec.furniture) && spec.furniture.length > 0, bag = new Map();
  if (listMode) for (const id of spec.furniture) if (ITEMS[id]) bag.set(id, (bag.get(id) || 0) + 1);
  const take = (id) => { if (!listMode) return true; const c = bag.get(id) || 0; if (!c) return false; bag.set(id, c - 1); return true; };
  const inBag = (id) => !listMode || (bag.get(id) || 0) > 0;
  // tamanho: pela equipe (sem lista) ou pela área que os móveis escolhidos pedem (com folga para circular)
  const need = listMode ? [...bag].reduce((s, [id, c]) => s + c * (ITEMS[id].w + 1) * (ITEMS[id].d + 1), 0) + n * 3 : 0;
  const WD = listMode ? Math.min(30, Math.max(12, Math.round(Math.sqrt(need * 1.7))) + Math.floor(rnd() * 3) + grow) : Math.min(30, (n > 6 ? 21 : 16) + Math.floor(rnd() * 3) + grow);
  const DP = listMode ? Math.min(20, Math.max(10, Math.ceil(need / WD) + 4) + grow) : Math.min(18, 11 + Math.floor(rnd() * 2) + grow);
  const occ = new Map(); // 'x,z' → 1 móvel | 2 área de uso/corredor (dá para andar, não dá para pôr móvel)
  // planta em L: ala na frente, à esquerda, com a entrada e a sala de espera (a frente e a direita da ala ficam abertas)
  const L = spec.layout === 'L', wing = L ? { x0: 0, x1: 7, z0: DP, z1: DP + 5 } : null;
  const inWing = (x, z) => !!wing && x >= wing.x0 && x < wing.x1 && z >= wing.z0 && z < wing.z1;
  // REG: enquanto monta o miolo de uma sala fechada, "dentro" vale só para o retângulo dela
  let REG = null;
  const cell = (x, z) => occ.get(x + ',' + z) || 0;
  const inside = (x, z) => REG ? (x >= REG.x0 && x < REG.x1 && z >= REG.z0 && z < REG.z1) : ((x >= 0 && z >= 0 && x < WD && z < DP) || inWing(x, z));
  const walls = [];
  const reserve = (x, z) => { if (inside(x, z) && !occ.get(x + ',' + z)) occ.set(x + ',' + z, 2); };
  const objects = [];
  // ponto do item (px, pz) no mundo, para o giro do catálogo (a cada passo: (x, z) → (D − z, x))
  const rotPt = (it, rot, px, pz) => rot === 1 ? [it.d - pz, px] : rot === 2 ? [it.w - px, it.d - pz] : rot === 3 ? [pz, it.w - px] : [px, pz];
  const dimsOf = (it, rot) => rot % 2 ? [it.d, it.w] : [it.w, it.d];
  const areaFree = (x, z, fw, fd) => { for (let i = 0; i < fw; i++) for (let j = 0; j < fd; j++) if (!inside(x + i, z + j) || cell(x + i, z + j)) return false; return true; };
  const ringFree = (x, z, fw, fd) => { for (let i = -1; i <= fw; i++) for (let j = -1; j <= fd; j++) { if (i >= 0 && i < fw && j >= 0 && j < fd) continue; if (cell(x + i, z + j) === 1) return false; } return true; };
  function fits(id, x, z, rot, ring) {
    const it = ITEMS[id]; if (!it) return false;
    const [fw, fd] = dimsOf(it, rot);
    if (!areaFree(x, z, fw, fd)) return false;
    for (const sp of SPOTS[id] || []) { const [wx, wz] = rotPt(it, rot, sp[0], sp[1]), cx = Math.floor(x + wx), cz = Math.floor(z + wz); if (!inside(cx, cz) || cell(cx, cz) === 1 && !(cx >= x && cx < x + fw && cz >= z && cz < z + fd)) return false; }
    return !ring || ringFree(x, z, fw, fd);
  }
  function put(id, x, z, rot, ring, extra = {}) {
    const it = ITEMS[id], [fw, fd] = dimsOf(it, rot);
    for (let i = 0; i < fw; i++) for (let j = 0; j < fd; j++) occ.set((x + i) + ',' + (z + j), 1);
    for (const sp of SPOTS[id] || []) { const [wx, wz] = rotPt(it, rot, sp[0], sp[1]); reserve(Math.floor(x + wx), Math.floor(z + wz)); }
    if (ring) for (let i = -1; i <= fw; i++) for (let j = -1; j <= fd; j++) reserve(x + i, z + j);
    const o = { id: extra.id || `g-${objects.length}-${id}`, item: id, x, z, rot, ...extra }; objects.push(o); return o;
  }
  // encosta numa parede (fundo, esquerda, direita; frente só para o que é baixo), virado para dentro, com passagem na frente
  function onWall(id, walls = ['back', 'left', 'right'], extra = {}) {
    const it = ITEMS[id]; if (!it) return null;
    for (const wall of shuffle(walls)) {
      const rot = { back: 0, left: 3, right: 1, front: 2 }[wall], [fw, fd] = dimsOf(it, rot), cands = [];
      // em L, o trecho da frente que dá para a ala é passagem aberta: nada encostado ali
      if (wall === 'back' || wall === 'front') for (let x = wall === 'front' && L ? wing.x1 : 0; x + fw <= WD; x++) cands.push([x, wall === 'back' ? 0 : DP - fd]);
      else for (let z = 0; z + fd <= DP; z++) cands.push([wall === 'left' ? 0 : WD - fw, z]);
      for (const [x, z] of shuffle(cands)) if (fits(id, x, z, rot, false)) {
        const o = put(id, x, z, rot, false, extra);
        for (let i = 0; i < fw; i++) for (let j = 0; j < fd; j++) { if (rot === 0) reserve(x + i, z + fd); else if (rot === 2) reserve(x + i, z - 1); else if (rot === 3) reserve(x + fw, z + j); else reserve(x - 1, z + j); }
        return o;
      }
    }
    return null;
  }
  // vários iguais LADO A LADO na mesma parede (araras, vitrines, estantes de loja), com passagem livre na frente
  function onWallRow(id, count, walls = ['back', 'left', 'right']) {
    const it = ITEMS[id]; if (!it || count < 2) return false;
    for (const wall of shuffle(walls)) {
      const rot = { back: 0, left: 3, right: 1, front: 2 }[wall], [fw, fd] = dimsOf(it, rot), horiz = wall === 'back' || wall === 'front';
      const len = (horiz ? fw : fd) * count, cands = [];
      if (horiz) for (let x = wall === 'front' && L ? wing.x1 : 0; x + len <= WD; x++) cands.push([x, wall === 'back' ? 0 : DP - fd]);
      else for (let z = 0; z + len <= DP; z++) cands.push([wall === 'left' ? 0 : WD - fw, z]);
      for (const [x, z] of shuffle(cands)) {
        const at = (k) => horiz ? [x + k * fw, z] : [x, z + k * fd];
        let ok = true; for (let k = 0; k < count && ok; k++) ok = fits(id, ...at(k), rot, false);
        if (!ok) continue;
        for (let k = 0; k < count; k++) {
          const [px, pz] = at(k); put(id, px, pz, rot, false);
          for (let i = 0; i < fw; i++) for (let j = 0; j < fd; j++) { if (rot === 0) reserve(px + i, pz + fd); else if (rot === 2) reserve(px + i, pz - 1); else if (rot === 3) reserve(px + fw, pz + j); else reserve(px - 1, pz + j); }
        }
        return true;
      }
    }
    return false;
  }
  // no meio da sala, com corredor de 1 quadrado em volta
  function inMiddle(id, rots = [0, 2], extra = {}) {
    const it = ITEMS[id]; if (!it) return null;
    const cands = [];
    for (const rot of rots) { const [fw, fd] = dimsOf(it, rot); for (let x = 2; x + fw <= WD - 2; x++) for (let z = 2; z + fd <= DP - 2; z++) cands.push([x, z, rot]); }
    for (const [x, z, rot] of shuffle(cands)) if (fits(id, x, z, rot, true)) return put(id, x, z, rot, true, extra);
    return null;
  }
  const must = (o, what) => { if (!o) throw new Error('sem lugar para ' + what); return o; };

  // 1. entrada (porta na parede da esquerda; em L, na ala) com passagem livre na frente; em L, a ala vira sala de espera
  // (a ala em L é montada DEPOIS das salas fechadas: os móveis que a IA pôs numa sala vão para ela, não para a ala)
  const placeWing = () => {
    if (!L) return;
    // com lista: a ala usa só o que a IA escolheu (sofá, mesinha, tapete, poltrona, abajur, palmeira)
    for (const o of WING_OBJECTS) { if (!take(o.item)) continue; const z = o.z - WING.z0 + wing.z0; if (o.item === 'rug') objects.push({ ...o, z }); else must(fits(o.item, o.x, z, o.rot, false) ? put(o.item, o.x, z, o.rot, false, { id: o.id }) : null, 'a sala de espera'); }
    for (let x = wing.x0; x < wing.x1; x++) reserve(x, wing.z0 - 1); // a passagem da ala para a sala fica livre
  };
  const dz = L ? wing.z0 + 1 : 3 + Math.floor(rnd() * Math.max(1, DP - 6));
  // a entrada entra depois das salas e da ala (o corredor dela não pode tomar o lugar da sala de espera)
  const placeEntrance = () => {
    must(fits('capacho', 0, dz, 1, false) ? put('capacho', 0, dz, 1, false, { id: 'entrada' }) : null, 'a entrada');
    for (let j = -1; j <= 2; j++) for (let i = 1; i <= 2; i++) reserve(i, dz + j);
  };
  // 1a. salas fechadas que a IA pediu (spec.rooms): encostadas no fundo ou na direita, do tamanho dos móveis de dentro,
  //     paredes do tipo pedido nos lados que dão para a sala grande e porta (ou passagem) no lado mais aberto
  const DOOR_KIND = { alvenaria: 'porta', vidro: 'vidro_porta' }, SIDE_KIND = { alvenaria: 'alvenaria', vidro: 'vidro', meia: 'meia', biombo: 'biombo' };
  for (const [ri, room] of (listMode ? spec.rooms || [] : []).entries()) {
    // todas as cópias de cada móvel da sala vão para dentro dela (2 macas pedidas = as 2 no consultório), até 4 peças
    const items = []; for (const id of room.items) while (ITEMS[id] && items.length < 4 && take(id)) items.push(id);
    if (!items.length) continue;
    const dims = items.map(id => ITEMS[id]);
    const RW = Math.min(10, Math.max(4, dims.reduce((s, it) => s + it.w + 1, 1))), RD = Math.min(8, Math.max(4, Math.max(...dims.map(it => it.d)) + 3));
    // lugares possíveis: ao longo do fundo (z = 0) e da parede direita (x = WD − RW)
    const spots = [];
    for (let x = 0; x + RW <= WD; x++) spots.push([x, 0]);
    for (let z = 1; z + RD <= DP; z++) spots.push([WD - RW, z]);
    let done = false;
    for (const [x0, z0] of shuffle(spots)) {
      const box = { x0, z0, x1: x0 + RW, z1: z0 + RD };
      // a sala não cobre a entrada nem o que já existe, e sobra corredor na frente
      let free = true; for (let x = box.x0; x < box.x1 && free; x++) for (let z = box.z0; z < box.z1; z++) if (cell(x, z) === 1 || (x <= 2 && Math.abs(z - dz) <= 2)) { free = false; break; }
      if (!free || box.z1 >= DP - 2) continue;
      // porta: no lado de baixo (z1) quando der; senão no lado esquerdo (x0)
      const doorSide = box.z1 < DP ? 'bottom' : 'left';
      const mid = doorSide === 'bottom' ? box.x0 + Math.floor((RW - 1) / 2) : box.z0 + Math.floor((RD - 1) / 2);
      // quadrados de dentro junto da porta ficam livres (para entrar), antes de pôr os móveis
      const saved = new Map(occ), before = objects.length;
      if (doorSide === 'bottom') { occ.set(mid + ',' + (box.z1 - 1), 2); occ.set((mid + 1) + ',' + (box.z1 - 1), 2); } else { occ.set(box.x0 + ',' + mid, 2); }
      REG = box; let okAll = true;
      for (const id of items) {
        const it = ITEMS[id], cands = [];
        for (const rot of [0, 2, 1, 3]) { const [fw, fd] = dimsOf(it, rot); for (let x = box.x0; x + fw <= box.x1; x++) for (let z = box.z0; z + fd <= box.z1; z++) cands.push([x, z, rot]); }
        const c = shuffle(cands).find(([x, z, rot]) => fits(id, x, z, rot, false));
        if (!c) { okAll = false; break; }
        put(id, c[0], c[1], c[2], false, { id: `sala${ri}-${id}` });
      }
      REG = null;
      if (!okAll) { occ.clear(); for (const [k, v] of saved) occ.set(k, v); objects.length = before; continue; } // não coube: desfaz e tenta outro lugar
      // a sala inteira é dela (nada de fora entra); corredor livre do lado de fora da porta
      for (let x = box.x0; x < box.x1; x++) for (let z = box.z0; z < box.z1; z++) if (!occ.get(x + ',' + z)) occ.set(x + ',' + z, 1);
      if (doorSide === 'bottom') for (const x of [mid - 1, mid, mid + 1, mid + 2]) { reserve(x, box.z1); reserve(x, box.z1 + 1); }
      else for (const z of [mid - 1, mid, mid + 1]) { reserve(box.x0 - 1, z); reserve(box.x0 - 2, z); }
      // paredes: lados que não são parede externa; no lado da porta, porta (alvenaria/vidro) ou abertura de 2 (meia/painel)
      const side = SIDE_KIND[room.wall] || 'alvenaria', id0 = `g-sala${ri}`;
      const seg = (k, a, b, kind) => walls.push({ id: `${id0}-${k}`, kind, a, b });
      if (box.x0 > 0 && doorSide !== 'left') seg('e', [box.x0, box.z0], [box.x0, box.z1], side);
      if (box.x1 < WD) seg('d', [box.x1, box.z0], [box.x1, box.z1], side);
      if (box.z0 > 0) seg('t', [box.x0, box.z0], [box.x1, box.z0], side);
      const [a, b, len, horiz] = doorSide === 'bottom' ? [box.x0, box.x1, RW, true] : [box.z0, box.z1, RD, false];
      const P = (u, v) => horiz ? [u, box.z1] : [box.x0, u];
      if (DOOR_KIND[room.wall]) seg('p', P(a), P(b), DOOR_KIND[room.wall]);
      else { const g0 = a + Math.floor((len - 2) / 2); if (g0 > a) seg('p1', P(a), P(g0), side); if (g0 + 2 < b) seg('p2', P(g0 + 2), P(b), side); }
      done = true; break;
    }
    if (!done) { const e = new Error('sem lugar para a sala fechada'); throw e; }
  }
  placeWing();
  placeEntrance();
  // 1b. sala de reunião fechada de vidro, num canto do fundo (nem sempre: varia de planta para planta) — só nas fichas
  //     antigas; nas novas, quem decide as salas fechadas é a IA (1a)
  let meetingDone = false;
  if (!listMode && n >= 3 && rnd() < .6) {
    const RW = 7, RD = 6, right = rnd() < .5 || L, x0 = right ? WD - RW : 0;
    // a sala não pode cobrir a entrada nem ocupar mais da metade da largura
    if (WD - RW >= 8 && (right || dz > RD + 1)) {
      let free = true; for (let x = x0; x < x0 + RW; x++) for (let z = 0; z < RD; z++) if (cell(x, z) === 1) free = false;
      if (free) {
        take('meeting'); put('meeting', x0 + 1, 1, 0, false, { id: 'reuniao' });
        if (inBag('tv') && fits('tv', x0 + 2, 0, 0, false)) { take('tv'); put('tv', x0 + 2, 0, 0, false, { id: 'tv' }); }
        // o resto da sala de reunião é dela: nada de fora entra
        for (let x = x0; x < x0 + RW; x++) for (let z = 0; z < RD; z++) occ.set(x + ',' + z, 1);
        const xs = right ? x0 : x0 + RW; // parede lateral do lado de dentro da sala grande
        walls.push({ id: 'g-vidro', kind: 'vidro', a: [xs, 0], b: [xs, RD] });
        walls.push({ id: 'g-vidro-porta', kind: 'vidro_porta', a: [right ? x0 : 0, RD], b: [right ? WD : x0 + RW, RD] });
        // porta no meio da frente da sala: passagem livre dos dois lados
        const mid = right ? x0 + Math.floor(RW / 2) : Math.floor(RW / 2);
        for (const x of [mid - 1, mid, mid + 1]) { occ.set(x + ',' + (RD - 1), 2); reserve(x, RD); reserve(x, RD + 1); }
        meetingDone = true;
      }
    }
  }
  // 2. estúdio (fundo verde na parede do fundo, câmera e luz de frente para ele)
  if (listMode ? inBag('chroma') : spec.areas?.studio) {
    take('chroma');
    const ch = must(onWall('chroma', ['back'], { id: 'chroma' }), 'o estúdio');
    for (let i = 0; i < 3; i++) for (let j = 1; j <= 2; j++) reserve(ch.x + i, j);
    // câmera e luz de frente para o fundo (com lista, só as que a IA escolheu; o resto vai para os lados)
    if (take('tripod')) { if (fits('tripod', ch.x + 1, 3, 2, false)) put('tripod', ch.x + 1, 3, 2, false, { id: 'camera' }); else must(inMiddle('tripod', [2], { id: 'camera' }), 'a câmera'); }
    if (take('softbox')) { if (fits('softbox', ch.x, 3, 2, false)) put('softbox', ch.x, 3, 2, false, { id: 'refletor' }); else inMiddle('softbox', [2], { id: 'refletor' }); }
    if (take('softbox')) { if (fits('softbox', ch.x + 2, 3, 2, false)) put('softbox', ch.x + 2, 3, 2, false, { id: 'refletor-2' }); else inMiddle('softbox', [2]); }
    if (take('pouf')) inMiddle('pouf', [0], { id: 'pufe' });
  }
  // 3. TV e quadro kanban na parede (onde a câmera vê)
  if (take('kanban')) must(onWall('kanban', ['back', 'left'], { id: 'kanban' }), 'o quadro');
  if (!objects.some(o => o.item === 'tv') && take('tv')) onWall('tv', ['back', 'left'], { id: 'tv' });
  // 4. lounge ANTES das mesas (garantido): bloco sofá + tapete + mesinha com corredor em volta e divisória ripada do
  //    lado de dentro da sala. Em L, a sala de espera da ala já é o lounge. Com estúdio, o pufe faz esse papel.
  if (listMode ? (!L && inBag('sofa')) : (!spec.areas?.studio && !L)) {
    take('sofa'); const withTable = take('ctable'), withRug = take('rug');
    const blocks = [];
    for (const rot of [0, 2]) for (let x = 2; x + 3 <= WD - 2; x++) for (let z = 2; z + 3 <= DP - 2; z++) blocks.push([x, z, rot]);
    let ok = false;
    for (const [x, z, rot] of shuffle(blocks)) {
      if (!areaFree(x, z, 3, 3) || !ringFree(x, z, 3, 3)) continue;
      const sz = rot === 2 ? z + 2 : z, tz = rot === 2 ? z : z + 1; // sofá numa ponta do bloco, tapete e mesinha na frente
      put('sofa', x, sz, rot, false, { id: 'sofa' });
      if (withRug) objects.push({ id: 'tapete', item: 'rug', x, z: tz, rot: 0 });
      if (withTable) put('ctable', x, tz, 0, false, { id: 'centro' });
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) occ.set((x + i) + ',' + (z + j), 1); // o bloco é do lounge
      for (let i = -1; i <= 3; i++) for (let j = -1; j <= 3; j++) reserve(x + i, z + j);
      // divisória ripada de 3 no lado de trás do sofá (separa o lounge sem fechar a passagem)
      walls.push({ id: 'g-ripado', kind: 'ripado', a: [x, rot === 2 ? z + 3 : z], b: [x + 3, rot === 2 ? z + 3 : z] });
      ok = true; break;
    }
    must(ok || null, 'o lounge');
    if (take('armchair')) onWall('armchair', ['left', 'right', 'back'], { id: 'poltrona' });
  }
  // COM LISTA: o resto da sacola. Mesas grandes no meio (reunião, recepção, ilhas, mesas), o resto nas paredes.
  // Sempre há pelo menos um lugar de trabalho (se a IA não pôs nenhum, entra uma mesa).
  if (listMode) {
    let k = 0;
    const MID = ['meeting', 'reception', 'island', 'desk'];
    const workplaces = ['desk', 'island', 'reception', ...Object.keys(ITEMS).filter(id => (SPOTS[id] || []).some(s => ['care', 'cook', 'stock', 'sell', 'craft', 'attend'].includes(s[2])))];
    if (!spec.furniture.some(id => workplaces.includes(id))) bag.set('desk', 1);
    for (const id of MID) while (take(id)) { k++; must(inMiddle(id, [0, 2], { id: id + '-' + k }) || onWall(id, ['back', 'left', 'right'], { id: id + '-' + k }), ITEMS[id].n); }
    // iguais de parede em fileira (o que não couber em fileira vai um por um, logo abaixo)
    const rest = [];
    for (const [id, c] of shuffle([...bag])) { if (c >= 2 && ITEMS[id]?.d === 1 && onWallRow(id, c)) continue; for (let i = 0; i < c; i++) rest.push(id); }
    bag.clear();
    for (const id of shuffle(rest)) {
      const it = ITEMS[id], extra = id === 'colorlight' ? { color: '#A855F7' } : {};
      const placed = it.d === 1 ? onWall(id, ['back', 'left', 'right', 'front'], extra) || inMiddle(id, [0, 1, 2, 3], extra) : inMiddle(id, [0, 1, 2, 3], extra) || onWall(id, ['back', 'left', 'right'], extra);
      // móvel de uso (balcão, maca, fogão...) é obrigatório; decoração que não couber fica de fora
      if (!placed && (SPOTS[id] || []).some(s => s[2] !== 'plants')) throw new Error('sem lugar para ' + it.n);
    }
    for (const id of (spec.custom || []).map(c => c.id)) must(onWall(id, ['back', 'left', 'right', 'front']) || inMiddle(id, [0, 1, 2, 3]), ITEMS[id]?.n || id);
    const free = shuffle([...Array(WD * DP).keys()].map(i => [i % WD, Math.floor(i / WD)]).filter(([x, z]) => cell(x, z) !== 1 && x > 0 && z > 0));
    return { WD, DP, wing, walls, objects, starts: free.slice(0, n).map(([x, z]) => [x + .5, z + .5]) };
  }
  // 5. reunião (se não houve sala de vidro), recepção e estações de trabalho (ilhas de 4 e mesas de 1), no meio
  if (n >= 3 && !meetingDone) must(inMiddle('meeting', [0, 2], { id: 'reuniao' }), 'a reunião');
  if (spec.areas?.reception) must(inMiddle('reception', [0, 2], { id: 'recepcao' }) || onWall('reception', ['back'], { id: 'recepcao' }), 'a recepção');
  let seats = n - (spec.areas?.reception ? 1 : 0), k = 0;
  while (seats >= 3 && rnd() < .8) { if (!inMiddle('island', [0, 2], { id: 'ilha-' + (++k) })) break; seats -= 4; }
  while (seats > 0) { k++; must(inMiddle('desk', [0, 2], { id: 'mesa-' + k }) || onWall('desk', ['back', 'left', 'right'], { id: 'mesa-' + k }), 'as mesas'); seats -= 1; }
  // 6. copa, entrega, leitura e plantas nas paredes
  must(onWall('coffee', ['back', 'right'], { id: 'cafe' }), 'o café');
  onWall('fridge', ['back', 'right'], { id: 'geladeira' });
  const del = spec.delivery === 'impressora' ? 'printer' : 'rack';
  must(onWall(del, ['back', 'right', 'left'], { id: del === 'printer' ? 'impressora' : 'rack' }), 'a entrega');
  onWall('lowshelf', ['left', 'right', 'back', 'front'], { id: 'estante' });
  for (const id of shuffle(['palm', 'palm', 'planter', 'plantshelf', 'floorlamp', 'vase']).slice(0, 3 + Math.floor(rnd() * 3))) onWall(id, ['back', 'left', 'right', 'front']);
  if ((STYLE_PRESETS[spec.style] || {}).extra) onWall('colorlight', ['back', 'right', 'front'], { id: 'luz-cor', color: '#A855F7' });
  // 7. móveis do negócio escolhidos pela IA e os criados por ela
  for (const id of [...(spec.custom || []).map(c => c.id), ...(spec.extras || [])]) must(onWall(id, ['back', 'left', 'right', 'front']) || inMiddle(id, [0, 1, 2, 3]), ITEMS[id]?.n || id);
  // pessoas começam em quadrados livres
  const free = shuffle([...Array(WD * DP).keys()].map(i => [i % WD, Math.floor(i / WD)]).filter(([x, z]) => cell(x, z) !== 1 && x > 0 && z > 0));
  return { WD, DP, wing, walls, objects, starts: free.slice(0, n).map(([x, z]) => [x + .5, z + .5]) };
}
// versão do gerador: a sala salva no navegador guarda com qual versão foi montada; mudou o gerador, a página monta de
// novo ao abrir (senão uma sala feita com versão antiga, ou caída na planta-base por um erro já corrigido, ficaria)
const OFFICE_GEN = 'g6';
/* SALA VAZIA (decisão do dono, 2026-11-04): a IA monta a equipe e o contexto do negócio, mas NÃO o cenário. O negócio
   novo abre numa sala vazia (piso, paredes e a porta de entrada) e o dono monta com os móveis da biblioteca no editor.
   Os móveis que a IA criou (custom) entram no catálogo para ele usar. O gerador (generateOffice/suggestOffice) fica no
   código para um futuro "sugerir planta", mas não é usado. */
function officeWorld(spec) {
  for (const c of spec.custom || []) registerCustom(c);
  const n = Math.max(1, spec.team?.length || 1), WD = n > 6 ? 20 : 16, DP = 11, st = STYLE_PRESETS.moderno;
  // a equipe começa junto da entrada, em fileira, de frente para a sala
  const starts = spec.team.map((_, i) => [3.5 + (i % 6) * 1.6, 4.5 + Math.floor(i / 6) * 1.6]);
  return normalize({
    name: spec.name, service: spec.service || '', officeId: spec.createdAt || null,
    tiles: rectTiles(WD, DP, st.floor), wall: st.wall, floorMat: st.floor,
    objects: [{ id: 'entrada', item: 'capacho', x: 0, z: 4, rot: 1 }], walls: [],
    people: officePeople(spec, starts), roles: officeRoles(spec), labels: { ...(spec.labels || {}) },
    demo: { tasks: spec.tasks || [], research: spec.research || [] }, custom: spec.custom || [],
  });
}
// planta montada pelo gerador (não usada hoje; guardada para um futuro "sugerir planta")
function suggestOffice(spec) {
  for (const c of spec.custom || []) registerCustom(c);
  for (let attempt = 0; attempt < 40; attempt++) {
    let g; try { g = generateOffice(spec, attempt); } catch { continue; }
    const w = officeWorldFrom(spec, g);
    if (!officeProblems(w).length) { w.gen = OFFICE_GEN; return w; }
  }
  console.warn('[montagem] nenhuma planta nova passou na conferência: usando a planta-base');
  const w = officeWorldBase(spec); w.gen = OFFICE_GEN; return w;
}
// monta o mundo a partir da planta gerada (papéis, pessoas, piso e parede do estilo)
function officeWorldFrom(spec, g) {
  // piso e cor das paredes escolhidos pela IA (MATS / WALLS do editor); sem escolha, os do estilo
  const st0 = STYLE_PRESETS[spec.style] || STYLE_PRESETS.moderno;
  const st = { ...st0, floor: MATS[spec.floor] ? spec.floor : st0.floor, wall: /^#[0-9a-f]{6}$/i.test(spec.wallColor || '') ? spec.wallColor : st0.wall };
  return normalize({
    name: spec.name, service: spec.service || '', officeId: spec.createdAt || null,
    tiles: { ...rectTiles(g.WD, g.DP, st.floor), ...(g.wing ? (() => { const t = {}; for (let x = g.wing.x0; x < g.wing.x1; x++) for (let z = g.wing.z0; z < g.wing.z1; z++) t[key(x, z)] = st.floor; return t; })() : {}) },
    wall: st.wall, floorMat: st.floor,
    objects: g.objects, walls: g.walls || [], people: officePeople(spec, g.starts), roles: officeRoles(spec), labels: { ...(spec.labels || {}) },
    demo: { tasks: spec.tasks || [], research: spec.research || [] }, custom: spec.custom || [],
  });
}
function officeRoles(spec) {
  const roles = {}; const usedColors = new Set();
  for (const r of [...spec.roles].sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind))) {
    const c = ROLE_COLORS.find(x => !usedColors.has(x)) || '#5C5866'; usedColors.add(c);
    roles[r.id] = { n: r.name, c, kind: KINDS[r.kind] ? r.kind : 'produz' };
  }
  return roles;
}
const officePeople = (spec, starts) => spec.team.slice(0, starts.length).map((m, i) => ({
  id: 'p-' + i + '-' + m.name.toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, ''),
  name: m.name, ...randomLook(genderOfName(m.name)), role: m.role, bio: m.bio || '', pos: starts[i],
}));
// planta-base antiga (reserva segura quando nenhuma planta nova passa na conferência)
function officeWorldBase(spec) {
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
  // sala vazia: abre no modo Construir para o dono montar (a equipe e o contexto do negócio já estão prontos)
  setMode('build');
  toast(`Equipe de ${spec.name} pronta. Agora monte a sala: escolha os móveis em "Elementos" e arraste para o piso.`);
  if (typeof tourMaybe === 'function') tourMaybe(); // primeira vez: o tour mostra o que dá para fazer
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
