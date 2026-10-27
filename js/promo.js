// SPECTRE · pop up de early bird (EARLY-20, 20% hasta el 28 oct 2026 19:53 hora de México).
// Cuándo sale (una vez por sesión, solo en inicio y compra):
//   · al minuto de estar en el sitio (tiempo con la página a la vista, sumado entre páginas)
//   · en computadora, si el mouse sale por arriba para cerrar la pestaña (después de 15 s)
//   · si regresa del pago de Stripe con "atrás" sin haber comprado (versión "¿te quedaste con dudas?")
// Nunca: después del vencimiento, a quien ya trae un código, a compradores con sesión en /access, ni en robots.
// Vista previa sin activarlo: ?promo=ver (normal) o ?promo=regreso (al volver del pago).
(() => {
  const ACTIVO = true; // aprobado por Roberto el 27 oct 2026
  const CODIGO = "EARLY-20";
  const VENCE = Date.parse("2026-10-29T01:53:34Z");
  const ESPERA = 60 * 1000;

  const q = new URLSearchParams(location.search);
  const vista = q.get("promo"); // "ver" | "regreso"
  const es = document.documentElement.lang === "es";
  const guardar = (almacen, k, v) => { try { almacen.setItem(k, v); } catch (_) {} };
  const leer = (almacen, k) => { try { return almacen.getItem(k); } catch (_) { return null; } };
  const evento = (n, d) => { try { window.umami && window.umami.track(n, d); } catch (_) {} };

  // al tocar "comprar" se anota a qué pago fue, para saber si regresó sin comprar
  document.addEventListener("click", (ev) => {
    const b = ev.target.closest && ev.target.closest("[data-checkout]");
    if (b && b.href && b.href.includes("buy.stripe.com")) guardar(sessionStorage, "spectre-promo-pago", JSON.stringify({ t: Date.now(), u: b.href }));
  }, true);

  if (!vista) {
    if (!ACTIVO || Date.now() >= VENCE || navigator.webdriver) return;
    if (leer(localStorage, "spectre-sesion")) return; // ya es comprador
    if (leer(localStorage, "spectre-codigo")) return; // ya trae un código (link de descuento)
    if (leer(localStorage, "spectre-promo-cerrado") && Date.now() - Number(leer(localStorage, "spectre-promo-cerrado")) < 864e5) return;
  }

  const T = es ? {
    titulo: "20% en SPECTRE, solo por 48 horas.",
    tituloR: "Llévatelo con 20% menos.",
    termina: "TERMINA EN", codigo: "TU CÓDIGO", copiar: "COPIAR", copiado: "COPIADO", usar: "USAR MI 20%", no: "Ahora no", cerrar: "Cerrar",
  } : {
    titulo: "20% off SPECTRE, for 48 hours only.",
    tituloR: "Take it home for 20% less.",
    termina: "ENDS IN", codigo: "YOUR CODE", copiar: "COPY", copiado: "COPIED", usar: "USE MY 20%", no: "Not now", cerrar: "Close",
  };

  let abierto = false, reloj = 0, antesFoco = null;
  const dos = (n) => String(n).padStart(2, "0");
  const resta = () => {
    const s = Math.max(0, Math.floor((VENCE - Date.now()) / 1000));
    return `${dos(Math.floor(s / 3600))}:${dos(Math.floor((s % 3600) / 60))}:${dos(s % 60)}`;
  };

  function mostrar(regreso) {
    if (abierto) return;
    abierto = true;
    guardar(sessionStorage, "spectre-promo-visto", "1");
    const raiz = document.createElement("div");
    raiz.className = "promo";
    raiz.innerHTML = `
      <div class="promo-velo" data-cerrar></div>
      <div class="promo-caja" role="dialog" aria-modal="true" aria-labelledby="promo-titulo">
        <button class="promo-x" type="button" data-cerrar aria-label="${T.cerrar}"><span aria-hidden="true">×</span></button>
        <picture class="promo-foto">
          <source srcset="/img/looks/05-despues-1200.avif" type="image/avif" />
          <img src="/img/looks/05-despues-1200.jpg" alt="" width="1200" height="675" />
        </picture>
        <div class="promo-cuerpo">
          <h2 class="promo-titulo" id="promo-titulo">${regreso ? T.tituloR : T.titulo}</h2>
          <div class="promo-fila">
            <div class="promo-codigo"><span class="promo-et">${T.codigo}</span><b>${CODIGO}</b><button type="button" class="promo-copiar">${T.copiar}</button></div>
            <div class="promo-reloj"><span class="promo-et">${T.termina}</span><b data-reloj>${resta()}</b></div>
          </div>
          <a class="promo-usar" href="#">${T.usar} <span aria-hidden="true">→</span></a>
          <button class="promo-no" type="button" data-cerrar>${T.no}</button>
        </div>
      </div>`;
    document.body.append(raiz);
    document.documentElement.classList.add("promo-fija"); // la página de atrás no se mueve mientras está abierto
    antesFoco = document.activeElement;
    void raiz.offsetWidth; // fija el estado inicial para que la entrada se anime sin depender de requestAnimationFrame
    raiz.classList.add("abierto");
    raiz.querySelector(".promo-usar").focus({ preventScroll: true });
    evento("promo-visto", { tipo: regreso ? "regreso" : "normal" });

    reloj = setInterval(() => {
      const r = raiz.querySelector("[data-reloj]");
      if (r) r.textContent = resta();
      if (Date.now() >= VENCE && !vista) cerrar(false);
    }, 1000);

    raiz.addEventListener("click", (ev) => { if (ev.target.closest("[data-cerrar]")) cerrar(true); });
    raiz.querySelector(".promo-copiar").addEventListener("click", (ev) => {
      const b = ev.currentTarget;
      try { navigator.clipboard.writeText(CODIGO); } catch (_) {}
      b.textContent = T.copiado; setTimeout(() => (b.textContent = T.copiar), 1800);
      evento("promo-copiar");
    });
    raiz.querySelector(".promo-usar").addEventListener("click", (ev) => {
      ev.preventDefault();
      evento("promo-usar", { tipo: regreso ? "regreso" : "normal" });
      guardar(localStorage, "spectre-codigo", JSON.stringify({ c: CODIGO, t: Date.now() }));
      // si regresó del pago, lo manda directo al mismo pago con el código puesto; si no, a la página de compra
      let destino = (es ? "/es/get" : "/get") + "?codigo=" + CODIGO;
      try {
        const p = JSON.parse(leer(sessionStorage, "spectre-promo-pago") || "null");
        if (regreso && p && p.u) { const u = new URL(p.u); u.searchParams.set("prefilled_promo_code", CODIGO); destino = u.toString(); }
      } catch (_) {}
      location.href = destino;
    });
    document.addEventListener("keydown", tecla);
  }

  function tecla(ev) { if (ev.key === "Escape") cerrar(true); }
  function cerrar(porUsuario) {
    const raiz = document.querySelector(".promo");
    if (!raiz) return;
    clearInterval(reloj);
    document.removeEventListener("keydown", tecla);
    raiz.classList.remove("abierto");
    document.documentElement.classList.remove("promo-fija");
    setTimeout(() => raiz.remove(), 350);
    if (porUsuario) { guardar(localStorage, "spectre-promo-cerrado", String(Date.now())); evento("promo-cerrar"); }
    if (antesFoco && antesFoco.focus) antesFoco.focus({ preventScroll: true });
  }

  // vista previa para aprobar el diseño
  if (vista) { setTimeout(() => mostrar(vista === "regreso"), 900); return; }

  // regresó del pago con "atrás" (en los últimos 30 min) → versión "¿te quedaste con dudas?"
  const regresoDelPago = (persistida) => {
    const nav = (performance.getEntriesByType && performance.getEntriesByType("navigation")[0]) || {};
    if (!persistida && nav.type !== "back_forward") return false;
    try {
      const p = JSON.parse(leer(sessionStorage, "spectre-promo-pago") || "null");
      return !!(p && Date.now() - p.t < 30 * 60 * 1000 && !leer(sessionStorage, "spectre-promo-regreso"));
    } catch (_) { return false; }
  };
  addEventListener("pageshow", (ev) => {
    if (regresoDelPago(ev.persisted)) { guardar(sessionStorage, "spectre-promo-regreso", "1"); setTimeout(() => mostrar(true), 700); }
  });

  if (leer(sessionStorage, "spectre-promo-visto")) return;

  // al minuto de verlo (solo cuenta el tiempo con la página a la vista, y se suma entre páginas)
  let acumulado = Number(leer(sessionStorage, "spectre-promo-tiempo")) || 0, desde = document.hidden ? 0 : Date.now();
  const contar = () => {
    if (desde) { acumulado += Date.now() - desde; desde = 0; }
    guardar(sessionStorage, "spectre-promo-tiempo", String(acumulado));
  };
  document.addEventListener("visibilitychange", () => { if (document.hidden) contar(); else desde = Date.now(); });
  addEventListener("pagehide", contar);
  const revisar = setInterval(() => {
    const total = acumulado + (desde ? Date.now() - desde : 0);
    if (leer(sessionStorage, "spectre-promo-visto")) return clearInterval(revisar);
    if (total >= ESPERA) { clearInterval(revisar); mostrar(false); }
  }, 1000);

  // computadora: el mouse sale por arriba (va a cerrar o cambiar de pestaña) después de 15 s
  if (matchMedia("(hover: hover) and (pointer: fine)").matches) {
    document.addEventListener("mouseout", (ev) => {
      if (ev.relatedTarget || ev.clientY > 8 || abierto || leer(sessionStorage, "spectre-promo-visto")) return;
      if (acumulado + (desde ? Date.now() - desde : 0) < 15000) return;
      clearInterval(revisar); mostrar(false);
    });
  }
})();
