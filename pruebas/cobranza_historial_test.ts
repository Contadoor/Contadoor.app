// COBRANZA · HISTORIAL POR CLIENTE · prueba LOCAL con mocks (jsdom; no toca Supabase ni producción; datos 100 % ficticios).
// 1) Adaptador (GC_HIST.armar): orden por fecha, estado de cada documento, totales, saldo y vencidos a hoy, filtro por año.
// 2) Render (GC_HIST.html): montos CLP con punto de miles, fechas dd-mm-aaaa, vacío amable, «Datos de ejemplo» en demo, escape HTML.
// 3) Lectura real (GC_HIST.cargarReal): solo GET de lectura, sin RPC ni columnas de auditoría; aplicaciones por pago_id.
// 4) Página: clic en el cliente → ficha → pestaña «Historial de facturas y pagos» muestra facturas y pagos.
// Uso: deno run --allow-read --allow-env --allow-sys --allow-net=registry.npmjs.org pruebas/cobranza_historial_test.ts
import { JSDOM } from 'npm:jsdom@24.1.0';

const RAIZ = new URL('../', import.meta.url);
const leer = (p: string) => Deno.readTextFileSync(new URL(p, RAIZ));
const gcJs = leer('assets/gestoor-cartera.js'), histJs = leer('cobranza/historial.js'), carteraJs = leer('cobranza/cartera.js');
const espera = (ms = 60) => new Promise((r) => setTimeout(r, ms));
let total = 0, fallas = 0;
const res = (n: string, ok: boolean, det = '') => { total++; console.log((ok ? 'OK   ' : 'MAL  ') + n + (ok || !det ? '' : ' · ' + det)); if (!ok) fallas++; };
const sinScript = (s: string) => s.replace(/<\/script>/g, '<\\/script>');

const HOY = '2026-11-06';
const DATOS = {
  plan: 'Pyme Plus',
  documentos: [
    { id: 1, origen: 'MENSUALIDAD', folio: '4001', periodo: '2025-11', concepto: 'Mensualidad servicios contables 2025-11', fecha_emision: '2025-12-01', fecha_vencimiento: '2025-12-21', monto: 95000, pagado: 95000, rebajado: 0, saldo: 0, pagado_fecha: '2025-12-20', estado: 'PAGADO' },
    { id: 2, origen: 'MENSUALIDAD', folio: '4002', periodo: '2026-09', concepto: 'Mensualidad servicios contables 2026-09', fecha_emision: '2026-10-01', fecha_vencimiento: '2026-10-21', monto: 95000, pagado: 20000, rebajado: 0, saldo: 75000, estado: 'PENDIENTE' },
    { id: 3, origen: 'MENSUALIDAD', folio: '4003', periodo: '2026-10', concepto: 'Mensualidad <img src=x onerror=alert(1)>', fecha_emision: '2026-11-01', fecha_vencimiento: '2026-11-10', monto: 95000, pagado: 0, rebajado: 0, saldo: 95000, estado: 'PENDIENTE' },
    { id: 4, origen: 'MENSUALIDAD', folio: '4004', periodo: '2026-10', concepto: 'Factura anulada', fecha_emision: '2026-11-01', fecha_vencimiento: '2026-11-30', monto: 50000, pagado: 0, rebajado: 0, saldo: 50000, estado: 'ANULADO' },
    { id: 5, origen: 'TRABAJO_ESPECIAL', folio: '5120', periodo: null, concepto: 'Trabajo especial', fecha_emision: '2026-11-02', fecha_vencimiento: '2026-12-30', monto: 1234567, pagado: 0, rebajado: 0, saldo: 1234567, estado: 'PENDIENTE' },
  ],
  pagos: [
    { id: 10, fecha_pago: '2025-12-20', monto: 95000, monto_abono: 0, medio: 'TRANSFERENCIA', referencia: 'Transferencia', estado: 'VIGENTE', movimiento_id: null },
    { id: 11, fecha_pago: '2026-10-25', monto: 20000, monto_abono: 0, medio: 'TRANSFERENCIA', referencia: null, estado: 'VIGENTE', movimiento_id: 77 },
    { id: 12, fecha_pago: '2026-10-26', monto: 30000, monto_abono: 0, medio: 'TRANSFERENCIA', referencia: 'Duplicado', estado: 'ANULADO', movimiento_id: null },
  ],
  aplicaciones: [
    { pago_id: 10, documento_id: 1, monto: 95000, anulada: false, desde_abono: false },
    { pago_id: 11, documento_id: 2, monto: 20000, anulada: false, desde_abono: false },
    { pago_id: 12, documento_id: 2, monto: 30000, anulada: true, desde_abono: false },
  ],
  notas: [],
};

