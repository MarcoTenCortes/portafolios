#!/usr/bin/env python3
"""Genera los assets de imagen del portafolio v2 a partir de los originales.

Uso (desde la raíz del repo):  python tools/images.py  [--only bench|rig|hero|projects]
Requiere: Pillow, numpy, scipy  (tools/requirements.txt)

Salidas en src/assets/img/:
  rig/       base, lips, eyes, brow-l, brow-r, glasses, hand, cup (+ @2x), fallback (+ @2x)
  bench/     body, leg (zapato), toe, hand, cuff (+ @2x)
  character/ hero-bust-800, hero-bust-1024
  projects/  bot, tareas, nakoa, cinema en 640/960/1280 (o el ancho nativo si es menor)
Y la geometría medida del rig en tools/rig-geometry.json (unidades rig-1000).
"""
from __future__ import annotations

import json
import sys
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
# La escena se reconstruye a partir del dibujo COMPLETO (bancoymarco.png) y de la version del
# autor sin el pie delantero ni la mano del movil (bancomarcoamp.png: jersey pintado bajo la
# mano y retoques sueltos, como el cristal derecho de las gafas). Asi, en reposo, las capas
# superpuestas dan exactamente el dibujo (con esos retoques) y las juntas quedan tapadas:
#   body  el cuerpo, con la pierna delantera entera salvo el zapato; lleva el rim (estatico)
#   leg   el zapato delantero: da golpecitos con la punta pivotando en el tobillo
#   toe   la puntera del zapato trasero, que en el dibujo tapa el talon del delantero
#   hand  la mano del movil, alargada ~9 px por dentro del puno; pivota en la muneca
#   cuff  el puno de la manga, por encima de la mano
# Todo en el lienzo de 500 px del dibujo; el CSS coloca cada capa por su caja (se imprime).
BENCH_FULL, BENCH_AMP = "bancoymarco.png", "bancomarcoamp.png"
BENCH_HAND_AT = (220, 144)  # hand.png sobre el dibujo completo (error medio ~1 nivel)
# pivote del pie: el tobillo, bajo el borde trasero del zapato. Asi el borde no resbala sobre
# el calcetin; lo que se desliza (~4 px) es el talon, que queda detras de la puntera trasera
BENCH_ANKLE = (341.0, 401.0)
BENCH_CUT = ((232.0, 200.0), (240.5, 215.0))  # corte recto de la muneca = borde del puno
BENCH_WRIST_DEPTH = 5.0  # el pivote de la mano va 5 px dentro del puno
# Primera fila del zapato en cada columna (x): por encima quedan el calcetin y la pata del
# banco, que no se mueven. Medido a mano sobre el dibujo (x <= 342: 397; x >= 373: 393).
BENCH_COLLAR = {
    343: 403, 344: 404, 345: 405, 346: 405, 347: 405, 348: 405, 349: 405, 350: 404, 351: 404,
    352: 403, 353: 403, 354: 402, 355: 402, 356: 401, 357: 398, 358: 396, 359: 395, 360: 394,
    361: 393, 362: 392, 363: 392, 364: 392, 365: 392, 366: 393, 367: 393, 368: 393, 369: 394,
    370: 394, 371: 394, 372: 394,
}


def _premul(a: np.ndarray) -> np.ndarray:
    return a[..., :3] * (a[..., 3:4] / 255.0)


def _rim_alpha(mask: np.ndarray, radius: int, opacity: float = 0.6) -> np.ndarray:
    """La misma luz de borde que bake_rim, como alfa 0..1."""
    dil = ndi.binary_dilation(mask, iterations=radius)
    return np.clip(ndi.gaussian_filter(dil.astype(np.float32) * opacity, 0.8), 0, 1)


def _nearest_fill(arr: np.ndarray, src: np.ndarray, dst: np.ndarray) -> None:
    """Pinta los pixeles dst con el color (opaco) del pixel src mas cercano."""
    _, (iy, ix) = ndi.distance_transform_edt(~src, return_indices=True)
    ys, xs = np.where(dst)
    arr[ys, xs, :3] = arr[iy[ys, xs], ix[ys, xs], :3]
    arr[ys, xs, 3] = 255


def _row_fill(arr: np.ndarray, src: np.ndarray, dst: np.ndarray, reach: int) -> None:
    """Pinta dst con el pixel src mas cercano a su derecha en la misma fila (o el mas cercano)."""
    _, (iy, ix) = ndi.distance_transform_edt(~src, return_indices=True)
    for y, x in zip(*np.where(dst)):
        right = np.flatnonzero(src[y, x : x + reach])
        sy, sx = (y, x + right[0]) if len(right) else (iy[y, x], ix[y, x])
        arr[y, x, :3] = arr[sy, sx, :3]
        arr[y, x, 3] = 255


