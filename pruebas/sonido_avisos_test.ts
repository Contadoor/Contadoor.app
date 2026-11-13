// Sonido de avisos · prueba LOCAL en jsdom con sbFetch, Audio, caches y service worker simulados (no toca Supabase ni push reales).
// 1) notifications.js: la primera carga NO suena (solo marca la base); un aviso nuevo con Gestoor a la vista suena UNA vez; no suena
//    con la pestaña oculta ni silenciado; el botón del panel silencia/activa, copia la preferencia a Cache Storage y toca una muestra;
//    un push recibido con la página a la vista (mensaje de sw.js) suena una sola vez aunque la campana también lo detecte.
// 2) sw.js: con Gestoor a la vista el aviso va silent:true y avisa a la página; cerrado suena el del sistema (silent:false + vibrate);
//    silenciado → silent:true; con silent:true nunca envía `vibrate` (el navegador lo rechazaría).
// 3) El archivo assets/gestoor-aviso.mp3 existe, es MP3 y es corto.
// Uso: deno run --allow-read --allow-env --allow-sys --allow-net=registry.npmjs.org pruebas/sonido_avisos_test.ts
import { JSDOM } from 'npm:jsdom@24.1.0';
const RAIZ = new URL('../', import.meta.url);
const leer = (p: string) => Deno.readTextFileSync(new URL(p, RAIZ));
let ok = 0, mal = 0;
const res = (n: string, b: boolean, d: unknown = '') => { if (b) { ok++; console.log('OK  ', n); } else { mal++; console.log('MAL ', n, JSON.stringify(d)); } };
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── 1. notifications.js ──
const JS = leer('notifications.js');
const fila = (id: number, ts: string, leida = false) => ({ id, tipo: 'info', modulo: 'facturacion', prioridad: 'media', titulo: 'Aviso ' + id, descripcion: '', estado: 'pendiente',
  accion_url: null, created_at: ts, leida_at: leida ? ts : null, difusion: false });
async function montar(o: { visto?: string; silenciado?: boolean; oculto?: boolean } = {}) {
  let filas = [fila(1, '2026-11-04T12:00:00Z')];
  const cache: Record<string, string> = {};
  const listeners: ((e: any) => void)[] = [];
  const dom = new JSDOM('<!doctype html><html><head></head><body><div class="layout"><div class="topbar"><h1 class="tb-title">Inicio</h1></div></div></body></html>', {
    runScripts: 'dangerously', url: 'https://gestoor.contadoor.cl/index.html', pretendToBeVisual: true,
    beforeParse(w: any) {
      w._sbAuthReady = true;
      if (o.visto) w.localStorage.setItem('gestoor.sonido.visto', o.visto);
      if (o.silenciado) w.localStorage.setItem('gestoor.sonido', '0');
      if (o.oculto) Object.defineProperty(w.document, 'hidden', { get: () => true, configurable: true });
      w.sbFetch = (path: string) => {
        if (path === 'rpc/mis_alertas') return Promise.resolve(new Response(JSON.stringify(filas), { status: 200 }));
        return Promise.resolve(new Response('{}', { status: 404 }));
      };
      w.__sonidos = 0;
      w.Audio = function (src: string) { this.src = src; this.play = () => { w.__sonidos++; w.__src = src; return Promise.resolve(); }; };
      w.Response = Response;   // jsdom no trae Response (los navegadores sí)
      w.caches = { open: () => Promise.resolve({ put: (k: string, r: Response) => r.text().then((t) => { cache[k] = t; }) }) };
      Object.defineProperty(w.navigator, 'serviceWorker', { value: { addEventListener: (t: string, f: any) => { if (t === 'message') listeners.push(f); } }, configurable: true });
      w.toast = () => {};
    } });
  const w: any = dom.window, d = w.document;
  const s = d.createElement('script'); s.textContent = JS; d.body.appendChild(s);
  await espera(40);
  return { dom, w, d, cache, listeners, poner: (f: any[]) => { filas = f; } };
}

let m = await montar();
res('1.1 primera carga (sin base guardada): no suena y guarda la base', m.w.__sonidos === 0 && m.w.localStorage.getItem('gestoor.sonido.visto') === String(Date.parse('2026-11-04T12:00:00Z')));
res('1.2 copia la preferencia (activado = "1") a Cache Storage para sw.js', m.cache['/__gestoor/sonido'] === '1', m.cache);
m.poner([fila(1, '2026-11-04T12:00:00Z'), fila(2, '2026-11-04T12:05:00Z')]);
m.w.gestoorCampanaRecargar(); await espera(30);
res('1.3 llega un aviso nuevo con la página a la vista → suena una vez con assets/gestoor-aviso.mp3', m.w.__sonidos === 1 && /\/assets\/gestoor-aviso\.mp3$/.test(m.w.__src), m.w.__src);
m.w.gestoorCampanaRecargar(); await espera(30);
res('1.4 la misma lista otra vez → no vuelve a sonar', m.w.__sonidos === 1);
m.poner([fila(2, '2026-11-04T12:05:00Z', true), fila(3, '2026-11-04T12:06:00Z')]);
m.w.gestoorCampanaRecargar(); await espera(30);
res('1.5 otro aviso nuevo dentro de 5 s del anterior → no suena doble', m.w.__sonidos === 1);
m.listeners.forEach((f) => f({ data: { tipo: 'gestoor-aviso' } })); await espera(30);
res('1.6 push con la página a la vista dentro de 5 s → tampoco suena doble', m.w.__sonidos === 1);
// botón del panel
const btn = m.d.getElementById('notSonidoBtn');
res('1.7 el panel trae "🔊 Sonido de avisos: activado"', !!btn && btn.textContent === '🔊 Sonido de avisos: activado' && btn.getAttribute('aria-pressed') === 'true');
btn.click(); await espera(30);
res('1.8 tocar el botón → "🔇 silenciado", localStorage = "0" y Cache Storage = "0"', btn.textContent === '🔇 Sonido de avisos: silenciado' && m.w.localStorage.getItem('gestoor.sonido') === '0' && m.cache['/__gestoor/sonido'] === '0');
btn.click(); await espera(120);
res('1.9 volver a activarlo → "🔊 activado" y toca una muestra', btn.textContent === '🔊 Sonido de avisos: activado' && m.w.__sonidos === 2 && m.cache['/__gestoor/sonido'] === '1', m.w.__sonidos);
m.dom.window.close();

