// Accesos MiContadoor (H-MONT-2) · pruebas del módulo clientes/mc-accesos.js con DOBLES de las RPC public.mc_* y de la Edge mc-invitar.
// Sin red ni Supabase; datos 100 % ficticios (dominios .test / example).
// Uso: node --test pruebas/mc_accesos.test.mjs
// Opcional: BACKEND=<ruta a gestoor-backend en la rama sql/micontadoor-mc1> cruza el contrato con la migración MC1B y la Edge.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';

const require = createRequire(import.meta.url);
const raiz = new URL('../', import.meta.url);
const leer = (p) => readFileSync(new URL(p, raiz), 'utf8');
const M = require('../clientes/mc-accesos.js');

const REF1 = '11111111-1111-4111-8111-111111111111';
const REF2 = '22222222-2222-4222-8222-222222222222';
const REF3 = '33333333-3333-4333-8333-333333333333';
const NUEVA = '44444444-4444-4444-8444-444444444444';
const fila = (o) => Object.assign({ ref: REF1, correo: 'titular@panaderia-ficticia.test', nombre: 'Ana Ficticia', rol: 'titular', ver_mi_cuenta: true, ver_facturas: true,
  estado_acceso: 'vigente', estado_cuenta: 'invitada', otorgado_at: '2026-11-13T12:00:00Z', revocado_at: null, ultimo_ingreso_at: null }, o);

// Doble de la API: rpc(fn,args) y edge(body) responden según un guion; se registran todas las llamadas.
function doble(guion = {}) {
  const llamadas = [];
  let campana = 0;
  const api = {
    rpc(fn, args) {
      llamadas.push(['rpc', fn, args]);
      const r = guion[fn];
      if (r === undefined) return Promise.reject(Object.assign(new Error('MC_ERROR'), { codigo: 'MC_ERROR' }));
      if (r instanceof Error) return Promise.reject(r);
      return Promise.resolve(typeof r === 'function' ? r(args) : r);
    },
    edge(body) {
      llamadas.push(['edge', body.accion, body]);
      const r = guion.edge;
      if (r instanceof Error) return Promise.reject(r);
      return Promise.resolve(typeof r === 'function' ? r(body) : r);
    }
  };
  const ctl = M.crearControlador({ api, recargarCampana: () => { campana++; } });
  return { ctl, llamadas, get campana() { return campana; } };
}
const err = (codigo) => Object.assign(new Error(codigo), { codigo });
const YO_OK = { es_master: true, puede_dar_alta: true };
const INV = { correo: '  Nuevo.Titular@Empresa-Ficticia.TEST ', nombre: 'Nuevo Titular', rol: 'titular', motivo: 'Onboarding del cliente' };

/* ── 1. Visibilidad (fail-closed) ── */
test('1a sin permiso en mc_yo (excepción MC_SIN_PERMISO) → la sección no se muestra y no se lista', async () => {
  const d = doble({ mc_yo: err('MC_SIN_PERMISO') });
  assert.deepEqual(await d.ctl.cargar(501), { visible: false });
  assert.equal(d.llamadas.filter((x) => x[1] === 'mc_accesos_listar').length, 0);
});
test('1b mc_yo con puede_dar_alta false, ausente o "true" (texto) → oculta', async () => {
  for (const yo of [{ es_master: false, puede_dar_alta: false }, {}, null, { puede_dar_alta: 'true' }, []]) {
    const d = doble({ mc_yo: yo });
    assert.equal((await d.ctl.cargar(501)).visible, false, JSON.stringify(yo));
  }
});
test('1c mc_accesos_listar responde MC_SIN_PERMISO o NO_SESSION → oculta', async () => {
  for (const c of ['MC_SIN_PERMISO', 'NO_SESSION']) {
    const d = doble({ mc_yo: YO_OK, mc_accesos_listar: err(c) });
    assert.equal((await d.ctl.cargar(501)).visible, false);
  }
});
test('1d otro error del listado o respuesta que no es lista → visible con error, sin filas', async () => {
  let d = doble({ mc_yo: YO_OK, mc_accesos_listar: err('RED') });
  let r = await d.ctl.cargar(501);
  assert.equal(r.visible, true); assert.match(r.error, /conexión/); assert.deepEqual(r.accesos, []);
  d = doble({ mc_yo: YO_OK, mc_accesos_listar: { ok: true } });
  r = await d.ctl.cargar(501);
  assert.equal(r.visible, true); assert.ok(r.error);
});
test('1e cliente inválido → no se llama a ninguna RPC', async () => {
  for (const id of [0, -1, 'abc', null, 1.5]) {
    const d = doble({ mc_yo: YO_OK });
    assert.equal((await d.ctl.cargar(id)).visible, false);
    assert.equal(d.llamadas.length, 0);
  }
});
test('1f permitido: lista con p_cliente_id numérico, vigentes primero', async () => {
  const lista = [fila({ ref: REF1, estado_acceso: 'revocado', revocado_at: '2026-11-10T12:00:00Z' }), fila({ ref: REF2, estado_cuenta: 'activa' })];
  const d = doble({ mc_yo: YO_OK, mc_accesos_listar: lista });
  const r = await d.ctl.cargar('501');
  assert.deepEqual(d.llamadas[1], ['rpc', 'mc_accesos_listar', { p_cliente_id: 501 }]);
  assert.equal(r.visible, true);
  assert.deepEqual(r.accesos.map((x) => x.ref), [REF2, REF1]);
});

