// Ponte Claude Code: eventos do hook viram estados na sala; o instalador não estraga o settings.json do usuário.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { toolAction, redact, createClaudeBridge, HOOK_EVENTS } from '../server/claude-code.mjs';
import { install, uninstall, status, isOurs, BACKUP_SUFFIX } from '../server/claude-hooks-install.mjs';
import { msg, STATES } from '../server/protocol.mjs';
import { PLACES } from '../server/places.mjs';

test('cada ferramenta leva ao lugar certo da sala', () => {
  assert.deepEqual(toolAction('Edit', { file_path: '/x/src/login.ts' }), { state: 'trabalhando', place: 'computador', detail: 'Editando login.ts' });
  assert.equal(toolAction('Read', { file_path: 'C:\\p\\README.md' }).detail, 'Lendo README.md');
  assert.equal(toolAction('Grep', { pattern: 'foo' }).place, 'leitura');
  assert.equal(toolAction('WebFetch', { url: 'https://docs.anthropic.com/x' }).detail, 'Lendo docs.anthropic.com');
  assert.equal(toolAction('Bash', { command: 'npm test' }).state, 'revisando');
  assert.deepEqual([toolAction('Bash', { command: 'git push origin main' }).state, toolAction('Bash', { command: 'git push' }).place], ['entregando', 'servidores']);
  assert.equal(toolAction('Bash', { command: 'ls -la' }).state, 'trabalhando');
  assert.equal(toolAction('Task', { description: 'Achar o bug' }).detail, 'Delegando: Achar o bug');
  assert.equal(toolAction('TodoWrite', {}).place, 'quadro');
  assert.equal(toolAction('mcp__github__create_pr', {}).detail, 'Usando github · create_pr');
  // tudo que sai daqui é aceito pelo protocolo
  for (const t of ['Edit', 'Read', 'Grep', 'WebSearch', 'Bash', 'Task', 'TodoWrite', 'mcp__a__b', 'Qualquer']) {
    const a = toolAction(t, { command: 'x' });
    assert.ok(STATES.includes(a.state) && PLACES[a.place], t);
  }
});

test('segredos em comandos não chegam à tela', () => {
  for (const c of ['export API_KEY=sk-abc123', 'curl -H "Authorization: Bearer abc.def"', 'TOKEN=xyz node x', 'echo ghp_0123456789abcdefghijABCDEFGHIJ']) {
    const out = toolAction('Bash', { command: c }).detail;
    assert.ok(!/sk-abc123|abc\.def|xyz|ghp_0123/.test(out), out);
  }
  assert.equal(redact('ls -la src'), 'ls -la src');
});

test('a sessão vira um personagem com o nome da pasta, e o ciclo da sessão vira estados', () => {
  const said = [], logs = [], teams = [];
  const b = createClaudeBridge({ say: (m, hold) => said.push({ ...m, hold }), log: (a, t) => logs.push([a, t]), team: () => teams.push(1) });
  const ev = (k, extra = {}) => b.handle({ session_id: 's1', hook_event_name: k, cwd: '/home/ana/loja-web', ...extra });
  assert.equal(ev('SessionStart').state, 'aguardando');
  assert.deepEqual(b.members(), [{ name: 'loja-web', role: 'claude_code', roleName: 'Claude Code', kind: 'produz', source: 'claude-code' }]);
  assert.equal(teams.length, 1);
  assert.equal(ev('UserPromptSubmit', { prompt: 'segredo do usuário' }).state, 'planejando');
  assert.ok(!JSON.stringify(said).includes('segredo'), 'o texto do pedido não é repassado');
  assert.equal(ev('PreToolUse', { tool_name: 'Edit', tool_input: { file_path: 'a/b.js' } }).detail, 'Editando b.js');
  assert.equal(ev('PermissionRequest', { tool_name: 'Bash' }).state, 'bloqueado');
  assert.equal(ev('Notification', { message: 'Claude needs your permission to use Bash' }).state, 'bloqueado');
  assert.equal(ev('Notification', { message: 'Claude is waiting for your input' }).state, 'aguardando');
  ev('PostToolUseFailure', { tool_name: 'Bash' }); assert.equal(logs.at(-1)[1], 'Falhou: Bash');
  assert.equal(ev('Stop').state, 'concluido'); assert.equal(said.at(-1).hold, 4500);
  // segunda sessão na mesma pasta: outro nome
  b.handle({ session_id: 's2', hook_event_name: 'SessionStart', cwd: '/home/ana/loja-web' });
  assert.deepEqual(b.members().map(m => m.name), ['loja-web', 'loja-web 2']);
  assert.equal(ev('SessionEnd').state, 'offline');
  assert.deepEqual(b.members().map(m => m.name), ['loja-web 2']);
  // tudo vira mensagem válida do protocolo, e a origem vai junto na equipe
  for (const m of said) { const { hold, ...rest } = m; assert.doesNotThrow(() => msg.state(rest)); }
  assert.equal(msg.team(b.members()).agents[0].source, 'claude-code');
});

