'use strict';

/* ---------- Fonte: arquivo de eventos (reprodução) ---------- */
function loadReplay(text) {
  let list = [];
  const trimmed = text.trim();
  if (trimmed.startsWith('[')) list = JSON.parse(trimmed);
  else list = trimmed.split(/\n+/).filter(Boolean).map(l => JSON.parse(l));
  let t0 = null;
  list = list.map((e, i) => {
    let t = typeof e.t === 'number' ? e.t : (e.ts || e.time) ? Date.parse(e.ts || e.time) / 1000 : i * 3;
    if (t0 == null) t0 = t; return { ...e, _t: t - t0 };
  }).sort((p, q) => p._t - q._t);
  sim.replay = { events: list, i: 0, t: 0 };
  return list.length;
}
function replayTick(dt) {
  const r = sim.replay; if (!r) return; r.t += dt;
  while (r.i < r.events.length && r.events[r.i]._t <= r.t) applyEvent({ ...r.events[r.i++], source: 'arquivo' });
  if (r.i >= r.events.length && !r.ended) { r.ended = true; toast('Fim do arquivo de eventos'); }
}
