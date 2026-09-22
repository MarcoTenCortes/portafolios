// Integridad del sprite: todo icono referenciado en index.html existe en public/icons/sprite.svg.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const html = read('index.html');
const sprite = read('public/icons/sprite.svg');
const symbols = [...sprite.matchAll(/<symbol\b[^>]*\bid="([^"]+)"/g)].map((m) => m[1]);
const used = [...new Set([...html.matchAll(/sprite\.svg#([A-Za-z0-9_-]+)/g)].map((m) => m[1]))];

describe('sprite', () => {
  it('index.html referencia iconos del sprite', () => {
    assert.ok(used.length > 0);
  });
  it('los ids del sprite no se repiten', () => {
    assert.equal(new Set(symbols).size, symbols.length);
  });
  it('todo sprite.svg#slug de index.html tiene su <symbol>', () => {
    const ids = new Set(symbols);
    assert.deepEqual(used.filter((slug) => !ids.has(slug)), []);
  });
});
