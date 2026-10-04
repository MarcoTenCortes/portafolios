// pausable-timer.js: temporizador que se puede pausar (pestana oculta) y reanudar con el tiempo restante. Es timer()
// de dog.js con `hidden` inyectado en vez de leer document (asi se prueba sin DOM): nace pausado si hidden es true y
// el visibilitychange del llamador lo reanuda.
export function pausableTimer(fn, ms, { hidden = false } = {}) {
  let id = setTimeout(fire, ms);
  let start = performance.now();
  let left = ms;
  let done = false;
  function fire() { done = true; id = null; fn(); }
  const t = {
    pause() { if (done || id == null) return; clearTimeout(id); id = null; left = Math.max(50, left - (performance.now() - start)); },
    resume() { if (done || id != null) return; start = performance.now(); id = setTimeout(fire, left); },
    cancel() { done = true; if (id != null) clearTimeout(id); id = null; },
    get done() { return done; },
  };
  if (hidden) t.pause();
  return t;
}
