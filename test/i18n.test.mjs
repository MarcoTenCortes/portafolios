// Integridad de los diccionarios: mismas claves en ES/EN, sin vacíos y todo lo que usa index.html existe.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const es = JSON.parse(read('src/i18n/es.json'));
const en = JSON.parse(read('src/i18n/en.json'));
const html = read('index.html');

// Pares attr:clave de un data-i18n-attr, con la misma regla de corte que i18n.js.
function attrPairs(value) {
  return value.split(';').filter((p) => p.trim()).map((pair) => {
    const idx = pair.indexOf(':');
    const ok = idx >= 1;
    return { attr: ok ? pair.slice(0, idx).trim() : '', key: ok ? pair.slice(idx + 1).trim() : '', raw: pair };
  });
}

// Claves usadas en index.html -> dónde aparecen (para que el fallo diga en qué atributo).
function htmlKeys() {
  const keys = new Map();
  for (const m of html.matchAll(/data-i18n="([^"]*)"/g)) keys.set(m[1], `data-i18n="${m[1]}"`);
  for (const m of html.matchAll(/data-i18n-attr="([^"]*)"/g)) {
    for (const { key } of attrPairs(m[1])) keys.set(key, `data-i18n-attr="${m[1]}"`);
  }
  return keys;
}

describe('i18n', () => {
  it('es.json y en.json tienen exactamente las mismas claves', () => {
    assert.deepEqual(Object.keys(es).filter((k) => !(k in en)), [], 'claves solo en es.json');
    assert.deepEqual(Object.keys(en).filter((k) => !(k in es)), [], 'claves solo en en.json');
  });
  it('ningún valor está vacío ni deja de ser texto', () => {
    for (const [lang, dict] of [['es', es], ['en', en]]) {
      const bad = Object.entries(dict).filter(([, v]) => typeof v !== 'string' || v.trim() === '').map(([k]) => k);
      assert.deepEqual(bad, [], `valores vacíos o no textuales en ${lang}.json`);
    }
  });
  it('index.html usa claves (el análisis no se ha quedado vacío)', () => {
    assert.ok(htmlKeys().size > 0);
  });
  it('todo data-i18n-attr tiene la forma attr:clave', () => {
    const bad = [];
    for (const m of html.matchAll(/data-i18n-attr="([^"]*)"/g)) {
      for (const { attr, key, raw } of attrPairs(m[1])) if (!attr || !key) bad.push(raw);
    }
    assert.deepEqual(bad, []);
  });
  it('toda clave usada en index.html existe en ambos idiomas', () => {
    const missing = [];
    for (const [key, where] of htmlKeys()) {
      if (!(key in es) || !(key in en)) missing.push(`${key} (${where})`);
    }
    assert.deepEqual(missing, []);
  });
});
