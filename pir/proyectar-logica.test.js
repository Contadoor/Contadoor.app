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
  assert.equal(arch.BALANCE, 'opcional');   // 3-nov-2026: el Balance del año es opcional (control)
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

// ── 3-nov-2026 · Balance opcional, año del archivo, mensajes y mapeo automático ──
test('Balance del año OPCIONAL: solo con el Diario (A2) el paso 3 queda listo y se puede seguir al mapeo', () => {
  const fuentes = [fu(1, 'LIBRO_DIARIO')];
  const corridas = [co(11, 1, 'LIBRO_DIARIO', 2026)];
  const entrada = { efectivo: { conciliaciones: {}, apertura_contable: { estado: 'A2' } }, bloqueos_final: ['SIN_BALANCE_AC'] };
  const P = L.pasos({ yo: YO, cliente: CLI, rc: RC, caso: CASO, fuentes, corridas, lecturas: [], entrada });
  assert.equal(P[2].estado, 'listo');
  assert.match(P[2].detalle[0], /Sin Balance 2026: la proyección usa los saldos del Diario/);
  assert.equal(P[2].archivos[1].estado, 'opcional');
  assert.equal(P[3].estado, 'pendiente');   // ya no espera: se calcula el mapeo
  assert.equal(L.pasos({ yo: YO, cliente: CLI, rc: RC, caso: CASO, fuentes, corridas, lecturas: [], entrada: { ...entrada, efectivo: { apertura_contable: { estado: 'A3', asiento_numero: 1 } } } })[2].estado, 'revisar');
  assert.match(L.textoBloqueo('SIN_BALANCE_AC'), /opcional para proyectar/);
});
test('Balance subido que no se pudo leer: el paso 3 queda en revisar (se puede seguir sin él); con Balance OK se exige que cuadre', () => {
  const fuentes = [fu(1, 'LIBRO_DIARIO'), fu(2, 'BALANCE', 2026)];
  const entrada = { efectivo: { conciliaciones: {}, apertura_contable: { estado: 'A2' } }, bloqueos_final: ['SIN_BALANCE_AC'] };
  const P = L.pasos({ yo: YO, cliente: CLI, rc: RC, caso: CASO, fuentes, corridas: [co(11, 1, 'LIBRO_DIARIO', 2026), co(12, 2, 'BALANCE', null, 'ERROR')], lecturas: [], entrada });
  assert.equal(P[2].archivos[1].estado, 'problema');
  assert.equal(P[2].estado, 'revisar');
  assert.match(P[2].detalle[0], /Balance 2026 tiene problemas/);
  const P2 = L.pasos({ yo: YO, cliente: CLI, rc: RC, caso: CASO, fuentes, corridas: [co(11, 1, 'LIBRO_DIARIO', 2026), co(12, 2, 'BALANCE', 2026)], lecturas: [],
    entrada: { efectivo: { conciliaciones: { diario_balance: { evaluacion: 'CON_DIFERENCIAS', diferencias: 2 } }, apertura_contable: { estado: 'A2' } }, bloqueos_final: [] } });
  assert.equal(P2[2].estado, 'problema');
});
test('rótulos con el año: "Balance 2026 (este año)" y "Balance 2025 (cierre del año anterior)"', () => {
  const [dia, bal, ant] = L.ARCHIVOS;
  assert.equal(dia.nombre(2026), 'Libro Diario 2026'); assert.equal(dia.etiqueta, 'Obligatorio');
  assert.equal(bal.nombre(2026), 'Balance 2026 (este año)'); assert.equal(bal.etiqueta, 'Opcional (control)'); assert.equal(bal.obligatorio, false);
  assert.equal(ant.nombre(2026), 'Balance 2025 (cierre del año anterior)');
});
test('año del nombre del archivo Masconta: no se sube en la tarjeta equivocada y se sugiere la correcta; sin año no se bloquea', () => {
  assert.equal(L.anioDeNombre('BALANCE', 'Balance8Columnas_78107327-K_0-2026.xls'), 2026);
  assert.equal(L.anioDeNombre('BALANCE', 'Balance8Columnas_78107327-K_0-2025 (1).xls'), 2025);
  assert.equal(L.anioDeNombre('LIBRO_DIARIO', 'LibroLibDiarioVouche_78107327-K_2026.xls'), 2026);
  assert.equal(L.anioDeNombre('BALANCE', 'balance septiembre.xls'), null);
  const r = L.revisarAnioArchivo('BALANCE_ANT', 2026, 'Balance8Columnas_78107327-K_0-2026.xls');   // el error real del 3-nov
  assert.equal(r.anio, 2026); assert.equal(r.sugerida, 'BALANCE');
  assert.match(r.texto, /es del año 2026 y esta tarjeta es "Balance 2025 \(cierre del año anterior\)". No se subió. Súbelo en la tarjeta "Balance 2026 \(este año\)"/);
  assert.equal(L.revisarAnioArchivo('BALANCE', 2026, 'Balance8Columnas_78107327-K_0-2025.xls').sugerida, 'BALANCE_ANT');
  assert.equal(L.revisarAnioArchivo('BALANCE', 2026, 'Balance8Columnas_78107327-K_0-2026.xls'), null);
  assert.equal(L.revisarAnioArchivo('BALANCE_ANT', 2026, 'Balance8Columnas_78107327-K_0-2025.xls'), null);
  assert.equal(L.revisarAnioArchivo('BALANCE', 2026, 'mi balance.xls'), null);                     // sin año en el nombre: no se bloquea
  const x = L.revisarAnioArchivo('BALANCE', 2026, 'Balance8Columnas_78107327-K_0-2023.xls');
  assert.equal(x.sugerida, null); assert.match(x.texto, /exporta el Balance del año 2026/);
  assert.match(L.revisarAnioArchivo('DIARIO', 2026, 'LibroLibDiarioVouche_78107327-K_2025.xls').texto, /Libro Diario del año 2026/);
  assert.equal(L.revisarAnioArchivo('PLAN', 2026, 'PlanCuentas_0-2025.xls'), null);
});
test('mensajes comprensibles: período declarado ≠ archivo, período no detectado y archivo duplicado', () => {
  assert.equal(L.mensajeError('PERIODO_DECLARADO_NO_COINCIDE: Se declaró el período 2025 y el archivo es del 2026'),
    'Ese Balance es del año 2026 y lo subiste en la tarjeta del 2025. Súbelo en la tarjeta "Balance 2026".');
  assert.match(L.mensajeError('PERIODO_NO_DETECTADO: No se encontró "Período aaaa"'), /no encontró el año dentro del Balance/);
  assert.match(L.mensajeError('BALANCE_AUSENTE: sin Balance vigente del AC'), /todavía exige el Balance/);
  assert.match(L.mensajeError('renta_fuente_registrar: duplicate key value violates unique constraint "renta_fuentes_uq_archivo_caso"'), /ya está cargado en este caso/);
  const inc = [{ codigo: 'PERIODO_DECLARADO_NO_COINCIDE', severidad: 'BLOCKING', mensaje: 'Se declaró el período 2025 y el archivo es del 2026' },
               { codigo: 'RUT_NO_INFORMADO', severidad: 'WARNING', mensaje: 'x' }];
  assert.match(L.mensajeCorrida({ error_mensaje: '1 incidencia(s) BLOCKING' }, inc), /Ese Balance es del año 2026/);
  assert.equal(L.mensajeCorrida({ error_mensaje: '1 incidencia(s) BLOCKING' }, [{ codigo: 'OTRA', severidad: 'BLOCKING', mensaje: 'Detalle propio' }]), 'Detalle propio');
  assert.equal(L.mensajeCorrida({ error_mensaje: 'algo' }, []), 'algo');
});
test('mapeo automático: se confirman solas las propuestas seguras; el paso 4 queda listo si no queda nada que decidir', () => {
  const res = [{ cuenta_codigo: 'a', estado: 'RESOLVED', categoria: 'REVENUE' }, { cuenta_codigo: 'b', estado: 'INFERRED', categoria: 'EXPENSE' },
               { cuenta_codigo: 'c', estado: 'INFERRED', categoria: 'OTHER_EXPENSE' }, { cuenta_codigo: 'd', estado: 'UNKNOWN', categoria: null }];
  assert.deepEqual(L.autoConfirmables(res).map((r) => r.cuenta_codigo), ['b']);
  assert.match(L.MOTIVO_AUTO, /automática/);
  const fuentes = [fu(1, 'LIBRO_DIARIO')], corridas = [co(11, 1, 'LIBRO_DIARIO', 2026)];
  const entrada = { efectivo: { apertura_contable: { estado: 'A2' } }, bloqueos_final: ['SIN_BALANCE_AC'] };
  const d = { yo: YO, cliente: CLI, rc: RC, caso: CASO, fuentes, corridas, lecturas: [], entrada, snapshot: { id: 9, cuentas_usadas: 4, cuentas_mapeadas: 4 } };
  const tras = [res[0], { ...res[1], estado: 'CONFIRMED' }];                                     // tras la confirmación automática
  const P = L.pasos({ ...d, resultados: tras });
  assert.equal(P[3].estado, 'listo'); assert.equal(L.pasoActivo(P, 4), 5);                       // el paso 4 no se abre
  const P2 = L.pasos({ ...d, resultados: [...tras, res[2], res[3]] });                          // queda algo que exige decisión
  assert.equal(P2[3].estado, 'revisar'); assert.equal(L.pasoActivo(P2, 4), 4);
});
