// Generado por herramientas/admin/generar.py a partir de herramientas/admin/tablero.html. No editar a mano.
(() => {
  // ── cálculos (cada uno da filas para los 4 periodos: el filtro elige cuáles se ven) ──
  const SX_ZONA = 'America/Mexico_City';
  const sxHoy = () => new Date().toLocaleDateString('en-CA', { timeZone: SX_ZONA });
  const sxDesde = (p) => { const h = sxHoy(); if (p === 'hoy') return h; if (p === 'todo') return '0000-00-00'; const n = p === '7d' ? 6 : 29; return new Date(Date.parse(h + 'T12:00:00Z') - n * 864e5).toISOString().slice(0, 10); };
  const SX_PERIODOS = ['hoy', '7d', '30d', 'todo'];
  window.SX = { hoy: sxHoy, desde: sxDesde, periodos: SX_PERIODOS };

  // personas en el sitio en vivo: misma forma de respuesta que las ventas (texto con la lista JSON entre etiquetas)
  dash.loader('presencia', {
    description: 'Saca la fila de la respuesta de Supabase (execute_sql) y deja los conteos como números.',
    fn: ({ answer }) => {
      let r = answer;
      if (typeof r === 'string') { try { r = JSON.parse(r); } catch (e) { /* texto tal cual */ } }
      if (r && typeof r === 'object' && !Array.isArray(r) && r.error) throw new Error(typeof r.error === 'string' ? r.error : r.error.message || JSON.stringify(r.error));
      const texto = typeof r === 'string' ? r : r && typeof r.result === 'string' ? r.result : null;
      let filas = Array.isArray(r) ? r : null;
      if (!filas && texto) {
        const m = texto.match(/<untrusted-data-([\w-]+)>\s*(\[[\s\S]*?\])\s*<\/untrusted-data-\1>/);
        try { filas = JSON.parse(m ? m[2] : texto); } catch (e) { throw new Error(texto.slice(0, 300)); }
      }
      if (!Array.isArray(filas)) throw new Error('Supabase no devolvió filas');
      return filas.map((f) => ({ ...f, activos: Number(f.activos), visitantes_24h: Number(f.visitantes_24h), visitantes_hoy: f.visitantes_hoy == null ? null : Number(f.visitantes_hoy) }));
    },
  });

  // visitantes de hoy por país, canal y dispositivo: misma forma de respuesta de Supabase
  dash.loader('vivo_hoy', {
    description: 'Saca las filas de la respuesta de Supabase (execute_sql) y deja los conteos como números.',
    fn: ({ answer }) => {
      let r = answer;
      if (typeof r === 'string') { try { r = JSON.parse(r); } catch (e) { /* texto tal cual */ } }
      if (r && typeof r === 'object' && !Array.isArray(r) && r.error) throw new Error(typeof r.error === 'string' ? r.error : r.error.message || JSON.stringify(r.error));
      const texto = typeof r === 'string' ? r : r && typeof r.result === 'string' ? r.result : null;
      let filas = Array.isArray(r) ? r : null;
      if (!filas && texto) {
        const m = texto.match(/<untrusted-data-([\w-]+)>\s*(\[[\s\S]*?\])\s*<\/untrusted-data-\1>/);
        try { filas = JSON.parse(m ? m[2] : texto); } catch (e) { throw new Error(texto.slice(0, 300)); }
      }
      if (!Array.isArray(filas)) throw new Error('Supabase no devolvió filas');
      return filas.map((f) => ({ tipo: f.tipo, clave: f.clave == null ? '' : String(f.clave), visitantes: Number(f.visitantes) }));
    },
  });

  // ventas en vivo: la consulta a Supabase responde texto con la lista JSON entre etiquetas; aquí solo se convierte en filas
  dash.loader('ventas', {
    description: 'Saca la lista de filas de la respuesta de Supabase (execute_sql) y deja montos y números como números.',
    fn: ({ answer }) => {
      let r = answer;
      if (typeof r === 'string') { try { r = JSON.parse(r); } catch (e) { /* texto tal cual */ } }
      if (r && typeof r === 'object' && !Array.isArray(r) && r.error) throw new Error(typeof r.error === 'string' ? r.error : r.error.message || JSON.stringify(r.error));
      const texto = typeof r === 'string' ? r : r && typeof r.result === 'string' ? r.result : null;
      let filas = Array.isArray(r) ? r : null;
      if (!filas && texto) {
        // la etiqueta también aparece en la frase de aviso: se toma la que abre la lista ([…])
        const m = texto.match(/<untrusted-data-([\w-]+)>\s*(\[[\s\S]*?\])\s*<\/untrusted-data-\1>/);
        try { filas = JSON.parse(m ? m[2] : texto); } catch (e) { throw new Error(texto.slice(0, 300)); }
      }
      if (!Array.isArray(filas)) throw new Error('Supabase no devolvió filas');
      return filas.map((f) => ({ ...f, n: Number(f.n), monto: f.monto == null ? null : Number(f.monto) }));
    },
  });

  dash.calc('resumen', {
    title: 'Resumen por periodo',
    description: 'Ventas pagadas, ingresos por moneda, total en pesos (dólares al tipo de cambio del día), visitantes (hoy: contador propio en vivo; otros periodos: Umami cada hora), clics en pagar, conversión y el cambio en % contra el periodo anterior del mismo largo.',
    inputs: ['ventas', 'trafico', 'eventos', 'tipo_cambio', 'presencia'],
    fn: (ventas, trafico, eventos, tipo_cambio, presencia) => {
      const vivoHoy = presencia[0] && presencia[0].visitantes_hoy != null ? Number(presencia[0].visitantes_hoy) : null;
      const tc = Number(tipo_cambio[0] && tipo_cambio[0].usd_mxn) || 0;
      const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
      const desde = (p) => (p === 'hoy' ? hoy : p === 'todo' ? '0000-00-00' : new Date(Date.parse(hoy + 'T12:00:00Z') - (p === '7d' ? 6 : 29) * 864e5).toISOString().slice(0, 10));
      return ['hoy', '7d', '30d', 'todo'].map((periodo) => {
        const d = desde(periodo);
        const v = ventas.filter((x) => Number(x.n) > 0 && x.estado === 'pagada' && x.dia >= d);
        const suma = (mon) => Math.round(v.filter((x) => String(x.moneda).toUpperCase() === mon).reduce((s, x) => s + (Number(x.monto) || 0), 0) * 100) / 100;
        const visitantes = periodo === 'hoy' && vivoHoy != null ? vivoHoy : trafico.filter((t) => t.dia >= d).reduce((s, t) => s + (Number(t.visitantes) || 0), 0);
        const clics = eventos.filter((e) => e.dia >= d && e.evento === 'checkout').reduce((s, e) => s + (Number(e.total) || 0), 0);
        const usd = suma('USD'), mxn = suma('MXN');
        // periodo anterior del mismo largo (ayer, los 7 o 30 días previos); "todo" no tiene
        const dp = periodo === 'todo' ? null : new Date(Date.parse(d + 'T12:00:00Z') - (periodo === 'hoy' ? 1 : periodo === '7d' ? 7 : 30) * 864e5).toISOString().slice(0, 10);
        const vp = dp ? ventas.filter((x) => Number(x.n) > 0 && x.estado === 'pagada' && x.dia >= dp && x.dia < d) : [];
        const totalPrev = vp.reduce((s, x) => s + (String(x.moneda).toUpperCase() === 'USD' ? (Number(x.monto) || 0) * tc : String(x.moneda).toUpperCase() === 'MXN' ? Number(x.monto) || 0 : 0), 0);
        const visPrev = dp ? trafico.filter((t) => t.dia >= dp && t.dia < d).reduce((s, t) => s + (Number(t.visitantes) || 0), 0) : 0;
        const cambio = (ahora, antes) => (antes > 0 ? Math.round(((ahora - antes) / antes) * 1000) / 10 : null);
        const total = Math.round((mxn + usd * tc) * 100) / 100;
        return { periodo, cambio_total: cambio(total, totalPrev), cambio_ventas: cambio(v.length, vp.length), cambio_visitantes: periodo === 'hoy' && vivoHoy != null ? null : cambio(visitantes, visPrev), ventas: v.length, gratis: v.filter((x) => Number(x.monto) === 0).length, ingresos_usd: usd, ingresos_mxn: mxn, total_mxn: Math.round((mxn + usd * tc) * 100) / 100, tipo_cambio: tc, visitantes, clics, conversion: visitantes ? Math.round((v.length / visitantes) * 1000) / 10 : 0 };
      });
    },
  });

  dash.calc('serie_dinero', {
    title: 'Ganado en el tiempo',
    description: 'Total acumulado en pesos (dólares al tipo de cambio del día) de las ventas pagadas: por hora si el periodo cabe en un día, si no por día.',
    inputs: ['ventas', 'tipo_cambio'],
    fn: (ventas, tipo_cambio) => {
      const tc = Number(tipo_cambio[0] && tipo_cambio[0].usd_mxn) || 0;
      const zona = 'America/Mexico_City';
      const hoy = new Date().toLocaleDateString('en-CA', { timeZone: zona });
      const horaAhora = Number(new Date().toLocaleTimeString('en-GB', { timeZone: zona, hour: '2-digit', hour12: false }).slice(0, 2));
      const pagadas = ventas.filter((x) => Number(x.n) > 0 && x.estado === 'pagada');
      const pesos = (x) => { const m = String(x.moneda).toUpperCase(); return m === 'USD' ? (Number(x.monto) || 0) * tc : m === 'MXN' ? Number(x.monto) || 0 : 0; };
      const dias = (a, b) => { const o = []; for (let t = Date.parse(a + 'T12:00:00Z'); t <= Date.parse(b + 'T12:00:00Z'); t += 864e5) o.push(new Date(t).toISOString().slice(0, 10)); return o; };
      const etq = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', timeZone: 'UTC' });
      const primero = pagadas.length ? pagadas.map((x) => x.dia).sort()[0] : hoy;
      const filas = [];
      for (const periodo of ['hoy', '7d', '30d', 'todo']) {
        const desde = periodo === 'hoy' ? hoy : periodo === 'todo' ? primero : new Date(Date.parse(hoy + 'T12:00:00Z') - (periodo === '7d' ? 6 : 29) * 864e5).toISOString().slice(0, 10);
        const v = pagadas.filter((x) => x.dia >= desde);
        let acum = 0, n = 0;
        if (desde >= hoy) {
          const horas = v.filter((x) => x.dia === hoy).map((x) => Number(String(x.fecha || '').slice(11, 13)) || 0);
          const h0 = periodo === 'todo' && horas.length ? Math.max(0, Math.min(...horas) - 1) : 0;
          for (let h = h0; h <= horaAhora; h++) {
            for (const x of v.filter((y) => y.dia === hoy && (Number(String(y.fecha || '').slice(11, 13)) || 0) === h)) { acum += pesos(x); n += 1; }
            const hh = String(h).padStart(2, '0') + ':00';
            filas.push({ periodo, clave: hh, etiqueta: hh, total_mxn: Math.round(acum * 100) / 100, ventas: n });
          }
        } else {
          for (const d of dias(desde, hoy)) {
            for (const x of v.filter((y) => y.dia === d)) { acum += pesos(x); n += 1; }
            filas.push({ periodo, clave: d, etiqueta: etq(d), total_mxn: Math.round(acum * 100) / 100, ventas: n });
          }
        }
      }
      return filas;
    },
  });

  dash.calc('dinero_por_dia', {
    title: 'Ingresos por día',
    description: 'Lo vendido cada día en pesos (dólares al tipo de cambio del día) y cuántas ventas, de los últimos 30 días o desde la primera venta si fue antes.',
    inputs: ['ventas', 'tipo_cambio'],
    fn: (ventas, tipo_cambio) => {
      const tc = Number(tipo_cambio[0] && tipo_cambio[0].usd_mxn) || 0;
      const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
      const pagadas = ventas.filter((x) => Number(x.n) > 0 && x.estado === 'pagada');
      const pesos = (x) => { const m = String(x.moneda).toUpperCase(); return m === 'USD' ? (Number(x.monto) || 0) * tc : m === 'MXN' ? Number(x.monto) || 0 : 0; };
      const hace29 = new Date(Date.parse(hoy + 'T12:00:00Z') - 29 * 864e5).toISOString().slice(0, 10);
      const primera = pagadas.length ? pagadas.map((x) => x.dia).sort()[0] : hoy;
      const filas = [];
      for (let t = Date.parse((primera < hace29 ? primera : hace29) + 'T12:00:00Z'); t <= Date.parse(hoy + 'T12:00:00Z'); t += 864e5) {
        const dia = new Date(t).toISOString().slice(0, 10);
        const v = pagadas.filter((x) => x.dia === dia);
        filas.push({ dia, total_mxn: Math.round(v.reduce((s, x) => s + pesos(x), 0) * 100) / 100, ventas: v.length });
      }
      return filas;
    },
  });

  dash.calc('por_canal', {
    title: 'Ventas por canal',
    description: 'Por periodo y canal: visitas (evento llegada-<canal>), clics en pagar (checkout-<canal>) y compras pagadas con su canal e ingresos.',
    inputs: ['eventos', 'ventas'],
    fn: (eventos, ventas) => {
      const NOMBRES = { ig: 'Instagram', yt: 'YouTube', fb: 'Facebook', tt: 'TikTok', wa: 'WhatsApp', youtube: 'YouTube', instagram: 'Instagram', tiktok: 'TikTok', whatsapp: 'WhatsApp', facebook: 'Facebook', google: 'Google', x: 'X', linkedin: 'LinkedIn', pinterest: 'Pinterest', reddit: 'Reddit', telegram: 'Telegram', snapchat: 'Snapchat', buscador: 'Otro buscador', correo: 'Correo', twowaves: 'Two Waves', 'otro-sitio': 'Otro sitio', directo: 'Directo' };
      const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
      const desde = (p) => (p === 'hoy' ? hoy : p === 'todo' ? '0000-00-00' : new Date(Date.parse(hoy + 'T12:00:00Z') - (p === '7d' ? 6 : 29) * 864e5).toISOString().slice(0, 10));
      const filas = [];
      for (const periodo of ['hoy', '7d', '30d', 'todo']) {
        const d = desde(periodo), m = new Map();
        const fila = (k) => { const canal = NOMBRES[k] || k; if (!m.has(canal)) m.set(canal, { periodo, canal, visitas: 0, clics: 0, ventas: 0, suma: {} }); return m.get(canal); };
        for (const e of eventos.filter((x) => x.dia >= d)) {
          const ev = String(e.evento || '');
          if (ev.startsWith('llegada-')) fila(ev.slice(8)).visitas += Number(e.total) || 0;
          else if (ev.startsWith('checkout-')) fila(ev.slice(9)).clics += Number(e.total) || 0;
        }
        for (const v of ventas.filter((x) => Number(x.n) > 0 && x.estado === 'pagada' && x.dia >= d)) {
          const f = fila(v.canal || 'directo'); f.ventas += 1;
          const mon = String(v.moneda || '').toUpperCase(); f.suma[mon] = (f.suma[mon] || 0) + (Number(v.monto) || 0);
        }
        for (const f of m.values()) filas.push({ periodo, canal: f.canal, visitas: f.visitas, clics: f.clics, ventas: f.ventas, ingresos: Object.entries(f.suma).filter(([, s]) => s > 0).map(([mon, s]) => '$' + s.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + mon).join(' + ') || '—' });
      }
      return filas.sort((a, b) => b.ventas - a.ventas || b.visitas - a.visitas);
    },
  });

  dash.calc('por_producto', {
    title: 'Ventas por producto',
    description: 'Por periodo: compras pagadas e ingresos (USD y MXN) de cada edición.',
    inputs: ['ventas'],
    fn: (ventas) => {
      const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
      const desde = (p) => (p === 'hoy' ? hoy : p === 'todo' ? '0000-00-00' : new Date(Date.parse(hoy + 'T12:00:00Z') - (p === '7d' ? 6 : 29) * 864e5).toISOString().slice(0, 10));
      const filas = [];
      for (const periodo of ['hoy', '7d', '30d', 'todo']) {
        const d = desde(periodo), m = new Map();
        for (const p of ['Full System', 'LUT Pack', 'Upgrade a Full System']) m.set(p, { periodo, producto: p, ventas: 0, ingresos_usd: 0, ingresos_mxn: 0 });
        for (const v of ventas.filter((x) => Number(x.n) > 0 && x.estado === 'pagada' && x.dia >= d)) {
          const p = v.edicion || '—';
          if (!m.has(p)) m.set(p, { periodo, producto: p, ventas: 0, ingresos_usd: 0, ingresos_mxn: 0 });
          const f = m.get(p); f.ventas += 1;
          const mon = String(v.moneda || '').toUpperCase();
          if (mon === 'USD') f.ingresos_usd = Math.round((f.ingresos_usd + (Number(v.monto) || 0)) * 100) / 100;
          if (mon === 'MXN') f.ingresos_mxn = Math.round((f.ingresos_mxn + (Number(v.monto) || 0)) * 100) / 100;
        }
        filas.push(...m.values());
      }
      return filas;
    },
  });

  dash.calc('cuentas_resumen', {
    title: 'Resumen de cuentas',
    description: 'Cuentas de compradores reales (sin las de prueba), las que entraron en 24 h, descargas totales y alertas.',
    inputs: ['usuarios'],
    fn: (usuarios) => {
      const reales = usuarios.filter((u) => u.tipo !== 'prueba' && u.correo);
      return [{ cuentas: reales.length, activas_24h: reales.filter((u) => Number(u.entradas_24h) > 0).length, descargas: reales.reduce((s, u) => s + (Number(u.descargas_total) || 0), 0), alertas: reales.filter((u) => u.alerta).length }];
    },
  });
})();

