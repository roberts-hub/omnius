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
| Buy-link de Lemon Squeezy | `js/main.js`, constante `LEMON_URL` (usar el link `?embed=1&media=0`). Solo el botón del producto (`#cta-comprar`) abre el checkout; el resto de los CTAs anclan a `#comprar` |
| OG image / canonical al publicar | `index.html`, comentario `TODO al publicar` en el `<head>` |
| Precio, checklist y textos del producto | `index.html`, sección `#comprar` (precio también en el header y en el botón bajo los LUTs) |
| Frase de la intro | `index.html`, las `.intro-linea` dentro de `#loader` |
| Ritmo de la intro | `js/main.js`, `PASO` (ms por icono) y `SOSTENER_MARCA` (cuánto se queda la marca OMNIUS antes de disolverse) |
| Video del hero | Guardar como `video/hero.mp4` (+ opcional `video/hero.webm`) y descomentar las `<source>` en `.hero-video`. Specs: 1920×1080, H.264, sin audio, loop de 6–15 s, idealmente < 8 MB. El `poster` es la imagen que se ve mientras carga |
| Nombres y descriptores de LUTs | `index.html`, sección `#looks` (y las franjas `.tira` de la portada) |
| Crédito de cámara por LUT | `index.html`, `.tag.camara` de cada slider: escribir la cámara y quitar `hidden` |
| Franja INTRODUCING | `index.html`, `.introducing-tiras` (5 imágenes; se puede cambiar por un `<video>` del reel) |
| Mostrar reviews | `index.html`, quitar `hidden` de `<section id="reviews">` |

La intro (frase + iconos) solo se muestra en la primera visita de cada sesión
del navegador. Para volver a verla: abrir una pestaña nueva o privada.

## Imágenes antes/después

Los sliders usan placeholders (misma imagen con filtro CSS para simular el
"before"). Para poner frames reales, exportar JPGs y guardarlos como:

```
img/luts/01-before.jpg  img/luts/01-after.jpg   (16:9, uno por LUT)
img/luts/02-before.jpg  img/luts/02-after.jpg
...
```

y actualizar los `src` de cada `[data-comparador]` en `index.html`
(dos `<img>` por slider: `.antes` y `.despues`). Al usar imágenes reales,
**quitar la clase `simulado`** de ese comparador en el HTML (esa clase aplica
un filtro CSS que finge el "before" mientras haya placeholders).

## Workflow git (dos Macs)

1. `git pull` **antes** de editar.
2. Commit + push al terminar la sesión.
3. Nunca `push --force`.

## Docs

- Spec de diseño: `docs/superpowers/specs/2026-07-11-omnius-landing-design.md`
- Plan de implementación: `docs/superpowers/plans/2026-07-11-omnius-landing.md`
