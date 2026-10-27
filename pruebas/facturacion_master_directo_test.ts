// Facturación F1c-MD · "Emitir directo" del Master · prueba LOCAL con mocks (no toca Supabase, OpenFactura ni producción).
// De punta a punta en jsdom: carga facturacion/index.html con supabase.js simulado y una factura FICTICIA, y verifica quién ve el botón,
// qué se pide antes de llamar al servidor y el orden de las llamadas (vista previa → master_directo → Edge 'emitir').
// Uso: deno run --allow-read --allow-env --allow-sys --allow-net=registry.npmjs.org pruebas/facturacion_master_directo_test.ts
import { JSDOM } from 'npm:jsdom@24.1.0';

const RAIZ = new URL('../', import.meta.url);
const leer = (p: string) => Deno.readTextFileSync(new URL(p, RAIZ));
let ok = 0, mal = 0;
const res = (n: string, b: boolean, d: unknown = '') => { if (b) { ok++; console.log('OK  ', n); } else { mal++; console.log('MAL ', n, JSON.stringify(d)); } };
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
const HUELLA = 'b'.repeat(64);

type Op = { yo: number; master: boolean; creador: number; modo: 'PRUEBA' | 'PRODUCCION'; prod: boolean; edgeFalla?: boolean; estado?: string };
function html(o: Op) {
  const FACT = { id: 9, codigo: 'FA-2026-0009', modo: o.modo, estado: o.estado ?? 'BORRADOR', creado_por: o.creador, cliente_id: 1, motivo: 'Trabajo adicional excepcional (ficticio)',
    lineas: [{ glosa: 'Regularización tributaria', cantidad: 1, precio: 10000 }], total: 10000, fecha_emision: '2026-10-27', fecha_vencimiento: '2026-10-27', forma_pago: 1, alertas: [],
    snapshot: null, snapshot_hash: null };
  const SNAP = { codigo: 'FA-2026-0009', modo: o.modo, fecha_emision: '2026-10-27', termino_pago: 'Contado', correo_destino: 'cliente@ficticio.cl',
    emisor: { RznSoc: 'EMISOR DEMO', RUTEmisor: '11111111-1', DirOrigen: 'DEMO' }, receptor_ficha: { rut: '22222222-2', razon_social: 'Cliente Ficticio SpA', giro: 'Servicios', direccion: 'Calle Falsa 123', comuna: 'Maipú' },
    detalle: [{ NmbItem: 'Regularización tributaria', QtyItem: 1, PrcItem: 10000, MontoItem: 10000 }], montos: { total: 10000 } };
  const MOCK = `var SB_URL='http://mock';var _gestoorAccessToken='x';window.__llamadas=[];window.__gets=0;
document.documentElement.classList.remove('auth-pending');
function sbH(){return {'Content-Type':'application/json',Authorization:'Bearer x'};}
function resp(o,st){return Promise.resolve(new Response(JSON.stringify(o),{status:st||200,headers:{'Content-Type':'application/json'}}));}
function sbFetch(path,opts){
  if(path.indexOf('rpc/facturacion_yo')===0)return resp({usuario_id:${o.yo},es_master:${o.master},puede_preparar:${!o.master},puede_aprobar:${o.master},puede_leer:true});
  if(path.indexOf('rpc/fact_clientes_lista')===0)return resp([{id:1,rut:'22222222-2',razon_social:'Cliente Ficticio SpA',estado:'activo'}]);
  if(path.indexOf('rpc/')===0){var fn=path.slice(4);window.__llamadas.push({fn:fn,body:JSON.parse(opts&&opts.body||'{}')});
    if(fn==='factura_adicional_master_directo_vista')return resp({factura_id:9,codigo:'FA-2026-0009',estado:'BORRADOR',modo:'${o.modo}',total:10000,snapshot:${JSON.stringify(SNAP)},huella:'${HUELLA}',alertas:[],emision_habilitada:${o.modo === 'PRUEBA' || o.prod},fecha_emision_ok:true});
    return resp({estado:'APROBADA',repetido:false});}
  return resp([]);
}
function sbGet(path){
  if(path.indexOf('facturas_adicionales?')===0){window.__gets++;return Promise.resolve([${JSON.stringify(FACT)}]);}
  if(path.indexOf('facturacion_parametros')===0)return Promise.resolve([{produccion_habilitada:${o.prod}}]);
  if(path.indexOf('clientes?')===0)return Promise.resolve([{id:1,rut:'22222222-2',razon_social:'Cliente Ficticio SpA',estado:'activo'}]);
  if(path.indexOf('periodos')===0)return Promise.resolve([{periodo:'2026-10',uf:41252.94}]);
  return Promise.resolve([]);
}`;
  let h = leer('facturacion/index.html');
  h = h.replace(/<script>if\(!window\.FX_DEMO\)document\.write\([\s\S]*?auth\.js[\s\S]*?<\/script>/, '');
  h = h.replace(/<script>if\(window\.FX_DEMO\)document\.write\([\s\S]*?<\/script>/, '');
  h = h.replace(/<script src="\.\.\/assets\/gestoor-menu\.js"><\/script>/, '');
  h = h.replace('<script src="../supabase.js"></script>', `<script>${MOCK}</script>`);
  for (const f of ['facturacion.js', 'adicional.js', 'adicional-real.js']) h = h.replace(`<script src="${f}"></script>`, () => `<script>${leer('facturacion/' + f)}</script>`);
  return h;
}
async function abrir(o: Op) {
  const edge: unknown[] = [];
  const dom = new JSDOM(html(o), { runScripts: 'dangerously', url: 'https://gestoor.contadoor.cl/facturacion/', pretendToBeVisual: true,
    beforeParse(w: any) {
      w.Response = Response; w.HTMLElement.prototype.scrollIntoView = () => {};
      w.fetch = (url: string, init: any) => { edge.push({ url, body: JSON.parse(init?.body || '{}') });
        return Promise.resolve(new Response(JSON.stringify(o.edgeFalla ? { error: 'PRODUCCION_NO_HABILITADA_EN_EDGE' } : { estado: 'EMITIDA', folio: '123', documentos: 'OBTENIDOS' }),
          { status: o.edgeFalla ? 409 : 200, headers: { 'Content-Type': 'application/json' } })); };
    } });
  const w: any = dom.window, d = w.document;
  await espera(150); d.querySelector('[data-vista="ADICIONAL"]').click(); await espera(150);
  return { dom, w, d, edge };
}
async function directo(o: Op, f: { marcar?: boolean; total?: string; real?: string }) {
  const { dom, w, d, edge } = await abrir(o);
  const b = d.querySelector('#vistaAdic [data-fa="directo"]');
  if (!b || b.disabled) { dom.window.close(); return { error: b ? 'botón deshabilitado' : 'sin botón directo' }; }
  b.click(); await espera(80);
  const cuerpo = d.getElementById('mBody').textContent;
  d.getElementById('faDirConf').checked = f.marcar !== false; d.getElementById('faDirTot').value = f.total ?? '10.000';
  if (d.getElementById('faDirPal')) d.getElementById('faDirPal').value = f.real ?? '';
  d.querySelector('#mFoot [data-m="si"]').click(); await espera(150);
  const err = d.getElementById('mErr');
  const r = { aviso: /sin revisión de otra persona/.test(cuerpo), real: /se emite en el SII/.test(cuerpo), doc: /Cliente Ficticio SpA/.test(cuerpo),
    error: err && !err.hidden ? err.textContent : '', rpc: w.__llamadas.map((x: any) => x.fn), directo: w.__llamadas.filter((x: any) => x.fn === 'factura_adicional_master_directo'),
    edge, gets: w.__gets };
  dom.window.close(); return r;
}
const M = { yo: 1, master: true, creador: 1, modo: 'PRUEBA' as const, prod: false };

// 1. Visibilidad del botón
{
  const v = await abrir(M); const bd = v.d.querySelector('#vistaAdic [data-fa="directo"]');
  v.d.querySelector('#vistaAdic [data-fa="ver"]').click(); await espera(80);
  const det = v.d.querySelector('#faPanel'), dd = det?.querySelector('[data-fa="directo"]'), de = det?.querySelector('[data-fa="enviar"]'); v.dom.window.close();
  res('1.1 Master con SU borrador PRUEBA: "Emitir directo" es la acción de la fila; en el detalle también está "Enviar a aprobación" (camino normal)',
      !!bd && !bd.disabled && /Emitir directo/.test(bd.textContent) && !!dd && !!de);
}
{
  const v = await abrir({ ...M, yo: 2, master: false }); const bd = v.d.querySelector('#vistaAdic [data-fa="directo"]'), be = v.d.querySelector('#vistaAdic [data-fa="enviar"]'); v.dom.window.close();
  res('1.2 facturador: NO ve "Emitir directo"; ve "Enviar a aprobación"', !bd && !!be);
}
{
  const v = await abrir({ ...M, creador: 2 }); const bd = v.d.querySelector('#vistaAdic [data-fa="directo"]'); v.dom.window.close();
  res('1.3 Master con la factura de OTRO: NO ve "Emitir directo" (se aprueba con el camino normal)', !bd);
}
{
  const v = await abrir({ ...M, modo: 'PRODUCCION', prod: false }); const bd = v.d.querySelector('#vistaAdic [data-fa="directo"]'); v.dom.window.close();
  res('1.4 REAL con la emisión real apagada: "Emitir directo" visible pero DESHABILITADO', !!bd && bd.disabled);
}
{
  const v = await abrir({ ...M, estado: 'EN_REVISION' }); const bd = v.d.querySelector('#vistaAdic [data-fa="directo"]'); v.dom.window.close();
  res('1.5 factura ya EN_REVISION: sin "Emitir directo"', !bd);
}
// 2. Confirmación antes de llamar
let r: any = await directo(M, { total: '10.000' });
res('2.1 PRUEBA: vista previa del documento → master_directo (huella vista, total 10000, modo PRUEBA, casilla) → Edge emitir, en ese orden',
    r.aviso && r.doc && r.error === '' && JSON.stringify(r.rpc) === JSON.stringify(['factura_adicional_master_directo_vista', 'factura_adicional_master_directo'])
    && r.directo[0].body.p_huella === HUELLA && r.directo[0].body.p_total_confirmado === 10000 && r.directo[0].body.p_modo_confirmado === 'PRUEBA' && r.directo[0].body.p_confirmo === true
    && r.edge.length === 1 && /facturacion-emitir$/.test(r.edge[0].url) && r.edge[0].body.accion === 'emitir' && r.edge[0].body.factura_id === 9, r);
r = await directo(M, { total: '9.999' });
res('2.2 total distinto → rechazado en pantalla, sin llamar a master_directo ni a la Edge', r.directo.length === 0 && r.edge.length === 0 && /no coincide/.test(r.error), r);
r = await directo(M, { total: '10,000' });
res('2.3 total mal escrito → rechazado, sin llamadas', r.directo.length === 0 && r.edge.length === 0 && /sin signo/.test(r.error), r);
r = await directo(M, { marcar: false });
res('2.4 sin la casilla → rechazado, sin llamadas', r.directo.length === 0 && r.edge.length === 0 && /Marca la casilla/.test(r.error), r);
const MR = { ...M, modo: 'PRODUCCION' as const, prod: true };
r = await directo(MR, { real: '', total: '10000' });
res('2.5 REAL sin escribir REAL → rechazado, sin llamadas (y el aviso grita SII)', r.real && r.directo.length === 0 && r.edge.length === 0 && /palabra REAL/.test(r.error), r);
r = await directo(MR, { real: 'real', total: '10000' });
res('2.6 REAL con REAL + total → master_directo con modo PRODUCCION y luego la Edge', r.directo.length === 1 && r.directo[0].body.p_modo_confirmado === 'PRODUCCION' && r.edge.length === 1, r);
r = await directo({ ...MR, edgeFalla: true }, { real: 'REAL', total: '10000' });
res('2.7 si la Edge rechaza tras aprobar (candado del servidor): se muestra el motivo y la cartera se recarga (estado real)',
    r.directo.length === 1 && r.edge.length === 1 && /apagada en el servidor/.test(r.error) && r.gets >= 2, r);

console.log(`\nF1c-MD · emitir directo (pantalla): ${ok}/${ok + mal}`);
Deno.exit(mal ? 1 : 0);
