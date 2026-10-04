# portafolios.mtcor.es

Portafolio de **Marco Tenorio Cortés** (Software Engineer · Technical Analyst). Sitio estático de una página, bilingüe ES/EN, con tema oscuro y azul inspirado en Raycast y Apple, ilustraciones propias y el rig interactivo del café.

**En producción:** <https://portafolios.mtcor.es>

## Stack

- [Vite 8](https://vite.dev) como servidor de desarrollo y empaquetador. Sin framework: HTML semántico, CSS moderno (`@layer`, custom properties, `clamp()`, container-free) y JavaScript en módulos ES.
- Tipografía Inter Variable auto-alojada (subset latino, ~64 KB) con fallback métrico.
- Iconos de tecnologías desde [simple-icons](https://simpleicons.org) en un sprite SVG generado.
- Sin analítica en el navegador (las visitas se cuentan en el log del servidor: ver [Registro de visitas](#registro-de-visitas)), sin cookies, sin dependencias externas en runtime.
- Una **zona de juego** (rotulador para dibujar, perro con hueso y caseta, luz azul que sigue al ratón y descubre objetos ocultos en el hero, lámpara de cuerda en el hero, lámpara de lava) cargada tras `load`, con alternativa de teclado y `prefers-reduced-motion`.
- **Fichas de proyecto**: cada tarjeta abre una subpágina (`<dialog>`) con scroll propio, cifras y diagramas, cargada bajo demanda y enlazable (`#proyecto/<id>`).

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # genera dist/
npm run preview    # sirve dist/ en http://localhost:4173
npm test           # node:test sobre los módulos puros y la integridad de i18n, partials, sprite, poses y gestos del escritorio, escenas de Experiencia, objetos ocultos del hero y Formación y capa de tinta del rotulador
```

Durante el desarrollo, `?shot=<id-de-seccion>` fuerza todos los reveals y hace scroll a esa sección; `&rig=<estado>` fija la pose del café (`warned`, `angry`, `spilled`); `&dog=shown|alert|running|entering|playing|peek-left|peek-right|hidden`, `&bone=near|dropped`, `&marker=grabbed` e `&ink=demo` (con `&inkn=<n>` trazos) fuerzan los estados de la zona de juego; `&lamp=on` enciende la lámpara del hero, `&pose=typing|turn|reach|hold|face` deja el escritorio en esa pose de la coreografía (sin transiciones; `typing` a oscuras, las demás con la lámpara encendida), `&gesture=wave|toast|wink|nod|tilt` (con `&pose=face`) hace que Marco haga ese gesto nada más cargar, `&glow=<x>,<y>` enciende la luz del ratón en ese punto (px de cliente, sin cola; con ella, la lente de los objetos ocultos del hero), `&exp=minsait|ntt|dynos` enciende esa escena de Experiencia, `&edu=uni|certs` la de Formación y `&project=<id>` abre una ficha de proyecto. Solo existe en `npm run dev`.

Las capturas de verificación se generan con `node tools/cdp-shot.mjs tools/shots/<suite>.json` (con `npm run dev` levantado) y quedan en `tools/out/shots/`. Con `CDP_PORT=9335` se puede lanzar una segunda suite en paralelo sin compartir el Chrome headless. Suites: `play.json` (rotulador y perro; `peek-first-10s`, `peek-first-10s-mobile`, `peek-first-dialog`, `peek-cadence` y `peek-first-reduced` miden los tiempos del perro asomado y tardan de 12 a 55 s cada uno), `glow.json` (luz del ratón; `glow-edge-hero` y `glow-edge-exp` la dejan sobre los fondos `.tile--black` y `.tile--2` a escala 2 para revisar el borde del disco), `secret.json` (objetos ocultos del hero: `secret-lens` y `secret-scroll` comprueban que la lente y el dibujo de dentro suman cero —el dibujo queda quieto en el hero mientras la lente sigue a la luz, también tras un scroll—, `secret-hint-face` y `secret-hint-off` la pista, `secret-perf` cuenta los frames de más de 20 ms al mover la luz, `secret-layout-<ancho>` vuelca las posiciones y los solapes con el texto, y `secret-obj-<objeto>-<ancho>` deja la luz sobre cada dibujo a escala 2 para revisarlo), `experience.json` (escenas de Experiencia: hover, cambio rápido, salida, scroll en táctil, reduced motion, CLS y rendimiento del scroll), `education.json` (escenas de Formación: las dos escenas a 1280 y 1920 —`edu-certs-1280` vuelca además `cardBottomInScene`, el borde inferior de la tarjeta de certificaciones en unidades de la escena—, la tarjeta translúcida, hover, salida, táctil, reduced motion, CLS y rendimiento del scroll), `lamp.json` (lámpara del hero; `lamp-turn-scrub-<ancho>-<ángulo>` fija `--desk-turn` en un ángulo del giro —0, 30, 57, 78, 90, 123, 140, 152 y 180 a 1280; 57, 90 y 123 a 390— para revisar cada fotograma y vuelca la opacidad de cada dibujo, `lamp-turn-perf-*` cuenta los frames de más de 20 ms durante el giro y `lamp-fallback` lo repite sin rig, con las piezas cruzándose por tiempo; `lamp-gesture-<gesto>` fuerza cada gesto de frente y vuelca su animación a mitad, `lamp-gesture-sheet-<gesto>-<20|40|60|80>` congela ese fotograma a escala 2 para montar hojas de contactos, `lamp-gesture-cycle` deja actuar al planificador 24 s tras el clic —al menos dos gestos, sin repetir, con huecos de 6-10 s—, `lamp-gesture-off` apaga a mitad del brindis y `lamp-gesture-reduced` y `lamp-gesture-dialog` comprueban que no hay gestos con movimiento reducido y que se pausan con una ficha abierta), `lava.json`, `projects.json` (sistema de fichas y rendimiento del scroll), `paper.json`, `fichas-a.json` y `fichas-b.json` (contenido de las fichas), `nav.json`, `layout.json` y `hero-mobile.json` (medidas de maquetación; en `layout.json`, `layout-gap-resize`, `layout-gap-zoom` y `layout-gap-dialog` ensanchan la ventana, quitan el zoom o cierran una ficha y comprueban que no queda hueco al pie: `gap` debe ser 0). Pasos de cada job: `viewport` (`{ width, height, mobile, scale }`: cambia la ventana a mitad de job sin recargar, para simular un redimensionado o un cambio de zoom), `click` y `hover` (selector: clic real o solo mover el ratón a su centro), `key`, `eval` (con `print` para volcar el resultado) y `wait`. Chrome headless no declara ratón (`(hover: none)` también en escritorio, sin puntos táctiles); en los jobs con `mobile` sí hay puntos táctiles.

## Estructura

```
index.html                 página completa (contenido por defecto en ES)
public/                    ficheros copiados tal cual a dist/: favicons, og.png, manifest, robots, 404, sprite, cv/
src/js/main.js             entrada: CSS + i18n + site + rig
src/js/i18n.js             diccionarios planos (src/i18n/es.json, en.json), data-i18n / data-i18n-attr
src/js/site.js             nav, menú móvil, scroll-spy, reveals, copiar email, footer
src/js/rig.js              máquina de estados del café (idle → warned → angry → spilled → refilling)
src/js/drag.js             arrastre con Pointer Events y captura, compartido por rotulador y hueso
src/js/marker.js           el rotulador: un clic lo coge, se pinta manteniendo pulsado y se suelta con clic derecho (tinta solo en memoria)
src/js/dog.js              la caseta y el hueso al pie de Contacto, el perro que se asoma al acercarte al hueso, y el perro de los bordes
src/js/lamp.js             la lámpara de escritorio del hero: tirar de la cadena enciende la escena
src/js/glow.js             la luz del ratón: foco azul tenue que sigue al puntero (capa fija creada en el primer movimiento de ratón)
src/js/secret.js           objetos ocultos del hero: una lente que sigue a la luz del ratón y deja ver los dibujos de debajo
src/js/projects.js         fichas de proyecto en un <dialog>: apertura desde las tarjetas, hash, cierre por cruz/fondo/Escape/atrás
src/js/experience.js       escenas detrás de una sección (initScenes) para Experiencia y Formación: la entrada bajo el ratón (o, en táctil, la del centro de la pantalla) enciende su escena
src/js/play/               lógica pura (geom, ink, dog-machine, glow-follow), probada en test/
src/styles/site.css        capas tokens · base · components · sections · rig · play · motion · print
src/styles/stars.css       generado (tools/stars.py)
src/assets/img/            WebP generados (rig, banco, hero, proyectos); src/assets/fonts/ Inter
src/partials/*.svg         SVG (grafo SIMPL, autoencoder, terminal, farola, mock de Faro, hoja del paper, rotulador, hueso, caseta, perro, escritorio, lámpara de lava, escenas de Experiencia exp-* y de Formación edu-*, objetos ocultos del hero secret-*)
src/partials/projects/     una ficha HTML por proyecto (faro, simpl, paper, qa, tfg, cinema, nakoa, telegram, tareas) con sus diagramas; README con la plantilla
src/partials/lazy.html     plantillas con esos SVG: main.js las estampa tras load en los [data-lazy] (el HTML inicial queda ligero)
test/                      node:test (npm test)
design/STYLE.md            guía de estilo de las ilustraciones
design/source/             originales de las ilustraciones (no se despliegan)
tools/                     scripts de generación y despliegue
```

## Regenerar assets

Los ficheros generados están commiteados; solo hay que regenerarlos si cambian los originales.

```bash
pip install -r tools/requirements.txt
python tools/images.py        # rig (+ tools/rig-geometry.json), banco, hero, proyectos
python tools/stars.py         # src/styles/stars.css
python tools/og.py            # public/og.png
node tools/sprite.mjs         # public/icons/sprite.svg (falla si un slug no existe)
node tools/brand.mjs          # favicons a partir de public/favicon.svg
python tools/inject-partials.py   # vuelve a inyectar src/partials/*.svg en index.html
python tools/sync-html-i18n.py    # sincroniza el texto ES del HTML con src/i18n/es.json y valida claves
python tools/check-rig.py     # hoja de comprobación visual del rig (tools/out/rig-check.png)
```

La fuente se regenera con `tools/subset-font.ps1 -Source InterVariable.woff2` (descarga de <https://github.com/rsms/inter/releases>).

### Rig del café

Un único `<svg viewBox="0 0 1000 1100">` con las capas PNG originales colocadas según `tools/rig-geometry.json` (medido por registro de imagen contra el dibujo completo). Las poses son función de `data-state` (custom properties en CSS); los efectos puntuales (caída, rebote, charco, recarga) usan Web Animations API y encadenan por `animation.finished`. El botón real `#rig-hit` cubre el vaso (teclado y táctil), el texto de estado se anuncia por `aria-live`, y con `prefers-reduced-motion` las poses cambian sin animar. Si alguna capa falla al cargar se muestra `fallback.webp`.

## Zona de juego

- **Rotulador** (`#marker`, `src/js/marker.js`): tirado al final de Proyectos. Un clic lo coge (sigue al puntero como si fuera el cursor y aparece un aviso breve con las instrucciones), se pinta manteniendo pulsado el botón principal y se suelta con clic derecho o Escape (en táctil: arrastrar pinta, un toque suelta). Dibuja en una capa SVG a nivel de documento (`#ink`, `pointer-events: none`) y se queda donde se suelta. La tinta es relativa a la sección donde empezó cada trazo y se re-ancla con un `ResizeObserver`, así que aguanta cambios de idioma y de ancho. No se guarda: al recargar desaparece. Topes: 40 trazos y 20 000 puntos; el trazo más antiguo se desvanece. Es decorativo (`aria-hidden`), sin ruta de teclado.
- **Caseta, hueso y perro** (`#yard`, `src/js/dog.js`): una franja a sangre al pie de Contacto, sin marco: la caseta (espejada, con la puerta hacia el patio) a la derecha y el hueso suelto en el suelo. Cuando el ratón se acerca al hueso (140 px, con histéresis hasta 260) el perro se asoma por el borde izquierdo de la pantalla a la altura de la caseta; al pulsar el hueso alza las orejas; si el hueso se deja en la puerta (`isInDoor`), corre hasta la caseta, entra y vuelve a asomarse por la puerta con el hueso en la boca, mordisqueándolo unos 9-12 s, antes de meterse dentro; después aparece un hueso nuevo. Cerca de la puerta pero fuera, la caseta «huele» el hueso (ojos y temblor). El hueso es un `<button>` arrastrable; Enter/Espacio sobre él es la alternativa de teclado (vuela a la puerta). Estado en `#dog-status` (`aria-live`, oculto visualmente), contador de huesos en `localStorage` (`play.bones`) encima del tejado. Con `prefers-reduced-motion` no hay carreras: el hueso se desvanece y la caseta se oscurece.
- **Perro asomado** (`#dog-peek`): capa fija que se asoma por un lateral (un 70 % del cuerpo) la primera vez a los 10 s de ver la página (aunque estés moviendo el ratón o haciendo scroll; si la pestaña se abrió en segundo plano, a los 10 s de verla) y después cada 3-7 s (contando desde que se esconde), quedándose 8-12 s, si la pestaña está visible, no hay arrastre ni rotulador cogido ni menú ni ficha abiertos, el visitante lleva 2,5 s sin tocar nada (esto no se exige la primera vez; si no se cumple, lo reintenta cada 1,5-3 s) y el perro del patio no está a la vista (ni asomado junto al hueso ni jugando en la puerta: solo hay un perro; si juegas con el hueso antes de los 10 s, manda el del patio y el de los bordes se reprograma). Con `prefers-reduced-motion` no sale. Los tiempos son constantes de `src/js/play/dog-machine.js` (`FIRST_PEEK_AT`, `PEEK_GAP`, `PEEK_HOLD`, `PEEK_RETRY`, `PEEK_IDLE`) con sus tests. Si el ratón se le acerca a menos de 90 px se esconde; con el dedo, tocarlo es un «boop». Nunca se coloca sobre elementos interactivos: comprueba la nav, el rig, el toast, el hueso, el rotulador y una rejilla 3×5 con `elementsFromPoint`.
- **Luz del ratón** (`src/js/glow.js`, `.cursor-glow`): el foco azul del sitio antiguo, recuperado. Un disco de 400 px (`--cursor-glow-size`) con un degradado radial del azul de acción (token `--cursor-glow`, 0.18 en el núcleo) sigue al puntero con una cola suave de 70 ms (suavizado exponencial independiente del framerate, `src/js/play/glow-follow.js`). El degradado cae de forma gaussiana y llega a cero con pendiente nula, así que se difumina hasta ser transparente a 200 px del puntero sin anillo ni contorno. Va por encima de las secciones y por debajo de la tinta, el rotulador, el perro asomado, el menú, la nav y el toast (`z-index: 30`), sin `mix-blend-mode` ni `filter`: solo se mueve con `translate3d` en un rAF que se para al llegar, así que no repinta. La capa se crea en el primer movimiento de ratón (en táctil nunca existe); se apaga al salir de la ventana, con `blur`, con la pestaña oculta y con el menú o una ficha abiertos, y renace bajo el puntero al volver. Con `prefers-reduced-motion` va pegada al puntero, sin fundidos. Decorativa (`aria-hidden`); no sale al imprimir ni con `forced-colors`. Para atenuarla basta con bajar `--cursor-glow` (las ocho paradas del degradado salen de él con `color-mix`).
- **Objetos ocultos** (`.hero__secret`, `src/js/secret.js`, `src/partials/secret-rack.svg`, `secret-shelf.svg`, `secret-window.svg`, `secret-board.svg`): en el hero, sobre el fondo casi negro, hay cosas dibujadas que solo se ven bajo la luz del ratón: el rack del homelab con sus LEDs y el perro dormido en su cesta (en el suelo, pegados al escritorio), una estantería con libros, el gato gris dormido con la cola colgando, la planta y el patito de goma (encima del rack), la ventana con la luna y la Giralda (arriba, sobre el texto; su alto se ajusta al hueco) y un corcho con fotos (el perro, la farola del banco, el busto), el póster del grafo de SIMPL y una nota amarilla (a la derecha del medallón: hasta unos 1600 px asoma por detrás del disco; más ancho, entero en el margen). Una lente circular del tamaño de la luz (`--cursor-glow-size`) sigue al foco (evento `mtc:glow` de `glow.js`) y dentro el dibujo del hero entero se contra-traslada: solo cambian dos `transform` (compositor), sin `filter` ni `mix-blend-mode`, y la lente no se despega de la luz al hacer scroll con el ratón quieto; se apaga con la luz (nunca por inactividad) y con una ficha o el menú abiertos. Cuando la lámpara está encendida y Marco se ha girado hacia ti (pose `face`), el rack con el perro aparece muy tenue (opacidad 0,16) como pista para acercar el ratón. Las posiciones se anclan al escritorio con `calc()` (reproducen las columnas del hero; `secret.js` escribe el tamaño del hero y el hueco sobre el texto con un `ResizeObserver`) y no pisan el texto, los botones ni el medallón a ningún ancho: entre 768 y 1079 px solo quedan la ventana y, desde 960, el rack. No existe sin JS, sin el token `glow`, en táctil (no hay luz), por debajo de 768 px, al imprimir ni con `forced-colors`; con `prefers-reduced-motion`, sin fundidos y con los LEDs quietos. Decorativos (`aria-hidden`); los SVG se estampan desde `lazy.html` tras `load`.
- Todo se apaga quitando tokens de `<body data-play="marker dog glow">`.

## Lámpara, lámpara de lava y fichas de proyecto

- **Lámpara del hero** (`#hero-desk`, `src/js/lamp.js`, `src/partials/desk.svg`): bajo el medallón hay un escritorio a oscuras donde Marco, de espaldas, está programando a la luz del monitor (el código se escribe en bucle y las manos teclean); la lámpara de la mesa está apagada y su cadena se balancea para invitar a tirar. El botón real `#lamp-pull` cubre la cadena; al tirar (clic, toque o Enter) la cadena baja, se enciende el cono de luz y Marco hace una pausa: deja de teclear, gira la cabeza hacia la lámpara, coge la taza de café, la levanta y gira con la silla hacia ti: el respaldo barre y se pone de canto, la taza cruza por delante del pecho, la cabeza llega un poco antes que el cuerpo (de espaldas, en perfil perdido, de tres cuartos y de frente) y, ya de frente, te mira y parpadea de vez en cuando (coreografía encadenada: cabeza 400 ms, brazo 450 ms, taza 280 ms y giro de 40 + 960 ms, con la vuelta en 700 ms; rig 2.5D por ángulo: cada pieza deriva su posición y su dibujo de la variable `--desk-turn`; en navegadores sin `@property`/`linear()`/`sin()` las piezas se cruzan por tiempo; un tirón a medias la revierte desde donde esté). Ya de frente, cada 6-10 s hace un gesto al azar sin repetir el anterior: te saluda con la mano izquierda, brinda con la taza y da un sorbo con los ojos cerrados, te guiña un ojo con una sonrisa más ancha, asiente o ladea la cabeza (`@keyframes` CSS sobre envolventes `.desk__gest` anidados en el rig y activadas por `data-gesture`, que no frenan la coreografía; el planificador es `src/js/play/gesture-machine.js`); se detienen al apagar y se pausan fuera de pantalla, con la pestaña oculta o con una ficha abierta. Otro tirón apaga y deshace la pausa en orden inverso hasta volver a programar. Pista «Tira de la cuerda» una vez por sesión. Con `prefers-reduced-motion` las dos poses son estáticas (de espaldas programando a oscuras; de frente con la taza, sin parpadeo ni gestos, con la lámpara) y el cambio instantáneo. El espacio está reservado con `aspect-ratio` (cero CLS) y el SVG se estampa tras `load`.
- **Lámpara de lava** (`.skills__lava`, `src/partials/lava.svg`): ocupa las celdas vacías de la última fila de Habilidades. Burbujas de cera coral en un cristal marino con filtro «goo» (`feGaussianBlur` + `feColorMatrix`) aplicado solo al grupo de la cera; animaciones CSS de 14-28 s desincronizadas, pausadas fuera de pantalla y con la pestaña oculta; estática con `prefers-reduced-motion`. Decorativa (`aria-hidden`).
- **Escenas de Experiencia** (`#exp-bg`, `src/js/experience.js`, `src/partials/exp-minsait.svg`, `exp-ntt.svg`, `exp-dynos.svg`): detrás de toda la sección Experiencia, al pasar el ratón por una entrada aparece una escena dibujada en código con Marco en ese trabajo: ante una pizarra de cristal con un diagrama de APIs (Minsait), tecleando ante dos monitores con la lista de pruebas en verde y el móvil en su soporte (NTT DATA) y agachado conectando un latiguillo en un rack (Dynos). La escena entra con un fundido de 520 ms (la anterior sale en 200 ms) y una deriva lenta (16 s, solo encendida); un velo pintado una vez la oscurece bajo la columna de fechas y el texto; el punto de la línea temporal crece con un anillo azul y el nombre de la empresa se aclara. Al salir de la lista se apaga a los 260 ms (los huecos entre entradas no cuentan). En táctil la enciende la entrada que cruza el centro de la pantalla al hacer scroll, al 60 %. El escenario es pegajoso y mide lo que se ve de la sección, así la escena queda entera en pantalla mientras se lee; el SVG recorta por la izquierda (`xMaxYMid slice`) para que Marco quede siempre a la derecha. Se apaga al salir la sección y al abrir una ficha; la deriva se pausa fuera de pantalla y con la pestaña oculta. Sin JS, al imprimir y en reposo la sección queda como siempre; con `prefers-reduced-motion`, sin fundidos ni deriva. Los SVG se estampan desde `lazy.html` tras `load` (el HTML inicial solo lleva la capa vacía y los `data-exp`).
- **Escenas de Formación** (`#edu-bg`, el mismo módulo con `initEducation`, `src/partials/edu-uni.svg` y `edu-certs.svg`): el mismo sistema detrás de la sección Formación, con una escena por bloque. Al pasar el ratón por las titulaciones, la escena aparece a la izquierda del título: Marco camina con la mochila hacia la escuela (detrás, bajo el velo, el pórtico y, a lo lejos, la Giralda); va espejada (`xMinYMid slice`, `.scenes__scene--left`, con el velo y la deriva al revés), así que a 1920 queda en el margen junto al título y en portátiles detrás del arranque de la lista, como las de Experiencia. Por la tarjeta de certificaciones, la escena va detrás de la tarjeta: Marco, sentado ante el portátil con la lista de cursos marcada en verde, levanta un certificado enrollado con lazo rojo, con la taza y el birrete en la mesa y un diploma enmarcado en la pared. Como la tarjeta ocupa la columna derecha, donde va Marco en esa escena, mientras hay escena se vuelve translúcida (320 ms; `--certs-veil`, 0,62 por defecto, es el mando de la legibilidad de la tabla), los títulos de la lista y los textos pequeños llevan el halo del color de su fondo, la pastilla del máster se vuelve opaca (sin cambiar de color) y el bloque activo se marca en azul (las teclas de los años o el borde de la tarjeta). Velo del color de la sección (`--scene-veil`), mismas salidas, táctil, pausas, impresión y reduced motion que en Experiencia.
- **Fichas de proyecto** (`#project-dialog`, `src/js/projects.js`, `src/partials/projects/*.html`): cada tarjeta (`data-project`) abre con «Más detalles» o con un clic en la propia tarjeta (los enlaces internos no abren) una subpágina en un `<dialog>` modal con cabecera tipo ventana, cuerpo con scroll propio, cifras, secciones numeradas y diagramas SVG (con versión vertical para paneles estrechos). Se cierra con la cruz, «Volver», Escape, clic fuera del panel o el botón atrás; el foco vuelve a la tarjeta. La URL lleva `#proyecto/<id>` mientras está abierta y abre la ficha al cargar. Los fragmentos se importan bajo demanda (`import.meta.glob`) y se traducen al insertarlos (`i18n.translate(root)`). `test/projects.test.mjs` comprueba claves, iconos, ids y accesibilidad de cada ficha. Rendimiento del scroll: el velo no usa `backdrop-filter` (viñeta oscura pintada una vez), el cuerpo con scroll tiene fondo opaco para que Chrome lo componga también con escala 1,25, y con la ficha abierta se pausan las animaciones CSS de la página y se esconde el perro asomado (`html.dialog-open`); el job `pdialog-scroll-perf` mide los frames durante el scroll.
- **Paper de CAEPIA 2026** (`data-project="paper"`, `src/partials/paper-sheet.svg`): tercera tarjeta destacada con el título, los autores, la sesión y el enlace al programa; la ficha solo tiene Contexto y Publicación porque el artículo está en prensa.

## Contenido

- Textos: `src/i18n/es.json` y `src/i18n/en.json` (mismas claves). Tras editar `es.json`, ejecuta `python tools/sync-html-i18n.py` para que el HTML sin JavaScript muestre el mismo texto.
- CV: coloca `public/cv/marco-tenorio-cortes-es.pdf` y `-en.pdf` y cambia `hero.cv_href` en ambos diccionarios a `/cv/marco-tenorio-cortes-es.pdf` / `-en.pdf`. Si la ruta es local, el botón pasa a "Descargar CV" con `download`; si es externa (Drive), abre en pestaña nueva.
- Las claves que solo usa el JavaScript (estados del perro, contador, toast, `hero.lamp.off`) y las de las fichas (`projects.detail.*`, `projects.<id>.detail.*`, que viven en `src/partials/projects/`) van en las exclusiones de `tools/sync-html-i18n.py` para que no las liste como «no usadas».
- Caducidades: `education.master.note` / `education.master.period` (máster hasta dic. 2026), `experience.minsait.period` / `experience.minsait.badge` (actualidad) y las cifras de Faro (`projects.faro.facts` y `projects.faro.detail.*`: hoy reflejan el último hito commiteado, H13, con 1 283 pruebas; al commitear H14 pasan a 14 hitos y 1 315 pruebas). También el JSON-LD de `index.html`.

## Despliegue

### En Docker, automático desde GitHub (servidor Ubuntu ARM)

- `.github/workflows/deploy.yml`: en cada push a `main` pasa los tests, construye el sitio y publica la imagen `ghcr.io/marcotencortes/portafolios:latest` (y `sha-<commit>`) para `linux/arm64` y `linux/amd64`. La etapa de build del `Dockerfile` corre en la plataforma del runner (`--platform=$BUILDPLATFORM`), así que no se emula Node; solo la imagen final de nginx es multiarquitectura. Se puede lanzar a mano desde otra rama (etiqueta con el nombre de la rama, sin tocar `latest`).
- `Dockerfile` + `deploy/nginx.conf`: nginx sin privilegios en el puerto 8080 sirviendo `dist/` con gzip, `Cache-Control` inmutable para `/assets/` y `no-cache` para el HTML, `404.html` y cabeceras de seguridad básicas. `HEALTHCHECK` incluido.
- `deploy/docker-compose.yml`: lo que corre en el servidor: el sitio en el puerto **8951** con `restart: always` y Watchtower, que cada 5 minutos comprueba GHCR y reinicia el contenedor con la imagen nueva (solo los contenedores etiquetados). No hace falta abrir puertos ni dar acceso SSH a GitHub.

En el servidor (una vez):

```bash
curl -fsSL https://get.docker.com | sh && sudo usermod -aG docker $USER
```

```bash
mkdir -p /opt/portafolios && cd /opt/portafolios && curl -fsSLO https://raw.githubusercontent.com/MarcoTenCortes/portafolios/main/deploy/docker-compose.yml && docker compose up -d
```

Watchtower lleva un cliente Docker antiguo: el compose fija `DOCKER_API_VERSION=1.44` para que funcione con Docker Engine 29+ (si no, registra «client version 1.25 is too old» y nunca actualiza). El paquete de GHCR debe ser público (GitHub → Packages → portafolios → Package settings → Change visibility) o, si se prefiere privado, hacer `docker login ghcr.io` en el servidor y descomentar el volumen de `config.json` en Watchtower. Prueba local: `docker build -t portafolios . && docker run --rm -p 8951:8080 portafolios`.

### Registro de visitas

Delante del contenedor hay un nginx en el propio servidor: el proxy inverso con TLS de `portafolios.mtcor.es` hacia el puerto 8951. Las visitas se registran **ahí y no en el contenedor**: es quien ve la IP real del visitante (el contenedor solo ve la del proxy), sus logs ya los rota `logrotate` y no se pierden cuando Watchtower cambia la imagen, y GoAccess los lee en el propio servidor sin exponer nada. El contenedor (`Dockerfile`, `deploy/nginx.conf`, `deploy/docker-compose.yml`) no cambia y sigue mandando sus logs a stdout.

- `deploy/host-nginx/portafolios-visitas.conf` (va en `/etc/nginx/conf.d/`): el formato `portafolios_visitas` (combined + `Accept-Language`) y la variable `$portafolios_registrar`, que vale 1 solo en las **vistas de página**: `GET` de `/` o `/index.html` (con o sin query) hecho por un navegador.
- `deploy/host-nginx/portafolios.vhost.example`: el `server {}` del proxy como referencia; del vhost real solo se tocan las líneas `access_log` (y las cabeceras `proxy_set_header`, si faltan).
- `deploy/visitas-informe.sh`: el informe HTML de GoAccess con el log actual y los rotados, o el mismo informe en tiempo real.

**Qué se guarda** de cada visita: fecha y hora, IP, petición (con su query, p. ej. `?utm_source=…`), estado, bytes, referer, user-agent e idioma del navegador. **Qué no**: assets, favicon, `robots.txt`, `sitemap.xml`, páginas 404, peticiones `HEAD` o `POST`, el healthcheck de Docker (va directo al contenedor) y los bots conocidos (buscadores, previsualizaciones de enlaces de LinkedIn, WhatsApp, Telegram o Slack, monitores, `curl`, navegadores headless, user-agent vacío). Las fichas (`#proyecto/<id>`) y el cambio de idioma no llegan al servidor: una visita es una carga de la página.

En el servidor (una vez; los ficheros se bajan de `main`):

```bash
sudo apt install -y goaccess
sudo curl -fsSL -o /etc/nginx/conf.d/portafolios-visitas.conf https://raw.githubusercontent.com/MarcoTenCortes/portafolios/main/deploy/host-nginx/portafolios-visitas.conf
cd /opt/portafolios && curl -fsSLO https://raw.githubusercontent.com/MarcoTenCortes/portafolios/main/deploy/visitas-informe.sh
```

En el vhost de `portafolios.mtcor.es` (p. ej. `/etc/nginx/sites-available/portafolios.mtcor.es`), dentro del `server {}` que escucha en 443 (a nivel de `server`, p. ej. tras `server_name`; no dentro del `location`):

```nginx
access_log /var/log/nginx/access.log;
access_log /var/log/nginx/portafolios.visitas.log portafolios_visitas if=$portafolios_registrar;
```

La primera línea conserva el log general: un `server {}` que declara su propio `access_log` deja de heredar el de `http` (si el vhost ya tenía uno, se deja ese y solo se añade la segunda). Si el `location /` declara `access_log`, la segunda línea va también ahí. Después (los `curl`, desde tu equipo o desde el servidor):

```bash
sudo nginx -t && sudo systemctl reload nginx
curl -s -o /dev/null -A 'Mozilla/5.0 (prueba)' https://portafolios.mtcor.es/             # cuenta como visita
curl -s -o /dev/null -A 'Mozilla/5.0 (prueba)' https://portafolios.mtcor.es/robots.txt   # no cuenta: no es la página
curl -s -o /dev/null https://portafolios.mtcor.es/                                       # no cuenta: curl es un bot
sudo grep -c 'Mozilla/5.0 (prueba)' /var/log/nginx/portafolios.visitas.log               # 1
sudo tail -n 1 /var/log/nginx/portafolios.visitas.log                                    # tu IP, "GET / ..." y "Mozilla/5.0 (prueba)"
```

Al abrir la web en el navegador aparece otra línea con tu IP y tu navegador, y ninguna de `/assets/…`. Para ver el informe:

```bash
sudo sh /opt/portafolios/visitas-informe.sh                    # en el servidor: escribe /opt/portafolios/informe-visitas.html
scp usuario@servidor:/opt/portafolios/informe-visitas.html .   # en tu equipo; se abre en el navegador
```

En tiempo real (el informe se actualiza solo con cada visita; Ctrl+C lo termina):

```bash
sudo sh /opt/portafolios/visitas-informe.sh --tiempo-real      # en el servidor: WebSocket solo en 127.0.0.1:7890
ssh -N -L 7890:127.0.0.1:7890 usuario@servidor                 # en tu equipo, en otra terminal: el túnel
scp usuario@servidor:/opt/portafolios/informe-visitas.html .   # ábrelo en local: se conecta a localhost:7890
```

- **Rotación**: el log entra en el `logrotate` de nginx (`/etc/logrotate.d/nginx` cubre `/var/log/nginx/*.log`): a diario y 14 copias comprimidas, así que el informe abarca unas dos semanas. Para conservar más, sube `rotate` en ese fichero (afecta a todos los logs de nginx); un fichero propio en `/etc/logrotate.d/` para este log no sirve: logrotate lo rechaza porque ya está cubierto («duplicate log entry»).
- **Países** (opcional): con la base gratuita GeoLite2 Country de MaxMind (requiere cuenta) en `/opt/portafolios/GeoLite2-Country.mmdb`, el script la usa sola y el informe muestra el país; en otra ruta, `sudo GEOIP=/ruta/base.mmdb sh /opt/portafolios/visitas-informe.sh`. Del mismo modo, `LOG`, `INFORME` y `PUERTO` cambian el log, el HTML y el puerto; van tras `sudo` (`sudo PUERTO=7891 sh …`) porque `sudo` no hereda las variables del entorno.
- **Bots**: nginx descarta los conocidos al escribir y GoAccess quita además los de su propia lista (`--ignore-crawlers`). La app de LinkedIn en iPhone se anuncia de forma que GoAccess la tomaría por un bot: el script la mantiene como navegador.
- **Puerto 8951**: `deploy/docker-compose.yml` publica `"8951:8080"` en todas las interfaces y Docker se salta ufw, así que una petición directa a `http://IP:8951` entra sin TLS y sin pasar por el registro. Si el proxy hace `proxy_pass` a `127.0.0.1` (como en el ejemplo), cambia esa línea en el compose del servidor (`/opt/portafolios/docker-compose.yml`) por `"127.0.0.1:8951:8080"` y aplícalo con `cd /opt/portafolios && docker compose up -d`.
- **Privacidad**: la IP completa es un dato personal (RGPD). Conviene decirlo en una línea en el pie de la web o en un aviso de privacidad (qué se guarda, para qué y cuánto tiempo) y no conservarla más de lo necesario; con la rotación por defecto desaparece en unas dos semanas. El informe HTML también lleva las IPs: no se publica, se copia con `scp`.

### A mano (scp/rsync)

`npm run build` genera `dist/` con los assets con hash. Se sube **el contenido de `dist/`** a la raíz del sitio:

```powershell
powershell -ExecutionPolicy Bypass -File tools/deploy.ps1 -Target usuario@servidor:/var/www/portafolios
```

o con rsync: `tools/deploy.example.sh usuario@servidor:/var/www/portafolios`. Añade `-DryRun` para listar sin subir.

Configuración recomendada del servidor:

**Apache** (`.htaccess` en la raíz):

```apache
AddType image/webp .webp
AddType font/woff2 .woff2
AddType application/manifest+json .webmanifest
ErrorDocument 404 /404.html
<FilesMatch "\.(js|css|webp|woff2|svg|png)$">
  Header set Cache-Control "public, max-age=31536000, immutable"
</FilesMatch>
<FilesMatch "\.(html|webmanifest|xml|txt)$">
  Header set Cache-Control "no-cache"
</FilesMatch>
```

**nginx**:

```nginx
location / { try_files $uri $uri/ =404; }
error_page 404 /404.html;
location /assets/ { add_header Cache-Control "public, max-age=31536000, immutable"; }
types { image/webp webp; font/woff2 woff2; application/manifest+json webmanifest; }
```

Los ficheros de `dist/assets/` llevan hash en el nombre, así que la caché larga es segura; `index.html` debe servirse sin caché.

## Licencias

Código propio. Inter © Rasmus Andersson, [SIL Open Font License](src/assets/fonts/OFL.txt). Iconos de simple-icons (CC0). Ilustraciones © Marco Tenorio Cortés.