// ═══ 1 y 2 · adaptador y render en un DOM vacío ═══
{
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { runScripts: 'dangerously', url: 'https://gestoor.ejemplo.test/cobranza/cartera.html' });
  const w = dom.window as unknown as Record<string, any>;
  for (const js of [gcJs, histJs]) { const s = w.document.createElement('script'); s.textContent = js; w.document.body.appendChild(s); }
  const H = w.GC_HIST;
  res('H0 historial.js expone GC_HIST (armar, html, cargarReal)', !!H && typeof H.armar === 'function' && typeof H.html === 'function' && typeof H.cargarReal === 'function');

  const m = H.armar(DATOS, HOY);
  const fechas = m.filas.map((f: any) => f.fecha);
  res('H1 Línea de tiempo con facturas y pagos, ordenada por fecha (más reciente primero)', m.filas.length === 8 && fechas.every((f: string, i: number) => i === 0 || fechas[i - 1] >= f), fechas.join(','));
  const est = (id: number) => m.filas.find((f: any) => f.tipo === 'FACTURA' && f.id === id).est.k;
  res('H2 Estados: pagado, vencido, por vencer, anulado, al día', est(1) === 'PAGADO' && est(2) === 'VENCIDO' && est(3) === 'POR_VENCER' && est(4) === 'ANULADO' && est(5) === 'AL_DIA', [1, 2, 3, 4, 5].map(est).join(','));
  res('H3 Saldo pendiente a hoy = solo documentos pendientes (sin anulados)', m.saldo === 75000 + 95000 + 1234567, String(m.saldo));
  res('H4 Documentos vencidos a hoy = 1', m.nVencidos === 1 && m.montoVencido === 75000, JSON.stringify([m.nVencidos, m.montoVencido]));
  const t = H.totales(m.filas);
  res('H5 Total facturado sin anuladas · total pagado solo pagos confirmados', t.facturado === 95000 * 3 + 1234567 && t.pagado === 115000, JSON.stringify(t));
  res('H6 Años disponibles para el filtro', JSON.stringify(m.anios) === '["2026","2025"]', JSON.stringify(m.anios));
  const pago11 = m.filas.find((f: any) => f.tipo === 'PAGO' && f.id === 11), pago12 = m.filas.find((f: any) => f.tipo === 'PAGO' && f.id === 12);
  res('H7 Pago con documento aplicado; aplicación anulada no cuenta; pago anulado marcado', pago11.aplicado[0].nombre === 'folio 4002' && pago12.aplicado.length === 0 && pago12.est.k === 'ANULADO');

  const h = H.html(m, { anio: 'TODOS', demo: false });
  res('H8 Montos en CLP con punto de miles', h.includes('$1.234.567') && h.includes('$95.000'));
  res('H9 Fechas en formato dd-mm-aaaa', h.includes('21-10-2026') && h.includes('20-12-2025') && !/2026-10-21/.test(h.replace(/data-[a-z-]+="[^"]*"/g, '')));
  res('H10 Escapa el texto que viene de la base', !h.includes('<img src=x') && h.includes('&lt;img src=x'));
  res('H11 Sin «Datos de ejemplo» en modo real', !h.includes('Datos de ejemplo'));
  res('H12 Nunca la palabra «honorarios»', !/honorario/i.test(h + histJs));
  res('H13 Muestra folio, período, estado y medio de pago', h.includes('Factura folio 4002') && h.includes('sep 2026') && h.includes('Vencido') && h.includes('Pago · Transferencia') && h.includes('Confirmado') && h.includes('Anulado'));
  const h25 = H.html(m, { anio: '2025' });
  res('H14 Filtro por año: 2025 solo muestra lo de 2025', h25.includes('Factura folio 4001') && !h25.includes('Factura folio 4002') && h25.includes('en 2025'));
  res('H15 Modo demo rotula «Datos de ejemplo»', H.html(m, { demo: true }).includes('Datos de ejemplo'));
  const hv = H.html(H.armar({ documentos: [], pagos: [], aplicaciones: [], notas: [] }, HOY), {});
  res('H16 Vacío amable cuando el cliente no tiene facturas ni pagos', hv.includes('aún no tiene facturas ni pagos') && !hv.includes('<table'));

  // ═══ 3 · lectura real: solo GET ═══
  const urls: string[] = []; let rpcs = 0;
  const A = {
    get: (u: string) => { urls.push(u); if (u.startsWith('cobranza_pagos?')) return Promise.resolve(DATOS.pagos); if (u.startsWith('cobranza_documentos?')) return Promise.resolve(DATOS.documentos);
      if (u.startsWith('cobranza_aplicaciones?')) return Promise.resolve(DATOS.aplicaciones); if (u.startsWith('clientes?')) return Promise.resolve([{ plan: 'Pyme Plus' }]); return Promise.resolve([]); },
    rpc: () => { rpcs++; return Promise.resolve(null); },
  };
  const r = await H.cargarReal(A, 501);
  res('H17 Lectura real: documentos, pagos, aplicaciones, notas y plan del cliente', r.documentos.length === 5 && r.pagos.length === 3 && r.aplicaciones.length === 3 && r.plan === 'Pyme Plus', urls.join(' | '));
  res('H18 Lectura real: filtra por cliente y aplicaciones por pago_id', urls.some((u) => u.startsWith('cobranza_documentos?') && u.includes('cliente_id=eq.501')) && urls.some((u) => u.startsWith('cobranza_aplicaciones?') && u.includes('pago_id=in.(10,11,12)')));
  res('H19 Lectura real: no llama RPC ni pide columnas de auditoría/claves', rpcs === 0 && !urls.some((u) => /registrado_por|clave_idem|anulado_por|usuario_|clave_|vault/.test(u)), urls.join(' | '));
}

// ═══ 4 · página completa (mock de sbFetch) ═══
{
  const mock = `<script>
    window._llamadas = [];
    function _r(o, st){ st = st || 200; return Promise.resolve({ ok: st < 400, status: st, json: function(){ return Promise.resolve(o); }, text: function(){ return Promise.resolve(JSON.stringify(o)); } }); }
    var D = ${JSON.stringify(DATOS)};
    function sbFetch(path, opt){
      window._llamadas.push((opt && opt.method === 'POST' ? 'POST ' : 'GET ') + path);
      if (path === 'rpc/cobranza_yo') return _r({ modo: 'PRUEBA', prueba_hasta: '2026-12-31', arranque_fecha: '2026-10-01', puede_leer: true, puede_gestionar: true, puede_registrar_pagos: true });
      if (path === 'rpc/cobte_cartera_nombres') return _r([{ cliente_id: 501, razon_social: 'Panadería Ficticia Uno SpA', rut: '76111111-6' }]);
      if (path === 'rpc/cobranza_estado_cuenta') return _r({ grupos: [], total_deuda: 75000, total_vencido: 75000, total_abonos: 0, total: 75000 });
      if (path.indexOf('cobranza_documentos?') === 0) return _r(path.indexOf('cliente_id=eq.501') > 0 ? D.documentos : D.documentos.filter(function(d){ return d.estado === 'PENDIENTE'; }).map(function(d){ d.cliente_id = 501; return d; }));
      if (path.indexOf('cobranza_clientes?') === 0) return _r([{ cliente_id: 501, estado: 'VENCIDO', estado_desde: '2026-10-22' }]);
      if (path.indexOf('cobranza_pagos?') === 0) return _r(path.indexOf('cliente_id=eq.501') > 0 ? D.pagos : []);
      if (path.indexOf('cobranza_aplicaciones?') === 0) return _r(D.aplicaciones);
      if (path.indexOf('clientes?select=plan') === 0) return _r([{ plan: 'Pyme Plus' }]);
      if (path.indexOf('rpc/') === 0) return _r(null);
      return _r([]);
    }
  </script>`;
  let html = leer('cobranza/cartera.html');
  html = html.replace(/<script src="\.\.\/supabase\.js"><\/script>/, () => mock)
    .replace(/<script src="\.\.\/assets\/gestoor-cartera\.js"><\/script>/, () => '<script>' + sinScript(gcJs) + '</script>')
    .replace(/<script src="historial\.js"><\/script>/, () => '<script>' + sinScript(histJs) + '</script>')
    .replace(/<script src="cartera\.js"><\/script>/, () => '<script>' + sinScript(carteraJs) + '</script>')
    .replace(/<script>if\(window\.GC_DEMO\)document\.write[^\n]*<\/script>/g, '').replace(/<script>if\(!window\.GC_DEMO\)document\.write[^\n]*<\/script>/g, '')
    .replace(/<script src="\.\.\/assets\/gestoor-menu\.js"><\/script>/, '');
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://gestoor.ejemplo.test/cobranza/cartera.html', pretendToBeVisual: true });
  const w = dom.window as unknown as Record<string, any>;
  const d = w.document as Document;
  await espera(150);
  const fila = d.querySelector('[data-act="ficha"][data-id="501"]') as HTMLElement | null;
  res('P1 La cartera muestra al cliente y se puede abrir su ficha', !!fila);
  fila?.click();
  await espera(120);
  const tabH = d.querySelector('[data-act="ficha-vista"][data-v="historial"]') as HTMLElement | null;
  res('P2 La ficha ofrece la pestaña «Historial de facturas y pagos» y muestra el plan', !!tabH && (d.getElementById('gcDetCuerpo')!.textContent || '').includes('Plan Pyme Plus'));
  tabH?.click();
  await espera(150);
  const txt = d.getElementById('gcDetCuerpo')!.textContent || '';
  res('P3 El historial lista facturas y pagos del cliente', txt.includes('Factura folio 4001') && txt.includes('Factura folio 4002') && txt.includes('Pago · Transferencia') && txt.includes('Total facturado'), txt.slice(0, 600));
  res('P4 El panel se ensancha en la vista historial', d.getElementById('gcDet')!.classList.contains('gc-det-ancho'));
  (d.querySelector('[data-act="hist-anio"][data-anio="2025"]') as HTMLElement | null)?.click();
  await espera(30);
  const txt25 = d.getElementById('gcDetCuerpo')!.textContent || '';
  res('P5 Filtro por año desde la página', txt25.includes('Factura folio 4001') && !txt25.includes('Factura folio 4002'));
  const posts = (w._llamadas as string[]).filter((x) => x.startsWith('POST ') && !/rpc\/(cobranza_yo|cobte_cartera_nombres|cobranza_estado_cuenta)$/.test(x.slice(5)));
  res('P6 Abrir el historial no escribe nada (sin otras llamadas POST)', posts.length === 0, posts.join(' | '));
  w.document.querySelectorAll('script').forEach((x: any) => x.remove());
}

console.log(`\n${total - fallas}/${total} pruebas OK`);
if (fallas) Deno.exit(1);
