'use strict';

/* ---------- Quem chega pela ponte: cada sessão do Claude Code (ou agente de outra integração) vira uma pessoa ---------- */
function addAgentLive(nome, papel) {
  if (!nome || agentByRef(nome)) return agentByRef(nome);
  const b = bounds(), id = nid('p'), pos = freeSpotNear((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2);
  const p = { id, name: String(nome).slice(0, 14), ...randomLook(genderOfName(nome)), role: ROLES[papel] ? papel : defaultRole(), pos };
  W.people.push(p); try { save(); } catch (e) {}
  const a = makeAgent(p); sim.agents.push(a); teamHTML = '';
  logFeed({ name: p.name, st: null, text: `Entrou na sala como ${ROLES[p.role].n.toLowerCase()}` });
  return a;
}
// a pessoa já existe: só acerta o papel
function syncAgent(nome, papel) {
  const a = agentByRef(nome);
  if (!a) return addAgentLive(nome, papel);
  if (ROLES[papel] && a.role !== papel) { a.role = papel; const p = personOf(a); if (p) { p.role = papel; try { save(); } catch (e) {} } teamHTML = ''; }
  return a;
}
