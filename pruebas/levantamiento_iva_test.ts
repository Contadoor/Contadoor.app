// LEVANTAMIENTO-IVA · prueba LOCAL del front en jsdom con sbFetch simulado. Datos 100 % ficticios.
// Uso: deno run --allow-read --allow-env --allow-sys --allow-net=registry.npmjs.org pruebas/levantamiento_iva_test.ts
import { JSDOM } from 'npm:jsdom@24.1.0';
const RAIZ = new URL('../', import.meta.url);
const leer = (p: string) => Deno.readTextFileSync(new URL(p, RAIZ));
let ok = 0, mal = 0;
const res = (n: string, b: boolean, d: unknown = '') => { if (b) { ok++; console.log('OK  ', n); } else { mal++; console.log('MAL ', n, JSON.stringify(d)); } };
const espera = (ms = 20) => new Promise((r) => setTimeout(r, ms));
const JS = leer('clientes/levantamiento-iva.js'), HTML = leer('clientes/index.html'), DATOS = leer('pruebas/levantamiento-iva-datos.js');

// ── 0. Integración y estándar ──
const iSii = HTML.indexOf('<script src="sii-cartapra.js">'), iLiv = HTML.indexOf('<script src="levantamiento-iva.js">'), iAuth = HTML.indexOf('<script src="../auth.js">'), iSup = HTML.indexOf('<script src="../supabase.js">');
res('0.1 levantamiento-iva.js se carga después de supabase.js y sii-cartapra.js, y antes de auth.js', iSup > 0 && iSii > iSup && iLiv > iSii && iAuth > iLiv);
res('0.2 la ficha monta el botón con id, razón, RUT y la sesión', /GestoorLevIVA\.montar\(g\('det-liva'\), \{ id: c\.id, razon: c\.razon, rut: c\.rut \}, window\._contadoorSesion\)/.test(HTML) && /id="det-liva"/.test(HTML));
res('0.3 sin SB_KEY, sbH propio, Bearer ni fetch directo (solo sbFetch)', !/SB_KEY|function sbH|Bearer|\bfetch\(/.test(JS) && /raiz\.sbFetch/.test(JS));
res('0.4 innerHTML solo con íconos (gIcon)', (JS.match(/innerHTML\s*=\s*[^;]+/g) || []).every((x) => /gIcon/.test(x)));
res('0.5 sin emojis', !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(JS));
res('0.6 nunca dice «honorarios» (al cliente: «nuestros servicios»)', !/honorario/i.test(JS) && /nuestros servicios/.test(JS));

function pagina(resp: (path: string, body: any) => [number, unknown]) {
  const dom = new JSDOM(`<!doctype html><head></head><body><div id="det-liva"></div></body>`, { runScripts: 'outside-only', url: 'https://gestoor.contadoor.cl/clientes/' });
  const w: any = dom.window; const llam: any[] = [];
  w.gIcon = (n: string) => `<svg data-i="${n}"></svg>`;
  w.sbFetch = (p: string, o: any) => { const b = JSON.parse(o.body || '{}'); llam.push([p, b]); const [st, j] = resp(p, b);
    return Promise.resolve({ ok: st === 200, status: st, text: () => Promise.resolve(JSON.stringify(j)) }); };
  w.eval(DATOS); w.eval(JS);
  return { w, d: w.document as Document, llam };
}

// ── 1. Permisos de UI ──
{
  const { w, d } = pagina(() => [200, {}]);
  const C = { id: 9001, razon: 'Empresa Ficticia SpA', rut: '76.000.000-0' };
  for (const [s, ve] of [[{ esMaster: true }, true], [{ rol: 'contable' }, true], [{ rol: 'master' }, true], [{ rol: 'rrhh' }, false], [{ rol: 'pagos' }, false], [null, false]] as const) {
    w.GestoorLevIVA.montar(d.getElementById('det-liva'), C, s);
    res(`1. botón ${ve ? 'visible' : 'oculto'} para ${JSON.stringify(s)}`, !!d.getElementById('liva-abrir') === ve);
  }
  const r = w.GestoorLevIVA.rangoPorDefecto(new Date(2026, 10, 20));
  res('1.7 rango por defecto: 36 meses cerrados (nov-2023 a oct-2026)', r.desde === '2023-11' && r.hasta === '2026-10', r);
}

// ── 2. Calcular: llamada, tabla, colores, sin datos, XSS ──
{
  const { w, d, llam } = pagina((p) => p === 'rpc/sii_levantamiento_iva' ? [200, (globalThis as any).x ?? null] : [200, {}]);
  const demo = w.LIVA_DEMO; demo.meses[5].alertas = ['<img src=x onerror="window.__xss=1">'];
  (globalThis as any).x = demo;
  const C = { id: 9001, razon: '<b>Empresa</b> Ficticia', rut: '76.000.000-0' };
  w.GestoorLevIVA.montar(d.getElementById('det-liva'), C, { esMaster: true });
  (d.getElementById('liva-abrir') as HTMLElement).click();
  res('2.1 abre el diálogo con el nombre como texto (no HTML)', !!d.getElementById('liva-velo') && d.querySelector('.liva-cab h3 span')!.textContent!.includes('<b>Empresa</b>'));
  (d.getElementById('liva-desde') as HTMLInputElement).value = '2023-11'; (d.getElementById('liva-hasta') as HTMLInputElement).value = '2026-10';
  (d.getElementById('liva-calcular') as HTMLElement).click(); await espera();
  const [p, b] = llam[0] ?? [];
  res('2.2 llama rpc/sii_levantamiento_iva con cliente, AAAAMM y opciones', p === 'rpc/sii_levantamiento_iva' && b.p_cliente_id === 9001 && b.p_desde === '202311' && b.p_hasta === '202610' && b.p_opciones && b.p_opciones.fiscalizacion === false, b);
  const filas = d.querySelectorAll('#liva-tabla tr.fila');
  res('2.3 36 filas mes a mes', filas.length === 36, filas.length);
  const est = (e: string) => d.querySelectorAll(`#liva-tabla tr.fila[data-estado="${e}"]`);
  res('2.4 colores: calza verde, diferencia/no declarado rojo, sin datos gris',
    Array.from(est('calza')).every((f: any) => f.classList.contains('ver')) && Array.from(est('diferencia')).every((f: any) => f.classList.contains('roj'))
    && Array.from(est('no_declarado')).every((f: any) => f.classList.contains('roj')) && Array.from(est('sin_datos')).every((f: any) => f.classList.contains('gris')) && est('diferencia').length === 3);
  const sd = est('sin_datos')[0] as HTMLElement;
  res('2.5 mes sin datos muestra «—», nunca $0', Array.from(sd.querySelectorAll('td')).slice(2).every((td) => td.textContent === '—' || td.textContent === ''), sd.textContent);
  res('2.6 alerta con HTML se pinta como texto (sin XSS)', !w.__xss && Array.from(d.querySelectorAll('#liva-tabla tr.det ul li')).some((li) => li.textContent!.includes('<img')) && !d.querySelector('#liva-tabla img'));
  (filas[9] as HTMLElement).click();
  res('2.7 clic en un mes abre su detalle (estimación)', !(filas[9].nextElementSibling as HTMLElement).hidden && /meses de atraso/.test(filas[9].nextElementSibling!.textContent!));
  res('2.8 resumen y aviso «VERIFICAR»', /calzan/.test(d.getElementById('liva-msg')!.textContent!) && /VERIFICAR/.test(d.querySelector('.liva-aviso')!.textContent!));
  res('2.9 Exportar PDF habilitado tras calcular', !(d.getElementById('liva-pdf') as HTMLButtonElement).disabled);
  const pdf = w.GestoorLevIVA.documentoPdf(demo, C, 'https://gestoor.contadoor.cl/assets/logo-blanco.png');
  res('2.10 PDF: marca (#924893, Montserrat/Inter, logo blanco), escapado, «nuestros servicios», «VERIFICAR», 36 filas',
    /#924893/.test(pdf) && /Montserrat/.test(pdf) && /Inter/.test(pdf) && /logo-blanco\.png/.test(pdf) && pdf.includes('&lt;b&gt;Empresa') && !pdf.includes('<b>Empresa')
    && /nuestros servicios/.test(pdf) && /VERIFICAR/.test(pdf) && !/honorario/i.test(pdf) && (pdf.match(/<tr class="/g) || []).length === 36);
  res('2.11 título del PDF = nombre de archivo limpio', /<title>Levantamiento_IVA_b_Empresa_b_Ficticia_202311-202610<\/title>/.test(pdf), pdf.slice(0, 200));
}

// ── 3. Errores y pedir historial ──
{
  let modo = '42501';
  const { w, d, llam } = pagina((p) => {
    if (p === 'rpc/sii_levantamiento_pedir_historial') return [200, { estado: 'encolado', trabajo_id: 5, lecturas: 25, minutos_estimados: 6 }];
    if (modo === '42501') return [403, { code: '42501', message: 'SIN_PERMISO' }];
    if (modo === 'no') return [404, { code: 'PGRST202' }];
    return [400, { code: '22023', message: 'RANGO_MAXIMO_60_MESES' }];
  });
  w.GestoorLevIVA.montar(d.getElementById('det-liva'), { id: 9001, razon: 'X' }, { rol: 'contable' });
  (d.getElementById('liva-abrir') as HTMLElement).click();
  const calc = async () => { (d.getElementById('liva-calcular') as HTMLElement).click(); await espera(); return d.getElementById('liva-msg')!.textContent!; };
  res('3.1 sin permiso (42501) → aviso claro', /analista contable asignado/.test(await calc()));
  modo = 'no'; res('3.2 RPC no instalada → aviso', /no está instalado/.test(await calc()));
  modo = 'rango'; res('3.3 rango > 60 meses → aviso', /60 meses/.test(await calc()));
  res('3.4 Exportar PDF sigue deshabilitado si no hay datos', (d.getElementById('liva-pdf') as HTMLButtonElement).disabled);
  (d.getElementById('liva-historial') as HTMLElement).click(); await espera();
  const u = llam[llam.length - 1];
  res('3.5 Pedir historial llama la RPC con el rango y avisa cuántas lecturas', u[0] === 'rpc/sii_levantamiento_pedir_historial' && u[1].p_cliente_id === 9001 && /25 lecturas/.test(d.getElementById('liva-msg')!.textContent!), u);
  const ev = new w.KeyboardEvent('keydown', { key: 'Escape' }); d.dispatchEvent(ev);
  res('3.6 Escape cierra el diálogo', !d.getElementById('liva-velo'));
}

// ── 4. R2: estados nuevos, condicionados, totales no calculables, medio, PDF con aviso y bitácora ──
{
  let pdfModo = 'ok';
  const { w, d, llam } = pagina((p) => {
    if (p === 'rpc/sii_levantamiento_iva') return [200, w.LIVA_DEMO];
    if (p === 'rpc/sii_levantamiento_registrar_pdf') return pdfModo === 'ok' ? [200, { registrado: true, bitacora_id: 3 }] : [403, { code: '42501', message: 'SIN_PERMISO' }];
    if (p === 'rpc/sii_levantamiento_pedir_historial') return [200, { estado: 'encolado', trabajo_id: 6, lecturas: 9, omitidos_no_disponibles: 4, minutos_estimados: 6 }];
    return [404, { code: 'PGRST202' }];
  });
  const C = { id: 9001, razon: 'Empresa Ficticia SpA', rut: '76.000.000-0' };
  w.GestoorLevIVA.montar(d.getElementById('det-liva'), C, { esMaster: true });
  (d.getElementById('liva-abrir') as HTMLElement).click();
  (d.getElementById('liva-desde') as HTMLInputElement).value = '2023-11'; (d.getElementById('liva-hasta') as HTMLInputElement).value = '2026-10';
  (d.getElementById('liva-medio') as HTMLSelectElement).value = 'papel';
  (d.getElementById('liva-calcular') as HTMLElement).click(); await espera();
  res('4.1 envía el medio de declaración (papel = día 12)', llam[0][1].p_opciones.medio === 'papel', llam[0][1]);
  const est = (e: string) => Array.from(d.querySelectorAll(`#liva-tabla tr.fila[data-estado="${e}"]`)) as HTMLElement[];
  res('4.2 provisionales en ámbar (coincidencia provisional, diferencia preliminar, revisar arrastre)',
    ['coincidencia_provisional', 'diferencia_preliminar', 'revisar_arrastre'].every((e) => est(e).length === 1 && est(e).every((f) => f.classList.contains('amb'))));
  const f29 = est('f29_sin_montos');
  res('4.3 «F29 sin montos» (gris) muestra el IVA del RCV, no «—»', f29.length === 2 && f29.every((f) => f.classList.contains('gris') && f.querySelectorAll('td')[2].textContent !== '—' && /F29 sin montos/.test(f.textContent!)));
  (f29[0] as HTMLElement).click();
  res('4.4 detalle: «F29 sin montos en Cartapra»', /F29 sin montos en Cartapra/.test(f29[0].nextElementSibling!.textContent!));
  const cond = Array.from(d.querySelectorAll('#liva-tabla tr.fila[data-condicionado="1"]')) as HTMLElement[];
  res('4.5 meses condicionados marcados («Condicionado») y remanente desconocido como supuesto', cond.length === 2 && cond.every((f) => /Condicionado/.test(f.textContent!)) && /Desconocido \(supuesto \$0\)/.test(cond[0].textContent!));
  const nd = est('no_declarado')[0];
  (nd as HTMLElement).click();
  res('4.6 «Sin declaración encontrada» + «No se encontró declaración en los antecedentes disponibles» (no afirma omisión)',
    /Sin declaración encontrada/.test(nd.textContent!) && /No se encontró declaración en los antecedentes disponibles/.test(nd.nextElementSibling!.textContent!) && !/No declarado/.test(d.getElementById('liva-tabla')!.textContent!));
  res('4.7 calce dentro de tolerancia: «Calza (±$100)»', /Calza \(±\$100\)/.test(d.getElementById('liva-tabla')!.textContent!));
  const tarj = Array.from(d.querySelectorAll('.liva-dato')).map((x) => x.textContent);
  res('4.8 totales: «Total estimado» No calculable + subtotal conocido + provisional + sin calcular', tarj.some((x) => /Total estimado\s*No calculable/.test(x!)) &&
    tarj.some((x) => /Subtotal conocido/.test(x!)) && tarj.some((x) => /Provisional \(1 mes\)/.test(x!)) && tarj.some((x) => /Sin calcular \(1 mes\)/.test(x!)), tarj);
  const filaNC = est('diferencia').find((f) => /No calculable/.test(f.textContent!)), filaPrev = est('diferencia_preliminar')[0];
  res('4.9 mes sin reajuste = «No calculable»; mes preliminar = «(provisional)»', !!filaNC && /\(provisional\)/.test(filaPrev.textContent!));
  const pdf = w.GestoorLevIVA.documentoPdf(w.LIVA_DEMO, C, 'https://gestoor.contadoor.cl/assets/logo-blanco.png');
  res('4.10 PDF con aviso visible «Estimación preliminar, no constituye determinación definitiva», condicionados y total no calculable',
    /<p class="prel">Estimación preliminar, no constituye determinación definitiva<\/p>/.test(pdf) && /Condicionado/.test(pdf) && /No calculable/.test(pdf) && /Sin declaración encontrada/.test(pdf) && !/honorario/i.test(pdf));
  (d.getElementById('liva-pdf') as HTMLElement).click(); await espera();
  res('4.11 Exportar PDF registra en la bitácora ANTES de imprimir', llam.some((x) => x[0] === 'rpc/sii_levantamiento_registrar_pdf' && x[1].p_cliente_id === 9001 && x[1].p_desde === '202311') && !!d.getElementById('liva-pdf-frame'));
  d.getElementById('liva-pdf-frame')!.remove(); pdfModo = 'no';
  (d.getElementById('liva-pdf') as HTMLElement).click(); await espera();
  res('4.12 si la bitácora falla (42501) no se exporta (fail-closed) y se avisa', !d.getElementById('liva-pdf-frame') && /analista contable asignado/.test(d.getElementById('liva-msg')!.textContent!));
  (d.getElementById('liva-historial') as HTMLElement).click(); await espera();
  res('4.13 historial: informa lo que no se repite y que avisará en la campana', /4 lecturas no se repiten/.test(d.getElementById('liva-msg')!.textContent!) && /campana/.test(d.getElementById('liva-msg')!.textContent!));
}

console.log(`\n${ok} OK · ${mal} MAL`);
if (mal) Deno.exit(1);
