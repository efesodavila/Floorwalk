// O servidor e a página precisam falar o mesmo vocabulário.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { STATES, KINDS, msg } from '../server/protocol.mjs';

const catalog = await fs.readFile(new URL('../web/js/01-catalogo.js', import.meta.url), 'utf8');
const block = (name) => catalog.slice(catalog.indexOf(`const ${name} = {`), catalog.indexOf('\n};', catalog.indexOf(`const ${name} = {`)));
const keys = (name) => [...block(name).matchAll(/^\s{2}([a-z]+):/gm)].map(m => m[1]);

test('estados do servidor = estados da página', () => {
  assert.deepEqual([...STATES].sort(), keys('RULES').sort());
});

test('tipos de papel do servidor = tipos da página', () => {
  assert.deepEqual([...KINDS].sort(), keys('KINDS').sort());
});

test('mensagem state recusa estado desconhecido e aceita os universais', () => {
  assert.throws(() => msg.state({ agent: 'Bia', state: 'codando' }), /inválido/);
  assert.equal(msg.state({ agent: 'Bia', state: 'trabalhando', task: 'x' }).state, 'trabalhando');
});

test('mensagem result leva o texto inteiro; página pode cancelar', async () => {
  const r = msg.result('run-1', { agent: 'Bia', action: 'produzir', title: 'Produção · Bia', text: 'x'.repeat(50000) });
  assert.equal(r.type, 'result'); assert.equal(r.text.length, 40000);
  const { parseClientMessage } = await import('../server/protocol.mjs');
  assert.deepEqual(parseClientMessage('{"type":"cancel","id":"run-1"}'), { cancel: 'run-1' });
  assert.equal(parseClientMessage('{"type":"cancel","id":"../x"}'), null);
});

test('mensagem team exige tipo de papel válido', () => {
  assert.throws(() => msg.team([{ name: 'Ana', role: 'chefe', kind: 'manda' }]), /tipo/);
  const t = msg.team([{ name: 'Ana', role: 'chefe', roleName: 'Chefia', kind: 'coordena' }]);
  assert.deepEqual(t.agents[0], { name: 'Ana', role: 'chefe', roleName: 'Chefia', kind: 'coordena' });
});

test('lugares: mesma lista no servidor e na página, e todo lugar aponta para elementos que existem', async () => {
  const { PLACES } = await import('../server/places.mjs');
  const page = block('PLACES');
  assert.deepEqual(Object.keys(PLACES).sort(), keys('PLACES').sort());
  const affn = catalog.slice(catalog.indexOf('const AFFN = {'), catalog.indexOf('};', catalog.indexOf('const AFFN = {')));
  for (const acts of page.matchAll(/acts: \[([^\]]+)\]/g)) for (const a of acts[1].match(/'([a-z]+)'/g)) assert.ok(affn.includes(a.replace(/'/g, '') + ':'), `elemento ${a} não existe em AFFN`);
});

test('state leva o lugar só se ele existir', () => {
  assert.equal(msg.state({ agent: 'Bia', state: 'trabalhando', place: 'estudio' }).place, 'estudio');
  assert.equal(msg.state({ agent: 'Bia', state: 'trabalhando', place: 'piscina' }).place, undefined);
  assert.equal(msg.state({ agent: 'Bia', state: 'trabalhando', place: 'p_forno_de_pizza' }).place, 'p_forno_de_pizza', 'lugar de móvel criado pela IA');
});
