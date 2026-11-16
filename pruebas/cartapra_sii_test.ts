// Cartapra F1 · tarjeta "Datos del SII" de la ficha del cliente · prueba LOCAL en jsdom con la Edge simulada (no toca Supabase ni Cartapra).
// Uso: deno run --allow-read --allow-env --allow-sys --allow-net=registry.npmjs.org pruebas/cartapra_sii_test.ts
import { JSDOM } from 'npm:jsdom@24.1.0';
const RAIZ = new URL('../', import.meta.url);
const leer = (p: string) => Deno.readTextFileSync(new URL(p, RAIZ));
let ok = 0, mal = 0;
const res = (n: string, b: boolean, d: unknown = '') => { if (b) { ok++; console.log('OK  ', n); } else { mal++; console.log('MAL ', n, JSON.stringify(d)); } };
const espera = (ms = 20) => new Promise((r) => setTimeout(r, ms));
const JS = leer('clientes/sii-cartapra.js'), MENU = leer('assets/gestoor-menu.js'), CL = leer('clientes/index.html');

// ── 0. Integración en la ficha ──
res('0.1 clientes/index.html carga sii-cartapra.js después del script del módulo y antes de auth.js',
  CL.indexOf('<script src="sii-cartapra.js">') > CL.indexOf('function verDetalle') && CL.indexOf('sii-cartapra.js') < CL.indexOf('../auth.js'));
res('0.2 verDetalle monta la tarjeta con c.id (nunca con RUT) y cerrarDetalle la desmonta',
  /GestoorSII\.montar\(g\('det-sii'\), c\.id,/.test(CL) && /function cerrarDetalle\(\) \{ if \(window\.GestoorSII\) GestoorSII\.desmontar\(\);/.test(CL));
res('0.3 el módulo no carga scripts de terceros (sin conecta.js ni <script src=http>)', !/conecta\.js['"]?\s*[;)]|createElement\(['"]script/.test(JS));
res('0.4 el módulo no usa la llave ni llama a Cartapra directo (solo edgeFetch("cartapra"))', !/ck_live|Bearer|api\/conecta/.test(JS) && /f\('cartapra', cuerpo\)/.test(JS));

type Resp = { status: number; body: unknown };
async function montar(respuestas: Record<string, Resp>, esMaster: boolean) {
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
  w.GestoorSII.montar(w.document.getElementById('det-sii'), 7, { esMaster });
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
  res('1.3 no-Master: sin botón, con «Pídele al Master que la conecte.»', n.d.querySelectorAll('button').length === 0 && texto(n.d).includes('Pídele al Master'));
}
// ── 2. Conectado (leyendo y listo) ──
{
  const a = await montar({ resumen: con('conectada', { actualizando: true, ultimaActualizacion: '2026-11-16T13:05:00.000Z' }) }, true);
  res('2.1 actualizando → «Leyendo el SII…» con hora de Chile (10:05)', texto(a.d).includes('Leyendo el SII…') && texto(a.d).includes('10:05'), texto(a.d));
  const b = await montar({ resumen: con('conectada', { cargaInicialLista: false }) }, true);
  res('2.2 !cargaInicialLista → «Leyendo el SII…»', texto(b.d).includes('Leyendo el SII…'));
  const lista = { status: 200, body: { ok: true, conexion: { estado: 'conectada', ultimaActualizacion: '2026-11-16T12:00:00.000Z', actualizando: false, cargaInicialLista: true, ultimoError: null },
    monitor: { semaforo: 'aviso', ultimoMes: { periodo: '2026-10', ventasNeto: 1234567, comprasNeto: 456789, ivaDebito: 234568 }, razonSocial: '<img src=x onerror=alert(1)>' },
    sii: { sii_cartas: { datos: [{ id: 1 }, { id: 2 }] }, sii_alertas: [] } } };
  const c = await montar({ resumen: lista }, true);
  const t = texto(c.d);
  res('2.3 listo → «Conectado» + última actualización 09:00 hora de Chile', t.includes('Conectado') && t.includes('09:00') && t.includes('hora de Chile'), t);
  res('2.4 semáforo «Hay algo que revisar» (aviso) y montos con separador chileno', t.includes('Hay algo que revisar') && t.includes('$1.234.567'), t);
  res('2.5 cartas (2) y alertas (0) del SII', /Cartas del SII\s*2/.test(t) && /Alertas del SII\s*0/.test(t), t);
  res('2.6 datos externos como texto: ningún <img> inyectado', c.d.querySelectorAll('#det-sii img').length === 0 && t.includes('<img src=x'));
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
