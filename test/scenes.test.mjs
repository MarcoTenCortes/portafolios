// Escenas detras de una seccion (src/js/experience.js, initScenes): Experiencia (una escena por entrada de la linea
// temporal, capa #exp-bg) y Formacion (una por bloque: titulaciones y certificaciones, capa #edu-bg). Cada escena
// SVG se estampa desde lazy.html en su capa. Comprueba, para cada conjunto, los ids, la capa, la plantilla, los SVG
// (formato, peso, sin filtros ni texto, ids con prefijo) y el arranque en main.js; y despues lo comun: el modulo,
// el CSS generico ([css:scenes]) y la pausa de bucles.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';

const url = (rel) => new URL(`../${rel}`, import.meta.url);
const read = (rel) => readFileSync(url(rel), 'utf8').replace(/\r\n/g, '\n');
const html = read('index.html');
const lazy = read('src/partials/lazy.html');
const main = read('src/js/main.js');
const css = read('src/styles/site.css');
const site = read('src/js/site.js');
const mod = read('src/js/experience.js');
const readme = read('README.md');

// section: clase de la <section>; bg: id de la capa; tpl: plantilla de lazy.html; key: data-<key> y ?<key>=;
// prefix: prefijo de los parciales (y de sus ids, con la inicial de la escena); item/count: entradas en el HTML
const SETS = [
  {
    name: 'experiencia', section: 'experience', bg: 'exp-bg', tpl: 'exp-scenes', key: 'exp', prefix: 'exp-',
    ids: ['minsait', 'ntt', 'dynos'],
    itemRe: /<li class="timeline__item"[^>]*\bdata-exp="([^"]+)"/g,
    countRe: /<li class="timeline__item"/g,
  },
  {
    name: 'formacion', section: 'education', bg: 'edu-bg', tpl: 'edu-scenes', key: 'edu', prefix: 'edu-',
    ids: ['uni', 'certs'],
    itemRe: /class="education__(?:main|certs)"[^>]*\bdata-edu="([^"]+)"/g,
    countRe: /class="education__(?:main|certs)"/g,
  },
];

