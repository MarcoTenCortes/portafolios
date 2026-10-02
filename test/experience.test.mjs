// Escenas de Experiencia (src/js/experience.js): cada entrada de la linea temporal tiene su escena SVG, que se
// estampa desde lazy.html en la capa #exp-bg. Comprueba los ids, la capa, la plantilla, los SVG (formato, peso,
// sin filtros ni texto) y el arranque en main.js.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';

const url = (rel) => new URL(`../${rel}`, import.meta.url);
const read = (rel) => readFileSync(url(rel), 'utf8').replace(/\r\n/g, '\n');
const html = read('index.html');
const lazy = read('src/partials/lazy.html');
const main = read('src/js/main.js');
const readme = read('README.md');
const IDS = ['minsait', 'ntt', 'dynos'];

const section = html.slice(html.indexOf('<section class="experience'), html.indexOf('</section>', html.indexOf('<section class="experience')));
const items = [...section.matchAll(/<li class="timeline__item"[^>]*\bdata-exp="([^"]+)"/g)].map((m) => m[1]);

describe('experiencia: escenas', () => {
  it('cada entrada de la linea temporal tiene un data-exp unico, en orden', () => {
    assert.deepEqual(items, IDS);
    assert.equal((section.match(/<li class="timeline__item"/g) || []).length, IDS.length, 'todas las entradas llevan data-exp');
  });

  it('la capa #exp-bg (decorativa, estampada desde exp-scenes) va antes del contenedor', () => {
    const layer = section.match(/<div class="experience__bg" id="exp-bg"[^>]*>/);
    assert.ok(layer, 'falta la capa #exp-bg');
    assert.match(layer[0], /aria-hidden="true"/);
    assert.match(layer[0], /data-lazy="exp-scenes"/);
    assert.ok(section.indexOf('id="exp-bg"') < section.indexOf('<div class="container">'), 'la capa debe preceder a .container');
  });

  it('lazy.html tiene la plantilla exp-scenes con una escena y su partial por entrada', () => {
    const start = lazy.indexOf('<template data-for="exp-scenes">');
    assert.ok(start >= 0, 'falta <template data-for="exp-scenes">');
    const tpl = lazy.slice(start, lazy.indexOf('</template>', start));
    const scenes = [...tpl.matchAll(/<div class="experience__scene" data-exp="([^"]+)">/g)].map((m) => m[1]);
    assert.deepEqual(scenes, IDS);
    for (const id of IDS) {
      assert.ok(tpl.includes(`<!-- partial:exp-${id} -->`) && tpl.includes(`<!-- /partial:exp-${id} -->`), `faltan los marcadores de exp-${id}`);
    }
  });

  for (const id of IDS) {
    it(`src/partials/exp-${id}.svg: 1600x640 a sangre, decorativo, sin filtros ni texto y ligero`, () => {
      const file = `src/partials/exp-${id}.svg`;
      assert.ok(existsSync(url(file)), `${file} no existe`);
      const svg = read(file);
      const root = svg.match(/<svg\b[^>]*>/)[0];
      assert.match(root, /viewBox="0 0 1600 640"/);
      // recorte por la izquierda: Marco y el objeto clave quedan en el tercio derecho a cualquier ancho
      assert.match(root, /preserveAspectRatio="xMaxYMid slice"/);
      assert.match(root, /aria-hidden="true"/);
      assert.doesNotMatch(svg, /\bfilter=|<filter\b/, 'sin filtros (se anima la escena entera)');
      assert.doesNotMatch(svg, /<text\b/, 'sin texto legible');
      assert.doesNotMatch(svg, /class="desk__/, 'clases propias (exp__), no las del escritorio del hero');
      assert.ok(statSync(url(file)).size <= 16 * 1024, `${file} pesa mas de 16 KB`);
    });
  }

  it('main.js carga el modulo tras estampar y acepta ?exp= en desarrollo', () => {
    assert.match(main, /import\('\.\/experience\.js'\)/);
    assert.match(main, /params\.get\('exp'\)/);
  });

  it('el README documenta &exp=', () => {
    assert.match(readme, /&exp=/);
  });
});
