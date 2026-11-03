// Personagens 3D a partir de modelos GLB de malha única com textura (gerados no Meshy, com rig).
//
// Um modelo por tipo de cabelo/corpo (MODELS); cada pessoa usa o modelo do seu penteado (POR_PENTEADO).
// Como cada modelo é uma peça só, a cor de cada agente sai da própria textura: cada pixel é classificado
// pela cor (cabelo, pele, camiseta, escuro, sola, boca) e, no caso do escuro, pela posição no corpo
// (pés = tênis, rosto = olhos, resto da cabeça = cabelo quando o cabelo é escuro, resto = calça).
// Depois a textura é repintada com as cores da pessoa, mantendo as variações de luz do original.
// Poses: os mesmos parâmetros dos outros estilos, aplicados aos ossos.

// cores de referência de cada textura (amostradas do modelo gerado) → função
// Todos gerados com óculos, fone, crachá (e barba nos meninos); cada acessório é uma ilha de malha (centro em
// alturas do corpo) e o que a pessoa não usa fica escondido. "roles" marca as peças cuja textura foi pintada
// por baixo do acessório (tronco, rosto, cabelo), para a repintura apagar essas marcas.
const MODELS = {
  menino_curto: { file: 'menino_acessorios.glb', a: { hair: '#F07810', hair2: '#F3A75B', skin: '#FDB784', shirt: '#720A98', dark: '#17161E', sole: '#B9B0B5', mouth: '#992D25' },
    roles: { torso: [[0, .37, .005]], face: [[.005, .725, -.02]], head: [[0, .77, 0], [-.155, .665, 0], [.145, .665, 0]] },
    acc: { oculos: [[0, .67, .12]], fone: [[0, .845, -.005], [-.2, .665, 0], [-.2, .66, 0], [.2, .66, 0]], cracha: [[0, .38, .095], [0, .41, .1], [0, .45, .02]], barba: [[0, .59, .085]] } },
  menina_longo: { file: 'menina_longo_acessorios.glb', a: { hair: '#7A3709', skin: '#F1A976', skin2: '#EFC9AC', shirt: '#6E1389', dark: '#14121C', sole: '#C1BABD' }, eyeband: false,
    roles: { torso: [[-.093, .378, .035]], face: [[.005, .726, .026]], head: [[0, .664, -.005], [0, .663, -.002]] },
    acc: { oculos: [[0, .708, .13]], fone: [[0, .845, .036], [-.224, .701, .037], [.217, .701, .037], [.231, .701, .037], [.231, .7, .037]], cracha: [[0, .473, .053], [-.001, .424, .144], [0, .385, .138]] } },
  menina_rabo: { file: 'menina_coque_acessorios.glb', a: { hair: '#EF7412', skin: '#F1AF75', shirt: '#710BA2', dark: '#1A191F', sole: '#B9B1B5' }, eyeband: false,
    roles: { torso: [[-.002, .338, .045]], face: [[-.002, .671, .047]], head: [[0, .714, .033], [-.001, .887, -.139]] },
    // as "lentes" (−.065/.065, .653) são onde os olhos foram pintados: ficam sempre visíveis
    acc: { oculos: [[0, .65, .221], [-.159, .656, .12], [.159, .656, .12]], fone: [[0, .8, .043], [-.2, .637, .049], [.2, .636, .049]], cracha: [[0, .432, .074], [-.001, .389, .149], [0, .352, .139]] } },
  menino_cacheado: { file: 'menino_cacheado_acessorios.glb', a: { hair: '#341910', skin: '#F7B97E', shirt: '#671190', dark: '#1E1A20', sole: '#CCC0C3', mouth: '#8F2229' }, darkHair: true,
    roles: { torso: [[0, .364, .027]], face: [[0, .704, .027]] },
    acc: { oculos: [[0, .662, .138]], fone: [[0, .823, .057], [-.224, .711, .054], [.223, .711, .054], [-.189, .654, .057], [.189, .654, .057], [-.224, .651, .06], [.223, .651, .06], [-.175, .87, .056], [.176, .87, .058]], cracha: [[0, .447, .051], [.002, .404, .123], [0, .365, .122]], barba: [[0, .565, .12]] } },
  // raspado: armação sem lentes (os olhos são peças à parte) e fone separado do cabelo raspado
  menino_raspado: { file: 'menino_raspado_acessorios.glb', a: { hair: '#6E5B50', skin: '#F9AD7D', shirt: '#66088F', dark: '#14101A', sole: '#9F9493' },
    roles: { torso: [[-.001, .302, .017]], face: [[0, .755, 0]] },
    acc: { oculos: [[-.002, .729, .181], [-.171, .724, .066], [.169, .724, .066]], fone: [[0, .857, .004], [-.197, .709, .004], [.197, .709, .004], [-.22, .701, .004], [.219, .701, .004], [-.182, .699, -.012], [.181, .699, -.012]], cracha: [[0, .455, .035]], barba: [[0, .617, .1]] } },
  menino_franja: { file: 'menino_franja_acessorios.glb', a: { hair: '#F3790D', skin: '#F6B382', shirt: '#620E80', dark: '#111016', sole: '#DCD6DA' },
    roles: { torso: [[.001, .409, .014]], face: [[.001, .743, .018]], head: [[.001, .747, 0]] }, chinOnHead: true,
    acc: { oculos: [[-.075, .705, .177], [.076, .705, .177], [0, .717, .179], [-.156, .711, .066], [.157, .711, .066]], fone: [[.001, .865, .005], [-.181, .688, .005], [.181, .688, .005], [-.217, .685, .007], [.218, .685, .007], [-.155, .68, .014], [.16, .68, .014]], cracha: [[.001, .464, .033], [.001, .417, .119], [.001, .382, .114]], barba: [[.001, .649, .063]] } },
    menina_rabo2: { file: 'menina_rabo_acessorios.glb', a: { hair: '#ED7E0C', skin: '#F4B788', shirt: '#70089E', dark: '#17151B', sole: '#DBC3B4' },
    roles: { torso: [[-.001, .389, .053]], face: [[0, .712, .044]], head: [[-.008, .557, 0], [-.138, .365, -.153]] },
    acc: { oculos: [[-.081, .675, .226], [.078, .675, .226], [-.002, .694, .227], [-.158, .689, .14], [.158, .689, .14]], fone: [[-.001, .844, .061], [-.182, .659, .055], [.182, .658, .055], [-.213, .656, .057], [.213, .656, .056]], cracha: [[-.001, .444, .07], [.001, .385, .156], [-.002, .352, .146]] } },
};
const POR_PENTEADO = { curto: 'menino_curto', franja: 'menino_franja', longo: 'menina_longo', rabo: 'menina_rabo2', coque: 'menina_rabo', cacheado: 'menino_cacheado', raspado: 'menino_raspado' };

