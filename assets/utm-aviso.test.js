// Pruebas de assets/utm-aviso.js (UTM-AVISO-1) · ejecutar: node --test assets/utm-aviso.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const U = require('./utm-aviso.js');

test('falta la UTM del mes en curso → aviso rojo', () => {
  const a = U.evaluar(['2026-10', '2026-11'], new Date(2026, 11, 2, 10));
  assert.equal(a.nivel, 'falta');
  assert.equal(a.mes, '2026-12');
  assert.match(a.texto, /diciembre 2026/);
});

test('mes en curso registrado y faltan más de 5 días → sin aviso', () => {
  assert.equal(U.evaluar(['2026-10', '2026-11'], new Date(2026, 10, 19, 10)), null);
});

test('últimos 5 días del mes y falta la del siguiente → aviso ámbar', () => {
  const a = U.evaluar(['2026-11'], new Date(2026, 10, 27, 10));
  assert.equal(a.nivel, 'pronto');
  assert.equal(a.mes, '2026-12');
});

test('cambio de año: 29-12 sin UTM de enero → ámbar con enero 2027', () => {
  const a = U.evaluar(['2026-12'], new Date(2026, 11, 29, 10));
  assert.equal(a.mes, '2027-01');
});

test('lista vacía → falta la del mes en curso', () => {
  assert.equal(U.evaluar([], new Date(2026, 0, 15)).nivel, 'falta');
});

test('montar sin red o con error no rompe y no muestra nada', async () => {
  assert.equal(await U.montar(null, {}), null);
  const fake = { insertBefore() { throw new Error('no debería'); }, firstChild: null };
  assert.equal(await U.montar(fake, { fetcher: async () => { throw new Error('red'); } }), null);
  assert.equal(await U.montar(fake, { fetcher: async () => ({ ok: false }) }), null);
});
