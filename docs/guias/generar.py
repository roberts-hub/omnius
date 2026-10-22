# Genera las guías PDF de SPECTRE (16:9).
# Uso: python3 docs/guias/generar.py  → PDFs en ~/Desktop/SPECTRE GUIDES/
# Resolve: maquetas con los colores y textos de la app real (davinci.py). Premiere: capturas reales en img/.
import subprocess, pathlib
import davinci as dv
import premiere as pr

AQUI = pathlib.Path(__file__).resolve().parent
RAIZ = AQUI.parent.parent
SALIDA = pathlib.Path.home() / "Desktop" / "SPECTRE GUIDES"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
FOTO = lambda n: f"file://{RAIZ}/img/looks/{n:02d}-despues-1200.jpg"
IMG = lambda n: f"file://{AQUI}/img/{n}"

# nombres reales de los archivos que recibe el comprador
CAMARAS = [  # (nombre en la galería, archivo PowerGrade)
    ("CANON C-LOG", "CANON C-LOG.drx"),
    ("DJI D-LOG", "DJI D-LOG.drx"),
    ("REC.709", "REC.709.drx"),
    ("RED-LOG", "RED-LOG.drx"),
    ("SONY S-LOG 3", "SONY S-LOG 3.drx"),
]
SPR_LUTS = ["SPR LUT 1", "SPR LUT 2", "SPR LUT 3", "SPR LUT BW"]  # carpeta SPECTRE LUTs: para clips ya en Rec.709
ONE_CLICK = ["One Click 1", "One Click 2", "One Click 3", "One Click 4"]  # carpeta One Click LUTs: Sony S-Log3, conversión incluida

ICONO = '<svg viewBox="0 0 40 40" fill="none" stroke="#eae0c5" stroke-width="2"><circle cx="20" cy="20" r="13"/><line x1="20" y1="2" x2="20" y2="38"/></svg>'
FUENTES = '<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,300..900&family=IBM+Plex+Mono:wght@400;500&family=Open+Sans:wght@400;600&display=swap" rel="stylesheet">'


def hoja(clase, contenido, pag, total, pie=True):
    marca = f'<div class="pie-hoja"><div class="firma-marca">{ICONO}<b>SPECTRE</b></div><div class="pag">{pag:02d} / {total:02d}</div></div>' if pie else ""
    return f'<section class="hoja {clase}">{contenido}{marca}</section>'


def portada(titulo, sub):
    return f'<div class="centro"><div class="icono-grande">{ICONO}</div><h1 class="titulo">{titulo}</h1><p class="texto sub">{sub}</p></div>'


def paso(titulo, texto, imagen, extra=""):
    return f'<div class="izq"><h2 class="titulo">{titulo}</h2><p class="texto cuerpo">{texto}</p>{extra}</div><div class="der">{imagen}</div>'


def cierre():
    return f'<div class="centro"><div class="icono-grande">{ICONO}</div><p class="cierre-frase">Keep creating.</p></div>'


def captura(archivo):
    return f'<img class="captura" src="{IMG(archivo)}">'


def rutas(mac, win):
    return f'<div class="rutas"><div><span class="so">MACOS</span><code>{mac}</code></div><div><span class="so">WINDOWS</span><code>{win}</code></div></div>'


