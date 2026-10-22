// Pruebas del motor de recomendaciones del Pre-IVA (datos 100 % ficticios). Ejecutar: node --test pre-iva/recomendaciones.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('./recomendaciones.js');

// Contexto base: octubre 2026 en curso, hoy 22-10, sin documentos ni historial (ninguna regla de datos debería dispararse).
function base(extra) {
  return Object.assign({
    hoy: '2026-10-22', periodo: '2026-10', mesEnCurso: true, exenta: false, vencF29: '2026-11-20', finMes: '2026-10-31',
    actual: { ivaPagar: 800000, ppm: 185000, f29: 985000, nuevoRemanente: 0, debito: 2850000, credito: 1930000, ventasBase: 15000000, tasaPPM: 1.5, sinDato: false },
    historial: [], docs: { disponible: false }, sii: { estado: 'pendiente' }, renta: null
  }, extra || {});
}
const TODO = { iva: true, ppm: true, ventas: true, debito: true, credito: true };
const H6 = (iva, extra) => ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'].map((p, i) => Object.assign({ periodo: p, iva: iva[i], ppm: 150000, debito: 2500000, credito: 1700000, ventas: 12000000, tasa: 1.5, comparable: TODO }, extra ? extra(i) : {}));
const doc = (o) => Object.assign({ tipo_dte: 33, folio: '1', rut: 'DEMO-T06', razon: 'Proveedor Ficticio SpA', fecha: '2026-10-05', neto: 100000, exento: 0, iva: 19000, total: 119000 }, o);
const vacioPrevios = () => ({ '2026-04': { ventas: [], compras: [] }, '2026-05': { ventas: [], compras: [] }, '2026-06': { ventas: [], compras: [] }, '2026-07': { ventas: [], compras: [] }, '2026-08': { ventas: [], compras: [] }, '2026-09': { ventas: [], compras: [] } });
const ids = (l) => l.map((x) => x.id);

test('sin datos suficientes → ninguna recomendación (nada de relleno genérico)', () => {
  assert.deepEqual(R.generar(base()), []);
  assert.deepEqual(R.generar(base({ actual: { sinDato: true } })), []);
  assert.deepEqual(R.generar({}), []);
});

test('estructura: detectado → impacto → acción → quién; nunca "honorarios" ni promesas de ahorro', () => {
  const l = R.generar(base({ historial: H6([800000, 820000, 850000, 830000, 840000, 870000]), actual: Object.assign(base().actual, { ivaPagar: 985000 }) }));
  assert.ok(l.length >= 1);
  l.forEach((x) => { ['frase', 'detectado', 'impacto', 'accion', 'quien'].forEach((k) => assert.ok(x[k], k)); assert.ok(['Tú', 'Tu analista'].includes(x.quien)); });
  const txt = JSON.stringify(R.generar(base({ historial: H6([800000, 820000, 850000, 830000, 840000, 870000]), actual: Object.assign(base().actual, { ivaPagar: 985000, nuevoRemanente: 300000 }) })));
  assert.doesNotMatch(txt, /honorario/i); assert.doesNotMatch(txt, /ahorr/i);
});

test('reserva: IVA 18 % sobre el promedio de 6 meses → cifra, promedio y fecha del F29', () => {
  const l = R.generar(base({ historial: H6([800000, 820000, 850000, 830000, 840000, 870000]), actual: Object.assign(base().actual, { ivaPagar: 985000 }) }));
  const x = l.find((y) => y.id === 'reserva');
  assert.ok(x); assert.match(x.detectado, /\$985\.000\) está 18 % sobre tu promedio de 6 meses cerrados \(\$835\.000\)/);
  assert.match(x.accion, /Reserva \$985\.000 antes del 20-11/); assert.equal(x.monto, 150000);
});

test('reserva: con menos de 4 meses de historial no se dispara', () => {
  const h = H6([800000, null, null, null, 840000, 870000]);
  assert.equal(R.generar(base({ historial: h, actual: Object.assign(base().actual, { ivaPagar: 1500000 }) })).find((y) => y.id === 'reserva'), undefined);
});

