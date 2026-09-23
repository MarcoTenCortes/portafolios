import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { INK_LIMITS, appendPoint, midpointPathD, chunkStroke, simplify, evict, isFull, anchorTransform } from '../src/js/play/ink.js';

// Recta diagonal de n puntos separados 1 unidad en cada eje.
function line(n) {
  const pts = [];
  for (let i = 0; i < n; i++) pts.push(i, i);
  return pts;
}
const stroke = (n, sec = 'proyectos') => ({ sec, w0: 1000, pts: line(n) });

describe('INK_LIMITS', () => {
  it('tiene los topes del plan', () => {
    assert.deepEqual(INK_LIMITS, { strokes: 40, pointsPerStroke: 4000, points: 20000, minStep: 2, chunk: 600 });
  });
});

describe('appendPoint', () => {
  it('siempre acepta el primer punto', () => {
    const pts = [];
    assert.equal(appendPoint(pts, 10, 10), true);
    assert.deepEqual(pts, [10, 10]);
  });
  it('descarta un punto a menos de 2 px del anterior', () => {
    const pts = [10, 10];
    assert.equal(appendPoint(pts, 11, 11), false);
    assert.deepEqual(pts, [10, 10]);
  });
  it('acepta un punto a exactamente minStep', () => {
    const pts = [10, 10];
    assert.equal(appendPoint(pts, 12, 10), true);
    assert.deepEqual(pts, [10, 10, 12, 10]);
  });
  it('mide contra el último punto, no contra el primero', () => {
    const pts = [0, 0, 10, 0];
    assert.equal(appendPoint(pts, 11, 0), false);
    assert.equal(appendPoint(pts, 13, 0), true);
  });
  it('respeta un minStep personalizado', () => {
    const pts = [0, 0];
    assert.equal(appendPoint(pts, 4, 0, 5), false);
    assert.equal(appendPoint(pts, 5, 0, 5), true);
  });
});

describe('midpointPathD', () => {
  it('devuelve cadena vacía sin puntos', () => {
    assert.equal(midpointPathD([]), '');
  });
  it('un punto suelto es un M L sobre sí mismo', () => {
    assert.equal(midpointPathD([10, 20]), 'M 10.0 20.0 L 10.0 20.0');
  });
  it('pasa por los puntos medios con el punto anterior de control', () => {
    assert.equal(midpointPathD([0, 0, 10, 0, 10, 10]), 'M 0.0 0.0 L 0.0 0.0 Q 0.0 0.0 5.0 0.0 Q 10.0 0.0 10.0 5.0');
  });
  it('puede empezar en un índice de punto posterior', () => {
    assert.equal(midpointPathD([0, 0, 10, 0, 10, 10], 1), 'M 10.0 0.0 L 10.0 0.0 Q 10.0 0.0 10.0 5.0');
    assert.equal(midpointPathD([0, 0, 10, 0, 10, 10], 2), 'M 10.0 10.0 L 10.0 10.0');
    assert.equal(midpointPathD([0, 0, 10, 0], 5), '');
  });
  it('redondea a un decimal', () => {
    assert.equal(midpointPathD([1.26, 2.34]), 'M 1.3 2.3 L 1.3 2.3');
  });
});

describe('chunkStroke', () => {
  it('sin puntos no hay tramos', () => {
    assert.deepEqual(chunkStroke([]), []);
  });
  it('un trazo que cabe en un tramo no se parte', () => {
    const pts = line(600);
    const chunks = chunkStroke(pts);
    assert.equal(chunks.length, 1);
    assert.deepEqual(chunks[0], pts);
  });
  it('1500 puntos son 3 tramos que comparten el punto de unión', () => {
    const chunks = chunkStroke(line(1500));
    assert.equal(chunks.length, 3);
    assert.deepEqual(chunks.map((c) => c.length / 2), [600, 600, 302]);
    assert.deepEqual(chunks[0].slice(-2), chunks[1].slice(0, 2));
    assert.deepEqual(chunks[1].slice(-2), chunks[2].slice(0, 2));
  });
  it('un punto más que el tramo abre un segundo tramo de dos puntos', () => {
    const chunks = chunkStroke(line(601));
    assert.deepEqual(chunks.map((c) => c.length / 2), [600, 2]);
  });
  it('acepta un tamaño de tramo propio', () => {
    assert.deepEqual(chunkStroke(line(5), 3), [[0, 0, 1, 1, 2, 2], [2, 2, 3, 3, 4, 4]]);
  });
});

