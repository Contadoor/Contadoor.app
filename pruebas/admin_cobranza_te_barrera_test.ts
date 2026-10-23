// Administración · BARRERA TEMPORAL de Cobranza y Trabajos especiales · prueba LOCAL con mocks (no toca Supabase ni producción).
// Con MODULOS_EN_ESPERA = ['cobranza','trabajos_especiales'] (tal como está en admin/index.html):
// las casillas se ven deshabilitadas con la nota "Disponible cuando se publiquen las pantallas nuevas"; el guardado rechaza
// asignarlas aunque se fuercen en el DOM; lo que una ficha ya tenga se conserva al guardar (no se quita); el resto sigue igual.
// Uso: deno run --allow-read --allow-env --allow-sys --allow-net=registry.npmjs.org pruebas/admin_cobranza_te_barrera_test.ts
import { JSDOM } from 'npm:jsdom@24.1.0';

const RAIZ = new URL('../', import.meta.url);
const html0 = Deno.readTextFileSync(new URL('admin/index.html', RAIZ));
const authJs = Deno.readTextFileSync(new URL('auth.js', RAIZ));
const mpr = authJs.match(/var MODULOS_POR_ROL=(\{[\s\S]*?\});/)![1];

// Fichas FICTICIAS (los nombres reales nunca van en el código)
const USUARIOS = [
  { id: 1, nombre: 'Master Ficticio', iniciales: 'MF', rol: 'master', rol_label: 'Master', es_master: true, activo: true, modulos: [], wa: null, email: 'master@ejemplo.test', auth_user_id: 'u1' },
  { id: 2, nombre: 'Admin Ficticio', iniciales: 'AF', rol: 'admin', rol_label: 'Admin / Supervisor', es_master: false, activo: true,
    modulos: ['clientes', 'gestion-personal', 'pagos', 'conciliacion', 'cobranza'], wa: null, email: 'admin@ejemplo.test', auth_user_id: 'u2' },
  { id: 3, nombre: 'Contable Ficticia', iniciales: 'CF', rol: 'contable', rol_label: 'Asesor(a) Contable', es_master: false, activo: true,
    modulos: ['conciliacion', 'facturacion'], wa: null, email: 'contable@ejemplo.test', auth_user_id: 'u3' },
  { id: 4, nombre: 'Contable Con Cobranza', iniciales: 'CC', rol: 'contable', rol_label: 'Asesor(a) Contable', es_master: false, activo: true,
    modulos: ['conciliacion', 'cobranza', 'trabajos_especiales'], wa: null, email: 'contable3@ejemplo.test', auth_user_id: 'u4' },
  { id: 5, nombre: 'Cobranza Ficticia', iniciales: 'CO', rol: 'cobranza', rol_label: 'Asesor(a) de Cobranza', es_master: false, activo: true,
    modulos: ['cobranza'], wa: null, email: 'cobranza@ejemplo.test', auth_user_id: 'u5' },
];

