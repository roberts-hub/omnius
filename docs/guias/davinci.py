# Maquetas de DaVinci Resolve 20 con la misma estructura, textos y colores que la app real.
IC_TAB = '<svg viewBox="0 0 15 12" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="1" y="1.5" width="13" height="9" rx="1"/><path d="M3 8l3-3 2 2 2-2 2 3"/></svg>'
IC_ALB = '<svg viewBox="0 0 13 11" fill="none" stroke="currentColor" stroke-width="1.1"><rect x="0.5" y="0.5" width="12" height="10" rx="1"/><rect x="2.5" y="2.5" width="4" height="3"/></svg>'
CURSOR = '<svg class="dv-cursor" style="{pos}" viewBox="0 0 14 20"><path d="M1 1v15l4-4 3 7 2.5-1-3-7h5.5z" fill="#fff" stroke="#000" stroke-width="1"/></svg>'


def tabs(activa):
    nombres = ["Gallery", "LUTs", "Media Pool", "Clips ⌄"]
    return '<div class="dv-tabs">' + "".join(f'<span class="{"on" if n == activa else ""}">{IC_TAB}{n}</span>' for n in nombres) + '</div>'


def tool(ruta):
    return (f'<div class="dv-tool"><span>▤</span><span>‹ ›</span><b>{ruta}</b><span class="dv-slider"></span>'
            '<span>⇅</span><span>▦</span><span>☰</span><span>⌕</span><span>•••</span></div>')


def menu(items, pos):
    h = ""
    for it in items:
        if it == "-":
            h += "<hr>"
        else:
            clase = "on" if it.startswith("*") else ""
            h += f'<div class="{clase}">{it.lstrip("*")}</div>'
    return f'<div class="dv-menu" style="{pos}">{h}</div>'


def luts(foto):
    carpetas = ["ACES", "Arri", "Astrodesign", "Blackmagic Design", "DCI", "DJI", "Film Looks", "Sony", "SPECTRE LUTs", "VFX IO"]
    lado = '<div class="raiz">▾ &nbsp;LUTs</div>' + "".join(f'<div class="{"on" if c == "SPECTRE LUTs" else ""}">{c}</div>' for c in carpetas)
    rejilla = (f'<div class="dv-item on"><div class="dv-img barras"><img src="{foto}"></div><div class="dv-etq">SPECTRE LUT</div></div>'
               '<div class="dv-item"><div class="dv-carpeta"><i></i></div><div class="dv-etq">SPECTRE One Click</div></div>')
    m = menu(["*Refresh", "Reveal in Finder"], "left:150px;top:262px")
    return (f'<div class="dv">{tabs("LUTs")}{tool("SPECTRE LUTs")}<div class="dv-cuerpo"><div class="dv-lado">{lado}</div>'
            f'<div class="dv-rejilla">{rejilla}</div></div>{m}{CURSOR.format(pos="left:160px;top:250px")}</div>')


def galeria(tipo, camaras, fotos):
    albumes = [("Stills 1", ""), ("PowerGrade 1", ""), ("SPECTRE", "on"), ("Timelines", "")]
    lado = "".join(f'<div class="{c}">{IC_ALB}{n}</div>' for n, c in albumes)
    stills = "".join(
        f'<div class="dv-item{" on" if (tipo == "aplicar" and c[0] == "SONY S-LOG3") else ""}"><div class="dv-img"><img src="{f}"></div>'
        f'<div class="dv-etq">{c[1].replace(".drx", "")}</div></div>' for c, f in zip(camaras, fotos))
    if tipo == "importar":
        m = menu(["Switch Wipe Mode", "-", "Trace Timeline", "One Still Per Scene", "Apply Display Lut", "-",
                  "Copy Grade From Current Project Still", "Copy Grade From Other Project Still", "-", "*Import", "Import With Output LUT"],
                 "right:16px;top:96px")
        c = CURSOR.format(pos="right:150px;top:312px")
    else:
        m = menu(["*Apply Grade", "Append Node Graph", "-", "Display Node Graph", "-", "Export", "Delete Selected"],
                 "left:470px;top:160px")
        c = CURSOR.format(pos="left:478px;top:150px")
    return (f'<div class="dv">{tabs("Gallery")}{tool("SPECTRE")}<div class="dv-cuerpo"><div class="dv-lado albumes">{lado}</div>'
            f'<div class="dv-rejilla">{stills}</div></div>{m}{c}</div>')


def fila(etiqueta, valor, on=False):
    return f'<div class="dv-fila"><span>{etiqueta}</span><span class="dv-campo{" on" if on else ""}">{valor}</span></div>'


def check(texto, si=False):
    return f'<div class="dv-fila"><span></span><span class="dv-check"><i class="{"si" if si else ""}"></i>{texto}</span></div>'


def ajustes(contenido):
    nav = ["Master Settings", "Blackmagic Cloud", "Image Scaling", "Color Management", "General Options", "Camera Raw", "Capture and Playback", "Fusion", "Fairlight"]
    lado = "".join(f'<div class="{"on" if n == "Color Management" else ""}">{n}</div>' for n in nav)
    return (f'<div class="dv dv-ajustes"><div class="dv-titulo">Project Settings: <em>Untitled Project 1</em></div>'
            f'<div class="dv-cuerpo"><div class="dv-nav">{lado}</div><div class="dv-cont">{contenido}</div></div>'
            '<div class="dv-pie"><span>Cancel</span><span>Save</span></div></div>')


def color_management():
    return ajustes('<div class="dv-sec">Color Space &amp; Transforms</div><div class="dv-grupo">' +
                   fila("Color science", "DaVinci YRGB", True) + check("Use separate color space and gamma") +
                   fila("Timeline color space", "DaVinci WG/Intermediate", True) + fila("Output color space", "Rec.709-A", True) + '</div>' +
                   '<div class="dv-sec">Lookup Tables</div><div class="dv-grupo">' +
                   fila("Input lookup table", "No LUT selected") + fila("Output lookup table", "No LUT selected") +
                   '<div class="dv-fila"><span></span><span><span class="dv-boton">Update Lists</span></span></div>' +
                   '<div class="dv-fila"><span></span><span><span class="dv-boton">Open LUT Folder</span></span></div></div>')


def carpeta_luts():
    return ajustes('<div class="dv-sec">Lookup Tables</div><div class="dv-grupo">' +
                   fila("Input lookup table", "No LUT selected") + fila("Output lookup table", "No LUT selected") +
                   fila("Video monitor lookup table", "No LUT selected") + fila("3D lookup table interpolation", "Trilinear") +
                   '<div class="dv-fila"><span></span><span><span class="dv-boton">Update Lists</span></span></div>' +
                   '<div class="dv-fila"><span></span><span><span class="dv-boton on">Open LUT Folder</span></span></div></div>')
