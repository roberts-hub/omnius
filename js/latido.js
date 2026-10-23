// SPECTRE · personas en el sitio en vivo (para el tablero de Roberto).
// Mientras la página está abierta y a la vista manda un "latido" anónimo cada 30 s a Supabase (función latido).
// Solo un número al azar por navegador que cambia cada 24 h, la página, el país aproximado (por la zona horaria del
// dispositivo), el canal por el que llegó y el tipo de dispositivo. Sin IP, correo, nombre ni cookies.
(() => {
  if (location.hostname !== "spectrecolor.com" || navigator.webdriver) return;
  const URL_FN = "https://ytmqltxidizdaxueooso.supabase.co/rest/v1/rpc/latido";
  const LLAVE = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0bXFsdHhpZGl6ZGF4dWVvb3NvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5Mjg4OTcsImV4cCI6MjEwNzUwNDg5N30.UOAIapQVMfOgmJx8x89MIHlh-ptAHjyzs1D55IWoFks";
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)));
  const id = () => {
    try {
      const g = JSON.parse(localStorage.getItem("spectre-v") || "null");
      if (g && g.id && Date.now() - g.t < 864e5) return g.id;
      const nuevo = { id: uuid(), t: Date.now() };
      localStorage.setItem("spectre-v", JSON.stringify(nuevo));
      return nuevo.id;
    } catch (e) {
      return (window.__spectreV ||= uuid());
    }
  };
  // país por la zona horaria (no usa la IP); si la zona no está en la lista, por la región del idioma del navegador
  const ZONAS = {
    MX: "Mexico_City Monterrey Merida Cancun Chihuahua Hermosillo Mazatlan Tijuana Matamoros Ojinaga Bahia_Banderas Ciudad_Juarez",
    US: "New_York Chicago Denver Los_Angeles Phoenix Anchorage Detroit Boise Juneau Indiana/Indianapolis Kentucky/Louisville Menominee Nome Sitka",
    CA: "Toronto Vancouver Edmonton Winnipeg Halifax Regina St_Johns Moncton Whitehorse",
    CO: "Bogota", PE: "Lima", VE: "Caracas", CL: "Santiago Punta_Arenas", EC: "Guayaquil", BO: "La_Paz", PY: "Asuncion", UY: "Montevideo",
    AR: "Buenos_Aires Argentina/Buenos_Aires Argentina/Cordoba Argentina/Mendoza Argentina/Salta Argentina/Ushuaia Cordoba",
    BR: "Sao_Paulo Bahia Fortaleza Recife Manaus Belem Cuiaba Campo_Grande Porto_Velho Rio_Branco Maceio Araguaina Boa_Vista Noronha",
    PA: "Panama", CR: "Costa_Rica", GT: "Guatemala", SV: "El_Salvador", HN: "Tegucigalpa", NI: "Managua", DO: "Santo_Domingo", PR: "Puerto_Rico", CU: "Havana",
    ES: "Madrid Canary Ceuta", GB: "London", FR: "Paris", DE: "Berlin", IT: "Rome", PT: "Lisbon Azores Madeira", NL: "Amsterdam", BE: "Brussels", CH: "Zurich",
    AT: "Vienna", SE: "Stockholm", NO: "Oslo", DK: "Copenhagen", FI: "Helsinki", IE: "Dublin", PL: "Warsaw", CZ: "Prague", GR: "Athens", TR: "Istanbul",
    RU: "Moscow", UA: "Kiev Kyiv", RO: "Bucharest", HU: "Budapest", JP: "Tokyo", KR: "Seoul", CN: "Shanghai", HK: "Hong_Kong", SG: "Singapore", IN: "Kolkata Calcutta",
    AE: "Dubai", PH: "Manila", ID: "Jakarta", TH: "Bangkok", AU: "Sydney Melbourne Brisbane Perth Adelaide Hobart Darwin", NZ: "Auckland",
    ZA: "Johannesburg", NG: "Lagos", EG: "Cairo", MA: "Casablanca", IL: "Jerusalem Tel_Aviv",
  };
  const pais = (() => {
    try {
      const z = (Intl.DateTimeFormat().resolvedOptions().timeZone || "").split("/").slice(1).join("/");
      for (const [c, l] of Object.entries(ZONAS)) if (l.split(" ").includes(z)) return c;
      const r = (navigator.language || "").split("-")[1];
      return r && /^[A-Za-z]{2}$/.test(r) ? r.toUpperCase() : null;
    } catch (_) { return null; }
  })();
  const dispositivo = /iPad|Tablet/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) ? "tablet" : /Mobi|iPhone|Android/i.test(navigator.userAgent) ? "celular" : "computadora";
  // canal: el que guardó el sitio (links /yt, /ig… o detección automática); sin canal = directo
  const canal = () => { try { const o = JSON.parse(localStorage.getItem("spectre-origen") || "null"); return (o && o.fuente) || "directo"; } catch (_) { return "directo"; } };
  let ultimo = 0;
  const latir = () => {
    if (document.visibilityState !== "visible" || Date.now() - ultimo < 15000) return;
    ultimo = Date.now();
    fetch(URL_FN, {
      method: "POST",
      keepalive: true,
      headers: { apikey: LLAVE, Authorization: "Bearer " + LLAVE, "Content-Type": "application/json" },
      body: JSON.stringify({ v: id(), pagina: location.pathname.slice(0, 60), pais, canal: canal(), dispositivo }),
    }).catch(() => {});
  };
  // el primer latido espera a que el sitio anote el canal (js/main.js corre después de este archivo)
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", latir); else latir();
  setInterval(latir, 30000);
  document.addEventListener("visibilitychange", latir);
})();
