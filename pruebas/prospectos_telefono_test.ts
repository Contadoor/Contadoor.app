// Prospectos · "✏️ Corregir teléfono" (prospectos/telefono.js) · prueba LOCAL (no toca Supabase ni producción; datos 100 % ficticios).
// 1) Validación local = misma lógica que whatsapp.js + celular, con los MISMOS casos que la prueba de la base (prospecto_corregir_telefono).
// 2) Bandera TEL_CORRECCION_CONECTADA = false TAL COMO ESTÁ EN EL REPOSITORIO: botón deshabilitado con motivo, sin modal y sin llamadas.
// 3) Con la bandera en true (solo en la prueba): ficha en jsdom con sbFetch simulado → modal, errores locales sin llamar a la base,
//    guardado con la RPC correcta (E.164, origen, motivo) y, tras guardar, el botón WhatsApp usa el número nuevo. Error de la base → mensaje claro.
// Uso: deno run --allow-read --allow-env --allow-sys --allow-net=registry.npmjs.org pruebas/prospectos_telefono_test.ts
import { JSDOM } from 'npm:jsdom@24.1.0';

const RAIZ = new URL('../', import.meta.url);
const leer = (p: string) => Deno.readTextFileSync(new URL(p, RAIZ));
const waJs = leer('prospectos/whatsapp.js');
const telJs = leer('prospectos/telefono.js');
const espera = (ms = 80) => new Promise((r) => setTimeout(r, ms));
let total = 0, fallas = 0;
const res = (n: string, ok: boolean, det = '') => { total++; console.log((ok ? 'OK   ' : 'MAL  ') + n + (ok || !det ? '' : ' · ' + det)); if (!ok) fallas++; };
const sinScript = (s: string) => s.replace(/<\/script>/g, '<\\/script>');

// ── 1) Validación pura ──
const g: any = {};
new Function('window', waJs)(g);
new Function('window', telJs)(g);
const T = g.ProsTel;
const val = (tel: any, origen: any = 'prospecto_llamada', motivo: any = 'El prospecto lo confirmó', anterior: any = '12345678') => T.validar({ tel, origen, motivo, anterior });
const casos: [string, any, string][] = [
  ['8 dígitos', val('87654321'), 'TEL_AMBIGUO_8'],
  ['8 dígitos con espacio', val('8765 4321'), 'TEL_AMBIGUO_8'],
  ['vacío', val('   '), 'TEL_VACIO'],
  ['nulo', val(null), 'TEL_VACIO'],
  ['letras', val('9abc12345'), 'TEL_INVALIDO'],
  ['puntos', val('9.1234.5678'), 'TEL_INVALIDO'],
  ['fijo +56 2', val('+56 2 2123 4567'), 'TEL_NO_MOVIL'],
  ['Argentina', val('+54 9 1234 5678'), 'TEL_INVALIDO'],
  ['10 dígitos', val('5691234567'), 'TEL_INVALIDO'],
  ['9 dígitos sin 9', val('812345678'), 'TEL_INVALIDO'],
  ['origen inválido', val('912345678', 'adivinado'), 'ORIGEN_INVALIDO'],
  ['origen nulo', val('912345678', null), 'ORIGEN_INVALIDO'],
  ['motivo vacío', val('912345678', 'prospecto_llamada', '  '), 'MOTIVO_OBLIGATORIO'],
  ['motivo corto', val('912345678', 'prospecto_llamada', 'ok'), 'MOTIVO_OBLIGATORIO'],
  ['motivo > 300', val('912345678', 'prospecto_llamada', 'x'.repeat(301)), 'MOTIVO_MUY_LARGO'],
  ['8 dígitos + 9 como "formato"', val('912345678', 'correccion_formato', 'Le agrego el 9', '12345678'), 'FORMATO_CAMBIA_NUMERO'],
  ['mismo número ya en E.164', val('+56 9 3333 4444', 'prospecto_whatsapp', 'Mismo número', '+56933334444'), 'SIN_CAMBIO'],
];
for (const [n, r, cod] of casos) res('validar ' + n + ' → ' + cod, r.ok === false && r.codigo === cod, JSON.stringify(r));
let v = val('+56 9 1234 5678', 'prospecto_whatsapp', '  Lo confirmó por WhatsApp  ');
res('válido: E.164 y motivo recortado', v.ok && v.e164 === '+56912345678' && v.motivo === 'Lo confirmó por WhatsApp', JSON.stringify(v));
v = val('+56911112222', 'correccion_formato', 'Solo formato', '(9) 1111-2222');
res('corrección de formato del MISMO número: válida', v.ok && v.e164 === '+56911112222', JSON.stringify(v));
res('9 dígitos con 9 → +569…', val('912222111').e164 === '+56912222111');
res('5 orígenes: 4 del prospecto + formato', T.ORIGENES.map((o: any) => o[0]).join('|') === 'prospecto_whatsapp|prospecto_correo|prospecto_llamada|prospecto_reunion|correccion_formato');
res('cada código tiene mensaje claro', ['TEL_VACIO', 'TEL_AMBIGUO_8', 'TEL_INVALIDO', 'TEL_NO_MOVIL', 'ORIGEN_INVALIDO', 'MOTIVO_OBLIGATORIO', 'MOTIVO_MUY_LARGO', 'MOTIVO_CREDENCIAL', 'SIN_CAMBIO', 'FORMATO_CAMBIA_NUMERO', 'SIN_PERMISO'].every((k) => !!T.MSJ[k]));
res('mensaje(error de la base) traduce SIN_PERMISO', T.mensaje(new Error('SIN_PERMISO')) === T.MSJ.SIN_PERMISO);
res('botón escapa el nombre', !T.boton({ id: 1, nombre: '<img src=x onerror=1>', tel: '1' }).includes('<img'));
res('bandera en el repositorio: una sola declaración y en false', /var TEL_CORRECCION_CONECTADA=false;/.test(telJs) && (telJs.match(/var TEL_CORRECCION_CONECTADA=/g) || []).length === 1 && T.CONECTADA === false);

