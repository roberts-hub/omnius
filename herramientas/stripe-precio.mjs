// SPECTRE · nuevo precio del Full System y códigos de descuento en Stripe.
// Uso: node herramientas/stripe-precio.mjs              → crea precio $98 / MX$1,799, link nuevo (copia la configuración
//                                                        del link actual) y los códigos WF100, WF80, WF69, WF20
//      node herramientas/stripe-precio.mjs desactivar   → desactiva el link viejo de $89 (cuando el sitio ya use el nuevo)
// Usa la llave restringida de privado/stripe-llave.txt (la pide y la guarda la primera vez). Permisos: Write en Products,
// Prices, Payment Links, Coupons y Promotion Codes; Read en Checkout Sessions. No puede mover dinero.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const ESTADO = join(RAIZ, "privado", "stripe-precio.json"); // ids creados (para no duplicar si se corre otra vez)
const LINK_VIEJO = "plink_1UQBuJFethND82y0dUdl1vfy"; // Full System $89
const PRECIO = { usd: 9800, mxn: 179900 };
const CODIGOS = [
  { codigo: "WF100", porcentaje: 100, usos: 1 },
  { codigo: "WF80", porcentaje: 80, usos: 2 },
  { codigo: "WF69", porcentaje: 69, usos: 1 },
  { codigo: "WF20", porcentaje: 20, usos: 18 }, // 8 originales + 5 + 5 (22 oct 2026: código recreado con 13 usos y luego con 18)
  { codigo: "WAITLIST50", porcentaje: 50, usos: 50 }, // 23 oct 2026: creado a mano, vale en el Full System y el LUT Pack
];
// EARLY-20: 20%, Full System y LUT Pack, sin límite de usos, solo 48 h (creado a mano el 26 oct 2026, vence el
// 28 oct 2026 19:53 hora de México; cupón O19NSVlo). Link: spectrecolor.com/get?codigo=EARLY-20 (js/main.js lo pone en el pago).

