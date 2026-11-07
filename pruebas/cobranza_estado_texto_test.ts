// COBRANZA · «COPIAR ESTADO DE CUENTA» / «WHATSAPP» · prueba LOCAL con mocks (jsdom; no toca Supabase ni producción; datos FICTICIOS).
// 1) Armado del texto (GC_ECTXT.armarTexto): saludo, fecha dd-mm-aaaa, documentos (folio, período en palabras, vencimiento,
//    saldo CLP con punto de miles), total a pagar (deuda − abonos), comentario para la transferencia, datos para transferir, cierre.
//    Casos: con deuda, con abonos, abonos que cubren todo, sin deuda (al día), nombre no visible, «honorarios» → «servicios».
// 2) WhatsApp: solo con un celular chileno reconocible; enlace wa.me con el texto codificado.
// 3) Página real (mock de sbFetch): el botón copia (navigator.clipboard), avisa «Copiado ✓», NO hace llamadas nuevas al servidor,
//    no muestra WhatsApp sin teléfono, sugiere «¿Anotar como gestión?» y abre el modal precargado SIN guardar hasta confirmar.
// Uso: deno run --allow-read --allow-env --allow-sys --allow-net=registry.npmjs.org pruebas/cobranza_estado_texto_test.ts
import { JSDOM } from 'npm:jsdom@24.1.0';

const RAIZ = new URL('../', import.meta.url);
const leer = (p: string) => Deno.readTextFileSync(new URL(p, RAIZ));
const gcJs = leer('assets/gestoor-cartera.js'), histJs = leer('cobranza/historial.js'), gestJs = leer('cobranza/gestiones.js'),
  txtJs = leer('cobranza/estado-texto.js'), carteraJs = leer('cobranza/cartera.js');
const espera = (ms = 60) => new Promise((r) => setTimeout(r, ms));
let total = 0, fallas = 0;
const res = (n: string, ok: boolean, det = '') => { total++; console.log((ok ? 'OK   ' : 'MAL  ') + n + (ok || !det ? '' : ' · ' + det)); if (!ok) fallas++; };
const sinScript = (s: string) => s.replace(/<\/script>/g, '<\\/script>');

// Estado de cuenta ficticio con la forma de cobranza_estado_cuenta.
const EC = {
  fecha: '2026-11-07', total_deuda: 1245000, total_vencido: 1125000, total_abonos: 0, total: 1245000,
  comentario_transferencia: 'Facturas 9001, 9002',
  datos_transferencia: {},
  grupos: [
    { tipo: 'MENSUALIDAD', titulo: 'Mensualidad', subtotal: 245000, lineas: [
      { folio: '9002', concepto: 'Servicios contables', periodo: '2026-10', vencimiento: '2026-11-15', monto: 120000, vencido: false },
      { folio: '9001', concepto: 'Honorarios contables', periodo: '2026-09', vencimiento: '2026-10-15', monto: 125000, vencido: true },
    ] },
    { tipo: 'REPACTACION', titulo: 'Repactación', subtotal: 1000000, lineas: [
      { folio: null, concepto: 'Cuota de repactación', cuota: '1 de 3', periodo: null, vencimiento: '2026-10-30', monto: 1000000, vencido: true },
    ] },
  ],
};