// ── 2) y 3) Ficha de Prospectos en jsdom ──
const LISTA = [
  { id: 1, nombre: 'Jorge Ficticio', empresa: 'Ferretería Ficticia SpA', email: 'jorge@ejemplo.test', tel: '12345678', etapa: 'nuevo', semaforo: 'rojo', creado: '2026-11-02T12:00:00Z' },
];
function montar(conectada: boolean, respuesta: 'ok' | 'sin_permiso' = 'ok') {
  const tel = conectada ? telJs.replace('var TEL_CORRECCION_CONECTADA=false;', 'var TEL_CORRECCION_CONECTADA=true;') : telJs;
  if (conectada && tel === telJs) throw new Error('no se encontró la bandera en telefono.js');
  const html = leer('prospectos/index.html')
    .replace('<script src="../supabase.js"></script>', `<script>
      window._llamadas = []; var DATOS = ${JSON.stringify(LISTA)};
      function sbFetch(path, op){ var b = JSON.parse((op && op.body) || '{}'); window._llamadas.push({ path: path, body: b }); var o = null, st = 200;
        if (path === 'rpc/listar_prospectos') o = JSON.parse(JSON.stringify(DATOS));
        else if (path === 'rpc/listar_responsables_prospectos') o = [];
        else if (path === 'rpc/detalle_prospecto') o = Object.assign({ respuestas: {}, reuniones: [] }, DATOS[0]);
        else if (path === 'rpc/prospecto_corregir_telefono') { if (${JSON.stringify(respuesta)} === 'ok') { DATOS[0].tel = b.p_tel; o = { id: b.p_lead_id, tel: b.p_tel, origen: b.p_origen, correccion_id: 7, confirmado_por_prospecto: b.p_origen !== 'correccion_formato' }; }
          else { st = 403; o = { message: 'SIN_PERMISO', code: '42501' }; } }
        return Promise.resolve({ ok: !!o && st === 200, status: o ? st : 404, json: function(){ return Promise.resolve(o); } });
      }
      window._sbAuthReady = true; window._gestoorAccessToken = 'ficticio';
    </script>`)
    .replace('<script src="whatsapp.js"></script>', '<script>' + sinScript(waJs) + '</script>')
    .replace('<script src="telefono.js"></script>', '<script>' + sinScript(tel) + '</script>')
    .replace('<script src="../assets/gestoor-menu.js"></script>', '')
    .replace('<script src="../notifications.js"></script>', '')
    .replace('<script src="../auth.js"></script>', '');
  return new JSDOM(html, { runScripts: 'dangerously', url: 'https://gestoor.ejemplo.test/prospectos/index.html', pretendToBeVisual: true });
}
const escrituras = (w: any) => w._llamadas.filter((x: any) => !/listar_prospectos|listar_responsables_prospectos|detalle_prospecto/.test(x.path));

