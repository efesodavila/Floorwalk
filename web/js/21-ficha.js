'use strict';

/* ---------- Ficha do agente: abre ao clicar no personagem ---------- */
const ficha = $('#ficha');
let fichaHTML = '', fichaAll = false;
function histPush(a, e) { (a.hist ||= []).unshift({ t: sim.clock, ...e }); if (a.hist.length > 80) a.hist.pop(); }
function fmtDur(s) { s = Math.max(0, Math.floor(s)); if (s < 60) return `${s}s`; const m = Math.floor(s / 60); return m < 60 ? `${m} min ${s % 60}s` : `${Math.floor(m / 60)} h ${m % 60} min`; }
function whereOf(a) {
  if (a.held) return 'Sendo movido por você';
  if (a.pinned) return 'Parado onde você deixou';
  if (a.spot) { const name = objName(a.spot); return a.mv === 'act' ? name : `A caminho: ${name}`; }
  if (a.intent?.kind === 'point') return a.mv === 'act' ? (a.decision || 'Ao lado de outra pessoa') : 'A caminho';
  return a.mv === 'walk' ? 'Andando pela sala' : 'Em pé';
}
function openFicha(id) { sim.inspect = id; fichaPos = null; fichaHTML = ''; $('#feed').hidden = true; fichaAll = false; renderFicha(); placeFicha(); teamHTML = ''; renderTeam(); }
function closeFicha() { sim.inspect = null; ficha.hidden = true; $('#feed').hidden = mode !== 'live'; fichaHTML = ''; teamHTML = ''; renderTeam(); }
