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
test('aplicar envía lo que espera el servidor y NO llama a crear_obligacion (R2: la obligación la crea el servidor)', async () => {
  const llamadas = [];
  const f = (path, o) => { llamadas.push([path, JSON.parse(o.body)]); return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve('{"ok":true,"obligacion_f29":{"resultado":"creada","id":7}}') }); };
  const res = await R.aplicar(2, '202610', 'a'.repeat(32), '120000', 'motivo de prueba', f);
  assert.deepEqual(llamadas[0], ['rpc/reporte_aplicar_preiva_sii', { p_cliente_id: 2, p_periodo: '2026-10', p_huella: 'a'.repeat(32), p_rem_cod77: 120000, p_rem_motivo: 'motivo de prueba' }]);
  assert.equal(llamadas.length, 1);
  assert.equal(R.crearObligacion, undefined);
  assert.equal(R.textoObligacion(res.obligacion_f29), 'Obligación F29 registrada en Pagos.');
  assert.match(R.textoObligacion({ resultado: 'reutilizada' }), /sin duplicar/);
  assert.equal(R.textoObligacion(null), '');
});
test('el código del Pre-IVA ya no contiene llamadas a crear_obligacion', () => {
  const src = require('node:fs').readFileSync(require('node:path').join(__dirname, 'reporte-sii.js'), 'utf8');
  assert.ok(!/rpc\(\s*'crear_obligacion'/.test(src));
});
test('AUTO-A02: cada dato muestra su fuente (SII, a mano, Gestoor, ficha, RR. HH.)', () => {
  const v = { rrhh: { iu_estado: 'no_aplica' }, entrada: { ppm_tasa: 0.5, ppm_tasa_fuente: 'sii' }, remanente: { accion: 'usar', fuente: 'mes_anterior' },
    previa: { debito: 1, credito: 1, remanente_anterior: 1, iva_pagar: 0, remanente_siguiente: 0, ppm: 1, ret_hon: 0, iu: 0, otros_imp: 0, total_f29: 1 } };
  const f = R.filasResumen(v);
  assert.equal(f.find((x) => /^Remanente anterior/.test(x[0]))[2], 'mes_anterior');
  assert.equal(f.find((x) => /^IVA débito/.test(x[0]))[2], 'sii');
  assert.equal(f.find((x) => /^PPM/.test(x[0]))[2], 'sii');
  assert.equal(f.find((x) => /^Impuesto único/.test(x[0]))[1], 'No aplica (sin trabajadores)');
  assert.equal(R.filasResumen({ ...v, remanente: { accion: 'registrar_manual', fuente: 'manual' } }).find((x) => /^Remanente anterior/.test(x[0]))[2], 'manual');
  assert.match(R.chipFuente('manual'), /A mano/); assert.match(R.chipFuente('sii'), /SII/); assert.equal(R.chipFuente('x'), '');
});
test('mensajeError: bloqueos del puente sin códigos internos', () => {
  assert.equal(R.mensajeError('PREIVA_SII_BLOQUEADO: IU_PENDIENTE_RRHH (RR. HH. aún no informa el impuesto único); CREDITO_PROPORCIONAL (Hay IVA de uso común)'),
    'RR. HH. aún no informa el impuesto único; Hay IVA de uso común');
});
test('error del servidor se propaga (fail-closed, nada se da por guardado)', async () => {
  const f = () => Promise.resolve({ ok: false, status: 400, text: () => Promise.resolve('{"code":"22023","message":"REPORTE_YA_VALIDADO: x"}') });
  await assert.rejects(R.aplicar(2, '202610', 'a'.repeat(32), null, null, f), /REPORTE_YA_VALIDADO/);
});
