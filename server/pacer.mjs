// Segura cada estado na tela por um tempo mínimo, por agente.
// Os hooks do SDK disparam em milissegundos; sem isso o personagem
// trocaria de estado antes de sair do lugar.
export function createPacer(send, minDwellMs) {
  const lanes = new Map(); // agente -> { until, queue, timer }
  const lane = (k) => { if (!lanes.has(k)) lanes.set(k, { until: 0, queue: [], timer: null }); return lanes.get(k); };

  function flush(k) {
    const L = lane(k); L.timer = null;
    const now = Date.now();
    if (now < L.until) { L.timer = setTimeout(() => flush(k), L.until - now); return; }
    const m = L.queue.shift(); if (!m) return;
    const { hold, ...out } = m; send(out); L.until = Date.now() + (hold ?? minDwellMs); L.shown = { state: out.state, task: out.task };
    if (L.queue.length) L.timer = setTimeout(() => flush(k), L.until - Date.now());
  }

  return {
    // hold: tempo mínimo deste estado (padrão minDwellMs)
    push(m, hold) {
      const L = lane(m.agent);
      // mesmo estado que já está na tela e nada na fila: só o texto muda, vai na hora e não estica o tempo mínimo
      if (!L.queue.length && L.shown?.state === m.state && L.shown?.task === m.task) { send(m); return; }
      const last = L.queue[L.queue.length - 1];
      // estado repetido na fila: só atualiza o texto
      if (last && last.state === m.state && last.task === m.task) { L.queue[L.queue.length - 1] = { ...m, hold }; }
      else L.queue.push({ ...m, hold });
      // fila longa demais: descarta intermediários, mantém o primeiro e os 2 últimos
      if (L.queue.length > 4) L.queue.splice(1, L.queue.length - 3);
      if (!L.timer) flush(m.agent);
    },
    // espera todas as filas esvaziarem (usado no fim da tarefa)
    async drain() {
      for (;;) {
        const busy = [...lanes.values()].some(L => L.queue.length || Date.now() < L.until);
        if (!busy) return;
        await new Promise(r => setTimeout(r, 200));
      }
    },
  };
}
