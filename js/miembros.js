// ══════════ SPECTRE — área de miembros (access.html) ══════════
// Cuentas por comprador (Supabase Auth). Cada pago en Stripe crea la cuenta del comprador y le manda el
// correo "Create your password" (supabase/functions/stripe-webhook). Aquí se inicia sesión con correo y
// contraseña; el contenido de cada edición (videos y llaves de las descargas) lo entrega la base de datos
// SOLO a cuentas con una compra activa de esa edición (Row Level Security). Nada de eso está en el sitio.

const CFG = window.SPECTRE_CUENTAS || {};
const candado = document.querySelector("[data-candado]");
const destino = document.querySelector("[data-contenido]");
const SESION = "spectre-sesion";

const deB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

// ── sesión: el token de acceso vive en memoria; el de renovación en este navegador (si eligió quedarse) ──
let sesion = null; // { access_token, refresh_token, expires_at, recordar }
const almacen = (recordar) => (recordar ? localStorage : sessionStorage);
function guardarSesion(s, recordar) {
  sesion = { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: Date.now() / 1000 + (s.expires_in || 3600), recordar };
  try {
    localStorage.removeItem(SESION); sessionStorage.removeItem(SESION);
    almacen(recordar).setItem(SESION, JSON.stringify({ refresh_token: sesion.refresh_token }));
  } catch (_) {}
}
function olvidarSesion() {
  sesion = null;
  try { localStorage.removeItem(SESION); sessionStorage.removeItem(SESION); } catch (_) {}
}
function leerSesion() {
  try {
    const l = localStorage.getItem(SESION), t = sessionStorage.getItem(SESION);
    if (l) return { ...JSON.parse(l), recordar: true };
    if (t) return { ...JSON.parse(t), recordar: false };
  } catch (_) {}
  return null;
}

async function auth(ruta, cuerpo, metodo = "POST", token) {
  const r = await fetch(`${CFG.url}/auth/v1/${ruta}`, {
    method: metodo,
    headers: { apikey: CFG.llave, "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const datos = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(datos.msg || datos.error_description || datos.message || "error"); e.codigo = datos.error_code || datos.code || r.status; throw e; }
  return datos;
}
async function tokenVigente() {
  if (!sesion) return null;
  if (sesion.expires_at - Date.now() / 1000 < 60) {
    const s = await auth("token?grant_type=refresh_token", { refresh_token: sesion.refresh_token });
    guardarSesion(s, sesion.recordar);
  }
  return sesion.access_token;
}
async function datos(ruta, opciones = {}) {
  const token = await tokenVigente();
  const r = await fetch(`${CFG.url}/rest/v1/${ruta}`, {
    ...opciones,
    headers: { apikey: CFG.llave, Authorization: "Bearer " + token, "Content-Type": "application/json", ...(opciones.headers || {}) },
  });
  if (!r.ok) {
    const e = new Error("datos " + r.status);
    const cuerpo = await r.json().catch(() => ({}));
    e.bloqueada = /cuenta_bloqueada/.test(cuerpo.message || "");
    throw e;
  }
  return r.status === 204 ? null : r.json().catch(() => null);
}

// ── pintar el contenido (todo con textContent: nada del JSON se interpreta como HTML) ──
const el = (tag, clase, texto) => {
  const n = document.createElement(tag);
  if (clase) n.className = clase;
  if (texto) n.textContent = texto;
  return n;
};

// ── descargas cifradas: el .bin publicado se descifra aquí con la llave que trae la bóveda ──
async function bajarCifrado(c, boton) {
  if (boton.disabled) return;
  const texto = boton.textContent;
  boton.disabled = true;
  boton.dataset.bajando = "1";
  try {
    const llave = await crypto.subtle.importKey("raw", deB64(c.llave), "AES-GCM", false, ["decrypt"]);
    const partes = c.partes || [{ ruta: c.ruta, iv: c.iv }];
    const total = c.bytes + 16 * partes.length;
    const listos = [];
    let recibidos = 0;
    for (const p of partes) {
      const resp = await fetch(p.ruta, { cache: "no-store" });
      if (!resp.ok || !resp.body) throw new Error("descarga");
      const lector = resp.body.getReader();
      const trozos = [];
      let largo = 0;
      for (;;) {
        const { done, value } = await lector.read();
        if (done) break;
        trozos.push(value);
        largo += value.length;
        recibidos += value.length;
        boton.textContent = `DOWNLOADING ${Math.min(99, Math.round((recibidos / total) * 100))}%`;
      }
      const datos = new Uint8Array(largo);
      let pos = 0;
      for (const t of trozos) { datos.set(t, pos); pos += t.length; }
      listos.push(await crypto.subtle.decrypt({ name: "AES-GCM", iv: deB64(p.iv) }, llave, datos));
    }
    boton.textContent = "PREPARING…";
    const tipo = /\.mp4$/i.test(c.nombre) ? "video/mp4" : "application/zip";
    const url = URL.createObjectURL(new Blob(listos, { type: tipo }));
    const a = el("a");
    a.href = url;
    a.download = c.nombre;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    if (window.umami) window.umami.track("miembros-descarga", { archivo: c.nombre });
    datos("descargas", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ archivo: c.nombre }) }).catch(() => {});
    boton.textContent = "DOWNLOADED ✓";
  } catch (_) {
    boton.textContent = "TRY AGAIN ↓";
  } finally {
    boton.disabled = false;
    delete boton.dataset.bajando;
    setTimeout(() => { if (boton.textContent === "DOWNLOADED ✓") boton.textContent = texto; }, 4000);
  }
}

