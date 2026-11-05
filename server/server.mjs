// Servidor do Floorwalk
// - serve a página do escritório em http://HOST:PORT/
// - recebe os eventos das sessões do Claude Code (POST /api/hooks/claude, mandados por plugin/scripts/claude-hook.mjs)
// - WebSocket em /events: transmite à página o que cada sessão está fazendo
// (a equipe de IA própria, com tarefas, ficou no branch equipe-ia)
import http from 'node:http';
import fs from 'node:fs/promises';
import fss from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import './env.mjs'; // nomes antigos das variáveis (PIXELHQ_*): antes de tudo
import { WebSocketServer } from 'ws';
import { msg } from './protocol.mjs';
import { createPacer } from './pacer.mjs';
import { createClaudeBridge } from './claude-code.mjs';
import { status as hooksStatus } from './claude-hooks-install.mjs';
import crypto from 'node:crypto';
import net from 'node:net';
import os from 'node:os';

const STARTED_AT = Date.now(); // hora em que o servidor subiu (para /api/stale)
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '127.0.0.1';
const MIN_DWELL = Number(process.env.MIN_DWELL_MS || 3500);
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

/* ---------- transmissão ---------- */
const clients = new Set();
const lastState = new Map();     // agente -> último estado (para quem conecta depois)
const history = new Map();       // agente -> últimos estados com a hora (a ficha mostra o histórico a quem conecta depois)
const endedSessions = new Set(); // sessões encerradas: o "offline" delas é o último, e nada fica guardado
function broadcast(m) {
  if (m.type === 'state' && m.state === 'offline' && endedSessions.delete(m.agent)) { lastState.delete(m.agent); history.delete(m.agent); }
  else if (m.type === 'state') {
    lastState.set(m.agent, { ...m, at: Date.now() }); // com a hora: quem conecta depois sabe há quanto tempo está assim
    const h = history.get(m.agent) || []; h.push({ ...m, at: Date.now() }); if (h.length > 40) h.shift(); history.set(m.agent, h);
  }
  const data = JSON.stringify(m);
  for (const ws of clients) if (ws.readyState === 1) ws.send(data);
}
const pacer = createPacer(broadcast, MIN_DWELL);
// sessões do Claude Code (hooks): cada uma vira um personagem; ver server/claude-code.mjs
const claude = createClaudeBridge({
  say: (m, hold) => pacer.push(msg.state(m), hold),
  log: (agent, text) => broadcast(msg.log(agent, text)),
  team: () => broadcast(claudeTeam()), // na hora: o primeiro estado da sessão vem logo atrás
  // sessão nova com o nome de uma que já acabou: a ficha começa vazia (é outro personagem)
  fresh: (name) => { if (!endedSessions.has(name)) { lastState.delete(name); history.delete(name); } },
  ended: (name) => endedSessions.add(name),
});
// sessão sem nenhum evento há 1 h (terminal fechado à força, sem SessionEnd): sai da sala
setInterval(() => claude.sweep(60 * 60 * 1000), 60 * 1000).unref();
// lista completa das sessões abertas (source no topo: a página tira da sala quem não está mais nela)
function claudeTeam() { return { ...msg.team(claude.members()), source: 'claude-code' }; }
// senha dos hooks: o script do hook lê de ~/.floorwalk/hook.json (só o usuário lê) e manda no cabeçalho
const HOOK_FILE = path.join(process.env.FLOORWALK_HOME || path.join(os.homedir(), '.floorwalk'), 'hook.json');
let HOOK_TOKEN = '';
let lastEventAt = 0; // hora do último evento recebido de um hook (a página mostra "último evento há X")
async function loadHookToken() {
  // mesma senha de antes (inclusive da pasta do nome antigo, ~/.pixel-hq): o hook já instalado continua valendo
  for (const f of [HOOK_FILE, path.join(os.homedir(), '.pixel-hq', 'hook.json')]) { if (HOOK_TOKEN) break; try { HOOK_TOKEN = JSON.parse(await fs.readFile(f, 'utf8')).token || ''; } catch {} }
  if (!/^[a-f0-9]{48}$/.test(HOOK_TOKEN)) HOOK_TOKEN = crypto.randomBytes(24).toString('hex');
}
// só depois que a porta abriu: se ela estiver ocupada, o arquivo continua apontando para o servidor que já roda.
// Síncrono de propósito: fica gravado antes do primeiro pedido ser atendido
function writeHookFile() {
  fss.mkdirSync(path.dirname(HOOK_FILE), { recursive: true });
  fss.writeFileSync(HOOK_FILE, JSON.stringify({ port: PORT, token: HOOK_TOKEN }), { mode: 0o600 });
}
const hookAuth = (req) => {
  const got = Buffer.from(String(req.headers['x-floorwalk-token'] || '')), want = Buffer.from(HOOK_TOKEN);
  return HOOK_TOKEN && got.length === want.length && crypto.timingSafeEqual(got, want);
};

