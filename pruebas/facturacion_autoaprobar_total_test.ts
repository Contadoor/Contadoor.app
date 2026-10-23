// Facturación F1c-M · total reescrito en la auto-aprobación · prueba LOCAL con mocks (no toca Supabase ni producción).
// 1) Función pura totalConfirmadoDesdeTexto (extraída del archivo real entre @total-confirmado-inicio/fin).
// 2) De punta a punta en jsdom: carga facturacion/index.html con supabase.js simulado, abre "Auto-aprobar" como Master creador
//    de una factura FICTICIA de $10.000 y verifica, para cada texto, si se llama o no a factura_adicional_autoaprobar y con qué total.
// Uso: deno run --allow-read --allow-env --allow-sys --allow-net=registry.npmjs.org pruebas/facturacion_autoaprobar_total_test.ts
import { JSDOM } from 'npm:jsdom@24.1.0';

const RAIZ = new URL('../', import.meta.url);
const leer = (p: string) => Deno.readTextFileSync(new URL(p, RAIZ));
let ok = 0, mal = 0;
const res = (n: string, b: boolean, d: unknown = '') => { if (b) { ok++; console.log('OK  ', n); } else { mal++; console.log('MAL ', n, JSON.stringify(d)); } };

// ── 1. Función pura ──
const js = leer('facturacion/adicional-real.js');
const src = js.slice(js.indexOf('/* @total-confirmado-inicio'), js.indexOf('/* @total-confirmado-fin */'));
const fn = new Function(src + '; return totalConfirmadoDesdeTexto;')() as (t: unknown) => { ok: boolean; valor?: number; motivo?: string };
const CASOS: [string, unknown, boolean, number | null][] = [
  ['-10000', '-10000', false, null], ['100.00', '100.00', false, null], ['10,000', '10,000', false, null], ['10.000', '10.000', true, 10000],
  ['10000abc', '10000abc', false, null], ['vacío', '', false, null], ['" 10000 " (espacios de los extremos)', ' 10000 ', true, 10000],
  ['10000', '10000', true, 10000], ['1.000.000', '1.000.000', true, 1000000], ['10 000 (espacio interno)', '10 000', false, null],
  ['+10000', '+10000', false, null], ['10.00 (miles mal formados)', '10.00', false, null], ['1.0000', '1.0000', false, null],
  ['0', '0', false, null], ['010000 (cero inicial)', '010000', false, null], ['1e4', '1e4', false, null], ['10000.', '10000.', false, null],
  ['.10000', '.10000', false, null], ['null', null, false, null], ['solo espacios', '   ', false, null],
];
for (const [n, t, esOk, v] of CASOS) { const r = fn(t); res(`1 función: ${n} → ${esOk ? 'válido ' + v : 'rechazado'}`, r.ok === esOk && (esOk ? r.valor === v : r.valor === undefined), r); }

// ── 2. De punta a punta (callback real del modal) ──
const FACT = { id: 6, codigo: 'FA-2026-0006', modo: 'PRUEBA', estado: 'EN_REVISION', creado_por: 1, cliente_id: 1, motivo: 'Trabajo adicional excepcional (ficticio)',
  lineas: [{ glosa: 'Regularización tributaria', cantidad: 1, precio: 10000 }], total: 10000, fecha_emision: '2026-10-23', fecha_vencimiento: '2026-10-23', forma_pago: 1, alertas: [],
  snapshot_hash: 'a'.repeat(64), snapshot: { codigo: 'FA-2026-0006', modo: 'PRUEBA', fecha_emision: '2026-10-23', termino_pago: 'Contado', correo_destino: 'info@contadoor.cl',
    emisor: { RznSoc: 'EMISOR DEMO', RUTEmisor: '76795561-8', DirOrigen: 'DEMO' }, receptor_ficha: { rut: '11111111-1', razon_social: 'Cliente Ficticio SpA', giro: 'Servicios', direccion: 'Calle Falsa 123', comuna: 'Maipú' },
    detalle: [{ NmbItem: 'Regularización tributaria', QtyItem: 1, PrcItem: 10000, MontoItem: 10000 }], montos: { total: 10000 } } };
