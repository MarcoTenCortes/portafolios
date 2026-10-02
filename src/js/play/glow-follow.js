// glow-follow.js: logica pura de la luz del raton (sin DOM). Puntos {x, y} en px de cliente; tiempos en ms.

export const GLOW_TAU = 70;    // ms: constante de tiempo de la cola (a los 70 ms recorre el 63 % del camino)
export const GLOW_SNAP = 0.25; // px: a esta distancia del objetivo se da por llegada y se para el bucle

// Un paso de suavizado exponencial, independiente del framerate: dos pasos de 8 ms equivalen a uno de 16.
// Sin posicion previa o con tau <= 0 (movimiento reducido) va directa al objetivo. Nunca sobrepasa.
export function followStep(cur, target, dtMs, tau = GLOW_TAU) {
  if (!cur || !(tau > 0)) return { x: target.x, y: target.y };
  const dt = Math.max(0, Number(dtMs) || 0);
  const k = 1 - Math.exp(-dt / tau);
  return { x: cur.x + (target.x - cur.x) * k, y: cur.y + (target.y - cur.y) * k };
}

// Inclusivo: a la distancia exacta `eps` ya ha llegado. Sin posicion previa nunca ha llegado.
export function hasArrived(cur, target, eps = GLOW_SNAP) {
  if (!cur || !target) return false;
  return Math.hypot(target.x - cur.x, target.y - cur.y) <= eps;
}

// Solo con raton (ni dedo ni lapiz), en dispositivos con hover, con la pestana visible y sin ficha ni menu abiertos.
export function glowGate({ coarse = false, pointerType = '', hidden = false, dialogOpen = false, sheetOpen = false } = {}) {
  return !coarse && pointerType === 'mouse' && !hidden && !dialogOpen && !sheetOpen;
}
