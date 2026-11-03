// Executa uma tarefa com a equipe do escritório, usando qualquer provedor (só precisa de chat()).
//
//   1. Quem coordena decide: pergunta ou pedido simples → responde sozinho (modo "direto");
//      trabalho maior → divide em passos (pesquisar, produzir, revisar, entregar).
//   2. Cada passo é feito pela pessoa indicada, com o material dos passos anteriores.
//      Revisão pedindo ajustes: quem produziu corrige uma vez.
//   3. O resultado é a última entrega (a final, ou a última produção).
//
// Tudo vira eventos (say) e entregas (result), e é salvo em arquivos .md.
import fs from 'node:fs/promises';
import path from 'node:path';
import { placesFor, placeDesc, guessPlace, validPlace } from './places.mjs';

export const ACTIONS = {
  pesquisar: { state: 'pesquisando', kinds: ['pesquisa'], verb: 'Pesquisa', maxTokens: 1500,
    how: 'Traga os pontos relevantes em tópicos curtos. Você não tem acesso à internet: use o que sabe e marque o que precisa ser confirmado.' },
  produzir: { state: 'trabalhando', kinds: ['produz'], verb: 'Produção', maxTokens: 3500,
    how: 'Entregue o trabalho pronto para uso, em Markdown. Não explique o que vai fazer: faça.' },
  revisar: { state: 'revisando', kinds: ['revisa'], verb: 'Revisão', maxTokens: 1200,
    how: 'Revise o material da equipe. Liste problemas concretos e como corrigir. Na última linha escreva só APROVADO ou REPROVADO.' },
  entregar: { state: 'entregando', kinds: ['entrega'], verb: 'Entrega', maxTokens: 2000,
    how: 'Prepare a versão final para o cliente (mensagem, publicação ou documento), pronta para copiar e enviar.' },
};
export const MAX_STEPS = 6;
const clip = (s, n) => { s = String(s ?? '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const slug = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').slice(0, 40).replace(/^-+|-+$/g, '') || 'tarefa';
const firstLine = (t) => clip(String(t).split('\n').find(l => l.trim() && !/^#+\s*$/.test(l)) || '', 120).replace(/^#+\s*/, '');

export function teamOf(spec) {
  return spec.team.map(m => { const r = spec.roles.find(x => x.id === m.role); return { name: m.name, role: m.role, roleName: r?.name || m.role, kind: r?.kind || 'produz', bio: m.bio || '' }; });
}
const leadOf = (T) => T.find(m => m.kind === 'coordena') || T[0];
const persona = (m, spec) => `Você é ${m.name}, ${m.roleName} em ${spec.name}${spec.service ? ` (${spec.service})` : ''}. ${m.bio ? 'Sua função: ' + m.bio + '.' : ''} Responda sempre em português do Brasil.`;

function planPrompt(text, T, lead, available, spec) {
  const places = available.map(k => `- ${k}: ${placeDesc(k, spec)}`).join('\n');
  const team = T.filter(m => m !== lead).map(m => `- ${m.name}: ${m.roleName} (tipo ${m.kind})${m.bio ? ' · ' + m.bio : ''}`).join('\n');
  return `Decida como atender o pedido do cliente.

PEDIDO DO CLIENTE:
<<<${text}>>>

EQUIPE:
${team}

LUGARES DO ESCRITÓRIO (onde cada coisa é feita):
${places}

PRIMEIRO, ESCOLHA O MODO
- "direto": você mesma responde, sem envolver a equipe. Use para perguntas, explicações, dúvidas, opiniões
  e qualquer pedido que uma pessoa resolve sozinha em poucos minutos. Na dúvida, prefira "direto".
- "equipe": só quando o pedido exige um trabalho produzido (documento, plano, campanha, código, conteúdo
  para publicar) que se beneficia de pesquisa, produção e revisão por pessoas diferentes.

NO MODO "equipe"
- De 1 a ${MAX_STEPS} passos, na ordem em que devem acontecer. Use o mínimo de passos; 2 ou 3 costumam bastar.
- "acao" é uma destas: pesquisar, produzir, revisar, entregar.
- Prefira quem tem o tipo certo: pesquisa → pesquisar, produz → produzir, revisa → revisar, entrega → entregar.
- Tem que haver pelo menos um passo "produzir". Revisar só se o material vai para o cliente ou será publicado.
  Entregar só se o pedido fala em enviar, publicar ou responder a alguém.
- "pedido": instrução clara para a pessoa, de 1 a 3 frases.
- "local": o lugar da lista acima onde aquilo é feito de verdade (gravar → estudio, analisar vendas → painel, escrever → computador).

Responda SOMENTE com JSON, num destes formatos:
{"modo":"direto","local":"computador"}
{"modo":"equipe","resumo":"uma frase sobre o plano","passos":[{"agente":"Nome","acao":"produzir","local":"computador","pedido":"..."}]}`;
}

function extractJSON(t) {
  t = String(t || ''); const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('sem JSON'); return JSON.parse(t.slice(a, b + 1));
}

// Valida o plano; o que não dá para usar é descartado. Sem passo de produção, o plano é recusado.
export function normalizePlan(raw, T, lead, available = placesFor({}), text = '') {
  if (String(raw?.modo || '').toLowerCase() === 'direto') return { direct: true, summary: 'Resposta direta', steps: [], place: validPlace(raw?.local, available) || guessPlace(text, 'produzir', available) };
  const byName = new Map(T.map(m => [m.name.toLowerCase(), m]));
  const steps = [];
  for (const p of Array.isArray(raw?.passos) ? raw.passos : []) {
    const action = String(p?.acao || '').toLowerCase().trim();
    if (!ACTIONS[action]) continue;
    let who = byName.get(String(p?.agente || '').toLowerCase().trim());
    if (!who) who = T.find(m => ACTIONS[action].kinds.includes(m.kind) && m !== lead) || null;
    if (!who) continue;
    const request = clip(p?.pedido, 600) || ACTIONS[action].verb;
    steps.push({ agent: who, action, request, place: validPlace(String(p?.local || '').toLowerCase().trim(), available) || guessPlace(request, action, available) }); // só o pedido do passo: a tarefa toda confundiria (ex.: pesquisa numa tarefa de vídeo)
    if (steps.length >= MAX_STEPS) break;
  }
  if (!steps.some(s => s.action === 'produzir')) throw new Error('o plano não tem passo de produção');
  // revisão antes de qualquer produção não faz sentido
  const firstProd = steps.findIndex(s => s.action === 'produzir');
  return { summary: clip(raw?.resumo, 200), steps: steps.filter((s, i) => s.action !== 'revisar' || i > firstProd) };
}

// plano padrão, montado pelos tipos, quando a IA não devolve um plano usável
export function defaultPlan(text, T, lead, available = placesFor({})) {
  const pick = (k) => T.find(m => m.kind === k && m !== lead);
  const maker = pick('produz') || lead, rev = pick('revisa');
  const steps = [{ agent: maker, action: 'produzir', request: text, place: guessPlace(text, 'produzir', available) }];
  if (rev) steps.push({ agent: rev, action: 'revisar', request: 'Confira se o material atende à tarefa.', place: 'computador' });
  return { summary: 'Plano padrão: produzir' + (rev ? ' e revisar.' : '.'), steps };
}

export async function runTask({ text, spec, chat, say, log = () => {}, result = () => {}, signal, outDir }) {
  const T = teamOf(spec), lead = leadOf(T), available = placesFor(spec);
  const L = clip(text, 50);
  const check = () => { if (signal?.aborted) throw Object.assign(new Error('Tarefa cancelada.'), { code: 'cancelled' }); };
  const items = []; // entregas: { agent, action, title, text }

  // 1. planejamento
  say(lead, 'planejando', L, { detail: 'Dividindo a tarefa entre a equipe' });
  let plan;
  try { plan = normalizePlan(extractJSON(await chat({ system: persona(lead, spec), messages: [{ role: 'user', content: planPrompt(text, T, lead, available, spec) }], json: true, maxTokens: 1200, signal })), T, lead, available, text); }
  catch (e) {
    check();
    if (e?.status || e?.provider) throw e; // erro do provedor (chave, modelo, limite): parar, não insistir
    log(lead.name, `Plano da IA inválido (${e.message}); usando o plano padrão.`); plan = defaultPlan(text, T, lead, available);
  }
  check();
  if (plan.direct) {
    // pergunta simples: quem coordena responde sozinha
    log(lead.name, 'Respondendo diretamente, sem envolver a equipe.');
    say(lead, 'trabalhando', L, { detail: 'Respondendo', place: plan.place });
    const out = String(await chat({ system: persona(lead, spec), maxTokens: 2500, signal,
      messages: [{ role: 'user', content: `PEDIDO DO CLIENTE:\n${text}\n\nResponda de forma clara e direta, em Markdown. Vá direto ao ponto.` }] })).trim();
    check();
    const item = { agent: lead.name, action: 'produzir', title: `Resposta · ${lead.name}`, text: out };
    items.push(item); result(item);
    return finish(out);
  }
  log(lead.name, `Plano: ${plan.steps.map(s => `${s.agent.name} (${ACTIONS[s.action].verb.toLowerCase()})`).join(' → ')}`);

  const context = () => items.map(it => `### ${it.title}\n${it.text.slice(0, 6000)}`).join('\n\n') || '(nada ainda)';
  async function doStep(step, extra = '', title) {
    const A = ACTIONS[step.action], m = step.agent;
    if (m !== lead) {
      say(lead, 'reuniao', `Briefing com ${m.name}`, { with: [m.name] }, 3000);
      say(m, 'reuniao', `Briefing com ${lead.name}`, { with: [lead.name] }, 3000);
      say(lead, 'aguardando', `Esperando ${m.name}`, { detail: clip(step.request, 120) });
    }
    const lastMaker = [...items].reverse().find(it => it.action === 'produzir')?.agent;
    // revisão em computador = vai até quem produziu; qualquer outro lugar (ex.: estúdio) é respeitado
    const visit = step.action === 'revisar' && lastMaker && lastMaker !== m.name && (!step.place || step.place === 'computador');
    say(m, A.state, L, { detail: clip(step.request, 140), ...(visit ? { with: [lastMaker] } : step.place ? { place: step.place } : {}) });
    const out = await chat({
      system: persona(m, spec), maxTokens: A.maxTokens, signal,
      messages: [{ role: 'user', content: `TAREFA DO CLIENTE:\n${text}\n\nSEU PEDIDO (${A.verb.toLowerCase()}):\n${step.request}${extra}\n\nMATERIAL DA EQUIPE ATÉ AGORA:\n${context()}\n\n${A.how}` }],
    });
    check();
    const item = { agent: m.name, action: step.action, title: title || `${A.verb} · ${m.name}`, text: String(out).trim() };
    items.push(item); result(item);
    return item;
  }

  // 2. execução
  for (const step of plan.steps) {
    check();
    const item = await doStep(step);
    const m = step.agent;
    if (step.action === 'revisar' && /REPROVADO\s*\W*$/i.test(item.text.trim())) {
      // revisão pedindo ajustes não é bloqueio: o revisor conclui, quem produziu corrige
      say(m, 'concluido', L, { detail: 'Pediu ajustes' }, 3000);
      const makerName = [...items].reverse().find(it => it.action === 'produzir')?.agent;
      const maker = T.find(x => x.name === makerName);
      if (maker) {
        const prev = plan.steps.find(s => s.agent === maker && s.action === 'produzir');
        await doStep({ agent: maker, action: 'produzir', request: 'Corrija o seu material conforme a revisão.', place: prev?.place || 'computador' }, `\n\nREVISÃO DE ${m.name.toUpperCase()}:\n${item.text.slice(0, 4000)}`, `Versão corrigida · ${maker.name}`);
        say(maker, 'concluido', L, { detail: 'Correção entregue' }, 4500);
      }
    } else {
      say(m, 'concluido', L, { detail: firstLine(item.text) || 'Parte entregue' }, 4500);
    }
  }

  // 3. resultado: a entrega final, ou a última produção (sem chamada extra de resumo)
  const main = [...items].reverse().find(it => it.action === 'entregar') || [...items].reverse().find(it => it.action === 'produzir');
  return finish(main?.text || '');

  async function finish(final) {
    check();
    let folder = null;
    if (outDir) {
      const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
      folder = path.join(outDir, `${stamp}-${slug(text)}`);
      await fs.mkdir(folder, { recursive: true });
      await Promise.all(items.map((it, i) => fs.writeFile(path.join(folder, `${String(i + 1).padStart(2, '0')}-${slug(it.agent)}-${it.action}.md`), `# ${it.title}\n\n${it.text}\n`)));
      await fs.writeFile(path.join(folder, 'resultado.md'), `# ${text}\n\n${final}\n` + (items.length > 1 ? `\n---\n\n## Etapas da equipe\n\n${items.map(it => `### ${it.title}\n\n${it.text}`).join('\n\n')}\n` : ''));
    }
    return { output: final, items, folder, plan };
  }
}
