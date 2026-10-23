// SPECTRE · datos del tablero de métricas (artifact "SPECTRE Métricas").
// Uso: node herramientas/metricas.mjs            → escribe privado/metricas/*.json
//      node herramientas/metricas.mjs umami      → pide y guarda la llave de la API de Umami (una sola vez)
//
// Fuentes: Umami (visitas, páginas, fuentes, países, dispositivos, clics) y Supabase (compras, sin correos ni nombres).
// Los archivos no llevan datos personales: solo conteos y montos por día.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import readline from "node:readline";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const PRIV = (f) => join(RAIZ, "privado", f);
const SITIO_UMAMI = "add40efe-f309-476f-95a6-6367262a4434";
const ZONA = "America/Mexico_City";
const DIAS = 120;
// día del lanzamiento: antes de esta fecha todo se considera prueba y no entra al tablero.
// Mientras no haya lanzamiento vale 2099-01-01 (tablero en ceros). Cambiar en privado/metricas-inicio.txt
// y en la constante INICIO de herramientas/umami-navegador.js.
const INICIO_TXT = existsSync(join(RAIZ, "privado", "metricas-inicio.txt")) ? readFileSync(join(RAIZ, "privado", "metricas-inicio.txt"), "utf8").trim() : "2099-01-01";
// puede ser un día (AAAA-MM-DD, desde las 00:00 de México) o un momento exacto (2026-10-22T22:45:00Z)
const INICIO_MS = Date.parse(INICIO_TXT.includes("T") ? INICIO_TXT : INICIO_TXT + "T06:00:00Z");
// canal de la compra ("youtube_video_masterclass" → "YouTube · video · masterclass"); sin canal = directo/otro
const CANALES = { ig: "Instagram", yt: "YouTube", fb: "Facebook", tt: "TikTok", wa: "WhatsApp", youtube: "YouTube", instagram: "Instagram", tiktok: "TikTok", whatsapp: "WhatsApp", facebook: "Facebook", google: "Google", x: "X", linkedin: "LinkedIn", pinterest: "Pinterest", reddit: "Reddit", telegram: "Telegram", snapchat: "Snapchat", buscador: "Otro buscador", correo: "Correo", twowaves: "Two Waves", "otro-sitio": "Otro sitio" };
const fuenteBonita = (o) => (o ? o.split("_").filter((x) => x !== "auto").map((x, i) => (i === 0 ? CANALES[x] || x : x)).join(" · ") : "Directo / otro");
const INICIO = new Date(INICIO_MS).toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" }); // día del lanzamiento (para filas por día)

