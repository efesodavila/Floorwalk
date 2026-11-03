// Acesso à internet dos agentes: busca, leitura de páginas, proteções e uso pelo coordenador de tarefas.
// Tudo contra um servidor local falso (sem rede de verdade).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import * as web from '../server/web.mjs';
import { runTask, teamOf } from '../server/runner.mjs';
import { createLocks } from '../server/locks.mjs';

let srv, base;
const PAGE = (title, body) => `<!doctype html><html><head><title>${title}</title><script>var x = 1;</script><style>p{}</style></head>
<body><nav>menu</nav><main><h1>${title}</h1><p>${body}</p><p>Mais um parágrafo &amp; acentuação: ação, café.</p></main><footer>rodapé</footer></body></html>`;
before(async () => {
  srv = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/busca') {
      const q = u.searchParams.get('q');
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(`<div class="result"><a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=${encodeURIComponent(base + '/pagina1')}&amp;rut=x">Página &amp; Um</a>
        <a class="result__snippet" href="#">Resumo de <b>${q}</b></a></div>
        <div class="result"><a class="result__a" href="${base}/pagina2">Página Dois</a><div class="result__snippet">Outro resumo</div></div>
        <div class="result"><a class="result__a" href="${base}/binario">Arquivo</a></div>`);
      return;
    }
    if (u.pathname === '/pagina1') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(PAGE('Preço do café 2026', 'O café custa R$ 30 o quilo segundo a fonte um. '.repeat(10))); return; }
    if (u.pathname === '/pagina2') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(PAGE('Mercado de café', 'A safra cresceu 5% de acordo com a fonte dois. '.repeat(10))); return; }
    if (u.pathname === '/redireciona') { res.writeHead(302, { location: '/pagina1' }); res.end(); return; }
    if (u.pathname === '/binario') { res.writeHead(200, { 'content-type': 'application/octet-stream' }); res.end(Buffer.alloc(100)); return; }
    res.writeHead(404); res.end();
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${srv.address().port}`;
  process.env.PIXELHQ_BUSCA_URL = base + '/busca';
});
after(() => { srv.close(); delete process.env.PIXELHQ_BUSCA_URL; delete process.env.PIXELHQ_WEB_LOCAL; });

test('proteção: endereços da rede interna e protocolos estranhos são recusados', async () => {
  delete process.env.PIXELHQ_WEB_LOCAL;
  for (const u of ['http://127.0.0.1/', 'http://localhost:8787/', 'http://10.0.0.5/', 'http://192.168.1.1/', 'http://169.254.169.254/latest/meta-data/', 'http://[::1]/', 'file:///etc/passwd', 'ftp://exemplo.com/', 'http://user:senha@exemplo.com/'])
    await assert.rejects(web.checkURL(u), web.WebError, u);
  await assert.rejects(web.readPage(base + '/pagina1'), /interno/, 'o servidor de teste é local: bloqueado sem a liberação de teste');
});

test('busca no formato do DuckDuckGo: títulos, endereços reais e resumos', async () => {
  process.env.PIXELHQ_WEB_LOCAL = '1';
  const r = await web.search('preço do café');
  assert.equal(r.length, 3);
  assert.deepEqual(r[0], { title: 'Página & Um', url: base + '/pagina1', snippet: 'Resumo de preço do café' });
  assert.equal(r[1].url, base + '/pagina2');
});

test('leitura de página: só o texto principal, entidades decodificadas, redirecionamento seguido', async () => {
  process.env.PIXELHQ_WEB_LOCAL = '1';
  const p = await web.readPage(base + '/redireciona');
  assert.equal(p.url, base + '/pagina1');
  assert.equal(p.title, 'Preço do café 2026');
  assert.match(p.text, /R\$ 30 o quilo/);
  assert.match(p.text, /& acentuação: ação, café/);
  assert.doesNotMatch(p.text, /var x|menu|rodapé/, 'script, menu e rodapé saem');
  await assert.rejects(web.readPage(base + '/binario'), /não é texto/);
  await assert.rejects(web.readPage(base + '/nao-existe'), /404/);
});

const spec = {
  name: 'Torrefação', service: 'Café especial',
  roles: [{ id: 'dir', name: 'Direção', kind: 'coordena' }, { id: 'red', name: 'Redação', kind: 'produz' }, { id: 'pes', name: 'Pesquisa', kind: 'pesquisa' }],
  team: [{ name: 'Ana', role: 'dir' }, { name: 'Bia', role: 'red' }, { name: 'Duda', role: 'pes' }],
};

test('pesquisa com internet: a IA propõe buscas, a equipe lê as páginas e cita as fontes', async () => {
  process.env.PIXELHQ_WEB_LOCAL = '1';
  const prompts = [], ev = [];
  const chat = async ({ messages }) => {
    const u = messages.at(-1).content; prompts.push(u);
    if (u.includes('Decida como atender')) { assert.match(u, /pode pesquisar na internet/); return JSON.stringify({ modo: 'equipe', passos: [{ agente: 'Duda', acao: 'pesquisar', pedido: 'Preço atual do café' }, { agente: 'Bia', acao: 'produzir', pedido: 'Resumo' }] }); }
    if (u.includes('Você vai pesquisar na internet')) return '{"buscas":["preço café 2026"]}';
    if (u.includes('(pesquisa)')) { assert.match(u, /FONTES DA INTERNET/); assert.match(u, /\[1\] Preço do café 2026/); assert.match(u, /Cite a fonte/); return 'O café custa R$ 30 [1].\nFontes: [1] Preço do café 2026'; }
    if (u.includes('(produção)')) return '# Resumo\nCafé a R$ 30 [1]';
    throw new Error('inesperado: ' + u.slice(0, 60));
  };
  const r = await runTask({ text: 'Quanto custa o café hoje?', spec, chat, web, say: (m, state, task, x = {}) => ev.push({ agent: m.name, state, detail: x.detail }), result: () => {}, log: () => {} });
  assert.equal(r.sources.length, 2, 'leu as duas páginas de texto (o arquivo binário foi ignorado)');
  assert.equal(r.sources[0].url, base + '/pagina1');
  assert.ok(ev.some(e => e.agent === 'Duda' && /Lendo 127\.0\.0\.1/.test(e.detail || '')), 'o personagem mostra que está lendo');
});

test('pergunta direta que depende de dado atual: o coordenador pesquisa antes de responder', async () => {
  process.env.PIXELHQ_WEB_LOCAL = '1';
  const chat = async ({ messages }) => {
    const u = messages.at(-1).content;
    if (u.includes('Decida como atender')) return '{"modo":"direto","web":true}';
    if (u.includes('Você vai pesquisar na internet')) return '{"buscas":["café"]}';
    if (u.includes('Responda de forma clara e direta')) { assert.match(u, /FONTES DA INTERNET/); return 'R$ 30 [1]'; }
    throw new Error('inesperado');
  };
  const r = await runTask({ text: 'Preço do café hoje', spec, chat, web, say: () => {}, result: () => {}, log: () => {} });
  assert.equal(r.output, 'R$ 30 [1]'); assert.equal(r.sources.length, 2);
});

test('internet fora do ar: a tarefa continua sem fontes', async () => {
  const down = { search: async () => { throw new Error('sem rede'); }, readPage: async () => { throw new Error('sem rede'); } };
  const logs = [];
  const chat = async ({ messages }) => {
    const u = messages.at(-1).content;
    if (u.includes('Decida como atender')) return JSON.stringify({ modo: 'equipe', passos: [{ agente: 'Duda', acao: 'pesquisar', pedido: 'x' }, { agente: 'Bia', acao: 'produzir', pedido: 'y' }] });
    if (u.includes('Você vai pesquisar')) return '{"buscas":["x"]}';
    if (u.includes('(pesquisa)')) { assert.doesNotMatch(u, /FONTES DA INTERNET/); assert.match(u, /não tem acesso à internet/); return 'sem fontes'; }
    if (u.includes('(produção)')) return 'ok';
    throw new Error('inesperado');
  };
  const r = await runTask({ text: 't', spec, chat, web: down, say: () => {}, result: () => {}, log: (a, t) => logs.push(t) });
  assert.equal(r.output, 'ok'); assert.ok(logs.some(t => /seguindo sem internet/.test(t)));
});

test('travas: o mesmo agente nunca trabalha em duas tarefas ao mesmo tempo; agentes diferentes, sim', async () => {
  const { lock } = createLocks(), order = [];
  const job = async (names, tag, ms) => { const rel = await lock(names); order.push(`+${tag}`); await new Promise(r => setTimeout(r, ms)); order.push(`-${tag}`); rel(); };
  await Promise.all([job(['Ana'], 'a1', 30), job(['Ana', 'Bia'], 'a2', 10), job(['Caio'], 'c', 5)]);
  assert.ok(order.indexOf('+a2') > order.indexOf('-a1'), 'a2 espera a1 liberar a Ana');
  assert.ok(order.indexOf('+c') < order.indexOf('-a1'), 'Caio não espera ninguém');
});

test('duas tarefas em paralelo com a mesma equipe: cada agente faz uma coisa por vez', async () => {
  const { lock } = createLocks(); const T = teamOf(spec); let active = new Map(), clash = false;
  const chat = async ({ messages, system }) => {
    const u = messages.at(-1).content, who = T.find(m => system.includes(`Você é ${m.name}`)).name;
    if (active.get(who)) clash = true; active.set(who, true);
    await new Promise(r => setTimeout(r, 15)); active.set(who, false);
    if (u.includes('Decida como atender')) return JSON.stringify({ modo: 'equipe', passos: [{ agente: 'Bia', acao: 'produzir', pedido: 'y' }] });
    return 'ok';
  };
  const run = (text) => runTask({ text, spec, chat, lock, say: () => {}, result: () => {}, log: () => {} });
  const [a, b] = await Promise.all([run('tarefa 1'), run('tarefa 2')]);
  assert.equal(a.output, 'ok'); assert.equal(b.output, 'ok'); assert.equal(clash, false);
});
