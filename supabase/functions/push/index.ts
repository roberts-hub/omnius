// SPECTRE · avisos en el celular (Web Push) para el panel spectrecolor.com/admin.
// POST {tipo:"venta", sesion}  → lo llama stripe-webhook (cabecera x-push-token). Avisa cada compra UNA vez.
// POST {tipo:"prueba"}         → lo llama el panel con la sesión de una cuenta en public.admins: manda un aviso de prueba.
// POST {tipo:"aviso", titulo, texto} → avisos de soporte desde las tareas de la Mac (cabecera x-push-token).
// Secretos: VAPID_PUBLICA, VAPID_PRIVADA (JWK), VAPID_SUJETO, PUSH_TOKEN. Se despliega con --no-verify-jwt.
import { enviar } from "./webpush.ts";

const URL_SB = Deno.env.get("SUPABASE_URL")!;
const SERVICIO = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const TOKEN = Deno.env.get("PUSH_TOKEN") ?? "";
const VAPID = {
  publica: Deno.env.get("VAPID_PUBLICA") ?? "",
  privada: JSON.parse(Deno.env.get("VAPID_PRIVADA") || "{}"),
  sujeto: Deno.env.get("VAPID_SUJETO") ?? "mailto:soporte@spectrecolor.com",
};
const ORIGEN = "https://spectrecolor.com";
const CORS = { "Access-Control-Allow-Origin": ORIGEN, "Access-Control-Allow-Headers": "authorization, content-type, apikey", "Access-Control-Allow-Methods": "POST, OPTIONS", Vary: "Origin" };
const responder = (estado: number, datos: unknown) => new Response(JSON.stringify(datos), { status: estado, headers: { ...CORS, "Content-Type": "application/json" } });

