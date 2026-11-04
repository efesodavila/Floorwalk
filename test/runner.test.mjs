// Coordenador de tarefas com uma IA roteirizada: sem rede, sem chave.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { runTask, normalizePlan, teamOf, MAX_STEPS } from '../server/runner.mjs';
import { guessPlace, placesFor } from '../server/places.mjs';

const spec = {
  name: 'Agência Faísca', service: 'Marketing para lojas',
  roles: [{ id: 'dir', name: 'Direção', kind: 'coordena' }, { id: 'red', name: 'Redação', kind: 'produz' }, { id: 'rev', name: 'Revisão', kind: 'revisa' }, { id: 'pes', name: 'Pesquisa', kind: 'pesquisa' }, { id: 'mid', name: 'Mídia', kind: 'entrega' }],
  team: [{ name: 'Ana', role: 'dir', bio: 'Organiza' }, { name: 'Bia', role: 'red', bio: 'Escreve' }, { name: 'Caio', role: 'rev', bio: 'Revisa' }, { name: 'Duda', role: 'pes', bio: 'Pesquisa' }, { name: 'Edu', role: 'mid', bio: 'Publica' }],
};
const T = teamOf(spec), lead = T[0];

// IA falsa: responde conforme o pedido (plano, cada ação, fechamento)
function fakeChat(script = {}) {
  const calls = [];
  const chat = async ({ messages, system, json }) => {
    const u = messages.at(-1).content; calls.push({ system, u, json });
    if (u.includes('Decida como atender')) return script.plan ?? JSON.stringify({ modo: 'equipe', resumo: 'ok', passos: [
      { agente: 'Duda', acao: 'pesquisar', pedido: 'Referências' }, { agente: 'Bia', acao: 'produzir', pedido: 'Escreva o post' },
      { agente: 'Caio', acao: 'revisar', pedido: 'Confira' }, { agente: 'Edu', acao: 'entregar', pedido: 'Publique' }] });
    if (u.includes('(pesquisa)')) return '- ponto 1\n- ponto 2';
    if (u.includes('(produção)')) return u.includes('REVISÃO DE') ? '# Post corrigido\nTexto bom' : '# Post\nTexto';
    if (u.includes('(revisão)')) return script.review ?? 'Tudo certo.\nAPROVADO';
    if (u.includes('(entrega)')) return 'Post publicado: Texto';
    if (u.includes('Responda de forma clara e direta')) return '## MCP\n\n**MCP** é um protocolo.';
    throw new Error('pedido inesperado: ' + u.slice(0, 80));
  };
  return { chat, calls };
}
const collect = () => { const ev = []; return { ev, say: (m, state, task, extra = {}) => ev.push({ agent: m.name, state, ...extra }), result: (it) => ev.push({ result: it.title }), log: () => {} }; };

test('fluxo completo: planeja, executa na ordem, salva os arquivos', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'floorwalk-ent-'));
  const { chat, calls } = fakeChat(), c = collect();
  const r = await runTask({ text: 'Post de lançamento da coleção', spec, chat, ...c, outDir: dir });
  assert.equal(r.output, 'Post publicado: Texto', 'o resultado é a entrega final');
  assert.deepEqual(r.items.map(i => i.title), ['Pesquisa · Duda', 'Produção · Bia', 'Revisão · Caio', 'Entrega · Edu']);
  // cada pessoa recebe o material das anteriores e fala como ela mesma
  const prodCall = calls.find(x => x.u.includes('(produção)'));
  assert.match(prodCall.u, /ponto 1/); assert.match(prodCall.system, /Você é Bia, Redação em Agência Faísca/);
  // estados na ordem certa, revisão junto de quem produziu
  const states = c.ev.filter(e => e.state).map(e => `${e.agent}:${e.state}`);
  for (const s of ['Ana:planejando', 'Duda:pesquisando', 'Bia:trabalhando', 'Caio:revisando', 'Edu:entregando'])
    assert.ok(states.includes(s), `faltou ${s}: ${states.join(', ')}`);
  assert.deepEqual(c.ev.find(e => e.agent === 'Caio' && e.state === 'revisando').with, ['Bia']);
  const files = (await fs.readdir(r.folder)).sort();
  assert.deepEqual(files, ['01-duda-pesquisar.md', '02-bia-produzir.md', '03-caio-revisar.md', '04-edu-entregar.md', 'resultado.md']);
  assert.match(await fs.readFile(path.join(r.folder, 'resultado.md'), 'utf8'), /Post publicado: Texto/);
});

test('plano inválido: usa o plano padrão (produzir e revisar)', async () => {
  const { chat } = fakeChat({ plan: 'não sei fazer isso' }), c = collect();
  const r = await runTask({ text: 'Qualquer coisa', spec, chat, ...c });
  assert.deepEqual(r.items.map(i => i.action), ['produzir', 'revisar']);
});

