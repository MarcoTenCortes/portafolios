// dog-machine.js: logica pura del perro (sin DOM). Coordenadas en px de cliente salvo que se indique.
import { clamp, distance, isNear } from './geom.js';

export const DOG_STATES = ['inHouse', 'running', 'entering'];
export const BONE_STATES = ['resting', 'dragging', 'dropped', 'delivering', 'away', 'respawn'];
export const PEEK_STATES = ['hidden', 'peekingIn', 'peeking', 'peekingOut'];

// La caseta se dibuja en un viewBox de 220x200 y se pinta ESPEJADA (la puerta queda a la izquierda).
export const HOUSE_VB = { w: 220, h: 200, door: { x: 20, y: 95, w: 80, h: 105 }, wall: { x: 20, w: 180 } };
export const DOG_RATIO = 160 / 200; // alto/ancho del dibujo del perro que camina
export const NEAR = 150;     // px: el hueso "huele" cerca de la puerta
export const APPROACH = 140; // px: el puntero se acerca al hueso
export const LEAVE = 260;    // px: el puntero se aleja del hueso

// Transiciones explicitas; todo lo demas deja el estado como esta.
const TABLE = {
  inHouse: { deliver: 'running' },
  running: { reached: 'entering', interrupt: 'inHouse' },
  entering: { inside: 'inHouse' },
};
export function next(state, event) {
  return TABLE[state]?.[event] ?? state;
}

// Rectangulo de la puerta en px de cliente a partir del rect de la caseta (ya espejada).
export function doorRect(house) {
  const s = house.width / HOUSE_VB.w;
  const d = HOUSE_VB.door;
  return { left: house.left + d.x * s, top: house.top + d.y * s, width: d.w * s, height: d.h * s };
}
export function doorCenter(house) {
  const r = doorRect(house);
  return { x: r.left + r.width / 2, y: r.top + r.height * 0.7 };
}
// El hueso esta "en la caseta" si su centro cae en la puerta (con un margen) o muy cerca de ella.
export function isInDoor(center, house, margin = 18) {
  const r = doorRect(house);
  const inside = center.x >= r.left - margin && center.x <= r.left + r.width + margin
    && center.y >= r.top - margin && center.y <= r.top + r.height + margin;
  return inside || isNear(center, doorCenter(house), 48);
}
export function isNearDoor(center, house, radius = NEAR) {
  return isNear(center, doorCenter(house), radius);
}
// Donde se para el perro para quedar del todo detras de la pared: justo pasada la puerta.
export function dogStopX(house, dogW) {
  const s = house.width / HOUSE_VB.w;
  const stop = (HOUSE_VB.door.x + HOUSE_VB.door.w) * s - 6;
  const maxLeft = (HOUSE_VB.wall.x + HOUSE_VB.wall.w) * s - dogW;
  return Math.min(stop, Math.max(0, maxLeft));
}
// Reposo del hueso dentro de la franja del patio: nunca sobre la caseta ni fuera de la seccion.
export function settleBone(pos, bone, section, house, gutter = 20) {
  let x = clamp(pos.x, gutter, section.width - bone.w - gutter);
  let y = clamp(pos.y, 0, section.height - bone.h);
  const overHouse = x + bone.w > house.left - 8 && x < house.left + house.width + 8 && y + bone.h > house.top;
  if (overHouse) x = Math.max(gutter, house.left - bone.w - 16);
  return { x, y };
}
export function spawnX(rng, section, bone, house, gutter = 20) {
  const max = Math.max(gutter, Math.min(section.width * 0.55, house.left - bone.w - 40));
  return Math.round(gutter + rng() * (max - gutter));
}
export function pointerZone(pointer, boneCenter, wasNear) {
  const d = distance(pointer, boneCenter);
  if (d <= APPROACH) return 'near';
  if (wasNear && d < LEAVE) return 'near';
  return 'far';
}
export function runDuration(px, speed = 380, min = 500, max = 2800) {
  return clamp((Math.abs(px) / speed) * 1000, min, max);
}
export function nextPeekDelay(rng = Math.random, min = 12000, max = 28000) {
  return Math.round(min + rng() * (max - min));
}
export function shouldPeek({ hidden, reduced, dragging, sheetOpen, state, idleMs, width }) {
  return !hidden && !reduced && !dragging && !sheetOpen && state === 'inHouse' && idleMs >= 2500 && width >= 360;
}
export function bonesAfter(prev) {
  return { v: 1, n: (Number.isFinite(prev?.n) ? prev.n : 0) + 1, since: prev?.since ?? null };
}
export function announceFor(n) {
  return n >= 10 ? 'delivered10' : n >= 3 ? 'delivered3' : 'delivered';
}