for (const set of SETS) {
  const start = html.indexOf(`<section class="${set.section}`);
  const section = html.slice(start, html.indexOf('</section>', start));
  const items = [...section.matchAll(set.itemRe)].map((m) => m[1]);

  describe(`${set.name}: escenas`, () => {
    it(`cada entrada tiene un data-${set.key} unico, en orden`, () => {
      assert.ok(start >= 0, `falta <section class="${set.section}`);
      assert.deepEqual(items, set.ids);
      assert.equal((section.match(set.countRe) || []).length, set.ids.length, `todas las entradas llevan data-${set.key}`);
    });

    it(`la capa #${set.bg} (decorativa, estampada desde ${set.tpl}) va antes del contenedor`, () => {
      const layer = section.match(new RegExp(`<div class="scenes ${set.section}__bg" id="${set.bg}"[^>]*>`));
      assert.ok(layer, `falta la capa #${set.bg} (con las clases scenes ${set.section}__bg)`);
      assert.match(layer[0], /aria-hidden="true"/);
      assert.match(layer[0], new RegExp(`data-lazy="${set.tpl}"`));
      assert.ok(section.indexOf(`id="${set.bg}"`) < section.indexOf('<div class="container'), 'la capa debe preceder a .container');
    });

    it(`lazy.html tiene la plantilla ${set.tpl} con una escena y su partial por entrada`, () => {
      const at = lazy.indexOf(`<template data-for="${set.tpl}">`);
      assert.ok(at >= 0, `falta <template data-for="${set.tpl}">`);
      const tpl = lazy.slice(at, lazy.indexOf('</template>', at));
      assert.match(tpl, /<div class="scenes__stage">/);
      const scenes = [...tpl.matchAll(new RegExp(`<div class="scenes__scene" data-${set.key}="([^"]+)">`, 'g'))].map((m) => m[1]);
      assert.deepEqual(scenes, set.ids);
      for (const id of set.ids) {
        const name = `${set.prefix}${id}`;
        assert.ok(tpl.includes(`<!-- partial:${name} -->`) && tpl.includes(`<!-- /partial:${name} -->`), `faltan los marcadores de ${name}`);
      }
    });

    for (const id of set.ids) {
      it(`src/partials/${set.prefix}${id}.svg: 1600x640 a sangre, decorativo, sin filtros ni texto y ligero`, () => {
        const file = `src/partials/${set.prefix}${id}.svg`;
        assert.ok(existsSync(url(file)), `${file} no existe`);
        const svg = read(file);
        const root = svg.match(/<svg\b[^>]*>/)[0];
        assert.match(root, /viewBox="0 0 1600 640"/);
        // recorte por la izquierda: Marco y el objeto clave quedan en el tercio derecho a cualquier ancho
        assert.match(root, /preserveAspectRatio="xMaxYMid slice"/);
        assert.match(root, /aria-hidden="true"/);
        assert.doesNotMatch(svg, /\bfilter=|<filter\b/, 'sin filtros (se anima la escena entera)');
        assert.doesNotMatch(svg, /<text\b/, 'sin texto legible');
        assert.doesNotMatch(svg, /class="desk__/, 'clases propias (exp__), no las del escritorio del hero');
        assert.doesNotMatch(svg, /<use\b/, 'sin <use>: content-icons da por hecho que todo <use> apunta al sprite de iconos');
        assert.ok(statSync(url(file)).size <= 16 * 1024, `${file} pesa mas de 16 KB`);
        // todas las escenas viven en el mismo documento: ids con el prefijo de la escena (exp-m-, edu-c-...)
        const own = `${set.prefix}${id[0]}-`;
        for (const [, ref] of svg.matchAll(/\bid="([^"]+)"/g)) assert.ok(ref.startsWith(own), `${file}: el id ${ref} debe empezar por ${own}`);
      });
    }

    it(`main.js carga el modulo tras estampar y acepta ?${set.key}= en desarrollo`, () => {
      assert.match(main, /import\('\.\/experience\.js'\)/);
      assert.ok(main.includes(`document.getElementById('${set.bg}')`), `main.js no arranca las escenas de #${set.bg}`);
      assert.ok(main.includes(`params.get('${set.key}')`), `main.js no lee ?${set.key}=`);
    });

    it(`el README documenta &${set.key}=`, () => {
      assert.ok(readme.includes(`&${set.key}=`));
    });

    it(`site.js pausa los bucles de #${set.bg} fuera de pantalla`, () => {
      const line = site.match(/function initLoopPausing\(\) \{\n\s*const targets = \[\.\.\.document\.querySelectorAll\('([^']+)'\)\]/);
      assert.ok(line, 'no encuentro la lista de initLoopPausing');
      assert.ok(line[1].split(',').map((s) => s.trim()).includes(`#${set.bg}`), `initLoopPausing no incluye #${set.bg}`);
    });
  });
}

describe('escenas: lo comun', () => {
  it('experience.js exporta initScenes y los dos envoltorios', () => {
    assert.match(mod, /export function initScenes\(section, \{ bg, list, item, scene, key \}\)/);
    assert.match(mod, /export function initExperience\(section\)/);
    assert.match(mod, /export function initEducation\(section\)/);
    assert.match(mod, /'#exp-bg'[^\n]*'\.timeline'[^\n]*key: 'exp'/);
    assert.match(mod, /'#edu-bg'[^\n]*'\.education__grid'[^\n]*key: 'edu'/);
  });

  it('site.css: bloque [css:scenes] con el velo del color de cada seccion y sin las clases antiguas', () => {
    assert.ok(css.includes('[css:scenes]'), 'falta el bloque [css:scenes]');
    assert.match(css, /\.experience__bg \{ --scene-veil: 26 32 48; \}/);
    assert.match(css, /\.education__bg \{ --scene-veil: 19 24 34; \}/);
    assert.match(css, /rgb\(var\(--scene-veil\) \/ 0\.9\)/);
    assert.match(css, /@keyframes scene-drift/);
    assert.doesNotMatch(css, /experience__scene|experience__stage|exp-drift|--exp-opacity/, 'quedan nombres del sistema antiguo');
  });

  it('site.css: la tarjeta de certificaciones se vuelve translucida con una escena encendida', () => {
    assert.match(css, /\.education:has\(\.scenes__scene\.is-on\) \.education__certs \{ background-color: rgba\(26, 32, 48, var\(--certs-veil, 0\.62\)\); \}/);
    // la transicion del fondo convive con la del reveal (capa motion) y reduced motion la quita
    assert.match(css, /html\.js \.education__certs\[data-reveal\] \{\s*transition: [^}]*background-color 320ms[^}]*transition-delay: 360ms, 360ms, 0s, 0s !important;/);
    assert.match(css, /prefers-reduced-motion: reduce[\s\S]*html\.js \.education__certs\[data-reveal\] \{ transition: none; animation: none; \}|prefers-reduced-motion: reduce[\s\S]*, html\.js \.education__certs\[data-reveal\] \{ transition: none; animation: none; \}/);
  });

  it('site.css: sin JS y al imprimir no hay capa de escenas', () => {
    assert.match(css, /html:not\(\.js\) :is\([^)]*\.scenes\b[^)]*\) \{ display: none !important; \}/);
    assert.match(css, /@media print[\s\S]*\.scenes \{ display: none !important; \}/);
  });
});
