// «Completar con datos del SII» en el formulario del cliente (18-11). Prueba LOCAL: jsdom + edgeFetch simulado; datos ficticios.
// Uso: deno run --allow-read --allow-env --allow-sys --allow-net=registry.npmjs.org pruebas/clientes_completar_sii_test.ts
import { JSDOM } from 'npm:jsdom@24.1.0';
const html = Deno.readTextFileSync(new URL('../clientes/index.html', import.meta.url));
const sii = Deno.readTextFileSync(new URL('../clientes/sii-cartapra.js', import.meta.url));
const script = html.slice(html.indexOf('<script>', html.indexOf('supabase.js')) + 8, html.indexOf('</script>', html.indexOf('<script>', html.indexOf('supabase.js'))));
const fn = (n: string) => { const i = script.indexOf('function ' + n + '('); if (i < 0) throw new Error(n); let d = 0, j = script.indexOf('{', i); for (; j < script.length; j++) { if (script[j] === '{') d++; else if (script[j] === '}' && --d === 0) break; } return script.slice(i, j + 1); };
const codigo = ['g', 'gv', 'sv', 'addSocio', 'getSocios', 'siiTxt', 'siiNorm', 'siiIgual', 'siiRut', 'siiCompletarUI', 'completarConSii', 'siiAltaNoConectada', 'conectarAltaSii'].map(fn).join('\n');
let total = 0, fallas = 0; const res = (n: string, ok: boolean, d = '') => { total++; console.log((ok ? 'OK   ' : 'MAL  ') + n + (ok ? '' : ' · ' + d)); if (!ok) fallas++; };
const espera = () => new Promise((r) => setTimeout(r, 40));
const FICHA = { regimen: 'Régimen Pro Pyme General (14 D N°3)', giro: 'ASESORIAS CONTABLES', afecta_iva: true, iva_mixto: false,
  direccion: 'Calle Ficticia 123', comuna: 'Maipú', email: 'correo@ficticio.cl', telefono: '900000000', ppm: { tasa: 0.125, periodo: '202608' },
  socios: [{ nombre: 'Persona Uno', rut: '11111111-1', participacionCapital: 60 }, { nombre: 'Persona Dos', rut: '22222222-2', participacionCapital: 40 }] };
