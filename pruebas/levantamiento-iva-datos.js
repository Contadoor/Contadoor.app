// LEVANTAMIENTO-IVA · respuesta FICTICIA de public.sii_levantamiento_iva para la demo y las pruebas (sin datos de clientes).
// 36 meses: la mayoría calza, algunos con diferencia, uno no declarado, los primeros sin datos.
(function (raiz) {
  function mes(i) { var d = new Date(2023, 10 + i, 1); return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0'); }
  var meses = [], tot = { calza: 0, diferencia: 0, a_favor: 0, sin_datos: 0, no_declarado: 0 }, imp = 0, rea = 0, int = 0, mul = 0;
  for (var i = 0; i < 36; i++) {
    var p = mes(i), base = 1000000 + (i % 7) * 85000, deb = Math.round(base * 0.19), cre = Math.round(deb * 0.55);
    var m = { periodo: p, motivo: null, alertas: [], estimacion: null, f29: { folio: 8000000 + i, letra: 'O', rectificada: false, montos: true, codigos: { '502': deb, '538': deb, '520': cre, '537': cre } } };
    if (i < 4) { m.estado = 'sin_datos'; m.motivo = i < 2 ? 'sin_rcv' : 'f29_sin_montos'; m.f29 = null;
      m.debito = { rcv: null, declarado: null, diferencia: null }; m.credito = { rcv: null, declarado_documentos: null }; m.remanente = {}; m.iva = { declarado: null, recalculado: null, diferencia: null }; }
    else {
      var decl = deb, dcre = cre;
      if (i === 9 || i === 21) decl = deb - 52000;             // débito no declarado
      if (i === 15) dcre = cre + 47500;                         // crédito de más
      if (i === 27) { m.alertas = ['notas_credito_emitidas', 'compras_pendientes']; }
      if (i === 30) m.alertas = ['sin_derecho_o_uso_comun'];
      var ivaD = decl - dcre, ivaR = deb - cre, dif = ivaR - ivaD;
      m.estado = i === 33 ? 'no_declarado' : dif > 100 ? 'diferencia' : (i === 30 ? 'a_favor' : 'calza');
      if (i === 33) { ivaD = 0; dif = ivaR; m.f29 = null; decl = null; dcre = null; }
      m.debito = { rcv: deb, declarado: decl, diferencia: decl == null ? null : deb - decl };
      m.credito = { rcv: cre, declarado_documentos: dcre, diferencia: dcre == null ? null : cre - dcre };
      m.remanente = { anterior_declarado: 0, anterior_recalculado: 0, siguiente_declarado: 0, siguiente_recalculado: 0 };
      m.iva = { declarado: ivaD, recalculado: ivaR, diferencia: dif };
      if (dif > 100) {
        var meses_at = 34 - i, r = Math.round(dif * 0.004 * meses_at), it = Math.round((dif + r) * 0.015 * meses_at), pct = Math.min(0.1 + 0.02 * meses_at, 0.3), mu = Math.round((dif + r) * pct);
        m.estimacion = { vencimiento: '20xx-xx-20', meses_atraso: meses_at, impuesto: dif, reajuste: r, intereses: it, multa_pct: pct, multa: mu, total: dif + r + it + mu };
        imp += dif; rea += r; int += it; mul += mu;
      }
    }
    tot[m.estado]++; meses.push(m);
  }
  Object.keys(tot).forEach(function (k) { if (!tot[k]) delete tot[k]; });
  raiz.LIVA_DEMO = {
    cliente_id: 1, desde: meses[0].periodo, hasta: meses[35].periodo, fuente: 'cartapra', version: 'LIVA_V1', conexion: { estado: 'conectada' }, historial: null,
    opciones: { fecha_pago: '2026-11-25', tolerancia: 100, tasa_interes_mensual: 0.015, dia_vencimiento: 20, fiscalizacion: false },
    meses: meses, totales: { meses: 36, por_estado: tot },
    estimacion: { aviso: 'ESTIMACIÓN APROXIMADA, VERIFICAR antes de usar: no reemplaza el cálculo del SII ni la revisión del analista.', impuesto: imp, reajuste: rea, reajuste_incompleto: false,
      intereses: int, multa: mul, total: imp + rea + int + mul, posible_a_favor: 0,
      supuestos: ['Vencimiento: día 20 del mes siguiente (F29 por internet); no se corre por días inhábiles.', 'Reajuste art. 53 CT: UTM del mes de pago ÷ UTM del mes de vencimiento.',
        'Intereses art. 53 CT: 1,5 % por mes o fracción sobre el impuesto reajustado.', 'Multa art. 97 N°11 CT: 10 % + 2 % por mes o fracción, tope 30 % (rectificación espontánea); sin condonación.'] }
  };
})(typeof window !== 'undefined' ? window : globalThis);
