// Monta a "ficha do escritório" a partir da descrição do serviço, usando a IA configurada.
// A IA decide o conteúdo (equipe, papéis, nomes); a página decide o espaço (planta fixa e testada).
import fs from 'node:fs/promises';
import path from 'node:path';
import { PROVIDERS } from './providers.mjs';
import { KINDS, STATES } from './protocol.mjs';
import { CATALOG, designFurniture, slug as furnSlug } from './furniture.mjs';

const FILE = path.resolve(process.env.FLOORWALK_DATA_DIR || './data', 'office.json');
export const STYLES = ['moderno', 'aconchegante', 'clinico', 'criativo', 'industrial'];
const LABELABLE = ['planejando', 'trabalhando', 'revisando', 'pesquisando', 'entregando'];
export const LIMITS = { teamMin: 3, teamMax: 10, rolesMax: 6 };
/* Biblioteca de móveis da sala (mesmos ids de web/js/01-catalogo.js ITEMS; o teste confere). A IA escolhe, daqui e do
   CATALOG, TODOS os móveis do negócio (decisão do dono, 2026-11-04): nada de "pacote de escritório" fixo. */
export const LIBRARY = {
  desk: 'mesa com computador para 1 pessoa (escrever, editar, planilhas, atender por mensagem)',
  island: 'ilha com 4 computadores (equipe que trabalha junta no computador)',
  meeting: 'mesa de reunião para até 7 pessoas',
  reception: 'balcão de recepção para receber clientes',
  kanban: 'quadro kanban para organizar tarefas',
  tv: 'TV com gráficos para acompanhar números',
  coffee: 'balcão de café (copa)', fridge: 'geladeira de bebidas', stool: 'banqueta alta',
  sofa: 'sofá (descanso ou espera)', armchair: 'poltrona de leitura', pouf: 'pufe', ctable: 'mesinha de centro', rug: 'tapete',
  lowshelf: 'estante baixa com livros', floorlamp: 'luminária de chão',
  palm: 'palmeira em vaso', planter: 'floreira', plantshelf: 'estante de plantas', vase: 'vaso decorativo',
  chroma: 'fundo infinito / chroma (onde se fotografa ou grava)', softbox: 'luz de estúdio (softbox)', tripod: 'tripé com câmera', colorlight: 'luz colorida decorativa',
  printer: 'impressora', rack: 'rack de servidores (só para quem publica sites ou sistemas)',
};
const MAX_EACH = 4, MAX_TOTAL = 28;
// piso e cor das paredes: as mesmas opções do editor (web/js/01-catalogo.js MATS e WALLS; o teste confere)
export const FLOORS = { lilas: 'lilás', porcelanato: 'porcelanato claro', madeira_clara: 'madeira clara', madeira_escura: 'madeira escura',
  salvia: 'vinílico verde-sálvia', cimento: 'cimento queimado', grafite: 'carpete grafite', azul: 'carpete azul', xadrez: 'ladrilho xadrez preto e branco' };
export const WALL_COLORS = { lilas: '#D5CED6', areia: '#ECE5D6', azul: '#C2D2DE', salvia: '#CAD8C1', pessego: '#EBCBB7', grafite: '#3A3C44' };
// salas fechadas: tipo de parede → como fica (o gerador monta com porta ou abertura)
export const ROOM_WALLS = { alvenaria: 'parede inteira com porta (privacidade total: consultório, cabine)', vidro: 'vidro com porta (reunião, aquário)',
  meia: 'meia-parede com passagem (separa sem fechar)', biombo: 'painel acústico baixo com passagem (isolar barulho, estúdio)' };

