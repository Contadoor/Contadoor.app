// 24-11 · Lectura del Libro de Remuneraciones (Mas Remuneraciones) POR NOMBRE DE COLUMNA: formato DETALLE (columnas variables,
// todos los trabajadores en una sola fila) y COMPACTO (18 columnas). Datos 100 % ficticios, generados aquí.
// Uso: deno run --allow-read --allow-env --allow-sys --allow-net=registry.npmjs.org pruebas/rrhh_libro_test.ts
import { JSDOM } from 'npm:jsdom@24.1.0';
const html = Deno.readTextFileSync(new URL('../reportes-rrhh/index.html', import.meta.url));
const fn = (n: string) => { const i = html.indexOf('function ' + n + '('); let d = 0, j = html.indexOf('{', i); for (; j < html.length; j++) { if (html[j] === '{') d++; else if (html[j] === '}' && --d === 0) break; } return html.slice(i, j + 1); };
const w: any = new JSDOM('<!doctype html><body></body>', { runScripts: 'outside-only' }).window;
w.eval(fn('ff') + '\n' + fn('montoCLP') + '\n' + fn('parsearLibro'));
w.FileReader = class { onload: any; onerror: any; readAsArrayBuffer(f: any) { setTimeout(() => this.onload({ target: { result: f.b.buffer } }), 0); } };
w.TextDecoder = TextDecoder;
let total = 0, fallas = 0; const res = (n: string, ok: boolean, d = '') => { total++; console.log((ok ? 'OK   ' : 'MAL  ') + n + (ok ? '' : ' · ' + d)); if (!ok) fallas++; };
const td = (x: string | number) => `<td>${x}</td>`; const m = (n: number) => n.toLocaleString('es-CL');
const archivo = (cuerpo: string) => ({ b: new TextEncoder().encode(`<html><body><table><tr><td>LIBRO DE REMUNERACIONES 10-2026</td></tr></table><table><tr>${cuerpo}</tr></table></body></html>`) });
// Dos trabajadores ficticios. A: con bono y viático y anticipo. B: sin extras.
const A = { rut: '11111111-1', imp: 801183, bono: 60946, cfam: 0, noimp: 150000, viat: 50000, afp: 90293, sal: 56083, ces: 4807, iu: 0, ant: 100000, sis: 14261, mut: 10175, cese: 19228, cap: 801, exp: 5769, ren: 7211 };
const B = { rut: '22222222-2', imp: 729936, bono: 0, cfam: 13870, noimp: 63870, viat: 0, afp: 81461, sal: 51096, ces: 4380, iu: 1000, ant: 0, sis: 12993, mut: 9270, cese: 17518, cap: 730, exp: 5256, ren: 6569 };
const ap = (x: any) => x.sis + x.mut + x.cese + x.cap + x.exp + x.ren;
const tdesc = (x: any) => x.afp + x.sal + x.ces + x.iu;
const liq = (x: any) => x.imp + x.noimp - tdesc(x) - x.ant;
const ENC_D = ['PERIODO','RUT','APELLIDO PATERNO','APELLIDO MATERNO','NOMBRES','SUELDO BASE','CONTRATO','CENTRO DE COSTO','DÍAS TRABAJADOS','ATRASO','VACACIONES','DÍAS LICENCIA','ISAPRE/FONASA','PLAN','AFP','%AFP','SUELDO MENSUAL','GRATIFICACIÓN','BONO ASISTENCIA','BONO NUEVO INVENTADO','TOTAL IMPONIBLE','C. FAMILIAR','ASIGNACIÓN DE COLACIÓN','ASIGNACIÓN MOVILIZACIÓN','VIATICO','TOTAL NO IMPONIBLE','AFP','APV1','APV2','SALUD','S. CESANTIA','I.U.','TOTAL DESCUENTOS','ANTICIPO','TOTAL O. DESCUENTOS','LIQUIDO A PAGAR','SIS','MUTUAL','S. CESANTIA','CAP. INDIVIDUAL','EXPECTATIVA DE VIDA','RENTABILIDAD PROTEGIDA','TRIBUTABLE'];
const filaD = (x: any) => ['10-2026', x.rut, 'APELLIDO', 'FICTICIO', 'PERSONA', m(500000), 'INDEFINIDO', '', 30, '00:00', 0, 0, 'FONASA', '7 %', 'HABITAT', '11.27 %', m(x.imp - x.bono), 0, m(x.bono), 0, m(x.imp),
  m(x.cfam), m((x.noimp - x.cfam - x.viat) / 2), m((x.noimp - x.cfam - x.viat) / 2), m(x.viat), m(x.noimp), m(x.afp), 0, 0, m(x.sal), m(x.ces), m(x.iu), m(tdesc(x)), m(x.ant), m(x.ant), m(liq(x)),
  m(x.sis), m(x.mut), m(x.cese), m(x.cap), m(x.exp), m(x.ren), m(x.imp - x.afp - x.sal - x.ces)];
