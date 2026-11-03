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

test('caso nuevo: paso 1 listo, F22 pendiente, contabilidad pendiente', () => {
  const P = L.pasos({ yo: YO, cliente: CLI, rc: RC, caso: CASO, fuentes: [], corridas: [], lecturas: [], entrada: { efectivo: {}, bloqueos_final: ['SIN_DIARIO'] } });
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
