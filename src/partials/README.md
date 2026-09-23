# Partials

Fragmentos SVG dibujados a mano (`*.svg`) y la hoja de plantillas diferidas (`lazy.html`).

- Cada `NOMBRE.svg` se inyecta donde haya un par de marcadores `<!-- partial:NOMBRE --><!-- /partial:NOMBRE -->`, en `index.html` o en `lazy.html`, con `python tools/inject-partials.py` (idempotente; `test/partials.test.mjs` comprueba que lo inyectado coincide con el fichero).
- Lo que no hace falta para el primer render (medias de tarjetas, farola, rotulador, perro, caseta, hueso, escritorio del hero, lámpara de lava, hoja del paper) va en `lazy.html` como `<template data-for="X">`; `src/js/main.js` lo estampa tras `load` dentro de `[data-lazy="X"]`.
- Las fichas de proyecto viven en `projects/` (una por id) con su propio README.
- Estilo de las ilustraciones: `design/STYLE.md`.
