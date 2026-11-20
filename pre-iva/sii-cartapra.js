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
      return { valor: num(rc.valor), origen: rc.fuente, texto: (rc.fuente === 'manual' ? 'cód. 504 · ' : 'cód. 504 desde Contable · ') + (info.detalle || ''),
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
  var api = { aPantalla: aPantalla, remanenteDelPeriodo: remanenteDelPeriodo, registro: registro, leer: leer, fechaChile: fechaChile, TIPOS: TIPOS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  raiz.PreIvaSii = api;
})(typeof window !== 'undefined' ? window : globalThis);
