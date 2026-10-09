// ══════════ SPECTRE — main.js ══════════

// TODO: reemplazar con los buy-links reales de la tienda Lemon Squeezy (un producto por edición),
// formato: https://TIENDA.lemonsqueezy.com/checkout/buy/UUID?embed=1&media=0
const LEMON_URLS = {
  completo: "TODO-LEMONSQUEEZY-URL-FULL-SYSTEM", // Full System (LUTs + node tree + tutorial) — $79
  luts: "TODO-LEMONSQUEEZY-URL-LUTS-ONLY",       // LUTs Only (sin DaVinci Resolve) — $39
};
const urlLista = (u) => !!u && !u.startsWith("TODO");

// ── Edición elegida (producto.html) ──
// [data-checkout] vacío sigue la edición elegida; data-checkout="luts" fija una.
// ?edition=luts en la URL abre la página con LUTs Only ya elegida.
let edicion = "completo";
const botonesCheckout = document.querySelectorAll("[data-checkout]");
const urlDe = (b) => LEMON_URLS[b.dataset.checkout || edicion];
const actualizarCheckout = () => botonesCheckout.forEach((b) => {
  const u = urlDe(b);
  if (urlLista(u)) b.href = u;
});

const selectorEdicion = document.querySelector("[data-ediciones]");
if (selectorEdicion) {
  const opciones = [...selectorEdicion.querySelectorAll('input[name="edicion"]')];
  const elegir = (valor) => {
    const opcion = opciones.find((o) => o.value === valor);
    if (!opcion) return;
    opcion.checked = true;
    edicion = valor;
    document.querySelectorAll("[data-oferta-texto]").forEach((el) => {
      const texto = opcion.dataset[el.dataset.ofertaTexto];
      if (texto) el.textContent = texto;
    });
    document.querySelectorAll("[data-oferta-panel]").forEach((p) => {
      p.hidden = p.dataset.ofertaPanel !== valor;
    });
    actualizarCheckout();
  };
  opciones.forEach((o) => o.addEventListener("change", () => {
    elegir(o.value);
    const url = new URL(location.href);
    if (o.value === "completo") url.searchParams.delete("edition");
    else url.searchParams.set("edition", o.value);
    history.replaceState(null, "", url);
  }));
  document.querySelectorAll("[data-elige-edicion]").forEach((b) => b.addEventListener("click", () => {
    const o = opciones.find((x) => x.value === b.dataset.eligeEdicion);
    if (o) { o.click(); selectorEdicion.scrollIntoView({ behavior: "smooth", block: "center" }); }
  }));
  elegir(new URLSearchParams(location.search).get("edition") === "luts" ? "luts" : "completo");
}

// ── Caja 3D (producto.html): giro ligero al hacer scroll ──
const caja = document.querySelector(".caja");
if (caja && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  let pendiente = false;
  const girar = () => {
    pendiente = false;
    const p = Math.min(Math.max(window.scrollY / (window.innerHeight * 0.8), 0), 1);
    caja.style.setProperty("--giro", p.toFixed(3));
  };
  window.addEventListener("scroll", () => {
    if (!pendiente) { pendiente = true; requestAnimationFrame(girar); }
  }, { passive: true });
  girar();
}

// ── Checkout (Lemon Squeezy) ──
// Con un buy-link real, [data-checkout] abre el checkout encima de la página (overlay) con la
// URL de su edición. Sin buy-links, los botones conservan su href y lemon.js ni se descarga.
if (botonesCheckout.length && Object.values(LEMON_URLS).some(urlLista)) {
  actualizarCheckout();
  const s = document.createElement("script");
  s.src = "https://assets.lemonsqueezy.com/lemon.js";
  s.defer = true;
  s.onload = () => window.createLemonSqueezy && window.createLemonSqueezy();
  document.head.appendChild(s);
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-checkout]");
    if (!b) return;
    const u = urlDe(b);
    if (!urlLista(u) || !window.LemonSqueezy) return;
    e.preventDefault();
    window.LemonSqueezy.Url.Open(u);
  });
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
  const SOSTENER_MARCA = 750; // la marca SPECTRE se queda un momento antes de disolverse
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

      // la frase se desvanece y los iconos pasan rápido, dos vueltas, terminando en la marca SPECTRE
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
// Fluidez en celular:
// · el movimiento es solo transform (vía --x) y se pinta una vez por cuadro; nada se repinta al arrastrar
// · la línea sigue al dedo de forma RELATIVA (desde donde estaba): nunca brinca a donde tocaste
// · la dirección se decide rápido si el gesto es claramente horizontal; si es vertical o ambiguo, la
//   página hace scroll normal (un scroll con el pulgar que arranca un poco de lado no se "roba")
// · el slider SOLO se mueve arrastrando: un toque suelto o pasar el cursor no lo mueven
const UMBRAL_TOUCH = 6;      // px mínimos antes de decidir en touch
const UMBRAL_DUDOSO = 14;    // si a 6 px el gesto es ambiguo, se espera hasta aquí
const RAZON_HORIZONTAL = 1.5; // dx debe superar a dy por este factor (ángulo < ~34°) para arrastrar de inmediato
const UMBRAL_MOUSE = 3;