test('eventos estranhos são ignorados', () => {
  const b = createClaudeBridge({ say: () => assert.fail('não devia falar'), log: () => {}, team: () => {} });
  for (const e of [null, 'x', {}, { session_id: 's' }, { hook_event_name: 'Stop' }, { session_id: 's', hook_event_name: 'Inventado' }]) assert.equal(b.handle(e), null);
});

const tmp = () => fs.mkdtemp(path.join(os.tmpdir(), 'pixelhq-hooks-'));
const SCRIPT = 'C:\\Users\\ana\\pixel-hq\\scripts\\claude-hook.mjs';

test('instalar mantém os hooks e as configurações do usuário, faz cópia e não duplica', async () => {
  const dir = await tmp(), file = path.join(dir, 'settings.json');
  const original = { model: 'opus', permissions: { allow: ['Bash(ls:*)'] }, hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'meu-guard.sh' }] }], Custom: [] } };
  await fs.writeFile(file, JSON.stringify(original));
  const r = await install({ file, script: SCRIPT });
  assert.equal(r.events, HOOK_EVENTS.length);
  assert.deepEqual(JSON.parse(await fs.readFile(file + BACKUP_SUFFIX, 'utf8')), original);
  await install({ file, script: SCRIPT }); // de novo: não duplica
  const s = JSON.parse(await fs.readFile(file, 'utf8'));
  assert.equal(s.model, 'opus'); assert.deepEqual(s.permissions, original.permissions); assert.deepEqual(s.hooks.Custom, []);
  assert.equal(s.hooks.PreToolUse[0].hooks[0].command, 'meu-guard.sh');
  for (const ev of HOOK_EVENTS) assert.equal(s.hooks[ev].flatMap(g => g.hooks).filter(isOurs).length, 1, ev);
  const ours = s.hooks.PreToolUse.find(g => g.hooks.some(isOurs));
  assert.equal(ours.matcher, '*');
  assert.ok(!ours.hooks[0].command.includes('\\'));
  assert.equal((await status({ file })).installed, true);
  // desinstalar: volta ao que era (a cópia não é sobrescrita)
  await fs.writeFile(file + BACKUP_SUFFIX, 'cópia antiga');
  const u = await uninstall({ file });
  assert.equal(u.removed, HOOK_EVENTS.length);
  assert.deepEqual(JSON.parse(await fs.readFile(file, 'utf8')), original);
  assert.equal(await fs.readFile(file + BACKUP_SUFFIX, 'utf8'), 'cópia antiga');
  assert.equal((await status({ file })).installed, false);
});

