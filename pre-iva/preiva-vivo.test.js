// Pre-IVA vivo (27-11): pruebas de pre-iva/preiva-vivo.js (sin red) y de integración de la cartera y del historial del detalle
// (navegador local, datos 100 % ficticios, reloj fijo 22-10-2026; nada sale a internet).
// Ejecutar: node --test pre-iva/preiva-vivo.test.js   (las de navegador necesitan PW_CORE=/ruta/a/node_modules/playwright-core)
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const V = require('./preiva-vivo.js');
let pw = null; try { pw = require(process.env.PW_CORE || 'playwright-core'); } catch (e) { pw = null; }
const omitir = !pw ? 'sin playwright-core (defina PW_CORE)' : false;
const RAIZ = path.resolve(__dirname, '..');

// ── Datos ficticios con la forma exacta de las RPC (migración 202611271800_preiva_vivo) ──
function empA() {
  return { cliente_id: 1, conexion: 'conectada', carga_inicial_lista: true, datos_al: '2026-10-22T11:04:00Z', sincronizado_en: '2026-10-22T11:05:00Z',
    cobertura_completa: true, compras_reclamadas: { documentos: 1, iva: 19000 }, f29_declarado: null,
    estimacion: { debito: 1900000, credito: 760000, ventas_neto: 10000000, ventas_exento: 500000, ventas_documentos: 12, compras_documentos: 5,
      compras_pendientes: { documentos: 2, iva: 95000 }, remanente: { monto: 100735 }, remanente_motivo: null, ppm_tasa: 0.25, ppm_tasa_fuente: 'sii', ppm: 26250,
      iva_determinado: 1039265, iva_pagar: 1039265, remanente_siguiente: 0, total: 1065515, exenta: false } };
}
function empSinRem() {
  const e = empA(); e.cliente_id = 2; e.compras_reclamadas = null;
  Object.assign(e.estimacion, { remanente: null, remanente_motivo: 'sin_f29', iva_determinado: null, iva_pagar: null, total: null, compras_pendientes: null });
  return e;
}
function historialRpc() {
  const m = (p, o) => Object.assign({ periodo: p, en_curso: false, fuente: null, real: false, iva_pagar: null, total: null, ventas_neto: null, ventas_exento: null,
    compras_neto: null, compras_exento: null, debito: null, credito: null, estimado: null, cobertura_completa: null, datos_al: null, f29_declarado: null, reporte: null }, o);
  return { ok: true, cliente_id: 1, periodo: '202610', conexion: 'conectada', meses: [
    m('202604', {}),
    m('202605', { fuente: 'f29_sii', real: true, iva_pagar: 300000, total: 330000, ventas_neto: 4000000, ventas_exento: 0, compras_neto: 2000000, compras_exento: 0, debito: 760000, credito: 380000,
      f29_declarado: { folio: 11, montos: true, total: 330000, iva_pagar: 300000, ppm: 30000, tasa_ppm: 0.75, debito: 760000, credito: 380000 } }),
    m('202606', { fuente: 'f29_sii', real: true, iva_pagar: 400000, total: 430000, ventas_neto: 5000000, ventas_exento: 0, compras_neto: 2500000, compras_exento: 0, debito: 950000, credito: 475000,
      f29_declarado: { folio: 12, montos: true, total: 430000, iva_pagar: 400000, ppm: 30000, tasa_ppm: 0.75, debito: 950000, credito: 475000 } }),
    m('202607', { fuente: 'reporte', real: true, iva_pagar: 500000, total: 540000, ventas_neto: 6000000, ventas_exento: 0, compras_neto: 3000000, compras_exento: 0, debito: 1140000, credito: 570000,
      reporte: { total: 540000, iva_pagar: 500000, ppm: 40000, debito: 1140000, credito: 570000, cerrado_at: '2026-08-10T12:00:00Z' },
      f29_declarado: { folio: 13, montos: true, total: 539000, iva_pagar: 500000, ppm: 39000, tasa_ppm: 0.75 } }),
    m('202608', { fuente: 'f29_sii', real: true, iva_pagar: 600000, total: 640000, ventas_neto: 7000000, ventas_exento: 0, compras_neto: 3500000, compras_exento: 0, debito: 1330000, credito: 665000,
      f29_declarado: { folio: 14, montos: true, total: 640000, iva_pagar: 600000, ppm: 40000, tasa_ppm: 0.75 } }),
    m('202609', { fuente: 'estimado', real: false, iva_pagar: 700000, total: 760000, ventas_neto: 8000000, ventas_exento: 0, compras_neto: 4000000, compras_exento: 0, debito: 1520000, credito: 760000,
      estimado: { iva_pagar: 700000, ppm: 60000, ppm_tasa: 0.75, total: 760000, remanente: 0 }, datos_al: '2026-10-01T11:00:00Z' }),
    m('202610', { en_curso: true, fuente: 'estimado', iva_pagar: 900000, total: 975000, ventas_neto: 10000000, ventas_exento: 0, compras_neto: 5000000, compras_exento: 0, debito: 1900000, credito: 950000,
      estimado: { iva_pagar: 900000, ppm: 75000, ppm_tasa: 0.75, total: 975000, remanente: 50000 }, datos_al: '2026-10-22T11:04:00Z' })] };
}

