// Camada B de docs/REGRAS.md (ponte com o Claude Code): casos achados na revisão.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';
import { toolAction, createClaudeBridge } from '../server/claude-code.mjs';
import { install, uninstall } from '../server/claude-hooks-install.mjs';

const tmp = () => fs.mkdtemp(path.join(os.tmpdir(), 'floorwalk-ponte-'));
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

test('B7: senha, token e usuário:senha somem do comando, em qualquer forma comum', () => {
  const cases = [
    ['mysql -u root --password hunter2x db', 'hunter2x'],
    ['curl -u admin:hunter2x https://api.x', 'hunter2x'],
    ['psql postgres://app:Hunter2x@db.local/loja', 'Hunter2x'],
    ['PASSWORD="minha senha secreta" node x', 'secreta'],
    ['gh api --token abc123xyz /user', 'abc123xyz'],
    ['curl -H "Cookie: sess=abc123xyz" https://x', 'abc123xyz'],
    ['npx wrangler secret put --api-key=abc123xyz', 'abc123xyz'],
  ];
  for (const [cmd, secret] of cases) {
    const out = toolAction('Bash', { command: cmd }).detail;
    assert.ok(!out.includes(secret), `${cmd} → ${out}`);
  }
});

test('B8: só o comando que roda conta (nome de arquivo ou mensagem de commit não engana)', () => {
  const st = (c) => toolAction('Bash', { command: c }).state;
  assert.equal(st('cat deploy.md'), 'trabalhando');
  assert.equal(st('code vercel.json'), 'trabalhando');
  assert.equal(st('git commit -m "corrige o test de login"'), 'trabalhando');
  assert.equal(st('grep -r "git push" docs'), 'trabalhando');
  assert.equal(st('cd app && npm test'), 'revisando');
  assert.equal(st('pnpm lint'), 'revisando');
  assert.equal(st('node --test'), 'revisando');
  assert.equal(st('npm run test:unit'), 'revisando');
  assert.equal(st('npx vercel --prod'), 'entregando');
  assert.equal(st('npm run deploy'), 'entregando');
  assert.equal(st('git add . && git commit -m x && git push'), 'entregando');
  assert.equal(st('NODE_ENV=production npm publish'), 'entregando');
});

test('B10: a página fica sabendo da sessão (equipe) antes do primeiro estado dela', () => {
  const order = [];
  const b = createClaudeBridge({ say: () => order.push('state'), log: () => {}, team: () => order.push('team') });
  b.handle({ session_id: 'n', hook_event_name: 'PreToolUse', cwd: '/p/app', tool_name: 'Read', tool_input: {} });
  assert.deepEqual(order, ['team', 'state']);
});

test('B6: o hook não repassa o texto do pedido nem o conteúdo de arquivos ao servidor', async () => {
  const home = await tmp(); let body = '';
  const rec = http.createServer((req, res) => { req.on('data', c => (body += c)); req.on('end', () => { res.writeHead(204); res.end(); }); });
  await new Promise(r => rec.listen(0, '127.0.0.1', r));
  await fs.writeFile(path.join(home, 'hook.json'), JSON.stringify({ port: rec.address().port, token: 'a'.repeat(48) }));
  const env = { ...process.env, FLOORWALK_HOME: home };
  const run = (ev) => new Promise((res) => {
    const p = spawn(process.execPath, ['plugin/scripts/claude-hook.mjs', '--floorwalk'], { env, stdio: ['pipe', 'ignore', 'ignore'] });
    p.on('exit', res); p.stdin.end(JSON.stringify(ev));
  });
  try {
    await run({ session_id: 's', hook_event_name: 'UserPromptSubmit', cwd: '/p/app', prompt: 'PEDIDO-SECRETO' });
    assert.ok(body.includes('UserPromptSubmit'), 'o evento chegou');
    assert.ok(!body.includes('PEDIDO-SECRETO'), 'o texto do pedido saiu do Claude Code');
    body = '';
    await run({ session_id: 's', hook_event_name: 'PreToolUse', cwd: '/p/app', tool_name: 'Write', tool_input: { file_path: '/p/app/a.js', content: 'CONTEUDO-DO-ARQUIVO'.repeat(10) } });
    const got = JSON.parse(body);
    assert.equal(got.tool_input.file_path, '/p/app/a.js');
    assert.ok(!body.includes('CONTEUDO-DO-ARQUIVO'), 'o conteúdo do arquivo foi junto');
  } finally { rec.close(); }
});

