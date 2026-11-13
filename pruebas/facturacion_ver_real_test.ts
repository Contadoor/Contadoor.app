// FACT-VER-REAL · ver el grupo REAL (PRODUCCION) en la pantalla Facturación, en SOLO LECTURA · prueba LOCAL con mocks
// (no toca Supabase ni producción; datos ficticios). Carga facturacion/index.html en jsdom con supabase.js simulado.
// Uso: deno run --allow-read --allow-env --allow-sys --allow-net=registry.npmjs.org pruebas/facturacion_ver_real_test.ts
import { JSDOM } from 'npm:jsdom@24.1.0';

const RAIZ = new URL('../', import.meta.url);
const leer = (p: string) => Deno.readTextFileSync(new URL(p, RAIZ));
let ok = 0, mal = 0;
const res = (n: string, b: boolean, d: unknown = '') => { if (b) { ok++; console.log('OK  ', n); } else { mal++; console.log('MAL ', n, JSON.stringify(d)); } };

const tot = (n: number, m: number) => ({ n_lineas: n, n_listas: n, monto_listas: m, diferencia: 0, anterior: {} });
const base = { fecha_emision: '2026-11-01', fecha_vencimiento: '2026-11-21', uf_fecha: '2026-11-01', uf_valor: 39643.59, bloqueos: [], comparativo: {} };
const LOTES = [
  { ...base, id: 2, periodo: '2026-10', tipo: 'FIJO', modo: 'PRUEBA', estado: 'EMITIDO', totales: tot(2, 30000) },
  { ...base, id: 3, periodo: '2026-10', tipo: 'FIJO', modo: 'PRODUCCION', estado: 'EMITIDO', totales: tot(3, 45000) },
  { ...base, id: 4, periodo: '2026-10', tipo: 'VARIABLE', modo: 'PRUEBA', estado: 'BORRADOR', totales: tot(2, 0) },
  { ...base, id: 5, periodo: '2026-10', tipo: 'VARIABLE', modo: 'PRODUCCION', estado: 'EMITIDO', totales: tot(3, 52000) },
  { ...base, id: 6, periodo: '2026-09', tipo: 'FIJO', modo: 'PRUEBA', estado: 'BORRADOR', totales: tot(1, 0) },
];
const lin = (id: number, lote: number, tipo: string, estado: string, folio: number | null, total: number, nom: string) => ({
  id, lote_id: lote, cliente_id: id, cliente_rut: '1111111' + id + '-1', razon_social: nom, plan: 'base', moneda: 'CLP', monto_base: total, valor_por_trab: tipo === 'VARIABLE' ? 5000 : 0,
  moneda_variable: 'CLP', trab_incluidos: 1, n_trabajadores: tipo === 'VARIABLE' ? 2 : null, origen_trabajadores: 'MANUAL', adicionales_total: 0, descuento: 0, total_clp: total,
  estado, motivos: [], alertas: [], calculo: { L1_plan: total, total }, detalle: { items: [] }, snapshot: null, of_folio: folio, doc_estado: 'PENDIENTE', correo_estado: 'PENDIENTE', error: null, tipo_lote: tipo });
