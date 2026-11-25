// Bandeja del asistente · plazo de 24 h de WhatsApp y "sin contestar" (25-11). Funciones puras extraídas del archivo real. Datos ficticios.
// Uso: deno run --allow-read pruebas/asistente_ventana24_test.ts
const js = Deno.readTextFileSync(new URL('../asistente/asistente.js', import.meta.url));
const src = js.slice(js.indexOf('/* @ventana-inicio'), js.indexOf('/* @ventana-fin */'));
const f = new Function(src + '; return {ventanaWA, textoRestante, sinContestar};')();
let ok = 0, mal = 0;
const res = (n: string, b: boolean, d: unknown = '') => { if (b) { ok++; console.log('OK  ', n); } else { mal++; console.log('MAL ', n, JSON.stringify(d)); } };
const H = 36e5, base = Date.parse('2026-11-25T12:00:00Z');
const m = (dir: string, h: number) => ({ direccion: dir, created_at: new Date(base - h * H).toISOString() });
let v = f.ventanaWA([m('entrante', 1), m('saliente', 0.5)], base);
res('1 entrante hace 1 h → abierta', v.estado === 'abierta', v);
v = f.ventanaWA([m('entrante', 22)], base);
res('2 entrante hace 22 h → por vencer (quedan 2 h)', v.estado === 'por_vencer' && Math.round(v.restante / H) === 2, v);
v = f.ventanaWA([m('entrante', 25), m('saliente', 1)], base);
res('3 entrante hace 25 h (aunque el equipo escribió después) → cerrada', v.estado === 'cerrada', v);
res('4 sin entrantes → cerrada', f.ventanaWA([m('saliente', 1)], base).estado === 'cerrada');
res('5 toma el ÚLTIMO entrante', f.ventanaWA([m('entrante', 30), m('entrante', 2)], base).estado === 'abierta');
res('6 justo 24 h → cerrada', f.ventanaWA([m('entrante', 24)], base).estado === 'cerrada');
res('7 texto restante 2 h 5 min', f.textoRestante(2 * H + 5 * 6e4) === '2 h 5 min', f.textoRestante(2 * H + 5 * 6e4));
res('8 texto restante 40 min', f.textoRestante(40 * 6e4) === '40 min');
const c = (estado: string, dir: string, extra = {}) => ({ estado, ultimo: { direccion: dir, autor: dir === 'entrante' ? 'persona' : 'humano' }, ...extra });
res('9 humano + último entrante → sin contestar', f.sinContestar(c('humano', 'entrante')));
res('10 esperando_humano + último entrante → sin contestar', f.sinContestar(c('esperando_humano', 'entrante')));
res('11 humano + último saliente → no', !f.sinContestar(c('humano', 'saliente')));
res('12 IA atendiendo → no (la responde la IA)', !f.sinContestar(c('ia', 'entrante')));
res('13 opt-out → no', !f.sinContestar(c('humano', 'entrante', { opt_out: true })));
res('14 sin último → no', !f.sinContestar({ estado: 'humano' }));
console.log(`\n${ok} OK · ${mal} MAL`); if (mal) Deno.exit(1);
