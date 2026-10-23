// Facturación adicional · rediseño 23-oct · asistente "Nueva factura" en pasos y confirmación REAL · prueba LOCAL con mocks
// (no toca Supabase ni producción; datos FICTICIOS).
// 1) Función pura palabraRealOk (extraída del archivo real entre @palabra-real-inicio/fin).
// 2) De punta a punta en jsdom: no se avanza sin elegir tipo; con la emisión real apagada la tarjeta Real está deshabilitada;
//    crear una REAL exige escribir REAL (sin eso no se llama a factura_adicional_crear); una PRUEBA se crea sin escribir nada;
//    emitir una REAL exige REAL + total correcto (sin eso no se llama a la Edge); emitir una PRUEBA es un clic.
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
  if(path.indexOf('facturas_adicionales?')===0)return Promise.resolve([${JSON.stringify(fac(7, 'PRODUCCION', 'APROBADA'))},${JSON.stringify(fac(8, 'PRUEBA', 'APROBADA'))}]);
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
async function hastaRevisar(d: any, modo: string) {
  d.querySelector('[data-fa="nueva"]').click(); await espera(20);
  d.querySelector(`[data-fa-modo="${modo}"]`).click(); await espera(20);
  d.getElementById('faWizSig').click(); await espera(20);
  d.querySelector('[data-fa-cli="1"]').click(); await espera(20);
  d.getElementById('faWizSig').click(); await espera(20);
  set(d, d.getElementById('faMot'), 'Trabajo adicional solicitado por el cliente (ficticio)');
  const r = d.querySelector('#faLins .fa-lin'); set(d, r.querySelector('.fa-g'), 'Servicio ficticio'); set(d, r.querySelector('.fa-q'), '2'); set(d, r.querySelector('.fa-p'), '15000');
  d.getElementById('faWizSig').click(); await espera(20);
}

// 2a. Sin elegir tipo no se avanza
let dom = await abrir(); let w: any = dom.window, d = w.document;
d.querySelector('[data-fa="nueva"]').click(); await espera(20);
const ningunaMarcada = [...d.querySelectorAll('[data-fa-modo]')].every((b: any) => b.getAttribute('aria-checked') === 'false');
res('2a el asistente parte en el paso 1 (Tipo) y ninguna tarjeta viene marcada', /1\s*Tipo/.test(paso(d)) && ningunaMarcada, paso(d));
d.getElementById('faWizSig').click(); await espera(20);
res('2a "Siguiente" sin elegir tipo → sigue en el paso 1 con el mensaje "Elige el tipo"', /1\s*Tipo/.test(paso(d)) && /Elige el tipo de factura/.test(d.getElementById('faWizErr').textContent) && !d.getElementById('faWizErr').hidden, d.getElementById('faWizErr').textContent);
res('2a sin tipo no hay franja REAL ni PRUEBA', !d.body.classList.contains('fa-con-franja') && d.getElementById('faFranja').hidden);
d.querySelector('[data-fa-modo="PRODUCCION"]').click(); await espera(20);
res('2a al elegir REAL aparece la franja roja "FACTURA REAL · se enviará al SII"', d.body.classList.contains('fa-franja-real') && /FACTURA REAL/.test(d.getElementById('faFranja').textContent) && /SII/.test(d.getElementById('faFranja').textContent));
d.querySelector('[data-fa-modo="PRUEBA"]').click(); await espera(20);
res('2a al cambiar a PRUEBA la franja pasa a celeste "PRUEBA · sin validez tributaria"', d.body.classList.contains('fa-franja-prueba') && !d.body.classList.contains('fa-franja-real') && /sin validez tributaria/.test(d.getElementById('faFranja').textContent));
d.getElementById('faWizSig').click(); await espera(20);
d.getElementById('faWizSig').click(); await espera(20);
res('2a sin elegir cliente no se pasa del paso 2', /2\s*Cliente/.test(paso(d)) && /Elige un cliente/.test(d.getElementById('faWizErr').textContent), paso(d));
d.querySelector('[data-vista="FIJO"]').click(); await espera(20);
res('2a al ir al grupo FIJO se quita la franja', !d.body.classList.contains('fa-con-franja'));
dom.window.close();

