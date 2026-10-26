// SPECTRE · panel /admin → Reviews: aprobar u ocultar los reviews de compradores verificados.
// Solo existe en el panel (lo agrega herramientas/admin/generar.py). Usa las funciones admin_reviews y
// admin_review_estado de Supabase, que revisan que la sesión sea de una cuenta en public.admins.
(() => {
  const $ = (s) => document.querySelector(s);
  const API = () => window.SPECTRE_ADMIN;
  let cargando = false;

  const bandera = (c) => (/^[A-Z]{2}$/.test(String(c || "")) ? String.fromCodePoint(...[...c].map((l) => 0x1f1a5 + l.charCodeAt(0))) : "");
  let nombres; try { nombres = new Intl.DisplayNames(["es"], { type: "region" }); } catch (_) { nombres = null; }
  const pais = (c) => { try { return (nombres && /^[A-Z]{2}$/.test(c) && nombres.of(c)) || c || ""; } catch (_) { return c || ""; } };
  const fecha = (iso) => { const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleDateString("es-MX", { day: "numeric", month: "short", timeZone: "America/Mexico_City" }); };
  const el = (tag, clase, texto) => { const e = document.createElement(tag); if (clase) e.className = clase; if (texto != null) e.textContent = texto; return e; };
  const ESTADOS = { pendiente: ["Por aprobar", "av"], aprobado: ["Publicado", "ok"], oculto: ["Oculto", "mal"] };

  function pintar(d) {
    const lista = d.lista || [];
    const pendientes = lista.filter((r) => r.estado === "pendiente").length;
    const publicados = lista.filter((r) => r.estado === "aprobado");
    const prom = publicados.length ? publicados.reduce((s, r) => s + r.estrellas, 0) / publicados.length : null;
    $("#rv-promedio").textContent = prom == null ? "—" : prom.toFixed(1) + " ★";
    $("#rv-publicados").textContent = publicados.length;
    $("#rv-pendientes").textContent = pendientes;
    $("#rv-invitados").textContent = d.invitados || 0;
    $("#rv-sin").textContent = d.invitados ? `${d.sin_escribir || 0} todavía no escriben` : "El primer correo sale a los 7 días de cada compra";
    const insignia = $("#reviews-pend");
    insignia.textContent = pendientes; insignia.hidden = !pendientes;
    $("#rv-lado").textContent = lista.length ? `${lista.length} en total` : "";

    const caja = $("#rv-lista"); caja.replaceChildren();
    if (!lista.length) { caja.append(el("p", "rv-vacio", "Todavía no hay reviews. Cuando alguien escriba uno te llega un aviso al celular y aparece aquí para aprobarlo.")); return; }
    for (const r of lista) {
      const art = el("article", "rv-item" + (r.estado === "pendiente" ? " nuevo" : ""));
      const cab = el("div", "rv-cab");
      const est = el("span", "rv-estrellas", "★".repeat(r.estrellas) + "☆".repeat(5 - r.estrellas));
      est.setAttribute("aria-label", r.estrellas + " de 5 estrellas");
      const [txt, cls] = ESTADOS[r.estado] || [r.estado, ""];
      cab.append(est, el("span", "pill " + cls, txt), el("span", "rv-fecha", fecha(r.escrita)));
      const quien = el("p", "rv-quien");
      quien.append(el("b", "", r.nombre || "—"));
      if (r.instagram) {
        const a = el("a", "rv-ig", "@" + r.instagram);
        a.href = "https://www.instagram.com/" + encodeURIComponent(r.instagram) + "/"; a.target = "_blank"; a.rel = "noopener noreferrer";
        quien.append(" · ", a);
      }
      const extra = [(bandera(r.pais) + " " + pais(r.pais)).trim(), r.producto === "full" ? "Full System" : "LUT Pack"].filter(Boolean).join(" · ");
      if (extra) quien.append(" · " + extra);
      const texto = el("p", "rv-texto", r.texto || "");
      const pie = el("div", "rv-pie");
      pie.append(el("span", "rv-correo", r.email));
      const acciones = el("div", "rv-acciones");
      const boton = (etq, estado, sec) => {
        const b = el("button", "sx-boton" + (sec ? " sec" : ""), etq); b.type = "button";
        b.addEventListener("click", () => cambiar(r.id, estado, b));
        acciones.append(b);
      };
      if (r.estado !== "aprobado") boton("Publicar", "aprobado");
      if (r.estado !== "oculto") boton(r.estado === "aprobado" ? "Quitar de la página" : "Ocultar", "oculto", true);
      pie.append(acciones);
      art.append(cab, quien, texto, pie);
      caja.append(art);
    }
  }

  async function cargar() {
    if (cargando || !API()) return;
    cargando = true;
    try { pintar(await API().rpc("admin_reviews")); }
    catch (e) { $("#rv-lista").replaceChildren(el("p", "rv-vacio", "No se pudieron cargar los reviews. Toca Reviews otra vez para reintentar.")); }
    finally { cargando = false; }
  }

  async function cambiar(id, estado, b) {
    b.disabled = true; b.textContent = "Guardando…";
    try { await API().rpc("admin_review_estado", { p_id: id, p_estado: estado }); }
    catch (_) { b.textContent = "No se pudo"; setTimeout(cargar, 1500); return; }
    cargar();
  }

  document.addEventListener("click", (ev) => { if (ev.target.closest("#tab-reviews")) cargar(); });
  // la insignia de "por aprobar" se actualiza al abrir el panel y cada 5 minutos
  const revisar = () => { if (document.visibilityState === "visible" && !$("#dash-root").hidden) cargar(); };
  setTimeout(revisar, 1500);
  setInterval(revisar, 5 * 60 * 1000);
  document.addEventListener("visibilitychange", revisar);
})();
