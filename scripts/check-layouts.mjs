// Monta o escritório em todas as combinações de estilo e áreas e confere a planta
// (móveis sem sobreposição, ninguém preso, todo lugar de trabalho alcançável).
// Requer o Playwright: npm i -D playwright && npx playwright install chromium
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

let chromium;
try { ({ chromium } = await import('playwright')); }
catch { console.error('Instale o Playwright: npm i -D playwright && npx playwright install chromium'); process.exit(2); }

const page = pathToFileURL(path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), 'web', 'index.html')).href;
const browser = await chromium.launch();
const pg = await browser.newPage();
const errors = []; pg.on('pageerror', e => errors.push(e.message));
await pg.goto(page); await pg.waitForTimeout(500);
const result = await pg.evaluate(() => {
  const spec = (style, studio, reception, delivery) => ({ name: 'Teste', style, delivery, areas: { studio, reception },
    roles: [{ id: 'c', name: 'C', kind: 'coordena' }, { id: 'p', name: 'P', kind: 'produz' }, { id: 'r', name: 'R', kind: 'revisa' }],
    team: ['Ana', 'Bia', 'Caio', 'Duda', 'Edu', 'Fê'].map((n, i) => ({ name: n, role: i === 0 ? 'c' : i === 5 ? 'r' : 'p' })), labels: {}, tasks: [], research: [] });
  const out = {}; let n = 0;
  for (const s of Object.keys(STYLE_PRESETS)) for (const st of [false, true]) for (const re of [false, true]) for (const d of ['servidor', 'impressora']) {
    n++; const p = officeProblems(officeWorld(spec(s, st, re, d)));
    if (p.length) out[`${s} · estúdio ${st} · recepção ${re} · ${d}`] = p;
  }
  // cada móvel extra em cada vaga em que cabe
  const extras = Object.keys(ITEMS).filter(id => ITEMS[id].d === 1 && ['atendimento', 'cozinha', 'comércio', 'oficina'].includes(ITEMS[id].cat));
  for (const id of extras) for (let i = 0; i < SLOTS.length; i++) {
    if (SLOTS[i].len < ITEMS[id].w) continue;
    const keep = SLOTS.slice(); SLOTS.splice(0, SLOTS.length, keep[i]);
    const w = officeWorld({ ...spec('moderno', false, false, 'servidor'), extras: [id] }); SLOTS.splice(0, SLOTS.length, ...keep); n++;
    const p = w.objects.some(o => o.item === id) ? officeProblems(w) : ['não coube na vaga'];
    if (p.length) out[`${id} na vaga ${i}`] = p;
  }
  // todas as vagas ocupadas, com e sem estúdio, com um móvel criado pela IA
  registerCustom({ id: 'c_teste', act: 'x_teste', place: 'p_teste', name: 'Móvel de teste', purpose: 'testar', w: 2, boxes: [[0, .1, 2, .8, 0, .9, '#B07A4A', 0]] });
  for (const st of [false, true]) {
    n++; const w = officeWorld({ ...spec('criativo', st, true, 'impressora'), extras: ['bancada_cozinha', 'estoque', 'maca', 'vitrine', 'balanca'], custom: [{ id: 'c_teste', act: 'x_teste', place: 'p_teste', name: 'Móvel de teste', purpose: 'testar', w: 2, boxes: [[0, .1, 2, .8, 0, .9, '#B07A4A', 0]] }] });
    const p = officeProblems(w); if (p.length) out[`vagas cheias (estúdio ${st})`] = p;
  }
  // o validador precisa pegar um erro de propósito
  const bad = officeWorld(spec('moderno', false, false, 'servidor')); bad.objects.push({ id: 'x', item: 'sofa', x: 2, z: 2, rot: 0 });
  return { n, out, catches: officeProblems(bad).length > 0 };
});
await browser.close();
if (errors.length) { console.error('Erros na página:', errors); process.exit(1); }
if (!result.catches) { console.error('O validador não detectou uma sobreposição feita de propósito.'); process.exit(1); }
const bad = Object.entries(result.out);
for (const [k, v] of bad) console.error(`✗ ${k}\n  - ${v.join('\n  - ')}`);
console.log(bad.length ? `${bad.length} de ${result.n} combinações com problema.` : `As ${result.n} combinações estão válidas (estilos, áreas, móveis em cada vaga, vagas cheias).`);
process.exit(bad.length ? 1 : 0);
