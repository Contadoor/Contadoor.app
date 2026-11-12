// COM-ACC-1 · unión de módulos: el módulo adicional 'comercial' SUMA los del rol Comercial sin quitar los del rol propio.
// Prueba LOCAL sin red: extrae MODULOS_POR_ROL y puedeVerModulo() de auth.js tal cual y los evalúa. Datos ficticios.
// Uso: deno run --allow-read pruebas/com_acc_1_union_test.ts
const src = Deno.readTextFileSync(new URL('../auth.js', import.meta.url));
const ini = src.indexOf('  var MODULOS_POR_ROL={'), fin = src.indexOf('  // ── NAV1-R3');
if (ini < 0 || fin < 0) throw new Error('No se encontró el bloque de permisos en auth.js');
const bloque = src.slice(ini, fin).replace(/\n  var RPC_ACCESO_SERVIDOR=[^\n]*\n/, '\n');
const { puedeVerModulo, MODULOS_POR_ROL } = new Function(bloque + '\nreturn { puedeVerModulo: puedeVerModulo, MODULOS_POR_ROL: MODULOS_POR_ROL };')();
let total = 0, fallas = 0;
const res = (n: string, ok: boolean) => { total++; if (!ok) fallas++; console.log((ok ? 'OK   ' : 'MAL  ') + n); };
const p = (rol: string, modulos: string[]) => ({ rol, modulos, es_master: false });
const TODOS = ['dashboard', 'clientes', 'convenios', 'prospectos', 'asistente', 'cotizaciones', 'pagos', 'conciliacion', 'reportes-pagos', 'panel-de-control',
  'facturacion', 'cobranza', 'trabajos_especiales', 'planes', 'reportes-contable', 'reportes-rrhh', 'pir', 'pre-iva', 'admin'];
const ve = (pf: any) => TODOS.filter((m) => puedeVerModulo(pf, m));
// 1. Tesorería sin la marca: igual que hoy (sin asistente ni cotizaciones)
const sin = ve(p('pagos', ['planes']));
res('pagos sin comercial: NO ve asistente ni cotizaciones', !sin.includes('asistente') && !sin.includes('cotizaciones'));
res('pagos sin comercial: ve prospectos (ya lo tenía por rol)', sin.includes('prospectos'));
// 2. Tesorería con la marca: unión
const con = ve(p('pagos', ['planes', 'comercial']));
res('pagos + comercial: gana asistente (bandeja WhatsApp) y cotizaciones', con.includes('asistente') && con.includes('cotizaciones'));
res('pagos + comercial: conserva TODO lo de pagos (pagos, conciliación, reportes-pagos, facturación, cobranza, trabajos especiales, panel, planes)',
  ['pagos', 'conciliacion', 'reportes-pagos', 'facturacion', 'cobranza', 'trabajos_especiales', 'panel-de-control', 'planes'].every((m) => con.includes(m)));
res('pagos + comercial: es exactamente lo de antes + asistente + cotizaciones', JSON.stringify(con.filter((m) => !sin.includes(m)).sort()) === JSON.stringify(['asistente', 'cotizaciones']) && sin.every((m) => con.includes(m)));
res('pagos + comercial: NO gana admin ni reportes contables/RRHH', !con.includes('admin') && !con.includes('reportes-contable') && !con.includes('reportes-rrhh'));
// 3. Comercial puro: igual que antes
const com = ve(p('comercial', []));
res('comercial puro: ve prospectos, asistente, cotizaciones, clientes, convenios', ['prospectos', 'asistente', 'cotizaciones', 'clientes', 'convenios'].every((m) => com.includes(m)));
res('comercial puro: NO ve pagos ni conciliación', !com.includes('pagos') && !com.includes('conciliacion'));
// 4. Otros roles con la marca explícita
const cont = ve(p('contable', ['comercial']));
res('contable + comercial: suma prospectos/asistente/cotizaciones y conserva reportes-contable', ['prospectos', 'asistente', 'cotizaciones', 'reportes-contable'].every((m) => cont.includes(m)));
res('contable + comercial: NO gana pagos ni conciliación', !cont.includes('pagos') && !cont.includes('conciliacion'));
res('rrhh sin comercial: sin asistente ni cotizaciones', !ve(p('rrhh', [])).includes('asistente') && !ve(p('rrhh', [])).includes('cotizaciones'));
// 5. No muta el catálogo del rol (la unión no ensucia MODULOS_POR_ROL.pagos)
res('MODULOS_POR_ROL.pagos no cambió tras evaluar', !MODULOS_POR_ROL.pagos.includes('asistente'));
res('rol comercial trae "comercial" de base (Admin no muestra la casilla redundante)', MODULOS_POR_ROL.comercial.includes('comercial'));
// 6. Master y modulos vacíos
res('master ve todo', ve({ rol: 'master', modulos: [], es_master: true }).length === TODOS.length);
res('perfil sin modulos (null) no rompe', ve({ rol: 'pagos', modulos: null }).includes('pagos'));
console.log(`\nCOM-ACC-1 unión: ${total - fallas}/${total}`);
Deno.exit(fallas ? 1 : 0);
