/* ============================================================
   pre-iva/iva-validacion.js — escrituras del IVA del período, COMPARTIDAS por el Pre-IVA y el Reporte Contable (19-11).
   Regla de Luciano (19-11, definitiva):
     · PRE-IVA = MES EN CURSO: solo «cómo vamos» con un estimado. No valida, no cierra, no pasa nada al reporte.
     · CONTABLE = PERÍODO CONTABLE (mes anterior, el que se declara): ahí se VALIDA el IVA («✅ Validar IVA de <mes>» en la tarjeta
       «Cálculo del F29»); si está bien se cierra y el flujo pasa al paso siguiente (Reporte → Pagos / obligación F29).
   Este archivo NO inventa escrituras ni SQL: arma EXACTAMENTE las mismas peticiones que ya existían:
     · preiva_historial (borrador del Pre-IVA y «envío» con fecha_envio/enviado_por) — antes armadas dentro de pre-iva/index.html;
     · reportes_mensuales (PATCH de «Validar Pre-IVA» del Reporte Contable, estado_contable = 'completado') — antes dentro de guardarF29().
   Ambas pantallas llaman a estas funciones, así la fila y el PATCH son idénticos vengan de donde vengan (pruebas: iva-validacion.test.js).
   Además: remanenteValidacion() = el BLOQUEO del remanente SOLO para validar en Contable (nunca $0, nunca dos meses atrás;
   el que manda es el de Contable — public.remanente_anterior — porque la base exige iva_remanente_sig = cód. 504 − (débito − crédito)).
   ============================================================ */
