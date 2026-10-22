// SPECTRE · datos de la pestaña "Estado" del tablero (artifact "SPECTRE Métricas").
// Uso: node herramientas/estado.mjs   → escribe privado/metricas/{salud,respaldos,codigos,ventas_stripe}.json
//
// Revisa que todo esté sano: sitio, Supabase, Stripe, seguridad y respaldos; cuenta los usos de cada código de
// descuento y lista todas las ventas de Stripe (sin correos ni nombres). Solo lee: no cambia nada en ningún lado.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const PRIV = (f) => join(RAIZ, "privado", f);
const SITIO = "https://spectrecolor.com";
const ZONA = "America/Mexico_City";
const LINKS = { // payment links de SPECTRE
  plink_1URE5LFethND82y0BMV3UzdA: { producto: "Full System", actual: true },
  plink_1UQBuJFethND82y0dUdl1vfy: { producto: "Full System", actual: false }, // $89, desactivado
  plink_1UQBswFethND82y0hTuKybiY: { producto: "LUT Pack", actual: true },
  plink_1UQC5uFethND82y0rckpA5Ru: { producto: "LUT Pack", actual: false, prueba: true }, // link de prueba de $1
  plink_1UTTDOFethND82y0CnGx316m: { producto: "Upgrade a Full System", actual: true }, // $49 = la diferencia
};
// las ventas del tablero cuentan desde el lanzamiento (privado/metricas-inicio.txt, AAAA-MM-DD, hora de México)
const INICIO_VENTAS = existsSync(PRIV("metricas-inicio.txt")) ? Date.parse(readFileSync(PRIV("metricas-inicio.txt"), "utf8").trim() + "T06:00:00Z") / 1000 : 0;
const PRUEBAS = ["prueba", "prueba-ui", "manual"];
const RCLONE = join(process.env.HOME, "respaldo-grads-2026", "rclone");
const RCLONE_CONF = PRIV("rclone.conf");

const hora = (t) => new Date(t).toLocaleString("sv-SE", { timeZone: ZONA }).slice(0, 16);
const horasDesde = (t) => (Date.now() - new Date(t).getTime()) / 36e5;
const salud = [];
const punto = (area, nombre, estado, detalle) => salud.push({ area, punto: nombre, estado, detalle });
const intenta = async (area, nombre, fn) => { try { await fn(); } catch (e) { punto(area, nombre, "falla", "No se pudo revisar: " + String(e.message || e).slice(0, 120)); } };

// ── conexiones ──
const { ref } = JSON.parse(readFileSync(PRIV("supabase.json"), "utf8"));
const pat = readFileSync(PRIV("supabase-token.txt"), "utf8").trim();
const api = async (p) => { const r = await fetch("https://api.supabase.com" + p, { headers: { Authorization: "Bearer " + pat } }); if (!r.ok) throw new Error(`Supabase ${r.status}`); return r.json(); };
const sql = async (q) => { const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, { method: "POST", headers: { Authorization: "Bearer " + pat, "Content-Type": "application/json" }, body: JSON.stringify({ query: q }) }); const j = await r.json(); if (!r.ok) throw new Error(j.message || r.status); return j; };
const llaveStripe = readFileSync(PRIV("stripe-llave.txt"), "utf8").trim();
const stripe = async (p) => { const r = await fetch("https://api.stripe.com/v1" + p, { headers: { Authorization: "Bearer " + llaveStripe } }); const j = await r.json(); if (!r.ok) throw new Error("Stripe: " + (j.error?.message || r.status)); return j; };
const rclone = (...args) => JSON.parse(execFileSync(RCLONE, [...args, "--config", RCLONE_CONF], { encoding: "utf8", timeout: 60000 }));
const hayDrive = existsSync(RCLONE) && existsSync(RCLONE_CONF) && readFileSync(RCLONE_CONF, "utf8").includes("[spectre-drive]");

