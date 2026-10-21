// Administración · casilla Facturación · prueba LOCAL con mocks (no toca Supabase ni producción).
// Carga admin/index.html en jsdom, reemplaza supabase.js / auth.js / menú por mocks y simula al Master editando fichas ficticias
// cuya public.usuarios.modulos trae 'facturacion' antiguo (sin habilitar en usuarios_sistema).
// Verifica: la casilla nunca se pre-marca desde usuarios.modulos; guardar sin tocarla NO envía 'facturacion';
// habilitarla pide confirmación "Vas a habilitar Facturación para <nombre>" y cancelar no envía nada.
// Uso: deno run --allow-read --allow-env --allow-sys --allow-net=registry.npmjs.org pruebas/admin_facturacion_casilla_test.ts
import { JSDOM } from 'npm:jsdom@24.1.0';

const RAIZ = new URL('../', import.meta.url);
const html0 = Deno.readTextFileSync(new URL('admin/index.html', RAIZ));
const authJs = Deno.readTextFileSync(new URL('auth.js', RAIZ));
const mpr = authJs.match(/var MODULOS_POR_ROL=(\{[\s\S]*?\});/)![1];

// Fichas FICTICIAS (los nombres reales nunca van en el código)
const USUARIOS = [
  { id: 1, nombre: 'Master Ficticio', iniciales: 'MF', rol: 'master', rol_label: 'Master', es_master: true, activo: true, modulos: [], wa: null, email: 'master@ejemplo.test', auth_user_id: 'u1' },
  { id: 2, nombre: 'Admin Ficticio', iniciales: 'AF', rol: 'admin', rol_label: 'Admin / Supervisor', es_master: false, activo: true,
    modulos: ['clientes', 'planes', 'panel-de-control', 'reportes-rrhh', 'gestion-personal', 'reportes-contable', 'reportes-pagos', 'convenios', 'pir', 'pre-iva', 'pagos', 'conciliacion', 'cobranza', 'facturacion'],
    wa: null, email: 'admin@ejemplo.test', auth_user_id: 'u2' },
  { id: 3, nombre: 'Contable Ficticia', iniciales: 'CF', rol: 'contable', rol_label: 'Asesor(a) Contable', es_master: false, activo: true,
    modulos: ['clientes', 'panel-de-control', 'reportes-contable', 'convenios', 'pir', 'pre-iva', 'facturacion'], wa: null, email: 'contable@ejemplo.test', auth_user_id: 'u3' },
  { id: 5, nombre: 'Contable Sin Modulo', iniciales: 'CS', rol: 'contable', rol_label: 'Asesor(a) Contable', es_master: false, activo: true,
    modulos: [], wa: null, email: 'contable2@ejemplo.test', auth_user_id: 'u5' },
];

const MOCK = `<script>
window._llamadas = []; window._confirms = []; window._respuestas = [];
window.confirm = function(m){ window._confirms.push(m); return window._respuestas.length ? window._respuestas.shift() : true; };
window.alert = function(){};
window._contadoorSesion = { id: 1, nombre: 'Master Ficticio', esMaster: true, rol: 'master' };
function getUsuario(){ return window._contadoorSesion; }
var MODULOS_POR_ROL = ${mpr};
window.gestoorGetModulosBaseRol = function(rol){ var b = MODULOS_POR_ROL[rol]; if(!b) return []; if(b[0]==='*') return []; return b.slice(); };
function _resp(o){ return Promise.resolve({ ok: true, status: 200, json: function(){ return Promise.resolve(o); }, text: function(){ return Promise.resolve(JSON.stringify(o)); } }); }
function sbFetch(path, opts){
  window._llamadas.push({ path: path, body: opts && opts.body ? JSON.parse(opts.body) : null });
  if (path.indexOf('usuarios?') === 0) return _resp(${JSON.stringify(USUARIOS)});
  if (path === 'rpc/admin_listar_identidades') return _resp([]);
  return _resp({ ok: true });
}
</script>`;

const html = html0
  .replace('<html lang="es" class="auth-pending">', '<html lang="es">')
  .replace(/<script src="\.\.\/assets\/gestoor-menu\.js"><\/script>/, MOCK)
  .replace(/<script src="\.\.\/(supabase|notifications|auth)\.js"><\/script>/g, '');

const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/admin/' });
const w = dom.window as unknown as Record<string, any>;
const d = w.document as Document;
const espera = () => new Promise((r) => setTimeout(r, 30));
await espera();

