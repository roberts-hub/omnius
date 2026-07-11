# OMNIUS Landing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir la landing de venta OMNIUS (bundle PowerGrade + LUTs) lista para GitHub Pages, con checkout overlay de Lemon Squeezy.

**Architecture:** Página estática de un solo `index.html` con `css/estilo.css` y `js/main.js`, sin build ni dependencias. El mockup aprobado (`/private/tmp/claude-501/-Users-roberts-creative/733d7cf0-4bf6-47e1-bfdc-747f63d66777/scratchpad/omnius-mockup/index.html`) es la base visual: se porta separando HTML/CSS/JS y se aplican los deltas del spec (cascada en hero, FAQ nativo `<details>`, sliders accesibles por teclado, reviews oculta, reduced-motion, constante de buy-link).

**Tech Stack:** HTML5, CSS vanilla (custom properties), JS vanilla (Pointer Events, IntersectionObserver), lemon.js (checkout overlay), GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-07-11-omnius-landing-design.md`

**Verificación:** no hay framework de tests (página estática). Cada tarea se verifica sirviendo el sitio (`python3 -m http.server 4181` desde la raíz del repo) y comprobando en el navegador + consola limpia.

---

### Task 1: Escafolding del repo desde el mockup

**Files:**
- Create: `index.html` (HTML del mockup, sin `<style>` ni `<script>` inline)
- Create: `css/estilo.css` (todo el CSS del mockup)
- Create: `js/main.js` (todo el JS del mockup)
- Create: `README.md`
- Create: `img/luts/.gitkeep`

- [x] **Step 1: Portar el mockup separando responsabilidades.** Copiar del mockup: el `<style>` completo → `css/estilo.css`; el `<script>` final → `js/main.js`; el HTML restante → `index.html` con `<link rel="stylesheet" href="css/estilo.css">` y `<script src="js/main.js" defer></script>`. Mantener el `<script src="https://assets.lemonsqueezy.com/lemon.js" defer>` en el `<head>`.

- [x] **Step 2: README.md** con: qué es el proyecto, cómo previsualizar (`python3 -m http.server 4181`), convención de imágenes (`img/luts/0N-before.jpg`/`0N-after.jpg`, `img/hero-before.jpg`/`img/hero-after.jpg`), dónde cambiar el buy-link de Lemon Squeezy y el precio, y el workflow git (pull antes de editar, commit+push, nunca force-push).

- [x] **Step 3: Verificar** sirviendo el sitio: la página se ve idéntica al mockup, consola sin errores.

- [x] **Step 4: Commit** `git add -A && git commit -m "Escafolding: portar mockup aprobado a index/css/js"`

### Task 2: Deltas de HTML del spec

**Files:**
- Modify: `index.html`

- [x] **Step 1: Hero con cascada.** Envolver cada palabra del H1 en `<span class="palabra">` dentro de líneas `.intro-linea` (patrón del mastermind), p.ej.:

```html
<h1 class="hero-titulo">
  <span class="linea-cascada"><span class="palabra">Every</span> <span class="palabra">frame,</span></span>
  <span class="linea-cascada cursiva"><span class="palabra">graded</span> <span class="palabra">like</span> <span class="palabra">a</span> <span class="palabra">film.</span></span>
</h1>
```

- [x] **Step 2: FAQ nativo.** Reemplazar los `button.faq-q` + `div.faq-a` por:

```html
<details class="faq-item">
  <summary class="faq-q">Do I need DaVinci Resolve Studio? <span class="mas">+</span></summary>
  <div class="faq-a"><p>No. The system works with both the Free and Studio versions…</p></div>
</details>
```

- [x] **Step 3: Sección reviews oculta.** Insertar antes del FAQ una sección `#reviews` con `hidden` en el tag y 3 tarjetas placeholder de testimonio (estructura: cita, nombre, handle), más comentario HTML explicando que se muestra quitando `hidden` cuando existan testimonios reales.

- [x] **Step 4: Buy-link como constante visible.** El CTA queda `<a id="cta-comprar" class="btn-solido lemonsqueezy-button" href="TODO-LEMONSQUEEZY-URL">` y en `js/main.js` se define `const LEMON_URL = "TODO-LEMONSQUEEZY-URL"` aplicada a todos los `[data-comprar]` (nav, hero, producto) — un solo lugar para cambiarla. Ambos CTAs de nav y hero llevan `data-comprar` y ancla `#bundle` como fallback.

- [x] **Step 5: Lazy loading.** `loading="lazy"` en todas las imágenes salvo las del comparador hero. `alt` descriptivos.

- [x] **Step 6: Verificar** en navegador (estructura intacta, FAQ abre/cierra sin JS — probar con JS deshabilitado vía DevTools o quitando el script temporalmente).

- [x] **Step 7: Commit** `git commit -am "HTML: cascada hero, FAQ details, reviews oculta, buy-link centralizado, lazy loading"`

### Task 3: Deltas de CSS del spec

**Files:**
- Modify: `css/estilo.css`

- [x] **Step 1: Animación cascada** (calcada del mastermind):

