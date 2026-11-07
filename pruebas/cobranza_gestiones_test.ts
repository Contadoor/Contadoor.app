// COBRANZA · GESTIONES MANUALES Y COMPROMISOS DE PAGO · prueba LOCAL con mocks (jsdom; no toca Supabase ni producción; datos ficticios).
// 1) Validación de los formularios (GC_GEST.validarGestion / validarCompromiso) y mapeo EXACTO de parámetros a las RPC
//    cobranza_gestion_registrar(p_cliente_id, p_tipo, p_nota) y cobranza_compromiso_registrar(p_cliente_id, p_fecha, p_monto, p_nota).
// 2) Línea de tiempo: CLP con punto de miles, fechas dd-mm-aaaa, escape HTML, Correo/Reunión reconocidos por su prefijo.
// 3) Página real (mock de sbFetch): botones solo con permiso de gestión; «Registrar gestión» llama a la RPC con los parámetros
//    correctos; el error LEY_21320 se muestra en español amable; «Registrar compromiso» queda DESHABILITADO y nunca llama al servidor.
// 3b) Bandera COMPROMISO_CONECTADO = true (solo en la prueba, reemplazando la constante; para cuando COB-COMPROMISO-1 esté instalado):
//    botón habilitado, monto OPCIONAL (p_monto null), una sola llamada con los parámetros exactos y texto «No se avisó al cliente».
// 3c) Estado del compromiso (COB-COMPROMISO-2): Vigente / Cumplido / Incumplido / Por revisar / Estado no disponible, leído de
//    cobranza_eventos (solo lectura; nada se escribe al cargar la ficha).
// 4) Modo demo: simula ambas acciones sin red (compromiso como COB-COMPROMISO-1: monto opcional y sin aviso P3).
// Uso: deno run --allow-read --allow-env --allow-sys --allow-net=registry.npmjs.org pruebas/cobranza_gestiones_test.ts
import { JSDOM } from 'npm:jsdom@24.1.0';

const RAIZ = new URL('../', import.meta.url);
const leer = (p: string) => Deno.readTextFileSync(new URL(p, RAIZ));
const gcJs = leer('assets/gestoor-cartera.js'), histJs = leer('cobranza/historial.js'), gestJs = leer('cobranza/gestiones.js'),
  carteraJs = leer('cobranza/cartera.js'), demoJs = leer('cobranza/cartera-demo.js');
const espera = (ms = 60) => new Promise((r) => setTimeout(r, ms));
let total = 0, fallas = 0;
const res = (n: string, ok: boolean, det = '') => { total++; console.log((ok ? 'OK   ' : 'MAL  ') + n + (ok || !det ? '' : ' · ' + det)); if (!ok) fallas++; };
const sinScript = (s: string) => s.replace(/<\/script>/g, '<\\/script>');
const HOY = '2026-11-06';

