// SPECTRE · administración de cuentas en Supabase (desde esta Mac).
// Uso: node herramientas/supabase.mjs <comando>
//
//   conectar            pide el "Personal access token" de Supabase y el id del proyecto (se guardan en privado/)
//   instalar            todo lo inicial: tablas, ajustes de inicio de sesión, correos, función de Stripe, sitio
//   correo              configura el envío de correos con Gmail (pide la contraseña de aplicación)
//   stripe              guarda el secreto del webhook de Stripe (pide whsec_…)
//   contenido           sube el contenido del área de miembros (privado/contenido-*.json, lo genera miembros.mjs)
//   dar <correo> <full|luts>     da acceso a mano (crea la cuenta y le manda el correo si no existe)
//   quitar <correo> <full|luts>  quita el acceso
//   reenviar <correo>   vuelve a mandar el correo para crear contraseña
//   compras             lista las compras registradas
//
// Nada secreto se escribe en el repo: el token, las llaves y las contraseñas viven solo en privado/.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import readline from "node:readline";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const PRIV = (f) => join(RAIZ, "privado", f);
const SITIO = "https://spectrecolor.com";
const PLINKS = { full: "plink_1UQBuJFethND82y0dUdl1vfy", luts: "plink_1UQBswFethND82y0hTuKybiY" };
const REMITENTE = "roberto@arechederra.com";

