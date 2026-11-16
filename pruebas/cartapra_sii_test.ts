// Cartapra F1 · tarjeta "Datos del SII" de la ficha del cliente · prueba LOCAL en jsdom con la Edge simulada (no toca Supabase ni Cartapra).
// Uso: deno run --allow-read --allow-env --allow-sys --allow-net=registry.npmjs.org pruebas/cartapra_sii_test.ts
import { JSDOM } from 'npm:jsdom@24.1.0';
const RAIZ = new URL('../', import.meta.url);
const leer = (p: string) => Deno.readTextFileSync(new URL(p, RAIZ));
let ok = 0, mal = 0;
const res = (n: string, b: boolean, d: unknown = '') => { if (b) { ok++; console.log('OK  ', n); } else { mal++; console.log('MAL ', n, JSON.stringify(d)); } };
const espera = (ms = 20) => new Promise((r) => setTimeout(r, ms));
const FIXTURE = leer('pruebas/cartapra-sii-fixture.js');
const JS = leer('clientes/sii-cartapra.js'), MENU = leer('assets/gestoor-menu.js'), CL = leer('clientes/index.html');

// ── 0. Integración en la ficha ──
res('0.1 clientes/index.html carga sii-cartapra.js después del script del módulo y antes de auth.js',
  CL.indexOf('<script src="sii-cartapra.js">') > CL.indexOf('function verDetalle') && CL.indexOf('sii-cartapra.js') < CL.indexOf('../auth.js'));