test('acuse: facturas en plazo (8 días corridos), aceptadas y reclamadas', () => {
  assert.equal(R.estadoAcuse({ fecha_recepcion: '2026-10-20' }, '2026-10-22').estado, 'pendiente');
  assert.equal(R.estadoAcuse({ fecha_recepcion: '2026-10-20' }, '2026-10-22').vence, '2026-10-28');
  assert.equal(R.estadoAcuse({ fecha_recepcion: '2026-10-01' }, '2026-10-22').estado, 'tacita');
  assert.equal(R.estadoAcuse({ fecha_recepcion: '2026-10-20', fecha_acuse: '2026-10-21' }, '2026-10-22').estado, 'aceptada');
  assert.equal(R.estadoAcuse({ fecha_recepcion: '2026-10-20', fecha_reclamo: '2026-10-21' }, '2026-10-22').estado, 'reclamada');
  const compras = [doc({ folio: '10', fecha_recepcion: '2026-10-20', iva: 600000 }), doc({ folio: '11', fecha_recepcion: '2026-10-21', iva: 640000 }), doc({ folio: '12', fecha_recepcion: '2026-10-01', iva: 50000 })];
  const l = R.generar(base({ docs: { disponible: true, actual: { ventas: [], compras } } }));
  const x = l.find((y) => y.id === 'acuse');
  assert.match(x.detectado, /2 facturas de compra con \$1\.240\.000 de IVA en plazo de reclamo; el primer plazo vence el 28-10/);
  assert.equal(x.plazo, '2026-10-28');
});

test('máximo 4 y ordenadas por impacto (la alerta de posible doble IVA y la frescura del SII van primero)', () => {
  const compras = [doc({ folio: '10', fecha_recepcion: '2026-10-20', iva: 2000000 })];
  const c = base({ sii: { estado: 'desactualizado', ultima: '2026-10-02T12:00:00Z' }, historial: H6([800000, 820000, 850000, 830000, 840000, 870000]),
    actual: Object.assign(base().actual, { ivaPagar: 1985000, f29: 2170000, nuevoRemanente: 0 }), docs: { disponible: true, actual: { ventas: [], compras } },
    renta: { estado: 'VIGENTE', finalizado: '2026-10-21T15:00:00Z', corte: '2026-09-30', anioComercial: 2026, outputs: { 'forecast.idpc': 53400000, 'forecast.ppm.imputable': 24565821, 'forecast.saldo_abril': 28834179 } } });
  const l = R.generar(c);
  assert.ok(l.length <= 4);
  assert.equal(l[0].id, 'sii'); assert.match(l[0].detectado, /desde el 02-10/);
  for (let i = 2; i < l.length; i++) assert.ok(l[i - 1].tier < l[i].tier || l[i - 1].monto >= l[i].monto);
});

test('MiRenta: cobertura del PPM con escenario de PPM voluntario, fechas de la corrida; desactualizada; sin caso solo 14 D N°3 con plan', () => {
  const out = { 'forecast.idpc': 53400000, 'forecast.ppm.imputable': 24565821, 'forecast.saldo_abril': 28834179, 'sim.ppm_voluntario.cuota_mensual': 9611393 };
  let x = R.generar(base({ renta: { estado: 'VIGENTE', finalizado: '2026-10-21T15:00:00Z', corte: '2026-09-30', anioComercial: 2026, outputs: out } })).find((y) => y.id === 'renta_cobertura');
  assert.match(x.detectado, /actualizada el 21-10, datos al 30-09\), tus PPM cubren el 46 % del impuesto de abril: faltarían \$28\.834\.179/);
  assert.match(x.accion, /con \$9\.611\.393 al mes hasta diciembre podrías llegar a abril sin saldo/); assert.equal(x.monto, 28834179);
  x = R.generar(base({ renta: { estado: 'VIGENTE', finalizado: '2026-10-21', corte: '2026-09-30', anioComercial: 2026, outputs: Object.assign({}, out, { 'sim.ppm_voluntario.cuota_mensual': null }) } })).find((y) => y.id === 'renta_cobertura');
  assert.doesNotMatch(x.accion, /\$/);
  x = R.generar(base({ renta: { estado: 'DESACTUALIZADA', finalizado: '2026-09-01', corte: '2026-07-31', anioComercial: 2026, outputs: out } })).find((y) => y.id === 'renta_desact');
  assert.match(x.detectado, /datos al 31-07 y ya hay datos nuevos/);
  assert.ok(R.generar(base({ renta: { estado: 'sin_caso', regimen: '14D3', planIncluye: true } })).find((y) => y.id === 'renta_activar'));
  assert.equal(R.generar(base({ renta: { estado: 'sin_caso', regimen: '14D8', planIncluye: true } })).length, 0);
  assert.equal(R.generar(base({ renta: { estado: 'error' } })).length, 0);
});