// ── 1. sitio ──
for (const [nombre, ruta] of [["Página principal responde", "/"], ["Página de compra responde", "/get"], ["Área de miembros responde", "/access"]]) {
  await intenta("Sitio", nombre, async () => {
    const t0 = Date.now(); const r = await fetch(SITIO + ruta + "?revision=" + t0); const ms = Date.now() - t0;
    punto("Sitio", nombre, r.ok ? (ms > 4000 ? "aviso" : "ok") : "falla", r.ok ? `Abre en ${(ms / 1000).toFixed(1)} s` : `Responde ${r.status}`);
  });
}
await intenta("Sitio", "Publicación en GitHub Pages", async () => {
  const s = execFileSync("gh", ["api", "repos/roberts-hub/omnius/pages/builds/latest", "-q", ".status+\" \"+.created_at"], { encoding: "utf8" }).trim().split(" ");
  punto("Sitio", "Publicación en GitHub Pages", s[0] === "built" ? "ok" : s[0] === "building" ? "aviso" : "falla", s[0] === "built" ? `Última publicación ${hora(s[1])}` : `Estado: ${s[0]}`);
});

// ── 2. Supabase ──
let auth = {};
await intenta("Supabase", "Base de datos en línea", async () => {
  const p = await api(`/v1/projects/${ref}`);
  punto("Supabase", "Base de datos en línea", p.status === "ACTIVE_HEALTHY" ? "ok" : "falla", p.status === "ACTIVE_HEALTHY" ? `Funcionando (${p.region}, Postgres ${String(p.database?.version || "").split(".")[0]})` : `Estado: ${p.status}`);
});
await intenta("Supabase", "Inicio de sesión de compradores", async () => {
  const cfg = readFileSync(join(RAIZ, "js/cuentas-config.js"), "utf8");
  const llave = (cfg.match(/"llave":"([^"]+)"/) || [])[1];
  const r = await fetch(`https://${ref}.supabase.co/auth/v1/health`, { headers: { apikey: llave } });
  punto("Supabase", "Inicio de sesión de compradores", r.ok ? "ok" : "falla", r.ok ? "El servicio de cuentas responde" : `Responde ${r.status}`);
});
await intenta("Seguridad", "Protección de cuentas", async () => {
  auth = await api(`/v1/projects/${ref}/config/auth`);
  const faltan = [];
  if (!auth.disable_signup) faltan.push("registro libre abierto");
  if (!auth.password_hibp_enabled) faltan.push("contraseñas filtradas");
  if (!auth.security_update_password_require_reauthentication) faltan.push("reconfirmación");
  if ((auth.password_min_length || 0) < 10) faltan.push("contraseña mínima");
  punto("Seguridad", "Protección de cuentas", faltan.length ? "aviso" : "ok", faltan.length ? "Revisar: " + faltan.join(", ") : "Solo se crean cuentas al pagar · contraseñas de 10+ y no filtradas · reconfirmación al cambiarla");
});
await intenta("Seguridad", "Reglas de acceso a los datos", async () => {
  const r = await sql(`select count(*) filter (where not c.relrowsecurity) sin_rls, count(*) total,
    (select count(*) from information_schema.role_table_grants where grantee = 'anon' and table_schema = 'public') anon
    from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r'`);
  const x = r[0];
  punto("Seguridad", "Reglas de acceso a los datos", Number(x.sin_rls) || Number(x.anon) ? "falla" : "ok",
    Number(x.sin_rls) || Number(x.anon) ? `${x.sin_rls} tabla(s) sin reglas · ${x.anon} permiso(s) anónimos` : `Las ${x.total} tablas protegidas: cada comprador solo ve lo suyo`);
});
await intenta("Seguridad", "Cuentas sospechosas", async () => {
  const r = await sql(`select (select count(*) from public.bloqueos) bloqueadas, (select count(*) from public.actividad_cuentas() a where a.bandera) bandera`);
  const x = r[0];
  punto("Seguridad", "Cuentas sospechosas", Number(x.bloqueadas) || Number(x.bandera) ? "aviso" : "ok",
    Number(x.bloqueadas) || Number(x.bandera) ? `${x.bandera} con bandera roja · ${x.bloqueadas} bloqueada(s): revisa la pestaña Usuarios` : "Ninguna cuenta compartida ni bloqueada");
});
await intenta("Stripe", "Upgrades por revisar", async () => {
  // pagos del upgrade ($49) que NO se aplicaron: la cuenta no tenía LUT Pack o ya tenía el Full System
  const r = await sql(`select email, motivo, monto, creada from public.upgrades_revisar where not resuelto order by creada`);
  punto("Stripe", "Upgrades por revisar", r.length ? "falla" : "ok", r.length
    ? `${r.length} pago(s) de upgrade sin aplicar: ${r.map((x) => `${x.email} (${x.motivo})`).join(" · ")}. Reembolsa en Stripe o pide a Claude darle el LUT Pack`
    : "Todos los upgrades pagados se aplicaron");
});
await intenta("Seguridad", "Pruebas de seguridad", async () => {
  if (!existsSync(PRIV("metricas/ultima-prueba.json"))) return punto("Seguridad", "Pruebas de seguridad", "aviso", "Todavía no hay resultado guardado");
  const u = JSON.parse(readFileSync(PRIV("metricas/ultima-prueba.json"), "utf8"));
  const viejo = horasDesde(u.fecha) > 50;
  punto("Seguridad", "Pruebas de seguridad", u.fallaron ? "falla" : viejo ? "aviso" : "ok",
    `${u.pasaron} pasaron, ${u.fallaron} fallaron · ${hora(u.fecha)}${viejo ? " (hace más de 2 días)" : ""}`);
});
await intenta("Seguridad", "Token de administración de Supabase", async () => {
  const vence = existsSync(PRIV("supabase-token-vence.txt")) ? readFileSync(PRIV("supabase-token-vence.txt"), "utf8").trim() : "";
  if (!vence) return punto("Seguridad", "Token de administración de Supabase", "ok", "Funciona");
  const dias = Math.floor((Date.parse(vence + "T23:59:00-06:00") - Date.now()) / 864e5);
  punto("Seguridad", "Token de administración de Supabase", dias < 0 ? "falla" : dias <= 14 ? "aviso" : "ok", dias < 0 ? "Venció: hay que renovarlo" : `Vence el ${vence} (en ${dias} días)`);
});

