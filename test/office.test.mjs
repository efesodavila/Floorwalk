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
