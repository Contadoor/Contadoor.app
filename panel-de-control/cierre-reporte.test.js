// node --test panel-de-control/cierre-reporte.test.js  (datos ficticios) — REPORTE-AUTO B
const test = require('node:test'); const assert = require('node:assert');
const C = require('./cierre-reporte.js');
const foto = { impuestos: { estado: 'ok', fuente: 'sii', total_f29: 993269, iva_pagar: 829519, ppm: 26250, ret_hon: 137500, iu: 0, iu_pendiente: true, remanente_anterior: 120481,
  remanente_anterior_fuente: 'manual', vence: '2026-11-20' }, rrhh: { estado: 'pendiente' }, servicios: { estado: 'sin_factura' } };
test('filasFoto: F29 del SII, IU y RR. HH. pendientes, sin factura', () => {
  const f = C.filasFoto(foto);
  assert.deepEqual(f[0], ['Impuestos F29 (datos del SII)', '$993.269']);
  assert.ok(f.some((x) => x[0] === '· Impuesto único' && x[1] === 'Pendiente RR. HH.'));
  assert.ok(f.some((x) => x[0] === '· Remanente anterior (a mano)'));
  assert.ok(f.some((x) => x[0] === '· Vence' && x[1] === '20-11-2026'));
  assert.deepEqual(f.find((x) => x[0] === 'RR. HH.'), ['RR. HH.', 'Pendiente']);
  assert.deepEqual(f.find((x) => x[0] === 'Nuestros servicios'), ['Nuestros servicios', 'Sin factura emitida']);
  const g = C.filasFoto({ impuestos: { estado: 'no_aplica' }, rrhh: { estado: 'listo', cotizaciones: 180000 }, servicios: { estado: 'emitida', monto: 95000, folios: ['16600'] } });
  assert.deepEqual(g[0], ['Impuestos F29', 'No aplica']);
  assert.equal(g.find((x) => x[0] === 'Nuestros servicios')[1], '$95.000 · factura N° 16600');
});
test('textoAviso: F29 sin declarar con períodos', () => {
  assert.equal(C.textoAviso({ codigo: 'F29_SIN_DECLARAR', periodos: ['2026-05', '2026-06'] }), 'Hay F29 sin declarar según Cartapra: 2026-05, 2026-06.');
});
test('mensajeError: permisos y huella', () => {
  assert.match(C.mensajeError('SIN_PERMISO: x'), /Master o el analista/);
  assert.match(C.mensajeError('DATOS_CAMBIARON: x'), /cambió/);
});
