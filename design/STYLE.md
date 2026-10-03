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
- Escritorio del hero (`desk.svg`, 1000×440): `.desk__head` (470,300) · `.desk__arm` (548,344) · `.desk__fore` (580,406) · `.desk__mug` (661,327) · `.desk__lid` (borde superior de cada ojo; mismo keyframe que el perro, `dog-blink`). El giro de Marco hacia el visitante (pose `face`) es un rig 2.5D de un solo mando, la variable `--desk-turn` (registrada con `@property`; 0deg de espaldas → 180deg de frente, girando hacia la lámpara) sobre el eje vertical x = 470: una pieza a distancia ρ del eje y ángulo inicial α queda en x = 470 + ρ·cos(α − θ), con profundidad z = ρ·sin(θ − α) hacia el espectador. La cabeza va adelantada (`--dt-h` = θ + 12°·sin θ) y brazo y taza retrasados (`--dt-m` = θ − 15°·sin θ).
  - Pivotes y capas del rig: `.desk__spin--torso`, `--head` y `--shoulder` (470,300) · `.desk__rig--arm` (548,344) · `.desk__rig--fore` (580,406) · `.desk__chair` (470,365), con su canto `.desk__chair-edge`, que deshace el estrechado y mide 10 u por |sin θ| · `.desk__chair-arm` (570,391) · `.desk__mug-tilt` (661,327). A 0deg todos son la identidad: typing, turn, reach y hold no cambian.
  - Regla: lo que depende del ángulo cambia cada frame, así que **las opacidades y transformaciones por ángulo van en envolventes sin transición** (`.desk__skin--*`, `.desk__spin`, `.desk__rig`, `.desk__chair`…); en un grupo que ya transiciona (`.desk__arm`, `.desk__head-turned`…) reiniciaría su transición en cada frame. Cada envolvente de dibujo lleva también su opacidad sin rig (`:not(.is-rig)`, por tiempo).
  - Dibujos por ángulo (skins), con un solape de ~5° en cada corte (la que entra llega a 1 justo en el corte): cabeza de espaldas o en perfil perdido (hasta 78° de su ángulo) · de tres cuartos (78-140: nariz en el contorno derecho, lente izquierda asomando, oreja derecha a la izquierda) · de frente (desde 140); manga de lado con volumen (57-123) y de frente partida por el codo (desde 123: el antebrazo con el puño en `.desk__rig--fore`); mano izquierda hasta 45 y manga izquierda desde ahí, detrás del jersey (recortada a lo que sobresale, `#desk-torso-out`).
  - Nada con opacidad por ángulo entre la cabeza y el relleno del jersey: Chrome cambia el rasterizado de las poses en reposo.

## Escenas de Experiencia (SVG)

Tres escenas dibujadas en código que aparecen detrás de la sección Experiencia (`src/partials/exp-minsait.svg`, `exp-ntt.svg`, `exp-dynos.svg`, una por entrada de la línea temporal).

- **Lienzo**: `viewBox="0 0 1600 640"` con `preserveAspectRatio="xMaxYMid slice"`. El escenario mide lo que se ve de la sección (como mucho la ventana), así que la escena se escala por el alto y se recorta por la izquierda: en escritorio se ven aprox. las unidades 460-1600 (16:9) o 580-1600 (16:10) y en un móvil vertical solo 1300-1600. Por eso Marco y el objeto clave van en x ≈ 1100-1600 y el tercio derecho de la pantalla cae siempre en x ≈ 1250-1600; el ambiente (ventanal, tablero del sprint, fila de racks) ocupa el resto a lo ancho con pocos trazos y queda bajo el velo. Suelo en y ≈ 600.
- **Sin fondo propio**: se ve el `--tile-2` de la sección. Superficies `#202839` / `#262f44`, tinta `var(--ill-ink)` de 3-4 u (en Marco, escalado, los trazos se refuerzan para que queden igual), tres tonos por material, sombra en el suelo `#000` al 30 %.
- **Color**: `--action` solo en lo que emite luz (pantallas, LEDs, el diagrama de la pizarra y el halo que proyectan en la pared); el verde `#59d499` solo en las pruebas superadas. Nada de texto legible: barras y garabatos. Sin filtros (la escena entera se anima con `transform`).
- **Marco**: piezas copiadas de `desk.svg` dentro de un `<g transform="translate(…) scale(…)">` en sus coordenadas originales: cabeza de espaldas (`.desk__head-back`, NTT) o en perfil perdido (`.desk__head-turned`, Minsait y Dynos, mirando a lo que hace), cuello, jersey con el cuello de canalé, brazos y manos tecleando (NTT) y la taza; sin las capas de sombra ni de luz cálida del escritorio. El jersey se alarga hasta la cadera con el elástico; pantalón gris `#3a3f4a` (sombra `#2c3038`) y zapatos `#17191d` son nuevos. Escala ≈ 0,56 (unos 375 u de alto de pie; el puesto de NTT, sentado, va a 0,6 × 1,15).
- **Luz de borde** (`.exp__rim`, `#6bb8ff`, estática): el mismo contorno de la silueta con un trazo ancho **detrás** de ella, de modo que solo asoma por fuera, del lado de la luz (pizarra, monitores, LEDs).
- **Velo** (CSS, `.experience__scene::after`): casi opaco en el 38 % izquierdo (fechas), 60 % hacia el 70 % del ancho y 25 % en el borde derecho, con fundido vertical arriba y abajo; es el mando de la legibilidad, no el dibujo. Con una escena encendida, las viñetas y el resumen llevan además un halo `text-shadow` del color de la sección (en reposo no se aplica).
- **Peso**: ≤ 16 KB por escena (coordenadas copiadas redondeadas a enteros; a esa escala el error es < 0,3 u).

