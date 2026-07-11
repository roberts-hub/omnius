// ══════════ OMNIUS — main.js ══════════

// TODO: reemplazar con el buy-link real de la tienda Lemon Squeezy,
// formato: https://TIENDA.lemonsqueezy.com/checkout/buy/UUID?embed=1&media=0
const LEMON_URL = "TODO-LEMONSQUEEZY-URL";

// ── CTAs de compra: un solo lugar para el link ──
// Mientras LEMON_URL sea placeholder, los CTAs conservan su ancla #bundle.
if (!LEMON_URL.startsWith("TODO")) {
  document.querySelectorAll("[data-comprar]").forEach((a) => {
    a.href = LEMON_URL;
  });
}

// ── cascada del hero ──
document.querySelectorAll(".linea-cascada").forEach((linea, li) => {
  linea.querySelectorAll(".palabra").forEach((p, pi) => {
    p.style.setProperty("--d", (li * 0.35 + pi * 0.12).toFixed(2) + "s");
  });
});

// ── comparadores antes/después (drag + touch + teclado) ──
document.querySelectorAll("[data-comparador]").forEach((comp) => {
  const setX = (pct) => {
    pct = Math.min(Math.max(pct, 0), 100);
    comp.style.setProperty("--x", pct + "%");
    comp.setAttribute("aria-valuenow", Math.round(pct));
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
    const cur = parseFloat(comp.style.getPropertyValue("--x")) || 50;
    if (e.key === "ArrowLeft") { setX(cur - 5); e.preventDefault(); }
    if (e.key === "ArrowRight") { setX(cur + 5); e.preventDefault(); }
  });
});

// ── reveal on scroll ──
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
    { threshold: 0.12 }
  );
  document.querySelectorAll(".reveal").forEach((el) => obs.observe(el));
}
