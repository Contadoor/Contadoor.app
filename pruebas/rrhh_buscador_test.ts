// 24-11 · Buscador del módulo de Remuneraciones: nombre sin tildes/mayúsculas, varias palabras y RUT con o sin puntos. Datos ficticios.
// Uso: deno run --allow-read pruebas/rrhh_buscador_test.ts
const html = Deno.readTextFileSync(new URL('../reportes-rrhh/index.html', import.meta.url));
const fn = (n: string) => { const i = html.indexOf('function ' + n + '('); let d = 0, j = html.indexOf('{', i); for (; j < html.length; j++) { if (html[j] === '{') d++; else if (html[j] === '}' && --d === 0) break; } return html.slice(i, j + 1); };
const f = new Function(fn('_normRrhh') + '\n' + fn('coincideBusquedaRrhh') + '\nreturn coincideBusquedaRrhh;')();
const r = { clienteNombre: 'Panadería El Ñandú SpA', rut: '76.123.456-K', preparado: 'Analista Ficticia' };
let ok = 0, mal = 0; const t = (n: string, c: boolean) => { console.log((c ? 'OK   ' : 'MAL  ') + n); c ? ok++ : mal++; };
t('vacío muestra todo', f(r, '') && f(r, '   '));
t('nombre sin tildes ni mayúsculas', f(r, 'panaderia') && f(r, 'ÑANDU'));
t('varias palabras en cualquier orden', f(r, 'nandu pan'));
t('RUT con puntos, sin puntos y con K', f(r, '76.123.456-k') && f(r, '76123456') && f(r, '456k'));
t('no coincide', !f(r, 'ferreteria') && !f(r, '99999'));
t('números cortos no buscan por RUT', !f(r, '76'));
t('busca por analista', f(r, 'ficticia'));
console.log(`${ok}/${ok + mal} pruebas OK`); if (mal) Deno.exit(1);
