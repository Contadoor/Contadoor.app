// RR. HH. · P1-A (A-RRHH-01/02/03 · B-OBL-01/04) · prueba LOCAL con mocks (no toca Supabase ni producción; datos FICTICIOS).
// Extrae del HTML real las funciones de estado y envío, y las ejecuta con un sbFetch simulado:
// 1) "Finalizar" manda quien_finalizado (no quienFinalizo), relee la fila y solo entonces cambia la pantalla.
// 2) Si PostgREST responde error, 0 filas, o la relectura no coincide → alerta con el error real y el estado NO cambia.
// 3) Una clave sin columna conocida aborta sin llamar a la base.
// 4) "Enviar a aprobación" ya no escribe en la tabla legada `pagos` ni en localStorage `pagos_bd`;
//    con el registro apagado avisa "Registro de obligación pendiente de activación"; encendido usa crear_obligacion
//    con el monto leído de la BASE (no de la caché).
// 5) El envío por correo (Vercel retirado) no se intenta: ni individual, ni masivo, ni recordatorio.
// Uso: deno run --allow-read pruebas/rrhh_p1a_estados_test.ts
const RAIZ = new URL('../', import.meta.url);
const html = Deno.readTextFileSync(new URL('reportes-rrhh/index.html', RAIZ));
let total = 0, fallas = 0;
const res = (n: string, ok: boolean, det = '') => { total++; console.log((ok ? 'OK   ' : 'MAL  ') + n + (ok || !det ? '' : ' · ' + det)); if (!ok) fallas++; };

function extraerFuncion(nombre: string): string {
  const i = html.indexOf('function ' + nombre + '(');
  if (i < 0) throw new Error('No está la función ' + nombre);
  let j = html.indexOf('{', i), prof = 0;
  for (let k = j; k < html.length; k++) {
    if (html[k] === '{') prof++;
    else if (html[k] === '}') { prof--; if (prof === 0) return html.slice(i, k + 1); }
  }
  throw new Error('Llaves sin cerrar en ' + nombre);
}
function extraerVar(nombre: string): string {
  const i = html.indexOf('var ' + nombre + '=');
  if (i < 0) throw new Error('No está la variable ' + nombre);
  const f = html.indexOf(';\n', i);
  return html.slice(i, f + 1);
}
const FUNCS = ['rrhhASnake', 'rrhhValorIgual', 'rrhhLeerError', 'sbPatchRrhh', 'actualizarEstadoRrhh', 'avisarErrorEstadoRrhh',
  'marcarTransferido', 'marcarEnPreviredRrhh', 'registrarObligacionCotizRrhh', 'enviarAprobacionRrhh', 'marcarFinalizadoRrhh',
  'marcarPostergado', 'enviarAvisoRrhhCore', 'enviarPreReporteRrhh', 'reenviarAviso', 'enviarRecordatorioRrhh', 'enviarSeleccionados',
  'avisarEnvioEnPreparacionRrhh', 'abrirAvisoRrhhParaPdf'];
const VARS = ['RRHH_ENVIO_CORREO_ACTIVO', 'RRHH_MSG_ENVIO_PREPARACION', 'RRHH_MAPA_COLUMNAS', 'RRHH_OBLIGACION_COTIZ_ACTIVA', 'RRHH_MSG_OBLIGACION_PENDIENTE'];
const codigo = VARS.map(extraerVar).join('\n') + '\n' + FUNCS.map(extraerFuncion).join('\n');

