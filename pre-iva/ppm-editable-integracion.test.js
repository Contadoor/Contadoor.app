// INTEGRACIÓN (pantalla real del Pre-IVA en Chrome headless, datos 100 % ficticios, nada sale a internet) — 19-11:
//   · el Pre-IVA calcula con los datos del SII (sii_preiva_periodo) EXACTAMENTE lo mismo que la tarjeta «Cálculo del F29» del
//     Reporte Contable (reportes-contable/calculo-f29.js), también con el PPM editado;
//   · «Editar PPM»: editar tasa, editar monto, volver al calculado; motivo obligatorio; el total del F29 se recalcula;
//   · 19-11 (regla definitiva de Luciano): en el Pre-IVA (estimado del MES EN CURSO) el PPM editado es SIMULACIÓN: NO se guarda.
//     El PPM editado con motivo se guarda desde Contable (tarjeta «Cálculo del F29»); el Pre-IVA lo muestra y lo conserva al guardar.
//   · un período ya cerrado se puede mirar en el Pre-IVA, pero no se guarda: aviso + «Validar en Contable →».
// Ejecutar:  PW_CORE=/ruta/a/node_modules/playwright-core node --test pre-iva/ppm-editable-integracion.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const C = require('../reportes-contable/calculo-f29.js');

let pw = null;
try { pw = require(process.env.PW_CORE || 'playwright-core'); } catch (e) { pw = null; }
const RAIZ = path.resolve(__dirname, '..');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };
const CLIENTE = { id: 1, rut: '11111111-1', razon_social: 'Cliente Ficticio SpA', email: 'ficticio@example.invalid', plan: 'Prueba', estado: 'activo',
  analista_contable: 'Analista Prueba', analista_rrhh: null, analista_contable_usuario_id: null, analista_rrhh_usuario_id: null, ppm_tasa_default: null };
const SUPABASE_STUB = "function sbFetch(path,opts){return fetch('https://sb.stub.invalid/rest/v1/'+path,opts||{});}";
const RAW = { conexion: { estado: 'conectada' }, datos_al: '2026-11-19T10:00:00Z', cobertura: { rcv_ventas: 'completa', rcv_compras: 'completa', honorarios: 'completa' }, avisos: [],
  ventas: { documentos: 5, neto: 10000000, exento: 500000, iva: 1900000, total: 12400000, por_tipo: { '33': { n: 5, neto: 10000000, exento: 0, iva: 1900000, total: 11900000 } } },
  compras: { registro: { documentos: 3, neto: 4000000, exento: 0, iva: 760000, total: 4760000 }, por_tipo: {} },
  honorarios: { honorarios_recibidos: { documentos: 2, bruto: 500000, retencion: 68750 } },
  remanente_anterior: { periodo: '2026-09', folio: 123, cod77: 100000, cod504: 101000, fuente: 'sii_codigo_77', mes_utm_origen: '2026-10', mes_utm_destino: '2026-11', utm_origen: 69000, utm_destino: 69690, falta_utm: [] } };
const HIST = [{ periodo: '2026-09', tasa_ppm: 1.5, f29: 1, fecha_envio: null, enviado_por: null }];

