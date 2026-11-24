// DIAGNÓSTICO «AQUÍ PARTIMOS» · prueba LOCAL del documento y de la pantalla en jsdom con sbFetch simulado. Datos 100 % ficticios.
// Uso: deno run --allow-read --allow-env --allow-sys pruebas/diagnostico_test.ts
import { JSDOM, VirtualConsole } from 'npm:jsdom@24.1.0';
const RAIZ = new URL('../', import.meta.url);
const leer = (p: string) => Deno.readTextFileSync(new URL(p, RAIZ));
let ok = 0, mal = 0;
const res = (n: string, b: boolean, d: unknown = '') => { if (b) { ok++; console.log('OK  ', n); } else { mal++; console.log('MAL ', n, JSON.stringify(d).slice(0, 300)); } };
const espera = (ms = 40) => new Promise((r) => setTimeout(r, ms));
const DOC = leer('clientes/diagnostico-doc.js'), APP = leer('clientes/diagnostico.js'), HTML = leer('clientes/diagnostico.html'), FICHA = leer('clientes/index.html'),
      SIMPLE = leer('prospectos/simple.js'), DATOS = leer('pruebas/diagnostico-datos.js'), LIVA = leer('pruebas/levantamiento-iva-datos.js');
const texto = (h: string) => h.replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ');

// ── 0. Estándar del módulo ──
res('0.1 página con auth-pending + guard, supabase.js antes del módulo y auth.js al final',
  /<html lang="es" class="auth-pending">/.test(HTML) && /id="gestoor-auth-guard"/.test(HTML) && HTML.indexOf('<script src="../supabase.js">') < HTML.indexOf('<script src="diagnostico.js">') && HTML.indexOf('../auth.js') > HTML.indexOf('<script src="diagnostico.js">'));
res('0.2 sin SB_KEY, sbH propio, Bearer ni fetch directo', !/SB_KEY|function sbH|Bearer|[^.]fetch\(/.test(DOC + APP));
res('0.3 la pantalla no usa innerHTML ni carga librerías externas', !/innerHTML/.test(APP) && !/<script/i.test(DOC + APP));
res('0.4 sin emojis en el documento ni en la pantalla', !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}]/u.test(DOC + APP));
res('0.5 nunca «honorarios», «tributario» como nombre del informe, ni la dirección personal', !/honorario/i.test(DOC + APP) && !/diagn[oó]stico tributario/i.test(DOC + APP) && !/laguna|inca\b|0956/i.test(DOC + APP));
res('0.6 demo solo en localhost (doble candado: HTML y JS)', /local&&/.test(HTML) && /var DEMO = esLocal\(\) &&/.test(APP));
res('0.7 logos según fondo: WHITE en la portada oscura y GLOSSY en interiores (existen en assets)',
  /contadoor-lockup-white\.png/.test(APP) && /contadoor-lockup-glossy\.png/.test(APP) && Deno.statSync(new URL('assets/contadoor-lockup-white.png', RAIZ)).size > 10000);
res('0.8 botón en la ficha del cliente (id numérico) y en la ficha del prospecto', /diagnostico\.html\?cliente='\+Number\(c\.id\)/.test(FICHA) && /diagnostico\.html\?lead='\+Number\(p\.id\)/.test(SIMPLE));

