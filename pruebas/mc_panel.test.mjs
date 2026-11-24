// Accesos MiContadoor · panel de toda la cartera (MICONTADOOR-APERTURA) · pruebas de clientes/mc-panel.js con DOBLES de las RPC.
// Sin red ni Supabase; datos 100 % ficticios (dominios .test, RUT 11.111.111-1 / 22.222.222-2).
// Uso: node --test pruebas/mc_panel.test.mjs   (opcional BACKEND=<gestoor-backend feat/micontadoor-apertura> cruza firmas)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, existsSync, readdirSync } from 'node:fs';

const require = createRequire(import.meta.url);
const leer = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const P = require('../clientes/mc-panel.js');

const err = (codigo, status) => Object.assign(new Error(codigo), { codigo, status: status || 0 });
function doble(guion = {}) {
  const llamadas = [];
  const api = { rpc(fn, args) {
    llamadas.push([fn, args]); const r = guion[fn];
    if (r === undefined) return Promise.reject(err('MC_ERROR'));
    if (r instanceof Error) return Promise.reject(r);
    return Promise.resolve(typeof r === 'function' ? r(args) : r);
  } };
  return { ctl: P.crearControlador({ api }), llamadas };
}
const CLIENTES = [
  { cliente_id: 501, razon_social: 'Panadería Ficticia SpA', rut: '11.111.111-1', estado_cliente: 'activo', vigentes: 2, invitados: 1, activos: 1, suspendidos: 0, revocados: 0, terminos_pendientes: 1, ultimo_ingreso_at: '2026-11-20T15:00:00Z' },
  { cliente_id: 502, razon_social: 'Ferretería Ejemplo Ltda', rut: '22.222.222-2', estado_cliente: 'activo', vigentes: 0, invitados: 0, activos: 0, suspendidos: 0, revocados: 1, terminos_pendientes: 0, ultimo_ingreso_at: null },
  { cliente_id: 503, razon_social: 'Árbol Diseño SpA', rut: '11.111.111-1', estado_cliente: 'activo', vigentes: 1, invitados: 0, activos: 1, suspendidos: 0, revocados: 0, terminos_pendientes: 0, ultimo_ingreso_at: '2026-11-21T12:00:00Z' }
];
const PANEL = { ok: true, terminos_vigente: '2026-11-16', resumen: { clientes_activos: 3, con_acceso: 2, sin_acceso: 1, cuentas_activas: 2, cuentas_invitadas: 1, solicitudes_abiertas: 1 }, clientes: CLIENTES };

