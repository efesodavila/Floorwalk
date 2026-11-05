// Camada E de docs/REGRAS.md (equipe de IA): limites que só aparecem com o servidor de verdade rodando.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const OFFICE = {
  name: 'Teste', service: 'x', delivery: 'servidor', labels: {}, tasks: [], research: [], createdAt: '2026-11-05T10:00:00.000Z',
  roles: [{ id: 'c', name: 'Coordenação', kind: 'coordena' }, { id: 'p', name: 'Produção', kind: 'produz' }],
  team: [{ name: 'Ana', role: 'c', bio: '' }, { name: 'Bia', role: 'p', bio: '' }, { name: 'Caio', role: 'p', bio: '' }],
  custom: [{ id: 'c_maca', name: 'Maca', w: 1, d: 2, act: 'x_atender', place: 'p_maca', purpose: 'atender', boxes: [[0, 0, 1, 2, 0, .7, '#FFFFFF', 0]] }], // bloco: [x, z, largura, profundidade, y, altura, cor, brilho]
};
async function server(args, files, extraEnv = {}) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'floorwalk-equipe-'));
  for (const [f, v] of Object.entries(files)) await fs.writeFile(path.join(dir, f), JSON.stringify(v));
  const port = 20000 + Math.floor(Math.random() * 20000), url = `http://127.0.0.1:${port}`;
  const env = { ...process.env, PORT: String(port), FLOORWALK_DATA_DIR: dir, FLOORWALK_HOME: dir, WORKSPACE_DIR: dir, MIN_DWELL_MS: '200', ...extraEnv };
  delete env.HOST; delete env.OPENAI_API_KEY; delete env.ANTHROPIC_API_KEY;
  const srv = spawn(process.execPath, ['server/server.mjs', ...args], { env, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) { try { await fetch(url + '/health'); break; } catch { await sleep(100); } }
  return { url, srv };
}

test('E5: até 2 tarefas ao mesmo tempo e fila de até 5; a próxima é recusada com aviso', async () => {
  const { url, srv } = await server(['--demo'], { 'office.json': OFFICE });
  try {
    const ws = new WebSocket(url.replace('http', 'ws') + '/events', { origin: url }), got = [];
    ws.on('message', d => { const m = JSON.parse(d); if (m.type === 'task') got.push(m); });
    await new Promise(r => ws.on('open', r));
    for (let i = 1; i <= 8; i++) ws.send(JSON.stringify({ type: 'task', id: 't' + i, text: 'Tarefa ' + i }));
    await sleep(800);
    const by = (s) => got.filter(m => m.status === s).map(m => m.id);
    assert.deepEqual(by('em_andamento'), ['t1', 't2'], 'só 2 ao mesmo tempo');
    assert.deepEqual(by('erro'), ['t8'], 'a oitava (2 rodando + 5 na fila) é recusada');
    assert.match(got.find(m => m.id === 't8').error, /Fila cheia/);
    ws.close();
  } finally { srv.kill(); }
});

test('E9: dois pedidos de crítica ao mesmo tempo (duas abas) não pagam a crítica duas vezes', async () => {
  let calls = 0;
  const ai = http.createServer(async (req, res) => {
    for await (const _ of req);
    calls++; await sleep(400);
    res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ message: { role: 'assistant', content: '{"nota":9,"problemas":[]}' } }));
  });
  await new Promise(r => ai.listen(0, '127.0.0.1', r));
  const settings = { provider: 'ollama', model: 'm', keys: {}, baseUrls: { ollama: `http://127.0.0.1:${ai.address().port}` } };
  const { url, srv } = await server([], { 'office.json': OFFICE, 'settings.json': settings }, { FLOORWALK_CRITIC_MODEL: 'm' });
  try {
    const ask = () => fetch(url + '/api/office/critique', { method: 'POST', headers: { 'content-type': 'application/json', origin: url },
      body: JSON.stringify({ id: 'c_maca', image: 'data:image/png;base64,iVBORw0KGgo=' }) }).then(r => r.json());
    const [a, b] = await Promise.all([ask(), ask()]);
    assert.ok(a.ok !== undefined && b.ok !== undefined, 'as duas abas recebem resposta');
    assert.equal(calls, 1, `a crítica foi chamada ${calls} vezes`);
    // depois de revisado, abrir de novo não chama a IA
    await ask(); assert.equal(calls, 1);
  } finally { srv.kill(); ai.close(); }
});