test('empresa EXENTA: solo PPM, pago y renta (nada de IVA)', () => {
  const compras = [doc({ folio: '10', fecha_recepcion: '2026-10-20', iva: 600000 })];
  const c = base({ exenta: true, actual: { ivaPagar: 0, ppm: 240000, f29: 240000, nuevoRemanente: 500000, debito: 0, credito: 0, ventasBase: 16000000, tasaPPM: 1.5, sinDato: false },
    historial: H6([0, 0, 0, 0, 0, 0], () => ({ ppm: 180000 })), docs: { disponible: true, actual: { ventas: [], compras } },
    renta: { estado: 'VIGENTE', finalizado: '2026-10-21', corte: '2026-09-30', anioComercial: 2026, outputs: { 'forecast.idpc': 10000000, 'forecast.ppm.imputable': 4000000, 'forecast.saldo_abril': 6000000 } } });
  const l = R.generar(c);
  assert.deepEqual(ids(l).sort(), ['renta_cobertura', 'reserva']);
  assert.match(l.find((y) => y.id === 'reserva').detectado, /^Tu PPM de este mes/);
  assert.doesNotMatch(JSON.stringify(l), /IVA/);
});

test('ventas +25 % con la misma tasa de PPM → revisar la tasa (si no hay proyección de renta)', () => {
  const l = R.generar(base({ historial: H6([800000, 800000, 800000, 800000, 800000, 800000]), actual: Object.assign(base().actual, { ventasBase: 15600000, ivaPagar: 800000 }) }));
  const x = l.find((y) => y.id === 'ventas_ppm');
  assert.match(x.detectado, /30 % sobre tu promedio de 6 meses \(\$12\.000\.000\) y tu tasa de PPM sigue en 1,5 %/);
  const otraTasa = R.generar(base({ historial: H6([800000, 800000, 800000, 800000, 800000, 800000], (i) => ({ tasa: i === 5 ? 1.2 : 1.5 })), actual: Object.assign(base().actual, { ventasBase: 15600000 }) }));
  assert.equal(otraTasa.find((y) => y.id === 'ventas_ppm'), undefined);
});

test('razonabilidad: compras 45 % bajo el promedio → ¿faltan facturas?; dentro del rango → nada', () => {
  const h = H6([800000, 800000, 800000, 800000, 800000, 800000], () => ({ credito: 2000000 }));
  let l = R.generar(base({ historial: h, actual: Object.assign(base().actual, { credito: 1100000 }) }));
  const x = l.find((y) => y.id === 'raz_compras');
  assert.match(x.detectado, /Las compras de este mes \(\$1\.100\.000 de IVA\) están 45 % bajo tu promedio de 6 meses cerrados \(\$2\.000\.000\)/);
  l = R.generar(base({ historial: h, actual: Object.assign(base().actual, { credito: 1900000 }) }));
  assert.equal(l.find((y) => y.id === 'raz_compras'), undefined);
});

function previosCon(fn) { const p = vacioPrevios(); Object.keys(p).forEach((k, i) => fn(p[k], k, i)); return p; }

test('recurrentes: proveedor presente → nada; ausente después de su día habitual → pídela; cliente recurrente sin factura', () => {
  const previos = previosCon((m, k) => { m.compras.push(doc({ rut: 'DEMO-T07', razon: 'Arriendos Ficticios Ltda.', fecha: k + '-05', iva: 380000, total: 2380000 }));
    m.ventas.push(doc({ rut: 'DEMO-T02', razon: 'Cliente Ficticio Grande SpA', fecha: k + '-10', iva: 950000, total: 5950000 })); });
  let l = R.generar(base({ docs: { disponible: true, previos, actual: { ventas: [], compras: [] } } }));
  const p = l.find((y) => y.id.startsWith('rec_prov')); const c = l.find((y) => y.id.startsWith('rec_cli'));
  assert.match(p.detectado, /En los registros disponibles de este mes no aparece una factura de Arriendos Ficticios Ltda\., que sí aparece en 6 de 6 meses anteriores/);
  assert.equal(p.accion, 'Confirma la emisión y recepción de la factura para revisar su tratamiento tributario.');
  assert.doesNotMatch(p.accion + p.impacto, /perder/);
  assert.match(c.detectado, /no aparece una factura emitida a Cliente Ficticio Grande SpA/);
  l = R.generar(base({ docs: { disponible: true, previos, actual: { ventas: [], compras: [doc({ rut: 'DEMO-T07', fecha: '2026-10-05', iva: 380000 })] } } }));
  assert.equal(l.find((y) => y.id.startsWith('rec_prov')), undefined);
  l = R.generar(base({ hoy: '2026-10-06', docs: { disponible: true, previos, actual: { ventas: [], compras: [] } } }));
  assert.equal(l.find((y) => y.id.startsWith('rec_prov')), undefined, 'antes del día habitual + margen no se avisa');
});

