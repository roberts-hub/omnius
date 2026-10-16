# SPECTRE: el proyecto completo

Documento de contexto total: qué se vende, cómo está hecho el sitio, cómo funciona la compra en Stripe,
cómo se entrega el producto, cómo se hacen reembolsos y cómo se mantiene todo. Pensado para que otra
persona o IA pueda modificar el proyecto sin romper nada.

> **Este archivo no contiene contraseñas ni llaves.** Solo dice dónde viven (carpeta `privado/`, que nunca
> se sube a GitHub). Si necesitas una contraseña, pídesela a Roberto.

Fecha de este documento: 13 de octubre de 2026 (actualizado el 16 de octubre) (el sitio está en beta, a punto de lanzarse; aún no hay
compradores reales, solo compras de prueba de Roberto).


> **ACTUALIZACIÓN 13 oct 2026 — CUENTAS POR COMPRADOR (manda sobre lo que diga abajo):**
> Ya no hay contraseña compartida ni correo de Apps Script con contraseña. Flujo actual:
> 1. Cliente paga en un Stripe Payment Link (acepta términos). Stripe muestra "Payment complete! Check your email…".
> 2. Stripe avisa por webhook firmado a Supabase (`supabase/functions/stripe-webhook`): crea la cuenta (invitación) y la compra
>    (`compras`). Si ya tenía cuenta y nunca entró, le reenvía el link. Reembolso/contracargo → compra inactiva.
> 3. Supabase manda (SMTP de Gmail con la cuenta roberto@arechederra.com, remitente support@spectrecolor.com) "Your SPECTRE access: create your password" (negro/blanco);
>    el botón lleva a spectrecolor.com/access#token_hash=… y la página canjea el token.
> 4. El cliente entra con correo + contraseña. El contenido (videos + llaves de las descargas cifradas) solo lo entrega la
>    función `abrir_area()`, que registra cada entrada (IP/dispositivo) en `accesos`; 🚩 >10 entradas o ≥3 IPs en 24 h;
>    bloqueo automático >30 o ≥6 IPs (`supabase/migrations/0002_accesos.sql`).
> 5. Stripe además manda recibo + factura PDF (soporte: dirección de Two Waves Films, sin teléfono).
> Administración: `node herramientas/supabase.mjs cuentas | accesos | bloquear | desbloquear | dar | quitar | reenviar | contenido | plantillas`;
> panel en Supabase → proyecto spectre → Table Editor → panel_cuentas. Pruebas: `node herramientas/prueba-seguridad.mjs` (63).
> Vigilancia: Apps Script "SPECTRE correo de compra" revisa cada 5 min (correo 🔴/🟢), mantiene vivo Supabase y manda
> alertas diarias de cuentas sospechosas; Claude hace una revisión diaria a las 9:30 (tarea programada).
> Contenido de miembros: editar privado/miembros-*.json → `node herramientas/miembros.mjs` → `node herramientas/supabase.mjs contenido` → publicar descargas/.

