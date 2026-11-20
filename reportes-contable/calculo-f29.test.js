// node --test reportes-contable/calculo-f29.test.js  (datos 100 % ficticios) — tarjeta «Cálculo del F29» del Reporte Contable (19-11)
// y cálculo COMPARTIDO con el Pre-IVA (pre-iva/f29-formula.js · calcularF29Completo) incluido el PPM editable.
'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const F = require('../pre-iva/f29-formula.js');
const S = require('../pre-iva/sii-cartapra.js');
const PRY = require('../pre-iva/proyeccion.js');
const C = require('./calculo-f29.js');

const HOY = new Date(2026, 10, 19);   // 19-nov-2026: octubre es mes cerrado (sin proyección)
const COB = { rcv_ventas: 'completa', rcv_compras: 'completa', honorarios: 'completa' };
const REM_OK = { periodo: '2026-09', folio: 123, cod77: 100000, cod504: 101000, fuente: 'sii_codigo_77', mes_utm_origen: '2026-10', mes_utm_destino: '2026-11', utm_origen: 69000, utm_destino: 69690, falta_utm: [] };
function raw(extra) {
  return Object.assign({ conexion: { estado: 'conectada' }, datos_al: '2026-11-19T10:00:00Z', cobertura: COB, avisos: [],
    ventas: { documentos: 5, neto: 10000000, exento: 500000, iva: 1900000, total: 12400000, por_tipo: {} },
    compras: { registro: { documentos: 3, neto: 4000000, exento: 0, iva: 760000, total: 4760000 }, pendiente: { documentos: 1, iva: 19000, total: 119000 }, por_tipo: {} },
    honorarios: { honorarios_recibidos: { documentos: 2, bruto: 500000, retencion: 68750 } },
    remanente_anterior: REM_OK }, extra || {});
}
const HIST = [{ periodo: '2026-09', tasa_ppm: 1.5 }];
function base(o) { return Object.assign({ raw: raw(), remContable: { valor: 90000, fuente: 'contable' }, fila: null, hist: HIST, fichaTasa: null, tieneRrhh: true, iuSii: 45000, iuAt: '2026-11-18T15:00:00Z', periodo: '2026-10', hoy: HOY }, o || {}); }
const linea = (a, id) => a.lineas.find((x) => x.id === id);

// Lo que haría el Pre-IVA con los mismos datos del SII (misma secuencia de su calcular(): aPantalla → remanenteDelPeriodo → calcularF29Completo)
// 19-11: en «periodo 2026-11» el F29 del SII es de septiembre (dos meses atrás) → NO se usa; manda el de Contable (octubre).
function comoPreIva(o) {
  const p = S.aPantalla(o.raw, o.remContable, o.fila);
  const hz = PRY.horizonte({ hoy: o.hoy, periodo: o.periodo });
  return F.calcularF29Completo({ debitoRegistrado: p.debito, creditoRegistrado: p.credito, netoVentas: p.netoVentas || 0, exentoVentas: p.exentoVentas == null ? null : p.exentoVentas,
    remanente: S.remanenteDelPeriodo({ periodo: o.periodo, sii: p, remContable: o.remContable }).valor, tasa: F.tasaPPMDesdeGuardado(o.fila, o.hist, o.fichaTasa).tasa,
    edicionPPM: F.edicionPPMGuardada(o.fila && o.fila.sii_detalle), horizonte: { diasTranscurridos: hz.diasTranscurridos, diasRestantesMes: hz.diasRestantesMes, esMesActual: hz.esMesActual } });
}

