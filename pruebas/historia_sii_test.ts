// CARTAPRA-HISTORIA · prueba LOCAL del front en jsdom con la Edge simulada (sin red real). Datos 100 % ficticios.
// Uso: deno run --allow-read --allow-env --allow-sys --allow-net=registry.npmjs.org pruebas/historia_sii_test.ts
import { JSDOM } from 'npm:jsdom@24.1.0';
const RAIZ = new URL('../', import.meta.url);
const leer = (p: string) => Deno.readTextFileSync(new URL(p, RAIZ));
let ok = 0, mal = 0;
const res = (n: string, b: boolean, d: unknown = '') => { if (b) { ok++; console.log('OK  ', n); } else { mal++; console.log('MAL ', n, JSON.stringify(d)); } };
const espera = (ms = 20) => new Promise((r) => setTimeout(r, ms));
const JS = leer('clientes/historia-sii.js'), LIV = leer('clientes/levantamiento-iva.js'), HTML = leer('clientes/index.html'), DATOS = leer('pruebas/levantamiento-iva-datos.js');
const ENLACE = 'https://app.cartapra.com/conecta-historia/FICTICIO123';

// ── 0. Integración y estándar ──
const iLiv = HTML.indexOf('<script src="levantamiento-iva.js">'), iHis = HTML.indexOf('<script src="historia-sii.js">'), iAuth = HTML.indexOf('<script src="../auth.js">');
res('0.1 historia-sii.js se carga después de levantamiento-iva.js y antes de auth.js', iLiv > 0 && iHis > iLiv && iAuth > iHis);
res('0.2 la ficha monta «Historia SII» con id, razón, RUT y la sesión', /GestoorHistoriaSII\.montar\(g\('det-hist'\), \{ id: c\.id, razon: c\.razon, rut: c\.rut \}, window\._contadoorSesion\)/.test(HTML) && /id="det-hist"/.test(HTML));
res('0.3 cerrar la ficha cierra el diálogo (y su consulta cada 60 s)', /function cerrarDetalle\(\) \{ if \(window\.GestoorHistoriaSII\) GestoorHistoriaSII\.cerrar\(\);/.test(HTML));
res('0.4 solo la Edge cartapra-historia; nunca la llave, nunca un RUT al servidor', /'cartapra-historia'/.test(JS) && !/ck_live|CARTAPRA_LLAVE/.test(JS) && !/rut:\s*cliente\.rut/.test(JS));
res('0.5 el enlace no se guarda (sin localStorage/sessionStorage/IndexedDB)', !/(localStorage|sessionStorage|indexedDB)\s*[.\[]/.test(JS));
res('0.6 innerHTML solo con íconos (gIcon) y sin emojis', (JS.match(/innerHTML\s*=\s*[^;]+/g) || []).every((x) => /gIcon/.test(x)) && !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(JS));
res('0.7 consulta el estado cada 60 s', /CADA_MS = 60000/.test(JS));

type Resp = [number, any];
function pagina(edge: (b: any) => Resp, rpc: (p: string, b: any) => Resp = () => [200, {}]) {
  const dom = new JSDOM(`<!doctype html><head></head><body><div id="det-liva"></div><div id="det-hist"></div></body>`, { runScripts: 'outside-only', url: 'https://gestoor.contadoor.cl/clientes/' });
  const w: any = dom.window; const llam: any[] = [], rpcs: any[] = [], tabs: any[] = [], timers: any[] = [];
  w.gIcon = (n: string) => `<svg data-i="${n}"></svg>`;
  w.edgeFetch = (fn: string, b: any) => { llam.push([fn, b]); const [st, j] = edge(b); return Promise.resolve({ ok: st === 200, status: st, json: () => Promise.resolve(j) }); };
  w.sbFetch = (p: string, o: any) => { const b = JSON.parse(o.body || '{}'); rpcs.push([p, b]); const [st, j] = rpc(p, b);
    return Promise.resolve({ ok: st === 200, status: st, text: () => Promise.resolve(JSON.stringify(j)) }); };
  w.open = () => { const t: any = { closed: false, location: { href: 'about:blank' }, close() { t.closed = true; } }; tabs.push(t); return t; };
  w.setInterval = (f: () => void, ms: number) => { timers.push({ f, ms, vivo: true }); return timers.length; };
  w.clearInterval = (id: number) => { if (timers[id - 1]) timers[id - 1].vivo = false; };
  w.eval(DATOS); w.eval(LIV); w.eval(JS);
  return { w, d: w.document as Document, llam, rpcs, tabs, timers };
}
const C = { id: 9001, razon: '<b>Empresa</b> Ficticia', rut: '76.000.000-0' };
const hist = (estado: string, extra: any = {}) => ({ id: 41, estado, porcentaje: estado === 'lista' ? 100 : 33, minutosEstimados: 12,
  meses: { total: 94, listos: 31, pendientes: 63, sinDatos: 0 }, expiraEn: '2026-11-27T15:02:11.000Z', ...extra });

// ── 1. Permisos de UI y rango ──
{
  const { w, d } = pagina(() => [200, {}]);
  for (const [s, ve] of [[{ esMaster: true }, true], [{ rol: 'contable' }, true], [{ rol: 'rrhh' }, false], [{ rol: 'pagos' }, false], [null, false]] as const) {
    w.GestoorHistoriaSII.montar(d.getElementById('det-hist'), C, s);
    res(`1. botón ${ve ? 'visible' : 'oculto'} para ${JSON.stringify(s)}`, !!d.getElementById('hsii-abrir') === ve);
  }
  const H = new Date(2026, 10, 20), v = w.GestoorHistoriaSII.validarRango;
  res('1.6 rango: mín ago-2017, sin futuro, desde ≤ hasta, máx 72 meses',
    v('2017-07', '2018-01', H) !== '' && v('2026-01', '2026-12', H) !== '' && v('2025-05', '2025-01', H) !== '' && v('2020-11', '2026-11', H) !== '' &&
    v('2020-12', '2026-11', H) === '' && v('2017-08', '2018-01', H) === '');
}

// ── 2. Pedir → pestaña nueva con el enlace → estado cada 60 s → Cargar en Gestoor ──
{
  let estado = 'cargando';
  const { w, d, llam, tabs, timers } = pagina((b) => {
    if (b.accion === 'pedir') return [200, { ok: true, historia: hist('cargando', { enlace: ENLACE }) }];
    if (b.accion === 'estado') return [200, { ok: true, historia: hist(estado) }];
    if (b.accion === 'cargar') return [200, { ok: true, historia: hist('lista'), totales: { cargados: 46, sin_cambio: 2, omitidos_sync: 3, parciales: 0 },
      resumen: [{ tipo: 'rcv_ventas', resultado: 'ok', meses: 47, cargados: 44, sin_cambio: 0, omitidos_sync: 3, parciales: 0 }] }];
    return [400, {}];
  });
  w.GestoorHistoriaSII.montar(d.getElementById('det-hist'), C, { esMaster: true });
  (d.getElementById('hsii-abrir') as HTMLElement).click();
  res('2.1 diálogo con el nombre como texto (no HTML)', !!d.getElementById('hsii-velo') && d.querySelector('.hsii-cab h3 span')!.textContent!.includes('<b>Empresa</b>'));
  res('2.2 aviso fijo: F29 solo de los últimos 6 folios', /últimos 6 folios/.test(d.getElementById('hsii-velo')!.textContent!));
  (d.getElementById('hsii-desde') as HTMLInputElement).value = '2023-01'; (d.getElementById('hsii-hasta') as HTMLInputElement).value = '2026-11';
  (d.getElementById('hsii-pedir') as HTMLElement).click(); await espera();
  res('2.3 llama a la Edge con cliente_id y AAAAMM (sin RUT)', llam[0][0] === 'cartapra-historia' && JSON.stringify(llam[0][1]) === JSON.stringify({ accion: 'pedir', cliente_id: 9001, desde: '202301', hasta: '202611' }), llam[0]);
  res('2.4 abre la pestaña en el clic (sin opener) y le pone el enlace', tabs.length === 1 && tabs[0].location.href === ENLACE && tabs[0].opener === null);
  const a = d.getElementById('hsii-enlace') as HTMLAnchorElement;
  res('2.5 enlace de respaldo con target _blank y rel noopener', !a.hidden && a.href === ENLACE && a.rel.includes('noopener') && a.target === '_blank');
  res('2.6 cargando: muestra avance y programa consulta cada 60 s', /33 %/.test(d.getElementById('hsii-msg')!.textContent!) && timers.length === 1 && timers[0].ms === 60000 && (d.getElementById('hsii-cargar') as HTMLElement).hidden);
  estado = 'lista'; timers[0].f(); await espera();
  res('2.7 al quedar «lista»: aparece «Cargar en Gestoor» y se deja de consultar', !(d.getElementById('hsii-cargar') as HTMLElement).hidden && !timers[0].vivo && llam[1][1].accion === 'estado' && llam[1][1].historia_id === 41);
  (d.getElementById('hsii-cargar') as HTMLElement).click(); await espera();
  res('2.8 cargar: llama con historia_id y muestra el resultado', llam[2][1].accion === 'cargar' && llam[2][1].historia_id === 41 && /46 meses-libro nuevos/.test(d.getElementById('hsii-msg')!.textContent!) && /sincronización diaria/.test(d.getElementById('hsii-msg')!.textContent!) && d.querySelectorAll('#hsii-res li').length === 1);
  w.GestoorHistoriaSII.cerrar();
  res('2.9 cerrar quita el diálogo', !d.getElementById('hsii-velo'));
}

// ── 3. Errores: permiso, rango local, pestaña cerrada si falla, carga aún en curso ──
{
  const { w, d, llam, tabs, timers } = pagina((b) => b.accion === 'pedir' ? [403, { ok: false, error: 'SIN_PERMISO' }] : [409, { ok: false, error: 'HISTORIA_CARGANDO' }]);
  w.GestoorHistoriaSII.abrir(C);
  (d.getElementById('hsii-desde') as HTMLInputElement).value = '2016-01';
  (d.getElementById('hsii-pedir') as HTMLElement).click(); await espera();
  res('3.1 rango inválido: no llama ni abre pestaña', llam.length === 0 && tabs.length === 0 && /agosto de 2017/.test(d.getElementById('hsii-msg')!.textContent!));
  (d.getElementById('hsii-desde') as HTMLInputElement).value = '2024-01';
  (d.getElementById('hsii-pedir') as HTMLElement).click(); await espera();
  res('3.2 sin permiso: mensaje claro y la pestaña abierta se cierra', /Solo el Master o el analista contable/.test(d.getElementById('hsii-msg')!.textContent!) && tabs[0].closed === true && timers.length === 0);
}

// ── 4. Levantamiento de IVA: aviso F29, botón «Historia SII» y columna Origen ──
{
  const { w, d, rpcs } = pagina(() => [200, {}], (p) => {
    if (p === 'rpc/sii_levantamiento_iva') return [200, w.LIVA_DEMO];
    if (p === 'rpc/sii_historia_origenes') return [200, { meses: [{ periodo: w.LIVA_DEMO.meses[0].periodo, ventas: 'historia', compras: 'historia' }, { periodo: w.LIVA_DEMO.meses[1].periodo, ventas: 'sync', compras: 'historia' }] }];
    return [200, {}];
  });
  w.GestoorLevIVA.montar(d.getElementById('det-liva'), C, { esMaster: true });
  (d.getElementById('liva-abrir') as HTMLElement).click();
  res('4.1 aviso fijo «Cartapra entrega montos de F29 solo de los últimos 6 folios»', /Cartapra entrega montos de F29 solo de los últimos 6 folios/.test(d.getElementById('liva-aviso-f29')!.textContent!));
  (d.getElementById('liva-desde') as HTMLInputElement).value = '2023-11'; (d.getElementById('liva-hasta') as HTMLInputElement).value = '2026-10';
  (d.getElementById('liva-calcular') as HTMLElement).click(); await espera(40);
  const o = rpcs.find((x) => x[0] === 'rpc/sii_historia_origenes');
  res('4.2 pide los orígenes del mismo rango', !!o && o[1].p_cliente_id === 9001 && o[1].p_desde === w.LIVA_DEMO.desde && o[1].p_hasta === w.LIVA_DEMO.hasta, o);
  const celdas = Array.from(d.querySelectorAll('#liva-tabla tr.fila td.orig')).map((x: any) => x.textContent);
  res('4.3 columna Origen: Historia SII / Mixto / —', celdas[0] === 'Historia SII' && celdas[1] === 'Mixto (Historia SII y diaria)' && celdas[2] === '—', celdas.slice(0, 3));
  res('4.4 el PDF incluye el aviso de F29', w.GestoorLevIVA.documentoPdf(w.LIVA_DEMO, C, 'x.png').includes('Cartapra entrega montos de F29 solo de los últimos 6 folios'));
  (d.getElementById('liva-historia-sii') as HTMLElement).click();
  res('4.5 «Historia SII» abre su diálogo encima con el rango del levantamiento', !!d.getElementById('hsii-velo') && (d.getElementById('hsii-desde') as HTMLInputElement).value === '2023-11' && (d.getElementById('hsii-hasta') as HTMLInputElement).value === '2026-10');
}
{
  const { w, d } = pagina(() => [200, {}], (p) => p === 'rpc/sii_levantamiento_iva' ? [200, w.LIVA_DEMO] : [404, { code: 'PGRST202' }]);
  w.GestoorLevIVA.abrir(C);
  (d.getElementById('liva-calcular') as HTMLElement).click(); await espera(40);
  const celdas = Array.from(d.querySelectorAll('#liva-tabla tr.fila td.orig')).map((x: any) => x.textContent);
  res('4.6 sin la RPC de orígenes: columna «—» y el cálculo se muestra igual', celdas.length > 0 && celdas.every((x) => x === '—') && d.querySelectorAll('#liva-tabla tr.fila').length > 0);
}

console.log(`\n${ok} OK · ${mal} MAL`);
if (mal) Deno.exit(1);
