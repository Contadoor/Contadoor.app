/* ============================================================
   pre-iva/preiva-vivo.js — Pre-IVA «siempre vivo» (27-11, Luciano). SOLO LECTURA, sin botones.
   Lee las RPC de gestoor-backend (rama sql/preiva-vivo, migración 202611271800_preiva_vivo):
     · public.preiva_cartera_viva(p_periodo)              → cartera: cálculo vivo de cada empresa desde Cartapra (RCV del SII)
     · public.preiva_historial_vivo(p_cliente_id, p_periodo) → 6 meses + el período: real (reporte cerrado / F29 del SII) o estimado
   La estimación es la MISMA de MiContadoor (mc.mis_impuestos): débito RCV − crédito de compras registradas − remanente (cód. 504
   del F29 anterior) y PPM = (neto + exento) × tasa del último F29. Es «a la fecha» y va siempre rotulada «Estimado».
   Regla de Luciano (27-11): el Pre-IVA del mes en curso no requiere revisión del asesor.
   RPC no instalada (404 / PGRST202 / 42883): estado 'no_disponible' → cada pantalla vuelve a lo de antes.
   Sin remanente conocido → IVA y F29 null (nunca $0), con el motivo en texto.
   ============================================================ */
(function (raiz) {
  'use strict';
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  function num(v) { if (v === null || v === undefined || v === '') return null; var x = Number(v); return isFinite(x) ? x : null; }
  function perSin(p) { return String(p || '').replace('-', ''); }
  function perCon(p) { p = perSin(p); return /^\d{6}$/.test(p) ? p.slice(0, 4) + '-' + p.slice(4) : p; }
  function perAnterior(p) { p = perSin(p); if (!/^\d{6}$/.test(p)) return null; var y = +p.slice(0, 4), m = +p.slice(4) - 1; if (m < 1) { m = 12; y--; } return y + (m < 10 ? '0' : '') + m; }
  function mesTxt(p) { p = perSin(p); return /^\d{6}$/.test(p) ? MESES[+p.slice(4) - 1] + ' ' + p.slice(0, 4) : 'el mes anterior'; }
  function suma(a, b) { a = num(a); b = num(b); return a == null && b == null ? null : (a || 0) + (b || 0); }
  // Fecha y hora de Chile, siempre (el navegador puede estar en otra zona). 'dd-mm-aaaa · hh:mm'
  function fechaChile(iso) {
    if (!iso) return null; var d = new Date(iso); if (isNaN(d)) return null;
    var p = {}; new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(d).forEach(function (x) { p[x.type] = x.value; });
    return p.day + '-' + p.month + '-' + p.year + ' · ' + p.hour + ':' + p.minute;
  }
  // Motivo del remanente que falta (sii._preiva_calcular · remanente_anterior.fuente / falta_utm)
  function motivoRemanente(motivo, periodo) {
    var mA = mesTxt(perAnterior(periodo));
    if (motivo === 'sin_f29') return 'falta el F29 de ' + mA + ' en el SII';
    if (motivo === 'f29_sin_montos') return 'Cartapra aún no trae los montos del F29 de ' + mA;
    if (motivo === 'falta_utm') return 'falta la UTM en Gestoor (Panel de control) para reajustar el remanente de ' + mA;
    return 'sin remanente de ' + mA;
  }

  /* ── Cartera: una empresa de preiva_cartera_viva → lo que pinta cartera.js ── */
  function filaCartera(e, periodo) {
    e = e || {};
    var con = e.conexion || 'sin_conexion', conectado = con === 'conectada' || con === 'carga_inicial';
    var x = e.estimacion || null, f29d = e.f29_declarado || null;
    var o = { conectado: conectado, conexion: con, datosAl: e.datos_al || null, datosAlTxt: fechaChile(e.datos_al), sincronizadoEn: e.sincronizado_en || null,
      sincronizadoTxt: fechaChile(e.sincronizado_en), coberturaCompleta: e.cobertura_completa !== false, cargaInicial: e.carga_inicial_lista !== false,
      hayDatos: false, iva: null, ivaPagar: null, ppm: null, total: null, debito: null, credito: null, remanente: null, remanenteFalta: null,
      ppmTasa: null, ppmTasaFuente: null, sinTasa: false, docsVentas: null, docsCompras: null, exenta: false,
      pendientes: { n: 0, iva: 0 }, reclamadas: { n: 0, iva: 0 }, f29Declarado: null };
    if (!conectado || !x) return o;
    o.exenta = x.exenta === true;
    o.debito = num(x.debito); o.credito = num(x.credito);
    o.hayDatos = o.debito != null || o.credito != null;
    o.docsVentas = num(x.ventas_documentos); o.docsCompras = num(x.compras_documentos);
    o.remanente = x.remanente ? num(x.remanente.monto) : null;
    o.remanenteFalta = o.hayDatos && o.remanente == null ? motivoRemanente(x.remanente_motivo, periodo) : null;
    o.iva = num(x.iva_determinado); o.ivaPagar = num(x.iva_pagar);
    o.ppm = num(x.ppm); o.ppmTasa = num(x.ppm_tasa); o.ppmTasaFuente = x.ppm_tasa_fuente || null;
    o.sinTasa = o.hayDatos && o.ppmTasa == null;
    o.total = num(x.total);
    if (x.compras_pendientes) o.pendientes = { n: num(x.compras_pendientes.documentos) || 0, iva: num(x.compras_pendientes.iva) || 0 };
    if (e.compras_reclamadas) o.reclamadas = { n: num(e.compras_reclamadas.documentos) || 0, iva: num(e.compras_reclamadas.iva) || 0 };
    if (f29d && f29d.folio) o.f29Declarado = { folio: f29d.folio, montos: f29d.montos === true, total: num(f29d.total_a_pagar), ppm: num(f29d.ppm) };
    return o;
  }
  // preiva_cartera_viva → { porId: {cliente_id: filaCartera}, periodo, generadoEn }
  function indexarCartera(r) {
    r = r || {}; var m = {};
    (r.empresas || []).forEach(function (e) { if (e && e.cliente_id != null) m[e.cliente_id] = filaCartera(e, r.periodo); });
    return { porId: m, periodo: r.periodo || null, generadoEn: r.generado_en || null, mesEnCurso: r.mes_en_curso === true };
  }

  /* ── Historial: preiva_historial_vivo → filas en el formato de operativa-datos.js (historial de 6 meses) ── */
  var FUENTES = { reporte: 'Reporte cerrado', f29_sii: 'F29 del SII', estimado: 'Estimado (Cartapra)' };
  function filaHistorial(m) {
    m = m || {};
    var rep = m.reporte || null, f = m.f29_declarado || null, est = m.estimado || {};
    var ventas = suma(m.ventas_neto, m.ventas_exento), compras = suma(m.compras_neto, m.compras_exento);
    var vacio = { iva: false, debito: false, credito: false, ppm: false, ventas: false };
    var o = { periodo: perCon(m.periodo), fuente: FUENTES[m.fuente] || null, fuenteCodigo: m.fuente || null, real: m.real === true, vivo: true,
      iva: num(m.iva_pagar), total: num(m.total), ppm: null, debito: num(m.debito), credito: num(m.credito), ventas: ventas, compras: compras,
      tasa: f ? num(f.tasa_ppm) : null, registradoAt: (rep && rep.cerrado_at) || m.datos_al || null, comparable: vacio, motivo: null,
      coberturaCompleta: m.cobertura_completa };
    if (m.fuente === 'reporte') {
      o.ppm = num(rep.ppm); if (num(rep.debito) != null) o.debito = num(rep.debito); if (num(rep.credito) != null) o.credito = num(rep.credito);
    } else if (m.fuente === 'f29_sii') {
      o.ppm = num(f.ppm); if (num(f.debito) != null) o.debito = num(f.debito); if (num(f.credito) != null) o.credito = num(f.credito);
    } else if (m.fuente === 'estimado') {
      o.ppm = num(est.ppm); if (o.tasa == null) o.tasa = num(est.ppm_tasa);
    }
    if (o.real) {
      o.comparable = { iva: o.iva != null, debito: o.debito != null && o.debito > 0, credito: o.credito != null && o.credito > 0,
                       ppm: o.ppm != null, ventas: o.ventas != null && o.ventas > 0 };
      o.motivo = m.fuente === 'reporte' ? 'Reporte cerrado por Contadoor' : 'F29 declarado en el SII' + (f && f.folio ? ' (folio ' + f.folio + ')' : '');
    } else if (m.fuente === 'estimado') {
      o.motivo = 'Estimado con el RCV del SII (sin F29 declarado ni reporte cerrado): se muestra, no entra en promedios' +
        (o.iva == null && est.remanente_motivo ? ' · ' + motivoRemanente(est.remanente_motivo, m.periodo) : '');
    } else o.motivo = 'Sin datos del SII para este mes';
    return o;
  }
  // → { filas (meses ANTERIORES al período, en orden), actual (el período), meses (todos), conexion }
  function historialAFilas(r, periodo) {
    r = r || {}; var per = perCon(periodo || r.periodo);
    var todas = (r.meses || []).map(filaHistorial);
    return { filas: todas.filter(function (x) { return x.periodo !== per; }), actual: todas.filter(function (x) { return x.periodo === per; })[0] || null,
             meses: todas, conexion: r.conexion || null, error: null, vivo: true };
  }
  function hayAlgo(h) { return !!h && (h.meses || []).some(function (m) { return m.fuente; }); }

  /* ── Lectura (nunca lanza) ── */
  function noInstalada(e) { return !!e && (e.status === 404 || e.code === 'PGRST202' || e.code === '42883'); }
  function rpc(fn, args, sbFetchFn) {
    var f = sbFetchFn || (typeof sbFetch === 'function' ? sbFetch : null);
    if (!f) return Promise.resolve({ estado: 'no_disponible' });
    return Promise.resolve().then(function () {
      return f('rpc/' + fn, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(args) });
    }).then(function (res) {
      return res.text().then(function (t) {
        var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { /* */ }
        if (!res.ok) { var e = new Error((j && j.message) || ('HTTP ' + res.status)); e.status = res.status; e.code = j && j.code; throw e; }
        if (!j || j.ok !== true) { var e2 = new Error('respuesta inesperada'); throw e2; }
        return { estado: 'ok', datos: j };
      });
    }).catch(function (e) {
      return { estado: noInstalada(e) ? 'no_disponible' : (e && (e.code === '42501' || e.status === 403) ? 'sin_permiso' : 'error'), error: e && e.message, code: e && e.code };
    });
  }
  function leerCartera(periodo, sbFetchFn) { return rpc('preiva_cartera_viva', { p_periodo: perSin(periodo) }, sbFetchFn); }
  function leerHistorial(clienteId, periodo, sbFetchFn) { return rpc('preiva_historial_vivo', { p_cliente_id: Number(clienteId), p_periodo: perSin(periodo) }, sbFetchFn); }

  var api = { filaCartera: filaCartera, indexarCartera: indexarCartera, filaHistorial: filaHistorial, historialAFilas: historialAFilas, hayAlgo: hayAlgo,
              motivoRemanente: motivoRemanente, fechaChile: fechaChile, leerCartera: leerCartera, leerHistorial: leerHistorial, noInstalada: noInstalada, FUENTES: FUENTES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  raiz.PreIvaVivo = api;
})(typeof window !== 'undefined' ? window : globalThis);
