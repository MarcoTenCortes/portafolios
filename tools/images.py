#!/usr/bin/env python3
"""Genera los assets de imagen del portafolio v2 a partir de los originales.

Uso (desde la raíz del repo):  python tools/images.py
Requiere: Pillow, numpy, scipy  (tools/requirements.txt)

Salidas en src/assets/img/:
  rig/       base, lips, eyes, brow-l, brow-r, glasses, hand, cup (+ @2x), fallback (+ @2x)
  bench/     body, leg, hand (+ @2x)
  character/ hero-bust-800, hero-bust-1024
  projects/  bot, tareas, nakoa, cinema en 640/960/1280 (o el ancho nativo si es menor)
Y la geometría medida del rig en tools/rig-geometry.json (unidades rig-1000).
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi

ROOT = Path(__file__).resolve().parents[1]
OLD = ROOT / "design" / "source"
DESIGN = ROOT / "design" / "source"
OUT = ROOT / "src" / "assets" / "img"
GEOM_PATH = ROOT / "tools" / "rig-geometry.json"

RNG = np.random.default_rng(42)
REPORT: list[tuple[str, int]] = []


def rgba(path: Path) -> Image.Image:
    return Image.open(path).convert("RGBA")


def save_webp(im: Image.Image, rel: str, *, lossless: bool = False, quality: int = 90) -> int:
    path = OUT / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    if lossless:
        im.save(path, "WEBP", lossless=True, method=6)
    else:
        im.save(path, "WEBP", quality=quality, method=6)
    size = path.stat().st_size
    REPORT.append((rel, size))
    return size


def unsharp(im: Image.Image, radius: float = 1.2, percent: int = 60) -> Image.Image:
    return im.filter(ImageFilter.UnsharpMask(radius=radius, percent=percent, threshold=2))


RIM = (41, 151, 255)  # --action


def bake_rim(im: Image.Image, radius: int = 3, opacity: float = 0.6) -> Image.Image:
    """Contorno azul horneado bajo la silueta (equivale a feMorphology dilate + flood --action)."""
    alpha = np.array(im)[..., 3] > 8
    dil = ndi.binary_dilation(alpha, iterations=radius)
    rim = np.zeros((im.height, im.width, 4), np.uint8)
    rim[..., :3] = RIM
    rim[..., 3] = (dil * int(255 * opacity)).astype(np.uint8)
    # suaviza el borde exterior del contorno
    a = ndi.gaussian_filter(rim[..., 3].astype(np.float32), 0.8)
    rim[..., 3] = np.clip(a, 0, 255).astype(np.uint8)
    out = Image.fromarray(rim, "RGBA")
    out.alpha_composite(im)
    return out


def upscale2x(im: Image.Image, sharpen: bool = True) -> Image.Image:
    big = im.resize((im.width * 2, im.height * 2), Image.LANCZOS)
    if sharpen:
        rgb = unsharp(big.convert("RGB"))
        big = Image.merge("RGBA", (*rgb.split(), big.split()[3]))
    return big


# --------------------------------------------------------------------------- rig
# Posiciones CSS antiguas (left%, top%, width% del <figure>; la base ocupa el 65 %).
LAYERS = {
    "lips": ("labios.png", 23.8, 28.3, 13.0),
    "eyes": ("ojosmarco.png", 23.0, 18.0, 15.0),
    "brow-l": ("ceja1.png", 22.3, 16.6, 15.0),
    "brow-r": ("ceja2.png", 22.3, 16.6, 15.0),
    "glasses": ("gafas.png", 19.3, 17.6, 23.0),
    "hand": ("manocafe.png", 6.0, 61.0, 33.0),
    "cup": ("cafe.png", 18.0, 64.0, 25.0),
}
PAD = 160  # margen alrededor del lienzo 500 para buscar capas que sobresalen


def css_guess(left: float, top: float, width: float, nat_w: int, nat_h: int) -> tuple[int, int, int, int]:
    """Caja aproximada en espacio 500 a partir del CSS antiguo (W=500px, 1rem=10px)."""
    R = 15.4  # padding vertical del figure en espacio 500
    x = left / 0.65 * 5.0
    w = width / 0.65 * 5.0
    y = top / 100.0 * (500 + 2 * R) - R
    h = w * nat_h / nat_w
    return int(round(x)), int(round(y)), int(round(w)), int(round(h))


def register(layer: np.ndarray, ref: np.ndarray, guess: tuple[int, int], win: int = 64) -> tuple[int, int, float]:
    """Busca el desplazamiento (x, y) en espacio 500 que mejor alinea la capa con la referencia."""
    lh, lw = layer.shape[:2]
    lrgb = layer[..., :3].astype(np.int16)
    lmask = layer[..., 3] > 128
    if lmask.sum() == 0:
        raise ValueError("capa vacía")
    gx, gy = guess
    best = (gx, gy, 1e9)
    for dy in range(-win, win + 1):
        for dx in range(-win, win + 1):
            x, y = gx + dx + PAD, gy + dy + PAD
            region = ref[y : y + lh, x : x + lw]
            if region.shape[:2] != (lh, lw):
                continue
            mask = lmask & (region[..., 3] > 0)
            n = mask.sum()
            if n < lmask.sum() * 0.6:
                continue
            err = np.abs(lrgb[mask] - region[..., :3][mask].astype(np.int16)).mean()
            if err < best[2]:
                best = (gx + dx, gy + dy, float(err))
    return best


def fill_holes(base: Image.Image) -> tuple[Image.Image, np.ndarray]:
    """Rellena los agujeros transparentes encerrados por la silueta con el color del anillo."""
    arr = np.array(base).astype(np.float32)
    alpha = arr[..., 3] > 0
    filled = ndi.binary_fill_holes(alpha)
    hole = filled & ~alpha
    # Relleno por interpolacion: cada pixel del agujero toma la media, ponderada por la
    # inversa de la distancia, de los vecinos opacos mas cercanos a izquierda, derecha,
    # arriba y abajo en su fila/columna, y un poco de ruido para no dejar un parche plano.
    # El borde del agujero conserva un fleco de 1-2 px con el color de la mano recortada:
    # se repinta tambien ese anillo y solo se muestrea a partir de 4 px hacia fuera.
    H, W = alpha.shape
    repaint = hole | (ndi.binary_dilation(hole, iterations=3) & alpha)
    sampleable = alpha & ~ndi.binary_dilation(hole, iterations=5)
    src = arr[..., :3].copy()
    rgb = arr[..., :3]
    ys, xs = np.where(repaint)
    for y, x in zip(ys, xs):
        samples = []
        for dy, dx in ((0, -1), (0, 1), (-1, 0), (1, 0)):
            yy, xx, d = y, x, 0
            while True:
                yy += dy
                xx += dx
                d += 1
                if yy < 0 or yy >= H or xx < 0 or xx >= W or d > 140:
                    break
                if sampleable[yy, xx]:
                    samples.append((src[yy, xx], 1.0 / d))
                    break
        if samples:
            wsum = sum(w for _, w in samples)
            color = sum(c * w for c, w in samples) / wsum
        else:
            color = np.array([38, 41, 47], np.float32)
        rgb[y, x] = np.clip(color + RNG.normal(0, 1.5, 3), 0, 255)
        arr[y, x, 3] = 255  # tambien el fleco: era semitransparente y dibujaba el contorno de la mano
    # suavizado ligero solo en la zona repintada para fundir las costuras
    blurred = ndi.gaussian_filter(arr[..., :3], sigma=(2.0, 2.0, 0))
    arr[..., :3][repaint] = blurred[repaint]
    out = Image.fromarray(arr.astype(np.uint8), "RGBA")
    return out, hole


def build_rig() -> None:
    base = rgba(OLD / "marcotest.png")            # 500x500, sin rasgos ni vaso
    nobc = rgba(DESIGN / "marcoCafenoBC.png")     # 500x500, personaje completo con vaso
    cafe = Image.open(DESIGN / "marcoCafe.webp").convert("RGB")  # 1024x1024, con fondo pintado
    assert base.size == (500, 500) and nobc.size == (500, 500) and cafe.size == (1024, 1024)

    ref = np.zeros((500 + 2 * PAD, 500 + 2 * PAD, 4), np.uint8)
    ref[PAD : PAD + 500, PAD : PAD + 500] = np.array(nobc)

    geom: dict[str, dict] = {"units": "rig-1000 (base = 1000x1000)", "layers": {}}

    # Base 1x (agujero relleno) y 2x
    base_filled, hole = fill_holes(base)
    hole_px = int(hole.sum())
    ys, xs = np.where(hole)
    msg = f"[rig] agujeros rellenados en base: {hole_px} px"
    if hole_px:
        msg += f", bbox {xs.min()},{ys.min()}-{xs.max()},{ys.max()}"
    print(msg)
    a = np.array(base_filled)[..., 3] > 0
    assert not (ndi.binary_fill_holes(a) & ~a).any(), "quedan agujeros en la base"
    save_webp(bake_rim(base_filled, 2), "rig/base.webp", quality=92)

    base2 = upscale2x(base_filled, sharpen=False)
    b2 = np.array(base2).astype(np.int16)
    cafe_arr = np.array(cafe.resize((1000, 1000), Image.LANCZOS)).astype(np.int16)
    agree = np.abs(b2[..., :3] - cafe_arr).mean(axis=2) < 22
    agree = ndi.binary_erosion(agree, iterations=2)
    hole_big = np.array(Image.fromarray(ndi.binary_dilation(hole, iterations=8).astype(np.uint8) * 255).resize((1000, 1000), Image.NEAREST)) > 0
    agree &= ~hole_big
    # marcoCafe.webp tiene el vaso y la mano pintados: nunca copiar color de esa zona (rig-1000: x 180-560, y 650-1000)
    agree[650:1000, 180:560] = False
    b2[..., :3][agree] = cafe_arr[agree]
    base2 = Image.fromarray(b2.astype(np.uint8), "RGBA")
    rgb = unsharp(base2.convert("RGB"), radius=1.0, percent=45)
    base2 = Image.merge("RGBA", (*rgb.split(), base2.split()[3]))
    save_webp(bake_rim(base2, 4), "rig/base@2x.webp", quality=90)
    geom["layers"]["base"] = {"box": [0, 0, 1000, 1000], "src": "marcotest.png", "hole_px": hole_px}

    # Capas
    for name, (file, left, top, width) in LAYERS.items():
        layer = rgba(OLD / file)
        gx, gy, gw, gh = css_guess(left, top, width, layer.width, layer.height)
        # Las capas se recortaron del lienzo 500 a escala natural: se registran sin reescalar
        # (el CSS antiguo las estiraba ligeramente, de ahi la deriva que se veia en la web).
        arr = np.array(layer)
        x, y, err = register(arr, ref, (gx, gy))
        vis = arr[..., 3] > 32
        vy, vx = np.where(vis)
        box = [x * 2, y * 2, layer.width * 2, layer.height * 2]
        visible = [int((x + vx.min()) * 2), int((y + vy.min()) * 2), int((x + vx.max()) * 2), int((y + vy.max()) * 2)]
        print(f"[rig] {name:8s} css~({gx},{gy}) -> registrado ({x},{y}) err {err:.1f}  box(1000)={box} visible={visible}")
        geom["layers"][name] = {"src": file, "box": box, "visible": visible, "err": round(err, 2)}

        save_webp(layer, f"rig/{name}.webp", lossless=True)

        # 2x: color de marcoCafe.webp (1024) recortado en la caja, alfa de la capa 1x x2
        s = 1024 / 500
        cx0, cy0 = x * s, y * s
        crop = cafe.crop((int(round(cx0)), int(round(cy0)), int(round(cx0 + layer.width * s)), int(round(cy0 + layer.height * s))))
        color = crop.resize((layer.width * 2, layer.height * 2), Image.LANCZOS)
        color = unsharp(color, radius=0.8, percent=40)
        alpha = layer.split()[3].resize((layer.width * 2, layer.height * 2), Image.LANCZOS)
        two = Image.merge("RGBA", (*color.split(), alpha))
        save_webp(two, f"rig/{name}@2x.webp", lossless=True)

    # Fallback (personaje completo con vaso) 1x y 2x
    save_webp(bake_rim(nobc, 2), "rig/fallback.webp", quality=92)
    alpha2 = nobc.split()[3].resize((1024, 1024), Image.LANCZOS)
    fb2 = Image.merge("RGBA", (*cafe.split(), alpha2))
    save_webp(bake_rim(fb2, 4), "rig/fallback@2x.webp", quality=90)

    GEOM_PATH.write_text(json.dumps(geom, indent=2), encoding="utf-8")
    print(f"[rig] geometria -> {GEOM_PATH.relative_to(ROOT)}")


# ------------------------------------------------------------------------- bench
def build_bench() -> None:
    body = rgba(OLD / "bancomarcoamp.png")
    leg = rgba(OLD / "pierna.png")
    hand = rgba(OLD / "hand.png")
    save_webp(bake_rim(body, 2), "bench/body.webp", quality=92)
    save_webp(bake_rim(upscale2x(body), 4), "bench/body@2x.webp", quality=90)
    save_webp(leg, "bench/leg.webp", lossless=True)
    save_webp(upscale2x(leg), "bench/leg@2x.webp", lossless=True)
    save_webp(hand, "bench/hand.webp", lossless=True)
    save_webp(upscale2x(hand), "bench/hand@2x.webp", lossless=True)
    for name, im in (("body", body), ("leg", leg), ("hand", hand)):
        a = np.array(im)[..., 3] > 32
        ys, xs = np.where(a)
        print(f"[bench] {name}: {im.size} visible {xs.min()},{ys.min()}-{xs.max()},{ys.max()}")


# -------------------------------------------------------------------- character
def build_hero() -> None:
    bust = rgba(OLD / "bf_marco.png")
    save_webp(bake_rim(bust, 4), "character/hero-bust-1024.webp", quality=90)
    for w in (800, 520):
        small = bust.resize((w, round(bust.height * w / bust.width)), Image.LANCZOS)
        save_webp(bake_rim(small, 3 if w == 800 else 2), f"character/hero-bust-{w}.webp", quality=90)
    print(f"[hero] {bust.size} -> 1024, 800 y 520")


# --------------------------------------------------------------------- projects
PROJECTS = {
    "bot": ("bot.png", None),
    "tareas": ("persona_compartiendo.png", None),
    "nakoa": ("nakoa.png", None),
    "cinema": ("cinema.png", (0, 0, 1120, 700)),  # banda de cabecera 16:10
}
CANVAS = (10, 13, 20)  # --canvas


def build_projects() -> dict:
    manifest = {}
    for name, (file, crop) in PROJECTS.items():
        im = Image.open(OLD / file).convert("RGBA")
        if crop:
            im = im.crop(crop)
        bg = Image.new("RGBA", im.size, (*CANVAS, 255))
        bg.alpha_composite(im)
        im = bg.convert("RGB")
        widths = [w for w in (640, 960, 1280) if w <= im.width]
        if im.width not in widths and im.width < 1280:
            widths.append(im.width)
        out = []
        for w in sorted(widths):
            h = round(im.height * w / im.width)
            r = im if w == im.width else im.resize((w, h), Image.LANCZOS)
            size = save_webp(r, f"projects/{name}-{w}.webp", quality=82)
            out.append({"w": w, "h": h, "bytes": size})
        manifest[name] = out
        print(f"[projects] {name}: {[o['w'] for o in out]}")
    (ROOT / "tools" / "projects-manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return manifest


def main() -> None:
    build_rig()
    build_bench()
    build_hero()
    build_projects()
    total = sum(s for _, s in REPORT)
    print("\n--- salidas ---")
    for rel, size in REPORT:
        print(f"{size/1024:8.1f} KB  {rel}")
    print(f"{total/1024:8.1f} KB  TOTAL ({len(REPORT)} ficheros)")


if __name__ == "__main__":
    main()
