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

async function abrir(browser, base, { remanente, rem }) {
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
      if (p === 'rpc/remanente_anterior') {
        // REM-ANT-2: la base responde el remanente anterior (cód. 77 → 504). Con remanente: CONOCIDO (UTM 1:1); sin él: SIN_DATO.
        if (rem) return json(rem);
        return json(remanente ? { estado: 'CONOCIDO', fuente: 'MES_ANTERIOR', cod77: remanente, cod504: remanente, utm_origen: 69000, utm_destino: 69000, mes_utm_origen: '2026-10', mes_utm_destino: '2026-11', periodo: '2026-10', periodo_anterior: '2026-09' }
                              : { estado: 'SIN_DATO', motivo: 'SIN_MES_ANTERIOR', periodo: '2026-10', periodo_anterior: '2026-09' });
      }
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

test('INTEGRACIÓN R4 · aviso de PPM estimado: editado sin confirmar → con aviso; editado y confirmado → sin aviso', { skip: omitir }, async () => {
  const srv = await servidor(), base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await pw.chromium.launch({ channel: process.env.PW_CHANNEL || 'chrome', headless: true });
  try {
    const { ctx, page, cap } = await abrir(browser, base, { remanente: 0 });
    await escribir(page, { 'inp-debito': 1900000, 'inp-credito': 900000, 'inp-tasa-ppm': 1.5 });   // sin exento ni libro → PPM estimado
    // 1) PPM editado a mano (distinto del automático), casilla SIN marcar (viene desmarcada por defecto)
    const porDefecto = await page.evaluate(() => { abrirModalEdicion(); const c = document.getElementById('ed-ppm-verificado').checked; document.getElementById('ed-ppm').value = 175000; document.getElementById('ed-f29').value = 0; guardarEdicion(); return c; });
    assert.equal(porDefecto, false);
    let rep = await page.evaluate(() => buildReporteHTML());
    assert.match(rep, /Estimado: [^<]*PPM estimado sin ventas exentas/);
    assert.match(rep, /PPM editado a mano sin verificar/);
    assert.equal(f29DeReporte(rep), 1000000 + 175000);
    // 2) Mismo PPM, ahora con la casilla marcada → sin aviso de PPM (el aviso de alcance del F29 se mantiene)
    await page.evaluate(() => { abrirModalEdicion(); document.getElementById('ed-ppm-verificado').checked = true; guardarEdicion(); });
    rep = await page.evaluate(() => buildReporteHTML());
    assert.doesNotMatch(rep, /Estimado: /);
    assert.match(rep, /no es el total definitivo/);
    // 3) Al reabrir, la casilla refleja lo confirmado; al desmarcarla vuelve el aviso
    const sigue = await page.evaluate(() => { abrirModalEdicion(); const c = document.getElementById('ed-ppm-verificado').checked; document.getElementById('ed-ppm-verificado').checked = false; guardarEdicion(); return c; });
    assert.equal(sigue, true);
    assert.match(await page.evaluate(() => buildReporteHTML()), /Estimado: /);
    // 4) "Restablecer" (limpiarEdicion) vuelve a desmarcar
    await page.evaluate(() => { abrirModalEdicion(); document.getElementById('ed-ppm-verificado').checked = true; guardarEdicion(); abrirModalEdicion(); limpiarEdicion(); });
    assert.equal(await page.evaluate(() => _editOverrides.ppmVerificado), false);
    // El correo preparado lleva el mismo aviso que el reporte
    await page.evaluate(() => { abrirModalEdicion(); document.getElementById('ed-ppm').value = 175000; document.getElementById('ed-f29').value = 0; guardarEdicion(); });
    await page.click('#btn-enviar');
    await page.waitForFunction(() => !document.getElementById('btn-enviar').disabled, null, { timeout: 10000 });
    await page.waitForTimeout(300);
    assert.match(cap.correos[0].htmlReporte, /Estimado: /);
    assert.match(cap.dialogos.join('\n'), /PPM no definitivo: [^\n]*PPM editado a mano sin verificar/);
    await ctx.close();
  } finally { await browser.close(); srv.close(); }
});

test('INTEGRACIÓN R4 · montos inválidos: se marcan, "Editar reporte" no los aplica y el envío queda BLOQUEADO', { skip: omitir }, async () => {
  const srv = await servidor(), base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await pw.chromium.launch({ channel: process.env.PW_CHANNEL || 'chrome', headless: true });
  try {
    const { ctx, page, cap } = await abrir(browser, base, { remanente: 0 });
    await escribir(page, { 'inp-debito': 1900000, 'inp-credito': 900000, 'inp-exento-ventas': 0, 'inp-tasa-ppm': 1.5 });
    const intentarEnvio = async () => { await page.click('#btn-enviar'); await page.waitForTimeout(400); };
    // a) Negativo en débito → aviso visible y envío bloqueado (ni correo ni guardado de envío)
    await escribir(page, { 'inp-debito': -5 });
    let av = await page.evaluate(() => ({ t: document.getElementById('aviso-entradas').textContent, v: getComputedStyle(document.getElementById('aviso-entradas')).display, inv: document.getElementById('inp-debito').getAttribute('aria-invalid') }));
    assert.match(av.t, /Débito IVA registrado: no puede ser negativo/); assert.notEqual(av.v, 'none'); assert.equal(av.inv, 'true');
    await intentarEnvio();
    assert.equal(cap.correos.length, 0); assert.equal(cap.guardados.filter((g) => g.cuerpo.fecha_envio).length, 0);
    assert.match(cap.dialogos.pop(), /No se puede enviar: hay montos inválidos/);
    // b) Texto no numérico en crédito (el navegador marca badInput) → bloqueado
    await escribir(page, { 'inp-debito': 1900000 });
    await page.fill('#inp-credito', '');
    await page.focus('#inp-credito'); await page.keyboard.type('9e');
    await page.evaluate(() => document.getElementById('inp-credito').dispatchEvent(new Event('input', { bubbles: true })));
    av = await page.evaluate(() => document.getElementById('aviso-entradas').textContent);
    assert.match(av, /Crédito IVA registrado: no es un número válido/);
    await intentarEnvio();
    assert.equal(cap.correos.length, 0);
    // c) Decimales en ventas exentas → bloqueado
    await page.fill('#inp-credito', '900000'); await escribir(page, { 'inp-credito': 900000, 'inp-exento-ventas': '12.5' });
    assert.match(await page.evaluate(() => document.getElementById('aviso-entradas').textContent), /Ventas exentas \(neto\): debe ser un monto en pesos sin decimales/);
    await intentarEnvio();
    assert.equal(cap.correos.length, 0);
    // d) "Editar reporte" con PPM negativo, remanente con decimales o F29 manual negativo → no se aplica nada
    await escribir(page, { 'inp-exento-ventas': 0 });
    const antes = await page.evaluate(() => JSON.stringify(_editOverrides));
    for (const [id, val, msg] of [['ed-ppm', '-1', /PPM: no puede ser negativo/], ['ed-remanente', '10.5', /Remanente: debe ser un monto en pesos sin decimales/], ['ed-f29', '-100', /F29 a pagar \(manual\): no puede ser negativo/], ['ed-debito', '-2', /Débito IVA: no puede ser negativo/], ['ed-credito', '-3', /Crédito IVA: no puede ser negativo/]]) {
      const r = await page.evaluate(([i, v]) => { abrirModalEdicion(); document.getElementById(i).value = v; guardarEdicion(); const box = document.getElementById('ed-errores'); const out = { abierto: !!document.getElementById('modal-edicion'), err: box ? box.textContent : '' }; document.getElementById('modal-edicion').remove(); return out; }, [id, val]);
      assert.equal(r.abierto, true, id + ': el modal queda abierto'); assert.match(r.err, msg);
      assert.equal(await page.evaluate(() => JSON.stringify(_editOverrides)), antes, id + ': no se aplicó nada');
    }
    // e) Corregido todo → el envío funciona
    assert.equal(await page.evaluate(() => document.getElementById('aviso-entradas').style.display), 'none');
    await page.click('#btn-enviar');
    await page.waitForFunction(() => !document.getElementById('btn-enviar').disabled, null, { timeout: 10000 });
    await page.waitForTimeout(300);
    assert.equal(cap.correos.length, 1);
    await ctx.close();
  } finally { await browser.close(); srv.close(); }
});

test('INTEGRACIÓN REM-ANT-2 · sin dato → alerta; cero confirmado y 77→504 reajustado → sin alerta y se muestran ambos códigos', { skip: omitir }, async () => {
  const srv = await servidor(), base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await pw.chromium.launch({ channel: process.env.PW_CHANNEL || 'chrome', headless: true });
  try {
    const leer = (page) => page.evaluate(() => { const a = document.getElementById('pio-aviso-remanente'); return { visible: !!a && !a.hidden, txt: (document.getElementById('pio-aviso-remanente-txt') || {}).textContent || '',
      fuente: document.getElementById('lbl-remanente-fuente').textContent, valor: document.getElementById('lbl-remanente').textContent }; });
    const sin = await abrir(browser, base, { remanente: 0 });
    const a1 = await leer(sin.page);
    assert.equal(a1.visible, true, 'sin dato la alerta debe verse');
    assert.match(a1.txt, /Falta el remanente de septiembre 2026.* Mientras tanto el cálculo usa \$0/);
    await sin.ctx.close();
    const cero = await abrir(browser, base, { rem: { estado: 'CONOCIDO', fuente: 'F29_MANUAL', cod77: 0, cod504: 0, utm_origen: 69000, utm_destino: 69500, mes_utm_origen: '2026-10', mes_utm_destino: '2026-11', periodo: '2026-10', periodo_anterior: '2026-09', manual: { usuario_nombre: 'Analista Ficticia', motivo: 'F29 sept. sin remanente' } } });
    const a2 = await leer(cero.page);
    assert.equal(a2.valor, '$0'); assert.match(a2.fuente, /cód\. 504 · Cód\. 77 de septiembre 2026: \$0/); assert.match(a2.txt, /ingresado a mano por Analista Ficticia/);
    await cero.ctx.close();
    const reaj = await abrir(browser, base, { rem: { estado: 'CONOCIDO', fuente: 'MES_ANTERIOR', cod77: 1000000, cod504: 1007246, utm_origen: 69000, utm_destino: 69500, mes_utm_origen: '2026-10', mes_utm_destino: '2026-11', periodo: '2026-10', periodo_anterior: '2026-09' } });
    const a3 = await leer(reaj.page);
    assert.equal(a3.visible, false); assert.equal(a3.valor, '$1.007.246');
    assert.match(a3.fuente, /Cód\. 77 de septiembre 2026: \$1\.000\.000 × UTM noviembre 2026 \$69\.500 ÷ UTM octubre 2026 \$69\.000 = cód\. 504 \$1\.007\.246/);
    await reaj.ctx.close();
    const conf = await abrir(browser, base, { rem: { estado: 'CONFLICTO', fuente: 'F29_MANUAL', cod77: 1000000, cod504: 1007246, mes_anterior_cod77: 900000, utm_origen: 69000, utm_destino: 69500, mes_utm_origen: '2026-10', mes_utm_destino: '2026-11', periodo: '2026-10', periodo_anterior: '2026-09', manual: {} } });
    const a4 = await leer(conf.page);
    assert.equal(a4.visible, true); assert.match(a4.txt, /^Conflicto: el reporte de septiembre 2026 trae cód\. 77 \$900\.000/);
    await conf.ctx.close();
  } finally { await browser.close(); srv.close(); }
});
