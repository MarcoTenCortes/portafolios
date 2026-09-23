// Integridad de los partials: cada bloque <!-- partial:NAME --> … <!-- /partial:NAME --> de index.html
// es igual (trim) al fichero src/partials/NAME.svg, tal y como lo deja tools/inject-partials.py.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const url = (rel) => new URL(`../${rel}`, import.meta.url);
// Python lee con "universal newlines": normalizamos CRLF igual para no depender del checkout.
const read = (rel) => readFileSync(url(rel), 'utf8').replace(/\r\n/g, '\n');
// index.html y el fragmento de la zona de juego (src/partials/lazy.html) llevan bloques inyectados.
const html = read('index.html') + (existsSync(url('src/partials/lazy.html')) ? read('src/partials/lazy.html') : '');
const names = [...new Set([...html.matchAll(/<!-- partial:([a-z0-9-]+) -->/g)].map((m) => m[1]))];

// Mensaje corto con la primera diferencia, en vez del diff completo de un SVG de varios KB.
function firstDiff(name, actual, expected) {
  let i = 0;
  while (i < actual.length && actual[i] === expected[i]) i++;
  const cut = (s) => JSON.stringify(s.slice(Math.max(0, i - 60), i + 80));
  return `${name}: el bloque de index.html difiere de src/partials/${name}.svg en el carácter ${i} `
    + `(ejecuta python tools/inject-partials.py)\n  index.html: ${cut(actual)}\n  fichero:    ${cut(expected)}`;
}

describe('partials', () => {
  it('index.html tiene marcadores de partials', () => {
    assert.ok(names.length > 0);
  });
  for (const name of names) {
    it(`${name} coincide con src/partials/${name}.svg`, (t) => {
      const blocks = [...html.matchAll(new RegExp(`<!-- partial:${name} -->([\\s\\S]*?)<!-- /partial:${name} -->`, 'g'))];
      if (!blocks.length) return t.skip('marcador sin inyectar todavía');
      const file = `src/partials/${name}.svg`;
      assert.ok(existsSync(url(file)), `${file} no existe pero está inyectado en index.html`);
      const expected = read(file).trim();
      for (const b of blocks) {
        const actual = b[1].trim();
        if (actual !== expected) assert.fail(firstDiff(name, actual, expected));
      }
    });
  }
});
