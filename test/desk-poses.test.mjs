// Coherencia de las poses del escritorio del hero entre lamp.js (POSES, STEP_MS), site.css (reglas [data-pose],
// .is-snap y el rig del giro de la silla) y desk.svg (capas del rig, taza en la mano, sin filtros en lo que se anima).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Como partials.test.mjs: CRLF normalizado para no depender del checkout.
const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const lamp = read('src/js/lamp.js');
const css = read('src/styles/site.css');
const svg = read('src/partials/desk.svg');

const poses = [...lamp.match(/const POSES = \[([^\]]*)\]/)[1].matchAll(/'([a-z]+)'/g)].map((m) => m[1]);
const stepKeys = [...lamp.match(/const STEP_MS = \{([^}]*)\}/)[1].matchAll(/([a-z]+):\s*\d+/g)].map((m) => m[1]);

// contenido de un <g> (de su etiqueta de apertura a su </g>), contando los <g> anidados
function group(src, openTag) {
  const start = src.indexOf(openTag);
  assert.ok(start >= 0, `desk.svg no tiene ${openTag}`);
  const tags = /<g[\s>]|<\/g>/g;
  tags.lastIndex = start + 1;
  let depth = 1;
  for (let m = tags.exec(src); m; m = tags.exec(src)) {
    depth += m[0] === '</g>' ? -1 : 1;
    if (depth === 0) return src.slice(start, m.index + 4);
  }
  return assert.fail(`${openTag} sin cerrar`);
}
const classLists = (src) => [...src.matchAll(/class="([^"]*)"/g)].map((m) => m[1].split(/\s+/));
const hasClass = (src, cls) => classLists(src).some((l) => l.includes(cls));
const countClass = (src, cls) => classLists(src).filter((l) => l.includes(cls)).length;

// reglas de site.css: { sel, body, parents } (sin comentarios; el preludio es lo que hay tras el ultimo ; o })
function cssRules(src) {
  const s = src.replace(/\/\*[\s\S]*?\*\//g, '');
  const out = [];
  const stack = [];
  let buf = '';
  for (const ch of s) {
    if (ch === '{') {
      stack.push(buf.split(';').pop().trim());
      buf = '';
    } else if (ch === '}') {
      const sel = stack.pop();
      out.push({ sel, body: buf.trim(), parents: [...stack] });
      buf = '';
    } else {
      buf += ch;
    }
  }
  assert.equal(stack.length, 0, 'site.css: llaves desequilibradas');
  return out;
}
const rules = cssRules(css);

// matrices 2D [a b c d e f] (x' = a x + c y + e, y' = b x + d y + f)
const D = Math.PI / 180;
const mul = (A, B) => [
  A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1],
  A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3],
  A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5],
];
const chain = (...ms) => ms.reduce(mul, [1, 0, 0, 1, 0, 0]);
const T = (x, y) => [1, 0, 0, 1, x, y];
const rot = (deg, cx, cy) => {
  const c = Math.cos(deg * D);
  const s = Math.sin(deg * D);
  return chain(T(cx, cy), [c, s, -s, c, 0, 0], T(-cx, -cy));
};
const inv = ([a, b, c, d, e, f]) => {
  const det = a * d - b * c;
  const ia = d / det, ib = -b / det, ic = -c / det, id = a / det;
  return [ia, ib, ic, id, -(ia * e + ic * f), -(ib * e + id * f)];
};
const matrixOf = (tag) => tag.match(/transform="matrix\(([^)]*)\)"/)[1].trim().split(/[\s,]+/).map(Number);
const near = (actual, expected, what) => {
  actual.forEach((v, i) => assert.ok(Math.abs(v - expected[i]) < 0.01, `${what}: ${actual.join(' ')} != ${expected.map((x) => x.toFixed(5)).join(' ')}`));
};
// pose hold (site.css): brazo -38deg en el hombro (548,344), antebrazo 69,7deg en el codo (580,406), taza de la mesa
// translate(0,-10) rotate(-6deg) sobre el asa (661,327)
const ARM = rot(-38, 548, 344);
const FORE = rot(69.7, 580, 406);
const MUG_HOLD = chain(T(0, -10), rot(-6, 661, 327));

