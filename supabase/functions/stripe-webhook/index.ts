// SPECTRE · webhook de Stripe (Supabase Edge Function, Deno).
//
// Stripe llama aquí en cada pago. Este servidor:
//   1. Verifica la firma de Stripe (HMAC-SHA256 con STRIPE_WEBHOOK_SECRET): nadie más puede fingir un pago.
//   2. checkout.session.completed (pagado) → crea la cuenta del comprador si no existe (Supabase le manda el
//      correo "crea tu contraseña") y registra la compra de su edición.
//   3. charge.refunded (reembolso total) o charge.dispute.created (contracargo) → desactiva esa compra:
//      el comprador pierde el acceso a esa edición.
//   4. Upgrade (link PLINK_UPGRADE, $49 = la diferencia): agrega el Full System a la MISMA cuenta que ya tiene el
//      LUT Pack. La cuenta llega en client_reference_id (el área de miembros arma el link con el id de la cuenta);
//      si no, se busca por correo. Si esa cuenta no tiene un LUT Pack activo (o ya tiene el Full System), NO se da
//      acceso: el pago se guarda en upgrades_revisar para que Roberto lo revise (reembolso o LUT Pack).
//
// Secretos (supabase secrets): STRIPE_WEBHOOK_SECRET, PLINK_FULL, PLINK_LUTS, PLINK_UPGRADE, SITIO.
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
const UPGRADES = new Set((Deno.env.get("PLINK_UPGRADE") ?? "").split(",").map((x) => x.trim()).filter(Boolean));
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

// Busca o crea la cuenta del comprador. Devuelve si hay que mandarle el correo para crear su contraseña.
async function usuarioDe(correo: string): Promise<{ id: string; nuevo: boolean; correoPendiente: boolean }> {
  const existente = await sb("/rest/v1/rpc/usuario_por_correo", { method: "POST", body: JSON.stringify({ correo }) });
  if (existente) {
    // ya tenía cuenta: si nunca creó su contraseña (o su primer correo no salió), se le manda el link de nuevo.
    // Si ya entra normalmente, no se le manda nada: con su correo y contraseña de siempre ve lo nuevo.
    const u = await sb(`/auth/v1/admin/users/${existente}`);
    return { id: existente, nuevo: false, correoPendiente: !u.last_sign_in_at };
  }
  // invitación: Supabase crea la cuenta y le manda el correo para crear su contraseña
  try {
    const invitado = await sb(`/auth/v1/invite?redirect_to=${encodeURIComponent(ACCESO)}`, {
      method: "POST",
      body: JSON.stringify({ email: correo }),
    });
    return { id: invitado.id, nuevo: true, correoPendiente: false };
  } catch (e) {
    // si el correo no sale (límite de envíos, Gmail caído…) la cuenta se crea igual SIN correo, para que la
    // compra quede registrada; el correo se reintenta cuando Stripe repita el evento (ver registrarCompra)
    console.error("la invitación no salió; se crea la cuenta sin correo", String(e));
    const creado = await sb("/auth/v1/admin/users", { method: "POST", body: JSON.stringify({ email: correo }) });
    return { id: creado.id, nuevo: true, correoPendiente: true };
  }
}

// compras activas de una cuenta ("luts", "full")
async function edicionesDe(id: string | null): Promise<string[]> {
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return [];
  const filas = await sb(`/rest/v1/compras?user_id=eq.${id}&activa=is.true&select=edicion`);
  return (filas ?? []).map((f: any) => f.edicion);
}

async function registrarUpgrade(sesion: any) {
  // Stripe puede mandar el mismo evento más de una vez: si este pago ya se registró, no se hace nada más
  const ya = await sb(`/rest/v1/compras?stripe_session=eq.${encodeURIComponent(sesion.id)}&select=id`);
  if (ya?.length) return "upgrade ya registrado";
  const yaRevisar = await sb(`/rest/v1/upgrades_revisar?stripe_session=eq.${encodeURIComponent(sesion.id)}&select=id`);
  if (yaRevisar?.length) return "upgrade ya guardado para revisar";
  const correo = String(sesion.customer_details?.email || "").trim().toLowerCase();
  const referencia = String(sesion.client_reference_id || "").trim();
  const datosPago = {
    stripe_session: sesion.id,
    stripe_payment_intent: sesion.payment_intent ?? null,
    monto: typeof sesion.amount_total === "number" ? sesion.amount_total / 100 : null,
    moneda: sesion.currency ?? null,
  };
  // 1. la cuenta que mandó el área de miembros; 2. si no sirve, la cuenta con el correo con el que pagó
  let id: string | null = /^[0-9a-f-]{36}$/i.test(referencia) ? referencia : null;
  let ediciones = await edicionesDe(id);
  if (!ediciones.includes("luts") && correo) {
    const porCorreo = await sb("/rest/v1/rpc/usuario_por_correo", { method: "POST", body: JSON.stringify({ correo }) });
    const deEsa = await edicionesDe(porCorreo);
    if (deEsa.includes("luts") || !id) { id = porCorreo; ediciones = deEsa; }
  }
  if (!id || !ediciones.includes("luts") || ediciones.includes("full")) {
    const motivo = ediciones.includes("full") ? "ya tenía el Full System" : "sin LUT Pack activo";
    await sb("/rest/v1/upgrades_revisar?on_conflict=stripe_session", {
      method: "POST",
      headers: { Prefer: "resolution=ignore-duplicates" },
      body: JSON.stringify({ ...datosPago, email: correo || "(sin correo)", referencia: referencia || null, motivo }),
    });
    return `upgrade NO aplicado (${motivo}) para ${correo}: guardado en upgrades_revisar`;
  }
  // el correo de la compra es el de la cuenta (puede ser distinto al que escribió en Stripe)
  const u = await sb(`/auth/v1/admin/users/${id}`);
  const correoCuenta = String(u?.email || correo).toLowerCase();
  await sb("/rest/v1/compras?on_conflict=stripe_session", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates" },
    body: JSON.stringify({
      ...datosPago,
      user_id: id,
      email: correoCuenta,
      edicion: "full",
      nombre: sesion.customer_details?.name ?? null,
      pais: sesion.customer_details?.address?.country ?? null,
      motivo: "upgrade desde LUT Pack",
    }),
  });
  // correo de confirmación de SPECTRE ("Your SPECTRE purchase is ready", plantilla magic_link sin link de acceso)
  // al correo de la CUENTA. Si no sale, el upgrade ya quedó aplicado: solo se anota (Stripe manda su recibo aparte).
  let correoEnviado = true;
  try {
    await sb("/auth/v1/otp", { method: "POST", body: JSON.stringify({ email: correoCuenta, create_user: false }) });
  } catch (e) {
    correoEnviado = false;
    console.error("upgrade aplicado pero el correo de confirmación no salió", String(e));
  }
  return `upgrade a Full System para ${correoCuenta}${correoEnviado ? " (correo enviado)" : " (SIN correo)"}`;
}

