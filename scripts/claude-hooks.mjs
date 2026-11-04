#!/usr/bin/env node
// Liga e desliga o Floorwalk no Claude Code.
//   npm run hooks:install    → registra os hooks no ~/.claude/settings.json (faz cópia antes)
//   npm run hooks:uninstall  → tira só as entradas do Floorwalk
//   npm run hooks:status     → mostra se está ligado
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { install, uninstall, status } from '../server/claude-hooks-install.mjs';

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), 'claude-hook.mjs');
const cmd = process.argv[2] || 'status';
try {
  if (cmd === 'install') {
    const r = await install({ script });
    console.log(`Floorwalk ligado no Claude Code (${r.events} eventos) em ${r.file}.`);
    if (r.backup) console.log(`Cópia do arquivo original: ${r.backup}`);
    console.log('Rode o servidor (npm start) e abra uma sessão nova do Claude Code: ela aparece na sala.');
  } else if (cmd === 'uninstall') {
    const r = await uninstall();
    console.log(r.removed ? `Floorwalk desligado do Claude Code (${r.removed} entradas removidas de ${r.file}).` : 'Nada a remover: o Floorwalk não estava ligado.');
  } else if (cmd === 'status') {
    const r = await status();
    console.log(r.installed ? `Ligado em ${r.file}.` : r.events.length ? `Ligado pela metade (${r.events.join(', ')}). Rode npm run hooks:install.` : `Desligado. Rode npm run hooks:install.`);
  } else { console.log('Use: install | uninstall | status'); process.exitCode = 2; }
} catch (e) {
  console.error(e.message); process.exitCode = 1;
}