test('documento atípico (3 veces la mediana de esa contraparte), proveedor nuevo con monto alto, y razonable → nada', () => {
  const previos = previosCon((m, k) => { m.compras.push(doc({ rut: 'DEMO-T08', razon: 'Insumos Ficticios SpA', fecha: k + '-08', iva: 95000, total: 595000 })); });
  let l = R.generar(base({ docs: { disponible: true, previos, actual: { ventas: [], compras: [doc({ rut: 'DEMO-T08', razon: 'Insumos Ficticios SpA', folio: '9001', fecha: '2026-10-08', fecha_recepcion: '2026-10-20', iva: 380000, total: 2380000 })] } } }));
  const a = l.find((y) => y.id.startsWith('atipico'));
  assert.match(a.detectado, /Recibiste una factura de Insumos Ficticios SpA por \$2\.380\.000 \(folio 9001, 08-10\), 4 veces lo habitual con ese proveedor/);
  assert.match(a.accion, /antes del plazo de reclamo \(28-10\)/);
  l = R.generar(base({ docs: { disponible: true, previos, actual: { ventas: [], compras: [doc({ rut: 'DEMO-T08', iva: 100000, total: 600000 })] } } }));
  assert.equal(l.find((y) => y.id.startsWith('atipico')), undefined);
  l = R.generar(base({ docs: { disponible: true, previos, actual: { ventas: [], compras: [doc({ rut: 'DEMO-T10', razon: 'Proveedor Nuevo Ficticio', folio: '55', fecha_recepcion: '2026-10-21', iva: 950000, total: 5950000 })] } } }));
  assert.match(l.find((y) => y.id.startsWith('nuevo')).detectado, /primera vez en 6 meses .* Proveedor Nuevo Ficticio/);
  // Venta atípica (vs. la mediana de esa contraparte)
  const prevV = previosCon((m, k) => { m.ventas.push(doc({ rut: 'DEMO-T03', razon: 'Cliente Habitual Ficticio', fecha: k + '-12', iva: 50000, total: 297500 })); });
  l = R.generar(base({ docs: { disponible: true, previos: prevV, actual: { ventas: [doc({ rut: 'DEMO-T03', razon: 'Cliente Habitual Ficticio', folio: '700', iva: 300000, total: 1785000 })], compras: [] } } }));
  assert.match(l.find((y) => y.id.startsWith('atipico')).detectado, /^Emitiste una factura a Cliente Habitual Ficticio/);
});

test('sin documentos previos suficientes no hay reglas de comportamiento (nadie es "nuevo" ni "atípico")', () => {
  const l = R.generar(base({ docs: { disponible: true, previos: {}, actual: { ventas: [], compras: [doc({ rut: 'DEMO-T10', iva: 950000, total: 5950000 })] } } }));
  assert.equal(l.filter((y) => /^(nuevo|atipico|rec_)/.test(y.id)).length, 0);
});

