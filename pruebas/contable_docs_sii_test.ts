// Reporte Contable · «Documentos contables del período» con datos del SII (19-11). Prueba LOCAL en jsdom con sbFetch simulado.
// Datos 100 % ficticios. Uso: deno run --allow-read --allow-env --allow-sys --allow-net=registry.npmjs.org pruebas/contable_docs_sii_test.ts
import { JSDOM } from 'npm:jsdom@24.1.0';
const RAIZ = new URL('../', import.meta.url);
const leer = (p: string) => Deno.readTextFileSync(new URL(p, RAIZ));
let ok = 0, mal = 0;
const res = (n: string, b: boolean, d: unknown = '') => { if (b) { ok++; console.log('OK  ', n); } else { mal++; console.log('MAL ', n, JSON.stringify(d)); } };
const espera = (ms = 15) => new Promise((r) => setTimeout(r, ms));
const JS = leer('reportes-contable/docs-sii.js'), HTML = leer('reportes-contable/index.html'), MENU = leer('assets/gestoor-menu.js');
const SII = leer('clientes/sii-cartapra.js'), CL = leer('clientes/index.html');

// ── 0. Integración y estándar de módulo ──
const iSup = HTML.indexOf('<script src="../supabase.js">'), iDoc = HTML.indexOf('<script src="docs-sii.js'), iAuth = HTML.indexOf('<script src="../auth.js">');
res('0.1 docs-sii.js se carga después de supabase.js y antes de auth.js', iSup > 0 && iDoc > iSup && iAuth > iDoc);
res('0.2 docs-sii.js sin SB_KEY, sbH propio, Bearer ni fetch directo (solo sbFetch de supabase.js)', !/SB_KEY|function sbH|Bearer|\bfetch\(/.test(JS) && /raiz\.sbFetch/.test(JS));
res('0.3 innerHTML solo con íconos (gIcon/LUPA/CHEV), nunca con datos', (JS.match(/innerHTML\s*=\s*[^;]+/g) || []).every((x) => /gIcon|LUPA|CHEV/.test(x)));
res('0.4 fuera del flujo SimpleAPI en las tarjetas: sin «Sincronizar SII», «falta validar la autorización SII» ni libSii*',
  !/Sincronizar SII|falta validar la autorizaci|libSii|libro-sii/.test(HTML));
res('0.5 la sección pinta el slot del resumen y el respaldo manual; _cargarSiiDe monta ContableDocsSii con el id del cliente',
  /docsii-slot" data-cid="'\+Number\(c\.id\)/.test(HTML) && /class="libros-manual" data-cid=/.test(HTML) && /ContableDocsSii\.montar\(dslot,\{clienteId:dcid, periodo:_periodoActual/.test(HTML));
res('0.6 sin emojis en el módulo nuevo', !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(JS));

const R = { conexion: { estado: 'conectada' }, datos_al: '2026-11-19T10:00:00Z', avisos: [],
  ventas: { documentos: 4, neto: 130000, exento: 40000, iva: 24700, total: 194700, por_tipo: { '33': { n: 2, neto: 150000, exento: 0, iva: 28500, total: 178500 }, '61': { n: 1, neto: -20000, exento: 0, iva: -3800, total: -23800 }, '34': { n: 1, neto: 0, exento: 40000, iva: 0, total: 40000 } } },
  compras: { registro: { documentos: 2, neto: 70000, exento: 0, iva: 13300, total: 83300 }, pendiente: { documentos: 1, iva: 950, total: 5950 }, por_tipo: { '33': { n: 1, neto: 80000, exento: 0, iva: 15200, total: 95200 }, '61': { n: 1, neto: -10000, exento: 0, iva: -1900, total: -11900 } } },
  honorarios: { honorarios_recibidos: { documentos: 1, bruto: 100000, retencion: 13750 } } };
const DOCS = { conexion: { estado: 'conectada' }, total_documentos: 4, truncado: false, documentos: [
  { tipo_dte: 33, folio: 101, fecha: '2026-09-03', rut: '11111111-1', razon_social: '<img src=x onerror="window.__xss=1">Cliente Uno', neto: 100000, exento: 0, iva: 19000, total: 119000, signo: 1, estado: 'registro' },
  { tipo_dte: 33, folio: 102, fecha: '2026-09-10', rut: '22222222-2', razon_social: 'Cliente Dos', neto: 50000, exento: 0, iva: 9500, total: 59500, signo: 1, estado: 'registro' },
  { tipo_dte: 61, folio: 7, fecha: '2026-09-15', rut: '11111111-1', razon_social: 'Cliente Uno', neto: 20000, exento: 0, iva: 3800, total: 23800, signo: -1, estado: 'registro' },
  { tipo_dte: 34, folio: 900, fecha: '2026-09-20', rut: '33333333-3', razon_social: null, neto: 0, exento: 40000, iva: 0, total: 40000, signo: 1, estado: 'registro' }] };
type Resp = [number, unknown];
function pagina(resp: (path: string, body: any) => Resp) {
  const dom = new JSDOM(`<!doctype html><body><div class="det">
    <div class="docsii-slot" data-cid="9001"></div>
    <div class="libros-manual" data-cid="9001" data-modo="pendiente"><div class="libros-grid"><button class="cargar">Cargar</button></div></div></div></body>`,
    { runScripts: 'outside-only', url: 'https://gestoor.contadoor.cl/reportes-contable/' });
  const w: any = dom.window; const llam: any[] = [];
  w.sbFetch = (p: string, o: any) => { const b = JSON.parse(o.body || '{}'); llam.push([p, b]); const [st, j] = resp(p, b);
    return Promise.resolve({ ok: st === 200, status: st, text: () => Promise.resolve(JSON.stringify(j)), json: () => Promise.resolve(j) }); };
  w.eval(MENU.replace(/if\(document\.readyState[\s\S]*$/, '})();'));   // gIcon real, sin montar el menú
  w.eval(JS);
  const d = w.document, slot = d.querySelector('.docsii-slot'), man = d.querySelector('.libros-manual');
  const montar = () => w.ContableDocsSii.montar(slot, { clienteId: 9001, periodo: '2026-09', nombre: 'Empresa Ficticia SpA' });
  return { w, d, slot, man, llam, montar };
}
const txt = (e: any) => (e ? e.textContent.replace(/\s+/g, ' ').trim() : '');
const fila = (tr: any) => (tr ? [...tr.querySelectorAll('td')].map((td: any) => txt(td)).join(' ') : '');

{ // 1. Conectada con datos
  const p = pagina((path) => path === 'rpc/sii_preiva_periodo' ? [200, R] : [200, DOCS]);
  await p.montar(); await espera();
  const cards = [...p.slot.querySelectorAll('.dsii-card')];
  res('1.1 tres tarjetas: Compras, Ventas, Honorarios recibidos', cards.map((c: any) => txt(c.querySelector('.dsii-hd b'))).join('|') === 'Compras|Ventas|Honorarios recibidos');
  res('1.2 Ventas: documentos, neto, IVA débito y total en CLP', /4 documentos/.test(txt(cards[1])) && /Neto\$130\.000/.test(txt(cards[1])) && /IVA débito\$24\.700/.test(txt(cards[1])) && /Total\$194\.700/.test(txt(cards[1])), txt(cards[1]));
  res('1.3 Compras: IVA crédito y aviso de pendientes que no suman', /IVA crédito\$13\.300/.test(txt(cards[0])) && /1 pendiente en el SII: no suman crédito/.test(txt(cards[0])), txt(cards[0]));
  res('1.4 Honorarios: bruto, retención y líquido', /Bruto\$100\.000/.test(txt(cards[2])) && /Retención\$13\.750/.test(txt(cards[2])) && /Líquido\$86\.250/.test(txt(cards[2])));
  res('1.5 «Datos del SII al <fecha Chile>» y lupa «Ver detalle» en cada tarjeta', cards.every((c: any) => /Datos del SII al 19-11-2026, 07:00/.test(txt(c)) && txt(c.querySelector('.dsii-lupa')) === 'Ver detalle'));
  res('1.6 la carga manual queda plegada como respaldo (con botón para abrirla)', p.man.getAttribute('data-modo') === 'respaldo' && !p.man.classList.contains('abierto') && !!p.man.querySelector('.dsii-resp'));
  p.man.querySelector('.dsii-resp').click();
  res('1.7 el respaldo se abre al pulsar y recuerda el estado al volver a montar', p.man.classList.contains('abierto'));
  await p.montar(); await espera();
  res('1.8 segunda vez: sin nueva consulta (caché por cliente y período)', p.llam.filter((x: any) => x[0] === 'rpc/sii_preiva_periodo').length === 1 && p.man.classList.contains('abierto'));
  res('1.9 la consulta lleva p_cliente_id y p_periodo', JSON.stringify(p.llam[0]) === JSON.stringify(['rpc/sii_preiva_periodo', { p_cliente_id: 9001, p_periodo: '2026-09' }]));

  // 2. Lupa de Ventas
  cards[1].querySelector('.dsii-lupa').click(); await espera();
  const m = p.d.querySelector('.dsii-modal');
  res('2.1 abre el panel con título, empresa y fecha', !!m && /Ventas · septiembre 2026/.test(txt(m.querySelector('h4'))) && /Empresa Ficticia SpA · Datos del SII al/.test(txt(m.querySelector('small'))));
  res('2.2 pide el detalle con p_libro venta', JSON.stringify(p.llam.at(-1)) === JSON.stringify(['rpc/sii_documentos_periodo', { p_cliente_id: 9001, p_periodo: '2026-09', p_libro: 'venta' }]));
  const tipos = [...m.querySelectorAll('tr.tipo')];
  res('2.3 una fila por tipo (33, 34, 61) con cantidad y montos', tipos.map((t: any) => txt(t.querySelector('td'))).join('|') === '33 · Factura electrónica|34 · Factura exenta|61 · Nota de crédito electrónica (resta)', tipos.map(txt));
  res('2.4 la nota de crédito RESTA (montos negativos, en rojo)', tipos[2].classList.contains('resta') && /-\$20\.000/.test(txt(tipos[2])) && /-\$3\.800/.test(txt(tipos[2])));
  res('2.5 fila Total cuadra con el resumen', /Total 4 \$130\.000 \$40\.000 \$24\.700 \$194\.700/.test(fila(m.querySelector('tr.total'))), fila(m.querySelector('tr.total')));
  tipos[0].querySelector('.dsii-abre').click();
  const docs = [...m.querySelectorAll('tr.doc')];
  res('2.6 al abrir un tipo: lista de documentos con folio, fecha, RUT, razón social y montos', docs.length === 2 && /Folio 101 · 03-09-2026/.test(txt(docs[0])) && /11111111-1 · /.test(txt(docs[0])) && /\$119\.000/.test(txt(docs[0])), docs.map(txt));
  res('2.7 la razón social se pinta como texto (sin inyección de HTML)', !p.w.__xss && !m.querySelector('img') && /<img src=x/.test(txt(docs[0])));
  tipos[0].querySelector('.dsii-abre').click();
  res('2.8 al cerrar el tipo se ocultan sus documentos', m.querySelectorAll('tr.doc').length === 0);
  p.d.dispatchEvent(new p.w.KeyboardEvent('keydown', { key: 'Escape' }));
  res('2.9 Escape cierra el panel', !p.d.querySelector('.dsii-modal'));
}
{ // 3. RPC de detalle aún no instalada → fail-closed con desglose por tipo del resumen
  const p = pagina((path) => path === 'rpc/sii_preiva_periodo' ? [200, R] : [404, { code: 'PGRST202', message: 'no existe' }]);
  await p.montar(); await espera();
  p.slot.querySelectorAll('.dsii-lupa')[0].click(); await espera();
  const m = p.d.querySelector('.dsii-modal');
  const tipos = [...m.querySelectorAll('tr.tipo')];
  res('3.1 Compras sin RPC de detalle: tipos del resumen (33 y 61 restando) y total', tipos.length === 2 && tipos[1].classList.contains('resta') && /Total 2 \$70\.000/.test(fila(m.querySelector('tr.total'))), fila(m.querySelector('tr.total')));
  tipos[0].querySelector('.dsii-abre').click();
  res('3.2 al abrir un tipo: «Detalle por documento disponible pronto.»', txt(m.querySelector('tr.msg')) === 'Detalle por documento disponible pronto.');
  res('3.3 pendientes informadas aparte', /Pendiente: 1 documento · IVA \$950/.test(txt(m)));
}
{ // 4. Sin conexión
  const p = pagina(() => [200, { conexion: { estado: 'sin_conexion' }, ventas: null, compras: null, avisos: ['sin_conexion'] }]);
  await p.montar(); await espera();
  res('4.1 mensaje «Esta empresa aún no está conectada al SII.» sin tarjetas ni lupa', /Esta empresa aún no está conectada al SII\./.test(txt(p.slot)) && !p.slot.querySelector('.dsii-card, .dsii-lupa'));
  res('4.2 la carga manual queda a la vista (única vía)', p.man.getAttribute('data-modo') === 'visible' && !p.man.querySelector('.dsii-resp'));
}
{ // 5. Sin permiso y error
  const p = pagina(() => [403, { code: '42501', message: 'SIN_PERMISO' }]);
  await p.montar(); await espera();
  res('5.1 sin permiso: lo dice y deja la carga manual a la vista', /No tienes acceso a los datos del SII/.test(txt(p.slot)) && p.man.getAttribute('data-modo') === 'visible');
  const q = pagina(() => [500, { message: 'x' }]);
  await q.montar(); await espera();
  res('5.2 error del servidor: «No se pudieron leer los datos del SII.» + carga manual', /No se pudieron leer los datos del SII\./.test(txt(q.slot)) && q.man.getAttribute('data-modo') === 'visible');
  const v = pagina(() => [200, { conexion: { estado: 'conectada' }, ventas: null, compras: null, honorarios: null, avisos: [] }]);
  await v.montar(); await espera();
  res('5.3 conectada sin datos del mes: lo dice y deja la carga manual a la vista', /Cartapra aún no trae datos del SII para septiembre 2026/.test(txt(v.slot)) && v.man.getAttribute('data-modo') === 'visible');
  const e = pagina((path) => path === 'rpc/sii_preiva_periodo' ? [200, R] : [403, { code: '42501' }]);
  await e.montar(); await espera(); e.slot.querySelectorAll('.dsii-lupa')[2].click(); await espera();
  res('5.4 lupa sin permiso al detalle: aviso y desglose del resumen (honorarios)', /No tienes acceso al detalle por documento/.test(txt(e.d.querySelector('.dsii-modal'))) && /1 \$100\.000 \$13\.750 \$86\.250/.test(fila(e.d.querySelector('tr.tipo'))), fila(e.d.querySelector('tr.tipo')));
}
{ // 6. Distintivo «SII conectado» para todo el equipo (clientes/sii-cartapra.js)
  res('6.1 clientes/index.html pasa el id del cliente a insignia y pide prepararInsignias', /GestoorSII\.insignia\(c\.rut, c\.id\)/.test(CL) && /GestoorSII\.prepararInsignias\(\)\.then/.test(CL));
  const mk = (st: number, j: unknown) => {
    const dom = new JSDOM('<!doctype html><body></body>', { runScripts: 'outside-only', url: 'https://gestoor.contadoor.cl/clientes/' });
    const w: any = dom.window; const llam: any[] = [];
    w.edgeFetch = () => Promise.resolve({ ok: false, status: 403, json: () => Promise.resolve({ ok: false }) });
    w.sbFetch = (p: string, o: any) => { llam.push([p, o.body]); return Promise.resolve({ ok: st === 200, status: st, json: () => Promise.resolve(j) }); };
    w.eval(SII); return { w, llam };
  };
  const a = mk(200, [{ cliente_id: 5, estado: 'conectada' }, { cliente_id: 6, estado: 'clave_rechazada' }, { cliente_id: 7, estado: 'sin_conexion' }]);
  res('6.2 antes de cargar: sin distintivo', a.w.GestoorSII.insignia('11111111-1', 5) === null);
  res('6.3 prepararInsignias usa la RPC sii_conexiones_equipo (una vez)', (await a.w.GestoorSII.prepararInsignias()) === true && (await a.w.GestoorSII.prepararInsignias()) === true && a.llam.length === 1 && a.llam[0][0] === 'rpc/sii_conexiones_equipo');
  const t5 = a.w.GestoorSII.insignia('11111111-1', 5), t6 = a.w.GestoorSII.insignia('2-2', 6);
  res('6.4 no Master: «SII conectado» (verde) y «Revisar conexión SII» (ámbar) por cliente_id', !!t5 && t5.textContent === 'SII conectado' && /\bok\b/.test(t5.className) && !!t6 && t6.textContent === 'Revisar conexión SII');
  res('6.5 sin conexión o cliente fuera de la lista: sin distintivo', a.w.GestoorSII.insignia('x', 7) === null && a.w.GestoorSII.insignia('x', 99) === null);
  const b = mk(404, { code: 'PGRST202' });
  res('6.6 RPC aún no instalada: prepararInsignias = false y se queda el comportamiento anterior (sin estado → nada)', (await b.w.GestoorSII.prepararInsignias()) === false && b.w.GestoorSII.insignia('11111111-1', 5) === null);
}
console.log(`\n${ok}/${ok + mal} ok`);
Deno.exit(mal ? 1 : 0);
