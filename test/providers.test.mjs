// Testa os três provedores contra um servidor falso local: as requisições reais dos SDKs,
// a autenticação e as mensagens de erro. Também testa a API de configuração do Pixel HQ.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { PROVIDERS, explainError, recommendModel } from '../server/providers.mjs';

const GOOD = 'chave-boa-1234';
let mock, base, seen = [];
before(async () => {
  mock = http.createServer((req, res) => {
    seen.push({ url: req.url, auth: req.headers.authorization, xkey: req.headers['x-api-key'], ver: req.headers['anthropic-version'] });
    const send = (code, body) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
    if (req.url.startsWith('/openai/v1/models')) {
      if (req.headers.authorization !== `Bearer ${GOOD}`) return send(401, { error: { message: 'Incorrect API key' } });
      return send(200, { object: 'list', data: ['gpt-9', 'text-embedding-3-small', 'gpt-9-mini', 'whisper-1', 'o9'].map(id => ({ id, object: 'model', created: 1, owned_by: 'x' })) });
    }
    if (req.url.startsWith('/anthropic/v1/models')) {
      if (req.headers['x-api-key'] !== GOOD) return send(401, { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } });
      return send(200, { data: ['claude-x-1', 'claude-sonnet-9-9'].map(id => ({ id, type: 'model', display_name: id, created_at: '2026-01-01T00:00:00Z' })), has_more: false, first_id: 'claude-x-1', last_id: 'claude-sonnet-9-9' });
    }
    if (req.url.startsWith('/anthropic/v1/messages')) {
      let body = ''; req.on('data', c => (body += c)); return req.on('end', () => {
        const j = JSON.parse(body);
        if (j.model === 'claude-sonnet-9-9') return send(404, { type: 'error', error: { type: 'not_found_error', message: 'model: claude-sonnet-9-9' } });
        send(200, { id: 'm', type: 'message', role: 'assistant', model: j.model, content: [{ type: 'text', text: 'ok' }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } });
      });
    }
    if (req.url === '/ollama/api/tags') return send(200, { models: [{ name: 'llama3.2:latest', model: 'llama3.2:latest' }] });
    if (req.url === '/ollama-vazio/api/tags') return send(200, { models: [] });
    send(404, {});
  });
  await new Promise(r => mock.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${mock.address().port}`;
});
after(() => mock.close());

test('OpenAI: lista só modelos de conversa e manda a chave no Authorization', async () => {
  const { models } = await PROVIDERS.openai.test({ apiKey: GOOD, baseUrl: base + '/openai/v1' });
  assert.deepEqual(models.sort(), ['gpt-9', 'gpt-9-mini', 'o9']);
  assert.equal(seen.at(-1).auth, `Bearer ${GOOD}`);
});

test('OpenAI: chave errada vira mensagem clara', async () => {
  await assert.rejects(PROVIDERS.openai.test({ apiKey: 'errada', baseUrl: base + '/openai/v1' }), (e) => {
    assert.match(explainError('openai', e), /recusou a chave/); return true;
  });
});

test('Anthropic: lista modelos com x-api-key e anthropic-version', async () => {
  const { models } = await PROVIDERS.anthropic.test({ apiKey: GOOD, baseUrl: base + '/anthropic' });
  assert.deepEqual(models, ['claude-x-1', 'claude-sonnet-9-9']);
  assert.equal(seen.at(-1).xkey, GOOD);
  assert.ok(seen.at(-1).ver, 'deveria mandar anthropic-version');
});

test('Ollama: lista modelos locais; avisa quando não há modelos ou não está aberto', async () => {
  assert.deepEqual((await PROVIDERS.ollama.test({ baseUrl: base + '/ollama' })).models, ['llama3.2:latest']);
  await assert.rejects(PROVIDERS.ollama.test({ baseUrl: base + '/ollama-vazio' }), /ollama pull/);
  await assert.rejects(PROVIDERS.ollama.test({ baseUrl: 'http://127.0.0.1:9' }), (e) => { assert.match(explainError('ollama', e), /Ollama/); return true; });
});

/* ---------- API do Pixel HQ ---------- */
let srv, url, dataDir;
const call = (p, opts = {}) => fetch(url + p, { ...opts, headers: { origin: url, 'content-type': 'application/json', ...(opts.headers || {}) } }).then(async r => ({ status: r.status, body: await r.json() }));
before(async () => {
  dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pixelhq-data-'));
  const port = 20000 + Math.floor(Math.random() * 20000);
  srv = spawn(process.execPath, ['server/server.mjs'], { env: { ...process.env, PORT: String(port), PIXELHQ_DATA_DIR: dataDir, PIXELHQ_HOME: dataDir, OPENAI_API_KEY: '', ANTHROPIC_API_KEY: '', WORKSPACE_DIR: dataDir }, stdio: 'pipe' });
  url = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 50; i++) { try { await fetch(url + '/health'); break; } catch { await new Promise(r => setTimeout(r, 100)); } }
});
after(() => srv.kill());

test('API: começa sem configuração', async () => {
  const r = await call('/api/settings');
  assert.equal(r.body.configured, false);
  assert.deepEqual(r.body.providers.map(p => p.id), ['openai', 'anthropic', 'ollama']);
});

test('API: recusa pedidos de outro site', async () => {
  const r = await call('/api/settings/test', { method: 'POST', body: JSON.stringify({ provider: 'ollama' }), headers: { origin: 'https://malicioso.com' } });
  assert.equal(r.status, 403);
});

test('API: conectar escolhe sozinho um modelo que responde, salva e nunca devolve a chave', async () => {
  const bad = await call('/api/settings', { method: 'POST', body: JSON.stringify({ provider: 'anthropic', apiKey: 'errada', baseUrl: base + '/anthropic' }) });
  assert.equal(bad.body.ok, false); assert.match(bad.body.error, /recusou a chave/);
  // o preferido (sonnet) está na lista mas não responde: fica o próximo
  const ok = await call('/api/settings', { method: 'POST', body: JSON.stringify({ provider: 'anthropic', apiKey: GOOD, baseUrl: base + '/anthropic' }) });
  assert.equal(ok.body.ok, true); assert.equal(ok.body.model, 'claude-x-1');
  const view = await call('/api/settings');
  assert.equal(view.body.configured, true); assert.equal(view.body.model, 'claude-x-1');
  assert.ok(!JSON.stringify(view.body).includes(GOOD), 'a chave vazou para a página');
  assert.equal(view.body.providers.find(p => p.id === 'anthropic').key.hint, '…1234');
  const st = await fs.stat(path.join(dataDir, 'settings.json'));
  assert.equal(st.mode & 0o077, 0, 'settings.json não deveria ser legível por outros usuários');
});

test('API: endereço inválido é recusado', async () => {
  const r = await call('/api/settings/test', { method: 'POST', body: JSON.stringify({ provider: 'ollama', baseUrl: 'file:///etc/passwd' }) });
  assert.equal(r.status, 400);
});

test('modelo recomendado: conversa comum, mini, sem data, sem pro/preview', () => {
  const openai = ['o3-pro', 'o4-mini', 'gpt-4o', 'gpt-4o-2024-08-06', 'gpt-5-mini', 'gpt-5', 'gpt-5-pro', 'gpt-5-mini-2025-08-07', 'gpt-4.1-mini', 'chatgpt-4o-latest', 'gpt-5-nano'];
  assert.equal(recommendModel('openai', openai), 'gpt-5-mini');
  assert.equal(recommendModel('anthropic', ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-sonnet-4-5-20250929']), 'claude-sonnet-5-5');
  assert.equal(recommendModel('openai', []), null);
});

test('erro 404 mostra a mensagem do provedor e esconde a chave', () => {
  const msg = explainError('openai', { status: 404, error: { message: 'The model `o3-pro` does not exist or you do not have access to it. key sk-proj-abcdefghijk' } });
  assert.match(msg, /o3-pro/); assert.ok(!msg.includes('abcdefghijk'));
});

test('erro da Anthropic: mostra só a mensagem, não o JSON cru', () => {
  const a = explainError('anthropic', { status: 404, error: { type: 'error', error: { type: 'not_found_error', message: 'model: claude-x' } } });
  assert.match(a, /“model: claude-x”/);
  const b = explainError('anthropic', { status: 404, message: '404 {"type":"error","error":{"type":"not_found_error","message":"model: claude-y"}}' });
  assert.match(b, /“model: claude-y”/);
});

test('servidor entrega o Three.js do node_modules só de build/ e examples/jsm/', async () => {
  const ok = await fetch(url + '/vendor/three/build/three.module.js'); assert.equal(ok.status, 200); assert.match(ok.headers.get('content-type'), /javascript/);
  assert.equal((await fetch(url + '/vendor/three/examples/jsm/postprocessing/EffectComposer.js')).status, 200);
  assert.equal((await fetch(url + '/vendor/three/package.json')).status, 404);
  assert.equal((await fetch(url + '/vendor/three/build/..%2F..%2F..%2Fpackage.json')).status, 404);
});