// posición inicial: línea al 25% → se ve 3/4 del resultado final (after)
const X_INICIAL = 25;

document.querySelectorAll("[data-comparador]").forEach((comp) => {
  let x = X_INICIAL;
  let pendiente = null;
  let cuadro = 0;

  const pintar = () => {
    cuadro = 0;
    if (pendiente === null) return;
    x = pendiente;
    pendiente = null;
    comp.style.setProperty("--x", x.toFixed(2));
  };
  const setX = (pct) => {
    pendiente = Math.min(Math.max(pct, 0), 100);
    if (!cuadro) cuadro = requestAnimationFrame(pintar);
  };
  const anunciar = () => {
    const v = Math.round(pendiente ?? x);
    comp.setAttribute("aria-valuenow", v);
    comp.setAttribute("aria-valuetext", v + "% before, rest graded");
  };
  // salto con deslizamiento suave (teclado)
  const deslizarA = (pct) => {
    comp.classList.add("deslizando");
    setX(pct);
    anunciar();
    clearTimeout(comp._fin);
    comp._fin = setTimeout(() => comp.classList.remove("deslizando"), 460);
  };

  comp.tabIndex = 0;
  comp.setAttribute("role", "slider");
  comp.setAttribute("aria-label", "Before and after comparison");
  comp.setAttribute("aria-valuemin", "0");
  comp.setAttribute("aria-valuemax", "100");
  comp.setAttribute("aria-valuenow", String(X_INICIAL));

  let ancho = 1;
  // { id, tipo, x0, y0, arrastrando, base, inicioX, xAntes }
  let gesto = null;

  const soltar = () => {
    if (gesto && gesto.arrastrando) {
      try { comp.releasePointerCapture(gesto.id); } catch (_) {}
      anunciar();
    }
    gesto = null;
    comp.classList.remove("arrastrando");
  };

  // pista: un empujón sutil de la línea para sugerir que se puede arrastrar (una sola vez).
  // No arranca si la persona ya tocó el slider, y se retira en cuanto lo toca.
  let pistaActiva = false;
  comp._pista = () => {
    if (pistaActiva || comp._pistaHecha) return;
    comp._pistaHecha = true;
    pistaActiva = true;
    const DURACION = 1400;
    const AMPLITUD = 5; // % — un empujón sutil, no un vaivén
    const inicio = performance.now();
    const paso = (ahora) => {
      if (!pistaActiva || gesto) { pistaActiva = false; return; }
      const p = Math.min((ahora - inicio) / DURACION, 1);
      setX(X_INICIAL + AMPLITUD * Math.sin(Math.PI * p) ** 2);
      if (p < 1) requestAnimationFrame(paso);
      else pistaActiva = false;
    };
    requestAnimationFrame(paso);
  };
  const cancelarPista = () => {
    comp._pistaHecha = true;
    if (pistaActiva) { pistaActiva = false; setX(X_INICIAL); }
  };

  const empezarArrastre = (e) => {
    gesto.arrastrando = true;
    gesto.base = pendiente ?? x;   // la línea parte de donde está…
    // …y se mueve lo mismo que el dedo desde aquí (sin brincos); con mouse, desde donde se presionó
    gesto.inicioX = gesto.tipo === "mouse" ? gesto.x0 : e.clientX;
    try { comp.setPointerCapture(e.pointerId); } catch (_) {}
    comp.classList.add("arrastrando");
  };

  comp.addEventListener("pointerdown", (e) => {
    cancelarPista();
    if (e.button !== 0) return;
    ancho = comp.getBoundingClientRect().width || 1;
    gesto = { id: e.pointerId, tipo: e.pointerType, x0: e.clientX, y0: e.clientY, arrastrando: false, xAntes: pendiente ?? x };
    if (e.pointerType === "mouse") e.preventDefault(); // sin selección de texto ni arrastre de imagen
  });

  comp.addEventListener("pointermove", (e) => {
    if (!gesto || e.pointerId !== gesto.id) return;
    if (!gesto.arrastrando) {
      const dx = Math.abs(e.clientX - gesto.x0);
      const dy = Math.abs(e.clientY - gesto.y0);
      if (gesto.tipo === "mouse") {
        if (e.buttons === 0) { soltar(); return; }
        if (dx < UMBRAL_MOUSE) return;
      } else {
        const d = Math.hypot(dx, dy);
        if (d < UMBRAL_TOUCH) return;
        const horizontal = dx > dy * RAZON_HORIZONTAL;
        if (!horizontal) {
          if (dy >= dx) { gesto = null; return; }   // vertical: es scroll de la página
          if (d < UMBRAL_DUDOSO) return;           // ambiguo: un poco más de recorrido
        }
      }
      empezarArrastre(e);
    }
    setX(gesto.base + ((e.clientX - gesto.inicioX) / ancho) * 100);
  });

  const terminar = (e) => {
    if (!gesto || e.pointerId !== gesto.id) return;
    soltar();
  };
  comp.addEventListener("pointerup", terminar);
  // el navegador se quedó con el gesto (scroll): el slider regresa a donde estaba
  comp.addEventListener("pointercancel", (e) => {
    if (gesto && e.pointerId === gesto.id && gesto.arrastrando) setX(gesto.xAntes);
    terminar(e);
  });
  // solo cuenta si el que pierde la captura es el slider: lostpointercapture burbujea desde las capas
  // internas, y tomarlo como "se soltó" congelaba el arrastre al empezar del lado del antes
  comp.addEventListener("lostpointercapture", (e) => { if (e.target === comp) terminar(e); });
  window.addEventListener("blur", soltar);

  // mientras se arrastra en horizontal, la página no se mueve (evita el temblor diagonal en celular)
  comp.addEventListener("touchmove", (e) => {
    if (gesto && gesto.arrastrando && e.cancelable) e.preventDefault();
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

// ── carrusel de sliders (infinito) ──
// El clip activo queda centrado con vecinos a ambos lados; al pasar del último sigue el primero.
// Técnica: los clips se rotan en el DOM (el del extremo pasa al otro lado) sin transición,
// y solo se anima el desplazamiento corto; así el movimiento siempre es continuo.
// Flechas, rayitas o clic en un vecino cambian de clip. La pista (empujón sutil) solo la primera vez.
const carrusel = document.querySelector(".carrusel");
if (carrusel) {
  const ventana = carrusel.querySelector(".carrusel-ventana");
  const pista = carrusel.querySelector(".carrusel-pista");
  const slides = [...pista.querySelectorAll(".look")];
  const n = slides.length;
  const CENTRO = Math.floor((n - 1) / 2); // posición fija del clip activo dentro de la pista
  const flechas = carrusel.querySelectorAll(".carrusel-flecha");
  const contador = carrusel.querySelector(".carrusel-contador .actual");
  const puntosCaja = carrusel.querySelector(".carrusel-puntos");
  let activo = 0; // índice "lógico" (orden original de los clips)
  let animando = false;
  let terminarYa = null; // completa al instante la animación en curso
  let visible = false;
  slides.forEach((s, i) => { s._indice = i; });

  const puntos = slides.map((_, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "carrusel-punto";
    b.setAttribute("role", "tab");
    b.setAttribute("aria-label", "Example " + (i + 1));
    b.addEventListener("click", () => {
      let d = (((i - activo) % n) + n) % n;
      if (d > n / 2) d -= n; // camino más corto, hacia cualquier lado
      mover(d);
    });
    puntosCaja.appendChild(b);
    return b;
  });

  const colocar = (posicion, animar) => {
    const ancho = slides[0].offsetWidth;
    const hueco = parseFloat(getComputedStyle(pista).columnGap) || 0;
    if (!animar) pista.style.transition = "none";
    pista.style.setProperty("--desplazamiento", (ventana.clientWidth - ancho) / 2 - posicion * (ancho + hueco) + "px");
    if (!animar) { void pista.offsetWidth; pista.style.transition = ""; }
  };

  const marcar = () => {
    const enPista = [...pista.children];
    slides.forEach((s) => {
      const esActivo = s._indice === activo;
      s.classList.toggle("activo", esActivo);
      s.setAttribute("aria-hidden", esActivo ? "false" : "true");
      const c = s.querySelector("[data-comparador]");
      if (c) c.tabIndex = esActivo ? 0 : -1;
    });
    // precarga: los dos clips a cada lado del activo
    const pos = enPista.findIndex((s) => s._indice === activo);
    enPista.forEach((s, k) => {
      if (Math.abs(k - pos) <= 2) s.querySelectorAll("img").forEach((img) => {
        img.loading = "eager";
        // decodificar antes de que se vea: así el primer arrastre no espera a que el teléfono descomprima la foto
        if (img.decode) img.decode().catch(() => {});
      });
    });
    puntos.forEach((p, k) => p.setAttribute("aria-selected", k === activo ? "true" : "false"));
    contador.textContent = String(activo + 1).padStart(2, "0");
  };

  const alTerminar = (fn) => {
    let hecho = false;
    const listo = (e) => {
      if (e && (e.target !== pista || e.propertyName !== "transform")) return;
      if (hecho) return;
      hecho = true;
      pista.removeEventListener("transitionend", listo);
      fn();
    };
    pista.addEventListener("transitionend", listo);
    setTimeout(listo, reduceMotion ? 0 : 900); // respaldo (pestaña oculta, sin transición)
    terminarYa = () => listo();
  };

  const mover = (d) => {
    if (d === 0) return;
    if (animando && terminarYa) terminarYa(); // toques rápidos: se encadenan en vez de ignorarse
    animando = true;
    activo = (((activo + d) % n) + n) % n;
    if (d > 0) {
      marcar();
      colocar(CENTRO + d, true);
      alTerminar(() => {
        for (let k = 0; k < d; k++) pista.appendChild(pista.firstElementChild);
        colocar(CENTRO, false);
        animando = false;
      });
    } else {
      for (let k = 0; k < -d; k++) pista.insertBefore(pista.lastElementChild, pista.firstElementChild);
      colocar(CENTRO - d, false);
      marcar();
      colocar(CENTRO, true);
      alTerminar(() => { animando = false; });
    }
  };

  flechas.forEach((f) => f.addEventListener("click", () => mover(Number(f.dataset.dir))));
  // clic en un clip vecino: lo trae al centro
  slides.forEach((s) => s.addEventListener("click", () => {
    if (animando && terminarYa) terminarYa(); // posición real antes de calcular la distancia
    const d = [...pista.children].indexOf(s) - CENTRO;
    if (d !== 0) mover(d);
  }));
  // flechas del teclado cuando el foco está en los controles
  carrusel.querySelector(".carrusel-controles").addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") { mover(-1); e.preventDefault(); }
    if (e.key === "ArrowRight") { mover(1); e.preventDefault(); }
  });

  window.addEventListener("resize", () => colocar(CENTRO, false));

  if ("IntersectionObserver" in window) {
    const obsCarrusel = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !visible) {
        visible = true;
        const comp = slides[activo].querySelector("[data-comparador]");
        if (comp && comp._pista && !reduceMotion) setTimeout(() => comp._pista(), 650);
        obsCarrusel.disconnect();
      }
    }, { threshold: 0.5 });
    obsCarrusel.observe(ventana);
  }

  // estado inicial: el primer clip al centro, los últimos a su izquierda
  for (let k = 0; k < CENTRO; k++) pista.insertBefore(pista.lastElementChild, pista.firstElementChild);
  marcar();
  colocar(CENTRO, false);
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

