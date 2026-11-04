// Facturación · F1a-DOC/CORREO (Ver PDF, estado SII, correo del grupo emitido) · prueba LOCAL con mocks (no toca Supabase ni producción).
// Carga facturacion/index.html en jsdom con supabase.js simulado (datos FICTICIOS) y la Edge simulada. Sin red.
// Uso: deno run --no-prompt --allow-read --allow-env --allow-sys pruebas/facturacion_doc_correo_test.ts
import { JSDOM } from 'npm:jsdom@24.1.0';
const RAIZ = new URL('../', import.meta.url);
const leer = (p: string) => Deno.readTextFileSync(new URL(p, RAIZ));
let ok = 0, mal = 0;
const res = (n: string, b: boolean, d: unknown = '') => { if (b) { ok++; console.log('OK  ', n); } else { mal++; console.log('MAL ', n, JSON.stringify(d)); } };
const LOTE_R = { id: 3, periodo: '2026-10', tipo: 'FIJO', modo: 'PRODUCCION', estado: 'EMITIDO', fecha_emision: '2026-11-01', fecha_vencimiento: '2026-11-21', uf_fecha: '2026-11-01', uf_valor: 39643.59, totales: { n_lineas: 3, n_listas: 3, monto_listas: 149970 } };
const LOTE_P = { ...LOTE_R, id: 2, modo: 'PRUEBA' };
const lin = (id: number, folio: string, doc: string, correo: string, extra: Record<string, unknown> = {}) => ({ id, lote_id: 3, cliente_id: id, cliente_rut: '7610000' + id + '-1', razon_social: 'Cliente Ficticio ' + id + ' SpA',
  plan: 'cumplimiento', moneda: 'CLP', monto_base: 49990, valor_por_trab: 0, total_clp: 49990, estado: 'EMITIDA', motivos: [], alertas: [], tipo_lote: 'FIJO', modo: 'PRODUCCION',
  of_folio: folio, doc_estado: doc, correo_estado: correo, correo_intentos: 0, snapshot: { correo_destino: 'navegador' + id + '@no-usar.cl' }, ...extra });
type Op = { pruebaInc?: boolean; previaFalta?: boolean; envio?: boolean; sinMigracion?: boolean; master?: boolean; siiRaro?: boolean; falla500?: boolean; tanda?: string; previa?: any; incierta?: boolean; error404?: boolean };
const PREVIA = { lote_id: 3, huella: 'h'.repeat(64), elegibles: 1, lineas: [
  { linea_id: 296, folio: '16500', total: 49990, destino: 'pagos296@servidor-autorizado.cl', sii: 'OK', elegible: true, motivo: null },
  { linea_id: 297, folio: '16501', total: 49990, destino: 'pagos297@servidor-autorizado.cl', sii: 'SII_REPAROS_REVISION:REGLA_NO_DEFINIDA', elegible: false, motivo: 'SII_REPAROS_REVISION:REGLA_NO_DEFINIDA' },
  { linea_id: 298, folio: '16502', total: 49990, destino: 'pagos298@servidor-autorizado.cl', sii: 'SII_NO_ACEPTADO:PENDIENTE', elegible: false, motivo: 'SII_NO_ACEPTADO:PENDIENTE' }] };
