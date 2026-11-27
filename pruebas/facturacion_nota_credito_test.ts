// Facturación F1e · notas de crédito en la pantalla · prueba LOCAL con mocks (jsdom; no toca Supabase ni producción).
// Carga facturacion/index.html real (rediseño #84) con supabase.js simulado y datos FICTICIOS, abre el DETALLE de la factura (?fa=9) y
// verifica la caja reservada ".fa-nc" (punto único de integración FX_NC.cajaHtml) y qué RPC / Edge se llaman con qué argumentos.
// Uso: deno run --allow-read --allow-env --allow-sys --allow-net=registry.npmjs.org pruebas/facturacion_nota_credito_test.ts
import { JSDOM } from 'npm:jsdom@24.1.0';

const RAIZ = new URL('../', import.meta.url);
const leer = (p: string) => Deno.readTextFileSync(new URL(p, RAIZ));
let ok = 0, mal = 0;
const res = (n: string, b: boolean, d: unknown = '') => { if (b) { ok++; console.log('OK  ', n); } else { mal++; console.log('MAL ', n, JSON.stringify(d)); } };

const SNAP = { codigo: 'FA-2026-0009', modo: 'PRUEBA', fecha_emision: '2026-10-23', termino_pago: 'Contado', correo_destino: 'info@contadoor.cl',
  emisor: { RznSoc: 'EMISOR DEMO', RUTEmisor: '76795561-8', DirOrigen: 'DEMO' }, receptor: { rut: '76430498-5', razon_social: 'RECEPTOR DEMO' },
  receptor_ficha: { rut: '11111111-1', razon_social: 'Cliente Ficticio SpA', giro: 'Servicios', direccion: 'Calle Falsa 123', comuna: 'Maipú' },
  detalle: [{ NroLinDet: 1, NmbItem: 'Servicio ficticio', QtyItem: 1, PrcItem: 50000, MontoItem: 50000 }], montos: { total: 50000 } };
const FACT = (o: Record<string, unknown> = {}) => ({ id: 9, codigo: 'FA-2026-0009', modo: 'PRUEBA', estado: 'EMITIDA', creado_por: 2, cliente_id: 1, motivo: 'Trabajo adicional excepcional (ficticio)',
  lineas: [{ glosa: 'Servicio ficticio', cantidad: 1, precio: 50000 }], total: 50000, total_dte: 50000, fecha_emision: '2026-10-23', fecha_vencimiento: '2026-10-23', forma_pago: 1,
  alertas: [], snapshot_hash: 'a'.repeat(64), snapshot: SNAP, of_folio: '201400', doc_estado: 'OBTENIDOS', ...o });
const NC = (o: Record<string, unknown> = {}) => ({ id: 4, codigo: 'NC-2026-0004', factura_id: 9, modo: 'PRUEBA', estado: 'EN_REVISION', cod_ref: 3, razon_ref: 'Corrige monto',
  motivo: 'Descuento acordado (ficticio)', monto: 10000, fecha_emision: '2026-10-24', creado_por: 2, auto_aprobada_master: false, snapshot_hash: 'b'.repeat(64),
  snapshot: { modo: 'PRUEBA', referencia: { TpoDocRef: '34', FolioRef: '201400', FchRef: '2026-10-23', CodRef: 3, RazonRef: 'Corrige monto' }, receptor: SNAP.receptor, receptor_ficha: SNAP.receptor_ficha,
    detalle: [{ NmbItem: 'Corrige monto factura N° 201400', QtyItem: 1, PrcItem: 10000, MontoItem: 10000 }], montos: { total: 10000 }, emisor: SNAP.emisor },
  of_folio: null, doc_estado: 'PENDIENTE', cobranza_estado: 'PENDIENTE', alertas: [], ...o });

