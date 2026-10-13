# Saca los textos visibles (y atributos legibles) de index.html y get.html para traducirlos.
import re, json, html, sys
from html.parser import HTMLParser
ATTRS = {"alt", "aria-label", "title", "placeholder", "content", "data-titulo", "data-caja", "data-lomo", "data-ahorro", "aria-valuetext"}
class P(HTMLParser):
    def __init__(s): super().__init__(convert_charrefs=True); s.t=[]; s.skip=0
    def handle_starttag(s, tag, a):
        if tag in ("script","style"): s.skip+=1
        d=dict(a)
        if tag=="meta" and not (d.get("name") in ("description",) or (d.get("property") or "").startswith("og:")): return
        for k,v in a:
            if k in ATTRS and v and re.search(r"[A-Za-z]{2}", v) and not v.startswith(("http","/","#")): s.t.append(v.strip())
    def handle_endtag(s, tag):
        if tag in ("script","style"): s.skip-=1
    def handle_data(s, d):
        if not s.skip and re.search(r"[A-Za-z]{2}", d): s.t.append(re.sub(r"\s+"," ",d).strip())
vistos=[]
for f in sys.argv[1:]:
    p=P(); p.feed(open(f).read())
    for x in p.t:
        if x not in vistos: vistos.append(x)
print(json.dumps(vistos, ensure_ascii=False, indent=0))
