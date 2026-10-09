/**
 * TWO WAVES ACADEMY — waitlist
 * Recibe el correo del formulario de spectrecolor.com y lo guarda como fila en Google Sheets.
 *
 * CÓMO ACTIVARLO (5 min, una sola vez):
 * 1. Crea un Google Sheet nuevo llamado "Waitlist Two Waves Academy".
 * 2. En el Sheet: Extensiones → Apps Script.
 * 3. Borra el código de ejemplo y pega este archivo completo. Guarda.
 * 4. Implementar → Nueva implementación → tipo "Aplicación web":
 *      - Ejecutar como: Tú
 *      - Quién tiene acceso: Cualquier persona
 * 5. Autoriza los permisos que pida (solo la hoja de cálculo) y copia la URL (termina en /exec).
 * 6. Pega esa URL en js/waitlist.js → WAITLIST_ENDPOINT y sube el cambio.
 *
 * Prueba sin el sitio: abre la URL /exec con ?correo=test@test.com&origen=prueba al final;
 * debe aparecer una fila en el Sheet.
 */

var COLUMNAS = ["FECHA", "CORREO", "ORIGEN"];

function doPost(e) { return registrar(e); }
function doGet(e) { return registrar(e); }

function registrar(e) {
  var p = (e && e.parameter) || {};
  // trampa para bots: el campo "web" va oculto en el formulario; si viene lleno, se ignora
  if (p.web) return respuesta({ ok: true });

  var correo = String(p.correo || "").trim().toLowerCase().slice(0, 254);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo)) return respuesta({ ok: false, error: "correo" });
  var origen = String(p.origen || "").replace(/[^\w\- ]/g, "").slice(0, 40);

  var lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    var hoja = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    if (hoja.getLastRow() === 0) {
      hoja.appendRow(COLUMNAS);
      hoja.setFrozenRows(1);
    }
    // sin duplicados: si el correo ya está, no se agrega otra vez
    var ultimos = hoja.getLastRow() > 1 ? hoja.getRange(2, 2, hoja.getLastRow() - 1, 1).getValues() : [];
    for (var i = 0; i < ultimos.length; i++) {
      if (String(ultimos[i][0]).toLowerCase() === correo) return respuesta({ ok: true, repetido: true });
    }
    // el apóstrofo evita que Sheets interprete el texto como fórmula
    hoja.appendRow([new Date(), "'" + correo, "'" + origen]);
  } finally {
    lock.releaseLock();
  }
  return respuesta({ ok: true });
}

function respuesta(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
