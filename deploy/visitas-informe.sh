#!/bin/sh
# Informe de visitas de portafolios.mtcor.es con GoAccess. Lee el registro que escribe el nginx del host
# (deploy/host-nginx/portafolios-visitas.conf): el log actual y los rotados por logrotate (.1, .2.gz...).
#
#   sudo sh visitas-informe.sh                 # escribe /opt/portafolios/informe-visitas.html y termina
#   sudo sh visitas-informe.sh --tiempo-real   # el mismo informe, en vivo por WebSocket en 127.0.0.1:7890
#
# El HTML no se publica: se copia con scp y se abre en local. En tiempo real hace falta ademas un tunel
# (ssh -N -L 7890:127.0.0.1:7890 servidor) para que el HTML abierto en local reciba las visitas nuevas.
# Necesita root (o el grupo adm) para leer /var/log/nginx.
#
# Variables: LOG (registro), INFORME (HTML de salida), PUERTO (tiempo real) y GEOIP (base GeoLite2-Country
# .mmdb para ver el pais; sin ella se usa /opt/portafolios/GeoLite2-Country.mmdb si existe).
set -eu

LOG="${LOG:-/var/log/nginx/portafolios.visitas.log}"
INFORME="${INFORME:-/opt/portafolios/informe-visitas.html}"
PUERTO="${PUERTO:-7890}"
GEOIP="${GEOIP:-}"

fallo() {
  echo "visitas-informe: $*" >&2
  exit 1
}

uso() {
  echo "Uso: sh $0 [--tiempo-real]   (variables: LOG, INFORME, PUERTO, GEOIP)"
}

TIEMPO_REAL=0
[ $# -le 1 ] || { uso >&2; exit 2; }
case "${1:-}" in
  "") ;;
  --tiempo-real) TIEMPO_REAL=1 ;;
  -h | --help | --ayuda) uso; exit 0 ;;
  *) uso >&2; exit 2 ;;
esac

command -v goaccess >/dev/null 2>&1 || fallo "falta goaccess: sudo apt install -y goaccess"
[ -e "$LOG" ] || fallo "no existe $LOG: falta activar el registro en el nginx del host (README, Registro de visitas)"
[ -r "$LOG" ] || fallo "sin permiso para leer $LOG: lanzalo con sudo"
[ -d "$(dirname -- "$INFORME")" ] || fallo "no existe la carpeta de $INFORME (cambiala con INFORME=...)"
if [ -n "$GEOIP" ]; then
  [ -r "$GEOIP" ] || fallo "no se puede leer GEOIP=$GEOIP"
elif [ -r /opt/portafolios/GeoLite2-Country.mmdb ]; then
  GEOIP=/opt/portafolios/GeoLite2-Country.mmdb
fi

# La app de LinkedIn en iPhone se anuncia como "[LinkedInApp]" (sin "Safari/") y GoAccess la tomaria por
# LinkedInBot y la quitaria con --ignore-crawlers. Esta lista propia, que GoAccess mira antes que la suya, la
# deja como navegador. Va en un temporal para que el script siga siendo un solo fichero.
NAVEGADORES=$(mktemp)
trap 'rm -f "$NAVEGADORES"' EXIT
trap 'exit 130' INT TERM
printf 'LinkedInApp\tLinkedIn\n' >"$NAVEGADORES"

# POSIX sh no tiene arrays: los argumentos de GoAccess se montan en los parametros posicionales.
set -- --no-global-config \
  --log-format '%h %^[%d:%t %^] "%r" %s %b "%R" "%u" "%^"' --date-format '%d/%b/%Y' --time-format '%H:%M:%S' \
  --ignore-crawlers --browsers-file "$NAVEGADORES" --no-query-string \
  --html-report-title 'Visitas de portafolios.mtcor.es' -o "$INFORME"
[ -z "$GEOIP" ] || set -- "$@" --geoip-database "$GEOIP"
if [ "$TIEMPO_REAL" = 1 ]; then
  set -- "$@" --real-time-html --addr 127.0.0.1 --port "$PUERTO"
  echo "Tiempo real en 127.0.0.1:$PUERTO (Ctrl+C para terminar). Desde tu equipo:"
  echo "  ssh -N -L $PUERTO:127.0.0.1:$PUERTO usuario@servidor"
  echo "  scp usuario@servidor:$INFORME .   # y abre el HTML en el navegador"
fi

# Los rotados entran por la tuberia (zcat -f lee igual el .1 sin comprimir que los .gz) y el actual va como
# fichero: en tiempo real GoAccess lo sigue leyendo a medida que nginx escribe.
rotados() {
  for f in "$LOG".*; do
    if [ -e "$f" ]; then zcat -f -- "$f"; fi
  done
}

rotados | goaccess "$LOG" - "$@"
[ "$TIEMPO_REAL" = 1 ] || echo "Informe: $INFORME (copialo con: scp usuario@servidor:$INFORME .)"
