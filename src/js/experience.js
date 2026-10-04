// experience.js: escenas detras de una seccion (initScenes), con dos usos: Experiencia (initExperience) y
// Formacion (initEducation). Detras de toda la seccion hay una capa (.scenes) con una escena SVG por entrada
// (src/partials/exp-<id>.svg y edu-<id>.svg, estampadas desde lazy.html). Con raton (o lapiz), al pasar por una
// entrada se enciende su escena (.is-on) y la entrada se marca (.is-active); al salir del contenedor del hover se
// apaga tras LEAVE_MS (los huecos entre entradas no cuentan como salida). En tactil (sin hover y con puntero
// grueso) la enciende la entrada que cruza la banda central de la ventana al hacer scroll. Todo se apaga al salir
// la seccion de la pantalla o al abrir una ficha de proyecto. Las transiciones y la deriva son CSS ([css:scenes]
// en site.css).

const LEAVE_MS = 260; // histeresis al salir de la lista
const BAND = '-40% 0px -45% 0px'; // banda central de la ventana (tactil)

// bg: capa de escenas; list: contenedor donde se delega el hover; item: entradas (llevan data-<key>);
// scene: escenas dentro de la capa; key: nombre del dataset que une entrada y escena
export function initScenes(section, { bg, list, item, scene, key }) {
  if (!section) return null;
  const layer = section.querySelector(bg);
  const host = section.querySelector(list);
  const items = [...section.querySelectorAll(item)];
  const scenes = new Map([...(layer?.querySelectorAll(scene) || [])].map((el) => [el.dataset[key], el]));
  if (!layer || !host || !items.length || !scenes.size) return null;

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
    for (const [k, el] of scenes) el.classList.toggle('is-on', k === id);
    for (const li of items) li.classList.toggle('is-active', li.dataset[key] === id);
    return true;
  }
  function hide() {
    clearTimeout(leaveTimer);
    if (current === null) return;
    current = null;
    for (const el of scenes.values()) el.classList.remove('is-on');
    for (const li of items) li.classList.remove('is-active');
  }

  // ---------- raton y lapiz: hover delegado en el contenedor (nunca touch: un toque no es pasar por encima) ----------
  const fine = (e) => e.pointerType === 'mouse' || e.pointerType === 'pen';
  function onOver(e) {
    if (!fine(e) || dialogOpen()) return;
    const li = e.target.closest?.(item);
    if (li) show(li.dataset[key]);
    else clearTimeout(leaveTimer); // en un hueco del contenedor: se queda la ultima escena
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
  host.addEventListener('pointerover', onOver);
  host.addEventListener('pointermove', onMove, { passive: true });
  host.addEventListener('pointerleave', onLeave);

  // ---------- tactil: la entrada que cruza la banda central (como el scroll-spy de site.js) ----------
  function syncTouch() {
    bandIO?.disconnect();
    bandIO = null;
    if (!touchMQ.matches || !('IntersectionObserver' in window)) return;
    bandIO = new IntersectionObserver((entries) => {
      if (dialogOpen()) return;
      for (const entry of entries) if (entry.isIntersecting) show(entry.target.dataset[key]);
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
      host.removeEventListener('pointerover', onOver);
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerleave', onLeave);
      touchMQ.removeEventListener?.('change', syncTouch);
      bandIO?.disconnect();
      sectionIO?.disconnect();
      dialogMO.disconnect();
    },
  };
}

// Experiencia: una escena por entrada de la linea temporal (minsait, ntt, dynos)
export function initExperience(section) {
  return initScenes(section, { bg: '#exp-bg', list: '.timeline', item: '.timeline__item[data-exp]', scene: '.scenes__scene[data-exp]', key: 'exp' });
}

// Formacion: una escena por bloque (uni: titulaciones; certs: tarjeta de certificaciones); el hover se delega en la
// rejilla que contiene los dos
export function initEducation(section) {
  return initScenes(section, { bg: '#edu-bg', list: '.education__grid', item: '[data-edu]', scene: '.scenes__scene[data-edu]', key: 'edu' });
}
