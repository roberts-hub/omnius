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
| Buy-link de Lemon Squeezy | `js/main.js`, constante `LEMON_URL` (usar el link `?embed=1&media=0`). Solo el botón del producto (`#cta-comprar`) abre el checkout; nav y hero anclan a `#bundle` |
| OG image / canonical al publicar | `index.html`, comentario `TODO al publicar` en el `<head>` |
| Precio y textos del producto | `index.html`, sección `#bundle` |
| Nombres y descriptores de LUTs | `index.html`, sección THE LUTS |
| Mostrar reviews | `index.html`, quitar `hidden` de `<section id="reviews">` |

## Imágenes antes/después

Los sliders usan placeholders (misma imagen con filtro CSS para simular el
"before"). Para poner frames reales, exportar JPGs y guardarlos como:

```
img/hero-before.jpg   img/hero-after.jpg    (comparador del hero, 21:9)
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
