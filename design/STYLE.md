# Guía de estilo de las ilustraciones

Referencia: el personaje del café (`design/source/marcoCafenoBC.png`) y la escena del banco (`design/source/bancomarcoamp.png`). Los objetos nuevos de la zona de juego (rotulador, perro, hueso, caseta) siguen este estilo, no el del busto del hero (vector plano sin contornos).

## Paleta (medida sobre los originales)

| Uso | Hex | Token CSS |
|---|---|---|
| Tinta de contorno | `#151a24` | `--ill-ink` |
| Oscuro (jersey, cuerpo del rotulador) | `#23272d` (sombra `#0f131c`, luz `#2e3138`) | `--ill-dark` |
| Crema (banco, hueso, perro) | `#f3eedb` (sombra `#c7bfaf`, luz `#fbfaf1`) | `--ill-cream` |
| Madera / manchas | `#9c6840` | `--ill-wood` |
| Azul de acción (capuchón, punta, collar, tinta, luz de borde) | `#2997ff` | `--action` |
| Superficies de la caseta | `#1a2030` / `#131822` | `--tile-2` / `--tile-1` |

## Trazo y relleno

- Contorno de tinta fino e irregular: ~0,4 % del ancho del dibujo (4 u en un viewBox de 1 000, 3,5 u en uno de 200). Grosor variable en los trazos clave (4 → 6 → 8). `stroke-linejoin` y `stroke-linecap` redondos.
- Nada de rectas ni círculos perfectos: curvas con un ligero temblor, y una unión que no cierra del todo por objeto.
- Rellenos planos con tres tonos por material (base, sombra, luz) y la luz desde arriba; el relleno puede quedar 2-4 u fuera de registro respecto al contorno.
- Sombra en el suelo: elipse `#000` al 30-35 %.
- Sin `feTurbulence` ni `feDisplacementMap` en partes animadas.

## Luz de borde azul (rim)

Filtro `feMorphology dilate radius=3-4` + `feFlood #2997ff .6` + `feComposite in` + `feGaussianBlur .8` + `feMerge`, **solo** en objetos en reposo: rotulador (se quita al cogerlo), hueso (se quita al arrastrarlo) y perro asomado. Nunca en la caseta (tiembla) ni en el perro del patio (camina): un filtro sobre un subárbol animado obliga a repintar cada frame.

## Proporciones "monas"

Cabeza ≈ 45 % del largo del cuerpo, patas cortas, ojos de punto con un brillo, orejas caídas, cola arriba. Asimetrías deliberadas (una oreja más baja, un brillo distinto en cada ojo).

## Partes animables (SVG)

Cada parte que se mueve es un `<g>` con su clase y `style="transform-origin: Xpx Ypx"` en unidades del viewBox; el CSS pone `transform-box: view-box`. Las listas de transformación se escriben siempre translate-primero (`translate(tx,ty) rotate(a)`).

- Perro del patio (`dog-walk.svg`, 200×160): `.dog__flip` (100,80) · `.dog__bob` · `.dog__tail` (36,80) · `.dog__leg--*` (rodillas) · `.dog__head` (132,86) · `.dog__ear--*` · `.dog__lid` · ancla `.dog__mouth` en (178,92).
- Perro asomado (`dog-peek.svg`, 400×360): `.dog__flip` (200,180) · `.dog__ear--l/--r` · `.dog__lid` · `.dog__paw`.
- Caseta: `house-back.svg` (pared trasera, interior de la puerta, `.house__glow`, `.house__eyes`) y `house-front.svg` (`.house__shake` con la pared frontal recortada por la puerta, tejado y cartel). La puerta va a ras de la jamba derecha para que el perro que entra quede tapado por la pared.
- Hueso (`bone.svg`, 120×48): un solo path; `transform-origin` en su centro.
- Rotulador (`marker.svg`, 1000×260): punta a la izquierda; el elemento HTML rota sobre la punta (`transform-origin: 0 50%`).

## Escenas de Experiencia (SVG)

Tres escenas dibujadas en código que aparecen detrás de la sección Experiencia (`src/partials/exp-minsait.svg`, `exp-ntt.svg`, `exp-dynos.svg`, una por entrada de la línea temporal).

- **Lienzo**: `viewBox="0 0 1600 640"` con `preserveAspectRatio="xMaxYMid slice"`. El escenario mide lo que se ve de la sección (como mucho la ventana), así que la escena se escala por el alto y se recorta por la izquierda: en escritorio se ven aprox. las unidades 460-1600 (16:9) o 580-1600 (16:10) y en un móvil vertical solo 1300-1600. Por eso Marco y el objeto clave van en x ≈ 1100-1600 y el tercio derecho de la pantalla cae siempre en x ≈ 1250-1600; el ambiente (ventanal, tablero del sprint, fila de racks) ocupa el resto a lo ancho con pocos trazos y queda bajo el velo. Suelo en y ≈ 600.
- **Sin fondo propio**: se ve el `--tile-2` de la sección. Superficies `#202839` / `#262f44`, tinta `var(--ill-ink)` de 3-4 u (en Marco, escalado, los trazos se refuerzan para que queden igual), tres tonos por material, sombra en el suelo `#000` al 30 %.
- **Color**: `--action` solo en lo que emite luz (pantallas, LEDs, el diagrama de la pizarra y el halo que proyectan en la pared); el verde `#59d499` solo en las pruebas superadas. Nada de texto legible: barras y garabatos. Sin filtros (la escena entera se anima con `transform`).
- **Marco**: piezas copiadas de `desk.svg` dentro de un `<g transform="translate(…) scale(…)">` en sus coordenadas originales: cabeza de espaldas (`.desk__head-back`, NTT) o en perfil perdido (`.desk__head-turned`, Minsait y Dynos, mirando a lo que hace), cuello, jersey con el cuello de canalé, brazos y manos tecleando (NTT) y la taza; sin las capas de sombra ni de luz cálida del escritorio. El jersey se alarga hasta la cadera con el elástico; pantalón gris `#3a3f4a` (sombra `#2c3038`) y zapatos `#17191d` son nuevos. Escala ≈ 0,56 (unos 375 u de alto de pie; el puesto de NTT, sentado, va a 0,6 × 1,15).
- **Luz de borde** (`.exp__rim`, `#6bb8ff`, estática): el mismo contorno de la silueta con un trazo ancho **detrás** de ella, de modo que solo asoma por fuera, del lado de la luz (pizarra, monitores, LEDs).
- **Velo** (CSS, `.experience__scene::after`): casi opaco en el 38 % izquierdo (fechas), 60 % hacia el 70 % del ancho y 25 % en el borde derecho, con fundido vertical arriba y abajo; es el mando de la legibilidad, no el dibujo. Con una escena encendida, las viñetas y el resumen llevan además un halo `text-shadow` del color de la sección (en reposo no se aplica).
- **Peso**: ≤ 16 KB por escena (coordenadas copiadas redondeadas a enteros; a esa escala el error es < 0,3 u).
