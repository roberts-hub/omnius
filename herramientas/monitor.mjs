// Revisión diaria de spectrecolor.com (la corre GitHub Actions: .github/workflows/monitor.yml).
// Comprueba páginas, archivos que usan las páginas, links de pago de Stripe, descargas del área de miembros
// y el certificado HTTPS. Si algo falla, el proceso termina con error y el workflow abre un aviso (issue).
// Uso local: node herramientas/monitor.mjs
import tls from "node:tls";
import { appendFileSync } from "node:fs";

const SITIO = "https://spectrecolor.com";
const PAGINAS = [
  ["/", "SPECTRE"], ["/get", "Full System"], ["/es/", "LUTs cinematográficos"], ["/es/get", "Full System"],
  ["/terms", "Terms"], ["/access", "contenido-cifrado"],
];
const OTROS = ["/sitemap.xml", "/robots.txt", "/favicon.ico", "/site.webmanifest", "/sw.js", "/legal/SPECTRE-Terms-and-License.pdf"];
const LENTO_MS = 6000;

const fallas = [], avisos = [], ok = [];
const falla = (m) => { fallas.push(m); console.log("✗", m); };
const aviso = (m) => { avisos.push(m); console.log("!", m); };
const bien = (m) => { ok.push(m); console.log("✓", m); };

async function pedir(url, opciones = {}, intentos = 3) {
  let ultimo;
  for (let i = 0; i < intentos; i++) {
    const t0 = Date.now();
    try {
      const r = await fetch(url, { redirect: "follow", ...opciones, headers: { "user-agent": "SPECTRE-monitor/1.0", ...(opciones.headers || {}) }, signal: AbortSignal.timeout(30000) });
      return { r, ms: Date.now() - t0 };
    } catch (e) { ultimo = e; await new Promise((ok) => setTimeout(ok, 3000)); }
  }
  throw ultimo;
}

