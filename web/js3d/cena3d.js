// Cena 3D do Pixel HQ — mesma técnica do Pixel Moda:
// sombreamento em 3 faixas, luz de céu + sol com sombras, contorno por pós-processamento
// (profundidade + normais), bloom nos brilhos, texturas 16×16 e câmera presa à grade de pixels.
//
// Lê os mesmos dados do desenho 2D (W, ITEMS, worldBoxes, segBoxes, animBox, peopleDrawables).
// Personagens: modelos GLB de web/modelos/ (personagens3d-meshy.js), repintados com a aparência de cada pessoa;
// sem eles, personagens low-poly feitos em código (personagens3d-lowpoly.js).
// É o padrão quando a página roda com o servidor; sem WebGL, volta sozinho para o 2D.
// Vale para o modo ao vivo; a edição da sala continua no desenho 2D.
// Mouse: arrastar move · roda aproxima (na direção do cursor) · botão direito ou Shift + arrastar gira.

const pref = (() => { try { return localStorage.getItem('pixelhq.3d'); } catch { return null; } })();
const qs = new URLSearchParams(location.search);
const WANT = qs.has('3d') || (!qs.has('2d') && pref !== '0' && !!window.PIXELHQ_BRIDGE);
window.R3D = { active: () => false, wanted: WANT, stats: { fps: 0 } };
if (WANT) start().catch((e) => {
  console.error('[3d]', e);
  window.R3D = { active: () => false, wanted: false, stats: { fps: 0 } };
  document.getElementById('scene').style.visibility = 'visible';
  toast('Visual 3D indisponível neste navegador (' + e.message + '). Usando o 2D.');
});

