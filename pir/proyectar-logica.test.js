// Pruebas de pir/proyectar-logica.js · ejecutar: node --test pir/proyectar-logica.test.js  (datos 100% sintéticos)
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('./proyectar-logica.js');

const YO = { id: 1, es_master: true, rol: 'master' };
const CLI = { id: 10, razon_social: 'Empresa Sintética SpA', regimen: '14D3' };
const RC = { cliente_id: 10, estado: 'OPERATIONAL' };
const CASO = { id: 5, cliente_id: 10, anio_comercial: 2026, anio_tributario: 2027, regimen: '14D3', estado: 'DRAFT' };
const fu = (id, tipo, per) => ({ id, tipo_fuente: tipo, estado: 'REGISTRADA', metadatos: per ? { periodo: String(per) } : {} });
const co = (id, fuente_id, tipo, anio, estado = 'PROCESSED') => ({ id, fuente_id, tipo_fuente: tipo, anio_detectado: anio, estado, n_bloqueantes: 0 });
const est = (P) => P.map((p) => p.estado);

test('sin cliente: todo pendiente/bloqueado', () => {
  const P = L.pasos({ yo: YO });
  assert.deepEqual(est(P), ['pendiente', 'bloqueado', 'bloqueado', 'bloqueado', 'bloqueado']);
});

test('cliente no habilitado y sin caso', () => {
  const P = L.pasos({ yo: YO, cliente: CLI, rc: null });
  assert.equal(P[0].estado, 'pendiente');
  assert.match(P[0].detalle[0], /no está habilitado/);
});

test('régimen distinto de 14D3 es problema', () => {
  const P = L.pasos({ yo: YO, cliente: { ...CLI, regimen: '14D8' }, rc: RC, caso: null });
  assert.equal(P[0].estado, 'problema');
  const P2 = L.pasos({ yo: YO, cliente: CLI, rc: RC, caso: { ...CASO, regimen: '14A' } });
  assert.equal(P2[0].estado, 'problema');
});

test('caso nuevo: paso 1 listo, F22 pendiente (el SII no lo tiene), contabilidad pendiente', () => {
  const P = L.pasos({ yo: YO, cliente: CLI, rc: RC, caso: CASO, fuentes: [], corridas: [], lecturas: [], sii: { error: 'F22_SII_NO_DISPONIBLE: no hay' }, entrada: { efectivo: {}, bloqueos_final: ['SIN_DIARIO'] } });
  assert.deepEqual(est(P).slice(0, 4), ['listo', 'pendiente', 'pendiente', 'bloqueado']);
  assert.equal(L.pasoActivo(P), 2);
});

test('F22 con propuesta → revisar; apertura declarada → listo', () => {
  const base = { yo: YO, cliente: CLI, rc: RC, caso: CASO, fuentes: [fu(1, 'F22_ANTERIOR')], corridas: [], entrada: { efectivo: {}, bloqueos_final: [] } };
  assert.equal(L.pasos({ ...base, lecturas: [{ id: 3, fuente_id: 1, estado: 'PROPUESTA' }] })[1].estado, 'revisar');
  assert.equal(L.pasos({ ...base, lecturas: [] })[1].estado, 'sin_leer');
  assert.equal(L.pasos({ ...base, lecturas: [], aperturaVigente: { working: { apertura_id: 2 } } })[1].estado, 'listo');
});

test('contabilidad: Diario y Balance procesados + conciliación CUADRA + A3 → revisar; A2 → listo; diferencias → problema', () => {
  const fuentes = [fu(1, 'LIBRO_DIARIO'), fu(2, 'BALANCE', 2026)];
  const corridas = [co(11, 1, 'LIBRO_DIARIO', 2026), co(12, 2, 'BALANCE', 2026)];
  const ent = (cdb, apc) => ({ efectivo: { conciliaciones: { diario_balance: cdb }, apertura_contable: { estado: apc, asiento_numero: 1 } }, bloqueos_final: [] });
  const d = { yo: YO, cliente: CLI, rc: RC, caso: CASO, fuentes, corridas, lecturas: [] };
  assert.equal(L.pasos({ ...d, entrada: ent({ evaluacion: 'CUADRA', cuentas: 40 }, 'A3') })[2].estado, 'revisar');
  assert.equal(L.pasos({ ...d, entrada: ent({ evaluacion: 'CUADRA', cuentas: 40 }, 'A2') })[2].estado, 'listo');
  assert.equal(L.pasos({ ...d, entrada: ent({ evaluacion: 'CON_DIFERENCIAS', diferencias: 3 }, 'A2') })[2].estado, 'problema');
  assert.equal(L.pasos({ ...d, entrada: ent(null, 'A2') })[2].estado, 'en_curso');
  assert.equal(L.pasos({ ...d, entrada: ent({ evaluacion: 'CUADRA' }, 'A0') })[2].estado, 'problema');
});

