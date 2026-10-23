// Pruebas del HOTFIX de proyección (horizonte = último día del mes tributario). Datos ficticios.
// Ejecutar: node --test pre-iva/proyeccion.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { horizonte } = require('./proyeccion.js');
const F = require('./f29-formula.js');

const dia = (a, m, d, h) => new Date(a, m - 1, d, h == null ? 12 : h, 0, 0);
// Cadena completa como en calcular(): débito, crédito, base PPM, PPM y F29 estimado.
function cadena(hoy, periodo, { debito, credito, remanente = 0, base = null, tasa = 0, diasT, diasTot } = {}) {
  const hz = horizonte({ hoy, periodo, diasTranscurridos: diasT, diasTotales: diasTot });
  const pry = F.proyectarMes({ debitoRegistrado: debito, creditoRegistrado: credito, diasTranscurridos: hz.diasTranscurridos, diasRestantes: hz.diasRestantesMes, esMesActual: hz.esMesActual });
  const b = F.calcularBasePPM({ debito, netoAfecto: base, exento: 0 });
  const baseProy = F.proyectarMes({ debitoRegistrado: b.base, creditoRegistrado: 0, diasTranscurridos: hz.diasTranscurridos, diasRestantes: hz.diasRestantesMes, esMesActual: hz.esMesActual }).debito;
  const ppm = F.calcularPPM(baseProy, tasa);
  const r = F.calcularF29Estimado({ debito: pry.debito, credito: pry.credito, remanente, ppm });
  return { hz, debito: pry.debito, credito: pry.credito, baseProy, ppm, f29: r.total, ivaPagar: r.ivaPagar };
}

test('control: 22-oct, $1.000.000 registrado → ~$1.409.091 (antes ~$2.272.727)', () => {
  const r = cadena(dia(2026, 10, 22), '202610', { debito: 1000000, credito: 0, diasT: 22, diasTot: 31 });
  assert.equal(r.debito, 1409091);
  assert.equal(r.hz.diasRestantesMes, 9);
  assert.equal(r.hz.diasVencF29, 29);                       // el vencimiento sigue siendo un dato aparte (20-11)
  assert.equal(r.hz.vencF29, '2026-11-20');
  // Lo que hacía el defecto: usar los días hasta el 20-11 (28 o 29 según la hora) → ~$2.272.727 – $2.318.182
  assert.equal(F.proyectarMes({ debitoRegistrado: 1000000, creditoRegistrado: 0, diasTranscurridos: 22, diasRestantes: 28, esMesActual: true }).debito, 2272727);
  assert.equal(F.proyectarMes({ debitoRegistrado: 1000000, creditoRegistrado: 0, diasTranscurridos: 22, diasRestantes: r.hz.diasVencF29, esMesActual: true }).debito, 2318182);
});

test('meses de 30 y 31 días y febrero bisiesto / no bisiesto', () => {
  assert.equal(cadena(dia(2026, 4, 15), '2026-04', { debito: 1500000, credito: 0 }).debito, 3000000);      // abril 30 días: ×30/15
  assert.equal(cadena(dia(2026, 10, 10), '2026-10', { debito: 1000000, credito: 0 }).debito, 3100000);     // octubre 31: ×31/10
  const feb27 = cadena(dia(2027, 2, 14), '202702', { debito: 1400000, credito: 700000 });
  assert.equal(feb27.hz.diasMes, 28); assert.equal(feb27.debito, 2800000); assert.equal(feb27.credito, 1400000);
  const feb28 = cadena(dia(2028, 2, 14), '202802', { debito: 1400000, credito: 0 });
  assert.equal(feb28.hz.diasMes, 29); assert.equal(feb28.debito, 2900000);
  assert.equal(horizonte({ hoy: dia(2027, 2, 14), periodo: '202702', diasTranscurridos: 14, diasTotales: 28 }).diasRestantesMes, 14);
});