function servidor() {
  return new Promise((ok) => {
    const s = http.createServer((req, res) => {
      const u = decodeURIComponent(new URL(req.url, 'http://x').pathname), f = path.join(RAIZ, u);
      if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
    }).listen(0, '127.0.0.1', () => ok(s));
  });
}
async function abrir(browser, base, fila, hoy) {
  const ctx = await browser.newContext(), cap = { guardados: [] };
  await ctx.addInitScript(() => { sessionStorage.setItem('usuario_activo', JSON.stringify({ nombre: 'Analista Prueba', email: 'analista@example.invalid', esMaster: true, rol: 'master', rolLabel: 'Master' })); });
  await ctx.route('**/*', async (route) => {
    const req = route.request(), url = new URL(req.url());
    if (url.hostname === '127.0.0.1') {
      if (/\/(auth|notifications)\.js$/.test(url.pathname)) return route.fulfill({ contentType: 'text/javascript', body: '' });
      if (/\/supabase\.js$/.test(url.pathname)) return route.fulfill({ contentType: 'text/javascript', body: SUPABASE_STUB });
      return route.continue();
    }
    if (url.hostname === 'sb.stub.invalid') {
      const p = url.pathname.replace('/rest/v1/', ''), json = (b) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(b) });
      if (p === 'clientes') return json([CLIENTE]);
      if (p === 'rpc/remanente_anterior') return json({ estado: 'SIN_DATO', motivo: 'SIN_MES_ANTERIOR', periodo: '2026-10', periodo_anterior: '2026-09' });
      if (p === 'rpc/sii_preiva_periodo') return json(RAW);
      if (p === 'preiva_historial') {
        if (req.method() === 'GET') return json(url.searchParams.has('periodo') ? (fila ? [fila] : []) : HIST);
        const cuerpo = JSON.parse(req.postData() || '{}'); cap.guardados.push({ metodo: req.method(), cuerpo });
        return json([Object.assign({ cliente_rut: CLIENTE.rut, periodo: '2026-10', fecha_envio: null }, cuerpo)]);
      }
      return json([]);
    }
    return route.abort();
  });
  const page = await ctx.newPage();
  page.on('dialog', (d) => d.accept());
  await page.clock.setFixedTime(hoy || new Date(2026, 9, 31, 12, 0, 0));   // 31-oct: octubre es el MES EN CURSO (proyección ×1)
  await page.goto(base + '/pre-iva/index.html?periodo=2026-10&cliente=1');
  await page.evaluate(() => document.documentElement.classList.remove('auth-pending'));
  await page.waitForFunction(() => { const b = document.getElementById('pio-sii-cartapra'); return b && !b.hidden && document.getElementById('inp-debito').value === '1900000'; }, null, { timeout: 15000 });
  return { ctx, page, cap };
}
const num = (t) => parseInt(String(t || '').replace(/[^0-9]/g, ''), 10) || 0;
const pantalla = async (page) => { await page.waitForTimeout(120); return page.evaluate(() => ({ ppm: document.getElementById('res-ppm').textContent, f29: document.getElementById('res-f29').textContent,
  real: document.getElementById('pio-r-ppm').textContent, chip: document.getElementById('res-ppm-editado').textContent, chipVis: document.getElementById('res-ppm-editado').style.display,
  tasa: document.getElementById('inp-tasa-ppm').value })); };
// Lo que muestra la tarjeta del Reporte Contable con lo guardado (IVA + PPM; Contable suma aparte honorarios e impuesto único)
const contable = (fila) => C.armar({ raw: RAW, remContable: { valor: 0, fuente: 'sin' }, fila, hist: HIST, tieneRrhh: true, iuSii: 0, periodo: '2026-10', hoy: new Date() });
async function editar(page, v) {
  await page.click('#btn-editar-ppm');
  await page.fill('#ed-ppm-tasa', v.tasa || ''); await page.fill('#ed-ppm-monto', v.monto || ''); await page.fill('#ed-ppm-motivo', v.motivo || '');
  await page.click('#btn-ppm-aplicar');
}
const ultimo = async (page, cap) => { await page.evaluate(() => guardarPreiva('borrador')); await page.waitForTimeout(250); return cap.guardados[cap.guardados.length - 1].cuerpo; };
const omitir = !pw ? 'sin playwright-core (defina PW_CORE)' : false;

