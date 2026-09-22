// i18n: diccionarios planos (clave.con.puntos) empaquetados por Vite, sin fetch.
import es from '../i18n/es.json';

// El ingles se carga bajo demanda (un chunk aparte) para no competir con el primer render.
const DICT = { es };
const LOADERS = { en: () => import('../i18n/en.json') };
async function ensure(lang) {
  if (DICT[lang] || !LOADERS[lang]) return;
  const mod = await LOADERS[lang]();
  DICT[lang] = mod.default || mod;
}
const DEV = import.meta.env.DEV;
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function storageGet(key) {
  try { return window.localStorage.getItem(key); } catch { return null; }
}
function storageSet(key, value) {
  try { window.localStorage.setItem(key, value); } catch { /* sin almacenamiento */ }
}

export const i18n = {
  dict: DICT,
  current: 'es',

  t(key, vars) {
    const table = DICT[this.current] || DICT.es;
    let value = table[key];
    if (value == null) {
      if (DEV) console.warn(`[i18n] clave ausente: ${key} (${this.current})`);
      value = DICT.es[key] ?? key;
    }
    if (vars) {
      for (const [name, v] of Object.entries(vars)) value = value.replaceAll(`{${name}}`, String(v));
    }
    return value;
  },

  init() {
    const saved = storageGet('lang');
    const fromNav = (navigator.language || '').toLowerCase().startsWith('en') ? 'en' : 'es';
    const wanted = saved && LOADERS[saved] || saved === 'es' ? saved : fromNav;
    if (wanted !== 'es') this.apply('es', { silent: true });
    this.apply(wanted, { silent: true });
  },

  apply(lang, { silent = false } = {}) {
    if (!DICT[lang] && LOADERS[lang]) {
      ensure(lang).then(() => this.apply(lang, { silent }), () => {});
      return;
    }
    if (!DICT[lang]) lang = 'es';
    this.current = lang;
    const root = document.documentElement;
    root.lang = lang;

    // texto de elementos hoja
    for (const el of document.querySelectorAll('[data-i18n]')) {
      if (el.id === 'rig-status' || el.hasAttribute('data-i18n-live')) continue; // lo gestionan rig.js / dog.js
      if (DEV && el.children.length > 0) console.warn('[i18n] data-i18n en un elemento con hijos:', el);
      el.textContent = this.t(el.dataset.i18n);
    }

    // atributos: data-i18n-attr="aria-label:clave;href:otra.clave"
    for (const el of document.querySelectorAll('[data-i18n-attr]')) {
      for (const pair of el.dataset.i18nAttr.split(';')) {
        const idx = pair.indexOf(':');
        if (idx < 1) continue;
        const attr = pair.slice(0, idx).trim();
        const key = pair.slice(idx + 1).trim();
        el.setAttribute(attr, this.t(key));
      }
    }

    // enlaces al CV: PDF local (descarga) o enlace externo
    const href = this.t('hero.cv_href');
    const local = href.startsWith('/') || href.startsWith(window.location.origin);
    for (const a of document.querySelectorAll('[data-cv]')) {
      a.setAttribute('href', href);
      const label = a.querySelector('span[data-i18n]');
      if (local) {
        a.setAttribute('download', '');
        a.removeAttribute('target');
        a.removeAttribute('rel');
        if (label) label.textContent = this.t('hero.cta_cv');
      } else {
        a.removeAttribute('download');
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
        if (label) label.textContent = this.t('hero.cta_cv_external');
      }
      a.querySelector('.arrow')?.toggleAttribute('hidden', local);
    }

    // toggle y metadatos
    for (const btn of document.querySelectorAll('.lang__btn')) {
      btn.setAttribute('aria-pressed', String(btn.dataset.lang === lang));
    }
    document.getElementById('og-locale')?.setAttribute('content', lang === 'en' ? 'en_US' : 'es_ES');
    storageSet('lang', lang);

    if (!silent && !reduced() && 'animate' in Element.prototype) {
      document.getElementById('main')?.animate([{ opacity: 0.6 }, { opacity: 1 }], { duration: 160, easing: 'ease-out' });
    }
    document.dispatchEvent(new CustomEvent('mtc:lang', { detail: { lang } }));
  },
};