/* ── 2. Invitar ── */
test('2a validación local: correo inválido, rol inválido, motivo corto y nombre largo → sin llamar a la Edge', async () => {
  const casos = [
    [{ ...INV, correo: 'sin-arroba' }, 'correo'], [{ ...INV, correo: 'a@b' }, 'correo'], [{ ...INV, correo: 'con espacio@x.test' }, 'correo'],
    [{ ...INV, correo: 'x'.repeat(250) + '@e.test' }, 'correo'], [{ ...INV, rol: 'admin' }, 'rol'], [{ ...INV, motivo: 'ok' }, 'motivo'],
    [{ ...INV, motivo: 'x'.repeat(301) }, 'motivo'], [{ ...INV, nombre: 'n'.repeat(121) }, 'nombre']
  ];
  for (const [datos, campo] of casos) {
    const d = doble({ edge: { status: 200, cuerpo: { ok: true, resultado: 'cuenta_creada', acceso_ref: NUEVA } } });
    const r = await d.ctl.invitar(501, datos);
    assert.equal(r.ok, false); assert.ok(r.errores[campo], campo + ' ' + JSON.stringify(datos).slice(0, 60));
    assert.equal(d.llamadas.length, 0);
  }
});
test('2b cuenta_creada con permisos del rol: un solo POST a la Edge con el contrato exacto y recarga la campana', async () => {
  const d = doble({ edge: { status: 200, cuerpo: { ok: true, resultado: 'cuenta_creada', acceso_ref: NUEVA } } });
  const r = await d.ctl.invitar(501, INV);
  assert.equal(r.ok, true); assert.equal(r.tipo, 'exito'); assert.match(r.mensaje, /Cuenta creada/); assert.equal(r.recargar, true);
  assert.equal(d.llamadas.length, 1);
  const body = d.llamadas[0][2];
  assert.deepEqual(body, { accion: 'invitar', cliente_id: 501, correo: 'nuevo.titular@empresa-ficticia.test', nombre: 'Nuevo Titular', rol: 'titular', motivo: 'Onboarding del cliente' });
  // La Edge rechaza (400) cualquier campo fuera de su lista blanca: nunca se mandan permisos ni ids internos.
  const PERMITIDOS = ['accion', 'cliente_id', 'correo', 'nombre', 'rol', 'motivo'];
  assert.ok(Object.keys(body).every((k) => PERMITIDOS.includes(k)));
  assert.equal(d.campana, 1);
});
test('2c permisos distintos a los del rol → después del alta llama a mc_acceso_permisos con el acceso_ref devuelto', async () => {
  const d = doble({ edge: { status: 200, cuerpo: { ok: true, resultado: 'cuenta_creada', acceso_ref: NUEVA } }, mc_acceso_permisos: { ok: true } });
  const r = await d.ctl.invitar(501, { ...INV, rol: 'consulta', ver_mi_cuenta: true, ver_facturas: false });
  assert.equal(r.ok, true); assert.match(r.mensaje, /Permisos ajustados/);
  assert.deepEqual(d.llamadas[1], ['rpc', 'mc_acceso_permisos', { p_ref: NUEVA, p_ver_mi_cuenta: true, p_ver_facturas: false, p_motivo: 'Onboarding del cliente' }]);
});
test('2d consulta sin tocar permisos → queda sin pagos ni facturas y NO se llama a permisos', async () => {
  const d = doble({ edge: { status: 200, cuerpo: { ok: true, resultado: 'cuenta_creada', acceso_ref: NUEVA } } });
  await d.ctl.invitar(501, { ...INV, rol: 'consulta' });
  assert.equal(d.llamadas.length, 1);
  assert.deepEqual(M.validarInvitacion({ ...INV, rol: 'consulta' }).datos.ver_mi_cuenta, false);
});
test('2e si falla el ajuste de permisos, avisa (el acceso SÍ quedó creado)', async () => {
  const d = doble({ edge: { status: 200, cuerpo: { ok: true, resultado: 'cuenta_creada', acceso_ref: NUEVA } }, mc_acceso_permisos: err('MC_ERROR') });
  const r = await d.ctl.invitar(501, { ...INV, ver_facturas: false });
  assert.equal(r.ok, true); assert.equal(r.tipo, 'aviso'); assert.match(r.mensaje, /no se pudieron ajustar/);
});
test('2f empresa_vinculada (multiempresa) y ya_vinculado', async () => {
  let d = doble({ edge: { status: 200, cuerpo: { ok: true, resultado: 'empresa_vinculada', acceso_ref: NUEVA } } });
  let r = await d.ctl.invitar(501, INV);
  assert.equal(r.tipo, 'exito'); assert.match(r.mensaje, /se le sumó esta empresa/);
  d = doble({ edge: { status: 200, cuerpo: { ok: true, resultado: 'ya_vinculado' } } });
  r = await d.ctl.invitar(501, { ...INV, ver_facturas: false });
  assert.equal(r.tipo, 'aviso'); assert.match(r.mensaje, /ya tenía un acceso vigente/);
  assert.equal(d.llamadas.length, 1, 'ya_vinculado no ajusta permisos');
});
test('2g errores de la Edge → mensaje claro, sin recargar la campana', async () => {
  const casos = [
    [403, 'MC_SIN_PERMISO', /no tiene permiso/, true], [400, 'MC_DATOS', /Revisa los datos/, false],
    [409, 'MC_CORREO_NO_DISPONIBLE', /no se puede usar/, false], [409, 'MC_CUENTA_NO_VIGENTE', /suspendida o cerrada/, false],
    [429, 'MC_LIMITE', /límite/, false], [502, 'MC_CORREO_NO_ENVIADO', /No se pudo enviar el correo/, false],
    [401, 'NO_SESSION', /sesión terminó/, false], [500, 'MC_ERROR', /no pudo completar/, false]
  ];
  for (const [status, error, re, ocultar] of casos) {
    const d = doble({ edge: { status, cuerpo: { error } } });
    const r = await d.ctl.invitar(501, INV);
    assert.equal(r.ok, false, error); assert.equal(r.codigo, error); assert.match(r.mensaje, re); assert.equal(!!r.ocultar, ocultar, error);
    assert.equal(d.campana, 0);
  }
});
test('2h respuestas raras: 405 {error:"metodo"}, 403 sin cuerpo, 200 sin ok y red caída', async () => {
  let d = doble({ edge: { status: 405, cuerpo: { error: 'metodo' } } });
  assert.equal((await d.ctl.invitar(501, INV)).codigo, 'MC_ERROR');
  d = doble({ edge: { status: 403, cuerpo: {} } });
  const r = await d.ctl.invitar(501, INV);
  assert.equal(r.codigo, 'MC_SIN_PERMISO'); assert.equal(r.ocultar, true);
  d = doble({ edge: { status: 200, cuerpo: { resultado: 'cuenta_creada' } } });
  assert.equal((await d.ctl.invitar(501, INV)).ok, false);
  d = doble({ edge: err('RED') });
  assert.match((await d.ctl.invitar(501, INV)).mensaje, /conexión/);
});