// 1. páginas y todo lo que cargan (css, js, imágenes, videos)
const recursos = new Set();
for (const [ruta, marca] of PAGINAS) {
  try {
    const { r, ms } = await pedir(SITIO + ruta);
    const html = await r.text();
    if (r.status !== 200) { falla(`Página ${ruta}: respondió ${r.status}`); continue; }
    if (!html.includes(marca)) { falla(`Página ${ruta}: carga pero le falta su contenido ("${marca}")`); continue; }
    if (ms > LENTO_MS) aviso(`Página ${ruta}: tardó ${(ms / 1000).toFixed(1)} s en responder`);
    bien(`Página ${ruta} (${ms} ms)`);
    const base = new URL(SITIO + ruta);
    for (const m of html.matchAll(/\b(?:src|href|poster|data-src)="([^"#]+)"/g)) recursos.add(new URL(m[1], base).href);
    for (const m of html.matchAll(/srcset="([^"]+)"/g)) for (const p of m[1].split(",")) recursos.add(new URL(p.trim().split(/\s+/)[0], base).href);
  } catch (e) { falla(`Página ${ruta}: no respondió (${e.message})`); }
}
for (const o of OTROS) recursos.add(SITIO + o);
let revisados = 0;
for (const u of recursos) {
  if (!u.startsWith(SITIO) || !/\.\w+$/.test(new URL(u).pathname)) continue; // páginas ya revisadas arriba
  try {
    const { r } = await pedir(u, { method: "HEAD" });
    if (r.status !== 200) falla(`Archivo ${u.replace(SITIO, "")}: respondió ${r.status}`);
    revisados++;
  } catch (e) { falla(`Archivo ${u.replace(SITIO, "")}: no respondió (${e.message})`); }
}
bien(`${revisados} archivos de las páginas revisados`);

// 2. links de pago de Stripe (se leen del js publicado: si alguien los cambia, se revisan los nuevos)
try {
  const { r } = await pedir(SITIO + "/js/main.js");
  const js = await r.text();
  const bloque = js.match(/CHECKOUT_URLS\s*=\s*{([^}]*)}/);
  const links = bloque ? [...bloque[1].matchAll(/(\w+)\s*:\s*"([^"]+)"/g)] : [];
  if (links.length < 2) falla("Checkout: no encontré los dos links de pago en js/main.js");
  for (const [, edicion, url] of links) {
    if (!/^https:\/\/buy\.stripe\.com\//.test(url)) { falla(`Checkout ${edicion}: el link no es de Stripe (${url})`); continue; }
    const { r: s, ms } = await pedir(url);
    const pagina = await s.text();
    if (s.status !== 200) falla(`Checkout ${edicion}: Stripe respondió ${s.status}`);
    else if (/\/error\b|deactivated/.test(s.url)) falla(`Checkout ${edicion}: Stripe manda a una página de error (${s.url})`);
    else if (!/<title>Stripe Checkout/i.test(pagina)) falla(`Checkout ${edicion}: la página de pago no cargó como se esperaba`);
    else bien(`Checkout ${edicion} en Stripe (${ms} ms)`);
  }
} catch (e) { falla(`Checkout: no pude revisarlo (${e.message})`); }

// 3. descargas del área de miembros: cada parte cifrada existe y está completa
try {
  const { r } = await pedir(SITIO + "/descargas/manifest.json");
  const lista = await r.json();
  let total = 0;
  for (const p of lista) {
    const { r: h } = await pedir(SITIO + p.ruta, { method: "HEAD", headers: { "accept-encoding": "identity" } });
    const largo = Number(h.headers.get("content-length"));
    if (h.status !== 200) falla(`Descarga ${p.ruta}: respondió ${h.status}`);
    else if (largo && largo !== p.bytes) falla(`Descarga ${p.ruta}: incompleta (${largo} de ${p.bytes} bytes)`);
    else total += p.bytes;
  }
  bien(`Descargas: ${lista.length} partes completas (${(total / 1e6).toFixed(0)} MB)`);
  const { r: a } = await pedir(SITIO + "/access");
  const m = (await a.text()).match(/id="contenido-cifrado">([\s\S]*?)<\/script>/);
  const bovedas = m ? JSON.parse(m[1]) : [];
  if (bovedas.length !== 2) falla(`Área de miembros: esperaba 2 bóvedas (Full System y LUT Pack) y hay ${bovedas.length}`);
  else bien("Área de miembros: las 2 bóvedas están publicadas");
} catch (e) { falla(`Descargas: no pude revisarlas (${e.message})`); }

// 4. certificado HTTPS
await new Promise((listo) => {
  const s = tls.connect(443, "spectrecolor.com", { servername: "spectrecolor.com" }, () => {
    const dias = Math.floor((new Date(s.getPeerCertificate().valid_to) - Date.now()) / 864e5);
    if (dias < 7) falla(`Certificado HTTPS: vence en ${dias} días`);
    else if (dias < 20) aviso(`Certificado HTTPS: vence en ${dias} días (GitHub suele renovarlo solo)`);
    else bien(`Certificado HTTPS válido (${dias} días)`);
    s.end(); listo();
  });
  s.on("error", (e) => { falla(`Certificado HTTPS: ${e.message}`); listo(); });
});

// resumen
const resumen = [
  `## SPECTRE · revisión diaria · ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`,
  fallas.length ? `### ✗ ${fallas.length} problema(s)\n${fallas.map((f) => "- " + f).join("\n")}` : "### ✓ Todo funciona",
  avisos.length ? `### Avisos\n${avisos.map((f) => "- " + f).join("\n")}` : "",
  `### Revisado\n${ok.map((f) => "- " + f).join("\n")}`,
].filter(Boolean).join("\n\n");
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, resumen + "\n");
if (process.env.REPORTE) appendFileSync(process.env.REPORTE, resumen + "\n");
process.exit(fallas.length ? 1 : 0);
