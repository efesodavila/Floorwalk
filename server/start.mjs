// Entrada do `npm start`: confere a versão do Node e lê o .env (se houver) antes de subir o servidor.
// Sem imports no topo: num Node antigo, a mensagem aparece antes de qualquer coisa que dependa da versão.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const NEED = [22, 9];
const [maj, min] = process.versions.node.split('.').map(Number);
if (maj < NEED[0] || (maj === NEED[0] && min < NEED[1])) {
  console.error(`Floorwalk needs Node ${NEED.join('.')} or newer. You have ${process.versions.node}.`);
  console.error('Install the current LTS from https://nodejs.org and run npm start again.');
  process.exit(1);
}
// .env é opcional (porta, host...): sem ele, valem os padrões, sem aviso
const env = path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), '.env');
if (fs.existsSync(env)) process.loadEnvFile(env);
await import('./server.mjs');