test('revisão pedindo ajustes: quem produziu corrige; ninguém fica bloqueado', async () => {
  const { chat } = fakeChat({ review: 'Falta chamada.\nREPROVADO' }), c = collect();
  const r = await runTask({ text: 'Post', spec, chat, ...c });
  // o título certo chega à página já na entrega (antes vinha duplicado)
  assert.ok(c.ev.some(e => e.result === 'Versão corrigida · Bia'));
  assert.ok(!c.ev.some(e => e.state === 'bloqueado'));
  assert.ok(c.ev.some(e => e.agent === 'Caio' && e.state === 'concluido'));
});

test('pergunta simples: quem coordena responde sozinha, sem chamar a equipe', async () => {
  const { chat, calls } = fakeChat({ plan: '{"modo":"direto"}' }), c = collect();
  const r = await runTask({ text: 'O que é um MCP?', spec, chat, ...c });
  assert.equal(calls.length, 2, 'decidir + responder');
  assert.equal(r.items.length, 1); assert.equal(r.items[0].title, 'Resposta · Ana');
  assert.match(r.output, /protocolo/);
  assert.deepEqual([...new Set(c.ev.filter(e => e.state).map(e => e.agent))], ['Ana'], 'só quem coordena aparece');
});

test('cancelar para a tarefa e não chama mais a IA', async () => {
  const ctl = new AbortController(); const { chat, calls } = fakeChat();
  const slow = async (o) => { const t = await chat(o); if (calls.length === 2) ctl.abort(); return t; };
  await assert.rejects(runTask({ text: 'Post', spec, chat: slow, ...collect(), signal: ctl.signal }), (e) => e.code === 'cancelled');
  assert.equal(calls.length, 2);
});

test('plano: nome desconhecido vai para alguém do tipo certo; revisão antes da produção sai; máximo de passos', () => {
  const p = normalizePlan({ passos: [
    { agente: 'Caio', acao: 'revisar', pedido: 'cedo demais' }, { agente: 'Fulano', acao: 'produzir', pedido: 'x' },
    ...Array.from({ length: 10 }, () => ({ agente: 'Bia', acao: 'produzir', pedido: 'y' })), { agente: 'Bia', acao: 'voar' }] }, T, lead);
  assert.equal(p.steps[0].agent.name, 'Bia');
  assert.ok(p.steps.length <= MAX_STEPS);
  assert.ok(!p.steps.some(s => s.action === 'revisar'));
  assert.throws(() => normalizePlan({ passos: [{ agente: 'Caio', acao: 'revisar' }] }, T, lead), /produção/);
});

test('erro do provedor no planejamento para a tarefa (não cai no plano padrão)', async () => {
  let n = 0;
  const chat = async () => { n++; throw Object.assign(new Error('The model `x` does not exist'), { status: 404, provider: 'openai' }); };
  await assert.rejects(runTask({ text: 'Post', spec, chat, ...collect() }), (e) => e.status === 404);
  assert.equal(n, 1);
});

test('lugar de cada passo: o escolhido pela IA, ou deduzido do pedido quando falta ou não existe', async () => {
  const office = { ...spec, areas: { studio: true }, delivery: 'servidor' };
  const plan = JSON.stringify({ modo: 'equipe', passos: [
    { agente: 'Bia', acao: 'produzir', local: 'estudio', pedido: 'Grave o vídeo de lançamento' },
    { agente: 'Duda', acao: 'pesquisar', local: 'cozinha', pedido: 'Levante referências' },
    { agente: 'Caio', acao: 'revisar', local: 'computador', pedido: 'Confira' }] });
  const { chat } = fakeChat({ plan }), c = collect();
  await runTask({ text: 'Vídeo de lançamento', spec: office, chat, ...c });
  const ev = (who, st) => c.ev.find(e => e.agent === who && e.state === st);
  assert.equal(ev('Bia', 'trabalhando').place, 'estudio');
  assert.equal(ev('Duda', 'pesquisando').place, 'leitura', 'lugar inexistente: deduz pela ação');
  assert.deepEqual(ev('Caio', 'revisando').with, ['Bia'], 'revisão no computador vai até quem produziu');
});

test('pergunta direta também tem lugar', async () => {
  const { chat } = fakeChat({ plan: '{"modo":"direto","local":"painel"}' }), c = collect();
  await runTask({ text: 'Como foram as vendas do mês?', spec, chat, ...c });
  assert.equal(c.ev.find(e => e.state === 'trabalhando').place, 'painel');
});

test('dedução por palavras e lugares que dependem do escritório', () => {
  const all = placesFor({ areas: { studio: true, reception: true }, delivery: 'impressora' });
  assert.ok(all.includes('estudio') && all.includes('recepcao') && all.includes('impressora') && !all.includes('servidores'));
  assert.equal(guessPlace('Gravar um reels para o Instagram', 'produzir', all), 'estudio');
  assert.equal(guessPlace('Analisar as vendas de outubro', 'produzir', all), 'painel');
  assert.equal(guessPlace('Responder o paciente', 'entregar', all), 'recepcao');
  assert.equal(guessPlace('Gravar vídeo', 'produzir', placesFor({ areas: {}, delivery: 'servidor' })), 'computador', 'sem estúdio, fica no computador');
});
