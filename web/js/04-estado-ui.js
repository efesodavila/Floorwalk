'use strict';

/* ---------- Estado de interface ---------- */
let tab = 'planta', tool = 'select', matMode = 'all', brushMat = 'madeira_clara';
let placing = null, walling = null, selected = null, picking = null, editing = null, filterCat = 'todos', query = '';
let hover = null, drag = null, spaceHeld = false, popMode = null, hoverHandle = null;
let mode = 'build', NAV = null;
const MISSIONS = [];
const sim = { playing: false, speed: 1, clock: 0, agents: [], reserved: new Map(), groups: new Map(), feed: [], names: true, following: null, playedFor: 0, source: 'demo', replay: null, wsUrl: '', wsState: '' };

function validateSel() {
  if (selected?.type === 'obj' && !objById(selected.id)) selected = null;
  if (selected?.type === 'wall' && !wallById(selected.id)) selected = null;
  if (editing && !W.people.find(p => p.id === editing)) editing = null;
}
