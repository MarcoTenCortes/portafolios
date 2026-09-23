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
