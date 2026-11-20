// LIVA-DETALLE-F29 · respuestas FICTICIAS (forma real de las RPC) para la demo y las pruebas. Sin datos de clientes:
// «Empresa Ficticia SpA», RUT y folios inventados. Requiere levantamiento-iva-datos.js (LIVA_DEMO) cargado antes.
(function (raiz) {
  var CAT = [  // [código, sección, línea, glosa, regla]
    ['503', 'debitos', '7', 'Facturas emitidas: cantidad', 'rcv'], ['502', 'debitos', '7', 'Facturas emitidas: débito fiscal', 'rcv'],
    ['110', 'debitos', '10', 'Boletas y vales de máquinas registradoras: cantidad', 'rcv'], ['111', 'debitos', '10', 'Boletas y vales: débito fiscal', 'rcv'],
    ['509', 'debitos', '13', 'Notas de crédito emitidas por facturas: cantidad', 'rcv'], ['510', 'debitos', '13', 'Notas de crédito emitidas por facturas: impuesto (resta)', 'rcv'],
    ['538', 'debitos', '23', 'TOTAL DÉBITOS (líneas 7 a 22)', 'calculado'],
    ['519', 'creditos', '28', 'Facturas recibidas del giro (incluye facturas de compra emitidas): cantidad', 'rcv'], ['520', 'creditos', '28', 'Facturas recibidas del giro: crédito fiscal', 'rcv'],
    ['527', 'creditos', '32', 'Notas de crédito recibidas: cantidad', 'rcv'], ['528', 'creditos', '32', 'Notas de crédito recibidas: crédito (resta)', 'rcv'],
    ['504', 'creditos', '36', 'Remanente de crédito fiscal del mes anterior (reajustado, art. 27 DL 825)', 'encadenado'],
    ['537', 'creditos', '49', 'TOTAL CRÉDITOS (líneas 28 a 48)', 'calculado'],
    ['89', 'determinacion', '50', 'IVA determinado (débitos mayores que créditos)', 'calculado'], ['77', 'determinacion', '50', 'Remanente de crédito fiscal para el mes siguiente (créditos mayores que débitos)', 'calculado'],
    ['62', 'renta', '69', 'PPM neto determinado', 'conservado'], ['151', 'renta', '61', 'Retención de honorarios (art. 42 N°2 LIR)', 'conservado'],
    ['91', 'otros', '140', 'TOTAL A PAGAR dentro del plazo legal', 'calculado']
  ];
  function codigos(o, c, montos) {
    return CAT.map(function (k) {
      var or = montos ? (o[k[0]] || 0) : null, co = c[k[0]] != null ? c[k[0]] : (o[k[0]] || 0);
      return { codigo: k[0], seccion: k[1], linea: k[2], glosa: k[3], regla: k[0] === '504' && co === (o['504'] || 0) ? 'conservado' : k[4], original: or, corregido: co, diferencia: co - (or || 0) };
    });
  }
  function mesB(m, i) {
    var deb = (m.debito || {}).rcv, cre = (m.credito || {}).rcv, f = m.f29;
    if (m.estado === 'sin_datos') return { periodo: m.periodo, estado: 'sin_rcv', f29: null, detalle: 'sin_rcv', codigos: null, alertas: [] };
    if (m.estado === 'f29_sin_montos') return { periodo: m.periodo, estado: 'f29_sin_montos', f29: { folio: f.folio, letra: 'O', rectificada: false, montos: false }, detalle: 'completo', codigos: null, alertas: [] };
    if (i === 7) return { periodo: m.periodo, estado: 'sin_detalle', f29: { folio: f.folio, letra: 'O', rectificada: false, montos: true }, detalle: 'sin_detalle', codigos: null, alertas: [] };
    var dDecl = (m.debito || {}).declarado, cDecl = (m.credito || {}).declarado_documentos;
    var o = f ? { '503': 1, '502': dDecl, '538': dDecl, '519': 1, '520': cDecl, '537': cDecl, '89': Math.max(dDecl - cDecl, 0), '62': 12000, '151': 4500 } : {};
    if (f) o['91'] = o['89'] + 16500;
    var c = { '503': 1, '502': deb, '538': deb, '519': 1, '520': cre, '537': cre, '89': Math.max(deb - cre, 0), '77': Math.max(cre - deb, 0), '91': Math.max(deb - cre, 0) + (f ? 16500 : 0) };
    var dif = c['89'] - (o['89'] || 0), est = !f ? 'sin_f29' : Math.abs(dif) > 100 ? 'con_diferencia' : Math.abs(dif) > 0 ? 'dentro_tolerancia' : 'sin_diferencia';
    var e = dif > 100 ? { estimacion: true, vencimiento: m.vencimiento || '2025-01-20', fecha_pago: '2026-11-25', meses_atraso: 12, impuesto: dif, reajuste: Math.round(dif * 0.04),
      intereses: Math.round(dif * 0.08), multa_pct: 0.3, multa: Math.round(dif * 0.31), total: dif + Math.round(dif * 0.04) + Math.round(dif * 0.08) + Math.round(dif * 0.31), calidad: 'completa' } : null;
    return { periodo: m.periodo, estado: est, estado_levantamiento: m.estado, vencimiento: m.vencimiento || null, f29: f ? { folio: f.folio, letra: 'O', rectificada: false, montos: true } : null,
      detalle: 'completo', codigos: codigos(o, c, !!f), otros_codigos_conservados: f ? { '115': 0.25, '563': 4800000 } : null, tipos_sin_codigo: [], delta_504: 0,
      iva_determinado: { original: f ? o['89'] : null, corregido: c['89'], diferencia: est === 'con_diferencia' || est === 'sin_f29' ? dif : null },
      remanente: { original: f ? 0 : null, corregido: c['77'] }, tipo: est === 'sin_f29' ? 'declaracion_original_fuera_de_plazo' : est === 'con_diferencia' ? 'rectificatoria' : null,
      estimacion: e, alertas: i === 15 ? ['cambia_504_siguiente'] : [] };
  }
  var L = raiz.LIVA_DEMO, mb = L.meses.map(mesB), rect = mb.filter(function (m) { return m.estado === 'con_diferencia'; });
  raiz.LIVD_BORRADOR = {
    cliente_id: 1, desde: L.desde, hasta: L.hasta, version: 'LIVA_F29_B1', opciones: { fecha_pago: '2026-11-25', tolerancia: 100 }, meses: mb,
    resumen: { meses: mb.length, con_diferencia: rect.length, diferencia_iva: rect.reduce(function (s, m) { return s + m.iva_determinado.diferencia; }, 0),
               estimacion_total: rect.reduce(function (s, m) { return s + (m.estimacion ? m.estimacion.total : 0); }, 0), estimacion_no_calculable: false, remanente_cambia_fuera_de_rango: null, cadena_cortada_en: [] },
    aviso: 'Borrador preparado por Contadoor para rectificar en sii.cl; verificar antes de presentar.',
    instrucciones: ['La rectificación se presenta en sii.cl: Servicios online > Impuestos mensuales > Declaración mensual (F29) > Rectificar F29 («Formulario 29 rectificatoria»), período por período, del más antiguo al más reciente.',
      'Al presentar, el SII calcula reajustes, intereses y multas; la estimación de este borrador es solo referencial.'],
    fuente_codigos: 'SII, Instrucciones para llenar el Formulario 29 (https://www.sii.cl/servicios_online/instrucciones_f29_20241112.pdf)'
  };
  function docu(tipo, folio, neto, iva, estado, signo, razon) {
    return { tipo_dte: tipo, folio: folio, fecha: '2025-06-0' + (1 + folio % 8), rut: '11111111-1', razon_social: razon === undefined ? 'Proveedor Ficticio Ltda' : razon,
      neto: neto, exento: 0, iva: iva, total: neto + iva, retencion: null, estado: estado, signo: signo || 1 };
  }
  raiz.LIVD_DOCS = {
    venta: { periodo: '202506', libro: 'venta', total_documentos: 4, truncado: false, documentos: [docu(33, 1, 100000, 19000, null), docu(33, 2, 50000, 9500, null), docu(39, 3, 20000, 3800, null, 1, null), docu(61, 4, 10000, 1900, null, -1)] },
    compra: { periodo: '202506', libro: 'compra', total_documentos: 4, truncado: false, documentos: [docu(33, 101, 30000, 5700, 'registro'), docu(61, 102, 5000, 950, 'registro', -1),
      docu(33, 103, 10000, 1900, 'pendiente'), docu(33, 104, 20000, 3800, 'reclamado', 1, '<img src=x onerror="window.__xss=1">')] }
  };
  function g(t, n, neto, iva) { return { tipo_dte: t, documentos: n, neto: neto, exento: 0, iva: iva, total: neto + iva }; }
  raiz.LIVD_DETALLE = {
    periodo: '202506', detalle: 'completo', version: 'LIVA_DET_1',
    resumen: {
      venta: { tipos: [g(33, 2, 150000, 28500), g(39, 1, 20000, 3800), g(61, 1, -10000, -1900)], total: { documentos: 4, neto: 160000, exento: 0, iva: 30400, total: 190400 }, resumen_sii: { documentos: 4, iva: 30400 } },
      compra_registro: { tipos: [g(33, 1, 30000, 5700), g(61, 1, -5000, -950)], total: { documentos: 2, neto: 25000, exento: 0, iva: 4750, total: 29750 }, resumen_sii: { documentos: 2, iva: 4750 } },
      compra_pendiente: { tipos: [g(33, 1, 10000, 1900)], total: { documentos: 1, neto: 10000, exento: 0, iva: 1900, total: 11900 }, resumen_sii: { documentos: 1, iva: 1900 } },
      compra_reclamado: { tipos: [g(33, 1, 20000, 3800)], total: { documentos: 1, neto: 20000, exento: 0, iva: 3800, total: 23800 }, resumen_sii: { documentos: 1, iva: 3800 } },
      compra_no_incluir: { tipos: [], total: { documentos: 0, neto: 0, exento: 0, iva: 0, total: 0 }, resumen_sii: { documentos: 0, iva: 0 } }
    },
    tipos_sin_codigo: [], f29: { folio: 8000019, letra: 'O', rectificada: false, montos: true },
    codigos: codigos({ '503': 2, '502': 28500, '110': 1, '111': 3800, '538': 32300, '519': 1, '520': 5700, '537': 5700, '89': 26600, '62': 12000, '151': 4500, '91': 43100 },
                     { '503': 2, '502': 28500, '110': 1, '111': 3800, '509': 1, '510': 1900, '538': 30400, '519': 1, '520': 5700, '527': 1, '528': 950, '537': 4750, '89': 25650, '91': 42150 }, true),
    otros_codigos_conservados: { '115': 0.25 }, alertas: [], cobertura: {},
    nota: 'Comparación por código del mes SIN encadenar el remanente (504 = el declarado). El borrador rectificatorio encadena el remanente desde el inicio del rango.'
  };
  raiz.LIVD_SIN_DETALLE = { periodo: '202507', detalle: 'sin_detalle', codigos: null, f29: { folio: 8000020, montos: true }, alertas: [], tipos_sin_codigo: [],
    resumen: { venta: { tipos: [], total: { documentos: 0, neto: 0, exento: 0, iva: 0, total: 0 }, resumen_sii: { documentos: 12, iva: 228000 } },
               compra_registro: { tipos: [], total: { documentos: 0, neto: 0, exento: 0, iva: 0, total: 0 }, resumen_sii: { documentos: 3, iva: 57000 } },
               compra_pendiente: { tipos: [], total: { documentos: 0 } }, compra_reclamado: { tipos: [], total: { documentos: 0 } }, compra_no_incluir: { tipos: [], total: { documentos: 0 } } } };
  // Historial SII cargado: 2 años ficticios (del más reciente al más antiguo).
  var hm = [];
  for (var k = 0; k < 24; k++) {
    var d = new Date(2026, 9 - k, 1), p = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0'), hay = k < 20;
    hm.push({ periodo: p,
      ventas: hay ? { documentos: 10 + k, iva: 190000 + k * 1000, neto: 1000000, exento: 0 } : null,
      compras: hay ? { registro: { documentos: 5, iva: 95000 }, pendiente: { documentos: k % 3, iva: 0 }, reclamado: { documentos: 0, iva: 0 }, no_incluir: { documentos: 0, iva: 0 } } : null,
      detalle: { ventas: hay ? (k === 5 ? 0 : 10 + k) : 0, compras: hay ? (k === 5 ? 0 : 5 + k % 3) : 0 },
      lectura: hay ? { rcv_ventas: { estado: 'completa', leido_cartapra_en: '2026-11-18T10:25:00Z', origen: k > 12 ? 'historia' : 'sync' }, rcv_compras: { estado: k === 3 ? 'parcial' : 'completa', leido_cartapra_en: '2026-11-18T10:25:00Z', origen: k > 12 ? 'historia' : 'sync' } } : null,
      f29: k < 22 ? { folio: 9000000 + k, letra: 'O', estado_sii: 'Vigente', rectificada: k === 2, montos: k !== 4, montos_leidos_en: '2026-11-19T08:00:00Z', iva_determinado: 95000, total_a_pagar: 111500 } : null });
  }
  raiz.LIVD_HISTORIAL = { cliente_id: 1, desde: '202101', hasta: '202611', conexion: { estado: 'conectada', carga_inicial_lista: true }, meses: hm };
  raiz.LIVD_F29 = { periodo: '202610', f29: { folio: 9000000, letra: 'O', estado_sii: 'Vigente', rectificada: false, montos: true, montos_leidos_en: '2026-11-19T08:00:00Z' },
    codigos: [{ codigo: '502', valor: 190000, glosa: 'Facturas emitidas: débito fiscal', seccion: 'debitos', linea: '7' }, { codigo: '503', valor: 10, glosa: 'Facturas emitidas: cantidad', seccion: 'debitos', linea: '7' },
              { codigo: '538', valor: 190000, glosa: 'TOTAL DÉBITOS (líneas 7 a 22)', seccion: 'debitos', linea: '23' }, { codigo: '89', valor: 95000, glosa: 'IVA determinado (débitos mayores que créditos)', seccion: 'determinacion', linea: '50' },
              { codigo: '7', valor: 9000000, glosa: null, seccion: null, linea: null }, { codigo: '915', valor: 1, glosa: null, seccion: null, linea: null }],
    fuente_glosas: 'SII, Instrucciones para llenar el Formulario 29 (instrucciones_f29_20241112.pdf)' };
})(window);
