# Partials

Fragmentos SVG dibujados a mano (`*.svg`) y la hoja de plantillas diferidas (`lazy.html`).

- Cada `NOMBRE.svg` se inyecta donde haya un par de marcadores `<!-- partial:NOMBRE --><!-- /partial:NOMBRE -->`, en `index.html` o en `lazy.html`, con `python tools/inject-partials.py` (idempotente; `test/partials.test.mjs` comprueba que lo inyectado coincide con el fichero).
- Lo que no hace falta para el primer render (medias de tarjetas, farola, rotulador, perro, caseta, hueso, escritorio del hero, lámpara de lava, hoja del paper) va en `lazy.html` como `<template data-for="X">`; `src/js/main.js` lo estampa tras `load` dentro de `[data-lazy="X"]`.
- Las escenas de Experiencia (`exp-minsait.svg`, `exp-ntt.svg`, `exp-dynos.svg`, viewBox 1600×640, `xMaxYMid slice`) van juntas en la plantilla `exp-scenes` de `lazy.html`, una por `.experience__scene[data-exp]`; las comprueba `test/experience.test.mjs` (formato, sin filtros ni texto, ≤ 16 KB).
- Los objetos ocultos del hero (`secret-rack.svg`, `secret-shelf.svg`, `secret-window.svg`, `secret-board.svg`, cada uno con su `<g id="secret-NOMBRE">` raíz) van juntos en la plantilla `secrets` de `lazy.html`, dentro de la lente (`.hero__secret-lens > .hero__secret-art`); la pista repite el rack con `<use href="#secret-rack"/>`. Los comprueba `test/secret.test.mjs` (sin filtros ni texto, ≤ 8 KB).
- Las fichas de proyecto viven en `projects/` (una por id) con su propio README.
- Estilo de las ilustraciones: `design/STYLE.md`.
