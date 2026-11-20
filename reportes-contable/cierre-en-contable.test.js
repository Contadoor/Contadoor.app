// node --test reportes-contable/cierre-en-contable.test.js  (datos 100 % ficticios, sin red)
// REPORTE-AUTO R3 · regla de flujo de Luciano (19-11):
//   PRE-IVA = mes en curso, solo estimado: NO valida ni pasa al reporte (sin «Revisar y pasar al reporte» ni «Cerrar reporte»).
//   CONTABLE = período contable: se valida el IVA y AHÍ se cierra el reporte («🔒 Cerrar reporte») → MiContadoor + Pagos (F29).
//   El Panel de Control ya no cierra: solo muestra «🔒 Publicado». «Revisar / Validar IVA» de Contable se queda en Contable.
// Las funciones de reportes-contable/index.html se extraen del HTML y se corren en un vm (las REALES, no copias).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const RAIZ = path.join(__dirname, '..');
const leer = (r) => fs.readFileSync(path.join(RAIZ, r), 'utf8');
const HTML = leer('reportes-contable/index.html');
const PRE = leer('pre-iva/index.html');
const PANEL = leer('panel-de-control/index.html');
function extraer(nombre, src = HTML) {
  const i = src.indexOf('function ' + nombre + '(');
  assert.ok(i >= 0, 'no existe ' + nombre);
  let k = src.indexOf('{', i), prof = 0;
  for (; k < src.length; k++) { if (src[k] === '{') prof++; else if (src[k] === '}') { prof--; if (prof === 0) break; } }
  return src.slice(i, k + 1);
}
function entorno(o = {}) {
  const abiertos = [], navegaciones = [], avisos = [];
  const rep = Object.assign({ id: 555, rut: '76000000-0', periodo: '2026-10', estadoContable: 'completado', listoPanelControl: false }, o.rep || {});
  const ctx = {
    console, String, Number, JSON, Object, Array, Promise,
    _periodoActual: '2026-10', _rutAbierto: null, _cierresVigentes: o.cierres || {}, _reportes: [rep],
    getReportes: () => ctx._reportes, setReportes: (r) => { ctx._reportes = r; },
    getClientes: () => [{ id: 9001, rut: '76000000-0', razon: 'Empresa Ficticia SpA' }],
    gIcon: (n) => '[' + n + ']', renderTabla: () => {}, restaurarFilaAbierta: () => {}, cargarObligacionesPeriodo: () => { ctx.obligRecargadas = true; },
    alert: (m) => avisos.push(m),
    location: { set href(v) { navegaciones.push(v); }, assign: (v) => navegaciones.push(v) },
  };
  ctx.window = ctx;
  if (o.modulo !== false) ctx.GestoorCierreReporte = { abrir: (op) => abiertos.push(op), cierresVigentes: () => Promise.resolve(o.cierres || {}) };
  vm.createContext(ctx);
  vm.runInContext(['cierreVigenteDe', 'htmlAccionCierre', 'abrirCierreContable', 'cargarCierresPeriodo'].map((n) => extraer(n)).join('\n'), ctx);
  return { ctx, rep, abiertos, navegaciones, avisos };
}
const C1 = { rut: '76000000-0' };

test('R3 · Pre-IVA: sin «Cerrar reporte», sin «Revisar y pasar al reporte» y sin el módulo reporte-sii.js', () => {
  assert.doesNotMatch(PRE, /Cerrar reporte|pasar al reporte|btn-sii-al-reporte|reporte-sii\.js|PreIvaReporteSii|cierre-reporte\.js|reporte_cerrar|reporte_aplicar_preiva_sii/);
  assert.equal(fs.existsSync(path.join(RAIZ, 'pre-iva/reporte-sii.js')), false, 'el «puente» del Pre-IVA se retiró');
});

test('R3 · Panel de Control: ya no cierra (sin botón ni abrirCierreReporte); solo lee los cierres para «🔒 Publicado»', () => {
  assert.doesNotMatch(PANEL, /onclick="abrirCierreReporte\(\)"|function abrirCierreReporte|GestoorCierreReporte\.abrir|>🔒 Cerrar reporte</);
  assert.doesNotMatch(PANEL, /reporte-sii\.js/);
  assert.match(PANEL, /<script src="\.\.\/reportes-contable\/cierre-reporte\.js"><\/script>/);
  assert.match(PANEL, /GestoorCierreReporte\.cierresVigentes\(perDash\)/);
  assert.match(PANEL, /🔒 Publicado/);
  assert.equal(fs.existsSync(path.join(RAIZ, 'panel-de-control/cierre-reporte.js')), false, 'el módulo se movió a reportes-contable/');
});

