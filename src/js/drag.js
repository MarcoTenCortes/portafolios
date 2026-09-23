// drag.js: arrastre con Pointer Events y captura del puntero, compartido por el rotulador y el hueso.
// El helper no lee layout: convierte eventos en llamadas onStart/onMove/onEnd/onCancel y nada más.
// El elemento arrastrable necesita en CSS: touch-action:none; user-select:none; -webkit-user-drag:none.

export function attachDrag(el, handlers = {}, { slop = 4, button = 0 } = {}) {
  const html = document.documentElement;
  let pointerId = null;
  let active = false;   // hay un puntero capturado
  let started = false;  // se superó el umbral y se avisó onStart
  let startX = 0;
  let startY = 0;
  let suppressClick = false;

  function cleanup() {
    window.removeEventListener('blur', onBlur);
    document.removeEventListener('visibilitychange', onVisibility);
    document.removeEventListener('keydown', onKey);
    html.classList.remove('is-dragging');
    if (pointerId != null) {
      try { if (el.hasPointerCapture?.(pointerId)) el.releasePointerCapture(pointerId); } catch { /* ya liberado */ }
    }
    pointerId = null;
  }

  function end(reason, e) {
    if (!active) return;
    active = false;
    const wasStarted = started;
    started = false;
    cleanup();
    if (!wasStarted) return; // un tap sin movimiento no es un arrastre
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 0);
    if (reason === 'up') handlers.onEnd?.(e);
    else handlers.onCancel?.(reason, e);
  }

  const onBlur = () => end('blur');
  const onVisibility = () => { if (document.hidden) end('hidden'); };
  const onKey = (e) => { if (e.key === 'Escape') end('escape', e); };

  function onPointerDown(e) {
    if (!e.isPrimary || e.button !== button || active) return;
    if (html.classList.contains('sheet-open')) return;
    e.preventDefault();
    active = true;
    started = false;
    pointerId = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;
    try { el.setPointerCapture(e.pointerId); } catch { /* sin captura seguimos igual */ }
    html.classList.add('is-dragging');
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('keydown', onKey);
  }

  function onPointerMove(e) {
    if (!active || e.pointerId !== pointerId) return;
    if (!started) {
      if (Math.hypot(e.clientX - startX, e.clientY - startY) < slop) return;
      started = true;
      handlers.onStart?.(e);
    }
    const coalesced = e.getCoalescedEvents?.();
    handlers.onMove?.(e, coalesced && coalesced.length ? coalesced : [e]);
  }

  function onPointerUp(e) {
    if (!active || e.pointerId !== pointerId) return;
    end('up', e);
  }
  function onPointerCancel(e) {
    if (!active || e.pointerId !== pointerId) return;
    end('cancel', e);
  }
  function onLostCapture(e) {
    if (!active || e.pointerId !== pointerId) return;
    end('lostcapture', e);
  }
  function onClick(e) {
    if (suppressClick) { e.preventDefault(); e.stopPropagation(); }
  }

  el.addEventListener('pointerdown', onPointerDown);
  el.addEventListener('pointermove', onPointerMove);
  el.addEventListener('pointerup', onPointerUp);
  el.addEventListener('pointercancel', onPointerCancel);
  el.addEventListener('lostpointercapture', onLostCapture);
  el.addEventListener('click', onClick, true);

  return {
    get active() { return active; },
    get started() { return started; },
    cancel(reason = 'api') { end(reason); },
    destroy() {
      end('destroy');
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerCancel);
      el.removeEventListener('lostpointercapture', onLostCapture);
      el.removeEventListener('click', onClick, true);
    },
  };
}
