// Facturación · F1a-DOC/CORREO (Ver PDF, estado SII, correo del grupo emitido) · prueba LOCAL con mocks (no toca Supabase ni producción).
// Carga facturacion/index.html en jsdom con supabase.js simulado (datos FICTICIOS) y la Edge simulada; verifica el selector Real/Prueba,
// el resumen de documentos y correo, que "Ver PDF" pase por la Edge con el JWT (nunca por el bucket) y que el envío respete el interruptor.
// Uso: deno run --allow-read --allow-env --allow-sys --allow-net=registry.npmjs.org pruebas/facturacion_doc_correo_test.ts
import { JSDOM } from 'npm:jsdom@24.1.0';
const RAIZ = new URL('../', import.meta.url);
const leer = (p: string) => Deno.readTextFileSync(new URL(p, RAIZ));
let ok = 0, mal = 0;
const res = (n: string, b: boolean, d: unknown = '') => { if (b) { ok++; console.log('OK  ', n); } else { mal++; console.log('MAL ', n, JSON.stringify(d)); } };
const LOTE_R = { id: 3, periodo: '2026-10', tipo: 'FIJO', modo: 'PRODUCCION', estado: 'EMITIDO', fecha_emision: '2026-11-01', fecha_vencimiento: '2026-11-21', uf_fecha: '2026-11-01', uf_valor: 39643.59, totales: { n_lineas: 2, n_listas: 2, monto_listas: 99980 } };
const LOTE_P = { ...LOTE_R, id: 2, modo: 'PRUEBA' };
const lin = (id: number, folio: string, doc: string, correo: string, extra: Record<string, unknown> = {}) => ({ id, lote_id: 3, cliente_id: id, cliente_rut: '7610000' + id + '-1', razon_social: 'Cliente Ficticio ' + id + ' SpA',
  plan: 'cumplimiento', moneda: 'CLP', monto_base: 49990, valor_por_trab: 0, total_clp: 49990, estado: 'EMITIDA', motivos: [], alertas: [], tipo_lote: 'FIJO', modo: 'PRODUCCION',
  of_folio: folio, doc_estado: doc, correo_estado: correo, correo_intentos: 0, snapshot: { correo_destino: 'pagos' + id + '@cliente-ficticio.cl' }, ...extra });
