// Pruebas del núcleo de la carga masiva de claves (ronda 2). Datos y claves FICTICIOS; sin red ni Supabase.
// Ejecutar: node --test admin/carga-claves.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const N = require('./carga-claves-nucleo.js');
const XLSX = require('./vendor/xlsx-0.20.3.mini.min.js');

const CARTERA = { 10: { id: 10, rut: '76086428-5', razon_social: 'Ficticia Uno', tipos: [] }, 11: { id: 11, rut: '77166269-2', razon_social: 'Ficticia Dos', tipos: ['sii'] } };
// Encabezados exactos de la plantilla.
function cabecera() {
  const cab = [N.COL.id, N.COL.rut, N.COL.razon];
  N.TIPOS.forEach((x) => { cab.push(N.colTiene(x)); if (x.u) cab.push(N.colUsuario(x)); cab.push(N.colClave(x)); });
  return cab;
}
// Arma un .xlsx REAL con SheetJS 0.20.3 (como la plantilla: celdas de clave en formato texto) y lo vuelve a leer como la página.
function libroReal(filas) {
  const cab = cabecera();
  const ws = XLSX.utils.aoa_to_sheet([cab, ...filas.map((f) => cab.map((h) => (h in f ? f[h] : '')))]);
  filas.forEach((f, i) => cab.forEach((h, c) => { if (typeof f[h] === 'string' && / · (clave|usuario|RUT de acceso)$/.test(h)) ws[XLSX.utils.encode_cell({ r: i + 1, c })] = { t: 's', v: f[h], z: '@' }; }));
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, N.HOJA);
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', compression: true });
  const leido = XLSX.read(buf, { type: 'buffer', cellFormula: false, cellHTML: false, cellStyles: false, cellDates: false, cellText: false });
  return N.hojaAMatriz(XLSX, leido.Sheets[N.HOJA]);
}

test('SheetJS vendorizado = 0.20.3 (corrige CVE-2023-30533 ≥0.19.3 y CVE-2024-22363 ≥0.20.2); hash y SRI del HTML coinciden', () => {
  assert.equal(XLSX.version, '0.20.3');
  const bytes = fs.readFileSync(path.join(__dirname, 'vendor/xlsx-0.20.3.mini.min.js'));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), '0cb353f830d7288385492c83d277b058ddeac664ca51cf1393aa1fd3e2b70939');
  const sri = 'sha384-' + crypto.createHash('sha384').update(bytes).digest('base64');
  const html = fs.readFileSync(path.join(__dirname, 'carga-claves.html'), 'utf8');
  assert.ok(html.includes(`src="vendor/xlsx-0.20.3.mini.min.js" integrity="${sri}"`));
  assert.ok(!/0\.18\.5|cdnjs\.cloudflare\.com/.test(html), 'no debe quedar 0.18.5 ni cdnjs');
});

test('La clave se conserva EXACTA desde un .xlsx real: espacios al inicio y al final, tabulación interna y solo-espacios', () => {
  const m = libroReal([{ id: 10, RUT: '76086428-5', 'SII · RUT de acceso': ' 76.086.428-5 ', 'SII · clave': '  Clave  Ficticia  ', 'Banco · clave': '   ', 'Tesorería (TGR) · clave': 'a\tb ' }]);
  const r = N.validar(m, CARTERA);
  assert.equal(r.error, undefined);
  const t = Object.fromEntries(r.filas[0].tipos.map((x) => [x.t, x]));
  assert.equal(t.sii.clave, '  Clave  Ficticia  ');
  assert.equal(t.sii.usuario, '76086428-5');               // el usuario (no secreto) sí se normaliza
  assert.equal(t.banco.clave, '   ');
  assert.equal(t.tgr.clave, 'a\tb ');
  N.decidir(r.filas, false);
  const g = N.armarLotes(r.filas, false);
  assert.equal(g[0][0].claves.sii.clave, '  Clave  Ficticia  ');   // y así viaja a la Edge
});

test('Repro del informe (corregida): " clave ficticia " en Banco ya NO se recorta', () => {
  const cab = cabecera();
  const fila = cab.map((h) => (h === 'id' ? '10' : h === 'RUT' ? '76086428-5' : h === 'Banco · clave' ? ' clave ficticia ' : ''));
  const m = [cab, fila].map((f) => f.map((v) => (v === '' ? null : { t: 's', v })));
  const r = N.validar(m, CARTERA);
  assert.equal(r.filas[0].tipos[0].clave, ' clave ficticia ');
});

test('Celda de clave NO texto (número, fecha, booleano) → clave_no_texto; celda vacía o sin celda → no tocar', () => {
  const cab = cabecera().map((v) => ({ t: 's', v }));
  const i = (h) => cabecera().indexOf(h);
  const fila = Array(cab.length).fill(null);
  fila[i('id')] = { t: 'n', v: 10 }; fila[i('RUT')] = { t: 's', v: '76086428-5' };
  fila[i('Banco · clave')] = { t: 'n', v: 123 };
  fila[i('Tesorería (TGR) · clave')] = { t: 'b', v: true };
  fila[i('SII · clave')] = { t: 's', v: '' }; fila[i('SII · RUT de acceso')] = null;   // vacía = no tocar
  const r = N.validar([cab, fila], CARTERA);
  assert.deepEqual(r.filas[0].tipos.map((x) => `${x.t}:${x.motivo}`), ['tgr:clave_no_texto', 'banco:clave_no_texto']);
});