async function registrarCompra(sesion: any) {
  // "no_payment_required": compra con un código de 100% de descuento (total $0); también da acceso
  if (sesion.payment_status !== "paid" && sesion.payment_status !== "no_payment_required") return "sin pagar";
  if (UPGRADES.has(sesion.payment_link)) return await registrarUpgrade(sesion);
  const edicion = LINKS[sesion.payment_link];
  if (!edicion) return "link ajeno a SPECTRE";
  const correo = String(sesion.customer_details?.email || "").trim().toLowerCase();
  if (!correo) throw new Error("sesión sin correo");
  const { id, nuevo, correoPendiente } = await usuarioDe(correo);
  // la compra se registra ANTES de mandar correos: si el correo falla, el pago ya no se pierde
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
      // canal del que vino (links cortos /yt, /ig… o ?utm_source): el sitio lo manda como client_reference_id "src_…"
      origen: /^src_[a-z0-9_-]{1,120}$/i.test(String(sesion.client_reference_id || "")) ? String(sesion.client_reference_id).slice(4) : null,
      // pregunta del checkout "Email me new looks and updates?" (dropdown): sí = acepta recibir novedades
      novedades: (sesion.custom_fields ?? []).some((f: any) => f.dropdown?.value === "yeskeepmeposted")
        ? true : (sesion.custom_fields ?? []).some((f: any) => f.dropdown?.value) ? false : null,
    }),
  });
  if (correoPendiente) {
    // cuenta sin contraseña todavía: link para crearla. Si no sale, se responde error para que Stripe
    // repita el evento más tarde (la compra ya quedó guardada y no se duplica)
    await sb(`/auth/v1/recover?redirect_to=${encodeURIComponent(ACCESO)}`, { method: "POST", body: JSON.stringify({ email: correo }) });
  }
  return `${edicion} para ${correo}${nuevo ? " (cuenta nueva, invitación enviada)" : " (cuenta existente)"}`;
}

async function desactivar(pagoId: string, motivo: string) {
  if (!pagoId) return "sin payment_intent";
  // primero se anota el reembolso (tabla revocaciones): si la compra todavía no ha llegado (Stripe puede
  // mandar los eventos en desorden), entra desactivada cuando llegue. Luego se apaga la que ya exista.
  await sb("/rest/v1/revocaciones?on_conflict=stripe_payment_intent", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates" },
    body: JSON.stringify({ stripe_payment_intent: pagoId, motivo }),
  });
  const filas = await sb(`/rest/v1/compras?stripe_payment_intent=eq.${encodeURIComponent(pagoId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ activa: false, motivo }),
  });
  return filas?.length ? `acceso retirado (${motivo})` : `${motivo} anotado (la compra aún no llega; entrará desactivada)`;
}

// aviso al celular (función "push"): se manda DESPUÉS de registrar la compra y nunca la afecta. Si falla o tarda,
// la venta y el acceso del cliente quedan igual (solo se anota en el log). "push" avisa cada venta una sola vez.
const PUSH_TOKEN = Deno.env.get("PUSH_TOKEN") ?? "";
function avisarPush(sesionId: string) {
  if (!PUSH_TOKEN || !sesionId) return;
  const tarea = fetch(`${URL_SB}/functions/v1/push`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-push-token": PUSH_TOKEN, Authorization: "Bearer " + SERVICIO },
    body: JSON.stringify({ tipo: "venta", sesion: sesionId }),
    signal: AbortSignal.timeout(8000),
  }).then((r) => r.text()).then((t) => console.log("aviso push", t.slice(0, 160))).catch((e) => console.error("aviso push falló", String(e)));
  // deja que el aviso termine aunque ya se haya respondido a Stripe
  try { (globalThis as any).EdgeRuntime?.waitUntil?.(tarea); } catch (_) { /* sin EdgeRuntime: igual corre */ }
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
      avisarPush(o.id);
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
