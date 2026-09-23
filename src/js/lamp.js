// lamp.js: la lampara del hero. La cadena es un <button> real colocado sobre el dibujo del escritorio
// (src/partials/desk.svg). A oscuras Marco programa: el monitor es la unica luz, el codigo se va escribiendo y
// las manos teclean. Al tirar, la cadena baja y vuelve (WAAPI), la lampara se enciende en el fondo del tiron
// (.is-lit, como el clic de un interruptor) y Marco hace una pausa encadenada en data-pose:
// typing -> turn (gira la cabeza hacia la lampara) -> reach (el brazo va a la taza) -> hold (la levanta).
// Otro tiron apaga y deshace la pausa en orden inverso hasta volver a programar. Cada paso espera a que acaben
// las transiciones CSS que lanza (getAnimations + finished), asi que un tiron a mitad invierte desde donde este.
// Con prefers-reduced-motion las dos poses cambian de golpe. Maquina de estados en data-lamp:
// off -> pulling -> on -> pulling -> off. No se guarda: cada visita empieza a oscuras.

const EASE_IN = 'cubic-bezier(.4,0,1,1)';
const EASE_OUT = 'cubic-bezier(.2,.7,.2,1)';
const VIEW_W = 1000; // ancho del viewBox de desk.svg
const PULL_PX = 13; // lo que baja la cadena en pantalla
const PULL_MAX_UNITS = 42; // tope en unidades del viewBox (en movil la cadena es corta)
const HINT_DELAY = 1800;
const HINT_KEY = 'play.lamp.hint';
const POSES = ['typing', 'turn', 'reach', 'hold'];
const STEP_MS = { typing: 400, turn: 450, reach: 450, hold: 280 }; // respaldo si no hay getAnimations (igual que el CSS)
const REACT_MS = 90; // lo que tarda Marco en darse cuenta de que ha cambiado la luz

function storage(kind) {
  try { return window[kind]; } catch { return null; }
}
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

