// Pre-IVA · motor de RECOMENDACIONES por reglas (función pura: sin red, sin DOM, sin Date.now(); se prueba con
// node --test pre-iva/recomendaciones.test.js). Pendiente de revisión de ChatGPT antes de mostrarse a clientes.
//
// Principios (Luciano, 22-oct):
//   · Solo datos reales del cliente y del período (pantalla del Pre-IVA, historial de 6 meses, documentos del SII,
//     frescura del SII, proyección de renta de MiRenta). Si falta el dato, la regla NO se dispara (nada de relleno).
//   · Cada recomendación: lo detectado (cifra y fecha) → impacto en pesos → acción con plazo → quién la hace.
//   · Nunca inventar beneficios ni prometer ahorro; nada agresivo ni ilegal; máximo 4, ordenadas por impacto.
//   · No calcula impuestos: usa el IVA/PPM/F29 que ya calculó la pantalla (f29-formula.js) y los outputs de MiRenta.
//   · Empresa EXENTA de IVA: solo reglas de PPM, pago y renta (nada de IVA).
(function (raiz) {
  'use strict';

  // ── Umbrales: configuración ÚNICA de PILOTO (ronda 2 de ChatGPT: se calibran con el uso; documentados en descargas/PRE_IVA_OPERATIVA.md) ──
  var CONFIG = {
    piloto: true,
    maxSinMonto: 1,                 // alertas sin monto (avisos preventivos): como máximo 1 y nunca antes de las 2 de mayor impacto
    dteConfirmadoSimpleApi: false,  // códigos 48/boletas aún sin contrastar con lo que devuelve SimpleAPI → regla de comprobantes en modo prudente (solo aviso A)
    max: 4,                         // recomendaciones como máximo
    mesesHist: 6,                   // ventana del historial (últimos 6 meses cerrados)
    minMesesPromedio: 4,            // meses con dato para usar promedios o desviaciones
    minImpacto: 50000,              // impacto mínimo en pesos para mostrar una regla de montos
    sobrePromedioPct: 0.15,         // IVA (o PPM) del mes sobre el promedio → "reserva"
    razonabilidadPct: 0.30,         // compras/ventas del mes ±30 % del promedio…
    razonabilidadZ: 2,              // …o a más de 2 desviaciones estándar
    ventasAlzaPct: 0.25,            // ventas del mes +25 % sobre el promedio con la misma tasa PPM
    recurrenteMin: 4,               // proveedor/cliente presente en ≥ 4 de los 6 meses
    margenDiasRecurrente: 3,        // días de margen sobre el día habitual de emisión
    atipicoVeces: 3,                // documento ≥ 3 veces su promedio con ese proveedor
    atipicoMinDocs: 3,              // con al menos 3 documentos previos de ese proveedor
    atipicoMinIva: 100000,          // y con IVA ≥ $100.000
    nuevoMinIva: 300000,            // proveedor nuevo con IVA ≥ $300.000
    minMesesDocs: 3,                // meses previos con documentos para reglas de comportamiento
    concentracionPct: 0.5,          // un cliente concentra ≥ 50 % del débito del mes
    concentracionMinIva: 200000,    // con débito del mes ≥ $200.000
    concentracionMinContrapartes: 3,
    diasReclamo: 8,                 // plazo de reclamo: 8 días corridos desde la recepción
    vencCercanoDias: 5,             // aviso de pago cuando faltan ≤ 5 días para el F29
    coberturaMin: 0.9,              // PPM cubre < 90 % del impuesto proyectado (MiRenta)
    // Posibles ventas duplicadas (comprobantes de pago electrónico vs. boletas/facturas)
    tiposVoucher: [48],             // 48 = comprobante de pago electrónico (confirmar con SimpleAPI qué otros códigos trae el resumen)
    tiposBoleta: [35, 38, 39, 41, 47],   // boletas de ventas y servicios (afectas y exentas)
    tiposFacturaVenta: [33, 34],
    toleranciaPct: 0.01,            // coincidencia voucher ↔ factura/boleta del mismo día: ±1 %…
    toleranciaPesos: 100,           // …o ±$100
    atipicoBase: 'mediana',         // documento individual vs. la MEDIANA de 6 meses de esa contraparte
    atipicoClienteMinDocs: 10,      // o vs. la mediana de todos los documentos del cliente (si tiene ≥ 10)
    ivaTasa: 0.19                   // solo para estimar el IVA contenido en un total cuando el SII no lo trae
  };

  // ── Utilidades puras ──
  function n(x) { var v = Number(x); return isFinite(v) ? v : 0; }
  function hay(x) { return x !== null && x !== undefined && x !== '' && isFinite(Number(x)); }
  function miles(v) { return Math.round(Math.abs(v)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function clp(v) { return '$' + miles(v); }
  function pct(v) { return Math.round(Math.abs(v) * 100) + ' %'; }
  function dia(iso) { var s = String(iso || ''); return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(8, 10) + '-' + s.slice(5, 7) : ''; }
  function ms(iso) { var s = String(iso || '').slice(0, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null; return Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)); }
  function masDias(iso, d) { var t = ms(iso); if (t === null) return null; return new Date(t + d * 864e5).toISOString().slice(0, 10); }
  function difDias(a, b) { var x = ms(a), y = ms(b); return x === null || y === null ? null : Math.round((x - y) / 864e5); }
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  function mesSig(periodo) { var y = +String(periodo).slice(0, 4), m = +String(periodo).slice(5, 7); return MESES[m % 12] + (m === 12 ? ' ' + (y + 1) : ''); }

  // Solo meses CERRADOS y COMPARABLES (registrados por Contable): un Pre-IVA enviado es una estimación y no entra en promedios.
  function comparables(h) { return (h || []).filter(function (x) { return x && x.comparable !== false; }); }
  function stats(vals) {
    var v = (vals || []).filter(hay).map(Number);
    if (!v.length) return { n: 0, prom: null, desv: null };
    var p = v.reduce(function (s, x) { return s + x; }, 0) / v.length;
    var d = Math.sqrt(v.reduce(function (s, x) { return s + (x - p) * (x - p); }, 0) / v.length);
    return { n: v.length, prom: p, desv: d };
  }
  // Notas de crédito restan; notas de débito suman (montos del SII vienen en positivo).
  function signo(tipoDte) { return +tipoDte === 61 ? -1 : 1; }
  // Estado del acuse de una factura de compra (fechas 'AAAA-MM-DD'; hoy = fecha de Chile).
  function estadoAcuse(doc, hoy, cfg) {
    cfg = cfg || CONFIG;
    if (doc.fecha_reclamo || /reclam/i.test(doc.estado || '')) return { estado: 'reclamada' };
    if (doc.fecha_acuse || doc.acuse === true) return { estado: 'aceptada' };
    if (!doc.fecha_recepcion) return { estado: 'sin_dato' };
    var vence = masDias(doc.fecha_recepcion, cfg.diasReclamo), quedan = difDias(vence, hoy);
    if (quedan === null) return { estado: 'sin_dato' };
    return quedan >= 0 ? { estado: 'pendiente', vence: vence, quedan: quedan } : { estado: 'tacita', vence: vence };
  }
  function sumaIva(docs) { return (docs || []).reduce(function (s, d) { return s + signo(d.tipo_dte) * n(d.iva); }, 0); }
  function porContraparte(docs) {
    var m = {};
    (docs || []).forEach(function (d) {
      var k = String(d.rut || '').trim(); if (!k) return;
      var c = m[k] = m[k] || { rut: k, razon: d.razon || k, iva: 0, total: 0, docs: [] };
      c.iva += signo(d.tipo_dte) * n(d.iva); c.total += signo(d.tipo_dte) * n(d.total); c.docs.push(d);
      if (d.razon) c.razon = d.razon;
    });
    return m;
  }
  function diaDelMes(iso) { var s = String(iso || ''); return /^\d{4}-\d{2}-\d{2}/.test(s) ? +s.slice(8, 10) : null; }
  function mediana(v) { v = v.slice().sort(function (a, b) { return a - b; }); if (!v.length) return null; var h = Math.floor(v.length / 2); return v.length % 2 ? v[h] : Math.round((v[h - 1] + v[h]) / 2); }

  // ── Reglas: cada una devuelve null o {id, tier, monto, color, frase, detectado, impacto, accion, plazo, quien} ──
  function r(o) { o.tier = o.tier == null ? 1 : o.tier; o.monto = Math.round(n(o.monto)); return o; }

  // Frescura del SII (solo si la conexión está activa): va primero porque condiciona todo lo demás.
  function reglaSii(c) {
    var s = c.sii || {};
    if (s.estado === 'desactualizado') return r({ id: 'sii', tier: 0, usa: 'sii', color: 'ambar', frase: '¿Estos números están al día?',
      detectado: s.ultima ? 'No hay datos del SII desde el ' + dia(s.ultima) + (s.motivo ? ' (' + s.motivo + ')' : '') + '.' : 'Los datos del SII están desactualizados.',
      impacto: 'Las cifras de este Pre-IVA pueden cambiar.', accion: 'Actualiza desde el SII antes de decidir o enviar.', plazo: null, quien: 'Tu analista' });
    if (s.estado === 'sin_datos') return r({ id: 'sii', tier: 0, usa: 'sii', color: 'ambar', frase: '¿Estos números están al día?',
      detectado: 'Aún no hay datos del SII para este período.', impacto: 'El Pre-IVA se calcula solo con lo cargado a mano.',
      accion: 'Actualiza desde el SII antes de decidir o enviar.', plazo: null, quien: 'Tu analista' });
    return null;
  }

  function reglaAcuse(c, cfg) {
    if (c.exenta || !c.docs || !c.docs.disponible) return null;
    var pend = (c.docs.actual.compras || []).filter(function (d) { return +d.tipo_dte !== 61; })
      .map(function (d) { return { d: d, a: estadoAcuse(d, c.hoy, cfg) }; }).filter(function (x) { return x.a.estado === 'pendiente'; });
    if (!pend.length) return null;
    var iva = pend.reduce(function (s, x) { return s + n(x.d.iva); }, 0);
    var vence = pend.map(function (x) { return x.a.vence; }).sort()[0];
    return r({ id: 'acuse', monto: iva, color: 'verde', frase: '¿Qué facturas de compra debo revisar?',
      detectado: 'Tienes ' + pend.length + ' factura' + (pend.length === 1 ? '' : 's') + ' de compra con ' + clp(iva) + ' de IVA en plazo de reclamo; el primer plazo vence el ' + dia(vence) + '.',
      impacto: clp(iva) + ' de IVA asociado a facturas pendientes de revisión; su utilización debe verificarse.',
      accion: 'Revisa que correspondan a compras de tu empresa; si alguna no corresponde, avísanos antes del ' + dia(vence) + '.', plazo: vence, quien: 'Tú' });
  }

  function reglaReclamadas(c) {
    if (c.exenta || !c.docs || !c.docs.disponible) return null;
    var rec = (c.docs.actual.compras || []).filter(function (d) { return +d.tipo_dte !== 61 && (d.fecha_reclamo || /reclam/i.test(d.estado || '')); });
    if (!rec.length) return null;
    var iva = rec.reduce(function (s, d) { return s + n(d.iva); }, 0);
    if (iva < 1) return null;
    return r({ id: 'reclamadas', monto: iva, color: 'rojo', frase: '¿Por qué no cuenta esta factura?',
      detectado: rec.length + ' factura' + (rec.length === 1 ? '' : 's') + ' de compra de este mes fue' + (rec.length === 1 ? '' : 'ron') + ' reclamada' + (rec.length === 1 ? '' : 's') + ' (' + clp(iva) + ' de IVA).',
      impacto: clp(iva) + ' de IVA en documentos reclamados.',
      accion: 'Revisa el motivo del reclamo y coordina con el proveedor la documentación que corresponda.', plazo: null, quien: 'Tú' });
  }

  // IVA (o PPM en exentas) del mes sobre el promedio de 6 meses → reservar el pago.
  function reglaReserva(c, cfg) {
    var a = c.actual || {}; if (a.sinDato) return null;
    var campo = c.exenta ? 'ppm' : 'iva', cur = c.exenta ? a.ppm : a.ivaPagar;
    if (!hay(cur) || !hay(a.f29)) return null;
    var s = stats(comparables(c.historial).map(function (h) { return h[campo]; }));
    if (s.n < cfg.minMesesPromedio || !(s.prom > 0)) return null;
    var dif = cur - s.prom;
    if (dif < cfg.minImpacto || cur < s.prom * (1 + cfg.sobrePromedioPct)) return null;
    var que = c.exenta ? 'tu PPM' : 'tu IVA';
    return r({ id: 'reserva', monto: dif, color: 'ambar', frase: '¿Cuánto debo reservar este mes?',
      detectado: (c._est ? 'Según la referencia estimada, ' + que + ' a fin de mes (cerca de ' + clp(cur) + ') estaría ' : que.charAt(0).toUpperCase() + que.slice(1) + ' de este mes (' + clp(cur) + ') está ') + pct(dif / s.prom) + ' sobre tu promedio de 6 meses cerrados (' + clp(s.prom) + ').',
      impacto: clp(dif) + ' más que en un mes normal' + (c._est ? ' (referencial: puede cambiar).' : '.'),
      accion: 'Reserva ' + (c._est ? 'cerca de ' : '') + clp(a.f29) + ' antes del ' + dia(c.vencF29) + ' para pagar sin atrasos.', plazo: c.vencF29, quien: 'Tú' });
  }

  function reglaVencimiento(c, cfg, ya) {
    if (ya.reserva) return null;
    var a = c.actual || {}; if (a.sinDato || !(n(a.f29) > 0)) return null;
    var d = difDias(c.vencF29, c.hoy); if (d === null || d < 0 || d > cfg.vencCercanoDias) return null;
    return r({ id: 'vencimiento', monto: a.f29, color: 'ambar', frase: '¿Cuándo tengo que pagar?',
      detectado: (d === 0 ? 'Hoy vence' : 'En ' + d + ' día' + (d === 1 ? '' : 's') + ' vence') + ' tu F29 (' + dia(c.vencF29) + ')' + (c._est ? ' y, según la referencia estimada, rondaría ' : ' y el monto es ') + clp(a.f29) + '.',
      impacto: clp(a.f29) + ' a pagar; un pago atrasado suma reajustes, intereses y multas.',
      accion: 'Deja el pago programado o los fondos listos antes del ' + dia(c.vencF29) + '.', plazo: c.vencF29, quien: 'Tú' });
  }

  function reglaRemanente(c, cfg) {
    var a = c.actual || {}; if (c.exenta || a.sinDato || !(n(a.nuevoRemanente) >= cfg.minImpacto)) return null;
    return r({ id: 'remanente', monto: a.nuevoRemanente, color: 'verde', frase: '¿Por qué este mes no pago IVA?',
      detectado: (c.mesEnCurso ? 'A la fecha, el crédito de tus compras más el remanente del mes anterior superan el débito de tus ventas: por ahora no pagarías IVA y te quedaría un crédito a favor de ' : 'Este mes el crédito de tus compras más el remanente del mes anterior superan el débito de tus ventas: no pagas IVA y te queda un crédito a favor de ') + clp(a.nuevoRemanente) + '.',
      impacto: clp(a.nuevoRemanente) + ' que se descontarían del IVA de ' + mesSig(c.periodo) + (c.mesEnCurso ? ' (puede cambiar hasta el cierre del mes).' : '.'),
      accion: 'No tienes que hacer nada: lo aplicamos en tu próximo F29.' + (n(a.ppm) > 0 ? ' El PPM (' + clp(a.ppm) + ') se paga igual el ' + dia(c.vencF29) + '.' : ''), plazo: n(a.ppm) > 0 ? c.vencF29 : null, quien: 'Tu analista' });
  }

  // Ventas del mes sobre el promedio con la misma tasa de PPM (sin MiRenta; si hay proyección de renta, manda MiRenta).
  function reglaVentasPpm(c, cfg, ya) {
    if (ya.renta_cobertura) return null;
    var a = c.actual || {}; if (a.sinDato || !hay(a.ventasBase) || !(n(a.tasaPPM) > 0)) return null;
    var hist = comparables(c.historial).filter(function (h) { return hay(h.ventas); });
    var s = stats(hist.map(function (h) { return h.ventas; }));
    if (s.n < cfg.minMesesPromedio || !(s.prom > 0)) return null;
    var tasas = hist.map(function (h) { return n(h.tasa); }).filter(function (t) { return t > 0; });
    if (!tasas.length || tasas.some(function (t) { return Math.abs(t - n(a.tasaPPM)) > 1e-9; })) return null;
    var dif = n(a.ventasBase) - s.prom;
    if (dif < s.prom * cfg.ventasAlzaPct) return null;
    var ppmDif = Math.round(dif * n(a.tasaPPM) / 100);
    if (ppmDif < 1) return null;
    return r({ id: 'ventas_ppm', monto: ppmDif, color: 'morado', frase: '¿Me alcanzará para la renta de abril?',
      detectado: (c._est ? 'Según la referencia estimada, tus ventas a fin de mes (cerca de ' + clp(a.ventasBase) + ') estarían ' : 'Tus ventas del mes (' + clp(a.ventasBase) + ') están ') + '' + pct(dif / s.prom) + ' sobre tu promedio de 6 meses (' + clp(s.prom) + ') y tu tasa de PPM sigue en ' + String(a.tasaPPM).replace('.', ',') + ' %.',
      impacto: 'Si el alza se mantiene, tu impuesto de abril podría ser mayor que lo que cubren tus PPM (este mes ' + clp(dif) + ' de ventas sobre lo habitual).',
      accion: 'Revisemos tu tasa de PPM en la próxima reunión.', plazo: null, quien: 'Tu analista' });
  }

  // Compras (crédito) y ventas (débito) del mes vs. su promedio de 6 meses.
  function reglaRazonabilidad(c, cfg) {
    if (c.exenta) return null;
    var a = c.actual || {}; if (a.sinDato) return null;
    var out = [];
    [['credito', 'compras', 'Las compras'], ['debito', 'ventas', 'Las ventas']].forEach(function (x) {
      var cur = a[x[0]]; if (!hay(cur)) return;
      var s = stats(comparables(c.historial).map(function (h) { return h[x[0]]; }));
      if (s.n < cfg.minMesesPromedio || !(s.prom > 0)) return;
      var dif = cur - s.prom, z = s.desv > 0 ? dif / s.desv : 0;
      if (Math.abs(dif) < cfg.minImpacto) return;
      if (Math.abs(dif) < s.prom * cfg.razonabilidadPct && Math.abs(z) < cfg.razonabilidadZ) return;
      var bajo = dif < 0;
      if (x[1] === 'ventas' && !bajo) return;   // ventas al alza: lo cubre la regla de reserva
      var det = (c._est ? 'Según la referencia estimada, ' + x[2].toLowerCase() + ' a fin de mes (cerca de ' + clp(cur) + ' de IVA) estarían ' : x[2] + ' de este mes (' + clp(cur) + ' de IVA) están ') + pct(dif / s.prom) + (bajo ? ' bajo' : ' sobre') + ' tu promedio de 6 meses cerrados (' + clp(s.prom) + ').';
      if (x[1] === 'compras' && bajo) out.push(r({ id: 'raz_compras', monto: -dif, color: 'ambar', frase: '¿Me faltan facturas de compra?', detectado: det,
        impacto: 'Hasta ' + clp(-dif) + ' de IVA de compras bajo lo habitual (referencial).', accion: 'Revisa si tienes facturas de compra por recibir antes del ' + dia(c.finMes) + '.', plazo: c.finMes, quien: 'Tú' }));
      else if (x[1] === 'compras') out.push(r({ id: 'raz_compras', monto: dif, color: 'ambar', frase: '¿Están bien mis compras?', detectado: det,
        impacto: clp(dif) + ' de crédito sobre lo habitual.', accion: 'Revisa que todas correspondan a tu empresa; las que no, se reclaman dentro de 8 días desde su recepción.', plazo: null, quien: 'Tú' }));
      else out.push(r({ id: 'raz_ventas', monto: -dif, color: 'ambar', frase: '¿Me falta emitir facturas?', detectado: det,
        impacto: clp(-dif) + ' de IVA bajo lo habitual.', accion: 'Revisa si falta emitir alguna factura del mes antes del ' + dia(c.finMes) + '.', plazo: c.finMes, quien: 'Tú' }));
    });
    return out;
  }

  // Comportamiento de los últimos 6 meses (documentos del SII): recurrentes ausentes, documento atípico, proveedor nuevo.
  function previosValidos(c, cfg) {
    // Error o lectura incompleta ≠ ausencia de documentos: sin datos completos no hay reglas de comportamiento.
    if (!c.docs || !c.docs.disponible || !c.docs.previos || c.docs.error || c.docs.incompleto) return null;
    var meses = Object.keys(c.docs.previos).filter(function (p) { return c.docs.previos[p] && c.docs.previos[p].conSnapshot !== false; }).sort().slice(-cfg.mesesHist);
    var conDocs = meses.filter(function (p) { var x = c.docs.previos[p] || {}; return (x.compras || []).length || (x.ventas || []).length; });
    return conDocs.length >= cfg.minMesesDocs ? meses : null;
  }
  function reglaRecurrentes(c, cfg) {
    if (!c.mesEnCurso) return [];
    var meses = previosValidos(c, cfg); if (!meses) return [];
    var hoyDia = diaDelMes(c.hoy), out = [];
    [['compras', 'proveedor'], ['ventas', 'cliente']].forEach(function (x) {
      if (c.exenta && x[0] === 'compras') return;
      var cuenta = {};
      meses.forEach(function (p) {
        var m = porContraparte((c.docs.previos[p] || {})[x[0]]);
        Object.keys(m).forEach(function (k) {
          var e = cuenta[k] = cuenta[k] || { rut: k, razon: m[k].razon, meses: 0, iva: 0, dias: [] };
          e.meses++; e.iva += m[k].iva; e.razon = m[k].razon;
          m[k].docs.forEach(function (d) { var dd = diaDelMes(d.fecha); if (dd) e.dias.push(dd); });
        });
      });
      var actual = porContraparte(c.docs.actual[x[0]]);
      Object.keys(cuenta).forEach(function (k) {
        var e = cuenta[k]; if (e.meses < cfg.recurrenteMin || actual[k]) return;
        var habitual = mediana(e.dias); if (habitual === null || hoyDia === null || hoyDia <= habitual + cfg.margenDiasRecurrente) return;
        var prom = e.iva / e.meses; if (prom < cfg.minImpacto) return;
        if (x[0] === 'compras') out.push(r({ id: 'rec_prov_' + k, monto: prom, color: 'verde', frase: '¿Me falta alguna factura de compra?',
          detectado: 'En los registros disponibles de este mes no aparece una factura de ' + e.razon + ', que sí aparece en ' + e.meses + ' de ' + meses.length + ' meses anteriores (suele emitirse cerca del día ' + habitual + ').',
          impacto: 'Referencia: unos ' + clp(prom) + ' de IVA al mes en los meses anteriores.', accion: 'Confirma la emisión y recepción de la factura para revisar su tratamiento tributario.', plazo: null, quien: 'Tú' }));
        else out.push(r({ id: 'rec_cli_' + k, monto: prom, color: 'ambar', frase: '¿Me falta emitir alguna factura?',
          detectado: 'En los registros disponibles de este mes no aparece una factura emitida a ' + e.razon + ', que sí aparece en ' + e.meses + ' de ' + meses.length + ' meses anteriores.',
          impacto: 'Referencia: unos ' + clp(prom) + ' de IVA al mes en los meses anteriores.', accion: 'Revisa si corresponde emitirla este mes.', plazo: null, quien: 'Tú' }));
      });
    });
    return out;
  }
  function reglaDocumentos(c, cfg) {
    var meses = previosValidos(c, cfg); if (!meses) return [];
    var out = [];
    ['compras', 'ventas'].forEach(function (lib) {
      if (c.exenta && lib === 'compras') return;
      var hist = {}, todos = [];
      meses.forEach(function (p) { ((c.docs.previos[p] || {})[lib] || []).forEach(function (d) {
        if (+d.tipo_dte === 61 || cfg.tiposVoucher.indexOf(+d.tipo_dte) >= 0) return; var k = String(d.rut || '').trim(); if (!k) return;
        (hist[k] = hist[k] || []).push(n(d.total)); todos.push(n(d.total)); }); });
      var medCli = todos.length >= cfg.atipicoClienteMinDocs ? mediana(todos) : null;
      (c.docs.actual[lib] || []).forEach(function (d) {
        if (+d.tipo_dte === 61 || cfg.tiposVoucher.indexOf(+d.tipo_dte) >= 0) return;
        var k = String(d.rut || '').trim(); if (!k) return;
        var ac = lib === 'compras' ? estadoAcuse(d, c.hoy, cfg) : { estado: 'na' };
        var plazoTxt = ac.estado === 'pendiente' ? ' antes del plazo de reclamo (' + dia(ac.vence) + ')' : '';
        var accionNo = lib === 'ventas' ? 'si hay un error, se corrige con una nota de crédito antes del ' + dia(c.vencF29) + '.'
          : ac.estado === 'pendiente' ? 'si no corresponde, avísanos antes del ' + dia(ac.vence) + '.' : 'si no corresponde, avísanos para pedir la nota de crédito.';
        var h = hist[k], ref = null, deQuien = '';
        if (h && h.length >= cfg.atipicoMinDocs) { ref = cfg.atipicoBase === 'mediana' ? mediana(h) : h.reduce(function (s, x) { return s + x; }, 0) / h.length; deQuien = lib === 'compras' ? 'con ese proveedor' : 'con ese cliente'; }
        else if (medCli) { ref = medCli; deQuien = lib === 'compras' ? 'en tus compras' : 'en tus ventas'; }
        if (ref > 0 && n(d.total) >= ref * cfg.atipicoVeces && n(d.iva) >= cfg.atipicoMinIva) {
          var veces = Math.round(n(d.total) / ref * 10) / 10;
          out.push(r({ id: 'atipico_' + lib + '_' + k + '_' + d.folio, monto: d.iva, color: 'ambar', frase: lib === 'compras' ? '¿Esta factura está bien?' : '¿Emití bien esta factura?',
            detectado: (lib === 'compras' ? 'Recibiste una factura de ' : 'Emitiste una factura a ') + (d.razon || k) + ' por ' + clp(d.total) + ' (folio ' + d.folio + ', ' + dia(d.fecha) + '), ' + String(veces).replace('.', ',') + ' veces lo habitual ' + deQuien + ' (mediana de 6 meses ' + clp(ref) + ').',
            impacto: clp(d.iva) + ' de IVA en ese solo documento.', accion: 'Revisa que esté correcta' + plazoTxt + '; ' + accionNo, plazo: ac.estado === 'pendiente' ? ac.vence : (lib === 'ventas' ? c.vencF29 : null), quien: 'Tú' }));
        } else if (lib === 'compras' && !h && n(d.iva) >= cfg.nuevoMinIva) {
          out.push(r({ id: 'nuevo_' + k + '_' + d.folio, monto: d.iva, color: 'ambar', frase: '¿Conozco a este proveedor?',
            detectado: 'Es la primera vez en 6 meses que recibes una factura de ' + (d.razon || k) + ': ' + clp(d.total) + ' (folio ' + d.folio + ', ' + dia(d.fecha) + ').',
            impacto: clp(d.iva) + ' de IVA de un proveedor nuevo.', accion: 'Confirma que sea una compra de tu empresa' + plazoTxt + '; ' + accionNo, plazo: ac.estado === 'pendiente' ? ac.vence : null, quien: 'Tú' }));
        }
      });
    });
    return out;
  }
  // Posibles ventas DUPLICADAS: comprobantes de pago electrónico junto con boletas (aunque no calcen montos), vouchers que
  // coinciden con facturas/boletas del mismo día, documentos repetidos y notas de crédito sin documento asociado visible.
  // Siempre prudente: "posible duplicado, revisar"; nunca afirma que hay error.
  function totTipos(res, tipos, tasa) {
    var t = { total: 0, iva: 0, n: 0 };
    tipos.forEach(function (k) { var x = (res || {})[k]; if (!x) return; t.total += n(x.total); t.n += n(x.n);
      t.iva += hay(x.iva) && n(x.iva) > 0 ? n(x.iva) : (hay(x.neto) || hay(x.exento)) ? Math.max(0, n(x.total) - n(x.neto) - n(x.exento)) : Math.round(n(x.total) / (1 + tasa) * tasa); });
    return t;
  }
  function reglaDuplicados(c, cfg) {
    if (c.exenta || !c.docs || !c.docs.disponible || c.docs.error) return [];
    var out = [], res = c.docs.resumenActual || {}, ventas = c.docs.actual.ventas || [];
    var V = totTipos(res, cfg.tiposVoucher, cfg.ivaTasa), B = totTipos(res, cfg.tiposBoleta, cfg.ivaTasa);
    // Coincidencias del mismo día (solo si el SII entrega el detalle de los comprobantes con fecha)
    var vouchers = ventas.filter(function (d) { return cfg.tiposVoucher.indexOf(+d.tipo_dte) >= 0; });
    var otros = ventas.filter(function (d) { return cfg.tiposFacturaVenta.concat(cfg.tiposBoleta).indexOf(+d.tipo_dte) >= 0; });
    var usados = {}, coincide = 0, coincideIva = 0;
    vouchers.forEach(function (v) {
      for (var i = 0; i < otros.length; i++) {
        var o = otros[i]; if (usados[i] || String(o.fecha).slice(0, 10) !== String(v.fecha).slice(0, 10)) continue;
        var tol = Math.max(cfg.toleranciaPesos, n(o.total) * cfg.toleranciaPct);
        if (Math.abs(n(o.total) - n(v.total)) <= tol) { usados[i] = 1; coincide += n(v.total); coincideIva += n(o.iva) > 0 ? n(o.iva) : Math.round(n(v.total) / (1 + cfg.ivaTasa) * cfg.ivaTasa); break; }
      }
    });
    // Cambio de patrón respecto de los meses anteriores
    var prev = c.docs.resumenPrevios || {}, mesesP = Object.keys(prev).sort().slice(-cfg.mesesHist), cambio = '';
    if (mesesP.length >= cfg.minMesesDocs) {
      var antesV = mesesP.some(function (p) { return totTipos(prev[p], cfg.tiposVoucher, cfg.ivaTasa).total > 0; });
      var antesB = mesesP.some(function (p) { return totTipos(prev[p], cfg.tiposBoleta, cfg.ivaTasa).total > 0; });
      var mesTxt = MESES[+String(c.periodo).slice(5, 7) - 1];
      if (V.total > 0 && !antesV) cambio = ' Desde ' + mesTxt + ' aparecen comprobantes de pago electrónico que antes no tenías.';
      else if (B.total > 0 && !antesB) cambio = ' Desde ' + mesTxt + ' aparecen boletas que antes no tenías.';
    }
    // Nivel A · coexistencia (sin coincidencias o con códigos sin confirmar): aviso preventivo SIN monto.
    // Nivel B · coincidencias de fecha y monto (solo con el detalle del SII y los códigos confirmados): revisión prioritaria con el
    //           importe de las operaciones coincidentes; NO demuestra una duplicación.
    // Nivel C · duplicación comprobada: solo tras revisión manual del analista (nunca automática).
    var nivelB = coincide > 0 && cfg.dteConfirmadoSimpleApi;
    if (nivelB) {
      out.push(r({ id: 'dup_voucher', tier: 0, monto: coincide, color: 'rojo', frase: '¿Se está contando dos veces una venta?', nivel: 'B',
        detectado: 'Detectamos ' + clp(coincide) + ' en comprobantes de pago electrónico que coinciden en fecha y monto con facturas o boletas del mismo día.' + cambio,
        impacto: 'Operaciones coincidentes por ' + clp(coincide) + '. Esto no demuestra una duplicación.',
        accion: 'Revisaremos esas operaciones antes de confirmar el F29 (' + dia(c.vencF29) + ').', plazo: c.vencF29, quien: 'Tu analista' }));
    } else if ((V.total > 0 && B.total > 0) || coincide > 0) {
      out.push(r({ id: 'dup_voucher', tier: 2, monto: 0, color: 'ambar', frase: '¿Se está contando dos veces una venta?', nivel: 'A',
        detectado: 'Detectamos comprobantes de pago electrónico y boletas en el mismo período.' + cambio,
        impacto: 'Esto puede ser normal, pero conviene verificar que una misma venta no esté incluida dos veces en el cálculo del IVA.',
        accion: 'Revisaremos las coincidencias antes de confirmar el F29.', plazo: c.vencF29, quien: 'Tu analista' }));
    }
    // Documentos repetidos (mismo tipo, folio y contraparte) dentro del mismo libro
    if (!c.docs.incompleto) ['ventas', 'compras'].forEach(function (lib) {
      var vistos = {}, rep = [];
      (c.docs.actual[lib] || []).forEach(function (d) { if (!d.folio) return; var k = d.tipo_dte + '|' + d.folio + '|' + String(d.rut || '').trim(); if (vistos[k]) rep.push(d); else vistos[k] = 1; });
      if (!rep.length) return;
      var iva = rep.reduce(function (s, d) { return s + n(d.iva); }, 0);
      out.push(r({ id: 'dup_exacto_' + lib, monto: iva, color: 'rojo', frase: lib === 'ventas' ? '¿Tengo una venta repetida?' : '¿Tengo una compra repetida?',
        detectado: rep.length + ' documento' + (rep.length === 1 ? '' : 's') + ' de ' + lib + ' aparece' + (rep.length === 1 ? '' : 'n') + ' dos veces con el mismo tipo, folio y contraparte (por ejemplo, folio ' + rep[0].folio + ').',
        impacto: 'Posible duplicado, a revisar: ' + clp(iva) + ' de IVA.', accion: 'Revisémoslo antes del ' + dia(c.vencF29) + '.', plazo: c.vencF29, quien: 'Tu analista' }));
    });
    // Notas de crédito sin documento asociado visible (el RCV no trae la referencia: se busca una factura de esa contraparte en 6 meses)
    var meses = previosValidos(c, cfg);
    if (meses) ['ventas', 'compras'].forEach(function (lib) {
      var conDoc = {};
      meses.concat(['actual']).forEach(function (p) { var l = p === 'actual' ? c.docs.actual[lib] : (c.docs.previos[p] || {})[lib];
        (l || []).forEach(function (d) { if (+d.tipo_dte !== 61) conDoc[String(d.rut || '').trim()] = 1; }); });
      var sin = (c.docs.actual[lib] || []).filter(function (d) { return +d.tipo_dte === 61 && !(d.ref_folio) && !conDoc[String(d.rut || '').trim()]; });
      if (!sin.length) return;
      var iva = sin.reduce(function (s, d) { return s + n(d.iva); }, 0); if (iva < cfg.minImpacto) return;
      out.push(r({ id: 'nc_sin_ref_' + lib, monto: iva, color: 'ambar', frase: '¿Esta nota de crédito está bien hecha?',
        detectado: sin.length + ' nota' + (sin.length === 1 ? '' : 's') + ' de crédito de ' + lib + ' (' + clp(iva) + ' de IVA) no tiene' + (sin.length === 1 ? '' : 'n') + ' una factura visible de esa contraparte en los últimos 6 meses (por ejemplo, folio ' + sin[0].folio + ').',
        impacto: 'Posible nota de crédito sin la referencia correcta: ' + clp(iva) + ' de IVA a revisar.', accion: 'Revisemos a qué documento anula antes del ' + dia(c.vencF29) + '.', plazo: c.vencF29, quien: 'Tu analista' }));
    });
    return out;
  }
  // Un cliente concentra la mitad del débito del mes: el IVA se paga el 20 aunque ese cliente pague tarde.
  function reglaConcentracion(c, cfg) {
    if (c.exenta || !c.docs || !c.docs.disponible || c.docs.incompleto || c.docs.error) return null;   // datos parciales: no se concluye concentración
    var m = porContraparte(c.docs.actual.ventas), ks = Object.keys(m);
    if (ks.length < cfg.concentracionMinContrapartes) return null;
    var tot = sumaIva(c.docs.actual.ventas) + totTipos(c.docs.resumenActual || {}, cfg.tiposBoleta, cfg.ivaTasa).iva;   // las boletas (solo totales) también cuentan
    if (tot < cfg.concentracionMinIva) return null;
    var top = ks.map(function (k) { return m[k]; }).sort(function (a, b) { return b.iva - a.iva; })[0];
    if (top.iva / tot < cfg.concentracionPct) return null;
    return r({ id: 'concentracion', monto: top.iva, color: 'morado', frase: '¿Y si mi cliente me paga tarde?',
      detectado: 'El ' + pct(top.iva / tot) + ' del IVA de tus ventas del mes es de ' + top.razon + ' (' + clp(top.iva) + ').',
      impacto: clp(top.iva) + ' de IVA que debes pagar el ' + dia(c.vencF29) + ' aunque ese cliente se atrase.',
      accion: 'Coordina su cobro antes del ' + dia(c.vencF29) + ' o reserva ese monto.', plazo: c.vencF29, quien: 'Tú' });
  }

  // MiRenta: SOLO outputs del motor (forecast.idpc, forecast.ppm.imputable, forecast.saldo_abril, sim.ppm_voluntario.cuota_mensual).
  function reglaRenta(c, cfg) {
    var R = c.renta; if (!R) return null;
    if (R.estado === 'sin_caso') {
      if (R.regimen !== '14D3' || !R.planIncluye) return null;
      return r({ id: 'renta_activar', tier: 2, monto: 0, color: 'morado', usa: 'mirenta', frase: '¿Mis PPM alcanzan para la renta?',
        detectado: 'Aún no tenemos tu proyección de renta.', impacto: 'Sin ella no sabemos si tus PPM cubren el impuesto de abril.',
        accion: 'Pídele a tu analista activarla.', plazo: null, quien: 'Tu analista' });
    }
    if (R.estado !== 'VIGENTE' && R.estado !== 'DESACTUALIZADA') return null;
    // Solo una corrida del año comercial del período (sin el año no se puede verificar: no se usa)
    if (!hay(R.anioComercial) || +R.anioComercial !== +String(c.periodo).slice(0, 4)) return null;
    if (R.estado === 'DESACTUALIZADA') return r({ id: 'renta_desact', tier: 2, monto: 0, color: 'morado', frase: '¿Mi proyección de renta sigue vigente?',
      detectado: 'Tu proyección de renta tiene datos al ' + dia(R.corte) + ' y ya hay datos nuevos.', impacto: 'Mientras no se actualice, no la usamos para recomendarte montos.',
      accion: 'Pídele a tu analista actualizarla para decidir el PPM.', plazo: null, quien: 'Tu analista', usa: 'mirenta' });
    var o = R.outputs || {}, idpc = o['forecast.idpc'], ppm = o['forecast.ppm.imputable'], saldo = o['forecast.saldo_abril'];
    var fechas = 'actualizada el ' + dia(R.finalizado) + ', datos al ' + dia(R.corte);
    if (hay(idpc) && hay(ppm) && hay(saldo) && n(idpc) > 0 && n(saldo) > 0 && n(ppm) / n(idpc) < cfg.coberturaMin) {
      var cuota = o['sim.ppm_voluntario.cuota_mensual'];
      return r({ id: 'renta_cobertura', monto: saldo, color: 'morado', frase: '¿Me alcanzará para la renta de abril?',
        detectado: 'Según tu proyección de renta (' + fechas + '), tus PPM cubren el ' + Math.round(n(ppm) / n(idpc) * 100) + ' % del impuesto de abril: faltarían ' + clp(saldo) + '.',
        impacto: clp(saldo) + ' a pagar en abril si nada cambia.',
        accion: (hay(cuota) && n(cuota) > 0 ? 'Revisemos un PPM voluntario: según tu escenario de MiRenta, con ' + clp(cuota) + ' al mes hasta diciembre podrías llegar a abril sin saldo (proyección sujeta a cambios).' : 'Revisemos tu PPM y la opción de un PPM voluntario en la próxima reunión (proyección sujeta a cambios).'),
        plazo: null, quien: 'Tu analista', usa: 'mirenta' });
    }
    return null;
  }

  var FAMILIAS = ['rec_prov', 'rec_cli', 'dup_voucher', 'dup_exacto', 'nc_sin_ref', 'raz_compras', 'raz_ventas', 'atipico', 'nuevo', 'renta'];
  function familia(id) { for (var i = 0; i < FAMILIAS.length; i++) if (id.indexOf(FAMILIAS[i]) === 0) return FAMILIAS[i]; return id; }
  // ctx.actual = {sinDato, tasaPPM, real:{debito, credito, ivaPagar, ppm, f29, nuevoRemanente, ventasBase}, est:{…}}
  //   real = "Así vamos" (registrado a la fecha de corte); est = referencia estimada a fin de mes (proyección lineal corregida).
  //   Compatibilidad: si no vienen real/est, los campos planos valen para ambos (mes cerrado: real = est).
  function vista(c, usarEst) {
    var a = c.actual || {}, src = a.real ? (usarEst && c.mesEnCurso && a.est ? a.est : a.real) : a;
    var v = Object.create(c); v.actual = Object.assign({}, src, { sinDato: a.sinDato, tasaPPM: a.tasaPPM != null ? a.tasaPPM : src.tasaPPM });
    v._est = !!(a.real && usarEst && c.mesEnCurso && a.est); return v;
  }
  function marcar(x, usa) { if (!x) return x; (Array.isArray(x) ? x : [x]).forEach(function (y) { if (y && !y.usa) y.usa = usa; }); return x; }
  function generar(ctx, cfgParcial) {
    var cfg = Object.assign({}, CONFIG, cfgParcial || {}), c = ctx || {};
    if (!c.hoy || !c.periodo) return [];
    var R = vista(c, false), E = vista(c, true), usaE = E._est ? 'estimado' : 'real';
    var lista = [], ya = {};
    function add(x) { if (!x) return; (Array.isArray(x) ? x : [x]).forEach(function (y) { if (y) { lista.push(y); ya[y.id] = true; } }); }
    add(reglaSii(c)); add(reglaRenta(c, cfg)); add(marcar(reglaReserva(E, cfg), usaE));
    if (!c.exenta) { add(marcar(reglaAcuse(R, cfg), 'real')); add(marcar(reglaReclamadas(R), 'real')); add(marcar(reglaRemanente(R, cfg), 'real'));
      add(marcar(reglaRazonabilidad(E, cfg), usaE)); add(marcar(reglaDocumentos(R, cfg), 'real')); add(marcar(reglaConcentracion(R, cfg), 'real'));
      add(marcar(reglaDuplicados(R, cfg), 'real')); }
    add(marcar(reglaRecurrentes(R, cfg), 'real')); add(marcar(reglaVentasPpm(E, cfg, ya), usaE)); add(marcar(reglaVencimiento(E, cfg, ya), usaE));
    // Una sola por familia (la de mayor impacto) para no repetir el mismo mensaje.
    var porFam = {};
    lista.forEach(function (x) { var f = familia(x.id); if (!porFam[f] || porFam[f].monto < x.monto) porFam[f] = x; });
    var todas = Object.keys(porFam).map(function (k) { return porFam[k]; });
    // Orden (documentado): 1) tier 0 = críticas (SII desactualizado, coincidencias de comprobantes) · 2) las 2 de mayor impacto en pesos ·
    // 3) a lo más cfg.maxSinMonto aviso(s) sin monto (tier 2: preventivos) · 4) el resto por monto. Así un aviso sin monto no desplaza
    // sistemáticamente a las observaciones con impacto.
    var crit = todas.filter(function (x) { return x.tier === 0; }).sort(function (a, b) { return b.monto - a.monto; });
    var conMonto = todas.filter(function (x) { return x.tier !== 0 && x.tier !== 2 && x.monto > 0; }).sort(function (a, b) { return b.monto - a.monto; });
    var sinMonto = todas.filter(function (x) { return x.tier === 2 || (x.tier !== 0 && !(x.monto > 0)); });
    return crit.concat(conMonto.slice(0, 2), sinMonto.slice(0, cfg.maxSinMonto), conMonto.slice(2)).slice(0, cfg.max);
  }

  // Tendencia de ventas y compras netas (6 meses) para el gráfico y su resumen en texto.
  function tendencia(serie, actual) {
    var s = stats(serie); if (s.n < 3 || !(s.prom > 0) || !hay(actual)) return null;
    return { prom: s.prom, var: (n(actual) - s.prom) / s.prom, n: s.n };
  }
  var api = { CONFIG: CONFIG, tendencia: tendencia, generar: generar, estadoAcuse: estadoAcuse, stats: stats, signo: signo, sumaIva: sumaIva };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  raiz.PreIvaRecos = api;
})(typeof window !== 'undefined' ? window : globalThis);
