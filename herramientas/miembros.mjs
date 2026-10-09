// Uso: node herramientas/miembros.mjs
// Cifra privado/miembros.json con la contraseña de privado/clave.txt y lo guarda dentro de access.html.
// Correrlo cada vez que cambies videos, descargas o la contraseña; después: commit + push.
// La carpeta privado/ nunca se sube a GitHub: el sitio solo publica el contenido cifrado.
import { readFileSync, writeFileSync } from "node:fs";
import { webcrypto as crypto } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const ITERACIONES = 600000; // PBKDF2-SHA256; debe coincidir con lo que lee js/miembros.js (va dentro del paquete)

const clave = readFileSync(join(raiz, "privado/clave.txt"), "utf8").trim().toUpperCase(); // sin distinguir mayúsculas (la página hace lo mismo)
if (clave.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres.");
const contenido = JSON.parse(readFileSync(join(raiz, "privado/miembros.json"), "utf8")); // valida el JSON

const sal = crypto.getRandomValues(new Uint8Array(16));
const iv = crypto.getRandomValues(new Uint8Array(12));
const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(clave), "PBKDF2", false, ["deriveKey"]);
const llave = await crypto.subtle.deriveKey(
  { name: "PBKDF2", salt: sal, iterations: ITERACIONES, hash: "SHA-256" },
  base, { name: "AES-GCM", length: 256 }, false, ["encrypt"]
);
const cifrado = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, llave, new TextEncoder().encode(JSON.stringify(contenido)));

const b64 = (b) => Buffer.from(b).toString("base64");
const paquete = JSON.stringify({ v: 1, iter: ITERACIONES, sal: b64(sal), iv: b64(iv), datos: b64(cifrado) });

const ruta = join(raiz, "access.html");
const html = readFileSync(ruta, "utf8");
const patron = /(<script type="application\/json" id="contenido-cifrado">)[\s\S]*?(<\/script>)/;
if (!patron.test(html)) throw new Error("No encontré el bloque #contenido-cifrado en access.html");
writeFileSync(ruta, html.replace(patron, `$1${paquete}$2`));
console.log(`Listo: access.html actualizado (${contenido.secciones.reduce((n, s) => n + s.videos.length, 0)} videos, ${contenido.descargas.length} descargas).`);
