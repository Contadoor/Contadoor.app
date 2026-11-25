// BANDEJA-MEDIOS (25-11) · Bandeja del asistente: fotos/audios recibidos con URL firmada, visor, conservación entre refrescos,
// nota de voz (Chrome WebM → OGG reempaquetado) y reglas de envío. jsdom + E4 simulado; datos FICTICIOS (tono sintético).
// Uso: deno run --allow-read --allow-env --allow-sys --allow-net=registry.npmjs.org pruebas/bandeja_medios_test.ts
import { JSDOM } from 'npm:jsdom@24.1.0';
const html = Deno.readTextFileSync(new URL('../asistente/index.html', import.meta.url));
const app = Deno.readTextFileSync(new URL('../asistente/asistente.js', import.meta.url));
const ogg = Deno.readTextFileSync(new URL('../asistente/opus-ogg.js', import.meta.url));
const WEBM = Deno.readFileSync(new URL('./fixtures/nota_voz_chrome.webm', import.meta.url));
let total = 0, fallas = 0; const res = (n: string, ok: boolean, d = '') => { total++; console.log((ok ? 'OK   ' : 'MAL  ') + n + (ok ? '' : ' · ' + d)); if (!ok) fallas++; };
const espera = (ms = 60) => new Promise((r) => setTimeout(r, ms));
const CONV = '11111111-1111-4111-8111-111111111111', YO = '00000000-0000-4000-8000-000000000001';
const U = (ext: string) => `https://ulxoxqbuxiuylaolaqxj.supabase.co/storage/v1/object/sign/asistente-materiales/adjuntos/${CONV}/${crypto.randomUUID()}.${ext}?token=eyJabc.def-ghi_jkl`;
const URL_IMG = U('jpg'), URL_AUD = U('ogg'), URL_DOC = U('pdf');
const ahora = new Date().toISOString();
const msj = (id: string, extra: Record<string, unknown>) => ({ id, direccion: 'entrante', autor: 'persona', tipo: 'imagen', texto: null, estado_entrega: null, suprimido: false, no_descifra: false, created_at: ahora, envio: null, ...extra });
const MENSAJES = [
  msj('a0000000-0000-4000-8000-000000000001', { tipo: 'imagen', medio: { estado: 'listo', tipo: 'imagen', mime: 'image/jpeg', url: URL_IMG } }),
  msj('a0000000-0000-4000-8000-000000000002', { tipo: 'audio', medio: { estado: 'listo', tipo: 'audio', mime: 'audio/ogg', url: URL_AUD } }),
  msj('a0000000-0000-4000-8000-000000000003', { tipo: 'imagen', medio: { estado: 'pendiente', tipo: 'imagen' } }),
  msj('a0000000-0000-4000-8000-000000000004', { tipo: 'audio', medio: { estado: 'fallido', tipo: 'audio' } }),
  msj('a0000000-0000-4000-8000-000000000005', { tipo: 'imagen', medio: { estado: 'listo', tipo: 'imagen', mime: 'image/jpeg', url: 'https://evil.example.com/x.jpg' } }),
  msj('a0000000-0000-4000-8000-000000000006', { tipo: 'documento', medio: { estado: 'listo', tipo: 'documento', mime: 'application/pdf', url: URL_DOC } }),
  msj('a0000000-0000-4000-8000-000000000007', { tipo: 'imagen', medio: { estado: 'listo', tipo: 'imagen', mime: 'image/jpeg', url: 'javascript:alert(1)' } }),
];
function montar(o: { mr?: 'webm' | 'mp4' | 'ninguno' } = {}) {
  const dom = new JSDOM(html.replace(/<script[\s\S]*?<\/script>/g, '').replace('class="auth-pending"', ''), { runScripts: 'outside-only', url: 'https://gestoor.contadoor.cl/asistente/', pretendToBeVisual: true });
  const w: any = dom.window; const llamadas: any[] = [];
  const conv = { id: CONV, estado: 'humano', modo: 'prospecto', tomada_por: YO, opt_out: false, opt_out_posible: false, sellada: false, ficha: { nombre: 'Persona Ficticia' }, origen: {}, telefono: '+56900000000', last_activity_at: ahora };
  w.ASIS_DEMO = {
    yo: YO,
    resumen: () => Promise.resolve({ esperando_humano: 0, humano: 1, opt_out_posible: 0, envios_inciertos: 0, procesos_error: 0, costo_hoy_usd: 0, tope_costo_usd_dia: 5 }),
    e4: (accion: string, b: any) => {
      llamadas.push({ accion, b });
      if (accion === 'lista') return Promise.resolve({ conversaciones: [{ ...conv, ultimo: { id: 'x', direccion: 'entrante', autor: 'persona', tipo: 'audio', previa: null, created_at: ahora } }], total: 1, parcial: false });
      if (accion === 'detalle') return Promise.resolve(JSON.parse(JSON.stringify({ conversacion: conv, mensajes: MENSAJES, eventos: [] })));
      if (accion === 'bloqueos') return Promise.resolve({ bloqueos: [] });
      return Promise.resolve({ ok: true, envio_id: crypto.randomUUID() });
    },
  };
  w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} }); w.scrollTo = () => {};
  w.SB_URL = 'https://ulxoxqbuxiuylaolaqxj.supabase.co'; w.gIcon = () => ''; w.sbH = () => ({}); w.sbFetch = () => Promise.reject(new Error('no'));
  w._sbAuthClient = { auth: { getSession: () => Promise.resolve({ data: { session: { user: { id: YO } } } }) } };
  w.HTMLMediaElement.prototype.load = function () {}; w.HTMLMediaElement.prototype.pause = function () {};
  let n = 0; w.URL.createObjectURL = () => `blob:https://gestoor.contadoor.cl/${++n}`; w.URL.revokeObjectURL = () => {};
  w.Blob.prototype.arrayBuffer = function () { return new Promise((r) => { const f = new w.FileReader(); f.onload = () => r(f.result); f.readAsArrayBuffer(this); }); };
  // Micrófono y MediaRecorder simulados: al detener entrega el WebM de prueba (o un MP4 mínimo si es «Safari»).
  if (o.mr !== 'ninguno') {
    const tipo = o.mr === 'mp4' ? 'audio/mp4' : 'audio/webm;codecs=opus';
    w.navigator.mediaDevices = { getUserMedia: () => Promise.resolve({ getTracks: () => [{ stop() { w.__pistaDetenida = true; } }] }) };
    w.MediaRecorder = class { static isTypeSupported(t: string) { return t === tipo; } ondataavailable: any; onstop: any; mimeType = tipo;
      constructor(_s: unknown, op: any) { w.__pedido = op.mimeType; }
      start() { w.__grabando = this; }
      stop() { const datos = o.mr === 'mp4' ? new Uint8Array([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x4d, 0x34, 0x41, 0x20]) : WEBM;
        this.ondataavailable({ data: new w.Blob([datos], { type: tipo.split(';')[0] }) }); setTimeout(() => this.onstop(), 0); } };
  }
  w.eval(ogg); w.eval(app);
  return { w, d: w.document, llamadas };
}
const reloj = (w: any, ms: number) => { const real = w.Date.now; w.Date.now = () => real() + ms; };

