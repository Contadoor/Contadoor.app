// CRM de Prospectos (prospectos/crm.html + crm.js) · prueba LOCAL (no toca Supabase; datos 100 % ficticios).
// 1) Lógica pura: columnas ↔ etapas reales, agrupar, "Otros", argumentos de com_ficha_guardar al mover, semana del calendario
//    (lunes a viernes, hora de Chile), unión de reuniones y totales.
// 2) En jsdom con sbFetch simulado: embudo y calendario pintados, mover de etapa (select accesible y arrastre), error → vuelve a su
//    columna, conflicto de versión → recarga, Perdido pide motivo, Ganado ofrece onboarding, solo lectura sin arrastre, escape de HTML
//    y SOLO las RPC permitidas.
// Uso: deno run --allow-read --allow-env --allow-sys --allow-net=registry.npmjs.org pruebas/com_crm_test.ts
import { JSDOM } from 'npm:jsdom@24.1.0';

const RAIZ = new URL('../', import.meta.url);
const leer = (p: string) => Deno.readTextFileSync(new URL(p, RAIZ));
const espera = (ms = 120) => new Promise((r) => setTimeout(r, ms));
let total = 0, fallas = 0;
const res = (n: string, ok: boolean, det: unknown = '') => { total++; console.log((ok ? 'OK   ' : 'MAL  ') + n + (ok || !det ? '' : ' · ' + JSON.stringify(det))); if (!ok) fallas++; };
const sinScript = (s: string) => s.replace(/<\/script>/g, '<\\/script>');
const simpleJs = leer('prospectos/simple.js'), crmJs = leer('prospectos/crm.js');

// ── 1) Lógica pura ──
const g: any = {};
new Function('window', simpleJs)(g);
new Function('window', crmJs)(g);
const C = g.ComCRM;

// Prioridad (19-11): la reunión que viene más pronto primero; luego por cerrar, atrasadas, próxima fecha y resto.
{
  const ahora = Date.parse('2026-11-19T14:40:00Z'); // 11:40 Chile
  const reus = [
    { id: 1, lead_id: 10, inicio: '2026-11-20T14:00:00Z', fin: '2026-11-20T14:30:00Z', estado: 'confirmada' },
    { id: 2, lead_id: 11, inicio: '2026-11-19T14:50:00Z', fin: '2026-11-19T15:20:00Z', estado: 'confirmada' },
    { id: 3, lead_id: 12, inicio: '2026-11-19T14:00:00Z', fin: '2026-11-19T14:30:00Z', estado: 'confirmada' },
  ];
  const lista = [{ id: 13, proxima_fecha: '2026-11-25' }, { id: 10 }, { id: 12 }, { id: 14, proxima_fecha: '2026-11-10' }, { id: 11 }];
  const o = C.ordenar(lista, reus, '2026-11-19', { '12': true }, ahora).map((p: { id: number }) => p.id);
  res('orden por prioridad: 11:50 de hoy primero, luego mañana, por cerrar, atrasada, próxima fecha', JSON.stringify(o) === JSON.stringify([11, 10, 12, 14, 13]));
}
res('columnas principales en el orden del flujo', C.COLUMNAS.map((c: any) => c.id).join(',') === 'nuevo,agendado,reunion_realizada,propuesta,seguimiento,cliente');
res('cerradas: no asistió, perdido, no calificado y Otros', C.CERRADAS.map((c: any) => c.id).join(',') === 'no_asistio,descartado,no_calificado,otros');
res('etapas del RPC = las 10 de ck_leads_etapa (iguales a la demo de com_ficha_guardar)',
  C.ETAPAS_RPC.join(',') === 'nuevo,agendado,reunion_realizada,no_asistio,propuesta,seguimiento,cliente,emprendedor_solicitado,no_calificado,descartado');
