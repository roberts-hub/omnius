// ══════════ OMNIUS — main.js ══════════

// TODO: reemplazar con el buy-link real de la tienda Lemon Squeezy,
// formato: https://TIENDA.lemonsqueezy.com/checkout/buy/UUID?embed=1&media=0
const LEMON_URL = "TODO-LEMONSQUEEZY-URL";

// ── Checkout (Lemon Squeezy) ──
// Todo elemento con [data-checkout] abre el checkout encima de la página (overlay):
// el botón del hero (compra rápida desde la principal) y el de producto.html.
// Mientras LEMON_URL sea placeholder, los botones conservan su href (el del hero va a
// producto.html) y lemon.js ni se descarga.
const botonesCheckout = document.querySelectorAll("[data-checkout]");
if (botonesCheckout.length && !LEMON_URL.startsWith("TODO")) {
  botonesCheckout.forEach((b) => {
    b.href = LEMON_URL;
    b.classList.add("lemonsqueezy-button");
  });
  const s = document.createElement("script");
  s.src = "https://assets.lemonsqueezy.com/lemon.js";
  s.defer = true;
  s.onload = () => window.createLemonSqueezy && window.createLemonSqueezy();
  document.head.appendChild(s);
}

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ── INTRO: frase palabra por palabra → iconos rápidos → sitio (estilo mastermind) ──
// Solo en la primera visita de la sesión; un clic o cualquier tecla la adelanta.
const loader = document.getElementById("loader");
if (loader) {
  const intro = loader.querySelector(".loader-intro");
  const glyphs = loader.querySelectorAll(".glyph");
  const lineas = [...intro.querySelectorAll(".intro-linea")];
  const PASO = 170; // ms por icono: cambio rápido
  const VUELTAS = 2; // los iconos se repiten para llenar el mismo tiempo de antes
  const SOSTENER_MARCA = 750; // la marca OMNIUS se queda un momento antes de disolverse
  const timers = [];
  const despues = (ms, fn) => timers.push(setTimeout(fn, ms));

  let yaVisto = false;
  try { yaVisto = sessionStorage.getItem("omnius-intro") === "1"; } catch (e) {}

  // el loader se disuelve mientras el video "enfoca"; el contenido del hero entra al final
  let introCerrada = false;
  const cerrarIntro = () => {
    if (introCerrada) return;
    introCerrada = true;
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

    // espera a que Archivo esté cargada (máx. 1.2 s) para que la frase no cambie de fuente a medio animar
    const fuenteLista = Promise.race([
      document.fonts ? document.fonts.load('700 32px "Archivo"') : Promise.resolve(),
      new Promise((r) => setTimeout(r, 1200)),
    ]).catch(() => {});

    fuenteLista.then(() => {
      if (introCerrada) return;
      // las líneas entran una tras otra y se quedan apiladas
      let t = 300;
      lineas.forEach((linea) => {
        despues(t, () => linea.classList.add("activa"));
        t += linea.children.length * 90 + 450;
      });

      // la frase se desvanece y los iconos pasan rápido, dos vueltas, terminando en la marca OMNIUS
      t += 1000;
      despues(t, () => {
        intro.classList.add("fuera");
        loader.classList.add("fase-iconos");
      });
      const secuencia = Array.from({ length: glyphs.length * VUELTAS }, (_, k) => glyphs[k % glyphs.length]);
      secuencia.forEach((g, i) => {
        despues(t + 500 + i * PASO, () => {
          glyphs.forEach((x) => x.classList.remove("activo"));
          g.classList.add("activo");
        });
      });
      despues(t + 500 + (secuencia.length - 1) * PASO + SOSTENER_MARCA, cerrarIntro);
    });

    loader.addEventListener("click", cerrarIntro, { once: true });
    document.addEventListener("keydown", function saltarConTecla() {
      if (document.body.classList.contains("cargando")) cerrarIntro();
      document.removeEventListener("keydown", saltarConTecla);
    });
  }
}