> **ACTUALIZACIÓN 14-16 oct 2026 (manda sobre lo que diga abajo):**
> - **Correo público: support@spectrecolor.com** (alias de roberto@arechederra.com en Google Workspace; Gmail "Enviar como"
>   SPECTRE Support). Lo usan el sitio, términos, área de miembros, READ ME y PDF de términos de los ZIPs, Stripe (soporte y
>   texto de factura) y Supabase (remitente). DNS de spectrecolor.com (Squarespace): MX smtp.google.com, SPF, DKIM
>   `google._domainkey` activo, DMARC p=none. Cambiar el remitente de Supabase: `node herramientas/supabase.mjs remitente`.
> - **Respaldos:** Apps Script `respaldar()` cada día 3 am → Google Drive de roberto@ carpeta "SPECTRE respaldos" (hoja
>   "SPECTRE · Respaldo de clientes" + `respaldo-AAAA-MM-DD.json`, últimos 90; datos de la función `resumen?respaldo=1`).
>   En la Mac: `node herramientas/supabase.mjs respaldo` (lo corre la revisión diaria) → `privado/respaldos/`.
>   **Respaldo completo cifrado** (sitio + privado/ + base de datos + configuración + DNS + guía): `bash herramientas/respaldo-completo.sh`
>   → `~/Desktop/SPECTRE-respaldo-AAAA-MM-DD.dmg` (pide contraseña; adentro `RESTAURAR.md`). Subirlo a Drive y al NAS. Hacerlo
>   después de cambios grandes o cada mes.
> - **Tablero "SPECTRE Métricas"** (artifact privado, https://claude.ai/artifact/HqEd1R82Ey5iTfdkq6qsBp): pestañas Métricas y
>   Usuarios (cuentas, entradas, descargas por pack, alertas, ventas acumuladas). Datos: `node herramientas/metricas.mjs`
>   (usuarios.json lleva correos). Lo actualiza la revisión diaria de Claude.
> - **Stripe:** no hay llaves de API guardadas (la de solo lectura de Apps Script ya no existe). Para `stripe-correo.sh` se crea una
>   llave restringida temporal (Payment Links: Write) y se borra después.
> - **GitHub Pages** a veces tarda más de 10 min en publicar (el sitio pesa ~500 MB) y cancela; se reintenta con
>   `gh api -X POST repos/roberts-hub/omnius/pages/builds`.

---

## Índice

1. El negocio
2. Qué se vende (contenido exacto de cada edición)
3. Infraestructura (dominio, hosting, cuentas)
4. El sitio web, página por página
5. Estructura de archivos del repositorio
6. El flujo de compra completo, paso a paso
7. Stripe en detalle
8. La entrega: página de confirmación, factura y correo automático
9. El área de miembros y las descargas cifradas
10. Contraseñas: dónde viven y cómo se cambian
11. Reembolsos y política de devoluciones
12. Idiomas (inglés / español)
13. Cómo publicar cambios
14. Herramientas internas
15. Diseño y reglas de marca
16. Seguridad
17. Pendientes y decisiones abiertas
18. Recetas rápidas (cómo hacer X)

---

## 1. El negocio

- **Marca:** SPECTRE (antes se llamaba OMNIUS; por eso el repo y la carpeta local se llaman `omnius`).
- **Dueño:** Roberto Arechederra (Luis Roberto Arechederra Mora), colorista y filmmaker en Guadalajara,
  México. Instagram @robert.arre. Vende como persona física con actividad empresarial (RFC en México).
- **Qué es:** un sistema de corrección de color para video. LUTs, un PowerGrade para DaVinci Resolve,
  guías, una masterclass y material de práctica.
- **A quién se vende:** filmmakers y creadores de contenido de todo el mundo. El sitio está en inglés
  (idioma principal) y en español.
- **Agencia relacionada:** Two Waves (twowaves.mx), la productora de Roberto. El pie del sitio dice
  "Made by Two Waves". Las marcas del carrusel (Audi, Cupra, Lamborghini…) son clientes de su trabajo.
- **Contacto público:** support@spectrecolor.com (alias de roberto@arechederra.com en Google Workspace; llega a ese mismo Gmail y se puede responder como support@ desde "Enviar como").

---

## 2. Qué se vende

Dos ediciones. Son **archivos digitales** que se entregan como ZIP descargable desde el área de miembros,
más videos (YouTube no listados) que se ven dentro del área.

### 2.1 SPECTRE Full System: $89 USD (o MX$1,634)
Para quien edita en **DaVinci Resolve** (Free o Studio). Precio tachado de referencia: $119.

**Descarga 1: `SPECTRE Full System.zip` (~52 MB, 29 archivos)**
```
SPECTRE Full System/
├── READ ME.txt                          (instrucciones; saltos de línea CRLF para que se lea bien en Windows)
├── SPECTRE LUTs/                        (LUTs de 65 puntos, máxima calidad)
│   ├── SPECTRE LUT .cube                ← LUT "firma", para material en Rec.709
│   └── SPECTRE One Click/               ← un clic: convierten de Log al look final
│       ├── SONY S-LOG3.cube
│       ├── DJI D-LOG.cube
│       ├── CANON C-LOG.cube
│       ├── RED-KOMODO.cube
│       └── REC.709.cube
├── SPECTRE LUTs 33/                     (las mismas LUTs en 33 puntos, para editores/apps que no aceptan 65)
│   ├── SPECTRE LUT 33.cube
│   └── SPECTRE One Click/ (… 33.cube de cada cámara)
├── SPECTRE POWER GRADE/                 (PowerGrades de DaVinci Resolve: el árbol de nodos completo)
│   ├── SONY S-LOG3.drx
│   ├── DJI D-LOG.drx
│   ├── CANON C-LOG.drx
│   ├── RED-LOG.drx
│   └── REC.709.drx
└── Guides/                              (PDF 16:9)
    ├── DaVinci Installation.pdf         (cómo importar el PowerGrade)
    ├── LUT Installation.pdf             (cómo instalar LUTs; incluye link al área y contraseña)
    ├── Color Settings.pdf               (DaVinci YRGB, DaVinci WG/Intermediate, salida Rec.709-A)
    └── Terms & License.pdf
```

**Descarga 2: `SPECTRE Log Practice Footage.zip` (~448 MB, se sirve en partes de 45 MB)**
6 clips en Log para practicar: Sony S-Log3 (01–04, incluido uno anamórfico) y DJI D-Log (05 vertical, 06).
Incluye `Compatible versions (H.264)/` con copias H.264 de los clips DJI para computadoras que no leen el
original. Se guardan sin compresión dentro del ZIP. Uso solo para practicar (ver Términos §6).

**Videos en el área de miembros (en español):**
- Start here → *Introduction to SPECTRE* y *Setting up SPECTRE in DaVinci Resolve*.
- The masterclass → *The SPECTRE masterclass* (unos 50 min; el sitio dice "50-minute masterclass").

### 2.2 SPECTRE LUT Pack: $49 USD (o MX$899)
Para quien **no usa DaVinci Resolve** (Premiere Pro, Final Cut Pro, CapCut, etc.). En la página de compra
aparece como **"LUTs Only"**. Precio tachado: $59.

**Descarga: `SPECTRE LUT Pack.zip` (~50 MB, 22 archivos)**
Igual que el Full System, pero **sin** `SPECTRE POWER GRADE/` y sin la guía de DaVinci:
LUTs 65 y 33 puntos (firma + One Click por cámara), READ ME, guías LUT Installation, Color Settings y Terms.

**Videos:** Introduction, Setting up in DaVinci Resolve y *How to install and use the SPECTRE LUTs*
(este último aún sin video; aparece como "coming soon").
Tiene además un bloque **"Upgrade to Full System"** que lleva a `/get`.

### 2.3 Cámaras soportadas
Sony S-Log3, DJI D-Log, Canon C-Log, RED y Rec.709 (para material grabado sin perfil Log). Se adapta a
cualquier cámara. Las One Click LUTs son para clips en Log; la "SPECTRE LUT" es para clips en Rec.709.

### 2.4 Licencia (resumen de /terms)
Licencia personal para **una persona**, proyectos ilimitados personales y comerciales, incluido trabajo
para clientes. Prohibido revender, compartir, subir, recrear los looks o usarlos para entrenar IA.
Estudios y equipos: una licencia por usuario. Ley aplicable: México (Ley Federal del Derecho de Autor).

---

## 3. Infraestructura

| Pieza | Dónde | Notas |
|---|---|---|
| Dominio | **spectrecolor.com**, comprado en Squarespace Domains (vence oct 2028) | DNS en Squarespace: 4 registros A a GitHub Pages + CNAME `www` → roberts-hub.github.io. Hay un TXT de verificación de Google Search Console: **no borrarlo** |
| Hosting | **GitHub Pages**, repo `roberts-hub/omnius` (**público**), rama `main` | HTTPS obligatorio. Archivo `CNAME` en el repo. Publica en ~1 min tras un push |
| Pagos | **Stripe** (cuenta México, `acct_1UNeFXFethND82y0`) | Payment Links. Depósitos en MXN a la cuenta bancaria de Roberto |
| Correo de compra | **Google Apps Script** en la cuenta roberto@arechederra.com | Proyecto "SPECTRE correo de compra" |
| Correo del dominio arechederra.com | Google Workspace | SPF y DKIM configurados; **DMARC no** (pendiente opcional) |
| Videos de miembros | YouTube (no listados) | Se incrustan con youtube-nocookie |
| Analítica | Umami Cloud (`cloud.umami.is`) | Visitas, clics de compra, edición elegida, cambio de idioma |
| SEO | Google Search Console (verificado por DNS), sitemap.xml, JSON-LD, hreflang | |

No hay servidor propio ni base de datos. Todo lo dinámico lo hacen Stripe, Apps Script y el navegador.

---

## 4. El sitio web, página por página

### 4.1 `/` Inicio (`index.html`)
En orden:
1. **Intro (loader):** frase palabra por palabra + iconos, solo en la primera visita de la sesión; un clic
   o una tecla la adelanta.
2. **Hero con video** a pantalla completa (`video/hero-*.mp4`): logo SPECTRE, "COLOR SYSTEM // BY ROBERTO
   ARECHEDERRA" y botón **GET SPECTRE** → `/get`. Video horizontal 1080p en computadora y vertical en
   celular; en HEVC con respaldo H.264. Si la conexión es lenta (o a los 4 s no puede reproducir) cambia a
   la versión "lite" de 720p. El video **no se oscurece** (velo mínimo) y **no tiene zoom** (se quitó el
   zoom lento el 13 oct porque se veía muy cerrado).
3. **"Achieve cinematic consistency"** + banda de imágenes (introducing).
4. **Marcas** ("The color behind our work for"): carrusel de logos de clientes.
5. **La masterclass:** captura del árbol de nodos, "Learn my exact grading process", video de muestra,
   botón al Full System.
6. **Looks: "Graded with SPECTRE."**: rejilla de 8 comparadores arrastrables, de Rec.709 al look final
   (`img/looks/NN-antes/despues`). Se muestran 6 en computadora y 4 en celular, con botón "SEE ALL 8 LOOKS".
7. **Reseñas** ("What creators say"): carrusel con scroll-snap que avanza solo cada 3 s. Son reseñas
   reales (no inventar).
8. **FAQ.**
9. **Cierre:** "YOU WERE CREATED TO CREATE.", links (@robert.arre, contacto, términos, acceso a productos),
   "Made by Two Waves".

### 4.2 `/get` Página de compra (`get.html`)
- Caja 3D del producto, nombre, precio con precio tachado ("LAUNCH PRICE · SAVE $X").
- **Selector de edición** (radios): Full System (badge "BEST VALUE") / LUTs Only.
  `?edition=luts` en la URL lo deja preseleccionado.
- Botón morado **"Buy securely with Stripe"** → Payment Link de la edición elegida.
- Sección de la masterclass, tabla comparativa de ediciones, línea de ahorro, prueba social,
  FAQ "Before you buy" (qué edición elegir, si se necesita Resolve Studio, cámaras, cómo se reciben los
  archivos, uso con clientes).

### 4.3 `/access` Área de miembros (`access.html`)
Campo de contraseña + "Remember this device" + UNLOCK. Al abrir: bienvenida, videos, descargas, términos.
Detalle en §9.

### 4.4 `/terms` Términos y licencia (`terms.html`)
Precios, reembolsos, licencia, prohibiciones, material de práctica, propiedad intelectual, incumplimiento.
También en PDF: `legal/SPECTRE-Terms-and-License.pdf`.

### 4.5 Otras
- `/es/` y `/es/get`: versión en español (generada, ver §12).
- `404.html`. `producto.html` es solo una redirección vieja a `/get`.
- Menú (todas las páginas de venta): logo a la izquierda; a la derecha **EN / ES** · icono de persona
  (→ `/access`) · enlace principal (GET SPECTRE en inicio, ← SEE THE LOOKS en compra).
- Al compartir el link (WhatsApp, redes) se ve `img/og-spectre-logo.jpg`: logo SPECTRE sobre negro.

---

## 5. Estructura de archivos

```
omnius/
├── index.html, get.html, access.html, terms.html, 404.html, producto.html
├── es/index.html, es/get.html          ← GENERADOS por herramientas/es/generar.py (no editar a mano)
├── css/estilo.css                      ← todos los estilos
├── js/main.js                          ← sitio: intro, links de pago, edición, carruseles, comparadores, idioma
├── js/miembros.js                      ← área de miembros: descifrado, videos, descargas, términos
├── sw.js                               ← service worker (páginas red-primero; archivos caché; nunca .mp4/.bin/Stripe)
├── video/                              ← hero (1080 HEVC/H.264, vertical, lite) y clase
├── img/                                ← looks, logos, reseñas, marca, OG
├── descargas/*.bin + manifest.json     ← ZIPs CIFRADOS (seguros de publicar) + lista pública de partes
├── legal/SPECTRE-Terms-and-License.pdf
├── docs/guias/                         ← generador de las guías PDF (generar.py, davinci.py, licencia.py)
├── herramientas/                       ← scripts (ver §14)
├── PAGOS.md                            ← historia de la decisión Stripe vs Lemon Squeezy
├── sitemap.xml, robots.txt, site.webmanifest, favicon.ico, CNAME
└── privado/                            ← NUNCA en GitHub (.gitignore)
    ├── clave-full.txt, clave-luts.txt  ← contraseñas del área de miembros
    ├── miembros-full.json, miembros-luts.json   ← contenido de cada bóveda (videos, descargas, textos)
    ├── paquetes/*.zip                  ← ZIPs originales del producto
    ├── practica/                       ← clips de práctica y su ZIP
    ├── descargas.json                  ← llaves de cifrado de cada ZIP (caché)
    └── correo-compra/Code.gs           ← copia del código de Apps Script (incluye contraseñas)
```

---

## 6. El flujo de compra completo

```
 1. Cliente llega a spectrecolor.com (inglés por default)
 2. GET SPECTRE ──► /get
 3. Elige edición (Full System $89 / LUTs Only $49)
 4. "Buy securely with Stripe" ──► Stripe Payment Link (checkout alojado por Stripe)
 5. Paga
      · Tarjeta extranjera → USD
      · Tarjeta mexicana o Amex → Stripe le ofrece/cobra en MXN (Adaptive Pricing + precio en MXN)
      · Apple Pay / Google Pay disponibles
 6. Stripe muestra "Payment complete!" con:
      "Access your files at spectrecolor.com/access with your password: ______. We have also sent
       your access details to your email."
 7. Stripe manda por correo el RECIBO, con la FACTURA PDF adjunta (la factura trae link, contraseña y pasos)
 8. ~1 minuto después, Apps Script manda el CORREO SPECTRE (inglés, fondo negro):
      botón "ACCESS YOUR FILES", link, contraseña en grande, 3 pasos y resumen de la orden.
      Copia oculta a roberto@arechederra.com.
 9. El cliente entra a /access, escribe la contraseña de su edición
10. Ve los videos, acepta Términos y Licencia, descarga sus ZIPs (se descifran en su navegador)
```

Cualquiera de las tres vías (página de Stripe, factura, correo SPECTRE) basta para entrar. Si cierra la
página de Stripe, le quedan los dos correos.

---

## 7. Stripe en detalle

### 7.1 Cuenta
- Cuenta de México: `acct_1UNeFXFethND82y0` (Luis Roberto Arechederra Mora). Modo **live**.
- **Restricción importante:** Stripe México solo puede cobrar tarjetas mexicanas y American Express en
  **MXN**. Por eso cada precio es **USD con opción en MXN**: así una tarjeta mexicana no da el error
  "Your card doesn't support this currency".
- Amex para compradores de EE. UU. en USD no está disponible con la cuenta mexicana. Se decidió mantener
  USD como moneda base.
- Correos al cliente activados en Stripe: **Successful payments** (recibo) y **Refunds**.

### 7.2 Productos, precios y links
| Edición | Producto | Precio | Payment Link (activo) |
|---|---|---|---|
| Full System | `prod_VPL9cIENGM37gN` | $89 USD / MX$1,634 | https://buy.stripe.com/7sY7sL3Cd81u6VCgiM1kA05 (`plink_1UQBuJFethND82y0dUdl1vfy`) |
| LUT Pack | `prod_VPL9Jv3AnWPJ6s` | $49 USD / MX$899 | https://buy.stripe.com/5kQ5kD0q181u7ZG0jO1kA04 (`plink_1UQBswFethND82y0hTuKybiY`) |

- Los links del sitio están en `js/main.js` → `CHECKOUT_URLS = { completo: …, luts: … }`.
- **Desactivados** (no reactivar): link de prueba $1/MX$10 (`plink_1UQC5u…`), link de prueba solo MXN
  (`plink_1UQCTP…`) y los links viejos del 8 oct solo en USD (`plink_1UOWmq…`, `plink_1UOWeU…`, `plink_1UOWS…`).
- Productos `prod_VPKm…` son duplicados viejos.
- ⚠️ **Archivar un producto en Stripe desactiva sus links.** Ya pasó una vez. No archivar los reales.
- En un precio de Stripe no se puede cambiar el monto: se crea un precio nuevo. Cambiar el precio de un
  link implica crear el precio nuevo (con su opción MXN) y un link nuevo, y luego actualizar `CHECKOUT_URLS`.

### 7.3 Configuración de cada link (la pone `herramientas/stripe-correo.sh` por API)
- `after_completion[type] = hosted_confirmation` + `custom_message` con link y contraseña.
  (El mensaje de Stripe no admite saltos de línea ni negritas.)
- `invoice_creation[enabled] = true` + `invoice_data.description` (gracias, link, contraseña, pasos) +
  `footer` ("SPECTRE · spectrecolor.com · Terms & License: spectrecolor.com/terms").
  La factura cuesta 0.4% por transacción (tope $2). Roberto decidió conservarla.
- Pregunta opcional en el checkout ("keep me posted"): consentimiento de email marketing.
- El script pide una **llave restringida** con un solo permiso (**Payment Links: Write**), la limpia de
  caracteres invisibles al pegar y lee las contraseñas de `privado/`. La llave se borra al terminar.

### 7.4 Llaves de API vigentes
- Ninguna (desde el 14 oct 2026). Apps Script ya no lee Stripe; las compras llegan por webhook a Supabase.
- Cualquier llave temporal (por ejemplo para correr stripe-correo.sh) se crea con el mínimo permiso y se
  borra después.
- Stripe Shell del dashboard es solo lectura en modo live.

### 7.5 Comisiones (aprox.)
3.6% + $3 MXN, +0.5% tarjeta internacional, +2% conversión de moneda, + IVA sobre la comisión,
+0.4% de factura. En una venta de $89 quedan ~$5–6 USD de comisiones.

---

## 8. La entrega: tres vías

### 8.1 Página "Payment complete!" de Stripe
Mensaje de una línea con link y contraseña (ver §7.3). Se ve justo al pagar.

### 8.2 Recibo + factura de Stripe
Llega del correo de Stripe con dos PDF: **Receipt** (comprobante de pago) e **Invoice** (factura, que
trae el texto con link, contraseña y pasos). Stripe no permite personalizar el cuerpo del correo, por eso
existe el correo propio.

### 8.3 Correo SPECTRE (Google Apps Script)
- **Proyecto:** "SPECTRE correo de compra" en script.google.com, cuenta roberto@arechederra.com.
  Copia local del código: `privado/correo-compra/Code.gs`.
- **Cómo funciona:**
  1. Un activador de tiempo ejecuta `revisarCompras()` **cada minuto**.
  2. Llama a `GET https://api.stripe.com/v1/checkout/sessions?status=complete&created[gte]=…&expand[]=data.line_items`
     con la llave de la propiedad del script `STRIPE_KEY` (solo lectura).
  3. Para cada sesión pagada que no esté en `enviados`, detecta la edición por el nombre del producto
     ("Full System" / "LUT Pack"), toma el correo y el nombre del cliente.
  4. Manda con `GmailApp.sendEmail` un correo HTML (y versión texto):
     - Remitente: **"Roberto from SPECTRE"** <roberto@arechederra.com>; responder llega a Roberto.
     - Asunto: "Your SPECTRE LUT Pack access" / "Your SPECTRE Full System access".
     - **Siempre en inglés** (decisión de Roberto).
     - Diseño: fondo negro `#0b0b0a`, texto hueso, logo como **texto** (si fuera imagen, en spam se vería
       el icono de foto roto), "PAYMENT CONFIRMED", "Thank you for your purchase, {nombre}.", recuadro con
       link y contraseña, botón "ACCESS YOUR FILES →", pasos 01–03, resumen de la orden (número, fecha,
       producto, total), ayuda y links a sitio y términos.
     - BCC a roberto@arechederra.com.
  5. Guarda los IDs enviados (últimos 300) y la marca de tiempo en Propiedades del script.
     Revisa con 1 h de traslape, y la lista evita duplicados.
- **Funciones:** `revisarCompras()` (la del activador), `instalar()` (crea el activador cada minuto; correr
  una sola vez), `probar()` (manda 2 muestras a roberto@), `probarOtros()` (muestras a otras cuentas).
- **Entregabilidad:** probado, llega a la bandeja principal en Gmail y en twowaves.mx. SPF y DKIM ok;
  DMARC pendiente (opcional).
- **Para modificar el correo:** editar `privado/correo-compra/Code.gs`, abrir el proyecto en
  script.google.com, seleccionar todo, pegar y guardar. Copiar al portapapeles con
  `LC_ALL=en_US.UTF-8 pbcopy < Code.gs` (sin el `LC_ALL` los acentos se pegan mal).
- Cuota de Gmail en Workspace: unos 1,500 correos al día. Si el volumen crece mucho, migrar a un
  servicio como Resend o Postmark desde una dirección de spectrecolor.com.

---

## 9. Área de miembros y descargas cifradas

### 9.1 Idea
El sitio es estático y público, así que el contenido de pago se publica **cifrado**. Solo quien tiene la
contraseña lo puede descifrar, y lo hace en su propio navegador.

### 9.2 Bóvedas
- En `access.html` hay un bloque `<script type="application/json" id="contenido-cifrado">` con **dos
  bóvedas**, una por edición, en orden aleatorio (no se sabe cuál es cuál).
- Cada bóveda: `{ v, iter: 600000, sal, iv, datos }`. Cifrado **AES-GCM 256**, llave derivada con
  **PBKDF2-SHA256, 600,000 iteraciones**.
- La contraseña se pasa a **MAYÚSCULAS** antes de derivar, así que no distingue mayúsculas.
- La contraseña del LUT Pack no abre el Full System, ni al revés.
- Al descifrar sale el JSON de `privado/miembros-{edicion}.json`: textos, secciones de videos (links de
  YouTube), descargas y, en el LUT Pack, el bloque de mejora.

### 9.3 Descargas
- Cada ZIP de `privado/` se cifra con una **llave aleatoria propia** (AES-GCM) y se publica en
  `descargas/<id-aleatorio>.bin`. Si pasa de 45 MB se parte (GitHub no acepta archivos de más de 100 MB).
- La llave y el iv de cada archivo viajan **solo dentro de la bóveda** de su edición.
- El navegador baja las partes en orden, con barra de progreso, las descifra, las une y guarda el ZIP.
  Funciona en Mac y Windows.
- `descargas/manifest.json` (público) lista las partes y su tamaño, para el monitor. No revela contenido.
- Antes de descargar es obligatorio marcar la casilla de **Terms & License** (se recuerda en
  localStorage con la clave `spectre-terminos-2026-10-08`). Si no la marca, el botón pide aceptarla.

### 9.4 Regenerar (al cambiar contenido, ZIPs o contraseñas)
```
node herramientas/miembros.mjs
```
Reescribe las bóvedas de access.html, cifra los ZIPs que cambiaron (usa la caché `privado/descargas.json`
para no volver a subir los que no cambiaron) y actualiza el manifest. Después hay que borrar de
`descargas/` los `.bin` que ya no estén en el manifest.

---

## 10. Contraseñas

- Hay **una contraseña por edición**, compartida por todos los compradores de esa edición.
- Viven **solo** en `privado/clave-full.txt` y `privado/clave-luts.txt` (y, por necesidad, en el Apps
  Script, en la configuración de los links de Stripe y dentro de las guías PDF de los ZIPs).
- Se cambiaron el 13 oct 2026 porque las anteriores habían quedado escritas en el repo público. Las
  actuales las eligió Roberto.
- **Para cambiarlas, en este orden:**
  1. Escribir las nuevas en `privado/clave-*.txt` (mínimo 8 caracteres y distintas entre sí).
  2. `python3 docs/guias/generar.py` y meter los PDF nuevos a los ZIPs de `privado/paquetes/`
     (la "LUT Installation" lleva la contraseña).
  3. `node herramientas/miembros.mjs` y borrar los `.bin` viejos.
  4. Actualizar `EDICIONES` en `privado/correo-compra/Code.gs` y pegarlo en Apps Script.
  5. `bash herramientas/stripe-correo.sh` (página de confirmación + factura).
  6. Cache busting + `python3 herramientas/es/generar.py` + commit + push.
  7. Avisar por correo a los compradores existentes, si los hay.

---

## 11. Reembolsos y devoluciones

### 11.1 Política (Términos §3)
- Al ser archivos digitales, **todas las ventas son finales**: no hay reembolsos, devoluciones ni cambios
  una vez entregados o descargados los archivos.
- **Excepciones:** cobro doble de la misma orden, o un archivo defectuoso que Roberto no pueda arreglar ni
  reemplazar. El cliente debe escribir dentro de los **14 días** posteriores a la compra.
- No limita los derechos que la ley de protección al consumidor aplicable no permita renunciar.
- Facturas fiscales (CFDI en México): el cliente las pide por correo dentro del mismo mes de la compra.
- Si alguien incumple la licencia, la pierde sin reembolso (§8).

### 11.2 Cómo se hace un reembolso (lo hace Roberto, a mano)
1. Stripe → **Payments** → abrir el pago.
2. Botón **Refund** → monto completo o parcial → motivo → confirmar.
3. Stripe le manda al cliente el correo de reembolso (está activado). El dinero regresa a su tarjeta en
   5–10 días. La comisión de Stripe del pago original **no se devuelve**.
4. El reembolso **no le quita el acceso**: la contraseña es compartida. Si fuera un abuso, la única forma
   de revocar el acceso es cambiar la contraseña de esa edición (§10), lo que afecta a todos.

Hay 3 compras de prueba de MX$10 de Roberto que puede reembolsar cuando quiera (es opcional).

---

## 12. Idiomas

- **Inglés** es el idioma principal y el default (`/`, `/get`). No hay redirección automática por idioma
  del navegador. `hreflang x-default` apunta al inglés.
- **Español** (`/es/`, `/es/get`) se **genera** con:
  ```
  python3 herramientas/es/generar.py
  ```
  Toma `index.html` y `get.html`, traduce con `herramientas/es/textos.json` (mapa inglés → español),
  pone hreflang, canonical, og:locale, JSON-LD, rutas absolutas y el selector de idioma. Al final lista
  los textos que no encontró traducción: hay que agregarlos al JSON. Los comentarios HTML no se traducen.
- **Selector EN / ES:** un solo `<a class="link-idioma">` que en toda su superficie lleva al otro idioma;
  el idioma actual se ve en claro y el otro en gris. Conserva `?edition=` y el `#ancla`: el href se
  actualiza al cargar y antes del clic (pointerdown/focus), porque Umami abre el link con el href que
  tenga en ese momento.
- El enlace principal del menú tiene `min-width` igual en ambos idiomas para que nada se mueva al cambiar.
- Términos, área de miembros y correos: **solo en inglés**. Los videos de miembros están en español.

---

## 13. Cómo publicar cambios

```bash
cd ~/omnius
git pull                                   # hay dos Macs: siempre traer cambios antes
# … editar …
V=$(date +%Y%m%d%H%M%S); sed -i '' -E "s/\?v=[0-9]+/?v=$V/g" index.html get.html terms.html access.html 404.html
python3 herramientas/es/generar.py         # regenera /es/ (siempre que cambie index.html o get.html)
git add <archivos>                         # NUNCA privado/
git commit -m "…"
git push                                   # NUNCA --force
```
- El cache busting (`?v=`) es necesario cuando cambian CSS, JS o imágenes con `?v=`.
- GitHub Pages publica en ~1 min. Para esperar: `gh api repos/roberts-hub/omnius/pages/builds/latest -q .status`
  hasta que diga `built`.
- El HTML se cachea 10 minutos (`max-age=600`): recargar para ver el cambio.
- Antes de dar algo por terminado: probar en celular (375 px) **en inglés y en español** que la página no
  se salga del ancho (`document.documentElement.scrollWidth === innerWidth`) y que el menú quede igual.

---

## 14. Herramientas internas (`herramientas/`)

| Herramienta | Para qué |
|---|---|
| `miembros.mjs` | Cifra bóvedas y descargas (§9.4) |
| `stripe-correo.sh` | Configura página de confirmación + factura de los 3 links por API (§7.3) |
| `monitor.mjs` | Revisión de salud: páginas, 74+ archivos, links de Stripe activos (abre Chrome headless y detecta "link no longer active"), descargas completas, certificado HTTPS. `node herramientas/monitor.mjs` |
| `es/generar.py`, `es/textos.json`, `es/extraer.py` | Versión en español (§12) |
| `video-hero.sh`, `encode.swift`, `exportar.swift`, `frame.swift` | Convertir videos con AVFoundation (en la Mac no hay ffmpeg ni Homebrew). HEVC 1080p 5 Mbps / vertical 1080x1920 / respaldos H.264 / lite 720p |
| `lut33.py` | Hace las LUTs de 33 puntos a partir de las de 65 (toma una de cada dos muestras) |
| `avatar-instagram.sh` | Fotos de perfil para reseñas |
| `docs/guias/generar.py` | Guías PDF 16:9 → `~/Desktop/SPECTRE GUIDES/` (lee contraseñas de privado/) |

Monitor automático diario: existe `.github/workflows/monitor.yml` (14:00 UTC, abre o cierra un issue si
algo falla), pero **no está subido**. Para activarlo, Roberto corre una vez
`gh auth refresh -h github.com -s workflow` y luego se hace commit de `.github/`.

---

## 15. Diseño y reglas de marca

- **Colores:** fondo `#0b0b0a`, hueso `#eae0c5`, greige `#b0a595`, lino `#e5e0d5`, rojo `#c0392b`
  (precios de lanzamiento), líneas `rgba(176,165,149,0.16)`.
- **Tipografías:** Archivo (sans) para títulos y texto; IBM Plex Mono para etiquetas, menú y botones, en
  mayúsculas con letter-spacing.
- **Estilo:** premium, minimalista, directo. Referencias: chemabal.com/shop, reilinjoey.com,
  shop.pordoifilms.com.
- **No** cursivas serif. **No** guiones largos (—) en los PDF. **No** decir "Before & after": los
  comparadores son "Rec.709 to finished look" (no Log).
- **Hero:** el video es protagonista; viñeta mínima, solo un degradado abajo. Sin zoom.
- **Reseñas:** solo reales. No inventar.

---

## 16. Seguridad

- **El repo es público.** Jamás escribir contraseñas, llaves de Stripe, links de descarga en claro ni
  contenido de pago en archivos versionados. Todo eso va en `privado/` y los scripts lo leen de ahí.
  Las contraseñas viejas quedaron en el historial de git (por eso se cambiaron); no se reescribe el
  historial porque está prohibido el force-push.
- Las llaves de Stripe siempre restringidas, con el mínimo permiso, y las temporales se borran.
- Las bóvedas usan PBKDF2 600k + AES-GCM; las descargas, llaves aleatorias por archivo.
- `access.html` evita que la contraseña termine en la URL (`method=post action="#" onsubmit="return false"`).
- CSP estricta en las páginas (scripts propios + Umami; frames solo YouTube nocookie).
- Límite conocido: la contraseña es compartida por edición; quien la filtre le da acceso a otros.
  La mitigación es cambiarla (§10).

---

## 17. Pendientes y decisiones abiertas

- [x] DMARC en arechederra.com y en spectrecolor.com.
- [ ] Decir en la página de compra que los videos y la masterclass están en español (o agregar subtítulos).
- [ ] Copiar `privado/` (o el .dmg del respaldo completo) al NAS UGREEN.
- [ ] Día del lanzamiento: fijar INICIO en `privado/metricas-inicio.txt` y en `herramientas/umami-navegador.js`.
- [ ] (Opcional) Reembolsar las 3 compras de prueba de MX$10.
- [ ] Activar el monitor diario en GitHub Actions (`gh auth refresh -s workflow`).
- [ ] Video "How to install and use the SPECTRE LUTs" (Premiere, Final Cut, CapCut) para el LUT Pack.
- [ ] Subtítulos en inglés para la masterclass y los videos (están en español).
- [ ] Ideas de SEO: páginas por cámara (/sony-s-log3-lut, /dji-d-log-lut, /davinci-resolve-powergrade),
      LUT gratis a cambio del correo.
- [ ] Términos: jurisdicción Guadalajara asumida; se recomendó revisión de un abogado.
- Decidido: Stripe directo (no Lemon Squeezy), USD como base con opción MXN, factura PDF se queda, correo
  siempre en inglés, inglés como idioma por default.

---

## 18. Recetas rápidas

| Quiero… | Hacer |
|---|---|
| Cambiar un texto de la página | Editar `index.html`/`get.html` (inglés) + su traducción en `herramientas/es/textos.json` → publicar (§13) |
| Cambiar el precio | Stripe: precio nuevo USD + opción MXN → link nuevo → configurar con `stripe-correo.sh` (editar sus IDs) → `CHECKOUT_URLS` en `js/main.js` → precios visibles en `get.html`/`index.html` → publicar |
| Agregar un video a miembros | Subir a YouTube (no listado) → agregarlo en `privado/miembros-*.json` → `node herramientas/miembros.mjs` → publicar |
| Actualizar los archivos del producto | Reemplazar el ZIP en `privado/paquetes/` → `node herramientas/miembros.mjs` → borrar `.bin` viejos → publicar |
| Cambiar el correo de compra | Editar `privado/correo-compra/Code.gs` → pegar en Apps Script → guardar → `probar()` |
| Reembolsar | Stripe → Payments → pago → Refund (§11.2) |
| Revisar que todo funcione | `node herramientas/monitor.mjs` y `node herramientas/prueba-seguridad.mjs` |
| Ver cuentas y entradas | Tablero → pestaña Usuarios, Supabase → Table Editor → panel_cuentas, o `node herramientas/supabase.mjs cuentas` / `accesos <correo>` |
| Respaldar todo | `bash herramientas/respaldo-completo.sh` → subir el .dmg a Drive "SPECTRE respaldos" |
| Recuperar el sitio tras una pérdida | Abrir el .dmg del respaldo → `RESTAURAR.md` |
| Agregar un look al comparador | Imágenes en `img/looks/NN-antes-*.jpg` / `NN-despues-*.jpg` + bloque `<article class="look">` en index.html |
