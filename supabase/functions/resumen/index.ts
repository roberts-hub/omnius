// SPECTRE · resumen de actividad para el correo diario de Roberto (lo llama Google Apps Script).
// Protegido con RESUMEN_TOKEN (secreto compartido solo con el Apps Script). Devuelve las cuentas con
// bandera roja o bloqueadas y un conteo general. Nunca devuelve contenido ni llaves.
const URL_SB = Deno.env.get("SUPABASE_URL")!;
const SERVICIO = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TOKEN = Deno.env.get("RESUMEN_TOKEN") ?? "";

function igualSeguro(a: string, b: string) {
  if (!a || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

Deno.serve(async (req) => {
  if (!TOKEN || !igualSeguro(req.headers.get("x-resumen-token") ?? "", TOKEN)) return new Response("no", { status: 401 });
  const r = await fetch(`${URL_SB}/rest/v1/rpc/actividad_cuentas`, {
    method: "POST",
    headers: { apikey: SERVICIO, Authorization: `Bearer ${SERVICIO}`, "Content-Type": "application/json" },
    body: "{}",
  });
  if (!r.ok) return new Response("error", { status: 500 });
  const filas = await r.json();
  const alertas = filas.filter((f: any) => f.bandera || f.bloqueada);
  return Response.json({ cuentas: filas.length, alertas });
});
