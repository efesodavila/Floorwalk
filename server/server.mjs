// Servidor do Pixel HQ
// - serve a página do escritório em http://HOST:PORT/
// - WebSocket em /events: recebe tarefas da página e transmite o que os agentes fazem
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { PROVIDERS, explainError } from './providers.mjs';
import * as settings from './settings.mjs';
import * as office from './office.mjs';
import * as llm from './llm.mjs';
import { msg, parseClientMessage } from './protocol.mjs';
import { createPacer } from './pacer.mjs';
import { runTask, teamOf } from './runner.mjs';

const WORKSPACE = path.resolve(process.env.WORKSPACE_DIR || './workspace');

const DEMO = process.argv.includes('--demo');
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '127.0.0.1';
const MIN_DWELL = Number(process.env.MIN_DWELL_MS || 3500);
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));


/* ---------- transmissão ---------- */
const clients = new Set();
const lastState = new Map(); // agente -> último estado (para quem conecta depois)
let current = null;          // tarefa em andamento
const queue = [];

function broadcast(m) {
  if (m.type === 'state') lastState.set(m.agent, m);
  const data = JSON.stringify(m);
  for (const ws of clients) if (ws.readyState === 1) ws.send(data);
}
const pacer = createPacer(broadcast, MIN_DWELL);
const log = (agent, text) => broadcast(msg.log(agent, text, current?.id));
const say = (member, state, task, extra = {}, hold) =>
  pacer.push(msg.state({ agent: member.name, state, task, run: current?.id, ...extra }), hold);

