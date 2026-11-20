// node --test pre-iva/ppm-cobertura.test.js  (datos 100 % ficticios) — tasa del último F29 + «Cobertura de la renta» (19-11)
'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const F = require('./f29-formula.js');
const C = require('./ppm-cobertura.js');
const K = require('../reportes-contable/calculo-f29.js');

// F29 del SII como los trae sii_renta_resumen (meses del año comercial 2026); base de $10.000.000 al mes y tasa 1,5 %
function f29(per, o) { return { periodo: per, f29: Object.assign({ folio: 9000 + +per.slice(4), ppm: 150000, base_ppm: 10000000, tasa_ppm: 1.5, montos: true }, o || {}) }; }
const MESES = ['202601', '202602', '202603', '202604', '202605', '202606', '202607', '202608', '202609', '202610'].map((p) => f29(p))
  .concat([{ periodo: '202611', f29: null }, { periodo: '202612', f29: null }]);
const ok = (idpc) => ({ estado: 'ok', idpc: idpc, proyEstado: 'VIGENTE' });

test('tasa del último F29: el más reciente ANTES del período con montos leídos (cód. 115)', () => {
  const m = MESES.slice(); m[9] = f29('202610', { tasa_ppm: 1.25 });
  const u = C.ultimoF29(m, '2026-11');
  assert.equal(u.periodo, '202610'); assert.equal(u.tasa, 1.25); assert.equal(u.valida, true);
  assert.equal(C.textoTasa(u), 'Tasa usada en el último F29: 1,25 % (octubre 2026, según SII)');
  // No usa el F29 del propio período ni uno posterior
  assert.equal(C.ultimoF29(m, '2026-10').periodo, '202609');
  // F29 sin montos (Cartapra aún no los trae) se salta
  const m2 = MESES.slice(); m2[9] = f29('202610', { montos: false, tasa_ppm: null });
  assert.equal(C.ultimoF29(m2, '2026-11').periodo, '202609');
  assert.equal(C.ultimoF29([], '2026-11'), null);
  assert.equal(C.textoTasa(null), null);
});

test('tasa por defecto: SII manda; fuera de rango o sin tasa → la de siempre (Pre-IVA guardado → historial → ficha)', () => {
  const u = C.ultimoF29(MESES, '2026-11');
  assert.deepEqual(C.tasaPorDefecto(u, { periodo: '2026-11', tasa_ppm: 2 }, [], 3), { tasa: 1.5, fuente: 'sii', periodo: '202610' });
  const malo = C.ultimoF29([f29('202610', { tasa_ppm: 22 })], '2026-11');
  assert.equal(malo.valida, false); assert.match(C.textoTasa(malo), /fuera de rango \(22 %\): no se usa/);
  assert.equal(C.tasaPorDefecto(malo, null, [{ periodo: '2026-09', tasa_ppm: 1.1 }], 3).tasa, 1.1);
  const cero = C.ultimoF29([f29('202610', { tasa_ppm: 0, ppm: 0 })], '2026-11');
  assert.equal(cero.valida, false); assert.match(C.textoTasa(cero), /no trae tasa PPM/);
  assert.equal(C.tasaPorDefecto(cero, null, [], 0.9).fuente, 'ficha');
  assert.equal(C.tasaPorDefecto(null, null, [], 0.9).tasa, 0.9);
});

test('cobertura VERDE (≥ 90 %): pagados de ene a oct ÷ impuesto proyectado; el PPM del mes va aparte', () => {
  const c = C.cobertura({ meses: MESES, siiEstado: 'ok', periodo: '2026-11', ppmMes: 150000, baseMes: 10000000, renta: ok(1600000) });
  assert.equal(c.estado, 'ok'); assert.equal(c.pagados, 1500000); assert.equal(c.mesesPagados.length, 10);
  assert.equal(c.pct, 94); assert.equal(c.color, 'verde'); assert.equal(c.pctConMes, 103);
  const t = C.textos(c);
  assert.equal(t.linea, '🎯 PPM pagados en 2026: $1.500.000 → cubren el 94 % del impuesto proyectado ($1.600.000)');
  assert.ok(t.sub.some((s) => s === 'Con el PPM de noviembre ($150.000, proyección): 103 %'));
  assert.ok(t.sub[0].startsWith('F29 de enero a octubre según SII'));
  assert.equal(t.sugerencia, null, 'en verde no se sugiere tasa');
});

