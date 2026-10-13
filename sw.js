// Service worker de SPECTRE: con internet lento o intermitente, lo que ya se vio una vez carga desde el teléfono.
// · Páginas: siempre se piden a la red primero (contenido fresco); si la red falla o tarda más de 4 s, se usa la copia guardada.
// · CSS, JS, imágenes y tipografías: se sirven al instante desde la copia y se actualizan en segundo plano.
// · Videos (.mp4), descargas cifradas (.bin), Stripe y analítica: nunca pasan por aquí.
const VERSION = "spectre-v1";
const PAGINAS = VERSION + "-paginas";
const ARCHIVOS = VERSION + "-archivos";
const MAX_ARCHIVOS = 120;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(PAGINAS).then((c) => c.addAll(["/", "/get"]).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const recortar = async () => {
  const c = await caches.open(ARCHIVOS);
  const ks = await c.keys();
  for (let i = 0; i < ks.length - MAX_ARCHIVOS; i++) await c.delete(ks[i]);
};

self.addEventListener("fetch", (e) => {
  const r = e.request;
  if (r.method !== "GET" || r.headers.has("range")) return;
  const url = new URL(r.url);
  const propio = url.origin === self.location.origin;
  const fuentes = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (!propio && !fuentes) return;
  if (propio && (/\.(mp4|bin|webm)$/i.test(url.pathname) || url.pathname.startsWith("/descargas/") || url.pathname === "/sw.js")) return;

  if (r.mode === "navigate") {
    e.respondWith((async () => {
      const cache = await caches.open(PAGINAS);
      const red = fetch(r).then((resp) => {
        if (resp.ok) cache.put(r, resp.clone());
        return resp;
      });
      red.catch(() => {});
      const espera = new Promise((ok) => setTimeout(ok, 4000)).then(() => cache.match(r, { ignoreSearch: true }));
      try {
        const primero = await Promise.race([red, espera]);
        if (primero) return primero;
        return await red;
      } catch (_) {
        return (await cache.match(r, { ignoreSearch: true })) || (await cache.match("/")) || Response.error();
      }
    })());
    return;
  }

  e.respondWith((async () => {
    const cache = await caches.open(ARCHIVOS);
    const guardado = await cache.match(r);
    const red = fetch(r).then((resp) => {
      if (resp.ok || resp.type === "opaque") { cache.put(r, resp.clone()).then(recortar); }
      return resp;
    }).catch(() => guardado);
    if (guardado) { e.waitUntil(red); return guardado; }
    return red;
  })());
});
