// Prospectos · botón WhatsApp (prospectos/whatsapp.js) · prueba LOCAL (no toca Supabase ni producción; datos 100 % ficticios).
// 1) Normalización del teléfono a formato Chile sin '+'. 2) Armado de los 3 mensajes ({nombre}, {empresa}). 3) Enlace wa.me codificado.
// 4) En jsdom: lista y ficha de Prospectos con sbFetch simulado → botón activo / deshabilitado con aviso, menú editable y enlace
//    target=_blank rel=noopener; la fila no se abre al presionar WhatsApp; ninguna llamada de escritura.
// Uso: deno run --allow-read --allow-env --allow-sys --allow-net=registry.npmjs.org pruebas/prospectos_whatsapp_test.ts
import { JSDOM } from 'npm:jsdom@24.1.0';

const RAIZ = new URL('../', import.meta.url);
const leer = (p: string) => Deno.readTextFileSync(new URL(p, RAIZ));
const waJs = leer('prospectos/whatsapp.js');
const espera = (ms = 80) => new Promise((r) => setTimeout(r, ms));
let total = 0, fallas = 0;
const res = (n: string, ok: boolean, det = '') => { total++; console.log((ok ? 'OK   ' : 'MAL  ') + n + (ok || !det ? '' : ' · ' + det)); if (!ok) fallas++; };
const sinScript = (s: string) => s.replace(/<\/script>/g, '<\\/script>');

// ── 1) a 3) Funciones puras ──
const g: any = {};
new Function('window', waJs)(g);
const W = g.ProsWA;

const casos: [string, any][] = [
  ['+56 9 1234 5678', { ok: true, numero: '56912345678' }],
  ['912345678', { ok: true, numero: '56912345678' }],
  ['56912345678', { ok: true, numero: '56912345678' }],
  ['(9) 1234-5678', { ok: true, numero: '56912345678' }],
  ['+56-9-1234-5678', { ok: true, numero: '56912345678' }],
  ['12345678', { ok: false, motivo: 'corto' }],
  ['1234 5678', { ok: false, motivo: 'corto' }],
  ['', { ok: false, motivo: 'vacio' }],
  [null as any, { ok: false, motivo: 'vacio' }],
  ['abc', { ok: false, motivo: 'formato' }],
  ['812345678', { ok: false, motivo: 'formato' }],
  ['+54 9 1234 5678', { ok: false, motivo: 'formato' }],
  ['9.1234.5678', { ok: false, motivo: 'formato' }],
  ['5691234567', { ok: false, motivo: 'formato' }],
];
for (const [ent, esp] of casos) {
  const r = W.normalizar(ent);
  const ok = r.ok === esp.ok && (esp.ok ? r.numero === esp.numero : r.motivo === esp.motivo);
  res('normalizar ' + JSON.stringify(ent), ok, JSON.stringify(r));
}
res('aviso de 8 dígitos dice "le faltan dígitos"', W.normalizar('12345678').aviso === 'Revisa el teléfono: le faltan dígitos');
res('mostrarNumero', W.mostrarNumero('56912345678') === '+56 9 1234 5678');

const lead = { nombre: 'camila andrea rojas', empresa: 'Ferretería Ficticia SpA' };
res('mensaje Propuesta enviada', W.armar('propuesta', lead) ===
  'Hola Camila 👋 Soy Luciano de Contadoor. Te dejé en tu correo la propuesta para Ferretería Ficticia SpA. ¿Pudiste revisarla? Cualquier duda, conversemos por aquí.');
res('mensaje Después de la reunión', W.armar('reunion', lead) ===
  'Hola Camila 👋 Soy Luciano de Contadoor. Gracias por la reunión de hoy. Te escribo por aquí para que tengas mi contacto directo.');
res('mensaje Libre', W.armar('libre', lead) === 'Hola Camila 👋 Soy Luciano de Contadoor.');
res('empresa vacía → "tu empresa"', W.armar('propuesta', { nombre: 'Jorge', empresa: '  ' }).includes('la propuesta para tu empresa.'));
res('empresa "Aún no tiene" → "tu empresa"', W.armar('propuesta', { nombre: 'Jorge', empresa: 'Aún no tiene' }).includes('la propuesta para tu empresa.'));
res('empresa "aun no tiene" → "tu empresa"', W.armar('propuesta', { nombre: 'Jorge', empresa: 'aun no tiene' }).includes('la propuesta para tu empresa.'));
res('nombre en mayúsculas → "Valeria"', W.primerNombre('VALERIA MUÑOZ') === 'Valeria');
res('nombre mixto se respeta', W.primerNombre('McArthur Pérez') === 'McArthur');
res('sin nombre: "Hola 👋 …" sin doble espacio', W.armar('libre', { nombre: '' }) === 'Hola 👋 Soy Luciano de Contadoor.');
res('ninguna plantilla dice "honorarios"', W.PLANTILLAS.every((p: any) => !/honorario/i.test(p.m + p.t)));
res('3 plantillas en orden', W.PLANTILLAS.map((p: any) => p.t).join('|') === 'Propuesta enviada|Después de la reunión|Libre');
const u = W.url('56912345678', W.armar('libre', lead));
res('url wa.me codificada', u === 'https://wa.me/56912345678?text=' + encodeURIComponent('Hola Camila 👋 Soy Luciano de Contadoor.'));
res('url decodifica al texto original', decodeURIComponent(new URL(u).searchParams.get('text') || '') === 'Hola Camila 👋 Soy Luciano de Contadoor.');
res('botón escapa el nombre', !W.boton({ nombre: '<img src=x onerror=1>', tel: '912345678' }).includes('<img'));

