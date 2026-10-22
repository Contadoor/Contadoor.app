// Pruebas de pre-iva/f29-formula.js · ejecutar: node --test pre-iva/f29-formula.test.js  (datos 100% ficticios)
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('./f29-formula.js');

// Fórmula ANTERIOR (con el error), solo para dejar escrito el antes/después.
const antes = (d, c, r, p) => Math.max(d - c - r - p, 0);

test('débito > crédito, sin remanente: total = IVA + PPM', () => {
  const r = F.calcularF29Estimado({ debito: 1900000, credito: 900000, remanente: 0, ppm: 150000 });
  assert.equal(r.ivaPagar, 1000000);
  assert.equal(r.total, 1150000);
  assert.equal(r.nuevoRemanente, 0);
  assert.equal(antes(1900000, 900000, 0, 150000), 850000);   // antes: quedaba 2 × PPM (300.000) por debajo
  assert.equal(r.total - antes(1900000, 900000, 0, 150000), 2 * 150000);
});

test('débito > crédito con remanente parcial: el remanente baja el IVA, no el PPM', () => {
  const r = F.calcularF29Estimado({ debito: 1900000, credito: 900000, remanente: 400000, ppm: 150000 });
  assert.equal(r.ivaDeterminado, 600000);
  assert.equal(r.ivaPagar, 600000);
  assert.equal(r.total, 750000);
  assert.equal(r.nuevoRemanente, 0);
});

test('remanente a favor (crédito + remanente > débito): IVA a pagar 0 y queda remanente', () => {
  const r = F.calcularF29Estimado({ debito: 500000, credito: 700000, remanente: 100000, ppm: 0 });
  assert.equal(r.ivaDeterminado, -300000);
  assert.equal(r.ivaPagar, 0);
  assert.equal(r.nuevoRemanente, 300000);
  assert.equal(r.total, 0);
});

test('PPM con remanente a favor: el PPM se paga igual y NO aumenta el remanente', () => {
  const r = F.calcularF29Estimado({ debito: 500000, credito: 700000, remanente: 100000, ppm: 42000 });
  assert.equal(r.ivaPagar, 0);
  assert.equal(r.total, 42000);              // antes: $0
  assert.equal(r.nuevoRemanente, 300000);    // antes: 342.000 (el PPM se sumaba al remanente)
  assert.equal(antes(500000, 700000, 100000, 42000), 0);
});

test('PPM 0: total = IVA a pagar (sin cambio respecto de antes)', () => {
  const r = F.calcularF29Estimado({ debito: 1190000, credito: 190000, remanente: 0, ppm: 0 });
  assert.equal(r.total, 1000000);
  assert.equal(r.total, antes(1190000, 190000, 0, 0));
});

test('PPM mayor que el IVA: antes se "comía" el IVA; ahora suma', () => {
  const r = F.calcularF29Estimado({ debito: 300000, credito: 250000, remanente: 0, ppm: 80000 });
  assert.equal(r.total, 130000);
  assert.equal(antes(300000, 250000, 0, 80000), 0);
});

test('entradas vacías o negativas no rompen el cálculo', () => {
  const r = F.calcularF29Estimado({ debito: '', credito: undefined, remanente: -5, ppm: null });
  assert.deepEqual(r, { ivaDeterminado: 0, ivaPagar: 0, nuevoRemanente: 0, ppm: 0, total: 0 });
});

test('mes en curso: proyecta al cierre con el promedio diario', () => {
  const p = F.proyectarMes({ debitoRegistrado: 1000000, creditoRegistrado: 500000, diasTranscurridos: 10, diasRestantes: 5, esMesActual: true });
  assert.deepEqual(p, { debito: 1500000, credito: 750000 });
});

test('mes pasado: no se proyecta (libros completos)', () => {
  const p = F.proyectarMes({ debitoRegistrado: 1000000, creditoRegistrado: 500000, diasTranscurridos: 10, diasRestantes: 5, esMesActual: false });
  assert.deepEqual(p, { debito: 1000000, credito: 500000 });
});

test('mes pasado + fórmula: total = (débito − crédito − remanente) + PPM con lo registrado', () => {
  const p = F.proyectarMes({ debitoRegistrado: 2380000, creditoRegistrado: 1190000, diasTranscurridos: 31, diasRestantes: 0, esMesActual: false });
  const r = F.calcularF29Estimado({ debito: p.debito, credito: p.credito, remanente: 190000, ppm: 30000 });
  assert.equal(r.total, 1030000);
});