// ── Unitarias ──
test('fechaChile: siempre hora de Chile, formato dd-mm-aaaa · hh:mm', () => {
  assert.equal(V.fechaChile('2026-10-22T11:04:00Z'), '22-10-2026 · 08:04');   // octubre: UTC−3
  assert.equal(V.fechaChile(null), null); assert.equal(V.fechaChile('no'), null);
});
test('filaCartera: montos de la estimación (mismo cálculo de MiContadoor) y facturas recibidas', () => {
  const f = V.filaCartera(empA(), '202610');
  assert.equal(f.conectado, true); assert.equal(f.hayDatos, true);
  assert.equal(f.iva, 1039265); assert.equal(f.ppm, 26250); assert.equal(f.total, 1065515);
  assert.equal(f.remanente, 100735); assert.equal(f.remanenteFalta, null);
  assert.deepEqual(f.pendientes, { n: 2, iva: 95000 }); assert.deepEqual(f.reclamadas, { n: 1, iva: 19000 });
  assert.equal(f.datosAlTxt, '22-10-2026 · 08:04'); assert.equal(f.docsCompras, 5); assert.equal(f.docsVentas, 12);
});
test('filaCartera: sin remanente → IVA y F29 null (nunca $0) con el motivo; PPM sí', () => {
  const f = V.filaCartera(empSinRem(), '202610');
  assert.equal(f.iva, null); assert.equal(f.total, null); assert.equal(f.ppm, 26250);
  assert.equal(f.remanenteFalta, 'falta el F29 de septiembre 2026 en el SII');
});
test('filaCartera: sin conexión → sin montos; motivos del remanente', () => {
  const f = V.filaCartera({ cliente_id: 3, conexion: 'sin_conexion' }, '202610');
  assert.equal(f.conectado, false); assert.equal(f.hayDatos, false); assert.equal(f.total, null);
  assert.match(V.motivoRemanente('f29_sin_montos', '202601'), /Cartapra aún no trae los montos del F29 de diciembre 2025/);
  assert.match(V.motivoRemanente('falta_utm', '202610'), /UTM/);
  const ix = V.indexarCartera({ periodo: '202610', generado_en: 'x', empresas: [empA(), empSinRem()] });
  assert.deepEqual(Object.keys(ix.porId), ['1', '2']); assert.equal(ix.periodo, '202610');
});
test('historialAFilas: real (F29 SII / reporte) entra al promedio; estimado se muestra y no entra; sin dato = null', () => {
  const H = V.historialAFilas(historialRpc(), '2026-10');
  assert.equal(H.vivo, true); assert.equal(H.filas.length, 6); assert.equal(H.actual.periodo, '2026-10');
  const [abr, may, , jul, , sep] = H.filas;
  assert.equal(abr.fuente, null); assert.equal(abr.iva, null); assert.equal(abr.comparable.iva, false);
  assert.equal(may.fuente, 'F29 del SII'); assert.equal(may.iva, 300000); assert.equal(may.ppm, 30000); assert.equal(may.tasa, 0.75);
  assert.deepEqual(may.comparable, { iva: true, debito: true, credito: true, ppm: true, ventas: true }); assert.equal(may.ventas, 4000000);
  assert.equal(jul.fuente, 'Reporte cerrado'); assert.equal(jul.ppm, 40000); assert.equal(jul.registradoAt, '2026-08-10T12:00:00Z');
  assert.equal(sep.fuente, 'Estimado (Cartapra)'); assert.equal(sep.iva, 700000); assert.equal(sep.comparable.iva, false); assert.match(sep.motivo, /no entra en promedios/);
  assert.equal(V.hayAlgo(historialRpc()), true); assert.equal(V.hayAlgo({ meses: [{ fuente: null }] }), false);
});
test('leer: RPC no instalada (PGRST202) → no_disponible; 42501 → sin_permiso; ok → datos; respuesta sin ok → error', async () => {
  const resp = (st, b) => () => Promise.resolve({ ok: st < 300, status: st, text: () => Promise.resolve(JSON.stringify(b)) });
  assert.equal((await V.leerCartera('2026-10', resp(404, { code: 'PGRST202', message: 'no existe' }))).estado, 'no_disponible');
  assert.equal((await V.leerCartera('2026-10', resp(403, { code: '42501', message: 'SIN_PERMISO' }))).estado, 'sin_permiso');
  assert.equal((await V.leerCartera('2026-10', resp(500, { message: 'boom' }))).estado, 'error');
  assert.equal((await V.leerCartera('2026-10', resp(200, []))).estado, 'error');
  let cuerpo = null;
  const r = await V.leerHistorial(7, '2026-10', (p, o) => { cuerpo = [p, JSON.parse(o.body)]; return resp(200, historialRpc())(); });
  assert.equal(r.estado, 'ok'); assert.deepEqual(cuerpo, ['rpc/preiva_historial_vivo', { p_cliente_id: 7, p_periodo: '202610' }]);
  assert.equal((await V.leerCartera('2026-10', () => { throw new Error('red'); })).estado, 'error');   // nunca lanza
});

