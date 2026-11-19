// node --test pre-iva/reporte-sii.test.js  (datos ficticios) — REPORTE-AUTO A
const test = require('node:test'); const assert = require('node:assert');
const R = require('./reporte-sii.js');
test('validarManual: entero en pesos y motivo de 10 a 500 caracteres', () => {
  assert.equal(R.validarManual('120000', 'F29 septiembre en papel'), null);
  assert.equal(R.validarManual('0', 'Sin remanente, confirmado con el cliente'), null);
  assert.match(R.validarManual('120.000', 'F29 septiembre en papel'), /sin puntos/);
  assert.match(R.validarManual('-1', 'F29 septiembre en papel'), /sin puntos/);
  assert.match(R.validarManual('', 'F29 septiembre en papel'), /sin puntos/);
  assert.match(R.validarManual('100', 'corto'), /mínimo 10/);
  assert.match(R.validarManual('100', '[SII] suplantación del origen'), /\[SII\]/);
});
test('perGuion: AAAAMM y AAAA-MM → AAAA-MM; inválido → vacío', () => {
  assert.equal(R.perGuion('202610'), '2026-10'); assert.equal(R.perGuion('2026-10'), '2026-10'); assert.equal(R.perGuion('x'), '');
});
test('mensajeError: códigos conocidos en lenguaje simple; HTML fuera', () => {
  assert.match(R.mensajeError('DATOS_CAMBIARON: x'), /cambiaron/);
  assert.match(R.mensajeError('SOLO_ANALISTA_ASIGNADO: x'), /analista contable responsable/);
  assert.equal(R.mensajeError('REMANENTE_SIN_F29: <b>No hay F29</b>'), 'No hay F29');
});
test('filasResumen: montos del servidor, IU pendiente y total', () => {
  const v = { iu_pendiente: true, entrada: { ppm_tasa: 0.25, ppm_tasa_fuente: 'ficha' }, remanente: { accion: 'registrar_manual', fuente: 'manual' },
    previa: { debito: 1900000, credito: 950000, remanente_anterior: 120481, iva_pagar: 829519, remanente_siguiente: 0, ppm: 26250, ret_hon: 137500, iu: 0, otros_imp: 0, total_f29: 993269 } };
  const f = R.filasResumen(v);
  assert.deepEqual(f[f.length - 1], ['Total F29', '$993.269']);
  assert.ok(f.some((x) => x[1] === 'Pendiente RR. HH.'));
  assert.ok(f.some((x) => /0,25 % \(ficha\)/.test(x[0])));
  assert.deepEqual(R.filasResumen({ previa: null }), []);
});
test('aplicar y crearObligacion envían lo que espera el servidor (fetch simulado)', async () => {
  const llamadas = [];
  const f = (path, o) => { llamadas.push([path, JSON.parse(o.body)]); return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(path.includes('crear_obligacion') ? '[{"resultado":"creada"}]' : '{"ok":true}') }); };
  await R.aplicar(2, '202610', 'a'.repeat(32), '120000', 'motivo de prueba', f);
  assert.deepEqual(llamadas[0], ['rpc/reporte_aplicar_preiva_sii', { p_cliente_id: 2, p_periodo: '2026-10', p_huella: 'a'.repeat(32), p_rem_cod77: 120000, p_rem_motivo: 'motivo de prueba' }]);
  const ob = await R.crearObligacion('77000001-7', { reporte_id: 308, periodo: '2026-10', obligacion: { concepto: 'F29 2026/10', monto_total: 10, monto_exigible: 10, monto_postergado: 0, vencimiento: '2026-11-20' } }, f);
  assert.equal(ob.resultado, 'creada');
  assert.equal(llamadas[1][1].p_ref_reporte_id, 308); assert.equal(llamadas[1][1].p_tipo_obligacion, 'f29'); assert.equal(llamadas[1][1].p_area_origen, 'contable');
});
test('error del servidor se propaga (fail-closed, nada se da por guardado)', async () => {
  const f = () => Promise.resolve({ ok: false, status: 400, text: () => Promise.resolve('{"code":"22023","message":"REPORTE_YA_VALIDADO: x"}') });
  await assert.rejects(R.aplicar(2, '202610', 'a'.repeat(32), null, null, f), /REPORTE_YA_VALIDADO/);
});
