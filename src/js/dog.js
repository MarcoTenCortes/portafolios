// dog.js: la caseta y el hueso estan sueltos al pie de Contacto (franja #yard, a sangre). Cuando el
// puntero se acerca al hueso, el perro se asoma por el lateral izquierdo de la pantalla a la altura de la
// caseta; al tocar el hueso alza las orejas; si el hueso se deja en la puerta, corre a la caseta y entra.
// Maquina de estados explicita (inHouse -> running -> entering -> inHouse), Web Animations API encadenada
// por animation.finished, el hueso es un <button> arrastrable (Enter = darselo: alternativa de teclado).
// Aparte, el perro que se asoma por los bordes de la ventana (#dog-peek, capa fija).
import { attachDrag } from './drag.js';
import { clamp } from './play/geom.js';
import {
  next as nextState, doorRect, doorCenter, isInDoor, isNearDoor, dogStopX, settleBone, spawnX,
  pointerZone, runDuration, nextPeekDelay, shouldPeek, bonesAfter, announceFor,
} from './play/dog-machine.js';

const EASE_OUT = 'cubic-bezier(.2,.7,.2,1)';
const EASE_IN = 'cubic-bezier(.5,0,.8,.5)';
const EASE_FALL = 'cubic-bezier(.4,0,.6,1)';
const PEEK_FRACTION = 0.22; // parte del perro que queda fuera de la pantalla cuando se asoma
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function storage(kind) {
  try { return window[kind]; } catch { return null; }
}
function readBones() {
  try {
    const raw = storage('localStorage')?.getItem('play.bones');
    const v = raw ? JSON.parse(raw) : null;
    if (v && v.v === 1 && Number.isFinite(v.n)) return v;
  } catch { /* nada */ }
  return { v: 1, n: 0, since: null };
}
function writeBones(v) {
  try { storage('localStorage')?.setItem('play.bones', JSON.stringify(v)); } catch { /* nada */ }
}

// Temporizador que se puede pausar (pestana oculta) y reanudar con el tiempo restante.
function timer(fn, ms) {
  let id = setTimeout(fire, ms);
  let start = performance.now();
  let left = ms;
  let done = false;
  function fire() { done = true; id = null; fn(); }
  return {
    pause() { if (done || id == null) return; clearTimeout(id); id = null; left = Math.max(50, left - (performance.now() - start)); },
    resume() { if (done || id != null) return; start = performance.now(); id = setTimeout(fire, left); },
    cancel() { done = true; if (id != null) clearTimeout(id); id = null; },
    get done() { return done; },
  };
}

