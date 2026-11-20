// LIVA-RECTIFICAR-TODO · prueba LOCAL del front en jsdom con sbFetch simulado. Datos 100 % ficticios (respuestas de la réplica).
// Uso: deno run --allow-read --allow-env --allow-sys --allow-net=registry.npmjs.org,cdnjs.cloudflare.com pruebas/levantamiento_rectificar_test.ts
import { JSDOM } from 'npm:jsdom@24.1.0';
import ExcelJS from 'npm:exceljs@4.4.0';
const RAIZ = new URL('../', import.meta.url);
const leer = (p: string) => Deno.readTextFileSync(new URL(p, RAIZ));
let ok = 0, mal = 0;
const res = (n: string, b: boolean, d: unknown = '') => { if (b) { ok++; console.log('OK  ', n); } else { mal++; console.log('MAL ', n, JSON.stringify(d)); } };
const espera = (ms = 30) => new Promise((r) => setTimeout(r, ms));
const JS = leer('clientes/levantamiento-iva.js'), JD = leer('clientes/levantamiento-detalle.js'), JR = leer('clientes/levantamiento-rectificar.js'), HTML = leer('clientes/index.html');
const DATOS = leer('pruebas/levantamiento-iva-datos.js'), DD = leer('pruebas/levantamiento-detalle-datos.js'), DR = leer('pruebas/levantamiento-rectificar-datos.js');
const LOGO = Deno.readFileSync(new URL('assets/logo-blanco.png', RAIZ));
const SRI = /EXCELJS_SRI = '(sha384-[^']+)'/.exec(JD)![1], URLX = /EXCELJS_URL = '([^']+)'/.exec(JD)![1];
const EXCEL_BROWSER = new Uint8Array(await (await fetch(URLX)).arrayBuffer());
const sri = 'sha384-' + btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest('SHA-384', EXCEL_BROWSER))));
const EXCEL_SRC = new TextDecoder().decode(EXCEL_BROWSER);
const pz = (n: number) => (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString('es-CL');

// ── 0. Integración y estándar ──
const i2 = HTML.indexOf('<script src="levantamiento-detalle.js">'), iR = HTML.indexOf('<script src="levantamiento-rectificar.js">'), iA = HTML.indexOf('<script src="../auth.js">');
res('0.1 levantamiento-rectificar.js se carga tras el detalle y antes de auth.js', i2 > 0 && iR > i2 && iA > iR);
res('0.2 sin SB_KEY, sbH propio ni Bearer', !/SB_KEY|function sbH|Bearer/.test(JR));
res('0.3 sin innerHTML (todo con textContent)', !/innerHTML/.test(JR));
res('0.4 sin emojis', !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(JR + JS));
res('0.5 nunca «honorarios»; dice «nuestros servicios»', !/honorario/i.test(JR + JS + JD) && /nuestros servicios/.test(JR));
res('0.6 usa la RPC public.sii_levantamiento_rectificar_todo', /'sii_levantamiento_rectificar_todo'/.test(JR));
res('0.7 datos de demo sin RUT reales (solo ficticios)', !/\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]/.test(DR));

