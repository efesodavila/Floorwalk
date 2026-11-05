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

test('F4: nome de pasta, arquivo, comando e pessoa nunca é traduzido, mesmo igual a uma palavra do dicionário', async () => {
  const { T } = await load('en');
  assert.equal(T('Projeto'), 'Project', 'a palavra sozinha é do dicionário');
  assert.equal(T('Editando Planta'), 'Editing Planta', 'arquivo chamado "Planta"');
  assert.equal(T('Rodando: Editar'), 'Running: Editar', 'comando');
  assert.equal(T('Projeto entrou na equipe. Arraste para onde quiser.'), 'Projeto joined the team. Drag them anywhere.', 'pessoa');
  assert.equal(T('Iluminação: ☀ Dia · 08:30'), 'Lighting: ☀ Day · 08:30', 'onde precisa, o miolo continua traduzido');
  // na tela: nomes de pessoas e sessões vão marcados para a tradução automática pular
  for (const f of ['23-ficha-render.js', '27-menu.js', '16-fonte-tempo-real.js']) {
    const s = await read(f);
    assert.doesNotMatch(s, /<b>\$\{escapeHTML\(p\.name\)\}<\/b>/, `${f}: nome sem data-no-i18n`);
  }
  assert.match(idioma, /characterData[^\n]*data-no-i18n|data-no-i18n[^\n]*characterData/, 'texto alterado também respeita data-no-i18n');
});

test('F1: todo texto fixo da página (avisos, carregamento, confirmações) tem tradução', async () => {
  const { T } = await load('en');
  const dirs = ['js', 'js3d'], miss = [];
  const RE = [/\btoast\??\.?\(\s*'((?:\\'|[^'])+)'/g, /\bloadStep\??\.?\(\s*[\d.]+,\s*'((?:\\'|[^'])+)'/g, /\b(?:title|text|ok|cancel):\s*'((?:\\'|[^'])+)'/g];
  for (const d of dirs) for (const f of await fs.readdir(new URL(`../web/${d}/`, import.meta.url))) {
    if (!f.endsWith('.js')) continue;
    const s = await fs.readFile(new URL(`../web/${d}/${f}`, import.meta.url), 'utf8');
    for (const re of RE) for (const m of s.matchAll(re)) {
      let t = m[1].replace(/\\'/g, "'"); if (!/[A-Za-zÀ-ú]{3}/.test(t) || /^#[0-9a-f]{3,8}$/i.test(t)) continue;
      if (t.endsWith('(')) t += 'x).'; else if (/[:\s]$/.test(t)) t += 'x'; // texto que continua com uma parte variável
      if (T(t) === t) miss.push(`${d}/${f}: ${t}`);
    }
  }
  assert.deepEqual(miss, []);
});

test('todo detalhe que o servidor manda das sessões do Claude Code tem tradução', async () => {
  const { T } = await load('en');
  const src = await fs.readFile(new URL('../server/claude-code.mjs', import.meta.url), 'utf8');
  const details = [...src.matchAll(/detail: ['`]([^'`$]+)/g)].map(m => m[1].trim()).filter(Boolean);
  assert.ok(details.length > 10);
  for (const d0 of details) { const d = /[:]$/.test(d0) ? d0 + ' x' : d0; assert.notEqual(T(d), d, `sem tradução: "${d0}"`); }
});
