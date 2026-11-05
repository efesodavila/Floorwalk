'use strict';

fixDoor(W);
loadStep(.15, 'Montando a sala…');

/* ---------- Início ---------- */
resize(); applyUI(); renderBrand(); setTab('planta'); renderFoot(); fit(); requestAnimationFrame(frame);
if (window.FLOORWALK_BRIDGE && !VITRINE) {
  document.body.classList.add('booting');
  const wsu = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/events';
  sim.source = 'tempo_real'; sim.wsUrl = wsu; $('#pl-source').value = 'tempo_real'; setMode('live'); connectWS(wsu);
  setupInit();
}
renderMenu();
if (document.fonts?.ready) document.fonts.ready.then(dirty);