const MOCK = `<script>
window._llamadas = []; window._confirms = []; window._respuestas = [];
window.confirm = function(m){ window._confirms.push(m); return window._respuestas.length ? window._respuestas.shift() : true; };
window.alert = function(){};
window._toasts = [];
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
const cas = (id: string) => d.getElementById('mod-' + id) as HTMLInputElement | null;
const ultimaRpc = (p: string) => [...w._llamadas].reverse().find((x: any) => x.path === p);
const reset = (resp: boolean[] = []) => { w._llamadas.length = 0; w._confirms.length = 0; w._respuestas.length = 0; resp.forEach((x) => w._respuestas.push(x)); };
const toasts: string[] = []; const toast0 = w.adminToast; w.adminToast = (m: string, t: string) => { toasts.push(m); try { toast0 && toast0(m, t); } catch (_) { /* */ } };
const grid = () => d.getElementById('adicionalesGrid')!.textContent || '';
const NOTA = 'Disponible cuando se publiquen las pantallas nuevas';

res('la barrera está activa (constante única con los dos módulos)', JSON.stringify(w.MODULOS_EN_ESPERA) === '["cobranza","trabajos_especiales"]');
// 1-3. Casillas visibles, deshabilitadas, desmarcadas y con la nota
w.abrirModalEditar('3');
res('Cobranza: casilla visible y DESHABILITADA', !!cas('cobranza') && cas('cobranza')!.disabled === true && cas('cobranza')!.checked === false);
res('Trabajos especiales: casilla visible y DESHABILITADA', !!cas('trabajos_especiales') && cas('trabajos_especiales')!.disabled === true && cas('trabajos_especiales')!.checked === false);
res('nota "' + NOTA + '" en ambas', (grid().split(NOTA).length - 1) === 2);
res('Facturación sigue habilitada (no la afecta la barrera)', cas('facturacion')?.disabled === false);

// 4. Clic en la casilla deshabilitada no la marca; guardar no envía nada bloqueado
cas('cobranza')!.click();
res('clic en Cobranza deshabilitada: no se marca', cas('cobranza')!.checked === false);
reset([true]);
w.guardarUsuario(); await espera();
let r = ultimaRpc('rpc/admin_actualizar_usuario');
res('guardar contable: no envía cobranza ni trabajos_especiales', !!r && !r.body.p_modulos.includes('cobranza') && !r.body.p_modulos.includes('trabajos_especiales'), r ? JSON.stringify(r.body.p_modulos) : 'sin llamada');

// 5-6. Forzar la casilla en el DOM (quitar disabled y marcar) → el guardado la RECHAZA y no llama al servidor
w.closeModal(); w.abrirModalEditar('3');
cas('cobranza')!.disabled = false; cas('cobranza')!.checked = true; reset([true, true]); toasts.length = 0;
w.guardarUsuario(); await espera();
res('payload con cobranza forzada: rechazado, no llama a admin_actualizar_usuario', !ultimaRpc('rpc/admin_actualizar_usuario'));
res('mensaje claro "Todavía no se puede asignar Cobranza…"', toasts.some((t) => /Todavía no se puede asignar Cobranza/.test(t) && t.includes(NOTA)), JSON.stringify(toasts));

// 7-8. Ficha que YA tiene cobranza y trabajos_especiales: se conservan al guardar, sin avisos de quitar
w.closeModal(); w.abrirModalEditar('4');
res('ficha con cobranza+TE: casillas deshabilitadas', cas('cobranza')!.disabled && cas('trabajos_especiales')!.disabled);
reset([]);
w.guardarUsuario(); await espera();
r = ultimaRpc('rpc/admin_actualizar_usuario');
res('ficha con cobranza+TE: guardar CONSERVA ambos (no los quita) y no pide confirmaciones', !!r && r.body.p_modulos.includes('cobranza') && r.body.p_modulos.includes('trabajos_especiales') && r.body.p_modulos.includes('conciliacion') && w._confirms.length === 0, r ? JSON.stringify(r.body.p_modulos) + ' ' + JSON.stringify(w._confirms) : 'sin llamada');

// 9. Ficha admin con cobranza antiguo (caso Diego antes de la limpieza): se conserva tal cual, no se agrega nada nuevo
w.closeModal(); w.abrirModalEditar('2'); reset([]);
w.guardarUsuario(); await espera();
r = ultimaRpc('rpc/admin_actualizar_usuario');
res('ficha con cobranza antiguo: se conserva (no se quita) y no se agrega trabajos_especiales', !!r && r.body.p_modulos.includes('cobranza') && !r.body.p_modulos.includes('trabajos_especiales'), r ? JSON.stringify(r.body.p_modulos) : 'sin llamada');

// 10. Cargo Cobranza: viene de base → no se duplica en adicionales
w.closeModal(); w.abrirModalEditar('5'); reset([]);
w.guardarUsuario(); await espera();
r = ultimaRpc('rpc/admin_actualizar_usuario');
res('cargo Cobranza: sin casilla y sin duplicar en el payload', !cas('cobranza') && !!r && !r.body.p_modulos.includes('cobranza'), r ? JSON.stringify(r.body.p_modulos) : '');

// 11-12. Alta nueva: casillas deshabilitadas; forzar TE → rechazo, no crea
w.closeModal(); w.abrirModalNuevo();
(d.getElementById('f-nombre') as HTMLInputElement).value = 'Persona Nueva Ficticia';
(d.getElementById('f-email') as HTMLInputElement).value = 'nueva@ejemplo.test';
const sel = d.getElementById('f-rol') as HTMLSelectElement; sel.value = 'contable'; w.onRolChange();
res('alta nueva: Trabajos especiales deshabilitada', cas('trabajos_especiales')?.disabled === true);
cas('trabajos_especiales')!.disabled = false; cas('trabajos_especiales')!.checked = true; reset([true, true]); toasts.length = 0;
w.guardarUsuario(); await espera();
res('alta nueva con TE forzado: rechazado, no llama a admin_crear_usuario', !ultimaRpc('rpc/admin_crear_usuario') && toasts.some((t) => /Trabajos especiales/.test(t)));

// 13. Alta nueva normal (con Facturación) sigue funcionando
w.closeModal(); w.abrirModalNuevo();
(d.getElementById('f-nombre') as HTMLInputElement).value = 'Persona Nueva Ficticia';
(d.getElementById('f-email') as HTMLInputElement).value = 'nueva@ejemplo.test';
(d.getElementById('f-rol') as HTMLSelectElement).value = 'contable'; w.onRolChange();
cas('facturacion')!.click(); reset([true, true]);
w.guardarUsuario(); await espera();
r = ultimaRpc('rpc/admin_crear_usuario');
res('alta nueva con Facturación: funciona igual que antes', !!r && r.body.p_modulos.includes('facturacion') && !r.body.p_modulos.includes('cobranza'));

console.log(`\n${total - fallas}/${total}`);
Deno.exit(fallas ? 1 : 0);
