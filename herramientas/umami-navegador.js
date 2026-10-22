// SPECTRE · lee las métricas de Umami desde la sesión ya abierta en cloud.umami.is (sin plan Pro).
// Se ejecuta DENTRO de la página https://cloud.umami.is (Playwright: browser_evaluate con este texto como función).
// Devuelve {trafico, paginas, fuentes, paises, dispositivos, eventos}; herramientas/metricas.mjs --desde <archivo> lo guarda.
async () => {
  const SITIO = "add40efe-f309-476f-95a6-6367262a4434", ZONA = "America/Mexico_City", DIAS = 120;
  const INICIO = "2026-10-22T22:45:00Z"; // lanzamiento (día AAAA-MM-DD o momento exacto ISO): nada de antes cuenta. Mismo valor que privado/metricas-inicio.txt
  const INICIO_MS = Date.parse(INICIO.includes("T") ? INICIO : INICIO + "T06:00:00Z");
  if (INICIO_MS > Date.now()) return { trafico: [], eventos: [], paginas: [], fuentes: [], paises: [], dispositivos: [] };
  const tok = (localStorage.getItem("umami.auth") || "").replace(/^"|"$/g, "");
  const fin = Date.now(), inicio = Math.max(fin - DIAS * 864e5, INICIO_MS), ini30 = Math.max(fin - 30 * 864e5, INICIO_MS);
  const u = async (ruta, extra = {}, desde = inicio) => {
    const q = new URLSearchParams({ startAt: String(desde), endAt: String(fin), timezone: ZONA, ...extra });
    const r = await fetch(`/api/websites/${SITIO}${ruta}?${q}`, { headers: { Authorization: "Bearer " + tok } });
    if (!r.ok) throw new Error(`${ruta} ${r.status}`);
    return r.json();
  };
  const m30 = async (tipo, alterno) => { try { return await u("/metrics", { type: tipo, limit: "50" }, ini30); } catch (e) { if (alterno) return u("/metrics", { type: alterno, limit: "50" }, ini30); throw e; } };
  const pv = await u("/pageviews", { unit: "day" });
  const porDia = {};
  for (const p of pv.pageviews || []) porDia[p.x.slice(0, 10)] = { dia: p.x.slice(0, 10), vistas: p.y, visitantes: 0 };
  for (const s of pv.sessions || []) { const k = s.x.slice(0, 10); porDia[k] = { ...(porDia[k] || { dia: k, vistas: 0 }), visitantes: s.y }; }
  const series = await u("/events/series", { unit: "day" }).catch(() => []);
  return {
    trafico: Object.values(porDia).sort((a, b) => a.dia.localeCompare(b.dia)),
    paginas: (await m30("path", "url")).map((r) => ({ pagina: r.x || "/", vistas: r.y })),
    fuentes: (await m30("referrer")).map((r) => ({ fuente: r.x || "Directo / sin fuente", visitantes: r.y })),
    paises: (await m30("country")).map((r) => ({ pais: r.x || "Desconocido", visitantes: r.y })),
    dispositivos: (await m30("device")).map((r) => ({ dispositivo: r.x || "Desconocido", visitantes: r.y })),
    eventos: (Array.isArray(series) ? series : []).map((e) => ({ dia: String(e.t).slice(0, 10), evento: e.x, total: e.y })),
  };
}