const totalesD = ENC_D.map((_, i) => (i === 0 ? '' : '0'));
const ENC_C = ['Rut','Nombre','DT','S.Mensual','Grati','O.Haberes','T.Impo','C.Familiar','NoImpo','T.Haberes','AFP','Salud','Seg.C','Impuestos','O.Desc','T.Desc','Liquido','Aporte'];
const filaC = (x: any) => [x.rut, 'APELLIDO FICTICIO PERSONA', 30, m(x.imp - x.bono), 0, m(x.bono), m(x.imp), m(x.cfam), m(x.noimp - x.cfam), m(x.imp + x.noimp), m(x.afp), m(x.sal), m(x.ces), m(x.iu), m(x.ant), m(tdesc(x) + x.ant), m(liq(x)), m(ap(x))];
const D = await w.parsearLibro(archivo([...ENC_D, ...filaD(A), ...filaD(B), ...totalesD].map(td).join('')));
const C = await w.parsearLibro(archivo([...ENC_C, ...filaC(A), ...filaC(B), '', ...ENC_C.slice(1).map(() => '999')].map(td).join('')));
res('detalle: 2 trabajadores (todo en una fila; la fila de totales no cuenta) y período del título', D.nTrab === 2 && D.periodo === '10-2026' && D.formato === 'detalle');
res('compacto: 2 trabajadores (la fila de totales no cuenta)', C.nTrab === 2 && C.formato === 'compacto');
for (const k of ['totalImponible', 'totalNoImponible', 'dctoAfp', 'dctoSalud', 'cesTrab', 'iu', 'totalDescuentos', 'otrosDescuentos', 'liquidoPagar', 'totalAportesPatronales', 'totalCotizaciones', 'costoLaboral'])
  res(`detalle = compacto: ${k}`, D[k] === C[k], `${D[k]} vs ${C[k]}`);
res('valores esperados: líquido, cotizaciones y aportes', D.liquidoPagar === liq(A) + liq(B) && D.totalAportesPatronales === ap(A) + ap(B) && D.totalCotizaciones === A.afp + B.afp + A.sal + B.sal + A.ces + B.ces + ap(A) + ap(B));
res('cuadratura OK en ambos (sin alertas)', D.cuadraturaOk && C.cuadraturaOk && !D.alertas.length && !C.alertas.length, JSON.stringify([D.alertas, C.alertas]));
res('detalle: columnas por NOMBRE aunque haya una columna nueva («BONO NUEVO INVENTADO») y AFP repetida', D.trabajadores[0].afpNombre === 'HABITAT' && D.trabajadores[0].dctoAfp === A.afp && D.trabajadores[0].cesTrab === A.ces && D.trabajadores[0].cesEmp === A.cese);
res('detalle: bonos y viático identificados por trabajador', JSON.stringify(D.trabajadores[0].otrosHaberesImponibles) === JSON.stringify([{ nombre: 'BONO ASISTENCIA', monto: A.bono }]) && D.trabajadores[0].otrosHaberesNoImponibles.some((x: any) => x.nombre === 'VIATICO' && x.monto === A.viat));
res('compacto: no imponible incluye la asignación familiar; T.Desc separa los otros descuentos', C.trabajadores[1].totalNoImponible === B.noimp && C.trabajadores[0].totalDescuentos === tdesc(A));
let err = ''; try { await w.parsearLibro(archivo([...ENC_C.filter((x) => x !== 'Aporte'), ...filaC(A).slice(0, 17)].map(td).join(''))); } catch (e) { err = String((e as Error).message); }
res('falta una columna indispensable → se detiene y dice cuál', /Aporte/.test(err), err);
console.log(`${total - fallas}/${total} pruebas OK`); if (fallas) Deno.exit(1);