test('Balance del año anterior se distingue por período; corrida con error es problema', () => {
  const fuentes = [fu(1, 'LIBRO_DIARIO'), fu(2, 'BALANCE', 2025)];
  const corridas = [co(11, 1, 'LIBRO_DIARIO', 2026, 'ERROR')];
  const P = L.pasos({ yo: YO, cliente: CLI, rc: RC, caso: CASO, fuentes, corridas, lecturas: [], entrada: { efectivo: {}, bloqueos_final: [] } });
  const arch = Object.fromEntries(P[2].archivos.map((a) => [a.def.clave, a.estado]));
  assert.equal(arch.DIARIO, 'problema');
  assert.equal(arch.BALANCE, 'pendiente');
  assert.equal(arch.BALANCE_ANT, 'sin_importar');
  assert.equal(P[2].estado, 'problema');
});

test('mapeo: propuestas por confirmar → revisar (deja proyectar); sin snapshot → pendiente', () => {
  const fuentes = [fu(1, 'LIBRO_DIARIO'), fu(2, 'BALANCE', 2026)];
  const corridas = [co(11, 1, 'LIBRO_DIARIO', 2026), co(12, 2, 'BALANCE', 2026)];
  const entrada = { efectivo: { conciliaciones: { diario_balance: { evaluacion: 'CUADRA' } }, apertura_contable: { estado: 'A2' } }, bloqueos_final: [] };
  const d = { yo: YO, cliente: CLI, rc: RC, caso: CASO, fuentes, corridas, lecturas: [], entrada };
  const snap = { id: 9, cuentas_usadas: 3, cuentas_mapeadas: 2 };
  const res = [{ cuenta_codigo: 'a', estado: 'RESOLVED' }, { cuenta_codigo: 'b', estado: 'INFERRED', saldo: 5 }, { cuenta_codigo: 'c', estado: 'UNKNOWN', saldo: 1 }];
  let P = L.pasos({ ...d, snapshot: snap, resultados: res });
  assert.equal(P[3].estado, 'revisar');
  assert.equal(P[3].porConfirmar[0].cuenta_codigo, 'c');   // sin clasificar primero
  assert.equal(P[4].listoParaCorrer, true);
  P = L.pasos({ ...d, snapshot: null });
  assert.equal(P[3].estado, 'pendiente');
  assert.equal(P[4].estado, 'bloqueado');
  P = L.pasos({ ...d, snapshot: snap, resultados: res, entrada: { ...entrada, bloqueos_final: ['SNAPSHOT_MAPEO_DESACTUALIZADO'] } });
  assert.equal(P[3].estado, 'pendiente');
});

test('proyección PRELIMINAR completada → revisar; FINAL → listo', () => {
  const fuentes = [fu(1, 'LIBRO_DIARIO'), fu(2, 'BALANCE', 2026)];
  const corridas = [co(11, 1, 'LIBRO_DIARIO', 2026), co(12, 2, 'BALANCE', 2026)];
  const entrada = { efectivo: { conciliaciones: { diario_balance: { evaluacion: 'CUADRA' } }, apertura_contable: { estado: 'A2' } }, bloqueos_final: ['APERTURA_TRIBUTARIA_AUSENTE'] };
  const d = { yo: YO, cliente: CLI, rc: RC, caso: CASO, fuentes, corridas, lecturas: [], entrada, snapshot: { id: 1, cuentas_usadas: 1 }, resultados: [{ estado: 'RESOLVED' }] };
  assert.equal(L.pasos({ ...d, motor: { estado: 'COMPLETED', resultado_estado: 'PRELIMINARY', cutoff_date: '2026-09-30' } })[4].estado, 'revisar');
  assert.equal(L.pasos({ ...d, motor: { estado: 'COMPLETED', resultado_estado: 'FINAL', cutoff_date: '2026-09-30' } })[4].estado, 'listo');
});