const RES = (o) => o;   // resumen del RCV por tipo de DTE: {tipo: {n, neto, exento, iva, total}}
test('comprobantes de pago + boletas SIN coincidencias → nivel A: aviso preventivo SIN monto (texto de ChatGPT)', () => {
  const l = R.generar(base({ docs: { disponible: true, actual: { ventas: [], compras: [] }, resumenActual: RES({ 48: { n: 120, total: 3570000 }, 39: { n: 300, total: 5950000, neto: 5000000, iva: 950000 } }) } }));
  const x = l.find((y) => y.id === 'dup_voucher');
  assert.equal(x.nivel, 'A'); assert.equal(x.monto, 0); assert.equal(x.tier, 2);
  assert.equal(x.detectado, 'Detectamos comprobantes de pago electrónico y boletas en el mismo período.');
  assert.equal(x.impacto, 'Esto puede ser normal, pero conviene verificar que una misma venta no esté incluida dos veces en el cálculo del IVA.');
  assert.equal(x.accion, 'Revisaremos las coincidencias antes de confirmar el F29.');
  assert.doesNotMatch(JSON.stringify(l), /podría estar declarado dos veces/);
});
test('solo boletas → sin aviso; cambio de patrón → se menciona', () => {
  assert.equal(R.generar(base({ docs: { disponible: true, actual: { ventas: [], compras: [] }, resumenActual: RES({ 39: { n: 300, total: 5950000 } }) } })).find((y) => y.id === 'dup_voucher'), undefined);
  const prev = { '2026-07': { 39: { n: 1, total: 100 } }, '2026-08': { 39: { n: 1, total: 100 } }, '2026-09': { 39: { n: 1, total: 100 } } };
  const x = R.generar(base({ docs: { disponible: true, actual: { ventas: [], compras: [] }, resumenActual: RES({ 48: { n: 10, total: 1190000 }, 39: { n: 300, total: 5950000 } }), resumenPrevios: prev } })).find((y) => y.id === 'dup_voucher');
  assert.match(x.detectado, /Desde octubre aparecen comprobantes de pago electrónico que antes no tenías/);
});
test('coincidencia del mismo día: nivel B solo con los códigos DTE confirmados; en modo prudente queda como nivel A sin monto', () => {
  const ventas = [doc({ tipo_dte: 48, folio: 'v1', rut: '', fecha: '2026-10-07', total: 1190000, iva: 0 }), doc({ tipo_dte: 33, folio: '501', rut: 'DEMO-T90', fecha: '2026-10-07', total: 1195000, iva: 190800 })];
  let x = R.generar(base({ docs: { disponible: true, actual: { ventas, compras: [] }, resumenActual: {} } })).find((y) => y.id === 'dup_voucher');
  assert.equal(x.nivel, 'A'); assert.equal(x.monto, 0);
  x = R.generar(base({ docs: { disponible: true, actual: { ventas, compras: [] }, resumenActual: {} } }), { dteConfirmadoSimpleApi: true }).find((y) => y.id === 'dup_voucher');
  assert.equal(x.nivel, 'B'); assert.equal(x.tier, 0); assert.equal(x.monto, 1190000);
  assert.match(x.impacto, /Operaciones coincidentes por \$1\.190\.000\. Esto no demuestra una duplicación\./);
});
test('duplicado exacto y nota de crédito sin documento asociado visible (prudente)', () => {
  const rep = [doc({ folio: '777', rut: 'DEMO-T91', iva: 200000 }), doc({ folio: '777', rut: 'DEMO-T91', iva: 200000 })];
  let x = R.generar(base({ docs: { disponible: true, actual: { ventas: [], compras: rep } } })).find((y) => y.id === 'dup_exacto_compras');
  assert.match(x.impacto, /^Posible duplicado, a revisar/);
  const previos = previosCon((m, k) => { m.ventas.push(doc({ rut: 'DEMO-T92', fecha: k + '-03' })); });
  x = R.generar(base({ docs: { disponible: true, previos, actual: { ventas: [doc({ tipo_dte: 61, folio: '88', rut: 'DEMO-T93', iva: 120000, total: 714000 })], compras: [] } } })).find((y) => y.id.startsWith('nc_sin_ref'));
  assert.match(x.impacto, /^Posible nota de crédito sin la referencia correcta/);
});

test('NEGATIVAS · error de lectura o snapshot incompleto ≠ ausencia de documentos: sin falsos positivos', () => {
  const previos = previosCon((m, k) => { m.compras.push(doc({ rut: 'DEMO-T94', razon: 'Arriendos Ficticios Ltda.', fecha: k + '-05', iva: 380000, total: 2380000 })); });
  const nuevo = doc({ rut: 'DEMO-T95', folio: '9', fecha_recepcion: '2026-10-21', iva: 950000, total: 5950000 });
  const rep = [doc({ folio: '777', rut: 'DEMO-T96', iva: 200000 }), doc({ folio: '777', rut: 'DEMO-T96', iva: 200000 })];
  // a) error de lectura
  let l = R.generar(base({ docs: { disponible: false, error: 'HTTP 500', actual: { ventas: [], compras: [] }, previos: {} } }));
  assert.equal(l.length, 0);
  // b) lectura incompleta (más documentos que los leídos): ni recurrentes ausentes, ni proveedor nuevo, ni duplicados
  l = R.generar(base({ docs: { disponible: true, incompleto: true, previos, actual: { ventas: [], compras: [nuevo].concat(rep) } } }));
  assert.equal(l.filter((y) => /^(rec_|nuevo|atipico|dup_exacto|nc_sin)/.test(y.id)).length, 0);
  // c) meses previos SIN snapshot no cuentan como "no hubo documentos"
  const sinSnap = previosCon((m, k, i) => { if (i < 3) m.conSnapshot = false; else m.compras.push(doc({ rut: 'DEMO-T94', fecha: k + '-05', iva: 380000 })); });
  l = R.generar(base({ docs: { disponible: true, previos: sinSnap, actual: { ventas: [], compras: [nuevo] } } }));
  assert.ok(l.find((y) => y.id.startsWith('nuevo')), 'con 3 meses válidos sí se evalúa');
  assert.equal(l.find((y) => y.id.startsWith('rec_')), undefined, 'el proveedor está en 3 de 3 meses válidos (< 4): no es recurrente');
});

