// dog.js: el perro, el hueso y la caseta del patio, y el perro que se asoma por los bordes.
// Maquina de estados explicita (inHouse -> fetching -> grabbing -> carrying -> entering -> inHouse),
// Web Animations API encadenada por animation.finished, un <div> real como handle del hueso y
// un <button> como alternativa de teclado. Unidades del patio: viewBox 800x260.
import { attachDrag } from './drag.js';
import { clamp, distance } from './play/geom.js';
import {
  HOUSE, DOG, BONE, NEAR, WARN,
  next as nextState, settleX, boneCenter, dropOutcome, dragClamp, spawnX, walkDuration,
  nextPeekDelay, shouldPeek, bonesAfter, announceFor,
} from './play/dog-machine.js';

const EASE_OUT = 'cubic-bezier(.2,.7,.2,1)';
const EASE_FALL = 'cubic-bezier(.4,0,.6,1)';
const DOG_Y = 128; // pies del perro (y=150 del dibujo a escala 0.72) sobre el suelo y=236
const DOG_SCALE = DOG.w / 200; // el dibujo mide 200x160 y se pinta a 144x115
const MOUTH_RIGHT = 178 * DOG_SCALE; // offset de la boca mirando a la derecha
const MOUTH_LEFT = (200 - 178) * DOG_SCALE; // ... y a la izquierda (dibujo espejado)
const BONE_CARRY_Y = 175;
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
  const stage = q('.yard__stage');
  const dog = q('#yard-dog');
  const dogClip = q('.yard__dogclip');
  const bone = q('#yard-bone');
  const handle = q('#yard-handle');
  const hint = q('#dog-hint');
  const count = q('#dog-count');
  const status = q('#dog-status');
  const key = q('#dog-key');
  const feedBtn = q('#dog-feed');
  const house = q('.house--front');
  const peek = document.getElementById('dog-peek');
  if (!stage || !dog || !bone || !handle) return null;

  const reducedMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  const coarseMQ = window.matchMedia('(hover: none)');
  const reduced = () => reducedMQ.matches;
  const canAnimate = () => 'animate' in Element.prototype && !reduced();
  const t = (k, vars) => (i18n ? i18n.t(k, vars) : k);
  const html = document.documentElement;

  let state = 'inHouse';
  let boneState = 'resting';
  let busy = false;
  let facing = 'right';
  let bones = readBones();
  let bonePos = { x: 560, y: BONE.y };
  let dogX = HOUSE.insideX;
  let cooldown = null;
  let lastAnnounce = '';
  let nearAnnounced = false;
  let nearTimer = 0;
  const live = new Set(); // animaciones WAAPI activas (para pausar con la pestana oculta)

  // ---------- estado y anuncios ----------
  function setState(next) { state = next; yard.dataset.state = next; }
  function setBone(next) { boneState = next; yard.dataset.bone = next; }
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
  }
  function renderKey() {
    if (!key) return;
    key.dataset.i18n = coarseMQ.matches ? 'play.dog.key_tap' : 'play.dog.key_drag';
    key.textContent = t(key.dataset.i18n);
  }
  function setFeedEnabled(on) {
    if (!feedBtn) return;
    feedBtn.setAttribute('aria-disabled', on ? 'false' : 'true');
  }

  // ---------- geometria: patio <-> pantalla ----------
  let stageRect = null;
  const k = () => 800 / (stageRect?.width || stage.getBoundingClientRect().width || 800);
  function measure() { stageRect = stage.getBoundingClientRect(); }
  function placeBone(x, y, rot = 0) {
    bonePos = { x, y };
    bone.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${rot}deg)`;
    placeHandle();
  }
  function placeHandle() {
    const c = boneCenter(bonePos.x, bonePos.y);
    const px = c.x / k();
    const py = c.y / k();
    handle.style.transform = `translate(${(px - 22).toFixed(1)}px, ${(py - 22).toFixed(1)}px)`;
  }
  function placeDog(x, opacity) {
    dogX = x;
    dog.style.transform = `translate(${x.toFixed(1)}px, ${DOG_Y}px)`;
    if (opacity != null) dog.style.opacity = String(opacity);
  }
  function face(dir) {
    facing = dir;
    dog.classList.toggle('is-facing-left', dir === 'left');
  }
  function carriedBoneX(x, dir = facing) {
    return dir === 'right' ? x + MOUTH_RIGHT - BONE.w / 2 : x + MOUTH_LEFT - BONE.w / 2;
  }

  function track(anim) {
    live.add(anim);
    anim.finished.catch(() => {}).then(() => live.delete(anim));
    return anim;
  }
  function cancelLive() {
    for (const a of live) { try { a.cancel(); } catch { /* nada */ } }
    live.clear();
  }
  async function walk(fromX, toX, withBone) {
    const dur = walkDuration(Math.abs(toX - fromX));
    dog.classList.add('is-walking');
    dog.style.willChange = 'transform';
    const a = track(dog.animate([
      { transform: `translate(${fromX}px, ${DOG_Y}px)` },
      { transform: `translate(${toX}px, ${DOG_Y}px)` },
    ], { duration: dur, easing: 'linear', fill: 'forwards' }));
    let b = null;
    if (withBone) {
      b = track(bone.animate([
        { transform: `translate(${carriedBoneX(fromX)}px, ${BONE_CARRY_Y}px) rotate(${facing === 'right' ? -14 : 14}deg)` },
        { transform: `translate(${carriedBoneX(toX)}px, ${BONE_CARRY_Y}px) rotate(${facing === 'right' ? -14 : 14}deg)` },
      ], { duration: dur, easing: 'linear', fill: 'forwards' }));
    }
    await a.finished.catch(() => {});
    a.commitStyles?.();
    a.cancel();
    if (b) { await b.finished.catch(() => {}); b.commitStyles?.(); b.cancel(); }
    dog.classList.remove('is-walking');
    dog.style.willChange = '';
    placeDog(toX);
    if (withBone) placeBone(carriedBoneX(toX), BONE_CARRY_Y, facing === 'right' ? -14 : 14);
  }
  function fade(el, from, to, ms) {
    if (!canAnimate()) { el.style.opacity = String(to); return Promise.resolve(); }
    const a = track(el.animate([{ opacity: from }, { opacity: to }], { duration: ms, fill: 'forwards' }));
    return a.finished.catch(() => {}).then(() => { a.commitStyles?.(); a.cancel(); el.style.opacity = String(to); });
  }

  // ---------- coreografia ----------
  async function fetchBone() {
    if (busy || state !== 'inHouse') return;
    setBusy(true);
    hidePeek(true);
    cooldown?.cancel();
    setFeedEnabled(false);
    handle.hidden = true;
    setBone('fetched');
    setState('fetching');
    announce(announceFor('fetching'));
    yard.classList.add('is-peeking');
    if (!canAnimate()) { await fetchReduced(); return; }
    await wait(200);
    yard.classList.remove('is-peeking');
    face('right');
    placeDog(HOUSE.insideX, 0);
    await fade(dog, 0, 1, 200);
    await walk(HOUSE.insideX, HOUSE.exitX, false);
    if (state !== 'fetching') return; // interrumpido
    const target = Math.max(bonePos.x + BONE.w / 2 - MOUTH_RIGHT, 200);
    await walk(HOUSE.exitX, target, false);
    if (state !== 'fetching') return;
    setState(nextState(state, 'reached'));
    // grabbing
    const head = dog.querySelector('.dog__head');
    if (head) {
      const dip = track(head.animate([
        { transform: 'rotate(0deg)' }, { transform: 'rotate(18deg)', offset: 0.5 }, { transform: 'rotate(0deg)' },
      ], { duration: 480, easing: 'ease-in-out' }));
      await wait(240);
      dogClip.appendChild(bone);
      placeBone(carriedBoneX(dogX), BONE_CARRY_Y, -14);
      await dip.finished.catch(() => {});
    } else {
      dogClip.appendChild(bone);
      placeBone(carriedBoneX(dogX), BONE_CARRY_Y, -14);
    }
    dog.classList.add('is-happy');
    await wait(500);
    dog.classList.remove('is-happy');
    setState(nextState(state, 'grabbed'));
    // carrying
    face('left');
    await wait(140);
    placeBone(carriedBoneX(dogX), BONE_CARRY_Y, 14);
    await walk(dogX, HOUSE.exitX, true);
    setState(nextState(state, 'reached'));
    // entering
    await walk(HOUSE.exitX, HOUSE.insideX, true);
    await Promise.all([fade(dog, 1, 0, 300), fade(bone, 1, 0, 300)]);
    await arrive();
  }
  async function fetchReduced() {
    await wait(200);
    yard.classList.remove('is-peeking');
    bone.style.transition = 'opacity 300ms';
    bone.style.opacity = '0';
    await wait(320);
    bone.style.transition = '';
    await arrive();
  }
  async function arrive() {
    yard.classList.add('is-dark');
    bones = bonesAfter(bones);
    if (!bones.since) bones.since = new Date().toISOString().slice(0, 10);
    writeBones(bones);
    renderCount();
    setState('inHouse');
    announce(announceFor('inHouse', bones.n));
    setBusy(false);
    // siesta: cooldown antes del hueso nuevo
    const ms = 7000 + Math.random() * 3000;
    await wait(1800);
    if (lastAnnounce !== 'napping') announce('napping');
    cooldown = timer(respawn, ms - 1800);
  }
  async function respawn() {
    cooldown = null;
    stage.appendChild(bone); // vuelve por encima de la caseta
    face('right');
    placeDog(HOUSE.insideX, 0);
    yard.classList.remove('is-dark');
    const x = spawnX();
    placeBone(x, BONE.y, 0);
    bone.style.opacity = '0';
    setBone('respawn');
    if (canAnimate()) {
      const a = track(bone.animate([
        { opacity: 0, transform: `translate(${x}px, ${BONE.y - 12}px)` },
        { opacity: 1, transform: `translate(${x}px, ${BONE.y}px)` },
      ], { duration: 320, easing: EASE_OUT }));
      await a.finished.catch(() => {});
    }
    bone.style.opacity = '1';
    setBone('resting');
    handle.hidden = false;
    setFeedEnabled(true);
    announce('idle');
  }
  function interrupt() {
    // el visitante coge el hueso mientras el perro viene: el perro parpadea y vuelve a casa sin nada
    cancelLive();
    dog.classList.remove('is-walking', 'is-happy');
    dog.style.willChange = '';
    fade(dog, 1, 0, 140).then(() => placeDog(HOUSE.insideX, 0));
    yard.classList.remove('is-peeking');
    setState('inHouse');
    setBusy(false);
    setFeedEnabled(true);
  }
  async function dropBone(x, y) {
    const { x: rx, near } = dropOutcome(x);
    setBone(near ? 'droppedNear' : 'droppedFar');
    yard.classList.remove('is-near');
    if (canAnimate()) {
      const a = track(bone.animate([
        { transform: `translate(${x}px, ${y}px) rotate(0deg)` },
        { transform: `translate(${rx}px, ${BONE.y}px) rotate(0deg)`, offset: 0.7 },
        { transform: `translate(${rx}px, ${BONE.y - 8}px) rotate(0deg)`, offset: 0.85 },
        { transform: `translate(${rx}px, ${BONE.y}px) rotate(0deg)` },
      ], { duration: 440, easing: EASE_FALL, fill: 'forwards' }));
      await a.finished.catch(() => {});
      a.commitStyles?.();
      a.cancel();
    }
    placeBone(rx, BONE.y, 0);
    if (near) fetchBone();
    else { setBone('resting'); if (lastAnnounce === 'near') announce('idle'); }
  }
  async function feed() {
    if (busy || state !== 'inHouse' || boneState !== 'resting' || cooldown) return;
    yard.dataset.input = 'keyboard';
    hideHint();
    setBone('droppedNear');
    handle.hidden = true;
    const targetX = 300;
    if (canAnimate()) {
      const a = track(bone.animate([
        { transform: `translate(${bonePos.x}px, ${bonePos.y}px)` },
        { transform: `translate(${targetX}px, ${BONE.y}px)` },
      ], { duration: 600, easing: EASE_OUT, fill: 'forwards' }));
      await a.finished.catch(() => {});
      a.commitStyles?.();
      a.cancel();
    } else {
      await fade(bone, 1, 0, 150);
      placeBone(targetX, BONE.y, 0);
      await fade(bone, 0, 1, 150);
    }
    placeBone(targetX, BONE.y, 0);
    fetchBone();
  }

  // ---------- arrastre del hueso ----------
  let grab = null;
  const drag = attachDrag(handle, {
    onStart(e) {
      if (state === 'fetching') interrupt();
      if (busy) { drag.cancel('busy'); return; }
      hideHint();
      yard.dataset.input = 'pointer';
      measure();
      const kk = k();
      const px = (e.clientX - stageRect.left) * kk;
      const py = (e.clientY - stageRect.top) * kk;
      grab = { dx: px - bonePos.x, dy: py - bonePos.y, raf: 0, cx: e.clientX, cy: e.clientY };
      setBone('dragging');
      bone.classList.add('is-dragging');
      nearAnnounced = false;
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
    const kk = k();
    const px = (grab.cx - stageRect.left) * kk - grab.dx;
    const py = (grab.cy - stageRect.top) * kk - grab.dy;
    const { x, y } = dragClamp(px, py);
    placeBone(x, y, 0);
    const d = distance(boneCenter(x, y), HOUSE.mat);
    const near = d < WARN;
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

  // ---------- perro asomado ----------
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
  function peekHits(side, y) {
    // rejilla 3x5 sobre el rect de 48x80 px pegado al borde
    const hits = [];
    const x0 = side === 'left' ? 0 : window.innerWidth - 48;
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 5; j++) {
        const x = x0 + 8 + i * 16;
        const yy = y + 8 + j * 16;
        for (const el of document.elementsFromPoint(x, yy)) {
          if (el === peek || peek?.contains(el)) continue;
          if (el.closest?.(INTERACTIVE)) { hits.push(el); break; }
        }
      }
    }
    return hits;
  }
  function forbidden(side, y) {
    const R = { left: side === 'left' ? 0 : window.innerWidth - 48, top: y, right: side === 'left' ? 48 : window.innerWidth, bottom: y + 80 };
    const blockers = ['#nav', '#rig-hit', '#toast', '#yard-handle', '#marker', '[data-no-peek]'];
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
    if (margin < 56 && peekHits(side, y).length) return true;
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
      hidden: document.hidden, reduced: reduced(), dragging: html.classList.contains('is-dragging'),
      sheetOpen: html.classList.contains('sheet-open'), state, idleMs: performance.now() - lastInput, width: window.innerWidth,
    });
    if (!ok || peekState !== 'hidden') { armPeek(3000 + Math.random() * 3000); return; }
    const spot = placePeek();
    if (!spot) { armPeek(); return; }
    showPeek(spot.side, spot.y, 2200 + Math.random() * 1300);
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

  // ---------- pausas ----------
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
  if ('ResizeObserver' in window) new ResizeObserver(() => { measure(); placeHandle(); }).observe(stage);
  window.addEventListener('scroll', () => { stageRect = null; }, { passive: true });

  // ---------- eventos ----------
  feedBtn?.addEventListener('click', feed);
  document.addEventListener('mtc:lang', () => {
    if (lastAnnounce) announce(lastAnnounce);
    renderCount();
    renderKey();
  });
  coarseMQ.addEventListener?.('change', renderKey);

  // ---------- aserciones DEV ----------
  if (import.meta.env.DEV) {
    if (DOG.h > HOUSE.doorRect[3] + 1) console.warn('[dog] el perro no cabe por la puerta');
    if (HOUSE.insideX + DOG.w >= HOUSE.jambL) console.warn('[dog] el perro en reposo asoma por la jamba');
    const clipRect = yard.querySelector('#yard-clip rect');
    if (clipRect && Number(clipRect.getAttribute('x')) !== HOUSE.doorRect[0]) console.warn('[dog] el clip no empieza en la jamba izquierda');
  }

  // ---------- arranque ----------
  measure();
  placeDog(HOUSE.insideX, 0);
  placeBone(spawnX(), BONE.y, 0);
  renderCount();
  renderKey();
  announce('idle');
  setFeedEnabled(true);
  handle.hidden = false;
  showHintOnce();
  let firstScroll = false;
  window.addEventListener('scroll', () => { if (!firstScroll) { firstScroll = true; armPeek(10000 + Math.random() * 8000); } }, { passive: true, once: true });
  armPeek(14000 + Math.random() * 8000);

  return {
    get state() { return state; },
    get bone() { return { ...bonePos, state: boneState }; },
    feed,
    peek(side) { const spot = placePeek(side) || { side: side || 'left', y: Math.round(window.innerHeight * 0.45) }; showPeek(spot.side, spot.y, 4000); },
    hidePeek: () => hidePeek(true),
    placeBoneNear() { placeBone(300, BONE.y, 0); yard.classList.add('is-near'); },
    force(what) {
      cancelLive();
      switch (what) {
        case 'fetching': placeDog(420, 1); face('right'); dog.classList.add('is-walking'); setState('fetching'); announce('fetching'); break;
        case 'carrying': placeDog(380, 1); face('left'); dogClip.appendChild(bone); placeBone(carriedBoneX(380, 'left'), BONE_CARRY_Y, 14); dog.classList.add('is-walking'); setState('carrying'); break;
        case 'peek-left': this.peek('left'); break;
        case 'peek-right': this.peek('right'); break;
        case 'hidden': hidePeek(true); break;
        default: dog.classList.remove('is-walking'); stage.appendChild(bone); placeDog(HOUSE.insideX, 0); placeBone(560, BONE.y, 0); setState('inHouse');
      }
    },
    debugRects() {
      measure();
      return { stage: stageRect && { w: stageRect.width, h: stageRect.height }, k: k(), dogX, bone: bonePos, house: HOUSE, door: HOUSE.doorRect, state, boneState };
    },
    debugPeekHits() {
      if (!peek || peek.hidden) return { visible: false, hits: [] };
      const y = parseFloat(peek.style.top) || 0;
      return { visible: true, side: peek.dataset.side, y, hits: peekHits(peek.dataset.side, y).map((el) => el.tagName + (el.id ? '#' + el.id : '') + '.' + String(el.className).slice(0, 30)) };
    },
    destroy() { drag.destroy(); cancelLive(); cooldown?.cancel(); peekTimer?.cancel(); peekHold?.cancel(); },
  };
}