/* ── 3. Reenviar (incluye H-AUTH-3) ── */
const INVITADO = fila({ ref: REF1, estado_cuenta: 'invitada' });
test('3a reenviar: contrato exacto (accion reenviar, correo normalizado, rol de la fila, motivo)', async () => {
  const d = doble({ edge: { status: 200, cuerpo: { ok: true, resultado: 'reenviada' } } });
  const r = await d.ctl.reenviar(501, { ...INVITADO, correo: 'Titular@Panaderia-Ficticia.test' }, 'Reenvío de la invitación');
  assert.equal(r.tipo, 'exito'); assert.match(r.mensaje, /reenviada/);
  assert.deepEqual(d.llamadas[0][2], { accion: 'reenviar', cliente_id: 501, correo: 'titular@panaderia-ficticia.test', rol: 'titular', motivo: 'Reenvío de la invitación' });
});
test('3b ya_reenviada (idempotencia de 2 min) → aviso', async () => {
  const d = doble({ edge: { status: 200, cuerpo: { ok: true, resultado: 'ya_reenviada' } } });
  const r = await d.ctl.reenviar(501, INVITADO, 'Reenvío');
  assert.equal(r.tipo, 'aviso'); assert.match(r.mensaje, /menos de 2 minutos/);
});
test('3c H-AUTH-3: 502 MC_CORREO_NO_ENVIADO (no se pudo marcar la metadata) → "no se envió nada"', async () => {
  const d = doble({ edge: { status: 502, cuerpo: { error: 'MC_CORREO_NO_ENVIADO' } } });
  const r = await d.ctl.reenviar(501, INVITADO, 'Reenvío');
  assert.equal(r.ok, false); assert.match(r.mensaje, /No se envió nada al cliente/);
});
test('3d 409 MC_YA_ACTIVA, MC_SIN_VINCULO_VIGENTE, MC_NADA_QUE_REENVIAR', async () => {
  for (const [c, re] of [['MC_YA_ACTIVA', /ya activó/], ['MC_SIN_VINCULO_VIGENTE', /ya no tiene un acceso vigente/], ['MC_NADA_QUE_REENVIAR', /No hay una invitación pendiente/]]) {
    const d = doble({ edge: { status: 409, cuerpo: { error: c } } });
    assert.match((await d.ctl.reenviar(501, INVITADO, 'Reenvío')).mensaje, re);
  }
});
test('3e reenviar sin motivo válido → no llama a la Edge', async () => {
  const d = doble({ edge: { status: 200, cuerpo: { ok: true, resultado: 'reenviada' } } });
  const r = await d.ctl.reenviar(501, INVITADO, ' a ');
  assert.equal(r.ok, false); assert.ok(r.errores.motivo); assert.equal(d.llamadas.length, 0);
});

/* ── 4. Revocar ── */
test('4a revocar: llama a mc_acceso_revocar(p_ref, p_motivo) y recarga la campana; mensaje según cuenta_revocada', async () => {
  let d = doble({ mc_acceso_revocar: { ok: true, cuenta_revocada: false } });
  let r = await d.ctl.revocar(fila({ ref: REF2 }), '  Ya no trabaja en la empresa  ');
  assert.deepEqual(d.llamadas[0], ['rpc', 'mc_acceso_revocar', { p_ref: REF2, p_motivo: 'Ya no trabaja en la empresa' }]);
  assert.match(r.mensaje, /conserva sus otras empresas/); assert.equal(d.campana, 1);
  d = doble({ mc_acceso_revocar: { ok: true, cuenta_revocada: true } });
  r = await d.ctl.revocar(fila({ ref: REF2 }), 'Término del servicio');
  assert.match(r.mensaje, /cuenta de MiContadoor quedó cerrada/);
});
test('4b revocar: motivo corto o ref inválida → sin llamada; MC_NO_ENCONTRADO pide recargar; MC_SIN_PERMISO oculta', async () => {
  let d = doble({ mc_acceso_revocar: { ok: true } });
  assert.equal((await d.ctl.revocar(fila(), 'no')).ok, false);
  assert.equal((await d.ctl.revocar(fila({ ref: 'no-es-uuid' }), 'Motivo válido')).ok, false);
  assert.equal(d.llamadas.length, 0);
  d = doble({ mc_acceso_revocar: err('MC_NO_ENCONTRADO') });
  let r = await d.ctl.revocar(fila(), 'Motivo válido');
  assert.equal(r.recargar, true); assert.match(r.mensaje, /ya no está vigente/);
  d = doble({ mc_acceso_revocar: err('MC_SIN_PERMISO') });
  r = await d.ctl.revocar(fila(), 'Motivo válido');
  assert.equal(r.ocultar, true); assert.equal(d.campana, 0);
});

