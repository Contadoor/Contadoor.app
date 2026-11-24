// CONC-EXT-1 (24-11-2026) · pruebas del front sin servidor: node --test pruebas/conc_externo_test.js
// Ejecuta el script real de conciliacion/index.html con un DOM mínimo y un sbFetch simulado.
const test = require('node:test'); const assert = require('node:assert/strict');
const fs = require('fs'); const path = require('path'); const vm = require('vm');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'conciliacion/index.html'), 'utf8');
const SCRIPT = [...HTML.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n');

function montar({ extFalla = false, rol = 'pagos' } = {}) {
  const els = {}; const el = (id) => els[id] || (els[id] = { id, value: '', textContent: '', innerHTML: '', disabled: false, style: {}, classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, contains(c) { return this._s.has(c); }, toggle() {} }, addEventListener() {}, getAttribute() { return null; } });
  const llamadas = [];
  const MOVS = [
    { id: 205, codigo: '900205', fecha_hora: '2026-11-23T10:00:00', rut_origen: '99000001-1', nombre_origen: 'Asesorias Ejemplo Eirl', banco_origen: 'BCI', monto: 89990, saldo: 89990, monto_aplicado: 0, estado: 'por_conciliar', cliente_rut: null },
    { id: 206, codigo: '900206', fecha_hora: '2026-11-22T10:00:00', rut_origen: '99000002-2', nombre_origen: 'Otro', banco_origen: 'BCI', monto: 5000, saldo: 0, monto_aplicado: 5000, estado: 'conciliado', cliente_rut: null },
    { id: 207, codigo: '900207', fecha_hora: '2026-11-21T10:00:00', rut_origen: '99000003-3', nombre_origen: 'Cliente Activo Demo', banco_origen: 'BCI', monto: 1000, saldo: 1000, monto_aplicado: 0, estado: 'por_conciliar', cliente_rut: '99000003-3' }];
  const EXT = [{ id: 9, movimiento_id: 206, concepto: 'Servicio adicional · renta', monto: 5000, externo_nombre: 'Otro', externo_rut: '99000002-2' }];
  const resp = (body, status = 200) => Promise.resolve({ ok: status < 300, status, json: () => Promise.resolve(body), text: () => Promise.resolve(JSON.stringify(body)) });
  const ctx = {
    console, setTimeout, clearTimeout, URLSearchParams, Promise, JSON, Math, Number, String, Array, Object, Date, isNaN, Uint8Array, alert() {}, confirm: () => true, prompt: () => 'Motivo de prueba largo',
    location: { search: '' }, crypto: require('crypto').webcrypto,
    document: { getElementById: el, querySelectorAll: () => [], querySelector: () => null, addEventListener() {}, createElement: () => el('x' + Math.random()) },
    getUsuario: () => ({ rol, esMaster: false }), sbGetClientes(cb) { cb([{ rut: '99000003-3', razon: 'CLIENTE ACTIVO DEMO' }]); },
    sbFetch(url, opt) {
      llamadas.push({ url, body: opt && opt.body ? JSON.parse(opt.body) : null });
      if (url.startsWith('rpc/')) return resp([{ imputacion_id: 10, resultado: 'aplicada', estado_movimiento: 'conciliado', saldo_movimiento: 0 }]);
      if (url.startsWith('concil_movimientos')) return resp(MOVS);
      if (url.startsWith('concil_imputaciones_manuales')) return extFalla ? resp({ code: '42703', message: 'column externo does not exist' }, 400) : resp(EXT);
      return resp([]);
    } };
  ctx.window = ctx; ctx.window._contadoorSesion = { rol, nombre: 'Prueba' };
  vm.createContext(ctx); vm.runInContext(SCRIPT, ctx);
  return { ctx, el, llamadas };
}
const espera = () => new Promise((r) => setTimeout(r, 300));

test('ingreso sin cliente por conciliar muestra «🌐 Cliente externo» (Tesorería)', async () => {
  const { el } = montar(); await espera();
  const h = el('tablaBody').innerHTML;
  assert.match(h, /abrirExterno\(205\)/); assert.doesNotMatch(h, /abrirExterno\(207\)/, 'con cliente: no aparece');
});

test('sin el SQL instalado (columna inexistente) la opción NO aparece y la pantalla carga igual', async () => {
  const { el } = montar({ extFalla: true }); await espera();
  const h = el('tablaBody').innerHTML;
  assert.match(h, /900205|Asesorias/); assert.doesNotMatch(h, /abrirExterno/);
});

test('conciliar: valida concepto, llama la RPC con la clave del modal y reintenta con la MISMA clave', async () => {
  const { ctx, el, llamadas } = montar(); await espera();
  ctx.abrirExterno(205); assert.ok(el('mExt').classList.contains('on'));
  el('eCon').value = 'ab'; ctx.conciliarExterno(); assert.match(el('eErr').textContent, /mínimo 3/);
  el('eCon').value = 'Servicio adicional · renta'; ctx.conciliarExterno(); await espera();
  const r = llamadas.filter((x) => x.url === 'rpc/concil_imputar_externo');
  assert.equal(r.length, 1); assert.equal(r[0].body.p_movimiento_id, 205); assert.equal(r[0].body.p_concepto, 'Servicio adicional · renta');
  assert.match(r[0].body.p_clave_idem, /^[0-9a-f-]{36}$/); assert.ok(!el('mExt').classList.contains('on'), 'cierra el modal');
  assert.equal(Object.keys(r[0].body).length, 3, 'no manda nombre ni RUT: los toma el servidor de la cartola');
});

test('vista Conciliados: el externo se rotula y se puede desconciliar con la RPC de siempre', async () => {
  const { ctx, el, llamadas } = montar(); await espera();
  ctx.setVista('conc'); const h = el('tablaBody').innerHTML;
  assert.match(h, /🌐 Cliente externo/); assert.match(h, /Servicio adicional · renta/); assert.match(h, /desExterno\(9\)/);
  ctx.desExterno(9); await espera();
  const a = llamadas.find((x) => x.url === 'rpc/concil_imputacion_manual_anular');
  assert.deepEqual(a.body, { p_id: 9, p_motivo: 'Motivo de prueba largo' });
});

test('un analista sin Tesorería no ve la opción', async () => {
  const { el } = montar({ rol: 'analista' }); await espera();
  assert.doesNotMatch(el('tablaBody').innerHTML, /abrirExterno/);
});