test('Validaciones de fila: RUT que no calza, id fuera de la cartera activa, duplicado, falta usuario, usuario que no aplica', () => {
  const m = libroReal([
    { id: 10, RUT: '77166269-2', 'Banco · clave': 'x' },
    { id: 99, RUT: '76086428-5', 'Banco · clave': 'x' },
    { id: 11, RUT: '77166269-2', 'Previred · clave': 'p', 'Banco · clave': 'b' },
    { id: 11, RUT: '77166269-2', 'Banco · clave': 'b' },
  ]);
  const r = N.validar(m, CARTERA);
  assert.deepEqual(r.filas.map((f) => f.error), ['rut_no_calza', 'cliente_no_activo', 'fila_duplicada', 'fila_duplicada']);
  assert.equal(r.filas[2].tipos.find((x) => x.t === 'previred').motivo, 'usuario_requerido');
});

test('Reemplazar: sin marcar, el tipo que ya existe queda "sin cambio" y no viaja; marcado, viaja como reemplazo', () => {
  const m = libroReal([{ id: 11, RUT: '77166269-2', 'SII · RUT de acceso': '77166269-2', 'SII · clave': 's', 'Banco · clave': 'b' }]);
  const plan = N.validar(m, CARTERA).filas;
  assert.deepEqual(N.decidir(plan, false), { carga: 1, reemplazo: 0, igual: 1, error: 0, clientes: 1 });
  assert.deepEqual(Object.keys(N.armarLotes(plan, false)[0][0].claves), ['banco']);
  assert.deepEqual(N.decidir(plan, true), { carga: 1, reemplazo: 1, igual: 0, error: 0, clientes: 1 });
  assert.deepEqual(Object.keys(N.armarLotes(plan, true)[0][0].claves).sort(), ['banco', 'sii']);
});

// Plan "en el máximo": 50 clientes × 7 tipos × 1.000 caracteres (caso del informe: 364.281 bytes en un solo lote).
function planMaximo(n, largo, car) {
  return Array.from({ length: n }, (_, i) => ({ fila: i + 2, clienteId: i + 1, rut: '76086428-5', error: null, cambia: true,
    tipos: N.TIPOS.map((x) => ({ t: x.t, accion: 'carga', clave: (car || 'x').repeat(largo), usuario: x.u === 'rut' ? '76086428-5' : x.u ? 'u' : null })) }));
}
const bytesCuerpo = (g, reemplazar = false) => Buffer.byteLength(JSON.stringify({ accion: 'cargar', reemplazar, filas: g }));

test('Lotes: el caso del informe (50 × 7 × 1.000) ya no sale en un solo lote > 262.144; se divide sin perder ni repetir filas', () => {
  const plan = planMaximo(50, 1000);
  const grupos = N.armarLotes(plan, false);
  assert.ok(grupos.length >= 2, 'debe dividirse');
  for (const g of grupos) { assert.ok(g.length <= 50); assert.ok(bytesCuerpo(g) <= 200000, 'lote de ' + bytesCuerpo(g)); assert.ok(bytesCuerpo(g) < 262144); }
  assert.deepEqual(grupos.flat().map((f) => f.clienteId), plan.map((f) => f.clienteId));
  // El cálculo incremental coincide con el tamaño real del JSON enviado.
  const todo = bytesCuerpo(plan.map((f) => grupos.flat().find((x) => x.clienteId === f.clienteId)));
  assert.ok(todo > 262144);
});

test('Lotes: caracteres multibyte (UTF-8 de 3 bytes) y escapes JSON también respetan el límite en BYTES', () => {
  for (const car of ['€', '"', '\u0001']) {
    const grupos = N.armarLotes(planMaximo(50, 1000, car), true);
    for (const g of grupos) assert.ok(bytesCuerpo(g, true) <= 200000, car + ' → ' + bytesCuerpo(g, true));
    assert.equal(grupos.flat().length, 50);
  }
});

test('Lotes: 1.000 filas chicas → grupos de 50 (el límite por filas sigue mandando)', () => {
  const grupos = N.armarLotes(planMaximo(1000, 8), false);
  assert.equal(grupos.length, 20);
  assert.ok(grupos.every((g) => g.length === 50));
});

test('Límite de filas del archivo: más de 1.000 filas → error sin recorrer la hoja', () => {
  const ws = XLSX.utils.aoa_to_sheet([cabecera()]); ws['!ref'] = 'A1:V1002';
  assert.equal(N.hojaAMatriz(XLSX, ws), null);
  assert.match(N.validar(null, CARTERA).error, /más de 1000 filas/);
});

test('carga-claves.js: sin console.*, sin trim sobre claves, usa el núcleo para validar y armar lotes', () => {
  const s = fs.readFileSync(path.join(__dirname, 'carga-claves.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.ok(!/console\./.test(s));
  assert.ok(!/clave[^;\n]*\.trim\(/.test(s));
  assert.ok(s.includes('N.validar(') && s.includes('N.armarLotes(') && s.includes('N.hojaAMatriz('));
  const n = fs.readFileSync(path.join(__dirname, 'carga-claves-nucleo.js'), 'utf8');
  assert.ok(!/s\.clave\.trim|clave\)\.trim|secreto\([^)]*\)\.trim/.test(n));
});
