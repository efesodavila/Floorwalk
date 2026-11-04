// Móveis do escritório além da planta base.
//
// 1. Catálogo feito à mão (web/js/01-catalogo.js): a IA escolhe por id.
// 2. Móvel novo, só quando nada do catálogo serve: a IA desenha com blocos e as regras abaixo
//    são conferidas aqui. Falhou duas vezes → plano B: um móvel do catálogo com outro nome.
// Nada que a IA devolve é executado: são só números e nomes de cor, validados.

// móveis do catálogo que podem entrar nas vagas da sala (1 quadrado de fundo) e o lugar de cada um
export const CATALOG = {
  maca:            { name: 'Maca de atendimento', w: 2, place: 'atendimento', for: 'examinar, atender ou fazer procedimentos em pacientes' },
  balanca:         { name: 'Balança', w: 1, place: 'atendimento', for: 'pesar e medir pessoas' },
  cadeira_salao:   { name: 'Cadeira de barbeiro com espelho', w: 1, place: 'atendimento', for: 'cortar cabelo, fazer barba, maquiagem, estética' },
  bancada_cozinha: { name: 'Bancada de cozinha', w: 3, place: 'cozinha', for: 'preparar alimentos' },
  fogao:           { name: 'Fogão industrial', w: 2, place: 'cozinha', for: 'cozinhar' },
  arara:           { name: 'Arara de roupas', w: 2, place: 'estoque', for: 'roupas e peças à venda' },
  estoque:         { name: 'Prateleira de estoque', w: 2, place: 'estoque', for: 'guardar e separar produtos' },
  mesa_embalagem:  { name: 'Mesa de embalagem', w: 2, place: 'estoque', for: 'embalar e despachar pedidos' },
  vitrine:         { name: 'Vitrine', w: 2, place: 'loja', for: 'expor produtos' },
  sapateira:       { name: 'Estante de sapatos', w: 2, place: 'loja', for: 'expor e vender calçados (sapataria, loja de tênis)' },
  caixa:           { name: 'Caixa (balcão de vendas)', w: 2, place: 'loja', for: 'vender e cobrar' },
  bancada_oficina: { name: 'Bancada de ferramentas', w: 2, place: 'oficina', for: 'consertar e montar' },
  cavalete:        { name: 'Cavalete de pintura', w: 1, place: 'oficina', for: 'pintar, desenhar à mão' },
};
// plano B: móveis de 1 quadrado de fundo que servem de base genérica
const FALLBACK_BASES = ['mesa_embalagem', 'bancada_oficina', 'estoque', 'vitrine', 'caixa', 'balanca'];

export const COLORS = {
  madeira: '#B07A4A', madeira_clara: '#DBB07A', metal: '#2C2E34', branco: '#FFFFFF', creme: '#EFE9E0',
  cinza: '#9AA0A8', cinza_claro: '#C9CDD4', preto: '#24252B', grafite: '#3A3C42', roxo: '#8C4FE0',
  azul: '#2F5FD0', azul_claro: '#7FC4E8', verde: '#3AA655', vermelho: '#E0473B', amarelo: '#F2B630',
  laranja: '#E07A3B', rosa: '#E89BB5', vidro: '#BFE6FF', tela: '#7D45D6',
};
const MAX_H = 2.2, TOL = .03;

export const slug = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30) || 'movel';

