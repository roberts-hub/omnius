// Uso: node herramientas/miembros.mjs
// Cifra el contenido de cada edición con SU contraseña y lo guarda dentro de access.html:
//   privado/miembros-full.json + privado/clave-full.txt  → Full System (todo)
//   privado/miembros-luts.json + privado/clave-luts.txt  → LUT Pack (solo LUTs)
// La contraseña de una edición NO puede abrir la otra: cada bóveda va cifrada por separado.
// Correrlo cada vez que cambies videos, descargas o contraseñas; después: commit + push.
// La carpeta privado/ nunca se sube a GitHub: el sitio solo publica el contenido cifrado.
import { readFileSync, writeFileSync } from "node:fs";
import { webcrypto as crypto } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const ITERACIONES = 600000; // PBKDF2-SHA256; va dentro de cada paquete
const EDICIONES = ["full", "luts"];

const b64 = (b) => Buffer.from(b).toString("base64");
const leer = (f) => readFileSync(join(raiz, "privado", f), "utf8");

async function cifrar(clave, contenido) {
  const sal = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(clave), "PBKDF2", false, ["deriveKey"]);
  const llave = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: sal, iterations: ITERACIONES, hash: "SHA-256" },
    base, { name: "AES-GCM", length: 256 }, false, ["encrypt"]
  );
  const datos = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, llave, new TextEncoder().encode(JSON.stringify(contenido)));
  return { v: 1, iter: ITERACIONES, sal: b64(sal), iv: b64(iv), datos: b64(datos) };
}

const usadas = [];
const paquetes = [];
for (const ed of EDICIONES) {
  // sin distinguir mayúsculas (la página hace lo mismo)
  const clave = leer(`clave-${ed}.txt`).trim().toUpperCase();
  if (clave.length < 8) throw new Error(`La contraseña de ${ed} debe tener al menos 8 caracteres.`);
  if (usadas.includes(clave)) throw new Error("Las dos ediciones deben tener contraseñas distintas.");
  usadas.push(clave);
  const contenido = JSON.parse(leer(`miembros-${ed}.json`)); // valida el JSON
  paquetes.push(await cifrar(clave, contenido));
  console.log(`  ${ed}: ${contenido.secciones.reduce((n, s) => n + s.videos.length, 0)} videos, ${contenido.descargas.length} descargas`);
}

const ruta = join(raiz, "access.html");
const html = readFileSync(ruta, "utf8");
const patron = /(<script type="application\/json" id="contenido-cifrado">)[\s\S]*?(<\/script>)/;
if (!patron.test(html)) throw new Error("No encontré el bloque #contenido-cifrado en access.html");
// el orden de las bóvedas no revela cuál es cuál: se barajan en cada publicación
if (crypto.getRandomValues(new Uint8Array(1))[0] & 1) paquetes.reverse();
writeFileSync(ruta, html.replace(patron, `$1${JSON.stringify(paquetes)}$2`));
console.log("Listo: access.html actualizado con 2 bóvedas cifradas.");
