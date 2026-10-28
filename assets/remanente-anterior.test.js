// Pruebas de assets/remanente-anterior.js · ejecutar: node --test assets/remanente-anterior.test.js  (datos 100% ficticios)
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('./remanente-anterior.js');

test('período anterior: mes normal y cambio de año', () => {
  assert.equal(R.periodoAnterior('2026-10'), '2026-09');
  assert.equal(R.periodoAnterior('2027-01'), '2026-12');
  assert.equal(R.periodoAnterior('2026-1'), null);
  assert.equal(R.nombreMes('2026-09'), 'septiembre 2026');
});

test('mes anterior validado: manda su remanente (igual que hoy)', () => {
  const r = R.resolver({ periodo: '2026-11', lecturaOk: true, filaAnterior: { ivaRemanenteSig: 350000, estadoContable: 'completado' } });
  assert.equal(r.fuente, 'mes_anterior'); assert.equal(r.monto, 350000); assert.equal(r.bloquea, false); assert.equal(r.aviso, '');
});

test('mes anterior existe pero sin validar: usa su valor y avisa, sin bloquear', () => {
  const r = R.resolver({ periodo: '2026-11', lecturaOk: true, filaAnterior: { ivaRemanenteSig: null, estadoContable: null } });
  assert.equal(r.fuente, 'mes_anterior_sin_validar'); assert.equal(r.monto, 0); assert.equal(r.bloquea, false);
  assert.match(r.aviso, /octubre 2026 no está validado/);
});

test('el mes anterior manda aunque haya un manual guardado', () => {
  const r = R.resolver({ periodo: '2026-10', lecturaOk: true, filaAnterior: { ivaRemanenteSig: 10, estadoContable: 'completado' },
    ajustes: { remanente_anterior_manual: { monto: 999 } } });
  assert.equal(r.fuente, 'mes_anterior'); assert.equal(r.monto, 10);
});

test('sin mes anterior y sin manual: FALTA, monto 0 solo como marcador y bloquea (no más 0 en silencio)', () => {
  const r = R.resolver({ periodo: '2026-10', lecturaOk: true, filaAnterior: null, ajustes: {} });
  assert.equal(r.fuente, 'falta'); assert.equal(r.bloquea, true); assert.equal(r.monto, 0);
  assert.match(r.aviso, /Falta el remanente de septiembre 2026/);
});

test('sin mes anterior y error de lectura: sin_lectura y bloquea', () => {
  const r = R.resolver({ periodo: '2026-10', lecturaOk: false, filaAnterior: null, ajustes: null });
  assert.equal(r.fuente, 'sin_lectura'); assert.equal(r.bloquea, true);
});

test('manual registrado: se usa, no bloquea y el aviso dice "ingresado a mano" con quién, cuándo y motivo', () => {
  const r = R.resolver({ periodo: '2026-10', lecturaOk: true, filaAnterior: null,
    ajustes: { remanente_anterior_manual: { monto: 1234567, usuario_nombre: 'Analista Ficticia', registrado_at: '2026-10-30T15:00:00Z', motivo: 'F29 septiembre, código 77' } } });
  assert.equal(r.fuente, 'manual'); assert.equal(r.monto, 1234567); assert.equal(r.bloquea, false);
  assert.match(r.aviso, /^Remanente ingresado a mano por Analista Ficticia el 30-10-2026 · F29 septiembre/);
});

test('manual en 0 es válido (cliente sin remanente)', () => {
  const r = R.resolver({ periodo: '2026-10', lecturaOk: true, filaAnterior: null, ajustes: { remanente_anterior_manual: { monto: 0 } } });
  assert.equal(r.fuente, 'manual'); assert.equal(r.monto, 0); assert.equal(r.bloquea, false);
});

test('manual corrupto (negativo / texto) no cuenta: sigue faltando', () => {
  for (const m of [-5, 'abc', null]) {
    const r = R.resolver({ periodo: '2026-10', lecturaOk: true, filaAnterior: null, ajustes: { remanente_anterior_manual: { monto: m } } });
    assert.equal(r.fuente, 'falta', String(m));
  }
});
