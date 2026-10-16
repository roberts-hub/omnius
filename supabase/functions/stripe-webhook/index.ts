// SPECTRE · webhook de Stripe (Supabase Edge Function, Deno).
//
// Stripe llama aquí en cada pago. Este servidor:
//   1. Verifica la firma de Stripe (HMAC-SHA256 con STRIPE_WEBHOOK_SECRET): nadie más puede fingir un pago.
//   2. checkout.session.completed (pagado) → crea la cuenta del comprador si no existe (Supabase le manda el
//      correo "crea tu contraseña") y registra la compra de su edición.
//   3. charge.refunded (reembolso total) o charge.dispute.created (contracargo) → desactiva esa compra:
//      el comprador pierde el acceso a esa edición.
//
// Secretos (supabase secrets): STRIPE_WEBHOOK_SECRET, PLINK_FULL, PLINK_LUTS, SITIO.
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los pone Supabase solo.
// Se despliega con --no-verify-jwt (Stripe no manda JWT; la seguridad es la firma).

const URL_SB = Deno.env.get("SUPABASE_URL")!;
const SERVICIO = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SECRETO = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
const SITIO = Deno.env.get("SITIO") ?? "https://spectrecolor.com";
// a dónde lleva el link del correo "Create your password" (en pruebas puede ser http://localhost:4181/access.html)
const ACCESO = Deno.env.get("ACCESO") || SITIO + "/access";
// cada secreto puede llevar varios links separados por coma (por ejemplo el link viejo y el nuevo al cambiar un precio)
const LINKS: Record<string, "full" | "luts"> = {};
for (const [secreto, edicion] of [["PLINK_FULL", "full"], ["PLINK_LUTS", "luts"], ["PLINK_PRUEBA", "luts"]] as const) {
  for (const id of (Deno.env.get(secreto) ?? "").split(",").map((x) => x.trim()).filter(Boolean)) LINKS[id] = edicion;
}
const TOLERANCIA_S = 300;

const cabeceras = { apikey: SERVICIO, Authorization: `Bearer ${SERVICIO}`, "Content-Type": "application/json" };
const responder = (estado: number, texto: string) => new Response(texto, { status: estado });

// ── firma de Stripe ──
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
function igualSeguro(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
async function firmaValida(cuerpo: string, cabecera: string | null) {
  if (!cabecera || !SECRETO) return false;
  const partes = cabecera.split(",").map((p) => p.split("="));
  const t = partes.find(([k]) => k === "t")?.[1];
  const firmas = partes.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!t || !firmas.length) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > TOLERANCIA_S) return false; // evita repetir eventos viejos
  const llave = await crypto.subtle.importKey("raw", new TextEncoder().encode(SECRETO), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const esperada = hex(await crypto.subtle.sign("HMAC", llave, new TextEncoder().encode(`${t}.${cuerpo}`)));
  return firmas.some((f) => igualSeguro(f, esperada));
}

// ── Supabase (con la llave de servicio: solo existe en este servidor) ──
async function sb(ruta: string, opciones: RequestInit = {}) {
  const r = await fetch(`${URL_SB}${ruta}`, { ...opciones, headers: { ...cabeceras, ...(opciones.headers || {}) } });
  const texto = await r.text();
  if (!r.ok) throw new Error(`${ruta} → ${r.status} ${texto}`);
  return texto ? JSON.parse(texto) : null;
}

async function usuarioDe(correo: string): Promise<{ id: string; nuevo: boolean }> {
  const existente = await sb("/rest/v1/rpc/usuario_por_correo", { method: "POST", body: JSON.stringify({ correo }) });
  if (existente) {
    // ya tenía cuenta: si nunca creó su contraseña (o su primer correo no salió), se le manda el link de nuevo.
    // Si ya entra normalmente, no se le manda nada: con su correo y contraseña de siempre ve lo nuevo.
    const u = await sb(`/auth/v1/admin/users/${existente}`);
    if (!u.last_sign_in_at) {
      await sb(`/auth/v1/recover?redirect_to=${encodeURIComponent(ACCESO)}`, { method: "POST", body: JSON.stringify({ email: correo }) })
        .catch((e) => console.error("no se pudo reenviar el link", String(e)));
    }
    return { id: existente, nuevo: false };
  }
  // invitación: Supabase crea la cuenta y le manda el correo para crear su contraseña
  const invitado = await sb(`/auth/v1/invite?redirect_to=${encodeURIComponent(ACCESO)}`, {
    method: "POST",
    body: JSON.stringify({ email: correo }),
  });
  return { id: invitado.id, nuevo: true };
}

async function registrarCompra(sesion: any) {
  // "no_payment_required": compra con un código de 100% de descuento (total $0); también da acceso
  if (sesion.payment_status !== "paid" && sesion.payment_status !== "no_payment_required") return "sin pagar";
  const edicion = LINKS[sesion.payment_link];
  if (!edicion) return "link ajeno a SPECTRE";
  const correo = String(sesion.customer_details?.email || "").trim().toLowerCase();
  if (!correo) throw new Error("sesión sin correo");
  const { id, nuevo } = await usuarioDe(correo);
  await sb("/rest/v1/compras?on_conflict=stripe_session", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates" },
    body: JSON.stringify({
      user_id: id,
      email: correo,
      edicion,
      stripe_session: sesion.id,
      stripe_payment_intent: sesion.payment_intent ?? null,
      nombre: sesion.customer_details?.name ?? null,
      pais: sesion.customer_details?.address?.country ?? null,
      monto: typeof sesion.amount_total === "number" ? sesion.amount_total / 100 : null,
      moneda: sesion.currency ?? null,
      // pregunta del checkout "Email me new looks and updates?" (dropdown): sí = acepta recibir novedades
      novedades: (sesion.custom_fields ?? []).some((f: any) => f.dropdown?.value === "yeskeepmeposted")
        ? true : (sesion.custom_fields ?? []).some((f: any) => f.dropdown?.value) ? false : null,
    }),
  });
  return `${edicion} para ${correo}${nuevo ? " (cuenta nueva, invitación enviada)" : " (cuenta existente)"}`;
}

async function desactivar(pagoId: string, motivo: string) {
  if (!pagoId) return "sin payment_intent";
  await sb(`/rest/v1/compras?stripe_payment_intent=eq.${encodeURIComponent(pagoId)}`, {
    method: "PATCH",
    body: JSON.stringify({ activa: false, motivo }),
  });
  return `acceso retirado (${motivo})`;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return responder(405, "solo POST");
  const cuerpo = await req.text();
  if (!(await firmaValida(cuerpo, req.headers.get("stripe-signature")))) return responder(400, "firma inválida");

  const evento = JSON.parse(cuerpo);
  const o = evento.data?.object ?? {};
  try {
    let resultado = "ignorado";
    if (evento.type === "checkout.session.completed" || evento.type === "checkout.session.async_payment_succeeded") {
      resultado = await registrarCompra(o);
    } else if (evento.type === "charge.refunded" && o.refunded) {
      resultado = await desactivar(o.payment_intent, "reembolso");
    } else if (evento.type === "charge.dispute.created") {
      resultado = await desactivar(o.payment_intent, "contracargo");
    }
    console.log(evento.type, evento.id, resultado);
    return responder(200, resultado);
  } catch (e) {
    console.error(evento.type, evento.id, String(e));
    return responder(500, "error"); // Stripe reintenta solo
  }
});
