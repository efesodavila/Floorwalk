'use strict';

/* ---------- Catálogo ---------- */
const MATS = {
  lilas:          { n: 'Lilás original',   b: '#DACBC9', a: '#D3C3C1', l: '#C4B3B1', k: 'tile' },
  porcelanato:    { n: 'Porcelanato',      b: '#EFEDEB', a: '#E7E4E2', l: '#D3CFCD', k: 'tile' },
  madeira_clara:  { n: 'Madeira clara',    b: '#DBB07A', a: '#D2A56E', l: '#BC8F58', k: 'wood' },
  madeira_escura: { n: 'Madeira escura',   b: '#93633F', a: '#8A5A38', l: '#70472C', k: 'wood' },
  salvia:         { n: 'Vinílico sálvia',  b: '#B1C5A7', a: '#A9BD9F', l: '#92A889', k: 'wood' },
  cimento:        { n: 'Cimento queimado', b: '#C0BFBD', a: '#B8B7B5', l: '#A2A19F', k: 'speck' },
  grafite:        { n: 'Carpete grafite',  b: '#64666D', a: '#5D5F66', l: '#4C4E55', k: 'speck' },
  azul:           { n: 'Carpete azul',     b: '#5577BF', a: '#4E6FB5', l: '#405E9E', k: 'speck' },
  xadrez:         { n: 'Ladrilho xadrez',  b: '#F2EFEA', a: '#3A3C42', l: '#2A2C31', k: 'checker' },
};
const WALLS = [['#D5CED6', 'Lilás claro'], ['#ECE5D6', 'Areia'], ['#C2D2DE', 'Azul névoa'], ['#CAD8C1', 'Sálvia'], ['#EBCBB7', 'Pêssego'], ['#3A3C44', 'Grafite']];
const SW = ['#E0473B', '#F2B630', '#3AA655', '#2FA5A0', '#4C6FB8', '#8C4FE0', '#24252B', '#E4E1E0'];
const WOODS = ['#DBB07A', '#B07A4A', '#7A4A2A', '#3A3C42', '#F0EBE4'];
const SKIN = ['#F4D3B5', '#E3B48F', '#C68A62', '#8D5A3B', '#5E3A26'];
const HAIR = ['#2A1E18', '#6B3E22', '#C98A3E', '#E8D27A', '#B8B8C0', '#8C4FE0'];
const SHIRT = ['#8C4FE0', '#2F5FD0', '#3AA655', '#E0473B', '#F2B630', '#2FA5A0', '#24252B', '#FFFFFF'];
const PANTS = ['#24252B', '#3C4A66', '#6B5A4A', '#9AA0A8'];
const NAMES = ['Joana', 'Caio', 'Lia', 'Theo', 'Nina', 'Igor', 'Duda', 'Leo', 'Malu', 'Enzo'];
const SHOES = ['#2C2E34', '#FFFFFF', '#8E5B3A', '#E0473B', '#2F5FD0'];
const HAIRSTYLES = [['curto', 'Curto'], ['franja', 'Franja'], ['longo', 'Longo'], ['coque', 'Coque'], ['rabo', 'Rabo de cavalo'], ['cacheado', 'Cacheado'], ['raspado', 'Raspado']];
const TOPS = [['camiseta', 'Camiseta'], ['camisa', 'Camisa'], ['jaqueta', 'Jaqueta'], ['moletom', 'Moletom']];
const EXTRAS = [['cracha', 'Crachá'], ['oculos', 'Óculos'], ['fone', 'Fone'], ['barba', 'Barba']];
function randomLook() {
  const r = a => a[Math.floor(Math.random() * a.length)];
  return { skin: r(SKIN), hair: r(HAIR.slice(0, 5)), hairStyle: r(HAIRSTYLES)[0], top: r(TOPS)[0], shirt: r(SHIRT), pants: r(PANTS), shoes: r(SHOES), extras: { cracha: Math.random() < .6, oculos: Math.random() < .3, fone: Math.random() < .2, barba: Math.random() < .2 } };
}

