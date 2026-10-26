// SPECTRE · resumen de actividad para el correo diario de Roberto (lo llama Google Apps Script).
// Protegido con RESUMEN_TOKEN (secreto compartido solo con el Apps Script). Devuelve las cuentas con
// bandera roja o bloqueadas y un conteo general. Nunca devuelve contenido ni llaves.
// Con ?bloquear=<correo> (POST) bloquea esa cuenta (botón del correo de alerta).
// Con ?ventas=1 devuelve las compras de los últimos 3 días (aviso de venta por correo).
// Con ?reviews=invitar / enviada / nuevas maneja el correo de review a los 7 días (ver 0014_reviews.sql).
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
    const params = new URL(req.url).searchParams;

    // ?bloquear=<correo> (POST): bloquea la cuenta desde el botón del correo de alerta y cierra sus sesiones
    if (params.get("bloquear")) {
      if (req.method !== "POST") return new Response("usa POST", { status: 405 });
      const correo = params.get("bloquear")!.trim().toLowerCase();
      const id = await leer("/rest/v1/rpc/usuario_por_correo", { method: "POST", body: JSON.stringify({ correo }) });
      if (!id) return Response.json({ ok: false, mensaje: "No existe una cuenta con ese correo." }, { status: 404 });
      const r = await fetch(URL_SB + "/rest/v1/bloqueos?on_conflict=user_id", {
        method: "POST", headers: { ...CAB, Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify({ user_id: id, motivo: "bloqueada desde la alerta", automatico: false }),
      });
      if (!r.ok) throw new Error("bloqueo " + r.status);
      await fetch(URL_SB + `/auth/v1/admin/users/${id}/logout`, { method: "POST", headers: CAB }).catch(() => {});
      return Response.json({ ok: true, mensaje: `${correo} quedó bloqueada: ya no puede abrir el área de miembros.` });
    }

    // ?ventas=1: compras de los últimos 3 días para el aviso de venta por correo (Apps Script, cada 5 min)
    if (params.get("ventas") === "1") {
      const desde = new Date(Date.now() - 3 * 864e5).toISOString();
      const ventas = await leer(`/rest/v1/compras?creada=gt.${desde}&select=id,creada,email,edicion,monto,moneda,pais,origen,motivo,activa&order=creada`);
      return Response.json({ ventas });
    }

    // ?reviews=invitar: compradores que cumplieron 7 días desde su última compra (el Apps Script les manda el correo).
    // Mientras el secreto REVIEWS_ACTIVAS no sea "1" no devuelve a nadie (así se prueba sin escribirle a clientes).
    if (params.get("reviews") === "invitar") {
      if (Deno.env.get("REVIEWS_ACTIVAS") !== "1") return Response.json({ activas: false, invitar: [] });
      const invitar = await leer("/rest/v1/rpc/reviews_por_invitar", { method: "POST", body: "{}" });
      return Response.json({ activas: true, invitar });
    }
    // ?reviews=enviada&token=… (POST): el correo ya salió
    if (params.get("reviews") === "enviada") {
      if (req.method !== "POST") return new Response("usa POST", { status: 405 });
      const token = params.get("token") ?? "";
      if (!/^[0-9a-f-]{36}$/.test(token)) return new Response("token", { status: 400 });
      await fetch(URL_SB + "/rest/v1/rpc/review_marcar_invitada", { method: "POST", headers: CAB, body: JSON.stringify({ p_token: token }) });
      return Response.json({ ok: true });
    }
    // ?reviews=nuevas: reviews recién escritas → aviso al celular aquí y correo desde el Apps Script
    if (params.get("reviews") === "nuevas") {
      const nuevas = await leer("/rest/v1/rpc/reviews_nuevas", { method: "POST", body: "{}" });
      const PUSH = Deno.env.get("PUSH_TOKEN") ?? "";
      for (const n of nuevas) {
        const estrellas = "★".repeat(n.estrellas) + "☆".repeat(5 - n.estrellas);
        await fetch(URL_SB + "/functions/v1/push", {
          method: "POST", headers: { "Content-Type": "application/json", "x-push-token": PUSH },
          body: JSON.stringify({ tipo: "aviso", titulo: `Nuevo review · ${estrellas}`, texto: `${n.nombre}${n.instagram ? " (@" + n.instagram + ")" : ""}: ${String(n.texto).slice(0, 140)}\nApruébalo en el panel → Reviews` }),
        }).catch(() => {});
      }
      return Response.json({ nuevas });
    }

    const filas = await leer("/rest/v1/rpc/actividad_cuentas", { method: "POST", body: "{}" });
    // las cuentas @example.com son de herramientas/prueba-seguridad.mjs (se borran solas): no se avisan
    const alertas = filas.filter((f: any) => (f.bandera || f.bloqueada) && !/@example\.com$/i.test(f.email || ""));
    if (params.get("respaldo") !== "1") {
      // para el correo de alerta: las entradas de las últimas 24 h de cada cuenta con bandera (hora, IP, dispositivo)
      if (alertas.length) {
        const ids = new Map<string, string>();
        for (const a of alertas) ids.set(a.email, await leer("/rest/v1/rpc/usuario_por_correo", { method: "POST", body: JSON.stringify({ correo: a.email }) }));
        const desde = new Date(Date.now() - 864e5).toISOString();
        for (const a of alertas) {
          const id = ids.get(a.email);
          a.entradas = id ? await leer(`/rest/v1/accesos?user_id=eq.${id}&creada=gt.${desde}&select=creada,ip,agente&order=creada.desc&limit=40`) : [];
        }
      }
      return Response.json({ cuentas: filas.length, alertas });
    }

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
