#!/usr/bin/env python3
"""Genera public/og.png (1200x630) con el personaje del rig y el nombre en Inter.
Requiere src/assets/img/rig/fallback@2x.webp (tools/images.py) y tools/fonts/*.ttf."""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "og.png"
W, H = 1200, 630
BG = (5, 7, 11)
INK = (245, 247, 250)
MUTE = (142, 152, 168)
ACTION = (41, 151, 255)

img = Image.new("RGB", (W, H), BG)

# foco radial azul detrás del personaje
glow = Image.new("RGB", (W, H), BG)
gd = ImageDraw.Draw(glow)
gd.ellipse((720, 40, 1240, 640), fill=(26, 40, 70))
glow = glow.filter(ImageFilter.GaussianBlur(120))
img = Image.blend(img, glow, 1.0)

# personaje
char = Image.open(ROOT / "src/assets/img/rig/fallback@2x.webp").convert("RGBA")
ch = 640
char = char.resize((ch, ch), Image.LANCZOS)
img.paste(char, (W - ch + 40, H - ch + 70), char)

d = ImageDraw.Draw(img)
display = ImageFont.truetype(str(ROOT / "tools/fonts/InterDisplay-SemiBold.ttf"), 66)
text = ImageFont.truetype(str(ROOT / "tools/fonts/Inter-SemiBold.ttf"), 28)
small = ImageFont.truetype(str(ROOT / "tools/fonts/Inter-SemiBold.ttf"), 22)

d.text((80, 168), "Marco Tenorio", font=display, fill=INK)
d.text((80, 244), "Cortés", font=display, fill=INK)
d.text((80, 350), "Software Engineer · Technical Analyst", font=text, fill=ACTION)
d.text((80, 396), "Arquitectura de soluciones · Java/Spring · QA · Data & IA", font=small, fill=MUTE)
d.line((80, 470, 640, 470), fill=(36, 42, 58), width=2)
d.text((80, 492), "portafolios.mtcor.es", font=small, fill=MUTE)

img.save(OUT, "PNG", optimize=True)
print(f"og.png -> {OUT.relative_to(ROOT)} ({OUT.stat().st_size // 1024} KB)")
