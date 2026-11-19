// Reuniones de venta · etiqueta del estado WhatsApp (AGENDA-WA R2) · prueba LOCAL en jsdom con la DEMO (datos ficticios, sin Supabase).
// La demo rota los 6 estados de agenda_wa_estado_reservas por reunión. Se comprueba que se pintan las etiquetas, que
// sin_consentimiento (texto antiguo o número cambiado) muestra «Sin WhatsApp: confirmar a mano» con su ayuda, y que si la RPC
// falla (backend sin instalar) la pantalla funciona igual, sin etiquetas.
// Uso: deno run --allow-read --allow-env --allow-sys --allow-net=registry.npmjs.org pruebas/reuniones_wa_estado_test.ts
import { JSDOM } from 'npm:jsdom@24.1.0';

const RAIZ = new URL('../', import.meta.url);
const leer = (p: string) => Deno.readTextFileSync(new URL(p, RAIZ));
const espera = (ms = 150) => new Promise((r) => setTimeout(r, ms));
let total = 0, fallas = 0;
const res = (n: string, ok: boolean, det = '') => { total++; console.log((ok ? 'OK   ' : 'MAL  ') + n + (ok || !det ? '' : ' · ' + det)); if (!ok) fallas++; };

async function pagina(romperWa: boolean) {
  const dom = new JSDOM('<!doctype html><html><body><div id="cmDemo" hidden></div><div id="cmApp"></div></body></html>',
    { url: 'http://localhost:8765/prospectos/reuniones.html?demo=1', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window as any;
  w.COM_DEMO = true; w.__gestoorCampana = true;
  w.eval(leer('prospectos/comercial-datos.js'));
  w.eval(leer('prospectos/comercial-demo.js'));
  if (romperWa) { const r = w.ComDemo.rpc; w.ComDemo.rpc = (fn: string, a: unknown) => fn === 'agenda_wa_estado_reservas' ? Promise.reject(new Error('PGRST202')) : r(fn, a); }
  w.eval(leer('prospectos/reuniones.js'));
  for (let i = 0; i < 20; i++) { await espera(); if (w.document.querySelector('#cmApp h3')) break; }
  await espera(300);
  for (const b of Array.from(w.document.querySelectorAll('button, [data-vista]')) as any[]) { if (/^Todo$/.test(b.textContent.trim())) { b.click(); break; } }
  await espera(300);
  return w;
}

const w = await pagina(false);
const html = w.document.getElementById('cmApp').innerHTML as string;
const reuniones = w.document.querySelectorAll('#cmApp h3').length;
res('la demo pinta reuniones', reuniones > 0, String(reuniones));
const etiquetas = ['Confirmó por WhatsApp', 'Esperando respuesta', 'Pidió reagendar', 'WhatsApp no entregado', 'Recordatorio programado', 'Sin WhatsApp: confirmar a mano'];
const vistas = etiquetas.filter((t) => html.includes(t));
res('aparecen etiquetas de estado WhatsApp (' + vistas.length + '/6 según las reuniones confirmadas futuras de la demo)', vistas.length >= 1, vistas.join(' | '));
const chipSin = Array.from(w.document.querySelectorAll('#cmApp .estado') as any[]).find((e: any) => e.textContent.includes('Sin WhatsApp: confirmar a mano'));
res('sin_consentimiento → «Sin WhatsApp: confirmar a mano» con la explicación en el título', !!chipSin && /texto anterior/.test(chipSin.getAttribute('title') || ''),
  chipSin ? chipSin.outerHTML : 'no apareció (¿la demo no tiene ≥ 6 reuniones confirmadas futuras?)');
res('la etiqueta no muestra teléfonos', !/\+?569\d{8}/.test(html));

const w2 = await pagina(true);
const html2 = w2.document.getElementById('cmApp').innerHTML as string;
res('si la RPC de WhatsApp falla (backend sin instalar) la pantalla se pinta igual, sin etiquetas',
  w2.document.querySelectorAll('#cmApp h3').length > 0 && !etiquetas.some((t) => html2.includes(t)));

console.log(`\nReuniones WhatsApp: ${total - fallas} OK · ${fallas} MAL`);
try { w.close(); w2.close(); } catch { /* */ }
Deno.exit(fallas ? 1 : 0);
