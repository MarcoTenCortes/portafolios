// Objetos ocultos del hero (src/js/secret.js): cuatro dibujos que solo se ven bajo la luz del raton, dentro de una
// lente que la sigue, y el rack con el perro repetido tenue como pista cuando Marco esta de frente. Comprueba la capa,
// la plantilla, los SVG (formato, peso, sin filtros ni texto), el evento de glow.js, el arranque y las listas de CSS.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';

const url = (rel) => new URL(`../${rel}`, import.meta.url);
const read = (rel) => readFileSync(url(rel), 'utf8').replace(/\r\n/g, '\n');
const html = read('index.html');
const lazy = read('src/partials/lazy.html');
const main = read('src/js/main.js');
const glow = read('src/js/glow.js');
const secret = read('src/js/secret.js');
const site = read('src/js/site.js');
const css = read('src/styles/site.css');
const readme = read('README.md');
const NAMES = ['rack', 'shelf', 'window', 'board'];

const hero = html.slice(html.indexOf('<section class="hero'), html.indexOf('</section>', html.indexOf('<section class="hero')));
const tplStart = lazy.indexOf('<template data-for="secrets">');
const tpl = tplStart >= 0 ? lazy.slice(tplStart, lazy.indexOf('</template>', tplStart)) : '';
// la regla (o la lista de selectores) que contiene `needle`, hasta su llave de cierre
const ruleWith = (needle) => {
  const i = css.indexOf(needle);
  if (i < 0) return '';
  return css.slice(css.lastIndexOf('}', i) + 1, css.indexOf('}', i) + 1);
};

