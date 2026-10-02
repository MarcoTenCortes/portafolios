import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GLOW_TAU, GLOW_SNAP, followStep, hasArrived, glowGate } from '../src/js/play/glow-follow.js';

const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

describe('constantes', () => {
  it('la cola dura 70 ms y se da por llegada a 0,25 px', () => {
    assert.equal(GLOW_TAU, 70);
    assert.equal(GLOW_SNAP, 0.25);
  });
});

describe('followStep', () => {
  const target = { x: 100, y: -50 };
  it('sin posicion previa va directa al objetivo (nace bajo el puntero)', () => {
    assert.deepEqual(followStep(null, target, 16, 70), { x: 100, y: -50 });
    assert.deepEqual(followStep(undefined, target, 16), { x: 100, y: -50 });
  });
  it('con tau 0 (movimiento reducido) o negativo va directa al objetivo', () => {
    assert.deepEqual(followStep({ x: 0, y: 0 }, target, 16, 0), { x: 100, y: -50 });
    assert.deepEqual(followStep({ x: 0, y: 0 }, target, 16, -5), { x: 100, y: -50 });
  });
  it('devuelve un punto nuevo, sin tocar el objetivo', () => {
    const out = followStep(null, target, 16);
    assert.notEqual(out, target);
    assert.deepEqual(target, { x: 100, y: -50 });
  });
  it('con dt = tau recorre 1 - 1/e del trayecto', () => {
    const p = followStep({ x: 0, y: 0 }, target, GLOW_TAU, GLOW_TAU);
    const k = 1 - 1 / Math.E;
    assert.ok(near(p.x, 100 * k));
    assert.ok(near(p.y, -50 * k));
  });
  it('con dt 0 (o negativo) no se mueve', () => {
    assert.deepEqual(followStep({ x: 10, y: 20 }, target, 0), { x: 10, y: 20 });
    assert.deepEqual(followStep({ x: 10, y: 20 }, target, -8), { x: 10, y: 20 });
  });
  it('es independiente del framerate: dos pasos de 8 ms equivalen a uno de 16', () => {
    const start = { x: 0, y: 0 };
    const two = followStep(followStep(start, target, 8), target, 8);
    const one = followStep(start, target, 16);
    assert.ok(near(two.x, one.x));
    assert.ok(near(two.y, one.y));
  });
  it('nunca sobrepasa el objetivo, ni con saltos de tiempo enormes', () => {
    let p = { x: 0, y: 0 };
    for (const dt of [16, 33, 8, 250, 5000, 1e9]) {
      p = followStep(p, target, dt);
      assert.ok(p.x >= 0 && p.x <= 100, `x ${p.x}`);
      assert.ok(p.y <= 0 && p.y >= -50, `y ${p.y}`);
    }
    assert.ok(hasArrived(p, target));
  });
  it('a 60 fps llega en unos 33 frames desde 500 px (la cola se nota pero es corta)', () => {
    let p = { x: 0, y: 0 };
    const goal = { x: 500, y: 0 };
    let frames = 0;
    while (!hasArrived(p, goal) && frames < 200) { p = followStep(p, goal, 1000 / 60); frames++; }
    assert.ok(frames > 20 && frames < 40, `frames ${frames}`);
  });
});

describe('hasArrived', () => {
  it('es inclusiva en el margen exacto', () => {
    assert.equal(hasArrived({ x: 0, y: 0 }, { x: 0.25, y: 0 }), true);
    assert.equal(hasArrived({ x: 0, y: 0 }, { x: 0, y: -0.25 }), true);
  });
  it('falla justo por encima del margen (tambien en diagonal)', () => {
    assert.equal(hasArrived({ x: 0, y: 0 }, { x: 0.26, y: 0 }), false);
    assert.equal(hasArrived({ x: 0, y: 0 }, { x: 0.2, y: 0.2 }), false);
  });
  it('acepta otro margen', () => {
    assert.equal(hasArrived({ x: 0, y: 0 }, { x: 3, y: 4 }, 5), true);
    assert.equal(hasArrived({ x: 0, y: 0 }, { x: 3, y: 4 }, 4.99), false);
  });
  it('sin posicion previa nunca ha llegado', () => {
    assert.equal(hasArrived(null, { x: 0, y: 0 }), false);
  });
});

describe('glowGate', () => {
  const ok = { coarse: false, pointerType: 'mouse', hidden: false, dialogOpen: false, sheetOpen: false };
  it('enciende con raton en un dispositivo con hover, pestana visible y sin ficha ni menu', () => {
    assert.equal(glowGate(ok), true);
  });
  it('solo con raton: ni dedo ni lapiz ni tipo desconocido', () => {
    for (const pointerType of ['touch', 'pen', '', undefined]) {
      assert.equal(glowGate({ ...ok, pointerType }), false, String(pointerType));
    }
  });
  it('se apaga en dispositivos sin hover, con la pestana oculta, con una ficha o con el menu abiertos', () => {
    for (const [k, v] of Object.entries({ coarse: true, hidden: true, dialogOpen: true, sheetOpen: true })) {
      assert.equal(glowGate({ ...ok, [k]: v }), false, k);
    }
  });
  it('sin argumentos no enciende', () => {
    assert.equal(glowGate(), false);
  });
});
