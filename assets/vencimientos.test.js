// Pruebas de assets/vencimientos.js (RRHH-VENC-1) · ejecutar: node --test assets/vencimientos.test.js  (datos ficticios)
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const V = require('./vencimientos.js');

test('día 13 hábil se mantiene (período oct-2026 → pago vie 13-11-2026)', () => {
  const r = V.previred('2026-10', []);
  assert.equal(r.iso, '2026-11-13');
  assert.equal(r.movido, false);
  assert.equal(r.texto, '13 de noviembre de 2026');
});

test('día 13 en domingo → viernes 11 (período nov-2026 → dic-2026)', () => {
  const r = V.previred('2026-11', []);
  assert.equal(r.iso, '2026-12-11');
  assert.equal(r.movido, true);
});

test('día 13 feriado → hábil anterior; si el anterior también es feriado, sigue retrocediendo', () => {
  // mié 13-01-2027 ficticio feriado y mar 12 también → lun 11
  const r = V.previred('2026-12', ['2027-01-13', '2027-01-12']);
  assert.equal(r.iso, '2027-01-11');
});

test('cambio de año: período dic-2026 se paga en enero 2027', () => {
  assert.deepEqual(V.mesPago('2026-12'), { anio: 2027, mes: 1 });
  assert.equal(V.mesPago('malo'), null);
  assert.equal(V.previred('xx', []), null);
});

test('postergación día 10 en domingo → viernes 8 (período dic-2026 → ene-2027)', () => {
  const r = V.postergacion('2026-12', []);
  assert.equal(r.iso, '2027-01-08');
});

test('sin feriados cargados se avisa (sinFeriados) y solo corre por fin de semana', () => {
  V._reiniciar();
  const r = V.previred('2026-11');
  assert.equal(r.iso, '2026-12-11');
  assert.equal(r.sinFeriados, true);
});

test('cargarFeriados usa la base, marca el año y nunca rechaza', async () => {
  V._reiniciar();
  const fetcher = async () => ({ ok: true, json: async () => [{ fecha: '2026-12-08' }, { fecha: '2026-12-25' }] });
  assert.equal(await V.cargarFeriados([2026], fetcher), true);
  const r = V.previred('2026-10');
  assert.equal(r.sinFeriados, false);
  assert.equal(V.esHabil(new Date(2026, 11, 8, 12), undefined), false);
  const malo = async () => { throw new Error('red'); };
  V._reiniciar();
  assert.equal(await V.cargarFeriados([2027], malo), false);
  assert.equal(V.previred('2026-12').sinFeriados, true);
});
