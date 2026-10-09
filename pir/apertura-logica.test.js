// Pruebas de pir/apertura-logica.js · ejecutar: node --test pir/apertura-logica.test.js  (datos 100% sintéticos)
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('./apertura-logica.js');

const F22 = 4, REG = 9;
function propuesta() {
  const codigos = { 'opening.previous_year_tax_loss': '1440', 'opening.cpts': '1545', 'opening.cpts_negative': '1546', 'opening.rai': '1484',
    'opening.rex': '1486+1487', 'opening.sac.no_sujeto_restitucion.sin_devolucion': '1563', 'opening.sac.no_sujeto_restitucion.con_devolucion': '1564',
    'opening.sac.sujeto_restitucion.sin_devolucion': '1565', 'opening.sac.sujeto_restitucion.con_devolucion': '1566', 'opening.sac.ipe': '1567',
    'opening.capital_aportado_historico': '1494' };
  return L.CLAVES.map(([k]) => codigos[k]
    ? { item_key: k, estado: 'OK', provenance: 'DECLARED_F22', monto: k === 'opening.rai' ? 4000000 : 0, evidencia_fuente_id: F22, f22_codigo_ref: codigos[k] }
    : { item_key: k, estado: 'PENDING', provenance: 'DECLARED_F22', monto: null, evidencia_fuente_id: F22, f22_codigo_ref: null, nota: 'No determinable desde el F22' });
}
const LECT = { id: 1, estado: 'PROPUESTA', blocking_count: 0, fuente_id: F22 };
const CASO = { id: 2, anio_tributario: 2027 };
const fila = (filas, k) => filas.find((f) => f.clave === k);
const conNotaPendientes = (filas) => filas.map((f) => f.prop.estado === 'PENDING' ? L.decidir(f, { tipo: 'PENDIENTE', nota: 'Se resuelve después' }).fila : f);

test('PROPUESTA → 13 filas con etiqueta en español y en orden fijo', () => {
  const filas = L.filasDesdePropuesta(propuesta());
  assert.equal(filas.length, 13);
  assert.equal(fila(filas, 'opening.rai').concepto, 'RAI');
  assert.equal(filas[0].concepto, 'Pérdida tributaria de arrastre');
  assert.ok(filas.every((f) => f.concepto && !f.concepto.startsWith('opening.')));
});

test('BLOQUEADO → Declarar deshabilitado aunque las filas estén bien', () => {
  const filas = conNotaPendientes(L.filasDesdePropuesta(propuesta()));
  const r = L.evaluarDeclaracion({ ...LECT, estado: 'BLOQUEADO', blocking_count: 2 }, filas, 'Apertura AT2026');
  assert.equal(r.ok, false);
  assert.match(r.motivos.join(' '), /bloqueos/);
});

test('OK DECLARED_F22 → el monto viaja igual al propuesto, no se edita', () => {
  const filas = L.filasDesdePropuesta(propuesta());
  const it = L.itemDeFila(fila(filas, 'opening.rai'));
  assert.deepEqual(it, { item_key: 'opening.rai', estado: 'OK', provenance: 'DECLARED_F22', monto: 4000000, f22_codigo_ref: '1484' });
  // aunque alguien intente pasar un monto con la opción F22, se ignora
  const d = L.decidir(fila(filas, 'opening.rai'), { tipo: 'F22', monto: 1 }).fila;
  assert.equal(L.itemDeFila(d).monto, 4000000);
});

test('REVIEW → conserva monto y código; exige nota', () => {
  const f = fila(L.filasDesdePropuesta(propuesta()), 'opening.rai');
  const sin = L.decidir(f, { tipo: 'REVISAR', nota: ' ' }).fila;
  assert.ok(L.erroresFila(sin, F22).length);
  const con = L.decidir(f, { tipo: 'REVISAR', nota: 'Confirmar con registro RAI', monto: 5 }).fila;
  assert.deepEqual(L.erroresFila(con, F22), []);
  const it = L.itemDeFila(con);
  assert.equal(it.estado, 'REVIEW'); assert.equal(it.monto, 4000000); assert.equal(it.f22_codigo_ref, '1484'); assert.equal(it.provenance, 'DECLARED_F22');
});

