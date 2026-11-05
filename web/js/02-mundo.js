'use strict';

/* ---------- Mundo ---------- */
const key = (x, z) => x + ',' + z;
let uidN = 1;
const nid = (p) => p + '-' + Date.now().toString(36) + '-' + (uidN++);
function rectTiles(w, d, m) { const t = {}; for (let x = 0; x < w; x++) for (let z = 0; z < d; z++) t[key(x, z)] = m; return t; }
function tplSala() {
  return {
    name: 'Sala pequena', tiles: rectTiles(16, 11, 'lilas'), wall: '#D5CED6', floorMat: 'lilas',
    service: 'Software house: equipe que desenvolve e publica aplicativos.',
    roles: structuredClone(ROLES_SOFTWARE), labels: { ...LABELS_SOFTWARE },
    demo: { tasks: ['Tela de login', 'API de reservas', 'Cálculo de preço', 'Notificações por e-mail', 'Painel do admin', 'Busca de horários', 'Pagamento com Pix', 'Relatório mensal'],
      research: ['Referências de UX', 'Limites da API de pagamento', 'Concorrentes', 'Regras da LGPD', 'Bibliotecas de calendário'] },
    objects: [
      { id: 'ilha', item: 'island', x: 2, z: 2, rot: 0 }, { id: 'mesa-1', item: 'desk', x: 2, z: 7, rot: 0 }, { id: 'mesa-2', item: 'desk', x: 5, z: 7, rot: 0 },
      { id: 'reuniao', item: 'meeting', x: 10, z: 1, rot: 0 }, { id: 'tv', item: 'tv', x: 11, z: 0, rot: 0 },
      { id: 'cafe', item: 'coffee', x: 4, z: 0, rot: 0 }, { id: 'geladeira', item: 'fridge', x: 7, z: 0, rot: 0 }, { id: 'palmeira-1', item: 'palm', x: 0, z: 0, rot: 0 },
      { id: 'tapete', item: 'rug', x: 10, z: 7, rot: 0 }, { id: 'sofa', item: 'sofa', x: 10, z: 9, rot: 2 }, { id: 'centro', item: 'ctable', x: 10, z: 7, rot: 0 },
      { id: 'poltrona', item: 'armchair', x: 13, z: 7, rot: 1 }, { id: 'palmeira-2', item: 'palm', x: 15, z: 10, rot: 0 }, { id: 'floreira', item: 'planter', x: 0, z: 10, rot: 0 },
      { id: 'luz', item: 'floorlamp', x: 14, z: 6, rot: 0 },
      { id: 'kanban', item: 'kanban', x: 1, z: 0, rot: 0 }, { id: 'rack', item: 'rack', x: 15, z: 1, rot: 0 }, { id: 'estante', item: 'lowshelf', x: 13, z: 10, rot: 2 },
    ],
    walls: [{ id: 'w1', kind: 'vidro', a: [9, 0], b: [9, 5] }, { id: 'w2', kind: 'vidro_porta', a: [9, 5], b: [14, 5] }, { id: 'w3', kind: 'ripado', a: [8, 7], b: [8, 11] }],
    people: [
      { id: 'p-ana', name: 'Ana', gender: 'f', skin: SKIN[1], hair: HAIR[0], hairStyle: 'longo', top: 'jaqueta', shirt: SHIRT[0], pants: PANTS[0], shoes: SHOES[1], extras: { cracha: true }, role: 'orquestrador', pos: [7.25, 2.5] },
      { id: 'p-bia', name: 'Bia', gender: 'f', skin: SKIN[3], hair: HAIR[0], hairStyle: 'rabo', top: 'camiseta', shirt: SHIRT[4], pants: PANTS[1], shoes: SHOES[0], extras: { cracha: true, oculos: true }, role: 'dev', pos: [7.5, 5.75] },
      { id: 'p-rafa', name: 'Rafa', gender: 'm', skin: SKIN[0], hair: HAIR[2], hairStyle: 'curto', top: 'moletom', shirt: SHIRT[1], pants: PANTS[2], shoes: SHOES[1], extras: { fone: true }, role: 'dev', pos: [4.25, 9.75] },
      { id: 'p-davi', name: 'Davi', gender: 'm', skin: SKIN[2], hair: HAIR[0], hairStyle: 'raspado', top: 'camisa', shirt: SHIRT[7], pants: PANTS[0], shoes: SHOES[2], extras: { barba: true, cracha: true }, role: 'revisor', pos: [12.25, 6.25] },
      { id: 'p-lia', name: 'Lia', gender: 'f', skin: SKIN[0], hair: HAIR[3], hairStyle: 'coque', top: 'camisa', shirt: SHIRT[2], pants: PANTS[3], shoes: SHOES[0], extras: { oculos: true }, role: 'pesquisa', pos: [1.25, 6.25] },
      { id: 'p-theo', name: 'Theo', gender: 'm', skin: SKIN[4], hair: HAIR[0], hairStyle: 'curto', top: 'moletom', shirt: SHIRT[6], pants: PANTS[1], shoes: SHOES[3], extras: { fone: true, cracha: true }, role: 'devops', pos: [14.75, 4.25] },
    ],
  };
}
function tplVazio() { return { name: 'Ambiente vazio', tiles: rectTiles(8, 6, 'lilas'), wall: '#D5CED6', floorMat: 'lilas', objects: [], walls: [], people: [], roles: structuredClone(ROLES_GENERIC), labels: {} }; }
function normalize(w) {
  w.walls ??= (w.glass || []).map(g => ({ ...g, kind: 'vidro' })); delete w.glass; w.people ??= []; w.objects ??= []; w.wall ??= '#D5CED6';
  // ambientes salvos antes do modelo genérico eram todos de software
  if (!w.roles || !Object.keys(w.roles).length) { w.roles = structuredClone(ROLES_SOFTWARE); w.labels ??= { ...LABELS_SOFTWARE }; }
  w.labels ??= {};
  for (const r of Object.values(w.roles)) { if (!KINDS[r.kind]) r.kind = 'produz'; r.c ??= '#5C5866'; r.n ??= 'Papel'; }
  const fallback = Object.keys(w.roles).find(k => w.roles[k].kind === 'produz') || Object.keys(w.roles)[0];
  for (const p of w.people) {
    p.gender = p.hairStyle ? genderOf(p) : (p.gender === 'f' || p.gender === 'm' ? p.gender : genderOfName(p.name));
    const look = randomLook(p.gender); for (const k in look) if (p[k] == null) p[k] = look[k];
    // penteado e barba sempre do gênero escolhido (cada penteado é um modelo feminino ou masculino)
    if (!HAIR_G[p.gender].includes(p.hairStyle)) p.hairStyle = HAIR_G[p.gender][0];
    if (p.gender === 'f' && p.extras?.barba) p.extras = { ...p.extras, barba: false };
    p.top ??= 'camiseta'; p.shoes ??= '#2C2E34'; p.extras ??= {}; p.pos ??= [1.5, 1.5]; if (!w.roles[p.role]) p.role = fallback; delete p.desk; }
  // toda sala tem uma porta de entrada encostada numa parede (fixDoor vem de 03-geometria.js, carregado depois;
  // na primeira chamada, durante a carga deste arquivo, 99-inicio.js confere de novo)
  if (typeof fixDoor === 'function') fixDoor(w);
  return w;
}

