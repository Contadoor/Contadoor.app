// Integración de la pantalla operativa y la cartera del Pre-IVA (ronda 2). Navegador local, datos 100 % ficticios, reloj fijo
// en el 22-10-2026; nada sale a internet (Supabase, correo y todo dominio externo se interceptan; auth.js se reemplaza).
// Ejecutar: PW_CORE=/ruta/a/node_modules/playwright-core node --test pre-iva/operativa-integracion.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
let pw = null; try { pw = require(process.env.PW_CORE || 'playwright-core'); } catch (e) { pw = null; }
const RAIZ = path.resolve(__dirname, '..');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg' };
const num = (t) => parseInt(String(t || '').replace(/[^0-9]/g, ''), 10) || 0;
const omitir = !pw ? 'sin playwright-core (defina PW_CORE)' : false;
function servidor() { return new Promise((ok) => { const s = http.createServer((req, res) => { const f = path.join(RAIZ, decodeURIComponent(new URL(req.url, 'http://x').pathname)); if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }).listen(0, '127.0.0.1', () => ok(s)); }); }

// o: {iva_condicion, docsError, docs:[...], resumen:[...], sii:'404'|{estado...}, historialPV:[...]}
async function abrir(browser, base, url, o = {}) {
  const ctx = await browser.newContext();
  const errores = [];
  await ctx.addInitScript(() => sessionStorage.setItem('usuario_activo', JSON.stringify({ nombre: 'Analista Prueba', email: 'a@example.invalid', esMaster: true, rol: 'master', rolLabel: 'Master' })));
  const CLI = { id: 1, rut: 'DEMO-01', razon_social: 'Cliente Ficticio SpA', email: 'ficticio@example.invalid', plan: 'asesoria', estado: 'activo', analista_contable: 'Analista Prueba', analista_contable_usuario_id: null, ppm_tasa_default: null, iva_condicion: o.iva_condicion || null, regimen: '14D3' };
  await ctx.route('**/*', async (route) => {
    const req = route.request(), u = new URL(req.url());
    if (u.hostname === '127.0.0.1') {
      if (/\/(auth|notifications)\.js$/.test(u.pathname)) return route.fulfill({ contentType: 'text/javascript', body: '' });
      if (/\/supabase\.js$/.test(u.pathname)) return route.fulfill({ contentType: 'text/javascript', body: "var SB_URL='https://sb.stub.invalid';function sbH(){return {};}function sbFetch(p,o){return fetch('https://sb.stub.invalid/rest/v1/'+p,o||{});}" });
      return route.continue();
    }
    if (u.hostname === 'sb.stub.invalid') {
      const p = u.pathname.replace('/rest/v1/', ''), json = (b, st) => route.fulfill({ status: st || 200, contentType: 'application/json', body: JSON.stringify(b) });
      if (p === 'clientes') return json([CLI]);
      if (p === 'planes') return json([{ codigo: 'asesoria', nombre: 'Contadoor PRO', incluye_preiva: true }]);
      if (p === 'periodos') return json([{ periodo: '2026-10', uf: 39700 }]);
      if (p === 'rpc/sapi_frescura') return o.sii && o.sii !== '404' ? json(o.sii) : json({ code: 'PGRST202', message: 'no existe' }, 404);
      if (p === 'rpc/remanente_anterior') return json(o.rem || { estado: 'SIN_DATO', motivo: 'SIN_MES_ANTERIOR' });   // REM-ANT-2
      if (p === 'reportes_mensuales') return json(String(u.searchParams.get('periodo') || '').startsWith('in.') ? (o.rm || []) : []);
      if (p === 'rcv_resumenes') return o.docsError ? json({ message: 'boom' }, 500) : json(o.resumen || []);
      if (p === 'rcv_documentos') return json(u.searchParams.get('offset') !== '0' ? [] : (o.docs || []));
      if (p === 'preiva_historial') {
        if (req.method() !== 'GET') return json([Object.assign({ cliente_rut: CLI.rut }, JSON.parse(req.postData() || '{}'))]);
        if (u.searchParams.get('periodo') === 'eq.2026-10' && o.fila) return json([o.fila]);
        return json(o.preiva || []);
      }
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
  return { ctx, page, errores };
}
async function listo(page) {
  await page.waitForFunction(() => document.getElementById('panel-simulacion').style.display === 'block' && document.getElementById('lbl-remanente').textContent !== 'cargando...', null, { timeout: 15000 });
}
async function escribir(page, v) { await page.evaluate((v) => { for (const [id, x] of Object.entries(v)) { const e = document.getElementById(id); e.value = x; e.dispatchEvent(new Event('input', { bubbles: true })); } }, v); await page.waitForTimeout(500); }
const txt = (page, id) => page.evaluate((id) => (document.getElementById(id) || {}).textContent || '', id);
async function conNavegador(fn) {
  const srv = await servidor(), base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await pw.chromium.launch({ channel: process.env.PW_CHANNEL || 'chrome', headless: true });
  try { await fn(browser, base); } finally { await browser.close(); srv.close(); }
}

test('PANTALLA · mes en curso: "Así vamos" (registrado) protagonista; el estimado es referencia; SII pendiente; sin errores', { skip: omitir }, () => conNavegador(async (browser, base) => {
  const { ctx, page, errores } = await abrir(browser, base, '/pre-iva/index.html?periodo=2026-10&cliente=1');
  await listo(page);
  await escribir(page, { 'inp-debito': 1000000, 'inp-credito': 500000, 'inp-exento-ventas': 0, 'inp-tasa-ppm': 1 });
  const ppmReal = Math.round(Math.round(1000000 / 0.19) / 100), ppmEst = Math.round(Math.round(Math.round(1000000 / 0.19) * 31 / 22) / 100);
  assert.equal(num(await txt(page, 'pio-real-f29')), 500000 + ppmReal);           // 552.632
  assert.equal(num(await txt(page, 'pio-r-deb')), 1000000);
  assert.equal(num(await txt(page, 'res-debito')), 1409091);                      // estimado (hotfix)
  assert.equal(num(await txt(page, 'res-f29')), 1409091 - 704545 + ppmEst);
  assert.match(await txt(page, 'pio-hero-lbl'), /📍 Así vamos · registrado al 22\/10/);
  assert.match(await txt(page, 'pio-ref-f29'), /^Referencia estimada: según tu ritmo actual .*\(solo proyección lineal\)/);   // sin 4 meses comparables
  assert.match(await txt(page, 'pio-ref-lim'), /Limitación: hay 0 de 4 meses cerrados comparables .* carga manual \(conexión con el SII pendiente de activación\)/);
  assert.doesNotMatch(await page.evaluate(() => document.body.innerText), /intervalo de confianza|predicción|F29 validado/i);
  assert.match(await txt(page, 'pio-sii-chip'), /pendiente de activación/);
  assert.equal(await page.evaluate(() => document.getElementById('pio-sii-btn').disabled), true);
  assert.equal(await page.evaluate(() => document.getElementById('pio-manual').hidden), false);
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('th.est')).display === 'none'), false);
  assert.deepEqual(errores, []);
  await ctx.close();
}));

