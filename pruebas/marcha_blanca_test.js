// MARCHA-BLANCA (24-11-2026) · pruebas del front sin servidor: node --test pruebas/marcha_blanca_test.js
const test = require('node:test'); const assert = require('node:assert/strict');
const fs = require('fs'); const path = require('path'); const vm = require('vm');
const RAIZ = path.join(__dirname, '..'); const leer = (p) => fs.readFileSync(path.join(RAIZ, p), 'utf8');

test('GestoorEnlace: lee solo ids numéricos y reintenta hasta que la página abre el registro', async () => {
  const ctx = { URLSearchParams, setTimeout, location: { search: '?reporte=123' }, window: {} }; vm.createContext(ctx);
  vm.runInContext(leer('assets/enlace-directo.js'), ctx);
  const E = ctx.window.GestoorEnlace;
  assert.equal(E.leer('reporte'), '123');
  ctx.location.search = '?reporte=12;alert(1)'; assert.equal(E.leer('reporte'), null);
  ctx.location.search = '?reporte=7'; let n = 0, vista = null;
  E.alCargar('reporte', (v) => { n++; if (n < 3) return false; vista = v; return true; });
  await new Promise((r) => setTimeout(r, 1000));
  assert.equal(vista, '7'); assert.equal(n, 3);
  ctx.location.search = ''; assert.equal(E.alCargar('reporte', () => true), false);
});

test('Contable / RR. HH.: el enlace ?reporte resuelve el cliente por el RUT del reporte (nunca r.id como cliente)', () => {
  const c = leer('reportes-contable/index.html'), r = leer('reportes-rrhh/index.html');
  assert.match(c, /GestoorEnlace\.alCargar\('reporte'[\s\S]*?_abrirSolo\(rep\.rut\)/);
  assert.match(r, /GestoorEnlace\.alCargar\('reporte'[\s\S]*?abrirModal\(r\.id\)/);
  assert.match(c, /<script src="\.\.\/assets\/enlace-directo\.js\?v=20261124"><\/script>/);
});

test('RR. HH.: la obligación de cotizaciones la registra la RPC del servidor (sin montos ni fechas desde el navegador)', async () => {
  const html = leer('reportes-rrhh/index.html');
  const a = html.indexOf('var RRHH_OBLIGACION_COTIZ_ACTIVA'), b = html.indexOf('function enviarAprobacionRrhh(');
  const llamadas = [];
  const ctx = { console, Promise, Number, Math, JSON, String,
    sbFetch: (p, o) => { llamadas.push({ p, body: JSON.parse(o.body) }); return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ resultado: 'creada', obligacion_id: 9, monto: 412345, vencimiento: '2026-11-13' }) }); },
    rrhhLeerError: () => Promise.reject(new Error('x')) };
  vm.createContext(ctx); vm.runInContext(html.slice(a, b), ctx);
  const o = await ctx.registrarObligacionCotizRrhh(555);
  assert.equal(llamadas[0].p, 'rpc/reporte_obligacion_cotizaciones'); assert.deepEqual(llamadas[0].body, { p_reporte_id: 555 });
  assert.equal(o.resultado, 'creada'); assert.match(o.mensaje, /Vence el 13-11-2026/);
  ctx.sbFetch = () => Promise.resolve({ ok: false, status: 404 });
  assert.equal((await ctx.registrarObligacionCotizRrhh(555)).resultado, 'pendiente_activacion');
  ctx.sbFetch = () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ resultado: 'pendiente', motivo: 'SIN_TOTAL_COTIZACIONES' }) });
  assert.match((await ctx.registrarObligacionCotizRrhh(555)).mensaje, /no tiene total de cotizaciones/);
  await assert.rejects(ctx.registrarObligacionCotizRrhh('nuevo_1'), /sin ID real/);
});

function domFalso() {
  const els = {}; const el = (id) => (els[id] ||= { id, innerHTML: '', value: '', style: {}, classList: { add() {}, remove() {} }, onclick: null });
  return { els, document: { getElementById: (id) => els[id] || null, createElement: () => ({ classList: { add() {}, remove() {} }, style: {}, set innerHTML(v) { /* modal */ } }),
    body: { appendChild() {} }, querySelector: () => null, readyState: 'complete', addEventListener() {} }, el };
}
test('Panel · Preparar obligaciones: solo Master, simula primero y muestra vencimientos; «Crear» solo si hay algo que crear', () => {
  const d = domFalso(); d.el('obp-res'); d.el('obp-aplicar');
  const ctx = { document: d.document, window: {}, setTimeout: () => {}, getUsuario: () => ({ esMaster: false }) }; vm.createContext(ctx);
  vm.runInContext(leer('panel-de-control/obligaciones-periodo.js'), ctx);
  const P = ctx.window.GestoorObligPeriodo;
  P._pintar({ periodo: '2026-10', aplicado: false, vence_f29: '2026-11-20', vence_cotizaciones: '2026-11-13', cotizaciones: { se_crearia: 3, no_aplica: 83 }, f29: { nace_al_cerrar: 191 },
              detalle: [{ cliente: 'Empresa <b>A</b>', cotizaciones: 'se_crearia', f29: 'nace_al_cerrar' }] });
  const h = d.els['obp-res'].innerHTML;
  assert.match(h, /vence F29 <b>20-11-2026<\/b> · cotizaciones \(Previred\) <b>13-11-2026<\/b>/); assert.match(h, /simulación \(nada escrito\)/);
  assert.match(h, /Se crearían<\/td><td[^>]*>3/); assert.match(h, /Empresa &lt;b&gt;A&lt;\/b&gt;/, 'escapa HTML');
  assert.equal(d.els['obp-aplicar'].style.display, '');
  P._pintar({ periodo: '2026-10', aplicado: true, cotizaciones: { creada: 3 }, f29: {}, detalle: [] });
  assert.equal(d.els['obp-aplicar'].style.display, 'none');
  assert.match(leer('panel-de-control/obligaciones-periodo.js'), /u\.esMaster!==true\)return;/);
  assert.doesNotMatch(leer('panel-de-control/obligaciones-periodo.js'), /monto_|vencimiento:/, 'el navegador no manda montos ni fechas');
});

test('Conciliación y Cartera: el enlace abre el registro (también ingresos ya conciliados; ficha del cliente)', () => {
  const c = leer('conciliacion/index.html'), k = leer('cobranza/cartera.js');
  assert.match(c, /setVista\(mc\.estado==='descartado'\?'desc':'conc'\)/);
  assert.match(k, /cliente=\(\\d\{1,18\}\)/); assert.match(k, /abrirFicha\(m\[1\]\)/);
});
