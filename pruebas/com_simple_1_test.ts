// COM-SIMPLE-1 · Prospectos simple (prospectos/simple.html + simple.js) · prueba LOCAL (no toca Supabase; datos 100 % ficticios).
// 1) Mapeo estado ↔ etapa, filtros, "Ver guion" y argumentos de com_ficha_guardar (funciones puras).
// 2) En jsdom con sbFetch simulado: reuniones pasadas sin cerrar (✅/🚫 de un toque), filtros con conteo, ficha (estado de un toque,
//    situación, plan, motivo opcional, próximo contacto opcional), conflicto de versión, solo lectura, escape de HTML y RPC permitidas.
// Uso: deno run --allow-read --allow-env --allow-sys --allow-net=registry.npmjs.org pruebas/com_simple_1_test.ts
import { JSDOM } from 'npm:jsdom@24.1.0';

const RAIZ = new URL('../', import.meta.url);
const leer = (p: string) => Deno.readTextFileSync(new URL(p, RAIZ));
const espera = (ms = 120) => new Promise((r) => setTimeout(r, ms));
let total = 0, fallas = 0;
const res = (n: string, ok: boolean, det = '') => { total++; console.log((ok ? 'OK   ' : 'MAL  ') + n + (ok || !det ? '' : ' · ' + det)); if (!ok) fallas++; };
const sinScript = (s: string) => s.replace(/<\/script>/g, '<\\/script>');
const simpleJs = leer('prospectos/simple.js');

// ── 1) Funciones puras ──
const g: any = {};
new Function('window', simpleJs)(g);
const S = g.ComSimple;
res('6 estados de un toque, en el orden de la maqueta', S.ESTADOS.map((e: any) => e[1]).join('|') === 'Agendada|Reunión hecha|No asistió|Propuesta enviada|Ganado|Perdido');
const MAPEO: Record<string, string> = { agendado: 'Agendada', reunion_realizada: 'Reunión hecha', no_asistio: 'No asistió', propuesta: 'Propuesta enviada',
  cliente: 'Ganado', descartado: 'Perdido', nuevo: 'Nuevo · sin reunión', seguimiento: 'Seguimiento', no_calificado: 'Sin agendar', emprendedor_solicitado: 'Cumplimiento solicitado' };
for (const [et, txt] of Object.entries(MAPEO)) res(`etapa ${et} → "${txt}"`, S.etapaInfo(et)[0] === txt, S.etapaInfo(et)[0]);
res('las 10 etapas de ck_leads_etapa tienen etiqueta', Object.keys(MAPEO).length === 10);
res('filtros: Todos, Agendadas, Propuesta enviada, Ganados, Perdidos', S.FILTROS.map((f: any) => f[1]).join('|') === 'Todos|Agendadas|Propuesta enviada|Ganados|Perdidos');
res('"Propuesta enviada" incluye seguimiento', S.pasaFiltro({ etapa: 'seguimiento' }, 'prop') && S.pasaFiltro({ etapa: 'propuesta' }, 'prop') && !S.pasaFiltro({ etapa: 'cliente' }, 'prop'));
res('"Agendadas" solo agendado', S.pasaFiltro({ etapa: 'agendado' }, 'ag') && !S.pasaFiltro({ etapa: 'nuevo' }, 'ag'));
res('motivos = los 6 de ck_leads_motivo_perdida', S.MOTIVOS.map((m: any) => m[0]).join(',') === 'precio,eligio_otro,no_responde,no_calza,lo_hara_solo,otro');
res('planes = cumplimiento, pro, estrategico', S.PLANES.map((m: any) => m[0]).join(',') === 'cumplimiento,pro,estrategico');
res('guion: bitácora de la reunión → bitacora.html?id=', S.guionUrl({ reunion: { id: 5, estado: 'realizada', bitacora: { id: 9 } } }) === 'bitacora.html?id=9');
res('guion: reunión sin bitácora → bitacora.html?reserva=', S.guionUrl({ reunion: { id: 5, estado: 'confirmada', bitacora: null } }) === 'bitacora.html?reserva=5');
res('guion: bitácora manual abierta → ?id=', S.guionUrl({ reunion: null, bitacora_manual: 7 }) === 'bitacora.html?id=7');
res('guion: reserva cancelada y sin bitácora → null (abre una sin reserva)', S.guionUrl({ reunion: { id: 5, estado: 'cancelada' } }) === null);
res('guion en demo agrega &demo=1', S.guionUrl({ reunion: { id: 5, estado: 'confirmada' } }, true) === 'bitacora.html?reserva=5&demo=1');
const a1 = S.argsFicha({ id: 3, actualizado: 'T1' }, { etapa: 'propuesta', situacion: 'x', plan: '', motivo: 'precio', proxima: '' });
res('argsFicha: motivo solo si Perdido; plan y próximo contacto vacíos → null', a1.p_motivo_perdida === null && a1.p_plan === null && a1.p_proxima_fecha === null && a1.p_actualizado === 'T1' && a1.p_etapa === 'propuesta');
const a2 = S.argsFicha({ id: 3 }, { etapa: 'descartado', situacion: '', plan: 'pro', motivo: 'precio', proxima: '2026-11-20' });
res('argsFicha: Perdido lleva motivo; situación vacía viaja como ""', a2.p_motivo_perdida === 'precio' && a2.p_situacion === '' && a2.p_plan === 'pro' && a2.p_proxima_fecha === '2026-11-20');