const STORE = 'floorwalk.prototipo.v4';
// equipe de IA (campo de tarefa, conectar IA, negócio): DESLIGADA por padrão; o produto abre para o Claude Code.
// Liga e desliga pelo menu (☰ → Ligar a equipe de IA)
const TEAM_KEY = 'floorwalk.equipe';
function aiTeamOn() { try { return localStorage.getItem(TEAM_KEY) === '1'; } catch { return false; } }
// sala de dev pronta (a da software house, sem a equipe): as sessões do Claude Code entram pela porta
function tplClaude() { const w = tplSala(); w.name = 'Claude Code'; w.service = 'Sessões do Claude Code trabalhando.'; w.people = []; delete w.demo; return w; }
let W = null;
try { W = JSON.parse(localStorage.getItem(STORE) || 'null'); } catch { W = null; }
if (!W || !W.tiles || !Array.isArray(W.objects)) W = aiTeamOn() ? tplSala() : tplClaude();
/* ?vitrine=1: sala grande com UM de cada móvel do catálogo, para revisar o visual. Não salva nada e não conecta ao
   escritório real (a sala salva da pessoa continua intacta). */
const VITRINE = new URLSearchParams(location.search).has('vitrine');
function tplVitrine() {
  const base = tplSala(), WD = 26, wallFirst = ['tv', 'kanban', 'chroma'];
  const rest = Object.keys(ITEMS).filter(k => !wallFirst.includes(k) && !ITEMS[k].door)
    .sort((a, b) => ITEMS[b].d - ITEMS[a].d || ITEMS[b].w - ITEMS[a].w);
  const order = [...wallFirst.filter(k => ITEMS[k]), ...rest, 'capacho'].filter(k => ITEMS[k]);
  const objects = []; let x = 1, z = 0, rowD = 0;
  for (const k of order) {
    const { w, d } = ITEMS[k];
    if (x + w > WD - 1) { x = 1; z += rowD + 2; rowD = 0; }
    objects.push({ id: 'v-' + k, item: k, x, z, rot: 0 }); x += w + 1; rowD = Math.max(rowD, d);
  }
  return { ...base, name: 'Vitrine (todos os móveis)', tiles: rectTiles(WD, z + rowD + 2, 'lilas'), objects, walls: [] };
}
if (VITRINE) W = tplVitrine();
W = normalize(W);
syncCatalog();
// pessoas de fora (sessões do Claude Code) não entram no escritório salvo: existem só enquanto a sessão existe
// sessões de fora (Claude Code) não entram no escritório salvo: nem a pessoa, nem o cargo que só ela usa
function save() {
  if (VITRINE) return;
  const people = W.people.filter(p => !p.ext), roles = { ...W.roles };
  for (const p of W.people) if (p.ext && !people.some(q => q.role === p.role)) delete roles[p.role];
  try { localStorage.setItem(STORE, JSON.stringify({ ...W, people, roles })); } catch {}
}

let past = [], future = [];
function snapshot() { return JSON.stringify(W); }
function change(fn, msg) {
  const before = snapshot(); fn();
  if (snapshot() !== before) { past.push(before); if (past.length > 100) past.shift(); future = []; afterChange(); if (msg) toast(msg); }
}
function pushBefore(before, msg) { if (snapshot() !== before) { past.push(before); if (past.length > 100) past.shift(); future = []; afterChange(); if (msg) toast(msg); } }
function undo() { if (!past.length) return; future.push(snapshot()); W = JSON.parse(past.pop()); validateSel(); afterChange(); toast('Desfeito'); }
function redo() { if (!future.length) return; past.push(snapshot()); W = JSON.parse(future.pop()); validateSel(); afterChange(); toast('Refeito'); }
function afterChange() { W = normalize(W); syncCatalog(); WARN_CACHE = null; NAV = null; save(); renderPanel(); renderFoot(); renderCtx(); checkTasks(); dirty(); }
