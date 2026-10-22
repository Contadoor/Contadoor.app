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

// ── Ronda 3 (instrucción técnica ChatGPT) ──────────────────────────────────
test('R3 · PPM positivo con IVA determinado negativo: F29 = PPM y el remanente no absorbe el PPM', () => {
  const x = F.calcularF29Estimado({ debito: 400000, credito: 650000, remanente: 0, ppm: 60000 });
  assert.equal(x.ivaDeterminado, -250000);
  assert.equal(x.ivaPagar, 0);
  assert.equal(x.nuevoRemanente, 250000);
  assert.equal(x.total, 60000);
});

test('R3 · PPM positivo con IVA determinado exactamente 0: F29 = PPM, sin remanente', () => {
  const x = F.calcularF29Estimado({ debito: 700000, credito: 500000, remanente: 200000, ppm: 33333 });
  assert.equal(x.ivaDeterminado, 0);
  assert.equal(x.ivaPagar, 0);
  assert.equal(x.nuevoRemanente, 0);
  assert.equal(x.total, 33333);
});

test('R3 · remanente anterior mayor que el IVA del período: se arrastra la diferencia, el PPM se paga', () => {
  const x = F.calcularF29Estimado({ debito: 1000000, credito: 600000, remanente: 1500000, ppm: 90000 });
  assert.equal(x.ivaPagar, 0);
  assert.equal(x.nuevoRemanente, 1100000);
  assert.equal(x.total, 90000);
});

test('R3 · datos vacíos y ceros: todo 0, sin NaN', () => {
  for (const v of [{}, { debito: 0, credito: 0, remanente: 0, ppm: 0 }, { debito: '', credito: '', remanente: '', ppm: '' }, { debito: null, credito: undefined }]) {
    const x = F.calcularF29Estimado(v);
    assert.deepEqual(x, { ivaDeterminado: 0, ivaPagar: 0, nuevoRemanente: 0, ppm: 0, total: 0 });
  }
});

test('R3 · negativos inválidos: remanente y PPM negativos se tratan como 0 (nunca restan ni suman al revés)', () => {
  const x = F.calcularF29Estimado({ debito: 1000000, credito: 400000, remanente: -300000, ppm: -50000 });
  assert.equal(x.ivaPagar, 600000);
  assert.equal(x.ppm, 0);
  assert.equal(x.total, 600000);
});

test('R3 · entradas no numéricas: se ignoran (0) y no generan NaN', () => {
  const x = F.calcularF29Estimado({ debito: 'abc', credito: {}, remanente: 'x', ppm: NaN });
  assert.equal(Number.isNaN(x.total), false);
  assert.equal(x.total, 0);
  const b = F.calcularBasePPM({ debito: 'abc', netoAfecto: 'no', exento: 'tampoco' });
  assert.equal(b.base, 0);
  assert.equal(b.netoEstimado, true);   // un texto no es un neto conocido
  assert.equal(b.sinExento, true);
  assert.equal(F.calcularPPM('x', 'y'), 0);
});

test('R3 · redondeos: PPM al peso más cercano (igual que Contable) y neto estimado redondeado', () => {
  assert.equal(F.calcularPPM(1000033, 1.5), 15000);     // 15.000,495 → 15.000
  assert.equal(F.calcularPPM(1000034, 1.5), 15001);     // 15.000,51 → 15.001
  assert.equal(F.calcularPPM(3333333, 0.25), 8333);     // 8.333,33
  assert.equal(F.calcularBasePPM({ debito: 100 }).netoAfecto, 526);   // 526,3 → 526
  assert.equal(F.proyectarMes({ debitoRegistrado: 100, creditoRegistrado: 0, diasTranscurridos: 3, diasRestantes: 1, esMesActual: true }).debito, 133);
});

test('R3 · ventas afectas + exentas: base = neto afecto + exento', () => {
  const b = F.calcularBasePPM({ debito: 950000, netoAfecto: 5000000, exento: 3000000 });
  assert.equal(b.base, 8000000);
  assert.equal(F.calcularPPM(b.base, 1), 80000);
  // empresa 100 % exenta (débito 0, neto 0 conocido): la base es solo el exento
  assert.equal(F.calcularBasePPM({ debito: 0, netoAfecto: 0, exento: 4000000 }).base, 4000000);
});

test('R3 · coherencia con Contable: mismos datos → mismo PPM (copia literal de reportes-contable/index.html:613-636)', () => {
  // Fórmula de Contable (buildBorradorF29), copiada tal cual para comparar.
  function ppmContable(libV, tasa) {
    const ppmBase = Number((libV || {}).totalNeto || 0) + Number((libV || {}).totalExento || 0);
    return (tasa !== null && ppmBase > 0) ? Math.round(ppmBase * tasa / 100) : 0;
  }
  const casos = [[10000000, 2000000, 1.5], [5000000, 0, 0.25], [0, 4000000, 1], [1234567, 89012, 2.7], [0, 0, 1.5], [7777777, 3333, 0.1]];
  for (const [neto, ex, t] of casos) {
    const b = F.calcularBasePPM({ debito: 0, netoAfecto: neto, exento: ex });
    assert.equal(F.calcularPPM(b.base, t), ppmContable({ totalNeto: neto, totalExento: ex }, t), `neto ${neto} exento ${ex} tasa ${t}`);
    assert.equal(b.definitivo, true);
  }
  // Y el F29: Contable = máx(0, débito − crédito − remanente) + PPM (+ retenciones que esta pantalla no tiene)
  const d = 2380000, c = 1190000, r = 100000, ppm = ppmContable({ totalNeto: 12526316, totalExento: 0 }, 1.5);
  assert.equal(F.calcularF29Estimado({ debito: d, credito: c, remanente: r, ppm }).total, Math.max(0, d - c - r) + ppm);
});

// ── Ronda 4 ────────────────────────────────────────────────────────────────
test('R4 · validarMonto: vacío y enteros ≥ 0 válidos; texto, negativos, decimales y badInput rechazados', () => {
  for (const ok of ['', '  ', '0', '100', '1900000', ' 7 ', '12.0', null, undefined]) assert.equal(F.validarMonto(ok), null, String(ok));
  assert.equal(F.validarMonto('abc'), 'no es un número válido');
  assert.equal(F.validarMonto('1e3'), 'no es un número válido');
  assert.equal(F.validarMonto('1.900.000'), 'no es un número válido');
  assert.equal(F.validarMonto('$5000'), 'no es un número válido');
  assert.equal(F.validarMonto('-5'), 'no puede ser negativo');
  assert.equal(F.validarMonto('12.5'), 'debe ser un monto en pesos sin decimales');
  assert.equal(F.validarMonto('', { badInput: true }), 'no es un número válido');
});
