// Primeira instalação: o que dá errado com quem instala pela primeira vez tem de dar errado de um jeito que se entenda.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { HOOK_EVENTS, TOOL_EVENTS } from '../server/claude-code.mjs';
import { install, status } from '../server/claude-hooks-install.mjs';

const tmp = () => fs.mkdtemp(path.join(os.tmpdir(), 'floorwalk-inst-'));
const run = (args, env) => new Promise((res) => {
  const p = spawn(process.execPath, args, { env: { ...process.env, ...env }, stdio: 'pipe' });
  let out = ''; p.stdout.on('data', d => (out += d)); p.stderr.on('data', d => (out += d));
  const t = setTimeout(() => p.kill(), 8000);
  p.on('exit', (code) => { clearTimeout(t); res({ code, out }); });
});

test('porta ocupada: frase clara, sai com erro e não mexe no hook.json do servidor que já roda', async () => {
  const home = await tmp(), file = path.join(home, 'hook.json');
  const busy = net.createServer().listen(0, '127.0.0.1'); await new Promise(r => busy.on('listening', r));
  const port = busy.address().port;
  const before = JSON.stringify({ port: 1234, token: 'b'.repeat(48) });
  await fs.writeFile(file, before);
  try {
    const r = await run(['server/server.mjs'], { PORT: String(port), FLOORWALK_HOME: home });
    assert.equal(r.code, 1);
    assert.match(r.out, new RegExp(`Port ${port} is already in use`));
    assert.match(r.out, /PORT=\d+ npm start/);
    assert.doesNotMatch(r.out, /EADDRINUSE|at Server/, 'sem o erro cru do Node');
    assert.equal(await fs.readFile(file, 'utf8'), before, 'o hook.json continua apontando para o servidor que já roda');
  } finally { busy.close(); }
});

test('npm start (server/start.mjs) sobe sem o aviso ".env not found"', async () => {
  const home = await tmp(), port = 20000 + Math.floor(Math.random() * 20000);
  const p = spawn(process.execPath, ['server/start.mjs'], { env: { ...process.env, PORT: String(port), FLOORWALK_HOME: home }, stdio: 'pipe' });
  let out = ''; p.stdout.on('data', d => (out += d)); p.stderr.on('data', d => (out += d));
  try {
    for (let i = 0; i < 50 && !/running at/.test(out); i++) await new Promise(r => setTimeout(r, 100));
    assert.match(out, /Floorwalk running at http:\/\/127\.0\.0\.1:/);
    assert.doesNotMatch(out, /\.env not found/);
  } finally { p.kill(); }
});

test('status: hook instalado à mão apontando para pasta que sumiu aparece como quebrado', async () => {
  const dir = await tmp(), file = path.join(dir, 'settings.json');
  await install({ file, script: path.join(dir, 'sumiu', 'claude-hook.mjs') });
  const s = await status({ file });
  assert.equal(s.installed, true); assert.equal(s.broken, true);
  const real = path.join(dir, 'claude-hook.mjs'); await fs.writeFile(real, '');
  await install({ file, script: real });
  assert.equal((await status({ file })).broken, false);
});

test('plugin ligado: conta como instalado e a instalação à mão recusa (senão cada evento chegaria duas vezes)', async () => {
  const dir = await tmp(), file = path.join(dir, 'settings.json');
  const original = JSON.stringify({ enabledPlugins: { 'floorwalk@floorwalk': true } });
  await fs.writeFile(file, original);
  const s = await status({ file });
  assert.equal(s.installed, true); assert.equal(s.plugin, true); assert.equal(s.broken, false);
  await assert.rejects(install({ file, script: '/x/claude-hook.mjs' }), /plugin is already on.*Nothing was changed/);
  assert.equal(await fs.readFile(file, 'utf8'), original);
  await fs.writeFile(file, JSON.stringify({ enabledPlugins: { 'floorwalk@floorwalk': false } }));
  assert.equal((await status({ file })).installed, false, 'plugin desligado não conta');
});

test('plugin: hooks.json cobre os mesmos eventos da instalação à mão e usa o script do próprio plugin', async () => {
  const { hooks } = JSON.parse(await fs.readFile('plugin/hooks/hooks.json', 'utf8'));
  assert.deepEqual(Object.keys(hooks), HOOK_EVENTS);
  for (const ev of HOOK_EVENTS) {
    const [g] = hooks[ev];
    assert.equal(g.matcher, TOOL_EVENTS.has(ev) ? '*' : undefined, ev);
    assert.equal(g.hooks[0].command, 'node "${CLAUDE_PLUGIN_ROOT}/scripts/claude-hook.mjs" --floorwalk');
  }
  const pkg = JSON.parse(await fs.readFile('package.json', 'utf8'));
  assert.equal(JSON.parse(await fs.readFile('plugin/.claude-plugin/plugin.json', 'utf8')).version, pkg.version, 'versão do plugin acompanha a do projeto');
  const mk = JSON.parse(await fs.readFile('.claude-plugin/marketplace.json', 'utf8'));
  assert.deepEqual(mk.plugins.map(p => [p.name, p.source]), [['floorwalk', './plugin']]);
  // o plugin é copiado sem node_modules: o hook só pode importar o que vem com o Node
  const src = await fs.readFile('plugin/scripts/claude-hook.mjs', 'utf8');
  for (const [, m] of src.matchAll(/from '([^']+)'/g)) assert.match(m, /^node:/, m);
  await assert.rejects(fs.access('plugin/package.json'), 'sem package.json no plugin: o Claude Code não instala dependências');
});

test('caminho antigo do hook (instalações da v0.1.0) continua funcionando', async () => {
  const r = await run(['scripts/claude-hook.mjs', '--floorwalk'], { FLOORWALK_HOME: await tmp() });
  assert.deepEqual(r, { code: 0, out: '' });
});
