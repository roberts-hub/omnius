# Cobrar SPECTRE — guía paso a paso

Situación: Roberto, persona física con actividad empresarial (RFC) en México, vendiendo un producto
digital en dólares a clientes de todo el mundo. El sitio ya está listo: solo falta pegar **dos links de pago**
(uno por edición) en `js/main.js` → `CHECKOUT_URLS`.

## Recomendación: Lemon Squeezy (plan A) — Stripe Payment Links (plan B)

| | Lemon Squeezy | Stripe directo (Payment Links) |
|---|---|---|
| Quién es el vendedor ante el cliente | Lemon Squeezy (*merchant of record*) | Tú |
| Impuestos de otros países (IVA de Europa, sales tax, GST…) | Los cobra y los paga Lemon Squeezy | Te tocan a ti |
| Comisión | 5% + 50¢ (puede sumar un extra en pagos internacionales) | 3.6% + $3 MXN, +0.5% tarjeta internacional, +2% conversión, + IVA sobre la comisión |
| En una venta de $79 | ≈ $4.45 – $5.60 USD | ≈ $5.00 – $5.80 USD |
| Entrega de archivos y correo con la contraseña | Incluida (sube los archivos, nota en el recibo) | Solo mensaje en la página de confirmación |
| Te paga | En USD a tu banco mexicano (México está en su lista de pagos bancarios), 2 veces al mes | En MXN a tu CLABE |
| En el sitio | Se abre encima de la página | Va a la página de pago de Stripe |

Por qué Lemon Squeezy: cuesta casi lo mismo y te quita de encima los impuestos de cada país y la entrega.
Nota 2026: Lemon Squeezy (de Stripe) está migrando a "Stripe Managed Payments". Sigue funcionando; si
algún día piden migrar, solo se cambian los dos links. Si al registrarte no te dejan abrir la tienda,
usa el plan B: el código ya acepta links de Stripe.

Contabilidad: con Lemon Squeezy, tus ingresos son pagos de una empresa extranjera (exportación de servicios).
Pídele a tu contador cómo facturarlos (normalmente CFDI a residente en el extranjero, IVA 0%).

---

## Plan A — Lemon Squeezy

1. **Crear cuenta y tienda** en https://app.lemonsqueezy.com — nombre de tienda: `SPECTRE`, moneda USD.
2. **Activar la tienda** (Settings → General / Payouts):
   - verificación de identidad (INE o pasaporte);
   - datos fiscales: como persona física no estadounidense llenas el formulario **W-8BEN**;
   - pagos: **Bank payout** a tu cuenta mexicana (CLABE; puedes elegir recibir en MXN).
   - En la revisión describe el producto: "Digital color grading tools (LUTs and DaVinci Resolve PowerGrade) and video tutorials, delivered as downloads."
3. **Crear el producto** (Store → Products → New product): nombre `SPECTRE Color System`, con **dos variantes**:
   - `Full System` — $79 — sube el .zip (PowerGrade .drx + LUTs .cube + footage).
   - `LUTs Only` — $39 — sube el .zip (LUTs .cube).
4. **Nota del recibo / pantalla de gracias** (en el producto → *Confirmation modal* y *Email receipt*): pega
   el texto de abajo, cambiando `[CONTRASEÑA]` por la de `privado/clave.txt`.
5. **Copiar los links**: en cada variante → *Share* → *Checkout link* → activa **Checkout overlay**.
   El link se ve así: `https://spectre.lemonsqueezy.com/checkout/buy/XXXX?embed=1&media=0`
6. **Probar** con *Test mode* encendido y la tarjeta de prueba `4242 4242 4242 4242` (cualquier fecha futura y CVC).
7. Mándame los dos links (o pégalos en `js/main.js` → `CHECKOUT_URLS`), y apaga *Test mode* para vender.

### Texto para el recibo (Lemon Squeezy o Stripe)

> **Welcome to SPECTRE.**
> Your files are ready to download. Tutorials and downloads are always available in the members area:
> **https://roberts-hub.github.io/omnius/access.html**
> Password: **[CONTRASEÑA]**
> Please keep it private — it's part of your personal license (see the Terms).
> Questions? roberto@arechederra.com

---

## Plan B — Stripe Payment Links

1. Cuenta en https://dashboard.stripe.com/register — tipo de negocio **Persona física con actividad empresarial**,
   RFC personal (13 caracteres) en el representante, dirección y teléfono en México, CLABE de tu banco.
2. Productos → crear `SPECTRE Full System` ($79 USD) y `SPECTRE LUT Pack` ($39 USD).
3. Para cada uno: **Payment Link** → *After payment* → **Show confirmation page** con el texto del recibo de arriba
   (así la contraseña solo la ve quien pagó). Activa los correos de recibo en Settings → Emails.
4. Copia los dos links (`https://buy.stripe.com/...`) y mándamelos.
5. Avísame si usas Stripe: hay que cambiar en los Términos y en la página de compra "Lemon Squeezy" por "Stripe",
   y tú quedas como vendedor ante el cliente (impuestos de otros países: consúltalo con tu contador).

---

## Área de miembros (access.html)

- Contraseña: `privado/clave.txt`. Contenido (videos y descargas): `privado/miembros.json`.
  **La carpeta `privado/` nunca se sube a GitHub** (respáldala tú, p. ej. en tu Drive).
- Para cambiar videos, descargas o contraseña: edita esos archivos y corre
  `node herramientas/miembros.mjs` → commit + push.
- Videos: súbelos a YouTube como **No listados** y pega el link en `"youtube"`.
  Descargas: links de Google Drive/Dropbox ("cualquiera con el enlace") en `"url"`.
- Si cambias la contraseña, los dispositivos guardados vuelven a pedirla, y hay que actualizar el texto del recibo.
- Límite honesto: es una contraseña compartida. Si alguien la comparte, se cambia en 1 minuto; los links de
  YouTube no listados y de Drive también se pueden reenviar, como en cualquier curso.