function pagina(o: Op) {
  const MOCK = `var SB_URL='http://mock';var _gestoorAccessToken='x';window.__gets=[];window.__edge=[];window.__abiertas=[];window.__rpc=[];
document.documentElement.classList.remove('auth-pending');
function sbH(){return {'Content-Type':'application/json',Authorization:'Bearer jwt-ficticio'};}
function resp(o,st){return Promise.resolve(new Response(JSON.stringify(o),{status:st||200,headers:{'Content-Type':'application/json'}}));}
function sbFetch(path,init){
  window.__rpc.push({path:path,body:init&&init.body?JSON.parse(init.body):null});
  if(path.indexOf('rpc/facturacion_correo_fijar')===0){window.__fijar=JSON.parse(init.body);return resp({ok:true});}
  if(path.indexOf('rpc/facturacion_correo_prueba_resolver')===0){window.__resolverP=JSON.parse(init.body);return resp({ok:true});}
  if(path.indexOf('rpc/facturacion_correo_resolver')===0){window.__resolver=JSON.parse(init.body);return resp({ok:true});}
  if(path.indexOf('rpc/facturacion_correo_previa')===0)return ${o.sinMigracion || o.previaFalta ? "resp({code:'PGRST202',message:'Could not find the function'},404)" : `resp(${JSON.stringify(o.previa ?? PREVIA)})`};
  if(path.indexOf('rpc/facturacion_yo')===0)return resp({usuario_id:1,es_master:${!!o.master},puede_preparar:true,puede_emitir:true,puede_aprobar:${!!o.master},puede_leer:true});
  return resp([]);
}
function sbGet(path){
  window.__gets.push(path);
  if(path.indexOf('periodos')===0)return Promise.resolve([{periodo:'2026-10',uf:39643.59},{periodo:'2026-09',uf:39400}]);
  if(path.indexOf('facturacion_lotes')===0){
    if(path.indexOf('periodo=eq.2026-09')>0)return Promise.resolve(path.indexOf('modo=eq.PRUEBA')>0?[${JSON.stringify({ ...LOTE_P, id: 9, periodo: '2026-09' })}]:[]);
    return Promise.resolve(path.indexOf('modo=eq.PRODUCCION')>0?[${JSON.stringify(LOTE_R)}]:path.indexOf('modo=eq.PRUEBA')>0?[${JSON.stringify(LOTE_P)}]:[]);
  }
  if(path.indexOf('facturacion?')===0&&path.indexOf('lote_id=eq.3')>0)return Promise.resolve([${JSON.stringify(lin(296, '16500', 'OBTENIDOS', 'PENDIENTE'))},${JSON.stringify(o.incierta ? lin(297, '16501', 'OBTENIDOS', 'FALLIDO', { correo_error: 'INCIERTO: GRAPH_503' }) : lin(297, '16501', 'OBTENIDOS', 'PENDIENTE'))},${JSON.stringify(lin(298, '16502', 'PENDIENTE', 'PENDIENTE'))}]);
  if(path.indexOf('facturacion_consultas_proveedor')===0)return ${o.sinMigracion ? "Promise.reject(Object.assign(new Error('x'),{fx:{status:404,code:'42P01',message:'relation \"public.facturacion_consultas_proveedor\" does not exist'}}))"
    : o.falla500 ? "Promise.reject(Object.assign(new Error('x'),{fx:{status:500,message:'timeout de base'}}))"
    : o.error404 ? "Promise.reject(Object.assign(new Error('x'),{fx:{status:404,message:'Not Found (proxy)'}}))"
    : `Promise.resolve([{linea_id:296,tipo:'ESTADO_SII',creado_at:'2026-11-03T15:00:00Z',resumen:{estado:'ACEPTADO',texto_estado:'Aceptado'}},{linea_id:297,tipo:'ESTADO_SII',creado_at:'2026-11-03T15:00:00Z',resumen:{estado:'ACEPTADO_CON_REPAROS',texto_estado:'Aceptado con Reparo',reparos:['FCH-EMIS: fecha']}}${o.siiRaro ? ",{linea_id:298,tipo:'ESTADO_SII',creado_at:'2026-11-03T15:00:00Z',resumen:{estado:'ESTADO_NUEVO_RARO'}}" : ''}])`};
  if(path.indexOf('facturacion_correo_pruebas')===0)return Promise.resolve(${o.pruebaInc ? "[{id:901,linea_id:296,estado:'INCIERTA',reclamado_at:'2026-11-03T15:00:00Z',resuelto_at:null}]" : '[]'});
  if(path.indexOf('facturacion_parametros')===0)return Promise.resolve([${o.sinMigracion ? '{id:1,produccion_habilitada:false}' : `{id:1,correo_envio_habilitado:${!!o.envio},correo_auto_habilitado:false}`}]);
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
async function abrir(o: Op = {}) {
  const dom = new JSDOM(pagina(o), { runScripts: 'dangerously', url: 'https://gestoor.contadoor.cl/facturacion/index.html', pretendToBeVisual: true,
    beforeParse(w: any) {
      w.Response = Response;
      w.fetch = (url: string, init: any) => {
        const body = JSON.parse(init.body); w.__edge.push({ url, headers: init.headers, body });
        if (body.accion === 'correo_lote') {
          if (o.tanda === 'DETENIDA') return Promise.resolve(new Response(JSON.stringify({ procesadas: [], exitosas: 0, quedan: 1, detenida: 'PREVIA_CAMBIO', resultado: 'DETENIDA', ultimo_id: 0 }), { status: 200 }));
          const nV = w.__edge.filter((x: any) => x.body.accion === 'correo_lote').length;
          if (o.tanda === 'SIEMPRE_PARCIAL') return Promise.resolve(new Response(JSON.stringify({ procesadas: [{ linea: 296 + nV, correo: 'ENVIADO' }], exitosas: 1, quedan: 999, resultado: 'PARCIAL', ultimo_id: body.desde_id + 1 }), { status: 200 }));
          if (o.tanda === 'PARCIAL_SIN_AVANCE') return Promise.resolve(new Response(JSON.stringify({ procesadas: [{ linea: 296, correo: 'ENVIADO' }], exitosas: 1, quedan: 4, resultado: 'PARCIAL', ultimo_id: body.desde_id }), { status: 200 }));
          if (o.tanda === 'RARO') return Promise.resolve(new Response(JSON.stringify({ procesadas: [{ linea: 296, correo: 'ENVIADO' }], exitosas: 1, quedan: 0, resultado: 'NUEVO_RARO', ultimo_id: 296 }), { status: 200 }));
          if (o.tanda === 'ERRORES') return Promise.resolve(new Response(JSON.stringify(nV === 1
            ? { procesadas: [{ linea: 296, correo: 'ENVIADO' }, { linea: 297, correo: 'FALLIDO', codigo: 'GRAPH_400' }], exitosas: 1, quedan: 1, resultado: 'PARCIAL', ultimo_id: 297 }
            : { procesadas: [{ linea: 298, correo: 'ENVIADO' }], exitosas: 1, quedan: 0, resultado: 'COMPLETA', ultimo_id: 298 }), { status: 200 }));
          if (o.tanda === 'VUELTAS') {   // 3 vueltas de 2: PARCIAL, PARCIAL, COMPLETA (con cursor)
            const n = w.__edge.filter((x: any) => x.body.accion === 'correo_lote').length;
            const ids = body.lineas_autorizadas.filter((id: number) => id > body.desde_id).slice(0, 2);
            const quedan = body.lineas_autorizadas.filter((id: number) => id > body.desde_id).length - ids.length;
            return Promise.resolve(new Response(JSON.stringify({ procesadas: ids.map((id: number) => ({ linea: id, correo: 'ENVIADO' })), exitosas: ids.length, quedan, ultimo_id: ids.at(-1),
              resultado: quedan ? 'PARCIAL' : 'COMPLETA', huella: 'NO-USAR-' + n }), { status: 200 }));
          }
          return Promise.resolve(new Response(JSON.stringify({ procesadas: [{ linea: 296, correo: 'ENVIADO' }], exitosas: 1, quedan: 0, resultado: 'COMPLETA', ultimo_id: 296 }), { status: 200 }));
        }
        if (body.accion === 'documentos_lote') return Promise.resolve(new Response(JSON.stringify({ procesadas: [{ linea: 298, documentos: 'ERROR', codigo: 'PDF_NO_DISPONIBLE' }], exitosas: 0, quedan: 0, resultado: 'SIN_AVANCE', ultimo_id: 298 }), { status: 200 }));
        return Promise.resolve(new Response(JSON.stringify({ tipo: 'pdf', nombre: 'Factura-34-16500.pdf', b64: btoa('%PDF-1.4 ficticio'), sha256: 'a'.repeat(64) }), { status: 200 }));
      };
      w.open = () => { const v = { document: { title: '', body: { innerHTML: '' } }, location: { href: '' }, close() {} }; w.__abiertas.push(v); return v; };
      w.URL.createObjectURL = () => 'blob:ficticio'; w.URL.revokeObjectURL = () => {};
      w.HTMLElement.prototype.scrollIntoView = function () {};
    } });
  await espera(350);
  return dom;
}
const si = async (d: any) => { d.querySelector('#mFoot [data-m="si"]').click(); await espera(150); };

let dom: any = await abrir();
let w = dom.window, d = w.document;
res('1 grupo REAL primero: selector Real/Prueba y etiqueta "FACTURAS REALES · SII"',
  !d.getElementById('fxModoSel').hidden && d.querySelector('[data-modo="PRODUCCION"]').classList.contains('on') && /FACTURAS REALES/.test(d.getElementById('fxModoTag').textContent));
res('2 [FE-06] una consulta de grupos POR MODO (un grupo de prueba nunca desplaza al real)', w.__gets.filter((g: string) => g.startsWith('facturacion_lotes')).every((g: string) => /modo=eq\.(PRODUCCION|PRUEBA)/.test(g))
  && w.__gets.filter((g: string) => g.startsWith('facturacion_lotes')).length === 2);
const docs = d.getElementById('fxDocs');
res('3 [FE-07] resumen separa aceptadas SIN reparos (1) de con reparos (1, en revisión manual) y envío real APAGADO', /Aceptadas por el SII \(sin reparos\)\s*1 de 3/.test(docs.textContent)
  && /1 con reparos \(1 en revisión manual\)/.test(docs.textContent) && /Envío real APAGADO/.test(docs.textContent), docs.textContent.slice(0, 400));
res('4 envío apagado → "Enviar correos del grupo" deshabilitado', d.querySelector('[data-act="tanda-correo"]').disabled === true);
res('5 fila con reparo en revisión: etiqueta "Revisión manual (reparo)" (decisión de Luciano)', /Revisión manual \(reparo\)/.test(d.querySelector('#tbody tr[data-id="297"]').textContent));
d.querySelector('#tbody [data-act="ver-pdf"]').click(); await espera(80);
const e0 = w.__edge[0];
res('6 Ver PDF → Edge ver_documento con el JWT; nunca el bucket', e0 && e0.body.accion === 'ver_documento' && e0.body.linea_id === 296 && e0.headers.Authorization === 'Bearer jwt-ficticio'
  && w.__abiertas[0]?.location.href === 'blob:ficticio' && !w.__gets.some((g: string) => /storage/.test(g)));
dom.window.close();

dom = await abrir({ envio: true, master: true }); w = dom.window; d = w.document;
res('7 [FE-11] el contador del botón sale de la previa del SERVIDOR (1 elegible), no del navegador', /Enviar correos del grupo \(1\)/.test(d.getElementById('fxDocs').textContent));
d.querySelector('[data-act="tanda-correo"]').click(); await espera(150);
const mb = d.getElementById('mBody').textContent;
res('8 [FE-12] el modal masivo muestra los destinatarios AUTORIZADOS POR EL SERVIDOR (no los del navegador) y los motivos de lo que no sale',
  /pagos296@servidor-autorizado\.cl/.test(mb) && !/no-usar\.cl/.test(mb) && /revisión manual/.test(mb) && /aún no acepta/.test(mb), mb.slice(0, 500));
await si(d);
res('9 real: sin escribir ENVIAR no envía', w.__edge.filter((x: any) => x.body.accion === 'correo_lote').length === 0 && !d.getElementById('mErr').hidden);
d.getElementById('mConf').value = 'enviar'; await si(d); await espera(200);
const lote = w.__edge.find((x: any) => x.body.accion === 'correo_lote');
res('10 [FE-11/13] el envío masivo lleva la huella del servidor y SOLO las líneas confirmadas', lote && lote.body.huella === 'h'.repeat(64) && JSON.stringify(lote.body.lineas_autorizadas) === '[296]', lote?.body);
res('11 [FE-03] tanda COMPLETA informada como tal', /Correos completa: todas las recorridas quedaron listas \(1 de 1 recorrida\(s\) listas\)/.test(d.getElementById('toast').textContent), d.getElementById('toast').textContent);
dom.window.close();

dom = await abrir({ envio: true, master: true, tanda: 'DETENIDA' }); w = dom.window; d = w.document;
d.querySelector('[data-act="tanda-correo"]').click(); await espera(150); d.getElementById('mConf').value = 'ENVIAR'; await si(d); await espera(200);
res('12 [FE-13] tanda DETENIDA por cambio de la lista → mensaje con el motivo, sin reintentar', /detenida/.test(d.getElementById('toast').textContent) && /La lista cambió/.test(d.getElementById('toast').textContent)
  && w.__edge.filter((x: any) => x.body.accion === 'correo_lote').length === 1, d.getElementById('toast').textContent);
d.querySelector('[data-act="tanda-docs"]').click(); await espera(250);
res('13 [FE-03] tanda SIN_AVANCE de documentos → "sin avance" y aviso por factura', /sin avance/.test(d.getElementById('toast').textContent) && /1 con aviso/.test(d.getElementById('toast').textContent), d.getElementById('toast').textContent);
dom.window.close();

dom = await abrir({ siiRaro: true }); w = dom.window; d = w.document;
res('14 [FE-01] un estado SII desconocido no rompe la pantalla (se muestra "SII: ESTADO_NUEVO_RARO")', d.querySelectorAll('#tbody tr[data-id]').length === 3
  && /SII: ESTADO_NUEVO_RARO/.test(d.querySelector('#tbody tr[data-id="298"]').textContent));
dom.window.close();

dom = await abrir({ falla500: true }); w = dom.window; d = w.document;
res('15 [FE-04] un error real (500) se MUESTRA en la tarjeta (no se silencia)', /No se pudo leer el estado de documentos y correo/.test(d.getElementById('fxDocs').textContent));
dom.window.close();

dom = await abrir({ sinMigracion: true }); w = dom.window; d = w.document;
res('16 sin la migración instalada la pantalla no se rompe ni muestra error: "Correo: por instalar"', /Correo: por instalar/.test(d.getElementById('fxDocs').textContent)
  && !/No se pudo leer/.test(d.getElementById('fxDocs').textContent) && d.querySelectorAll('#tbody tr[data-id]').length === 3);
dom.window.close();

dom = await abrir({ master: true }); w = dom.window; d = w.document;
d.querySelector('[data-modo="PRUEBA"]').click(); await espera(200);
const prueba1 = d.querySelector('[data-modo="PRUEBA"]').classList.contains('on');
const sel = d.getElementById('selPeriodo'); sel.value = '2026-09'; sel.dispatchEvent(new w.Event('change')); await espera(200);
sel.value = '2026-10'; sel.dispatchEvent(new w.Event('change')); await espera(200);
res('17 [FE-14] el selector respeta la elección dentro del período y vuelve al grupo REAL al cambiar de período', prueba1 && d.querySelector('[data-modo="PRODUCCION"]').classList.contains('on'));
// Resolver correo incierto con evidencia tipificada
d.querySelector('[data-act="config-correo"]').click(); await espera(80);
res('18 [FE-09/A5] "Configurar correo" explica la autorización formal y que el automático actúa cuando el SII acepta (no "justo después de emitir")',
  /autorización formal/.test(d.getElementById('mBody').textContent) && /cuando el SII acepte la factura y pase los controles/.test(d.getElementById('mBody').textContent)
  && !/justo después de emitir/.test(d.documentElement.innerHTML));
d.getElementById('mEnv').checked = true; d.getElementById('mRef').value = 'GO de prueba local'; await si(d);
res('19 fijar con exactamente {p_envio, p_auto, p_referencia}', JSON.stringify(Object.keys(w.__fijar || {}).sort()) === JSON.stringify(['p_auto', 'p_envio', 'p_referencia']) && w.__fijar.p_envio === true);
dom.window.close();

dom = await abrir({ master: true, incierta: true }); w = dom.window; d = w.document;
d.querySelector('#tbody [data-act="resolver-correo"][data-id="297"]').click(); await espera(80);
res('20 [FE-10] el modal de resolver advierte que la ausencia en Enviados no prueba nada', /NO prueba que no salió/.test(d.getElementById('mBody').textContent));
d.querySelector('input[name="mRes"][value="NO_ENVIADO"]').checked = true; d.getElementById('mEvT').value = 'ENVIADOS_BUZON';
d.getElementById('mEvR').value = 'buzon-123'; d.getElementById('mMotR').value = 'No lo encontré en Enviados'; await si(d);
res('21 [FE-10] "no salió" con solo "Enviados" se rechaza en pantalla (no llama al servidor)', !w.__resolver && /traza de mensajes de Exchange/.test(d.getElementById('mErr').textContent));
d.getElementById('mEvT').value = 'TRAZA_EXCHANGE'; d.getElementById('mEvR').value = 'trace-77aa'; await si(d);
res('22 con la traza de Exchange: resolver recibe tipo y referencia de evidencia', w.__resolver?.p_evidencia_tipo === 'TRAZA_EXCHANGE' && w.__resolver?.p_evidencia_ref === 'trace-77aa' && w.__resolver?.p_resultado === 'NO_ENVIADO', w.__resolver);
d.querySelector('#tbody tr[data-id="296"] td.cli').click(); await espera(80);
d.querySelector('#drBody [data-act="prueba-linea"]').click(); await espera(80);
res('23 [FE-15] el correo de prueba (Master) declara que va SOLO a info@contadoor.cl', /solo a info@contadoor\.cl/.test(d.getElementById('mBody').textContent));
dom.window.close();

// ── R12-04: vueltas con cursor y lista cerrada ──
const MUCHAS = { lote_id: 3, huella: 'h'.repeat(64), elegibles: 250, lineas: Array.from({ length: 250 }, (_, i) => ({ linea_id: 1000 + i, folio: String(17000 + i), total: 1000, destino: `d${i}@servidor.cl`, sii: 'OK', elegible: true, motivo: null })) };
dom = await abrir({ envio: true, master: true, previa: MUCHAS }); w = dom.window; d = w.document;
d.querySelector('[data-act="tanda-correo"]').click(); await espera(150);
res('24 [A5-02] con 250 elegibles el modal lista LAS 250 (nada se confirma sin haberse mostrado)', d.querySelectorAll('#mBody tbody tr').length === 250 && /d249@servidor\.cl/.test(d.getElementById('mBody').textContent));
dom.window.close();
const TRES = { lote_id: 3, huella: 'h'.repeat(64), elegibles: 5, lineas: [296, 297, 298, 299, 300].map((id) => ({ linea_id: id, folio: String(id), total: 1000, destino: `p${id}@servidor.cl`, sii: 'OK', elegible: true, motivo: null })) };
dom = await abrir({ envio: true, master: true, previa: TRES, tanda: 'VUELTAS' }); w = dom.window; d = w.document;
d.querySelector('[data-act="tanda-correo"]').click(); await espera(150); d.getElementById('mConf').value = 'ENVIAR'; await si(d); await espera(400);
const vueltas = w.__edge.filter((x: any) => x.body.accion === 'correo_lote').map((x: any) => x.body);
res('25 [R12-04/A5-01/A5-03] 3 vueltas: el cursor avanza (0 → 297 → 299), la huella y el conjunto son los MISMOS en todas (no se reemplazan)',
  JSON.stringify(vueltas.map((b: any) => b.desde_id)) === '[0,297,299]' && vueltas.every((b: any) => b.huella === 'h'.repeat(64) && JSON.stringify(b.lineas_autorizadas) === '[296,297,298,299,300]')
  && /completa: todas las recorridas quedaron listas \(5 de 5/.test(d.getElementById('toast').textContent), { vueltas, toast: d.getElementById('toast').textContent });
dom.window.close();
dom = await abrir({ error404: true }); w = dom.window; d = w.document;
res('26 [A5-04] un 404 GENÉRICO (proxy) no se confunde con "no instalado": se muestra el error', /No se pudo leer el estado de documentos y correo/.test(d.getElementById('fxDocs').textContent));
dom.window.close();

// ── R12.1 C03: recorrido terminado ≠ objetivo cumplido ──
const corre = async (op: Op) => {
  const dm = await abrir({ envio: true, master: true, previa: TRES, ...op }); const dd = dm.window.document;
  dd.querySelector('[data-act="tanda-correo"]').click(); await espera(150); dd.getElementById('mConf').value = 'ENVIAR'; await si(dd); await espera(900);
  const t = dd.getElementById('toast').textContent, n = dm.window.__edge.filter((x: any) => x.body.accion === 'correo_lote').length; dm.window.close(); return { t, n };
};
let k = await corre({ tanda: 'SIEMPRE_PARCIAL' });
res('27 [C03] límite de vueltas (60) con ok === proc y PARCIAL → "NO terminó el recorrido" (nunca "completa") y quedan por recorrer',
  k.n === 60 && /NO terminó el recorrido/.test(k.t) && !/completa/.test(k.t) && /\(60 de 60/.test(k.t) && /Quedan 999 por recorrer/.test(k.t), k);
k = await corre({ tanda: 'PARCIAL_SIN_AVANCE' });
res('28 [C03] PARCIAL sin avance del cursor (interrupción) con 1 de 1 OK → "NO terminó" (no "completa"); no se repite la vuelta', k.n === 1 && /NO terminó el recorrido/.test(k.t) && !/completa/.test(k.t), k);
k = await corre({ tanda: 'RARO' });
res('29 [C03] resultado DESCONOCIDO de la Edge → falla cerrada: "NO terminó" (no "completa")', /NO terminó el recorrido/.test(k.t) && !/completa/.test(k.t), k);
k = await corre({ tanda: 'ERRORES' });
res('30 [C03/C07] errores individuales: recorrido terminado CON AVISOS (2 de 3), no "completa"; el 4xx explica que las tandas no lo reintentan',
  k.n === 2 && /recorrido terminado con avisos/.test(k.t) && /\(2 de 3/.test(k.t) && !/completa/.test(k.t), k);
dom = await abrir({ master: true }); w = dom.window;
const ft = (r: any, ok: number, pr: number) => w.FX_DOC.finTanda(r, ok, pr);
res('31 [C03] finTanda (pura): PARCIAL/quedan>0/desconocido → INCOMPLETA aunque ok===proc; DETENIDA; COMPLETA solo terminado y todo OK; 0 → SIN_PENDIENTES',
  ft({ resultado: 'PARCIAL', quedan: 3 }, 5, 5) === 'INCOMPLETA' && ft({ resultado: 'COMPLETA', quedan: 2 }, 5, 5) === 'INCOMPLETA' && ft({ resultado: 'X' }, 1, 1) === 'INCOMPLETA'
  && ft(null, 0, 0) === 'INCOMPLETA' && ft({ resultado: 'DETENIDA' }, 5, 5) === 'DETENIDA' && ft({ resultado: 'COMPLETA', quedan: 0 }, 5, 5) === 'COMPLETA'
  && ft({ resultado: 'CON_AVISOS', quedan: 0 }, 3, 5) === 'CON_AVISOS' && ft({ resultado: 'SIN_AVANCE', quedan: 0 }, 0, 5) === 'SIN_AVANCE' && ft({ resultado: 'COMPLETA', quedan: 0 }, 0, 0) === 'SIN_PENDIENTES');
res('32 [C07] textos: 4xx "las tandas y el automático NO lo reintentan" + máximo 3; 429 ya reintentado una vez; cancelado no cuenta como intento',
  /NO lo reintentan/.test(w.FX_DOC.txtDoc('GRAPH_400')) && /máximo 3/.test(w.FX_DOC.txtDoc('GRAPH_418')) && !/Se puede reintentar\.$/.test(w.FX_DOC.txtDoc('GRAPH_418'))
  && /Ya se reintentó una vez/.test(w.FX_DOC.txtDoc('GRAPH_429')) && /no cuenta como intento/.test(w.FX_DOC.txtDoc('CANCELADO_ANTES_DE_ENVIAR')) && /3 envíos rechazados/.test(w.FX_DOC.txtDoc('CORREO_MAX_INTENTOS')));
dom.window.close();
// ── R12.1 C01: prueba incierta en pantalla ──
dom = await abrir({ master: true, pruebaInc: true }); w = dom.window; d = w.document;
d.querySelector('#tbody tr[data-id="296"] td.cli').click(); await espera(80);
const bP = d.querySelector('#drBody [data-act="prueba-linea"]'), bR = d.querySelector('#drBody [data-act="resolver-prueba"]');
res('33 [C01] con una prueba INCIERTA sin resolver: "Prueba a info@" deshabilitado (explica por qué) y aparece "Resolver prueba incierta" (Master)',
  bP?.disabled === true && /quedó incierta/.test(bP?.getAttribute('title') || bP?.closest('[title]')?.getAttribute('title') || d.getElementById('drBody').innerHTML) && !!bR);
bR.click(); await espera(80);
d.querySelector('input[name="mResP"][value="NO_LLEGO"]').checked = true; d.getElementById('mEvTP').value = 'BUZON_INFO'; d.getElementById('mEvRP').value = 'msg-123456'; d.getElementById('mMotP').value = 'no está en la bandeja de info@'; await si(d);
res('34 [C01] "no llegó" con solo la bandeja se rechaza en pantalla (no llama al servidor)', !w.__resolverP && /traza de mensajes de Exchange/.test(d.getElementById('mErr').textContent));
d.getElementById('mEvTP').value = 'TRAZA_EXCHANGE'; await si(d);
res('35 [C01] con la traza: facturacion_correo_prueba_resolver recibe la prueba, resultado y evidencia', w.__resolverP?.p_prueba === 901 && w.__resolverP?.p_resultado === 'NO_LLEGO'
  && w.__resolverP?.p_evidencia_tipo === 'TRAZA_EXCHANGE' && w.__resolverP?.p_evidencia_ref === 'msg-123456', w.__resolverP);
dom.window.close();
dom = await abrir({ envio: true, master: true, previaFalta: true }); w = dom.window; d = w.document;
res('36 [A8-04] instalación INCOMPLETA (tablas sí, función previa no) → aviso de falla cerrada y "Enviar correos del grupo" deshabilitado',
  /instalación de documentos y correo está INCOMPLETA/.test(d.getElementById('fxDocs').textContent) && d.querySelector('[data-act="tanda-correo"]').disabled === true, d.getElementById('fxDocs').textContent.slice(0, 300));
dom.window.close();

console.log(`\nFacturación · documentos y correo: ${ok}/${ok + mal}`);
Deno.exit(mal ? 1 : 0);
