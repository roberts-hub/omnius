# Genera las guías PDF de SPECTRE (16:9) y la licencia (A4).
# Uso: python3 docs/guias/generar.py  → PDFs en ~/Desktop/SPECTRE GUIDES/
# Las "capturas" son maquetas dibujadas en HTML, con los nombres reales de los archivos.
import os, subprocess, html, pathlib

AQUI = pathlib.Path(__file__).resolve().parent
RAIZ = AQUI.parent.parent
SALIDA = pathlib.Path.home() / "Desktop" / "SPECTRE GUIDES"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
FOTO = lambda n: f"file://{RAIZ}/img/looks/{n:02d}-despues-1200.jpg"

# nombres reales de los archivos que recibe el comprador
CAMARAS = [  # (nombre del One-Click LUT, nombre del PowerGrade, etiqueta)
    ("CANON C-LOG", "CANON C-LOG.drx", "Canon C-Log"),
    ("DJI D-LOG", "DJI D-LOG.drx", "DJI D-Log"),
    ("REC.709", "REC.709.drx", "Rec.709"),
    ("RED-KOMODO", "RED-LOG.drx", "RED"),
    ("SONY S-LOG3", "SONY S-LOG3.drx", "Sony S-Log3"),
]

ICONO = '<svg viewBox="0 0 40 40" fill="none" stroke="#eae0c5" stroke-width="2"><circle cx="20" cy="20" r="13"/><line x1="20" y1="2" x2="20" y2="38"/></svg>'
FUENTES = '<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,300..900&family=IBM+Plex+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet">'


def hoja(clase, contenido, guia, secciones, activa, pag, total):
    indice = "".join(f'<span class="{"activo" if i == activa else ""}">{s}</span>' for i, s in enumerate(secciones))
    return f'''<section class="hoja {clase}">
  <div class="arriba"><div class="firma-marca">{ICONO}<b>SPECTRE</b></div><div>{guia}</div><div class="pag">{pag:02d} / {total:02d}</div></div>
  {contenido}
  <div class="indice">{indice}</div>
</section>'''


def portada(kicker, titulo, serif, sub, datos, foto, pie):
    d = "".join(f"<div>{k}<b>{v}</b></div>" for k, v in datos)
    return f'''<div class="izq">
    <p class="kicker"><span class="rojo">●</span>&nbsp; {kicker}</p>
    <h1 class="titulo">{titulo}<span class="serif">{serif}</span></h1>
    <p class="texto sub">{sub}</p>
    <div class="datos">{d}</div>
  </div>
  <div class="foto"><img src="{FOTO(foto)}" alt=""><div class="esquinas"><i></i><i></i><i></i><i></i></div><div class="pie"><span>{pie}</span><span>VOL. 01</span></div></div>'''


def paso(n, kicker, titulo, items, derecha, extra=""):
    li = "".join(f"<li>{x}</li>" for x in items)
    return f'''<div class="numero">{n:02d}</div>
  <div class="izq">
    <p class="kicker">{kicker}</p>
    <h2 class="titulo">{titulo}</h2>
    <ol class="lista">{li}</ol>
    {extra}
  </div>
  <div class="der">{derecha}</div>'''


def cierre(titulo, texto):
    return f'''<div class="centro">
    <div class="icono-grande">{ICONO}</div>
    <h2 class="titulo">{titulo}</h2>
    <p class="texto">{texto}</p>
    <p class="firma">Keep creating. — Roberto</p>
    <p class="contacto">SPECTRECOLOR.COM/ACCESS &nbsp;·&nbsp; ROBERTO@ARECHEDERRA.COM &nbsp;·&nbsp; @ROBERT.ARRE</p>
  </div>'''


def rutas(mac, win):
    return f'''<div class="rutas"><div><span class="so">MACOS</span><code>{mac}</code></div><div><span class="so">WINDOWS</span><code>{win}</code></div></div>'''


def nota(titulo, texto):
    return f'<div class="nota"><b>{titulo}</b>{texto}</div>'


def ventana(titulo, cuerpo, ruta="", clase=""):
    return f'<div class="ventana {clase}"><div class="barra"><i></i><i></i><i></i><b>{titulo}</b><em>{ruta}</em></div>{cuerpo}</div>'


def filas_finder(filas):
    h = '<div class="fila encabezado"><span>Name</span><span>Date Modified</span><span>Kind</span></div>'
    for nombre, tipo, nueva in filas:
        icono = "carpeta" if tipo == "Folder" else "cubo"
        h += f'<div class="fila{" nueva" if nueva else ""}"><span class="{icono}">{nombre}</span><span>Today</span><span>{tipo}</span></div>'
    return h