test('ASÍ VAMOS vs REFERENCIA ESTIMADA: el mes en curso usa la referencia y lo dice; un mes cerrado usa lo real', () => {
  const actual = { sinDato: false, tasaPPM: 1.5,
    real: { ivaPagar: 600000, ppm: 120000, f29: 720000, nuevoRemanente: 0, debito: 1800000, credito: 1200000, ventasBase: 9000000 },
    est: { ivaPagar: 985000, ppm: 185000, f29: 1170000, nuevoRemanente: 0, debito: 2850000, credito: 1930000, ventasBase: 15000000 } };
  const h = H6([800000, 820000, 850000, 830000, 840000, 870000]);
  let x = R.generar(base({ actual, historial: h })).find((y) => y.id === 'reserva');
  assert.equal(x.usa, 'estimado'); assert.match(x.detectado, /^Según la referencia estimada, tu IVA a fin de mes \(cerca de \$985\.000\) estaría 18 %/);
  assert.match(x.accion, /Reserva cerca de \$1\.170\.000/);
  x = R.generar(base({ actual, historial: h, mesEnCurso: false, periodo: '2026-09' })).find((y) => y.id === 'reserva');
  assert.equal(x, undefined, 'mes cerrado: lo real ($600.000) no está sobre el promedio');
  const acuse = R.generar(base({ actual, docs: { disponible: true, actual: { ventas: [], compras: [doc({ fecha_recepcion: '2026-10-20', iva: 600000 })] } } })).find((y) => y.id === 'acuse');
  assert.equal(acuse.usa, 'real');
  assert.equal(acuse.impacto, '$600.000 de IVA asociado a facturas pendientes de revisión; su utilización debe verificarse.');
});

test('orden: los avisos sin monto no desplazan a las 2 observaciones de mayor impacto (y son a lo más 1)', () => {
  const compras = [doc({ folio: '1', fecha_recepcion: '2026-10-20', iva: 900000 }), doc({ folio: '2', fecha_recepcion: '2026-10-01', fecha_reclamo: '2026-10-05', iva: 400000 })];
  const l = R.generar(base({ historial: H6([800000, 820000, 850000, 830000, 840000, 870000]), actual: Object.assign(base().actual, { ivaPagar: 1200000, f29: 1385000 }),
    renta: { estado: 'sin_caso', regimen: '14D3', planIncluye: true },
    docs: { disponible: true, actual: { ventas: [], compras }, resumenActual: RES({ 48: { n: 1, total: 100000 }, 39: { n: 1, total: 100000 } }) } }));
  assert.deepEqual(l.slice(0, 2).map((y) => y.id), ['acuse', 'reclamadas']);
  assert.equal(l.filter((y) => !(y.monto > 0)).length, 1);
  assert.ok(l.length <= 4);
});

test('MiRenta: desactualizada → solo el aviso de actualizar (sin montos); otro año comercial → nada; vigente → "sujeta a cambios"', () => {
  const out = { 'forecast.idpc': 53400000, 'forecast.ppm.imputable': 24565821, 'forecast.saldo_abril': 28834179, 'sim.ppm_voluntario.cuota_mensual': 9611393 };
  let l = R.generar(base({ renta: { estado: 'DESACTUALIZADA', finalizado: '2026-09-01', corte: '2026-07-31', anioComercial: 2026, outputs: out } }));
  assert.deepEqual(l.map((y) => y.id), ['renta_desact']); assert.doesNotMatch(l[0].detectado + l[0].impacto + l[0].accion, /\$/);
  assert.equal(R.generar(base({ renta: { estado: 'VIGENTE', finalizado: '2026-10-21', corte: '2026-09-30', anioComercial: 2025, outputs: out } })).length, 0);
  assert.equal(R.generar(base({ renta: { estado: 'VIGENTE', finalizado: '2026-10-21', corte: '2026-09-30', outputs: out } })).length, 0, 'sin año comercial no se verifica: no se usa');
  const x = R.generar(base({ renta: { estado: 'VIGENTE', finalizado: '2026-10-21', corte: '2026-09-30', anioComercial: 2026, outputs: out } }))[0];
  assert.match(x.accion, /proyección sujeta a cambios/); assert.equal(x.usa, 'mirenta');
});