/* ---------- HTTP + WebSocket ---------- */
const WEB = path.join(ROOT, 'web');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.glb': 'model/gltf-binary' };
// endereço que o navegador usou (cabeçalho Host): só o próprio computador ou um IP digitado. Barra o "DNS rebinding":
// um site qualquer cujo nome passa a apontar para 127.0.0.1 teria a mesma origem e o mesmo Host, e passaria pela checagem
// de origem. Para usar por um nome (ex.: proxy, Tailscale), liste em FLOORWALK_ALLOWED_HOSTS (separados por vírgula)
const ALLOWED_HOSTS = new Set(['localhost', ...String(process.env.FLOORWALK_ALLOWED_HOSTS || '').split(',').map(h => h.trim().toLowerCase()).filter(Boolean)]);
function hostOk(req) {
  let h; try { h = new URL('http://' + String(req.headers.host || '')).hostname.toLowerCase(); } catch { return false; }
  h = h.replace(/^\[|\]$/g, '');
  return !!h && (net.isIP(h) > 0 || ALLOWED_HOSTS.has(h) || h.endsWith('.localhost'));
}
const server = http.createServer(async (req, res) => {
  if (!hostOk(req)) { res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' }); res.end('Host not allowed. Use http://127.0.0.1 or list the name in FLOORWALK_ALLOWED_HOSTS.'); return; }
  try { await handle(req, res); }
  catch (e) {
    // nada derruba o servidor: endereço malformado vira 400, o resto 500
    const bad = e instanceof URIError;
    if (!bad) console.error('[http]', req.method, req.url?.slice(0, 120), e?.message);
    if (!res.headersSent) { res.writeHead(bad ? 400 : 500); res.end(); } else res.destroy();
  }
});
const json = (res, code, body) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(body)); };
async function readJSON(req, max = 16384) {
  if (!String(req.headers['content-type'] || '').startsWith('application/json')) throw Object.assign(new Error('Send JSON'), { code: 415 });
  let size = 0; const chunks = [];
  for await (const c of req) { size += c.length; if (size > max) throw Object.assign(new Error('Request too large'), { code: 413 }); chunks.push(c); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}
async function handle(req, res) {
  const url = new URL(req.url, 'http://x');
  // código do servidor mudou depois que ele subiu? (a página avisa: "reinicie o servidor")
  if (url.pathname === '/api/stale') {
    let stale = false;
    try { for (const f of await fs.readdir(path.join(ROOT, 'server'))) if (f.endsWith('.mjs') && (await fs.stat(path.join(ROOT, 'server', f))).mtimeMs > STARTED_AT) { stale = true; break; } } catch {}
    return json(res, 200, { stale });
  }
  if (url.pathname === '/health') return json(res, 200, { ok: true, sessoes: claude.members().length });
  // diz à página que ela está rodando com o servidor (liga o modo tempo real)
  if (url.pathname === '/config.js') { res.writeHead(200, { 'content-type': TYPES['.js'], 'cache-control': 'no-store' }); res.end(`window.FLOORWALK_BRIDGE = true;\n`); return; }
  // eventos do Claude Code (plugin/scripts/claude-hook.mjs): sem página, por isso a senha em vez da origem
  if (url.pathname === '/api/hooks/claude') {
    if (req.method !== 'POST' || !hookAuth(req)) { res.writeHead(403); res.end(); return; }
    try { claude.handle(await readJSON(req, 4 * 1024 * 1024)); lastEventAt = Date.now(); res.writeHead(204); res.end(); }
    catch (e) { res.writeHead(typeof e.code === 'number' ? e.code : 400); res.end(); }
    return;
  }
  // os hooks do Claude Code estão instalados? (a página avisa o que rodar)
  if (url.pathname === '/api/hooks/status' && req.method === 'GET') {
    // installed: está no settings.json · broken: está, mas o script não existe mais (pasta movida ou apagada)
    // lastEventAt: hora do último evento que chegou de verdade (0 = nenhum desde que o servidor subiu)
    try { const s = await hooksStatus(); return json(res, 200, { installed: s.installed, broken: s.broken, plugin: s.plugin, lastEventAt }); }
    catch { return json(res, 200, { installed: false, broken: false, plugin: false, lastEventAt }); }
  }
  if (url.pathname.startsWith('/api/')) return json(res, 404, { error: 'Not found' });
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
  } catch { res.writeHead(404); res.end('Not found'); }
}