function prompt(req) {
  return `Você desenha um móvel em pixel art isométrica para um escritório virtual, montando blocos (caixas).

MÓVEL: ${req.name}
PARA QUE SERVE: ${req.purpose}

COORDENADAS (em quadrados do piso; 1 = um quadrado)
- largura x: de 0 até W, e você escolhe W = 1, 2 ou 3
- profundidade z: de 0 (fundo, encostado na parede) até 1 (frente, de onde a pessoa usa o móvel)
- altura y: de 0 (chão) até no máximo ${MAX_H} (uma pessoa tem 1,7; uma mesa tem 0,75)

CADA BLOCO: {"x":..,"z":..,"l":largura em x,"p":profundidade em z,"y":altura da base,"a":altura do bloco,"cor":"...","brilho":false}

REGRAS
- De 3 a 14 blocos, todos dentro dos limites acima. Medidas com no máximo 2 casas decimais; peças finas com pelo menos 0,04.
- Nada flutuando: cada bloco encosta no chão ou em outro bloco que, por sua vez, chega ao chão
  (ex.: tampo apoiado nos pés, tela presa no monitor).
- "brilho": true só para telas, luzes e chamas.
- Cores (use só estas): ${Object.keys(COLORS).join(', ')}.
- Faça o móvel reconhecível pela silhueta, com poucos detalhes, como os dos exemplos.

QUALIDADE (também conferida)
- Antes dos blocos, liste em "partes" de 3 a 6 partes que fazem o móvel ser reconhecido (ex.: "base", "tampo", "tela").
- Ocupe pelo menos metade da largura W que você escolheu (escolha W pelo tamanho real do móvel).
- Pelo menos 2 cores: estrutura numa cor, detalhes em outra que contraste.
- Nenhum bloco escondido inteiro dentro de outro (não aparece e faz a imagem piscar).
- Varie as alturas: o que a pessoa usa fica na frente (z perto de 1); o que é alto fica no fundo (z perto de 0).

EXEMPLO (Mesa de embalagem, W=2):
{"w":2,"blocos":[
{"x":0.08,"z":0.2,"l":0.08,"p":0.08,"y":0,"a":0.8,"cor":"metal"},{"x":1.84,"z":0.2,"l":0.08,"p":0.08,"y":0,"a":0.8,"cor":"metal"},
{"x":0.08,"z":0.72,"l":0.08,"p":0.08,"y":0,"a":0.8,"cor":"metal"},{"x":1.84,"z":0.72,"l":0.08,"p":0.08,"y":0,"a":0.8,"cor":"metal"},
{"x":0,"z":0.1,"l":2,"p":0.85,"y":0.8,"a":0.06,"cor":"creme"},
{"x":0.2,"z":0.25,"l":0.55,"p":0.45,"y":0.86,"a":0.35,"cor":"madeira_clara"},{"x":1.55,"z":0.35,"l":0.22,"p":0.22,"y":0.86,"a":0.1,"cor":"cinza"}]}

EXEMPLO (Caixa eletrônico, W=1):
{"partes":["gabinete","tela","teclado","saída de dinheiro"],"w":1,"blocos":[
{"x":0.1,"z":0.05,"l":0.8,"p":0.6,"y":0,"a":1.5,"cor":"grafite"},
{"x":0.2,"z":0.65,"l":0.6,"p":0.25,"y":0.9,"a":0.06,"cor":"cinza_claro"},
{"x":0.25,"z":0.65,"l":0.5,"p":0.04,"y":1.05,"a":0.35,"cor":"tela","brilho":true},
{"x":0.3,"z":0.7,"l":0.4,"p":0.15,"y":0.96,"a":0.03,"cor":"preto"},
{"x":0.3,"z":0.65,"l":0.4,"p":0.05,"y":0.6,"a":0.06,"cor":"amarelo"}]}

Responda SOMENTE com o JSON do móvel: {"partes":[...],"w":..,"blocos":[...]}.`;
}