// ── 2) Pantalla en jsdom ──
const ahora = Date.now(), iso = (h: number) => new Date(ahora + h * 36e5).toISOString();
const P = (id: number, etapa: string, extra: any = {}) => Object.assign({ id, nombre: 'Persona ' + id, empresa: 'Empresa ' + id + ' SpA', email: 'p' + id + '@ejemplo.test', tel: '+56 9 1234 56' + String(id).padStart(2, '0'),
  etapa, situacion: null, dolor: null, plan: null, motivo_perdida: null, proxima_fecha: null, actualizado: '2026-11-12T10:00:00.000001+00:00', responsable: { id: 1, nombre: 'Luciano Demo' }, reunion: null, bitacora_manual: null }, extra);
function datos(escribe = true) {
  return { yo: { id: 1, nombre: 'Luciano Demo', alcance_comercial_total: true, escribe },
    pendientes: [{ reserva_id: 201, inicio: iso(-3), fin: iso(-2.5), estado: 'confirmada', lead_id: 1, nombre: 'Persona 1', empresa: 'Empresa 1 SpA', bitacora: null },
                 { reserva_id: 202, inicio: iso(-26), fin: iso(-25.5), estado: 'confirmada', lead_id: 2, nombre: '<img src=x onerror="window.__xss=1">', empresa: 'Empresa 2', bitacora: { id: 302, estado: 'abierta' } }],
    prospectos: [P(1, 'agendado', { reunion: { id: 201, inicio: iso(-3), estado: 'confirmada', bitacora: null } }),
                 P(2, 'agendado', { nombre: '<img src=x onerror="window.__xss=1">', reunion: { id: 202, inicio: iso(-26), estado: 'confirmada', bitacora: { id: 302, estado: 'abierta' } } }),
                 P(3, 'propuesta', { situacion: 'Tiene 2 F29 atrasados', plan: 'pro' }), P(4, 'seguimiento'), P(5, 'cliente'), P(6, 'descartado', { motivo_perdida: 'precio' }), P(7, 'nuevo')] };
}
async function pantalla(opts: { escribe?: boolean, conflicto?: boolean } = {}) {
  const html = leer('prospectos/simple.html')
    .replace('<script src="../supabase.js"></script>', `<script>
      window._llamadas = []; window._DATOS = ${JSON.stringify(datos(opts.escribe !== false))}; window._CONFLICTO = ${!!opts.conflicto};
      function resp(o, ok){ return Promise.resolve({ ok: ok !== false, status: ok === false ? 400 : 200, json: function(){ return Promise.resolve(o); } }); }
      function sbFetch(path, op){ var fn = path.replace('rpc/', ''), b = JSON.parse((op && op.body) || '{}'); window._llamadas.push({ fn: fn, b: b });
        var D = window._DATOS;
        if (fn === 'com_simple_listar') return resp(JSON.parse(JSON.stringify(D)));
        if (fn === 'com_linea_tiempo') return resp([{ t: '2026-11-10T12:00:00Z', tipo: 'etapa', detalle: { de: 'nuevo', a: 'agendado' }, actor: 'Luciano Demo' }]);
        if (fn === 'com_cierre_rapido') { var p = D.prospectos.filter(function(x){ return x.reunion && x.reunion.id === b.p_reserva_id; })[0];
          p = Object.assign({}, p, { etapa: b.p_resultado === 'realizada' ? 'reunion_realizada' : 'no_asistio' }); p.reunion = Object.assign({}, p.reunion, { estado: b.p_resultado });
          return resp({ reserva_id: b.p_reserva_id, lead_id: p.id, ya_cerrada: false, prospecto: p }); }
        if (fn === 'com_ficha_guardar') { if (window._CONFLICTO) return resp({ message: 'VERSION_CONFLICTO' }, false);
          var q = D.prospectos.filter(function(x){ return x.id === b.p_id; })[0];
          return resp(Object.assign({}, q, { etapa: b.p_etapa, situacion: b.p_situacion || null, plan: b.p_plan, motivo_perdida: b.p_motivo_perdida, proxima_fecha: b.p_proxima_fecha, actualizado: 'nuevo' })); }
        if (fn === 'com_bitacora_abrir') return resp({ id: 999 });
        return resp({ message: 'NO_EXISTE' }, false); }
      window._sbAuthReady = true; window._gestoorAccessToken = 'ficticio';
    </script>`)
    .replace('<script src="comercial-datos.js"></script>', '<script>' + sinScript(leer('prospectos/comercial-datos.js')) + '</script>')
    .replace('<script src="whatsapp.js"></script>', '<script>' + sinScript(leer('prospectos/whatsapp.js')) + '</script>')
    .replace('<script src="telefono.js"></script>', '<script>' + sinScript(leer('prospectos/telefono.js')) + '</script>')
    .replace('<script src="simple.js"></script>', '<script>' + sinScript(simpleJs) + '</script>')
    .replace('<script src="../assets/gestoor-menu.js"></script>', '').replace('<script src="../assets/equipo.js"></script>', '')
    .replace(/<script>if\(window\.COM_DEMO\)document\.write[^\n]*<\/script>/, '').replace(/<script>if\(!window\.COM_DEMO\)document\.write[^\n]*<\/script>/, '');
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://gestoor.ejemplo.test/prospectos/simple.html', pretendToBeVisual: true });
  await espera(200); return dom;
}
{
  const dom = await pantalla(); const w: any = dom.window, d = w.document;
  res('carga con com_simple_listar', w._llamadas[0]?.fn === 'com_simple_listar');
  const pend = d.querySelectorAll('.cs-pend');
  res('2 reuniones pasadas sin cerrar, cada una con ✅ y 🚫', pend.length === 2 && d.querySelectorAll('.cs-pend [data-cerrar]').length === 4);
  res('el nombre con HTML se muestra escapado (sin <img> ni XSS)', !d.querySelector('#csApp img') && !w.__xss && d.querySelector('#csPend').textContent.includes('<img src=x'));
  res('bitácora abierta se indica en la fila pendiente', pend[1].textContent.includes('bitácora abierta'));
  const chips = [...d.querySelectorAll('.cs-chips [data-f]')].map((b: any) => b.textContent);
  res('conteos: Todos 7 · Agendadas 2 · Propuesta enviada 2 · Ganados 1 · Perdidos 1', chips.join('|') === 'Todos7|Agendadas2|Propuesta enviada2|Ganados1|Perdidos1', chips.join('|'));
  res('ficha abre el primero con contacto, WhatsApp y correo', d.getElementById('csNom').textContent === 'Persona 1' && !!d.querySelector('#csWa .wa-btn') && !!d.querySelector('#csFicha a[href="mailto:p1@ejemplo.test"]'));
  res('ficha: UNA caja de situación y próximo contacto opcional', d.querySelectorAll('#csFicha textarea').length === 1 && d.querySelector('label[for="csProx"]').textContent.includes('opcional'));
  res('ficha: nada marcado como obligatorio', !d.querySelector('#csFicha [required]') && !/obligatori/i.test(d.getElementById('csFicha').textContent));
  res('Ver guion (opcional) apunta a la bitácora de la reunión', d.querySelector('#csFicha a[href="bitacora.html?reserva=201"]')?.textContent.includes('Ver guion (opcional)'));
  await espera(); res('historial cargado con com_linea_tiempo', d.getElementById('csHist').textContent.includes('Estado: Agendada'));
  // ✅ Se hizo
  d.querySelector('[data-cerrar="201"][data-res="realizada"]').click(); await espera();
  const c1 = w._llamadas.filter((x: any) => x.fn === 'com_cierre_rapido')[0];
  res('✅ Se hizo → com_cierre_rapido {p_reserva_id:201, p_resultado:"realizada"}', !!c1 && c1.b.p_reserva_id === 201 && c1.b.p_resultado === 'realizada' && Object.keys(c1.b).length === 2);
  res('la reunión sale de "sin cerrar" y el prospecto queda "Reunión hecha"', d.querySelectorAll('.cs-pend').length === 1 && d.querySelector('.cs-row[data-id="1"]').textContent.includes('Reunión hecha'));
  // 🚫 No asistió
  d.querySelector('[data-cerrar="202"][data-res="no_asistio"]').click(); await espera();
  res('🚫 No asistió → p_resultado "no_asistio" y desaparece el aviso', w._llamadas.some((x: any) => x.fn === 'com_cierre_rapido' && x.b.p_reserva_id === 202 && x.b.p_resultado === 'no_asistio') && !d.getElementById('csPend'));
  // Filtro Perdidos
  d.querySelector('[data-f="per"]').click(); await espera(50);
  res('filtro Perdidos muestra solo el perdido', d.querySelectorAll('.cs-row').length === 1 && d.querySelector('.cs-row').dataset.id === '6');
  d.querySelector('[data-f="todos"]').click(); await espera(50);
  // Ficha del 3: estado de un toque
  d.querySelector('.cs-row[data-id="3"]').click(); await espera();
  res('ficha 3: situación y plan precargados', d.getElementById('csSit').value === 'Tiene 2 F29 atrasados' && d.getElementById('csPlan').value === 'pro');
  d.getElementById('csSit').value = 'Su contador no le responde.'; d.getElementById('csSit').dispatchEvent(new w.Event('input'));
  d.querySelector('#csFicha [data-et="cliente"]').click(); await espera();
  const f1 = w._llamadas.filter((x: any) => x.fn === 'com_ficha_guardar').pop();
  res('un toque en "Ganado" guarda TODO junto (estado + situación + plan + versión)', f1 && f1.b.p_id === 3 && f1.b.p_etapa === 'cliente' && f1.b.p_situacion === 'Su contador no le responde.' && f1.b.p_plan === 'pro' && f1.b.p_actualizado === '2026-11-12T10:00:00.000001+00:00' && f1.b.p_motivo_perdida === null);
  res('mensaje "Guardado · Ganado" y la fila cambia', d.getElementById('csMsg').textContent === 'Guardado · Ganado' && d.querySelector('.cs-row[data-id="3"]').textContent.includes('Ganado'));
  // Perdido + motivo opcional
  d.querySelector('#csFicha [data-et="descartado"]').click(); await espera();
  res('Perdido sin motivo se guarda (motivo opcional)', w._llamadas.filter((x: any) => x.fn === 'com_ficha_guardar').pop().b.p_motivo_perdida === null && !!d.getElementById('csMot'));
  const mot = d.getElementById('csMot'); mot.value = 'eligio_otro'; mot.dispatchEvent(new w.Event('change')); await espera();
  res('elegir el motivo guarda al tiro con p_motivo_perdida', w._llamadas.filter((x: any) => x.fn === 'com_ficha_guardar').pop().b.p_motivo_perdida === 'eligio_otro');
  // Guardar con todo vacío
  d.querySelector('.cs-row[data-id="7"]').click(); await espera();
  d.getElementById('csGuardar').click(); await espera();
  const f3 = w._llamadas.filter((x: any) => x.fn === 'com_ficha_guardar').pop();
  res('Guardar con todo vacío no se bloquea (estado actual "nuevo", sin plan ni fecha)', f3.b.p_id === 7 && f3.b.p_etapa === 'nuevo' && f3.b.p_situacion === '' && f3.b.p_plan === null && f3.b.p_proxima_fecha === null);
  res('"Nuevo" se muestra aparte con nota para elegir estado', d.getElementById('csFicha').textContent.includes('Nuevo · sin reunión'));
  // Prospecto sin reunión: Ver guion abre bitácora sin reserva
  res('sin reunión: "Ver guion" es botón (abre bitácora sin reserva)', !!d.getElementById('csGuion'));
  const permitidas = new Set(['com_simple_listar', 'com_linea_tiempo', 'com_cierre_rapido', 'com_ficha_guardar']);
  res('solo RPC permitidas (sin tablas ni otras funciones)', w._llamadas.every((x: any) => permitidas.has(x.fn)), [...new Set(w._llamadas.map((x: any) => x.fn))].join(','));
  dom.window.close();
}
{ // Conflicto de versión
  const dom = await pantalla({ conflicto: true }); const w: any = dom.window, d = w.document;
  const n0 = w._llamadas.filter((x: any) => x.fn === 'com_simple_listar').length;
  d.querySelector('#csFicha [data-et="propuesta"]').click(); await espera(250);
  res('VERSION_CONFLICTO: recarga los datos y avisa (no pisa lo de la otra persona)', w._llamadas.filter((x: any) => x.fn === 'com_simple_listar').length === n0 + 1 && /Otra persona guardó/.test(d.getElementById('csMsg').textContent));
  dom.window.close();
}
{ // Solo lectura (sin permiso de escritura)
  const dom = await pantalla({ escribe: false }); const d = dom.window.document;
  res('solo lectura: sin botones ✅/🚫 ni Guardar; estados deshabilitados', !d.querySelector('[data-cerrar]') && !d.getElementById('csGuardar') && [...d.querySelectorAll('#csFicha [data-et]')].every((b: any) => b.disabled));
  dom.window.close();
}
// ── 3) Menú y vista completa ──
res('menú: "Prospectos" abre la vista simple', /\['objetivo','Prospectos','prospectos','simple\.html'\]/.test(leer('assets/gestoor-menu.js')));
res('vista completa (index.html) enlaza a la simple', leer('prospectos/index.html').includes('href="simple.html"'));
res('simple.html cumple el estándar (auth-pending, guardia, supabase.js antes del módulo, auth.js al final)', (() => { const h = leer('prospectos/simple.html');
  return h.includes('class="auth-pending"') && h.includes('id="gestoor-auth-guard"') && h.indexOf('../supabase.js') < h.indexOf('simple.js') && h.lastIndexOf('../auth.js') > h.indexOf('simple.js'); })());

console.log(`\n${total - fallas}/${total} pruebas OK`);
if (fallas) Deno.exit(1);
