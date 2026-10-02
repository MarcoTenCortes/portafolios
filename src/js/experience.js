// experience.js: escenas de la seccion Experiencia. Detras de toda la seccion hay una capa (#exp-bg) con una
// escena SVG por entrada (src/partials/exp-<id>.svg, estampadas desde lazy.html). Con raton (o lapiz), al pasar
// por una entrada de la linea temporal se enciende su escena (.is-on) y la entrada se marca (.is-active); al
// salir de la lista se apaga tras LEAVE_MS (los huecos entre entradas no cuentan como salida). En tactil (sin
// hover y con puntero grueso) la enciende la entrada que cruza la banda central de la ventana al hacer scroll.
// Todo se apaga al salir la seccion de la pantalla o al abrir una ficha de proyecto. Las transiciones y la
// deriva son CSS ([css:exp] en site.css).

const LEAVE_MS = 260; // histeresis al salir de la lista
const BAND = '-40% 0px -45% 0px'; // banda central de la ventana (tactil)

export function initExperience(section) {
  if (!section) return null;
  const bg = section.querySelector('#exp-bg');
  const list = section.querySelector('.timeline');
  const items = [...section.querySelectorAll('.timeline__item[data-exp]')];
  const scenes = new Map([...(bg?.querySelectorAll('.experience__scene[data-exp]') || [])].map((el) => [el.dataset.exp, el]));
  if (!bg || !list || !items.length || !scenes.size) return null;

  const html = document.documentElement;
  // tactil de verdad: sin hover y con puntero grueso (un Chrome headless dice hover: none con pointer: none)
  const touchMQ = window.matchMedia('(hover: none) and (pointer: coarse)');
  const dialogOpen = () => html.classList.contains('pdialog-open');
  let current = null;
  let leaveTimer = 0;
  let bandIO = null;

  function show(id) {
    clearTimeout(leaveTimer);
    if (!scenes.has(id)) return false;
    if (id === current) return true;
    current = id;
    for (const [key, el] of scenes) el.classList.toggle('is-on', key === id);
    for (const li of items) li.classList.toggle('is-active', li.dataset.exp === id);
    return true;
  }
  function hide() {
    clearTimeout(leaveTimer);
    if (current === null) return;
    current = null;
    for (const el of scenes.values()) el.classList.remove('is-on');
    for (const li of items) li.classList.remove('is-active');
  }

  // ---------- raton y lapiz: hover delegado en la lista (nunca touch: un toque no es pasar por encima) ----------
  const fine = (e) => e.pointerType === 'mouse' || e.pointerType === 'pen';
  function onOver(e) {
    if (!fine(e) || dialogOpen()) return;
    const li = e.target.closest?.('.timeline__item[data-exp]');
    if (li) show(li.dataset.exp);
    else clearTimeout(leaveTimer); // en un hueco de la lista: se queda la ultima escena
  }
  // si el puntero ya estaba encima al arrancar (o al cerrarse una ficha) no llega pointerover: basta con moverlo
  function onMove(e) {
    if (current === null) onOver(e);
  }
  function onLeave(e) {
    if (!fine(e)) return;
    clearTimeout(leaveTimer);
    leaveTimer = setTimeout(hide, LEAVE_MS);
  }
  list.addEventListener('pointerover', onOver);
  list.addEventListener('pointermove', onMove, { passive: true });
  list.addEventListener('pointerleave', onLeave);

  // ---------- tactil: la entrada que cruza la banda central (como el scroll-spy de site.js) ----------
  function syncTouch() {
    bandIO?.disconnect();
    bandIO = null;
    if (!touchMQ.matches || !('IntersectionObserver' in window)) return;
    bandIO = new IntersectionObserver((entries) => {
      if (dialogOpen()) return;
      for (const entry of entries) if (entry.isIntersecting) show(entry.target.dataset.exp);
    }, { rootMargin: BAND, threshold: 0 });
    items.forEach((li) => bandIO.observe(li));
  }
  syncTouch();
  touchMQ.addEventListener?.('change', syncTouch);

  // ---------- se apaga al salir la seccion y al abrir una ficha (para que no quede .is-on pegado) ----------
  const sectionIO = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => { for (const entry of entries) if (!entry.isIntersecting) hide(); })
    : null;
  sectionIO?.observe(section);
  let wasOpen = dialogOpen();
  const dialogMO = new MutationObserver(() => {
    if (dialogOpen() === wasOpen) return;
    wasOpen = !wasOpen;
    if (wasOpen) hide();
    else syncTouch(); // al cerrar la ficha, en tactil vuelve la escena de la entrada que este en la banda
  });
  dialogMO.observe(html, { attributes: true, attributeFilter: ['class'] });

  return {
    get current() { return current; },
    show,
    hide,
    destroy() {
      hide();
      list.removeEventListener('pointerover', onOver);
      list.removeEventListener('pointermove', onMove);
      list.removeEventListener('pointerleave', onLeave);
      touchMQ.removeEventListener?.('change', syncTouch);
      bandIO?.disconnect();
      sectionIO?.disconnect();
      dialogMO.disconnect();
    },
  };
}
