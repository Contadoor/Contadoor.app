// node --test reportes-contable/validar-iva.test.js  (datos 100 % ficticios, sin red)
// 19-11 (Luciano, regla definitiva): el IVA del PERÍODO CONTABLE se valida en Contable («✅ Validar IVA de <mes>» de la tarjeta
// «Cálculo del F29»), no en el Pre-IVA (estimado del mes en curso). Estas pruebas corren las funciones REALES de reportes-contable/index.html
// (extraídas del HTML a un vm) y comprueban que escriben EXACTAMENTE lo mismo que antes:
//   · reportes_mensuales = el PATCH de siempre de guardarF29 (estado_contable 'completado'), armado con IvaValidacion.patchReporte;
//   · preiva_historial  = la fila que guardaba el Pre-IVA (filaDesdePantalla) + fecha_envio/enviado_por (como su «envío») + validacion_iva.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const F = require('../pre-iva/f29-formula.js');
const S = require('../pre-iva/sii-cartapra.js');
const V = require('../pre-iva/iva-validacion.js');
const C = require('./calculo-f29.js');

const HTML = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
function extraer(nombre) {
  const i = HTML.indexOf('function ' + nombre + '(');
  assert.ok(i >= 0, 'no existe ' + nombre);
  let k = HTML.indexOf('{', i), prof = 0;
  for (; k < HTML.length; k++) { if (HTML[k] === '{') prof++; else if (HTML[k] === '}') { prof--; if (prof === 0) break; } }
  return HTML.slice(i, k + 1);
}

// ── Lo que escribían ANTES (copia literal del código previo a este cambio, para comparar payloads) ──
function patchAntesGuardarF29(m) {   // guardarF29() antes del 19-11 (campos del modal)
  var deb = m.deb, cred = m.cred, rem = m.rem, ivaResult = deb - cred - rem, postergado = m.postergado, remanente = ivaResult < 0 ? Math.abs(ivaResult) : 0;
  return { debito_iva: deb, credito_iva: cred, iva_remanente_sig: remanente, remanente: remanente, iva_postergado: postergado ? Math.max(0, ivaResult) : 0,
    postergar_iva: postergado, iva_fecha_venc: m.fechaVencPostergado, ppm_base: m.ppmBase, ppm_tasa: m.tasa, ppm: m.ppm, ret_hon: m.retHon, otros_imp: m.otrosImp,
    obs_cont: m.obs || null, estado_contable: 'completado', listo_panel_control: false };
}
function filaAntesPreIva(d) {   // filaDesdePantalla() del Pre-IVA antes del 19-11
  return { cliente_rut: d.rut, periodo: d.periodo, debito_iva: d.deb, credito_iva: d.cred, remanente: d.rem, f29: d.f29, ppm: d.ppm, tasa_ppm: d.tasa,
    neto_ventas: d.netoVentas || 0, neto_compras: d.netoCompras || 0, por_tipo_doc_ventas: d.porTipoVentas || {}, por_tipo_doc_compras: d.porTipoCompras || {},
    fuente_montos: d.fuente || null, sii_datos_al: S.registro(d.sii, d.fuente).sii_datos_al,
    sii_detalle: F.detalleConEdicionPPM(S.registro(d.sii, d.fuente).sii_detalle, d.ed) };
}

// ── Datos ficticios: octubre 2026 (período contable), remanente de septiembre 101.000 en SII y en Contable ──
const RUT = '76000000-0';
const RAW = { conexion: { estado: 'conectada' }, datos_al: '2026-11-19T10:00:00Z', avisos: [], cobertura: { rcv_ventas: 'completa', rcv_compras: 'completa', honorarios: 'completa' },
  ventas: { documentos: 5, neto: 10000000, exento: 500000, iva: 1900000, total: 12400000, por_tipo: { 33: { n: 5 } } },
  compras: { registro: { documentos: 3, neto: 4000000, exento: 0, iva: 760000, total: 4760000 }, pendiente: { documentos: 0, iva: 0 }, por_tipo: { 33: { n: 3 } } },
  honorarios: { honorarios_recibidos: { documentos: 2, bruto: 500000, retencion: 68750 } },
  remanente_anterior: { periodo: '2026-09', folio: 123, cod77: 100000, cod504: 101000, fuente: 'sii_codigo_77', mes_utm_origen: '2026-10', mes_utm_destino: '2026-11', utm_origen: 69000, utm_destino: 69690, falta_utm: [] } };