def bench_masks(F: np.ndarray, A: np.ndarray) -> dict:
    """Mascaras en el lienzo de 500 a partir del completo (F) y el amputado (A)."""
    H, W = F.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W]
    diff = np.abs(_premul(F) - _premul(A)).sum(-1) + np.abs(F[..., 3] - A[..., 3])
    lab, _ = ndi.label(diff > 12)
    leg_all = lab == lab[330, 350]  # la pierna delantera que el autor borro
    # zapato: lo borrado por debajo del borde del calcetin
    top = np.full(W, 393)
    top[:343] = 397
    for x, y in BENCH_COLLAR.items():
        top[x] = y
    zone = (yy >= top[xx]) & (xx >= 333) & (xx <= 412) & (yy <= 432)
    shoe = ndi.binary_fill_holes(leg_all & zone)
    shoe |= ndi.binary_dilation(shoe, iterations=2) & zone & (F[..., 3] > 0) & (A[..., 3] < 8)
    # puntera del zapato trasero (por delante del talon del delantero); la fila 432 a la
    # derecha es la sombra que el autor pinto bajo la suela y se queda en el cuerpo
    # (semitransparente solo contra el zapato: contra el fondo, doblaria el borde del cuerpo)
    toe = (xx >= 324) & (xx <= 362) & (yy >= 396) & (yy <= 432)
    toe &= (A[..., 3] > 250) | ((A[..., 3] > 0) & ndi.binary_dilation(shoe, iterations=1))
    toe &= ~((yy == 432) & (xx >= 356)) & ~(leg_all & ~shoe)
    # talon oculto tras la puntera (asoma al girar) y los pixeles del zapato pegados a ella,
    # que llevan mezclado el perfil claro de la puntera: se rehacen con la propia suela
    hidden = ndi.binary_dilation(shoe, iterations=6) & toe & ~shoe
    hidden |= shoe & ndi.binary_dilation(toe, iterations=1) & (yy >= 414)
    # mano: lo borrado alrededor de hand.png, sin pasar del corte de la muneca
    hp = np.zeros((H, W), np.float32)
    ha = np.array(rgba(OLD / "hand.png"))[..., 3] / 255.0
    hx, hy = BENCH_HAND_AT
    hp[hy : hy + ha.shape[0], hx : hx + ha.shape[1]] = ha
    (x0, y0), (x1, y1) = BENCH_CUT
    t = np.array([x1 - x0, y1 - y0])
    cut_len = float(np.hypot(*t))
    t /= cut_len
    n = np.array([t[1], -t[0]])  # normal hacia la mano
    u = (xx + 0.5 - x0) * n[0] + (yy + 0.5 - y0) * n[1]
    v = (xx + 0.5 - x0) * t[0] + (yy + 0.5 - y0) * t[1]
    hand = (((lab == lab[180, 262]) & ndi.binary_dilation(hp > 0.05, iterations=2)) | (hp > 0.5)) & (u > -0.5)
    # puno: una franja de 12 px mas alla del corte; la mano se alarga 9 px por debajo
    cuff = (u >= -12) & (u < 2.5) & (v >= -3) & (v <= cut_len + 3) & ~hand
    ext = (u >= -9) & (u < 0.5) & (v >= 0.3) & (v <= cut_len - 0.3) & ~hand
    wrist = np.array([x0, y0]) - BENCH_WRIST_DEPTH * n + cut_len / 2 * t
    return {"leg_all": leg_all, "shoe": shoe, "toe": toe, "hidden": hidden, "hand": hand,
            "cuff": cuff, "ext": ext, "wrist": (float(wrist[0]), float(wrist[1]))}


