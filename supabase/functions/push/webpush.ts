// Web Push sin librerías (solo WebCrypto): cifra el mensaje (RFC 8291, aes128gcm) y lo firma con VAPID (RFC 8292).
// Funciona igual en Deno (Supabase) y en Node 20+ (para probarlo en la Mac).

const te = new TextEncoder();
export const b64u = {
  enc: (b: ArrayBuffer | Uint8Array) => {
    const u = b instanceof Uint8Array ? b : new Uint8Array(b);
    let s = "";
    for (const x of u) s += String.fromCharCode(x);
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  },
  dec: (t: string) => {
    const s = atob(t.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((t.length + 3) % 4));
    return Uint8Array.from(s, (c) => c.charCodeAt(0));
  },
};
const unir = (...partes: Uint8Array[]) => {
  const out = new Uint8Array(partes.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of partes) { out.set(p, i); i += p.length; }
  return out;
};
async function hkdf(sal: Uint8Array, ikm: Uint8Array, info: Uint8Array, largo: number) {
  const k = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: sal, info }, k, largo * 8));
}

// firma VAPID: JWT ES256 con la llave privada del servidor (JWK P-256)
async function vapid(endpoint: string, llave: JsonWebKey, sujeto: string) {
  const aud = new URL(endpoint).origin;
  const cab = b64u.enc(te.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const cuerpo = b64u.enc(te.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: sujeto })));
  const privada = await crypto.subtle.importKey("jwk", llave, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const firma = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privada, te.encode(`${cab}.${cuerpo}`));
  return `${cab}.${cuerpo}.${b64u.enc(firma)}`;
}

// cifrado del contenido para ese celular (sus llaves p256dh y auth)
async function cifrar(p256dh: string, auth: string, texto: string) {
  const uaPublica = b64u.dec(p256dh), secreto = b64u.dec(auth);
  const par = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
  const asPublica = new Uint8Array(await crypto.subtle.exportKey("raw", par.publicKey));
  const uaLlave = await crypto.subtle.importKey("raw", uaPublica, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const compartido = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaLlave }, par.privateKey, 256));
  const ikm = await hkdf(secreto, compartido, unir(te.encode("WebPush: info\0"), uaPublica, asPublica), 32);
  const sal = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(sal, ikm, te.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(sal, ikm, te.encode("Content-Encoding: nonce\0"), 12);
  const k = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, k, unir(te.encode(texto), new Uint8Array([2]))));
  const rs = new Uint8Array([0, 0, 16, 0]); // tamaño de registro 4096
  return unir(sal, rs, new Uint8Array([asPublica.length]), asPublica, cifrado);
}

export type Suscripcion = { endpoint: string; p256dh: string; auth: string };
export type Vapid = { publica: string; privada: JsonWebKey; sujeto: string };

// manda un aviso; devuelve el código HTTP del servicio de avisos (201 = entregado; 404/410 = ese celular ya no existe)
export async function enviar(s: Suscripcion, datos: unknown, v: Vapid, opciones: { ttl?: number; urgencia?: string } = {}) {
  const cuerpo = await cifrar(s.p256dh, s.auth, JSON.stringify(datos));
  const jwt = await vapid(s.endpoint, v.privada, v.sujeto);
  const r = await fetch(s.endpoint, {
    method: "POST",
    headers: {
      TTL: String(opciones.ttl ?? 86400),
      Urgency: opciones.urgencia ?? "high",
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      Authorization: `vapid t=${jwt}, k=${v.publica}`,
    },
    body: cuerpo,
  });
  return { estado: r.status, texto: r.ok ? "" : (await r.text()).slice(0, 200) };
}