res('0.2 verDetalle monta la tarjeta con c.id (nunca con RUT) y cerrarDetalle la desmonta',
  /GestoorSII\.montar\(g\('det-sii'\), c\.id,/.test(CL) && /function cerrarDetalle\(\) \{ if \(window\.GestoorSII\) GestoorSII\.desmontar\(\);/.test(CL));
res('0.3 el módulo no carga scripts de terceros (sin conecta.js ni <script src=http>)', !/conecta\.js['"]?\s*[;)]|createElement\(['"]script/.test(JS));
res('0.4 el módulo no usa la llave ni llama a Cartapra directo (solo edgeFetch("cartapra"))', !/ck_live|Bearer|api\/conecta/.test(JS) && /f\('cartapra', cuerpo\)/.test(JS));

type Resp = { status: number; body: unknown };
async function montar(respuestas: Record<string, Resp>, puede: boolean) {
  const dom = new JSDOM('<!doctype html><html><head></head><body><div id="det-sii"></div></body></html>', { url: 'https://gestoor.contadoor.cl/clientes/', runScripts: 'outside-only' });
  const w: any = dom.window;
  const pedidos: any[] = [];
  w.toast = (m: string) => { w._toast = m; };
  w.edgeFetch = (fn: string, body: any) => {
    pedidos.push({ fn, body });
    const r = respuestas[body.accion] ?? { status: 500, body: { ok: false, error: 'X' } };
    return Promise.resolve({ ok: r.status >= 200 && r.status < 300, status: r.status, json: () => Promise.resolve(r.body) });
  };
  w.eval(MENU.replace(/if\(document\.readyState[\s\S]*$/, '})();'));
  w.eval(JS);
  // puede_conectar lo decide el SERVIDOR: se inyecta en cada respuesta ok que no lo traiga.
  for (const r of Object.values(respuestas)) { const b = r.body as Record<string, unknown>; if (b && b.ok === true && !('puede_conectar' in b) && (b.conexion)) b.puede_conectar = puede; }
  w.GestoorSII.montar(w.document.getElementById('det-sii'), 7, { esMaster: !puede }); // esMaster ya no se usa: se pasa al revés a propósito
  await espera();
  await espera();
  return { w, d: w.document as Document, pedidos };
}
const con = (estado: string, extra: Record<string, unknown> = {}) => ({ status: 200, body: { ok: true, conexion: { estado, ultimaActualizacion: null, actualizando: false, cargaInicialLista: false, ultimoError: null, ...extra }, monitor: null, sii: {} } });
const texto = (d: Document) => (d.getElementById('det-sii')?.textContent || '').replace(/\s+/g, ' ');

// ── 1. Sin conectar ──
{
  const { d, pedidos } = await montar({ resumen: con('no_conectada') }, true);
  res('1.1 Sin conectar → «Sin conectar con el SII» y botón «Conectar con el SII» (Master)', texto(d).includes('Sin conectar con el SII') && [...d.querySelectorAll('button')].some((b) => b.textContent === 'Conectar con el SII'));
  res('1.2 el pedido lleva SOLO accion y cliente_id (sin RUT)', JSON.stringify(pedidos[0]) === JSON.stringify({ fn: 'cartapra', body: { accion: 'resumen', cliente_id: 7 } }), pedidos);
  const n = await montar({ resumen: con('no_conectada') }, false);
  res('1.3 puede_conectar=false: sin botón, con «Pídele al Master que la conecte.»', n.d.querySelectorAll('button').length === 0 && texto(n.d).includes('Pídele al Master'));
}
// ── 2. Conectado (leyendo y listo) ──
{
  const a = await montar({ resumen: con('conectada', { actualizando: true, ultimaActualizacion: '2026-11-16T13:05:00.000Z' }) }, true);
  res('2.1 actualizando → «Leyendo el SII…» con hora de Chile (10:05)', texto(a.d).includes('Leyendo el SII…') && texto(a.d).includes('10:05'), texto(a.d));
  const b = await montar({ resumen: con('conectada', { cargaInicialLista: false }) }, true);
  res('2.2 !cargaInicialLista → «Leyendo el SII…»', texto(b.d).includes('Leyendo el SII…'));
  const w0 = new JSDOM('', { runScripts: 'outside-only' }).window as any; w0.eval(FIXTURE);
  const FX = JSON.parse(JSON.stringify(w0.CARTAPRA_FIXTURE_RESUMEN_COBERTURA)); // cobertura confirmada (no declarados en rojo)
  const lista = { status: 200, body: { ...FX, conexion: { ...FX.conexion, ultimaActualizacion: '2026-11-16T12:00:00.000Z' },
    ficha: { ...FX.ficha, socios: [{ nombre: '<img src=x onerror=alert(1)>', rut: '11111111-1', participacionCapital: 60, participacionUtilidades: 60 }, ...FX.ficha.socios] } } };
  const c = await montar({ resumen: lista }, true);
  const t = texto(c.d);
  res('2.3 listo → «Conectado» + última actualización 09:00 hora de Chile', t.includes('Conectado') && t.includes('09:00') && t.includes('hora de Chile'), t);
  res('2.4 semáforo «Hay algo que revisar» (aviso), IVA estimado provisorio y totales del año con separador chileno',
    t.includes('Hay algo que revisar') && t.includes('3 factura(s) de compra pendientes') && t.includes('F29 estimado de noviembre') && t.includes('$184.786') && t.includes('Provisorio') && t.includes('Ventas 2026') && t.includes('$74.938.600') && t.includes('Compras 2026'), t);
  res('2.5 cartas: máx. 5, «últimas 5 de 7», fecha dd-mm-aaaa y plazo de la notificación', c.d.querySelectorAll('.sii-lista.cartas li').length === 5 && t.includes('últimas 5 de 7') && t.includes('18-02-2026 · Carta') && t.includes('Plazo: Dentro de los 5 días hábiles'), t);
  res('2.6 datos externos como texto: ningún <img> inyectado', c.d.querySelectorAll('#det-sii img').length === 0 && t.includes('<img src=x'));
  res('2.7 línea superior: régimen · contabilidad · «Exenta de IVA»', t.includes('REGIMEN PRO PYME GENERAL (14D) · Contabilidad simplificada · Exenta de IVA'), t);
  res('2.8 F29 (cobertura confirmada): aviso rojo «F29 no declarados: marzo, abril y septiembre 2026» + «En plazo: octubre (vence 20-11)»',
    c.d.querySelector('.sii-f29.mal') != null && c.d.querySelectorAll('.sii-mes[data-estado="no_declarado"]').length === 3 && t.includes('F29 no declarados: marzo, abril y septiembre 2026') && t.includes('En plazo: octubre (vence 20-11)'), t);
  res('2.9 cumplimiento, socios con % y representante vigente', t.includes('Cumple sus obligaciones tributarias') && t.includes('Socia Ficticia Uno (••••••11-1) · 100%') && /Representante vigente\s*Socia Ficticia Uno/.test(t), t);
  res('2.10 exenta: nota de crédito no comparado y SIN el punto de cuadratura', t.includes('Empresa exenta de IVA') && !t.includes('no cuadra'), t);
  res('2.11 ya no se vuelca el JSON crudo («Ver todo lo que entrega el SII»)', !t.includes('Ver todo lo que entrega') && !c.d.querySelector('#det-sii pre'));
  const alDia = { status: 200, body: { ...FX, ficha: { ...FX.ficha, afecta_iva: true }, monitor: { ...FX.monitor, exenta: undefined },
    f29: { ...FX.f29, no_declarados: [], sin_verificar: [], periodos: FX.f29.periodos.map((p: any) => (p.estado === 'no_declarado' ? { ...p, estado: 'declarado', folio: '1' } : p)) } } };
  const e = await montar({ resumen: alDia }, true);
  const te = texto(e.d);
  res('2.12 sin no declarados → verde «F29 al día (últimos 12 meses)» (y sigue «En plazo: octubre»); afecta → «Afecta a IVA»',
    e.d.querySelector('.sii-f29.bien') != null && te.includes('F29 al día (últimos 12 meses)') && te.includes('En plazo: octubre') && te.includes('Afecta a IVA') && !te.includes('no declarados'), te);
  const sinF = await montar({ resumen: { status: 200, body: { ...FX, f29: null } } }, true);
  res('2.13 f29 null → aviso neutro (nunca «al día» ni «no declarados» sin datos)', texto(sinF.d).includes('No se pudo revisar el F29') && !texto(sinF.d).includes('F29 al día') && !texto(sinF.d).includes('no declarados') && !sinF.d.querySelector('.sii-f29'), texto(sinF.d));
}
// ── 2b. Botón según puede_conectar (servidor) y conector sin acceso al resumen ──
{
  const a = await montar({ resumen: con('clave_rechazada') }, false);
  res('2b.1 clave_rechazada con puede_conectar=false → sin «Reconectar»', ![...a.d.querySelectorAll('button')].some((b) => b.textContent === 'Reconectar'));
  const b = await montar({ resumen: con('no_conectada') }, true);
  res('2b.2 puede_conectar=true (aunque no sea Master) → «Conectar con el SII»', [...b.d.querySelectorAll('button')].some((x) => x.textContent === 'Conectar con el SII'));
  const c = await montar({ resumen: { status: 403, body: { ok: false, error: 'SIN_PERMISO' } }, estado: { status: 200, body: { ok: true, conexion: { estado: 'no_conectada' }, puede_conectar: true } } }, true);
  res('2b.3 conector: resumen 403 → pide «estado» y muestra «Conectar con el SII»', c.pedidos.map((p) => p.body.accion).join(',') === 'resumen,estado' && [...c.d.querySelectorAll('button')].some((x) => x.textContent === 'Conectar con el SII'), c.pedidos);
  const d2 = await montar({ resumen: { status: 403, body: { ok: false, error: 'SIN_PERMISO' } }, estado: { status: 200, body: { ok: true, conexion: { estado: 'conectada', cargaInicialLista: true, ultimaActualizacion: '2026-11-16T12:00:00.000Z' }, puede_conectar: true } } }, true);
  res('2b.4 conector con empresa ya conectada → «Conectado» y nota de que los datos los ve el equipo asignado', texto(d2.d).includes('Conectado') && texto(d2.d).includes('los ve el Master y el equipo asignado'), texto(d2.d));
}
// ── R3. Piloto, estados nuevos del F29, RUT enmascarado, sin dobles solicitudes y Retry-After ──
{
  const w0 = new JSDOM('', { runScripts: 'outside-only' }).window as any; w0.eval(FIXTURE);
  const FXP = JSON.parse(JSON.stringify(w0.CARTAPRA_FIXTURE_RESUMEN));            // piloto + cobertura NO confirmada
  const FXC = JSON.parse(JSON.stringify(w0.CARTAPRA_FIXTURE_RESUMEN_COBERTURA));
  const a = await montar({ resumen: { status: 200, body: FXP } }, false);
  const ta = texto(a.d);
  res('R3.1 piloto + cobertura no confirmada → ámbar «F29 no encontrados en el SII (pendiente de verificar): marzo, abril y septiembre 2026», nunca rojo',
    a.d.querySelector('.sii-f29.dudoso') != null && !a.d.querySelector('.sii-f29.mal') && ta.includes('F29 no encontrados en el SII (pendiente de verificar): marzo, abril y septiembre 2026')
    && ta.includes('Cartapra aún no confirma que la información esté completa') && !ta.includes('no declarados'), ta);
  res('R3.2 períodos: 3 «Sin verificar», 1 «En plazo», resto «Declarado»; sin «No declarado»',
    a.d.querySelectorAll('.sii-mes[data-estado="sin_verificar"]').length === 3 && a.d.querySelectorAll('.sii-mes[data-estado="en_plazo"]').length === 1
    && a.d.querySelectorAll('.sii-mes[data-estado="declarado"]').length === 8 && !a.d.querySelector('.sii-mes[data-estado="no_declarado"]'));
  res('R3.3 piloto: sello «Piloto: solo lectura de empresas propias» y ningún botón de conexión', ta.includes('Piloto: solo lectura de empresas propias') && a.d.querySelectorAll('button').length === 0, ta);
  res('R3.4 RUT de socios/representantes enmascarados y ningún RUT completo en la tarjeta',
    ta.includes('Socia Ficticia Uno (••••••11-1)') && !/(\d{1,2}\.\d{3}\.\d{3}|\d{7,8})-[\dkK]/.test(ta), ta);
  const sinCon = await montar({ resumen: { status: 200, body: { ok: true, conexion: { estado: 'no_conectada' }, puede_conectar: true, piloto: true, ficha: null, f29: null, monitor: null, sii: {} } } }, true);
  res('R3.5 piloto con empresa sin conectar → sin botón «Conectar» aunque llegue puede_conectar=true', ![...sinCon.d.querySelectorAll('button')].some((b) => /Conectar/.test(b.textContent || '')) && texto(sinCon.d).includes('Piloto: solo lectura'));
  const per = (p: string, estado: string, vence: string, extra: Record<string, unknown> = {}) => ({ periodo: p, estado, vence, vence_confirmado: estado !== 'revisar_vencimiento', ...extra });
  const mix = { ...FXC, f29: { ...FXC.f29, no_declarados: [], en_plazo: [], declarados: [], sin_verificar: ['202511', '202603'], revisar_vencimiento: ['202612'], no_aplica: ['202601'],
    periodos: [per('202511', 'sin_verificar', '2025-12-22'), per('202601', 'no_aplica', '2026-02-20'), per('202603', 'sin_verificar', '2026-04-20'), per('202612', 'revisar_vencimiento', '2027-01-20')] } };
  const b = await montar({ resumen: { status: 200, body: mix } }, true);
  const tb = texto(b.d);
  res('R3.6 meses de dos años: «noviembre 2025 y marzo 2026»; «Revisar vencimiento: diciembre 2026» con «confirmar vencimiento»',
    tb.includes('pendiente de verificar): noviembre 2025 y marzo 2026') && tb.includes('Revisar vencimiento: diciembre 2026') && tb.includes('Venció la fecha estimada; confirmar vencimiento.'), tb);
  res('R3.7 «No aplica» no se muestra en la fila de períodos', !b.d.querySelector('.sii-mes[data-estado="no_aplica"]') && b.d.querySelectorAll('.sii-mes').length === 3);
  const fuera = await montar({ resumen: { status: 403, body: { ok: false, error: 'EMPRESA_FUERA_PILOTO' } }, estado: { status: 200, body: { ok: true, conexion: { estado: 'no_conectada' }, puede_conectar: true } } }, true);
  res('R3.8 EMPRESA_FUERA_PILOTO → mensaje de piloto, NO pide «estado» y sin botones',
    texto(fuera.d).includes('Piloto: solo lectura de empresas propias') && fuera.pedidos.length === 1 && fuera.d.querySelectorAll('button').length === 0, fuera.pedidos);
}
{
  // Sin dobles solicitudes: la Edge tarda; se monta 3 veces el mismo cliente mientras la primera está en curso.
  const dom = new JSDOM('<!doctype html><html><head></head><body><div id="det-sii"></div></body></html>', { url: 'https://gestoor.contadoor.cl/clientes/', runScripts: 'outside-only' });
  const w: any = dom.window; const pedidos: any[] = []; let soltar: () => void = () => {};
  w.edgeFetch = (_fn: string, body: any) => { pedidos.push(body); return new Promise((ok) => { soltar = () => ok({ ok: true, status: 200, json: () => Promise.resolve({ ok: true, conexion: { estado: 'no_conectada' }, puede_conectar: false }) }); }); };
  w.eval(MENU.replace(/if\(document\.readyState[\s\S]*$/, '})();')); w.eval(JS);
  const cont = w.document.getElementById('det-sii');
  w.GestoorSII.montar(cont, 7); w.GestoorSII.montar(cont, 7); w.GestoorSII.desmontar(); w.GestoorSII.montar(cont, 7);
  await espera();
  res('R3.9 una sola solicitud en curso por cliente (se reutiliza la promesa)', pedidos.length === 1, pedidos);
  soltar(); await espera();
  res('R3.10 la respuesta reutilizada pinta la tarjeta montada al final', (cont.textContent || '').includes('Sin conectar con el SII'));
  w.GestoorSII.montar(cont, 7); await espera(); soltar(); await espera();
  res('R3.11 terminada la anterior, una nueva carga sí consulta', pedidos.length === 2, pedidos);
}
{
  // 429: respeta reintentarEn (deshabilita «Volver a revisar» y no consulta hasta que pase la espera).
  const dom = new JSDOM('<!doctype html><html><head></head><body><div id="det-sii"></div></body></html>', { url: 'https://gestoor.contadoor.cl/clientes/', runScripts: 'outside-only' });
  const w: any = dom.window; const pedidos: any[] = []; let limite = true;
  w.edgeFetch = (_fn: string, body: any) => {
    pedidos.push(body);
    const r = limite ? { status: 429, b: { ok: false, error: 'CARTAPRA_LIMITE', reintentarEn: 1 } } : { status: 200, b: { ok: true, conexion: { estado: 'no_conectada' }, puede_conectar: false } };
    return Promise.resolve({ ok: r.status < 300, status: r.status, json: () => Promise.resolve(r.b) });
  };
  w.eval(MENU.replace(/if\(document\.readyState[\s\S]*$/, '})();')); w.eval(JS);
  const cont = w.document.getElementById('det-sii');
  w.GestoorSII.montar(cont, 7); await espera();
  const btn = () => [...cont.querySelectorAll('button')].find((b: any) => /Volver a revisar/.test(b.textContent)) as any;
  res('R3.12 429 → «Vuelve a intentar en 1 segundos.» y «Volver a revisar» deshabilitado', (cont.textContent || '').includes('Vuelve a intentar en 1 segundos.') && btn()?.disabled === true, cont.textContent);
  btn().click(); w.GestoorSII.montar(cont, 7); await espera();
  res('R3.13 durante la espera no se consulta (ni con clic ni volviendo a montar)', pedidos.length === 1, pedidos);
  limite = false; await espera(1150);
  res('R3.14 pasada la espera el botón se habilita y vuelve a consultar', btn()?.disabled === false && (btn().click(), true));
  await espera();
  res('R3.15 …y pinta el nuevo estado', pedidos.length === 2 && (cont.textContent || '').includes('Sin conectar con el SII'), pedidos);
  w.GestoorSII.desmontar();
}
// ── 3. Clave cambió ──
{
  const { d } = await montar({ resumen: con('clave_rechazada', { ultimoError: 'Clave incorrecta' }) }, true);
  res('3.1 clave_rechazada → «La clave del SII cambió» + «Reconectar»', texto(d).includes('La clave del SII cambió') && [...d.querySelectorAll('button')].some((b) => b.textContent === 'Reconectar'));
}
// ── 4. Errores ──
{
  const a = await montar({ resumen: { status: 403, body: { ok: false, error: 'SIN_PERMISO' } } }, false);
  res('4.1 403 → «Sin acceso…» sin botón de reintento', texto(a.d).includes('Sin acceso a los datos del SII') && a.d.querySelectorAll('button').length === 0);
  const b = await montar({ resumen: { status: 429, body: { ok: false, error: 'CARTAPRA_LIMITE', reintentarEn: 17 } } }, true);
  res('4.2 429 → «Vuelve a intentar en 17 segundos.»', texto(b.d).includes('17 segundos'));
  const c = await montar({ resumen: { status: 503, body: { ok: false, error: 'NO_CONFIGURADO' } } }, true);
  res('4.3 503 NO_CONFIGURADO → «aún no está activada»', texto(c.d).includes('aún no está activada'));
}
// ── 5. Ventana: iframe propio y mensajes verificados ──
{
  const { w, d, pedidos } = await montar({ resumen: con('no_conectada'), ventana: { status: 200, body: { ok: true, widget: { url: 'https://app.cartapra.com/conecta-widget/abc', expiraEn: null } } } }, true);
  ([...d.querySelectorAll('button')].find((b) => b.textContent === 'Conectar con el SII') as HTMLButtonElement).click();
  await espera();
  const fr = d.querySelector('.sii-velo iframe') as HTMLIFrameElement | null;
  res('5.1 pide la ventana con {accion:"ventana", cliente_id:7} y abre un iframe de app.cartapra.com', !!fr && fr.getAttribute('src') === 'https://app.cartapra.com/conecta-widget/abc' && JSON.stringify(pedidos[1].body) === '{"accion":"ventana","cliente_id":7}');
  res('5.2 iframe con sandbox (sin allow-top-navigation ni popups)', /allow-scripts/.test(fr?.getAttribute('sandbox') || '') && !/top-navigation|popups/.test(fr?.getAttribute('sandbox') || ''));
  w.dispatchEvent(new w.MessageEvent('message', { origin: 'https://evil.example', source: fr!.contentWindow, data: { fuente: 'cartapra-conecta', evento: 'cerrar' } }));
  w.dispatchEvent(new w.MessageEvent('message', { origin: 'https://app.cartapra.com', source: w, data: { fuente: 'cartapra-conecta', evento: 'cerrar' } }));
  w.dispatchEvent(new w.MessageEvent('message', { origin: 'https://app.cartapra.com', source: fr!.contentWindow, data: { fuente: 'otra', evento: 'cerrar' } }));
  await espera();
  res('5.3 ignora mensajes de otro origen, de otra ventana o sin fuente "cartapra-conecta"', !!d.querySelector('.sii-velo'));
  w.dispatchEvent(new w.MessageEvent('message', { origin: 'https://app.cartapra.com', source: fr!.contentWindow, data: { fuente: 'cartapra-conecta', evento: 'conectada', rut: '77166269-2' } }));
  w.dispatchEvent(new w.MessageEvent('message', { origin: 'https://app.cartapra.com', source: fr!.contentWindow, data: { fuente: 'cartapra-conecta', evento: 'cerrar' } }));
  await espera();
  res('5.4 «conectada» avisa; «cerrar» cierra la ventana y vuelve a consultar el estado', !d.querySelector('.sii-velo') && /SII aceptó/.test(w._toast || '') && pedidos.length === 3 && pedidos[2].body.accion === 'resumen', pedidos);
  const m2 = await montar({ resumen: con('no_conectada'), ventana: { status: 200, body: { ok: true, widget: { url: 'https://evil.example/x' } } } }, true);
  ([...m2.d.querySelectorAll('button')].find((b) => b.textContent === 'Conectar con el SII') as HTMLButtonElement).click();
  await espera();
  res('5.5 una url que no es de app.cartapra.com NO se abre', !m2.d.querySelector('.sii-velo iframe'));
  m2.w.GestoorSII.desmontar();
}

console.log(`\n${ok}/${ok + mal} OK`);
if (mal) Deno.exit(1);
