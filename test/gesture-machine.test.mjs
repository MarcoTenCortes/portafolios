// Gestos de Marco de frente (play/gesture-machine.js) y el temporizador pausable que los programa
// (play/pausable-timer.js): tiempos, eleccion sin repetir, puerta y tope de seguridad.
import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  GESTURES, GESTURE_NAMES, GESTURE_GAP, GESTURE_SLACK, nextGestureDelay, pickGesture, gestureTimeout, gestureGate,
} from '../src/js/play/gesture-machine.js';
import { pausableTimer } from '../src/js/play/pausable-timer.js';

describe('gestos: tabla', () => {
  it('cinco gestos: saludo, brindis, guino, asentir y ladear', () => {
    assert.deepEqual(GESTURE_NAMES, ['wave', 'toast', 'wink', 'nod', 'tilt']);
  });
  it('cada gesto dura algo (menos que el hueco minimo) y termina con una keyframe del escritorio', () => {
    for (const [name, g] of Object.entries(GESTURES)) {
      assert.ok(Number.isInteger(g.ms) && g.ms > 0, `${name}: ms`);
      assert.ok(g.ms < GESTURE_GAP.min, `${name}: dura mas que el hueco entre gestos`);
      assert.match(g.end, /^desk-[a-z-]+$/, `${name}: end`);
    }
  });
  it('gestureTimeout es la duracion mas el margen (0 si no existe)', () => {
    assert.equal(GESTURE_SLACK, 600);
    assert.equal(gestureTimeout('wave'), 2800);
    assert.equal(gestureTimeout('toast'), GESTURES.toast.ms + GESTURE_SLACK);
    assert.equal(gestureTimeout('nope'), 0);
  });
});

describe('gestos: cuando y cual', () => {
  it('nextGestureDelay esta entre 6 y 10 s', () => {
    assert.deepEqual(GESTURE_GAP, { min: 6000, max: 10000 });
    assert.equal(nextGestureDelay(() => 0), 6000);
    assert.equal(nextGestureDelay(() => 1), 10000);
    assert.equal(nextGestureDelay(() => 0.5), 8000);
    assert.equal(nextGestureDelay(() => 0.5, 100, 200), 150);
  });
  it('pickGesture nunca repite el anterior y siempre devuelve un nombre valido', () => {
    for (const last of GESTURE_NAMES) {
      for (let i = 0; i <= 50; i++) {
        const g = pickGesture(() => Math.min(i / 50, 0.999999), last);
        assert.ok(GESTURE_NAMES.includes(g), `${g} no es un gesto`);
        assert.notEqual(g, last, `repite ${last}`);
      }
    }
  });
  it('pickGesture sin anterior puede sacar cualquiera, y los demas por igual con anterior', () => {
    const all = new Set();
    for (let i = 0; i < 50; i++) all.add(pickGesture(() => i / 50, null));
    assert.deepEqual([...all].sort(), [...GESTURE_NAMES].sort());
    const after = new Set();
    for (let i = 0; i < 50; i++) after.add(pickGesture(() => i / 50, 'wink'));
    assert.deepEqual([...after].sort(), GESTURE_NAMES.filter((n) => n !== 'wink').sort());
    assert.equal(pickGesture(() => 1, 'tilt'), 'nod', 'rng() = 1 no se sale de la lista');
  });
  it('pickGesture con un solo nombre posible lo devuelve aunque sea el anterior', () => {
    assert.equal(pickGesture(() => 0.3, 'wave', ['wave']), 'wave');
  });
  it('gestureGate exige pestana visible, a la vista, sin ficha, sin movimiento reducido, lampara encendida y de frente', () => {
    const ok = { hidden: false, offscreen: false, dialogOpen: false, reduced: false, lit: true, pose: 'face' };
    assert.ok(gestureGate(ok));
    for (const [k, v] of Object.entries({ hidden: true, offscreen: true, dialogOpen: true, reduced: true, lit: false, pose: 'hold' })) {
      assert.ok(!gestureGate({ ...ok, [k]: v }), k);
    }
    for (const pose of ['typing', 'turn', 'reach']) assert.ok(!gestureGate({ ...ok, pose }), pose);
  });
});

describe('pausableTimer', () => {
  it('dispara una vez a su hora y se puede cancelar', (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const fn = mock.fn();
    const a = pausableTimer(fn, 1000);
    t.mock.timers.tick(999);
    assert.equal(fn.mock.callCount(), 0);
    assert.ok(!a.done);
    t.mock.timers.tick(1);
    assert.equal(fn.mock.callCount(), 1);
    assert.ok(a.done);
    const fn2 = mock.fn();
    const b = pausableTimer(fn2, 500);
    b.cancel();
    t.mock.timers.tick(1000);
    assert.equal(fn2.mock.callCount(), 0);
    assert.ok(b.done);
  });
  it('con hidden nace pausado y al reanudar espera lo que le quedaba', (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const fn = mock.fn();
    const a = pausableTimer(fn, 800, { hidden: true });
    t.mock.timers.tick(5000);
    assert.equal(fn.mock.callCount(), 0, 'pausado no dispara');
    assert.ok(!a.done);
    a.resume();
    t.mock.timers.tick(799);
    assert.equal(fn.mock.callCount(), 0);
    t.mock.timers.tick(1);
    assert.equal(fn.mock.callCount(), 1);
    a.resume(); // ya disparado: no hace nada
    t.mock.timers.tick(2000);
    assert.equal(fn.mock.callCount(), 1);
  });
});
