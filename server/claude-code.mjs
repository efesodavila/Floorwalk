// Ponte Claude Code → protocolo Floorwalk.
// Os hooks do Claude Code (instalados por scripts/claude-hooks.mjs) mandam cada evento da sessão para
// POST /api/hooks/claude. Aqui cada evento vira um estado do protocolo: o personagem da sessão vai ao
// lugar certo da sala (editar → computador, ler → estante, deploy → servidores, pedir permissão → bloqueado).
// Nada aqui chama IA nem guarda o conteúdo dos eventos: só o necessário para desenhar a sala.

export const ROLE = { role: 'claude_code', roleName: 'Claude Code', kind: 'produz' };
// eventos que o instalador registra no ~/.claude/settings.json (o que não está aqui não chega ao servidor)
export const HOOK_EVENTS = ['SessionStart', 'SessionEnd', 'UserPromptSubmit', 'PreToolUse', 'PostToolUseFailure', 'PermissionRequest', 'Notification', 'Stop', 'SubagentStart', 'SubagentStop'];
// eventos de ferramenta: o hook precisa de matcher
export const TOOL_EVENTS = new Set(['PreToolUse', 'PostToolUseFailure', 'PermissionRequest']);

const clip = (s, n) => { s = String(s ?? '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
// comandos podem trazer segredos (export TOKEN=…, curl -H "Authorization: …", --password x, -u user:senha,
// postgres://user:senha@host): some com o valor e com sequências longas. Na dúvida, esconde a mais.
const SECRET = '(?:token|key|secret|senha|pass|pwd|auth|cookie|credential|bearer)';
const VALUE = `("[^"]*"|'[^']*'|[^\\s"']+)`;
const FLAG_SECRET = new RegExp(`((?:^|\\s)--?[\\w-]*${SECRET}[\\w-]*)(\\s+|=)${VALUE}`, 'gi');
const ASSIGN_SECRET = new RegExp(`(${SECRET}\\w*["']?\\s*[=:]\\s*)${VALUE}`, 'gi');
export const redact = (s) => String(s ?? '')
  .replace(/(bearer|basic)\s+[^\s"']+/gi, '$1 …')
  .replace(/(\w+:\/\/[^\s:/@]+):[^\s@/]+@/g, '$1:…@')
  .replace(/((?:^|\s)(?:-u|--user)\s+[^\s:]+):\S+/g, '$1:…')
  .replace(FLAG_SECRET, '$1$2…')
  .replace(ASSIGN_SECRET, '$1…')
  .replace(/[A-Za-z0-9_\-+/=]{24,}/g, '…');
// último pedaço do caminho, com barra de Windows ou de Linux/Mac (o servidor pode rodar num sistema e o Claude Code em outro, ex.: WSL)
const base = (p) => p ? String(p).replace(/[\\/]+$/, '').split(/[\\/]/).pop() : '';

// o que conta é o comando que roda, não o texto dele: "cat deploy.md" ou git commit -m "test" não é deploy nem teste.
// Cada trecho (separado por && || ; |) perde as variáveis da frente (X=1) e os lançadores (npx, sudo…) e é testado do começo.
const DEPLOY = /^(git\s+push|(npm|pnpm|yarn|bun)\s+publish|vercel(\s+(deploy|--prod)|\s*$)|netlify\s+deploy|fly(ctl)?\s+deploy|railway\s+up|docker\s+push|kubectl\s+apply|terraform\s+apply|gh\s+release|firebase\s+deploy|wrangler\s+(deploy|publish)|(npm|pnpm|yarn|bun)\s+(run\s+)?deploy\S*)/i;
const TESTS = /^((npm|pnpm|yarn|bun)\s+(run\s+)?(test|t|lint|check|typecheck|check-types)\S*|node\s+--test|jest|vitest|pytest|python\d?\s+-m\s+pytest|mocha|playwright\s+test|eslint|tsc|go\s+(test|vet)|cargo\s+(test|clippy)|dotnet\s+test|phpunit|rspec|Invoke-Pester)(?=\s|$)/i;
const LAUNCHER = /^((\w+=("[^"]*"|'[^']*'|\S*)\s+)|(sudo|npx|bunx|time|env|(pnpm|yarn)\s+(dlx|exec))\s+)/;
const commands = (raw) => String(raw).split(/&&|\|\||[;|\n]/).map(c => { c = c.trim(); while (LAUNCHER.test(c)) c = c.replace(LAUNCHER, ''); return c; });

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
    const parts = commands(raw);
    if (parts.some(c => DEPLOY.test(c))) return { state: 'entregando', place: 'servidores', detail: `Publicando: ${cmd}` };
    if (parts.some(c => TESTS.test(c))) return { state: 'revisando', place: 'computador', detail: `Testando: ${cmd}` };
    return { state: 'trabalhando', place: 'computador', detail: cmd ? `Rodando: ${cmd}` : 'Rodando um comando' };
  }
  if (t === 'AskUserQuestion') return { state: 'aguardando', place: 'computador', detail: 'Fazendo uma pergunta a você' };
  if (t === 'Task' || t === 'Agent') return { state: 'planejando', place: 'quadro', detail: `Delegando: ${clip(input.description || input.subagent_type || 'subtarefa', 60)}` };
  if (/^(TodoWrite|TaskCreate|TaskUpdate|ExitPlanMode|EnterPlanMode)$/.test(t)) return { state: 'planejando', place: 'quadro', detail: 'Organizando as etapas' };
  if (t.startsWith('mcp__')) { const [, srv = '', tool = ''] = t.split('__'); return { state: 'trabalhando', place: 'computador', detail: clip(`Usando ${tool.replace(/_/g, ' ')}${srv ? ` (${srv.replace(/^plugin_|_/g, ' ').trim()})` : ''}`, 60) }; }
  return { state: 'trabalhando', place: 'computador', detail: t ? `Usando ${clip(t, 40)}` : 'Trabalhando' };
}

// sessões ativas: session_id → { name, cwd, since }. Nome = pasta do projeto ("floorwalk", "floorwalk 2"…)
// say(estado, hold): manda um estado; log(agente, texto); team(): a equipe mudou (alguém entrou)
// fresh(nome): sessão nova com esse nome (a ficha começa vazia); ended(nome): o próximo "offline" dele é o último
export function createClaudeBridge({ say, log, team, fresh = () => {}, ended = () => {} }) {
  const sessions = new Map();
  const nameFor = (id, cwd) => {
    if (sessions.has(id)) return sessions.get(id).name;
    const root = clip(base(cwd), 11) || 'Claude';
    const used = new Set([...sessions.values()].map(s => s.name.toLowerCase()));
    let name = root, n = 2; while (used.has(name.toLowerCase())) name = `${root} ${n++}`;
    sessions.set(id, { name, cwd: String(cwd || ''), since: Date.now(), last: Date.now() });
    fresh(name); team();
    return name;
  };
  const members = () => [...sessions.values()].map(s => ({ name: s.name, ...ROLE, source: 'claude-code' }));

  // um evento do hook → estado na sala. Devolve o que fez (para testes)
  function handle(ev) {
    if (!ev || typeof ev !== 'object') return null;
    const id = String(ev.session_id || '').slice(0, 80), kind = String(ev.hook_event_name || '');
    if (!id || !kind || !HOOK_EVENTS.includes(kind)) return null;
    const name = nameFor(id, ev.cwd); sessions.get(id).last = Date.now();
    const task = clip(base(ev.cwd) || 'Claude Code', 60);
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
      case 'SessionEnd': { ended(name); const r = put('offline', { detail: 'Sessão encerrada' }); sessions.delete(id); team(); return r; }
      default: return null;
    }
  }
  // sessões sem evento há mais de idleMs: encerradas (a lista da equipe que vai à página é a verdade sobre quem existe)
  function sweep(idleMs, now = Date.now()) {
    let n = 0;
    for (const [id, s] of sessions) if (now - s.last > idleMs) { ended(s.name); say({ agent: s.name, state: 'offline', task: clip(base(s.cwd) || 'Claude Code', 60), detail: 'Sessão sem atividade' }); sessions.delete(id); n++; }
    if (n) team();
    return n;
  }
  return { handle, members, sessions, sweep };
}
