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
// Perro asomado por los bordes: la primera vez a los 10 s de ver la pagina (aunque el visitante se este moviendo);
// despues, escondido 3-7 s (contando desde que se esconde) y a la vista 8-12 s; si falla la puerta, reintento en 1,5-3 s.
export const FIRST_PEEK_AT = 10000;     // ms desde que se ve la pagina hasta la primera aparicion
export const FIRST_PEEK_WINDOW = 20000; // ms: pasada esta ventana desde enteredAt la primera deja de ser especial
export const PEEK_IDLE = 2500;          // ms sin tocar nada que exige la puerta (salvo la primera vez)
export const PEEK_GAP = { min: 3000, max: 7000 };
export const PEEK_HOLD = { min: 8000, max: 12000 };
export const PEEK_RETRY = { min: 1500, max: 3000 };
export function nextPeekDelay(rng = Math.random, min = PEEK_GAP.min, max = PEEK_GAP.max) {
  return Math.round(min + rng() * (max - min));
}
export function nextPeekHold(rng = Math.random, min = PEEK_HOLD.min, max = PEEK_HOLD.max) {
  return Math.round(min + rng() * (max - min));
}
export function peekRetryDelay(rng = Math.random) {
  return Math.round(PEEK_RETRY.min + rng() * (PEEK_RETRY.max - PEEK_RETRY.min));
}
// Espera hasta la primera aparicion: `at` ms desde enteredAt (performance.now() en que se vio la pagina; 0 = la
// navegacion). Sin enteredAt (pestana abierta en segundo plano y aun sin ver), el plazo entero. Nunca negativo.
export function firstPeekDelay(now, enteredAt = 0, at = FIRST_PEEK_AT) {
  if (enteredAt == null) return at;
  return Math.max(0, Math.round(enteredAt + at - now));
}
// La primera aparicion solo se salta la regla de estar quieto dentro de esta ventana (sin enteredAt aun no ha empezado).
export function isFirstPeekWindow(now, enteredAt = 0, windowMs = FIRST_PEEK_WINDOW) {
  if (enteredAt == null) return true;
  return now - enteredAt < windowMs;
}
// dogVisible: el perro del patio esta fuera (asomado por el borde o jugando en la puerta): no puede estar en dos sitios.
// minIdle: ms sin tocar nada que se exigen (0 en la primera aparicion; sin el campo, PEEK_IDLE).
export function shouldPeek({ hidden, reduced, dragging, sheetOpen, state, idleMs, width, dogVisible = false, minIdle = PEEK_IDLE }) {
  return !hidden && !reduced && !dragging && !sheetOpen && state === 'inHouse' && !dogVisible && idleMs >= minIdle && width >= 360;
}
// Caja (px de cliente) que ocupa el perro asomado por un borde: solo la parte visible.
export function peekBox(side, y, size, viewportW, visibleFraction = 0.7) {
  const vis = Math.round(size.w * visibleFraction);
  return side === 'left'
    ? { left: 0, top: y, right: vis, bottom: y + size.h }
    : { left: viewportW - vis, top: y, right: viewportW, bottom: y + size.h };
}
export function distanceToRect(p, r) {
  const dx = Math.max(r.left - p.x, 0, p.x - r.right);
  const dy = Math.max(r.top - p.y, 0, p.y - r.bottom);
  return Math.hypot(dx, dy);
}
export const SHY = 90; // px: el perro asomado se esconde si el puntero se acerca a esta distancia
export function isShy(pointer, box, radius = SHY) {
  return distanceToRect(pointer, box) <= radius;
}
// x del perro (mirando a la izquierda) asomado por la puerta: la cabeza sobresale `out` de su ancho del marco.
export function homeDogX(house, dogW, out = 0.3) {
  const s = house.width / HOUSE_VB.w;
  return house.left + HOUSE_VB.door.x * s - dogW * out;
}
export function bonesAfter(prev) {
  return { v: 1, n: (Number.isFinite(prev?.n) ? prev.n : 0) + 1, since: prev?.since ?? null };
}
export function announceFor(n) {
  return n >= 10 ? 'delivered10' : n >= 3 ? 'delivered3' : 'delivered';
}