// ── barra de compra fija (estilo Pordoi) ──
// Dos modos según la página:
// · [data-muestra-barra] (principal): aparece cuando esa sección entra en pantalla
//   —o si ya se pasó— y desde ahí no vuelve a esconderse.
// · [data-oculta-barra] (producto): aparece al pasar ese botón de compra y se esconde
//   mientras esté a la vista (nunca dos botones de compra juntos).
const barraCompra = document.querySelector("[data-barra-compra]");
const mostrarBarra = (si) => {
  barraCompra.classList.toggle("visible", si);
  barraCompra.inert = !si; // oculta: ni foco ni lectores de pantalla
};
const desdeSeccion = document.querySelector("[data-muestra-barra]");
const disparadoresBarra = [...document.querySelectorAll("[data-oculta-barra]")];
if (barraCompra && "IntersectionObserver" in window) {
  if (desdeSeccion) {
    const obsDesde = new IntersectionObserver(([e]) => {
      if (e.isIntersecting || e.boundingClientRect.top < 0) {
        mostrarBarra(true);
        obsDesde.disconnect(); // ya no vuelve a desaparecer
      }
    });
    obsDesde.observe(desdeSeccion);
  } else if (disparadoresBarra.length) {
    const aLaVista = new Map();
    const obsBarra = new IntersectionObserver((entradas) => {
      entradas.forEach((e) => aLaVista.set(e.target, e.isIntersecting));
      const algunoVisible = disparadoresBarra.some((d) => aLaVista.get(d));
      mostrarBarra(!algunoVisible && disparadoresBarra[0].getBoundingClientRect().bottom < 0);
    });
    disparadoresBarra.forEach((d) => obsBarra.observe(d));
  }
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