def guia_resolve():
    T = 7
    fotos = [FOTO(n) for n in [3, 4, 6, 1, 7]]
    return [
        hoja("portada", portada("SPECTRE<br>in DaVinci Resolve", "Set it up once. Grade with it forever."), 1, T),
        hoja("paso", paso("Step 1: Copy the LUTs",
            "Go to <b>Project Settings → Color Management</b> and click <b>Open LUT Folder</b>. Drag the <b>SPECTRE LUTs</b> and <b>One Click LUTs</b> folders inside.",
            dv.carpeta_luts(),
            rutas("/Library/Application Support/Blackmagic Design/DaVinci Resolve/LUT",
                  "C:\\ProgramData\\Blackmagic Design\\DaVinci Resolve\\Support\\LUT")), 2, T),
        hoja("paso", paso("Step 2: Refresh",
            "On the <b>Color</b> page, open <b>LUTs</b>, right-click the list and choose <b>Refresh</b>. Then save (<b>⌘S</b>) and restart Resolve. <b>SPR LUTs</b> are for clips already in Rec.709; <b>One Click</b> LUTs are for Sony S-Log3 clips.",
            dv.luts(SPR_LUTS, [FOTO(n) for n in [5, 3, 4, 6]])), 3, T),
        hoja("paso", paso("Step 3: Import the PowerGrades",
            "In the <b>Gallery</b>, right-click → <b>Add PowerGrade Album</b>. Inside the album, right-click → <b>Import</b> and pick the five <b>.drx</b> files from <b>SPECTRE POWER GRADE</b>, or drag them in.",
            dv.galeria("importar", CAMARAS, fotos)), 4, T),
        hoja("paso", paso("Step 4: Apply",
            "Select your clip, right-click the PowerGrade for your camera and choose <b>Apply Grade</b>. You can also drag it onto the clip. Another camera? Start from the closest version and adapt the nodes to your footage.",
            dv.galeria("aplicar", CAMARAS, fotos)), 5, T),
        hoja("texto", '''<div class="centro"><h2 class="titulo">Watch the full masterclass</h2>
            <p class="texto">Learn the full node tree, step by step, in the members area.</p>
            <a class="enlace" href="https://spectrecolor.com/access">spectrecolor.com/access</a>
            <p class="clave">Log in with your email and password</p></div>''', 6, T),
        hoja("cierre", cierre(), 7, T, pie=False),
    ]


def guia_luts(con33=True):
    # con33=False: versión del Full System, que no trae la carpeta "SPECTRE LUTs 33" (solo LUTs de 65 puntos)
    T = 7
    return [
        hoja("portada", portada("SPECTRE<br>LUT Installation", "Premiere Pro, Final Cut Pro and CapCut."), 1, T),
        hoja("paso", paso("Step 1: Add the LUTs to Premiere",
            "Open the ZIP and drag the files from the <b>SPECTRE LUTs</b> and <b>One Click LUTs</b> folders into Premiere's <b>Creative</b> folder.",
            pr.carpeta(ONE_CLICK + SPR_LUTS),
            rutas("/Applications/Adobe Premiere Pro 2025/Adobe Premiere Pro 2025.app/Contents/Lumetri/LUTs/Creative",
                  "C:\\Program Files\\Adobe\\Adobe Premiere Pro 2025\\Lumetri\\LUTs\\Creative")), 2, T),
        hoja("paso", paso("Step 2: Restart Premiere Pro",
            "All SPECTRE LUTs are now in <b>Lumetri → Creative → Look</b>. Pick the one that matches your clip (next page).",
            pr.lumetri(ONE_CLICK + SPR_LUTS, "One Click 1")), 3, T),
        hoja("texto", '''<div class="centro"><h2 class="titulo">Which LUT do I use?</h2>
            <p class="texto"><b>One Click 1–4</b>: for <b>Sony S-Log3</b> clips only. The conversion to Rec.709 is built in, so in Premiere one LUT takes your Log clip straight to the finished look. Don't add another conversion, and never use them on clips that are already in Rec.709.</p>
            <p class="texto"><b>SPR LUT 1, 2, 3 and BW</b>: for clips that are <b>already in Rec.709</b>, either converted from Log or shot without a Log profile.</p>
            <p class="texto">Another camera or Log profile? Convert the clip to Rec.709 first, then apply an <b>SPR LUT</b>.</p></div>''', 4, T),
        hoja("texto", '''<div class="centro"><h2 class="titulo">Final Cut / CapCut</h2>
            <p class="texto">Final Cut Pro: apply the <b>Custom LUT</b> effect from the Effects panel and choose the SPECTRE file.</p>
            <p class="texto">CapCut Desktop: <b>Adjustment → LUT → Import</b>. Not available on CapCut Mobile.</p>'''
            + ('''
            <p class="texto">Your app doesn't accept the LUT? Use the <b>33-point</b> versions in the <b>SPECTRE LUTs 33</b> folder.</p>''' if con33 else "")
            + '''</div>''', 5, T),
        hoja("texto", f'''<div class="centro"><h2 class="titulo">Your members area</h2>
            <p class="texto">Tutorials and downloads, always available.</p>
            <a class="enlace" href="https://spectrecolor.com/access">spectrecolor.com/access</a>
            <p class="clave">Log in with your email and password</p></div>''', 6, T),
        hoja("cierre", cierre(), 7, T, pie=False),
    ]