export function buildPrompt(description) {
  return `Você monta escritórios virtuais onde cada pessoa é um agente de IA que trabalha para um negócio.
Leia a descrição do serviço e devolva a ficha do escritório em JSON.

DESCRIÇÃO DO SERVIÇO:
<<<${description}>>>

REGRAS
- Equipe de ${LIMITS.teamMin} a ${LIMITS.teamMax} pessoas, com nomes brasileiros curtos (até 12 letras), todos diferentes.
  Prefira de 4 a 6; passe de 6 só se o negócio realmente precisa de mais gente (a sala fica maior).
- Papéis próprios deste negócio (ex.: "Redação", "Atendimento", "Nutrição"). Cada papel tem um "tipo", que define o comportamento:
  coordena = organiza o trabalho (exatamente UM papel com este tipo, com uma pessoa)
  produz   = faz o trabalho principal (pelo menos um)
  atende   = lida direto com o cliente: venda, caixa, recepção, suporte, agendamento
  opera    = mantém o lugar funcionando: estoque, reposição, limpeza, manutenção, logística
  revisa   = confere o que foi produzido
  pesquisa = busca informação
  entrega  = publica, envia ou entrega ao cliente
- "funcao": uma frase curta dizendo o que a pessoa faz neste negócio.
- "rotulos": como chamar, neste negócio, os estados ${LABELABLE.join(', ')} (até 20 letras, verbo no gerúndio). Ex.: trabalhando → "Escrevendo".
- A SALA quem monta é o dono, no editor, com os móveis da biblioteca abaixo. Você NÃO escolhe móveis, piso, paredes
  nem planta. A biblioteca (só para saber o que já existe):
${Object.entries(LIBRARY).map(([id, d]) => `    ${id}: ${d}`).join('\n')}
${Object.entries(CATALOG).map(([id, c]) => `    ${id}: ${c.name} (${c.for})`).join('\n')}
- "moveis_novos": só se o negócio precisa de um móvel essencial que NÃO está na biblioteca (ex.: cadeira de dentista,
  forno de pizza, mesa de som). No máximo 2. Cada um: {"nome":"...","finalidade":"para que serve, em poucas palavras","parecido_com":"id do catálogo mais parecido"}.
  Na dúvida, não peça móvel novo.
- "tarefas_exemplo": 6 tarefas típicas deste negócio (até 40 letras cada). "pesquisas_exemplo": 4 temas de pesquisa.
- Tudo em português do Brasil.

Responda SOMENTE com o JSON, sem texto antes ou depois, neste formato:
{"nome":"Nome do escritório","servico":"uma frase",
"papeis":[{"id":"coordenacao","nome":"Coordenação","tipo":"coordena"},{"id":"redacao","nome":"Redação","tipo":"produz"}],
"equipe":[{"nome":"Ana","papel":"coordenacao","funcao":"Organiza as entregas da semana"},{"nome":"Bia","papel":"redacao","funcao":"Escreve os posts"}],
"rotulos":{"trabalhando":"Escrevendo"},"moveis_novos":[],
"tarefas_exemplo":["..."],"pesquisas_exemplo":["..."]}`;
}

const clip = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const slug = (s) => clip(s, 32).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

// pega o primeiro objeto JSON do texto (modelos sem modo JSON às vezes cercam a resposta com ```)
export function extractJSON(text) {
  const t = String(text || '');
  const start = t.indexOf('{'), end = t.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('a resposta não tinha JSON');
  return JSON.parse(t.slice(start, end + 1));
}

