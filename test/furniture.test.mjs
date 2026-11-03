// Móveis: catálogo ligado à página, desenho validado, nova tentativa e plano B.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { CATALOG, validateDesign, designFurniture } from '../server/furniture.mjs';
import { PLACES, placesFor, guessPlace } from '../server/places.mjs';

const catalog = await fs.readFile(new URL('../web/js/01-catalogo.js', import.meta.url), 'utf8');
const pagePlaces = catalog.slice(catalog.indexOf('const PLACES = {'), catalog.indexOf('\n};', catalog.indexOf('const PLACES = {')));

test('todo móvel do catálogo do servidor existe na página, com 1 quadrado de fundo e o uso certo', () => {
  for (const [id, c] of Object.entries(CATALOG)) {
    const def = new RegExp(`\\n  ${id}: \\{ n: '[^']+', cat: '[^']+', w: (\\d), d: (\\d)`).exec(catalog);
    assert.ok(def, `${id} não está em ITEMS`);
    assert.equal(Number(def[1]), c.w, `${id}: largura diferente`); assert.equal(def[2], '1', `${id}: precisa ter 1 de fundo`);
    const spot = new RegExp(`\\b${id}: \\[\\[[^\\]]*'([a-z]+)'`).exec(catalog);
    assert.ok(spot, `${id} sem ponto de uso em SPOTS`);
    const acts = new RegExp(`\\n  ${c.place}:\\s+\\{ acts: \\[([^\\]]+)\\]`).exec(pagePlaces);
    assert.ok(acts && acts[1].includes(`'${spot[1]}'`), `${id}: o uso "${spot[1]}" não serve ao lugar ${c.place}`);
    assert.ok(PLACES[c.place], `lugar ${c.place} não existe no servidor`);
  }
});

const good = { w: 2, blocos: [
  { x: .1, z: .2, l: .1, p: .1, y: 0, a: .8, cor: 'metal' }, { x: 1.8, z: .2, l: .1, p: .1, y: 0, a: .8, cor: 'metal' },
  { x: 0, z: .1, l: 2, p: .8, y: .8, a: .06, cor: 'madeira' }, { x: .8, z: .3, l: .4, p: .05, y: .86, a: .3, cor: 'tela' }] };

test('desenho válido vira blocos com cores da paleta; tela brilha', () => {
  const v = validateDesign(good);
  assert.equal(v.ok, true); assert.equal(v.w, 2); assert.equal(v.boxes.length, 4);
  assert.deepEqual(v.boxes[3].slice(6), ['#7D45D6', 1]);
});

test('regras: flutuando, fora dos limites, cor inventada, alto demais', () => {
  const bad = structuredClone(good);
  bad.blocos.push({ x: .5, z: .5, l: .2, p: .2, y: 1.5, a: .2, cor: 'roxo' });   // flutua
  bad.blocos.push({ x: 1.9, z: .5, l: .5, p: .2, y: 0, a: .2, cor: 'roxo' });    // passa da largura
  bad.blocos.push({ x: .2, z: .5, l: .2, p: .2, y: 0, a: 2.5, cor: 'dourado' }); // alto e cor inexistente
  const v = validateDesign(bad);
  assert.equal(v.ok, false);
  const all = v.problems.join(' | ');
  for (const p of ['flutuando', 'largura', 'alto demais', 'dourado']) assert.match(all, new RegExp(p));
});

test('peça presa na lateral conta como apoiada (ex.: saída de papel da impressora)', () => {
  const v = validateDesign({ w: 1, blocos: [{ x: .1, z: .2, l: .8, p: .6, y: 0, a: .6, cor: 'cinza_claro' }, { x: .1, z: .2, l: .8, p: .6, y: .6, a: .12, cor: 'grafite' }, { x: .25, z: .8, l: .5, p: .04, y: .45, a: .03, cor: 'branco' }] });
  assert.equal(v.ok, true);
});

test('desenho errado: tenta de novo mostrando os problemas; depois vale o plano B', async () => {
  let calls = 0, last;
  const ok = await designFurniture(async ({ messages }) => { calls++; last = messages.at(-1).content; return calls === 1 ? '{"w":9,"blocos":[]}' : JSON.stringify(good); }, { name: 'Mesa de som', purpose: 'mixar áudio' });
  assert.equal(calls, 2); assert.match(last, /"w" precisa ser/);
  assert.equal(ok.id, 'c_mesa_de_som'); assert.equal(ok.place, 'p_mesa_de_som'); assert.equal(ok.boxes.length, 4); assert.equal(ok.base, undefined);
  const logs = [];
  const fb = await designFurniture(async () => 'não sei desenhar', { name: 'Forno de pizza', purpose: 'assar pizzas', like: 'fogao' }, (t) => logs.push(t));
  assert.equal(fb.base, 'fogao'); assert.equal(fb.w, 2); assert.match(logs[0], /Forno de pizza/);
});

test('erro do provedor no desenho não é mascarado pelo plano B', async () => {
  await assert.rejects(designFurniture(async () => { throw Object.assign(new Error('x'), { status: 429, provider: 'openai' }); }, { name: 'X', purpose: 'y' }), (e) => e.status === 429);
});

test('lugares novos aparecem só com o móvel certo; palavras levam ao lugar', () => {
  const clinic = placesFor({ areas: {}, delivery: 'servidor', extras: ['maca', 'balanca'], custom: [{ place: 'p_cadeira_dentista', name: 'Cadeira de dentista', purpose: 'atender' }] });
  assert.ok(clinic.includes('atendimento') && !clinic.includes('cozinha') && clinic.includes('p_cadeira_dentista'));
  assert.equal(guessPlace('Fazer a consulta da Joana', 'produzir', clinic), 'atendimento');
  const rest = placesFor({ areas: {}, delivery: 'servidor', extras: ['fogao'] });
  assert.equal(guessPlace('Criar o cardápio de sábado', 'produzir', rest), 'cozinha');
});