// ═══ 1 y 2 · funciones puras ═══
{
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { runScripts: 'dangerously', url: 'https://gestoor.ejemplo.test/cobranza/cartera.html' });
  const w = dom.window as unknown as Record<string, any>;
  for (const js of [gcJs, gestJs]) { const s = w.document.createElement('script'); s.textContent = js; w.document.body.appendChild(s); }
  const E = w.GC_GEST;
  res('G0 gestiones.js expone GC_GEST', !!E && typeof E.validarGestion === 'function' && typeof E.validarCompromiso === 'function' && typeof E.lineaTiempoHtml === 'function');
  res('G1 Tipos ofrecidos: llamado, correo, WhatsApp, reunión, nota (sin «Ya transferí», que encola un aviso al cliente)',
    JSON.stringify(E.TIPOS.map((t: any) => t.k)) === '["LLAMADA","CORREO","WHATSAPP","REUNION","NOTA"]' && !E.TIPOS.some((t: any) => t.rpc === 'YA_TRANSFERI'));
  const j = (x: unknown) => JSON.stringify(x);
  res('G2 Llamado sin nota → p_tipo LLAMADA y p_nota null', j(E.validarGestion('103', { tipo: 'LLAMADA', nota: '  ' }).args) === j({ p_cliente_id: 103, p_tipo: 'LLAMADA', p_nota: null }));
  res('G3 Llamado con nota → nota recortada', E.validarGestion(103, { tipo: 'LLAMADA', nota: '  Pagará el viernes ' }).args.p_nota === 'Pagará el viernes');
  res('G4 WhatsApp → WHATSAPP_MANUAL', j(E.validarGestion(7, { tipo: 'WHATSAPP', nota: 'Envié el estado de cuenta' }).args) === j({ p_cliente_id: 7, p_tipo: 'WHATSAPP_MANUAL', p_nota: 'Envié el estado de cuenta' }));
  res('G5 Correo → NOTA con prefijo «Correo: »', E.validarGestion(7, { tipo: 'CORREO', nota: 'Reenvié la factura' }).args.p_tipo === 'NOTA' && E.validarGestion(7, { tipo: 'CORREO', nota: 'Reenvié la factura' }).args.p_nota === 'Correo: Reenvié la factura');
  res('G6 Reunión → NOTA con prefijo «Reunión: »', E.validarGestion(7, { tipo: 'REUNION', nota: 'Reunión en oficina' }).args.p_nota === 'Reunión: Reunión en oficina');
  res('G7 Nota, WhatsApp, Correo y Reunión exigen nota de 5+ caracteres', ['NOTA', 'WHATSAPP', 'CORREO', 'REUNION'].every((t) => /al menos 5/.test(E.validarGestion(7, { tipo: t, nota: 'abc' }).error || '')));
  res('G8 Sin tipo o tipo inventado → error', !!E.validarGestion(7, { tipo: '' }).error && !!E.validarGestion(7, { tipo: 'YA_TRANSFERI', nota: 'xxxxxx' }).error);
  res('G9 Nota de más de 1000 caracteres (con prefijo) → error', !!E.validarGestion(7, { tipo: 'CORREO', nota: 'x'.repeat(995) }).error && !E.validarGestion(7, { tipo: 'NOTA', nota: 'x'.repeat(1000) }).error);
  res('G10 Llamado con nota muy corta → error amable', /opcional/.test(E.validarGestion(7, { tipo: 'LLAMADA', nota: 'ok' }).error || ''));

  res('C1 Monto «120.000», «$120.000» y «120000» → 120000; vacío → null; «12,5» → inválido',
    E.montoNum('120.000') === 120000 && E.montoNum('$ 120.000') === 120000 && E.montoNum('120000') === 120000 && E.montoNum('') === null && Number.isNaN(E.montoNum('12,5')));
  const okC = E.validarCompromiso('105', { fecha: '2026-11-20', monto: '$110.000', nota: '  Acordado por teléfono ' }, HOY);
  res('C2 Compromiso válido → parámetros exactos de la RPC', j(okC.args) === j({ p_cliente_id: 105, p_fecha: '2026-11-20', p_monto: 110000, p_nota: 'Acordado por teléfono' }), j(okC));
  res('C3 Fecha anterior a hoy → error', /anterior a hoy/.test(E.validarCompromiso(1, { fecha: '2026-11-05', monto: '1000', nota: 'xxxxxx' }, HOY).error || ''));
  res('C4 Fecha a más de 30 días → error con la fecha tope dd-mm-aaaa', /06-12-2026/.test(E.validarCompromiso(1, { fecha: '2026-12-07', monto: '1000', nota: 'xxxxxx' }, HOY).error || '') && !E.validarCompromiso(1, { fecha: '2026-12-06', monto: '1000', nota: 'xxxxxx' }, HOY).error);
  res('C5 Hoy es una fecha válida', !E.validarCompromiso(1, { fecha: HOY, monto: '1000', nota: 'xxxxxx' }, HOY).error);
  res('C6 Monto vacío → válido y p_monto null (COB-COMPROMISO-1: monto opcional)',
    j(E.validarCompromiso(1, { fecha: HOY, monto: '  ', nota: 'Sin monto acordado' }, HOY).args) === j({ p_cliente_id: 1, p_fecha: HOY, p_monto: null, p_nota: 'Sin monto acordado' }));
  res('C6b Monto escrito pero inválido («abc», «-5») → error que explica que puede quedar vacío',
    ['abc', '-5'].every((m) => /dejarlo vacío/.test(E.validarCompromiso(1, { fecha: HOY, monto: m, nota: 'xxxxxx' }, HOY).error || '')));
  res('C6c montoCompromiso: null → «sin monto»; 120000 → «$120.000»', E.montoCompromiso(null) === 'sin monto' && E.montoCompromiso(120000) === '$120.000');
  res('C7 Monto 0 o con decimales → error', !!E.validarCompromiso(1, { fecha: HOY, monto: '0', nota: 'xxxxxx' }, HOY).error && !!E.validarCompromiso(1, { fecha: HOY, monto: '10,5', nota: 'xxxxxx' }, HOY).error);
  res('C8 Nota corta → error', /al menos 5/.test(E.validarCompromiso(1, { fecha: HOY, monto: '1000', nota: 'ok' }, HOY).error || ''));
  res('C9 Compromiso deshabilitado en Gestoor real (COMPROMISO_CONECTADO = false) con explicación', E.COMPROMISO_CONECTADO === false && /aviso al cliente/.test(E.MOTIVO_COMPROMISO));

  const tl = E.lineaTiempoHtml([
    { id: 1, tipo: 'NOTA', dia: '2026-11-04', nota: 'Correo: Reenvié <b>factura</b>', registrado_at: '2026-11-04T12:00:00Z' },
    { id: 2, tipo: 'WHATSAPP_MANUAL', dia: '2026-11-05', nota: 'Estado de cuenta', registrado_at: '2026-11-05T12:00:00Z' },
    { id: 3, tipo: 'NOTA', dia: '2026-11-01', nota: 'Reunión: En oficina', registrado_at: '2026-11-01T12:00:00Z' },
  ], [{ id: 9, desde: '2026-11-03', hasta: '2026-11-25', motivo: 'Acordado', compromiso_fecha: '2026-11-20', compromiso_monto: 1234567, creada_at: '2026-11-03T10:00:00Z', terminada_at: null }], HOY);
  const txt = tl.replace(/<[^>]+>/g, ' ');
  res('T1 Línea de tiempo: tipo Correo/Reunión por prefijo, WhatsApp con Ley 21.320', /Correo\s+Reenvié/.test(txt) && txt.includes('Reunión') && txt.includes('En oficina') && txt.includes('Cuenta para la Ley 21.320') && !txt.includes('Correo: '));
  res('T2 Compromiso con CLP de miles y fechas dd-mm-aaaa', tl.includes('$1.234.567') && tl.includes('20-11-2026') && tl.includes('25-11-2026') && txt.includes('Vigente'));
  res('T3 Orden: más reciente primero', tl.indexOf('Estado de cuenta') < tl.indexOf('Reenvié') && tl.indexOf('Reenvié') < tl.indexOf('Acordado') && tl.indexOf('Acordado') < tl.indexOf('En oficina'));
  res('T4 Escapa el texto de la base', !tl.includes('<b>factura</b>') && tl.includes('&lt;b&gt;factura'));
  const tlSin = E.lineaTiempoHtml([], [{ id: 10, desde: '2026-11-03', hasta: '2026-11-25', motivo: 'Sin monto', compromiso_fecha: '2026-11-20', compromiso_monto: null, creada_at: '2026-11-03T10:00:00Z', terminada_at: null }], HOY);
  res('T2b Compromiso sin monto: «al 20-11-2026 (sin monto)», nunca «No disponible»', tlSin.includes('al 20-11-2026 (sin monto)') && !tlSin.includes('No disponible'));
  const C0 = { id: 21, desde: '2026-10-28', hasta: '2026-11-04', compromiso_fecha: '2026-10-30', compromiso_monto: null, creada_at: '2026-10-28T10:00:00Z', terminada_at: null };
  const evI = [{ tipo: 'COMPROMISO_INCUMPLIDO', detalle: { pausa_id: 21 } }], evC = [{ tipo: 'COMPROMISO_CUMPLIDO', detalle: { pausa_id: 21 } }], evOtro = [{ tipo: 'COMPROMISO_INCUMPLIDO', detalle: { pausa_id: 99 } }];
  res('S1 Estado: evento INCUMPLIDO de esa pausa → Incumplido (rojo)', E.estadoCompromiso(C0, HOY, evI).k === 'INCUMPLIDO' && E.estadoCompromiso(C0, HOY, evI).c === 'rojo');
  res('S2 Estado: evento CUMPLIDO → Cumplido (verde)', E.estadoCompromiso(C0, HOY, evC).k === 'CUMPLIDO');
  res('S3 Estado: fecha futura sin evento → Vigente; hoy mismo también', E.estadoCompromiso({ ...C0, compromiso_fecha: '2026-11-20' }, HOY, []).k === 'VIGENTE' && E.estadoCompromiso({ ...C0, compromiso_fecha: HOY }, HOY, []).k === 'VIGENTE');
  res('S4 Estado: fecha pasada sin evento (o evento de otra pausa) → Por revisar', E.estadoCompromiso(C0, HOY, []).k === 'POR_REVISAR' && E.estadoCompromiso(C0, HOY, evOtro).k === 'POR_REVISAR');
  res('S5 Estado: lectura fallida (null) en un compromiso pasado → «Estado no disponible», nunca Vigente', E.estadoCompromiso(C0, HOY, null).k === 'SIN_DATO');
  const tlI = E.lineaTiempoHtml([], [C0], HOY, evI).replace(/<[^>]+>/g, ' ');
  res('S6 Línea de tiempo: «Incumplido» y «se avisó al equipo (no al cliente)»', tlI.includes('Incumplido') && tlI.includes('se avisó al equipo (no al cliente)'), tlI);
  res('S7 Línea de tiempo: «Por revisar» explica cuándo revisa el sistema', E.lineaTiempoHtml([], [C0], HOY, []).includes('día hábil siguiente'));
  res('T5 Vacío amable', E.lineaTiempoHtml([], [], HOY).includes('Aún no hay gestiones'));
  const errLey = new w.Error('LEY_21320: x'); errLey.srv = { code: '55000', message: 'LEY_21320: el cliente ya tiene 2 gestiones escritas esta semana', status: 400 };
  res('T6 Error LEY_21320 → mensaje en español amable con el código', /Ley 21\.320/.test(w.GC.msgError(errLey, E.ERR)) && /\(LEY_21320\)$/.test(w.GC.msgError(errLey, E.ERR)));
  res('T7 Nunca la palabra «honorarios»', !/honorario/i.test(gestJs + tl));
}

