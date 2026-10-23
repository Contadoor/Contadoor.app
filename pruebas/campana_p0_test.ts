// P0-Campana · prueba LOCAL en jsdom con sbFetch simulado (no toca Supabase).
// 1) La campana se carga en todas las páginas del menú (explícita en Facturación, Clientes y Planes; el menú la agrega en el resto).
// 2) notifications.js real: usa SOLO rpc/mis_alertas y rpc/alerta_marcar (sin acceso directo a la tabla), muestra TODOS los módulos
//    (desconocido = Sistema), normaliza los enlaces a rutas absolutas, escapa el HTML, marca leída / ejecutada, retira la V1 (localStorage)
//    y monta el botón "Activar avisos en este celular" dentro del panel.
// Uso: deno run --allow-read --allow-env --allow-sys --allow-net=registry.npmjs.org pruebas/campana_p0_test.ts
import { JSDOM } from 'npm:jsdom@24.1.0';
const RAIZ = new URL('../', import.meta.url);
const leer = (p: string) => Deno.readTextFileSync(new URL(p, RAIZ));
let ok = 0, mal = 0;
const res = (n: string, b: boolean, d: unknown = '') => { if (b) { ok++; console.log('OK  ', n); } else { mal++; console.log('MAL ', n, JSON.stringify(d)); } };
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── 1. Carga en las páginas ──
const fx = leer('facturacion/index.html'), cl = leer('clientes/index.html'), pl = leer('planes/index.html');
res('1.1 Facturación carga notifications.js (fuera del modo demo), después de supabase.js y antes de auth.js',
    /if\(!window\.FX_DEMO\)document\.write\('<script src="\.\.\/notifications\.js"><\\\/script>'\)/.test(fx) && fx.indexOf('notifications.js') > fx.indexOf('../supabase.js') && fx.indexOf('notifications.js') < fx.indexOf('../auth.js'));
res('1.2 Clientes y Planes cargan notifications.js antes de auth.js', [cl, pl].every((h) => h.indexOf('../notifications.js') > h.indexOf('../supabase.js') && h.indexOf('../notifications.js') < h.indexOf('../auth.js')));
const paginas: string[] = [];
for (const d of Deno.readDirSync(RAIZ)) {
  if (d.isFile && d.name.endsWith('.html')) paginas.push(d.name);
  if (d.isDirectory && !d.name.startsWith('.')) for (const f of Deno.readDirSync(new URL(d.name + '/', RAIZ))) if (f.isFile && f.name.endsWith('.html')) paginas.push(d.name + '/' + f.name);
}
const conMenu = paginas.filter((p) => /data-gestoor-activo=/.test(leer(p)));
const sinCampana = conMenu.filter((p) => { const h = leer(p); return !/notifications\.js/.test(h) && !/gestoor-menu\.js/.test(h); });
res(`1.3 las ${conMenu.length} páginas con menú tienen campana (notifications.js propio o gestoor-menu.js, que la agrega)`, conMenu.length > 10 && sinCampana.length === 0, sinCampana);
const MENU = leer('assets/gestoor-menu.js');
async function menuEn(url: string, demo = false, conScript = false) {
  const dom = new JSDOM(`<!doctype html><html><body><aside class="sidebar" data-gestoor-activo="clientes"></aside>${conScript ? '<script src="../notifications.js"></script>' : ''}</body></html>`, { url, runScripts: 'outside-only' });
  const w: any = dom.window; if (demo) w.FX_DEMO = true;
  w.eval(MENU); await espera(20);
  const tags = [...w.document.querySelectorAll('script')].map((s: any) => s.src).filter((s: string) => s.includes('notifications.js'));
  dom.window.close(); return tags;
}
let tags = await menuEn('https://gestoor.contadoor.cl/clientes/index.html');
res('1.4 el menú agrega /notifications.js cuando la página no la trae', tags.length === 1 && tags[0] === 'https://gestoor.contadoor.cl/notifications.js', tags);
res('1.5 …no la duplica si la página ya la trae, ni la carga en el modo demo de Facturación', (await menuEn('https://gestoor.contadoor.cl/clientes/index.html', false, true)).length === 1 && (await menuEn('http://localhost:8765/facturacion/index.html?demo=1', true)).length === 0);