// ── 3. Stripe ──
let sesiones = [];
await intenta("Stripe", "Links de pago", async () => {
  for (const [id, l] of Object.entries(LINKS).filter(([, l]) => l.actual)) {
    const pl = await stripe(`/payment_links/${id}?expand[]=line_items`);
    const precio = pl.line_items?.data?.[0]?.price;
    const monto = precio ? `$${(precio.unit_amount / 100).toFixed(0)} ${precio.currency.toUpperCase()}` : "";
    punto("Stripe", `Link de ${l.producto}`, pl.active ? "ok" : "falla", pl.active ? `Activo · ${monto}${pl.allow_promotion_codes ? " · acepta códigos" : ""}` : "DESACTIVADO: nadie puede comprar");
  }
  for (const [id, l] of Object.entries(LINKS).filter(([, l]) => !l.actual)) {
    const pl = await stripe(`/payment_links/${id}`);
    if (pl.active) punto("Stripe", "Links viejos o de prueba", "aviso", `El link ${l.prueba ? "de prueba" : "viejo"} de ${l.producto} sigue activo`);
  }
});
await intenta("Stripe", "Cada pago llegó a Supabase", async () => {
  let pagina = "";
  for (let i = 0; i < 20; i++) {
    const r = await stripe(`/checkout/sessions?limit=100&status=complete${pagina ? "&starting_after=" + pagina : ""}`);
    sesiones.push(...r.data.filter((s) => LINKS[s.payment_link]));
    if (!r.has_more) break;
    pagina = r.data.at(-1).id;
  }
});
const compras = await sql(`select stripe_session, activa, motivo from public.compras`).catch(() => []);
const porSesion = new Map(compras.map((c) => [c.stripe_session, c]));
const faltan = sesiones.filter((s) => !LINKS[s.payment_link].prueba && ["paid", "no_payment_required"].includes(s.payment_status) && !porSesion.has(s.id));
if (!salud.some((s) => s.punto === "Cada pago llegó a Supabase")) {
  punto("Stripe", "Cada pago llegó a Supabase", faltan.length ? "falla" : "ok",
    faltan.length ? `${faltan.length} pago(s) sin cuenta creada: revisar el webhook` : `${sesiones.filter((s) => !LINKS[s.payment_link].prueba).length} de ${sesiones.filter((s) => !LINKS[s.payment_link].prueba).length} pagos con su cuenta y acceso`);
}