const INFO_OK = { estado: 'CONOCIDO', fuente: 'MES_ANTERIOR', cod77: 100000, cod504: 101000, utm_origen: 69000, utm_destino: 69690, mes_utm_origen: '2026-10', mes_utm_destino: '2026-11', periodo: '2026-10', periodo_anterior: '2026-09' };
const LIBROS = { ventas: { estado: 'validado', totalIva: 1900000, totalNeto: 10000000, totalExento: 500000 }, compras: { estado: 'validado', totalIva: 760000 } };
const ED = { tasa: 1.25, monto: null, motivo: 'Nueva tasa informada por el SII', por: 'Analista Prueba', at: '2026-11-18T12:00:00Z', calculado: 157500, tasa_calculada: 1.5 };

function entorno(o = {}) {
  const peticiones = [], dialogos = [], notifs = [];
  const rep = Object.assign({ id: 555, rut: RUT, periodo: '2026-10', estadoContable: 'pendiente', listoPanelControl: false, libros: LIBROS, iuSii: 45000, f29: {} }, o.rep || {});
  const cli = Object.assign({ id: 9001, rut: RUT, razon: 'Empresa Ficticia SpA', iva: 'afecto', honorariosContables: 'no_aplica', tieneRrhh: true }, o.cli || {});
  const respuestas = o.respuestas || {};
  const ctx = {
    console, JSON, Math, Number, String, Object, Array, Promise, Date, RegExp, isFinite, parseFloat, parseInt,
    document: { getElementById: () => null },
    _periodoActual: '2026-10', _librosMap: {}, GestoorSII: { estadoCliente: (id) => (o.conectada && Number(id) === 9001 ? 'conectada' : null) }, _remanentes: { periodo: '2026-10', lecturaOk: true, porRut: { [RUT]: o.info === undefined ? INFO_OK : o.info } },
    _reportes: [rep], getReportes: () => ctx._reportes, setReportes: (r) => { ctx._reportes = r; }, getClientes: () => [cli],
    getUsuario: () => ({ nombre: 'Analista Prueba', email: 'analista@example.invalid', rol: 'contable' }),
    sbRowToReporte: (f) => ({ id: f.id, rut: RUT, periodo: '2026-10', estadoContable: f.estado_contable, listoPanelControl: f.listo_panel_control, f29: {} }),
    setRemanente: () => {}, renderTabla: () => { ctx._render = (ctx._render || 0) + 1; }, restaurarFilaAbierta: () => {},
    crearNotificacion: (n) => notifs.push(n), confirm: (t) => { dialogos.push(t); return o.confirmar !== false; }, alert: (t) => dialogos.push(t),
    sbFetch: (p, opts) => {
      peticiones.push({ path: p, method: (opts && opts.method) || 'GET', body: opts && opts.body ? JSON.parse(opts.body) : null, headers: opts && opts.headers });
      const r = Object.keys(respuestas).find((k) => p.indexOf(k) === 0);
      const def = r ? respuestas[r](p, opts) : (/^reportes_mensuales\?id=eq\./.test(p) && opts.method === 'PATCH' ? { status: 200, body: [Object.assign({ id: 555 }, JSON.parse(opts.body))] } : { status: 200, body: [{ ok: 1 }] });
      return Promise.resolve({ ok: def.status < 400, status: def.status, json: () => Promise.resolve(def.body), text: () => Promise.resolve(JSON.stringify(def.body)) });
    }
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'assets', 'remanente-anterior.js'), 'utf8'), ctx);
  for (const f of ['f29-formula.js', 'sii-cartapra.js', 'iva-validacion.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'pre-iva', f), 'utf8'), ctx);
  vm.runInContext(['ff', 'siiConectado', 'librosListos', 'periodoAnterior', 'normalizarRutContable', 'buildBorradorF29', 'infoRemanenteAnterior', 'remMensajeError', 'validarCierrePreF29', 'sbPatchReporteDetallado',
    'guardarFilaReporteLocal', '_cf29Ctx', '_cf29Refrescar', 'pendientesValidarIva', 'validarIvaDesdeTarjeta', 'guardarPPMDesdeTarjeta', 'remanenteManualDesdeTarjeta'].map(extraer).join('\n'), ctx);
  return { ctx, peticiones, dialogos, notifs };
}
// La tarjeta tal como la arma calculo-f29.js con el remanente de Contable (lo que hace _cargarSiiDe)
function tarjeta(ctx, o = {}) {
  const RI = ctx.infoRemanenteAnterior({ rut: RUT }, '2026-10');
  const remC = !RI.bloquea ? { valor: RI.monto, fuente: RI.fuente === 'manual' ? 'manual' : 'contable', info: RI } : { valor: 0, fuente: 'sin', info: RI };
  const fila = o.fila === undefined ? null : o.fila;
  const a = C.armar({ raw: o.raw || RAW, remContable: remC, fila, hist: [{ periodo: '2026-09', tasa_ppm: 1.5 }], tieneRrhh: true, iuSii: 45000, periodo: '2026-10',
    hoy: new Date(2026, 10, 19), estadoContable: o.estadoContable || 'pendiente' });
  a.fila = fila; a.filaLeida = true;
  return a;
}
const esperar = () => new Promise((r) => setTimeout(r, 20));

test('Validar IVA desde Contable = mismo PATCH de reportes_mensuales que guardarF29 y misma fila de preiva_historial que el Pre-IVA', async () => {
  const { ctx, peticiones, notifs } = entorno();
  const a = tarjeta(ctx);
  assert.deepEqual(a.bloqueosValidar, []);
  const ok = await ctx.validarIvaDesdeTarjeta(RUT, a, null);
  assert.equal(ok, true);
  assert.equal(peticiones.length, 2, 'dos escrituras: reporte y preiva_historial');
  // 1) reportes_mensuales: lo mismo que escribía «Validar Pre-IVA» del modal con esos montos
  const p1 = peticiones[0];
  assert.equal(p1.path, 'reportes_mensuales?id=eq.555'); assert.equal(p1.method, 'PATCH');
  assert.deepEqual(p1.body, patchAntesGuardarF29({ deb: 1900000, cred: 760000, rem: 101000, postergado: false, fechaVencPostergado: null, ppmBase: 10500000, tasa: 1.5, ppm: 157500, retHon: 68750, otrosImp: 0, obs: null }));
  assert.equal(p1.body.estado_contable, 'completado'); assert.equal(p1.body.iva_remanente_sig, 0);
  // 2) preiva_historial: la fila del Pre-IVA + «envío» (fecha_envio/enviado_por) + validacion_iva
  const p2 = peticiones[1], b = p2.body;
  assert.equal(p2.path, 'preiva_historial?on_conflict=cliente_rut,periodo'); assert.equal(p2.method, 'POST');
  assert.deepEqual(JSON.parse(JSON.stringify(p2.headers)), { 'Prefer': 'resolution=merge-duplicates,return=representation' }, 'mismas cabeceras que el «Enviar» del Pre-IVA');
  const sii = S.aPantalla(RAW, null, null);
  const antes = filaAntesPreIva({ rut: RUT, periodo: '2026-10', deb: 1900000, cred: 760000, rem: 101000, f29: 1039000 + 157500, ppm: 157500, tasa: 1.5,
    netoVentas: 10000000, netoCompras: 4000000, porTipoVentas: sii.porTipoVentas, porTipoCompras: sii.porTipoCompras, fuente: 'sii', sii, ed: null });
  const sinMarca = Object.assign({}, b, { sii_detalle: Object.assign({}, b.sii_detalle) });
  delete sinMarca.sii_detalle.validacion_iva; delete sinMarca.fecha_envio; delete sinMarca.enviado_por;
  assert.deepEqual(sinMarca, antes);
  assert.equal(b.enviado_por, 'Analista Prueba'); assert.ok(b.fecha_envio);
  assert.deepEqual(b.sii_detalle.validacion_iva, { por: 'Analista Prueba', at: b.fecha_envio, desde: 'contable' });
  // Tras validar: la memoria de la pantalla queda «completado» → el flujo avanza (IVA ✓ → Reporte)
  assert.equal(ctx._reportes[0].estadoContable, 'completado');
  assert.match(notifs[notifs.length - 1].mensaje, /IVA de octubre 2026 validado · siguiente: Reporte/);
  await esperar();
  // Y la tarjeta muestra «IVA validado el … por …» con lo guardado
  assert.match(C.estadoValidacion(b, 'completado').texto, /^IVA validado el \d{2}-\d{2}-\d{4} por Analista Prueba$/);
});

test('Validar IVA con PPM editado (guardado) → mismo PPM/tasa/sii_detalle.ppm_editado que guardaba el Pre-IVA', async () => {
  const { ctx, peticiones } = entorno();
  const fila = { periodo: '2026-10', tasa_ppm: 1.25, ppm: 131250, sii_detalle: { ppm_editado: ED } };
  const a = tarjeta(ctx, { fila });
  await ctx.validarIvaDesdeTarjeta(RUT, a, null);
  assert.equal(peticiones[0].body.ppm, 131250); assert.equal(peticiones[0].body.ppm_tasa, 1.25);
  const b = peticiones[1].body;
  assert.deepEqual([b.ppm, b.tasa_ppm, b.f29], [131250, 1.25, 1039000 + 131250]);
  assert.deepEqual(b.sii_detalle.ppm_editado, ED);
});

test('bloqueos: remanente faltante (nunca $0), descuadre SII ≠ Contable, RR. HH. pendiente, libros, ya validado → no escribe nada', async () => {
  // Sin remanente de septiembre en Contable (el SII sí lo tiene): pide ingresarlo a mano, no valida
  let E = entorno({ info: { estado: 'SIN_DATO', motivo: 'SIN_MES_ANTERIOR', periodo: '2026-10', periodo_anterior: '2026-09' } });
  let a = tarjeta(E.ctx);
  assert.equal(a.validar.remanenteAnterior, null);
  assert.equal(await E.ctx.validarIvaDesdeTarjeta(RUT, a, null), false);
  assert.equal(E.peticiones.length, 0); assert.match(E.dialogos.join('\n'), /No se puede validar el IVA de octubre 2026:[\s\S]*ingrésalo a mano/);
  // Descuadre: Contable 90.000 y SII 101.000
  E = entorno({ info: Object.assign({}, INFO_OK, { cod77: 90000, cod504: 90000 }) });
  a = tarjeta(E.ctx);
  assert.equal(await E.ctx.validarIvaDesdeTarjeta(RUT, a, null), false); assert.equal(E.peticiones.length, 0);
  assert.match(E.dialogos.join('\n'), /no cuadra: el F29 del SII da \$101\.000 y Contable tiene \$90\.000/);
  // RR. HH. pendiente
  E = entorno(); a = tarjeta(E.ctx); a = C.armar({ raw: RAW, remContable: { valor: 101000, fuente: 'contable' }, fila: null, hist: [{ periodo: '2026-09', tasa_ppm: 1.5 }], tieneRrhh: true, iuSii: null, periodo: '2026-10', hoy: new Date(2026, 10, 19) });
  assert.equal(await E.ctx.validarIvaDesdeTarjeta(RUT, a, null), false); assert.equal(E.peticiones.length, 0);
  assert.match(E.dialogos.join('\n'), /impuesto único de trabajadores/);
  // Libros pendientes (mismo control que el modal)
  E = entorno({ rep: { libros: { ventas: LIBROS.ventas } } }); a = tarjeta(E.ctx);
  assert.equal(await E.ctx.validarIvaDesdeTarjeta(RUT, a, null), false); assert.match(E.dialogos.join('\n'), /Libro de Compras pendiente/);
  // Ya validado
  E = entorno({ rep: { estadoContable: 'completado' } }); a = tarjeta(E.ctx, { estadoContable: 'completado' });
  assert.equal(await E.ctx.validarIvaDesdeTarjeta(RUT, a, null), false); assert.equal(E.peticiones.length, 0);
  // Cancelar la confirmación no escribe
  E = entorno({ confirmar: false }); a = tarjeta(E.ctx);
  assert.equal(await E.ctx.validarIvaDesdeTarjeta(RUT, a, null), false); assert.equal(E.peticiones.length, 0);
});

test('la base rechaza el remanente (REMANENTE_NO_CUADRA) → no se escribe preiva_historial y se explica', async () => {
  const E = entorno({ respuestas: { 'reportes_mensuales?id=eq.': () => ({ status: 400, body: { message: 'REMANENTE_NO_CUADRA: el remanente para el mes siguiente guardado (0) no corresponde' } }) } });
  const a = tarjeta(E.ctx);
  assert.equal(await E.ctx.validarIvaDesdeTarjeta(RUT, a, null), false);
  assert.equal(E.peticiones.length, 1); assert.match(E.dialogos.join('\n'), /No se validó el IVA:\nEl remanente para el mes siguiente no cuadra/);
  assert.equal(E.ctx._reportes[0].estadoContable, 'pendiente');
});

test('Editar PPM (con motivo) desde Contable: guarda IGUAL que el Pre-IVA (borrador: ppm, tasa_ppm, sii_detalle.ppm_editado), sin pisar un validado', async () => {
  const E = entorno({ respuestas: { 'preiva_historial?cliente_rut=': () => ({ status: 200, body: [] }) } });
  const a = tarjeta(E.ctx);
  assert.equal(await E.ctx.guardarPPMDesdeTarjeta(RUT, { tasa: '1,25', monto: '', motivo: 'Nueva tasa informada por el SII' }, a, null, (t) => { throw new Error(t); }), true);
  // PATCH (solo si no está enviado/validado) → vacío → POST de la fila nueva
  assert.equal(E.peticiones[0].path, 'preiva_historial?cliente_rut=eq.' + encodeURIComponent(RUT) + '&periodo=eq.2026-10&fecha_envio=is.null');
  assert.equal(E.peticiones[0].method, 'PATCH'); assert.equal(E.peticiones[1].path, 'preiva_historial'); assert.equal(E.peticiones[1].method, 'POST');
  const b = E.peticiones[1].body;
  assert.deepEqual([b.ppm, b.tasa_ppm, b.f29, b.fecha_envio, b.enviado_por], [131250, 1.25, 1039000 + 131250, null, null]);
  const e = b.sii_detalle.ppm_editado;
  assert.deepEqual([e.tasa, e.monto, e.motivo, e.por, e.calculado, e.tasa_calculada], [1.25, null, 'Nueva tasa informada por el SII', 'Analista Prueba', 157500, 1.5]);
  // Misma fila que el Pre-IVA habría guardado con esa edición
  const sii = S.aPantalla(RAW, null, null);
  const antes = filaAntesPreIva({ rut: RUT, periodo: '2026-10', deb: 1900000, cred: 760000, rem: 101000, f29: 1039000 + 131250, ppm: 131250, tasa: 1.25,
    netoVentas: 10000000, netoCompras: 4000000, porTipoVentas: sii.porTipoVentas, porTipoCompras: sii.porTipoCompras, fuente: 'sii', sii, ed: e });
  const sinNuevo = Object.assign({}, b); delete sinNuevo.fecha_envio; delete sinNuevo.enviado_por;
  assert.deepEqual(sinNuevo, antes);
  // La tarjeta lo muestra con lo guardado
  assert.equal(C.armar({ raw: RAW, remContable: { valor: 101000, fuente: 'contable' }, fila: Object.assign({ periodo: '2026-10' }, b), hist: [], tieneRrhh: true, iuSii: 45000, periodo: '2026-10', hoy: new Date(2026, 10, 19) }).calculo.ppm, 131250);
  // Con el IVA ya validado no se cambia
  const V2 = entorno({ rep: { estadoContable: 'completado' } }); let msg = '';
  assert.equal(await V2.ctx.guardarPPMDesdeTarjeta(RUT, { tasa: '1', motivo: 'Otra tasa distinta' }, tarjeta(V2.ctx), null, (t) => { msg = t; }), false);
  assert.match(msg, /ya está validado/); assert.equal(V2.peticiones.length, 0);
});

test('Ingresar remanente a mano desde la tarjeta: la RPC existente (registrar_remanente_anterior_manual) con el reporte del período', async () => {
  const MAN = Object.assign({}, INFO_OK, { fuente: 'F29_MANUAL', manual: { usuario_nombre: 'Analista Prueba', motivo: 'F29 septiembre presentado folio 1' } });
  const E = entorno({ info: { estado: 'SIN_DATO', motivo: 'SIN_MES_ANTERIOR', periodo: '2026-10', periodo_anterior: '2026-09' },
    respuestas: { 'rpc/registrar_remanente_anterior_manual': () => ({ status: 200, body: { ok: true, info: MAN } }) } });
  const resp = ['100000', 'F29 septiembre presentado folio 1'];
  E.ctx.prompt = () => resp.shift();
  vm.runInContext('prompt=this.prompt', E.ctx);
  const a = tarjeta(E.ctx);
  assert.equal(a.remValidacion.bloqueo.puedeManual, true);
  assert.equal(await E.ctx.remanenteManualDesdeTarjeta(RUT, a, null), true);
  assert.deepEqual(E.peticiones.map((p) => [p.path, p.body]), [['rpc/registrar_remanente_anterior_manual', { p_reporte_id: 555, p_cod77: 100000, p_motivo: 'F29 septiembre presentado folio 1' }]]);
  // Con el remanente registrado ya se puede validar
  assert.deepEqual(tarjeta(E.ctx).bloqueosValidar, []);
});

test('flujo de Contable: el paso se llama «IVA» (mismas claves) y el Pre-IVA ya no tiene enlace a validar', () => {
  assert.match(extraer('renderPipelineContable'), /\{lbl:'IVA',\s+done:prevOk&&libOk/);
  assert.doesNotMatch(fs.readFileSync(path.join(__dirname, 'calculo-f29.js'), 'utf8'), /'Revisar y validar en Pre-IVA →'/);
  const pre = fs.readFileSync(path.join(__dirname, '..', 'pre-iva', 'index.html'), 'utf8');
  assert.match(pre, /Estimado del mes en curso<\/b> · la validación del IVA se hace en Contable al cerrar el período\./);
  assert.doesNotMatch(pre, /Validar Pre-IVA|pasar al reporte/);
});

test('19-11 · empresa CONECTADA: el resumen del SII basta (sin libros); sin datos del período → «Esperando datos del SII»', async () => {
  // Conectada y SIN libros cargados: valida igual (mismas escrituras), sin exigir Compras/Ventas
  let E = entorno({ conectada: true, rep: { libros: {} } });
  assert.equal(E.ctx.librosListos(E.ctx._reportes[0], { id: 9001 }), true, 'el paso «Libros» queda cumplido como «Datos del SII»');
  let a = tarjeta(E.ctx);
  assert.equal(await E.ctx.validarIvaDesdeTarjeta(RUT, a, null), true);
  assert.equal(E.peticiones.length, 2); assert.doesNotMatch(E.dialogos.join('\n'), /Libro de/);
  assert.equal(E.peticiones[0].body.estado_contable, 'completado');
  // No conectada y sin libros: sigue exigiendo la carga manual
  E = entorno({ conectada: false, rep: { libros: {} } });
  assert.equal(E.ctx.librosListos(E.ctx._reportes[0], { id: 9001 }), false);
  assert.equal(await E.ctx.validarIvaDesdeTarjeta(RUT, tarjeta(E.ctx), null), false);
  assert.match(E.dialogos.join('\n'), /Libro de Compras pendiente/);
  // Conectada, pero Cartapra aún no trae el período → «Esperando datos del SII»; no escribe nada
  E = entorno({ conectada: true, rep: { libros: {} } });
  const sinDatos = Object.assign({}, RAW, { ventas: null, compras: null, honorarios: null, cobertura: { rcv_ventas: 'pendiente', rcv_compras: 'pendiente', honorarios: 'pendiente' } });
  a = C.armar({ raw: sinDatos, remContable: { valor: 101000, fuente: 'contable' }, fila: null, hist: [{ periodo: '2026-09', tasa_ppm: 1.5 }], tieneRrhh: true, iuSii: 45000, periodo: '2026-10', hoy: new Date(2026, 10, 19), conectada: true });
  assert.equal(a.bloqueosValidar[0], 'Esperando datos del SII (próxima sincronización 10:00/17:00).');
  assert.doesNotMatch(a.bloqueosValidar.join(' '), /ventas del SII|compras del SII|honorarios del SII/);
  assert.equal(await E.ctx.validarIvaDesdeTarjeta(RUT, a, null), false); assert.equal(E.peticiones.length, 0);
  // Sin lectura del SII (conectada según el equipo) → mismo aviso
  assert.deepEqual(V.bloqueosValidar(null, null, { conectada: true }), ['Esperando datos del SII (próxima sincronización 10:00/17:00).']);
  // Barra del flujo: «Datos del SII» en vez de «Libros» para conectadas
  assert.match(extraer('renderPipelineContable'), /lbl:siiConectado\(c\)\?'Datos del SII':'Libros'/);
  assert.match(extraer('renderSeccionLibros'), /if\(conResumenSii && siiConectado\(c\)\)\{ h \+= '<\/div>'; return h; \}/);
});

// ── 23-11 · REMANENTE-SII-AUTOMATICO (caso real 22-11, datos ficticios): septiembre NO existe en Gestoor, pero el F29 de septiembre está en el
// SII sin cód. 77. La base (remanente_anterior) responde CONOCIDO · F29_SII · 0 → «Validar IVA» ya no pide ingresarlo a mano.
test('F29_SII: valida octubre con el remanente del F29 del SII (sin ingreso a mano) y lo rotula así', async () => {
  const RAW0 = Object.assign({}, RAW, { remanente_anterior: { periodo: '202609', folio: 555, cod77: 0, cod504: 0, fuente: 'sii_sin_codigo_77', mes_utm_origen: '2026-10',
    mes_utm_destino: '2026-11', utm_origen: 69000, utm_destino: 69690, falta_utm: [] } });
  const INFO_SII = { estado: 'CONOCIDO', fuente: 'F29_SII', cod77: 0, cod504: 0, folio: 555, utm_origen: 69000, utm_destino: 69690, mes_utm_origen: '2026-10',
    mes_utm_destino: '2026-11', periodo: '2026-10', periodo_anterior: '2026-09', f29_sii: { periodo: '2026-09', folio: 555, fuente_77: 'sii_sin_codigo_77' } };
  const E = entorno({ info: INFO_SII });
  const a = tarjeta(E.ctx, { raw: RAW0 });
  assert.equal(a.remValidacion.bloqueo, null, 'no bloquea');
  assert.equal(a.remValidacion.origen, 'sii_f29');
  assert.equal(a.remValidacion.texto, 'Remanente del F29 de septiembre 2026 en el SII (folio 555) · sin cód. 77 = sin remanente');
  assert.equal(a.validar.remanenteAnterior, 0, 'remanente 0 CONFIRMADO por el SII (no un 0 por defecto)');
  assert.deepEqual(a.bloqueosValidar, []);
  assert.equal(await E.ctx.validarIvaDesdeTarjeta(RUT, a, null), true);
  assert.equal(E.peticiones[0].path, 'reportes_mensuales?id=eq.555');
  assert.equal(E.peticiones[0].body.iva_remanente_sig, 0); assert.equal(E.peticiones[0].body.estado_contable, 'completado');
  assert.ok(!E.peticiones.some((p) => /registrar_remanente_anterior_manual/.test(p.path)), 'no se registra nada a mano');
  // Antes del cambio (la base respondía SIN_MES_ANTERIOR) se bloqueaba y pedía ingresarlo a mano
  const E2 = entorno({ info: { estado: 'SIN_DATO', motivo: 'SIN_MES_ANTERIOR', periodo: '2026-10', periodo_anterior: '2026-09' } });
  const a2 = tarjeta(E2.ctx, { raw: RAW0 });
  assert.equal(a2.remValidacion.bloqueo.puedeManual, true);
  // Y si la base trae aviso_sii (Gestoor manda, el SII difiere) se informa sin bloquear
  const E3 = entorno({ info: Object.assign({}, INFO_OK, { aviso_sii: { motivo: 'F29_SII_DISTINTO', cod77_sii: 90000, folio: 123, cod77_usado: 100000 } }) });
  const a3 = tarjeta(E3.ctx);
  assert.equal(a3.remValidacion.bloqueo, null);
  assert.match(a3.remValidacion.aviso, /el F29 de septiembre 2026 en el SII \(folio 123\) trae cód\. 77 \$90\.000 y Gestoor usa \$100\.000/);
});