let fallas = 0; let total = 0;
const res = (n: string, ok: boolean, det = '') => { total++; console.log((ok ? 'OK   ' : 'MAL  ') + n + (det ? ' · ' + det : '')); if (!ok) fallas++; };
const casilla = () => d.getElementById('mod-facturacion') as HTMLInputElement | null;
const ultimaRpc = (p: string) => [...w._llamadas].reverse().find((x: any) => x.path === p);
const reset = (resp: boolean[] = []) => { w._llamadas.length = 0; w._confirms.length = 0; w._respuestas.length = 0; resp.forEach((x) => w._respuestas.push(x)); };

// 1-2. Ficha contable con 'facturacion' antiguo en usuarios.modulos → casilla visible y DESMARCADA
w.abrirModalEditar('3');
res('contable con facturacion antiguo: la casilla existe', !!casilla());
res('contable con facturacion antiguo: la casilla se abre DESMARCADA', casilla()?.checked === false);

// 3. Guardar sin tocar: avisa que quedará deshabilitada; aceptar → p_modulos SIN facturacion
reset([true]);
w.guardarUsuario(); await espera();
let r = ultimaRpc('rpc/admin_actualizar_usuario');
res('guardar sin tocar: NO envía facturacion', !!r && !r.body.p_modulos.includes('facturacion'), r ? JSON.stringify(r.body.p_modulos) : 'sin llamada');
res('guardar sin tocar: avisa que Facturación quedará deshabilitada', w._confirms.length === 1 && /quedará deshabilitada/.test(w._confirms[0]));

// 4. Mismo caso, el Master cancela → no se llama al servidor
w.abrirModalEditar('3'); reset([false]);
w.guardarUsuario(); await espera();
res('guardar sin tocar y cancelar: no llama a admin_actualizar_usuario', !ultimaRpc('rpc/admin_actualizar_usuario'));

// 5-6. Ficha admin (base '*') con 'facturacion' antiguo → desmarcada; guardar no la envía
w.closeModal(); w.abrirModalEditar('2');
res('admin con facturacion antiguo: la casilla se abre DESMARCADA', casilla()?.checked === false);
reset([true]);
w.guardarUsuario(); await espera();
r = ultimaRpc('rpc/admin_actualizar_usuario');
res('admin: guardar sin tocar NO envía facturacion', !!r && !r.body.p_modulos.includes('facturacion'), r ? JSON.stringify(r.body.p_modulos) : 'sin llamada');

// 7-8. Habilitar con clic explícito → confirmación con el nombre; aceptar → envía facturacion
w.closeModal(); w.abrirModalEditar('5');
res('contable sin módulo: la casilla se abre desmarcada', casilla()?.checked === false);
casilla()!.click();
reset([true]);
w.guardarUsuario(); await espera();
r = ultimaRpc('rpc/admin_actualizar_usuario');
res('clic explícito + confirmar: envía facturacion', !!r && r.body.p_modulos.includes('facturacion'));
res('confirmación: "Vas a habilitar Facturación para Contable Sin Modulo"', w._confirms.length === 1 && w._confirms[0].startsWith('Vas a habilitar Facturación para Contable Sin Modulo'));

// 9. Clic explícito pero cancela → no se envía nada
w.closeModal(); w.abrirModalEditar('5'); casilla()!.click(); reset([false]);
w.guardarUsuario(); await espera();
res('clic explícito y cancelar: no llama a admin_actualizar_usuario', !ultimaRpc('rpc/admin_actualizar_usuario'));

// 10. Alta nueva con Facturación → segunda confirmación con el nombre; envía facturacion
w.closeModal(); w.abrirModalNuevo();
(d.getElementById('f-nombre') as HTMLInputElement).value = 'Persona Nueva Ficticia';
(d.getElementById('f-email') as HTMLInputElement).value = 'nueva@ejemplo.test';
const sel = d.getElementById('f-rol') as HTMLSelectElement; sel.value = 'contable'; w.onRolChange();
res('alta nueva: la casilla se abre desmarcada', casilla()?.checked === false);
casilla()!.click(); reset([true, true]);
w.guardarUsuario(); await espera();
r = ultimaRpc('rpc/admin_crear_usuario');
res('alta nueva con facturacion: pide "Vas a habilitar Facturación para Persona Nueva Ficticia" y la envía',
  !!r && r.body.p_modulos.includes('facturacion') && w._confirms.length === 2 && w._confirms[1].startsWith('Vas a habilitar Facturación para Persona Nueva Ficticia'));

console.log(`\n${total - fallas}/${total}`);
Deno.exit(fallas ? 1 : 0);
