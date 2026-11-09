// P1-B · Puente 12-nov · prueba LOCAL del frontend (no toca Supabase ni producción; datos 100 % ficticios).
// 1) Sonda fail-closed: función inexistente (404/PGRST202) → botón «Registrar envío» DESACTIVADO con texto honesto y CERO llamadas de escritura.
// 2) Con la RPC "instalada" (sbFetch simulado): sube la evidencia con su SHA-256 real y llama a registrar_envio_manual_reporte con los datos correctos.
// 3) Nunca simula éxito: error de la base o respuesta sin ok=true → error visible. 4) Nota del analista (base / solo local). 5) PDF y regresión del render.
// Uso: deno run --allow-read --allow-env --allow-sys --allow-net=registry.npmjs.org pruebas/reporte_puente_test.ts
import { JSDOM } from 'npm:jsdom@24.1.0';

const RAIZ = new URL('../', import.meta.url);
const leer = (p: string) => Deno.readTextFileSync(new URL(p, RAIZ));
const emJs = leer('panel-de-control/envio-manual.js'), pdfJs = leer('assets/reporte-pdf.js'), repJs = leer('reporte-email.js'), panel = leer('panel-de-control/index.html');
const espera = (ms = 60) => new Promise((r) => setTimeout(r, ms));
let total = 0, fallas = 0;
const res = (n: string, ok: boolean, det = '') => { total++; console.log((ok ? 'OK   ' : 'MAL  ') + n + (ok || !det ? '' : ' · ' + det)); if (!ok) fallas++; };
const hex = async (s: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))).map((x) => x.toString(16).padStart(2, '0')).join('');

