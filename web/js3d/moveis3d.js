// Móveis em 3D no estilo dos personagens: low-poly facetado (poucas faces, sombreado chapado), quinas retas,
// formas redondas onde a peça é redonda (vasos, troncos, assentos, luminárias) e folhas/roupas recortadas.
//
// O catálogo (web/js/01-catalogo.js) continua sendo a verdade para tamanho, colisão, pontos de uso e o desenho 2D.
// Aqui cada item pode ter um MODELO: uma função que monta peças no espaço do item (x de 0 a w, z de 0 a d,
// fundo em z = 0, frente — onde a pessoa usa — em z = d; y para cima) sem girar. Quem chama aplica giro e posição.
// Sem modelo, o item é desenhado com as caixas do catálogo e cadeiras de verdade no lugar das caixas.
// Partes animadas (telas, LEDs, vapor, papel, notas do quadro) continuam vindo das caixas do catálogo.

export function furnitureKit({ THREE, RoundedBoxGeometry, isAnim }) {
  const MET = '#2C2E34', CHR = '#3B3E46', WOOD = '#B07A4A', WOOD_D = '#7A4A2A', POT = '#E4E1E0', SOIL = '#4A3426';
  const GREENS = ['#2F9A4C', '#3FB25D', '#5ACB75', '#278442'];
  const tone = (c, l) => '#' + new THREE.Color(c).offsetHSL(0, 0, l).getHexString();

  /* ---------- geometrias base (com cache; as peças recebem cópias) ---------- */
  const G = new Map();
  const memo = (k, f) => { if (!G.has(k)) G.set(k, f()); return G.get(k); };
  const n3 = (v) => Math.round(v * 1000) / 1000;
  const rbox = (w, h, d, r) => memo(`b${n3(w)},${n3(h)},${n3(d)},${n3(r)}`, () => {
    // quinas retas (decisão do dono: móvel reto sem chanfro); o contorno preto marca cada aresta
    return new THREE.BoxGeometry(w, h, d);
  });
  // peças redondas são redondas de verdade (decisão do dono, 2026-11-04): muitos lados e luz lisa (smooth = mantém as
  // normais da própria geometria em vez do facetado por face). seg < 5 continua sendo forma reta de propósito (pirâmide).
  const ROUND = 32;
  const smooth = (g) => { g.userData.smooth = true; return g; };
  // estofado (assento, encosto, braço): caixa com as quinas LEVEMENTE arredondadas (decisão do dono, 2026-11-04).
  // Só nos estofados; o resto continua com quina reta. Mantém as normais da própria geometria (luz acompanha a curva).
  const softG = (w, h, d, r) => { const rr = Math.max(.008, Math.min(r, w / 2 - .002, h / 2 - .002, d / 2 - .002, .05)); return memo(`s${n3(w)},${n3(h)},${n3(d)},${n3(rr)}`, () => { const g = new RoundedBoxGeometry(w, h, d, 3, rr); g.userData.soft = true; return g; }); };
  const cylG = (rt, rb, h, seg) => { const s = seg >= 5 ? Math.max(seg, ROUND) : seg; return memo(`c${n3(rt)},${n3(rb)},${n3(h)},${s}`, () => { const g = new THREE.CylinderGeometry(rt, rb, h, s, 1); return s >= 5 ? smooth(g) : g; }); };
  const icoG = (r, det) => memo(`i${n3(r)},${det}`, () => new THREE.IcosahedronGeometry(r, det));
  const sphG = (r) => memo(`s${n3(r)}`, () => smooth(new THREE.SphereGeometry(r, ROUND, ROUND / 2)));
  const dodG = (r) => memo(`d${n3(r)}`, () => new THREE.DodecahedronGeometry(r, 0));
  const latheG = (pts, seg) => memo('l' + pts.flat().join(',') + Math.max(seg, ROUND), () => smooth(new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), Math.max(seg, ROUND))));
  // folha de palmeira/planta: tira que nasce estreita, alarga e cai na ponta, com nervura no meio (vira duas águas)
  const leafG = (len, wid, rise, droop, segs = 4) => memo(`f${n3(len)},${n3(wid)},${n3(rise)},${n3(droop)},${segs}`, () => {
    const pos = [], row = [];
    for (let i = 0; i <= segs; i++) {
      const t = i / segs, w = wid * (i === segs ? 0 : .35 + .65 * Math.sin(Math.PI * Math.min(1, t * 1.1 + .1))), y = rise * t - droop * t * t, x = len * t;
      row.push([[x, y, -w / 2], [x, y + w * .22, 0], [x, y, w / 2]]);
    }
    const tri = (a, b, c) => pos.push(...a, ...b, ...c);
    for (let i = 0; i < segs; i++) { const [l0, m0, r0] = row[i], [l1, m1, r1] = row[i + 1]; tri(l0, m0, m1); tri(l0, m1, l1); tri(m0, r0, r1); tri(m0, r1, m1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3 * 2), 2));
    return g;
  });
  // roupa no cabide (camiseta ou vestido), recortada e com espessura
  const garmentG = (kind) => memo('r' + kind, () => {
    const s = new THREE.Shape();
    if (kind === 'vestido') { s.moveTo(-.1, 0); s.lineTo(-.07, -.18); s.lineTo(-.2, -.66); s.lineTo(.2, -.66); s.lineTo(.07, -.18); s.lineTo(.1, 0); s.lineTo(.04, .02); s.lineTo(0, -.04); s.lineTo(-.04, .02); s.closePath(); }
    else if (kind === 'calca') { s.moveTo(-.16, 0); s.lineTo(.16, 0); s.lineTo(.17, -.62); s.lineTo(.03, -.62); s.lineTo(0, -.2); s.lineTo(-.03, -.62); s.lineTo(-.17, -.62); s.closePath(); }
    else { s.moveTo(-.07, .02); s.lineTo(-.2, -.03); s.lineTo(-.27, -.2); s.lineTo(-.19, -.25); s.lineTo(-.15, -.16); s.lineTo(-.15, -.6); s.lineTo(.15, -.6); s.lineTo(.15, -.16); s.lineTo(.19, -.25); s.lineTo(.27, -.2); s.lineTo(.2, -.03); s.lineTo(.07, .02); s.lineTo(0, -.05); s.closePath(); }
    const g = new THREE.ExtrudeGeometry(s, { depth: .045, bevelEnabled: false, curveSegments: 1 }); g.translate(0, 0, -.0225); return g;
  });

  /* ---------- montador de peças (espaço do item, sem giro) ---------- */
  function maker(it, colorOf) {
    const out = [];
    const col = (c) => (c === 'C' ? colorOf : c);
    const put = (geo, c, x, y, z, o = {}) => {
      const g = geo.clone();
      if (o.sx || o.sy || o.sz) g.scale(o.sx || 1, o.sy || 1, o.sz || 1);
      if (o.rz) g.rotateZ(o.rz); if (o.rx) g.rotateX(o.rx); if (o.ry) g.rotateY(o.ry);
      g.translate(x, y, z);
      out.push({ geo: g, c: col(c), glow: o.glow ? col(o.glow === true ? c : o.glow) : null, double: !!o.double, glass: !!o.glass, smooth: !!geo.userData.smooth, soft: !!geo.userData.soft, anim: o.anim || null });
    };
    const P = {
      out,
      box(x, z, w, d, y, h, c, o = {}) { put(o.soft ? softG(w, h, d, o.r ?? .04) : rbox(w, h, d, o.r ?? .025), c, x + w / 2, y + h / 2, z + d / 2, o); },
      cyl(cx, cz, rt, rb, y, h, c, o = {}) { put(cylG(rt, rb, h, o.seg || 8), c, cx, y + h / 2, cz, o); },
      // bola: esfera lisa; folhagem/fruta pedem { detail: 0 } e continuam facetadas (moita, não bola)
      ball(cx, y, cz, r, c, o = {}) { put(o.dodeca ? dodG(r) : o.detail != null ? icoG(r, o.detail) : sphG(r), c, cx, y, cz, o); },
      lathe(cx, cz, y, pts, c, o = {}) { put(latheG(pts, o.seg || 8), c, cx, y, cz, o); },
      // haste reta entre dois pontos
      rod(a, b, r, c, o = {}) {
        const A = new THREE.Vector3(...a), Bv = new THREE.Vector3(...b), dir = Bv.clone().sub(A), len = dir.length();
        const g = cylG(r, r, len, o.seg || 16).clone();
        g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()));
        const m = A.add(Bv).multiplyScalar(.5); g.translate(m.x, m.y, m.z);
        out.push({ geo: g, c: col(c), glow: null, double: false, glass: false, smooth: true, anim: o.anim || null });
      },
      leaf(cx, y, cz, yaw, len, wid, rise, droop, c, anim = null) { put(leafG(len, wid, rise, droop), c, cx, y, cz, { ry: yaw, double: true, anim }); },
      garment(cx, y, cz, kind, c, yaw, anim = null) { put(garmentG(kind), c, cx, y, cz, { ry: yaw, anim }); },
      // caixas do catálogo (menos as animadas, as de cadeira e as indicadas em "except")
      base(except = []) {
        it.boxes.forEach((b, i) => {
          if (except.includes(i) || b.ch || isAnim(b) || b.w <= 0 || b.h <= 0 || b.d <= 0) return;
          P.box(b.x, b.z, b.w, b.d, b.y, Math.max(b.h, .004), b.c, { glow: b.g || null, glass: !!b.glass, r: Math.min(.025, b.h / 3) });
        });
      },
      chairs() { const seen = new Set(); for (const b of it.boxes) if (b.ch) { const k = b.ch.join(); if (!seen.has(k)) { seen.add(k); chair(P, ...b.ch); } } },
    };
    return P;
  }

  /* ---------- peças que se repetem ---------- */
  // cadeira de escritório: base em estrela com rodinhas, coluna, assento e encosto estofados
  function chair(P, x, z, back) {
    const yaw = { s: 0, n: Math.PI, w: -Math.PI / 2, e: Math.PI / 2 }[back] ?? 0;
    const L = (lx, lz) => [x + lx * Math.cos(yaw) + lz * Math.sin(yaw), z - lx * Math.sin(yaw) + lz * Math.cos(yaw)];
    for (let k = 0; k < 5; k++) {
      const a = k / 5 * Math.PI * 2 + .3, ex = x + Math.cos(a) * .24, ez = z + Math.sin(a) * .24;
      P.rod([x, .07, z], [ex, .05, ez], .018, MET); P.ball(ex, .03, ez, .03, '#1E1F24');
    }
    P.cyl(x, z, .03, .035, .06, .32, MET, { seg: 6 });
    P.box(x - .25, z - .23, .5, .46, .37, .09, CHR, { r: .035, soft: true });
    const [bx, bz] = L(0, .2); P.rod([x, .4, z], [bx, .5, bz], .02, MET);
    P.box(bx - .23, bz - .045, .46, .09, .48, .4, CHR, { r: .035, ry: yaw, soft: true });
  }
  // vaso com terra
  // y = altura do apoio (chão, prateleira ou tampo): o vaso fica sobre ele, junto com a planta
  function pot(P, cx, cz, r, h, c = POT, y = 0) {
    // boca aberta: a parede de dentro desce até a terra (antes o vaso tinha "tampa" e a terra não aparecia)
    P.lathe(cx, cz, y, [[0, 0], [r * .78, 0], [r, h * .85], [r * 1.06, h * .88], [r * 1.06, h], [r * .92, h], [r * .92, h * .8], [0, h * .8]], c, { seg: 8 });
    P.cyl(cx, cz, r * .92, r * .92, y + h * .8, h * .08, SOIL, { seg: 8 }); // terra: topo a 88% da altura do vaso
  }
  // muda de folhas (no lugar das antigas bolas): roseta de folhas que sobem e se abrem, em 2 anéis
  // y = altura da terra; r = raio da copa
  function bush(P, cx, y, cz, r, n = 5, seed = 0) {
    const out = Math.max(5, n + 3), inn = Math.max(3, n - 1), an = sway(cx, y, cz, 'b');
    for (let i = 0; i < out; i++) { const a = (i / out) * Math.PI * 2 + seed * .7; P.leaf(cx, y, cz, a, r * 1.5, r * .55, r * 1.0, r * .9, GREENS[(i + seed) % 4], an); }
    for (let i = 0; i < inn; i++) { const a = (i / inn) * Math.PI * 2 + seed * .7 + .5; P.leaf(cx, y, cz, a, r * 1.0, r * .45, r * 1.5, r * .5, GREENS[(i + seed + 1) % 4], an); }
    water(P, cx, y + r * 1.6, cz);
  }
  /* ---------- partes animadas ----------
     anim = { type, g (grupo: peças com o mesmo g mexem juntas), pivot [x,y,z] (no espaço do móvel), on: 'idle' | 'act' }
     idle = sempre; act = só enquanto alguém usa o móvel. Os tipos são tocados em cena3d.js (updatePartAnims). */
  const sway = (cx, y, cz, k) => ({ type: 'sway', g: `${k}${n3(cx)},${n3(y)},${n3(cz)}`, pivot: [cx, y, cz], on: 'idle' });
  // gotas de água caindo sobre a planta enquanto alguém rega (a pessoa faz o gesto de regar)
  function water(P, cx, top, cz) {
    for (let k = 0; k < 3; k++) P.ball(cx + (k - 1) * .04, top, cz, .018, '#7FC4E8', { anim: { type: 'drip', g: `w${n3(cx)},${n3(cz)},${k}`, pivot: [cx + (k - 1) * .04, top, cz], on: 'act', acts: ['plants'], ph: k / 3, fall: .35 } });
  }
  // tufo de folhas compridas em leque (espada-de-são-jorge, capim)
  function spikes(P, cx, y, cz, n, h, seed = 0) {
    const an = sway(cx, y, cz, 's');
    for (let i = 0; i < n; i++) {
      const a = (i + seed) * 2.1, lean = .25 + (i % 3) * .12;
      P.leaf(cx + Math.cos(a) * .03, y, cz + Math.sin(a) * .03, a, h * lean, .09, h * (1 - lean * .5), h * lean * .5, GREENS[(i + seed) % 4], an);
    }
    water(P, cx, y + h * 1.05, cz);
  }
  // folhas caindo em volta (palmeira, samambaia)
  function crown(P, cx, y, cz, n, len, wid, droop, seed = 0) {
    const an = sway(cx, y, cz, 'c');
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + seed;
      P.leaf(cx, y, cz, a, len * (.85 + (i % 3) * .1), wid, len * .35, droop, GREENS[i % 4], an);
    }
  }

  /* ---------- modelos ---------- */
  const MODELS = {
    palm(P) {
      pot(P, .5, .5, .26, .44);
      // tronco em gomos, levemente inclinado
      let y = .39, x = .5, z = .5; // tronco nasce da terra (topo da terra em .44 × .88)
      for (let k = 0; k < 5; k++) { const h = .22, nx = .5 + Math.sin(k * .7) * .035; P.cyl(nx, z, .065 - k * .006, .08 - k * .006, y, h, k % 2 ? '#8E5B3A' : WOOD_D, { seg: 6 }); y += h; x = nx; }
      crown(P, x, y, z, 9, .78, .26, .7, .3);
      crown(P, x, y + .04, z, 5, .5, .2, .2, 1.1);
      crown(P, x, y + .08, z, 3, .3, .14, -.15, 2.0);
      water(P, x, y + .45, z);
    },
    planter(P) {
      P.box(0, .15, 2, .7, 0, .48, POT, { r: .05 });
      P.box(.04, .19, 1.92, .62, .48, .03, SOIL, { r: .01 });
      bush(P, .45, .5, .5, .26, 6, 0);
      spikes(P, 1.0, .5, .5, 7, .55, 2);
      bush(P, 1.55, .5, .5, .24, 5, 3);
    },
    plantshelf(P) {
      P.base([5, 6, 7, 8]);
      pot(P, .45, .5, .13, .2, '#C98F57', .51); bush(P, .45, .7, .5, .14, 4, 1);
      pot(P, 1.37, .5, .12, .18, POT, 1.01); spikes(P, 1.37, 1.19, .5, 6, .36, 1);
      pot(P, .5, .5, .12, .18, '#C98F57', 1.46); crown(P, .5, 1.64, .5, 7, .32, .1, .45, .2);
      pot(P, 1.5, .5, .13, .2, POT, 1.46); bush(P, 1.5, 1.66, .5, .16, 5, 2);
    },
    vase(P, o, colorOf) {
      P.lathe(.5, .5, 0, [[0, 0], [.13, 0], [.19, .2], [.2, .5], [.14, .78], [.1, .88], [.12, .92], [0, .9]], 'C', { seg: 8 });
      spikes(P, .5, .88, .5, 7, .55, 0);
    },
    arara(P) {
      // pés, colunas e barra
      P.box(.06, .3, .34, .4, 0, .05, MET, { r: .02 }); P.box(1.6, .3, .34, .4, 0, .05, MET, { r: .02 });
      P.rod([.23, .05, .5], [.23, 1.52, .5], .028, MET); P.rod([1.77, .05, .5], [1.77, 1.52, .5], .028, MET);
      P.rod([.18, 1.52, .5], [1.82, 1.52, .5], .022, MET);
      const ROUPAS = [['camiseta', '#E0473B'], ['vestido', '#F2B630'], ['camiseta', '#2F5FD0'], ['calca', '#3C4A66'], ['camiseta', '#3AA655'], ['vestido', '#8C4FE0']];
      ROUPAS.forEach(([k, c], i) => {
        const cx = .4 + i * .24, yaw = Math.PI / 2; // de lado, perpendiculares à barra, alinhadas à grade (como numa loja)
        // cabide: gancho e ombro
        // em uso (repondo a arara): cada cabide com a roupa balança no gancho
        const an = { type: 'swing2', g: 'r' + i, pivot: [cx, 1.52, .5], on: 'act', ph: i * .9 };
        P.rod([cx, 1.52, .5], [cx, 1.44, .5], .008, '#9AA0A8', { anim: an });
        P.rod([cx - Math.cos(yaw) * .2, 1.4, .5 + Math.sin(yaw) * .2], [cx + Math.cos(yaw) * .2, 1.4, .5 - Math.sin(yaw) * .2], .012, k === 'calca' ? MET : '#DBB07A', { anim: an });
        P.garment(cx, 1.42, .5, k, c, yaw, an);
      });
    },
    stool(P, o) {
      P.cyl(.5, .5, .2, .22, 0, .04, MET, { seg: 8 });
      P.cyl(.5, .5, .035, .035, .04, .71, MET, { seg: 6 });
      P.cyl(.5, .5, .16, .16, .38, .025, MET, { seg: 8 });
      P.cyl(.5, .5, .23, .21, .75, .1, 'C', { seg: 10 });
    },
    sofa(P, o, colorOf) {
      const dk = tone(colorOf, -.08), lt = tone(colorOf, .06);
      for (const fx of [.12, 2.82]) for (const fz of [.12, .82]) P.cyl(fx, fz, .04, .03, 0, .1, WOOD_D, { seg: 6 });
      // estofado: quinas levemente arredondadas (soft)
      P.box(0, 0, 3, 1, .1, .32, 'C', { r: .04, soft: true });
      P.box(0, 0, 3, .3, .4, .55, dk, { r: .05, soft: true }); // encosto rente à base: recuo deixava um filete com cara de chanfro
      P.box(0, .25, .3, .75, .4, .27, 'C', { r: .05, soft: true }); P.box(2.7, .25, .3, .75, .4, .27, 'C', { r: .05, soft: true });
      // almofadas do assento afundam um pouco quando alguém senta
      P.box(.32, .3, 1.16, .66, .42, .12, lt, { r: .045, soft: true, anim: { type: 'squash', g: 'a1', pivot: [.9, .42, .63], on: 'act' } });
      P.box(1.52, .3, 1.16, .66, .42, .12, lt, { r: .045, soft: true, anim: { type: 'squash', g: 'a2', pivot: [2.1, .42, .63], on: 'act' } });
      // sem almofadas soltas (decisão do dono, 2026-11-04)
    },
    armchair(P, o, colorOf) {
      const dk = tone(colorOf, -.08), lt = tone(colorOf, .06);
      for (const fx of [.12, .88]) for (const fz of [.12, .88]) P.cyl(fx, fz, .035, .025, 0, .1, WOOD_D, { seg: 6 });
      P.box(0, 0, 1, 1, .1, .32, 'C', { r: .04, soft: true });
      P.box(0, 0, 1, .3, .4, .52, dk, { r: .05, soft: true });
      P.box(0, .25, .2, .75, .4, .24, 'C', { r: .05, soft: true }); P.box(.8, .25, .2, .75, .4, .24, 'C', { r: .05, soft: true });
      P.box(.21, .3, .58, .66, .42, .11, lt, { r: .045, soft: true, anim: { type: 'squash', g: 'a1', pivot: [.5, .42, .63], on: 'act' } });
    },
    pouf(P, o, colorOf) {
      P.lathe(.5, .5, 0, [[0, 0], [.27, 0], [.32, .12], [.32, .3], [.27, .4], [0, .42]], 'C', { seg: 10 });
      P.cyl(.5, .5, .07, .07, .41, .02, tone(colorOf, -.1), { seg: 8 });
    },
    ctable(P) {
      for (const fx of [.3, 1.7]) for (const fz of [.25, .75]) P.cyl(fx, fz, .03, .02, 0, .35, WOOD_D, { seg: 6 });
      P.box(.1, .15, 1.8, .7, .35, .07, '#C98F57', { r: .035 });
      flatBook(P, .53, .46, .42, .36, .26, .05, '#2F5FD0'); flatBook(P, .54, .47, .47, .32, .24, .05, '#F2B630', .15);
      mug(P, 1.35, .48, .42);
      pot(P, 1.68, .5, .08, .12, POT, .42); bush(P, 1.68, .54, .5, .08, 3, 1);
    },
    floorlamp(P) {
      P.cyl(.5, .5, .17, .19, 0, .05, MET, { seg: 8 });
      P.rod([.5, .05, .5], [.5, 1.6, .5], .022, MET);
      P.cyl(.5, .5, .14, .25, 1.55, .34, '#FFE7A8', { seg: 8, glow: '#FFE08A' });
    },
    colorlight(P, o) {
      P.cyl(.5, .5, .16, .18, 0, .04, MET, { seg: 8 });
      P.rod([.5, .04, .5], [.5, 1.52, .5], .022, MET);
      // a bola de luz é animada (pulsa): vem do catálogo, desenhada como esfera facetada
    },
    softbox(P) {
      for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2 + .5; P.rod([.5, .5, .5], [.5 + Math.cos(a) * .3, 0, .5 + Math.sin(a) * .3], .015, MET); }
      P.rod([.5, .45, .5], [.5, 1.4, .5], .022, MET);
      // caixa de luz em pirâmide virada para a frente
      P.cyl(.5, .36, .07, .4, 1.47, .3, '#24252B', { seg: 4, rx: -Math.PI / 2, ry: Math.PI / 4 });
      P.box(.22, .5, .56, .03, 1.34, .56, '#FFF6D6', { glow: '#FFF1BF', r: .01 });
    },
    tripod(P) {
      for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2 + .5; P.rod([.5, .8, .5], [.5 + Math.cos(a) * .28, 0, .5 + Math.sin(a) * .28], .016, MET); }
      P.rod([.5, .8, .5], [.5, 1.1, .5], .02, MET);
      P.box(.3, .35, .4, .3, 1.1, .28, '#24252B', { r: .04 });
      P.rod([.5, 1.24, .65], [.5, 1.24, .82], .085, '#5C5866', { seg: 8 });
      P.rod([.5, 1.24, .82], [.5, 1.24, .84], .065, '#2A2D3A', { seg: 8 });
    },
    cavalete(P) {
      // pernas da frente ATRÁS da tela (a tela pintada fica à frente, apoiada no aparador); perna de trás afastada
      P.rod([.22, 0, .44], [.47, 1.6, .4], .025, WOOD); P.rod([.78, 0, .44], [.53, 1.6, .4], .025, WOOD);
      P.rod([.5, 0, .05], [.5, 1.5, .37], .025, WOOD);
      P.box(.2, .4, .6, .04, 1.38, .05, WOOD, { r: 0 }); // trava de cima segurando a tela por trás
      P.box(.15, .5, .7, .07, .55, .05, WOOD, { r: .015 });
      P.box(.16, .47, .68, .05, .6, .78, '#FFFFFF', { r: .01 });
      P.box(.25, .52, .25, .01, .95, .3, '#2F5FD0', { r: 0 }); P.box(.5, .52, .2, .01, .75, .25, '#F2B630', { r: 0 }); P.box(.3, .52, .3, .01, .7, .15, '#E0473B', { r: 0 });
    },
    balanca(P) {
      P.box(.25, .35, .5, .5, 0, .07, POT, { r: .03 });
      P.box(.3, .4, .4, .4, .07, .01, '#5C5866', { r: 0 });
      P.rod([.5, .07, .42], [.5, 1.12, .42], .03, MET);
      P.box(.33, .33, .34, .12, 1.1, .22, '#24252B', { r: .03 });
      // visor: os números piscam enquanto alguém está sendo pesado
      P.box(.36, .45, .28, .01, 1.15, .14, '#3AA655', { glow: '#5CFF8A', r: 0, anim: { type: 'blink', g: 'visor', pivot: [.5, 1.22, .455], on: 'act' } });
    },
    coffee(P) {
      P.base([5, 6, 7, 8, 9, 10]);
      // máquina de espresso: corpo, grupo e bico
      P.box(.28, .18, .54, .5, 1.03, .58, '#C9CDD4', { r: .05 });
      P.box(.33, .62, .44, .1, 1.45, .12, '#9AA0A8', { r: .02 });
      P.cyl(.55, .7, .05, .05, 1.28, .08, MET, { seg: 8 });
      P.box(.38, .68, .34, .02, 1.25, .2, '#24252B', { r: 0 });
      P.cyl(1.47, .48, .065, .055, 1.03, .13, '#FFFFFF', { seg: 8 }); P.cyl(1.77, .48, .065, .055, 1.03, .13, '#FFFFFF', { seg: 8 });
      pot(P, 2.52, .48, .17, .3, POT, 1.03); bush(P, 2.52, 1.29, .48, .18, 5, 2);
    },
    fogao(P) {
      P.base([4, 5, 6, 7, 8, 9, 10]);
      for (const [cx, cz] of [[.5, .36], [1.5, .36], [.5, .72], [1.5, .72]]) { P.cyl(cx, cz, .17, .17, .9, .02, '#3A3C42', { seg: 8 }); P.cyl(cx, cz, .09, .09, .92, .015, '#24252B', { seg: 8 }); }
      // panela funda aberta (sem tampa: vê-se o fundo) e frigideira rasa com cabo
      vessel(P, .5, .36, .92, .16, .22, '#C9CDD4', .15); P.rod([.66, 1.08, .36], [.86, 1.1, .36], .015, MET); P.rod([.34, 1.08, .36], [.2, 1.1, .36], .015, MET);
      vessel(P, 1.5, .72, .95, .15, .05, '#3A3C42', .13); P.rod([1.64, .98, .72], [1.92, 1.0, .72], .018, '#24252B');
      // em uso: chama acesa (tremendo) sob a panela e a frigideira, e vapor subindo da panela. Parado: fogão apagado
      for (const [cx, cz, r] of [[.5, .36, .17], [1.5, .72, .16]]) P.cyl(cx, cz, r, r * .8, .92, .03, '#FF8A3D', { seg: 24, glow: '#FF8A3D', anim: { type: 'flame', g: 'f' + cx, pivot: [cx, .92, cz], on: 'act' } });
      for (let k = 0; k < 3; k++) P.ball(.5 + (k - 1) * .05, 1.16, .36, .035, '#FFFFFF', { anim: { type: 'rise', g: 'v' + k, pivot: [.5 + (k - 1) * .05, 1.16, .36], on: 'act', ph: k / 3, up: .35 } });
    },
  };
  // a cadeira-padrão das mesas: só as caixas dela trocam
  for (const id of ['island', 'meeting', 'reception']) MODELS[id] = (P) => { P.base(); P.chairs(); };

  /* ---------- peças de escritório ---------- */
  // monitor: corpo fino com borda, pescoço e base; face = +1 (tela para +z) ou −1
  function monitor(P, x0, z0, w, d, y0, h, face) {
    // pé estilo iMac: placa fina no tampo + chapa inclinada que sobe por trás e encosta nas costas do monitor
    const cx = x0 + w / 2, back = face > 0 ? z0 : z0 + d, zc = z0 + d / 2, sw = Math.min(.22, w * .4);
    // placa do pé vai da frente do monitor até onde a chapa toca o tampo: fica toda debaixo dele, não sobra na frente
    const front = face > 0 ? z0 + d : z0, rear = back - face * .12, fz0 = Math.min(front, rear), fz1 = Math.max(front, rear);
    P.box(cx - sw / 2, fz0, sw, fz1 - fz0, .77, .012, MET, { r: 0 });
    const A = [.782, back - face * .1], Bp = [y0 + h * .5, back - face * .006];
    const dy = Bp[0] - A[0], dz = Bp[1] - A[1], L = Math.hypot(dy, dz);
    P.box(cx - sw / 2, (A[1] + Bp[1]) / 2 - .01, sw, .02, (A[0] + Bp[0]) / 2 - L / 2, L, MET, { r: 0, rx: Math.atan2(dz, dy) });
    P.box(x0, z0, w, d, y0, h, '#24252B', { r: .02 });
  }
  function keyboard(P, x0, z0, w, d, y) {
    P.box(x0, z0, w, d, y, .02, '#3B3E46', { r: .008 });
    P.box(x0 + .03, z0 + .03, w - .06, d - .06, y + .02, .006, '#5C5866', { r: 0 });
    P.ball(x0 + w + .09, y + .015, z0 + d / 2, .03, '#3B3E46', { sx: 1, sy: .5, sz: 1.5 });
  }
  // pés de mesa em "trenó": duas hastes, barra no chão e barra sob o tampo
  function sled(P, x, z0, z1, h) {
    P.rod([x, .02, z0], [x, h, z0], .028, MET); P.rod([x, .02, z1], [x, h, z1], .028, MET);
    P.rod([x, .03, z0 - .05], [x, .03, z1 + .05], .03, MET); P.rod([x, h - .03, z0], [x, h - .03, z1], .022, MET);
  }
  // recipiente aberto (panela, pote, tigela): parede por fora na cor da peça e o lado de dentro (parede + fundo)
  // num tom mais escuro, então se vê que é oco. rb = raio do fundo
  function vessel(P, cx, cz, y, r, h, c, rb = r * .85) {
    const t = Math.max(.006, r * .08), fb = Math.max(.01, h * .12);
    P.lathe(cx, cz, y, [[0, 0], [rb, 0], [r, h], [r - t, h]], c, { seg: 32 });
    P.lathe(cx, cz, y, [[r - t, h], [rb - t, fb], [0, fb]], tone(c, -.3), { seg: 32 });
  }
  // livro em pé, lombada para a frente (+z): duas capas, lombada e o miolo branco entre elas (aparece em cima e atrás)
  function book(P, x, z, w, d, y, h, c) {
    const t = Math.min(.012, w * .15);
    P.box(x, z, t, d, y, h, c, { r: 0 }); P.box(x + w - t, z, t, d, y, h, c, { r: 0 });
    P.box(x + t, z + d - t, w - 2 * t, t, y, h, c, { r: 0 });
    P.box(x + t, z + .004, w - 2 * t, d - t - .004, y + .004, h - .01, '#FFFFFF', { r: 0 });
  }
  // livro deitado (centro cx, cz; giro yaw): capas em cima e embaixo, lombada no lado -x, miolo branco nos outros 3 lados
  function flatBook(P, cx, cz, y, w, d, h, c, yaw = 0) {
    const L = (lx, lz) => [cx + lx * Math.cos(yaw) + lz * Math.sin(yaw), cz - lx * Math.sin(yaw) + lz * Math.cos(yaw)];
    const at = (lx, ly, lz, bw, bh, bd, col) => { const [x, z] = L(lx, lz); P.box(x - bw / 2, z - bd / 2, bw, bd, ly - bh / 2, bh, col, { r: 0, ry: yaw }); };
    const t = Math.min(.008, h * .2);
    at(0, y + t / 2, 0, w, t, d, c); at(0, y + h - t / 2, 0, w, t, d, c); at(-w / 2 + t / 2, y + h / 2, 0, t, h, d, c);
    at((t - .006) / 2, y + h / 2, 0, w - t - .006, h - 2 * t, d - .008, '#FFFFFF');
  }
  // copo sem alça; a boca é um disco escuro logo abaixo da borda (café dentro), dá a ideia de fundo
  function mug(P, x, z, y, c = '#FFFFFF') { P.cyl(x, z, .055, .05, y, .12, c, { seg: 8 }); P.cyl(x, z, .046, .046, y + .1, .022, '#3B2A20', { seg: 8 }); }
  // notebook: base fina, tampa com a mesma ideia do monitor (caixa + tela embutida colorida), aberta ~105°
  function laptop(P, cx, cz, y, yaw) {
    const L = (lx, lz) => [cx + lx * Math.cos(yaw) + lz * Math.sin(yaw), cz - lx * Math.sin(yaw) + lz * Math.cos(yaw)];
    const W = .4, D = .28, BH = .025, LD = .022, LH = .26, t = .26;
    const at = (lx, ly, lz, w, h, d, c, o = {}) => { const [x, z] = L(lx, lz); P.box(x - w / 2, z - d / 2, w, d, ly - h / 2, h, c, { r: 0, ry: yaw, ...o }); };
    at(0, y + BH / 2, 0, W, BH, D, '#3B3E46');
    at(0, y + BH + .002, .03, W * .86, .004, D * .5, '#24252B'); // teclado
    // tampa: dobradiça na beirada de trás da base, inclinada para trás
    const hy = y + BH, hz = -D / 2, cyL = hy + Math.cos(t) * LH / 2, czL = hz - Math.sin(t) * LH / 2 + LD / 2;
    at(0, cyL, czL, W, LH, LD, '#2A2D3A', { rx: -t });
    const nY = Math.sin(t), nZ = Math.cos(t), off = LD / 2 + .002;
    at(0, cyL + nY * off, czL + nZ * off, W * .88, LH * .82, .004, '#7D45D6', { rx: -t, glow: '#9D6BFF' });
  }
  function handle(P, x0, x1, y, z) { P.rod([x0, y, z], [x1, y, z], .012, '#9AA0A8'); }
  // calçado low-poly: sola, corpo e bico; salto = sapato de salto
  function shoe(P, x, y, z, c, kind, tilt) {
    const o = { rx: tilt };
    if (kind === 'salto') {
      P.box(x - .035, z - .1, .07, .2, y, .02, '#24252B', { r: .005, ...o });
      P.box(x - .035, z - .02, .07, .12, y + .02, .05, c, { r: .02, ...o });
      P.box(x - .02, z - .1, .04, .03, y - .06, .08, '#24252B', { r: .005, ...o });
    } else if (kind === 'bota') {
      P.box(x - .04, z - .11, .08, .22, y, .03, '#3A3C42', { r: .01, ...o });
      P.box(x - .038, z - .1, .076, .1, y + .03, .2, c, { r: .025, ...o });
      P.box(x - .038, z - .02, .076, .12, y + .03, .07, c, { r: .03, ...o });
    } else {
      P.box(x - .042, z - .11, .084, .22, y, .03, '#F2EFEA', { r: .012, ...o });
      P.box(x - .04, z - .1, .08, .12, y + .03, .08, c, { r: .03, ...o });
      P.box(x - .04, z - .0, .08, .1, y + .03, .05, c, { r: .025, ...o });
      P.box(x - .025, z - .02, .05, .05, y + .075, .012, '#FFFFFF', { r: 0, ...o });
    }
  }

  Object.assign(MODELS, {
    desk(P) {
      sled(P, .14, .15, .85, .7); sled(P, 1.86, .15, .85, .7);
      P.rod([.14, .3, .2], [1.86, .3, .2], .02, MET);
      P.box(0, 0, 2, 1, .7, .07, '#EFE9E0', { r: .03 });
      monitor(P, .65, .14, .7, .07, .9, .42, 1);
      // teclado e mouse como nas ilhas: centrados no monitor, 10 cm à frente dele
      keyboard(P, .75, .31, .44, .15, .77); mug(P, 1.59, .29, .77);
      flatBook(P, 1.4, .21, .77, .2, .14, .03, '#2F5FD0', .2); flatBook(P, 1.405, .22, .8, .17, .12, .02, '#F2B630', .1);
      P.chairs();
    },
    island(P) {
      for (const x of [.25, 3.75]) sled(P, x, .95, 2.05, .7);
      P.rod([.25, .3, 1.5], [3.75, .3, 1.5], .022, MET);
      P.box(0, .8, 4, 1.4, .7, .07, '#F2EDE6', { r: .03 });
      P.box(.1, 1.46, 3.8, .08, .77, .45, '#D9D2DA', { r: .03 }); // divisória reta (sem tubo no topo, que arredondava a quina)
      for (const cx of [1, 3]) {
        monitor(P, cx - .3, 1.2, .6, .06, .9, .4, -1); monitor(P, cx - .3, 1.68, .6, .06, .9, .4, 1);
        keyboard(P, cx - .25, .95, .44, .15, .77); keyboard(P, cx - .25, 1.89, .44, .15, .77);
      }
      mug(P, 1.6, 1.05, .77, '#F2B630'); mug(P, 3.45, 1.95, .77, '#2FA5A0');
      P.chairs();
    },
    meeting(P) {
      // tampo arredondado nas pontas, dois pés em coluna
      for (const x of [1.5, 4.0]) P.lathe(x, 1.5, 0, [[0, 0], [.32, 0], [.3, .04], [.08, .1], [.07, .6], [.16, .7], [0, .7]], MET, { seg: 8 });
      P.box(1.5, .8, 2.5, 1.4, .7, .07, '#C98F57', { r: .02 });
      for (const x of [1.5, 4.0]) P.cyl(x, 1.5, .7, .7, .7, .07, '#C98F57', { seg: 14 });
      P.cyl(2.5, 1.5, .16, .18, .77, .05, '#24252B', { seg: 10 });
      // viva-voz: a luz pulsa enquanto há reunião
      P.cyl(2.5, 1.5, .06, .06, .82, .01, '#3AA655', { seg: 8, glow: '#5CFF8A', anim: { type: 'pulse', g: 'voz', pivot: [2.5, .82, 1.5], on: 'act' } });
      laptop(P, 3.4, 1.29, .77, -.3);
      P.chairs();
    },
    reception(P) {
      P.box(0, .9, 3, .6, 0, 1.05, '#FFFFFF', { r: .06 });
      P.box(.2, 1.49, 2.6, .03, .2, .65, '#8C4FE0', { r: .01 });
      P.box(.25, 1.51, 2.5, .01, .48, .1, '#FFFFFF', { r: 0, glow: '#E9DDFF' });
      P.box(-.04, .82, 3.08, .74, 1.05, .06, '#C98F57', { r: .03 });
      P.box(.15, .55, 2.7, .38, .72, .04, '#EFE9E0', { r: .02 });
      monitor(P, 1.2, .72, .6, .07, 1.11, .38, -1);
      pot(P, 2.6, 1.15, .1, .16, POT, 1.11); bush(P, 2.6, 1.27, 1.15, .11, 4, 1);
      P.cyl(.45, 1.15, .06, .07, 1.11, .03, '#C9CDD4', { seg: 8 }); P.ball(.45, 1.15, 1.15, .045, '#C9CDD4', { sy: .7 });
      P.chairs();
    },
    fridge(P) {
      // caixa aberta na frente: dá para ver as bebidas pelo vidro
      // laterais e fundo param onde começa o teto vermelho (antes entravam nele e a quina "tremia")
      P.box(.05, .05, .9, .06, 0, 1.72, '#C9CDD4', { r: .03 });
      P.box(.05, .05, .06, .88, 0, 1.72, '#C9CDD4', { r: .03 }); P.box(.89, .05, .06, .88, 0, 1.72, '#C9CDD4', { r: .03 });
      P.box(.05, .05, .9, .88, 0, .15, '#9AA0A8', { r: .03 }); P.box(.05, .05, .9, .88, 1.72, .18, '#E0473B', { r: .04 });
      P.box(.11, .11, .78, .02, .15, 1.57, '#E9F6FF', { r: 0, glow: '#DDF3FF' });
      const COL = ['#E0473B', '#3AA655', '#F2B630', '#2F5FD0', '#8C4FE0', '#E07A3B'];
      for (const [k, y] of [.2, .58, .96, 1.34].entries()) {
        P.box(.11, .12, .78, .76, y, .025, '#FFFFFF', { r: 0 });
        for (let i = 0; i < 5; i++) { const c = COL[(i + k) % 6]; P.cyl(.2 + i * .15, .72, .045, .05, y + .025, .22, c, { seg: 6 }); P.cyl(.2 + i * .15, .72, .018, .03, y + .245, .07, c, { seg: 6 }); }
      }
      // porta de vidro com puxador: abre (gira na dobradiça da esquerda) enquanto alguém pega uma bebida
      const door = { type: 'swing', g: 'porta', pivot: [.07, .17, .92], on: 'act', angle: -1.25 };
      P.box(.07, .9, .86, .04, .17, 1.53, '#BFE6FF', { glass: true, r: 0, anim: door });
      P.rod([.84, .6, .96], [.84, 1.4, .96], .018, '#9AA0A8', { anim: door });
    },
    rug(P, o, colorOf) {
      P.box(0, 0, 3, 2, 0, .025, 'C', { r: .012 });
      P.box(.15, .15, 2.7, 1.7, .025, .006, tone(colorOf, .12), { r: 0 });
      P.box(.3, .3, 2.4, 1.4, .031, .006, 'C', { r: 0 });
      P.box(1.1, .75, .8, .5, .037, .006, tone(colorOf, .2), { r: 0 });
    },
    capacho(P) {
      P.box(.1, .1, 1.8, .8, 0, .025, '#5C5866', { r: .012 });
      P.box(.2, .2, 1.6, .6, .025, .006, '#8C4FE0', { r: 0 });
      for (let i = 0; i < 6; i++) P.box(.3 + i * .25, .28, .12, .44, .031, .004, '#A57BEF', { r: 0 });
    },
    chroma(P) {
      // fundo infinito: parede, curva e chão; varal com o rolo de papel em cima
      P.box(0, 0, 3, .08, .42, 1.98, '#36C254', { r: 0 });
      for (let i = 0; i < 4; i++) {
        const a = (i + .5) / 4 * Math.PI / 2, zc = .5 - .42 * Math.cos(a), yc = .42 - .42 * Math.sin(a);
        P.box(0, zc - .015, 3, .03, yc - .065, .17, '#36C254', { r: 0, rx: -a });
      }
      P.box(0, .48, 3, .52, 0, .02, '#36C254', { r: 0 });
      for (const x of [.05, 2.95]) { P.rod([x, 0, .06], [x, 2.55, .06], .025, MET); P.cyl(x, .06, .1, .12, 0, .03, MET, { seg: 6 }); }
      P.rod([.05, 2.5, .06], [2.95, 2.5, .06], .02, MET);
      P.rod([.05, 2.45, .07], [2.95, 2.45, .07], .08, '#2C9C46', { seg: 8 });
    },
    tv(P) {
      P.box(.65, .2, .7, .36, 0, .04, MET, { r: .02 });
      P.box(.93, .33, .14, .1, .04, .82, MET, { r: .02 });
      P.box(0, .3, 2, .09, .8, 1.1, '#1E1F24', { r: .03 });
      P.base([0, 1, 2]);
      P.box(.9, .4, .2, .015, .82, .03, '#9AA0A8', { r: 0 });
    },
    kanban(P) {
      for (const x of [.19, 1.81]) { P.box(x - .05, .2, .1, .6, 0, .04, MET, { r: .015 }); P.rod([x, .02, .46], [x, .92, .46], .025, MET); }
      P.box(0, .42, 2, .07, .9, 1.25, '#FFFFFF', { r: .015 });
      P.box(-.02, .41, 2.04, .09, .88, .04, '#9AA0A8', { r: .01 }); P.box(-.02, .41, 2.04, .09, 2.13, .04, '#9AA0A8', { r: .01 });
      P.box(-.02, .41, .04, .09, .9, 1.25, '#9AA0A8', { r: .01 }); P.box(1.98, .41, .04, .09, .9, 1.25, '#9AA0A8', { r: .01 });
      P.box(.3, .49, 1.4, .1, .86, .025, '#9AA0A8', { r: .005 });
      [['#E0473B', .5], ['#2F5FD0', .65], ['#24252B', .8]].forEach(([c, x]) => P.rod([x - .06, .9, .54], [x + .06, .9, .54], .014, c));
      P.base([0, 1, 2]);
    },
    rack(P) {
      P.box(.1, .1, .8, .75, .05, 2.05, '#2E3036', { r: .03 });
      for (const [x, z] of [[.16, .16], [.84, .16], [.16, .8], [.84, .8]]) P.ball(x, .03, z, .03, '#1E1F24');
      for (let i = 0; i < 4; i++) {
        const y = .15 + i * .45;
        P.box(.16, .84, .68, .03, y, .35, '#3A3C44', { r: .01 });
        for (let k = 0; k < 3; k++) P.box(.18, .86, .64, .02, y + .03 + k * .11, .08, '#4A4F5A', { r: .01 });
        P.box(.7, .87, .1, .015, y + .14, .06, '#9AA0A8', { r: 0 });
      }
      for (let k = 0; k < 5; k++) P.box(.25, .2 + k * .12, .5, .06, 2.1, .01, '#24252B', { r: 0 });
    },
    printer(P) {
      P.box(.1, .2, .8, .6, .05, .52, '#E4E1E0', { r: .05 });
      for (const [x, z] of [[.18, .28], [.82, .28], [.18, .72], [.82, .72]]) P.ball(x, .03, z, .03, '#24252B');
      P.box(.14, .79, .72, .015, .12, .16, '#C9CDD4', { r: 0 }); P.box(.14, .79, .72, .015, .3, .16, '#C9CDD4', { r: 0 });
      handle(P, .4, .6, .21, .81); handle(P, .4, .6, .39, .81);
      // impressora multifuncional sobre o gabinete: corpo largo e baixo, tampa do scanner escura, painel inclinado
      // com visor, fenda de saída na frente com bandeja e folha, bandeja de entrada de papel em pé atrás
      P.box(.12, .22, .76, .56, .55, .17, '#F2F1EE', { r: 0 });             // corpo
      P.box(.12, .22, .76, .46, .72, .05, '#5C5866', { r: 0 });             // tampa do scanner
      P.box(.12, .68, .76, .1, .72, .03, '#D9D6D2', { r: 0 });              // faixa da frente, sob o painel
      P.box(.5, .68, .3, .1, .75, .025, '#3A3C42', { r: 0, rx: .35 });      // painel
      P.box(.53, .7, .14, .05, .77, .006, '#3AA655', { r: 0, glow: '#5CFF8A', rx: .35 }); // visor
      P.box(.2, .776, .6, .006, .715, .035, '#24252B', { r: 0 });           // fenda de saída
      P.box(.22, .78, .56, .16, .7, .012, '#C9CDD4', { r: 0 });             // bandeja de saída
      P.box(.26, .78, .48, .12, .712, .006, '#FFFFFF', { r: 0 });           // folha impressa
      P.box(.22, .16, .56, .02, .74, .22, '#C9CDD4', { r: 0, rx: -.35 });   // bandeja de entrada (atrás)
      P.box(.26, .15, .48, .006, .78, .2, '#FFFFFF', { r: 0, rx: -.35 });   // papel em branco
    },
    maca(P) {
      for (const x of [.2, 1.8]) for (const z of [.25, .75]) P.rod([x, 0, z], [x, .5, z], .025, '#C9CDD4');
      for (const x of [.2, 1.8]) P.rod([x, .15, .25], [x, .15, .75], .015, '#C9CDD4');
      P.rod([.2, .15, .5], [1.8, .15, .5], .015, '#C9CDD4');
      P.box(.1, .15, 1.8, .7, .5, .1, '#E4E1E0', { r: .03 });
      P.box(.55, .17, 1.33, .66, .6, .12, '#7FC4E8', { r: .05 });
      P.box(.12, .17, .45, .66, .66, .12, '#7FC4E8', { r: .05, rz: -.35 });
      P.box(.62, .22, 1.2, .56, .72, .008, '#FFFFFF', { r: 0 });
      P.box(.16, .26, .3, .48, .82, .08, '#FFFFFF', { r: .04, rz: -.35 });
      P.rod([1.88, .7, .2], [1.88, .7, .8], .07, '#FFFFFF', { seg: 8 });
    },
    lowshelf(P) {
      P.box(0, .2, 2, .6, .05, .85, '#F0EBE4', { r: .03 });
      P.box(.05, .25, 1.9, .5, 0, .06, WOOD_D, { r: .01 });
      P.box(.08, .79, .88, .02, .12, .7, '#E2DBD2', { r: .01 }); P.box(1.04, .79, .88, .02, .12, .7, '#E2DBD2', { r: .01 });
      P.rod([.9, .4, .82], [.9, .6, .82], .012, '#9AA0A8'); P.rod([1.1, .4, .82], [1.1, .6, .82], .012, '#9AA0A8');
      [['#2F5FD0', .4], ['#E0473B', .34], ['#F2B630', .42], ['#3AA655', .36]].forEach(([c, h], i) => book(P, .2 + i * .13, .36, .11, .28, .9, h, c));
      P.lathe(1.52, .5, .9, [[0, 0], [.08, 0], [.12, .12], [.08, .26], [.06, .3], [0, .3]], '#8C4FE0', { seg: 8 });
      spikes(P, 1.52, 1.18, .5, 4, .3, 1);
    },
    bancada_cozinha(P) {
      // armário e tampo montados à mão com um VÃO para a cuba (antes a pia era uma placa sobre o tampo, sem fundo)
      P.base([0, 4, 5, 6, 7, 8, 9, 10]);
      const SX0 = 1.95, SX1 = 2.6, SZ0 = .3, SZ1 = .7, TOP = '#3A3C42', BODY = '#E4E1E0', INOX = '#9AA0A8';
      P.box(.05, .1, 2.9, .85, 0, .68, BODY, { r: 0 });                                  // corpo até a altura do fundo da cuba
      P.box(.05, .1, SX0 - .05, .85, .68, .17, BODY, { r: 0 }); P.box(SX1, .1, 2.95 - SX1, .85, .68, .17, BODY, { r: 0 });
      P.box(SX0, .1, SX1 - SX0, SZ0 - .1, .68, .17, BODY, { r: 0 }); P.box(SX0, SZ1, SX1 - SX0, .95 - SZ1, .68, .17, BODY, { r: 0 });
      P.box(0, .05, SX0, .95, .85, .06, TOP, { r: 0 }); P.box(SX1, .05, 3 - SX1, .95, .85, .06, TOP, { r: 0 });   // tampo em volta do vão
      P.box(SX0, .05, SX1 - SX0, SZ0 - .05, .85, .06, TOP, { r: 0 }); P.box(SX0, SZ1, SX1 - SX0, 1 - SZ1, .85, .06, TOP, { r: 0 });
      // cuba funda: fundo escuro 20 cm abaixo do tampo e paredes inox por dentro
      P.box(SX0, SZ0, SX1 - SX0, SZ1 - SZ0, .7, .01, '#5C6068', { r: 0 });
      P.box(SX0, SZ0, .01, SZ1 - SZ0, .7, .21, '#7D828A', { r: 0 }); P.box(SX1 - .01, SZ0, .01, SZ1 - SZ0, .7, .21, '#7D828A', { r: 0 });
      P.box(SX0, SZ0, SX1 - SX0, .01, .7, .21, '#6B7078', { r: 0 }); P.box(SX0, SZ1 - .01, SX1 - SX0, .01, .7, .21, '#6B7078', { r: 0 });
      P.cyl((SX0 + SX1) / 2, (SZ0 + SZ1) / 2, .025, .025, .711, .004, '#3A3C42', { seg: 16 });   // ralo
      for (const x of [.55, 1.5, 2.45]) handle(P, x - .15, x + .15, .68, .97);
      P.box(0, 0, 3, .04, .91, .55, '#FFFFFF', { r: 0 });
      for (let i = 1; i < 6; i++) P.box(i * .5, .04, .01, .005, .91, .55, '#D9D6DE', { r: 0 });
      P.rod([2.27, .91, .15], [2.27, 1.22, .15], .022, MET); P.rod([2.27, 1.22, .15], [2.27, 1.2, .38], .018, MET);
      // em uso: água saindo da torneira até o fundo da cuba
      P.cyl(2.27, .38, .009, .009, .71, .48, '#9FD8F2', { seg: 8, anim: { type: 'pour', g: 'agua', pivot: [2.27, 1.19, .38], on: 'act' } });
      P.box(.35, .3, .65, .42, .91, .03, '#DBB07A', { r: .01 });
      // pote aberto, tomate e fruteira funda com frutas redondas
      vessel(P, .55, .45, .94, .06, .1, '#E0473B'); P.ball(.78, .99, .42, .06, '#3AA655');
      vessel(P, 1.4, .4, .91, .13, .11, '#FFFFFF', .08);
      P.ball(1.36, 1.0, .38, .05, '#F2B630'); P.ball(1.45, 1.0, .43, .05, '#E07A3B'); P.ball(1.4, 1.04, .35, .045, '#E0473B');
    },
    estoque(P) {
      for (const x of [.05, 1.95]) for (const z of [.13, .87]) P.box(x - .025, z - .025, .05, .05, 0, 1.92, '#5C6670', { r: .01 });
      P.rod([.05, .1, .13], [1.95, 1.8, .13], .01, '#5C6670'); P.rod([1.95, .1, .13], [.05, 1.8, .13], .01, '#5C6670');
      for (const y of [.08, .68, 1.28, 1.86]) P.box(0, .1, 2, .8, y, .04, '#9AA0A8', { r: .01 });
      it_boxes(P);
    },
    vitrine(P) {
      P.box(0, .1, 2, .85, .06, .64, '#FFFFFF', { r: .04 }); P.box(.04, .14, 1.92, .77, 0, .06, WOOD_D, { r: .01 });
      P.box(.08, .95, .9, .01, .14, .5, '#EFE9E0', { r: 0 }); P.box(1.02, .95, .9, .01, .14, .5, '#EFE9E0', { r: 0 });
      P.box(0, .1, 2, .85, .7, .03, '#C9CDD4', { r: .01 });
      for (const [x, z] of [[.02, .12], [1.98, .12], [.02, .93], [1.98, .93]]) P.rod([x, .73, z], [x, 1.18, z], .012, '#C9CDD4');
      P.box(.02, .12, 1.96, .81, .73, .45, '#BFE6FF', { glass: true, r: 0 });
      P.box(0, .1, 2, .85, 1.18, .03, '#C9CDD4', { r: .01 }); P.box(.1, .15, 1.8, .04, 1.14, .02, '#FFF6D6', { r: 0, glow: '#FFF1BF' });
      P.lathe(.42, .45, .73, [[0, 0], [.06, 0], [.07, .1], [.03, .14], [.03, .2], [0, .2]], '#E0473B', { seg: 8 });
      P.box(.85, .35, .3, .2, .73, .2, '#F2B630', { r: .04 }); P.rod([.9, .93, .45], [1.0, 1.0, .45], .012, '#7A4A2A'); P.rod([1.0, 1.0, .45], [1.1, .93, .45], .012, '#7A4A2A');
      P.box(1.42, .32, .3, .3, .73, .14, '#8C4FE0', { r: .01 }); P.box(1.55, .31, .04, .32, .73, .145, '#F2EFEA', { r: 0 });
    },
    caixa(P) {
      P.box(0, .1, 2, .85, 0, 1, '#C98F57', { r: .04 });
      for (let i = 0; i < 9; i++) P.box(.12 + i * .2, .95, .12, .02, .12, .8, i % 2 ? '#B07A4A' : '#A06D40', { r: .01 });
      P.box(-.03, .05, 2.06, .95, 1, .05, '#24252B', { r: .02 });
      P.box(1.15, .3, .55, .45, 1.05, .16, '#3A3C42', { r: .03 });
      // gaveta do caixa: abre para o lado de quem atende enquanto alguém vende
      P.box(1.2, .27, .45, .04, 1.07, .07, '#2A2D3A', { r: 0, anim: { type: 'slide', g: 'gaveta', pivot: [1.42, 1.1, .29], on: 'act', dir: [0, 0, -1], dist: .14 } });
      P.rod([1.42, 1.2, .4], [1.42, 1.3, .32], .02, MET);
      P.base([0, 1, 2, 3]);
      P.box(.7, .5, .26, .18, 1.05, .28, '#DBB07A', { r: .01 }); P.box(.73, .48, .2, .01, 1.15, .1, '#8C4FE0', { r: 0 });
    },
    bancada_oficina(P) {
      for (const x of [.13, 1.87]) for (const z of [.25, .8]) P.box(x - .04, z - .04, .08, .08, 0, .85, MET, { r: .015 });
      P.box(.1, .25, 1.8, .55, .25, .04, '#9AA0A8', { r: .01 });
      P.box(0, .1, 2, .9, .85, .08, '#B07A4A', { r: .02 });
      P.box(0, .02, 2, .05, .93, 1, '#DBB07A', { r: .01 });
      for (let i = 0; i < 9; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2) P.box(.12 + i * .2, .07, .02, .005, 1.05 + j * .22, .02, '#A57F55', { r: 0 });
      // ferramentas na parede: martelo, chave, chave de fenda, serrote
      P.rod([.25, 1.25, .1], [.25, 1.6, .1], .014, '#8E5B3A'); P.box(.17, .08, .16, .05, 1.6, .06, '#5C6670', { r: .01 });
      P.rod([.55, 1.2, .1], [.55, 1.62, .1], .014, '#9AA0A8'); P.box(.51, .08, .08, .03, 1.6, .07, '#9AA0A8', { r: .01 });
      P.cyl(.85, .1, .025, .025, 1.42, .14, '#E0473B', { seg: 6 }); P.rod([.85, 1.22, .1], [.85, 1.42, .1], .008, '#C9CDD4');
      P.box(1.1, .08, .3, .01, 1.35, .16, '#C9CDD4', { r: 0 }); P.box(1.38, .07, .1, .03, 1.38, .12, '#E07A3B', { r: .01 });
      P.box(1.5, .4, .34, .26, .93, .16, '#E0473B', { r: .03 }); P.rod([1.58, 1.12, .53], [1.76, 1.12, .53], .012, MET);
      P.box(.48, .5, .34, .2, .93, .1, '#3A3C42', { r: .02 }); P.box(.48, .55, .34, .1, 1.03, .08, '#4A4F5A', { r: .01 }); P.rod([.5, 1.05, .82], [.5, 1.05, .95], .012, MET);
    },
    mesa_embalagem(P) {
      for (const x of [.12, 1.88]) for (const z of [.24, .76]) P.rod([x, 0, z], [x, .8, z], .028, MET);
      P.rod([.12, .25, .5], [1.88, .25, .5], .02, MET);
      P.box(0, .1, 2, .85, .8, .06, '#EFE9E0', { r: .02 });
      P.box(.2, .25, .55, .45, .86, .35, '#C98F57', { r: .01 }); P.box(.2, .45, .55, .05, 1.21, .006, '#F2B630', { r: 0 });
      P.box(.95, .3, .45, .4, .86, .25, '#C98F57', { r: .01 }); P.box(1.15, .3, .05, .4, 1.11, .006, '#F2B630', { r: 0 });
      P.box(1.5, .4, .24, .14, .86, .04, '#3A3C42', { r: .01 }); P.rod([1.59, .96, .47], [1.65, .96, .47], .06, '#F2B630', { seg: 8 });
      P.rod([.75, .38, .5], [1.25, .38, .5], .1, '#BFE6FF', { seg: 8 });
    },
    coffee(P) {
      P.base([5, 6, 7, 8, 9, 10]);
      for (const x of [.52, 1.47, 2.42]) handle(P, x - .15, x + .15, .75, 1.0);
      // máquina de espresso: corpo inox, grade de xícaras no topo, grupo com porta-filtro e cabo, bandeja de pingos
      // com xícara embaixo do bico, bico de vapor e manômetro na frente (o vapor animado sai do topo)
      const ZF = .7, AX = Math.PI / 2;
      P.box(.3, .2, .5, .5, 1.03, .62, '#C9CDD4', { r: 0 });                       // corpo
      P.box(.3, .2, .5, .5, 1.65, .015, '#9AA0A8', { r: 0 });                      // grade do topo
      for (const x of [.43, .6]) vessel(P, x, .38, 1.665, .035, .05, '#FFFFFF', .03);  // xícaras vazias aquecendo (ocas)
      P.box(.3, ZF - .005, .5, .01, 1.5, .05, '#24252B', { r: 0 });               // faixa do painel
      P.cyl(.4, ZF + .005, .045, .045, 1.52, .01, '#FFFFFF', { seg: 16, rx: AX });  // manômetro
      for (const x of [.58, .66]) P.cyl(x, ZF + .006, .018, .018, 1.517, .012, x < .6 ? '#3AA655' : '#E0473B', { seg: 12, rx: AX }); // botões
      P.cyl(.5, ZF + .04, .065, .065, 1.36, .08, MET, { seg: 16, rx: AX });          // grupo
      P.cyl(.5, ZF + .04, .06, .055, 1.27, .06, '#3A3C42', { seg: 16 });             // porta-filtro
      P.rod([.5, 1.3, ZF + .1], [.5, 1.28, ZF + .26], .018, '#24252B');                // cabo
      P.box(.33, ZF, .44, .2, 1.03, .03, '#3A3C42', { r: 0 });                      // bandeja de pingos
      P.cyl(.5, ZF + .09, .035, .03, 1.06, .06, '#FFFFFF', { seg: 12 }); P.cyl(.5, ZF + .09, .029, .029, 1.1, .022, '#3B2A20', { seg: 12 }); // xícara com café
      P.rod([.74, 1.42, ZF + .02], [.78, 1.16, ZF + .1], .01, MET);                    // bico de vapor
      // em uso: fio de café caindo do porta-filtro na xícara
      P.cyl(.5, ZF + .06, .007, .007, 1.12, .15, '#6B4226', { seg: 8, anim: { type: 'pour', g: 'cafe', pivot: [.5, 1.27, ZF + .06], on: 'act' } });
      mug(P, 1.47, .48, 1.03); mug(P, 1.77, .48, 1.03, '#E0473B');
      pot(P, 2.52, .48, .17, .3, POT, 1.03); bush(P, 2.52, 1.29, .48, .18, 5, 2);
    },
    // cadeira de barbeiro virada para o espelho: base cromada, assento e encosto altos estofados, apoio de cabeça e de pés
    cadeira_salao(P, o, colorOf) {
      const CR = '#C9CDD4', L = 'C', dk = tone(colorOf, -.08);
      // espelho maior (moldura até 2,05 m) com vidro azulado e faixas de brilho em diagonal, como reflexo
      P.box(.04, .01, .78, .04, .78, 1.27, '#8A8F99', { r: 0 });
      P.box(.08, .03, .7, .021, .82, 1.19, '#BFD3E2', { r: 0 });
      for (const [x, y, w] of [[.2, 1.55, .5], [.36, 1.35, .32], [.14, 1.12, .22]]) P.box(x, .05, w, .003, y, .035, '#F4FAFF', { r: 0, rz: .55 });
      P.box(.1, .02, .68, .2, .72, .04, '#F0EBE4', { r: .01 }); // bancada, sem frascos
      // poste de barbeiro
      P.cyl(.89, .07, .045, .045, 1.1, .04, CR, { seg: 8 });
      // listras do poste "sobem" sem parar (o poste de barbeiro clássico gira), mesmo sem ninguém usando
      for (let i = 0; i < 6; i++) P.cyl(.89, .07, .04, .04, 1.14 + i * .07, .07, ['#E0473B', '#FFFFFF', '#2F5FD0'][i % 3], { seg: 8, anim: { type: 'loop', g: 'p' + i, pivot: [.89, 1.14 + i * .07, .07], on: 'idle', i, step: .07, n: 6 } });
      P.cyl(.89, .07, .045, .045, 1.56, .04, CR, { seg: 8 }); P.ball(.89, 1.62, .07, .035, CR);
      // base e coluna
      P.lathe(.5, .6, 0, [[0, 0], [.24, 0], [.22, .04], [.08, .09], [0, .1]], CR, { seg: 12 });
      P.cyl(.5, .6, .05, .06, .08, .26, CR, { seg: 8 });
      P.rod([.5, .06, .6], [.72, .05, .76], .015, CR); P.box(.68, .72, .1, .08, .03, .03, '#24252B', { r: .01 });
      // tudo de cima da coluna gira junto (vai e volta) enquanto alguém está sendo atendido
      const GIRO = { type: 'yawOsc', g: 'giro', pivot: [.5, .34, .6], on: 'act' };
      P.box(.22, .34, .56, .5, .34, .1, CR, { r: .02, anim: GIRO });
      // assento, braços, encosto inclinado e apoio de cabeça
      P.box(.2, .3, .6, .52, .42, .14, L, { r: .045, soft: true, anim: GIRO });
      for (const x of [.13, .79]) { P.box(x, .34, .08, .44, .48, .14, CR, { r: .02, anim: GIRO }); P.box(x - .01, .3, .1, .48, .62, .07, dk, { r: .03, soft: true, anim: GIRO }); }
      P.box(.21, .74, .58, .14, .52, .66, L, { r: .045, rx: .14, soft: true, anim: GIRO });
      for (let i = 0; i < 3; i++) P.box(.24, .835 + i * .015, .52, .01, .66 + i * .2, .01, dk, { r: 0, rx: .14, anim: GIRO });
      P.rod([.5, 1.15, .9], [.5, 1.28, .93], .016, CR, { anim: GIRO });
      P.box(.34, .86, .32, .1, 1.26, .14, L, { r: .04, rx: .14, soft: true, anim: GIRO });
      // apoio de pés na frente (perto do espelho)
      P.rod([.5, .38, .3], [.5, .16, .2], .018, CR, { anim: GIRO }); P.box(.32, .12, .36, .14, .13, .03, CR, { r: .01, anim: GIRO });
    },
    // estante de sapatos de loja: painel alto com prateleiras inclinadas, pares de calçados expostos
    sapateira(P) {
      P.box(0, 0, 2, .1, .12, 2.0, '#F0EBE4', { r: .02 });
      P.box(0, 0, .07, .55, 0, 2.1, '#DBB07A', { r: .02 }); P.box(1.93, 0, .07, .55, 0, 2.1, '#DBB07A', { r: .02 });
      P.box(0, 0, 2, .55, 0, .12, '#B07A4A', { r: .02 }); P.box(0, 0, 2, .5, 2.06, .06, '#DBB07A', { r: .02 });
      P.box(.1, .1, 1.8, .02, 1.98, .04, '#FFF6D6', { r: 0, glow: '#FFF1BF' });
      const T = .22, KIND = [['tenis', '#E0473B'], ['salto', '#24252B'], ['tenis', '#2F5FD0'], ['bota', '#8E5B3A'], ['tenis', '#FFFFFF'], ['salto', '#E89BB5'], ['bota', '#3A3C42'], ['tenis', '#3AA655'], ['salto', '#F2B630'], ['tenis', '#8C4FE0'], ['bota', '#B07A4A'], ['tenis', '#24252B']];
      [.32, .72, 1.12, 1.52].forEach((y, r) => {
        P.box(.07, .1, 1.86, .42, y, .03, '#DBB07A', { r: .01, rx: T });
        P.box(.07, .5, 1.86, .03, y - .1, .06, '#B07A4A', { r: 0, rx: T });
        for (let i = 0; i < 3; i++) {
          const [k, c] = KIND[(r * 3 + i) % KIND.length], cx = .38 + i * .62, sy = y + .03 + .05;
          shoe(P, cx - .055, sy, .3, c, k, T); shoe(P, cx + .055, sy - .005, .32, c, k, T);
        }
      });
    },
  });
  // caixas de papelão do estoque (do catálogo) com fita e etiqueta
  function it_boxes(P) {
    const it = ITEMS.estoque; it.boxes.slice(6).forEach(b => {
      P.box(b.x, b.z, b.w, b.d, b.y, b.h, b.c, { r: .01 });
      P.box(b.x + b.w / 2 - .03, b.z, .06, b.d, b.y + b.h, .004, '#F2E3B8', { r: 0 });
      P.box(b.x + .06, b.z + b.d, .14, .004, b.y + b.h * .4, .08, '#FFFFFF', { r: 0 });
    });
  }

  /* ---------- API ---------- */
  return {
    hasModel: (itemId) => !!(MODELS[itemId] || MODELS[ITEMS[itemId]?.look3d]),
    // peças de um item (espaço do item, sem giro) → [{ geo, c, glow, double, glass }]
    pieces(itemId, colorOf) {
      const it = ITEMS[itemId]; if (!it) return [];
      const P = maker(it, colorOf);
      const m = MODELS[itemId] || MODELS[it.look3d];
      if (m) m(P, null, colorOf); else { P.base(); P.chairs(); }
      return P.out;
    },
    // giro do catálogo (rotRect): a cada passo (x, z) → (D − z, x)
    matrix(itemId, rot, x, z) {
      const it = ITEMS[itemId]; let Wd = it.w, Dd = it.d;
      const M = new THREE.Matrix4(), R = new THREE.Matrix4().makeRotationY(-Math.PI / 2), T = new THREE.Matrix4();
      for (let i = 0; i < ((rot % 4) + 4) % 4; i++) { M.premultiply(R); M.premultiply(T.makeTranslation(Dd, 0, 0)); [Wd, Dd] = [Dd, Wd]; }
      return M.premultiply(T.makeTranslation(x, 0, z));
    },
  };
}