// ── Integración (navegador) ──
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg' };
function servidor() { return new Promise((ok) => { const s = http.createServer((req, res) => { const f = path.join(RAIZ, decodeURIComponent(new URL(req.url, 'http://x').pathname)); if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }).listen(0, '127.0.0.1', () => ok(s)); }); }
const CLIS = [
  { id: 1, rut: 'DEMO-01', razon_social: 'Cliente Ficticio Uno SpA', plan: 'asesoria', estado: 'activo', analista_contable: 'Analista Prueba', analista_contable_usuario_id: null, iva_condicion: null, ppm_tasa_default: null, email: 'f@example.invalid', regimen: '14D3' },
  { id: 2, rut: 'DEMO-02', razon_social: 'Cliente Ficticio Dos SpA', plan: 'asesoria', estado: 'activo', analista_contable: 'Analista Prueba', analista_contable_usuario_id: null, iva_condicion: null },
  { id: 3, rut: 'DEMO-03', razon_social: 'Cliente Ficticio Tres SpA', plan: 'asesoria', estado: 'activo', analista_contable: 'Analista Prueba', analista_contable_usuario_id: null, iva_condicion: null }];
// o: { vivo: 'ok' | '404', preiva: [...filas preiva_historial] }
async function abrir(browser, base, url, o = {}) {
  const ctx = await browser.newContext(), errores = [], llamadas = [];
  await ctx.addInitScript(() => sessionStorage.setItem('usuario_activo', JSON.stringify({ nombre: 'Analista Prueba', email: 'a@example.invalid', esMaster: true, rol: 'master', rolLabel: 'Master' })));
  await ctx.route('**/*', async (route) => {
    const req = route.request(), u = new URL(req.url());
    if (u.hostname === '127.0.0.1') {
      if (/\/(auth|notifications)\.js$/.test(u.pathname)) return route.fulfill({ contentType: 'text/javascript', body: '' });
      if (/\/supabase\.js$/.test(u.pathname)) return route.fulfill({ contentType: 'text/javascript', body: "var SB_URL='https://sb.stub.invalid';function sbH(){return {};}function sbFetch(p,o){return fetch('https://sb.stub.invalid/rest/v1/'+p,o||{});}" });
      return route.continue();
    }
    if (u.hostname === 'sb.stub.invalid') {
      const p = u.pathname.replace('/rest/v1/', ''), json = (b, st) => route.fulfill({ status: st || 200, contentType: 'application/json', body: JSON.stringify(b) });
      llamadas.push(p);
      const no = () => json({ code: 'PGRST202', message: 'no existe' }, 404);
      if (p === 'rpc/preiva_cartera_viva') return o.vivo === 'ok' ? json({ ok: true, periodo: '202610', mes_en_curso: true, generado_en: '2026-10-22T14:00:00Z', fuente: 'cartapra',
        empresas: [empA(), empSinRem(), { cliente_id: 3, conexion: 'sin_conexion' }] }) : no();
      if (p === 'rpc/preiva_historial_vivo') return o.vivo === 'ok' ? json(historialRpc()) : no();
      if (p === 'clientes') return json(/id=eq\.1/.test(u.search) ? [CLIS[0]] : CLIS);
      if (p === 'planes') return json([{ codigo: 'asesoria', nombre: 'Contadoor PRO', incluye_preiva: true }]);
      if (p === 'periodos') return json([{ periodo: '2026-10', uf: 39700, estado: 'activo' }]);
      if (p === 'rpc/sapi_frescura') return no();
      if (p === 'rpc/remanente_anterior') return json({ estado: 'CONOCIDO', fuente: 'MES_ANTERIOR', cod77: 0, cod504: 0, utm_origen: 69000, utm_destino: 69000 });
      if (p === 'preiva_historial') return json(req.method() === 'GET' ? (o.preiva || []) : []);
      return json([]);
    }
    return route.abort();
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('dialog', (d) => d.dismiss());
  await page.clock.setFixedTime(new Date(2026, 9, 22, 12, 0, 0));
  await page.goto(base + url);
  await page.evaluate(() => document.documentElement.classList.remove('auth-pending'));
  return { ctx, page, errores, llamadas };
}
async function conNavegador(fn) {
  const srv = await servidor(), base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await pw.chromium.launch({ channel: process.env.PW_CHANNEL || 'chrome', headless: true });
  try { await fn(browser, base); } finally { await browser.close(); srv.close(); }
}
const filaDe = (page, nombre) => page.evaluate((n) => { const tr = [...document.querySelectorAll('tr.pvc-fila')].find((x) => x.textContent.includes(n)); return tr ? tr.innerText : null; }, nombre);

test('CARTERA VIVA · todas las conectadas con su cálculo vivo, sin abrir nada; sin botón de sincronizar', { skip: omitir }, () => conNavegador(async (browser, base) => {
  const { ctx, page, errores } = await abrir(browser, base, '/pre-iva/cartera.html?periodo=2026-10', { vivo: 'ok', preiva: [{ cliente_rut: 'DEMO-01', periodo: '2026-10', f29: 900000, ppm: 20000, debito_iva: 1, credito_iva: 1, remanente: 0, fecha_envio: '2026-10-20T15:00:00Z', enviado_por: 'Analista Prueba' }] });
  await page.waitForSelector('tr.pvc-fila', { timeout: 15000 });
  const uno = await filaDe(page, 'Uno'), dos = await filaDe(page, 'Dos'), tres = await filaDe(page, 'Tres');
  assert.match(uno, /Enviado/i); assert.match(uno, /\$1\.039\.265/); assert.match(uno, /\$26\.250/); assert.match(uno, /\$1\.065\.515/);   // manda el vivo
  assert.match(uno, /enviado al cliente: \$900\.000/); assert.match(uno, /SII · Cartapra/); assert.match(uno, /Sincronizado: 22-10-2026 · 08:05/);
  assert.match(uno, /Facturas recibidas: 5 registradas · 2 pendientes \(IVA \$95\.000\) · 1 reclamadas/);
  assert.match(dos, /Estimado · Cartapra/i); assert.match(dos, /Estimado al 22-10-2026 · 08:04/); assert.match(dos, /Falta remanente/); assert.match(dos, /falta el F29 de septiembre 2026 en el SII/);
  assert.match(tres, /Sin conexión al SII/i);
  const body = await page.evaluate(() => document.body.innerText);
  assert.doesNotMatch(body, /Sin Pre-IVA este mes|Sin consultas al SII este mes|con la conexión al SII/);
  assert.match(body, /Pre-IVA vivo:/);
  assert.equal(await page.evaluate(() => document.querySelectorAll('.pvc-sii-btn').length), 0);
  assert.match(await page.evaluate(() => document.querySelector('.pvc-tot').innerText), /Estimados · Cartapra\s*1/i);
  assert.deepEqual(errores, []);
  await ctx.close();
}));

test('CARTERA · sin la RPC (PGRST202) vuelve a la pantalla de antes', { skip: omitir }, () => conNavegador(async (browser, base) => {
  const { ctx, page, errores } = await abrir(browser, base, '/pre-iva/cartera.html?periodo=2026-10', { vivo: '404' });
  await page.waitForSelector('tr.pvc-fila', { timeout: 15000 });
  assert.match(await filaDe(page, 'Uno'), /Pendiente/i); assert.match(await filaDe(page, 'Uno'), /Sin Pre-IVA este mes/);
  assert.equal(await page.evaluate(() => document.querySelectorAll('.pvc-sii-btn').length), 3);
  assert.deepEqual(errores, []);
  await ctx.close();
}));

test('DETALLE · historial de 6 meses y ventas/compras desde Cartapra; «Sin dato» solo donde no hay dato', { skip: omitir }, () => conNavegador(async (browser, base) => {
  const { ctx, page, errores, llamadas } = await abrir(browser, base, '/pre-iva/index.html?periodo=2026-10&cliente=1', { vivo: 'ok' });
  await page.waitForFunction(() => /Cartapra/.test((document.getElementById('pio-hist-fuente') || {}).textContent || ''), null, { timeout: 15000 });
  const h = await page.evaluate(() => ({ g: document.getElementById('pio-hist-graf').innerHTML, f: document.getElementById('pio-hist-fuente').textContent,
    t: document.getElementById('pio-tend-graf').innerHTML, tf: document.getElementById('pio-tend-fuente').textContent, traz: document.getElementById('pio-hist-traz').textContent,
    cmp: document.getElementById('pio-hist-cmp').textContent }));
  assert.equal((h.g.match(/Sin dato/g) || []).length, 1);                       // solo abril (sin datos del SII)
  assert.match(h.g, /May 26: \$300\.000/); assert.match(h.g, /Sep 26: \$700\.000/);
  assert.match(h.f, /Meses reales \(4\)/); assert.match(h.f, /Meses estimados \(1\)/);
  assert.match(h.cmp, /promedio \$450\.000/);                                    // (300 + 400 + 500 + 600) / 4: el estimado no entra
  assert.match(h.traz, /F29 del SII/); assert.match(h.traz, /Reporte cerrado/); assert.match(h.traz, /Estimado \(Cartapra\)/);
  assert.match(h.t, /Oct 26: \$10\.000\.000/); assert.match(h.t, /May 26: \$2\.000\.000/);   // ventas y compras de todos los meses con RCV
  assert.match(h.tf, /RCV del SII que trae Cartapra/);
  assert.ok(llamadas.includes('rpc/preiva_historial_vivo'));
  assert.ok(!llamadas.includes('reportes_mensuales'));                          // con el vivo no se usa el historial de Contable
  assert.deepEqual(errores, []);
  await ctx.close();
}));

test('DETALLE · sin la RPC (PGRST202) el historial vuelve a reportes_mensuales', { skip: omitir }, () => conNavegador(async (browser, base) => {
  const { ctx, page, errores, llamadas } = await abrir(browser, base, '/pre-iva/index.html?periodo=2026-10&cliente=1', { vivo: '404' });
  await page.waitForFunction(() => /reportes_mensuales/.test((document.getElementById('pio-hist-fuente') || {}).textContent || ''), null, { timeout: 15000 });
  assert.ok(llamadas.includes('reportes_mensuales'));
  assert.deepEqual(errores, []);
  await ctx.close();
}));
