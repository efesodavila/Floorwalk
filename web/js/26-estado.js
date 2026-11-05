'use strict';

/* ---------- Estado ao vivo: um aviso fixo no canto, sempre à vista no modo ao vivo ----------
   Responde a pergunta de quem acabou de instalar: "está funcionando?". Ponto colorido = conexão com o servidor
   (verde conectado, âmbar falta algo, cinza sem servidor); a frase diz o que falta ou o que está acontecendo:
   sem servidor → como subir; hooks desligados ou quebrados → o que rodar; sala vazia → esperando a primeira sessão;
   com sessões → quantas e há quanto tempo chegou o último evento (prova de que os hooks chegam de verdade). */
const HINT_KEY = 'floorwalk.hint.ficha'; // já abriu uma ficha: a dica "clique no personagem" não volta
const liveEl = document.createElement('div');
liveEl.id = 'live-status'; liveEl.className = 'live-status'; liveEl.setAttribute('role', 'status'); liveEl.hidden = true;
liveEl.innerHTML = '<i class="ls-dot" aria-hidden="true"></i><span class="ls-text"><b></b><small></small></span>';
document.body.append(liveEl);
let hooksInfo = null; // { installed, broken, plugin, lastEventAt } de /api/hooks/status
let hintSeen = false; try { hintSeen = localStorage.getItem(HINT_KEY) === '1'; } catch {}

async function pollHooks() {
  if (!window.FLOORWALK_BRIDGE) return;
  try { hooksInfo = await (await fetch('/api/hooks/status', { cache: 'no-store' })).json(); } catch { hooksInfo = null; }
  renderLiveStatus();
}
function liveStatus() {
  const sessions = sim.agents.filter(a => a.ext && !a.gone).length;
  const conn = sim.wsState === 'conectado';
  if (!conn) return { tone: 'off', title: 'Sem conexão com o servidor', sub: 'Tentando de novo… Se ele estiver parado, rode npm start na pasta do Floorwalk.' };
  if (hooksInfo?.broken) return { tone: 'warn', title: 'Os hooks apontam para uma pasta que não existe mais', sub: 'Rode npm run hooks:install de novo na pasta do Floorwalk (ou instale o plugin).' };
  if (hooksInfo && !hooksInfo.installed) return { tone: 'warn', title: 'Falta ligar o Claude Code', sub: 'Instale o plugin do Floorwalk ou rode npm run hooks:install. Veja o README.' };
  const ago = hooksInfo?.lastEventAt ? (Date.now() - hooksInfo.lastEventAt) / 1000 : null;
  if (!sessions) return { tone: 'ok', title: 'Esperando a primeira sessão do Claude Code', sub: ago == null ? 'Abra uma sessão nova: ela entra pela porta.' : `Último evento há ${fmtDur(ago)}. Abra uma sessão nova: ela entra pela porta.` };
  const n = sessions === 1 ? '1 sessão aberta' : `${sessions} sessões abertas`;
  if (!hintSeen) return { tone: 'ok', title: n, sub: 'Clique num personagem para ver o que ele está fazendo.' };
  return { tone: 'ok', title: n, sub: ago == null ? '' : `Último evento há ${fmtDur(ago)}` };
}
let liveHTML = '';
function renderLiveStatus() {
  if (!hintSeen && sim.inspect) { hintSeen = true; try { localStorage.setItem(HINT_KEY, '1'); } catch {} }
  const show = !!window.FLOORWALK_BRIDGE && mode === 'live' && !document.body.classList.contains('booting');
  liveEl.hidden = !show; if (!show) return;
  const s = liveStatus(), key = s.tone + '|' + s.title + '|' + s.sub;
  if (key === liveHTML) return; liveHTML = key;
  liveEl.dataset.tone = s.tone;
  liveEl.querySelector('b').textContent = s.title;
  const sm = liveEl.querySelector('small'); sm.textContent = s.sub; sm.hidden = !s.sub;
}
setInterval(renderLiveStatus, 1000);
setInterval(pollHooks, 5000);
