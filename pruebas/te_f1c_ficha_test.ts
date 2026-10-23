// TE-F1C · ficha de Trabajos especiales con la factura adicional (F1c) · prueba LOCAL en jsdom con sbFetch simulado
// (no toca Supabase ni producción; datos 100 % ficticios).
// 1) Enlace de la campana ?trabajo=<id> abre la ficha y pide rpc/te_fa_resumen.
// 2) Facturador: vista previa (glosa, monto, crédito, vencimiento) y botón "Crear factura adicional" → rpc/te_fa_crear con solo p_trabajo.
// 3) Responsable: ve la factura vinculada y su estado, sin botón ni enlace a Facturación. 4) Sin la función (404): vista anterior de T1.
// 5) Master con espejo fallido: aviso + "Reintentar" → rpc/te_fa_espejo_reintentar. 6) Prospecto sin ficha. 7) Escape de textos.
// Uso: deno run --allow-read --allow-env --allow-sys --allow-net=registry.npmjs.org pruebas/te_f1c_ficha_test.ts
import { JSDOM } from 'npm:jsdom@24.1.0';

const RAIZ = new URL('../', import.meta.url);
const leer = (p: string) => Deno.readTextFileSync(new URL(p, RAIZ));
const gcJs = leer('assets/gestoor-cartera.js'), teJs = leer('trabajos-especiales/te.js');
const espera = (ms = 80) => new Promise((r) => setTimeout(r, ms));
let total = 0, fallas = 0;
const res = (n: string, ok: boolean, det = '') => { total++; console.log((ok ? 'OK   ' : 'MAL  ') + n + (ok || !det ? '' : ' · ' + det)); if (!ok) fallas++; };
const sinScript = (s: string) => s.replace(/<\/script>/g, '<\\/script>');

type Any = Record<string, any>;
const YO: Record<string, Any> = {
  facturacion: { usuario_id: 9, nombre: 'Facturación Ficticia', es_master: false, responsable: false, facturador: true, pagos: false, puede_leer: true },
  responsable: { usuario_id: 7, nombre: 'Responsable Ficticio', es_master: false, responsable: true, facturador: false, pagos: false, puede_leer: true },
  master: { usuario_id: 1, nombre: 'Master Ficticio', es_master: true, responsable: true, facturador: false, pagos: true, puede_leer: true },
};
const TRAB = { id: 31, codigo: 'TE-2026-031', cliente_id: 501, prospecto_nombre: null, servicio_id: 'svc-f', servicio_solicitado: null, descripcion_que: 'Constituir una SpA ficticia',
  descripcion_alcance: 'Completa', descripcion_antecedentes: null, condicion_pago: 'CUOTAS', n_cuotas: 3, valor_catalogo: 180000, valor_base: 180000, descuento_pct: null, valor: 180000,
  responsable_usuario_id: 7, etapa: 'ACEPTADA', etapa_desde: '2026-10-22T12:00:00Z', estatus: 'EN_CURSO', estatus_motivo: null, huella_revision: null, devolucion_comentario: null,
  vigencia_hasta: '2026-11-05', enviado_at: '2026-10-21T12:00:00Z', aceptado_at: '2026-10-22T12:00:00Z', aceptacion_medio: 'ENLACE', iniciado_at: null, inicio_autorizado_motivo: null,
  retener_entrega: false, entrega_estado: 'PENDIENTE', terminado_at: null, cerrado_at: null, cierre_tipo: null, cierre_motivo: null, cierre_detalle: null, rechazo_motivo: null, creado_at: '2026-10-20T12:00:00Z' };
const FILA = { id: 31, codigo: 'TE-2026-031', cliente_id: 501, cliente_nombre: 'Panadería Ficticia SpA', es_prospecto: false, servicio_id: 'svc-f', servicio_nombre: 'Formalización ficticia',
  responsable_usuario_id: 7, etapa: 'ACEPTADA', etapa_desde: '2026-10-22T12:00:00Z', estatus: 'EN_CURSO', condicion_pago: 'CUOTAS', n_cuotas: 3, valor: 180000, valor_catalogo: 180000,
  avance: null, saldo: 180000, factura_estado: 'PENDIENTE', cuotas_vencidas: 0, alerta_aceptado_sin_facturar: true };
const PREV = { cliente_id: 501, modo: 'PRUEBA', forma_pago: 2, fecha_emision: '2026-10-23', fecha_vencimiento: '2026-12-26',
  lineas: [{ glosa: 'Formalización <img src=x onerror="window.__xss=1">', detalle: 'Trabajo especial TE-2026-031 · Condición de pago: 3 cuotas · Cuota 1: $60.000', cantidad: 1, precio: 180000 }] };
