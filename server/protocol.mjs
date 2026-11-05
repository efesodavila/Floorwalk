// Protocolo Floorwalk v1 — ver docs/PROTOCOLO.md
import { PLACES } from './places.mjs';
export const PROTOCOL = 1;
export const STATES = ['planejando', 'trabalhando', 'revisando', 'pesquisando', 'reuniao', 'entregando', 'aguardando', 'bloqueado', 'concluido', 'ocioso', 'offline'];
// tipos de papel: o escritório decide o comportamento por eles; nome e id do papel são livres
// atende (cliente: venda, caixa, recepção, suporte) e opera (estoque, limpeza, manutenção, logística) cobrem
// negócios que não são escritório, ex.: o caixa de uma loja de roupa é "atende"
export const KINDS = ['coordena', 'produz', 'atende', 'opera', 'revisa', 'pesquisa', 'entrega'];

const clip = (s, n) => { s = String(s ?? '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

export const msg = {
  hello: () => ({ type: 'hello', protocol: PROTOCOL, server: 'floorwalk' }),
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
    if (place && PLACES[place]) m.place = place; // lugar do escritório: leva a pessoa ao móvel certo
    return m;
  },
  log: (agent, text, run) => ({ type: 'log', agent, text: clip(text, 280), run }),
};