// ═══ 1 y 2 · funciones puras ═══
{
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { runScripts: 'dangerously', url: 'https://gestoor.ejemplo.test/cobranza/cartera.html' });
  const w = dom.window as unknown as Record<string, any>;
  const s = w.document.createElement('script'); s.textContent = txtJs; w.document.body.appendChild(s);
  const T = w.GC_ECTXT;
  res('E0 estado-texto.js expone GC_ECTXT', !!T && typeof T.armarTexto === 'function' && typeof T.copiar === 'function');
  res('E1 Período en palabras', T.periodoPalabras('2026-10') === 'octubre 2026' && T.periodoPalabras('2026-01-01') === 'enero 2026' && T.periodoPalabras('raro') === 'raro');

  const t = T.armarTexto(EC, { nombre: 'Panadería Ficticia Uno SpA', hoy: '2026-11-06' });
  console.log('\n--- Ejemplo (datos ficticios) ---\n' + t + '\n---------------------------------\n');
  res('E2 Saludo con el nombre de la empresa', t.startsWith('Hola, Panadería Ficticia Uno SpA'));
  res('E3 Fecha del estado (la del servidor) en dd-mm-aaaa', t.includes('Te comparto el detalle de tu estado de cuenta con Contadoor al 07-11-2026.'));
  res('E4 Documento con folio, período en palabras, vencimiento dd-mm-aaaa y saldo con punto de miles',
    t.includes('• Folio 9002 · Servicios contables · período octubre 2026 · vence el 15-11-2026: $120.000'));
  res('E5 Documento vencido marcado; cuota sin folio usa «Cuota»', t.includes('vence el 15-10-2026 (vencida): $125.000') && t.includes('• Cuota 1 de 3 · Cuota de repactación · vence el 30-10-2026 (vencida): $1.000.000'));
  res('E6 Orden por vencimiento (más antiguo primero)', t.indexOf('Folio 9001') < t.indexOf('Cuota 1 de 3') && t.indexOf('Cuota 1 de 3') < t.indexOf('Folio 9002'));
  res('E7 Total a pagar con punto de miles', t.includes('Total a pagar: $1.245.000') && !t.includes('Abonos a tu favor'));
  res('E8 Comentario sugerido para la transferencia', t.includes('Comentario sugerido para la transferencia: «Facturas 9001, 9002»'));
  res('E9 Datos para transferir (los mismos del correo del reporte mensual)', t.includes('Datos para transferir:') && t.includes('Banco Itaú · Cuenta corriente') && leer('reporte-email.js').includes('Banco Itaú · Cuenta corriente ' + T.DATOS_TRANSFERENCIA.numero_cuenta));
  res('E10 Cierre', t.endsWith('Cualquier duda, quedo atento.\nEquipo Contadoor'));
  res('E11 Nunca «honorarios» (se dice «servicios»)', !/honorario/i.test(t) && t.includes('Servicios contables · período septiembre 2026'));
  res('E12 Máximo 2 emojis', (t.match(/\p{Extended_Pictographic}/gu) || []).length <= 2);

  const ab = T.armarTexto({ ...EC, total_abonos: 45000, total: 1200000 }, { nombre: 'Ficticia Dos Ltda.' });
  res('E13 Con abonos: total documentos, abono restado y total a pagar = deuda − abonos',
    ab.includes('Total de documentos: $1.245.000') && ab.includes('Abonos a tu favor: −$45.000') && ab.includes('Total a pagar: $1.200.000'));
  const cub = T.armarTexto({ ...EC, total_abonos: 2000000, total: 0 }, { nombre: 'Ficticia Dos Ltda.' });
  res('E14 Abonos que cubren todo: total $0 y sin datos de transferencia', cub.includes('Total a pagar: $0') && !cub.includes('Datos para transferir'));
  const aldia = T.armarTexto({ fecha: '2026-11-07', grupos: [], total_deuda: 0, total_abonos: 0, total: 0, comentario_transferencia: null }, { nombre: 'Ficticia Tres SpA' });
  res('E15 Sin deuda: dice que está al día, sin lista ni datos de transferencia',
    aldia.includes('¡Estás al día!') && !aldia.includes('Documentos pendientes') && !aldia.includes('Datos para transferir') && aldia.includes('al 07-11-2026'));
  const aldiaAb = T.armarTexto({ fecha: '2026-11-07', grupos: [], total_deuda: 0, total_abonos: 30000, total: 0 }, {});
  res('E16 Al día con saldo a favor; sin nombre visible → «Hola 👋» (nunca «Cliente N.º»)', aldiaAb.includes('saldo a favor de $30.000') && aldiaAb.startsWith('Hola 👋'));
  const srv = T.armarTexto({ ...EC, datos_transferencia: { banco: 'Banco Ficticio', tipo_cuenta: 'Cuenta vista', numero_cuenta: '000111', titular: 'Empresa Ficticia', rut: '11.111.111-1', correo: 'pagos@ejemplo.test' } }, {});
  res('E17 Si el servidor trae datos de transferencia, se usan esos', srv.includes('Banco Ficticio · Cuenta vista 000111') && srv.includes('Comprobante a pagos@ejemplo.test') && !srv.includes('Itaú'));
  const hoyF = T.armarTexto({ grupos: [], total: 0 }, { hoy: '2026-11-06' });
  res('E18 Sin fecha del servidor → usa hoy', hoyF.includes('al 06-11-2026'));

  res('W1 Celulares chilenos → 569XXXXXXXX', T.telefonoWa('+56 9 0000 0103') === '56900000103' && T.telefonoWa('900000103') === '56900000103' && T.telefonoWa('9 0000 0103') === '56900000103');
  res('W2 Teléfono fijo, vacío o raro → null (no se ofrece WhatsApp)', T.telefonoWa('22 000 0000') === null && T.telefonoWa('') === null && T.telefonoWa(null) === null && T.telefonoWa('abc') === null);
  const link = T.linkWhatsApp('+56 9 0000 0103', 'Hola\nTotal: $1.000');
  res('W3 Enlace wa.me con el texto codificado', link === 'https://wa.me/56900000103?text=' + encodeURIComponent('Hola\nTotal: $1.000'));
  res('W4 Teléfono solo si la ficha lo trae', T.telefonoFicha({}) === null && T.telefonoFicha({ contacto: { tel: '22 000 0000' } }) === null && T.telefonoFicha({ contacto: { tel: '+56 9 0000 0104' } }) === '+56 9 0000 0104');
  res('E19 El módulo no llama al servidor', !/sbFetch|\.rpc\(|A\.get\(|fetch\(/.test(txtJs));
}

// ═══ 3 · página completa (mock de sbFetch) ═══
async function pagina(yo: Record<string, unknown>, ficha?: Record<string, unknown>) {
  const mock = `<script>
    window._llamadas = [];
    function _r(o, st){ st = st || 200; return Promise.resolve({ ok: st < 400, status: st, json: function(){ return Promise.resolve(o); }, text: function(){ return Promise.resolve(JSON.stringify(o)); } }); }
    function sbFetch(path, opt){
      window._llamadas.push({ m: (opt && opt.method) || 'GET', p: path, b: opt && opt.body ? JSON.parse(opt.body) : null });
      if (path === 'rpc/cobranza_yo') return _r(${JSON.stringify(Object.assign({ modo: 'PRUEBA', prueba_hasta: '2026-12-31', arranque_fecha: null, envio_habilitado: false, puede_leer: true }, yo))});
      if (path === 'rpc/cobte_cartera_nombres') return _r([{ cliente_id: 501, razon_social: 'Panadería Ficticia Uno SpA', rut: '76111111-6' }]);
      if (path === 'rpc/cobranza_estado_cuenta') return _r(${JSON.stringify(ficha || EC)});
      if (path === 'rpc/cobranza_gestion_registrar') return _r({ gestion_id: 77, pausa_hasta: null, avisos_reemplazados: 0 });
      if (path.indexOf('cobranza_documentos?') === 0) return _r([{ id: 2, cliente_id: 501, origen: 'MENSUALIDAD', folio: '9001', periodo: '2026-09', fecha_vencimiento: '2026-10-15', monto: 125000, saldo: 125000, estado: 'PENDIENTE' }]);
      if (path.indexOf('cobranza_clientes?') === 0) return _r([{ cliente_id: 501, estado: 'VENCIDO', estado_desde: '2026-10-16' }]);
      if (path.indexOf('rpc/') === 0) return _r(null);
      return _r([]);
    }
  </script>`;
  const html = leer('cobranza/cartera.html')
    .replace(/<script src="\.\.\/supabase\.js"><\/script>/, () => mock)
    .replace(/<script src="\.\.\/assets\/gestoor-cartera\.js"><\/script>/, () => '<script>' + sinScript(gcJs) + '</script>')
    .replace(/<script src="historial\.js"><\/script>/, () => '<script>' + sinScript(histJs) + '</script>')
    .replace(/<script src="gestiones\.js"><\/script>/, () => '<script>' + sinScript(gestJs) + '</script>')
    .replace(/<script src="estado-texto\.js"><\/script>/, () => '<script>' + sinScript(txtJs) + '</script>')
    .replace(/<script src="cartera\.js"><\/script>/, () => '<script>' + sinScript(carteraJs) + '</script>')
    .replace(/<script>if\(window\.GC_DEMO\)document\.write[^\n]*<\/script>/g, '').replace(/<script>if\(!window\.GC_DEMO\)document\.write[^\n]*<\/script>/g, '')
    .replace(/<script src="\.\.\/assets\/gestoor-menu\.js"><\/script>/, '');
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://gestoor.ejemplo.test/cobranza/cartera.html', pretendToBeVisual: true });
  const w = dom.window as unknown as Record<string, any>;
  w._copiado = null;
  Object.defineProperty(w.navigator, 'clipboard', { configurable: true, value: { writeText: (t: string) => { w._copiado = t; return Promise.resolve(); } } });
  w.open = (u: string) => { w._abierto = u; return null; };
  await espera(150);
  (w.document.querySelector('[data-act="ficha"][data-id="501"]') as HTMLElement | null)?.click();
  await espera(120);
  return w;
}
{
  const w = await pagina({ puede_gestionar: true, puede_registrar_pagos: true });
  const d = w.document as Document;
  const bCop = d.querySelector('[data-act="ec-copiar"]') as HTMLButtonElement | null, bG = d.querySelector('[data-act="gestion"]');
  res('P1 Botón «📋 Copiar estado de cuenta» junto a «Registrar gestión»', !!bCop && !!bG && bCop.parentElement === bG!.parentElement && (bCop.textContent || '').includes('Copiar estado de cuenta'));
  res('P2 Sin teléfono en la ficha → no aparece «WhatsApp»', !d.querySelector('[data-act="ec-wa"]'));
  const antes = (w._llamadas as any[]).length;
  bCop?.click(); await espera(80);
  res('P3 Copia el texto armado con lo que ya cargó la ficha', typeof w._copiado === 'string' && w._copiado.startsWith('Hola, Panadería Ficticia Uno SpA') && w._copiado.includes('Total a pagar: $1.245.000') && w._copiado.includes('«Facturas 9001, 9002»'));
  res('P4 Aviso «Copiado ✓»', (d.getElementById('gcToast')?.textContent || '').includes('Copiado ✓'));
  res('P5 Cero llamadas nuevas al servidor al copiar', (w._llamadas as any[]).length === antes, String((w._llamadas as any[]).length - antes));
  const sug = d.querySelector('[data-act="ec-anotar"]') as HTMLElement | null;
  res('P6 Sugiere «¿Anotar como gestión?»', !!sug && (sug.textContent || '').includes('¿Anotar como gestión?'));
  sug?.click(); await espera(40);
  const m = d.querySelector('.gc-modal') as HTMLElement | null;
  res('P7 Abre «Registrar gestión» precargado (Correo, «Envié estado de cuenta») sin guardar nada',
    !!m && m.querySelector('[data-gtipo="CORREO"]')?.getAttribute('aria-checked') === 'true' && (m.querySelector('#gcGNota') as HTMLTextAreaElement).value === 'Envié estado de cuenta'
    && !(w._llamadas as any[]).some((x) => x.p === 'rpc/cobranza_gestion_registrar'));
  (m!.querySelector('[data-m="si"]') as HTMLElement).click(); await espera(120);
  const ll = (w._llamadas as any[]).filter((x) => x.p === 'rpc/cobranza_gestion_registrar');
  res('P8 Solo al confirmar se registra la gestión (Correo → NOTA con prefijo)', ll.length === 1 && JSON.stringify(ll[0].b) === JSON.stringify({ p_cliente_id: 501, p_tipo: 'NOTA', p_nota: 'Correo: Envié estado de cuenta' }), JSON.stringify(ll));
  w.document.querySelectorAll('script').forEach((x: any) => x.remove());
}
{
  const w = await pagina({ puede_gestionar: false, puede_registrar_pagos: false, rol: 'lectura' });
  const d = w.document as Document;
  res('P9 Solo lectura: igual puede copiar (no escribe nada), con la nota de solo lectura', !!d.querySelector('[data-act="ec-copiar"]') && (d.getElementById('gcDetCuerpo')?.textContent || '').includes('solo lectura'));
  (d.querySelector('[data-act="ec-copiar"]') as HTMLElement).click(); await espera(80);
  res('P10 Solo lectura: copia pero no sugiere anotar gestión', typeof w._copiado === 'string' && !d.querySelector('[data-act="ec-anotar"]'));
  w.document.querySelectorAll('script').forEach((x: any) => x.remove());
}
{
  const w = await pagina({ puede_gestionar: true }, { fecha: '2026-11-07', grupos: [], total_deuda: 0, total_vencido: 0, total_abonos: 0, total: 0, comentario_transferencia: null });
  const d = w.document as Document;
  (d.querySelector('[data-act="ec-copiar"]') as HTMLElement).click(); await espera(80);
  res('P11 Cliente sin deuda: el texto copiado dice que está al día', typeof w._copiado === 'string' && w._copiado.includes('¡Estás al día!'));
  w.document.querySelectorAll('script').forEach((x: any) => x.remove());
}

// ═══ 4 · demo con teléfono ficticio: botón WhatsApp ═══
{
  const demoJs = leer('cobranza/cartera-demo.js');
  const html = leer('cobranza/cartera.html')
    .replace(/<script src="\.\.\/supabase\.js"><\/script>/, () => '<script>window._red=0;function sbFetch(){window._red++;return Promise.reject(new Error("sin red"));}</script>')
    .replace(/<script src="\.\.\/assets\/gestoor-cartera\.js"><\/script>/, () => '<script>' + sinScript(gcJs) + '</script>')
    .replace(/<script>if\(window\.GC_DEMO\)document\.write[^\n]*<\/script>/, () => '<script>' + sinScript(demoJs) + '</script>')
    .replace(/<script src="historial\.js"><\/script>/, () => '<script>' + sinScript(histJs) + '</script>')
    .replace(/<script src="gestiones\.js"><\/script>/, () => '<script>' + sinScript(gestJs) + '</script>')
    .replace(/<script src="estado-texto\.js"><\/script>/, () => '<script>' + sinScript(txtJs) + '</script>')
    .replace(/<script src="cartera\.js"><\/script>/, () => '<script>' + sinScript(carteraJs) + '</script>')
    .replace(/<script>if\(!window\.GC_DEMO\)document\.write[^\n]*<\/script>/g, '')
    .replace(/<script src="\.\.\/assets\/gestoor-menu\.js"><\/script>/, '');
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost:8080/cobranza/cartera.html?demo=1', pretendToBeVisual: true });
  const w = dom.window as unknown as Record<string, any>;
  const d = w.document as Document;
  w.open = (u: string) => { w._abierto = u; return null; };
  await espera(500);
  (d.querySelector('[data-act="ficha"][data-id="103"]') as HTMLElement | null)?.click(); await espera(400);
  const bW = d.querySelector('[data-act="ec-wa"]') as HTMLElement | null;
  res('D1 Demo: con teléfono (ficticio) aparece «WhatsApp»', !!bW);
  bW?.click(); await espera(40);
  res('D2 Demo: abre wa.me con el texto del estado de cuenta y sugiere anotar como WhatsApp',
    typeof w._abierto === 'string' && w._abierto.startsWith('https://wa.me/56900000103?text=') && decodeURIComponent(w._abierto.split('text=')[1]).includes('estado de cuenta con Contadoor')
    && d.querySelector('[data-act="ec-anotar"]')?.getAttribute('data-tipo') === 'WHATSAPP');
  (d.querySelector('[data-act="ec-anotar"]') as HTMLElement).click(); await espera(40);
  res('D3 Demo: el modal queda en WhatsApp con la nota precargada', d.querySelector('.gc-modal [data-gtipo="WHATSAPP"]')?.getAttribute('aria-checked') === 'true');
  res('D4 Demo: ninguna llamada de red', w._red === 0);
  w.document.querySelectorAll('script').forEach((x: any) => x.remove());
}

console.log(`\n${total - fallas}/${total} pruebas OK`);
if (fallas) Deno.exit(1);
