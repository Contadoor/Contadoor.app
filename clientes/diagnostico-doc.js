/* ============================================================
   clientes/diagnostico-doc.js — «Tu diagnóstico "Aquí partimos"» (24-11-2026): MODELO y DOCUMENTO (sin DOM, sin red).
   · modelo(datos, extra) arma el contenido DIAG_V1 a partir de lo que entregan las RPC (diag_datos_cliente / diag_datos_prospecto,
     más sii_levantamiento_iva y sii_historial_anual si están disponibles). Es lo que se guarda tal cual con diag_emitir.
   · documento(modelo, opciones) devuelve el HTML A4 imprimible (Guardar como PDF) con la marca de la propuesta formal aprobada:
     portada con franja oscura y logo WHITE, interiores claros con logo GLOSSY, morado #924893, Montserrat + Inter, sin emojis.
   · Reglas: informe CONTABLE (no «tributario»); al cliente «nuestros servicios» (nunca la otra palabra); valores exentos de IVA, en UF;
     toda cifra que no viene confirmada del SII o que es estimación va marcada «a confirmar»; firma Contadoor + analista a cargo.
   · Todo dato externo pasa por esc(). No calcula impuestos: solo cuenta y suma lo que entregó el servidor.
   Uso: GestoorDiagDoc.modelo(datos, {liva, historial, ajustes, hoy}) · GestoorDiagDoc.documento(modelo, {logoBlanco, logoColor})
   ============================================================ */
