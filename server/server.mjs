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
import { critiqueFurniture, scoreFurniture } from './furniture.mjs';
import { msg, parseClientMessage } from './protocol.mjs';
import { createPacer } from './pacer.mjs';
import { runTask, teamOf } from './runner.mjs';
import * as webAccess from './web.mjs';
import { createLocks } from './locks.mjs';
import { createClaudeBridge } from './claude-code.mjs';
import { status as hooksStatus } from './claude-hooks-install.mjs';
import crypto from 'node:crypto';
import os from 'node:os';

const WORKSPACE = path.resolve(process.env.WORKSPACE_DIR || './workspace');

const DEMO = process.argv.includes('--demo');
const STARTED_AT = Date.now(); // hora em que o servidor subiu (para /api/stale)
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '127.0.0.1';
const MIN_DWELL = Number(process.env.MIN_DWELL_MS || 3500);
// quantas tarefas rodam ao mesmo tempo (cada agente continua fazendo uma coisa por vez)
const MAX_PARALLEL = Math.max(1, Math.min(4, Number(process.env.PIXELHQ_PARALELO || 2)));
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));


/* ---------- transmissão ---------- */
const clients = new Set();
const lastState = new Map(); // agente -> último estado (para quem conecta depois)
const running = new Map();   // tarefas em andamento: id → tarefa
const locks = createLocks();   // agente ocupado em outra tarefa: espera
const queue = [];

const history = new Map();   // agente -> últimos estados com a hora (a ficha mostra o histórico a quem conecta depois)
function broadcast(m) {
  if (m.type === 'state') {
    lastState.set(m.agent, m);
    const h = history.get(m.agent) || []; h.push({ ...m, at: Date.now() }); if (h.length > 40) h.shift(); history.set(m.agent, h);
  }
  const data = JSON.stringify(m);
  for (const ws of clients) if (ws.readyState === 1) ws.send(data);
}
const pacer = createPacer(broadcast, MIN_DWELL);
// eventos de uma tarefa (o id da tarefa vai em cada evento: a página sabe de qual tarefa é)
const logFor = (t) => (agent, text) => broadcast(msg.log(agent, text, t.id));
// sessões do Claude Code (hooks): cada uma vira um personagem; ver server/claude-code.mjs
const claude = createClaudeBridge({
  say: (m, hold) => pacer.push(msg.state(m), hold),
  log: (agent, text) => broadcast(msg.log(agent, text)),
  team: () => broadcast(claudeTeam()), // na hora: o primeiro estado da sessão vem logo atrás
});
// sessão sem nenhum evento há 1 h (terminal fechado à força, sem SessionEnd): sai da sala
setInterval(() => claude.sweep(60 * 60 * 1000), 60 * 1000).unref();
// lista completa das sessões abertas (source no topo: a página tira da sala quem não está mais nela)
function claudeTeam() { return { ...msg.team(claude.members()), source: 'claude-code' }; }
// senha dos hooks: o script do hook lê de ~/.pixel-hq/hook.json (só o usuário lê) e manda no cabeçalho
const HOOK_FILE = path.join(process.env.PIXELHQ_HOME || path.join(os.homedir(), '.pixel-hq'), 'hook.json');
let HOOK_TOKEN = '';
async function writeHookFile() {
  try { HOOK_TOKEN = JSON.parse(await fs.readFile(HOOK_FILE, 'utf8')).token || ''; } catch {}
  if (!/^[a-f0-9]{48}$/.test(HOOK_TOKEN)) HOOK_TOKEN = crypto.randomBytes(24).toString('hex');
  await fs.mkdir(path.dirname(HOOK_FILE), { recursive: true });
  await fs.writeFile(HOOK_FILE, JSON.stringify({ port: PORT, token: HOOK_TOKEN }), { mode: 0o600 });
}
const hookAuth = (req) => {
  const got = Buffer.from(String(req.headers['x-pixelhq-token'] || '')), want = Buffer.from(HOOK_TOKEN);
  return HOOK_TOKEN && got.length === want.length && crypto.timingSafeEqual(got, want);
};
const sayFor = (t) => (member, state, task, extra = {}, hold) =>
  pacer.push(msg.state({ agent: member.name, state, task, run: t.id, ...extra }), hold);

