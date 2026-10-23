# Genera el panel privado spectrecolor.com/admin a partir del tablero (herramientas/admin/tablero.html,
# la misma página del tablero "SPECTRE Métricas" de Claude).
# Uso: python3 herramientas/admin/generar.py   → escribe admin.html y js/admin-tablero.js
# La página no trae datos: js/admin.js inicia sesión y los pide a Supabase (solo correos en public.admins).
import json, pathlib, re, time

RAIZ = pathlib.Path(__file__).resolve().parents[2]
fuente = (RAIZ / "herramientas/admin/tablero.html").read_text()
V = time.strftime("%Y%m%d%H%M%S")
# llave PÚBLICA de los avisos (la privada vive solo en privado/ y en los secretos de Supabase)
VAPID = json.loads((RAIZ / "privado/push-vapid.json").read_text())["publica"]

estilos = re.findall(r"<style>([\s\S]*?)</style>", fuente)
scripts = re.findall(r"<script>([\s\S]*?)</script>", fuente)
cuerpo = re.sub(r"<script>[\s\S]*?</script>", "", re.sub(r"<style>[\s\S]*?</style>", "", fuente))
cuerpo = cuerpo.replace('<link rel="stylesheet" href="fuentes.css">', "").strip()
assert len(estilos) == 1 and len(scripts) == 2, (len(estilos), len(scripts))

# ajustes del panel: cerrar sesión y el texto de cada cuánto se actualiza
cuerpo = cuerpo.replace('<div class="sx-pie">spectrecolor.com<br>', '<div class="sx-pie">spectrecolor.com · <a href="#" id="salir">Cerrar sesión</a><span id="avisos-pie" hidden> · <a href="#" id="avisos-probar">Probar aviso</a></span><br>')
# aviso para activar las notificaciones en el celular (arriba del panel)
AVISOS = """<div class="ad-avisos" id="avisos" hidden>
      <span class="ad-avisos-ic" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg></span>
      <div class="ad-avisos-txt"><b id="avisos-titulo">Recibe cada venta en tu celular</b><span id="avisos-sub">Un aviso con el logo de SPECTRE en cuanto alguien compra.</span></div>
      <button class="sx-boton" id="avisos-btn" type="button">Activar</button>
      <button class="ad-avisos-x" id="avisos-cerrar" type="button" aria-label="Ocultar">×</button>
    </div>"""
assert cuerpo.count('<main class="sx-main">') == 1
cuerpo = cuerpo.replace('<main class="sx-main">', '<main class="sx-main">\n    ' + AVISOS)
cuerpo = cuerpo.replace("Ventas, dinero y personas en vivo · lo demás cada hora", "En vivo cada 20 s · lo demás cada hora")
js = "\n".join("(() => {\n" + s.strip("\n") + "\n})();\n" for s in scripts)
js = js.replace("'Ventas, dinero y personas en vivo · lo demás cada hora'", "'En vivo cada 20 s · lo demás cada hora'")
assert "En vivo cada 20 s" in cuerpo and "#salir" not in js

CSP = ("default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; "
       "connect-src 'self' https://ytmqltxidizdaxueooso.supabase.co; object-src 'none'; base-uri 'none'; form-action 'self'; upgrade-insecure-requests")

