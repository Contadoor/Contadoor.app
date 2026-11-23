/* ============================================================
   pre-iva/sii-cartapra.js — Pre-IVA · compras y ventas del SII desde Cartapra (SII-PREIVA-F2b R2). SOLO LECTURA.
   Lee la RPC public.sii_preiva_periodo (gestoor-backend, rama feat/sii-preiva-f2b) y la traduce a los datos de entrada
   del Pre-IVA, igual que si se hubiera cargado el libro de MasContable. El cálculo del F29 NO cambia (f29-formula.js).
   Decisiones de Luciano (18-11):
     · SIEMPRE automático: al abrir un cliente/período, los montos del SII se cargan solos en pantalla.
       Se muestra «Datos del SII actualizados al <fecha y hora de Chile>» (lectura del SII por Cartapra).
     · Si ya había un Pre-IVA guardado con otras cifras, se muestran las del SII y se avisa la diferencia.
       Lo guardado en la base NO se reemplaza solo: se guarda cuando el analista valida (o cambia algo).
     · Remanente = oficial del SII: cód. 77 del F29 del mes anterior × UTM (cód. 504; lo calcula la base con rem_cod504).
       Sin F29 anterior en Cartapra, sin montos o sin UTM → se usa el de Contable y se avisa. Si difiere de Contable, se avisa.
     · 19-11 (Luciano): el remanente SIEMPRE es el del MES INMEDIATAMENTE ANTERIOR (nunca el de dos meses atrás). Si no hay remanente
       por ninguna fuente válida (SII, Contable o ingresado a mano) NO se usa $0: remanenteDelPeriodo() devuelve un BLOQUEO con su texto
       y el F29 queda «Falta completar» (igual que la tarjeta del Reporte Contable).
     · Al guardar/validar queda registro: fuente_montos, sii_datos_al y sii_detalle en preiva_historial.
   Otras reglas: crédito = solo compras REGISTRADAS (pendientes se avisan); NC restan (desde la base); mes sin lectura = null.
   RPC no instalada (404 / PGRST202 / 42883) o sin permiso: el Pre-IVA sigue como hoy (libros / guardado).
   ============================================================ */
