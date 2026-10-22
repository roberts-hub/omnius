#!/bin/bash
# SPECTRE · conecta los respaldos a Google Drive con TU propia app de Google (en vez de la compartida de rclone,
# que Google va a cortar). Lee el Client ID y secret de privado/google-oauth-cliente.json (o los pide sin mostrarlos), los guarda en privado/rclone.conf
# y vuelve a pedir permiso en el navegador (elige roberto@arechederra.com).
# Uso: bash herramientas/drive-cliente-propio.sh
set -euo pipefail
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
RCLONE="$HOME/respaldo-grads-2026/rclone"; CONF="$RAIZ/privado/rclone.conf"
JSON="$RAIZ/privado/google-oauth-cliente.json"   # lo descarga Google Cloud → Clientes → "Descargar JSON"
if [ -s "$JSON" ]; then
  ID=$(python3 -I -c 'import json,sys;d=json.load(open(sys.argv[1]));print(list(d.values())[0]["client_id"])' "$JSON")
  SECRETO=$(python3 -I -c 'import json,sys;d=json.load(open(sys.argv[1]));print(list(d.values())[0]["client_secret"])' "$JSON")
else
  echo "Pega el Client ID (termina en .apps.googleusercontent.com) y presiona Enter:"
  read -rs ID; echo
  echo "Pega el Client secret y presiona Enter:"
  read -rs SECRETO; echo
fi
[[ "$ID" == *.apps.googleusercontent.com ]] || { echo "✗ Eso no parece un Client ID de Google."; exit 1; }
[ ${#SECRETO} -ge 20 ] || { echo "✗ El Client secret parece incompleto."; exit 1; }
"$RCLONE" config update spectre-drive client_id "$ID" client_secret "$SECRETO" --config "$CONF" >/dev/null
unset ID SECRETO
chmod 600 "$CONF"
echo "Ahora se abre Chrome: elige roberto@arechederra.com y acepta."
"$RCLONE" config reconnect spectre-drive: --config "$CONF" --auto-confirm
"$RCLONE" lsf "spectre-drive:DMG cifrados" --config "$CONF" >/dev/null && echo "✓ LISTO: los respaldos ya usan tu propia conexión de Google"
