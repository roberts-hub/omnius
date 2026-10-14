// SPECTRE · resumen de actividad para el correo diario de Roberto (lo llama Google Apps Script).
// Protegido con RESUMEN_TOKEN (secreto compartido solo con el Apps Script). Devuelve las cuentas con
// bandera roja o bloqueadas y un conteo general. Nunca devuelve contenido ni llaves.
// Con ?respaldo=1 devuelve además la base de clientes completa (compras, cuentas, entradas y bloqueos)
// para el respaldo diario en Google Drive. Tampoco incluye contenido, llaves ni contraseñas.
const URL_SB = Deno.env.get("SUPABASE_URL")!;
const SERVICIO = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TOKEN = Deno.env.get("RESUMEN_TOKEN") ?? "";
const CAB = { apikey: SERVICIO, Authorization: `Bearer ${SERVICIO}`, "Content-Type": "application/json" };

function igualSeguro(a: string, b: string) {
  if (!a || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

async function leer(ruta: string, init: RequestInit = {}) {
  const r = await fetch(URL_SB + ruta, { ...init, headers: CAB });
  if (!r.ok) throw new Error(ruta + " → " + r.status);
  return r.json();
}

Deno.serve(async (req) => {
  if (!TOKEN || !igualSeguro(req.headers.get("x-resumen-token") ?? "", TOKEN)) return new Response("no", { status: 401 });
  try {
    const filas = await leer("/rest/v1/rpc/actividad_cuentas", { method: "POST", body: "{}" });
    const alertas = filas.filter((f: any) => f.bandera || f.bloqueada);
    if (new URL(req.url).searchParams.get("respaldo") !== "1") return Response.json({ cuentas: filas.length, alertas });

    // usuarios (solo id, correo y fechas) para poner el correo en cada entrada y bloqueo
    const correos = new Map<string, string>();
    for (let pagina = 1; pagina < 50; pagina++) {
      const { users } = await leer(`/auth/v1/admin/users?page=${pagina}&per_page=1000`);
      users.forEach((u: any) => correos.set(u.id, u.email));
      if (users.length < 1000) break;
    }
    const conCorreo = (x: any) => { const { user_id, ...resto } = x; return { correo: correos.get(user_id) ?? "", ...resto }; };
    const [compras, clientes, accesos, bloqueos] = await Promise.all([
      leer("/rest/v1/compras?select=*&order=creada"),
      leer("/rest/v1/clientes?select=*"),
      leer("/rest/v1/accesos?select=user_id,creada,ip,agente&order=creada.desc&limit=20000"),
      leer("/rest/v1/bloqueos?select=*"),
    ]);
    return Response.json({
      creado: new Date().toISOString(),
      compras, clientes, cuentas: filas, accesos: accesos.map(conCorreo), bloqueos: bloqueos.map(conCorreo),
    });
  } catch (_e) {
    return new Response("error", { status: 500 });
  }
});
