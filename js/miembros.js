// ══════════ SPECTRE — área de miembros (access.html) ══════════
// El contenido llega cifrado (AES-GCM, llave derivada de la contraseña con PBKDF2-SHA256) y solo se
// descifra aquí, en el navegador, con la contraseña correcta. Ver herramientas/miembros.mjs.

// Una bóveda por edición (Full System y LUT Pack), cada una con su propia contraseña:
// la contraseña de una no puede descifrar la otra.
const crudo = JSON.parse(document.getElementById("contenido-cifrado").textContent || "null");
const paquetes = Array.isArray(crudo) ? crudo : crudo ? [crudo] : [];
const candado = document.querySelector("[data-candado]");
const form = document.querySelector("[data-acceso-form]");
const error = document.querySelector("[data-acceso-error]");
const destino = document.querySelector("[data-contenido]");
const GUARDADO = "spectre-acceso";

const deB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const aB64 = (b) => btoa(String.fromCharCode(...new Uint8Array(b)));

const guardar = (valor) => { try { localStorage.setItem(GUARDADO, valor); } catch (_) {} };
const leerGuardado = () => { try { return JSON.parse(localStorage.getItem(GUARDADO) || "null"); } catch (_) { return null; } };
const olvidar = () => { try { localStorage.removeItem(GUARDADO); } catch (_) {} };

async function llaveDe(clave, paquete, extraible) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(clave), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: deB64(paquete.sal), iterations: paquete.iter, hash: "SHA-256" },
    base, { name: "AES-GCM", length: 256 }, extraible, ["decrypt"]
  );
}

async function abrir(llave, paquete) {
  const plano = await crypto.subtle.decrypt({ name: "AES-GCM", iv: deB64(paquete.iv) }, llave, deB64(paquete.datos));
  return JSON.parse(new TextDecoder().decode(plano));
}

// prueba la contraseña contra cada bóveda; devuelve la que abre (o null)
async function probar(clave, extraible) {
  for (const paquete of paquetes) {
    try {
      const llave = await llaveDe(clave, paquete, extraible);
      return { paquete, llave, datos: await abrir(llave, paquete) };
    } catch (_) {}
  }
  return null;
}

// ── pintar el contenido (todo con textContent: nada del JSON se interpreta como HTML) ──
const el = (tag, clase, texto) => {
  const n = document.createElement(tag);
  if (clase) n.className = clase;
  if (texto) n.textContent = texto;
  return n;
};

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

function pintar(datos) {
  destino.replaceChildren();
  const intro = el("header", "miembros-intro");
  intro.append(el("p", "kicker", "MEMBERS AREA" + (datos.edicion ? " // " + datos.edicion.toUpperCase() : "")), el("h1", "titulo", "Welcome to SPECTRE."));
  if (datos.bienvenida) intro.append(el("p", "acceso-texto", datos.bienvenida));
  destino.append(intro);

  (datos.secciones || []).forEach((s) => {
    const sec = el("section", "miembros-seccion");
    sec.append(el("h2", "miembros-subtitulo", s.titulo));
    const grid = el("div", "videos");
    (s.videos || []).forEach((v) => grid.append(tarjetaVideo(v)));
    sec.append(grid);
    destino.append(sec);
  });

  if ((datos.descargas || []).length) {
    const sec = el("section", "miembros-seccion");
    sec.append(el("h2", "miembros-subtitulo", "Downloads"));
    const lista = el("ul", "descargas");
    datos.descargas.forEach((d) => {
      const li = el("li", "descarga");
      const info = el("div", "descarga-info");
      info.append(el("p", "descarga-titulo", d.titulo));
      if (d.detalle) info.append(el("p", "descarga-detalle", d.detalle));
      let accion;
      if (d.url) {
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
  const correo = el("a", "", datos.soporte || "roberto@arechederra.com");
  correo.href = "mailto:" + (datos.soporte || "roberto@arechederra.com");
  ayuda.append(correo, document.createTextNode("."));
  const cerrar = el("button", "link-mono acceso-cerrar", "LOCK THIS DEVICE");
  cerrar.type = "button";
  cerrar.addEventListener("click", () => { olvidar(); location.reload(); });
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

// ── entrar con contraseña ──
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!paquetes.length) return;
  const boton = form.querySelector("button");
  const clave = form.clave.value.trim().toUpperCase();
  const recordar = form.recordar.checked;
  error.hidden = true;
  boton.disabled = true;
  boton.firstChild.textContent = "UNLOCKING… ";
  try {
    const r = await probar(clave, recordar);
    if (!r) throw new Error("no abre");
    if (recordar) guardar(JSON.stringify({ sal: r.paquete.sal, llave: aB64(await crypto.subtle.exportKey("raw", r.llave)) }));
    introMiembros(r.datos.edicion);
    pintar(r.datos);
    if (window.umami) window.umami.track("miembros-entra", { edicion: r.datos.edicion || "" });
    window.scrollTo(0, 0);
  } catch (_) {
    if (window.umami) window.umami.track("miembros-clave-incorrecta");
    error.hidden = false;
    form.clave.select();
  } finally {
    boton.disabled = false;
    boton.firstChild.textContent = "UNLOCK ";
  }
});

// ── dispositivo recordado: se abre solo (si la contraseña cambió, se vuelve a pedir) ──
(async () => {
  const g = leerGuardado();
  const paquete = g && paquetes.find((p) => p.sal === g.sal);
  if (!paquete) { if (g) olvidar(); return; }
  try {
    const llave = await crypto.subtle.importKey("raw", deB64(g.llave), "AES-GCM", false, ["decrypt"]);
    const datos = await abrir(llave, paquete);
    introMiembros(datos.edicion);
    pintar(datos);
  } catch (_) {
    olvidar();
  }
})();
