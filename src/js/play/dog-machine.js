// dog-machine.js: reglas puras del patio (perro, hueso, caseta), sin DOM. Coordenadas en unidades
// del viewBox 800 x 260 del patio; el hueso se posiciona por su esquina superior izquierda.
import { clamp, distance, isNear } from './geom.js';

export const DOG_STATES = ['inHouse', 'fetching', 'grabbing', 'carrying', 'entering'];
export const BONE_STATES = ['resting', 'dragging', 'droppedNear', 'droppedFar', 'fetched', 'respawn'];

export const HOUSE = { x: 40, w: 242, doorRect: [172, 120, 88, 116], jambL: 172, jambR: 260, mat: { x: 270, y: 217 }, insideX: 20, exitX: 270 };
export const DOG = { w: 144, h: 115, mouthDx: 128, speed: 220 };
export const BONE = { w: 96, h: 38, y: 198, minY: 40, restMinX: 262, maxX: 704, spawnMinX: 460 };
export const NEAR = 140;
export const WARN = 200;

// Tabla de transiciones del perro: estado -> evento -> estado. Un evento no listado no cambia nada.
const TRANSITIONS = {
  inHouse: { fetch: 'fetching' },
  fetching: { reached: 'grabbing', interrupt: 'inHouse' },
  grabbing: { grabbed: 'carrying' },
  carrying: { reached: 'entering' },
  entering: { inside: 'inHouse' },
};

export function next(state, event) {
  return TRANSITIONS[state]?.[event] ?? state;
}

// x de reposo del hueso al soltarlo: fuera de la caseta y dentro del patio. `house` se acepta por
// simetría con dropOutcome; el tope izquierdo ya está medido en `bone.restMinX` (jamba derecha + 2).
export function settleX(x, house = HOUSE, bone = BONE) {
  return x < bone.restMinX ? bone.restMinX : Math.min(x, bone.maxX);
}

// Centro del hueso a partir de su esquina superior izquierda.
export function boneCenter(x, y = BONE.y, bone = BONE) {
  return { x: x + bone.w / 2, y: y + bone.h / 2 };
}

// Distancia del centro del hueso al felpudo (para el aviso `is-near` durante el arrastre).
export function matDistance(x, y = BONE.y, house = HOUSE, bone = BONE) {
  return distance(boneCenter(x, y, bone), house.mat);
}

// Resultado de soltar el hueso en `x`: dónde se queda y si el perro sale a por él.
export function dropOutcome(x, house = HOUSE, bone = BONE, near = NEAR) {
  const settled = settleX(x, house, bone);
  return { x: settled, near: isNear(boneCenter(settled, bone.y, bone), house.mat, near) };
}

// Posición del hueso durante el arrastre: resbala por el patio sin salirse de la ventana.
export function dragClamp(x, y, bone = BONE) {
  return { x: clamp(x, 0, bone.maxX), y: clamp(y, bone.minY, bone.y) };
}

// x entera de aparición de un hueso nuevo, en [spawnMinX, maxX].
export function spawnX(rng = Math.random, bone = BONE) {
  const span = bone.maxX - bone.spawnMinX + 1;
  return bone.spawnMinX + Math.min(span - 1, Math.floor(rng() * span));
}

// Duración de un paseo a velocidad constante, acotada para que ni parpadee ni se eternice.
export function walkDuration(dist, speed = DOG.speed, min = 700, max = 2600) {
  return clamp((dist / speed) * 1000, min, max);
}

export function nextPeekDelay(rng = Math.random, min = 18000, max = 40000) {
  return Math.round(min + rng() * (max - min));
}

// Solo se asoma con la pestaña visible, sin reduced motion, sin arrastre ni sheet, con el perro en
// casa, el usuario quieto un rato y una pantalla que no sea estrecha.
export function shouldPeek({ hidden, reduced, dragging, sheetOpen, state, idleMs, width }) {
  return !hidden && !reduced && !dragging && !sheetOpen && state === 'inHouse' && idleMs >= 2500 && width >= 360;
}

// Contador acumulado de huesos (`play.bones`); no mira el día, a diferencia de `rig.spills`.
export function bonesAfter(prev) {
  return { v: 1, n: (Number.isFinite(prev?.n) ? prev.n : 0) + 1, since: prev?.since ?? null };
}

// Clave de estado que se anuncia al entrar en `state` (null = solo cambia data-state).
export function announceFor(state, n = 0) {
  if (state === 'fetching') return 'fetching';
  if (state !== 'inHouse') return null;
  if (n >= 10) return 'delivered10';
  if (n >= 3) return 'delivered3';
  return 'delivered';
}
