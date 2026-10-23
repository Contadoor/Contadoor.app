// Integración del HOTFIX de proyección: pantalla real con el reloj fijado en el 22-10-2026 (datos ficticios; nada sale a internet).
// Ejecutar: PW_CORE=/ruta/a/node_modules/playwright-core node --test pre-iva/proyeccion-integracion.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
let pw = null; try { pw = require(process.env.PW_CORE || 'playwright-core'); } catch (e) { pw = null; }
const RAIZ = path.resolve(__dirname, '..');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
const CLIENTE = { id: 1, rut: '11111111-1', razon_social: 'Cliente Ficticio SpA', email: 'ficticio@example.invalid', plan: 'Prueba', estado: 'activo', analista_contable: 'Analista Prueba', ppm_tasa_default: null };
function servidor() { return new Promise((ok) => { const s = http.createServer((req, res) => { const f = path.join(RAIZ, decodeURIComponent(new URL(req.url, 'http://x').pathname)); if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }).listen(0, '127.0.0.1', () => ok(s)); }); }
const num = (t) => parseInt(String(t || '').replace(/[^0-9]/g, ''), 10) || 0;

async function abrir(browser, base, periodo) {
  const ctx = await browser.newContext();
  await ctx.addInitScript(() => sessionStorage.setItem('usuario_activo', JSON.stringify({ nombre: 'Analista Prueba', esMaster: true, rol: 'master' })));
  await ctx.route('**/*', async (route) => {
    const req = route.request(), url = new URL(req.url());
    if (url.hostname === '127.0.0.1') {
      if (/\/(auth|notifications)\.js$/.test(url.pathname)) return route.fulfill({ contentType: 'text/javascript', body: '' });
      if (/\/supabase\.js$/.test(url.pathname)) return route.fulfill({ contentType: 'text/javascript', body: "function sbFetch(p,o){return fetch('https://sb.stub.invalid/rest/v1/'+p,o||{});}" });
      return route.continue();
    }
    if (url.hostname === 'sb.stub.invalid') {
      const p = url.pathname.replace('/rest/v1/', ''), json = (b) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(b) });
      if (p === 'clientes') return json([CLIENTE]);
      if (p === 'preiva_historial' && req.method() !== 'GET') return json([Object.assign({ cliente_rut: CLIENTE.rut }, JSON.parse(req.postData() || '{}'))]);
      return json([]);
    }
    return route.abort();
  });
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date(2026, 9, 22, 12, 0, 0));   // 22-10-2026 12:00 (hora local)
  await page.goto(base + '/pre-iva/index.html?periodo=' + periodo + '&cliente=1');
  await page.evaluate(() => document.documentElement.classList.remove('auth-pending'));
  await page.waitForFunction(() => document.getElementById('panel-simulacion').style.display === 'block' && document.getElementById('lbl-remanente').textContent !== 'cargando...', null, { timeout: 15000 });
  return { ctx, page };
}
async function escribir(page, v) { await page.evaluate((v) => { for (const [id, x] of Object.entries(v)) { const e = document.getElementById(id); e.value = x; e.dispatchEvent(new Event('input', { bubbles: true })); } }, v); }
const leer = (page) => page.evaluate(() => Object.fromEntries(['res-debito', 'res-credito', 'res-ppm', 'res-f29', 'res-dias-rest', 'inp-dias-transc', 'inp-dias-tot'].map((id) => { const e = document.getElementById(id); return [id, e.value !== undefined && e.tagName === 'INPUT' ? e.value : e.textContent]; })));
const omitir = !pw ? 'sin playwright-core (defina PW_CORE)' : false;

test('INTEGRACIÓN hotfix · mes en curso (22-10): proyecta a fin de mes; "días para actuar" sigue hasta el 20-11', { skip: omitir }, async () => {
  const srv = await servidor(), base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await pw.chromium.launch({ channel: process.env.PW_CHANNEL || 'chrome', headless: true });
  try {
    const { ctx, page } = await abrir(browser, base, '2026-10');
    await escribir(page, { 'inp-debito': 1000000, 'inp-credito': 500000, 'inp-exento-ventas': 0, 'inp-tasa-ppm': 1 });
    const r = await leer(page);
    assert.equal(r['inp-dias-transc'], '22'); assert.equal(r['inp-dias-tot'], '31');
    assert.equal(num(r['res-debito']), 1409091);          // antes ~2.318.182
    assert.equal(num(r['res-credito']), 704545);
    const baseProy = Math.round(Math.round(1000000 / 0.19) * 31 / 22);
    assert.equal(num(r['res-ppm']), Math.round(baseProy * 1 / 100));
    assert.equal(num(r['res-f29']), (1409091 - 704545) + Math.round(baseProy / 100));
    assert.equal(num(r['res-dias-rest']), 29);            // vencimiento del F29: dato separado
    await ctx.close();
  } finally { await browser.close(); srv.close(); }
});

test('INTEGRACIÓN hotfix · mes cerrado (septiembre abierto el 22-10): sin extrapolación', { skip: omitir }, async () => {
  const srv = await servidor(), base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await pw.chromium.launch({ channel: process.env.PW_CHANNEL || 'chrome', headless: true });
  try {
    const { ctx, page } = await abrir(browser, base, '2026-09');
    await escribir(page, { 'inp-debito': 1900000, 'inp-credito': 900000, 'inp-exento-ventas': 0, 'inp-tasa-ppm': 1.5 });
    const r = await leer(page);
    assert.equal(num(r['res-debito']), 1900000); assert.equal(num(r['res-credito']), 900000);
    assert.equal(num(r['res-ppm']), 150000); assert.equal(num(r['res-f29']), 1150000);   // 1.000.000 + 150.000 (sin remanente)
    await ctx.close();
  } finally { await browser.close(); srv.close(); }
});

test('INTEGRACIÓN ronda 3 · días totales de solo lectura y del calendario; transcurridos no pasan de hoy', { skip: omitir }, async () => {
  const srv = await servidor(), base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await pw.chromium.launch({ channel: process.env.PW_CHANNEL || 'chrome', headless: true });
  try {
    const { ctx, page } = await abrir(browser, base, '2026-10');
    assert.equal(await page.evaluate(() => document.getElementById('inp-dias-tot').readOnly), true);
    await escribir(page, { 'inp-debito': 1000000, 'inp-credito': 0, 'inp-tasa-ppm': 0, 'inp-dias-tot': 30, 'inp-dias-transc': 28 });
    const r = await leer(page);
    assert.equal(r['inp-dias-tot'], '31'); assert.equal(r['inp-dias-transc'], '22');
    assert.equal(num(r['res-debito']), 1409091);
    await ctx.close();
  } finally { await browser.close(); srv.close(); }
});
