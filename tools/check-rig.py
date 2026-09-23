#!/usr/bin/env python3
"""Comprobación visual del rig: compone base + capas con la geometría medida
(tools/rig-geometry.json) y la pone junto al original completo (marcoCafenoBC.png)
y a un mapa de diferencias. Salida: <out>/rig-check.png (por defecto tools/out/).

Uso: python tools/check-rig.py [carpeta_salida]
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
IMG = ROOT / "src/assets/img/rig"
geom = json.loads((ROOT / "tools/rig-geometry.json").read_text(encoding="utf-8"))["layers"]
out_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "tools/out"
out_dir.mkdir(parents=True, exist_ok=True)

ORDER = ["base", "lips", "eyes", "brow-l", "brow-r", "glasses", "cup", "hand"]
S = 2  # unidades rig-1000 -> px (composición a 1000 px con las capas @2x)

comp = Image.new("RGBA", (1000, 1100), (26, 32, 48, 255))
for name in ORDER:
    box = geom[name]["box"]
    layer = Image.open(IMG / f"{name}@2x.webp").convert("RGBA")
    layer = layer.resize((box[2], box[3]), Image.LANCZOS) if layer.size != (box[2], box[3]) else layer
    comp.alpha_composite(layer, (box[0], box[1]))

ref = Image.open(ROOT / "design/source/marcoCafenoBC.png").convert("RGBA").resize((1000, 1000), Image.LANCZOS)
ref_bg = Image.new("RGBA", (1000, 1100), (26, 32, 48, 255))
ref_bg.alpha_composite(ref, (0, 0))

a = np.array(comp.convert("RGB")).astype(np.int16)
b = np.array(ref_bg.convert("RGB")).astype(np.int16)
diff = np.abs(a - b).mean(axis=2)
diff_img = Image.fromarray(np.clip(diff * 3, 0, 255).astype(np.uint8)).convert("RGB")

d = ImageDraw.Draw(comp)
for name in ORDER[1:]:
    x, y, w, h = geom[name]["box"]
    d.rectangle((x, y, x + w, y + h), outline=(41, 151, 255, 160), width=2)
    vx0, vy0, vx1, vy1 = geom[name]["visible"]
    d.rectangle((vx0, vy0, vx1, vy1), outline=(89, 212, 153, 200), width=2)

sheet = Image.new("RGB", (3000 + 40, 1100), (10, 13, 20))
sheet.paste(comp.convert("RGB"), (0, 0))
sheet.paste(ref_bg.convert("RGB"), (1020, 0))
sheet.paste(diff_img, (2040, 0))
out = out_dir / "rig-check.png"
sheet.save(out)
face = diff[150:300, 330:600].mean()
hand = diff[600:1000, 100:560].mean()
print(f"rig-check -> {out}  diff media cara {face:.1f}, mano/vaso {hand:.1f} (0 = identico)")
