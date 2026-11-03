// Grade com a miniatura 3D de todos os móveis do catálogo (as mesmas do editor), para conferir o visual.
//   node scripts/miniaturas.mjs saida.png [--url=http://127.0.0.1:8787]
// Precisa do servidor rodando (npm start ou npm run demo) e do Playwright.
import { createRequire } from 'node:module';
let chromium;
try { ({ chromium } = await import('playwright')); } catch { try { ({ chromium } = createRequire(import.meta.url)('playwright')); } catch {} }
if (!chromium) { console.error('Instale o Playwright: npm i -D playwright && npx playwright install chromium'); process.exit(2); }
const args = process.argv.slice(2), out = args.find(a => !a.startsWith('--')) || 'miniaturas.png';
const url = (args.find(a => a.startsWith('--url=')) || '--url=http://127.0.0.1:8787').slice(6);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const pg = await b.newPage({ viewport: { width: 1400, height: 1500 } });
const errs = []; pg.on('pageerror', e => errs.push(e.message));
await pg.goto(url + '/?3d'); await pg.waitForFunction(() => document.body.classList.contains('r3d-avatars'), null, { timeout: 60000 });
await pg.waitForTimeout(1500);
await pg.evaluate(() => {
  const d = document.createElement('div'); d.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#F4F2F5;display:flex;flex-wrap:wrap;gap:4px;padding:6px;align-content:flex-start';
  for (const k in ITEMS) d.innerHTML += `<figure style="margin:0;width:200px;text-align:center;font:11px sans-serif"><img src="${THUMBS[k]}" style="width:200px;height:150px"><br>${k}</figure>`;
  document.body.appendChild(d);
});
await pg.waitForTimeout(500); await pg.screenshot({ path: out, fullPage: true });
await b.close();
if (errs.length) { console.error('Erros na página:', errs); process.exit(1); }
console.log('Gerado', out);
