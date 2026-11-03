// Monta a "ficha do escritório" a partir da descrição do serviço, usando a IA configurada.
// A IA decide o conteúdo (equipe, papéis, nomes); a página decide o espaço (planta fixa e testada).
import fs from 'node:fs/promises';
import path from 'node:path';
import { PROVIDERS } from './providers.mjs';
import { KINDS, STATES } from './protocol.mjs';
import { CATALOG, designFurniture, slug as furnSlug } from './furniture.mjs';

const FILE = path.resolve(process.env.PIXELHQ_DATA_DIR || './data', 'office.json');
export const STYLES = ['moderno', 'aconchegante', 'clinico', 'criativo', 'industrial'];
const LABELABLE = ['planejando', 'trabalhando', 'revisando', 'pesquisando', 'entregando'];
export const LIMITS = { teamMin: 3, teamMax: 10, rolesMax: 6 };

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
  revisa   = confere o que foi produzido
  pesquisa = busca informação
  entrega  = publica, envia ou entrega ao cliente
- "funcao": uma frase curta dizendo o que a pessoa faz neste negócio.
- "rotulos": como chamar, neste negócio, os estados ${LABELABLE.join(', ')} (até 20 letras, verbo no gerúndio). Ex.: trabalhando → "Escrevendo".
- "estilo": um destes: ${STYLES.join(', ')}.
- "entrega": "servidor" se o resultado é digital (site, app, sistema); "impressora" se é documento, relatório ou material físico.
- "areas": "estudio" true se o negócio grava vídeo ou fotos; "recepcao" true se atende clientes presencialmente.
- O escritório já tem: mesas com computador, quadro kanban, sala de reunião com TV, copa, estante, poltrona e sofá.
  "elementos": até 3 móveis EXTRAS deste catálogo que o negócio realmente usa no dia a dia (ids):
${Object.entries(CATALOG).map(([id, c]) => `    ${id}: ${c.name} (${c.for})`).join('\n')}
- "moveis_novos": só se o negócio precisa de um móvel essencial que NÃO está em nada acima (ex.: cadeira de dentista,
  forno de pizza, mesa de som). No máximo 2. Cada um: {"nome":"...","finalidade":"para que serve, em poucas palavras","parecido_com":"id do catálogo mais parecido"}.
  Na dúvida, não peça móvel novo.
- "tarefas_exemplo": 6 tarefas típicas deste negócio (até 40 letras cada). "pesquisas_exemplo": 4 temas de pesquisa.
- Tudo em português do Brasil.

Responda SOMENTE com o JSON, sem texto antes ou depois, neste formato:
{"nome":"Nome do escritório","servico":"uma frase","estilo":"moderno","entrega":"servidor","areas":{"estudio":false,"recepcao":false},
"papeis":[{"id":"coordenacao","nome":"Coordenação","tipo":"coordena"},{"id":"redacao","nome":"Redação","tipo":"produz"}],
"equipe":[{"nome":"Ana","papel":"coordenacao","funcao":"Organiza as entregas da semana"},{"nome":"Bia","papel":"redacao","funcao":"Escreve os posts"}],
"rotulos":{"trabalhando":"Escrevendo"},"elementos":[],"moveis_novos":[],
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
  return {
    name: clip(raw.nome, 40) || 'Meu escritório',
    service: clip(raw.servico, 200),
    style: STYLES.includes(raw.estilo) ? raw.estilo : 'moderno',
    delivery: raw.entrega === 'impressora' ? 'impressora' : 'servidor',
    areas: { studio: !!raw.areas?.estudio, reception: !!raw.areas?.recepcao },
    roles: finalRoles, team, labels,
    extras: [...new Set((Array.isArray(raw.elementos) ? raw.elementos : []).map(x => String(x).toLowerCase().trim()).filter(id => CATALOG[id]))].slice(0, 3),
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
      return spec;
    }
  }
  throw Object.assign(new Error(`A IA não montou uma ficha válida (${lastErr.message}). Tente descrever o serviço com mais detalhes.`), { code: 'invalid_spec' });
}

export async function load() { try { return JSON.parse(await fs.readFile(FILE, 'utf8')); } catch { return null; } }
export async function save(spec) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify({ ...spec, createdAt: new Date().toISOString() }, null, 2), { mode: 0o600 });
}
export { STATES };
