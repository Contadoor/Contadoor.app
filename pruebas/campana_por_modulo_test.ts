// Campana por módulo · prueba LOCAL en jsdom con sbFetch simulado (no toca Supabase). Solo visual: usa el campo modulo de mis_alertas.
// Chips por módulo con contador de NO leídas (solo los que tienen avisos), selección recordada en localStorage (con try/catch),
// grupos Hoy / Ayer / Anteriores, apertura filtrada en la página del módulo con "Ver todos", e ícono con color por módulo.
// Uso: deno run --allow-read --allow-env --allow-sys --allow-net=registry.npmjs.org pruebas/campana_por_modulo_test.ts
import { JSDOM } from 'npm:jsdom@24.1.0';
const RAIZ = new URL('../', import.meta.url);
const leer = (p: string) => Deno.readTextFileSync(new URL(p, RAIZ));
let ok = 0, mal = 0;
const res = (n: string, b: boolean, d: unknown = '') => { if (b) { ok++; console.log('OK  ', n); } else { mal++; console.log('MAL ', n, JSON.stringify(d)); } };
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
const JS = leer('notifications.js'), MENU = leer('assets/gestoor-menu.js');
const hace = (h: number) => new Date(Date.now() - h * 3600000).toISOString();
const ayer = () => { const d = new Date(); d.setDate(d.getDate() - 1); d.setHours(12, 0, 0, 0); return d.toISOString(); };
const FILAS = () => [
  { id: 1, tipo: 'accion_requerida', modulo: 'facturacion', prioridad: 'alta', titulo: '📄 Factura por aprobar', estado: 'pendiente', accion_url: '/facturacion/', created_at: hace(0.1), leida_at: null },
  { id: 2, tipo: 'info', modulo: 'facturacion', prioridad: 'media', titulo: '📄 Factura emitida', estado: 'pendiente', accion_url: '/facturacion/', created_at: ayer(), leida_at: null },
  { id: 3, tipo: 'accion_requerida', modulo: 'facturacion', prioridad: 'alta', titulo: '⚠️ Factura incierta', estado: 'pendiente', created_at: hace(24 * 5), leida_at: hace(24 * 4) },
  { id: 4, tipo: 'accion_requerida', modulo: 'cobranza', prioridad: 'alta', titulo: '💳 Cliente en riesgo', estado: 'pendiente', created_at: hace(1), leida_at: null },
  { id: 5, tipo: 'reapertura', modulo: 'contable', prioridad: 'alta', titulo: 'Reporte reabierto', estado: 'pendiente', created_at: hace(2), leida_at: null },
  { id: 6, tipo: 'info', modulo: 'pre-iva', prioridad: 'baja', titulo: '🧾 Pre-IVA validado', estado: 'pendiente', created_at: hace(3), leida_at: null },
  { id: 7, tipo: 'info', modulo: 'modulo_raro', prioridad: 'media', titulo: 'Aviso suelto', estado: 'pendiente', created_at: hace(4), leida_at: null },
  { id: 8, tipo: 'info', modulo: 'rrhh', prioridad: 'media', titulo: 'Cambio de IU', estado: 'resuelta', created_at: hace(30), resuelta_at: hace(29), resuelta_por: 'X' },
];
async function montar(url: string, o: { guardado?: string; storageRoto?: boolean; menu?: boolean } = {}) {
  const dom = new JSDOM('<!doctype html><html><head></head><body class="g-shell"><div class="layout"><div class="topbar"><h1 class="tb-title">X</h1></div></div></body></html>', {
    runScripts: 'dangerously', url, pretendToBeVisual: true,
    beforeParse(w: any) {
      w._sbAuthReady = true;
      if (o.storageRoto) Object.defineProperty(w, 'localStorage', { get() { throw new Error('SecurityError'); }, configurable: true });
      else if (o.guardado) w.localStorage.setItem('gestoor.campana.modulo', o.guardado);
      w.sbFetch = (path: string, opts: any) => {
        const fn = path.replace('rpc/', ''), b = JSON.parse(opts && opts.body || '{}');
        if (fn === 'mis_alertas') return Promise.resolve(new Response(JSON.stringify(FILAS()), { status: 200 }));
        return Promise.resolve(new Response(JSON.stringify({ id: b.p_id, estado: 'resuelta', leida_at: hace(0), resuelta_at: hace(0) }), { status: 200 }));
      };
      w.toast = () => {};
    } });
  const w: any = dom.window, d = w.document;
  if (o.menu) { const m = d.createElement('script'); m.textContent = MENU; d.head.appendChild(m); }
  const s = d.createElement('script'); s.textContent = JS; d.body.appendChild(s);
  await espera(40);
  d.getElementById('notBtn').click(); await espera(30);
  const panel = d.getElementById('notPanel');
  const chips = () => [...panel.querySelectorAll('.not-chip')].map((c: any) => c.textContent.replace(/\s+/g, ' ').trim());
  const titulos = () => [...panel.querySelectorAll('.not-card .not-tit')].map((t: any) => t.textContent);
  const fechas = () => [...panel.querySelectorAll('.not-fecha')].map((t: any) => t.textContent);
  return { dom, w, d, panel, chips, titulos, fechas };
}