// ═══ 3 · página completa (mock de sbFetch) ═══
async function pagina(yo: Record<string, unknown>, rpcGestion?: { st: number; body: unknown }, conectado = false) {
  const gest = conectado ? gestJs.replace('var COMPROMISO_CONECTADO=false;', 'var COMPROMISO_CONECTADO=true;') : gestJs;
  if (conectado && gest === gestJs) throw new Error('no se encontró la bandera COMPROMISO_CONECTADO en gestiones.js');
  const mock = `<script>
    window._llamadas = [];
    function _r(o, st){ st = st || 200; return Promise.resolve({ ok: st < 400, status: st, json: function(){ return Promise.resolve(o); }, text: function(){ return Promise.resolve(JSON.stringify(o)); } }); }
    var RG = ${JSON.stringify(rpcGestion || { st: 200, body: { gestion_id: 77, pausa_hasta: null, avisos_reemplazados: 0 } })};
    function sbFetch(path, opt){
      window._llamadas.push({ m: (opt && opt.method) || 'GET', p: path, b: opt && opt.body ? JSON.parse(opt.body) : null });
      if (path === 'rpc/cobranza_yo') return _r(${JSON.stringify(Object.assign({ modo: 'PRUEBA', prueba_hasta: '2026-12-31', arranque_fecha: null, envio_habilitado: false, puede_leer: true }, yo))});
      if (path === 'rpc/cobte_cartera_nombres') return _r([{ cliente_id: 501, razon_social: 'Panadería Ficticia Uno SpA', rut: '76111111-6' }]);
      if (path === 'rpc/cobranza_estado_cuenta') return _r({ grupos: [], total_deuda: 75000, total_vencido: 75000, total_abonos: 0, total: 75000 });
      if (path === 'rpc/cobranza_gestion_registrar') return _r(RG.body, RG.st);
      if (path === 'rpc/cobranza_compromiso_registrar') return _r({ pausa_id: 31, hasta: '2026-11-24', aviso_cliente: false });
      if (path.indexOf('cobranza_documentos?') === 0) return _r([{ id: 2, cliente_id: 501, origen: 'MENSUALIDAD', folio: '4002', periodo: '2026-09', fecha_vencimiento: '2026-10-21', monto: 75000, saldo: 75000, estado: 'PENDIENTE' }]);
      if (path.indexOf('cobranza_clientes?') === 0) return _r([{ cliente_id: 501, estado: 'VENCIDO', estado_desde: '2026-10-22' }]);
      if (path.indexOf('cobranza_gestiones?') === 0) return _r([{ id: 1, tipo: 'LLAMADA', dia: '2026-11-02', nota: 'No contestó', registrado_at: '2026-11-02T13:00:00Z' }]);
      if (path.indexOf('cobranza_pausas?') === 0 && path.indexOf('origen=eq.COMPROMISO') > 0) return _r([{ id: 9, desde: '2026-11-03', hasta: '2026-11-25', motivo: 'Acordado con la dueña', compromiso_fecha: '2026-11-20', compromiso_monto: 75000, creada_at: '2026-11-03T10:00:00Z', terminada_at: null }]);
      if (path.indexOf('rpc/') === 0) return _r(null);
      return _r([]);
    }
  </script>`;
  let html = leer('cobranza/cartera.html');
  html = html.replace(/<script src="\.\.\/supabase\.js"><\/script>/, () => mock)
    .replace(/<script src="\.\.\/assets\/gestoor-cartera\.js"><\/script>/, () => '<script>' + sinScript(gcJs) + '</script>')
    .replace(/<script src="historial\.js"><\/script>/, () => '<script>' + sinScript(histJs) + '</script>')
    .replace(/<script src="gestiones\.js"><\/script>/, () => '<script>' + sinScript(gest) + '</script>')
    .replace(/<script src="cartera\.js"><\/script>/, () => '<script>' + sinScript(carteraJs) + '</script>')
    .replace(/<script>if\(window\.GC_DEMO\)document\.write[^\n]*<\/script>/g, '').replace(/<script>if\(!window\.GC_DEMO\)document\.write[^\n]*<\/script>/g, '')
    .replace(/<script src="\.\.\/assets\/gestoor-menu\.js"><\/script>/, '');
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://gestoor.ejemplo.test/cobranza/cartera.html', pretendToBeVisual: true });
  const w = dom.window as unknown as Record<string, any>;
  await espera(150);
  (w.document.querySelector('[data-act="ficha"][data-id="501"]') as HTMLElement | null)?.click();
  await espera(120);
  return w;
}
{
  const w = await pagina({ puede_gestionar: true, puede_registrar_pagos: true });
  const d = w.document as Document;
  const bG = d.querySelector('[data-act="gestion"]') as HTMLButtonElement | null, bC = d.querySelector('[data-act="compromiso"]') as HTMLButtonElement | null;
  res('P1 Con permiso de gestión: botones «Registrar gestión» y «Registrar compromiso de pago» junto a «Registrar pago»',
    !!bG && !!bC && !!d.querySelector('.acciones [data-act="pago"]') && bG.parentElement === bC.parentElement);
  res('P2 «Registrar compromiso» deshabilitado con explicación visible', !!bC?.disabled && (d.getElementById('gcCompNo')?.textContent || '').includes('aviso al cliente'));
  const cuerpo = d.getElementById('gcDetCuerpo')!.textContent || '';
  res('P3 La ficha muestra la línea de tiempo con gestiones y compromisos', cuerpo.includes('Gestiones y compromisos') && cuerpo.includes('No contestó') && cuerpo.includes('Compromiso de pago: $75.000 al 20-11-2026'));
  const lect = (w._llamadas as any[]).filter((x) => x.m === 'GET' && /^cobranza_(gestiones|pausas)\?/.test(x.p)).map((x) => x.p);
  const levt = (w._llamadas as any[]).filter((x) => x.m === 'GET' && /^cobranza_eventos\?/.test(x.p)).map((x) => x.p);
  res('P4b Lee cobranza_eventos SOLO tipo/detalle/creado_at de COMPROMISO_CUMPLIDO/INCUMPLIDO del cliente', levt.length === 1
    && levt[0] === 'cobranza_eventos?select=tipo,detalle,creado_at&cliente_id=eq.501&tipo=in.(COMPROMISO_CUMPLIDO,COMPROMISO_INCUMPLIDO)&order=creado_at.desc&limit=50', levt.join(' | '));
  res('P4c Al cargar la ficha no se escribe nada (sin PATCH/DELETE ni RPC de escritura)', !(w._llamadas as any[]).some((x) => x.m === 'PATCH' || x.m === 'DELETE'
    || (x.m === 'POST' && /rpc\/(cobranza_(gestion|compromiso|pago|repact|pausa)|cob_compromisos)/.test(x.p))));
  res('P4 Lecturas sin columnas de usuario/claves', lect.length >= 2 && !lect.some((u: string) => /registrado_por|creada_por|terminada_por|usuario_|clave_|vault/.test(u)), lect.join(' | '));
  bC?.click(); await espera(30);
  res('P5 Clic en compromiso deshabilitado no abre modal', !d.querySelector('.gc-modal'));
  bG?.click(); await espera(40);
  const m = d.querySelector('.gc-modal') as HTMLElement;
  res('P6 Abre el modal «Registrar gestión» con los 5 tipos', !!m && m.querySelectorAll('[data-gtipo]').length === 5);
  (m.querySelector('[data-gtipo="WHATSAPP"]') as HTMLElement).click(); await espera(10);
  res('P7 Al elegir WhatsApp avisa que cuenta para la Ley 21.320', (m.querySelector('#gcGAyuda')?.textContent || '').includes('Ley 21.320'));
  (m.querySelector('[data-m="si"]') as HTMLElement).click(); await espera(20);
  res('P8 Sin nota → error en el modal y sin llamada', /al menos 5/.test(m.querySelector('#gcMErr')?.textContent || '') && !(w._llamadas as any[]).some((x) => x.p === 'rpc/cobranza_gestion_registrar'));
  (m.querySelector('#gcGNota') as HTMLTextAreaElement).value = 'Le envié el estado de cuenta por WhatsApp';
  (m.querySelector('[data-m="si"]') as HTMLElement).click(); await espera(120);
  const llam = (w._llamadas as any[]).filter((x) => x.p === 'rpc/cobranza_gestion_registrar');
  res('P9 Llama a cobranza_gestion_registrar con los parámetros exactos', llam.length === 1 && JSON.stringify(llam[0].b) === JSON.stringify({ p_cliente_id: 501, p_tipo: 'WHATSAPP_MANUAL', p_nota: 'Le envié el estado de cuenta por WhatsApp' }), JSON.stringify(llam));
  res('P10 Cierra el modal y avisa', !d.querySelector('.gc-modal') && (d.getElementById('gcToast')?.textContent || '').includes('WhatsApp registrado'));
  res('P11 Nunca llama a la RPC de compromiso ni a otras RPC de escritura', !(w._llamadas as any[]).some((x) => x.m === 'POST' && /rpc\/(cobranza_compromiso_registrar|cobranza_pago|cobranza_repact)/.test(x.p)));
  w.document.querySelectorAll('script').forEach((x: any) => x.remove());
}
{
  const w = await pagina({ puede_gestionar: true }, { st: 400, body: { code: '55000', message: 'LEY_21320: el cliente ya tiene 2 gestiones escritas esta semana o una a menos de 2 días' } });
  const d = w.document as Document;
  (d.querySelector('[data-act="gestion"]') as HTMLElement).click(); await espera(30);
  const m = d.querySelector('.gc-modal') as HTMLElement;
  (m.querySelector('[data-gtipo="WHATSAPP"]') as HTMLElement).click();
  (m.querySelector('#gcGNota') as HTMLTextAreaElement).value = 'Recordatorio por WhatsApp';
  (m.querySelector('[data-m="si"]') as HTMLElement).click(); await espera(120);
  const e = m.querySelector('#gcMErr')?.textContent || '';
  res('P12 Error LEY_21320 del servidor → mensaje amable y el modal queda abierto', !!d.querySelector('.gc-modal') && e.includes('anótalo como Nota') && e.includes('(LEY_21320)'), e);
  w.document.querySelectorAll('script').forEach((x: any) => x.remove());
}
{
  const w = await pagina({ puede_gestionar: false, puede_registrar_pagos: true, rol: 'pagos' });
  const d = w.document as Document;
  res('P13 Sin permiso de gestión (Pagos): no ve los botones', !d.querySelector('[data-act="gestion"]') && !d.querySelector('[data-act="compromiso"]') && !!d.querySelector('[data-act="pago"]'));
  w.document.querySelectorAll('script').forEach((x: any) => x.remove());
}