/* ── 5. Permisos ── */
test('5a permisos: llama a mc_acceso_permisos con booleanos y motivo', async () => {
  const d = doble({ mc_acceso_permisos: { ok: true } });
  const r = await d.ctl.permisos(fila({ ref: REF3 }), false, true, 'El encargado pide que vea las facturas');
  assert.equal(r.ok, true);
  assert.deepEqual(d.llamadas[0], ['rpc', 'mc_acceso_permisos', { p_ref: REF3, p_ver_mi_cuenta: false, p_ver_facturas: true, p_motivo: 'El encargado pide que vea las facturas' }]);
});
test('5b permisos: valores no booleanos o motivo vacío → sin llamada; MC_DATOS del servidor → mensaje', async () => {
  let d = doble({ mc_acceso_permisos: { ok: true } });
  assert.equal((await d.ctl.permisos(fila(), 'si', true, 'Motivo válido')).ok, false);
  assert.equal((await d.ctl.permisos(fila(), true, true, '')).ok, false);
  assert.equal(d.llamadas.length, 0);
  d = doble({ mc_acceso_permisos: err('MC_DATOS') });
  assert.match((await d.ctl.permisos(fila(), true, true, 'Motivo válido')).mensaje, /Revisa los datos/);
});

/* ── 6. Reactivar ── */
test('6a reactivar = alta con el mismo correo/rol y conserva los permisos que tenía', async () => {
  const rev = fila({ ref: REF1, rol: 'consulta', ver_mi_cuenta: true, ver_facturas: false, estado_acceso: 'revocado', estado_cuenta: 'activa', revocado_at: '2026-11-10T12:00:00Z' });
  const d = doble({ edge: { status: 200, cuerpo: { ok: true, resultado: 'empresa_vinculada', acceso_ref: NUEVA } }, mc_acceso_permisos: { ok: true } });
  const r = await d.ctl.reactivar(501, rev, 'Vuelve a trabajar con la empresa');
  assert.equal(r.ok, true); assert.match(r.mensaje, /Acceso reactivado/);
  assert.deepEqual(d.llamadas[0][2], { accion: 'invitar', cliente_id: 501, correo: rev.correo, nombre: 'Ana Ficticia', rol: 'consulta', motivo: 'Vuelve a trabajar con la empresa' });
  assert.deepEqual(d.llamadas[1], ['rpc', 'mc_acceso_permisos', { p_ref: NUEVA, p_ver_mi_cuenta: true, p_ver_facturas: false, p_motivo: 'Vuelve a trabajar con la empresa' }]);
});
test('6b reactivar con la cuenta cerrada → el servidor responde 409 MC_CUENTA_NO_VIGENTE y se muestra claro', async () => {
  const d = doble({ edge: { status: 409, cuerpo: { error: 'MC_CUENTA_NO_VIGENTE' } } });
  const r = await d.ctl.reactivar(501, fila({ estado_acceso: 'revocado' }), 'Motivo válido');
  assert.equal(r.ok, false); assert.match(r.mensaje, /suspendida o cerrada/);
});

/* ── 7. Doble clic ── */
test('7 dos acciones a la vez → la segunda se rechaza sin llamar al servidor', async () => {
  let soltar; const espera = new Promise((r) => { soltar = r; });
  const d = doble({ edge: () => espera.then(() => ({ status: 200, cuerpo: { ok: true, resultado: 'cuenta_creada', acceso_ref: NUEVA } })) });
  const p1 = d.ctl.invitar(501, INV);
  const r2 = await d.ctl.invitar(501, INV);
  assert.equal(r2.codigo, 'OCUPADO');
  soltar(); assert.equal((await p1).ok, true);
  assert.equal(d.llamadas.length, 1);
  assert.equal((await d.ctl.revocar(fila(), 'x')).codigo, 'VALIDACION', 'después de terminar se libera');
});

