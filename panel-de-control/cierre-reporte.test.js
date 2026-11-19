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
test('R2 · RR. HH.: «no aplica» confirmado por RR. HH., por quien cierra o pendiente de confirmar', () => {
  const g = (rr) => C.filasFoto({ impuestos: { estado: 'ok', total_f29: 1, iu_estado: 'no_aplica', iu: 0 }, rrhh: rr, servicios: {} });
  assert.equal(g({ estado: 'no_aplica' }).find((x) => x[0] === 'RR. HH.')[1], 'No aplica (sin trabajadores con sueldo)');
  assert.equal(g({ estado: 'no_aplica', confirmacion: 'cierre' }).find((x) => x[0] === 'RR. HH.')[1], 'No aplica (confirmado al cerrar)');
  assert.equal(g({ estado: 'no_aplica', confirmacion: 'requerida' }).find((x) => x[0] === 'RR. HH.')[1], 'Sin confirmar si hubo trabajadores');
  assert.equal(g({ estado: 'no_aplica' }).find((x) => x[0] === '· Impuesto único')[1], 'No aplica ($0, sin trabajadores)');
});
test('R2 · soloConfirmable: solo RRHH_SITUACION_DESCONOCIDA se resuelve con la casilla; IU pendiente u otros, no', () => {
  assert.equal(C.soloConfirmable([{ codigo: 'RRHH_SITUACION_DESCONOCIDA', confirmable: true }]), true);
  assert.equal(C.soloConfirmable([{ codigo: 'RRHH_SITUACION_DESCONOCIDA', confirmable: true }, { codigo: 'IU_PENDIENTE_RRHH' }]), false);
  assert.equal(C.soloConfirmable([]), false);
});
test('R2 · textoAviso: avisos internos de la obligación, F29 no encontrado / no verificable y estado sin verificar', () => {
  assert.match(C.textoAviso({ codigo: 'OBLIGACION_F29_SE_CREA', mensaje: 'Al cerrar se registra la obligación F29 en Pagos por $10000.' }), /^Interno: Al cerrar se registra/);
  assert.match(C.textoAviso({ codigo: 'F29_NO_ENCONTRADO', periodos: ['2026-09'] }), /^Interno: .*2026-09/);
  assert.match(C.textoAviso({ codigo: 'F29_NO_VERIFICABLE' }), /^Interno: /);
  assert.equal(C.textoAviso({ codigo: 'F29_ESTADO_SIN_VERIFICAR', periodos: ['2026-09'] }), 'F29 declarados con un estado del SII por verificar: 2026-09.');
});
test('R2 · cierresVigentes lee la fuente oficial (reportes_cierres VIGENTE del período) y falla cerrado a {}', async () => {
  const pedidos = [];
  const f = (p) => { pedidos.push(p); return Promise.resolve({ ok: true, json: () => Promise.resolve([{ reporte_id: 308, version: 2, cerrado_at: '2026-11-19T12:00:00Z' }]) }); };
  const m = await C.cierresVigentes('2026-10', f);
  assert.deepEqual(m, { 308: { version: 2, cerrado_at: '2026-11-19T12:00:00Z' } });
  assert.equal(pedidos[0], 'reportes_cierres?select=reporte_id,version,cerrado_at&estado=eq.VIGENTE&periodo=eq.2026-10');
  assert.deepEqual(await C.cierresVigentes('2026-10', () => Promise.resolve({ ok: false, status: 404 })), {});
  assert.deepEqual(await C.cierresVigentes('2026-10', () => Promise.reject(new Error('red'))), {});
  assert.deepEqual(await C.cierresVigentes('x', f), {});
});
test('R2 · el cierre ya no crea la obligación desde el navegador; solo informa el resultado del servidor', () => {
  const src = require('node:fs').readFileSync(require('node:path').join(__dirname, 'cierre-reporte.js'), 'utf8');
  assert.ok(!/crearObligacion\(|crear_obligacion'/.test(src));
  assert.ok(/p_confirma_sin_trabajadores/.test(src));
  assert.equal(C.textoObligacion({ resultado: 'actualizada' }), 'Obligación F29 de Pagos actualizada (no tenía dinero conciliado).');
});
test('R2 · mensajeError: obligación con pagos y cierre concurrente en lenguaje simple', () => {
  assert.equal(C.mensajeError('CIERRE_DETENIDO: la obligación F29 de Pagos no se pudo registrar o confirmar: OBLIGACION_F29_CON_PAGOS: La obligación F29 tiene pagos'),
    'El cierre se detuvo: La obligación F29 tiene pagos');
  assert.match(C.mensajeError('REPORTE_YA_CERRADO: x'), /otra persona lo cerró/);
  assert.equal(C.mensajeError('REPORTE_NO_LISTO: RRHH_PENDIENTE (RR. HH. no está listo)'), 'RR. HH. no está listo');
});