(function (raiz) {
  'use strict';
  var TIPOS = { 0: 'Boleta de honorarios', 33: 'Factura electrónica', 34: 'Factura exenta', 39: 'Boleta', 41: 'Boleta exenta',
                46: 'Factura de compra', 56: 'Nota de débito', 61: 'Nota de crédito', 110: 'Factura de exportación', 112: 'Nota de crédito de exportación' };
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  function num(v) { if (v === null || v === undefined || v === '') return null; var x = Number(v); return isFinite(x) ? x : null; }
  function fmt(n) { return '$' + Math.round(Math.abs(Number(n) || 0)).toLocaleString('es-CL'); }
  function mesTxt(p) { p = String(p || '').replace('-', ''); return /^\d{6}$/.test(p) ? MESES[+p.slice(4) - 1] + ' ' + p.slice(0, 4) : 'el mes anterior'; }
  function perAnterior(p) { p = String(p || '').replace('-', ''); if (!/^\d{6}$/.test(p)) return null; var y = +p.slice(0, 4), m = +p.slice(4) - 1; if (m < 1) { m = 12; y--; } return y + (m < 10 ? '0' : '') + m; }
  function perSin(p) { return String(p || '').replace('-', ''); }
  function cap(t) { t = String(t || ''); return t.charAt(0).toUpperCase() + t.slice(1); }
  // Fecha y hora de Chile, siempre (el navegador puede estar en otra zona)
  function fechaChile(iso) {
    if (!iso) return null; var d = new Date(iso); if (isNaN(d)) return null;
    return d.toLocaleString('es-CL', { timeZone: 'America/Santiago', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  }
  function porTipo(pt) {
    var o = {}; Object.keys(pt || {}).forEach(function (k) { var x = pt[k] || {}; o[TIPOS[k] || ('Tipo ' + k)] = Number(x.n) || 0; }); return o;
  }

  /* r = respuesta de sii_preiva_periodo · remContable = {valor, fuente:'contable'|'manual'|'sin'|'error'} · fila = Pre-IVA guardado */
  function aPantalla(r, remContable, fila) {
    r = r || {};
    var con = (r.conexion && r.conexion.estado) || 'sin_conexion';
    var v = r.ventas || null, c = (r.compras && r.compras.registro) || null, out = {
      conectado: con !== 'sin_conexion', estadoConexion: con, datosAl: r.datos_al || null, datosAlTxt: fechaChile(r.datos_al),
      hayVentas: !!v, hayCompras: !!c,
      debito: v ? num(v.iva) : null, netoVentas: v ? num(v.neto) : null, exentoVentas: v ? num(v.exento) : null, docsVentas: v ? (Number(v.documentos) || 0) : null,
      credito: c ? num(c.iva) : null, netoCompras: c ? num(c.neto) : null, exentoCompras: c ? num(c.exento) : null, docsCompras: c ? (Number(c.documentos) || 0) : null,
      porTipoVentas: v ? porTipo(v.por_tipo) : {}, porTipoCompras: r.compras ? porTipo(r.compras.por_tipo) : {},
      pendientes: r.compras && r.compras.pendiente ? { n: Number(r.compras.pendiente.documentos) || 0, iva: num(r.compras.pendiente.iva) || 0 } : { n: 0, iva: 0 },
      f29: r.f29_periodo || null, remanente: null, remanenteSii: r.remanente_anterior || null, avisos: [], diferencia: null
    };
    // Remanente oficial del SII (cód. 504 = cód. 77 × UTM)
    var ra = r.remanente_anterior || {}, rc = remContable || {}, m = mesTxt(ra.periodo);
    // Solo el mes INMEDIATAMENTE anterior: si la respuesta trae otro mes (p. ej. dos meses atrás), ese cód. 77 NO se usa.
    var antEsperado = perAnterior(r.periodo), otroMes = !!(antEsperado && ra.periodo && perSin(ra.periodo) !== antEsperado);
    if (otroMes) { ra = { periodo: antEsperado, cod77: null, cod504: null, fuente: 'sin_f29' }; m = mesTxt(antEsperado); }
    out.remanenteSii = r.remanente_anterior ? ra : null;
    var contableOk = (rc.fuente === 'contable' || rc.fuente === 'manual') && num(rc.valor) != null;
    if (num(ra.cod504) != null) {
      out.remanente = { valor: num(ra.cod504), texto: 'F29 de ' + m + ' en el SII (folio ' + ra.folio + '): cód. 77 ' + fmt(ra.cod77) +
        ' × UTM ' + mesTxt(ra.mes_utm_destino) + ' ' + fmt(ra.utm_destino) + ' ÷ UTM ' + mesTxt(ra.mes_utm_origen) + ' ' + fmt(ra.utm_origen) + ' = cód. 504 ' + fmt(ra.cod504) };
      if ((rc.fuente === 'contable' || rc.fuente === 'manual') && num(rc.valor) != null && Math.round(num(rc.valor)) !== Math.round(num(ra.cod504)))
        out.avisos.push('Remanente: Contable tiene ' + fmt(rc.valor) + (rc.fuente === 'manual' ? ' (ingresado a mano)' : '') + ' y el F29 del SII da ' + fmt(ra.cod504) + '. Se usa el del SII.');
    } else if (out.conectado) {
      var motivo = ra.fuente === 'sin_f29' ? 'no hay F29 de ' + m + ' en Cartapra'
        : ra.fuente === 'f29_sin_montos' ? 'Cartapra aún no trae los montos del F29 de ' + m
        : (ra.falta_utm && ra.falta_utm.length) ? 'falta la UTM de ' + ra.falta_utm.map(mesTxt).join(' y ') + ' en Gestoor'
        : 'el SII no entrega el remanente de ' + m;
      out.avisos.push('Remanente: ' + motivo + (contableOk ? '. Se usa el de Contable.' : '. Contable tampoco lo tiene: el F29 queda sin calcular hasta tenerlo.'));
    }
    // Diferencia contra lo ya guardado (no se reemplaza en la base hasta que el analista valide)
    if (fila && (num(fila.debito_iva) || num(fila.credito_iva))) {
      var gD = Math.round(num(fila.debito_iva) || 0), gC = Math.round(num(fila.credito_iva) || 0);
      var sD = out.debito == null ? gD : Math.round(out.debito), sC = out.credito == null ? gC : Math.round(out.credito);
      if (gD !== sD || gC !== sC) {
        out.diferencia = { guardado: { debito: gD, credito: gC }, sii: { debito: sD, credito: sC } };
        out.avisos.push('Lo guardado en Gestoor (débito ' + fmt(gD) + ' · crédito ' + fmt(gC) + ') es distinto del SII (débito ' + fmt(sD) + ' · crédito ' + fmt(sC) +
          '). Se muestran los del SII; quedan guardados cuando valides el Pre-IVA.');
      }
    }
    if (out.pendientes.n > 0) out.avisos.push(out.pendientes.n + ' factura(s) de compra pendiente(s) en el SII: no suman crédito hasta aceptarlas.');
    if ((r.avisos || []).indexOf('cobertura_incompleta') >= 0) out.avisos.push('El SII aún no entrega completo este mes en Cartapra: los montos pueden cambiar.');
    if (out.f29) out.avisos.push('Este mes ya tiene F29 presentado en el SII (folio ' + out.f29.folio + ').');
    return out;
  }
  // ── Remanente del período (19-11, Luciano) — COMPARTIDO: Pre-IVA y tarjeta «Cálculo del F29» del Reporte Contable ──
  // o: { periodo ('AAAAMM' o 'AAAA-MM'), sii (aPantalla(...) o null si no hay lectura del SII), remContable {valor, fuente, info (RemanenteAnterior.resolver), raw} }
  // Orden: F29 del mes anterior en el SII (cód. 504) → Contable (reporte del mes anterior validado o ingresado a mano) → BLOQUEO.
  // Nunca $0 por defecto y nunca el remanente de dos meses atrás. Devuelve { valor, origen, texto, aviso, bloqueo }.
  //   bloqueo = { tipo: sin_declarar | cartapra_sin_montos | falta_utm | conflicto | sin_lectura | contable, mensaje, puedeManual, mesAnterior, mes }
  function remanenteDelPeriodo(o) {
    o = o || {};
    var per = perSin(o.periodo), ant = perAnterior(per), mA = mesTxt(ant), mP = mesTxt(per);
    var p = o.sii || null, rc = o.remContable || {}, info = rc.info || {}, raw = rc.raw || {}, ra = (p && p.remanenteSii) || {};
    var cierre = ' Mientras tanto no se puede calcular ' + mP + '.';
    var siiDelMes = !ra.periodo || !ant || perSin(ra.periodo) === ant;
    if (p && p.remanente && num(p.remanente.valor) != null && siiDelMes)
      return { valor: num(p.remanente.valor), origen: 'sii', texto: p.remanente.texto, aviso: null, bloqueo: null };
    var antC = info.periodoAnterior ? perSin(info.periodoAnterior) : null;
    if ((rc.fuente === 'contable' || rc.fuente === 'manual') && num(rc.valor) != null && (!antC || !ant || antC === ant))
      return { valor: num(rc.valor), origen: rc.fuente, texto: (rc.fuente === 'manual' ? 'cód. 504 · ' : info.fuente === 'sii_f29' ? 'cód. 504 · ' + (info.aviso || 'F29 del SII') + ' · ' : 'cód. 504 desde Contable · ') + (info.detalle || ''),
               aviso: rc.fuente === 'manual' ? (info.aviso || 'Remanente ingresado a mano') : null, bloqueo: null };
    // Ingreso a mano (RPC registrar_remanente_anterior_manual): solo si el reporte del mes anterior NO existe en Gestoor (la base lo vuelve a exigir)
    var puedeManual = info.fuente === 'falta' || info.fuente === 'manual';
    var conectado = !!(p && p.conectado);
    var faltaUtm = (ra.falta_utm && ra.falta_utm.length) ? ra.falta_utm : (raw.motivo === 'SIN_UTM' ? (raw.falta_utm || []) : null);
    var tipo, msg;
    if (info.fuente === 'conflicto') { tipo = 'conflicto'; msg = '⚠️ ' + info.aviso + cierre; puedeManual = false; }
    else if (conectado && ra.fuente === 'f29_sin_montos') {
      tipo = 'cartapra_sin_montos'; msg = '⚠️ El F29 de ' + mA + ' ya está en el SII, pero Cartapra aún no trae sus montos: hay que esperar la próxima sincronización (10:00 o 17:00).' + cierre; }
    else if (faltaUtm) {
      tipo = 'falta_utm'; puedeManual = false;
      msg = '⚠️ Falta la UTM de ' + (faltaUtm.length ? faltaUtm.map(mesTxt).join(' y ') : 'los meses del reajuste') + ' en Gestoor: regístrala en Panel de control (UTM mensual) para reajustar el remanente de ' + mA + '.' + cierre; }
    else if (conectado) {
      tipo = 'sin_declarar'; msg = '⚠️ ' + cap(mA) + ' no está declarado en el SII (o falta su remanente). Primero hay que declararlo: su remanente arrastra el de meses anteriores.' + cierre; }
    else if (rc.fuente === 'error') { tipo = 'sin_lectura'; puedeManual = false; msg = '⚠️ No se pudo leer el remanente de ' + mA + ' desde Contable: recarga la página.' + cierre; }
    else { tipo = 'contable'; msg = '⚠️ ' + (info.aviso || ('Falta el remanente de ' + mA + '.')) + cierre; }
    return { valor: null, origen: null, texto: 'sin remanente de ' + mA, aviso: null,
             bloqueo: { tipo: tipo, mensaje: msg, puedeManual: puedeManual, detalleContable: info.aviso || null, mesAnterior: mA, mes: mP } };
  }
  // ── Remanente para el ESTIMADO del Pre-IVA (mes en curso) — 19-11 (Luciano): el Pre-IVA NO bloquea ──
  // El mes anterior normalmente aún no está declarado (el F29 vence el 20). Orden:
  //   (1) cód. 504 del F29 del mes anterior en el SII · (2) el remanente de Contable (reporte del mes anterior validado o a mano) ·
  //   (3) ESTIMADO: el remanente siguiente del mes anterior con la misma fórmula (calcularF29Completo del mes anterior con sus datos del SII
  //       y SU remanente, que a su vez sale del SII o de Contable — nunca se salta a dos meses atrás sin calcular el mes intermedio) ·
  //   (4) si ni eso se puede, «Falta» solo en esa línea (el total queda «estimado parcial»).
  // o: { periodo, sii (aPantalla del mes), remContable (del mes), anterior: { raw (sii_preiva_periodo del mes anterior), sii (aPantalla), remContable } }
  // → { valor, origen: 'sii'|'contable'|'manual'|'estimado'|null, texto, aviso, falta (bool), estimado (bool), mesAnterior, detalleEstimado }
  function remanenteEstimado(o) {
    o = o || {};
    var per = perSin(o.periodo), ant = perAnterior(per), mA = mesTxt(ant);
    var R = remanenteDelPeriodo({ periodo: per, sii: o.sii || null, remContable: o.remContable || {} });
    if (!R.bloqueo) return { valor: R.valor, origen: R.origen, texto: R.texto, aviso: R.aviso, falta: false, estimado: false, mesAnterior: mA };
    var A = o.anterior || {}, pa = A.sii || null, cob = (A.raw && A.raw.cobertura) || {};
    var motivo = null;
    if (pa && pa.conectado) {
      var deb = pa.debito != null ? pa.debito : (cob.rcv_ventas === 'completa' ? 0 : null);
      var cred = pa.credito != null ? pa.credito : (cob.rcv_compras === 'completa' ? 0 : null);
      // Remanente del mes anterior (el de dos meses atrás, pero SOLO como dato del cálculo del mes intermedio)
      var RA = remanenteDelPeriodo({ periodo: ant, sii: pa, remContable: A.remContable || {} });
      if (deb == null || cred == null) motivo = 'faltan las ventas o compras de ' + mA + ' en el SII';
      else if (RA.valor == null) motivo = 'tampoco se conoce el remanente de ' + mesTxt(perAnterior(ant));
      else {
        var FF = raiz.PreIvaF29 || (typeof require === 'function' ? require('./f29-formula.js') : null);
        var C = FF.calcularF29Completo({ debitoRegistrado: deb, creditoRegistrado: cred, remanente: RA.valor, tasa: 0, horizonte: { esMesActual: false } });
        return { valor: C.nuevoRemanente, origen: 'estimado', falta: false, estimado: true, mesAnterior: mA, aviso: null,
          texto: 'Remanente estimado (' + mA + ' aún sin validar/declarar): ' + fmt(RA.valor) + ' + crédito ' + fmt(cred) + ' − débito ' + fmt(deb) + ' de ' + mA + ' = ' + fmt(C.nuevoRemanente),
          detalleEstimado: { periodo: ant.replace(/^(\d{4})(\d{2})$/, '$1-$2'), debito: deb, credito: cred, remanente_anterior: RA.valor, origen_remanente_anterior: RA.origen, valor: C.nuevoRemanente } };
      }
    } else motivo = 'no hay datos del SII de ' + mA;
    return { valor: null, origen: null, falta: true, estimado: false, mesAnterior: mA, aviso: null,
      texto: 'Falta: remanente de ' + mA + ' (' + mA + ' aún sin validar/declarar y no se pudo estimar: ' + motivo + ')' };
  }
  // ── Remanente ingresado a mano (19-11) — COMPARTIDO: Pre-IVA hoy y el «Validar IVA» de Contable después ──
  // Usa la RPC EXISTENTE public.registrar_remanente_anterior_manual(p_reporte_id, p_cod77, p_motivo) (SECURITY DEFINER):
  // solo Master o analista contable asignado; exige que el reporte del mes anterior NO exista en Gestoor, UTM registrada y motivo ≥ 10.
  var MOTIVO_REM_MIN = 10, MOTIVO_REM_MAX = 500;
  // o: { cod77 (texto o número; se aceptan puntos), motivo } → { error } o { cod77: entero, motivo }
  function validarRemanenteManual(o) {
    o = o || {};
    var t = String(o.cod77 == null ? '' : o.cod77).replace(/[.\s$]/g, ''), m = String(o.motivo || '').trim();
    if (!/^\d+$/.test(t)) return { error: 'El código 77 debe ser un número entero en pesos, 0 o mayor (sin puntos ni decimales).' };
    if (m.length < MOTIVO_REM_MIN) return { error: 'Escribe el motivo: de dónde sale el monto (mínimo ' + MOTIVO_REM_MIN + ' caracteres).' };
    if (m.length > MOTIVO_REM_MAX) return { error: 'El motivo puede tener como máximo ' + MOTIVO_REM_MAX + ' caracteres.' };
    return { cod77: Number(t), motivo: m };
  }
  // Error de la base → texto para el analista (mesAnterior: 'octubre 2026')
  function mensajeErrorRemanenteManual(m, mesAnterior) {
    m = String(m || 'Error desconocido'); var ant = mesAnterior || 'el mes anterior';
    var mapa = [[/SOLO_ANALISTA_ASIGNADO/, 'Solo el analista contable asignado a este cliente o el Master pueden registrar el remanente.'],
      [/NO_AUTORIZADO/, 'Tu sesión no es válida o tu usuario está inactivo. Vuelve a iniciar sesión.'],
      [/MES_ANTERIOR_EXISTE/, 'El reporte de ' + ant + ' existe en Gestoor: el remanente se toma de ese reporte (si no está validado, valídalo primero en Reporte Contable).'],
      [/SIN_UTM/, m.replace(/^.*SIN_UTM:\s*/, 'Falta la UTM: ')],
      [/REPORTE_CERRADO/, 'El reporte de este mes ya está validado: el Master debe reabrirlo para cambiar el remanente.'],
      [/REPORTE_NO_EXISTE/, 'Aún no existe el reporte de este mes en Gestoor. Pide al Master registrar el remanente manual.'],
      [/MONTO_INVALIDO/, 'El código 77 debe ser un entero en pesos, 0 o mayor.'], [/MOTIVO_OBLIGATORIO/, 'El motivo debe tener al menos 10 caracteres.']];
    for (var i = 0; i < mapa.length; i++) { if (mapa[i][0].test(m)) return mapa[i][1]; }
    return m.replace(/<[^>]+>/g, '').substring(0, 300);
  }
  // Respuesta de public.remanente_anterior → remContable {valor, fuente, info, raw} (lo que recibe remanenteDelPeriodo)
  function remContableDesdeInfo(info, periodo) {
    var RA = raiz.RemanenteAnterior || (typeof require === 'function' ? require('../assets/remanente-anterior.js') : null);
    var R = RA.resolver({ periodo: perSin(periodo).replace(/^(\d{4})(\d{2})$/, '$1-$2'), lecturaOk: true, info: info || null });
    return R.bloquea ? { valor: null, fuente: 'sin', info: R, raw: info || null } : { valor: R.monto, fuente: R.fuente === 'manual' ? 'manual' : 'contable', info: R, raw: info || null };
  }
  // o: { clienteRut, periodo, reporteId (opcional: si no, se busca en reportes_mensuales), cod77, motivo }
  // → Promise { ok: true, info, remContable } | { ok: false, error }   (nunca lanza)
  function registrarRemanenteManual(o, sbFetchFn) {
    o = o || {};
    var f = sbFetchFn || (typeof sbFetch === 'function' ? sbFetch : null), per = perSin(o.periodo), perG = per.replace(/^(\d{4})(\d{2})$/, '$1-$2');
    var mA = mesTxt(perAnterior(per)), v = validarRemanenteManual(o);
    if (v.error) return Promise.resolve({ ok: false, error: v.error });
    if (!f) return Promise.resolve({ ok: false, error: 'Sin conexión con Gestoor.' });
    function json(r) { return r.text().then(function (t) { var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { /* */ } return { r: r, j: j }; }); }
    var pId = Number(o.reporteId) > 0 ? Promise.resolve(Number(o.reporteId))
      : f('reportes_mensuales?cliente_rut=eq.' + encodeURIComponent(o.clienteRut) + '&periodo=eq.' + perG + '&select=id').then(json).then(function (x) {
          if (!x.r.ok) throw new Error((x.j && x.j.message) || ('HTTP ' + x.r.status));
          var id = x.j && x.j[0] && x.j[0].id; if (!id) throw new Error('REPORTE_NO_EXISTE'); return Number(id); });
    return pId.then(function (id) {
      return f('rpc/registrar_remanente_anterior_manual', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_reporte_id: id, p_cod77: v.cod77, p_motivo: v.motivo }) }).then(json);
    }).then(function (x) {
      if (!x.r.ok || !x.j || x.j.ok !== true) throw new Error((x.j && (x.j.message || x.j.error)) || ('HTTP ' + x.r.status));
      return { ok: true, info: x.j.info || null, remContable: remContableDesdeInfo(x.j.info, per) };
    }).catch(function (e) { return { ok: false, error: mensajeErrorRemanenteManual(e && e.message, mA) }; });
  }
  // Registro que se guarda con el Pre-IVA (preiva_historial.fuente_montos / sii_datos_al / sii_detalle)
  function registro(p, fuente) {
    if (!p || (fuente !== 'sii' && fuente !== 'sii_editado')) return { fuente_montos: fuente || null, sii_datos_al: null, sii_detalle: null };
    var ra = p.remanenteSii || {};
    return { fuente_montos: fuente, sii_datos_al: p.datosAl || null, sii_detalle: {
      debito: p.debito, credito: p.credito, docs_ventas: p.docsVentas, docs_compras: p.docsCompras, compras_pendientes: p.pendientes.n,
      remanente: { cod77: num(ra.cod77), cod504: num(ra.cod504), folio: ra.folio || null, periodo: ra.periodo || null, utm_origen: num(ra.utm_origen), utm_destino: num(ra.utm_destino), fuente: ra.fuente || null } } };
  }
  function noInstalada(e) { return !!e && (e.status === 404 || e.code === 'PGRST202' || e.code === '42883'); }
  function leer(cliId, periodo, sbFetchFn) {
    var f = sbFetchFn || (typeof sbFetch === 'function' ? sbFetch : null);
    if (!f) return Promise.resolve({ estado: 'no_disponible' });
    return f('rpc/sii_preiva_periodo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ p_cliente_id: Number(cliId), p_periodo: String(periodo) }) })
      .then(function (res) {
        return res.text().then(function (t) {
          var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { /* */ }
          if (!res.ok) { var e = new Error((j && j.message) || ('HTTP ' + res.status)); e.status = res.status; e.code = j && j.code; throw e; }
          return { estado: 'ok', datos: j };
        });
      })
      .catch(function (e) { return { estado: noInstalada(e) ? 'no_disponible' : (e && e.code === '42501' ? 'sin_permiso' : 'error'), error: e && e.message }; });
  }
  var api = { aPantalla: aPantalla, remanenteDelPeriodo: remanenteDelPeriodo, remanenteEstimado: remanenteEstimado, validarRemanenteManual: validarRemanenteManual,
              mensajeErrorRemanenteManual: mensajeErrorRemanenteManual, remContableDesdeInfo: remContableDesdeInfo, registrarRemanenteManual: registrarRemanenteManual,
              registro: registro, leer: leer, fechaChile: fechaChile, TIPOS: TIPOS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  raiz.PreIvaSii = api;
})(typeof window !== 'undefined' ? window : globalThis);