function html(yo: Record<string, unknown>, facts: unknown[], ncs: unknown[], saldos: Record<string, unknown>, prod = false) {
  const MOCK = `var SB_URL='http://mock';var _gestoorAccessToken='x';window.__llamadas=[];window.__edge=[];
document.documentElement.classList.remove('auth-pending');
function sbH(){return {'Content-Type':'application/json',Authorization:'Bearer x'};}
function resp(o,st){return Promise.resolve(new Response(JSON.stringify(o),{status:st||200,headers:{'Content-Type':'application/json'}}));}
function sbFetch(path,opts){
  if(path.indexOf('rpc/facturacion_yo')===0)return resp(${JSON.stringify(yo)});
  if(path.indexOf('rpc/fact_clientes_lista')===0)return resp([{id:1,rut:'11111111-1',razon_social:'Cliente Ficticio SpA',estado:'activo'}]);
  if(path.indexOf('rpc/nota_credito_saldos')===0)return resp(${JSON.stringify(saldos)});
  if(path.indexOf('rpc/')===0){window.__llamadas.push({fn:path.slice(4),body:JSON.parse(opts&&opts.body||'{}')});return resp({codigo:'NC-2026-0005',estado:'EN_REVISION'});}
  return resp([]);
}
function sbGet(path){
  if(path.indexOf('facturas_adicionales?')===0)return Promise.resolve(${JSON.stringify(facts)});
  if(path.indexOf('facturas_adicionales_nc?')===0){window.__ncget=path;return Promise.resolve(${JSON.stringify(ncs)});}
  if(path.indexOf('facturacion_parametros')===0)return Promise.resolve([{produccion_habilitada:${prod}}]);
  if(path.indexOf('periodos')===0)return Promise.resolve([{periodo:'2026-10',uf:41252.94}]);
  return Promise.resolve([]);
}`;
  let h = leer('facturacion/index.html');
  h = h.replace(/<script>if\(!window\.FX_DEMO\)document\.write\([\s\S]*?auth\.js[\s\S]*?<\/script>/, '');
  h = h.replace(/<script>if\(!window\.FX_DEMO\)document\.write\([\s\S]*?avisos-push\.js[\s\S]*?<\/script>/, '');
  h = h.replace(/<script>if\(window\.FX_DEMO\)document\.write\([\s\S]*?<\/script>/, '');
  h = h.replace(/<script src="\.\.\/assets\/gestoor-menu\.js"><\/script>/, '');
  h = h.replace('<script src="../supabase.js"></script>', `<script>${MOCK}</script>`);
  for (const f of ['facturacion.js', 'adicional.js', 'nota-credito.js', 'adicional-real.js']) h = h.replace(`<script src="${f}"></script>`, () => `<script>${leer('facturacion/' + f)}</script>`);
  return h;
}
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
const FACTURADOR = { usuario_id: 2, es_master: false, puede_preparar: true, puede_aprobar: false, puede_leer: true };
const MASTER = { usuario_id: 1, es_master: true, puede_preparar: false, puede_aprobar: true, puede_leer: true };
const LECTOR = { usuario_id: 5, es_master: false, puede_preparar: false, puede_aprobar: false, puede_leer: true };
const SALDO0 = { total: 50000, disponible: 50000, saldo_no_anulado: 50000, n_nc: 0, n_externas: 0 };

async function pantalla(yo: Record<string, unknown>, facts: unknown[], ncs: unknown[], saldos: Record<string, unknown> = SALDO0, url = 'https://gestoor.contadoor.cl/facturacion/index.html?tab=adicional&fa=9', prod = false) {
  const dom = new JSDOM(html(yo, facts, ncs, saldos, prod), { runScripts: 'dangerously', url, pretendToBeVisual: true,
    beforeParse(w: any) {
      w.Response = Response; w.HTMLElement.prototype.scrollIntoView = () => {};
      w.fetch = (u: string, o: any) => { w.__edge.push({ url: u, body: JSON.parse(o.body) }); return Promise.resolve(new Response(JSON.stringify({ estado: 'EMITIDA', folio: '111900', documentos: 'OBTENIDOS' }), { status: 200 })); };
    } });
  const w: any = dom.window, d = w.document;
  await espera(400);   // ?tab=adicional&fa=9 abre directo el DETALLE de la factura (rediseño #84)
  return { dom, w, d };
}
const caja = (d: any) => d.querySelector('#vistaAdic [data-nc-caja="9"]');
const boton = (d: any, act: string) => d.querySelector(`#vistaAdic [data-nc="${act}"]`);

// 1. Facturador: anulación total
{
  const { dom, w, d } = await pantalla(FACTURADOR, [FACT()], []);
  res('1.1 la factura EMITIDA muestra la caja "Nota de crédito" con saldo no anulado $50.000', !!caja(d) && /Saldo no anulado\s*\$50\.000/.test(caja(d).textContent), caja(d)?.textContent);
  res('1.2 se pidieron las NC de las facturas emitidas (factura_id=in.(9))', String(w.__ncget).includes('factura_id=in.(9)'), w.__ncget);
  const b = boton(d, 'nueva');
  res('1.3 botón "Anular con nota de crédito" habilitado para el facturador', !!b && !b.disabled && /Anular con nota de crédito/.test(b.textContent));
  b.click(); await espera(150);
  res('1.4 la ventana muestra el saldo y aclara que receptor/detalle/referencia salen de la factura', /saldo disponible\s*\$50\.000/.test(d.getElementById('mBody').textContent) && /no se escriben a mano/.test(d.getElementById('mBody').textContent));
  d.getElementById('ncMot').value = 'corto'; d.querySelector('#mFoot [data-m="si"]').click(); await espera(80);
  res('1.5 motivo corto → error en pantalla, sin llamar al servidor', w.__llamadas.length === 0 && !d.getElementById('mErr').hidden);
  d.getElementById('ncMot').value = 'El cliente pidió anular (ficticio)'; d.querySelector('#mFoot [data-m="si"]').click(); await espera(120);
  const l = w.__llamadas.filter((x: any) => x.fn === 'nota_credito_crear');
  res('1.6 crea con cod_ref 1, sin monto (lo fija el servidor), razón por defecto y el motivo', l.length === 1 && l[0].body.p_factura === 9 && l[0].body.p.cod_ref === 1 && !('monto' in l[0].body.p)
      && l[0].body.p.razon_ref === 'Anula factura emitida por error' && Object.keys(l[0].body.p).sort().join() === 'cod_ref,motivo,razon_ref', l);
  dom.window.close();
}
// 2. Corregir monto
for (const [texto, esperado, msgEsp] of [['10.000', 10000, ''], ['abc', null, 'solo con números'], ['60.000', null, 'supera el saldo'], ['', null, 'solo con números']] as [string, number | null, string][]) {
  const { dom, w, d } = await pantalla(FACTURADOR, [FACT()], [], { ...SALDO0, disponible: 40000, saldo_no_anulado: 40000, n_nc: 1 });
  boton(d, 'nueva').click(); await espera(150);
  const r1 = d.querySelector('#mBody input[name=ncCod][value="1"]');
  const pre = r1.disabled && d.querySelector('#mBody input[name=ncCod][value="3"]').checked;
  d.getElementById('ncMonto').value = texto; d.getElementById('ncMot').value = 'Descuento acordado (ficticio)';
  d.querySelector('#mFoot [data-m="si"]').click(); await espera(120);
  const l = w.__llamadas.filter((x: any) => x.fn === 'nota_credito_crear'), err = d.getElementById('mErr');
  if (esperado === null) res(`2 corregir monto "${texto}" → rechazado sin llamar (${msgEsp})`, pre && l.length === 0 && String(err?.textContent).includes(msgEsp), { l, e: err?.textContent });
  else res(`2 corregir monto "${texto}" → cod_ref 3, monto ${esperado} (con otra NC: anular total deshabilitado)`, pre && l.length === 1 && l[0].body.p.cod_ref === 3 && l[0].body.p.monto === esperado, l);
  dom.window.close();
}
// 3. Master aprueba la NC de otro (con la huella) · 4. Master creador: auto-aprobar con monto reescrito
{
  const { dom, w, d } = await pantalla(MASTER, [FACT()], [NC()]);
  res('3.1 la NC aparece en la caja con su estado y monto', /NC-2026-0004/.test(caja(d).textContent) && /En revisión del Master/.test(caja(d).textContent) && /−\$10\.000/.test(caja(d).textContent));
  boton(d, 'aprobar').click(); await espera(80);
  res('3.2 la ventana muestra la referencia exacta a la factura 34 N° 201400', /factura 34 N° 201400/.test(d.getElementById('mBody').textContent));
  d.querySelector('#mFoot [data-m="si"]').click(); await espera(120);
  const l = w.__llamadas.filter((x: any) => x.fn === 'nota_credito_aprobar');
  res('3.3 aprobar envía la huella de la NC', l.length === 1 && l[0].body.p_nota === 4 && l[0].body.p_huella === 'b'.repeat(64), l);
  dom.window.close();
}
for (const [texto, marca, llama] of [['9.999', true, false], ['10.000', false, false], ['10.000', true, true]] as [string, boolean, boolean][]) {
  const { dom, w, d } = await pantalla(MASTER, [FACT()], [NC({ creado_por: 1 })]);
  res('4.0 Master creador ve "Auto-aprobar" (no "Aprobar")', !!boton(d, 'autoaprobar') && !boton(d, 'aprobar'));
  boton(d, 'autoaprobar').click(); await espera(80);
  d.getElementById('ncConf').checked = marca; d.getElementById('ncMontoConf').value = texto; d.querySelector('#mFoot [data-m="si"]').click(); await espera(120);
  const l = w.__llamadas.filter((x: any) => x.fn === 'nota_credito_autoaprobar');
  res(`4 auto-aprobar "${texto}" casilla=${marca} → ${llama ? 'llama con p_monto_confirmado 10000' : 'no llama'}`, llama ? (l.length === 1 && l[0].body.p_monto_confirmado === 10000 && l[0].body.p_confirmo === true) : l.length === 0, l);
  dom.window.close();
}
// 5. Emitir (Edge nc_emitir con nota_id)
{
  const { dom, w, d } = await pantalla(FACTURADOR, [FACT()], [NC({ estado: 'APROBADA' })]);
  boton(d, 'emitir').click(); await espera(80); d.querySelector('#mFoot [data-m="si"]').click(); await espera(150);
  res('5.1 emitir llama a la Edge facturacion-emitir con accion nc_emitir y nota_id', w.__edge.length === 1 && w.__edge[0].url.endsWith('/functions/v1/facturacion-emitir')
      && w.__edge[0].body.accion === 'nc_emitir' && w.__edge[0].body.nota_id === 4 && !('factura_id' in w.__edge[0].body), w.__edge);
  dom.window.close();
}
// 6. Lectura, factura no emitida, NC emitida (anulada), real sin GO, enlace ?nc=
{
  let p = await pantalla(LECTOR, [FACT()], []);
  res('6.1 sin rol de facturación: botón deshabilitado', boton(p.d, 'nueva')?.disabled === true); p.dom.window.close();
  p = await pantalla(FACTURADOR, [FACT({ estado: 'APROBADA', of_folio: null })], []);
  res('6.2 factura no emitida: la caja .fa-nc dice "Disponible cuando la factura esté emitida" y no tiene botón', !caja(p.d) && /Disponible cuando la factura esté emitida/.test(p.d.querySelector('#vistaAdic .fa-nc')?.textContent ?? '') && !boton(p.d, 'nueva')); p.dom.window.close();
  p = await pantalla(FACTURADOR, [FACT()], [NC({ estado: 'EMITIDA', cod_ref: 1, monto: 50000, of_folio: '111773', doc_estado: 'OBTENIDOS', cobranza_estado: 'NO_APLICA' })]);
  res('6.3 NC de anulación emitida: "Factura anulada", saldo $0, PDF/XML y botón nueva deshabilitado', /Factura anulada con nota de crédito/.test(caja(p.d).textContent)
      && /Saldo no anulado\s*\$0/.test(caja(p.d).textContent) && !!boton(p.d, 'pdf') && boton(p.d, 'nueva').disabled === true); p.dom.window.close();
  p = await pantalla(FACTURADOR, [FACT({ modo: 'PRODUCCION' })], [NC({ modo: 'PRODUCCION', estado: 'APROBADA' })]);
  res('6.4 NC real con la emisión real apagada: "Emitir nota de crédito real" deshabilitado; franja roja del detalle REAL', boton(p.d, 'emitir')?.disabled === true && /real/.test(boton(p.d, 'emitir').textContent)
      && p.d.body.classList.contains('fa-franja-real')); p.dom.window.close();
  // Emisión real habilitada: misma confirmación que "Emitir factura real" (REAL + monto reescrito)
  for (const [pal, monto, llama] of [['', '10.000', false], ['real', '9.999', false], ['REAL', '10.000', true]] as [string, string, boolean][]) {
    const q = await pantalla(FACTURADOR, [FACT({ modo: 'PRODUCCION' })], [NC({ modo: 'PRODUCCION', estado: 'APROBADA' })], SALDO0, 'https://gestoor.contadoor.cl/facturacion/index.html?tab=adicional&fa=9', true);
    boton(q.d, 'emitir').click(); await espera(80);
    const btn = q.d.querySelector('#mFoot [data-m="si"]');
    q.d.getElementById('faRealPal').value = pal; q.d.getElementById('faRealTot').value = monto; btn.click(); await espera(150);
    res(`6.4b NC REAL · palabra "${pal}" y monto "${monto}" → ${llama ? 'emite (nc_emitir)' : 'no emite'}; botón rojo`, /fa-btn-real/.test(btn.className) && (llama ? q.w.__edge.length === 1 && q.w.__edge[0].body.accion === 'nc_emitir' : q.w.__edge.length === 0), q.w.__edge);
    q.dom.window.close();
  }
  p = await pantalla(FACTURADOR, [FACT({ modo: 'PRODUCCION' })], []);
  boton(p.d, 'nueva').click(); await espera(150);
  res('6.4c crear NC sobre factura REAL: aviso rojo "Nota de crédito REAL" y botón rojo', /Nota de crédito REAL/.test(p.d.getElementById('mBody').textContent) && /fa-btn-real/.test(p.d.querySelector('#mFoot [data-m="si"]').className)); p.dom.window.close();
  p = await pantalla(MASTER, [FACT()], [NC({ estado: 'EMITIDA', of_folio: '111774', cobranza_estado: 'REQUIERE_REVISION', cobranza_detalle: { motivo: 'DOCUMENTO_NO_AJUSTABLE: x' } })]);
  res('6.5 Cobranza por revisar: aviso y botón "Reintentar Cobranza" para el Master', /Cobranza por revisar a mano/.test(caja(p.d).textContent) && !!boton(p.d, 'cobranza')); p.dom.window.close();
  p = await pantalla(MASTER, [FACT()], [NC()], SALDO0, 'https://gestoor.contadoor.cl/facturacion/index.html?tab=adicional&fa=9&nc=4');
  await espera(150);
  const fila = p.d.querySelector('[data-nc-fila="4"]');
  res('6.6 enlace del aviso (?fa=9&nc=4) resalta la NC', !!fila && /solid/.test(fila.style.outline), fila?.style.outline); p.dom.window.close();
}
console.log(`\nF1e · notas de crédito en pantalla: ${ok}/${ok + mal}`);
Deno.exit(mal ? 1 : 0);