const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });
server.on('upgrade', (req, sock, head) => {
  // só aceita a própria página: outro site aberto no navegador não vê as sessões
  let ok = false; try { ok = hostOk(req) && new URL(req.headers.origin).host === req.headers.host; } catch {}
  if (!req.url.startsWith('/events') || !ok) { sock.write('HTTP/1.1 403 Forbidden\r\n\r\n'); sock.destroy(); return; }
  wss.handleUpgrade(req, sock, head, (ws) => wss.emit('connection', ws));
});
wss.on('connection', (ws) => {
  clients.add(ws);
  ws.send(JSON.stringify(msg.hello()));
  ws.send(JSON.stringify(claudeTeam()));
  // histórico (sem o último, que vem logo abaixo como estado atual): só preenche a ficha
  for (const h of history.values()) for (const m of h.slice(0, -1)) ws.send(JSON.stringify({ ...m, replay: true }));
  for (const m of lastState.values()) ws.send(JSON.stringify(m));
  // a página só escuta: o que ela mandar é ignorado
  ws.on('close', () => clients.delete(ws));
});

await loadHookToken();
// porta ocupada (outro Floorwalk ou outro programa): uma frase em vez do erro cru do Node
server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use (is Floorwalk already running? open http://127.0.0.1:${PORT}).`);
    console.error(`To use another port: PORT=${PORT + 1} npm start  (or set PORT in a .env file, see .env.example)`);
  } else if (e.code === 'EACCES') console.error(`No permission to use port ${PORT}. Pick another one, e.g. PORT=8790 npm start`);
  else console.error('Could not start the server:', e.message);
  process.exit(1);
});
server.listen(PORT, HOST, () => {
  try { writeHookFile(); } catch (e) { console.error('[claude code] could not write', HOOK_FILE, e.message); }
  console.log(`Floorwalk running at http://${HOST === '0.0.0.0' ? '127.0.0.1' : HOST}:${PORT}`);
  // fora do próprio computador, qualquer aparelho da rede abre a página e vê as sessões: avisa
  if (!['127.0.0.1', '::1', 'localhost'].includes(HOST)) console.warn(`[warning] HOST=${HOST}: Floorwalk is open to your network. Only do this on a network you trust.`);
  hooksStatus().then(s => console.log(
    s.broken ? 'Claude Code hooks point to a folder that no longer exists: run npm run hooks:install again.'
      : s.installed ? 'Claude Code hooks are on. Start a new Claude Code session and it walks into the room.'
        : 'Claude Code hooks are not installed yet: install the plugin or run npm run hooks:install (see README).'), () => {});
});
