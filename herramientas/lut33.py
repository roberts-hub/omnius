# Convierte un LUT .cube de 65 puntos a 33 puntos tomando un punto de cada dos (65 = 2*32 + 1),
# así cada valor del LUT de 33 es exactamente un valor del original (sin interpolar).
# Uso: python3 herramientas/lut33.py entrada.cube salida.cube "Título"
import sys
ent, sal, titulo = sys.argv[1], sys.argv[2], sys.argv[3]
filas, tam = [], None
for l in open(ent):
    t = l.split()
    if not t or t[0].startswith("#"): continue
    if t[0] == "LUT_3D_SIZE": tam = int(t[1]); continue
    if t[0] in ("TITLE", "DOMAIN_MIN", "DOMAIN_MAX", "LUT_1D_SIZE"): continue
    filas.append(" ".join(t[:3]))
assert tam == 65 and len(filas) == 65 ** 3, (tam, len(filas))
out = [f'TITLE "{titulo}"', "LUT_3D_SIZE 33", ""]
for b in range(0, 65, 2):
    for g in range(0, 65, 2):
        for r in range(0, 65, 2):          # en .cube el rojo cambia más rápido
            out.append(filas[r + 65 * g + 65 * 65 * b])
with open(sal, "w", newline="\r\n") as f:   # fin de línea CRLF: lo aceptan Windows, macOS y Linux
    f.write("\n".join(out) + "\n")
