# Fichas de proyecto (`src/partials/projects/<id>.html`)

Cada tarjeta de `#proyectos` (`<article class="card" data-project="<id>">` en `index.html`) abre su ficha en un
único `<dialog id="project-dialog">` que se superpone a la página. El sistema vive en `src/js/projects.js`; aquí
solo van los fragmentos de contenido, uno por proyecto, cargados bajo demanda con
`import.meta.glob('../partials/projects/*.html', { query: '?raw' })` (cada uno es un chunk). No hay que registrar
nada: basta con crear el fichero con el nombre del `data-project` de su tarjeta.

Ids de las tarjetas, en el orden del HTML: `faro`, `simpl`, `qa`, `tfg`, `cinema`, `nakoa`, `telegram`, `tareas`.
Si falta el fichero, el sistema no abre nada y enseña el aviso `projects.detail.missing`.

Referencia completa: `faro.html` (dos diagramas, cifras, resultados) y `simpl.html` (diagrama, stack, enlaces).

## Estructura

```html
<article class="pdoc" data-project="<id>">
  <header class="pdoc__head">
    <p class="eyebrow pdoc__kicker" data-i18n="projects.<id>.detail.kicker">…</p>
    <h2 class="display-md" id="pdialog-title" data-i18n="projects.<id>.title">…</h2>   <!-- reutiliza el título de la tarjeta -->
    <p class="lead pdoc__lead" data-i18n="projects.<id>.detail.lead">…</p>
    <div class="pdoc__actions">…</div>        <!-- botones de demo/código (.btn .btn--sm) o el .badge de privado -->
    <ul class="chips chips--inline" aria-label="Tecnologías" data-i18n-attr="aria-label:projects.detail.tech">…</ul>
  </header>

  <dl class="pdoc__facts" aria-label="En cifras" data-i18n-attr="aria-label:projects.detail.facts">
    <!-- 3 o 4; en el HTML va primero la etiqueta (dt) y el CSS pinta antes la cifra -->
    <div class="pdoc__fact"><dt class="pdoc__fact-label" data-i18n="….fact1_label">…</dt><dd class="pdoc__fact-value" data-i18n="….fact1_value">…</dd></div>
  </dl>

  <section class="pdoc__section">
    <h3 class="heading-lg" data-i18n="projects.detail.context">Contexto</h3>   <!-- el número 01, 02… lo pone el CSS -->
    <div class="pdoc__content"> <p class="body" …>…</p> </div>
  </section>

  <section class="pdoc__section">                                            <!-- Arquitectura -->
    <h3 class="heading-lg" data-i18n="projects.detail.architecture">Arquitectura</h3>
    <div class="pdoc__content"><p class="body" …>…</p></div>
    <figure class="pdoc__figure pdoc__wide">                                 <!-- .pdoc__wide = a todo el ancho -->
      <div class="pdoc__canvas">
        <svg class="dg pdoc__diagram pdoc__diagram--wide" …>…</svg>        <!-- escritorio -->
        <svg class="dg pdoc__diagram pdoc__diagram--tall" …>…</svg>        <!-- panel estrecho (< 860 px) -->
      </div>
      <figcaption data-i18n="…">…</figcaption>                              <!-- opcional -->
    </figure>
    <ol class="pdoc__steps pdoc__wide"><li data-i18n="….step1">…</li>…</ol> <!-- 1, 2, 3… = los círculos del diagrama -->
  </section>

  <footer class="pdoc__footer">
    <button type="button" class="btn btn--secondary pdoc__back" data-pdialog-close><span class="pdoc__back-arrow" aria-hidden="true">←</span><span data-i18n="projects.detail.back">Volver</span></button>
    …                                                                        <!-- a la derecha: repo/demo o el badge -->
  </footer>
</article>
```

Secciones disponibles (usa solo las que tengan sentido, en este orden): Contexto (`projects.detail.context`), Qué
hice (`.role`), Arquitectura (`.architecture`), Stack (`.stack`), Resultados (`.results`), Qué aprendí
(`.learned`), Enlaces (`.links`).

Piezas de contenido que ya tienen estilo dentro de `.pdoc__content`:

- `.body` párrafos; `.bullets` listas con punto azul.
- `.pdoc__dl` filas etiqueta/valor (`<dl class="pdoc__dl"><div><dt>…</dt><dd>…</dd></div></dl>`), para Stack.
- `.pdoc__quote` una frase con filete azul, para Qué aprendí.
- `.pdoc__links` con filas `.action` (las de Contacto) para enlaces externos.
- `.pdoc__figure` + `.pdoc__canvas` (fondo de puntos) para un diagrama; `.pdoc__canvas--compact` y
  `.pdoc__diagram--small` (máx. 420 px) para uno pequeño dentro de la columna de texto, legible también en móvil
  sin versión alta (ver el ciclo de `faro.html`).

Cualquier elemento directo de `.pdoc__section` que no sea el `h3` va en la columna de contenido; con `.pdoc__wide`
ocupa las dos columnas. Por debajo de 760 px de panel todo pasa a una columna (container query sobre
`.pdialog__body`, no sobre la ventana).

