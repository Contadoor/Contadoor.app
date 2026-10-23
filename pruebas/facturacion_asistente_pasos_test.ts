// Facturación adicional · rediseño 23-oct (+ ajuste PR #84: sin opción Prueba al crear) · asistente "Nueva factura" y confirmación REAL
// Prueba LOCAL con mocks (no toca Supabase ni producción; datos FICTICIOS).
// 1) Función pura palabraRealOk (extraída del archivo real entre @palabra-real-inicio/fin).
// 2) De punta a punta en jsdom: el asistente NO ofrece la opción Prueba (Cliente → Detalle → Revisar) y siempre crea con modo PRODUCCION;
//    la franja roja está en todo el flujo; crear exige escribir REAL; con la emisión desactivada se crea igual pero "Emitir" queda
//    deshabilitado con su motivo; "Ocultar pruebas" (por defecto) esconde el histórico de pruebas cerradas;
//    emitir una REAL exige REAL + total correcto (sin eso no se llama a la Edge).
// Uso: deno run --allow-read --allow-env --allow-sys --allow-net=registry.npmjs.org pruebas/facturacion_asistente_pasos_test.ts
import { JSDOM } from 'npm:jsdom@24.1.0';

const RAIZ = new URL('../', import.meta.url);
const leer = (p: string) => Deno.readTextFileSync(new URL(p, RAIZ));
let ok = 0, mal = 0;
const res = (n: string, b: boolean, d: unknown = '') => { if (b) { ok++; console.log('OK  ', n); } else { mal++; console.log('MAL ', n, JSON.stringify(d)); } };

// ── 1. Función pura ──
const js = leer('facturacion/adicional-real.js');
const src = js.slice(js.indexOf('/* @palabra-real-inicio'), js.indexOf('/* @palabra-real-fin */'));
const fn = new Function(src + '; return palabraRealOk;')() as (t: unknown) => boolean;
const CASOS: [string, unknown, boolean][] = [['REAL', 'REAL', true], ['real (minúsculas)', 'real', true], ['" REAL " (espacios extremos)', ' REAL ', true],
  ['vacío', '', false], ['null', null, false], ['REALES', 'REALES', false], ['RE AL', 'RE AL', false], ['sí', 'sí', false], ['PRUEBA', 'PRUEBA', false]];
for (const [n, t, esp] of CASOS) res(`1 palabra REAL: ${n} → ${esp ? 'válida' : 'rechazada'}`, fn(t) === esp, fn(t));

// ── 2. De punta a punta ──
const fac = (id: number, modo: string, estado: string) => ({ id, codigo: 'FA-2026-' + String(id).padStart(4, '0'), modo, estado, cliente_id: 1, creado_por: 2, motivo: 'Trabajo adicional (ficticio)',
  lineas: [{ glosa: 'Servicio ficticio', cantidad: 1, precio: 10000 }], total: 10000, fecha_emision: '2026-10-23', fecha_vencimiento: '2026-10-23', forma_pago: 1, alertas: [],
  snapshot_hash: estado === 'APROBADA' ? 'a'.repeat(64) : null, snapshot: null, doc_estado: 'PENDIENTE', creado_at: '2026-10-23T10:00:00-03:00' });
