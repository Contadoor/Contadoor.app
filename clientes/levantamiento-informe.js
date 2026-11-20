/* ============================================================
   clientes/levantamiento-informe.js — INFORME PARA EL CLIENTE (PDF) del escenario «Si rectificamos todo» (20-11-2026).
   · Se abre desde levantamiento-rectificar.js (botón «Informe para el cliente (PDF)»). Usa SOLO lo que ya entregó el servidor
     (public.sii_levantamiento_rectificar_todo): no recalcula impuestos ni cargos; las cifras grandes son los totales del escenario.
   · Distinto del PDF interno: lenguaje simple, sin jerga ni notas internas; los códigos del F29 aparecen solo en el Anexo.
   · Bitácora ANTES de imprimir (si falla, no se exporta): RPC sii_levantamiento_registrar_exportacion con p_tipo
     'borrador_pdf_todos' (la RPC solo acepta excel_mes, excel_rango, borrador_pdf_mes y borrador_pdf_todos; se reutiliza el
     del PDF del rango hasta que una migración agregue un tipo propio).
   · Impresión: mismo mecanismo que los PDF actuales (iframe oculto + ventana de impresión del navegador, GestoorLevDetalle.imprimirHtml).
   · Marca: morado #924893 (degradado #803889→#A4599C), Montserrat + Inter, fondo claro, A4 vertical, páginas numeradas,
     logo glossy (assets/contadoor-lockup-glossy.png). Al cliente: «nuestros servicios»; sin precios; sin dirección personal.
   · Todo dato externo va escapado (esc). Sin librerías nuevas: el gráfico es SVG armado a mano.
   Uso: GestoorLevInforme.exportar(ctx, esc, {boton, aviso}) · documento(esc, cliente, logoUrl, otros, opciones) · resumen(esc, otros)
   ============================================================ */