def bench_layers(F: np.ndarray, A: np.ndarray, M: dict, k: int) -> dict:
    """Capas a tamano completo (k = 1 o 2) en float RGBA; las mascaras de M son de 1x."""
    up = (lambda m: m) if k == 1 else (lambda m: np.repeat(np.repeat(m, k, 0), k, 1))
    shoe, toe, hand, cuff = up(M["shoe"]), up(M["toe"]), up(M["hand"]), up(M["cuff"])
    hidden, ext = up(M["hidden"]), up(M["ext"])
    # a 2x el reescalado mezcla vecinos: la pierna del completo se toma con 3 px de margen
    keep_f = ndi.binary_dilation(M["leg_all"] & ~M["shoe"], iterations=3) & ~M["shoe"] & ~M["toe"]
    body = A.copy()
    body[up(keep_f)] = F[up(keep_f)]
    # el amputado deja un hueco transparente entre los nudillos y el otro brazo: en reposo lo
    # tapa la mano, pero al girar asomaria (y el rim lo pintaria de azul); se rellena de jersey
    opaque = body[..., 3] > 0
    lab, _ = ndi.label(ndi.binary_fill_holes(opaque) & ~opaque)
    ids = np.unique(lab[ndi.binary_dilation(up(M["hand"]), iterations=2 * k)])
    hole = np.isin(lab, ids[ids > 0])
    fill = hole | (ndi.binary_dilation(hole, iterations=k) & (body[..., 3] < 255))
    _nearest_fill(body, (body[..., 3] > 250) & ~fill, fill)
    body[fill, :3] = ndi.gaussian_filter(body[..., :3], (k, k, 0))[fill]
    # bajo el borde del zapato el cuerpo sigue opaco (calcetin y pata del banco): si no, al
    # reescalar, el fondo y el rim asomarian por la junta. Ni desde el suelo, que es lo que se
    # ve bajo la suela al levantar la punta, ni desde el zapato trasero (detras del talon hay
    # fondo)
    low = np.mgrid[0 : F.shape[0], 0 : F.shape[1]][0] < 428 * k
    src = (body[..., 3] > 250) & ~shoe & low & ~ndi.binary_dilation(toe, iterations=2 * k)
    band = shoe & low & ndi.binary_dilation(src, iterations=3 * k) & (F[..., 3] > 250)
    _nearest_fill(body, src, band)
    leg = np.zeros_like(F)
    leg[shoe] = F[shoe]
    _row_fill(leg, shoe & (F[..., 3] > 250) & ~hidden, hidden, 16 * k)
    toe_l = np.zeros_like(F)
    toe_l[toe] = A[toe]
    hand_l = np.zeros_like(F)
    hand_l[hand] = F[hand]
    _nearest_fill(hand_l, hand & (F[..., 3] > 250), ext)
    cuff_l = np.zeros_like(F)
    cuff_l[cuff] = F[cuff]
    # rim: el del cuerpo va horneado en el cuerpo; el zapato lleva solo lo que anade su
    # silueta al rim del dibujo en reposo, asi se mueve con el y en reposo suma lo mismo
    radius = 2 * k
    r_body = _rim_alpha(body[..., 3] > 8, radius)
    r_full = _rim_alpha((body[..., 3] > 8) | (leg[..., 3] > 8), radius)
    r_leg = np.clip((r_full - r_body) / np.maximum(1 - r_body, 1e-3), 0, 1)
    r_leg[leg[..., 3] > 250] = 0
    rim = np.zeros_like(F)
    rim[..., :3] = RIM
    rim[..., 3] = r_leg * 255
    leg_img = Image.fromarray(rim.astype(np.uint8), "RGBA")
    leg_img.alpha_composite(Image.fromarray(np.clip(leg, 0, 255).astype(np.uint8), "RGBA"))
    img = lambda a: Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGBA")  # noqa: E731
    return {"body": img(body), "leg": leg_img, "toe": img(toe_l), "hand": img(hand_l), "cuff": img(cuff_l)}


def build_bench() -> None:
    f1, a1 = rgba(OLD / BENCH_FULL), rgba(OLD / BENCH_AMP)
    F, A = np.array(f1, np.float32), np.array(a1, np.float32)
    M = bench_masks(F, A)
    L1 = bench_layers(F, A, M, 1)
    L2 = bench_layers(np.array(upscale2x(f1), np.float32), np.array(upscale2x(a1), np.float32), M, 2)
    save_webp(bake_rim(L1["body"], 2), "bench/body.webp", quality=92)
    save_webp(bake_rim(L2["body"], 4), "bench/body@2x.webp", quality=90)
    pivots = {"leg": BENCH_ANKLE, "hand": M["wrist"]}
    for name in ("leg", "toe", "hand", "cuff"):
        a = np.array(L1[name])[..., 3] > 0
        ys, xs = np.where(a)
        box = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
        save_webp(L1[name].crop(box), f"bench/{name}.webp", lossless=True)
        save_webp(L2[name].crop(tuple(2 * c for c in box)), f"bench/{name}@2x.webp", lossless=True)
        x, y, w, h = box[0], box[1], box[2] - box[0], box[3] - box[1]
        css = f"left: {x / 5:g}%; top: {20 + 0.16 * y:g}%; width: {w / 5:g}%;"
        if name in pivots:
            px, py = pivots[name]
            css += f" transform-origin: {100 * (px - x) / w:.1f}% {100 * (py - y) / h:.1f}%;"
        print(f"[bench] {name}: {w}x{h} en ({x},{y})  ->  {css}")


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
    # --only bench (o rig, hero, projects) regenera solo esa parte
    steps = {"rig": build_rig, "bench": build_bench, "hero": build_hero, "projects": build_projects}
    only = sys.argv[sys.argv.index("--only") + 1].split(",") if "--only" in sys.argv else list(steps)
    for name in only:
        steps[name]()
    total = sum(s for _, s in REPORT)
    print("\n--- salidas ---")
    for rel, size in REPORT:
        print(f"{size/1024:8.1f} KB  {rel}")
    print(f"{total/1024:8.1f} KB  TOTAL ({len(REPORT)} ficheros)")


if __name__ == "__main__":
    main()
