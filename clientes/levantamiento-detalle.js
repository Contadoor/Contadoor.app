/* ============================================================
   clientes/levantamiento-detalle.js — DETALLE DE DOCUMENTOS y BORRADOR DE F29 RECTIFICATORIO del «Levantamiento de IVA»
   (24-11-2026). Se abre desde levantamiento-iva.js (doble clic o lupa en un mes; botones «Exportar Excel» y «Borradores F29»).
   · Todo el cálculo está en el servidor (aquí solo se pinta):
       public.sii_levantamiento_detalle_mes   → resumen del RCV por libro y tipo + comparación por código del mes
       public.sii_documentos_periodo          → lista de documentos (RPC de Contable, reutilizada; montos positivos + «signo»)
       public.sii_levantamiento_borrador_f29  → borrador mes a mes con remanente encadenado y estimación aparte (deja bitácora)
       public.sii_levantamiento_registrar_exportacion → bitácora de cada Excel / PDF ANTES de generarlo (si falla, no se exporta)
   · Permiso real: Master o analista contable asignado (42501 si no). Datos externos SIEMPRE con textContent; el PDF se arma
     con texto escapado. Mes sin detalle por documento = se dice claramente (nunca se inventa la apertura por tipo).
   · Excel: .xlsx real con ExcelJS 4.4.0 (cdnjs, versión exacta + SRI), cargado solo al exportar.
   · Al cliente: «nuestros servicios» (nunca otra palabra).
   Uso: GestoorLevDetalle.abrirMes(ctx, 'AAAAMM') · exportarExcel(ctx, {mes?}) · borradorTodos(ctx) — ctx lo arma levantamiento-iva.js
   ============================================================ */
