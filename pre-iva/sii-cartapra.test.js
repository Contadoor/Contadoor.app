// node --test pre-iva/sii-cartapra.test.js  (datos ficticios) — SII-PREIVA-F2b R2
const test = require('node:test'); const assert = require('node:assert');
const S = require('./sii-cartapra.js');
const REM = { periodo: '202609', folio: 209, cod77: 12345, fuente: 'sii_codigo_77', metodo: 'ART27_UTM_V1', mes_utm_origen: '2026-10', mes_utm_destino: '2026-11',
  utm_origen: 72151, utm_destino: 72440, cod504: 12394, falta_utm: [] };
const R = { conexion: { estado: 'conectada' }, datos_al: '2026-11-18T10:25:00Z', avisos: ['compras_pendientes'],
  ventas: { documentos: 4, neto: 140000, exento: 20000, iva: 26600, por_tipo: { '33': { n: 2 }, '61': { n: 1 }, '34': { n: 1 } } },
  compras: { registro: { documentos: 2, neto: 35000, exento: 0, iva: 6650 }, pendiente: { documentos: 1, iva: 5700 }, por_tipo: { '33': { n: 1 }, '61': { n: 1 } } },
  remanente_anterior: REM, f29_periodo: null };
test('mapea débito, crédito, neto, exento, desglose y fecha en hora de Chile', () => {
  const p = S.aPantalla(R, { fuente: 'contable', valor: 12394 }, null);
  assert.deepStrictEqual([p.debito, p.credito, p.netoVentas, p.exentoVentas, p.netoCompras], [26600, 6650, 140000, 20000, 35000]);
  assert.deepStrictEqual(p.porTipoVentas, { 'Factura electrónica': 2, 'Nota de crédito': 1, 'Factura exenta': 1 });
  assert.strictEqual(p.datosAlTxt, '18-11-2026, 07:25', '10:25 UTC = 07:25 en Chile (verano, UTC−3)');
  assert.strictEqual(p.avisos.length, 1, 'solo pendientes: Contable coincide y no hay guardado');
});
test('remanente oficial del SII: cód. 77 × UTM = cód. 504, con su origen', () => {
  const p = S.aPantalla(R, { fuente: 'contable', valor: 12394 });
  assert.strictEqual(p.remanente.valor, 12394);
  assert.strictEqual(p.remanente.texto, 'F29 de septiembre 2026 en el SII (folio 209): cód. 77 $12.345 × UTM noviembre 2026 $72.440 ÷ UTM octubre 2026 $72.151 = cód. 504 $12.394');
  assert.match(S.aPantalla(R, { fuente: 'contable', valor: 999 }).avisos.join(' '), /Contable tiene \$999 y el F29 del SII da \$12\.394\. Se usa el del SII/);
  assert.match(S.aPantalla(R, { fuente: 'manual', valor: 5 }).avisos.join(' '), /ingresado a mano/);
});
test('sin F29 anterior, sin montos o sin UTM → Contable y aviso', () => {
  const con = (ra) => S.aPantalla({ ...R, remanente_anterior: ra }, { fuente: 'contable', valor: 100 });
  let p = con({ periodo: '202609', cod77: null, cod504: null, fuente: 'sin_f29' });
  assert.strictEqual(p.remanente, null); assert.match(p.avisos.join(' '), /no hay F29 de septiembre 2026 en Cartapra\. Se usa el de Contable/);
  assert.match(con({ periodo: '202609', fuente: 'f29_sin_montos', folio: 1, cod504: null }).avisos.join(' '), /aún no trae los montos/);
  assert.match(con({ ...REM, cod504: null, utm_destino: null, falta_utm: ['2026-11'] }).avisos.join(' '), /falta la UTM de noviembre 2026 en Gestoor/);
  assert.strictEqual(con({ ...REM, cod77: 0, cod504: 0, fuente: 'sii_sin_codigo_77' }).remanente.valor, 0, 'SII sin remanente = 0 oficial');
});
test('diferencia contra lo guardado: se avisa, no se oculta', () => {
  const p = S.aPantalla(R, { fuente: 'contable', valor: 12394 }, { debito_iva: 20000, credito_iva: 6650 });
  assert.deepStrictEqual(p.diferencia, { guardado: { debito: 20000, credito: 6650 }, sii: { debito: 26600, credito: 6650 } });
  assert.match(p.avisos.join(' '), /Lo guardado en Gestoor \(débito \$20\.000 · crédito \$6\.650\) es distinto del SII \(débito \$26\.600/);
  assert.strictEqual(S.aPantalla(R, {}, { debito_iva: 26600, credito_iva: 6650 }).diferencia, null, 'iguales: sin aviso');
});
test('sin lectura = null (nunca 0), sin conexión y F29 ya presentado', () => {
  const p = S.aPantalla({ conexion: { estado: 'conectada' }, ventas: null, compras: null, avisos: ['cobertura_incompleta'] }, {});
  assert.deepStrictEqual([p.debito, p.credito, p.hayVentas, p.hayCompras], [null, null, false, false]);
  assert.match(p.avisos.join(' '), /aún no entrega completo/);
  assert.strictEqual(S.aPantalla({ conexion: { estado: 'sin_conexion' } }, {}).conectado, false);
  assert.match(S.aPantalla({ ...R, f29_periodo: { folio: 210 } }, {}).avisos.join(' '), /ya tiene F29 presentado/);
});
test('registro para guardar: fuente, fecha de lectura y cifras usadas', () => {
  const p = S.aPantalla(R, {});
  const g = S.registro(p, 'sii');
  assert.strictEqual(g.fuente_montos, 'sii'); assert.strictEqual(g.sii_datos_al, '2026-11-18T10:25:00Z');
  assert.deepStrictEqual([g.sii_detalle.debito, g.sii_detalle.credito, g.sii_detalle.remanente.cod504, g.sii_detalle.remanente.folio], [26600, 6650, 12394, 209]);
  assert.strictEqual(S.registro(p, 'sii_editado').fuente_montos, 'sii_editado');
  assert.deepStrictEqual(S.registro(p, 'libro'), { fuente_montos: 'libro', sii_datos_al: null, sii_detalle: null });
  assert.deepStrictEqual(S.registro(null, null), { fuente_montos: null, sii_datos_al: null, sii_detalle: null });
});
test('leer: RPC no instalada = no_disponible; 42501 = sin_permiso; ok devuelve datos', async () => {
  const resp = (status, body) => async () => ({ ok: status < 300, status, text: async () => JSON.stringify(body) });
  assert.strictEqual((await S.leer(1, '202610', resp(404, { code: 'PGRST202' }))).estado, 'no_disponible');
  assert.strictEqual((await S.leer(1, '202610', resp(403, { code: '42501' }))).estado, 'sin_permiso');
  assert.strictEqual((await S.leer(1, '202610', resp(500, { code: 'XX' }))).estado, 'error');
  let enviado; const f = async (p, o) => { enviado = [p, JSON.parse(o.body)]; return { ok: true, status: 200, text: async () => JSON.stringify(R) }; };
  const r = await S.leer('7', '202610', f);
  assert.strictEqual(r.estado, 'ok'); assert.deepStrictEqual(enviado, ['rpc/sii_preiva_periodo', { p_cliente_id: 7, p_periodo: '202610' }]);
});

// ── 19-11 (Luciano): remanente del período = SIEMPRE el del mes INMEDIATAMENTE anterior; sin fuente válida → BLOQUEO (nunca $0) ──
const RA = require('../assets/remanente-anterior.js');
const SIN_DATO = (motivo, extra) => { const info = RA.resolver({ periodo: '2026-11', lecturaOk: true, info: Object.assign({ estado: 'SIN_DATO', motivo, periodo: '2026-11', periodo_anterior: '2026-10' }, extra || {}) });
  return { valor: null, fuente: 'sin', info, raw: Object.assign({ estado: 'SIN_DATO', motivo }, extra || {}) }; };
const NOV = (ra) => Object.assign({}, R, { periodo: '202611', remanente_anterior: ra });
test('BLOQUEO: octubre no declarado en el SII y Contable sin dato → «Falta», sin $0, con el texto de Luciano y opción a mano', () => {
  const p = S.aPantalla(NOV({ periodo: '202610', cod77: null, cod504: null, fuente: 'sin_f29' }), SIN_DATO('SIN_MES_ANTERIOR'));
  const r = S.remanenteDelPeriodo({ periodo: '202611', sii: p, remContable: SIN_DATO('SIN_MES_ANTERIOR') });
  assert.strictEqual(r.valor, null, 'nunca 0');
  assert.strictEqual(r.bloqueo.tipo, 'sin_declarar');
  assert.strictEqual(r.bloqueo.mensaje, '⚠️ Octubre 2026 no está declarado en el SII (o falta su remanente). Primero hay que declararlo: su remanente arrastra el de meses anteriores. Mientras tanto no se puede calcular noviembre 2026.');
  assert.strictEqual(r.bloqueo.puedeManual, true, 'el reporte de octubre no existe en Gestoor → se puede ingresar a mano');
  assert.match(p.avisos.join(' '), /Contable tampoco lo tiene/);
});
test('NUNCA dos meses atrás: octubre sin F29 y septiembre con cód. 77 > 0 → bloqueado, no usa ese 77', () => {
  // a) la lectura del SII trae (por error) el F29 de SEPTIEMBRE con cód. 77 = 50.000 para el período noviembre
  const p = S.aPantalla(NOV({ periodo: '202609', folio: 8, cod77: 50000, cod504: 50100, fuente: 'sii_codigo_77', falta_utm: [] }), SIN_DATO('SIN_MES_ANTERIOR'));
  assert.strictEqual(p.remanente, null, 'el cód. 77 de septiembre no es el remanente de noviembre');
  let r = S.remanenteDelPeriodo({ periodo: '2026-11', sii: p, remContable: SIN_DATO('SIN_MES_ANTERIOR') });
  assert.strictEqual(r.valor, null); assert.strictEqual(r.bloqueo.tipo, 'sin_declarar'); assert.match(r.bloqueo.mensaje, /^⚠️ Octubre 2026 no está declarado/);
  assert.strictEqual(S.registro(p, 'sii').sii_detalle.remanente.cod77, null, 'tampoco queda registrado el 77 de septiembre');
  // b) aunque aPantalla no conociera el período, remanenteDelPeriodo rechaza un remanente del SII que no sea del mes anterior
  const p2 = S.aPantalla(Object.assign({}, R, { remanente_anterior: { periodo: '202609', folio: 8, cod77: 50000, cod504: 50100, fuente: 'sii_codigo_77', falta_utm: [] } }), {});
  assert.ok(p2.remanente, 'sin período en la respuesta, aPantalla lo muestra…');
  assert.strictEqual(S.remanenteDelPeriodo({ periodo: '202611', sii: p2, remContable: SIN_DATO('SIN_MES_ANTERIOR') }).valor, null, '…pero el Pre-IVA no lo usa');
  // c) Contable respondiendo el cód. 77 de septiembre (periodo_anterior 2026-09) para noviembre → tampoco se usa
  const infoSep = RA.resolver({ periodo: '2026-11', lecturaOk: true, info: { estado: 'CONOCIDO', fuente: 'MES_ANTERIOR', cod77: 50000, cod504: 50000, periodo: '2026-11', periodo_anterior: '2026-09' } });
  r = S.remanenteDelPeriodo({ periodo: '202611', sii: null, remContable: { valor: 50000, fuente: 'contable', info: infoSep } });
  assert.strictEqual(r.valor, null); assert.ok(r.bloqueo);
});
test('fuentes válidas: SII del mes anterior manda; si no, Contable o el ingresado a mano (con nombre y motivo)', () => {
  const okSii = S.aPantalla(NOV(Object.assign({}, REM, { periodo: '202610' })), {});
  assert.deepStrictEqual([S.remanenteDelPeriodo({ periodo: '202611', sii: okSii, remContable: SIN_DATO('SIN_MES_ANTERIOR') }).valor, S.remanenteDelPeriodo({ periodo: '202611', sii: okSii }).origen], [12394, 'sii']);
  const man = RA.resolver({ periodo: '2026-11', lecturaOk: true, info: { estado: 'CONOCIDO', fuente: 'F29_MANUAL', cod77: 80000, cod504: 80400, utm_origen: 1, utm_destino: 1, periodo: '2026-11', periodo_anterior: '2026-10',
    manual: { usuario_nombre: 'Analista Ficticia', motivo: 'F29 octubre presentado, folio 1' } } });
  const sinF29 = S.aPantalla(NOV({ periodo: '202610', cod77: null, cod504: null, fuente: 'sin_f29' }), { valor: 80400, fuente: 'manual', info: man });
  const r = S.remanenteDelPeriodo({ periodo: '202611', sii: sinF29, remContable: { valor: 80400, fuente: 'manual', info: man } });
  assert.deepStrictEqual([r.valor, r.origen, r.bloqueo], [80400, 'manual', null]);
  assert.match(r.aviso, /^Remanente ingresado a mano por Analista Ficticia .*· F29 octubre presentado, folio 1/);
  assert.strictEqual(S.remanenteDelPeriodo({ periodo: '202611', sii: null, remContable: { valor: 0, fuente: 'contable', info: { periodoAnterior: '2026-10', detalle: 'x' } } }).valor, 0, 'cero confirmado sí vale');
});
test('excepciones con texto propio: sin montos en Cartapra, falta UTM, sin conexión (como Contable), conflicto y error de lectura', () => {
  const sm = S.remanenteDelPeriodo({ periodo: '202611', sii: S.aPantalla(NOV({ periodo: '202610', fuente: 'f29_sin_montos', folio: 3, cod504: null }), {}), remContable: SIN_DATO('SIN_MES_ANTERIOR') });
  assert.strictEqual(sm.bloqueo.tipo, 'cartapra_sin_montos'); assert.match(sm.bloqueo.mensaje, /esperar la próxima sincronización \(10:00 o 17:00\)\. Mientras tanto no se puede calcular noviembre 2026\.$/);
  const ut = S.remanenteDelPeriodo({ periodo: '202611', sii: S.aPantalla(NOV(Object.assign({}, REM, { periodo: '202610', cod504: null, utm_destino: null, falta_utm: ['2026-12'] })), {}), remContable: SIN_DATO('SIN_UTM', { falta_utm: ['2026-12'] }) });
  assert.strictEqual(ut.bloqueo.tipo, 'falta_utm'); assert.match(ut.bloqueo.mensaje, /Falta la UTM de diciembre 2026 en Gestoor: regístrala en Panel de control/); assert.strictEqual(ut.bloqueo.puedeManual, false);
  const utC = S.remanenteDelPeriodo({ periodo: '202611', sii: null, remContable: SIN_DATO('SIN_UTM', { falta_utm: ['2026-11'] }) });
  assert.strictEqual(utC.bloqueo.tipo, 'falta_utm', 'sin conexión, la UTM faltante la avisa Contable'); assert.match(utC.bloqueo.mensaje, /UTM de noviembre 2026/);
  const nc = S.remanenteDelPeriodo({ periodo: '202611', sii: S.aPantalla({ conexion: { estado: 'sin_conexion' } }, {}), remContable: SIN_DATO('SIN_MES_ANTERIOR') });
  assert.strictEqual(nc.bloqueo.tipo, 'contable'); assert.match(nc.bloqueo.mensaje, /^⚠️ Falta el remanente de octubre 2026: Gestoor no tiene ese reporte/); assert.strictEqual(nc.valor, null);
  const sv = S.remanenteDelPeriodo({ periodo: '202611', sii: null, remContable: SIN_DATO('MES_ANTERIOR_SIN_VALIDAR') });
  assert.strictEqual(sv.bloqueo.puedeManual, false, 'el reporte de octubre existe sin validar: se valida, no se ingresa a mano');
  const cf = RA.resolver({ periodo: '2026-11', lecturaOk: true, info: { estado: 'CONFLICTO', fuente: 'F29_MANUAL', cod77: 1, cod504: 1, mes_anterior_cod77: 2, periodo_anterior: '2026-10', manual: {} } });
  assert.strictEqual(S.remanenteDelPeriodo({ periodo: '202611', remContable: { valor: null, fuente: 'sin', info: cf } }).bloqueo.tipo, 'conflicto');
  assert.strictEqual(S.remanenteDelPeriodo({ periodo: '202611', remContable: { valor: null, fuente: 'error' } }).bloqueo.tipo, 'sin_lectura');
});
