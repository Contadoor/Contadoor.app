// COBTE-NOMBRES · prueba LOCAL con mocks (jsdom; no toca Supabase ni producción; datos 100 % ficticios).
// 1) auth.js: en /cobranza/ y /trabajos-especiales/ el acceso a la página lo decide el servidor (cobranza_yo / te_yo → puede_leer, que leen
//    usuarios_sistema.modulos), no public.usuarios.modulos. Las demás páginas siguen igual.
// 2) Cobranza: el gestor ve razón social y RUT de toda la cartera vía cobte_cartera_nombres; sin la función, vuelve a "Cliente N.º".
//    Pagos no llama a la función (la RLS de clientes ya le muestra los nombres).
// 3) Trabajos especiales: los responsables salen con su nombre vía cobte_te_responsables; sin la función, "Responsable N.º x".
// Uso: deno run --allow-read --allow-env --allow-sys --allow-net=registry.npmjs.org pruebas/cobte_nombres_test.ts
import { JSDOM } from 'npm:jsdom@24.1.0';

const RAIZ = new URL('../', import.meta.url);
const leer = (p: string) => Deno.readTextFileSync(new URL(p, RAIZ));
const authJs = leer('auth.js'), gcJs = leer('assets/gestoor-cartera.js'), carteraJs = leer('cobranza/cartera.js'), teJs = leer('trabajos-especiales/te.js');
const espera = (ms = 60) => new Promise((r) => setTimeout(r, ms));
let total = 0, fallas = 0;
const res = (n: string, ok: boolean, det = '') => { total++; console.log((ok ? 'OK   ' : 'MAL  ') + n + (ok || !det ? '' : ' · ' + det)); if (!ok) fallas++; };
const sinScript = (s: string) => s.replace(/<\/script>/g, '<\\/script>');

// ═══ 1 · auth.js ═══
async function paginaAuth(ruta: string, perfil: Record<string, unknown>, rpc: (fn: string) => { data?: unknown; error?: unknown } | 'throw') {
  const mock = `<script>
    window._llamadasRpc = [];
    window._sbAuthReady = true;
    window._sbAuthClient = {
      auth: { getUser: function(){ return Promise.resolve({ data: { user: { id: 'u-ficticio', email: 'ficticio@ejemplo.test' } }, error: null }); },
              signOut: function(){ return Promise.resolve(); } },
      from: function(){ return { select: function(){ return { eq: function(){ return { single: function(){ return Promise.resolve({ data: ${JSON.stringify(perfil)}, error: null }); } }; } }; } }; },
      rpc: function(fn){ window._llamadasRpc.push(fn); var r = window._rpcResp(fn); if (r === 'throw') return Promise.reject(new Error('red')); return Promise.resolve(r); }
    };
  </script>`;
  const html = `<!doctype html><html lang="es" class="auth-pending"><head></head><body><div class="sidebar"></div><main id="contenido">Contenido de la página</main>${mock}</body></html>`;
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://gestoor.ejemplo.test' + ruta });
  const w = dom.window as unknown as Record<string, any>;
  w._rpcResp = rpc;
  // (jsdom no navega: una redirección al login solo dejaría la página oculta)
  const s = w.document.createElement('script'); s.textContent = authJs; w.document.body.appendChild(s);
  await espera(80);
  const d = w.document as Document;
  return { rpcs: w._llamadasRpc as string[], denegado: !!d.querySelector('h2') && (d.querySelector('h2')!.textContent || '').includes('Acceso denegado'), revelado: !d.documentElement.classList.contains('auth-pending'), dom };
}
const perfil = (rol: string, modulos: string[], es_master = false) => ({ id: 9, nombre: 'Persona Ficticia', iniciales: 'PF', rol, rol_label: rol, es_master, activo: true, modulos, wa: '', email: 'ficticio@ejemplo.test' });