test('con remanente oficial del SII: líneas con origen, IVA, PPM y total = IVA + PPM + honorarios + impuesto único', () => {
  const a = C.armar(base());
  assert.equal(a.conectado, true); assert.deepEqual(a.faltas, []);
  assert.equal(linea(a, 'debito').valor, 1900000); assert.equal(linea(a, 'credito').valor, 760000);
  assert.equal(linea(a, 'remanente').valor, 101000, 'usa el cód. 504 del SII, no el de Contable');
  assert.equal(linea(a, 'remanente').origen, 'F29 anterior · SII');
  assert.equal(linea(a, 'iva').valor, 1900000 - 760000 - 101000);
  assert.equal(linea(a, 'ppm').valor, Math.round(10500000 * 1.5 / 100), 'base = neto + exento del SII × tasa del último Pre-IVA');
  assert.match(linea(a, 'ppm').sub, /tasa 1,5% \(Pre-IVA de septiembre 2026\)/);
  assert.equal(linea(a, 'honorarios').valor, 68750); assert.equal(linea(a, 'iu').valor, 45000); assert.equal(linea(a, 'iu').origen, 'RR. HH.');
  assert.equal(a.total, 1039000 + 157500 + 68750 + 45000);
  assert.match(linea(a, 'credito').nota, /1 factura\(s\) pendiente/);
  assert.equal(a.datosAlTxt, '19-11-2026, 07:00');
});
test('mismo resultado que el Pre-IVA (IVA a pagar, PPM y F29 IVA+PPM), mes cerrado y mes en curso', () => {
  for (const o of [base(), base({ periodo: '2026-11' }), base({ fila: { periodo: '2026-10', tasa_ppm: 2, sii_detalle: { ppm_editado: { tasa: null, monto: 50000, motivo: 'Ajuste por prueba', tasa_calculada: 2, calculado: 210000 } } } })]) {
    const a = C.armar(o), p = comoPreIva(o);
    assert.equal(a.calculo.ivaPagar, p.ivaPagar); assert.equal(a.calculo.ppm, p.ppm); assert.equal(a.calculo.total, p.total);
    assert.equal(a.total, p.total + 68750 + 45000);
  }
  assert.equal(C.armar(base({ periodo: '2026-11' })).esMesActual, true);
  assert.match(C.armar(base({ periodo: '2026-11' })).notas.join(' '), /Mes en curso/);
});
test('sin F29 anterior: usa el remanente de Contable si lo tiene; si no, «Falta» y sin total', () => {
  const sinF29 = raw({ remanente_anterior: { periodo: '2026-09', cod77: null, cod504: null, fuente: 'sin_f29' } });
  const a = C.armar(base({ raw: sinF29 }));
  assert.equal(linea(a, 'remanente').valor, 90000); assert.equal(linea(a, 'remanente').origen, 'F29 anterior · Contable');
  const b = C.armar(base({ raw: sinF29, remContable: { valor: 0, fuente: 'sin' } }));
  assert.equal(linea(b, 'remanente').falta, 'remanente anterior'); assert.equal(linea(b, 'iva').valor, null);
  assert.equal(b.total, null); assert.match(b.faltas.join(' '), /F29 de septiembre 2026/);
});
test('sin UTM: «Falta: UTM de …» sin inventar el remanente', () => {
  const r = raw({ remanente_anterior: { periodo: '2026-09', cod77: 100000, cod504: null, fuente: 'sii_codigo_77', falta_utm: ['2026-11'] } });
  const a = C.armar(base({ raw: r, remContable: { valor: 0, fuente: 'sin' } }));
  assert.equal(a.total, null); assert.match(a.faltas.join(' '), /UTM de noviembre 2026 en Gestoor/);
});
test('notas de crédito: el SII ya las resta; si el crédito supera al débito queda remanente para el mes siguiente', () => {
  const r = raw({ ventas: { documentos: 3, neto: 1000000, exento: 0, iva: 190000, total: 1190000, por_tipo: { '33': { n: 2, iva: 228000 }, '61': { n: 1, iva: -38000 } } } });
  const a = C.armar(base({ raw: r }));
  assert.equal(linea(a, 'debito').valor, 190000);
  assert.equal(linea(a, 'iva').valor, 0); assert.match(linea(a, 'iva').sub, /Queda remanente para el mes siguiente: \$671\.000/);
  assert.equal(a.total, 0 + 15000 + 68750 + 45000);
});
test('PPM: sin tasa → «Falta: tasa PPM»; PPM suspendido (tasa editada a 0 con motivo) → $0 y total', () => {
  const a = C.armar(base({ hist: [] }));
  assert.equal(linea(a, 'ppm').falta, 'tasa PPM'); assert.equal(a.total, null);
  const fila = { periodo: '2026-10', tasa_ppm: 0, sii_detalle: { ppm_editado: { tasa: 0, monto: null, motivo: 'PPM suspendido por pérdida', tasa_calculada: 0, calculado: 0 } } };
  const b = C.armar(base({ hist: [], fila }));
  assert.equal(linea(b, 'ppm').valor, 0); assert.equal(linea(b, 'ppm').editado, true); assert.equal(b.total, 1039000 + 68750 + 45000);
  assert.match(linea(b, 'ppm').sub, /PPM editado \(calculado: \$0 · tasa 0%\) · Motivo: PPM suspendido/);
});
test('impuesto único: RR. HH. pendiente → «Falta»; sin RR. HH. → $0 «No aplica»', () => {
  const a = C.armar(base({ iuSii: null }));
  assert.equal(linea(a, 'iu').falta, 'RR. HH. pendiente'); assert.equal(a.total, null); assert.match(a.faltas.join(' '), /RR\. HH\. aún no lo informa/);
  const b = C.armar(base({ iuSii: null, tieneRrhh: false }));
  assert.equal(linea(b, 'iu').valor, 0); assert.match(linea(b, 'iu').sub, /No aplica/); assert.notEqual(b.total, null);
});
test('sin conexión al SII / sin datos de compras aún leídos', () => {
  assert.equal(C.armar(base({ raw: { conexion: { estado: 'sin_conexion' } } })).conectado, false);
  const r = raw({ compras: null, cobertura: { rcv_ventas: 'completa', rcv_compras: 'parcial', honorarios: 'completa' } });
  const a = C.armar(base({ raw: r }));
  assert.equal(linea(a, 'credito').falta, 'compras del SII'); assert.equal(a.total, null);
  const b = C.armar(base({ raw: raw({ compras: null }) }));
  assert.equal(linea(b, 'credito').valor, 0, 'cobertura completa y sin compras = $0');
});
test('validación del Pre-IVA y enlace al Pre-IVA del cliente y período', () => {
  assert.deepEqual(C.estadoValidacion({ fecha_envio: '2026-11-19T15:00:00Z', enviado_por: 'Analista Prueba' }), { validado: true, texto: 'Pre-IVA validado el 19-11-2026 por Analista Prueba' });
  assert.equal(C.estadoValidacion(null, 'completado').texto, 'Pre-IVA validado en el Reporte Contable');
  assert.equal(C.estadoValidacion({ periodo: '2026-10' }).texto, 'Aún no validado · hay un borrador guardado en Pre-IVA');
  assert.equal(C.estadoValidacion(null).texto, 'Aún no validado');
  assert.equal(C.urlPreIva(77, '2026-10'), '../pre-iva/index.html?periodo=2026-10&cliente=77');
  assert.equal(C.urlPreIva(77, '202610'), '../pre-iva/index.html?periodo=2026-10&cliente=77');
});

