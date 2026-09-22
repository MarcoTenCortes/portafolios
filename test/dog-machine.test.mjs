import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DOG_STATES, BONE_STATES, HOUSE, DOG, BONE, NEAR, WARN,
  next, settleX, boneCenter, matDistance, dropOutcome, dragClamp, spawnX, walkDuration,
  nextPeekDelay, shouldPeek, bonesAfter, announceFor,
} from '../src/js/play/dog-machine.js';

describe('constantes', () => {
  it('lista los estados del perro y del hueso', () => {
    assert.deepEqual(DOG_STATES, ['inHouse', 'fetching', 'grabbing', 'carrying', 'entering']);
    assert.deepEqual(BONE_STATES, ['resting', 'dragging', 'droppedNear', 'droppedFar', 'fetched', 'respawn']);
  });
  it('la puerta va de jamba a jamba y apoya en el suelo', () => {
    const [x, y, w, h] = HOUSE.doorRect;
    assert.equal(x, HOUSE.jambL);
    assert.equal(x + w, HOUSE.jambR);
    assert.equal(y + h, 236);
  });
  it('el perro en reposo queda entero detrás de la jamba izquierda', () => {
    assert.ok(HOUSE.insideX + DOG.w < HOUSE.jambL);
    assert.ok(DOG.mouthDx <= DOG.w);
  });
  it('el hueso reposa fuera de la caseta y dentro del patio', () => {
    assert.ok(BONE.restMinX > HOUSE.jambR);
    assert.ok(BONE.spawnMinX >= BONE.restMinX);
    assert.ok(BONE.maxX + BONE.w <= 800);
    assert.ok(NEAR < WARN);
  });
});

describe('next', () => {
  it('recorre el ciclo completo de un paseo', () => {
    let s = 'inHouse';
    for (const [event, expected] of [['fetch', 'fetching'], ['reached', 'grabbing'], ['grabbed', 'carrying'], ['reached', 'entering'], ['inside', 'inHouse']]) {
      s = next(s, event);
      assert.equal(s, expected);
    }
  });
  it('un evento que no toca deja el estado igual', () => {
    assert.equal(next('fetching', 'peek'), 'fetching');
    assert.equal(next('inHouse', 'reached'), 'inHouse');
    assert.equal(next('entering', 'fetch'), 'entering');
  });
  it('coger el hueso durante el paseo de ida devuelve al perro a casa', () => {
    assert.equal(next('fetching', 'interrupt'), 'inHouse');
  });
  it('no hay interrupción con el hueso ya en la boca', () => {
    assert.equal(next('grabbing', 'interrupt'), 'grabbing');
    assert.equal(next('carrying', 'interrupt'), 'carrying');
  });
  it('un estado desconocido se devuelve tal cual', () => {
    assert.equal(next('volando', 'fetch'), 'volando');
  });
});

describe('settleX', () => {
  it('empuja fuera de la caseta', () => {
    assert.equal(settleX(100), 262);
  });
  it('no se sale por la derecha', () => {
    assert.equal(settleX(720), 704);
  });
  it('respeta una x válida', () => {
    assert.equal(settleX(400), 400);
  });
});

describe('boneCenter y matDistance', () => {
  it('el centro está a media anchura y media altura', () => {
    assert.deepEqual(boneCenter(262), { x: 310, y: 217 });
    assert.deepEqual(boneCenter(0, 100), { x: 48, y: 119 });
  });
  it('la distancia al felpudo se mide desde el centro', () => {
    assert.equal(matDistance(262), 40);
    assert.equal(matDistance(222, 198), 0);
  });
});

describe('dropOutcome', () => {
  it('soltar sobre la caseta lo deja en 262 y cerca', () => {
    assert.deepEqual(dropOutcome(100), { x: 262, near: true });
  });
  it('a 350 sigue cerca', () => {
    assert.equal(dropOutcome(350).near, true);
  });
  it('a 500 queda lejos', () => {
    assert.deepEqual(dropOutcome(500), { x: 500, near: false });
  });
  it('el radio es inclusivo', () => {
    assert.equal(dropOutcome(362).near, true);
    assert.equal(dropOutcome(363).near, false);
  });
  it('soltar fuera por la derecha recorta a 704', () => {
    assert.deepEqual(dropOutcome(900), { x: 704, near: false });
  });
});