type Llamada = { ruta: string; metodo: string; cuerpo: any };
function entorno(opc: { patch?: (c: any) => { status: number; body: any }; get?: (ruta: string) => { status: number; body: any }; rpc?: any; obligacionActiva?: boolean; reporte?: any }) {
  const llamadas: Llamada[] = [], alertas: string[] = [], toasts: string[] = [], ls: Record<string, string> = {}, ventanas: string[] = [];
  const rep = Object.assign({ id: 501, rut: '11111111-1', clienteNombre: 'Cliente Ficticio SpA', periodo: '2026-10', estado: 'aprobado', totalCot: 999 }, opc.reporte || {});
  const cache = [rep];
  const respuesta = (status: number, body: any) => Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body), text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)) });
  const sbFetch = (ruta: string, o: any) => {
    const metodo = (o && o.method) || 'GET', cuerpo = o && o.body ? JSON.parse(o.body) : null;
    llamadas.push({ ruta, metodo, cuerpo });
    if (ruta.startsWith('rpc/crear_obligacion')) return respuesta(200, opc.rpc || [{ obligacion_id: 77, resultado: 'creada', mensaje: 'ok' }]);
    if (metodo === 'PATCH') {
      let r;
      try { r = opc.patch ? opc.patch(cuerpo) : { status: 200, body: [Object.assign({ id: rep.id }, cuerpo)] }; } catch (x) { return Promise.reject(x); }   // como sbFetch real: promesa rechazada
      return respuesta(r.status, r.body);
    }
    if (metodo === 'GET') { const r = opc.get ? opc.get(ruta) : { status: 200, body: [] }; return respuesta(r.status, r.body); }
    return respuesta(404, 'no simulado');
  };
  let ultimoPatch: any = null;
  const sbFetchConEco = (ruta: string, o: any) => {
    if (o && o.method === 'PATCH') ultimoPatch = JSON.parse(o.body);
    return sbFetch(ruta, o);
  };
  const ctx: Record<string, any> = {
    sbFetch: sbFetchConEco, getReportes: () => cache, setReportes: (a: any[]) => { cache.splice(0, cache.length, ...a); },
    getUsuario: () => ({ nombre: 'Analista Ficticia' }), confirm: () => true, alert: (m: string) => alerts(m), toast: (m: string) => toasts.push(m),
    renderTabla: () => {}, sv: () => '2026-10', hesc: (s: string) => String(s), formatPeriodo: (p: string) => 'Octubre 2026',
    validarParaEnvioAviso: () => ({ ok: true, email: 'ficticio@example.invalid' }), buildPreReporteRrhhHTML: () => '<p>aviso</p>',
    getClientes: () => [], _remuData: null, _rutSelRrhh: null, normalizarPeriodoLibro: (p: string) => p,
    localStorage: { getItem: (k: string) => ls[k] ?? null, setItem: (k: string, v: string) => { ls[k] = v; } },
    document: { querySelectorAll: () => [{ getAttribute: () => '501' }], getElementById: () => null },
    window: { open: () => { ventanas.push(''); return { document: { write: (h: string) => { ventanas[ventanas.length - 1] = h; }, close() {} } }; } }, console: { log() {}, warn() {}, error() {}, info() {} },
    fetch: (u: string) => { llamadas.push({ ruta: u, metodo: 'FETCH', cuerpo: null }); return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}), text: () => Promise.resolve('') }); },
  };
  function alerts(m: string) { alertas.push(m); }
  // Releer = devolver lo que quedó del último PATCH (o lo que el escenario diga).
  if (!opc.get) opc.get = (ruta: string) => ruta.includes('select=id,cliente_rut,periodo,total_cot')
    ? { status: 200, body: [{ id: rep.id, cliente_rut: rep.rut, periodo: rep.periodo, total_cot: 123456 }] }
    : { status: 200, body: [Object.assign({ id: rep.id }, ultimoPatch || {})] };
  const nombres = Object.keys(ctx);
  const fuente = codigo + (opc.obligacionActiva ? '\nRRHH_OBLIGACION_COTIZ_ACTIVA=true;' : '') +
    '\nreturn {' + FUNCS.join(',') + ', get obligacion(){return RRHH_OBLIGACION_COTIZ_ACTIVA;}};';
  const api = new Function(...nombres, fuente)(...nombres.map((n) => ctx[n]));
  return { api, llamadas, alertas, toasts, cache, ls, rep, ventanas };
}
const espera = () => new Promise((r) => setTimeout(r, 30));