test('R3 · Contable: carga el módulo de cierre y muestra «🔒 Cerrar reporte» SOLO con el IVA validado', () => {
  assert.match(HTML, /<script src="cierre-reporte\.js\?v=\d+"><\/script>/);
  let E = entorno();
  const h = E.ctx.htmlAccionCierre(E.rep, C1, true);
  assert.match(h, /🔒 Cerrar reporte/); assert.match(h, /abrirCierreContable\('76000000-0'\)/); assert.match(h, /event\.stopPropagation\(\)/);
  assert.doesNotMatch(h, /Marcar reporte OK/);
  // IVA sin validar → no hay botón de cierre (primero «Validar IVA»)
  assert.equal(E.ctx.htmlAccionCierre(Object.assign({}, E.rep, { estadoContable: 'pendiente' }), C1, true), '');
  assert.equal(E.ctx.htmlAccionCierre(Object.assign({}, E.rep, { estadoContable: null }), C1, false), '');
  // Reporte OK de antes (sin foto) también se puede cerrar aquí
  assert.match(E.ctx.htmlAccionCierre(Object.assign({}, E.rep, { listoPanelControl: true }), C1, false), /🔒 Cerrar reporte/);
  // Cerrado: «🔒 Publicado vN» + «Ver cierre» (ya no ofrece cerrar)
  E = entorno({ cierres: { 555: { version: 2, cerrado_at: '2026-11-20T12:00:00Z' } } });
  const k = E.ctx.htmlAccionCierre(E.rep, C1, false);
  assert.match(k, /🔒 Publicado v2/); assert.match(k, /Ver cierre/); assert.doesNotMatch(k, /🔒 Cerrar reporte/);
  // Sin el módulo cargado: el paso de siempre («Marcar reporte OK»)
  E = entorno({ modulo: false });
  assert.match(E.ctx.htmlAccionCierre(E.rep, C1, true), /Marcar reporte OK/);
});

test('R3 · Contable usa htmlAccionCierre en la fila y en el detalle (reemplaza «Marcar reporte OK»)', () => {
  const r = extraer('renderTabla');
  assert.equal((r.match(/htmlAccionCierre\(rep,c,(true|false)\)/g) || []).length, 2);
  assert.doesNotMatch(r, /marcarListoParaConsolidar/);
  assert.match(extraer('cargarReportesPeriodo'), /cargarCierresPeriodo\(periodo\)/);
});

test('R3 · «🔒 Cerrar reporte» abre el cierre en Contable (sin navegar) y al cerrar marca «Publicado» y recarga la obligación F29', async () => {
  const E = entorno();
  E.ctx.abrirCierreContable('76000000-0');
  assert.equal(E.abiertos.length, 1); assert.equal(E.navegaciones.length, 0);
  assert.equal(E.abiertos[0].reporteId, 555); assert.equal(E.abiertos[0].empresa, 'Empresa Ficticia SpA'); assert.equal(E.abiertos[0].periodoTxt, '2026-10');
  E.abiertos[0].alTerminar('enviado', '2026-11-20T12:00:00Z', 1);
  assert.deepEqual(JSON.parse(JSON.stringify(E.ctx._cierresVigentes)), { 555: { version: 1, cerrado_at: '2026-11-20T12:00:00Z' } });
  assert.equal(E.ctx._reportes[0].listoPanelControl, true); assert.equal(E.ctx.obligRecargadas, true);
  E.abiertos[0].alTerminar('borrador', null);   // el Master reabrió el cierre
  assert.deepEqual(JSON.parse(JSON.stringify(E.ctx._cierresVigentes)), {});
  // Reporte inexistente: avisa y no abre nada
  const F = entorno({ rep: { id: null } }); F.ctx.abrirCierreContable('76000000-0');
  assert.equal(F.abiertos.length, 0); assert.match(F.avisos[0], /No se encontró el reporte/);
  // Cierres del período desde la fuente oficial
  const G = entorno({ cierres: { 555: { version: 3 } } }); G.ctx._cierresVigentes = {};
  G.ctx.cargarCierresPeriodo('2026-10'); await new Promise((r) => setTimeout(r, 0));
  assert.equal(G.ctx._cierresVigentes[555].version, 3);
});

test('R3 · «Revisar / Validar IVA» de Contable se queda en Contable: no navega ni enlaza al Pre-IVA', () => {
  const r = extraer('renderTabla');
  // Los botones de revisar/validar abren el modal de Contable (abrirF29) o el detalle (toggleRow), nunca una URL
  assert.match(r, /abrirF29\(\\''\+c\.rut\+'\\'\)"[^>]*>'\+gIcon\('iva'\)\+' Revisar \/ Validar IVA<\/button>/);
  assert.doesNotMatch(r, /' Pre-IVA<\/button>/, 'ningún botón de Contable se llama «Pre-IVA»');
  for (const fn of ['renderTabla', 'abrirF29', 'abrirCierreContable', 'htmlAccionCierre']) {
    assert.doesNotMatch(extraer(fn), /pre-iva\/|location\.href|location\.assign|window\.open/, fn + ' no navega');
  }
  // Ningún enlace a la pantalla del Pre-IVA en el módulo Contable (los <script> compartidos de pre-iva/ sí se cargan)
  const sinScripts = HTML.replace(/<script src="\.\.\/pre-iva\/[^"]+"><\/script>/g, '');
  assert.doesNotMatch(sinScripts, /pre-iva\/index\.html|href="\.\.\/pre-iva/);
  const CF = leer('reportes-contable/calculo-f29.js');
  assert.doesNotMatch(CF, /pre-iva\/index\.html|\.href\s*=|Revisar y validar en Pre-IVA/);
  assert.equal(require('./calculo-f29.js').urlPreIva, undefined);
});