// exportados para os testes (conferem que cada peça listada existe no .glb)
export { MODELS, POR_PENTEADO };

export async function characterKit({ THREE }) {
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const SkeletonUtils = await import('three/addons/utils/SkeletonUtils.js');
  const FLAT = new URLSearchParams(location.search).get('flat') !== '0';
  const TWO = (() => { const t = new THREE.DataTexture(new Uint8Array([170, 255]), 2, 1, THREE.RedFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true; return t; })();
  const HEIGHT = 1.45, CS = 0.6, LAYER = 3, MESHES = new Set(), TS = 1024;
  const nm = (n) => n.replace(/^mixamorig:?/, '');
  const bonesOf = (root) => { const m = {}; root.traverse(o => { if (o.isBone) m[nm(o.name)] = o; }); return m; };
  const wp = (b) => b.getWorldPosition(new THREE.Vector3());
  const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  // cores em sRGB 0–255, como os pixels da textura (THREE.Color converteria para o espaço linear)
  const rgb = (h) => { const n = parseInt(String(h).replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const ZK = ['hair', 'skin', 'shirt', 'pants', 'sole', 'mouth', 'shoe', 'eye', 'keep'];   // keep = cor original (acessórios)
  const loader = new GLTFLoader();

  // prepara um modelo: ossos de repouso, escala, mapa de funções da textura
  async function prep(id) {
    // no arquivo único os modelos vêm embutidos (PIXELHQ_MODELOS: arquivo → data: URL)
    const def = MODELS[id], gltf = await loader.loadAsync(globalThis.PIXELHQ_MODELOS?.[def.file] || '/modelos/' + def.file), base = gltf.scene; base.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(base), SC = HEIGHT / (box.max.y - box.min.y);
    const B0 = bonesOf(base), bindW = {}, bindL = {};
    for (const [k, b] of Object.entries(B0)) { bindW[k] = b.getWorldQuaternion(new THREE.Quaternion()); bindL[k] = b.quaternion.clone(); }
    const M = { id, base, SC, minY: box.min.y, bindW, bindL, hipsParentW: B0.Hips.parent.getWorldQuaternion(new THREE.Quaternion()), hipsH: (wp(B0.Hips).y - box.min.y) * SC, LEFT: Math.sign(wp(B0.LeftArm).x) || 1, downQ: {}, texCache: new Map() };
    M.HIPY = M.hipsH / CS;
    // direção do braço no repouso (T ou A-pose) → rotação que o deixa pendurado
    for (const s of ['Left', 'Right']) M.downQ[s] = new THREE.Quaternion().setFromUnitVectors(wp(B0[s + 'ForeArm']).sub(wp(B0[s + 'Arm'])).normalize(), new THREE.Vector3(0, -1, 0));
    let sk = null; base.traverse(o => { if (o.isMesh && !sk) sk = o; });
    const src = cv(TS, TS).getContext('2d', { willReadFrequently: true }); src.drawImage(sk.material.map.image, 0, 0, TS, TS);
    M.SRC = src.getImageData(0, 0, TS, TS).data;
    // ilhas de malha (peças) e quais pertencem a cada acessório
    if (def.acc) {
      const g = sk.geometry, P = g.attributes.position, I = g.index, key = new Map(), wid = new Int32Array(P.count), v = new THREE.Vector3();
      for (let i = 0; i < P.count; i++) { const k = P.getX(i).toFixed(4) + ',' + P.getY(i).toFixed(4) + ',' + P.getZ(i).toFixed(4); if (!key.has(k)) key.set(k, key.size); wid[i] = key.get(k); }
      const par = new Int32Array(key.size).map((_, i) => i), fd = (x) => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
      for (let t = 0; t < I.count; t += 3) { const a = fd(wid[I.getX(t)]); par[fd(wid[I.getX(t + 1)])] = a; par[fd(wid[I.getX(t + 2)])] = a; }
      const triIsl = new Int32Array(I.count / 3), bb = new Map();
      let y0 = Infinity, y1 = -Infinity; for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i).applyMatrix4(sk.matrixWorld); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }
      for (let t = 0; t < I.count; t += 3) {
        const r = fd(wid[I.getX(t)]); triIsl[t / 3] = r; if (!bb.has(r)) bb.set(r, new THREE.Box3());
        for (let q = 0; q < 3; q++) bb.get(r).expandByPoint(v.fromBufferAttribute(P, I.getX(t + q)).applyMatrix4(sk.matrixWorld));
      }
      const H = y1 - y0, centers = [...bb].map(([r, b]) => { const c = b.getCenter(new THREE.Vector3()); return [r, c.x / H, (c.y - y0) / H, c.z / H]; });
      // cada ponto escolhe a ilha mais próxima ainda não escolhida (há peças repetidas no mesmo lugar)
      const pick = (list) => { const used = new Set(); for (const [x, y, z] of list) { let best = null, bd = 1e9; for (const [r, cx, cy, cz] of centers) { if (used.has(r)) continue; const d = (cx - x) ** 2 + (cy - y) ** 2 + (cz - z) ** 2; if (d < bd) { bd = d; best = r; } } if (best != null && bd < .004) used.add(best); } return used; };
      M.accIsl = {}; for (const [name, list] of Object.entries(def.acc)) M.accIsl[name] = pick(list);
      // peças "de baixo" dos acessórios: a textura delas foi pintada como se o acessório estivesse lá
      M.role = new Map(); for (const [role, list] of Object.entries(def.roles || {})) for (const r of pick(list)) M.role.set(r, role);
      for (const [name, set] of Object.entries(M.accIsl)) for (const r of set) M.role.set(r, name === 'barba' ? 'beard' : 'acc');   // barba é repintada com a cor do cabelo   // acessórios: cor original (só repinta o que for de pele/cabelo/roupa)
      M.faceBox = new THREE.Box3(); for (const [r, role] of M.role) if (role === 'face') M.faceBox.union(bb.get(r));
      M.torsoBox = new THREE.Box3(); for (const [r, role] of M.role) if (role === 'torso') M.torsoBox.union(bb.get(r));
      M.triIsl = triIsl; M.index = I.array; M.geoCache = new Map();
    }
    // região do corpo por pixel da textura: desenha cada triângulo no espaço UV (0 corpo, 1 pés, 2 cabeça, 3 rosto)
    const reg = cv(TS, TS).getContext('2d', { willReadFrequently: true });
    {
      const g = sk.geometry, P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv, I = g.index, v = new THREE.Vector3(), n3 = new THREE.Vector3(), nmx = new THREE.Matrix3().getNormalMatrix(sk.matrixWorld);
      const ys = new Float32Array(P.count), xs = new Float32Array(P.count), nz = new Float32Array(P.count); let y0 = Infinity, y1 = -Infinity, x0 = Infinity, x1 = -Infinity;
      for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i).applyMatrix4(sk.matrixWorld); ys[i] = v.y; xs[i] = v.x; y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); if (N) nz[i] = n3.fromBufferAttribute(N, i).applyMatrix3(nmx).normalize().z; }
      const H = y1 - y0, feet = y0 + H * .1, head = y0 + H * .55, eye0 = y0 + H * .62, eye1 = y0 + H * .76, cx = (x0 + x1) / 2, hw = (x1 - x0) * .14;
      const n = I ? I.count : P.count;
      for (let t = 0; t < n; t += 3) {
        const a = I ? I.getX(t) : t, b = I ? I.getX(t + 1) : t + 1, c = I ? I.getX(t + 2) : t + 2;
        const my = (ys[a] + ys[b] + ys[c]) / 3, mx = (xs[a] + xs[b] + xs[c]) / 3, mz = (nz[a] + nz[b] + nz[c]) / 3;
        const r = my < feet ? 80 : my > head ? (my > eye0 && my < eye1 && Math.abs(mx - cx) < hw && mz > .35 ? 240 : 160) : 0;
        const role = M.role ? M.role.get(M.triIsl[t / 3]) : null;
        // 60 tronco · 120 cabeça/cabelo · 180 queixo · 220 faixa dos olhos (frente do rosto)
        const fb = M.faceBox, rel = fb ? (my - fb.min.y) / Math.max(1e-6, fb.max.y - fb.min.y) : 0, front = mz > .2;
        // rosto: 180 queixo · 220 faixa dos olhos (olhos são peças à parte) · 140 frente do rosto com olhos pintados · 120 trás/laterais
        // tronco: só o peito (frente, no meio, acima da cintura) recebe a correção do crachá; braço e cintura fundidos ficam como estão
        const tb = M.torsoBox, trel = tb && !tb.isEmpty() ? (my - tb.min.y) / Math.max(1e-6, tb.max.y - tb.min.y) : 0;
        const chest = front && Math.abs(mx - cx) < H * .1 && trel > .2;
        const gcode = role === 'acc' ? 250 : role === 'torso' ? (chest ? 60 : 0) : role === 'head' ? (def.chinOnHead && fb && front && rel < .33 && Math.abs(mx - (fb.min.x + fb.max.x) / 2) < (fb.max.x - fb.min.x) * .4 ? 180 : 120) : role === 'face' ? (front && rel < .33 ? 180 : front && rel < .63 ? (def.eyeband !== false ? 220 : 140) : front ? 140 : 120) : 0;
        reg.fillStyle = `rgb(${r},${gcode},0)`;
        reg.beginPath(); reg.moveTo(U.getX(a) * TS, U.getY(a) * TS); reg.lineTo(U.getX(b) * TS, U.getY(b) * TS); reg.lineTo(U.getX(c) * TS, U.getY(c) * TS); reg.closePath(); reg.fill();
      }
    }
    const REG = reg.getImageData(0, 0, TS, TS).data;
    // "sombra" da armação dos óculos: pixels do rosto/cabelo que ficam exatamente sob a armação (posição 3D de cada
    // pixel da textura, calculada por rasterização no espaço UV); ali a textura tem o traço pintado da armação
    const SHADOW = new Uint8Array(TS * TS);   // 1 = sob a armação, no rosto · 2 = sob a armação, no cabelo
    if (M.accIsl && M.accIsl.oculos && M.accIsl.oculos.size && !def.noShadow) {
      const g = sk.geometry, P = g.attributes.position, U = g.attributes.uv, I = g.index, W = sk.matrixWorld;
      const pos = new Float32Array(P.count * 3), v = new THREE.Vector3(); let y0 = Infinity, y1 = -Infinity;
      for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i).applyMatrix4(W); pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z; y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }
      const H = y1 - y0, CELL = .01 * H, THR = .011 * H, grid = new Map(), lumAt = (u, w) => { const px = Math.min(TS - 1, Math.max(0, u * TS | 0)), py = Math.min(TS - 1, Math.max(0, w * TS | 0)), k = (py * TS + px) * 4; return (M.SRC[k] + M.SRC[k + 1] + M.SRC[k + 2]) / 3; };
      const put = (x, y) => { const k = Math.floor(x / CELL) + ',' + Math.floor(y / CELL); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(x, y); };
      // pontos da armação: amostras dentro dos triângulos escuros da ilha dos óculos
      const SAMP = [[1, 0, 0], [0, 1, 0], [0, 0, 1], [1 / 3, 1 / 3, 1 / 3], [.5, .5, 0], [0, .5, .5], [.5, 0, .5], [.7, .15, .15], [.15, .7, .15], [.15, .15, .7]];
      for (let t = 0; t < I.count; t += 3) {
        if (!M.accIsl.oculos.has(M.triIsl[t / 3])) continue;
        const a = I.getX(t), b = I.getX(t + 1), c = I.getX(t + 2);
        for (const [wa, wb, wc] of SAMP) {
          const u = U.getX(a) * wa + U.getX(b) * wb + U.getX(c) * wc, w = U.getY(a) * wa + U.getY(b) * wb + U.getY(c) * wc;
          if (lumAt(u, w) > 80) continue;   // só a armação (escura); lente e reflexo não contam
          put(pos[a * 3] * wa + pos[b * 3] * wb + pos[c * 3] * wc, pos[a * 3 + 1] * wa + pos[b * 3 + 1] * wb + pos[c * 3 + 1] * wc);
        }
      }
      const near = (x, y) => { const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL); for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const L = grid.get((cx + i) + ',' + (cy + j)); if (L) for (let q = 0; q < L.length; q += 2) if ((L[q] - x) ** 2 + (L[q + 1] - y) ** 2 < THR * THR) return true; } return false; };
      const e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
      for (let t = 0; t < I.count; t += 3) {
        const isl = M.triIsl[t / 3], role = M.role.get(isl); if (role === 'acc' || role === 'torso') continue;
        const a = I.getX(t), b = I.getX(t + 1), c = I.getX(t + 2);
        if ((pos[a * 3 + 1] + pos[b * 3 + 1] + pos[c * 3 + 1]) / 3 < y0 + H * .5) continue;   // só a cabeça
        e1.set(pos[b * 3] - pos[a * 3], pos[b * 3 + 1] - pos[a * 3 + 1], pos[b * 3 + 2] - pos[a * 3 + 2]); e2.set(pos[c * 3] - pos[a * 3], pos[c * 3 + 1] - pos[a * 3 + 1], pos[c * 3 + 2] - pos[a * 3 + 2]);
        if (e1.cross(e2).normalize().z < .15) continue;                                         // só o que olha para a frente
        const ax = U.getX(a) * TS, ay = U.getY(a) * TS, bx = U.getX(b) * TS, by = U.getY(b) * TS, qx = U.getX(c) * TS, qy = U.getY(c) * TS;
        const den = (by - qy) * (ax - qx) + (qx - bx) * (ay - qy); if (Math.abs(den) < 1e-9) continue;
        const x0 = Math.max(0, Math.floor(Math.min(ax, bx, qx))), x1 = Math.min(TS - 1, Math.ceil(Math.max(ax, bx, qx))), yA = Math.max(0, Math.floor(Math.min(ay, by, qy))), yB = Math.min(TS - 1, Math.ceil(Math.max(ay, by, qy)));
        const tag = role === 'head' || (def.darkHair && !role) ? 2 : 1;
        for (let py = yA; py <= yB; py++) for (let px = x0; px <= x1; px++) {
          const X = px + .5, Y = py + .5, wa = ((by - qy) * (X - qx) + (qx - bx) * (Y - qy)) / den, wb = ((qy - ay) * (X - qx) + (ax - qx) * (Y - qy)) / den, wc = 1 - wa - wb;
          if (wa < -.02 || wb < -.02 || wc < -.02) continue;
          if (near(pos[a * 3] * wa + pos[b * 3] * wb + pos[c * 3] * wc, pos[a * 3 + 1] * wa + pos[b * 3 + 1] * wb + pos[c * 3 + 1] * wc)) SHADOW[py * TS + px] = tag;
        }
      }
    }
    const AN = Object.entries(def.a).map(([k, h]) => [k.replace(/\d+$/, ''), ...rgb(h)]);
    M.ZONE = new Uint8Array(TS * TS); M.FIX = new Uint8Array(TS * TS);
    for (let i = 0; i < TS * TS; i++) {
      const r = M.SRC[i * 4], g = M.SRC[i * 4 + 1], b = M.SRC[i * 4 + 2]; let best = 0, bd = 1e9;
      for (let k = 0; k < AN.length; k++) { const d = (r - AN[k][1]) ** 2 + (g - AN[k][2]) ** 2 + (b - AN[k][3]) ** 2; if (d < bd) { bd = d; best = k; } }
      let z = AN[best][0];
      const role = REG[i * 4 + 1];
      if (role >= 245) { M.ZONE[i] = ZK.indexOf('keep'); continue; }   // acessório: cor original do modelo
      if (z === 'shirt' && REG[i * 4] > 120) z = 'eye';   // tom arroxeado na cabeça (olhos em peças à parte) é olho
      if (z === 'dark') { const rg = REG[i * 4]; z = rg > 200 ? 'eye' : rg > 120 ? (def.darkHair ? 'hair' : 'eye') : rg > 40 ? 'shoe' : 'pants'; }
      // pixels corrigidos recebem a cor chapada (sem herdar a luz da marca pintada)
      if (role > 40 && role < 90) { M.FIX[i] = 1; z = 'shirt'; }   // tronco: cor chapada (some a marca do crachá e do cordão)
      else if (role > 100) {
        if (role < 135 && (z === 'eye' || z === 'pants' || z === 'shoe' || z === 'sole')) { z = 'hair'; M.FIX[i] = 1; }   // trás/laterais da cabeça: marca do fone vira cabelo
        if (role > 135 && role < 150 && (z === 'hair' || z === 'sole')) { z = 'skin'; M.FIX[i] = 1; }                      // frente do rosto com olhos pintados: marca da armação vira pele (olhos ficam)
        if (role > 135 && z === 'shirt') z = 'eye';
        if (role > 135 && z === 'shirt') z = 'eye';   // tom arroxeado no rosto é olho, não camiseta
        if (role > 150 && role < 200 && z === 'hair') { z = 'skin'; M.FIX[i] = 1; }                     // queixo: barba pintada vira pele
        if (role > 200 && role < 225 && z !== 'skin') { z = 'skin'; M.FIX[i] = 1; }   // faixa dos olhos: marca dos óculos vira pele
      }   // cabeça: marca do fone vira cabelo; queixo: barba pintada vira pele
      // sob a armação: o traço pintado vira pele (no rosto) ou cabelo (na franja e nas laterais)
      if (SHADOW[i] === 2 && z !== 'hair') { z = 'hair'; M.FIX[i] = 1; }
      else if (SHADOW[i] === 1 && z !== 'hair') { z = 'skin'; M.FIX[i] = 2; }   // inclusive o que já era pele: tom médio da pele do rosto (sem o brilho da marca)
      M.ZONE[i] = ZK.indexOf(z);
    }
    // tom médio da pele do rosto (brilho em relação à cor de referência), para os pixels corrigidos não destoarem
    { const a = rgb(def.a.skin), al = (a[0] + a[1] + a[2]) / 3; let sum = 0, n = 0;
      for (let i = 0; i < TS * TS; i++) if (ZK[M.ZONE[i]] === 'skin' && !M.FIX[i] && REG[i * 4 + 1] > 135 && REG[i * 4 + 1] < 245) { sum += ((M.SRC[i * 4] + M.SRC[i * 4 + 1] + M.SRC[i * 4 + 2]) / 3 + 8) / (al + 8); n++; }
      M.skinK = n ? Math.min(1.3, Math.max(.7, sum / n)) : 1; }
    M.anchorOf = { hair: def.a.hair || def.a.dark, skin: def.a.skin, shirt: def.a.shirt, pants: def.a.dark, shoe: def.a.dark, eye: def.a.dark, sole: def.a.sole, mouth: def.a.mouth || def.a.dark };
    return M;
  }
  // carregamento sob demanda: só baixa o modelo de um penteado quando alguém o usa (ready() dispara o carregamento)
  const PREP = {}, LOADING = {};
  const load = (id) => (LOADING[id] ??= prep(id).then(M => (PREP[id] = M)).catch(e => { console.warn('[3D] modelo não carregou:', id, e); delete LOADING[id]; throw e; }));
  const idOf = (p) => POR_PENTEADO[(p && p.hairStyle) || 'curto'] || 'menino_curto';
  function ready(p) { const id = idOf(p); if (PREP[id]) return true; load(id).catch(() => {}); return false; }
  // antes de devolver o kit: o modelo de referência e os modelos das pessoas que já existem
  const initial = new Set(['menino_curto', ...((globalThis.W && W.people) || []).map(idOf)]);
  await load('menino_curto'); await Promise.allSettled([...initial].map(load));

  function paint(M, o) {
    const key = [o.hair, o.skin, o.shirt, o.pants, o.shoes].join();
    if (M.texCache.has(key)) { const e = M.texCache.get(key); e.n++; return e.tex; }
    const want = { hair: o.hair, skin: o.skin, shirt: o.shirt, pants: o.pants, shoe: o.shoes, eye: M.anchorOf.eye, sole: M.anchorOf.sole, mouth: M.anchorOf.mouth };
    const KEEP = ZK.indexOf('keep');
    const T = ZK.map(z => { if (z === 'keep') return [0, 0, 0, 1]; const a = rgb(M.anchorOf[z]), w = rgb(want[z]); return [w[0], w[1], w[2], (a[0] + a[1] + a[2]) / 3]; });
    const c = cv(TS, TS), ctx = c.getContext('2d'), out = ctx.createImageData(TS, TS), D = out.data, S = M.SRC;
    for (let i = 0; i < TS * TS; i++) {
      if (M.ZONE[i] === KEEP) { D[i * 4] = S[i * 4]; D[i * 4 + 1] = S[i * 4 + 1]; D[i * 4 + 2] = S[i * 4 + 2]; D[i * 4 + 3] = 255; continue; }
      const t = T[M.ZONE[i]];
      // mantém a variação de luz do original: razão do brilho do pixel sobre o da cor de referência
      const k = M.FIX[i] === 2 ? M.skinK : M.FIX[i] ? 1 : Math.min(1.5, Math.max(.5, ((S[i * 4] + S[i * 4 + 1] + S[i * 4 + 2]) / 3 + 8) / (t[3] + 8)));
      D[i * 4] = Math.min(255, t[0] * k); D[i * 4 + 1] = Math.min(255, t[1] * k); D[i * 4 + 2] = Math.min(255, t[2] * k); D[i * 4 + 3] = 255;
    }
    ctx.putImageData(out, 0, 0);
    const tex = new THREE.CanvasTexture(c); tex.flipY = false; tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    M.texCache.set(key, { tex, n: 1 }); return tex;
  }

  let seq = 1; const idMats = new Map();
  const idMat = (n) => { if (!idMats.has(n)) idMats.set(n, new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(((n & 31) * 8 + 4) / 255, (((n >> 5) & 31) * 8 + 4) / 255, (((n >> 10) & 31) * 8 + 4) / 255) })); return idMats.get(n); };
  const mats = new Set(); let envMap = null, envK = 1;
  function setEnv(tex, k = 1) { if (FLAT) return; envMap = tex; envK = k; for (const m of mats) { m.envMap = tex; m.envMapIntensity = k; m.needsUpdate = true; } }

  function look(p) {
    const ex = p.extras || {};
    return { skin: p.skin || '#E3B48F', hair: p.hair || '#2A1E18', style: p.hairStyle || 'curto', top: p.top || 'camiseta', shirt: p.shirt || '#2F5FD0', pants: p.pants || '#24252B', shoes: p.shoes || '#2C2E34', oculos: !!ex.oculos, fone: !!ex.fone, cracha: !!ex.cracha, barba: !!ex.barba };
  }
  const lookKey = (p) => JSON.stringify(look(p));

  function build(p) {
    const o = look(p);
    if (o.top === 'jaqueta') o.shirt = '#3A3C44';
    const M = PREP[POR_PENTEADO[o.style] || 'menino_curto'] || PREP.menino_curto;   // se ainda não carregou, usa o de referência
    const root = new THREE.Group();
    const model = SkeletonUtils.clone(M.base); model.scale.setScalar(M.SC); root.add(model);
    const region = seq++, tex = paint(M, o), texKey = [o.hair, o.skin, o.shirt, o.pants, o.shoes].join();
    // acessórios que a pessoa não usa: índice sem os triângulos dessas ilhas (geometria compartilhada por combinação)
    const hide = M.accIsl ? Object.keys(M.accIsl).filter(a => !o[a]) : [];
    model.traverse(m => {
      if (!m.isMesh) return;
      if (hide.length) {
        const hk = hide.join();
        if (!M.geoCache.has(hk)) {
          const out = [], H = new Set(hide.flatMap(a => [...M.accIsl[a]]));
          for (let t = 0; t < M.triIsl.length; t++) if (!H.has(M.triIsl[t])) out.push(M.index[t * 3], M.index[t * 3 + 1], M.index[t * 3 + 2]);
          const g = m.geometry.clone(); g.setIndex(out); M.geoCache.set(hk, g);
        }
        m.geometry = M.geoCache.get(hk);
      }
      const mat = FLAT ? new THREE.MeshToonMaterial({ map: tex, gradientMap: TWO }) : new THREE.MeshStandardMaterial({ map: tex, roughness: .85, envMap, envMapIntensity: envK });
      m.material = mat; mats.add(mat); m.userData.texKey = texKey;
      m.castShadow = m.receiveShadow = true; m.frustumCulled = false;
      m.layers.enable(LAYER); m.userData.idMat = idMat(region); MESHES.add(m);
    });
    const bones = bonesOf(model), head = new THREE.Object3D(); bones.Head.add(head);
    return { root, model, bones, head, M, pose: null, poseT: null, key: lookKey(p) };
  }

  // ---------- poses (mesmos parâmetros dos outros estilos) ----------
  const KEYS = ['hipY', 'bodyZ', 'thl', 'thr', 'knl', 'knr', 'sl', 'sr', 'slz', 'srz', 'el', 'er', 'elz', 'erz', 'tx', 'hx', 'hy'];
  const _e = new THREE.Euler(), qx = (a) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), a);
  const eul = (x, y, z) => new THREE.Quaternion().setFromEuler(_e.set(x, y, z, 'XYZ'));
  const HIPY = PREP.menino_curto.HIPY;   // referência para a cena (todos os modelos têm a mesma altura)
  function pose(v, st, t, seed) {
    const M = v.M, T = {}, dt = v.poseT == null ? 1 : Math.min(.1, Math.max(0, t - v.poseT)); v.poseT = t;
    T.hipY = M.HIPY; T.bodyZ = 0; T.thl = T.thr = T.knl = T.knr = 0;
    T.sl = T.sr = .05; T.slz = -.22; T.srz = .22; T.el = T.er = -.15; T.elz = T.erz = 0; T.tx = 0; T.hx = -.04; T.hy = 0;
    if (st.sit) { T.hipY = 1.0; T.bodyZ = -.18; T.thl = T.thr = -1.45; T.knl = T.knr = 1.45; T.sl = T.sr = -.5; T.el = T.er = -.6; }
    else if (st.moving) {
      const s = Math.sin(st.phase), c = Math.cos(st.phase);
      T.thl = .55 * s; T.thr = -.55 * s; T.knl = Math.max(0, s) * .7; T.knr = Math.max(0, -s) * .7;
      T.sl = -.5 * s; T.sr = .5 * s; T.el = T.er = -.3; T.hipY = M.HIPY + Math.abs(c) * .04; T.tx = .05;
    } else {
      T.hipY = M.HIPY + Math.sin(t * 2.2 + seed) * .008;
      T.sl = .05 + Math.sin(t * 2.2 + seed) * .03; T.sr = .05 - Math.sin(t * 2.2 + seed + 1) * .03;
      T.hy = Math.sin(t * .6 + seed * 1.7) * .15;
    }
    switch (st.act) {
      // braços curtos (proporção de boneco): braço mais baixo e antebraço à frente, para não virar "toco" visto de frente
      case 'typing': { const f = Math.sin(t * 14) * .06; T.sl = -.45 + f; T.sr = -.45 - f; T.el = T.er = -1.25; T.slz = -.3; T.srz = .3; T.hx = .1; T.hy = 0; break; }
      case 'talk': T.sr = -.4 + Math.sin(t * 3 + seed) * .2; T.er = -1.1; T.srz = .35; T.hy = Math.sin(t * 1.2 + seed) * .3; break;
      case 'board': T.sl = -2.0 - Math.sin(t * 1.3 + seed) * .12; T.el = -.15 - Math.sin(t * 1.3) * .1; T.slz = -.35; T.hx = -.2; break;
      case 'hands': { const f = Math.sin(t * 4) * .15; T.sl = -.45 + f; T.sr = -.45 - f; T.el = T.er = -1.2; T.slz = -.3; T.srz = .3; T.hx = .2; T.tx = .08; break; }
      case 'read': T.sl = T.sr = -.5; T.el = T.er = -1.35; T.slz = -.15; T.srz = .15; T.hx = .3; break;
      case 'wave': T.sl = -2.6; T.slz = -.3 + Math.sin(t * 12) * .3; T.el = -.15; break;
      case 'stuck': T.sl = T.sr = -2.4; T.el = T.er = -1.9; T.slz = -.2; T.srz = .2; T.hx = .15; break;
      case 'held': T.sl = T.sr = -2.9; T.el = T.er = -.1; T.thl = .15; T.thr = -.15; break;
    }
    if (st.moving && !st.sit) T.hy = 0;
    let P = v.pose; if (!P) P = v.pose = Object.assign({}, T);
    const k = Math.min(1, dt * (st.moving ? 14 : 7));
    for (const key of KEYS) P[key] += (T[key] - P[key]) * k;
    v.model.position.set(0, P.hipY * CS - M.hipsH - M.minY * M.SC, P.bodyZ * CS);
    const spine = qx(P.tx), side = (s) => (s === 'Left' ? M.LEFT : -M.LEFT);
    const arm = (s) => side(s) < 0 ? [P.sl, P.slz, P.el, P.elz] : [P.sr, P.srz, P.er, P.erz];
    const leg = (s) => side(s) < 0 ? [P.thl, P.knl] : [P.thr, P.knr];
    const D = { Spine: spine, Head: spine.clone().multiply(eul(P.hx, P.hy, 0)) };
    for (const s of ['Left', 'Right']) {
      const [a, az, e, ez] = arm(s), A = spine.clone().multiply(eul(a, 0, az)), dn = M.downQ[s];
      D[s + 'Arm'] = A.clone().multiply(dn);
      D[s + 'ForeArm'] = A.clone().multiply(eul(e, 0, ez)).multiply(dn);
      const [th, kn] = leg(s);
      D[s + 'UpLeg'] = qx(th); D[s + 'Leg'] = qx(th).multiply(qx(kn));
    }
    const walk = (b, parentW) => {
      const k = nm(b.name); let W;
      if (D[k]) { W = D[k].clone().multiply(M.bindW[k]); b.quaternion.copy(parentW.clone().invert().multiply(W)); }
      else { b.quaternion.copy(M.bindL[k]); W = parentW.clone().multiply(b.quaternion); }
      for (const c of b.children) if (c.isBone) walk(c, W);
    };
    walk(v.bones.Hips, M.hipsParentW);
  }

  function dispose(v) {
    v.root.traverse(o => {
      if (!o.isMesh) return; MESHES.delete(o); mats.delete(o.material); o.material.dispose();
      const e = v.M.texCache.get(o.userData.texKey); if (e && --e.n <= 0) { e.tex.dispose(); v.M.texCache.delete(o.userData.texKey); }
    });
  }

  return { build, pose, dispose, lookKey, ready, load: (p) => load(idOf(p)), setEnv, MESHES, LAYER, CS, HIPY, TAGY: 1.0 };
}
