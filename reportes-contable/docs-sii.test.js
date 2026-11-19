// node --test reportes-contable/docs-sii.test.js  (datos 100 % ficticios) — resumen automático SII del Reporte Contable (19-11)
'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const S = require('./docs-sii.js');
const R = { conexion: { estado: 'conectada' }, datos_al: '2026-11-19T10:00:00Z', avisos: ['compras_pendientes'],
  ventas: { documentos: 4, neto: 130000, exento: 40000, iva: 24700, total: 194700, por_tipo: { '33': { n: 2, neto: 150000, exento: 0, iva: 28500, total: 178500 }, '61': { n: 1, neto: -20000, exento: 0, iva: -3800, total: -23800 }, '34': { n: 1, neto: 0, exento: 40000, iva: 0, total: 40000 } } },
  compras: { registro: { documentos: 2, neto: 70000, exento: 0, iva: 13300, total: 83300 }, pendiente: { documentos: 1, iva: 950, total: 5950 }, reclamado: { documentos: 0 }, por_tipo: { '33': { n: 1, neto: 80000, iva: 15200, total: 95200 }, '61': { n: 1, neto: -10000, iva: -1900, total: -11900 } } },
  honorarios: { honorarios_recibidos: { documentos: 1, bruto: 100000, retencion: 13750 }, honorarios_emitidos: { documentos: 0, bruto: 0, retencion: 0 } } };

test('resumen: totales por libro, IVA, honorarios (líquido = bruto − retención) y fecha en hora de Chile', () => {
  const r = S.resumir(R);
  assert.equal(r.conectado, true); assert.equal(r.hayDatos, true);
  assert.deepEqual([r.ventas.documentos, r.ventas.neto, r.ventas.iva, r.ventas.total], [4, 130000, 24700, 194700]);
  assert.deepEqual([r.compras.documentos, r.compras.iva, r.compras.total], [2, 13300, 83300]);
  assert.deepEqual(r.compras.otros, [{ estado: 'pendiente', etiqueta: 'Pendiente', documentos: 1, iva: 950, total: 5950 }], 'reclamado con 0 no aparece');
  assert.deepEqual([r.honorarios.bruto, r.honorarios.retencion, r.honorarios.liquido, r.honorarios.emitidas], [100000, 13750, 86250, 0]);
  assert.equal(r.datosAlTxt, '19-11-2026, 07:00', '10:00 UTC = 07:00 en Chile (UTC−3)');
});
test('desglose por tipo del resumen: ordenado por código, NC marcada como resta con montos negativos', () => {
  const t = S.resumir(R).ventas.porTipo;
  assert.deepEqual(t.map((x) => x.tipo), [33, 34, 61]);
  assert.deepEqual([t[2].nombre, t[2].resta, t[2].neto, t[2].iva], ['Nota de crédito electrónica', true, -20000, -3800]);
});
test('sin conexión: no conectado y sin datos; cobertura incompleta se avisa', () => {
  const r = S.resumir({ conexion: { estado: 'sin_conexion' }, ventas: null, compras: null });
  assert.equal(r.conectado, false); assert.equal(r.hayDatos, false);
  assert.equal(S.resumir({ ...R, avisos: ['cobertura_incompleta'] }).incompleto, true);
  assert.equal(S.resumir(null).conectado, false);
});
const DOCS = [
  { tipo_dte: 33, folio: 101, fecha: '2026-09-03', rut: '11111111-1', razon_social: 'Cliente Uno', neto: 100000, exento: 0, iva: 19000, total: 119000, signo: 1, estado: 'registro' },
  { tipo_dte: 33, folio: 102, fecha: '2026-09-10', rut: '22222222-2', razon_social: null, neto: 50000, exento: 0, iva: 9500, total: 59500, signo: 1, estado: 'registro' },
  { tipo_dte: 61, folio: 7, fecha: '2026-09-15', rut: '11111111-1', razon_social: 'Cliente Uno', neto: 20000, exento: 0, iva: 3800, total: 23800, signo: -1, estado: 'registro' },
  { tipo_dte: 34, folio: 900, fecha: '2026-09-20', rut: '33333333-3', neto: 0, exento: 40000, iva: 0, total: 40000, signo: 1, estado: 'registro' }];
