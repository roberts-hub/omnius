// SPECTRE · personas en el sitio en vivo (para el tablero de Roberto).
// Mientras la página está abierta y a la vista manda un "latido" anónimo cada 30 s a Supabase (función latido).
// Solo un número al azar por navegador que cambia cada 24 h y la página. Sin IP, correo, nombre ni cookies.
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
  let ultimo = 0;
  const latir = () => {
    if (document.visibilityState !== "visible" || Date.now() - ultimo < 15000) return;
    ultimo = Date.now();
    fetch(URL_FN, {
      method: "POST",
      keepalive: true,
      headers: { apikey: LLAVE, Authorization: "Bearer " + LLAVE, "Content-Type": "application/json" },
      body: JSON.stringify({ v: id(), pagina: location.pathname.slice(0, 60) }),
    }).catch(() => {});
  };
  latir();
  setInterval(latir, 30000);
  document.addEventListener("visibilitychange", latir);
})();