// ── header: transparente sobre el video, sólido al pasar el hero ──
const cabecera = document.querySelector(".cabecera");
const heroVideo = document.querySelector(".hero-video");
if (heroVideo) {
  new IntersectionObserver(
    ([e]) => cabecera.classList.toggle("solida", !e.isIntersecting),
    { rootMargin: "-80px 0px 0px 0px" }
  ).observe(heroVideo);
}

// ── comparadores antes/después ──
// Fluidez: el movimiento es solo transform (CSS, vía --x) y se actualiza una vez por cuadro.
// El slider SOLO se mueve arrastrando (presionar + desplazar). Un clic, un toque suelto del
// trackpad o pasar el cursor por encima no lo mueven.
// En touch: gesto vertical = scroll de la página (el slider no se mueve); horizontal = arrastrar
// (y la página no se mueve mientras tanto).
const UMBRAL = 8; // px antes de decidir la intención en touch
const UMBRAL_MOUSE = 3; // px de arrastre real con el botón presionado

document.querySelectorAll("[data-comparador]").forEach((comp) => {
  let x = 50;
  let pendiente = null;
  let cuadro = 0;

  const pintar = () => {
    cuadro = 0;
    if (pendiente === null) return;
    x = pendiente;
    pendiente = null;
    comp.style.setProperty("--x", x.toFixed(2));
    comp.setAttribute("aria-valuenow", Math.round(x));
    comp.setAttribute("aria-valuetext", Math.round(x) + "% before, rest graded");
  };
  const setX = (pct) => {
    pendiente = Math.min(Math.max(pct, 0), 100);
    if (!cuadro) cuadro = requestAnimationFrame(pintar);
  };
  // salto con deslizamiento suave (toque o teclado)
  const deslizarA = (pct) => {
    comp.classList.add("deslizando");
    setX(pct);
    clearTimeout(comp._fin);
    comp._fin = setTimeout(() => comp.classList.remove("deslizando"), 460);
  };

  comp.tabIndex = 0;
  comp.setAttribute("role", "slider");
  comp.setAttribute("aria-label", "Before and after comparison");
  comp.setAttribute("aria-valuemin", "0");
  comp.setAttribute("aria-valuemax", "100");
  comp.setAttribute("aria-valuenow", "50");

  let caja = null;
  const pctDe = (clientX) => ((clientX - caja.left) / caja.width) * 100;

  let gesto = null; // { id, x0, y0, tipo, arrastrando }

  const soltar = () => {
    if (gesto && gesto.arrastrando) {
      try { comp.releasePointerCapture(gesto.id); } catch (_) {}
    }
    gesto = null;
    comp.classList.remove("arrastrando");
  };

  // pista: un empujón sutil de la línea para sugerir que se puede arrastrar (una sola vez).
  // Se cancela en cuanto la persona toca, arrastra o usa el teclado.
  let pistaActiva = false;
  comp._pista = () => {
    if (pistaActiva || comp._pistaHecha) return;
    comp._pistaHecha = true;
    pistaActiva = true;
    const DURACION = 1400;
    const AMPLITUD = 5; // % — un empujón sutil, no un vaivén
    const inicio = performance.now();
    const paso = (ahora) => {
      if (!pistaActiva) return;
      const p = Math.min((ahora - inicio) / DURACION, 1);
      // un solo empujón suave a la izquierda y de regreso al centro
      setX(50 - AMPLITUD * Math.sin(Math.PI * p) ** 2);
      if (p < 1) requestAnimationFrame(paso);
      else pistaActiva = false;
    };
    requestAnimationFrame(paso);
  };
  const cancelarPista = () => { pistaActiva = false; };

  comp.addEventListener("pointerdown", (e) => {
    cancelarPista();
    if (e.button !== 0) return;
    caja = comp.getBoundingClientRect();
    // solo se registra el inicio; el slider no se mueve hasta que haya arrastre real
    gesto = { id: e.pointerId, x0: e.clientX, y0: e.clientY, tipo: e.pointerType, arrastrando: false };
    if (e.pointerType === "mouse") e.preventDefault(); // sin selección de texto ni arrastre de imagen
  });

  comp.addEventListener("pointermove", (e) => {
    if (!gesto || e.pointerId !== gesto.id) return;
    const esMouse = gesto.tipo === "mouse";
    // botón ya suelto (p. ej. se soltó fuera de la ventana): se corta el arrastre
    if (esMouse && e.buttons === 0) { soltar(); return; }
    if (!gesto.arrastrando) {
      const dx = Math.abs(e.clientX - gesto.x0);
      const dy = Math.abs(e.clientY - gesto.y0);
      if (esMouse) {
        if (dx < UMBRAL_MOUSE) return;
      } else {
        if (dx < UMBRAL && dy < UMBRAL) return;
        if (dy >= dx) { gesto = null; return; } // vertical: es scroll, el slider se queda quieto
      }
      gesto.arrastrando = true;
      try { comp.setPointerCapture(e.pointerId); } catch (_) {}
      comp.classList.add("arrastrando");
    }
    setX(pctDe(e.clientX));
  });

  const terminar = (e) => {
    if (!gesto || e.pointerId !== gesto.id) return;
    soltar();
  };
  comp.addEventListener("pointerup", terminar);
  comp.addEventListener("pointercancel", terminar);
  comp.addEventListener("lostpointercapture", terminar);
  window.addEventListener("blur", soltar);

  // mientras se arrastra en horizontal, la página no se mueve (evita el temblor diagonal en celular)
  comp.addEventListener("touchmove", (e) => {
    if (gesto && gesto.arrastrando) e.preventDefault();
  }, { passive: false });

  comp.addEventListener("keydown", (e) => {
    cancelarPista();
    const actual = pendiente ?? x;
    if (e.key === "ArrowLeft") { deslizarA(actual - 5); e.preventDefault(); }
    if (e.key === "ArrowRight") { deslizarA(actual + 5); e.preventDefault(); }
    if (e.key === "Home") { deslizarA(0); e.preventDefault(); }
    if (e.key === "End") { deslizarA(100); e.preventDefault(); }
  });
});

