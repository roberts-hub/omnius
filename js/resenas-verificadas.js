// SPECTRE · reviews de compradores verificados en el carrusel de reseñas de la landing.
// Los escriben los compradores con el link del correo de los 7 días y solo salen los que Roberto publica en
// /admin → Reviews (función pública reviews_publicos de Supabase, sin correos). Se agregan al inicio del
// carrusel ANTES de que js/main.js lo arme (main.js espera a window.SPECTRE_RESENAS, máximo 2.5 s).
(() => {
  const CFG = window.SPECTRE_CUENTAS;
  const pista = document.querySelector(".resenas-pista");
  if (!CFG || !pista) return;
  const es = /^es/i.test(document.documentElement.lang || "");
  const TXT = es
    ? { verificado: "COMPRADOR VERIFICADO", estrellas: (n) => `${n} de 5 estrellas`, promedio: (p, n) => `${p} de 5 · ${n} compradores verificados` }
    : { verificado: "VERIFIED BUYER", estrellas: (n) => `${n} out of 5 stars`, promedio: (p, n) => `${p} out of 5 · ${n} verified buyers` };
  const PRODUCTO = { full: "FULL SYSTEM", luts: "LUT PACK" };
  let cerrado = false;

  const el = (tag, clase, texto) => { const e = document.createElement(tag); if (clase) e.className = clase; if (texto != null) e.textContent = texto; return e; };
  const iniciales = (n) => String(n || "").trim().split(/\s+/).slice(0, 2).map((p) => p[0] || "").join("").toUpperCase() || "·";

  function tarjeta(r) {
    const fig = el("figure", "resena resena-verificada");
    const autor = el("figcaption", "resena-autor");
    // con Instagram, el nombre lleva a su perfil (como las reseñas de los creadores)
    const ig = /^[a-z0-9._]{1,30}$/.test(r.instagram || "") ? r.instagram : "";
    const perfil = el(ig ? "a" : "span", "resena-perfil");
    if (ig) {
      perfil.href = "https://www.instagram.com/" + ig + "/";
      perfil.target = "_blank"; perfil.rel = "noopener nofollow ugc";
      perfil.dataset.umamiEvent = "resena-instagram";
    }
    const avatar = el("span", "resena-avatar resena-iniciales", iniciales(r.nombre));
    avatar.setAttribute("aria-hidden", "true");
    const quien = el("span", "resena-quien");
    quien.append(el("span", "resena-nombre", r.nombre));
    if (ig) quien.append(el("span", "resena-ig", "@" + ig));
    perfil.append(avatar, quien);
    autor.append(perfil);
    if (/^[A-Z]{2}$/.test(r.pais || "")) autor.append(el("span", "resena-pais", r.pais));
    const n = Math.max(1, Math.min(5, Number(r.estrellas) || 5));
    const estrellas = el("p", "resena-estrellas", "★".repeat(n));
    if (n < 5) estrellas.append(el("span", "resena-estrella-vacia", "★".repeat(5 - n)));
    estrellas.setAttribute("aria-label", TXT.estrellas(n));
    const marca = el("p", "resena-verificado", `✓ ${TXT.verificado}${PRODUCTO[r.producto] ? " · " + PRODUCTO[r.producto] : ""}`);
    const texto = el("blockquote", "resena-texto", r.texto);
    fig.append(autor, estrellas, marca, texto);
    return fig;
  }

  function insertar(d) {
    if (cerrado || !d || !Array.isArray(d.lista) || !d.lista.length) return;
    const primera = pista.firstElementChild;
    for (const r of d.lista) pista.insertBefore(tarjeta(r), primera);
    if (d.total >= 3 && d.promedio) {
      const titulo = document.getElementById("titulo-resenas");
      if (titulo) titulo.after(el("p", "resenas-promedio", "★ " + TXT.promedio(Number(d.promedio).toFixed(1), d.total)));
    }
  }

  const carga = fetch(`${CFG.url}/rest/v1/rpc/reviews_publicos`, {
    method: "POST",
    headers: { apikey: CFG.llave, Authorization: "Bearer " + CFG.llave, "Content-Type": "application/json" },
    body: "{}",
  }).then((r) => (r.ok ? r.json() : null)).then(insertar).catch(() => {});
  // si Supabase tarda, el carrusel arranca igual con las reseñas de siempre (y ya no se agregan tarjetas)
  window.SPECTRE_RESENAS = Promise.race([carga, new Promise((ok) => setTimeout(ok, 2500))]).then(() => { cerrado = true; });
})();