# ════════════════ GUÍA 1 · DAVINCI RESOLVE (Full System) ════════════════
def guia_resolve():
    G = "GUIDE 01 &nbsp;·&nbsp; DAVINCI RESOLVE"
    S = ["Intro", "LUTs", "Refresh", "PowerGrade", "Apply", "Note"]
    T = 6
    p = []
    p.append(hoja("portada", portada(
        "FULL SYSTEM · INSTALLATION GUIDE",
        "Install SPECTRE", "in DaVinci Resolve.",
        "Five minutes of setup, then the full SPECTRE look is one drag away on every project you open.",
        [("WORKS WITH", "RESOLVE FREE & STUDIO"), ("YOU NEED", "SPECTRE FULL SYSTEM")],
        2, "GRADED WITH SPECTRE"), G, S, 0, 1, T))

    finder = ventana("LUT", filas_finder([
        ("Blackmagic Design", "Folder", False), ("DJI", "Folder", False), ("Film Looks", "Folder", False),
        ("Sony", "Folder", False), ("SPECTRE LUTs", "Folder", True), ("VFX IO", "Folder", False),
    ]), "DaVinci Resolve › LUT")
    p.append(hoja("paso", paso(1, "STEP 01 · THE LUTS GO FIRST", "Copy the LUTs into Resolve.", [
        "Unzip your download. You'll find two folders: <b>SPECTRE LUTs</b> and <b>SPECTRE POWER GRADE</b>.",
        "In Resolve, open <b>Project Settings → Color Management</b> and click <b>Open LUT Folder</b>.",
        "Drag the whole <span class='ruta'>SPECTRE LUTs</span> folder inside it.",
    ], f'<div style="position:relative">{finder}<div class="soltar">↓ DROP SPECTRE LUTs HERE</div></div>' + rutas(
        "/Library/Application Support/Blackmagic Design/DaVinci Resolve/LUT/",
        "C:\\ProgramData\\Blackmagic Design\\DaVinci Resolve\\Support\\LUT\\"), nota("BEFORE YOU START", "Set your project to <b>DaVinci YRGB · DaVinci WG/Intermediate · Rec.709-A</b>. Guide 03 shows exactly where.")), G, S, 1, 2, T))

    lado = "".join(f'<div class="{"on" if x == "SPECTRE LUTs" else ""}">{x}</div>' for x in ["Blackmagic Design", "DJI", "Film Looks", "Sony", "SPECTRE LUTs", "VFX IO"])
    minis = f'<div class="mini on"><div class="img"><img src="{FOTO(5)}"></div>SPECTRE LUT</div>' + \
            f'<div class="mini"><div class="still">{ICONO}<b>ONE CLICK</b><span>5 LUTS</span></div>SPECTRE One Click</div>'
    resolve = f'''<div class="ventana resolve"><div class="pestanas"><span>Gallery</span><span class="on">LUTs</span><span>Media Pool</span><span>Clips</span></div>
      <div class="cuerpo"><div class="lado">{lado}</div><div class="rejilla">{minis}
      <div class="menu-ctx" style="left:8px;top:150px"><div class="on">Refresh</div><div>Reveal in Finder</div></div></div></div></div>'''
    p.append(hoja("paso", paso(2, "STEP 02 · MAKE RESOLVE SEE THEM", "Refresh your LUT list.", [
        "Go to the <b>Color</b> page and open the <b>LUTs</b> panel (top left).",
        "Right-click the list and choose <b>Refresh</b>. You can also use <b>Update Lists</b> in Project Settings → Color Management.",
        "Still not showing? Save your project (<b>⌘S</b>) and restart Resolve.",
    ], resolve, nota("WHY THIS ORDER", "The PowerGrade uses the SPECTRE LUT inside its node tree. If the LUT isn't installed first, Resolve will show it as missing.")), G, S, 2, 3, T))

    stills = "".join(f'<div class="mini"><div class="still">{ICONO}<b>SPECTRE</b><span>{c[0]}</span></div>{c[1]}</div>' for c in CAMARAS)
    galeria = f'''<div class="ventana resolve"><div class="pestanas"><span class="on">Gallery</span><span>LUTs</span><span>Media Pool</span></div>
      <div class="cuerpo"><div class="lado"><div>Stills 1</div><div>PowerGrade 1</div><div class="on">SPECTRE</div></div>
      <div class="rejilla">{stills}<div class="menu-ctx" style="right:18px;bottom:-60px"><div>Add PowerGrade Album</div><hr><div class="on">Import…</div><div>Export…</div></div></div></div></div>'''
    p.append(hoja("paso", paso(3, "STEP 03 · YOUR POWERGRADE ALBUM", "Import the PowerGrades.", [
        "On the Color page, open the <b>Gallery</b>. Right-click the album list → <b>Add PowerGrade Album</b> and name it <b>SPECTRE</b>.",
        "Right-click inside the album → <b>Import…</b> and select the five <span class='ruta'>.drx</span> files from <b>SPECTRE POWER GRADE</b>. You can also drag them straight in.",
        "PowerGrade albums are shared by all your projects: you only do this once.",
    ], galeria), G, S, 3, 4, T))

    visor = f'''<div class="ventana resolve"><div class="pestanas"><span class="on">Viewer</span><span>Timeline 1</span></div>
      <div style="position:relative;padding:16px"><div class="mini"><div class="img" style="border-radius:3px"><img src="{FOTO(7)}"></div></div>
      <div class="menu-ctx" style="left:44%;top:56%"><div class="on">Apply Grade</div><div>Append Node Graph</div><hr><div>Display Node Graph</div></div></div></div>'''
    camaras = " · ".join(c[2] for c in CAMARAS)
    p.append(hoja("paso", paso(4, "STEP 04 · ONE DRAG", "Apply it to your clip.", [
        "Pick the PowerGrade that matches your camera: <b>" + camaras + "</b>.",
        "Right-click it → <b>Apply Grade</b>, or drag it onto your clip. Use <b>REC.709</b> for footage that isn't Log.",
        "Set exposure and white balance first, then fine-tune the nodes to taste. The tutorial walks through each one.",
    ], visor, nota("TIP", "Select several clips in the timeline before choosing Apply Grade to grade them all at once.")), G, S, 4, 5, T))

    p.append(hoja("cierre", cierre("A note before you grade.",
        "SPECTRE is the same system I use on my own films. Expose well, choose the version for your camera and let the node tree do the heavy lifting — then push it until it feels like yours. Consistency is the look."),
        G, S, 5, 6, T))
    return p


