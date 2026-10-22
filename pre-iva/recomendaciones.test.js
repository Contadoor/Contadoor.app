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
const H6 = (iva, extra) => ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'].map((p, i) => Object.assign({ periodo: p, iva: iva[i], ppm: 150000, debito: 2500000, credito: 1700000, ventas: 12000000, tasa: 1.5 }, extra ? extra(i) : {}));
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
  assert.ok(x); assert.match(x.detectado, /\$985\.000\) está 18 % sobre tu promedio de 6 meses \(\$835\.000\)/);
  assert.match(x.accion, /Reserva \$985\.000 .* antes del 20-11/); assert.equal(x.monto, 150000);
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
    renta: { estado: 'VIGENTE', finalizado: '2026-10-21T15:00:00Z', corte: '2026-09-30', outputs: { 'forecast.idpc': 53400000, 'forecast.ppm.imputable': 24565821, 'forecast.saldo_abril': 28834179 } } });
  const l = R.generar(c);
  assert.ok(l.length <= 4);
  assert.equal(l[0].id, 'sii'); assert.match(l[0].detectado, /desde el 02-10/);
  for (let i = 2; i < l.length; i++) assert.ok(l[i - 1].tier < l[i].tier || l[i - 1].monto >= l[i].monto);
});

test('MiRenta: cobertura del PPM con escenario de PPM voluntario, fechas de la corrida; desactualizada; sin caso solo 14 D N°3 con plan', () => {
  const out = { 'forecast.idpc': 53400000, 'forecast.ppm.imputable': 24565821, 'forecast.saldo_abril': 28834179, 'sim.ppm_voluntario.cuota_mensual': 9611393 };
  let x = R.generar(base({ renta: { estado: 'VIGENTE', finalizado: '2026-10-21T15:00:00Z', corte: '2026-09-30', outputs: out } })).find((y) => y.id === 'renta_cobertura');
  assert.match(x.detectado, /actualizada el 21-10, datos al 30-09\), tus PPM cubren el 46 % del impuesto de abril: faltarían \$28\.834\.179/);
  assert.match(x.accion, /con \$9\.611\.393 al mes hasta diciembre podrías llegar a abril sin saldo/); assert.equal(x.monto, 28834179);
  x = R.generar(base({ renta: { estado: 'VIGENTE', finalizado: '2026-10-21', corte: '2026-09-30', outputs: Object.assign({}, out, { 'sim.ppm_voluntario.cuota_mensual': null }) } })).find((y) => y.id === 'renta_cobertura');
  assert.doesNotMatch(x.accion, /\$/);
  x = R.generar(base({ renta: { estado: 'DESACTUALIZADA', finalizado: '2026-09-01', corte: '2026-07-31', outputs: { 'forecast.idpc': 1000, 'forecast.ppm.imputable': 2000, 'forecast.saldo_abril': -1000 } } })).find((y) => y.id === 'renta_desact');
  assert.match(x.detectado, /datos al 31-07 y ya hay datos nuevos/);
  assert.ok(R.generar(base({ renta: { estado: 'sin_caso', regimen: '14D3', planIncluye: true } })).find((y) => y.id === 'renta_activar'));
  assert.equal(R.generar(base({ renta: { estado: 'sin_caso', regimen: '14D8', planIncluye: true } })).length, 0);
  assert.equal(R.generar(base({ renta: { estado: 'error' } })).length, 0);
});

test('empresa EXENTA: solo PPM, pago y renta (nada de IVA)', () => {
  const compras = [doc({ folio: '10', fecha_recepcion: '2026-10-20', iva: 600000 })];
  const c = base({ exenta: true, actual: { ivaPagar: 0, ppm: 240000, f29: 240000, nuevoRemanente: 500000, debito: 0, credito: 0, ventasBase: 16000000, tasaPPM: 1.5, sinDato: false },
    historial: H6([0, 0, 0, 0, 0, 0], () => ({ ppm: 180000 })), docs: { disponible: true, actual: { ventas: [], compras } },
    renta: { estado: 'VIGENTE', finalizado: '2026-10-21', corte: '2026-09-30', outputs: { 'forecast.idpc': 10000000, 'forecast.ppm.imputable': 4000000, 'forecast.saldo_abril': 6000000 } } });
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
  assert.match(x.detectado, /Las compras de este mes \(\$1\.100\.000 de IVA, proyectado al cierre\) están 45 % bajo tu promedio de 6 meses \(\$2\.000\.000\)/);
  l = R.generar(base({ historial: h, actual: Object.assign(base().actual, { credito: 1900000 }) }));
  assert.equal(l.find((y) => y.id === 'raz_compras'), undefined);
});

function previosCon(fn) { const p = vacioPrevios(); Object.keys(p).forEach((k, i) => fn(p[k], k, i)); return p; }

