// Camada A de docs/REGRAS.md (segurança e privacidade), contra um servidor de verdade com uma chave falsa.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';

const SECRET = 'sk-teste-segredo-' + Date.now();
let srv, port, url, receiver, recBase, got = [], out = '';

before(async () => {
  // "atacante": anota qualquer chave que chegar
  receiver = http.createServer((req, res) => {
    got.push(req.headers.authorization || req.headers['x-api-key'] || '');
    res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"data":[]}');
  });
  await new Promise(r => receiver.listen(0, '127.0.0.1', r));
  recBase = `http://127.0.0.1:${receiver.address().port}/v1`;
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'floorwalk-seg-'));
  port = 20000 + Math.floor(Math.random() * 20000); url = `http://127.0.0.1:${port}`;
  const env = { ...process.env, PORT: String(port), FLOORWALK_DATA_DIR: dir, FLOORWALK_HOME: dir, WORKSPACE_DIR: dir, OPENAI_API_KEY: SECRET, ANTHROPIC_API_KEY: '' };
  delete env.HOST;
  srv = spawn(process.execPath, ['server/server.mjs'], { env, stdio: 'pipe' });
  srv.stdout.on('data', d => (out += d)); srv.stderr.on('data', d => (out += d));
  for (let i = 0; i < 50; i++) { try { await fetch(url + '/health'); break; } catch { await new Promise(r => setTimeout(r, 100)); } }
});
after(() => { srv.kill(); receiver.close(); });

// pedido com Host e Origin à escolha (o fetch não deixa trocar o Host)
function raw(method, pathname, { host, origin, body } = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({ host: '127.0.0.1', port, method, path: pathname, headers: {
      host: host || `127.0.0.1:${port}`, ...(origin ? { origin } : {}), ...(data ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) } : {}),
    } }, (res) => { let t = ''; res.on('data', c => (t += c)); res.on('end', () => resolve({ status: res.statusCode, body: t })); });
    req.on('error', reject); if (data) req.write(data); req.end();
  });
}
const alive = async () => (await fetch(url + '/health')).ok;

test('A3: site que se passa pelo endereço do Floorwalk (DNS rebinding) é recusado e a chave não sai', async () => {
  const evil = `evil.test:${port}`;
  got = [];
  const r = await raw('POST', '/api/settings/test', { host: evil, origin: `http://${evil}`, body: { provider: 'openai', baseUrl: recBase } });
  assert.equal(r.status, 403, 'pedido com Host de outro site deveria ser recusado');
  assert.ok(!got.some(h => h.includes(SECRET)), 'a chave foi enviada ao atacante');
  assert.equal((await raw('GET', '/api/settings', { host: evil })).status, 403, 'nem leitura com Host de outro site');
});

test('A1: a chave guardada só vai para o endereço do provedor, nunca para um endereço novo que a página mandar', async () => {
  got = [];
  await raw('POST', '/api/settings/test', { origin: url, body: { provider: 'openai', baseUrl: recBase } });
  assert.ok(!got.some(h => h.includes(SECRET)), 'a chave guardada foi enviada para um endereço novo');
  // com a chave digitada junto, o endereço novo pode ser testado (a pessoa está entregando aquela chave para ele)
  got = [];
  await raw('POST', '/api/settings/test', { origin: url, body: { provider: 'openai', baseUrl: recBase, apiKey: 'sk-outra-chave' } });
  assert.ok(got.some(h => h.includes('sk-outra-chave')));
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
