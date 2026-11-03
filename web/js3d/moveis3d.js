// Móveis em 3D no estilo dos personagens: low-poly facetado (poucas faces, sombreado chapado), cantos chanfrados,
// formas redondas onde a peça é redonda (vasos, troncos, assentos, luminárias) e folhas/roupas recortadas.
//
// O catálogo (web/js/01-catalogo.js) continua sendo a verdade para tamanho, colisão, pontos de uso e o desenho 2D.
// Aqui cada item pode ter um MODELO: uma função que monta peças no espaço do item (x de 0 a w, z de 0 a d,
// fundo em z = 0, frente — onde a pessoa usa — em z = d; y para cima) sem girar. Quem chama aplica giro e posição.
// Sem modelo, o item é desenhado com as caixas do catálogo (chanfradas) e cadeiras de verdade no lugar das caixas.
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
    const rr = Math.min(r, w / 2 - .002, h / 2 - .002, d / 2 - .002);
    return rr > .006 ? new RoundedBoxGeometry(w, h, d, 1, rr) : new THREE.BoxGeometry(w, h, d);
  });
  const cylG = (rt, rb, h, seg) => memo(`c${n3(rt)},${n3(rb)},${n3(h)},${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg, 1));
  const icoG = (r, det) => memo(`i${n3(r)},${det}`, () => new THREE.IcosahedronGeometry(r, det));
  const dodG = (r) => memo(`d${n3(r)}`, () => new THREE.DodecahedronGeometry(r, 0));
  const latheG = (pts, seg) => memo('l' + pts.flat().join(',') + seg, () => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg));
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
      out.push({ geo: g, c: col(c), glow: o.glow ? col(o.glow === true ? c : o.glow) : null, double: !!o.double, glass: !!o.glass });
    };
    const P = {
      out,
      box(x, z, w, d, y, h, c, o = {}) { put(rbox(w, h, d, o.r ?? .025), c, x + w / 2, y + h / 2, z + d / 2, o); },
      cyl(cx, cz, rt, rb, y, h, c, o = {}) { put(cylG(rt, rb, h, o.seg || 8), c, cx, y + h / 2, cz, o); },
      ball(cx, y, cz, r, c, o = {}) { put(o.dodeca ? dodG(r) : icoG(r, o.detail || 0), c, cx, y, cz, o); },
      lathe(cx, cz, y, pts, c, o = {}) { put(latheG(pts, o.seg || 8), c, cx, y, cz, o); },
      // haste reta entre dois pontos
      rod(a, b, r, c, o = {}) {
        const A = new THREE.Vector3(...a), Bv = new THREE.Vector3(...b), dir = Bv.clone().sub(A), len = dir.length();
        const g = cylG(r, r, len, o.seg || 6).clone();
        g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()));
        const m = A.add(Bv).multiplyScalar(.5); g.translate(m.x, m.y, m.z);
        out.push({ geo: g, c: col(c), glow: null, double: false, glass: false });
      },
      leaf(cx, y, cz, yaw, len, wid, rise, droop, c) { put(leafG(len, wid, rise, droop), c, cx, y, cz, { ry: yaw, double: true }); },
      garment(cx, y, cz, kind, c, yaw) { put(garmentG(kind), c, cx, y, cz, { ry: yaw }); },
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
    P.box(x - .25, z - .23, .5, .46, .37, .09, CHR, { r: .035 });
    const [bx, bz] = L(0, .2); P.rod([x, .4, z], [bx, .5, bz], .02, MET);
    P.box(bx - .23, bz - .045, .46, .09, .48, .4, CHR, { r: .04, ry: yaw });
  }
  // vaso com terra
  function pot(P, cx, cz, r, h, c = POT) {
    P.lathe(cx, cz, 0, [[0, 0], [r * .78, 0], [r, h * .85], [r * 1.06, h * .88], [r * 1.06, h], [r * .92, h], [0, h * .9]], c, { seg: 8 });
    P.cyl(cx, cz, r * .9, r * .9, h * .9, .02, SOIL, { seg: 8 });
  }
  // moita de folhas: bolas facetadas de verdes diferentes
  function bush(P, cx, y, cz, r, n = 5, seed = 0) {
    for (let i = 0; i < n; i++) {
      const a = (i + seed) * 2.4, d = i ? r * .55 : 0, rr = r * (i ? .6 + (i % 3) * .08 : .75);
      P.ball(cx + Math.cos(a) * d, y + (i ? rr * .4 : rr * .7) + (i % 2) * r * .15, cz + Math.sin(a) * d * .8, rr, GREENS[(i + seed) % 4], { detail: 0 });
    }
  }
  // tufo de folhas compridas em leque (espada-de-são-jorge, capim)
  function spikes(P, cx, y, cz, n, h, seed = 0) {
    for (let i = 0; i < n; i++) {
      const a = (i + seed) * 2.1, lean = .25 + (i % 3) * .12;
      P.leaf(cx + Math.cos(a) * .03, y, cz + Math.sin(a) * .03, a, h * lean, .09, h * (1 - lean * .5), h * lean * .5, GREENS[(i + seed) % 4]);
    }
  }
  // folhas caindo em volta (palmeira, samambaia)
  function crown(P, cx, y, cz, n, len, wid, droop, seed = 0) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + seed;
      P.leaf(cx, y, cz, a, len * (.85 + (i % 3) * .1), wid, len * .35, droop, GREENS[i % 4]);
    }
  }

  /* ---------- modelos ---------- */
  const MODELS = {
    palm(P) {
      pot(P, .5, .5, .26, .44);
      // tronco em gomos, levemente inclinado
      let y = .42, x = .5, z = .5;
      for (let k = 0; k < 5; k++) { const h = .22, nx = .5 + Math.sin(k * .7) * .035; P.cyl(nx, z, .065 - k * .006, .08 - k * .006, y, h, k % 2 ? '#8E5B3A' : WOOD_D, { seg: 6 }); y += h; x = nx; }
      crown(P, x, y, z, 9, .78, .26, .7, .3);
      crown(P, x, y + .04, z, 5, .5, .2, .2, 1.1);
      crown(P, x, y + .08, z, 3, .3, .14, -.15, 2.0);
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
      pot(P, .45, .5, .13, .2, '#C98F57'); bush(P, .45, .7, .5, .14, 4, 1);
      pot(P, 1.37, .5, .12, .18, POT); spikes(P, 1.37, 1.19, .5, 6, .36, 1);
      pot(P, .5, .5, .12, .18, '#C98F57'); crown(P, .5, 1.64, .5, 7, .32, .1, .45, .2);
      pot(P, 1.5, .5, .13, .2, POT); bush(P, 1.5, 1.66, .5, .16, 5, 2);
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
        const cx = .4 + i * .24, yaw = -.6 + (i % 2) * .12;
        // cabide: gancho e ombro
        P.rod([cx, 1.52, .5], [cx, 1.44, .5], .008, '#9AA0A8');
        P.rod([cx - Math.cos(yaw) * .2, 1.4, .5 + Math.sin(yaw) * .2], [cx + Math.cos(yaw) * .2, 1.4, .5 - Math.sin(yaw) * .2], .012, k === 'calca' ? MET : '#DBB07A');
        P.garment(cx, 1.42, .5, k, c, yaw);
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
      P.box(0, 0, 3, 1, .1, .32, 'C', { r: .06 });
      P.box(.02, 0, 2.96, .3, .4, .55, dk, { r: .08 });
      P.box(0, .25, .3, .75, .4, .27, 'C', { r: .08 }); P.box(2.7, .25, .3, .75, .4, .27, 'C', { r: .08 });
      P.box(.32, .3, 1.16, .66, .42, .12, lt, { r: .05 }); P.box(1.52, .3, 1.16, .66, .42, .12, lt, { r: .05 });
      P.box(.4, .26, .4, .14, .54, .34, '#F2B630', { r: .05, rx: -.25 }); P.box(2.2, .26, .4, .14, .54, .34, '#E4E1E0', { r: .05, rx: -.25 });
    },
    armchair(P, o, colorOf) {
      const dk = tone(colorOf, -.08), lt = tone(colorOf, .06);
      for (const fx of [.12, .88]) for (const fz of [.12, .88]) P.cyl(fx, fz, .035, .025, 0, .1, WOOD_D, { seg: 6 });
      P.box(0, 0, 1, 1, .1, .32, 'C', { r: .06 });
      P.box(.02, 0, .96, .3, .4, .52, dk, { r: .08 });
      P.box(0, .25, .2, .75, .4, .24, 'C', { r: .07 }); P.box(.8, .25, .2, .75, .4, .24, 'C', { r: .07 });
      P.box(.21, .3, .58, .66, .42, .11, lt, { r: .05 });
    },
    pouf(P, o, colorOf) {
      P.lathe(.5, .5, 0, [[0, 0], [.27, 0], [.32, .12], [.32, .3], [.27, .4], [0, .42]], 'C', { seg: 10 });
      P.cyl(.5, .5, .07, .07, .41, .02, tone(colorOf, -.1), { seg: 8 });
    },
    ctable(P) {
      for (const fx of [.3, 1.7]) for (const fz of [.25, .75]) P.cyl(fx, fz, .03, .02, 0, .35, WOOD_D, { seg: 6 });
      P.box(.1, .15, 1.8, .7, .35, .07, '#C98F57', { r: .035 });
      P.box(.35, .33, .36, .26, .42, .05, '#2F5FD0', { r: .01 }); P.box(.38, .35, .32, .24, .47, .05, '#F2B630', { r: .01, ry: .15 });
      P.cyl(1.35, .48, .06, .05, .42, .11, '#FFFFFF', { seg: 8 });
      pot(P, 1.68, .5, .08, .12); bush(P, 1.68, .54, .5, .08, 3, 1);
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
      P.cyl(.5, .74, .08, .09, 1.24, .16, '#5C5866', { seg: 8, rx: Math.PI / 2 });
      P.cyl(.5, .83, .065, .065, 1.24, .02, '#2A2D3A', { seg: 8, rx: Math.PI / 2 });
    },
    cavalete(P) {
      P.rod([.22, 0, .58], [.47, 1.6, .5], .025, WOOD); P.rod([.78, 0, .58], [.53, 1.6, .5], .025, WOOD);
      P.rod([.5, 0, .1], [.5, 1.5, .45], .025, WOOD);
      P.box(.15, .5, .7, .07, .55, .05, WOOD, { r: .015 });
      P.box(.16, .47, .68, .05, .6, .78, '#FFFFFF', { r: .01 });
      P.box(.25, .52, .25, .01, .95, .3, '#2F5FD0', { r: 0 }); P.box(.5, .52, .2, .01, .75, .25, '#F2B630', { r: 0 }); P.box(.3, .52, .3, .01, .7, .15, '#E0473B', { r: 0 });
    },
    balanca(P) {
      P.box(.25, .35, .5, .5, 0, .07, POT, { r: .03 });
      P.box(.3, .4, .4, .4, .07, .01, '#5C5866', { r: 0 });
      P.rod([.5, .07, .42], [.5, 1.12, .42], .03, MET);
      P.box(.33, .33, .34, .12, 1.1, .22, '#24252B', { r: .03 });
      P.box(.36, .45, .28, .01, 1.15, .14, '#3AA655', { glow: '#5CFF8A', r: 0 });
    },
    cadeira_salao(P) {
      P.base([2, 3, 4, 5, 6, 7]);
      P.cyl(.5, .6, .17, .2, 0, .06, MET, { seg: 10 });
      P.cyl(.5, .6, .04, .05, .06, .34, MET, { seg: 6 });
      P.box(.2, .38, .6, .48, .38, .14, '#24252B', { r: .06 });
      P.box(.2, .35, .6, .12, .5, .6, '#24252B', { r: .06, rx: .12 });
      P.box(.13, .45, .1, .38, .52, .1, '#24252B', { r: .04 }); P.box(.77, .45, .1, .38, .52, .1, '#24252B', { r: .04 });
      P.cyl(.5, .9, .05, .05, .15, .03, MET, { seg: 6 });
    },
    coffee(P) {
      P.base([5, 6, 7, 8, 9, 10]);
      // máquina de espresso: corpo, grupo e bico
      P.box(.28, .18, .54, .5, 1.03, .58, '#C9CDD4', { r: .05 });
      P.box(.33, .62, .44, .1, 1.45, .12, '#9AA0A8', { r: .02 });
      P.cyl(.55, .7, .05, .05, 1.28, .08, MET, { seg: 8 });
      P.box(.38, .68, .34, .02, 1.25, .2, '#24252B', { r: 0 });
      P.cyl(1.47, .48, .065, .055, 1.03, .13, '#FFFFFF', { seg: 8 }); P.cyl(1.77, .48, .065, .055, 1.03, .13, '#FFFFFF', { seg: 8 });
      pot(P, 2.52, .48, .17, .3); bush(P, 2.52, 1.35, .48, .18, 5, 2);
    },
    desk(P) { P.base([10]); P.chairs(); P.cyl(1.59, .29, .07, .06, .78, .14, '#FFFFFF', { seg: 8 }); },
    lowshelf(P) {
      P.base([3, 4, 5, 6]);
      [['#2F5FD0', .4], ['#E0473B', .34], ['#F2B630', .42], ['#3AA655', .36]].forEach(([c, h], i) => P.box(.2 + i * .13, .36, .11, .28, .9, h, c, { r: .01, rz: i === 3 ? -.25 : 0 }));
      P.lathe(1.52, .5, .9, [[0, 0], [.08, 0], [.12, .12], [.08, .26], [.06, .3], [0, .3]], '#8C4FE0', { seg: 8 });
    },
    maca(P) {
      P.base([7]);
      P.box(.14, .24, .38, .52, .74, .1, '#FFFFFF', { r: .05 });
    },
    fogao(P) {
      P.base([4, 5, 6, 7, 8, 9, 10]);
      for (const [cx, cz] of [[.5, .36], [1.5, .36], [.5, .72], [1.5, .72]]) { P.cyl(cx, cz, .17, .17, .9, .02, '#3A3C42', { seg: 8 }); P.cyl(cx, cz, .09, .09, .92, .015, '#24252B', { seg: 8 }); }
      P.cyl(1.5, .72, .08, .08, .935, .01, '#E07A3B', { seg: 8, glow: '#FF8A3D' });
      P.cyl(.5, .36, .16, .15, .92, .24, '#C9CDD4', { seg: 10 }); P.cyl(.5, .36, .17, .17, 1.16, .02, '#9AA0A8', { seg: 10 });
      P.rod([.66, 1.1, .36], [.86, 1.12, .36], .015, MET);
    },
    bancada_cozinha(P) {
      P.base([5, 6, 7, 9, 10]);
      P.box(1.9, .25, .75, .5, .89, .03, '#9AA0A8', { r: .01 });
      P.rod([2.27, .91, .15], [2.27, 1.22, .15], .022, MET); P.rod([2.27, 1.22, .15], [2.27, 1.2, .38], .018, MET);
      P.cyl(.55, .45, .06, .06, .94, .08, '#E0473B', { seg: 8 }); P.ball(.78, .99, .42, .06, '#3AA655', { detail: 0 });
    },
  };
  // a cadeira-padrão das mesas: só as caixas dela trocam
  for (const id of ['island', 'meeting', 'reception']) MODELS[id] = (P) => { P.base(); P.chairs(); };

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