// 1. Inicio (sin módulo de página)
let m = await montar('https://gestoor.contadoor.cl/index.html');
res('1.1 chips: Todos + solo módulos con avisos, en orden fijo (Facturación, Cobranza, Contable, Pre-IVA, RRHH, Sistema)',
    JSON.stringify(m.chips().map((c) => c.replace(/ \d+$/, ''))) === JSON.stringify(['Todos', 'Facturación', 'Cobranza', 'Contable', 'Pre-IVA', 'RRHH', 'Sistema']), m.chips());
res('1.2 contador = NO leídas: Todos 6, Facturación 2 (la incierta ya leída no cuenta), RRHH sin contador (solo historial)',
    m.chips()[0] === 'Todos 6' && m.chips()[1] === 'Facturación 2' && m.chips()[5] === 'RRHH', m.chips());
res('1.3 sin filtro en Inicio: muestra los 7 pendientes, sin barra "Ver todos"', m.titulos().length === 7 && !m.panel.querySelector('.not-filtro'));
res('1.4 grupos por fecha en orden: Hoy, Ayer, Anteriores', JSON.stringify(m.fechas()) === JSON.stringify(['Hoy', 'Ayer', 'Anteriores']), m.fechas());
(m.panel.querySelector('.not-chip[data-mod="cobranza"]') as any).click(); await espera(10);
res('1.5 elegir "Cobranza" filtra y se recuerda en localStorage', JSON.stringify(m.titulos()) === JSON.stringify(['💳 Cliente en riesgo']) && m.w.localStorage.getItem('gestoor.campana.modulo') === 'cobranza');
const chipOn = m.panel.querySelector('.not-chip.on') as any;
res('1.6 chip activo con el color del módulo (borde y texto #924893 de Cobranza)', /#924893|rgb\(146, 72, 147\)/.test(chipOn.getAttribute('style') || ''));
m.dom.window.close();
m = await montar('https://gestoor.contadoor.cl/index.html', { guardado: 'preiva' });
res('1.7 al volver a abrir, se respeta la selección guardada (Pre-IVA)', JSON.stringify(m.titulos()) === JSON.stringify(['🧾 Pre-IVA validado']));
m.dom.window.close();
m = await montar('https://gestoor.contadoor.cl/index.html', { guardado: 'agenda' });
res('1.8 selección guardada de un módulo sin avisos → cae a Todos', m.titulos().length === 7);
m.dom.window.close();
m = await montar('https://gestoor.contadoor.cl/index.html', { storageRoto: true });
(m.panel.querySelector('.not-chip[data-mod="impuestos"]') as any).click(); await espera(10);
res('1.9 localStorage bloqueado (modo privado) → la campana funciona igual (try/catch)', JSON.stringify(m.titulos()) === JSON.stringify(['Reporte reabierto']));
m.dom.window.close();

// 2. Página de un módulo
m = await montar('https://gestoor.contadoor.cl/facturacion/index.html', { guardado: 'cobranza' });
res('2.1 en Facturación la campana abre filtrada por Facturación (aunque lo guardado sea Cobranza), con "Ver todos"',
    JSON.stringify(m.titulos()) === JSON.stringify(['📄 Factura por aprobar', '📄 Factura emitida', '⚠️ Factura incierta']) && /Ver todos/.test(m.panel.querySelector('.not-filtro')?.textContent || ''), m.titulos());
res('2.2 …y agrupa Hoy / Ayer / Anteriores dentro del módulo', JSON.stringify(m.fechas()) === JSON.stringify(['Hoy', 'Ayer', 'Anteriores']));
(m.panel.querySelector('.not-filtro button') as any).click(); await espera(10);
res('2.3 "Ver todos" muestra los 7 y quita la barra de filtro', m.titulos().length === 7 && !m.panel.querySelector('.not-filtro'));
m.d.getElementById('notBtn').click(); await espera(5); m.d.getElementById('notBtn').click(); await espera(30);
res('2.4 al cerrar y volver a abrir en Facturación, vuelve a filtrar por Facturación', m.titulos().length === 3 && !!m.panel.querySelector('.not-filtro'));
m.dom.window.close();
const casos: [string, string][] = [['reportes-contable/index.html', 'Reporte reabierto'], ['pre-iva/cartera.html', '🧾 Pre-IVA validado'], ['cobranza/cartera.html', '💳 Cliente en riesgo']];
const malos: unknown[] = [];
for (const [ruta, t] of casos) { const x = await montar('https://gestoor.contadoor.cl/' + ruta); if (JSON.stringify(x.titulos()) !== JSON.stringify([t])) malos.push([ruta, x.titulos()]); x.dom.window.close(); }
res('2.5 Contable, Pre-IVA y Cobranza/Cartera abren filtradas por su módulo', malos.length === 0, malos);
m = await montar('https://gestoor.contadoor.cl/convenios/index.html');
res('2.6 página de un módulo SIN avisos (Convenios → Pagos) → abre en Todos, sin barra de filtro', m.titulos().length === 7 && !m.panel.querySelector('.not-filtro'));
m.dom.window.close();

// 3. Íconos con color
m = await montar('https://gestoor.contadoor.cl/index.html', { menu: true });
const ic = [...m.panel.querySelectorAll('.not-card .not-ic')] as any[];
res('3.1 con el menú: ícono de línea (svg) con color propio sobre placa con tinte (16 %)', ic.length === 7 && ic.every((x) => x.querySelector('svg')) && /rgba\(14, 143, 207, 0\.16\)|rgba\(14,143,207,0\.16\)/.test(ic[0].getAttribute('style')) && /color: ?#0E8FCF|rgb\(14, 143, 207\)/i.test(ic[0].getAttribute('style')), ic[0]?.getAttribute('style'));
const colores = new Set(ic.map((x) => x.style.color));
res('3.2 colores distintos por módulo (no todo morado)', colores.size >= 5, [...colores]);
m.dom.window.close();
m = await montar('https://gestoor.contadoor.cl/index.html');
res('3.3 sin el menú (páginas antiguas) → emoji en la misma placa de color', [...m.panel.querySelectorAll('.not-card .not-ic')].every((x: any) => !x.querySelector('svg') && x.textContent.trim().length > 0));
m.dom.window.close();
res('3.4 sin cambios de SQL: solo lee el campo modulo de mis_alertas', !/rpc\('(?!mis_alertas|alerta_marcar|gestoor_push)/.test(JS));

console.log(`\nCampana por módulo: ${ok}/${ok + mal}`);
Deno.exit(mal ? 1 : 0);
