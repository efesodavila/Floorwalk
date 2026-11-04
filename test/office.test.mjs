// Ficha do escritório: validação, conserto e nova tentativa quando a IA erra o formato.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { normalizeSpec, extractJSON, planOffice, LIMITS } from '../server/office.mjs';

const good = () => ({
  nome: 'Agência Faísca', servico: 'Marketing para lojas', estilo: 'criativo', entrega: 'servidor', areas: { estudio: true, recepcao: false },
  papeis: [{ id: 'direcao', nome: 'Direção', tipo: 'coordena' }, { id: 'redacao', nome: 'Redação', tipo: 'produz' }, { id: 'revisao', nome: 'Revisão', tipo: 'revisa' }, { id: 'sobra', nome: 'Sobra', tipo: 'pesquisa' }],
  equipe: [{ nome: 'Ana', papel: 'direcao', funcao: 'Organiza' }, { nome: 'Bia', papel: 'redacao', funcao: 'Escreve' }, { nome: 'Caio', papel: 'revisao', funcao: 'Revisa' }],
  rotulos: { trabalhando: 'escrevendo', invalido: 'x', entregando: 'Publicando nas redes sociais agora' },
  tarefas_exemplo: ['Post de lançamento'], pesquisas_exemplo: ['Concorrentes'],
});

test('ficha válida: papéis sem ninguém saem, rótulos são limpos', () => {
  const s = normalizeSpec(good());
  assert.equal(s.name, 'Agência Faísca'); assert.equal(s.style, 'criativo'); assert.equal(s.areas.studio, true);
  assert.deepEqual(s.roles.map(r => r.id), ['direcao', 'redacao', 'revisao']);
  assert.equal(s.labels.trabalhando, 'Escrevendo'); assert.equal(s.labels.invalido, undefined);
  assert.equal(s.labels.entregando, 'Publicando nas redes', 'corta entre palavras');
});

test('sem ninguém coordenando, a primeira pessoa assume', () => {
  const g = good(); g.papeis = g.papeis.filter(p => p.tipo !== 'coordena'); g.equipe[0].papel = 'redacao';
  const s = normalizeSpec(g);
  const lead = s.roles.find(r => r.kind === 'coordena');
  assert.ok(lead); assert.equal(s.team[0].role, lead.id);
  assert.equal(s.team.filter(m => s.roles.find(r => r.id === m.role).kind === 'coordena').length, 1);
});

test('duas pessoas coordenando: só a primeira fica', () => {
  const g = good(); g.equipe[1].papel = 'direcao';
  const s = normalizeSpec(g);
  assert.equal(s.team.filter(m => m.role === 'direcao').length, 1);
});

test('papel desconhecido, nome repetido, tipo inválido e excesso de pessoas são consertados', () => {
  const g = good();
  g.papeis[1].tipo = 'inventado';
  g.equipe.push({ nome: 'Ana', papel: 'redacao' }, { nome: 'Duda', papel: 'nao-existe' });
  for (let i = 0; i < 10; i++) g.equipe.push({ nome: 'Extra' + i, papel: 'redacao' });
  const s = normalizeSpec(g);
  assert.equal(s.roles.find(r => r.id === 'redacao').kind, 'produz');
  assert.equal(s.team.filter(m => m.name === 'Ana').length, 1);
  assert.equal(s.team.find(m => m.name === 'Duda').role, 'redacao');
  assert.equal(s.team.length, LIMITS.teamMax);
});

test('equipe pequena demais é recusada', () => {
  const g = good(); g.equipe = g.equipe.slice(0, 1);
  assert.throws(() => normalizeSpec(g), /equipe precisa/);
});

test('extrai o JSON mesmo cercado de texto ou ```', () => {
  assert.equal(extractJSON('Claro!\n```json\n{"a":1}\n```').a, 1);
  assert.throws(() => extractJSON('sem json'), /não tinha JSON/);
});

/* nova tentativa: um Ollama falso erra na primeira e acerta na segunda */
let mock, base, calls = 0, lastMessages;
before(async () => {
  mock = http.createServer(async (req, res) => {
    let body = ''; for await (const c of req) body += c;
    calls++; lastMessages = JSON.parse(body).messages;
    const content = calls === 1 ? '{"nome":"X","equipe":[]}' : JSON.stringify(good());
    res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ message: { role: 'assistant', content } }));
  });
  await new Promise(r => mock.listen(0, '127.0.0.1', r)); base = `http://127.0.0.1:${mock.address().port}`;
});
after(() => mock.close());

test('ficha inválida: pede de novo mostrando o erro, e aceita a correção', async () => {
  const s = await planOffice({ provider: 'ollama', model: 'm', baseUrl: base }, 'Agência de marketing para lojas de roupa');
  assert.equal(calls, 2);
  assert.match(lastMessages.at(-1).content, /equipe precisa/);
  assert.equal(s.team.length, 3);
});

