// Prueba de INTEGRACIÓN del Pre-IVA (pantalla real en un navegador local, datos 100 % ficticios).
// Verifica que el F29 mostrado en pantalla = el del reporte = el del correo preparado (payload a /api/enviar-preiva)
// = el que se guarda en preiva_historial.f29, también tras "Editar reporte" (manual y recálculo con F29 en 0).
// NADA sale a internet: Supabase, el proxy de correo y todo dominio externo se interceptan; auth.js se reemplaza.
// Ejecutar:  PW_CORE=/ruta/a/node_modules/playwright-core node --test pre-iva/f29-integracion.test.js
//   (usa el Chrome instalado; se omite sola si no hay playwright-core o Chrome).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const F = require('./f29-formula.js');

let pw = null;
try { pw = require(process.env.PW_CORE || 'playwright-core'); } catch (e) { pw = null; }

const RAIZ = path.resolve(__dirname, '..');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };
const CLIENTE = { id: 1, rut: '11111111-1', razon_social: 'Cliente Ficticio SpA', email: 'ficticio@example.invalid', plan: 'Prueba', estado: 'activo',
  analista_contable: 'Analista Prueba', analista_rrhh: null, analista_contable_usuario_id: null, analista_rrhh_usuario_id: null, ppm_tasa_default: null };
// Sustituto de supabase.js: mismo nombre de función, pero contra un dominio falso que se intercepta.
const SUPABASE_STUB = "function sbFetch(path,opts){return fetch('https://sb.stub.invalid/rest/v1/'+path,opts||{});}";

function servidor() {
  return new Promise((ok) => {
    const s = http.createServer((req, res) => {
      const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      const f = path.join(RAIZ, u);
      if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(res);
    }).listen(0, '127.0.0.1', () => ok(s));
  });
}

async function abrir(browser, base, { remanente }) {
  const ctx = await browser.newContext();
  const cap = { correos: [], guardados: [], dialogos: [] };
  await ctx.addInitScript(() => {
    sessionStorage.setItem('usuario_activo', JSON.stringify({ nombre: 'Analista Prueba', email: 'analista@example.invalid', esMaster: true, rol: 'master', rolLabel: 'Master' }));
  });
  await ctx.route('**/*', async (route) => {
    const req = route.request(), url = new URL(req.url());
    if (url.hostname === '127.0.0.1') {
      if (/\/(auth|notifications)\.js$/.test(url.pathname)) return route.fulfill({ contentType: 'text/javascript', body: '' });
      if (/\/supabase\.js$/.test(url.pathname)) return route.fulfill({ contentType: 'text/javascript', body: SUPABASE_STUB });
      return route.continue();
    }
    if (url.hostname === 'sb.stub.invalid') {
      const p = url.pathname.replace('/rest/v1/', '');
      const json = (b) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(b) });
      if (p === 'clientes') return json([CLIENTE]);
      if (p === 'reportes_mensuales') return json(remanente ? [{ iva_remanente_sig: remanente, remanente: remanente }] : []);
      if (p === 'preiva_historial') {
        if (req.method() === 'GET') return json([]);
        const cuerpo = JSON.parse(req.postData() || '{}');
        cap.guardados.push({ metodo: req.method(), cuerpo });
        return json([Object.assign({ cliente_rut: CLIENTE.rut }, cuerpo)]);
      }
      return json([]);
    }
    if (url.hostname === 'contafunnel-v2.vercel.app') {   // el correo se captura, NO se envía
      cap.correos.push(JSON.parse(req.postData() || '{}'));
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, id: 'prueba' }) });
    }
    return route.abort();   // fuentes, imágenes y cualquier otro dominio: nada sale
  });
  const page = await ctx.newPage();
  page.on('dialog', (d) => { cap.dialogos.push(d.message()); d.accept(); });
  // Mes pasado (sin proyección): los montos son deterministas.
  await page.goto(base + '/pre-iva/index.html?periodo=2026-09&cliente=1');
  await page.evaluate(() => document.documentElement.classList.remove('auth-pending'));   // lo haría auth.js (reemplazado)
  await page.waitForFunction(() => document.getElementById('panel-simulacion') && document.getElementById('panel-simulacion').style.display === 'block' && document.getElementById('lbl-remanente').textContent !== 'cargando...', null, { timeout: 15000 });
  return { ctx, page, cap };
}

