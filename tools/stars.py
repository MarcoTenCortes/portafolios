#!/usr/bin/env python3
"""Genera src/styles/stars.css: dos capas de estrellas como fondos SVG (data URI)
en el marco 1000x1250 de la escena del banco. Determinista (seed 42/43).
Excluye un radio de 120 unidades alrededor del cabezal de la farola (287,150)."""
from pathlib import Path
import random
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "src" / "styles" / "stars.css"
LAMP = (287, 150)


def layer(n: int, r: float, seed: int) -> str:
    rng = random.Random(seed)
    pts: list[tuple[float, float]] = []
    while len(pts) < n:
        x, y = rng.uniform(0, 1000), rng.uniform(0, 1250 * 0.55)
        if ((x - LAMP[0]) ** 2 + (y - LAMP[1]) ** 2) ** 0.5 < 120:
            continue
        if any((x - px) ** 2 + (y - py) ** 2 < 18 ** 2 for px, py in pts):
            continue
        pts.append((round(x, 1), round(y, 1)))
    circles = "".join(f"<circle cx='{x}' cy='{y}' r='{r}'/>" for x, y in pts)
    svg = (
        "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1000 1250' preserveAspectRatio='none'>"
        f"<g fill='#f5f7fa'>{circles}</g></svg>"
    )
    return "data:image/svg+xml," + quote(svg, safe="/:='<>()")


css = (
    "/* Generado por tools/stars.py: no editar a mano */\n"
    f'.scene__stars--a{{background-image:url("{layer(120, 2.2, 42)}")}}\n'
    f'.scene__stars--b{{background-image:url("{layer(60, 3.2, 43)}")}}\n'
)
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(css, encoding="utf-8")
print(f"stars.css -> {OUT.relative_to(ROOT)} ({OUT.stat().st_size} bytes)")
