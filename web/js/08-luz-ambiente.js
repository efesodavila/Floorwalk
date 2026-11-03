'use strict';

/* ---------- Luz ambiente por horário (dia / tarde / noite) ---------- */
// cor de "multiply" aplicada sobre a cena + reforço do brilho das luzes (k)
const AMB_KEYS = [
  [0, '#4E5890', 1.8], [5, '#4E5890', 1.8], [6.5, '#C9A0A6', 1.3], [8, '#FFFFFF', 1],
  [14.5, '#FFFFFF', 1], [16, '#FFF0DC', 1.05], [17.5, '#FFD9AE', 1.2], [18.5, '#E8A08A', 1.4],
  [19.5, '#6E6FA8', 1.6], [21, '#4E5890', 1.8], [24, '#4E5890', 1.8]];
const AMB_FIXED = { dia: 11, tarde: 17.5, noite: 22 };
const AMB_ORDER = ['auto', 'dia', 'tarde', 'noite'];
let ambMode = 'auto'; try { ambMode = AMB_ORDER.includes(localStorage.getItem('pixelhq.amb')) ? localStorage.getItem('pixelhq.amb') : 'auto'; } catch (e) {}
const hexRGB = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
function ambAt(h) {
  let i = 0; while (i < AMB_KEYS.length - 2 && AMB_KEYS[i + 1][0] <= h) i++;
  const [h0, c0, k0] = AMB_KEYS[i], [h1, c1, k1] = AMB_KEYS[i + 1], t = h1 > h0 ? (h - h0) / (h1 - h0) : 0, e = t * t * (3 - 2 * t);
  const a = hexRGB(c0), b = hexRGB(c1), rgb = a.map((v, j) => Math.round(v + (b[j] - v) * e));
  return { h, tint: `rgb(${rgb.join(',')})`, white: rgb.every(v => v > 252), k: k0 + (k1 - k0) * e };
}
const ambPeriod = h => h >= 6 && h < 12 ? 'Dia' : h >= 12 && h < 18 ? 'Tarde' : 'Noite';
let AMB = ambAt(12), ambLabel = '';
function ambUpdate() {
  const d = new Date(), real = d.getHours() + d.getMinutes() / 60;
  const h = ambMode === 'auto' ? real : AMB_FIXED[ambMode];
  AMB = ambAt(h);
  const per = ambPeriod(h), ic = per === 'Noite' ? '☾' : per === 'Tarde' ? '◐' : '☀';
  const txt = ambMode === 'auto' ? `${ic} ${per} · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : `${ic} ${per} (fixo)`;
  if (txt !== ambLabel) { ambLabel = txt; const b = document.getElementById('amb-btn'); if (b) b.textContent = 'Iluminação: ' + txt; }
}
document.getElementById('amb-btn').onclick = () => {
  ambMode = AMB_ORDER[(AMB_ORDER.indexOf(ambMode) + 1) % AMB_ORDER.length];
  try { localStorage.setItem('pixelhq.amb', ambMode); } catch (e) {}
  ambUpdate(); toastAmb();
};
function toastAmb() { const t = document.getElementById('toast'); if (!t) return; t.textContent = ambMode === 'auto' ? 'Iluminação automática: segue o relógio do seu dispositivo' : `Iluminação fixa: ${ambPeriod(AMB_FIXED[ambMode])}`; t.classList.add('show'); clearTimeout(toastAmb.t); toastAmb.t = setTimeout(() => t.classList.remove('show'), 2200); }
ambUpdate();