function pagina(resp: (path: string, body: any) => [number, unknown]) {
  const dom = new JSDOM(`<!doctype html><head></head><body><div id="det-liva"></div></body>`, { runScripts: 'outside-only', url: 'https://gestoor.contadoor.cl/clientes/' });
  const w: any = dom.window; const llam: any[] = []; const impresiones: string[] = []; const descargas: any[] = [];
  w.gIcon = (n: string) => `<svg data-i="${n}"></svg>`;
  w.sbFetch = (p: string, o: any) => { const b = JSON.parse(o.body || '{}'); llam.push([p, b]); const [st, j] = resp(p, b);
    return Promise.resolve({ ok: st === 200, status: st, text: () => Promise.resolve(JSON.stringify(j)) }); };
  w.fetch = (u: string) => Promise.resolve({ ok: /logo-blanco\.png$/.test(String(u)), arrayBuffer: () => Promise.resolve(LOGO.buffer.slice(LOGO.byteOffset, LOGO.byteOffset + LOGO.byteLength)) });
  if (sri === SRI) w.eval(EXCEL_SRC);
  w.eval(DATOS); w.eval(DD); w.eval(DR); w.eval(JS); w.eval(JD); w.eval(JR);
  w.GestoorLevDetalle.alDescargar = (nombre: string, buf: Uint8Array) => { descargas.push({ nombre, buf }); };
  const desc = Object.getOwnPropertyDescriptor(w.HTMLIFrameElement.prototype, 'srcdoc');
  Object.defineProperty(w.HTMLIFrameElement.prototype, 'srcdoc', { configurable: true, set(v: string) { if (this.id === 'livd-pdf-frame' || this.id === 'liva-pdf-frame') impresiones.push(v); this.setAttribute('data-srcdoc', v); desc && desc.set && desc.set.call(this, v); }, get() { return this.getAttribute('data-srcdoc'); } });
  return { w, d: w.document as Document, llam, impresiones, descargas };
}
const C = { id: 9001, razon: 'Empresa Ficticia SpA', rut: '76.000.000-0' };
const respuestas = (w: any, esc: string, extra: Record<string, [number, unknown]> = {}) => (p: string, b: any): [number, unknown] => {
  if (extra[p]) return extra[p];
  if (p === 'rpc/sii_levantamiento_iva') return [200, w.LIVA_DEMO];
  if (p === 'rpc/sii_historia_origenes') return [200, { meses: [] }];
  if (p === 'rpc/sii_levantamiento_rectificar_todo') return [200, w[esc]];
  if (p === 'rpc/sii_levantamiento_detalle_mes') return [200, w.LIVD_DETALLE];
  if (p === 'rpc/sii_documentos_periodo') return [200, w.LIVD_DOCS[b.p_libro]];
  if (p === 'rpc/sii_levantamiento_borrador_f29') return [200, w.LIVD_BORRADOR];
  if (p === 'rpc/sii_levantamiento_registrar_exportacion' || p === 'rpc/sii_levantamiento_registrar_pdf') return [200, { registrado: true, bitacora_id: 1 }];
  return [404, { code: 'PGRST202' }];
};
async function calcular(P: ReturnType<typeof pagina>) {
  P.w.GestoorLevIVA.montar(P.d.getElementById('det-liva'), C, { esMaster: true });
  (P.d.getElementById('liva-abrir') as HTMLElement).click();
  res('1.0 «Si rectificamos todo» deshabilitado antes de calcular', (P.d.getElementById('liva-rectificar-todo') as HTMLButtonElement)?.disabled === true);
  (P.d.getElementById('liva-calcular') as HTMLElement).click(); await espera();
}
const txt = (d: Document, id: string) => (d.getElementById(id)?.textContent || '').replace(/\s+/g, ' ');