(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const NUM = d3.format(',');
  const DINERO = (n) => (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const NOMBRE_P = { hoy: 'Hoy', '7d': 'Últimos 7 días', '30d': 'Últimos 30 días', todo: 'Desde el lanzamiento' };
  const NOMBRE_T = { resumen: 'Resumen', ventas: 'Ventas', trafico: 'Tráfico', cuentas: 'Cuentas', sistema: 'Sistema' };
  const VS_P = { hoy: 'vs ayer', '7d': 'vs 7 días antes', '30d': 'vs 30 días antes', todo: '' };
  const periodo = () => (SX.periodos.includes(dash.params().periodo) ? dash.params().periodo : 'hoy');
  let tab = 'resumen';
  const animadas = new Set(); // gráficas ya animadas desde que se abrió la sección
  const animarSiPrimera = (caja, svg) => { if (!animadas.has(caja.id)) { animadas.add(caja.id); svg.classed('crece', true); } };
  window.SX.reanimar = () => animadas.clear();

  // ── controles ──
  $$('#periodo button').forEach((b) => b.addEventListener('click', () => dash.setParams({ periodo: b.dataset.p })));
  const mostrarTab = (t) => {
    tab = t;
    $$('[data-pagina]').forEach((s) => (s.hidden = s.dataset.pagina !== t));
    $$('.sx-tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === t)));
    $('#periodo').style.visibility = t === 'resumen' || t === 'ventas' ? 'visible' : 'hidden';
    $('#titulo').textContent = NOMBRE_T[t];
    $('#bajada').hidden = t !== 'resumen' && t !== 'ventas';
    $('#sx-menu-txt').textContent = NOMBRE_T[t];
    $('.sx-lado').classList.remove('abierto'); $('#sx-menu').setAttribute('aria-expanded', 'false');
    animadas.clear();
    try { window.scrollTo(0, 0); } catch (e) { /* sin desplazamiento */ }
    dash.setLink(t);
    dibujar();
  };
  $$('.sx-tabs button').forEach((b) => b.addEventListener('click', () => mostrarTab(b.dataset.tab)));
  // menú desplegable (móvil): se abre con el botón y se cierra al elegir, al tocar fuera o con Escape
  const menu = (abrir) => { $('.sx-lado').classList.toggle('abierto', abrir); $('#sx-menu').setAttribute('aria-expanded', String(abrir)); };
  $('#sx-menu').addEventListener('click', (ev) => { ev.stopPropagation(); menu(!$('.sx-lado').classList.contains('abierto')); });
  document.addEventListener('click', (ev) => { if (!ev.target.closest('.sx-lado')) menu(false); });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') menu(false); });

  // ── ayudas de dibujo ──
  const quitarEsqueleto = (el) => el && el.classList.remove('dash-skeleton');
  const celda = (tr, txt, cls) => { const td = document.createElement('td'); if (txt instanceof Node) td.append(txt); else td.textContent = txt == null || txt === '' ? '—' : txt; if (cls) td.className = cls; tr.append(td); return td; };
  const etiqueta = (txt, clase) => { const s = document.createElement('span'); s.className = 'pill ' + (clase || ''); s.textContent = txt; return s; };
  const claseEstado = (e) => (/^(ok|activo|activa|con acceso|pagada|vigente)/i.test(e) ? 'ok' : /(falla|error|sin acceso|bloque|reembols)/i.test(e) ? 'mal' : /(aviso|agotado|prueba|revisar)/i.test(e) ? 'av' : '');
  // bandera (emoji) y nombre en español a partir del código de país de 2 letras
  const bandera = (c) => (/^[A-Z]{2}$/.test(String(c || '')) ? String.fromCodePoint(...[...c].map((l) => 0x1f1a5 + l.charCodeAt(0))) : '');
  let nombresPais; try { nombresPais = new Intl.DisplayNames(['es'], { type: 'region' }); } catch (e) { nombresPais = null; }
  const nombrePais = (c) => { try { return (nombresPais && /^[A-Z]{2}$/.test(c) && nombresPais.of(c)) || c; } catch (e) { return c; } };
  const conBandera = (c, texto) => { const s = document.createElement('span'); const b = bandera(c); if (b) { const i = document.createElement('span'); i.className = 'bandera'; i.setAttribute('aria-hidden', 'true'); i.textContent = b; s.append(i); } s.append(texto == null || texto === '' ? (c || '—') : texto); return s; };
  const NAVEGADORES = { chrome: 'Chrome', crios: 'Chrome (iPhone)', ios: 'Safari (iPhone)', 'ios-webview': 'App en iPhone', safari: 'Safari', instagram: 'Instagram (app)', facebook: 'Facebook (app)', 'edge-chromium': 'Edge', edge: 'Edge', firefox: 'Firefox', fxios: 'Firefox (iPhone)', samsung: 'Samsung Internet', opera: 'Opera', 'chromium-webview': 'App en Android', android: 'Android', tiktok: 'TikTok (app)' };
  const fijarDonde = (el, p) => el.setAttribute('data-where', 'periodo=' + p);
  const hace = (iso) => {
    const ms = Date.now() - Date.parse(iso);
    if (!iso || isNaN(ms)) return '';
    const min = Math.round(ms / 60000);
    return min < 1 ? 'medido ahora' : min < 60 ? `medido hace ${min} min` : `medido hace ${Math.round(min / 60)} h`;
  };

  function tablaSimple(sel, filas, cols, opciones = {}) {
    const tb = $(sel + ' tbody'); tb.replaceChildren();
    const max = opciones.barra ? d3.max(filas, (f) => Number(f[opciones.barra])) || 1 : 0;
    for (const f of filas) {
      const tr = document.createElement('tr'); tr.dataset.key = opciones.clave ? opciones.clave(f) : f[cols[0][0]];
      for (const [c, cls, formato] of cols) {
        const td = celda(tr, formato ? formato(f[c], f) : f[c], cls);
        if (opciones.barra && c === cols[0][0]) { td.classList.add('celda-barra'); const b = document.createElement('span'); b.className = 'b' + (tb.children.length === 0 ? ' primera' : ''); b.style.width = (Number(f[opciones.barra]) / max) * 88 + '%'; td.append(b); }
      }
      tb.append(tr);
    }
  }

  function barras(caja, puntos, { etiqueta: etq, color = '#e8e8e8', apagado = '#3d3d3d', resaltar, alto: altoOpc, formatoY } = {}) {
    caja.replaceChildren();
    const ancho = Math.max(caja.clientWidth, 260), alto = altoOpc || 200, m = { t: 10, r: 0, b: 26, l: 28 };
    if (!puntos.length) { const p = document.createElement('p'); p.className = 'sx-vacio'; p.textContent = 'Aún no hay datos en este periodo.'; caja.append(p); return; }
    caja.style.minHeight = alto + 'px';
    const svg = d3.select(caja).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${ancho} ${alto}`).attr('height', alto);
    const x = d3.scaleBand(puntos.map((d) => d.x), [m.l, ancho - m.r]).padding(0.28);
    const ymax = d3.max(puntos, (d) => d.y) || 1;
    const y = d3.scaleLinear([0, ymax], [alto - m.b, m.t]).nice();
    const ticks = y.ticks(Math.min(4, Math.max(1, Math.ceil(ymax)))).filter((t) => Number.isInteger(t) || ymax > 5);
    svg.append('g').attr('class', 'rejilla').selectAll('line').data(ticks).join('line').attr('x1', m.l).attr('x2', ancho - m.r).attr('y1', y).attr('y2', y);
    svg.append('g').attr('class', 'eje').attr('transform', `translate(${m.l - 6},0)`).call(d3.axisLeft(y).tickValues(ticks).tickFormat(formatoY || d3.format('~s')).tickSize(0)).attr('font-size', null).attr('font-family', null).select('.domain').remove();
    const cada = Math.ceil(puntos.length / Math.max(1, Math.floor((ancho - m.l) / 58)));
    svg.append('g').attr('class', 'eje').attr('transform', `translate(0,${alto - m.b + 6})`).call(d3.axisBottom(x).tickValues(puntos.map((d) => d.x).filter((_, i) => i % cada === 0)).tickFormat((d) => etq(d)).tickSize(0)).attr('font-size', null).attr('font-family', null).select('.domain').remove();
    const bw = Math.min(x.bandwidth(), 34);
    const tip = document.createElement('div'); tip.className = 'sx-tip'; caja.append(tip);
    animarSiPrimera(caja, svg);
    svg.append('g').selectAll('rect').data(puntos).join('rect').attr('class', 'barra')
      .attr('x', (d) => x(d.x) + (x.bandwidth() - bw) / 2).attr('width', bw)
      .attr('y', (d) => y(d.y)).attr('height', (d) => Math.max(0, y(0) - y(d.y))).attr('rx', 3)
      .attr('fill', (d) => (resaltar && resaltar(d) ? color : apagado))
      .on('mousemove', (ev, d) => { const [px, py] = d3.pointer(ev, caja); tip.innerHTML = ''; const a = document.createElement('span'); a.textContent = etq(d.x, true); const b = document.createElement('b'); b.textContent = d.texto || NUM(d.y); tip.append(a, b); tip.style.opacity = 1; tip.style.left = Math.min(px + 12, caja.clientWidth - tip.offsetWidth) + 'px'; tip.style.top = Math.max(0, py - 44) + 'px'; })
      .on('mouseleave', () => (tip.style.opacity = 0));
  }

  // área acumulada con cruz que sigue al cursor; sin cursor marca el último punto
  function areaDinero(caja, puntos) {
    caja.replaceChildren();
    const ancho = Math.max(caja.clientWidth, 260), alto = ancho < 560 ? 200 : 250, m = { t: 12, r: 8, b: 40, l: 44 };
    caja.style.minHeight = alto + 'px';
    if (!puntos.length) { const p = document.createElement('p'); p.className = 'sx-vacio'; p.textContent = 'Aún no hay datos en este periodo.'; caja.append(p); return; }
    const svg = d3.select(caja).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${ancho} ${alto}`).attr('height', alto);
    const x = d3.scalePoint(puntos.map((d) => d.x), [m.l, ancho - m.r]).padding(puntos.length === 1 ? 0.5 : 0);
    const y = d3.scaleLinear([0, d3.max(puntos, (d) => d.y) || 1], [alto - m.b, m.t]).nice(4);
    const ticks = y.ticks(4);
    const def = svg.append('defs').append('linearGradient').attr('id', 'sxDegradado').attr('x1', 0).attr('x2', 0).attr('y1', 0).attr('y2', 1);
    def.append('stop').attr('offset', '0%').attr('stop-color', '#86efac').attr('stop-opacity', 0.24);
    def.append('stop').attr('offset', '100%').attr('stop-color', '#86efac').attr('stop-opacity', 0);
    svg.append('g').attr('class', 'rejilla').selectAll('line').data(ticks).join('line').attr('x1', m.l).attr('x2', ancho - m.r).attr('y1', y).attr('y2', y);
    svg.append('g').attr('class', 'eje').selectAll('text').data(ticks).join('text').attr('x', 0).attr('y', (t) => y(t) + 4).text((t) => (t >= 1000 ? d3.format('~s')(t).replace('k', 'k') : NUM(t)));
    const cada = Math.ceil(puntos.length / Math.max(1, Math.floor((ancho - m.l) / 70)));
    const etqX = svg.append('g').attr('class', 'eje').selectAll('text').data(puntos.filter((_, i) => i % cada === 0 || i === puntos.length - 1 && puntos.length < 3)).join('text')
      .attr('x', (d) => x(d.x)).attr('y', alto - 12).attr('text-anchor', (d, i, n) => (puntos.length > 1 && d === puntos[0] ? 'start' : 'middle')).text((d) => d.etiqueta);
    const curva = d3.curveMonotoneX;
    animarSiPrimera(caja, svg);
    const trazo = svg.append('g').attr('class', 'trazo');
    trazo.append('path').datum(puntos).attr('fill', 'url(#sxDegradado)').attr('d', d3.area().x((d) => x(d.x)).y0(y(0)).y1((d) => y(d.y)).curve(curva));
    trazo.append('path').datum(puntos).attr('fill', 'none').attr('stroke', '#86efac').attr('stroke-width', 1.8).attr('d', d3.line().x((d) => x(d.x)).y((d) => y(d.y)).curve(curva));
    const guia = svg.append('line').attr('stroke', '#f5f5f5').attr('stroke-width', 1).attr('y1', m.t).attr('y2', alto - m.b + 4);
    const punto = svg.append('circle').attr('r', 4.5).attr('fill', '#86efac').attr('stroke', '#171717').attr('stroke-width', 2);
    const tip = document.createElement('div'); tip.className = 'sx-tip'; caja.append(tip);
    const pill = document.createElement('div'); pill.className = 'sx-eje-pill'; caja.append(pill);
    const marcar = (d) => {
      const px = x(d.x), py = y(d.y);
      guia.attr('x1', px).attr('x2', px); punto.attr('cx', px).attr('cy', py);
      tip.replaceChildren();
      const a = document.createElement('span'); a.textContent = d.largo + ' · ' + d.ventas + (d.ventas === 1 ? ' venta' : ' ventas');
      const l = document.createElement('div'); l.className = 'linea'; const i = document.createElement('i'); const t = document.createElement('span'); t.textContent = 'Acumulado'; t.style.display = 'inline'; const b = document.createElement('b'); b.textContent = '$' + DINERO(d.y) + ' MXN'; l.append(i, t, b);
      tip.append(a, l); tip.style.opacity = 1;
      const izq = px + 14 + tip.offsetWidth > caja.clientWidth ? px - 14 - tip.offsetWidth : px + 14;
      tip.style.left = Math.max(0, izq) + 'px'; tip.style.top = Math.max(0, Math.min(py - 20, alto - m.b - tip.offsetHeight)) + 'px';
      pill.textContent = d.etiqueta;
      pill.style.left = Math.min(Math.max(px, pill.offsetWidth / 2), caja.clientWidth - pill.offsetWidth / 2) + 'px';
      const centro = Math.min(Math.max(px, pill.offsetWidth / 2), caja.clientWidth - pill.offsetWidth / 2) * (ancho / caja.clientWidth);
      etqX.attr('opacity', (e) => (Math.abs(x(e.x) - centro) < pill.offsetWidth / 2 + 26 ? 0 : 1));
    };
    const ultimo = puntos[puntos.length - 1];
    marcar(ultimo);
    svg.append('rect').attr('x', m.l).attr('y', 0).attr('width', Math.max(1, ancho - m.l - m.r)).attr('height', alto).attr('fill', 'transparent')
      .on('pointermove', (ev) => { const [px] = d3.pointer(ev); const i = d3.minIndex(puntos, (d) => Math.abs(x(d.x) - px)); marcar(puntos[i]); })
      .on('pointerleave', () => marcar(ultimo));
  }
  const diasEntre = (desde, hasta) => { const out = []; for (let t = Date.parse(desde + 'T12:00:00Z'); t <= Date.parse(hasta + 'T12:00:00Z'); t += 864e5) out.push(new Date(t).toISOString().slice(0, 10)); return out; };
  const etqDia = (d, largo) => { const f = new Date(d + 'T12:00:00Z'); return f.toLocaleDateString('es-MX', largo ? { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' } : { day: 'numeric', month: 'short', timeZone: 'UTC' }); };

  // ── dibujo ──
  function dibujar() {
    const p = periodo();
    $$('#periodo button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.p === p)));
    $$('[data-source="resumen"][data-where]').forEach((el) => fijarDonde(el, p));

    // en vivo
    const vivo = dash.data('en_vivo');
    const fv = vivo.status === 'ok' && vivo.data[0] ? vivo.data[0] : null;
    $$('[data-source="en_vivo"]').forEach((el) => { if (fv && el.dataset.field) el.textContent = NUM(Number(fv[el.dataset.field]) || 0); });
    // personas en el sitio ahora: en vivo desde Supabase (latido de cada página abierta)
    const pr = dash.data('presencia');
    const fp = pr.status === 'ok' && pr.data[0] ? pr.data[0] : null;
    $$('[data-source="presencia"][data-field]').forEach((el) => { el.textContent = fp ? NUM(Number(fp[el.dataset.field]) || 0) : '—'; });
    $('#vivo-actualizar').setAttribute('aria-busy', String(!!pr.refreshing || pr.status === 'loading'));
    if (fp) {
      const n = Number(fp.activos) || 0;
      const hora = String(fp.revisado || '').slice(11, 16);
      $('#vivo-txt').textContent = n === 1 ? 'persona en el sitio' : 'personas en el sitio';
      $('#vivo-hace').textContent = hora ? 'en vivo · ' + hora : 'en vivo';
      $('#n-vivo').textContent = (hora ? 'En vivo a las ' + hora : 'En vivo') + ' · activos en los últimos 2 min';
      $('#n-vivo-r').textContent = hora ? 'Activos en 2 min · ' + hora : 'Activos en los últimos 2 min';
    } else {
      $('#vivo-hace').textContent = ''; $('#n-vivo').textContent = $('#n-vivo-r').textContent = pr.status === 'loading' ? 'Cargando…' : '—';
    }

    // resumen
    const r = dash.data('resumen');
    const fr = r.status === 'ok' ? r.data.find((x) => x.periodo === p) : null;
    $$('[data-source="resumen"][data-field]').forEach((el) => { if (!fr) return;
      const c = el.dataset.field, v = fr[c];
      if (c.startsWith('cambio')) { const ok = typeof v === 'number' && isFinite(v); el.textContent = ok ? (v > 0 ? '+' : '') + d3.format('.1f')(v) + '%' : '—'; el.className = 'cambio ' + (!ok ? 'nada' : v >= 0 ? 'sube' : 'baja'); el.title = ok ? VS_P[p] : ''; return; }
      el.textContent = c.startsWith('ingresos') || c === 'total_mxn' ? DINERO(v) : c === 'conversion' ? d3.format('.1f')(v) : NUM(v); });
    if (fr) {
      const partes = [];
      if (fr.ingresos_usd) partes.push('$' + DINERO(fr.ingresos_usd) + ' USD');
      if (fr.ingresos_mxn) partes.push('$' + DINERO(fr.ingresos_mxn) + ' MXN');
      const pc0 = dash.data('por_canal');
      const top = pc0.status === 'ok' ? pc0.data.filter((x) => x.periodo === p && x.ventas > 0).sort((a, b) => b.ventas - a.ventas)[0] : null;
      const canalTxt = top && fr.ventas ? (top.ventas === fr.ventas ? ` Todas llegaron de ${top.canal}.` : ` ${top.canal} trajo ${top.ventas} de ${fr.ventas}.`) : '';
      $('#bajada').textContent = `${NOMBRE_P[p]}: ${NUM(fr.ventas)} ${fr.ventas === 1 ? 'venta' : 'ventas'} · $${DINERO(fr.total_mxn)} MXN en total · ${NUM(fr.visitantes)} ${fr.visitantes === 1 ? 'visitante' : 'visitantes'}.${canalTxt}`;
      const tcTxt = fr.tipo_cambio ? `dólar a $${d3.format('.2f')(fr.tipo_cambio)}` : 'sin tipo de cambio todavía';
      $('#n-tc').textContent = (partes.length ? partes.join(' + ') + ' · ' : 'Sin ingresos todavía · ') + tcTxt;
      $('#ing-detalle').textContent = $('#n-tc').textContent;
      $('#ing-titulo').textContent = 'Ingresos · ' + NOMBRE_P[p];
      $('#n-visitantes').textContent = p === 'hoy' ? 'En vivo · personas distintas' : 'Personas distintas · Umami, cada hora';
      $('#n-gratis').textContent = fr.gratis ? `${fr.gratis} con código 100%` : (fr.ventas ? 'Todas pagadas' : 'Sin ventas todavía');
      $('#canales-lado').textContent = NOMBRE_P[p];
      $('#embudo-lado').textContent = NOMBRE_P[p];
    }

    if (tab === 'resumen') dibujarResumen(p, fr);
    if (tab === 'ventas') dibujarVentas(p);
    if (tab === 'trafico') dibujarTrafico();
    if (tab === 'cuentas') dibujarCuentas();
    if (tab === 'sistema') dibujarSistema();

    const fechas = ['ventas', 'trafico', 'salud'].map((id) => dash.data(id)).filter((d) => d.status === 'ok');
    $('#pie-act').textContent = 'En vivo cada 20 s · lo demás cada hora' + (fv && hace(fv.revisado) ? ' · tráfico ' + hace(fv.revisado) : '');
    const sa = dash.data('salud'); if (sa.status === 'ok' && sa.data[0]) $('#revision-lado').textContent = 'Revisado ' + (sa.data[0].revisado || '');
  }

  function dibujarResumen(p, fr) {
    // dinero en el tiempo
    const sd = dash.data('serie_dinero');
    if (sd.status === 'ok') {
      const filas = sd.data.filter((x) => x.periodo === p);
      const porHora = filas.length && filas[0].clave.includes(':');
      areaDinero($('#graf-dinero'), filas.map((f) => ({ x: f.clave, y: Number(f.total_mxn) || 0, ventas: Number(f.ventas) || 0, etiqueta: f.etiqueta, largo: porHora ? 'Hasta las ' + f.etiqueta.replace(':00', ':59') : etqDia(f.clave, true) })));
    }
    // embudo
    const caja = $('#embudo-pasos'); caja.replaceChildren();
    if (fr) {
      const pasos = [['Entraron al sitio', fr.visitantes], ['Clic en pagar', fr.clics], ['Pagaron', fr.ventas]];
      const max = Math.max(1, pasos[0][1], pasos[1][1], pasos[2][1]);
      const perdidas = pasos.slice(1).map((s, i) => (pasos[i][1] && s[1] < pasos[i][1] ? 1 - s[1] / pasos[i][1] : 0));
      const peor = perdidas.indexOf(Math.max(...perdidas));
      pasos.forEach(([nombre, n], i) => {
        const d = document.createElement('div'); d.className = 'sx-paso' + (i === 2 ? ' final' : '');
        const fila = document.createElement('div'); fila.className = 'fila';
        const a = document.createElement('span'); a.textContent = nombre; const b = document.createElement('b'); b.textContent = NUM(n); fila.append(a, b);
        const pista = document.createElement('div'); pista.className = 'pista'; const ll = document.createElement('div'); ll.className = 'lleno'; ll.style.width = Math.max(n ? 2 : 0, (n / max) * 100) + '%'; pista.append(ll);
        d.append(fila, pista);
        if (i > 0) { const pe = document.createElement('div'); const prev = pasos[i - 1][1]; pe.className = 'perdida' + (i - 1 === peor && perdidas[peor] > 0 ? ' mayor' : ''); pe.textContent = !prev ? 'Sin datos del paso anterior' : n > prev ? 'Más clics que personas: algunas dieron clic más de una vez' : `${d3.format('.0%')(1 - n / prev)} no siguió a este paso`; d.append(pe); }
        caja.append(d);
      });
    }
    // canales
    const pc = dash.data('por_canal');
    const filasC = pc.status === 'ok' ? pc.data.filter((x) => x.periodo === p) : [];
    tablaSimple('#canales', filasC, [['canal', 'id'], ['visitas', 'r', NUM], ['clics', 'r', NUM], ['ventas', 'r id', NUM], ['ingresos', 'r ocultable gris']], { clave: (f) => f.periodo + ',' + encodeURIComponent(f.canal), barra: 'visitas' });
    $('#canales-vacio').hidden = !(pc.status === 'ok' && !filasC.length);
    const sum = (k) => filasC.reduce((s, f) => s + (Number(f[k]) || 0), 0);
    $('#canales-total').textContent = filasC.length ? `En total: ${NUM(sum('visitas'))} visitas · ${NUM(sum('clics'))} clics en pagar · ${NUM(sum('ventas'))} ${sum('ventas') === 1 ? 'venta' : 'ventas'} · ${filasC.length} ${filasC.length === 1 ? 'canal' : 'canales'}` : '';
    // últimas ventas
    ultimasVentas(p);
  }

  function ultimasVentas(p) {
    const v = dash.data('ventas');
    const d = SX.desde(p);
    const filas = v.status === 'ok' ? v.data.filter((x) => Number(x.n) > 0 && x.estado === 'pagada' && x.dia >= d).reverse().slice(0, 8) : [];
    const tb = $('#ultimas tbody'); tb.replaceChildren();
    for (const f of filas) {
      const tr = document.createElement('tr'); tr.dataset.key = f.n;
      celda(tr, f.fecha, 'gris'); celda(tr, f.edicion, 'id'); const tdm = celda(tr, DINERO(f.monto), 'r id'); const sm = document.createElement('small'); sm.className = 'solo-movil'; sm.textContent = f.moneda; tdm.append(sm); celda(tr, f.moneda, 'tenue ocultable');
      celda(tr, f.fuente); celda(tr, f.pais ? conBandera(f.pais) : '—', 'ocultable gris');
      tb.append(tr);
    }
    $('#ultimas-vacio').hidden = !(v.status === 'ok' && !filas.length);
  }

  function ventasTabla(sel, p, limite, conAcceso) {
    const vs = dash.data('ventas_stripe');
    const d = SX.desde(p);
    const filas = vs.status === 'ok' ? vs.data.filter((x) => Number(x.n) > 0 && x.tipo !== 'prueba' && x.dia >= d).reverse().slice(0, limite || 9999) : [];
    const tb = $(sel + ' tbody'); tb.replaceChildren();
    for (const f of filas) {
      const tr = document.createElement('tr'); tr.dataset.key = f.n;
      celda(tr, f.fecha, 'gris'); celda(tr, f.producto, 'id'); const tdm = celda(tr, DINERO(f.monto), 'r id'); const sm = document.createElement('small'); sm.className = 'solo-movil'; sm.textContent = f.moneda; tdm.append(sm); celda(tr, f.moneda, 'tenue ocultable');
      celda(tr, f.codigo ? etiqueta(f.codigo) : '—', conAcceso ? '' : 'ocultable'); celda(tr, f.fuente); celda(tr, f.pais ? conBandera(f.pais) : '—', conAcceso ? 'tenue' : 'ocultable gris');
      if (conAcceso) celda(tr, etiqueta(f.acceso, claseEstado(f.acceso)));
      tb.append(tr);
    }
    const vacio = $(sel === '#ultimas' ? '#ultimas-vacio' : '#todas-vacio');
    if (vacio) vacio.hidden = !(vs.status === 'ok' && !filas.length);
  }

  function dibujarVentas(p) {
    // ingresos por día (verde): hoy muestra la última semana con hoy encendido
    const dd = dash.data('dinero_por_dia');
    if (dd.status === 'ok') {
      const hoyD = SX.hoy();
      const primera = (dd.data.find((x) => Number(x.ventas) > 0) || { dia: hoyD }).dia;
      const desdeD = p === 'todo' ? (primera < SX.desde('7d') ? primera : SX.desde('7d')) : SX.desde(p === 'hoy' ? '7d' : p);
      const enPeriodo = p === 'hoy' ? (d) => d.x === hoyD : p === 'todo' ? (d) => d.x >= primera : () => true;
      barras($('#graf-ingresos'), dd.data.filter((x) => x.dia >= desdeD).map((x) => ({ x: x.dia, y: Number(x.total_mxn) || 0, texto: `$${DINERO(x.total_mxn)} MXN · ${x.ventas} ${Number(x.ventas) === 1 ? 'venta' : 'ventas'}` })),
        { etiqueta: etqDia, color: '#86efac', apagado: '#2c4434', resaltar: enPeriodo, alto: 220, formatoY: (t) => '$' + d3.format('~s')(t) });
    }
    const v = dash.data('ventas');
    const hoy = SX.hoy();
    const desde = p === 'hoy' ? SX.desde('7d') : p === 'todo' ? null : SX.desde(p);
    if (v.status === 'ok') {
      const reales = v.data.filter((x) => Number(x.n) > 0 && x.estado === 'pagada');
      const inicio = desde || (reales.length ? d3.min(reales, (x) => x.dia) : hoy);
      const porDia = d3.rollup(reales, (g) => g.length, (x) => x.dia);
      const puntos = diasEntre(inicio, hoy).map((dia) => ({ x: dia, y: porDia.get(dia) || 0, texto: `${porDia.get(dia) || 0} ${porDia.get(dia) === 1 ? 'venta' : 'ventas'}` }));
      barras($('#graf-ventas'), puntos, { etiqueta: etqDia, resaltar: (d) => d.x === hoy || p !== 'hoy' });
    }
    const pp = dash.data('por_producto');
    const filasP = pp.status === 'ok' ? pp.data.filter((x) => x.periodo === p) : [];
    tablaSimple('#productos', filasP, [['producto', 'id'], ['ventas', 'r', NUM], ['ingresos_usd', 'r', DINERO], ['ingresos_mxn', 'r', DINERO]], { clave: (f) => f.periodo + ',' + encodeURIComponent(f.producto) });
    const sp = (k) => filasP.reduce((s, f) => s + (Number(f[k]) || 0), 0);
    $('#productos-total').textContent = `En total: ${NUM(sp('ventas'))} ${sp('ventas') === 1 ? 'venta' : 'ventas'} · $${DINERO(sp('ingresos_usd'))} USD · $${DINERO(sp('ingresos_mxn'))} MXN`;
    const cg = dash.data('codigos');
    if (cg.status === 'ok') {
      const tb = $('#codigos tbody'); tb.replaceChildren();
      for (const f of cg.data.filter((x) => x.codigo && x.estado !== 'desactivado' && x.tipo !== 'prueba')) {
        const tr = document.createElement('tr'); tr.dataset.key = f.codigo;
        celda(tr, f.codigo, 'id'); celda(tr, f.descuento); celda(tr, NUM(Number(f.usados) || 0), 'r'); celda(tr, f.limite, 'r tenue'); celda(tr, f.restantes, 'r'); celda(tr, etiqueta(f.estado, claseEstado(f.estado)));
        tb.append(tr);
      }
    }
    ventasTabla('#todas-ventas', p, 0, true);
  }

  const CANALES_VIVO = { youtube: 'YouTube', instagram: 'Instagram', tiktok: 'TikTok', whatsapp: 'WhatsApp', facebook: 'Facebook', google: 'Google', x: 'X', linkedin: 'LinkedIn', pinterest: 'Pinterest', reddit: 'Reddit', telegram: 'Telegram', snapchat: 'Snapchat', buscador: 'Otro buscador', correo: 'Correo', twowaves: 'Two Waves', 'otro-sitio': 'Otro sitio', directo: 'Directo' };
  const DISPOSITIVOS_VIVO = { celular: 'Celular', computadora: 'Computadora', tablet: 'Tablet' };
  function dibujarVivoHoy() {
    const v = dash.data('vivo_hoy');
    const filas = v.status === 'ok' ? v.data.filter((x) => Number(x.visitantes) > 0) : [];
    const clave = (f) => encodeURIComponent(f.tipo) + ',' + encodeURIComponent(f.clave);
    tablaSimple('#vivo-paises', filas.filter((x) => x.tipo === 'pais'), [['clave', 'id', (c) => (c ? conBandera(c, nombrePais(c)) : 'Sin dato')], ['visitantes', 'r id', NUM]], { barra: 'visitantes', clave });
    tablaSimple('#vivo-canales', filas.filter((x) => x.tipo === 'canal'), [['clave', 'id', (c) => (c ? CANALES_VIVO[c] || c[0].toUpperCase() + c.slice(1) : 'Sin dato')], ['visitantes', 'r id', NUM]], { barra: 'visitantes', clave });
    tablaSimple('#vivo-dispositivos', filas.filter((x) => x.tipo === 'dispositivo'), [['clave', 'id', (c) => DISPOSITIVOS_VIVO[c] || 'Sin dato'], ['visitantes', 'r id', NUM]], { barra: 'visitantes', clave });
    $('#vivo-vacio').hidden = !(v.status === 'ok' && !filas.length);
    const pr = dash.data('presencia');
    const hora = pr.status === 'ok' && pr.data[0] ? String(pr.data[0].revisado || '').slice(11, 16) : '';
    $('#hoy-vivo-lado').textContent = hora ? 'En vivo · ' + hora : 'Contador propio';
  }

  function dibujarTrafico() {
    dibujarVivoHoy();
    const t = dash.data('trafico');
    if (t.status === 'ok') {
      const filas = t.data.filter((x) => x.dia && x.dia !== '—');
      const hoy = SX.hoy();
      const inicio = filas.length ? d3.min(filas, (x) => x.dia) : hoy;
      const m = new Map(filas.map((x) => [x.dia, Number(x.visitantes) || 0]));
      const dias = diasEntre(inicio < SX.desde('7d') ? inicio : SX.desde('7d'), hoy);
      barras($('#graf-trafico'), dias.map((dia) => ({ x: dia, y: m.get(dia) || 0, texto: `${NUM(m.get(dia) || 0)} visitantes` })), { etiqueta: etqDia, resaltar: (d) => d.x === hoy, alto: 170 });
    }
    for (const [id, col, val] of [['fuentes', 'fuente', 'visitantes'], ['paginas', 'pagina', 'vistas'], ['dispositivos', 'dispositivo', 'visitantes'], ['sistemas', 'sistema', 'visitantes']]) {
      const d = dash.data(id);
      tablaSimple('#' + id, d.status === 'ok' ? d.data.filter((x) => Number(x[val]) > 0) : [], [[col, ''], [val, 'r id', NUM]], { barra: val });
    }
    const nv = dash.data('navegadores');
    tablaSimple('#navegadores', nv.status === 'ok' ? nv.data.filter((x) => Number(x.visitantes) > 0) : [], [['navegador', '', (v) => NAVEGADORES[v] || (v ? v[0].toUpperCase() + v.slice(1) : '—')], ['visitantes', 'r id', NUM]], { barra: 'visitantes' });
    // países con bandera y nombre en español
    const ps = dash.data('paises');
    const filasP = ps.status === 'ok' ? ps.data.filter((x) => Number(x.visitantes) > 0) : [];
    tablaSimple('#paises', filasP, [['pais', 'id', (v) => conBandera(v, nombrePais(v))], ['visitantes', 'r id', NUM]], { barra: 'visitantes' });
    const cd = dash.data('ciudades');
    tablaSimple('#ciudades', cd.status === 'ok' ? cd.data.filter((x) => Number(x.visitantes) > 0) : [], [['ciudad', '', (v, f) => conBandera(f.pais, v)], ['visitantes', 'r id', NUM]], { barra: 'visitantes', clave: (f) => encodeURIComponent(f.ciudad) + ',' + encodeURIComponent(f.pais) });
  }

  function dibujarCuentas() {
    const cr = dash.data('cuentas_resumen');
    $$('[data-source="cuentas_resumen"]').forEach((el) => { if (cr.status === 'ok' && cr.data[0]) el.textContent = NUM(cr.data[0][el.dataset.field]); });
    const u = dash.data('usuarios');
    if (u.status !== 'ok') return;
    const tb = $('#tabla-cuentas tbody'); tb.replaceChildren();
    for (const f of u.data.filter((x) => x.correo && x.tipo !== 'prueba')) {
      const tr = document.createElement('tr'); tr.dataset.key = f.correo;
      celda(tr, f.correo, 'id'); celda(tr, f.compro);
      celda(tr, f.ultima_entrada, 'ocultable gris'); celda(tr, NUM(Number(f.entradas_24h) || 0), 'r'); celda(tr, NUM(Number(f.descargas_total) || 0), 'r');
      celda(tr, f.alerta ? etiqueta(f.alerta, 'mal') : '—', 'ocultable');
      tb.append(tr);
    }
  }

  function dibujarSistema() {
    const s = dash.data('salud');
    if (s.status === 'ok') {
      const filas = s.data.filter((x) => x.punto);
      const fallas = filas.filter((x) => x.estado === 'falla'), avisos = filas.filter((x) => x.estado === 'aviso');
      const g = $('#estado-general');
      $('.dot', g).className = 'dot ' + (fallas.length ? 'mal' : avisos.length ? 'av' : 'ok');
      $('#estado-texto').textContent = fallas.length ? `${fallas.length} ${fallas.length === 1 ? 'cosa falla' : 'cosas fallan'}: ${fallas.map((x) => x.punto).join(', ')}` : avisos.length ? `Todo funciona · ${avisos.length} ${avisos.length === 1 ? 'aviso' : 'avisos'} para revisar` : `Todo funciona · ${filas.length} puntos revisados`;
      const tb = $('#revision tbody'); tb.replaceChildren();
      for (const f of [...filas].sort((a, b) => ({ falla: 0, aviso: 1 }[a.estado] ?? 2) - ({ falla: 0, aviso: 1 }[b.estado] ?? 2))) {
        const tr = document.createElement('tr'); tr.dataset.key = encodeURIComponent(f.area) + ',' + encodeURIComponent(f.punto);
        celda(tr, f.area, 'gris'); celda(tr, f.punto, 'id'); celda(tr, etiqueta(f.estado, claseEstado(f.estado))); celda(tr, f.detalle, 'ocultable gris');
        tb.append(tr);
      }
    }
    const rs = dash.data('respaldos');
    if (rs.status === 'ok') {
      const tb = $('#respaldos tbody'); tb.replaceChildren();
      for (const f of rs.data.filter((x) => x.respaldo)) {
        const tr = document.createElement('tr'); tr.dataset.key = f.respaldo;
        celda(tr, f.respaldo, 'id'); celda(tr, f.donde, 'ocultable gris'); celda(tr, f.ultimo); celda(tr, f.guarda, 'ocultable gris'); celda(tr, etiqueta(f.estado, claseEstado(f.estado)));
        tb.append(tr);
      }
    }
  }

  $('#vivo-actualizar').addEventListener('click', () => { dash.refresh('presencia'); dash.refresh('ventas'); });

  // pestaña desde el link (#ventas, #trafico…) y redibujo con cada cambio de datos, filtro o ancho
  const inicial = location.hash.slice(1);
  dash.onData(dibujar);
  mostrarTab(['resumen', 'ventas', 'trafico', 'cuentas', 'sistema'].includes(inicial) ? inicial : 'resumen');
})();