test('textos de bloqueos y cortes', () => {
  assert.match(L.textoBloqueo('REGLA_NO_ACTIVA:art21.efectos_rli'), /certificar.*art21\.efectos_rli/);
  assert.match(L.textoBloqueo('APERTURA_TRIBUTARIA_ITEM:opening.rai:PENDING'), /rai \(pendiente\)/);
  assert.match(L.textoBloqueo('CONCILIACION_AC1_DIFERENCIA:110101:44'), /110101\.$/);
  assert.equal(L.textoBloqueo('CODIGO_NUEVO'), 'CODIGO_NUEVO');
  assert.deepEqual(L.cortes(2026, 3), ['2026-01-31', '2026-02-28', '2026-03-31']);
  assert.equal(L.cortes(2028, 2)[1], '2028-02-29');
  assert.equal(L.rutaFuente({ cliente_id: 7, anio_comercial: 2026 }, 'k', 's'), '7/2026/k_s');
  assert.match(L.mensajeError('DIARIO_VIGENTE_EXISTE: x'), /Reemplazar/);
});

test('flujo mensual: con proyección calculada se abre el paso 3 (actualizar contabilidad)', () => {
  const fuentes = [fu(1, 'LIBRO_DIARIO'), fu(2, 'BALANCE', 2026)];
  const corridas = [co(11, 1, 'LIBRO_DIARIO', 2026), co(12, 2, 'BALANCE', 2026)];
  const entrada = { efectivo: { conciliaciones: { diario_balance: { evaluacion: 'CUADRA' } }, apertura_contable: { estado: 'A2' } }, bloqueos_final: [] };
  const d = { yo: YO, cliente: CLI, rc: RC, caso: CASO, fuentes, corridas, lecturas: [], entrada, snapshot: { id: 1, cuentas_usadas: 2 },
              resultados: [{ estado: 'RESOLVED' }, { estado: 'INFERRED', categoria: 'REVENUE' }] };
  assert.equal(L.pasoInicial(L.pasos(d)), L.pasoActivo(L.pasos(d)));   // sin proyección: el primer paso pendiente
  assert.equal(L.pasoInicial(L.pasos({ ...d, motor: { estado: 'COMPLETED', resultado_estado: 'PRELIMINARY', cutoff_date: '2026-09-30' } })), 3);
});

test('Diario reemplazado sin el Balance: el aviso pide reemplazar también el otro', () => {
  const fuentes = [{ ...fu(1, 'LIBRO_DIARIO'), cargado_at: '2026-11-03T10:00:00Z' }, { ...fu(2, 'BALANCE', 2026), cargado_at: '2026-10-05T10:00:00Z' }];
  const corridas = [co(11, 1, 'LIBRO_DIARIO', 2026), co(12, 2, 'BALANCE', 2026)];
  const entrada = { efectivo: { conciliaciones: { diario_balance: { evaluacion: 'CON_DIFERENCIAS', diferencias: 7 } }, apertura_contable: { estado: 'A3' } }, bloqueos_final: [] };
  const P = L.pasos({ yo: YO, cliente: CLI, rc: RC, caso: CASO, fuentes, corridas, lecturas: [], entrada });
  assert.equal(P[2].estado, 'problema');
  assert.match(P[2].detalle[1], /reemplaza también el Balance/);
});

test('confirmar en bloque: solo INFERRED con categoría y sin OTHER_*; motivo obligatorio', () => {
  assert.equal(L.confirmableEnBloque({ estado: 'INFERRED', categoria: 'REVENUE' }), true);
  assert.equal(L.confirmableEnBloque({ estado: 'INFERRED', categoria: 'OTHER_EXPENSE' }), false);
  assert.equal(L.confirmableEnBloque({ estado: 'UNKNOWN', categoria: null }), false);
  assert.equal(L.motivoObligatorio('REVENUE', 'REVENUE'), false);
  assert.equal(L.motivoObligatorio('OTHER_ASSET', 'OTHER_ASSET'), true);
  assert.equal(L.motivoObligatorio('REVENUE', 'EXPENSE'), true);
  assert.equal(L.motivoObligatorio('REVENUE', ''), true);
});

// ── F22 desde el SII (Cartapra) ──
const fSii = (id) => ({ id, tipo_fuente: 'F22_ANTERIOR', estado: 'REGISTRADA', origen: 'SII', metadatos: { via: 'CARTAPRA', folio: '900000101', fecha_ingreso: '2026-04-28', estado_sii: 'Vigente', anio_tributario: 2026, versiones_sii: 1 } });
const prop13 = Array.from({ length: 13 }, (_, i) => ({ item_key: 'k' + i, monto: i === 12 ? null : i * 10, estado: i === 12 ? 'PENDING' : 'OK', provenance: 'DECLARED_F22', evidencia_fuente_id: 1, f22_codigo_ref: i === 12 ? null : String(1400 + i), derivacion: 'F22_CODE', ...(i === 12 ? { nota: 'pendiente' } : {}) }));
const baseSii = { yo: YO, cliente: CLI, rc: RC, caso: CASO, corridas: [], entrada: { efectivo: {}, bloqueos_final: [] } };