// ── utilidades ──
function preguntar(texto, oculto = false) {
  process.stdout.write(texto);
  return new Promise((ok) => {
    const entrada = process.stdin;
    let valor = "";
    const limpiar = (r) => r.replace(/\x1b\[[0-9;]*~/g, "").replace(/[^\x21-\x7e]/g, ""); // códigos invisibles del pegado
    if (!oculto || !entrada.isTTY) {
      const rl = readline.createInterface({ input: entrada });
      rl.once("line", (l) => { rl.close(); ok(limpiar(l)); });
      return;
    }
    // modo oculto: no se escribe nada en pantalla mientras se pega o se teclea
    entrada.setRawMode(true);
    entrada.resume();
    const alLeer = (trozo) => {
      for (const c of trozo.toString("utf8")) {
        if (c === "\r" || c === "\n") {
          entrada.setRawMode(false); entrada.pause(); entrada.off("data", alLeer);
          process.stdout.write("\n");
          return ok(limpiar(valor));
        }
        if (c === "\u0003") { process.stdout.write("\n"); process.exit(130); } // Ctrl-C
        if (c === "\u007f") { valor = valor.slice(0, -1); continue; }
        valor += c;
      }
    };
    entrada.on("data", alLeer);
  });
}
const config = () => {
  if (!existsSync(PRIV("supabase.json"))) throw new Error("Primero: node herramientas/supabase.mjs conectar");
  return JSON.parse(readFileSync(PRIV("supabase.json"), "utf8"));
};
const token = () => readFileSync(PRIV("supabase-token.txt"), "utf8").trim();

async function api(ruta, opciones = {}) {
  const r = await fetch(`https://api.supabase.com${ruta}`, {
    ...opciones,
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json", ...(opciones.headers || {}) },
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`${opciones.method || "GET"} ${ruta} → ${r.status} ${t}`);
  return t ? JSON.parse(t) : null;
}
const sql = (query) => api(`/v1/projects/${config().ref}/database/query`, { method: "POST", body: JSON.stringify({ query }) });

async function llaves() {
  const ks = await api(`/v1/projects/${config().ref}/api-keys?reveal=true`);
  const de = (...tipos) => ks.find((k) => tipos.includes(k.name) || tipos.includes(k.type))?.api_key;
  return { publica: de("anon", "publishable"), servicio: de("service_role", "secret") };
}
async function sb(ruta, opciones = {}) {
  const { servicio } = await llaves();
  const r = await fetch(`https://${config().ref}.supabase.co${ruta}`, {
    ...opciones,
    headers: { apikey: servicio, Authorization: `Bearer ${servicio}`, "Content-Type": "application/json", ...(opciones.headers || {}) },
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`${ruta} → ${r.status} ${t}`);
  return t ? JSON.parse(t) : null;
}

// ── correos (mismo diseño negro que el sitio) ──
function plantilla({ etiqueta, titulo, texto, boton, nota }) {
  const sans = "font-family:Archivo,'Helvetica Neue',Helvetica,Arial,sans-serif;";
  const mono = "font-family:'IBM Plex Mono',Menlo,Consolas,monospace;";
  return `<!doctype html><html><head><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"></head>
<body style="margin:0;padding:0;background:#0b0b0a;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#0b0b0a" style="background:#0b0b0a;"><tr><td align="center" style="padding:24px 16px 40px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
<tr><td style="padding:0 0 32px;${sans}font-size:22px;font-weight:700;letter-spacing:0.02em;color:#eae0c5;">SPECTRE</td></tr>
<tr><td style="padding:0 0 8px;${mono}font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:#b0a595;">${etiqueta}</td></tr>
<tr><td style="padding:0 0 14px;${sans}font-size:28px;line-height:1.2;font-weight:600;color:#eae0c5;">${titulo}</td></tr>
<tr><td style="padding:0 0 30px;${sans}font-size:15px;line-height:1.6;color:#b0a595;">${texto}</td></tr>
<tr><td style="padding:0 0 30px;"><a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:15px 26px;border-radius:10px;background:#eae0c5;color:#0b0b0a;${mono}font-size:11px;font-weight:500;letter-spacing:0.2em;text-transform:uppercase;text-decoration:none;">${boton} &rarr;</a></td></tr>
<tr><td style="padding:0 0 28px;${sans}font-size:13px;line-height:1.6;color:#6f685d;">${nota}</td></tr>
<tr><td style="border-top:1px solid #2a2824;padding:24px 0 0;${sans}font-size:13px;line-height:1.7;color:#b0a595;">Questions? Reply to this email or write to <a href="mailto:${REMITENTE}" style="color:#eae0c5;">${REMITENTE}</a></td></tr>
<tr><td style="padding:18px 0 0;${mono}font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#6f685d;"><a href="${SITIO}" style="color:#6f685d;text-decoration:none;">spectrecolor.com</a> &nbsp;·&nbsp; <a href="${SITIO}/terms" style="color:#6f685d;text-decoration:none;">Terms &amp; License</a></td></tr>
</table></td></tr></table></body></html>`;
}

const CORREOS = {
  mailer_subjects_invite: "Your SPECTRE access: create your password",
  mailer_templates_invite_content: plantilla({
    etiqueta: "Payment confirmed",
    titulo: "Thank you for your purchase.",
    texto: "Your SPECTRE account is ready. Create your password to access your files, guides and tutorials from any device.",
    boton: "Create your password",
    nota: "This link works once and expires in 24 hours. If it expired, go to spectrecolor.com/access and choose “Forgot your password?” with this email.",
  }),
  mailer_subjects_recovery: "Reset your SPECTRE password",
  mailer_templates_recovery_content: plantilla({
    etiqueta: "Members area",
    titulo: "Reset your password.",
    texto: "We received a request to reset the password of your SPECTRE account. Choose a new one with the button below.",
    boton: "Choose a new password",
    nota: "This link works once and expires in 1 hour. If you didn’t ask for this, you can ignore this email: your password stays the same.",
  }),
  mailer_subjects_email_change: "Confirm your new email for SPECTRE",
  mailer_subjects_magic_link: "Your SPECTRE login link",
  mailer_subjects_confirmation: "Confirm your SPECTRE account",
};

// ── comandos ──
const comandos = {
  async conectar() {
    console.log("En supabase.com: avatar → Account preferences → Access Tokens → Generate new token.");
    const t = await preguntar("Pega el token (sbp_…) y presiona Enter: ", true);
    if (!/^sbp_[\w]+$/.test(t)) throw new Error("Eso no parece un token de Supabase (empieza con sbp_).");
    writeFileSync(PRIV("supabase-token.txt"), t + "\n", { mode: 0o600 });
    const proyectos = await api("/v1/projects");
    const p = proyectos.find((x) => /spectre/i.test(x.name)) || proyectos[0];
    if (!p) throw new Error("No encontré proyectos en tu cuenta de Supabase.");
    writeFileSync(PRIV("supabase.json"), JSON.stringify({ ref: p.id, nombre: p.name, region: p.region }, null, 2));
    console.log(`✓ Conectado al proyecto "${p.name}" (${p.id}, ${p.region}).`);
  },

  async instalar() {
    const { ref } = config();
    await sql(readFileSync(join(RAIZ, "supabase/migrations/0001_cuentas.sql"), "utf8"));
    console.log("✓ Tablas y permisos (RLS)");
    await api(`/v1/projects/${ref}/config/auth`, {
      method: "PATCH",
      body: JSON.stringify({
        site_url: SITIO + "/access",
        uri_allow_list: `${SITIO}/access,${SITIO}/access*,http://localhost:4181/access.html`,
        disable_signup: true,            // nadie se registra solo: las cuentas las crea el pago
        external_email_enabled: true,
        mailer_autoconfirm: false,
        password_min_length: 10,
        password_required_characters: "abcdefghijklmnopqrstuvwxyz:ABCDEFGHIJKLMNOPQRSTUVWXYZ:0123456789",
        mailer_otp_exp: 86400,           // el link para crear contraseña dura 24 h
        security_update_password_require_reauthentication: false,
      }),
    });
    console.log("✓ Inicio de sesión: solo por invitación, contraseñas de 10+ caracteres");
    console.log("  (los correos con el diseño SPECTRE se activan con: node herramientas/supabase.mjs correo)");
    await api(`/v1/projects/${ref}/secrets`, {
      method: "POST",
      body: JSON.stringify([
        { name: "PLINK_FULL", value: PLINKS.full },
        { name: "PLINK_LUTS", value: PLINKS.luts },
        { name: "SITIO", value: SITIO },
      ]),
    });
    execFileSync("npx", ["--yes", "supabase@2.120.0", "functions", "deploy", "stripe-webhook", "--project-ref", ref, "--no-verify-jwt", "--use-api"], {
      cwd: RAIZ, stdio: "inherit", env: { ...process.env, SUPABASE_ACCESS_TOKEN: token() },
    });
    console.log(`✓ Función del webhook: https://${ref}.supabase.co/functions/v1/stripe-webhook`);
    const { publica } = await llaves();
    writeFileSync(join(RAIZ, "js/cuentas-config.js"),
      `// Generado por herramientas/supabase.mjs. Es público a propósito: la llave "publishable/anon" solo permite\n` +
      `// lo que dejan las reglas (RLS) de la base de datos, y nadie sin una compra activa puede leer nada.\n` +
      `window.SPECTRE_CUENTAS = ${JSON.stringify({ url: `https://${ref}.supabase.co`, llave: publica })};\n`);
    console.log("✓ js/cuentas-config.js (dirección del proyecto para el sitio)");
  },

  async correo() {
    console.log(`Contraseña de aplicación de Google para ${REMITENTE} (myaccount.google.com/apppasswords).`);
    const pass = await preguntar("Pégala (16 letras) y presiona Enter: ", true);
    if (pass.length < 16) throw new Error("La contraseña de aplicación tiene 16 letras.");
    await api(`/v1/projects/${config().ref}/config/auth`, {
      method: "PATCH",
      body: JSON.stringify({
        smtp_host: "smtp.gmail.com", smtp_port: "587", smtp_user: REMITENTE, smtp_pass: pass,
        smtp_admin_email: REMITENTE, smtp_sender_name: "Roberto from SPECTRE", smtp_max_frequency: 1,
        rate_limit_email_sent: 100,
      }),
    });
    // con SMTP propio ya se pueden usar las plantillas con el diseño SPECTRE
    await api(`/v1/projects/${config().ref}/config/auth`, { method: "PATCH", body: JSON.stringify(CORREOS) });
    console.log("✓ Los correos de cuentas salen desde " + REMITENTE);
  },

  async stripe() {
    const s = await preguntar("Pega el signing secret del webhook (whsec_…) y presiona Enter: ", true);
    if (!/^whsec_\w+$/.test(s)) throw new Error("Eso no parece un secreto de webhook (empieza con whsec_).");
    await api(`/v1/projects/${config().ref}/secrets`, { method: "POST", body: JSON.stringify([{ name: "STRIPE_WEBHOOK_SECRET", value: s }]) });
    console.log("✓ Secreto del webhook guardado en Supabase");
  },

  async contenido() {
    const filas = ["full", "luts"].map((id) => ({ id, contenido: JSON.parse(readFileSync(PRIV(`contenido-${id}.json`), "utf8")), actualizada: new Date().toISOString() }));
    await sb("/rest/v1/ediciones?on_conflict=id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates" }, body: JSON.stringify(filas) });
    console.log("✓ Contenido del área de miembros actualizado (full y luts)");
  },

  async dar(correo, edicion) {
    if (!correo || !["full", "luts"].includes(edicion)) throw new Error("Uso: dar <correo> <full|luts>");
    correo = correo.toLowerCase();
    let id = await sb("/rest/v1/rpc/usuario_por_correo", { method: "POST", body: JSON.stringify({ correo }) });
    if (!id) id = (await sb(`/auth/v1/invite?redirect_to=${encodeURIComponent(SITIO + "/access")}`, { method: "POST", body: JSON.stringify({ email: correo }) })).id;
    await sb("/rest/v1/compras", { method: "POST", body: JSON.stringify({ user_id: id, email: correo, edicion, motivo: "manual" }) });
    console.log(`✓ ${correo} ya tiene ${edicion}`);
  },

  async quitar(correo, edicion) {
    await sb(`/rest/v1/compras?email=eq.${encodeURIComponent(correo.toLowerCase())}&edicion=eq.${edicion}`, { method: "PATCH", body: JSON.stringify({ activa: false, motivo: "retirado a mano" }) });
    console.log(`✓ ${correo} ya no tiene ${edicion}`);
  },

  async reenviar(correo) {
    await sb(`/auth/v1/recover?redirect_to=${encodeURIComponent(SITIO + "/access")}`, { method: "POST", body: JSON.stringify({ email: correo.toLowerCase() }) });
    console.log(`✓ Correo para crear/restablecer contraseña enviado a ${correo}`);
  },

  async compras() {
    const filas = await sb("/rest/v1/compras?select=email,edicion,activa,motivo,creada&order=creada.desc");
    console.table(filas);
  },
};

const [cmd, ...args] = process.argv.slice(2);
if (!comandos[cmd]) { console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").slice(1, 16).join("\n")); process.exit(1); }
comandos[cmd](...args).catch((e) => { console.error("✗ " + e.message); process.exit(1); });
