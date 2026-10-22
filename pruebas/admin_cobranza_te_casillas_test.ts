// Administración · casillas Cobranza y Trabajos especiales · prueba LOCAL con mocks (no toca Supabase ni producción).
// Mismo arnés que admin_facturacion_casilla_test.ts: admin/index.html en jsdom con supabase.js / auth.js / menú reemplazados por mocks.
// Verifica: 'cobranza' y 'trabajos_especiales' son casillas asignables (ya no "Próximamente"); nunca se pre-marcan desde
// public.usuarios.modulos (fichas con un 'cobranza' antiguo); habilitarlas pide confirmación con el nombre y cancelar no envía nada;
// guardar una ficha que los registra con la casilla desmarcada avisa; el cargo Cobranza los trae de base (sin casilla ni aviso).
// Uso: deno run --allow-read --allow-env --allow-sys --allow-net=registry.npmjs.org pruebas/admin_cobranza_te_casillas_test.ts
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
const proximamente = () => { const g = d.getElementById('adicionalesGrid')!; const box = [...g.querySelectorAll('div')].find((x) => x.textContent?.trim().startsWith('Próximamente')); return box ? box.textContent || '' : ''; };

// 1-4. Ficha admin con 'cobranza' ANTIGUO → ambas casillas existen y se abren DESMARCADAS; ya no están en Próximamente
w.abrirModalEditar('2');
res('admin con cobranza antiguo: la casilla Cobranza existe', !!cas('cobranza'));
res('admin con cobranza antiguo: Cobranza se abre DESMARCADA', cas('cobranza')?.checked === false);
res('la casilla Trabajos especiales existe y se abre desmarcada', !!cas('trabajos_especiales') && cas('trabajos_especiales')!.checked === false);
res('Próximamente ya no lista Cobranza (sí Gestión de Personal)', !/Cobranza/.test(proximamente()) && /Gestión de Personal/.test(proximamente()), proximamente());
res('etiquetas claras', /Cobranza \(gestiona y confirma pagos\)/.test(d.getElementById('adicionalesGrid')!.textContent || '') && /Trabajos especiales \(responsable\)/.test(d.getElementById('adicionalesGrid')!.textContent || ''));

// 5-6. Guardar sin tocar: avisa que Cobranza quedará deshabilitada y NO la envía (ni Gestión de Personal, que no es asignable)
reset([true]);
w.guardarUsuario(); await espera();
let r = ultimaRpc('rpc/admin_actualizar_usuario');
res('admin: guardar sin tocar NO envía cobranza ni trabajos_especiales', !!r && !r.body.p_modulos.includes('cobranza') && !r.body.p_modulos.includes('trabajos_especiales'), r ? JSON.stringify(r.body.p_modulos) : 'sin llamada');
res('admin: avisa "registra Cobranza … quedará deshabilitado"', w._confirms.length === 1 && /registra Cobranza/.test(w._confirms[0]) && /quedará deshabilitado/.test(w._confirms[0]), JSON.stringify(w._confirms));

// 7. Mismo caso y cancela → no llama
w.abrirModalEditar('2'); reset([false]);
w.guardarUsuario(); await espera();
res('admin: cancelar el aviso no llama a admin_actualizar_usuario', !ultimaRpc('rpc/admin_actualizar_usuario'));

// 8-9. Contable (conciliacion + facturacion): marca Facturación y Cobranza → 2 confirmaciones en orden; envía las tres
w.closeModal(); w.abrirModalEditar('3');
res('contable: Cobranza desmarcada al abrir', cas('cobranza')?.checked === false);
cas('facturacion')!.click(); cas('cobranza')!.click(); reset([true, true]);
w.guardarUsuario(); await espera();
r = ultimaRpc('rpc/admin_actualizar_usuario');
res('contable: envía conciliacion + facturacion + cobranza', !!r && ['conciliacion', 'facturacion', 'cobranza'].every((m) => r.body.p_modulos.includes(m)) && !r.body.p_modulos.includes('trabajos_especiales'), r ? JSON.stringify(r.body.p_modulos) : 'sin llamada');
res('contable: confirma "Vas a habilitar Facturación…" y luego "Vas a habilitar Cobranza para Contable Ficticia"', w._confirms.length === 2 && w._confirms[0].startsWith('Vas a habilitar Facturación para') && w._confirms[1].startsWith('Vas a habilitar Cobranza para Contable Ficticia'), JSON.stringify(w._confirms.map((c: string) => c.slice(0, 50))));

