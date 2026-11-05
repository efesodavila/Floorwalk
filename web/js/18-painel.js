'use strict';

/* ---------- Painel ---------- */
const body = $('#panel-body');
function setTab(t) {
  tab = t; placing = null; walling = null; picking = null; if (t !== 'planta') tool = 'select';
  if (t !== 'pessoas') editing = null;
  document.querySelectorAll('.tabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === t)));
  body.innerHTML = ''; renderPanel(); renderBanner(); renderCtx(); dirty();
}
document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => setTab(b.dataset.tab));

function renderPanel() {
  if (tab === 'planta') { body.innerHTML = plantaHTML(); bindPlanta(); }
  else if (tab === 'elementos') { if (!body.querySelector('#search')) { body.innerHTML = elementosHTML(); bindElementos(); } else renderCards(); }
  else { body.innerHTML = pessoasHTML(); bindPessoas(); }
}
function plantaHTML() {
  const b = bounds(), w = b.x1 - b.x0, d = b.z1 - b.z0;
  const side = (s, arrow, cls) => `<div class="side ${cls}"><button type="button" data-shrink="${s}" aria-label="Diminuir para ${arrow}">−</button><span aria-hidden="true">${arrow}</span><button type="button" data-grow="${s}" aria-label="Aumentar para ${arrow}">+</button></div>`;
  const toolBtn = (id, icon, label) => `<button type="button" data-tool="${id}" aria-pressed="${tool === id}">${icon}${label}</button>`;
  const mats = Object.entries(MATS).map(([k, m]) => `<button type="button" class="mat" data-mat="${k}" aria-pressed="${matMode === 'all' ? W.floorMat === k : brushMat === k}"><img src="${MTHUMBS[k]}" alt="">${m.n}</button>`).join('');
  const walls = WALLS.map(([c, n]) => `<button type="button" class="sw" data-wall="${c}" title="${n}" aria-label="Paredes da sala: ${n}" aria-pressed="${W.wall === c}" style="background:${c}"></button>`).join('');
  return `
  <section><h3>Tamanho da sala</h3>
    <p class="hint">Use + e − em cada lado, ou clique nos botões + roxos nas bordas da sala.</p>
    <div class="sizer">
      ${side('x-', '↖', 's-nw')}${side('z-', '↗', 's-ne')}
      <div class="dim">${w} × ${d}<small>quadrados · máx. ${MAXS} × ${MAXS}</small></div>
      ${side('z+', '↙', 's-sw')}${side('x+', '↘', 's-se')}
    </div>
  </section>
  <section><h3>Piso</h3>
    <div class="seg" role="group" aria-label="Onde aplicar o piso">
      <button type="button" data-matmode="all" aria-pressed="${matMode === 'all'}">Na sala toda</button>
      <button type="button" data-matmode="brush" aria-pressed="${matMode === 'brush'}">Só onde eu pintar</button>
    </div>
    ${matMode === 'brush' ? '<p class="hint">Escolha o piso e arraste sobre a sala para pintar só aquela área.</p>' : ''}
    <div class="mats">${mats}</div>
  </section>
  <section><h3>Cor das paredes da sala</h3><div class="swatches">${walls}</div></section>
  <section><h3>Paredes internas e divisórias</h3>
    <p class="hint">Para dividir a sala em ambientes: paredes, portas, vidro, ripado e painéis.</p>
    <button type="button" class="link-card" id="go-walls"><img src="${THUMBS['w:porta']}" alt=""><span><b>Abrir paredes e divisórias</b><small>8 tipos, em Elementos</small></span></button>
  </section>
  <section><h3>Formato livre</h3>
    <p class="hint">${tool === 'add' ? 'Arraste sobre os pontos da grade para criar piso novo, em qualquer formato.' : tool === 'remove' ? 'Arraste sobre o piso para tirar quadrados.' : 'Para salas em L ou com recortes, desenhe o piso à mão.'}</p>
    <div class="tools">${toolBtn('add', IC.brush, 'Acrescentar piso')}${toolBtn('remove', IC.erase, 'Remover piso')}</div>
  </section>`;
}
function bindPlanta() {
  body.querySelectorAll('[data-grow]').forEach(b => b.onclick = () => grow(b.dataset.grow, 1));
  body.querySelectorAll('[data-shrink]').forEach(b => b.onclick = () => grow(b.dataset.shrink, -1));
  body.querySelectorAll('[data-tool]').forEach(b => b.onclick = () => { tool = tool === b.dataset.tool ? 'select' : b.dataset.tool; selected = null; renderPanel(); renderBanner(); renderCtx(); dirty(); });
  body.querySelectorAll('[data-matmode]').forEach(b => b.onclick = () => { matMode = b.dataset.matmode; if (matMode === 'brush') tool = 'mat'; else if (tool === 'mat') tool = 'select'; renderPanel(); renderBanner(); dirty(); });
  body.querySelectorAll('[data-mat]').forEach(b => b.onclick = () => { const m = b.dataset.mat; if (matMode === 'all') applyMatAll(m); else { brushMat = m; tool = 'mat'; renderPanel(); renderBanner(); } });
  body.querySelectorAll('[data-wall]').forEach(b => b.onclick = () => change(() => { W.wall = b.dataset.wall; }, `Paredes da sala: ${WALLS.find(w => w[0] === b.dataset.wall)[1]}`));
  body.querySelector('#go-walls').onclick = () => { filterCat = 'paredes'; query = ''; setTab('elementos'); };
}
function elementosHTML() {
  const chips = ['todos', ...CATS].map(c => `<button type="button" data-cat="${c}" aria-pressed="${filterCat === c}">${CHIPLABEL[c]}</button>`).join('');
  return `<section><h3>Catálogo</h3>
    <p class="hint">Móveis: clique no card e depois na sala. Paredes: clique no card e arraste na sala. Para mudar algo de lugar, arraste na sala.</p>
    <div class="search-wrap">${IC.search}<input id="search" class="search" type="search" placeholder="Buscar: parede, sofá, mesa…" value="${query.replace(/"/g, '&quot;')}" aria-label="Buscar elemento"></div>
    <div class="chips" role="group" aria-label="Filtrar por tipo">${chips}</div>
  </section><div id="cards"></div>`;
}
function norm(s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
function catalog() {
  const list = [];
  for (const [k, K] of Object.entries(WALLKINDS)) list.push({ id: 'w:' + k, n: K.n, sub: K.d, cat: 'paredes', words: 'parede divisoria muro ' + K.n + ' ' + K.d });
  for (const [k, it] of Object.entries(ITEMS)) list.push({ id: k, n: it.n, sub: `${it.w} × ${it.d} quadrados`, cat: it.cat, words: it.n + ' ' + it.cat });
  return list;
}
function renderCards() {
  const el = body.querySelector('#cards'); if (!el) return;
  const q = norm(query.trim());
  const list = catalog().filter(c => (filterCat === 'todos' || c.cat === filterCat) && (!q || norm(c.words).includes(q)));
  if (!list.length) { el.innerHTML = `<p class="empty">Nada encontrado para "${query}". Tente outra palavra ou escolha "Todos".</p>`; }
  else {
    el.innerHTML = CATS.filter(cat => list.some(c => c.cat === cat)).map(cat => `<div class="group-title">${CATLABEL[cat]}</div><div class="cards">${list.filter(c => c.cat === cat).map(c => {
      const active = c.id.startsWith('w:') ? walling?.kind === c.id.slice(2) : placing?.item === c.id;
      return `<button type="button" class="card" data-item="${c.id}" aria-pressed="${active}"><img src="${THUMBS[c.id]}" alt=""><b>${c.n}</b><small>${c.sub}</small></button>`;
    }).join('')}</div>`).join('');
  }
  el.querySelectorAll('[data-item]').forEach(b => b.onclick = () => {
    const id = b.dataset.item; selected = null;
    if (id.startsWith('w:')) { const k = id.slice(2); walling = walling?.kind === k ? null : { kind: k }; placing = null; }
    else { placing = placing?.item === id ? null : { item: id, rot: 0 }; walling = null; }
    renderCards(); renderBanner(); renderCtx(); dirty();
  });
  body.querySelectorAll('[data-cat]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.cat === filterCat)));
}
function bindElementos() {
  const s = body.querySelector('#search'); s.oninput = () => { query = s.value; renderCards(); };
  body.querySelectorAll('[data-cat]').forEach(b => b.onclick = () => { filterCat = b.dataset.cat; renderCards(); });
  renderCards();
}
// papel que só as sessões de fora usam (ex.: "Claude Code"): não é opção para uma pessoa fixa da sala
const extOnlyRole = (k) => W.people.some(q => q.ext && q.role === k) && !W.people.some(q => !q.ext && q.role === k);
function pessoasHTML() {
  const p = editing && W.people.find(q => q.id === editing);
  if (p) {
    const sw = (field, list, label) => `<div><span class="field-label">${label}</span><div class="swatches">${list.map(c => `<button type="button" class="sw" data-f="${field}" data-c="${c}" aria-label="${label} ${c}" aria-pressed="${p[field] === c}" style="background:${c}"></button>`).join('')}</div></div>`;
    const chips = (field, list, label) => `<div><span class="field-label">${label}</span><div class="looks">${list.map(([k, n]) => `<button type="button" data-style="${field}" data-v="${k}" aria-pressed="${p[field] === k}">${n}</button>`).join('')}</div></div>`;
    const ex = p.extras || {};
    return `<div class="editor">
      <button type="button" class="back" id="back">← Todas as pessoas</button>
      <img class="preview" src="${fullAvatar(p, 5)}" alt="Prévia de ${escapeHTML(p.name)}">
      <div class="row" style="justify-content:center"><button type="button" id="rand">Visual aleatório</button><button type="button" id="locate">Mostrar na sala</button></div>
      <div><label class="field-label" for="pname">Nome do agente</label><input id="pname" class="text" maxlength="16" value="${p.name.replace(/"/g, '&quot;')}"></div>
      <p class="hint" style="margin:-6px 0 0">Os eventos encontram o agente por esse nome.</p>
      <div><span class="field-label">Papel</span><div class="looks">${Object.entries(ROLES).filter(([k]) => k === p.role || !extOnlyRole(k)).map(([k, r]) => `<button type="button" data-role="${k}" aria-pressed="${p.role === k}">${r.n}</button>`).join('')}</div></div>
      ${sw('skin', SKIN, 'Pele')}
      ${chips('gender', GENDERS, 'Gênero')}
      ${chips('hairStyle', HAIRSTYLES.filter(([k]) => HAIR_G[genderOf(p)].includes(k)), 'Cabelo')}${sw('hair', HAIR, 'Cor do cabelo')}
      ${chips('top', TOPS, 'Roupa')}${sw('shirt', SHIRT, 'Cor da roupa')}
      ${sw('pants', PANTS, 'Calça')}${sw('shoes', SHOES, 'Sapato')}
      <div><span class="field-label">Acessórios</span><div class="looks">${EXTRAS.filter(([k]) => k !== 'barba' || genderOf(p) === 'm').map(([k, n]) => `<button type="button" data-extra="${k}" aria-pressed="${!!ex[k]}">${n}</button>`).join('')}</div></div>
      <p class="hint" style="margin:0">Para mudar ${escapeHTML(p.name)} de lugar, arraste na sala e solte onde quiser.</p>
      <div class="row"><button type="button" class="danger" id="rm">${IC.trash}Remover ${escapeHTML(p.name)}</button></div>
    </div>`;
  }
  const items = W.people.map(q => `<li class="person"><img src="${avatar(q, 3)}" alt=""><div><b>${q.name}</b><span class="tag" style="color:${ROLES[q.role]?.c}">${ROLES[q.role]?.n || 'Sem papel'}</span></div><button type="button" data-edit="${q.id}">Editar</button></li>`).join('');
  return `<section><h3>Agentes</h3><p class="hint">Cada pessoa representa um agente do projeto. O tipo do papel decide para onde ela vai (por exemplo, quem está bloqueado procura quem coordena). Arraste na sala para mudar o lugar de partida.</p>
    ${items ? `<ul class="people">${items}</ul>` : '<p class="empty">Ninguém na equipe ainda.</p>'}
    <button type="button" class="primary" id="add-person" style="width:100%">${IC.plus}Adicionar pessoa</button></section>
    <section><h3>Ver os agentes trabalhando</h3><p class="hint">No modo Ao vivo, cada evento de um agente vira uma ação na sala: ir para a mesa, para o quadro, para a reunião.</p>
    <button type="button" id="go-live" style="width:100%"><svg class="i" viewBox="0 0 20 20"><path d="M6 4.5v11l9-5.5z"/></svg>Abrir Ao vivo</button></section>`;
}
function freeSpotNear(x, z) {
  const sol = solidBoxes();
  for (let r = 0; r < 12; r += .5) for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, px = Math.round((x + Math.cos(a) * r) * 4) / 4, pz = Math.round((z + Math.sin(a) * r) * 4) / 4; if (freePoint(px, pz, sol)) return [px, pz]; }
  return [x, z];
}
function bindPessoas() {
  const add = body.querySelector('#add-person');
  if (add) {
    add.onclick = () => {
      const used = new Set(W.people.map(p => p.name)), name = NAMES.find(n => !used.has(n)) || 'Pessoa ' + (W.people.length + 1);
      const b = bounds(), id = nid('p'), pos = freeSpotNear((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2);
      change(() => W.people.push({ id, name, ...randomLook(genderOfName(name)), role: defaultRole(), pos }), `${name} entrou na equipe. Arraste para onde quiser.`);
      editing = id; renderPanel(); dirty();
    };
    body.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => { editing = b.dataset.edit; renderPanel(); dirty(); });
    body.querySelector('#go-live').onclick = () => setMode('live');
    return;
  }
  const p = W.people.find(q => q.id === editing);
  body.querySelector('#back').onclick = () => { editing = null; renderPanel(); dirty(); };
  const nameEl = body.querySelector('#pname'); let before = null;
  nameEl.onfocus = () => { before = snapshot(); };
  nameEl.oninput = () => { p.name = nameEl.value || 'Sem nome'; save(); dirty(); };
  nameEl.onblur = () => { if (before) pushBefore(before); before = null; };
  body.querySelectorAll('[data-f]').forEach(b => b.onclick = () => change(() => { W.people.find(q => q.id === editing)[b.dataset.f] = b.dataset.c; }));
  body.querySelectorAll('[data-role]').forEach(b => b.onclick = () => change(() => { W.people.find(q => q.id === editing).role = b.dataset.role; }, `Papel: ${ROLES[b.dataset.role].n}`));
  body.querySelectorAll('[data-style]').forEach(b => b.onclick = () => change(() => {
    const q = W.people.find(r => r.id === editing); q[b.dataset.style] = b.dataset.v;
    // trocou o gênero: penteado e barba acompanham
    if (b.dataset.style === 'gender') {
      if (!HAIR_G[q.gender].includes(q.hairStyle)) q.hairStyle = HAIR_G[q.gender][0];
      if (q.gender === 'f') q.extras = { ...(q.extras || {}), barba: false };
    }
  }));
  body.querySelectorAll('[data-extra]').forEach(b => b.onclick = () => change(() => { const q = W.people.find(r => r.id === editing); q.extras = { ...(q.extras || {}), [b.dataset.extra]: !q.extras?.[b.dataset.extra] }; }));
  body.querySelector('#rand').onclick = () => change(() => { const q = W.people.find(r => r.id === editing); Object.assign(q, randomLook(genderOf(q))); }, 'Visual sorteado');
  body.querySelector('#locate').onclick = () => {
    const A = sceneArea(), [sx, sy] = iso(p.pos[0], p.pos[1], 1); view.cx += (A.x0 + A.x1) / 2 - sx; view.cy += (A.y0 + A.y1) / 2 - sy; dirty();
  };
  const rm = body.querySelector('#rm');
  rm.onclick = () => {
    if (!rm.classList.contains('armed')) { rm.classList.add('armed'); rm.textContent = 'Clique de novo para remover'; setTimeout(() => { if (rm.isConnected) { rm.classList.remove('armed'); rm.innerHTML = `${IC.trash}Remover ${escapeHTML(p.name)}`; } }, 3000); return; }
    const id = editing, nm = p.name; editing = null;
    change(() => { W.people = W.people.filter(q => q.id !== id); }, `${nm} saiu da equipe`);
  };
}