{
  // Caso tipo Leandro: usuarios.modulos SIN 'cobranza', pero el servidor (usuarios_sistema) lo reconoce → entra.
  const r = await paginaAuth('/cobranza/cartera.html', perfil('contable', ['conciliacion', 'facturacion']), (fn) => fn === 'cobranza_yo' ? { data: { puede_leer: true }, error: null } : { data: null, error: { message: 'x' } });
  res('A1 Cobranza: servidor puede_leer=true y usuarios.modulos sin cobranza → la página se abre (decide el servidor)', r.revelado && !r.denegado && r.rpcs.includes('cobranza_yo'), JSON.stringify(r));
}
{
  // Caso legado: usuarios.modulos CON 'cobranza' pero el servidor dice que no → Acceso denegado (antes se abría y fallaba cada consulta).
  const r = await paginaAuth('/cobranza/cartera.html', perfil('admin', ['cobranza']), () => ({ data: { puede_leer: false }, error: null }));
  res('A2 Cobranza: usuarios.modulos con cobranza pero servidor puede_leer=false → Acceso denegado', r.denegado, JSON.stringify(r.rpcs));
}
{
  const r = await paginaAuth('/cobranza/cartera.html', perfil('contable', ['cobranza']), () => ({ data: null, error: { message: 'SIN_SESION' } }));
  res('A3 Cobranza: error del servidor (sin fila operativa) → Acceso denegado (fail-closed)', r.denegado);
}
{
  const r = await paginaAuth('/cobranza/cartera.html', perfil('contable', ['cobranza']), () => 'throw');
  res('A4 Cobranza: falla de red al consultar el servidor → Acceso denegado (fail-closed)', r.denegado);
}
{
  const r = await paginaAuth('/trabajos-especiales/', perfil('comercial', []), (fn) => fn === 'te_yo' ? { data: { puede_leer: true }, error: null } : { data: null, error: {} });
  res('A5 Trabajos especiales: servidor te_yo.puede_leer=true (Miguel con módulo solo en usuarios_sistema) → se abre', r.revelado && !r.denegado && r.rpcs.includes('te_yo'), JSON.stringify(r.rpcs));
}
{
  const r = await paginaAuth('/trabajos-especiales/', perfil('contable', ['trabajos_especiales']), () => ({ data: { puede_leer: false }, error: null }));
  res('A6 Trabajos especiales: servidor puede_leer=false → Acceso denegado aunque usuarios.modulos lo tenga', r.denegado);
}
{
  const r = await paginaAuth('/pagos/', perfil('pagos', []), () => ({ data: null, error: {} }));
  res('A7 Otras páginas (Pagos) no cambian: decide puedeVerModulo y no se llama a ninguna RPC', r.revelado && !r.denegado && r.rpcs.length === 0, JSON.stringify(r.rpcs));
  const r2 = await paginaAuth('/pagos/', perfil('contable', []), () => ({ data: null, error: {} }));
  res('A8 Otras páginas: contable sin módulo pagos sigue con Acceso denegado', r2.denegado && r2.rpcs.length === 0);
}