(function (raiz) {
  'use strict';
  var F = raiz.PreIvaF29 || (typeof require === 'function' ? require('./f29-formula.js') : null);
  var S = raiz.PreIvaSii || (typeof require === 'function' ? require('./sii-cartapra.js') : null);
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  function num(v) { if (v === null || v === undefined || v === '') return null; var x = Number(v); return isFinite(x) ? x : null; }
  function perGuion(p) { p = String(p || '').replace('-', ''); return /^\d{6}$/.test(p) ? p.slice(0, 4) + '-' + p.slice(4) : String(p || ''); }
  function mesTxt(p) { p = String(p || '').replace('-', ''); return /^\d{6}$/.test(p) ? MESES[+p.slice(4) - 1] + ' ' + p.slice(0, 4) : 'el mes anterior'; }
  function perAnterior(p) { p = String(p || '').replace('-', ''); if (!/^\d{6}$/.test(p)) return null; var y = +p.slice(0, 4), m = +p.slice(4) - 1; if (m < 1) { m = 12; y--; } return y + '-' + (m < 10 ? '0' : '') + m; }
  function fmt(n) { return '$' + Math.round(Math.abs(Number(n) || 0)).toLocaleString('es-CL'); }

  // ── preiva_historial ────────────────────────────────────────────────────────────────────────────
  // o: { clienteRut, periodo, debito, credito, remanente, f29, ppm, tasaPpm, netoVentas, netoCompras, porTipoVentas, porTipoCompras,
  //      fuenteMontos, sii (PreIvaSii.aPantalla o null), edicionPPM (sii_detalle.ppm_editado o null), remanenteEstimado (opcional) }
  // Misma fila que guardaba el Pre-IVA (filaDesdePantalla) — columnas reales de preiva_historial.
  function filaHistorial(o) {
    o = o || {};
    var reg = S.registro(o.sii || null, o.fuenteMontos);
    var det = F.detalleConEdicionPPM(reg.sii_detalle, o.edicionPPM || null);
    if (o.remanenteEstimado) det = Object.assign({}, det || {}, { remanente_estimado: o.remanenteEstimado });   // Pre-IVA: remanente estimado (no oficial)
    return {
      cliente_rut: o.clienteRut, periodo: perGuion(o.periodo),
      debito_iva: o.debito, credito_iva: o.credito, remanente: o.remanente, f29: o.f29, ppm: o.ppm, tasa_ppm: o.tasaPpm,
      neto_ventas: o.netoVentas || 0, neto_compras: o.netoCompras || 0,
      por_tipo_doc_ventas: o.porTipoVentas || {}, por_tipo_doc_compras: o.porTipoCompras || {},
      fuente_montos: o.fuenteMontos || null, sii_datos_al: reg.sii_datos_al, sii_detalle: det
    };
  }
  // Cabeceras idénticas a las que usaba el Pre-IVA (sbFetch agrega la sesión y el tipo de contenido).
  // Borrador: PATCH solo si NO fue enviado/validado (fecha_envio is null); si no existe, POST. Nunca convierte en borrador un validado.
  function peticionBorrador(fila) {
    var cuerpo = Object.assign({}, fila); delete cuerpo.cliente_rut; delete cuerpo.periodo;
    var nuevo = Object.assign({}, fila, { fecha_envio: null, enviado_por: null });
    return {
      patch: { path: 'preiva_historial?cliente_rut=eq.' + encodeURIComponent(fila.cliente_rut) + '&periodo=eq.' + fila.periodo + '&fecha_envio=is.null',
               opts: { method: 'PATCH', headers: { 'Prefer': 'return=representation' }, body: JSON.stringify(cuerpo) } },
      post: { path: 'preiva_historial', opts: { method: 'POST', headers: { 'Prefer': 'return=representation' }, body: JSON.stringify(nuevo) } }
    };
  }
  // «Envío» del Pre-IVA (fecha_envio + enviado_por, upsert por cliente y período) — la misma petición de siempre.
  function peticionEnvio(fila, por, ahoraIso) {
    var b = Object.assign({}, fila, { fecha_envio: ahoraIso || new Date().toISOString(), enviado_por: por || null });
    return { path: 'preiva_historial?on_conflict=cliente_rut,periodo',
             opts: { method: 'POST', headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify(b) } };
  }
  // «Validar IVA» de Contable: la misma petición del envío + la marca de quién validó (sii_detalle.validacion_iva, columna existente).
  function peticionValidado(fila, por, ahoraIso) {
    var at = ahoraIso || new Date().toISOString();
    var f = Object.assign({}, fila, { sii_detalle: Object.assign({}, fila.sii_detalle || {}, { validacion_iva: { por: por || null, at: at, desde: 'contable' } }) });
    return peticionEnvio(f, por, at);
  }

  // ── reportes_mensuales: el PATCH de «Validar» del Reporte Contable (estado_contable → 'completado') ─────────
  // o: { debito, credito, remanenteAnterior, postergado, ppmBase, ppmTasa, ppm, retHon, otrosImp, obs, fechaVencPostergado }
  // Igual que guardarF29(): remanente siguiente = |débito − crédito − remanente anterior| si es negativo, si no 0.
  function patchReporte(o) {
    o = o || {};
    var deb = Number(o.debito) || 0, cred = Number(o.credito) || 0, rem = Number(o.remanenteAnterior) || 0;
    var ivaResult = deb - cred - rem, postergado = !!o.postergado;
    var remanente = ivaResult < 0 ? Math.abs(ivaResult) : 0;
    return {
      debito_iva: deb,
      credito_iva: cred,
      iva_remanente_sig: remanente,
      remanente: remanente,
      iva_postergado: postergado ? Math.max(0, ivaResult) : 0,
      postergar_iva: postergado,
      iva_fecha_venc: postergado ? (o.fechaVencPostergado || null) : null,
      ppm_base: Number(o.ppmBase) || 0,
      ppm_tasa: o.ppmTasa == null ? null : o.ppmTasa,
      ppm: Number(o.ppm) || 0,
      ret_hon: Number(o.retHon) || 0,
      otros_imp: Number(o.otrosImp) || 0,
      obs_cont: o.obs || null,
      estado_contable: 'completado',
      listo_panel_control: false
    };
  }

  // ── Remanente para VALIDAR en Contable (bloqueo) ───────────────────────────────────────────────
  // o: { periodo, sii (aPantalla o null), remContable {valor, fuente, info (RemanenteAnterior.resolver), raw} }
  // Manda el de Contable (public.remanente_anterior: reporte del mes anterior validado o cód. 77 ingresado a mano): es el que la base usa
  // para revisar el remanente siguiente. El del SII se usa para CONTRASTAR: si no coinciden, no se valida. Sin el de Contable → BLOQUEO
  // (con «Ingresar remanente a mano» si la base lo permite, sugiriendo el cód. 77 del SII). Nunca $0, nunca dos meses atrás.
  function remanenteValidacion(o) {
    o = o || {};
    var per = perGuion(o.periodo), mA = mesTxt(perAnterior(per)), mP = mesTxt(per);
    var rc = o.remContable || {}, info = rc.info || {}, p = o.sii || null;
    var RD = S.remanenteDelPeriodo({ periodo: per, sii: p, remContable: rc });
    var antC = info.periodoAnterior ? perGuion(info.periodoAnterior) : null;
    var contOk = (rc.fuente === 'contable' || rc.fuente === 'manual') && num(rc.valor) != null && (!antC || antC === perAnterior(per));
    var ra = (p && p.remanenteSii) || {}, cod77Sii = num(ra.cod77);
    var cierre = ' Mientras tanto no se puede validar el IVA de ' + mP + '.';
    if (!contOk) {
      var b = RD.bloqueo ? Object.assign({}, RD.bloqueo, { mensaje: RD.bloqueo.mensaje.replace(/ Mientras tanto no se puede calcular [^.]*\.$/, cierre) }) : null;
      if (!b) {
        var puede = info.fuente === 'falta' || info.fuente === 'manual';
        b = { tipo: rc.fuente === 'error' ? 'sin_lectura' : 'contable_sin', puedeManual: rc.fuente === 'error' ? false : puede, detalleContable: info.aviso || null, mesAnterior: mA, mes: mP,
              mensaje: rc.fuente === 'error' ? '⚠️ No se pudo leer el remanente de ' + mA + ' desde Contable: recarga la página.' + cierre
                : '⚠️ El SII tiene el remanente de ' + mA + ' (' + fmt(RD.valor) + '), pero Gestoor aún no lo tiene registrado: ' +
                  (puede ? 'ingrésalo a mano (cód. 77 del F29 de ' + mA + ') para validar.' : (info.aviso || 'valida primero el reporte de ' + mA + '.')) + cierre };
      }
      b.cod77Sugerido = cod77Sii;
      return { valor: null, origen: null, bloqueo: b };
    }
    if (RD.origen === 'sii' && Math.round(num(RD.valor)) !== Math.round(num(rc.valor)))
      return { valor: null, origen: null, bloqueo: { tipo: 'descuadre', puedeManual: false, mesAnterior: mA, mes: mP, cod77Sugerido: cod77Sii,
        mensaje: '⚠️ El remanente de ' + mA + ' no cuadra: el F29 del SII da ' + fmt(RD.valor) + ' y Contable tiene ' + fmt(rc.valor) +
          (rc.fuente === 'manual' ? ' (ingresado a mano)' : '') + '. Revisa el reporte de ' + mA + ' antes de validar.' } };
    return { valor: num(rc.valor), origen: rc.fuente, texto: RD.origen === 'sii' ? RD.texto : ((info.detalle) || 'Remanente de ' + mA + ' registrado en Contable'), bloqueo: null };
  }

  // ── Todo lo que impide «Validar IVA» desde la tarjeta (además de lo que revisa el Reporte Contable: libros, exento, etc.) ──
  // a = ContableCalculoF29.armar(...) · rv = remanenteValidacion(...) · o: { estadoContable, listoPanelControl }
  function bloqueosValidar(a, rv, o) {
    o = o || {}; var L = [];
    var ESPERA = 'Esperando datos del SII (próxima sincronización 10:00/17:00).';
    if (!a || !a.conectado) { L.push(o.conectada ? ESPERA : 'Esta empresa aún no está conectada al SII: valida desde «Revisar / Validar IVA».'); return L; }
    if (o.estadoContable === 'completado') { L.push('El IVA de ' + mesTxt(a.periodo) + ' ya está validado.'); return L; }
    if (a.esMesActual) L.push('El período ' + mesTxt(a.periodo) + ' aún está en curso: el IVA se valida en Contable al cerrar el período.');
    if (rv && rv.bloqueo) L.push(rv.bloqueo.mensaje.replace(/^⚠️\s*/, ''));
    // 19-11: conectada sin ventas/compras/honorarios del período aún leídos por Cartapra → se espera la próxima sincronización
    var esperando = (a.faltas || []).some(function (f) { return /Cartapra aún no (las|los) trae/.test(f) && !/montos del F29/.test(f); });
    if (esperando) L.push(ESPERA);
    (a.faltas || []).forEach(function (f) { if (esperando && /Cartapra aún no (las|los) trae/.test(f) && !/montos del F29/.test(f)) return;
      if (!/remanente|F29 de |UTM de /.test(f) || !(rv && rv.bloqueo)) L.push('Falta: ' + f); });
    return L;
  }

  var api = { filaHistorial: filaHistorial, peticionBorrador: peticionBorrador, peticionEnvio: peticionEnvio, peticionValidado: peticionValidado,
              patchReporte: patchReporte, remanenteValidacion: remanenteValidacion, bloqueosValidar: bloqueosValidar, mesTxt: mesTxt, perGuion: perGuion };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  raiz.IvaValidacion = api;
})(typeof window !== 'undefined' ? window : globalThis);
