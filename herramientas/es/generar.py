# Genera la versión en español (es/index.html y es/get.html) a partir de las páginas en inglés.
# Uso: python3 herramientas/es/generar.py   (correrlo después de cualquier cambio en index.html o get.html)
# Textos: herramientas/es/textos.json (inglés → español). Si aparece un texto nuevo sin traducir, el script lo avisa.
import json, re, html, pathlib, sys

RAIZ = pathlib.Path(__file__).resolve().parents[2]
DOM = "https://spectrecolor.com"
T = json.loads((RAIZ / "herramientas/es/textos.json").read_text())
PAGINAS = {"index.html": ("/", "/es/"), "get.html": ("/get", "/es/get")}
NO_TRADUCIR = re.compile(r"^(@[\w.]+|[\d\s/$.,·×%:—→←-]+|SPECTRE|stripe|VOL\. 01|ROBERTO ARECHEDERRA|COLOR SYSTEM|LUT PACK|LUTS|Color System|LUT Pack|Full System|LUTs Only|Signature LUT|One-Click LUTs|Premiere Pro, Final Cut Pro, CapCut|website|product|TWO WAVES|© 2026 ROBERTO ARECHEDERRA|@ROBERT\.ARRE|Signature LUT · One-Click LUT · PowerGrade|Signature LUT · One-Click LUTs · Any editor|Signature LUT \+ One-Click LUTs|[A-ZÁÉÍÓÚ][\w.'-]+(?: [A-Z][\w.'-]+)*)$")
faltan = []


def tr(texto):
    limpio = re.sub(r"\s+", " ", texto).strip()
    if not limpio or not re.search(r"[A-Za-z]{2}", limpio):
        return texto
    if limpio in T:
        pre = texto[: len(texto) - len(texto.lstrip())]
        post = texto[len(texto.rstrip()):]
        return pre + T[limpio] + post
    if not NO_TRADUCIR.match(limpio) and limpio not in faltan:
        faltan.append(limpio)
    return texto


def rutas_absolutas(s):
    # las páginas viven en /es/, así que las rutas relativas (img/…, css/…) pasan a absolutas
    s = re.sub(r'((?:src|href|poster|data-src)=")(?=(?:img|css|js|video|descargas)/)', r"\1/", s)
    s = re.sub(r'(srcset=")([^"]+)"', lambda m: m.group(1) + re.sub(r'(^|,\s*)(?=(?:img|video)/)', r"\1/", m.group(2)) + '"', s)
    s = re.sub(r'"video/hero-', '"/video/hero-', s)  # rutas dentro del script del video ligero
    return s


def enlaces(s):
    s = s.replace('href="/get"', 'href="/es/get"').replace('href="/#', 'href="/es/#').replace('href="/"', 'href="/es/"')
    return s


def traducir_html(s):
    partes = re.split(r"(<!--.*?-->|<script\b[^>]*>.*?</script>|<style\b[^>]*>.*?</style>|<[^>]+>)", s, flags=re.S)
    out = []
    for p in partes:
        if not p:
            continue
        if p.startswith(("<script", "<style", "<!--")) or "@@IDIOMA@@" in p:
            out.append(p)
        elif p.startswith("<"):
            # atributos legibles
            def attr(m):
                v = html.unescape(m.group(2))
                n = tr(v)
                return m.group(1) + html.escape(n, quote=True) + '"' if n != v else m.group(0)
            if p.startswith("<meta") and not re.search(r'(name="description"|property="og:(title|description)")', p):
                out.append(p)
                continue
            out.append(re.sub(r'(\b(?:alt|aria-label|title|placeholder|content|data-titulo|data-caja|data-lomo|data-ahorro)=")([^"]*)"', attr, p))
        else:
            out.append(html.escape(tr(html.unescape(p)), quote=False))
    return "".join(out)


