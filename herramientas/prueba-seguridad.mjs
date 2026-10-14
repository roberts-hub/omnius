// SPECTRE · pruebas de seguridad del área de miembros (cuentas por comprador).
// Uso: node herramientas/prueba-seguridad.mjs [--sitio http://localhost:4181]
//
// Ataca el sistema como lo haría alguien de fuera y comprueba que TODO falle donde debe fallar:
//   A. sin cuenta: leer/escribir tablas, buscar correos, registrarse, GraphQL
//   B. webhook: llamadas sin firma, con firma falsa, repetidas (replay), cuerpo alterado
//   C. con cuenta pero sin compra: leer contenido, darse acceso, editar compras, espiar a otros
//   D. con compra del LUT Pack: no puede ver el Full System ni subirse de edición
//   E. reembolso: al desactivar la compra, el contenido desaparece
//   F. tokens falsificados o alterados (rol service_role, otro usuario, firma inventada)
//   G. contraseñas: políticas del servidor, enumeración de correos, fuerza bruta
//   H. fugas: el sitio publicado y el repositorio no contienen llaves, contraseñas ni contenido privado
// Crea usuarios temporales (prueba-*@example.com) y los borra al terminar.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const PRIV = (f) => join(RAIZ, "privado", f);
const { ref } = JSON.parse(readFileSync(PRIV("supabase.json"), "utf8"));
const TOKEN = readFileSync(PRIV("supabase-token.txt"), "utf8").trim();
const URL_SB = `https://${ref}.supabase.co`;
const SITIO = process.argv.includes("--sitio") ? process.argv[process.argv.indexOf("--sitio") + 1] : "https://spectrecolor.com";

let ok = 0, fallos = 0;
const bien = (m) => { ok++; console.log("  ✓", m); };
const mal = (m) => { fallos++; console.log("  ✗ FALLA DE SEGURIDAD:", m); };
const esperar = (cond, m, detalle = "") => (cond ? bien(m) : mal(m + (detalle ? ` → ${detalle}` : "")));
const seccion = (t) => console.log("\n" + t);

