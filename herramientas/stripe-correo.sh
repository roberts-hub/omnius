#!/bin/bash
# Pone en cada link de pago de Stripe el texto de la factura y de la página "Payment complete":
# explican que llega un correo para crear su contraseña (cuentas por comprador, ver supabase/).
# Uso: bash herramientas/stripe-correo.sh   → pide una llave secreta de Stripe (no se muestra ni se guarda).
set -euo pipefail

FULL=plink_1UQBuJFethND82y0dUdl1vfy     # SPECTRE Full System (USD + MXN)
LUTS=plink_1UQBswFethND82y0hTuKybiY     # SPECTRE LUT Pack (USD + MXN)
PRUEBA=plink_1UQC5uFethND82y0rckpA5Ru   # link de prueba de $1 / MX$10 (LUT Pack); desactivado salvo en pruebas

printf "Pega tu llave secreta de Stripe (sk_live_... o rk_live_...) y presiona Enter: "
read -rs LLAVE; echo
# al pegar, la Terminal agrega códigos invisibles (pegado entre corchetes) y espacios: se limpian
LLAVE=$(printf '%s' "$LLAVE" | LC_ALL=C sed -E 's/\x1b\[[0-9;]*~//g' | LC_ALL=C tr -cd 'A-Za-z0-9_')
[[ "$LLAVE" == sk_live_* || "$LLAVE" == rk_live_* ]] || { echo "Esa no parece una llave live de Stripe (debe empezar con rk_live_). Vuelve a intentarlo."; exit 1; }

texto() {
  printf '%s\n' \
    'Thank you for your purchase!' \
    '' \
    'HOW TO ACCESS YOUR FILES' \
    '1. Open the email "Your SPECTRE access: create your password" and create your password.' \
    '2. Log in at https://spectrecolor.com/access with your email and password.' \
    '3. Accept the Terms & License and download your files, guides and tutorials.' \
    '' \
    'Already have a SPECTRE account? Just log in with your email and password: your new purchase is already there.' \
    'Did not get the email? Check spam, or go to spectrecolor.com/access and choose "Forgot your password?" with the email you used to pay.' \
    'Questions? roberto@arechederra.com'
}

actualizar() { # $1 link  $2 nombre
  local r
  r=$(curl -sS "https://api.stripe.com/v1/payment_links/$1" -u "$LLAVE:" \
    -d "invoice_creation[enabled]=true" \
    --data-urlencode "invoice_creation[invoice_data][description]=$(texto)" \
    --data-urlencode "invoice_creation[invoice_data][footer]=SPECTRE · spectrecolor.com · Terms & License: spectrecolor.com/terms" \
    -d "consent_collection[terms_of_service]=required" \
    -d "after_completion[type]=hosted_confirmation" \
    --data-urlencode "after_completion[hosted_confirmation][custom_message]=Payment complete! Check your email (and spam) for the link to create your SPECTRE password, then log in at spectrecolor.com/access. Already have an account? Just log in with your email and password.")
  if echo "$r" | grep -q '"object": "payment_link"'; then echo "✓ $2 listo"; else echo "✗ $2: $(echo "$r" | grep -o '"message": "[^"]*"' | head -1)"; fi
}

actualizar "$LUTS" "LUT Pack"
actualizar "$FULL" "Full System"
unset LLAVE
echo "Listo. Borra la llave en Stripe → Developers → API keys si la creaste solo para esto."
