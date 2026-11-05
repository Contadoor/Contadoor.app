// REM-ANT-2 · pruebas de las funciones REALES de reportes-contable/index.html (se extraen del HTML y corren en un vm, sin red).
// La regla vive en la base (remanente_anterior); aquí se prueba que la pantalla use el cód. 504, muestre 77 y 504, y bloquee sin dato.
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
  let k = HTML.indexOf('{', i), prof = 0;
  for (; k < HTML.length; k++) { if (HTML[k] === '{') prof++; else if (HTML[k] === '}') { prof--; if (prof === 0) break; } }
  return HTML.slice(i, k + 1);
}
function entorno(usuario = { rol: 'contable' }) {
  const els = {};
  const el = (id) => (els[id] = els[id] || { id, style: {}, textContent: '', value: '', hidden: false });
  const ctx = { document: { getElementById: el }, console, _periodoActual: '2026-10', getUsuario: () => usuario };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'assets', 'remanente-anterior.js'), 'utf8'), ctx);
  vm.runInContext('var _remanentes={periodo:null,lecturaOk:false,porRut:{}};\n' +
    ['periodoAnterior', 'normalizarRutContable', 'buildBorradorF29', 'infoRemanenteAnterior', 'escRem', 'remEsMaster', 'pintarAvisoRemanente', 'remMensajeError'].map(extraer).join('\n'), ctx);
  return { ctx, els };
}
const LIBROS = { ventas: { estado: 'validado', totalIva: 1900000, totalNeto: 10000000, totalExento: 0 }, compras: { estado: 'validado', totalIva: 900000 } };
const repOct = (extra = {}) => Object.assign({ id: 10, rut: '11.111.111-1', periodo: '2026-10', estadoContable: null, libros: LIBROS, iuSii: 0 }, extra);
const CLI = { iva: 'afecto', ppmTasaDefault: 1 };
const UTM = { mes_utm_origen: '2026-10', utm_origen: 69000, mes_utm_destino: '2026-11', utm_destino: 69500, periodo: '2026-10', periodo_anterior: '2026-09' };
const cargar = (ctx, info, ok = true) => { ctx._remanentes = { periodo: '2026-10', lecturaOk: ok, porRut: info ? { '11111111-1': info } : {} }; };

test('sin dato (la base dice SIN_DATO): alerta y bloqueo; el 0 es solo marcador', () => {
  const { ctx } = entorno();
  cargar(ctx, Object.assign({ estado: 'SIN_DATO', motivo: 'SIN_MES_ANTERIOR' }, UTM));
  const b = ctx.buildBorradorF29(repOct(), CLI, '2026-10');
  assert.equal(b._remanente.bloquea, true); assert.equal(b.remanenteAnterior, 0);
  assert.match(b._remanente.aviso, /Falta el remanente de septiembre 2026/);
});

test('cód. 77 manual 1.000.000 → el Pre-F29 usa el cód. 504 reajustado (1.007.246)', () => {
  const { ctx } = entorno();
  cargar(ctx, Object.assign({ estado: 'CONOCIDO', fuente: 'F29_MANUAL', cod77: 1000000, cod504: 1007246, manual: { usuario_nombre: 'Analista Ficticia' } }, UTM));
  const b = ctx.buildBorradorF29(repOct(), CLI, '2026-10');
  assert.equal(b.remanenteAnterior, 1007246);
  assert.equal(b.impuestoDeterminado, 1900000 - 900000 - 1007246 < 0 ? 0 : 1900000 - 900000 - 1007246);
  assert.equal(b.remanenteSiguiente, 7246);
  assert.equal(b._remanente.cod77, 1000000);
});

test('cero confirmado: CONOCIDO con 77 = 0 → no bloquea', () => {
  const { ctx } = entorno();
  cargar(ctx, Object.assign({ estado: 'CONOCIDO', fuente: 'F29_MANUAL', cod77: 0, cod504: 0, manual: {} }, UTM));
  const b = ctx.buildBorradorF29(repOct(), CLI, '2026-10');
  assert.equal(b._remanente.bloquea, false); assert.equal(b.remanenteAnterior, 0); assert.equal(b.impuestoDeterminado, 1000000);
});

test('lectura fallida o respuesta de otro período: bloquea (sin_lectura)', () => {
  const { ctx } = entorno();
  cargar(ctx, null, false);
  assert.equal(ctx.buildBorradorF29(repOct(), CLI, '2026-10')._remanente.fuente, 'sin_lectura');
  ctx._remanentes = { periodo: '2026-07', lecturaOk: true, porRut: { '11111111-1': Object.assign({ estado: 'CONOCIDO', fuente: 'MES_ANTERIOR', cod77: 5, cod504: 5 }, UTM) } };
  assert.equal(ctx.buildBorradorF29(repOct(), CLI, '2026-10')._remanente.bloquea, true);
});

