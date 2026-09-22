# portafolios.mtcor.es

Portafolio de **Marco Tenorio Cortés** (Software Engineer · Technical Analyst). Sitio estático de una página, bilingüe ES/EN, con tema oscuro y azul inspirado en Raycast y Apple, ilustraciones propias y el rig interactivo del café.

**En producción:** <https://portafolios.mtcor.es>

## Stack

- [Vite 8](https://vite.dev) como servidor de desarrollo y empaquetador. Sin framework: HTML semántico, CSS moderno (`@layer`, custom properties, `clamp()`, container-free) y JavaScript en módulos ES.
- Tipografía Inter Variable auto-alojada (subset latino, ~64 KB) con fallback métrico.
- Iconos de tecnologías desde [simple-icons](https://simpleicons.org) en un sprite SVG generado.
- Sin analítica, sin cookies, sin dependencias externas en runtime.
- Una **zona de juego** (rotulador para dibujar, perro con hueso y caseta) cargada tras `load`, con alternativa de teclado y `prefers-reduced-motion`.

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # genera dist/
npm run preview    # sirve dist/ en http://localhost:4173
npm test           # node:test sobre los módulos puros y la integridad de i18n, partials y sprite
```

Durante el desarrollo, `?shot=<id-de-seccion>` fuerza todos los reveals y hace scroll a esa sección; `&rig=<estado>` fija la pose del café (`warned`, `angry`, `spilled`); `&dog=fetching|carrying|peek-left|peek-right|hidden`, `&bone=near|dropped`, `&marker=grabbed` e `&ink=demo` (con `&inkn=<n>` trazos) fuerzan los estados de la zona de juego. Solo existe en `npm run dev`.

Las capturas de verificación se generan con `node tools/cdp-shot.mjs tools/shots/play.json` (con `npm run dev` levantado) y quedan en `tools/out/shots/`.

## Estructura

```
index.html                 página completa (contenido por defecto en ES)
public/                    ficheros copiados tal cual a dist/: favicons, og.png, manifest, robots, 404, sprite, cv/
src/js/main.js             entrada: CSS + i18n + site + rig
src/js/i18n.js             diccionarios planos (src/i18n/es.json, en.json), data-i18n / data-i18n-attr
src/js/site.js             nav, menú móvil, scroll-spy, reveals, copiar email, footer
src/js/rig.js              máquina de estados del café (idle → warned → angry → spilled → refilling)
src/js/drag.js             arrastre con Pointer Events y captura, compartido por rotulador y hueso
src/js/marker.js           el rotulador: dibuja al arrastrarlo y se suelta donde se deja (tinta solo en memoria)
src/js/dog.js              el patio (perro, hueso, caseta) y el perro que se asoma por los bordes
src/js/play/               lógica pura (geom, ink, dog-machine), probada en test/
src/styles/site.css        capas tokens · base · components · sections · rig · motion · print
src/styles/stars.css       generado (tools/stars.py)
src/assets/img/            WebP generados (rig, banco, hero, proyectos); src/assets/fonts/ Inter
src/partials/*.svg         SVG inline (grafo SIMPL, autoencoder, terminal, farola, mock de Faro, rotulador, hueso, caseta, perro) inyectados en index.html
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

- **Rotulador** (`#marker`, `src/js/marker.js`): tirado al final de Proyectos. Al arrastrarlo dibuja en una capa SVG a nivel de documento (`#ink`, `pointer-events: none`) y se queda donde se suelta. La tinta es relativa a la sección donde empezó cada trazo y se re-ancla con un `ResizeObserver`, así que aguanta cambios de idioma y de ancho. No se guarda: al recargar desaparece. Topes: 40 trazos y 20 000 puntos; el trazo más antiguo se desvanece. Es decorativo (`aria-hidden`), sin ruta de teclado.
- **Perro, hueso y caseta** (`#yard`, `src/js/dog.js`): tercera fila de Contacto, un solo SVG de 800×260 unidades. El hueso se arrastra con un handle HTML; si se suelta cerca de la puerta (felpudo en 270,217; radio 140) el perro sale, lo coge, vuelve y entra (la puerta va a ras de la jamba derecha y el perro se recorta con un `clipPath`, por eso nunca se ve partido). El botón «Darle el hueso» es la alternativa de teclado; el estado se anuncia en `#dog-status` (`aria-live`). Contador de huesos en `localStorage` (`play.bones`). Con `prefers-reduced-motion` no hay paseos: el hueso se desvanece y la caseta se oscurece.
- **Perro asomado** (`#dog-peek`): capa fija que se asoma por un lateral cada 18-40 s si la pestaña está visible, no hay arrastre ni menú abierto y el visitante lleva 2,5 s sin tocar nada. Nunca se coloca sobre elementos interactivos: comprueba la nav, el rig, el toast, el rotulador y una rejilla 3×5 con `elementsFromPoint`. Tocarlo muestra un aviso.
- Todo se apaga quitando tokens de `<body data-play="marker dog">`.

## Contenido

- Textos: `src/i18n/es.json` y `src/i18n/en.json` (mismas claves). Tras editar `es.json`, ejecuta `python tools/sync-html-i18n.py` para que el HTML sin JavaScript muestre el mismo texto.
- CV: coloca `public/cv/marco-tenorio-cortes-es.pdf` y `-en.pdf` y cambia `hero.cv_href` en ambos diccionarios a `/cv/marco-tenorio-cortes-es.pdf` / `-en.pdf`. Si la ruta es local, el botón pasa a "Descargar CV" con `download`; si es externa (Drive), abre en pestaña nueva.
- Las claves que solo usa el JavaScript (estados del perro, contador, toast) van en las exclusiones de `tools/sync-html-i18n.py` para que no las liste como «no usadas».
- Caducidades: `education.master.note` / `education.master.period` (máster hasta dic. 2026), `experience.minsait.period` / `experience.minsait.badge` (actualidad) y las cifras de Faro (`projects.faro.facts`). También el JSON-LD de `index.html`.

## Despliegue

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
