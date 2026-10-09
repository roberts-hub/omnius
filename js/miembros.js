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
    play.addEventListener("click", () => {
      const f = document.createElement("iframe");
      f.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;
      f.title = v.titulo;
      f.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
      f.allowFullscreen = true;
      marco.replaceChildren(f);
    });
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

  // Two Waves Academy: lista de espera (js/waitlist.js)
  if (window.montarWaitlist) window.montarWaitlist(destino);

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
    pintar(r.datos);
    window.scrollTo(0, 0);
  } catch (_) {
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
    pintar(await abrir(llave, paquete));
  } catch (_) {
    olvidar();
  }
})();