describe('simplify', () => {
  it('una recta de 100 puntos se queda en 2', () => {
    assert.deepEqual(simplify(line(100), 0.5), [0, 0, 99, 99]);
  });
  it('conserva la esquina de una L', () => {
    const pts = [];
    for (let i = 0; i <= 50; i++) pts.push(i, 0);
    for (let i = 1; i <= 50; i++) pts.push(50, i);
    assert.deepEqual(simplify(pts, 0.5), [0, 0, 50, 0, 50, 50]);
  });
  it('con epsilon suficiente aplana el ruido pequeño', () => {
    assert.deepEqual(simplify([0, 0, 10, 0.2, 20, -0.2, 30, 0], 1), [0, 0, 30, 0]);
    assert.deepEqual(simplify([0, 0, 10, 0.2, 20, -0.2, 30, 0], 0.1).length / 2, 4);
  });
  it('no toca trazos de menos de 3 puntos y devuelve una copia', () => {
    const pts = [1, 2, 3, 4];
    const out = simplify(pts, 1);
    assert.deepEqual(out, pts);
    assert.notEqual(out, pts);
    assert.deepEqual(simplify([], 1), []);
  });
});

describe('evict', () => {
  it('no toca una lista dentro de los topes y devuelve vacío', () => {
    const strokes = [stroke(10), stroke(10)];
    assert.deepEqual(evict(strokes), []);
    assert.equal(strokes.length, 2);
  });
  it('con una lista vacía no hace nada', () => {
    assert.deepEqual(evict([]), []);
  });
  it('con 41 trazos retira el más antiguo y lo devuelve', () => {
    const strokes = Array.from({ length: 41 }, (_, i) => stroke(10, `s${i}`));
    const first = strokes[0];
    const removed = evict(strokes);
    assert.equal(strokes.length, 40);
    assert.deepEqual(removed, [first]);
    assert.equal(strokes[0].sec, 's1');
  });
  it('retira varios en orden FIFO cuando se supera el total de puntos', () => {
    const strokes = [stroke(3000, 'a'), stroke(3000, 'b'), stroke(9000, 'c'), stroke(9000, 'd')];
    const removed = evict(strokes);
    assert.deepEqual(removed.map((s) => s.sec), ['a', 'b']);
    assert.deepEqual(strokes.map((s) => s.sec), ['c', 'd']);
  });
  it('acepta topes personalizados', () => {
    const strokes = [stroke(3, 'a'), stroke(3, 'b'), stroke(3, 'c')];
    assert.deepEqual(evict(strokes, { strokes: 2, points: 100 }).map((s) => s.sec), ['a']);
    assert.deepEqual(evict(strokes, { strokes: 10, points: 3 }).map((s) => s.sec), ['b']);
  });
});

describe('isFull', () => {
  it('se llena a los 4000 puntos', () => {
    assert.equal(isFull(line(3999)), false);
    assert.equal(isFull(line(4000)), true);
  });
  it('acepta otros topes', () => {
    assert.equal(isFull(line(5), { pointsPerStroke: 5 }), true);
  });
});

describe('anchorTransform', () => {
  it('traslada a coordenadas de documento y escala por el ancho', () => {
    assert.equal(anchorTransform({ left: 100, top: 250, width: 500 }, 1000, 0, 800), 'translate(100 1050) scale(0.5)');
  });
  it('redondea a dos decimales', () => {
    assert.equal(anchorTransform({ left: 10.006, top: 0.126, width: 1000 }, 3000, 0, 0), 'translate(10.01 0.13) scale(0.33)');
  });
  it('escala 1 si no se conoce el ancho original', () => {
    assert.equal(anchorTransform({ left: 0, top: 0, width: 500 }, 0), 'translate(0 0) scale(1)');
  });
  it('el scroll es opcional', () => {
    assert.equal(anchorTransform({ left: 5, top: 6, width: 100 }, 100), 'translate(5 6) scale(1)');
  });
});