test('PANTALLA · mes cerrado: solo el valor registrado ("Mes cerrado · valor registrado"), sin columna estimada', { skip: omitir }, () => conNavegador(async (browser, base) => {
  const { ctx, page, errores } = await abrir(browser, base, '/pre-iva/index.html?periodo=2026-09&cliente=1');
  await listo(page);
  await escribir(page, { 'inp-debito': 1900000, 'inp-credito': 900000, 'inp-exento-ventas': 0, 'inp-tasa-ppm': 1.5 });
  assert.match(await txt(page, 'pio-hero-lbl'), /Mes cerrado · valor registrado/);
  assert.equal(num(await txt(page, 'pio-real-f29')), 1150000); assert.equal(num(await txt(page, 'res-f29')), 1150000);
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('th.est')).display), 'none');
  assert.equal(await page.evaluate(() => document.getElementById('pio-ref-f29').hidden), true);
  assert.deepEqual(errores, []);
  await ctx.close();
}));

test('PANTALLA · empresa exenta: oculta débito/crédito/remanente/IVA y el F29 es solo el PPM', { skip: omitir }, () => conNavegador(async (browser, base) => {
  const { ctx, page, errores } = await abrir(browser, base, '/pre-iva/index.html?periodo=2026-09&cliente=1', { iva_condicion: 'exento' });
  await listo(page);
  await escribir(page, { 'inp-exento-ventas': 10000000, 'inp-tasa-ppm': 1.2 });
  await page.waitForFunction(() => document.getElementById('panel-simulacion').classList.contains('pio-modo-exenta'), null, { timeout: 5000 });
  const v = await page.evaluate(() => ({ kiva: getComputedStyle(document.querySelector('.k-iva')).display, fila: getComputedStyle(document.querySelector('tr.fila-iva')).display,
    deb: getComputedStyle(document.getElementById('inp-debito').closest('label')).display, aviso: !document.getElementById('pio-exenta').hidden }));
  assert.equal(v.kiva, 'none'); assert.equal(v.fila, 'none'); assert.equal(v.deb, 'none'); assert.equal(v.aviso, true);
  assert.equal(num(await txt(page, 'res-f29')), 120000); assert.equal(num(await txt(page, 'pio-real-f29')), 120000);
  assert.deepEqual(errores, []);
  await ctx.close();
}));