test('modal: muestra 77 y 504; falta → botón "Ingresar (cód. 77)"; manual → "Corregir"', () => {
  const { ctx, els } = entorno();
  cargar(ctx, Object.assign({ estado: 'SIN_DATO', motivo: 'SIN_MES_ANTERIOR' }, UTM));
  ctx.pintarAvisoRemanente(ctx.buildBorradorF29(repOct(), CLI, '2026-10'));
  assert.equal(els['aviso-remanente-ant'].style.display, 'block');
  assert.equal(els['btn-remanente-manual'].textContent, 'Ingresar remanente anterior (cód. 77)');
  assert.equal(els['f-remanente-fuente'].textContent, 'Sin confirmar (septiembre 2026)');
  cargar(ctx, Object.assign({ estado: 'CONOCIDO', fuente: 'F29_MANUAL', cod77: 1000000, cod504: 1007246, manual: { usuario_nombre: 'Analista Ficticia' } }, UTM));
  ctx.pintarAvisoRemanente(ctx.buildBorradorF29(repOct(), CLI, '2026-10'));
  assert.equal(els['btn-remanente-manual'].textContent, 'Corregir remanente anterior (cód. 77)');
  assert.equal(els['remanente-ant-detalle'].textContent, 'Cód. 77 de septiembre 2026: $1.000.000 × UTM noviembre 2026 $69.500 ÷ UTM octubre 2026 $69.000 = cód. 504 $1.007.246');
  assert.equal(els['f-remanente-fuente'].textContent, 'Cód. 504 · ingresado a mano');
  assert.match(els['aviso-remanente-ant-txt'].textContent, /^✍️ Remanente ingresado a mano por Analista Ficticia/);
});

test('conflicto: bloquea; solo el Master ve los botones de decisión ("usar mes anterior" solo con el reporte abierto)', () => {
  const conf = Object.assign({ estado: 'CONFLICTO', fuente: 'F29_MANUAL', cod77: 1000000, cod504: 1007246, mes_anterior_cod77: 900000, manual: {} }, UTM);
  let { ctx, els } = entorno({ rol: 'contable' });
  cargar(ctx, conf);
  ctx.pintarAvisoRemanente(ctx.buildBorradorF29(repOct(), CLI, '2026-10'));
  assert.equal(els['btn-rem-mantener'].style.display, 'none'); assert.equal(els['btn-remanente-manual'].style.display, 'none');
  assert.match(els['aviso-remanente-ant-txt'].textContent, /^⚠️ Conflicto/);
  ({ ctx, els } = entorno({ rol: 'master', esMaster: true }));
  cargar(ctx, conf);
  ctx.pintarAvisoRemanente(ctx.buildBorradorF29(repOct(), CLI, '2026-10'));
  assert.equal(els['btn-rem-mantener'].style.display, 'inline-block'); assert.equal(els['btn-rem-usar-ant'].style.display, 'inline-block');
  ctx.pintarAvisoRemanente(ctx.buildBorradorF29(repOct({ estadoContable: 'completado', f29: { ivaDebito: 1, ivaCredito: 0 } }), CLI, '2026-10'));
  assert.equal(els['aviso-remanente-ant'].style.display, 'block', 'el conflicto se ve aunque el período esté validado');
  assert.equal(els['btn-rem-usar-ant'].style.display, 'none');
});

test('errores de la base se traducen (candado del remanente)', () => {
  const { ctx } = entorno();
  assert.match(ctx.remMensajeError('REMANENTE_DESCONOCIDO: el remanente anterior de 2026-10 no está confirmado', 'septiembre 2026'), /no está confirmado: ingrésalo/);
  assert.match(ctx.remMensajeError('SIN_UTM: falta la UTM oficial de 2026-11 (el Master la registra desde sii.cl)'), /^falta la UTM oficial de 2026-11/);
});

test('Validar Pre-IVA y marcar OK: bloqueo previo en pantalla + mensaje de la base si igual se rechaza', () => {
  const g = extraer('guardarF29');
  assert.match(g, /borradorCierre\._remanente&&borradorCierre\._remanente\.bloquea\)\{\s*cierre\.pendientes\.push\(borradorCierre\._remanente\.aviso\);\s*cierre\.ok=false;/);
  assert.match(g, /sbPatchReporteDetallado\(repExistente\.id, patchContable\)/);
  const k = extraer('marcarListoParaConsolidar');
  assert.match(k, /_remOk\.bloquea\)\{ alert\('No se puede marcar OK para el Panel/);
  assert.match(k, /sbPatchReporteDetallado\(rep\.id,\{/);
});

test('la presentación se carga antes que supabase.js y la carga usa la RPC remanentes_anteriores', () => {
  assert.ok(HTML.indexOf('../assets/remanente-anterior.js') < HTML.indexOf('<script src="../supabase.js">'));
  assert.match(extraer('cargarReportesPeriodo'), /rpc\/remanentes_anteriores/);
});

test('REM-ANT-2B: Validar Pre-IVA bloquea débito/crédito con decimales y el error de la base se explica', () => {
  const g = extraer('guardarF29');
  assert.match(g, /nv\('f-debito'\)!==Math\.round\(nv\('f-debito'\)\)\|\|nv\('f-credito'\)!==Math\.round\(nv\('f-credito'\)\)\)\{\s*cierre\.pendientes\.push\('Débito y crédito deben ser pesos enteros/);
  assert.ok(g.indexOf("pesos enteros (sin decimales)") < g.indexOf('if(!cierre.ok)'));
  const { ctx } = entorno();
  assert.match(ctx.remMensajeError('REMANENTE_SIN_VERIFICAR: los montos del F29 de 2026-10 tienen decimales'), /tienen decimales: el F29 es en pesos enteros/);
});
