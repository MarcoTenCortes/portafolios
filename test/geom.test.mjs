import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { clamp, distance, isNear, toLocal, fractionOf, fromFraction, nearestSide, clampToViewport } from '../src/js/play/geom.js';

const RECT = { left: 100, top: 50, width: 200, height: 100 };

describe('clamp', () => {
  it('deja pasar los valores dentro del rango', () => {
    assert.equal(clamp(5, 0, 10), 5);
  });
  it('recorta por debajo y por arriba', () => {
    assert.equal(clamp(-3, 0, 10), 0);
    assert.equal(clamp(42, 0, 10), 10);
  });
  it('los extremos cuentan como dentro', () => {
    assert.equal(clamp(0, 0, 10), 0);
    assert.equal(clamp(10, 0, 10), 10);
  });
});

describe('distance', () => {
  it('mide la hipotenusa entre dos puntos', () => {
    assert.equal(distance({ x: 0, y: 0 }, { x: 3, y: 4 }), 5);
  });
  it('es cero de un punto a sí mismo', () => {
    assert.equal(distance({ x: 7, y: -2 }, { x: 7, y: -2 }), 0);
  });
  it('es simétrica', () => {
    assert.equal(distance({ x: 1, y: 1 }, { x: -2, y: 5 }), distance({ x: -2, y: 5 }, { x: 1, y: 1 }));
  });
});

describe('isNear', () => {
  it('es inclusiva en el radio exacto', () => {
    assert.equal(isNear({ x: 0, y: 0 }, { x: 3, y: 4 }, 5), true);
  });
  it('falla justo por encima del radio', () => {
    assert.equal(isNear({ x: 0, y: 0 }, { x: 3, y: 4 }, 4.99), false);
  });
});

describe('toLocal', () => {
  it('resta la esquina de la caja', () => {
    assert.deepEqual(toLocal({ x: 150, y: 80 }, RECT), { x: 50, y: 30 });
  });
  it('puede salir negativo fuera de la caja', () => {
    assert.deepEqual(toLocal({ x: 90, y: 40 }, RECT), { x: -10, y: -10 });
  });
});

describe('fractionOf', () => {
  it('devuelve fracciones de la caja', () => {
    assert.deepEqual(fractionOf({ x: 150, y: 75 }, RECT), { fx: 0.25, fy: 0.25 });
  });
  it('recorta a [0, 1] fuera de la caja', () => {
    assert.deepEqual(fractionOf({ x: -500, y: 9999 }, RECT), { fx: 0, fy: 1 });
  });
  it('una caja sin tamaño no produce NaN', () => {
    assert.deepEqual(fractionOf({ x: 5, y: 5 }, { left: 0, top: 0, width: 0, height: 0 }), { fx: 0, fy: 0 });
  });
});

describe('fromFraction', () => {
  it('convierte fracciones en píxeles', () => {
    assert.deepEqual(fromFraction({ fx: 0.5, fy: 1 }, RECT), { x: 200, y: 150 });
  });
  it('es la inversa de fractionOf dentro de la caja', () => {
    const pt = { x: 150, y: 75 };
    assert.deepEqual(fromFraction(fractionOf(pt, RECT), RECT), pt);
  });
});

describe('nearestSide', () => {
  it('izquierda en la primera mitad', () => {
    assert.equal(nearestSide(100, 1000), 'left');
  });
  it('derecha en la segunda mitad y en la mitad exacta', () => {
    assert.equal(nearestSide(900, 1000), 'right');
    assert.equal(nearestSide(500, 1000), 'right');
  });
});

describe('clampToViewport', () => {
  const size = { w: 160, h: 42 };
  it('ejemplo del plan: x=312 en un móvil de 390 px se queda en 210', () => {
    assert.deepEqual(clampToViewport({ x: 312, y: 10 }, size, 20, { w: 390 }), { x: 210, y: 10 });
  });
  it('no baja del margen izquierdo', () => {
    assert.equal(clampToViewport({ x: -40, y: 10 }, size, 20, { w: 390 }).x, 20);
  });
  it('deja la y intacta si no se conoce la altura', () => {
    assert.equal(clampToViewport({ x: 50, y: -999 }, size, 20, { w: 390 }).y, -999);
  });
  it('recorta la y cuando se conoce la altura', () => {
    assert.deepEqual(clampToViewport({ x: 50, y: 900 }, size, 20, { w: 390, h: 844 }), { x: 50, y: 782 });
    assert.equal(clampToViewport({ x: 50, y: -5 }, size, 20, { w: 390, h: 844 }).y, 20);
  });
  it('se pega al margen si la caja no cabe', () => {
    assert.equal(clampToViewport({ x: 100, y: 0 }, { w: 400, h: 42 }, 20, { w: 390 }).x, 20);
    assert.equal(clampToViewport({ x: 0, y: 100 }, { w: 10, h: 900 }, 20, { w: 390, h: 844 }).y, 20);
  });
});