type Llamada = { url: string; body: any; method: string };
function entorno(rpcResp: Record<string, () => { status: number; body: any }>, storageStatus = 200) {
  const dom = new JSDOM('<!DOCTYPE html><body></body>', { runScripts: 'outside-only', url: 'https://gestoor.ejemplo.test/panel-de-control/' });
  const w: any = dom.window; const llamadas: Llamada[] = [];
  Object.defineProperty(w, 'crypto', { value: globalThis.crypto, configurable: true });
  const resp = (status: number, body: any) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
  w.sbFetch = (path: string, o: any = {}) => { llamadas.push({ url: path, body: o.body ? JSON.parse(o.body) : null, method: o.method || 'GET' });
    const fn = path.replace(/^rpc\//, ''); const r = rpcResp[fn] || rpcResp[path.split('?')[0]]; if (!r) return Promise.resolve(resp(404, { code: 'PGRST202', message: 'Could not find the function' }));
    const x = r(); return Promise.resolve(resp(x.status, x.body)); };
  w.fetch = (url: string, o: any = {}) => { llamadas.push({ url, body: '[archivo]', method: o.method }); return Promise.resolve(resp(storageStatus, storageStatus === 200 ? { Key: 'ok' } : 'error')); };
  w.SB_URL = 'https://ficticio.supabase.test'; w.SB_KEY = 'clave-anon-ficticia'; w._gestoorAccessToken = 'jwt-ficticio';
  w.eval(pdfJs); w.eval(emJs);
  return { w, llamadas, EM: w.GestoorEnvioManual };
}
const NO_INSTALADA = {};   // sin entradas → 404 PGRST202 para toda RPC
const INSTALADA = (puede = true, regBody: any = null, regStatus = 200) => ({
  reporte_envio_manual_disponible: () => ({ status: 200, body: { version: 'P1B-PUENTE12-V2', contrato: 2, envio_manual: true, resultado_entrega: true, nota: true, puede_operar: puede } }),
  registrar_envio_manual_reporte: () => ({ status: regStatus, body: regBody ?? { ok: true, estado: 'REGISTRADO', fecha_envio: '2026-11-08', intento_n: 1, nuevos: 1, registros: [{ id: 1, destinatario: 'cliente.uno@ejemplo.test' }] } }),
  guardar_nota_reporte: () => ({ status: 200, body: { ok: true, estado: 'GUARDADA', nota: 'Nota ficticia' } }),
  registrar_resultado_envio_manual: () => ({ status: 200, body: { ok: true, estado: 'REGISTRADO', resultado: 'REBOTE', resultado_id: 1 } }),
  v_reportes_envios_estado: () => ({ status: 200, body: [{ envio_id: 11, intento_n: 1, destinatario: 'cliente.uno@ejemplo.test', fecha_envio: '2026-11-08', registrado_nombre: 'Analista Ficticia', estado_entrega: 'SIN_CONFIRMAR' }] }),
});
const CTX = { intentoId: '11111111-2222-4333-8444-555555555555', reporteId: 7001, periodo: '2026-10', periodoTxt: 'Octubre 2026', empresa: 'Empresa Ficticia Uno SpA', destinatarios: ['cliente.uno@ejemplo.test'], responsable: 'Analista Ficticia', remitente: 'analista@ejemplo.test', listo: true, motivos: [] };
const fecha = new Date(Date.now() - 3600e3); const fechaLocal = new Date(fecha.getTime() - fecha.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
const valores = (archivo: any) => ({ destinatarios: 'Cliente.Uno@Ejemplo.test', remitente: 'analista@ejemplo.test', asunto: 'Reporte mensual Octubre 2026', enviadoAt: fechaLocal, tipo: 'CAPTURA_ENVIADOS', archivo, adjunto: null, obs: '' });

// ── 1) Estado de la sonda (puro) ──
{ const { EM } = entorno(NO_INSTALADA);
  res('Sonda 404 PGRST202 → no_instalado', EM.estadoDesdeRespuesta({ status: 404, ok: false, json: { code: 'PGRST202', message: 'Could not find the function public.reporte_envio_manual_disponible' } }).estado === 'no_instalado');
  res('Sonda ok + contrato 2 + puede_operar → disponible', EM.estadoDesdeRespuesta({ status: 200, ok: true, json: { envio_manual: true, contrato: 2, puede_operar: true } }).estado === 'disponible');
  res('Sonda con contrato 1 (R1) → error (no se usa una base con otro contrato)', EM.estadoDesdeRespuesta({ status: 200, ok: true, json: { envio_manual: true, puede_operar: true } }).estado === 'error');
  res('Sonda ok sin permiso → sin_permiso', EM.estadoDesdeRespuesta({ status: 200, ok: true, json: { envio_manual: true, contrato: 2, puede_operar: false } }).estado === 'sin_permiso');
  res('Sonda 500 → error (desactiva)', EM.estadoDesdeRespuesta({ status: 500, ok: false, json: { message: 'x' } }).estado === 'error');
  res('Sonda 200 con cuerpo inesperado → error (no se asume instalado)', EM.estadoDesdeRespuesta({ status: 200, ok: true, json: {} }).estado === 'error');
  res('Texto honesto: "NO está instalado" y "no registra"', /NO está instalado/.test(EM.estadoDesdeRespuesta({ status: 404, json: {} }).texto) && /no registra/.test(EM.estadoDesdeRespuesta({ status: 404, json: {} }).texto)); }

// ── 2) Validación local ──
{ const { EM, w } = entorno(NO_INSTALADA); const png = new File(['captura ficticia'], 'enviado.png', { type: 'image/png' });
  res('Validación ok con datos completos', EM.validarRegistro(valores(png)).ok);
  res('Destinatario inválido', !EM.validarRegistro({ ...valores(png), destinatarios: 'no-es-correo' }).ok);
  res('Sin evidencia', !EM.validarRegistro({ ...valores(null) }).ok);
  res('Tipo EML con .png', !EM.validarRegistro({ ...valores(png), tipo: 'EML' }).ok);
  res('Fecha futura', !EM.validarRegistro({ ...valores(png), enviadoAt: '2099-01-01T10:00' }).ok);
  res('Remitente vacío', !EM.validarRegistro({ ...valores(png), remitente: '' }).ok);
  res('.eml acepta tipo EML', EM.validarRegistro({ ...valores(new File(['From: x'], 'correo.eml', { type: '' })), tipo: 'EML' }).ok);
  res('Destinatarios normalizados y sin repetir', JSON.stringify(EM.parsearDestinatarios('A@b.cl; a@b.cl, c@d.cl').lista) === '["a@b.cl","c@d.cl"]'); void w; }

// ── 3) Fail-closed con la RPC NO instalada ──
{ const { EM, w, llamadas } = entorno(NO_INSTALADA);
  EM.abrir({ ...CTX }); await espera();
  for (const id of ['em-c1', 'em-c2', 'em-c3']) { const c = w.document.getElementById(id); c.checked = true; c.onchange(); }
  const b = w.document.getElementById('em-reg');
  res('No instalada: botón Registrar DESACTIVADO aun con los 3 pasos marcados', b.disabled === true);
  res('No instalada: motivo honesto visible', /NO está instalado/.test(w.document.getElementById('em-reg-motivo').textContent));
  res('No instalada: aviso naranjo arriba', /NO está instalado/.test(w.document.getElementById('em-sonda').textContent));
  const antes = llamadas.length; let err = '';
  try { await EM.registrar(CTX, valores(new File(['x'], 'enviado.png', { type: 'image/png' }))); } catch (e) { err = String((e as Error).message); }
  const nuevas = llamadas.slice(antes);
  res('No instalada: registrar() rechaza (nunca éxito simulado)', /NO está instalado/.test(err), err);
  res('No instalada: CERO subidas a storage y CERO llamadas a registrar_envio_manual_reporte', !nuevas.some((l) => /storage|registrar_envio/.test(l.url)), JSON.stringify(nuevas.map((l) => l.url))); }

// ── 4) Reporte NO listo ──
{ const { w, EM } = entorno(INSTALADA());
  EM.abrir({ ...CTX, listo: false, motivos: ['Contable sin «OK para el Panel»'] }); await espera();
  res('No listo: paso 1 bloqueado y botón desactivado', w.document.getElementById('em-c1').disabled === true && w.document.getElementById('em-reg').disabled === true);
  res('No listo: dice "No lo envíes"', /No lo envíes/.test(w.document.body.textContent)); }

// ── 5) RPC instalada: flujo completo ──
{ const { EM, w, llamadas } = entorno(INSTALADA());
  EM.abrir({ ...CTX }); await espera();
  for (const id of ['em-c1', 'em-c2', 'em-c3']) { const c = w.document.getElementById(id); c.checked = true; c.onchange(); }
  res('Instalada: botón habilitado tras los 3 pasos', w.document.getElementById('em-reg').disabled === false);
  const contenido = 'captura ficticia de enviados'; const png = new File([contenido], 'Enviado.PNG', { type: 'image/png' });
  const j = await EM.registrar(CTX, valores(png)); const h = await hex(contenido);
  const sub = llamadas.find((l) => /storage\/v1\/object\/reportes-envio-evidencia\//.test(l.url));
  const reg = llamadas.find((l) => /rpc\/registrar_envio_manual_reporte/.test(l.url));
  res('Instalada: sube a reportes-envio-evidencia/7001/<sha256>.png (huella real del archivo)', !!sub && sub.url.endsWith(`/7001/${h}.png`), sub?.url);
  res('Instalada: RPC con reporte, período, destinatario normalizado, sha y ruta', !!reg && reg.body.p_reporte_id === 7001 && reg.body.p_periodo === '2026-10'
      && JSON.stringify(reg.body.p_destinatarios) === '["cliente.uno@ejemplo.test"]' && reg.body.p_evidencia_sha256 === h && reg.body.p_evidencia_path === `7001/${h}.png`
      && reg.body.p_evidencia_tipo === 'CAPTURA_ENVIADOS' && !isNaN(Date.parse(reg.body.p_enviado_at)), JSON.stringify(reg?.body));
  res('Instalada: devuelve REGISTRADO de la base', j.estado === 'REGISTRADO');
  const md5ref = (await import('node:crypto')).createHash('md5').update(contenido).digest('hex');
  res('R2: envía p_intento_id del registro y p_evidencia_md5 = MD5 real del archivo (lo compara el servidor con el almacenamiento)', reg?.body.p_intento_id === CTX.intentoId && reg?.body.p_evidencia_md5 === md5ref, reg?.body.p_evidencia_md5);
  const j2 = await EM.registrar(CTX, { ...valores(png), motivo: 'Rebotó el primer envío' });
  const regs = llamadas.filter((l) => /rpc\/registrar_envio_manual_reporte/.test(l.url));
  res('R2: reintento desde el mismo registro usa el MISMO intento (no duplica) y manda el motivo de reenvío', regs.length === 2 && regs[1].body.p_intento_id === CTX.intentoId && regs[1].body.p_motivo_reenvio === 'Rebotó el primer envío' && !!j2); }
{ const { EM } = entorno(INSTALADA()); let err = ''; try { await EM.registrar({ ...CTX, intentoId: undefined }, valores(new File(['x'], 'e.png', { type: 'image/png' }))); } catch (e) { err = String((e as Error).message); }
  res('R2: sin id de intento no registra', /intento/.test(err)); }
{ const { EM, w } = entorno(INSTALADA()); EM.abrir({ ...CTX }); await espera(120);
  const id1 = (w.document.getElementById('em-motivo') !== null);
  res('R2: el modal pide «Motivo del reenvío» y explica que registrar el envío NO confirma la entrega', id1 && /NO confirma la entrega/.test(w.document.body.textContent) && /declarada/.test(w.document.body.textContent));
  res('R2: lista de envíos desde v_reportes_envios_estado con estado de entrega y botón «Registrar rebote / entrega»', /entrega sin confirmar/.test(w.document.getElementById('em-previos').textContent) && !!w.document.querySelector('.em-res')); }
{ const { EM, llamadas } = entorno(INSTALADA()); const ev = new File(['aviso de no entrega ficticio'], 'rebote.eml', { type: '' });
  const r = await EM.registrarResultado({ intentoId: '99999999-2222-4333-8444-555555555555', reporteId: 7001, envioId: 11, resultado: 'REBOTE', tipo: 'AVISO_NO_ENTREGA', ocurridoAt: fechaLocal, detalle: 'Buzón inexistente', archivo: ev });
  const c = llamadas.find((l) => /registrar_resultado_envio_manual/.test(l.url));
  res('R2: rebote se registra APARTE (registrar_resultado_envio_manual) con su evidencia, intento y MD5', r.resultado === 'REBOTE' && c?.body.p_envio_id === 11 && c?.body.p_resultado === 'REBOTE' && /^[0-9a-f]{32}$/.test(c?.body.p_evidencia_md5) && c?.body.p_intento_id.startsWith('9999'));
  let err = ''; try { await EM.registrarResultado({ intentoId: 'x', reporteId: 7001, envioId: 11, resultado: 'ENTREGA_CONFIRMADA', tipo: 'AVISO_NO_ENTREGA', ocurridoAt: fechaLocal, detalle: 'xxxxx', archivo: ev }); } catch (e) { err = String((e as Error).message); }
  res('R2: entrega confirmada con «aviso de no entrega» → rechazo local', /no sirve/.test(err)); }
{ const { EM } = entorno(NO_INSTALADA); let err = ''; try { await EM.registrarResultado({ intentoId: 'x', reporteId: 7001, envioId: 11, resultado: 'REBOTE', tipo: 'CAPTURA', ocurridoAt: fechaLocal, detalle: 'xxxxx', archivo: new File(['x'], 'c.png', { type: 'image/png' }) }); } catch (e) { err = String((e as Error).message); }
  res('R2: sin RPC instalada tampoco registra resultados (fail-closed)', /NO está instalado/.test(err)); }
{ const { EM } = entorno(INSTALADA(), 409);   // evidencia ya subida (reintento): sigue y la RPC lo verifica
  let ok = false; try { ok = (await EM.registrar(CTX, valores(new File(['x'], 'e.png', { type: 'image/png' })))).ok === true; } catch { ok = false; }
  res('Reintento: storage 409 (ya existe, misma huella) → continúa con la RPC', ok); }
{ const { EM } = entorno(INSTALADA(true, { code: '22023', message: 'REENVIO_SIN_MOTIVO: cliente.uno@ejemplo.test ya tiene un envío registrado de este reporte' }, 400));
  let err = ''; try { await EM.registrar(CTX, valores(new File(['x'], 'e.png', { type: 'image/png' }))); } catch (e) { err = String((e as Error).message); }
  res('Error de la base (REENVIO_SIN_MOTIVO) → mensaje claro pidiendo el motivo, sin éxito', /escribe el motivo/.test(err), err); }
{ const { EM } = entorno(INSTALADA(true, { algo: 1 }, 200));
  let err = ''; try { await EM.registrar(CTX, valores(new File(['x'], 'e.png', { type: 'image/png' }))); } catch (e) { err = String((e as Error).message); }
  res('Respuesta 200 sin ok=true → se trata como error (nunca éxito supuesto)', err.length > 0); }
{ const { EM } = entorno(INSTALADA(false));
  let err = ''; try { await EM.registrar(CTX, valores(new File(['x'], 'e.png', { type: 'image/png' }))); } catch (e) { err = String((e as Error).message); }
  res('Sin módulo Panel → no registra', /módulo Panel/.test(err), err); }

// ── 6) Nota del analista ──
{ const { EM, llamadas } = entorno(NO_INSTALADA); const r = await EM.guardarNota(7001, 'hola', '');
  res('Nota sin RPC → modo local y lo dice', r.modo === 'local' && /SOLO en este computador/.test(r.texto));
  res('Nota sin RPC → ninguna llamada a guardar_nota_reporte', !llamadas.some((l) => /guardar_nota/.test(l.url))); }
{ const { EM, llamadas } = entorno(INSTALADA()); const r = await EM.guardarNota(7001, 'Nota ficticia', 'anterior');
  const c = llamadas.find((l) => /guardar_nota_reporte/.test(l.url));
  res('Nota con RPC → modo base con texto anterior (control optimista)', r.modo === 'base' && c?.body.p_texto_anterior === 'anterior' && c?.body.p_reporte_id === 7001); }
{ const e = INSTALADA(); (e as any).guardar_nota_reporte = () => ({ status: 400, body: { code: '22023', message: 'NOTA_DESACTUALIZADA: otra persona' } });
  const { EM } = entorno(e); let err = ''; try { await EM.guardarNota(7001, 'x', 'y'); } catch (x) { err = String((x as Error).message); }
  res('Nota desactualizada → mensaje "Recarga el Panel"', /Recarga el Panel/.test(err)); }

// ── 7) PDF y render ──
{ const { w } = entorno(NO_INSTALADA); const P = w.GestoorReportePDF;
  const doc = P.documento('<table><tr><td>Hola</td></tr></table>', 'Reporte_2026-10_X');
  res('PDF: documento propio con @page A4, colores exactos y sin el Panel', /@page\{size:A4/.test(doc) && /print-color-adjust:exact/.test(doc) && /<div class="rp-pdf"><table>/.test(doc) && !/modal/.test(doc));
  res('PDF: nombre de archivo limpio', P.nombreArchivo({ periodo: '2026-10', empresa: 'Panadería Ñuñoa & Cía. SpA' }) === 'Reporte_2026_10_Panaderia_Nunoa_Cia_SpA');
  let err = ''; try { await P.imprimir('', {}); } catch (e) { err = String((e as Error).message); } res('PDF: sin HTML no imprime (error claro)', /No hay reporte/.test(err)); }
{ const dom = new JSDOM('<body></body>', { runScripts: 'outside-only', url: 'https://gestoor.ejemplo.test/' }); const w: any = dom.window; w.eval(repJs);
  const per = w.GestoorReporte.persona('Persona Ficticia', 'Asesora', 'a@ejemplo.test');
  const d = { periodo: 'Octubre 2026', contacto: 'X', empresa: 'Ficticia', modalidad: 'contadoor', plan: 'asesoria', fechas: [{ dia: 13, mes: 'nov', que: 'Previred' }], aviso: {}, items: [{ tipo: 'cot', titulo: 'Cot', detalle: '', monto: 100, paga: 'contadoor', vence: 'Vence 13', donde: 'Previred' }, { tipo: 'conv', titulo: 'Convenio', detalle: '', monto: 50, paga: 'contadoor', vence: 'Vence 25', donde: 'TGR' }],
    historial: [{ mes: 'Oct 26', actual: true, cot: 100, imp: 0, serv: 0, otros: 50, total: 150 }], anexo: [], analista: per, asesores: [per] };
  let ok = true; try { w.GestoorReporte.render(d); } catch { ok = false; }
  res('Regresión: reporte completo con convenio (historial "otros" > 0) ya NO se cae (antes TIPOS.deuda indefinido)', ok); }

// ── 8) Panel: integración estática ──
res('Panel: ya no hay window.print() de la página completa', !/onclick="window\.print\(\)"/.test(panel));
res('Panel: botón "Registrar envío manual" y scripts cargados', /abrirEnvioManual\(\)/.test(panel) && /assets\/reporte-pdf\.js/.test(panel) && /envio-manual\.js/.test(panel));
res('Panel: la nota se escapa en el textarea (hesc)', /hesc\(r\.obsAnalista\|\|''\)/.test(panel));
res('Panel: el envío automático sigue apagado (ENVIO_REPORTE_ACTIVO=false)', /var ENVIO_REPORTE_ACTIVO=false;/.test(panel));

console.log(`\nRESULTADO: ${total - fallas} OK · ${fallas} MAL · total ${total}`);
if (fallas) Deno.exit(1);
