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
