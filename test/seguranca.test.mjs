// Camada A de docs/REGRAS.md (segurança e privacidade), contra um servidor de verdade.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';

let srv, port, url, out = '', token;

before(async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'floorwalk-seg-'));
  port = 20000 + Math.floor(Math.random() * 20000); url = `http://127.0.0.1:${port}`;
  const env = { ...process.env, PORT: String(port), FLOORWALK_HOME: dir };
  delete env.HOST;
  srv = spawn(process.execPath, ['server/server.mjs'], { env, stdio: 'pipe' });
  srv.stdout.on('data', d => (out += d)); srv.stderr.on('data', d => (out += d));
  for (let i = 0; i < 50; i++) { try { await fetch(url + '/health'); break; } catch { await new Promise(r => setTimeout(r, 100)); } }
  ({ token } = JSON.parse(await fs.readFile(path.join(dir, 'hook.json'), 'utf8')));
});
after(() => { srv.kill(); });

// pedido com Host e Origin à escolha (o fetch não deixa trocar o Host)
function raw(method, pathname, { host, origin, body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({ host: '127.0.0.1', port, method, path: pathname, headers: {
      host: host || `127.0.0.1:${port}`, ...(origin ? { origin } : {}), ...(data ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) } : {}), ...headers,
    } }, (res) => { let t = ''; res.on('data', c => (t += c)); res.on('end', () => resolve({ status: res.statusCode, body: t })); });
    req.on('error', reject); if (data) req.write(data); req.end();
  });
}
const alive = async () => (await fetch(url + '/health')).ok;

test('A3: site que se passa pelo endereço do Floorwalk (DNS rebinding) é recusado em qualquer rota', async () => {
  const evil = `evil.test:${port}`;
  assert.equal((await raw('GET', '/', { host: evil })).status, 403, 'página');
  assert.equal((await raw('GET', '/api/hooks/status', { host: evil })).status, 403, 'leitura');
  const ev = { session_id: 's', hook_event_name: 'SessionStart', cwd: '/x/evil' };
  assert.equal((await raw('POST', '/api/hooks/claude', { host: evil, body: ev, headers: { 'x-floorwalk-token': token } })).status, 403, 'evento, mesmo com a senha');
});

test('A3: evento de sessão só entra com a senha do hook', async () => {
  const ev = { session_id: 's', hook_event_name: 'SessionStart', cwd: '/x/app' };
  assert.equal((await raw('POST', '/api/hooks/claude', { body: ev })).status, 403, 'sem senha');
  assert.equal((await raw('POST', '/api/hooks/claude', { body: ev, headers: { 'x-floorwalk-token': 'a'.repeat(48) } })).status, 403, 'senha errada');
  assert.equal((await raw('POST', '/api/hooks/claude', { body: ev, headers: { 'x-floorwalk-token': token } })).status, 204);
});

test('A4: o WebSocket só aceita a própria página', async () => {
  const tryWS = (headers) => new Promise((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/events`, { headers });
    ws.on('open', () => { ws.close(); resolve('open'); }); ws.on('error', () => resolve('recusado')); ws.on('unexpected-response', () => resolve('recusado'));
  });
  assert.equal(await tryWS({ origin: url }), 'open');
  assert.equal(await tryWS({ origin: 'https://malicioso.com' }), 'recusado');
  assert.equal(await tryWS({}), 'recusado', 'sem Origin');
  assert.equal(await tryWS({ origin: `http://evil.test:${port}`, host: `evil.test:${port}` }), 'recusado', 'rebinding');
});

test('A5: sem HOST, o servidor escuta só no próprio computador', async () => {
  assert.match(out, /em http:\/\/127\.0\.0\.1:/);
});

test('A7: arquivos fora de web/ não saem, e endereço malformado não derruba o servidor', async () => {
  for (const p of ['/..%2f..%2fpackage.json', '/..%5c..%5cpackage.json', '/%2e%2e/%2e%2e/package.json', '/vendor/three/..%2f..%2f..%2fpackage.json']) {
    const r = await raw('GET', p);
    assert.ok([400, 403, 404].includes(r.status), `${p} → ${r.status}`);
    assert.ok(!r.body.includes('"dependencies"'), `${p} vazou o package.json`);
  }
  const bad = await raw('GET', '/%E0%A4%A');
  assert.equal(bad.status, 400);
  assert.ok(await alive(), 'o servidor caiu com um endereço malformado');
});

test('a equipe de IA saiu do main: as rotas dela não existem mais', async () => {
  for (const p of ['/api/settings', '/api/office']) assert.equal((await raw('GET', p)).status, 404, p);
});
