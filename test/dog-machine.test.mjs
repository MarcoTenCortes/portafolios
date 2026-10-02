import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DOG_STATES, BONE_STATES, PEEK_STATES, HOUSE_VB, NEAR, APPROACH, LEAVE,
  next, doorRect, doorCenter, isInDoor, isNearDoor, dogStopX, homeDogX, settleBone, spawnX,
  pointerZone, runDuration, nextPeekDelay, nextPeekHold, shouldPeek, peekBox, distanceToRect, isShy, SHY, bonesAfter, announceFor,
  FIRST_PEEK_AT, FIRST_PEEK_WINDOW, PEEK_IDLE, PEEK_GAP, PEEK_HOLD, PEEK_RETRY, firstPeekDelay, peekRetryDelay, isFirstPeekWindow,
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
  it('nextPeekDelay esta entre 3 y 7 s (se cuenta desde que se esconde; con 8-12 s de permanencia sale cada ~15 s)', () => {
    assert.equal(nextPeekDelay(() => 0), 3000);
    assert.equal(nextPeekDelay(() => 1), 7000);
    assert.deepEqual(PEEK_GAP, { min: 3000, max: 7000 });
  });
  it('nextPeekHold esta entre 8 y 12 s (el triple que antes)', () => {
    assert.equal(nextPeekHold(() => 0), 8000);
    assert.equal(nextPeekHold(() => 1), 12000);
    assert.deepEqual(PEEK_HOLD, { min: 8000, max: 12000 });
  });
  it('peekRetryDelay (la puerta ha fallado) reintenta entre 1,5 y 3 s', () => {
    assert.equal(peekRetryDelay(() => 0), 1500);
    assert.equal(peekRetryDelay(() => 1), 3000);
    assert.deepEqual(PEEK_RETRY, { min: 1500, max: 3000 });
  });
  it('la primera aparicion es a los 10 s de ver la pagina y la regla de estar quieto son 2,5 s', () => {
    assert.equal(FIRST_PEEK_AT, 10000);
    assert.equal(FIRST_PEEK_WINDOW, 20000);
    assert.equal(PEEK_IDLE, 2500);
  });
  it('firstPeekDelay cuenta los 10 s desde enteredAt, entero sin enteredAt y nunca negativo', () => {
    assert.equal(firstPeekDelay(0), 10000);
    assert.equal(firstPeekDelay(2500), 7500, 'el modulo arranca 2,5 s despues de la navegacion');
    assert.equal(firstPeekDelay(12000), 0, 'ya han pasado los 10 s: al instante');
    assert.equal(firstPeekDelay(9000, 3000), 4000, 'la pestana se vio a los 3 s');
    assert.equal(firstPeekDelay(9000, null), 10000, 'pestana en segundo plano: aun no se ha visto');
    assert.equal(firstPeekDelay(1000, 0, 4000), 3000);
  });
  it('isFirstPeekWindow: la primera solo es especial durante FIRST_PEEK_WINDOW desde enteredAt', () => {
    assert.ok(isFirstPeekWindow(10000, 0));
    assert.ok(isFirstPeekWindow(19999, 0));
    assert.ok(!isFirstPeekWindow(20000, 0));
    assert.ok(isFirstPeekWindow(24000, 6000), 'cuenta desde que se vio');
    assert.ok(isFirstPeekWindow(50000, null), 'sin ver la pagina la ventana no ha empezado');
    assert.ok(!isFirstPeekWindow(5000, 0, 4000));
  });
  it('shouldPeek exige pestana visible, sin movimiento reducido, sin arrastre, sin menu, perro en casa y no a la vista, 2,5 s quieto y ancho >= 360', () => {
    const ok = { hidden: false, reduced: false, dragging: false, sheetOpen: false, state: 'inHouse', idleMs: 2500, width: 360, dogVisible: false };
    assert.ok(shouldPeek(ok));
    for (const [k, v] of Object.entries({ hidden: true, reduced: true, dragging: true, sheetOpen: true, state: 'running', idleMs: 2499, width: 359, dogVisible: true })) {
      assert.ok(!shouldPeek({ ...ok, [k]: v }), k);
    }
    // sin el campo (llamadas antiguas) se asume que el perro del patio no esta a la vista
    const { dogVisible, ...legacy } = ok;
    assert.ok(shouldPeek(legacy));
  });
  it('shouldPeek con minIdle 0 (primera aparicion) acepta al visitante en movimiento pero mantiene el resto de la puerta', () => {
    const moving = { hidden: false, reduced: false, dragging: false, sheetOpen: false, state: 'inHouse', idleMs: 0, width: 360, dogVisible: false };
    assert.ok(shouldPeek({ ...moving, minIdle: 0 }));
    assert.ok(!shouldPeek(moving), 'sin minIdle sigue exigiendo PEEK_IDLE');
    assert.ok(!shouldPeek({ ...moving, idleMs: 2499 }));
    assert.ok(!shouldPeek({ ...moving, idleMs: 2499, minIdle: undefined }), 'undefined = valor por defecto');
    for (const [k, v] of Object.entries({ hidden: true, reduced: true, dragging: true, sheetOpen: true, state: 'running', width: 359, dogVisible: true })) {
      assert.ok(!shouldPeek({ ...moving, minIdle: 0, [k]: v }), k);
    }
  });
});

describe('perro asomado por el borde', () => {
  const size = { w: 104, h: 93 };
  it('peekBox ocupa solo la parte visible pegada al borde', () => {
    assert.deepEqual(peekBox('left', 300, size, 1280), { left: 0, top: 300, right: 73, bottom: 393 });
    assert.deepEqual(peekBox('right', 300, size, 1280), { left: 1207, top: 300, right: 1280, bottom: 393 });
  });
  it('distanceToRect es 0 dentro y la distancia al borde mas cercano fuera', () => {
    const r = { left: 0, top: 300, right: 73, bottom: 393 };
    assert.equal(distanceToRect({ x: 10, y: 350 }, r), 0);
    assert.equal(distanceToRect({ x: 173, y: 350 }, r), 100);
    assert.equal(distanceToRect({ x: 10, y: 200 }, r), 100);
    assert.equal(distanceToRect({ x: 73 + 30, y: 393 + 40 }, r), 50);
  });
  it('isShy: el puntero a SHY px o menos lo esconde', () => {
    const r = { left: 0, top: 300, right: 73, bottom: 393 };
    assert.ok(isShy({ x: 73 + SHY, y: 350 }, r));
    assert.ok(!isShy({ x: 73 + SHY + 1, y: 350 }, r));
  });
});

describe('perro jugando en la puerta', () => {
  it('homeDogX deja la cabeza fuera del marco y el resto en la puerta o tras la pared', () => {
    // casa de 220 (escala 1), puerta 20..100; perro de 120 mirando a la izquierda
    const x = homeDogX(house, 120);
    assert.equal(x, 500 + 20 - 36);
    assert.ok(x < 520, 'la cabeza sobresale del marco');
    assert.ok(x + 120 <= 700, 'el rabo no asoma por la derecha de la pared');
    // casa movil de 150: escala 0.68, perro de 90
    const xm = homeDogX({ left: 220, top: 32, width: 150, height: 136 }, 90);
    assert.ok(xm < 220 + 20 * (150 / 220) && xm + 90 <= 220 + 150);
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