/* ── 8. Estados y acciones ── */
test('8 estado visible y acciones por estado (no Master)', () => {
  const casos = [
    [fila({ estado_cuenta: 'invitada' }), 'invitado', ['reenviar', 'permisos', 'cerrar_sesiones', 'revocar']],
    [fila({ estado_cuenta: 'activa' }), 'activo', ['permisos', 'cerrar_sesiones', 'revocar']],
    [fila({ estado_cuenta: 'suspendida' }), 'suspendido', ['permisos', 'revocar']],
    [fila({ estado_acceso: 'revocado', estado_cuenta: 'activa' }), 'revocado', ['reactivar']],
    [fila({ estado_acceso: 'revocado', estado_cuenta: 'invitada' }), 'revocado', ['reactivar']],
    [fila({ estado_acceso: 'revocado', estado_cuenta: 'revocada' }), 'revocado', []],
    [fila({ estado_acceso: 'revocado', estado_cuenta: 'suspendida' }), 'revocado', []],
    [fila({ estado_acceso: 'otro' }), 'desconocido', []],
    [fila({ estado_cuenta: 'rara' }), 'desconocido', []],
    [fila({ ref: 'x' }), 'invitado', []]
  ];
  for (const [a, est, acc] of casos) {
    assert.equal(M.estadoVisible(a).clave, est, JSON.stringify(a).slice(0, 80));
    assert.deepEqual(M.accionesPara(a, [a]).acciones, acc, JSON.stringify(a).slice(0, 80));
  }
  assert.match(M.accionesPara(fila({ estado_acceso: 'revocado', estado_cuenta: 'revocada' }), []).nota, /Solo el Master puede reabrirla/);
  // Revocado con otro acceso VIGENTE del mismo correo (re-otorgado): sin "Reactivar".
  const rev = fila({ ref: REF1, estado_acceso: 'revocado', estado_cuenta: 'activa' }), vig = fila({ ref: REF2, estado_cuenta: 'activa', correo: 'TITULAR@panaderia-ficticia.test' });
  const r = M.accionesPara(rev, [vig, rev]);
  assert.deepEqual(r.acciones, []); assert.match(r.nota, /ya tiene un acceso vigente/);
  assert.deepEqual(M.permisosPorDefecto('titular'), { ver_mi_cuenta: true, ver_facturas: true });
  assert.deepEqual(M.permisosPorDefecto('consulta'), { ver_mi_cuenta: false, ver_facturas: false });
});

/* ── 9. Vista ── */
test('9a la vista escapa todo lo que viene de la base', () => {
  const malo = fila({ nombre: '<img src=x onerror=alert(1)>', correo: '"><script>alert(2)</script>@x.test' });
  const h = M.renderSeccion({ visible: true, accesos: [malo] });
  assert.ok(!h.includes('<img src=x') && !h.includes('<script>'));
  assert.ok(h.includes('&lt;img src=x onerror=alert(1)&gt;'));
});
test('9b vigentes, luego «Revocados»; estados, último ingreso, íconos en <i class="ic …"> y botones por estado', () => {
  const acc = M.ordenar([
    fila({ ref: REF1, estado_acceso: 'revocado', estado_cuenta: 'revocada', revocado_at: '2026-11-11T15:00:00Z', correo: 'ex@empresa-ficticia.test' }),
    fila({ ref: REF2, estado_cuenta: 'activa', ultimo_ingreso_at: '2026-11-13T15:30:00Z' }),
    fila({ ref: REF3, rol: 'consulta', ver_mi_cuenta: false, ver_facturas: false, correo: 'apoyo@empresa-ficticia.test', nombre: null })
  ]);
  const h = M.renderSeccion({ visible: true, accesos: acc }, (n) => '<svg data-n="' + n + '"></svg>');
  assert.ok(h.indexOf('Activo') < h.indexOf('Revocados'));
  assert.match(h, /Último ingreso: 13-11-2026 · 12:30/);           // 15:30 UTC = 12:30 en Chile (UTC−3)
  assert.match(h, /Aún no ingresa/);
  assert.match(h, /Adicional \(consulta\)/);
  assert.match(h, /2 vigentes/);
  assert.equal((h.match(/data-mca-accion="revocar"/g) || []).length, 2);
  assert.equal((h.match(/data-mca-accion="reenviar"/g) || []).length, 1);
  assert.equal((h.match(/data-mca-accion="reactivar"/g) || []).length, 0);
  assert.match(h, /cuenta quedó cerrada/);
  assert.equal((h.match(/data-mca-accion="cerrar_sesiones"/g) || []).length, 2);
  assert.equal((h.match(/data-mca-accion="suspender"/g) || []).length, 0, 'suspender solo para el Master');
  assert.ok(/<i class="ic ic-cel mca-placa"><svg data-n="llave">/.test(h));
  const sinIc = h.replace(/<i class="ic[^"]*"><svg[^>]*><\/svg><\/i>/g, '');
  assert.ok(!/<svg/.test(sinIc), 'todo ícono va dentro de <i class="ic">');
});
test('9c vacío, cargando y error: "Invitar persona" deshabilitado mientras carga o con error', () => {
  assert.match(M.renderSeccion({ visible: true, accesos: [] }), /aún no tiene accesos/);
  assert.match(M.renderSeccion({ visible: true, cargando: true }), /data-mca-accion="invitar" disabled/);
  assert.match(M.renderSeccion({ visible: true, error: 'x' }), /data-mca-accion="invitar" disabled/);
});

