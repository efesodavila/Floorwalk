// Confere que a página e os scripts estão ligados certo (sem abrir navegador).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), 'web');
const html = await fs.readFile(path.join(WEB, 'index.html'), 'utf8');
const listed = [...html.matchAll(/<script src="js\/([^"]+)"><\/script>/g)].map(m => m[1]);

test('todo arquivo em web/js está no index.html, em ordem alfabética', async () => {
  const onDisk = (await fs.readdir(path.join(WEB, 'js'))).filter(f => f.endsWith('.js')).sort();
  assert.deepEqual(listed, onDisk, 'a ordem de carregamento segue o prefixo numérico dos arquivos');
});

test('cada script usa modo estrito', async () => {
  for (const f of listed) {
    const src = await fs.readFile(path.join(WEB, 'js', f), 'utf8');
    assert.ok(src.startsWith("'use strict';"), `${f} precisa começar com 'use strict';`);
  }
});

test('config.js vem antes dos scripts do app', () => {
  assert.ok(html.indexOf('src="config.js"') < html.indexOf('src="js/'), 'config.js precisa carregar primeiro');
});

test('cena 3D: mapa de importação aponta para o servidor e o módulo vem depois dos scripts', async () => {
  assert.match(html, /"three": "\/vendor\/three\/build\/three\.module\.js"/);
  assert.ok(html.indexOf('type="importmap"') < html.indexOf('type="module"'), 'o mapa de importação precisa vir antes do módulo');
  assert.ok(html.lastIndexOf('src="js/') < html.indexOf('js3d/cena3d.js'), 'o 3D lê os dados dos scripts anteriores');
  const src = await fs.readFile(path.join(WEB, 'js3d', 'cena3d.js'), 'utf8');
  for (const name of ['worldBoxes', 'segBoxes', 'peopleDrawables', 'characterKit', 'bounds', 'openFicha']) assert.ok(src.includes(name), `o 3D usa ${name}`);
});

test('personagens low-poly (reserva) cobrem todos os penteados e roupas do editor', async () => {
  const kit = await fs.readFile(path.join(WEB, 'js3d', 'personagens3d-lowpoly.js'), 'utf8');
  const cat = await fs.readFile(path.join(WEB, 'js', '01-catalogo.js'), 'utf8');
  const list = (name) => [...cat.slice(cat.indexOf(`const ${name} = [`), cat.indexOf('];', cat.indexOf(`const ${name} = [`))).matchAll(/\['([a-z]+)'/g)].map(m => m[1]);
  for (const hs of list('HAIRSTYLES')) assert.ok(hs === 'curto' || kit.includes(`case '${hs}'`), `penteado ${hs} sem modelo 3D`);
  for (const top of list('TOPS')) assert.ok(top === 'camiseta' || kit.includes(`'${top}'`), `roupa ${top} sem modelo 3D`);
  for (const ex of list('EXTRAS')) assert.ok(kit.includes(`ex.${ex}`), `acessório ${ex} sem modelo 3D`);
});

test('estilo padrão (Meshy): todo penteado tem modelo e todo modelo existe em web/modelos', async () => {
  const kit = await fs.readFile(path.join(WEB, 'js3d', 'personagens3d-meshy.js'), 'utf8');
  const cat = await fs.readFile(path.join(WEB, 'js', '01-catalogo.js'), 'utf8');
  const hs = [...cat.slice(cat.indexOf('const HAIRSTYLES = ['), cat.indexOf('];', cat.indexOf('const HAIRSTYLES = ['))).matchAll(/\['([a-z]+)'/g)].map(m => m[1]);
  const map = kit.slice(kit.indexOf('const POR_PENTEADO'), kit.indexOf('};', kit.indexOf('const POR_PENTEADO')));
  for (const h of hs) assert.ok(new RegExp(`\\b${h}: '`).test(map), `penteado ${h} sem modelo no estilo Meshy`);
  for (const [, f] of kit.matchAll(/file: '([^']+\.glb)'/g)) await fs.access(path.join(WEB, 'modelos', f));
  for (const ex of ['oculos', 'fone', 'cracha', 'barba']) assert.ok(kit.includes(`${ex}: !!ex.${ex}`), `acessório ${ex} não lido no estilo Meshy`);
});
