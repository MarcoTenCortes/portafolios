// rig.js: el café de Marco. Máquina de estados idle -> warned -> angry -> spilled -> refilling -> idle.
// Coordenadas en unidades del viewBox (1000 x 1100). Listas de transformación siempre translate-primero.

const NEXT = { idle: 'warned', warned: 'angry', angry: 'spilled', spilled: 'refilling' };
const DEV = import.meta.env.DEV;
const EASE_OUT = 'cubic-bezier(.2,.7,.2,1)';
const EASE_FALL = 'cubic-bezier(.4,0,.6,1)';
const LAYER_URLS = import.meta.glob('../assets/img/rig/*.webp', { eager: true, query: '?url', import: 'default' });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
function storage(kind) {
  try { return window[kind]; } catch { return null; }
}
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
function readSpills() {
  try {
    const raw = storage('localStorage')?.getItem('rig.spills');
    const v = raw ? JSON.parse(raw) : null;
    if (v && v.day === today() && Number.isFinite(v.n)) return v;
  } catch { /* ignorar */ }
  return { n: 0, day: today() };
}
function writeSpills(v) {
  try { storage('localStorage')?.setItem('rig.spills', JSON.stringify(v)); } catch { /* ignorar */ }
}

export function initRig(root, { i18n }) {
  if (!root) return null;
  const q = (sel) => root.querySelector(sel);
  const svg = q('.rig__stage');
  const hit = q('#rig-hit');
  const hint = q('#rig-hint');
  const count = q('#rig-count');
  const status = q('#rig-status');
  const key = q('#rig-key');
  const resetBtn = q('#rig-reset');
  const cup = q('#cup');
  const hand = q('#hand');
  const puddle = q('#puddle');
  const eyes = q('#eyes');
  const lids = q('#lids');
  const section = document.getElementById('sobre-mi') || root;

  const reducedMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  const coarseMQ = window.matchMedia('(hover: none)');
  const hasWAAPI = 'animate' in Element.prototype;
  const reduced = () => reducedMQ.matches;
  const canAnimate = () => hasWAAPI && !reduced();

  let state = 'idle';
  let busy = false;
  let holdTimer = null;
  let holdLeft = 0;
  let holdStart = 0;
  let offscreenSince = 0;
  let blinking = false;
  let blinkTimer = null;
  let spills = readSpills();
  const t = (k, vars) => i18n.t(k, vars);

  // ---------- capas: una sola resolucion segun la densidad de pantalla, y precarga defensiva ----------
  const images = [...svg.querySelectorAll('image[data-layer]')];
  const suffix = window.devicePixelRatio >= 1.5 ? '@2x' : '';
  for (const img of images) {
    const url = LAYER_URLS[`../assets/img/rig/${img.dataset.layer}${suffix}.webp`] || LAYER_URLS[`../assets/img/rig/${img.dataset.layer}.webp`];
    if (url) img.setAttribute('href', url);
  }
  const urls = [...new Set(images.map((img) => img.getAttribute('href')).filter(Boolean))];
  const preload = Promise.allSettled(urls.map((url) => new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(url);
    im.onerror = () => reject(new Error(url));
    im.src = url;
  })));

  // ---------- estado ----------
  function announce(next) {
    let k = `coffee.status.${next}`;
    if (next === 'spilled' && spills.n >= 3) k = window.innerWidth < 360 ? 'coffee.status.spilled3_short' : 'coffee.status.spilled3';
    status.textContent = t(k);
  }
  function renderCount() {
    count.hidden = spills.n === 0;
    count.textContent = t('coffee.counter', { n: spills.n });
    root.dataset.spills = String(spills.n);
  }
  function setBusy(v) { busy = v; root.dataset.busy = String(v); }

  async function go(next) {
    clearTimeout(holdTimer);
    holdTimer = null;
    setBusy(true);
    state = next;
    root.dataset.state = next;
    if (next === 'spilled') {
      spills = { n: (spills.day === today() ? spills.n : 0) + 1, day: today() };
      writeSpills(spills);
      renderCount();
    }
    announce(next);
    resetBtn.hidden = next !== 'spilled';
    try { await EFFECTS[next](); } finally { setBusy(false); }
    if (next === 'spilled') {
      holdLeft = spills.n >= 3 ? 6000 : 4500;
      armHold();
      if (root.dataset.input === 'keyboard') resetBtn.focus({ preventScroll: true });
    }
    if (next === 'refilling') go('idle');
  }
  function activate() {
    if (busy || !NEXT[state]) return;
    hideHint();
    go(NEXT[state]);
  }
  function armHold() {
    clearTimeout(holdTimer);
    holdStart = performance.now();
    holdTimer = setTimeout(() => { if (state === 'spilled' && !busy) go('refilling'); }, holdLeft);
  }
  function pauseHold() {
    if (!holdTimer) return;
    clearTimeout(holdTimer);
    holdTimer = null;
    holdLeft = Math.max(400, holdLeft - (performance.now() - holdStart));
  }

  // ---------- efectos ----------
  function animateOr(el, keyframes, options, fallbackMs) {
    if (canAnimate()) return el.animate(keyframes, options);
    return { finished: wait(fallbackMs ?? options.duration ?? 0), cancel() {}, commitStyles() {} };
  }
  function blinkOnce() {
    if (blinking || reduced() || !hasWAAPI) return Promise.resolve();
    blinking = true;
    const a = lids.animate([{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)', offset: 0.5 }, { transform: 'scaleY(0)' }], { duration: 140, easing: 'ease-in-out' });
    return a.finished.then(() => { blinking = false; }, () => { blinking = false; });
  }
  function scheduleBlink() {
    clearTimeout(blinkTimer);
    blinkTimer = setTimeout(async () => {
      if (state === 'idle' && !root.classList.contains('is-offscreen') && !document.hidden) await blinkOnce();
      scheduleBlink();
    }, 4000 + Math.random() * 3000);
  }

  const EFFECTS = {
    idle: () => Promise.resolve(),
    warned: async () => {
      const a = animateOr(cup, [
        { transform: 'translate(0px,0px) rotate(0deg)' },
        { transform: 'translate(-6px,0px) rotate(-4deg)' },
        { transform: 'translate(6px,0px) rotate(4deg)' },
        { transform: 'translate(0px,0px) rotate(-3deg)' },
        { transform: 'translate(0px,0px) rotate(0deg)' },
      ], { duration: 420, easing: 'ease-in-out' });
      blinkOnce();
      await a.finished.catch(() => {});
    },
    angry: async () => {
      const frames = [];
      for (let i = 0; i <= 10; i++) {
        const s = i % 2 ? 1 : -1;
        frames.push({ transform: i === 0 || i === 10 ? 'translate(0px,0px) rotate(0deg)' : `translate(${s * 10}px,${(i % 3) * 3}px) rotate(${s * 9}deg)` });
      }
      const a = animateOr(cup, frames, { duration: 600, easing: 'linear' });
      await a.finished.catch(() => {});
    },
    spilled: async () => {
      if (!canAnimate()) {
        cup.style.transition = 'opacity 200ms linear';
        cup.style.opacity = '0';
        puddle.style.transition = 'opacity 200ms linear';
        puddle.style.transform = 'scale(1)';
        puddle.style.opacity = '1';
        await wait(260);
        return;
      }
      const fall = cup.animate([
        { transform: 'translate(0px,0px) rotate(0deg)' },
        { transform: 'translate(20px,-12px) rotate(40deg)', offset: 0.35 },
        { transform: 'translate(170px,135px) rotate(95deg)' },
      ], { duration: 900, easing: EASE_FALL, fill: 'forwards' });
      await fall.finished.catch(() => {});
      cup.animate([
        { transform: 'translate(170px,135px) rotate(95deg)' },
        { transform: 'translate(172px,131px) rotate(92deg)' },
        { transform: 'translate(170px,135px) rotate(95deg)' },
      ], { duration: 220, easing: 'ease-out', fill: 'forwards' });
      const grow = puddle.animate([
        { opacity: 0, transform: 'scale(0.1)' },
        { opacity: 1, transform: 'scale(1)' },
      ], { duration: 700, easing: EASE_OUT, fill: 'forwards' });
      if (DEV) assertCupInside();
      await grow.finished.catch(() => {});
    },
    refilling: async () => {
      if (!canAnimate()) {
        cup.style.opacity = '';
        cup.style.transition = '';
        puddle.style.opacity = '';
        puddle.style.transform = '';
        puddle.style.transition = '';
        await wait(400);
        return;
      }
      const fade = cup.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, fill: 'forwards' });
      const puddleOut = puddle.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, fill: 'forwards' });
      await Promise.all([fade.finished, puddleOut.finished]).catch(() => {});
      fade.commitStyles();
      cup.getAnimations().forEach((a) => a.cancel());
      puddle.getAnimations().forEach((a) => a.cancel());
      const rise = cup.animate([
        { transform: 'translate(0px,320px) rotate(0deg)', opacity: 0 },
        { transform: 'translate(0px,0px) rotate(0deg)', opacity: 1 },
      ], { duration: 520, easing: EASE_OUT, fill: 'forwards' });
      await rise.finished.catch(() => {});
      cup.style.opacity = '';
      rise.cancel();
      await wait(120);
    },
  };

  function assertCupInside() {
    // Transforma las esquinas de la zona visible del vaso (394,688)-(542,908) con la matriz actual.
    try {
      const m = cup.getCTM();
      const root = svg.getScreenCTM();
      if (!m || !root) return;
      const toUser = (x, y) => { const p = new DOMPoint(x, y).matrixTransform(m); return [p.x, p.y]; };
      const pts = [toUser(394, 688), toUser(542, 688), toUser(394, 908), toUser(542, 908)];
      const box = [Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1]))].map(Math.round);
      if (box[0] < 0 || box[1] < 0 || box[2] > 1000 || box[3] > 1100) console.warn('[rig] el vaso cae fuera del marco', box);
      else console.info('[rig] vaso en', box);
    } catch { /* nada */ }
  }

  // ---------- pista, contador y teclas ----------
  function hideHint() {
    if (hint.hidden) return;
    hint.hidden = true;
    try { storage('sessionStorage')?.setItem('rig.hint', '1'); } catch { /* ignorar */ }
  }
  function pulseHint() {
    if (hint.hidden || reduced()) return;
    hint.classList.remove('is-pulsing');
    void hint.offsetWidth;
    hint.classList.add('is-pulsing');
  }
  function renderKey() {
    key.dataset.i18n = coarseMQ.matches ? 'coffee.key_tap' : 'coffee.key_click';
    key.textContent = t(key.dataset.i18n);
  }

  // ---------- ojos ----------
  let rect = null;
  let last = null;
  let raf = 0;
  const canTranslate = 'translate' in eyes.style;
  const measure = () => { rect = svg.getBoundingClientRect(); };
  function updateEyes() {
    raf = 0;
    if (!rect || !last) return;
    const cx = rect.left + rect.width * 0.466;
    const cy = rect.top + rect.height * (233 / 1100);
    const k = 1000 / rect.width;
    const dx = Math.max(-12, Math.min(12, ((last.clientX - cx) * k) / 28));
    const dy = Math.max(-8, Math.min(8, ((last.clientY - cy) * k) / 28));
    eyes.style.translate = `${dx.toFixed(1)}px ${dy.toFixed(1)}px`;
  }
  if (canTranslate) {
    section.addEventListener('pointermove', (e) => {
      if (state !== 'idle' || coarseMQ.matches || reduced() || blinking) return;
      last = e;
      if (!rect) measure();
      if (!raf) raf = requestAnimationFrame(updateEyes);
    }, { passive: true });
    section.addEventListener('pointerleave', () => { eyes.style.translate = '0px 0px'; last = null; });
    if ('ResizeObserver' in window) new ResizeObserver(measure).observe(svg);
    window.addEventListener('scroll', () => { rect = null; }, { passive: true });
  }

  // ---------- observadores ----------
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const off = !entry.isIntersecting;
        root.classList.toggle('is-offscreen', off);
        if (off) { offscreenSince = performance.now(); pauseHold(); }
        else {
          if (state === 'spilled' && !busy) {
            if (offscreenSince && performance.now() - offscreenSince > 10000) go('refilling');
            else armHold();
          }
          offscreenSince = 0;
        }
      }
    }, { threshold: 0.15 });
    io.observe(root);
  }
  document.addEventListener('visibilitychange', () => {
    root.classList.toggle('is-hidden', document.hidden);
    if (document.hidden) pauseHold();
    else if (state === 'spilled' && !busy) armHold();
  });

  // ---------- eventos ----------
  hit.addEventListener('pointerdown', () => { root.dataset.input = 'pointer'; });
  hit.addEventListener('keydown', () => { root.dataset.input = 'keyboard'; });
  hit.addEventListener('click', activate);
  resetBtn.addEventListener('click', () => { if (state === 'spilled' && !busy) go('refilling'); });
  for (const link of document.querySelectorAll('.link-rig')) {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      root.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'center' });
      hit.focus({ preventScroll: true });
      pulseHint();
    });
  }
  document.addEventListener('mtc:lang', () => {
    announce(state);
    renderCount();
    renderKey();
  });
  coarseMQ.addEventListener?.('change', renderKey);

  // ---------- arranque ----------
  preload.then((results) => {
    if (results.some((r) => r.status === 'rejected')) {
      root.classList.add('rig--broken');
      if (DEV) console.warn('[rig] capa no disponible', results.filter((r) => r.status === 'rejected'));
      return;
    }
    if (DEV) {
      const origin = getComputedStyle(cup).transformOrigin;
      if (!origin.startsWith('440px 830px')) console.warn('[rig] transform-origin inesperado en #cup:', origin);
    }
    hit.hidden = false;
    let seen = false;
    try { seen = storage('sessionStorage')?.getItem('rig.hint') === '1'; } catch { /* ignorar */ }
    hint.hidden = seen;
    renderKey();
    renderCount();
    announce('idle');
    scheduleBlink();
    if (!seen && 'IntersectionObserver' in window) {
      const once = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) { pulseHint(); once.disconnect(); }
      }, { threshold: 0.4 });
      once.observe(root);
    }
  });

  return {
    get state() { return state; },
    activate,
    refill: () => { if (state === 'spilled' && !busy) go('refilling'); },
  };
}
