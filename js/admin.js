// SPECTRE · panel privado (spectrecolor.com/admin).
// A simple vista es un error 404; un botón invisible abajo al centro abre la entrada. El dispositivo queda recordado.
// Entra con la cuenta de SPECTRE (correo y contraseña de Supabase). Los datos solo llegan si el correo está en
// public.admins: las funciones admin_vivo() y admin_archivos() lo revisan en el servidor. Esta página no trae datos.
// Además hace de "dash" para el tablero (js/admin-tablero.js, el mismo diseño del tablero de Claude):
// ventas y personas en el sitio se piden cada 20 s; lo de cada hora (Umami, Stripe, cuentas, sistema) cada 5 min.
(() => {
  const CFG = window.SPECTRE_CUENTAS;
  const SESION = "spectre-admin-sesion", PERIODO = "spectre-admin-periodo";
  const VIVO_MS = 20000, ARCHIVOS_MS = 300000;
  const $ = (s) => document.querySelector(s);

  // ── sesión ──
  let sesion = null; // { access_token, refresh_token, expires_at, recordar }
  const guardarSesion = (s, recordar) => {
    sesion = { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: Date.now() / 1000 + (s.expires_in || 3600), recordar };
    try {
      localStorage.removeItem(SESION); sessionStorage.removeItem(SESION);
      (recordar ? localStorage : sessionStorage).setItem(SESION, JSON.stringify({ refresh_token: sesion.refresh_token }));
    } catch (_) {}
  };
  const borrarSesion = () => { sesion = null; try { localStorage.removeItem(SESION); sessionStorage.removeItem(SESION); } catch (_) {} };
  async function auth(ruta, cuerpo) {
    const r = await fetch(`${CFG.url}/auth/v1/${ruta}`, { method: "POST", headers: { apikey: CFG.llave, "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(d.msg || d.error_description || d.message || "error"); e.codigo = d.error_code || d.code || r.status; throw e; }
    return d;
  }
  async function tokenVigente() {
    if (!sesion) throw Object.assign(new Error("sin sesión"), { codigo: 401 });
    if (sesion.expires_at - Date.now() / 1000 < 60) guardarSesion(await auth("token?grant_type=refresh_token", { refresh_token: sesion.refresh_token }), sesion.recordar);
    return sesion.access_token;
  }
  async function rpc(nombre) {
    const token = await tokenVigente();
    const r = await fetch(`${CFG.url}/rest/v1/rpc/${nombre}`, { method: "POST", headers: { apikey: CFG.llave, Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: "{}" });
    const d = await r.json().catch(() => null);
    if (!r.ok) throw Object.assign(new Error((d && d.message) || "error " + r.status), { codigo: (d && d.code) || r.status });
    return d;
  }

  // ── "dash": lo que el tablero espera ──
  const crudo = {}; // id → { data, status, at, message }
  const calcs = {}, subs = [];
  let refrescando = false, cache = new Map(), version = 0;
  const filas = (id) => { const d = window.dash.data(id); return d.status === "ok" ? d.data : []; };
  const avisar = () => { version++; cache = new Map(); for (const f of subs) { try { f(); } catch (e) { console.error(e); } } };
  let params = { periodo: "hoy" };
  try { const p = localStorage.getItem(PERIODO); if (p) params.periodo = p; } catch (_) {}
  window.dash = {
    data(id) {
      if (calcs[id]) {
        if (cache.has(id)) return cache.get(id);
        const c = calcs[id];
        const ins = c.inputs.map((i) => window.dash.data(i));
        let r;
        if (ins.some((x) => x.status === "error")) r = { status: "error", data: [], meta: [] };
        else if (ins.some((x) => x.status !== "ok")) r = { status: "loading", data: [], meta: [] };
        else { try { r = { status: "ok", data: c.fn(...ins.map((x) => x.data)), meta: [] }; } catch (e) { console.error(id, e); r = { status: "error", data: [], meta: [], message: String(e) }; } }
        cache.set(id, r);
        return r;
      }
      const d = crudo[id];
      if (!d) return { status: "loading", data: [], meta: [], refreshing: false };
      return { status: d.status, data: d.data, columns: Object.keys(d.data[0] || {}), meta: [], refreshing: refrescando, message: d.message };
    },
    calc(id, def) { calcs[id] = def; },
    loader() {},
    onData(fn) { subs.push(fn); fn(); },
    params() { return { ...params }; },
    setParams(p) { params = { ...params, ...p }; try { localStorage.setItem(PERIODO, params.periodo); } catch (_) {} avisar(); },
    resetParams() { params = { periodo: "hoy" }; avisar(); },
    setLink(n) { if (!document.body.classList.contains("en-panel")) return; try { history.replaceState(null, "", "#" + n); } catch (_) {} }, // con el 404 a la vista, la dirección queda limpia
    refresh() { cargarVivo(); },
    colors: [],
  };
  addEventListener("resize", () => { clearTimeout(window.__sxAncho); window.__sxAncho = setTimeout(avisar, 120); });

  // ── carga de datos ──
  let cargandoVivo = false;
  async function cargarVivo() {
    if (cargandoVivo) return;
    cargandoVivo = true; refrescando = true; avisar();
    try {
      const r = await rpc("admin_vivo");
      crudo.ventas = { status: "ok", data: r.ventas || [] };
      crudo.presencia = { status: "ok", data: r.presencia || [] };
    } catch (e) { if (!manejarError(e)) { crudo.ventas = crudo.ventas || { status: "error", data: [] }; } }
    refrescando = false; cargandoVivo = false; avisar();
  }
  async function cargarArchivos() {
    try {
      const r = await rpc("admin_archivos");
      for (const [id, v] of Object.entries(r || {})) crudo[id] = { status: "ok", data: Array.isArray(v.datos) ? v.datos : [], at: v.actualizado };
      for (const id of ["usuarios", "trafico", "eventos", "paginas", "fuentes", "paises", "dispositivos", "ciudades", "navegadores", "sistemas", "salud", "respaldos", "codigos", "ventas_stripe", "en_vivo", "tipo_cambio"]) if (!crudo[id]) crudo[id] = { status: "ok", data: [] };
    } catch (e) { manejarError(e); }
    avisar();
  }
  // sin permiso o sesión vencida → regresa a la pantalla de entrada
  function manejarError(e) {
    if (e.codigo === "42501" || e.codigo === 401 || e.codigo === "PGRST301" || /jwt|refresh|sin sesión/i.test(e.message)) {
      const sinPermiso = e.codigo === "42501";
      salir(sinPermiso ? "Esta cuenta no tiene acceso al panel." : "Tu sesión terminó. Vuelve a entrar.");
      return true;
    }
    console.error(e);
    return false;
  }

  // al abrir el panel, las cifras de dinero suben de $0 a su valor (una sola vez; sin animación si el sistema pide menos movimiento)
  function animarDinero() {
    const listo = () => document.body.classList.remove("por-contar");
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return listo();
    const els = [...document.querySelectorAll('[data-source="resumen"][data-field="total_mxn"], [data-source="resumen"][data-field="ingresos_usd"], [data-source="resumen"][data-field="ingresos_mxn"]')];
    const metas = els.map((el) => Number(String(el.textContent).replace(/[^0-9.-]/g, "")));
    if (!els.length || metas.every((m) => !isFinite(m) || m <= 0)) return listo();
    const fmt = (n) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const DURA = 1400, t0 = performance.now();
    els.forEach((el) => (el.textContent = fmt(0))); listo();
    const paso = () => {
      const k = Math.min(1, (performance.now() - t0) / DURA), e = 1 - Math.pow(1 - k, 3);
      els.forEach((el, i) => { if (isFinite(metas[i])) el.textContent = fmt(metas[i] * e); });
      if (k < 1) setTimeout(paso, 16); else avisar(); // al final el tablero vuelve a poner la cifra exacta
    };
    paso();
  }

  let relojVivo = null, relojArchivos = null;
  function arrancar() {
    $("#acceso").hidden = true; $("#dash-root").hidden = false; document.body.classList.add("en-panel");
    document.title = "SPECTRE · Panel";
    avisar();
    document.body.classList.add("por-contar"); // el dinero no se ve hasta que empieza a contar desde $0
    Promise.all([cargarVivo(), cargarArchivos()]).then(animarDinero, () => document.body.classList.remove("por-contar"));
    clearInterval(relojVivo); clearInterval(relojArchivos);
    relojVivo = setInterval(() => { if (document.visibilityState === "visible") cargarVivo(); }, VIVO_MS);
    relojArchivos = setInterval(() => { if (document.visibilityState === "visible") cargarArchivos(); }, ARCHIVOS_MS);
  }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && sesion) cargarVivo(); });
  function salir(mensaje) {
    borrarSesion(); clearInterval(relojVivo); clearInterval(relojArchivos);
    for (const k of Object.keys(crudo)) delete crudo[k];
    $("#dash-root").hidden = true; $("#acceso").hidden = false; document.body.classList.remove("en-panel");
    document.title = "Page not found | SPECTRE";
    try { history.replaceState(null, "", location.pathname); } catch (_) {}
    // con aviso (sesión vencida o cuenta sin permiso) se queda la entrada a la vista; sin aviso vuelve el 404
    $("#falso").hidden = !!mensaje; $("#acceso-form").hidden = !mensaje;
    $("#acceso-error").textContent = mensaje || "";
  }

  // ── entrada ──
  $("#acceso-form").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const f = ev.currentTarget, boton = f.querySelector("button");
    $("#acceso-error").textContent = ""; boton.disabled = true; boton.textContent = "Entrando…";
    try {
      const s = await auth("token?grant_type=password", { email: f.correo.value.trim().toLowerCase(), password: f.clave.value });
      guardarSesion(s, true);
      f.clave.value = "";
      const ok = await rpc("es_admin");
      if (ok !== true) { salir("Esta cuenta no tiene acceso al panel."); return; }
      arrancar();
    } catch (e) {
      $("#acceso-error").textContent = /invalid/i.test(e.message) ? "Correo o contraseña incorrectos." : /rate|too many/i.test(e.message) ? "Demasiados intentos. Espera unos minutos." : "No se pudo entrar. Revisa tu conexión e intenta de nuevo.";
    } finally { boton.disabled = false; boton.textContent = "Entrar"; }
  });

  // botón invisible: cambia el 404 por la entrada
  $("#abrir-acceso").addEventListener("click", () => { $("#falso").hidden = true; $("#acceso-form").hidden = false; $("#correo").focus(); });

  // cerrar sesión (botón en la barra lateral)
  document.addEventListener("click", (ev) => { if (ev.target.closest("#salir")) { ev.preventDefault(); salir(""); } });

  // sesión guardada en este dispositivo
  (async () => {
    let g = null, recordar = false;
    try { const l = localStorage.getItem(SESION), t = sessionStorage.getItem(SESION); g = JSON.parse(l || t || "null"); recordar = !!l; } catch (_) {}
    if (!g || !g.refresh_token) return;
    try {
      guardarSesion(await auth("token?grant_type=refresh_token", { refresh_token: g.refresh_token }), recordar);
      if ((await rpc("es_admin")) === true) arrancar(); else salir("Esta cuenta no tiene acceso al panel.");
    } catch (_) { salir(""); }
  })();
})();
