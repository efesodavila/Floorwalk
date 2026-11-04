// Gera dist/floorwalk.html: a página inteira num único arquivo, sem servidor.
// Útil para abrir direto no navegador, compartilhar ou publicar como página estática.
//
// Inclui o visual 3D: o código 3D (Three.js e personagens) é empacotado com o esbuild, e os modelos dos
// personagens (web/modelos/*.glb) são embutidos como data: URLs (~14 MB de .glb com os ternos, ~19 MB a mais em base64).
//   node scripts/build-single.mjs              → com 3D e modelos
//   node scripts/build-single.mjs --sem-modelos → com 3D, personagens low-poly feitos em código (bem menor)
//   node scripts/build-single.mjs --sem-3d      → só o 2D (o arquivo antigo, ~0,4 MB)
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const WEB = path.join(ROOT, 'web');
const args = new Set(process.argv.slice(2)), WITH3D = !args.has('--sem-3d'), MODELS = WITH3D && !args.has('--sem-modelos');
let html = await fs.readFile(path.join(WEB, 'index.html'), 'utf8');

const read = (rel) => fs.readFile(path.join(WEB, rel), 'utf8');
const safeJS = (js) => js.replace(/<\/script/gi, '<\\/script');

// CSS local -> <style>
for (const [tag, href] of [...html.matchAll(/<link rel="stylesheet" href="((?!https?:)[^"]+)">/g)]) {
  html = html.replace(tag, `<style>\n${await read(href)}</style>`);
}
// JS local -> <script> inline (config.js vira a versão sem servidor)
for (const [tag, src] of [...html.matchAll(/<script src="((?!https?:)[^"]+)"><\/script>/g)]) {
  const code = src === 'config.js' ? `window.FLOORWALK_BRIDGE = false;\nwindow.FLOORWALK_3D = ${WITH3D};\n` : await read(src);
  html = html.replace(tag, `<script>\n${safeJS(code)}</script>`);
}
html = html.replace(/<!-- config\.js[^>]*-->\n/, '');

// 3D: o mapa de importação aponta para o servidor (/vendor/three); no arquivo único vai tudo empacotado
const importmap = /<script type="importmap">[\s\S]*?<\/script>\n?/, module = /<script type="module" src="js3d\/cena3d\.js"><\/script>/;
if (!WITH3D) html = html.replace(importmap, '').replace(module, '');
else {
  let esbuild;
  try { esbuild = await import('esbuild'); } catch { console.error('Falta o esbuild: npm install'); process.exit(2); }
  const three = path.join(ROOT, 'node_modules', 'three');
  const r = await esbuild.build({
    entryPoints: [path.join(WEB, 'js3d', 'cena3d.js')], bundle: true, format: 'esm', write: false, minify: true,
    target: 'es2022', legalComments: 'none', logLevel: 'warning',
    alias: { three: path.join(three, 'build', 'three.module.js'), 'three/addons': path.join(three, 'examples', 'jsm') },
  });
  let pre = '<script>window.FLOORWALK_MODELOS = false;</script>\n';
  if (MODELS) {
    const dir = path.join(WEB, 'modelos'), files = (await fs.readdir(dir)).filter(f => f.endsWith('.glb')), map = {};
    for (const f of files) map[f] = 'data:model/gltf-binary;base64,' + (await fs.readFile(path.join(dir, f))).toString('base64');
    pre = `<script>window.FLOORWALK_MODELOS = ${JSON.stringify(map)};</script>\n`;
  }
  html = html.replace(importmap, '').replace(module, () => `${pre}<script type="module">\n${safeJS(r.outputFiles[0].text)}</script>`);
}

await fs.mkdir(path.join(ROOT, 'dist'), { recursive: true });
const out = path.join(ROOT, 'dist', 'floorwalk.html');
await fs.writeFile(out, html);
console.log(`Gerado ${path.relative(ROOT, out)} (${(Buffer.byteLength(html) / 1024 / 1024).toFixed(1)} MB${WITH3D ? MODELS ? ', com 3D e modelos' : ', com 3D, personagens low-poly' : ', só 2D'})`);
