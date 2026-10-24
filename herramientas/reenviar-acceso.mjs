// SPECTRE · reenvía el link para crear/cambiar la contraseña a un comprador.
// Uso: node herramientas/reenviar-acceso.mjs correo@cliente.com
// Solo manda si ESE correo tiene una compra activa (el link siempre va al mismo correo de la compra, nunca a otro).
// No cambia correos, no da accesos nuevos ni toca compras.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const correo = String(process.argv[2] || "").trim().toLowerCase();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) { console.log("✗ correo no válido"); process.exit(1); }

const { ref } = JSON.parse(readFileSync(join(RAIZ, "privado", "supabase.json"), "utf8"));
const token = readFileSync(join(RAIZ, "privado", "supabase-token.txt"), "utf8").trim();
const ks = await (await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys?reveal=true`, { headers: { Authorization: "Bearer " + token } })).json();
const servicio = ks.find((k) => k.name === "service_role").api_key;
const H = { apikey: servicio, Authorization: "Bearer " + servicio, "Content-Type": "application/json" };

const compras = await (await fetch(`https://${ref}.supabase.co/rest/v1/compras?email=eq.${encodeURIComponent(correo)}&activa=is.true&select=edicion,motivo`, { headers: H })).json();
const reales = (compras || []).filter((c) => !["prueba", "prueba-ui"].includes(c.motivo || ""));
if (!reales.length) { console.log("✗ ese correo no tiene una compra activa: no se manda nada"); process.exit(2); }

const r = await fetch(`https://${ref}.supabase.co/auth/v1/recover?redirect_to=${encodeURIComponent("https://spectrecolor.com/access")}`, { method: "POST", headers: H, body: JSON.stringify({ email: correo }) });
if (!r.ok) { console.log("✗ Supabase no mandó el link:", r.status, (await r.text()).slice(0, 120)); process.exit(3); }
const productos = [...new Set(reales.map((c) => (c.motivo === "upgrade desde LUT Pack" || c.edicion === "full" ? "Full System" : "LUT Pack")))].join(" + ");
console.log(`✓ link para crear su contraseña enviado a ${correo} (compró: ${productos})`);