test('recurrentes: proveedor presente → nada; ausente después de su día habitual → pídela; cliente recurrente sin factura', () => {
  const previos = previosCon((m, k) => { m.compras.push(doc({ rut: 'DEMO-T07', razon: 'Arriendos Ficticios Ltda.', fecha: k + '-05', iva: 380000, total: 2380000 }));
    m.ventas.push(doc({ rut: 'DEMO-T02', razon: 'Cliente Ficticio Grande SpA', fecha: k + '-10', iva: 950000, total: 5950000 })); });
  let l = R.generar(base({ docs: { disponible: true, previos, actual: { ventas: [], compras: [] } } }));
  const p = l.find((y) => y.id.startsWith('rec_prov')); const c = l.find((y) => y.id.startsWith('rec_cli'));
  assert.match(p.detectado, /Todos los meses le compras a Arriendos Ficticios Ltda\. \(6 de 6 meses, unos \$380\.000 de IVA/);
  assert.match(p.accion, /antes del 31-10/);
  assert.match(c.detectado, /le facturas a Cliente Ficticio Grande SpA .* y este mes aún no hay factura emitida/);
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
test('posible doble IVA: comprobantes de pago electrónico + boletas SIN coincidencias → alerta prudente y de prioridad alta', () => {
  const l = R.generar(base({ docs: { disponible: true, actual: { ventas: [], compras: [] }, resumenActual: RES({ 48: { n: 120, total: 3570000 }, 39: { n: 300, total: 5950000, neto: 5000000, iva: 950000 } }) } }));
  const x = l[0];
  assert.equal(x.id, 'dup_voucher');
  assert.match(x.detectado, /comprobantes de pago electrónico \(\$3\.570\.000\) y también boletas \(\$5\.950\.000\)/);
  assert.match(x.impacto, /^Posible duplicado, a revisar: hasta \$570\.000 de IVA/);
  assert.match(x.accion, /Si cambiaste de sistema de emisión o usas ambos/);
});
test('solo boletas → sin alerta de duplicado; cambio de patrón → se menciona', () => {
  assert.equal(R.generar(base({ docs: { disponible: true, actual: { ventas: [], compras: [] }, resumenActual: RES({ 39: { n: 300, total: 5950000 } }) } })).find((y) => y.id === 'dup_voucher'), undefined);
  const prev = { '2026-07': { 39: { n: 1, total: 100 } }, '2026-08': { 39: { n: 1, total: 100 } }, '2026-09': { 39: { n: 1, total: 100 } } };
  const x = R.generar(base({ docs: { disponible: true, actual: { ventas: [], compras: [] }, resumenActual: RES({ 48: { n: 10, total: 1190000 }, 39: { n: 300, total: 5950000 } }), resumenPrevios: prev } })).find((y) => y.id === 'dup_voucher');
  assert.match(x.detectado, /Desde octubre aparecen comprobantes de pago electrónico que antes no tenías/);
});
test('voucher que coincide con una factura del mismo día (±1 %) → detalle dentro de la alerta; duplicado exacto; NC sin documento asociado', () => {
  const ventas = [doc({ tipo_dte: 48, folio: 'v1', rut: '', fecha: '2026-10-07', total: 1190000, iva: 0 }), doc({ tipo_dte: 33, folio: '501', rut: 'DEMO-T04', fecha: '2026-10-07', total: 1195000, iva: 190800 })];
  let x = R.generar(base({ docs: { disponible: true, actual: { ventas, compras: [] }, resumenActual: {} } })).find((y) => y.id === 'dup_voucher');
  assert.match(x.detectado, /Detectamos \$1\.190\.000 en comprobantes de pago electrónico que coinciden con facturas o boletas del mismo día/);
  const rep = [doc({ folio: '777', rut: 'DEMO-T09', iva: 200000 }), doc({ folio: '777', rut: 'DEMO-T09', iva: 200000 })];
  x = R.generar(base({ docs: { disponible: true, actual: { ventas: [], compras: rep } } })).find((y) => y.id === 'dup_exacto_compras');
  assert.match(x.detectado, /aparece dos veces con el mismo tipo, folio y contraparte \(por ejemplo, folio 777\)/);
  const previos = previosCon((m, k) => { m.ventas.push(doc({ rut: 'DEMO-T01', fecha: k + '-03' })); });
  x = R.generar(base({ docs: { disponible: true, previos, actual: { ventas: [doc({ tipo_dte: 61, folio: '88', rut: 'DEMO-T05', iva: 120000, total: 714000 })], compras: [] } } })).find((y) => y.id.startsWith('nc_sin_ref'));
  assert.match(x.impacto, /^Posible nota de crédito sin la referencia correcta/);
});

test('tendencia y signo de notas de crédito', () => {
  assert.equal(R.signo(61), -1); assert.equal(R.signo(33), 1);
  assert.equal(R.sumaIva([doc({ iva: 100 }), doc({ tipo_dte: 61, iva: 30 })]), 70);
  const t = R.tendencia([100, 100, 100, 100, 100, 100], 112); assert.equal(Math.round(t.var * 100), 12);
  assert.equal(R.tendencia([100, null], 112), null);
});
