// ink.js: tinta del rotulador, sin DOM. Un trazo es { sec, w0, pts } con `pts` un array plano
// [x0, y0, x1, y1, ...] relativo a la sección donde empezó (w0 = ancho de la sección al dibujar).

export const INK_LIMITS = { strokes: 40, pointsPerStroke: 4000, points: 20000, minStep: 2, chunk: 600 };

// Añade un punto solo si se aleja al menos `minStep` del anterior. Devuelve true si lo añadió.
export function appendPoint(pts, x, y, minStep = INK_LIMITS.minStep) {
  const n = pts.length;
  if (n >= 2 && Math.hypot(x - pts[n - 2], y - pts[n - 1]) < minStep) return false;
  pts.push(x, y);
  return true;
}

// Atributo `d` con cuadráticas por los puntos medios (los puntos reales hacen de control), desde el
// punto de índice `from` (índice de punto, no de posición en el array). Un punto suelto se dibuja
// como `M L` sobre sí mismo para que los extremos redondeados lo pinten.
export function midpointPathD(pts, from = 0) {
  const n = pts.length / 2;
  if (from >= n) return '';
  const f = (v) => v.toFixed(1);
  let px = pts[from * 2];
  let py = pts[from * 2 + 1];
  let d = `M ${f(px)} ${f(py)} L ${f(px)} ${f(py)}`;
  for (let i = from + 1; i < n; i++) {
    const x = pts[i * 2];
    const y = pts[i * 2 + 1];
    d += ` Q ${f(px)} ${f(py)} ${f((px + x) / 2)} ${f((py + y) / 2)}`;
    px = x;
    py = y;
  }
  return d;
}

// Parte un trazo en tramos de como mucho `chunk` puntos; cada tramo repite el último punto del
// anterior para que los <path> enlacen sin hueco.
export function chunkStroke(pts, chunk = INK_LIMITS.chunk) {
  const n = pts.length / 2;
  const size = Math.max(2, chunk);
  const out = [];
  let start = 0;
  while (start < n) {
    const end = Math.min(start + size, n);
    out.push(pts.slice(start * 2, end * 2));
    if (end === n) break;
    start = end - 1;
  }
  return out;
}

// Ramer-Douglas-Peucker sobre el array plano. Devuelve un array plano nuevo.
export function simplify(pts, epsilon = 0.5) {
  const n = pts.length / 2;
  if (n < 3) return pts.slice();
  const keep = new Uint8Array(n);
  keep[0] = 1;
  keep[n - 1] = 1;
  const stack = [[0, n - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let far = -1;
    let dmax = 0;
    for (let i = a + 1; i < b; i++) {
      const d = lineDistance(pts, i, a, b);
      if (d > dmax) {
        dmax = d;
        far = i;
      }
    }
    if (far !== -1 && dmax > epsilon) {
      keep[far] = 1;
      stack.push([a, far], [far, b]);
    }
  }
  const out = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(pts[i * 2], pts[i * 2 + 1]);
  return out;
}

// Distancia perpendicular del punto i a la recta que pasa por los puntos a y b.
function lineDistance(pts, i, a, b) {
  const ax = pts[a * 2];
  const ay = pts[a * 2 + 1];
  const bx = pts[b * 2];
  const by = pts[b * 2 + 1];
  const x = pts[i * 2];
  const y = pts[i * 2 + 1];
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy);
  if (len === 0) return Math.hypot(x - ax, y - ay);
  return Math.abs(dy * x - dx * y + bx * ay - by * ax) / len;
}

// Retira los trazos más antiguos (FIFO) mientras se superen los topes. Muta `strokes` y devuelve
// los retirados en orden.
export function evict(strokes, limits = INK_LIMITS) {
  const removed = [];
  let total = strokes.reduce((acc, s) => acc + s.pts.length / 2, 0);
  while (strokes.length && (strokes.length > limits.strokes || total > limits.points)) {
    const s = strokes.shift();
    total -= s.pts.length / 2;
    removed.push(s);
  }
  return removed;
}

export function isFull(pts, limits = INK_LIMITS) {
  return pts.length / 2 >= limits.pointsPerStroke;
}

// `transform` del <g data-sec> que re-ancla los trazos de una sección: su esquina en coordenadas
// de documento y la escala respecto al ancho con el que se dibujaron.
export function anchorTransform(rect, w0, scrollX = 0, scrollY = 0) {
  const tx = round2(rect.left + scrollX);
  const ty = round2(rect.top + scrollY);
  const k = w0 ? round2(rect.width / w0) : 1;
  return `translate(${tx} ${ty}) scale(${k})`;
}

function round2(v) {
  return Math.round(v * 100) / 100;
}