// ── carrusel de sliders ──
// Centra el clip activo; los vecinos se asoman. Flechas, rayitas o clic en un vecino cambian de clip.
// La pista (empujón sutil) se reproduce una sola vez: cuando el carrusel aparece por primera vez.
const carrusel = document.querySelector(".carrusel");
if (carrusel) {
  const ventana = carrusel.querySelector(".carrusel-ventana");
  const pista = carrusel.querySelector(".carrusel-pista");
  const slides = [...pista.querySelectorAll(".look")];
  const flechas = carrusel.querySelectorAll(".carrusel-flecha");
  const contador = carrusel.querySelector(".carrusel-contador .actual");
  const puntosCaja = carrusel.querySelector(".carrusel-puntos");
  let activo = 0;
  let visible = false;

  const puntos = slides.map((_, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "carrusel-punto";
    b.setAttribute("role", "tab");
    b.setAttribute("aria-label", "Example " + (i + 1));
    b.addEventListener("click", () => ir(i));
    puntosCaja.appendChild(b);
    return b;
  });

  const colocar = () => {
    const ancho = slides[0].offsetWidth;
    const hueco = parseFloat(getComputedStyle(pista).columnGap) || 0;
    const desplazamiento = (ventana.clientWidth - ancho) / 2 - activo * (ancho + hueco);
    pista.style.setProperty("--desplazamiento", desplazamiento + "px");
  };

  const pistaDelActivo = () => {
    const comp = slides[activo].querySelector("[data-comparador]");
    if (visible && comp && comp._pista && !reduceMotion) setTimeout(() => comp._pista(), 650);
  };

  const ir = (i) => {
    activo = Math.max(0, Math.min(slides.length - 1, i));
    slides.forEach((s, k) => {
      s.classList.toggle("activo", k === activo);
      s.setAttribute("aria-hidden", k === activo ? "false" : "true");
      const c = s.querySelector("[data-comparador]");
      if (c) c.tabIndex = k === activo ? 0 : -1;
      // los vecinos cargan antes de llegar al centro
      if (Math.abs(k - activo) <= 1) s.querySelectorAll("img").forEach((img) => { img.loading = "eager"; });
    });
    puntos.forEach((p, k) => p.setAttribute("aria-selected", k === activo ? "true" : "false"));
    contador.textContent = String(activo + 1).padStart(2, "0");
    flechas[0].disabled = activo === 0;
    flechas[1].disabled = activo === slides.length - 1;
    colocar();
  };

  flechas.forEach((f) => f.addEventListener("click", () => ir(activo + Number(f.dataset.dir))));
  // clic en un clip vecino: lo trae al centro
  slides.forEach((s, i) => s.addEventListener("click", () => { if (i !== activo) ir(i); }));
  // flechas del teclado cuando el foco está en los controles
  carrusel.querySelector(".carrusel-controles").addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") { ir(activo - 1); e.preventDefault(); }
    if (e.key === "ArrowRight") { ir(activo + 1); e.preventDefault(); }
  });

  let espera = 0;
  window.addEventListener("resize", () => {
    clearTimeout(espera);
    pista.style.transition = "none";
    colocar();
    espera = setTimeout(() => { pista.style.transition = ""; }, 100);
  });

  if ("IntersectionObserver" in window) {
    const obsCarrusel = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !visible) { visible = true; pistaDelActivo(); obsCarrusel.disconnect(); }
    }, { threshold: 0.5 });
    obsCarrusel.observe(ventana);
  }

  ir(0);
}