// 10. Marca Cobranza y cancela esa confirmación → no llama
w.closeModal(); w.abrirModalEditar('3'); cas('facturacion')!.click(); cas('cobranza')!.click(); reset([true, false]);
w.guardarUsuario(); await espera();
res('contable: cancelar la confirmación de Cobranza no llama', !ultimaRpc('rpc/admin_actualizar_usuario'));

// 11-12. Ficha que SÍ tiene cobranza y trabajos_especiales: casillas desmarcadas; guardar sin tocar avisa por ambos; cancelar el 2.º no llama
w.closeModal(); w.abrirModalEditar('4');
res('ficha con cobranza+TE: ambas casillas se abren desmarcadas (sin precarga)', cas('cobranza')?.checked === false && cas('trabajos_especiales')?.checked === false);
reset([true, false]);
w.guardarUsuario(); await espera();
res('ficha con cobranza+TE: avisa por Cobranza y por Trabajos especiales; cancelar no llama', w._confirms.length === 2 && /registra Cobranza/.test(w._confirms[0]) && /registra Trabajos especiales/.test(w._confirms[1]) && !ultimaRpc('rpc/admin_actualizar_usuario'));

// 13. Re-marcar ambas → 2 confirmaciones de habilitar, sin avisos de quitar; envía ambas
w.closeModal(); w.abrirModalEditar('4'); cas('cobranza')!.click(); cas('trabajos_especiales')!.click(); reset([true, true]);
w.guardarUsuario(); await espera();
r = ultimaRpc('rpc/admin_actualizar_usuario');
res('ficha con cobranza+TE re-marcadas: envía ambas con 2 confirmaciones', !!r && r.body.p_modulos.includes('cobranza') && r.body.p_modulos.includes('trabajos_especiales') && w._confirms.length === 2 && w._confirms[1].startsWith('Vas a habilitar Trabajos especiales para Contable Con Cobranza'));

// 14. Cargo Cobranza: 'cobranza' viene de base → sin casilla y sin aviso al guardar
w.closeModal(); w.abrirModalEditar('5');
res('cargo Cobranza: sin casilla Cobranza (viene de base)', !cas('cobranza'));
reset([]);
w.guardarUsuario(); await espera();
r = ultimaRpc('rpc/admin_actualizar_usuario');
res('cargo Cobranza: guardar sin avisos', !!r && w._confirms.length === 0, JSON.stringify(w._confirms));

// 15. Alta nueva con Trabajos especiales → confirma crear + habilitar TE; envía trabajos_especiales
w.closeModal(); w.abrirModalNuevo();
(d.getElementById('f-nombre') as HTMLInputElement).value = 'Persona Nueva Ficticia';
(d.getElementById('f-email') as HTMLInputElement).value = 'nueva@ejemplo.test';
const sel = d.getElementById('f-rol') as HTMLSelectElement; sel.value = 'contable'; w.onRolChange();
res('alta nueva: Trabajos especiales desmarcada', cas('trabajos_especiales')?.checked === false);
cas('trabajos_especiales')!.click(); reset([true, true]);
w.guardarUsuario(); await espera();
r = ultimaRpc('rpc/admin_crear_usuario');
res('alta nueva con TE: pide "Vas a habilitar Trabajos especiales para Persona Nueva Ficticia" y la envía',
  !!r && r.body.p_modulos.includes('trabajos_especiales') && w._confirms.length === 2 && w._confirms[1].startsWith('Vas a habilitar Trabajos especiales para Persona Nueva Ficticia'));

console.log(`\n${total - fallas}/${total}`);
Deno.exit(fallas ? 1 : 0);