(function (raiz) {
  'use strict';
  var MORADO = '#924893', TINTA = '#2A1430', GRIS = '#6B5A70';
  var WHATSAPP = '+56 9 4675 4390', WHATSAPP_URL = 'https://wa.me/56946754390', AGENDA = 'agenda.contadoor.cl';
  var AVISO_LEGAL = 'Estimación preliminar preparada por Contadoor con información del SII; los montos definitivos los determina el SII al presentar las rectificaciones.';
  var TIPO_BITACORA = 'borrador_pdf_todos';
  var MES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var MES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  var TOL = 100;   // misma tolerancia del levantamiento: diferencias de ±$100 se consideran sin diferencia

  function num(v) { return v == null || v === '' || isNaN(Number(v)) ? null : Number(v); }
  function pesos(v) { var n = num(v); return n == null ? '—' : (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString('es-CL'); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function mesLargo(p) { p = String(p || ''); return p.length === 6 ? MES_LARGO[Number(p.slice(4)) - 1] + ' ' + p.slice(0, 4) : p; }
  function mesCorto(p) { p = String(p || ''); return p.length === 6 ? MES_CORTO[Number(p.slice(4)) - 1] + ' ' + p.slice(2, 4) : p; }
  function lista(ps) { ps = (ps || []).map(mesLargo); return ps.length <= 1 ? ps.join('') : ps.slice(0, -1).join(', ') + ' y ' + ps[ps.length - 1]; }
  function nMeses(desde, hasta) { desde = String(desde || ''); hasta = String(hasta || ''); if (desde.length !== 6 || hasta.length !== 6) return 0; return (+hasta.slice(0, 4) - +desde.slice(0, 4)) * 12 + (+hasta.slice(4) - +desde.slice(4)) + 1; }
  function fechaLarga(f) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(f || '')); return m ? Number(m[3]) + ' de ' + MES_LARGO[Number(m[2]) - 1] + ' de ' + m[1] : ''; }
  function hoyLargo() { var d = new Date(); return d.getDate() + ' de ' + MES_LARGO[d.getMonth()] + ' de ' + d.getFullYear(); }
  function plural(n, s, p) { return n + ' ' + (n === 1 ? s : p); }
  function delta(p) { if (!p) return null; var a = num(p.declarado), b = num(p.corregido); return a == null || b == null ? null : b - a; }

  // ── Lectura del escenario en lenguaje del cliente (solo sumas y restas de lo que entregó el servidor) ──
  /** Diferencia PROPIA de IVA del mes (positivo = más impuesto que lo declarado). Quita el efecto del remanente arrastrado:
      Δ89 − Δ77 + Δ504. En meses que solo arrastran el remanente da 0. null si el mes no se pudo calcular. */
  function difMes(m) {
    var a = num(m.diferencia_89), b = num(m.diferencia_77), c = num(m.delta_504);
    if (a == null || b == null || c == null) return null;
    var v = a - b + c; return Math.abs(v) <= TOL ? 0 : v;
  }
  /** Apertura ventas / compras de la diferencia propia (c538 = débitos, c537 = créditos con el remanente 504 incluido). */
  function apertura(meses) {
    var v = 0, c = 0, hay = false;
    (meses || []).forEach(function (m) {
      var d8 = delta(m.c538), d7 = delta(m.c537), d4 = num(m.delta_504);
      if (d8 == null || d7 == null || d4 == null) return;
      hay = true; v += d8; c += -(d7 - d4);
    });
    return hay ? { ventas: v, compras: c } : null;
  }
  /** Remanente que importa al cliente: el del último F29 alcanzado si el efecto llega hasta hoy; si no, el del cierre del período revisado. */
  function remanente(e) {
    var f = (e && e.fuera_de_rango) || {}, t = (e && e.traspaso) || {};
    if (f.estado === 'afecta_hasta_ultimo_f29' && f.remanente_al_final) {
      return { calculable: true, periodo: f.remanente_al_final.periodo || f.ultimo_f29_declarado, hoy: num(f.remanente_al_final.declarado), corregido: num(f.remanente_al_final.corregido), alUltimo: true };
    }
    return { calculable: !!t.calculable, periodo: t.periodo, hoy: num(t.declarado), corregido: num(t.corregido), alUltimo: false };
  }
  /** Cifras del informe (las mismas del escenario + otros cargos si se ingresaron). */
  function resumen(e, otros) {
    var T = ((e && e.totales) || {}).todo || {}, om = otros && num(otros.monto) > 0 ? Number(otros.monto) : 0, base = num(T.total);
    var meses = (e && e.meses) || [];
    return {
      mesesRevisados: nMeses(e && e.desde, e && e.hasta),
      f29: Number(T.f29_a_rectificar || 0) + Number(T.f29_a_declarar || 0), f29Rect: Number(T.f29_a_rectificar || 0), f29Decl: Number(T.f29_a_declarar || 0),
      impuesto: num(T.impuesto), reajuste: num(T.reajuste), intereses: num(T.intereses), multa: num(T.multa), otros: om, motivo: om ? String((otros && otros.motivo) || '') : '',
      base: base, total: base == null ? null : base + om, provisional: !!T.total_provisional,
      pagadoDeMas: num(T.iva_pagado_de_mas) || 0,
      remanente: remanente(e),
      conDiferencia: meses.filter(function (m) { var d = difMes(m); return d != null && d !== 0; }).map(function (m) { return m.periodo; }),
      absorbe: meses.filter(function (m) { return m.categoria === 'solo_remanente'; }).map(function (m) { return m.periodo; }),
      aPagar: meses.filter(function (m) { return m.categoria === 'iva_a_pagar'; }).map(function (m) { return m.periodo; }),
      deMas: meses.filter(function (m) { return num(m.iva_pagado_de_mas) > 0; }),
      posteriores: meses.filter(function (m) { return !m.en_rango && m.orden; }).map(function (m) { return m.periodo; }),
      porRevisar: meses.filter(function (m) { return m.categoria === 'no_calculable'; }).map(function (m) { return m.periodo; }),
      orden: meses.filter(function (m) { return m.orden; }).sort(function (a, b) { return a.orden - b.orden; }).map(function (m) { return m.periodo; }),
      apertura: apertura(meses)
    };
  }
  function totalTxt(R) { return R.total == null ? 'Por determinar' : pesos(R.total); }

  /** Párrafos de «Qué encontramos» (texto simple, sin códigos). */
  function hallazgos(e, R) {
    var p = [];
    p.push('Comparamos las ventas y compras que el SII tiene registradas para su empresa con lo que se declaró mes a mes en el formulario de IVA (F29), entre ' + mesLargo(e.desde) + ' y ' + mesLargo(e.hasta) + '.');
    if (!R.conDiferencia.length) p.push('No encontramos diferencias relevantes en el IVA de esos meses.');
    else {
      var a = R.apertura, partes = [];
      if (a && Math.abs(a.ventas) > TOL) partes.push(a.ventas > 0 ? 'las ventas registradas en el SII tienen ' + pesos(a.ventas) + ' más de IVA que lo declarado' : 'se declaró ' + pesos(-a.ventas) + ' más de IVA en ventas que lo registrado en el SII');
      if (a && Math.abs(a.compras) > TOL) partes.push(a.compras > 0 ? 'se usó ' + pesos(a.compras) + ' más de IVA de compras (crédito) que lo que respaldan los documentos del SII' : 'hay ' + pesos(-a.compras) + ' de IVA de compras respaldado en el SII que no se aprovechó');
      p.push('Encontramos diferencias en ' + plural(R.conDiferencia.length, 'mes', 'meses') + ': ' + lista(R.conDiferencia) + '.' + (partes.length ? ' En total, ' + partes.join(', y ') + '.' : ''));
    }
    if (R.absorbe.length) {
      p.push('En ' + lista(R.absorbe) + ' la diferencia no se tradujo en un pago, porque se descontó del saldo a favor de IVA que la empresa venía arrastrando (el «remanente»). Al corregir, ese saldo a favor baja.' +
        (R.aPagar.length ? ' El saldo a favor corregido se agota en ' + mesLargo(R.aPagar[0]) + ': desde ahí aparece IVA a pagar.' : ''));
    } else if (R.aPagar.length) {
      p.push('En ' + lista(R.aPagar) + ' la diferencia se traduce en IVA a pagar.');
    }
    if (R.posteriores.length) p.push('El cambio del saldo a favor alcanza también meses posteriores al período revisado (' + lista(R.posteriores) + '), que ya estaban declarados y también deben corregirse.');
    if (R.remanente.calculable && R.remanente.hoy != null && R.remanente.corregido != null) {
      var dr = R.remanente.corregido - R.remanente.hoy;
      p.push(Math.abs(dr) <= TOL ? 'Su saldo a favor de IVA a ' + mesLargo(R.remanente.periodo) + ' no cambia: ' + pesos(R.remanente.hoy) + '.'
        : 'Su saldo a favor de IVA a ' + mesLargo(R.remanente.periodo) + ' pasa de ' + pesos(R.remanente.hoy) + ' a ' + pesos(R.remanente.corregido) + ' al corregir.');
    }
    if (R.porRevisar.length) p.push('En ' + lista(R.porRevisar) + ' falta información para estimar; los revisaremos uno a uno antes de presentar.');
    return p;
  }

  // ── Gráfico SVG (barras: diferencia de IVA por mes; líneas: saldo a favor declarado vs corregido) ──
  function corto(n) {
    var a = Math.abs(n), s = n < 0 ? '-$' : '$';
    if (a >= 1e6) return s + (a / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace('.', ',') + ' M';
    if (a >= 1e3) return s + Math.round(a / 1e3).toLocaleString('es-CL') + ' mil';
    return s + Math.round(a);
  }
  function paso(rango) { var b = Math.pow(10, Math.floor(Math.log10(rango / 4 || 1))), k = [1, 2, 2.5, 5, 10]; for (var i = 0; i < k.length; i++) if (rango / (b * k[i]) <= 4) return b * k[i]; return b * 10; }
  function grafico(e) {
    var meses = (e && e.meses) || [], n = meses.length;
    if (!n) return '';
    var W = 700, H = 250, L = 66, Rm = 14, Tp = 14, B = 36, w = W - L - Rm, h = H - Tp - B, banda = w / n;
    var dif = meses.map(difMes), rd = meses.map(function (m) { return num((m.c77 || {}).declarado); }), rc = meses.map(function (m) { return num((m.c77 || {}).corregido); });
    var vals = dif.concat(rd, rc).filter(function (v) { return v != null; }).concat([0]);
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals); if (hi === lo) hi = lo + 1;
    var st = paso(hi - lo); lo = Math.floor(lo / st) * st; hi = Math.ceil(hi / st) * st;
    function y(v) { return Tp + h - (v - lo) / (hi - lo) * h; }
    function x(i) { return L + banda * i + banda / 2; }
    var s = '<svg class="graf" viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Diferencia de IVA por mes y saldo a favor declarado y corregido">' +
      '<defs><linearGradient id="gb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#A4599C"/><stop offset="1" stop-color="#803889"/></linearGradient></defs>';
    for (var t = lo; t <= hi + st / 2; t += st) {
      s += '<line x1="' + L + '" x2="' + (W - Rm) + '" y1="' + y(t).toFixed(1) + '" y2="' + y(t).toFixed(1) + '" stroke="' + (t === 0 ? '#B9A3BE' : '#EFE3F1') + '" stroke-width="' + (t === 0 ? 1.2 : 1) + '"/>' +
        '<text x="' + (L - 8) + '" y="' + (y(t) + 3.5).toFixed(1) + '" text-anchor="end" font-size="10" fill="' + GRIS + '">' + esc(corto(t)) + '</text>';
    }
    var bw = Math.max(2, Math.min(28, banda * 0.58));
    dif.forEach(function (v, i) {
      if (!v) return;
      var y0 = y(0), y1 = y(v), top = Math.min(y0, y1), alto = Math.max(1, Math.abs(y1 - y0));
      s += '<rect class="barra" data-periodo="' + esc(meses[i].periodo) + '" data-valor="' + Math.round(v) + '" x="' + (x(i) - bw / 2).toFixed(1) + '" y="' + top.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + alto.toFixed(1) + '" rx="2" fill="' + (v > 0 ? 'url(#gb)' : '#3FA77A') + '"/>';
    });
    function linea(serie, color, guion, cls) {
      var tramos = [], cur = [];
      serie.forEach(function (v, i) { if (v == null) { if (cur.length) tramos.push(cur); cur = []; } else cur.push(x(i).toFixed(1) + ',' + y(v).toFixed(1)); });
      if (cur.length) tramos.push(cur);
      return tramos.map(function (pts) { return '<polyline class="' + cls + '" points="' + pts.join(' ') + '" fill="none" stroke="' + color + '" stroke-width="2.2"' + (guion ? ' stroke-dasharray="5 4"' : '') + ' stroke-linejoin="round" stroke-linecap="round"/>'; }).join('') +
        (n <= 24 ? serie.map(function (v, i) { return v == null ? '' : '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(v).toFixed(1) + '" r="2.6" fill="' + color + '"/>'; }).join('') : '');
    }
    s += linea(rd, '#9A8A9C', true, 'rem-declarado') + linea(rc, '#D98A00', false, 'rem-corregido');
    var cada = Math.max(1, Math.ceil(n / 12));
    meses.forEach(function (m, i) {
      if (i % cada) return;
      s += '<text x="' + x(i).toFixed(1) + '" y="' + (H - B + 16) + '" text-anchor="middle" font-size="10" fill="' + (m.en_rango ? GRIS : '#B07A2A') + '">' + esc(mesCorto(m.periodo)) + '</text>';
    });
    var fuera = meses.map(function (m, i) { return m.en_rango ? -1 : i; }).filter(function (i) { return i >= 0; });
    if (fuera.length) {
      var x0 = L + banda * fuera[0];
      s += '<rect x="' + x0.toFixed(1) + '" y="' + Tp + '" width="' + (W - Rm - x0).toFixed(1) + '" height="' + h + '" fill="#FFF6E0" opacity=".45"/>' +
        '<text x="' + (x0 + 4).toFixed(1) + '" y="' + (Tp + 11) + '" font-size="9.5" fill="#8A5A00">Posterior al período revisado</text>';
    }
    return s + '</svg>';
  }

  // ── Documento ──
  var CSS = '@page{size:A4;margin:15mm 14mm 20mm 14mm;' +
      '@bottom-left{content:"' + AVISO_LEGAL + '";font:7.2pt Inter,Arial,sans-serif;color:#8A7A8E;vertical-align:top;padding-top:4mm;width:150mm}' +
      '@bottom-right{content:"Página " counter(page) " de " counter(pages);font:600 8pt Inter,Arial,sans-serif;color:' + MORADO + ';vertical-align:top;padding-top:4mm}}' +
    '@page portada{margin:0;@bottom-left{content:none}@bottom-right{content:none}}' +
    '*{-webkit-print-color-adjust:exact;print-color-adjust:exact;box-sizing:border-box}' +
    'html,body{margin:0;background:#fff}body{font-family:Inter,Arial,sans-serif;color:' + TINTA + ';font-size:9.8pt;line-height:1.5}' +
    'h1,h2,h3,.cifra .v,.mont{font-family:Montserrat,Arial,sans-serif}' +
    '.portada{page:portada;width:210mm;height:296mm;overflow:hidden;position:relative;break-after:page;page-break-after:always;background:#fff}' +
    '.portada .logo{position:absolute;left:18mm;top:20mm;height:20mm}' +
    '.portada .banda{position:absolute;left:0;right:0;top:78mm;padding:16mm 18mm 14mm;background:linear-gradient(120deg,#803889,#A4599C);color:#fff}' +
    '.portada .banda small{display:block;font:700 9pt Montserrat,Arial,sans-serif;letter-spacing:2.5px;text-transform:uppercase;opacity:.85}' +
    '.portada h1{margin:4mm 0 0;font-size:27pt;line-height:1.15;font-weight:800;max-width:160mm}' +
    '.portada .datos{position:absolute;left:18mm;right:18mm;top:168mm;border-top:2px solid ' + MORADO + '}' +
    '.portada .datos div{display:flex;gap:8mm;padding:3.4mm 0;border-bottom:1px solid #EADCEC;font-size:11.5pt}.portada .datos dt{width:46mm;color:' + GRIS + ';font-size:9pt;text-transform:uppercase;letter-spacing:.6px;padding-top:.6mm}.portada .datos dd{margin:0;font-weight:600}' +
    '.portada .pie{position:absolute;left:18mm;right:18mm;bottom:16mm;font-size:8.5pt;color:' + GRIS + ';line-height:1.5}.portada .pie b{color:' + MORADO + '}' +
    '.sec{break-before:page;page-break-before:always}' +
    '.cab{display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid ' + MORADO + ';padding-bottom:3mm;margin-bottom:6mm}.cab img{height:9mm}.cab span{font-size:8.5pt;color:' + GRIS + ';text-align:right}' +
    'h2{font-size:16pt;font-weight:800;color:' + MORADO + ';margin:0 0 3mm}h3{font-size:11.5pt;font-weight:800;color:' + TINTA + ';margin:6mm 0 2mm}' +
    'p{margin:0 0 3mm}.suave{color:' + GRIS + '}' +
    '.cifras{display:grid;grid-template-columns:1fr 1fr;gap:3.5mm;margin:3mm 0 4mm}.cifra{border:1px solid #E7D6EA;border-radius:4mm;padding:3mm 4.5mm;break-inside:avoid}' +
    '.cifra .l{font-size:8.3pt;text-transform:uppercase;letter-spacing:.6px;color:' + GRIS + ';font-weight:600}.cifra .v{font-size:21pt;font-weight:800;color:' + MORADO + ';line-height:1.2;margin-top:1.5mm;font-variant-numeric:tabular-nums}' +
    '.cifra .s{font-size:9pt;color:' + GRIS + ';margin-top:1mm}.cifra.total{background:linear-gradient(150deg,#803889,#A4599C);border:0;color:#fff}.cifra.total .l,.cifra.total .s{color:#F4E6F4}.cifra.total .v{color:#fff}' +
    '.cifra table{width:100%;border-collapse:collapse;margin-top:2mm;font-size:9pt}.cifra table td{padding:.7mm 0;border-top:1px solid rgba(255,255,255,.28)}.cifra table td+td{text-align:right;font-variant-numeric:tabular-nums}' +
    '.cifra .flecha{color:#D98A00}' +
    '.bloque-graf{break-inside:avoid;page-break-inside:avoid}.graf{width:100%;height:auto;max-height:68mm;margin:1mm 0 1mm}.ley{display:flex;gap:6mm;flex-wrap:wrap;font-size:8.5pt;color:' + GRIS + ';margin-bottom:4mm}.ley i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:4px;vertical-align:-1px}' +
    '.ley i.l{height:0;border-top:2.4px solid;border-radius:0;vertical-align:3px;width:16px}' +
    'ol.pasos{list-style:none;counter-reset:p;padding:0;margin:2mm 0 4mm}ol.pasos li{counter-increment:p;position:relative;padding:0 0 3mm 11mm;break-inside:avoid}' +
    'ol.pasos li::before{content:counter(p);position:absolute;left:0;top:-.3mm;width:7mm;height:7mm;border-radius:50%;background:' + MORADO + ';color:#fff;font:800 9.5pt/7mm Montserrat,Arial,sans-serif;text-align:center}' +
    '.caja{border-radius:3mm;padding:3.5mm 4.5mm;margin:3mm 0;break-inside:avoid}.caja.lila{background:#F6ECF6;border:1px solid #E7D6EA}.caja.verde{background:#EEF8F2;border:1px solid #CFE9DB}' +
    '.caja b{color:' + MORADO + '}.caja.verde b{color:#28865B}' +
    'ul.ayuda{padding-left:5mm;margin:2mm 0 4mm}ul.ayuda li{margin-bottom:1.6mm}' +
    '.contacto{display:grid;grid-template-columns:1fr 1fr;gap:4mm;margin-top:5mm}.contacto a{display:block;text-decoration:none;color:#fff;background:linear-gradient(120deg,#803889,#A4599C);border-radius:4mm;padding:4mm 5mm}' +
    '.contacto a small{display:block;font-size:8pt;letter-spacing:.8px;text-transform:uppercase;opacity:.85}.contacto a b{font:800 14pt Montserrat,Arial,sans-serif}' +
    'table.anexo{width:100%;border-collapse:collapse;font-size:9pt;font-variant-numeric:tabular-nums}table.anexo th{background:#F6ECF6;color:#5B4560;font-size:7.6pt;text-transform:uppercase;letter-spacing:.4px;padding:2mm 2mm;text-align:right;border-bottom:1.5px solid ' + MORADO + '}' +
    'table.anexo td{padding:1.5mm 2mm;border-bottom:1px solid #EFE3F1;text-align:right}table.anexo th:first-child,table.anexo td:first-child{text-align:left;white-space:nowrap}table.anexo tr{break-inside:avoid}' +
    'table.anexo td.pos{color:#B4362A;font-weight:600}table.anexo td.neg{color:#28865B;font-weight:600}table.anexo tr.post td{background:#FFFAF0}table.anexo td small{display:block;color:#8A5A00;font-size:7.4pt}' +
    'table.anexo tfoot td{font-weight:800;border-top:2px solid ' + MORADO + ';border-bottom:0;background:#FBF6FB}table.anexo tfoot tr.otros td{font-weight:600;background:#fff}' +
    '.legal{margin-top:6mm;padding-top:3mm;border-top:1px solid #EADCEC;font-size:8.3pt;color:' + GRIS + '}';

  function cab(logo, cliente) { return '<div class="cab"><img src="' + esc(logo) + '" alt="Contadoor"><span>Diagnóstico de IVA · ' + esc(cliente.razon || '') + '</span></div>'; }

  function portada(e, cliente, logo) {
    return '<section class="portada"><img class="logo" src="' + esc(logo) + '" alt="Contadoor">' +
      '<div class="banda"><small>Informe para el cliente</small><h1>Diagnóstico de IVA y propuesta de regularización</h1></div>' +
      '<dl class="datos"><div><dt>Empresa</dt><dd>' + esc(cliente.razon || '') + '</dd></div><div><dt>RUT</dt><dd>' + esc(cliente.rut || '—') + '</dd></div>' +
      '<div><dt>Período revisado</dt><dd>' + esc(mesLargo(e.desde)) + ' a ' + esc(mesLargo(e.hasta)) + '</dd></div><div><dt>Fecha</dt><dd>' + esc(hoyLargo()) + '</dd></div></dl>' +
      '<div class="pie"><b>Asesorías Contadoor Ltda.</b> · contadoor.cl · WhatsApp ' + esc(WHATSAPP) + '<br>' + esc(AVISO_LEGAL) + '</div></section>';
  }

  function paginaResumen(e, cliente, logo, R) {
    var rem = R.remanente, des = [['Impuesto', R.impuesto], ['Reajuste', R.reajuste], ['Intereses', R.intereses], ['Multa', R.multa]];
    if (R.otros) des.push(['Otros cargos', R.otros]);
    var decl = R.f29Decl ? 'Incluye ' + plural(R.f29Decl, 'mes sin declaración presentada', 'meses sin declaración presentada') + '.' : 'Una por mes, en orden.';
    return '<section class="sec" id="inf-resumen">' + cab(logo, cliente) + '<h2>Resumen</h2>' +
      '<p class="suave">Período revisado: ' + esc(mesLargo(e.desde)) + ' a ' + esc(mesLargo(e.hasta)) + '. Cifras estimadas para un pago el ' + esc(fechaLarga((e.opciones || {}).fecha_pago) || 'día de la estimación') + '.</p>' +
      '<div class="cifras">' +
      '<div class="cifra" data-cifra="meses"><div class="l">Meses revisados</div><div class="v">' + esc(String(R.mesesRevisados)) + '</div><div class="s">' + esc(mesLargo(e.desde)) + ' a ' + esc(mesLargo(e.hasta)) + '</div></div>' +
      '<div class="cifra" data-cifra="f29"><div class="l">Declaraciones de IVA (F29) a corregir</div><div class="v">' + esc(String(R.f29)) + '</div><div class="s">' + esc(decl) + '</div></div>' +
      '<div class="cifra total" data-cifra="total"><div class="l">Monto estimado a regularizar</div><div class="v">' + esc(totalTxt(R)) + '</div>' +
        '<table>' + des.map(function (d) { return '<tr><td>' + esc(d[0]) + '</td><td>' + esc(pesos(d[1])) + '</td></tr>'; }).join('') + '</table>' +
        (R.provisional ? '<div class="s">Estimación provisional: falta un dato para cerrar el cálculo.</div>' : '') + '</div>' +
      '<div class="cifra" data-cifra="remanente"><div class="l">Su saldo a favor de IVA (remanente)</div>' +
        (rem.calculable ? '<div class="v">' + esc(pesos(rem.hoy)) + ' <span class="flecha">→</span> ' + esc(pesos(rem.corregido)) + '</div><div class="s">Hoy, según lo declarado → al corregir (' + esc(mesLargo(rem.periodo)) + ').</div>'
          : '<div class="v">Por revisar</div><div class="s">Falta información de ' + esc(mesLargo(rem.periodo)) + ' para calcularlo.</div>') + '</div>' +
      '</div>' +
      (R.pagadoDeMas > 0 ? '<div class="caja verde"><b>A su favor:</b> en algunos meses se pagó ' + esc(pesos(R.pagadoDeMas)) + ' más de IVA que lo que correspondía. Es informativo y no se descuenta del monto estimado; lo revisamos aparte (ver «Qué implica regularizar»).</div>' : '') +
      '</section><section class="sec" id="inf-hallazgos">' + cab(logo, cliente) + '<h2>Qué encontramos</h2>' + hallazgos(e, R).map(function (t) { return '<p>' + esc(t) + '</p>'; }).join('') +
      '<div class="bloque-graf"><h3>Diferencia de IVA y saldo a favor, mes a mes</h3>' + grafico(e) +
      '<div class="ley"><span><i style="background:linear-gradient(#A4599C,#803889)"></i>Diferencia de IVA del mes (más impuesto)</span><span><i style="background:#3FA77A"></i>Se pagó de más</span>' +
      '<span><i class="l" style="border-color:#9A8A9C;border-top-style:dashed"></i>Saldo a favor declarado</span><span><i class="l" style="border-color:#D98A00"></i>Saldo a favor corregido</span></div></div></section>';
  }

  function paginaPasos(e, cliente, logo, R) {
    var pasos = [];
    var o = R.orden;
    pasos.push('<b>Corregir ' + esc(plural(R.f29, 'declaración mensual de IVA (F29)', 'declaraciones mensuales de IVA (F29)')) + '</b>' + (o.length ? ', una por mes, partiendo por ' + esc(mesLargo(o[0])) + (o.length > 1 ? ' y terminando en ' + esc(mesLargo(o[o.length - 1])) : '') : '') + '. ' +
      'Se hacen en orden, del mes más antiguo al más reciente, porque cada mes traspasa su saldo a favor al siguiente.' +
      (R.f29Decl ? ' ' + esc(plural(R.f29Decl, 'mes no tiene declaración presentada: se declara', 'meses no tienen declaración presentada: se declaran')) + ' por primera vez, fuera de plazo.' : '') +
      (R.posteriores.length ? ' Incluye ' + esc(lista(R.posteriores)) + ', posteriores al período revisado.' : ''));
    pasos.push('<b>El SII calcula el monto definitivo al presentar.</b> El reajuste, los intereses y la multa dependen del día en que se presenta y se paga. La cifra de este informe (' + esc(totalTxt(R)) + ') es una estimación.');
    pasos.push('<b>Pagar lo que resulte</b> en el sitio del SII o de la Tesorería. Si el monto lo requiere, se puede evaluar un convenio de pago.');
    var deMas = R.deMas.map(function (m) { return esc(mesLargo(m.periodo)) + ' (' + esc(pesos(m.iva_pagado_de_mas)) + ')'; });
    return '<section class="sec" id="inf-pasos">' + cab(logo, cliente) + '<h2>Qué implica regularizar</h2>' +
      '<ol class="pasos">' + pasos.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ol>' +
      '<div class="caja lila"><b>Posible beneficio por corregir a tiempo.</b> Cuando la corrección se presenta de forma voluntaria, antes de que el SII inicie una revisión, el SII puede rebajar (condonar) parte de los intereses y multas según su política vigente. Es una posibilidad que evaluaremos en su caso; no es un monto asegurado y no está descontado de la estimación.</div>' +
      (deMas.length ? '<div class="caja verde"><b>Meses en que se pagó de más.</b> En ' + deMas.join(', ') + ' se pagó más IVA que lo que correspondía. Es informativo: no rebaja el monto a regularizar, pero puede pedirse su devolución o imputación por separado.</div>' : '') +
      '<h2 style="margin-top:8mm">Cómo te ayudamos</h2>' +
      '<p>Con nuestros servicios de regularización, en Contadoor nos hacemos cargo del proceso completo:</p>' +
      '<ul class="ayuda"><li><b>Preparamos y presentamos</b> cada rectificación en el orden correcto, mes a mes.</li>' +
      '<li><b>Revisamos los documentos</b> de compras y ventas que respaldan cada corrección antes de presentarla.</li>' +
      '<li><b>Te acompañamos ante el SII</b> en consultas, revisiones o citaciones relacionadas con estos meses.</li>' +
      '<li><b>Te informamos el monto final</b> que determine el SII antes de pagar, y evaluamos contigo los beneficios que puedan aplicar.</li></ul>' +
      '<p>Conversemos para revisar este diagnóstico y definir los próximos pasos.</p>' +
      '<div class="contacto"><a href="' + esc(WHATSAPP_URL) + '"><small>Escríbenos por WhatsApp</small><b>' + esc(WHATSAPP) + '</b></a>' +
      '<a href="https://' + esc(AGENDA) + '"><small>Agenda una reunión</small><b>' + esc(AGENDA) + '</b></a></div></section>';
  }

  function paginaAnexo(e, cliente, logo, R) {
    var sumDif = 0, hayDif = false;
    var filas = (e.meses || []).map(function (m) {
      var d = difMes(m), r = m.c77 || {}, est = m.estimacion, nota = '';
      if (d != null) { sumDif += d; hayDif = true; }
      if (!m.en_rango) nota = 'Posterior al período revisado';
      else if (m.categoria === 'no_calculable') nota = 'Requiere revisión adicional';
      else if (m.accion === 'declarar_original') nota = 'Sin declaración presentada';
      var pagar = est ? (est.total == null ? 'Por determinar' : pesos(est.total)) : num(m.iva_pagado_de_mas) > 0 ? 'Pagó de más ' + pesos(m.iva_pagado_de_mas) : '—';
      return '<tr' + (m.en_rango ? '' : ' class="post"') + ' data-periodo="' + esc(m.periodo) + '"><td>' + esc(mesLargo(m.periodo)) + (nota ? '<small>' + esc(nota) + '</small>' : '') + '</td>' +
        '<td class="' + (d > 0 ? 'pos' : d < 0 ? 'neg' : '') + '">' + esc(d == null ? '—' : d === 0 ? '$0' : (d > 0 ? '+' : '') + pesos(d)) + '</td>' +
        '<td>' + esc(pesos(r.declarado)) + '</td><td>' + esc(pesos(r.corregido)) + '</td><td>' + esc(pagar) + '</td></tr>';
    }).join('');
    var pie = '<tr id="inf-anexo-total"><td>Total</td><td>' + esc(hayDif ? (sumDif > 0 ? '+' : '') + pesos(sumDif) : '—') + '</td><td></td><td></td><td>' + esc(R.base == null ? 'Por determinar' : pesos(R.base)) + '</td></tr>';
    if (R.otros) pie += '<tr class="otros" id="inf-anexo-otros"><td colspan="4">Otros cargos · ' + esc(R.motivo) + '</td><td>' + esc(pesos(R.otros)) + '</td></tr>' +
      '<tr id="inf-anexo-total-otros"><td colspan="4">Total con otros cargos</td><td>' + esc(totalTxt(R)) + '</td></tr>';
    return '<section class="sec" id="inf-anexo">' + cab(logo, cliente) + '<h2>Anexo · Detalle mes a mes</h2>' +
      '<p class="suave">Diferencia de IVA: IVA según los registros de compras y ventas del SII menos lo declarado en el mes (positivo = más impuesto). Saldo a favor: remanente de crédito fiscal que el F29 traspasa al mes siguiente (código 77 del F29). Monto a pagar del mes: impuesto + reajuste + intereses + multa estimados.</p>' +
      '<table class="anexo"><thead><tr><th>Mes</th><th>Diferencia de IVA</th><th>Saldo a favor declarado</th><th>Saldo a favor corregido</th><th>Monto a pagar del mes</th></tr></thead><tbody>' + filas + '</tbody><tfoot>' + pie + '</tfoot></table>' +
      '<p class="legal">' + esc(AVISO_LEGAL) + ' Asesorías Contadoor Ltda. · contadoor.cl</p></section>';
  }

  function limpio(t) { return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 50); }
  /** HTML completo del informe (se imprime con la ventana de impresión del navegador). */
  function documento(e, cliente, logo, otros) {
    cliente = cliente || {};
    var R = resumen(e, otros);
    var titulo = ['Diagnostico_IVA', limpio(cliente.razon) || 'cliente', e.desde + '-' + e.hasta].join('_');
    return '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>' + esc(titulo) + '</title>' +
      '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Montserrat:wght@700;800&display=swap" rel="stylesheet"><style>' + CSS + '</style></head><body>' +
      portada(e, cliente, logo) + paginaResumen(e, cliente, logo, R) + paginaPasos(e, cliente, logo, R) + paginaAnexo(e, cliente, logo, R) + '</body></html>';
  }
  function logoUrl() { return new URL('../assets/contadoor-lockup-glossy.png', raiz.location.href).href; }

  /** Botón «Informe para el cliente (PDF)»: bitácora primero (fail-closed) y luego la ventana de impresión. */
  function exportar(ctx, e, ui) {
    ui = ui || {};
    function av(t, c) { if (ui.aviso) ui.aviso(t, c); }
    var LD = raiz.GestoorLevDetalle;
    if (!e || !LD || !LD.imprimirHtml) { av('No se pudo preparar el informe para el cliente. Intenta de nuevo.', 'roj'); return Promise.resolve(null); }
    if (ui.boton) ui.boton.disabled = true;
    av('Preparando el informe para el cliente…');
    return ctx.rpc('sii_levantamiento_registrar_exportacion', { p_cliente_id: Number(ctx.cliente.id), p_desde: e.desde, p_hasta: e.hasta, p_tipo: TIPO_BITACORA })
      .then(function () {
        var html = documento(e, ctx.cliente, logoUrl(), ctx.otros);
        if (ui.boton) ui.boton.disabled = false;
        LD.imprimirHtml(html);
        av('Informe para el cliente listo: elige «Guardar como PDF» en la ventana de impresión. Revisa las cifras antes de enviarlo.', 'ver');
        return html;
      })
      .catch(function (err) {
        if (ui.boton) ui.boton.disabled = false;
        av(ctx && ctx.mensajeError ? ctx.mensajeError(err) : 'No pudimos registrar la exportación: no se generó el informe.', 'roj');
        return null;
      });
  }

  raiz.GestoorLevInforme = { exportar: exportar, documento: documento, resumen: resumen, hallazgos: hallazgos, grafico: grafico, difMes: difMes,
    AVISO_LEGAL: AVISO_LEGAL, TIPO_BITACORA: TIPO_BITACORA, WHATSAPP: WHATSAPP, AGENDA: AGENDA };
})(window);
