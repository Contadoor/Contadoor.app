// CARTAPRA-AL-CONECTAR (19-11) · disparo inmediato «traer» tras la ventana de conexión + «Conectada · trayendo datos del SII…»
// Prueba LOCAL en jsdom con la Edge y la RPC simuladas (no toca Supabase ni Cartapra). Datos ficticios.
// Uso: deno run --allow-read --allow-env --allow-sys --allow-net=registry.npmjs.org pruebas/cartapra_al_conectar_test.ts
import { JSDOM } from 'npm:jsdom@24.1.0';
const js = Deno.readTextFileSync(new URL('../clientes/sii-cartapra.js', import.meta.url));
const CL = Deno.readTextFileSync(new URL('../clientes/index.html', import.meta.url));
let total = 0, fallas = 0;
const res = (n: string, ok: boolean, d: unknown = '') => { total++; console.log((ok ? 'OK   ' : 'MAL  ') + n + (ok ? '' : ' ' + JSON.stringify(d))); if (!ok) fallas++; };
const espera = (ms = 30) => new Promise((r) => setTimeout(r, ms));
const TRAER = (resultado: string, estado = 'carga_inicial') => [200, { ok: true, conexion: { estado: 'conectada' }, traer: { resultado, estado, procesando: true } }];
function montar(resp: (b: any) => any[], equipoSec: string[][] = []) {
  const dom = new JSDOM('<!doctype html><body><div id="det-sii"></div></body>', { runScripts: 'outside-only', url: 'https://gestoor.contadoor.cl/clientes/' });
  const w: any = dom.window; const llamadas: any[] = []; const toasts: string[] = []; const rpcs: string[] = [];
  w.toast = (m: string) => toasts.push(m);
  w.GESTOOR_SII_VIGIA_MS = 20;
  w.gIcon = (n: string) => '<svg data-n="' + n + '"></svg>';
  w.edgeFetch = (fn: string, b: any) => { llamadas.push(b); const [st, j] = resp(b); return Promise.resolve({ ok: st === 200, status: st, json: () => Promise.resolve(j) }); };
  let vez = 0;
  const sbFetch = (ruta: string) => { rpcs.push(ruta); const est = equipoSec[Math.min(vez++, equipoSec.length - 1)] ?? []; return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(est.map((e, i) => ({ cliente_id: 12 + i, estado: e }))) }); };
  w.eval(js); return { w, llamadas, toasts, rpcs, sbFetch };
}
const VENTANA = [200, { ok: true, widget: { url: 'https://app.cartapra.com/conecta/abc' } }];
const msg = (w: any, evento: string) => {
  const fr = w.document.querySelector('.sii-velo iframe');
  w.dispatchEvent(new w.MessageEvent('message', { origin: 'https://app.cartapra.com', source: fr.contentWindow, data: { fuente: 'cartapra-conecta', evento } }));
};

res('0.1 la lista de clientes repinta cuando una empresa «trayendo» queda lista (alListo → prepararSiiLista(true))',
  /GestoorSII\.alListo\(function \(\) \{ prepararSiiLista\(true\); \}\)/.test(CL));
res('0.2 «traer» se pide con llamar() (solo accion y cliente_id; el RUT lo pone el servidor)', /llamar\('traer', cid\)/.test(js) && !/accion: 'traer', rut/.test(js));

