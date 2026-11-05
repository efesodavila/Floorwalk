#!/usr/bin/env node
// Liga e desliga o Floorwalk no Claude Code sem o plugin (o plugin é o caminho recomendado; ver README).
//   npm run hooks:install    → registra os hooks no ~/.claude/settings.json (faz cópia antes)
//   npm run hooks:uninstall  → tira só as entradas do Floorwalk
//   npm run hooks:status     → mostra se está ligado (pelo plugin ou à mão) e se o caminho ainda vale
// Mensagens em inglês: o terminal não tem o seletor de idioma da página, e o README principal é em inglês.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { install, uninstall, status } from '../server/claude-hooks-install.mjs';

const script = path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), 'plugin', 'scripts', 'claude-hook.mjs');
const cmd = process.argv[2] || 'status';
try {
  if (cmd === 'install') {
    const r = await install({ script });
    console.log(`Floorwalk hooks installed in ${r.file} (${r.events} events).`);
    if (r.backup) console.log(`Copy of your original file: ${r.backup}`);
    console.log('Next: npm start, open the page, then start a NEW Claude Code session (sessions already open are not tracked).');
    console.log('Moving or deleting this folder breaks the hooks: run npm run hooks:uninstall first, or hooks:install again after moving.');
  } else if (cmd === 'uninstall') {
    const r = await uninstall();
    console.log(r.removed ? `Floorwalk hooks removed (${r.removed} entries from ${r.file}).` : 'Nothing to remove: the Floorwalk hooks were not installed by hand.');
  } else if (cmd === 'status') {
    const r = await status();
    console.log(r.plugin ? `On, through the Floorwalk plugin (${r.file}).`
      : r.broken ? 'Installed, but pointing to a folder that no longer exists. Run npm run hooks:install again.'
        : r.installed ? `On, installed by hand in ${r.file}.`
          : r.events.length ? `Half installed (${r.events.join(', ')}). Run npm run hooks:install.`
            : 'Off. Install the plugin (see README) or run npm run hooks:install.');
  } else { console.log('Use: install | uninstall | status'); process.exitCode = 2; }
} catch (e) {
  console.error(e.message); process.exitCode = 1;
}