test('NEGATIVA · error al leer el RCV: se informa y no genera recomendaciones de documentos (error ≠ ausencia)', { skip: omitir }, () => conNavegador(async (browser, base) => {
  const { ctx, page, errores } = await abrir(browser, base, '/pre-iva/index.html?periodo=2026-10&cliente=1', { docsError: true });
  await listo(page);
  await escribir(page, { 'inp-debito': 1000000, 'inp-credito': 500000, 'inp-tasa-ppm': 1 });
  await page.waitForFunction(() => /No se pudieron leer/.test(document.getElementById('pio-docs-tabla').textContent), null, { timeout: 5000 });
  const recos = await page.evaluate(() => [...document.querySelectorAll('#pio-recos .reco')].map((e) => e.textContent).join(' | '));
  assert.doesNotMatch(recos, /factura|documento|comprobante|proveedor|boleta|nota de crédito/i);   // ninguna regla basada en documentos
  assert.ok(!recos || /proyección de renta/.test(recos), recos);                                   // solo puede quedar la de MiRenta (sin caso)
  assert.deepEqual(errores, []);
  await ctx.close();
}));

test('SEGURIDAD · razón social con HTML en un documento del SII: se muestra como texto (sin XSS)', { skip: omitir }, () => conNavegador(async (browser, base) => {
  const malo = '<img src=x onerror="window.__xss=1">Proveedor';
  const resumen = [{ snapshot_id: 9, periodo: '2026-10', tipo: 'compras', tipo_dte: 33, tipo_dte_label: '<b>FACTURA</b>', total_documentos: 1, monto_neto: 100000, monto_exento: 0, iva_recuperable: 19000, monto_total: 119000, creado_at: '2026-10-22T10:00:00Z' }];
  const docs = [{ snapshot_id: 9, periodo: '2026-10', tipo: 'compras', tipo_dte: 33, tipo_dte_label: '<b>FACTURA</b>', folio: '<i>1</i>', rut_contraparte: 'DEMO-X', razon_social_contraparte: malo, fecha_emision: '2026-10-20', fecha_recepcion: '2026-10-20', monto_neto: 100000, monto_exento: 0, monto_iva: 19000, monto_iva_recuperable: 19000, monto_total: 119000, estado: 'Confirmada' }];
  const { ctx, page, errores } = await abrir(browser, base, '/pre-iva/index.html?periodo=2026-10&cliente=1', { resumen, docs });
  await listo(page);
  await page.click('.pio-tabs [data-libro="compras"]');
  await page.waitForFunction(() => /Proveedor/.test(document.getElementById('pio-docs-tabla').textContent), null, { timeout: 5000 });
  assert.equal(await page.evaluate(() => window.__xss), undefined);
  assert.equal(await page.evaluate(() => document.querySelectorAll('#pio-docs-tabla img, #pio-docs-tot b b, #pio-docs-tabla i i').length), 0);
  assert.match(await txt(page, 'pio-docs-tabla'), /<img src=x/);
  assert.match(await txt(page, 'pio-docs-tabla'), /Pendiente · 6 días/);
  assert.deepEqual(errores, []);
  await ctx.close();
}));

