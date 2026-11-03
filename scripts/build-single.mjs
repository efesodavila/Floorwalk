// Gera dist/pixel-hq.html: a página inteira num único arquivo, sem servidor.
// Útil para abrir direto no navegador, compartilhar ou publicar como página estática.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const WEB = path.join(ROOT, 'web');
let html = await fs.readFile(path.join(WEB, 'index.html'), 'utf8');

const read = (rel) => fs.readFile(path.join(WEB, rel), 'utf8');
const safeJS = (js) => js.replace(/<\/script/gi, '<\\/script');

// CSS local -> <style>
for (const [tag, href] of [...html.matchAll(/<link rel="stylesheet" href="((?!https?:)[^"]+)">/g)]) {
  html = html.replace(tag, `<style>\n${await read(href)}</style>`);
}
// JS local -> <script> inline (config.js vira a versão sem servidor)
for (const [tag, src] of [...html.matchAll(/<script src="((?!https?:)[^"]+)"><\/script>/g)]) {
  const code = src === 'config.js' ? 'window.PIXELHQ_BRIDGE = false;\n' : await read(src);
  html = html.replace(tag, `<script>\n${safeJS(code)}</script>`);
}
html = html.replace(/<!-- config\.js[^>]*-->\n/, '');

await fs.mkdir(path.join(ROOT, 'dist'), { recursive: true });
const out = path.join(ROOT, 'dist', 'pixel-hq.html');
await fs.writeFile(out, html);
console.log(`Gerado ${path.relative(ROOT, out)} (${(html.length / 1024).toFixed(0)} KB)`);