test('día 1 y último día del mes', () => {
  const d1 = cadena(dia(2026, 10, 1), '202610', { debito: 100000, credito: 0 });
  assert.equal(d1.hz.diasTranscurridos, 1); assert.equal(d1.hz.diasRestantesMes, 30); assert.equal(d1.debito, 3100000);
  const ult = cadena(dia(2026, 10, 31), '202610', { debito: 2000000, credito: 500000 });
  assert.equal(ult.hz.diasRestantesMes, 0); assert.equal(ult.debito, 2000000); assert.equal(ult.credito, 500000);
});

test('cambio de año: diciembre en curso proyecta a fin de diciembre y vence el 20-01 del año siguiente', () => {
  const r = cadena(dia(2026, 12, 20), '202612', { debito: 2000000, credito: 0 });
  assert.equal(r.debito, 3100000);                          // ×31/20
  assert.equal(r.hz.vencF29, '2027-01-20'); assert.equal(r.hz.diasVencF29, 31);
  // Enero abierto en enero (mes en curso), y diciembre abierto en enero (mes cerrado)
  assert.equal(cadena(dia(2027, 1, 10), '202701', { debito: 1000000, credito: 0 }).debito, 3100000);
  const dic = cadena(dia(2027, 1, 10), '202612', { debito: 1000000, credito: 0 });
  assert.equal(dic.hz.esMesActual, false); assert.equal(dic.debito, 1000000); assert.equal(dic.hz.diasVencF29, 10);
});

test('mes cerrado: SIN extrapolación (débito, crédito, base PPM, PPM y F29 = registrado)', () => {
  const r = cadena(dia(2026, 10, 22), '202609', { debito: 1900000, credito: 900000, remanente: 300000, tasa: 1.5 });
  assert.equal(r.hz.esMesActual, false); assert.equal(r.hz.diasRestantesMes, 0);
  assert.equal(r.debito, 1900000); assert.equal(r.credito, 900000);
  assert.equal(r.baseProy, 10000000); assert.equal(r.ppm, 150000); assert.equal(r.f29, 850000);   // mismo resultado que la prueba de integración vigente
  // Un mes futuro tampoco se proyecta
  assert.equal(cadena(dia(2026, 10, 22), '202611', { debito: 500000, credito: 0 }).debito, 500000);
});

test('mes en curso: base PPM, PPM y F29 estimado con el horizonte corregido', () => {
  const r = cadena(dia(2026, 10, 22), '202610', { debito: 1100000, credito: 600000, remanente: 120000, tasa: 1.5, diasT: 22, diasTot: 31 });
  assert.equal(r.debito, 1550000); assert.equal(r.credito, 845455);
  assert.equal(r.baseProy, Math.round(F.calcularBasePPM({ debito: 1100000, exento: 0 }).base * 31 / 22));
  assert.equal(r.ppm, F.calcularPPM(r.baseProy, 1.5));
  assert.equal(r.f29, Math.max(1550000 - 845455 - 120000, 0) + r.ppm);
});

test('datos faltantes o inválidos: nunca un 22/31 fijo; se usan el día de hoy y los días reales del mes', () => {
  let h = horizonte({ hoy: dia(2026, 10, 22), periodo: '202610', diasTranscurridos: 0, diasTotales: 0 });
  assert.equal(h.diasTranscurridos, 22); assert.equal(h.diasTotales, 31); assert.equal(h.diasRestantesMes, 9);
  h = horizonte({ hoy: dia(2027, 2, 5), periodo: '202702', diasTranscurridos: null, diasTotales: '' });
  assert.equal(h.diasTotales, 28); assert.equal(h.diasRestantesMes, 23);
  h = horizonte({ hoy: dia(2026, 10, 22), periodo: '202610', diasTranscurridos: 40, diasTotales: 31 });   // más allá de hoy → hoy (22)
  assert.equal(h.diasTranscurridos, 22); assert.equal(h.diasRestantesMes, 9); assert.equal(h.diasTranscurridosAjustado, true);
  h = horizonte({ hoy: dia(2026, 10, 22), periodo: '202610', diasTranscurridos: 10.5, diasTotales: 31 }); // decimal → día de hoy
  assert.equal(h.diasTranscurridos, 22);
  assert.throws(() => horizonte({ hoy: new Date(), periodo: 'abc' }), /PERIODO_INVALIDO/);
  // Débito/crédito vacíos (sin libros, por ejemplo con el SII desactualizado): se proyecta 0, nada se inventa
  const r = cadena(dia(2026, 10, 22), '202610', { debito: 0, credito: 0, tasa: 1.5 });
  assert.equal(r.debito, 0); assert.equal(r.ppm, 0); assert.equal(r.f29, 0);
});