(function (raiz) {
  'use strict';
  var doc = raiz.document;
  var MORADO = '#924893';
  var EXCELJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js';
  var EXCELJS_SRI = 'sha384-Pqp51FUN2/qzfxZxBCtF0stpc9ONI6MYZpVqmo8m20SoaQCzf+arZvACkLkirlPz';
  var AVISO_BORRADOR = 'Borrador preparado por Contadoor para rectificar en sii.cl; verificar antes de presentar.';
  var TIPOS = {
    29: 'Factura de inicio', 30: 'Factura', 32: 'Factura no afecta o exenta', 33: 'Factura electrónica', 34: 'Factura no afecta o exenta electrónica',
    35: 'Boleta', 38: 'Boleta exenta', 39: 'Boleta electrónica', 41: 'Boleta exenta electrónica', 43: 'Liquidación factura electrónica',
    45: 'Factura de compra', 46: 'Factura de compra electrónica', 48: 'Comprobante de pago electrónico', 52: 'Guía de despacho electrónica',
    55: 'Nota de débito', 56: 'Nota de débito electrónica', 60: 'Nota de crédito', 61: 'Nota de crédito electrónica',
    110: 'Factura de exportación electrónica', 111: 'Nota de débito de exportación electrónica', 112: 'Nota de crédito de exportación electrónica',
    914: 'Declaración de ingreso (DIN)'
  };
  var LIBROS = [
    ['venta', 'Ventas', 'venta', null], ['compra_registro', 'Compras (registro)', 'compra', 'registro'], ['compra_pendiente', 'Pendientes', 'compra', 'pendiente'],
    ['compra_reclamado', 'Reclamados', 'compra', 'reclamado'], ['compra_no_incluir', 'No incluir', 'compra', 'no_incluir']
  ];
  var DETALLE = {
    sin_detalle: 'Este mes solo tiene el resumen del SII (cantidad e IVA total), sin el detalle por documento. No se puede abrir por tipo ni armar el borrador: pide la «Historia SII» o el historial a Cartapra.',
    parcial: 'El detalle por documento no cuadra con el resumen del SII de este mes (faltan documentos). Se muestra lo que hay, pero no se arma el borrador.',
    sin_rcv: 'No hay compras ni ventas del SII para este mes (pide el historial a Cartapra o la Historia SII).'
  };
  var ESTADOS_B = {
    con_diferencia: { t: 'Con diferencia: rectificar', c: 'roj' }, sin_diferencia: { t: 'Sin diferencia', c: 'ver' },
    dentro_tolerancia: { t: 'Diferencia menor (±$100)', c: 'ver' }, sin_detalle: { t: 'Sin detalle por documento', c: 'gris' },
    sin_rcv: { t: 'Sin RCV', c: 'gris' }, f29_sin_montos: { t: 'F29 sin montos', c: 'gris' },
    sin_f29: { t: 'Sin F29: declarar fuera de plazo', c: 'roj' }, en_plazo: { t: 'En plazo', c: 'gris' }
  };
  var ALERTAS_B = {
    remanente_encadenado: 'El remanente anterior (cód. 504) cambia porque el mes anterior corrigió su remanente (cód. 77), reajustado por UTM.',
    cambia_504_siguiente: 'Este mes corrige su remanente (cód. 77): el F29 del mes siguiente cambia su cód. 504 y también debe rectificarse.',
    cadena_cortada_con_cambio: 'El mes anterior corrigió su remanente, pero este mes no tiene borrador (sin detalle o sin montos): el cambio no se pudo llevar adelante. Revisar a mano.',
    remanente_sin_reajuste_utm: 'Falta la UTM para reajustar el remanente: se pasó sin reajustar (provisional).',
    conservado_mayor_que_rcv: 'Lo conservado del F29 original (activo fijo, supermercados, sin derecho…) supera lo que trae el RCV: revisar a mano.',
    linea50_no_estandar: 'El IVA determinado original (cód. 89) no es débitos menos créditos (p. ej. IVA postergado o anticipos): revisar el cód. 89 a mano.',
    lineas_conservadas_descontadas: 'Activo fijo, inmuebles, supermercados, NC de vales o IVA sin derecho se copiaron del original y se descontaron de lo que trae el RCV.',
    factura_compra_retencion: 'Hay facturas de compra (45/46): revisar los códigos de retención y cambio de sujeto (se copiaron del original).',
    nc_papel: 'Hay notas de crédito en papel (tipo 60): verificar su signo.',
    tipos_sin_codigo: 'Hay tipos de documento que el borrador no reparte en códigos (se ven en el detalle; no cambian el F29).',
    rcv_parcial: 'La lectura del RCV quedó parcial: borrador preliminar.'
  };
  var SECCIONES = [['debitos', 'Débitos y ventas'], ['creditos', 'Créditos y compras'], ['determinacion', 'Determinación del IVA'], ['renta', 'Impuestos a la renta (sin cambio)'], ['otros', 'Total']];
  var REGLA = { rcv: 'Según RCV', calculado: 'Calculado', encadenado: 'Encadenado', conservado: 'Del original' };
  var NOMBRE_MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  function el(tag, cls, txt) { var e = doc.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function num(v) { return v == null || v === '' || isNaN(Number(v)) ? null : Number(v); }
  function pesos(v) { var n = num(v); return n == null ? '—' : (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString('es-CL'); }
  function cant(v) { var n = num(v); return n == null ? '—' : Math.round(n).toLocaleString('es-CL'); }
  function mesTxt(p) { p = String(p || ''); return p.length === 6 ? NOMBRE_MES[Number(p.slice(4)) - 1] + ' ' + p.slice(0, 4) : p; }
  function fechaTxt(f) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(f || '')); return m ? m[3] + '-' + m[2] + '-' + m[1] : String(f || ''); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function tipoTxt(t) { return t + ' · ' + (TIPOS[t] || 'Otro documento'); }
  function esCantidad(c) { return /cantidad/i.test(c.glosa || ''); }
  function valCod(c, v) { return esCantidad(c) || c.codigo === '115' ? cant(v) : pesos(v); }
  function meses(desde, hasta) { var r = [], y = +desde.slice(0, 4), m = +desde.slice(4); while (y * 100 + m <= +hasta) { r.push(y + String(m).padStart(2, '0')); m++; if (m > 12) { m = 1; y++; } } return r; }
  function limpio(t) { return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 50); }

  // ── Estilos (tema noche de Gestoor, mismas variables que levantamiento-iva.js) ──
  function estilos() {
    if (raiz.GestoorLevIVA && raiz.GestoorLevIVA.estilos) raiz.GestoorLevIVA.estilos();   // velo, botones y mensajes del levantamiento
    if (doc.getElementById('livd-css')) return;
    var s = el('style'); s.id = 'livd-css';
    s.textContent = [
      '.livd-velo{position:fixed;inset:0;z-index:440;background:rgba(12,7,14,.78);display:flex;align-items:flex-start;justify-content:center;padding:16px;overflow:auto}',
      '.livd-caja{width:1180px;max-width:100%;background:#1E1222;color:#F2EAF4;border:1px solid #3A2140;border-radius:18px;padding:18px 20px;box-shadow:0 30px 80px rgba(0,0,0,.6)}',
      '.livd-cab{display:flex;align-items:center;gap:10px}.livd-cab h3{margin:0;flex:1;font:800 17px var(--g-titulo,Montserrat,sans-serif)}.livd-cab h3 span{color:#E39BE5;font-weight:700;font-size:13px;display:block;margin-top:2px}',
      '.livd-h4{margin:16px 0 6px;font:800 13px var(--g-titulo,Montserrat,sans-serif);color:#E39BE5}',
      '.livd-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-top:16px;border-bottom:1px solid #3A2140}',
      '.livd-tab{border:1px solid #3A2140;border-bottom:0;background:transparent;color:#C9A8CC;border-radius:10px 10px 0 0;padding:8px 14px;font:700 12.5px Inter,sans-serif;cursor:pointer}',
      '.livd-tab[aria-selected="true"]{background:#2A1430;color:#fff;border-color:#6B4672}.livd-tab:focus-visible{outline:2px solid #E39BE5}',
      '.livd-t{width:100%;border-collapse:collapse;font-size:12px;font-variant-numeric:tabular-nums}',
      '.livd-t th{position:sticky;top:0;z-index:2;background:#2A1430;color:#C9A8CC;font-size:10.5px;text-transform:uppercase;letter-spacing:.4px;text-align:right;padding:7px 8px;white-space:nowrap}',
      '.livd-t td{padding:5px 8px;border-top:1px solid #33203A;text-align:right;white-space:nowrap}',
      '.livd-t th+th{border-left:1px solid rgba(201,168,204,.30)}.livd-t td+td{border-left:1px solid rgba(201,168,204,.18)}',
      '.livd-t .izq{text-align:left}.livd-t tr.grupo td{background:rgba(146,72,147,.18);font-weight:800;color:#F3E9F4}',
      '.livd-t td.neg{color:#FFC85A}.livd-t td.roj{color:#FF8A7A;font-weight:800}.livd-t td.ver{color:#46D69A}',
      '.livd-t tr.tot td{font-weight:800;border-top:2px solid #6B4672}',
      '.livd-tw{margin-top:0;overflow:auto;max-height:52vh;border:1px solid #3A2140;border-top:0;border-radius:0 0 12px 12px}',
      '.livd-cmp{overflow:auto;border:1px solid #3A2140;border-radius:12px}',
      '.livd-nota{margin-top:8px;font-size:11.5px;color:#C9A8CC;line-height:1.5}',
      '.livd-prev{width:100%;height:70vh;border:1px solid #3A2140;border-radius:12px;background:#fff;margin-top:12px}'
    ].join('\n');
    doc.head.appendChild(s);
  }

  function errorTxt(ctx, e) { return ctx && ctx.mensajeError ? ctx.mensajeError(e) : 'No pudimos cargar ahora. Intenta de nuevo.'; }

  // ── Datos ──
  var cacheBorr = typeof WeakMap === 'function' ? new WeakMap() : null;
  /** Borrador del rango COMPLETO del último cálculo (el remanente se encadena desde el primer mes). Una llamada por cálculo. */
  function borrador(ctx) {
    var k = ctx.datos, c = cacheBorr && k ? cacheBorr.get(k) : null;
    if (c) return c;
    var p = ctx.rpc('sii_levantamiento_borrador_f29', { p_cliente_id: Number(ctx.cliente.id), p_desde: ctx.desde, p_hasta: ctx.hasta, p_opciones: ctx.opciones || {} });
    if (cacheBorr && k) { cacheBorr.set(k, p); p.catch(function () { cacheBorr.delete(k); }); }
    return p;
  }
  function documentos(ctx, per, libro) {
    return ctx.rpc('sii_documentos_periodo', { p_cliente_id: Number(ctx.cliente.id), p_periodo: per, p_libro: libro });
  }
  function registrar(ctx, desde, hasta, tipo) {
    return ctx.rpc('sii_levantamiento_registrar_exportacion', { p_cliente_id: Number(ctx.cliente.id), p_desde: desde, p_hasta: hasta, p_tipo: tipo });
  }
  /** Documentos de un libro con el estado pedido (compras: registro / pendiente / reclamado / no_incluir) y monto con signo. */
  function filtrar(r, estado) {
    return ((r && r.documentos) || []).filter(function (x) { return !estado || x.estado === estado; }).map(function (x) {
      var s = Number(x.signo) === -1 ? -1 : 1;
      return { tipo: x.tipo_dte, folio: x.folio, fecha: x.fecha, rut: x.rut, razon: x.razon_social, estado: x.estado,
               neto: s * Math.abs(Number(x.neto || 0)), exento: s * Math.abs(Number(x.exento || 0)), iva: s * Math.abs(Number(x.iva || 0)), total: s * Math.abs(Number(x.total || 0)) };
    });
  }

  // ── Panel del mes ──
  var panel = null;
  function cerrarMes() { if (panel) panel.remove(); panel = null; doc.removeEventListener('keydown', escMes, true); }
  function escMes(ev) { if (ev.key === 'Escape' && panel) { ev.stopPropagation(); cerrarMes(); } }

  function abrirMes(ctx, per) {
    cerrarMes(); estilos();
    var velo = el('div', 'livd-velo'); velo.id = 'livd-velo'; velo.setAttribute('role', 'dialog'); velo.setAttribute('aria-modal', 'true');
    velo.setAttribute('aria-label', 'Documentos de ' + mesTxt(per));
    var caja = el('div', 'livd-caja'); velo.appendChild(caja);
    var cab = el('div', 'livd-cab'); var h = el('h3', null, 'Documentos del SII · ' + mesTxt(per));
    h.appendChild(el('span', null, (ctx.cliente.razon || 'Cliente') + (ctx.cliente.rut ? ' · ' + ctx.cliente.rut : ''))); cab.appendChild(h);
    var bX = el('button', 'liva-btn sec', 'Exportar Excel del mes'); bX.type = 'button'; bX.id = 'livd-excel'; bX.disabled = true; cab.appendChild(bX);
    var bB = el('button', 'liva-btn sec', 'Borrador F29 del mes'); bB.type = 'button'; bB.id = 'livd-borrador'; bB.disabled = true; cab.appendChild(bB);
    var x = el('button', 'liva-x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Cerrar'); x.addEventListener('click', cerrarMes); cab.appendChild(x);
    caja.appendChild(cab);
    var msg = el('div', 'liva-msg', 'Cargando los documentos del mes…'); msg.id = 'livd-msg'; caja.appendChild(msg);
    var cuerpo = el('div'); cuerpo.id = 'livd-cuerpo'; caja.appendChild(cuerpo);
    velo.addEventListener('click', function (ev) { if (ev.target === velo) cerrarMes(); });
    doc.addEventListener('keydown', escMes, true);
    doc.body.appendChild(velo); panel = velo;
    function aviso(t, c) { msg.className = 'liva-msg' + (c ? ' ' + c : ''); msg.textContent = t; }

    Promise.all([
      ctx.rpc('sii_levantamiento_detalle_mes', { p_cliente_id: Number(ctx.cliente.id), p_periodo: per }),
      documentos(ctx, per, 'venta'), documentos(ctx, per, 'compra')
    ]).then(function (r) {
      if (panel !== velo) return;
      var det = r[0] || {}, docs = { venta: r[1], compra: r[2] };
      pintarMes(cuerpo, det, docs);
      var t = DETALLE[det.detalle];
      aviso(t || ('Detalle completo: ' + cant(((det.resumen || {}).venta || {}).total ? det.resumen.venta.total.documentos : 0) + ' ventas y ' +
        cant(((det.resumen || {}).compra_registro || {}).total ? det.resumen.compra_registro.total.documentos : 0) + ' compras en registro.' +
        ((r[1] && r[1].truncado) || (r[2] && r[2].truncado) ? ' La lista muestra los primeros 3.000 documentos de cada libro (los subtotales por tipo son completos).' : '')),
        t ? (det.detalle === 'parcial' ? 'amb' : 'amb') : 'ver');
      bX.disabled = false; bB.disabled = false;
      bX.addEventListener('click', function () { exportarExcel(ctx, { mes: per, boton: bX, aviso: aviso, docsMes: docs }); });
      bB.addEventListener('click', function () { verBorradorMes(ctx, per, { boton: bB, aviso: aviso }); });
    }).catch(function (e) { if (panel !== velo) return; aviso(errorTxt(ctx, e), 'roj'); });
  }

  function th(tr, txt, izq) { var c = el('th', izq ? 'izq' : null, txt); tr.appendChild(c); return c; }
  function td(tr, txt, cls) { var c = el('td', cls || null, txt); tr.appendChild(c); return c; }

  function pintarMes(cont, det, docs) {
    cont.textContent = '';
    // Comparación IVA RCV vs F29 (por código)
    var f = det.f29;
    cont.appendChild(el('div', 'livd-h4', 'IVA del RCV vs declarado en el F29' + (f ? ' · folio ' + f.folio + (f.rectificada ? ' (ya rectificado antes)' : '') : ' · sin F29 declarado')));
    if (det.codigos && det.codigos.length) {
      var w = el('div', 'livd-cmp'), t = el('table', 'livd-t'); t.id = 'livd-comparacion';
      var hr = el('tr'); th(hr, 'Código', true); th(hr, 'Glosa', true); th(hr, 'Declarado F29'); th(hr, 'Según RCV'); th(hr, 'Diferencia');
      var hd = el('thead'); hd.appendChild(hr); t.appendChild(hd);
      var tb = el('tbody');
      det.codigos.filter(function (c) { return c.regla !== 'conservado' && c.seccion !== 'renta'; }).forEach(function (c) {
        var r = el('tr'); r.setAttribute('data-codigo', c.codigo);
        td(r, c.codigo, 'izq'); td(r, c.glosa, 'izq'); td(r, f && f.montos ? valCod(c, c.original) : '—'); td(r, valCod(c, c.corregido));
        var dif = num(c.diferencia); td(r, valCod(c, c.diferencia), dif ? 'roj' : 'ver');
        tb.appendChild(r);
      });
      t.appendChild(tb); w.appendChild(t); cont.appendChild(w);
      if (det.nota) cont.appendChild(el('div', 'livd-nota', det.nota));
    } else {
      cont.appendChild(el('div', 'livd-nota', f && !f.montos ? 'El F29 de este mes aún no tiene montos: pide el historial a Cartapra.' : (DETALLE[det.detalle] || 'Sin comparación disponible.')));
    }
    (det.alertas || []).forEach(function (a) { if (ALERTAS_B[a]) cont.appendChild(el('div', 'livd-nota', '· ' + ALERTAS_B[a])); });
    if ((det.tipos_sin_codigo || []).length) cont.appendChild(el('div', 'livd-nota', 'Tipos sin código en el F29: ' + det.tipos_sin_codigo.map(function (x) { return tipoTxt(x.tipo_dte); }).join(', ') + '.'));

    // Pestañas por libro
    var tabs = el('div', 'livd-tabs'); tabs.setAttribute('role', 'tablist'); cont.appendChild(tabs);
    var cuerpo = el('div', 'livd-tw'); cuerpo.setAttribute('role', 'tabpanel'); cuerpo.id = 'livd-tabla'; cont.appendChild(cuerpo);
    var botones = [];
    LIBROS.forEach(function (L, i) {
      var res = (det.resumen || {})[L[0]] || {}, n = res.total ? res.total.documentos : 0;
      var b = el('button', 'livd-tab', L[1] + ' (' + cant(n) + ')'); b.type = 'button'; b.setAttribute('role', 'tab'); b.setAttribute('data-libro', L[0]);
      b.setAttribute('aria-selected', i === 0 ? 'true' : 'false'); b.setAttribute('aria-controls', 'livd-tabla');
      b.addEventListener('click', function () { botones.forEach(function (o) { o.setAttribute('aria-selected', o === b ? 'true' : 'false'); }); tabla(L); });
      tabs.appendChild(b); botones.push(b);
    });
    function tabla(L) {
      cuerpo.textContent = '';
      var res = (det.resumen || {})[L[0]] || {}, lista = filtrar(docs[L[2]], L[3]);
      if (res.resumen_sii && Number(res.resumen_sii.documentos) > 0 && !(res.total && res.total.documentos)) {
        cuerpo.appendChild(el('div', 'liva-msg amb', 'Sin detalle por documento: el SII informa ' + cant(res.resumen_sii.documentos) + ' documentos con IVA ' + pesos(res.resumen_sii.iva) + ' en este libro, pero no tenemos la lista.'));
        return;
      }
      var t = el('table', 'livd-t'), hr = el('tr');
      ['Fecha', 'Tipo', 'Folio', 'RUT', 'Razón social'].forEach(function (x) { th(hr, x, true); });
      ['Neto', 'Exento', 'IVA', 'Total'].forEach(function (x) { th(hr, x); });
      var hd = el('thead'); hd.appendChild(hr); t.appendChild(hd);
      var tb = el('tbody');
      (res.tipos || []).forEach(function (g) {
        var r = el('tr', 'grupo'); r.setAttribute('data-tipo', g.tipo_dte);
        var c = td(r, tipoTxt(g.tipo_dte) + ' · ' + cant(g.documentos) + (Number(g.documentos) === 1 ? ' documento' : ' documentos'), 'izq'); c.colSpan = 5;
        [g.neto, g.exento, g.iva, g.total].forEach(function (v) { td(r, pesos(v), num(v) < 0 ? 'neg' : null); });
        tb.appendChild(r);
        lista.filter(function (d) { return Number(d.tipo) === Number(g.tipo_dte); }).forEach(function (d) {
          var rr = el('tr', 'doc');
          td(rr, fechaTxt(d.fecha), 'izq'); td(rr, String(d.tipo), 'izq'); td(rr, String(d.folio), 'izq'); td(rr, d.rut || '—', 'izq'); td(rr, d.razon || '—', 'izq');
          [d.neto, d.exento, d.iva, d.total].forEach(function (v) { td(rr, pesos(v), v < 0 ? 'neg' : null); });
          tb.appendChild(rr);
        });
      });
      if (res.total) {
        var rt = el('tr', 'tot'); var c0 = td(rt, 'Total ' + L[1].toLowerCase(), 'izq'); c0.colSpan = 5;
        [res.total.neto, res.total.exento, res.total.iva, res.total.total].forEach(function (v) { td(rt, pesos(v)); }); tb.appendChild(rt);
      }
      if (!(res.tipos || []).length) { var r0 = el('tr'); var c1 = td(r0, 'Sin documentos en este libro.', 'izq'); c1.colSpan = 9; tb.appendChild(r0); }
      t.appendChild(tb); cuerpo.appendChild(t);
    }
    tabla(LIBROS[0]);
  }

  // ── Borrador F29 (documento de marca; se muestra en un iframe y se imprime desde él) ──
  function estadoB(m) { return ESTADOS_B[m.estado] || { t: m.estado, c: 'gris' }; }
  function aRectificar(m) { return m.estado === 'con_diferencia' || m.estado === 'sin_f29'; }
  function tablaCodigos(m) {
    var cods = m.codigos || [], h = '';
    SECCIONES.forEach(function (S) {
      var filas = cods.filter(function (c) { return c.seccion === S[0]; });
      if (!filas.length) return;
      h += '<h3>' + esc(S[1]) + '</h3><table class="f29"><thead><tr><th>Código</th><th>Línea</th><th class="g">Descripción</th><th>Declarado (original)</th><th>Corregido (según RCV)</th><th>Diferencia</th><th>Origen</th></tr></thead><tbody>' +
        filas.map(function (c) {
          var dif = num(c.diferencia), cl = dif ? ' class="cambia"' : '';
          return '<tr' + cl + '><td class="b">' + esc(c.codigo) + '</td><td>' + esc(c.linea) + '</td><td class="g">' + esc(c.glosa) + '</td><td>' + esc(m.f29 && m.f29.montos ? valCod(c, c.original) : '—') +
            '</td><td class="b">' + esc(valCod(c, c.corregido)) + '</td><td class="b">' + esc(dif ? valCod(c, c.diferencia) : '—') + '</td><td class="r">' + esc(REGLA[c.regla] || c.regla) + '</td></tr>';
        }).join('') + '</tbody></table>';
    });
    var otros = m.otros_codigos_conservados || {}, ks = Object.keys(otros);
    if (ks.length) h += '<p class="nota">Otros códigos del F29 original que se mantienen sin cambio: ' + ks.map(function (k) { return 'cód. ' + esc(k) + ' = ' + esc(cant(otros[k])); }).join(' · ') + '.</p>';
    return h;
  }
  function cajaEstimacion(e) {
    if (!e) return '<div class="est"><b>Estimación</b>: sin diferencia de impuesto a pagar en este mes (no se estima reajuste, intereses ni multa).</div>';
    return '<div class="est"><b>ESTIMACIÓN (referencial, no es parte del formulario)</b> · pago supuesto el ' + esc(fechaTxt(e.fecha_pago)) + ' · vencía el ' + esc(fechaTxt(e.vencimiento)) + ' · ' + esc(String(e.meses_atraso)) + ' meses de atraso<br>' +
      'Impuesto ' + esc(pesos(e.impuesto)) + ' · reajuste ' + esc(e.reajuste == null ? 'pendiente (falta UTM)' : pesos(e.reajuste)) + ' · intereses ' + esc(e.intereses == null ? 'pendientes (falta tasa)' : pesos(e.intereses)) +
      ' · multa ' + esc(String(Math.round(Number(e.multa_pct) * 100))) + ' % = ' + esc(pesos(e.multa)) + ' · <b>total estimado ' + esc(e.total == null ? 'no calculable' : pesos(e.total)) + '</b>' + (e.calidad === 'provisional' ? ' (provisional)' : '') +
      '<br>Al presentar la rectificatoria, el SII calcula los reajustes, intereses y multas definitivos.</div>';
  }
  function paginaMes(m, cliente, logo) {
    var es = estadoB(m), f = m.f29, iv = m.iva_determinado || {};
    var al = (m.alertas || []).filter(function (a) { return ALERTAS_B[a]; }).map(function (a) { return '<li>' + esc(ALERTAS_B[a]) + '</li>'; }).join('');
    return '<section class="pag"><div class="hd"><img src="' + esc(logo) + '" alt="Contadoor"><div><h1>' + (m.estado === 'sin_f29' ? 'Borrador de F29 original (fuera de plazo)' : aRectificar(m) || m.estado === 'dentro_tolerancia' ? 'Borrador de F29 rectificatorio' : 'Revisión del F29 (sin diferencia)') + '</h1><p>' +
      esc(cliente.razon || '') + (cliente.rut ? ' · RUT ' + esc(cliente.rut) : '') + ' · Período tributario <b>' + esc(mesTxt(m.periodo)) + '</b></p></div></div>' +
      '<p class="aviso">' + esc(AVISO_BORRADOR) + '</p>' +
      '<div class="ks"><div class="k"><div class="l">Folio original</div><div class="v">' + esc(f ? String(f.folio) : 'Sin F29') + '</div></div>' +
      '<div class="k"><div class="l">Estado</div><div class="v ' + es.c + '">' + esc(es.t) + '</div></div>' +
      '<div class="k"><div class="l">IVA determinado (cód. 89)</div><div class="v">' + esc(pesos(iv.original)) + ' → ' + esc(pesos(iv.corregido)) + '</div></div>' +
      '<div class="k"><div class="l">Remanente (cód. 77)</div><div class="v">' + esc(pesos((m.remanente || {}).original)) + ' → ' + esc(pesos((m.remanente || {}).corregido)) + '</div></div></div>' +
      (m.estado === 'sin_f29' ? '<p class="nota">No hay F29 que rectificar: este mes se declara por primera vez (fuera de plazo) en sii.cl; la columna «Declarado» queda vacía.</p>' : '') +
      tablaCodigos(m) + cajaEstimacion(m.estimacion) + (al ? '<h3>Revisar</h3><ul>' + al + '</ul>' : '') +
      '<div class="pie">Rectificar en sii.cl › Impuestos mensuales › Declaración mensual (F29) › Rectificar F29 («Formulario 29 rectificatoria») · Asesorías Contadoor Ltda. · contadoor.cl</div></section>';
  }
  function paginaResumen(b, lista, cliente, logo) {
    var r = b.resumen || {};
    var filas = lista.map(function (m) {
      var iv = m.iva_determinado || {}, e = m.estimacion;
      return '<tr><td class="g">' + esc(mesTxt(m.periodo)) + '</td><td>' + esc(m.f29 ? String(m.f29.folio) : 'Sin F29') + '</td><td class="g">' + esc(estadoB(m).t) + '</td><td>' + esc(pesos(iv.original)) + '</td><td>' + esc(pesos(iv.corregido)) +
        '</td><td class="b">' + esc(pesos(iv.diferencia)) + '</td><td>' + esc(pesos((m.remanente || {}).original)) + ' → ' + esc(pesos((m.remanente || {}).corregido)) + '</td><td>' + esc(e ? (e.total == null ? 'No calculable' : pesos(e.total)) : '—') + '</td></tr>';
    }).join('');
    return '<section class="pag"><div class="hd"><img src="' + esc(logo) + '" alt="Contadoor"><div><h1>Borradores de F29 a rectificar</h1><p>' + esc(cliente.razon || '') + (cliente.rut ? ' · RUT ' + esc(cliente.rut) : '') +
      ' · Rango ' + esc(mesTxt(b.desde)) + ' a ' + esc(mesTxt(b.hasta)) + '</p></div></div><p class="aviso">' + esc(AVISO_BORRADOR) + '</p>' +
      '<div class="ks"><div class="k"><div class="l">Meses a rectificar</div><div class="v roj">' + esc(String(lista.length)) + '</div></div><div class="k"><div class="l">Diferencia de IVA (cód. 89)</div><div class="v">' + esc(pesos(r.diferencia_iva)) + '</div></div>' +
      '<div class="k"><div class="l">Estimación total (referencial)</div><div class="v">' + esc(r.estimacion_no_calculable ? 'No calculable' : pesos(r.estimacion_total)) + '</div></div></div>' +
      '<table class="f29"><thead><tr><th class="g">Mes</th><th>Folio original</th><th class="g">Estado</th><th>Cód. 89 original</th><th>Cód. 89 corregido</th><th>Diferencia</th><th>Cód. 77 original → corregido</th><th>Estimación</th></tr></thead><tbody>' + (filas || '<tr><td class="g" colspan="8">No hay meses con diferencia en el rango.</td></tr>') + '</tbody></table>' +
      (r.remanente_cambia_fuera_de_rango ? '<p class="nota">El remanente corregido del último mes cambia el F29 de ' + esc(mesTxt(r.remanente_cambia_fuera_de_rango)) + ', fuera del rango revisado: amplía el rango para incluirlo.</p>' : '') +
      ((r.cadena_cortada_en || []).length ? '<p class="nota">La cadena del remanente se corta en ' + esc(r.cadena_cortada_en.map(mesTxt).join(', ')) + ' (mes sin detalle o sin montos): revisar esos meses a mano.</p>' : '') +
      '<h3>Cómo se presenta</h3><ul>' + (b.instrucciones || []).map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>' +
      '<p class="nota">Códigos según: ' + esc(b.fuente_codigos || 'SII, Instrucciones para llenar el Formulario 29') + '. Este borrador no incluye el costo de nuestros servicios de regularización.</p>' +
      '<div class="pie">Asesorías Contadoor Ltda. · contadoor.cl</div></section>';
  }
  var CSS_B = '@page{size:A4;margin:9mm}*{-webkit-print-color-adjust:exact;print-color-adjust:exact;box-sizing:border-box}' +
    'body{margin:0;font-family:Inter,Arial,sans-serif;color:#2A1430;font-size:9.5px;background:#fff}.pag{break-after:page;page-break-after:always}.pag:last-child{break-after:auto;page-break-after:auto}' +
    '.hd{display:flex;align-items:center;gap:16px;background:' + MORADO + ';color:#fff;padding:12px 16px;border-radius:12px}.hd img{height:30px}.hd h1{margin:0;font:800 17px Montserrat,Arial,sans-serif}.hd p{margin:2px 0 0;font-size:11px;opacity:.94}' +
    '.aviso{margin:8px 0;padding:7px 10px;border:2px solid #D34433;border-radius:8px;color:#D34433;font:800 11px Montserrat,Arial,sans-serif;text-align:center}' +
    '.ks{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0}.k{flex:1;min-width:110px;border:1px solid #E7D6EA;border-radius:9px;padding:6px 9px}.k .l{font-size:8px;text-transform:uppercase;letter-spacing:.4px;color:#7A6080}.k .v{font:800 12px Montserrat,Arial,sans-serif;margin-top:2px}.v.roj{color:#D34433}.v.ver{color:#28865B}.v.gris{color:#7A6E7C}' +
    'h3{font:800 11.5px Montserrat,Arial,sans-serif;color:' + MORADO + ';margin:10px 0 4px}table.f29{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}' +
    'table.f29 th{background:#F6ECF6;color:#5B4560;font-size:7.8px;text-transform:uppercase;padding:4px 5px;text-align:right}table.f29 td{padding:3px 5px;border-top:1px solid #EFE3F1;text-align:right}' +
    'table.f29 th+th{border-left:1px solid #E0CCE4}table.f29 td+td{border-left:1px solid #EFE3F1}table.f29 .g{text-align:left}table.f29 td.b{font-weight:700}table.f29 td.r{color:#7A6080;font-size:8px}' +
    'table.f29 tr.cambia td{background:#FFF4F2}table.f29 tr.cambia td.b{color:#D34433}tr{break-inside:avoid}' +
    '.est{margin-top:8px;padding:7px 10px;border-radius:8px;background:#FFF6E0;color:#7A5200;line-height:1.5;border:1px dashed #C9962A}.nota{color:#5B4560;margin:6px 0;line-height:1.45}' +
    'ul{margin:4px 0;padding-left:16px;line-height:1.5;color:#5B4560}.pie{margin-top:10px;color:#9A8A9C;font-size:8px;text-align:right}';
  function documentoBorrador(b, lista, cliente, logo, conResumen) {
    var titulo = ['Borrador_F29', limpio(cliente.razon) || 'cliente', lista.length === 1 && !conResumen ? lista[0].periodo : b.desde + '-' + b.hasta].join('_');
    return '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>' + esc(titulo) + '</title>' +
      '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Montserrat:wght@700;800&display=swap" rel="stylesheet"><style>' + CSS_B + '</style></head><body>' +
      (conResumen ? paginaResumen(b, lista, cliente, logo) : '') + lista.map(function (m) { return paginaMes(m, cliente, logo); }).join('') + '</body></html>';
  }
  function logoUrl() { return new URL('../assets/logo-blanco.png', raiz.location.href).href; }
  function imprimirHtml(html) {
    var previo = doc.getElementById('livd-pdf-frame'); if (previo) previo.remove();
    var f = doc.createElement('iframe'); f.id = 'livd-pdf-frame'; f.setAttribute('aria-hidden', 'true');
    f.style.cssText = 'position:fixed;right:0;bottom:0;width:900px;height:800px;border:0;opacity:0;pointer-events:none;z-index:-1';
    f.onload = function () {
      var w = f.contentWindow, dd = f.contentDocument, imgs = Array.prototype.slice.call((dd && dd.images) || []);
      var esp = Promise.all(imgs.map(function (im) { return im.complete ? 1 : new Promise(function (r) { im.onload = im.onerror = r; }); }));
      Promise.race([Promise.all([esp, dd && dd.fonts && dd.fonts.ready ? dd.fonts.ready : 1]), new Promise(function (r) { setTimeout(r, 4000); })])
        .then(function () { try { w.focus(); w.print(); } catch (e) { /* */ } });
    };
    f.srcdoc = html; doc.body.appendChild(f);
  }

  /** Vista previa del borrador de UN mes + botón «Imprimir / PDF» (registra en la bitácora antes de imprimir). */
  function verBorradorMes(ctx, per, ui) {
    ui = ui || {}; if (ui.boton) ui.boton.disabled = true; if (ui.aviso) ui.aviso('Preparando el borrador de F29 (encadena el remanente desde ' + mesTxt(ctx.desde) + ')…');
    borrador(ctx).then(function (b) {
      if (ui.boton) ui.boton.disabled = false;
      var m = ((b && b.meses) || []).filter(function (x) { return x.periodo === per; })[0];
      if (!m) { if (ui.aviso) ui.aviso('Este mes no está en el rango calculado.', 'amb'); return; }
      if (!m.codigos) { if (ui.aviso) ui.aviso('No se puede armar el borrador de este mes: ' + estadoB(m).t.toLowerCase() + '.', 'amb'); return; }
      if (ui.aviso) ui.aviso(estadoB(m).t + (m.f29 ? ' · F29 folio ' + m.f29.folio : '') + '.', aRectificar(m) ? 'roj' : 'ver');
      estilos();
      var velo = el('div', 'livd-velo'); velo.id = 'livd-borr-velo'; velo.style.zIndex = '450'; velo.setAttribute('role', 'dialog'); velo.setAttribute('aria-modal', 'true');
      var caja = el('div', 'livd-caja'), cab = el('div', 'livd-cab'); caja.appendChild(cab); velo.appendChild(caja);
      cab.appendChild(el('h3', null, 'Borrador de F29 · ' + mesTxt(per)));
      var bP = el('button', 'liva-btn', 'Imprimir / PDF'); bP.type = 'button'; bP.id = 'livd-imprimir'; cab.appendChild(bP);
      var x = el('button', 'liva-x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Cerrar'); cab.appendChild(x);
      var msg = el('div', 'liva-msg amb', AVISO_BORRADOR); caja.appendChild(msg);
      var html = documentoBorrador(b, [m], ctx.cliente, logoUrl(), false);
      var fr = el('iframe', 'livd-prev'); fr.title = 'Vista previa del borrador'; fr.id = 'livd-prev'; fr.srcdoc = html; caja.appendChild(fr);
      function cerrar() { velo.remove(); }
      x.addEventListener('click', cerrar); velo.addEventListener('click', function (ev) { if (ev.target === velo) cerrar(); });
      bP.addEventListener('click', function () {
        bP.disabled = true;
        registrar(ctx, per, per, 'borrador_pdf_mes').then(function () { bP.disabled = false; imprimirHtml(html); })
          .catch(function (e) { bP.disabled = false; msg.className = 'liva-msg roj'; msg.textContent = errorTxt(ctx, e); });
      });
      doc.body.appendChild(velo);
    }).catch(function (e) { if (ui.boton) ui.boton.disabled = false; if (ui.aviso) ui.aviso(errorTxt(ctx, e), 'roj'); });
  }

  /** Un PDF con resumen + una página por mes con diferencia. Bitácora primero (fail-closed). */
  function borradorTodos(ctx, ui) {
    ui = ui || {}; if (ui.boton) ui.boton.disabled = true; if (ui.aviso) ui.aviso('Preparando los borradores de F29 de los meses con diferencia…');
    borrador(ctx).then(function (b) {
      var lista = ((b && b.meses) || []).filter(aRectificar);
      if (!lista.length) { if (ui.boton) ui.boton.disabled = false; if (ui.aviso) ui.aviso('No hay meses con diferencia que rectificar en el rango.', 'ver'); return null; }
      return registrar(ctx, b.desde, b.hasta, 'borrador_pdf_todos').then(function () {
        if (ui.boton) ui.boton.disabled = false;
        if (ui.aviso) ui.aviso('Borradores listos: ' + lista.length + (lista.length === 1 ? ' mes' : ' meses') + ' a rectificar. ' + AVISO_BORRADOR, 'amb');
        imprimirHtml(documentoBorrador(b, lista, ctx.cliente, logoUrl(), true));
      });
    }).catch(function (e) { if (ui.boton) ui.boton.disabled = false; if (ui.aviso) ui.aviso(errorTxt(ctx, e), 'roj'); });
  }

  // ── Excel (.xlsx real con ExcelJS) ──
  var cargaExcel = null;
  function excelJS() {
    if (raiz.ExcelJS) return Promise.resolve(raiz.ExcelJS);
    if (cargaExcel) return cargaExcel;
    cargaExcel = new Promise(function (ok, mal) {
      var s = doc.createElement('script'); s.src = EXCELJS_URL; s.integrity = EXCELJS_SRI; s.crossOrigin = 'anonymous'; s.referrerPolicy = 'no-referrer';
      s.onload = function () { raiz.ExcelJS ? ok(raiz.ExcelJS) : mal({ mensaje: 'EXCELJS_NO_CARGO' }); };
      s.onerror = function () { cargaExcel = null; mal({ mensaje: 'EXCELJS_NO_CARGO' }); };
      doc.head.appendChild(s);
    });
    return cargaExcel;
  }
  function logoBase64() {
    if (typeof raiz.fetch !== 'function') return Promise.resolve(null);
    return raiz.fetch(logoUrl()).then(function (r) { return r.ok ? r.arrayBuffer() : null; }).then(function (ab) {
      if (!ab) return null; var u = new Uint8Array(ab), s = ''; for (var i = 0; i < u.length; i += 8192) s += String.fromCharCode.apply(null, u.subarray(i, i + 8192));
      return raiz.btoa(s);
    }).catch(function () { return null; });
  }
  /** Documentos del rango (4 a la vez). Si una lectura falla, se aborta (no se exporta un Excel incompleto sin decirlo). */
  function docsRango(ctx, pers) {
    var cola = []; pers.forEach(function (p) { cola.push([p, 'venta']); cola.push([p, 'compra']); });
    var out = {}, i = 0;
    function uno() {
      if (i >= cola.length) return Promise.resolve();
      var q = cola[i++];
      return documentos(ctx, q[0], q[1]).then(function (r) { (out[q[0]] = out[q[0]] || {})[q[1]] = r; return uno(); });
    }
    return Promise.all([uno(), uno(), uno(), uno()]).then(function () { return out; });
  }
  var X = {
    morado: 'FF924893', blanco: 'FFFFFFFF', tinta: 'FF2A1430', suave: 'FFF8F1F9', borde: 'FFE0CCE4', lila: 'FFF6ECF6',
    est: { ver: ['FFE3F4EC', 'FF28865B'], roj: ['FFFBE4E1', 'FFD34433'], amb: ['FFFFF1D6', 'FF8A5A00'], gris: ['FFF0ECF1', 'FF7A6E7C'] },
    pesos: '"$"#,##0;-"$"#,##0;"$"0', entero: '#,##0'
  };
  var FUENTE = 'Arial';
  function borde() { var b = { style: 'thin', color: { argb: X.borde } }; return { top: b, left: b, bottom: b, right: b }; }
  function encabezado(ws, cols) {
    ws.columns = cols.map(function (c) { return { header: c[0], key: c[1], width: c[2], style: c[3] ? { numFmt: c[3] } : {} }; });
    var r = ws.getRow(1); r.height = 22;
    r.eachCell(function (c) { c.font = { name: FUENTE, bold: true, color: { argb: X.blanco }, size: 10 }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: X.morado } }; c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }; c.border = borde(); });
    ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 1, showGridLines: false }];
  }
  function filaDatos(ws, valores, i, clase) {
    var r = ws.addRow(valores);
    r.eachCell({ includeEmpty: true }, function (c) {
      c.font = { name: FUENTE, size: 10, color: { argb: X.tinta } }; c.border = borde();
      if (i % 2 === 1) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: X.suave } };
    });
    if (clase && X.est[clase]) return { fila: r, color: X.est[clase] };
    return { fila: r };
  }
  function pintarEstado(celda, clase) {
    var e = X.est[clase] || X.est.gris; celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: e[0] } }; celda.font = { name: FUENTE, size: 10, bold: true, color: { argb: e[1] } };
  }
  function filtro(ws, ncol) { if (ws.rowCount > 1) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: ws.rowCount, column: ncol } }; }

  function hojaResumen(wb, ctx, d, b, logo, desde, hasta, img) {
    var ws = wb.addWorksheet('Resumen', { properties: { tabColor: { argb: X.morado } }, views: [{ showGridLines: false }] });
    ws.columns = [{ width: 38 }, { width: 24 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }];
    for (var r = 1; r <= 4; r++) for (var c = 1; c <= 6; c++) ws.getCell(r, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: X.morado } };
    if (img != null) ws.addImage(img, { tl: { col: 0.25, row: 0.6 }, ext: { width: 200, height: 45 } });
    ws.getCell('C2').value = 'Levantamiento de IVA'; ws.getCell('C2').font = { name: FUENTE, bold: true, size: 16, color: { argb: X.blanco } };
    ws.getCell('C3').value = 'Cruce RCV del SII vs F29 declarado'; ws.getCell('C3').font = { name: FUENTE, size: 10, color: { argb: X.blanco } };
    var e = d.estimacion || {}, T = raiz.GestoorLevIVA && raiz.GestoorLevIVA.totales ? raiz.GestoorLevIVA.totales(e) : null;
    var filas = [
      ['Empresa', ctx.cliente.razon || ''], ['RUT', ctx.cliente.rut || ''], ['Rango revisado', mesTxt(desde) + ' a ' + mesTxt(hasta)],
      ['Emitido', new Date().toLocaleDateString('es-CL')], ['Fuente', 'Registro de Compras y Ventas y Formularios 29 del SII (vía Cartapra Conecta)'], [],
      [desde === d.desde && hasta === d.hasta ? 'Totales estimados' : 'Totales estimados del levantamiento completo (' + mesTxt(d.desde) + ' a ' + mesTxt(d.hasta) + ')', ''], ['A regularizar en el período', raiz.GestoorLevIVA && raiz.GestoorLevIVA.aRegularizar ? raiz.GestoorLevIVA.aRegularizar(d).valor + ' (' + raiz.GestoorLevIVA.aRegularizar(d).meses + ' meses)' : '—'],
      ['Diferencia de impuesto', num(e.impuesto)], ['Subtotal conocido', num((e.conocido || {}).total)],
      ['Provisional', num((e.provisional || {}).total)], ['Total estimado', e.total == null ? (T ? T.total : 'No calculable') : num(e.total)],
      ['Posible a favor', num(e.posible_a_favor)], [],
      ['Borradores F29', ''], ['Meses a rectificar', b ? b.meses.filter(aRectificar).filter(function (m) { return m.periodo >= desde && m.periodo <= hasta; }).length : '—'],
      ['Diferencia de IVA (cód. 89) del rango', b ? b.meses.filter(function (m) { return m.estado === 'con_diferencia' && m.periodo >= desde && m.periodo <= hasta; }).reduce(function (s, m) { return s + Number((m.iva_determinado || {}).diferencia || 0); }, 0) : null]
    ];
    var fila = 6;
    filas.forEach(function (f) {
      fila++; if (!f.length) return;
      var a = ws.getCell(fila, 1), v = ws.getCell(fila, 2);
      a.value = f[0]; v.value = f[1] == null ? '—' : f[1];
      var titulo = f[1] === '' && f[0] !== 'Empresa';
      a.font = { name: FUENTE, size: titulo ? 12 : 10, bold: true, color: { argb: titulo ? X.morado : X.tinta } };
      v.font = { name: FUENTE, size: 10, color: { argb: X.tinta }, bold: /Total estimado/.test(f[0]) };
      if (typeof f[1] === 'number' && !/^Meses/.test(f[0])) v.numFmt = X.pesos;
      if (!titulo) { a.border = borde(); v.border = borde(); }
    });
    fila += 2;
    ws.mergeCells(fila, 1, fila, 6);
    var av = ws.getCell(fila, 1); av.value = 'Estimación preliminar, verificar: no constituye determinación definitiva ni reemplaza el cálculo del SII/Tesorería. ' + AVISO_BORRADOR;
    av.font = { name: FUENTE, bold: true, size: 10, color: { argb: 'FFD34433' } }; av.alignment = { wrapText: true, vertical: 'middle' };
    av.border = { top: { style: 'medium', color: { argb: 'FFD34433' } }, left: { style: 'medium', color: { argb: 'FFD34433' } }, bottom: { style: 'medium', color: { argb: 'FFD34433' } }, right: { style: 'medium', color: { argb: 'FFD34433' } } };
    ws.getRow(fila).height = 34;
    ws.getCell(fila + 2, 1).value = 'Este archivo no incluye el costo de nuestros servicios de regularización. Asesorías Contadoor Ltda. · contadoor.cl';
    ws.getCell(fila + 2, 1).font = { name: FUENTE, size: 9, italic: true, color: { argb: 'FF7A6080' } };
    return ws;
  }
  function hojaMeses(wb, d, desde, hasta) {
    var ws = wb.addWorksheet('Mes a mes');
    encabezado(ws, [['Mes', 'mes', 12], ['Estado', 'est', 26], ['IVA ventas RCV', 'a', 16, X.pesos], ['Débito F29', 'b', 16, X.pesos], ['IVA compras RCV', 'c', 16, X.pesos],
      ['Crédito F29', 'd', 16, X.pesos], ['Rem. anterior', 'e', 16, X.pesos], ['IVA declarado', 'f', 16, X.pesos], ['IVA recalculado', 'g', 16, X.pesos], ['Diferencia', 'h', 16, X.pesos],
      ['Estimado a pagar', 'i', 18, X.pesos], ['Condicionado', 'j', 13]]);
    var LV = raiz.GestoorLevIVA, i = 0, sel = (d.meses || []).filter(function (m) { return m.periodo >= desde && m.periodo <= hasta; });
    sel.filter(function (m) { return m.periodo >= desde && m.periodo <= hasta; }).forEach(function (m) {
      var est = LV && LV.estadoDe ? LV.estadoDe(m) : { t: m.estado, c: 'gris' }, deb = m.debito || {}, cre = m.credito || {}, rem = m.remanente || {}, iva = m.iva || {};
      var es = m.estimacion;
      var r = filaDatos(ws, [mesTxt(m.periodo), est.t, num(deb.rcv), num(deb.declarado), num(cre.rcv), num(cre.declarado_documentos),
        num(rem.anterior_recalculado != null ? rem.anterior_recalculado : rem.anterior_supuesto), num(iva.declarado), num(iva.recalculado), num(iva.diferencia),
        es ? (es.total == null ? 'No calculable' : num(es.total)) : null, m.condicionado ? 'Sí' : ''], i++).fila;
      pintarEstado(r.getCell(2), est.c);
      if (num(iva.diferencia) > 0) r.getCell(10).font = { name: FUENTE, size: 10, bold: true, color: { argb: 'FFD34433' } };
    });
    filtro(ws, 12);
    // Fila de TOTALES con fórmulas SUM (resultado precalculado = suma de la misma columna) + estados y desglose del servidor
    if (sel.length) {
      var ult = ws.rowCount, tr = ws.addRow(['Totales', sel.length + (sel.length === 1 ? ' mes' : ' meses')]);
      for (var k = 3; k <= 11; k++) {
        var col = String.fromCharCode(64 + k), suma = 0;
        for (var f = 2; f <= ult; f++) { var v = ws.getCell(f, k).value; if (typeof v === 'number') suma += v; }
        tr.getCell(k).value = { formula: 'SUM(' + col + '2:' + col + ult + ')', result: suma };
        tr.getCell(k).numFmt = X.pesos;
      }
      tr.eachCell({ includeEmpty: true }, function (c) { c.font = { name: FUENTE, bold: true, color: { argb: X.blanco } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: X.morado } }; c.border = borde(); });
      tr.getCell(1).name = 'liva_totales';
      var LVt = raiz.GestoorLevIVA, extra = [];
      if (LVt && LVt.conteoEstados) extra.push('Meses por estado: ' + LVt.conteoEstados(d));
      if (LVt && LVt.desglose) extra = extra.concat(LVt.desglose(d.estimacion || {}));
      if (LVt && LVt.aRegularizar) extra.push(LVt.aRegularizar(d).texto + ' — estimación preliminar, verificar.');
      extra.forEach(function (t) { var r = ws.addRow([t]); ws.mergeCells(r.number, 1, r.number, 12); r.getCell(1).font = { name: FUENTE, size: 10, italic: true, color: { argb: X.tinta } }; });
    }
    return ws;
  }
  function hojaDocs(wb, nombre, pers, docs, libro) {
    var ws = wb.addWorksheet(nombre);
    encabezado(ws, [['Período', 'p', 10], ['Fecha', 'f', 12], ['Tipo', 't', 7], ['Documento', 'n', 30], ['Folio', 'fo', 12], ['RUT', 'r', 14], ['Razón social', 'rs', 34],
      ['Estado RCV', 'e', 12], ['Neto', 'ne', 15, X.pesos], ['Exento', 'ex', 15, X.pesos], ['IVA', 'iv', 15, X.pesos], ['Total', 'to', 15, X.pesos]]);
    var i = 0, trunc = [];
    pers.forEach(function (p) {
      var r = (docs[p] || {})[libro]; if (r && r.truncado) trunc.push(mesTxt(p));
      filtrar(r, null).forEach(function (x) {
        var f = filaDatos(ws, [p, x.fecha ? fechaTxt(x.fecha) : '', Number(x.tipo), TIPOS[x.tipo] || 'Otro documento', Number(x.folio), x.rut || '', x.razon || '', x.estado || '', x.neto, x.exento, x.iva, x.total], i++).fila;
        if (x.total < 0) [9, 10, 11, 12].forEach(function (k) { f.getCell(k).font = { name: FUENTE, size: 10, color: { argb: 'FF8A5A00' } }; });
      });
    });
    if (!i) { var r0 = ws.addRow(['Sin detalle de documentos en el rango (puede que solo exista el resumen del SII).']); r0.getCell(1).font = { name: FUENTE, italic: true, color: { argb: 'FF7A6E7C' } }; }
    else filtro(ws, 12);
    if (trunc.length) { var rt = ws.addRow(['Lista recortada a 3.000 documentos en: ' + trunc.join(', ')]); rt.getCell(1).font = { name: FUENTE, italic: true, color: { argb: 'FF8A5A00' } }; }
    return ws;
  }
  function hojaBorradores(wb, b, desde, hasta) {
    var ws = wb.addWorksheet('Borradores F29');
    encabezado(ws, [['Mes', 'm', 12], ['Código', 'c', 9], ['Línea', 'l', 7], ['Descripción', 'g', 56], ['Declarado (original)', 'o', 18, X.pesos], ['Corregido (según RCV)', 'k', 20, X.pesos],
      ['Diferencia', 'd', 16, X.pesos], ['Origen', 'r', 14]]);
    var lista = ((b && b.meses) || []).filter(function (m) { return aRectificar(m) && m.periodo >= desde && m.periodo <= hasta; }), i = 0;
    lista.forEach(function (m) {
      var t = ws.addRow([mesTxt(m.periodo), '', '', (m.estado === 'sin_f29' ? 'F29 original fuera de plazo' : 'F29 rectificatorio') + ' · folio original ' + (m.f29 ? m.f29.folio : '—') + ' · ' + estadoB(m).t]);
      t.eachCell({ includeEmpty: true }, function (c) { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: X.lila } }; c.font = { name: FUENTE, bold: true, color: { argb: X.morado } }; c.border = borde(); });
      (m.codigos || []).forEach(function (c) {
        var cn = esCantidad(c) || c.codigo === '115';
        var f = filaDatos(ws, [m.periodo, c.codigo, c.linea, c.glosa, m.f29 && m.f29.montos ? num(c.original) : null, num(c.corregido), num(c.diferencia), REGLA[c.regla] || c.regla], i++).fila;
        if (cn) [5, 6, 7].forEach(function (k) { f.getCell(k).numFmt = c.codigo === '115' ? '0.###' : X.entero; });
        if (num(c.diferencia)) pintarEstado(f.getCell(7), 'roj');
      });
      var es = m.estimacion;
      if (es) { var re = ws.addRow(['', '', '', 'Estimación (referencial): reajuste + intereses + multa; el SII calcula lo definitivo al presentar', null, es.total == null ? 'No calculable' : num(es.total)]); re.getCell(4).font = { name: FUENTE, italic: true, color: { argb: 'FF8A5A00' } }; re.getCell(6).numFmt = X.pesos; }
      ws.addRow([]);
    });
    if (!lista.length) ws.addRow(['No hay meses con diferencia que rectificar en el rango.']);
    else ws.addRow(['', '', '', AVISO_BORRADOR]).getCell(4).font = { name: FUENTE, bold: true, color: { argb: 'FFD34433' } };
    return ws;
  }
  /** Arma el libro (sin descargar). opt: {mes, docs, borrador, logo} — útil para pruebas. */
  function libroExcel(E, ctx, opt) {
    var d = ctx.datos, desde = opt.mes || d.desde, hasta = opt.mes || d.hasta, pers = meses(desde, hasta);
    var wb = new E.Workbook(); wb.creator = 'Gestoor · Contadoor'; wb.created = new Date();
    var img = opt.logo ? wb.addImage({ base64: opt.logo, extension: 'png' }) : null;
    hojaResumen(wb, ctx, d, opt.borrador, opt.logo, desde, hasta, img);
    hojaMeses(wb, d, desde, hasta);
    hojaDocs(wb, 'Ventas', pers, opt.docs || {}, 'venta');
    hojaDocs(wb, 'Compras', pers, opt.docs || {}, 'compra');
    hojaBorradores(wb, opt.borrador, desde, hasta);
    return wb;
  }
  function alDescargar(nombre, buf) {
    var blob = new raiz.Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    var u = raiz.URL.createObjectURL(blob), a = doc.createElement('a'); a.href = u; a.download = nombre; doc.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { raiz.URL.revokeObjectURL(u); }, 4000);
  }
  /** Exporta el .xlsx del rango (o de un mes con opt.mes). La bitácora va PRIMERO: si no se puede registrar, no se exporta. */
  function exportarExcel(ctx, opt) {
    opt = opt || {}; var d = ctx.datos, mes = opt.mes || null, desde = mes || d.desde, hasta = mes || d.hasta;
    function av(t, c) { if (opt.aviso) opt.aviso(t, c); }
    if (opt.boton) opt.boton.disabled = true;
    av('Preparando el Excel' + (mes ? ' de ' + mesTxt(mes) : ' del levantamiento') + '…');
    var conRcv = meses(desde, hasta).filter(function (p) { var m = (d.meses || []).filter(function (x) { return x.periodo === p; })[0]; return !m || m.estado !== 'sin_datos'; });
    return registrar(ctx, desde, hasta, mes ? 'excel_mes' : 'excel_rango').then(function () {
      var pDocs = mes && opt.docsMes ? Promise.resolve((function () { var o = {}; o[mes] = opt.docsMes; return o; })()) : docsRango(ctx, conRcv);
      return Promise.all([excelJS(), pDocs, borrador(ctx), logoBase64()]);
    }).then(function (r) {
      var wb = libroExcel(r[0], ctx, { mes: mes, docs: r[1], borrador: r[2], logo: r[3] });
      return wb.xlsx.writeBuffer().then(function (buf) {
        var nombre = ['Levantamiento_IVA', limpio(ctx.cliente.razon) || 'cliente', mes || (desde + '-' + hasta)].join('_') + '.xlsx';
        D.alDescargar(nombre, buf, wb);
        if (opt.boton) opt.boton.disabled = false;
        av('Excel listo: ' + nombre + ' (hojas Resumen, Mes a mes, Ventas, Compras y Borradores F29).', 'ver');
        return wb;
      });
    }).catch(function (e) {
      if (opt.boton) opt.boton.disabled = false;
      av(e && e.mensaje === 'EXCELJS_NO_CARGO' ? 'No se pudo cargar el generador de Excel (revisa tu conexión) e intenta de nuevo.' : errorTxt(ctx, e), 'roj');
    });
  }

  var D = { abrirMes: abrirMes, cerrarMes: cerrarMes, verBorradorMes: verBorradorMes, borradorTodos: borradorTodos, exportarExcel: exportarExcel, libroExcel: libroExcel,
            documentoBorrador: documentoBorrador, alDescargar: alDescargar, TIPOS: TIPOS, EXCELJS_URL: EXCELJS_URL, EXCELJS_SRI: EXCELJS_SRI, AVISO_BORRADOR: AVISO_BORRADOR };
  raiz.GestoorLevDetalle = D;
})(window);
