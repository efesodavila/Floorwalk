// Configurações do servidor: provedor escolhido, modelo e chaves.
// Ficam em data/settings.json (fora do git, só o dono do arquivo lê). Chaves no .env também valem.
import fs from 'node:fs/promises';
import path from 'node:path';
import { PROVIDERS } from './providers.mjs';

const FILE = path.resolve(process.env.FLOORWALK_DATA_DIR || './data', 'settings.json');
let cache = null;

export async function load() {
  if (cache) return cache;
  try { cache = JSON.parse(await fs.readFile(FILE, 'utf8')); } catch { cache = {}; }
  cache.keys ??= {}; cache.baseUrls ??= {};
  return cache;
}

async function persist(s) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(s, null, 2), { mode: 0o600 });
  await fs.chmod(FILE, 0o600).catch(() => {});
  cache = s;
}

// chave usada para um provedor: a salva pela tela tem prioridade sobre o .env
export function keyFor(s, provider) {
  const P = PROVIDERS[provider];
  if (!P?.needsKey) return undefined;
  return s.keys[provider] || process.env[P.envKey] || undefined;
}

const hint = (k) => (k ? '…' + k.slice(-4) : null);

// o que a página pode ver: nunca a chave, só se existe e os 4 últimos caracteres
export function publicView(s) {
  return {
    configured: !!(s.provider && s.model && PROVIDERS[s.provider]),
    // o provedor recusou o modelo salvo numa chamada real: a página pede para trocar
    modelBroken: s.modelBroken || null,
    provider: s.provider || null,
    model: s.model || null,
    // os agentes podem pesquisar na internet (padrão: sim)
    web: s.web !== false,
    providers: Object.entries(PROVIDERS).map(([id, P]) => ({
      id, name: P.name, needsKey: P.needsKey, keyHelp: P.keyHelp, defaultBaseUrl: P.defaultBaseUrl || null,
      baseUrl: s.baseUrls[id] || null,
      key: P.needsKey ? { set: !!keyFor(s, id), source: s.keys[id] ? 'tela' : process.env[P.envKey] ? 'env' : null, hint: hint(keyFor(s, id)) } : null,
    })),
  };
}

export async function save({ provider, model, apiKey, baseUrl }) { // model já escolhido por llm.pickModel
  const s = structuredClone(await load());
  s.provider = provider; s.model = model; delete s.modelBroken;
  if (apiKey) s.keys[provider] = apiKey;
  if (baseUrl !== undefined) { if (baseUrl) s.baseUrls[provider] = baseUrl; else delete s.baseUrls[provider]; }
  await persist(s);
  return s;
}

export async function setWeb(on) {
  const s = structuredClone(await load());
  s.web = !!on;
  await persist(s);
}

export async function setModel(model) {
  const s = structuredClone(await load());
  s.model = model; delete s.modelBroken;
  await persist(s);
}

export async function markModelBroken(reason) {
  const s = structuredClone(await load());
  s.modelBroken = { model: s.model, reason: String(reason).slice(0, 300) };
  await persist(s);
}

// configuração completa para chamar o provedor ativo
export async function active() {
  const s = await load();
  if (!s.provider || !PROVIDERS[s.provider]) return null;
  return { provider: s.provider, model: s.model, apiKey: keyFor(s, s.provider), baseUrl: s.baseUrls[s.provider] };
}