export function initLamp(root, { i18n } = {}) {
  if (!root) return null;
  const btn = root.querySelector('#lamp-pull');
  const hint = root.querySelector('#lamp-hint');
  const svg = root.querySelector('.hero__desk-art svg');
  const cord = svg?.querySelector('.desk__cord');
  const pullPart = svg?.querySelector('.desk__cord-pull');
  if (!btn || !svg || !cord || !pullPart) return null;

  const reducedMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  const canAnimate = () => 'animate' in Element.prototype && !reducedMQ.matches;
  const t = (k) => (i18n ? i18n.t(k) : k);

  let state = 'off';
  let lit = false;
  let pulls = 0;
  let running = [];
  let settling = null;
  let hintTimer = 0;
  let hintIO = null;
  let poseIdx = 0;
  let choreo = 0; // generacion de la coreografia: un tiron nuevo deja obsoleta la que estuviera en curso
  let snapFrame = 0;

  // ---------- estado visible ----------
  function syncLabel() {
    const key = lit ? 'hero.lamp.off' : 'hero.lamp.on';
    btn.setAttribute('aria-pressed', String(lit));
    btn.dataset.i18nAttr = `aria-label:${key}`; // i18n.apply lo reescribe al cambiar de idioma
    btn.setAttribute('aria-label', t(key));
  }
  function setState(next) {
    state = next;
    root.dataset.lamp = next;
  }
  function setLit(on) {
    lit = on;
    root.classList.toggle('is-lit', on);
    syncLabel();
  }
  function stopAnimations() {
    for (const a of running.splice(0)) a.cancel();
  }
  function track(anim) {
    running.push(anim);
    anim.finished.then(() => { running = running.filter((a) => a !== anim); }, () => {});
    return anim;
  }

  // ---------- la pausa: poses encadenadas (el CSS define cada pose y sus tiempos) ----------
  function setPose(i) {
    poseIdx = i;
    root.dataset.pose = POSES[i];
  }
  // espera a las transiciones CSS en curso del dibujo (getAnimations recalcula antes los estilos); las
  // interrumpidas por un tiron nuevo tambien cuentan como acabadas
  function transitionsDone(pose) {
    if (typeof svg.getAnimations !== 'function') return sleep(STEP_MS[pose]);
    const list = svg.getAnimations({ subtree: true }).filter((a) => typeof a.transitionProperty === 'string');
    return Promise.allSettled(list.map((a) => a.finished));
  }
  async function choreograph(toLit) {
    const my = ++choreo;
    const target = toLit ? POSES.length - 1 : 0;
    await sleep(REACT_MS);
    while (my === choreo && poseIdx !== target) {
      setPose(poseIdx + (target > poseIdx ? 1 : -1));
      await transitionsDone(POSES[poseIdx]);
    }
  }
  // cambio de pose sin transiciones (arranque, ?lamp=on, reduced motion)
  function snapPose(i) {
    choreo++;
    cancelAnimationFrame(snapFrame);
    root.classList.add('is-snap');
    setPose(i);
    void getComputedStyle(svg.querySelector('.desk__head') || svg).transform; // aplica la pose ya, con .is-snap puesto
    snapFrame = requestAnimationFrame(() => root.classList.remove('is-snap'));
  }

  // ---------- tiron ----------
  function pullUnits() {
    const w = svg.getBoundingClientRect().width || VIEW_W;
    return Math.min(PULL_PX * (VIEW_W / w), PULL_MAX_UNITS);
  }
  // la cadena queda oscilando un poco tras soltarla (solo al encender: apagada ya la mueve el bucle CSS)
  function settle() {
    settling = track(cord.animate([
      { transform: 'rotate(0deg)' },
      { transform: 'rotate(3.2deg)', offset: 0.18 },
      { transform: 'rotate(-2.2deg)', offset: 0.42 },
      { transform: 'rotate(1.2deg)', offset: 0.66 },
      { transform: 'rotate(-0.5deg)', offset: 0.86 },
      { transform: 'rotate(0deg)' },
    ], { duration: 1500, easing: 'ease-in-out' }));
  }
  async function pull() {
    if (state === 'pulling') return state;
    pulls++;
    hideHint();
    const target = !lit;
    if (!canAnimate()) return toggle(target);
    settling?.cancel(); // si aun oscilaba, el tiron la endereza
    settling = null;
    setState('pulling');
    const dy = pullUnits();
    try {
      const down = track(pullPart.animate(
        [{ transform: 'translateY(0px)' }, { transform: `translateY(${dy}px)` }],
        { duration: 100, easing: EASE_IN, fill: 'forwards' },
      ));
      await down.finished;
      setLit(target); // el clic: la luz cambia en el fondo del recorrido
      choreograph(target); // y Marco reacciona: pausa con la taza, o vuelta al teclado
      const up = track(pullPart.animate(
        [{ transform: `translateY(${dy}px)` }, { transform: 'translateY(0px)' }],
        { duration: 140, easing: EASE_OUT },
      ));
      down.cancel();
      await up.finished;
    } catch {
      return state; // cancelado por toggle() o destroy()
    }
    setState(lit ? 'on' : 'off');
    if (lit) settle();
    return state;
  }
  function toggle(on = !lit) {
    stopAnimations();
    setLit(Boolean(on));
    snapPose(lit ? POSES.length - 1 : 0);
    setState(lit ? 'on' : 'off');
    return state;
  }

  // ---------- pista: una vez por sesion, ~1,8 s despues de que el escritorio este a la vista ----------
  function hideHint() {
    clearTimeout(hintTimer);
    hintIO?.disconnect();
    if (hint) hint.hidden = true;
  }
  function showHintOnce() {
    let seen = false;
    try { seen = storage('sessionStorage')?.getItem(HINT_KEY) === '1'; } catch { /* sin almacenamiento */ }
    if (seen || !hint || !('IntersectionObserver' in window)) return;
    hintIO = new IntersectionObserver((entries) => {
      clearTimeout(hintTimer);
      if (!entries.some((e) => e.isIntersecting)) return;
      hintTimer = setTimeout(() => {
        if (pulls || lit || document.hidden) return;
        hint.hidden = false;
        hintIO?.disconnect();
        try { storage('sessionStorage')?.setItem(HINT_KEY, '1'); } catch { /* nada */ }
      }, HINT_DELAY);
    }, { threshold: 0.5 });
    hintIO.observe(root);
  }

  // ---------- eventos ----------
  const onClick = (e) => { e.preventDefault(); pull(); };
  const onLang = () => syncLabel();
  btn.addEventListener('click', onClick);
  document.addEventListener('mtc:lang', onLang);

  // ---------- arranque ----------
  toggle(false);
  btn.hidden = false;
  showHintOnce();

  return {
    get state() { return state; },
    get lit() { return lit; },
    get pose() { return POSES[poseIdx]; },
    toggle,
    pull,
    destroy() {
      stopAnimations();
      choreo++;
      cancelAnimationFrame(snapFrame);
      hideHint();
      btn.removeEventListener('click', onClick);
      document.removeEventListener('mtc:lang', onLang);
      btn.hidden = true;
    },
  };
}