## Objetos ocultos del hero (SVG)

Cuatro dibujos (`src/partials/secret-rack.svg`, `secret-shelf.svg`, `secret-window.svg`, `secret-board.svg`) que forman el cuarto de Marco a oscuras y solo se ven bajo la luz del ratón (`src/js/secret.js`).

- **Lienzo**: cada uno con su `viewBox` y un `<g id="secret-NOMBRE">` raíz (la pista lo repite con `<use>`), sin fondo propio: detrás está el `--tile-black` del hero. A 1280 px se ven a la escala del escritorio (≈ 0,46 px por unidad el rack y la estantería), así que un libro mide lo que la taza y el rack es algo más de vez y media la altura de la mesa.
- **Trazo y color**: los del resto del sitio (tinta `var(--ill-ink)` de 3-4 u, uniones que no cierran del todo, tres tonos por material con la luz desde arriba). Superficies `#202839` / `#262f44` / `#2b3447`, madera `--ill-wood` (sombra `#7a4f30`, luz `#b98457`), crema `--ill-cream`. `--action` solo en lo que emite luz (LEDs, la pantalla del SAI, las ventanas de la Giralda y la farola de la foto), más el collar del perro, que es el del patio, y el póster del grafo de SIMPL. Sin filtros ni texto legible: la lente se mueve en cada frame. Peso ≤ 8 KB cada uno.
- **Exposición**: el dibujo va al 86 % de opacidad (`.hero__secret-art`): a pleno color destacaría sobre el escritorio a oscuras. La lente (`mask-image` radial) lo funde hacia el borde de la luz.
- **Rack y perro** (400×300, la pista): el armario de `exp-dynos.svg` en pequeño (panel de parcheo con latiguillos, switch, tres servidores 2U con un LED `.secret__led` cada uno que parpadea despacio con `steps`, y el SAI) y a su izquierda el perro del patio dormido, enroscado en una cesta de mimbre con la manta azul apagada (`#3d5f8c`, no `--action`): ojos como arcos, la cabeza sobre las patas en el borde y la cola colgando por fuera. Va en el suelo, pegado a la izquierda del escritorio. Repetido al 16 % es la pista: a esa opacidad solo se adivinan el perro crema y los LEDs.
- **Estantería** (400×280): dos baldas de madera con escuadras; arriba la planta del escritorio (la misma, a 0,75 con el trazo compensado) y el gato gris (`#8e98a8`, sombra `#66707f`, luz `#aab3c1`) hecho una bola con la cola colgando por delante; abajo seis lomos, uno apoyado, y sobre dos libros tumbados el patito de goma de depurar (`#e8d27a`). Encima del rack.
- **Ventana** (320×220): marco de madera de cuatro cuarterones con alféizar, cielo en degradado hacia el horizonte, luna crema con cráteres y halo, cinco estrellas `--star`, la Giralda (caña con dos ventanas encendidas, cuerpo de campanas con sus arcos, remates escalonados, cupulín y el Giraldillo) con la cara derecha iluminada por la luna, los tejados de la catedral y la cortina recogida. Arriba a la izquierda, sobre el eyebrow: su alto es el hueco libre (44-170 px).
- **Corcho** (380×240): marco de madera, corcho `#6f5438` con motas, el póster oscuro del grafo de SIMPL (tres nodos y dos aristas en azul), tres polaroids (el perro, la farola con el banco de noche, el busto con gafas y la chaqueta azul), la nota amarilla torcida con garabatos y chinchetas `--danger` y `--action`, cada pieza con su sombra desplazada. A la derecha del medallón: centrado en el margen si cabe y, si no, pegado al borde y asomando por detrás del disco (lo que queda a la vista son las fotos de la derecha y la nota).