test('RONDA 3 · días totales SIEMPRE del calendario: un valor distinto del analista se ignora (y se informa)', () => {
  let h = horizonte({ hoy: dia(2026, 10, 22), periodo: '202610', diasTranscurridos: 22, diasTotales: 30 });   // 30 en octubre
  assert.equal(h.diasTotales, 31); assert.equal(h.diasRestantesMes, 9); assert.equal(h.diasTotalesIgnorado, true);
  h = horizonte({ hoy: dia(2027, 2, 14), periodo: '202702', diasTranscurridos: 14, diasTotales: 31 });         // 31 en febrero no bisiesto
  assert.equal(h.diasTotales, 28); assert.equal(h.diasRestantesMes, 14); assert.equal(h.diasTotalesIgnorado, true);
  h = horizonte({ hoy: dia(2028, 2, 14), periodo: '202802', diasTranscurridos: 14, diasTotales: 28 });         // 28 en febrero bisiesto
  assert.equal(h.diasTotales, 29); assert.equal(h.diasRestantesMes, 15);
  assert.equal(horizonte({ hoy: dia(2026, 4, 15), periodo: '202604', diasTranscurridos: 15, diasTotales: 30 }).diasTotalesIgnorado, false);
  // El resultado de la cadena completa no cambia con un "días totales" erróneo
  assert.equal(cadena(dia(2026, 10, 22), '202610', { debito: 1000000, credito: 0, diasT: 22, diasTot: 30 }).debito, 1409091);
});

test('RONDA 3 · días transcurridos fuera de rango: entre 1 y los días del mes; en el mes en curso, nunca más allá de hoy', () => {
  const H = (tr, hoy = dia(2026, 10, 22), per = '202610') => horizonte({ hoy, periodo: per, diasTranscurridos: tr });
  assert.equal(H(0).diasTranscurridos, 22); assert.equal(H(-3).diasTranscurridos, 22); assert.equal(H(2.5).diasTranscurridos, 22);
  assert.equal(H(23).diasTranscurridos, 22);                    // mañana: no
  assert.equal(H(31).diasTranscurridos, 22);
  assert.equal(H(10).diasTranscurridos, 10); assert.equal(H(10).diasRestantesMes, 21); assert.equal(H(10).diasTranscurridosAjustado, false);
  // Mes cerrado: el tope son los días del mes; sin proyección igual
  assert.equal(H(45, dia(2026, 10, 22), '202609').diasTranscurridos, 30);
  assert.equal(H(45, dia(2026, 10, 22), '202609').diasRestantesMes, 0);
});

test('RONDA 3 · período con formato EXACTO AAAAMM o AAAA-MM (si no, PERIODO_INVALIDO)', () => {
  for (const p of ['2026-1', '202610x', '2026/10', 'abc', '20261', '2026-13', '2026-00', ' 202610', '202610 ', '2026-010', '', null, undefined])
    assert.throws(() => horizonte({ hoy: dia(2026, 10, 22), periodo: p }), /PERIODO_INVALIDO/, String(p));
  assert.equal(horizonte({ hoy: dia(2026, 10, 22), periodo: '202610' }).diasMes, 31);
  assert.equal(horizonte({ hoy: dia(2026, 10, 22), periodo: '2026-10' }).diasMes, 31);
});

test('RONDA 3 · vencimiento del F29 = referencia operativa configurable (sin cambio de comportamiento: día 20)', () => {
  const { CONFIG } = require('./proyeccion.js');
  assert.equal(CONFIG.diaVencimientoF29, 20);
  assert.equal(horizonte({ hoy: dia(2026, 10, 22), periodo: '202610' }).vencF29, '2026-11-20');
});
