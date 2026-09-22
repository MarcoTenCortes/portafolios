import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DOG_STATES, BONE_STATES, PEEK_STATES, HOUSE_VB, NEAR, APPROACH, LEAVE,
  next, doorRect, doorCenter, isInDoor, isNearDoor, dogStopX, settleBone, spawnX,
  pointerZone, runDuration, nextPeekDelay, shouldPeek, bonesAfter, announceFor,
} from '../src/js/play/dog-machine.js';

// caseta de 220 px de ancho (escala 1) en (500, 300)
const house = { left: 500, top: 300, width: 220, height: 200 };

describe('estados', () => {
  it('las listas de estados son las esperadas', () => {
    assert.deepEqual(DOG_STATES, ['inHouse', 'running', 'entering']);
    assert.deepEqual(BONE_STATES, ['resting', 'dragging', 'dropped', 'delivering', 'away', 'respawn']);
    assert.deepEqual(PEEK_STATES, ['hidden', 'peekingIn', 'peeking', 'peekingOut']);
  });
  it('next sigue la tabla y deja el estado si el evento no aplica', () => {
    assert.equal(next('inHouse', 'deliver'), 'running');
    assert.equal(next('running', 'reached'), 'entering');
    assert.equal(next('running', 'interrupt'), 'inHouse');
    assert.equal(next('entering', 'inside'), 'inHouse');
    assert.equal(next('inHouse', 'reached'), 'inHouse');
    assert.equal(next('running', 'peek'), 'running');
  });
});

describe('puerta de la caseta', () => {
  it('doorRect escala el hueco de la puerta (espejada, a la izquierda)', () => {
    const r = doorRect(house);
    assert.deepEqual(r, { left: 520, top: 395, width: 80, height: 105 });
    const half = doorRect({ ...house, width: 110 });
    assert.deepEqual(half, { left: 510, top: 347.5, width: 40, height: 52.5 });
  });
  it('doorCenter esta en el hueco, hacia abajo', () => {
    const c = doorCenter(house);
    assert.equal(c.x, 560);
    assert.equal(c.y, 395 + 105 * 0.7);
  });
  it('isInDoor acepta el centro en el hueco, con margen, y cerca del centro', () => {
    assert.ok(isInDoor({ x: 560, y: 450 }, house));
    assert.ok(isInDoor({ x: 520 - 10, y: 400 }, house), 'margen izquierdo');
    assert.ok(!isInDoor({ x: 300, y: 450 }, house));
    assert.ok(!isInDoor({ x: 560, y: 200 }, house), 'por encima del tejado');
    assert.ok(isInDoor({ x: 600 + 14, y: 470 }, house), 'margen derecho');
    assert.ok(!isInDoor({ x: 600 + 20, y: 470 }, house), 'fuera del margen y a mas de 48 px del centro');
  });
  it('isNearDoor usa el radio NEAR', () => {
    const c = doorCenter(house);
    assert.ok(isNearDoor({ x: c.x + NEAR, y: c.y }, house));
    assert.ok(!isNearDoor({ x: c.x + NEAR + 1, y: c.y }, house));
  });
  it('dogStopX deja al perro pasada la puerta y dentro de la pared', () => {
    assert.equal(dogStopX(house, 90), 94);
    // perro demasiado ancho: no puede sobresalir por la derecha de la pared
    assert.equal(dogStopX(house, 150), 200 - 150);
    assert.equal(dogStopX({ ...house, width: 110 }, 46), 44);
  });
});

describe('hueso', () => {
  const section = { width: 1200, height: 800 };
  const bone = { w: 96, h: 38 };
  const h = { left: 900, top: 600, width: 220, height: 200 };
  it('settleBone recorta a la seccion', () => {
    assert.deepEqual(settleBone({ x: -50, y: -50 }, bone, section, h), { x: 20, y: 0 });
    // abajo a la derecha caeria sobre la caseta (900..1120): se empuja a su izquierda
    assert.deepEqual(settleBone({ x: 5000, y: 5000 }, bone, section, h), { x: 900 - 96 - 16, y: 800 - 38 });
    assert.deepEqual(settleBone({ x: 5000, y: 100 }, bone, section, h), { x: 1200 - 96 - 20, y: 100 }, 'por encima de la caseta no estorba');
  });
  it('settleBone empuja el hueso fuera de la caseta', () => {
    const r = settleBone({ x: 950, y: 700 }, bone, section, h);
    assert.equal(r.x, 900 - 96 - 16);
    assert.equal(r.y, 700);
  });
  it('spawnX cae en la mitad izquierda y nunca sobre la caseta', () => {
    for (const v of [0, 0.5, 1]) {
      const x = spawnX(() => v, section, bone, h);
      assert.ok(x >= 20 && x <= 900 - 96 - 40, String(x));
    }
    assert.equal(spawnX(() => 0, section, bone, h), 20);
  });
});

describe('cercania del puntero', () => {
  const c = { x: 100, y: 100 };
  it('near dentro de APPROACH, far fuera de LEAVE, histéresis en medio', () => {
    assert.equal(pointerZone({ x: 100 + APPROACH, y: 100 }, c, false), 'near');
    assert.equal(pointerZone({ x: 100 + APPROACH + 1, y: 100 }, c, false), 'far');
    assert.equal(pointerZone({ x: 100 + APPROACH + 1, y: 100 }, c, true), 'near');
    assert.equal(pointerZone({ x: 100 + LEAVE, y: 100 }, c, true), 'far');
  });
});

describe('tiempos', () => {
  it('runDuration se acota entre min y max', () => {
    assert.equal(runDuration(10), 500);
    assert.equal(runDuration(3800), 2800);
    assert.equal(runDuration(760), 2000);
  });
  it('nextPeekDelay esta entre 12 y 28 s', () => {
    assert.equal(nextPeekDelay(() => 0), 12000);
    assert.equal(nextPeekDelay(() => 1), 28000);
  });
  it('shouldPeek exige pestana visible, sin movimiento reducido, sin arrastre, sin menu, perro en casa, 2,5 s quieto y ancho >= 360', () => {
    const ok = { hidden: false, reduced: false, dragging: false, sheetOpen: false, state: 'inHouse', idleMs: 2500, width: 360 };
    assert.ok(shouldPeek(ok));
    for (const [k, v] of Object.entries({ hidden: true, reduced: true, dragging: true, sheetOpen: true, state: 'running', idleMs: 2499, width: 359 })) {
      assert.ok(!shouldPeek({ ...ok, [k]: v }), k);
    }
  });
});

describe('contador y anuncios', () => {
  it('bonesAfter incrementa sin mirar el dia', () => {
    assert.deepEqual(bonesAfter({ n: 2, since: '2026-09-22' }), { v: 1, n: 3, since: '2026-09-22' });
    assert.deepEqual(bonesAfter(null), { v: 1, n: 1, since: null });
  });
  it('announceFor escala en 3 y 10', () => {
    assert.equal(announceFor(1), 'delivered');
    assert.equal(announceFor(3), 'delivered3');
    assert.equal(announceFor(10), 'delivered10');
  });
});
