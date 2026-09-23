# portafolios.mtcor.es

Portafolio de **Marco Tenorio Cortés** (Software Engineer · Technical Analyst). Sitio estático de una página, bilingüe ES/EN, con tema oscuro y azul inspirado en Raycast y Apple, ilustraciones propias y el rig interactivo del café.

**En producción:** <https://portafolios.mtcor.es>

## Stack

- [Vite 8](https://vite.dev) como servidor de desarrollo y empaquetador. Sin framework: HTML semántico, CSS moderno (`@layer`, custom properties, `clamp()`, container-free) y JavaScript en módulos ES.
- Tipografía Inter Variable auto-alojada (subset latino, ~64 KB) con fallback métrico.
- Iconos de tecnologías desde [simple-icons](https://simpleicons.org) en un sprite SVG generado.
- Sin analítica, sin cookies, sin dependencias externas en runtime.
- Una **zona de juego** (rotulador para dibujar, perro con hueso y caseta, lámpara de cuerda en el hero, lámpara de lava) cargada tras `load`, con alternativa de teclado y `prefers-reduced-motion`.
- **Fichas de proyecto**: cada tarjeta abre una subpágina (`<dialog>`) con scroll propio, cifras y diagramas, cargada bajo demanda y enlazable (`#proyecto/<id>`).

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # genera dist/
npm run preview    # sirve dist/ en http://localhost:4173
npm test           # node:test sobre los módulos puros y la integridad de i18n, partials y sprite
```

Durante el desarrollo, `?shot=<id-de-seccion>` fuerza todos los reveals y hace scroll a esa sección; `&rig=<estado>` fija la pose del café (`warned`, `angry`, `spilled`); `&dog=shown|alert|running|entering|playing|peek-left|peek-right|hidden`, `&bone=near|dropped`, `&marker=grabbed` e `&ink=demo` (con `&inkn=<n>` trazos) fuerzan los estados de la zona de juego; `&lamp=on` enciende la lámpara del hero y `&project=<id>` abre una ficha de proyecto. Solo existe en `npm run dev`.

Las capturas de verificación se generan con `node tools/cdp-shot.mjs tools/shots/<suite>.json` (con `npm run dev` levantado) y quedan en `tools/out/shots/`. Con `CDP_PORT=9335` se puede lanzar una segunda suite en paralelo sin compartir el Chrome headless. Suites: `play.json` (rotulador y perro), `lamp.json` (lámpara del hero), `lava.json`, `projects.json` (sistema de fichas y rendimiento del scroll), `paper.json`, `fichas-a.json` y `fichas-b.json` (contenido de las fichas), `nav.json`, `layout.json` y `hero-mobile.json` (medidas de maquetación).

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
src/js/projects.js         fichas de proyecto en un <dialog>: apertura desde las tarjetas, hash, cierre por cruz/fondo/Escape/atrás
src/js/play/               lógica pura (geom, ink, dog-machine), probada en test/
src/styles/site.css        capas tokens · base · components · sections · rig · motion · print
src/styles/stars.css       generado (tools/stars.py)
src/assets/img/            WebP generados (rig, banco, hero, proyectos); src/assets/fonts/ Inter
src/partials/*.svg         SVG (grafo SIMPL, autoencoder, terminal, farola, mock de Faro, hoja del paper, rotulador, hueso, caseta, perro, escritorio, lámpara de lava)
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
- **Perro asomado** (`#dog-peek`): capa fija que se asoma por un lateral (un 70 % del cuerpo) cada 6-14 s (contando desde que se esconde) y se queda 8-12 s, si la pestaña está visible, no hay arrastre ni rotulador cogido ni menú abierto, el visitante lleva 2,5 s sin tocar nada y el perro del patio no está a la vista (ni asomado junto al hueso ni jugando en la puerta: solo hay un perro). Si el ratón se le acerca a menos de 90 px se esconde; con el dedo, tocarlo es un «boop». Nunca se coloca sobre elementos interactivos: comprueba la nav, el rig, el toast, el hueso, el rotulador y una rejilla 3×5 con `elementsFromPoint`.
- Todo se apaga quitando tokens de `<body data-play="marker dog">`.

## Lámpara, lámpara de lava y fichas de proyecto

- **Lámpara del hero** (`#hero-desk`, `src/js/lamp.js`, `src/partials/desk.svg`): bajo el medallón hay un escritorio a oscuras donde Marco, de espaldas, está programando a la luz del monitor (el código se escribe en bucle y las manos teclean); la lámpara de la mesa está apagada y su cadena se balancea para invitar a tirar. El botón real `#lamp-pull` cubre la cadena; al tirar (clic, toque o Enter) la cadena baja, se enciende el cono de luz y Marco hace una pausa: deja de teclear, gira la cabeza hacia la lámpara y coge la taza de café (coreografía encadenada: giro 400 ms, brazo 450 ms, taza 280 ms; un tirón a medias la revierte desde donde esté). Otro tirón apaga y vuelve a programar. Pista «Tira de la cuerda» una vez por sesión. Con `prefers-reduced-motion` las dos poses son estáticas y el cambio instantáneo. El espacio está reservado con `aspect-ratio` (cero CLS) y el SVG se estampa tras `load`.
- **Lámpara de lava** (`.skills__lava`, `src/partials/lava.svg`): ocupa las celdas vacías de la última fila de Habilidades. Burbujas de cera coral en un cristal marino con filtro «goo» (`feGaussianBlur` + `feColorMatrix`) aplicado solo al grupo de la cera; animaciones CSS de 14-28 s desincronizadas, pausadas fuera de pantalla y con la pestaña oculta; estática con `prefers-reduced-motion`. Decorativa (`aria-hidden`).
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

El paquete de GHCR debe ser público (GitHub → Packages → portafolios → Package settings → Change visibility) o, si se prefiere privado, hacer `docker login ghcr.io` en el servidor y descomentar el volumen de `config.json` en Watchtower. Prueba local: `docker build -t portafolios . && docker run --rm -p 8951:8080 portafolios`.

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