// ── PPM editable (f29-formula.js, compartido) ──
const HZ = { diasTranscurridos: 31, diasRestantesMes: 0, esMesActual: false };
const E0 = { debitoRegistrado: 1900000, creditoRegistrado: 760000, netoVentas: 10000000, exentoVentas: 500000, remanente: 101000, tasa: 1.5, horizonte: HZ };
test('PPM editable: editar tasa, editar monto, volver al calculado; el total del F29 se recalcula', () => {
  const calc = F.calcularF29Completo(E0);
  assert.equal(calc.ppm, 157500); assert.equal(calc.total, 1039000 + 157500); assert.equal(calc.ppmEditado, false);
  const t = F.calcularF29Completo(Object.assign({}, E0, { edicionPPM: { tasa: 1.25, monto: null, motivo: 'Nueva tasa' } }));
  assert.equal(t.ppm, 131250); assert.equal(t.tasa, 1.25); assert.equal(t.ppmCalculado, 157500); assert.equal(t.total, 1039000 + 131250);
  assert.equal(F.etiquetaPPMEditado(t), 'PPM editado (calculado: $157.500 · tasa 1,5%)');
  const m = F.calcularF29Completo(Object.assign({}, E0, { edicionPPM: { tasa: 2, monto: 100000, motivo: 'Monto informado' } }));
  assert.equal(m.ppm, 100000, 'el monto manda sobre la tasa'); assert.equal(m.total, 1139000); assert.equal(m.ppmModo, 'monto');
  const v = F.calcularF29Completo(Object.assign({}, E0, { edicionPPM: null }));
  assert.equal(v.ppm, 157500); assert.equal(v.total, calc.total);
});
test('PPM editable: validación (motivo obligatorio, tasa ≤ 10 %, monto en pesos) y guardado en sii_detalle sin SQL nuevo', () => {
  assert.match(F.validarEdicionPPM({ tasa: '', monto: '', motivo: 'algo largo' }), /tasa .* o el monto/);
  assert.match(F.validarEdicionPPM({ tasa: '1,2', motivo: 'no' }), /motivo/);
  assert.match(F.validarEdicionPPM({ tasa: '12', motivo: 'motivo válido' }), /mayor a 10/);
  assert.match(F.validarEdicionPPM({ monto: '12,5', motivo: 'motivo válido' }), /sin decimales/);
  assert.equal(F.validarEdicionPPM({ tasa: '1,25', motivo: 'Cambio de tasa' }), null);
  assert.equal(F.validarEdicionPPM({ monto: '100.000', motivo: 'Monto del SII' }), null);
  const e = F.edicionPPMDesdeForm({ tasa: '1,25', monto: '', motivo: '  Cambio de tasa  ', por: 'Analista', at: '2026-11-19T12:00:00Z' }, { calculado: 157500, tasaCalculada: 1.5 });
  assert.deepEqual(e, { tasa: 1.25, monto: null, motivo: 'Cambio de tasa', por: 'Analista', at: '2026-11-19T12:00:00Z', calculado: 157500, tasa_calculada: 1.5 });
  const det = F.detalleConEdicionPPM({ debito: 1 }, e);
  assert.deepEqual(det, { debito: 1, ppm_editado: e }); assert.ok(JSON.stringify(det).length < 4000, 'cabe en el CHECK de 4000 bytes');
  assert.deepEqual(F.edicionPPMGuardada(det), e);
  assert.equal(F.detalleConEdicionPPM(null, e).ppm_editado, e);
  assert.deepEqual(F.detalleConEdicionPPM(det, null), { debito: 1 }, 'volver al calculado quita la edición');
  assert.equal(F.detalleConEdicionPPM(null, null), null);
  // La tasa de partida tras una edición de tasa es la CALCULADA (tasa_ppm guarda la editada)
  assert.equal(F.tasaPPMDesdeGuardado({ periodo: '2026-10', tasa_ppm: 1.25, sii_detalle: det }, HIST, null).tasa, 1.5);
  assert.deepEqual(F.tasaPPMDesdeGuardado(null, [], 0.8), { tasa: 0.8, fuente: 'ficha', periodo: null });
});