const TEF = { id: 41, estado: 'PENDIENTE', modo: 'PRUEBA', total: 180000, folio: null };

async function pagina(rol: string, resumen: Any | 'error', extra: { trab?: Any } = {}) {
  const mock = `<script>
    window._llamadas = [];
    function _r(o, st){ st = st || 200; return Promise.resolve({ ok: st < 400, status: st, json: function(){ return Promise.resolve(o); }, text: function(){ return Promise.resolve(JSON.stringify(o)); } }); }
    function sbFetch(path, op){
      window._llamadas.push({ path: path, body: op && op.body ? JSON.parse(op.body) : null });
      if (path === 'rpc/te_yo') return _r(${JSON.stringify(YO[rol])});
      if (path === 'rpc/cobte_te_responsables') return _r([{ usuario_id: 7, nombre: 'Responsable Ficticio' }]);
      if (path === 'rpc/te_fa_resumen') return ${resumen === 'error' ? `_r({ code: 'PGRST202', message: 'Could not find the function public.te_fa_resumen' }, 404)` : `_r(${JSON.stringify(resumen)})`};
      if (path === 'rpc/te_fa_crear') return _r({ resultado: 'creada', factura_id: 77, codigo: 'FA-2026-0077', estado: 'BORRADOR', total: 180000 });
      if (path === 'rpc/te_fa_espejo_reintentar') return _r({ resultado: 'OK' });
      if (path.indexOf('te_v_tablero?') === 0) return _r([${JSON.stringify(FILA)}]);
      if (path.indexOf('te_parametros?') === 0) return _r([{ modo_factura: 'PRUEBA', produccion_habilitada: false, avisos_habilitados: false, avisos_modo: 'PRUEBA', vigencia_cotizacion_dias: 15, responsable_ve_todos: false }]);
      if (path.indexOf('te_trabajos?') === 0) return _r([${JSON.stringify({ ...TRAB, ...(extra.trab || {}) })}]);
      if (path.indexOf('te_facturas?') === 0) return _r([{ id: 41, modo: 'PRUEBA', tipo_dte: 34, estado: 'PENDIENTE', total: 180000, snapshot_hash: null, of_folio: null, fecha_emision_dte: null, devolucion: null, creado_at: '2026-10-22T12:00:00Z' }]);
      if (path.indexOf('te_cuotas?') === 0) return _r([{ id: 1, n: 1, cuotas_total: 3, es_inicio: true, monto: 60000, fecha_vencimiento: '2026-10-27', estado: 'PENDIENTE' }]);
      return _r([]);
    }
  </script>`;
  let html = leer('trabajos-especiales/index.html');
  html = html.replace(/<script src="\.\.\/supabase\.js"><\/script>/, () => mock)
    .replace(/<script src="\.\.\/assets\/gestoor-cartera\.js"><\/script>/, () => '<script>' + sinScript(gcJs) + '</script>')
    .replace(/<script src="te\.js"><\/script>/, () => '<script>' + sinScript(teJs) + '</script>')
    .replace(/<script>if\(window\.GC_DEMO\)document\.write[^\n]*<\/script>/g, '').replace(/<script>if\(!window\.GC_DEMO\)document\.write[^\n]*<\/script>/g, '')
    .replace(/<script src="\.\.\/assets\/gestoor-menu\.js"><\/script>/, '');
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://gestoor.ejemplo.test/trabajos-especiales/index.html?trabajo=31', pretendToBeVisual: true });
  const w = dom.window as unknown as Any;
  await espera(250);
  const det = () => w.document.getElementById('gcDetCuerpo');
  return { w, det, llamadas: () => w._llamadas as { path: string; body: Any }[], texto: () => (det()?.textContent || '') as string };
}

