// Convenios · el pie es la CUOTA 1 y la última cuota es LIBRE (decisión de Luciano 29-oct) · prueba LOCAL en jsdom con sbFetch simulado
// (no toca Supabase ni producción; datos 100 % ficticios).
// 1) Nuevo con pie: N° de cuotas incluye el pie, total se calcula solo, vista previa 1 · pie / 2… y lo que se guarda (mismo formato de siempre).
// 2) Nuevo sin pie: comportamiento con última libre. 3) Con pie y N° = 1 → no deja guardar.
// 4) Convenio antiguo con pie y pagos: el formulario lo carga con la estructura nueva, bloqueada, y guardar no cambia sus cuotas.
// 5) Numeración en el detalle: pie = 1 y las cuotas regulares corridas en uno; "Cuotas pagadas" cuenta el pie.
// Uso: deno run --allow-read --allow-env --allow-sys --allow-net=registry.npmjs.org pruebas/convenios_pie_cuota1_test.ts
import { JSDOM } from 'npm:jsdom@24.1.0';

const RAIZ = new URL('../', import.meta.url);
const leer = (p: string) => Deno.readTextFileSync(new URL(p, RAIZ));
const espera = (ms = 80) => new Promise((r) => setTimeout(r, ms));
let total = 0, fallas = 0;
const res = (n: string, ok: boolean, det = '') => { total++; console.log((ok ? 'OK   ' : 'MAL  ') + n + (ok || !det ? '' : ' · ' + det)); if (!ok) fallas++; };
type Any = Record<string, any>;

const CLIENTES = [{ rut: '76111111-6', razon: 'Panadería Ficticia SpA', wa: '+56900000000' }];
// Convenio antiguo: pie pagado (sin vencimiento guardado), 4 cuotas regulares, la 1 pagada.
const cuota = (n: number, f: string, m: number, extra: Any = {}) => ({ numero: n, vencimiento: f, monto: m, esUltima: false, estado: 'pendiente', pago: null, contab: null, capital_plan: 200000, interes_plan: m - 200000, ...extra });
const ANTIGUO = { id: 900, version: 3, cliente_rut: '76111111-6', cliente_nombre: 'Panadería Ficticia SpA', tipo: 'TGR', n_convenio: 'C-1', concepto: 'IVA', periodo_deuda: '2025',
  monto_total: 1010000, monto_cuota: 250000, n_cuotas: 4, estado: 'activo', obs: null, analista_responsable: null, deuda_capital: 800000,
  pie: { numero: 0, esPie: true, vencimiento: '', monto: 150000, capital_plan: 0, interes_plan: 150000, estado: 'pagada', pago: { fecha: '2026-06-05', monto: 150000, capital: 0, interes: 150000 }, contab: null },
  cuotas_detalle: [cuota(1, '2026-07-01', 250000, { estado: 'pagada', pago: { fecha: '2026-07-01', monto: 250000, capital: 200000, interes: 50000 } }),
    cuota(2, '2026-08-01', 250000), cuota(3, '2026-09-01', 250000), cuota(4, '2026-10-01', 260000, { esUltima: true })] };

async function pagina() {
  const mock = `<script>
    window._llamadas = [];
    function _r(o, st){ st = st || 200; return Promise.resolve({ ok: st < 400, status: st, json: function(){ return Promise.resolve(o); }, text: function(){ return Promise.resolve(JSON.stringify(o)); } }); }
    function sbFetch(path, op){
      var b = op && op.body ? JSON.parse(op.body) : null;
      window._llamadas.push({ path: path, method: op && op.method || 'GET', body: b });
      if (path.indexOf('convenios?select') === 0) return _r([${JSON.stringify(ANTIGUO)}]);
      if (op && (op.method === 'POST' || op.method === 'PATCH')) return _r([Object.assign({ id: 901 }, b)]);
      return _r([]);
    }
    function getUsuario(){ return { nombre: 'Analista Ficticia', esMaster: true, rol: 'master' }; }
    function gIcon(){ return ''; }   // (del menú del sitio, no se carga en la prueba)
    localStorage.setItem('clientes_bd', ${JSON.stringify(JSON.stringify(CLIENTES))});
  </script>`;
  const html = leer('convenios/index.html')
    .replace(/<script src="\.\.\/supabase\.js"><\/script>/, () => mock)
    .replace(/<script src="https:\/\/cdnjs[^"]*xlsx[^"]*"><\/script>/, '')
    .replace(/<script src="\.\.\/(assets\/gestoor-menu|notifications|assets\/buscador-cliente|auth)\.js"><\/script>/g, '');
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://gestoor.ejemplo.test/convenios/index.html', pretendToBeVisual: true });
  const w = dom.window as unknown as Any;
  w.alert = (m: string) => { (w._alertas ||= []).push(m); };
  w.confirm = () => true;
  await espera(250);
  const $ = (id: string) => w.document.getElementById(id);
  const poner = (id: string, v: string | number) => { const e = $(id); e.value = String(v); e.dispatchEvent(new w.Event('input')); };
  return { w, $, poner, llamadas: () => w._llamadas as { path: string; method: string; body: Any }[] };
}
const llenarBase = (p: Any) => { p.w.abrirModalNuevo(); p.$('f-cliente').value = '76111111-6'; p.$('f-inst').value = 'TGR'; };

