// Cena 3D do Pixel HQ — mesma técnica do Pixel Moda:
// sombreamento em 3 faixas, luz de céu + sol com sombras, contorno por pós-processamento
// (profundidade + normais), bloom nos brilhos, texturas 16×16 e câmera presa à grade de pixels.
//
// Lê os mesmos dados do desenho 2D (W, ITEMS, worldBoxes, segBoxes, animBox, peopleDrawables).
// Personagens: modelos GLB de web/modelos/ (personagens3d-meshy.js), repintados com a aparência de cada pessoa;
// sem eles, personagens low-poly feitos em código (personagens3d-lowpoly.js).
// É o padrão quando a página roda com o servidor; sem WebGL, volta sozinho para o 2D.
// Vale para o modo ao vivo e para a edição da sala (Construir).
// Mouse: esquerdo arrasta = gira · direito ou meio arrasta = move · roda aproxima (na direção do cursor).

const qs = new URLSearchParams(location.search);
// com o servidor, ou no arquivo único (que traz o 3D embutido: PIXELHQ_3D)
// sempre 3D (a escolha antiga "pixelhq.3d = 0" não vale mais); ?2d força o 2D para testes
const WANT = qs.has('3d') || (!qs.has('2d') && (!!window.PIXELHQ_BRIDGE || !!window.PIXELHQ_3D));
window.R3D = { active: () => false, wanted: WANT, stats: { fps: 0 } };
if (WANT) start().catch((e) => {
  console.error('[3d]', e);
  window.R3D = { active: () => false, wanted: false, stats: { fps: 0 } };
  document.documentElement.classList.remove('espera3d');
  document.getElementById('scene').style.visibility = 'visible';
  toast('Visual 3D indisponível neste navegador (' + e.message + '). Usando o 2D.');
});

