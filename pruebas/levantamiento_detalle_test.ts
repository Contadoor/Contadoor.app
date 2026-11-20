// LIVA-DETALLE-F29 · prueba LOCAL del front en jsdom con sbFetch simulado. Datos 100 % ficticios.
// Uso: deno run --allow-read --allow-env --allow-sys --allow-net=registry.npmjs.org,cdnjs.cloudflare.com pruebas/levantamiento_detalle_test.ts
// ExcelJS: se usa EL MISMO archivo que carga el navegador (cdnjs 4.4.0), verificado con su SRI, evaluado dentro de jsdom.
import { JSDOM } from 'npm:jsdom@24.1.0';
import ExcelJS from 'npm:exceljs@4.4.0';
const RAIZ = new URL('../', import.meta.url);
const leer = (p: string) => Deno.readTextFileSync(new URL(p, RAIZ));
let ok = 0, mal = 0;
const res = (n: string, b: boolean, d: unknown = '') => { if (b) { ok++; console.log('OK  ', n); } else { mal++; console.log('MAL ', n, JSON.stringify(d)); } };
const espera = (ms = 30) => new Promise((r) => setTimeout(r, ms));
const JS = leer('clientes/levantamiento-iva.js'), JD = leer('clientes/levantamiento-detalle.js'), JH = leer('clientes/historial-sii-cargado.js'), HTML = leer('clientes/index.html');
const DATOS = leer('pruebas/levantamiento-iva-datos.js'), DD = leer('pruebas/levantamiento-detalle-datos.js');
const LOGO = Deno.readFileSync(new URL('assets/logo-blanco.png', RAIZ));
const SRI = /EXCELJS_SRI = '(sha384-[^']+)'/.exec(JD)![1], URLX = /EXCELJS_URL = '([^']+)'/.exec(JD)![1];
const EXCEL_BROWSER = new Uint8Array(await (await fetch(URLX)).arrayBuffer());
const sri = 'sha384-' + btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest('SHA-384', EXCEL_BROWSER))));
const EXCEL_SRC = new TextDecoder().decode(EXCEL_BROWSER);

// ── 0. Integración y estándar ──
const i1 = HTML.indexOf('<script src="levantamiento-iva.js">'), i2 = HTML.indexOf('<script src="levantamiento-detalle.js">'), i3 = HTML.indexOf('<script src="historial-sii-cargado.js">'), iA = HTML.indexOf('<script src="../auth.js">');
res('0.1 los módulos se cargan tras levantamiento-iva.js y antes de auth.js', i1 > 0 && i2 > i1 && i3 > i2 && iA > i3);
res('0.2 la ficha monta «Historial SII» con id, razón, RUT y sesión', /GestoorHistorialSII\.montar\(g\('det-hcar'\), \{ id: c\.id, razon: c\.razon, rut: c\.rut \}, window\._contadoorSesion\)/.test(HTML) && /id="det-hcar"/.test(HTML));
for (const [n, src] of [['detalle', JD], ['historial', JH]] as const) {
  res(`0.3 ${n}: sin SB_KEY, sbH propio ni Bearer`, !/SB_KEY|function sbH|Bearer/.test(src));
  res(`0.4 ${n}: innerHTML solo con íconos (gIcon)`, (src.match(/innerHTML\s*=\s*[^;]+/g) || []).every((x) => /gIcon/.test(x)));
  res(`0.5 ${n}: sin emojis`, !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(src));
}
res('0.6 el detalle usa la RPC de Contable sii_documentos_periodo (no duplica)', /'sii_documentos_periodo'/.test(JD));
res('0.7b el archivo de cdnjs calza con el SRI declarado', sri === SRI, sri);
res('0.7 ExcelJS con versión exacta 4.4.0 desde cdnjs y SRI', /cdnjs\.cloudflare\.com\/ajax\/libs\/exceljs\/4\.4\.0\/exceljs\.min\.js/.test(JD) && /sha384-Pqp51FUN2/.test(JD) && /crossOrigin = 'anonymous'/.test(JD));
res('0.8 sin el aviso fijo de «6 folios» en el front', !/6 folios/.test(JS + JD + JH + leer('clientes/historia-sii.js')));
res('0.9 nunca dice «honorarios» en textos propios (al cliente: «nuestros servicios»)', !/honorario/i.test(JD + JH) && /nuestros servicios/.test(JD));