test('tendencia y signo de notas de crédito', () => {
  assert.equal(R.signo(61), -1); assert.equal(R.signo(33), 1);
  assert.equal(R.sumaIva([doc({ iva: 100 }), doc({ tipo_dte: 61, iva: 30 })]), 70);
  const t = R.tendencia([100, 100, 100, 100, 100, 100], 112); assert.equal(Math.round(t.var * 100), 12);
  assert.equal(R.tendencia([100, null], 112), null);
});

test('RONDA 3 · promedios solo con meses cerrados comparables: un Pre-IVA enviado (estimación) no cuenta', () => {
  const h = H6([800000, 820000, 850000, 830000, 840000, 870000], (i) => (i < 3 ? { comparable: false } : {}));
  assert.equal(R.generar(base({ historial: h, actual: Object.assign(base().actual, { ivaPagar: 1500000 }) })).find((y) => y.id === 'reserva'), undefined, '3 comparables (< 4): no hay promedio');
  const h2 = H6([800000, 820000, 850000, 830000, 840000, 870000], (i) => (i === 0 ? { comparable: false, iva: 5000000 } : {}));
  const x = R.generar(base({ historial: h2, actual: Object.assign(base().actual, { ivaPagar: 985000 }) })).find((y) => y.id === 'reserva');
  assert.match(x.detectado, /promedio de 6 meses cerrados \(\$842\.000\)/);   // sin el mes no comparable (que habría inflado el promedio)
});

test('RONDA 4 · comparable es POSITIVO y por indicador: ausente, false u otro tipo → excluido', () => {
  const act = Object.assign(base().actual, { ivaPagar: 1500000 });
  for (const comp of [undefined, false, null, true, 'si', {}, { iva: 'true' }, { iva: 1 }]) {
    const h = H6([800000, 820000, 850000, 830000, 840000, 870000], () => ({ comparable: comp }));
    assert.equal(R.generar(base({ historial: h, actual: act })).find((y) => y.id === 'reserva'), undefined, JSON.stringify(comp));
  }
  // Datos parciales por indicador: el mes sirve para ventas pero no para IVA → la regla de IVA no tiene 4 meses; la de ventas sí
  const h = H6([800000, 800000, 800000, 800000, 800000, 800000], (i) => ({ comparable: i < 3 ? { ventas: true, iva: false, debito: true, credito: true, ppm: true } : TODO }));
  assert.equal(R.generar(base({ historial: h, actual: act })).find((y) => y.id === 'reserva'), undefined);
  assert.ok(R.generar(base({ historial: h, actual: Object.assign(base().actual, { ventasBase: 15600000 }) })).find((y) => y.id === 'ventas_ppm'));
});

