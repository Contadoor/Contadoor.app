// AVISOS-CAMPANA (front) · prueba LOCAL en jsdom con sbFetch simulado (no toca Supabase).
// Campana «Por tipo» (grupos por evento y prioridad, insignia con el total real, marcar en grupo con RPC en lote y respaldo uno por uno),
// redirección de la vista antigua de prospectos, apertura de la ficha en Cobranza (?cliente=) y pantalla «Avisos al celular del equipo».
// Uso: deno run --allow-read --allow-env --allow-sys --allow-net=registry.npmjs.org pruebas/avisos_campana_test.ts
import { JSDOM } from 'npm:jsdom@24.1.0';
const RAIZ = new URL('../', import.meta.url);
const leer = (p: string) => Deno.readTextFileSync(new URL(p, RAIZ));
let ok = 0, mal = 0;
const res = (n: string, b: boolean, d: unknown = '') => { if (b) { ok++; console.log('OK  ', n); } else { mal++; console.log('MAL ', n, JSON.stringify(d)); } };
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
const JS = leer('notifications.js');
const hace = (h: number) => new Date(Date.now() - h * 3600000).toISOString();
const FILAS = () => [
  ...[1, 2, 3, 4, 5].map((i) => ({ id: i, tipo: 'accion_requerida', evento: 'com.sin_proximo_paso', modulo: 'comercial', prioridad: 'media', titulo: '⏳ Prospecto ' + i, estado: 'pendiente', created_at: hace(i), leida_at: null })),
  { id: 10, tipo: 'accion_requerida', evento: 'sii.carta_nueva', modulo: 'contable', prioridad: 'alta', titulo: '📬 Carta SII', estado: 'pendiente', created_at: hace(2), leida_at: null },
  { id: 11, tipo: 'info', evento: 'sii.historial_listo', modulo: 'contable', prioridad: 'media', titulo: '📥 Historial', estado: 'pendiente', created_at: hace(3), leida_at: null },
  { id: 12, tipo: 'info', evento: 'sii.historial_listo', modulo: 'contable', prioridad: 'media', titulo: '📥 Historial 2', estado: 'pendiente', created_at: hace(4), leida_at: hace(1) },
  { id: 20, tipo: 'info', evento: null, modulo: 'rrhh', prioridad: 'baja', titulo: 'Aviso suelto', estado: 'pendiente', created_at: hace(5), leida_at: null },
];
const RESUMEN = [{ modulo: 'contable', evento: 'sii.carta_nueva', tipo: 'accion_requerida', prioridad: 'alta', pendientes: 66, no_leidas: 66 },
  { modulo: 'comercial', evento: 'com.sin_proximo_paso', tipo: 'accion_requerida', prioridad: 'media', pendientes: 5, no_leidas: 5 },
  { modulo: 'contable', evento: 'sii.historial_listo', tipo: 'info', prioridad: 'media', pendientes: 2, no_leidas: 1 },
  { modulo: 'rrhh', evento: '(sin evento)', tipo: 'info', prioridad: 'baja', pendientes: 1, no_leidas: 1 }];

async function campana(o: { vista?: string; sinLote?: boolean; sinResumen?: boolean; confirmar?: boolean } = {}) {
  const llamadas: { fn: string; body: any }[] = [];
  const dom = new JSDOM('<!doctype html><html><head></head><body class="g-shell"><div class="layout"><div class="topbar"><h1 class="tb-title">X</h1></div></div></body></html>', {
    runScripts: 'dangerously', url: 'https://gestoor.contadoor.cl/panel-de-control/', pretendToBeVisual: true,
    beforeParse(w: any) {
      w._sbAuthReady = true;
      if (o.vista) w.localStorage.setItem('gestoor.campana.vista', o.vista);
      w.confirm = () => o.confirmar !== false;
      w.sbFetch = (path: string, opts: any) => {
        const fn = path.replace('rpc/', ''), b = JSON.parse(opts && opts.body || '{}'); llamadas.push({ fn, body: b });
        const r = (x: unknown, s = 200) => Promise.resolve(new Response(JSON.stringify(x), { status: s }));
        if (fn === 'mis_alertas') return r(FILAS());
        if (fn === 'mis_alertas_resumen') return o.sinResumen ? r({ message: 'Could not find the function public.mis_alertas_resumen' }, 404) : r(RESUMEN);
        if (fn === 'alerta_marcar_lote') return o.sinLote ? r({ code: 'PGRST202', message: 'Could not find the function public.alerta_marcar_lote' }, 404)
          : r({ marcadas: b.p_ids.length, alertas: b.p_ids.map((id: number) => ({ id, estado: 'resuelta', leida_at: hace(0), resuelta_at: hace(0) })) });
        return r({ id: b.p_id, estado: 'resuelta', leida_at: hace(0), resuelta_at: hace(0) });
      };
      w.toast = () => {};
    } });
  const w: any = dom.window, d = w.document;
  const s = d.createElement('script'); s.textContent = JS; d.body.appendChild(s);
  await espera(60);
  d.getElementById('notBtn').click(); await espera(40);
  const panel = d.getElementById('notPanel');
  return { w, d, panel, llamadas, badge: () => d.getElementById('notBadge').textContent };
}