// ═══ 2 · Cobranza: nombres de la cartera ═══
type Resp = Record<string, unknown>;
async function paginaCobranza(yo: Resp, clientesRls: unknown[], cartera: unknown[] | 'error') {
  const llamadas: string[] = [];
  const mock = `<script>
    window._llamadas = [];
    function _r(o, st){ st = st || 200; return Promise.resolve({ ok: st < 400, status: st, json: function(){ return Promise.resolve(o); }, text: function(){ return Promise.resolve(JSON.stringify(o)); } }); }
    function sbFetch(path){
      window._llamadas.push(path);
      if (path === 'rpc/cobranza_yo') return _r(${JSON.stringify({ modo: 'PRUEBA', prueba_hasta: '2026-12-31', arranque_fecha: '2026-10-01', ...yo })});
      if (path === 'rpc/cobte_cartera_nombres') return ${cartera === 'error' ? `_r({ code: 'PGRST202', message: 'Could not find the function public.cobte_cartera_nombres' }, 404)` : `_r(${JSON.stringify(cartera)})`};
      if (path.indexOf('cobranza_clientes?') === 0) return _r([{ cliente_id: 501, estado: 'VENCIDO', estado_desde: '2026-10-01' }, { cliente_id: 502, estado: 'RIESGO', estado_desde: '2026-10-01' }]);
      if (path.indexOf('clientes?') === 0) return _r(${JSON.stringify(clientesRls)});
      if (path.indexOf('rpc/') === 0) return _r(null);
      return _r([]);
    }
  </script>`;
  let html = leer('cobranza/cartera.html');
  html = html.replace(/<script src="\.\.\/supabase\.js"><\/script>/, () => mock)
    .replace(/<script src="\.\.\/assets\/gestoor-cartera\.js"><\/script>/, () => '<script>' + sinScript(gcJs) + '</script>')
    .replace(/<script src="cartera\.js"><\/script>/, () => '<script>' + sinScript(carteraJs) + '</script>')
    .replace(/<script>if\(window\.GC_DEMO\)document\.write[^\n]*<\/script>/g, '').replace(/<script>if\(!window\.GC_DEMO\)document\.write[^\n]*<\/script>/g, '')
    .replace(/<script src="\.\.\/assets\/gestoor-menu\.js"><\/script>/, '');
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://gestoor.ejemplo.test/cobranza/cartera.html', pretendToBeVisual: true });
  const w = dom.window as unknown as Record<string, any>;
  await espera(150);
  llamadas.push(...(w._llamadas as string[]));
  w.document.querySelectorAll('script').forEach((x: any) => x.remove());
  return { texto: (w.document.body.textContent || '') as string, llamadas };
}
const CARTERA = [{ cliente_id: 501, razon_social: 'Panadería Ficticia Uno SpA', rut: '76111111-6' }, { cliente_id: 502, razon_social: 'Taller Ficticio Dos Ltda', rut: '76222222-1' }];
{
  const r = await paginaCobranza({ puede_leer: true, puede_gestionar: true, puede_registrar_pagos: true, puede_decidir: false, es_master: false, rol: 'contable' }, [], CARTERA);
  res('B1 Gestor (Leandro): llama a cobte_cartera_nombres', r.llamadas.includes('rpc/cobte_cartera_nombres'), r.llamadas.join(' | '));
  res('B2 Gestor: ve razón social de toda la cartera aunque la RLS de clientes no le muestre ninguno', r.texto.includes('Panadería Ficticia Uno SpA') && r.texto.includes('Taller Ficticio Dos Ltda'), r.texto.replace(/\s+/g, ' ').slice(0, 1500));
  res('B3 Gestor: ve el RUT bajo el nombre y ya no aparece "Cliente N.º"', r.texto.includes('RUT 76111111-6') && !r.texto.includes('Cliente N.º'));
}
{
  const r = await paginaCobranza({ puede_leer: true, puede_gestionar: true, puede_registrar_pagos: true, es_master: false, rol: 'contable' }, [{ id: 501, razon_social: 'Panadería Ficticia Uno SpA', rut: '76111111-6' }], 'error');
  res('B4 Función aún no instalada (404): la pantalla no se cae; muestra lo visible por RLS y "Cliente N.º" para el resto', r.texto.includes('Panadería Ficticia Uno SpA') && r.texto.includes('Cliente N.º 502'), r.texto.slice(0, 400));
}
{
  const r = await paginaCobranza({ puede_leer: true, puede_gestionar: false, puede_registrar_pagos: true, es_master: false, rol: 'pagos' }, [{ id: 501, razon_social: 'Panadería Ficticia Uno SpA', rut: '76111111-6' }, { id: 502, razon_social: 'Taller Ficticio Dos Ltda', rut: '76222222-1' }], CARTERA);
  res('B5 Pagos: NO llama a cobte_cartera_nombres (no es gestor) y ve los nombres por la RLS de clientes', !r.llamadas.includes('rpc/cobte_cartera_nombres') && r.texto.includes('Taller Ficticio Dos Ltda'), r.llamadas.join(' | '));
}

