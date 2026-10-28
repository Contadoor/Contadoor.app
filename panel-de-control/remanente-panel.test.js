// REM-ANT-2 · el Panel (reporte al cliente) usa el cód. 504 que calcula la base y NUNCA un 0 silencioso:
// sin remanente CONOCIDO el F29 queda "pendiente" con el motivo, y el reporte no se arma (regla existente de _completo).
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
const ctx = { ff: (n) => '$' + n }; ctx.window = ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'assets', 'remanente-anterior.js'), 'utf8'), ctx);
vm.runInContext(['_rpRutKey', '_rpAntInfo', '_rpAntDe', '_rpMonto', '_rpF29'].map(extraer).join('\n'), ctx);
const UTM = { mes_utm_origen: '2026-10', utm_origen: 69000, mes_utm_destino: '2026-11', utm_destino: 69500, periodo: '2026-10', periodo_anterior: '2026-09' };
const OK = Object.assign({ estado: 'CONOCIDO', fuente: 'F29_MANUAL', cod77: 1000000, cod504: 1007246 }, UTM);
// Reporte validado: débito 500.000, crédito 200.000 → remanente siguiente = 1.007.246 − 300.000 = 707.246
const REP = { rut: '11.111.111-1', periodo: '2026-10', estadoContable: 'completado', tieneCont: true, tieneRrhh: false, iuSii: 0,
  ivaDebito: 500000, ivaCredito: 200000, ivaRemanenteSig: 707246, ivaPostergado: 0, ppm: 10000, retHon: 0, otrosImp: 0, postergarIva: false };

test('CONOCIDO: usa el cód. 504 y el F29 cuadra', () => {
  const f = ctx._rpF29(REP, ctx._rpAntDe(REP, { ok: true, porRut: { '11111111-1': OK } }));
  assert.equal(f.estado, 'ok'); assert.equal(f.remanenteAnterior, 1007246); assert.equal(f.remanenteSiguiente, 707246);
});
test('cero confirmado (77 = 0): ok con remanente 0', () => {
  const r = Object.assign({}, REP, { ivaRemanenteSig: 0 });
  const f = ctx._rpF29(r, ctx._rpAntDe(r, { ok: true, porRut: { '11111111-1': Object.assign({}, OK, { cod77: 0, cod504: 0 }) } }));
  assert.equal(f.estado, 'ok'); assert.equal(f.remanenteAnterior, 0);
});
test('SIN_DATO: F29 pendiente con el motivo (no 0 silencioso)', () => {
  const f = ctx._rpF29(REP, ctx._rpAntDe(REP, { ok: true, porRut: { '11111111-1': Object.assign({ estado: 'SIN_DATO', motivo: 'SIN_MES_ANTERIOR' }, UTM) } }));
  assert.equal(f.estado, 'pendiente'); assert.match(f.motivo, /Remanente anterior sin confirmar: Falta el remanente de septiembre 2026/);
});
test('cliente sin respuesta de la base: pendiente', () => {
  assert.equal(ctx._rpF29(REP, ctx._rpAntDe(REP, { ok: true, porRut: {} })).estado, 'pendiente');
});
test('CONFLICTO: pendiente "en conflicto"', () => {
  const f = ctx._rpF29(REP, ctx._rpAntDe(REP, { ok: true, porRut: { '11111111-1': Object.assign({}, OK, { estado: 'CONFLICTO', mes_anterior_cod77: 900000 }) } }));
  assert.equal(f.estado, 'pendiente'); assert.match(f.motivo, /en conflicto/);
});
test('lectura fallida: pendiente', () => {
  assert.equal(ctx._rpF29(REP, ctx._rpAntDe(REP, { ok: false })).estado, 'pendiente');
});
test('el reporte NO se arma con el F29 pendiente (regla existente) y el historial usa la base', () => {
  assert.match(HTML, /if\(!d\._completo\)\{document\.getElementById\('rp-frame'\)\.outerHTML=.*El reporte no se genera mientras falte el F29/);
  assert.match(HTML, /var fh=_rpF29\(h,_rpAntInfo\(\(res\[4\]\|\|\[\]\)\[pAnt\.indexOf\(hp\)\]\)\);/);
  assert.match(extraer('_rpCargarAnterior'), /rpc\/remanentes_anteriores/);
});
test('REM-ANT-2B: montos con decimales → pendiente con el motivo (no se arma el reporte); enteros → ok', () => {
  const r = Object.assign({}, REP, { ivaDebito: 0.1, ivaCredito: 0.3, ivaRemanenteSig: 0.19999999999999998 });
  const f = ctx._rpF29(r, ctx._rpAntDe(r, { ok: true, porRut: { '11111111-1': Object.assign({}, OK, { cod77: 0, cod504: 0 }) } }));
  assert.equal(f.estado, 'pendiente'); assert.match(f.motivo, /decimales/);
  assert.equal(ctx._rpF29(REP, ctx._rpAntDe(REP, { ok: true, porRut: { '11111111-1': OK } })).estado, 'ok');
});