async function start() {
  window.loadStep?.(.2, 'Carregando o 3D…');
  const THREE = await import('three');
  window.loadStep?.(.35, 'Carregando o 3D…');
  const { EffectComposer } = await import('three/addons/postprocessing/EffectComposer.js');
  const { Pass, FullScreenQuad } = await import('three/addons/postprocessing/Pass.js');
  const { UnrealBloomPass } = await import('three/addons/postprocessing/UnrealBloomPass.js');
  const { OutputPass } = await import('three/addons/postprocessing/OutputPass.js');
  const { SMAAPass } = await import('three/addons/postprocessing/SMAAPass.js');
  const { RoundedBoxGeometry } = await import('three/addons/geometries/RoundedBoxGeometry.js');
  const { mergeGeometries, mergeVertices } = await import('three/addons/utils/BufferGeometryUtils.js');
  const { furnitureKit } = await import('./moveis3d.js');
  window.loadStep?.(.5, 'Carregando os móveis…');
  // linha visual dos personagens: meshy (padrão: modelos gerados com acessórios) | lowpoly (?estilo=lowpoly)
  // caminhos fixos (não variáveis): o empacotador do arquivo único (scripts/build-single.mjs) consegue segui-los
  const ESTILOS = { lowpoly: () => import('./personagens3d-lowpoly.js'), meshy: () => import('./personagens3d-meshy.js') };
  // se os modelos do padrão não carregarem (arquivo ausente, rede), cai para o low-poly feito em código
  let characterKit, kitArgs;
  // arquivo único sem os modelos embutidos (PIXELHQ_MODELOS === false): direto o low-poly
  const PADRAO = window.PIXELHQ_MODELOS === false ? 'lowpoly' : 'meshy';
  try { ({ characterKit } = await (ESTILOS[qs.get('estilo')] || ESTILOS[PADRAO])()); }
  catch (e) { console.warn('[3D] estilo de personagem indisponível, usando low-poly:', e); ({ characterKit } = await ESTILOS.lowpoly()); }
  const { RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js');
  window.loadStep?.(.65, 'Carregando os personagens…');

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
  // móveis: folhas e roupas com as duas faces (o facetado vem das normais por face, em addOwned)
  const toonF = (color, double = false) => {
    const k = (double ? 'fd' : 'f') + color;
    if (!mats.has(k)) mats.set(k, new THREE.MeshToonMaterial({ color: new THREE.Color(color), gradientMap, side: double ? THREE.DoubleSide : THREE.FrontSide }));
    return mats.get(k);
  };
  const pieceMat = (pc) => pc.glass ? glassMat : pc.glow ? glow(pc.glow) : toonF(String(pc.c || '#888888'), pc.double);

  /* ---------- geometria ---------- */
  const geos = new Map();
  function rbox(w, h, d) {
    const k = `${w.toFixed(3)},${h.toFixed(3)},${d.toFixed(3)}`;
    if (!geos.has(k)) geos.set(k, new THREE.BoxGeometry(w, h, d)); // quinas retas, sem chanfro
    return geos.get(k);
  }
  // paredes: caixa reta (cantos arredondados deixariam emendas visíveis entre os trechos)
  const box = (w, h, d) => { const k = `b${w},${h},${d}`; if (!geos.has(k)) geos.set(k, new THREE.BoxGeometry(w, h, d)); return geos.get(k); };
  // contorno preto (traço de nanquim) em tudo que não é personagem: sai da profundidade e das normais no
  // pós-processamento, igual para todo móvel, parede e piso. ?contornoMoveis=0 desliga.
  // Os móveis NÃO entram mais na máscara dos personagens (era isso que deixava o contorno só em parte deles).
  const INK = qs.get('contornoMoveis') !== '0', FURN_OUTLINE = false, OUTLINE_LAYER = 3;
  const unit = new THREE.BoxGeometry(1, 1, 1), unitBall = new THREE.IcosahedronGeometry(.5, 0);
  const FK = furnitureKit({ THREE, RoundedBoxGeometry, isAnim: (b) => ANIM(b) });
  // um móvel inteiro (modelo 3D ou caixas do catálogo), girado e posicionado
  function addObject(o, at, opaque, glassB) {
    const M = FK.matrix(o.item, o.rot || 0, at ? at.x : o.x, at ? at.z : o.z);
    for (const pc of FK.pieces(o.item, objColor(o))) { pc.geo.applyMatrix4(M); (pc.glass ? glassB : opaque).addOwned(pc.geo, pieceMat(pc)); }
  }
  // partes animadas paradas (miniaturas e fantasma do editor): telas, LEDs, luz colorida
  function addAnimStatic(o, at, opaque, glassB) {
    const model = FK.hasModel(o.item);
    for (const bx of worldBoxes(o, at)) {
      if (!ANIM(bx) || (bx.sway && model) || (bx.steam && model) || bx.w <= 0 || bx.h <= 0 || bx.d <= 0) continue;
      const [x, y, z] = center(bx);
      (bx.glass ? glassB : opaque).add(bx.pulse ? unitBall.clone().scale(bx.w, bx.h, bx.d) : rbox(bx.w, Math.max(bx.h, .004), bx.d), matFor(bx, true), x, y, z);
    }
  }
  // no editor, o que está sendo arrastado sai do lugar (aparece no fantasma, onde vai ficar)
  const movingId = () => (mode === 'build' && drag?.kind === 'move' && drag.moved) ? drag.sel.id : null;
  // agrupa caixas por material e junta numa malha só (uma chamada de desenho por material)
  function batcher() {
    const groups = new Map();
    return {
      add(geo, mat, x, y, z) {
        const g = (geo.index ? geo.toNonIndexed() : geo.clone()).translate(x, y, z);
        for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
        if (!groups.has(mat)) groups.set(mat, []); groups.get(mat).push(g);
      },
      // geometria já posicionada (é consumida)
      addOwned(g, mat) {
        if (g.index) { const n = g.toNonIndexed(); g.dispose(); g = n; }
        g.computeVertexNormals(); // sem vértices compartilhados: normal por face = facetado, como os personagens
        for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
        if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
        if (!groups.has(mat)) groups.set(mat, []); groups.get(mat).push(g);
      },
      flush(parent, { shadows = true, layer = 0, outline = false } = {}) {
        for (const [mat, list] of groups) {
          const m = new THREE.Mesh(mergeGeometries(list, false), mat);
          m.castShadow = shadows; m.receiveShadow = true; m.matrixAutoUpdate = false; m.updateMatrix(); m.layers.set(layer);
          // contorno preto fino, como o dos personagens (entra na máscara do contorno)
          if (outline && FURN_OUTLINE) m.layers.enable(OUTLINE_LAYER);
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
  let animated = [], kanbans = [], doors = [], steams = [], entryDoor = null;
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
    // as 4 faces da sala têm parede (girar a vista dá a mesma sala de qualquer lado); as que ficam entre a
    // câmera e a sala baixam até virar rodapé (updateCamera)
    const wc = W.wall, cap = shade(wc, 1.12), sides = { z: new THREE.Group(), x: new THREE.Group(), z2: new THREE.Group(), x2: new THREE.Group() }, T = .14, WB = batcher(), XB = batcher(), ZB2 = batcher(), XB2 = batcher();
    // porta de entrada: na parede do fundo/esquerda encostada no capacho (os personagens entram e saem por ela)
    // (enquanto a porta é arrastada no editor, o fantasma mostra o lugar novo e a parede fica fechada)
    entryDoor = movingId() && movingId() === W.objects.find(isDoor)?.id ? null : doorInfo();
    const DH = 2.1, inDoor = (x, z, side) => entryDoor && entryDoor.side === side && entryDoor.cells.has(x + ',' + z);
    for (const k in W.tiles) {
      const [x, z] = k.split(',').map(Number);
      if (!has(x, z - 1) && inDoor(x, z, 'z')) { WB.add(box(1, WH - DH, T), toon(wc), x + .5, DH + (WH - DH) / 2, z - T / 2); WB.add(box(1, .06, T + .02), toon(cap), x + .5, WH, z - T / 2); }
      else if (!has(x - 1, z) && inDoor(x, z, 'x')) { XB.add(box(T, WH - DH, 1), toon(shade(wc, .94)), x - T / 2, DH + (WH - DH) / 2, z + .5); XB.add(box(T + .02, .06, 1), toon(cap), x - T / 2, WH, z + .5); }
      if (!has(x, z - 1) && !inDoor(x, z, 'z')) { WB.add(box(1, WH, T), toon(wc), x + .5, WH / 2, z - T / 2); WB.add(box(1, .06, T + .02), toon(cap), x + .5, WH, z - T / 2); }
      if (!has(x - 1, z) && !inDoor(x, z, 'x')) { XB.add(box(T, WH, 1), toon(shade(wc, .94)), x - T / 2, WH / 2, z + .5); XB.add(box(T + .02, .06, 1), toon(cap), x - T / 2, WH, z + .5); }
      // lados da frente: presas no rodapé (y = 0) para baixar escalando sem sair do chão
      if (!has(x, z + 1)) { ZB2.add(box(1, WH, T), toon(wc), x + .5, WH / 2, z + 1 + T / 2); ZB2.add(box(1, .06, T + .02), toon(cap), x + .5, WH, z + 1 + T / 2); }
      if (!has(x + 1, z)) { XB2.add(box(T, WH, 1), toon(shade(wc, .94)), x + 1 + T / 2, WH / 2, z + .5); XB2.add(box(T + .02, .06, 1), toon(cap), x + 1 + T / 2, WH, z + .5); }
    }
    // batente e as duas folhas (abrem para dentro quando alguém chega perto)
    if (entryDoor) {
      const D = entryDoor, alongX = D.side === 'z', g = alongX ? sides.z : sides.x, FB = batcher(), frame = '#3A3C44', len = D.u1 - D.u0, wc0 = D.c - T / 2;
      const at = (u, y, w, h, t) => alongX ? [box(w, h, t), u, y, wc0] : [box(t, h, w), wc0, y, u];
      for (const u of [D.u0 + .04, D.u1 - .04]) { const [gq, x, y, z] = at(u, DH / 2, .08, DH, T + .04); FB.add(gq, toon(frame), alongX ? x : x, y, alongX ? z : z); }
      { const [gq, x, y, z] = at((D.u0 + D.u1) / 2, DH + .04, len, .08, T + .04); FB.add(gq, toon(frame), x, y, z); }
      FB.flush(g, { outline: true });
      D.leaves = [];
      for (const k of [0, 1]) {
        const hinge = new THREE.Group(), lw = len / 2 - .08, dir = k ? -1 : 1, LB = batcher(), GB = batcher();
        // folha: moldura escura + vidro, puxador; construída ao longo de +u a partir da dobradiça
        const P = (u, y, w, h, t, mat, B2) => B2.add(alongX ? box(w, h, t) : box(t, h, w), mat, alongX ? u : 0, y, alongX ? 0 : u);
        const mid = dir * lw / 2, fr = toon(frame);
        P(dir * .04, DH / 2, .08, DH - .04, .05, fr, LB); P(dir * (lw - .04), DH / 2, .08, DH - .04, .05, fr, LB);
        P(mid, .12, lw, .2, .05, fr, LB); P(mid, DH - .1, lw, .12, .05, fr, LB);
        P(mid, (.22 + DH - .16) / 2, lw - .16, DH - .38, .03, glassMat, GB);
        P(dir * (lw - .14), 1.0, .03, .32, .12, toon('#C9CDD4'), LB);
        LB.flush(hinge, { outline: true }); GB.flush(hinge, { shadows: false, layer: 1 });
        const hu = k ? D.u1 - .08 : D.u0 + .08;
        if (alongX) hinge.position.set(hu, .01, wc0); else hinge.position.set(wc0, .01, hu);
        g.add(hinge); D.leaves.push({ hinge, sign: (alongX ? -1 : 1) * dir });
      }
      D.open = 0;
    }
    WB.flush(sides.z); XB.flush(sides.x); ZB2.flush(sides.z2); XB2.flush(sides.x2);
    world.add(sides.z, sides.x, sides.z2, sides.x2); wallGroups = [sides.z, sides.x, sides.z2, sides.x2];
    // móveis e divisórias (paredes de vidro/divisórias também entram no contorno)
    const rest = batcher(), glassOnly = batcher();
    const addStatic = (bx) => {
      if (bx.w <= 0 || bx.h <= 0 || bx.d <= 0) return;
      const [x, y, z] = center(bx);
      (bx.glass ? glassOnly : rest).add(rbox(bx.w, Math.max(bx.h, .004), bx.d), matFor(bx, true), x, y, z);
    };
    const hid = movingId();
    for (const o of W.objects) {
      const it = ITEMS[o.item]; if (!it || o.id === hid) continue;
      if (it.dyn === 'kanban') { const g = new THREE.Group(); world.add(g); kanbans.push({ o, g, sig: '' }); continue; }
      addObject(o, null, rest, glassOnly);
      const model = FK.hasModel(o.item);
      for (const bx of worldBoxes(o)) {
        if (!ANIM(bx) || (bx.sway && model)) continue;
        if (bx.steam) { if (!model) addStatic(bx); steams.push({ b: bx, parts: [0, 1, 2, 3].map(() => { const m = new THREE.Mesh(unit, steamMat); m.layers.set(1); world.add(m); return m; }) }); continue; }
        const m = new THREE.Mesh(bx.pulse ? unitBall : unit, matFor(bx, false)); m.castShadow = !bx.g; m.receiveShadow = true; if (FURN_OUTLINE) m.layers.enable(OUTLINE_LAYER); world.add(m); animated.push({ b: bx, m });
      }
    }
    for (const s of W.walls) {
      if (s.id === hid) continue;
      if (s.kind === 'porta' || s.kind === 'vidro_porta') { const g = new THREE.Group(); world.add(g); doors.push({ s, g, open: -1 }); continue; }
      for (const bx of segBoxes(s, null, 0)) addStatic(bx);
    }
    rest.flush(world, { outline: true }); glassOnly.flush(world, { shadows: false, layer: 1 });
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
    opaque.flush(g, { outline: true }); glass.flush(g, { shadows: false, layer: 1 });
  }

  /* ---------- animações dos móveis (as mesmas regras do 2D, via animBox) ---------- */
  function updateAnimations(T) {
    ACTIVE = computeActive();
    for (const { b, m } of animated) {
      const a = animBox(b, T);
      const on = b.screen ? ACTIVE.has(screenKey(b)) : true;
      m.material = matFor(a, on);
      m.scale.set(Math.max(a.w, .001), Math.max(a.h, .001), Math.max(a.d, .001));
      m.position.set(a.x + a.w / 2, a.y + a.h / 2, a.z + a.d / 2);
    }
    for (const k of kanbans) {
      const boxes = worldBoxes(k.o).map(bx => animBox(bx, T)), sig = boxes.length + ':' + boxes.map(bx => bx.y.toFixed(2)).join(',');
      if (sig !== k.sig) { k.sig = sig; refill(k.g, boxes); }
    }
    // porta de entrada: abre quando alguém está perto dela (entrando ou saindo)
    if (entryDoor?.leaves) {
      const D = entryDoor, cu = (D.u0 + D.u1) / 2, near = sim.agents.some(a => (a.present === true || !quietOffice()) && Math.hypot((D.side === 'z' ? a.x - cu : a.x - D.c), (D.side === 'z' ? a.z - D.c : a.z - cu)) < 1.8);
      D.open += ((near ? 1 : 0) - D.open) * .12;
      for (const L of D.leaves) L.hinge.rotation.y = L.sign * D.open * 1.35;
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
  catch (e) { console.warn('[3D] modelos de personagem não carregaram, usando low-poly:', e); kit = await (await ESTILOS.lowpoly()).characterKit({ THREE, RoundedBoxGeometry, mergeGeometries, mergeVertices, gradientMap }); }
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
    const cache = new Map(), last = new Map();
    // nada em 2D (decisão do dono): enquanto o modelo baixa, fica o último retrato 3D da pessoa (ou vazio)
    const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    const shot = (p, w, h, full) => {
      const key = kit.lookKey(p) + (full ? 'F' : 'H') + w, lk = (p.id || '') + (full ? 'F' : 'H') + w;
      if (cache.has(key)) { last.set(lk, cache.get(key)); return cache.get(key); }
      // modelo ainda baixando: redesenha as listas quando chegar
      if (kit.ready && !kit.ready(p)) { kit.load(p).then(refresh, () => {}); return last.get(lk) || BLANK; }
      const v = kit.build(p); kit.pose(v, { sit: false, moving: false, act: null }, 0, 0); kit.pose(v, { sit: false, moving: false, act: null }, 1, 0);
      v.root.rotation.y = .35; ps.add(v.root); v.root.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(v.root), top = b.max.y, H = top - b.min.y;
      // busto: da cintura para cima; corpo inteiro: tudo
      const y0 = full ? b.min.y - H * .03 : top - H * .62, y1 = top + H * .03, hh = (y1 - y0) / 2, cy = (y0 + y1) / 2, hw = hh * w / h;
      Object.assign(pc, { left: -hw, right: hw, top: hh, bottom: -hh }); pc.updateProjectionMatrix();
      pc.position.set(0, cy + .25, 6); pc.lookAt(0, cy, 0);
      pr.setSize(w, h, false); pr.setClearColor(0x000000, 0); pr.render(ps, pc);
      const url = pr.domElement.toDataURL('image/png');
      ps.remove(v.root); kit.dispose(v); cache.set(key, url); last.set(lk, url); return url;
    };
    window.avatar = (p, s = 3) => { try { return shot(p, 24 * s, 28 * s, false); } catch (e) { console.warn('[3D] retrato', e); return BLANK; } };
    window.fullAvatar = (p, s = 4) => { try { return shot(p, 36 * s, 60 * s, true); } catch (e) { console.warn('[3D] retrato', e); return BLANK; } };
    document.body.classList.add('r3d-avatars');
    // listas já desenhadas com o retrato 2D: redesenha
    function refresh() { try { if (typeof renderPanel === 'function') renderPanel(); if (typeof renderCards === 'function') renderCards(); } catch {} }
    refresh();
  }
  // miniaturas do editor (Elementos, paredes, pisos) feitas com os mesmos modelos 3D da sala
  const thumbs3d = (() => {
    const tr = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    tr.outputColorSpace = THREE.SRGBColorSpace; tr.setPixelRatio(1);
    const ts = new THREE.Scene();
    ts.add(new THREE.HemisphereLight(0xFFFFFF, 0xCFC2EC, 1.45));
    const tl = new THREE.DirectionalLight(0xFFE3C2, 1.5); tl.position.set(-11, 19, 15); ts.add(tl);
    const tc = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 100);
    const TP = Math.PI / 6, dir = new THREE.Vector3(Math.sin(Math.PI / 4) * Math.cos(TP), Math.sin(TP), Math.cos(Math.PI / 4) * Math.cos(TP));
    const S = typeof TS === 'number' ? TS : 2;
    function shoot(fill, w, h, bg = null) {
      const g = new THREE.Group(), op = batcher(), gl = batcher(); fill(op, gl); op.flush(g, { shadows: false }); gl.flush(g, { shadows: false });
      ts.add(g); g.updateMatrixWorld(true);
      const bb = new THREE.Box3().setFromObject(g), c = bb.getCenter(new THREE.Vector3());
      tc.position.copy(c).addScaledVector(dir, 30); tc.up.set(0, 1, 0); tc.lookAt(c); tc.updateMatrixWorld();
      // extensão na tela: projeta os 8 cantos no espaço da câmera
      const inv = tc.matrixWorldInverse; let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (let i = 0; i < 8; i++) { const v = new THREE.Vector3(i & 1 ? bb.max.x : bb.min.x, i & 2 ? bb.max.y : bb.min.y, i & 4 ? bb.max.z : bb.min.z).applyMatrix4(inv); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }
      const pad = 1.12, hw = Math.max((x1 - x0) / 2, (y1 - y0) / 2 * w / h) * pad, hh = hw * h / w, mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
      Object.assign(tc, { left: mx - hw, right: mx + hw, top: my + hh, bottom: my - hh }); tc.updateProjectionMatrix();
      tr.setSize(w * S, h * S, false); if (bg) tr.setClearColor(bg, 1); else tr.setClearColor(0x000000, 0); tr.render(ts, tc);
      const url = tr.domElement.toDataURL('image/png');
      ts.remove(g); g.traverse(o => { if (o.isMesh) o.geometry.dispose(); });
      return url;
    }
    // bg: fundo opaco (a imagem que vai para a crítica visual da IA; transparente vira preto em alguns modelos)
    const item = (k, w = 120, h = 90, bg = null) => shoot((op, gl) => { const o = { item: k, rot: 0, color: ITEMS[k].color }; addObject(o, { x: 0, z: 0 }, op, gl); addAnimStatic(o, { x: 0, z: 0 }, op, gl); }, w, h, bg);
    const wall = (k) => shoot((op, gl) => { for (const bx of segBoxes({ id: 't', kind: k, a: [0, 0], b: [3, 0] })) { if (bx.w <= 0 || bx.h <= 0 || bx.d <= 0) continue; const [x, y, z] = center(bx); (bx.glass ? gl : op).add(rbox(bx.w, Math.max(bx.h, .004), bx.d), matFor(bx, true), x, y, z); } }, 120, 90);
    const floor = (m) => shoot((op) => { const tile = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2); for (let x = 0; x < 3; x++) for (let z = 0; z < 3; z++) { op.add(tile, toon('#FFFFFF', floorTexture(m)), x + .5, .001, z + .5); op.add(box(1, .12, 1), toon('#D3C9CE'), x + .5, -.06, z + .5); } }, 96, 72);
    return { item, wall, floor };
  })();
  try {
    for (const k in ITEMS) THUMBS[k] = thumbs3d.item(k);
    for (const k in WALLKINDS) THUMBS['w:' + k] = thumbs3d.wall(k);
    for (const k in MATS) MTHUMBS[k] = thumbs3d.floor(k);
    if (mode === 'build' && typeof renderPanel === 'function') renderPanel();
  } catch (e) { console.warn('[3D] miniaturas 3D falharam; ficam as 2D:', e); }
  // móveis criados pela IA depois do início também ganham miniatura 3D
  const reg0 = window.registerCustom;
  if (typeof reg0 === 'function') window.registerCustom = (c) => { const r = reg0(c); if (r) try { THUMBS[c.id] = thumbs3d.item(c.id); } catch {} return r; };

  // contorno dos personagens: ligado por padrão; ?contorno=0 desliga (para comparar)
  const CHAR_OUTLINE = qs.get('contorno') !== '0';
  const people = new Map(); // id → { v (modelo), visible, headY }
  const WALK = new Set(['walk', 'approach', 'leave']);
  // o que a pessoa está fazendo → pose
  // cada uso de móvel tem o próprio gesto (poses nos kits de personagem); móvel criado pela IA (x_*) usa as mãos
  const ACT_POSE = { work: 'typing', meeting: 'talk', plan: 'board', tv: 'watch', read: 'read', coffee: 'drink', fridge: 'drink', cook: 'stir', stock: 'lift', sell: 'counter', attend: 'counter', care: 'care', craft: 'hammer', print: 'press', infra: 'hands', record: 'present', plants: 'water', relax: 'relax' };
  function actOf(a, o) {
    if (a.held) return 'held';
    const act = a.spot?.act, here = a.mv === 'act';
    if (o.sit) {
      if (here && (act === 'relax' || act === 'read')) return ACT_POSE[act];
      return a.status === 'trabalhando' || a.status === 'revisando' || o.act != null && here && WORKING.has(a.status) ? 'typing' : a.status === 'reuniao' ? 'talk' : null;
    }
    if (!here) return null;
    if (a.status === 'concluido') return 'wave';
    if (a.status === 'bloqueado') return 'stuck';
    if (ACT_POSE[act]) return ACT_POSE[act];
    if ((act || '').startsWith('x_')) return 'hands';
    if (a.status === 'pesquisando') return 'read';
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
      // modelo do penteado ainda baixando: espera (a pessoa aparece quando ele chegar)
      if (kit.ready && !kit.ready(p)) continue;
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
    if (wallGroups.length) {
      const c = Math.cos(cam.yaw), sn = Math.sin(cam.yaw), low = .06;
      wallGroups[0].scale.y = c < -.05 ? low : 1; wallGroups[1].scale.y = sn < -.05 ? low : 1;
      wallGroups[2].scale.y = c > .05 ? low : 1; wallGroups[3].scale.y = sn > .05 ? low : 1;
    }
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
        uniforms: { tDiffuse: { value: null }, tDepth: { value: null }, tNormal: { value: null }, tMask: { value: null }, tMaskC: { value: null }, res: { value: new THREE.Vector4() }, px: { value: Math.max(1, Math.round(DPR)) }, cNear: { value: .5 }, cFar: { value: 400 }, dK: { value: .38 }, nK: { value: .72 }, cK: { value: CHAR_OUTLINE ? 1 : 0 }, iK: { value: INK ? 1 : 0 } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }',
        fragmentShader: `
          uniform sampler2D tDiffuse; uniform sampler2D tDepth; uniform sampler2D tNormal; uniform sampler2D tMask; uniform sampler2D tMaskC; uniform vec4 res; uniform float px; uniform float cNear; uniform float cFar; uniform float dK; uniform float nK; uniform float cK; uniform float iK;
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
              // degrau de profundidade: o vizinho está mais longe do que a inclinação da própria face explica
              // (2ª derivada; numa face plana dá zero). Marca só o lado da frente: traço de 1 px.
              float od = D(vUv - o[i]*res.zw*px);
              if ((nd - d) - (d - od) > 0.03 && nd - d > 0.03) dE = 1.0;
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
            vec3 inkC = col.rgb * 0.05 + vec3(0.02, 0.018, 0.024);
            if (cE > 0.5 && cK > 0.5) col.rgb = inkC;
            else if (isC) {}
            // resto da cena: mesmo traço preto dos personagens na silhueta (degrau) e nas quinas (dobra da face)
            else if (iK > 0.5 && (dE > 0.5 || nE > 0.35)) col.rgb = inkC;
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
  let vdrag = null, rot = null;
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  // mouse (como nos visualizadores 3D): esquerdo arrasta = gira · direito ou meio arrasta = move · clique = abre a ficha
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    if (e.button === 0 && !e.shiftKey) { rot = { x: e.clientX, y: e.clientY, yaw: cam.yaw, moved: false }; return; }
    vdrag = { x: e.clientX, y: e.clientY, start: groundAt(e.clientX, e.clientY), px: cam.panX, pz: cam.panZ, moved: false };
    canvas.classList.add('dragging');
  });
  canvas.addEventListener('pointermove', (e) => {
    if (rot) {
      if (!rot.moved && Math.hypot(e.clientX - rot.x, e.clientY - rot.y) > 4) { rot.moved = true; canvas.classList.add('rotating'); }
      if (rot.moved) { cam.yaw = rot.yaw - (e.clientX - rot.x) * .008; cam.yawGoal = cam.yaw; }
      return;
    }
    if (!vdrag) return;
    if (Math.hypot(e.clientX - vdrag.x, e.clientY - vdrag.y) > 4) vdrag.moved = true;
    if (!vdrag.moved || !vdrag.start) return;
    // o ponto do chão que estava sob o cursor continua sob o cursor
    cam.panX = vdrag.px; cam.panZ = vdrag.pz; updateCamera();
    const now = groundAt(e.clientX, e.clientY); if (!now) return;
    cam.panX = vdrag.px + vdrag.start.x - now.x; cam.panZ = vdrag.pz + vdrag.start.z - now.z;
  });
  const endPointer = (e) => {
    canvas.classList.remove('dragging', 'rotating');
    // girou: encaixa no ângulo isométrico mais próximo; só clicou (sem arrastar): vale como clique numa pessoa
    if (rot) { const r0 = rot; rot = null; if (r0.moved) { cam.yawGoal = snapYaw(cam.yaw); return; } }
    else { const was = vdrag; vdrag = null; if (!was || was.moved) return; }
    if (e.type !== 'pointerup') return;
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

  /* ---------- editor da sala (modo Construir) sobre o 3D ----------
     O editor continua sendo o de web/js (17-entrada.js), com as mesmas regras. Aqui só trocamos as duas funções de
     projeção (sala → tela e tela → piso) pelas da câmera 3D, e o clique em móveis/paredes/pessoas vira um raio 3D. */
  const editing = () => mode === 'build';
  const offset = () => { const r = scene2d.getBoundingClientRect(); return [r.left, r.top]; };
  const iso2d = window.iso, unIso2d = window.unIso, hitAny2d = window.hitAny, hitPerson2d = window.hitPerson;
  let lastGround = { x: 0, z: 0 };
  window.iso = (x, z, y = 0, V) => { if (!editing()) return iso2d(x, z, y, V); const [ox, oy] = offset(), q = toScreen(x, y, z); return [Math.round(q[0] - ox), Math.round(q[1] - oy)]; };
  window.unIso = (sx, sy) => { if (!editing()) return unIso2d(sx, sy); const [ox, oy] = offset(), g = groundAt(sx + ox, sy + oy); if (g) lastGround = { x: g.x, z: g.z }; return { ...lastGround }; };
  const _box = new THREE.Box3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _hit = new THREE.Vector3();
  const rayFrom = (sx, sy) => { const [ox, oy] = offset(); ray.setFromCamera(ndc(sx + ox, sy + oy), camera); return ray.ray; };
  // o item mais perto da câmera sob o cursor (os "planos", como tapetes, perdem para o que está em cima)
  window.hitAny = (sx, sy, only) => {
    if (!editing()) return hitAny2d(sx, sy, only);
    const r = rayFrom(sx, sy); let best = null, bd = Infinity;
    const test = (bx, sel, flat) => { _box.set(_a.set(bx.x, bx.y, bx.z), _b.set(bx.x + bx.w, bx.y + Math.max(bx.h, .02), bx.z + bx.d)); if (!r.intersectBox(_box, _hit)) return; const d = _hit.distanceTo(r.origin) + (flat ? 1000 : 0); if (d < bd) { bd = d; best = sel; } };
    if (only !== 'wall') for (const o of W.objects) for (const bx of worldBoxes(o)) test(bx, { type: 'obj', id: o.id }, ITEMS[o.item]?.flat);
    // a porta de entrada (desenhada na parede) também se pega pelo vão, não só pelo capacho
    const D = only !== 'wall' && doorInfo();
    if (D) { const t = .3, len = D.u1 - D.u0; test(D.side === 'x' ? { x: D.c - t / 2, z: D.u0, w: t, d: len, y: 0, h: 2.1 } : { x: D.u0, z: D.c - t / 2, w: len, d: t, y: 0, h: 2.1 }, { type: 'obj', id: D.o.id }, false); }
    if (only !== 'obj') for (const s of W.walls) for (const bx of segBoxes(s)) test(bx, { type: 'wall', id: s.id }, false);
    return best;
  };
  // pessoa (no editor ficam paradas no lugar delas): perto do segmento pé → cabeça na tela
  window.hitPerson = (sx, sy) => {
    if (!editing()) return hitPerson2d(sx, sy);
    for (const p of [...W.people].reverse()) {
      const a = window.iso(p.pos[0], p.pos[1], 0), b = window.iso(p.pos[0], p.pos[1], 1.4);
      const t = Math.max(0, Math.min(1, ((sx - a[0]) * (b[0] - a[0]) + (sy - a[1]) * (b[1] - a[1])) / ((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2 || 1)));
      if (Math.hypot(sx - (a[0] + (b[0] - a[0]) * t), sy - (a[1] + (b[1] - a[1]) * t)) < 16) return p;
    }
    return null;
  };
  // câmera comandada pelo editor (o canvas do editor fica por cima e recebe o mouse)
  let edPan = null, edRot = null;
  const camAPI = {
    panStart(sx, sy) { const [ox, oy] = offset(); edPan = { start: groundAt(sx + ox, sy + oy), px: cam.panX, pz: cam.panZ }; },
    panMove(sx, sy) {
      if (!edPan?.start) return; const [ox, oy] = offset();
      cam.panX = edPan.px; cam.panZ = edPan.pz; updateCamera();
      const now = groundAt(sx + ox, sy + oy); if (now) { cam.panX = edPan.px + edPan.start.x - now.x; cam.panZ = edPan.pz + edPan.start.z - now.z; }
    },
    rotStart(sx) { edRot = { x: sx, yaw: cam.yaw }; },
    rotMove(sx) { if (edRot) { cam.yaw = edRot.yaw - (sx - edRot.x) * .008; cam.yawGoal = cam.yaw; } },
    rotEnd() { edRot = null; cam.yawGoal = snapYaw(cam.yaw); },
    zoomAt(f, sx, sy) {
      const [ox, oy] = offset(), before = groundAt(sx + ox, sy + oy);
      cam.zoom = Math.min(5, Math.max(.6, cam.zoom * f)); updateCamera();
      const after = groundAt(sx + ox, sy + oy); if (before && after) { cam.panX += before.x - after.x; cam.panZ += before.z - after.z; }
    },
  };

  /* ---------- fantasma do editor (móvel ou parede sendo arrastado, colocado ou desenhado), no próprio 3D ---------- */
  const ghost = new THREE.Group(); scene.add(ghost);
  let ghostSig = '';
  function ghostState() {
    if (mode !== 'build') return null;
    if (drag?.kind === 'move' && drag.moved) {
      if (drag.sel.type === 'obj') { const o = objById(drag.sel.id); return o && { obj: { item: o.item, rot: drag.rot ?? o.rot, color: o.color }, at: drag.at }; }
      const s = wallById(drag.sel.id); return s && { wall: { ...s, a: [s.a[0] + drag.off[0], s.a[1] + drag.off[1]], b: [s.b[0] + drag.off[0], s.b[1] + drag.off[1]] } };
    }
    if (placing && hover) {
      const o = { item: placing.item, rot: placing.rot, color: ITEMS[placing.item].color };
      return { obj: o, at: placeAt(o, hover) };
    }
    const gw = wallGhost(); if (gw && segInfo(gw).len > 0) return { wall: gw };
    return null;
  }
  function updateGhost() {
    const g = ghostState(), k = g ? JSON.stringify(g) : '';
    if (k === ghostSig) return; ghostSig = k;
    ghost.traverse(o => { if (o.isMesh) o.geometry.dispose(); }); ghost.clear();
    if (!g) return;
    const op = batcher(), gl = batcher();
    if (g.obj) { addObject(g.obj, g.at, op, gl); addAnimStatic(g.obj, g.at, op, gl); }
    else for (const bx of segBoxes(g.wall)) { if (bx.w <= 0 || bx.h <= 0 || bx.d <= 0) continue; const [x, y, z] = center(bx); (bx.glass ? gl : op).add(rbox(bx.w, Math.max(bx.h, .004), bx.d), matFor(bx, true), x, y, z); }
    op.flush(ghost, { outline: true }); gl.flush(ghost, { shadows: false, layer: 1 });
  }

  /* ---------- marcas do editor no piso (seleção, área verde/vermelha, pincel, grade, alças "+") ----------
     Vêm de editorMarks() (09-cena.js). São malhas na camada 1 (sem contorno, desenhadas depois da cena com o
     mesmo teste de profundidade): o que está na frente esconde a marca, como num objeto de verdade. */
  const marks = new THREE.Group(); scene.add(marks);
  let marksSig = '';
  const markMats = new Map();
  // top = por cima de tudo (alças "+" atrás das paredes do fundo precisam aparecer)
  const mmat = (c, a, top = false) => { const k = c + '|' + a + '|' + top; if (!markMats.has(k)) markMats.set(k, new THREE.MeshBasicMaterial({ color: new THREE.Color(c), transparent: true, opacity: a, depthWrite: false, depthTest: !top, toneMapped: false, side: THREE.DoubleSide })); return markMats.get(k); };
  const plane = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), disc = new THREE.CircleGeometry(.5, 28).rotateX(-Math.PI / 2);
  // traços do "+" a 45° da grade: na vista isométrica (giros de 90°) aparecem na vertical e na horizontal
  const plusA = new THREE.PlaneGeometry(.5, .09).rotateX(-Math.PI / 2).rotateY(Math.PI / 4), plusB = plusA.clone().rotateY(Math.PI / 2);
  const ringG = new THREE.RingGeometry(.4, .5, 28).rotateX(-Math.PI / 2);
  const addMark = (geo, mat, x, y, z, sx = 1, sz = 1, order = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, 1, sz); m.layers.set(1); m.renderOrder = order; m.matrixAutoUpdate = false; m.updateMatrix(); marks.add(m); };
  // borda de uma área: tiras finas (linha de 1 px some de longe); tracejada = tiras curtas com intervalo
  function border(q, mat, y) {
    const t = .045, dash = q.dash ? [.2, .13] : null;
    const run = (x0, z0, x1, z1) => {
      const len = Math.hypot(x1 - x0, z1 - z0), ux = (x1 - x0) / len, uz = (z1 - z0) / len, alongX = Math.abs(ux) > .5;
      const seg = (a, b) => { const cx = x0 + ux * (a + b) / 2, cz = z0 + uz * (a + b) / 2; addMark(plane, mat, cx, y, cz, alongX ? b - a : t, alongX ? t : b - a, 2); };
      if (!dash) seg(0, len); else for (let a = 0; a < len; a += dash[0] + dash[1]) seg(a, Math.min(len, a + dash[0]));
    };
    const i = t / 2;
    run(q.x, q.z + i, q.x + q.w, q.z + i); run(q.x, q.z + q.d - i, q.x + q.w, q.z + q.d - i);
    run(q.x + i, q.z, q.x + i, q.z + q.d); run(q.x + q.w - i, q.z, q.x + q.w - i, q.z + q.d);
  }
  function updateMarks() {
    const list = mode === 'build' ? editorMarks().filter(m => m.k !== 'label') : [], sig = list.length ? JSON.stringify(list) : '';
    if (sig === marksSig) return; marksSig = sig;
    marks.clear();
    // grade de pontos: uma malha instanciada
    const dots = list.filter(m => m.k === 'dot' && !m.ring);
    if (dots.length) {
      const im = new THREE.InstancedMesh(plane, mmat(dots[0].c, dots[0].a), dots.length), M = new THREE.Matrix4();
      dots.forEach((d, i) => im.setMatrixAt(i, M.makeScale(d.r * 2, 1, d.r * 2).setPosition(d.x, .012, d.z)));
      im.layers.set(1); marks.add(im);
    }
    for (const m of list) {
      if (m.k === 'quad') {
        const y = (m.y ?? .02) - .005;
        addMark(plane, mmat(m.fill, m.a), m.x + m.w / 2, y, m.z + m.d / 2, m.w, m.d, 1);
        if (m.line) border(m, mmat(m.line, .95), y + .002);
      } else if (m.k === 'dot' && m.ring) {
        addMark(disc, mmat('#FFFFFF', 1), m.x, .03, m.z, m.r * 2 + .1, m.r * 2 + .1, 3); addMark(disc, mmat(m.c, 1), m.x, .032, m.z, m.r * 2, m.r * 2, 4);
      } else if (m.k === 'handle') {
        // botão redondo "+" deitado no piso, do lado de fora da sala
        const R = 1, fg = m.hot ? '#FFFFFF' : '#8C4FE0';
        addMark(disc, mmat('#24252B', .14, true), m.x + .06, .01, m.z + .06, R, R, 5);
        addMark(disc, mmat(m.hot ? '#8C4FE0' : '#FFFFFF', 1, true), m.x, .03, m.z, R, R, 6);
        addMark(ringG, mmat('#8C4FE0', 1, true), m.x, .034, m.z, R, R, 7);
        addMark(plusA, mmat(fg, 1, true), m.x, .036, m.z, 1, 1, 8); addMark(plusB, mmat(fg, 1, true), m.x, .036, m.z, 1, 1, 8);
      }
    }
  }

  /* ---------- laço ---------- */
  // 3D nos dois modos: ao vivo e no editor (Construir)
  const active = () => mode === 'live' || mode === 'build';
  window.R3D = {
    active, editing, wanted: true, stats: { fps: 0 }, fit: fit3d, ...camAPI,
    // imagem de um móvel para a crítica visual (PNG, fundo claro, ~384×288)
    itemShot: (k) => thumbs3d.item(k, 192, 144, 0xF2F1F4),
    // refaz a sala na próxima volta do laço (ex.: o desenho de um móvel mudou no catálogo)
    rebuild: () => { sig = ''; },
  };
  let sig = '', frames = 0, fpsT = performance.now(), n = 0, lastHid = null;
  function loop(now) {
    requestAnimationFrame(loop);
    const on = active();
    canvas.style.display = ui.style.display = on ? 'block' : 'none';
    // ao vivo o canvas 2D some; no editor ele fica transparente por cima (marcas do editor) e recebe o mouse
    const ed = on && editing();
    scene2d.style.visibility = on && !ed ? 'hidden' : 'visible';
    scene2d.style.zIndex = ed ? '2' : '';
    if (!on) { document.documentElement.classList.remove('espera3d'); return; }
    const T = now / 1000;
    const hid = movingId();
    if (hid !== lastHid || n++ % 20 === 0) { const s = JSON.stringify([W.objects, W.walls, W.wall, W.tiles, hid]); lastHid = hid; if (s !== sig) { sig = s; rebuild(); } }
    updateGhost(); updateMarks();
    updateLights(); updateAnimations(T); updatePeople(T); updateCamera(); composer.render(); drawTags(T);
    if (document.documentElement.classList.contains('espera3d')) window.loadStep?.(.9, 'Quase pronto…');
    document.documentElement.classList.remove('espera3d'); // primeiro quadro 3D pronto: pode mostrar
    frames++; if (now - fpsT > 1000) { window.R3D.stats.fps = Math.round(frames * 1000 / (now - fpsT)); frames = 0; fpsT = now; }
  }
  requestAnimationFrame(loop);
}
