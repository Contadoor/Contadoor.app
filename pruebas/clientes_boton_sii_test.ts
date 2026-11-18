// Botón «Conectar con el SII» en la lista de clientes (18-11). Prueba LOCAL con edgeFetch simulado; datos ficticios.
// Uso: deno run --allow-read --allow-env --allow-sys --allow-net=registry.npmjs.org pruebas/clientes_boton_sii_test.ts
import { JSDOM } from 'npm:jsdom@24.1.0';
const js = Deno.readTextFileSync(new URL('../clientes/sii-cartapra.js', import.meta.url));
let total = 0, fallas = 0;
const res = (n: string, ok: boolean) => { total++; console.log((ok ? 'OK   ' : 'MAL  ') + n); if (!ok) fallas++; };
function montar(resp: (b: any) => [number, any]) {
  const dom = new JSDOM('<!doctype html><body></body>', { runScripts: 'outside-only', url: 'https://gestoor.contadoor.cl/clientes/' });
  const w: any = dom.window; const llamadas: any[] = []; const toasts: string[] = [];
  w.toast = (m: string) => toasts.push(m);
  w.edgeFetch = (fn: string, b: any) => { llamadas.push(b); const [st, j] = resp(b); return Promise.resolve({ ok: st === 200, status: st, json: () => Promise.resolve(j) }); };
  w.eval(js); return { w, llamadas, toasts };
}
const CARTERA = { ok: true, cartera: { empresas: [{ empresa: { rut: '11.111.111-1', conexion: 'conectada' } }, { empresa: { rut: '22222222-K', conexion: 'clave_rechazada' } }] } };
{ // Master: una sola llamada a cartera, estados por RUT
  const { w, llamadas } = montar((b) => b.accion === 'cartera' ? [200, CARTERA] : [500, {}]);
  const r = await w.GestoorSII.prepararLista(5, true);
  res('master: puede conectar', r.puede === true);
  res('master: usa cartera sin cliente_id', llamadas.length === 1 && llamadas[0].accion === 'cartera' && !('cliente_id' in llamadas[0]));
  res('RUT con puntos → conectada', w.GestoorSII.estadoRut('11111111-1') === 'conectada');
  res('RUT con k minúscula → clave_rechazada', w.GestoorSII.estadoRut('22.222.222-k') === 'clave_rechazada');
  res('RUT ausente → no_conectada', w.GestoorSII.estadoRut('33333333-3') === 'no_conectada');
  await w.GestoorSII.prepararLista(5, true); res('segunda vez: sin nueva llamada', llamadas.length === 1);
}
{ // Master con cartera caída → respaldo por estado
  const { w, llamadas } = montar((b) => b.accion === 'cartera' ? [502, { ok: false }] : [200, { ok: true, puede_conectar: true, piloto: false }]);
  const r = await w.GestoorSII.prepararLista(7, true);
  res('cartera falla → estado → puede', r.puede === true && llamadas[1].accion === 'estado' && llamadas[1].cliente_id === 7);
  res('sin cartera: estadoRut null (botón neutro)', w.GestoorSII.estadoRut('1-9') === null);
}
{ // Conector (Benedicta)
  const { w } = montar((b) => [200, { ok: true, puede_conectar: true, piloto: false }]);
  res('conector: puede', (await w.GestoorSII.prepararLista(9, false)).puede === true);
}
{ // Analista sin permiso / piloto
  const a = montar(() => [403, { ok: false, error: 'SIN_PERMISO' }]);
  res('403 → sin botón', (await a.w.GestoorSII.prepararLista(9, false)).puede === false);
  const b = montar(() => [200, { ok: true, puede_conectar: true, piloto: true }]);
  res('piloto → sin botón', (await b.w.GestoorSII.prepararLista(9, false)).puede === false);
}
{ // Conectar: abre iframe de Cartapra; URL ajena se rechaza; error → aviso
  const { w, llamadas } = montar((b) => [200, { ok: true, widget: { url: 'https://app.cartapra.com/conecta/abc' } }]);
  let cerro = 0; const btn = w.document.createElement('button');
  w.GestoorSII.conectar(12, btn, () => cerro++); await new Promise((r) => setTimeout(r, 30));
  const fr = w.document.querySelector('.sii-velo iframe');
  res('ventana pedida para el cliente 12', llamadas[0].accion === 'ventana' && llamadas[0].cliente_id === 12);
  res('iframe de Cartapra abierto', !!fr && fr.src === 'https://app.cartapra.com/conecta/abc');
  (w.document.querySelector('.sii-velo .x') as any).click();
  res('al cerrar: modal fuera y lista se refresca', !w.document.querySelector('.sii-velo') && cerro === 1);
  const m2 = montar(() => [403, { ok: false, error: 'SIN_PERMISO', detalle: 'Solo el Master o un usuario autorizado.' }]);
  const b2 = m2.w.document.createElement('button'); m2.w.GestoorSII.conectar(3, b2); await new Promise((r) => setTimeout(r, 30));
  res('rechazo → aviso y botón habilitado', m2.toasts[0] === 'Solo el Master o un usuario autorizado.' && b2.disabled === false && !m2.w.document.querySelector('.sii-velo'));
}
console.log(`${total - fallas}/${total} pruebas OK`); if (fallas) Deno.exit(1);
