// COM-ACC-1 · Administración: casilla 'Comercial' (acceso comercial adicional sin cambiar el cargo). Prueba LOCAL con mocks (sin red ni producción).
// Mismo arnés que admin_cobranza_te_casillas_test.ts. Fichas FICTICIAS.
// Uso: deno run --allow-read --allow-env --allow-sys --allow-net=registry.npmjs.org pruebas/com_acc_1_admin_casilla_test.ts
import { JSDOM } from 'npm:jsdom@24.1.0';

const RAIZ = new URL('../', import.meta.url);
// Esta prueba valida el comportamiento CON LA BARRERA LEVANTADA (MODULOS_EN_ESPERA = []), que es lo que quedará al publicar las pantallas nuevas.
// La barrera temporal se prueba en admin_cobranza_te_barrera_test.ts.
const html0src = Deno.readTextFileSync(new URL('admin/index.html', RAIZ));
const BARRERA = "var MODULOS_EN_ESPERA = ['cobranza','trabajos_especiales'];";
// 26-oct: la barrera ya se levantó en admin/index.html; si alguien la repone, la prueba la levanta igual para validar este estado.
if (!html0src.includes(BARRERA) && !/var MODULOS_EN_ESPERA = \[\];/.test(html0src)) throw new Error('No se encontró MODULOS_EN_ESPERA');
const html0 = html0src.replace(BARRERA, 'var MODULOS_EN_ESPERA = [];');
const authJs = Deno.readTextFileSync(new URL('auth.js', RAIZ));
const mpr = authJs.match(/var MODULOS_POR_ROL=(\{[\s\S]*?\});/)![1];

// Fichas FICTICIAS (los nombres reales nunca van en el código)
const USUARIOS = [
  { id: 1, nombre: 'Master Ficticio', iniciales: 'MF', rol: 'master', rol_label: 'Master', es_master: true, activo: true, modulos: [], wa: null, email: 'master@ejemplo.test', auth_user_id: 'u1' },
  { id: 2, nombre: 'Tesoreria Ficticia', iniciales: 'TF', rol: 'pagos', rol_label: 'Tesorería', es_master: false, activo: true, modulos: ['planes'], wa: null, email: 't@ejemplo.test', auth_user_id: 'u2' },
  { id: 3, nombre: 'Tesoreria Comercial', iniciales: 'TC', rol: 'pagos', rol_label: 'Tesorería', es_master: false, activo: true, modulos: ['planes', 'comercial'], wa: null, email: 'tc@ejemplo.test', auth_user_id: 'u3' },
  { id: 4, nombre: 'Comercial Ficticio', iniciales: 'CF', rol: 'comercial', rol_label: 'Asesor(a) Comercial', es_master: false, activo: true, modulos: [], wa: null, email: 'c@ejemplo.test', auth_user_id: 'u4' },
]

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
const reset = () => { w._llamadas.length = 0; w._confirms.length = 0; w._respuestas.length = 0; };
w.abrirModalEditar('2');
res('Tesorería sin la marca: la casilla Comercial existe y está desmarcada', !!cas('comercial') && cas('comercial')!.checked === false);
res('etiqueta clara', /Comercial \(prospectos, bitácoras, bandeja WhatsApp y cotizaciones\)/.test(d.getElementById('adicionalesGrid')!.textContent || ''));
reset(); w.guardarUsuario(); await espera();
let r = ultimaRpc('rpc/admin_actualizar_usuario');
res('guardar sin tocar NO agrega comercial y conserva planes', !!r && !r.body.p_modulos.includes('comercial') && r.body.p_modulos.includes('planes'), r ? JSON.stringify(r.body.p_modulos) : 'sin llamada');
w.closeModal(); w.abrirModalEditar('2'); cas('comercial')!.click(); reset(); w.guardarUsuario(); await espera();
r = ultimaRpc('rpc/admin_actualizar_usuario');
res('marcar Comercial: envía planes + comercial y el cargo sigue pagos', !!r && r.body.p_modulos.includes('comercial') && r.body.p_modulos.includes('planes') && r.body.p_rol === 'pagos', r ? JSON.stringify(r.body) : 'sin llamada');
w.closeModal(); w.abrirModalEditar('3');
res('ficha que ya tiene comercial: la casilla se abre MARCADA (no se pierde al guardar)', cas('comercial')?.checked === true);
reset(); w.guardarUsuario(); await espera();
r = ultimaRpc('rpc/admin_actualizar_usuario');
res('guardar esa ficha sin tocar conserva comercial', !!r && r.body.p_modulos.includes('comercial'), r ? JSON.stringify(r.body.p_modulos) : 'sin llamada');
w.closeModal(); w.abrirModalEditar('4');
res('cargo Comercial: sin casilla (viene de base)', !cas('comercial'));
console.log(`\nCOM-ACC-1 admin: ${total - fallas}/${total}`);
Deno.exit(fallas ? 1 : 0);