test('arquivo inválido ou com formato estranho: aborta sem tocar em nada', async () => {
  const dir = await tmp(), file = path.join(dir, 'settings.json');
  for (const bad of ['{ isso não é json', '[]', '{"hooks": []}', '{"hooks": {"Stop": {}}}']) {
    await fs.writeFile(file, bad);
    await assert.rejects(install({ file, script: SCRIPT }), /Nada foi alterado/);
    assert.equal(await fs.readFile(file, 'utf8'), bad);
  }
  await assert.rejects(fs.access(file + BACKUP_SUFFIX));
});

test('sem settings.json: cria um só com os hooks', async () => {
  const dir = await tmp(), file = path.join(dir, 'novo', 'settings.json');
  await install({ file, script: SCRIPT });
  assert.deepEqual(Object.keys(JSON.parse(await fs.readFile(file, 'utf8'))), ['hooks']);
  await uninstall({ file });
  assert.deepEqual(JSON.parse(await fs.readFile(file, 'utf8')), {});
});

test('de ponta a ponta: o script do hook chega ao servidor e vira estado na sala; sem a senha, é recusado', async () => {
  const { spawn } = await import('node:child_process');
  const { WebSocket } = await import('ws');
  const home = await tmp(), port = 20000 + Math.floor(Math.random() * 20000), url = `http://127.0.0.1:${port}`;
  const env = { ...process.env, PORT: String(port), PIXELHQ_DATA_DIR: home, PIXELHQ_HOME: home, WORKSPACE_DIR: home, MIN_DWELL_MS: '50' };
  const srv = spawn(process.execPath, ['server/server.mjs'], { env, stdio: 'pipe' });
  try {
    for (let i = 0; i < 50; i++) { try { await fetch(url + '/health'); break; } catch { await new Promise(r => setTimeout(r, 100)); } }
    const { token } = JSON.parse(await fs.readFile(path.join(home, 'hook.json'), 'utf8'));
    assert.match(token, /^[a-f0-9]{48}$/);
    const ws = new WebSocket(url.replace('http', 'ws') + '/events', { origin: url });
    const got = [];
    ws.on('message', (d) => got.push(JSON.parse(d)));
    await new Promise(r => ws.on('open', r));
    const hook = (ev) => new Promise((res) => {
      const p = spawn(process.execPath, ['scripts/claude-hook.mjs', '--pixel-hq'], { env, stdio: ['pipe', 'pipe', 'pipe'] });
      let out = ''; p.stdout.on('data', d => out += d);
      p.on('exit', (code) => res({ code, out }));
      p.stdin.end(JSON.stringify(ev));
    });
    const r = await hook({ session_id: 'e2e', hook_event_name: 'PreToolUse', cwd: '/tmp/meu-app', tool_name: 'Edit', tool_input: { file_path: '/tmp/meu-app/x.js' } });
    assert.deepEqual(r, { code: 0, out: '' }, 'o hook não escreve nada e sai com 0');
    for (let i = 0; i < 30 && !got.some(m => m.type === 'state' && m.agent === 'meu-app'); i++) await new Promise(r => setTimeout(r, 100));
    assert.ok(got.some(m => m.type === 'team' && m.agents.some(a => a.name === 'meu-app' && a.source === 'claude-code')));
    const st = got.find(m => m.type === 'state' && m.agent === 'meu-app');
    assert.equal(st.state, 'trabalhando'); assert.equal(st.place, 'computador'); assert.equal(st.detail, 'Editando x.js');
    // sem a senha (ex.: outro site no navegador): recusado
    const bad = await fetch(url + '/api/hooks/claude', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    assert.equal(bad.status, 403);
    ws.close();
    // servidor desligado: o hook sai rápido e calado, sem atrapalhar o Claude Code
    srv.kill(); await new Promise(r => setTimeout(r, 300));
    const t0 = Date.now(), off = await hook({ session_id: 'e2e', hook_event_name: 'Stop' });
    assert.deepEqual(off, { code: 0, out: '' }); assert.ok(Date.now() - t0 < 2500);
  } finally { srv.kill(); }
});