describe('poses del escritorio', () => {
  it('POSES empieza en typing y acaba en face', () => {
    assert.equal(poses[0], 'typing');
    assert.equal(poses.at(-1), 'face');
  });

  it('POSES y las claves de STEP_MS coinciden en los dos sentidos', () => {
    assert.deepEqual([...stepKeys].sort(), [...poses].sort());
  });

  for (const pose of poses.filter((p) => p !== 'typing')) {
    it(`site.css tiene reglas para [data-pose="${pose}"]`, () => {
      assert.ok(css.includes(`[data-pose="${pose}"]`), `falta [data-pose="${pose}"] en site.css`);
    });
  }

  it('.is-snap quita la transicion a todos los grupos que la tienen (y al giro)', () => {
    const rule = css.match(/\.hero__desk\.is-snap :is\(([^)]*)\)\s*\{\s*transition:\s*none/);
    assert.ok(rule, 'no se encuentra la regla .hero__desk.is-snap :is(...) { transition: none }');
    const listed = rule[1].split(',').map((s) => s.trim());
    for (const part of ['head', 'head-back', 'head-turned', 'marco', 'skin', 'chair', 'mug-held', 'room-mug', 'arm', 'fore', 'mug', 'mug-shadow']) {
      assert.ok(listed.includes(`.desk__${part}`), `.is-snap no incluye .desk__${part}`);
    }
    for (const gone of ['body--front', 'body--back']) assert.ok(!listed.includes(`.desk__${gone}`), `.is-snap aun incluye .desk__${gone}`);
  });

  it('ningun filter= dentro de .desk__marco (se anima entero)', () => {
    const marco = group(svg, '<g class="desk__marco"');
    assert.ok(!/\sfilter=/.test(marco), 'hay un filter= dentro de .desk__marco');
  });
});

