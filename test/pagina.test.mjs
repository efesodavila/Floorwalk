// Camada C de docs/REGRAS.md (página): o que dá para conferir sem abrir o navegador.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const WEB = new URL('../web/', import.meta.url);
async function sources() {
  const out = [];
  for (const dir of ['js', 'js3d']) for (const f of await fs.readdir(new URL(dir + '/', WEB))) if (f.endsWith('.js')) out.push([path.posix.join(dir, f), await fs.readFile(new URL(`${dir}/${f}`, WEB), 'utf8')]);
  return out;
}
// tira comentários e textos entre aspas: só sobra código de verdade
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/.*$/gm, '$1').replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/g, "''");

test('C8: nenhum confirm, alert ou prompt do navegador', async () => {
  const all = await sources();
  assert.ok(all.length > 20, 'achou os scripts da página');
  for (const [f, s] of all) {
    const m = code(s).match(/(?<![\w.$])(?:window\.)?(confirm|alert|prompt)\s*\(/);
    assert.equal(m, null, `${f} usa ${m?.[1]}() nativo: use askConfirm (web/js/20-toast-gaveta.js)`);
  }
});
