// Pruebas de assets/remanente-anterior.js (REM-ANT-2) · ejecutar: node --test assets/remanente-anterior.test.js  (datos 100% ficticios)
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('./remanente-anterior.js');
const UTM = { mes_utm_origen: '2026-10', utm_origen: 69000, mes_utm_destino: '2026-11', utm_destino: 69500, metodo: 'ART27_UTM_V1' };

test('período anterior y nombres', () => {
  assert.equal(R.periodoAnterior('2026-10'), '2026-09');
  assert.equal(R.periodoAnterior('2027-01'), '2026-12');
  assert.equal(R.nombreMes('2026-09'), 'septiembre 2026');
  assert.equal(R.pesos(1007246), '$1.007.246');
});

test('CONOCIDO desde el mes anterior: usa el 504 (reajustado), muestra 77 y 504', () => {
  const r = R.resolver({ periodo: '2026-10', lecturaOk: true, info: Object.assign({ estado: 'CONOCIDO', fuente: 'MES_ANTERIOR', cod77: 1000000, cod504: 1007246 }, UTM) });
  assert.equal(r.monto, 1007246); assert.equal(r.cod77, 1000000); assert.equal(r.fuente, 'mes_anterior'); assert.equal(r.bloquea, false);
  assert.equal(r.detalle, 'Cód. 77 de septiembre 2026: $1.000.000 × UTM noviembre 2026 $69.500 ÷ UTM octubre 2026 $69.000 = cód. 504 $1.007.246');
});

test('CONOCIDO manual: aviso "ingresado a mano" con quién, cuándo y motivo', () => {
  const r = R.resolver({ periodo: '2026-10', lecturaOk: true, info: Object.assign({ estado: 'CONOCIDO', fuente: 'F29_MANUAL', cod77: 1000000, cod504: 1007246,
    manual: { usuario_nombre: 'Analista Ficticia', registrado_at: '2026-10-30T15:00:00Z', motivo: 'F29 sept., cód. 77' } }, UTM) });
  assert.equal(r.fuente, 'manual'); assert.equal(r.monto, 1007246); assert.equal(r.bloquea, false);
  assert.match(r.aviso, /^Remanente ingresado a mano por Analista Ficticia el 30-10-2026 · F29 sept/);
});

test('cero confirmado: CONOCIDO con 77 = 0 → monto 0 y NO bloquea', () => {
  const r = R.resolver({ periodo: '2026-10', lecturaOk: true, info: Object.assign({ estado: 'CONOCIDO', fuente: 'F29_MANUAL', cod77: 0, cod504: 0, manual: {} }, UTM) });
  assert.equal(r.monto, 0); assert.equal(r.bloquea, false); assert.equal(r.cod77, 0);
});

test('SIN_DATO (sin mes anterior): bloquea, aviso de falta; monto 0 solo como marcador', () => {
  const r = R.resolver({ periodo: '2026-10', lecturaOk: true, info: { estado: 'SIN_DATO', motivo: 'SIN_MES_ANTERIOR' } });
  assert.equal(r.bloquea, true); assert.equal(r.fuente, 'falta'); assert.equal(r.cod77, null);
  assert.match(r.aviso, /Falta el remanente de septiembre 2026.*código 77/);
});

test('SIN_DATO por UTM faltante / mes sin validar / mes sin monto: bloquea con el motivo', () => {
  assert.match(R.resolver({ periodo: '2026-11', lecturaOk: true, info: { estado: 'SIN_DATO', motivo: 'SIN_UTM', falta_utm: ['2026-12'] } }).aviso, /UTM oficial de diciembre 2026/);
  assert.match(R.resolver({ periodo: '2026-11', lecturaOk: true, info: { estado: 'SIN_DATO', motivo: 'MES_ANTERIOR_SIN_VALIDAR' } }).aviso, /octubre 2026 no está validado/);
  const r = R.resolver({ periodo: '2026-11', lecturaOk: true, info: { estado: 'SIN_DATO', motivo: 'MES_ANTERIOR_SIN_MONTO' } });
  assert.equal(r.bloquea, true); assert.match(r.aviso, /vacío no es \$0/);
});

test('CONFLICTO: bloquea, muestra ambos 77 y no usa ninguno en silencio', () => {
  const r = R.resolver({ periodo: '2026-10', lecturaOk: true, info: Object.assign({ estado: 'CONFLICTO', fuente: 'F29_MANUAL', cod77: 1000000, cod504: 1007246, mes_anterior_cod77: 900000, manual: {} }, UTM) });
  assert.equal(r.bloquea, true); assert.equal(r.fuente, 'conflicto'); assert.deepEqual(r.conflicto, { manual: 1000000, mesAnterior: 900000 });
  assert.match(r.aviso, /\$900\.000 y el ingresado a mano es \$1\.000\.000/);
});

test('lectura fallida o sin respuesta: sin_lectura y bloquea', () => {
  assert.equal(R.resolver({ periodo: '2026-10', lecturaOk: false, info: null }).fuente, 'sin_lectura');
  assert.equal(R.resolver({ periodo: '2026-10', info: null }).bloquea, true);
});

test('CONOCIDO con montos corruptos (negativo / texto / nulo) no se acepta', () => {
  for (const v of [-5, 'abc', null, 1.5]) {
    const r = R.resolver({ periodo: '2026-10', lecturaOk: true, info: Object.assign({ estado: 'CONOCIDO', fuente: 'MES_ANTERIOR', cod77: v, cod504: v }, UTM) });
    assert.equal(r.bloquea, true, String(v));
  }
});
