# PDF de Términos y Licencia (A4) a partir de terms.html, con la marca de SPECTRE.
# Uso: python3 docs/guias/licencia.py  → ~/Desktop/SPECTRE GUIDES/Terms & License.pdf
import re, subprocess, pathlib

AQUI = pathlib.Path(__file__).resolve().parent
RAIZ = AQUI.parent.parent
SALIDA = pathlib.Path.home() / "Desktop" / "SPECTRE GUIDES"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
ICONO = '<svg viewBox="0 0 40 40" fill="none" stroke="#eae0c5" stroke-width="2"><circle cx="20" cy="20" r="13"/><line x1="20" y1="2" x2="20" y2="38"/></svg>'

html = (RAIZ / "terms.html").read_text()
main = html[html.index('<main'):html.index('</main>')]
fecha = re.search(r'LAST UPDATED: ([^<]+)<', main).group(1).strip()
cuerpo = main[main.index('<p class="legal-intro">'):]
cuerpo = re.sub(r'<p class="nota-legal">.*?</p>', '', cuerpo, flags=re.S)
# sin guiones largos: se leen como texto automático
cuerpo = re.sub(r'\s*—\s*', ', ', cuerpo).replace('“', '"').replace('”', '"')

doc = f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><title>SPECTRE Terms &amp; License</title>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,300..900&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
@page {{ size: A4; margin: 22mm 20mm 24mm; background: #0b0b0a; }}
* {{ box-sizing: border-box; }}
html, body {{ margin: 0; background: #0b0b0a; color: #e5e0d5; -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
body {{ font-family: "Archivo", sans-serif; font-weight: 300; font-size: 10.5pt; line-height: 1.6; }}
.portada {{ height: 240mm; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; page-break-after: always; }}
.portada svg {{ width: 56px; height: 56px; }}
.portada h1 {{ margin: 30px 0 0; font-stretch: 125%; font-weight: 800; font-size: 34pt; line-height: 1.05; text-transform: uppercase; color: #eae0c5; }}
.portada p {{ margin-top: 18px; font-family: "IBM Plex Mono", monospace; font-size: 8.5pt; letter-spacing: .26em; color: #b0a595; }}
.legal-intro {{ font-size: 12pt; color: #eae0c5; margin: 0 0 8mm; }}
section {{ break-inside: auto; margin-bottom: 6mm; }}
h2 {{ font-stretch: 125%; font-weight: 800; font-size: 12pt; text-transform: uppercase; color: #eae0c5; margin: 0 0 2.5mm; break-after: avoid; }}
p, li {{ margin: 0 0 2.5mm; }}
ul {{ padding-left: 5mm; margin: 0 0 2.5mm; }}
strong {{ font-weight: 600; color: #eae0c5; }}
a {{ color: #eae0c5; }}
.firma {{ margin-top: 12mm; padding-top: 6mm; border-top: 1px solid rgba(176,165,149,.25); display: flex; justify-content: space-between; align-items: center; font-family: "IBM Plex Mono", monospace; font-size: 8pt; letter-spacing: .2em; color: #b0a595; }}
.firma span:first-child {{ display: flex; align-items: center; gap: 10px; color: #eae0c5; font-family: "Archivo", sans-serif; font-stretch: 125%; font-weight: 800; letter-spacing: .02em; font-size: 10pt; }}
.firma svg {{ width: 16px; height: 16px; }}
</style></head><body>
<div class="portada">{ICONO}<h1>SPECTRE<br>Terms &amp; License</h1><p>END USER LICENSE AGREEMENT · LAST UPDATED {fecha.upper()}</p></div>
{cuerpo}
<div class="firma"><span>{ICONO}SPECTRE</span><span>SPECTRECOLOR.COM · ROBERTO@ARECHEDERRA.COM</span></div>
</body></html>'''

SALIDA.mkdir(exist_ok=True)
tmp = AQUI / ".licencia.html"
tmp.write_text(doc)
pdf = SALIDA / "Terms & License.pdf"
subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--no-pdf-header-footer", "--virtual-time-budget=15000",
                "--allow-file-access-from-files", f"--print-to-pdf={pdf}", f"file://{tmp}"], check=True, capture_output=True)
print("  ✓", pdf.name)