test('móveis: só ids do catálogo (até 3); móvel novo só se não repetir o catálogo (até 2)', () => {
  const g = good(); g.elementos = ['maca', 'inexistente', 'maca', 'balanca', 'fogao', 'vitrine'];
  g.moveis_novos = [{ nome: 'Maca de atendimento', finalidade: 'x' }, { nome: 'Cadeira de dentista', finalidade: 'atender', parecido_com: 'cadeira_salao' }, { nome: 'A' }, { nome: 'B' }];
  const s = normalizeSpec(g);
  assert.deepEqual(s.extras, ['maca', 'balanca', 'fogao']);
  assert.deepEqual(s.customRequests.map(m => m.name), ['Cadeira de dentista', 'A']);
});

// a IA escolhe TODOS os móveis do negócio (sem pacote de escritório fixo)
test('ficha: móveis escolhidos pela IA são conferidos e decidem estúdio, recepção e entrega', async () => {
  const { normalizeSpec, LIBRARY } = await import('../server/office.mjs');
  const base = { nome: 'Foto', papeis: [{ id: 'c', nome: 'C', tipo: 'coordena' }, { id: 'f', nome: 'Foto', tipo: 'produz' }], equipe: ['Ana', 'Bia', 'Caio', 'Duda'].map((n, i) => ({ nome: n, papel: i ? 'f' : 'c' })) };
  const s = normalizeSpec({ ...base, entrega: 'servidor', moveis: ['chroma', 'softbox', 'softbox', 'tripod', 'desk', 'desk', 'reception', 'coffee', 'sofa', 'desk', 'desk', 'desk', 'nave_espacial', 'maca'] });
  assert.ok(!s.furniture.includes('nave_espacial'));                 // id inventado sai
  assert.equal(s.furniture.filter(x => x === 'desk').length, 4);      // no máximo 4 de cada
  assert.ok(s.areas.studio && s.areas.reception);                     // seguem os móveis
  assert.ok(!s.furniture.includes('rack'));                           // nada de rack que a IA não pediu
  assert.deepEqual(s.extras, ['maca']);                               // os do catálogo viram "extras" (lugares da IA)
  // ficha antiga, sem a lista, continua como antes
  const old = normalizeSpec({ ...base, areas: { estudio: true }, elementos: ['maca'] });
  assert.deepEqual(old.furniture, []); assert.equal(old.areas.studio, true); assert.deepEqual(old.extras, ['maca']);
  // todo id da biblioteca existe no catálogo da página
  const web = await (await import('node:fs/promises')).readFile(new URL('../web/js/01-catalogo.js', import.meta.url), 'utf8');
  for (const id of Object.keys(LIBRARY)) assert.match(web, new RegExp(`\n  ${id}: \{ n: '`), id);
});

test('ficha: piso, cor da parede e salas fechadas escolhidos pela IA', async () => {
  const { normalizeSpec, FLOORS, WALL_COLORS } = await import('../server/office.mjs');
  const base = { nome: 'Clínica', papeis: [{ id: 'c', nome: 'C', tipo: 'coordena' }, { id: 'm', nome: 'Med', tipo: 'produz' }], equipe: ['Ana', 'Bia', 'Caio'].map((n, i) => ({ nome: n, papel: i ? 'm' : 'c' })), moveis: ['maca', 'desk', 'meeting', 'reception'] };
  const s = normalizeSpec({ ...base, piso: 'madeira_escura', parede: 'areia', salas: [{ moveis: ['maca', 'foguete'], parede: 'alvenaria', motivo: 'privacidade' }, { moveis: ['maca', 'meeting'], parede: 'vidro' }, { moveis: ['sofa'], parede: 'vidro' }, { moveis: ['desk'], parede: 'castelo' }] });
  assert.equal(s.floor, 'madeira_escura'); assert.equal(s.wallColor, WALL_COLORS.areia);
  assert.deepEqual(s.rooms.map(r => [r.items, r.wall]), [[['maca'], 'alvenaria'], [['meeting'], 'vidro'], [['desk'], 'alvenaria']]); // sofá não está na lista; maca só numa sala; tipo inválido vira alvenaria
  const bad = normalizeSpec({ ...base, piso: 'lava', parede: 'roxo-neon' });
  assert.equal(bad.floor, null); assert.equal(bad.wallColor, null); assert.deepEqual(bad.rooms, []);
  // as opções existem no editor
  const web = await (await import('node:fs/promises')).readFile(new URL('../web/js/01-catalogo.js', import.meta.url), 'utf8');
  for (const k of Object.keys(FLOORS)) assert.match(web, new RegExp(`\n  ${k}: +\{ n: '`), k);
  for (const c of Object.values(WALL_COLORS)) assert.ok(web.includes(`'${c}'`), c);
});