// Valida e conserta o que dá. Lança erro com a lista de problemas quando não dá.
export function normalizeSpec(raw) {
  const problems = [];
  if (!raw || typeof raw !== 'object') throw new Error('a resposta não é um objeto');
  const roles = [], seenRole = new Set();
  for (const r of Array.isArray(raw.papeis) ? raw.papeis : []) {
    const id = slug(r?.id || r?.nome), kind = String(r?.tipo || '').toLowerCase();
    if (!id || seenRole.has(id)) continue;
    roles.push({ id, name: clip(r.nome || id, 28), kind: KINDS.includes(kind) ? kind : 'produz' });
    seenRole.add(id);
    if (roles.length >= LIMITS.rolesMax) break;
  }
  if (!roles.some(r => r.kind === 'produz')) problems.push('nenhum papel com tipo "produz"');

  const team = [], seenName = new Set();
  for (const m of Array.isArray(raw.equipe) ? raw.equipe : []) {
    const name = clip(m?.nome, 14);
    if (!name || seenName.has(name.toLowerCase())) continue;
    let role = slug(m?.papel);
    if (!seenRole.has(role)) role = roles.find(r => r.name.toLowerCase() === String(m?.papel || '').toLowerCase())?.id || roles.find(r => r.kind === 'produz')?.id;
    if (!role) continue;
    team.push({ name, role, bio: clip(m?.funcao, 120) });
    seenName.add(name.toLowerCase());
    if (team.length >= LIMITS.teamMax) break;
  }
  if (team.length < LIMITS.teamMin) problems.push(`a equipe precisa de ${LIMITS.teamMin} a ${LIMITS.teamMax} pessoas (veio ${team.length})`);

  // exatamente uma pessoa coordena: se faltar, a primeira assume; se sobrar, as outras viram "produz"
  const kindOfRole = (id) => roles.find(r => r.id === id)?.kind;
  const leads = team.filter(m => kindOfRole(m.role) === 'coordena');
  if (!leads.length && team.length) {
    let lead = roles.find(r => r.kind === 'coordena');
    if (!lead) { lead = { id: 'coordenacao', name: 'Coordenação', kind: 'coordena' }; roles.unshift(lead); }
    team[0].role = lead.id;
  }
  for (const m of team.filter(m => kindOfRole(m.role) === 'coordena').slice(1)) m.role = roles.find(r => r.kind === 'produz')?.id || m.role;
  // papéis sem ninguém saem da ficha
  const used = new Set(team.map(m => m.role));
  const finalRoles = roles.filter(r => used.has(r.id));

  const labels = {};
  // rótulo curto, cortado entre palavras (cabe nos crachás da tela)
  const short = (t, n = 22) => { t = clip(t, 200); if (t.length <= n) return t; const cut = t.slice(0, n + 1).lastIndexOf(' '); return cut > 3 ? t.slice(0, cut) : t.slice(0, n); };
  for (const k of LABELABLE) { const v = short(raw.rotulos?.[k]); if (v) labels[k] = v[0].toUpperCase() + v.slice(1); }
  const list = (a, n, len) => (Array.isArray(a) ? a : []).map(x => clip(x, len)).filter(Boolean).slice(0, n);

  if (problems.length) throw Object.assign(new Error(problems.join('; ')), { problems });
  // móveis da sala: só ids da biblioteca ou do catálogo, no máximo MAX_EACH de cada e MAX_TOTAL no total
  const furniture = [], count = {};
  // só a lista nova ("moveis") liga o modo "a IA escolhe tudo"; ficha antiga ("elementos") segue o programa de antes
  for (const x of Array.isArray(raw.moveis) ? raw.moveis : []) {
    const id = String(x).toLowerCase().trim();
    if (!(LIBRARY[id] || CATALOG[id]) || (count[id] || 0) >= MAX_EACH || furniture.length >= MAX_TOTAL) continue;
    count[id] = (count[id] || 0) + 1; furniture.push(id);
  }
  // as áreas e a entrega seguem os móveis escolhidos (quando a IA mandou a lista)
  const has = (id) => furniture.includes(id);
  return {
    name: clip(raw.nome, 40) || 'Meu escritório',
    service: clip(raw.servico, 200),
    style: STYLES.includes(raw.estilo) ? raw.estilo : 'moderno',
    delivery: furniture.length ? (has('printer') && !has('rack') ? 'impressora' : has('rack') ? 'servidor' : raw.entrega === 'impressora' ? 'impressora' : 'servidor') : raw.entrega === 'impressora' ? 'impressora' : 'servidor',
    areas: furniture.length ? { studio: has('chroma'), reception: has('reception') } : { studio: !!raw.areas?.estudio, reception: !!raw.areas?.recepcao },
    furniture,
    // piso e parede escolhidos pela IA (vazios = os do estilo)
    floor: FLOORS[raw.piso] ? raw.piso : null,
    wallColor: WALL_COLORS[String(raw.parede || '').toLowerCase()] || null,
    // salas fechadas: só com móveis que estão na lista; cada móvel em uma sala só
    rooms: (() => {
      const used = new Set(), out = [];
      for (const r of Array.isArray(raw.salas) ? raw.salas : []) {
        const kind = ROOM_WALLS[r?.parede] ? r.parede : 'alvenaria';
        const items = [...new Set((Array.isArray(r?.moveis) ? r.moveis : []).map(x => String(x).toLowerCase().trim()))].filter(id => furniture.includes(id) && !used.has(id)).slice(0, 3);
        if (!items.length) continue;
        items.forEach(id => used.add(id)); out.push({ items, wall: kind, why: clip(r?.motivo, 60) });
        if (out.length >= 3) break;
      }
      return out;
    })(),
    layout: /^em[_ ]?l$/i.test(String(raw.planta || '').trim()) ? 'L' : 'rect',
    roles: finalRoles, team, labels,
    extras: furniture.length ? [...new Set(furniture.filter(id => CATALOG[id]))] : [...new Set((Array.isArray(raw.elementos) ? raw.elementos : []).map(x => String(x).toLowerCase().trim()).filter(id => CATALOG[id]))].slice(0, 3),
    customRequests: (Array.isArray(raw.moveis_novos) ? raw.moveis_novos : []).map(m => ({ name: clip(m?.nome, 40), purpose: clip(m?.finalidade, 120), like: String(m?.parecido_com || '').toLowerCase().trim() }))
      .filter(m => m.name && !Object.values(CATALOG).some(c => furnSlug(c.name) === furnSlug(m.name))).slice(0, 2),
    tasks: list(raw.tarefas_exemplo, 8, 40),
    research: list(raw.pesquisas_exemplo, 6, 40),
  };
}