## Claves i18n

- Comunes (ya existen): `projects.detail.{close,back,context,role,architecture,stack,results,learned,links,tech,facts,missing,more_aria}`, `projects.cta_more`, `projects.cta_repo_public`, y las de la tarjeta (`projects.<id>.title`, `projects.cta_demo`, `projects.cta_repo`, `projects.private_note`).
- Por ficha: `projects.<id>.detail.<campo>`, p. ej. `kicker`, `lead`, `fact1_value`/`fact1_label`…, `context`,
  `role1..n`, `arch_intro`, `diagram_alt`, `dg_<etiqueta>` (textos dentro del SVG), `step1..n`, `caption`,
  `stack1_label`/`stack1`…, `result1..n`, `learned`, `link1..n`.
- Siempre en `src/i18n/es.json` y `src/i18n/en.json`, insertadas justo después del bloque de la ficha anterior
  (el orden de las fichas es el de las tarjetas). Las cifras también son claves: `1 283` en ES, `1,283` en EN.
- `data-i18n` solo en elementos hoja (sin hijos); en SVG, solo en `<text>` sin `<tspan>`. Las etiquetas técnicas
  que no cambian con el idioma (`opencode`, `Tier 2`, `X.509`) van escritas tal cual.
- No hace falta tocar `tools/sync-html-i18n.py`: ya excluye `projects.detail.*` y `projects.*.detail.*`.
- 250-400 palabras por idioma, concretas. Nada de cifras ni atribuciones que no estén comprobadas.

## Diagramas (SVG inline)

Mismo estilo que `src/partials/simpl-graph.svg` y `autoencoder.svg`, con las clases de `site.css` (capa `play`,
bloque `[css:project]`) en vez de colores sueltos:

- `<svg class="dg pdoc__diagram pdoc__diagram--wide" viewBox="0 0 880 H" width="880" height="H" role="img" aria-label="…" data-i18n-attr="aria-label:projects.<id>.detail.diagram_alt" focusable="false">`.
  Ancho 880 para escritorio; la versión `--tall` (panel por debajo de 860 px: tablet y móvil) con `viewBox` de
  ~360-380 de ancho. Con esos anchos el texto sale a ~12-13 px reales en las dos.
- Contenedores `.dg-frame` (ventana/agente), `.dg-pane` (panel interior), cajas `.dg-box` (`--soft`, `--accent`
  para la pieza que importa), relleno de acento `.dg-fill-accent` con texto `.dg-on-accent`, pastillas `.dg-pill`,
  reglas `.dg-rule`, barras de «texto» `.dg-bar` (`--faint`, `--strong`, `--ink`), puntos `.dg-dot`, subrayado
  ámbar `.dg-mark` (solo Faro).
- Texto: por defecto 13 px `--body`; `.dg-title` (15, `--ink`), `.dg-strong`, `.dg-sub` (12, `--mute`), `.dg-tiny`
  (11), `.dg-accent`; alineación `.dg-mid` / `.dg-end`.
- Flechas: `.dg-line` (`--dash`, `--faint`, `--accent`) con `marker-end`/`marker-start`. Cada SVG define sus
  `<marker>` con ids **con el prefijo del proyecto y de la variante** (`<id>-w-arrow`, `<id>-t-arrow-accent`…):
  las dos variantes están en el DOM a la vez.
- Pasos numerados: `<g class="dg-badge"><circle r="10"/><text>1</text></g>`, los mismos números que `.pdoc__steps`.
- Nada enfocable ni animado dentro de los diagramas.

## Cómo se prueba

- `npm test`: `test/projects.test.mjs` comprueba cada ficha (raíz `.pdoc` con su `data-project`, un único
  `#pdialog-title`, botón Volver, claves en ES y EN, `data-i18n` en hojas, iconos del sprite, ids con prefijo y
  `url(#…)` resueltas, SVG no enfocables, enlaces externos con `rel="noopener noreferrer"`).
- `python tools/sync-html-i18n.py --check` (no debe listar ninguna clave `detail`).
- Capturas: `node tools/cdp-shot.mjs tools/shots/projects.json` con el servidor en `http://localhost:5173`. Para
  una ficha nueva, copia los jobs de `faro` cambiando el id: `?shot=proyectos&project=<id>` a 1280×800, 1440×900 y
  390×844 (`"mobile": true`), arriba y con `document.querySelector('.pdialog__body').scrollTop` en el diagrama.
  Mira las capturas: el diagrama ancho no debe verse en móvil ni el alto en escritorio, y ningún texto del SVG
  debe salirse de su caja en ninguno de los dos idiomas.
- A mano: `/#proyecto/<id>` abre la ficha al cargar; la cruz, Escape, clic fuera del panel, «Volver» y el botón
  atrás del navegador la cierran y devuelven el foco a su botón «Más detalles».

## Aviso

Una clase de texto (`dg-sub`, `dg-mid`, …) puesta en un `<g>` que envuelve un `<text>` no hace efecto: `.dg text` fija color y tamaño en el propio `<text>`, así que la clase va siempre en el `<text>`.