const LINEAS = [
  lin(21, 2, 'FIJO', 'EMITIDA', 201407, 15000, 'Prueba Uno SpA'), lin(22, 2, 'FIJO', 'EMITIDA', 201408, 15000, 'Prueba Dos SpA'),
  lin(31, 3, 'FIJO', 'EMITIDA', 16500, 10000, 'Real Uno SpA'), lin(32, 3, 'FIJO', 'EMITIDA', 16501, 15000, 'Real Dos SpA'), lin(33, 3, 'FIJO', 'EMITIDA', 16502, 20000, 'Real Tres SpA'),
  lin(41, 4, 'VARIABLE', 'BORRADOR', null, 12000, 'Variable Prueba SpA'), lin(42, 4, 'VARIABLE', 'BORRADOR', null, 13000, 'Variable Prueba Dos SpA'),
  lin(51, 5, 'VARIABLE', 'EMITIDA', 16580, 30000, 'Variable Real Uno SpA'), lin(52, 5, 'VARIABLE', 'EMITIDA', 16581, 22000, 'Variable Real Dos SpA'),
  lin(53, 5, 'VARIABLE', 'EXCLUIDA', null, 9000, 'Variable Excluida SpA'),
  lin(61, 6, 'FIJO', 'BORRADOR', null, 9000, 'Septiembre SpA'),
];
const MOCK = (rol: string) => `var SB_URL='http://mock';var _gestoorAccessToken='x';window.__llamadas=[];window.__gets=[];
document.documentElement.classList.remove('auth-pending');
var LOTES=${JSON.stringify(LOTES)},LINEAS=${JSON.stringify(LINEAS)};
function sbH(){return {'Content-Type':'application/json',Authorization:'Bearer x'};}
function resp(o,st){return Promise.resolve(new Response(JSON.stringify(o),{status:st||200,headers:{'Content-Type':'application/json'}}));}
function sbFetch(path,opts){
  if(path.indexOf('rpc/facturacion_yo')===0)return resp(${rol === 'master'
    ? "{usuario_id:1,es_master:true,puede_preparar:true,puede_aprobar:true,puede_leer:true,nombre:'Master'}"
    : "{usuario_id:4,es_master:false,puede_preparar:true,puede_aprobar:false,puede_leer:true,nombre:'Facturador'}"});
  if(path.indexOf('rpc/')===0){window.__llamadas.push({fn:path.slice(4),body:JSON.parse(opts&&opts.body||'{}')});return resp({});}
  return resp([]);
}
function prm(path){var p={};(path.split('?')[1]||'').split('&').forEach(function(kv){var i=kv.indexOf('=');if(i>0)p[kv.slice(0,i)]=decodeURIComponent(kv.slice(i+1));});return p;}
function sbGet(path){
  window.__gets.push(path);var p=prm(path),t=path.split('?')[0];
  function eq(k){return p[k]&&p[k].indexOf('eq.')===0?p[k].slice(3):null;}
  if(t==='periodos')return Promise.resolve([{periodo:'2026-10',uf:39643.59},{periodo:'2026-09',uf:39400},{periodo:'2026-08',uf:39300}]);
  if(t==='facturacion_lotes'){var mods=p.modo&&p.modo.indexOf('in.(')===0?p.modo.slice(4,-1).split(','):(eq('modo')?[eq('modo')]:null);
    return Promise.resolve(LOTES.filter(function(l){return l.periodo===eq('periodo')&&l.tipo===eq('tipo')&&(!mods||mods.indexOf(l.modo)>=0);}).sort(function(a,b){return b.id-a.id;}));}
  if(t==='facturacion')return Promise.resolve(LINEAS.filter(function(f){return f.lote_id===+eq('lote_id');}));
  if(t==='facturacion_parametros')return Promise.resolve([{produccion_habilitada:false}]);
  return Promise.resolve([]);
}`;
function pagina(rol: string) {
  let html = leer('facturacion/index.html');
  html = html.replace(/<script>if\(!window\.FX_DEMO\)document\.write\([\s\S]*?auth\.js[\s\S]*?<\/script>/, '');
  html = html.replace(/<script>if\(window\.FX_DEMO\)document\.write\([\s\S]*?<\/script>/, '');
  html = html.replace(/<script src="\.\.\/assets\/gestoor-menu\.js"><\/script>/, '');
  html = html.replace('<script src="../supabase.js"></script>', () => `<script>${MOCK(rol)}</script>`);
  for (const f of ['facturacion.js', 'adicional.js', 'adicional-real.js']) html = html.replace(`<script src="${f}"></script>`, () => `<script>${leer('facturacion/' + f)}</script>`);
  return html;
}
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
const MUTAN = ['preparar', 'enviar', 'aprobar', 'devolver', 'anular', 'emitir', 'trabajadores', 'adicional', 'quitar-adicional', 'conciliar', 'reenviar'];
async function abrir(rol: string) {
  const dom = new JSDOM(pagina(rol), { runScripts: 'dangerously', url: 'https://gestoor.contadoor.cl/facturacion/', pretendToBeVisual: true,
    beforeParse(w: any) { w.Response = Response; w.fetch = () => Promise.reject(new Error('sin red')); w.HTMLElement.prototype.scrollIntoView = () => {}; } });
  await espera(200);
  return dom;
}
function estado(dom: any) {
  const d = dom.window.document, g = d.getElementById('vistaGrupo');
  const botones = [...d.querySelectorAll('#hero [data-act], #vistaGrupo [data-act]')].map((b: any) => b.getAttribute('data-act'));
  return {
    badge: d.querySelector('#hero .estado-lote .prueba')?.textContent.trim(),
    topbarOculta: d.body.classList.contains('fx-ver-real'),
    mutan: botones.filter((a: string) => MUTAN.includes(a)),
    acciones: d.getElementById('acciones').textContent,
    filas: [...d.querySelectorAll('#tbody tr[data-id]')].map((tr: any) => tr.querySelector('.cli b').textContent),
    hero: d.getElementById('hero').textContent, pie: d.getElementById('pie').textContent, tabla: d.getElementById('tbody').textContent,
    seg: [...d.querySelectorAll('.fx-modo .fb')].map((b: any) => (b.classList.contains('on') ? '*' : '') + b.textContent.trim()), g: !!g,
  };
}
const click = async (dom: any, sel: string) => { dom.window.document.querySelector(sel).click(); await espera(150); };

for (const rol of ['master', 'facturador']) {
  const dom: any = await abrir(rol), w = dom.window;
  // 1. FIJO 2026-10 → por defecto el grupo REAL (lote 3)
  let e = estado(dom);
  res(`${rol} · FIJO: por defecto muestra el grupo REAL (3 líneas reales)`, e.filas.join('|') === 'Real Uno SpA|Real Dos SpA|Real Tres SpA', e.filas);
  res(`${rol} · FIJO real: etiqueta "REAL · EMITIDO" y se oculta "MODO PRUEBA" del encabezado`, e.badge === 'REAL · EMITIDO' && e.topbarOculta, e);
  res(`${rol} · FIJO real: totales emitidos 3 · $45.000 · folios 16500–16502`, /Facturas emitidas \(reales\)3 de 3/.test(e.hero) && e.hero.includes('$45.000') && e.hero.includes('16500–16502') && e.pie.includes('3 emitidas · $45.000'), e.hero);
  res(`${rol} · FIJO real: SIN botones de preparar/recalcular/enviar/aprobar/emitir/anular/editar`, e.mutan.length === 0 && /solo lectura/.test(e.acciones), e.mutan);
  res(`${rol} · FIJO real: la tabla muestra folio y estado "Emitida"`, e.tabla.includes('Folio 16500') && e.tabla.includes('Emitida'), e.tabla.slice(0, 200));
  res(`${rol} · la carga pide ambos modos (modo=in.(PRUEBA,PRODUCCION))`, w.__gets.some((g: string) => g.startsWith('facturacion_lotes?') && g.includes('modo=in.(PRUEBA,PRODUCCION)')), w.__gets);
  res(`${rol} · selector con "Real" activo y "Prueba"`, e.seg.length === 2 && e.seg[0].startsWith('*Real') && e.seg[1].startsWith('Prueba'), e.seg);
  // 2. Detalle de una línea real: sin botones de acción en el panel
  await click(dom, '#tbody tr[data-id="31"]');
  const drBtn = [...w.document.querySelectorAll('#drBody [data-act]')].map((b: any) => b.getAttribute('data-act')).filter((a: string) => MUTAN.includes(a));
  res(`${rol} · detalle de línea real: sin acciones`, drBtn.length === 0, drBtn);
  w.document.getElementById('drCerrar').click(); await espera(50);
  // 3. Fail-closed: aunque alguien inyecte un botón "aprobar"/"anular"/"preparar", con el grupo real no se llama al motor
  for (const act of ['aprobar', 'anular', 'preparar', 'enviar', 'devolver']) {
    const b = w.document.createElement('button'); b.setAttribute('data-act', act); w.document.getElementById('acciones').appendChild(b); b.click(); await espera(30);
  }
  res(`${rol} · fail-closed: botones inyectados en vista real no abren modal ni llaman RPC`, w.__llamadas.length === 0 && !w.document.getElementById('modal').classList.contains('on'), w.__llamadas);
  // 4. Cambiar a Prueba → grupo de prueba con sus acciones como hoy
  await click(dom, '.fx-modo [data-act="ver-prueba"]');
  e = estado(dom);
  res(`${rol} · Prueba: muestra el grupo de PRUEBA (lote 2) con "MODO PRUEBA"`, e.filas.join('|') === 'Prueba Dos SpA|Prueba Uno SpA' || e.filas.join('|') === 'Prueba Uno SpA|Prueba Dos SpA', e.filas);
  res(`${rol} · Prueba: etiqueta MODO PRUEBA y encabezado visible`, e.badge === 'MODO PRUEBA' && !e.topbarOculta, e);
  res(`${rol} · Prueba: vuelven las acciones de siempre`, rol === 'master' ? e.mutan.includes('aprobar') && e.mutan.includes('anular') : e.mutan.includes('preparar') && e.mutan.includes('emitir'), e.mutan);
  // 5. VARIABLE → al cambiar de grupo vuelve al REAL por defecto (lote 5, con excluidas)
  await click(dom, '[data-vista="VARIABLE"]');
  e = estado(dom);
  res(`${rol} · VARIABLE: por defecto el REAL, 2 emitidas de 3 (1 excluida) · $52.000 · folios 16580–16581`, e.badge === 'REAL · EMITIDO' && /Facturas emitidas \(reales\)2 de 3/.test(e.hero) && e.hero.includes('$52.000') && e.hero.includes('16580–16581') && e.tabla.includes('Excluida'), e.hero);
  res(`${rol} · VARIABLE real: sin botones de acción`, e.mutan.length === 0, e.mutan);
  await click(dom, '.fx-modo [data-act="ver-prueba"]');
  e = estado(dom);
  if (rol === 'facturador') res('facturador · VARIABLE prueba (Borrador): "Recalcular grupo" habilitado como hoy', !!w.document.querySelector('#acciones [data-act="preparar"]:not([disabled])'), e.mutan);
  else res('master · VARIABLE prueba (Borrador): Anular disponible como hoy', !!w.document.querySelector('#acciones [data-act="anular"]:not([disabled])'), e.mutan);
  // 6. Período sin grupo real → muestra el de prueba por defecto
  const sel = w.document.getElementById('selPeriodo'); sel.value = '2026-09'; sel.dispatchEvent(new w.Event('change')); await espera(150);
  await click(dom, '[data-vista="FIJO"]');
  e = estado(dom);
  res(`${rol} · período sin grupo real: por defecto el de prueba y el selector avisa "(sin grupo)" en Real`, e.badge === 'MODO PRUEBA' && e.filas.join() === 'Septiembre SpA' && /Real · emitido al SII \(sin grupo\)/.test(e.seg[0]), e);
  await click(dom, '.fx-modo [data-act="ver-real"]');
  e = estado(dom);
  res(`${rol} · Real sin grupo: aviso claro y sin "Preparar" (preparar solo en Prueba)`, e.mutan.length === 0 && /No hay grupo REAL/.test(e.hero) && e.filas.length === 0, e);
  res(`${rol} · en toda la prueba solo se leyó: 0 llamadas a RPC de escritura`, w.__llamadas.length === 0, w.__llamadas);
  dom.window.close();
}
console.log(`\nFACT-VER-REAL · ver grupos reales en solo lectura: ${ok}/${ok + mal}`);
Deno.exit(mal ? 1 : 0);