test('PENDING del lector → la nota del analista arranca vacía (la del lector no cuenta)', () => {
  const f = fila(L.filasDesdePropuesta(propuesta()), 'opening.ppm_to_recover');
  assert.equal(f.decision.tipo, 'PENDIENTE'); assert.equal(f.decision.nota, '');
  assert.match(L.erroresFila(f, F22).join(' '), /nota/);
});

test('PENDING → monto NULL + nota obligatoria + conserva el código F22 de origen', () => {
  const f = fila(L.filasDesdePropuesta(propuesta()), 'opening.rai');
  const sin = L.decidir(f, { tipo: 'PENDIENTE', nota: '' }).fila;
  assert.match(L.erroresFila(sin, F22).join(' '), /nota/);
  const con = L.decidir(f, { tipo: 'PENDIENTE', nota: 'Falta el registro RAI' }).fila;
  const it = L.itemDeFila(con);
  assert.equal(it.monto, null); assert.equal(it.estado, 'PENDING'); assert.equal(it.f22_codigo_ref, '1484'); assert.equal(it.nota, 'Falta el registro RAI');
});

test('NOT_APPLICABLE no se ofrece sobre un monto que el F22 propuso', () => {
  const f = fila(L.filasDesdePropuesta(propuesta()), 'opening.rai');
  assert.ok(!L.opciones(f).includes('NO_APLICA'));
  assert.ok(L.decidir(f, { tipo: 'NO_APLICA', nota: 'x' }).error);
});

test('Editar el monto → obliga a cambiar la procedencia (no existe "F22 con otro monto")', () => {
  const f = fila(L.filasDesdePropuesta(propuesta()), 'opening.rai');
  const d = L.decidir(f, { tipo: 'OTRA', monto: 3500000, evidencia_fuente_id: REG }).fila;   // sin procedencia
  assert.match(L.erroresFila(d, F22).join(' '), /de dónde sale/);
  const d2 = L.decidir(f, { tipo: 'OTRA', provenance: 'DECLARED_F22', monto: 3500000, evidencia_fuente_id: REG }).fila;
  assert.match(L.erroresFila(d2, F22).join(' '), /de dónde sale/);
});

test('REGISTER sin evidencia → no se puede declarar', () => {
  const filas = conNotaPendientes(L.filasDesdePropuesta(propuesta()));
  const i = filas.findIndex((f) => f.clave === 'opening.rai');
  filas[i] = L.decidir(filas[i], { tipo: 'OTRA', provenance: 'REGISTER', monto: 3500000 }).fila;
  assert.match(L.erroresFila(filas[i], F22).join(' '), /respaldo/);
  assert.equal(L.evaluarDeclaracion(LECT, filas, 'Apertura').ok, false);
  // el F22 no sirve como "otra evidencia"
  filas[i] = L.decidir(filas[i], { tipo: 'OTRA', provenance: 'REGISTER', monto: 3500000, evidencia_fuente_id: F22 }).fila;
  assert.match(L.erroresFila(filas[i], F22).join(' '), /distinto del F22/);
});

test('REGISTER con evidencia → el item se construye con otro monto y sin código F22', () => {
  const f = fila(L.filasDesdePropuesta(propuesta()), 'opening.rai');
  const d = L.decidir(f, { tipo: 'OTRA', provenance: 'REGISTER', monto: '3500000', evidencia_fuente_id: REG, nota: 'Registro RAI 2025' }).fila;
  assert.deepEqual(L.erroresFila(d, F22), []);
  assert.deepEqual(L.itemDeFila(d), { item_key: 'opening.rai', estado: 'OK', provenance: 'REGISTER', monto: 3500000, evidencia_fuente_id: REG, f22_codigo_ref: null, nota: 'Registro RAI 2025' });
});

for (const [k, nombre] of [['opening.ppm_to_recover', 'PPM'], ['opening.deferred_income_pending', 'ingreso diferido']]) {
  test(nombre + ' PENDING → nunca un monto con DECLARED_F22', () => {
    const f = fila(L.filasDesdePropuesta(propuesta()), k);
    assert.deepEqual(L.opciones(f), ['PENDIENTE', 'OTRA']);
    assert.ok(L.decidir(f, { tipo: 'F22' }).error);
    assert.ok(L.decidir(f, { tipo: 'REVISAR', nota: 'x' }).error);
    const p = L.itemDeFila(L.decidir(f, { tipo: 'PENDIENTE', nota: 'Sin dato' }).fila);
    assert.equal(p.monto, null); assert.equal(p.provenance, 'DECLARED_F22');
    const c = L.itemDeFila(L.decidir(f, { tipo: 'OTRA', provenance: 'CERTIFICATE', monto: 120000, evidencia_fuente_id: REG }).fila);
    assert.equal(c.provenance, 'CERTIFICATE'); assert.equal(c.monto, 120000);
  });
}

