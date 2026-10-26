// SPECTRE · página /review: el comprador deja su review con el link personal del correo de los 7 días.
// Habla con Supabase solo por dos funciones públicas: review_info (lee su review) y review_guardar (lo guarda).
// El token del link es imposible de adivinar y solo sirve para el review de esa persona.
(() => {
  const CFG = window.SPECTRE_CUENTAS;
  const { t: TOKEN, l: IDIOMA_URL, e: ESTRELLAS_URL } = window.SPECTRE_REVIEW || {};
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];

  const TEXTOS = {
    es: {
      volver: "← VOLVER A SPECTRE", kicker: "COMPRADOR VERIFICADO", cargando: "Cargando…",
      titulo: "¿Qué tal te ha ido con SPECTRE?",
      intro: (p, n) => `${n ? n + ", ya" : "Ya"} llevas una semana con ${p}. Cuéntanos cómo te ha funcionado en tus videos y proyectos: nos ayuda a mejorar y a que otros creadores sepan qué esperar.`,
      editar: "Ya nos dejaste tu review. Si quieres, puedes cambiarlo aquí.",
      estrellas: "TU CALIFICACIÓN", texto: "TU REVIEW", nombre: "TU NOMBRE (COMO QUIERES APARECER)", instagram: "TU INSTAGRAM (OPCIONAL)",
      placeholder: "Qué te gustó, en qué proyectos lo usaste, qué cámara usas…", igPh: "@tuusuario",
      nota: "Tu review aparecerá en spectrecolor.com con tu nombre, tu país y un link a tu Instagram. Nunca mostramos tu correo.",
      enviar: "ENVIAR REVIEW", enviando: "ENVIANDO…",
      niveles: ["", "Malo", "Regular", "Bueno", "Muy bueno", "Excelente"],
      graciasTitulo: (n) => (n ? `Gracias, ${n}.` : "Gracias."),
      gracias: "Leemos cada review. En cuanto lo revisemos, aparecerá en spectrecolor.com.",
      ir: "Volver a SPECTRE", miembros: "Área de miembros",
      errorTitulo: "Este link no funciona.",
      errLink: "No encontramos tu review. Abre el link tal cual viene en el correo o escríbenos y te mandamos uno nuevo.",
      errCerrado: "Este review ya no se puede editar. Si quieres cambiar algo, escríbenos.",
      faltaEstrellas: "Elige de 1 a 5 estrellas.", faltaTexto: "Escribe al menos unas palabras (10 caracteres).", faltaNombre: "Escribe tu nombre.", malInstagram: "Revisa tu usuario de Instagram (solo letras, números, puntos y guiones bajos).",
      errRed: "No se pudo enviar. Revisa tu conexión e intenta de nuevo.",
      productos: { full: "el Full System", luts: "el LUT Pack" },
    },
    en: {
      volver: "← BACK TO SPECTRE", kicker: "VERIFIED BUYER", cargando: "Loading…",
      titulo: "How has SPECTRE been?",
      intro: (p, n) => `${n ? n + ", you've" : "You've"} had ${p} for a week now. Tell us how it's working in your videos and projects: it helps us improve and helps other creators know what to expect.`,
      editar: "You already left your review. You can change it here if you want.",
      estrellas: "YOUR RATING", texto: "YOUR REVIEW", nombre: "YOUR NAME (AS IT WILL APPEAR)", instagram: "YOUR INSTAGRAM (OPTIONAL)",
      placeholder: "What you liked, which projects you used it on, what camera you shoot with…", igPh: "@yourusername",
      nota: "Your review will appear on spectrecolor.com with your name, country and a link to your Instagram. We never show your email.",
      enviar: "SEND REVIEW", enviando: "SENDING…",
      niveles: ["", "Poor", "Fair", "Good", "Very good", "Excellent"],
      graciasTitulo: (n) => (n ? `Thank you, ${n}.` : "Thank you."),
      gracias: "We read every review. Once we check it, it will appear on spectrecolor.com.",
      ir: "Back to SPECTRE", miembros: "Members area",
      errorTitulo: "This link doesn't work.",
      errLink: "We couldn't find your review. Open the link exactly as it comes in the email, or write to us and we'll send you a new one.",
      errCerrado: "This review can no longer be edited. Write to us if you want to change something.",
      faltaEstrellas: "Choose 1 to 5 stars.", faltaTexto: "Write at least a few words (10 characters).", faltaNombre: "Write your name.", malInstagram: "Check your Instagram username (only letters, numbers, dots and underscores).",
      errRed: "Couldn't send it. Check your connection and try again.",
      productos: { full: "the Full System", luts: "the LUT Pack" },
    },
  };

  let idioma = IDIOMA_URL === "en" || IDIOMA_URL === "es" ? IDIOMA_URL : /^es\b/i.test(navigator.language || "") ? "es" : "en";
  let info = null, estrellas = 0, vista = "cargando", errorClave = "errLink";
  const T = () => TEXTOS[idioma];

  async function rpc(nombre, args) {
    const r = await fetch(`${CFG.url}/rest/v1/rpc/${nombre}`, {
      method: "POST",
      headers: { apikey: CFG.llave, Authorization: "Bearer " + CFG.llave, "Content-Type": "application/json" },
      body: JSON.stringify(args),
    });
    if (!r.ok) throw new Error("red " + r.status);
    return r.json();
  }

  function mostrar(v) {
    vista = v;
    $$("[data-review-vista]").forEach((el) => (el.hidden = el.dataset.reviewVista !== v));
  }

  // estrellas (botones con flechas del teclado, como un grupo de radio)
  const ESTRELLA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6l2.9 6 6.5.8-4.8 4.5 1.2 6.5L12 17.3l-5.8 3.1 1.2-6.5L2.6 9.4l6.5-.8z"/></svg>';
  const grupo = $(".review-estrellas");
  for (let i = 1; i <= 5; i++) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "review-estrella"; b.dataset.n = i;
    b.setAttribute("role", "radio"); b.innerHTML = ESTRELLA;
    b.addEventListener("click", () => fijarEstrellas(i));
    b.addEventListener("keydown", (ev) => {
      if (ev.key === "ArrowRight" || ev.key === "ArrowUp") { ev.preventDefault(); fijarEstrellas(Math.min(5, (estrellas || 0) + 1), true); }
      if (ev.key === "ArrowLeft" || ev.key === "ArrowDown") { ev.preventDefault(); fijarEstrellas(Math.max(1, (estrellas || 2) - 1), true); }
    });
    grupo.append(b);
  }
  function fijarEstrellas(n, enfocar) {
    estrellas = n;
    $$(".review-estrella").forEach((b) => {
      const k = Number(b.dataset.n);
      b.classList.toggle("encendida", k <= n);
      b.setAttribute("aria-checked", String(k === n));
      b.tabIndex = k === (n || 1) ? 0 : -1;
      if (enfocar && k === n) b.focus();
    });
    $("[data-estrellas-txt]").textContent = n ? T().niveles[n] : "";
  }

  function pintarTextos() {
    const t = T();
    document.documentElement.lang = idioma;
    $$("[data-t]").forEach((el) => {
      const k = { "error-titulo": "errorTitulo" }[el.dataset.t] || el.dataset.t;
      if (typeof t[k] === "string") el.textContent = t[k];
    });
    $$("[data-idioma]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.idioma === idioma)));
    $$(".review-estrella").forEach((b) => b.setAttribute("aria-label", `${b.dataset.n} / 5 · ${t.niveles[b.dataset.n]}`));
    $("#texto").placeholder = t.placeholder;
    $("#instagram").placeholder = t.igPh;
    if (info) {
      const primerNombre = (info.nombre || "").split(" ")[0];
      $("[data-texto-intro]").textContent = info.estado === "invitado" ? t.intro(t.productos[info.producto] || "SPECTRE", primerNombre) : t.editar;
    }
    $("[data-error-texto]").textContent = t[errorClave];
    $("[data-gracias-titulo]").textContent = t.graciasTitulo(($("#nombre").value || "").trim().split(" ")[0]);
    $("[data-estrellas-txt]").textContent = estrellas ? t.niveles[estrellas] : "";
    const boton = $(".review-form .btn-compra [data-t]");
    if (boton && $(".review-form .btn-compra").disabled) boton.textContent = t.enviando;
  }

  $$("[data-idioma]").forEach((b) => b.addEventListener("click", () => { idioma = b.dataset.idioma; pintarTextos(); }));
  $("#texto").addEventListener("input", (ev) => { $("[data-cuenta]").textContent = `${ev.target.value.length} / 1500`; });

  // acepta "@usuario", "usuario" o el link del perfil; deja solo el usuario
  const usuarioIG = (v) => String(v || "").trim().replace(/^(https?:\/\/)?(www\.)?(instagram\.com\/)?@?/i, "").replace(/[/?#].*$/, "").toLowerCase();

  function error(msg) { const e = $("[data-error]"); e.textContent = msg; e.hidden = !msg; }

  $(".review-form").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const t = T(), texto = $("#texto").value.trim(), nombre = $("#nombre").value.trim(), instagram = usuarioIG($("#instagram").value);
    if (!estrellas) return error(t.faltaEstrellas);
    if (texto.length < 10) { $("#texto").focus(); return error(t.faltaTexto); }
    if (!nombre) { $("#nombre").focus(); return error(t.faltaNombre); }
    if (instagram && !/^[a-z0-9._]{1,30}$/.test(instagram)) { $("#instagram").focus(); return error(t.malInstagram); }
    error("");
    const boton = $(".review-form .btn-compra");
    boton.disabled = true; boton.querySelector("[data-t]").textContent = t.enviando;
    try {
      const r = await rpc("review_guardar", { p_token: TOKEN, p_estrellas: estrellas, p_texto: texto, p_nombre: nombre, p_instagram: instagram });
      if (r && r.ok) {
        pintarTextos(); mostrar("gracias");
        try { window.umami && window.umami.track("review-enviado", { estrellas }); } catch (_) {}
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else if (r && r.error === "link") { errorClave = "errLink"; pintarTextos(); mostrar("error"); }
      else if (r && r.error === "cerrado") { errorClave = "errCerrado"; pintarTextos(); mostrar("error"); }
      else error(r && r.error === "texto" ? t.faltaTexto : r && r.error === "nombre" ? t.faltaNombre : r && r.error === "estrellas" ? t.faltaEstrellas : r && r.error === "instagram" ? t.malInstagram : t.errRed);
    } catch (_) { error(t.errRed); }
    finally { boton.disabled = false; boton.querySelector("[data-t]").textContent = T().enviar; }
  });

  async function iniciar() {
    fijarEstrellas(0);
    pintarTextos();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(TOKEN || "")) { errorClave = "errLink"; pintarTextos(); return mostrar("error"); }
    try {
      info = await rpc("review_info", { p_token: TOKEN });
    } catch (_) { info = null; }
    if (!info) { errorClave = "errLink"; pintarTextos(); return mostrar("error"); }
    if (info.estado === "oculto") { errorClave = "errCerrado"; pintarTextos(); return mostrar("error"); }
    if (!IDIOMA_URL && (info.idioma === "es" || info.idioma === "en")) idioma = info.idioma;
    $("#nombre").value = info.nombre || "";
    $("#instagram").value = info.instagram ? "@" + info.instagram : "";
    $("#texto").value = info.texto || "";
    $("[data-cuenta]").textContent = `${$("#texto").value.length} / 1500`;
    // si tocó una estrella en el correo (?e=1…5) llega ya marcada, salvo que ya hubiera escrito su review
    fijarEstrellas(Number(info.estrellas) || (ESTRELLAS_URL >= 1 && ESTRELLAS_URL <= 5 ? ESTRELLAS_URL : 0));
    pintarTextos();
    mostrar("form");
  }
  iniciar();
})();
