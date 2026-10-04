// glow.js: la luz del raton del sitio antiguo (un foco azul amplio y tenue que sigue al puntero), compuesta en GPU.
// La capa fija se crea en el primer movimiento de raton que pase la puerta (en tactil nunca existe y no pesa en el
// HTML) y solo se mueve con translate3d en un unico rAF que se para al llegar: nada se repinta al mover el raton.
// Se apaga al salir de la ventana, con blur, con la pestana oculta y con ficha o menu abiertos (site.css la oculta
// al instante; el siguiente movimiento la da por apagada) y renace bajo el puntero al volver. Cada frame que la mueve,
// y al apagarse, avisa con el evento mtc:glow en document ({ x, y, on }, px de cliente): lo usa secret.js.
import { GLOW_TAU, followStep, hasArrived, glowGate } from './play/glow-follow.js';

export function initGlow(host = document.body) {
  if (!host) return null;
  const html = document.documentElement;
  const reducedMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  const coarseMQ = window.matchMedia('(hover: none)');

  let root = null;      // .cursor-glow: capa fija a pantalla completa
  let pos = null;       // .cursor-glow__pos: lo unico que se mueve
  let state = 'absent'; // absent | on | off
  let cur = null;       // posicion pintada (px de cliente)
  let target = null;    // ultima posicion del puntero
  let raf = 0;
  let last = 0;

  // tactil: sin hover y con pantalla tactil. Un navegador que declara (hover: none) sin puntos tactiles no tiene
  // raton detectado (Chrome headless de las capturas, escritorios remotos); si aun asi llega un pointermove de
  // raton, lo hay y la luz puede encenderse.
  const coarse = () => coarseMQ.matches && navigator.maxTouchPoints > 0;
  const gate = (pointerType) => glowGate({
    coarse: coarse(),
    pointerType,
    hidden: document.hidden,
    dialogOpen: html.classList.contains('pdialog-open'),
    sheetOpen: html.classList.contains('sheet-open'),
  });

  function build() {
    root = document.createElement('div');
    root.className = 'cursor-glow';
    root.setAttribute('aria-hidden', 'true');
    pos = document.createElement('div');
    pos.className = 'cursor-glow__pos';
    const disc = document.createElement('div');
    disc.className = 'cursor-glow__disc';
    pos.append(disc);
    root.append(pos);
    host.append(root);
    void getComputedStyle(root).opacity; // estilo de partida (apagada) para que el primer encendido tambien funda
  }
  const emit = (on) => document.dispatchEvent(new CustomEvent('mtc:glow', { detail: { x: cur ? cur.x : null, y: cur ? cur.y : null, on } }));
  function place(p) {
    pos.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`;
    emit(true);
  }
  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    last = 0;
  }
  function tick(now) {
    raf = 0;
    if (state !== 'on' || !target) return;
    const dt = last ? now - last : 1000 / 60;
    last = now;
    cur = followStep(cur, target, dt, reducedMQ.matches ? 0 : GLOW_TAU);
    if (hasArrived(cur, target)) cur = { x: target.x, y: target.y };
    place(cur);
    if (cur.x !== target.x || cur.y !== target.y) raf = requestAnimationFrame(tick);
    else last = 0;
  }
  function on(x, y, snap) {
    target = { x, y };
    if (!root) build();
    if (state !== 'on' || snap) {
      // nace (o renace) bajo el puntero: nunca barre desde el centro ni desde donde se apago
      stop();
      cur = { x, y };
      place(cur);
      if (state !== 'on') {
        root.classList.add('is-on');
        state = 'on';
      }
      return;
    }
    if (!raf) raf = requestAnimationFrame(tick);
  }
  function off() {
    if (state !== 'on') return;
    stop();
    state = 'off';
    root.classList.remove('is-on');
    emit(false);
  }

  function onMove(e) {
    if (!gate(e.pointerType)) { off(); return; }
    on(e.clientX, e.clientY, false);
  }
  const onVisibility = () => { if (document.hidden) off(); };
  window.addEventListener('pointermove', onMove, { passive: true });
  html.addEventListener('mouseleave', off);
  window.addEventListener('blur', off);
  document.addEventListener('visibilitychange', onVisibility);

  return {
    get state() { return state; },
    get position() { return cur ? { x: Math.round(cur.x * 10) / 10, y: Math.round(cur.y * 10) / 10 } : null; },
    // gancho de desarrollo y capturas: como un movimiento de raton real (pasa la misma puerta); snap sin cola
    moveTo(x, y, { snap = false } = {}) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return state;
      if (!gate('mouse')) { off(); return state; }
      on(x, y, snap);
      return state;
    },
    hide() { off(); },
    destroy() {
      stop();
      window.removeEventListener('pointermove', onMove);
      html.removeEventListener('mouseleave', off);
      window.removeEventListener('blur', off);
      document.removeEventListener('visibilitychange', onVisibility);
      emit(false);
      root?.remove();
      root = null;
      pos = null;
      cur = null;
      target = null;
      state = 'absent';
    },
  };
}
