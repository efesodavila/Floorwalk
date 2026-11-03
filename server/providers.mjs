// Provedores de LLM com uma interface única:
//   test({ apiKey, baseUrl })                      -> { models: [ids] }  (verifica a conexão sem gastar tokens)
//   chat({ apiKey, baseUrl, model, system, messages, json }) -> texto da resposta
// As chamadas saem do servidor; a chave nunca vai para a página.
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

const openaiMode = new Map(); // chave -> 'chat' quando a API Responses não está liberada
const TIMEOUT = 20000;        // testar conexão
const CHAT_TIMEOUT = 240000;  // respostas longas podem demorar

// Sem filtro a OpenAI devolve dezenas de modelos de áudio, imagem e embeddings.
const OPENAI_NON_CHAT = /(embedding|tts|whisper|audio|realtime|transcribe|dall-e|image|moderation|search|computer-use|babbage|davinci|sora|instruct|deep-research)/i;
// Escolhe um modelo padrão sensato: conversa comum, sem data no nome, sem "preview"/"pro"/"codex",
// de preferência a versão "mini" (mais barata) da geração mais nova.
export function rankModels(provider, models) {
  const ver = (id) => { const m = /^(?:gpt-|claude-[a-z]+-|o)(\d+(?:[.-]\d+)?)/i.exec(id); return m ? parseFloat(m[1].replace('-', '.')) : 0; };
  const score = (id) => {
    let s = 0;
    if (/\d{4}-?\d{2}-?\d{2}|\d{8}/.test(id)) s -= 4;           // versão com data
    if (/preview|pro\b|-pro-|codex|latest|chat/i.test(id)) s -= 3;
    if (provider === 'openai' && !/^gpt-/i.test(id)) s -= 2;      // série "o": raciocínio, mais lenta e cara
    if (/mini|sonnet/i.test(id)) s += 2;
    if (/haiku/i.test(id)) s += 1;
    if (/nano/i.test(id)) s -= 1;
    return s;
  };
  return [...models].sort((a, b) => score(b) - score(a) || ver(b) - ver(a) || a.localeCompare(b));
}
export const recommendModel = (provider, models) => rankModels(provider, models)[0] || null;
const isOpenAIChat = (id) => /^(gpt-|o\d|chatgpt-)/i.test(id) && !OPENAI_NON_CHAT.test(id);

export const PROVIDERS = {
  openai: {
    name: 'OpenAI',
    needsKey: true,
    keyHelp: 'platform.openai.com/api-keys',
    envKey: 'OPENAI_API_KEY',
    client: ({ apiKey, baseUrl }, timeout = TIMEOUT) => new OpenAI({ apiKey, baseURL: baseUrl || undefined, timeout, maxRetries: 1 }),
    async test(cfg) {
      const out = [];
      for await (const m of this.client(cfg).models.list()) out.push(m.id);
      const models = out.filter(isOpenAIChat).sort();
      return { models, recommended: recommendModel('openai', models) };
    },
    async chat(cfg) {
      // Usa a API Responses; se a chave não tiver permissão para ela (ou o endereço não a oferecer),
      // passa para a API Chat Completions e lembra a escolha para esta chave.
      const key = (cfg.baseUrl || '') + '|' + String(cfg.apiKey || '').slice(-8);
      if (openaiMode.get(key) !== 'chat') {
        try {
          // sem max_output_tokens: em modelos com raciocínio, um limite baixo consome a resposta inteira
          const r = await this.client(cfg, CHAT_TIMEOUT).responses.create({
            model: cfg.model, instructions: cfg.system || undefined,
            input: cfg.messages.map(m => ({ role: m.role, content: m.content })),
            ...(cfg.json ? { text: { format: { type: 'json_object' } } } : {}),
          }, { signal: cfg.signal });
          return r.output_text ?? '';
        } catch (e) {
          const noResponses = ((e?.status === 401 || e?.status === 403) && isPermissionError(e)) || (e?.status === 404 && /responses/i.test(String(e?.message)) && !/model/i.test(String(e?.message)));
          if (!noResponses || cfg.signal?.aborted) throw e;
          openaiMode.set(key, 'chat');
          console.log('[openai] sem acesso à API Responses com esta chave; usando Chat Completions');
        }
      }
      const r = await this.client(cfg, CHAT_TIMEOUT).chat.completions.create({
        model: cfg.model,
        messages: [...(cfg.system ? [{ role: 'system', content: cfg.system }] : []), ...cfg.messages.map(m => ({ role: m.role, content: m.content }))],
        ...(cfg.json ? { response_format: { type: 'json_object' } } : {}),
      }, { signal: cfg.signal });
      return r.choices?.[0]?.message?.content ?? '';
    },
  },

  anthropic: {
    name: 'Anthropic (Claude)',
    needsKey: true,
    keyHelp: 'console.anthropic.com/settings/keys',
    envKey: 'ANTHROPIC_API_KEY',
    client: ({ apiKey, baseUrl }, timeout = TIMEOUT) => new Anthropic({ apiKey, baseURL: baseUrl || undefined, timeout, maxRetries: 1 }),
    async test(cfg) {
      const out = [];
      for await (const m of this.client(cfg).models.list()) out.push(m.id);
      return { models: out, recommended: recommendModel('anthropic', out) };
    },
    async chat(cfg) {
      const r = await this.client(cfg, CHAT_TIMEOUT).messages.create({
        model: cfg.model, max_tokens: cfg.maxTokens || 4096, system: cfg.system || undefined,
        messages: cfg.messages.map(m => ({ role: m.role, content: m.content })),
      }, { signal: cfg.signal });
      return r.content.filter(b => b.type === 'text').map(b => b.text).join('');
    },
  },

  ollama: {
    name: 'Ollama (no seu computador)',
    needsKey: false,
    keyHelp: 'ollama.com/download',
    defaultBaseUrl: 'http://127.0.0.1:11434',
    async req(cfg, path, body, signal) {
      const base = (cfg.baseUrl || this.defaultBaseUrl).replace(/\/+$/, '');
      const limit = AbortSignal.timeout(body ? 300000 : 8000), ctl = signal ? AbortSignal.any([signal, limit]) : limit;
      let res;
      try {
        res = await fetch(base + path, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: ctl } : { signal: ctl });
      } catch (e) {
        if (signal?.aborted) throw Object.assign(new Error('Tarefa cancelada.'), { code: 'cancelled' });
        throw Object.assign(new Error(`Não encontrei o Ollama em ${base}. Ele está aberto?`), { code: 'unreachable' });
      }
      if (!res.ok) throw Object.assign(new Error(`Ollama respondeu ${res.status}: ${(await res.text()).slice(0, 200)}`), { status: res.status });
      return res.json();
    },
    async test(cfg) {
      const r = await this.req(cfg, '/api/tags');
      const models = (r.models || []).map(m => m.name);
      if (!models.length) throw Object.assign(new Error('O Ollama está rodando, mas não tem nenhum modelo baixado. Rode, por exemplo: ollama pull llama3.2'), { code: 'no_models' });
      return { models, recommended: models[0] };
    },
    async chat(cfg) {
      const messages = [...(cfg.system ? [{ role: 'system', content: cfg.system }] : []), ...cfg.messages];
      const r = await this.req(cfg, '/api/chat', { model: cfg.model, messages, stream: false, ...(cfg.json ? { format: 'json' } : {}) }, cfg.signal);
      return r.message?.content ?? '';
    },
  },
};

