#!/usr/bin/env bash
# Despliegue con rsync (WSL / Git Bash / Linux / macOS).
# Uso: tools/deploy.example.sh usuario@servidor:/var/www/portafolios
set -euo pipefail
TARGET="${1:?Uso: $0 usuario@servidor:/ruta/document-root}"
cd "$(dirname "$0")/.."
npm run build
rsync -avz --delete dist/ "$TARGET/"
echo "Desplegado en $TARGET"
