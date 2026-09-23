#!/usr/bin/env python3
"""Sincroniza el texto por defecto (ES) de index.html con src/i18n/es.json para que la
página sin JavaScript muestre exactamente el mismo copy. También comprueba que todas las
claves usadas en el HTML existen en ambos diccionarios y lista las claves no usadas.

Uso: python tools/sync-html-i18n.py [--check]
"""
import html as htmlmod
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
ES = json.loads((ROOT / "src/i18n/es.json").read_text(encoding="utf-8"))
EN = json.loads((ROOT / "src/i18n/en.json").read_text(encoding="utf-8"))

text = HTML.read_text(encoding="utf-8")
check = "--check" in sys.argv

# claves usadas
used = set(re.findall(r'data-i18n="([^"]+)"', text))
for attrs in re.findall(r'data-i18n-attr="([^"]+)"', text):
    for pair in attrs.split(";"):
        if ":" in pair:
            used.add(pair.split(":", 1)[1].strip())
missing_es = sorted(k for k in used if k not in ES)
missing_en = sorted(k for k in used if k not in EN)
# las fichas de proyecto (src/partials/projects/*.html) usan projects.detail.* y projects.<id>.detail.*: no están en index.html
unused = sorted(k for k in ES if k not in used and not k.startswith("coffee.status") and not k.startswith("play.dog.status")
                and not k.startswith("projects.detail.") and not (k.startswith("projects.") and ".detail." in k) and k not in {
    "coffee.counter", "coffee.key_tap", "coffee.key_click", "hero.cta_cv", "hero.cv_href", "contact.copied",
    "a11y.menu_close", "coffee.reset_short", "press.url", "hero.lamp.off",
    "play.dog.counter", "play.dog.peek_toast", "play.marker.pick_hint", "play.marker.pick_hint_touch"})
if missing_es or missing_en:
    print("Claves usadas en el HTML que faltan:", missing_es, missing_en)
    sys.exit(1)
if unused:
    print("Claves definidas pero no usadas en el HTML:", unused)

# sustituir texto de elementos hoja: <tag ... data-i18n="clave" ...>TEXTO</tag>
pattern = re.compile(r'(<(\w+)\b[^>]*\bdata-i18n="([^"]+)"[^>]*>)(.*?)(</\2>)', re.S)
changed = 0


def sub(m: re.Match) -> str:
    global changed
    open_tag, _tag, key, inner, close_tag = m.groups()
    if "<" in inner:  # no es hoja
        return m.group(0)
    new_inner = htmlmod.escape(ES[key], quote=False)
    if new_inner != inner:
        changed += 1
    return f"{open_tag}{new_inner}{close_tag}"


new_text = pattern.sub(sub, text)

# atributos con data-i18n-attr (solo content/alt/aria-label; href se deja al JS salvo press.url)
attr_pattern = re.compile(r'<[^>]*\bdata-i18n-attr="([^"]+)"[^>]*>')


def sub_attrs(m: re.Match) -> str:
    global changed
    tag = m.group(0)
    for pair in m.group(1).split(";"):
        if ":" not in pair:
            continue
        attr, key = (s.strip() for s in pair.split(":", 1))
        if attr not in {"content", "alt", "aria-label"}:
            continue
        value = htmlmod.escape(ES[key], quote=True)
        new_tag, n = re.subn(rf'\b{attr}="[^"]*"', f'{attr}="{value}"', tag, count=1)
        if n and new_tag != tag:
            changed += 1
            tag = new_tag
    return tag


new_text = attr_pattern.sub(sub_attrs, new_text)

if check:
    print(f"{changed} diferencias entre index.html y es.json")
    sys.exit(1 if changed else 0)
if new_text != text:
    HTML.write_text(new_text, encoding="utf-8")
print(f"index.html sincronizado: {changed} textos actualizados, {len(used)} claves usadas")