{ // Recibidos: imagen, audio, documento; pendientes/fallidos con texto; URL ajena o javascript: → nunca se usa
  const { w, d, llamadas } = montar();
  await espera(300); d.querySelector('.as-c').click(); await espera(300);
  const img = d.querySelector('.as-med-img img') as any, aud = d.querySelector('.as-med-aud') as any, doc = d.querySelector('.as-med-doc') as any;
  res('R1 imagen recibida: miniatura con la URL firmada exacta', !!img && img.getAttribute('src') === URL_IMG && img.getAttribute('loading') === 'lazy');
  res('R2 audio recibido: reproductor <audio controls> con la URL firmada', !!aud && aud.getAttribute('src') === URL_AUD && aud.hasAttribute('controls'));
  res('R3 PDF recibido: enlace «Abrir documento» en pestaña nueva (noopener)', !!doc && doc.getAttribute('href') === URL_DOC && /noopener/.test(doc.getAttribute('rel')));
  const txt = d.querySelector('.as-msgs').textContent;
  res('R4 pendiente → «Imagen recibida · cargando…»; fallido → «Audio recibido · no se pudo descargar»', /Imagen recibida · cargando…/.test(txt) && /Audio recibido · no se pudo descargar/.test(txt), txt);
  const srcs = [...d.querySelectorAll('[src],[href]')].map((x: any) => x.getAttribute('src') || x.getAttribute('href'));
  res('R5 URL que no es la firmada del Storage (otro dominio o javascript:) → NO se usa (queda el texto)', !srcs.some((s: string) => /evil|javascript/.test(s)), JSON.stringify(srcs));
  // Conservación: un refresco (misma URL) no reemplaza el elemento de audio (no corta lo que se escucha)
  const antes = d.querySelector('.as-med-aud'); w.dispatchEvent(new w.Event('focus'));
  d.dispatchEvent(new w.Event('visibilitychange')); await espera(300);
  res('R6 tras refrescar la bandeja el MISMO reproductor sigue en la página (no se reinicia)', d.querySelector('.as-med-aud') === antes);
  // Visor
  (d.querySelector('.as-med-img') as any).click();
  const visor = d.getElementById('as-visor');
  res('R7 clic en la miniatura → visor en grande con la misma imagen; Escape lo cierra', !visor.hidden && visor.querySelector('img').getAttribute('src') === URL_IMG);
  d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape' }));
  res('R7b visor cerrado', visor.hidden);
  // URL vencida → error de carga → se vuelve a pedir el detalle (una vez)
  const nDet = llamadas.filter((x) => x.accion === 'detalle').length;
  d.querySelector('.as-med-aud').dispatchEvent(new w.Event('error')); d.querySelector('.as-med-img img').dispatchEvent(new w.Event('error')); await espera(300);
  res('R8 URL vencida (error al cargar) → relee el detalle UNA vez y marca el medio', llamadas.filter((x) => x.accion === 'detalle').length === nDet + 1);
}
{ // Nota de voz en «Chrome»: WebM → OGG reempaquetado; se envía como audio/ogg sin texto
  const { w, d, llamadas } = montar({ mr: 'webm' });
  await espera(300); d.querySelector('.as-c').click(); await espera(300);
  const mic = d.getElementById('as-grabar');
  res('V1 botón de micrófono visible y habilitado en conversación tomada', !!mic && !mic.disabled);
  mic.click(); await espera(50);
  res('V2 al grabar: pide webm/opus, muestra «Grabando» con Detener y el botón queda en rojo', w.__pedido === 'audio/webm;codecs=opus' && /Grabando/.test(d.getElementById('as-chip').textContent) && mic.classList.contains('on'));
  reloj(w, 2000); (d.getElementById('as-detener') as any).click(); await espera(400);
  const chip = d.getElementById('as-chip'), a = chip.querySelector('audio');
  res('V3 al detener: el micrófono se libera y aparece la escucha previa con ✕ para descartar', w.__pistaDetenida === true && !!a && /^blob:/.test(a.getAttribute('src')) && !!d.getElementById('as-quitar') && /Nota de voz/.test(chip.textContent), chip.innerHTML);
  const ta = d.getElementById('as-texto'); ta.value = 'texto'; d.getElementById('as-comp').dispatchEvent(new w.Event('submit', { cancelable: true })); await espera(100);
  res('V4 con texto escrito → NO se envía (WhatsApp no admite texto en audio) y se avisa', !llamadas.some((x) => x.accion === 'responder_adjunto') && /sin texto/.test(d.getElementById('as-aviso').textContent));
  ta.value = ''; d.getElementById('as-comp').dispatchEvent(new w.Event('submit', { cancelable: true })); await espera(400);
  const env = llamadas.find((x) => x.accion === 'responder_adjunto');
  const bytes = env ? Uint8Array.from(atob(env.b.contenido), (c) => c.charCodeAt(0)) : new Uint8Array();
  res('V5 se envía como audio/ogg «Nota de voz.ogg», sin texto, y el contenido es OGG (OggS) — no WebM',
    !!env && env.b.mime === 'audio/ogg' && env.b.nombre === 'Nota de voz.ogg' && !('texto' in env.b) && String.fromCharCode(...bytes.slice(0, 4)) === 'OggS', JSON.stringify(env?.b && { ...env.b, contenido: env.b.contenido.slice(0, 12) }));
  res('V6 tras enviar se limpia la nota de voz', d.getElementById('as-chip').hidden);
  // cancelar una grabación no deja nada
  mic.click(); await espera(50); (d.getElementById('as-cancelar-grab') as any).click(); await espera(100);
  res('V7 cancelar la grabación → no queda nota de voz', d.getElementById('as-chip').hidden && !mic.classList.contains('on'));
  // tope de 2 minutos: se detiene sola
  mic.click(); await espera(50); reloj(w, 125000); await espera(700);
  res('V8 a los 2 minutos la grabación se detiene sola', !mic.classList.contains('on') && !!d.getElementById('as-chip').querySelector('audio'));
}
{ // «Safari»: graba MP4 → se envía audio/mp4 .m4a (sin reempaquetar)
  const { d, llamadas, w } = montar({ mr: 'mp4' });
  await espera(300); d.querySelector('.as-c').click(); await espera(300);
  d.getElementById('as-grabar').click(); await espera(50); reloj(w, 3000); (d.getElementById('as-detener') as any).click(); await espera(300);
  d.getElementById('as-comp').dispatchEvent(new w.Event('submit', { cancelable: true })); await espera(300);
  const env = llamadas.find((x) => x.accion === 'responder_adjunto');
  res('S1 Safari: audio/mp4 «Nota de voz.m4a»', env?.b.mime === 'audio/mp4' && env?.b.nombre === 'Nota de voz.m4a', JSON.stringify(env?.b?.mime));
}
{ // Navegador sin grabación → botón deshabilitado
  const { d } = montar({ mr: 'ninguno' });
  await espera(300); d.querySelector('.as-c').click(); await espera(300);
  res('N1 sin MediaRecorder: el micrófono queda deshabilitado', d.getElementById('as-grabar').disabled === true);
}
{ // Reempaquetado WebM→OGG directo (módulo)
  const dom = new JSDOM('', { runScripts: 'outside-only' }); const w: any = dom.window; w.eval(ogg);
  const r = w.GestoorOpusOgg.webmAOgg(WEBM.buffer);
  const b = r.bytes as Uint8Array;
  let paginas = 0; for (let i = 0; i + 4 <= b.length; i++) if (b[i] === 0x4f && b[i + 1] === 0x67 && b[i + 2] === 0x67 && b[i + 3] === 0x53) paginas++;
  res('O1 WebM de 1,5 s → OGG con OpusHead + OpusTags, ~1,5 s y varias páginas', String.fromCharCode(...b.slice(28, 36)) === 'OpusHead' && Math.abs(r.segundos - 1.5) < 0.05 && paginas >= 3, `${r.segundos} ${paginas}`);
  let err = ''; try { w.GestoorOpusOgg.webmAOgg(new Uint8Array([1, 2, 3, 4]).buffer); } catch (e) { err = String((e as Error).message); }
  res('O2 archivo que no es WebM/Opus → error (no se envía nada raro)', /^webm_/.test(err), err);
}
console.log(`${total - fallas}/${total} pruebas OK`); Deno.exit(fallas ? 1 : 0);
