/* ============================================================
   pre-iva/sii-cartapra.js — Pre-IVA · compras y ventas del SII desde Cartapra (SII-PREIVA-F2b). SOLO LECTURA.
   Lee la RPC public.sii_preiva_periodo (gestoor-backend, rama feat/sii-preiva-f2b) y la traduce a los datos de entrada
   del Pre-IVA, igual que si se hubiera cargado el libro de MasContable: débito, crédito, neto, exento y desglose por tipo.
   El cálculo del F29 NO cambia (pre-iva/f29-formula.js).
   Reglas:
     · Crédito = solo compras REGISTRADAS en el SII. Pendientes/reclamadas no suman: se avisan.
     · Notas de crédito ya vienen restando desde la base.
     · Mes sin lectura del SII = sin dato (null), nunca 0.
     · Remanente anterior: NO se reemplaza. El Pre-IVA usa el cód. 504 (cód. 77 reajustado por UTM, art. 27) que entrega
       public.remanente_anterior. El cód. 77 del F29 del SII solo se COMPARA: si no calza con Contable, o Contable no lo
       tiene, se avisa. (Si el F29 anterior se leyó y no trae cód. 77, el SII lo tiene en $0: no lista códigos en cero.)
     · RPC no instalada (404 / PGRST202 / 42883) o sin permiso: el Pre-IVA sigue como hoy (libros / guardado).
   ============================================================ */
(function (raiz) {
  'use strict';
  var TIPOS = { 0: 'Boleta de honorarios', 33: 'Factura electrónica', 34: 'Factura exenta', 39: 'Boleta', 41: 'Boleta exenta',
                46: 'Factura de compra', 56: 'Nota de débito', 61: 'Nota de crédito', 110: 'Factura de exportación', 112: 'Nota de crédito de exportación' };
  function num(v) { if (v === null || v === undefined || v === '') return null; var x = Number(v); return isFinite(x) ? x : null; }
  function fmt(n) { return '$' + Math.round(Math.abs(Number(n) || 0)).toLocaleString('es-CL'); }
  function porTipo(pt) {
    var o = {}; Object.keys(pt || {}).forEach(function (k) { var x = pt[k] || {}; o[TIPOS[k] || ('Tipo ' + k)] = Number(x.n) || 0; }); return o;
  }

  /* r = respuesta de sii_preiva_periodo; remContable = {valor, fuente:'contable'|'manual'|'sin'|'error'} del Pre-IVA actual */
  function aPantalla(r, remContable) {
    r = r || {};
    var con = (r.conexion && r.conexion.estado) || 'sin_conexion';
    var v = r.ventas || null, c = (r.compras && r.compras.registro) || null, out = {
      conectado: con !== 'sin_conexion', estadoConexion: con, datosAl: r.datos_al || null,
      hayVentas: !!v, hayCompras: !!c,
      debito: v ? num(v.iva) : null, netoVentas: v ? num(v.neto) : null, exentoVentas: v ? num(v.exento) : null, docsVentas: v ? (Number(v.documentos) || 0) : null,
      credito: c ? num(c.iva) : null, netoCompras: c ? num(c.neto) : null, exentoCompras: c ? num(c.exento) : null, docsCompras: c ? (Number(c.documentos) || 0) : null,
      porTipoVentas: v ? porTipo(v.por_tipo) : {}, porTipoCompras: r.compras ? porTipo(r.compras.por_tipo) : {},
      pendientes: r.compras && r.compras.pendiente ? { n: Number(r.compras.pendiente.documentos) || 0, iva: num(r.compras.pendiente.iva) || 0 } : { n: 0, iva: 0 },
      f29: r.f29_periodo || null, remanenteSii: null, avisos: []
    };
    var ra = r.remanente_anterior || {}, rc = remContable || {}, c77 = rc.info ? num(rc.info.cod77) : null;
    if ((ra.fuente === 'sii_codigo_77' || ra.fuente === 'sii_sin_codigo_77') && num(ra.valor) != null) {
      var s77 = Math.round(num(ra.valor)), mes = ra.periodo ? ra.periodo.slice(4) + '/' + ra.periodo.slice(0, 4) : 'el mes anterior';
      out.remanenteSii = { cod77: s77, periodo: ra.periodo, folio: ra.folio };
      if (c77 != null && Math.round(c77) !== s77)
        out.avisos.push('Remanente: Contable tiene cód. 77 ' + fmt(c77) + ' y el F29 de ' + mes + ' en el SII dice ' + fmt(s77) + ' (folio ' + ra.folio + '). Revísalo en Contable.');
      else if (c77 == null && rc.fuente !== 'manual')
        out.avisos.push('El F29 de ' + mes + ' en el SII declara remanente (cód. 77) ' + fmt(s77) + '. Regístralo en Contable para que se reajuste por UTM (cód. 504).');
    }
    if (out.pendientes.n > 0) out.avisos.push(out.pendientes.n + ' factura(s) de compra pendiente(s) en el SII: no suman crédito hasta aceptarlas.');
    if ((r.avisos || []).indexOf('cobertura_incompleta') >= 0) out.avisos.push('El SII aún no entrega completo este mes en Cartapra: los montos pueden cambiar.');
    if (out.f29) out.avisos.push('Este mes ya tiene F29 presentado en el SII (folio ' + out.f29.folio + ').');
    return out;
  }
  // ¿Se aplican solos al abrir? Solo si no hay nada guardado ni escrito (no se pisa el trabajo del analista).
  function aplicarSolo(fila, debitoPantalla, creditoPantalla) {
    var g = fila && (Number(fila.debito_iva) > 0 || Number(fila.credito_iva) > 0);
    return !g && !(Number(debitoPantalla) > 0) && !(Number(creditoPantalla) > 0);
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
  var api = { aPantalla: aPantalla, aplicarSolo: aplicarSolo, leer: leer, TIPOS: TIPOS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  raiz.PreIvaSii = api;
})(typeof window !== 'undefined' ? window : globalThis);