test('debeTraerF22Sii: caso editable sin F22 o con F22 del SII → sí; PDF subido, caso cerrado, otro régimen o sin habilitar → no', () => {
  assert.equal(L.debeTraerF22Sii({ ...baseSii, fuentes: [] }), true);
  assert.equal(L.debeTraerF22Sii({ ...baseSii, fuentes: [fSii(1)] }), true);
  assert.equal(L.debeTraerF22Sii({ ...baseSii, fuentes: [fu(1, 'F22_ANTERIOR')] }), false);
  assert.equal(L.debeTraerF22Sii({ ...baseSii, caso: { ...CASO, estado: 'MASTER_APPROVED' }, fuentes: [] }), false);
  assert.equal(L.debeTraerF22Sii({ ...baseSii, caso: { ...CASO, regimen: '14A' }, fuentes: [] }), false);
  assert.equal(L.debeTraerF22Sii({ ...baseSii, rc: { estado: 'PENDING_MASTER_APPROVAL' }, fuentes: [] }), false);
  assert.equal(L.debeTraerF22Sii({ ...baseSii, caso: null }), false);
});

test('paso 2 mientras busca en el SII → en curso, sin plan B; sin F22 en el SII → pendiente con plan B (PDF)', () => {
  const p = L.pasos({ ...baseSii, fuentes: [], lecturas: [] })[1];
  assert.equal(p.estado, 'en_curso'); assert.match(p.detalle[0], /Buscando el F22/); assert.equal(p.planB, false);
  const q = L.pasos({ ...baseSii, fuentes: [], lecturas: [], sii: { error: 'F22_SII_NO_DISPONIBLE: x' } })[1];
  assert.equal(q.estado, 'pendiente'); assert.equal(q.siiSinF22, true); assert.equal(q.planB, true); assert.match(q.detalle[0], /no tiene el F22/);
  const a = L.pasos({ ...baseSii, fuentes: [], lecturas: [], sii: { error: 'F22_SII_AMBIGUO: x' } })[1];
  assert.equal(a.planB, true); assert.equal(a.siiSinF22, false); assert.match(a.detalle[0], /más de una declaración/);
});

test('paso 2 con lectura del SII PROPUESTA → revisar, un clic, sin plan B, datos del SII a la vista', () => {
  const lec = { id: 9, fuente_id: 1, estado: 'PROPUESTA', blocking_count: 0, resultado: { propuesta: prop13 } };
  const p = L.pasos({ ...baseSii, fuentes: [fSii(1)], lecturas: [lec] })[1];
  assert.equal(p.estado, 'revisar'); assert.equal(p.desdeSii, true); assert.equal(p.unClic, true); assert.equal(p.planB, false);
  assert.match(p.detalle[0], /traído del SII/); assert.equal(L.textoSii(p.siiInfo), 'Folio 900000101 · presentado el 28-04-2026 · Vigente');
  const conRes = L.pasos({ ...baseSii, fuentes: [fSii(1)], lecturas: [lec], sii: { accion: 'SIN_CAMBIO', sii: { folio: '900000102', versiones: 2 } } })[1];
  assert.equal(conRes.siiInfo.folio, '900000102');
});

test('paso 2: lectura del SII BLOQUEADO → problema con el motivo y plan B; apertura ya declarada → listo y sin un clic', () => {
  const lb = { id: 9, fuente_id: 1, estado: 'BLOQUEADO', blocking_count: 1, resultado: { propuesta: prop13, blocking_findings: [{ codigo: 'CONCEPTO_SIN_CLAVE', mensaje: 'STUT (código 1391) tiene saldo' }] } };
  const p = L.pasos({ ...baseSii, fuentes: [fSii(1)], lecturas: [lb] })[1];
  assert.equal(p.estado, 'problema'); assert.match(p.detalle[0], /STUT/); assert.equal(p.planB, true); assert.equal(p.unClic, false);
  const lp = { ...lb, estado: 'PROPUESTA', blocking_count: 0 };
  const q = L.pasos({ ...baseSii, fuentes: [fSii(1)], lecturas: [lp], aperturaVigente: { working: { apertura_id: 3 } } })[1];
  assert.equal(q.estado, 'listo'); assert.equal(q.unClic, false); assert.equal(q.planB, false);
});

