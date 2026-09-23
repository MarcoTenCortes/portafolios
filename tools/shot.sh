#!/usr/bin/env bash
# Captura headless de una sección del sitio en desarrollo.
# Uso: tools/shot.sh <id-seccion> [ancho] [alto] [extra-query]   -> tools/out/shots/<id>-<ancho>.png
set -e
ID="${1:-inicio}"; W="${2:-1280}"; H="${3:-720}"; Q="${4:-}"
OUT="${SHOT_DIR:-tools/out/shots}"; mkdir -p "$OUT"
CHROME="${CHROME:-/c/Program Files/Google/Chrome/Application/chrome.exe}"
"$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
  --window-size="$W,$H" --virtual-time-budget=9000 \
  --screenshot="$OUT/$ID-$W.png" "http://localhost:5173/?shot=$ID$Q" >/dev/null 2>&1
echo "$OUT/$ID-$W.png"
