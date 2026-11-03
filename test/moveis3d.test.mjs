// Móveis 3D: todo item do catálogo vira peças válidas, dentro da área dele, e o giro bate com o do catálogo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

// carrega o catálogo da página (script clássico) e expõe ITEMS como o navegador faz
const src = await fs.readFile(new URL('../web/js/01-catalogo.js', import.meta.url), 'utf8');
const ctx = vm.createContext({ Math, Object, Array, String, Number, Set, Map, JSON });
vm.runInContext(src + '\n;globalThis.ITEMS = ITEMS; globalThis.rotRect = undefined;', ctx);
globalThis.ITEMS = ctx.ITEMS;
const { furnitureKit } = await import('../web/js3d/moveis3d.js');
const FK = furnitureKit({ THREE, RoundedBoxGeometry, isAnim: (b) => !!(b.screen || b.led != null || b.blink || b.pulse || b.paper || b.sway || b.note != null || b.bar != null || b.steam) });

test('todo item do catálogo gera peças com geometria válida, dentro da área do item', () => {
  for (const [id, it] of Object.entries(ctx.ITEMS)) {
    const pcs = FK.pieces(id, it.color || '#888888');
    assert.ok(pcs.length > 0, `${id}: nenhuma peça`);
    const bb = new THREE.Box3();
    for (const p of pcs) {
      const pos = p.geo.attributes.position.array;
      assert.ok(pos.length && pos.every(Number.isFinite), `${id}: vértice inválido`);
      assert.match(p.c, /^#[0-9a-f]{6}$/i, `${id}: cor ${p.c}`);
      p.geo.computeBoundingBox(); bb.union(p.geo.boundingBox);
    }
    // folhas e roupas podem passar um pouco da área; nada vai longe
    const tol = .35;
    assert.ok(bb.min.x > -tol && bb.max.x < it.w + tol && bb.min.z > -tol && bb.max.z < it.d + tol, `${id}: sai da área (${bb.min.x.toFixed(2)}..${bb.max.x.toFixed(2)} × ${bb.min.z.toFixed(2)}..${bb.max.z.toFixed(2)})`);
    assert.ok(bb.min.y > -.01, `${id}: abaixo do piso`);
  }
});

test('cadeiras das mesas viram modelo (uma por lugar), não as caixas do catálogo', () => {
  const chairs = ctx.ITEMS.meeting.boxes.filter(b => b.ch).length / 3;
  assert.equal(chairs, 7);
  const pcs = FK.pieces('meeting', '#888888');
  assert.ok(pcs.length > chairs * 10, 'cada cadeira tem base em estrela, coluna, assento e encosto');
});

test('giro: o mesmo do catálogo (rotRect)', () => {
  const rotRect = (bx, bz, bw, bd, Wd, Dd, rot) => { for (let i = 0; i < (rot % 4); i++) { [bx, bz, bw, bd] = [Dd - bz - bd, bx, bd, bw]; [Wd, Dd] = [Dd, Wd]; } return [bx, bz, bw, bd]; };
  for (let rot = 0; rot < 4; rot++) {
    const M = FK.matrix('sofa', rot, 5, 7), [x, z, w, d] = rotRect(0, 0, 3, 1, 3, 1, rot);
    const a = new THREE.Vector3(0, 0, 0).applyMatrix4(M), b = new THREE.Vector3(3, 0, 1).applyMatrix4(M);
    assert.deepEqual([Math.min(a.x, b.x), Math.min(a.z, b.z), Math.abs(a.x - b.x), Math.abs(a.z - b.z)].map(v => +v.toFixed(6)), [5 + x, 7 + z, w, d], `rot ${rot}`);
  }
});