/* ── 10. Adaptador real (sbFetch / sbH de supabase.js) ── */
const resp = (status, cuerpo) => ({ status, ok: status >= 200 && status < 300, text: () => Promise.resolve(cuerpo === undefined ? '' : JSON.stringify(cuerpo)) });
test('10a rpc: POST a rpc/<fn> por sbFetch; error PostgREST {code:42501,message:MC_SIN_PERMISO} → codigo', async () => {
  const vistos = [];
  const api = M.crearApiReal({ sbFetch: (p, o) => { vistos.push([p, o]); return Promise.resolve(resp(400, { code: '42501', message: 'MC_SIN_PERMISO', details: null })); } });
  await assert.rejects(api.rpc('mc_yo'), (e) => e.codigo === 'MC_SIN_PERMISO');
  assert.equal(vistos[0][0], 'rpc/mc_yo'); assert.equal(vistos[0][1].method, 'POST'); assert.equal(vistos[0][1].body, '{}');
  assert.ok(!('Authorization' in vistos[0][1].headers), 'el JWT lo pone sbFetch, no el módulo');
});
test('10b rpc: 403 sin cuerpo → MC_SIN_PERMISO; 401 → NO_SESSION; GESTOOR_NO_SESSION → NO_SESSION; red → RED; ok → JSON', async () => {
  const con = (f) => M.crearApiReal({ sbFetch: f });
  await assert.rejects(con(() => Promise.resolve(resp(403))).rpc('mc_yo'), (e) => e.codigo === 'MC_SIN_PERMISO');
  await assert.rejects(con(() => Promise.resolve(resp(401))).rpc('mc_yo'), (e) => e.codigo === 'NO_SESSION');
  await assert.rejects(con(() => Promise.reject(new Error('GESTOOR_NO_SESSION'))).rpc('mc_yo'), (e) => e.codigo === 'NO_SESSION');
  await assert.rejects(con(() => Promise.reject(new TypeError('Failed to fetch'))).rpc('mc_yo'), (e) => e.codigo === 'RED');
  assert.deepEqual(await con(() => Promise.resolve(resp(200, [{ ref: REF1 }]))).rpc('mc_accesos_listar', { p_cliente_id: 1 }), [{ ref: REF1 }]);
});
test('10c rpc: solo funciones mc_* (nada de tablas ni otras RPC)', async () => {
  const api = M.crearApiReal({ sbFetch: () => { throw new Error('no debía llamarse'); } });
  for (const fn of ['clientes', 'rpc/mc_yo', 'cot_yo', 'mc_yo;drop', '../x']) await assert.rejects(api.rpc(fn), (e) => e.codigo === 'MC_ERROR');
});
test('10d edge: POST a SB_URL/functions/v1/mc-invitar con los encabezados de sbH; sin sesión → 401 y aviso a auth.js', async () => {
  const vistos = []; let aviso = null;
  const api = M.crearApiReal({ SB_URL: 'https://proyecto-ficticio.supabase.test', sbH: (x) => Object.assign({}, x, { apikey: 'k', Authorization: 'Bearer jwt-ficticio' }),
    fetch: (u, o) => { vistos.push([u, o]); return Promise.resolve(resp(409, { error: 'MC_CORREO_NO_DISPONIBLE' })); } });
  const r = await api.edge({ accion: 'invitar' });
  assert.deepEqual(r, { status: 409, cuerpo: { error: 'MC_CORREO_NO_DISPONIBLE' } });
  assert.equal(vistos[0][0], 'https://proyecto-ficticio.supabase.test/functions/v1/mc-invitar');
  assert.equal(vistos[0][1].method, 'POST'); assert.equal(vistos[0][1].headers.Authorization, 'Bearer jwt-ficticio');
  const sin = M.crearApiReal({ sbH: () => { throw new Error('GESTOOR_NO_SESSION'); }, fetch: () => { throw new Error('no debía llamarse'); }, avisarSinSesion: (p) => { aviso = p; } });
  assert.deepEqual(await sin.edge({}), { status: 401, cuerpo: { error: 'NO_SESSION' } });
  assert.equal(aviso, 'functions/v1/mc-invitar');
  const caida = M.crearApiReal({ SB_URL: 'x', sbH: () => ({}), fetch: () => Promise.reject(new TypeError('Failed to fetch')) });
  await assert.rejects(caida.edge({}), (e) => e.codigo === 'RED');
});

