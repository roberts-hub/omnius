#!/bin/bash
# Uso: herramientas/avatar-instagram.sh <usuario>
# Descarga la foto de perfil pública de Instagram a img/resenas/<usuario>.jpg
# (los links de fotos de Instagram caducan; por eso se guarda una copia en el sitio).
set -euo pipefail
u="${1#@}"
cd "$(dirname "$0")/.."
img=$(curl -sL -m 30 -A "facebookexternalhit/1.1" "https://www.instagram.com/$u/" \
  | grep -o '<meta property="og:image" content="[^"]*"' | sed 's/.*content="//; s/"$//; s/&amp;/\&/g')
[ -n "$img" ] || { echo "No encontré la foto de @$u"; exit 1; }
curl -sL -m 30 -o "img/resenas/$u.jpg" "$img"
echo "Listo: img/resenas/$u.jpg ($(sips -g pixelWidth "img/resenas/$u.jpg" | awk '/pixelWidth/{print $2}')px)"
