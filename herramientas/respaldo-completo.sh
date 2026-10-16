#!/bin/bash
# SPECTRE · respaldo COMPLETO de todo lo necesario para volver a levantar spectrecolor.com desde cero.
# Uso: bash herramientas/respaldo-completo.sh
#   → ~/Desktop/SPECTRE-respaldo-AAAA-MM-DD.dmg  (disco cifrado AES-256; pide una contraseña que tú eliges)
# Para abrirlo: doble clic en el .dmg y escribe la contraseña. Adentro está RESTAURAR.md con los pasos.
# Guarda la contraseña en un lugar seguro (sin ella el respaldo no se puede abrir) y sube el .dmg a Google Drive
# y/o al NAS. No incluye el historial de git (GitHub ya lo guarda), sí todos los archivos actuales.
set -euo pipefail
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
FECHA=$(date +%Y-%m-%d)
TMP=$(mktemp -d)
DEST="$TMP/SPECTRE-respaldo-$FECHA"
DMG="$HOME/Desktop/SPECTRE-respaldo-$FECHA.dmg"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$DEST"/{01-sitio,02-privado,03-supabase,04-stripe,05-google-dns,06-claude}

echo "1/6 Sitio (archivos actuales del repositorio, sin .git)…"
rsync -a --exclude .git --exclude node_modules --exclude privado --exclude supabase/.temp "$RAIZ/" "$DEST/01-sitio/omnius/"
git -C "$RAIZ" log -1 --format='Último commit: %H %ad %s' > "$DEST/01-sitio/version.txt"
git -C "$RAIZ" remote -v >> "$DEST/01-sitio/version.txt"

echo "2/6 privado/ (llaves de descargas, ZIPs, tokens, contenido del área de miembros, Apps Script)…"
rsync -a "$RAIZ/privado/" "$DEST/02-privado/"