html = f"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <title>Page not found | SPECTRE</title>
  <meta name="robots" content="noindex, nofollow, noarchive" />
  <meta name="version" content="{V}" />
  <meta name="vapid" content="{VAPID}" />
  <meta http-equiv="Content-Security-Policy" content="{CSP}" />
  <meta name="referrer" content="no-referrer" />
  <meta name="theme-color" content="#0b0b0a" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="SPECTRE" />
  <link rel="manifest" href="/admin.webmanifest" />
  <link rel="icon" href="/img/marca/icono-192.png" type="image/png" sizes="192x192" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <link rel="preload" href="/fonts/archivo-latin-0186fb.woff2" as="font" type="font/woff2" crossorigin />
  <script src="/js/admin-arranque.js?v={V}"></script>
  <style>
    @font-face {{ font-family: 'Archivo'; font-style: normal; font-weight: 300 700; font-display: swap; src: url(/fonts/archivo-latin-0186fb.woff2) format('woff2'); unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD; }}
    @font-face {{ font-family: 'Archivo'; font-style: normal; font-weight: 300 700; font-display: swap; src: url(/fonts/archivo-latin-ext-c628a8.woff2) format('woff2'); unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF; }}
    @font-face {{ font-family: 'IBM Plex Mono'; font-style: normal; font-weight: 400; font-display: swap; src: url(/fonts/ibm-plex-mono-latin-bc87d8.woff2) format('woff2'); unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+20AC, U+2122, U+2212, U+FEFF, U+FFFD; }}
    html, body {{ margin: 0; background: #0b0b0a; color: #eae0c5; }}
    body.en-panel {{ background: #0a0a0a; }}
    [hidden] {{ display: none !important; }}
    /* entrada */
    .ad-acceso {{ min-height: 100vh; min-height: 100dvh; display: grid; place-items: center; padding: 24px 16px 96px; box-sizing: border-box; font: 400 14px/20px 'Archivo', system-ui, sans-serif; }}
    .ad-404 {{ max-width: 440px; text-align: center; }}
    .ad-404 svg {{ width: 54px; height: 54px; color: #eae0c5; margin-bottom: 26px; }}
    .ad-404 .kicker {{ margin: 0; font-family: 'IBM Plex Mono', ui-monospace, monospace; font-size: 10px; letter-spacing: 0.3em; color: #b0a595; }}
    .ad-404 h1 {{ margin: 16px 0 0; font-size: clamp(32px, 4vw, 48px); font-weight: 700; letter-spacing: -0.05em; line-height: 1; }}
    .ad-404 .texto {{ margin: 18px 0 0; font-size: 16px; font-weight: 300; line-height: 1.7; color: #b0a595; }}
    .ad-404 .ayuda {{ margin: 28px 0 0; font-size: 13px; color: #b0a595; }}
    .ad-404 a {{ color: #eae0c5; text-underline-offset: 3px; }}
    .ad-oculto {{ position: fixed; left: 50%; bottom: calc(8px + env(safe-area-inset-bottom)); transform: translateX(-50%); width: 72px; height: 48px; border: 0; padding: 0; background: transparent; cursor: default; -webkit-tap-highlight-color: transparent; }}
    .ad-carga {{ display: none; }}
    .con-sesion #falso, .con-sesion #abrir-acceso {{ display: none !important; }}
    .con-sesion .ad-carga {{ display: block; width: 46px; height: 46px; color: #eae0c5; }}
    @media (prefers-reduced-motion: no-preference) {{ .con-sesion .ad-carga {{ animation: adPulso 1.2s ease-in-out infinite; }} }}
    @keyframes adPulso {{ 0%, 100% {{ opacity: 0.35; }} 50% {{ opacity: 1; }} }}
    html.con-sesion, html.con-sesion body {{ background: #0a0a0a; }}
    .ad-oculto::before {{ content: ''; position: absolute; left: 50%; top: 50%; width: 10px; height: 10px; margin: -5px 0 0 -5px; border-radius: 50%; background: #1c1c1a; }}
    .ad-caja {{ width: 100%; max-width: 360px; background: #171717; border: 1px solid #232323; border-radius: 16px; padding: 28px 24px 24px; box-sizing: border-box; }}
    .ad-marca {{ display: flex; align-items: center; gap: 12px; margin-bottom: 22px; }}
    .ad-marca svg {{ width: 26px; height: 26px; }}
    .ad-marca span {{ font-family: 'IBM Plex Mono', ui-monospace, monospace; font-size: 12px; letter-spacing: 0.4em; }}
    .ad-caja h1 {{ margin: 0 0 4px; font-size: 20px; line-height: 26px; font-weight: 600; }}
    .ad-caja p {{ margin: 0 0 20px; color: #a3a3a3; }}
    .ad-caja label {{ display: block; margin: 0 0 6px; color: #a3a3a3; font-size: 13px; }}
    .ad-caja input[type=email], .ad-caja input[type=password] {{ width: 100%; box-sizing: border-box; height: 44px; margin-bottom: 14px; padding: 0 14px; border-radius: 10px; border: 1px solid #2e2e2e; background: #111; color: #f5f5f5; font: 400 16px 'Archivo', system-ui, sans-serif; }}
    .ad-caja input:focus {{ outline: 2px solid #86efac; outline-offset: 1px; border-color: transparent; }}
    .ad-caja button {{ width: 100%; height: 44px; border: 0; border-radius: 10px; background: #f5f5f5; color: #0a0a0a; font: 600 15px 'Archivo', system-ui, sans-serif; cursor: pointer; }}
    .ad-caja button:disabled {{ opacity: 0.6; }}
    .ad-error {{ min-height: 20px; margin: 12px 0 0 !important; color: #f04452 !important; font-size: 13px; }}
    .sx-pie a {{ color: #a3a3a3; }}
    .ad-avisos {{ display: flex; align-items: center; gap: 14px; margin: 0 0 18px; padding: 14px 14px 14px 16px; border-radius: 14px; background: linear-gradient(180deg, rgba(134, 239, 172, 0.08), rgba(134, 239, 172, 0.02)), #171717; border: 1px solid rgba(134, 239, 172, 0.2); }}
    .ad-avisos-ic {{ display: grid; place-items: center; width: 34px; height: 34px; border-radius: 10px; flex: none; background: rgba(134, 239, 172, 0.12); color: #86efac; }}
    .ad-avisos-ic svg {{ width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }}
    .ad-avisos-txt {{ flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; font-size: 13px; line-height: 18px; color: #a3a3a3; }}
    .ad-avisos-txt b {{ color: #f5f5f5; font-size: 14px; font-weight: 600; }}
    .ad-avisos-x {{ flex: none; width: 28px; height: 28px; border: 0; background: none; color: #7a7a7a; font-size: 20px; line-height: 1; cursor: pointer; }}
    .por-contar [data-source="resumen"][data-field="total_mxn"], .por-contar [data-source="resumen"][data-field="ingresos_usd"], .por-contar [data-source="resumen"][data-field="ingresos_mxn"] {{ visibility: hidden; }}
    @media (max-width: 960px) {{ .sx-lado {{ padding-top: calc(10px + env(safe-area-inset-top)) !important; }} }}
  </style>
  <style>{estilos[0]}</style>
</head>
<body>
  <main class="ad-acceso" id="acceso">
    <svg class="ad-carga" viewBox="18 18 64 64" fill="none" aria-hidden="true"><circle cx="50" cy="50" r="24" stroke="currentColor" stroke-width="2.4"/><line x1="50" y1="20" x2="50" y2="80" stroke="currentColor" stroke-width="1.6"/></svg>
    <section class="ad-404" id="falso" lang="en">
      <svg viewBox="18 18 64 64" fill="none" aria-hidden="true"><circle cx="50" cy="50" r="24" stroke="currentColor" stroke-width="2"/><line x1="50" y1="20" x2="50" y2="80" stroke="currentColor" stroke-width="1.2"/></svg>
      <p class="kicker">ERROR 404</p>
      <h1>Nothing to grade here.</h1>
      <p class="texto">This page doesn't exist. Head back to SPECTRE.</p>
      <p class="ayuda"><a href="/">spectrecolor.com</a> · <a href="/get">Get SPECTRE</a></p>
    </section>
    <form class="ad-caja" id="acceso-form" autocomplete="on" hidden>
      <div class="ad-marca"><svg viewBox="18 18 64 64" fill="none" aria-hidden="true"><circle cx="50" cy="50" r="24" stroke="currentColor" stroke-width="2.4"/><line x1="50" y1="20" x2="50" y2="80" stroke="currentColor" stroke-width="1.6"/></svg><span>SPECTRE</span></div>
      <h1>Panel</h1>
      <p>Entra con tu cuenta.</p>
      <label for="correo">Correo</label>
      <input id="correo" name="correo" type="email" autocomplete="username" required />
      <label for="clave">Contraseña</label>
      <input id="clave" name="clave" type="password" autocomplete="current-password" required />
      <button type="submit">Entrar</button>
      <p class="ad-error" id="acceso-error" role="alert"></p>
    </form>
    <button class="ad-oculto" id="abrir-acceso" type="button" tabindex="-1" aria-hidden="true"></button>
  </main>
  <div id="dash-root" hidden>
{cuerpo}
  </div>
  <script src="/js/cuentas-config.js?v={V}"></script>
  <script src="/js/vendor/d3-7.9.0.min.js"></script>
  <script src="/js/admin.js?v={V}"></script>
  <script src="/js/admin-tablero.js?v={V}"></script>
</body>
</html>
"""
(RAIZ / "admin.html").write_text(html)
(RAIZ / "js/admin-tablero.js").write_text("// Generado por herramientas/admin/generar.py a partir de herramientas/admin/tablero.html. No editar a mano.\n" + js)
print("✓ admin.html y js/admin-tablero.js")
