// Instala e remove os hooks do Floorwalk no settings.json do Claude Code (~/.claude/settings.json).
// Regras (o arquivo é do usuário, guarda as permissões dele):
// - arquivo ilegível ou com formato inesperado: aborta sem tocar em nada;
// - antes da primeira escrita, faz uma cópia (settings.json.floorwalk.backup) que nunca é sobrescrita;
// - só mexe nas entradas cujo comando é o nosso (script claude-hook.mjs com a marca --floorwalk);
//   as do usuário e de outras ferramentas ficam como estão;
// - grava num arquivo temporário e troca de uma vez (rename), mantendo a permissão do original; relê para conferir.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { HOOK_EVENTS, TOOL_EVENTS } from './claude-code.mjs';

export const BACKUP_SUFFIX = '.floorwalk.backup';
export const MARK = '--floorwalk';
// nome antigo do projeto: entradas e cópia feitas antes da troca de nome ainda são nossas
export const LEGACY_MARKS = ['--pixel-hq'];
export const LEGACY_BACKUPS = ['.pixel-hq.backup'];
export const defaultSettingsPath = () => path.join(process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'), 'settings.json');

export const isOurs = (h) => typeof h?.command === 'string' && h.command.includes('claude-hook.mjs') && [MARK, ...LEGACY_MARKS].some(m => h.command.includes(m));
export const hookCommand = (script) => `node "${script.replace(/\\/g, '/')}" ${MARK}`;

const fail = (m) => Object.assign(new Error(m), { code: 'unsafe' });

async function readSettings(file) {
  let raw;
  try { raw = await fs.readFile(file, 'utf8'); } catch (e) { if (e.code === 'ENOENT') return { data: {}, exists: false, mode: 0o600 }; throw e; }
  let data;
  try { data = raw.trim() ? JSON.parse(raw) : {}; } catch { throw fail(`Could not read ${file} (invalid JSON). Nothing was changed.`); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw fail(`${file} is not a JSON object. Nothing was changed.`);
  if (data.hooks != null && (typeof data.hooks !== 'object' || Array.isArray(data.hooks))) throw fail(`"hooks" in ${file} has a format I don't recognize. Nothing was changed.`);
  for (const [k, v] of Object.entries(data.hooks || {})) if (!Array.isArray(v)) throw fail(`"hooks.${k}" in ${file} is not a list. Nothing was changed.`);
  const mode = (await fs.stat(file)).mode & 0o777;
  return { data, exists: true, mode };
}

// tira as nossas entradas (mantém o resto de cada grupo); devolve quantas tirou
function strip(hooks) {
  let n = 0;
  for (const ev of Object.keys(hooks)) {
    const before = hooks[ev];
    hooks[ev] = before.map(g => {
      if (!g || !Array.isArray(g.hooks)) return g;
      const keep = g.hooks.filter(h => !isOurs(h)); n += g.hooks.length - keep.length;
      return keep.length === g.hooks.length ? g : keep.length ? { ...g, hooks: keep } : null;
    }).filter(Boolean);
    if (!hooks[ev].length && before.length) delete hooks[ev];
  }
  return n;
}

async function writeSettings(file, data, mode, exists) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  // já existe a cópia feita com o nome antigo: ela é a original; não faz outra (esta já teria os nossos hooks)
  const old = await Promise.any(LEGACY_BACKUPS.map(s => fs.access(file + s).then(() => file + s))).catch(() => null);
  const backup = old || file + BACKUP_SUFFIX;
  if (exists && !old) { try { await fs.copyFile(file, backup, fs.constants.COPYFILE_EXCL); } catch (e) { if (e.code !== 'EEXIST') throw e; } }
  // settings.json pode ser um atalho (dotfiles): grava no arquivo de verdade, senão a troca (rename) poria um arquivo no lugar do atalho
  const real = await fs.realpath(file).catch(() => file);
  const tmp = `${real}.floorwalk-tmp-${process.pid}`, text = JSON.stringify(data, null, 2) + '\n';
  await fs.writeFile(tmp, text, { mode });
  await fs.rename(tmp, real);
  if (await fs.readFile(real, 'utf8') !== text) throw new Error(`Writing ${file} did not verify. Restore the copy ${backup} if needed.`);
  return exists ? backup : null;
}

// plugin do Floorwalk ligado (instalado pelo /plugin): ele já traz os hooks; instalar também à mão mandaria tudo em dobro
export const PLUGIN_KEY = /^floorwalk@/;
const pluginOn = (data) => Object.entries(data.enabledPlugins || {}).some(([k, v]) => PLUGIN_KEY.test(k) && v);

export async function install({ file = defaultSettingsPath(), script }) {
  const { data, exists, mode } = await readSettings(file);
  if (pluginOn(data)) throw fail('The Floorwalk plugin is already on, and it brings the hooks itself. Nothing was changed.');
  const hooks = data.hooks ? { ...data.hooks } : {};
  strip(hooks); // reinstalar não duplica (e atualiza o caminho se a pasta mudou)
  const entry = { type: 'command', command: hookCommand(script), timeout: 5 };
  for (const ev of HOOK_EVENTS) (hooks[ev] ||= []).push(TOOL_EVENTS.has(ev) ? { matcher: '*', hooks: [entry] } : { hooks: [entry] });
  const backup = await writeSettings(file, { ...data, hooks }, mode, exists);
  return { file, backup, events: HOOK_EVENTS.length };
}

export async function uninstall({ file = defaultSettingsPath() } = {}) {
  const { data, exists, mode } = await readSettings(file);
  if (!exists || !data.hooks) return { file, removed: 0 };
  const hooks = { ...data.hooks }, removed = strip(hooks);
  if (!removed) return { file, removed: 0 };
  const out = { ...data, hooks };
  if (!Object.keys(hooks).length) delete out.hooks;
  await writeSettings(file, out, mode, exists);
  return { file, removed };
}

// installed: ligado (pelo plugin ou à mão) · plugin: pelo plugin · broken: à mão, mas o script não existe mais
// (pasta do Floorwalk movida ou apagada: todo evento falharia em silêncio)
export async function status({ file = defaultSettingsPath() } = {}) {
  const { data } = await readSettings(file);
  const ours = (ev) => (data.hooks?.[ev] || []).flatMap(g => g?.hooks || []).filter(isOurs);
  const on = HOOK_EVENTS.filter(ev => ours(ev).length);
  const plugin = pluginOn(data);
  const cmd = on.length ? ours(on[0])[0].command : '';
  const script = (cmd.match(/"([^"]*claude-hook.mjs)"/) || [])[1];
  const broken = !plugin && !!script && !(await fs.access(script).then(() => true, () => false));
  return { file, installed: plugin || on.length === HOOK_EVENTS.length, plugin, broken, events: on };
}
