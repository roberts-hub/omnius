// Uso: node herramientas/miembros.mjs [--nuevas-llaves]
// Prepara el área de miembros a partir de privado/miembros-full.json y privado/miembros-luts.json:
//   · cifra cada ZIP de privado/ en descargas/*.bin (lo único que se publica, inservible sin su llave)
//   · escribe privado/contenido-<edición>.json con los textos, videos y la llave de cada descarga
// Después: node herramientas/supabase.mjs contenido  (sube el contenido a Supabase)  +  commit + push de descargas/.
// La carpeta privado/ nunca se sube a GitHub.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { webcrypto as crypto } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const EDICIONES = ["full", "luts"];

const b64 = (b) => Buffer.from(b).toString("base64");
const leer = (f) => readFileSync(join(raiz, "privado", f), "utf8");

// Descargas: cada .zip de privado/ se publica cifrado en descargas/ con una llave al azar.
// La llave solo viaja dentro de la bóveda de su edición, así que el archivo publicado no sirve sin la contraseña.
// La llave y el nombre se guardan en privado/descargas.json para no volver a subir el archivo si no cambió.
const registro = join(raiz, "privado", "descargas.json");
// --nuevas-llaves: vuelve a cifrar todo con llaves nuevas (por ejemplo, si una llave pudo haberse filtrado)
const cache = existsSync(registro) && !process.argv.includes("--nuevas-llaves") ? JSON.parse(readFileSync(registro, "utf8")) : {};
// Archivos grandes (videos de práctica): se cortan en partes de 45 MB porque GitHub no acepta archivos de más de
// 100 MB. Cada parte va cifrada con la misma llave y su propio iv; el navegador las baja en orden y las une.
const PARTE = 45 * 1024 * 1024;
async function cifrarArchivo(rel) {
  const datos = readFileSync(join(raiz, "privado", rel));
  const huella = createHash("sha256").update(datos).digest("hex");
  let r = cache[rel];
  const existen = r && (r.partes || [{ ruta: r.ruta }]).every((p) => existsSync(join(raiz, p.ruta)));
  if (!r || r.huella !== huella || !existen) {
    const llave = crypto.getRandomValues(new Uint8Array(32));
    const k = await crypto.subtle.importKey("raw", llave, "AES-GCM", false, ["encrypt"]);
    mkdirSync(join(raiz, "descargas"), { recursive: true });
    const partes = [];
    for (let i = 0; i < datos.length; i += PARTE) {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, k, datos.subarray(i, i + PARTE)));
      const ruta = `descargas/${Buffer.from(crypto.getRandomValues(new Uint8Array(12))).toString("hex")}.bin`;
      writeFileSync(join(raiz, ruta), cifrado);
      partes.push({ ruta, iv: b64(iv) });
    }
    r = cache[rel] = partes.length === 1
      ? { huella, ruta: partes[0].ruta, llave: b64(llave), iv: partes[0].iv }
      : { huella, partes, llave: b64(llave) };
    console.log(`  cifrado: ${rel} → ${partes.length} parte(s)`);
  }
  const nombre = rel.split("/").pop();
  if (r.partes) return { partes: r.partes.map((p) => ({ ruta: "/" + p.ruta, iv: p.iv })), llave: r.llave, nombre, bytes: datos.length };
  return { ruta: "/" + r.ruta, llave: r.llave, iv: r.iv, nombre, bytes: datos.length };
}

// Contenido de cada edición (textos, videos y descargas con su llave). Ya NO se publica en el sitio:
// se guarda en privado/contenido-<edición>.json y se sube a Supabase (node herramientas/supabase.mjs contenido),
// donde solo lo puede leer un usuario con una compra activa de esa edición.
for (const ed of EDICIONES) {
  const contenido = JSON.parse(leer(`miembros-${ed}.json`)); // valida el JSON
  for (const d of contenido.descargas) {
    if (d.archivo) { d.cifrado = await cifrarArchivo(d.archivo); delete d.archivo; }
  }
  writeFileSync(join(raiz, "privado", `contenido-${ed}.json`), JSON.stringify(contenido, null, 1));
  console.log(`  ${ed}: ${contenido.secciones.reduce((n, s) => n + s.videos.length, 0)} videos, ${contenido.descargas.length} descargas`);
}

writeFileSync(registro, JSON.stringify(cache, null, 2));
// lista pública de las partes cifradas y su tamaño: la usa el monitor diario (herramientas/monitor.mjs)
// para comprobar que cada descarga existe completa. No revela contenido ni contraseñas.
const manifiesto = [];
for (const v of Object.values(cache)) {
  for (const p of v.partes || [{ ruta: v.ruta }]) {
    manifiesto.push({ ruta: "/" + p.ruta, bytes: readFileSync(join(raiz, p.ruta)).length });
  }
}
writeFileSync(join(raiz, "descargas", "manifest.json"), JSON.stringify(manifiesto, null, 1));
console.log("Listo: privado/contenido-*.json. Súbelo con: node herramientas/supabase.mjs contenido");

// borra de descargas/ los .bin viejos que ya no usa ninguna edición
import("node:fs").then(({ readdirSync, unlinkSync }) => {
  const usados = new Set(manifiesto.map((p) => p.ruta.slice(1)));
  for (const f of readdirSync(join(raiz, "descargas"))) {
    if (f.endsWith(".bin") && !usados.has("descargas/" + f)) { unlinkSync(join(raiz, "descargas", f)); console.log("  borrado: descargas/" + f); }
  }
});