// 1–2 · Facturador
{
  const p = await pagina('facturacion', { trabajo_id: 31, te_factura: TEF, vinculos: [], puede_crear: true, bloqueo: null, prellenado: PREV });
  const llam = p.llamadas();
  res('1.1 el enlace ?trabajo=31 abre la ficha y pide te_fa_resumen con p_trabajo 31', llam.some((x) => x.path === 'rpc/te_fa_resumen' && x.body?.p_trabajo === 31) && p.texto().includes('TE-2026-031'), JSON.stringify(llam.map((x) => x.path)));
  const t = p.texto();
  res('2.1 vista previa: glosa, $180.000, crédito, vencimiento y detalle con el plan de cuotas', t.includes('Así se creará la factura adicional') && t.includes('$180.000') && t.includes('Crédito')
      && t.includes('26-12-2026') && t.includes('Cuota 1: $60.000'), t.slice(0, 900));
  res('2.2 la glosa se escapa (sin ejecutar HTML)', !p.det().querySelector('img') && p.w.__xss === undefined && t.includes('<img src=x'));
  const b = p.det().querySelector('[data-act="fa-crear"]');
  res('2.3 botón "Crear factura adicional"; el camino antiguo ("Preparar factura") no aparece', !!b && !p.det().querySelector('[data-act="fac-preparar"]'));
  b.click(); await espera(60);
  const modal = p.w.document.querySelector('.gc-modal');
  res('2.4 confirmación con el resumen (glosa, monto, "nadie escribe montos" en la ficha y pasos siguientes)', !!modal && modal.textContent.includes('$180.000') && modal.textContent.includes('Facturación adicional'));
  modal.querySelector('[data-m="si"]').click(); await espera(300);
  const cr = p.llamadas().filter((x) => x.path === 'rpc/te_fa_crear');
  res('2.5 llama a te_fa_crear UNA vez y solo con p_trabajo (sin montos ni cliente desde el navegador)', cr.length === 1 && JSON.stringify(cr[0].body) === JSON.stringify({ p_trabajo: 31 }), JSON.stringify(cr));
  res('2.6 aviso de éxito con el código de la factura', (p.w.document.getElementById('gcToast')?.textContent || '').includes('FA-2026-0077'), p.w.document.getElementById('gcToast')?.textContent);
}
// 3 · Responsable con factura vinculada en revisión
{
  const p = await pagina('responsable', { trabajo_id: 31, te_factura: TEF, vinculos: [{ factura_id: 77, codigo: 'FA-2026-0077', estado: 'EN_REVISION', modo: 'PRUEBA', total: 180000, folio: null, espejo: null }],
    puede_crear: false, bloqueo: 'FACTURA_VINCULADA', prellenado: null });
  const t = p.texto();
  res('3.1 el responsable ve FA-2026-0077 "En revisión del Master" y el monto', t.includes('FA-2026-0077') && t.includes('En revisión del Master') && t.includes('$180.000'), t.slice(0, 600));
  res('3.2 sin botón de crear ni enlace a Facturación adicional (no es facturador)', !p.det().querySelector('[data-act="fa-crear"]') && !p.det().querySelector('a[href*="facturacion/index.html"]'));
}
// 4 · Función no instalada
{
  const p = await pagina('facturacion', 'error');
  res('4.1 sin te_fa_resumen (404): la ficha carga con la vista anterior y el botón "Preparar factura" de T1', p.texto().includes('Instrucción pendiente') && !!p.det().querySelector('[data-act="fac-preparar"]'), p.texto().slice(0, 400));
}
// 5 · Master con espejo fallido
{
  const p = await pagina('master', { trabajo_id: 31, te_factura: TEF, vinculos: [{ factura_id: 78, codigo: 'FA-2026-0078', estado: 'EMITIDA', modo: 'PRODUCCION', total: 180000, folio: '16480', espejo: 'ERROR' }],
    puede_crear: false, bloqueo: 'FACTURA_VINCULADA', prellenado: null });
  const t = p.texto();
  res('5.1 aviso rojo "se emitió, pero el trabajo no se actualizó", con folio y enlace a la factura', t.includes('el trabajo no se actualizó') && t.includes('Folio 16480')
      && !!p.det().querySelector('a[href="../facturacion/index.html?tab=adicional&fa=78"]'), t.slice(0, 600));
  const r = p.det().querySelector('[data-act="fa-reintentar"]'); r.click(); await espera(60);
  p.w.document.querySelector('.gc-modal [data-m="si"]').click(); await espera(250);
  res('5.2 "Reintentar" → te_fa_espejo_reintentar con p_fa 78', p.llamadas().some((x) => x.path === 'rpc/te_fa_espejo_reintentar' && x.body?.p_fa === 78));
}
// 6 · Prospecto sin ficha
{
  const p = await pagina('facturacion', { trabajo_id: 31, te_factura: TEF, vinculos: [], puede_crear: false, bloqueo: 'PROSPECTO_SIN_FICHA', prellenado: null }, { trab: { cliente_id: null, prospecto_nombre: 'Prospecto Ficticio' } });
  res('6.1 prospecto sin ficha: explica por qué no se puede crear y no muestra el botón', p.texto().includes('prospecto sin ficha') && !p.det().querySelector('[data-act="fa-crear"]'), p.texto().slice(0, 500));
}

console.log(`\nTE-F1C · ficha: ${total - fallas}/${total}`);
if (fallas) Deno.exit(1);
