// node --test panel-de-control/cierre-reporte.test.js  (datos ficticios) — REPORTE-AUTO B (un solo paso, decisiones 19-11)
const test = require('node:test'); const assert = require('node:assert');
const C = require('./cierre-reporte.js');
const foto = { impuestos: { estado: 'ok', fuente: 'sii', total_f29: 993269, iva_pagar: 829519, ppm: 26250, ret_hon: 137500, iu: 0, iu_pendiente: true, remanente_anterior: 120481,
  remanente_anterior_fuente: 'manual', vence: '2026-11-20' }, rrhh: { estado: 'pendiente' }, servicios: { estado: 'sin_factura' } };
test('filasFoto: F29 del SII, IU pendiente, sin factura', () => {
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
test('filasFoto: impuestos por pasar desde el SII y cliente sin trabajadores', () => {
  const f = C.filasFoto({ impuestos: { estado: 'por_aplicar_sii' }, rrhh: { estado: 'no_aplica' }, servicios: { estado: 'sin_factura' } });
  assert.deepEqual(f[0], ['Impuestos F29', 'Se pasan desde el SII al cerrar']);
  assert.deepEqual(f.find((x) => x[0] === 'RR. HH.'), ['RR. HH.', 'No aplica (sin trabajadores con sueldo)']);
});
test('filasPuente: vista previa del servidor (reusa el Pre-IVA) y vacío sin previa', () => {
  const f = C.filasPuente({ previa: { debito: 380000, credito: 190000, remanente_anterior: 301202, iva_pagar: 0, remanente_siguiente: 111202, ppm: 10000, ret_hon: 0, iu: 0, otros_imp: 0, total_f29: 10000 },
    entrada: { ppm_tasa: 0.5, ppm_tasa_fuente: 'sii' }, remanente: { accion: 'registrar_sii', cod77: 300000 } });
  assert.deepEqual(f[f.length - 1], ['Total F29', '$10.000']);
  assert.ok(f.some((x) => x[0] === 'Remanente para el mes siguiente' && x[1] === '$111.202'));
  assert.deepEqual(C.filasPuente(null), []); assert.deepEqual(C.filasPuente({ previa: null }), []);
});
test('textoAviso: lo declarado, lo no declarado, lo observado y avisos internos', () => {
  assert.equal(C.textoAviso({ codigo: 'F29_SIN_DECLARAR', periodos: ['2026-05', '2026-06'] }), 'Hay F29 sin declarar según Cartapra: 2026-05, 2026-06.');
  assert.equal(C.textoAviso({ codigo: 'F29_DECLARADO', periodos: ['2026-01'] }), 'F29 declarados según Cartapra: 2026-01.');
  assert.equal(C.textoAviso({ codigo: 'F29_OBSERVADO', periodos: ['2026-03'] }), 'F29 observados por el SII: 2026-03.');
  assert.match(C.textoAviso({ codigo: 'SII_OBSERVACIONES', cartas: 1, cumple: false, f22: 0 }), /1 carta o notificación.*no cumple/);
  assert.match(C.textoAviso({ codigo: 'FACTURA_NO_EMITIDA' }), /^Interno: .*no bloquea/);
});
test('validarManual: igual que el Pre-IVA', () => {
  assert.equal(C.validarManual('50000', 'F29 septiembre en papel'), null);
  assert.match(C.validarManual('50.000', 'F29 septiembre en papel'), /sin puntos/);
  assert.match(C.validarManual('1', '[SII] suplantación del origen'), /\[SII\]/);
});
test('mensajeError: permisos, huella y cierre detenido por el puente', () => {
  assert.match(C.mensajeError('SIN_PERMISO: x'), /solo el Master o el analista contable asignado/);
  assert.match(C.mensajeError('DATOS_CAMBIARON: x'), /cambió/);
  assert.equal(C.mensajeError('CIERRE_DETENIDO: el paso de los datos del SII al reporte se detuvo: REMANENTE_SIN_F29: No hay F29 de 2026-09 en Cartapra: ingresa el remanente'),
    'El cierre se detuvo: No hay F29 de 2026-09 en Cartapra: ingresa el remanente');
});