// ── 4. códigos de descuento ──
const codigos = [];
await intenta("Stripe", "Códigos de descuento", async () => {
  const pcs = await stripe("/promotion_codes?limit=100");
  const cupones = new Map();
  for (const p of pcs.data) {
    const idCupon = typeof p.coupon === "object" && p.coupon ? p.coupon.id : p.promotion?.coupon || p.coupon;
    if (!cupones.has(idCupon)) cupones.set(idCupon, await stripe(`/coupons/${idCupon}`));
    const c = cupones.get(idCupon);
    const usados = p.times_redeemed, limite = p.max_redemptions;
    const expirado = p.expires_at && p.expires_at * 1000 < Date.now();
    codigos.push({
      codigo: p.code, descuento: c.percent_off ? `${c.percent_off}%` : `$${(c.amount_off / 100).toFixed(0)}`, porcentaje: c.percent_off || 0,
      usados, limite: limite ?? "sin límite", restantes: limite == null ? "sin límite" : Math.max(0, limite - usados),
      estado: limite != null && usados >= limite ? "agotado" : expirado ? "expirado" : !p.active ? "desactivado" : "disponible",
      tipo: /^PRUEBA/.test(p.code) ? "prueba" : "real",
      expira: p.expires_at ? hora(p.expires_at * 1000) : "",
    });
  }
  codigos.sort((a, b) => (a.tipo === b.tipo ? b.porcentaje - a.porcentaje : a.tipo === "real" ? -1 : 1));
  const reales = codigos.filter((c) => c.tipo === "real");
  punto("Stripe", "Códigos de descuento", "ok", `${reales.reduce((s, c) => s + c.usados, 0)} usos de ${reales.reduce((s, c) => s + (Number(c.limite) || 0), 0)} · ${reales.filter((c) => c.estado === "disponible").length} código(s) disponibles`);
});

// ── 5. ventas (todas las de Stripe, sin datos personales) ──
const codigoDe = new Map();
for (const s of sesiones) for (const d of s.discounts || []) if (d.promotion_code && !codigoDe.has(d.promotion_code)) codigoDe.set(d.promotion_code, (await stripe(`/promotion_codes/${d.promotion_code}`).catch(() => ({}))).code || "");
const ventas = sesiones.filter((s) => s.created >= INICIO_VENTAS).sort((a, b) => a.created - b.created).map((s, i) => {
  const l = LINKS[s.payment_link], c = porSesion.get(s.id);
  const codigo = (s.discounts || []).map((d) => codigoDe.get(d.promotion_code)).filter(Boolean).join(", ");
  const prueba = l.prueba || /^PRUEBA/.test(codigo) || (c && PRUEBAS.includes(c.motivo));
  return {
    n: i + 1, fecha: hora(s.created * 1000), dia: hora(s.created * 1000).slice(0, 10), producto: l.producto,
    monto: s.amount_total / 100, moneda: (s.currency || "").toUpperCase(), codigo, pais: s.customer_details?.address?.country || "",
    tipo: prueba ? "prueba" : "real",
    acceso: c ? (c.activa ? "con acceso" : `sin acceso (${c.motivo || "reembolso"})`) : l.prueba ? "prueba borrada" : "SIN CUENTA",
  };
});

