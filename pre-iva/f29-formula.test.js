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

// ── Ronda 2 (revisión ChatGPT) ─────────────────────────────────────────────
const fs = require('node:fs');
const path = require('node:path');

[
  // [débito, crédito, remanente, PPM, IVA a pagar, nuevo remanente, F29]
  [1900000, 900000, 0, 150000, 1000000, 0, 1150000],
  [500000, 800000, 0, 100000, 0, 300000, 100000],
  [800000, 500000, 300000, 50000, 0, 0, 50000],
  [0, 0, 200000, 75000, 0, 200000, 75000],
  [900000, 200000, 0, 0, 700000, 0, 700000],
].forEach(([d, c, r, p, iva, rem, f29]) => {
  test(`R2 · D ${d} C ${c} R ${r} PPM ${p} → IVA ${iva} · remanente ${rem} · F29 ${f29}`, () => {
    const x = F.calcularF29Estimado({ debito: d, credito: c, remanente: r, ppm: p });
    assert.equal(x.ivaPagar, iva);
    assert.equal(x.nuevoRemanente, rem);
    assert.equal(x.total, f29);
  });
});

test('R2 · "F29 manual = 0" recalcula con la fórmula vigente; > 0 se respeta', () => {
  const v = { debito: 1900000, credito: 900000, remanente: 0, ppm: 150000 };
  assert.equal(F.f29DesdeEdicion({ ...v, f29Manual: 0 }), 1150000);
  assert.equal(F.f29DesdeEdicion({ ...v, f29Manual: '' }), 1150000);
  assert.equal(F.f29DesdeEdicion({ ...v, f29Manual: 999999 }), 999999);
  assert.equal(F.f29DesdeEdicion({ debito: 500000, credito: 800000, remanente: 0, ppm: 100000, f29Manual: 0 }), 100000);
});

test('R2 · acciones sugeridas dependen solo del IVA a pagar (el PPM no las cambia)', () => {
  const base = { debito: 0, diasRestantes: 0 };
  const sinPpm = F.calcularF29Estimado({ debito: 1900000, credito: 900000, remanente: 0, ppm: 0 });
  const conPpm = F.calcularF29Estimado({ debito: 1900000, credito: 900000, remanente: 0, ppm: 900000 });
  assert.deepEqual(F.accionesSugeridas({ ...base, ivaPagar: conPpm.ivaPagar }), F.accionesSugeridas({ ...base, ivaPagar: sinPpm.ivaPagar }));
  // IVA 0 con PPM alto: no sugiere "adelantar compras" ni "activo fijo"
  const soloPpm = F.accionesSugeridas({ ...base, ivaPagar: 0 });
  assert.deepEqual(soloPpm.map((a) => a.titulo), ['Revisar facturas de proveedores pendientes']);
  assert.equal(F.accionesSugeridas({ ...base, ivaPagar: 1000001 }).length, 3);
});

test('R2 · ningún flujo de la pantalla conserva la fórmula antigua (resta o suma indebida del PPM)', () => {
  const src = ['index.html', 'cartera.js'].map((f) => fs.readFileSync(path.join(__dirname, f), 'utf8')).join('\n');
  assert.doesNotMatch(src, /\b(?:remanente|remNum|rem|credProy|credNum|debProy|debNum|credito|debito)\s*-\s*(?:ppm|ppmNum)\b/);
  assert.doesNotMatch(src, /\+\s*(?:ppm|ppmNum)\s*-\s*(?:debProy|debNum|deb|debito)\b/);
  assert.doesNotMatch(src, /Math\.max\([^)]*\bppm\w*/i);
  assert.doesNotMatch(src, /\/\s*1\.19\b/);   // base PPM antigua (débito ÷ 1,19)
});

test('R2 · base PPM con neto y exento conocidos = neto + exento (definitivo, igual que Contable)', () => {
  const b = F.calcularBasePPM({ debito: 1900000, netoAfecto: 10000000, exento: 2000000 });
  assert.equal(b.base, 12000000);
  assert.equal(b.definitivo, true);
  assert.deepEqual(b.avisos, []);
  assert.equal(F.calcularPPM(b.base, 1.5), 180000);   // Contable: Math.round((neto + exento) × tasa / 100)
});

test('R2 · base PPM con exento 0 conocido es definitiva (0 ≠ sin dato)', () => {
  const b = F.calcularBasePPM({ debito: 1900000, netoAfecto: 10000000, exento: 0 });
  assert.equal(b.base, 10000000);
  assert.equal(b.definitivo, true);
});

test('R2 · base PPM sin exento: usa el neto, avisa "PPM estimado sin ventas exentas" y no es definitiva', () => {
  const b = F.calcularBasePPM({ debito: 1900000, netoAfecto: 10000000, exento: null });
  assert.equal(b.base, 10000000);
  assert.equal(b.sinExento, true);
  assert.equal(b.definitivo, false);
  assert.ok(b.avisos.includes('PPM estimado sin ventas exentas'));
});

test('R2 · base PPM sin neto: estima débito ÷ 0,19 (no ÷ 1,19) y lo marca', () => {
  const b = F.calcularBasePPM({ debito: 1900000, netoAfecto: null, exento: 500000 });
  assert.equal(b.netoAfecto, 10000000);
  assert.equal(b.base, 10500000);
  assert.equal(b.netoEstimado, true);
  assert.equal(b.definitivo, false);
  assert.ok(b.avisos.some((a) => a.includes('0,19')));
  // antes: 1.900.000 / 1,19 × 1,5 % = 23.950 · ahora (sin exento) 10.000.000 × 1,5 % = 150.000
  assert.equal(Math.round(1900000 / 1.19 * 1.5 / 100), 23950);
  assert.equal(F.calcularPPM(F.calcularBasePPM({ debito: 1900000 }).base, 1.5), 150000);
});

test('R2 · PPM sin tasa o sin base = 0; otros ingresos computables se suman si se informan', () => {
  assert.equal(F.calcularPPM(10000000, 0), 0);
  assert.equal(F.calcularPPM(0, 1.5), 0);
  assert.equal(F.calcularBasePPM({ debito: 0, netoAfecto: 1000000, exento: 0, otrosIngresos: 250000 }).base, 1250000);
});

test('R2 · base PPM del mes en curso se proyecta igual que el débito; mes pasado no', () => {
  const b = F.calcularBasePPM({ debito: 950000, netoAfecto: 5000000, exento: 1000000 }).base;   // 6.000.000 a 10 días
  assert.equal(F.proyectarMes({ debitoRegistrado: b, creditoRegistrado: 0, diasTranscurridos: 10, diasRestantes: 5, esMesActual: true }).debito, 9000000);
  assert.equal(F.proyectarMes({ debitoRegistrado: b, creditoRegistrado: 0, diasTranscurridos: 10, diasRestantes: 5, esMesActual: false }).debito, 6000000);
});
