// Facturación · enlace de los avisos de la campana (?tab=adicional&fa=<id>) · prueba LOCAL con mocks (no toca Supabase ni producción).
// Carga facturacion/index.html en jsdom con supabase.js simulado (datos FICTICIOS) y la URL exacta del aviso; verifica pestaña,
// localización de la factura (en la lista, más antigua que las 200 vía consulta por id, inexistente) y el caso sin permiso.
// Uso: deno run --allow-read --allow-env --allow-sys --allow-net=registry.npmjs.org pruebas/facturacion_enlace_aviso_test.ts
import { JSDOM } from 'npm:jsdom@24.1.0';
const RAIZ = new URL('../', import.meta.url);
const leer = (p: string) => Deno.readTextFileSync(new URL(p, RAIZ));
let ok = 0, mal = 0;
const res = (n: string, b: boolean, d: unknown = '') => { if (b) { ok++; console.log('OK  ', n); } else { mal++; console.log('MAL ', n, JSON.stringify(d)); } };
const fac = (id: number, estado = 'EMITIDA') => ({ id, codigo: 'FA-2026-' + String(id).padStart(4, '0'), modo: 'PRUEBA', estado, cliente_id: 1, creado_por: 2, motivo: 'Trabajo adicional (ficticio)',
  lineas: [{ glosa: 'Servicio ficticio', cantidad: 1, precio: 10000 }], total: 10000, fecha_emision: '2026-10-23', fecha_vencimiento: '2026-10-23', forma_pago: 1, alertas: [], of_folio: estado === 'EMITIDA' ? '2013' + id : null, doc_estado: 'PENDIENTE' });
function pagina(puedeLeer = true) {
  const MOCK = `var SB_URL='http://mock';var _gestoorAccessToken='x';window.__gets=[];
document.documentElement.classList.remove('auth-pending');
function sbH(){return {'Content-Type':'application/json',Authorization:'Bearer x'};}
function resp(o,st){return Promise.resolve(new Response(JSON.stringify(o),{status:st||200,headers:{'Content-Type':'application/json'}}));}
function sbFetch(path){
  if(path.indexOf('rpc/facturacion_yo')===0)return resp({usuario_id:1,es_master:true,puede_preparar:false,puede_aprobar:true,puede_leer:${puedeLeer}});
  if(path.indexOf('rpc/fact_clientes_lista')===0)return resp([{id:1,rut:'11111111-1',razon_social:'Cliente Ficticio SpA',estado:'activo'}]);
  return resp([]);
}
function sbGet(path){
  window.__gets.push(path);
  if(path.indexOf('facturas_adicionales?')===0&&path.indexOf('&id=eq.999')>0)return Promise.resolve([${JSON.stringify(fac(999, 'INCIERTO'))}]);
  if(path.indexOf('facturas_adicionales?')===0&&path.indexOf('&id=eq.')>0)return Promise.resolve([]);
  if(path.indexOf('facturas_adicionales?')===0)return Promise.resolve([${JSON.stringify(fac(6))},${JSON.stringify(fac(5, 'APROBADA'))}]);
  if(path.indexOf('facturacion_parametros')===0)return Promise.resolve([{produccion_habilitada:false}]);
  if(path.indexOf('periodos')===0)return Promise.resolve([{periodo:'2026-10',uf:41252.94}]);
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
async function abrir(query: string, puedeLeer = true) {
  const dom = new JSDOM(pagina(puedeLeer), { runScripts: 'dangerously', url: 'https://gestoor.contadoor.cl/facturacion/index.html' + query, pretendToBeVisual: true,
    beforeParse(w: any) { w.Response = Response; w.fetch = () => Promise.reject(new Error('sin red')); w.HTMLElement.prototype.scrollIntoView = function () { (w as any).__scroll = this.getAttribute('data-fa-card'); }; } });
  await espera(300);
  const w: any = dom.window, d = w.document;
  const activo = d.querySelector('[data-vista].on')?.getAttribute('data-vista');
  const r = { activo, adicVisible: !!d.getElementById('vistaAdic') && !d.getElementById('vistaAdic').hidden, resaltada: [...d.querySelectorAll('#vistaAdic [data-fa-card]')].filter((e: any) => e.style.outline).map((e: any) => e.getAttribute('data-fa-card')),
    scroll: w.__scroll || null, toast: d.getElementById('toast').textContent, tarjetas: d.querySelectorAll('#vistaAdic [data-fa-card]').length, main: d.getElementById('fxMain').textContent.slice(0, 120), gets: w.__gets };
  dom.window.close(); return r;
}
let r: any = await abrir('?tab=adicional&fa=6');
res('1 ?tab=adicional&fa=6 → pestaña Facturación adicional activa, tarjeta 6 resaltada y desplazada a la vista', r.activo === 'ADICIONAL' && r.adicVisible && r.resaltada.join() === '6' && r.scroll === '6' && /FA-2026-0006/.test(r.toast), r);
r = await abrir('?tab=adicional&fa=999');
res('2 factura más antigua que las 200 (fa=999) → se consulta por id con la RLS del usuario, se agrega y se resalta', r.activo === 'ADICIONAL' && r.resaltada.join() === '999' && r.tarjetas === 3
    && r.gets.some((g: string) => g.includes('facturas_adicionales?') && g.includes('&id=eq.999')), r);
r = await abrir('?tab=adicional&fa=777');
res('3 factura inexistente o sin permiso (fa=777) → mensaje claro, nada resaltado', r.activo === 'ADICIONAL' && r.resaltada.length === 0 && /no existe o no tienes acceso/.test(r.toast), r);
r = await abrir('?tab=adicional&fa=6%3Bdrop');
res('4 fa no numérico → se ignora (sin consulta por id), queda en Facturación adicional', r.activo === 'ADICIONAL' && r.resaltada.length === 0 && !r.gets.some((g: string) => g.startsWith('facturas_adicionales') && g.includes('&id=eq.')), r);
r = await abrir('');
res('5 sin parámetros → pestaña FIJO como siempre', r.activo === 'FIJO' && !r.adicVisible, r);
r = await abrir('?tab=adicional&fa=6', false);
res('6 usuario sin acceso a Facturación → "No tienes acceso a Facturación" y ninguna consulta de facturas', /No tienes acceso a Facturación/.test(r.main) && !r.gets.some((g: string) => g.startsWith('facturas_adicionales')), r);
console.log(`\nFacturación · enlace de avisos: ${ok}/${ok + mal}`);
Deno.exit(mal ? 1 : 0);
