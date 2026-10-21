# SPECTRE · cómo volver a levantar todo desde este respaldo

Este respaldo tiene todo lo necesario para que spectrecolor.com vuelva a funcionar aunque se pierda la Mac,
la cuenta de GitHub o el proyecto de Supabase. Los pasos van de lo más probable a lo menos probable.

## Qué hay en cada carpeta
| Carpeta | Contenido |
|---|---|
| 01-sitio/omnius | El sitio completo (páginas, imágenes, videos, descargas cifradas, herramientas, migraciones y funciones de Supabase). |
| 02-privado | Lo que nunca se sube a GitHub: tokens, llaves de las descargas, ZIPs originales, contenido del área de miembros, código del Apps Script, footage de práctica, respaldos diarios. |
| 03-supabase | Configuración de inicio de sesión y correos, lista de secretos, todas las tablas (compras, accesos, bloqueos, contenido), usuarios con su contraseña cifrada, funciones, vistas y reglas de seguridad tal como están en vivo. |
| 04-stripe | Links de pago, webhook y ajustes (Stripe guarda todo esto; aquí está para rehacerlo si hiciera falta). |
| 05-google-dns | Registros DNS de spectrecolor.com y arechederra.com, alias de correo, Apps Script y activadores. |
| 06-claude | Tareas programadas (revisión diaria, recordatorio del token) y notas del proyecto. |

## Caso 1 · Se perdió o cambió la Mac (lo más probable)
1. Instala Git, Node.js (20+) y GitHub CLI (`gh auth login`).
2. `git clone https://github.com/roberts-hub/omnius ~/omnius` (o copia 01-sitio/omnius a ~/omnius si GitHub no está disponible).
3. Copia la carpeta 02-privado a `~/omnius/privado`.
4. Revisa: `node ~/omnius/herramientas/monitor.mjs` y `node ~/omnius/herramientas/prueba-seguridad.mjs`.
5. Si el token de Supabase venció: supabase.com → avatar → Account preferences → Access Tokens → Generate new token,
   y `node ~/omnius/herramientas/supabase.mjs conectar`.
6. Pídele a Claude que recree las tareas programadas con los textos de 06-claude.

## Caso 2 · Se perdió el repositorio de GitHub o GitHub Pages
1. Crea un repositorio nuevo, sube el contenido de 01-sitio/omnius (sin privado/), activa Pages (rama main, raíz) con dominio spectrecolor.com.
2. Si el usuario o repositorio cambió de nombre, actualiza el CNAME `www` en Squarespace (ver 05-google-dns/dns.txt).

## Caso 3 · Se perdió el proyecto de Supabase (cuentas de compradores)
**Primero intenta esto (plan Pro, desde oct 2026):** si el proyecto sigue existiendo pero se dañaron o borraron datos,
Supabase guarda una copia completa diaria de los últimos 7 días (incluye cuentas y contraseñas cifradas). Ve a
supabase.com → proyecto spectre → Database → Backups → Restore en la fecha anterior al problema. Después re-aplica a mano
los reembolsos o bloqueos posteriores a esa fecha (Stripe → Pagos → Reembolsos) con `node herramientas/supabase.mjs quitar`.
Si el proyecto ya no existe, sigue estos pasos:
1. Crea un proyecto nuevo y corre `node herramientas/supabase.mjs conectar` y luego `instalar` (crea tablas, reglas, correos, funciones
   y escribe js/cuentas-config.js con la nueva dirección). Después `correo` (pide la contraseña de aplicación de Gmail) y `contenido`.
2. Restaura los datos: en el SQL Editor de Supabase importa usuarios (03-supabase/auth-users.json, con su contraseña cifrada) y luego
   compras, accesos y bloqueos (tabla-*.json). Claude puede hacerlo con estos archivos.
3. En Stripe → Developers → Webhooks, cambia la URL del webhook al nuevo proyecto y guarda su signing secret con
   `node herramientas/supabase.mjs stripe`.
4. Actualiza la URL de Supabase en el Apps Script (propiedad SUPABASE_URL o el código) y publica el sitio.

## Caso 4 · Se perdieron las descargas o sus llaves
- Los ZIPs originales están en 02-privado/paquetes y el footage en 02-privado/practica. `node herramientas/miembros.mjs --nuevas-llaves`
  vuelve a cifrar todo, `node herramientas/supabase.mjs contenido` sube las llaves nuevas y luego commit + push de descargas/.

## Datos que NO están aquí (por seguridad) y cómo recuperarlos
- Contraseña de tu Gmail / Google Workspace, de Stripe, GitHub, Squarespace y Supabase: tu gestor de contraseñas.
- Contraseña de aplicación de Gmail (correos de cuentas): se crea otra en myaccount.google.com/apppasswords.
- Llaves de API de Stripe: no se guardan; se crea una temporal cuando hace falta.