function pagina(o: { envio?: boolean; sinMigracion?: boolean; master?: boolean }) {
  const MOCK = `var SB_URL='http://mock';var _gestoorAccessToken='x';window.__gets=[];window.__edge=[];window.__abiertas=[];
document.documentElement.classList.remove('auth-pending');
function sbH(){return {'Content-Type':'application/json',Authorization:'Bearer jwt-ficticio'};}
function resp(o,st){return Promise.resolve(new Response(JSON.stringify(o),{status:st||200,headers:{'Content-Type':'application/json'}}));}
function sbFetch(path){
  if(path.indexOf('rpc/facturacion_yo')===0)return resp({usuario_id:1,es_master:${!!o.master},puede_preparar:true,puede_emitir:true,puede_aprobar:${!!o.master},puede_leer:true});
  return resp([]);
}
function sbGet(path){
  window.__gets.push(path);
  if(path.indexOf('periodos')===0)return Promise.resolve([{periodo:'2026-10',uf:39643.59}]);
  if(path.indexOf('facturacion_lotes')===0)return Promise.resolve([${JSON.stringify(LOTE_R)},${JSON.stringify(LOTE_P)}]);
  if(path.indexOf('facturacion?')===0&&path.indexOf('lote_id=eq.3')>0)return Promise.resolve([${JSON.stringify(lin(296, '16500', 'OBTENIDOS', 'PENDIENTE'))},${JSON.stringify(lin(297, '16501', 'PENDIENTE', 'PENDIENTE'))}]);
  if(path.indexOf('facturacion_consultas_proveedor')===0)return ${o.sinMigracion ? "Promise.reject(new Error('404 relation does not exist'))" : "Promise.resolve([{linea_id:296,tipo:'ESTADO_SII',creado_at:'2026-11-03T15:00:00Z',resumen:{estado:'ACEPTADO_CON_REPAROS',texto_estado:'Aceptado con Reparo',reparos:['FCH: fecha']}}])"};
  if(path.indexOf('facturacion_parametros')===0)return Promise.resolve([${o.sinMigracion ? '{id:1,produccion_habilitada:false}' : `{id:1,correo_envio_habilitado:${!!o.envio},correo_auto_habilitado:false,correo_firma_usuario_id:5}`}]);
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
async function abrir(o: { envio?: boolean; sinMigracion?: boolean; master?: boolean } = {}) {
  const dom = new JSDOM(pagina(o), { runScripts: 'dangerously', url: 'https://gestoor.contadoor.cl/facturacion/index.html', pretendToBeVisual: true,
    beforeParse(w: any) {
      w.Response = Response;
      w.fetch = (url: string, init: any) => { w.__edge.push({ url, headers: init.headers, body: JSON.parse(init.body) });
        return Promise.resolve(new Response(JSON.stringify({ tipo: 'pdf', nombre: 'Factura-34-16500.pdf', b64: btoa('%PDF-1.4 ficticio'), sha256: 'a'.repeat(64) }), { status: 200 })); };
      w.open = () => { const v = { document: { title: '', body: { innerHTML: '' } }, location: { href: '' }, close() {} }; w.__abiertas.push(v); return v; };
      w.URL.createObjectURL = () => 'blob:ficticio'; w.URL.revokeObjectURL = () => {};
      w.HTMLElement.prototype.scrollIntoView = function () {};
    } });
  await espera(350);
  return dom;
}

let dom: any = await abrir();
let w = dom.window, d = w.document;
res('1 con un grupo REAL del período se muestra primero: selector Real/Prueba visible y etiqueta "FACTURAS REALES · SII"',
  !d.getElementById('fxModoSel').hidden && d.querySelector('[data-modo="PRODUCCION"]').classList.contains('on') && /FACTURAS REALES/.test(d.getElementById('fxModoTag').textContent));
const docs = d.getElementById('fxDocs');
res('2 resumen "Documentos y correo": 1 de 2 PDF/XML, 1 de 2 aceptadas SII, 0 de 2 correos, envío real APAGADO',
  !docs.hidden && /PDF y XML oficiales\s*1 de 2/.test(docs.textContent) && /Aceptadas por el SII\s*1 de 2/.test(docs.textContent) && /Correos enviados\s*0 de 2/.test(docs.textContent) && /Envío real APAGADO/.test(docs.textContent), docs.textContent.slice(0, 300));
res('3 con el envío apagado, "Enviar correos del grupo" está deshabilitado', d.querySelector('[data-act="tanda-correo"]').disabled === true);
const ver = d.querySelector('#tbody [data-act="ver-pdf"]');
res('4 la línea con documentos muestra "Ver PDF"; la que no, "Traer PDF"', !!ver && ver.getAttribute('data-id') === '296' && !!d.querySelector('#tbody [data-act="doc-linea"][data-id="297"]'));
ver.click(); await espera(80);
const e0 = w.__edge[0];
res('5 "Ver PDF" llama a la Edge facturacion-emitir (ver_documento, linea 296, tipo pdf) con el JWT del usuario y abre el PDF',
  e0 && e0.url === 'http://mock/functions/v1/facturacion-emitir' && e0.body.accion === 'ver_documento' && e0.body.linea_id === 296 && e0.body.tipo === 'pdf'
  && e0.headers.Authorization === 'Bearer jwt-ficticio' && w.__abiertas[0]?.location.href === 'blob:ficticio', e0);
res('6 el navegador nunca toca el bucket de storage', !w.__gets.some((g: string) => /storage/.test(g)) && !w.__edge.some((x: any) => /storage/.test(x.url)));
res('7 la etiqueta del estado SII aparece en la fila (con reparos)', /SII con reparos/.test(d.querySelector('#tbody tr[data-id="296"]').textContent));
dom.window.close();

dom = await abrir({ envio: true });
d = dom.window.document;
res('8 con el envío encendido pero sin estado SII aceptado pendiente de correo, el botón cuenta 1 (solo la aceptada con documentos)', /Enviar correos del grupo \(1\)/.test(d.getElementById('fxDocs').textContent) && d.querySelector('[data-act="tanda-correo"]').disabled === false);
res('9 "Configurar correo" solo lo ve el Master', !d.querySelector('[data-act="config-correo"]'));
dom.window.close();

dom = await abrir({ master: true });
d = dom.window.document;
res('10 el Master ve "Configurar correo"', !!d.querySelector('[data-act="config-correo"]'));
dom.window.close();

dom = await abrir({ sinMigracion: true });
d = dom.window.document;
res('11 sin la migración instalada la pantalla no se rompe: "Correo: por instalar" y las filas siguen visibles', /Correo: por instalar/.test(d.getElementById('fxDocs').textContent) && d.querySelectorAll('#tbody tr[data-id]').length === 2);
dom.window.close();

console.log(`\nFacturación · documentos y correo: ${ok}/${ok + mal}`);
Deno.exit(mal ? 1 : 0);