def guia_ajustes():
    T = 5
    pantalla = '''<div class="ventana"><div class="barra"><i></i><i></i><i></i><b>Displays</b></div><div class="panel-ui">
      <div class="ajuste"><span>True Tone</span><span class="interruptor"></span></div>
      <div class="ajuste"><span>Preset</span><span class="selector">Apple XDR Display (P3-1600 nits) ⌄</span></div>
      <div class="ajuste"><span>Night Shift</span><span class="selector">Off ⌄</span></div></div></div>'''
    premiere = '''<div class="ventana pr"><div class="panel-ui">
      <div class="seccion"><span>⌄ Project: My Project</span></div>
      <div class="ajuste"><span>HDR Graphics White (Nits):</span><span class="selector">203 (75% HLG, 58% PQ) ⌄</span></div>
      <div class="ajuste"><span>3D LUT Interpolation:</span><span class="selector">Tetrahedral (requires GPU) ⌄</span></div>
      <div class="ajuste"><span>Viewer Gamma:</span><span class="selector">1.96 (QuickTime) ⌄</span></div>
      <div class="ajuste"><span><span class="casilla"></span>&nbsp; Color Manage Auto Detected Log and Raw Media</span></div>
      <div class="ajuste"><span><span class="casilla"></span>&nbsp; Enable Color Space Aware Effects</span></div></div></div>'''
    return [
        hoja("portada", portada("SPECTRE<br>Color Settings", "What you grade is what they see."), 1, T),
        hoja("paso", paso("Your screen",
            "Before opening your editor, go to <b>System Settings → Displays</b>. Turn off <b>True Tone</b> and Night Shift. On an XDR screen, set <b>Preset</b> to <b>Apple XDR Display (P3-1600 nits)</b>.",
            pantalla), 2, T),
        hoja("paso", paso("DaVinci Resolve",
            "In <b>Project Settings → Color Management</b>, use exactly these settings and click <b>Save</b>.",
            dv.color_management()), 3, T),
        hoja("paso", paso("Premiere Pro",
            "In <b>Lumetri Color → Settings</b>, set <b>Viewer Gamma</b> to <b>1.96 (QuickTime)</b> and turn off <b>Color Manage Auto Detected Log and Raw Media</b>.",
            premiere), 4, T),
        hoja("cierre", cierre(), 5, T, pie=False),
    ]


def documento(titulo, hojas):
    return f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><title>{titulo}</title>{FUENTES}
<link rel="stylesheet" href="file://{AQUI}/guias.css"></head><body>{"".join(hojas)}</body></html>'''


def imprimir(nombre, contenido):
    SALIDA.mkdir(exist_ok=True)
    tmp = AQUI / f".{nombre}.html"
    tmp.write_text(contenido)
    pdf = SALIDA / f"{nombre}.pdf"
    subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--no-pdf-header-footer", "--virtual-time-budget=15000",
                    "--allow-file-access-from-files", f"--print-to-pdf={pdf}", f"file://{tmp}"],
                   check=True, capture_output=True)
    print("  ✓", pdf.name)


if __name__ == "__main__":
    imprimir("DaVinci Installation", documento("SPECTRE DaVinci Resolve Installation", guia_resolve()))
    imprimir("LUT Installation", documento("SPECTRE LUT Installation", guia_luts()))
    imprimir("LUT Installation (Full System)", documento("SPECTRE LUT Installation", guia_luts(con33=False)))
    imprimir("Color Settings", documento("SPECTRE Color Settings", guia_ajustes()))
