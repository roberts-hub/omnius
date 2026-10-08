// ══════════ OMNIUS — main.js ══════════

// TODO: reemplazar con el buy-link real de la tienda Lemon Squeezy,
// formato: https://TIENDA.lemonsqueezy.com/checkout/buy/UUID?embed=1&media=0
const LEMON_URL = "TODO-LEMONSQUEEZY-URL";

// ── CTA de compra ──
// Solo el botón del producto compra; el resto de los CTAs anclan a #comprar.
// Mientras LEMON_URL sea placeholder, el botón conserva su ancla y NO lleva la
// clase lemonsqueezy-button (evita que lemon.js intercepte el clic sin URL real).
if (!LEMON_URL.startsWith("TODO")) {
  const cta = document.getElementById("cta-comprar");
  cta.href = LEMON_URL;
  cta.classList.add("lemonsqueezy-button");
}

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ── INTRO: frase palabra por palabra → iconos rápidos → sitio (estilo mastermind) ──
// Solo en la primera visita de la sesión; se puede saltar con clic, tecla o el botón SKIP.
const loader = document.getElementById("loader");
const intro = loader.querySelector(".loader-intro");
const glyphs = loader.querySelectorAll(".glyph");
const lineas = [...intro.querySelectorAll(".intro-linea")];
const PASO = 360; // ms por icono (se funden uno en otro)
const SOSTENER_MARCA = 750; // la marca OMNIUS se queda un momento antes de disolverse
const timers = [];
const despues = (ms, fn) => timers.push(setTimeout(fn, ms));

let yaVisto = false;
try { yaVisto = sessionStorage.getItem("omnius-intro") === "1"; } catch (e) {}

// el loader se disuelve mientras el video "enfoca"; el contenido del hero entra al final
const cerrarIntro = () => {
  timers.forEach(clearTimeout);
  loader.classList.add("fuera");
  document.body.classList.remove("cargando");
  try { sessionStorage.setItem("omnius-intro", "1"); } catch (e) {}
  setTimeout(() => document.body.classList.add("listo"), 1100);
  setTimeout(() => loader.remove(), 2000);
};

if (reduceMotion || yaVisto) {
  loader.remove();
  requestAnimationFrame(() => document.body.classList.add("listo"));
} else {
  document.body.classList.add("cargando");

  // separa cada línea en palabras con delay en cascada (relativo a su línea)
  lineas.forEach((linea) => {
    const palabras = linea.textContent.trim().split(/\s+/);
    linea.textContent = "";
    palabras.forEach((palabra, i) => {
      const span = document.createElement("span");
      span.className = "palabra";
      span.textContent = palabra;
      span.style.setProperty("--d", i * 0.09 + "s");
      linea.appendChild(span);
    });
  });

  // las líneas entran una tras otra y se quedan apiladas
  let t = 300;
  lineas.forEach((linea) => {
    despues(t, () => linea.classList.add("activa"));
    t += linea.children.length * 90 + 450;
  });

  // la frase se desvanece y los iconos se funden uno en otro
  t += 1000;
  despues(t, () => {
    intro.classList.add("fuera");
    loader.classList.add("fase-iconos");
  });
  glyphs.forEach((g, i) => {
    despues(t + 500 + i * PASO, () => {
      glyphs.forEach((x) => x.classList.remove("activo"));
      g.classList.add("activo");
    });
  });
  despues(t + 500 + (glyphs.length - 1) * PASO + SOSTENER_MARCA, cerrarIntro);

  loader.addEventListener("click", cerrarIntro, { once: true });
  document.addEventListener("keydown", function saltarConTecla() {
    if (document.body.classList.contains("cargando")) cerrarIntro();
    document.removeEventListener("keydown", saltarConTecla);
  });
}

// ── header: transparente sobre el video, sólido al pasar el hero ──
const cabecera = document.querySelector(".cabecera");
const heroVideo = document.querySelector(".hero-video");
new IntersectionObserver(
  ([e]) => cabecera.classList.toggle("solida", !e.isIntersecting),
  { rootMargin: "-80px 0px 0px 0px" }
).observe(heroVideo);

// ── comparadores antes/después (drag + touch + teclado) ──
document.querySelectorAll("[data-comparador]").forEach((comp) => {
  const setX = (pct) => {
    pct = Math.min(Math.max(pct, 0), 100);
    comp.style.setProperty("--x", pct + "%");
    comp.setAttribute("aria-valuenow", Math.round(pct));
    comp.setAttribute("aria-valuetext", Math.round(pct) + "% before, rest graded");
  };

  comp.tabIndex = 0;
  comp.setAttribute("role", "slider");
  comp.setAttribute("aria-label", "Before and after comparison");
  comp.setAttribute("aria-valuemin", "0");
  comp.setAttribute("aria-valuemax", "100");
  setX(50);

  const moverA = (clientX) => {
    const r = comp.getBoundingClientRect();
    setX(((clientX - r.left) / r.width) * 100);
  };

  comp.addEventListener("pointerdown", (e) => {
    comp.setPointerCapture(e.pointerId);
    moverA(e.clientX);
    const onMove = (ev) => moverA(ev.clientX);
    const fin = () => {
      comp.removeEventListener("pointermove", onMove);
      comp.removeEventListener("pointerup", fin);
      comp.removeEventListener("pointercancel", fin);
    };
    comp.addEventListener("pointermove", onMove);
    comp.addEventListener("pointerup", fin);
    comp.addEventListener("pointercancel", fin);
  });

  comp.addEventListener("keydown", (e) => {
    let cur = parseFloat(comp.style.getPropertyValue("--x"));
    if (Number.isNaN(cur)) cur = 50;
    if (e.key === "ArrowLeft") { setX(cur - 5); e.preventDefault(); }
    if (e.key === "ArrowRight") { setX(cur + 5); e.preventDefault(); }
  });
});

// ── reveal on scroll ──
if (reduceMotion) {
  document.querySelectorAll(".reveal").forEach((el) => el.classList.add("visto"));
} else {
  const obs = new IntersectionObserver(
    (entries) => entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add("visto");
        obs.unobserve(e.target);
      }
    }),
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
  );
  document.querySelectorAll(".reveal").forEach((el) => obs.observe(el));
}