// Traduz erros dos SDKs para mensagens que o usuário entende.
// chave com permissões restritas (a OpenAI permite chaves "Restricted" e "Read only")
export const isPermissionError = (e) => /insufficient permissions|missing scope|scopes?:|not have the required permission|restricted/i.test(String(e?.error?.message || e?.message || ''));

export function explainError(provider, e) {
  const status = e?.status;
  const name = PROVIDERS[provider]?.name || provider;
  // a própria mensagem do provedor explica melhor; mostramos sempre (sem a chave)
  // OpenAI: e.error.message · Anthropic: e.error.error.message · outros: JSON dentro de e.message
  let raw = e?.error?.error?.message || e?.error?.message || String(e?.message || '').replace(/^\d{3}\s*/, '');
  try { const j = JSON.parse(raw); raw = j?.error?.message || j?.message || raw; } catch {}
  const detail = String(raw).replace(/(sk-[\w-]{4})[\w-]+/g, '$1…').slice(0, 300);
  const said = detail ? ` A ${name} disse: “${detail}”` : '';
  if ((status === 401 || status === 403) && isPermissionError(e))
    return `A chave conecta, mas não tem permissão para gerar textos.${said} No painel da ${name}, edite a chave e dê permissão total ("All"), ou crie uma chave nova sem restrições.`;
  if (status === 401 || status === 403) return `A ${name} recusou a chave.${said} Confira se copiou a chave inteira e se ela está ativa.`;
  if (status === 429 && /quota|billing|credit|saldo/i.test(detail)) return `A conta da ${name} está sem crédito.${said} Adicione saldo no painel de cobrança.`;
  if (status === 429) return `A ${name} recusou por limite de uso.${said} Espere um pouco e tente de novo.`;
  if (status === 404) return `A ${name} não encontrou o modelo ou o endereço${detail ? `: “${detail}”` : '.'}`;
  if (status === 400 || status === 422) return `A ${name} recusou o pedido${detail ? `: “${detail}”` : '.'}`;
  if (status >= 500) return `A ${name} está com instabilidade (erro ${status}). Tente de novo em instantes.`;
  if (e?.code === 'unreachable' || e?.code === 'no_models') return e.message;
  if (/timeout|timed out|ETIMEDOUT|ENOTFOUND|ECONNREFUSED|fetch failed|Connection error/i.test(String(e?.message))) return `Sem conexão com a ${name}. Verifique a internet ou o endereço.`;
  return `Falha ao conectar com a ${name}: ${String(e?.message || e).slice(0, 200)}`;
}
