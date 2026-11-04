#!/usr/bin/env node
// Hook do Claude Code → Pixel HQ. O Claude Code roda este script a cada evento da sessão (instalado por
// `npm run hooks:install`) e passa o evento em JSON pela entrada padrão. O script repassa ao servidor local
// do Pixel HQ e sai. Regras: nunca atrapalhar o Claude Code — não escreve nada na saída, sempre sai com
// código 0 e desiste em menos de 1 s se o servidor não estiver rodando.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const done = () => process.exit(0);
setTimeout(done, 1500).unref?.();
try {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  const body = Buffer.concat(chunks).toString('utf8');
  // porta e senha do servidor: gravadas por ele ao subir (só o usuário lê)
  const { port, token } = JSON.parse(fs.readFileSync(path.join(process.env.PIXELHQ_HOME || path.join(os.homedir(), '.pixel-hq'), 'hook.json'), 'utf8'));
  if (body && port && token) {
    await fetch(`http://127.0.0.1:${Number(port)}/api/hooks/claude`, {
      method: 'POST', body, signal: AbortSignal.timeout(800),
      headers: { 'content-type': 'application/json', 'x-pixelhq-token': String(token) },
    });
  }
} catch {}
done();
