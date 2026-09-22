// geom.js: geometría pura de la zona de juego (sin DOM). Puntos {x, y}; cajas con la forma de
// DOMRect ({left, top, width, height}); tamaños {w, h}. Todo en píxeles salvo que se diga otra cosa.

export function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max);
}

export function distance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

// Inclusivo: a la distancia exacta `r` sigue contando como cerca.
export function isNear(a, b, r) {
  return distance(a, b) <= r;
}

// Punto de cliente -> punto relativo a la esquina superior izquierda de la caja.
export function toLocal(pt, rect) {
  return { x: pt.x - rect.left, y: pt.y - rect.top };
}

// Fracciones [0, 1] de la caja en las que cae el punto (una caja sin tamaño devuelve 0).
export function fractionOf(pt, rect) {
  const fx = rect.width ? (pt.x - rect.left) / rect.width : 0;
  const fy = rect.height ? (pt.y - rect.top) / rect.height : 0;
  return { fx: clamp(fx, 0, 1), fy: clamp(fy, 0, 1) };
}

export function fromFraction({ fx, fy }, rect) {
  return { x: rect.left + fx * rect.width, y: rect.top + fy * rect.height };
}

// Lado del viewport más cercano a una x (la mitad exacta cae a la derecha).
export function nearestSide(x, width) {
  return x < width / 2 ? 'left' : 'right';
}

// Recorta la esquina superior izquierda de una caja `size` para que quede dentro del viewport con
// un margen `gutter`. Si no cabe, se pega al margen izquierdo/superior. La y solo se recorta cuando
// se conoce la altura del viewport.
export function clampToViewport(pos, size, gutter, viewport) {
  const x = clampAxis(pos.x, size.w, gutter, viewport.w);
  const y = viewport.h == null ? pos.y : clampAxis(pos.y, size.h, gutter, viewport.h);
  return { x, y };
}

function clampAxis(v, extent, gutter, limit) {
  const max = limit - extent - gutter;
  return max < gutter ? gutter : clamp(v, gutter, max);
}