test('INTEGRACIÓN · Pre-IVA = Reporte Contable; «Editar PPM» del Pre-IVA es simulación (no guarda); lo guardado en Contable se muestra y se conserva', { skip: omitir }, async () => {
  const srv = await servidor(), base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await pw.chromium.launch({ channel: process.env.PW_CHANNEL || 'chrome', headless: true });
  try {
    let { ctx, page, cap } = await abrir(browser, base, null);
    assert.equal(await page.evaluate(() => !document.getElementById('pio-solo-estimado').hidden && document.getElementById('pio-solo-estimado').textContent.trim()),
      'Estimado del mes en curso · la validación del IVA se hace en Contable al cerrar el período.');
    assert.equal(await page.evaluate(() => document.getElementById('pio-periodo-cerrado').hidden), true);
    assert.equal(await page.evaluate(() => /Validar Pre-IVA|pasar al reporte/i.test(document.body.innerText)), false, 'el Pre-IVA no valida ni pasa nada al reporte');
    // 1) Calculado: SII neto 10.000.000 + exento 500.000 × 1,5 % = 157.500; IVA 1.900.000 − 760.000 − 101.000 = 1.039.000
    let s = await pantalla(page), k = contable(null);
    assert.equal(num(s.ppm), 157500); assert.equal(num(s.f29), 1039000 + 157500); assert.equal(s.chipVis, 'none');
    assert.equal(k.calculo.ppm, num(s.ppm)); assert.equal(k.calculo.ivaPagar + k.calculo.ppm, num(s.f29), 'mismo IVA + PPM en Pre-IVA y Reporte Contable');
    // 2) Motivo obligatorio
    await editar(page, { tasa: '1,25', motivo: 'no' });
    assert.match(await page.textContent('#ed-ppm-err'), /motivo/); assert.equal(num((await pantalla(page)).ppm), 157500, 'sin motivo no cambia');
    await page.click('#btn-ppm-cancelar');
    // 3) Editar tasa = simulación: cambia la pantalla, pero NO dispara guardado y lo que se guarda es el PPM calculado (sin ppm_editado)
    const antes = cap.guardados.length;
    await editar(page, { tasa: '1,25', motivo: 'Simulación de otra tasa' });
    s = await pantalla(page);
    assert.equal(num(s.ppm), 131250); assert.equal(num(s.real), 131250, '«Así vamos» también usa el PPM simulado'); assert.equal(num(s.f29), 1039000 + 131250);
    if (process.env.PPM_SHOT) { await page.setViewportSize({ width: 1280, height: 900 }); await page.click('#btn-editar-ppm'); await page.locator('#pio-liq').screenshot({ path: process.env.PPM_SHOT }); await page.click('#btn-ppm-cancelar'); }
    await page.waitForTimeout(1800);
    assert.equal(cap.guardados.length, antes, 'editar el PPM en el Pre-IVA no guarda nada');
    let g = await ultimo(page, cap);
    assert.equal(g.ppm, 157500); assert.equal(g.tasa_ppm, 1.5); assert.equal(g.sii_detalle.ppm_editado, undefined, 'la simulación no queda registrada');
    await page.click('#btn-editar-ppm'); await page.click('#btn-ppm-calculado');
    assert.equal(num((await pantalla(page)).ppm), 157500);
    await ctx.close();
    // 4) PPM editado GUARDADO desde Contable → el Pre-IVA lo muestra; simular otro y guardar conserva el de Contable
    const deContable = { cliente_rut: CLIENTE.rut, periodo: '2026-10', fecha_envio: null, debito_iva: 1900000, credito_iva: 760000, tasa_ppm: 1.25, ppm: 131250,
      sii_detalle: { debito: 1900000, ppm_editado: { tasa: 1.25, monto: null, motivo: 'Nueva tasa informada por el SII', por: 'Analista Prueba', at: '2026-10-30T12:00:00Z', calculado: 157500, tasa_calculada: 1.5 } } };
    ({ ctx, page, cap } = await abrir(browser, base, deContable));
    s = await pantalla(page); assert.equal(s.tasa, '1.5'); assert.equal(num(s.ppm), 131250); assert.notEqual(s.chipVis, 'none');
    assert.match(s.chip, /PPM editado \(calculado: \$157\.500 · tasa 1,5%\) · Motivo: Nueva tasa/);
    k = contable(deContable); assert.equal(k.calculo.ppm, 131250);
    await editar(page, { tasa: '', monto: '100000', motivo: 'Simulación con monto fijo' });
    assert.equal(num((await pantalla(page)).ppm), 100000);
    g = await ultimo(page, cap);
    assert.equal(g.ppm, 131250, 'se guarda el PPM editado de Contable, no la simulación'); assert.equal(g.tasa_ppm, 1.25);
    assert.equal(g.sii_detalle.ppm_editado.motivo, 'Nueva tasa informada por el SII');
    await ctx.close();
    // 5) Período ya cerrado (hoy 19-nov, octubre abierto en el Pre-IVA): aviso + «Validar en Contable →»; no se guarda nada
    ({ ctx, page, cap } = await abrir(browser, base, null, new Date(2026, 10, 19, 12, 0, 0)));
    const c = await page.evaluate(() => ({ vis: !document.getElementById('pio-periodo-cerrado').hidden, txt: document.getElementById('pio-periodo-cerrado').textContent,
      href: document.getElementById('lnk-validar-contable').getAttribute('href'), guardar: document.getElementById('btn-guardar-ahora').hidden, enviar: document.getElementById('btn-enviar').hidden }));
    assert.equal(c.vis, true); assert.match(c.txt, /Octubre 2026 ya cerró: aquí es solo una simulación .* Validar en Contable →/);
    assert.equal(c.href, '../reportes-contable/index.html?periodo=2026-10'); assert.deepEqual([c.guardar, c.enviar], [true, true]);
    await page.fill('#inp-debito', '2000000'); await page.dispatchEvent('#inp-debito', 'input');
    assert.equal(await page.evaluate(() => guardarPreiva('borrador')), null);
    await page.waitForTimeout(1800); assert.equal(cap.guardados.length, 0, 'un período cerrado no se guarda desde el Pre-IVA');
    await ctx.close();
  } finally { await browser.close(); srv.close(); }
});
