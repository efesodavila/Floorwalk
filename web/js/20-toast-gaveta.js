'use strict';

/* ---------- Toast ---------- */
let tt = null; const toastEl = $('#toast');
function toast(m) { toastEl.textContent = m; toastEl.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => toastEl.classList.remove('show'), 2600); }

/* ---------- Gaveta: roteiro de teste e o que mudou ---------- */
const drawer = $('#drawer');
let drawerMode = null, test = null, clockT = null;
const TASKS = [
  { t: 'Aumente a sala para que caibam mais pessoas.', ok: s => Object.keys(W.tiles).length >= s.tiles + 8 },
  { t: 'Deixe o chão de madeira.', ok: () => { const v = Object.values(W.tiles); return v.filter(m => m.startsWith('madeira')).length >= v.length * .9; } },
  { t: 'Mude a cor das paredes.', ok: s => W.wall !== s.wall },
  { t: 'Separe uma área com uma parede ou divisória.', ok: s => W.walls.some(w => !s.walls.includes(w.id)) },
  { t: 'Coloque uma mesa de reunião na sala.', ok: s => W.objects.filter(o => o.item === 'meeting').length > s.meeting },
  { t: 'Adicione uma pessoa nova e deixe ela perto do sofá.', ok: s => W.people.some(p => !s.people.includes(p.id) && W.objects.some(o => o.item === 'sofa' && Math.hypot(p.pos[0] - (o.x + dims(o)[0] / 2), p.pos[1] - (o.z + dims(o)[1] / 2)) < 3)) },
  { t: 'Abra o Ao vivo e envie um evento: coloque alguém em reunião com outra pessoa.', ok: () => sim.feed.some(e => e.st === 'reuniao' && e.src === 'manual') },
];
function fmt(sec) { const m = Math.floor(sec / 60), s = Math.floor(sec % 60); return `${m}:${String(s).padStart(2, '0')}`; }
function checkTasks() {
  if (!test || test.finished) return;
  const now = (Date.now() - test.start) / 1000;
  TASKS.forEach((k, i) => { if (test.done[i] == null && k.ok(test.base)) test.done[i] = now; });
  if (TASKS.every((_, i) => test.done[i] != null)) test.finished = now;
  if (drawerMode === 'test') renderDrawer();
}
function renderDrawer() {
  if (!drawerMode) { drawer.hidden = true; clearInterval(clockT); return; }
  drawer.hidden = false;
  if (drawerMode === 'team') { renderTeamDrawer(); drawer.querySelector('#d-close').onclick = () => { drawerMode = null; renderDrawer(); }; return; }
  if (drawerMode === 'rules') {
    if (!NAV) buildNav();
    const has = new Set(NAV.spots.map(s => s.act));
    const rows = Object.entries(RULES).map(([k, R]) => {
      const affs = [...new Set([...(R.group || []), ...(R.solo || [])])];
      const els = affs.map(f => has.has(f) ? AFFN[f] : `<span class="missing">${AFFN[f]} (falta na sala)</span>`).join(' → ') || 'Onde estiver';
      const al = Object.entries(ALIASES).filter(([, v]) => v === k).map(([a]) => a).slice(0, 4).join(', ');
      return `<tr><td><i class="chip" style="background:${R.c}">${R.n}</i><br><small style="color:var(--ink-faint)">${k}${al ? ', ' + al : ''}</small></td><td>${R.does}<br><small style="color:var(--ink-soft)">${els}</small></td></tr>`;
    }).join('');
    drawer.innerHTML = `<button type="button" class="close" id="d-close" aria-label="Fechar">✕</button><h2>Como os agentes decidem</h2>
      <p>Cada evento diz o estado de um agente. O estado define quais elementos servem, em ordem de preferência. Entre os livres, vence o lugar habitual e depois o mais perto. Reuniões levam todo o grupo para a mesma mesa.</p>
      <div style="overflow-x:auto;flex:none"><table class="rules"><thead><tr><th>Estado</th><th>O que o personagem faz</th></tr></thead><tbody>${rows}</tbody></table></div>
      <h2 style="font-size:15px">Formato do evento</h2>
      <pre>{ "agent": "Bia", "state": "trabalhando", "task": "Tela de login" }
{ "agent": "Davi", "state": "revisando", "task": "Tela de login", "with": ["Bia"] }
{ "agent": "Ana", "state": "reuniao", "with": ["Bia", "Rafa"], "group": "daily" }</pre>
      <p><b>agent</b>: nome do agente (igual ao cadastrado). <b>state</b>: um dos estados acima, em português ou inglês. <b>task</b>, <b>with</b> e <b>group</b> são opcionais. Para reproduzir um histórico, use <b>t</b> (segundos) ou <b>ts</b> (data e hora).</p>
      <h2 style="font-size:15px">Como ligar aos seus agentes</h2>
      <p>1) Tempo real por WebSocket, quando a página roda no seu servidor. 2) Dentro do seu painel, enviando <code>postMessage({ pixelHQ: evento })</code> para esta página. 3) No mesmo site, chamando <code>window.pixelHQ.emit(evento)</code>. 4) Um arquivo de log com um evento por linha, pela fonte "Arquivo de eventos".</p>`;
  } else if (drawerMode === 'changes') {
    drawer.innerHTML = `<button type="button" class="close" id="d-close" aria-label="Fechar">✕</button><h2>O que mudou no editor</h2>
    <ul class="changes">
      <li><b>Agentes reais, não rotina sorteada</b><span>Cada pessoa é um agente com papel. Eventos do tipo "Bia está trabalhando na Tela de login" viram ação: o sistema escolhe o elemento certo, explica o motivo e mostra tudo em "Eventos e decisões". Fontes: projeto demo, envio manual, arquivo de log e tempo real.</span></li>
      <li><b>Regras visíveis</b><span>O botão "Regras" mostra o que cada estado faz, quais elementos usa e quais faltam na sala.</span></li>
      <li><b>Personagens refeitos</b><span>Pixel art mais detalhada, com contorno, sete estilos de cabelo, quatro roupas, sapatos e acessórios (crachá, óculos, fone, barba). Eles andam, sentam e digitam.</span></li>
      <li><b>Modo Ao vivo com player</b><span>Play, pausa, velocidade 1×, 2× e 4×, relógio do dia com horário de almoço, nomes ligados ou desligados e a lista "Equipe agora" mostrando o que cada pessoa está fazendo. Clique num nome para a câmera seguir.</span></li>
      <li><b>Pessoas onde você quiser</b><span>Arraste qualquer pessoa na sala, no Construir ou no Ao vivo. No Ao vivo ela fica parada onde você soltou até você clicar em "Voltar à rotina".</span></li>
      <li><b>Paredes e divisórias como elemento</b><span>Oito tipos no catálogo: parede, parede com porta, parede com janela, meia-parede, vidro, vidro com porta, ripado e painel acústico. Clique no card e arraste na sala. Depois dá para mover, trocar o tipo, mudar a cor e apagar.</span></li>
      <li><b>"Não consigo aumentar a sala"</b><span>Bloco "Tamanho da sala" com + e − em cada lado, e botões + direto nas bordas. A grade de pontos mostra que dá para crescer. A sala cresce para qualquer lado.</span></li>
      <li><b>"Não consigo mudar a cor do piso"</b><span>Nove pisos prontos, na sala toda ou só numa área. As paredes da sala ganharam seis cores.</span></li>
      <li><b>"O menu é confuso"</b><span>Três abas na ordem do trabalho: Planta, Elementos, Pessoas. Catálogo com miniaturas, busca, filtros e grupos.</span></li>
      <li><b>Atalhos escondidos</b><span>Girar, Duplicar, Apagar e Cor aparecem numa barra quando você clica num item.</span></li>
      <li><b>Fora deste protótipo</b><span>A cena 3D do original e a conexão com os seus agentes de verdade. O formato do evento já está pronto para isso.</span></li>
    </ul>`;
  } else {
    const now = test ? (test.finished ?? (Date.now() - test.start) / 1000) : 0;
    drawer.innerHTML = `<button type="button" class="close" id="d-close" aria-label="Fechar">✕</button><h2>Roteiro de teste com usuário</h2>
    <p>Chame alguém que nunca viu o editor. Leia uma tarefa por vez, em voz alta, e não ajude. Anote onde a pessoa hesita ou clica errado. As tarefas são marcadas sozinhas quando concluídas.</p>
    ${test ? `<div class="clock" aria-live="off">${fmt(now)}</div>` : ''}
    <ol class="tasks">${TASKS.map((k, i) => `<li class="${test && test.done[i] != null ? 'done' : ''}"><span>${k.t}</span><time>${test && test.done[i] != null ? fmt(test.done[i]) : ''}</time></li>`).join('')}</ol>
    ${test?.finished ? `<p><b>Todas concluídas em ${fmt(test.finished)}.</b> Se alguma tarefa levou mais de 1 minuto, aquele ponto ainda está confuso.</p>` : ''}
    <div class="row"><button type="button" class="primary" id="d-start">${test ? 'Recomeçar teste' : 'Começar teste'}</button></div>
    <p style="font-size:12px">Começar o teste carrega o modelo "Sala pequena". A sala atual pode ser recuperada com Desfazer.</p>`;
    drawer.querySelector('#d-start').onclick = () => {
      loadWorld(tplSala(), 'Teste iniciado');
      sim.playedFor = 0;
      test = { start: Date.now(), done: {}, base: { tiles: Object.keys(W.tiles).length, wall: W.wall, meeting: W.objects.filter(o => o.item === 'meeting').length, people: W.people.map(p => p.id), walls: W.walls.map(w => w.id) } };
      setTab('planta'); renderDrawer();
    };
    clearInterval(clockT);
    if (test && !test.finished) clockT = setInterval(() => { const c = drawer.querySelector('.clock'); if (c) c.textContent = fmt((Date.now() - test.start) / 1000); }, 1000);
  }
  drawer.querySelector('#d-close').onclick = () => { drawerMode = null; renderDrawer(); };
}
$('#open-test').onclick = () => { drawerMode = drawerMode === 'test' ? null : 'test'; renderDrawer(); };
$('#open-rules').onclick = () => { drawerMode = drawerMode === 'rules' ? null : 'rules'; renderDrawer(); };
$('#open-changes').onclick = () => { drawerMode = drawerMode === 'changes' ? null : 'changes'; renderDrawer(); };

// com o 3D, os botões comandam a câmera 3D
const cam3d = () => window.R3D?.active?.() && window.R3D.zoomAt;
$('#zoom-in').onclick = () => cam3d() ? R3D.zoomAt(1.25, VW / 2, VH / 2) : zoomAt(1.25, VW / 2, VH / 2);
$('#zoom-out').onclick = () => cam3d() ? R3D.zoomAt(1 / 1.25, VW / 2, VH / 2) : zoomAt(1 / 1.25, VW / 2, VH / 2);
$('#fit').onclick = () => { if (cam3d()) R3D.fit(); fit(); };