test('paso 2: SII cambió después de confirmar → siiCambio (la pantalla ofrece usar la versión nueva)', () => {
  const lp = { id: 9, fuente_id: 1, estado: 'PROPUESTA', blocking_count: 0, resultado: { propuesta: prop13 } };
  const p = L.pasos({ ...baseSii, fuentes: [fSii(1)], lecturas: [lp], aperturaVigente: { working: { apertura_id: 3 } }, sii: { accion: 'SII_CAMBIO_CON_APERTURA', sii: { folio: '900000102' } } })[1];
  assert.equal(p.siiCambio, true); assert.equal(p.estado, 'listo');
});

test('paso 2 con PDF subido a mano: flujo de siempre (plan B visible hasta que haya propuesta)', () => {
  const p = L.pasos({ ...baseSii, fuentes: [fu(1, 'F22_ANTERIOR')], lecturas: [] })[1];
  assert.equal(p.estado, 'sin_leer'); assert.equal(p.desdeSii, false); assert.equal(p.planB, true);
  const q = L.pasos({ ...baseSii, fuentes: [fu(1, 'F22_ANTERIOR')], lecturas: [{ id: 3, fuente_id: 1, estado: 'PROPUESTA', blocking_count: 0, resultado: { propuesta: prop13 } }] })[1];
  assert.equal(q.planB, false); assert.equal(q.unClic, true);
});

test('itemsParaDeclarar: las 13 claves tal cual (sin derivacion), nulls explícitos; un clic exige 13 claves y 0 bloqueos', () => {
  const it = L.itemsParaDeclarar({ resultado: { propuesta: prop13 } });
  assert.equal(it.length, 13); assert.equal('derivacion' in it[0], false);
  assert.deepEqual(it[12], { item_key: 'k12', monto: null, estado: 'PENDING', provenance: 'DECLARED_F22', evidencia_fuente_id: 1, f22_codigo_ref: null, nota: 'pendiente' });
  assert.deepEqual(it[1], { item_key: 'k1', monto: 10, estado: 'OK', provenance: 'DECLARED_F22', evidencia_fuente_id: 1, f22_codigo_ref: '1401', nota: null });
  assert.equal(L.puedeConfirmarEnUnClic({ estado: 'PROPUESTA', blocking_count: 0, resultado: { propuesta: prop13.slice(1) } }, {}), false);
  assert.equal(L.puedeConfirmarEnUnClic({ estado: 'PROPUESTA', blocking_count: 1, resultado: { propuesta: prop13 } }, {}), false);
  assert.equal(L.puedeConfirmarEnUnClic(null, {}), false);
  assert.match(L.motivoUnClic({ anio_tributario: 2026, folio: '9001' }), /F22 AT 2026 \(folio 9001, SII vía Cartapra\), confirmados sin cambios/);
});

test('mensajeError: códigos del F22 del SII en lenguaje simple', () => {
  assert.match(L.mensajeError('F22_SII_NO_DISPONIBLE: Cartapra no tiene'), /sube el PDF/);
  assert.match(L.mensajeError('F22_SII_AMBIGUO: 2'), /más de una declaración/);
  assert.match(L.mensajeError('CASO_NO_EDITABLE: x'), /no está abierto/);
  assert.match(L.mensajeError('LECTURA_F22_DATO_NO_COINCIDE: x'), /no coinciden/);
});

test('rectificatoria aceptada: la apertura es de otro F22 → revisar y un clic para reconfirmar; si es del mismo, no', () => {
  const lp = { id: 9, fuente_id: 2, estado: 'PROPUESTA', blocking_count: 0, resultado: { propuesta: prop13 } };
  const av = { working: { apertura_id: 3, fuente_f22: { id: 1, estado: 'REEMPLAZADA' } } };
  const p = L.pasos({ ...baseSii, fuentes: [fSii(2)], lecturas: [lp], aperturaVigente: av })[1];
  assert.equal(p.estado, 'revisar'); assert.equal(p.aperturaVieja, true); assert.equal(p.unClic, true); assert.match(p.detalle[0], /rectificatoria/);
  assert.equal(L.puedeConfirmarEnUnClic(lp, { working: { fuente_f22: { id: 2 } } }), false);
});