{ // 1. Lista: «conectada» en la ventana → «traer» al tiro, distintivo «trayendo», luego «SII conectado»
  const m = montar((b) => b.accion === 'ventana' ? VENTANA : b.accion === 'traer' ? TRAER('encolado') : [500, {}],
    [['sin_conexion'], ['sin_conexion'], ['conectada']]);
  await m.w.GestoorSII.prepararInsignias(m.sbFetch);
  let refrescos = 0, listos: number[] = [];
  m.w.GestoorSII.alListo((ids: number[]) => { listos = ids; });
  m.w.GestoorSII.conectar(12, m.w.document.createElement('button'), () => refrescos++); await espera();
  msg(m.w, 'conectada'); await espera(5);
  const traer = m.llamadas.filter((x) => x.accion === 'traer');
  res('1.1 «conectada» → «traer» inmediato para el cliente 12, solo {accion, cliente_id}', traer.length === 1 && JSON.stringify(traer[0]) === '{"accion":"traer","cliente_id":12}', m.llamadas);
  res('1.2 aviso «Conectada · trayendo datos del SII…»', m.toasts.some((t) => /Conectada · trayendo datos del SII…/.test(t)), m.toasts);
  const tag = m.w.GestoorSII.insignia('76000000-0', 12);
  res('1.3 distintivo «Conectada · trayendo datos del SII…» (clase trae, ícono reloj)', !!tag && tag.className === 'sii-tag trae' && tag.textContent === 'Conectada · trayendo datos del SII…' && !!tag.querySelector('svg[data-n="reloj"]'));
  res('1.4 estilos del distintivo trae', /\.sii-tag\.trae\{/.test(m.w.document.getElementById('sii-cartapra-css')?.textContent || ''));
  msg(m.w, 'cerrar'); await espera(5);
  res('1.5 al cerrar: la lista se refresca (y como mucho un «traer» más, idempotente)', refrescos === 1 && m.llamadas.filter((x) => x.accion === 'traer').length <= 2);
  await espera(200);
  res('1.6 la revisión periódica usa la RPC del equipo (sin Cartapra) y al quedar conectada avisa y repinta', listos.join() === '12' && m.rpcs.every((r) => r === 'rpc/sii_conexiones_equipo') && m.toasts.some((t) => /^Listo/.test(t)), { listos, toasts: m.toasts });
  const ok = m.w.GestoorSII.insignia('76000000-0', 12);
  res('1.7 distintivo pasa a «SII conectado»', !!ok && ok.className === 'sii-tag ok' && m.w.GestoorSII.trayendo(12) === false);
}
{ // 2. Cerrar sin conectar: «traer» responde no_conectada → nada «trayendo»; error de la Edge → no rompe el cierre
  const m = montar((b) => b.accion === 'ventana' ? VENTANA : b.accion === 'traer' ? [200, { ok: true, conexion: { estado: 'no_conectada' }, traer: { resultado: 'no_conectada', procesando: false } }] : [500, {}]);
  let cerro = 0;
  m.w.GestoorSII.conectar(12, m.w.document.createElement('button'), () => cerro++); await espera();
  msg(m.w, 'cerrar'); await espera();
  res('2.1 cerrar sin conectar: se consulta «traer» una vez, sin aviso ni distintivo', m.llamadas.filter((x) => x.accion === 'traer').length === 1 && !m.toasts.length && m.w.GestoorSII.insignia('1-9', 12) === null && cerro === 1);
  const e = montar((b) => b.accion === 'ventana' ? VENTANA : [500, { ok: false, error: 'ERROR_INTERNO' }]);
  let cerro2 = 0;
  e.w.GestoorSII.conectar(12, e.w.document.createElement('button'), () => cerro2++); await espera();
  msg(e.w, 'conectada'); msg(e.w, 'cerrar'); await espera();
  res('2.2 «traer» con error: la ventana se cierra y la lista se refresca igual (el reloj del servidor la trae)', cerro2 === 1 && !e.w.document.querySelector('.sii-velo'));
}
{ // 3. Ya conectada en Gestoor (resultado ya_visto / estado conectada) → sin «trayendo»
  const m = montar((b) => b.accion === 'ventana' ? VENTANA : b.accion === 'traer' ? TRAER('ya_visto', 'conectada') : [500, {}]);
  m.w.GestoorSII.conectar(12, m.w.document.createElement('button'), () => {}); await espera();
  msg(m.w, 'conectada'); await espera();
  res('3.1 ya conectada → sin marca «trayendo»', m.w.GestoorSII.trayendo(12) === false);
}
{ // 4. Ficha: «Conectada · trayendo datos del SII…» se revisa sola; al quedar lista pide «traer»
  let n = 0;
  const m = montar((b) => {
    if (b.accion === 'resumen') { n++; return [200, { ok: true, puede_conectar: true, conexion: n === 1 ? { estado: 'conectada', cargaInicialLista: false } : { estado: 'conectada', cargaInicialLista: true, ultimaActualizacion: '2026-11-19T21:30:00.000Z' }, sii: {}, ficha: null }]; }
    if (b.accion === 'traer') return TRAER('encolado');
    return [500, {}];
  });
  m.w.GestoorSII.montar(m.w.document.getElementById('det-sii'), 7, {}); await espera();
  const txt = m.w.document.getElementById('det-sii').textContent;
  res('4.1 ficha: «Conectada · trayendo datos del SII…» y «se actualiza sola»', /Conectada · trayendo datos del SII…/.test(txt) && /se actualiza sola/.test(txt), txt);
  res('4.2 ficha en carga: la empresa queda «trayendo» (distintivo en la lista)', m.w.GestoorSII.trayendo(7) === true);
  m.w.GestoorSII.desmontar();
  m.w.GestoorSII.montar(m.w.document.getElementById('det-sii'), 7, {}); await espera();
  res('4.3 al verla conectada con la carga lista → pide «traer» (Gestoor la lee al tiro)', m.llamadas.some((x) => x.accion === 'traer' && x.cliente_id === 7), m.llamadas);
  m.w.GestoorSII.desmontar();
}
console.log(`${total - fallas}/${total} pruebas OK`); Deno.exit(fallas ? 1 : 0);
