// Coherencia de las poses del escritorio del hero entre lamp.js (POSES, STEP_MS), site.css (reglas
// [data-pose] y .is-snap) y desk.svg (los dos cuerpos del giro, sin filtros en lo que se anima).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Como partials.test.mjs: CRLF normalizado para no depender del checkout.
const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const lamp = read('src/js/lamp.js');
const css = read('src/styles/site.css');
const svg = read('src/partials/desk.svg');

const poses = [...lamp.match(/const POSES = \[([^\]]*)\]/)[1].matchAll(/'([a-z]+)'/g)].map((m) => m[1]);
const stepKeys = [...lamp.match(/const STEP_MS = \{([^}]*)\}/)[1].matchAll(/([a-z]+):\s*\d+/g)].map((m) => m[1]);

// contenido de un <g> (de su etiqueta de apertura a su </g>), contando los <g> anidados
function group(src, openTag) {
  const start = src.indexOf(openTag);
  assert.ok(start >= 0, `desk.svg no tiene ${openTag}`);
  const tags = /<g[\s>]|<\/g>/g;
  tags.lastIndex = start + 1;
  let depth = 1;
  for (let m = tags.exec(src); m; m = tags.exec(src)) {
    depth += m[0] === '</g>' ? -1 : 1;
    if (depth === 0) return src.slice(start, m.index + 4);
  }
  return assert.fail(`${openTag} sin cerrar`);
}

describe('poses del escritorio', () => {
  it('POSES empieza en typing y acaba en face', () => {
    assert.equal(poses[0], 'typing');
    assert.equal(poses.at(-1), 'face');
  });

  it('POSES y las claves de STEP_MS coinciden en los dos sentidos', () => {
    assert.deepEqual([...stepKeys].sort(), [...poses].sort());
  });

  for (const pose of poses.filter((p) => p !== 'typing')) {
    it(`site.css tiene reglas para [data-pose="${pose}"]`, () => {
      assert.ok(css.includes(`[data-pose="${pose}"]`), `falta [data-pose="${pose}"] en site.css`);
    });
  }

  it('.is-snap quita la transicion a todos los grupos que la tienen', () => {
    const rule = css.match(/\.hero__desk\.is-snap :is\(([^)]*)\)\s*\{\s*transition:\s*none/);
    assert.ok(rule, 'no se encuentra la regla .hero__desk.is-snap :is(...) { transition: none }');
    const listed = rule[1].split(',').map((s) => s.trim());
    for (const part of ['head', 'head-back', 'head-turned', 'body--back', 'body--front', 'arm', 'fore', 'mug', 'mug-shadow']) {
      assert.ok(listed.includes(`.desk__${part}`), `.is-snap no incluye .desk__${part}`);
    }
  });

  it('desk.svg tiene el cuerpo de espaldas (con la taza) y el de frente completo', () => {
    const hasClass = (src, cls) => new RegExp(`class="(?:[^"]* )?${cls}[ "]`).test(src);
    const back = group(svg, '<g class="desk__body desk__body--back"');
    for (const cls of ['desk__mug', 'desk__mug-shadow', 'desk__head', 'desk__arm']) {
      assert.ok(hasClass(back, cls), `falta ${cls} en .desk__body--back`);
    }
    const front = group(svg, '<g class="desk__body desk__body--front"');
    for (const cls of ['desk__shade', 'desk__rim', 'desk__lid', 'desk__steam']) {
      assert.ok(hasClass(front, cls), `falta ${cls} en .desk__body--front`);
    }
    // el de frente no reutiliza clases que lamp.js o las sondas buscan con querySelector (cogerian el primero)
    for (const cls of ['desk__head', 'desk__arm', 'desk__fore', 'desk__hand', 'desk__mug']) {
      assert.ok(!hasClass(front, cls), `.desk__body--front no debe usar ${cls}`);
    }
  });

  it('ningun filter= dentro de .desk__marco (se anima entero)', () => {
    const marco = group(svg, '<g class="desk__marco"');
    assert.ok(!/\sfilter=/.test(marco), 'hay un filter= dentro de .desk__marco');
  });
});
