// Ponte Claude Code → protocolo Pixel HQ.
// Os hooks do Claude Code (instalados por scripts/claude-hooks.mjs) mandam cada evento da sessão para
// POST /api/hooks/claude. Aqui cada evento vira um estado do protocolo: o personagem da sessão vai ao
// lugar certo da sala (editar → computador, ler → estante, deploy → servidores, pedir permissão → bloqueado).
// Nada aqui chama IA nem guarda o conteúdo dos eventos: só o necessário para desenhar a sala.
import path from 'node:path';

export const ROLE = { role: 'claude_code', roleName: 'Claude Code', kind: 'produz' };
// eventos que o instalador registra no ~/.claude/settings.json (o que não está aqui não chega ao servidor)
export const HOOK_EVENTS = ['SessionStart', 'SessionEnd', 'UserPromptSubmit', 'PreToolUse', 'PostToolUseFailure', 'PermissionRequest', 'Notification', 'Stop', 'SubagentStart', 'SubagentStop'];
// eventos de ferramenta: o hook precisa de matcher
export const TOOL_EVENTS = new Set(['PreToolUse', 'PostToolUseFailure', 'PermissionRequest']);

const clip = (s, n) => { s = String(s ?? '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
// comandos podem trazer segredos (export TOKEN=…, curl -H "Authorization: …"): some com o valor e com sequências longas
export const redact = (s) => String(s ?? '')
  .replace(/(bearer|basic)\s+[^\s"']+/gi, '$1 …')
  .replace(/((?:token|key|secret|senha|password|passwd|authorization|bearer)\w*["']?\s*[=:]\s*["']?)[^\s"']+/gi, '$1…')
  .replace(/[A-Za-z0-9_\-+/=]{24,}/g, '…');
const base = (p) => p ? path.basename(String(p).replace(/[\\/]+$/, '')) : '';

const DEPLOY = /\b(git\s+push|npm\s+publish|vercel|netlify|fly\s+deploy|railway\s+up|docker\s+push|kubectl\s+apply|terraform\s+apply|gh\s+release|deploy)\b/i;
const TESTS = /\b(test|tests|jest|vitest|pytest|mocha|playwright|eslint|lint|tsc|check-types)\b/i;

// o que uma ferramenta significa na sala: { state, place, detail }
export function toolAction(tool, input = {}) {
  const t = String(tool || ''), file = base(input.file_path || input.notebook_path || input.path);
  if (/^(Edit|MultiEdit|Write|NotebookEdit)$/.test(t)) return { state: 'trabalhando', place: 'computador', detail: file ? `Editando ${file}` : 'Editando arquivos' };
  if (t === 'Read') return { state: 'pesquisando', place: 'leitura', detail: file ? `Lendo ${file}` : 'Lendo arquivos' };
  if (/^(Grep|Glob|LS)$/.test(t)) return { state: 'pesquisando', place: 'leitura', detail: input.pattern ? `Buscando "${clip(redact(input.pattern), 40)}"` : 'Procurando arquivos' };
  if (/^(WebFetch|WebSearch)$/.test(t)) {
    let site = ''; try { site = new URL(input.url).hostname; } catch {}
    return { state: 'pesquisando', place: 'leitura', detail: site ? `Lendo ${site}` : input.query ? `Pesquisando "${clip(redact(input.query), 50)}"` : 'Pesquisando na internet' };
  }
  if (t === 'Bash' || t === 'PowerShell') {
    const raw = String(input.command || ''), cmd = clip(redact(raw), 70);
    if (DEPLOY.test(raw)) return { state: 'entregando', place: 'servidores', detail: `Publicando: ${cmd}` };
    if (TESTS.test(raw)) return { state: 'revisando', place: 'computador', detail: `Testando: ${cmd}` };
    return { state: 'trabalhando', place: 'computador', detail: cmd ? `Rodando: ${cmd}` : 'Rodando um comando' };
  }
  if (t === 'Task' || t === 'Agent') return { state: 'planejando', place: 'quadro', detail: `Delegando: ${clip(input.description || input.subagent_type || 'subtarefa', 60)}` };
  if (/^(TodoWrite|TaskCreate|TaskUpdate|ExitPlanMode|EnterPlanMode)$/.test(t)) return { state: 'planejando', place: 'quadro', detail: 'Organizando as etapas' };
  if (t.startsWith('mcp__')) return { state: 'trabalhando', place: 'computador', detail: `Usando ${clip(t.split('__').slice(1).join(' · '), 50)}` };
  return { state: 'trabalhando', place: 'computador', detail: t ? `Usando ${clip(t, 40)}` : 'Trabalhando' };
}

// sessões ativas: session_id → { name, cwd, since }. Nome = pasta do projeto ("pixel-hq", "pixel-hq 2"…)
// say(estado, hold): manda um estado; log(agente, texto); team(): a equipe mudou (alguém entrou)
export function createClaudeBridge({ say, log, team }) {
  const sessions = new Map();
  const nameFor = (id, cwd) => {
    if (sessions.has(id)) return sessions.get(id).name;
    const root = clip(base(cwd), 11) || 'Claude';
    const used = new Set([...sessions.values()].map(s => s.name.toLowerCase()));
    let name = root, n = 2; while (used.has(name.toLowerCase())) name = `${root} ${n++}`;
    sessions.set(id, { name, cwd: String(cwd || ''), since: Date.now() });
    team();
    return name;
  };
  const members = () => [...sessions.values()].map(s => ({ name: s.name, ...ROLE, source: 'claude-code' }));

  // um evento do hook → estado na sala. Devolve o que fez (para testes)
  function handle(ev) {
    if (!ev || typeof ev !== 'object') return null;
    const id = String(ev.session_id || '').slice(0, 80), kind = String(ev.hook_event_name || '');
    if (!id || !kind || !HOOK_EVENTS.includes(kind)) return null;
    const name = nameFor(id, ev.cwd), task = clip(base(ev.cwd) || 'Claude Code', 60);
    const put = (state, extra = {}, hold) => { say({ agent: name, state, task, ...extra }, hold); return { agent: name, state, ...extra }; };
    switch (kind) {
      case 'SessionStart': return put('aguardando', { detail: ev.source === 'resume' ? 'Sessão retomada' : 'Sessão iniciada' });
      case 'UserPromptSubmit': return put('planejando', { place: 'quadro', detail: 'Pensando no seu pedido' }); // o texto do pedido não é lido
      case 'PreToolUse': { const { state, ...rest } = toolAction(ev.tool_name, ev.tool_input || {}); return put(state, rest); }
      case 'PostToolUseFailure': log(name, `Falhou: ${clip(ev.tool_name, 40)}`); return { agent: name, log: true };
      case 'PermissionRequest': return put('bloqueado', { detail: `Pedindo permissão: ${clip(ev.tool_name || 'ferramenta', 40)}` });
      case 'Notification': return /permiss/i.test(String(ev.message || ''))
        ? put('bloqueado', { detail: 'Pedindo permissão' })
        : put('aguardando', { detail: 'Esperando sua resposta' });
      // "reuniao" exige com quem; o subagente não tem personagem (ainda), então vai à mesa de reunião planejando
      case 'SubagentStart': return put('planejando', { place: 'reuniao', detail: `Subagente começou${ev.agent_type ? ': ' + clip(ev.agent_type, 40) : ''}` });
      case 'SubagentStop': log(name, 'Subagente terminou'); return { agent: name, log: true };
      case 'Stop': return put('concluido', { detail: 'Turno concluído' }, 4500);
      case 'SessionEnd': { const r = put('offline', { detail: 'Sessão encerrada' }); sessions.delete(id); return r; }
      default: return null;
    }
  }
  return { handle, members, sessions };
}