describe('dragClamp', () => {
  it('recorta a la ventana del patio', () => {
    assert.deepEqual(dragClamp(-50, 500), { x: 0, y: 198 });
    assert.deepEqual(dragClamp(900, -10), { x: 704, y: 40 });
  });
  it('no toca una posición válida', () => {
    assert.deepEqual(dragClamp(300, 100), { x: 300, y: 100 });
  });
});

describe('spawnX', () => {
  it('cubre exactamente [460, 704] con los extremos del rng', () => {
    assert.equal(spawnX(() => 0), 460);
    assert.equal(spawnX(() => 0.999999), 704);
    assert.equal(spawnX(() => 1), 704);
  });
  it('siempre devuelve un entero en el rango', () => {
    let seed = 1;
    const rng = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < 500; i++) {
      const x = spawnX(rng);
      assert.ok(Number.isInteger(x), `no entero: ${x}`);
      assert.ok(x >= 460 && x <= 704, `fuera de rango: ${x}`);
    }
  });
});

describe('walkDuration', () => {
  it('nunca baja de 700 ms', () => {
    assert.equal(walkDuration(10), 700);
  });
  it('nunca pasa de 2600 ms', () => {
    assert.equal(walkDuration(1000), 2600);
  });
  it('a 220 u/s, 440 unidades son 2 segundos', () => {
    assert.equal(walkDuration(440), 2000);
  });
  it('acepta otra velocidad y otros topes', () => {
    assert.equal(walkDuration(100, 100, 0, 10000), 1000);
  });
});

describe('nextPeekDelay', () => {
  it('va de 18 a 40 segundos', () => {
    assert.equal(nextPeekDelay(() => 0), 18000);
    assert.equal(nextPeekDelay(() => 1), 40000);
    assert.equal(nextPeekDelay(() => 0.5), 29000);
  });
  it('acepta otro rango', () => {
    assert.equal(nextPeekDelay(() => 0.5, 3000, 6000), 4500);
  });
});

describe('shouldPeek', () => {
  const ok = { hidden: false, reduced: false, dragging: false, sheetOpen: false, state: 'inHouse', idleMs: 2500, width: 360 };
  it('se asoma con todo en orden (los límites son inclusivos)', () => {
    assert.equal(shouldPeek(ok), true);
  });
  const blockers = [
    ['la pestaña oculta', { hidden: true }],
    ['reduced motion', { reduced: true }],
    ['un arrastre activo', { dragging: true }],
    ['el sheet abierto', { sheetOpen: true }],
    ['el perro fuera de casa', { state: 'fetching' }],
    ['el usuario activo hace menos de 2,5 s', { idleMs: 2499 }],
    ['una pantalla estrecha', { width: 359 }],
  ];
  for (const [name, patch] of blockers) {
    it(`no se asoma con ${name}`, () => {
      assert.equal(shouldPeek({ ...ok, ...patch }), false);
    });
  }
});

describe('bonesAfter', () => {
  it('suma uno sin mirar el día', () => {
    assert.deepEqual(bonesAfter({ v: 1, n: 2, since: '2026-09-22' }), { v: 1, n: 3, since: '2026-09-22' });
  });
  it('empieza en 1 sin registro previo', () => {
    assert.deepEqual(bonesAfter(null), { v: 1, n: 1, since: null });
    assert.deepEqual(bonesAfter(undefined), { v: 1, n: 1, since: null });
  });
  it('ignora un contador que no sea numérico', () => {
    assert.deepEqual(bonesAfter({ n: 'x' }), { v: 1, n: 1, since: null });
    assert.deepEqual(bonesAfter({ n: NaN, since: 5 }), { v: 1, n: 1, since: 5 });
  });
});

describe('announceFor', () => {
  it('anuncia la salida a por el hueso', () => {
    assert.equal(announceFor('fetching'), 'fetching');
  });
  it('los pasos intermedios no anuncian nada', () => {
    for (const s of ['grabbing', 'carrying', 'entering']) assert.equal(announceFor(s, 5), null);
  });
  it('escalona la entrega según el contador', () => {
    assert.equal(announceFor('inHouse', 1), 'delivered');
    assert.equal(announceFor('inHouse', 3), 'delivered3');
    assert.equal(announceFor('inHouse', 9), 'delivered3');
    assert.equal(announceFor('inHouse', 10), 'delivered10');
  });
  it('sin contador anuncia la entrega básica', () => {
    assert.equal(announceFor('inHouse'), 'delivered');
  });
});
