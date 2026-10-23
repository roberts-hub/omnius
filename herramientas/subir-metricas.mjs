// SPECTRE · copia los archivos del tablero (privado/metricas/*.json) a la tabla privada public.metricas_archivos,
// de donde los lee el panel spectrecolor.com/admin (solo para correos en public.admins).
// Uso: node herramientas/subir-metricas.mjs   (lo corre la tarea de cada hora después de metricas.mjs y estado.mjs)
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const PRIV = (f) => join(RAIZ, "privado", f);
const ARCHIVOS = ["usuarios", "trafico", "eventos", "paginas", "fuentes", "paises", "dispositivos", "ciudades", "navegadores", "sistemas",
  "salud", "respaldos", "codigos", "ventas_stripe", "en_vivo", "tipo_cambio"];

const { ref } = JSON.parse(readFileSync(PRIV("supabase.json"), "utf8"));
const token = readFileSync(PRIV("supabase-token.txt"), "utf8").trim();
const ks = await (await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys?reveal=true`, { headers: { Authorization: "Bearer " + token } })).json();
const servicio = ks.find((k) => k.name === "service_role")?.api_key;
if (!servicio) { console.log("✗ no se pudo leer la llave de servicio de Supabase"); process.exit(1); }

const filas = [];
for (const nombre of ARCHIVOS) {
  const ruta = join(RAIZ, "privado", "metricas", nombre + ".json");
  if (!existsSync(ruta)) continue;
  filas.push({ nombre, datos: JSON.parse(readFileSync(ruta, "utf8")), actualizado: new Date().toISOString() });
}
const r = await fetch(`https://${ref}.supabase.co/rest/v1/metricas_archivos?on_conflict=nombre`, {
  method: "POST",
  headers: { apikey: servicio, Authorization: "Bearer " + servicio, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
  body: JSON.stringify(filas),
});
if (!r.ok) { console.log("✗ Supabase", r.status, (await r.text()).slice(0, 200)); process.exit(1); }
console.log(`✓ panel /admin: ${filas.length} archivos copiados`);
