// marker.js: el rotulador gigante. Se coge (pointerdown + arrastre), dibuja mientras se mueve y se
// suelta donde se deja. Estados: lying -> held -> settling -> lying. La tinta vive solo en memoria.
// Coordenadas: la tinta es relativa a la seccion donde empezo cada trazo (sec, w0) y se re-ancla con
// un ResizeObserver; el rotulador se guarda como fracciones de su seccion (sec, fx, fy).
import { attachDrag } from './drag.js';
import { clamp, clampToViewport, fractionOf } from './play/geom.js';
import { INK_LIMITS, appendPoint, midpointPathD, chunkStroke, simplify, evict, isFull, anchorTransform } from './play/ink.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const EASE_OUT = 'cubic-bezier(.2,.7,.2,1)';
const LYING_ROT = -12;
const HELD_ROT = -50;

function storage(kind) {
  try { return window[kind]; } catch { return null; }
}

export function initMarker(root, { i18n } = {}) {
  if (!root) return null;
  const ink = root.querySelector('#ink');
  const marker = root.querySelector('#marker');
  const hint = root.querySelector('#marker-hint');
  if (!ink || !marker) return null;

  const reducedMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  const coarseMQ = window.matchMedia('(hover: none)');
  const reduced = () => reducedMQ.matches;
  const canAnimate = () => 'animate' in Element.prototype && !reduced();
  const gutter = () => (window.innerWidth >= 1080 ? 48 : window.innerWidth >= 768 ? 40 : 20);

  // ---------- anclas (secciones + footer) ----------
  const anchors = new Map();
  for (const el of document.querySelectorAll('main section[id]')) anchors.set(el.id, el);
  const footer = document.querySelector('footer');
  if (footer) anchors.set('footer', footer);
  let rects = new Map(); // id -> { left, top, width, height } en coordenadas de documento

  function measure() {
    const sx = window.scrollX;
    const sy = window.scrollY;
    const next = new Map();
    for (const [id, el] of anchors) {
      const r = el.getBoundingClientRect();
      next.set(id, { left: r.left + sx, top: r.top + sy, width: r.width, height: r.height });
    }
    rects = next;
  }
  function anchorFor(docY) {
    let best = null;
    let bestDist = Infinity;
    for (const [id, r] of rects) {
      if (docY >= r.top && docY < r.top + r.height) return id;
      const d = docY < r.top ? r.top - docY : docY - (r.top + r.height);
      if (d < bestDist) { bestDist = d; best = id; }
    }
    return best;
  }

  // ---------- tinta ----------
  const strokes = []; // { sec, w0, pts, paths: [<path>], width }
  const groups = new Map(); // sec -> <g>
  function groupFor(sec) {
    let g = groups.get(sec);
    if (!g) {
      g = document.createElementNS(SVG_NS, 'g');
      g.dataset.sec = sec;
      ink.appendChild(g);
      groups.set(sec, g);
    }
    return g;
  }
  function anchorAll() {
    ink.style.height = `${document.documentElement.scrollHeight}px`;
    for (const [sec, g] of groups) {
      const r = rects.get(sec);
      if (!r) continue;
      const w0 = strokes.find((s) => s.sec === sec)?.w0 || r.width;
      g.setAttribute('transform', anchorTransform({ left: r.left, top: r.top, width: r.width }, w0, 0, 0));
    }
  }
  function newPath(stroke) {
    const path = document.createElementNS(SVG_NS, 'path');
    path.dataset.stroke = String(stroke.id);
    path.setAttribute('stroke-width', String(stroke.width));
    groupFor(stroke.sec).appendChild(path);
    stroke.paths.push(path);
    return path;
  }
  function rebuild(stroke) {
    for (const p of stroke.paths) p.remove();
    stroke.paths = [];
    for (const chunk of chunkStroke(stroke.pts)) {
      const p = newPath(stroke);
      p.setAttribute('d', midpointPathD(chunk));
    }
  }
  function dropStroke(stroke, animate = true) {
    const paths = stroke.paths.slice();
    const done = () => paths.forEach((p) => p.remove());
    if (animate && canAnimate()) {
      Promise.all(paths.map((p) => p.animate([{ opacity: 0.78 }, { opacity: 0 }], { duration: 400, fill: 'forwards' }).finished.catch(() => {}))).then(done);
    } else done();
  }
  function enforceLimits() {
    for (const removed of evict(strokes)) dropStroke(removed);
  }
  function clear() {
    for (const s of strokes.splice(0)) dropStroke(s, false);
  }
  let strokeSeq = 0;
  function loadInk(list) {
    for (const s of list) {
      const stroke = { id: ++strokeSeq, sec: s.sec, w0: s.w0, pts: s.pts.slice(), paths: [], width: s.width || baseWidth() };
      strokes.push(stroke);
      rebuild(stroke);
    }
    enforceLimits();
    anchorAll();
  }
  function baseWidth() { return coarseMQ.matches ? 12 : 14; }

  // ---------- rotulador ----------
  const size = () => (coarseMQ.matches ? { w: 160, h: 42 } : { w: 200, h: 52 });
  let place = { sec: 'proyectos', fx: coarseMQ.matches ? 0.06 : 0.8, fy: 0.975 }; // punta del rotulador
  let state = 'lying';
  let held = null; // { stroke, pts pendientes, raf, tramo }

  function setState(next) {
    state = next;
    marker.dataset.state = next;
  }
  function tipDoc() {
    const r = rects.get(place.sec) || [...rects.values()][0];
    if (!r) return { x: 0, y: 0 };
    return { x: r.left + place.fx * r.width, y: r.top + place.fy * r.height };
  }
  function lay(animateFrom) {
    // coloca el rotulador tumbado con la punta en tipDoc(), recortado al viewport en x y a la seccion en y
    const { w, h } = size();
    const r = rects.get(place.sec);
    let { x, y } = tipDoc();
    const g = gutter();
    const clamped = clampToViewport({ x, y }, { w, h }, g, { w: window.innerWidth });
    x = clamped.x;
    if (r) y = clamp(y, r.top + h / 2, r.top + r.height - h / 2);
    marker.style.position = 'absolute';
    marker.style.left = `${Math.round(x)}px`;
    marker.style.top = `${Math.round(y - h / 2)}px`;
    marker.style.transform = `rotate(${LYING_ROT}deg)`;
    if (animateFrom && canAnimate()) {
      const a = marker.animate([
        { transform: `rotate(${HELD_ROT}deg) scale(1.04)` },
        { transform: 'rotate(-8deg) scale(1.01)', offset: 0.55 },
        { transform: 'rotate(-14deg) scale(1)', offset: 0.8 },
        { transform: `rotate(${LYING_ROT}deg) scale(1)` },
      ], { duration: 260, easing: EASE_OUT });
      setState('settling');
      a.finished.catch(() => {}).then(() => { if (state === 'settling') setState('lying'); });
    } else setState('lying');
  }
  function heldTransform(cx, cy, rot = HELD_ROT) {
    const { h } = size();
    return `translate3d(${cx.toFixed(1)}px, ${(cy - h / 2).toFixed(1)}px, 0) rotate(${rot}deg) scale(1.04)`;
  }

  const drag = attachDrag(marker, {
    onStart(e) {
      hideHint();
      setState('held');
      document.documentElement.classList.add('is-inking');
      marker.classList.add('is-held');
      marker.style.willChange = 'transform';
      // punto de partida: donde estaba la punta (coordenadas de cliente) antes de pasar a fixed
      const { h } = size();
      const fromX = (parseFloat(marker.style.left) || 0) - window.scrollX;
      const fromY = (parseFloat(marker.style.top) || 0) + h / 2 - window.scrollY;
      marker.style.position = 'fixed';
      marker.style.left = '0px';
      marker.style.top = '0px';
      marker.style.transform = heldTransform(e.clientX, e.clientY);
      if (canAnimate()) {
        marker.animate([
          { transform: `translate3d(${fromX.toFixed(1)}px, ${(fromY - h / 2).toFixed(1)}px, 0) rotate(${LYING_ROT}deg) scale(1)` },
          { transform: heldTransform(e.clientX, e.clientY) },
        ], { duration: 150, easing: EASE_OUT });
      }
      const docY = e.clientY + window.scrollY;
      const sec = anchorFor(docY) || 'proyectos';
      const r = rects.get(sec);
      const stroke = { id: ++strokeSeq, sec, w0: r ? r.width : window.innerWidth, pts: [], paths: [], width: baseWidth(), pressures: [] };
      strokes.push(stroke);
      held = { stroke, queue: [], raf: 0, path: null, chunkCount: 0, lastX: e.clientX, lastY: e.clientY, vx: 0, origin: r ? { x: r.left, y: r.top } : { x: 0, y: 0 } };
      enforceLimits();
    },
    onMove(e, coalesced) {
      if (!held) return;
      for (const ev of coalesced) {
        held.queue.push(ev.clientX, ev.clientY, ev.pressure || 0.5, ev.pointerType === 'pen' ? 1 : 0);
      }
      if (!held.raf) held.raf = requestAnimationFrame(flush);
    },
    onEnd() { release(); },
    onCancel() { release(); },
  }, { slop: 4 });

  function flush() {
    if (!held) return;
    held.raf = 0;
    const { stroke, queue } = held;
    const sx = window.scrollX;
    const sy = window.scrollY;
    let lastX = held.lastX;
    let lastY = held.lastY;
    let drawn = false;
    for (let i = 0; i < queue.length; i += 4) {
      const cx = queue[i];
      const cy = queue[i + 1];
      if (queue[i + 3] && stroke.pressures.length < 6) stroke.pressures.push(queue[i + 2]);
      held.vx = cx - lastX;
      lastX = cx;
      lastY = cy;
      if (isFull(stroke.pts)) continue;
      const lx = cx + sx - held.origin.x;
      const ly = cy + sy - held.origin.y;
      if (!appendPoint(stroke.pts, lx, ly)) continue;
      drawn = true;
    }
    queue.length = 0;
    held.lastX = lastX;
    held.lastY = lastY;
    if (drawn) {
      if (stroke.pressures.length >= 6 && !stroke.widthLocked) {
        const sorted = stroke.pressures.slice().sort((a, b) => a - b);
        const p = sorted[3];
        stroke.width = Math.round(baseWidth() * (0.6 + 0.8 * p) * 10) / 10;
        stroke.widthLocked = true;
        for (const path of stroke.paths) path.setAttribute('stroke-width', String(stroke.width));
      }
      // tramo actual: los ultimos <= chunk puntos
      const n = stroke.pts.length / 2;
      const chunk = INK_LIMITS.chunk;
      const chunkIndex = Math.floor((n - 1) / (chunk - 1));
      if (chunkIndex !== held.chunkCount - 1 || !held.path) {
        held.chunkCount = chunkIndex + 1;
        held.path = newPath(stroke);
      }
      const start = chunkIndex * (chunk - 1);
      held.path.setAttribute('d', midpointPathD(stroke.pts.slice(start * 2)));
    }
    const rot = HELD_ROT + clamp(held.vx * 0.15, -8, 8);
    marker.style.transform = heldTransform(lastX, lastY, rot);
  }

  function release() {
    if (!held) return;
    if (held.raf) { cancelAnimationFrame(held.raf); held.raf = 0; flush(); }
    const { stroke } = held;
    const tip = { x: held.lastX + window.scrollX, y: held.lastY + window.scrollY };
    held = null;
    document.documentElement.classList.remove('is-inking');
    marker.classList.remove('is-held');
    marker.style.willChange = '';
    // trazo: simplificar y reconstruir; descartar los vacios
    if (stroke.pts.length < 4) {
      strokes.splice(strokes.indexOf(stroke), 1);
      stroke.paths.forEach((p) => p.remove());
    } else {
      stroke.pts = simplify(stroke.pts, 0.6);
      rebuild(stroke);
    }
    // posicion nueva del rotulador
    const sec = anchorFor(tip.y) || place.sec;
    const r = rects.get(sec);
    if (r) {
      const f = fractionOf({ x: tip.x, y: tip.y }, { left: r.left, top: r.top, width: r.width, height: r.height });
      place = { sec, fx: f.fx, fy: f.fy };
    }
    lay(true);
  }

  // ---------- pista ----------
  function hideHint() {
    if (!hint || hint.hidden) return;
    hint.hidden = true;
    try { storage('sessionStorage')?.setItem('play.marker.hint', '1'); } catch { /* nada */ }
  }
  function showHintOnce() {
    let seen = false;
    try { seen = storage('sessionStorage')?.getItem('play.marker.hint') === '1'; } catch { /* nada */ }
    if (seen || !hint || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((en) => en.isIntersecting)) {
        hint.hidden = false;
        hint.textContent = i18n ? i18n.t('play.marker.hint') : hint.textContent;
        io.disconnect();
      }
    }, { threshold: 0.5 });
    io.observe(marker);
  }

  // ---------- re-anclaje ----------
  let rafAnchor = 0;
  function scheduleAnchor() {
    if (rafAnchor) return;
    rafAnchor = requestAnimationFrame(() => {
      rafAnchor = 0;
      measure();
      anchorAll();
      if (state !== 'held') lay(false);
    });
  }
  if ('ResizeObserver' in window) new ResizeObserver(scheduleAnchor).observe(document.body);
  window.addEventListener('resize', scheduleAnchor, { passive: true });
  coarseMQ.addEventListener?.('change', scheduleAnchor);

  // ---------- arranque ----------
  measure();
  anchorAll();
  lay(false);
  marker.hidden = false;
  showHintOnce();

  return {
    get state() { return state; },
    get strokes() { return strokes; },
    clear,
    loadInk,
    drop(sec, fx, fy) { place = { sec, fx, fy }; lay(false); },
    demoHold(cx, cy) {
      setState('held');
      marker.classList.add('is-held');
      marker.style.position = 'fixed';
      marker.style.left = '0px';
      marker.style.top = '0px';
      marker.style.transform = heldTransform(cx, cy);
    },
    destroy() { drag.destroy(); },
  };
}