function pagina(resp: (path: string, body: any) => [number, unknown]) {
  const dom = new JSDOM(`<!doctype html><head></head><body><div id="det-liva"></div><div id="det-hcar"></div></body>`, { runScripts: 'outside-only', url: 'https://gestoor.contadoor.cl/clientes/' });
  const w: any = dom.window; const llam: any[] = []; const impresiones: string[] = []; const descargas: any[] = [];
  w.gIcon = (n: string) => `<svg data-i="${n}"></svg>`;
  w.sbFetch = (p: string, o: any) => { const b = JSON.parse(o.body || '{}'); llam.push([p, b]); const [st, j] = resp(p, b);
    return Promise.resolve({ ok: st === 200, status: st, text: () => Promise.resolve(JSON.stringify(j)) }); };
  w.fetch = (u: string) => Promise.resolve({ ok: /logo-blanco\.png$/.test(String(u)), arrayBuffer: () => Promise.resolve(LOGO.buffer.slice(LOGO.byteOffset, LOGO.byteOffset + LOGO.byteLength)) });
  if (sri === SRI) w.eval(EXCEL_SRC);   // define window.ExcelJS como en el navegador
  w.eval(DATOS); w.eval(DD); w.eval(JS); w.eval(JD); w.eval(JH);
  w.GestoorLevDetalle.alDescargar = (nombre: string, buf: Uint8Array) => { descargas.push({ nombre, buf }); };
  // srcdoc de los iframes de impresión: se guarda el HTML (jsdom no imprime)
  const desc = Object.getOwnPropertyDescriptor(w.HTMLIFrameElement.prototype, 'srcdoc');
  Object.defineProperty(w.HTMLIFrameElement.prototype, 'srcdoc', { configurable: true, set(v: string) { if (this.id === 'livd-pdf-frame') impresiones.push(v); this.setAttribute('data-srcdoc', v); desc && desc.set && desc.set.call(this, v); }, get() { return this.getAttribute('data-srcdoc'); } });
  return { w, d: w.document as Document, llam, impresiones, descargas };
}
const C = { id: 9001, razon: 'Empresa Ficticia SpA', rut: '76.000.000-0' };
const respuestas = (w: any, extra: Record<string, [number, unknown]> = {}) => (p: string, b: any): [number, unknown] => {
  if (extra[p]) return extra[p];
  if (p === 'rpc/sii_levantamiento_iva') return [200, w.LIVA_DEMO];
  if (p === 'rpc/sii_historia_origenes') return [200, { meses: [] }];
  if (p === 'rpc/sii_levantamiento_detalle_mes') return [200, b.p_periodo === '202507' ? w.LIVD_SIN_DETALLE : w.LIVD_DETALLE];
  if (p === 'rpc/sii_documentos_periodo') return [200, w.LIVD_DOCS[b.p_libro]];
  if (p === 'rpc/sii_levantamiento_borrador_f29') return [200, w.LIVD_BORRADOR];
  if (p === 'rpc/sii_levantamiento_registrar_exportacion') return [200, { registrado: true, bitacora_id: 1 }];
  if (p === 'rpc/sii_historial_cargado') return [200, w.LIVD_HISTORIAL];
  if (p === 'rpc/sii_f29_codigos_mes') return [200, w.LIVD_F29];
  return [404, { code: 'PGRST202' }];
};
async function calcular(P: ReturnType<typeof pagina>) {
  P.w.GestoorLevIVA.montar(P.d.getElementById('det-liva'), C, { esMaster: true });
  (P.d.getElementById('liva-abrir') as HTMLElement).click();
  (P.d.getElementById('liva-calcular') as HTMLElement).click(); await espera();
}

