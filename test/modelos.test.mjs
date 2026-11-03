// Cada acessório e cada peça "de baixo" listados em MODELS precisam existir no .glb correspondente.
// Se um modelo for trocado e as peças mudarem de lugar, o acessório deixaria de sumir sem aviso: este teste pega.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ilhas, conferir } from '../scripts/glb-ilhas.mjs';
import { MODELS } from '../web/js3d/personagens3d-meshy.js';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'web', 'modelos');

for (const [id, def] of Object.entries(MODELS)) {
  test(`modelo ${id}: todas as peças listadas existem no ${def.file}`, () => {
    const lista = ilhas(path.join(DIR, def.file));
    for (const [nome, pontos] of [...Object.entries(def.acc || {}), ...Object.entries(def.roles || {})]) {
      const faltando = conferir(lista, pontos);
      assert.deepEqual(faltando, [], `${id}.${nome}: nenhuma ilha perto de ${JSON.stringify(faltando)}`);
    }
  });
}