describe('objetos ocultos del hero', () => {
  it('la capa .hero__secret (decorativa, estampada desde secrets) es el primer hijo del hero, antes del grid', () => {
    const layer = hero.match(/<div class="hero__secret"[^>]*>/);
    assert.ok(layer, 'falta la capa .hero__secret');
    assert.match(layer[0], /aria-hidden="true"/);
    assert.match(layer[0], /data-lazy="secrets"/);
    assert.ok(hero.indexOf('class="hero__secret"') < hero.indexOf('<div class="container hero__grid">'), 'la capa debe preceder a .hero__grid');
    assert.match(hero, /^<section class="hero[^>]*>\s*<div class="hero__secret"/, 'primer hijo de la seccion');
  });

  it('lazy.html: la plantilla secrets tiene la pista (<use> del rack) y la lente con el arte y los cuatro dibujos', () => {
    assert.ok(tplStart >= 0, 'falta <template data-for="secrets">');
    for (const name of NAMES) {
      assert.ok(tpl.includes(`<!-- partial:secret-${name} -->`) && tpl.includes(`<!-- /partial:secret-${name} -->`), `faltan los marcadores de secret-${name}`);
    }
    const hint = tpl.match(/<div class="hero__secret-hint">([\s\S]*?)<\/div>/);
    assert.ok(hint, 'falta .hero__secret-hint');
    assert.match(hint[1], /<use href="#secret-rack"\/>/);
    assert.match(hint[1], /hero__secret-obj--rack/);
    const lens = tpl.indexOf('<div class="hero__secret-lens">');
    const art = tpl.indexOf('<div class="hero__secret-art">');
    assert.ok(lens >= 0 && art > lens, 'la lente contiene el arte');
    assert.ok(tpl.indexOf('<!-- partial:secret-rack -->') > art, 'los dibujos van dentro del arte');
    assert.ok(tpl.indexOf('hero__secret-hint') < lens, 'la pista pinta debajo de la lente');
  });

  for (const name of NAMES) {
    it(`src/partials/secret-${name}.svg: decorativo, con su <g id>, sin filtros ni texto y ligero`, () => {
      const file = `src/partials/secret-${name}.svg`;
      assert.ok(existsSync(url(file)), `${file} no existe`);
      const svg = read(file);
      const root = svg.match(/<svg\b[^>]*>/)[0];
      assert.match(root, /viewBox="0 0 \d+ \d+"/);
      assert.match(root, /aria-hidden="true"/);
      assert.match(root, new RegExp(`class="hero__secret-obj hero__secret-obj--${name}"`));
      assert.match(svg, new RegExp(`<g id="secret-${name}"`));
      assert.match(svg, /var\(--ill-ink/, 'tinta del estilo');
      assert.doesNotMatch(svg, /\bfilter=|<filter\b/, 'sin filtros (la lente se mueve en cada frame)');
      assert.doesNotMatch(svg, /<text\b/, 'sin texto legible');
      assert.doesNotMatch(svg, /class="desk__/, 'clases propias, no las del escritorio');
      assert.ok(statSync(url(file)).size <= 8 * 1024, `${file} pesa mas de 8 KB`);
    });
  }

  it('el rack lleva LEDs que parpadean y la pista usa su mismo viewBox', () => {
    const rack = read('src/partials/secret-rack.svg');
    assert.ok((rack.match(/class="secret__led\b/g) || []).length >= 3, 'al menos tres LEDs .secret__led');
    const vb = rack.match(/viewBox="([^"]+)"/)[1];
    assert.match(tpl, new RegExp(`<div class="hero__secret-hint"><svg[^>]*viewBox="${vb}"`));
  });

  it('glow.js avisa con mtc:glow al mover la luz, al apagarla y al destruirla', () => {
    assert.ok((glow.match(/emit\((true|false)\)/g) || []).length >= 3, 'place, off y destroy emiten');
    assert.match(glow, /new CustomEvent\('mtc:glow'/);
  });

  it('secret.js escucha la luz y el scroll y expone el gancho de pruebas', () => {
    assert.match(secret, /export function initSecret\(hero\)/);
    assert.match(secret, /addEventListener\('mtc:glow'/);
    assert.match(secret, /addEventListener\('scroll', onScroll, \{ passive: true \}\)/);
    assert.match(secret, /ResizeObserver/);
    for (const k of ['get state()', 'get lens()', 'moveTo(', 'hide()', 'destroy()']) assert.ok(secret.includes(k), `falta ${k}`);
  });

  it('main.js lo arranca con la luz (token glow) tras estampar; site.js pausa la capa fuera de pantalla', () => {
    assert.match(main, /\/\/ \[boot:secret\]/);
    assert.match(main, /playTokens\.includes\('glow'\) && document\.querySelector\('\.hero__secret'\)/);
    assert.match(main, /Promise\.all\(\[stamped, import\('\.\/secret\.js'\)\]\)/);
    assert.ok(main.indexOf('[boot:secret]') > main.indexOf('[boot:glow]'));
    assert.match(site, /querySelectorAll\('[^']*\.hero__secret[^']*'\)/);
  });

  it('site.css: bloque [css:secret], lente con mascara radial, pista a 0.16 en face, --hero-w en .hero', () => {
    assert.match(css, /\[css:secret\]/);
    const lens = ruleWith('.hero__secret-lens {');
    assert.match(lens, /mask-image: radial-gradient\(/);
    assert.match(lens, /translate3d/);
    assert.match(css, /\.hero:has\(\.hero__desk\.is-lit\[data-pose="face"\]\) \.hero__secret-hint \{ opacity: 0\.16; \}/);
    assert.match(css, /\.hero \{ --hero-w: 232px;/);
    assert.doesNotMatch(css, /\.hero__media \{[^}]*--hero-w/, '--hero-w ya no vive en .hero__media');
    const block = css.slice(css.indexOf('[css:secret]'), css.indexOf('@keyframes secret-led'));
    assert.doesNotMatch(block.replace(/\/\*[\s\S]*?\*\//g, ''), /mix-blend-mode|backdrop-filter|\bfilter:/, 'solo transform y opacity');
  });

  it('site.css: la capa no sale sin JS, al imprimir, con forced-colors ni en movil, y reduced-motion la deja quieta', () => {
    assert.match(css, /html:not\(\.js\) :is\([^)]*\.hero__secret[^)]*\) \{ display: none !important; \}/);
    const print = css.slice(css.indexOf('@layer print'));
    assert.match(print, /\.hero__secret\b[^{]*\{ display: none !important; \}/);
    assert.match(css, /@media \(forced-colors: active\) \{ \.hero__secret \{ display: none; \} \}/);
    assert.match(css, /@media \(min-width: 768px\) \{ \.hero__secret\.is-ready \{ display: block; \} \}/);
    const reduced = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)'));
    assert.match(reduced, /\.hero__secret-lens, \.hero__secret-hint \{ transition: none; \}/);
    assert.match(reduced, /\.hero__secret \* \{ animation: none !important; \}/);
  });

  it('el README documenta la suite secret.json', () => {
    assert.match(readme, /secret\.json/);
    assert.match(readme, /Objetos ocultos/);
  });
});