// ── 1. Modelo y documento (sin DOM) ──
const g: any = {}; new Function('globalThis', DATOS + '\n' + LIVA + '\n' + DOC).call(g, g);
const D = g.GestoorDiagDoc;
const L = { logoBlanco: 'https://x.test/w.png', logoColor: 'https://x.test/c.png' };
const M = D.modelo(g.DIAG_DEMO_CLIENTE, { liva: g.LIVA_DEMO, historial: g.DIAG_DEMO_HIST, estadoLiva: 'ok', estadoHist: 'ok', hoy: '2026-11-24T12:00:00' });
res('1.1 modelo DIAG_V1 con secciones resumen → propuesta', M.formato === 'DIAG_V1' && M.secciones.map((s: any) => s.id).join() === 'resumen,f29,iva,f22,sii,rcv,pagos,propuesta');
const A: any = {}; M.secciones[0].areas.forEach((a: any) => A[a.area] = a.estado);
res('1.2 semáforo: F29 urgente (atrasados), IVA urgente, F22 urgente, SII urgente, RCV revisar, pagos urgente', A.f29 === 'urgente' && A.iva === 'urgente' && A.f22 === 'urgente' && A.sii === 'urgente' && A.rcv === 'revisar' && A.pagos === 'urgente', A);
const P = M.secciones.find((s: any) => s.id === 'propuesta');
res('1.3 propuesta: F29 sin declarar con cantidad 8 y valor UF desde el catálogo / UF del período', P.items[0].cantidad === 8 && Math.abs(P.items[0].valor_uf - 0.48) < 0.001, P.items[0]);
res('1.4 propuesta: Renta observada / sin declaración queda «A definir» y a confirmar', P.items.filter((x: any) => /Renta/.test(x.glosa) && x.valor_uf === null && x.a_confirmar).length === 2);
res('1.5 plan mensual desde el onboarding (PRO 3 UF)', P.plan && P.plan.codigo === 'asesoria' && P.plan.valor_uf === 3);
const H = D.documento(M, L), T = texto(H);
res('1.6 título y nombre exactos del informe', /Tu diagnóstico «Aquí partimos»/.test(T) && /Diagnóstico contable de inicio/.test(T));
res('1.7 firma Contadoor + analista a cargo', /Contadoor Asesorías Contadoor Ltda\./.test(T) && /Analista Ficticia Asesora Contable Analista a cargo/.test(T));
res('1.8 «nuestros servicios», valores en UF y exentos de IVA', /Nuestros servicios/.test(T) && /3,84 UF/.test(T) && /Valores exentos de IVA/.test(T));
res('1.9 estimación de intereses y multa siempre «a confirmar»', /Multa \(art\. 97 N°11\) \$[\d.]+ a confirmar/.test(T) && /Total estimado \$[\d.]+ a confirmar/.test(T));
res('1.10 grilla F29 por año con ND y ✓', /<table class="grilla">/.test(H) && (H.match(/>ND</g) || []).length === 8);
res('1.11 portada oscura con logo white; interiores con glossy', H.indexOf('w.png') < H.indexOf('Diagnóstico contable de inicio') && /c\.png/.test(H));
res('1.12 F22 y cartas en el documento', /AT 2026/.test(T) && /F135/.test(T) && /Notificación de Giro/.test(T));
res('1.13 pagos del año desde el historial (contrato HIST_ANUAL_V1)', /Tus pagos del año/.test(T) && /Pendiente de pago/.test(T));
const Mx = D.modelo(JSON.parse(JSON.stringify(Object.assign({}, g.DIAG_DEMO_CLIENTE, { cliente: Object.assign({}, g.DIAG_DEMO_CLIENTE.cliente, { razon_social: '<img src=x onerror=alert(1)>' }) }))), {});
res('1.14 todo dato externo escapado', !/<img src=x/.test(D.documento(Mx, L)) && /&lt;img src=x/.test(D.documento(Mx, L)));
const M2 = D.modelo(g.DIAG_DEMO_CLIENTE, { estadoHist: 'no_instalado' });
const T2 = texto(D.documento(M2, L)); const A2: any = {}; M2.secciones[0].areas.forEach((a: any) => A2[a.area] = a.estado);
res('1.15 sin levantamiento ni historial: esas áreas quedan «a confirmar» y el bloque de pagos «en preparación»', A2.iva === 'confirmar' && A2.pagos === 'confirmar' && /próxima versión/.test(T2));
const MP = D.modelo(g.DIAG_DEMO_PROSPECTO, { hoy: '2026-11-24T12:00:00' }); const TP = texto(D.documento(MP, L));
res('1.16 prospecto: todas las áreas «a confirmar», solo propuesta; plan de la cotización', MP.secciones.map((s: any) => s.id).join() === 'resumen,propuesta' && MP.secciones[0].areas.every((a: any) => a.estado === 'confirmar') && /Atención/.test(TP) && /3,00 UF al mes/.test(TP));
const M3 = D.modelo(g.DIAG_DEMO_CLIENTE, { liva: g.LIVA_DEMO, ajustes: { semaforo: { rcv: 'bien' }, items: [{ glosa: 'Servicio especial', cantidad: 2, valor_uf: 1.5, a_confirmar: false }], plan: null, notas: 'Nota uno\nNota dos' } });
res('1.17 ajustes: semáforo manual, ítems y notas', M3.secciones[0].areas.find((a: any) => a.area === 'rcv').estado === 'bien' && M3.secciones.at(-1).total_uf === 3 && /Nota dos/.test(texto(D.documento(M3, L))));
res('1.18 el modelo no lleva claves, correos ni teléfonos', !/@|clave_sii|\+56/.test(JSON.stringify(M)));