test('PANTALLA · conexión SII activa (al día): oculta la carga manual y habilita el botón', { skip: omitir }, () => conNavegador(async (browser, base) => {
  const { ctx, page, errores } = await abrir(browser, base, '/pre-iva/index.html?periodo=2026-10&cliente=1', { sii: { estado: 'al_dia', ultimaConsulta: '2026-10-22T11:00:00Z' } });
  await listo(page);
  await page.waitForFunction(() => /SII al día/.test(document.getElementById('pio-sii-chip').textContent), null, { timeout: 5000 });
  assert.equal(await page.evaluate(() => document.getElementById('pio-manual').hidden), true);
  assert.equal(await page.evaluate(() => document.getElementById('pio-sii-btn').disabled), false);
  assert.deepEqual(errores, []);
  await ctx.close();
}));

test('CARTERA · exenta: "Exenta · solo PPM" e IVA "No aplica"; afecta: "Así vamos" con el estimado debajo; orden por estimado disponible', { skip: omitir }, () => conNavegador(async (browser, base) => {
  for (const [cond, esperado] of [['exento', /No aplica/], ['afecto', /estimado a fin de mes \$1\.000\.000/]]) {
    const preiva = [{ cliente_rut: 'DEMO-01', periodo: '2026-10', debito_iva: 1000000, credito_iva: 500000, remanente: 0, f29: 1100000, ppm: 100000, tasa_ppm: 1, fecha_envio: null }];
    const { ctx, page, errores } = await abrir(browser, base, '/pre-iva/cartera.html?periodo=2026-10', { iva_condicion: cond, preiva });
    await page.waitForFunction(() => document.querySelector('.pvc-tabla'), null, { timeout: 15000 });
    const t = await page.evaluate(() => document.querySelector('.pvc-tabla').textContent);
    assert.match(t, esperado);
    if (cond === 'exento') assert.match(t, /Exenta · solo PPM/); else assert.match(t, /Así vamos · IVA del mes/);
    assert.ok(await page.evaluate(() => !!document.querySelector('#pvOrden option[value="ivaEst"]')));
    assert.deepEqual(errores, []);
    await ctx.close();
  }
}));

test('PANTALLA ronda 4 · meses comparables estrictos con trazabilidad visible (excluidos se muestran con su motivo)', { skip: omitir }, () => conNavegador(async (browser, base) => {
  const fila = (p, extra) => Object.assign({ periodo: p, debito_iva: 2500000, credito_iva: 1700000, remanente: 0, ppm: 190000, ppm_tasa: 1.5, ppm_base: 12700000, estado_contable: 'completado', procesado_at: '2026-10-05T12:00:00Z', updated_at: '2026-10-05T12:00:00Z' }, extra || {});
  const rm = [fila('2026-04'), fila('2026-05'), fila('2026-06'), fila('2026-07'), fila('2026-08', { estado_contable: 'pendiente' }), fila('2026-09', { debito_iva: 0, credito_iva: 0 })];
  const { ctx, page, errores } = await abrir(browser, base, '/pre-iva/index.html?periodo=2026-10&cliente=1', { rm });
  await listo(page);
  await escribir(page, { 'inp-debito': 1000000, 'inp-credito': 500000, 'inp-exento-ventas': 0, 'inp-tasa-ppm': 1 });
  await page.waitForFunction(() => /Período/.test(document.getElementById('pio-hist-traz').textContent), null, { timeout: 5000 });
  const traz = await txt(page, 'pio-hist-traz');
  assert.match(traz, /Ago 26.*Excluido.*sin evidencia de registro de Contable \(estado contable: pendiente\)/s);
  assert.match(traz, /Sep 26.*datos insuficientes para: iva, debito, credito/s);
  assert.match(traz, /Abr 26.*Se usa: iva, ppm, ventas, debito, credito/s);
  assert.match(traz, /estado contable: completado/); assert.match(traz, /procesado el .* \(solo trazabilidad\)/);
  assert.match(await txt(page, 'pio-ref-f29'), /rango referencial.*promedio de 4 meses cerrados/);   // 4 comparables (abr–jul)
  assert.deepEqual(errores, []);
  await ctx.close();
}));