function pagina(prod: boolean) {
  const MOCK = `var SB_URL='http://mock';var _gestoorAccessToken='x';window.__llamadas=[];
document.documentElement.classList.remove('auth-pending');
function sbH(){return {'Content-Type':'application/json',Authorization:'Bearer x'};}
function resp(o,st){return Promise.resolve(new Response(JSON.stringify(o),{status:st||200,headers:{'Content-Type':'application/json'}}));}
function sbFetch(path,opts){
  if(path.indexOf('rpc/facturacion_yo')===0)return resp({usuario_id:1,es_master:true,puede_preparar:false,puede_aprobar:true,puede_leer:true});
  if(path.indexOf('rpc/fact_clientes_lista')===0)return resp([{id:1,rut:'11.111.111-1',razon_social:'Cliente Ficticio SpA',estado:'activo'}]);
  if(path.indexOf('rpc/')===0){window.__llamadas.push({fn:path.slice(4),body:JSON.parse(opts&&opts.body||'{}')});return resp({factura_id:99,estado:'BORRADOR'});}
  return resp([]);
}
function sbGet(path){
  if(path.indexOf('facturas_adicionales?')===0)return Promise.resolve([${JSON.stringify(fac(7, 'PRODUCCION', 'APROBADA'))},${JSON.stringify(fac(8, 'PRUEBA', 'APROBADA'))},${JSON.stringify(fac(9, 'PRUEBA', 'EMITIDA'))}]);
  if(path.indexOf('facturacion_parametros')===0)return Promise.resolve([{produccion_habilitada:${prod}}]);
  if(path.indexOf('periodos')===0)return Promise.resolve([{periodo:'2026-10',uf:39000}]);
  return Promise.resolve([]);
}`;
  let html = leer('facturacion/index.html');
  html = html.replace(/<script>if\(!window\.FX_DEMO\)document\.write\([\s\S]*?auth\.js[\s\S]*?<\/script>/, '');
  html = html.replace(/<script>if\(window\.FX_DEMO\)document\.write\([\s\S]*?<\/script>/, '');
  html = html.replace(/<script src="\.\.\/assets\/gestoor-menu\.js"><\/script>/, '');
  html = html.replace('<script src="../supabase.js"></script>', `<script>${MOCK}</script>`);
  for (const f of ['facturacion.js', 'adicional.js', 'adicional-real.js']) html = html.replace(`<script src="${f}"></script>`, () => `<script>${leer('facturacion/' + f)}</script>`);
  return html;
}
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function abrir(prod = true) {
  const dom = new JSDOM(pagina(prod), { runScripts: 'dangerously', url: 'https://gestoor.contadoor.cl/facturacion/index.html?tab=adicional', pretendToBeVisual: true,
    beforeParse(w: any) { w.Response = Response; w.__edge = []; w.fetch = (u: string, o: any) => { w.__edge.push({ u, body: JSON.parse(o && o.body || '{}') }); return Promise.resolve(new Response(JSON.stringify({ estado: 'EMITIDA', folio: '1' }), { status: 200 })); };
      w.HTMLElement.prototype.scrollIntoView = () => {}; } });
  await espera(250);
  return dom;
}
const set = (d: any, el: any, v: string) => { el.value = v; el.dispatchEvent(new d.defaultView.Event('input', { bubbles: true })); };
const paso = (d: any) => d.querySelector('.fa-pasos li.actual')?.textContent || '';
async function hastaRevisar(d: any) {
  d.querySelector('[data-fa="nueva"]').click(); await espera(20);
  d.querySelector('[data-fa-cli="1"]').click(); await espera(20);
  d.getElementById('faWizSig').click(); await espera(20);
  set(d, d.getElementById('faMot'), 'Trabajo adicional solicitado por el cliente (ficticio)');
  const r = d.querySelector('#faLins .fa-lin'); set(d, r.querySelector('.fa-g'), 'Servicio ficticio'); set(d, r.querySelector('.fa-q'), '2'); set(d, r.querySelector('.fa-p'), '15000');
  d.getElementById('faWizSig').click(); await espera(20);
}

// 2a. El asistente no ofrece "Prueba": parte en Cliente, con franja roja desde el inicio
let dom = await abrir(); let w: any = dom.window, d = w.document;
d.querySelector('[data-fa="nueva"]').click(); await espera(20);
const pasosTxt = [...d.querySelectorAll('.fa-pasos li')].map((li: any) => li.textContent.replace(/\s+/g, '').trim());
res('2a el asistente tiene 3 pasos (Cliente → Detalle → Revisar) y parte en Cliente', pasosTxt.join('|') === '1Cliente|2Detalle|3Revisar' && /1\s*Cliente/.test(paso(d)), pasosTxt);
res('2a no existe la opción Prueba al crear (ni tarjetas de tipo ni el texto "Prueba (sin SII)")', d.querySelectorAll('[data-fa-modo]').length === 0 && !/Prueba \(sin SII\)/.test(d.getElementById('vistaAdic').textContent));
res('2a franja roja "FACTURA REAL · se enviará al SII" desde el primer paso; nunca la celeste', d.body.classList.contains('fa-franja-real') && /FACTURA REAL/.test(d.getElementById('faFranja').textContent) && !d.getElementById('faFranja').hidden && !/sin validez tributaria/.test(d.getElementById('faFranja').textContent));
d.getElementById('faWizSig').click(); await espera(20);
res('2a sin elegir cliente no se pasa del paso Cliente', /1\s*Cliente/.test(paso(d)) && /Elige un cliente/.test(d.getElementById('faWizErr').textContent), paso(d));
d.querySelector('[data-vista="FIJO"]').click(); await espera(20);
res('2a al ir al grupo FIJO se quita la franja', !d.body.classList.contains('fa-con-franja'));
dom.window.close();

// 2b. Emisión desactivada: se crea igual (REAL), pero Emitir queda deshabilitado con su motivo
dom = await abrir(false); w = dom.window; d = w.document;
const bEm = d.querySelector('#vistaAdic [data-fa-card="7"] [data-fa="emitir"]');
res('2b emisión desactivada → "Emitir factura real" visible pero deshabilitado con "La emisión está desactivada; pide al Master activarla"', !!bEm && bEm.disabled && /La emisión está desactivada; pide al Master activarla/.test(bEm.closest('.tipw').getAttribute('data-tip')), bEm && bEm.closest('.tipw').getAttribute('data-tip'));
await hastaRevisar(d);
res('2b emisión desactivada → "Nueva factura" igual llega a Revisar y avisa que la emisión está desactivada', /3\s*Revisar/.test(paso(d)) && /emisión está desactivada/.test(d.querySelector('.fa-wiz').textContent), paso(d));
set(d, d.getElementById('faWizReal'), 'REAL'); d.getElementById('faWizCrear').click(); await espera(80);
const cOff = w.__llamadas.filter((x: any) => x.fn === 'factura_adicional_crear');
res('2b emisión desactivada → el borrador se crea con modo PRODUCCION', cOff.length === 1 && cOff[0].body.p.modo === 'PRODUCCION', cOff);
dom.window.close();

// 2c. Crear una REAL exige la palabra REAL
dom = await abrir(); w = dom.window; d = w.document;
await hastaRevisar(d);
res('2c llega al paso 3 (Revisar) con vista previa tipo factura y total en grande', /3\s*Revisar/.test(paso(d)) && /\$30\.000/.test(d.querySelector('.fa-doc-tot').textContent) && !!d.getElementById('faWizReal'), paso(d));
d.getElementById('faWizCrear').click(); await espera(50);
res('2c REAL sin escribir la palabra → no llama a factura_adicional_crear y pide escribir REAL', w.__llamadas.filter((x: any) => x.fn === 'factura_adicional_crear').length === 0 && /escribe la palabra REAL/.test(d.getElementById('faWizErr').textContent), w.__llamadas);
set(d, d.getElementById('faWizReal'), 'SI'); d.getElementById('faWizCrear').click(); await espera(50);
res('2c REAL con otra palabra ("SI") → tampoco llama', w.__llamadas.filter((x: any) => x.fn === 'factura_adicional_crear').length === 0);
set(d, d.getElementById('faWizReal'), 'REAL'); d.getElementById('faWizCrear').click(); await espera(80);
const cr = w.__llamadas.filter((x: any) => x.fn === 'factura_adicional_crear');
res('2c con REAL escrita → llama UNA vez a factura_adicional_crear con modo PRODUCCION, cliente 1, total por líneas y sin campos nuevos', cr.length === 1 && cr[0].body.p.modo === 'PRODUCCION' && cr[0].body.p.cliente_id === 1
  && cr[0].body.p.lineas[0].cantidad === 2 && cr[0].body.p.lineas[0].precio === 15000 && Object.keys(cr[0].body.p).sort().join() === 'cliente_id,fecha_emision,fecha_vencimiento,forma_pago,lineas,modo,motivo', cr);
dom.window.close();

// 2d. Cartera: "Ocultar pruebas" activado por defecto (oculta el histórico cerrado; la prueba en curso se sigue viendo con su chip)
dom = await abrir(); w = dom.window; d = w.document;
const ids = () => [...d.querySelectorAll('#vistaAdic [data-fa-card]')].map((e: any) => e.getAttribute('data-fa-card')).join();
const sw = d.querySelector('[data-fa-ocultar]');
res('2d "Ocultar pruebas" viene activado y esconde la PRUEBA emitida (9); se ven la REAL (7) y la PRUEBA en curso (8)', sw && sw.getAttribute('aria-checked') === 'true' && ids() === '7,8', ids());
res('2d la PRUEBA en curso conserva su chip PRUEBA', /PRUEBA/.test(d.querySelector('#vistaAdic [data-fa-card="8"] .fa-tipo').textContent));
sw.click(); await espera(20);
res('2d al desactivar el filtro aparece el histórico (9) con su chip PRUEBA', ids() === '7,8,9' && /PRUEBA/.test(d.querySelector('#vistaAdic [data-fa-card="9"] .fa-tipo').textContent), ids());
res('2d no hay ningún botón para crear una prueba', ![...d.querySelectorAll('#vistaAdic button, #hero button')].some((b: any) => /crear.*prueba|nueva prueba/i.test(b.textContent)));
dom.window.close();

// 2e. Emitir una REAL exige REAL + total; una PRUEBA, un clic
dom = await abrir(); w = dom.window; d = w.document;
d.querySelector('#vistaAdic [data-fa-card="7"] [data-fa="emitir"]').click(); await espera(30);
const si = () => d.querySelector('#mFoot [data-m="si"]');
res('2e emitir REAL abre la ventana con franja roja y los dos recuadros (REAL y total)', !!d.getElementById('faRealPal') && !!d.getElementById('faRealTot') && d.body.classList.contains('fa-franja-real'));
si().click(); await espera(30);
res('2e REAL sin escribir nada → no llama a la Edge (pide la palabra REAL)', w.__edge.length === 0 && /palabra REAL/.test(d.getElementById('mErr').textContent), d.getElementById('mErr').textContent);
d.getElementById('faRealPal').value = 'REAL'; d.getElementById('faRealTot').value = '9.999'; si().click(); await espera(30);
res('2e REAL + total distinto → no llama (el total no coincide)', w.__edge.length === 0 && /no coincide/.test(d.getElementById('mErr').textContent));
d.getElementById('faRealPal').value = 'real?'; d.getElementById('faRealTot').value = '10.000'; si().click(); await espera(30);
res('2e total correcto pero palabra mal escrita ("real?") → no llama', w.__edge.length === 0);
d.getElementById('faRealPal').value = 'REAL'; d.getElementById('faRealTot').value = '10.000'; si().click(); await espera(80);
res('2e REAL + 10.000 → llama UNA vez a la Edge con accion emitir y la factura 7', w.__edge.length === 1 && w.__edge[0].body.accion === 'emitir' && w.__edge[0].body.factura_id === 7 && /facturacion-emitir/.test(w.__edge[0].u), w.__edge);
dom.window.close();
dom = await abrir(); w = dom.window; d = w.document;
d.querySelector('#vistaAdic [data-fa-card="8"] [data-fa="emitir"]').click(); await espera(30);
res('2e emitir una PRUEBA antigua ya aprobada (el servidor la sigue aceptando): sin recuadros que escribir', !d.getElementById('faRealPal') && !d.getElementById('faRealTot'));
d.querySelector('#mFoot [data-m="si"]').click(); await espera(80);
res('2e emitir PRUEBA: un clic → llama a la Edge con la factura 8', w.__edge.length === 1 && w.__edge[0].body.factura_id === 8, w.__edge);
dom.window.close();

console.log(`\nFacturación adicional · asistente en pasos: ${ok}/${ok + mal}`);
Deno.exit(mal ? 1 : 0);