// ═══ 3b · bandera COMPROMISO_CONECTADO = true (solo cuando COB-COMPROMISO-1 esté instalado) ═══
{
  res('B0 La bandera del repositorio sigue en false (no publicar activada sin instalar el backend)', /var COMPROMISO_CONECTADO=false;/.test(gestJs) && !/var COMPROMISO_CONECTADO=true;/.test(gestJs));
  const w = await pagina({ puede_gestionar: true, puede_registrar_pagos: true }, undefined, true);
  const d = w.document as Document;
  const bC = d.querySelector('[data-act="compromiso"]') as HTMLButtonElement | null;
  res('B1 Con la bandera en true: botón habilitado y sin la nota de deshabilitado', !!bC && !bC.disabled && !d.getElementById('gcCompNo'));
  bC?.click(); await espera(40);
  const m = d.querySelector('.gc-modal') as HTMLElement;
  const t = m?.textContent || '';
  res('B2 Modal: monto «(opcional)», «No se envía nada al cliente» y sin el aviso de vista previa', t.includes('Monto comprometido (opcional)') && t.includes('No se envía nada al cliente') && !t.includes('Vista previa'));
  const f = new Date(w.GC.hoyCL() + 'T12:00:00Z'); f.setUTCDate(f.getUTCDate() + 14); const fecha = f.toISOString().slice(0, 10);
  (m.querySelector('#gcCFecha') as HTMLInputElement).value = fecha;
  (m.querySelector('#gcCNota') as HTMLTextAreaElement).value = '  Acordado por teléfono con la dueña ';
  (m.querySelector('[data-m="si"]') as HTMLElement).click(); await espera(30);
  const p2 = m.querySelector('#gcCP2')?.textContent || '';
  res('B3 Paso de confirmación: «sin monto» y «No se avisa al cliente», sin llamar todavía', p2.includes('sin monto') && p2.includes('No se avisa al cliente')
    && !(w._llamadas as any[]).some((x) => x.p === 'rpc/cobranza_compromiso_registrar'), p2);
  (m.querySelector('[data-m="si"]') as HTMLElement).click(); await espera(150);
  const ll = (w._llamadas as any[]).filter((x) => x.p === 'rpc/cobranza_compromiso_registrar');
  res('B4 Una sola llamada a cobranza_compromiso_registrar con p_monto null y parámetros exactos',
    ll.length === 1 && ll[0].m === 'POST' && JSON.stringify(ll[0].b) === JSON.stringify({ p_cliente_id: 501, p_fecha: fecha, p_monto: null, p_nota: 'Acordado por teléfono con la dueña' }), JSON.stringify(ll));
  const toast = d.getElementById('gcToast')?.textContent || '';
  res('B5 Aviso final: «sin monto», pausa hasta 24-11-2026 y «No se avisó al cliente»', toast.includes('sin monto') && toast.includes('24-11-2026') && toast.includes('No se avisó al cliente'), toast);
  res('B6 Ninguna otra RPC de escritura', !(w._llamadas as any[]).some((x) => x.m === 'POST' && /rpc\/(cobranza_pago|cobranza_repact|cobranza_gestion)/.test(x.p)));
  w.document.querySelectorAll('script').forEach((x: any) => x.remove());
}