const keys = await (await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys?reveal=true`, { headers: { Authorization: `Bearer ${TOKEN}` } })).json();
const de = (...t) => keys.find((k) => t.includes(k.name) || t.includes(k.type))?.api_key;
const ANON = de("anon", "publishable");
const SERVICIO = de("service_role", "secret");

async function pedir(ruta, { metodo = "GET", token, llave = ANON, cuerpo, cabeceras = {} } = {}) {
  const r = await fetch(URL_SB + ruta, {
    method: metodo,
    headers: { apikey: llave, ...(token ? { Authorization: "Bearer " + token } : {}), "Content-Type": "application/json", ...cabeceras },
    body: cuerpo === undefined ? undefined : typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo),
  });
  const t = await r.text();
  let j; try { j = JSON.parse(t); } catch { j = t; }
  return { s: r.status, j };
}
const admin = (ruta, o = {}) => pedir(ruta, { ...o, llave: SERVICIO, token: SERVICIO });
const vacio = (r) => r.s >= 400 || (Array.isArray(r.j) && r.j.length === 0);
const negado = (r) => r.s >= 400 || (Array.isArray(r.j) && r.j.length === 0) || r.j === null;

// ── usuarios temporales ──
const sufijo = crypto.randomBytes(4).toString("hex");
const CLAVE = "Prueba-" + crypto.randomBytes(9).toString("base64url") + "9a";
async function crearUsuario(nombre) {
  const email = `prueba-${nombre}-${sufijo}@example.com`;
  const r = await admin("/auth/v1/admin/users", { metodo: "POST", cuerpo: { email, password: CLAVE, email_confirm: true } });
  if (r.s >= 300) throw new Error("no pude crear usuario de prueba: " + JSON.stringify(r.j));
  const s = await pedir("/auth/v1/token?grant_type=password", { metodo: "POST", cuerpo: { email, password: CLAVE } });
  return { id: r.j.id, email, token: s.j.access_token };
}
const creados = [];

try {
  // ══════════ A. sin cuenta ══════════
  seccion("A. Visitante sin cuenta");
  esperar(negado(await pedir("/rest/v1/ediciones?select=*")), "no puede leer el contenido de las ediciones");
  esperar(negado(await pedir("/rest/v1/compras?select=*")), "no puede leer la lista de compradores");
  esperar(negado(await pedir("/rest/v1/descargas?select=*")), "no puede leer el registro de descargas");
  esperar((await pedir("/rest/v1/compras", { metodo: "POST", cuerpo: { user_id: crypto.randomUUID(), email: "x@x.com", edicion: "full" } })).s >= 400, "no puede insertar una compra");
  esperar((await pedir("/rest/v1/ediciones?id=eq.full", { metodo: "PATCH", cuerpo: { contenido: {} } })).s >= 400, "no puede modificar ediciones");
  esperar((await pedir("/rest/v1/ediciones?id=eq.full", { metodo: "DELETE" })).s >= 400, "no puede borrar ediciones");
  esperar((await pedir("/rest/v1/rpc/usuario_por_correo", { metodo: "POST", cuerpo: { correo: "roberto@arechederra.com" } })).s >= 400, "no puede averiguar si un correo tiene cuenta (función interna bloqueada)");
  const alta = await pedir("/auth/v1/signup", { metodo: "POST", cuerpo: { email: `intruso-${sufijo}@example.com`, password: "Intruso-12345678" } });
  esperar(alta.s >= 400, "no puede crearse una cuenta por su cuenta (registro desactivado)", JSON.stringify(alta.j).slice(0, 120));
  const otp = await pedir("/auth/v1/otp", { metodo: "POST", cuerpo: { email: `intruso-${sufijo}@example.com`, create_user: true } });
  esperar(otp.s >= 400, "no puede crearse una cuenta con link mágico", JSON.stringify(otp.j).slice(0, 120));
  const gql = await pedir("/graphql/v1", { metodo: "POST", cuerpo: { query: "{ edicionesCollection { edges { node { id contenido } } } }" } });
  esperar(!JSON.stringify(gql.j).includes("cifrado") && !JSON.stringify(gql.j).includes("youtu"), "GraphQL no expone contenido");
  esperar(negado(await pedir("/rest/v1/ediciones?select=*", { token: ANON })), "la llave pública como token tampoco abre el contenido");

  // ══════════ B. webhook ══════════
  seccion("B. Webhook de Stripe (fingir un pago)");
  const W = URL_SB + "/functions/v1/stripe-webhook";
  const evento = JSON.stringify({ id: "evt_falso", type: "checkout.session.completed", data: { object: { id: "cs_falso_" + sufijo, payment_status: "paid", payment_link: "plink_1UQBuJFethND82y0dUdl1vfy", customer_details: { email: `atacante-${sufijo}@example.com` } } } });
  const firmar = (secreto, t, cuerpo) => crypto.createHmac("sha256", secreto).update(`${t}.${cuerpo}`).digest("hex");
  const ahora = Math.floor(Date.now() / 1000);
  const post = async (cab, cuerpo = evento) => (await fetch(W, { method: "POST", headers: { "Content-Type": "application/json", ...cab }, body: cuerpo })).status;
  esperar((await post({})) === 400, "pago falso sin firma: rechazado");
  esperar((await post({ "stripe-signature": `t=${ahora},v1=${firmar("whsec_inventado", ahora, evento)}` })) === 400, "pago falso con firma inventada: rechazado");
  esperar((await post({ "stripe-signature": `t=${ahora},v1=deadbeef` })) === 400, "pago falso con firma basura: rechazado");
  esperar((await post({ "stripe-signature": `t=${ahora - 3600},v1=${firmar("whsec_inventado", ahora - 3600, evento)}` })) === 400, "evento viejo repetido (replay): rechazado");
  esperar((await post({ "stripe-signature": "" })) === 400, "cabecera de firma vacía: rechazada");
  esperar((await fetch(W)).status === 405, "solo acepta POST");
  const atacante = await admin(`/rest/v1/compras?email=eq.atacante-${sufijo}@example.com&select=id`);
  esperar(Array.isArray(atacante.j) && atacante.j.length === 0, "ningún pago falso creó una compra ni una cuenta");

  // ══════════ C. con cuenta, sin compra ══════════
  seccion("C. Usuario con cuenta pero SIN compra");
  const sin = await crearUsuario("sin"); creados.push(sin);
  esperar(!!sin.token, "puede iniciar sesión (la cuenta existe)");
  esperar(vacio(await pedir("/rest/v1/ediciones?select=*", { token: sin.token })), "no ve ningún contenido");
  esperar(vacio(await pedir("/rest/v1/ediciones?id=eq.full&select=*", { token: sin.token })), "aunque pida directamente el Full System, no lo recibe");
  const darse = await pedir("/rest/v1/compras", { metodo: "POST", token: sin.token, cuerpo: { user_id: sin.id, email: sin.email, edicion: "full" } });
  esperar(darse.s >= 400, "no puede darse acceso a sí mismo (insertar una compra)", darse.s);
  esperar(vacio(await pedir("/rest/v1/ediciones?select=id", { token: sin.token })), "después del intento sigue sin contenido");
  esperar((await pedir("/rest/v1/rpc/usuario_por_correo", { metodo: "POST", token: sin.token, cuerpo: { correo: "roberto@arechederra.com" } })).s >= 400, "no puede buscar correos de otros compradores");
  esperar(vacio(await pedir("/rest/v1/descargas?select=*", { token: sin.token })), "no puede leer el registro de descargas");
  const ajeno = await pedir("/rest/v1/descargas", { metodo: "POST", token: sin.token, cuerpo: { user_id: crypto.randomUUID(), archivo: "x" } });
  esperar(ajeno.s >= 400, "no puede registrar descargas a nombre de otro usuario");

  // ══════════ D. con compra del LUT Pack ══════════
  seccion("D. Comprador del LUT Pack");
  const luts = await crearUsuario("luts"); creados.push(luts);
  await admin("/rest/v1/compras", { metodo: "POST", cuerpo: { user_id: luts.id, email: luts.email, edicion: "luts", motivo: "prueba" } });
  const suyas = await pedir("/rest/v1/ediciones?select=id", { token: luts.token });
  esperar(Array.isArray(suyas.j) && suyas.j.length === 1 && suyas.j[0].id === "luts", "ve SOLO el LUT Pack", JSON.stringify(suyas.j));
  esperar(vacio(await pedir("/rest/v1/ediciones?id=eq.full&select=*", { token: luts.token })), "no puede ver el Full System pidiéndolo directamente");
  const subir = await pedir(`/rest/v1/compras?user_id=eq.${luts.id}`, { metodo: "PATCH", token: luts.token, cuerpo: { edicion: "full" } });
  esperar(subir.s >= 400 || vacio(subir), "no puede cambiarse de LUT Pack a Full System");
  esperar(vacio(await pedir("/rest/v1/ediciones?id=eq.full&select=id", { token: luts.token })), "después del intento sigue sin el Full System");
  const misCompras = await pedir("/rest/v1/compras?select=email", { token: luts.token });
  esperar(Array.isArray(misCompras.j) && misCompras.j.every((c) => c.email === luts.email), "solo ve sus propias compras, no las de otros");
  esperar((await pedir(`/rest/v1/compras?user_id=eq.${luts.id}`, { metodo: "DELETE", token: luts.token })).s >= 400, "no puede borrar compras");
  const edita = await pedir("/rest/v1/ediciones?id=eq.luts", { metodo: "PATCH", token: luts.token, cuerpo: { contenido: { hackeado: true } } });
  esperar(edita.s >= 400, "no puede modificar el contenido de su edición");
  esperar((await pedir("/rest/v1/descargas", { metodo: "POST", token: luts.token, cuerpo: { archivo: "SPECTRE LUT Pack.zip" } })).s < 300, "sí puede registrar su propia descarga");

  // ══════════ E. reembolso ══════════
  seccion("E. Reembolso / contracargo");
  await admin(`/rest/v1/compras?user_id=eq.${luts.id}`, { metodo: "PATCH", cuerpo: { activa: false, motivo: "prueba reembolso" } });
  esperar(vacio(await pedir("/rest/v1/ediciones?select=id", { token: luts.token })), "al desactivar la compra, pierde el acceso aunque siga con sesión abierta");

  // ══════════ F. tokens falsificados ══════════
  seccion("F. Tokens alterados o inventados");
  const [h, p] = luts.token.split(".");
  const carga = JSON.parse(Buffer.from(p, "base64url").toString());
  const reempacar = (cambios) => `${h}.${Buffer.from(JSON.stringify({ ...carga, ...cambios })).toString("base64url")}.${luts.token.split(".")[2]}`;
  esperar((await pedir("/rest/v1/ediciones?select=id", { token: reempacar({ role: "service_role" }) })).s === 401, "token alterado a service_role: rechazado");
  esperar((await pedir("/rest/v1/ediciones?select=id", { token: reempacar({ sub: sin.id }) })).s === 401, "token alterado a otro usuario: rechazado");
  esperar((await pedir("/rest/v1/ediciones?select=id", { token: reempacar({ exp: 4102444800 }) })).s === 401, "token con vencimiento alargado: rechazado");
  const inventado = ["eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9", Buffer.from(JSON.stringify({ role: "service_role", iss: "supabase" })).toString("base64url"), crypto.randomBytes(32).toString("base64url")].join(".");
  esperar((await pedir("/rest/v1/ediciones?select=id", { token: inventado })).s === 401, "token inventado con firma falsa: rechazado");
  const sinFirma = `${Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url")}.${Buffer.from(JSON.stringify({ ...carga, role: "service_role" })).toString("base64url")}.`;
  esperar((await pedir("/rest/v1/ediciones?select=id", { token: sinFirma })).s === 401, "token sin firma (alg none): rechazado");

  // ══════════ G. contraseñas ══════════
  seccion("G. Contraseñas");
  esperar((await pedir("/auth/v1/token?grant_type=password", { metodo: "POST", cuerpo: { email: sin.email, password: "incorrecta" } })).s >= 400, "contraseña incorrecta: no entra");
  const debil = await pedir("/auth/v1/user", { metodo: "PUT", token: sin.token, cuerpo: { password: "abc" } });
  esperar(debil.s >= 400, "el servidor rechaza contraseñas débiles (aunque alguien salte el formulario)", debil.s);
  const sinNumero = await pedir("/auth/v1/user", { metodo: "PUT", token: sin.token, cuerpo: { password: "SoloLetrasLargas" } });
  esperar(sinNumero.s >= 400, "el servidor exige mayúscula, minúscula y número", sinNumero.s);
  const r1 = await pedir("/auth/v1/recover", { metodo: "POST", cuerpo: { email: `no-existe-${sufijo}@example.com` } });
  esperar(r1.s < 300 || r1.s === 429, "'olvidé mi contraseña' no revela si un correo tiene cuenta", r1.s);
  let bloqueado = false;
  for (let i = 0; i < 40 && !bloqueado; i++) {
    const r = await pedir("/auth/v1/token?grant_type=password", { metodo: "POST", cuerpo: { email: sin.email, password: "fuerza-bruta-" + i } });
    if (r.s === 429) bloqueado = true;
  }
  esperar(bloqueado, "fuerza bruta: el servidor bloquea tras muchos intentos (429)");

  // ══════════ H. fugas ══════════
  seccion(`H. Fugas en el sitio (${SITIO}) y en el repositorio`);
  const contenido = ["full", "luts"].map((e) => existsSync(PRIV(`contenido-${e}.json`)) ? JSON.parse(readFileSync(PRIV(`contenido-${e}.json`), "utf8")) : null).filter(Boolean);
  const secretos = new Set();
  for (const c of contenido) {
    for (const d of c.descargas) if (d.cifrado) secretos.add(d.cifrado.llave);
    for (const s of c.secciones) for (const v of s.videos) { const m = String(v.youtube || "").match(/([\w-]{11})$/); if (m) secretos.add(m[1]); }
  }
  for (const f of ["clave-full.txt", "clave-luts.txt"]) if (existsSync(PRIV(f))) secretos.add(readFileSync(PRIV(f), "utf8").trim());
  secretos.add(SERVICIO); secretos.add(TOKEN);
  const patrones = [/sk_live_\w{10,}/, /rk_live_\w{10,}/, /whsec_\w{10,}/, /sbp_\w{10,}/, /service_role/];
  const paginas = ["/", "/get", "/es/", "/es/get", "/access", "/terms", "/js/main.js", "/js/miembros.js", "/js/cuentas-config.js", "/sw.js", "/descargas/manifest.json"];
  let fugaSitio = [];
  for (const p of paginas) {
    const t = await (await fetch(SITIO + p)).text().catch(() => "");
    for (const s of secretos) if (s && t.includes(s)) fugaSitio.push(`${p} contiene un secreto (${s.slice(0, 4)}…)`);
    for (const re of patrones) if (re.test(t) && !(p === "/js/cuentas-config.js" && re.source === "service_role")) fugaSitio.push(`${p} coincide con ${re}`);
    if (t.includes("contenido-cifrado")) fugaSitio.push(`${p} todavía trae bóvedas con contraseña`);
  }
  esperar(fugaSitio.length === 0, "el sitio no expone llaves de descarga, videos privados, contraseñas ni llaves de servidor", fugaSitio.join("; "));
  const cfg = await (await fetch(SITIO + "/js/cuentas-config.js")).text();
  const llaveSitio = (cfg.match(/"llave":"([^"]+)"/) || [])[1];
  if (llaveSitio) {
    const rol = JSON.parse(Buffer.from(llaveSitio.split(".")[1] || "e30", "base64url").toString() || "{}").role;
    esperar(!rol || rol === "anon", "la llave que publica el sitio es la pública (anon), no la de servidor", rol);
  }
  const rastreados = execFileSync("git", ["ls-files"], { cwd: RAIZ, encoding: "utf8" }).split("\n").filter((f) => f && !f.startsWith("descargas/") && !/\.(jpg|png|mp4|pdf|ico|bin|woff2?)$/i.test(f));
  const fugaRepo = [];
  for (const f of rastreados) {
    const ruta = join(RAIZ, f);
    if (!existsSync(ruta) || statSync(ruta).size > 3e6) continue;
    const t = readFileSync(ruta, "utf8");
    for (const s of secretos) if (s && t.includes(s)) fugaRepo.push(`${f} (${s.slice(0, 4)}…)`);
    for (const re of patrones.slice(0, 4)) if (re.test(t)) fugaRepo.push(`${f} ${re}`);
  }
  esperar(fugaRepo.length === 0, "ningún archivo del repositorio (público) contiene secretos", fugaRepo.join("; "));
  esperar(execFileSync("git", ["check-ignore", "privado/contenido-full.json"], { cwd: RAIZ, encoding: "utf8" }).trim() !== "", "privado/ está excluido de git");
} catch (e) {
  mal("la prueba no pudo terminar: " + e.message);
} finally {
  for (const u of creados) await admin(`/auth/v1/admin/users/${u.id}`, { metodo: "DELETE" });
  await admin(`/rest/v1/compras?email=like.prueba-*-${sufijo}@example.com`, { metodo: "DELETE" });
  console.log(`\n${fallos ? "✗" : "✓"} ${ok} pruebas pasaron, ${fallos} fallaron. Usuarios de prueba borrados.`);
  process.exit(fallos ? 1 : 0);
}
