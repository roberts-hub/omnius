# Cobrar SPECTRE — guía paso a paso

Situación: Roberto, persona física con actividad empresarial (RFC) en México, vendiendo un producto
digital en dólares a clientes de todo el mundo. El sitio ya está listo: solo falta pegar **dos links de pago**
(uno por edición) en `js/main.js` → `CHECKOUT_URLS`.

## Decisión: Stripe directo (Payment Links)

Roberto eligió Stripe directo el 2026-10-08: una sola cuenta, depósitos en MXN a su CLABE y entrega por el
área de miembros. Los pasos están abajo en "Stripe Payment Links". Lemon Squeezy queda como alternativa
(el sitio acepta sus links igual), por si algún día conviene que otro se encargue de los impuestos de otros países.

### Comparación (referencia)

| | Lemon Squeezy | Stripe directo (Payment Links) |
|---|---|---|
| Quién es el vendedor ante el cliente | Lemon Squeezy (*merchant of record*) | Tú |
| Impuestos de otros países (IVA de Europa, sales tax, GST…) | Los cobra y los paga Lemon Squeezy | Te tocan a ti |
| Comisión | 5% + 50¢ (puede sumar un extra en pagos internacionales) | 3.6% + $3 MXN, +0.5% tarjeta internacional, +2% conversión, + IVA sobre la comisión |
| En una venta de $89 | ≈ $4.45 – $5.60 USD | ≈ $5.00 – $5.80 USD |
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

## Alternativa — Lemon Squeezy

1. **Crear cuenta y tienda** en https://app.lemonsqueezy.com — nombre de tienda: `SPECTRE`, moneda USD.
2. **Activar la tienda** (Settings → General / Payouts):
   - verificación de identidad (INE o pasaporte);
   - datos fiscales: como persona física no estadounidense llenas el formulario **W-8BEN**;
   - pagos: **Bank payout** a tu cuenta mexicana (CLABE; puedes elegir recibir en MXN).
   - En la revisión describe el producto: "Digital color grading tools (LUTs and DaVinci Resolve PowerGrade) and video tutorials, delivered as downloads."
3. **Crear el producto** (Store → Products → New product): nombre `SPECTRE Color System`, con **dos variantes**:
   - `Full System` — $89 — sube el .zip (PowerGrade .drx + LUTs .cube + footage).
   - `LUTs Only` — $49 — sube el .zip (LUTs .cube).
4. **Nota del recibo / pantalla de gracias** (en el producto → *Confirmation modal* y *Email receipt*): pega
   el texto de abajo, cambiando `[CONTRASEÑA]` por la de `privado/clave.txt`.
5. **Copiar los links**: en cada variante → *Share* → *Checkout link* → activa **Checkout overlay**.
   El link se ve así: `https://spectre.lemonsqueezy.com/checkout/buy/XXXX?embed=1&media=0`
6. **Probar** con *Test mode* encendido y la tarjeta de prueba `4242 4242 4242 4242` (cualquier fecha futura y CVC).
7. Mándame los dos links (o pégalos en `js/main.js` → `CHECKOUT_URLS`), y apaga *Test mode* para vender.

### Texto para el recibo (Lemon Squeezy o Stripe)

> **Welcome to SPECTRE.**
> Your files are ready to download. Tutorials and downloads are always available in the members area:
> **https://spectrecolor.com/access**
> Password: **[CONTRASEÑA]**
> Please keep it private — it's part of your personal license (see the Terms).
> Questions? roberto@arechederra.com

---

## Stripe Payment Links (lo que se usa)

1. Cuenta en https://dashboard.stripe.com/register — tipo de negocio **Persona física con actividad empresarial**,
   RFC personal (13 caracteres) en el representante, dirección y teléfono en México, CLABE de tu banco.
2. Productos → crear `SPECTRE Full System` ($89 USD) y `SPECTRE LUT Pack` ($49 USD).
3. Para cada uno: **Payment Link** → *After payment* → **Show confirmation page** con el texto del recibo de arriba
   (así la contraseña solo la ve quien pagó). Activa los correos de recibo en Settings → Emails.
4. Copia los dos links (`https://buy.stripe.com/...`) y mándamelos.
5. Los Términos y la página de compra ya dicen Stripe. Tú eres el vendedor ante el cliente: IVA 16% en ventas
   a México (CFDI si lo piden), exportación al extranjero; revisa con tu contador.

---

## Área de miembros (spectrecolor.com/access)

- **Dos ediciones, dos contraseñas, dos bóvedas cifradas por separado.** La contraseña del LUT Pack solo abre
  el contenido de LUTs; la del Full System abre todo. Una no puede abrir la otra (ni leyendo el código).
- Contraseñas: `privado/clave-full.txt` y `privado/clave-luts.txt`. Contenido: `privado/miembros-full.json`
  y `privado/miembros-luts.json`. **La carpeta `privado/` nunca se sube a GitHub** (respáldala tú).
- Cada link de pago de Stripe muestra SU contraseña en la página de después del pago.
- Las contraseñas no deben seguir un patrón adivinable (si una es "unlockluts", alguien probaría "unlockspectre").
- Para cambiar videos, descargas o contraseñas: edita esos archivos y corre `node herramientas/miembros.mjs`
  → commit + push. Si cambias una contraseña, cámbiala también en el mensaje de su link de pago.
- Videos: YouTube **No listados**. Descargas: links de Drive/Dropbox. Pon en cada edición solo lo que le toca.
- Límite honesto: la contraseña de cada edición es compartida entre sus compradores; si alguien la filtra,
  se cambia en 1 minuto. El siguiente nivel (una clave única por compra) requiere un pequeño servidor.
