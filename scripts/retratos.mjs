// Tira prints dos personagens para comparação visual (antes/depois de mexer num modelo ou no kit).
// Requer o Playwright (npm i -D playwright && npx playwright install chromium) e o servidor rodando.
//
//   node scripts/retratos.mjs [conjunto] [arquivo.png] [--url=http://127.0.0.1:8787] [--kit=meshy|lowpoly] [--angulo=0]
//
// Conjuntos:  todos (padrão: um de cada penteado) · acessorios:<penteado> (nenhum, todos, um de cada)
//             sem-oculos (cada penteado com e sem óculos) · poses (parado, digitando, acenando, …)
let chromium;
try { ({ chromium } = await import('playwright')); }
catch { try { ({ chromium } = (await import('node:module')).createRequire(import.meta.url)('playwright')); } catch { /* sem Playwright */ } }   // instalação global
if (!chromium) { console.error('Instale o Playwright: npm i -D playwright && npx playwright install chromium'); process.exit(2); }

const args = process.argv.slice(2), opt = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => a.slice(2).split('=')));
const [conjunto = 'todos', saida = 'retratos.png'] = args.filter(a => !a.startsWith('--'));
const url = opt.url || 'http://127.0.0.1:8787', kit = opt.kit || 'meshy', ry = +(opt.angulo || 0);
const base = { hairStyle: 'curto', top: 'camiseta', extras: {}, skin: '#F3C9A4', hair: '#C8702A', shirt: '#8A3FE0', pants: '#26252C', shoes: '#26262C', ry };
const PENTEADOS = ['curto', 'franja', 'longo', 'coque', 'rabo', 'cacheado', 'raspado'];
const ACC = [{}, { oculos: 1, fone: 1, cracha: 1, barba: 1 }, { oculos: 1 }, { fone: 1 }, { cracha: 1 }, { barba: 1 }];
let looks;
if (conjunto.startsWith('acessorios:')) looks = ACC.map(extras => ({ ...base, hairStyle: conjunto.split(':')[1], extras }));
else if (conjunto === 'sem-oculos') looks = PENTEADOS.flatMap(h => [{ ...base, hairStyle: h }, { ...base, hairStyle: h, extras: { oculos: 1 } }]);
else if (conjunto === 'poses') looks = ['', 'typing', 'wave', 'stuck', 'read', 'hands', 'board'].map(act => ({ ...base, act: act || null }));
else looks = PENTEADOS.map(h => ({ ...base, hairStyle: h }));

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const pg = await browser.newPage({ viewport: { width: Math.max(800, looks.length * 320), height: 600 } });
const errors = []; pg.on('pageerror', e => errors.push(e.message)); pg.on('console', m => m.type() === 'error' && errors.push(m.text()));
await pg.goto(`${url}/dev/retratos.html?k=${kit}&p=${ry ? 25 : 8}#${encodeURIComponent(JSON.stringify(looks))}`);
await pg.waitForFunction(() => window.done, null, { timeout: 120000 });
await pg.screenshot({ path: saida });
await browser.close();
console.log(errors.length ? `salvo em ${saida}, com erros:\n${errors.join('\n')}` : `salvo em ${saida}`);
process.exit(errors.length ? 1 : 0);