const MET = '#2C2E34', CHR = '#3B3E46', FRAME = '#4A4F5A';
const B = (x, z, w, d, y, h, c, extra) => ({ x, z, w, d, y, h, c, ...(extra || {}) });
// cadeira com encosto: "back" diz para que lado fica o encosto (n, s, w, e)
const chair = (x, z, back = 's') => {
  const seat = B(x - .25, z - .22, .5, .44, .38, .08, CHR, { u: 1 }), leg = B(x - .05, z - .05, .1, .1, 0, .38, MET, { u: 1 });
  const bk = { n: B(x - .25, z - .26, .5, .07, .46, .42, CHR, { u: 1 }), s: B(x - .25, z + .19, .5, .07, .46, .42, CHR), w: B(x - .29, z - .22, .07, .44, .46, .42, CHR, { u: 1 }), e: B(x + .22, z - .22, .07, .44, .46, .42, CHR) }[back];
  return [leg, seat, bk];
};
const ITEMS = {
  desk: { n: 'Mesa de trabalho', cat: 'trabalho', w: 2, d: 2, desk: true, seats: [[1, 1.5]], boxes: [
    ...chair(1, 1.5, 's'), B(.1, .1, .08, .8, 0, .7, MET), B(1.82, .1, .08, .8, 0, .7, MET), B(0, 0, 2, 1, .7, .08, '#EFE9E0'),
    B(.92, .18, .16, .1, .78, .14, MET), B(.65, .14, .7, .08, .9, .42, '#24252B'), B(.69, .22, .62, .02, .94, .34, '#7D45D6', { g: '#9D6BFF' }),
    B(.6, .5, .5, .18, .78, .02, '#3B3E46'), B(1.5, .2, .18, .18, .78, .16, '#FFFFFF')] },
  island: { n: 'Ilha com 4 estações', cat: 'trabalho', w: 4, d: 3, desk: true, seats: [[1, .35], [3, .35], [1, 2.65], [3, 2.65]], boxes: [
    ...chair(1, .35, 'n'), ...chair(3, .35, 'n'),
    B(.2, .9, .1, 1.2, 0, .7, MET), B(3.7, .9, .1, 1.2, 0, .7, MET), B(0, .8, 4, 1.4, .7, .08, '#F2EDE6'), B(.1, 1.46, 3.8, .08, .78, .45, '#D9D2DA'),
    // um computador por estação: pé, monitor e tela acesa virada para quem senta
    ...[1, 3].flatMap(cx => [
      B(cx - .08, 1.24, .16, .08, .78, .12, MET), B(cx - .3, 1.2, .6, .06, .9, .4, '#24252B'), B(cx - .26, 1.18, .52, .02, .94, .32, '#7D45D6', { g: '#9D6BFF' }),
      B(cx - .08, 1.66, .16, .08, .78, .12, MET), B(cx - .3, 1.68, .6, .06, .9, .4, '#24252B'), B(cx - .26, 1.74, .52, .02, .94, .32, '#7D45D6', { g: '#9D6BFF' }),
      B(cx - .25, .95, .5, .16, .78, .02, '#3B3E46'), B(cx - .25, 1.89, .5, .16, .78, .02, '#3B3E46'),
    ]),
    ...chair(1, 2.65, 's'), ...chair(3, 2.65, 's')] },
  meeting: { n: 'Mesa de reunião (7 lugares)', cat: 'trabalho', w: 5, d: 3, seats: [], boxes: [
    ...chair(1.2, .35, 'n'), ...chair(2.5, .35, 'n'), ...chair(3.8, .35, 'n'), ...chair(.35, 1.5, 'w'),
    B(1.4, 1.25, .2, .5, 0, .7, MET), B(3.4, 1.25, .2, .5, 0, .7, MET), B(.8, .8, 3.9, 1.4, .7, .08, '#C98F57'), B(2.2, 1.3, .6, .4, .78, .03, '#24252B'),
    ...chair(1.2, 2.65, 's'), ...chair(2.5, 2.65, 's'), ...chair(3.8, 2.65, 's')] },
  reception: { n: 'Balcão de recepção', cat: 'trabalho', w: 3, d: 2, desk: true, seats: [[1.5, .4]], boxes: [
    ...chair(1.5, .4, 'n'), B(0, .9, 3, .6, 0, 1.05, '#FFFFFF'), B(.2, 1.5, 2.6, .02, .2, .65, '#8C4FE0'), B(0, .85, 3, .7, 1.05, .06, '#C98F57'), B(1.2, .75, .6, .08, 1.11, .38, '#24252B')] },
  coffee: { n: 'Balcão de café', cat: 'copa', w: 3, d: 1, boxes: [
    B(0, 0, 3, 1, 0, .95, '#2E3036'), B(.1, .98, .85, .02, .15, .7, '#3A3C44'), B(1.05, .98, .85, .02, .15, .7, '#3A3C44'), B(2.0, .98, .85, .02, .15, .7, '#3A3C44'),
    B(0, 0, 3, 1, .95, .08, '#B07A4A'), B(.3, .2, .5, .5, 1.03, .62, '#C9CDD4'), B(.38, .68, .34, .02, 1.25, .25, '#24252B'),
    B(1.4, .4, .15, .15, 1.03, .18, '#FFFFFF'), B(1.7, .4, .15, .15, 1.03, .18, '#FFFFFF'), B(2.3, .25, .45, .45, 1.03, .3, '#E4E1E0'), B(2.35, .3, .35, .35, 1.33, .25, '#3AA655')] },
  fridge: { n: 'Geladeira de bebidas', cat: 'copa', w: 1, d: 1, boxes: [B(.05, .05, .9, .88, 0, 1.9, '#C9CDD4'), B(.12, .93, .76, .03, .15, 1.6, '#7FC4E8', { g: '#BFE6FF' })] },
  stool: { n: 'Banqueta alta', cat: 'copa', w: 1, d: 1, color: '#E0473B', boxes: [B(.3, .3, .4, .4, 0, .04, MET), B(.45, .45, .1, .1, .04, .71, MET), B(.25, .25, .5, .5, .75, .1, 'C')] },
  sofa: { n: 'Sofá', cat: 'lounge', w: 3, d: 1, color: '#4C6FB8', boxes: [B(0, 0, 3, 1, 0, .42, 'C'), B(0, 0, 3, .3, .42, .55, 'C'), B(0, .3, .3, .7, .42, .25, 'C'), B(2.7, .3, .3, .7, .42, .25, 'C'), B(.35, .32, 1.1, .6, .42, .06, 'C'), B(1.55, .32, 1.1, .6, .42, .06, 'C')] },
  armchair: { n: 'Poltrona', cat: 'lounge', w: 1, d: 1, color: '#E0473B', boxes: [B(0, 0, 1, 1, 0, .42, 'C'), B(0, 0, 1, .3, .42, .5, 'C'), B(0, .3, .18, .7, .42, .22, 'C'), B(.82, .3, .18, .7, .42, .22, 'C')] },
  pouf: { n: 'Pufe', cat: 'lounge', w: 1, d: 1, color: '#F2B630', boxes: [B(.2, .2, .6, .6, 0, .4, 'C')] },
  ctable: { n: 'Mesa de centro', cat: 'lounge', w: 2, d: 1, boxes: [B(.85, .4, .3, .2, 0, .35, MET), B(.1, .15, 1.8, .7, .35, .07, '#C98F57'), B(.4, .35, .3, .25, .42, .12, '#E4E1E0'), B(1.3, .4, .15, .15, .42, .1, '#FFFFFF')] },
  rug: { n: 'Tapete colorido', cat: 'lounge', w: 3, d: 2, flat: true, color: '#8C4FE0', boxes: [B(0, 0, 3, 2, 0, .03, 'C')] },
  palm: { n: 'Palmeira', cat: 'plantas', w: 1, d: 1, boxes: [B(.25, .25, .5, .5, 0, .45, '#E4E1E0'), B(.45, .45, .1, .1, .45, .85, '#8E5B3A'), B(.05, .05, .9, .9, 1.3, .25, '#2F9A4C'), B(.2, .2, .6, .6, 1.55, .25, '#3FB25D'), B(.33, .33, .34, .34, 1.8, .2, '#5ACB75')] },
  planter: { n: 'Floreira', cat: 'plantas', w: 2, d: 1, boxes: [B(0, .15, 2, .7, 0, .5, '#E4E1E0'), B(.1, .2, 1.8, .6, .5, .25, '#2F9A4C'), B(.3, .3, .4, .4, .75, .25, '#3FB25D'), B(1.2, .3, .4, .4, .75, .32, '#5ACB75')] },
  plantshelf: { n: 'Estante com plantas', cat: 'plantas', w: 2, d: 1, boxes: [B(0, .2, .08, .6, 0, 1.4, '#B07A4A'), B(1.92, .2, .08, .6, 0, 1.4, '#B07A4A'), B(.08, .2, 1.84, .6, .45, .06, '#B07A4A'), B(.08, .2, 1.84, .6, .95, .06, '#B07A4A'), B(0, .2, 2, .6, 1.4, .06, '#B07A4A'),
    B(.3, .35, .3, .3, .51, .3, '#3FB25D'), B(1.2, .35, .35, .3, 1.01, .32, '#2F9A4C'), B(.2, .3, .5, .4, 1.46, .35, '#3FB25D'), B(1.3, .3, .5, .4, 1.46, .45, '#5ACB75')] },
  softbox: { n: 'Refletor (softbox)', cat: 'estúdio', w: 1, d: 1, boxes: [B(.3, .3, .4, .4, 0, .04, MET), B(.46, .46, .08, .08, .04, 1.3, MET), B(.15, .3, .7, .35, 1.3, .7, '#FFF6D6', { g: '#FFF1BF' })] },
  tripod: { n: 'Câmera no tripé', cat: 'estúdio', w: 1, d: 1, boxes: [B(.25, .25, .5, .5, 0, .03, MET), B(.46, .46, .08, .08, .03, 1.07, MET), B(.3, .35, .4, .3, 1.1, .3, '#24252B'), B(.4, .65, .2, .1, 1.15, .2, '#5C5866'), B(.36, .3, .1, .08, 1.38, .05, '#E0473B', { g: '#FF6B5E' })] },
  chroma: { n: 'Fundo chroma key', cat: 'estúdio', w: 3, d: 1, boxes: [B(0, 0, 3, .12, 0, 2.4, '#36C254'), B(0, .12, 3, .88, 0, .03, '#36C254'), B(-.05, 0, 3.1, .2, 2.4, .1, MET)] },
  colorlight: { n: 'Luz colorida', cat: 'iluminação', w: 1, d: 1, color: '#A855F7', boxes: [B(.3, .3, .4, .4, 0, .04, MET), B(.46, .46, .08, .08, .04, 1.46, MET), B(.3, .3, .4, .4, 1.5, .4, 'C', { g: 'C' })] },
  floorlamp: { n: 'Luminária de chão', cat: 'iluminação', w: 1, d: 1, boxes: [B(.32, .32, .36, .36, 0, .05, MET), B(.47, .47, .06, .06, .05, 1.53, MET), B(.25, .25, .5, .5, 1.58, .32, '#FFE7A8', { g: '#FFE08A' })] },
  lowshelf: { n: 'Estante baixa', cat: 'decoração', w: 2, d: 1, boxes: [B(0, .2, 2, .6, 0, .9, '#F0EBE4'), B(.08, .78, .88, .02, .1, .7, '#E2DBD2'), B(1.04, .78, .88, .02, .1, .7, '#E2DBD2'), B(.2, .35, .14, .3, .9, .4, '#2F5FD0'), B(.38, .35, .14, .3, .9, .34, '#E0473B'), B(.56, .35, .14, .3, .9, .42, '#F2B630'), B(1.4, .4, .25, .25, .9, .3, '#8C4FE0')] },
  vase: { n: 'Vaso alto', cat: 'decoração', w: 1, d: 1, color: '#2FA5A0', boxes: [B(.3, .3, .4, .4, 0, .9, 'C'), B(.36, .36, .28, .28, .9, .45, '#3FB25D')] },
  tv: { n: 'TV com gráfico', cat: 'tecnologia', w: 2, d: 1, boxes: [B(.7, .25, .6, .3, 0, .04, MET), B(.94, .34, .12, .12, .04, .8, MET), B(0, .3, 2, .1, .8, 1.1, '#1E1F24'),
    B(.08, .4, 1.84, .02, .86, .98, '#2A2D3A', { g: '#5A6CFF' }), B(.25, .42, .3, .02, .95, .35, '#2F5FD0'), B(.65, .42, .3, .02, .95, .55, '#3AA655'), B(1.05, .42, .3, .02, .95, .75, '#F2B630'), B(1.45, .42, .3, .02, .95, .9, '#E0473B')] },
  kanban: { n: 'Quadro kanban', cat: 'trabalho', w: 2, d: 1, boxes: [B(.15, .4, .08, .2, 0, .95, MET), B(1.77, .4, .08, .2, 0, .95, MET), B(0, .42, 2, .08, .9, 1.25, '#FFFFFF'),
    B(.05, .5, .6, .01, 2.0, .1, '#D9D6DE'), B(.7, .5, .6, .01, 2.0, .1, '#D9D6DE'), B(1.35, .5, .6, .01, 2.0, .1, '#D9D6DE'),
    B(.12, .5, .22, .01, 1.62, .2, '#F2B630'), B(.4, .5, .22, .01, 1.62, .2, '#F2B630'), B(.12, .5, .22, .01, 1.3, .2, '#E0473B'),
    B(.78, .5, .22, .01, 1.62, .2, '#7FC4E8'), B(.78, .5, .22, .01, 1.3, .2, '#7FC4E8'), B(1.05, .5, .22, .01, 1.62, .2, '#8C4FE0'),
    B(1.43, .5, .22, .01, 1.62, .2, '#3AA655'), B(1.7, .5, .22, .01, 1.62, .2, '#3AA655'), B(1.43, .5, .22, .01, 1.3, .2, '#3AA655')] },
  rack: { n: 'Rack de servidores', cat: 'tecnologia', w: 1, d: 1, boxes: [B(.1, .1, .8, .75, 0, 2.1, '#2E3036'),
    B(.16, .85, .68, .02, .15, .35, '#3A3C44'), B(.16, .85, .68, .02, .6, .35, '#3A3C44'), B(.16, .85, .68, .02, 1.05, .35, '#3A3C44'), B(.16, .85, .68, .02, 1.5, .35, '#3A3C44'),
    B(.22, .87, .06, .01, .35, .05, '#3AA655', { g: '#5CFF8A' }), B(.22, .87, .06, .01, .8, .05, '#3AA655', { g: '#5CFF8A' }), B(.22, .87, .06, .01, 1.25, .05, '#F2B630', { g: '#FFD36B' }), B(.22, .87, .06, .01, 1.7, .05, '#3AA655', { g: '#5CFF8A' })] },
  printer: { n: 'Impressora', cat: 'tecnologia', w: 1, d: 1, boxes: [B(.1, .2, .8, .6, 0, .6, '#E4E1E0'), B(.1, .2, .8, .6, .6, .12, '#5C5866'), B(.25, .78, .5, .04, .45, .03, '#FFFFFF')] },
  /* ---------- móveis para outros tipos de negócio (todos com o lado de uso na frente) ---------- */
  maca: { n: 'Maca de atendimento', cat: 'atendimento', w: 2, d: 1, boxes: [
    B(.15, .2, .08, .08, 0, .5, MET), B(1.77, .2, .08, .08, 0, .5, MET), B(.15, .72, .08, .08, 0, .5, MET), B(1.77, .72, .08, .08, 0, .5, MET),
    B(.1, .15, 1.8, .7, .5, .12, '#E4E1E0'), B(.12, .17, 1.76, .66, .62, .12, '#7FC4E8'), B(.5, .2, 1.3, .6, .74, .01, '#FFFFFF'), B(.16, .24, .34, .52, .74, .09, '#FFFFFF')] },
  balanca: { n: 'Balança', cat: 'atendimento', w: 1, d: 1, boxes: [
    B(.25, .35, .5, .5, 0, .07, '#E4E1E0'), B(.46, .38, .08, .08, .07, 1.05, MET), B(.33, .33, .34, .1, 1.12, .2, '#24252B'), B(.36, .43, .28, .01, 1.15, .14, '#3AA655', { g: '#5CFF8A' })] },
  cadeira_salao: { n: 'Cadeira de salão com espelho', cat: 'atendimento', w: 1, d: 1, boxes: [
    B(.1, .02, .8, .05, .8, 1, '#C2D2DE'), B(.08, .02, .84, .04, .78, .04, FRAME), B(.35, .45, .3, .3, 0, .07, MET), B(.46, .56, .08, .08, .07, .33, MET),
    B(.2, .4, .6, .45, .4, .12, '#24252B'), B(.2, .36, .6, .1, .52, .55, '#24252B'), B(.14, .45, .08, .35, .52, .12, '#24252B'), B(.78, .45, .08, .35, .52, .12, '#24252B')] },
  bancada_cozinha: { n: 'Bancada de cozinha', cat: 'cozinha', w: 3, d: 1, boxes: [
    B(.05, .1, 2.9, .85, 0, .85, '#E4E1E0'), B(.1, .95, .9, .01, .3, .45, '#C9CDD4'), B(1.05, .95, .9, .01, .3, .45, '#C9CDD4'), B(2, .95, .9, .01, .3, .45, '#C9CDD4'),
    B(0, .05, 3, .95, .85, .06, '#3A3C42'), B(1.9, .25, .75, .5, .91, .02, '#9AA0A8'), B(2.24, .12, .06, .06, .91, .32, MET), B(2.24, .12, .06, .22, 1.2, .05, MET),
    B(.35, .3, .65, .42, .91, .03, '#DBB07A'), B(.5, .4, .12, .1, .94, .08, '#E0473B'), B(.7, .38, .1, .1, .94, .06, '#3AA655')] },
  fogao: { n: 'Fogão industrial', cat: 'cozinha', w: 2, d: 1, boxes: [
    B(.05, .1, 1.9, .85, 0, .85, '#9AA0A8'), B(.25, .95, 1.5, .02, .2, .45, '#3A3C42'), B(.4, .95, 1.2, .03, .62, .04, MET), B(0, .05, 2, .95, .85, .05, '#24252B'),
    B(.25, .22, .5, .28, .9, .02, '#3A3C42'), B(1.25, .22, .5, .28, .9, .02, '#3A3C42'), B(.25, .58, .5, .28, .9, .02, '#3A3C42'), B(1.25, .58, .5, .28, .9, .02, '#3A3C42'),
    B(1.32, .62, .36, .2, .92, .01, '#E07A3B', { g: '#FF8A3D' }), B(.3, .22, .4, .3, .92, .3, '#C9CDD4'), B(.26, .3, .48, .14, 1.22, .03, '#C9CDD4')] },
  arara: { n: 'Arara de roupas', cat: 'comércio', w: 2, d: 1, boxes: [
    B(.08, .3, .3, .4, 0, .05, MET), B(1.62, .3, .3, .4, 0, .05, MET), B(.2, .47, .06, .06, .05, 1.5, MET), B(1.74, .47, .06, .06, .05, 1.5, MET), B(.2, .48, 1.6, .04, 1.5, .04, MET),
    B(.32, .32, .24, .36, .75, .72, '#E0473B'), B(.6, .32, .24, .36, .75, .72, '#F2B630'), B(.88, .32, .24, .36, .8, .67, '#2F5FD0'), B(1.16, .32, .24, .36, .75, .72, '#3AA655'), B(1.44, .32, .24, .36, .78, .69, '#8C4FE0')] },
  estoque: { n: 'Prateleira de estoque', cat: 'comércio', w: 2, d: 1, boxes: [
    B(.02, .1, .06, .8, 0, 1.9, MET), B(1.92, .1, .06, .8, 0, 1.9, MET),
    B(0, .1, 2, .8, .08, .04, '#9AA0A8'), B(0, .1, 2, .8, .68, .04, '#9AA0A8'), B(0, .1, 2, .8, 1.28, .04, '#9AA0A8'), B(0, .1, 2, .8, 1.86, .04, '#9AA0A8'),
    B(.15, .2, .5, .55, .12, .4, '#C98F57'), B(.75, .25, .45, .5, .12, .3, '#B07A4A'), B(1.3, .2, .5, .55, .12, .45, '#C98F57'),
    B(.2, .2, .7, .55, .72, .35, '#C98F57'), B(1.05, .25, .4, .5, .72, .45, '#DBB07A'), B(.3, .2, .5, .55, 1.32, .4, '#B07A4A'), B(1.1, .2, .6, .55, 1.32, .3, '#C98F57')] },
  vitrine: { n: 'Vitrine', cat: 'comércio', w: 2, d: 1, boxes: [
    B(0, .1, 2, .85, 0, .7, '#FFFFFF'), B(0, .1, 2, .85, .7, .03, '#C9CDD4'), B(.25, .3, .35, .3, .73, .18, '#E0473B'), B(.85, .35, .3, .25, .73, .28, '#F2B630'), B(1.4, .3, .35, .3, .73, .14, '#8C4FE0'),
    B(.02, .12, 1.96, .81, .73, .45, '#BFE6FF', { glass: 1 }), B(0, .1, 2, .85, 1.18, .03, '#C9CDD4')] },
  caixa: { n: 'Caixa (balcão de vendas)', cat: 'comércio', w: 2, d: 1, boxes: [
    B(0, .1, 2, .85, 0, 1, '#C98F57'), B(.1, .95, 1.8, .01, .15, .7, '#B07A4A'), B(0, .05, 2, .95, 1, .05, '#24252B'),
    B(1.15, .3, .55, .45, 1.05, .22, '#3A3C42'), B(1.2, .26, .45, .04, 1.27, .26, '#24252B'), B(1.23, .3, .39, .01, 1.3, .2, '#7D45D6', { g: '#9D6BFF' }), B(.35, .45, .16, .26, 1.05, .1, '#24252B'), B(.38, .48, .1, .1, 1.15, .01, '#3AA655', { g: '#5CFF8A' })] },
  bancada_oficina: { n: 'Bancada de ferramentas', cat: 'oficina', w: 2, d: 1, boxes: [
    B(.08, .2, .1, .1, 0, .85, MET), B(1.82, .2, .1, .1, 0, .85, MET), B(.08, .75, .1, .1, 0, .85, MET), B(1.82, .75, .1, .1, 0, .85, MET), B(.1, .25, 1.8, .55, .25, .04, '#9AA0A8'),
    B(0, .1, 2, .9, .85, .08, '#B07A4A'), B(0, .02, 2, .06, .93, 1, '#DBB07A'), B(.2, .07, .08, .02, 1.3, .4, MET), B(.4, .07, .3, .02, 1.5, .06, '#E0473B'), B(.85, .07, .06, .02, 1.25, .5, MET), B(1.1, .07, .25, .02, 1.6, .2, '#F2B630'),
    B(1.55, .4, .3, .3, .93, .14, '#E0473B'), B(.5, .5, .4, .22, .93, .12, '#3A3C42')] },
  cavalete: { n: 'Cavalete de pintura', cat: 'oficina', w: 1, d: 1, boxes: [
    B(.2, .5, .06, .06, 0, 1.55, '#B07A4A'), B(.74, .5, .06, .06, 0, 1.55, '#B07A4A'), B(.47, .2, .06, .06, 0, 1.6, '#B07A4A'), B(.15, .52, .7, .05, .55, .05, '#B07A4A'),
    B(.15, .45, .7, .06, .6, .8, '#FFFFFF'), B(.25, .51, .25, .01, .95, .3, '#2F5FD0'), B(.5, .51, .2, .01, .75, .25, '#F2B630'), B(.3, .51, .3, .01, .7, .15, '#E0473B')] },
  mesa_embalagem: { n: 'Mesa de embalagem', cat: 'comércio', w: 2, d: 1, boxes: [
    B(.08, .2, .08, .08, 0, .8, MET), B(1.84, .2, .08, .08, 0, .8, MET), B(.08, .72, .08, .08, 0, .8, MET), B(1.84, .72, .08, .08, 0, .8, MET),
    B(0, .1, 2, .85, .8, .06, '#EFE9E0'), B(.2, .25, .55, .45, .86, .35, '#C98F57'), B(.2, .45, .55, .04, 1.21, .01, '#F2B630'), B(.95, .3, .45, .4, .86, .25, '#C98F57'), B(1.55, .35, .22, .22, .86, .1, '#9AA0A8')] },
  capacho: { n: 'Capacho de entrada', cat: 'decoração', w: 2, d: 1, flat: true, boxes: [B(.1, .1, 1.8, .8, 0, .02, '#5C5866'), B(.2, .2, 1.6, .6, .02, .005, '#8C4FE0')] },
};