```css
.linea-cascada { display: block; }
.linea-cascada .palabra {
  display: inline-block;
  opacity: 0;
  transform: translateY(0.7em);
  filter: blur(8px);
  animation: palabraEntra 0.9s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  animation-delay: var(--d, 0s);
}
@keyframes palabraEntra {
  to { opacity: 1; transform: translateY(0); filter: blur(0); }
}
```

- [x] **Step 2: Estilos para `<details>/<summary>`** replicando el acordeón: `summary::-webkit-details-marker {display:none}`, `.faq-item[open] .mas {transform: rotate(45deg)}`, animación de apertura con `grid-template-rows` o transición de opacidad (aceptable sin animar altura).

- [x] **Step 3: Estilos de reviews** (tarjetas con borde 1px greige 0.15, cita en lino, handle en mono greige).

- [x] **Step 4: prefers-reduced-motion:**

```css
@media (prefers-reduced-motion: reduce) {
  .linea-cascada .palabra { animation: none; opacity: 1; transform: none; filter: none; }
  .reveal { opacity: 1; transform: none; transition: none; }
  html { scroll-behavior: auto; }
}
```

- [x] **Step 5: Verificar** en navegador: cascada al cargar, FAQ con + rotando, activar reduced motion (DevTools → Rendering → Emulate CSS prefers-reduced-motion) y confirmar que todo es visible sin animación.

- [x] **Step 6: Commit** `git commit -am "CSS: cascada, details FAQ, reviews, reduced-motion"`

### Task 4: Deltas de JS del spec

**Files:**
- Modify: `js/main.js`

- [x] **Step 1: Delays de cascada** — asignar `--d` incremental por palabra al cargar:

```js
document.querySelectorAll(".linea-cascada").forEach((linea, li) => {
  linea.querySelectorAll(".palabra").forEach((p, pi) => {
    p.style.setProperty("--d", (li * 0.35 + pi * 0.12) + "s");
  });
});
```

- [x] **Step 2: Slider accesible por teclado** — el contenedor `[data-comparador]` recibe `tabindex="0"`, `role="slider"`, `aria-label="Before and after comparison"`, `aria-valuemin/max/now`, y keydown:

```js
comp.tabIndex = 0;
comp.setAttribute("role", "slider");
comp.setAttribute("aria-label", "Before and after comparison");
comp.setAttribute("aria-valuemin", "0");
comp.setAttribute("aria-valuemax", "100");
const setX = (pct) => {
  pct = Math.min(Math.max(pct, 0), 100);
  comp.style.setProperty("--x", pct + "%");
  comp.setAttribute("aria-valuenow", Math.round(pct));
};
comp.addEventListener("keydown", (e) => {
  const cur = parseFloat(comp.style.getPropertyValue("--x")) || 50;
  if (e.key === "ArrowLeft") { setX(cur - 5); e.preventDefault(); }
  if (e.key === "ArrowRight") { setX(cur + 5); e.preventDefault(); }
});
```

(refactorizar el handler de pointer para usar `setX` también)

- [x] **Step 3: Quitar el JS del FAQ** (ya es nativo con `<details>`).

- [x] **Step 4: Constante `LEMON_URL`** al inicio del archivo con comentario `// TODO: reemplazar con el buy-link real de la tienda Lemon Squeezy (?embed=1&media=0)`, aplicada: `document.querySelectorAll("[data-comprar]").forEach(a => { if (!LEMON_URL.startsWith("TODO")) a.href = LEMON_URL; });` — si sigue en TODO, los CTAs quedan con su ancla `#bundle`.

- [x] **Step 5: Verificar** en navegador: Tab enfoca cada slider, flechas lo mueven; drag sigue funcionando; FAQ funciona; consola limpia.

- [x] **Step 6: Commit** `git commit -am "JS: cascada, sliders accesibles, buy-link centralizado"`

### Task 5: Verificación integral (criterios de aceptación)

- [x] **Step 1: Desktop** — recorrer toda la página, consola sin errores, todos los reveals disparan.
- [x] **Step 2: Móvil 375px** — resize, verificar grids colapsan a 1 columna, sliders usables con touch, tipografía legible.
- [x] **Step 3: Overlay Lemon Squeezy** — con una URL demo temporal, click abre overlay encima de la página; restaurar placeholder después.
- [x] **Step 4: Reviews oculta** — confirmar que no se renderiza pero existe en el DOM.
- [x] **Step 5: Commit final** de ajustes si los hubo.

### Task 6: Revisión general (pedida por el usuario)

- [x] **Step 1:** Ejecutar la skill de code-review sobre el repo para detectar bugs/inconsistencias/mejoras.
- [x] **Step 2:** Aplicar los hallazgos razonables, re-verificar en navegador, commit.

### Task 7: Publicación en GitHub Pages

- [ ] **Step 1:** `gh repo create` (cuenta de Roberto, público) + `git push -u origin main`. Si `gh` no está autenticado, dar instrucciones al usuario.
- [ ] **Step 2:** Activar Pages (branch `main`, root) vía `gh api`.
- [ ] **Step 3:** Verificar la URL pública renderiza correctamente.