describe('rig del giro de la silla (site.css)', () => {
  it('@property --desk-turn es un <angle> declarado fuera de toda capa', () => {
    const prop = rules.find((r) => r.sel === '@property --desk-turn');
    assert.ok(prop, 'falta @property --desk-turn');
    assert.equal(prop.parents.length, 0, '@property --desk-turn debe ir a profundidad de llaves 0 (en un @layer se ignora)');
    assert.match(prop.body, /syntax:\s*'<angle>'/);
    assert.match(prop.body, /inherits:\s*true/);
    assert.match(prop.body, /initial-value:\s*0deg/);
  });

  it('.desk__marco transiciona --desk-turn (ida en face y vuelta en las reglas base)', () => {
    const turn = rules.filter((r) => /\.desk__marco\s*$/.test(r.sel) && /transition:\s*--desk-turn\s/.test(r.body));
    assert.ok(turn.some((r) => r.sel.includes('[data-pose="face"]') && /--desk-turn:\s*180deg/.test(r.body)), 'falta la ida a 180deg');
    assert.ok(turn.some((r) => !r.sel.includes('[data-pose') && /--desk-turn:\s*0deg/.test(r.body)), 'falta la vuelta a 0deg');
  });

  it('los envolventes que dependen del angulo no llevan transition (salvo el respaldo sin rig y .is-snap)', () => {
    const wrapperBases = ['desk__skin', 'desk__spin', 'desk__rig', 'desk__chair', 'desk__chair-arm', 'desk__chair-edge', 'desk__mug-held', 'desk__mug-tilt', 'desk__steam-lean', 'desk__dark', 'desk__room-mug'];
    const wrapperClasses = new Set(classLists(svg).filter((l) => l.some((c) => wrapperBases.includes(c))).flat());
    for (const base of wrapperBases) assert.ok(wrapperClasses.has(base), `desk.svg no usa ${base}`);
    for (const r of rules.filter((x) => /(^|;)\s*transition(-[a-z]+)?\s*:/.test(x.body))) {
      const used = [...r.sel.matchAll(/\.([\w-]+)/g)].map((m) => m[1]).filter((c) => wrapperClasses.has(c));
      if (!used.length) continue;
      assert.ok(r.sel.includes(':not(.is-rig)') || r.sel.includes('.is-snap'), `${r.sel} transiciona ${used.join(', ')} (va por angulo: sin transition)`);
    }
  });

  it('cada dibujo por angulo tiene opacidad con rig y sin rig', () => {
    const skins = new Set(classLists(svg).filter((l) => l.includes('desk__skin')).map((l) => l.find((c) => c !== 'desk__skin')));
    assert.ok(skins.size >= 10, `pocas skins: ${[...skins].join(', ')}`);
    const opacityRules = rules.filter((r) => /(^|;)\s*opacity\s*:/.test(r.body));
    for (const skin of skins) {
      const sel = new RegExp(`\\.${skin}(?![\\w-])`);
      assert.ok(opacityRules.some((r) => r.sel.includes('.is-rig') && !r.sel.includes(':not(.is-rig)') && sel.test(r.sel)), `${skin}: falta su opacidad por angulo (.is-rig)`);
      assert.ok(opacityRules.some((r) => r.sel.includes(':not(.is-rig)') && sel.test(r.sel)), `${skin}: falta su opacidad sin rig (:not(.is-rig))`);
    }
  });

  it('toda clase con transform-origin en linea en desk.svg tiene transform-box: view-box', () => {
    const list = css.match(/\.desk__art :is\(([^)]*)\)\s*\{\s*transform-box:\s*view-box/);
    assert.ok(list, 'no se encuentra la lista .desk__art :is(...) { transform-box: view-box }');
    const boxed = new Set(list[1].split(',').map((s) => s.trim().replace(/^\./, '')));
    for (const m of svg.matchAll(/<\w+ ([^>]*style="transform-origin[^"]*"[^>]*)>/g)) {
      const cls = (m[1].match(/class="([^"]*)"/) || [, ''])[1].split(/\s+/).filter(Boolean);
      assert.ok(cls.some((c) => boxed.has(c)), `transform-origin en linea sin transform-box: class="${cls.join(' ')}"`);
    }
  });
});

describe('capas del rig (desk.svg)', () => {
  const marco = group(svg, '<g class="desk__marco"');

  it('.desk__marco pinta respaldo de atras, cuerpo de espaldas, cabeza, torso, respaldo de delante y brazo de delante', () => {
    const order = [
      '<g class="desk__chair desk__chair--behind"',
      '<g class="desk__body desk__body--back"',
      '<g class="desk__head"',
      '<g class="desk__spin desk__spin--torso"',
      '<g class="desk__chair desk__chair--front"',
      '<g class="desk__chair-arm"',
      '<g class="desk__arm desk__arm--front"',
    ];
    const at = order.map((tag) => marco.indexOf(tag));
    order.forEach((tag, i) => assert.ok(at[i] >= 0, `falta ${tag} en .desk__marco`));
    for (let i = 1; i < at.length; i++) assert.ok(at[i] > at[i - 1], `${order[i]} debe ir despues de ${order[i - 1]}`);
    assert.ok(marco.startsWith('<g class="desk__marco">\n') && marco.indexOf('<g', 2) === at[0], 'el respaldo de atras es el primer hijo');
    assert.ok(!hasClass(svg, 'desk__body--front'), 'el cuerpo de frente del giro 2D ya no existe');
  });

  it('el cuerpo de espaldas lleva la taza de la mesa, la mano izquierda y el brazo con la taza en la mano', () => {
    const back = group(marco, '<g class="desk__body desk__body--back"');
    for (const cls of ['desk__room-mug', 'desk__mug', 'desk__mug-shadow', 'desk__hand--l', 'desk__arm', 'desk__arm--r', 'desk__mug-held', 'desk__skin--arm-back']) {
      assert.ok(hasClass(back, cls), `falta ${cls} en .desk__body--back`);
    }
  });

  it('una sola .desk__head (lamp.js la busca con querySelector) con sus cuatro caras en orden y dos parpados', () => {
    assert.equal(countClass(svg, 'desk__head'), 1, 'debe haber una sola .desk__head');
    const head = group(marco, '<g class="desk__head"');
    assert.ok(hasClass(head, 'desk__spin--head'), 'falta desk__spin--head en .desk__head');
    // de espaldas, perfil perdido, tres cuartos y de frente: cada una pinta sobre la anterior en su corte
    const skins = ['back', 'turned', '3q', 'front'].map((k) => `<g class="desk__skin desk__skin--head-${k}"`);
    const at = skins.map((tag) => head.indexOf(tag));
    skins.forEach((tag, i) => assert.ok(at[i] >= 0, `falta ${tag} en .desk__head`));
    for (let i = 1; i < at.length; i++) assert.ok(at[i] > at[i - 1], `${skins[i]} debe ir despues de ${skins[i - 1]}`);
    for (const cls of ['desk__head-back', 'desk__head-turned', 'desk__head-3q', 'desk__head-front']) assert.ok(hasClass(head, cls), `falta ${cls} en .desk__head`);
    assert.equal(countClass(head, 'desk__lid'), 2, 'la cabeza de frente lleva exactamente dos .desk__lid');
    assert.equal(countClass(group(head, '<g class="desk__head-front"'), 'desk__lid'), 2, 'los parpados van solo en la cabeza de frente');
    assert.equal(countClass(svg, 'desk__lid'), 2, 'no hay mas .desk__lid fuera de la cabeza');
    // tres cuartos: a oscuras en sombra como la de frente (por angulo), con luz calida y contraluz
    const q = group(head, '<g class="desk__head-3q"');
    for (const cls of ['desk__dark', 'desk__shade--full', 'desk__warm', 'desk__rim']) assert.ok(hasClass(q, cls), `falta ${cls} en .desk__head-3q`);
  });

  it('el torso lleva los detalles de espaldas y de frente y su sombra por angulo', () => {
    const torso = group(marco, '<g class="desk__spin desk__spin--torso"');
    for (const cls of ['desk__torso-back', 'desk__torso-front', 'desk__dark', 'desk__shade--full']) assert.ok(hasClass(torso, cls), `falta ${cls} en el torso`);
  });

  it('la manga izquierda va en el torso, detras del jersey (recortada a lo que sobresale) y tras su relleno', () => {
    const torso = group(marco, '<g class="desk__spin desk__spin--torso"');
    const clip = torso.indexOf('<g clip-path="url(#desk-torso-out)">');
    assert.ok(clip > 0, 'la manga izquierda va en un envolvente con clip-path="url(#desk-torso-out)"');
    assert.ok(group(torso, '<g clip-path="url(#desk-torso-out)">').includes('<g class="desk__skin desk__skin--sleeve-l"'), 'falta .desk__skin--sleeve-l dentro del recorte');
    // justo despues del relleno del jersey: antes de el, un grupo con opacidad cambia el rasterizado en reposo
    const paths = [...torso.matchAll(/<path /g)].map((m) => m.index);
    assert.ok(paths[0] < clip && clip < paths[1], 'el recorte va justo despues del relleno del jersey');
    assert.ok(/<clipPath id="desk-torso-out" clipPathUnits="userSpaceOnUse">/.test(svg), 'falta <clipPath id="desk-torso-out"> en defs');
    assert.ok(hasClass(group(torso, '<g class="desk__skin desk__skin--sleeve-l"'), 'desk__shade--full'), 'la manga izquierda lleva su sombra por angulo');
  });

  it('las dos copias del respaldo llevan su canto (.desk__chair-edge)', () => {
    for (const copy of ['desk__chair--behind', 'desk__chair--front']) {
      assert.equal(countClass(group(marco, `<g class="desk__chair ${copy}"`), 'desk__chair-edge'), 1, `falta el canto en .${copy}`);
    }
  });

  it('el reposabrazos va fuera del respaldo (no hereda su estrechado ni su opacidad)', () => {
    const front = group(marco, '<g class="desk__chair desk__chair--front"');
    assert.ok(!hasClass(front, 'desk__chair-arm'), '.desk__chair-arm no debe ir dentro de .desk__chair--front');
    assert.ok(hasClass(marco, 'desk__chair-arm'));
  });

  it('la copia delantera del brazo tiene el mismo rig, la taza en la mano y el vapor', () => {
    const arm = group(marco, '<g class="desk__arm desk__arm--front"');
    for (const cls of ['desk__rig--arm', 'desk__rig--fore', 'desk__fore--front', 'desk__mug-held', 'desk__mug-tilt', 'desk__steam-lean', 'desk__steam', 'desk__skin--sleeve-side', 'desk__skin--sleeve-front', 'desk__skin--hand-side', 'desk__skin--hand-front']) {
      assert.ok(hasClass(arm, cls), `falta ${cls} en .desk__arm--front`);
    }
    // la mano de la copia no teclea (desk-type-r va en .desk__hand--r)
    assert.ok(!hasClass(arm, 'desk__hand--r'), '.desk__arm--front no debe usar .desk__hand--r');
    // la manga de lado sustituye a la copia de la de espaldas en el tramo 57-123
    assert.ok(!hasClass(arm, 'desk__skin--sleeve-back'), '.desk__arm--front ya no lleva la manga de espaldas');
  });

  it('la manga de frente va partida por el codo: el tramo del brazo en .desk__rig--arm, el antebrazo con el puno en .desk__rig--fore', () => {
    const arm = group(marco, '<g class="desk__arm desk__arm--front"');
    const fore = group(arm, '<g class="desk__rig desk__rig--fore"');
    assert.ok(!hasClass(fore, 'desk__skin--sleeve-front') && !hasClass(fore, 'desk__skin--sleeve-side'), 'las mangas del brazo superior no van en el antebrazo');
    assert.ok(hasClass(fore, 'desk__skin--hand-front') && hasClass(fore, 'desk__skin--hand-side'), 'puno y mano de lado van en el antebrazo');
    // el puno de frente lleva el antebrazo de la manga: dos rellenos de manga (#383d46) en total, uno en cada rig
    const sleeveFill = (src) => (src.match(/fill="#383d46"/g) || []).length;
    assert.equal(sleeveFill(group(arm, '<g class="desk__skin desk__skin--sleeve-front"')), 1, 'tramo del codo en .desk__skin--sleeve-front');
    assert.equal(sleeveFill(group(fore, '<g class="desk__skin desk__skin--hand-front"')), 1, 'antebrazo de la manga junto al puno');
  });

  it('la taza en la mano coincide con la de la mesa en hold: matrix = inv(Brazo * Antebrazo) * TazaHold', () => {
    const tags = [...svg.matchAll(/<g class="desk__mug-held" [^>]*>/g)].map((m) => m[0]);
    assert.equal(tags.length, 2, 'una .desk__mug-held en cada copia del brazo');
    const expected = chain(inv(chain(ARM, FORE)), MUG_HOLD);
    for (const tag of tags) near(matrixOf(tag), expected, '.desk__mug-held');
  });

  it('el antebrazo y el puno de frente estan re-encajados en el rig a 180deg con los angulos de site.css', () => {
    // --dt-arm / --dt-fore = k1 * dt-m + k2 * sin(dt-m); a 180deg, dt-m = 180deg y sin = 0
    const k = (name) => Number(css.match(new RegExp(`${name}:\\s*calc\\((-?[\\d.]+) \\* var\\(--dt-m\\)`))[1]);
    const shoulder = T(94 * (Math.cos(180 * D) - 1), 0);
    const wArm = chain(shoulder, ARM, rot(k('--dt-arm') * 180, 548, 344));
    const wFore = chain(wArm, FORE, rot(k('--dt-fore') * 180, 580, 406));
    const SHIFT = T(-4, -5); // el puno baja al asa de la taza de la mesa (algo mas grande y alta que la dibujada de frente)
    const tagIn = (skin) => group(svg, `<g class="desk__skin ${skin}"`).match(/<g transform="matrix\([^)]*\)">/)[0];
    near(matrixOf(tagIn('desk__skin--sleeve-front')), chain(inv(wArm), SHIFT), 'manga de frente');
    near(matrixOf(tagIn('desk__skin--hand-front')), chain(inv(wFore), SHIFT), 'puno de frente');
  });
});