async function sb(ruta: string, opciones: RequestInit = {}) {
  const r = await fetch(URL_SB + ruta, { ...opciones, headers: { apikey: SERVICIO, Authorization: "Bearer " + SERVICIO, "Content-Type": "application/json", ...(opciones.headers || {}) } });
  const t = await r.text();
  if (!r.ok) throw new Error(`${ruta} ${r.status} ${t.slice(0, 160)}`);
  return t ? JSON.parse(t) : null;
}
const igual = (a: string, b: string) => { if (!a || a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };

// manda a todos los celulares registrados; quita los que ya no existen (404/410)
async function repartir(datos: unknown) {
  const subs: any[] = (await sb("/rest/v1/push_subs?select=endpoint,p256dh,auth,fallas")) || [];
  let entregados = 0;
  await Promise.all(subs.map(async (s) => {
    try {
      const r = await enviar(s, datos, VAPID);
      const filtro = `/rest/v1/push_subs?endpoint=eq.${encodeURIComponent(s.endpoint)}`;
      if (r.estado === 404 || r.estado === 410) await sb(filtro, { method: "DELETE" });
      else if (r.estado >= 200 && r.estado < 300) { entregados++; await sb(filtro, { method: "PATCH", body: JSON.stringify({ ultimo_envio: new Date().toISOString(), fallas: 0 }) }); }
      else { console.error("aviso rechazado", r.estado, r.texto); await sb(filtro, { method: "PATCH", body: JSON.stringify({ fallas: (s.fallas || 0) + 1 }) }); }
    } catch (e) { console.error("aviso falló", String(e)); }
  }));
  return { celulares: subs.length, entregados };
}

const CANALES: Record<string, string> = { ig: "Instagram", yt: "YouTube", fb: "Facebook", tt: "TikTok", wa: "WhatsApp", youtube: "YouTube", instagram: "Instagram", tiktok: "TikTok", whatsapp: "WhatsApp", facebook: "Facebook", google: "Google", x: "X", linkedin: "LinkedIn", pinterest: "Pinterest", reddit: "Reddit", telegram: "Telegram", buscador: "Buscador", correo: "Correo", twowaves: "Two Waves", "otro-sitio": "Otro sitio" };
const bandera = (c: string) => (/^[A-Z]{2}$/.test(c) ? String.fromCodePoint(...[...c].map((l) => 0x1f1a5 + l.charCodeAt(0))) : "");
let nombres: Intl.DisplayNames | null = null;
try { nombres = new Intl.DisplayNames(["es"], { type: "region" }); } catch (_) { nombres = null; }
const pais = (c: string) => { try { return (nombres && /^[A-Z]{2}$/.test(c) && nombres.of(c)) || c; } catch (_) { return c; } };
const dinero = (n: number, m: string) => (n === 0 ? "$0 (código 100%)" : "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " " + m);

async function avisoDeVenta(sesion: string) {
  if (!/^cs_[A-Za-z0-9_]{6,200}$/.test(sesion)) return { resultado: "sesión no válida" };
  const c = ((await sb(`/rest/v1/compras?stripe_session=eq.${encodeURIComponent(sesion)}&select=monto,moneda,edicion,motivo,pais,origen,creada&limit=1`)) || [])[0];
  if (!c) return { resultado: "sin compra registrada" };
  if (["prueba", "prueba-ui", "manual"].includes(c.motivo || "")) return { resultado: "compra de prueba: sin aviso" };
  // una sola vez por venta (Stripe puede repetir el evento)
  const nueva = await sb("/rest/v1/push_enviados?on_conflict=stripe_session", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=representation" }, body: JSON.stringify({ stripe_session: sesion }) });
  if (!nueva?.length) return { resultado: "ya avisada" };
  const producto = c.motivo === "upgrade desde LUT Pack" ? "Upgrade a Full System" : c.edicion === "full" ? "Full System" : "LUT Pack";
  const moneda = String(c.moneda || "").toUpperCase();
  const partes = String(c.origen || "").split("_").filter((x: string) => x && x !== "auto");
  const canal = partes.length ? CANALES[partes[0]] || partes[0] : "Directo";
  const p = String(c.pais || "");
  // ventas de hoy (hora de México), sin pruebas
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
  const desde = new Date(Date.parse(hoy + "T00:00:00-06:00")).toISOString();
  const deHoy: any[] = (await sb(`/rest/v1/compras?creada=gte.${encodeURIComponent(desde)}&activa=is.true&select=motivo`)) || [];
  const n = deHoy.filter((x) => !["prueba", "prueba-ui", "manual"].includes(x.motivo || "")).length;
  const datos = {
    title: `Nueva venta · ${dinero(Number(c.monto) || 0, moneda)}`,
    body: [producto, p ? `${bandera(p)} ${pais(p)}`.trim() : "", canal].filter(Boolean).join(" · ") + (n > 1 ? `\nHoy van ${n} ventas` : ""),
    url: "/admin",
    tag: "venta-" + sesion.slice(-12),
  };
  return { resultado: "avisada", ...(await repartir(datos)) };
}

async function esAdmin(req: Request) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return false;
  const r = await fetch(`${URL_SB}/rest/v1/rpc/es_admin`, { method: "POST", headers: { apikey: ANON, Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: "{}" });
  return r.ok && (await r.json()) === true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return responder(405, { error: "solo POST" });
  if (!VAPID.publica || !VAPID.privada?.d) return responder(500, { error: "faltan llaves VAPID" });
  let cuerpo: any = {};
  try { cuerpo = await req.json(); } catch (_) { return responder(400, { error: "JSON no válido" }); }
  try {
    if (cuerpo.tipo === "venta") {
      if (!igual(req.headers.get("x-push-token") || "", TOKEN)) return responder(401, { error: "sin permiso" });
      const r = await avisoDeVenta(String(cuerpo.sesion || ""));
      console.log("venta", cuerpo.sesion, JSON.stringify(r));
      return responder(200, r);
    }
    // aviso libre (soporte, seguimientos): lo mandan las tareas de la Mac con el mismo x-push-token
    if (cuerpo.tipo === "aviso") {
      if (!igual(req.headers.get("x-push-token") || "", TOKEN)) return responder(401, { error: "sin permiso" });
      const titulo = String(cuerpo.titulo || "SPECTRE").slice(0, 80), texto = String(cuerpo.texto || "").slice(0, 240);
      const r = await repartir({ title: titulo, body: texto, url: "/admin", tag: "aviso-" + Date.now() });
      return responder(200, { resultado: "aviso enviado", ...r });
    }
    if (cuerpo.tipo === "prueba") {
      if (!(await esAdmin(req))) return responder(401, { error: "sin permiso" });
      const r = await repartir({ title: "Nueva venta · $98.00 USD", body: "Así te llegará cada venta.\nFull System · 🇲🇽 México · YouTube", url: "/admin", tag: "prueba" });
      return responder(200, { resultado: "prueba enviada", ...r });
    }
    return responder(400, { error: "tipo desconocido" });
  } catch (e) {
    console.error(String(e));
    return responder(500, { error: "error" });
  }
});