// ── carrusel de reseñas (scroll nativo con snap: en celular se desliza con el dedo) ──
const resenas = document.querySelector(".resenas-pista");
if (resenas && !resenas.closest("[hidden]")) {
  const tarjetas = [...resenas.children];
  const flechasR = document.querySelectorAll(".resenas-flecha");
  const puntosR = document.querySelector(".resenas-puntos");
  const paso = () => tarjetas[0].getBoundingClientRect().width + (parseFloat(getComputedStyle(resenas).columnGap) || 0);
  const visibles = () => Math.max(1, Math.round(resenas.clientWidth / paso()));
  let dots = [];

  const pintarPuntos = () => {
    const paginas = tarjetas.length - visibles() + 1;
    if (dots.length !== paginas) {
      puntosR.innerHTML = "";
      dots = Array.from({ length: paginas }, () => {
        const d = document.createElement("span");
        d.className = "carrusel-punto";
        puntosR.appendChild(d);
        return d;
      });
    }
    const i = Math.round(resenas.scrollLeft / paso());
    dots.forEach((d, k) => d.setAttribute("aria-selected", k === i ? "true" : "false"));
    flechasR[0].disabled = resenas.scrollLeft <= 2;
    flechasR[1].disabled = resenas.scrollLeft + resenas.clientWidth >= resenas.scrollWidth - 2;
  };

  flechasR.forEach((f) => f.addEventListener("click", () => {
    resenas.scrollBy({ left: Number(f.dataset.dir) * paso(), behavior: reduceMotion ? "auto" : "smooth" });
  }));
  let cuadroR = 0;
  resenas.addEventListener("scroll", () => {
    if (!cuadroR) cuadroR = requestAnimationFrame(() => { cuadroR = 0; pintarPuntos(); });
  }, { passive: true });
  window.addEventListener("resize", pintarPuntos);
  pintarPuntos();
}

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