// 1 · Nuevo con pie
{
  const p = await pagina();
  llenarBase(p);
  p.poner('f-deuda-capital', 500000); p.poner('f-pie', 100000); p.poner('f-ncuotas', 12); p.poner('f-vcuota', 50000); p.poner('f-ultima', 53210); p.poner('f-fecha-inicio', '2026-11-05');
  res('1.1 el total se calcula solo: pie 100.000 + 10 × 50.000 + última 53.210 = 653.210 (campo de solo lectura)', p.$('f-monto-total').value === '653210' && p.$('f-monto-total').readOnly, p.$('f-monto-total').value);
  res('1.2 la última cuota se escribe (no es de solo lectura) y el aviso indica las cuotas fijas 2 a 11', !p.$('f-ultima').readOnly && p.$('cuota-hint').textContent.includes('Cuotas 2 a 11'), p.$('cuota-hint').textContent);
  const filas = [...p.$('preview-cuotas').querySelectorAll('tbody tr')].map((tr: Any) => [...tr.children].map((td: Any) => td.textContent));
  res('1.3 vista previa: fila 1 = pie (vence 2026-11-05, $100.000) y fila 2 = cuota fija (vence 2026-12-05)', filas[0]?.[0] === '1 · pie' && filas[0]?.[1] === '2026-11-05' && filas[0]?.[2].includes('100.000')
    && filas[1]?.[0] === '2' && filas[1]?.[1] === '2026-12-05', JSON.stringify(filas.slice(0, 2)));
  p.w.guardarConvenio(); await espera(150);
  const post = p.llamadas().find((x) => x.method === 'POST');
  const b = post?.body || {};
  const cs = b.cuotas_detalle || [];
  res('1.4 se guarda en el formato de siempre: 11 cuotas regulares numeradas 1..11 y monto_total = suma de esas cuotas (553.210)', b.n_cuotas === 11 && cs.length === 11 && cs[0].numero === 1 && cs[10].numero === 11
    && b.monto_total === 553210, JSON.stringify({ n: b.n_cuotas, len: cs.length, mt: b.monto_total }));
  res('1.5 la última (53.210) queda marcada como última; el pie va aparte con su vencimiento = cuota 1 (2026-11-05)', cs[10]?.monto === 53210 && cs[10]?.esUltima === true && b.pie?.esPie === true
    && b.pie?.monto === 100000 && b.pie?.vencimiento === '2026-11-05' && cs[0]?.vencimiento === '2026-12-05', JSON.stringify({ u: cs[10], pie: b.pie }));
  res('1.6 el plan de capital e intereses sigue cuadrando (Σ capital = deuda; pie a intereses)', Math.round(cs.reduce((a: number, c: Any) => a + c.capital_plan, 0) + (b.pie?.capital_plan || 0)) === 500000 && b.pie?.interes_plan === 100000);
}
// 2 · Nuevo sin pie
{
  const p = await pagina();
  llenarBase(p);
  p.poner('f-deuda-capital', 5000); p.poner('f-ncuotas', 6); p.poner('f-vcuota', 1000); p.poner('f-ultima', 1500); p.poner('f-fecha-inicio', '2026-11-01');
  res('2.1 sin pie: 6 cuotas regulares (1 a 5 fijas), total 6.500', p.$('f-monto-total').value === '6500' && p.$('cuota-hint').textContent.includes('Cuotas 1 a 5'), p.$('f-monto-total').value + ' ' + p.$('cuota-hint').textContent);
  p.w.guardarConvenio(); await espera(150);
  const b = p.llamadas().find((x) => x.method === 'POST')?.body || {};
  res('2.2 guarda 6 cuotas, la primera vence 2026-11-01 y sin pie', b.n_cuotas === 6 && b.cuotas_detalle?.[0]?.vencimiento === '2026-11-01' && b.cuotas_detalle?.[5]?.monto === 1500 && !b.pie, JSON.stringify({ n: b.n_cuotas, pie: b.pie }));
}
// 3 · Con pie y N° = 1
{
  const p = await pagina();
  llenarBase(p);
  p.poner('f-deuda-capital', 5000); p.poner('f-pie', 1000); p.poner('f-ncuotas', 1); p.poner('f-ultima', 5000); p.poner('f-fecha-inicio', '2026-11-01');
  p.w.guardarConvenio(); await espera(100);
  res('3.1 con pie y 1 cuota avisa "debe ser 2 o más" y no guarda nada', p.$('ultima-hint').textContent.includes('2 o más') && !p.llamadas().some((x) => x.method === 'POST')
    && (p.w._alertas || []).some((m: string) => m.includes('Completa los datos de cuotas')), p.$('ultima-hint').textContent);
}
// 4 · Convenio antiguo con pie y pagos
{
  const p = await pagina();
  p.w.abrirModalEditar(900);
  res('4.1 al editar: N° de cuotas = 5 (pie + 4), vencimiento cuota 1 = un mes antes de la primera regular (2026-06-01), total 1.160.000', p.$('f-ncuotas').value === '5'
    && p.$('f-fecha-inicio').value === '2026-06-01' && p.$('f-monto-total').value === '1160000', [p.$('f-ncuotas').value, p.$('f-fecha-inicio').value, p.$('f-monto-total').value].join(' '));
  res('4.2 tiene pagos: estructura bloqueada, incluida la última cuota', ['f-pie', 'f-ncuotas', 'f-vcuota', 'f-ultima', 'f-fecha-inicio'].every((id) => p.$(id).disabled));
  p.$('f-obs').value = 'nota ficticia';
  p.w.guardarConvenio(); await espera(150);
  const pa = p.llamadas().find((x) => x.method === 'PATCH');
  res('4.3 guardar una nota no muestra el aviso de estructura y conserva cuotas y pie tal cual', !!pa && !(p.w._alertas || []).length
    && JSON.stringify(pa.body.cuotas_detalle) === JSON.stringify(ANTIGUO.cuotas_detalle) && JSON.stringify(pa.body.pie) === JSON.stringify(ANTIGUO.pie) && pa.body.n_cuotas === 4, JSON.stringify(p.w._alertas || []));
}
// 5 · Numeración en el detalle
{
  const p = await pagina();
  p.w.verAmortizacion(900);
  const c = p.$('amortContent');
  const nros = [...c.querySelectorAll('tbody tr')].map((tr: Any) => tr.children[0]?.textContent);
  res('5.1 tabla: 1 · pie, 2, 3, 4, 5 ★ (las regulares corridas en uno)', JSON.stringify(nros.slice(0, 5)) === JSON.stringify(['1 · pie', '2', '3', '4', '5 ★']), JSON.stringify(nros));
  // "Cuotas pagadas" solo aparece en convenios sin plan de capital (los antiguos sin capital_plan por cuota).
  const sinPlan = p.w.getConvenios()[0]; sinPlan.cuotas.forEach((q: Any) => { delete q.capital_plan; delete q.interes_plan; });
  p.w.verAmortizacion(900);
  res('5.2 convenio sin plan: "Cuotas pagadas" cuenta el pie como cuota 1: 2/5', p.$('amortContent').textContent.includes('2/5Cuotas pagadas'), p.$('amortContent').textContent.slice(0, 300));
  p.w.abrirPagarCuota(900, 1);
  res('5.3 al pagar la cuota regular n°2 se rotula "Cuota 3/5"', p.$('cuotaSub').textContent.includes('Cuota 3/5'), p.$('cuotaSub').textContent);
}

console.log(`\n${total - fallas}/${total} OK`);
Deno.exit(fallas ? 1 : 0);