// ═══ 4 · modo demo (sin red) ═══
{
  const html = leer('cobranza/cartera.html')
    .replace(/<script src="\.\.\/supabase\.js"><\/script>/, () => '<script>window._red=0;function sbFetch(){window._red++;return Promise.reject(new Error("sin red"));}</script>')
    .replace(/<script src="\.\.\/assets\/gestoor-cartera\.js"><\/script>/, () => '<script>' + sinScript(gcJs) + '</script>')
    .replace(/<script>if\(window\.GC_DEMO\)document\.write[^\n]*<\/script>/, () => '<script>' + sinScript(demoJs) + '</script>')
    .replace(/<script src="historial\.js"><\/script>/, () => '<script>' + sinScript(histJs) + '</script>')
    .replace(/<script src="gestiones\.js"><\/script>/, () => '<script>' + sinScript(gestJs) + '</script>')
    .replace(/<script src="cartera\.js"><\/script>/, () => '<script>' + sinScript(carteraJs) + '</script>')
    .replace(/<script>if\(!window\.GC_DEMO\)document\.write[^\n]*<\/script>/g, '')
    .replace(/<script src="\.\.\/assets\/gestoor-menu\.js"><\/script>/, '');
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost:8080/cobranza/cartera.html?demo=1', pretendToBeVisual: true });
  const w = dom.window as unknown as Record<string, any>;
  const d = w.document as Document;
  await espera(500);
  const hoy = w.GC.hoyCL();
  const D = w.COB_DEMO_API;
  const r1 = await D.gestionRegistrar({ p_cliente_id: 103, p_tipo: 'NOTA', p_nota: 'Reunión: En la oficina del cliente' });
  const f1 = await D.ficha(103);
  res('D1 Demo: registrar gestión la agrega a la ficha', r1.gestion_id > 0 && f1.gestiones[0].nota === 'Reunión: En la oficina del cliente');
  let e1 = ''; try { await D.gestionRegistrar({ p_cliente_id: 103, p_tipo: 'NOTA', p_nota: 'ab' }); } catch (e) { e1 = (e as Error).message; }
  res('D2 Demo: misma validación que el servidor (NOTA_OBLIGATORIA)', e1.startsWith('NOTA_OBLIGATORIA'));
  const fecha = new Date(hoy + 'T12:00:00Z'); fecha.setUTCDate(fecha.getUTCDate() + 5);
  const r2 = await D.compromisoRegistrar({ p_cliente_id: 102, p_fecha: fecha.toISOString().slice(0, 10), p_monto: 120000, p_nota: 'Pagará con la venta de fin de mes' });
  const f2 = await D.ficha(102);
  res('D3 Demo: registrar compromiso con monto crea la pausa y NO deja aviso P3 (como COB-COMPROMISO-1)', r2.pausa_id > 0 && r2.aviso_cliente === false && f2.compromisos[0].compromiso_monto === 120000 && !f2.avisos.some((a: any) => a.codigo === 'P3'));
  const r3 = await D.compromisoRegistrar({ p_cliente_id: 101, p_fecha: fecha.toISOString().slice(0, 10), p_monto: null, p_nota: 'Sin monto todavía' });
  const f3 = await D.ficha(101);
  res('D3b Demo: compromiso SIN monto aceptado (monto null) y sin P3', r3.pausa_id > 0 && f3.compromisos[0].compromiso_monto === null && !f3.avisos.some((a: any) => a.codigo === 'P3'));
  let e3 = ''; try { await D.compromisoRegistrar({ p_cliente_id: 101, p_fecha: fecha.toISOString().slice(0, 10), p_monto: 0, p_nota: 'Monto cero' }); } catch (e) { e3 = (e as Error).message; }
  res('D3c Demo: monto 0 → MONTO_INVALIDO', e3.startsWith('MONTO_INVALIDO'));
  (d.querySelector('[data-act="ficha"][data-id="103"]') as HTMLElement | null)?.click(); await espera(400);
  const bC = d.querySelector('[data-act="compromiso"]') as HTMLButtonElement | null;
  res('D4 Demo: botón de compromiso habilitado como vista previa y ficha con la gestión nueva', !!bC && !bC.disabled && (d.getElementById('gcDetCuerpo')?.textContent || '').includes('En la oficina del cliente'));
  bC?.click(); await espera(40);
  res('D5 Demo: el modal de compromiso avisa que en Gestoor real está deshabilitado', (d.querySelector('.gc-modal')?.textContent || '').includes('Vista previa (demo)'));
  (d.querySelector('[data-act="ficha"][data-id="103"]') as HTMLElement | null)?.click(); await espera(400);
  const t103 = d.getElementById('gcDetCuerpo')?.textContent || '';
  res('D7 Demo: compromiso pasado sin pago aparece «Incumplido» (sin monto) en la ficha', t103.includes('(sin monto)') && t103.includes('Incumplido'), t103.slice(0, 300));
  res('D6 Demo: ninguna llamada de red', w._red === 0);
  w.document.querySelectorAll('script').forEach((x: any) => x.remove());
}

console.log(`\n${total - fallas}/${total} pruebas OK`);
if (fallas) Deno.exit(1);
