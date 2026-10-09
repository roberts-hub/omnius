// ══════════ TWO WAVES ACADEMY — waitlist ══════════
// Un solo campo (correo). Se guarda en un Google Sheet vía Apps Script (herramientas/academy-waitlist.gs).
// · Principal: tarjeta pequeña en una esquina, una vez (a los ~25 s o a media página).
//   Si la cierran, no vuelve en 30 días; si se anotan, no vuelve nunca.
// · Área de miembros: la misma tarjeta, fija al final del contenido (window.montarWaitlist).
// Mientras WAITLIST_ENDPOINT sea "TODO", no se muestra en ningún lado.

const WAITLIST_ENDPOINT = "TODO-APPS-SCRIPT-URL"; // termina en /exec
const WL_ESTADO = "twa-waitlist"; // "unido" | fecha (ms) de cuando la cerraron
const WL_PAUSA = 30 * 24 * 60 * 60 * 1000;

const wlListo = !WAITLIST_ENDPOINT.startsWith("TODO");
const wlLeer = () => { try { return localStorage.getItem(WL_ESTADO); } catch (_) { return null; } };
const wlGuardar = (v) => { try { localStorage.setItem(WL_ESTADO, v); } catch (_) {} };

function wlTarjeta(origen, conCerrar) {
  const t = document.createElement("section");
  t.className = "waitlist";
  t.setAttribute("aria-label", "Two Waves Academy waitlist");
  t.innerHTML = `
    ${conCerrar ? '<button class="waitlist-cerrar" type="button" aria-label="Close">×</button>' : ""}
    <p class="waitlist-kicker">TWO WAVES ACADEMY · COMING SOON</p>
    <p class="waitlist-titulo">The workflows behind our films.</p>
    <p class="waitlist-texto">Creative, color and business systems from real productions. Be the first in.</p>
    <form class="waitlist-form" novalidate>
      <input type="email" name="correo" placeholder="your@email.com" autocomplete="email" required aria-label="Email" />
      <input type="text" name="web" tabindex="-1" autocomplete="off" aria-hidden="true" class="waitlist-trampa" />
      <button type="submit">JOIN WAITLIST</button>
    </form>
    <p class="waitlist-nota" aria-live="polite">Only Academy news. Unsubscribe anytime.</p>`;

  const form = t.querySelector("form");
  const nota = t.querySelector(".waitlist-nota");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const correo = form.correo.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo)) {
      nota.textContent = "Please enter a valid email.";
      form.correo.focus();
      return;
    }
    const boton = form.querySelector("button");
    boton.disabled = true;
    boton.textContent = "JOINING…";
    try {
      // no-cors: Apps Script no devuelve encabezados CORS; si la petición sale, el registro se hace
      await fetch(WAITLIST_ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        body: new URLSearchParams({ correo, origen, web: form.web.value }),
      });
      wlGuardar("unido");
      form.remove();
      nota.textContent = "You're on the list. We'll email you first.";
      t.classList.add("unido");
    } catch (_) {
      boton.disabled = false;
      boton.textContent = "JOIN WAITLIST";
      nota.textContent = "Something went wrong. Please try again.";
    }
  });
  return t;
}

// área de miembros: tarjeta fija dentro del contenido
window.montarWaitlist = (contenedor) => {
  if (!wlListo || wlLeer() === "unido" || !contenedor) return;
  contenedor.append(wlTarjeta("miembros", false));
};

// principal: tarjeta flotante, una sola vez
if (wlListo && document.body.hasAttribute("data-waitlist-popup")) {
  const estado = wlLeer();
  const pausada = estado && estado !== "unido" && Date.now() - Number(estado) < WL_PAUSA;
  if (estado !== "unido" && !pausada) {
    let mostrada = false;
    const mostrar = () => {
      if (mostrada || document.getElementById("loader")) return; // nunca encima de la intro
      mostrada = true;
      window.removeEventListener("scroll", alBajar);
      const t = wlTarjeta("home", true);
      t.classList.add("waitlist-flotante");
      document.body.append(t);
      document.body.classList.add("con-waitlist");
      requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add("visible")));
      t.querySelector(".waitlist-cerrar").addEventListener("click", () => {
        if (wlLeer() !== "unido") wlGuardar(String(Date.now()));
        t.classList.remove("visible");
        document.body.classList.remove("con-waitlist");
        setTimeout(() => t.remove(), 500);
      });
    };
    const alBajar = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max > 0 && window.scrollY / max > 0.5) mostrar();
    };
    window.addEventListener("scroll", alBajar, { passive: true });
    setTimeout(mostrar, 25000);
  }
}