res('toda columna (salvo Otros) es una etapa que acepta el RPC', C.COLUMNAS.concat(C.CERRADAS).every((c: any) => c.id === 'otros' || C.ETAPAS_RPC.includes(c.id)));
res('etapa desconocida y emprendedor_solicitado → Otros', C.columnaDe('xyz') === 'otros' && C.columnaDe('emprendedor_solicitado') === 'otros');
res('sin etapa → Nuevo (igual que COALESCE de la base)', C.columnaDe(null) === 'nuevo' && C.columnaDe('') === 'nuevo');
res('Otros no es destino de arrastre; las etapas sí', !C.esDestino('otros') && !C.esDestino('emprendedor_solicitado') && C.esDestino('cliente') && C.esDestino('descartado'));
const gr = C.agrupar([{ id: 1, etapa: 'agendado' }, { id: 2, etapa: 'agendado' }, { id: 3, etapa: 'raro' }, { id: 4, etapa: 'cliente' }, { id: 5, etapa: null }]);
res('agrupar: nadie se pierde (5 de 5)', Object.values(gr).reduce((s: number, l: any) => s + l.length, 0) === 5 && gr.agendado.length === 2 && gr.otros.length === 1 && gr.nuevo.length === 1);
res('avance: agendado 1, cliente 5, cerradas -1', C.avance('agendado') === 1 && C.avance('cliente') === 5 && C.avance('no_asistio') === -1);
const pB = { id: 7, actualizado: '2026-11-12T10:00:00.000001+00:00', situacion: 'Tiene 2 F29 atrasados', plan: 'pro', proxima_fecha: '2026-12-01', motivo_perdida: 'precio' };
const m1 = C.argsMover(pB, 'propuesta');
res('mover conserva situación, plan y próxima fecha; envía la versión', m1.p_id === 7 && m1.p_etapa === 'propuesta' && m1.p_situacion === 'Tiene 2 F29 atrasados' && m1.p_plan === 'pro'
  && m1.p_proxima_fecha === '2026-12-01' && m1.p_actualizado === pB.actualizado && m1.p_motivo_perdida === null, m1);
res('mover = mismos argumentos que simple.js (argsFicha)', JSON.stringify(m1) === JSON.stringify(g.ComSimple.argsFicha(pB, { etapa: 'propuesta', situacion: pB.situacion, plan: 'pro', proxima: '2026-12-01' })));
res('mover a Perdido lleva el motivo elegido', C.argsMover(pB, 'descartado', 'no_responde').p_motivo_perdida === 'no_responde' && C.argsMover(pB, 'descartado', null).p_motivo_perdida === null);
res('mover sin situación ni plan → "" y null', (() => { const a = C.argsMover({ id: 1, actualizado: 'T' }, 'agendado'); return a.p_situacion === '' && a.p_plan === null && a.p_proxima_fecha === null; })());
let lanzo = false; try { C.argsMover(pB, 'otros'); } catch (_) { lanzo = true; }
res('mover a Otros lanza ETAPA_INVALIDA (no llega al RPC)', lanzo);
res('lunes de un jueves y de un domingo', C.lunesDe('2026-11-19') === '2026-11-16' && C.lunesDe('2026-11-22') === '2026-11-16' && C.lunesDe('2026-11-16') === '2026-11-16');
res('semana lun–vie y navegación', C.semana('2026-11-19', 0).join(',') === '2026-11-16,2026-11-17,2026-11-18,2026-11-19,2026-11-20'
  && C.semana('2026-11-19', 1)[0] === '2026-11-23' && C.semana('2026-11-19', -1)[4] === '2026-11-13');
res('semana que cruza de mes', C.semana('2026-12-02', 0).join(',') === '2026-11-30,2026-12-01,2026-12-02,2026-12-03,2026-12-04');
res('título de la semana', C.tituloSemana(C.semana('2026-11-19', 0)) === 'Semana del lunes 16 al viernes 20 de noviembre'
  && C.tituloSemana(C.semana('2026-12-02', 0)) === 'Semana del lunes 30 de noviembre al viernes 4 de diciembre');
