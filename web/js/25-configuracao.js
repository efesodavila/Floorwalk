'use strict';

/* ---------- Configuração inicial: escolher a IA e testar a conexão ----------
   Só aparece quando a página roda com o servidor (window.PIXELHQ_BRIDGE).
   A chave vai uma única vez para o servidor local, que testa, guarda e nunca a devolve. */
const setupEl = $('#setup');
const SETUP_DESC = {
  openai: 'Modelos GPT. Precisa de chave de API; cobrado por uso.',
  anthropic: 'Modelos Claude. Precisa de chave de API; cobrado por uso.',
  ollama: 'Modelos abertos rodando no seu computador. Grátis, sem chave.',
};
const setupState = { view: null, provider: null };

async function setupApi(path, body) {
  const r = await fetch(path, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {});
  const data = await r.json().catch(() => ({}));
  if (!r.ok && !('ok' in data)) throw new Error(data.error || `Erro ${r.status}`);
  return data;
}
function setupStatus(text, kind = '') { const el = $('#setup-status'); el.textContent = text; el.className = 'setup-status' + (kind ? ' ' + kind : ''); }
const setupProv = () => setupState.view.providers.find(p => p.id === setupState.provider);

function renderSetupProviders() {
  const v = setupState.view;
  $('#setup-prov').innerHTML = '<legend>Provedor</legend>' + v.providers.map(p => {
    const tag = p.key?.set ? `<span class="tag">chave salva ${escapeHTML(p.key.hint || '')}</span>` : (v.provider === p.id && v.configured ? '<span class="tag">em uso</span>' : '');
    return `<label><input type="radio" name="prov" value="${p.id}" ${p.id === setupState.provider ? 'checked' : ''}><span><b>${escapeHTML(p.name)}</b><small>${SETUP_DESC[p.id] || ''}</small></span>${tag}</label>`;
  }).join('');
  $('#setup-prov').querySelectorAll('input').forEach(i => i.onchange = () => { setupState.provider = i.value; renderSetupFields(); });
}
function renderSetupFields() {
  const p = setupProv(), f = $('#setup-fields');
  if (p.needsKey) {
    const saved = p.key?.set ? `Já existe uma chave ${p.key.source === 'env' ? 'no arquivo .env' : 'salva'} (${escapeHTML(p.key.hint)}). Deixe em branco para usá-la.` : 'Começa com “sk-”.';
    f.innerHTML = `<label class="f">Chave de API<input class="t" id="setup-key" type="password" spellcheck="false" autocomplete="off" placeholder="${p.key?.set ? 'Usar a chave salva' : 'Cole a chave aqui'}"></label>
      <p class="hint">${saved} Onde conseguir: <a href="https://${p.keyHelp}" target="_blank" rel="noopener">${p.keyHelp}</a></p>`;
  } else {
    f.innerHTML = `<label class="f">Endereço do Ollama<input class="t" id="setup-url" type="url" spellcheck="false" value="${escapeHTML(p.baseUrl || p.defaultBaseUrl || '')}"></label>
      <p class="hint">Instale em <a href="https://${p.keyHelp}" target="_blank" rel="noopener">${p.keyHelp}</a>, deixe o aplicativo aberto e baixe um modelo, por exemplo: <code>ollama pull llama3.2</code></p>`;
  }
  setupStatus('');
  const k = $('#setup-key'), u = $('#setup-url');
  for (const el of [k, u]) if (el) el.oninput = () => setupStatus('');
}
function setupInputs() {
  const k = $('#setup-key')?.value.trim(), u = $('#setup-url')?.value.trim();
  return { provider: setupState.provider, ...(k ? { apiKey: k } : {}), ...(u !== undefined ? { baseUrl: u } : {}) };
}
// Conectar: o servidor confere a chave, testa os modelos da conta e fica com o primeiro que responde.
async function setupSave(e) {
  e.preventDefault();
  const btn = $('#setup-save'); btn.disabled = true;
  setupStatus(`Conectando com ${setupProv().name} e escolhendo o modelo…`, 'busy');
  try {
    const r = await setupApi('/api/settings', setupInputs());
    if (!r.ok) { setupStatus(r.error, 'err'); return; }
    setupState.view = { ...r.settings, demo: setupState.view.demo };
    renderAIButton(); renderMenu();
    toast(`IA conectada: ${setupProv().name}`);
    if (setupState.office) closeSetup(); else openOfficeStep();
  } catch { setupStatus('O servidor do Pixel HQ não respondeu. Ele ainda está rodando?', 'err'); }
  finally { btn.disabled = false; }
}
function openSetup(canCancel, notice) {
  setStep(1);
  const v = setupState.view;
  setupState.provider = v.provider || 'openai';
  renderSetupProviders(); renderSetupFields();
  $('#setup-cancel').hidden = !canCancel; setupEl.hidden = false;
  if (notice) setupStatus(notice + ' Clique em Conectar para tentar de novo.', 'err');
  (setupEl.querySelector('input:checked') || setupEl.querySelector('input'))?.focus();
}
function closeSetup() { setupEl.hidden = true; }
// o servidor pode trocar o modelo sozinho: atualiza o que a página mostra
async function refreshSettings() { try { setupState.view = { ...(await setupApi('/api/settings')) }; renderAIButton(); renderMenu(); } catch {} }
function renderAIButton() {
  const v = setupState.view, b = $('#ai-btn'); if (!v) return;
  b.hidden = false;
  b.textContent = v.configured ? `Trocar a IA (agora: ${aiLabel()})` : 'Conectar uma IA';
  b.title = v.configured ? `${v.providers.find(p => p.id === v.provider)?.name} · ${v.model}. Clique para trocar.` : 'Escolher a IA';
}
$('#setup-form').onsubmit = setupSave;
$('#setup-cancel').onclick = closeSetup;
$('#ai-btn').onclick = () => openSetup(!!setupState.view?.configured);
setupEl.addEventListener('keydown', (e) => e.stopPropagation());
// Esc fecha (quando há uma IA já configurada), mesmo com o foco fora do formulário
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !setupEl.hidden && !$('#setup-cancel').hidden) { e.preventDefault(); closeSetup(); } }, true);
// nome curto da IA em uso, para os textos da página
function aiLabel() {
  const v = setupState.view; if (!v?.configured) return 'IA';
  return v.providers.find(p => p.id === v.provider)?.name.split(' ')[0] || 'IA';
}

