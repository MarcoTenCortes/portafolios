// Integridad de las fichas de proyecto (src/partials/projects/<id>.html, ver su README): la plantilla .pdoc,
// las claves i18n en ES y EN, los iconos del sprite, los ids con el prefijo del proyecto y la tarjeta que la abre.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const url = (rel) => new URL(`../${rel}`, import.meta.url);
const read = (rel) => readFileSync(url(rel), 'utf8');
const es = JSON.parse(read('src/i18n/es.json'));
const en = JSON.parse(read('src/i18n/en.json'));
const html = read('index.html');
const sprite = read('public/icons/sprite.svg');
const symbols = new Set([...sprite.matchAll(/<symbol\b[^>]*\bid="([^"]+)"/g)].map((m) => m[1]));
const files = readdirSync(url('src/partials/projects/')).filter((f) => f.endsWith('.html')).sort();
const cards = [...html.matchAll(/<article\b[^>]*\bclass="card\b[^"]*"[^>]*\bdata-project="([^"]+)"/g)].map((m) => m[1]);

// Claves de data-i18n y de data-i18n-attr (misma regla de corte que i18n.js).
function keysOf(src) {
  const keys = new Set([...src.matchAll(/data-i18n="([^"]*)"/g)].map((m) => m[1]));
  for (const m of src.matchAll(/data-i18n-attr="([^"]*)"/g)) {
    for (const pair of m[1].split(';')) {
      const idx = pair.indexOf(':');
      keys.add(idx >= 1 ? pair.slice(idx + 1).trim() : `(mal formado: ${pair})`);
    }
  }
  return keys;
}

describe('fichas de proyecto: sistema', () => {
  it('index.html tiene el <dialog> de las fichas', () => {
    assert.match(html, /<dialog class="pdialog" id="project-dialog" aria-labelledby="pdialog-title"/);
    assert.match(html, /class="pdialog__close"[^>]*data-i18n-attr="aria-label:projects\.detail\.close"/);
    assert.match(html, /class="pdialog__body" tabindex="-1"/);
  });
  it('cada tarjeta de proyecto tiene un data-project único y su botón «Más detalles»', () => {
    assert.equal(cards.length, 8);
    assert.equal(new Set(cards).size, cards.length);
    const more = html.match(/class="btn btn--secondary btn--sm card__more"/g) || [];
    assert.equal(more.length, cards.length);
  });
  it('hay al menos una ficha y todas corresponden a una tarjeta', () => {
    assert.ok(files.length > 0);
    for (const f of files) assert.ok(cards.includes(f.replace(/\.html$/, '')), `${f} no tiene tarjeta con ese data-project`);
  });
});

for (const f of files) {
  const id = f.replace(/\.html$/, '');
  const src = read(`src/partials/projects/${f}`);
  describe(`ficha ${f}`, () => {
    it('empieza por <article class="pdoc" data-project="<id>"> y tiene un único h2#pdialog-title', () => {
      assert.ok(src.trimStart().startsWith(`<article class="pdoc" data-project="${id}">`));
      assert.equal((src.match(/id="pdialog-title"/g) || []).length, 1);
      assert.match(src, /<h2\b[^>]*id="pdialog-title"/);
      assert.match(src, /data-pdialog-close/, 'falta el botón Volver (data-pdialog-close)');
    });
    it('toda clave i18n existe en es.json y en en.json', () => {
      const missing = [...keysOf(src)].filter((k) => !(k in es) || !(k in en));
      assert.deepEqual(missing, []);
    });
    it('data-i18n solo en elementos hoja', () => {
      const bad = [];
      for (const m of src.matchAll(/<([a-zA-Z][\w-]*)\b[^>]*\bdata-i18n="([^"]+)"[^>]*>/g)) {
        const rest = src.slice(m.index + m[0].length);
        if (!new RegExp(`^[^<]*</${m[1]}>`).test(rest)) bad.push(m[2]);
      }
      assert.deepEqual(bad, []);
    });
    it('los iconos del sprite existen', () => {
      const used = [...new Set([...src.matchAll(/sprite\.svg#([A-Za-z0-9_-]+)/g)].map((m) => m[1]))];
      assert.deepEqual(used.filter((s) => !symbols.has(s)), []);
    });
    it(`los ids llevan el prefijo «${id}-» y toda url(#…) apunta a uno de ellos`, () => {
      const ids = [...src.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]).filter((x) => x !== 'pdialog-title');
      assert.deepEqual(ids.filter((x) => !x.startsWith(`${id}-`)), []);
      assert.equal(new Set(ids).size, ids.length, 'ids repetidos');
      const refs = [...src.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1]);
      assert.deepEqual(refs.filter((r) => !ids.includes(r)), []);
    });
    it('los SVG son accesibles y no enfocables; sin scripts ni manejadores inline', () => {
      for (const m of src.matchAll(/<svg\b[^>]*>/g)) {
        const tag = m[0];
        if (/class="chip__icon"/.test(tag)) continue;
        assert.ok(/focusable="false"/.test(tag), `SVG sin focusable="false": ${tag.slice(0, 80)}`);
        assert.ok(/role="img"/.test(tag) || /aria-hidden="true"/.test(tag) || /<span class="action__icon" aria-hidden="true">$/.test(src.slice(0, m.index)),
          `SVG sin role="img" ni aria-hidden: ${tag.slice(0, 80)}`);
      }
      assert.doesNotMatch(src, /<script\b/i);
      assert.doesNotMatch(src, /\son[a-z]+="/i);
      for (const m of src.matchAll(/<a\b[^>]*href="https?:[^"]*"[^>]*>/g)) {
        assert.match(m[0], /target="_blank"/);
        assert.match(m[0], /rel="noopener noreferrer"/);
      }
    });
  });
}