test('RONDA 4/5 · evaluarComparable: período cerrado + evidencia suficiente + componentes por indicador', () => {
  const E = R.evaluarComparable, o = { periodoAbierto: '2026-10', mesHoy: '2026-10', ahora: Date.parse('2026-10-22T12:00:00Z') };
  const fila = { periodo: '2026-09', debito_iva: 2500000, credito_iva: 1700000, remanente: 0, ppm: 190000, ppm_base: 12700000, estado_contable: 'completado', updated_at: '2026-10-15T15:00:00Z' };
  let r = E(fila, o);
  assert.deepEqual(r.comparable, { iva: true, debito: true, credito: true, ppm: true, ventas: true }); assert.equal(r.motivo, null);
  assert.equal(r.evidencia, 'estado contable: completado'); assert.equal(r.registradoAt, '2026-10-15T15:00:00Z');
  assert.equal(E(Object.assign({}, fila, { estado_contable: '  COMPLETADO ' }), o).comparable.iva, true);   // trim + minúsculas
  // Fila marcador 0/0 → no sirve para IVA ni débito/crédito; sí para PPM/ventas si los trae
  r = E(Object.assign({}, fila, { debito_iva: 0, credito_iva: 0 }), o);
  assert.equal(r.comparable.iva, false); assert.equal(r.comparable.debito, false); assert.equal(r.comparable.ppm, true); assert.match(r.motivo, /iva, debito, credito/);
  assert.equal(E(Object.assign({}, fila, { remanente: null }), o).comparable.iva, false);
  assert.equal(E(Object.assign({}, fila, { ppm: null }), o).comparable.ppm, false);
  assert.equal(E(Object.assign({}, fila, { ppm_base: 0 }), o).comparable.ventas, false);
  // Período no cerrado, error de lectura, sin registro, período mal formado
  assert.match(E(Object.assign({}, fila, { periodo: '2026-10' }), o).motivo, /no cerrado/);
  assert.match(E(fila, { periodoAbierto: '2026-10', mesHoy: '2026-09' }).motivo, /no cerrado/);
  assert.match(E(fila, Object.assign({ errorLectura: true }, o)).motivo, /error de lectura/);
  assert.match(E(null, o).motivo, /sin registro/);
  assert.match(E(Object.assign({}, fila, { periodo: '2026-9' }), o).motivo, /período no identificable/);
});

test('RONDA 5 · NEGATIVAS de evidencia: borrador, pendiente, vacío, desconocido y procesado_at aislado → excluido', () => {
  const E = R.evaluarComparable, o = { periodoAbierto: '2026-10', mesHoy: '2026-10', ahora: Date.parse('2026-10-22T12:00:00Z') };
  const base = { periodo: '2026-09', debito_iva: 2500000, credito_iva: 1700000, remanente: 0, ppm: 190000, ppm_base: 12700000 };
  for (const est of ['borrador', 'pendiente', 'PENDIENTE', '', '   ', null, undefined, 'validado', 'finalizado', 'listo', 'terminado', 'aprobado']) {
    const r = E(Object.assign({}, base, { estado_contable: est }), o);
    assert.deepEqual(Object.values(r.comparable), [false, false, false, false, false], String(est));
    assert.match(r.motivo, /sin evidencia de registro de Contable/);
  }
  const r = E(Object.assign({}, base, { procesado_at: '2026-10-05T12:00:00Z' }), o);   // procesado_at aislado: solo trazabilidad
  assert.equal(r.comparable.iva, false); assert.equal(r.procesadoAt, '2026-10-05T12:00:00Z');
  // Fechas de RRHH: con la configuración por defecto NO cuentan (hoy las escribe el flujo de remuneraciones)
  assert.equal(E(Object.assign({}, base, { fecha_finalizado: '2026-10-10T12:00:00Z' }), o).comparable.iva, false);
  assert.equal(E(Object.assign({}, base, { fecha_aprobacion: '2026-10-10T12:00:00Z' }), o).comparable.iva, false);
  assert.deepEqual([...R.ESTADOS_TERMINADOS], ['completado']);
});

test('RONDA 5 · POSITIVAS: estado terminado confirmado; fecha_finalizado / fecha_aprobacion válidas solo si se habilitan', () => {
  const E = R.evaluarComparable, o = { periodoAbierto: '2026-10', mesHoy: '2026-10', ahora: Date.parse('2026-10-22T12:00:00Z') };
  const base = { periodo: '2026-09', debito_iva: 2500000, credito_iva: 1700000, remanente: 0, ppm: 190000, ppm_base: 12700000 };
  assert.equal(E(Object.assign({}, base, { estado_contable: 'completado' }), o).comparable.iva, true);
  const on = { evidenciaFechasRrhh: true };
  let r = E(Object.assign({}, base, { fecha_finalizado: '2026-10-10T12:00:00Z' }), o, on);
  assert.equal(r.comparable.iva, true); assert.equal(r.evidencia, 'fecha de finalización');
  r = E(Object.assign({}, base, { fecha_aprobacion: '2026-10-08T12:00:00Z' }), o, on);
  assert.equal(r.comparable.iva, true); assert.equal(r.evidencia, 'fecha de aprobación');
  // Fechas inválidas o en el futuro no cuentan
  assert.equal(E(Object.assign({}, base, { fecha_finalizado: 'no-es-fecha' }), o, on).comparable.iva, false);
  assert.equal(E(Object.assign({}, base, { fecha_aprobacion: '2030-01-01T00:00:00Z' }), o, on).comparable.iva, false);
});
