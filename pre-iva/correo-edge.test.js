// node --test pre-iva/correo-edge.test.js  (datos ficticios) — CORREO-PREIVA-1
const test = require('node:test'); const assert = require('node:assert');
const C = require('./correo-edge.js');

function falso(respuestas) {
  const llamadas = [];
  const fetch = (url, init) => {
    llamadas.push({ url, init, cuerpo: JSON.parse(init.body) });
    const r = respuestas.shift();
    if (r === 'red') return Promise.reject(new Error('red'));
    return Promise.resolve({ status: r.status, text: () => Promise.resolve(JSON.stringify(r.j)) });
  };
  return { fetch, llamadas };
}
const env = (f) => ({ url: 'https://x.supabase.co', key: 'anon', token: 'jwt', fetch: f.fetch });
const VP = { ok: true, envio_habilitado: true, modo: 'PRUEBA', destinatarios: ['info@contadoor.cl'], destinatarios_ficha: ['gerencia@cliente.cl'],
  responder_a: 'ana@contadoor.cl', asunto: 'Proyección de IVA noviembre 2026 · X', preiva: { f29: 985000, ya_enviado: null } };

test('consultar: pide vista_previa a la Edge con JWT, sin montos ni destinatario', async () => {
  const f = falso([{ status: 200, j: VP }]);
  const c = await C.consultar(env(f), 15, '202611');
  assert.strictEqual(f.llamadas[0].url, 'https://x.supabase.co/functions/v1/gestoor-correo-enviar');
  assert.strictEqual(f.llamadas[0].init.headers.Authorization, 'Bearer jwt');
  assert.deepStrictEqual(f.llamadas[0].cuerpo, { accion: 'vista_previa', tipo: 'preiva', cliente_id: 15, periodo: '2026-11' });
  assert.strictEqual(c.disponible, true); assert.strictEqual(c.modo, 'PRUEBA'); assert.strictEqual(c.f29, 985000);
});
test('consultar: Edge inexistente, red caída, pausa o sin sesión → no disponible (queda el PDF)', async () => {
  assert.strictEqual((await C.consultar(env(falso([{ status: 404, j: {} }])), 15, '202611')).disponible, false);
  assert.strictEqual((await C.consultar(env(falso(['red'])), 15, '202611')).disponible, false);
  const p = await C.consultar(env(falso([{ status: 200, j: { ...VP, envio_habilitado: false } }])), 15, '202611');
  assert.strictEqual(p.disponible, false); assert.strictEqual(p.motivo, 'ENVIO_PAUSADO');
  assert.strictEqual((await C.consultar({ url: 'u', key: 'k', token: null }, 15, '202611')).disponible, false);
  assert.strictEqual((await C.consultar(env(falso([])), null, '202611')).disponible, false);
});
test('textoConfirmar: muestra el destinatario REAL del servidor; en PRUEBA avisa info@ y la ficha', () => {
  const t = C.textoConfirmar({ ...VP, destinatariosFicha: VP.destinatarios_ficha, responderA: VP.responder_a, f29: 985000, yaEnviado: null }, 'Comercial X SpA', 'noviembre 2026');
  assert.match(t, /MODO PRUEBA: el correo llega SOLO a info@contadoor\.cl/);
  assert.match(t, /En producción iría a: gerencia@cliente\.cl/);
  assert.match(t, /\$985\.000/);
  const r = C.textoConfirmar({ modo: 'REAL', destinatarios: ['gerencia@cliente.cl'], destinatariosFicha: [], responderA: 'ana@contadoor.cl', f29: 1, yaEnviado: '2026-11-26T15:00:00Z' }, 'X', 'noviembre 2026');
  assert.match(r, /Para: gerencia@cliente\.cl/); assert.match(r, /ya figura enviado el 26-11-2026/);
});
test('enviar: manda solo tipo, cliente, período y reenvío; interpreta marcado / prueba / cambiado / incierto', async () => {
  const f = falso([{ status: 200, j: { estado: 'enviado', modo: 'REAL', destinatarios: ['g@c.cl'], preiva_marcado: 'marcado' } }]);
  const r = await C.enviar(env(f), 15, '202611', false);
  assert.deepStrictEqual(f.llamadas[0].cuerpo, { accion: 'enviar', tipo: 'preiva', cliente_id: 15, periodo: '2026-11', reenvio: false });
  assert.strictEqual(r.marcado, true);
  assert.strictEqual(C.resultado({ status: 200, j: { estado: 'enviado', modo: 'PRUEBA', destinatarios: ['info@contadoor.cl'], preiva_marcado: 'no_aplica' } }).marcado, false);
  assert.match(C.resultado({ status: 200, j: { estado: 'enviado', modo: 'REAL', preiva_marcado: 'cambiado' } }).texto, /NO quedó marcado/);
  assert.strictEqual(C.resultado({ status: 502, j: { estado: 'incierto', codigo: 'ENVIO_INCIERTO' } }).incierto, true);
  assert.match(C.resultado({ status: 409, j: { codigo: 'PREIVA_SIN_GUARDAR' } }).texto, /Guarda el Pre-IVA/);
  assert.strictEqual(C.resultado({ status: 200, j: { ok: true, estado: 'ya_enviado' } }).yaEnviado, true);
});