// ── 6. respaldos ──
const respaldos = [];
await intenta("Respaldos", "Copia diaria de Supabase", async () => {
  const b = await api(`/v1/projects/${ref}/database/backups`);
  const ok = (b.backups || []).filter((x) => x.status === "COMPLETED");
  const ultimo = ok[0]?.inserted_at;
  const estado = ultimo && horasDesde(ultimo) < 30 ? "ok" : "falla";
  respaldos.push({ respaldo: "Supabase (base completa)", donde: "Supabase · plan Pro", ultimo: ultimo ? hora(ultimo) : "—", copias: ok.length, guarda: "7 días", frecuencia: "Diario", estado });
  punto("Respaldos", "Copia diaria de Supabase", estado, ultimo ? `Última: ${hora(ultimo)} · ${ok.length} copias guardadas` : "Sin copias");
});
await intenta("Respaldos", "Copia diaria en Google Drive", async () => {
  if (!hayDrive) { respaldos.push({ respaldo: "Clientes y compras (JSON + hoja)", donde: "Google Drive · SPECTRE respaldos", ultimo: "sin verificar", copias: "", guarda: "Para siempre", frecuencia: "Diario 3 am", estado: "aviso" }); return punto("Respaldos", "Copia diaria en Google Drive", "aviso", "Falta conectar Drive para verificarla"); }
  const fs = rclone("lsjson", "spectre-drive:", "--files-only").filter((f) => /^respaldo-\d{4}-\d{2}-\d{2}\.json$/.test(f.Name)).sort((a, b) => a.Name.localeCompare(b.Name));
  const u = fs.at(-1);
  const estado = u && horasDesde(u.ModTime) < 30 ? "ok" : "falla";
  respaldos.push({ respaldo: "Clientes y compras (JSON + hoja)", donde: "Google Drive · SPECTRE respaldos", ultimo: u ? hora(u.ModTime) : "—", copias: fs.length, guarda: "Para siempre", frecuencia: "Diario 3 am", estado });
  punto("Respaldos", "Copia diaria en Google Drive", estado, u ? `Última: ${hora(u.ModTime)} · ${fs.length} copias` : "No encontré copias");
});
await intenta("Respaldos", "Respaldo completo cifrado", async () => {
  const info = existsSync(PRIV("metricas/respaldo-dmg.json")) ? JSON.parse(readFileSync(PRIV("metricas/respaldo-dmg.json"), "utf8")) : null;
  let enDrive = [];
  if (hayDrive) { try { enDrive = rclone("lsjson", "spectre-drive:DMG cifrados", "--files-only").filter((f) => f.Name.endsWith(".dmg")).sort((a, b) => a.Name.localeCompare(b.Name)); } catch (_) {} }
  const u = enDrive.at(-1);
  const estado = u && horasDesde(u.ModTime) < 24 * 9 ? "ok" : u ? "aviso" : "falla";
  respaldos.push({ respaldo: "Todo el sistema (DMG cifrado)", donde: "Google Drive · DMG cifrados", ultimo: u ? hora(u.ModTime) : info?.fecha ? hora(info.fecha) + " (solo en la Mac)" : "—", copias: enDrive.length, guarda: "Para siempre", frecuencia: "Semanal (domingo)", estado });
  punto("Respaldos", "Respaldo completo cifrado", estado, u ? `Último en Drive: ${hora(u.ModTime)} · ${enDrive.length} copia(s)` : info?.error ? "Último intento falló: " + info.error : "Todavía no hay uno en Drive");
});
await intenta("Respaldos", "Copia local en la Mac", async () => {
  const dir = PRIV("respaldos");
  const fs = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json")).sort() : [];
  const u = fs.at(-1), t = u ? statSync(join(dir, u)).mtime : null;
  respaldos.push({ respaldo: "Clientes y compras (JSON)", donde: "Mac · omnius/privado/respaldos", ultimo: t ? hora(t) : "—", copias: fs.length, guarda: "Para siempre", frecuencia: "En cada revisión diaria", estado: t && horasDesde(t) < 24 * 4 ? "ok" : "aviso" });
});

// ── guardar ──
const salida = PRIV("metricas");
mkdirSync(salida, { recursive: true });
const ahora = new Date().toISOString();
const guardar = (nombre, filas) => { writeFileSync(join(salida, nombre + ".json"), JSON.stringify(filas)); console.log(`  ${nombre}: ${filas.length} filas`); };
guardar("salud", salud.map((s) => ({ ...s, revisado: hora(ahora) })));
guardar("respaldos", respaldos);
guardar("codigos", codigos.length ? codigos : [{ codigo: "—", descuento: "", porcentaje: 0, usados: 0, limite: 0, restantes: 0, estado: "sin códigos", tipo: "real", expira: "" }]);
guardar("ventas_stripe", ventas.length ? ventas : [{ n: 0, fecha: "", dia: "", producto: "—", monto: 0, moneda: "", codigo: "", pais: "", tipo: "real", acceso: "sin ventas" }]);
const malos = salud.filter((s) => s.estado !== "ok");
console.log(malos.length ? `⚠ ${malos.length} punto(s) por revisar:\n` + malos.map((m) => `  ${m.estado === "falla" ? "✗" : "!"} ${m.area} · ${m.punto}: ${m.detalle}`).join("\n") : "✓ Todo en orden");
