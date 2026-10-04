// gesture-machine.js: logica pura de los gestos de Marco de frente en el escritorio del hero (sin DOM). lamp.js la usa:
// con la lampara encendida y Marco ya de frente, cada 6-10 s hace un gesto al azar sin repetir el anterior.
export const GESTURE_GAP = { min: 6000, max: 10000 }; // ms entre el inicio de un gesto y el siguiente
export const GESTURE_SLACK = 600; // margen del tope de seguridad si no llega animationend (pausado, sin animaciones)
// duracion (la de todas sus animaciones CSS, [css:gest] en site.css) y keyframe cuyo animationend lo da por terminado
export const GESTURES = {
  wave: { ms: 2200, end: 'desk-wave' }, // saluda con la mano izquierda
  toast: { ms: 2400, end: 'desk-toast-fore' }, // brinda con la taza y da un sorbo
  wink: { ms: 1400, end: 'desk-wink' }, // guina el ojo derecho con la sonrisa mas ancha
  nod: { ms: 1400, end: 'desk-nod' }, // asiente
  tilt: { ms: 1400, end: 'desk-tilt' }, // ladea la cabeza
};
export const GESTURE_NAMES = Object.keys(GESTURES);

export function nextGestureDelay(rng = Math.random, min = GESTURE_GAP.min, max = GESTURE_GAP.max) {
  return Math.round(min + rng() * (max - min));
}
// uno al azar distinto del anterior (con un solo nombre posible, ese)
export function pickGesture(rng = Math.random, last = null, names = GESTURE_NAMES) {
  const pool = names.length > 1 ? names.filter((n) => n !== last) : names;
  return pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
}
// tope de seguridad del gesto en curso: su duracion mas el margen (0 si no existe)
export function gestureTimeout(name) {
  return GESTURES[name] ? GESTURES[name].ms + GESTURE_SLACK : 0;
}
// solo de frente con la lampara encendida, a la vista, con la pestana visible, sin ficha abierta y sin movimiento reducido
export function gestureGate({ hidden, offscreen, dialogOpen, reduced, lit, pose }) {
  return !hidden && !offscreen && !dialogOpen && !reduced && lit === true && pose === 'face';
}