m = await montar({ visto: String(Date.parse('2026-11-04T11:00:00Z')) });
res('1.10 al abrir una página con un aviso posterior a la base → suena', m.w.__sonidos === 1);
m.dom.window.close();
m = await montar({ visto: String(Date.parse('2026-11-04T11:00:00Z')), silenciado: true });
res('1.11 silenciado → no suena (y la base avanza igual)', m.w.__sonidos === 0 && m.w.localStorage.getItem('gestoor.sonido.visto') === String(Date.parse('2026-11-04T12:00:00Z')) && m.cache['/__gestoor/sonido'] === '0');
m.listeners.forEach((f) => f({ data: { tipo: 'gestoor-aviso' } })); await espera(30);
res('1.12 silenciado + push con la página a la vista → no suena', m.w.__sonidos === 0);
m.dom.window.close();
m = await montar({ visto: String(Date.parse('2026-11-04T11:00:00Z')), oculto: true });
res('1.13 pestaña oculta → no suena', m.w.__sonidos === 0);
m.dom.window.close();

// ── 2. sw.js ──
const SW = leer('sw.js');
async function push(o: { visibles?: number; ocultos?: number; pref?: string | null }) {
  const h: Record<string, any> = {};
  const mensajes: any[] = [];
  let mostrada: any = null;
  const cli = (vis: string) => ({ url: 'https://gestoor.contadoor.cl/asistente/', visibilityState: vis, postMessage: (x: any) => mensajes.push(x) });
  const lista = [...Array(o.visibles || 0)].map(() => cli('visible')).concat([...Array(o.ocultos || 0)].map(() => cli('hidden')));
  const self: any = {
    location: { origin: 'https://gestoor.contadoor.cl' },
    addEventListener: (t: string, f: any) => { h[t] = f; },
    skipWaiting: () => {}, clients: { claim: () => Promise.resolve(), matchAll: () => Promise.resolve(lista) },
    registration: { showNotification: (t: string, op: any) => { mostrada = { t, op }; return Promise.resolve(); } },
  };
  const caches = { open: () => Promise.resolve({ match: () => Promise.resolve(o.pref == null ? undefined : new Response(o.pref)) }) };
  new Function('self', 'caches', SW)(self, caches);
  let p: Promise<unknown> = Promise.resolve();
  h.push({ data: { json: () => ({ titulo: 'Gestoor', cuerpo: 'Una persona necesita tu apoyo', url: '/asistente/?c=1' }) }, waitUntil: (x: Promise<unknown>) => { p = x; } });
  await p;
  return { mostrada, mensajes };
}
let r = await push({ ocultos: 1, pref: '1' });
res('2.1 Gestoor de fondo y sonido activado → silent:false + vibrate (suena el del sistema), sin mensaje a la página',
    r.mostrada?.op.silent === false && JSON.stringify(r.mostrada.op.vibrate) === '[120,60,120]' && r.mensajes.length === 0, r);
r = await push({ pref: null });
res('2.2 Gestoor cerrado y sin preferencia guardada → suena (activado por defecto)', r.mostrada?.op.silent === false);
r = await push({ visibles: 1, ocultos: 1, pref: '1' });
res('2.3 Gestoor a la vista → silent:true, sin vibrate, y avisa SOLO a la ventana visible', r.mostrada?.op.silent === true && !('vibrate' in r.mostrada.op)
    && r.mensajes.length === 1 && r.mensajes[0].tipo === 'gestoor-aviso', r);
r = await push({ ocultos: 1, pref: '0' });
res('2.4 silenciado → silent:true y sin vibrate', r.mostrada?.op.silent === true && !('vibrate' in r.mostrada.op));
res('2.5 el aviso conserva título, texto, enlace interno y tag', r.mostrada?.t === 'Gestoor' && r.mostrada.op.body === 'Una persona necesita tu apoyo' && r.mostrada.op.data.url === '/asistente/?c=1' && r.mostrada.op.tag === 'gestoor');

// ── 3. archivo de sonido ──
const mp3 = Deno.readFileSync(new URL('assets/gestoor-aviso.mp3', RAIZ));
const esMp3 = (mp3[0] === 0x49 && mp3[1] === 0x44 && mp3[2] === 0x33) || (mp3[0] === 0xff && (mp3[1] & 0xe0) === 0xe0);
res('3.1 assets/gestoor-aviso.mp3 existe, es MP3 y pesa menos de 20 KB', esMp3 && mp3.length > 1000 && mp3.length < 20000, mp3.length);

console.log(`\nSonido de avisos: ${ok}/${ok + mal}`);
if (mal) Deno.exit(1);