test('Declarar → payload de 6 argumentos con lectura_id y AT de origen', () => {
  const filas = conNotaPendientes(L.filasDesdePropuesta(propuesta()));
  assert.equal(L.evaluarDeclaracion(LECT, filas, '').ok, false);   // sin motivo no
  const ev = L.evaluarDeclaracion(LECT, filas, 'Apertura desde F22 AT2026');
  assert.equal(ev.ok, true, ev.motivos.join(' | '));
  const p = L.payloadDeclarar(CASO, LECT, filas, ' Apertura desde F22 AT2026 ');
  assert.deepEqual(Object.keys(p).sort(), ['p_anio_tributario_origen', 'p_caso_id', 'p_fuente_f22_id', 'p_items', 'p_lectura_id', 'p_motivo']);
  assert.equal(p.p_lectura_id, 1); assert.equal(p.p_fuente_f22_id, F22); assert.equal(p.p_anio_tributario_origen, 2026); assert.equal(p.p_items.length, 13);
  assert.ok(p.p_items.every((i) => !('valor_json' in i) || i.valor_json === null));
});

test('La base rechaza una manipulación → mensaje claro (la edición la conserva la pantalla)', () => {
  assert.match(L.mensajeError('LECTURA_F22_DATO_NO_COINCIDE: opening.rai'), /no coincide/);
  assert.match(L.mensajeError('LECTURA_F22_INVALIDA: bloqueada'), /Vuelve a leer/);
  assert.match(L.mensajeError('CPTS_INCOHERENTE'), /CPTS/);
  // decidir() nunca muta la fila original: la edición previa sigue disponible para reintentar
  const f = fila(L.filasDesdePropuesta(propuesta()), 'opening.rai');
  const antes = JSON.stringify(f); L.decidir(f, { tipo: 'PENDIENTE', nota: 'x' });
  assert.equal(JSON.stringify(f), antes);
});

const W = (porId, estados) => ({ apertura_id: 7, version: 1, estado: 'OPENING_DECLARED_NOT_FULLY_RECONSTRUCTED', declarado_por: porId,
  items: L.CLAVES.map(([k], i) => ({ item_key: k, estado: estados[i] || 'OK' })) });

test('working DECLARED → estado y títulos correctos', () => {
  const v = L.vistaVersiones({ estado: 'OPENING_DECLARED_NOT_FULLY_RECONSTRUCTED', working: W(1, []), effective: null });
  assert.equal(v.titulo, 'Apertura declarada (en revisión)'); assert.ok(v.enRevision); assert.equal(v.efectiva, null);
});

test('Master distinto → puede verificar con 0 REVIEW/PENDING; con pendientes no', () => {
  const vig = { working: W(1, []) };
  assert.deepEqual(L.evaluarVerificacion(vig, { id: 2, es_master: true }), { mostrar: true, ok: true, motivo: null });
  const r = L.evaluarVerificacion({ working: W(1, ['PENDING', 'REVIEW']) }, { id: 2, es_master: true });
  assert.equal(r.ok, false); assert.match(r.motivo, /Quedan 2/);
  assert.equal(L.evaluarVerificacion(vig, { id: 3, es_master: false }).mostrar, false);   // no Master: no se muestra
});

test('mismo Master que declaró → doble control visible', () => {
  const r = L.evaluarVerificacion({ working: W(1, []) }, { id: 1, es_master: true });
  assert.equal(r.ok, false); assert.equal(r.doble_control, true); assert.match(r.motivo, /Doble control/);
});

test('efectiva + en revisión → ambas versiones visibles', () => {
  const v = L.vistaVersiones({ estado: 'OPENING_VERIFIED_WITH_PENDING_REVISION', effective: { apertura_id: 5, version: 1 }, working: W(1, []) });
  assert.ok(v.efectiva && v.enRevision); assert.match(v.titulo, /nueva versión en revisión/);
});

test('formato de montos chileno', () => {
  assert.equal(L.formatoMonto(4000000), '$4.000.000');
  assert.equal(L.formatoMonto(null), null);
});
