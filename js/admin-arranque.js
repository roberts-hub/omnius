// SPECTRE · panel: antes de pintar la página, si este dispositivo ya tiene sesión se salta el 404 y se muestra el logo
// mientras abre el panel (así no se ve un parpadeo del error al tocar el ícono de la pantalla de inicio).
try {
  var g = JSON.parse(localStorage.getItem("spectre-admin-sesion") || sessionStorage.getItem("spectre-admin-sesion") || "null");
  if (g && g.refresh_token) document.documentElement.classList.add("con-sesion");
} catch (e) { /* sin almacenamiento: se muestra el 404 */ }