// 2b. Emisión real apagada → tarjeta Real deshabilitada con su motivo
dom = await abrir(false); w = dom.window; d = w.document;
d.querySelector('[data-fa="nueva"]').click(); await espera(20);
const real = d.querySelector('[data-fa-modo="PRODUCCION"]');
res('2b emisión real apagada → tarjeta Real deshabilitada y con el motivo "falta el GO de producción"', real.disabled && /GO de producción/.test(real.textContent));
real.click(); await espera(20);
res('2b clic en la tarjeta deshabilitada no elige REAL', !d.body.classList.contains('fa-franja-real') && /1\s*Tipo/.test(paso(d)));
dom.window.close();

// 2c. Crear una REAL exige la palabra REAL
dom = await abrir(); w = dom.window; d = w.document;
await hastaRevisar(d, 'PRODUCCION');
res('2c llega al paso 4 (Revisar) con vista previa tipo factura y total en grande', /4\s*Revisar/.test(paso(d)) && /\$30\.000/.test(d.querySelector('.fa-doc-tot').textContent) && !!d.getElementById('faWizReal'), paso(d));
d.getElementById('faWizCrear').click(); await espera(50);
res('2c REAL sin escribir la palabra → no llama a factura_adicional_crear y pide escribir REAL', w.__llamadas.filter((x: any) => x.fn === 'factura_adicional_crear').length === 0 && /escribe la palabra REAL/.test(d.getElementById('faWizErr').textContent), w.__llamadas);
set(d, d.getElementById('faWizReal'), 'SI'); d.getElementById('faWizCrear').click(); await espera(50);
res('2c REAL con otra palabra ("SI") → tampoco llama', w.__llamadas.filter((x: any) => x.fn === 'factura_adicional_crear').length === 0);
set(d, d.getElementById('faWizReal'), 'REAL'); d.getElementById('faWizCrear').click(); await espera(80);
const cr = w.__llamadas.filter((x: any) => x.fn === 'factura_adicional_crear');
res('2c con REAL escrita → llama UNA vez a factura_adicional_crear con modo PRODUCCION, cliente 1, total por líneas y sin campos nuevos', cr.length === 1 && cr[0].body.p.modo === 'PRODUCCION' && cr[0].body.p.cliente_id === 1
  && cr[0].body.p.lineas[0].cantidad === 2 && cr[0].body.p.lineas[0].precio === 15000 && Object.keys(cr[0].body.p).sort().join() === 'cliente_id,fecha_emision,fecha_vencimiento,forma_pago,lineas,modo,motivo', cr);
dom.window.close();

// 2d. Una PRUEBA se crea sin escribir nada
dom = await abrir(); w = dom.window; d = w.document;
await hastaRevisar(d, 'PRUEBA');
res('2d PRUEBA: el paso 4 no pide la palabra REAL', !d.getElementById('faWizReal'));
d.getElementById('faWizCrear').click(); await espera(80);
const cp = w.__llamadas.filter((x: any) => x.fn === 'factura_adicional_crear');
res('2d PRUEBA: un clic → factura_adicional_crear con modo PRUEBA', cp.length === 1 && cp[0].body.p.modo === 'PRUEBA', cp);
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
res('2e emitir PRUEBA: sin recuadros que escribir', !d.getElementById('faRealPal') && !d.getElementById('faRealTot'));
d.querySelector('#mFoot [data-m="si"]').click(); await espera(80);
res('2e emitir PRUEBA: un clic → llama a la Edge con la factura 8', w.__edge.length === 1 && w.__edge[0].body.factura_id === 8, w.__edge);
dom.window.close();

console.log(`\nFacturación adicional · asistente en pasos: ${ok}/${ok + mal}`);
Deno.exit(mal ? 1 : 0);