echo "3/6 Supabase (configuración, funciones, base de datos completa)…"
REF=ytmqltxidizdaxueooso
TOKEN=$(cat "$RAIZ/privado/supabase-token.txt")
api() { curl -sf -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" "https://api.supabase.com/v1/projects/$REF$1" "${@:2}"; }
sql() { api /database/query -X POST --data "$(python3 -c 'import json,sys;print(json.dumps({"query":sys.argv[1]}))' "$1")"; }
api /config/auth | python3 -c 'import json,sys;d=json.load(sys.stdin);d.pop("smtp_pass",None);print(json.dumps(d,indent=1))' > "$DEST/03-supabase/config-auth.json"
api /secrets | python3 -c 'import json,sys;print(json.dumps([s["name"] for s in json.load(sys.stdin)],indent=1))' > "$DEST/03-supabase/secretos-nombres.json"
api /functions > "$DEST/03-supabase/funciones.json"
for t in compras ediciones descargas accesos bloqueos; do
  sql "select coalesce(json_agg(t),'[]'::json) as filas from public.$t t" > "$DEST/03-supabase/tabla-$t.json"
done
# usuarios con su contraseña cifrada (hash): permite restaurarlos sin que tengan que crear contraseña otra vez
sql "select coalesce(json_agg(u),'[]'::json) as filas from (select id, email, encrypted_password, email_confirmed_at, invited_at, created_at, updated_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data from auth.users) u" > "$DEST/03-supabase/auth-users.json"
sql "select string_agg(pg_get_functiondef(p.oid), E';\n\n') as f from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'" > "$DEST/03-supabase/funciones-sql-vivas.json"
sql "select string_agg('create or replace view public.'||viewname||' as '||definition, E'\n\n') as v from pg_views where schemaname='public'" > "$DEST/03-supabase/vistas-sql-vivas.json"
sql "select json_agg(p) from pg_policies p where schemaname='public'" > "$DEST/03-supabase/politicas-rls.json"
node "$RAIZ/herramientas/supabase.mjs" respaldo >/dev/null && cp "$RAIZ/privado/respaldos/$FECHA.json" "$DEST/03-supabase/clientes-$FECHA.json"

echo "4/6 Stripe (links de pago, webhook, ajustes)…"
cat > "$DEST/04-stripe/STRIPE.md" <<'EOF'
# Stripe (cuenta acct_1UNeFXFethND82y0, nombre público "Spectre")
- Full System $98 USD / MX$1,799 → payment link plink_1URE5LFethND82y0BMV3UzdA → https://buy.stripe.com/fZu4gz5KldlO5Ry3w01kA08
- LUT Pack $49 USD / MX$899 → payment link plink_1UQBswFethND82y0hTuKybiY → https://buy.stripe.com/5kQ5kD0q181u7ZG0jO1kA04
- Ambos: términos obligatorios (https://spectrecolor.com/terms), códigos de promoción activos, campo "Email me new looks and updates?",
  factura PDF post-pago con instrucciones (texto en herramientas/stripe-correo.sh), página de confirmación propia.
- Webhook: we_1UQGJRFethND82y0YlyKwU3B → https://ytmqltxidizdaxueooso.supabase.co/functions/v1/stripe-webhook
  eventos: checkout.session.completed, checkout.session.async_payment_succeeded, charge.refunded, charge.dispute.created.
  Su "signing secret" (whsec_…) vive en Supabase (secreto STRIPE_WEBHOOK_SECRET). Si se recrea el webhook: node herramientas/supabase.mjs stripe
- Datos públicos: soporte support@spectrecolor.com, dirección Two Waves Films (Paso del Arcoíris 4036, Lomas Altas, Zapopan), teléfono oculto.
- No hay llaves de API guardadas (se crean temporales y se borran).
EOF

echo "5/6 Google, correo y DNS…"
for d in spectrecolor.com arechederra.com; do
  { echo "## $d"; for t in A AAAA CNAME MX TXT NS CAA; do dig +short $t $d | sed "s/^/$t @ /"; done
    for s in www _dmarc google._domainkey _domainconnect; do for t in CNAME TXT; do dig +short $t $s.$d | sed "s/^/$t $s /"; done; done; echo; } >> "$DEST/05-google-dns/dns.txt"
done
cat > "$DEST/05-google-dns/GOOGLE.md" <<'EOF'
# Google Workspace (cuenta roberto@arechederra.com)
- Alias support@spectrecolor.com (Admin → Directorio → Usuarios → Roberto → Correos alternativos). Dominio secundario spectrecolor.com verificado.
- Gmail "Enviar como": SPECTRE Support <support@spectrecolor.com>.
- Contraseña de aplicación de Gmail para Supabase SMTP (myaccount.google.com/apppasswords) — si se pierde: crear otra y correr node herramientas/supabase.mjs correo
- DKIM de spectrecolor.com activo (Admin → Apps → Gmail → Autenticar correo). Registros DNS en dns.txt (DNS en Squarespace Domains).
- Apps Script "SPECTRE correo de compra" (id 1sIah0DkNCrXwFgbi36fEmx5NjYQaeq3uOX30vHJ_nA_Wxr_gvOtCJ2mg): código en 02-privado/correo-compra/Code.gs.
  Para reinstalar: pegar el código, elegir "instalar" → Ejecutar → aprobar todos los permisos. Activadores: vigilar (5 min), mantenerVivo (9 am),
  respaldar (3 am → Drive "SPECTRE respaldos"), recordatorioToken (8 nov 2026).
- Umami (métricas): cloud.umami.is, sitio add40efe-f309-476f-95a6-6367262a4434.
EOF

echo "6/6 Claude (tareas programadas y notas)…"
cp -R "$HOME/.claude/scheduled-tasks/spectre-"* "$DEST/06-claude/" 2>/dev/null || true
cp "$HOME/.claude/projects/-Users-roberts-creative/memory/omnius-luts-landing.md" "$DEST/06-claude/" 2>/dev/null || true
cp "$RAIZ/herramientas/RESTAURAR.md" "$DEST/RESTAURAR.md"

# revisión: que nada importante haya salido vacío
for f in 03-supabase/config-auth.json 03-supabase/tabla-compras.json 03-supabase/tabla-ediciones.json 03-supabase/auth-users.json 02-privado/descargas.json 02-privado/supabase.json; do
  [ -s "$DEST/$f" ] || { echo "✗ Falta o está vacío: $f"; exit 1; }
done
echo "✓ Contenido listo: $(du -sh "$DEST" | cut -f1)"
# --revisar: solo arma el contenido y lo deja en una carpeta para inspeccionarlo (sin cifrar ni pedir contraseña)
if [ "${1:-}" = "--revisar" ]; then trap - EXIT; echo "Carpeta de prueba: $DEST"; exit 0; fi

echo
echo "Elige una contraseña para el respaldo (mínimo 12 caracteres). Guárdala en un lugar seguro:"
read -rs P1; echo; echo "Repítela:"; read -rs P2; echo
[ "$P1" = "$P2" ] || { echo "✗ No coinciden. Vuelve a correr el comando."; exit 1; }
[ ${#P1} -ge 12 ] || { echo "✗ Muy corta (mínimo 12)."; exit 1; }
rm -f "$DMG"
printf '%s' "$P1" | hdiutil create -quiet -encryption AES-256 -stdinpass -fs APFS -volname "SPECTRE respaldo $FECHA" -srcfolder "$DEST" "$DMG"
unset P1 P2
echo "✓ Respaldo cifrado: $DMG ($(du -h "$DMG" | cut -f1))"
echo "Siguiente: súbelo a Google Drive (carpeta SPECTRE respaldos) y/o cópialo al NAS."
