# Maquetas de Premiere Pro / Finder dibujadas con los nombres reales de los archivos de SPECTRE
# (reemplazan las capturas, que mostraban los nombres viejos de los LUTs).
CHECK = '<svg viewBox="0 0 14 12" fill="none" stroke="#3b9cff" stroke-width="2.2"><path d="M1.5 6.5l3.5 3.5 7.5-8.5"/></svg>'
DOC = '<svg viewBox="0 0 12 15"><path d="M1 1h6.5L11 4.5V14H1z" fill="#f2f2f2"/><path d="M7.5 1v3.5H11" fill="none" stroke="#bbb"/></svg>'


def carpeta(nombres):
    """Ventana de Finder en la carpeta Creative de Premiere, con los LUTs de SPECTRE recién copiados (seleccionados)."""
    viejos = ["CineSpace2383sRGB6bit.itx", "SL BIG HDR.itx", "SL BIG LDR.itx", "SL BLEACH HDR.itx", "SL BLUE COLD.itx"]
    filas = "".join(f'<div class="pr-fila"><span>{DOC}{n}</span><span>Yesterday at 22:46</span><span>393 KB</span><span>Document</span></div>' for n in viejos[:2])
    filas += "".join(f'<div class="pr-fila sel"><span>{DOC}{n}.cube</span><span>Today at 12:36</span><span>7,4 MB</span><span>Document</span></div>' for n in nombres)
    filas += "".join(f'<div class="pr-fila"><span>{DOC}{n}</span><span>Yesterday at 22:46</span><span>393 KB</span><span>Document</span></div>' for n in viejos[2:])
    return ('<div class="pr pr-finder"><div class="pr-barra"><span class="pr-flechas">‹ ›</span><b>Creative</b></div>'
            '<div class="pr-fila pr-cab"><span>Name</span><span>Date Modified</span><span>Size</span><span>Kind</span></div>'
            f'{filas}</div>')


def lumetri(nombres, elegido):
    """Panel Lumetri Color → Creative → Look con la lista de LUTs de SPECTRE."""
    items = "".join(f'<div class="pr-op{" on" if n == elegido else ""}">{CHECK if n == elegido else ""}<span>{n}</span></div>' for n in nombres)
    return (f'<div class="pr pr-lumetri"><div class="pr-sec">⌄ &nbsp;Creative <i class="pr-switch"></i></div>'
            f'<div class="pr-look"><span>Look</span><div class="pr-campo">{elegido}<span>⌄</span></div></div>'
            f'<div class="pr-lista"><div class="pr-op">None</div><div class="pr-op">[Custom]</div><div class="pr-op">Browse…</div><hr>{items}</div></div>')
