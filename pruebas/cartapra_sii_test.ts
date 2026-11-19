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
res('0.4 el módulo no usa la llave ni llama a Cartapra directo (solo edgeFetch("cartapra") o la misma llamada con el JWT de la sesión)',
  !/ck_live|api\/conecta/.test(JS) && /f\('cartapra', cuerpo\)/.test(JS) && (JS.match(/Bearer/g) || []).length === 1 && /Authorization: 'Bearer ' \+ tok\b/.test(JS) && /var tok = window\._gestoorAccessToken;/.test(JS));

type Resp = { status: number; body: unknown };
async function montar(respuestas: Record<string, Resp>, puede: boolean, vista = 'ficha') {
  // R4: cada vista pide su acción; las respuestas de prueba de 'resumen' sirven para la vista elegida.
  const ACC: Record<string, string> = { ficha: 'resumen', contable: 'contable', renta: 'renta' };
  if (vista !== 'ficha' && respuestas.resumen && !respuestas[ACC[vista]]) respuestas = { ...respuestas, [ACC[vista]]: respuestas.resumen };
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
  w.GestoorSII.montar(w.document.getElementById('det-sii'), 7, { esMaster: !puede, vista }); // esMaster ya no se usa: se pasa al revés a propósito
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
  res('2.1 actualizando → «Conectada · trayendo datos del SII…» con hora de Chile (10:05)', texto(a.d).includes('Conectada · trayendo datos del SII…') && texto(a.d).includes('10:05'), texto(a.d));
  const b = await montar({ resumen: con('conectada', { cargaInicialLista: false }) }, true);
  res('2.2 !cargaInicialLista → «Conectada · trayendo datos del SII…» (se actualiza sola)', texto(b.d).includes('Conectada · trayendo datos del SII…') && texto(b.d).includes('se actualiza sola'), texto(b.d));
  const w0 = new JSDOM('', { runScripts: 'outside-only' }).window as any; w0.eval(FIXTURE);
  const FX = JSON.parse(JSON.stringify(w0.CARTAPRA_FIXTURE_RESUMEN_COBERTURA)); // cobertura confirmada (no declarados en rojo)
  const lista = { status: 200, body: { ...FX, conexion: { ...FX.conexion, ultimaActualizacion: '2026-11-16T12:00:00.000Z' },
    ficha: { ...FX.ficha, socios: [{ nombre: '<img src=x onerror=alert(1)>', rut: '11111111-1', participacionCapital: 60, participacionUtilidades: 60 }, ...FX.ficha.socios] } } };
  const c = await montar({ resumen: lista }, true);
  const cc = await montar({ resumen: lista }, true, 'contable');
  const tf = texto(c.d), t = texto(cc.d);
  res('2.3 listo → «Conectado» + última actualización 09:00 hora de Chile', tf.includes('Conectado') && t.includes('Conectado') && t.includes('09:00') && t.includes('hora de Chile'), t);
  res('2.4 semáforo «Hay algo que revisar» (aviso), IVA estimado provisorio y totales del año con separador chileno',
    t.includes('Hay algo que revisar') && t.includes('3 factura(s) de compra pendientes') && t.includes('F29 estimado de noviembre') && t.includes('$184.786') && t.includes('Provisorio') && t.includes('Ventas 2026') && t.includes('$74.938.600') && t.includes('Compras 2026'), t);
  res('2.5 cartas: máx. 5, «últimas 5 de 7», fecha dd-mm-aaaa y plazo de la notificación', cc.d.querySelectorAll('.sii-lista.cartas li').length === 5 && t.includes('últimas 5 de 7') && t.includes('18-02-2026 · Carta') && t.includes('Plazo: Dentro de los 5 días hábiles'), t);
  res('2.6 datos externos como texto: ningún <img> inyectado', c.d.querySelectorAll('#det-sii img').length === 0 && tf.includes('<img src=x'));
  res('2.7 R4 Ficha: régimen, contabilidad y «Exenta de IVA»; Contable: línea «Empresa exenta de IVA»', tf.includes('Régimen tributarioREGIMEN PRO PYME GENERAL (14D)') && tf.includes('ContabilidadSimplificada') && tf.includes('IVAExenta de IVA') && t.includes('Empresa exenta de IVA'), tf);
  res('2.8 F29 (cobertura confirmada): aviso rojo «F29 no declarados: marzo, abril y septiembre 2026» + «En plazo: octubre (vence 20-11)»',
    cc.d.querySelector('.sii-f29.mal') != null && cc.d.querySelectorAll('.sii-mes[data-estado="no_declarado"]').length === 3 && t.includes('F29 no declarados: marzo, abril y septiembre 2026') && t.includes('En plazo: octubre (vence 20-11)'), t);
  res('2.9 cumplimiento, socios con % y representante vigente', tf.includes('Cumple sus obligaciones tributarias') && tf.includes('Socia Ficticia Uno (••••••11-1) · 100%') && /Representante vigente\s*Socia Ficticia Uno/.test(tf), tf);
  res('2.10 exenta: nota de crédito no comparado y SIN el punto de cuadratura', t.includes('Empresa exenta de IVA') && !t.includes('no cuadra'), t);
  res('2.11 ya no se vuelca el JSON crudo («Ver todo lo que entrega el SII»)', !t.includes('Ver todo lo que entrega') && !tf.includes('Ver todo lo que entrega') && !c.d.querySelector('#det-sii pre') && !cc.d.querySelector('#det-sii pre'));
  const alDia = { status: 200, body: { ...FX, ficha: { ...FX.ficha, afecta_iva: true }, monitor: { ...FX.monitor, exenta: undefined },
    f29: { ...FX.f29, no_declarados: [], sin_verificar: [], periodos: FX.f29.periodos.map((p: any) => (p.estado === 'no_declarado' ? { ...p, estado: 'declarado', folio: '1' } : p)) } } };
  const e = await montar({ resumen: alDia }, true, 'contable');
  const ef = await montar({ resumen: alDia }, true);
  const te = texto(e.d) + ' ' + texto(ef.d);
  res('2.12 sin no declarados → verde «F29 al día (últimos 12 meses)» (y sigue «En plazo: octubre»); afecta → «Afecta a IVA»',
    e.d.querySelector('.sii-f29.bien') != null && te.includes('F29 al día (últimos 12 meses)') && te.includes('En plazo: octubre') && te.includes('Afecta a IVA') && !te.includes('no declarados'), te);
  const sinF = await montar({ resumen: { status: 200, body: { ...FX, f29: null } } }, true, 'contable');
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
  const a = await montar({ resumen: { status: 200, body: FXP } }, false, 'contable');
  const af = await montar({ resumen: { status: 200, body: FXP } }, false);
  const ta = texto(a.d), taf = texto(af.d);
  res('R3.1 piloto + cobertura no confirmada → ámbar «F29 no encontrados en el SII (pendiente de verificar): marzo, abril y septiembre 2026», nunca rojo',
    a.d.querySelector('.sii-f29.dudoso') != null && !a.d.querySelector('.sii-f29.mal') && ta.includes('F29 no encontrados en el SII (pendiente de verificar): marzo, abril y septiembre 2026')
    && ta.includes('Cartapra aún no confirma que la información esté completa') && !ta.includes('no declarados'), ta);
  res('R3.2 períodos: 3 «Sin verificar», 1 «En plazo», resto «Declarado»; sin «No declarado»',
    a.d.querySelectorAll('.sii-mes[data-estado="sin_verificar"]').length === 3 && a.d.querySelectorAll('.sii-mes[data-estado="en_plazo"]').length === 1
    && a.d.querySelectorAll('.sii-mes[data-estado="declarado"]').length === 8 && !a.d.querySelector('.sii-mes[data-estado="no_declarado"]'));
  res('R3.3 piloto: sello «Piloto: solo lectura de empresas propias» y ningún botón de conexión', ta.includes('Piloto: solo lectura de empresas propias') && a.d.querySelectorAll('button').length === 0, ta);
  res('R3.4 RUT de socios/representantes enmascarados y ningún RUT completo en la tarjeta',
    taf.includes('Socia Ficticia Uno (••••••11-1)') && !/(\d{1,2}\.\d{3}\.\d{3}|\d{7,8})-[\dkK]/.test(ta + taf), taf);
  const sinCon = await montar({ resumen: { status: 200, body: { ok: true, conexion: { estado: 'no_conectada' }, puede_conectar: true, piloto: true, ficha: null, f29: null, monitor: null, sii: {} } } }, true);
  res('R3.5 piloto con empresa sin conectar → sin botón «Conectar» aunque llegue puede_conectar=true', ![...sinCon.d.querySelectorAll('button')].some((b) => /Conectar/.test(b.textContent || '')) && texto(sinCon.d).includes('Piloto: solo lectura'));
  const per = (p: string, estado: string, vence: string, extra: Record<string, unknown> = {}) => ({ periodo: p, estado, vence, vence_confirmado: estado !== 'revisar_vencimiento', ...extra });
  const mix = { ...FXC, f29: { ...FXC.f29, no_declarados: [], en_plazo: [], declarados: [], sin_verificar: ['202511', '202603'], revisar_vencimiento: ['202612'], no_aplica: ['202601'],
    periodos: [per('202511', 'sin_verificar', '2025-12-22'), per('202601', 'no_aplica', '2026-02-20'), per('202603', 'sin_verificar', '2026-04-20'), per('202612', 'revisar_vencimiento', '2027-01-20')] } };
  const b = await montar({ resumen: { status: 200, body: mix } }, true, 'contable');
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
  res('5.4 «conectada» avisa y pide «traer» UNA vez (solo accion y cliente_id); «cerrar» cierra la ventana y vuelve a consultar el estado', !d.querySelector('.sii-velo') && /SII aceptó/.test(w._toast || '') && pedidos.length === 4 && JSON.stringify(pedidos[2].body) === '{"accion":"traer","cliente_id":7}' && pedidos[3].body.accion === 'resumen', pedidos);
  const m2 = await montar({ resumen: con('no_conectada'), ventana: { status: 200, body: { ok: true, widget: { url: 'https://evil.example/x' } } } }, true);
  ([...m2.d.querySelectorAll('button')].find((b) => b.textContent === 'Conectar con el SII') as HTMLButtonElement).click();
  await espera();
  res('5.5 una url que no es de app.cartapra.com NO se abre', !m2.d.querySelector('.sii-velo iframe'));
  m2.w.GestoorSII.desmontar();
}