def jsonld(s, url_es):
    m = re.search(r'(<script type="application/ld\+json">)(.*?)(</script>)', s, re.S)
    if not m:
        return s
    d = json.loads(m.group(2))
    for n in d.get("@graph", []):
        t = n.get("@type")
        if t == "WebSite":
            n["inLanguage"] = "es"
            n["url"] = DOM + "/es/"
        if t == "FAQPage":
            for q in n["mainEntity"]:
                q["name"] = T.get(q["name"], q["name"])
                a = q["acceptedAnswer"]
                a["text"] = T.get(a["text"], a["text"])
        if t == "Product":
            n["description"] = "Sistema de color cinematográfico: árbol de nodos PowerGrade para DaVinci Resolve, Signature LUT y cinco One-Click LUTs, con versiones para Sony S-Log3, DJI D-Log, Canon C-Log, RED y Rec.709, una masterclass de 50 minutos y clips en Log para practicar. Funciona en DaVinci Resolve gratis y Studio."
        if t == "BreadcrumbList":
            for it in n["itemListElement"]:
                it["item"] = it["item"].replace(DOM + "/get", DOM + "/es/get").replace(DOM + "/", DOM + "/es/") if "/es/" not in it["item"] else it["item"]
    return s[: m.start(2)] + json.dumps(d, ensure_ascii=False, separators=(",", ":")) + s[m.end(2):]


def alternos(en, es):
    return (f'  <link rel="alternate" hreflang="en" href="{DOM}{en}" />\n'
            f'  <link rel="alternate" hreflang="es" href="{DOM}{es}" />\n'
            f'  <link rel="alternate" hreflang="x-default" href="{DOM}{en}" />\n')


def boton_idioma(destino, codigo, etiqueta):
    return f'<a class="link-idioma" href="{destino}" hreflang="{codigo}" lang="{codigo}" data-umami-event="idioma" data-umami-event-idioma="{codigo}" aria-label="{etiqueta}">{codigo.upper()}</a>\n      '


(RAIZ / "es").mkdir(exist_ok=True)
for archivo, (en, es) in PAGINAS.items():
    ruta = RAIZ / archivo
    s = ruta.read_text()
    # inglés: alternos + botón ES (una sola vez)
    s = re.sub(r'  <link rel="alternate" hreflang=[^\n]*\n', "", s)
    s = s.replace('  <link rel="canonical"', alternos(en, es) + '  <link rel="canonical"', 1)
    s = re.sub(r'<a class="link-idioma"[^>]*>[A-Z]{2}</a>\n      ', "", s)
    s = s.replace('<a class="link-acceso"', boton_idioma(es, "es", "Ver en español") + '<a class="link-acceso"', 1)
    ruta.write_text(s)

    e = s.replace('<html lang="en"', '<html lang="es"', 1)
    e = e.replace(f'href="{DOM}{en}" />\n  <meta property="og:url" content="{DOM}{en}"', f'href="{DOM}{es}" />\n  <meta property="og:url" content="{DOM}{es}"')
    e = re.sub(r'<link rel="canonical" href="[^"]*" />', f'<link rel="canonical" href="{DOM}{es}" />', e)
    e = re.sub(r'<meta property="og:url" content="[^"]*" />', f'<meta property="og:url" content="{DOM}{es}" />', e)
    e = e.replace('<meta property="og:locale" content="en_US" />', '<meta property="og:locale" content="es_MX" />')
    e = re.sub(r'<a class="link-idioma"[^>]*>[A-Z]{2}</a>\n      ', "@@IDIOMA@@", e)
    e = traducir_html(e)
    e = jsonld(e, es)
    e = rutas_absolutas(e)
    e = enlaces(e)
    e = e.replace("@@IDIOMA@@", boton_idioma(en, "en", "View in English"))
    (RAIZ / "es" / archivo).write_text(e)
    print("  ✓ es/" + archivo)

if faltan:
    print("\nTextos sin traducir (agregarlos a herramientas/es/textos.json):")
    for f in faltan:
        print("  ·", f)
