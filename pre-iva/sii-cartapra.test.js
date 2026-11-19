// node --test pre-iva/sii-cartapra.test.js  (datos ficticios)
const test = require('node:test'); const assert = require('node:assert');
const S = require('./sii-cartapra.js');
const R = { conexion: { estado: 'conectada' }, datos_al: '2026-11-18T07:25:00Z', avisos: ['compras_pendientes'],
  ventas: { documentos: 4, neto: 140000, exento: 20000, iva: 26600, por_tipo: { '33': { n: 2 }, '61': { n: 1 }, '34': { n: 1 } } },
  compras: { registro: { documentos: 2, neto: 35000, exento: 0, iva: 6650 }, pendiente: { documentos: 1, iva: 5700 }, por_tipo: { '33': { n: 1 }, '61': { n: 1 } } },
  remanente_anterior: { periodo: '202609', valor: 12345, fuente: 'sii_codigo_77', folio: 209 }, f29_periodo: null };
test('mapea débito, crédito, neto, exento y desglose por tipo', () => {
  const p = S.aPantalla(R, { fuente: 'contable', valor: 12345, info: { cod77: 12345 } });
  assert.deepStrictEqual([p.debito, p.credito, p.netoVentas, p.exentoVentas, p.netoCompras], [26600, 6650, 140000, 20000, 35000]);
  assert.deepStrictEqual(p.porTipoVentas, { 'Factura electrónica': 2, 'Nota de crédito': 1, 'Factura exenta': 1 });
  assert.deepStrictEqual(p.remanenteSii, { cod77: 12345, periodo: '202609', folio: 209 });
  assert.strictEqual(p.avisos.length, 1, 'solo el aviso de pendientes (Contable coincide con el SII)');
  assert.match(p.avisos[0], /1 factura\(s\) de compra pendiente/);
});
test('remanente: nunca se reemplaza; solo se compara con el cód. 77 de Contable', () => {
  assert.ok(!('remanente' in S.aPantalla(R, {})), 'no entrega un remanente para aplicar');
  assert.match(S.aPantalla(R, { fuente: 'contable', valor: 999, info: { cod77: 999 } }).avisos.join(' '), /Contable tiene cód\. 77 \$999 y el F29 de 09\/2026 en el SII dice \$12\.345/);
  assert.match(S.aPantalla(R, { fuente: 'sin', info: { cod77: null } }).avisos.join(' '), /Regístralo en Contable/);
  assert.doesNotMatch(S.aPantalla(R, { fuente: 'manual', info: { cod77: null } }).avisos.join(' '), /Regístralo/, 'manual: no se insiste');
  const sin77 = { ...R, remanente_anterior: { periodo: '202609', valor: 0, fuente: 'sii_sin_codigo_77', folio: 9 } };
  assert.match(S.aPantalla(sin77, { fuente: 'contable', info: { cod77: 500 } }).avisos.join(' '), /dice \$0/);
  assert.strictEqual(S.aPantalla({ ...R, remanente_anterior: { fuente: 'sin_f29' } }, {}).remanenteSii, null);
});
test('sin lectura = null (nunca 0) y sin conexión', () => {
  const p = S.aPantalla({ conexion: { estado: 'conectada' }, ventas: null, compras: null, avisos: ['cobertura_incompleta'] }, {});
  assert.deepStrictEqual([p.debito, p.credito, p.hayVentas, p.hayCompras], [null, null, false, false]);
  assert.match(p.avisos.join(' '), /aún no entrega completo/);
  assert.strictEqual(S.aPantalla({ conexion: { estado: 'sin_conexion' } }, {}).conectado, false);
});
test('F29 ya presentado avisa', () => {
  assert.match(S.aPantalla({ ...R, f29_periodo: { folio: 210 } }, {}).avisos.join(' '), /ya tiene F29 presentado/);
});
test('aplicarSolo: no pisa lo guardado ni lo escrito', () => {
  assert.strictEqual(S.aplicarSolo(null, '', ''), true);
  assert.strictEqual(S.aplicarSolo({ debito_iva: 0, credito_iva: 0 }, 0, 0), true);
  assert.strictEqual(S.aplicarSolo({ debito_iva: 100, credito_iva: 0 }, 0, 0), false);
  assert.strictEqual(S.aplicarSolo(null, 50, ''), false);
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