test('B4: settings.json que é um atalho (dotfiles) continua atalho depois de instalar e desinstalar', async (t) => {
  const dir = await tmp(), real = path.join(dir, 'dotfiles-settings.json'), link = path.join(dir, 'settings.json');
  await fs.writeFile(real, JSON.stringify({ model: 'opus' }));
  try { await fs.symlink(real, link); } catch { t.skip('sem permissão para criar atalho neste sistema'); return; }
  await install({ file: link, script: '/x/scripts/claude-hook.mjs' });
  assert.ok((await fs.lstat(link)).isSymbolicLink(), 'o atalho virou arquivo comum');
  assert.ok(JSON.parse(await fs.readFile(real, 'utf8')).hooks, 'os hooks foram para o arquivo de verdade');
  await uninstall({ file: link });
  assert.ok((await fs.lstat(link)).isSymbolicLink());
  assert.deepEqual(JSON.parse(await fs.readFile(real, 'utf8')), { model: 'opus' });
});

test('B12: quem conecta depois recebe o histórico só para a ficha; sessão encerrada não volta, e sessão nova não herda a antiga', async () => {
  const home = await tmp(), port = 20000 + Math.floor(Math.random() * 20000), url = `http://127.0.0.1:${port}`;
  const env = { ...process.env, PORT: String(port), FLOORWALK_DATA_DIR: home, FLOORWALK_HOME: home, WORKSPACE_DIR: home, MIN_DWELL_MS: '20' };
  delete env.HOST;
  const srv = spawn(process.execPath, ['server/server.mjs'], { env, stdio: 'ignore' });
  try {
    for (let i = 0; i < 50; i++) { try { await fetch(url + '/health'); break; } catch { await sleep(100); } }
    const { token } = JSON.parse(await fs.readFile(path.join(home, 'hook.json'), 'utf8'));
    const hook = (ev) => fetch(url + '/api/hooks/claude', { method: 'POST', headers: { 'content-type': 'application/json', 'x-floorwalk-token': token }, body: JSON.stringify(ev) });
    const connect = async () => {
      const got = [], ws = new WebSocket(url.replace('http', 'ws') + '/events', { origin: url });
      ws.on('message', d => got.push(JSON.parse(d))); await new Promise(r => ws.on('open', r)); await sleep(300); ws.close(); return got;
    };
    const ev = (id, k, extra = {}) => hook({ session_id: id, hook_event_name: k, cwd: '/p/loja', ...extra });
    await ev('a', 'SessionStart');
    await ev('a', 'PreToolUse', { tool_name: 'Read', tool_input: { file_path: '/p/loja/a.js' } });
    await ev('a', 'PreToolUse', { tool_name: 'Edit', tool_input: { file_path: '/p/loja/b.js' } });
    await sleep(300);
    let got = await connect();
    const mine = got.filter(m => m.type === 'state' && m.agent === 'loja');
    assert.ok(mine.length >= 3, 'recebeu o histórico');
    assert.ok(mine.slice(0, -1).every(m => m.replay === true), 'histórico só para a ficha');
    assert.equal(mine.at(-1).replay, undefined, 'o último é o estado atual');
    assert.equal(mine.at(-1).detail, 'Editando b.js');
    // sessão encerrada: quem conecta depois não recebe nada dela (nem "agente desconhecido")
    await ev('a', 'SessionEnd'); await sleep(300);
    got = await connect();
    assert.ok(!got.some(m => m.type === 'state' && m.agent === 'loja'), 'sessão encerrada voltou ao reconectar');
    // sessão nova na mesma pasta: mesmo nome, ficha vazia
    await ev('b', 'SessionStart'); await sleep(300);
    got = await connect();
    const b = got.filter(m => m.type === 'state' && m.agent === 'loja');
    assert.ok(!b.some(m => /Editando|Lendo/.test(m.detail || '')), 'sessão nova herdou o histórico da antiga');
  } finally { srv.kill(); }
});