// 2) bandera false (repositorio)
{
  const dom = montar(false), w: any = dom.window, d = w.document;
  await espera(150);
  d.querySelector('.pr-f[data-id]').click(); await espera(150);
  const b = d.querySelector('#ficha button.tel-btn');
  res('F1 ficha: botón "✏️ Corregir teléfono" presente', !!b && /Corregir teléfono/.test(b.textContent));
  res('F2 bandera false: botón deshabilitado con el motivo', !!b && b.disabled && b.getAttribute('title') === T.NO_CONECTADA);
  b?.removeAttribute('disabled'); b?.click(); await espera();
  res('F3 bandera false: aunque se fuerce el clic, no abre modal', !d.querySelector('.tel-modal'));
  res('F4 bandera false: ninguna llamada de escritura', escrituras(w).length === 0, JSON.stringify(escrituras(w)));
  res('F5 WhatsApp sigue deshabilitado (8 dígitos) hasta corregir', !!d.querySelector('#f-wa .wa-btn[disabled]'));
}
// 3) bandera true (solo en la prueba)
{
  const dom = montar(true), w: any = dom.window, d = w.document;
  await espera(150);
  d.querySelector('.pr-f[data-id]').click(); await espera(150);
  const b = d.querySelector('#ficha button.tel-btn');
  res('T1 bandera true: botón habilitado', !!b && !b.disabled);
  b.click(); await espera();
  const m = d.querySelector('.tel-modal');
  res('T2 abre el modal con el número registrado', !!m && m.querySelector('.tel-act').textContent.includes('12345678'));
  res('T3 modal con 5 orígenes y motivo', m.querySelectorAll('input[name="tel-ori"]').length === 5 && !!m.querySelector('#tel-mot'));
  const num = m.querySelector('#tel-num'), mot = m.querySelector('#tel-mot'), ok = m.querySelector('.tel-ok'), err = m.querySelector('#tel-err');
  num.value = '87654321'; m.querySelector('input[value="prospecto_llamada"]').checked = true; mot.value = 'Lo confirmó por llamada'; ok.click(); await espera();
  res('T4 8 dígitos: error local, sin llamar a la base', err.textContent === T.MSJ.TEL_AMBIGUO_8 && escrituras(w).length === 0, err.textContent);
  num.value = '912345678'; m.querySelector('input[value="correccion_formato"]').checked = true; ok.click(); await espera();
  res('T5 número nuevo marcado como "formato": error local', err.textContent === T.MSJ.FORMATO_CAMBIA_NUMERO && escrituras(w).length === 0, err.textContent);
  m.querySelector('input[value="prospecto_whatsapp"]').checked = true; mot.value = ''; ok.click(); await espera();
  res('T6 sin motivo: error local', err.textContent === T.MSJ.MOTIVO_OBLIGATORIO && escrituras(w).length === 0, err.textContent);
  num.value = '+56 9 1234 5678'; mot.value = 'Me escribió desde su WhatsApp'; ok.click(); await espera(150);
  const e = escrituras(w);
  res('T7 guarda con UNA llamada a prospecto_corregir_telefono (E.164, origen, motivo)', e.length === 1 && e[0].path === 'rpc/prospecto_corregir_telefono'
      && e[0].body.p_lead_id === 1 && e[0].body.p_tel === '+56912345678' && e[0].body.p_origen === 'prospecto_whatsapp' && e[0].body.p_motivo === 'Me escribió desde su WhatsApp', JSON.stringify(e));
  res('T8 el modal se cierra', !d.querySelector('.tel-modal'));
  const wa = d.querySelector('#f-wa .wa-btn');
  res('T9 WhatsApp de la ficha usa el número nuevo', !!wa && !wa.disabled && wa.getAttribute('data-wa') === '56912345678', wa?.outerHTML);
  res('T10 el teléfono mostrado y el botón de corregir quedan con el número nuevo', d.querySelector('#f-tel a').textContent === '+56912345678'
      && d.querySelector('#f-tel button.tel-btn').getAttribute('data-tel-actual') === '+56912345678');
  const waLista = d.querySelector('.pr-f[data-id] button.wa-btn');
  await espera(150);
  res('T11 la lista también usa el número nuevo (repintado inmediato + recarga)', !!waLista && waLista.getAttribute('data-wa') === '56912345678');
  d.querySelector('#f-wa .wa-btn').click(); await espera();
  res('T12 el menú WhatsApp abre wa.me con el número nuevo', (d.querySelector('.wa-menu a.wa-ir')?.href || '').startsWith('https://wa.me/56912345678?text='));
}
// 3b) error de la base
{
  const dom = montar(true, 'sin_permiso'), w: any = dom.window, d = w.document;
  await espera(150);
  d.querySelector('.pr-f[data-id]').click(); await espera(150);
  d.querySelector('#ficha button.tel-btn').click(); await espera();
  const m = d.querySelector('.tel-modal');
  m.querySelector('#tel-num').value = '912345678'; m.querySelector('input[value="prospecto_correo"]').checked = true; m.querySelector('#tel-mot').value = 'Lo envió por correo';
  m.querySelector('.tel-ok').click(); await espera(150);
  res('E1 la base rechaza: modal abierto con mensaje claro y botón reactivado', !!d.querySelector('.tel-modal') && m.querySelector('#tel-err').textContent === T.MSJ.SIN_PERMISO && !m.querySelector('.tel-ok').disabled);
  res('E2 el WhatsApp sigue con el número antiguo (deshabilitado)', !!d.querySelector('#f-wa .wa-btn[disabled]'));
  d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  res('E3 Escape cierra el modal sin cerrar la ficha', !d.querySelector('.tel-modal') && d.getElementById('ficha').classList.contains('on'));
}
// Bitácora: script cargado y línea de tiempo con el tipo nuevo
const bit = leer('prospectos/bitacora.js'), bitHtml = leer('prospectos/bitacora.html');
res('B1 bitacora.html carga telefono.js después de whatsapp.js', bitHtml.indexOf('src="telefono.js"') > bitHtml.indexOf('src="whatsapp.js"') && bitHtml.indexOf('src="telefono.js"') < bitHtml.indexOf('src="bitacora.js"'));
res('B2 bitácora: botón mini junto a WhatsApp y alGuardar actualiza WA.tel', /ProsTel\.boton\(\{id:B\.lead\.id/.test(bit) && /WA\.tel=x\.tel/.test(bit));
res('B3 línea de tiempo muestra tel_corregido (escapado, sin número completo)', /e\.tipo==='tel_corregido'/.test(bit) && /esc\(d\.tel_fin\)/.test(bit) && /esc\(d\.motivo\)/.test(bit));

console.log(`\n${total - fallas}/${total} pruebas OK`);
if (fallas) Deno.exit(1);
