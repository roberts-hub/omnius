#!/bin/zsh
# Convierte un video (idealmente 4K) en las 4 versiones del hero + poster.
# Uso: herramientas/video-hero.sh "/ruta/al/video.mov"
set -e
IN="$1"
[ -f "$IN" ] || { echo "uso: herramientas/video-hero.sh /ruta/al/video.mov"; exit 1; }
cd "$(dirname "$0")"
TMP=$(mktemp -d)
swiftc -O encode.swift -o "$TMP/encode" 2>/dev/null
swiftc -O frame.swift -o "$TMP/frame" 2>/dev/null
cd ../video
"$TMP/encode" "$IN" hero-1080.hevc.mp4     hevc 1920 1080 5000000
"$TMP/encode" "$IN" hero-1080.h264.mp4     h264 1920 1080 7000000
"$TMP/encode" "$IN" hero-vertical.hevc.mp4 hevc 1080 1920 4500000
"$TMP/encode" "$IN" hero-vertical.h264.mp4 h264 1080 1920 6000000
"$TMP/frame" hero-1080.hevc.mp4 2 "$TMP/poster.jpg" >/dev/null
sips -Z 1600 -s format jpeg -s formatOptions 65 "$TMP/poster.jpg" --out hero-poster.jpg >/dev/null
rm -rf "$TMP"
echo "Listo. Revisa el poster (segundo 2 del video) y publica."