/* Paredes e divisórias: desenhadas arrastando ao longo da grade */
const WALLKINDS = {
  alvenaria:   { n: 'Parede', d: 'Inteira, até o teto', min: 1, colors: 'walls' },
  porta:       { n: 'Parede com porta', d: 'Porta no meio do trecho', min: 2, colors: 'walls' },
  janela:      { n: 'Parede com janela', d: 'Faixa de vidro no meio', min: 1, colors: 'walls' },
  meia:        { n: 'Meia-parede', d: 'Baixa, deixa ver o outro lado', min: 1, colors: 'walls' },
  vidro:       { n: 'Divisória de vidro', d: 'Do chão ao teto', min: 1 },
  vidro_porta: { n: 'Vidro com porta', d: 'Vidro com porta no meio', min: 2 },
  ripado:      { n: 'Divisória ripada', d: 'Ripas de madeira vazadas', min: 1, colors: 'woods', def: '#B07A4A' },
  biombo:      { n: 'Painel acústico', d: 'Painel baixo de feltro', min: 1, colors: 'sw', def: '#4C6FB8' },
};
/* ---------- Modelo genérico: estados universais e tipos de papel ----------
   Estados são fixos porque cada um aponta para um lugar da sala. O nome que aparece na tela
   pode mudar por ambiente (W.labels): no escritório de software, "trabalhando" vira "Codando".
   "solo" e "group" são afinidades em ordem de preferência. */
