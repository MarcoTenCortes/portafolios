// La capa de tinta (#ink) del rotulador no debe dejar hueco al pie: anchorAll() en marker.js pone su alto a 0
// antes de leer scrollHeight (si no, la medida se incluye a si misma y el documento nunca encoge) y despues le
// devuelve el alto del documento (con alto 0 Chromium no pinta los trazos).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Como partials.test.mjs: CRLF normalizado para no depender del checkout.
const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const marker = read('src/js/marker.js');

// cuerpo de una funcion (de su llave de apertura a la de cierre), contando las llaves anidadas
function body(src, signature) {
  const start = src.indexOf(signature);
  assert.ok(start >= 0, `marker.js no tiene ${signature}`);
  const open = src.indexOf('{', start + signature.length - 1);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(open + 1, i);
  }
  return assert.fail(`${signature} sin cerrar`);
}

const anchorAll = body(marker, 'function anchorAll() {');
const code = anchorAll.replace(/\/\/.*$/gm, '');
const comments = (anchorAll.match(/\/\/.*$/gm) || []).join('\n');

describe('capa de tinta del rotulador (#ink)', () => {
  it('anchorAll pone #ink a 0 antes de leer scrollHeight (si no, el documento no vuelve a encoger)', () => {
    const reset = code.indexOf("ink.style.height = '0px'");
    const readH = code.indexOf('document.documentElement.scrollHeight');
    assert.ok(reset >= 0, "falta ink.style.height = '0px' en anchorAll");
    assert.ok(readH >= 0, 'anchorAll ya no lee document.documentElement.scrollHeight');
    assert.ok(reset < readH, "ink.style.height = '0px' debe ir antes de leer scrollHeight");
  });

  it('anchorAll devuelve a #ink el alto del documento despues del 0 (con alto 0 no se pintan los trazos)', () => {
    const reset = code.indexOf("ink.style.height = '0px'");
    const restore = code.indexOf('ink.style.height = `${document.documentElement.scrollHeight}px`');
    assert.ok(reset >= 0 && restore > reset, 'tras el 0, #ink debe recuperar el alto de scrollHeight en el mismo anchorAll');
  });

  it('el comentario de anchorAll explica el trinquete (para que nadie quite la linea del 0)', () => {
    assert.match(comments, /trinquete|encoger/i, 'el comentario debe decir por que se pone #ink a 0 (el documento no encoge)');
    assert.match(comments, /no quitar/i, 'el comentario debe avisar de que no se quite la linea del 0');
  });
});