# ════════════════ GUÍA 2 · LUTS EN OTROS EDITORES (las dos ediciones) ════════════════
def guia_luts():
    G = "GUIDE 02 &nbsp;·&nbsp; LUT INSTALLATION"
    S = ["Intro", "Your files", "Premiere", "Apply", "Final Cut & CapCut", "Note"]
    T = 6
    p = []
    p.append(hoja("portada", portada(
        "FULL SYSTEM & LUT PACK · INSTALLATION GUIDE",
        "The SPECTRE LUTs", "in any editor.",
        "Premiere Pro, Final Cut Pro, CapCut — if it reads .cube files, it runs SPECTRE.",
        [("FORMAT", ".CUBE LUTS"), ("EDITORS", "PREMIERE · FINAL CUT · CAPCUT")],
        4, "GRADED WITH SPECTRE"), G, S, 0, 1, T))

    archivos = filas_finder([("SPECTRE LUT .cube", "Cube LUT", True), ("SPECTRE One Click", "Folder", False)] +
                            [("&nbsp;&nbsp;&nbsp;&nbsp;" + c[0] + ".cube", "Cube LUT", False) for c in CAMARAS])
    p.append(hoja("paso", paso(1, "STEP 01 · KNOW YOUR LUTS", "Two ways to use SPECTRE.", [
        "<b>SPECTRE LUT</b> — my signature finishing look. Use it on footage that is already corrected to Rec.709.",
        "<b>SPECTRE One Click</b> — five LUTs that take your camera's Log straight to the finished look: <b>" + " · ".join(c[2] for c in CAMARAS) + "</b>.",
        "Pick <b>REC.709</b> from One Click for footage shot without a Log profile.",
    ], ventana("SPECTRE LUTs", archivos, "Downloads › SPECTRE LUTs")), G, S, 1, 2, T))

    creative = ventana("Creative", filas_finder([("CineSpace2383sRGB6bit.cube", "Cube LUT", False)] +
                       [(f"SPECTRE {c[0]}.cube" if False else c[0] + ".cube", "Cube LUT", True) for c in CAMARAS] +
                       [("SPECTRE LUT .cube", "Cube LUT", True)]), "Lumetri › LUTs › Creative")
    p.append(hoja("paso", paso(2, "STEP 02 · PREMIERE PRO", "Add them to Premiere.", [
        "Quit Premiere Pro.",
        "Find the app, right-click it → <b>Show Package Contents</b>, and open <span class='ruta'>Contents/Lumetri/LUTs/Creative</span>.",
        "Copy the SPECTRE .cube files inside, then open Premiere again.",
    ], creative + rutas(
        "/Applications/Adobe Premiere Pro 2025/Adobe Premiere Pro 2025.app/Contents/Lumetri/LUTs/Creative",
        "C:\\Program Files\\Adobe\\Adobe Premiere Pro 2025\\Lumetri\\LUTs\\Creative"),
        nota("YOUR VERSION", "Replace “2025” with the version you have installed.")), G, S, 2, 3, T))

    opciones = "".join(f'<div class="{"on" if c[0] == "SONY S-LOG3" else ""}">{"✓ " if c[0] == "SONY S-LOG3" else ""}{c[0]}</div>' for c in CAMARAS)
    lumetri = f'''<div class="ventana"><div class="panel-ui"><div class="seccion"><span>⌄ Creative</span><span class="interruptor si"></span></div>
      <div class="ajuste"><span>Look</span><span class="selector">SONY S-LOG3 ⌄</span></div>
      <div class="lista-ui"><div>None</div><div>Browse…</div><hr>{opciones}<div>SPECTRE LUT</div></div>
      <div class="ajuste"><span>Intensity</span><span class="selector">100.0</span></div></div></div>'''
    p.append(hoja("paso", paso(3, "STEP 03 · LUMETRI COLOR", "Apply the look.", [
        "Select your clip and open <b>Window → Lumetri Color</b>.",
        "Under <b>Creative → Look</b>, choose the SPECTRE LUT for your camera. They're all in one list now — no browsing.",
        "Use <b>Intensity</b> to dial the look up or down, and adjust exposure in <b>Basic Correction</b> first.",
    ], lumetri, nota("NO INSTALL NEEDED", "In a hurry? Choose <b>Look → Browse…</b> and pick the .cube file from any folder.")), G, S, 3, 4, T))

    fcp = '''<div class="tarjeta"><p class="kicker">FINAL CUT PRO</p><h3>Custom LUT effect</h3>
      <div class="migas"><span>Effects</span><i>→</i><span>Color</span><i>→</i><span>Custom LUT</span></div>
      <p>Drag <b>Custom LUT</b> onto your clip. In the Inspector, open <b>LUT → Choose Custom LUT…</b> and select the SPECTRE file. For Log footage, set <b>Camera LUT</b> to <b>None</b> in the Info inspector so the LUT gets the original Log image.</p></div>'''
    cap = '''<div class="tarjeta"><p class="kicker">CAPCUT DESKTOP</p><h3>Import the LUT</h3>
      <div class="migas"><span>Adjustment</span><i>→</i><span>LUT</span><i>→</i><span>Import</span></div>
      <p>Select your clip, open <b>Adjustment → LUT</b>, click <b>Import</b> and pick the SPECTRE .cube file. Then choose it from the list to apply it. LUT import is only available in the desktop app, not on mobile.</p></div>'''
    p.append(hoja("paso", f'''<div class="numero">04</div><div class="izq"><p class="kicker">STEP 04 · OTHER EDITORS</p>
      <h2 class="titulo">Final Cut & CapCut.</h2></div><div class="columnas">{fcp}{cap}</div>''', G, S, 4, 5, T))

    p.append(hoja("cierre", cierre("A note before you grade.",
        "A LUT is only as good as the image you feed it. Nail your exposure and white balance, choose the version for your camera, and let SPECTRE finish the picture. Same look, every project."),
        G, S, 5, 6, T))
    return p


