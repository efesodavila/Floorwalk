// Nome antigo do projeto: variáveis PIXELHQ_* continuam valendo como FLOORWALK_* (o .env de quem já usava não quebra).
// Importado primeiro pelo server.mjs, antes dos módulos que leem process.env ao carregar.
for (const [k, v] of Object.entries(process.env)) {
  if (k.startsWith('PIXELHQ_')) { const n = 'FLOORWALK_' + k.slice(8); if (process.env[n] === undefined) process.env[n] = v; }
}