async function escribir(page, valores) {
  await page.evaluate((v) => {
    for (const [id, val] of Object.entries(v)) {
      const e = document.getElementById(id); e.value = val; e.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, valores);
}
const num = (t) => parseInt(String(t || '').replace(/[^0-9]/g, ''), 10) || 0;
async function f29Pantalla(page) { return page.evaluate(() => ({ res: document.getElementById('res-f29').textContent, kpi: document.getElementById('kpi-f29').textContent, ppm: document.getElementById('res-ppm').textContent, aviso: document.getElementById('res-ppm-aviso').textContent, alcance: (document.getElementById('res-f29-alcance') || {}).textContent || '' })); }
// F29 del reporte: la celda que sigue a "F29 estimado a pagar" en la tabla de composición.
function f29DeReporte(html) { const m = String(html).match(/F29 estimado a pagar<\/td><td[^>]*>([^<]+)</); return m ? num(m[1]) : null; }

const omitir = !pw ? 'sin playwright-core (defina PW_CORE)' : false;

test('INTEGRACIÓN · pantalla = reporte = correo = guardado (cálculo automático, con exento)', { skip: omitir }, async () => {
  const srv = await servidor(), base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await pw.chromium.launch({ channel: process.env.PW_CHANNEL || 'chrome', headless: true });
  try {
    const { ctx, page, cap } = await abrir(browser, base, { remanente: 300000 });
    await escribir(page, { 'inp-debito': 1900000, 'inp-credito': 900000, 'inp-exento-ventas': 0, 'inp-tasa-ppm': 1.5 });
    // Sin libro cargado: neto = débito ÷ 0,19 = 10.000.000 (estimado); exento 0 conocido.
    const ppmEsp = F.calcularPPM(F.calcularBasePPM({ debito: 1900000, exento: 0 }).base, 1.5);          // 150.000
    const esperado = F.calcularF29Estimado({ debito: 1900000, credito: 900000, remanente: 300000, ppm: ppmEsp }).total;   // 850.000
    assert.equal(ppmEsp, 150000); assert.equal(esperado, 850000);
    const p = await f29Pantalla(page);
    assert.equal(num(p.res), esperado); assert.equal(num(p.kpi), esperado); assert.equal(num(p.ppm), ppmEsp);
    assert.match(p.aviso, /neto afecto estimado/);                 // neto estimado → no definitivo
    assert.match(p.alcance, /no es el total definitivo/);
    const rep = await page.evaluate(() => buildReporteHTML());
    assert.equal(f29DeReporte(rep), esperado);
    assert.match(rep, /no es el total definitivo/);
    assert.match(rep, /Estimado: neto afecto estimado/);
    await page.click('#btn-enviar');
    await page.waitForFunction(() => !document.getElementById('btn-enviar').disabled, null, { timeout: 10000 });
    await page.waitForTimeout(300);
    assert.equal(cap.correos.length, 1, 'se preparó un correo (capturado, no enviado)');
    assert.equal(f29DeReporte(cap.correos[0].htmlReporte), esperado);
    assert.match(cap.dialogos.join('\n'), /F29 proyectado: \$?[\d.]*850\.000/);
    assert.match(cap.dialogos.join('\n'), /no es el total definitivo/);
    assert.match(cap.dialogos.join('\n'), /PPM no definitivo/);
    const envio = cap.guardados.filter((g) => g.cuerpo.fecha_envio);
    assert.equal(envio.length, 1);
    assert.equal(envio[0].cuerpo.f29, esperado);
    assert.equal(envio[0].cuerpo.ppm, ppmEsp);
    assert.equal(envio[0].cuerpo.remanente, 300000);
    await ctx.close();
  } finally { await browser.close(); srv.close(); }
});

test('INTEGRACIÓN · "Editar reporte": manual se respeta y F29 en 0 recalcula; pantalla/reporte/correo/guardado coinciden', { skip: omitir }, async () => {
  const srv = await servidor(), base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await pw.chromium.launch({ channel: process.env.PW_CHANNEL || 'chrome', headless: true });
  try {
    const { ctx, page, cap } = await abrir(browser, base, { remanente: 0 });
    await escribir(page, { 'inp-debito': 500000, 'inp-credito': 800000, 'inp-tasa-ppm': 1 });
    // Recálculo: PPM editado a 100.000 y F29 en 0 → máx(500.000 − 800.000 − 0, 0) + 100.000 = 100.000
    await page.evaluate(() => { abrirModalEdicion(); document.getElementById('ed-ppm').value = 100000; document.getElementById('ed-f29').value = 0; guardarEdicion(); });
    let rep = await page.evaluate(() => buildReporteHTML());
    assert.equal(f29DeReporte(rep), 100000);
    // Manual: F29 escrito a mano = 123.456 se respeta tal cual
    await page.evaluate(() => { abrirModalEdicion(); document.getElementById('ed-f29').value = 123456; guardarEdicion(); });
    rep = await page.evaluate(() => buildReporteHTML());
    assert.equal(f29DeReporte(rep), 123456);
    // Vuelta a recálculo con F29 en 0
    await page.evaluate(() => { abrirModalEdicion(); document.getElementById('ed-f29').value = 0; guardarEdicion(); });
    rep = await page.evaluate(() => buildReporteHTML());
    assert.equal(f29DeReporte(rep), 100000);
    await page.click('#btn-enviar');
    await page.waitForFunction(() => !document.getElementById('btn-enviar').disabled, null, { timeout: 10000 });
    await page.waitForTimeout(300);
    assert.equal(f29DeReporte(cap.correos[0].htmlReporte), 100000);
    const envio = cap.guardados.filter((g) => g.cuerpo.fecha_envio);
    assert.equal(envio[0].cuerpo.f29, 100000);
    assert.equal(envio[0].cuerpo.ppm, 100000);
    // La pantalla (cálculo automático, sin edición) sigue dando su propio valor con la fórmula nueva
    const p = await f29Pantalla(page);
    const ppmAuto = F.calcularPPM(F.calcularBasePPM({ debito: 500000 }).base, 1);
    assert.equal(num(p.res), F.calcularF29Estimado({ debito: 500000, credito: 800000, remanente: 0, ppm: ppmAuto }).total);
    await ctx.close();
  } finally { await browser.close(); srv.close(); }
});

test('INTEGRACIÓN · no regresión: carga sin errores, KPIs, remanente, acciones y borrador guardado coherente', { skip: omitir }, async () => {
  const srv = await servidor(), base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await pw.chromium.launch({ channel: process.env.PW_CHANNEL || 'chrome', headless: true });
  try {
    const { ctx, page, cap } = await abrir(browser, base, { remanente: 0 });
    const errores = [];
    page.on('pageerror', (e) => errores.push(e.message));
    await escribir(page, { 'inp-debito': 1900000, 'inp-credito': 900000, 'inp-exento-ventas': 2000000, 'inp-tasa-ppm': 1.5 });
    const ppm = F.calcularPPM(10000000 + 2000000, 1.5);   // neto estimado 10.000.000 + exento 2.000.000 = 180.000
    const est = await page.evaluate(() => ({
      deb: document.getElementById('res-debito').textContent, cred: document.getElementById('res-credito').textContent,
      rem: document.getElementById('kpi-remanente').textContent, kppm: document.getElementById('kpi-ppm').textContent,
      acciones: [...document.querySelectorAll('#acciones-grid .ac-titulo')].map((e) => e.textContent),
      corte: document.getElementById('lbl-corte').textContent,
    }));
    assert.equal(num(est.deb), 1900000); assert.equal(num(est.cred), 900000);   // mes pasado: sin proyección
    assert.equal(num(est.rem), 0); assert.equal(num(est.kppm), ppm);
    assert.deepEqual(est.acciones, ['Adelantar compras del mes siguiente', 'Revisar facturas de proveedores pendientes']);
    assert.match(est.corte, /Mes distinto al en curso/);
    // Remanente a favor: KPI muestra el nuevo remanente y no lo infla el PPM
    await escribir(page, { 'inp-debito': 500000, 'inp-credito': 800000 });
    assert.equal(num(await page.evaluate(() => document.getElementById('kpi-remanente').textContent)), 300000);
    // Borrador automático (autoguardado): el f29 guardado = el de la pantalla
    await page.waitForFunction(() => true);
    await page.waitForTimeout(3500);
    const f29pant = num(await page.evaluate(() => document.getElementById('res-f29').textContent));
    const ult = cap.guardados.filter((g) => !g.cuerpo.fecha_envio).pop();
    if (ult) assert.equal(ult.cuerpo.f29, f29pant);
    assert.deepEqual(errores, []);
    await ctx.close();
  } finally { await browser.close(); srv.close(); }
});