// ═════════ R4 (dictamen 17-11): tres vistas (Ficha / Contable / MiRenta), solo lectura ═════════
{
  const RC = leer('reportes-contable/index.html'), PIR = leer('pir/index.html'), AP = leer('pir/apertura.js');
  const w0 = new JSDOM('', { runScripts: 'outside-only' }).window as any; w0.eval(leer('pruebas/cartapra-sii-fixture-r4.js'));
  const R4 = JSON.parse(JSON.stringify(w0.CARTAPRA_FIXTURE_R4));
  res('R4.0a Contable carga el módulo y monta la vista "contable" con data-cid al abrir el detalle (no para toda la lista)',
    RC.includes('<script src="../clientes/sii-cartapra.js"></script>') && /sii-cartapra-slot" data-cid="'\+Number\(c\.id\)/.test(RC) && /GestoorSII\.montar\(slot, Number\(slot\.getAttribute\('data-cid'\)\), \{vista:'contable'\}\)/.test(RC));
  res('R4.0b MiRenta carga el módulo y monta la vista "renta" fuera de #mr-app, una vez por caso',
    PIR.includes('<script src="../clientes/sii-cartapra.js"></script>') && PIR.includes('<div id="mr-sii"') && /montar\(cont, cid, \{ vista: 'renta' \}\)/.test(AP) && /if \(siiMontado === cid\) return;/.test(AP));
  // Ficha
  const f = await montar({ resumen: { status: 200, body: R4.resumen } }, true);
  const tf = texto(f.d);
  res('R4.1 Ficha: identidad (régimen + desde, inicio de actividades, actividades, socios, domicilio) y SIN F29 ni renta',
    tf.includes('Identidad tributaria SII') && tf.includes('Desde 01-01-2025') && tf.includes('Inicio de actividades04-01-2021') && tf.includes('869091 ·') && tf.includes('Domicilio tributarioCALLE FICTICIA 123 · Santiago') && !tf.includes('F29 no') && !tf.includes('Situación mensual') && !tf.includes('AT 2026'), tf);
  res('R4.2 Ficha pide SOLO {accion:"resumen"}', JSON.stringify(f.pedidos.map((p: any) => p.body.accion)) === '["resumen"]', f.pedidos);
  // Contable
  const c = await montar({ contable: { status: 200, body: R4.contable } }, true, 'contable');
  const tc = texto(c.d);
  res('R4.3 Contable pide SOLO {accion:"contable"} y titula «Situación mensual SII»', JSON.stringify(c.pedidos.map((p: any) => p.body.accion)) === '["contable"]' && tc.includes('Situación mensual SII'), tc);
  res('R4.4 Letra S → alerta: «F29 con observación del SII: agosto 2026 (S: Observada (secundaria))» y chip «Observado (S)» en rojo',
    tc.includes('F29 con observación del SII: agosto 2026 (S: Observada (secundaria))') && c.d.querySelector('.sii-obs.roj') != null && [...c.d.querySelectorAll('.sii-mes.roj')].some((x: any) => /Observado \(S\)/.test(x.textContent)), tc);
  res('R4.5 Pago del F29 «no disponible» y nunca «pagado/girado»', tc.includes('Pago del F29: no disponible') && !/pagado|girado|sin pago/i.test(tc), tc);
  res('R4.6 Contable: acuse manual y cuadratura reservada a la fase siguiente', tc.includes('El acuse de recibo (aceptar o reclamar) se hace a mano en el SII.') && tc.includes('Cuadratura automática RCV vs F29: llega con el motor tributario'), tc);
  // MiRenta
  const r = await montar({ renta: { status: 200, body: R4.renta } }, true, 'renta');
  const tr = texto(r.d);
  res('R4.7 MiRenta pide SOLO {accion:"renta"}; AT 2026 «Aceptada · inconsistencias justificadas» + observación F135',
    JSON.stringify(r.pedidos.map((p: any) => p.body.accion)) === '["renta"]' && tr.includes('AT 2026 · Aceptada · inconsistencias justificadas') && tr.includes('Observación F135'), tr);
  res('R4.8 Cifras con código (Ingresos · 1410, Base imponible · 1729, IDPC · 20, PPM · 36) y separador chileno',
    tr.includes('Ingresos · 1410$84.500.000') && tr.includes('Base imponible · 1729$14.400.000') && tr.includes('Impuesto 1ª categoría (IDPC) · 20$1.737.500') && tr.includes('PPM acumulados · 36$420.000'), tr);
  res('R4.9 Pago: «Situación de pago: no disponible» + texto exacto de pago diferido; nunca «pagado»',
    tr.includes('Situación de pago: no disponible') && tr.includes('Pago diferido informado en F22. Su regularización posterior debe verificarse.') && !/\bpagado\b/i.test(tr), tr);
  res('R4.10 Saldos de cierre solo consulta (RAI · 1484, SAC · 1563, CPTS · 1545) con aviso «no modifica la apertura»',
    tr.includes('Saldos de cierre · antecedentes para la futura apertura') && tr.includes('RAI · 1484$21.000.000') && tr.includes('SAC · 1563') && tr.includes('CPTS · 1545') && tr.includes('Solo consulta: no modifica la apertura de MiRenta.'), tr);
  const tabs = [...r.d.querySelectorAll('.sii-tab')] as any[];
  res('R4.11 Pestañas por AT (2026, 2025, 2024); al elegir 2024 muestra «pérdida» con signo conservado',
    tabs.map((b) => b.textContent).join(',') === 'AT 2026,AT 2025,AT 2024' && (tabs[2].click(), texto(r.d).includes('Base imponible o pérdida · 1440-$2.100.000')), texto(r.d));
  const vac = await montar({ renta: { status: 200, body: { ...R4.renta, renta: { anios: [], at_actual: 2027, at_actual_estado: 'no_encontrada_verificar' } } } }, true, 'renta');
  res('R4.12 Sin F22 tras el vencimiento → «Renta AT 2027 no encontrada en el SII · verificar»', texto(vac.d).includes('Renta AT 2027 no encontrada en el SII · verificar'), texto(vac.d));
  const nul = await montar({ renta: { status: 200, body: { ...R4.renta, renta: null } } }, true, 'renta');
  res('R4.13 Fuente incompleta (renta null) → «Sin verificar», sin cifras', texto(nul.d).includes('Sin verificar') && !texto(nul.d).includes('$'), texto(nul.d));
  res('R4.14 Datos externos como texto también en renta (sin <img>)', r.d.querySelectorAll('#det-sii img').length === 0);
}

// ── E. 19-11 · «Enviar enlace al cliente» (tarea 1e) ──
{
  const URL_E = 'https://app.cartapra.com/conecta-alta/Tok3n_PRUEBA';
  const okEnl = { status: 200, body: { ok: true, enlace: { url: URL_E, expiraEn: '2026-12-03T02:24:49.885Z', dias: 14 } } };
  const m = await montar({ resumen: con('no_conectada'), enlace: okEnl }, true);
  const btns = [...m.d.querySelectorAll('button')] as any[];
  const be = btns.find((b) => b.textContent === 'Enviar enlace al cliente');
  res('E.1 Sin conectar y puede_conectar → botones «Conectar con el SII» y «Enviar enlace al cliente»', !!be && btns.some((b) => b.textContent === 'Conectar con el SII'));
  be.click(); await espera(); await espera();
  res('E.2 el pedido del enlace lleva SOLO { accion: "enlace", cliente_id }', JSON.stringify(m.pedidos.at(-1)) === JSON.stringify({ fn: 'cartapra', body: { accion: 'enlace', cliente_id: 7 } }), m.pedidos);
  const ta = m.d.getElementById('sii-enlace-msg') as any;
  res('E.3 Modal con el mensaje listo: incluye el enlace, «cifrada en Cartapra», «no pasa por nosotros», un solo uso y vencimiento 02-12-2026 (hora Chile)',
    !!ta && ta.value.includes(URL_E) && ta.value.includes('cifrada en Cartapra') && ta.value.includes('no pasa por nosotros') && ta.value.includes('una sola vez') && ta.value.includes('02-12-2026'), ta && ta.value);
  const wa = m.d.querySelector('.sii-enl a') as any;
  res('E.4 «Abrir WhatsApp» = wa.me con el mensaje codificado, en pestaña nueva y sin opener',
    !!wa && wa.href.startsWith('https://wa.me/?text=') && decodeURIComponent(wa.href.split('text=')[1]).includes(URL_E) && wa.target === '_blank' && /noopener/.test(wa.rel));
  res('E.5 El mensaje no contiene RUT ni datos del cliente (solo el enlace)', !/\d{7,8}-[\dkK]/.test(ta.value));
  const n = await montar({ resumen: con('no_conectada'), enlace: okEnl }, false);
  res('E.6 puede_conectar=false → sin botón de enlace', ![...n.d.querySelectorAll('button')].some((b: any) => b.textContent === 'Enviar enlace al cliente'));
  const r = await montar({ resumen: con('clave_rechazada'), enlace: okEnl }, true);
  res('E.7 Clave rechazada → «Reconectar» y «Enviar enlace al cliente»', [...r.d.querySelectorAll('button')].some((b: any) => b.textContent === 'Enviar enlace al cliente'));
  const c = await montar({ resumen: con('conectada', { cargaInicialLista: true }) }, true);
  res('E.8 Conectada → no ofrece enlace', ![...c.d.querySelectorAll('button')].some((b: any) => b.textContent === 'Enviar enlace al cliente'));
  const mal = await montar({ resumen: con('no_conectada'), enlace: { status: 200, body: { ok: true, enlace: { url: 'https://evil.example/conecta-alta/x' } } } }, true);
  const bm = [...mal.d.querySelectorAll('button')].find((b: any) => b.textContent === 'Enviar enlace al cliente') as any;
  let lanzo = false; try { bm.click(); await espera(); await espera(); } catch { lanzo = true; }
  res('E.9 Enlace ajeno → no se muestra modal', !mal.d.getElementById('sii-enlace-msg'), lanzo);
  const den = await montar({ resumen: con('no_conectada'), enlace: { status: 403, body: { ok: false, error: 'SIN_PERMISO', detalle: 'Solo el Master o un usuario autorizado para conectar empresas puede hacerlo.' } } }, true);
  ([...den.d.querySelectorAll('button')].find((b: any) => b.textContent === 'Enviar enlace al cliente') as any).click(); await espera(); await espera();
  res('E.10 403 al pedir el enlace → mensaje de permiso, sin modal', texto(den.d).includes('Solo el Master') && !den.d.getElementById('sii-enlace-msg'), texto(den.d));
}

// ═════════ 19-11: páginas SIN edgeFetch (Reporte Contable, Apertura MiRenta) ═════════
// Antes: llamar() rechazaba {status:0} sin pedir nada → «No pudimos revisar el SII ahora / Intenta de nuevo en unos minutos».
{
  const RC = leer('reportes-contable/index.html'), PIR = leer('pir/index.html');
  res('SE.0 Reporte Contable y MiRenta cargan sii-cartapra.js y no definen edgeFetch (por eso el respaldo)',
    RC.includes('sii-cartapra.js') && PIR.includes('sii-cartapra.js') && !/edgeFetch/.test(RC) && !/edgeFetch/.test(PIR));
  const w0 = new JSDOM('', { runScripts: 'outside-only' }).window as any; w0.eval(leer('pruebas/cartapra-sii-fixture-r4.js'));
  const R4 = JSON.parse(JSON.stringify(w0.CARTAPRA_FIXTURE_R4));
  const sinEdge = async (token: string | null, resp?: Resp) => {
    const dom = new JSDOM('<!doctype html><html><head></head><body><div id="det-sii"></div></body></html>', { url: 'https://gestoor.contadoor.cl/reportes-contable/', runScripts: 'outside-only' });
    const w: any = dom.window;
    const pedidos: any[] = [];
    w.SB_URL = 'https://proyecto.supabase.test'; w.SB_KEY = 'clave-anon-de-prueba'; w._gestoorAccessToken = token;
    w.fetch = (url: string, init: any) => {
      pedidos.push({ url, init });
      const r = resp ?? { status: 200, body: R4.contable };
      return Promise.resolve({ ok: r.status >= 200 && r.status < 300, status: r.status, json: () => Promise.resolve(r.body) });
    };
    w.eval(MENU.replace(/if\(document\.readyState[\s\S]*$/, '})();'));
    w.eval(JS);
    w.GestoorSII.montar(w.document.getElementById('det-sii'), 7, { vista: 'contable' });
    await espera(); await espera();
    return { d: w.document as Document, pedidos };
  };
  const a = await sinEdge('jwt-de-sesion');
  const ta = texto(a.d), p = a.pedidos[0] || { init: { headers: {} } };
  res('SE.1 sin edgeFetch: pide la Edge cartapra con el JWT de la sesión y pinta la situación mensual (no el error genérico)',
    a.pedidos.length === 1 && p.url === 'https://proyecto.supabase.test/functions/v1/cartapra' && ta.includes('Situación mensual SII') && ta.includes('Conectado') && !ta.includes('No pudimos revisar el SII ahora'), ta);
  res('SE.2 Authorization = JWT del usuario (nunca la clave anon); anon solo como apikey; cuerpo solo accion + cliente_id',
    p.init.headers.Authorization === 'Bearer jwt-de-sesion' && p.init.headers.apikey === 'clave-anon-de-prueba' && p.init.body === JSON.stringify({ accion: 'contable', cliente_id: 7 }), p.init);
  const b = await sinEdge(null);
  res('SE.3 sin sesión: no llama a nada y muestra «Tu sesión venció»', b.pedidos.length === 0 && texto(b.d).includes('Tu sesión venció'), texto(b.d));
  const c = await sinEdge('jwt-de-sesion', { status: 403, body: { ok: false, error: 'SIN_PERMISO' } });
  res('SE.4 sin edgeFetch y 403: mismo trato que en la ficha (reintenta «estado» y muestra sin acceso)',
    c.pedidos.length === 2 && JSON.parse(c.pedidos[1].init.body).accion === 'estado' && texto(c.d).includes('Sin acceso a los datos del SII'), texto(c.d));
}

console.log(`\n${ok}/${ok + mal} OK`);
Deno.exit(mal ? 1 : 0);   // 19-11: la ficha «trayendo datos» deja relojes de revisión vivos (normal en el navegador)