// Valida o desenho. Devolve { ok, w, boxes } ou { ok:false, problems }.
export function validateDesign(raw) {
  const problems = [];
  const w = Number(raw?.w);
  if (![1, 2, 3].includes(w)) problems.push('"w" precisa ser 1, 2 ou 3');
  const list = Array.isArray(raw?.blocos) ? raw.blocos : [];
  if (list.length < 3 || list.length > 14) problems.push(`são ${list.length} blocos; use de 3 a 14`);
  const boxes = [];
  list.slice(0, 14).forEach((b, i) => {
    const n = (k) => Math.round(Number(b?.[k]) * 100) / 100;
    const [x, z, l, p, y, a] = ['x', 'z', 'l', 'p', 'y', 'a'].map(n), cor = String(b?.cor || '').toLowerCase();
    const where = `bloco ${i + 1}`;
    if ([x, z, l, p, y, a].some(v => !Number.isFinite(v))) { problems.push(`${where}: medidas inválidas`); return; }
    if (l < .04 || p < .04 || a < .01) problems.push(`${where}: fino demais`);
    if (x < -.001 || z < -.001 || y < -.001) problems.push(`${where}: começa fora dos limites`);
    if (x + l > (w || 3) + .001) problems.push(`${where}: passa da largura W`);
    if (z + p > 1.001) problems.push(`${where}: passa da frente (z+p > 1)`);
    if (y + a > MAX_H + .001) problems.push(`${where}: alto demais`);
    if (!COLORS[cor]) problems.push(`${where}: cor "${cor}" não existe`);
    boxes.push({ x, z, l, p, y, a, cor, glow: cor === 'tela' || b?.brilho === true });
  });
  // nada flutuando: todo bloco ligado ao chão por blocos que se tocam
  const touch = (A, Bx) => A.x <= Bx.x + Bx.l + TOL && Bx.x <= A.x + A.l + TOL && A.z <= Bx.z + Bx.p + TOL && Bx.z <= A.z + A.p + TOL && A.y <= Bx.y + Bx.a + TOL && Bx.y <= A.y + A.a + TOL;
  const grounded = new Set(boxes.map((b, i) => (b.y <= .02 ? i : -1)).filter(i => i >= 0));
  if (!grounded.size && boxes.length) problems.push('nenhum bloco encosta no chão');
  for (let changed = true; changed;) { changed = false; boxes.forEach((b, i) => { if (!grounded.has(i) && [...grounded].some(j => touch(b, boxes[j]))) { grounded.add(i); changed = true; } }); }
  boxes.forEach((b, i) => { if (!grounded.has(i)) problems.push(`bloco ${i + 1}: está flutuando`); });
  if (boxes.length && Math.max(...boxes.map(b => b.y + b.a)) < .3) problems.push('o móvel ficou baixo demais para ser visto');
  // qualidade: o que funciona mas fica feio ou pisca
  if (boxes.length >= 3) {
    if (new Set(boxes.map(b => b.cor)).size < 2) problems.push('use pelo menos 2 cores (estrutura e detalhes)');
    const span = Math.max(...boxes.map(b => b.x + b.l)) - Math.min(...boxes.map(b => b.x));
    if (w && span < w / 2 - .001) problems.push(`o móvel ocupa só ${span.toFixed(2)} de largura; ocupe pelo menos metade de W=${w} ou escolha um W menor`);
    const inside = (A, Bx) => A.x >= Bx.x - .001 && A.x + A.l <= Bx.x + Bx.l + .001 && A.z >= Bx.z - .001 && A.z + A.p <= Bx.z + Bx.p + .001 && A.y >= Bx.y - .001 && A.y + A.a <= Bx.y + Bx.a + .001;
    boxes.forEach((b, i) => { const j = boxes.findIndex((o, k) => k !== i && inside(b, o) && !(inside(o, b) && k > i)); if (j >= 0) problems.push(`bloco ${i + 1}: fica escondido dentro do bloco ${j + 1}`); });
  }
  if (problems.length) return { ok: false, problems: [...new Set(problems)].slice(0, 8) };
  return { ok: true, w, boxes: boxes.map(b => [b.x, b.z, b.l, b.p, b.y, b.a, COLORS[b.cor], b.glow ? 1 : 0]) };
}

/* ---------- crítica visual ----------
   A IA que desenhou não vê o resultado. Depois do desenho, a página renderiza o móvel em 3D e manda a imagem; um
   modelo com visão dá nota e, se ficou ruim, devolve um desenho corrigido (que passa pelas mesmas regras).
   O desenho novo só fica se, renderizado e avaliado de novo (scoreFurniture), tiver nota MAIOR que o antigo:
   no teste real, a primeira correção saiu pior que o original. No máximo 2 chamadas por móvel, uma vez ("reviewed"). */