function preguntar(texto) {
  return new Promise((ok) => {
    process.stdout.write(texto);
    process.stdin.setRawMode?.(true);
    process.stdin.resume();
    let v = "";
    process.stdin.on("data", (d) => {
      for (const c of d.toString()) {
        if (c === "\r" || c === "\n") { process.stdin.setRawMode?.(false); process.stdin.pause(); process.stdout.write("\n"); return ok(v.replace(/\x1b\[[0-9;]*~/g, "").replace(/[^A-Za-z0-9_]/g, "")); }
        if (c === "\u0003") process.exit(130);
        v = c === "\u007f" ? v.slice(0, -1) : v + c;
      }
    });
  });
}

// form-encoding de Stripe para objetos y listas anidados
function plano(obj, prefijo = "", out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const clave = prefijo ? `${prefijo}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((x, i) => (typeof x === "object" ? plano(x, `${clave}[${i}]`, out) : out.append(`${clave}[${i}]`, String(x))));
    else if (typeof v === "object") plano(v, clave, out);
    else out.append(clave, String(v));
  }
  return out;
}

let LLAVE = "";
async function stripe(ruta, cuerpo, metodo) {
  const r = await fetch("https://api.stripe.com/v1" + ruta, {
    method: metodo || (cuerpo ? "POST" : "GET"),
    headers: { Authorization: "Bearer " + LLAVE, "Content-Type": "application/x-www-form-urlencoded" },
    body: cuerpo ? plano(cuerpo) : undefined,
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`${ruta}: ${j.error?.message || r.status}`);
  return j;
}

const estado = existsSync(ESTADO) ? JSON.parse(readFileSync(ESTADO, "utf8")) : {};
const guardar = () => writeFileSync(ESTADO, JSON.stringify(estado, null, 1), { mode: 0o600 });

// llave guardada en privado/stripe-llave.txt (restringida, no mueve dinero); si no existe, se pide y se guarda
const ARCHIVO_LLAVE = join(RAIZ, "privado", "stripe-llave.txt");
if (existsSync(ARCHIVO_LLAVE)) LLAVE = readFileSync(ARCHIVO_LLAVE, "utf8").trim();
else {
  LLAVE = await preguntar("Pega la llave restringida de Stripe (rk_live_…) y presiona Enter: ");
  LLAVE = LLAVE.replace(/.*((sk|rk)_live_)/, "$1"); // si se pegó dos veces, se queda con la última
  if (!/^rk_live_\w+$/.test(LLAVE)) { console.log("✗ Eso no parece una llave restringida live de Stripe (rk_live_…)."); process.exit(1); }
  writeFileSync(ARCHIVO_LLAVE, LLAVE + "\n", { mode: 0o600 });
  console.log("✓ Llave guardada en privado/stripe-llave.txt (solo en esta Mac; no se sube a GitHub)");
}

try {
  if (process.argv[2] === "desactivar") {
    await stripe(`/payment_links/${LINK_VIEJO}`, { active: false });
    console.log("✓ Link viejo de $89 desactivado");
    process.exit(0);
  }

  const viejo = await stripe(`/payment_links/${LINK_VIEJO}?expand[]=line_items`);
  const precioViejo = viejo.line_items.data[0].price;
  const producto = typeof precioViejo.product === "string" ? precioViejo.product : precioViejo.product.id;

  // 1. precio nuevo: $98 USD con opción MX$1,799
  if (!estado.precio) {
    const p = await stripe("/prices", {
      product: producto, currency: "usd", unit_amount: PRECIO.usd, tax_behavior: precioViejo.tax_behavior || undefined,
      currency_options: { mxn: { unit_amount: PRECIO.mxn, tax_behavior: precioViejo.tax_behavior || undefined } },
      nickname: "Full System $98",
    });
    estado.precio = p.id; guardar();
  }
  console.log("✓ Precio $98 USD / MX$1,799:", estado.precio);

  // 2. link nuevo con la misma configuración que el actual (términos, pregunta de novedades, factura, página final, códigos)
  if (!estado.link) {
    const copia = {
      line_items: [{ price: estado.precio, quantity: 1 }],
      allow_promotion_codes: true,
      after_completion: viejo.after_completion?.type === "hosted_confirmation"
        ? { type: "hosted_confirmation", hosted_confirmation: { custom_message: viejo.after_completion.hosted_confirmation?.custom_message || undefined } }
        : viejo.after_completion?.type === "redirect" ? { type: "redirect", redirect: { url: viejo.after_completion.redirect.url } } : undefined,
      billing_address_collection: viejo.billing_address_collection,
      consent_collection: viejo.consent_collection?.terms_of_service ? { terms_of_service: viejo.consent_collection.terms_of_service } : undefined,
      custom_fields: (viejo.custom_fields || []).map((f) => ({
        key: f.key, type: f.type, optional: f.optional,
        label: { type: f.label.type, custom: f.label.custom },
        dropdown: f.dropdown ? { options: f.dropdown.options.map((o) => ({ label: o.label, value: o.value })) } : undefined,
      })),
      custom_text: Object.fromEntries(Object.entries(viejo.custom_text || {}).filter(([, v]) => v?.message).map(([k, v]) => [k, { message: v.message }])),
      customer_creation: viejo.customer_creation,
      invoice_creation: viejo.invoice_creation?.enabled ? {
        enabled: true,
        invoice_data: {
          description: viejo.invoice_creation.invoice_data?.description || undefined,
          footer: viejo.invoice_creation.invoice_data?.footer || undefined,
        },
      } : undefined,
      name_collection: viejo.name_collection?.individual?.enabled ? { individual: { enabled: true, optional: viejo.name_collection.individual.optional } } : undefined,
      phone_number_collection: viejo.phone_number_collection?.enabled ? { enabled: true } : undefined,
      payment_method_types: viejo.payment_method_types || undefined,
      submit_type: viejo.submit_type && viejo.submit_type !== "auto" ? viejo.submit_type : undefined,
      metadata: { ...(viejo.metadata || {}), edicion: "full", precio: "98" },
    };
    if (!Object.keys(copia.custom_text).length) delete copia.custom_text;
    // si la versión de la API de la cuenta no conoce algún campo, se quita y se vuelve a intentar
    let l;
    for (let intento = 0; intento < 6 && !l; intento++) {
      try { l = await stripe("/payment_links", copia); }
      catch (e) {
        const campo = e.message.match(/unknown parameter: ([a-z_]+)/i)?.[1];
        if (!campo || !(campo in copia)) throw e;
        console.log(`  (se omite "${campo}": esta versión de la API no lo usa)`);
        delete copia[campo];
      }
    }
    estado.link = l.id; estado.url = l.url; guardar();
  }
  console.log("✓ Link nuevo:", estado.link, estado.url);

  // 3. códigos de descuento (solo para el Full System), con número máximo de usos
  estado.codigos = estado.codigos || {};
  for (const c of CODIGOS) {
    if (estado.codigos[c.codigo]) { console.log(`✓ ${c.codigo} ya existía`); continue; }
    // 22 oct 2026: los 4 códigos se recrearon a mano para valer en el Full System y el LUT Pack (ver privado/stripe-precio.json)
    const cupon = await stripe("/coupons", { percent_off: c.porcentaje, duration: "once", name: `${c.codigo} · ${c.porcentaje}% Full System`, applies_to: { products: [producto] } });
    let promo;
    try { promo = await stripe("/promotion_codes", { promotion: { type: "coupon", coupon: cupon.id }, code: c.codigo, max_redemptions: c.usos }); }
    catch (e) {
      if (!/unknown parameter|promotion/i.test(e.message)) throw e;
      promo = await stripe("/promotion_codes", { coupon: cupon.id, code: c.codigo, max_redemptions: c.usos }); // versiones anteriores de la API
    }
    estado.codigos[c.codigo] = { cupon: cupon.id, promo: promo.id }; guardar();
    console.log(`✓ ${c.codigo}: ${c.porcentaje}% de descuento, ${c.usos} uso(s)`);
  }
  console.log("\nListo. Avísale a Claude para que publique el sitio con el link nuevo y luego desactive el viejo.");
} catch (e) {
  console.log("✗ " + e.message);
  process.exit(1);
}
