// Troca automática de modelo: o modelo salvo passa a ser recusado e o servidor escolhe outro sozinho.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';

const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pixelhq-llm-'));
process.env.PIXELHQ_DATA_DIR = dir;
const llm = await import('../server/llm.mjs');
const settings = await import('../server/settings.mjs');

const OK = new Set(['gpt-9-mini']);   // só este responde
let mock, base, chats = [];
before(async () => {
  mock = http.createServer(async (req, res) => {
    let body = ''; for await (const c of req) body += c;
    const send = (c, b) => { res.writeHead(c, { 'content-type': 'application/json' }); res.end(JSON.stringify(b)); };
    if (req.url.startsWith('/v1/models')) return send(200, { object: 'list', data: ['o4-mini-2025-04-16', 'gpt-9-mini', 'gpt-9', 'gpt-9-pro'].map(id => ({ id, object: 'model', created: 1, owned_by: 'x' })) });
    const auth = req.headers.authorization;
    // chave restrita: lista modelos, mas não pode usar a API Responses (só Chat Completions)
    if (auth === 'Bearer sk-restrita' && req.url.startsWith('/v1/responses')) return send(401, { error: { message: 'You have insufficient permissions for this operation. Missing scopes: api.responses.write. Check that you have the correct role in your organization (Reader, Writer, Owner) and project (Member, Owner), and if you\'re using a restricted API key, that it has the necessary scopes.', type: 'invalid_request_error' } });
    // chave só de leitura: não gera texto em lugar nenhum
    if (auth === 'Bearer sk-leitura' && !req.url.startsWith('/v1/models')) return send(401, { error: { message: 'You have insufficient permissions for this operation. Missing scopes: model.request.', type: 'invalid_request_error' } });
    if (req.url.startsWith('/v1/chat/completions')) {
      const j = JSON.parse(body); chats.push('chat:' + j.model);
      return send(200, { id: 'c', object: 'chat.completion', created: 1, model: j.model, choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: 'resposta via chat de ' + j.model } }] });
    }
    if (req.url.startsWith('/v1/responses')) {
      const j = JSON.parse(body); chats.push(j.model);
      if (!OK.has(j.model)) return send(404, { error: { message: `The model \`${j.model}\` does not exist or you do not have access to it.`, type: 'invalid_request_error', code: 'model_not_found' } });
      return send(200, { id: 'r', object: 'response', created_at: 1, status: 'completed', model: j.model, output: [{ type: 'message', id: 'm', status: 'completed', role: 'assistant', content: [{ type: 'output_text', text: 'resposta de ' + j.model, annotations: [] }] }] });
    }
    send(404, {});
  });
  await new Promise(r => mock.listen(0, '127.0.0.1', r)); base = `http://127.0.0.1:${mock.address().port}/v1`;
});
after(() => mock.close());

test('erros de modelo x erros de conta', () => {
  assert.equal(llm.isModelError({ status: 404 }), true);
  assert.equal(llm.isModelError({ status: 401 }), false);
  assert.equal(llm.isModelError({ status: 429 }), false);
  assert.equal(llm.isModelError({ status: 400, message: 'The model x is not supported with this API' }), true);
});

test('modelo salvo recusado: escolhe outro, salva e a chamada funciona', async () => {
  // situação real: configuração antiga com o4-mini, que a conta não acessa
  await settings.save({ provider: 'openai', model: 'o4-mini-2025-04-16', apiKey: 'sk-teste', baseUrl: base });
  chats = []; let switched = null;
  const out = await llm.chat({ messages: [{ role: 'user', content: 'oi' }] }, (a, b) => (switched = [a, b]));
  assert.equal(out, 'resposta de gpt-9-mini');
  assert.deepEqual(switched, ['o4-mini-2025-04-16', 'gpt-9-mini']);
  assert.equal((await settings.active()).model, 'gpt-9-mini');
  // próxima chamada já vai direto no modelo bom
  chats = []; await llm.chat({ messages: [{ role: 'user', content: 'oi' }] });
  assert.deepEqual(chats, ['gpt-9-mini']);
});

test('chave sem permissão para Responses: passa sozinho para Chat Completions', async () => {
  const { model } = await llm.pickModel('openai', { apiKey: 'sk-restrita', baseUrl: base });
  assert.equal(model, 'gpt-9-mini');
  const { PROVIDERS } = await import('../server/providers.mjs');
  chats = [];
  const out = await PROVIDERS.openai.chat({ apiKey: 'sk-restrita', baseUrl: base, model: 'gpt-9-mini', messages: [{ role: 'user', content: 'oi' }] });
  assert.equal(out, 'resposta via chat de gpt-9-mini');
  assert.deepEqual(chats, ['chat:gpt-9-mini'], 'depois da primeira vez, vai direto para Chat Completions');
});

test('chave só de leitura: mensagem de permissão, sem testar vários modelos', async () => {
  const { explainError } = await import('../server/providers.mjs');
  chats = [];
  await assert.rejects(llm.pickModel('openai', { apiKey: 'sk-leitura', baseUrl: base }), (e) => {
    assert.equal(llm.isModelError(e), false);
    const m = explainError('openai', e);
    assert.match(m, /não tem permissão para gerar textos/); assert.match(m, /model\.request/);
    return true;
  });
});

test('nenhum modelo responde: erro claro com o que foi testado', async () => {
  OK.clear();
  await assert.rejects(llm.pickModel('openai', { apiKey: 'sk-teste', baseUrl: base }), (e) => { assert.equal(e.code, 'no_model'); assert.match(e.message, /gpt-9-mini/); return true; });
});

test('crítica visual: na OpenAI usa sempre o gpt-6.1-sol; outros provedores seguem o modelo da conta', () => {
  const old = process.env.PIXELHQ_CRITIC_MODEL; delete process.env.PIXELHQ_CRITIC_MODEL;
  try {
    assert.equal(llm.criticModel('openai'), 'gpt-6.1-sol');
    assert.equal(llm.criticModel('anthropic'), null);
    process.env.PIXELHQ_CRITIC_MODEL = 'outro';
    assert.equal(llm.criticModel('openai'), 'outro');
  } finally { if (old === undefined) delete process.env.PIXELHQ_CRITIC_MODEL; else process.env.PIXELHQ_CRITIC_MODEL = old; }
});