// ── 1. Tabla: lupa, doble clic, totales, recuadro, separadores ──
{
  let w: any; const P = pagina((p, b) => respuestas(w)(p, b)); w = P.w; const { d, llam } = P;
  await calcular(P);
  res('1.1 sin aviso fijo de 6 folios en el diálogo', !d.getElementById('liva-aviso-f29') && !/6 folios/.test(d.getElementById('liva-velo')!.textContent!));
  const lupas = d.querySelectorAll('#liva-tabla button[data-lupa]');
  res('1.2 una lupa accesible por mes (aria-label con el mes)', lupas.length === 36 && /^Ver documentos de /.test(lupas[0].getAttribute('aria-label')!), lupas.length);
  const tf = d.getElementById('liva-totales')!;
  const T = w.LIVA_DEMO.totales;
  const tds = Array.from(tf.querySelectorAll('td')).map((x: any) => x.textContent);
  const pz = (n: number) => '$' + Math.round(n).toLocaleString('es-CL');
  res('1.3 fila de totales al pie con los totales del servidor (débito/crédito RCV y declarado)', tds[0] === 'Totales' && tds[2] === pz(T.debito_rcv) && tds[3] === pz(T.debito_declarado) && tds[4] === pz(T.credito_rcv) && tds[5] === pz(T.credito_declarado_documentos), tds);
  res('1.4 totales: diferencia a pagar, a favor y total a regularizar', tds[9] === pz(w.LIVA_DEMO.estimacion.impuesto) && /^A favor /.test(tds[8]) && tds[10] === 'No calculable', tds.slice(8));
  const est = d.querySelector('#liva-tabla tfoot tr.est td')!.textContent!;
  res('1.5 conteo de meses por estado y desglose impuesto + reajuste + intereses + multa = total', /calza/.test(est) && /Conocido \(\d+ meses?\): impuesto \$[\d.]+ \+ reajuste \$[\d.]+ \+ intereses \$[\d.]+ \+ multa \$[\d.]+ = \$[\d.]+/.test(est), est);
  const reg = d.getElementById('liva-regularizar')!;
  res('1.6 recuadro «A regularizar en el período: $X (N meses)» arriba', /A regularizar en el período/.test(reg.textContent!) && /meses/.test(reg.textContent!) && reg.compareDocumentPosition(d.getElementById('liva-tabla')!) === 4);
  const css = d.getElementById('liva-css')!.textContent!;
  res('1.7 separadores verticales sutiles (td .18, th .30) y pie fijo', /\.liva-t td\+td\{border-left:1px solid rgba\(201,168,204,\.18\)\}/.test(css) && /\.liva-t th\+th\{border-left:1px solid rgba\(201,168,204,\.30\)\}/.test(css) && /tfoot td\{z-index:1;position:sticky;bottom:0/.test(css));
  const pdf = w.GestoorLevIVA.documentoPdf(w.LIVA_DEMO, C, 'x.png');
  res('1.8 PDF: totales al pie, recuadro a regularizar, separadores y sin aviso de 6 folios', /<tfoot>/.test(pdf) && /A regularizar en el período/.test(pdf) && /td\+td\{border-left:1px solid #EFE3F1\}/.test(pdf) && !/6 folios/.test(pdf));

  // doble clic en una fila → panel del mes
  const fila = d.querySelectorAll('#liva-tabla tr.fila')[19] as HTMLElement;
  fila.dispatchEvent(new w.MouseEvent('dblclick', { bubbles: true })); await espera();
  const per = fila.getAttribute('data-periodo');
  res('1.9 doble clic abre el panel del mes', !!d.getElementById('livd-velo') && d.querySelector('#livd-velo h3')!.textContent!.includes('Documentos del SII'));
  const q = llam.filter((x) => x[0] === 'rpc/sii_levantamiento_detalle_mes' || x[0] === 'rpc/sii_documentos_periodo');
  res('1.10 pide detalle_mes + documentos de venta y compra del mes', q.length === 3 && q.every((x) => x[1].p_cliente_id === 9001 && x[1].p_periodo === per) && q.some((x) => x[1].p_libro === 'venta') && q.some((x) => x[1].p_libro === 'compra'), q);
  const cmp = Array.from(d.querySelectorAll('#livd-comparacion tr[data-codigo]')).map((r: any) => r.getAttribute('data-codigo'));
  res('1.11 comparación por código arriba (510, 538, 528, 537, 89), sin códigos conservados', ['510', '538', '528', '537', '89'].every((k) => cmp.includes(k)) && !cmp.includes('62'), cmp);
  const r510 = d.querySelector('#livd-comparacion tr[data-codigo="510"]')!.querySelectorAll('td');
  res('1.12 NC olvidada: 510 declarado $0, según RCV $1.900, diferencia en rojo', r510[2].textContent === '$0' && r510[3].textContent === '$1.900' && r510[4].classList.contains('roj'));
  const grupos = Array.from(d.querySelectorAll('#livd-tabla tr.grupo')).map((r: any) => r.getAttribute('data-tipo'));
  res('1.13 Ventas agrupadas por tipo (33, 39, 61) con subtotales', JSON.stringify(grupos) === '["33","39","61"]' && /33 · Factura electrónica · 2 documentos/.test(d.querySelector('#livd-tabla tr.grupo')!.textContent!), grupos);
  const nc = Array.from(d.querySelectorAll('#livd-tabla tr.doc')).find((r: any) => r.children[1].textContent === '61') as any;
  res('1.14 nota de crédito en negativo', nc && nc.children[7].textContent === '-$1.900' && nc.children[7].classList.contains('neg'));
  res('1.15 razón social nula → «—»', Array.from(d.querySelectorAll('#livd-tabla tr.doc')).some((r: any) => r.children[1].textContent === '39' && r.children[4].textContent === '—'));
  (d.querySelector('.livd-tab[data-libro="compra_reclamado"]') as HTMLElement).click();
  const recl = d.querySelectorAll('#livd-tabla tr.doc');
  res('1.16 pestaña Reclamados: solo los reclamados; razón social como texto (sin XSS)', recl.length === 1 && recl[0].children[4].textContent!.includes('<img') && !w.__xss && !d.querySelector('#livd-tabla img'));
  (d.querySelector('.livd-tab[data-libro="compra_registro"]') as HTMLElement).click();
  res('1.17 pestaña Compras (registro): 2 documentos, NC recibida negativa', d.querySelectorAll('#livd-tabla tr.doc').length === 2 && /-\$950/.test(d.getElementById('livd-tabla')!.textContent!));
  res('1.18 pestañas accesibles (role=tab, aria-selected)', d.querySelectorAll('[role="tab"]').length === 5 && d.querySelector('.livd-tab[aria-selected="true"]')!.getAttribute('data-libro') === 'compra_registro');
  // Escape cierra solo el panel
  d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape' }));
  res('1.19 Escape cierra el panel y deja el levantamiento abierto', !d.getElementById('livd-velo') && !!d.getElementById('liva-velo'));
  // lupa de un mes sin detalle
  w.LIVA_DEMO.meses[21].periodo = '202507';
  const P2 = pagina((p, b) => respuestas(w)(p, b));
  w.GestoorLevDetalle.abrirMes({ cliente: C, desde: '202311', hasta: '202610', opciones: {}, datos: w.LIVA_DEMO, rpc: (n: string, b: any) => Promise.resolve(respuestas(w)('rpc/' + n, b)[1]) }, '202507'); await espera();
  res('1.20 mes sin detalle: lo dice claramente y no muestra comparación', /solo tiene el resumen del SII/.test(d.getElementById('livd-msg')!.textContent!) && !d.getElementById('livd-comparacion') && /Sin detalle por documento: el SII informa 12 documentos/.test(d.getElementById('livd-tabla')!.textContent!));
  void P2;
}

// ── 2. Borrador F29 (mes y todos) ──
{
  let w: any; const P = pagina((p, b) => respuestas(w)(p, b)); w = P.w; const { d, llam, impresiones } = P;
  await calcular(P);
  const mesDif = w.LIVD_BORRADOR.meses.find((m: any) => m.estado === 'con_diferencia');
  (d.querySelector(`#liva-tabla button[data-lupa="${mesDif.periodo}"]`) as HTMLElement).click(); await espera();
  (d.getElementById('livd-borrador') as HTMLElement).click(); await espera();
  const b = llam.filter((x) => x[0] === 'rpc/sii_levantamiento_borrador_f29');
  res('2.1 el borrador se pide con el rango COMPLETO del cálculo (remanente encadenado) y las mismas opciones', b.length === 1 && b[0][1].p_desde === w.LIVA_DEMO.desde && b[0][1].p_hasta === w.LIVA_DEMO.hasta && b[0][1].p_opciones.medio === 'internet', b);
  const prev = d.getElementById('livd-prev')!.getAttribute('data-srcdoc')!;
  res('2.2 vista tipo formulario: folio original, columnas declarado / corregido / diferencia, aviso Contadoor',
    prev.includes('Folio original') && prev.includes(String(mesDif.f29.folio)) && prev.includes('Declarado (original)') && prev.includes('Corregido (según RCV)') && prev.includes('Borrador preparado por Contadoor para rectificar en sii.cl; verificar antes de presentar.'));
  res('2.3 marca: morado #924893, Montserrat/Inter, logo del repo; estimación aparte rotulada', prev.includes('#924893') && /Montserrat/.test(prev) && /Inter/.test(prev) && prev.includes('/assets/logo-blanco.png') && /ESTIMACIÓN \(referencial/.test(prev) && /el SII calcula los reajustes, intereses y multas/.test(prev));
  res('2.4 códigos conservados del original (PPM 62, retención 151) y «Rectificar F29» en sii.cl', /<td class="b">62<\/td>/.test(prev) && /Del original/.test(prev) && /Rectificar F29/.test(prev));
  (d.getElementById('livd-imprimir') as HTMLElement).click(); await espera();
  const ex = llam.filter((x) => x[0] === 'rpc/sii_levantamiento_registrar_exportacion');
  res('2.5 «Imprimir / PDF» registra borrador_pdf_mes ANTES de imprimir', ex.length === 1 && ex[0][1].p_tipo === 'borrador_pdf_mes' && ex[0][1].p_desde === mesDif.periodo && impresiones.length === 1);
  (d.getElementById('liva-borradores') as HTMLElement).click(); await espera();
  const ex2 = llam.filter((x) => x[0] === 'rpc/sii_levantamiento_registrar_exportacion' && x[1].p_tipo === 'borrador_pdf_todos');
  const todo = impresiones[1] || '';
  const nRect = w.LIVD_BORRADOR.meses.filter((m: any) => m.estado === 'con_diferencia' || m.estado === 'sin_f29').length;
  res('2.6 «Borradores F29»: bitácora + un PDF con resumen + una página por mes a rectificar', ex2.length === 1 && (todo.match(/<section class="pag">/g) || []).length === nRect + 1 && todo.includes('Borradores de F29 a rectificar'), [(todo.match(/<section class="pag">/g) || []).length, nRect]);
  res('2.7 el borrador se pide una sola vez por cálculo (caché)', llam.filter((x) => x[0] === 'rpc/sii_levantamiento_borrador_f29').length === 1);
}
{ // fail-closed: si la bitácora falla, no se imprime
  let w: any; const P = pagina((p, b) => respuestas(w, { 'rpc/sii_levantamiento_registrar_exportacion': [500, { code: 'XX000' }] })(p, b)); w = P.w;
  await calcular(P);
  (P.d.getElementById('liva-borradores') as HTMLElement).click(); await espera();
  res('2.8 sin bitácora no hay PDF (fail-closed)', P.impresiones.length === 0 && P.d.getElementById('liva-msg')!.classList.contains('roj'));
  (P.d.getElementById('liva-excel') as HTMLElement).click(); await espera(80);
  res('2.9 sin bitácora no hay Excel (fail-closed)', P.descargas.length === 0);
}

// ── 3. Excel (.xlsx real) ──
{
  let w: any; const P = pagina((p, b) => respuestas(w)(p, b)); w = P.w; const { d, llam, descargas } = P;
  await calcular(P);
  (d.getElementById('liva-excel') as HTMLElement).click();
  for (let i = 0; i < 100 && !descargas.length; i++) await espera(50);
  const reg = llam.findIndex((x) => x[0] === 'rpc/sii_levantamiento_registrar_exportacion' && x[1].p_tipo === 'excel_rango');
  const prim = llam.findIndex((x) => x[0] === 'rpc/sii_documentos_periodo');
  res('3.1 registra excel_rango en la bitácora ANTES de leer documentos', reg >= 0 && prim > reg, [reg, prim]);
  res('3.2 descarga un .xlsx con nombre de la empresa y rango', descargas.length === 1 && /^Levantamiento_IVA_Empresa_Ficticia_SpA_\d{6}-\d{6}\.xlsx$/.test(descargas[0].nombre), descargas[0] && descargas[0].nombre);
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(descargas[0].buf);
  const hojas = wb.worksheets.map((s) => s.name);
  res('3.3 hojas Resumen, Mes a mes, Ventas, Compras, Borradores F29', JSON.stringify(hojas) === JSON.stringify(['Resumen', 'Mes a mes', 'Ventas', 'Compras', 'Borradores F29']), hojas);
  const R = wb.getWorksheet('Resumen')!;
  const txtR = R.getSheetValues().flat().filter((x) => typeof x === 'string').join(' | ');
  res('3.4 Resumen: logo, título, empresa/RUT/rango, a regularizar y aviso «Estimación preliminar, verificar»', (wb as any).media.length === 1 && R.getImages().length === 1 && /Levantamiento de IVA/.test(txtR) && /Empresa Ficticia SpA/.test(txtR) && /76\.000\.000-0/.test(txtR) && /A regularizar en el período/.test(txtR) && /Estimación preliminar, verificar/.test(txtR));
  const M = wb.getWorksheet('Mes a mes')!, h = M.getCell('A1');
  res('3.5 Mes a mes: encabezado morado #924893 con texto blanco Arial', (h.fill as any).fgColor.argb === 'FF924893' && h.font.color!.argb === 'FFFFFFFF' && h.font.name === 'Arial' && h.font.bold === true);
  res('3.6 filtros y panel inmovilizado', !!M.autoFilter && (M.views[0] as any).state === 'frozen' && (M.views[0] as any).ySplit === 1);
  res('3.7 formato $ chileno sin decimales', M.getCell('C2').numFmt === '"$"#,##0;-"$"#,##0;"$"0');
  const filas = M.getSheetValues().slice(2) as any[];
  const colorEstado = (t: string) => { const i = filas.findIndex((r) => r && r[2] === t); return i < 0 ? null : (M.getCell(i + 2, 2).fill as any).fgColor.argb; };
  res('3.8 colores de estado: verde calza, rojo diferencia, ámbar provisional, gris sin datos', colorEstado('Calza') === 'FFE3F4EC' && colorEstado('Diferencia') === 'FFFBE4E1' && colorEstado('Coincidencia provisional') === 'FFFFF1D6' && colorEstado('Sin datos') === 'FFF0ECF1',
    [colorEstado('Calza'), colorEstado('Diferencia'), colorEstado('Coincidencia provisional'), colorEstado('Sin datos')]);
  res('3.9 filas alternadas suaves y bordes finos', (M.getCell('A3').fill as any)?.fgColor?.argb === 'FFF8F1F9' && (M.getCell('C2').border as any).top.style === 'thin');
  const ti = filas.findIndex((r) => r && r[1] === 'Totales') + 2, tc = M.getCell(ti, 3).value as any;
  res('3.10 fila de TOTALES con fórmulas SUM', ti > 2 && tc && tc.formula === `SUM(C2:C${ti - 1})` && typeof tc.result === 'number' && (M.getCell(ti, 10).value as any).formula === `SUM(J2:J${ti - 1})`, tc);
  const V = wb.getWorksheet('Ventas')!, Cc = wb.getWorksheet('Compras')!;
  res('3.11 Ventas y Compras con el detalle de documentos del rango (NC negativa)', V.rowCount > 10 && Cc.rowCount > 10 && (V.getSheetValues() as any[]).some((r) => r && r[3] === 61 && r[11] === -1900));
  const B = wb.getWorksheet('Borradores F29')!, bv = B.getSheetValues() as any[];
  res('3.12 Borradores F29: meses a rectificar con declarado / corregido / diferencia por código', bv[1][5] === 'Declarado (original)' && bv[1][6] === 'Corregido (según RCV)' && bv.some((r) => r && r[2] === '510') && bv.some((r) => r && typeof r[4] === 'string' && /F29 rectificatorio · folio original/.test(r[4])));
  const docsLeidos = llam.filter((x) => x[0] === 'rpc/sii_documentos_periodo').length;
  res('3.13 solo pide documentos de meses con RCV (venta y compra)', docsLeidos === 2 * w.LIVA_DEMO.meses.filter((m: any) => m.estado !== 'sin_datos').length, docsLeidos);
}

// ── 4. Historial SII cargado ──
{
  let w: any; const P = pagina((p, b) => respuestas(w)(p, b)); w = P.w; const { d, llam } = P;
  for (const [s, ve] of [[{ esMaster: true }, true], [{ rol: 'contable' }, true], [{ rol: 'rrhh' }, false], [null, false]] as const) {
    w.GestoorHistorialSII.montar(d.getElementById('det-hcar'), C, s);
    res(`4.1 botón Historial SII ${ve ? 'visible' : 'oculto'} para ${JSON.stringify(s)}`, !!d.getElementById('hcar-abrir') === ve);
  }
  w.GestoorHistorialSII.montar(d.getElementById('det-hcar'), C, { esMaster: true });
  w.GestoorHistorialSII.abrir(C, new Date(2026, 10, 20)); await espera();
  const q = llam.find((x) => x[0] === 'rpc/sii_historial_cargado');
  res('4.2 pide sii_historial_cargado de los últimos 6 años', q && q[1].p_desde === '202101' && q[1].p_hasta === '202611', q);
  const meses = d.querySelectorAll('#hcar-tabla tr.mes'), anios = d.querySelectorAll('#hcar-tabla tr.anio');
  res('4.3 por año y mes (24 meses en 3 años)', meses.length === 24 && anios.length === 3 && anios[0].textContent === '2026', [meses.length, anios.length]);
  const f0 = meses[0].querySelectorAll('td');
  res('4.4 mes con RCV: documentos, IVA, origen, leído, F29 folio/estado/montos', f0[1].textContent === '10' && f0[2].textContent === '$190.000' && f0[7].textContent === 'Diaria' && /\d{2}-\d{2}-\d{4}/.test(f0[8].textContent!) && f0[9].textContent === '9000000' && f0[10].textContent === 'Vigente' && /^Sí/.test(f0[11].textContent!), Array.from(f0).map((x: any) => x.textContent));
  res('4.5 solo resumen / sin montos / rectificado / parcial se distinguen', meses[5].querySelectorAll('td')[6].textContent === 'Solo resumen' && meses[4].querySelectorAll('td')[11].textContent === 'Sin montos' && /rectificado/.test(meses[2].querySelectorAll('td')[9].textContent!) && /Parcial/.test(meses[3].querySelectorAll('td')[8].textContent!));
  res('4.6 mes sin datos: «—» (no cero) y botones deshabilitados', meses[22].querySelectorAll('td')[1].textContent === '—' && (meses[23].querySelector('button[data-f29]') as HTMLButtonElement).disabled);
  res('4.7 origen Historia SII en meses antiguos', meses[15].querySelectorAll('td')[7].textContent === 'Historia SII');
  (d.getElementById('hcar-anio') as HTMLSelectElement).value = '2025'; d.getElementById('hcar-anio')!.dispatchEvent(new w.Event('change'));
  res('4.8 filtro por año', d.querySelectorAll('#hcar-tabla tr.mes').length === 12);
  (d.getElementById('hcar-anio') as HTMLSelectElement).value = ''; d.getElementById('hcar-anio')!.dispatchEvent(new w.Event('change'));
  (d.querySelectorAll('#hcar-tabla tr.mes')[0] as HTMLElement).dispatchEvent(new w.MouseEvent('dblclick', { bubbles: true })); await espera();
  res('4.9 doble clic en el mes → el mismo detalle de documentos', !!d.getElementById('livd-velo') && llam.some((x) => x[0] === 'rpc/sii_levantamiento_detalle_mes' && x[1].p_periodo === '202610'));
  w.GestoorLevDetalle.cerrarMes();
  (d.querySelector('#hcar-tabla button[data-f29="202610"]') as HTMLElement).click(); await espera();
  const cods = Array.from(d.querySelectorAll('#hcar-f29-tabla tr[data-codigo]')).map((r: any) => r.getAttribute('data-codigo'));
  res('4.10 F29 del mes con TODOS sus códigos (también los sin glosa)', cods.length === 6 && cods.includes('915') && /Folio 9000000/.test(d.getElementById('hcar-f29-velo')!.textContent!) && d.querySelector('#hcar-f29-tabla tr[data-codigo="503"]')!.lastElementChild!.textContent === '10', cods);
}
{ // permisos: 42501 → mensaje claro
  let w: any; const P = pagina((p, b) => p === 'rpc/sii_historial_cargado' ? [403, { code: '42501', message: 'SIN_PERMISO' }] : respuestas(w)(p, b)); w = P.w;
  w.GestoorHistorialSII.abrir(C); await espera();
  res('4.11 42501 → «Solo el Master o el analista contable asignado…»', /Solo el Master o el analista contable asignado/.test(P.d.getElementById('hcar-msg')!.textContent!));
}

console.log(`\n${ok} OK · ${mal} MAL`);
if (mal) Deno.exit(1);
