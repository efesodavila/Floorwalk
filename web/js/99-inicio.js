'use strict';

// móveis criados pela IA neste escritório precisam existir no catálogo antes do primeiro desenho
for (const c of W.custom || []) registerCustom(c);
fixDoor(W);
loadStep(.15, 'Montando a sala…');

/* ---------- Início ---------- */
resize(); applyUI(); renderBrand(); setTab('planta'); renderFoot(); fit(); requestAnimationFrame(frame);
if (window.PIXELHQ_BRIDGE) {
  document.body.classList.add('booting');
  const wsu = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/events';
  sim.source = 'tempo_real'; sim.wsUrl = wsu; $('#pl-source').value = 'tempo_real'; setMode('live'); connectWS(wsu);
  $('#ask-in').placeholder = `Descreva uma tarefa para a equipe. Ex.: ${W.officeId && W.demo?.tasks?.[0] ? W.demo.tasks[0] : 'escrever um README para o projeto'}`;
  setupInit();
}
renderMenu();
if (document.fonts?.ready) document.fonts.ready.then(dirty);