const NAME_OF = Object.fromEntries(Object.entries(COLORS).map(([k, v]) => [v.toLowerCase(), k]));
export const toBlocks = (boxes) => (boxes || []).map(([x, z, l, p, y, a, hex, glow]) => ({ x, z, l, p, y, a, cor: NAME_OF[String(hex).toLowerCase()] || 'cinza', ...(glow ? { brilho: true } : {}) }));
export const MIN_SCORE = 4;
function critiquePrompt(c, scoreOnly = false) {
  const rules = prompt({ name: c.name, purpose: c.purpose }).split('REGRAS')[1].split('EXEMPLO')[0].trim();
  return `A imagem mostra, em vista isométrica, o móvel "${c.name}" (${c.purpose}) de um escritório virtual, montado com blocos.
Ele está encostado na parede pelo fundo (z = 0); a pessoa usa pela frente (z = 1).

1. Dê uma nota de 1 a 5: quanto alguém reconheceria este móvel só pela imagem (5 = reconhece na hora; 1 = não dá para saber o que é).
2. Liste até 3 problemas visuais (proporção, peça faltando, cor que confunde, peça solta).
${scoreOnly ? '3. NÃO refaça o desenho: só a nota e os problemas.' : `3. Se a nota for menor que ${MIN_SCORE}, refaça o desenho corrigindo os problemas, nas mesmas regras abaixo. Se for ${MIN_SCORE} ou mais, não mande blocos.
   Mantenha o que já está certo: o tampo de mesa ou bancada continua na altura de uso (y perto de 0,75), os pés no chão,
   e o que se usa (tela, painel, botões) fica EM CIMA do tampo ou na frente, nunca no chão.`}

DESENHO ATUAL: {"w":${c.w},"blocos":${JSON.stringify(toBlocks(c.boxes))}}

REGRAS ${rules}

Responda SOMENTE com JSON: ${scoreOnly ? '{"nota":3,"problemas":["..."]}' : '{"nota":3,"problemas":["..."],"w":2,"blocos":[...]}'}`;
}
// image = PNG em base64 (sem o prefixo data:). Devolve { score, problems, changed, w, boxes }.
export async function critiqueFurniture(chat, c, image) {
  const text = await chat({ messages: [{ role: 'user', content: critiquePrompt(c), images: [{ mime: 'image/png', data: image }] }], json: true, maxTokens: 2000 });
  const raw = extractJSON(text);
  const score = Math.max(1, Math.min(5, Math.round(Number(raw?.nota)) || 3));
  const problems = (Array.isArray(raw?.problemas) ? raw.problemas : []).map(p => String(p).slice(0, 120)).slice(0, 3);
  if (score >= MIN_SCORE || !Array.isArray(raw?.blocos)) return { score, problems, changed: false };
  const v = validateDesign(raw);
  if (!v.ok) return { score, problems, changed: false, rejected: v.problems };
  return { score, problems, changed: true, w: v.w, boxes: v.boxes };
}

// só a nota de um desenho (o candidato, já renderizado pela página)
export async function scoreFurniture(chat, c, image) {
  const text = await chat({ messages: [{ role: 'user', content: critiquePrompt(c, true), images: [{ mime: 'image/png', data: image }] }], json: true, maxTokens: 800 });
  const raw = extractJSON(text);
  return { score: Math.max(1, Math.min(5, Math.round(Number(raw?.nota)) || 3)), problems: (Array.isArray(raw?.problemas) ? raw.problemas : []).map(p => String(p).slice(0, 120)).slice(0, 3) };
}

function extractJSON(t) { t = String(t || ''); const a = t.indexOf('{'), b = t.lastIndexOf('}'); if (a < 0 || b <= a) throw new Error('sem JSON'); return JSON.parse(t.slice(a, b + 1)); }

// Desenha um móvel novo. Sempre devolve algo utilizável (o desenho, ou o plano B).
export async function designFurniture(chat, req, log = () => {}) {
  const id = slug(req.name);
  const base = { id: 'c_' + id, act: 'x_' + id, place: 'p_' + id, name: String(req.name).slice(0, 40), purpose: String(req.purpose || req.name).slice(0, 120) };
  let messages = [{ role: 'user', content: prompt(req) }], last = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    let text;
    try { text = await chat({ messages, json: true, maxTokens: 2000 }); }
    catch (e) { if (e?.status || e?.provider) throw e; break; }
    let v;
    try { v = validateDesign(extractJSON(text)); } catch (e) { v = { ok: false, problems: ['a resposta não era um JSON válido'] }; }
    if (v.ok) return { ...base, w: v.w, boxes: v.boxes };
    last = v.problems;
    messages = [...messages, { role: 'assistant', content: String(text).slice(0, 6000) }, { role: 'user', content: `O desenho tem problemas: ${v.problems.join('; ')}. Corrija e responda só com o JSON completo.` }];
  }
  const like = FALLBACK_BASES.includes(req.like) ? req.like : (CATALOG[req.like] ? req.like : 'mesa_embalagem');
  log(`Móvel "${base.name}" não passou nas regras (${last.join('; ') || 'sem resposta'}); usando ${CATALOG[like]?.name || like} como base.`);
  return { ...base, base: like, w: CATALOG[like]?.w || 2 };
}
