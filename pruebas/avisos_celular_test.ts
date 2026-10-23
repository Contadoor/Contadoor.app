// Avisos en el celular · prueba LOCAL de suscripción con mocks (no toca Supabase ni servicios push reales).
// 1) facturacion/index.html ofrece el botón "Activar avisos en este celular" y carga avisos-push.js fuera del modo demo.
// 2) avisos-push.js real en jsdom con Service Worker / PushManager / Notification simulados: activar → gestoor_push_suscribir (endpoint +
//    claves en base64url) → gestoor_push_probar; permiso denegado; iPhone sin instalar; dispositivo ya suscrito (re-sincroniza).
// Uso: deno run --allow-read --allow-env --allow-sys --allow-net=registry.npmjs.org pruebas/avisos_celular_test.ts
import { JSDOM } from 'npm:jsdom@24.1.0';
const RAIZ = new URL('../', import.meta.url);
const leer = (p: string) => Deno.readTextFileSync(new URL(p, RAIZ));
let ok = 0, mal = 0;
const res = (n: string, b: boolean, d: unknown = '') => { if (b) { ok++; console.log('OK  ', n); } else { mal++; console.log('MAL ', n, JSON.stringify(d)); } };
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

const fx = leer('facturacion/index.html');
res('1.1 Facturación tiene el botón #as-avisos y el aviso #as-aviso', /id="as-avisos"/.test(fx) && /id="as-aviso"/.test(fx) && /Activar avisos en este celular/.test(fx));
res('1.2 Facturación carga avisos-push.js solo fuera del modo demo (antes de auth.js)', /if\(!window\.FX_DEMO\)document\.write\('<script src="\.\.\/avisos-push\.js"><\\\/script>'\)/.test(fx)
    && fx.indexOf('avisos-push.js') < fx.indexOf('../auth.js'));

const JS = leer('avisos-push.js');
async function escenario(o: { permiso?: string; inicial?: string; ios?: boolean; standalone?: boolean; yaSuscrito?: boolean }) {
  const llamadas: { fn: string; body: Record<string, unknown> }[] = [];
  const dom = new JSDOM('<!doctype html><html><body><button id="as-avisos" hidden>x</button><div id="as-aviso"></div></body></html>', {
    runScripts: 'dangerously', url: 'https://gestoor.contadoor.cl/facturacion/', pretendToBeVisual: true,
    beforeParse(w: any) {
      Object.defineProperty(w.navigator, 'userAgent', { value: o.ios ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' : 'Mozilla/5.0 (Linux; Android 14)', configurable: true });
      if (o.standalone) Object.defineProperty(w.navigator, 'standalone', { value: true, configurable: true });
      w.matchMedia = () => ({ matches: false });
      const k1 = new Uint8Array(65).fill(7).buffer, k2 = new Uint8Array(16).fill(9).buffer;
      const sub = { endpoint: 'https://fcm.googleapis.com/fcm/send/prueba-' + 'x'.repeat(20), getKey: (n: string) => (n === 'p256dh' ? k1 : k2) };
      let actual: any = o.yaSuscrito ? sub : null;
      const reg = { pushManager: { getSubscription: () => Promise.resolve(actual), subscribe: () => { actual = sub; return Promise.resolve(sub); } } };
      Object.defineProperty(w.navigator, 'serviceWorker', { value: { register: () => Promise.resolve(reg), ready: Promise.resolve(reg) }, configurable: true });
      w.PushManager = function () {};
      let perm = o.inicial ?? 'default';
      w.Notification = { get permission() { return perm; }, requestPermission: () => { perm = o.permiso ?? 'granted'; return Promise.resolve(perm); } };
      w.alert = () => {};
      w._sbAuthReady = true;
      w.sbFetch = (path: string, opts: any) => { llamadas.push({ fn: path.replace('rpc/', ''), body: JSON.parse(opts && opts.body || '{}') });
        return Promise.resolve(new Response(JSON.stringify({ id: 1, activas: 1 }), { status: 200, headers: { 'Content-Type': 'application/json' } })); };
    } });
  const w: any = dom.window, d = w.document;
  const s = d.createElement('script'); s.textContent = JS; d.body.appendChild(s);
  await espera(80);
  const btn = d.getElementById('as-avisos');
  const r: any = { inicial: btn.textContent, oculto: btn.hidden };
  if (btn.dataset.estado === 'activar') { btn.click(); await espera(80); }
  r.final = btn.textContent; r.llamadas = llamadas; r.aviso = d.getElementById('as-aviso').textContent;
  dom.window.close(); return r;
}
let r = await escenario({});
res('2.1 botón visible: "🔔 Activar avisos en este celular"', r.inicial === '🔔 Activar avisos en este celular' && !r.oculto, r);
const s1 = r.llamadas.find((x: any) => x.fn === 'gestoor_push_suscribir');
res('2.2 activar → gestoor_push_suscribir con endpoint y claves base64url (sin "+", "/" ni "=")', !!s1 && s1.body.p_endpoint.startsWith('https://fcm.googleapis.com/')
    && /^[A-Za-z0-9_-]+$/.test(s1.body.p_p256dh) && /^[A-Za-z0-9_-]+$/.test(s1.body.p_auth), s1);
res('2.3 …luego gestoor_push_probar y el botón queda "Avisos activos · Probar"', r.llamadas.map((x: any) => x.fn).join() === 'gestoor_push_suscribir,gestoor_push_probar' && /Avisos activos/.test(r.final), r);
r = await escenario({ permiso: 'denied' });
res('2.4 el celular niega el permiso → "Avisos bloqueados" y no se guarda nada', /bloqueados/.test(r.final) && r.llamadas.length === 0, r);
r = await escenario({ ios: true });
res('2.5 iPhone sin instalar Gestoor → "Instala Gestoor para recibir avisos", sin llamadas', /Instala Gestoor/.test(r.inicial) && r.llamadas.length === 0, r);
r = await escenario({ inicial: 'granted', yaSuscrito: true });
res('2.6 dispositivo ya suscrito → se re-sincroniza solo (suscribir) y muestra "Avisos activos"', r.llamadas.map((x: any) => x.fn).join() === 'gestoor_push_suscribir' && /Avisos activos/.test(r.final), r);
console.log(`\nAvisos en el celular: ${ok}/${ok + mal}`);
Deno.exit(mal ? 1 : 0);