test('agrupar por tipo: cantidades, NC RESTA (aunque venga sin signo) y totales cuadran con el resumen', () => {
  const a = S.agrupar(DOCS, 'venta');
  assert.deepEqual(a.grupos.map((g) => [g.tipo, g.n]), [[33, 2], [34, 1], [61, 1]]);
  assert.deepEqual([a.grupos[2].neto, a.grupos[2].iva, a.grupos[2].resta], [-20000, -3800, true]);
  assert.deepEqual([a.totales.n, a.totales.neto, a.totales.exento, a.totales.iva, a.totales.total], [4, 130000, 40000, 24700, 194700]);
  const sinSigno = S.agrupar([{ ...DOCS[2], signo: undefined }], 'venta');
  assert.equal(sinSigno.totales.iva, -3800, 'tipo 61 resta aunque falte el signo');
});
test('compras: solo las REGISTRADAS suman; pendientes/reclamadas van aparte', () => {
  const a = S.agrupar([{ ...DOCS[0], estado: 'registro' }, { ...DOCS[1], estado: 'pendiente' }, { ...DOCS[2], estado: 'reclamado' }], 'compra');
  assert.equal(a.totales.n, 1); assert.equal(a.totales.iva, 19000);
  assert.deepEqual(a.aparte.map((d) => d.etiqueta), ['Pendiente', 'Reclamada']);
});
test('honorarios: bruto, retención y líquido; anuladas no suman', () => {
  const a = S.agrupar([{ tipo_dte: 0, folio: 41, total: 100000, retencion: 13750, neto: 86250, estado: 'vig' }, { tipo_dte: 0, folio: 42, total: 50000, retencion: 6875, estado: 'anu' }], 'honorarios');
  assert.deepEqual([a.totales.n, a.totales.total, a.totales.retencion], [1, 100000, 13750]);
  assert.equal(a.grupos[0].docs[0].liquido, 86250); assert.equal(a.aparte.length, 1);
});
test('montos en CLP con separador de miles; errores: no instalada / sin permiso / otro', () => {
  assert.equal(S.pesos(1234567), '$1.234.567'); assert.equal(S.pesos(-23800), '-$23.800'); assert.equal(S.pesos(null), '—');
  assert.equal(S.clasificarError({ status: 404 }), 'no_disponible'); assert.equal(S.clasificarError({ code: 'PGRST202' }), 'no_disponible');
  assert.equal(S.clasificarError({ code: '42883' }), 'no_disponible'); assert.equal(S.clasificarError({ code: '42501' }), 'sin_permiso');
  assert.equal(S.clasificarError({ status: 500 }), 'error');
});
test('leerResumen / leerDocumentos: llaman a las RPC con cliente, período y libro; caché por cliente+período', async () => {
  S._limpiarCache(); const llam = [];
  const f = (p, o) => { llam.push([p, JSON.parse(o.body)]); return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(p.includes('preiva') ? R : { documentos: DOCS })) }); };
  const a = await S.leerResumen(9001, '2026-09', f); await S.leerResumen(9001, '2026-09', f);
  assert.equal(a.estado, 'ok'); assert.equal(llam.length, 1, 'segunda vez desde caché');
  assert.deepEqual(llam[0], ['rpc/sii_preiva_periodo', { p_cliente_id: 9001, p_periodo: '2026-09' }]);
  const d = await S.leerDocumentos(9001, '2026-09', 'venta', f);
  assert.deepEqual(llam[1], ['rpc/sii_documentos_periodo', { p_cliente_id: 9001, p_periodo: '2026-09', p_libro: 'venta' }]);
  assert.equal(d.d.documentos.length, 4);
  S._limpiarCache();
  const mal = (p) => Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve('{"code":"PGRST202"}') });
  assert.equal((await S.leerDocumentos(1, '2026-09', 'venta', mal)).estado, 'no_disponible');
  const prohib = () => Promise.resolve({ ok: false, status: 403, text: () => Promise.resolve('{"code":"42501","message":"SIN_PERMISO"}') });
  assert.equal((await S.leerResumen(2, '2026-09', prohib)).estado, 'sin_permiso');
  assert.equal((await S.leerResumen(3, '2026-09', () => Promise.reject(new Error('red')))).estado, 'error');
});