(function (raiz) {
  'use strict';
  var MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var MES3 = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  var TITULO = 'Tu diagnóstico "Aquí partimos"';
  var PIE = 'Asesorías Contadoor Ltda. · General Ordóñez 155, of. 604, Maipú · contadoor.cl';
  var ESTADOS = { bien: 'Bien', revisar: 'Revisar', urgente: 'Urgente', confirmar: 'A confirmar' };
  var PLAN_NOMBRE = { cumplimiento: 'Cumplimiento', asesoria: 'Contadoor PRO', pro: 'Contadoor PRO', estrategico: 'Contadoor Estratégico' };

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function num(v) { return v == null || v === '' || isNaN(Number(v)) ? null : Number(v); }
  function pesos(v) { var n = num(v); return n == null ? '—' : (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString('es-CL'); }
  function uf(v) { var n = num(v); return n == null ? '—' : n.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' UF'; }
  function fechaLarga(f) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(f || '')); return m ? Number(m[3]) + ' de ' + MES[Number(m[2]) - 1] + ' de ' + m[1] : ''; }
  function mesLargo(p) { p = String(p || ''); return p.length === 6 ? MES[Number(p.slice(4)) - 1] + ' ' + p.slice(0, 4) : p; }
  function plural(n, s, p) { return n + ' ' + (n === 1 ? s : p); }
  function hoyISO(h) { var d = h ? new Date(h) : new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function peor(a, b) { var o = { bien: 0, confirmar: 1, revisar: 2, urgente: 3 }; return (o[b] || 0) > (o[a] || 0) ? b : a; }
  function r2(n) { return Math.round(n * 100) / 100; }

  // ── Áreas del semáforo (cada una con estado, frase corta y si está confirmada) ──
  function areaF29(f) {
    if (!f || !f.meses) return { area: 'f29', titulo: 'Declaraciones de IVA (F29)', estado: 'confirmar', texto: 'Se revisa al conectar el SII.' };
    var t = f.totales || {}, e = 'bien', p = [];
    if (t.no_declarados > 0) { e = 'urgente'; p.push(plural(t.no_declarados, 'F29 sin declarar', 'F29 sin declarar')); }
    if (t.observados > 0) { e = 'urgente'; p.push(plural(t.observados, 'F29 observado por el SII', 'F29 observados por el SII')); }
    if (t.en_revision > 0) { e = peor(e, 'revisar'); p.push(plural(t.en_revision, 'F29 en revisión', 'F29 en revisión')); }
    if (t.sin_dato > 0 || !f.lista_completa) { e = peor(e, 'revisar'); p.push('lista del SII incompleta: a confirmar'); }
    return { area: 'f29', titulo: 'Declaraciones de IVA (F29)', estado: e, texto: p.length ? p.join(' · ') : 'Todos los F29 de los últimos 6 años están declarados.' };
  }
  function resumenLiva(l) {
    if (!l || !l.totales) return null;
    var pe = l.totales.por_estado || {}, est = l.estimacion || {}, K = est.conocido || {}, P = est.provisional || {}, X = est.no_calculable || {};
    var dif = (pe.diferencia || 0) + (pe.diferencia_preliminar || 0) + (pe.no_declarado || 0);
    return { desde: l.desde, hasta: l.hasta, meses: l.totales.meses || 0, con_diferencia: dif, calzan: pe.calza || 0,
      provisionales: (pe.coincidencia_provisional || 0) + (pe.diferencia_preliminar || 0) + (Number(l.totales.condicionados) || 0),
      sin_datos: (pe.sin_datos || 0) + (pe.f29_sin_montos || 0),
      impuesto: num(est.impuesto), reajuste: (num(K.reajuste) || 0) + (num(P.reajuste) || 0), intereses: (num(K.intereses) || 0) + (num(P.intereses) || 0),
      multa: (num(K.multa) || 0) + (num(P.multa) || 0), total: (num(K.total) || 0) + (num(P.total) || 0), meses_no_calculables: X.meses || 0 };
  }
  function areaLiva(L, puede) {
    if (!L) return { area: 'iva', titulo: 'Cruce de IVA con el SII', estado: 'confirmar', texto: puede === false ? 'Lo revisa el analista contable a cargo.' : 'Se calcula al conectar el SII.' };
    if (L.con_diferencia > 0) return { area: 'iva', titulo: 'Cruce de IVA con el SII', estado: 'urgente', texto: plural(L.con_diferencia, 'mes con diferencias', 'meses con diferencias') + ' entre lo declarado y lo registrado en el SII.' };
    if (L.provisionales > 0 || L.sin_datos > 0) return { area: 'iva', titulo: 'Cruce de IVA con el SII', estado: 'revisar', texto: 'Sin diferencias confirmadas; hay meses por completar.' };
    return { area: 'iva', titulo: 'Cruce de IVA con el SII', estado: 'bien', texto: 'Lo declarado calza con lo registrado en el SII.' };
  }
  function areaF22(f) {
    if (!f || !f.anios) return { area: 'f22', titulo: 'Renta (F22)', estado: 'confirmar', texto: 'Se revisa al conectar el SII.' };
    var obs = f.anios.filter(function (a) { return a.estado === 'observado'; }), sin = f.anios.filter(function (a) { return a.estado === 'sin_declaracion'; }),
        sd = f.anios.filter(function (a) { return a.estado === 'sin_dato'; }), e = 'bien', p = [];
    if (obs.length) { e = 'urgente'; p.push(plural(obs.length, 'año con observaciones', 'años con observaciones')); }
    if (sin.length) { e = peor(e, 'revisar'); p.push(plural(sin.length, 'año sin declaración encontrada', 'años sin declaración encontrada') + ' (a confirmar)'); }
    if (sd.length) { e = peor(e, 'revisar'); p.push('información incompleta'); }
    return { area: 'f22', titulo: 'Renta (F22)', estado: e, texto: p.length ? p.join(' · ') : 'Las Operaciones Renta de los últimos 6 años no tienen observaciones.' };
  }
  function areaSii(d) {
    if (!d.cartas && !d.cumplimiento) return { area: 'sii', titulo: 'Cartas, alertas y notificaciones del SII', estado: 'confirmar', texto: 'Se revisa al conectar el SII.' };
    var c = d.cumplimiento, items = (d.cartas && d.cartas.items) || [], n = items.filter(function (k) { return k.categoria === 'notificacion'; });
    if (c && c.cumple === false) return { area: 'sii', titulo: 'Cartas, alertas y notificaciones del SII', estado: 'urgente', texto: 'El SII informa que la empresa no cumple sus obligaciones' + (n.length ? ' y hay ' + plural(n.length, 'notificación', 'notificaciones') : '') + '.' };
    if (n.length) return { area: 'sii', titulo: 'Cartas, alertas y notificaciones del SII', estado: 'urgente', texto: plural(n.length, 'notificación vigente', 'notificaciones vigentes') + ' del SII.' };
    if (items.length) return { area: 'sii', titulo: 'Cartas, alertas y notificaciones del SII', estado: 'revisar', texto: plural(items.length, 'carta vigente', 'cartas vigentes') + ' por revisar.' };
    return { area: 'sii', titulo: 'Cartas, alertas y notificaciones del SII', estado: 'bien', texto: 'Sin cartas ni notificaciones vigentes.' };
  }
  function areaRcv(r) {
    if (!r) return { area: 'rcv', titulo: 'Compras y ventas por resolver', estado: 'confirmar', texto: 'Se revisa al conectar el SII.' };
    var p = (r.compras_pendientes || []).reduce(function (s, x) { return s + (x.documentos || 0); }, 0),
        rc = (r.compras_reclamadas || []).reduce(function (s, x) { return s + (x.documentos || 0); }, 0),
        rv = Number((r.ventas_reclamadas || {}).documentos) || 0, t = [];
    if (p) t.push(plural(p, 'compra pendiente', 'compras pendientes') + ' de aceptar o reclamar');
    if (rc) t.push(plural(rc, 'compra reclamada', 'compras reclamadas'));
    if (rv) t.push(plural(rv, 'venta reclamada', 'ventas reclamadas') + ' por clientes');
    return { area: 'rcv', titulo: 'Compras y ventas por resolver', estado: t.length ? 'revisar' : 'bien', texto: t.length ? t.join(' · ') + ' (últimos 12 meses).' : 'Sin documentos pendientes en los últimos 12 meses.' };
  }
  function resumenPagos(h) {
    if (!h || !h.meses) return null;
    var c = { pagado: 0, postergado: 0, pendiente: 0, girado: 0, nada_que_pagar: 0, sin_informacion: 0 }, meses = [];
    h.meses.forEach(function (m) { if (m.futuro) return; var e = (m.pago && m.pago.estado) || 'sin_informacion'; c[e] = (c[e] || 0) + 1;
      meses.push({ periodo: m.periodo, estado: e, total: m.f29 ? m.f29.total_a_pagar : null }); });
    return { anio: h.anio, conteo: c, meses: meses };
  }
  function areaPagos(P, estadoHist) {
    if (!P) return { area: 'pagos', titulo: 'Pagos del año', estado: 'confirmar', texto: estadoHist === 'no_instalado' ? 'El historial anual de pagos se agrega en la próxima versión.' : 'Lo revisa el analista contable a cargo.' };
    var c = P.conteo;
    if (c.pendiente || c.girado) return { area: 'pagos', titulo: 'Pagos del año', estado: 'urgente', texto: [c.pendiente ? plural(c.pendiente, 'mes pendiente de pago', 'meses pendientes de pago') : '', c.girado ? plural(c.girado, 'mes girado por el SII', 'meses girados por el SII') : ''].filter(Boolean).join(' · ') + '.' };
    if (c.sin_informacion || c.postergado) return { area: 'pagos', titulo: 'Pagos del año', estado: 'revisar', texto: [c.postergado ? plural(c.postergado, 'mes postergado', 'meses postergados') : '', c.sin_informacion ? plural(c.sin_informacion, 'mes sin registro de pago', 'meses sin registro de pago') + ' (a confirmar)' : ''].filter(Boolean).join(' · ') + '.' };
    return { area: 'pagos', titulo: 'Pagos del año', estado: 'bien', texto: 'Los impuestos del año están pagados.' };
  }

  // ── Propuesta por defecto (editable antes de emitir). Valores en UF; lo que no tiene precio fijo queda «a confirmar». ──
  function precioF29(cat) {
    var s = ((cat && cat.servicios) || []).filter(function (x) { return /regularizaci.n f29/i.test(x.nombre || ''); })[0], ufv = cat && cat.uf && num(cat.uf.valor);
    if (!s || num(s.precio) == null) return null;
    if (String(s.moneda).toUpperCase() === 'UF') return num(s.precio);
    return ufv ? r2(num(s.precio) / ufv) : null;
  }
  function propuestaBase(d, L) {
    var cat = d.catalogo || {}, it = [], pf = precioF29(cat);
    if (d.tipo === 'cliente') {
      var t = (d.f29 && d.f29.totales) || {}, rect = L ? L.con_diferencia - 0 : 0;
      if (t.no_declarados > 0) it.push({ glosa: 'Declaración de F29 sin declarar', cantidad: t.no_declarados, valor_uf: pf, a_confirmar: true });
      var nRect = Math.max(rect - (t.no_declarados || 0), 0) + (t.observados || 0);
      if (nRect > 0) it.push({ glosa: 'Rectificación de F29 con diferencias u observados', cantidad: nRect, valor_uf: pf, a_confirmar: true });
      ((d.f22 && d.f22.anios) || []).filter(function (a) { return a.estado === 'observado' || a.estado === 'sin_declaracion'; }).forEach(function (a) {
        it.push({ glosa: 'Regularización Operación Renta ' + a.anio_tributario, cantidad: 1, valor_uf: null, a_confirmar: true });
      });
    }
    var plan = null, o = d.onboarding, k = d.cotizacion;
    if (o && o.plan) plan = { codigo: o.plan, valor_uf: num(o.valor_uf), trabajadores: null, valor_trab_uf: o.gestion_laboral ? num(o.valor_trab_uf) : null };
    else if (k && k.plan_codigo && String(k.moneda).toUpperCase() === 'UF') plan = { codigo: k.plan_codigo, valor_uf: num(k.monto_final), trabajadores: k.trabajadores || null, valor_trab_uf: null };
    else {
      var cod = (d.cliente && d.cliente.plan) || (d.prospecto && d.prospecto.plan_interes) || null, pl = (cat.planes || []).filter(function (p) { return p.codigo === cod || (cod === 'pro' && p.codigo === 'asesoria'); })[0];
      if (pl) plan = { codigo: pl.codigo, valor_uf: pl.por_propuesta ? null : num(pl.precio_uf), trabajadores: null, valor_trab_uf: null };
    }
    return { items: it, plan: plan };
  }

  /** Arma el modelo DIAG_V1 (lo que se imprime y se guarda). extra = { liva, historial, estadoLiva, estadoHist, ajustes, hoy } */
  function modelo(d, extra) {
    extra = extra || {}; var aj = extra.ajustes || {}, cli = d.tipo === 'cliente';
    var L = cli ? resumenLiva(extra.liva) : null, P = cli ? resumenPagos(extra.historial) : null;
    var areas = cli ? [areaF29(d.f29), areaLiva(L, d.actor && d.actor.puede_levantamiento), areaF22(d.f22), areaSii(d), areaRcv(d.rcv), areaPagos(P, extra.estadoHist)]
                    : ['f29', 'iva', 'f22', 'sii', 'rcv', 'pagos'].map(function (a) { return { area: a, titulo: { f29: 'Declaraciones de IVA (F29)', iva: 'Cruce de IVA con el SII', f22: 'Renta (F22)', sii: 'Cartas, alertas y notificaciones del SII', rcv: 'Compras y ventas por resolver', pagos: 'Pagos del año' }[a], estado: 'confirmar', texto: 'Se revisa con tu acceso al SII al iniciar el servicio.' }; });
    areas.forEach(function (a) { var o = aj.semaforo && aj.semaforo[a.area]; if (o && ESTADOS[o]) { a.estado = o; a.ajustado = true; } });
    var base = propuestaBase(d, L), items = Array.isArray(aj.items) ? aj.items : base.items, plan = aj.plan !== undefined ? aj.plan : base.plan;
    var ufv = d.catalogo && d.catalogo.uf ? num(d.catalogo.uf.valor) : null;
    var totUf = items.reduce(function (s, x) { var v = num(x.valor_uf), q = num(x.cantidad) || 0; return v == null ? s : s + v * q; }, 0);
    var sinValor = items.filter(function (x) { return num(x.valor_uf) == null; }).length;
    var emp = cli ? d.cliente : { razon_social: (d.prospecto && d.prospecto.empresa) || (d.prospecto && d.prospecto.atencion) || 'Prospecto', rut: null };
    var eq = d.equipo || {};
    var secciones = [{ id: 'resumen', areas: areas }];
    if (cli) {
      secciones.push({ id: 'f29', datos: d.f29 || null });
      secciones.push({ id: 'iva', datos: L, estado: L ? 'ok' : (d.actor && d.actor.puede_levantamiento === false ? 'sin_permiso' : (extra.estadoLiva || 'sin_datos')) });
      secciones.push({ id: 'f22', datos: d.f22 || null });
      secciones.push({ id: 'sii', cumplimiento: d.cumplimiento || null, cartas: d.cartas || null });
      secciones.push({ id: 'rcv', datos: d.rcv || null });
      secciones.push({ id: 'pagos', datos: P, estado: P ? 'ok' : (extra.estadoHist || 'sin_datos') });
    }
    secciones.push({ id: 'propuesta', items: items, plan: plan, total_uf: r2(totUf), items_sin_valor: sinValor });
    var n_conf = areas.filter(function (a) { return a.estado === 'confirmar'; }).length + items.filter(function (x) { return x.a_confirmar; }).length
               + (L ? 1 : 0);   // la estimación de multas e intereses siempre es preliminar
    return {
      formato: 'DIAG_V1', tipo: d.tipo, titulo: TITULO, fecha: hoyISO(extra.hoy), datos_al: d.datos_al || null,
      conexion: (d.conexion && d.conexion.estado) || 'sin_conexion',
      empresa: { razon_social: emp.razon_social, rut: emp.rut || null, giro: emp.giro || null, regimen: emp.regimen || null },
      atencion: cli ? null : (d.prospecto && d.prospecto.atencion) || null,
      equipo: { contable: eq.contable ? { nombre: eq.contable.nombre, cargo: eq.contable.cargo || 'Asesor(a) Contable' } : null,
                rrhh: eq.rrhh ? { nombre: eq.rrhh.nombre, cargo: eq.rrhh.cargo || 'Asesor(a) de Remuneraciones' } : null },
      preparado_por: d.actor ? d.actor.nombre : null,
      uf: ufv ? { valor: ufv, periodo: d.catalogo.uf.periodo } : null,
      notas: String(aj.notas || '').slice(0, 3000),
      cita: String(aj.cita || '').slice(0, 300),
      a_confirmar: n_conf,
      secciones: secciones
    };
  }

  // ═════════════ DOCUMENTO (HTML A4) ═════════════
  var CSS = [
    '@page{size:A4;margin:14mm 16mm 18mm}',
    '*{box-sizing:border-box}html,body{margin:0;padding:0}',
    'body{font-family:Inter,Arial,sans-serif;color:#241626;background:#fff;font-size:10pt;line-height:1.45;-webkit-print-color-adjust:exact;print-color-adjust:exact}',
    '.portada{margin:0;border-radius:3mm;background:#17091A;color:#F7F1F6;padding:16mm 18mm 12mm}',
    '.portada img{height:16mm}.eyebrow{font-size:8.5pt;font-weight:600;letter-spacing:2.5px;text-transform:uppercase;color:#C77BC9;margin:8mm 0 2mm}',
    'h1{font-family:Montserrat,Arial,sans-serif;font-weight:800;font-size:25pt;line-height:1.1;margin:0}h1 .hi{color:#C77BC9}',
    '.bajada{color:#D9CCD9;margin:3mm 0 0;font-size:10.5pt}',
    '.meta{display:flex;flex-wrap:wrap;gap:4mm 10mm;margin-top:6mm;font-size:9pt;color:#D9CCD9}.meta b{color:#F7F1F6;font-weight:600;display:block;font-size:10pt}',
    '.cab{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #EADDEA;padding-bottom:2mm;margin:0 0 5mm}',
    '.cab img{height:8mm}.cab span{font-size:8pt;color:#6B5A6D;letter-spacing:1px;text-transform:uppercase}',
    'h2{font-family:Montserrat,Arial,sans-serif;font-weight:800;font-size:13.5pt;margin:7mm 0 3mm;color:#17091A;border-left:4px solid #924893;padding-left:3mm;break-after:avoid}',
    'h2 .n{color:#924893;margin-right:2mm}',
    'h3{font-family:Montserrat,Arial,sans-serif;font-size:10.5pt;margin:4mm 0 2mm;color:#17091A}',
    'p{margin:0 0 2.5mm}.nota{font-size:8.5pt;color:#6B5A6D}',
    '.semaforo{display:grid;grid-template-columns:1fr 1fr;gap:3mm;margin-top:3mm}',
    '.luz{border:1px solid #EADDEA;border-radius:3mm;padding:3mm 4mm;display:flex;gap:3mm;break-inside:avoid}',
    '.luz .pt{width:4.2mm;height:4.2mm;border-radius:50%;flex:none;margin-top:.6mm}',
    '.luz b{display:block;font-size:9.5pt;color:#17091A}.luz small{display:block;font-size:8.8pt;color:#5A4A5C}',
    '.luz .et{font-size:7.5pt;font-weight:700;letter-spacing:.8px;text-transform:uppercase}',
    '.bien .pt{background:#28865B}.bien .et{color:#28865B}.revisar .pt{background:#E0A100}.revisar .et{color:#A87700}',
    '.urgente .pt{background:#D34433}.urgente .et{color:#D34433}.confirmar .pt{background:#BFB3C1}.confirmar .et{color:#6B5A6D}',
    '.ac{display:inline-block;font-size:7.5pt;font-weight:700;color:#8A5A00;background:#FFF1CC;border-radius:2mm;padding:.2mm 1.6mm;margin-left:1.5mm;white-space:nowrap;vertical-align:1px}',
    'table{width:100%;border-collapse:collapse;font-size:9pt;break-inside:auto}tr{break-inside:avoid}',
    'th{font-family:Montserrat,Arial,sans-serif;font-size:8pt;text-align:left;color:#6B5A6D;font-weight:700;border-bottom:1.5px solid #924893;padding:1.6mm 2mm}',
    'td{padding:1.6mm 2mm;border-bottom:1px solid #EADDEA;vertical-align:top}td.num,th.num{text-align:right;white-space:nowrap}',
    'table.grilla td,table.grilla th{text-align:center;padding:1.1mm .6mm;font-size:8.5pt}table.grilla td:first-child,table.grilla th:first-child{text-align:left}',
    '.ok{color:#28865B;font-weight:700}.mal{color:#D34433;font-weight:700}.amb{color:#A87700;font-weight:700}.gr{color:#9C8E9E}',
    '.cifras{display:grid;grid-template-columns:repeat(4,1fr);gap:3mm;margin:2mm 0 3mm}',
    '.cifra{background:#F7F1F6;border-radius:2.5mm;padding:2.5mm 3mm;break-inside:avoid}.cifra b{display:block;font-family:Montserrat,Arial,sans-serif;font-size:13pt;color:#924893}.cifra span{font-size:8pt;color:#5A4A5C}',
    '.caja{background:#F7F1F6;border-left:3px solid #924893;border-radius:2mm;padding:3mm 4mm;margin:2mm 0 3mm;break-inside:avoid}',
    '.pasos{counter-reset:p;display:grid;gap:2.5mm}.paso{display:flex;gap:3mm;break-inside:avoid}',
    '.paso .num{font-family:Montserrat,Arial,sans-serif;font-weight:900;font-size:13pt;color:#924893;width:7mm;flex:none}.paso b{color:#17091A}',
    'tr.total td{border-bottom:none;font-family:Montserrat,Arial,sans-serif;font-weight:800;font-size:10.5pt;color:#924893}',
    '.firma{display:flex;gap:10mm;margin-top:8mm;break-inside:avoid}.firma div{flex:1;border-top:1.5px solid #924893;padding-top:2mm;font-size:9pt}',
    '.firma b{display:block;font-family:Montserrat,Arial,sans-serif;font-size:11pt;color:#17091A}',
    '.pie{position:fixed;left:0;right:0;bottom:-11mm;display:flex;justify-content:space-between;font-size:7.5pt;color:#9C8E9E}',
    '.salto{break-before:page}',
    '@media screen{body{padding:14mm 16mm;max-width:210mm;margin:0 auto}.pie{position:static;margin-top:8mm}}'
  ].join('');

  function ac(b) { return b ? '<span class="ac">a confirmar</span>' : ''; }
  function h2(n, t) { return '<h2><span class="n">' + n + '</span>' + t + '</h2>'; }

  function secResumen(M, s) {
    var urg = s.areas.filter(function (a) { return a.estado === 'urgente'; });
    var h = h2(1, 'En resumen');
    h += M.tipo === 'cliente' ? '<p>Revisamos la información de tu empresa en el SII y en nuestros registros. Este es el punto de partida: lo que está bien, lo que hay que revisar y lo urgente.</p>'
      : '<p>Este es el punto de partida que vemos hoy. Lo que está en el SII lo revisamos con tu acceso al iniciar el servicio y te confirmamos cada punto.</p>';
    if (M.cita) h += '<div class="caja">«' + esc(M.cita) + '»</div>';
    h += '<div class="semaforo">' + s.areas.map(function (a) {
      return '<div class="luz ' + esc(a.estado) + '"><span class="pt"></span><div><span class="et">' + esc(ESTADOS[a.estado] || a.estado) + '</span><b>' + esc(a.titulo) + '</b><small>' + esc(a.texto) + '</small></div></div>';
    }).join('') + '</div>';
    var QUE = { f29: 'poner al día tus F29', iva: 'corregir las diferencias de IVA', f22: 'regularizar tu Renta', sii: 'responder lo que pide el SII', rcv: 'resolver compras y ventas pendientes', pagos: 'ordenar los pagos pendientes' };
    if (urg.length) { var l = urg.map(function (a) { return QUE[a.area] || a.titulo; });
      h += '<div class="caja"><b>Lo primero que haremos:</b> ' + esc(l.length > 1 ? l.slice(0, -1).join(', ') + ' y ' + l[l.length - 1] : l[0]) + '.</div>'; }
    return h;
  }
  function secF29(n, s) {
    var f = s.datos, h = h2(n, 'Tus declaraciones de IVA (F29)');
    if (!f || !f.meses || !f.meses.length) return h + '<p>Aún no tenemos la lista de F29 del SII. ' + ac(true) + '</p>';
    var t = f.totales || {}, anios = {}, sum = {};
    f.meses.forEach(function (m) { var a = m.periodo.slice(0, 4), i = Number(m.periodo.slice(4)) - 1; (anios[a] = anios[a] || [])[i] = m;
      sum[a] = (sum[a] || 0) + (num(m.total_a_pagar) || 0); });
    var ks = Object.keys(anios).sort().reverse();
    h += '<div class="cifras"><div class="cifra"><b>' + t.declarados + '</b><span>declarados</span></div><div class="cifra"><b>' + t.no_declarados + '</b><span>sin declarar (atrasados)</span></div>'
      + '<div class="cifra"><b>' + ((t.observados || 0) + (t.en_revision || 0)) + '</b><span>observados o en revisión</span></div><div class="cifra"><b>' + t.rectificados + '</b><span>rectificados</span></div></div>';
    h += '<table class="grilla"><thead><tr><th>Año</th>' + MES3.map(function (x) { return '<th>' + x + '</th>'; }).join('') + '<th class="num">Total declarado a pagar</th></tr></thead><tbody>';
    ks.forEach(function (a) {
      h += '<tr><td><b>' + a + '</b></td>';
      for (var i = 0; i < 12; i++) { var m = anios[a][i], c;
        if (!m) c = '<span class="gr">·</span>';
        else if (m.estado === 'declarado') c = '<span class="ok">✓</span>' + (m.rectificada ? '<sup>R</sup>' : '');
        else if (m.estado === 'observado') c = '<span class="mal">✕</span>';
        else if (m.estado === 'en_revision') c = '<span class="amb">!</span>';
        else if (m.estado === 'no_declarado') c = '<span class="mal">ND</span>';
        else if (m.estado === 'por_declarar') c = '<span class="gr">—</span>';
        else c = '<span class="gr">?</span>';
        h += '<td>' + c + '</td>'; }
      h += '<td class="num">' + pesos(sum[a]) + '</td></tr>';
    });
    h += '</tbody></table><p class="nota">✓ declarado · <sup>R</sup> rectificado · ✕ observado por el SII · ! en revisión del SII · ND no declarado · — por vencer · ? sin información (a confirmar). Montos según lo declarado en cada F29 vigente.</p>';
    if (!f.lista_completa) h += '<p class="nota">La lista de declaraciones del SII aún no está completa: los meses marcados «?» quedan ' + ac(true) + '</p>';
    return h;
  }
  function secIva(n, s) {
    var L = s.datos, h = h2(n, 'Cruce de tu IVA con el SII');
    if (!L) return h + '<p>' + (s.estado === 'sin_permiso' ? 'Este cruce lo prepara el analista contable a cargo.' : 'Este cruce se hace con el historial de compras y ventas del SII.') + ' ' + ac(true) + '</p>';
    h += '<p>Comparamos mes a mes las ventas y compras que el SII tiene registradas con lo declarado en cada F29, entre ' + esc(mesLargo(L.desde)) + ' y ' + esc(mesLargo(L.hasta)) + ' (' + L.meses + ' meses).</p>';
    h += '<div class="cifras"><div class="cifra"><b>' + L.calzan + '</b><span>meses calzan</span></div><div class="cifra"><b>' + L.con_diferencia + '</b><span>con diferencias</span></div>'
      + '<div class="cifra"><b>' + L.provisionales + '</b><span>por completar</span></div><div class="cifra"><b>' + L.sin_datos + '</b><span>sin información</span></div></div>';
    if (L.con_diferencia > 0) {
      h += '<table><thead><tr><th>Estimación si se regulariza hoy</th><th class="num">Monto</th></tr></thead><tbody>'
        + '<tr><td>Impuesto (IVA) por diferencias</td><td class="num">' + pesos(L.impuesto) + ac(true) + '</td></tr>'
        + '<tr><td>Reajuste</td><td class="num">' + pesos(L.reajuste) + ac(true) + '</td></tr>'
        + '<tr><td>Intereses (art. 53 del Código Tributario)</td><td class="num">' + pesos(L.intereses) + ac(true) + '</td></tr>'
        + '<tr><td>Multa (art. 97 N°11)</td><td class="num">' + pesos(L.multa) + ac(true) + '</td></tr>'
        + '<tr class="total"><td>Total estimado</td><td class="num">' + pesos(L.total) + ac(true) + '</td></tr></tbody></table>';
      h += '<p class="nota">Estimación preliminar con información del SII: los montos definitivos los determinan el SII y la Tesorería al presentar las rectificaciones, y pueden bajar con condonación.' + (L.meses_no_calculables ? ' ' + plural(L.meses_no_calculables, 'mes aún no se puede estimar', 'meses aún no se pueden estimar') + '.' : '') + '</p>';
    }
    return h;
  }
  function secF22(n, s) {
    var f = s.datos, h = h2(n, 'Tu Operación Renta (F22) de los últimos 6 años');
    if (!f || !f.anios) return h + '<p>Aún no tenemos tus declaraciones de renta del SII. ' + ac(true) + '</p>';
    h += '<table><thead><tr><th>Año tributario</th><th>Estado</th><th class="num">Rectificatorias</th><th>Lo que dice el SII</th></tr></thead><tbody>';
    f.anios.forEach(function (a) {
      var est = a.estado === 'observado' ? '<span class="mal">Con observaciones</span>' : a.estado === 'declarado' ? '<span class="ok">Declarada</span>'
              : a.estado === 'sin_declaracion' ? '<span class="amb">Sin declaración encontrada</span>' + ac(true) : '<span class="gr">Sin información</span>' + ac(true);
      var obs = (a.observaciones || []).map(function (o) { return '<div><b>' + esc(o.codigo) + '</b> ' + esc(o.descripcion) + '</div>'; }).join('');
      h += '<tr><td><b>AT ' + esc(a.anio_tributario) + '</b>' + (a.fecha_ingreso ? '<div class="nota">' + esc(fechaLarga(a.fecha_ingreso)) + '</div>' : '') + '</td><td>' + est + '</td><td class="num">' + (a.rectificatorias != null ? esc(a.rectificatorias) : '—') + '</td><td>' + (obs || esc(a.estado_sii || '—')) + '</td></tr>';
    });
    return h + '</tbody></table>';
  }
  function secSii(n, s) {
    var h = h2(n, 'Lo que dice el SII: cartas, alertas y notificaciones'), c = s.cumplimiento, k = s.cartas;
    if (!c && !k) return h + '<p>Se revisa con tu acceso al SII. ' + ac(true) + '</p>';
    if (c) {
      h += '<div class="caja"><b>Certificado de cumplimiento:</b> ' + (c.cumple ? '<span class="ok">' + esc(c.estado || 'Cumple') + '</span>' : '<span class="mal">' + esc(c.estado || 'No cumple') + '</span>') + '</div>';
      if ((c.condiciones_no_cumple || []).length) h += '<table><thead><tr><th>Condición que no se cumple</th></tr></thead><tbody>' + c.condiciones_no_cumple.map(function (x) { return '<tr><td>' + esc(x.titulo || x.codigo) + '</td></tr>'; }).join('') + '</tbody></table>';
    }
    var it = (k && k.items) || [];
    if (it.length) {
      h += '<h3>Cartas y notificaciones vigentes (últimos 2 años)</h3><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Asunto</th><th>Plazo</th></tr></thead><tbody>';
      it.forEach(function (x) { h += '<tr><td>' + esc(x.fecha ? fechaLarga(x.fecha) : '—') + '</td><td>' + (x.categoria === 'notificacion' ? '<span class="mal">Notificación</span>' : 'Carta') + '</td><td>' + esc(x.titulo) + (x.periodo ? ' <span class="nota">(' + esc(mesLargo(x.periodo)) + ')</span>' : '') + '</td><td>' + esc(x.plazo || '—') + '</td></tr>'; });
      h += '</tbody></table>';
      if (k.total_vigentes > it.length) h += '<p class="nota">Se muestran ' + it.length + ' de ' + k.total_vigentes + ' cartas vigentes.</p>';
    } else if (k) h += '<p>No hay cartas ni notificaciones vigentes.</p>';
    return h;
  }
  function secRcv(n, s) {
    var r = s.datos, h = h2(n, 'Compras y ventas por resolver');
    if (!r) return h + '<p>Se revisa con tu acceso al SII. ' + ac(true) + '</p>';
    var filas = [];
    (r.compras_pendientes || []).forEach(function (x) { filas.push(['Compras pendientes de aceptar o reclamar', x]); });
    (r.compras_reclamadas || []).forEach(function (x) { filas.push(['Compras reclamadas', x]); });
    if (!filas.length && !(Number((r.ventas_reclamadas || {}).documentos) > 0)) return h + '<p>No hay documentos pendientes en los últimos 12 meses.</p>';
    h += '<table><thead><tr><th>Qué</th><th>Mes</th><th class="num">Documentos</th><th class="num">IVA</th><th class="num">Total</th></tr></thead><tbody>';
    filas.forEach(function (f) { h += '<tr><td>' + esc(f[0]) + '</td><td>' + esc(mesLargo(f[1].periodo)) + '</td><td class="num">' + esc(f[1].documentos) + '</td><td class="num">' + pesos(f[1].iva) + '</td><td class="num">' + pesos(f[1].total) + '</td></tr>'; });
    var v = r.ventas_reclamadas || {};
    if (Number(v.documentos) > 0) h += '<tr><td>Ventas reclamadas por tus clientes</td><td>12 meses</td><td class="num">' + esc(v.documentos) + '</td><td class="num">—</td><td class="num">' + pesos(v.total) + '</td></tr>';
    return h + '</tbody></table><p class="nota">Una compra pendiente que no se acepta ni se reclama a tiempo puede quedar aceptada sin revisión; una reclamada no da derecho a crédito de IVA.</p>';
  }
  function secPagos(n, s) {
    var P = s.datos, h = h2(n, 'Tus pagos del año');
    if (!P) return h + '<p>' + (s.estado === 'no_instalado' ? 'El historial de pagos mes a mes se agrega en la próxima versión de este informe.' : 'Lo revisa el analista contable a cargo.') + ' ' + ac(true) + '</p>';
    var ET = { pagado: ['Pagado', 'ok'], postergado: ['Postergado', 'amb'], pendiente: ['Pendiente de pago', 'mal'], girado: ['Girado por el SII', 'mal'], nada_que_pagar: ['Sin pago', 'gr'], sin_informacion: ['Sin registro', 'gr'] };
    h += '<table class="grilla"><thead><tr><th>' + esc(P.anio) + '</th>' + P.meses.map(function (m) { return '<th>' + MES3[Number(m.periodo.slice(4)) - 1] + '</th>'; }).join('') + '</tr></thead><tbody><tr><td>Estado</td>'
      + P.meses.map(function (m) { var e = ET[m.estado] || ET.sin_informacion; return '<td><span class="' + e[1] + '">' + esc(e[0]) + '</span></td>'; }).join('') + '</tr></tbody></table>';
    return h + '<p class="nota">«Sin registro» = el SII no informa pagos y aún no tenemos el comprobante: ' + ac(true) + '</p>';
  }
  function secPropuesta(n, M, s) {
    var h = h2(n, 'Lo que te proponemos'), it = s.items || [], p = s.plan;
    h += '<p>Lo que logras: <b>dejar tu empresa al día y saber exactamente qué debes, cuánto y cómo pagarlo</b>, para después mantenerla en orden mes a mes.</p><div class="pasos">';
    var pasos = [];
    var nd = it.filter(function (x) { return /sin declarar/i.test(x.glosa); })[0], rc = it.filter(function (x) { return /rectific/i.test(x.glosa); })[0], rt = it.filter(function (x) { return /renta/i.test(x.glosa); });
    if (nd) pasos.push(['Ponemos al día tus F29', 'Declaramos ' + (Number(nd.cantidad) === 1 ? 'el F29 pendiente' : 'los ' + esc(nd.cantidad) + ' F29 pendientes') + ', en orden y con el remanente encadenado.']);
    if (rc) pasos.push(['Corregimos lo que no calza', 'Rectificamos ' + (Number(rc.cantidad) === 1 ? 'el F29 con diferencias u observado' : 'los ' + esc(rc.cantidad) + ' F29 con diferencias u observados') + ', desde el primer mes con error.']);
    if (rt.length) pasos.push(['Regularizamos tu Renta', 'Revisamos y regularizamos ' + plural(rt.length, 'Operación Renta', 'Operaciones Renta') + ' con observaciones o pendientes.']);
    pasos.push(['Te mostramos cuánto debes y las opciones', 'Antes de pagar ves el detalle del SII y la Tesorería, y las alternativas (pago, convenio o condonación).']);
    pasos.push(['Te acompañamos mes a mes', p ? 'Con ' + esc(PLAN_NOMBRE[p.codigo] || p.codigo) + ': tus impuestos al día, avisos a tiempo y un reporte mensual para saber cómo vas.' : 'Con el plan que acordemos: tus impuestos al día y avisos a tiempo.']);
    pasos.forEach(function (x, i) { h += '<div class="paso"><span class="num">' + (i + 1) + '</span><div><b>' + x[0] + '</b><br>' + x[1] + '</div></div>'; });
    h += '</div>';
    h += h2(n + 1, 'Tu inversión');
    h += '<table><thead><tr><th>Nuestros servicios</th><th class="num">Cantidad</th><th class="num">Valor unitario</th><th class="num">Total</th></tr></thead><tbody>';
    if (!it.length) h += '<tr><td colspan="4">Sin regularizaciones por ahora.</td></tr>';
    it.forEach(function (x) { var v = num(x.valor_uf), q = num(x.cantidad) || 0;
      h += '<tr><td>' + esc(x.glosa) + ac(x.a_confirmar) + '</td><td class="num">' + esc(q) + '</td><td class="num">' + (v == null ? 'A definir' : uf(v)) + '</td><td class="num">' + (v == null ? 'A definir' : uf(v * q)) + '</td></tr>'; });
    if (it.length) h += '<tr class="total"><td colspan="3">Total regularización' + (s.items_sin_valor ? ' (sin lo que está «A definir»)' : '') + '</td><td class="num">' + uf(s.total_uf) + '</td></tr>';
    h += '</tbody></table>';
    if (M.uf && s.total_uf) h += '<p class="nota">Referencia en pesos: ' + pesos(s.total_uf * M.uf.valor) + ' con la UF de ' + esc(M.uf.periodo) + ' (' + pesos(M.uf.valor) + '). Se factura en UF al valor del día de emisión.</p>';
    if (p) h += '<h3>Plan mensual</h3><table><tbody><tr><td>' + esc(PLAN_NOMBRE[p.codigo] || p.codigo) + '</td><td class="num">' + (num(p.valor_uf) == null ? 'Según propuesta' + ac(true) : uf(p.valor_uf) + ' al mes') + '</td></tr>'
      + (num(p.valor_trab_uf) != null ? '<tr><td>Gestión Laboral, por trabajador</td><td class="num">' + uf(p.valor_trab_uf) + ' al mes</td></tr>' : '') + '</tbody></table>';
    h += '<p class="nota">Valores exentos de IVA. No incluyen los impuestos, reajustes, intereses ni multas que resulten de la regularización: esos se pagan directamente al SII o a la Tesorería, y te los mostramos antes de pagar. La Operación Renta anual del plan va aparte.</p>';
    return h;
  }

  /** HTML A4 completo. op = { logoBlanco, logoColor } (URL absolutas o relativas al documento). */
  function documento(M, op) {
    op = op || {}; var cli = M.tipo === 'cliente', eq = M.equipo || {}, n = 1, h = '';
    var meta = [['Para', M.empresa.razon_social + (M.empresa.rut ? ' · ' + M.empresa.rut : '')]];
    if (M.atencion) meta.push(['Atención', M.atencion]);
    meta.push(['Fecha', fechaLarga(M.fecha)]);
    if (M.datos_al) meta.push(['Información del SII al', fechaLarga(String(M.datos_al).slice(0, 10))]);
    if (eq.contable) meta.push(['Analista a cargo', eq.contable.nombre]);
    h += '<section class="portada"><img src="' + esc(op.logoBlanco || '') + '" alt="Contadoor"><div class="eyebrow">Diagnóstico contable de inicio</div>'
      + '<h1>Tu diagnóstico <span class="hi">«Aquí partimos»</span></h1>'
      + '<p class="bajada">' + (cli ? 'Todo lo que encontramos en tu empresa al comenzar, en un solo lugar.' : 'Lo que vemos de tu empresa y cómo te proponemos partir.') + '</p>'
      + '<div class="meta">' + meta.map(function (m) { return '<div><b>' + esc(m[1]) + '</b>' + esc(m[0]) + '</div>'; }).join('') + '</div></section>';
    h += '<div style="height:6mm"></div>';
    M.secciones.forEach(function (s) {
      if (s.id === 'resumen') { h += secResumen(M, s); n = 2; }
      else if (s.id === 'f29') h += secF29(n++, s);
      else if (s.id === 'iva') h += secIva(n++, s);
      else if (s.id === 'f22') h += secF22(n++, s);
      else if (s.id === 'sii') h += secSii(n++, s);
      else if (s.id === 'rcv') h += secRcv(n++, s);
      else if (s.id === 'pagos') h += secPagos(n++, s);
      else if (s.id === 'propuesta') { h += '<div class="salto"></div><div class="cab"><img src="' + esc(op.logoColor || '') + '" alt="Contadoor"><span>' + esc(TITULO) + '</span></div>' + secPropuesta(n, M, s); n += 2; }
    });
    if (M.notas) h += h2(n++, 'Observaciones de tu analista') + M.notas.split(/\n+/).map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('');
    if (M.a_confirmar) h += '<p class="nota">Las cifras marcadas <span class="ac">a confirmar</span> son estimaciones o datos aún no verificados con el SII: las confirmamos antes de cualquier presentación o pago.</p>';
    h += '<div class="firma"><div><b>Contadoor</b>Asesorías Contadoor Ltda.<br>Tu equipo contable</div>'
      + '<div><b>' + esc(eq.contable ? eq.contable.nombre : 'Por asignar') + '</b>' + esc(eq.contable ? eq.contable.cargo : 'Analista a cargo') + '<br>Analista a cargo</div>'
      + (eq.rrhh ? '<div><b>' + esc(eq.rrhh.nombre) + '</b>' + esc(eq.rrhh.cargo) + '</div>' : '') + '</div>';
    h += '<div class="pie"><span>' + esc(PIE) + '</span><span>Información para tu empresa. Confidencial.</span></div>';
    var titulo = 'Diagnostico_Aqui_Partimos_' + String(M.empresa.razon_social || 'empresa').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 50) + '_' + M.fecha;
    return '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>' + esc(titulo) + '</title>'
      + '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Montserrat:wght@700;800;900&display=swap" rel="stylesheet">'
      + '<style>' + CSS + '</style></head><body>' + h + '</body></html>';
  }

  raiz.GestoorDiagDoc = { modelo: modelo, documento: documento, resumenLiva: resumenLiva, resumenPagos: resumenPagos, propuestaBase: propuestaBase, precioF29: precioF29,
    areaF29: areaF29, areaF22: areaF22, areaSii: areaSii, areaRcv: areaRcv, areaPagos: areaPagos, areaLiva: areaLiva, esc: esc, TITULO: TITULO, ESTADOS: ESTADOS };
})(typeof window !== 'undefined' ? window : globalThis);
