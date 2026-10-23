// ══════════ Links cortos: spectrecolor.com/yt · /ig · /tt · /wa ══════════
// Se ven limpios en la bio o la descripción. Cada uno registra en Umami de dónde vino la visita (como si trajera
// ?utm_source=…), guarda esa fuente en este dispositivo 30 días (js/main.js la manda a Stripe al comprar, para saber
// qué canal vendió) y lleva a la página principal ya sin nada en la dirección.
// ?c=nombre (por ejemplo /yt?c=masterclass) distingue videos o publicaciones.
(function () {
  var h = document.documentElement, fuente = h.dataset.fuente, medio = h.dataset.medio || "";
  var c = (new URLSearchParams(location.search).get("c") || "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40);
  try { localStorage.setItem("spectre-origen", JSON.stringify({ fuente: fuente, medio: medio, campana: c, t: Date.now() })); } catch (e) {}
  var ruta = "/" + location.pathname.replace(/^\/+|\.html$|\/+$/g, "");
  var url = ruta + "?utm_source=" + fuente + (medio ? "&utm_medium=" + medio : "") + (c ? "&utm_campaign=" + c : "");
  var hecho = false;
  var ir = function () { if (hecho) return; hecho = true; location.replace("/"); };
  setTimeout(ir, 1200); // si Umami está bloqueado o tarda, igual se va a la página
  var registrar = function () {
    if (!window.umami) return ir();
    try { Promise.resolve(window.umami.track(function (p) { return Object.assign({}, p, { url: url }); })).then(ir, ir); } catch (e) { ir(); }
  };
  if (window.umami) registrar();
  else { var s = document.querySelector('script[src*="umami"]'); if (s) { s.addEventListener("load", registrar); s.addEventListener("error", ir); } else ir(); }
})();