# ════════════════ GUÍA 3 · AJUSTES DE COLOR ════════════════
def guia_ajustes():
    G = "GUIDE 03 &nbsp;·&nbsp; COLOR SETTINGS"
    S = ["Intro", "Display", "Resolve", "Premiere", "Note"]
    T = 5
    p = []
    p.append(hoja("portada", portada(
        "FULL SYSTEM & LUT PACK · SETTINGS GUIDE",
        "See it right,", "export it right.",
        "A few settings so what you grade is exactly what your audience sees — from the timeline to Instagram.",
        [("FOR", "MAC · RESOLVE · PREMIERE"), ("TAKES", "2 MINUTES")],
        8, "GRADED WITH SPECTRE"), G, S, 0, 1, T))

    pantalla = '''<div class="ventana"><div class="barra"><i></i><i></i><i></i><b>Displays</b></div><div class="panel-ui">
      <div class="ajuste"><span>Automatically adjust brightness</span><span class="interruptor"></span></div>
      <div class="ajuste"><span>True Tone<small>Automatically adapt display to make colours appear consistent in different ambient lighting conditions.</small></span><span class="interruptor"></span></div>
      <div class="ajuste"><span>Night Shift</span><span class="selector">Off ⌄</span></div>
      <div class="ajuste"><span>Preset</span><span class="selector">Apple XDR Display (P3-1600 nits) ⌄</span></div></div></div>'''
    p.append(hoja("paso", paso(1, "STEP 01 · YOUR SCREEN", "Lock your display.", [
        "Open <b>System Settings → Displays</b> before you start grading.",
        "Turn <b>off</b> True Tone, Night Shift and automatic brightness. They shift your colors with the room light.",
        "On a MacBook Pro with an XDR screen, set <b>Preset</b> to <b>Apple XDR Display (P3-1600 nits)</b>.",
    ], pantalla), G, S, 1, 2, T))

    resolve = '''<div class="ventana"><div class="barra"><i></i><i></i><i></i><b>Project Settings · Color Management</b></div><div class="panel-ui">
      <div class="ajuste"><span>Color science</span><span class="selector">DaVinci YRGB ⌄</span></div>
      <div class="ajuste"><span>Use separate color space and gamma</span><span class="casilla"></span></div>
      <div class="ajuste"><span>Timeline color space</span><span class="selector">DaVinci WG/Intermediate ⌄</span></div>
      <div class="ajuste"><span>Output color space</span><span class="selector">Rec.709-A ⌄</span></div>
      <div class="seccion" style="margin-top:16px;border:0;padding:0">Preferences · General</div>
      <div class="ajuste"><span>Use Mac display color profiles for viewers</span><span class="casilla si"></span></div></div></div>'''
    p.append(hoja("paso", paso(2, "STEP 02 · DAVINCI RESOLVE", "Set up Resolve once.", [
        "In <b>Project Settings → Color Management</b>, set <b>Color science</b> to <b>DaVinci YRGB</b> and leave <b>Use separate color space and gamma</b> off.",
        "Set <b>Timeline color space</b> to <b>DaVinci WG/Intermediate</b> and <b>Output color space</b> to <b>Rec.709-A</b>. This is the exact setup the SPECTRE PowerGrade was built in.",
        "In <b>DaVinci Resolve → Preferences → General</b>, turn on <b>Use Mac display color profiles for viewers</b>.",
    ], resolve, nota("WHY REC.709-A", "It tags your export so it looks the same in QuickTime, Instagram and on phones as it did in Resolve. Avoid Resolve Color Managed and ACES: the image would be converted twice.")), G, S, 2, 3, T))

    premiere = '''<div class="ventana"><div class="barra"><i></i><i></i><i></i><b>Lumetri Color · Settings</b></div><div class="panel-ui">
      <div class="ajuste"><span>3D LUT Interpolation</span><span class="selector">Tetrahedral ⌄</span></div>
      <div class="ajuste"><span>Viewer Gamma</span><span class="selector">1.96 (QuickTime) ⌄</span></div>
      <div class="ajuste"><span>Color Manage Auto Detected Log and Raw Media</span><span class="casilla"></span></div>
      <div class="ajuste"><span>Enable Color Space Aware Effects</span><span class="casilla"></span></div></div></div>'''
    p.append(hoja("paso", paso(3, "STEP 03 · PREMIERE PRO", "Set up Premiere.", [
        "Open <b>Lumetri Color → Settings</b>.",
        "Set <b>Viewer Gamma</b> to <b>1.96 (QuickTime)</b> so the viewer matches how your export looks on a Mac and on phones.",
        "Turn <b>off</b> <b>Color Manage Auto Detected Log and Raw Media</b>. SPECTRE needs the original Log image to convert it correctly.",
    ], premiere), G, S, 3, 4, T))

    p.append(hoja("cierre", cierre("Consistency is the look.",
        "Grading at midnight on a screen that changes with the lamp next to you is how looks fall apart. Set this up once and your SPECTRE grades will look the same on your timeline, your client's laptop and their phone."),
        G, S, 4, 5, T))
    return p


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
    imprimir("SPECTRE - 01 DaVinci Resolve Installation", documento("SPECTRE — DaVinci Resolve Installation", guia_resolve()))
    imprimir("SPECTRE - 02 LUT Installation", documento("SPECTRE — LUT Installation", guia_luts()))
    imprimir("SPECTRE - 03 Color Settings", documento("SPECTRE — Color Settings", guia_ajustes()))
