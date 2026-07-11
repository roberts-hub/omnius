# OMNIUS — Landing page de venta (spec de diseño)

**Fecha:** 2026-07-11
**Estado:** aprobado por Roberto (estructura + Lemon Squeezy)

## Qué es

Landing page de una sola página, en inglés, para vender **OMNIUS**: un bundle
digital para filmmakers (PowerGrade de DaVinci Resolve + 4 LUTs firmados +
tutoriales en video + footage de práctica). Marca personal de Roberto
Arechederra (@robert.arre) usando la identidad visual Two Waves del landing
del mastermind.

**Referencias aprobadas:**
- Diseño/estructura: chemabal.com/shop (modo oscuro, hero + producto + how it works + FAQ)
- Preview antes/después: reilinjoey.com/secretsauce (sliders interactivos por LUT)
- Identidad visual: mastermind-twowaves (tokens, tipografía, botones, animaciones)
- Mockup aprobado: scratchpad `omnius-mockup/index.html` (sirve como base visual)

## Stack y hosting

- HTML/CSS/JS vanilla, **sin build ni dependencias** (mismo patrón que mastermind-twowaves).
- Estructura: `index.html`, `css/estilo.css`, `js/main.js`, `img/luts/`.
- Repo `omnius` en GitHub (cuenta de Roberto), deploy con GitHub Pages desde `main`.
- Workflow git: pull antes de editar, commit+push al terminar, nunca force-push (dos Macs).

## Identidad visual (tokens exactos del mastermind)

```css
--fondo: #0e0e0d;   --hueso: #eae0c5;  --greige: #b0a595;
--lino: #e5e0d5;    --rojo: #c0392b;
--mono: "IBM Plex Mono"; --sans: "Archivo";
```

- Titulares: Archivo bold, letter-spacing -0.05em, itálica light greige para contraste.
- Labels/badges/números: IBM Plex Mono, tracking ancho (0.2–0.4em).
- Rojo #c0392b solo como acento: precios/descuento, números de paso, checks, bordes LUT.
- Botón-línea (borde inferior + flecha →) para CTAs secundarios; botón sólido hueso
  para el CTA de compra.
- Scroll-reveals sobrios (IntersectionObserver). **Sin pantalla de carga** (mata conversión).

## Estructura de la página

1. **Nav sticky** — wordmark OMNIUS + "GET THE BUNDLE" (ancla a #bundle).
2. **Hero** — badge `CINEMATIC COLOR SYSTEM // DAVINCI RESOLVE`, H1 "Every frame,
   graded like a film." con cascada por palabra al cargar, subhead, botón-línea,
   nota mono `INSTANT DOWNLOAD // WORKS WITH RESOLVE FREE & STUDIO`.
3. **Comparador hero** — slider antes/después full-width 21:9.
4. **Producto (#bundle)** — tarjeta 2 columnas: visual del bundle + info
   (label rojo, "The Omnius Bundle", precio actual/tachado/tag descuento,
   bullets con check, **botón Lemon Squeezy**, nota de checkout seguro).
5. **THE LUTS** — intro + 4 bloques, cada uno: `LUT // 0N` (borde rojo), nombre
   grande, slider 16:9 interactivo, descriptor mono (`DEEP TEALS // CLEAN SKIN // ...`).
   Nombres v1: UNDERTOW, MAGIC HOUR, SALTWATER, LOW TIDE (ajustables).
   La sección acepta N LUTs sin cambiar CSS.
6. **HOW IT WORKS** — grid 2×2: 01 LEARN / 02 APPLY / 03 REFINE / 04 CREATE.
7. **WHAT'S INSIDE** — grid 2×2: THE POWERGRADE / THE LUTS / THE TUTORIALS / THE EXTRAS.
8. **REVIEWS** — maquetada pero **oculta** (display:none) hasta tener testimonios reales.
9. **FAQ** — acordeón (+ rota a ×): Resolve Free/Studio, cámaras, Log, entrega.
10. **Footer** — OMNIUS / @ROBERT.ARRE / contacto / © Roberto Arechederra.

## Slider antes/después (componente clave)

- Dos `<img>` apiladas; la de "before" se recorta con `clip-path: inset(0 calc(100% - var(--x)) 0 0)`.
- Línea vertical + handle circular en `--x`; etiquetas BEFORE (izq) / AFTER (der).
- Pointer events (mouse + touch, `touch-action: none`), sin librerías.
- Accesible: el handle responde también a flechas del teclado (tabindex + keydown).
- Marcado repetible `[data-comparador]`; un solo bloque JS inicializa todos.

## Pagos: Lemon Squeezy (decidido)

- **Por qué:** merchant of record (cobra IVA/impuestos globales por ti), entrega
  los archivos automáticamente, checkout overlay embebido idéntico al de la
  referencia, y **México está en su lista de payouts bancarios**. Fee ~5% + $0.50.
  (Gumroad descartado: sin PayPal ni banco MX. Contexto: Stripe compró LS;
  migración futura a Stripe Managed Payments será directa.)
- **Integración:** `<script src="https://assets.lemonsqueezy.com/lemon.js" defer>`
  + CTA `<a class="lemonsqueezy-button" href="https://TIENDA.lemonsqueezy.com/checkout/buy/UUID?embed=1&media=0">`.
  El overlay se abre encima de la página. Verificado funcionando en el mockup.
- **Pendiente de Roberto:** crear cuenta/tienda LS, subir archivos del producto,
  pasar el buy-link real. Hasta entonces el href queda en una constante
  placeholder claramente marcada (`TODO-LEMONSQUEEZY-URL`).

## Assets

- Imágenes antes/después aún no exportadas. Placeholders: misma imagen por slider,
  lado "before" simulado con filtro CSS (`saturate(.45) contrast(.82) brightness(1.08)`).
- Convención para reemplazo sin tocar código: `img/luts/0N-before.jpg` y
  `img/luts/0N-after.jpg` (+ `img/hero-before.jpg`, `img/hero-after.jpg`).
  Al existir archivos reales se quita el filtro CSS de simulación.
- Copy y precio ($79 / $119 tachado) son provisionales; Roberto define el precio
  final en Lemon Squeezy antes de publicar.

## Manejo de errores / bordes

- Si lemon.js no carga (bloqueadores), el CTA sigue siendo un `<a>` normal al
  checkout hosted de LS — el pago nunca se rompe, solo pierde el overlay.
- Imágenes con `loading="lazy"` salvo el comparador hero.
- Sin JS: la página sigue siendo legible y comprable — el contenido crítico
  (producto, precio, CTA de compra) no depende de JS. Los sliders quedan fijos
  al 50% (valor por defecto de `--x`) y el FAQ se implementa con
  `<details>/<summary>` nativos estilizados, que funcionan sin JS.
- `prefers-reduced-motion`: desactivar cascada y reveals.

## Criterios de aceptación

1. La página completa renderiza con los tokens Two Waves en desktop y móvil (375px).
2. Los 5 comparadores (hero + 4 LUTs) responden a mouse, touch y teclado.
3. El botón de compra abre el overlay de Lemon Squeezy (con URL demo hasta
   tener la tienda real).
4. FAQ acordeón funciona; reviews existe oculta; sin errores de consola.
5. Publicada en GitHub Pages con el mismo workflow que el mastermind.