async function start() {
  const THREE = await import('three');
  const { EffectComposer } = await import('three/addons/postprocessing/EffectComposer.js');
  const { Pass, FullScreenQuad } = await import('three/addons/postprocessing/Pass.js');
  const { UnrealBloomPass } = await import('three/addons/postprocessing/UnrealBloomPass.js');
  const { OutputPass } = await import('three/addons/postprocessing/OutputPass.js');
  const { SMAAPass } = await import('three/addons/postprocessing/SMAAPass.js');
  const { RoundedBoxGeometry } = await import('three/addons/geometries/RoundedBoxGeometry.js');
  const { mergeGeometries, mergeVertices } = await import('three/addons/utils/BufferGeometryUtils.js');
  // linha visual dos personagens: meshy (padrão: modelos gerados com acessórios) | lowpoly (?estilo=lowpoly)
  const ESTILOS = { lowpoly: './personagens3d-lowpoly.js', meshy: './personagens3d-meshy.js' };
  // se os modelos do padrão não carregarem (arquivo ausente, rede), cai para o low-poly feito em código
  let characterKit, kitArgs;
  try { ({ characterKit } = await import(ESTILOS[qs.get('estilo')] || ESTILOS.meshy)); }
  catch (e) { console.warn('[3D] estilo de personagem indisponível, usando low-poly:', e); ({ characterKit } = await import(ESTILOS.lowpoly)); }
  const { RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js');

  /* ---------- tamanho do pixel ----------
     1 (padrão) = modo nítido: desenha na resolução real da tela (até 2×), com bordas suavizadas (SMAA),
     sombras suaves e texturas filtradas de longe. 2 a 4 (?px=) = visual pixel art do Pixel Moda. */
  const PX = Math.min(4, Math.max(1, Number(qs.get('px')) || 1));
  const SMOOTH = PX === 1, DPR = SMOOTH ? Math.min(2, devicePixelRatio || 1) : 1;

  /* ---------- renderizador ---------- */
  const scene2d = document.getElementById('scene');
  const canvas = document.createElement('canvas');
  canvas.id = 'scene3d'; canvas.setAttribute('aria-label', 'Escritório em 3D');
  scene2d.after(canvas);
  // camada 2D por cima do 3D: nomes, ícones de estado e anel de seleção (texto nítido)
  const ui = document.createElement('canvas'); ui.id = 'scene3d-ui'; canvas.after(ui);
  const uctx = ui.getContext('2d');
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false }); }
  catch { canvas.remove(); ui.remove(); throw new Error('sem WebGL'); }
  renderer.setPixelRatio(1);
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = SMOOTH ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  const BG = new THREE.Color('#E9E8EB');
  scene.background = BG.clone();

  /* ---------- materiais (com cache) ---------- */
  const gradientMap = (() => { const t = new THREE.DataTexture(new Uint8Array([150, 215, 255]), 3, 1, THREE.RedFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true; return t; })();
  const mats = new Map();
  const toon = (color, map) => { const k = 't' + color + (map ? map.uuid : ''); if (!mats.has(k)) mats.set(k, new THREE.MeshToonMaterial({ color: new THREE.Color(color), gradientMap, map: map || null })); return mats.get(k); };
  const glowList = [];
  // brilho: cor acima de 1 + bloom. dim = tela em descanso
  const glow = (color, dim = false) => {
    const k = (dim ? 'gd' : 'g') + color;
    if (!mats.has(k)) { const base = new THREE.Color(color), m = new THREE.MeshBasicMaterial({ color: base.clone(), toneMapped: false }); glowList.push({ m, base, dim }); mats.set(k, m); }
    return mats.get(k);
  };
  const glassMat = new THREE.MeshBasicMaterial({ color: '#BFE4EF', transparent: true, opacity: .24, depthWrite: false, side: THREE.DoubleSide });
  const steamMat = new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: .6, depthWrite: false });
  const matFor = (b, screenOn) => b.glass ? glassMat : b.g ? glow(b.g, b.screen && !screenOn) : toon(String(b.c || '#888888'));

  /* ---------- geometria ---------- */
  const geos = new Map();
  function rbox(w, h, d) {
    const k = `${w.toFixed(3)},${h.toFixed(3)},${d.toFixed(3)}`;
    if (!geos.has(k)) { const r = Math.min(.03, w / 2 - .002, h / 2 - .002, d / 2 - .002); geos.set(k, r > .006 ? new RoundedBoxGeometry(w, h, d, 2, r) : new THREE.BoxGeometry(w, h, d)); }
    return geos.get(k);
  }
  // paredes: caixa reta (cantos arredondados deixariam emendas visíveis entre os trechos)
  const box = (w, h, d) => { const k = `b${w},${h},${d}`; if (!geos.has(k)) geos.set(k, new THREE.BoxGeometry(w, h, d)); return geos.get(k); };
  const unit = new THREE.BoxGeometry(1, 1, 1);
  // agrupa caixas por material e junta numa malha só (uma chamada de desenho por material)
  function batcher() {
    const groups = new Map();
    return {
      add(geo, mat, x, y, z) {
        const g = (geo.index ? geo.toNonIndexed() : geo.clone()).translate(x, y, z);
        for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
        if (!groups.has(mat)) groups.set(mat, []); groups.get(mat).push(g);
      },
      flush(parent, { shadows = true, layer = 0 } = {}) {
        for (const [mat, list] of groups) {
          const m = new THREE.Mesh(mergeGeometries(list, false), mat);
          m.castShadow = shadows; m.receiveShadow = true; m.matrixAutoUpdate = false; m.updateMatrix(); m.layers.set(layer);
          parent.add(m); list.forEach(g => g.dispose());
        }
        groups.clear();
      },
    };
  }

  /* ---------- texturas de piso 16×16 (a partir dos materiais do catálogo) ---------- */
  const floorTex = new Map();
  function floorTexture(name) {
    if (floorTex.has(name)) return floorTex.get(name);
    const M = MATS[name] || MATS.lilas, c = document.createElement('canvas'); c.width = c.height = 16; const g = c.getContext('2d');
    const px = (col, x, y, w = 1, h = 1) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    px(M.b, 0, 0, 16, 16);
    if (M.k === 'wood') { for (let y = 1; y < 16; y += 4) px(M.a, 0, y, 16, 1); for (let y = 3; y < 16; y += 4) px(M.l, 0, y, 16, 1); px(M.l, 6, 0, 1, 4); px(M.l, 11, 8, 1, 4); }
    else if (M.k === 'checker') { px(M.a, 0, 0, 8, 8); px(M.a, 8, 8, 8, 8); }
    else if (M.k === 'speck') { for (let i = 0; i < 14; i++) px(i % 2 ? M.a : M.l, (i * 7) % 16, (i * 11) % 16); }
    else { px(M.a, 1, 1, 14, 1); px(M.a, 1, 1, 1, 14); for (let i = 0; i < 6; i++) px(M.a, 3 + ((i * 7) % 11), 4 + ((i * 5) % 10)); px(M.l, 0, 0, 16, 1); px(M.l, 0, 0, 1, 16); }
    const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace;
    // de perto: o desenho do ladrilho, pixel a pixel; de longe (modo nítido): filtrado, para não cintilar
    if (SMOOTH) { t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); }
    else { t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; }
    floorTex.set(name, t); return t;
  }

  /* ---------- luz ---------- */
  const hemi = new THREE.HemisphereLight(0xFFFFFF, 0xCFC2EC, 1.35);
  const sun = new THREE.DirectionalLight(0xFFE3C2, 1.6);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -.0008; sun.shadow.normalBias = .06; // evita "acne" (listras) nas paredes em ângulo raso
  sun.shadow.camera.layers.enable(5); // sombras dos personagens (cilindros invisíveis na camada 5)
  scene.add(hemi, sun, sun.target);

  /* ---------- montagem do mundo ---------- */
  // estático: juntado por material. Animado (telas, LEDs, kanban, papel, plantas, portas): malhas próprias, atualizadas por quadro
  const ANIM = (b) => b.screen || b.led != null || b.blink || b.pulse || b.paper || b.sway || b.note != null || b.bar != null || b.steam;
  let world = new THREE.Group(), wallGroups = [], room = { cx: 8, cz: 5.5, span: 20 };
  let animated = [], kanbans = [], doors = [], steams = [];
  scene.add(world);
  const center = (b) => [b.x + b.w / 2, b.y + b.h / 2, b.z + b.d / 2];
  function rebuild() {
    scene.remove(world); world.traverse(o => { if (o.isMesh && o.geometry !== unit) o.geometry.dispose(); });
    world = new THREE.Group(); scene.add(world); wallGroups = []; animated = []; kanbans = []; doors = []; steams = [];
    const b = bounds(), B = batcher(), has = (x, z) => !!W.tiles[key(x, z)];
    room = { cx: (b.x0 + b.x1) / 2, cz: (b.z0 + b.z1) / 2, span: Math.hypot(b.x1 - b.x0, b.z1 - b.z0) };
    // piso (um plano texturizado por quadrado) e laje um pouco abaixo (na mesma altura os dois "brigam" pelo pixel)
    const tile = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    for (const [k, m] of Object.entries(W.tiles)) {
      const [x, z] = k.split(',').map(Number);
      B.add(tile, toon('#FFFFFF', floorTexture(m)), x + .5, .001, z + .5);
      B.add(box(1, .45, 1), toon('#D3C9CE'), x + .5, -.245, z + .5);
    }
    B.flush(world, { shadows: false });
    // paredes do fundo (as que ficam entre a câmera e a sala baixam ao girar a vista)
    const wc = W.wall, cap = shade(wc, 1.12), sides = { z: new THREE.Group(), x: new THREE.Group() }, T = .14, WB = batcher(), XB = batcher();
    for (const k in W.tiles) {
      const [x, z] = k.split(',').map(Number);
      if (!has(x, z - 1)) { WB.add(box(1, WH, T), toon(wc), x + .5, WH / 2, z - T / 2); WB.add(box(1, .06, T + .02), toon(cap), x + .5, WH, z - T / 2); }
      if (!has(x - 1, z)) { XB.add(box(T, WH, 1), toon(shade(wc, .94)), x - T / 2, WH / 2, z + .5); XB.add(box(T + .02, .06, 1), toon(cap), x - T / 2, WH, z + .5); }
    }
    WB.flush(sides.z); XB.flush(sides.x); world.add(sides.z, sides.x); wallGroups = [sides.z, sides.x];
    // móveis e divisórias
    const rest = batcher(), glassOnly = batcher();
    const addStatic = (bx) => {
      if (bx.w <= 0 || bx.h <= 0 || bx.d <= 0) return;
      const [x, y, z] = center(bx);
      (bx.glass ? glassOnly : rest).add(rbox(bx.w, Math.max(bx.h, .004), bx.d), matFor(bx, true), x, y, z);
    };
    for (const o of W.objects) {
      const it = ITEMS[o.item]; if (!it) continue;
      if (it.dyn === 'kanban') { const g = new THREE.Group(); world.add(g); kanbans.push({ o, g, sig: '' }); continue; }
      for (const bx of worldBoxes(o)) {
        if (!ANIM(bx)) { addStatic(bx); continue; }
        if (bx.steam) { addStatic(bx); steams.push({ b: bx, parts: [0, 1, 2, 3].map(() => { const m = new THREE.Mesh(unit, steamMat); m.layers.set(1); world.add(m); return m; }) }); continue; }
        const m = new THREE.Mesh(unit, matFor(bx, false)); m.castShadow = !bx.g; m.receiveShadow = true; world.add(m); animated.push({ b: bx, m });
      }
    }
    for (const s of W.walls) {
      if (s.kind === 'porta' || s.kind === 'vidro_porta') { const g = new THREE.Group(); world.add(g); doors.push({ s, g, open: -1 }); continue; }
      for (const bx of segBoxes(s, null, 0)) addStatic(bx);
    }
    rest.flush(world); glassOnly.flush(world, { shadows: false, layer: 1 });
    // sol e sombra ajustados ao tamanho da sala
    const c = new THREE.Vector3(room.cx, 0, room.cz), dir = new THREE.Vector3(-11, 19, 15).normalize();
    sun.position.copy(c).addScaledVector(dir, room.span * 1.6); sun.target.position.copy(c);
    const sc = sun.shadow.camera, r = room.span * .75; sc.left = -r; sc.right = r; sc.top = r; sc.bottom = -r; sc.near = 1; sc.far = room.span * 4; sc.updateProjectionMatrix();
  }
  // grupo pequeno refeito quando muda (quadro kanban, portas)
  function refill(g, boxes) {
    g.traverse(o => { if (o.isMesh) o.geometry.dispose(); }); g.clear();
    const opaque = batcher(), glass = batcher();
    for (const bx of boxes) { if (bx.w <= 0 || bx.h <= 0 || bx.d <= 0) continue; const [x, y, z] = center(bx); (bx.glass ? glass : opaque).add(rbox(bx.w, Math.max(bx.h, .004), bx.d), matFor(bx, true), x, y, z); }
    opaque.flush(g); glass.flush(g, { shadows: false, layer: 1 });
  }

  /* ---------- animações dos móveis (as mesmas regras do 2D, via animBox) ---------- */
  function updateAnimations(T) {
    ACTIVE = computeActive();
    for (const { b, m } of animated) {
      const a = animBox(b, T);
      const on = b.screen ? ACTIVE.has(b.obj) : true;
      m.material = matFor(a, on);
      m.scale.set(Math.max(a.w, .001), Math.max(a.h, .001), Math.max(a.d, .001));
      m.position.set(a.x + a.w / 2, a.y + a.h / 2, a.z + a.d / 2);
    }
    for (const k of kanbans) {
      const boxes = worldBoxes(k.o).map(bx => animBox(bx, T)), sig = boxes.length + ':' + boxes.map(bx => bx.y.toFixed(2)).join(',');
      if (sig !== k.sig) { k.sig = sig; refill(k.g, boxes); }
    }
    for (const d of doors) {
      const open = Math.round((DOORS.get(d.s.id) || 0) * 20) / 20;
      if (open !== d.open) { d.open = open; refill(d.g, segBoxes(d.s, null, open)); }
    }
    for (const s of steams) {
      const on = ACTIVE.has(s.b.obj), top = s.b.y + s.b.h, cx = s.b.x + s.b.w / 2, cz = s.b.z + s.b.d / 2;
      s.parts.forEach((m, k) => {
        m.visible = on; if (!on) return;
        const ph = (T * .55 + k / 4) % 1, r = .05 * (1 + ph * 1.5);
        m.position.set(cx + Math.sin(T * 2 + k) * .08, top + ph * 1.1, cz); m.scale.setScalar(r);
      });
      steamMat.opacity = .55;
    }
  }

  /* ---------- personagens 3D (aparência do Pixel HQ, estilo do Pixel Moda) ---------- */
  let kit;
  try { kit = await characterKit({ THREE, RoundedBoxGeometry, mergeGeometries, mergeVertices, gradientMap }); }
  catch (e) { console.warn('[3D] modelos de personagem não carregaram, usando low-poly:', e); kit = await (await import(ESTILOS.lowpoly)).characterKit({ THREE, RoundedBoxGeometry, mergeGeometries, mergeVertices, gradientMap }); }
  // luz de ambiente só nos materiais dos personagens (o cenário continua no sombreado "toon")
  if (kit.setEnv) { const pm = new THREE.PMREMGenerator(renderer); kit.setEnv(pm.fromScene(new RoomEnvironment(), .04).texture, .35); pm.dispose(); }
  // retratos das listas (Equipe, ficha, cartões) feitos com o próprio modelo 3D, em vez do sprite 2D.
  // Renderizador pequeno e separado; o resultado (PNG) fica em cache por aparência. Sem 3D, continua o 2D.
  {
    const pr = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    pr.outputColorSpace = THREE.SRGBColorSpace; pr.setPixelRatio(1);
    const ps = new THREE.Scene();
    ps.add(new THREE.HemisphereLight(0xFFFFFF, 0xCFC2EC, 1.5));
    const pl = new THREE.DirectionalLight(0xFFE3C2, 1.7); pl.position.set(1.5, 3, 4); ps.add(pl);
    const pc = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 20);
    const cache = new Map(), avatar2d = window.avatar, full2d = window.fullAvatar;
    const shot = (p, w, h, full) => {
      const key = kit.lookKey(p) + (full ? 'F' : 'H') + w;
      if (cache.has(key)) return cache.get(key);
      const v = kit.build(p); kit.pose(v, { sit: false, moving: false, act: null }, 0, 0); kit.pose(v, { sit: false, moving: false, act: null }, 1, 0);
      v.root.rotation.y = .35; ps.add(v.root); v.root.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(v.root), top = b.max.y, H = top - b.min.y;
      // busto: da cintura para cima; corpo inteiro: tudo
      const y0 = full ? b.min.y - H * .03 : top - H * .62, y1 = top + H * .03, hh = (y1 - y0) / 2, cy = (y0 + y1) / 2, hw = hh * w / h;
      Object.assign(pc, { left: -hw, right: hw, top: hh, bottom: -hh }); pc.updateProjectionMatrix();
      pc.position.set(0, cy + .25, 6); pc.lookAt(0, cy, 0);
      pr.setSize(w, h, false); pr.setClearColor(0x000000, 0); pr.render(ps, pc);
      const url = pr.domElement.toDataURL('image/png');
      ps.remove(v.root); kit.dispose(v); cache.set(key, url); return url;
    };
    window.avatar = (p, s = 3) => { try { return shot(p, 24 * s, 28 * s, false); } catch (e) { return avatar2d(p, s); } };
    window.fullAvatar = (p, s = 4) => { try { return shot(p, 36 * s, 60 * s, true); } catch (e) { return full2d(p, s); } };
    document.body.classList.add('r3d-avatars');
    // listas já desenhadas com o retrato 2D: redesenha
    try { if (typeof renderPanel === 'function') renderPanel(); if (typeof renderCards === 'function') renderCards(); } catch {}
  }
  // contorno dos personagens: ligado por padrão; ?contorno=0 desliga (para comparar)
  const CHAR_OUTLINE = qs.get('contorno') !== '0';
  const people = new Map(); // id → { v (modelo), visible, headY }
  const WALK = new Set(['walk', 'approach', 'leave']);
  const HANDS = new Set(['cook', 'stock', 'sell', 'craft', 'care', 'attend', 'print', 'infra', 'record', 'coffee', 'fridge']);
  // o que a pessoa está fazendo → pose
  function actOf(a, o) {
    if (a.held) return 'held';
    if (o.sit) return a.status === 'trabalhando' || a.status === 'revisando' || o.act != null && a.mv === 'act' && WORKING.has(a.status) ? 'typing' : a.status === 'reuniao' ? 'talk' : null;
    if (a.mv !== 'act') return null;
    if (a.status === 'concluido') return 'wave';
    if (a.status === 'bloqueado') return 'stuck';
    const act = a.spot?.act;
    if (act === 'plan' || act === 'tv') return 'board';
    if (act === 'read' || a.status === 'pesquisando') return 'read';
    if (HANDS.has(act) || (act || '').startsWith('x_')) return 'hands';
    if (a.status === 'reuniao' || a.status === 'revisando') return 'talk';
    return null;
  }
  const WORKING = new Set(['trabalhando', 'revisando', 'planejando', 'entregando', 'pesquisando']);
  let drawables = [];
  const _hp = new THREE.Vector3();
  function updatePeople(T) {
    const seen = new Set();
    drawables = peopleDrawables(T);
    for (const it of drawables) {
      const p = it.person, o = it.opts, a = sim.agents.find(x => x.id === p.id); seen.add(p.id);
      let e = people.get(p.id);
      if (!e || e.v.key !== kit.lookKey(p)) {
        if (e) { scene.remove(e.v.root); kit.dispose(e.v); }
        const v = kit.build(p); v.root.userData.id = p.id; scene.add(v.root);
        e = { v, seed: (p.id.length * 7.3) % 6.28 }; people.set(p.id, e);
      }
      const v = e.v, moving = a ? WALK.has(a.mv) && sim.playing : false;
      const st = { sit: !!o.sit, moving, phase: (a?.walkDist || 0) * 5.5, act: a ? actOf(a, o) : null };
      kit.pose(v, st, T, e.seed);
      // sentado: o quadril fica logo acima do assento
      const y = (o.sit ? Math.max(0, o.seatY + .08 - kit.CS * 1.0) : 0) + (o.lift || 0);
      v.root.position.set(o.at[0], y, o.at[1]);
      if (a) v.root.rotation.y = Math.atan2(a.fx, a.fz);
      v.root.visible = true; e.visible = true;
      v.head.getWorldPosition(_hp); e.headY = _hp.y + (kit.TAGY ?? 1.05) * kit.CS;
    }
    for (const [id, e] of people) if (!seen.has(id)) { e.v.root.visible = false; e.visible = false; }
  }

  /* ---------- nomes, ícones e anel de seleção (desenhados em 2D por cima, no mesmo estilo do 2D) ---------- */
  const _p = new THREE.Vector3();
  const toScreen = (x, y, z) => { _p.set(x, y, z).project(camera); return [(_p.x + 1) / 2 * innerWidth, (1 - _p.y) / 2 * innerHeight]; };
  function drawTags(T) {
    const dpr = Math.min(2, devicePixelRatio || 1);
    if (ui.width !== Math.round(innerWidth * dpr) || ui.height !== Math.round(innerHeight * dpr)) { ui.width = Math.round(innerWidth * dpr); ui.height = Math.round(innerHeight * dpr); ui.style.width = innerWidth + 'px'; ui.style.height = innerHeight + 'px'; }
    uctx.setTransform(dpr, 0, 0, dpr, 0, 0); uctx.clearRect(0, 0, innerWidth, innerHeight); uctx.imageSmoothingEnabled = false;
    const ppu = innerHeight / (camera.top - camera.bottom), s = Math.max(1, Math.min(4, Math.round(ppu / 26)));
    // de trás para a frente, para o rótulo de quem está na frente ficar por cima
    const list = drawables.filter(d => people.get(d.person.id)?.visible).map(d => { const [fx, fy] = toScreen(d.opts.at[0], 0, d.opts.at[1]); return { d, fx, fy }; }).sort((a, b) => a.fy - b.fy);
    for (const { d, fx, fy } of list) {
      const o = d.opts, p = d.person, e = people.get(p.id);
      if (o.ring) {
        const rx = .45 * ppu, ry = rx * .5;
        uctx.strokeStyle = '#8C4FE0'; uctx.lineWidth = 2; uctx.beginPath(); uctx.ellipse(fx, fy, rx, ry, 0, 0, Math.PI * 2); uctx.stroke();
        uctx.strokeStyle = 'rgba(140,79,224,0.35)'; uctx.lineWidth = 4; uctx.beginPath(); uctx.ellipse(fx, fy, rx * 1.2, ry * 1.25, 0, 0, Math.PI * 2); uctx.stroke();
      }
      const [hx, hy] = toScreen(o.at[0], e.headY, o.at[1]);
      let labelY = hy - 6;
      if (o.icon) {
        const q = Math.max(2, Math.round(s * .9)), bw = 11 * q, bh = 10 * q, bx = Math.round(hx - bw / 2), by = Math.round(hy - bh - 6);
        uctx.fillStyle = '#FFFFFF'; uctx.strokeStyle = '#24252B'; uctx.lineWidth = 1.5;
        uctx.beginPath(); uctx.roundRect ? uctx.roundRect(bx, by, bw, bh, 3 * q / 2) : uctx.rect(bx, by, bw, bh); uctx.fill(); uctx.stroke();
        uctx.beginPath(); uctx.moveTo(hx - 3, by + bh - .5); uctx.lineTo(hx + 3, by + bh - .5); uctx.lineTo(hx, by + bh + 4); uctx.closePath(); uctx.fill();
        uctx.beginPath(); uctx.moveTo(hx - 3, by + bh); uctx.lineTo(hx, by + bh + 4); uctx.lineTo(hx + 3, by + bh); uctx.stroke();
        drawIcon(uctx, o.icon, bx + q, by + q, q, T);
        labelY = by - 4;
      }
      if (o.label) {
        uctx.font = `600 ${Math.max(11, Math.round(5 * s))}px "IBM Plex Sans", system-ui, sans-serif`;
        const tw = uctx.measureText(p.name).width, bh = Math.max(19, Math.round(7.5 * s)), bx = Math.round(hx - tw / 2 - 7), by = Math.round(labelY - bh - 2);
        uctx.fillStyle = o.hot ? '#8C4FE0' : 'rgba(36,37,43,0.88)';
        uctx.beginPath(); uctx.roundRect ? uctx.roundRect(bx, by, tw + 14, bh, 6) : uctx.rect(bx, by, tw + 14, bh); uctx.fill();
        uctx.fillStyle = '#FFFFFF'; uctx.textBaseline = 'middle'; uctx.fillText(p.name, bx + 7, by + bh / 2 + 1);
        if (o.dot) { uctx.fillStyle = o.dot; uctx.strokeStyle = '#FFFFFF'; uctx.lineWidth = 1.5; uctx.beginPath(); uctx.arc(bx + tw + 14, by + 1, 4, 0, Math.PI * 2); uctx.fill(); uctx.stroke(); }
      }
    }
  }

  /* ---------- câmera ortográfica isométrica, presa à grade de pixels ---------- */
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .5, 400);
  const PITCH = THREE.MathUtils.degToRad(30);
  const ISO = Math.PI / 4, snapYaw = (y) => ISO + Math.round((y - ISO) / (Math.PI / 2)) * (Math.PI / 2);
  const cam = { yaw: ISO, yawGoal: ISO, zoom: 1, panX: 0, panZ: 0 };
  let RW = 2, RH = 2;
  const _r = new THREE.Vector3(), _u = new THREE.Vector3(), _d = new THREE.Vector3(), _t = new THREE.Vector3();
  function updateCamera() {
    if (!rot) cam.yaw += (cam.yawGoal - cam.yaw) * .2;
    const halfW = room.span * .62 / cam.zoom, halfH = halfW * RH / RW;
    camera.left = -halfW; camera.right = halfW; camera.top = halfH; camera.bottom = -halfH; camera.updateProjectionMatrix();
    _t.set(room.cx + cam.panX, 0, room.cz + cam.panZ);
    _d.set(Math.sin(cam.yaw) * Math.cos(PITCH), Math.sin(PITCH), Math.cos(cam.yaw) * Math.cos(PITCH));
    camera.position.copy(_t).addScaledVector(_d, 120); camera.up.set(0, 1, 0); camera.lookAt(_t); camera.updateMatrixWorld();
    // alinha à grade de pixels: a cena não "tremula" ao mover
    _r.setFromMatrixColumn(camera.matrixWorld, 0); _u.setFromMatrixColumn(camera.matrixWorld, 1);
    const upp = (halfH * 2) / RH, r = _t.dot(_r), u = _t.dot(_u);
    camera.position.addScaledVector(_r, Math.round(r / upp) * upp - r).addScaledVector(_u, Math.round(u / upp) * upp - u);
    camera.updateMatrixWorld();
    // paredes que ficam entre a câmera e a sala baixam
    if (wallGroups.length) { wallGroups[0].scale.y = Math.cos(cam.yaw) < -.05 ? .18 : 1; wallGroups[1].scale.y = Math.sin(cam.yaw) < -.05 ? .18 : 1; }
  }

  /* ---------- pós-processamento: contorno por profundidade e normais (como no Pixel Moda) ---------- */
  class PixelPass extends Pass {
    constructor() {
      super();
      this.beauty = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthTexture: new THREE.DepthTexture(2, 2) });
      this.normals = new THREE.WebGLRenderTarget(2, 2, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
      this.normalMat = new THREE.MeshNormalMaterial({ side: THREE.DoubleSide });
      // personagens sozinhos, cada região com uma cor de id e com a própria profundidade
      this.mask = new THREE.WebGLRenderTarget(2, 2, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthTexture: new THREE.DepthTexture(2, 2) });
      this.quad = new FullScreenQuad(new THREE.ShaderMaterial({
        uniforms: { tDiffuse: { value: null }, tDepth: { value: null }, tNormal: { value: null }, tMask: { value: null }, tMaskC: { value: null }, res: { value: new THREE.Vector4() }, px: { value: Math.max(1, Math.round(DPR)) }, cNear: { value: .5 }, cFar: { value: 400 }, dK: { value: .38 }, nK: { value: .72 }, cK: { value: CHAR_OUTLINE ? 1 : 0 } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }',
        fragmentShader: `
          uniform sampler2D tDiffuse; uniform sampler2D tDepth; uniform sampler2D tNormal; uniform sampler2D tMask; uniform sampler2D tMaskC; uniform vec4 res; uniform float px; uniform float cNear; uniform float cFar; uniform float dK; uniform float nK; uniform float cK;
          varying vec2 vUv;
          float D(vec2 uv){ return cNear + texture2D(tDepth, uv).x * (cFar - cNear); }
          vec3 N(vec2 uv){ return texture2D(tNormal, uv).xyz * 2.0 - 1.0; }
          // o pixel é de um personagem quando a profundidade visível bate com a do personagem sozinho
          bool CH(vec2 uv, float d){ return abs(cNear + texture2D(tMask, uv).x * (cFar - cNear) - d) < 0.02; }
          vec3 RID(vec2 uv){ return texture2D(tMaskC, uv).rgb; }
          void main(){
            vec4 col = texture2D(tDiffuse, vUv);
            float d = D(vUv);
            if (d > cFar - 0.5) { gl_FragColor = col; return; }
            vec3 n = N(vUv); float dE = 0.0, nE = 0.0, cE = 0.0;
            bool isC = CH(vUv, d); vec3 idP = RID(vUv);
            vec2 o[4]; o[0]=vec2(1.,0.); o[1]=vec2(-1.,0.); o[2]=vec2(0.,1.); o[3]=vec2(0.,-1.);
            for (int i=0;i<4;i++){
              vec2 uv2 = vUv + o[i]*res.zw*px; float nd = D(uv2);
              if (nd - d > 0.3) dE = 1.0;
              bool nC = CH(uv2, nd);
              // personagem: silhueta escura contra o que não é personagem (inclusive o piso)
              if (isC && !nC && nd - d > -0.05) cE = 1.0;
              // linhas internas entre regiões (braço sobre o tronco, cabelo sobre o rosto)
              if (isC && nC && distance(RID(uv2), idP) > 0.015 && nd - d > -0.0005) cE = 1.0;
              // cenário na frente de um personagem
              if (!isC && nC && nd - d > 0.02) dE = 1.0;
              vec3 nn = N(uv2);
              float ind = clamp(smoothstep(-0.01, 0.01, dot(n - nn, vec3(1.0))), 0.0, 1.0);
              float dInd = clamp(sign(d - nd + 0.1), 0.0, 1.0);
              nE += (1.0 - dot(n, nn)) * ind * dInd;
            }
            // silhueta dos personagens com 2 px (as linhas internas ficam com 1 px)
            if (isC && cE < 0.5) for (int i=0;i<4;i++){ vec2 uv3 = vUv + o[i]*res.zw*px*2.0; float nd3 = D(uv3); if (!CH(uv3, nd3) && nd3 - d > -0.05) cE = 1.0; }
            if (cE > 0.5 && cK > 0.5) col.rgb = col.rgb * 0.05 + vec3(0.02, 0.018, 0.024);
            else if (isC && cK < 0.5) {}
            else if (dE > 0.5) col.rgb *= dK; else if (nE > 0.35) col.rgb *= nK;
            gl_FragColor = col;
          }`,
        depthTest: false, depthWrite: false,
      }));
    }
    setSize(w, h) { this.beauty.setSize(w, h); this.normals.setSize(w, h); this.mask.setSize(w, h); this.quad.material.uniforms.res.value.set(w, h, 1 / w, 1 / h); }
    render(r, writeBuffer) {
      const u = this.quad.material.uniforms, bg = scene.background;
      camera.layers.set(0); scene.overrideMaterial = this.normalMat; scene.background = null;
      r.setClearColor(0x000000, 1); r.setRenderTarget(this.normals); r.clear(); r.render(scene, camera); scene.overrideMaterial = null;
      for (const m of kit.MESHES) { m.userData.mat = m.material; m.material = m.userData.idMat; }
      camera.layers.set(kit.LAYER); r.setClearColor(0x000000, 0); r.setRenderTarget(this.mask); r.clear(); r.render(scene, camera); camera.layers.set(0);
      for (const m of kit.MESHES) m.material = m.userData.mat;
      scene.background = bg;
      r.setRenderTarget(this.beauty); r.clear(); r.render(scene, camera);
      // camada 1 (vidro e vapor) depois: fica fora do contorno
      camera.layers.set(1); const ac = r.autoClear; r.autoClear = false; scene.background = null; r.render(scene, camera); scene.background = bg; r.autoClear = ac; camera.layers.set(0);
      u.tDiffuse.value = this.beauty.texture; u.tDepth.value = this.beauty.depthTexture; u.tNormal.value = this.normals.texture; u.tMask.value = this.mask.depthTexture; u.tMaskC.value = this.mask.texture; u.cNear.value = camera.near; u.cFar.value = camera.far;
      r.setRenderTarget(this.renderToScreen ? null : writeBuffer); this.quad.render(r);
    }
  }
  const composer = new EffectComposer(renderer);
  composer.addPass(new PixelPass());
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), .4, .3, 1.0);
  composer.addPass(bloom);
  // suaviza o serrilhado das bordas (inclusive dos contornos) no modo nítido
  const smaa = SMOOTH ? new SMAAPass(2, 2) : null;
  if (smaa) composer.addPass(smaa);
  composer.addPass(new OutputPass());

  function resize() {
    if (SMOOTH) { RW = Math.max(2, Math.round(innerWidth * DPR)); RH = Math.max(2, Math.round(innerHeight * DPR)); canvas.style.width = innerWidth + 'px'; canvas.style.height = innerHeight + 'px'; }
    else { RW = Math.max(2, Math.ceil(innerWidth / PX)); RH = Math.max(2, Math.ceil(innerHeight / PX)); canvas.style.width = RW * PX + 'px'; canvas.style.height = RH * PX + 'px'; }
    renderer.setSize(RW, RH, false); composer.setSize(RW, RH);
    // ampliar sem suavizar só no visual pixel art
    canvas.style.imageRendering = SMOOTH ? 'auto' : 'pixelated';
  }
  addEventListener('resize', resize); resize();

  /* ---------- luz do horário (a mesma do 2D: dia, tarde, noite) ---------- */
  const _c = new THREE.Color();
  function updateLights() {
    const tint = _c.setStyle(AMB?.tint || 'rgb(255,255,255)');
    hemi.color.setRGB(tint.r, tint.g, tint.b); hemi.intensity = 1.35 * (.55 + .45 * Math.max(tint.r, tint.g, tint.b));
    sun.color.setHex(0xFFE3C2).multiply(tint); sun.intensity = AMB?.white ? 1.6 : 1.1;
    scene.background.copy(BG).multiply(tint);
    const k = AMB?.k || 1; bloom.strength = .35 + (k - 1) * .5;
    // cores claras (vidro da geladeira, papel) estouram fácil: o brilho cresce menos nelas
    for (const e of glowList) { const lum = (e.base.r + e.base.g + e.base.b) / 3; e.m.color.copy(e.base).multiplyScalar(e.dim ? .7 : 1.3 + (k - 1) * (lum > .7 ? .15 : .6)); }
  }

  /* ---------- mouse: arrastar move · roda aproxima no cursor · direito (ou Shift) + arrastar gira ---------- */
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), ray = new THREE.Raycaster(), _g = new THREE.Vector3();
  const ndc = (x, y) => new THREE.Vector2(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1);
  const groundAt = (x, y) => { ray.setFromCamera(ndc(x, y), camera); return ray.ray.intersectPlane(ground, _g) ? _g.clone() : null; };
  let drag = null, rot = null;
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    if (e.button === 2 || e.shiftKey) { rot = { x: e.clientX, yaw: cam.yaw }; canvas.classList.add('rotating'); return; }
    drag = { x: e.clientX, y: e.clientY, start: groundAt(e.clientX, e.clientY), px: cam.panX, pz: cam.panZ, moved: false };
    canvas.classList.add('dragging');
  });
  canvas.addEventListener('pointermove', (e) => {
    if (rot) { cam.yaw = rot.yaw - (e.clientX - rot.x) * .008; cam.yawGoal = cam.yaw; return; }
    if (!drag) return;
    if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 4) drag.moved = true;
    if (!drag.moved || !drag.start) return;
    // o ponto do chão que estava sob o cursor continua sob o cursor
    cam.panX = drag.px; cam.panZ = drag.pz; updateCamera();
    const now = groundAt(e.clientX, e.clientY); if (!now) return;
    cam.panX = drag.px + drag.start.x - now.x; cam.panZ = drag.pz + drag.start.z - now.z;
  });
  const endPointer = (e) => {
    canvas.classList.remove('dragging', 'rotating');
    if (rot) { rot = null; cam.yawGoal = snapYaw(cam.yaw); return; } // encaixa no ângulo isométrico mais próximo
    const was = drag; drag = null; if (!was || was.moved || e.type !== 'pointerup') return;
    ray.setFromCamera(ndc(e.clientX, e.clientY), camera);
    const hit = ray.intersectObjects([...people.values()].filter(p => p.visible).map(p => p.v.root), true)[0];
    let o = hit?.object; while (o && !o.userData.id) o = o.parent;
    if (o) openFicha(o.userData.id);
  };
  canvas.addEventListener('pointerup', endPointer); canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const before = groundAt(e.clientX, e.clientY);
    cam.zoom = Math.min(5, Math.max(.6, cam.zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
    updateCamera();
    const after = groundAt(e.clientX, e.clientY);
    if (before && after) { cam.panX += before.x - after.x; cam.panZ += before.z - after.z; }
  }, { passive: false });
  addEventListener('keydown', (e) => {
    if (!active() || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (e.key === 'q' || e.key === 'Q') cam.yawGoal += Math.PI / 2;
    if (e.key === 'e' || e.key === 'E') cam.yawGoal -= Math.PI / 2;
  });
  // "Centralizar" do 2D também vale aqui
  const fit3d = () => { cam.panX = 0; cam.panZ = 0; cam.zoom = 1; };

  /* ---------- laço ---------- */
  const active = () => mode === 'live';
  window.R3D = { active, wanted: true, stats: { fps: 0 }, fit: fit3d };
  let sig = '', frames = 0, fpsT = performance.now(), n = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    const on = active();
    canvas.style.display = ui.style.display = on ? 'block' : 'none';
    scene2d.style.visibility = on ? 'hidden' : 'visible';
    if (!on) return;
    const T = now / 1000;
    if (n++ % 20 === 0) { const s = JSON.stringify([W.objects, W.walls, W.wall, W.tiles]); if (s !== sig) { sig = s; rebuild(); } }
    updateLights(); updateAnimations(T); updatePeople(T); updateCamera(); composer.render(); drawTags(T);
    frames++; if (now - fpsT > 1000) { window.R3D.stats.fps = Math.round(frames * 1000 / (now - fpsT)); frames = 0; fpsT = now; }
  }
  requestAnimationFrame(loop);
}
