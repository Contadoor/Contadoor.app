// MiRenta · Apertura tributaria (E0C-B) · reglas de la pantalla, SIN acceso a red ni al DOM (se prueban aparte).
// La base (renta_apertura_declarar / renta_apertura_verificar) es la autoridad: esta capa solo ayuda al analista
// a construir algo que la base aceptará, con la semántica Delta R2:
//   · Leído desde F22 (DECLARED_F22): monto y código = los de la propuesta atestada; no se editan.
//   · Requiere revisión (REVIEW): conserva monto y código del F22; la nota es libre.
//   · Pendiente (PENDING): monto NULL + nota obligatoria; se conserva el código F22 de origen (trazabilidad).
//   · Respaldado por otra evidencia (REGISTER / CERTIFICATE / DJ / MANUAL_OTHER): otro monto, con evidencia obligatoria.
//   · NOT_APPLICABLE no se ofrece sobre un monto que el F22 propuso.
(function (raiz) {
  'use strict';
  var CLAVES = [
    ['opening.previous_year_tax_loss', 'Pérdida tributaria de arrastre'],
    ['opening.cpts', 'CPTS positivo'],
    ['opening.cpts_negative', 'CPTS negativo'],
    ['opening.rai', 'RAI'],
    ['opening.rex', 'REX'],
    ['opening.sac.no_sujeto_restitucion.sin_devolucion', 'SAC no sujeto a restitución · sin devolución'],
    ['opening.sac.no_sujeto_restitucion.con_devolucion', 'SAC no sujeto a restitución · con devolución'],
    ['opening.sac.sujeto_restitucion.sin_devolucion', 'SAC sujeto a restitución · sin devolución'],
    ['opening.sac.sujeto_restitucion.con_devolucion', 'SAC sujeto a restitución · con devolución'],
    ['opening.sac.ipe', 'SAC IPE'],
    ['opening.capital_aportado_historico', 'Capital aportado histórico'],
    ['opening.ppm_to_recover', 'PPM por recuperar'],
    ['opening.deferred_income_pending', 'Ingreso diferido pendiente']
  ];
  var ETIQUETA = {}; CLAVES.forEach(function (c) { ETIQUETA[c[0]] = c[1]; });
  var PROCEDENCIAS_OTRAS = [
    ['REGISTER', 'Registro (RAI / SAC / REX)'],
    ['CERTIFICATE', 'Certificado'],
    ['DJ', 'Declaración jurada'],
    ['MANUAL_OTHER', 'Otro respaldo']
  ];
  var NOMBRE_PROC = { DECLARED_F22: 'F22', REGISTER: 'Registro', CERTIFICATE: 'Certificado', DJ: 'Declaración jurada', MANUAL_OTHER: 'Otro respaldo' };
  var NOMBRE_ESTADO = { OK: 'Leído desde F22', REVIEW: 'Requiere revisión', PENDING: 'Pendiente', NOT_APPLICABLE: 'No aplica' };

  // Familia de cada saldo: da el color propio (mismo código de color que los registros del diseño aprobado R2.2).
  function familia(clave) {
    var k = String(clave || '');
    if (k === 'opening.previous_year_tax_loss') return { sigla: 'PÉRD', clase: 'acc-PERD' };
    if (k.indexOf('opening.cpts') === 0) return { sigla: 'CPTS', clase: 'acc-CPTS' };
    if (k === 'opening.rai') return { sigla: 'RAI', clase: 'acc-RAI' };
    if (k === 'opening.rex') return { sigla: 'REX', clase: 'acc-REX' };
    if (k.indexOf('opening.sac.') === 0) return { sigla: 'SAC', clase: 'acc-SAC' };
    if (k === 'opening.capital_aportado_historico') return { sigla: 'CAP', clase: 'acc-CAP' };
    if (k === 'opening.ppm_to_recover') return { sigla: 'PPM', clase: 'acc-PPM' };
    return { sigla: 'DIF', clase: 'acc-DIF' };
  }

  function esMonto(v) { return typeof v === 'number' && isFinite(v) && v >= 0; }
  function limpio(s) { return typeof s === 'string' ? s.trim() : ''; }

  // Filas a partir de la propuesta atestada (resultado.propuesta de la lectura). Una por clave, en orden fijo.
  function filasDesdePropuesta(propuesta) {
    var porClave = {};
    (propuesta || []).forEach(function (p) { if (p && p.item_key) porClave[p.item_key] = p; });
    return CLAVES.map(function (c) {
      var p = porClave[c[0]] || null;
      var prop = p ? { estado: p.estado, monto: p.monto === undefined ? null : p.monto, codigo: p.f22_codigo_ref || null,
                       evidencia: p.evidencia_fuente_id || null, derivacion: p.derivacion || null, nota: p.nota || '' } : null;
      var decision;
      if (!prop) decision = { tipo: 'FALTA' };
      else if (prop.estado === 'OK') decision = { tipo: 'F22' };
      // la nota del lector es solo una pista: la nota obligatoria la escribe el analista
      else if (prop.estado === 'NOT_APPLICABLE') decision = { tipo: 'NO_APLICA', nota: '' };
      else decision = { tipo: 'PENDIENTE', nota: '' };
      return { clave: c[0], concepto: c[1], prop: prop, decision: decision };
    });
  }

  // Qué opciones puede ofrecer la pantalla para una fila.
  function opciones(fila) {
    var p = fila.prop; if (!p) return [];
    if (p.estado === 'OK') return ['F22', 'REVISAR', 'PENDIENTE', 'OTRA'];
    if (p.estado === 'NOT_APPLICABLE') return ['NO_APLICA', 'PENDIENTE', 'OTRA'];
    return ['PENDIENTE', 'OTRA'];   // PENDING del parser (PPM, ingreso diferido): nunca monto con DECLARED_F22
  }

  // Aplica una decisión. Devuelve { fila, error }. Nunca deja un monto editado bajo DECLARED_F22.
  function decidir(fila, d) {
    var ops = opciones(fila);
    if (!d || ops.indexOf(d.tipo) < 0) return { fila: fila, error: 'Opción no disponible para este saldo.' };
    var nueva = { clave: fila.clave, concepto: fila.concepto, prop: fila.prop, decision: null };
    if (d.tipo === 'F22') nueva.decision = { tipo: 'F22' };
    else if (d.tipo === 'REVISAR') nueva.decision = { tipo: 'REVISAR', nota: limpio(d.nota) };
    else if (d.tipo === 'PENDIENTE') nueva.decision = { tipo: 'PENDIENTE', nota: limpio(d.nota) };
    else if (d.tipo === 'NO_APLICA') nueva.decision = { tipo: 'NO_APLICA', nota: limpio(d.nota) };
    else {   // OTRA: otro valor → obliga a cambiar la procedencia y a indicar evidencia
      nueva.decision = { tipo: 'OTRA', provenance: d.provenance || null, evidencia_fuente_id: d.evidencia_fuente_id || null,
                         monto: d.monto === '' || d.monto === undefined ? null : d.monto, nota: limpio(d.nota), estado: d.estado === 'REVIEW' ? 'REVIEW' : 'OK' };
    }
    return { fila: nueva, error: null };
  }

  // Errores que impedirían declarar esta fila (la base igual revalida todo).
  function erroresFila(fila, fuenteF22Id) {
    var d = fila.decision, p = fila.prop, e = [];
    if (!p || d.tipo === 'FALTA') return ['La lectura no trae este saldo.'];
    if (d.tipo === 'F22' || d.tipo === 'REVISAR') {
      if (p.estado !== 'OK' || !esMonto(p.monto)) e.push('El F22 no determinó este saldo: no puede quedar como leído desde F22.');
    }
    if ((d.tipo === 'REVISAR' || d.tipo === 'PENDIENTE' || d.tipo === 'NO_APLICA') && !limpio(d.nota)) e.push('Escribe una nota.');
    if (d.tipo === 'NO_APLICA' && p.estado !== 'NOT_APPLICABLE') e.push('“No aplica” solo si el F22 lo indicó.');
    if (d.tipo === 'OTRA') {
      if (!d.provenance || d.provenance === 'DECLARED_F22' || !NOMBRE_PROC[d.provenance]) e.push('Elige de dónde sale el nuevo valor (registro, certificado, DJ u otro).');
      if (!d.evidencia_fuente_id) e.push('Adjunta o elige el respaldo del nuevo valor.');
      else if (d.evidencia_fuente_id === fuenteF22Id) e.push('El respaldo debe ser distinto del F22.');
      if (!esMonto(typeof d.monto === 'string' ? Number(d.monto) : d.monto)) e.push('Ingresa un monto válido (0 o mayor).');
    }
    return e;
  }

  // Item exacto para renta_apertura_declarar.
  function itemDeFila(fila) {
    var d = fila.decision, p = fila.prop || {};
    if (d.tipo === 'F22') return { item_key: fila.clave, estado: 'OK', provenance: 'DECLARED_F22', monto: p.monto, f22_codigo_ref: p.codigo };
    if (d.tipo === 'REVISAR') return { item_key: fila.clave, estado: 'REVIEW', provenance: 'DECLARED_F22', monto: p.monto, f22_codigo_ref: p.codigo, nota: limpio(d.nota) };
    if (d.tipo === 'PENDIENTE') return { item_key: fila.clave, estado: 'PENDING', provenance: 'DECLARED_F22', monto: null, f22_codigo_ref: p.codigo || null, nota: limpio(d.nota) };
    if (d.tipo === 'NO_APLICA') return { item_key: fila.clave, estado: 'NOT_APPLICABLE', provenance: 'DECLARED_F22', monto: null, f22_codigo_ref: p.codigo || null, nota: limpio(d.nota) };
    var m = typeof d.monto === 'string' ? Number(d.monto) : d.monto;
    var it = { item_key: fila.clave, estado: d.estado || 'OK', provenance: d.provenance, monto: m, evidencia_fuente_id: d.evidencia_fuente_id, f22_codigo_ref: null };
    if (limpio(d.nota)) it.nota = limpio(d.nota);
    return it;
  }

  // ¿Se puede declarar? Requiere lectura PROPUESTA, 0 bloqueos y las 13 filas válidas.
  function evaluarDeclaracion(lectura, filas, motivo) {
    var motivos = [];
    if (!lectura) motivos.push('Primero lee un F22.');
    else {
      if (lectura.estado === 'BLOQUEADO') motivos.push('El F22 tiene bloqueos: la apertura no puede declararse todavía.');
      else if (lectura.estado !== 'PROPUESTA') motivos.push('La lectura del F22 no está lista (' + lectura.estado + ').');
      if (lectura.blocking_count > 0 && lectura.estado !== 'BLOQUEADO') motivos.push('El F22 tiene bloqueos.');
    }
    if (!filas || filas.length !== 13) motivos.push('Faltan saldos.');
    var conError = (filas || []).filter(function (f) { return erroresFila(f, lectura && lectura.fuente_id).length; });
    if (conError.length) motivos.push(conError.length === 1 ? 'Revisa el saldo “' + conError[0].concepto + '”.' : 'Revisa ' + conError.length + ' saldos marcados.');
    if (!limpio(motivo)) motivos.push('Escribe el motivo de la declaración.');
    return { ok: motivos.length === 0, motivos: motivos };
  }

  function payloadDeclarar(caso, lectura, filas, motivo) {
    return { p_caso_id: caso.id, p_fuente_f22_id: lectura.fuente_id, p_anio_tributario_origen: caso.anio_tributario - 1,
             p_items: filas.map(itemDeFila), p_motivo: limpio(motivo), p_lectura_id: lectura.id };
  }

  // Verificación (solo Master). La RPC es la autoridad; aquí solo se explica por qué no se puede.
  function evaluarVerificacion(vigente, yo) {
    if (!yo || !yo.es_master) return { mostrar: false, ok: false, motivo: null };
    var w = vigente && vigente.working;
    if (!w) return { mostrar: true, ok: false, motivo: 'No hay una apertura en revisión para verificar.' };
    var abiertos = (w.items || []).filter(function (i) { return i.estado === 'PENDING' || i.estado === 'REVIEW'; }).length;
    if (Number(w.declarado_por) === Number(yo.id))
      return { mostrar: true, ok: false, doble_control: true, motivo: 'Doble control: tú declaraste esta versión, así que otra persona Master debe verificarla.' };
    if (abiertos) return { mostrar: true, ok: false, motivo: 'Quedan ' + abiertos + (abiertos === 1 ? ' saldo pendiente o por revisar.' : ' saldos pendientes o por revisar.') + ' Se resuelven con una nueva versión.' };
    return { mostrar: true, ok: true, motivo: null };
  }

  // Efectiva (VERIFIED) y en revisión (DECLARED) se muestran por separado; la VERIFIED no se reemplaza hasta verificar la nueva.
  function vistaVersiones(vigente) {
    var v = vigente || {};
    var titulo = { OPENING_MISSING: 'Sin apertura', OPENING_DECLARED_NOT_FULLY_RECONSTRUCTED: 'Apertura declarada (en revisión)',
                   OPENING_VERIFIED: 'Apertura verificada', OPENING_VERIFIED_WITH_PENDING_REVISION: 'Apertura verificada · nueva versión en revisión' }[v.estado] || 'Sin apertura';
    return { estado: v.estado || 'OPENING_MISSING', titulo: titulo, efectiva: v.effective || null, enRevision: v.working || null };
  }

  // F22 vigente del caso (E0C-B R1: como máximo uno REGISTRADA). Un F22 nuevo debe reemplazar exactamente a este (o NULL si no hay).
  function f22Vigente(fuentes) {
    var v = (fuentes || []).filter(function (f) { return f.tipo_fuente === 'F22_ANTERIOR' && f.estado === 'REGISTRADA'; });
    return v.length ? v[v.length - 1] : null;
  }
  function reemplazoF22(fuentes) { var v = f22Vigente(fuentes); return v ? v.id : null; }
  function f22Historicos(fuentes) {
    return (fuentes || []).filter(function (f) { return f.tipo_fuente === 'F22_ANTERIOR' && f.estado !== 'REGISTRADA'; }).reverse();
  }

  // Mensajes de la base → texto para el analista (sin perder la edición).
  function mensajeError(msg) {
    var m = String(msg || '');
    var mapa = [
      [/F22_VIGENTE_EXISTE/, 'El F22 vigente del caso cambió (otra persona pudo haberlo reemplazado). Recarga la página y vuelve a intentarlo.'],
      [/LECTURA_F22_DATO_NO_COINCIDE/, 'Un saldo marcado como “leído desde F22” no coincide con lo que se leyó del F22. Si el valor correcto es otro, usa “Usar otro valor” con su respaldo.'],
      [/LECTURA_F22_INVALIDA/, 'La lectura del F22 ya no es válida para declarar (otro documento, bloqueada o alterada). Vuelve a leer el F22.'],
      [/CPTS_INCOHERENTE/, 'CPTS positivo y negativo no pueden tener monto a la vez.'],
      [/DOBLE_CONTROL/, 'Doble control: quien declaró una versión no puede verificarla.'],
      [/PENDING o REVIEW/, 'No se puede verificar con saldos pendientes o por revisar.'],
      [/HUELLA_ALTERADA/, 'Los datos de la apertura no coinciden con su huella: no se puede verificar.'],
      [/FUENTE_INVALIDA|EVIDENCIA_INVALIDA/, 'Un documento de respaldo ya no es válido (anulado o con huella distinta).'],
      [/no admite declarar|no admite verificar/, 'El caso no está abierto para cambios.'],
      [/42501|No autorizado|Sin acceso/i, 'No tienes permiso para esta acción en este caso.']
    ];
    for (var i = 0; i < mapa.length; i++) if (mapa[i][0].test(m)) return mapa[i][1];
    return 'No se pudo completar la acción. ' + m.replace(/^[A-Z_]+:\s*/, '').slice(0, 200);
  }

  function formatoMonto(v) {
    if (v === null || v === undefined || v === '') return null;
    var n = Number(v); if (!isFinite(n)) return null;
    return '$' + Math.round(n).toLocaleString('es-CL');
  }

  var api = { CLAVES: CLAVES, familia: familia, ETIQUETA: ETIQUETA, PROCEDENCIAS_OTRAS: PROCEDENCIAS_OTRAS, NOMBRE_PROC: NOMBRE_PROC, NOMBRE_ESTADO: NOMBRE_ESTADO,
              filasDesdePropuesta: filasDesdePropuesta, opciones: opciones, decidir: decidir, erroresFila: erroresFila, itemDeFila: itemDeFila,
              evaluarDeclaracion: evaluarDeclaracion, payloadDeclarar: payloadDeclarar, evaluarVerificacion: evaluarVerificacion,
              vistaVersiones: vistaVersiones, mensajeError: mensajeError, f22Vigente: f22Vigente, reemplazoF22: reemplazoF22, f22Historicos: f22Historicos, formatoMonto: formatoMonto };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  raiz.AperturaLogica = api;
})(typeof window !== 'undefined' ? window : globalThis);