// ── 2. Pantalla (jsdom) ──
function pagina(q: string, resp: (p: string, b: any) => [number, unknown]) {
  const vc = new VirtualConsole(); vc.on('jsdomError', (e: Error) => { if (!/Not implemented/.test(String(e && e.message))) console.error(e); });
  const dom = new JSDOM(`<!doctype html><body><div id="dgApp"></div></body>`, { runScripts: 'outside-only', url: 'https://gestoor.contadoor.cl/clientes/diagnostico.html' + q, virtualConsole: vc });
  const w: any = dom.window; const llam: any[] = [];
  w.confirm = () => true;
  w.sbFetch = (p: string, o: any) => { const b = JSON.parse(o.body || '{}'); llam.push([p, b]); const [st, j] = resp(p, b);
    return Promise.resolve({ ok: st === 200, status: st, text: () => Promise.resolve(JSON.stringify(j)) }); };
  w.eval(DATOS); w.eval(LIVA); w.eval(DOC); w.eval(APP);
  return { w, d: w.document as Document, llam };
}
const base = (w: any, extra: Record<string, [number, unknown]> = {}) => (p: string): [number, unknown] => {
  if (extra[p]) return extra[p];
  if (p === 'rpc/diag_datos_cliente') return [200, w.DIAG_DEMO_CLIENTE];
  if (p === 'rpc/diag_datos_prospecto') return [200, w.DIAG_DEMO_PROSPECTO];
  if (p === 'rpc/sii_levantamiento_iva') return [200, w.LIVA_DEMO];
  if (p === 'rpc/sii_historial_anual') return [404, { code: 'PGRST202', message: 'Could not find the function' }];
  if (p === 'rpc/diag_emitir') return [200, { ok: true, id: 41, version: 1, enlace: 'https://gestoor.contadoor.cl/clientes/diagnostico.html?informe=41' }];
  if (p === 'rpc/onb_pasos_cliente') return [200, { caso_id: 70, lista_version: 2, pasos: [{ paso: 9, marca: { estado: 'en_curso', actualizado: '2026-11-20T13:00:00Z' } }] }];
  if (p === 'rpc/onb_paso_marcar_v2') return [200, { ok: true }];
  return [404, {}];
};
{
  let w: any; const P1 = pagina('?cliente=9001', (p, b) => base(w)(p)); w = P1.w; await espera(120);
  const f = P1.d.getElementById('dg-frame') as any;
  res('2.1 carga datos del cliente, levantamiento (60 meses) e historial', P1.llam.map((x) => x[0]).join() === 'rpc/diag_datos_cliente,rpc/sii_levantamiento_iva,rpc/sii_historial_anual'
    && P1.llam[1][1].p_desde.length === 6 && P1.llam[1][1].p_hasta.length === 6);
  res('2.2 historial no instalado → bloque de pagos «a confirmar» sin romper la pantalla', w.GestoorDiag.estado().estadoHist === 'no_instalado' && /próxima versión/.test(texto(f.getAttribute('srcdoc') || f.srcdoc || '')));
  (P1.d.getElementById('dg-notas') as any).value = 'Observación de prueba'; (P1.d.getElementById('dg-notas') as any).dispatchEvent(new w.Event('input')); await espera(250);
  res('2.3 la vista previa se actualiza con los ajustes', /Observación de prueba/.test(f.srcdoc || ''));
  (P1.d.getElementById('dg-emitir') as any).click(); await espera(80);
  const em = P1.llam.find((x) => x[0] === 'rpc/diag_emitir');
  res('2.4 emitir manda el modelo DIAG_V1 al cliente correcto', em && em[1].p_cliente_id === 9001 && em[1].p_lead_id === null && em[1].p_datos.formato === 'DIAG_V1' && /Observación de prueba/.test(em[1].p_datos.notas));
  res('2.5 muestra el enlace https emitido', (P1.d.getElementById('dg-enlace') as any)?.href === 'https://gestoor.contadoor.cl/clientes/diagnostico.html?informe=41');
  (P1.d.getElementById('dg-paso9') as any).click(); await espera(80);
  const m9 = P1.llam.find((x) => x[0] === 'rpc/onb_paso_marcar_v2');
  res('2.6 marca el paso 9 con el enlace y la versión de la marca (onb_paso_marcar_v2)', m9 && m9[1].p_caso_id === 70 && m9[1].p_paso === 9 && m9[1].p_estado === 'listo' && m9[1].p_enlace === 'https://gestoor.contadoor.cl/clientes/diagnostico.html?informe=41' && m9[1].p_version === '2026-11-20T13:00:00Z');
  res('2.7 confirma al usuario', /Paso 9 del onboarding marcado/.test(P1.d.getElementById('dg-res')!.textContent || ''));
}
{
  let w: any; const P2 = pagina('?cliente=9001', (p) => base(w, { 'rpc/diag_datos_cliente': [403, { code: '42501', message: 'SIN_PERMISO' }] })(p)); w = P2.w; await espera(80);
  res('2.8 sin permiso: mensaje claro y no llama a nada más', /No tienes permiso/.test(P2.d.getElementById('dgApp')!.textContent || '') && P2.llam.length === 1);
}
{
  let w: any; const P3 = pagina('?cliente=9001', (p) => base(w, { 'rpc/diag_emitir': [400, { code: '22023', message: 'CLAVE_PROHIBIDA' }] })(p)); w = P3.w; await espera(120);
  (P3.d.getElementById('dg-emitir') as any).click(); await espera(80);
  res('2.9 error al emitir: mensaje en español y el botón se reactiva', /parece una clave/.test(P3.d.getElementById('dg-res')!.textContent || '') && !(P3.d.getElementById('dg-emitir') as any).disabled);
}
{
  let w: any; const dc = (ww: any) => Object.assign({}, ww.DIAG_DEMO_CLIENTE, { actor: { nombre: 'X', rol: 'rrhh', puede_emitir: false, puede_levantamiento: false } });
  const P4 = pagina('?cliente=9001', (p) => base(w, { 'rpc/diag_datos_cliente': [200, dc(w)] })(p)); w = P4.w; await espera(120);
  res('2.10 RRHH: ve e imprime, sin botón Emitir y sin pedir el levantamiento', !P4.d.getElementById('dg-emitir') && !P4.llam.some((x) => x[0] === 'rpc/sii_levantamiento_iva') && !!P4.d.getElementById('dg-imprimir'));
}
{
  let w: any; const P5 = pagina('?lead=30', (p) => base(w)(p)); w = P5.w; await espera(120);
  (P5.d.getElementById('dg-emitir') as any).click(); await espera(80);
  const em = P5.llam.find((x) => x[0] === 'rpc/diag_emitir');
  res('2.11 prospecto: solo diag_datos_prospecto y emite con p_lead_id', P5.llam[0][0] === 'rpc/diag_datos_prospecto' && em && em[1].p_lead_id === 30 && em[1].p_cliente_id === null && !P5.d.getElementById('dg-paso9'));
}
{
  let w: any; const P6 = pagina('?informe=41', (p) => base(w, { 'rpc/diag_informe': [200, { id: 41, tipo: 'cliente', cliente_id: 9001, version: 1, estado: 'anulado', anulacion_motivo: 'Plan equivocado', huella_ok: true, emitido_at: '2026-11-24T15:00:00Z', emitido_por: 'Analista Ficticia', datos: D.modelo(w.DIAG_DEMO_CLIENTE, {}) }] })(p)); w = P6.w; await espera(80);
  const f = P6.d.getElementById('dg-frame') as any;
  res('2.12 reabrir copia emitida: solo lectura, avisa ANULADO y muestra el mismo documento', /ANULADO/.test(P6.d.getElementById('dgApp')!.textContent || '') && /Aquí partimos/.test(f.srcdoc || '') && !P6.d.getElementById('dg-emitir'));
}
{
  const P7 = pagina('?cliente=abc', () => [200, {}]); await espera(40);
  res('2.13 sin id válido no llama al servidor', P7.llam.length === 0 && /Abre el diagnóstico/.test(P7.d.getElementById('dgApp')!.textContent || ''));
}
console.log(`\n${ok}/${ok + mal} OK`);
if (mal) Deno.exit(1);