// ═══ 3 · Trabajos especiales: nombres de responsables ═══
async function paginaTE(resp: unknown[] | 'error') {
  const fila = (id: number, cod: string, r: number) => ({ id, codigo: cod, cliente_id: null, cliente_nombre: 'Prospecto Ficticio ' + id, es_prospecto: true, servicio_id: null, servicio_nombre: 'Constitución ficticia',
    responsable_usuario_id: r, etapa: 'BORRADOR', etapa_desde: '2026-10-20T12:00:00Z', estatus: 'NORMAL', condicion_pago: 'CONTADO', n_cuotas: 1, valor: null, valor_catalogo: 150000,
    avance: 0, saldo: 0, cuotas_vencidas: 0 });
  const mock = `<script>
    window._llamadas = [];
    function _r(o, st){ st = st || 200; return Promise.resolve({ ok: st < 400, status: st, json: function(){ return Promise.resolve(o); }, text: function(){ return Promise.resolve(JSON.stringify(o)); } }); }
    function sbFetch(path){
      window._llamadas.push(path);
      if (path === 'rpc/te_yo') return _r({ usuario_id: 1, nombre: 'Master Ficticio', es_master: true, responsable: true, facturador: false, pagos: true, puede_leer: true });
      if (path === 'rpc/cobte_te_responsables') return ${resp === 'error' ? `_r({ code: 'PGRST202', message: 'Could not find the function' }, 404)` : `_r(${JSON.stringify(resp)})`};
      if (path.indexOf('te_v_tablero?') === 0) return _r(${JSON.stringify([fila(11, 'TE-2026-011', 21), fila(12, 'TE-2026-012', 22)])});
      if (path.indexOf('te_parametros?') === 0) return _r([{ modo_factura: 'PRUEBA', produccion_habilitada: false, avisos_habilitados: false, avisos_modo: 'PRUEBA', vigencia_cotizacion_dias: 15, responsable_ve_todos: false }]);
      return _r([]);
    }
  </script>`;
  let html = leer('trabajos-especiales/index.html');
  html = html.replace(/<script src="\.\.\/supabase\.js"><\/script>/, () => mock)
    .replace(/<script src="\.\.\/assets\/gestoor-cartera\.js"><\/script>/, () => '<script>' + sinScript(gcJs) + '</script>')
    .replace(/<script src="te\.js"><\/script>/, () => '<script>' + sinScript(teJs) + '</script>')
    .replace(/<script>if\(window\.GC_DEMO\)document\.write[^\n]*<\/script>/g, '').replace(/<script>if\(!window\.GC_DEMO\)document\.write[^\n]*<\/script>/g, '')
    .replace(/<script src="\.\.\/assets\/gestoor-menu\.js"><\/script>/, '');
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://gestoor.ejemplo.test/trabajos-especiales/', pretendToBeVisual: true });
  const w = dom.window as unknown as Record<string, any>;
  await espera(150);
  w.document.querySelectorAll('script').forEach((x: any) => x.remove());
  return { texto: (w.document.body.textContent || '') as string, llamadas: w._llamadas as string[] };
}
{
  const r = await paginaTE([{ usuario_id: 21, nombre: 'Responsable Ficticio Uno' }, { usuario_id: 22, nombre: 'Responsable Ficticia Dos' }]);
  res('C1 TE: llama a cobte_te_responsables y muestra el nombre de cada responsable', r.llamadas.includes('rpc/cobte_te_responsables') && r.texto.includes('Responsable Ficticio Uno') && r.texto.includes('Responsable Ficticia Dos'), r.texto.slice(0, 400));
  res('C2 TE: ya no aparece "Responsable N.º"', !r.texto.includes('Responsable N.º'));
}
{
  const r = await paginaTE('error');
  res('C3 TE sin la función (404): el tablero carga igual con "Responsable N.º x"', r.texto.includes('Responsable N.º 21') && r.texto.includes('TE-2026-011'), r.texto.slice(0, 400));
}

console.log(`\n${total - fallas}/${total} OK`);
if (fallas) Deno.exit(1);
