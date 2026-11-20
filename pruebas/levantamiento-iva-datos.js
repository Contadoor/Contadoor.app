// LEVANTAMIENTO-IVA · respuesta FICTICIA de public.sii_levantamiento_iva (forma LIVA_V2) para la demo y las pruebas (sin datos de clientes).
// 36 meses: la mayoría calza; diferencias, provisionales, condicionados, F29 sin montos, sin datos y una «sin declaración encontrada».
(function (raiz) {
  function mes(i) { var d = new Date(2023, 10 + i, 1); return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0'); }
  var meses = [], tot = {}, imp = 0, K = { meses: 0, impuesto: 0, reajuste: 0, intereses: 0, multa: 0, total: 0 }, P = { meses: 0, impuesto: 0, reajuste: 0, intereses: 0, multa: 0, total: 0 },
      X = { meses: 0, impuesto: 0, reajuste_calculado: 0, intereses_calculados: 0, multa_calculada: 0, componentes_pendientes: [] }, cond = 0;
  for (var i = 0; i < 36; i++) {
    var p = mes(i), base = 1000000 + (i % 7) * 85000, deb = Math.round(base * 0.19), cre = Math.round(deb * 0.55);
    var m = { periodo: p, motivo: null, alertas: [], estimacion: null, calce: null, condicionado: false, condiciones: [], rcv_parcial: false,
              f29: { folio: 8000000 + i, letra: 'O', rectificada: false, montos: true, codigos: { '502': deb, '538': deb, '520': cre, '537': cre } } };
    if (i < 2) { m.estado = 'sin_datos'; m.motivo = 'no_disponible_cartapra'; m.f29 = null;
      m.debito = { rcv: null, declarado: null, diferencia: null }; m.credito = { rcv: null, declarado_documentos: null }; m.remanente = {}; m.iva = { declarado: null, recalculado: null, diferencia: null }; }
    else if (i < 4) { m.estado = 'f29_sin_montos'; m.motivo = 'f29_sin_montos_cartapra'; m.f29.montos = false; m.f29.codigos = null;
      m.debito = { rcv: deb, declarado: null, diferencia: null }; m.credito = { rcv: cre, declarado_documentos: null }; m.remanente = {}; m.iva = { declarado: null, recalculado: null, diferencia: null }; }
    else {
      var decl = deb, dcre = cre;
      if (i === 9 || i === 21) decl = deb - 52000;             // débito no declarado
      if (i === 15) dcre = cre + 47500;                         // crédito de más
      if (i === 18) decl = deb - 30000;                         // diferencia con RCV parcial
      if (i === 27) { decl = deb - 60; m.alertas = ['notas_credito_emitidas', 'compras_pendientes']; }   // dentro de tolerancia
      if (i === 30) m.alertas = ['sin_derecho_o_uso_comun'];
      var ivaD = decl - dcre, ivaR = deb - cre, dif = ivaR - ivaD;
      m.estado = i === 33 ? 'no_declarado' : dif > 100 ? 'diferencia' : (i === 30 ? 'a_favor' : 'calza');
      if (i === 12) { m.estado = 'coincidencia_provisional'; m.rcv_parcial = true; m.alertas = ['rcv_parcial']; }
      if (i === 18) { m.estado = 'diferencia_preliminar'; m.rcv_parcial = true; m.alertas = ['rcv_parcial']; }
      if (i === 24) { m.estado = 'revisar_arrastre'; m.alertas = ['remanente_distinto']; }
      if (i === 4 || i === 5) { m.condicionado = true; m.condiciones = ['remanente_inicial_desconocido']; m.alertas = [i === 4 ? 'remanente_inicial_desconocido' : 'depende_de_supuesto']; cond++; }
      if (m.estado === 'calza') m.calce = i === 27 ? 'dentro_tolerancia' : 'exacta';
      if (i === 33) { ivaD = 0; dif = ivaR; m.f29 = null; decl = null; dcre = null; m.motivo = 'sin_declaracion_en_antecedentes'; }
      m.debito = { rcv: deb, declarado: decl, diferencia: decl == null ? null : deb - decl };
      m.credito = { rcv: cre, declarado_documentos: dcre, diferencia: dcre == null ? null : cre - dcre };
      m.remanente = { anterior_declarado: 0, anterior_recalculado: i === 4 ? null : 0, anterior_supuesto: i === 4 ? 0 : null, siguiente_declarado: 0, siguiente_recalculado: 0 };
      m.iva = { declarado: ivaD, recalculado: ivaR, diferencia: dif };
      if (dif > 100 && ['diferencia', 'no_declarado', 'diferencia_preliminar'].indexOf(m.estado) >= 0) {
        var at = 34 - i, r = i === 21 ? null : Math.round(dif * 0.004 * at), b = dif + (r || 0), dias = at * 30;
        var it = Math.round(b * 0.00022 * dias), pct = Math.min(0.1 + 0.02 * at, 0.3), mu = Math.round(b * pct);
        var cal = r == null ? 'no_calculable' : (m.estado === 'diferencia_preliminar' ? 'provisional' : 'completa');
        m.estimacion = { vencimiento: '2026-01-20', meses_atraso: at, dias_atraso: dias, impuesto: dif, reajuste: r, reajuste_estado: r == null ? 'pendiente_utm' : 'calculado',
          intereses: it, intereses_estado: r == null ? 'provisional_sin_reajuste' : 'calculado', intereses_tramos: [{ regla: 'diaria', dias: dias, tasa_pct: 0.022 }], semestres_sin_tasa: [],
          multa_pct: pct, multa: mu, multa_estado: r == null ? 'provisional_sin_reajuste' : 'calculado', calidad: cal, total: r == null ? null : dif + r + it + mu };
        imp += dif;
        if (cal === 'completa') { K.meses++; K.impuesto += dif; K.reajuste += r; K.intereses += it; K.multa += mu; K.total += dif + r + it + mu; }
        else if (cal === 'provisional') { P.meses++; P.impuesto += dif; P.reajuste += r; P.intereses += it; P.multa += mu; P.total += dif + r + it + mu; }
        else { X.meses++; X.impuesto += dif; X.componentes_pendientes = ['reajuste', 'intereses', 'multa']; }
      }
    }
    tot[m.estado] = (tot[m.estado] || 0) + 1; meses.push(m);
  }
  raiz.LIVA_DEMO = {
    cliente_id: 1, desde: meses[0].periodo, hasta: meses[35].periodo, fuente: 'cartapra', version: 'LIVA_V2', conexion: { estado: 'conectada' }, historial: null,
    opciones: { fecha_pago: '2026-11-25', tolerancia: 100, medio: 'internet', dia_vencimiento: 20, fiscalizacion: false, utm_pago: 72440 },
    meses: meses, totales: { meses: 36, por_estado: tot, condicionados: cond, dentro_tolerancia: { meses: 1, iva_acumulado: 60, debito_acumulado: 60, credito_acumulado: 0 } },
    estimacion: { aviso: 'ESTIMACIÓN PRELIMINAR, VERIFICAR: no constituye determinación definitiva ni reemplaza el cálculo del SII/Tesorería ni la revisión del analista.',
      impuesto: imp, posible_a_favor: 0, conocido: K, provisional: P, no_calculable: X, total: null, total_provisional: null, total_no_calculable: true,
      supuestos: ['Vencimiento: día 20 del mes siguiente (F29 por internet con facturador electrónico); si cae sábado, domingo o festivo se corre al siguiente día hábil.',
        'Reajuste art. 53 CT: UTM del mes de pago ÷ UTM del mes de vencimiento.',
        'Intereses art. 53 CT: hasta 31-12-2024 1,5 % por mes o fracción; desde 1-1-2025 interés penal diario con la tasa semestral del SII.',
        'Multa art. 97 N°11 CT: 10 % + 2 % por mes o fracción, tope 30 % (rectificación espontánea).',
        'Sin condonación: el SII puede condonar intereses y multas; no se aplica en esta estimación.'] }
  };
})(typeof window !== 'undefined' ? window : globalThis);
