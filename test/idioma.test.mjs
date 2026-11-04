// Idioma da interface (web/js/01-idioma.js): em inglês, catálogo e textos da tela traduzidos; em português, nada muda.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const read = (f) => fs.readFile(new URL('../web/js/' + f, import.meta.url), 'utf8');
const [catalog, idioma] = await Promise.all([read('01-catalogo.js'), read('01-idioma.js')]);

// carrega os dois scripts como o navegador faria (globais compartilhadas), com o idioma escolhido
async function load(lang) {
  const confirm = () => true, alert = () => {};
  const ctx = {
    console, navigator: { languages: [lang === 'pt' ? 'pt-BR' : 'en-US'] },
    localStorage: { getItem: () => null, setItem() {} },
    document: { documentElement: {}, body: null, addEventListener() {} },
    window: { confirm, alert }, location: { reload() {} },
  };
  vm.createContext(ctx);
  vm.runInContext(catalog + '\n' + idioma + '\n;globalThis.__ = { T, LANG, ITEMS, RULES, AFFN, PLACES };', ctx);
  return ctx.__;
}

test('em inglês: o que chega das sessões do Claude Code é traduzido, sem tocar em arquivos e comandos', async () => {
  const { T, LANG } = await load('en');
  assert.equal(LANG, 'en');
  assert.equal(T('Editando src/app.ts'), 'Editing src/app.ts');
  assert.equal(T('Rodando: npm test -- --watch'), 'Running: npm test -- --watch');
  assert.equal(T('Pedindo permissão: Bash'), 'Asking permission: Bash');
  assert.equal(T('Turno concluído'), 'Turn done');
  assert.equal(T('há 5s'), 'for 5s');
  assert.equal(T('Bia'), 'Bia', 'nome de pessoa não muda');
  assert.equal(T('loja-web'), 'loja-web');
});

test('em inglês: catálogo traduzido pelo id, e frases montadas com ele também', async () => {
  const { T, ITEMS, RULES, AFFN } = await load('en');
  assert.equal(ITEMS.desk.n, 'Desk'); assert.equal(ITEMS.rack.n, 'Server rack');
  assert.equal(RULES.bloqueado.n, 'Blocked');
  assert.equal(T(`Sem ${AFFN.work.toLowerCase()} na sala. Fica onde está.`), 'No desk in the room. Staying put.');
  assert.equal(T('Voltou para a mesa: Desk: the nearest free one'), 'Back to the desk: Desk: the nearest free one');
});

test('em português: nada muda', async () => {
  const { T, LANG, ITEMS } = await load('pt');
  assert.equal(LANG, 'pt');
  assert.equal(T('Editando src/app.ts'), 'Editando src/app.ts');
  assert.equal(ITEMS.desk.n, 'Mesa de trabalho');
});

test('todo detalhe que o servidor manda das sessões do Claude Code tem tradução', async () => {
  const { T } = await load('en');
  const src = await fs.readFile(new URL('../server/claude-code.mjs', import.meta.url), 'utf8');
  const details = [...src.matchAll(/detail: ['`]([^'`$]+)/g)].map(m => m[1].trim()).filter(Boolean);
  assert.ok(details.length > 10);
  for (const d0 of details) { const d = /[:]$/.test(d0) ? d0 + ' x' : d0; assert.notEqual(T(d), d, `sem tradução: "${d0}"`); }
});
