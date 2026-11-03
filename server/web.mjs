// Acesso dos agentes à internet: buscar e ler páginas. Só leitura — nada de executar código ou enviar dados.
//
//   search(consulta)  → [{ title, url, snippet }]   (Brave Search se houver BRAVE_API_KEY; senão DuckDuckGo HTML)
//   readPage(url)     → { url, title, text }        (HTML → texto puro, cortado)
//
// Proteções:
//  - só http/https; endereços da rede interna (localhost, 10.x, 192.168.x, 169.254.x — metadados da nuvem — etc.)
//    são recusados, inclusive depois de redirecionamentos (verificados um a um);
//  - tempo máximo, tamanho máximo, só texto/HTML, no máximo 3 redirecionamentos.
// PIXELHQ_BUSCA_URL troca o endereço da busca (testes); PIXELHQ_WEB_LOCAL=1 libera rede local (só para testes).
import dns from 'node:dns/promises';
import net from 'node:net';

const UA = 'PixelHQ/1.0 (agente de pesquisa; +https://github.com/)';
export const LIMITS = { timeoutMs: 12000, maxBytes: 1_500_000, maxRedirects: 3, pageChars: 7000, results: 5 };

export class WebError extends Error {}

// ---------- endereços proibidos (rede interna) ----------
function privateIP(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v = ip.toLowerCase();
  if (v.startsWith('::ffff:')) return privateIP(v.slice(7));
  return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe8') || v.startsWith('fe9') || v.startsWith('fea') || v.startsWith('feb');
}
export async function checkURL(raw) {
  let u; try { u = new URL(raw); } catch { throw new WebError(`endereço inválido: ${raw}`); }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new WebError(`só http/https: ${u.protocol}`);
  if (u.username || u.password) throw new WebError('endereço com usuário/senha não é permitido');
  if (process.env.PIXELHQ_WEB_LOCAL === '1') return u;
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (/^(localhost|.*\.local|.*\.internal)$/i.test(host)) throw new WebError(`endereço interno bloqueado: ${host}`);
  let ips;
  try { ips = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true }); }
  catch {
    // atrás de um proxy (HTTPS_PROXY) o nome pode não resolver aqui: o proxy resolve; a checagem fica pelo nome acima
    if (process.env.HTTPS_PROXY || process.env.https_proxy) return u;
    throw new WebError(`não encontrei o site ${host}`);
  }
  if (ips.some(i => privateIP(i.address))) throw new WebError(`endereço interno bloqueado: ${host}`);
  return u;
}

// ---------- download com limites ----------
async function get(raw, { signal, accept = 'text/html,text/plain;q=0.9,*/*;q=0.5', headers = {} } = {}) {
  let url = raw;
  for (let hop = 0; hop <= LIMITS.maxRedirects; hop++) {
    const u = await checkURL(url);
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), LIMITS.timeoutMs);
    const stop = () => ctl.abort(); signal?.addEventListener('abort', stop, { once: true });
    try {
      const res = await fetch(u, { redirect: 'manual', signal: ctl.signal, headers: { 'user-agent': UA, accept, 'accept-language': 'pt-BR,pt;q=0.9,en;q=0.7', ...headers } });
      if (res.status >= 300 && res.status < 400 && res.headers.get('location')) { url = new URL(res.headers.get('location'), u).href; continue; }
      if (!res.ok) throw new WebError(`o site respondeu ${res.status}`);
      const type = res.headers.get('content-type') || '';
      if (!/text\/|json|xml/i.test(type)) throw new WebError(`conteúdo não é texto (${type || 'sem tipo'})`);
      const reader = res.body.getReader(), parts = []; let size = 0;
      for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > LIMITS.maxBytes) { reader.cancel().catch(() => {}); break; } parts.push(value); }
      return { url: u.href, type, body: Buffer.concat(parts).toString('utf8') };
    } catch (e) {
      if (signal?.aborted) throw Object.assign(new Error('Tarefa cancelada.'), { code: 'cancelled' });
      if (e instanceof WebError) throw e;
      throw new WebError(e?.name === 'AbortError' ? 'o site demorou demais' : `falha ao acessar: ${e?.cause?.code || e?.message || e}`);
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', stop); }
  }
  throw new WebError('redirecionamentos demais');
}

// ---------- HTML → texto ----------
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', laquo: '«', raquo: '»' };
export function decode(s) {
  return String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENT[e.toLowerCase()] ?? m);
}
export function htmlToText(html) {
  const title = decode((/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] || '').trim()).replace(/\s+/g, ' ');
  let s = html.replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|nav|footer|header|form|iframe|template)\b[\s\S]*?<\/\1>/gi, ' ');
  const main = /<(main|article)\b[\s\S]*?<\/\1>/i.exec(s); if (main && main[0].length > 800) s = main[0];
  s = s.replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section)\b[^>]*>/gi, '\n').replace(/<li\b[^>]*>/gi, '\n• ').replace(/<[^>]+>/g, ' ');
  s = decode(s).replace(/[ \t\f\v\r]+/g, ' ').replace(/\n\s*/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return { title, text: s };
}

export async function readPage(url, { signal } = {}) {
  const r = await get(url, { signal });
  const { title, text } = /html/i.test(r.type) ? htmlToText(r.body) : { title: '', text: r.body.trim() };
  return { url: r.url, title: title || new URL(r.url).hostname, text: text.length > LIMITS.pageChars ? text.slice(0, LIMITS.pageChars) + '…' : text };
}

// ---------- busca ----------
export function parseDuckDuckGo(html) {
  const out = [], seen = new Set();
  // cada resultado começa no link de título (class "result__a"); o resumo (class "result__snippet") vem depois dele
  const parts = String(html).split(/(?=<a\b[^>]*class="[^"]*result__a[^"]*")/i).slice(1);
  for (const part of parts) {
    if (out.length >= LIMITS.results) break;
    const a = /^<a\b([^>]*)>([\s\S]*?)<\/a>/i.exec(part); if (!a) continue;
    let href = decode((/href="([^"]+)"/i.exec(a[1]) || [])[1] || '');
    const uddg = /[?&]uddg=([^&]+)/.exec(href); if (uddg) href = decodeURIComponent(uddg[1]);
    if (href.startsWith('//')) href = 'https:' + href;
    if (!/^https?:\/\//.test(href) || /duckduckgo\.com\/y\.js/.test(href) || seen.has(href)) continue;
    seen.add(href);
    const sn = /class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/(a|div|td|span)>/i.exec(part);
    out.push({ title: decode(a[2].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim(), url: href, snippet: sn ? decode(sn[1].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim() : '' });
  }
  return out;
}

export async function search(query, { signal } = {}) {
  const q = String(query || '').trim().slice(0, 200);
  if (!q) return [];
  if (process.env.BRAVE_API_KEY && !process.env.PIXELHQ_BUSCA_URL) {
    const r = await get(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&count=${LIMITS.results}&search_lang=pt`, { signal, accept: 'application/json', headers: { 'x-subscription-token': process.env.BRAVE_API_KEY } });
    const j = JSON.parse(r.body);
    return (j.web?.results || []).slice(0, LIMITS.results).map(x => ({ title: x.title, url: x.url, snippet: htmlToText(x.description || '').text }));
  }
  const base = process.env.PIXELHQ_BUSCA_URL || 'https://html.duckduckgo.com/html/';
  const r = await get(`${base}?q=${encodeURIComponent(q)}&kl=br-pt`, { signal });
  return parseDuckDuckGo(r.body);
}
