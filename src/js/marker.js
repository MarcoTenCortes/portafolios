// marker.js: el rotulador gigante. Un clic lo coge (sigue al puntero como si fuera el cursor), se pinta
// manteniendo pulsado el boton principal, y se suelta con clic derecho (o Escape; en tactil, un toque sin
// mover). La tinta vive solo en memoria y es relativa a la seccion donde empezo cada trazo (sec, w0), asi
// que aguanta cambios de idioma y de ancho: un ResizeObserver re-ancla los grupos.
import { clamp, clampToViewport, fractionOf } from './play/geom.js';
import { INK_LIMITS, appendPoint, midpointPathD, chunkStroke, simplify, evict, isFull, anchorTransform } from './play/ink.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const EASE_OUT = 'cubic-bezier(.2,.7,.2,1)';
const LYING_ROT = -12;
const HELD_ROT = -50;

function storage(kind) {
  try { return window[kind]; } catch { return null; }
}

export function initMarker(root, { i18n, showToast } = {}) {
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
  const t = (k) => (i18n ? i18n.t(k) : k);
  const html = document.documentElement;

  // ---------- anclas (secciones + footer), en coordenadas de documento ----------
  const anchors = new Map();
  for (const el of document.querySelectorAll('main section[id]')) anchors.set(el.id, el);
  const footer = document.querySelector('footer');
  if (footer) anchors.set('footer', footer);
  let rects = new Map();

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
  const strokes = []; // { id, sec, w0, pts, paths, width }
  const groups = new Map(); // sec -> <g>
  function groupTransform(sec, g) {
    const r = rects.get(sec);
    if (!r) return;
    const w0 = strokes.find((s) => s.sec === sec)?.w0 || r.width;
    g.setAttribute('transform', anchorTransform({ left: r.left, top: r.top, width: r.width }, w0, 0, 0));
  }
  function groupFor(sec) {
    let g = groups.get(sec);
    if (!g) {
      g = document.createElementNS(SVG_NS, 'g');
      g.dataset.sec = sec;
      ink.appendChild(g);
      groups.set(sec, g);
      groupTransform(sec, g); // sin esto el primer trazo de una seccion se pintaba en el origen del documento
    }
    return g;
  }
  function anchorAll() {
    ink.style.height = `${document.documentElement.scrollHeight}px`;
    for (const [sec, g] of groups) groupTransform(sec, g);
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
    for (const chunk of chunkStroke(stroke.pts)) newPath(stroke).setAttribute('d', midpointPathD(chunk));
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
  const baseWidth = () => (coarseMQ.matches ? 12 : 14);

  // ---------- rotulador: posicion y estados ----------
  const size = () => (coarseMQ.matches ? { w: 160, h: 42 } : { w: 200, h: 52 });
  let place = { sec: 'proyectos', fx: coarseMQ.matches ? 0.06 : 0.8, fy: 0.975 }; // donde esta la punta (fracciones de su seccion)
  let state = 'lying';
  let tip = { x: 0, y: 0 }; // punta en coordenadas de cliente mientras esta cogido
  let rot = HELD_ROT;
  let raf = 0;
  let painting = null; // trazo en curso { stroke, queue, path, chunkCount, origin, pressures }

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
    const { w, h } = size();
    const r = rects.get(place.sec);
    let { x, y } = tipDoc();
    x = clampToViewport({ x, y }, { w, h }, gutter(), { w: window.innerWidth }).x;
    if (r) y = clamp(y, r.top + h / 2, r.top + r.height - h / 2);
    marker.classList.remove('is-held');
    marker.style.position = 'absolute';
    marker.style.left = `${Math.round(x)}px`;
    marker.style.top = `${Math.round(y - h / 2)}px`;
    marker.style.transform = `rotate(${LYING_ROT}deg)`;
    marker.style.willChange = '';
    if (animateFrom && canAnimate()) {
      setState('settling');
      const a = marker.animate([
        { transform: `rotate(${HELD_ROT}deg) scale(1.04)` },
        { transform: 'rotate(-8deg) scale(1.01)', offset: 0.55 },
        { transform: 'rotate(-14deg) scale(1)', offset: 0.8 },
        { transform: `rotate(${LYING_ROT}deg) scale(1)` },
      ], { duration: 260, easing: EASE_OUT });
      a.finished.catch(() => {}).then(() => { if (state === 'settling') setState('lying'); });
    } else setState('lying');
  }
  function heldTransform(cx, cy, angle = rot) {
    const { h } = size();
    return `translate3d(${cx.toFixed(1)}px, ${(cy - h / 2).toFixed(1)}px, 0) rotate(${angle}deg) scale(1.04)`;
  }
  function follow() {
    raf = 0;
    marker.style.transform = heldTransform(tip.x, tip.y);
  }

  // ---------- coger / soltar ----------
  function pick(e) {
    if (state !== 'lying') return;
    hideHint();
    const { h } = size();
    const fromX = (parseFloat(marker.style.left) || 0) - window.scrollX;
    const fromY = (parseFloat(marker.style.top) || 0) + h / 2 - window.scrollY;
    tip = { x: e.clientX, y: e.clientY };
    rot = HELD_ROT;
    setState('held');
    marker.classList.add('is-held');
    html.classList.add('is-inking');
    marker.style.position = 'fixed';
    marker.style.left = '0px';
    marker.style.top = '0px';
    marker.style.willChange = 'transform';
    marker.style.transform = heldTransform(tip.x, tip.y);
    if (canAnimate()) {
      marker.animate([
        { transform: `translate3d(${fromX.toFixed(1)}px, ${(fromY - h / 2).toFixed(1)}px, 0) rotate(${LYING_ROT}deg) scale(1)` },
        { transform: heldTransform(tip.x, tip.y) },
      ], { duration: 150, easing: EASE_OUT });
    }
    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('pointerup', onUp, true);
    document.addEventListener('pointercancel', onUp, true);
    document.addEventListener('contextmenu', onContext, true);
    document.addEventListener('click', blockClick, true);
    document.addEventListener('keydown', onKey);
    window.addEventListener('blur', endStroke);
    document.addEventListener('visibilitychange', onVisibility);
    showToast?.(t(coarseMQ.matches ? 'play.marker.pick_hint_touch' : 'play.marker.pick_hint'), 3200);
  }
  function drop() {
    if (state !== 'held') return;
    endStroke();
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerdown', onDown, true);
    document.removeEventListener('pointerup', onUp, true);
    document.removeEventListener('pointercancel', onUp, true);
    document.removeEventListener('contextmenu', onContext, true);
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('blur', endStroke);
    document.removeEventListener('visibilitychange', onVisibility);
    html.classList.remove('is-inking');
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    // el clic que suelta no debe llegar a lo que hay debajo
    setTimeout(() => document.removeEventListener('click', blockClick, true), 0);
    const doc = { x: tip.x + window.scrollX, y: tip.y + window.scrollY };
    const sec = anchorFor(doc.y) || place.sec;
    const r = rects.get(sec);
    if (r) {
      const f = fractionOf(doc, { left: r.left, top: r.top, width: r.width, height: r.height });
      place = { sec, fx: f.fx, fy: f.fy };
    }
    lay(true);
  }
  function blockClick(e) {
    e.preventDefault();
    e.stopPropagation();
  }
  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); drop(); }
  }
  function onContext(e) {
    e.preventDefault();
    e.stopPropagation();
    drop();
  }
  function onVisibility() { if (document.hidden) endStroke(); }

  // ---------- seguir al puntero y pintar ----------
  function onMove(e) {
    if (state !== 'held') return;
    if (painting) {
      const list = e.getCoalescedEvents?.();
      for (const ev of (list && list.length ? list : [e])) {
        painting.queue.push(ev.clientX, ev.clientY, ev.pressure || 0.5, ev.pointerType === 'pen' ? 1 : 0);
      }
      painting.vx = e.clientX - tip.x;
    }
    tip = { x: e.clientX, y: e.clientY };
    if (!raf) raf = requestAnimationFrame(painting ? flush : follow);
  }
  function onDown(e) {
    if (state !== 'held' || !e.isPrimary) return;
    if (e.button === 2) { e.preventDefault(); return; } // el contextmenu suelta
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    tip = { x: e.clientX, y: e.clientY };
    startStroke(e);
  }
  function onUp(e) {
    if (state !== 'held' || !painting) return;
    const moved = painting.moved;
    endStroke();
    // en tactil, un toque sin mover suelta el rotulador
    if (!moved && e.pointerType === 'touch') drop();
  }
  function startStroke(e) {
    const docY = e.clientY + window.scrollY;
    const sec = anchorFor(docY) || 'proyectos';
    const r = rects.get(sec);
    const stroke = { id: ++strokeSeq, sec, w0: r ? r.width : window.innerWidth, pts: [], paths: [], width: baseWidth() };
    strokes.push(stroke);
    painting = { stroke, queue: [e.clientX, e.clientY, e.pressure || 0.5, e.pointerType === 'pen' ? 1 : 0], path: null, chunkCount: 0, origin: r ? { x: r.left, y: r.top } : { x: 0, y: 0 }, pressures: [], vx: 0, moved: false, widthLocked: false };
    enforceLimits();
    if (!raf) raf = requestAnimationFrame(flush);
  }
  function flush() {
    raf = 0;
    if (!painting) { follow(); return; }
    const { stroke, queue } = painting;
    const sx = window.scrollX;
    const sy = window.scrollY;
    let drawn = false;
    for (let i = 0; i < queue.length; i += 4) {
      if (queue[i + 3] && painting.pressures.length < 6) painting.pressures.push(queue[i + 2]);
      if (isFull(stroke.pts)) continue;
      if (appendPoint(stroke.pts, queue[i] + sx - painting.origin.x, queue[i + 1] + sy - painting.origin.y)) drawn = true;
    }
    queue.length = 0;
    if (drawn) {
      if (stroke.pts.length > 4) painting.moved = true;
      if (painting.pressures.length >= 6 && !painting.widthLocked) {
        const p = painting.pressures.slice().sort((a, b) => a - b)[3];
        stroke.width = Math.round(baseWidth() * (0.6 + 0.8 * p) * 10) / 10;
        painting.widthLocked = true;
        for (const path of stroke.paths) path.setAttribute('stroke-width', String(stroke.width));
      }
      const n = stroke.pts.length / 2;
      const chunk = INK_LIMITS.chunk;
      const chunkIndex = Math.floor((n - 1) / (chunk - 1));
      if (chunkIndex !== painting.chunkCount - 1 || !painting.path) {
        painting.chunkCount = chunkIndex + 1;
        painting.path = newPath(stroke);
      }
      painting.path.setAttribute('d', midpointPathD(stroke.pts.slice(chunkIndex * (chunk - 1) * 2)));
    }
    rot = HELD_ROT + clamp(painting.vx * 0.15, -8, 8);
    marker.style.transform = heldTransform(tip.x, tip.y, rot);
  }
  function endStroke() {
    if (!painting) return;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    flush();
    const { stroke } = painting;
    painting = null;
    rot = HELD_ROT;
    if (stroke.pts.length < 4) {
      // un punto suelto: una gota de tinta redonda
      if (stroke.pts.length === 2) {
        stroke.pts.push(stroke.pts[0] + 0.5, stroke.pts[1]);
        rebuild(stroke);
      } else {
        strokes.splice(strokes.indexOf(stroke), 1);
        stroke.paths.forEach((p) => p.remove());
      }
    } else {
      stroke.pts = simplify(stroke.pts, 0.6);
      rebuild(stroke);
    }
    if (state === 'held') marker.style.transform = heldTransform(tip.x, tip.y);
  }

  // ---------- pista y coger con clic ----------
  marker.addEventListener('click', (e) => {
    if (state !== 'lying') return;
    e.preventDefault();
    pick(e);
  });
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
        hint.textContent = t('play.marker.hint');
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
    drop,
    place(sec, fx, fy) { place = { sec, fx, fy }; lay(false); },
    demoHold(cx, cy) { pick({ clientX: cx, clientY: cy }); },
    destroy() { drop(); },
  };
}