export function initDog(yard, { i18n, showToast } = {}) {
  if (!yard) return null;
  const q = (sel) => yard.querySelector(sel);
  const houseFront = q('.yard__house--front');
  const dog = q('#yard-dog');
  const bone = q('#yard-bone');
  const hint = q('#dog-hint');
  const count = q('#dog-count');
  const status = q('#dog-status');
  const peek = document.getElementById('dog-peek');
  if (!houseFront || !dog || !bone) return null;

  const reducedMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => reducedMQ.matches;
  const canAnimate = () => 'animate' in Element.prototype && !reduced();
  const t = (k, vars) => (i18n ? i18n.t(k, vars) : k);
  const html = document.documentElement;

  let state = 'inHouse';     // inHouse | running | entering
  let boneState = 'resting'; // resting | dragging | dropped | delivering | away | respawn
  let shown = 'hidden';      // hidden | in | out  (el perro asomado por el borde)
  let busy = false;
  let bones = readBones();
  let bonePos = { x: 0, y: 0 };
  let dogX = 0;
  let cooldown = null;
  let lastAnnounce = '';
  let nearAnnounced = false;
  let nearTimer = 0;
  let alertTimer = 0;
  let hideTimer = 0;
  let dogAnim = null;
  const live = new Set(); // animaciones WAAPI activas (para pausar con la pestana oculta)

  // ---------- estado y anuncios ----------
  function setState(next) { state = next; yard.dataset.state = next; }
  function setBone(next) { boneState = next; yard.dataset.bone = next; }
  function setShown(next) { shown = next; yard.dataset.dog = next; }
  function setBusy(v) { busy = v; yard.dataset.busy = String(v); }
  function announce(keyName) {
    if (!status || !keyName) return;
    lastAnnounce = keyName;
    status.textContent = t(`play.dog.status.${keyName}`);
  }
  function renderCount() {
    if (!count) return;
    count.hidden = bones.n < 1;
    count.textContent = t('play.dog.counter', { n: bones.n });
    yard.dataset.bones = String(bones.n);
    const h = layout.house;
    count.style.transform = `translate(${Math.round(h.left + h.width / 2)}px, ${Math.max(0, Math.round(h.top - 30))}px)`;
  }

  // ---------- geometria (px locales de la franja; el cliente solo para el puntero) ----------
  const layout = { size: { width: 0, height: 0 }, house: { left: 0, top: 0, width: 0, height: 0 }, dog: { w: 0, h: 0 }, bone: { w: 0, h: 0 }, gutter: 20 };
  let yardRect = null;
  function measure() {
    layout.size = { width: yard.clientWidth, height: yard.clientHeight };
    layout.house = { left: houseFront.offsetLeft, top: houseFront.offsetTop, width: houseFront.offsetWidth, height: houseFront.offsetHeight };
    layout.dog = { w: dog.offsetWidth, h: dog.offsetHeight };
    layout.bone = { w: bone.offsetWidth, h: bone.offsetHeight };
    layout.gutter = parseFloat(getComputedStyle(html).getPropertyValue('--gutter')) || 20;
    yardRect = null;
  }
  function client() {
    if (!yardRect) yardRect = yard.getBoundingClientRect();
    return yardRect;
  }
  const local = (cx, cy) => { const r = client(); return { x: cx - r.left, y: cy - r.top }; };
  const groundY = () => layout.size.height - layout.bone.h - 4;
  const peekX = () => -Math.round(layout.dog.w * PEEK_FRACTION);
  const boneCenter = () => ({ x: bonePos.x + layout.bone.w / 2, y: bonePos.y + layout.bone.h / 2 });
  const tx = (x) => `translateX(${x.toFixed(1)}px)`;

  function placeBone(x, y, rot = 0) {
    bonePos = { x, y };
    bone.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${rot}deg)`;
    if (hint) hint.style.transform = `translate(${Math.round(x + layout.bone.w / 2)}px, ${Math.round(y - 34)}px)`;
  }
  function placeDog(x, opacity) {
    dogX = x;
    dog.style.transform = tx(x);
    if (opacity != null) dog.style.opacity = String(opacity);
  }
  function face(dir) { dog.classList.toggle('is-facing-left', dir === 'left'); }
  function dogXNow() {
    try { return new DOMMatrixReadOnly(getComputedStyle(dog).transform).m41; } catch { return dogX; }
  }

  // ---------- animaciones ----------
  function track(anim) {
    live.add(anim);
    anim.finished.catch(() => {}).then(() => live.delete(anim));
    return anim;
  }
  function cancelLive() {
    for (const a of live) { try { a.cancel(); } catch { /* nada */ } }
    live.clear();
    dogAnim = null;
  }
  function stopDog() {
    if (!dogAnim) return;
    try { dogAnim.commitStyles(); } catch { /* sin render */ }
    dogAnim.cancel();
    live.delete(dogAnim);
    dogAnim = null;
  }
  // Desliza al perro hasta x (desde donde este: un solo keyframe parte del valor actual). false si se interrumpe.
  async function slide(toX, ms, { fadeTo = null, easing = 'linear' } = {}) {
    stopDog();
    const frame = fadeTo == null ? { transform: tx(toX) } : { transform: tx(toX), opacity: fadeTo };
    dog.style.willChange = 'transform';
    const a = track(dog.animate([frame], { duration: ms, easing, fill: 'forwards' }));
    dogAnim = a;
    await a.finished.catch(() => {});
    if (dogAnim !== a) return false;
    try { a.commitStyles(); } catch { /* nada */ }
    a.cancel();
    live.delete(a);
    dogAnim = null;
    dog.style.willChange = '';
    placeDog(toX, fadeTo);
    return true;
  }
  function fadeBone(from, to, ms) {
    if (!canAnimate()) { bone.style.opacity = String(to); return Promise.resolve(); }
    const a = track(bone.animate([{ opacity: from }, { opacity: to }], { duration: ms, fill: 'forwards' }));
    return a.finished.catch(() => {}).then(() => { a.cancel(); bone.style.opacity = String(to); });
  }

  // ---------- el perro se asoma por el borde ----------
  async function showDog() {
    if (state !== 'inHouse' || busy) return;
    clearTimeout(hideTimer);
    hideTimer = 0;
    if (shown === 'in') return;
    setShown('in');
    face('right');
    dog.style.opacity = '1';
    if (!canAnimate()) { stopDog(); placeDog(peekX()); return; }
    dog.classList.add('is-walking');
    const ok = await slide(peekX(), 520, { easing: EASE_OUT });
    if (ok) dog.classList.remove('is-walking');
  }
  async function hideDog() {
    if (shown !== 'in' || state !== 'inHouse' || busy) return;
    setShown('out');
    dog.classList.remove('is-alert');
    face('left');
    dog.classList.add('is-walking');
    let ok = true;
    if (canAnimate()) { await wait(140); ok = await slide(-layout.dog.w - 4, 420, { easing: EASE_IN }); } else { stopDog(); placeDog(-layout.dog.w - 4); }
    if (!ok) return;
    dog.classList.remove('is-walking');
    face('right');
    setShown('hidden');
  }
  function alert() {
    if (state !== 'inHouse' || busy) return;
    showDog();
    dog.classList.add('is-alert');
    clearTimeout(alertTimer);
    alertTimer = setTimeout(() => dog.classList.remove('is-alert'), 1800);
  }

  // ---------- cercania del puntero al hueso ----------
  let pointer = null;
  let proxRaf = 0;
  let nearFlag = false;
  function onPointer(e) {
    if (e.pointerType === 'touch' || document.hidden || yard.classList.contains('is-offscreen')) return;
    pointer = { x: e.clientX, y: e.clientY };
    if (!proxRaf) proxRaf = requestAnimationFrame(checkProximity);
  }
  function checkProximity() {
    proxRaf = 0;
    if (!pointer || state !== 'inHouse' || (boneState !== 'resting' && boneState !== 'dragging')) return;
    const p = local(pointer.x, pointer.y);
    const zone = pointerZone(p, boneCenter(), nearFlag);
    if (zone === 'near') {
      nearFlag = true;
      showDog();
    } else if (nearFlag) {
      nearFlag = false;
      farSoon();
    }
  }
  function farSoon() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => { if (!grab && !nearFlag) hideDog(); }, 1400);
  }
  window.addEventListener('pointermove', onPointer, { passive: true });
  html.addEventListener('mouseleave', () => { if (nearFlag) { nearFlag = false; farSoon(); } });

  // ---------- coreografia: correr a la caseta y entrar ----------
  async function deliver() {
    if (busy || state !== 'inHouse') return;
    setBusy(true);
    clearTimeout(hideTimer);
    hideTimer = 0;
    hideHint();
    hidePeek(true);
    setBone('delivering');
    bone.classList.remove('is-dragging');
    setState(nextState(state, 'deliver')); // running
    announce('running');
    yard.classList.add('is-near');
    if (!canAnimate()) { await deliverReduced(); return; }
    if (shown === 'hidden') placeDog(-layout.dog.w - 4, 1);
    setShown('in');
    face('right');
    dog.classList.remove('is-alert');
    dog.classList.add('is-walking', 'is-running');
    const house = layout.house;
    const door = doorRect(house);
    const jambX = door.left - layout.dog.w * 0.5;
    const ok = await slide(jambX, runDuration(jambX - dogXNow()));
    if (!ok || state !== 'running') return;
    setState(nextState(state, 'reached')); // entering
    dog.classList.remove('is-running');
    const stopX = house.left + dogStopX(house, layout.dog.w);
    await slide(stopX, 560, { fadeTo: 0, easing: 'ease-in' });
    dog.classList.remove('is-walking');
    await takeBone();
    await arrive();
  }
  async function deliverReduced() {
    await wait(200);
    await fadeBone(1, 0, 300);
    setState(nextState(state, 'reached')); // entering (sin carrera)
    await arrive();
  }
  async function takeBone() {
    const c = doorCenter(layout.house);
    if (canAnimate()) {
      const a = track(bone.animate([
        { transform: `translate(${(c.x - layout.bone.w / 2 + 18).toFixed(1)}px, ${(bonePos.y - 6).toFixed(1)}px) scale(.8)`, opacity: 0 },
      ], { duration: 380, easing: 'ease-in', fill: 'forwards' }));
      await a.finished.catch(() => {});
      a.cancel();
    }
    bone.style.opacity = '0';
  }
  async function arrive() {
    setBone('away');
    bone.style.opacity = '';
    yard.classList.remove('is-near');
    yard.classList.add('is-peeking'); // ojos en la puerta
    bones = bonesAfter(bones);
    if (!bones.since) bones.since = new Date().toISOString().slice(0, 10);
    writeBones(bones);
    renderCount();
    setState(nextState(state, 'inside')); // inHouse
    dog.classList.remove('is-walking', 'is-running', 'is-alert');
    face('right');
    placeDog(-layout.dog.w - 4, 1);
    setShown('hidden');
    nearFlag = false;
    announce(announceFor(bones.n));
    setBusy(false);
    await wait(1400);
    yard.classList.remove('is-peeking');
    yard.classList.add('is-dark');
    await wait(600);
    if (lastAnnounce !== 'napping') announce('napping');
    cooldown = timer(respawn, 5500 + Math.random() * 2500);
  }
  async function respawn() {
    cooldown = null;
    yard.classList.remove('is-dark');
    const x = spawnX(Math.random, layout.size, layout.bone, layout.house, layout.gutter);
    const y = groundY();
    placeBone(x, y, 0);
    setBone('respawn');
    if (canAnimate()) {
      const a = track(bone.animate([
        { opacity: 0, transform: `translate(${x}px, ${y - 12}px)` },
        { opacity: 1, transform: `translate(${x}px, ${y}px)` },
      ], { duration: 360, easing: EASE_OUT }));
      await a.finished.catch(() => {});
    }
    bone.style.opacity = '';
    setBone('resting');
    announce('idle');
  }
  async function dropBone(x, y) {
    if (isInDoor(boneCenter(), layout.house)) {
      const c = doorCenter(layout.house);
      placeBone(c.x - layout.bone.w / 2, groundY(), 0);
      deliver();
      return;
    }
    const pos = settleBone({ x, y }, layout.bone, layout.size, layout.house, layout.gutter);
    const gy = groundY();
    if (canAnimate() && (Math.abs(gy - y) > 2 || Math.abs(pos.x - x) > 2)) {
      setBone('dropped');
      const a = track(bone.animate([
        { transform: `translate(${pos.x}px, ${gy}px) rotate(0deg)`, offset: 0.7 },
        { transform: `translate(${pos.x}px, ${gy - 8}px) rotate(0deg)`, offset: 0.85 },
        { transform: `translate(${pos.x}px, ${gy}px) rotate(0deg)` },
      ], { duration: 440, easing: EASE_FALL, fill: 'forwards' }));
      await a.finished.catch(() => {});
      a.cancel();
    }
    placeBone(pos.x, gy, 0);
    setBone('resting');
    const near = isNearDoor(boneCenter(), layout.house);
    yard.classList.toggle('is-near', near);
    if (near) {
      announce('near');
      alert();
      setTimeout(() => { if (boneState === 'resting' && !grab) yard.classList.remove('is-near'); }, 2200);
    } else if (lastAnnounce === 'near') announce('idle');
  }
  // Alternativa de teclado (Enter/Espacio sobre el hueso): el hueso vuela a la puerta y el perro corre.
  async function feed() {
    if (busy || state !== 'inHouse' || boneState !== 'resting' || cooldown) return;
    hideHint();
    yard.dataset.input = 'keyboard';
    const c = doorCenter(layout.house);
    const x = c.x - layout.bone.w / 2;
    const y = groundY();
    setBone('delivering');
    showDog();
    if (canAnimate()) {
      const a = track(bone.animate([
        { transform: `translate(${x}px, ${y - 40}px) rotate(-10deg)`, offset: 0.5 },
        { transform: `translate(${x}px, ${y}px) rotate(0deg)` },
      ], { duration: 640, easing: EASE_OUT, fill: 'forwards' }));
      await a.finished.catch(() => {});
      a.cancel();
    }
    placeBone(x, y, 0);
    await deliver();
  }

  // ---------- arrastre del hueso ----------
  let grab = null;
  const drag = attachDrag(bone, {
    onStart(e) {
      if (busy || boneState !== 'resting') { drag.cancel('busy'); return; }
      hideHint();
      yard.dataset.input = 'pointer';
      const p = local(e.clientX, e.clientY);
      grab = { dx: p.x - bonePos.x, dy: p.y - bonePos.y, raf: 0, cx: e.clientX, cy: e.clientY };
      setBone('dragging');
      bone.classList.add('is-dragging');
      nearAnnounced = false;
      nearFlag = true;
      showDog();
    },
    onMove(e) {
      if (!grab) return;
      grab.cx = e.clientX;
      grab.cy = e.clientY;
      if (!grab.raf) grab.raf = requestAnimationFrame(moveBone);
    },
    onEnd() { endDrag(); },
    onCancel() { endDrag(); },
  }, { slop: 3 });
  function moveBone() {
    if (!grab) return;
    grab.raf = 0;
    const p = local(grab.cx, grab.cy);
    const x = clamp(p.x - grab.dx, -layout.bone.w * 0.5, layout.size.width - layout.bone.w * 0.5);
    const y = clamp(p.y - grab.dy, 0, layout.size.height - layout.bone.h);
    placeBone(x, y, 0);
    const near = isNearDoor(boneCenter(), layout.house);
    yard.classList.toggle('is-near', near);
    if (near && !nearAnnounced) {
      clearTimeout(nearTimer);
      nearTimer = setTimeout(() => { if (grab && !nearAnnounced) { nearAnnounced = true; announce('near'); } }, 800);
    }
    if (!near) clearTimeout(nearTimer);
  }
  function endDrag() {
    if (!grab) return;
    if (grab.raf) { cancelAnimationFrame(grab.raf); moveBone(); }
    clearTimeout(nearTimer);
    grab = null;
    bone.classList.remove('is-dragging');
    dropBone(bonePos.x, bonePos.y);
  }
  bone.addEventListener('pointerdown', (e) => { if (e.isPrimary && boneState === 'resting' && !busy) alert(); });
  bone.addEventListener('click', (e) => {
    if (e.detail === 0) { feed(); return; } // activado con teclado
    alert();
  });

  // ---------- pista ----------
  function hideHint() {
    if (!hint || hint.hidden) return;
    hint.hidden = true;
    try { storage('sessionStorage')?.setItem('play.dog.hint', '1'); } catch { /* nada */ }
  }
  function showHintOnce() {
    let seen = false;
    try { seen = storage('sessionStorage')?.getItem('play.dog.hint') === '1'; } catch { /* nada */ }
    if (seen || !hint || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((en) => en.isIntersecting)) { hint.hidden = false; io.disconnect(); }
    }, { threshold: 0.4 });
    io.observe(yard);
  }

  // ---------- perro asomado por los bordes de la ventana ----------
  let peekState = 'hidden';
  let peekTimer = null;
  let peekHold = null;
  let lastInput = performance.now();
  let lastSides = [];
  const noteInput = () => { lastInput = performance.now(); };
  for (const ev of ['pointermove', 'pointerdown', 'keydown', 'scroll', 'touchstart', 'wheel']) {
    window.addEventListener(ev, noteInput, { passive: true });
  }
  const INTERACTIVE = 'a, button, input, select, textarea, summary, [role="button"], [tabindex]:not([tabindex="-1"]), .card, .action';
  const PEEK_W = () => peek?.offsetWidth || 104;
  function peekHits(side, y) {
    // rejilla 3x5 sobre el rect visible del perro pegado al borde
    const hits = [];
    const vis = Math.round(PEEK_W() * 0.7);
    const x0 = side === 'left' ? 0 : window.innerWidth - vis;
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 5; j++) {
        const x = x0 + 8 + i * ((vis - 16) / 2);
        const yy = y + 8 + j * 18;
        for (const el of document.elementsFromPoint(x, yy)) {
          if (el === peek || peek?.contains(el)) continue;
          if (el.closest?.(INTERACTIVE)) { hits.push(el); break; }
        }
      }
    }
    return hits;
  }
  function forbidden(side, y) {
    const vis = Math.round(PEEK_W() * 0.7);
    const R = { left: side === 'left' ? 0 : window.innerWidth - vis, top: y, right: side === 'left' ? vis : window.innerWidth, bottom: y + 96 };
    const blockers = ['#nav', '#rig-hit', '#toast', '#yard-bone', '#marker', '[data-no-peek]'];
    for (const sel of blockers) {
      for (const el of document.querySelectorAll(sel)) {
        if (el.hidden || el.closest('[hidden]')) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        if (r.left < R.right && r.right > R.left && r.top < R.bottom && r.bottom > R.top) return true;
      }
    }
    const container = document.querySelector('.container');
    const margin = container ? (window.innerWidth - container.getBoundingClientRect().width) / 2 : 0;
    if (margin < vis + 8 && peekHits(side, y).length) return true;
    return false;
  }
  function placePeek(sideWanted) {
    if (!peek) return null;
    const navH = 48;
    for (let attempt = 0; attempt < 5; attempt++) {
      let side = sideWanted || (Math.random() < 0.5 ? 'left' : 'right');
      if (!sideWanted && lastSides.length >= 3 && lastSides.every((s) => s === side)) side = side === 'left' ? 'right' : 'left';
      const maxY = window.innerHeight - 200;
      if (maxY <= navH + 72) return null;
      const y = Math.round(navH + 72 + Math.random() * (maxY - navH - 72));
      if (!forbidden(side, y)) return { side, y };
    }
    return null;
  }
  function armPeek(ms) {
    if (!peek) return;
    peekTimer?.cancel();
    peekTimer = timer(tryPeek, ms ?? nextPeekDelay());
  }
  function tryPeek() {
    const ok = shouldPeek({
      hidden: document.hidden, reduced: reduced(), dragging: html.classList.contains('is-dragging') || html.classList.contains('is-inking'),
      sheetOpen: html.classList.contains('sheet-open'), state, idleMs: performance.now() - lastInput, width: window.innerWidth,
    });
    if (!ok || peekState !== 'hidden') { armPeek(3000 + Math.random() * 3000); return; }
    const spot = placePeek();
    if (!spot) { armPeek(); return; }
    showPeek(spot.side, spot.y, 2600 + Math.random() * 1400);
  }
  function showPeek(side, y, holdMs) {
    if (!peek) return;
    lastSides = [...lastSides.slice(-2), side];
    peek.dataset.side = side;
    peek.style.top = `${y}px`;
    peek.hidden = false;
    peekState = 'peekingIn';
    requestAnimationFrame(() => {
      peek.classList.add('is-visible');
      peekState = 'peeking';
      peekHold?.cancel();
      peekHold = timer(() => hidePeek(false), holdMs);
    });
  }
  function hidePeek(immediate) {
    if (!peek || peekState === 'hidden') return;
    peekHold?.cancel();
    peek.classList.remove('is-visible');
    peekState = 'peekingOut';
    const done = () => { peek.hidden = true; peekState = 'hidden'; armPeek(); };
    if (immediate || reduced()) done(); else setTimeout(done, 340);
  }
  if (peek) {
    peek.addEventListener('pointerenter', () => { if (peekState === 'peeking') { peekHold?.cancel(); peekHold = timer(() => hidePeek(false), 8000); } });
    peek.addEventListener('click', () => {
      if (peekState !== 'peeking') return;
      peek.classList.add('is-booped');
      setTimeout(() => peek.classList.remove('is-booped'), 500);
      showToast?.(t('play.dog.peek_toast'));
      peekHold?.cancel();
      peekHold = timer(() => hidePeek(false), 1200);
    });
  }

  // ---------- pausas y re-medida ----------
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      for (const a of live) { try { a.pause(); } catch { /* nada */ } }
      cooldown?.pause();
      peekTimer?.pause();
      peekHold?.pause();
      if (peekState !== 'hidden') hidePeek(true);
    } else {
      for (const a of live) { try { a.play(); } catch { /* nada */ } }
      cooldown?.resume();
      peekTimer?.resume();
      peekHold?.resume();
      if (!peekTimer || peekTimer.done) armPeek(4000 + Math.random() * 4000);
    }
  });
  function relayout() {
    measure();
    if (boneState === 'resting' || boneState === 'away') {
      const pos = settleBone(bonePos, layout.bone, layout.size, layout.house, layout.gutter);
      placeBone(pos.x, groundY(), 0);
    }
    if (shown === 'in' && state === 'inHouse' && !dogAnim) placeDog(peekX());
    if (shown === 'hidden') placeDog(-layout.dog.w - 4);
    renderCount();
  }
  if ('ResizeObserver' in window) {
    let first = true;
    new ResizeObserver(() => { if (first) { first = false; return; } relayout(); }).observe(yard);
  }
  window.addEventListener('scroll', () => { yardRect = null; }, { passive: true });

  // ---------- eventos ----------
  document.addEventListener('mtc:lang', () => {
    if (lastAnnounce) announce(lastAnnounce);
    renderCount();
  });

  // ---------- arranque ----------
  bone.hidden = false;
  measure();
  placeDog(-layout.dog.w - 4, 1);
  setShown('hidden');
  placeBone(spawnX(Math.random, layout.size, layout.bone, layout.house, layout.gutter), groundY(), 0);
  setBone('resting');
  renderCount();
  announce('idle');
  showHintOnce();
  if (import.meta.env.DEV) {
    const door = doorRect(layout.house);
    if (door.height < layout.dog.h - 6) console.warn('[dog] la puerta es mas baja que el perro', door.height, layout.dog.h);
    if (layout.house.left + layout.house.width > layout.size.width) console.warn('[dog] la caseta se sale de la franja');
  }
  let firstScroll = false;
  window.addEventListener('scroll', () => { if (!firstScroll) { firstScroll = true; armPeek(7000 + Math.random() * 5000); } }, { passive: true, once: true });
  armPeek(9000 + Math.random() * 6000);

  return {
    get state() { return state; },
    get shown() { return shown; },
    get bone() { return { ...bonePos, state: boneState }; },
    feed,
    peek(side) { const spot = placePeek(side) || { side: side || 'left', y: Math.round(window.innerHeight * 0.45) }; showPeek(spot.side, spot.y, 4000); },
    hidePeek: () => hidePeek(true),
    showDog,
    hideDog,
    placeBoneNear() {
      const c = doorCenter(layout.house);
      placeBone(c.x - layout.bone.w / 2 - 110, groundY(), 0);
      yard.classList.add('is-near');
    },
    force(what) {
      cancelLive();
      const c = doorCenter(layout.house);
      switch (what) {
        case 'shown': setShown('in'); placeDog(peekX(), 1); break;
        case 'alert': setShown('in'); placeDog(peekX(), 1); dog.classList.add('is-alert'); break;
        case 'running':
          setShown('in'); placeDog(layout.size.width * 0.35, 1); dog.classList.add('is-walking', 'is-running');
          setState('running'); setBone('delivering'); placeBone(c.x - layout.bone.w / 2, groundY(), 0); yard.classList.add('is-near'); announce('running'); break;
        case 'entering':
          setShown('in'); placeDog(layout.house.left + doorRect(layout.house).left - layout.house.left + 6, 0.85); dog.classList.add('is-walking');
          setState('entering'); setBone('delivering'); placeBone(c.x - layout.bone.w / 2, groundY(), 0); yard.classList.add('is-near'); break;
        case 'peek-left': this.peek('left'); break;
        case 'peek-right': this.peek('right'); break;
        case 'hidden': hidePeek(true); break;
        default:
          dog.classList.remove('is-walking', 'is-running', 'is-alert'); setShown('hidden'); placeDog(-layout.dog.w - 4, 1);
          setState('inHouse'); setBone('resting'); bone.style.opacity = ''; yard.classList.remove('is-near', 'is-dark', 'is-peeking');
          placeBone(spawnX(() => 0.6, layout.size, layout.bone, layout.house, layout.gutter), groundY(), 0);
      }
    },
    debugRects() {
      measure();
      return { yard: layout.size, house: layout.house, door: doorRect(layout.house), dog: { ...layout.dog, x: dogX }, bone: { ...bonePos, ...layout.bone }, state, boneState, shown };
    },
    debugPeekHits() {
      if (!peek || peek.hidden) return { visible: false, hits: [] };
      const y = parseFloat(peek.style.top) || 0;
      return { visible: true, side: peek.dataset.side, y, hits: peekHits(peek.dataset.side, y).map((el) => el.tagName + (el.id ? '#' + el.id : '') + '.' + String(el.className).slice(0, 30)) };
    },
    destroy() { drag.destroy(); cancelLive(); cooldown?.cancel(); peekTimer?.cancel(); peekHold?.cancel(); window.removeEventListener('pointermove', onPointer); },
  };
}
