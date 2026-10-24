// SPECTRE · manda un aviso al celular de Roberto (la app SPECTRE de la pantalla de inicio, con el logo).
// Uso: node herramientas/avisar.mjs "Título" "Texto"   (lo usan las tareas de soporte y seguimiento)
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const [titulo = "SPECTRE", texto = ""] = process.argv.slice(2);
const { ref } = JSON.parse(readFileSync(join(RAIZ, "privado", "supabase.json"), "utf8"));
const { token } = JSON.parse(readFileSync(join(RAIZ, "privado", "push-vapid.json"), "utf8"));
const r = await fetch(`https://${ref}.supabase.co/functions/v1/push`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-push-token": token },
  body: JSON.stringify({ tipo: "aviso", titulo: titulo.slice(0, 80), texto: texto.slice(0, 240) }),
});
const d = await r.json().catch(() => ({}));
console.log(r.ok && d.entregados ? `✓ aviso entregado a ${d.entregados} celular(es)` : `✗ aviso no entregado (${r.status} ${JSON.stringify(d).slice(0, 120)})`);
if (!r.ok || !d.entregados) process.exit(1);
