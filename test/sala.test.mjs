// Camada D de docs/REGRAS.md (montagem da sala): porta e móveis, com o catálogo e a geometria de verdade da página.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const read = (f) => fs.readFile(new URL('../web/js/' + f, import.meta.url), 'utf8');
const [catalog, geo] = await Promise.all([read('01-catalogo.js'), read('03-geometria.js')]);
const ctx = { console, structuredClone };
vm.createContext(ctx);
vm.runInContext(`const key = (x, z) => x + ',' + z; let W = null; const view = { cx: 0, cy: 0, z: 1 }, TW = 32, TH = 16, UH = 18, WH = 2.6;
  ${catalog}
  ${geo}
  globalThis.G = { set: (w) => { W = w; }, get: () => W, wallProblem, footprintOk, fixDoor, doorFits, isDoor, dims,
    tileRemovable: typeof tileRemovable === 'function' ? tileRemovable : null };`, ctx);
const G = ctx.G;
const rect = (w, d) => { const t = {}; for (let x = 0; x < w; x++) for (let z = 0; z < d; z++) t[x + ',' + z] = 'lilas'; return t; };
// sala 8 × 6 com a porta na parede da esquerda (x = 0), ocupando z = 2 e 3
const room = (extra = {}) => ({ tiles: rect(8, 6), objects: [{ id: 'entrada', item: 'capacho', x: 0, z: 2, rot: 3 }], walls: [], people: [], ...extra });

test('D1: a porta de exemplo é válida', () => {
  G.set(room()); const W = G.get();
  assert.equal(G.footprintOk(W.objects[0], W.objects[0], 'entrada'), 'ok');
});

test('D1: parede não pode trancar a porta (por cima, colada na frente ou na própria parede dela)', () => {
  G.set(room());
  const seal = [
    ['por cima', { a: [0, 3], b: [4, 3] }],
    ['colada na frente', { a: [1, 1], b: [1, 5] }],
    ['na parede da porta', { a: [0, 2], b: [0, 4] }],
  ];
  for (const [why, s] of seal) assert.ok(G.wallProblem({ id: 't', kind: 'ripado', ...s }), `parede ${why} foi aceita`);
  // parede longe da porta continua valendo
  assert.equal(G.wallProblem({ id: 't', kind: 'ripado', a: [4, 0], b: [4, 4] }), null);
});

test('D1: com uma parede trancando a porta (salvo antigo), a porta muda de lugar sozinha', () => {
  G.set(room({ walls: [{ id: 'w', kind: 'ripado', a: [1, 1], b: [1, 5] }] }));
  G.fixDoor(G.get());
  const d = G.get().objects.find(G.isDoor);
  assert.ok(!(d.x === 0 && d.z >= 1 && d.z <= 4 && d.rot === 3), `a porta continuou trancada em ${d.x},${d.z}`);
  assert.equal(G.footprintOk(d, d, d.id), 'ok');
});

test('D2: a borracha de piso não apaga o chão embaixo de móvel, da porta ou de parede', () => {
  G.set(room({ objects: [{ id: 'entrada', item: 'capacho', x: 0, z: 2, rot: 3 }, { id: 'm', item: 'desk', x: 4, z: 1, rot: 0 }],
    walls: [{ id: 'w', kind: 'ripado', a: [7, 0], b: [7, 3] }] }));
  assert.ok(G.tileRemovable, 'falta a checagem de piso removível');
  assert.equal(G.tileRemovable('4,1'), false, 'embaixo da mesa');
  assert.equal(G.tileRemovable('0,2'), false, 'embaixo da porta');
  assert.equal(G.tileRemovable('7,1'), true, 'a parede da borda ainda tem piso do outro lado');
  assert.equal(G.tileRemovable('6,6'), true, 'piso que nem existe não trava');
  assert.equal(G.tileRemovable('2,5'), true, 'piso livre');
  // parede encostada na borda direita (x = 8): só tem piso de um lado
  G.set(room({ walls: [{ id: 'w', kind: 'ripado', a: [8, 0], b: [8, 3] }] }));
  assert.equal(G.tileRemovable('7,1'), false, 'a parede ficaria fora do piso');
});