/* ── 11. Estándar de módulo y repo público ── */
test('11a clientes/index.html: auth-pending, supabase.js → mc-accesos.js → script del módulo; auth.js al final; montaje en la ficha', () => {
  const html = leer('clientes/index.html');
  assert.ok(html.includes('<html lang="es" class="auth-pending">') && html.includes('id="gestoor-auth-guard"'));
  const iSb = html.indexOf('<script src="../supabase.js">'), iMc = html.indexOf('<script src="mc-accesos.js">'), iMod = html.indexOf("console.info('[Clientes]");
  assert.ok(iSb > 0 && iSb < iMc && iMc < iMod, 'orden de scripts');
  assert.ok(html.lastIndexOf('<script src="../auth.js">') > iMod);
  assert.ok(html.includes('href="mc-accesos.css"'));
  assert.ok(html.includes(`h += '<div id="det-mc"></div>';`), 'contenedor det-mc en la ficha');
  assert.ok(/window\.MCAccesos\.montar\(g\('det-mc'\), \{ id: c\.id, razon: c\.razon \}\)/.test(html));
  assert.ok(/function cerrarDetalle\(\) \{[^\n]*if \(window\.MCAccesos\) MCAccesos\.cerrarDialogo\(\); g\('modalDetalle'\)\.classList\.remove\('on'\)/.test(html), 'al cerrar la ficha se cierra el diálogo');
});
test('11b el módulo no usa la clave anon, sbH propio, console.log, localStorage ni otras RPC/Edge', () => {
  const js = leer('clientes/mc-accesos.js');
  assert.ok(!/SB_KEY|apikey|anon|service_role/i.test(js.replace(/clave anon como Bearer/g, '')));
  assert.ok(!/function sbH|function sbFetch|console\.(log|info|warn|error)|localStorage|sessionStorage/.test(js));
  const rpcs = [...new Set([...js.matchAll(/'(mc_[a-z_]+)'/g)].map((m) => m[1]))].sort();
  assert.deepEqual(rpcs, ['mc_acceso_permisos', 'mc_acceso_revocar', 'mc_accesos_listar', 'mc_cuenta_estado_por_ref', 'mc_yo']);
  assert.ok(js.includes("var EDGE = 'mc-invitar'") && !/functions\/v1\/(?!' \+ EDGE)/.test(js));
});
test('11c sin datos reales: ni correos ni RUT en el módulo, la hoja de estilos ni esta prueba', () => {
  for (const f of ['clientes/mc-accesos.js', 'clientes/mc-accesos.css', 'pruebas/mc_accesos.test.mjs']) {
    const s = leer(f);
    const correos = [...s.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g)].map((m) => m[0]).filter((c) => !/\.test$|@empresa\.cl$/i.test(c));
    assert.deepEqual(correos, [], f);
    assert.ok(!/contadoor\.cl'?\s*[,;]|\b\d{1,2}\.\d{3}\.\d{3}-[\dkK]\b/.test(s.replace(/mi\.contadoor\.cl/g, '')), f);
  }
});
test('11d todos los códigos que puede devolver la Edge o las RPC tienen texto', () => {
  for (const c of ['MC_SIN_PERMISO', 'MC_DATOS', 'MC_LIMITE', 'MC_CORREO_NO_DISPONIBLE', 'MC_CUENTA_NO_VIGENTE', 'MC_YA_ACTIVA', 'MC_SIN_VINCULO_VIGENTE',
    'MC_NADA_QUE_REENVIAR', 'MC_CORREO_NO_ENVIADO', 'MC_SOLO_SUSPENDIDA', 'MC_ERROR', 'MC_NO_ENCONTRADO', 'NO_SESSION']) assert.ok(M.MENSAJES[c], c);
  assert.equal(M.codigoDe({ code: 'P0002', message: 'MC_NO_ENCONTRADO' }), 'MC_NO_ENCONTRADO');
  assert.equal(M.codigoDe({ error: 'NO_SESSION' }), 'NO_SESSION');
  assert.equal(M.codigoDe({ message: 'otra cosa' }), null);
});

/* ── 12. Cruce con el backend (opcional, solo lectura de archivos) ── */
const BE = process.env.BACKEND;
test('12 contrato con MC1B y mc-invitar (BACKEND=…)', { skip: !BE || !existsSync(BE + '/supabase/migrations/202611081410_mc1b_esquema_mc.sql') }, () => {
  const mig = readFileSync(BE + '/supabase/migrations/202611081410_mc1b_esquema_mc.sql', 'utf8');
  const firmas = { mc_yo: '()', mc_accesos_listar: '(p_cliente_id bigint)', mc_acceso_revocar: '(p_ref uuid, p_motivo text)',
    mc_acceso_permisos: '(p_ref uuid, p_ver_mi_cuenta boolean, p_ver_facturas boolean, p_motivo text)' };
  for (const [fn, f] of Object.entries(firmas)) assert.ok(mig.includes('CREATE FUNCTION public.' + fn + f), fn);
  const grant = mig.slice(mig.lastIndexOf('GRANT EXECUTE ON FUNCTION public.mc_yo()'));
  for (const fn of Object.keys(firmas)) assert.ok(new RegExp('public\\.' + fn + '\\([^)]*\\)[\\s\\S]*TO authenticated').test(grant), fn + ' GRANT authenticated');
  for (const k of ['ref', 'correo', 'nombre', 'rol', 'ver_mi_cuenta', 'ver_facturas', 'estado_acceso', 'estado_cuenta', 'otorgado_at', 'revocado_at', 'ultimo_ingreso_at'])
    assert.ok(mig.includes("'" + k + "'"), 'mc_accesos_listar devuelve ' + k);
  const man = readFileSync(BE + '/supabase/functions/mc-invitar/manejador.ts', 'utf8');
  assert.ok(man.includes("new Set(['accion', 'cliente_id', 'correo', 'nombre', 'rol', 'motivo'])"), 'lista blanca de la Edge');
  for (const c of [...man.matchAll(/(MC_[A-Z_]+)/g)].map((m) => m[1])) assert.ok(M.MENSAJES[c] || c === 'MC_RPC_', 'texto para ' + c);
  assert.ok(man.includes("json(502, { error: 'MC_CORREO_NO_ENVIADO' })"), 'H-AUTH-3 responde 502');
  const d = BE + '/supabase/migrations/202611131400_mc1d_accesos_ciclo.sql';
  if (existsSync(d)) {
    const m1d = readFileSync(d, 'utf8');
    assert.ok(m1d.includes('CREATE FUNCTION public.mc_cuenta_estado_por_ref(p_ref uuid, p_accion text, p_motivo text)'), 'MC1D: firma por_ref');
    assert.ok(/GRANT EXECUTE ON FUNCTION public\.mc_cuenta_estado_por_ref\(uuid, text, text\) TO authenticated/.test(m1d), 'MC1D: GRANT authenticated');
    assert.ok(m1d.includes("'cuenta_reabierta'"), 'MC1D: resultado cuenta_reabierta');
  }
});

/* ── 13. MC1D (MICONTADOOR-APERTURA): Master suspende / reactiva / reabre; todos los que dan altas cierran sesiones ── */
test('13a acciones del Master: suspender en vigentes, reactivar cuenta suspendida, reabrir cuenta revocada', () => {
  const M1 = (a, l) => M.accionesPara(a, l || [a], true).acciones;
  assert.deepEqual(M1(fila({ estado_cuenta: 'invitada' })), ['reenviar', 'permisos', 'cerrar_sesiones', 'suspender', 'revocar']);
  assert.deepEqual(M1(fila({ estado_cuenta: 'activa' })), ['permisos', 'cerrar_sesiones', 'suspender', 'revocar']);
  assert.deepEqual(M1(fila({ estado_cuenta: 'suspendida' })), ['reactivar_cuenta', 'permisos', 'revocar']);
  const rev = fila({ estado_acceso: 'revocado', estado_cuenta: 'revocada' });
  assert.deepEqual(M1(rev), ['reactivar']);
  assert.match(M.accionesPara(rev, [rev], true).nota, /Como Master puedes reabrirla/);
  assert.deepEqual(M.accionesPara(fila({ estado_cuenta: 'suspendida' }), [], false).acciones, ['permisos', 'revocar'], 'no Master: sin reactivar cuenta');
  assert.deepEqual(M1(fila({ estado_acceso: 'revocado', estado_cuenta: 'suspendida' })), [], 'suspendida y revocado: sin botón');
});
test('13b cuentaEstado llama mc_cuenta_estado_por_ref con el ref opaco y valida motivo/acción', async () => {
  const d = doble({ mc_cuenta_estado_por_ref: { ok: true } });
  const r = await d.ctl.cuentaEstado(fila({ estado_cuenta: 'activa' }), 'suspender', '  Sospecha de uso indebido ');
  assert.equal(r.ok, true); assert.match(r.mensaje, /Cuenta suspendida/); assert.equal(d.campana, 1);
  assert.deepEqual(d.llamadas[0], ['rpc', 'mc_cuenta_estado_por_ref', { p_ref: REF1, p_accion: 'suspender', p_motivo: 'Sospecha de uso indebido' }]);
  assert.equal((await d.ctl.cuentaEstado(fila(), 'borrar', 'motivo válido')).codigo, 'MC_DATOS');
  assert.equal((await d.ctl.cuentaEstado(fila({ ref: 'x' }), 'suspender', 'motivo válido')).codigo, 'MC_DATOS');
  assert.equal((await d.ctl.cuentaEstado(fila(), 'cerrar_sesiones', 'no')).codigo, 'VALIDACION');
  assert.equal(d.llamadas.length, 1);
  assert.match((await d.ctl.cuentaEstado(fila(), 'cerrar_sesiones', 'Perdió el celular')).mensaje, /Sesiones cerradas/);
  assert.match((await d.ctl.cuentaEstado(fila({ estado_cuenta: 'suspendida' }), 'reactivar', 'Se aclaró')).mensaje, /Cuenta reactivada/);
});
test('13c errores de mc_cuenta_estado_por_ref: sin permiso oculta; solo suspendida y no encontrado tienen texto', async () => {
  let r = await doble({ mc_cuenta_estado_por_ref: err('MC_SIN_PERMISO') }).ctl.cuentaEstado(fila(), 'suspender', 'Motivo de prueba');
  assert.equal(r.ocultar, true);
  r = await doble({ mc_cuenta_estado_por_ref: err('MC_SOLO_SUSPENDIDA') }).ctl.cuentaEstado(fila(), 'reactivar', 'Motivo de prueba');
  assert.match(r.mensaje, /Solo se puede reactivar una cuenta suspendida/);
  r = await doble({ mc_cuenta_estado_por_ref: err('MC_NO_ENCONTRADO') }).ctl.cuentaEstado(fila(), 'cerrar_sesiones', 'Motivo de prueba');
  assert.equal(r.recargar, true);
});
test('13d reactivar con cuenta reabierta por el Master: resultado cuenta_reabierta tiene su texto', async () => {
  const d = doble({ edge: { status: 200, cuerpo: { ok: true, resultado: 'cuenta_reabierta', acceso_ref: NUEVA } } });
  const r = await d.ctl.reactivar(501, fila({ estado_acceso: 'revocado', estado_cuenta: 'revocada' }), 'Vuelve al servicio');
  assert.equal(r.ok, true); assert.equal(r.tipo, 'exito'); assert.match(r.mensaje, /el Master reabrió la cuenta/);
  assert.equal(d.llamadas[0][1], 'invitar');
});
test('13e términos por acceso: solo si vienen los campos; pendientes en ámbar; revocados sin chip', () => {
  assert.equal(M.terminosTexto(fila()), null);
  assert.match(M.terminosTexto(fila({ terminos_al_dia: true, terminos_version: '2026-11-16' })).texto, /aceptados \(versión 2026-11-16\)/);
  assert.match(M.terminosTexto(fila({ terminos_al_dia: false, terminos_version: '2026-11-16' })).texto, /términos nuevos/);
  assert.match(M.terminosTexto(fila({ terminos_al_dia: false, terminos_version: null })).texto, /Aún no acepta/);
  const h = M.renderSeccion({ visible: true, es_master: true, accesos: [fila({ estado_cuenta: 'activa', terminos_al_dia: false, terminos_version: null }),
    fila({ ref: REF2, estado_acceso: 'revocado', estado_cuenta: 'activa', terminos_al_dia: true, correo: 'otra@empresa-ficticia.test' })] });
  assert.equal((h.match(/class="mca-term /g) || []).length, 1);
  assert.match(h, /data-mca-accion="suspender"/);
  assert.ok(!h.includes('<script'));
});