// chat: função (opts) => texto. Também aceita a configuração do provedor diretamente.
export async function planOffice(chatOrCfg, description, onLog = () => {}) {
  const chat = typeof chatOrCfg === 'function' ? chatOrCfg : (o) => PROVIDERS[chatOrCfg.provider].chat({ ...chatOrCfg, ...o });
  const prompt = buildPrompt(clip(description, 1500));
  let messages = [{ role: 'user', content: prompt }], lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    const text = await chat({ messages, json: true, maxTokens: 2500 });
    let spec;
    try { spec = normalizeSpec(extractJSON(text)); }
    catch (e) {
      lastErr = e;
      spec = null;
      // segunda tentativa: mostra o erro para a IA corrigir
      messages = [...messages, { role: 'assistant', content: String(text).slice(0, 6000) }, { role: 'user', content: `A ficha veio com problema: ${e.message}. Corrija e responda só com o JSON completo.` }];
    }
    if (spec) {
      // móveis novos: um desenho por pedido (com nova tentativa e plano B dentro de designFurniture)
      spec.custom = [];
      for (const req of spec.customRequests) { const c = await designFurniture(chat, req, onLog); if (!spec.custom.some(x => x.id === c.id)) spec.custom.push(c); }
      delete spec.customRequests;
      // a descrição completa fica na ficha: os agentes recebem como contexto do negócio em toda tarefa
      spec.description = clip(description, 1500);
      return spec;
    }
  }
  throw Object.assign(new Error(`A IA não montou uma ficha válida (${lastErr.message}). Tente descrever o serviço com mais detalhes.`), { code: 'invalid_spec' });
}

// começar do zero: apaga o escritório salvo (equipe, papéis, descrição, móveis criados pela IA)
export async function clear() { await fs.rm(FILE, { force: true }); }
export async function load() { try { return JSON.parse(await fs.readFile(FILE, 'utf8')); } catch { return null; } }
export async function save(spec) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify({ ...spec, createdAt: new Date().toISOString() }, null, 2), { mode: 0o600 });
}
// muda o escritório salvo sem trocar a data de criação (a página usa a data para saber se é outro escritório)
export async function update(fn) {
  const cur = await load(); if (!cur) return null;
  const next = fn(structuredClone(cur)) || cur;
  await fs.writeFile(FILE, JSON.stringify({ ...next, createdAt: cur.createdAt }, null, 2), { mode: 0o600 });
  return next;
}
export { STATES };