test('cobertura AMARILLA (60–89 %) y ROJA (< 60 %) con tasa sugerida = faltante ÷ ventas que quedan del año', () => {
  const a = C.cobertura({ meses: MESES, siiEstado: 'ok', periodo: '2026-11', ppmMes: 150000, renta: ok(2000000) });
  assert.equal(a.pct, 75); assert.equal(a.color, 'amarillo');
  // faltan 500.000; quedan nov y dic (2 meses) × base promedio 10.000.000 → 2,5 %
  assert.equal(a.faltante, 500000); assert.equal(a.mesesRestantes, 2); assert.equal(a.baseProm, 10000000); assert.equal(a.tasaSugerida, 2.5);
  assert.match(C.textos(a).sugerencia, /^Para llegar al 100 % la tasa debería ser ~2,5 % \(faltan \$500\.000; supone ventas de \$10\.000\.000 al mes por 2 meses/);
  const r = C.cobertura({ meses: MESES, siiEstado: 'ok', periodo: '2026-11', ppmMes: 150000, renta: ok(5000000) });
  assert.equal(r.pct, 30); assert.equal(r.color, 'rojo'); assert.equal(r.tasaSugerida, 17.5);
  assert.equal(C.textos(r).color, 'rojo');
  // Bordes exactos
  assert.equal(C.colorDe(90), 'verde'); assert.equal(C.colorDe(89.9), 'amarillo'); assert.equal(C.colorDe(60), 'amarillo'); assert.equal(C.colorDe(59.9), 'rojo');
});

test('mes ya declarado: su F29 cuenta como pagado y no se suma proyección; F29 sin montos no se suman y se avisa', () => {
  const m = MESES.slice(); m[10] = f29('202611'); m[8] = f29('202609', { montos: false, ppm: null });
  const c = C.cobertura({ meses: m, siiEstado: 'ok', periodo: '2026-11', ppmMes: 999999, renta: ok(2000000) });
  assert.equal(c.mesDeclarado, true); assert.equal(c.ppmMes, 0); assert.equal(c.pagados, 1500000); assert.equal(c.sinMontos, 1);
  assert.equal(c.mesesRestantes, 1);
  assert.ok(C.textos(c).sub.some((s) => /1 F29 del año aún sin montos/.test(s)));
});

test('sin proyección de renta: «Sin proyección de renta aún», sin porcentaje inventado; sin permiso / error → disponible pronto', () => {
  const s = C.cobertura({ meses: MESES, siiEstado: 'ok', periodo: '2026-11', ppmMes: 150000, renta: { estado: 'sin_proyeccion' } });
  assert.equal(s.estado, 'sin_proyeccion'); assert.equal(s.pct, null);
  assert.equal(C.textos(s).linea, 'Cobertura de la renta: sin proyección de renta aún');
  assert.equal(C.cobertura({ meses: MESES, siiEstado: 'ok', periodo: '2026-11', renta: { estado: 'ok', idpc: null } }).estado, 'sin_proyeccion');
  for (const e of ['sin_permiso', 'no_disponible', 'error']) {
    const x = C.cobertura({ meses: MESES, siiEstado: 'ok', periodo: '2026-11', renta: { estado: e } });
    assert.equal(x.pct, null); assert.equal(C.textos(x).linea, 'Cobertura de la renta: disponible pronto');
  }
  // F29 del SII no legibles: no se calcula (sumar $0 daría un % falso)
  const ns = C.cobertura({ meses: [], siiEstado: 'error', periodo: '2026-11', renta: ok(1000000) });
  assert.equal(ns.estado, 'no_disponible'); assert.equal(ns.pct, null);
  assert.equal(C.textos(C.cobertura({ meses: [], siiEstado: 'sin_conexion', periodo: '2026-11', renta: ok(1000000) })).linea, 'Cobertura de la renta: la empresa aún no está conectada al SII');
  // Impuesto proyectado $0: no hay porcentaje
  const z = C.cobertura({ meses: MESES, siiEstado: 'ok', periodo: '2026-11', renta: ok(0) });
  assert.equal(z.estado, 'sin_impuesto'); assert.equal(z.pct, null);
});

test('el PPM EDITADO (con motivo) cambia la proyección del mes en la cobertura', () => {
  const base = 10000000, renta = ok(2000000);
  const calc = F.aplicarEdicionPPM(base, 1.5, null), edit = F.aplicarEdicionPPM(base, 1.5, { tasa: 3, monto: null, motivo: 'cambio de tasa' });
  const c1 = C.cobertura({ meses: MESES, siiEstado: 'ok', periodo: '2026-11', ppmMes: calc.ppm, renta });
  const c2 = C.cobertura({ meses: MESES, siiEstado: 'ok', periodo: '2026-11', ppmMes: edit.ppm, renta });
  assert.equal(c1.pctConMes, 83); assert.equal(c2.pctConMes, 90);
  assert.equal(c1.pct, c2.pct, 'los PPM ya pagados no cambian con la edición');
  const c3 = C.cobertura({ meses: MESES, siiEstado: 'ok', periodo: '2026-11', ppmMes: F.aplicarEdicionPPM(base, 1.5, { tasa: null, monto: 0, motivo: 'PPM suspendido' }).ppm, renta });
  assert.equal(c3.ppmMes, 0); assert.ok(!C.textos(c3).sub.some((s) => /proyección\)/.test(s)));
});