const RULES = {
  planejando:  { base: 'Planejando', icon: 'kanban', c: '#8C4FE0', solo: ['plan', 'work'], group: ['meeting', 'plan'], does: 'Vai ao quadro kanban. Com outras pessoas, todos vão à mesma mesa de reunião.' },
  trabalhando: { base: 'Trabalhando', icon: 'typing', c: '#2F5FD0', solo: ['work'], home: true, does: 'Senta numa mesa de trabalho, de preferência a que já usou antes.' },
  revisando:   { base: 'Revisando', icon: 'magnifier', c: '#2FA5A0', solo: ['work'], visit: true, does: 'Vai até a pessoa cujo trabalho está revisando. Sem ninguém indicado, usa uma mesa.' },
  pesquisando: { base: 'Pesquisando', icon: 'book', c: '#3AA655', solo: ['read', 'relax', 'work'], does: 'Vai à estante ou à poltrona de leitura.' },
  reuniao:     { base: 'Em reunião', icon: 'chat', c: '#6B33BF', solo: ['plan', 'work'], group: ['meeting', 'plan'], does: 'Todos da reunião vão para a mesma mesa de reunião.' },
  entregando:  { base: 'Entregando', icon: 'rocket', c: '#E07A3B', solo: ['infra', 'print', 'work'], does: 'Vai ao ponto de entrega: rack de servidores, impressora ou, sem eles, a mesa.' },
  aguardando:  { base: 'Aguardando', icon: 'hourglass', c: '#7A7484', solo: ['coffee', 'fridge', 'relax'], does: 'Espera na copa ou no sofá.' },
  bloqueado:   { base: 'Bloqueado', icon: 'alert', c: '#E0473B', solo: ['work'], seekKind: 'coordena', transient: 7, does: 'Vai pedir ajuda a quem coordena e volta para a mesa com o alerta.' },
  concluido:   { base: 'Concluiu', icon: 'check', c: '#2F7A3E', stay: true, transient: 4, does: 'Comemora onde está e depois fica livre.' },
  ocioso:      { base: 'Livre', icon: null, c: '#9A93A3', idle: true, does: 'Circula pela sala: café, sofá, plantas, leitura.' },
  offline:     { base: 'Fora do ar', icon: 'zzz', c: '#5C5866', solo: ['relax', 'read'], dim: true, does: 'Vai descansar no sofá, apagado.' },
};
for (const k in RULES) RULES[k].n = RULES[k].base;
// nomes antigos e em inglês continuam aceitos
const ALIASES = {
  codando: 'trabalhando', testando: 'trabalhando', deploy: 'entregando',
  planning: 'planejando', plan: 'planejando', thinking: 'planejando',
  working: 'trabalhando', work: 'trabalhando', coding: 'trabalhando', code: 'trabalhando', writing: 'trabalhando', editing: 'trabalhando', tool_use: 'trabalhando', testing: 'trabalhando', test: 'trabalhando', producing: 'trabalhando', escrevendo: 'trabalhando', produzindo: 'trabalhando',
  reviewing: 'revisando', review: 'revisando', checking: 'revisando',
  researching: 'pesquisando', research: 'pesquisando', searching: 'pesquisando', reading: 'pesquisando',
  delivering: 'entregando', deploying: 'entregando', release: 'entregando', publishing: 'entregando', shipping: 'entregando', publicando: 'entregando',
  meeting: 'reuniao', 'reunião': 'reuniao', sync: 'reuniao', discussing: 'reuniao',
  waiting: 'aguardando', wait: 'aguardando', blocked: 'bloqueado', error: 'bloqueado', failed: 'bloqueado',
  done: 'concluido', 'concluído': 'concluido', completed: 'concluido', finished: 'concluido', success: 'concluido',
  idle: 'ocioso', free: 'ocioso', livre: 'ocioso', stopped: 'offline',
};
const normState = (st) => { st = String(st ?? '').toLowerCase().trim(); return RULES[st] ? st : (ALIASES[st] || null); };
const AFFN = { care: 'Maca, cadeira ou balança', cook: 'Cozinha', stock: 'Estoque', sell: 'Balcão de vendas', craft: 'Bancada de oficina', attend: 'Recepção', work: 'Mesa de trabalho', meeting: 'Mesa de reunião', plan: 'Quadro kanban', read: 'Estante ou poltrona', relax: 'Sofá ou pufe', coffee: 'Balcão de café', fridge: 'Geladeira', infra: 'Rack de servidores', plants: 'Plantas', print: 'Impressora', tv: 'TV', record: 'Estúdio' };
/* Lugares com finalidade: a IA escolhe um por passo da tarefa; "acts" diz quais elementos servem,
   em ordem de preferência. Mesma lista em server/places.mjs (o teste "protocol" confere). */
