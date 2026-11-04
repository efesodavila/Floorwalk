// Protocolo Pixel HQ v1 — ver PROTOCOLO.md
import { PLACES } from './places.mjs';
export const PROTOCOL = 1;
export const STATES = ['planejando', 'trabalhando', 'revisando', 'pesquisando', 'reuniao', 'entregando', 'aguardando', 'bloqueado', 'concluido', 'ocioso', 'offline'];
// tipos de papel: o escritório decide o comportamento por eles; nome e id do papel são livres
// atende (cliente: venda, caixa, recepção, suporte) e opera (estoque, limpeza, manutenção, logística) cobrem
// negócios que não são escritório, ex.: o caixa de uma loja de roupa é "atende"
export const KINDS = ['coordena', 'produz', 'atende', 'opera', 'revisa', 'pesquisa', 'entrega'];
export const TASK_STATUS = ['na_fila', 'em_andamento', 'concluida', 'erro', 'cancelada'];

const clip = (s, n) => { s = String(s ?? '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

export const msg = {
  hello: (demo = false) => ({ type: 'hello', protocol: PROTOCOL, server: 'pixel-hq', demo }),
  team: (agents) => ({ type: 'team', agents: agents.map(a => {
    if (!KINDS.includes(a.kind)) throw new Error(`tipo de papel inválido: ${a.kind}`);
    const o = { name: a.name, role: a.role, roleName: a.roleName, kind: a.kind };
    if (/^[a-z][a-z0-9-]{0,30}$/.test(a.source || '')) o.source = a.source; // de onde vem o agente (ex.: claude-code)
    return o;
  }) }),
  state: ({ agent, state, task, with: w, detail, run, place }) => {
    if (!STATES.includes(state)) throw new Error(`estado inválido: ${state}`);
    const m = { type: 'state', agent, state, task: clip(task, 60), run };
    if (w?.length) m.with = w;
    if (detail) m.detail = clip(detail, 140);
    if (place && (PLACES[place] || /^p_[a-z0-9_]{1,40}$/.test(place))) m.place = place; // lugar do escritório (p_… = móvel criado pela IA)
    return m;
  },
  log: (agent, text, run) => ({ type: 'log', agent, text: clip(text, 280), run }),
  // entrega de uma pessoa: o texto completo que ela produziu
  result: (run, { agent, action, title, text }) => ({ type: 'result', run, agent, action, title: clip(title, 80), text: String(text ?? '').slice(0, 40000) }),
  task: (id, status, extra = {}) => {
    if (!TASK_STATUS.includes(status)) throw new Error(`status inválido: ${status}`);
    return { type: 'task', id, status, ...extra }; // extra.fix = 'ai': o problema se resolve trocando a IA
  },
};

// valida o que chega da página: {type:'task', id, text} ou {type:'cancel', id}
export function parseClientMessage(raw) {
  let m; try { m = JSON.parse(String(raw)); } catch { return null; }
  if (m?.type === 'cancel' && /^[\w-]{1,64}$/.test(String(m.id))) return { cancel: String(m.id) };
  if (!m || m.type !== 'task') return null;
  const text = String(m.text ?? '').trim();
  if (!text || text.length > 2000) return null;
  const id = /^[\w-]{1,64}$/.test(String(m.id)) ? String(m.id) : 'run-' + Date.now().toString(36);
  // móveis que estão de verdade na sala (ids do catálogo; c_… = criado pela IA): decidem os lugares que a IA vê
  const room = Array.isArray(m.room) ? [...new Set(m.room.map(String).filter(k => /^[a-z0-9_]{1,40}$/.test(k)))].slice(0, 80) : null;
  return room?.length ? { id, text, room } : { id, text };
}