if (process.argv[2] === "umami") {
  process.stdout.write("Pega la llave de la API de Umami y presiona Enter: ");
  process.stdin.setRawMode?.(true);
  let v = "";
  process.stdin.on("data", (d) => {
    for (const c of d.toString()) {
      if (c === "\r" || c === "\n") {
        process.stdin.setRawMode?.(false);
        v = v.replace(/\x1b\[[0-9;]*~/g, "").replace(/[^\x21-\x7e]/g, "");
        writeFileSync(PRIV("umami.json"), JSON.stringify({ llave: v, sitio: SITIO_UMAMI }), { mode: 0o600 });
        console.log("\n✓ Llave de Umami guardada en privado/umami.json");
        process.exit(0);
      }
      if (c === "\u0003") process.exit(130);
      v = c === "\u007f" ? v.slice(0, -1) : v + c;
    }
  });
} else {
  await generar();
}

async function generar() {
  const salida = PRIV("metricas");
  mkdirSync(salida, { recursive: true });
  const fin = Date.now(), inicio = fin - DIAS * 864e5;
  const dia = (t) => new Date(t).toLocaleDateString("en-CA", { timeZone: ZONA }); // AAAA-MM-DD en hora de México
  // nunca guardar lo que va después de # en una dirección (ahí viajaban llaves de acceso de los correos)
  const sinHash = (v) => typeof v === "string" ? v.replace(/#.*$/s, "") : v;
  const guardar = (nombre, filas) => {
    if (nombre === "paginas") filas = filas.map((f) => ({ ...f, pagina: sinHash(f.pagina) || "/" }));
    writeFileSync(join(salida, nombre + ".json"), JSON.stringify(filas)); console.log(`  ${nombre}: ${filas.length} filas`);
  };

  // ── ventas (Supabase) ──
  const { ref } = JSON.parse(readFileSync(PRIV("supabase.json"), "utf8"));
  const token = readFileSync(PRIV("supabase-token.txt"), "utf8").trim();
  const ks = await (await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys?reveal=true`, { headers: { Authorization: "Bearer " + token } })).json();
  const servicio = ks.find((k) => k.name === "service_role").api_key;
  const compras = await (await fetch(`https://${ref}.supabase.co/rest/v1/compras?select=creada,edicion,monto,moneda,activa,motivo,pais,origen&order=creada`, {
    headers: { apikey: servicio, Authorization: "Bearer " + servicio },
  })).json();
  // el tablero no acepta un archivo vacío: sin ventas se manda una sola fila marcada (n = 0) que la página ignora
  const sinVentas = [{ n: 0, dia: dia(Date.now()), edicion: "—", monto: null, moneda: "", estado: "sin ventas", pais: "", fuente: "", canal: "" }];
  const filasVentas = compras
    .filter((c) => c.motivo !== "prueba" && c.motivo !== "prueba-ui" && c.motivo !== "manual" && Date.parse(c.creada) >= INICIO_MS)
    .map((c, i) => ({
      n: i + 1,
      dia: dia(c.creada),
      edicion: c.motivo === "upgrade desde LUT Pack" ? "Upgrade a Full System" : c.edicion === "full" ? "Full System" : "LUT Pack",
      monto: c.monto == null ? null : Number(c.monto),
      moneda: (c.moneda || "").toUpperCase(),
      estado: c.activa ? "pagada" : c.motivo || "reembolsada",
      pais: c.pais || "",
      fuente: fuenteBonita(c.origen),
      canal: c.origen ? ({ ig: "instagram", yt: "youtube", fb: "facebook", tt: "tiktok", wa: "whatsapp" })[c.origen.split("_")[0]] || c.origen.split("_")[0] : "directo", // clave del canal: se cruza con los eventos "llegada-<canal>" de Umami
    }));
  guardar("ventas", filasVentas.length ? filasVentas : sinVentas);

  // ── tipo de cambio USD→MXN (Banco Central Europeo vía frankfurter.dev, un valor por día hábil) ──
  // El tablero suma los ingresos en dólares y en pesos en un solo total en pesos con este valor.
  try {
    const tc = await (await fetch("https://api.frankfurter.dev/v1/latest?base=USD&symbols=MXN", { signal: AbortSignal.timeout(10000) })).json();
    if (tc?.rates?.MXN) guardar("tipo_cambio", [{ usd_mxn: tc.rates.MXN, fecha: tc.date, fuente: "Banco Central Europeo" }]);
  } catch (e) { console.log("  (tipo de cambio: no respondió; se queda el anterior)"); }

  // ── usuarios (página "Usuarios" del tablero): una fila por cuenta con sus entradas, descargas y alertas ──
  // Lleva correos: el tablero es privado de Roberto (no compartir su link).
  const leer = async (ruta, init = {}) => {
    const r = await fetch(`https://${ref}.supabase.co${ruta}`, { ...init, headers: { apikey: servicio, Authorization: "Bearer " + servicio, "Content-Type": "application/json" } });
    if (!r.ok) throw new Error(ruta + " → " + r.status);
    return r.json();
  };
  const usuarios = [];
  for (let pagina = 1; pagina < 50; pagina++) {
    const { users } = await leer(`/auth/v1/admin/users?page=${pagina}&per_page=1000`);
    usuarios.push(...users);
    if (users.length < 1000) break;
  }
  const [comprasTodas, accesos, descargas, bloqueos, lim] = await Promise.all([
    leer("/rest/v1/compras?select=user_id,edicion,activa,motivo,creada&order=creada"),
    leer("/rest/v1/accesos?select=user_id,ip,creada&order=creada.desc&limit=50000"),
    leer("/rest/v1/descargas?select=user_id,archivo,creada&limit=50000"),
    leer("/rest/v1/bloqueos?select=user_id,motivo"),
    leer("/rest/v1/rpc/limites", { method: "POST", body: "{}" }),
  ]);
  const hace24 = Date.now() - 864e5;
  const filasUsuarios = usuarios.map((u) => {
    const cs = comprasTodas.filter((c) => c.user_id === u.id);
    const as = accesos.filter((a) => a.user_id === u.id);
    const ds = descargas.filter((d) => d.user_id === u.id);
    const a24 = as.filter((a) => Date.parse(a.creada) > hace24);
    const ips24 = new Set(a24.map((a) => a.ip).filter(Boolean)).size;
    const ipsTotal = new Set(as.map((a) => a.ip).filter(Boolean)).size;
    const cuenta = (re) => ds.filter((d) => re.test(d.archivo || "")).length;
    const bloqueo = bloqueos.find((b) => b.user_id === u.id);
    const activa = cs.some((c) => c.activa);
    const prueba = cs.length > 0 && cs.every((c) => ["prueba", "prueba-ui", "manual"].includes(c.motivo));
    const alertas = [];
    if (bloqueo) alertas.push("Bloqueada: " + bloqueo.motivo);
    if (a24.length > lim.bandera_entradas_24h) alertas.push(`${a24.length} entradas en 24 h`);
    if (ips24 >= lim.bandera_ips_24h) alertas.push(`${ips24} lugares (IPs) distintos en 24 h`);
    if (ipsTotal >= 8) alertas.push(`${ipsTotal} IPs distintas en total`);
    for (const [nombre, n] of [["Full System", cuenta(/full system/i)], ["LUT Pack", cuenta(/lut pack/i)]]) if (n >= 6) alertas.push(`${n} descargas del ${nombre}`);
    return {
      correo: u.email,
      compro: [...new Set(cs.map((c) => (c.edicion === "full" ? "Full System" : "LUT Pack")))].join(" + ") || "—",
      estado: bloqueo ? "bloqueada" : activa ? "activa" : cs.length ? "sin acceso (reembolso)" : "sin compra",
      tipo: prueba ? "prueba" : "real",
      cuenta_creada: dia(u.created_at),
      ultima_entrada: as[0] ? new Date(as[0].creada).toLocaleString("sv-SE", { timeZone: ZONA }).slice(0, 16) : "",
      entradas_total: as.length,
      entradas_24h: a24.length,
      ips_total: ipsTotal,
      descargas_full: cuenta(/full system/i),
      descargas_luts: cuenta(/lut pack/i),
      descargas_practica: cuenta(/practice|pr[aá]ctica/i),
      descargas_total: ds.length,
      alerta: alertas.join(" · "),
    };
  }).sort((a, b) => (b.alerta ? 1 : 0) - (a.alerta ? 1 : 0) || (b.ultima_entrada || "").localeCompare(a.ultima_entrada || ""));
  guardar("usuarios", filasUsuarios.length ? filasUsuarios : [{ correo: "—", compro: "—", estado: "sin cuentas", tipo: "", cuenta_creada: dia(Date.now()), ultima_entrada: "", entradas_total: 0, entradas_24h: 0, ips_total: 0, descargas_full: 0, descargas_luts: 0, descargas_practica: 0, descargas_total: 0, alerta: "" }]);

  // ── archivos de Umami (los escribe la revisión diaria con umami-navegador.js): solo desde el lanzamiento ──
  const hoy = dia(Date.now());
  const cero = { trafico: { dia: hoy, vistas: 0, visitantes: 0 }, eventos: { dia: hoy, evento: "—", total: 0 }, paginas: { pagina: "—", vistas: 0 },
    fuentes: { fuente: "—", visitantes: 0 }, paises: { pais: "—", visitantes: 0 }, dispositivos: { dispositivo: "—", visitantes: 0 },
    ciudades: { ciudad: "—", pais: "", visitantes: 0 }, navegadores: { navegador: "—", visitantes: 0 }, sistemas: { sistema: "—", visitantes: 0 },
    en_vivo: { activos: 0, revisado: "", visitantes_24h: 0, visitas_24h: 0, vistas_24h: 0 } };
  for (const [nombre, fila0] of Object.entries(cero)) {
    const ruta = join(salida, nombre + ".json");
    let filas = existsSync(ruta) ? JSON.parse(readFileSync(ruta, "utf8")) : [];
    if (filas[0] && "dia" in filas[0]) filas = filas.filter((f) => f.dia >= INICIO);
    else if (INICIO_MS > Date.now()) filas = []; // agregados de 30 días: antes del lanzamiento no cuentan (se vuelven a llenar con Umami ya desde el lanzamiento)
    guardar(nombre, filas.length ? filas : [fila0]); // el tablero no acepta archivos vacíos
  }
  if (process.argv.includes("--solo-limpiar")) return;

  // ── tráfico (Umami, solo con plan Pro) ──
  if (!existsSync(PRIV("umami.json"))) { console.log("  (sin llave de Umami: corre  node herramientas/metricas.mjs umami)"); return; }
  const { llave, sitio } = JSON.parse(readFileSync(PRIV("umami.json"), "utf8"));
  const u = async (ruta, extra = {}) => {
    const q = new URLSearchParams({ startAt: String(inicio), endAt: String(fin), timezone: ZONA, ...extra });
    const r = await fetch(`https://api.umami.is/v1/websites/${sitio}${ruta}?${q}`, { headers: { "x-umami-api-key": llave, Accept: "application/json" } });
    if (!r.ok) throw new Error(`Umami ${ruta} → ${r.status} ${(await r.text()).slice(0, 120)}`);
    return r.json();
  };
  const pv = await u("/pageviews", { unit: "day" });
  const porDia = new Map();
  for (const p of pv.pageviews || []) porDia.set(p.x.slice(0, 10), { dia: p.x.slice(0, 10), vistas: p.y, visitantes: 0 });
  for (const s of pv.sessions || []) { const k = s.x.slice(0, 10); porDia.set(k, { ...(porDia.get(k) || { dia: k, vistas: 0 }), visitantes: s.y }); }
  guardar("trafico", [...porDia.values()].sort((a, b) => a.dia.localeCompare(b.dia)));

  const metrica = async (tipo, alterno) => {
    try { return await u("/metrics", { type: tipo, limit: "50" }); } catch (e) { if (alterno) return u("/metrics", { type: alterno, limit: "50" }); throw e; }
  };
  const ult30 = { startAt: String(fin - 30 * 864e5) };
  const m30 = async (tipo, alterno) => {
    const q = (t) => u("/metrics", { type: t, limit: "50", ...ult30 });
    try { return await q(tipo); } catch (e) { if (alterno) return q(alterno); throw e; }
  };
  guardar("paginas", (await m30("path", "url")).map((r) => ({ pagina: r.x || "/", vistas: r.y })));
  guardar("fuentes", (await m30("referrer")).map((r) => ({ fuente: r.x || "Directo / sin fuente", visitantes: r.y })));
  guardar("paises", (await m30("country")).map((r) => ({ pais: r.x || "Desconocido", visitantes: r.y })));
  guardar("dispositivos", (await m30("device")).map((r) => ({ dispositivo: r.x || "Desconocido", visitantes: r.y })));

  const series = await u("/events/series", { unit: "day" }).catch(() => []);
  guardar("eventos", (Array.isArray(series) ? series : []).map((e) => ({ dia: String(e.t).slice(0, 10), evento: e.x, total: e.y })));
  void metrica;
}