// ── 2. notifications.js en jsdom ──
const JS = leer('notifications.js');
res('2.0 sin acceso directo a la tabla: no hay "alertas?" ni PATCH en notifications.js; usa rpc/mis_alertas y rpc/alerta_marcar',
    !/['"]alertas\?/.test(JS) && !/method\s*:\s*['"]PATCH/.test(JS) && /'mis_alertas'/.test(JS) && /'alerta_marcar'/.test(JS));
const ahora = new Date().toISOString();
const FILAS = () => [
  { id: 1, tipo: 'accion_requerida', modulo: 'facturacion', prioridad: 'alta', titulo: '📄 Factura FA-2026-10-0003 de Cliente Avisos SpA por $10.000 espera tu aprobación', descripcion: 'FA-2026-10-0003 (prueba) · motivo: ajuste', estado: 'pendiente', accion_url: '/facturacion/index.html?tab=adicional&fa=3', created_at: ahora, leida_at: null, difusion: false },
  { id: 2, tipo: 'reapertura', modulo: 'contable', prioridad: 'alta', titulo: 'Reporte reabierto', descripcion: 'corrige y valida', estado: 'pendiente', accion_url: '../reportes-contable/', created_at: ahora, difusion: false },
  { id: 3, tipo: 'info', modulo: 'seguridad', prioridad: 'alta', titulo: '🔒 Muchas claves vistas en una hora', descripcion: 'x', estado: 'pendiente', accion_url: 'javascript:alert(1)', created_at: ahora, difusion: true },
  { id: 4, tipo: 'info', modulo: 'modulo_nuevo', prioridad: 'media', titulo: '<img src=x onerror="window.__xss=1">', descripcion: '<b>hola</b>', estado: 'pendiente', accion_url: 'https://evil.cl/x', created_at: ahora, difusion: false },
  { id: 5, tipo: 'info', modulo: 'impuestos', prioridad: 'media', titulo: 'Cambio de IU', descripcion: 'x', estado: 'resuelta', accion_url: null, created_at: ahora, resuelta_por: 'T1 C', resuelta_at: ahora, difusion: false },
];
async function montar(o: { falla?: boolean; avisos?: boolean; dos?: boolean } = {}) {
  const llamadas: { fn: string; body: any }[] = [];
  const dom = new JSDOM('<!doctype html><html><head></head><body class="g-shell"><div class="layout"><div class="topbar"><h1 class="tb-title">Facturación</h1></div></div></body></html>', {
    runScripts: 'dangerously', url: 'https://gestoor.contadoor.cl/index.html', pretendToBeVisual: true,   // Inicio: sin filtro de módulo
    beforeParse(w: any) {
      w._sbAuthReady = true;
      w.localStorage.setItem('notificaciones_sistema', JSON.stringify([{ id: 9, modulo: 'rrhh', mensaje: 'V1 vieja', ejecutado: false }]));
      w.sbFetch = (path: string, opts: any) => {
        const fn = path.replace('rpc/', ''); const body = JSON.parse(opts && opts.body || '{}'); llamadas.push({ fn, body });
        if (fn === 'mis_alertas') return Promise.resolve(new Response(JSON.stringify(FILAS()), { status: 200, headers: { 'Content-Type': 'application/json' } }));
        if (fn === 'alerta_marcar') {
          if (o.falla) return Promise.resolve(new Response(JSON.stringify({ message: 'ALERTA_NO_DISPONIBLE' }), { status: 403 }));
          return Promise.resolve(new Response(JSON.stringify({ id: body.p_id, estado: 'resuelta', leida_at: ahora, resuelta_at: ahora, resuelta_por: 'T1 F' }), { status: 200 }));
        }
        return Promise.resolve(new Response('{}', { status: 404 }));
      };
      w.toast = (m: string) => { (w.__toasts = w.__toasts || []).push(m); };
      if (o.avisos) w.GestoorAvisosPush = { montar: (btn: any) => { w.__montado = btn && btn.id; btn.hidden = false; btn.textContent = '🔔 Activar avisos en este celular'; } };
    } });
  const w: any = dom.window, d = w.document;
  const s = d.createElement('script'); s.textContent = JS; d.body.appendChild(s);
  if (o.dos) { const s2 = d.createElement('script'); s2.textContent = JS; d.body.appendChild(s2); }
  await espera(50);
  return { dom, w, d, llamadas };
}
let { dom, w, d, llamadas } = await montar({ avisos: true });
res('2.1 al cargar pide rpc/mis_alertas (límite 100)', llamadas[0]?.fn === 'mis_alertas' && llamadas[0].body.p_limite === 100, llamadas);
res('2.2 insignia = 4 pendientes de TODOS los módulos (facturación, contable, seguridad y uno desconocido); la V1 de localStorage no cuenta', d.getElementById('notBadge').textContent === '4', d.getElementById('notBadge').textContent);
d.getElementById('notBtn').click(); await espera(30);
const panel = d.getElementById('notPanel');
const tabs = [...panel.querySelectorAll('.not-chip')].map((t: any) => t.textContent.replace(/\s+/g, ' ').trim());
res('2.3 pestañas por módulo con avisos: Facturación, Contable (contable/impuestos), Seguridad y Sistema (módulo desconocido); nada oculto',
    ['Facturación', 'Contable', 'Seguridad', 'Sistema'].every((m) => tabs.some((t) => t.startsWith(m))) && tabs[0].startsWith('Todos'), tabs);
const txt = panel.textContent;
res('2.4 títulos con emoji tal como vienen del servidor', txt.includes('📄 Factura FA-2026-10-0003 de Cliente Avisos SpA por $10.000 espera tu aprobación') && txt.includes('🔒 Muchas claves vistas en una hora'));
const hrefs = [...panel.querySelectorAll('a')].map((a: any) => a.getAttribute('href'));
res('2.5 enlaces normalizados: absoluto se conserva, "../reportes-contable/" → "/reportes-contable/", javascript: y https://otro se descartan',
    hrefs.includes('/facturacion/index.html?tab=adicional&fa=3') && hrefs.includes('/reportes-contable/') && !hrefs.some((h: string) => /javascript|evil/.test(h)), hrefs);
res('2.6 HTML del aviso escapado (sin XSS)', !w.__xss && !panel.querySelector('img') && txt.includes('<img src=x'));
const botones = [...panel.querySelectorAll('.not-card')].map((c: any) => c.querySelector('button')?.textContent);
res('2.7 acción requerida → "Marcar ejecutado"; informativa → "Marcar leída"', botones[0]?.includes('Marcar ejecutado') && botones[1]?.includes('Marcar ejecutado') && botones[2]?.includes('Marcar leída'), botones);
res('2.8 difusión marcada "Para el equipo"; historial con la ya resuelta', txt.includes('Para el equipo') && txt.includes('Historial reciente') && txt.includes('Marcada por T1 C'));
res('2.9 botón "Activar avisos en este celular" dentro del panel, montado con avisos-push (cualquier usuario)', w.__montado === 'notAvisosBtn' && !d.getElementById('notAvisosBtn').hidden && d.getElementById('notAvisosBtn').textContent.includes('Activar avisos en este celular'));
// Marcar leída una informativa
(panel.querySelectorAll('.not-card')[2].querySelector('button') as any).click(); await espera(30);
const mk = llamadas.find((x) => x.fn === 'alerta_marcar');
res('2.10 "Marcar leída" → rpc/alerta_marcar {p_id:3, p_accion:"leida"}; la insignia baja a 3', mk?.body.p_id === 3 && mk?.body.p_accion === 'leida' && d.getElementById('notBadge').textContent === '3', mk);
(d.getElementById('notPanel').querySelectorAll('.not-card')[0].querySelector('button') as any).click(); await espera(30);
const mk2 = llamadas.filter((x) => x.fn === 'alerta_marcar')[1];
res('2.11 "Marcar ejecutado" → p_accion "ejecutada"', mk2?.body.p_id === 1 && mk2?.body.p_accion === 'ejecutada', mk2);
const antes = llamadas.filter((x) => x.fn === 'alerta_marcar').length;
await w.marcarTodasEjecutadas(''); await espera(20);
const nuevas = llamadas.filter((x) => x.fn === 'alerta_marcar').slice(antes);
res('2.12 "Marcar informativas como leídas" solo toca las informativas pendientes (id 4), no las de acción requerida (id 2)', nuevas.length === 1 && nuevas[0].body.p_id === 4 && nuevas[0].body.p_accion === 'leida', nuevas);
w.crearNotificacion({ modulo: 'reportes', mensaje: 'Libro de compras cargado · 2026-10' });
res('2.13 V1 retirada: crearNotificacion muestra un aviso breve y no escribe en localStorage', w.__toasts?.includes('Libro de compras cargado · 2026-10') && JSON.parse(w.localStorage.getItem('notificaciones_sistema')).length === 1);
const ev = new w.KeyboardEvent('keydown', { key: 'Escape' }); d.dispatchEvent(ev); await espera(10);
res('2.14 Escape cierra el panel', !d.getElementById('notPanelWrap').classList.contains('on'));
dom.window.close();

({ dom, w, d, llamadas } = await montar({ falla: true }));
d.getElementById('notBtn').click(); await espera(30);
(d.getElementById('notPanel').querySelectorAll('.not-card')[2].querySelector('button') as any).click(); await espera(30);
res('2.15 si alerta_marcar falla: aviso de error y el aviso sigue pendiente (insignia 4)', (w.__toasts || []).some((t: string) => t.includes('No se pudo marcar')) && d.getElementById('notBadge').textContent === '4');
res('2.16 sin avisos-push cargado, el panel lo trae solo (script /avisos-push.js)', !!d.querySelector('script[data-gestoor-avisos-push]') && d.querySelector('script[data-gestoor-avisos-push]').src === 'https://gestoor.contadoor.cl/avisos-push.js');
dom.window.close();

({ dom, w, d } = await montar({ dos: true }));
res('2.17 cargada dos veces (página + menú) → una sola campana y un solo panel', d.querySelectorAll('#notBtn').length === 1 && d.querySelectorAll('#notPanelWrap').length === 1);
const norm = w.__gestoorCampanaNorm;
const casos: [string, string | null][] = [['/pagos/index.html?ob=5', '/pagos/index.html?ob=5'], ['../../reportes-contable/index.html', '/reportes-contable/index.html'], ['facturacion/', '/facturacion/'],
  ['//evil.cl/x', null], ['JAVASCRIPT:alert(1)', null], ['/x/../admin/', null], ['data:text/html,1', null], ['/sin-barra', null]];
const malNorm = casos.filter(([i, o]) => norm(i) !== o);
res('2.18 normEnlace: 8 casos (absolutos, relativos, //, javascript:, data:, ..)', malNorm.length === 0, malNorm.map(([i]) => [i, norm(i)]));
dom.window.close();

res('2.19 largos 120/300 sin recorte silencioso: título y texto de la tarjeta sin ellipsis/line-clamp; el historial lleva el texto completo en title',
    !/\.not-(tit|msg)\{[^}]*(text-overflow|line-clamp|nowrap)/.test(JS) && /<div title="'\+hesc\(n\.titulo\|\|n\.mensaje\)/.test(JS));

// ── 3. avisos-push.js expone montar() y sigue montando #as-avisos ──
const AP = leer('avisos-push.js');
res('3.1 avisos-push.js expone window.GestoorAvisosPush.montar y monta #as-avisos con el mismo código', /window\.GestoorAvisosPush = \{ montar: montar \}/.test(AP) && /montar\(document\.getElementById\('as-avisos'\)\)/.test(AP));

console.log(`\nP0-Campana: ${ok}/${ok + mal}`);
Deno.exit(mal ? 1 : 0);