const PLACES = {
  computador: { acts: ['work'], why: 'precisa de computador' },
  quadro:     { acts: ['plan', 'work'], why: 'organizar no quadro' },
  reuniao:    { acts: ['meeting', 'work'], why: 'conversar em grupo' },
  leitura:    { acts: ['read', 'relax', 'work'], why: 'estudar e consultar referências' },
  painel:     { acts: ['tv', 'meeting', 'work'], why: 'analisar números' },
  estudio:    { acts: ['record', 'work'], why: 'gravar' },
  recepcao:   { acts: ['attend', 'work'], why: 'atender o cliente' },
  impressora: { acts: ['print', 'work'], why: 'imprimir' },
  servidores: { acts: ['infra', 'work'], why: 'publicar no sistema' },
  atendimento: { acts: ['care', 'attend', 'work'], why: 'atender a pessoa' },
  cozinha:    { acts: ['cook', 'work'], why: 'cozinhar' },
  estoque:    { acts: ['stock', 'work'], why: 'separar e embalar produtos' },
  loja:       { acts: ['sell', 'attend', 'work'], why: 'vender no balcão' },
  oficina:    { acts: ['craft', 'work'], why: 'trabalho manual' },
};

/* Tipos de papel: o motor decide por eles. Nome e cor do papel são livres em cada ambiente. */
const KINDS = {
  coordena: { n: 'Coordena', does: 'Organiza o trabalho e ajuda quem está bloqueado.' },
  produz:   { n: 'Produz', does: 'Faz o trabalho principal.' },
  revisa:   { n: 'Revisa', does: 'Confere o que os outros produziram.' },
  pesquisa: { n: 'Pesquisa', does: 'Busca informação e referências.' },
  entrega:  { n: 'Entrega', does: 'Publica, envia ou entrega o resultado.' },
};
const ROLE_COLORS = ['#8C4FE0', '#2F5FD0', '#2FA5A0', '#3AA655', '#E07A3B', '#E0473B', '#C9921A', '#4C6FB8'];
// papéis de um ambiente novo, sem área definida
const ROLES_GENERIC = {
  coordenacao: { n: 'Coordenação', c: '#8C4FE0', kind: 'coordena' },
  producao:    { n: 'Produção', c: '#2F5FD0', kind: 'produz' },
  revisao:     { n: 'Revisão', c: '#2FA5A0', kind: 'revisa' },
  pesquisa:    { n: 'Pesquisa', c: '#3AA655', kind: 'pesquisa' },
  entrega:     { n: 'Entrega', c: '#E07A3B', kind: 'entrega' },
};
// papéis do modelo "software house" (e de ambientes salvos antes do modelo genérico)
const ROLES_SOFTWARE = {
  orquestrador: { n: 'Orquestrador', c: '#8C4FE0', kind: 'coordena' },
  dev:          { n: 'Desenvolvimento', c: '#2F5FD0', kind: 'produz' },
  revisor:      { n: 'Revisão', c: '#2FA5A0', kind: 'revisa' },
  qa:           { n: 'Testes', c: '#C9921A', kind: 'revisa' },
  pesquisa:     { n: 'Pesquisa', c: '#3AA655', kind: 'pesquisa' },
  devops:       { n: 'Infra e deploy', c: '#E07A3B', kind: 'entrega' },
  design:       { n: 'Design', c: '#E0473B', kind: 'produz' },
};
const LABELS_SOFTWARE = { trabalhando: 'Codando', entregando: 'Fazendo deploy' };
// papéis do ambiente atual (preenchido por syncCatalog a partir de W.roles)
const ROLES = {};
const NO_ROLE = { n: 'Sem papel', c: '#5C5866', kind: 'produz' };
const roleInfo = (id) => ROLES[id] || NO_ROLE;
const kindOf = (id) => roleInfo(id).kind;
const defaultRole = () => Object.keys(ROLES).find(k => ROLES[k].kind === 'produz') || Object.keys(ROLES)[0] || 'producao';
// cria um papel novo no ambiente (usado quando a IA ou o servidor trazem um papel que não existe)
function ensureRole(id, name, kind) {
  id = String(id || '').trim().toLowerCase().replace(/[^\p{L}\p{N}_-]+/gu, '_').slice(0, 32);
  if (!id) return defaultRole();
  if (!W.roles[id]) {
    const used = new Set(Object.values(W.roles).map(r => r.c));
    W.roles[id] = { n: String(name || id).slice(0, 28), c: ROLE_COLORS.find(c => !used.has(c)) || ROLE_COLORS[Object.keys(W.roles).length % ROLE_COLORS.length], kind: KINDS[kind] ? kind : 'produz' };
    syncCatalog(); try { save(); } catch {}
  }
  return id;
}
// aplica papéis e nomes de estados do ambiente atual
function syncCatalog() {
  for (const k of Object.keys(ROLES)) delete ROLES[k];
  Object.assign(ROLES, W.roles);
  for (const k in RULES) RULES[k].n = W.labels?.[k] || RULES[k].base;
}
const CATS = ['paredes', 'trabalho', 'copa', 'lounge', 'plantas', 'estúdio', 'atendimento', 'cozinha', 'comércio', 'oficina', 'iluminação', 'decoração', 'tecnologia'];
const CATLABEL = { paredes: 'Paredes e divisórias', trabalho: 'Trabalho', copa: 'Copa', lounge: 'Lounge', plantas: 'Plantas', 'estúdio': 'Estúdio', atendimento: 'Atendimento', cozinha: 'Cozinha', 'comércio': 'Comércio', oficina: 'Oficina', 'iluminação': 'Iluminação', 'decoração': 'Decoração', tecnologia: 'Tecnologia' };
const CHIPLABEL = { ...CATLABEL, paredes: 'Paredes', todos: 'Todos' };