// 1. Insignia con el total real (resumen) y vista por fecha intacta por defecto
{
  const c = await campana();
  res('1.1 insignia = total del resumen (74), no solo los 9 cargados', c.badge() === '74', c.badge());
  res('1.2 por defecto sigue la vista «Por fecha» (Hoy/Ayer/Anteriores)', c.panel.querySelectorAll('.not-fecha').length > 0 && !c.panel.querySelector('.not-grupo'));
  res('1.3 pide mis_alertas con límite 200 y luego el resumen', c.llamadas[0].fn === 'mis_alertas' && c.llamadas[0].body.p_limite === 200 && c.llamadas.some((x) => x.fn === 'mis_alertas_resumen'));
  const b = [...c.panel.querySelectorAll('.not-seg')].find((x: any) => /Por tipo/.test(x.textContent)) as any; b.click(); await espera(20);
  res('1.4 «Por tipo» se recuerda en el dispositivo', c.w.localStorage.getItem('gestoor.campana.vista') === 'tipo' && c.panel.querySelectorAll('.not-grupo').length === 4);
}
// 2. Vista por tipo: orden por prioridad, etiquetas, contador «de N», tarjetas plegadas
{
  const c = await campana({ vista: 'tipo' });
  const g = [...c.panel.querySelectorAll('.not-grupo')].map((x: any) => x.getAttribute('data-grupo'));
  res('2.1 grupos ordenados: alta primero, luego por cantidad', g.join() === 'sii.carta_nueva,com.sin_proximo_paso,sii.historial_listo,mod:rrhh:info', g);
  const carta = c.panel.querySelector('[data-grupo="sii.carta_nueva"]');
  res('2.2 etiqueta legible y «1 de 66» (el total real del resumen)', /Cartas nuevas del SII/.test(carta.textContent) && /1 de 66/.test(carta.textContent) && /Alta/.test(carta.textContent), carta.textContent);
  res('2.3 grupos plegados: sin tarjetas hasta «Ver»', c.panel.querySelectorAll('.not-card').length === 0);
  (c.panel.querySelector('[data-grupo="com.sin_proximo_paso"] .not-b') as any).click(); await espera(20);
  res('2.4 «Ver 5» despliega las 5 tarjetas del grupo', c.panel.querySelectorAll('[data-grupo="com.sin_proximo_paso"] .not-card').length === 5);
  res('2.5 grupo sin evento usa el título como etiqueta', /Aviso suelto/.test(c.panel.querySelector('[data-grupo="mod:rrhh:info"]').textContent));
}
// 3. Marcar en grupo con la RPC en lote
{
  const c = await campana({ vista: 'tipo' });
  const btn = [...c.panel.querySelectorAll('[data-grupo="sii.historial_listo"] .not-b')].find((x: any) => /leída/.test(x.textContent)) as any;
  btn.click(); await espera(60);
  const l = c.llamadas.find((x) => x.fn === 'alerta_marcar_lote');
  res('3.1 «Marcar 2 leídas» → alerta_marcar_lote([11,12], leida)', !!l && JSON.stringify(l.body.p_ids) === '[11,12]' && l.body.p_accion === 'leida', l);
  const btn2 = [...c.panel.querySelectorAll('[data-grupo="com.sin_proximo_paso"] .not-b')].find((x: any) => /ejecutada/.test(x.textContent)) as any;
  btn2.click(); await espera(60);
  const l2 = c.llamadas.filter((x) => x.fn === 'alerta_marcar_lote')[1];
  res('3.2 «Marcar 5 ejecutadas» (con confirmación) → lote de acción', !!l2 && l2.body.p_ids.length === 5 && l2.body.p_accion === 'ejecutada', l2);
}
{
  const c = await campana({ vista: 'tipo', confirmar: false });
  const btn2 = [...c.panel.querySelectorAll('[data-grupo="com.sin_proximo_paso"] .not-b')].find((x: any) => /ejecutada/.test(x.textContent)) as any;
  btn2.click(); await espera(40);
  res('3.3 si no confirma, no marca nada', !c.llamadas.some((x) => x.fn === 'alerta_marcar_lote' || x.fn === 'alerta_marcar'));
}
{
  const c = await campana({ vista: 'tipo', sinLote: true, sinResumen: true });
  res('3.4 sin resumen instalado: insignia = cargados (9) y la campana sigue', c.badge() === '9' && c.panel.querySelectorAll('.not-grupo').length === 4, c.badge());
  const btn = [...c.panel.querySelectorAll('[data-grupo="sii.historial_listo"] .not-b')].find((x: any) => /leída/.test(x.textContent)) as any;
  btn.click(); await espera(80);
  res('3.5 sin alerta_marcar_lote instalada: respaldo uno por uno con alerta_marcar', c.llamadas.filter((x) => x.fn === 'alerta_marcar').map((x) => x.body.p_id).sort().join() === '11,12');
}
// 4. Prospectos: la vista antigua redirige a la ficha del CRM
{
  const html = leer('prospectos/index.html');
  const m = /<script>\n\/\* AVISOS-CAMPANA[\s\S]*?<\/script>/.exec(html);
  const prob = (url: string) => { const reemplazos: string[] = []; const loc = { search: new URL(url).search, replace: (u: string) => reemplazos.push(u) };
    new Function('location', 'URLSearchParams', m![0].replace(/<\/?script>/g, ''))(loc, URLSearchParams); return reemplazos; };
  res('4.1 index.html?id=42 → crm.html?lead=42', JSON.stringify(prob('https://g.test/prospectos/index.html?id=42')) === '["crm.html?lead=42"]');
  res('4.2 sin id o id raro: no redirige', prob('https://g.test/prospectos/index.html').length === 0 && prob('https://g.test/prospectos/index.html?id=1;alert(1)').length === 0);
  res('4.3 la redirección va en el head, antes de cargar el módulo', html.indexOf('AVISOS-CAMPANA') < html.indexOf('</head>'));
}
// 5. Cobranza: ?cliente=<id> abre la ficha una sola vez y solo con dígitos
{
  const js = leer('cobranza/cartera.js');
  res('5.1 cartera.js lee ?cliente= (solo dígitos) y abre la ficha tras cargar', /get\('cliente'\);return v&&\/\^\[0-9\]\{1,18\}\$\/\.test\(v\)/.test(js) && /render\(\);abrirPedido\(\);/.test(js)
    && /CLIENTE_PEDIDO=null;abrirFicha\(id\)/.test(js));
}
// 6. Avisos al celular del equipo (solo Master)
async function pagina(url: string, ses: any) {
  const html = leer('admin/avisos-equipo.html').replace(/<script src="[^"]*"><\/script>/g, '').replace(/<script>if\(!window\.AVE_DEMO\)[^\n]*\n/g, '');
  const dom = new JSDOM(html, { runScripts: 'dangerously', url, pretendToBeVisual: true, beforeParse(w: any) { w._contadoorSesion = ses; } });
  const w: any = dom.window, d = w.document;
  const s = d.createElement('script'); s.textContent = leer('admin/avisos-equipo.js'); d.body.appendChild(s);
  d.documentElement.classList.remove('auth-pending');
  await espera(60);
  return { w, d };
}
{
  const p = await pagina('http://localhost:8765/admin/avisos-equipo.html?demo=1', null);
  const filas = [...p.d.querySelectorAll('#aveTabla tbody tr')].map((x: any) => x.textContent);
  res('6.1 demo local: tabla con quién tiene y quién no tiene avisos', filas.length === 3 && /Sin activar/.test(filas[0]) && /Sin cuenta de acceso/.test(filas[1]) && /Activo en 2/.test(filas[2]), filas);
  res('6.2 KPI: 1 con avisos, 2 sin avisos', /1conavisosactivos2sinavisos/.test(p.d.getElementById('aveKpis').textContent.replace(/\s+/g, '')), p.d.getElementById('aveKpis').textContent);
  res('6.3 nunca muestra endpoints', !/endpoint|https:\/\/push/i.test(p.d.getElementById('aveMain').innerHTML));
}
{
  const p = await pagina('https://gestoor.contadoor.cl/admin/avisos-equipo.html?demo=1', { esMaster: false });
  res('6.4 en el sitio real ?demo=1 no activa la demo; sin Master → aviso «Solo el Master»', !p.d.getElementById('aveNoMaster').hidden && p.d.getElementById('aveMain').hidden);
}
{
  const admin = leer('admin/index.html');
  res('6.5 Admin: enlace visible solo para el Master', /id="lnkAvisosEquipo"[^>]*display:none/.test(admin) && /lnkAvisosEquipo'\); if\(la\) la\.style\.display=\(sesB&&sesB\.esMaster===true\)/.test(admin));
}
console.log(`\nAVISOS-CAMPANA (front): ${ok}/${ok + mal}`);
Deno.exit(mal ? 1 : 0);   // jsdom deja el setInterval de la campana vivo: salir explícito
