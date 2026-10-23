// SPECTRE · panel privado (spectrecolor.com/admin).
// A simple vista es un error 404; un botón invisible abajo al centro abre la entrada. El dispositivo queda recordado.
// Entra con la cuenta de SPECTRE (correo y contraseña de Supabase). Los datos solo llegan si el correo está en
// public.admins: las funciones admin_vivo() y admin_archivos() lo revisan en el servidor. Esta página no trae datos.
// Además hace de "dash" para el tablero (js/admin-tablero.js, el mismo diseño del tablero de Claude):
// ventas y personas en el sitio se piden cada 20 s; lo de cada hora (Umami, Stripe, cuentas, sistema) cada 5 min.
(() => {
  const CFG = window.SPECTRE_CUENTAS;
  const SESION = "spectre-admin-sesion", PERIODO = "spectre-admin-periodo", COPIA = "spectre-admin-copia";
  const VIVO_MS = 20000, ARCHIVOS_MS = 300000;
  const $ = (s) => document.querySelector(s);
  if (location.hash) try { history.replaceState(null, "", location.pathname); } catch (_) {}

  // ── sesión ──
  let sesion = null; // { access_token, refresh_token, expires_at, recordar }
  const guardarSesion = (s, recordar) => {
    sesion = { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: Date.now() / 1000 + (s.expires_in || 3600), recordar };
    try {
      localStorage.removeItem(SESION); sessionStorage.removeItem(SESION);
      (recordar ? localStorage : sessionStorage).setItem(SESION, JSON.stringify({ refresh_token: sesion.refresh_token, access_token: sesion.access_token, expires_at: sesion.expires_at }));
    } catch (_) {}
  };
  const borrarSesion = () => { sesion = null; try { localStorage.removeItem(SESION); sessionStorage.removeItem(SESION); localStorage.removeItem(COPIA); } catch (_) {} };

  // copia de los últimos números en este dispositivo: el panel abre al instante con ellos y se actualiza en cuanto llegan
  // los nuevos (sin la lista de cuentas, que lleva correos de clientes)
  const guardarCopia = () => { try { const c = {}; for (const [k, v] of Object.entries(crudo)) if (k !== "usuarios" && v.status === "ok") c[k] = v.data; localStorage.setItem(COPIA, JSON.stringify(c)); } catch (_) {} };
  const leerCopia = () => { try { return JSON.parse(localStorage.getItem(COPIA) || "null"); } catch (_) { return null; } };

  // versión nueva publicada: la app de la pantalla de inicio guarda la página vieja, así que al abrir o volver se revisa
  // y se recarga sola una vez si hay otra versión
  const VERSION = (document.querySelector('meta[name="version"]') || {}).content || "";
  async function revisarVersion() {
    try {
      const html = await (await fetch("/admin?nc=" + Date.now(), { cache: "no-store" })).text();
      const nueva = (html.match(/<meta name="version" content="(\d+)"/) || [])[1];
      if (nueva && VERSION && nueva !== VERSION && sessionStorage.getItem("spectre-admin-recarga") !== nueva) {
        sessionStorage.setItem("spectre-admin-recarga", nueva);
        location.reload();
      }
    } catch (_) {}
  }
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
  async function rpc(nombre, args) {
    const token = await tokenVigente();
    const r = await fetch(`${CFG.url}/rest/v1/rpc/${nombre}`, { method: "POST", headers: { apikey: CFG.llave, Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify(args || {}) });
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
    setLink() {}, // la dirección queda siempre limpia (/admin): sin #sección no salta al recargar ni delata el panel
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
      crudo.vivo_hoy = { status: "ok", data: r.vivo_hoy || [] };
      guardarCopia();
    } catch (e) { if (!manejarError(e)) { crudo.ventas = crudo.ventas || { status: "error", data: [] }; } }
    refrescando = false; cargandoVivo = false; avisar();
  }
  async function cargarArchivos() {
    try {
      const r = await rpc("admin_archivos");
      for (const [id, v] of Object.entries(r || {})) crudo[id] = { status: "ok", data: Array.isArray(v.datos) ? v.datos : [], at: v.actualizado };
      for (const id of ["usuarios", "trafico", "eventos", "paginas", "fuentes", "paises", "dispositivos", "ciudades", "navegadores", "sistemas", "salud", "respaldos", "codigos", "ventas_stripe", "en_vivo", "tipo_cambio"]) if (!crudo[id]) crudo[id] = { status: "ok", data: [] };
      guardarCopia();
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

  // ── avisos en el celular (Web Push) ──
  // En iPhone solo funcionan con el panel agregado a la pantalla de inicio y abierto desde el ícono (iOS 16.4+).
  const VAPID = (document.querySelector('meta[name="vapid"]') || {}).content || "";
  const AVISOS_OCULTO = "spectre-avisos-oculto";
  let registro = null;
  const llaveVapid = () => { const t = VAPID.replace(/-/g, "+").replace(/_/g, "/"); const b = atob(t + "===".slice((t.length + 3) % 4)); return Uint8Array.from(b, (c) => c.charCodeAt(0)); };
  const mostrarAvisos = (titulo, sub, conBoton) => {
    $("#avisos-titulo").textContent = titulo; $("#avisos-sub").textContent = sub;
    $("#avisos-btn").hidden = !conBoton; $("#avisos").hidden = false;
  };
  async function guardarSuscripcion(sub) {
    const j = sub.toJSON();
    await rpc("admin_guardar_push", { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth });
  }
  async function avisoDePrueba() {
    const token = await tokenVigente();
    const r = await fetch(`${CFG.url}/functions/v1/push`, { method: "POST", headers: { apikey: CFG.llave, Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify({ tipo: "prueba" }) });
    return r.ok ? r.json() : null;
  }
  async function prepararAvisos() {
    const caja = $("#avisos"); if (!caja) return;
    caja.hidden = true;
    let oculto = false; try { oculto = localStorage.getItem(AVISOS_OCULTO) === "1"; } catch (_) {}
    const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const app = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
    const soporta = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window && VAPID;
    if (!soporta) {
      if (ios && !app && !oculto) mostrarAvisos("Recibe cada venta en tu iPhone", "Toca Compartir → Agregar a inicio y abre SPECTRE desde el ícono para activar los avisos.", false);
      return;
    }
    try {
      registro = await navigator.serviceWorker.register("/admin-sw.js", { scope: "/admin" });
      await navigator.serviceWorker.ready;
      const sub = await registro.pushManager.getSubscription();
      if (sub && Notification.permission === "granted") { await guardarSuscripcion(sub); $("#avisos-pie").hidden = false; return; }
      if (Notification.permission === "denied") { if (!oculto) mostrarAvisos("Los avisos están bloqueados", ios ? "Actívalos en Ajustes → Notificaciones → SPECTRE." : "Actívalos en los permisos de este sitio en tu navegador.", false); return; }
      if (!oculto) mostrarAvisos("Recibe cada venta en tu celular", "Un aviso con el logo de SPECTRE en cuanto alguien compra.", true);
    } catch (e) { console.error(e); }
  }
  $("#avisos-btn") && $("#avisos-btn").addEventListener("click", async () => {
    const b = $("#avisos-btn"); b.disabled = true; b.textContent = "Activando…";
    try {
      const permiso = await Notification.requestPermission(); // debe pedirse con el toque (así lo exige iPhone)
      if (permiso !== "granted") { mostrarAvisos("No se activaron los avisos", "Puedes activarlos después en Ajustes → Notificaciones.", false); return; }
      if (!registro) registro = await navigator.serviceWorker.register("/admin-sw.js", { scope: "/admin" });
      await navigator.serviceWorker.ready;
      const sub = (await registro.pushManager.getSubscription()) || (await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: llaveVapid() }));
      await guardarSuscripcion(sub);
      const r = await avisoDePrueba();
      mostrarAvisos("Listo, avisos activados", r && r.entregados ? "Te mandé un aviso de prueba. Así te llegará cada venta." : "Quedaron activados. Si no ves la prueba, revisa Ajustes → Notificaciones.", false);
      $("#avisos-pie").hidden = false;
      setTimeout(() => { $("#avisos").hidden = true; }, 7000);
    } catch (e) {
      console.error(e);
      mostrarAvisos("No se pudieron activar", "Intenta de nuevo en un momento.", true);
    } finally { b.disabled = false; b.textContent = "Activar"; }
  });
  $("#avisos-cerrar") && $("#avisos-cerrar").addEventListener("click", () => { $("#avisos").hidden = true; try { localStorage.setItem(AVISOS_OCULTO, "1"); } catch (_) {} });
  document.addEventListener("click", async (ev) => {
    if (!ev.target.closest("#avisos-probar")) return;
    ev.preventDefault();
    const a = ev.target.closest("#avisos-probar"); a.textContent = "Enviando…";
    try { const r = await avisoDePrueba(); a.textContent = r && r.entregados ? "Aviso enviado" : "No se pudo enviar"; } catch (_) { a.textContent = "No se pudo enviar"; }
    setTimeout(() => (a.textContent = "Probar aviso"), 4000);
  });

  let relojVivo = null, relojArchivos = null;
  function arrancar() {
    $("#acceso").hidden = true; $("#dash-root").hidden = false; document.body.classList.add("en-panel");
    document.title = "SPECTRE · Panel";
    const copia = leerCopia();
    if (copia) {
      // abre al instante con los últimos números guardados (el dinero cuenta desde $0) y luego llegan los nuevos
      for (const [k, v] of Object.entries(copia)) crudo[k] = { status: "ok", data: Array.isArray(v) ? v : [] };
      avisar(); animarDinero();
      cargarVivo(); cargarArchivos();
    } else {
      avisar();
      document.body.classList.add("por-contar"); // el dinero no se ve hasta que empieza a contar desde $0
      Promise.all([cargarVivo(), cargarArchivos()]).then(animarDinero, () => document.body.classList.remove("por-contar"));
    }
    revisarVersion();
    prepararAvisos();
    clearInterval(relojVivo); clearInterval(relojArchivos);
    relojVivo = setInterval(() => { if (document.visibilityState === "visible") cargarVivo(); }, VIVO_MS);
    relojArchivos = setInterval(() => { if (document.visibilityState === "visible") cargarArchivos(); }, ARCHIVOS_MS);
  }
  // al volver a la app (el ícono de la pantalla de inicio la reanuda sin recargar): si estuvo fuera más de 30 s,
  // se repite la animación del dinero y de las gráficas con los datos nuevos
  let ocultaDesde = 0;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") { ocultaDesde = Date.now(); return; }
    if (!sesion || $("#dash-root").hidden) return;
    if (ocultaDesde && Date.now() - ocultaDesde > 30000) {
      revisarVersion();
      document.body.classList.add("por-contar");
      if (window.SX && window.SX.reanimar) window.SX.reanimar();
      Promise.all([cargarVivo(), cargarArchivos()]).then(animarDinero, () => document.body.classList.remove("por-contar"));
    } else cargarVivo();
  });
  addEventListener("pageshow", (ev) => { if (ev.persisted && sesion && !$("#dash-root").hidden) { ocultaDesde = 1; document.dispatchEvent(new Event("visibilitychange")); } });
  function salir(mensaje) {
    borrarSesion(); clearInterval(relojVivo); clearInterval(relojArchivos);
    for (const k of Object.keys(crudo)) delete crudo[k];
    $("#dash-root").hidden = true; $("#acceso").hidden = false; document.body.classList.remove("en-panel"); document.documentElement.classList.remove("con-sesion");
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
  document.addEventListener("click", async (ev) => {
    if (!ev.target.closest("#salir")) return;
    ev.preventDefault();
    // al cerrar sesión, este celular deja de recibir avisos
    try {
      const sub = registro && (await registro.pushManager.getSubscription());
      if (sub) { await rpc("admin_quitar_push", { p_endpoint: sub.endpoint }).catch(() => {}); await sub.unsubscribe(); }
    } catch (_) {}
    salir("");
  });

  // sesión guardada en este dispositivo: abre el panel de inmediato, sin pasar por el 404 ni esperar al servidor.
  // Si la sesión ya no sirve o la cuenta perdió el permiso, la primera petición de datos lo detecta y regresa a la entrada.
  const inicio = () => {
    let g = null, recordar = false;
    try { const l = localStorage.getItem(SESION), t = sessionStorage.getItem(SESION); g = JSON.parse(l || t || "null"); recordar = !!l; } catch (_) {}
    if (!g || !g.refresh_token) { document.documentElement.classList.remove("con-sesion"); return; }
    sesion = { access_token: g.access_token || "", refresh_token: g.refresh_token, expires_at: Number(g.expires_at) || 0, recordar };
    arrancar();
  };
  // espera a que cargue también el diseño del tablero (js/admin-tablero.js, que va después de este archivo)
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", inicio); else inicio();
})();
