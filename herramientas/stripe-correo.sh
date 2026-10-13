#!/bin/bash
# Pone en cada link de pago de Stripe el texto que le llega al cliente en el correo de su factura
# (gracias + link al área de miembros + SU contraseña), y hace que después de pagar Stripe lo lleve
# directo al área de miembros ya abierta.
# Uso: bash herramientas/stripe-correo.sh   → pide una llave secreta de Stripe (no se muestra ni se guarda).
set -euo pipefail

FULL=plink_1UQBuJFethND82y0dUdl1vfy     # SPECTRE Full System (USD + MXN)
LUTS=plink_1UQBswFethND82y0hTuKybiY     # SPECTRE LUT Pack (USD + MXN)
PRUEBA=plink_1UQC5uFethND82y0rckpA5Ru   # link de prueba de $1 / MX$10 (LUT Pack)

printf "Pega tu llave secreta de Stripe (sk_live_... o rk_live_...) y presiona Enter: "
read -rs LLAVE; echo
[[ "$LLAVE" == sk_live_* || "$LLAVE" == rk_live_* ]] || { echo "Esa no parece una llave live de Stripe."; exit 1; }

texto() { # $1 contraseña
  printf 'Thank you for your purchase!\n\nAccess your files, guides and tutorials anytime:\nhttps://spectrecolor.com/access\n\nYour password: %s\n\nKeep this email: you will need the password to log in from any device.\nQuestions? roberto@arechederra.com' "$1"
}

actualizar() { # $1 link  $2 contraseña  $3 nombre
  local r
  r=$(curl -sS "https://api.stripe.com/v1/payment_links/$1" -u "$LLAVE:" \
    -d "invoice_creation[enabled]=true" \
    --data-urlencode "invoice_creation[invoice_data][description]=$(texto "$2")" \
    --data-urlencode "invoice_creation[invoice_data][footer]=SPECTRE · spectrecolor.com · Terms & License: spectrecolor.com/terms" \
    -d "after_completion[type]=redirect" \
    --data-urlencode "after_completion[redirect][url]=https://spectrecolor.com/access?compra=1#clave=$2")
  if echo "$r" | grep -q '"object": "payment_link"'; then echo "✓ $3 listo"; else echo "✗ $3: $(echo "$r" | grep -o '"message": "[^"]*"' | head -1)"; fi
}

actualizar "$PRUEBA" unlockluts "Link de prueba"
actualizar "$LUTS" unlockluts "LUT Pack"
actualizar "$FULL" unlockfullspectrum "Full System"
unset LLAVE
echo "Listo. Puedes borrar la llave en Stripe → Developers → API keys si la creaste solo para esto."
