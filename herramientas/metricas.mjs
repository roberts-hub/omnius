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
  const guardar = (nombre, filas) => { writeFileSync(join(salida, nombre + ".json"), JSON.stringify(filas)); console.log(`  ${nombre}: ${filas.length} filas`); };

  // ── ventas (Supabase) ──
  const { ref } = JSON.parse(readFileSync(PRIV("supabase.json"), "utf8"));
  const token = readFileSync(PRIV("supabase-token.txt"), "utf8").trim();
  const ks = await (await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys?reveal=true`, { headers: { Authorization: "Bearer " + token } })).json();
  const servicio = ks.find((k) => k.name === "service_role").api_key;
  const compras = await (await fetch(`https://${ref}.supabase.co/rest/v1/compras?select=creada,edicion,monto,moneda,activa,motivo,pais&order=creada`, {
    headers: { apikey: servicio, Authorization: "Bearer " + servicio },
  })).json();
  guardar("ventas", compras
    .filter((c) => c.motivo !== "prueba" && c.motivo !== "prueba-ui" && c.motivo !== "manual")
    .map((c, i) => ({
      n: i + 1,
      dia: dia(c.creada),
      edicion: c.edicion === "full" ? "Full System" : "LUT Pack",
      monto: c.monto == null ? null : Number(c.monto),
      moneda: (c.moneda || "").toUpperCase(),
      estado: c.activa ? "pagada" : c.motivo || "reembolsada",
      pais: c.pais || "",
    })));

  // ── tráfico (Umami) ──
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