const clip = (s, n = 50) => { s = String(s ?? '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

/* ---------- equipe atual: a do escritório montado pela IA, ou a equipe padrão ---------- */
async function currentTeam() {
  const spec = await office.load();
  return spec ? teamOf(spec) : [];
}
const leadOf = (T) => T.find(m => m.kind === 'coordena') || T[0];

/* ---------- fila de tarefas (até MAX_PARALLEL ao mesmo tempo) ---------- */
function processQueue() {
  while (running.size < MAX_PARALLEL && queue.length) runOne(queue.shift());
}
async function runOne(task) {
  running.set(task.id, task); task.abort = new AbortController();
  const say = sayFor(task);
  broadcast(msg.task(task.id, 'em_andamento', { text: task.text }));
  const T = await currentTeam(), lead = leadOf(T) || { name: '?' };
  try {
    if (!T.length) throw new Error('Monte o escritório antes de delegar tarefas.');
    const r = DEMO ? { output: await demoRun(task), folder: null } : await realRun(task);
    await pacer.drain();
    say(lead, 'concluido', clip(task.text), { detail: 'Tarefa entregue' }, 4500);
    await pacer.drain();
    broadcast(msg.task(task.id, 'concluida', { text: task.text, output: r.output.slice(0, 6000), ...(r.folder ? { folder: path.relative(process.cwd(), r.folder).startsWith('..') ? r.folder : path.relative(process.cwd(), r.folder) } : {}) }));
  } catch (e) {
    const cancelled = e?.code === 'cancelled' || task.abort.signal.aborted;
    const why = cancelled ? 'Tarefa cancelada.' : e?.code === 'no_model' ? e.message : (e?.provider ? explainError(e.provider, e) : e?.message || String(e));
    if (!cancelled) console.error('[tarefa]', e);
    await pacer.drain();
    say(lead, cancelled ? 'ocioso' : 'bloqueado', clip(task.text), { detail: clip(why, 140) });
    // modelo sem acesso (404): guarda o aviso e a página oferece trocar a IA
    const modelProblem = !cancelled && (e?.code === 'no_model' || e?.status === 401);
    if (modelProblem) await settings.markModelBroken(why).catch(() => {});
    broadcast(msg.task(task.id, cancelled ? 'cancelada' : 'erro', { text: task.text, error: clip(why, 300), ...(modelProblem ? { fix: 'ai' } : {}) }));
  } finally {
    running.delete(task.id);
    processQueue();
  }
}

// internet ligada? (menu da página; PIXELHQ_WEB=0 desliga no servidor)
const webOn = async () => process.env.PIXELHQ_WEB !== '0' && (await settings.load()).web !== false;

/* ---------- execução real: a equipe do escritório, com o provedor configurado ---------- */
async function realRun(task) {
  const cfg = await settings.active();
  if (!cfg) throw new Error('Conecte uma IA antes de delegar tarefas (menu no canto superior direito).');
  // a sala real (o que a página mandou com a tarefa) vale mais que o escritório montado: móvel posto à mão no editor
  // entra na lista de lugares que a IA vê
  const spec0 = await office.load(), spec = task.room?.length ? { ...spec0, room: task.room } : spec0;
  const log = logFor(task);
  const chat = async (o) => {
    try { return await llm.chat(o, (from, to) => log('Sistema', `O modelo ${from} foi recusado pela ${PROVIDERS[cfg.provider].name}; a equipe passou a usar ${to}.`)); }
    catch (e) { if (o.signal?.aborted) throw Object.assign(new Error('Tarefa cancelada.'), { code: 'cancelled' }); throw e; }
  };
  return runTask({
    text: task.text, spec, chat, signal: task.abort.signal, outDir: path.join(WORKSPACE, 'entregas'),
    say: sayFor(task), log, lock: locks.lock, web: (await webOn()) ? webAccess : null,
    result: (item) => broadcast(msg.result(task.id, item)),
  });
}

/* ---------- modo demo: o mesmo fluxo de eventos, sem chamar nenhuma IA ---------- */
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function demoRun(task) {
  const text = task.text, say = sayFor(task);
  const T = await currentTeam(), by = (k) => T.filter(m => m.kind === k);
  // demo: a equipe inteira fica com uma tarefa por vez (sem IA não há como dividir o trabalho)
  const release = await locks.lock(T.map(m => m.name).sort());
  try { return await demoSteps(T, by, text, say); } finally { release(); }
}
async function demoSteps(T, by, text, say) {
  const lead = leadOf(T), maker = by('produz')[0] || by('opera')[0] || by('atende')[0] || lead, rev = by('revisa')[0], res = by('pesquisa')[0], del = by('entrega')[0] || by('atende')[0];
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
  // código do servidor mudou depois que ele subiu? (a página avisa: "reinicie o servidor")
  if (url.pathname === '/api/stale') {
    let stale = false;
    try { for (const f of await fs.readdir(path.join(ROOT, 'server'))) if (f.endsWith('.mjs') && (await fs.stat(path.join(ROOT, 'server', f))).mtimeMs > STARTED_AT) { stale = true; break; } } catch {}
    json(res, 200, { stale }); return;
  }
  if (url.pathname === '/health') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: true, demo: DEMO, tarefas: [...running.values()].map(t => t.text), fila: queue.length })); return; }
  // diz à página que ela está rodando com o servidor (liga o modo tempo real)
  if (url.pathname === '/config.js') { res.writeHead(200, { 'content-type': TYPES['.js'], 'cache-control': 'no-store' }); res.end(`window.PIXELHQ_BRIDGE = true;\n`); return; }
  // eventos do Claude Code (scripts/claude-hook.mjs): sem página, por isso a senha em vez da origem
  if (url.pathname === '/api/hooks/claude') {
    if (req.method !== 'POST' || !hookAuth(req)) { res.writeHead(403); res.end(); return; }
    try { claude.handle(await readJSON(req, 4 * 1024 * 1024)); res.writeHead(204); res.end(); }
    catch (e) { res.writeHead(typeof e.code === 'number' ? e.code : 400); res.end(); }
    return;
  }
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
async function readJSON(req, max = 16384) {
  if (!String(req.headers['content-type'] || '').startsWith('application/json')) throw Object.assign(new Error('Envie JSON'), { code: 415 });
  let size = 0; const chunks = [];
  for await (const c of req) { size += c.length; if (size > max) throw Object.assign(new Error('Pedido grande demais'), { code: 413 }); chunks.push(c); }
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
    if (url.pathname === '/api/settings/web' && req.method === 'POST') {
      const b = await readJSON(req);
      await settings.setWeb(b.web !== false);
      return json(res, 200, { ok: true, settings: settings.publicView(await settings.load()) });
    }
    // os hooks do Claude Code estão instalados? (a página do modo "só Claude Code" avisa o que rodar)
    if (url.pathname === '/api/hooks/status' && req.method === 'GET') { try { return json(res, 200, { installed: (await hooksStatus()).installed }); } catch { return json(res, 200, { installed: false }); } }
    if (url.pathname === '/api/office' && req.method === 'GET') return json(res, 200, { office: await office.load() });
    // começar do zero (menu): cancela as tarefas, esquece o estado dos agentes e apaga o escritório. A IA conectada e
    // os arquivos já entregues (workspace/entregas) continuam. Exige JSON (outro site não consegue disparar)
    if (url.pathname === '/api/office/reset' && req.method === 'POST') {
      await readJSON(req);
      for (const t of running.values()) t.abort?.abort();
      for (const q of queue.splice(0)) broadcast(msg.task(q.id, 'cancelada', { text: q.text }));
      lastState.clear(); history.clear();
      await office.clear();
      return json(res, 200, { ok: true });
    }
    // crítica visual de um móvel criado pela IA, em duas etapas (no máximo 2 chamadas por móvel, uma vez só):
    // 1) a página manda a foto do móvel; a IA dá nota e, se ruim, propõe um desenho (guardado como "pending");
    // 2) a página manda a foto do desenho proposto (candidate: true); ele só fica se a nota nova for maior
    if (url.pathname === '/api/office/critique' && req.method === 'POST') {
      const b = await readJSON(req, 600000), id = String(b.id || '');
      const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(String(b.image || ''));
      if (!m) return json(res, 400, { error: 'Imagem inválida' });
      const cur = await office.load(), c = cur?.custom?.find(x => x.id === id);
      if (!c || c.base || !Array.isArray(c.boxes)) return json(res, 404, { error: 'Móvel não encontrado' });
      if (c.reviewed) return json(res, 200, { ok: true, changed: false, custom: c });
      if (b.candidate && !c.pending) return json(res, 409, { error: 'Nenhum desenho proposto para este móvel' });
      if (!b.candidate && c.pending) return json(res, 200, { ok: true, pending: true, custom: c });
      const cfg = await settings.active();
      if (!cfg || DEMO) return json(res, 200, { ok: false, error: 'Sem IA conectada' });
      const chat = (o) => llm.critiqueChat(o), save = (fields) => office.update(o => { const x = o.custom.find(k => k.id === id); if (x) { Object.assign(x, fields); if (fields.reviewed) delete x.pending; } return o; });
      const done = async (fields, msg) => { const upd = await save(fields); console.log(`[crítica visual] ${c.name}: ${msg}`); return json(res, 200, { ok: true, changed: !!fields.boxes, score: fields.score, custom: upd.custom.find(k => k.id === id) }); };
      try {
        if (b.candidate) {
          const s = await scoreFurniture(chat, { ...c, w: c.pending.w, boxes: c.pending.boxes }, m[1]);
          if (s.score > c.pending.score) return done({ reviewed: true, score: s.score, w: c.pending.w, boxes: c.pending.boxes }, `desenho novo aprovado (nota ${c.pending.score} → ${s.score})`);
          return done({ reviewed: true, score: c.pending.score }, `desenho novo recusado (nota ${c.pending.score} → ${s.score}); fica o original`);
        }
        const r = await critiqueFurniture(chat, c, m[1]);
        if (!r.changed) return done({ reviewed: true, score: r.score }, `nota ${r.score}${r.rejected ? ' (a correção não passou nas regras: ' + r.rejected.join('; ') + ')' : ''}`);
        const upd = await save({ pending: { score: r.score, w: r.w, boxes: r.boxes, problems: r.problems } });
        console.log(`[crítica visual] ${c.name}: nota ${r.score}, desenho novo proposto (${r.problems.join('; ')})`);
        return json(res, 200, { ok: true, pending: true, score: r.score, custom: upd.custom.find(k => k.id === id) });
      } catch (e) {
        // modelo sem visão (ou erro do provedor): marca como revisado para não gastar de novo a cada abertura
        console.error('[crítica visual]', cfg.provider, e?.model || cfg.model, e?.status, String(e?.message).slice(0, 160));
        return done({ reviewed: true, score: null }, 'sem avaliação (a IA não aceitou a imagem ou deu erro)');
      }
    }
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
  ws.send(JSON.stringify(claudeTeam()));
  for (const t of running.values()) ws.send(JSON.stringify(msg.task(t.id, 'em_andamento', { text: t.text })));
  // histórico (sem o último, que vem logo abaixo como estado atual): só preenche a ficha
  for (const h of history.values()) for (const m of h.slice(0, -1)) ws.send(JSON.stringify({ ...m, replay: true }));
  for (const m of lastState.values()) ws.send(JSON.stringify(m));
  ws.on('message', (raw) => {
    const t = parseClientMessage(raw); if (!t) return;
    if (t.cancel) {
      running.get(t.cancel)?.abort.abort();
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
await writeHookFile().catch(e => console.error('[claude code] não consegui gravar', HOOK_FILE, e.message));
server.listen(PORT, HOST, () => {
  console.log(`Pixel HQ ${DEMO ? '(demo: tarefas simuladas)' : ''} em http://${HOST}:${PORT}`);
  settings.active().then(c => console.log(c ? `IA: ${PROVIDERS[c.provider].name} · ${c.model}` : 'IA ainda não configurada: abra a página para escolher.'));
  console.log(`Arquivos dos agentes: ${path.join(WORKSPACE, 'projeto')}`);
});