// ── 1. Panel con el remanente que afecta F29 fuera del rango ──
{
  let w: any; const P = pagina((p, b) => respuestas(w, 'LIVR_PARCIAL')(p, b)); w = P.w; const { d, llam } = P;
  await calcular(P);
  const bR = d.getElementById('liva-rectificar-todo') as HTMLButtonElement;
  res('1.1 botón habilitado tras Calcular', bR && !bR.disabled);
  bR.click(); await espera();
  const q = llam.find((x) => x[0] === 'rpc/sii_levantamiento_rectificar_todo');
  res('1.2 llama a la RPC con el rango y las opciones del último cálculo', q && q[1].p_cliente_id === 9001 && q[1].p_desde === w.LIVA_DEMO.desde && q[1].p_hasta === w.LIVA_DEMO.hasta && q[1].p_opciones.medio === 'internet', q);
  const E = w.LIVR_PARCIAL, T = E.totales.todo;
  const r = txt(d, 'livr-resumen');
  res('1.3 recuadro: F29 a rectificar N', /F29 a rectificar4/.test(r), r);
  res('1.4 recuadro: total a pagar del servidor (impuesto + reajuste + intereses + multa)', r.includes(pz(T.total)) && r.includes('Impuesto ' + pz(T.impuesto)) && r.includes('multa ' + pz(T.multa)), r);
  res('1.5 recuadro: remanente hoy $X → $Y', r.includes(pz(E.traspaso.declarado) + ' → ' + pz(E.traspaso.corregido)), r);
  const tr = txt(d, 'livr-traspaso');
  res('1.6 frase del traspaso: «pasa de $X a $Y (−$Z)»', tr === `Al rectificar, el remanente que hoy arrastra el cliente (cód. 77 de mar 2026) pasa de ${pz(E.traspaso.declarado)} a ${pz(E.traspaso.corregido)} (${pz(E.traspaso.diferencia)}).`, tr);
  const fu = txt(d, 'livr-fuera');
  res('1.7 advierte y lista los F29 posteriores afectados', /Ese menor remanente afecta los F29 ya declarados después del rango: abr 2026, may 2026\. También deben rectificarse/.test(fu) && /se agota en may 2026/.test(fu), fu);
  const filas = Array.from(d.querySelectorAll('#livr-tabla tbody tr')) as HTMLElement[];
  res('1.8 tabla mes a mes con los meses del rango y los de fuera', filas.length === 5 && filas.map((f) => f.getAttribute('data-periodo')).join() === '202601,202602,202603,202604,202605');
  res('1.9 colores: gris sin cambio, ámbar solo remanente, rojo IVA a pagar', filas.map((f) => f.className.split(' ')[1]).join() === 'gris,amb,amb,roj,roj', filas.map((f) => f.className));
  res('1.10 meses fuera del rango marcados', filas.filter((f) => f.classList.contains('fuera')).length === 2 && /Fuera del rango/.test(filas[3].textContent!));
  const c4 = Array.from(filas[3].querySelectorAll('td')).map((x) => x.textContent);
  const m4 = E.meses[3];
  res('1.11 columnas 504/77/89 declarado y corregido, a pagar, cargos y total', c4[0] === '3' && c4[3] === pz(m4.c504.declarado) && c4[4] === pz(m4.c504.corregido) && c4[5] === pz(m4.c77.declarado) && c4[6] === pz(0) &&
    c4[8] === pz(m4.c89.corregido) && c4[9] === pz(m4.iva_a_pagar) && c4[10] === pz(m4.estimacion.reajuste + m4.estimacion.intereses + m4.estimacion.multa) && c4[11] === pz(m4.estimacion.total), c4);
  res('1.12 orden de rectificación (paso 1..4) en la tabla y en la línea de tiempo', filas.map((f) => f.querySelector('td')!.textContent).join() === '—,1,2,3,4' &&
    Array.from(d.querySelectorAll('#livr-linea .livr-m')).map((x) => (x as HTMLElement).className.replace('livr-m ', '')).join() === 'gris,amb,amb,roj fuera,roj fuera');
  res('1.13 texto explicativo simple para el analista', /del mes más antiguo al más reciente/.test(txt(d, 'livr-explicacion')) && /cód\. 504/.test(txt(d, 'livr-explicacion')));
  res('1.14 totales al pie', txt(d, 'livr-totales').includes(pz(T.total)) && txt(d, 'livr-totales').includes(pz(T.impuesto)));
  res('1.15 aviso de estimación preliminar y sin el costo de nuestros servicios', /Estimación preliminar/.test(d.getElementById('livr-cuerpo')!.textContent!) && /nuestros servicios/.test(d.getElementById('livr-cuerpo')!.textContent!));

  // ── 2. Otros cargos / multa adicional (ingresado a mano) ──
  d.getElementById('livr-velo')!.querySelector('.liva-x')!.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  const antes = txt(d, 'liva-regularizar');
  (d.getElementById('liva-otros-monto') as HTMLInputElement).value = '150.000';
  (d.getElementById('liva-otros-sumar') as HTMLElement).click();
  res('2.1 sin motivo no se suma (motivo obligatorio)', txt(d, 'liva-regularizar') === antes && /motivo es obligatorio/.test(txt(d, 'liva-msg')));
  (d.getElementById('liva-otros-monto') as HTMLInputElement).value = '-5';
  (d.getElementById('liva-otros-motivo') as HTMLInputElement).value = 'Multa art. 97 N°1';
  (d.getElementById('liva-otros-sumar') as HTMLElement).click();
  res('2.2 monto inválido no se suma', txt(d, 'liva-regularizar') === antes && /entero mayor que cero/.test(txt(d, 'liva-msg')));
  (d.getElementById('liva-otros-monto') as HTMLInputElement).value = '150.000';
  (d.getElementById('liva-otros-sumar') as HTMLElement).click();
  const reg = txt(d, 'liva-regularizar');
  res('2.3 se suma al total del levantamiento, rotulado «ingresado a mano»', /incluye \$150\.000 de otros cargos ingresados a mano \(Multa art\. 97 N°1\)/.test(reg) && /No calculable \+ \$150\.000 ingresado a mano|\$/.test(reg) && reg !== antes, reg);
  res('2.4 queda visible y se puede quitar', /Ingresado a mano: \$150\.000 · Multa art\. 97 N°1/.test(txt(d, 'liva-otros')) && !!d.getElementById('liva-otros-quitar'));
  (d.getElementById('liva-rectificar-todo') as HTMLElement).click(); await espera();
  const r2 = txt(d, 'livr-resumen');
  res('2.5 se suma al total del escenario', r2.includes(pz(T.total + 150000)) && /otros cargos \$150\.000 \(ingresado a mano: Multa art\. 97 N°1\)/.test(r2), r2);
  res('2.6 fila «ingresado a mano» al pie de la tabla', /Otros cargos \/ multa adicional · ingresado a mano: Multa art\. 97 N°1/.test(txt(d, 'livr-otros')));
  res('2.7 no se guarda en la base (ninguna RPC recibe el monto)', !llam.some((x) => JSON.stringify(x[1]).includes('150000')));
  const n1 = llam.filter((x) => x[0] === 'rpc/sii_levantamiento_rectificar_todo').length;
  res('2.8 el escenario se pide una vez por cálculo (caché)', n1 === 1, n1);

  // ── 3. PDF «Borradores F29» con la página del escenario al inicio ──
  (d.getElementById('livr-pdf') as HTMLElement).click(); await espera(60);
  const pdf = P.impresiones[P.impresiones.length - 1] || '';
  const iE = pdf.indexOf('<h1>Si rectificamos todo</h1>'), iB = pdf.indexOf('<h1>Borradores de F29 a rectificar</h1>');
  res('3.1 PDF: página «Si rectificamos todo» al inicio, antes del resumen de borradores', iE > 0 && iB > iE, [iE, iB]);
  res('3.2 PDF: traspaso, F29 posteriores, otros cargos rotulados y total con otros cargos', pdf.includes('pasa de ' + pz(E.traspaso.declarado)) && pdf.includes('abr 2026, may 2026') && pdf.includes('ingresado a mano: Multa art. 97 N°1') && pdf.includes(pz(T.total + 150000)));
  res('3.3 PDF: filas coloreadas (rojo IVA a pagar, ámbar solo remanente) y fuera del rango', /<tr class="rojf"><td>3<\/td><td class="g">abr 2026 <i>\(fuera del rango\)<\/i>/.test(pdf) && /<tr class="amb"><td>1<\/td>/.test(pdf));
  res('3.4 PDF: registra en la bitácora antes de imprimir (borrador_pdf_todos)', llam.some((x) => x[0] === 'rpc/sii_levantamiento_registrar_exportacion' && x[1].p_tipo === 'borrador_pdf_todos'));
  res('3.5 PDF: texto escapado (sin < de datos)', !/<script/i.test(pdf));

  // ── 4. Excel con hoja «Rectificar todo» ──
  (d.getElementById('livr-excel') as HTMLElement).click();
  for (let i = 0; i < 120 && !P.descargas.length; i++) await espera(50);
  res('4.1 descarga el Excel', P.descargas.length === 1, P.descargas.length);
  if (P.descargas.length) {
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(P.descargas[0].buf);
    const nombres = wb.worksheets.map((x) => x.name);
    res('4.2 hoja «Rectificar todo» después del Resumen', nombres[0] === 'Resumen' && nombres[1] === 'Rectificar todo', nombres);
    const ws = wb.getWorksheet('Rectificar todo')!;
    const filasX: any[] = []; ws.eachRow((r) => filasX.push(r.values));
    const busca = (t: string) => filasX.find((v) => (v as any[]).some((x) => x === t)) as any[];
    res('4.3 total del servidor, otros cargos ingresados a mano y total con otros cargos', busca('Total estimado (servidor)')?.[4] === T.total && busca('Otros cargos / multa adicional')?.[4] === 150000 && /ingresado a mano: Multa/.test(busca('Otros cargos / multa adicional')?.[5]) && busca('Total a pagar con otros cargos')?.[4] === T.total + 150000);
    res('4.4 remanente hoy → corregido', busca('Remanente corregido')?.[4] === E.traspaso.corregido);
    const fa = filasX.find((v) => v[2] === 'abr 2026 (fuera)');
    res('4.5 filas mes a mes con 504/77/89 y montos', fa && fa[1] === 3 && fa[4] === E.meses[3].c504.declarado && fa[5] === E.meses[3].c504.corregido && fa[14] === E.meses[3].estimacion.total, fa);
    let colorRoj = false, colorAmb = false, fila = 0;
    ws.eachRow((r, i) => { if (r.getCell(2).value === 'abr 2026 (fuera)') colorRoj = (r.getCell(3).fill as any)?.fgColor?.argb === 'FFFBE4E1'; if (r.getCell(2).value === 'feb 2026') { colorAmb = (r.getCell(3).fill as any)?.fgColor?.argb === 'FFFFF1D6'; fila = i; } });
    res('4.6 gráfica Contadoor: colores por categoría y franja morada', colorRoj && colorAmb && (ws.getCell('A1').fill as any)?.fgColor?.argb === 'FF924893', [colorRoj, colorAmb, fila]);
    const tot = filasX.find((v) => v[1] === 'Totales');
    res('4.7 fila Totales con fórmula SUM', tot && typeof tot[14] === 'object' && /^SUM\(N/.test(tot[14].formula) && tot[14].result === T.total, tot && tot[14]);
    const rs = wb.getWorksheet('Resumen')!; const vr: any[] = []; rs.eachRow((r) => vr.push(r.values));
    res('4.8 Resumen del Excel: otros cargos rotulados', vr.some((v) => v[1] === 'Otros cargos / multa adicional (ingresado a mano)' && v[2] === 150000) && vr.some((v) => v[1] === 'Motivo de otros cargos' && v[2] === 'Multa art. 97 N°1'));
  }
}

// ── 5. Pagó de más (verde) e IVA pagado de más informativo ──
{
  let w: any; const P = pagina((p, b) => respuestas(w, 'LIVR_TODO')(p, b)); w = P.w; const { d } = P;
  await calcular(P);
  (d.getElementById('liva-rectificar-todo') as HTMLElement).click(); await espera();
  const filas = Array.from(d.querySelectorAll('#livr-tabla tbody tr')) as HTMLElement[];
  res('5.1 colores con pagó de más en verde', filas.map((f) => f.className.split(' ')[1]).join() === 'gris,amb,amb,roj,roj,ver,gris', filas.map((f) => f.className));
  res('5.2 «IVA pagado de más» informativo, no se descuenta', /IVA pagado de más\$6\.000Informativo: posible devolución o imputación aparte \(no se descuenta\)/.test(txt(d, 'livr-resumen')));
  res('5.3 total = el del servidor (no resta lo pagado de más)', txt(d, 'livr-resumen').includes(pz(w.LIVR_TODO.totales.todo.total)));
  res('5.4 sin F29 posteriores: no muestra advertencia de fuera de rango si el remanente no cambia', !d.getElementById('livr-fuera'));
}

// ── 6. RPC no instalada / sin permiso ──
{
  let w: any; const P = pagina((p, b) => respuestas(w, 'LIVR_PARCIAL', { 'rpc/sii_levantamiento_rectificar_todo': [404, { code: 'PGRST202' }] })(p, b)); w = P.w; const { d } = P;
  await calcular(P);
  (d.getElementById('liva-rectificar-todo') as HTMLElement).click(); await espera();
  res('6.1 si la RPC no está instalada, lo dice (no inventa nada)', /aún no está instalado/.test(txt(d, 'livr-msg')) && !d.getElementById('livr-tabla'));
  d.getElementById('livr-velo')!.querySelector('.liva-x')!.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  (d.getElementById('liva-borradores') as HTMLElement).click(); await espera(60);
  const pdf = P.impresiones[P.impresiones.length - 1] || '';
  res('6.2 «Borradores F29» sigue funcionando sin la página del escenario y lo avisa', pdf.includes('Borradores de F29 a rectificar') && !pdf.includes('<h1>Si rectificamos todo</h1>') && /aún no está instalada/.test(txt(d, 'liva-msg')));
}
{
  let w: any; const P = pagina((p, b) => respuestas(w, 'LIVR_PARCIAL', { 'rpc/sii_levantamiento_rectificar_todo': [403, { code: '42501', message: 'SIN_PERMISO' }] })(p, b)); w = P.w; const { d } = P;
  await calcular(P);
  (d.getElementById('liva-rectificar-todo') as HTMLElement).click(); await espera();
  res('6.3 42501: mensaje de permiso', /Solo el Master o el analista contable asignado/.test(txt(d, 'livr-msg')));
  d.getElementById('livr-velo')!.querySelector('.liva-x')!.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  (d.getElementById('liva-borradores') as HTMLElement).click(); await espera(60);
  res('6.4 42501 en el escenario detiene «Borradores F29» (fail-closed)', P.impresiones.length === 0 && /Solo el Master/.test(txt(d, 'liva-msg')));
}
// ── 7. Ayudantes puros ──
{
  const P = pagina(() => [404, {}]); const L = P.w.GestoorLevIVA, R = P.w.GestoorLevRect;
  res('7.1 validarOtros: acepta «$1.500.000» y exige motivo', L.validarOtros('$1.500.000', 'Multa 97 N°1').monto === 1500000 && !!L.validarOtros('1000', ' ').error && !!L.validarOtros('12,5', 'x y z').error);
  res('7.2 aRegularizar sin otros cargos no cambia', L.aRegularizar({ estimacion: { total: 1000, conocido: { meses: 1 } } }).valor === '$1.000' && L.aRegularizar({ estimacion: { total: 1000, conocido: { meses: 1 } } }, { monto: 500, motivo: 'm' }).valor === '$1.500');
  res('7.3 total del escenario no calculable no se fabrica', R.totalEscenario({ totales: { todo: { total: null } } }, { monto: 10 }).texto === 'No calculable + $10 ingresado a mano');
}
console.log(`\n${ok} OK · ${mal} MAL`);
if (mal) Deno.exit(1);
