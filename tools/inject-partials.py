#!/usr/bin/env python3
"""Sustituye los marcadores <!-- partial:nombre --> de index.html por el contenido de
src/partials/nombre.svg (idempotente: si el partial ya está inyectado, lo reemplaza).

Uso: python tools/inject-partials.py
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
PARTIALS = ROOT / "src" / "partials"

pattern = re.compile(r"<!-- partial:([a-z0-9-]+) -->(?:.*?<!-- /partial:\1 -->)?", re.S)


def replace(m: re.Match) -> str:
    name = m.group(1)
    path = PARTIALS / f"{name}.svg"
    if not path.exists():
        print(f"  [aviso] falta {path.relative_to(ROOT)}; se deja el marcador")
        return f"<!-- partial:{name} -->"
    body = path.read_text(encoding="utf-8").strip()
    print(f"  {name}: {len(body)} bytes")
    return f"<!-- partial:{name} -->\n{body}\n<!-- /partial:{name} -->"


for target in (HTML, PARTIALS / "lazy.html"):
    if not target.exists():
        continue
    html = target.read_text(encoding="utf-8")
    new = pattern.sub(replace, html)
    if new != html:
        target.write_text(new, encoding="utf-8")
        print(f"{target.name} actualizado")
    else:
        print(f"{target.name} sin cambios")