const MOCK = `var SB_URL='http://mock';var _gestoorAccessToken='x';window.__llamadas=[];
document.documentElement.classList.remove('auth-pending');
function sbH(){return {'Content-Type':'application/json',Authorization:'Bearer x'};}
function resp(o,st){return Promise.resolve(new Response(JSON.stringify(o),{status:st||200,headers:{'Content-Type':'application/json'}}));}
function sbFetch(path,opts){
  if(path.indexOf('rpc/facturacion_yo')===0)return resp({usuario_id:1,es_master:true,puede_preparar:false,puede_aprobar:true,puede_leer:true});
  if(path.indexOf('rpc/fact_clientes_lista')===0)return resp([{id:1,rut:'11111111-1',razon_social:'Cliente Ficticio SpA',estado:'activo'}]);
  if(path.indexOf('rpc/')===0){window.__llamadas.push({fn:path.slice(4),body:JSON.parse(opts&&opts.body||'{}')});return resp({estado:'APROBADA',avisos:2});}
  return resp([]);
}
function sbGet(path){
  if(path.indexOf('facturas_adicionales?')===0)return Promise.resolve([${JSON.stringify(FACT)}]);
  if(path.indexOf('facturacion_parametros')===0)return Promise.resolve([{produccion_habilitada:false}]);
  if(path.indexOf('clientes?')===0)return Promise.resolve([{id:1,rut:'11111111-1',razon_social:'Cliente Ficticio SpA',estado:'activo'}]);
  if(path.indexOf('periodos')===0)return Promise.resolve([{periodo:'2026-10',uf:41252.94}]);
  return Promise.resolve([]);
}`;
let html = leer('facturacion/index.html');
html = html.replace(/<script>if\(!window\.FX_DEMO\)document\.write\([\s\S]*?auth\.js[\s\S]*?<\/script>/, '');
html = html.replace(/<script>if\(window\.FX_DEMO\)document\.write\([\s\S]*?<\/script>/, '');
html = html.replace(/<script src="\.\.\/assets\/gestoor-menu\.js"><\/script>/, '');
html = html.replace('<script src="../supabase.js"></script>', `<script>${MOCK}</script>`);
for (const f of ['facturacion.js', 'adicional.js', 'adicional-real.js']) html = html.replace(`<script src="${f}"></script>`, () => `<script>${leer('facturacion/' + f)}</script>`);
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function intento(texto: string, marcar = true) {
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://gestoor.contadoor.cl/facturacion/', pretendToBeVisual: true,
    beforeParse(w: any) { w.Response = Response; w.fetch = () => Promise.reject(new Error('sin red')); w.HTMLElement.prototype.scrollIntoView = () => {}; } });
  const w: any = dom.window, d = w.document;
  await espera(150);
  d.querySelector('[data-vista="ADICIONAL"]').click(); await espera(150);
  const b = d.querySelector('#vistaAdic [data-fa="autoaprobar"]');
  if (!b) { dom.window.close(); return { error: 'sin botón auto-aprobar' }; }
  b.click(); await espera(50);
  const aviso = /Estás aprobando una factura que creaste tú/.test(d.getElementById('mBody').textContent);
  d.getElementById('faConf').checked = marcar; d.getElementById('faTotConf').value = texto;
  d.querySelector('#mFoot [data-m="si"]').click(); await espera(100);
  const err = d.getElementById('mErr'); const r = { aviso, error: err && !err.hidden ? err.textContent : '', llamadas: w.__llamadas.filter((x: any) => x.fn === 'factura_adicional_autoaprobar') };
  dom.window.close(); return r;
}
const E2E: [string, string, number | null, string][] = [
  ['-10000', '-10000', null, 'sin signo'], ['100.00', '100.00', null, 'sin signo'], ['10,000', '10,000', null, 'sin signo'],
  ['10000abc', '10000abc', null, 'sin signo'], ['vacío', '', null, 'Reescribe el total'], ['9.999 (bien escrito pero distinto)', '9.999', null, 'no coincide'],
  ['10.000', '10.000', 10000, ''], ['" 10000 "', ' 10000 ', 10000, ''],
];
for (const [n, t, esperado, msg] of E2E) {
  const r: any = await intento(t);
  if (esperado === null) res(`2 pantalla: ${n} → rechazado, sin llamar al servidor`, r.aviso && r.llamadas?.length === 0 && String(r.error).includes(msg), r);
  else res(`2 pantalla: ${n} → llama a autoaprobar con p_total_confirmado=${esperado}, p_confirmo=true y la huella`, r.aviso && r.error === '' && r.llamadas?.length === 1
      && r.llamadas[0].body.p_total_confirmado === esperado && r.llamadas[0].body.p_confirmo === true && r.llamadas[0].body.p_huella === 'a'.repeat(64), r);
}
const sinCasilla: any = await intento('10000', false);
res('2 pantalla: sin marcar la casilla → rechazado, sin llamar', sinCasilla.llamadas?.length === 0 && String(sinCasilla.error).includes('Marca la casilla'), sinCasilla);
console.log(`\nF1c-M · total reescrito: ${ok}/${ok + mal}`);
Deno.exit(mal ? 1 : 0);
