// Lê um .glb (malha única, como os gerados pelo Meshy) e lista as "ilhas" de malha: grupos de triângulos
// conectados. Cada ilha vem com o centro da caixa em alturas do corpo (0 = pé, 1 = topo), o mesmo sistema de
// coordenadas usado em web/js3d/personagens3d-meshy.js (campos acc e roles de MODELS).
//
// Uso:  node scripts/glb-ilhas.mjs web/modelos/menino_acessorios.glb   (imprime as ilhas, maiores primeiro)
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export function lerGLB(file) {
  const buf = fs.readFileSync(file);
  if (buf.readUInt32LE(0) !== 0x46546C67) throw new Error(`${file}: não é GLB`);
  const jl = buf.readUInt32LE(12), json = JSON.parse(buf.subarray(20, 20 + jl).toString('utf8'));
  const bl = buf.readUInt32LE(20 + jl), bin = buf.subarray(28 + jl, 28 + jl + bl);
  const T = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array, 5121: Uint8Array };
  const acc = (i, n) => {
    const a = json.accessors[i], v = json.bufferViews[a.bufferView], C = T[a.componentType];
    const off = (v.byteOffset || 0) + (a.byteOffset || 0), len = a.count * n;
    return new C(bin.buffer.slice(bin.byteOffset + off, bin.byteOffset + off + len * C.BYTES_PER_ELEMENT));
  };
  const prim = json.meshes[0].primitives[0];
  return { json, pos: acc(prim.attributes.POSITION, 3), idx: prim.indices != null ? acc(prim.indices, 1) : null };
}

export function ilhas(file) {
  const { pos, idx } = lerGLB(file), nV = pos.length / 3;
  const I = idx || Uint32Array.from({ length: nV }, (_, i) => i);
  // solda vértices na mesma posição (o GLB duplica vértices nas costuras de UV)
  const key = new Map(), wid = new Int32Array(nV);
  for (let i = 0; i < nV; i++) { const k = pos[i * 3].toFixed(4) + ',' + pos[i * 3 + 1].toFixed(4) + ',' + pos[i * 3 + 2].toFixed(4); if (!key.has(k)) key.set(k, key.size); wid[i] = key.get(k); }
  const par = Int32Array.from({ length: key.size }, (_, i) => i);
  const fd = (x) => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
  for (let t = 0; t < I.length; t += 3) { const a = fd(wid[I[t]]); par[fd(wid[I[t + 1]])] = a; par[fd(wid[I[t + 2]])] = a; }
  let y0 = Infinity, y1 = -Infinity; for (let i = 0; i < nV; i++) { y0 = Math.min(y0, pos[i * 3 + 1]); y1 = Math.max(y1, pos[i * 3 + 1]); }
  const H = y1 - y0, box = new Map();
  for (let t = 0; t < I.length; t += 3) {
    const r = fd(wid[I[t]]); let b = box.get(r); if (!b) box.set(r, b = { n: 0, min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] });
    b.n++;
    for (let q = 0; q < 3; q++) for (let k = 0; k < 3; k++) { const v = pos[I[t + q] * 3 + k]; b.min[k] = Math.min(b.min[k], v); b.max[k] = Math.max(b.max[k], v); }
  }
  return [...box.values()].map(b => ({ tris: b.n, c: [(b.min[0] + b.max[0]) / 2 / H, ((b.min[1] + b.max[1]) / 2 - y0) / H, (b.min[2] + b.max[2]) / 2 / H] }))
    .sort((a, b) => b.tris - a.tris);
}

// mesma regra de personagens3d-meshy.js (pick): cada ponto pega a ilha mais próxima ainda livre, a no máximo √0.004
export function conferir(lista, pontos, tol = .004) {
  const usadas = new Set(), faltando = [];
  for (const p of pontos) {
    let best = -1, bd = Infinity;
    lista.forEach((il, i) => { if (usadas.has(i)) return; const d = (il.c[0] - p[0]) ** 2 + (il.c[1] - p[1]) ** 2 + (il.c[2] - p[2]) ** 2; if (d < bd) { bd = d; best = i; } });
    if (best >= 0 && bd < tol) usadas.add(best); else faltando.push(p);
  }
  return faltando;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const f of process.argv.slice(2)) {
    console.log('==', f);
    for (const il of ilhas(f)) console.log(String(il.tris).padStart(5), il.c.map(v => v.toFixed(3)).join(', '));
  }
}
