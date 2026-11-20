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
  res('2.6 alerta con HTML se pinta como texto (sin XSS)', !w.__xss && d.querySelector('#liva-tabla tr.det ul li')!.textContent!.includes('<img'));
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

console.log(`\n${ok} OK · ${mal} MAL`);
if (mal) Deno.exit(1);