test('1 visibilidad fail-closed: solo puede_dar_alta === true muestra el botón', async () => {
  assert.deepEqual(await doble({ mc_yo: { es_master: true, puede_dar_alta: true } }).ctl.puede(), { visible: true, es_master: true });
  for (const yo of [{ puede_dar_alta: false }, { puede_dar_alta: 'true' }, null, {}, err('MC_SIN_PERMISO'), err('NO_SESSION')]) {
    assert.equal((await doble({ mc_yo: yo }).ctl.puede()).visible, false, JSON.stringify(yo));
  }
});
test('2 panel: llama mc_accesos_panel; forma inválida → error; 404/PGRST202 → «Aún no instalado»', async () => {
  let d = doble({ mc_accesos_panel: PANEL });
  let r = await d.ctl.panel(); assert.equal(r.ok, true); assert.equal(r.datos.clientes.length, 3);
  assert.deepEqual(d.llamadas[0], ['mc_accesos_panel', {}]);
  r = await doble({ mc_accesos_panel: { ok: true } }).ctl.panel(); assert.equal(r.ok, false); assert.equal(r.codigo, 'MC_ERROR');
  r = await doble({ mc_accesos_panel: err('MC_ERROR', 404) }).ctl.panel(); assert.equal(r.codigo, 'NO_INSTALADO'); assert.match(r.mensaje, /Aún no instalado en el servidor/);
  r = await doble({ mc_accesos_panel: err('PGRST202') }).ctl.panel(); assert.equal(r.codigo, 'NO_INSTALADO');
  r = await doble({ mc_accesos_panel: err('MC_SIN_PERMISO', 400) }).ctl.panel(); assert.equal(r.ocultar, true);
});
test('3 filtros y buscador (sin tildes, puntos ni guiones)', () => {
  const ids = (f, t) => P.filtrar(CLIENTES, f, t).map((c) => c.cliente_id);
  assert.deepEqual(ids('todos', ''), [501, 502, 503]);
  assert.deepEqual(ids('con', ''), [501, 503]);
  assert.deepEqual(ids('sin', ''), [502]);
  assert.deepEqual(ids('invitados', ''), [501]);
  assert.deepEqual(ids('terminos', ''), [501]);
  assert.deepEqual(ids('todos', 'arbol'), [503]);
  assert.deepEqual(ids('todos', '22222222'), [502]);
  assert.deepEqual(P.filtrar([null, 'x', ...CLIENTES], 'todos', '').length, 3);
});
test('4 vista Clientes: resumen, renglones clicables a la ficha, estados y SIN botón de invitar masivo', () => {
  const h = P.renderPanel({ tab: 'clientes', filtro: 'todos', texto: '', resumen: PANEL.resumen, clientes: CLIENTES }, (n) => '<svg data-n="' + n + '"></svg>');
  assert.equal((h.match(/data-mcp-cliente="/g) || []).length, 3);
  assert.match(h, /data-mcp-cliente="501"/);
  assert.match(h, /Sin acceso/); assert.match(h, /1 invitado/); assert.match(h, /1 pendiente/); assert.match(h, /Al día/);
  assert.match(h, /20-11-2026 · 12:00/);
  assert.ok(!/invitar|data-mca-accion/i.test(h.replace(/Para invitar, abre la ficha/, '')), 'el panel no invita');
  assert.match(h, /Este panel no envía correos/);
  const sinIc = h.replace(/<i class="ic[^"]*"><svg[^>]*><\/svg><\/i>/g, '');
  assert.ok(!/<svg/.test(sinIc), 'todo ícono dentro de <i class="ic">');
});
test('5 la vista escapa todo lo que viene de la base', () => {
  const malo = [{ cliente_id: '9"><img src=x onerror=alert(1)>', razon_social: '<script>alert(1)</script>', rut: '"><b>', vigentes: 1, activos: 1 }];
  const h0 = P.renderClientes({ clientes: malo, filtro: 'todos', texto: '"><script>' });
  assert.ok(!h0.includes('<script>'), 'buscador escapado');
  const h = P.renderClientes({ clientes: malo, filtro: 'todos', texto: '' });
  assert.ok(!h.includes('<script>') && !h.includes('<img src=x') && h.includes('&quot;&gt;&lt;b&gt;'));
  assert.match(h, /data-mcp-cliente="0"/, 'id no numérico → 0');
  const s = P.renderSoporte({ solicitudes: [{ id: 1, folio: '<i>', estado: 'abierta', tipo: '<b>', mensaje: '<img src=x onerror=1>', correo: 'a@b.test', notas: [{ nota: '<script>x</script>', por: '<u>' }] }] });
  assert.ok(!s.includes('<img src=x') && !s.includes('<script>') && !s.includes('<u>'));
});
test('6 soporte: listar con filtro; actualizar valida y envía; incidente solo con datos válidos', async () => {
  const d = doble({ mc_soporte_listar: { ok: true, solicitudes: [] }, mc_soporte_actualizar: { ok: true }, mc_incidente_registrar: { ok: true, id: 7, folio: 'MC-2026-00007' } });
  await d.ctl.soporte(''); await d.ctl.soporte('cerrada'); await d.ctl.soporte('rara');
  assert.deepEqual(d.llamadas.map((x) => x[1].p_estado), [null, 'cerrada', null]);
  let r = await d.ctl.actualizar({ id: 3, estado: 'en_curso', nota: 'x', es_incidente: false });
  assert.equal(r.codigo, 'VALIDACION'); assert.ok(r.errores.nota);
  r = await d.ctl.actualizar({ id: 3, estado: 'cerrada', nota: 'Se le explicó por WhatsApp', es_incidente: true, severidad: null });
  assert.ok(r.errores.severidad, 'incidente exige severidad');
  r = await d.ctl.actualizar({ id: 3, estado: 'cerrada', nota: '  Se le explicó por WhatsApp ', es_incidente: false, severidad: null });
  assert.equal(r.ok, true);
  assert.deepEqual(d.llamadas.at(-1), ['mc_soporte_actualizar', { p_id: 3, p_estado: 'cerrada', p_nota: 'Se le explicó por WhatsApp', p_es_incidente: false, p_severidad: null }]);
  r = await d.ctl.incidente({ cliente_id: null, titulo: 'ab', detalle: 'corto', severidad: 'x' });
  assert.equal(r.codigo, 'VALIDACION'); assert.deepEqual(Object.keys(r.errores).sort(), ['detalle', 'severidad', 'titulo']);
  r = await d.ctl.incidente({ cliente_id: 501, titulo: 'Correo equivocado', detalle: 'La invitación salió a un correo con un error de tipeo; se revocó.', severidad: 'media' });
  assert.equal(r.ok, true); assert.equal(r.datos.folio, 'MC-2026-00007');
  assert.equal(d.llamadas.at(-1)[0], 'mc_incidente_registrar'); assert.equal(d.llamadas.at(-1)[1].p_cliente_id, 501);
});
test('7 doble clic: una escritura a la vez', async () => {
  let soltar; const espera = new Promise((ok) => { soltar = ok; });
  const d = doble({ mc_soporte_actualizar: () => espera.then(() => ({ ok: true })) });
  const ok = { id: 1, estado: 'cerrada', nota: 'Resuelto por correo', es_incidente: false };
  const a = d.ctl.actualizar(ok); const b = await d.ctl.actualizar(ok);
  assert.equal(b.codigo, 'OCUPADO'); soltar(); assert.equal((await a).ok, true);
  assert.equal(d.llamadas.length, 1);
});
test('8 vista Soporte: «Registrar incidente» solo para el Master; estados y marca de incidente', () => {
  const sol = [{ id: 1, folio: 'MC-2026-00001', origen: 'cliente', estado: 'abierta', tipo: 'seguridad', mensaje: 'No reconozco un ingreso', razon_social: 'Panadería Ficticia SpA', correo: 'ana@panaderia-ficticia.test', es_incidente: true, severidad: 'alta', creada_at: '2026-11-24T13:00:00Z', notas: [] }];
  const hm = P.renderSoporte({ solicitudes: sol, es_master: true }), hn = P.renderSoporte({ solicitudes: sol, es_master: false });
  assert.match(hm, /data-mcp-accion="incidente"/); assert.ok(!/data-mcp-accion="incidente"/.test(hn));
  assert.match(hn, /Incidente · Alta/); assert.match(hn, /Seguridad/); assert.match(hn, /Abierta/);
  assert.match(P.renderSoporte({ solicitudes: [] }), /No hay solicitudes/);
});
test('9 vista Términos: vigente con huella corta; sin vigente → alerta', () => {
  const t = { ok: true, vigente: { version: '2026-11-16', sha256: 'a'.repeat(64), publicada_at: '2026-11-16T19:43:00Z' },
    versiones: [{ version: '2026-11-16', titulo: 'Términos V1', sha256: 'a'.repeat(64), publicada_at: '2026-11-16T19:43:00Z', vigente: true, aceptaciones: 2 }] };
  const h = P.renderTerminos(t);
  assert.match(h, /Versión vigente: 2026-11-16/); assert.match(h, /aaaaaaaaaaaa…/); assert.match(h, /Vigente/); assert.match(h, />2</);
  assert.match(P.renderTerminos({ versiones: [] }), /No hay una versión vigente/);
});
test('10 errores en el panel: «Aún no instalado» sin estilo de error; otros en rojo', () => {
  assert.ok(!/mcp-err/.test(P.renderPanel({ tab: 'soporte', error: P.NO_INSTALADO, errorCodigo: 'NO_INSTALADO' })));
  assert.match(P.renderPanel({ tab: 'soporte', error: 'x', errorCodigo: 'MC_ERROR' }), /mcp-err/);
});
test('11 estándar: index monta botón y scripts en orden; sin clave anon, console, localStorage; solo RPC del contrato', () => {
  const html = leer('clientes/index.html');
  const iSb = html.indexOf('<script src="../supabase.js">'), iA = html.indexOf('<script src="mc-accesos.js">'), iP = html.indexOf('<script src="mc-panel.js">'), iMod = html.indexOf("console.info('[Clientes]");
  assert.ok(iSb > 0 && iSb < iA && iA < iP && iP < iMod, 'orden de scripts');
  assert.ok(html.includes('href="mc-panel.css"') && html.includes('<div id="mcPanelBoton" hidden></div>'));
  const js = leer('clientes/mc-panel.js');
  assert.ok(!/SB_KEY|apikey|anon\b|service_role/i.test(js));
  assert.ok(!/function sbH|function sbFetch|console\.(log|info|warn|error)|localStorage|sessionStorage|functions\/v1|mc-invitar/.test(js), 'sin Edge ni almacenamiento');
  const rpcs = [...new Set([...js.matchAll(/'(mc_[a-z_]+)'/g)].map((m) => m[1]))].sort();
  assert.deepEqual(rpcs, ['mc_accesos_panel', 'mc_incidente_registrar', 'mc_soporte_actualizar', 'mc_soporte_listar', 'mc_terminos_estado', 'mc_yo']);
  for (const f of ['clientes/mc-panel.js', 'clientes/mc-panel.css', 'pruebas/mc_panel.test.mjs']) {
    const s = leer(f);
    const correos = [...s.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g)].map((m) => m[0]).filter((c) => !/\.test$/i.test(c));
    assert.deepEqual(correos, [], f);
    const ruts = [...s.matchAll(/\b\d{1,2}\.\d{3}\.\d{3}-[\dkK]\b/g)].map((m) => m[0]).filter((r) => !['11.111.111-1', '22.222.222-2'].includes(r));
    assert.deepEqual(ruts, [], f);
  }
});
const BE = process.env.BACKEND;
const MIGS = BE && existsSync(BE + '/supabase/migrations') ? readdirSync(BE + '/supabase/migrations').filter((f) => /^2026112[4-9].*\.sql$/.test(f) && !/check|rollback/.test(f)) : [];
test('12 contrato con el backend (BACKEND=… con las migraciones de MICONTADOOR-APERTURA)', { skip: !MIGS.length }, () => {
  const todo = MIGS.map((f) => readFileSync(BE + '/supabase/migrations/' + f, 'utf8')).join('\n');
  const firmas = ['public.mc_accesos_panel()', 'public.mc_soporte_listar(p_estado text', 'public.mc_soporte_actualizar(p_id bigint, p_estado text, p_nota text, p_es_incidente boolean, p_severidad text)',
    'public.mc_incidente_registrar(p_cliente_id bigint, p_titulo text, p_detalle text, p_severidad text)', 'public.mc_terminos_estado()'];
  for (const f of firmas) assert.ok(todo.includes(f), 'firma ' + f);
});