res('hora y día en America/Santiago (UTC 02:30 → 23:30 del día anterior)', C.horaDe('2026-11-20T02:30:00Z') === '23:30' && C.ymdDe('2026-11-20T02:30:00Z') === '2026-11-19');
const agenda = [{ reserva_id: 1, inicio: '2026-11-19T14:00:00Z', fin: '2026-11-19T14:30:00Z', estado: 'confirmada', teams: 'https://x.test', lead: { id: 10, nombre: 'A', empresa: 'E' } }];
const pros = [{ id: 10, nombre: 'A', empresa: 'E', reunion: { id: 1, inicio: '2026-11-19T14:00:00Z', fin: '2026-11-19T14:30:00Z', estado: 'realizada' } },
  { id: 11, nombre: 'B', reunion: { id: 2, inicio: '2026-11-10T14:00:00Z', fin: '2026-11-10T14:30:00Z', estado: 'no_asistio' } }];
const U = C.unirReuniones(agenda, pros);
res('unir reuniones: sin duplicados, la ficha manda (más fresca) y orden por hora', U.length === 2 && U[1].estado === 'realizada' && U[1].teams === 'https://x.test' && U[0].id === 2, U);
res('reuniones de la semana', C.reunionesSemana(U, C.semana('2026-11-19', 0)).length === 1);
res('colores: agendada morado, realizada verde, no asistió rojo', C.claseReunion('confirmada') === 'ag' && C.claseReunion('realizada') === 'hecha' && C.claseReunion('no_asistio') === 'na');
res('horas del calendario: 09 a 18 y se amplía', C.horasCalendario([]).length === 10 && C.horasCalendario([{ inicio: '2026-11-19T23:00:00Z' }]).slice(-1)[0] === '20');
const hoy = '2026-11-19';
const L = [{ id: 1, etapa: 'agendado' }, { id: 2, etapa: 'propuesta', proxima_fecha: '2026-11-10' }, { id: 3, etapa: 'cliente', actualizado: '2026-11-05T12:00:00Z' },
  { id: 4, etapa: 'cliente', actualizado: '2026-10-05T12:00:00Z' }, { id: 5, etapa: 'descartado', proxima_fecha: '2026-11-01' }, { id: 6, etapa: 'no_asistio' }];
const T = C.totales(L, U, hoy, [{ lead_id: 1 }]);
res('totales: en proceso, propuestas, ganados del mes, atrasados', T.enProceso === 2 && T.propuestas === 1 && T.ganadosMes === 1 && T.atrasados === 2 && T.reunionesSemana === 1, T);
res('atrasado: reunión por cerrar o próxima fecha vencida; nunca en Perdido/Ganado', C.atrasado(L[0], hoy, { '1': true }) && C.atrasado(L[1], hoy, {}) && !C.atrasado(L[4], hoy, {}));
res('buscar por nombre o empresa', C.filtrar([{ nombre: 'Ana', empresa: 'Café X' }, { nombre: 'Luis', empresa: 'Taller' }], 'café').length === 1);