// 1) Finalizar: clave correcta + relectura + pantalla cambia
{
  const e = entorno({});
  e.api.marcarFinalizadoRrhh(501); await espera();
  const patch = e.llamadas.find((l) => l.metodo === 'PATCH');
  res('Finalizar · el PATCH lleva quien_finalizado', !!patch && patch.cuerpo.quien_finalizado === 'Analista Ficticia', JSON.stringify(patch && patch.cuerpo));
  res('Finalizar · el PATCH NO lleva quienFinalizo', !!patch && !('quienFinalizo' in patch.cuerpo) && !('quien_finalizo' in patch.cuerpo));
  res('Finalizar · se relee la fila (GET con select)', e.llamadas.some((l) => l.metodo === 'GET' && /select=id,estado/.test(l.ruta)));
  res('Finalizar · pantalla queda "finalizado" tras confirmar', e.cache[0].estado === 'finalizado' && e.cache[0].quienFinalizado === 'Analista Ficticia');
  res('Finalizar · toast de éxito y sin alertas', e.toasts.length === 1 && e.alertas.length === 0, e.alertas.join(' | '));
}
// 1b) Timestamps devueltos con otro formato (+00:00) se aceptan si es el mismo instante
{
  let pedido: any = null;
  const e = entorno({
    patch: (c) => { pedido = c; return { status: 200, body: [c] }; },
    get: () => ({ status: 200, body: [{ id: 501, estado: pedido.estado, fecha_finalizado: new Date(pedido.fecha_finalizado).toISOString().replace('Z', '+00:00'), quien_finalizado: pedido.quien_finalizado }] }),
  });
  e.api.marcarFinalizadoRrhh(501); await espera();
  res('Finalizar · fecha en formato +00:00 = mismo instante → OK', e.cache[0].estado === 'finalizado' && e.alertas.length === 0, e.alertas.join(' | '));
}
// 2) PostgREST 400 → error real visible, estado intacto
{
  const e = entorno({ patch: () => ({ status: 400, body: { code: 'PGRST204', message: "Could not find the 'x' column of 'reportes_mensuales'" } }) });
  e.api.marcarFinalizadoRrhh(501); await espera();
  res('Error 400 · alerta con el mensaje de PostgREST', e.alertas.length === 1 && /HTTP 400/.test(e.alertas[0]) && /Could not find/.test(e.alertas[0]), e.alertas.join(' | '));
  res('Error 400 · el estado NO cambia ni hay toast de "Finalizado"', e.cache[0].estado === 'aprobado' && e.toasts.length === 0);
}
// 2b) PATCH ok pero 0 filas (RLS) → error
{
  const e = entorno({ patch: () => ({ status: 200, body: [] }) });
  e.api.marcarTransferido(501); await espera();
  res('0 filas · alerta y estado intacto', e.alertas.length === 1 && /ninguna fila/.test(e.alertas[0]) && e.cache[0].estado === 'aprobado');
}
// 2c) Relectura no coincide → error
{
  const e = entorno({ get: () => ({ status: 200, body: [{ id: 501, estado: 'aprobado', fecha_previred: null, quien_previred: null }] }) });
  e.api.marcarEnPreviredRrhh(501); await espera();
  res('Relectura distinta · alerta y estado intacto', e.alertas.length === 1 && /no qued/.test(e.alertas[0]) && e.cache[0].estado === 'aprobado', e.alertas.join(' | '));
}
// 2d) Error de red (sbFetch rechaza) → alerta
{
  const e2 = entorno({ patch: () => { throw new Error('GESTOOR_NO_SESSION'); } });
  e2.api.marcarPostergado(501); await espera();
  res('Sin sesión · alerta y estado intacto', e2.alertas.length === 1 && /GESTOOR_NO_SESSION/.test(e2.alertas[0]) && e2.cache[0].estado === 'aprobado', e2.alertas.join(' | '));
}
// 3) Clave desconocida → no llama a la base
{
  const e = entorno({});
  let err = '';
  await e.api.sbPatchRrhh(501, { estado: 'finalizado', quienFinalizo: 'X' }).catch((x: Error) => { err = x.message; });
  res('Clave sin columna · rechaza sin llamar a la base', /quienFinalizo/.test(err) && e.llamadas.length === 0, err);
  let err2 = '';
  await e.api.sbPatchRrhh('nuevo_123', { estado: 'finalizado' }).catch((x: Error) => { err2 = x.message; });
  res('ID temporal · rechaza (antes se ignoraba en silencio)', /sin ID/.test(err2) && e.llamadas.length === 0);
}
// 4) Enviar a aprobación sin tabla `pagos` ni localStorage; obligación apagada → aviso claro
{
  const e = entorno({ reporte: { estado: 'en_previred' } });
  e.api.enviarAprobacionRrhh(501); await espera();
  res('Aprobación · estado pendiente_aprobacion confirmado', e.cache[0].estado === 'pendiente_aprobacion');
  res('Aprobación · NO escribe en la tabla legada pagos', !e.llamadas.some((l) => /^pagos/.test(l.ruta)));
  res('Aprobación · NO usa localStorage pagos_bd', !('pagos_bd' in e.ls));
  res('Aprobación · apagado: no llama a crear_obligacion', !e.llamadas.some((l) => /crear_obligacion/.test(l.ruta)));
  res('Aprobación · apagado: avisa "pendiente de activación"', e.alertas.length === 1 && /Registro de obligación pendiente de activación/.test(e.alertas[0]), e.alertas.join(' | '));
}
// 4b) Obligación encendida → crear_obligacion con monto de la BASE
{
  const e = entorno({ reporte: { estado: 'en_previred', totalCot: 999 }, obligacionActiva: true });
  e.api.enviarAprobacionRrhh(501); await espera();
  const rpc = e.llamadas.find((l) => /rpc\/crear_obligacion/.test(l.ruta));
  res('Obligación activa · llama a crear_obligacion (rrhh/cotizaciones)', !!rpc && rpc.cuerpo.p_area_origen === 'rrhh' && rpc.cuerpo.p_tipo_obligacion === 'cotizaciones' && rpc.cuerpo.p_ref_reporte_id === 501);
  res('Obligación activa · monto leído de la base (123456), no de la caché (999)', !!rpc && rpc.cuerpo.p_monto_total === 123456 && rpc.cuerpo.p_monto_exigible === 123456);
  res('Obligación activa · toast con resultado y sin alertas', e.toasts.some((t) => /creada/.test(t)) && e.alertas.length === 0, e.alertas.join(' | '));
}
// 4c) Estado no guardado → no se intenta la obligación
{
  const e = entorno({ reporte: { estado: 'en_previred' }, obligacionActiva: true, patch: () => ({ status: 403, body: { message: 'permission denied' } }) });
  e.api.enviarAprobacionRrhh(501); await espera();
  res('Aprobación fallida · no llama a crear_obligacion y avisa', !e.llamadas.some((l) => /crear_obligacion/.test(l.ruta)) && /permission denied/.test(e.alertas.join(' ')) && e.cache[0].estado === 'en_previred');
}
// 5) Envío por correo desactivado
{
  const e = entorno({ reporte: { estado: 'completado' } });
  const r = await e.api.enviarAvisoRrhhCore(e.rep);
  res('Correo · motor no envía y lo informa', r.ok === false && r.enPreparacion === true && /en preparación/.test(r.motivo));
  e.api.enviarPreReporteRrhh(501); e.api.reenviarAviso(501); e.api.enviarRecordatorioRrhh(501, true); e.api.enviarSeleccionados(); await espera();
  res('Correo · ningún fetch (Vercel) en individual, reenvío, recordatorio ni masivo', !e.llamadas.some((l) => l.metodo === 'FETCH'), JSON.stringify(e.llamadas));
  res('Correo · el estado sigue "completado"', e.cache[0].estado === 'completado');
  res('Correo · se abre el aviso para PDF (individual y reenvío) sin escribir nada', e.ventanas.length === 2 && e.ventanas.every((v) => /<p>aviso<\/p>/.test(v) && /Guardar como PDF/.test(v)) && !e.llamadas.some((l) => l.metodo === 'PATCH'));
  res('Correo · avisos honestos mostrados', e.alertas.filter((a) => /Envío por correo en preparación; usa el puente PDF\/Outlook/.test(a)).length >= 2, String(e.alertas.length));
}
// Estático: sin escrituras al legado en el archivo
res('Estático · no queda sbFetch(\'pagos\' ni setItem(\'pagos_bd\'', !/sbFetch\('pagos'/.test(html) && !/setItem\('pagos_bd'/.test(html));
res('Estático · no queda la clave quienFinalizo: en código', !/quienFinalizo:/.test(html));

console.log('\n' + (total - fallas) + '/' + total + ' OK');
if (fallas) Deno.exit(1);
