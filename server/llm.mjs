// O usuário não escolhe modelo: o servidor escolhe e mantém um que funcione.
//
// pickModel: testa os modelos da conta na ordem de preferência (rankModels) com uma chamada mínima
//            e fica com o primeiro que responde. Listar não basta: a OpenAI, por exemplo, lista
//            modelos que depois recusa para aquela conta.
// chat:      chama o provedor; se o modelo salvo for recusado, escolhe outro, salva e refaz a chamada.
import { PROVIDERS, rankModels, isPermissionError } from './providers.mjs';
import * as settings from './settings.mjs';

const MAX_TRIES = 6;
const msgOf = (e) => String(e?.error?.error?.message || e?.error?.message || e?.message || '');

// o problema é o modelo (não a chave, o saldo ou a rede)?
export function isModelError(e) {
  const s = e?.status, m = msgOf(e);
  if (isPermissionError(e)) return false; // chave restrita: trocar de modelo não resolve
  if (s === 404) return true;
  if (s === 403 && /model/i.test(m)) return true;
  if (s === 400 && /model/i.test(m) && /(not (found|supported|available)|unsupported|does not (exist|support)|invalid model|deprecated)/i.test(m)) return true;
  return false;
}

export async function pickModel(provider, cfg, exclude = []) {
  const P = PROVIDERS[provider];
  // FLOORWALK_MODEL força um modelo (para quem quiser), mas ele também precisa responder
  const forced = process.env.FLOORWALK_MODEL;
  const { models } = await P.test(cfg);
  const ranked = (forced ? [forced] : rankModels(provider, models)).filter(m => !exclude.includes(m)).slice(0, MAX_TRIES);
  const tried = [];
  for (const model of ranked) {
    try {
      await P.chat({ ...cfg, model, messages: [{ role: 'user', content: 'Responda apenas: ok' }], maxTokens: 16 });
      return { model, tried };
    } catch (e) {
      if (!isModelError(e)) throw e;          // chave, saldo ou rede: não adianta tentar outro modelo
      tried.push(model);
      console.error('[modelo recusado]', provider, model, e?.status, msgOf(e).slice(0, 160));
    }
  }
  throw Object.assign(new Error(tried.length
    ? `Nenhum modelo da sua conta respondeu (testei ${tried.join(', ')}). Verifique no painel do provedor se a conta tem acesso a modelos de texto e crédito disponível.`
    : 'A conta não tem nenhum modelo de texto disponível.'), { code: 'no_model' });
}

// Modelo fixo da crítica visual dos móveis (decisão do dono): na OpenAI usa sempre este, com visão.
// Outros provedores seguem com o modelo da conta. FLOORWALK_CRITIC_MODEL troca sem mexer no código.
export const CRITIC_MODEL = { openai: 'gpt-6.1-sol' };
export const criticModel = (provider) => process.env.FLOORWALK_CRITIC_MODEL || CRITIC_MODEL[provider] || null;

// chamada da crítica visual: com modelo fixo não há troca automática (ela salvaria o modelo da
// crítica como modelo da equipe); se ele falhar, o erro sobe e a crítica fica "sem avaliação"
export async function critiqueChat(opts) {
  const cfg = await settings.active();
  if (!cfg) throw new Error('Conecte uma IA primeiro.');
  const model = criticModel(cfg.provider);
  if (!model) return chat(opts);
  return PROVIDERS[cfg.provider].chat({ ...cfg, ...opts, model }).catch(e => { throw Object.assign(e, { provider: cfg.provider, model }); });
}

// chamada com troca automática de modelo; onSwitch(antigo, novo) avisa quem quiser mostrar
export async function chat(opts, onSwitch) {
  const cfg = await settings.active();
  if (!cfg) throw new Error('Conecte uma IA primeiro.');
  const P = PROVIDERS[cfg.provider];
  const call = (model) => P.chat({ ...cfg, model, ...opts }).catch(e => { throw Object.assign(e, { provider: cfg.provider }); });
  try { return await call(cfg.model); }
  catch (e) {
    if (opts.signal?.aborted || !isModelError(e)) throw e;
    const { model } = await pickModel(cfg.provider, cfg, [cfg.model]);
    await settings.setModel(model);
    console.log(`[modelo] ${cfg.model} foi recusado; trocando para ${model}`);
    onSwitch?.(cfg.model, model);
    return call(model);
  }
}
