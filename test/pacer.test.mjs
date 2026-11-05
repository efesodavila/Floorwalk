// Camada G de docs/REGRAS.md: ritmo dos estados (G3) e nomes de estado aceitos pela página (G2).
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { createPacer } from '../server/pacer.mjs';
import { STATES } from '../server/protocol.mjs';

const DWELL = 3500;
function setup() {
  mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1_000_000 });
  const sent = [], p = createPacer((m) => sent.push({ ...m, at: Date.now() }), DWELL);
  // em passos: um avanço grande de uma vez não dispara os timers criados no meio dele
  const tick = (ms) => { while (ms > 0) { const d = Math.min(100, ms); mock.timers.tick(d); ms -= d; } };
  return { sent, p, tick };
}

test('G3: cada estado fica pelo menos MIN_DWELL na tela antes do próximo', (t) => {
  const { sent, p, tick } = setup(); t.after(() => mock.timers.reset());
  p.push({ agent: 'Bia', state: 'trabalhando', task: 'x' });
  p.push({ agent: 'Bia', state: 'revisando', task: 'x' });
  assert.equal(sent.length, 1, 'o primeiro vai na hora');
  tick(DWELL - 1); assert.equal(sent.length, 1, 'o segundo espera');
  tick(1); assert.equal(sent.length, 2);
  assert.equal(sent[1].at - sent[0].at, DWELL);
  // cada agente tem o seu ritmo: outro agente não espera a Bia
  p.push({ agent: 'Caio', state: 'pesquisando', task: 'y' }); assert.equal(sent.at(-1).agent, 'Caio');
});

test('G3: estado repetido só atualiza o texto, sem esperar nem segurar mais', (t) => {
  const { sent, p, tick } = setup(); t.after(() => mock.timers.reset());
  p.push({ agent: 'Bia', state: 'trabalhando', task: 'x', detail: 'Editando a.js' });
  tick(500);
  p.push({ agent: 'Bia', state: 'trabalhando', task: 'x', detail: 'Editando b.js' });
  assert.equal(sent.length, 2, 'o texto novo do mesmo estado aparece na hora');
  assert.equal(sent[1].detail, 'Editando b.js');
  // e não estica o tempo mínimo: o estado seguinte continua saindo DWELL depois do primeiro
  p.push({ agent: 'Bia', state: 'revisando', task: 'x' });
  tick(DWELL - 500 - 1); assert.equal(sent.length, 2);
  tick(1); assert.equal(sent.at(-1).state, 'revisando');
  // na fila, repetidos viram um só (o mais novo)
  p.push({ agent: 'Bia', state: 'trabalhando', task: 'x', detail: '1' });
  p.push({ agent: 'Bia', state: 'trabalhando', task: 'x', detail: '2' });
  tick(DWELL); assert.deepEqual(sent.slice(-1).map(m => m.detail), ['2']);
});

test('G3: tempo próprio (hold) e fila longa (ficam o primeiro e os 2 últimos)', (t) => {
  const { sent, p, tick } = setup(); t.after(() => mock.timers.reset());
  p.push({ agent: 'Bia', state: 'concluido', task: 'x' }, 4500);
  for (const st of ['planejando', 'trabalhando', 'revisando', 'pesquisando', 'entregando', 'aguardando']) p.push({ agent: 'Bia', state: st, task: 'x' });
  tick(4499); assert.equal(sent.length, 1, 'o "concluído" fica 4,5 s');
  tick(DWELL * 10);
  assert.deepEqual(sent.map(m => m.state), ['concluido', 'planejando', 'pesquisando', 'entregando', 'aguardando']);
  assert.ok(sent.every(m => !('hold' in m)), 'o "hold" não vai para a página');
});

test('G2: a página aceita os nomes antigos e em inglês, e recusa o desconhecido', async () => {
  const src = await fs.readFile(new URL('../web/js/01-catalogo.js', import.meta.url), 'utf8');
  const ctx = { console, structuredClone }; vm.createContext(ctx);
  vm.runInContext(src + '\n;globalThis.__ = { normState, ALIASES, RULES };', ctx);
  const { normState, ALIASES } = ctx.__;
  for (const [k, v] of [['codando', 'trabalhando'], ['working', 'trabalhando'], ['done', 'concluido'], ['Concluído', 'concluido'], [' REVIEWING ', 'revisando'], ['blocked', 'bloqueado']]) assert.equal(normState(k), v, k);
  for (const s of STATES) assert.equal(normState(s), s, s);
  assert.equal(normState('dançando'), null); assert.equal(normState(''), null); assert.equal(normState(undefined), null);
  for (const [k, v] of Object.entries(ALIASES)) assert.ok(STATES.includes(v), `${k} → ${v} não é um estado`);
});