/* Pontos de uso de cada móvel no modo Ao vivo: [x, z, atividade, altura do assento (0 = em pé), direção x, direção z] */
const SPOTS = {
  desk: [[1, 1.5, 'work', .46, 0, -1]],
  island: [[1, .35, 'work', .46, 0, 1], [3, .35, 'work', .46, 0, 1], [1, 2.65, 'work', .46, 0, -1], [3, 2.65, 'work', .46, 0, -1]],
  meeting: [[1.2, .35, 'meeting', .46, 0, 1], [2.5, .35, 'meeting', .46, 0, 1], [3.8, .35, 'meeting', .46, 0, 1], [.35, 1.5, 'meeting', .46, 1, 0], [1.2, 2.65, 'meeting', .46, 0, -1], [2.5, 2.65, 'meeting', .46, 0, -1], [3.8, 2.65, 'meeting', .46, 0, -1]],
  reception: [[1.5, .4, 'attend', .46, 0, 1]],
  coffee: [[.6, 1.45, 'coffee', 0, 0, -1], [1.7, 1.45, 'coffee', 0, 0, -1]],
  fridge: [[.5, 1.45, 'fridge', 0, 0, -1]],
  stool: [[.5, .5, 'coffee', .85, 0, 1]],
  sofa: [[.7, .62, 'relax', .48, 0, 1], [1.5, .62, 'relax', .48, 0, 1], [2.3, .62, 'relax', .48, 0, 1]],
  armchair: [[.5, .62, 'read', .48, 0, 1]],
  lowshelf: [[1, 1.45, 'read', 0, 0, -1]],
  kanban: [[.6, 1.35, 'plan', 0, 0, -1], [1.4, 1.35, 'plan', 0, 0, -1]],
  rack: [[.5, 1.45, 'infra', 0, 0, -1]],
  pouf: [[.5, .5, 'relax', .4, 0, 1]],
  palm: [[.5, 1.4, 'plants', 0, 0, -1]], planter: [[1, 1.45, 'plants', 0, 0, -1]], plantshelf: [[1, 1.45, 'plants', 0, 0, -1]],
  printer: [[.5, 1.4, 'print', 0, 0, -1]],
  maca: [[1, 1.45, 'care', 0, 0, -1]], balanca: [[.5, 1.45, 'care', 0, 0, -1]], cadeira_salao: [[.5, 1.45, 'care', 0, 0, -1]],
  bancada_cozinha: [[.8, 1.45, 'cook', 0, 0, -1], [2.2, 1.45, 'cook', 0, 0, -1]], fogao: [[1, 1.45, 'cook', 0, 0, -1]],
  arara: [[1, 1.45, 'stock', 0, 0, -1]], estoque: [[1, 1.45, 'stock', 0, 0, -1]], mesa_embalagem: [[1, 1.45, 'stock', 0, 0, -1]],
  vitrine: [[1, 1.45, 'sell', 0, 0, -1]], caixa: [[1, 1.45, 'sell', 0, 0, -1]],
  bancada_oficina: [[1, 1.45, 'craft', 0, 0, -1]], cavalete: [[.5, 1.45, 'craft', 0, 0, -1]],
  chroma: [[1.5, .6, 'record', 0, 0, 1]],
  // o segundo ponto fica atrás da mesa de reunião, de frente para a TV (o primeiro costuma estar bloqueado)
  tv: [[1, 1.7, 'tv', 0, 0, -1], [1, 4.4, 'tv', 0, 0, -1]],
};
const ACTS = {
  work:    { label: 'Trabalhando', go: 'Indo trabalhar', icon: 'typing', w: 46, dur: [12, 22], lunch: .2 },
  attend:  { label: 'Atendendo', go: 'Indo à recepção', icon: 'chat', w: 0, dur: [8, 12], lunch: 0 },
  care:    { label: 'Atendendo', go: 'Indo atender', icon: 'chat', w: 0, dur: [8, 12], lunch: 0 },
  cook:    { label: 'Cozinhando', go: 'Indo à cozinha', icon: 'coffee', w: 0, dur: [8, 12], lunch: 0 },
  stock:   { label: 'No estoque', go: 'Indo ao estoque', icon: 'paper', w: 0, dur: [8, 12], lunch: 0 },
  sell:    { label: 'Vendendo', go: 'Indo ao balcão', icon: 'chat', w: 0, dur: [8, 12], lunch: 0 },
  craft:   { label: 'Na bancada', go: 'Indo à bancada', icon: 'typing', w: 0, dur: [8, 12], lunch: 0 },
  meeting: { label: 'Em reunião', go: 'Indo para a reunião', icon: 'chart', w: 10, dur: [10, 16], lunch: .2 },
  coffee:  { label: 'Tomando café', go: 'Indo tomar café', icon: 'coffee', w: 12, dur: [5, 9], lunch: 3 },
  fridge:  { label: 'Pegando uma bebida', go: 'Indo à geladeira', icon: 'can', w: 6, dur: [3, 5], lunch: 3 },
  relax:   { label: 'Descansando', go: 'Indo descansar', icon: 'music', w: 9, dur: [7, 12], lunch: 3 },
  plants:  { label: 'Regando as plantas', go: 'Indo regar as plantas', icon: 'drop', w: 4, dur: [3, 5], lunch: 1 },
  print:   { label: 'Imprimindo', go: 'Indo à impressora', icon: 'paper', w: 4, dur: [3, 5], lunch: .5 },
  record:  { label: 'Gravando conteúdo', go: 'Indo gravar', icon: 'camera', w: 4, dur: [7, 11], lunch: .3 },
  tv:      { label: 'Vendo os números', go: 'Indo ver a TV', icon: 'chart', w: 3, dur: [4, 6], lunch: 1 },
  read:    { label: 'Lendo', go: 'Indo ler', icon: 'book', w: 5, dur: [6, 10], lunch: 1 },
  wander:  { label: 'Dando uma volta', go: 'Dando uma volta', icon: null, w: 7, dur: [1, 3], lunch: 1.5 },
};
