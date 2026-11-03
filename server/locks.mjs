// Travas por nome (agente): cada agente faz uma coisa por vez, mesmo com várias tarefas rodando.
// lock(['Ana', 'Bia']) → espera todos os nomes ficarem livres e devolve release(). Pedir os nomes sempre em
// ordem (o runner ordena) e de uma vez só evita impasse entre duas tarefas.
export function createLocks() {
  const busy = new Set(), waiting = [];
  const free = (names) => names.every(n => !busy.has(n));
  function pump() {
    for (let i = 0; i < waiting.length;) {
      const w = waiting[i];
      if (free(w.names)) { waiting.splice(i, 1); w.names.forEach(n => busy.add(n)); w.resolve(release(w.names)); }
      else i++;
    }
  }
  const release = (names) => { let done = false; return () => { if (done) return; done = true; names.forEach(n => busy.delete(n)); pump(); }; };
  function lock(names) {
    names = [...new Set(names)];
    return new Promise(resolve => { waiting.push({ names, resolve }); pump(); });
  }
  return { lock, busy: () => [...busy] };
}