async function setupInit() {
  loadStep(.4, 'Conectando ao servidor…');
  try { setupState.view = await setupApi('/api/settings'); setupState.office = (await setupApi('/api/office')).office; }
  catch { document.body.classList.remove('booting'); return; }
  renderAIButton();
  // servidor rodando código velho (arquivos mudaram depois que ele subiu): avisa, senão as melhorias não valem
  fetch('/api/stale').then(r => r.json()).then(s => { if (s?.stale) toast('O servidor está com código antigo: pare (Ctrl+C) e rode npm start de novo para as melhorias valerem.'); }).catch(() => {});
  // o escritório salvo no servidor manda: outro navegador ou um escritório novo recarregam a planta
  // só um escritório NOVO troca a sala: a sala que o dono montou nunca é refeita sozinha
  if (setupState.office && W.officeId !== setupState.office.createdAt) applyOffice(setupState.office);
  // primeira vez neste navegador com um negócio pronto (ex.: criado antes do tour existir): abre no Construir com o tour
  else if (setupState.office) { let seen = false; try { seen = localStorage.getItem('pixelhq.tour.v1') === '1'; } catch {} if (!seen) { setMode('build'); tourMaybe(); } }
  reviewCustomFurniture(setupState.office);
  document.body.classList.toggle('has-office', !!setupState.office);
  renderMenu();
  document.body.classList.remove('booting');
  if (!setupState.view.configured) openSetup(false);
  else if (setupState.view.modelBroken) openSetup(true, setupState.view.modelBroken.reason);
  else if (!setupState.office) openOfficeStep();
}