const idYoutube = (valor) => {
  if (!valor) return "";
  const m = String(valor).match(/(?:youtu\.be\/|v=|embed\/|shorts\/|live\/)([\w-]{11})/);
  return m ? m[1] : /^[\w-]{11}$/.test(valor) ? valor : "";
};

// ── reproductor a pantalla completa (mismo estilo que twowaves.mx) ──
let modalVideo = null;
function crearModal() {
  const d = document.createElement("dialog");
  d.className = "modal-video";
  d.innerHTML = `
    <div class="modal-video_fondo" data-cerrar-modal></div>
    <div class="modal-video_contenido">
      <span class="modal-video_etiqueta"></span>
      <button class="modal-video_cerrar" type="button" data-cerrar-modal>Close ✕</button>
      <div class="modal-video_caja">
        <div class="modal-video_marco"></div>
        <div class="modal-video_info">
          <h3 class="modal-video_titulo"></h3>
          <p class="modal-video_descripcion"></p>
        </div>
      </div>
    </div>`;
  document.body.append(d);
  d.addEventListener("click", (e) => {
    if (e.target.closest("[data-cerrar-modal]") || e.target === d || e.target.classList.contains("modal-video_contenido")) cerrarVideo();
  });
  d.addEventListener("cancel", (e) => { e.preventDefault(); cerrarVideo(); }); // tecla Esc
  return d;
}
function abrirVideo(id, v) {
  modalVideo = modalVideo || crearModal();
  const d = modalVideo;
  d.querySelector(".modal-video_etiqueta").textContent = v.titulo;
  d.querySelector(".modal-video_titulo").textContent = v.titulo;
  const desc = d.querySelector(".modal-video_descripcion");
  desc.textContent = v.descripcion || "";
  desc.hidden = !v.descripcion;
  const f = document.createElement("iframe");
  f.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1&cc_load_policy=1&cc_lang_pref=en&hl=en`;
  f.title = v.titulo;
  f.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
  f.allowFullscreen = true;
  d.querySelector(".modal-video_marco").replaceChildren(f);
  document.documentElement.classList.add("con-modal");
  d.showModal();
  requestAnimationFrame(() => d.classList.add("abierto"));
}
function cerrarVideo() {
  const d = modalVideo;
  if (!d || !d.open) return;
  d.classList.remove("abierto");
  setTimeout(() => {
    d.querySelector(".modal-video_marco").replaceChildren(); // detiene la reproducción
    d.close();
    document.documentElement.classList.remove("con-modal");
  }, 380);
}

function tarjetaVideo(v) {
  const art = el("article", "video");
  const marco = el("div", "video-marco");
  const id = idYoutube(v.youtube);
  if (id) {
    // carga ligera: solo la miniatura; el reproductor de YouTube se carga al dar play
    const play = el("button", "video-play");
    play.type = "button";
    play.setAttribute("aria-label", "Play: " + v.titulo);
    const img = el("img");
    img.src = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
    img.alt = "";
    img.loading = "lazy";
    play.append(img, el("span", "video-play-icono"));
    play.addEventListener("click", () => abrirVideo(id, v));
    marco.append(play);
  } else {
    marco.classList.add("pronto");
    marco.append(el("span", "nota-mono", "COMING SOON"));
  }
  art.append(marco, el("h3", "video-titulo", v.titulo));
  if (v.duracion) art.append(el("p", "video-meta", v.duracion));
  if (v.descripcion) art.append(el("p", "video-desc", v.descripcion));
  return art;
}

function pintar(datos, compra) {
  destino.replaceChildren();
  const intro = el("header", "miembros-intro");
  intro.append(el("p", "kicker", "MEMBERS AREA" + (datos.edicion ? " // " + datos.edicion.toUpperCase() : "")), el("h1", "titulo", "Welcome to SPECTRE."));
  if (datos.bienvenida) intro.append(el("p", "acceso-texto", datos.bienvenida));
  destino.append(intro);

  // recién creó (invitación de compra) o cambió (recuperación) su contraseña desde el correo
  if (compra) {
    const c = el("section", "compra-ok");
    const nueva = compra === "invite";
    c.append(el("p", "kicker", nueva ? "ACCOUNT READY" : "PASSWORD UPDATED"),
      el("h2", "compra-titulo", nueva ? "Thank you for your purchase." : "Your new password is saved."));
    c.append(el("p", "compra-nota", nueva
      ? "Your password is saved. Log in at spectrecolor.com/access with your email and password from any device."
      : "Use it with your email to log in at spectrecolor.com/access from any device."));
    destino.append(c);
  }

  (datos.secciones || []).forEach((s) => {
    const sec = el("section", "miembros-seccion");
    sec.append(el("h2", "miembros-subtitulo", s.titulo));
    const grid = el("div", "videos");
    (s.videos || []).forEach((v) => grid.append(tarjetaVideo(v)));
    sec.append(grid);
    destino.append(sec);
  });

  // términos de la licencia: resumen + enlace + PDF. Las descargas se activan al aceptarlos
  // (se recuerda en este navegador; si cambian los términos, cambiar TERMINOS_VERSION para volver a pedirlo).
  const TERMINOS_VERSION = "2026-10-08";
  const CLAVE_TERMINOS = "spectre-terminos-" + TERMINOS_VERSION;
  let aceptados = false;
  try { aceptados = localStorage.getItem(CLAVE_TERMINOS) === "1"; } catch (_) {}
  const botonesDescarga = [];
  {
    const t = el("section", "miembros-seccion miembros-terminos");
    t.append(el("h2", "miembros-subtitulo", "Terms & License"));
    t.append(el("p", "acceso-texto", "Your purchase is a personal license to use SPECTRE. Before downloading, please keep in mind:"));
    const ul = el("ul", "terminos-lista");
    [
      "Use it on unlimited personal and commercial projects, including client work.",
      "The license is for one person. Teams need one license per user.",
      "Do not share, resell, upload or redistribute the files, your account or the tutorials.",
      "Do not use SPECTRE to create and sell your own LUTs or PowerGrades.",
      "Practice footage is for learning only: not for client work, ads or stock.",
      "All sales are final once the files are downloaded.",
    ].forEach((x) => ul.append(el("li", "", x)));
    t.append(ul);
    const enlaces = el("p", "terminos-enlaces");
    const ver = el("a", "", "Read the full Terms & License");
    ver.href = "/terms"; ver.target = "_blank"; ver.rel = "noopener";
    const pdf = el("a", "", "Download PDF");
    pdf.href = "/legal/SPECTRE-Terms-and-License.pdf"; pdf.download = "SPECTRE Terms & License.pdf";
    enlaces.append(ver, document.createTextNode("  ·  "), pdf);
    t.append(enlaces);
    const etiqueta = el("label", "terminos-acepto");
    const caja = el("input");
    caja.type = "checkbox";
    caja.checked = aceptados;
    etiqueta.append(caja, el("span", "", "I have read and agree to the Terms & License."));
    caja.addEventListener("change", () => {
      aceptados = caja.checked;
      try { aceptados ? localStorage.setItem(CLAVE_TERMINOS, "1") : localStorage.removeItem(CLAVE_TERMINOS); } catch (_) {}
      botonesDescarga.forEach((b) => b.classList.toggle("bloqueado", !aceptados));
      if (aceptados) document.querySelectorAll(".descarga-aviso").forEach((x) => x.remove());
      destino.classList.toggle("terminos-ok", aceptados);
      if (aceptados && window.umami) window.umami.track("miembros-acepta-terminos");
    });
    t.append(etiqueta);
    destino.append(t);
    destino.classList.toggle("terminos-ok", aceptados);
  }

  if ((datos.descargas || []).length) {
    const sec = el("section", "miembros-seccion");
    sec.append(el("h2", "miembros-subtitulo", "Downloads"));
    sec.append(el("p", "terminos-aviso", "Accept the Terms & License above to enable the downloads."));
    const lista = el("ul", "descargas");
    datos.descargas.forEach((d) => {
      const li = el("li", "descarga");
      const info = el("div", "descarga-info");
      info.append(el("p", "descarga-titulo", d.titulo));
      if (d.detalle) info.append(el("p", "descarga-detalle", d.detalle));
      let accion;
      if (d.cifrado) {
        accion = el("button", "descarga-boton", "DOWNLOAD ↓");
        accion.type = "button";
        accion.classList.toggle("bloqueado", !aceptados);
        botonesDescarga.push(accion);
        accion.addEventListener("click", () => {
          if (aceptados) { bajarCifrado(d.cifrado, accion); return; }
          // sin aceptar: aviso junto al botón y se lleva a la casilla, que parpadea
          let aviso = li.querySelector(".descarga-aviso");
          if (!aviso) { aviso = el("p", "descarga-aviso", "↑ Please accept the Terms & License first"); info.append(aviso); }
          const casilla = document.querySelector(".terminos-acepto");
          casilla.scrollIntoView({ behavior: "smooth", block: "center" });
          casilla.classList.remove("llamar"); void casilla.offsetWidth; casilla.classList.add("llamar");
        });
      } else if (d.url) {
        accion = el("a", "descarga-boton", "DOWNLOAD ↓");
        accion.href = d.url;
        accion.target = "_blank";
        accion.rel = "noopener";
      } else {
        accion = el("span", "descarga-boton pronto", "COMING SOON");
      }
      li.append(info, accion);
      lista.append(li);
    });
    sec.append(lista);
    destino.append(sec);
  }

  // LUT Pack: invitación a la edición completa
  if (datos.mejora) {
    const m = el("section", "miembros-mejora");
    m.append(el("p", "acceso-texto", datos.mejora.texto));
    const b = el("a", "btn-compra", datos.mejora.boton || "UPGRADE");
    b.href = datos.mejora.url || "/get";
    m.append(b);
    destino.append(m);
  }

  const pie = el("section", "miembros-pie");
  const ayuda = el("p", "acceso-texto", "Need help? Write to me at ");
  const correo = el("a", "", datos.soporte || "support@spectrecolor.com");
  correo.href = "mailto:" + (datos.soporte || "support@spectrecolor.com");
  ayuda.append(correo, document.createTextNode("."));
  const cerrar = el("button", "link-mono acceso-cerrar", "LOG OUT");
  cerrar.type = "button";
  cerrar.addEventListener("click", async () => {
    try { await auth("logout", null, "POST", await tokenVigente()); } catch (_) {}
    olvidarSesion();
    location.reload();
  });
  pie.append(ayuda, cerrar);
  destino.append(pie);

  candado.hidden = true;
  destino.hidden = false;
}

// ── intro al abrir el área de miembros (la misma animación de la portada: palabras + iconos) ──
const INTRO_VISTA = "spectre-miembros-intro";
const GLIFOS = [
  '<svg class="glyph" viewBox="0 0 100 100" fill="none"><circle cx="50" cy="36" r="22" stroke="currentColor" stroke-width="1.5"/><circle cx="50" cy="64" r="22" stroke="currentColor" stroke-width="1.5"/></svg>',
  '<svg class="glyph" viewBox="0 0 100 100" fill="currentColor"><path d="M50 8 C51.5 34 52 42 66 50 C52 58 51.5 66 50 92 C48.5 66 48 58 34 50 C48 42 48.5 34 50 8 Z"/></svg>',
  '<svg class="glyph" viewBox="0 0 100 100" fill="none"><path d="M40 32 a24 24 0 0 0 0 36" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><path d="M60 32 a24 24 0 0 1 0 36" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><circle cx="50" cy="24" r="3" fill="currentColor"/></svg>',
  '<svg class="glyph" viewBox="0 0 100 100" fill="none"><circle cx="50" cy="50" r="24" stroke="currentColor" stroke-width="2.5"/><line x1="50" y1="20" x2="50" y2="80" stroke="currentColor" stroke-width="1.5"/></svg>',
];
function introMiembros(edicion) {
  const sinMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let vista = false;
  try { vista = sessionStorage.getItem(INTRO_VISTA) === "1"; } catch (_) {}
  if (sinMovimiento || vista) return;
  try { sessionStorage.setItem(INTRO_VISTA, "1"); } catch (_) {}

  const lineasTexto = ["WELCOME TO SPECTRE", (edicion || "MEMBERS AREA").toUpperCase()];
  const capa = document.createElement("div");
  capa.id = "loader";
  capa.setAttribute("aria-hidden", "true");
  capa.innerHTML = `<div class="loader-intro">${lineasTexto.map(() => '<p class="intro-linea"></p>').join("")}</div><div class="loader-glyphs">${GLIFOS.join("")}</div>`;
  const lineas = [...capa.querySelectorAll(".intro-linea")];
  lineas.forEach((linea, k) => {
    lineasTexto[k].split(/\s+/).forEach((palabra, i) => {
      const span = el("span", "palabra", palabra);
      span.style.setProperty("--d", i * 0.09 + "s");
      linea.append(span);
    });
  });
  document.documentElement.classList.remove("sin-intro");
  document.body.append(capa);

  const timers = [];
  const despues = (ms, fn) => timers.push(setTimeout(fn, ms));
  let cerrada = false;
  const cerrar = () => {
    if (cerrada) return;
    cerrada = true;
    timers.forEach(clearTimeout);
    capa.classList.add("fuera");
    setTimeout(() => capa.remove(), 1200);
  };
  const intro = capa.querySelector(".loader-intro");
  const glyphs = capa.querySelectorAll(".glyph");
  let t = 250;
  lineas.forEach((linea) => {
    despues(t, () => linea.classList.add("activa"));
    t += linea.children.length * 90 + 420;
  });
  t += 700;
  despues(t, () => { intro.classList.add("fuera"); capa.classList.add("fase-iconos"); });
  const PASO = 160;
  const secuencia = [...glyphs, ...glyphs];
  secuencia.forEach((g, i) => despues(t + 450 + i * PASO, () => {
    glyphs.forEach((x) => x.classList.remove("activo"));
    g.classList.add("activo");
  }));
  despues(t + 450 + (secuencia.length - 1) * PASO + 650, cerrar);
  capa.addEventListener("click", cerrar, { once: true });
  document.addEventListener("keydown", cerrar, { once: true });
}

// ── vistas del candado: entrar · olvidé · crear contraseña ──
const vistas = [...document.querySelectorAll("[data-vista]")];
function ir(nombre) {
  vistas.forEach((v) => (v.hidden = v.dataset.vista !== nombre));
  vistas.forEach((v) => v.querySelectorAll("[data-error],[data-ok]").forEach((x) => (x.hidden = true)));
  const campo = document.querySelector(`[data-vista="${nombre}"] input`);
  if (campo) setTimeout(() => campo.focus(), 50);
}
document.querySelectorAll("[data-ir]").forEach((b) => b.addEventListener("click", () => {
  if (b.dataset.ir === "olvide") document.getElementById("correo-olvide").value = document.getElementById("correo").value;
  ir(b.dataset.ir);
}));
const mostrarError = (form, texto) => { const e = form.querySelector("[data-error]"); e.textContent = texto; e.hidden = false; };
async function enviando(form, etiqueta, fn) {
  const boton = form.querySelector("button[type=submit]");
  const original = boton.firstChild.textContent;
  form.querySelectorAll("[data-error],[data-ok]").forEach((x) => (x.hidden = true));
  boton.disabled = true;
  boton.firstChild.textContent = etiqueta + " ";
  try { await fn(); } finally { boton.disabled = false; boton.firstChild.textContent = original; }
}
const SOPORTE = "support@spectrecolor.com";

// ── abrir el área: pide a la base de datos lo que esta cuenta compró ──
async function abrirArea(recienCreada) {
  // el servidor registra la entrada (IP y dispositivo), revisa los límites y solo entonces entrega el contenido
  let filas;
  try {
    filas = await datos("rpc/abrir_area", { method: "POST", body: "{}" });
    if (Array.isArray(filas) && filas.some((f) => f.id === "bloqueada")) { const e = new Error("bloqueada"); e.bloqueada = true; throw e; }
  } catch (err) {
    if (err.bloqueada) {
      candado.hidden = false;
      destino.hidden = true;
      ir("entrar");
      mostrarError(document.querySelector('[data-form="entrar"]'), `This account was paused for unusual activity (too many logins or devices). If you think this is a mistake, write to ${SOPORTE}.`);
      olvidarSesion();
      return;
    }
    throw err;
  }
  if (!filas || !filas.length) {
    // tiene cuenta pero ninguna compra activa (por ejemplo, reembolsada)
    candado.hidden = false;
    destino.hidden = true;
    ir("entrar");
    mostrarError(document.querySelector('[data-form="entrar"]'), `This account has no active purchase. If you think this is a mistake, write to ${SOPORTE}.`);
    olvidarSesion();
    return;
  }
  const fila = filas.find((f) => f.id === "full") || filas[0]; // Full System incluye todo lo del LUT Pack
  introMiembros(fila.contenido.edicion);
  pintar(fila.contenido, recienCreada);
  window.scrollTo(0, 0);
}

document.querySelector('[data-form="entrar"]').addEventListener("submit", (e) => {
  e.preventDefault();
  const f = e.currentTarget;
  const correo = f.correo.value.trim().toLowerCase();
  if (!correo || !f.clave.value) return mostrarError(f, "Enter your email and password.");
  enviando(f, "LOGGING IN…", async () => {
    try {
      const s = await auth("token?grant_type=password", { email: correo, password: f.clave.value });
      guardarSesion(s, f.recordar.checked);
      f.clave.value = "";
      if (window.umami) window.umami.track("miembros-entra");
      await abrirArea(false);
    } catch (err) {
      if (window.umami) window.umami.track("miembros-error-entrar");
      mostrarError(f, /rate|too many/i.test(err.message) || err.codigo === 429
        ? "Too many attempts. Wait a few minutes and try again."
        : "Email or password incorrect. If you haven't created your password yet, use the link in your purchase email or “Forgot your password?”.");
      f.clave.select();
    }
  });
});

document.querySelector('[data-form="olvide"]').addEventListener("submit", (e) => {
  e.preventDefault();
  const f = e.currentTarget;
  const correo = f.correo.value.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(correo)) return mostrarError(f, "Enter a valid email.");
  enviando(f, "SENDING…", async () => {
    try {
      await auth(`recover?redirect_to=${encodeURIComponent(location.origin + location.pathname)}`, { email: correo });
    } catch (err) {
      if (err.codigo === 429 || /rate/i.test(err.message)) return mostrarError(f, "Too many requests. Wait a few minutes and try again.");
      // cualquier otro error se calla: no se revela si un correo tiene cuenta o no
    }
    f.querySelector("[data-ok]").hidden = false;
  });
});

let tokenDelCorreo = null;
let tipoDelCorreo = "invite";
document.querySelector('[data-form="crear"]').addEventListener("submit", (e) => {
  e.preventDefault();
  const f = e.currentTarget;
  const a = f.nueva.value, b = f.nueva2.value;
  if (a.length < 10 || !/[a-z]/.test(a) || !/[A-Z]/.test(a) || !/\d/.test(a)) return mostrarError(f, "Use at least 10 characters, with uppercase, lowercase and a number.");
  if (a !== b) return mostrarError(f, "The passwords don't match.");
  enviando(f, "SAVING…", async () => {
    try {
      await auth("user", { password: a }, "PUT", tokenDelCorreo.access_token);
      guardarSesion(tokenDelCorreo, true);
      f.reset();
      if (window.umami) window.umami.track("miembros-crea-clave");
      await abrirArea(tipoDelCorreo);
    } catch (err) {
      mostrarError(f, /weak|pwned|leaked/i.test(err.message) ? "That password is too easy to guess. Choose another one."
        : /same/i.test(err.message) ? "Choose a password different from your previous one."
        : "The link expired or was already used. Use “Forgot your password?” to get a new one.");
    }
  });
});

// ── al cargar: link del correo (#access_token…&type=invite|recovery) o sesión guardada ──
(async () => {
  if (!CFG.url) return;
  const h = new URLSearchParams(location.hash.slice(1));
  if (h.has("access_token") || h.has("token_hash") || h.has("error")) history.replaceState(null, "", location.pathname); // el token no se queda en la barra
  if (h.get("error")) {
    ir("olvide");
    mostrarError(document.querySelector('[data-form="olvide"]'), "That link expired or was already used. Enter your email to get a new one.");
    return;
  }
  // link del correo: #token_hash=…&type=invite|recovery. Se canjea aquí (no al abrir el correo), así los
  // revisores automáticos de correo que abren los links no lo gastan.
  if (h.get("token_hash") && /invite|recovery/.test(h.get("type") || "")) {
    try {
      const s = await auth("verify", { type: h.get("type"), token_hash: h.get("token_hash") });
      h.set("access_token", s.access_token); h.set("refresh_token", s.refresh_token); h.set("expires_in", s.expires_in);
    } catch (_) {
      ir("olvide");
      mostrarError(document.querySelector('[data-form="olvide"]'), "That link expired or was already used. Enter your email to get a new one.");
      return;
    }
  }
  if (h.get("access_token") && /invite|recovery|signup|magiclink/.test(h.get("type") || "")) {
    tokenDelCorreo = { access_token: h.get("access_token"), refresh_token: h.get("refresh_token"), expires_in: Number(h.get("expires_in")) || 3600 };
    tipoDelCorreo = h.get("type") === "recovery" ? "recovery" : "invite";
    if (h.get("type") === "recovery") {
      document.querySelector("[data-crear-titulo]").textContent = "Choose a new password.";
      document.querySelector("[data-crear-texto]").textContent = "Your new password replaces the old one on every device.";
    }
    document.querySelector("[data-vista-kicker]").textContent = h.get("type") === "invite" ? "PAYMENT CONFIRMED" : "MEMBERS AREA";
    ir("crear");
    return;
  }
  const g = leerSesion();
  if (!g) return;
  try {
    const s = await auth("token?grant_type=refresh_token", { refresh_token: g.refresh_token });
    guardarSesion(s, g.recordar);
    await abrirArea(false);
  } catch (_) {
    olvidarSesion();
  }
})();