function montar(resp: [number, any]) {
  const dom = new JSDOM(html.replace(/<script[\s\S]*?<\/script>/g, ''), { runScripts: 'outside-only', url: 'https://gestoor.contadoor.cl/clientes/' });
  const w: any = dom.window; const llamadas: any[] = [];
  w.edgeFetch = (_f: string, b: any) => { llamadas.push(b); return Promise.resolve({ ok: resp[0] === 200, status: resp[0], json: () => Promise.resolve(resp[1]) }); };
  w.eval(sii); w.eval('var _editId = 42, _socioCount = 0, _siiEspera = 0; function updatePct(){} function calcPreview(){}\n' + codigo + '\nwindow.__set=function(v){_editId=v};');
  return { w, llamadas, d: w.document };
}
const OK = (fi: any, extra: any = {}) => [200, { ok: true, conexion: { estado: 'conectada', cargaInicialLista: true }, formulario: fi, ...extra }] as [number, any];
{ // ficha vacía → se llena todo, IVA no se toca si coincide
  const { w, llamadas, d } = montar(OK(FICHA)); w.sv('f-iva', 'afecto');
  w.siiCompletarUI(true); res('botón visible al editar', d.getElementById('btnCompletarSii').style.display === '');
  w.completarConSii(); await espera();
  res('pide formulario del cliente 42', llamadas[0].accion === 'formulario' && llamadas[0].cliente_id === 42);
  res('giro', w.gv('f-giro') === 'ASESORIAS CONTABLES');
  res('dirección y comuna', w.gv('f-direccion') === 'Calle Ficticia 123' && w.gv('f-comuna') === 'Maipú');
  res('régimen 14 D N°3 → 14D3', w.gv('f-reg') === '14D3');
  res('socios agregados (2) con %', w.getSocios().length === 2 && w.getSocios()[0].pct === 60);
  res('correo y teléfono', w.gv('f-email') === 'correo@ficticio.cl' && w.gv('f-tel') === '900000000');
  res('tasa PPM del último F29 + fuente + vigencia', w.gv('f-ppm-tasa-default') === '0.125' && /F29 SII 08-2026/.test(w.gv('f-ppm-fuente')) && w.gv('f-ppm-vigente-desde') === '2026-08-01');
  const t = d.getElementById('siiCompletarRes').textContent;
  res('aviso de completado y «Guardar»', /Completado desde el SII/.test(t) && /Guardar/.test(t));
  res('sin diferencias', !/dice otra cosa/.test(t));
  res('botón vuelve a su texto', d.getElementById('btnCompletarSii').textContent === 'Completar con datos del SII' && !d.getElementById('btnCompletarSii').disabled);
}
{ // campos con valor distinto → no se pisan; botón «Usar el del SII»
  const { w, d } = montar(OK({ ...FICHA, afecta_iva: false, giro: 'Otro giro distinto' }));
  w.sv('f-giro', 'Otro giro'); w.sv('f-direccion', 'CALLE FICTICIA 123'); w.sv('f-email', 'otro@ficticio.cl'); w.sv('f-ppm-tasa-default', '0.25'); w.sv('f-iva', 'afecto'); w.addSocio('Persona Tres', '33333333-3', 100);
  w.completarConSii(); await espera();
  res('giro con valor NO se pisa', w.gv('f-giro') === 'Otro giro');
  res('dirección igual salvo mayúsculas: no es diferencia', w.gv('f-direccion') === 'CALLE FICTICIA 123' && !/Dirección:/.test(d.getElementById('siiCompletarRes').textContent));
  res('comuna vacía se llena', w.gv('f-comuna') === 'Maipú');
  const t = d.getElementById('siiCompletarRes').textContent;
  res('muestra diferencias de giro, IVA, correo, PPM y socios', /Correo: ficha «otro@ficticio.cl» · SII «correo@ficticio.cl»/.test(t) && /Tasa PPM \(%\): ficha «0.25» · SII «0.125 % \(F29 08-2026\)»/.test(t) && /Giro: ficha «Otro giro» · SII «Otro giro distinto»/.test(t) && /IVA: ficha «Afecto» · SII «Exento»/.test(t) && /Socios: el SII informa Persona Uno/.test(t), t);
  res('IVA no cambia solo', w.gv('f-iva') === 'afecto');
  const bs = [...d.querySelectorAll('#siiCompletarRes button')];
  (bs.find((b: any) => b.parentNode.textContent.includes('IVA')) as any).click();
  res('«Usar el del SII» aplica IVA exento', w.gv('f-iva') === 'exento');
  (bs.find((b: any) => b.parentNode.textContent.includes('Socios')) as any).click();
  res('«Reemplazar» deja los 2 socios del SII', w.getSocios().map((s: any) => s.rut).join() === '11111111-1,22222222-2');
}
{ // «Actualizar todo con el SII»: aplica todas las diferencias de una vez
  const { w, d } = montar(OK({ ...FICHA, afecta_iva: false, giro: 'Giro SII' }));
  w.sv('f-giro', 'Giro viejo'); w.sv('f-email', 'otro@ficticio.cl'); w.sv('f-iva', 'afecto'); w.sv('f-ppm-tasa-default', '0.25'); w.addSocio('Persona Tres', '33333333-3', 100);
  w.completarConSii(); await espera();
  d.getElementById('btnSiiTodo').click();
  res('todo aplicado: giro, correo, IVA, PPM y socios', w.gv('f-giro') === 'Giro SII' && w.gv('f-email') === 'correo@ficticio.cl' && w.gv('f-iva') === 'exento' && w.gv('f-ppm-tasa-default') === '0.125' && w.getSocios().length === 2);
  res('botón queda en «Actualizado ✓»', d.getElementById('btnSiiTodo').disabled && /Actualizado/.test(d.getElementById('btnSiiTodo').textContent));
}
{ // tildes y mayúsculas no son diferencia (caso real del 18-11: «Centro Terapeutico» vs «CENTRO TERAPÉUTICO», «Maipú» vs «Maipu»)
  const { w, d } = montar(OK({ ...FICHA, giro: 'CENTRO TERAPÉUTICO', comuna: 'Maipu' }));
  w.sv('f-giro', 'Centro Terapeutico'); w.sv('f-comuna', 'Maipú'); w.completarConSii(); await espera();
  const t = d.getElementById('siiCompletarRes').textContent;
  res('sin diferencia por tildes/mayúsculas', !/Giro:/.test(t) && !/Comuna:/.test(t), t);
}
{ // socios iguales (mismo RUT con puntos y %) → sin diferencia
  const { w, d } = montar(OK(FICHA)); w.addSocio('Persona Uno', '11.111.111-1', 60); w.addSocio('Persona Dos', '22222222-2', 40);
  w.completarConSii(); await espera();
  res('socios iguales por RUT: sin diferencia', !/Socios:/.test(d.getElementById('siiCompletarRes').textContent));
}
{ // régimen fuera de la lista, no conectada, 403, sin ficha
  const a = montar(OK({ regimen: 'Régimen General (14 A)' })); a.w.completarConSii(); await espera();
  res('régimen 14 A: aviso de revisar a mano', /no está en la lista de regímenes/.test(a.d.getElementById('siiCompletarRes').textContent) && a.w.gv('f-reg') === '');
  const b = montar([200, { ok: true, conexion: { estado: 'no_conectada' }, ficha: null }]); b.w.completarConSii(); await espera();
  res('no conectada → explica que conecte primero', /no está conectada/.test(b.d.getElementById('siiCompletarRes').textContent));
  const c = montar([403, { ok: false, error: 'SIN_PERMISO' }]); c.w.completarConSii(); await espera();
  res('403 → mensaje de permisos', /Master y el analista contable/.test(c.d.getElementById('siiCompletarRes').textContent));
  const e = montar(OK(null, { conexion: { estado: 'conectada', cargaInicialLista: false } })); e.w.completarConSii(); await espera();
  res('primera lectura en curso → intenta en unos minutos', /primera vez/.test(e.d.getElementById('siiCompletarRes').textContent));
}
{ // cambio de cliente mientras consulta → no escribe en el otro
  const { w } = montar(OK(FICHA)); w.completarConSii(); w.__set(7); await espera();
  res('respuesta tardía de otro cliente se ignora', w.gv('f-giro') === '');
}
{ // seguridad: datos del SII con HTML se muestran como texto
  const { w, d } = montar(OK({ ...FICHA, giro: '<img src=x onerror=alert(1)>' })); w.sv('f-giro', 'Otro'); w.completarConSii(); await espera();
  res('HTML del SII no se interpreta', !d.querySelector('#siiCompletarRes img'));
}
{ // 24-11 NUEVO cliente: «Traer datos del SII» por el RUT escrito (formulario_alta)
  const ALTA = (fi: any, extra: any = {}) => [200, { ok: true, conexion: { estado: 'conectada', cargaInicialLista: true }, formulario: fi, razon_social: 'EMPRESA FICTICIA SPA', ...extra }] as [number, any];
  const nuevo = (resp: [number, any]) => { const m = montar(resp); m.w.__set(null); m.d.getElementById('modalForm').classList.add('on'); m.w.siiCompletarUI(true, 'Traer datos del SII'); return m; };
  const a = nuevo(ALTA(FICHA));
  res('alta: botón visible con «Traer datos del SII»', a.d.getElementById('btnCompletarSii').style.display === '' && a.d.getElementById('btnCompletarSii').textContent === 'Traer datos del SII');
  a.w.completarConSii(); await espera();
  res('alta sin RUT: pide escribirlo y no llama', a.llamadas.length === 0 && /Escribe primero el RUT/.test(a.d.getElementById('siiCompletarRes').textContent));
  a.w.sv('f-rut', '77.166.269-2'); a.w.completarConSii(); await espera();
  res('alta: pide formulario_alta SOLO con accion y rut (sin puntos)', JSON.stringify(a.llamadas[0]) === JSON.stringify({ accion: 'formulario_alta', rut: '77166269-2' }));
  res('alta: razón social vacía se llena con la del SII', a.w.gv('f-razon') === 'EMPRESA FICTICIA SPA');
  res('alta: giro, régimen y socios', a.w.gv('f-giro') === 'ASESORIAS CONTABLES' && a.w.gv('f-reg') === '14D3' && a.w.getSocios().length === 2);
  res('alta: el botón vuelve a «Traer datos del SII»', a.d.getElementById('btnCompletarSii').textContent === 'Traer datos del SII');
  const b = nuevo(ALTA(FICHA)); b.w.sv('f-razon', 'Mi Nombre SpA'); b.w.sv('f-rut', '77166269-2'); b.w.completarConSii(); await espera();
  res('alta: razón social escrita NO se pisa', b.w.gv('f-razon') === 'Mi Nombre SpA');
  const c = nuevo([200, { ok: true, conexion: { estado: 'no_conectada' }, formulario: null }]); c.w.sv('f-rut', '77166269-2'); c.w.completarConSii(); await espera();
  res('alta no conectada: explica guardar y conectar', /todavía no está conectada a Cartapra/.test(c.d.getElementById('siiCompletarRes').textContent));
  res('alta no conectada: ofrece «Guardar y conectar con el SII» y aclara que la clave queda en Cartapra', !!c.d.getElementById('btnGuardarConectar') && /la clave queda en Cartapra/.test(c.d.getElementById('siiCompletarRes').textContent));
  const c2 = nuevo([403, { ok: false, error: 'SIN_PERMISO' }]); c2.w.sv('f-rut', '77166269-2'); c2.w.completarConSii(); await espera();
  res('sin permiso: NO ofrece guardar y conectar', !c2.d.getElementById('btnGuardarConectar'));
  const e = nuevo([409, { ok: false, error: 'CLIENTE_EXISTE', detalle: 'Ya hay un cliente con ese RUT: ábrelo y usa «Completar con datos del SII».' }]); e.w.sv('f-rut', '77166269-2'); e.w.completarConSii(); await espera();
  res('alta RUT existente: mensaje del servidor', /Ya hay un cliente con ese RUT/.test(e.d.getElementById('siiCompletarRes').textContent));
  const f = nuevo([403, { ok: false, error: 'SIN_PERMISO' }]); f.w.sv('f-rut', '77166269-2'); f.w.completarConSii(); await espera();
  res('alta 403: Master y quienes conectan empresas', /quienes conectan empresas/.test(f.d.getElementById('siiCompletarRes').textContent));
  const g2 = nuevo(ALTA(FICHA)); g2.w.sv('f-rut', '77166269-2'); g2.w.completarConSii(); g2.w.sv('f-rut', '76000000-0'); await espera();
  res('alta: si cambió el RUT mientras consultaba, no escribe', g2.w.gv('f-giro') === '');
}
{ // 24-11 «Conectar con Cartapra» ANTES de crear el cliente (ventana_alta)
  const W = [200, { ok: true, widget: { url: 'https://app.cartapra.com/conecta/widget?t=x', expiraEn: null } }] as [number, any];
  const m = montar(W); m.w.__set(null); m.d.getElementById('modalForm').classList.add('on'); m.w.siiCompletarUI(true, 'Traer datos del SII');
  res('alta: «Conectar con Cartapra» visible', m.d.getElementById('btnConectarAlta').style.display === '');
  m.w.conectarAltaSii(); await espera();
  res('alta: sin RUT no llama y pide el RUT', m.llamadas.length === 0 && /Escribe primero el RUT/.test(m.d.getElementById('siiCompletarRes').textContent));
  m.w.sv('f-rut', '77.166.269-2'); m.w.sv('f-razon', 'Empresa Nueva SpA'); m.w.conectarAltaSii(); await espera();
  res('alta: pide ventana_alta con rut y nombre (sin cliente_id)', JSON.stringify(m.llamadas[0]) === JSON.stringify({ accion: 'ventana_alta', rut: '77166269-2', nombre: 'Empresa Nueva SpA' }));
  res('alta: abre la ventana de Cartapra', !!m.d.querySelector('iframe[src^="https://app.cartapra.com/"]'));
  const e = montar(W); e.w.siiCompletarUI(true); res('edición: «Conectar con Cartapra» oculto', e.d.getElementById('btnConectarAlta').style.display === 'none');
}
{ // nuevo cliente: botón oculto
  const { w, d } = montar(OK(FICHA)); w.siiCompletarUI(false); res('botón oculto en cliente nuevo', d.getElementById('btnCompletarSii').style.display === 'none');
}
const r = ['Régimen Pro Pyme General (14 D N°3)', 'Pro Pyme Transparente (14 D N°8)', 'Renta Presunta', 'Régimen General (14 A)'].map((x) => montar(OK(FICHA)).w.GestoorSII.regimenCodigo(x));
res('mapeo de régimen', r.join() === '14D3,14D8,presunta,', r.join());
console.log(`${total - fallas}/${total} pruebas OK`); if (fallas) Deno.exit(1);
