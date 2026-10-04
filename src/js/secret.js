// secret.js: objetos ocultos del hero. Solo se ven bajo la luz del raton: la lente (.hero__secret-lens) sigue al foco
// (evento mtc:glow de glow.js, px de cliente) y el dibujo de dentro (.hero__secret-art) se contra-traslada; una
// lectura del rect del hero por frame absorbe el scroll y un scroll pasivo reproyecta el ultimo punto (con el raton
// quieto la luz no se mueve, pero el hero si). La lente se apaga solo cuando la luz se apaga (nunca por inactividad:
// el visitante se para a mirar) o al abrir la ficha o el menu. La pista (.hero__secret-hint: el rack con el perro,
// tenue, cuando Marco te mira con la lampara encendida) es CSS puro. Las medidas del hero (--secret-w/h, --copy-top)
// las escribe un ResizeObserver: el CSS ancla los objetos al escritorio con ellas.
export function initSecret(hero) {
  const layer = hero?.querySelector('.hero__secret');
  const lens = layer?.querySelector('.hero__secret-lens');
  const art = lens?.querySelector('.hero__secret-art');
  if (!layer || !lens || !art) return null;
  const html = document.documentElement;
  const copy = hero.querySelector('.hero__copy');
  const coarseMQ = window.matchMedia('(hover: none)');

  let state = 'off'; // off | on
  let last = null;   // ultimo punto de la luz (px de cliente)
  let lx = 0;        // centro de la lente (px del hero)
  let ly = 0;
  let raf = 0;

  // como glow.js: sin raton (tactil) nunca hay luz, asi que la capa (y su pista) no se muestra
  const touch = () => coarseMQ.matches && navigator.maxTouchPoints > 0;
  const blocked = () => html.classList.contains('pdialog-open') || html.classList.contains('sheet-open');
  const ready = () => layer.classList.toggle('is-ready', !touch());

  function size() {
    const r = hero.getBoundingClientRect();
    layer.style.setProperty('--secret-w', `${Math.round(r.width * 100) / 100}px`);
    layer.style.setProperty('--secret-h', `${Math.round(r.height * 100) / 100}px`);
    if (copy) layer.style.setProperty('--copy-top', `${Math.round(copy.getBoundingClientRect().top - r.top)}px`);
    if (state === 'on' && last) place(last.x, last.y);
  }
  function place(x, y) {
    const r = hero.getBoundingClientRect();
    lx = Math.round((x - r.left) * 10) / 10;
    ly = Math.round((y - r.top) * 10) / 10;
    lens.style.transform = `translate3d(${lx}px, ${ly}px, 0)`;
    art.style.transform = `translate3d(${-lx}px, ${-ly}px, 0)`;
  }
  function on(x, y) {
    last = { x, y };
    place(x, y);
    if (state !== 'on') {
      state = 'on';
      lens.classList.add('is-on');
    }
  }
  function off() {
    if (state !== 'on') return;
    state = 'off';
    lens.classList.remove('is-on');
  }
  // si la luz ya estaba encendida (el modulo llega tarde, o se cierra la ficha con el raton quieto), se sincroniza
  function sync() {
    const g = window.MTC?.glow;
    if (g?.state === 'on' && g.position && !blocked()) on(g.position.x, g.position.y);
  }

  const onGlow = (e) => {
    const d = e.detail || {};
    if (!d.on || !Number.isFinite(d.x) || !Number.isFinite(d.y) || blocked()) off();
    else on(d.x, d.y);
  };
  const onScroll = () => {
    if (state !== 'on' || !last || raf) return;
    raf = requestAnimationFrame(() => { raf = 0; if (state === 'on' && last) place(last.x, last.y); });
  };
  const mo = new MutationObserver(() => { if (blocked()) off(); else if (state !== 'on') sync(); });
  mo.observe(html, { attributes: true, attributeFilter: ['class'] });
  const ro = 'ResizeObserver' in window ? new ResizeObserver(size) : null;
  ro?.observe(hero);
  if (copy) ro?.observe(copy);
  size();
  ready();
  coarseMQ.addEventListener?.('change', ready);
  document.addEventListener('mtc:glow', onGlow);
  window.addEventListener('scroll', onScroll, { passive: true });
  sync();

  return {
    get state() { return state; },
    get lens() { return { on: state === 'on', x: lx, y: ly }; },
    // gancho de desarrollo y capturas: coloca la lente sin pasar por la luz (px de cliente)
    moveTo(x, y) {
      if (Number.isFinite(x) && Number.isFinite(y) && !blocked()) on(x, y);
      return state;
    },
    hide() { off(); },
    destroy() {
      off();
      cancelAnimationFrame(raf);
      raf = 0;
      ro?.disconnect();
      mo.disconnect();
      coarseMQ.removeEventListener?.('change', ready);
      document.removeEventListener('mtc:glow', onGlow);
      window.removeEventListener('scroll', onScroll);
    },
  };
}
