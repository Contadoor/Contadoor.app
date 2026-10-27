// Cotizaciones K1 · pruebas estáticas del frontend (sin red ni datos).  deno run -A pruebas/cotizaciones_k1_test.ts
// Opcional: BACKEND=<ruta a gestoor-backend con la rama sql/cotizaciones-k1> para cruzar las RPC con la migración.
const R = (f: string) => Deno.readTextFileSync(new URL('../' + f, import.meta.url));
let ok = 0, mal = 0;
const res = (n: string, b: boolean, d: unknown = '') => { if (b) { ok++; console.log('OK  ', n); } else { mal++; console.log('MAL ', n, d); } };
const cot = R('cotizaciones/cot.js'), demo = R('cotizaciones/cot-demo.js'), html = R('cotizaciones/index.html'), menu = R('assets/gestoor-menu.js'), auth = R('auth.js');
const te = R('trabajos-especiales/te.js'), cli = R('clientes/index.html');

res('1 menú Comercial: "Cotizaciones" activo (carpeta cotizaciones), Trabajos especiales sigue en Gestión interna',
  menu.includes("['lista','Cotizaciones','cotizaciones']") && menu.includes("['maletin','Trabajos especiales','trabajos-especiales']"));
res('2 auth.js: módulo cotizaciones decidido por el servidor (cot_yo → puede_leer)', auth.includes("cotizaciones:'cot_yo'") && auth.includes("return 'cotizaciones'") && auth.includes("!path.includes('/cotizaciones/')"));
res('3 página estándar: auth-pending + guardia, supabase.js antes del módulo, auth.js al final', html.includes('class="auth-pending"') && html.includes('gestoor-auth-guard')
  && html.indexOf('src="../supabase.js"') < html.indexOf('src="cot.js"') && html.lastIndexOf('auth.js') > html.indexOf('src="cot.js"'));
res('4 demo solo en localhost (3 candados)', html.includes("h==='localhost'") && demo.includes("h==='localhost'") && cot.includes('G.LOCAL&&!!window.COT_DEMO_API'));
res('5 sin clave anon ni sbH propio en el módulo', !/SB_KEY|sbH\s*\(|apikey/i.test(cot));
const rpcs = [...new Set([...cot.matchAll(/'(cot_[a-z_]+)'/g)].map((m) => m[1]))].sort();
res('6 la pantalla usa solo RPC cot_* (' + rpcs.length + ')', rpcs.length >= 12 && rpcs.every((r) => r.startsWith('cot_')), rpcs);
const be = Deno.env.get('BACKEND');
if (be) {
  const mig = Deno.readTextFileSync(be + '/supabase/migrations/202610271500_cotizaciones_k1.sql');
  const falta = rpcs.filter((r) => !new RegExp('CREATE FUNCTION public\\.' + r + '\\(').test(mig) || !new RegExp('public\\.' + r + '\\([^)]*\\)[^;]*TO authenticated|GRANT EXECUTE ON FUNCTION[\\s\\S]*public\\.' + r + '\\(').test(mig));
  res('7 cada RPC existe en la migración y tiene GRANT a authenticated', falta.length === 0, falta);
}
// El PDF y los textos al cliente: nunca "honorarios" (solo aparece en las advertencias internas que lo prohíben).
const pdf = cot.slice(cot.indexOf('function imprimir'), cot.indexOf('/* ── Eventos'));
res('8 PDF: "Nuestros servicios", exenta, Asesorías Contadoor Ltda., sin "honorarios"', pdf.includes('Nuestros servicios') && pdf.includes('exenta') && pdf.includes('Asesorías Contadoor Ltda.') && !/honorario/i.test(pdf));
res('9 todo lo dinámico del PDF pasa por esc()', !/'\+s\.(codigo|version)\+'/.test(pdf));
res('10 TE: ficha muestra "Origen: cotización" de forma tolerante y "Nueva cotización" lleva a Cotizaciones',
  te.includes('Origen: cotización') && te.includes("select=cotizacion_origen_id').then") && te.includes('../cotizaciones/index.html?nueva=te'));
res('11 Cotización aceptada de TE: botón "Ver trabajo especial"', cot.includes('Ver trabajo especial'));
res('12 Clientes: precarga desde cotización solo con el id en la dirección y sin guardar solo', cli.includes('desde_cotizacion=') && cli.includes("rpc/cot_onboarding_datos") && !/guardarCliente\(\)/.test(cli.slice(cli.indexOf('function precargarDesdeCotizacion'), cli.indexOf('// Detectar cuándo auth.js'))));
res('13 respaldo: bucket "cotizaciones", ruta <id>/respaldo/<archivo>, máx. 10 MB', cot.includes("BUCKET='cotizaciones'") && cot.includes("'/respaldo/'") && cot.includes('10485760'));
console.log(`\nCotizaciones K1 (frontend): ${ok}/${ok + mal}`); if (mal) Deno.exit(1);