/* ---------- Etapa 2: descrever o serviço; a IA monta equipe e áreas ---------- */
const OFFICE_EXAMPLES = [
  ['Agência de marketing', 'Agência de marketing digital que cria posts, vídeos curtos e campanhas de anúncios para pequenas lojas.'],
  ['Clínica de nutrição', 'Clínica de nutrição que faz consultas, monta planos alimentares e acompanha pacientes pelo WhatsApp.'],
  ['Contabilidade', 'Escritório de contabilidade que cuida de impostos, folha de pagamento e abertura de empresas.'],
  ['Software house', 'Software house que desenvolve sites e aplicativos sob encomenda e publica as atualizações.'],
];
function setStep(n) {
  const li = setupEl.querySelectorAll('.setup-steps li');
  li.forEach((x, i) => { x.toggleAttribute('aria-current', i === n - 1); if (i === n - 1) x.setAttribute('aria-current', 'step'); x.classList.toggle('done', i < n - 1); });
  $('#setup-form').hidden = n !== 1; $('#office-form').hidden = n !== 2;
  $('#setup-title').textContent = n === 1 ? 'Qual IA vai trabalhar no seu escritório?' : 'Conte o que o seu negócio faz';
  setupEl.querySelector('.setup-lead').textContent = n === 1
    ? 'Cada personagem será um agente dessa IA. A chave fica guardada só no servidor, neste computador.'
    : `A IA vai montar a equipe, os papéis e as áreas do escritório. Usando ${aiLabel()} · ${setupState.view?.model || ''}.`;
}
function openOfficeStep() {
  setStep(2); setupEl.hidden = false;
  $('#office-back').textContent = setupState.office ? 'Cancelar' : 'Trocar a IA';
  if (setupState.office) officeStatus('Montar de novo substitui a equipe e a sala atuais.');
  $('#office-ex').innerHTML = OFFICE_EXAMPLES.map(([t], i) => `<button type="button" data-ex="${i}">${escapeHTML(t)}</button>`).join('');
  $('#office-ex').querySelectorAll('[data-ex]').forEach(b => b.onclick = () => { $('#office-desc').value = OFFICE_EXAMPLES[b.dataset.ex][1]; $('#office-desc').focus(); });
  if (!setupState.office) { $('#office-status').textContent = ''; $('#office-status').className = 'setup-status'; }
  $('#office-desc').focus();
}
function officeStatus(t, k = '') { const el = $('#office-status'); el.textContent = t; el.className = 'setup-status' + (k ? ' ' + k : ''); }
$('#office-back').onclick = () => { if (setupState.office) closeSetup(); else { setStep(1); openSetup(false); } };
$('#office-form').onsubmit = async (e) => {
  e.preventDefault();
  const desc = $('#office-desc').value.trim();
  if (desc.length < 15) { officeStatus('Descreva o serviço com pelo menos uma frase.', 'err'); return; }
  const btn = $('#office-go'); btn.disabled = true; $('#office-back').disabled = true;
  const t0 = Date.now(), tick = setInterval(() => officeStatus(`Montando a equipe… ${Math.round((Date.now() - t0) / 1000)} s (costuma levar de 10 a 60 s)`, 'busy'), 1000);
  officeStatus('Montando a equipe…', 'busy');
  try {
    const r = await setupApi('/api/office/plan', { description: desc });
    clearInterval(tick);
    if (!r.ok) { officeStatus(r.error, 'err'); return; }
    setupState.office = r.office; document.body.classList.add('has-office'); renderMenu(); closeSetup(); applyOffice(r.office); reviewCustomFurniture(r.office);
  } catch (err) { clearInterval(tick); officeStatus(err.message || 'O servidor do Pixel HQ não respondeu.', 'err'); }
  finally { btn.disabled = false; $('#office-back').disabled = false; }
};
