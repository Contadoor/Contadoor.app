// REM-ANT-1 · el Panel (reporte al cliente) usa el remanente ingresado a mano cuando no existe el mes anterior.
// Funciones REALES extraídas de panel-de-control/index.html. Ejecutar: node --test panel-de-control/remanente-panel.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const HTML = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
function extraer(n) {
  const i = HTML.indexOf('function ' + n + '('); assert.ok(i >= 0, n);
  let k = HTML.indexOf('{', i), p = 0; for (; k < HTML.length; k++) { if (HTML[k] === '{') p++; else if (HTML[k] === '}' && --p === 0) break; }
  return HTML.slice(i, k + 1);
}
const ctx = {}; vm.createContext(ctx);
vm.runInContext(['_rpRutKey', '_rpRemManual', '_rpAntDe'].map(extraer).join('\n'), ctx);
const MAN = { preF29Ajustes: { remanente_anterior_manual: { monto: 400000 } } };

test('con fila del mes anterior: manda esa fila (aunque haya manual)', () => {
  const r = ctx._rpAntDe(Object.assign({ rut: '11.111.111-1' }, MAN), { ok: true, porRut: { '11111111-1': 250000 } });
  assert.equal(r.remanente, 250000);
});
test('fila del mes anterior con remanente nulo cuenta como existente (0), no como manual', () => {
  const r = ctx._rpAntDe(Object.assign({ rut: '11111111-1' }, MAN), { ok: true, porRut: { '11111111-1': null } });
  assert.equal(r.remanente, 0); assert.equal(r.manual, undefined);
});
test('sin fila del mes anterior: usa el manual', () => {
  const r = ctx._rpAntDe(Object.assign({ rut: '11111111-1' }, MAN), { ok: true, porRut: {} });
  assert.equal(r.ok, true); assert.equal(r.remanente, 400000); assert.equal(r.manual, true);
});
test('sin fila y sin manual: 0 como antes (los reportes viejos no cambian)', () => {
  assert.equal(ctx._rpAntDe({ rut: '11111111-1' }, { ok: true, porRut: {} }).remanente, 0);
});
test('lectura fallida: no se puede calcular', () => {
  assert.equal(ctx._rpAntDe(Object.assign({ rut: '11111111-1' }, MAN), { ok: false }).ok, false);
});
