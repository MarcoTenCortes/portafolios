// site.js: nav, sheet móvil, scroll-spy, reveals, pausas de bucles, copiar email, footer.

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function showToast(text) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = text;
  toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => { toast.hidden = true; }, 1600);
}

function initNav() {
  const nav = document.getElementById('nav');
  if (!nav) return;
  const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

function initSheet() {
  const burger = document.querySelector('.nav__burger');
  const sheet = document.getElementById('sheet');
  const main = document.getElementById('main');
  const footer = document.querySelector('footer');
  if (!burger || !sheet) return;
  const html = document.documentElement;
  const focusables = () => [...sheet.querySelectorAll('a[href], button:not([disabled])')];
  const extras = () => [document.getElementById('play'), document.getElementById('dog-peek')].filter(Boolean);

  const close = ({ restoreFocus = true } = {}) => {
    if (sheet.hidden) return;
    sheet.hidden = true;
    html.classList.remove('sheet-open');
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', window.MTC.i18n.t('a11y.menu_open'));
    main?.removeAttribute('inert');
    footer?.removeAttribute('inert');
    extras().forEach((el) => el.removeAttribute('inert'));
    if (restoreFocus) burger.focus();
  };
  const open = () => {
    sheet.hidden = false;
    html.classList.add('sheet-open');
    burger.setAttribute('aria-expanded', 'true');
    burger.setAttribute('aria-label', window.MTC.i18n.t('a11y.menu_close'));
    main?.setAttribute('inert', '');
    footer?.setAttribute('inert', '');
    extras().forEach((el) => el.setAttribute('inert', ''));
    focusables()[0]?.focus();
  };

  burger.addEventListener('click', () => (sheet.hidden ? open() : close()));
  sheet.addEventListener('click', (e) => {
    if (e.target.closest('a[href^="#"]')) close({ restoreFocus: false });
  });
  document.addEventListener('keydown', (e) => {
    if (sheet.hidden) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key !== 'Tab') return;
    const items = [burger, ...focusables()];
    const i = items.indexOf(document.activeElement);
    if (e.shiftKey && (i <= 0)) { e.preventDefault(); items[items.length - 1].focus(); }
    else if (!e.shiftKey && i === items.length - 1) { e.preventDefault(); items[0].focus(); }
  });
  window.matchMedia('(min-width: 768px)').addEventListener('change', (e) => { if (e.matches) close({ restoreFocus: false }); });
}

function initLang(i18n) {
  for (const btn of document.querySelectorAll('.lang__btn')) {
    btn.addEventListener('click', () => {
      if (i18n.current !== btn.dataset.lang) i18n.apply(btn.dataset.lang);
    });
  }
}

function initScrollSpy() {
  const sections = [...document.querySelectorAll('main section[id]')];
  const links = [...document.querySelectorAll('.nav__links a[href^="#"], .sheet__list a[href^="#"]')];
  if (!sections.length || !('IntersectionObserver' in window)) return;
  const setCurrent = (id) => {
    for (const a of links) {
      if (a.getAttribute('href') === `#${id}`) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    }
  };
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) if (entry.isIntersecting) setCurrent(entry.target.id);
  }, { rootMargin: '-40% 0px -55% 0px', threshold: 0 });
  sections.forEach((s) => io.observe(s));
}

function initReveals() {
  const items = [...document.querySelectorAll('[data-reveal]')];
  if (!items.length) return;
  // escalonado dentro de cada sección
  for (const section of document.querySelectorAll('section, footer')) {
    const own = [...section.querySelectorAll('[data-reveal]')];
    own.forEach((el, i) => { el.style.transitionDelay = `${Math.min(i, 6) * 60}ms`; });
  }
  const hero = document.getElementById('inicio');
  if (hero) hero.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-in'));
  if (!('IntersectionObserver' in window) || reduced()) {
    items.forEach((el) => el.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-in');
      io.unobserve(entry.target);
    }
  }, { threshold: 0.15, rootMargin: '0px 0px -10% 0px' });
  items.forEach((el) => { if (!el.classList.contains('is-in')) io.observe(el); });
}

function initLoopPausing() {
  const targets = [...document.querySelectorAll('#scene, #yard, .card__media--svg')];
  if (!targets.length) return;
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) entry.target.classList.toggle('is-offscreen', !entry.isIntersecting);
    }, { threshold: 0.05 });
    targets.forEach((t) => io.observe(t));
  }
  document.addEventListener('visibilitychange', () => {
    targets.forEach((t) => t.classList.toggle('is-hidden', document.hidden));
  });
}

function initContact(i18n) {
  const email = document.getElementById('email-action');
  if (email && navigator.clipboard?.writeText) {
    email.addEventListener('click', (e) => {
      e.preventDefault();
      navigator.clipboard.writeText(email.dataset.copy).then(
        () => showToast(i18n.t('contact.copied')),
        () => { window.location.href = email.getAttribute('href'); }
      );
    });
  }
  const press = document.getElementById('press-link');
  if (press && !i18n.t('press.url').trim()) press.remove();
}

function initFooter() {
  const year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());
  const top = document.getElementById('to-top');
  top?.addEventListener('click', (e) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' });
  });
}

export function initSite({ i18n }) {
  initNav();
  initSheet();
  initLang(i18n);
  initScrollSpy();
  initReveals();
  initLoopPausing();
  initContact(i18n);
  initFooter();
  document.addEventListener('mtc:lang', () => {
    const burger = document.querySelector('.nav__burger');
    if (burger) burger.setAttribute('aria-label', i18n.t(burger.getAttribute('aria-expanded') === 'true' ? 'a11y.menu_close' : 'a11y.menu_open'));
  });
}

export { showToast };
