# OMNIUS — Cinematic Color System

Landing de venta del bundle digital **OMNIUS** (PowerGrade de DaVinci Resolve +
LUTs firmados + tutoriales) de Roberto Arechederra. Página estática sin build,
publicada con GitHub Pages.

## Previsualizar en local

```bash
python3 -m http.server 4181
# abrir http://localhost:4181
```

## Dónde cambiar las cosas

| Qué | Dónde |
|---|---|
| Buy-link de Lemon Squeezy | `js/main.js`, constante `LEMON_URL` (usar el link `?embed=1&media=0`). El botón `#cta-comprar` de `producto.html` abre el checkout encima de la página; los botones de la principal llevan a `producto.html` |
| OG image / canonical al publicar | `index.html`, comentario `TODO al publicar` en el `<head>` |
| Precio, checklist y textos del producto | `producto.html` (página de compra). El precio también aparece en los botones "GET OMNIUS — $79" de `index.html` |
| Frase de la intro | `index.html`, las `.intro-linea` dentro de `#loader` |
| Ritmo de la intro | `js/main.js`, `PASO` (ms por icono) y `SOSTENER_MARCA` (cuánto se queda la marca OMNIUS antes de disolverse) |
| Video del hero | Correr `herramientas/video-hero.sh "/ruta/al/video.mov"`: genera 1080p y vertical (para celular), cada uno en HEVC (principal) y H.264 (respaldo), más el poster, en `video/`. Usa solo herramientas de macOS (Swift/AVFoundation). Fuente ideal: 4K, 10–15 s |
| Nombres de los sliders | `index.html`, sección `#looks`  |
| Crédito de cámara por LUT | `index.html`, `.tag.camara` de cada slider: escribir la cámara y quitar `hidden` |
| Collage de tomas | `index.html`, `.introducing-tiras` (5 imágenes; se puede cambiar por un `<video>` del reel) |
| Reseñas | `index.html`, sección `#reviews` (carrusel estilo Pordoi). **Oculta**: las tarjetas actuales son ejemplos inventados solo para ver el diseño. Reemplazar cada `.resena` por una reseña real (nombre, país, título, texto) y quitar `hidden` |

La intro (frase + iconos) solo se muestra en la primera visita de cada sesión
del navegador. Para volver a verla: abrir una pestaña nueva o privada.

## Imágenes antes/después

Los 8 sliders usan `img/looks/NN-antes-{1920,1200}.jpg` y `NN-despues-{1920,1200}.jpg`
(recorte 2:1 del still 4K; el navegador elige 1920 o 1200 según la pantalla).
Para reemplazar uno, exportar el still desde Resolve y generar ambos tamaños:

```bash
sips -c 1920 3840 still.jpg --out /tmp/c.jpg            # recorte 2:1 centrado (desde 3840x2160)
sips -Z 1920 -s formatOptions 80 /tmp/c.jpg --out img/looks/01-despues-1920.jpg
sips -Z 1200 -s formatOptions 78 /tmp/c.jpg --out img/looks/01-despues-1200.jpg
```

Nombres y títulos de cada slider: `index.html`, sección `#looks` (`POWERGRADE // 0N` + nombre).
El collage (`reel-0N*.jpg`) sale de los mismos stills gradeados. La tira inferior de la portada en `producto.html` es `img/portada-barras.jpg`.

## Caché del navegador

`index.html` carga `css/estilo.css?v=…` y `js/main.js?v=…`. Al cambiar el CSS o el JS,
actualizar ese número (p. ej. fecha y hora) para que los visitantes no vean la versión vieja en caché.

## Workflow git (dos Macs)

1. `git pull` **antes** de editar.
2. Commit + push al terminar la sesión.
3. Nunca `push --force`.

## Docs

- Spec de diseño: `docs/superpowers/specs/2026-07-11-omnius-landing-design.md`
- Plan de implementación: `docs/superpowers/plans/2026-07-11-omnius-landing.md`