// ── 4) Pantalla Prospectos en jsdom ──
const LISTA = [
  { id: 1, nombre: 'Camila Ficticia', empresa: 'Ferretería Ficticia SpA', email: 'camila@ejemplo.test', tel: '+56 9 1234 5678', etapa: 'propuesta', semaforo: 'verde', creado: '2026-11-01T12:00:00Z' },
  { id: 2, nombre: 'Jorge Ficticio', empresa: 'Aún no tiene', email: 'jorge@ejemplo.test', tel: '12345678', etapa: 'nuevo', semaforo: 'rojo', creado: '2026-11-02T12:00:00Z' },
];
const html = leer('prospectos/index.html')
  .replace('<script src="../supabase.js"></script>', `<script>
    window._llamadas = [];
    function sbFetch(path, op){ window._llamadas.push(path);
      var b = JSON.parse((op && op.body) || '{}'), o = null;
      if (path === 'rpc/listar_prospectos') o = ${JSON.stringify(LISTA)};
      else if (path === 'rpc/listar_responsables_prospectos') o = [];
      else if (path === 'rpc/detalle_prospecto') o = Object.assign({ respuestas: {}, reuniones: [] }, ${JSON.stringify(LISTA)}.filter(function(x){ return x.id === b.p_id; })[0]);
      return Promise.resolve({ ok: !!o, status: o ? 200 : 404, json: function(){ return Promise.resolve(o); } });
    }
    window._sbAuthReady = true; window._gestoorAccessToken = 'ficticio';
  </script>`)
  .replace('<script src="whatsapp.js"></script>', '<script>' + sinScript(waJs) + '</script>')
  .replace('<script src="../assets/gestoor-menu.js"></script>', '')
  .replace('<script src="../notifications.js"></script>', '')
  .replace('<script src="../auth.js"></script>', '');
const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://gestoor.ejemplo.test/prospectos/index.html', pretendToBeVisual: true });
const w: any = dom.window, d = w.document;
await espera(150);
const filas = d.querySelectorAll('.pr-f[data-id]');
res('lista pintada con 2 filas', filas.length === 2, String(filas.length));
const b1 = filas[0].querySelector('button.wa-btn'), b2 = filas[1].querySelector('button.wa-btn');
res('fila con teléfono válido: botón activo', !!b1 && !b1.disabled && b1.getAttribute('data-wa') === '56912345678');
res('fila con 8 dígitos: botón deshabilitado con aviso', !!b2 && b2.disabled && b2.getAttribute('title') === 'Revisa el teléfono: le faltan dígitos');
b1.click(); await espera();
const menu = d.querySelector('.wa-menu');
res('al presionar se abre el menú', !!menu);
res('la fila NO abre la ficha al presionar WhatsApp', !d.getElementById('ficha').classList.contains('on'));
const ir = menu.querySelector('a.wa-ir');
res('enlace target=_blank rel=noopener', ir.getAttribute('target') === '_blank' && ir.getAttribute('rel') === 'noopener');
res('mensaje por defecto: Propuesta enviada', menu.querySelector('#wa-txt').value.startsWith('Hola Camila 👋') && ir.href.startsWith('https://wa.me/56912345678?text='));
menu.querySelectorAll('.wa-ops button')[1].click();
res('elegir "Después de la reunión"', menu.querySelector('#wa-txt').value.includes('Gracias por la reunión de hoy'));
const ta = menu.querySelector('#wa-txt'); ta.value = 'Hola Camila, te dejé la propuesta'; ta.dispatchEvent(new w.Event('input'));
res('texto editado viaja en el enlace', decodeURIComponent(new URL(ir.href).searchParams.get('text') || '') === 'Hola Camila, te dejé la propuesta');
d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
res('Escape cierra el menú', !d.querySelector('.wa-menu'));
filas[1].click(); await espera(150);
const fb = d.querySelector('#ficha .wa-btn');
res('ficha: botón deshabilitado y aviso visible', !!fb && fb.disabled && (d.querySelector('#ficha .wa-aviso')?.textContent || '') === 'Revisa el teléfono: le faltan dígitos');
res('sin llamadas de escritura', w._llamadas.every((p: string) => /listar_prospectos|listar_responsables_prospectos|detalle_prospecto/.test(p)), w._llamadas.join(','));

console.log(`\n${total - fallas}/${total} pruebas OK`);
if (fallas) Deno.exit(1);
