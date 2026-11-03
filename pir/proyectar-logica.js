// MiRenta · Asistente "Proyectar" · reglas de la pantalla, SIN acceso a red ni al DOM (se prueban aparte con node).
// La base es la autoridad: esta capa solo traduce lo que ya responden las RPC instaladas (renta_e1_entrada, renta_apertura_vigente,
// renta_fuentes, renta_corridas, renta_f22_lecturas, renta_mapeo_snapshots, renta_motor_corridas) a 5 pasos con estado:
//   pendiente · en curso · listo · revisar (se puede seguir) · problema (bloquea el paso siguiente).
// Nunca calcula impuestos ni decide por el analista.
(function (raiz) {
  'use strict';

  var AC_DEFECTO = 2026;

  // Bloqueos y avisos de renta_e1_entrada → texto simple. Los que tienen ":" llevan detalle (cuenta, regla, ítem).
  var BLOQUEOS = {
    SIN_DIARIO: 'Falta el Libro Diario del año comercial.',
    DIARIO_AC_NO_COINCIDE: 'El Libro Diario cargado no es del año comercial del caso.',
    SIN_BALANCE_AC: 'Falta el Balance del año comercial.',
    INVARIANTE_VIOLADO: 'Hay dos archivos vigentes del mismo tipo: hay que reemplazar o anular uno.',
    SIN_SNAPSHOT_MAPEO: 'Falta calcular el mapeo de cuentas.',
    SNAPSHOT_MAPEO_DESACTUALIZADO: 'El mapeo de cuentas es de archivos anteriores: hay que recalcularlo.',
    MAPEO_CON_UNKNOWN: 'Hay cuentas sin clasificar en el mapeo.',
    CONCILIACION_DIARIO_BALANCE_PENDIENTE: 'Falta conciliar el Libro Diario con el Balance.',
    CONCILIACION_DIARIO_BALANCE_CON_DIFERENCIAS: 'El Libro Diario y el Balance no cuadran.',
    CONCILIACION_AC1_PENDIENTE: 'Falta conciliar la apertura con el cierre del año anterior.',
    CONCILIACION_AC1_SIN_APERTURA_COMPARABLE: 'El Diario no trae un asiento de apertura comparable con el cierre anterior.',
    CONCILIACION_AC1_NO_CUADRA: 'La apertura del Diario no cuadra con el Balance del año anterior.',
    CONCILIACION_AC1_DIFERENCIA: 'Diferencia de apertura en la cuenta',
    APERTURA_AMBIGUA: 'El Diario tiene más de un asiento que parece de apertura.',
    SALDO_INICIAL_SIN_FUENTE: 'Cuenta sin saldo inicial respaldado',
    REGLA_NO_ACTIVA: 'Falta certificar la regla tributaria',
    REGLA_AMBIGUA: 'Hay dos reglas activas para',
    APERTURA_TRIBUTARIA_AUSENTE: 'Falta la apertura tributaria (saldos RAI, SAC y CPTS del F22 anterior).',
    APERTURA_TRIBUTARIA_ITEM: 'Saldo de apertura tributaria pendiente o por revisar',
    SALDOS_INICIALES_SIN_CIERRE_AC1: 'Saldos iniciales aceptados sin el Balance del año anterior para conciliar.',
    CONCILIACION_AC1_CON_DIFERENCIAS_EN_OTRAS_CUENTAS: 'La conciliación con el año anterior tiene diferencias en otras cuentas.',
    APERTURA_CONTABLE_NO_CONFIRMADA: 'El asiento de apertura está detectado, pero nadie lo ha confirmado.',
    SALDOS_INICIALES_SIN_ACEPTAR: 'Los saldos iniciales del asiento de apertura no están aceptados.',
    SALDOS_INICIALES_REVOCADA: 'La aceptación de los saldos iniciales fue revocada.',
    SALDOS_INICIALES_CADUCADA: 'Los saldos iniciales cambiaron desde que se aceptaron.',
    SALDOS_INICIALES_DESCUADRADA: 'El asiento de apertura no cuadra.'
  };
  function textoBloqueo(cod) {
    var s = String(cod || ''), i = s.indexOf(':'), base = i < 0 ? s : s.slice(0, i), det = i < 0 ? '' : s.slice(i + 1);
    var t = BLOQUEOS[base];
    if (!t) return s;
    if (!det) return t;
    if (base === 'CONCILIACION_AC1_DIFERENCIA') det = det.split(':')[0];
    if (base === 'APERTURA_TRIBUTARIA_ITEM') { var p = det.split(':'); det = (p[0] || '').replace(/^opening\./, '') + (p[1] ? ' (' + (p[1] === 'PENDING' ? 'pendiente' : 'por revisar') + ')' : ''); }
    return t + ' ' + det + '.';
  }

  // Tipos de archivo del paso 3 (exportes de Masconta). periodo: 0 = año comercial del caso, -1 = año anterior.
  var ARCHIVOS = [
    { clave: 'DIARIO', tipo: 'LIBRO_DIARIO', periodo: 0, titulo: 'Libro Diario', obligatorio: true, ayuda: 'Masconta → Informes → Libro Diario del año, exportado a Excel.' },
    { clave: 'BALANCE', tipo: 'BALANCE', periodo: 0, titulo: 'Balance 8 columnas', obligatorio: true, ayuda: 'Masconta → Balance 8 columnas del año, al último mes cerrado.' },
    { clave: 'BALANCE_ANT', tipo: 'BALANCE', periodo: -1, titulo: 'Balance 8 columnas del año anterior', obligatorio: false, ayuda: 'Cierre del año anterior: sirve para conciliar la apertura (recomendado).' },
    { clave: 'PLAN', tipo: 'PLAN_CUENTAS', periodo: null, titulo: 'Plan de cuentas', obligatorio: false, ayuda: 'Opcional: mejora la clasificación automática de las cuentas.' }
  ];

  function periodoDeFuente(f, corridas) {
    var m = f && f.metadatos && f.metadatos.periodo;
    if (/^[0-9]{4}$/.test(String(m || ''))) return Number(m);
    var c = (corridas || []).filter(function (x) { return x.fuente_id === f.id && x.estado === 'PROCESSED'; })[0];
    return c ? c.anio_detectado : null;
  }
  // Fuente vigente (REGISTRADA) del tipo y período pedidos + su última corrida.
  function archivoVigente(def, ac, fuentes, corridas) {
    var per = def.periodo == null ? null : ac + def.periodo;
    var fs = (fuentes || []).filter(function (f) {
      if (f.tipo_fuente !== def.tipo || f.estado !== 'REGISTRADA') return false;
      return def.tipo !== 'BALANCE' || periodoDeFuente(f, corridas) === per;   // el período solo distingue Balances (H5-A)
    });
    var f = fs.length ? fs[fs.length - 1] : null;
    var cs = f ? (corridas || []).filter(function (c) { return c.fuente_id === f.id; }).sort(function (a, b) { return b.id - a.id; }) : [];
    return { def: def, periodo: per, fuente: f, corrida: cs[0] || null, duplicado: fs.length > 1 };
  }
  function estadoArchivo(a) {
    if (!a.fuente) return a.def.obligatorio ? 'pendiente' : 'opcional';
    if (a.duplicado) return 'problema';
    if (!a.corrida) return 'sin_importar';
    if (a.corrida.estado === 'PROCESSED') return Number(a.corrida.n_bloqueantes || 0) > 0 ? 'problema' : 'listo';
    if (a.corrida.estado === 'PROCESSING') return 'en_curso';
    return 'problema';
  }

  // Confirmar en bloque solo las propuestas del sistema que la base acepta sin motivo: INFERRED con categoría y que no sea OTHER_*
  // (renta_mapeo_confirmar exige motivo para OTHER_* y para cualquier cambio). El resto se confirma de a una.
  function confirmableEnBloque(r) { return !!r && r.estado === 'INFERRED' && !!r.categoria && !/^OTHER_/.test(r.categoria); }
  function motivoObligatorio(cat, prop) { return !prop || cat !== prop || /^OTHER_/.test(cat || ''); }

  function tiene(lista, prefijo) { return (lista || []).some(function (b) { return String(b).indexOf(prefijo) === 0; }); }

  // ── Los 5 pasos ────────────────────────────────────────────────────────────
  // d = { yo, cliente, rc (renta_clientes), caso, fuentes, corridas, lecturas, aperturaVigente, entrada, snapshot, resultados, motor, supuesto }
  function pasos(d) {
    var ac = d.caso ? d.caso.anio_comercial : AC_DEFECTO;
    var ent = d.entrada || null, ef = (ent && ent.efectivo) || {}, bl = (ent && ent.bloqueos_final) || [], av = (ent && ent.avisos) || [];
    var P = [];

    // 1 · Cliente y caso
    var p1 = { n: 1, clave: 'caso', titulo: 'Cliente y caso', estado: 'pendiente', detalle: [] };
    var reg = d.caso ? d.caso.regimen : (d.cliente && d.cliente.regimen);
    if (!d.cliente) p1.detalle.push('Elige el cliente.');
    else if (!d.rc || d.rc.estado !== 'OPERATIONAL') { p1.estado = d.rc ? 'en_curso' : 'pendiente'; p1.detalle.push(d.rc ? 'El cliente está esperando que el Master lo active en MiRenta.' : 'El cliente todavía no está habilitado en MiRenta.'); }
    else if (!d.caso) p1.detalle.push('Falta crear el caso del año comercial ' + ac + '.');
    else if (d.caso.regimen !== '14D3') { p1.estado = 'problema'; p1.detalle.push('La proyección de esta versión es solo para Pro Pyme General (14 D N°3). Este caso está en ' + d.caso.regimen + '.'); }
    else if (['DRAFT', 'IN_PROGRESS'].indexOf(d.caso.estado) < 0) { p1.estado = 'problema'; p1.detalle.push('El caso está ' + d.caso.estado + ': ya no admite cambios.'); }
    else { p1.estado = 'listo'; p1.detalle.push('Caso año comercial ' + d.caso.anio_comercial + ' · AT ' + d.caso.anio_tributario + ' · régimen 14 D N°3.'); }
    if (!d.caso && reg && reg !== '14D3' && d.cliente) { p1.estado = 'problema'; p1.detalle.push('La ficha del cliente indica régimen ' + reg + ': esta versión proyecta solo 14 D N°3.'); }
    P.push(p1);
    var casoOk = p1.estado === 'listo';

    // 2 · F22 del año anterior → apertura tributaria
    var p2 = { n: 2, clave: 'f22', titulo: 'F22 del año anterior', estado: 'pendiente', detalle: [], recomendado: true };
    var f22 = (d.fuentes || []).filter(function (f) { return f.tipo_fuente === 'F22_ANTERIOR' && f.estado === 'REGISTRADA'; }).pop() || null;
    var lec = f22 ? (d.lecturas || []).filter(function (l) { return l.fuente_id === f22.id; }).sort(function (a, b) { return b.id - a.id; })[0] || null : null;
    var av2 = d.aperturaVigente || {};
    p2.f22 = f22; p2.lectura = lec;
    if (!casoOk) p2.estado = 'bloqueado';
    else if (av2.effective && !av2.working) { p2.estado = 'listo'; p2.detalle.push('Apertura tributaria verificada.'); }
    else if (av2.working || av2.effective) { p2.estado = 'listo'; p2.detalle.push('Apertura declarada. Falta que otra persona Master la verifique (necesario solo para la proyección FINAL).'); }
    else if (!f22) p2.detalle.push('Sube el PDF del F22 (Compacto del SII) del AT ' + ac + '. Sin él la proyección sale igual, pero los registros RAI, SAC y CPTS quedan "No disponible".');
    else if (!lec || lec.estado === 'EN_PROCESO') { p2.estado = lec ? 'en_curso' : 'sin_leer'; p2.detalle.push(lec ? 'Leyendo el F22…' : 'F22 subido: falta leerlo.'); }
    else if (lec.estado === 'PROPUESTA') { p2.estado = 'revisar'; p2.detalle.push('El sistema leyó el F22 y propone los saldos. Revísalos y confírmalos.'); }
    else { p2.estado = 'problema'; p2.detalle.push('La lectura del F22 no se pudo completar (' + (lec.error_codigo || lec.estado) + '). Revisa que sea el Compacto del AT correcto.'); }
    P.push(p2);

    // 3 · Contabilidad del año (Diario + Balance) e importación/conciliación
    var p3 = { n: 3, clave: 'contabilidad', titulo: 'Libro Diario y Balance ' + ac, estado: 'pendiente', detalle: [] };
    p3.archivos = ARCHIVOS.map(function (def) { var a = archivoVigente(def, ac, d.fuentes, d.corridas); a.estado = estadoArchivo(a); return a; });
    var oblig = p3.archivos.filter(function (a) { return a.def.obligatorio; });
    var cdb = ef.conciliaciones && ef.conciliaciones.diario_balance, apc = ef.apertura_contable || {};
    p3.conciliacion = cdb || null; p3.aperturaContable = apc; p3.conciliacionAnterior = (ef.conciliaciones && ef.conciliaciones.apertura) || null;
    if (!casoOk) p3.estado = 'bloqueado';
    else if (oblig.some(function (a) { return a.estado === 'problema'; }) || tiene(bl, 'INVARIANTE_VIOLADO') || tiene(bl, 'DIARIO_AC_NO_COINCIDE')) { p3.estado = 'problema'; p3.detalle.push('Un archivo obligatorio tiene problemas: revisa el detalle de cada uno.'); }
    else if (oblig.some(function (a) { return a.estado === 'en_curso'; })) { p3.estado = 'en_curso'; p3.detalle.push('Importando…'); }
    else if (oblig.some(function (a) { return a.estado !== 'listo'; })) p3.detalle.push('Sube el Libro Diario y el Balance ' + ac + ' exportados de Masconta.');
    else if (!cdb) { p3.estado = 'en_curso'; p3.detalle.push('Archivos importados: falta conciliar el Diario con el Balance.'); }
    else if (cdb.evaluacion !== 'CUADRA') {
      p3.estado = 'problema'; p3.detalle.push('El Diario y el Balance no cuadran (' + (cdb.diferencias || 0) + ' cuenta(s) con diferencia). Revisa que ambos sean del mismo período y vuelve a exportar.');
      // Caso típico al actualizar el mes: se reemplazó solo uno de los dos archivos.
      var fd = oblig[0].fuente, fb = oblig[1].fuente, dd = fd && String(fd.cargado_at || '').slice(0, 10), db = fb && String(fb.cargado_at || '').slice(0, 10);
      if (dd && db && dd !== db) p3.detalle.push('El ' + (dd > db ? 'Libro Diario' : 'Balance') + ' se subió el ' + fecha(dd > db ? dd : db) + ' y el ' + (dd > db ? 'Balance' : 'Libro Diario') + ' el ' + fecha(dd > db ? db : dd) + ': si estás actualizando el mes, reemplaza también el ' + (dd > db ? 'Balance' : 'Libro Diario') + ' con el mismo corte.');
    }
    else if (apc.estado === 'A0' || !apc.estado) { p3.estado = 'problema'; p3.detalle.push(tiene(bl, 'APERTURA_AMBIGUA') ? 'El Diario tiene más de un asiento de apertura: hay que dejar uno solo.' : 'El Diario no trae el asiento de apertura del año.'); }
    else {
      p3.estado = apc.estado === 'A2' ? 'listo' : 'revisar';
      p3.detalle.push('El Diario y el Balance cuadran.');
      if (apc.estado !== 'A2') p3.detalle.push('Asiento de apertura N° ' + (apc.asiento_numero || '—') + (apc.estado === 'A3' ? ' detectado: confírmalo para dejar los saldos iniciales aceptados.' : ': falta aceptar sus saldos iniciales.'));
    }
    P.push(p3);
    var contOk = p3.estado === 'listo' || p3.estado === 'revisar';

    // 4 · Mapeo de cuentas
    var p4 = { n: 4, clave: 'mapeo', titulo: 'Mapeo de cuentas', estado: 'pendiente', detalle: [] };
    var snap = d.snapshot || null, res = d.resultados || [];
    p4.snapshot = snap;
    p4.porConfirmar = res.filter(function (r) { return r.estado === 'UNKNOWN' || r.estado === 'INFERRED'; })
      .sort(function (a, b) { return (a.estado === 'UNKNOWN' ? 0 : 1) - (b.estado === 'UNKNOWN' ? 0 : 1) || Math.abs(Number(b.saldo || 0)) - Math.abs(Number(a.saldo || 0)); });
    p4.sinClasificar = res.filter(function (r) { return r.estado === 'UNKNOWN'; }).length;
    if (!contOk) p4.estado = 'bloqueado';
    else if (!snap || tiene(bl, 'SIN_SNAPSHOT_MAPEO') || tiene(bl, 'SNAPSHOT_MAPEO_DESACTUALIZADO')) { p4.detalle.push('Falta calcular el mapeo con los archivos actuales.'); }
    else if (p4.porConfirmar.length) {
      p4.estado = 'revisar';
      p4.detalle.push(snap.cuentas_usadas + ' cuentas: el sistema propuso la clasificación de ' + (snap.cuentas_mapeadas || 0) + '. ' + p4.porConfirmar.length + ' esperan tu confirmación' + (p4.sinClasificar ? ' (' + p4.sinClasificar + ' sin clasificar)' : '') + '.');
    } else { p4.estado = 'listo'; p4.detalle.push('Las ' + snap.cuentas_usadas + ' cuentas están clasificadas.'); }
    P.push(p4);
    var mapeoOk = p4.estado === 'listo' || p4.estado === 'revisar';

    // 5 · Ejecutar proyección
    var p5 = { n: 5, clave: 'proyectar', titulo: 'Ejecutar proyección', estado: 'pendiente', detalle: [] };
    p5.motor = d.motor || null; p5.bloqueos = bl.slice(); p5.avisos = av.slice(); p5.supuesto = d.supuesto || null;
    p5.listoParaCorrer = casoOk && contOk && mapeoOk;
    if (!p5.listoParaCorrer) p5.estado = 'bloqueado';
    else if (d.motor && d.motor.estado === 'COMPLETED') {
      p5.estado = d.motor.resultado_estado === 'FINAL' ? 'listo' : 'revisar';
      p5.detalle.push('Última proyección: ' + (d.motor.resultado_estado === 'FINAL' ? 'FINAL' : 'PRELIMINAR') + ' · contabilidad al ' + fecha(d.motor.cutoff_date) + '.');
    } else p5.detalle.push('Todo listo para calcular.');
    P.push(p5);
    return P;
  }

  // Paso que conviene mostrar abierto: el primero (desde "desde") que no está listo ni esperando al anterior.
  function pasoActivo(P, desde) {
    for (var i = 0; i < P.length; i++) if (P[i].n >= (desde || 1) && P[i].estado !== 'listo' && P[i].estado !== 'bloqueado') return P[i].n;
    return desde && desde > 1 ? pasoActivo(P, 1) : 5;
  }

  // Paso que se abre al entrar. Si el caso ya tiene una proyección calculada, lo habitual es actualizar la contabilidad del mes
  // (reemplazar Diario y Balance): se abre el paso 3 directamente. Si no, el primer paso pendiente.
  function pasoInicial(P) {
    var p3 = P[2], p5 = P[4];
    if (p5 && p5.motor && p5.motor.estado === 'COMPLETED' && p3 && p3.estado !== 'bloqueado') return 3;
    return pasoActivo(P);
  }

  var ETIQUETA_ESTADO = {
    pendiente: ['gris', 'Pendiente'], sin_leer: ['ambar', 'Falta leer'], en_curso: ['lila', 'En curso'], listo: ['verde', 'Listo'],
    revisar: ['ambar', 'Revisar'], problema: ['rojo', 'Con problemas'], bloqueado: ['gris', 'Espera el paso anterior'], opcional: ['gris', 'Opcional'],
    sin_importar: ['ambar', 'Falta importar']
  };

  // Fin de mes de cada mes cubierto (1..mesHasta) del año comercial → opciones del corte.
  function cortes(ac, mesHasta) {
    var out = [];
    for (var m = 1; m <= Math.min(12, Math.max(0, mesHasta || 0)); m++) {
      var d = new Date(Date.UTC(ac, m, 0));
      out.push(ac + '-' + ('0' + m).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2));
    }
    return out;
  }
  function fecha(iso) { if (!iso) return '—'; var p = String(iso).slice(0, 10).split('-'); return p[2] + '-' + p[1] + '-' + p[0]; }

  // Ruta exigida por la política del bucket mirenta-fuentes: cliente/AC/clave_sha
  function rutaFuente(caso, clave, sha) { return caso.cliente_id + '/' + caso.anio_comercial + '/' + clave + '_' + sha; }

  function mensajeError(msg) {
    var m = String(msg || '');
    var mapa = [
      [/F22_VIGENTE_EXISTE|DIARIO_VIGENTE_EXISTE|BALANCE_PERIODO_VIGENTE_EXISTE/, 'Ya hay un archivo vigente de ese tipo. Usa "Reemplazar" sobre el archivo cargado.'],
      [/PERIODO_FUERA_DE_RANGO|REEMPLAZO_PERIODO_DISTINTO/, 'El período del Balance no corresponde al caso.'],
      [/Ya existe un caso vigente/, 'Este cliente ya tiene un caso para ese año: recarga la página.'],
      [/Solo Master habilita/, 'Solo el Master puede habilitar un cliente en MiRenta.'],
      [/no admite nuevas fuentes|no admite conciliaciones|no se recalcula|no admite cambios/, 'El caso ya no está abierto para cambios.'],
      [/Sin cuentas que conciliar/, 'Los archivos importados no tienen cuentas para conciliar.'],
      [/no es del mismo año que el Diario/, 'El Balance no es del mismo año que el Libro Diario.'],
      [/SNAPSHOT_DESACTUALIZADO/, 'El mapeo cambió mientras confirmabas. Recarga y vuelve a intentarlo.'],
      [/exige un motivo/, 'Para cambiar la clasificación propuesta escribe un motivo.'],
      [/CORTE_INVALIDO/, 'La fecha de corte no está cubierta por el Balance cargado. Elige un mes anterior.'],
      [/LAYOUT_AUSENTE|LAYOUT_INVALIDO/, 'Falta el formato F22 vigente del año tributario (lo carga el Master).'],
      [/APERTURA_CONTABLE_INVALIDA/, 'Falta el asiento de apertura del Libro Diario.'],
      [/42501|No autorizado|SIN_ACCESO|Sin acceso|RENTA_SIN_PERMISO/i, 'No tienes permiso para esta acción en este cliente (Master o analista contable asignado).']
    ];
    for (var i = 0; i < mapa.length; i++) if (mapa[i][0].test(m)) return mapa[i][1];
    return 'No se pudo completar la acción. ' + m.replace(/^[A-Z_]+:\s*/, '').slice(0, 220);
  }

  var api = { AC_DEFECTO: AC_DEFECTO, ARCHIVOS: ARCHIVOS, pasos: pasos, pasoActivo: pasoActivo, pasoInicial: pasoInicial, confirmableEnBloque: confirmableEnBloque, motivoObligatorio: motivoObligatorio, textoBloqueo: textoBloqueo, ETIQUETA_ESTADO: ETIQUETA_ESTADO,
              archivoVigente: archivoVigente, estadoArchivo: estadoArchivo, periodoDeFuente: periodoDeFuente, cortes: cortes, fecha: fecha, rutaFuente: rutaFuente, mensajeError: mensajeError };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  raiz.ProyectarLogica = api;
})(typeof window !== 'undefined' ? window : globalThis);
