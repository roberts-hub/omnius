// SPECTRE · avisos del panel (spectrecolor.com/admin). Recibe cada aviso y lo muestra con el logo de SPECTRE;
// al tocarlo abre el panel. No guarda páginas en caché (el panel siempre carga la versión publicada).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { title: "SPECTRE", body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "SPECTRE", {
    body: d.body || "",
    icon: "/img/marca/icono-192.png",
    badge: "/img/marca/icono-96.png",
    tag: d.tag || undefined,
    data: { url: d.url || "/admin" },
  }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "/admin", self.location.origin).href;
  e.waitUntil((async () => {
    const abiertas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of abiertas) if (c.url.startsWith(self.location.origin + "/admin")) { await c.focus(); return; }
    await self.clients.openWindow(url);
  })());
});
