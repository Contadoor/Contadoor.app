// REM-ANT-1 · pruebas de las funciones REALES de reportes-contable/index.html (se extraen del HTML y corren en un vm, sin red).
// Ejecutar: node --test reportes-contable/remanente-contable.test.js   (datos 100 % ficticios)
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const HTML = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
function extraer(nombre) {
  const i = HTML.indexOf('function ' + nombre + '(');
  assert.ok(i >= 0, 'no existe ' + nombre);
  let j = HTML.indexOf('{', i), prof = 0, k = j;
  for (; k < HTML.length; k++) { if (HTML[k] === '{') prof++; else if (HTML[k] === '}') { prof--; if (prof === 0) break; } }
  return HTML.slice(i, k + 1);
}

function entorno() {
  const els = {};
  const el = (id) => (els[id] = els[id] || { id, style: {}, textContent: '', value: '', hidden: false });
  const ctx = { window: {}, document: { getElementById: el }, console, _periodoActual: '2026-10' };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'assets', 'remanente-anterior.js'), 'utf8'), ctx);
  vm.runInContext('var _remanentePrev={periodo:null,lecturaOk:false,filas:{}};\n' +
    ['periodoAnterior', 'normalizarRutContable', 'buildBorradorF29', 'infoRemanenteAnterior', 'escRem', 'pintarAvisoRemanente'].map(extraer).join('\n'), ctx);
  return { ctx, els };
}
const LIBROS = { ventas: { estado: 'validado', totalIva: 1900000, totalNeto: 10000000, totalExento: 0 }, compras: { estado: 'validado', totalIva: 900000 } };
const repOct = (extra = {}) => Object.assign({ id: 10, rut: '11.111.111-1', periodo: '2026-10', estadoContable: null, libros: LIBROS, iuSii: 0, preF29Ajustes: {} }, extra);
const CLI = { iva: 'afecto', ppmTasaDefault: 1 };

test('sin reporte de septiembre y sin manual: alerta y bloqueo (antes: 0 en silencio)', () => {
  const { ctx } = entorno();
  ctx._remanentePrev = { periodo: '2026-09', lecturaOk: true, filas: {} };
  const b = ctx.buildBorradorF29(repOct(), CLI, '2026-10');
  assert.equal(b._remanente.fuente, 'falta');
  assert.equal(b._remanente.bloquea, true);
  assert.equal(b.remanenteAnterior, 0);
  assert.match(b._remanente.aviso, /Falta el remanente de septiembre 2026/);
});

test('remanente ingresado a mano: rebaja el IVA y se marca como manual', () => {
  const { ctx } = entorno();
  ctx._remanentePrev = { periodo: '2026-09', lecturaOk: true, filas: {} };
  const b = ctx.buildBorradorF29(repOct({ preF29Ajustes: { remanente_anterior_manual: { monto: 400000, usuario_nombre: 'Analista Ficticia', registrado_at: '2026-10-30T12:00:00Z', motivo: 'F29 sept. código 77' } } }), CLI, '2026-10');
  assert.equal(b._remanente.fuente, 'manual');
  assert.equal(b.remanenteAnterior, 400000);
  assert.equal(b.impuestoDeterminado, 1900000 - 900000 - 400000);
  assert.equal(b._remanente.bloquea, false);
});

test('manual que deja saldo a favor: remanente para el mes siguiente', () => {
  const { ctx } = entorno();
  ctx._remanentePrev = { periodo: '2026-09', lecturaOk: true, filas: {} };
  const b = ctx.buildBorradorF29(repOct({ preF29Ajustes: { remanente_anterior_manual: { monto: 1500000 } } }), CLI, '2026-10');
  assert.equal(b.impuestoDeterminado, 0);
  assert.equal(b.remanenteSiguiente, 500000);
});

