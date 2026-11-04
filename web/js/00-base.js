'use strict';

// O 3D carrega depois (módulo); até ele desenhar o primeiro quadro, o 2D fica escondido, para não "piscar" a sala 2D.
// Mesma regra de web/js3d/cena3d.js (WANT). Se o 3D falhar, cena3d.js tira a classe e o 2D aparece.
(() => {
  const q = new URLSearchParams(location.search);
  if (q.has('3d') || (!q.has('2d') && (!!window.PIXELHQ_BRIDGE || !!window.PIXELHQ_3D))) document.documentElement.classList.add('espera3d');
})();
// barra da tela de carregamento: cada etapa (scripts, 3D, modelos, servidor) avança até a fração dada; nunca volta
let loadP = 0;
function loadStep(p, text) {
  loadP = Math.max(loadP, Math.min(1, p));
  const f = document.getElementById('loader-fill'), l = document.getElementById('loader'), t = document.getElementById('loader-text');
  if (f) f.style.width = Math.round(5 + loadP * 95) + '%';
  if (l) l.setAttribute('aria-valuenow', String(Math.round(loadP * 100)));
  if (t && text) t.textContent = text;
}
window.loadStep = loadStep;
loadStep(.05, 'Abrindo a página…');

const $ = (s, r = document) => r.querySelector(s);
const cv = $('#scene'), ctx = cv.getContext('2d');
const TW = 32, TH = 16, UH = 18, WH = 2.6, MAXS = 48;
let view = { cx: 0, cy: 0, z: 2 }, VW = 0, VH = 0, dpr = 1;
const IC = {
  rotate: '<svg class="i" viewBox="0 0 20 20"><path d="M16 10a6 6 0 1 1-2-4.5M16 3v4h-4"/></svg>',
  copy: '<svg class="i" viewBox="0 0 20 20"><rect x="7" y="7" width="10" height="10" rx="2"/><path d="M13 4H5a2 2 0 0 0-2 2v8"/></svg>',
  trash: '<svg class="i" viewBox="0 0 20 20"><path d="M4 6h12M8 6V4h4v2M6 6l1 11h6l1-11"/></svg>',
  brush: '<svg class="i" viewBox="0 0 20 20"><path d="M3 3h6v6H3zM11 3h6v6h-6zM3 11h6v6H3zM14 11v6M11 14h6"/></svg>',
  erase: '<svg class="i" viewBox="0 0 20 20"><path d="M3 3h6v6H3zM11 3h6v6h-6zM3 11h6v6H3zM12 12l4 4M16 12l-4 4"/></svg>',
  hand: '<svg class="i" viewBox="0 0 20 20"><path d="M7 10V4.5a1.2 1.2 0 0 1 2.4 0V9M9.4 9V3.5a1.2 1.2 0 0 1 2.4 0V9M11.8 9V4.5a1.2 1.2 0 0 1 2.4 0V11M7 10 5.6 8.6a1.3 1.3 0 0 0-2 1.7L7 15.5A4 4 0 0 0 10.4 17h1a4 4 0 0 0 4-4V8.5a1.2 1.2 0 0 0-1.2-1.2"/></svg>',
  search: '<svg class="i" viewBox="0 0 20 20"><circle cx="9" cy="9" r="5.5"/><path d="m13 13 4 4"/></svg>',
  warn: '<svg class="i" viewBox="0 0 20 20"><path d="M10 3 2 17h16L10 3zM10 8v4M10 14.5v.5"/></svg>',
  check: '<svg class="i" viewBox="0 0 20 20"><path d="m4 10 4 4 8-8"/></svg>',
  plus: '<svg class="i" viewBox="0 0 20 20"><path d="M10 4v12M4 10h12"/></svg>',
};