// ── Navegación ──
const MENU = leer('assets/gestoor-menu.js');
res('menú: CRM es la primera opción de Comercial y abre prospectos/crm.html', /\['Comercial',\[\['grafico','CRM','prospectos','crm\.html'\]/.test(MENU) && !/'CRM',null/.test(MENU));
res('simple.html y reuniones.html enlazan al CRM', /href="crm\.html"/.test(leer('prospectos/simple.html')) && /href="crm\.html"/.test(leer('prospectos/reuniones.html')));
const H = leer('prospectos/crm.html');
res('estándar de módulo: auth-pending, guardia, supabase.js antes del módulo y auth.js al final', /<html lang="es" class="auth-pending">/.test(H) && /<style id="gestoor-auth-guard">/.test(H)
  && H.indexOf('../supabase.js') < H.indexOf('crm.js') && H.lastIndexOf('auth.js') > H.indexOf('crm.js'));
res('crm.js no usa la clave anon ni sbFetch/sbH propios', !/SB_KEY|sbH\b|function sbFetch|apikey/i.test(crmJs));

// AGENDA-WA (P8): estado WhatsApp de las reuniones que vienen (lógica pura)
{
  const ahora = Date.parse('2026-11-19T14:40:00Z');
  const reus = [
    { id: 7, inicio: '2026-11-20T14:00:00Z', fin: '2026-11-20T14:30:00Z', estado: 'confirmada' },
    { id: 7, inicio: '2026-11-20T14:00:00Z', fin: '2026-11-20T14:30:00Z', estado: 'confirmada' },
    { id: 8, inicio: '2026-11-18T14:00:00Z', fin: '2026-11-18T14:30:00Z', estado: 'confirmada' },
    { id: 9, inicio: '2026-11-21T14:00:00Z', fin: '2026-11-21T14:30:00Z', estado: 'cancelada' },
  ];
  res('WhatsApp: solo se consultan reuniones confirmadas que vienen, sin repetir', JSON.stringify(C.idsWa(reus, ahora)) === '[7]', C.idsWa(reus, ahora));
  const e = C.etiquetaWa({ estado: 'sin_consentimiento' });
  res('WhatsApp: sin_consentimiento → «Sin WhatsApp: confirmar a mano» con su explicación', /Sin WhatsApp: confirmar a mano/.test(e?.txt) && /texto anterior/.test(e?.ayuda), e);
  res('WhatsApp: esperando + leído y estado desconocido sin etiqueta', /Esperando respuesta · leído/.test(C.etiquetaWa({ estado: 'esperando', leido: true })?.txt)
    && C.etiquetaWa({ estado: 'otro' }) === null && C.etiquetaWa(null) === null);
}

// ── 2) Pantalla en jsdom ──
const ahora = Date.now(), iso = (h: number) => new Date(ahora + h * 36e5).toISOString();
const P = (id: number, etapa: string | null, extra: any = {}) => Object.assign({ id, nombre: 'Persona ' + id, empresa: 'Empresa ' + id + ' SpA', email: 'p' + id + '@ejemplo.test', tel: '+56 9 1234 56' + String(id).padStart(2, '0'),
  etapa, semaforo: 'verde', situacion: 'Situación ' + id, dolor: 'Dolor ' + id, plan: 'pro', motivo_perdida: null, proxima_fecha: null, actualizado: 'V' + id, responsable: { id: 1, nombre: 'Luciano Demo' }, reunion: null, bitacora_manual: null }, extra);
function datos(escribe = true) {
  return { yo: { id: 1, nombre: 'Luciano Demo', alcance_comercial_total: true, escribe }, pendientes: [],
    prospectos: [P(1, 'agendado', { reunion: { id: 201, inicio: iso(2), fin: iso(2.5), estado: 'confirmada', teams: 'https://meet.ejemplo.test/x', bitacora: null } }),
      P(2, 'propuesta', { nombre: '<img src=x onerror="window.__xss=1">' }), P(3, 'cliente'), P(4, 'emprendedor_solicitado'), P(5, 'nuevo')] };
}
async function pantalla(opts: { escribe?: boolean, falla?: string, wa?: boolean } = {}) {
  const html = H
    .replace('<script src="../supabase.js"></script>', `<script>
      window._llamadas = []; window._DATOS = ${JSON.stringify(datos(opts.escribe !== false))}; window._FALLA = ${JSON.stringify(opts.falla || '')}; window._WA = ${opts.wa ? 'true' : 'false'};
      function resp(o, ok){ return Promise.resolve({ ok: ok !== false, status: ok === false ? 400 : 200, json: function(){ return Promise.resolve(o); } }); }
      function sbFetch(path, op){ var fn = path.replace('rpc/', ''), b = JSON.parse((op && op.body) || '{}'); window._llamadas.push({ fn: fn, b: b }); var D = window._DATOS;
        if (fn === 'com_simple_listar') return resp(JSON.parse(JSON.stringify(D)));
        if (fn === 'com_listar_hoy') return resp({ reuniones: [{ reserva_id: 201, inicio: D.prospectos[0].reunion.inicio, fin: D.prospectos[0].reunion.fin, estado: 'confirmada', teams: 'https://meet.ejemplo.test/x', lead: { id: 1, nombre: 'Persona 1', empresa: 'Empresa 1 SpA' } }] });
        if (fn === 'agenda_wa_estado_reservas') return window._WA ? resp({ '201': { estado: 'sin_consentimiento', at: null, leido: false } }) : resp({ message: 'PGRST202' }, false);
        if (fn === 'detalle_prospecto') return resp({ id: b.p_id, respuestas: { ventas: '5a20', trabajadores: '1a5', contabilidad: 'externo', sociedades: 'no', historicos: 'si', rubro: 'ferretería' } });
        if (fn === 'com_ficha_guardar') { if (window._FALLA) return resp({ message: window._FALLA }, false);
          var q = D.prospectos.filter(function(x){ return x.id === b.p_id; })[0]; return resp(Object.assign({}, q, { etapa: b.p_etapa, motivo_perdida: b.p_motivo_perdida, actualizado: 'nuevo' })); }
        return resp({ message: 'NO_EXISTE' }, false); }
      window._sbAuthReady = true; window._gestoorAccessToken = 'ficticio';
    </script>`)
    .replace('<script src="comercial-datos.js"></script>', '<script>' + sinScript(leer('prospectos/comercial-datos.js')) + '</script>')
    .replace('<script src="whatsapp.js"></script>', '<script>' + sinScript(leer('prospectos/whatsapp.js')) + '</script>')
    .replace('<script src="telefono.js"></script>', '<script>' + sinScript(leer('prospectos/telefono.js')) + '</script>')
    .replace('<script src="simple.js"></script>', '<script>' + sinScript(simpleJs) + '</script>')
    .replace('<script src="crm.js"></script>', '<script>' + sinScript(crmJs) + '</script>')
    .replace('<script src="../assets/gestoor-menu.js"></script>', '').replace('<script src="../assets/equipo.js"></script>', '')
    .replace(/<script>if\(window\.COM_DEMO\)document\.write[^\n]*<\/script>/, '').replace(/<script>if\(!window\.COM_DEMO\)document\.write[^\n]*<\/script>/, '');
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://gestoor.ejemplo.test/prospectos/crm.html', pretendToBeVisual: true });
  await espera(250); return dom;
}
const colDe = (d: Document, id: number) => (d.querySelector(`.crm-card[data-id="${id}"]`)?.closest('.crm-col') as HTMLElement | null)?.dataset.col;

let dom = await pantalla(), w: any = dom.window, d: Document = w.document;
res('pinta el embudo con las 6 columnas + cerradas', d.querySelectorAll('.crm-embudo .crm-col').length === 6 && !!d.querySelector('.crm-col[data-col="descartado"]'));
res('cada prospecto en su columna; emprendedor_solicitado en Otros', colDe(d, 1) === 'agendado' && colDe(d, 2) === 'propuesta' && colDe(d, 3) === 'cliente' && colDe(d, 4) === 'otros');
res('escape de HTML (sin XSS)', !w.__xss && !d.querySelector('#crmApp img'));
res('totales arriba', /En proceso/.test(d.querySelector('.crm-tot')!.textContent!) && d.querySelectorAll('.crm-kpi').length === 5);
res('tarjetas arrastrables con permiso de edición', d.querySelectorAll('.crm-card[draggable="true"]').length === 5);
(d.querySelector('.crm-card[data-id="1"]') as HTMLElement).click(); await espera(150);
const ficha = d.getElementById('crmFicha')!.textContent!;
res('ficha: lo que nos contó, su empresa con etiquetas legibles y reunión con Unirme', /Dolor 1/.test(ficha) && /\$5M a \$20M/.test(ficha) && /Contador externo/.test(ficha) && /Atrasos con el SII/.test(ficha)
  && !!d.querySelector('#crmFicha a[href="https://meet.ejemplo.test/x"]'), ficha.slice(0, 300));
res('ficha: enlaces a las pantallas que ya existen', !!d.querySelector('#crmFicha a[href="simple.html?id=1"]') && !!d.querySelector('#crmFicha a[href^="bitacora.html?reserva=201"]') && !!d.querySelector('#crmFicha button[data-wa]'));
(d.getElementById('crmMover') as HTMLSelectElement).value = 'reunion_realizada'; (d.getElementById('crmMoverBtn') as HTMLElement).click(); await espera(200);
const g1 = w._llamadas.filter((x: any) => x.fn === 'com_ficha_guardar');
res('Mover a… llama com_ficha_guardar con la versión y conserva situación/plan', g1.length === 1 && g1[0].b.p_etapa === 'reunion_realizada' && g1[0].b.p_actualizado === 'V1'
  && g1[0].b.p_situacion === 'Situación 1' && g1[0].b.p_plan === 'pro', g1);
res('la tarjeta queda en su nueva columna', colDe(d, 1) === 'reunion_realizada');
// arrastre (HTML5): dragstart en la tarjeta y drop en la columna
const ev = (t: string, dt: any) => { const e = new w.Event(t, { bubbles: true, cancelable: true }); e.dataTransfer = dt; return e; };
const dt = { _v: '', setData(_: string, v: string) { this._v = v; }, getData() { return this._v; } };
d.querySelector('.crm-card[data-id="5"]')!.dispatchEvent(ev('dragstart', dt));
d.querySelector('.crm-col[data-col="agendado"]')!.dispatchEvent(ev('dragover', dt));
d.querySelector('.crm-col[data-col="agendado"]')!.dispatchEvent(ev('drop', dt)); await espera(200);
res('arrastrar a otra columna mueve (com_ficha_guardar p_etapa=agendado)', colDe(d, 5) === 'agendado' && w._llamadas.some((x: any) => x.fn === 'com_ficha_guardar' && x.b.p_id === 5 && x.b.p_etapa === 'agendado'));
const antes = w._llamadas.length;
d.querySelector('.crm-card[data-id="4"]')!.dispatchEvent(ev('dragstart', dt));
const otros = d.querySelector('.crm-col[data-col="otros"]')!; otros.dispatchEvent(ev('drop', dt)); await espera(100);
res('soltar en Otros no hace nada', w._llamadas.length === antes);
// Perdido pide motivo
(d.querySelector('.crm-card[data-id="2"]') as HTMLElement).click(); await espera(100);
(d.getElementById('crmMover') as HTMLSelectElement).value = 'descartado'; (d.getElementById('crmMoverBtn') as HTMLElement).click(); await espera(50);
res('Perdido abre el motivo (lista de simple.js)', !!d.querySelector('.cm-modal #crmMot') && d.querySelectorAll('#crmMot option').length === 7);
(d.getElementById('crmMot') as HTMLSelectElement).value = 'precio'; (d.getElementById('crmMSi') as HTMLElement).click(); await espera(200);
res('Perdido guarda con el motivo', colDe(d, 2) === 'descartado' && w._llamadas.some((x: any) => x.fn === 'com_ficha_guardar' && x.b.p_etapa === 'descartado' && x.b.p_motivo_perdida === 'precio'));
(d.querySelector('.crm-card[data-id="3"]') as HTMLElement).click(); await espera(100);
res('Ganado ofrece 🚀 Ir a onboarding', /Ir a onboarding/.test(d.querySelector('#crmFicha a[href="onboarding.html?lead=3"]')?.textContent || ''));
d.querySelector('[data-tab="reuniones"]')!.dispatchEvent(new w.Event('click')); (d.querySelector('[data-tab="reuniones"]') as HTMLElement).click(); await espera(100);
res('pestaña Reuniones: calendario lun–vie con la reunión agendada en morado', d.querySelectorAll('.crm-cal .hd').length === 6 && !!d.querySelector('.crm-ev.ag[data-id="1"]'));
res('sin respuesta de WhatsApp (RPC falla) el calendario se pinta igual, sin etiqueta', !d.querySelector('.crm-wa'));
const permitidas = ['com_simple_listar', 'com_listar_hoy', 'detalle_prospecto', 'com_ficha_guardar', 'agenda_wa_estado_reservas'];
res('solo RPC permitidas', w._llamadas.every((x: any) => permitidas.includes(x.fn)), [...new Set(w._llamadas.map((x: any) => x.fn))]);
dom.window.close();

// AGENDA-WA (P8): con la RPC respondiendo, la reunión que viene muestra su estado en el calendario y en la ficha
dom = await pantalla({ wa: true }); w = dom.window; d = w.document;
const wa1 = w._llamadas.filter((x: any) => x.fn === 'agenda_wa_estado_reservas');
res('WhatsApp: una consulta con la reserva que viene', wa1.length === 1 && JSON.stringify(wa1[0].b) === '{"p_reservas":[201]}', wa1);
(d.querySelector('[data-tab="reuniones"]') as HTMLElement).click(); await espera(100);
const chipCal = d.querySelector('.crm-ev[data-id="1"] .crm-wa');
res('WhatsApp: calendario muestra «✋ Sin WhatsApp: confirmar a mano» con la explicación', /Sin WhatsApp: confirmar a mano/.test(chipCal?.textContent || '') && /texto anterior/.test(chipCal?.getAttribute('title') || ''), chipCal?.outerHTML);
(d.querySelector('.crm-ev[data-id="1"]') as HTMLElement).click(); await espera(150);
res('WhatsApp: la ficha muestra el mismo estado junto a la reunión', /Sin WhatsApp: confirmar a mano/.test(d.querySelector('#crmFicha .crm-wa')?.textContent || ''));
res('WhatsApp: la etiqueta no muestra teléfonos', Array.from(d.querySelectorAll('.crm-wa')).every((e: any) => !/\d{6}/.test(e.outerHTML)));
dom.window.close();

// Error al guardar → vuelve a su columna con mensaje
dom = await pantalla({ falla: 'SIN_PERMISO_ESCRITURA' }); w = dom.window; d = w.document;
(d.querySelector('.crm-card[data-id="1"]') as HTMLElement).click(); await espera(100);
(d.getElementById('crmMover') as HTMLSelectElement).value = 'propuesta'; (d.getElementById('crmMoverBtn') as HTMLElement).click(); await espera(200);
res('si falla, la tarjeta vuelve a su columna y se explica', colDe(d, 1) === 'agendado' && /solo para el Master/.test(d.getElementById('crmMsg')!.textContent!));
dom.window.close();
// Conflicto de versión → recarga
dom = await pantalla({ falla: 'VERSION_CONFLICTO' }); w = dom.window; d = w.document;
(d.querySelector('.crm-card[data-id="1"]') as HTMLElement).click(); await espera(100);
const n0 = w._llamadas.filter((x: any) => x.fn === 'com_simple_listar').length;
(d.getElementById('crmMover') as HTMLSelectElement).value = 'propuesta'; (d.getElementById('crmMoverBtn') as HTMLElement).click(); await espera(250);
res('conflicto de versión: recarga la lista y la tarjeta sigue donde estaba', w._llamadas.filter((x: any) => x.fn === 'com_simple_listar').length === n0 + 1 && colDe(d, 1) === 'agendado'
  && /Otra persona guardó/.test(d.getElementById('cmToast')?.textContent || ''));
dom.window.close();
// Solo lectura
dom = await pantalla({ escribe: false }); w = dom.window; d = w.document;
(d.querySelector('.crm-card[data-id="1"]') as HTMLElement).click(); await espera(100);
res('solo lectura: sin arrastre, "Mover a…" deshabilitado y sin "Nuevo prospecto"', !d.querySelector('.crm-card[draggable="true"]') && (d.getElementById('crmMoverBtn') as HTMLButtonElement).disabled
  && (d.getElementById('crmMover') as HTMLSelectElement).disabled && !d.getElementById('crmNuevo'));
dom.window.close();

console.log(`\n${total - fallas}/${total} OK`);
if (fallas) Deno.exit(1);