const clip = (s, n = 50) => { s = String(s ?? '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

/* ---------- equipe atual: a do escritório montado pela IA, ou a equipe padrão ---------- */
async function currentTeam() {
  const spec = await office.load();
  return spec ? teamOf(spec) : [];
}
const leadOf = (T) => T.find(m => m.kind === 'coordena') || T[0];

/* ---------- fila de tarefas (uma por vez) ---------- */
async function processQueue() {
  if (current || !queue.length) return;
  current = queue.shift(); current.abort = new AbortController();
  broadcast(msg.task(current.id, 'em_andamento', { text: current.text }));
  const T = await currentTeam(), lead = leadOf(T) || { name: '?' };
  try {
    if (!T.length) throw new Error('Monte o escritório antes de delegar tarefas.');
    const r = DEMO ? { output: await demoRun(current.text), folder: null } : await realRun(current);
    await pacer.drain();
    say(lead, 'concluido', clip(current.text), { detail: 'Tarefa entregue' }, 4500);
    await pacer.drain();
    broadcast(msg.task(current.id, 'concluida', { text: current.text, output: r.output.slice(0, 6000), ...(r.folder ? { folder: path.relative(process.cwd(), r.folder).startsWith('..') ? r.folder : path.relative(process.cwd(), r.folder) } : {}) }));
  } catch (e) {
    const cancelled = e?.code === 'cancelled' || current.abort.signal.aborted;
    const why = cancelled ? 'Tarefa cancelada.' : e?.code === 'no_model' ? e.message : (e?.provider ? explainError(e.provider, e) : e?.message || String(e));
    if (!cancelled) console.error('[tarefa]', e);
    await pacer.drain();
    say(lead, cancelled ? 'ocioso' : 'bloqueado', clip(current.text), { detail: clip(why, 140) });
    // modelo sem acesso (404): guarda o aviso e a página oferece trocar a IA
    const modelProblem = !cancelled && (e?.code === 'no_model' || e?.status === 401);
    if (modelProblem) await settings.markModelBroken(why).catch(() => {});
    broadcast(msg.task(current.id, cancelled ? 'cancelada' : 'erro', { text: current.text, error: clip(why, 300), ...(modelProblem ? { fix: 'ai' } : {}) }));
  } finally {
    current = null;
    processQueue();
  }
}

/* ---------- execução real: a equipe do escritório, com o provedor configurado ---------- */
async function realRun(task) {
  const cfg = await settings.active();
  if (!cfg) throw new Error('Conecte uma IA antes de delegar tarefas (menu no canto superior direito).');
  const spec = await office.load();
  const chat = async (o) => {
    try { return await llm.chat(o, (from, to) => log('Sistema', `O modelo ${from} foi recusado pela ${PROVIDERS[cfg.provider].name}; a equipe passou a usar ${to}.`)); }
    catch (e) { if (o.signal?.aborted) throw Object.assign(new Error('Tarefa cancelada.'), { code: 'cancelled' }); throw e; }
  };
  return runTask({
    text: task.text, spec, chat, signal: task.abort.signal, outDir: path.join(WORKSPACE, 'entregas'),
    say, log: (agent, text) => log(agent, text),
    result: (item) => broadcast(msg.result(task.id, item)),
  });
}

/* ---------- modo demo: o mesmo fluxo de eventos, sem chamar nenhuma IA ---------- */
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function demoRun(text) {
  const T = await currentTeam(), by = (k) => T.filter(m => m.kind === k);
  const lead = leadOf(T), maker = by('produz')[0] || lead, rev = by('revisa')[0], res = by('pesquisa')[0], del = by('entrega')[0];
  const L = clip(text);
  const brief = async (m) => {
    if (m === lead) return;
    say(lead, 'reuniao', `Briefing com ${m.name}`, { with: [m.name] }, 3000);
    say(m, 'reuniao', `Briefing com ${lead.name}`, { with: [lead.name] }, 3000);
    say(lead, 'aguardando', `Esperando ${m.name}`); await sleep(1200);
  };
  say(lead, 'planejando', L, { detail: 'Dividindo a tarefa (demo)' }); await sleep(1500);
  if (res && res !== lead) { await brief(res); say(res, 'pesquisando', L, { detail: 'Buscando referências (demo)' }); await sleep(3000); say(res, 'concluido', L, { detail: 'Referências reunidas (demo)' }, 4500); await sleep(800); }
  await brief(maker); say(maker, 'trabalhando', L, { detail: 'Produzindo a primeira versão (demo)' }); await sleep(4000); say(maker, 'concluido', L, { detail: 'Primeira versão pronta (demo)' }, 4500); await sleep(800);
  if (rev) { await brief(rev); say(rev, 'revisando', L, { with: [maker.name], detail: 'Conferindo (demo)' }); await sleep(3000); say(rev, 'concluido', L, { detail: 'APROVADO (demo)' }, 4500); await sleep(800); }
  if (del) { await brief(del); say(del, 'entregando', L, { detail: 'Entregando (demo)' }); await sleep(3000); say(del, 'concluido', L, { detail: 'Entregue (demo)' }, 4500); }
  const who = [res, maker, rev, del].filter(Boolean).map(m => m.name);
  return `Modo demo: nenhum agente real rodou. Fluxo simulado para "${text}" com ${[...new Set(who)].join(', ')}.`;
}

/* ---------- HTTP + WebSocket ---------- */
const WEB = path.join(ROOT, 'web');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/health') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: true, demo: DEMO, tarefa: current?.text ?? null, fila: queue.length })); return; }
  // diz à página que ela está rodando com o servidor (liga o modo tempo real)
  if (url.pathname === '/config.js') { res.writeHead(200, { 'content-type': TYPES['.js'], 'cache-control': 'no-store' }); res.end(`window.PIXELHQ_BRIDGE = true;\n`); return; }
  if (url.pathname.startsWith('/api/')) { await api(req, res, url); return; }
  if (req.method !== 'GET') { res.writeHead(405); res.end(); return; }
  // Three.js (cena 3D) servido do node_modules: só os módulos de build/ e examples/jsm/
  if (url.pathname.startsWith('/vendor/three/')) {
    const rel = decodeURIComponent(url.pathname.slice('/vendor/three/'.length));
    const base = path.join(ROOT, 'node_modules', 'three'), file = path.resolve(base, rel);
    if (!/^(build|examples\/jsm)\//.test(rel) || !file.startsWith(base + path.sep) || !file.endsWith('.js')) { res.writeHead(404); res.end(); return; }
    try { const data = await fs.readFile(file); res.writeHead(200, { 'content-type': TYPES['.js'], 'cache-control': 'max-age=86400' }); res.end(data); }
    catch { res.writeHead(404); res.end(); }
    return;
  }
  // arquivos estáticos de web/, sem sair da pasta
  const rel = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
  const file = path.resolve(WEB, '.' + rel);
  if (!file.startsWith(WEB + path.sep)) { res.writeHead(403); res.end(); return; }
  try {
    const data = await fs.readFile(file);
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' }); res.end(data);
  } catch { res.writeHead(404); res.end('Não encontrado'); }
});

/* ---------- API de configuração ---------- */
let planning = false;
const json = (res, code, body) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(body)); };
// só a própria página pode chamar: outro site aberto no navegador não consegue ler nem trocar a chave
const sameOrigin = (req) => { try { return new URL(req.headers.origin).host === req.headers.host; } catch { return false; } };
async function readJSON(req) {
  if (!String(req.headers['content-type'] || '').startsWith('application/json')) throw Object.assign(new Error('Envie JSON'), { code: 415 });
  let size = 0; const chunks = [];
  for await (const c of req) { size += c.length; if (size > 16384) throw Object.assign(new Error('Pedido grande demais'), { code: 413 }); chunks.push(c); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}
function checkInput(b) {
  const P = PROVIDERS[b.provider];
  if (!P) throw Object.assign(new Error('Provedor desconhecido'), { code: 400 });
  if (b.apiKey != null && (typeof b.apiKey !== 'string' || b.apiKey.length > 500)) throw Object.assign(new Error('Chave inválida'), { code: 400 });
  if (b.baseUrl) { let u; try { u = new URL(b.baseUrl); } catch {} if (!u || !/^https?:$/.test(u.protocol)) throw Object.assign(new Error('O endereço precisa começar com http:// ou https://'), { code: 400 }); }
  return P;
}
async function api(req, res, url) {
  try {
    if (req.method !== 'GET' && !sameOrigin(req)) return json(res, 403, { error: 'Origem não permitida' });
    if (url.pathname === '/api/settings' && req.method === 'GET') return json(res, 200, { ...settings.publicView(await settings.load()), demo: DEMO });
    if (url.pathname === '/api/settings/test' && req.method === 'POST') {
      const b = await readJSON(req), P = checkInput(b), s = await settings.load();
      const cfg = { apiKey: b.apiKey?.trim() || settings.keyFor(s, b.provider), baseUrl: b.baseUrl?.trim() || s.baseUrls[b.provider] };
      if (P.needsKey && !cfg.apiKey) return json(res, 200, { ok: false, error: 'Cole a chave de API para testar.' });
      const t0 = Date.now();
      try { const { models, recommended } = await P.test(cfg); return json(res, 200, { ok: true, models, recommended, ms: Date.now() - t0 }); }
      catch (e) { return json(res, 200, { ok: false, error: explainError(b.provider, e) }); }
    }
    if (url.pathname === '/api/settings' && req.method === 'POST') {
      // conectar: confere a chave, escolhe sozinho um modelo que responde e salva
      const b = await readJSON(req), P = checkInput(b), s = await settings.load();
      const cfg = { apiKey: b.apiKey?.trim() || settings.keyFor(s, b.provider), baseUrl: b.baseUrl?.trim() || s.baseUrls[b.provider] };
      if (P.needsKey && !cfg.apiKey) return json(res, 200, { ok: false, error: 'Cole a chave de API.' });
      let model;
      try { ({ model } = await llm.pickModel(b.provider, cfg)); }
      catch (e) { console.error('[conectar]', b.provider, e?.status, e?.message); return json(res, 200, { ok: false, error: e.code === 'no_model' ? e.message : explainError(b.provider, e) }); }
      await settings.save({ provider: b.provider, model, apiKey: b.apiKey?.trim() || undefined, baseUrl: b.baseUrl === undefined ? undefined : b.baseUrl.trim() });
      return json(res, 200, { ok: true, model, settings: settings.publicView(await settings.load()) });
    }
    if (url.pathname === '/api/office' && req.method === 'GET') return json(res, 200, { office: await office.load() });
    if (url.pathname === '/api/office/plan' && req.method === 'POST') {
      const b = await readJSON(req), desc = String(b.description || '').trim();
      if (desc.length < 15) return json(res, 400, { error: 'Descreva o serviço com pelo menos uma frase.' });
      const cfg = await settings.active();
      if (!cfg) return json(res, 400, { error: 'Conecte uma IA primeiro.' });
      if (planning) return json(res, 409, { error: 'Já estou montando um escritório. Aguarde.' });
      planning = true;
      try {
        const spec = await office.planOffice((o) => llm.chat(o), desc, (t) => console.log('[móvel]', t));
        await office.save({ ...spec, description: desc.slice(0, 1500) });
        const saved = await office.load();
        broadcast(msg.team(await currentTeam()));
        return json(res, 200, { ok: true, office: saved });
      } catch (e) {
        if (e.code !== 'invalid_spec') console.error('[montar escritório]', cfg.provider, cfg.model, e?.status, e?.message);
        return json(res, 200, { ok: false, error: e.code === 'invalid_spec' || e.code === 'no_model' ? e.message : explainError(cfg.provider, e) });
      } finally { planning = false; }
    }
    json(res, 404, { error: 'Rota não encontrada' });
  } catch (e) {
    json(res, typeof e.code === 'number' ? e.code : 400, { error: e.message || 'Pedido inválido' });
  }
}

const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });
server.on('upgrade', (req, sock, head) => {
  // só aceita a própria página: impede que outro site use a sua chave via localhost
  let ok = false; try { ok = new URL(req.headers.origin).host === req.headers.host; } catch {}
  if (!req.url.startsWith('/events') || !ok) { sock.write('HTTP/1.1 403 Forbidden\r\n\r\n'); sock.destroy(); return; }
  wss.handleUpgrade(req, sock, head, (ws) => wss.emit('connection', ws));
});
wss.on('connection', (ws) => {
  clients.add(ws);
  ws.send(JSON.stringify(msg.hello(DEMO)));
  currentTeam().then(T => T.length && ws.readyState === 1 && ws.send(JSON.stringify(msg.team(T))));
  if (current) ws.send(JSON.stringify(msg.task(current.id, 'em_andamento', { text: current.text })));
  for (const m of lastState.values()) ws.send(JSON.stringify(m));
  ws.on('message', (raw) => {
    const t = parseClientMessage(raw); if (!t) return;
    if (t.cancel) {
      if (current?.id === t.cancel) current.abort.abort();
      const i = queue.findIndex(q => q.id === t.cancel);
      if (i >= 0) { const [q] = queue.splice(i, 1); broadcast(msg.task(q.id, 'cancelada', { text: q.text })); }
      return;
    }
    if (queue.length >= 5) { ws.send(JSON.stringify(msg.task(t.id, 'erro', { text: t.text, error: 'Fila cheia. Espere as tarefas atuais terminarem.' }))); return; }
    queue.push(t);
    broadcast(msg.task(t.id, 'na_fila', { text: t.text }));
    processQueue();
  });
  ws.on('close', () => clients.delete(ws));
});

await fs.mkdir(path.join(WORKSPACE, 'projeto'), { recursive: true });
server.listen(PORT, HOST, () => {
  console.log(`Pixel HQ ${DEMO ? '(demo: tarefas simuladas)' : ''} em http://${HOST}:${PORT}`);
  settings.active().then(c => console.log(c ? `IA: ${PROVIDERS[c.provider].name} · ${c.model}` : 'IA ainda não configurada: abra a página para escolher.'));
  console.log(`Arquivos dos agentes: ${path.join(WORKSPACE, 'projeto')}`);
});
