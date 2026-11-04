// Personagens 3D em "low-poly" facetado com proporção de boneco, montados a partir da aparência que o Pixel HQ já guarda
// (pele, cabelo, penteado, roupa, calça, sapato, crachá, óculos, fone, barba).
//
//  raiz > corpo > quadril > { pernas[coxa > joelho], tronco > { braços[ombro > cotovelo], cabeça } }
//  Cada região (perna, braço, tronco, cabeça, cabelo, óculos) leva um "id de região" para o contorno.
//
//  A linha: poucos polígonos e sombreado chapado (cada face com uma cor só), com proporção de boneco:
//  cabeça grande (≈ 40% da altura), corpo curto, mãos e tênis grandes. Rosto em formas chapadas (olhos
//  quadrados com brilho, sobrancelhas, bochechas sextavadas, nariz em pirâmide, sorriso em segmentos),
//  colado nas faces reais da cabeça (por raio). Cabelo: casca facetada recortada + mechas em ponta.

export function characterKit({ THREE, mergeGeometries, mergeVertices }) {
  const CS = 0.6;          // unidade do desenho → unidade da sala (pessoa em pé ≈ 1,45)
  const HIPY = 0.66;       // altura do quadril, em unidades do desenho
  const LAYER = 3;         // camada extra: o contorno acha a silhueta dos personagens por ela
  const std = (o) => new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, ...o });
  const MATS = { cloth: std({ roughness: .95 }), skin: std({ roughness: .8 }), hair: std({ roughness: .75 }), gloss: std({ roughness: .35 }) };
  function setEnv(tex, k = 1) { for (const m of Object.values(MATS)) { m.envMap = tex; m.envMapIntensity = k; m.needsUpdate = true; } }
  const MESHES = new Set();
  let seq = 1;
  const idMats = new Map();
  const newRegion = () => (seq = (seq % 32000) + 1);
  const idMat = (n) => { if (!idMats.has(n)) idMats.set(n, new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(((n & 31) * 8 + 4) / 255, (((n >> 5) & 31) * 8 + 4) / 255, (((n >> 10) & 31) * 8 + 4) / 255) })); return idMats.get(n); };
  const reg = (m, region) => { m.layers.enable(LAYER); m.userData.idMat = idMat(region); MESHES.add(m); return m; };

  // ---------- geometrias (com cache; as peças são copiadas ao montar) ----------
  const geos = new Map();
  const memo = (k, f) => { if (!geos.has(k)) geos.set(k, f()); return geos.get(k); };
  const box = (w, h, d) => memo(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
  const cyl = (rt, rb, h, s = 6) => memo(`c${rt},${rb},${h},${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s));
  const ico = (d = 0) => memo(`i${d}`, () => new THREE.IcosahedronGeometry(1, d));
  const cone = (r, h, s = 4) => memo(`n${r},${h},${s}`, () => new THREE.ConeGeometry(r, h, s));
  const torus = (r, t, rs, ts, arc = Math.PI * 2) => memo(`t${r},${t},${rs},${ts},${arc}`, () => new THREE.TorusGeometry(r, t, rs, ts, arc));
  // forma 2D extrudada (lapela, gola em V): pontos [x, y], espessura d
  const ext = (key, pts, d) => memo(`e${key}`, () => { const sh = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))); const g = new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: false }); g.translate(0, 0, -d / 2); return g; });

  // prisma chanfrado: polígono de n lados (raios rx × rz) extrudado na vertical, com as bordas cortadas em bisel
  const bev = (n, rx, rz, h, b, rot = Math.PI / n) => memo(`v${n},${rx},${rz},${h},${b},${rot}`, () => {
    const pts = []; for (let i = 0; i < n; i++) { const a = rot + i * 2 * Math.PI / n; pts.push(new THREE.Vector2(Math.cos(a) * (rx - b), Math.sin(a) * (rz - b))); }
    const d = Math.max(.001, h - 2 * b);
    const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: d, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 1, curveSegments: 1 });
    g.rotateX(-Math.PI / 2); g.translate(0, -d / 2, 0); g.deleteAttribute('uv'); return g;
  });
  const bbox = (w, h, d, b) => bev(4, w / 2 * Math.SQRT2, d / 2 * Math.SQRT2, h, b, Math.PI / 4);   // caixa chanfrada

  // volume "superelipsoide" com poucos gomos: a base facetada da cabeça e do cabelo
  const S = (a, b, c, n = 2.2, tb = 1, tt = 1, cx = 0, cy = 0, cz = 0) => ({ a, b, c, n, tb, tt, cx, cy, cz });
  const taper = (s, v) => (v < 0 ? 1 + (s.tb - 1) * Math.min(1, -v) : 1 + (s.tt - 1) * Math.min(1, v));
  const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  function blobRaw(s, wseg, hseg, shape = null) {
    const g = new THREE.SphereGeometry(1, wseg, hseg); g.deleteAttribute('uv'); g.deleteAttribute('normal');
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const k = Math.pow(Math.pow(Math.abs(x), s.n) + Math.pow(Math.abs(y), s.n) + Math.pow(Math.abs(z), s.n), -1 / s.n);
      x *= k; y *= k; z *= k; const t = taper(s, y);
      let X = x * s.a * t, Y = y * s.b, Z = z * s.c * t;
      if (shape) [X, Y, Z] = shape(X, Y, Z, x, y, z);
      p.setXYZ(i, X, Y, Z);
    }
    const m = mergeVertices(g); g.dispose(); m.computeVertexNormals(); return m;
  }
  const blob = (s, w = 8, h = 6) => memo(`o${s.a},${s.b},${s.c},${s.n},${s.tb},${s.tt},${w},${h}`, () => blobRaw(s, w, h));
  // casca (cabelo, barba): onde score > 0 fica k vezes maior que a cabeça; onde é negativo, afunda nela
  function shell(s, k, score, key, bump = null, w = 12, h = 9, shape = null) {
    return memo(`h${key},${k},${w},${h}`, () => {
      const g = blobRaw(s, w, h, shape), p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i), v = y / s.b, t = taper(s, v), u = x / (s.a * t), ww = z / (s.c * t);
        const f = sstep(-.05, .05, score(u, v, ww)), kk = .82 + (k - .82) * f + (bump ? bump(u, v, ww) * f : 0);
        p.setXYZ(i, x * kk, y * kk, z * kk);
      }
      g.computeVertexNormals(); g.translate(s.cx, s.cy, s.cz); return g;
    });
  }
  // massa de cabelo: icosaedro (facetas triangulares grandes) moldado no volume s, k vezes maior;
  // onde score(u, v, w) < 0 (rosto, orelhas) ele afunda para dentro da cabeça. bump dá volume extra.
  function hairMass(s, k, score, key, bump = null, detail = 2) {
    return memo(`m${key},${k},${detail}`, () => {
      const g0 = new THREE.IcosahedronGeometry(1, detail); g0.deleteAttribute('uv'); g0.deleteAttribute('normal');
      const g = mergeVertices(g0); g0.dispose(); const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const kk = Math.pow(Math.pow(Math.abs(x), s.n) + Math.pow(Math.abs(y), s.n) + Math.pow(Math.abs(z), s.n), -1 / s.n);
        const u = x * kk, v = y * kk, w = z * kk, t = taper(s, v);
        const f = sstep(-.06, .06, score(u, v, w)), r = .78 + (k - .78) * f + (bump ? bump(u, v, w) * f : 0);
        p.setXYZ(i, u * s.a * t * r, v * s.b * r, w * s.c * t * r);
      }
      g.computeVertexNormals(); g.translate(s.cx, s.cy, s.cz); return g;
    });
  }
  // ponto e normal da face real da malha, olhando de frente (raio no sentido -z)
  const _ray = new THREE.Raycaster(), _rm = new Map();
  function hit(geo, x, y, dir = [0, 0, -1]) {
    let m = _rm.get(geo); if (!m) { m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })); _rm.set(geo, m); }
    const d = new THREE.Vector3(...dir).normalize();
    _ray.set(new THREE.Vector3(x, y, 0).addScaledVector(d, -3), d);
    const h = _ray.intersectObject(m, false)[0];
    if (!h) return { p: new THREE.Vector3(x, y, 0), n: new THREE.Vector3(0, 0, 1) };
    return { p: h.point, n: h.face.normal.clone() };
  }

  const _c = new THREE.Color(), _c2 = new THREE.Color(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _m = new THREE.Matrix4(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _Z = new THREE.Vector3(0, 0, 1);
  const shade = (hex, k) => _c.set(hex).multiplyScalar(k).getHex();
  const mix = (a, b, k) => _c.set(a).lerp(_c2.set(b), k).getHex();
  // junta as peças de uma região: uma malha por material, todas com o mesmo id de região
  function part() {
    const lists = {}; let mat = 'cloth', ao = null;
    const addM = (geo, color, pos, quat, sc) => {
      const g = geo.index ? geo.toNonIndexed() : geo.clone();
      for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
      g.applyMatrix4(_m.compose(pos, quat, sc));
      _c.set(color); const n = g.attributes.position.count, c = new Float32Array(n * 3);
      const P = g.attributes.position;
      for (let i = 0; i < n; i++) { const k = ao ? ao(P.getX(i), P.getY(i), P.getZ(i)) : 1; c[i * 3] = _c.r * k; c[i * 3 + 1] = _c.g * k; c[i * 3 + 2] = _c.b * k; }
      g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.clearGroups(); (lists[mat] ??= []).push(g);
    };
    const add = (geo, color, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
      _e.set(rx, ry, rz, 'XYZ'); addM(geo, color, _v.set(x, y, z), _q.setFromEuler(_e), _s.set(sx, sy, sz));
    };
    const api = {
      m(k) { mat = k; return api; },
      // sombra de contato barata: escurece a cor dos vértices conforme a posição (f → fator de 0 a 1)
      ao(f) { ao = f; return api; },
      geo(...a) { add(...a); return api; },
      blob(s, color, w, h, rx = 0, ry = 0, rz = 0) { add(blob(s, w, h), color, s.cx, s.cy, s.cz, rx, ry, rz); },
      // peça colada na face da malha "base" (em coordenadas locais), na altura (x, y) vista de frente
      stick(geo, color, base, x, y, lift = .004, sx = 1, sy = 1, sz = 1, spin = 0, dir) {
        const h = hit(base, x, y, dir), q = new THREE.Quaternion().setFromUnitVectors(_Z, h.n);
        if (spin) q.multiply(new THREE.Quaternion().setFromAxisAngle(_Z, spin));
        addM(geo, color, h.p.addScaledVector(h.n, lift), q, _s.set(sx, sy, sz));
      },
      raw(geo, color, x = 0, y = 0, z = 0) { addM(geo, color, _v.set(x, y, z), _q.identity(), _s.set(1, 1, 1)); return api; },
      build(parent, region) {
        const r = region ?? newRegion(); let first = null;
        for (const [k, list] of Object.entries(lists)) {
          const m = new THREE.Mesh(mergeGeometries(list, false), MATS[k]); m.castShadow = m.receiveShadow = true; parent.add(m); list.forEach(g => g.dispose()); reg(m, r); first ??= m;
        }
        return first;
      },
    };
    return api;
  }

  // ---------- proporções ----------
  // cabeça: um pouco maior que a real; mandíbula estreita e queixo marcado, rosto achatado na frente
  // cabeça grande (≈ 40% da altura), larga em cima, mandíbula afinando até o queixo em facetas
  const HEAD = S(.46, .5, .43, 3.2, .82, .95, 0, .52, 0);
  const HAIRV = S(.54, .54, .52, 2.2, .92, .95, 0, .6, -.08);       // volume do cabelo: maior e mais redondo que a cabeça
  const headShape = (X, Y, Z, x, y, z) => { if (z > 0) Z *= .92 + .08 * (1 - Math.abs(x)); return [X, Y, Z]; };
  const headGeo = memo('headgeo', () => blobRaw(HEAD, 10, 8, headShape).translate(HEAD.cx, HEAD.cy, HEAD.cz));
  const TOR = { r: .34, dz: .26, h: .46, y: .32 };                  // tronco: octógono chanfrado
  const torsoGeo = (k = 1) => bev(8, TOR.r * k, TOR.dz * k, TOR.h, .05);
  const torsoMesh = memo('torsoMesh', () => torsoGeo().clone().translate(0, TOR.y, 0));
  const hex = memo('hex', () => cyl(1, 1, 1, 6).clone().rotateX(Math.PI / 2));      // hexágono voltado para a frente (bochecha)
  const hp = (u, v, w) => [u * HEAD.a, HEAD.cy + v * HEAD.b, w * HEAD.c];
  const hairline = (front, back, w, u) => { const f = sstep(-.55, .55, w); return front(u) * f + back * (1 - f); };
  const tri = (x) => Math.abs(((x % 2) + 2) % 2 - 1);

  function look(p) {
    const ex = p.extras || {};
    return {
      skin: p.skin || '#E3B48F', hair: p.hair || '#2A1E18', style: p.hairStyle || 'curto', top: p.top || 'camiseta',
      shirt: p.shirt || '#2F5FD0', pants: p.pants || '#24252B', shoes: p.shoes || '#2C2E34',
      badge: !!ex.cracha, glasses: !!ex.oculos, phones: !!ex.fone, beard: !!ex.barba,
    };
  }
  const lookKey = (p) => JSON.stringify(look(p));

  function build(p) {
    const o = look(p);
    const root = new THREE.Group();
    const body = new THREE.Group(); body.scale.setScalar(CS); root.add(body);
    const hips = new THREE.Group(); hips.position.y = HIPY; body.add(hips);
    const SK = o.skin, SKd = shade(SK, .84), HAIR = o.hair, HAIRd = shade(HAIR, .78), HAIRl = mix(HAIR, '#FFFFFF', .07), PANTS = o.pants;
    const coat = o.top === 'jaqueta' ? '#3A3C44' : o.top === 'terno' ? '#2B2E38' : null;
    const SHIRT = o.shirt, longSleeve = o.top !== 'camiseta', sleeveC = coat ?? SHIRT;
    const R = { torso: newRegion(), head: newRegion(), hair: newRegion(), glasses: newRegion() };

    // pernas curtas e grossas, tênis robusto com sola clara saliente (tudo chanfrado)
    const legs = [];
    for (const side of [-1, 1]) {
      const region = newRegion();
      const th = new THREE.Group(); th.position.set(side * .16, 0, 0); hips.add(th);
      const pt = part(); pt.geo(bev(6, .16, .16, .32, .035), PANTS, 0, -.13, 0); pt.build(th, region);
      const kn = new THREE.Group(); kn.position.y = -.28; th.add(kn);
      const ps = part();
      ps.geo(bev(6, .152, .152, .2, .035), PANTS, 0, -.06, 0);
      ps.ao((x, y) => 1 - .25 * sstep(-.2, -.3, y)).geo(bbox(.25, .17, .4, .05), o.shoes, side * .01, -.235, .06);
      ps.ao(null).geo(bbox(.27, .07, .45, .025), 0xDCD8D4, side * .01, -.335, .075);
      ps.build(kn, region);
      legs.push({ th, kn });
    }

    // tronco
    const torso = new THREE.Group(); hips.add(torso);
    const tb = part();
    tb.geo(bev(8, .31, .235, .18, .03), PANTS, 0, -.01, 0);
    tb.geo(bev(8, .325, .245, .07, .015), shade(PANTS, .72), 0, .1, 0);                          // cós
    tb.ao((x, y) => 1 - .2 * sstep(.42, .56, y) - .12 * sstep(.18, .1, y)).geo(torsoGeo(), SHIRT, 0, TOR.y, 0).ao(null);
    if (o.top === 'camisa' || coat) {
      const col = coat ? 0xE9E6DF : shade(SHIRT, 1.12);
      for (const s of [-1, 1]) tb.stick(ext('gola' + s, [[0, 0], [.13 * s, .04], [.04 * s, -.12]], .02), col, torsoMesh, s * .05, .5, .01, 1, 1, 1, s * .2);
      if (!coat) for (const y of [.42, .3, .18]) tb.stick(box(.03, .03, .015), 0xF2EFEA, torsoMesh, 0, y, .005);
    } else if (o.top === 'moletom') {
      tb.geo(torus(.17, .07, 4, 8), shade(SHIRT, .85), 0, .57, -.07, Math.PI / 2 - .25, 0, 0, 1.2, 1, 1);
      for (const s of [-1, 1]) tb.stick(box(.02, .15, .015), 0xF4F2F0, torsoMesh, s * .06, .42, .005);
      tb.stick(bbox(.34, .12, .03, .01), shade(SHIRT, .88), torsoMesh, 0, .16, .008);
    } else {
      tb.geo(bev(8, .145, .125, .05, .012), shade(SHIRT, .78), 0, .57, 0);                   // gola careca
    }
    if (o.badge) {
      tb.m('gloss');
      tb.stick(box(.11, .14, .015), 0xFFFFFF, torsoMesh, .13, .33, .02);
      tb.stick(box(.11, .04, .016), 0x8C4FE0, torsoMesh, .13, .385, .03);
      tb.m('cloth');
    }
    tb.m('skin').geo(bev(6, .085, .085, .1, .01), shade(SK, .76), 0, .62, 0);
    tb.build(torso, R.torso);
    if (coat) { // paletó: octógono um pouco maior, abertura em V com a camisa e lapelas
      const cp = part();
      cp.geo(torsoGeo(1.07), coat, 0, TOR.y - .01, 0);
      cp.stick(ext('v', [[-.13, .12], [.13, .12], [0, -.2]], .01), SHIRT, torsoMesh, 0, .42, .03);
      for (const s of [-1, 1]) cp.stick(ext('lap' + s, [[0, .14], [.08 * s, .12], [.02 * s, -.18]], .015), shade(coat, 1.25), torsoMesh, s * .11, .4, .035);
      cp.build(torso, R.torso);
    }

    // braços curtos e mão em bloco facetado
    const arms = [];
    for (const side of [-1, 1]) {
      const region = newRegion();
      const sh = new THREE.Group(); sh.position.set(side * .41, .47, 0); torso.add(sh);
      const pa = part();
      pa.geo(bev(8, .14, .14, .19, .04), sleeveC, 0, -.045, 0);
      if (longSleeve) pa.geo(bev(6, .085, .085, .16, .02), sleeveC, 0, -.18, 0);
      else pa.m('skin').ao((x, y) => 1 - .18 * sstep(-.1, -.02, y)).geo(bev(6, .092, .092, .2, .02), SK, 0, -.18, 0).ao(null);
      pa.build(sh, region);
      const el = new THREE.Group(); el.position.y = -.25; sh.add(el);
      const pf = part();
      if (longSleeve) pf.geo(bev(6, .082, .082, .08, .015), sleeveC, 0, -.02, 0);
      pf.m('skin');
      if (!longSleeve) pf.geo(bev(6, .09, .09, .1, .015), SK, 0, -.03, 0);
      pf.geo(bbox(.2, .2, .18, .055), SK, 0, -.16, .01);
      pf.geo(bbox(.07, .09, .08, .02), SK, side * -.1, -.11, .06, 0, 0, side * -.3);
      pf.build(el, region);
      arms.push({ sh, el });
    }

    // cabeça: cubo arredondado facetado, rosto em formas chapadas
    const head = new THREE.Group(); head.position.y = .6; torso.add(head);
    const hb = part().m('skin');
    hb.ao((x, y, z) => 1 - .2 * sstep(.66, .9, y) - .1 * sstep(.2, .04, y)).raw(headGeo, SK); hb.ao(null);
    for (const s of [-1, 1]) {                                                                  // orelha em disco
      hb.geo(cyl(.12, .12, .1, 8), SK, s * .47, .44, 0, 0, 0, Math.PI / 2);
      hb.geo(cyl(.07, .07, .02, 8), shade(SK, .85), s * .52, .44, 0, 0, 0, Math.PI / 2);
    }
    const nz = hit(headGeo, 0, .41).p.z;
    hb.geo(cone(.08, .17, 4), shade(SK, .97), 0, .41, nz + .05, Math.PI / 2 + .3, Math.PI / 4, 0, 1, 1, .85);  // nariz em pirâmide
    for (const s of [-1, 1]) hb.stick(hex, mix(SK, '#FF7A7A', .5), headGeo, s * .3, .36, .004, .075, .055, .008);
    hb.m('gloss');
    for (const s of [-1, 1]) {
      hb.stick(bbox(.11, .15, .02, .012), 0x1E1A1A, headGeo, s * .2, .48, .004);
      hb.stick(box(.04, .04, .01), 0xFFFFFF, headGeo, s * .2 + .02, .51, .016);
    }
    hb.m('cloth');
    for (const s of [-1, 1]) hb.stick(bbox(.17, .055, .03, .01), shade(HAIR, .92), headGeo, s * .21, .63, .008);
    if (!o.beard) hb.stick(torus(.1, .016, 3, 4, Math.PI * .8), 0x7E2422, headGeo, .03, .33, .004, 1, 1, .6, Math.PI * 1.1 + .1);
    hb.build(head, R.head);

    // cabelo: massa facetada maior que a cabeça, recortada no rosto, com mechas em ponta
    const hr = part().m('hair').ao((x, y) => 1 - .22 * sstep(.62, .3, y));
    const mass = (key, front, back, k = 1.08, bump = null) => hr.raw(hairMass(HAIRV, k, (u, v, w) => v - hairline(front, back, w, u), key, bump), HAIR);
    const cap = (key, front, back, k = 1.09, bump = null) => hr.raw(shell(HEAD, k, (u, v, w) => v - hairline(front, back, w, u), key, bump, 12, 9, headShape), HAIR);
    const vol = (u, v, w) => .1 * sstep(0, .9, v) + .06 * sstep(.2, -.6, w);
    const clump = (color, u, v, w, sx, sy, sz, rx = 0, ry = 0, rz = 0) => hr.geo(ico(0), color, ...hp(u, v, w), rx, ry, rz, sx, sy, sz);
    switch (o.style) {
      case 'cacheado':
        mass('cach', () => .3, -.6, 1.12, vol);
        for (let i = 0; i < 30; i++) { const a = i * 2.4, v = .15 + (i % 6) * .15, r = Math.sqrt(Math.max(0, 1 - v * v)) * 1.12; clump(i % 3 ? HAIR : HAIRd, Math.cos(a) * r, v + .08, Math.sin(a) * r * .95 - .08, .14, .12, .14, a, a * .7, 0); }
        break;
      case 'longo':
        mass('longo', (u) => .36 - .08 * Math.abs(u) - .06 * tri(u * 4), -.9, 1.08, vol);
        hr.geo(bbox(.86, .62, .18, .05), HAIR, 0, .3, -.36, -.08, 0, 0);
        for (const s of [-1, 1]) hr.geo(bbox(.13, .62, .32, .04), HAIR, s * .44, .36, -.04, 0, 0, s * .08);
        break;
      case 'rabo':
        mass('rabo', (u) => .4 - .06 * tri(u * 4), -.5, 1.06, vol);
        hr.geo(cone(.12, .45, 5), HAIR, 0, .45, -.58, Math.PI - .4, 0, 0);
        clump(HAIRd, 0, .3, -1.12, .07, .07, .07);
        break;
      case 'coque':
        mass('coque', () => .4, -.5, 1.06, vol);
        hr.geo(ico(0), HAIR, 0, 1.12, -.2, 0, 0, 0, .2, .17, .2);
        break;
      case 'raspado':
        cap('rasp', () => .58, -.35, 1.04);
        break;
      case 'franja':
        mass('franja', (u) => .12 + .1 * tri(u * 5 + .5), -.6, 1.1, vol);
        break;
      default: // curto: volume alto, franja em pontas e uma mecha grande varrendo para o lado
        mass('curto', (u) => .36 - .1 * u - .1 * tri(u * 3.2 + .2), -.6, 1.13, vol);
        hr.geo(ico(0), HAIR, .28, .74, .4, .2, -.3, -.75, .28, .08, .16);
        hr.geo(ico(0), HAIRd, .42, .65, .34, .1, -.4, -1.0, .2, .06, .11);
    }
    if (o.beard) {
      const B = (u, v, w) => Math.min(-.2 + (1 - Math.max(0, w)) * .3 - v, w + .25, (Math.max(Math.abs(u) / .3, Math.abs(v + .38) / .08) - 1) * .2);
      hr.raw(shell(HEAD, 1.06, B, 'barba', null, 14, 11, headShape), HAIR);
      hr.stick(box(.2, .05, .03), HAIR, headGeo, 0, .375, .02);
      hr.m('cloth').stick(torus(.07, .013, 3, 4, Math.PI), 0x7E2422, headGeo, 0, .325, .004, 1, 1, .6, Math.PI);
    }
    hr.build(head, R.hair);

    if (o.glasses || o.phones) {
      const gb = part().m('gloss'), F = 0x1B1C20;
      if (o.glasses) {
        for (const s of [-1, 1]) gb.stick(torus(.1, .014, 3, 4), F, headGeo, s * .19, .5, .035, 1.15, 1, 1, Math.PI / 4);
        gb.stick(box(.07, .016, .016), F, headGeo, 0, .52, .04);
        for (const s of [-1, 1]) gb.geo(box(.016, .016, .4), F, s * .47, .52, .1);
      }
      if (o.phones) {
        gb.geo(torus(.56, .035, 4, 10, Math.PI), 0x1E1F24, 0, .55, -.02);
        for (const s of [-1, 1]) { gb.geo(cyl(.13, .13, .1, 8), 0x1E1F24, s * .5, .5, 0, 0, 0, Math.PI / 2); gb.geo(cyl(.08, .08, .02, 8), 0x8C4FE0, s * .555, .5, 0, 0, 0, Math.PI / 2); }
      }
      gb.build(head, R.glasses);
    }
    return { root, body, hips, torso, head, legs, arms, pose: null, poseT: null, key: lookKey(p) };
  }

  // pose: pernas pela locomoção, braços pela atividade; cada junta se aproxima do alvo com suavidade
  const KEYS = ['hipY', 'bodyZ', 'thl', 'thr', 'knl', 'knr', 'sl', 'sr', 'slz', 'srz', 'el', 'er', 'elz', 'erz', 'tx', 'hx', 'hy'];
  function pose(v, st, t, seed) {
    const T = {}, dt = v.poseT == null ? 1 : Math.min(.1, Math.max(0, t - v.poseT)); v.poseT = t;
    T.hipY = HIPY; T.bodyZ = 0; T.thl = T.thr = T.knl = T.knr = 0;
    T.sl = T.sr = .05; T.slz = -.08; T.srz = .08; T.el = T.er = -.12; T.elz = T.erz = 0; T.tx = 0; T.hx = -.05; T.hy = 0;
    if (st.sit) { T.hipY = 1.0; T.bodyZ = -.18; T.thl = T.thr = -1.45; T.knl = T.knr = 1.45; T.sl = T.sr = -.5; T.el = T.er = -.6; }
    else if (st.moving) {
      const s = Math.sin(st.phase), c = Math.cos(st.phase);
      T.thl = .55 * s; T.thr = -.55 * s; T.knl = Math.max(0, s) * .7; T.knr = Math.max(0, -s) * .7;
      T.sl = -.5 * s; T.sr = .5 * s; T.el = T.er = -.3; T.hipY = HIPY + Math.abs(c) * .04; T.tx = .05;
    } else {
      T.hipY = HIPY + Math.sin(t * 2.2 + seed) * .008;
      T.sl = .05 + Math.sin(t * 2.2 + seed) * .03; T.sr = .05 - Math.sin(t * 2.2 + seed + 1) * .03;
      T.hy = Math.sin(t * .6 + seed * 1.7) * .15;
    }
    switch (st.act) {
      case 'typing': { const f = Math.sin(t * 14) * .08; T.sl = -1.0 + f; T.sr = -1.0 - f; T.el = T.er = -.75; T.slz = T.srz = 0; T.hx = .1; T.hy = 0; break; }
      case 'talk': T.sr = -.55 + Math.sin(t * 3 + seed) * .25; T.er = -1.0; T.hy = Math.sin(t * 1.2 + seed) * .3; break;
      case 'board': T.sl = -1.35 - Math.sin(t * 1.3 + seed) * .12; T.el = -.2 - Math.sin(t * 1.3) * .1; T.hx = -.2; break;
      case 'hands': { const f = Math.sin(t * 4) * .2; T.sl = -.9 + f; T.sr = -.9 - f; T.el = T.er = -.8; T.slz = T.srz = 0; T.hx = .2; T.tx = .08; break; }
      case 'read': T.sl = T.sr = -1.1; T.el = T.er = -1.0; T.slz = .25; T.srz = -.25; T.hx = .3; break;
      case 'wave': T.sl = -2.6; T.slz = -.3 + Math.sin(t * 12) * .3; T.el = -.15; break;
      case 'stuck': T.sl = T.sr = -2.4; T.el = T.er = -1.9; T.slz = -.2; T.srz = .2; T.hx = .15; break;
      case 'held': T.sl = T.sr = -2.9; T.el = T.er = -.1; T.thl = .15; T.thr = -.15; break;
      // um gesto por uso de móvel (mesmos nomes do kit Meshy; braços mais longos, ângulos menores)
      case 'drink': { const p = (Math.sin(t * 1.4 + seed) + 1) / 2; T.sr = -.6 - p * .6; T.er = -1.0 - p * .9; T.hx = -.04 - p * .12; break; }
      case 'stir': T.sr = -.9 + Math.sin(t * 5 + seed) * .12; T.srz = Math.cos(t * 5 + seed) * .2; T.er = -.8; T.sl = -.8; T.el = -.7; T.hx = .3; break;
      case 'lift': { const p = (Math.sin(t * 1.6 + seed) + 1) / 2; T.sl = T.sr = -1.0 - p * 1.0; T.el = T.er = -.6 + p * .45; T.hx = .15 - p * .35; break; }
      case 'counter': T.sl = -.85; T.el = -.75; T.sr = -.6 + Math.sin(t * 2.6 + seed) * .25; T.er = -1.0; T.hy = Math.sin(t * 1.1 + seed) * .25; break;
      case 'care': { const f = Math.sin(t * 2.2 + seed) * .1; T.sl = -1.0 + f; T.sr = -1.0 - f; T.el = T.er = -.6; T.hx = .38; T.tx = .12; break; }
      case 'hammer': { const p = Math.max(0, Math.sin(t * 6 + seed)); T.sr = -1.2 - p * .9; T.er = -1.1 + p * .6; T.sl = -.85; T.el = -.75; T.hx = .35; break; }
      case 'press': { const p = Math.max(0, Math.sin(t * 2.4 + seed)); T.sr = -1.15; T.er = -.35 + p * .3; T.sl = -.4; T.el = -.6; T.hx = .28; break; }
      case 'present': T.sl = -.7 + Math.sin(t * 2 + seed) * .15; T.sr = -.7 + Math.sin(t * 2 + seed + 1.6) * .15; T.slz = .5; T.srz = -.5; T.el = T.er = -.6; T.hy = Math.sin(t * .9 + seed) * .25; break;
      case 'water': T.sr = -1.2; T.er = -.2; T.sl = -.3; T.el = -.5; T.hx = .38; T.tx = .08; break;
      case 'relax': T.sl = T.sr = -2.6; T.el = T.er = -2.1; T.slz = .45; T.srz = -.45; T.hx = -.18; break;
      case 'watch': T.sl = T.sr = -.8; T.el = T.er = -1.7; T.slz = -.2; T.srz = .2; T.hx = -.14; break;
    }
    if (st.moving && !st.sit) T.hy = 0;
    let P = v.pose; if (!P) P = v.pose = Object.assign({}, T);
    const k = Math.min(1, dt * (st.moving ? 14 : 7));
    for (const key of KEYS) P[key] += (T[key] - P[key]) * k;
    v.hips.position.y = P.hipY; v.body.position.z = P.bodyZ;
    v.legs[0].th.rotation.x = P.thl; v.legs[1].th.rotation.x = P.thr; v.legs[0].kn.rotation.x = P.knl; v.legs[1].kn.rotation.x = P.knr;
    v.arms[0].sh.rotation.set(P.sl, 0, P.slz); v.arms[1].sh.rotation.set(P.sr, 0, P.srz);
    v.arms[0].el.rotation.set(P.el, 0, P.elz); v.arms[1].el.rotation.set(P.er, 0, P.erz);
    v.torso.rotation.x = P.tx; v.head.rotation.set(P.hx, P.hy, 0);
  }

  function dispose(v) { v.root.traverse(o => { if (o.isMesh) { MESHES.delete(o); o.geometry.dispose(); } }); }

  return { build, pose, dispose, lookKey, setEnv, MESHES, LAYER, CS, HIPY, TAGY: 1.3 };
}