test('con reporte de septiembre validado: manda ese remanente (comportamiento de siempre)', () => {
  const { ctx } = entorno();
  ctx._remanentePrev = { periodo: '2026-09', lecturaOk: true, filas: { '11111111-1': { ivaRemanenteSig: 250000, estadoContable: 'completado' } } };
  const b = ctx.buildBorradorF29(repOct(), CLI, '2026-10');
  assert.equal(b._remanente.fuente, 'mes_anterior');
  assert.equal(b.remanenteAnterior, 250000);
});

test('lectura del mes anterior fallida: sin_lectura y bloquea', () => {
  const { ctx } = entorno();
  ctx._remanentePrev = { periodo: '2026-09', lecturaOk: false, filas: {} };
  const b = ctx.buildBorradorF29(repOct(), CLI, '2026-10');
  assert.equal(b._remanente.fuente, 'sin_lectura');
  assert.equal(b._remanente.bloquea, true);
});

test('el mapa cargado de OTRO período no se usa (cambio de período en pantalla)', () => {
  const { ctx } = entorno();
  ctx._remanentePrev = { periodo: '2026-06', lecturaOk: true, filas: { '11111111-1': { ivaRemanenteSig: 999, estadoContable: 'completado' } } };
  const b = ctx.buildBorradorF29(repOct(), CLI, '2026-10');
  assert.equal(b._remanente.fuente, 'sin_lectura');
});

test('modal: falta → aviso rojo y botón "Ingresar"; manual → aviso ámbar y botón "Corregir"; validado → sin aviso ni botón', () => {
  const { ctx, els } = entorno();
  ctx._remanentePrev = { periodo: '2026-09', lecturaOk: true, filas: {} };
  ctx.pintarAvisoRemanente(ctx.buildBorradorF29(repOct(), CLI, '2026-10'));
  assert.equal(els['aviso-remanente-ant'].style.display, 'block');
  assert.equal(els['btn-remanente-manual'].style.display, 'inline-block');
  assert.equal(els['btn-remanente-manual'].textContent, 'Ingresar remanente anterior');
  assert.match(els['aviso-remanente-ant-txt'].textContent, /^⚠️ Falta el remanente de septiembre 2026/);
  assert.equal(els['f-remanente-fuente'].textContent, 'Falta (septiembre 2026)');

  ctx.pintarAvisoRemanente(ctx.buildBorradorF29(repOct({ preF29Ajustes: { remanente_anterior_manual: { monto: 0, usuario_nombre: 'Analista Ficticia' } } }), CLI, '2026-10'));
  assert.equal(els['btn-remanente-manual'].textContent, 'Corregir remanente anterior');
  assert.match(els['aviso-remanente-ant-txt'].textContent, /^✍️ Remanente ingresado a mano por Analista Ficticia/);
  assert.equal(els['f-remanente-fuente'].textContent, 'Ingresado a mano (septiembre 2026)');

  ctx.pintarAvisoRemanente(ctx.buildBorradorF29(repOct({ estadoContable: 'completado', f29: { ivaDebito: 1, ivaCredito: 0 } }), CLI, '2026-10'));
  assert.equal(els['aviso-remanente-ant'].style.display, 'none');
  assert.equal(els['btn-remanente-manual'].style.display, 'none');
});

test('Validar Pre-IVA agrega el aviso a los pendientes cuando falta el remanente (guardarF29)', () => {
  const g = extraer('guardarF29');
  assert.match(g, /borradorCierre\._remanente&&borradorCierre\._remanente\.bloquea\)\{\s*cierre\.pendientes\.push\(borradorCierre\._remanente\.aviso\);\s*cierre\.ok=false;/);
  assert.ok(g.indexOf('_remanente.bloquea') < g.indexOf('if(!cierre.ok)'), 'el bloqueo va antes de cortar el guardado');
});

test('el script de la regla se carga antes que supabase.js', () => {
  assert.ok(HTML.indexOf('../assets/remanente-anterior.js') > 0 && HTML.indexOf('../assets/remanente-anterior.js') < HTML.indexOf('<script src="../supabase.js">'));
});
