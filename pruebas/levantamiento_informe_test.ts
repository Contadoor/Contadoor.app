// LIVA-INFORME-CLIENTE · prueba LOCAL del «Informe para el cliente (PDF)» en jsdom con sbFetch simulado. Datos 100 % ficticios.
// Uso: deno run --allow-read --allow-env --allow-sys pruebas/levantamiento_informe_test.ts
import { JSDOM, VirtualConsole } from 'npm:jsdom@24.1.0';
const RAIZ = new URL('../', import.meta.url);
const leer = (p: string) => Deno.readTextFileSync(new URL(p, RAIZ));
let ok = 0, mal = 0;
const res = (n: string, b: boolean, d: unknown = '') => { if (b) { ok++; console.log('OK  ', n); } else { mal++; console.log('MAL ', n, JSON.stringify(d)); } };
const espera = (ms = 30) => new Promise((r) => setTimeout(r, ms));
const JS = leer('clientes/levantamiento-iva.js'), JD = leer('clientes/levantamiento-detalle.js'), JR = leer('clientes/levantamiento-rectificar.js'), JI = leer('clientes/levantamiento-informe.js'), HTML = leer('clientes/index.html');
const DATOS = leer('pruebas/levantamiento-iva-datos.js'), DD = leer('pruebas/levantamiento-detalle-datos.js'), DR = leer('pruebas/levantamiento-rectificar-datos.js');
const pz = (n: number) => (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString('es-CL');
const sinEtiquetas = (h: string) => h.replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ');

// ── 0. Integración y estándar ──
const iR = HTML.indexOf('<script src="levantamiento-rectificar.js">'), iI = HTML.indexOf('<script src="levantamiento-informe.js">'), iA = HTML.indexOf('<script src="../auth.js">');
res('0.1 levantamiento-informe.js se carga tras el escenario y antes de auth.js', iR > 0 && iI > iR && iA > iI);
res('0.2 sin SB_KEY, sbH propio ni Bearer', !/SB_KEY|function sbH|Bearer/.test(JI));
res('0.3 sin innerHTML ni librerías externas nuevas (sin <script src>)', !/innerHTML/.test(JI) && !/<script/i.test(JI));
res('0.4 sin emojis', !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(JI));
res('0.5 nunca «honorarios» ni la dirección personal en el código', !/honorario/i.test(JI + JR) && !/laguna|inca\b|0956/i.test(JI));
res('0.6 bitácora con un tipo que la RPC acepta (borrador_pdf_todos)', /TIPO_BITACORA = 'borrador_pdf_todos'/.test(JI) && /'sii_levantamiento_registrar_exportacion'/.test(JI));
res('0.7 usa el logo glossy del repo (fondo claro)', /contadoor-lockup-glossy\.png/.test(JI) && Deno.statSync(new URL('assets/contadoor-lockup-glossy.png', RAIZ)).size > 10000);

function pagina(resp: (path: string, body: any) => [number, unknown]) {
  const vc = new VirtualConsole(); vc.on('jsdomError', (e: Error) => { if (!/Not implemented: window\.(print|focus)/.test(String(e && e.message))) console.error(e); });   // jsdom no imprime: se ignora solo eso
  const dom = new JSDOM(`<!doctype html><head></head><body><div id="det-liva"></div></body>`, { runScripts: 'outside-only', url: 'https://gestoor.contadoor.cl/clientes/', virtualConsole: vc });
  const w: any = dom.window; const llam: any[] = []; const impresiones: string[] = []; const orden: string[] = [];
  w.gIcon = (n: string) => `<svg data-i="${n}"></svg>`;
  w.sbFetch = (p: string, o: any) => { const b = JSON.parse(o.body || '{}'); llam.push([p, b]); orden.push(p); const [st, j] = resp(p, b);
    return Promise.resolve({ ok: st === 200, status: st, text: () => Promise.resolve(JSON.stringify(j)) }); };
  w.eval(DATOS); w.eval(DD); w.eval(DR); w.eval(JS); w.eval(JD); w.eval(JR); w.eval(JI);
  const desc = Object.getOwnPropertyDescriptor(w.HTMLIFrameElement.prototype, 'srcdoc');
  Object.defineProperty(w.HTMLIFrameElement.prototype, 'srcdoc', { configurable: true, set(v: string) { if (this.id === 'livd-pdf-frame') { impresiones.push(v); orden.push('IMPRIMIR'); } this.setAttribute('data-srcdoc', v); desc && desc.set && desc.set.call(this, v); }, get() { return this.getAttribute('data-srcdoc'); } });
  return { w, d: w.document as Document, llam, impresiones, orden };
}
const C = { id: 9001, razon: 'Empresa Ficticia SpA', rut: '76.000.000-0' };
const respuestas = (w: any, esc: string, extra: Record<string, [number, unknown]> = {}) => (p: string, b: any): [number, unknown] => {
  if (extra[p]) return extra[p];
  if (p === 'rpc/sii_levantamiento_iva') return [200, w.LIVA_DEMO];
  if (p === 'rpc/sii_historia_origenes') return [200, { meses: [] }];
  if (p === 'rpc/sii_levantamiento_rectificar_todo') return [200, w[esc]];
  if (p === 'rpc/sii_levantamiento_registrar_exportacion' || p === 'rpc/sii_levantamiento_registrar_pdf') return [200, { registrado: true, bitacora_id: 1 }];
  return [404, { code: 'PGRST202' }];
};
async function abrirEscenario(P: ReturnType<typeof pagina>) {
  P.w.GestoorLevIVA.montar(P.d.getElementById('det-liva'), C, { esMaster: true });
  (P.d.getElementById('liva-abrir') as HTMLElement).click();
  (P.d.getElementById('liva-calcular') as HTMLElement).click(); await espera();
  (P.d.getElementById('liva-rectificar-todo') as HTMLElement).click(); await espera();
}
async function sumarOtros(P: ReturnType<typeof pagina>, monto: string, motivo: string) {
  (P.d.getElementById('liva-otros-monto') as HTMLInputElement).value = monto;
  (P.d.getElementById('liva-otros-motivo') as HTMLInputElement).value = motivo;
  (P.d.getElementById('liva-otros-sumar') as HTMLElement).click(); await espera();
}

// ── 1. Escenario con remanente que afecta meses posteriores (LIVR_PARCIAL) ──
{
  let w: any; const P = pagina((p, b) => respuestas(w, 'LIVR_PARCIAL')(p, b)); w = P.w; const { d, llam } = P;
  await abrirEscenario(P);
  const bI = d.getElementById('livr-informe') as HTMLButtonElement;
  res('1.1 botón «Informe para el cliente (PDF)» en la vista «Si rectificamos todo», habilitado con el escenario', !!bI && bI.textContent === 'Informe para el cliente (PDF)' && !bI.disabled);
  bI.click(); await espera(60);
  const reg = llam.find((x) => x[0] === 'rpc/sii_levantamiento_registrar_exportacion');
  const E = w.LIVR_PARCIAL, T = E.totales.todo;
  res('1.2 registra en la bitácora ANTES de imprimir (tipo borrador_pdf_todos, rango del escenario)', reg && reg[1].p_tipo === 'borrador_pdf_todos' && reg[1].p_desde === E.desde && reg[1].p_hasta === E.hasta && reg[1].p_cliente_id === 9001 &&
    P.orden.indexOf('rpc/sii_levantamiento_registrar_exportacion') >= 0 && P.orden.indexOf('IMPRIMIR') > P.orden.indexOf('rpc/sii_levantamiento_registrar_exportacion'), [reg, P.orden]);
  res('1.3 se imprime con el mismo mecanismo de los PDF (iframe livd-pdf-frame)', P.impresiones.length === 1);
  const h = P.impresiones[0] || '', t = sinEtiquetas(h);
  res('1.4 portada: logo glossy, título, empresa, RUT, período y fecha', /class="portada"/.test(h) && /contadoor-lockup-glossy\.png/.test(h) && t.includes('Diagnóstico de IVA y propuesta de regularización') &&
    t.includes('Empresa Ficticia SpA') && t.includes('76.000.000-0') && t.includes('enero 2026 a marzo 2026') && /Fecha \d{1,2} de [a-z]+ de \d{4}/.test(t), t.slice(0, 400));
  const R = w.GestoorLevInforme.resumen(E, null);
  const cifra = (k: string) => sinEtiquetas((new RegExp(`data-cifra="${k}">([\\s\\S]*?)</div></div>`).exec(h) || [])[0] || '');
  res('1.5 cifra: meses revisados = 3', /Meses revisados 3 /.test(cifra('meses')), cifra('meses'));
  res('1.6 cifra: F29 a corregir = f29_a_rectificar + f29_a_declarar del escenario', R.f29 === T.f29_a_rectificar + T.f29_a_declarar && cifra('f29').includes('a corregir ' + R.f29 + ' '), cifra('f29'));
  const ct = sinEtiquetas((/data-cifra="total">([\s\S]*?)<\/table>/.exec(h) || [])[0] || '');
  res('1.7 cifra: monto estimado = total del escenario, desglosado (impuesto + reajuste + intereses + multa)', ct.includes(pz(T.total)) && ct.includes('Impuesto ' + pz(T.impuesto)) && ct.includes('Reajuste ' + pz(T.reajuste)) &&
    ct.includes('Intereses ' + pz(T.intereses)) && ct.includes('Multa ' + pz(T.multa)) && T.impuesto + T.reajuste + T.intereses + T.multa === T.total, ct);
  res('1.8 cifra: remanente hoy $X → al corregir $Y', cifra('remanente').includes(pz(E.traspaso.declarado) + ' → ' + pz(E.traspaso.corregido)), cifra('remanente'));
  const qe = sinEtiquetas((/Qué encontramos<\/h2>([\s\S]*?)<h3>/.exec(h) || [])[1] || '');
  res('1.9 «Qué encontramos»: SII vs declarado, meses con diferencia, remanente que absorbe y dónde se agota, meses posteriores', /ventas y compras que el SII tiene registradas/.test(qe) &&
    /Encontramos diferencias en 1 mes: febrero 2026/.test(qe) && /se usó \$20\.000 más de IVA de compras/.test(qe) && /En febrero 2026 y marzo 2026 la diferencia no se tradujo en un pago/.test(qe) &&
    /se agota en abril 2026/.test(qe) && /posteriores al período revisado \(abril 2026 y mayo 2026\)/.test(qe), qe);
  const barras = Array.from(h.matchAll(/class="barra" data-periodo="(\d+)" data-valor="(-?\d+)"/g)).map((m) => m[1] + ':' + m[2]);
  res('1.10 gráfico SVG propio: barras por mes (diferencia de IVA) y líneas del remanente declarado vs corregido', /<svg class="graf"/.test(h) && barras.join() === '202602:20000' &&
    /class="rem-declarado"/.test(h) && /class="rem-corregido"/.test(h) && /Posterior al período revisado/.test(h), barras);
  const pa = sinEtiquetas((/id="inf-pasos">([\s\S]*?)<\/section>/.exec(h) || [])[1] || '');
  res('1.11 «Qué implica regularizar»: pasos en orden, cuántos, SII calcula cargos, estimación, condonación sin porcentajes', /Corregir 4 declaraciones mensuales de IVA \(F29\) ?, una por mes, partiendo por febrero 2026 y terminando en mayo 2026/.test(pa) &&
    /del mes más antiguo al más reciente/.test(pa) && /El SII calcula el monto definitivo al presentar/.test(pa) && /es una estimación/.test(pa) && /condonar/.test(pa) && !/\d+\s?%/.test(pa), pa);
  res('1.12 «Cómo te ayudamos»: nuestros servicios, prepara y presenta, revisa documentos, acompaña ante el SII; contacto', /nuestros servicios/.test(pa) && /Preparamos y presentamos/.test(pa) && /Revisamos los documentos/.test(pa) &&
    /Te acompañamos ante el SII/.test(pa) && pa.includes('+56 9 4675 4390') && pa.includes('agenda.contadoor.cl'));
  const filas = Array.from(h.matchAll(/<tr( class="post")? data-periodo="(\d+)">([\s\S]*?)<\/tr>/g));
  res('1.13 anexo: una fila por mes del escenario (incluye los posteriores marcados)', filas.map((f) => f[2]).join() === E.meses.map((m: any) => m.periodo).join() && filas.filter((f) => f[1]).length === 2);
  const f4 = sinEtiquetas(filas[3][3]);
  res('1.14 anexo: diferencia, remanente declarado vs corregido y monto a pagar del mes', f4 === ` abril 2026 Posterior al período revisado $0 ${pz(1612)} $0 ${pz(E.meses[3].estimacion.total)} `, f4);
  const sumMes = E.meses.reduce((s: number, m: any) => s + (m.estimacion ? m.estimacion.total : 0), 0);
  res('1.15 anexo: total = suma de los meses = total del escenario', sumMes === T.total && sinEtiquetas((/id="inf-anexo-total">([\s\S]*?)<\/tr>/.exec(h) || [])[1] || '').includes(pz(T.total)));
  res('1.16 aviso legal al pie (cada página y al final)', h.includes('content:"' + w.GestoorLevInforme.AVISO_LEGAL + '"') && t.includes('Estimación preliminar preparada por Contadoor con información del SII; los montos definitivos los determina el SII al presentar las rectificaciones.'));
  res('1.17 A4 vertical con numeración de páginas', /@page\{size:A4;/.test(h) && /counter\(page\) " de " counter\(pages\)/.test(h));
  res('1.18 marca: morado #924893, degradado #803889→#A4599C, Montserrat + Inter', h.includes('#924893') && /#803889,#A4599C/.test(h) && /family=Inter/.test(h) && /Montserrat/.test(h));
  res('1.19 nunca «honorarios», ni dirección personal, ni precios de servicios', !/honorario/i.test(h) && !/laguna|del inca/i.test(h) && !/\bUF\b|precio/i.test(t));
  const antesAnexo = t.slice(0, t.indexOf('Anexo · Detalle mes a mes'));
  res('1.20 sin códigos técnicos ni jerga interna fuera del anexo', antesAnexo.length > 500 && !/c[óo]d(igo)?\.?\s?\d|\b(504|537|538|89)\b|RCV|Cartapra|ingresado a mano|revisar a mano|art\. ?126|borrador|tolerancia|provisional/i.test(antesAnexo),
    (antesAnexo.match(/c[óo]d(igo)?\.?\s?\d|\b(504|537|538|89)\b|RCV|Cartapra|ingresado a mano|revisar a mano|art\. ?126|borrador|tolerancia|provisional/i) || [])[0]);
  res('1.21 sin notas internas del analista en todo el informe', !/Gestoor|analista|réplica|verificar antes de presentar/i.test(t));
  res('1.22 aviso de éxito en el panel', /Informe para el cliente listo/.test(d.getElementById('livr-msg')!.textContent!));
}

// ── 2. Otros cargos con motivo + pagó de más (LIVR_TODO) ──
{
  let w: any; const P = pagina((p, b) => respuestas(w, 'LIVR_TODO')(p, b)); w = P.w; const { d } = P;
  P.w.GestoorLevIVA.montar(P.d.getElementById('det-liva'), C, { esMaster: true });
  (d.getElementById('liva-abrir') as HTMLElement).click();
  (d.getElementById('liva-calcular') as HTMLElement).click(); await espera();
  await sumarOtros(P, '150.000', 'Multa por atraso <prueba>');
  (d.getElementById('liva-rectificar-todo') as HTMLElement).click(); await espera();
  (d.getElementById('livr-informe') as HTMLElement).click(); await espera(60);
  const h = P.impresiones[0] || '', t = sinEtiquetas(h), E = w.LIVR_TODO, T = E.totales.todo;
  const ct = sinEtiquetas((/data-cifra="total">([\s\S]*?)<\/table>/.exec(h) || [])[0] || '');
  res('2.1 total = escenario + otros cargos, con «Otros cargos» en el desglose', ct.includes(pz(T.total + 150000)) && ct.includes('Otros cargos ' + pz(150000)), ct);
  res('2.2 anexo: «Otros cargos» con su motivo (escapado) y total con otros cargos', /id="inf-anexo-otros"><td colspan="4">Otros cargos · Multa por atraso &lt;prueba&gt;<\/td><td>\$150\.000/.test(h) &&
    sinEtiquetas((/id="inf-anexo-total-otros">([\s\S]*?)<\/tr>/.exec(h) || [])[1] || '').includes(pz(T.total + 150000)));
  res('2.3 sin el rótulo interno «ingresado a mano»', !/ingresado a mano/i.test(t));
  res('2.4 pagó de más: informativo, no se descuenta, con el mes', /se pagó \$6\.000 más de IVA/.test(t) && /no se descuenta/.test(t) && /En junio 2026 \(\$6\.000\) se pagó más IVA/.test(t));
  res('2.5 barra verde para el mes que pagó de más', /class="barra" data-periodo="202606" data-valor="-6000"[^>]*fill="#3FA77A"/.test(h));
  res('2.6 meses revisados = 7 y F29 a corregir = 5', /Meses revisados 7 /.test(t) && /a corregir 5 /.test(t));
  res('2.7 sin meses posteriores: no se habla de meses fuera del período', !/posteriores al período revisado \(/.test(t));
}

// ── 3. Bitácora falla → no se exporta (fail-closed) ──
{
  let w: any; const P = pagina((p, b) => respuestas(w, 'LIVR_PARCIAL', { 'rpc/sii_levantamiento_registrar_exportacion': [403, { code: '42501', message: 'SIN_PERMISO' }] })(p, b)); w = P.w; const { d } = P;
  await abrirEscenario(P);
  const bI = d.getElementById('livr-informe') as HTMLButtonElement;
  bI.click(); await espera(60);
  res('3.1 si la bitácora falla, no se imprime y se avisa', P.impresiones.length === 0 && /Solo el Master/.test(d.getElementById('livr-msg')!.textContent!) && !bI.disabled);
}
{
  let w: any; const P = pagina((p, b) => respuestas(w, 'LIVR_PARCIAL', { 'rpc/sii_levantamiento_registrar_exportacion': [500, { message: 'X' }] })(p, b)); w = P.w; const { d } = P;
  await abrirEscenario(P);
  (d.getElementById('livr-informe') as HTMLElement).click(); await espera(60);
  res('3.2 error genérico de la bitácora: tampoco se imprime', P.impresiones.length === 0 && /livr-msg/.test(d.getElementById('livr-msg')!.id) && /roj/.test(d.getElementById('livr-msg')!.className));
}

// ── 4. Ayudantes puros ──
{
  const P = pagina(() => [404, {}]); const I = P.w.GestoorLevInforme;
  res('4.1 difMes descuenta el remanente arrastrado (Δ89 − Δ77 + Δ504)', I.difMes({ diferencia_89: 18588, diferencia_77: -1612, delta_504: -20200 }) === 0 && I.difMes({ diferencia_89: 0, diferencia_77: -20000, delta_504: 0 }) === 20000 && I.difMes({ diferencia_89: null }) === null);
  const Rn = I.resumen({ desde: '202401', hasta: '202412', totales: { todo: { total: null, f29_a_rectificar: 2 } }, traspaso: { calculable: false, periodo: '202412' }, meses: [] }, { monto: 10, motivo: 'm' });
  res('4.2 total no calculable no se fabrica («Por determinar») aunque haya otros cargos', Rn.total === null && Rn.mesesRevisados === 12);
  const hN = I.documento({ desde: '202401', hasta: '202412', totales: { todo: { total: null, f29_a_rectificar: 2 } }, traspaso: { calculable: false, periodo: '202412' }, meses: [] }, C, 'logo.png', null);
  res('4.3 documento con total no calculable: «Por determinar» y remanente «Por revisar»', /Por determinar/.test(hN) && /Por revisar/.test(hN) && !/NaN|undefined/.test(hN));
  const Ra = I.resumen({ desde: '202601', hasta: '202603', totales: { todo: { total: 1 } }, traspaso: { calculable: true, periodo: '202603', declarado: 5, corregido: 5 },
    fuera_de_rango: { estado: 'afecta_hasta_ultimo_f29', ultimo_f29_declarado: '202609', remanente_al_final: { periodo: '202609', declarado: 9000, corregido: 1000 } }, meses: [] }, null);
  res('4.4 remanente: si el efecto llega al último F29, se usa ese (hoy → corregido)', Ra.remanente.periodo === '202609' && Ra.remanente.hoy === 9000 && Ra.remanente.corregido === 1000);
}
console.log(`\n${ok} OK · ${mal} MAL`);
if (mal) Deno.exit(1);