test('sin F29 del año aún (enero): la sugerencia usa la base del mes en cálculo', () => {
  const c = C.cobertura({ meses: [f29('202512')], siiEstado: 'ok', periodo: '2026-01', ppmMes: 150000, baseMes: 8000000, renta: ok(1200000) });
  assert.equal(c.pagados, 0, 'el F29 de diciembre del año anterior no cuenta para 2026'); assert.equal(c.pct, 0); assert.equal(c.color, 'rojo');
  assert.equal(c.mesesRestantes, 12); assert.equal(c.baseProm, 8000000); assert.equal(c.tasaSugerida, 1.25);
  assert.equal(C.ultimoF29([f29('202512', { tasa_ppm: 1.1 })], '2026-01').tasa, 1.1, 'la tasa sí sale del F29 de diciembre');
});

test('leer(): usa sii_renta_resumen del AT siguiente + caso 14D3 del año + forecast.idpc; sin permiso a MiRenta no consulta', async () => {
  C._limpiarCache();
  const llamadas = [];
  globalThis.sessionStorage = { getItem: () => JSON.stringify({ rol: 'contable' }) };
  const f = (path, opts) => {
    llamadas.push(path + (opts && opts.body ? ' ' + opts.body : ''));
    const r = (b) => Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(b)) });
    if (path === 'rpc/sii_renta_resumen') return r({ conexion: { estado: 'conectada' }, meses: MESES });
    if (path.startsWith('renta_casos')) return r([{ id: 7, anio_comercial: 2026, anio_tributario: 2027, estado: 'IN_PROGRESS' }]);
    if (path === 'rpc/renta_e1_proyeccion_vigente') return r({ estado: 'VIGENTE', corrida: { cutoff_date: '2026-10-31' }, outputs: [{ output_key: 'forecast.idpc', monto: 1600000, estado_dato: 'OK' }] });
    return r([]);
  };
  const x = await C.leer(55, '2026-11', f);
  assert.equal(x.sii.estado, 'ok'); assert.equal(x.renta.estado, 'ok'); assert.equal(x.renta.idpc, 1600000); assert.equal(x.ultimo.periodo, '202610');
  assert.ok(llamadas.some((l) => l.includes('"p_anio_tributario":2027')));
  assert.ok(llamadas.some((l) => l.startsWith('renta_casos?cliente_id=eq.55&anio_comercial=eq.2026&regimen=eq.14D3')));
  C._limpiarCache(); llamadas.length = 0;
  globalThis.sessionStorage = { getItem: () => JSON.stringify({ rol: 'rrhh' }) };
  const y = await C.leer(55, '2026-11', f);
  assert.equal(y.renta.estado, 'sin_permiso'); assert.ok(!llamadas.some((l) => l.startsWith('renta_casos')));
  // RPC no instalada → no_disponible (fail-closed)
  C._limpiarCache();
  const g = () => Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve('{"code":"PGRST202"}') });
  const z = await C.leer(55, '2026-11', g);
  assert.equal(z.sii.estado, 'no_disponible'); assert.equal(z.ultimo, null);
  delete globalThis.sessionStorage;
});

test('Reporte Contable: la tarjeta usa la tasa del último F29 del SII y trae la cobertura con el PPM del mes', () => {
  const raw = { conexion: { estado: 'conectada' }, cobertura: { rcv_ventas: 'completa', rcv_compras: 'completa', honorarios: 'completa' }, avisos: [],
    ventas: { documentos: 5, neto: 10000000, exento: 0, iva: 1900000, por_tipo: {} }, compras: { registro: { documentos: 3, neto: 4000000, exento: 0, iva: 760000 }, por_tipo: {} },
    honorarios: { honorarios_recibidos: { retencion: 0 } }, remanente_anterior: { periodo: '202609', folio: 1, cod77: 0, cod504: 0, fuente: 'sii_codigo_77', falta_utm: [] } };
  const m = MESES.slice(0, 9).concat([f29('202610', { tasa_ppm: 2 })]);   // octubre con tasa 2 %
  const ppm = { sii: { estado: 'ok', meses: m }, renta: ok(2000000), ultimo: C.ultimoF29(m, '2026-11') };
  const a = K.armar({ raw, remContable: null, fila: null, hist: [{ periodo: '2026-10', tasa_ppm: 1.5 }], fichaTasa: 1, tieneRrhh: false, periodo: '2026-11', hoy: new Date(2026, 11, 5), ppm });
  const l = a.lineas.find((x) => x.id === 'ppm');
  assert.equal(l.valor, 200000, 'base 10.000.000 × 2 % del último F29 (no 1,5 % del Pre-IVA)');
  assert.match(l.sub, /último F29 de octubre 2026 · SII/);
  assert.equal(l.tasaSii, 'Tasa usada en el último F29: 2 % (octubre 2026, según SII)');
  assert.equal(a.cobertura.estado, 'ok'); assert.equal(a.cobertura.ppmMes, 200000); assert.equal(a.cobertura.pct, 75);
  // Sin datos de cobertura (lectura falló): la tarjeta sigue como antes
  const b = K.armar({ raw, remContable: null, fila: null, hist: [{ periodo: '2026-10', tasa_ppm: 1.5 }], fichaTasa: 1, tieneRrhh: false, periodo: '2026-11', hoy: new Date(2026, 11, 5) });
  assert.equal(b.lineas.find((x) => x.id === 'ppm').valor, 150000); assert.equal(b.cobertura, undefined);
});
