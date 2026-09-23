// projects.js: la ficha de cada proyecto como una subpágina por encima de la página (un único <dialog>).
// Estados en data-state del dialog: closed → opening → open → closing → closed.
// Cada ficha es un fragmento src/partials/projects/<id>.html que se carga bajo demanda (un chunk por ficha) y se
// traduce al insertarlo; la convención está en src/partials/projects/README.md.
// Enlace profundo: abrir empuja #proyecto/<id> al historial; atrás la cierra y adelante la reabre.

const FRAGMENTS = import.meta.glob('../partials/projects/*.html', { query: '?raw', import: 'default' });
const ID_RE = /^[a-z0-9-]{1,32}$/;
const HASH_RE = /^#proyecto\/([a-z0-9-]{1,32})$/;
const DURATION = 260;
const EASE_OUT = 'cubic-bezier(0.2, 0.7, 0.2, 1)';
const EASE_IN = 'cubic-bezier(0.4, 0, 1, 1)';

export function initProjects({ i18n, showToast }) {
  const dialog = document.getElementById('project-dialog');
  if (!dialog) return null;
  const panel = dialog.querySelector('.pdialog__panel');
  const body = dialog.querySelector('.pdialog__body');
  const file = dialog.querySelector('.pdialog__file');
  const grid = document.querySelector('.projects__grid');
  const reducedMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  const sheetMQ = window.matchMedia('(max-width: 767px)');

  const cache = new Map(); // id -> html
  let state = 'closed';
  let current = null;
  let returnTo = null; // a quién se devuelve el foco al cerrar
  let pushed = false; // la entrada #proyecto/<id> del historial la pusimos nosotros
  let seq = 0; // invalida aperturas en vuelo (dos clics seguidos, cerrar mientras carga)
  let anim = null;
  let downOnBackdrop = false;

  const setState = (s) => { state = s; dialog.dataset.state = s; };
  const hashId = () => (HASH_RE.exec(window.location.hash) || [])[1] || null;
  const cleanUrl = () => window.location.pathname + window.location.search;
  const cardOf = (id) => grid?.querySelector(`.card[data-project="${id}"]`) || null;

  function load(id) {
    if (cache.has(id)) return Promise.resolve(cache.get(id));
    const loader = FRAGMENTS[`../partials/projects/${id}.html`];
    if (!loader) return Promise.resolve(null);
    return loader().then((html) => { cache.set(id, html); return html; }, () => null);
  }

  // Panel: WAAPI sobre transform/opacity. El velo (::backdrop) va por CSS con @starting-style y data-state.
  function animatePanel(entering) {
    anim?.cancel();
    anim = null;
    if (reducedMQ.matches || !('animate' in panel)) return Promise.resolve();
    const away = sheetMQ.matches ? 'translate3d(0, 40px, 0)' : 'translate3d(0, 16px, 0) scale(0.985)';
    const frames = [{ opacity: 0, transform: away }, { opacity: 1, transform: 'none' }];
    const a = panel.animate(entering ? frames : frames.reverse(), {
      duration: entering ? DURATION : DURATION - 60,
      easing: entering ? EASE_OUT : EASE_IN,
      fill: 'forwards',
    });
    anim = a;
    return a.finished.then(() => { if (entering && anim === a) { a.cancel(); anim = null; } }, () => {});
  }

  function finishClose() {
    anim?.cancel();
    anim = null;
    if (dialog.open) dialog.close();
    setState('closed');
    document.documentElement.classList.remove('pdialog-open');
    const target = returnTo;
    returnTo = null;
    if (target && target.isConnected) target.focus({ preventScroll: true });
  }

  async function open(id, { push = true, opener } = {}) {
    if (typeof id !== 'string' || !ID_RE.test(id)) return false;
    if ((state === 'open' || state === 'opening') && current === id) return true;
    const token = ++seq;
    const html = await load(id);
    if (token !== seq) return false;
    if (!html) {
      showToast?.(i18n.t('projects.detail.missing'), 2400);
      if (hashId() === id) window.history.replaceState(null, '', cleanUrl());
      return false;
    }
    if (state === 'closing') finishClose();
    const wasOpen = state === 'open' || state === 'opening';

    body.innerHTML = html;
    i18n.translate(body);
    file.textContent = `${id}.md`;
    current = id;
    if (!wasOpen) {
      const from = opener !== undefined ? opener : document.activeElement;
      returnTo = from && from !== document.body ? from : cardOf(id)?.querySelector('.card__more') || null;
    }
    if (push) {
      if (wasOpen && pushed) window.history.replaceState({ project: id }, '', `#proyecto/${id}`);
      else window.history.pushState({ project: id }, '', `#proyecto/${id}`);
      pushed = true;
    }

    body.scrollTop = 0;
    if (wasOpen) { body.focus({ preventScroll: true }); return true; }
    setState('opening');
    document.documentElement.classList.add('pdialog-open');
    dialog.showModal();
    body.focus({ preventScroll: true });
    await animatePanel(true);
    if (token === seq && state === 'opening') setState('open');
    return true;
  }

  // Cierre desde la interfaz (cruz, Volver, Escape, clic fuera) o desde el historial (atrás).
  function close({ fromHistory = false } = {}) {
    if (state === 'closed' || state === 'closing') return;
    seq++;
    if (!fromHistory) {
      if (pushed && window.history.state?.project === current) window.history.back();
      else if (hashId()) window.history.replaceState(null, '', cleanUrl());
    }
    pushed = false;
    setState('closing');
    const token = seq;
    animatePanel(false).then(() => { if (token === seq && state === 'closing') finishClose(); });
  }

  // ---------- eventos del diálogo ----------
  dialog.addEventListener('cancel', (e) => { e.preventDefault(); close(); }); // Escape: se anima
  dialog.addEventListener('close', () => {
    // cerrado por el navegador sin pasar por close() (p. ej. un segundo Escape que ya no es cancelable)
    if (state === 'closed' || state === 'closing') return;
    if (pushed && window.history.state?.project === current) window.history.back();
    else if (hashId()) window.history.replaceState(null, '', cleanUrl());
    pushed = false;
    finishClose();
  });
  // clic fuera del panel: el propio <dialog> ocupa la pantalla y el panel va dentro. Solo cuenta si el gesto
  // empezó también fuera (arrastrar para seleccionar texto y soltar fuera no cierra); un clic sintético
  // (detail 0, sin pointerdown) también vale.
  dialog.addEventListener('pointerdown', (e) => { downOnBackdrop = e.target === dialog; });
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog && (downOnBackdrop || e.detail === 0)) close();
    else if (e.target.closest('[data-pdialog-close]')) close();
    downOnBackdrop = false;
  });

  window.addEventListener('popstate', (e) => {
    const id = e.state?.project || hashId();
    if (id) {
      if (!(state === 'open' || state === 'opening') || current !== id) {
        pushed = !!e.state?.project;
        open(id, { push: false, opener: undefined });
      }
    } else if (state === 'open' || state === 'opening') {
      pushed = false;
      close({ fromHistory: true });
    }
  });

  // ---------- tarjetas ----------
  const titleOf = (card) => card.querySelector('h3')?.textContent.trim() || '';
  function labelButtons() {
    for (const card of grid?.querySelectorAll('.card[data-project]') || []) {
      card.querySelector('.card__more')?.setAttribute('aria-label', i18n.t('projects.detail.more_aria', { title: titleOf(card) }));
    }
  }
  labelButtons();
  document.addEventListener('mtc:lang', labelButtons);

  grid?.addEventListener('click', (e) => {
    const card = e.target.closest('.card[data-project]');
    if (!card) return;
    const control = e.target.closest('a, button');
    if (control && !control.classList.contains('card__more')) return; // enlaces y botones propios de la tarjeta
    if (!control && String(window.getSelection?.() || '').trim()) return; // estaba seleccionando texto
    open(card.dataset.project, { opener: card.querySelector('.card__more') || card });
  });
  // precarga la ficha al acercarse a la tarjeta, para que el clic abra sin esperar
  const warm = (e) => {
    const card = e.target.closest?.('.card[data-project]');
    if (card) load(card.dataset.project);
  };
  grid?.addEventListener('pointerover', warm, { passive: true });
  grid?.addEventListener('focusin', warm);

  setState('closed');

  // enlace profundo: /#proyecto/<id> abre la ficha cuando todo lo demás ya está listo
  const initial = hashId();
  if (initial) {
    (window.MTC?.ready || Promise.resolve()).then(() => {
      if (hashId() !== initial || state !== 'closed') return;
      window.history.replaceState({ project: initial }, '', window.location.href);
      pushed = false;
      open(initial, { push: false, opener: null });
    });
  }

  return {
    open: (id, opts) => open(id, opts),
    close: () => close(),
    get current() { return state === 'closed' ? null : current; },
    get state() { return state; },
  };
}
