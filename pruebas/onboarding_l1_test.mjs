// Onboarding L1 (18-11) · pruebas del front sin navegador: node pruebas/onboarding_l1_test.mjs
import fs from 'fs'; import vm from 'vm';
let ok = 0, fal = 0; const t = (c, m) => { c ? ok++ : fal++; console.log((c ? 'OK    ' : 'FALLA ') + m); };
const R = p => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const menu = R('assets/gestoor-menu.js'), html = R('prospectos/onboarding.html'), js = R('prospectos/onboarding.js'), simple = R('prospectos/simple.js'), cli = R('clientes/index.html');
t(/\['check','Onboarding','prospectos','onboarding.html'\]/.test(menu), 'menú: entrada Onboarding en la sección Comercial (carpeta prospectos → mismo permiso de página)');
t(/data-gestoor-pagina="onboarding.html"/.test(html) && /onboarding-demo.js/.test(html) && /window.COM_DEMO/.test(html), 'página: marca su entrada del menú y carga el demo solo con COM_DEMO');
t(/notifications\.js.*auth\.js/.test(html), 'página: exige sesión (auth.js) fuera del demo');
for (const f of ['onb_listar', 'onb_guardar', 'onb_crear_cliente', 'onb_descartar']) t(js.includes(`'${f}'`), `usa la RPC ${f}`);
t(!/\.from\(|rest\/v1\/onb_/.test(js), 'no lee tablas directo (solo RPC)');
t((js.match(/p_actualizado:c\.actualizado/g) || []).length === 3, 'guardar, crear y descartar envían la versión del caso');
t(/window\.confirm\(/.test(js), 'Crear cliente pide confirmación');
t(/href="onboarding\.html\?lead='\+Number\(p\.id\)/.test(simple) && /p\.etapa==='cliente'/.test(simple), 'ficha simple: «Ir a onboarding» solo cuando está Ganado');
t(/_abrirPedido/.test(cli) && cli.includes("{1,18}"), 'Clientes: ?abrir=<id> numérico abre la ficha del cliente creado');
// Sin interpolación de datos de la base sin esc(): cada concatenación de c./l. pasa por esc() o Number()
const crudos = js.split('\n').filter(l => /'\+(c|l|a|n)\.[a-z_]+(?!\w)/.test(l.replace(/esc\([^)]*\)|Number\([^)]*\)/g, '')) && !/valor_uf|faltan\.length|cliente_id/.test(l));
t(crudos.length === 0, 'todo dato de la base entra al HTML con esc() o Number() ' + (crudos.length ? '→ ' + crudos.join(' | ') : ''));
// Demo: reglas iguales a la base
const win = { location: { hostname: 'localhost' }, ComDemo: { rpc: () => Promise.reject(new Error('BASE')) } };
vm.runInNewContext(R('prospectos/onboarding-demo.js'), { window: win, location: win.location, setTimeout, Promise, Date, JSON, Math, Number, String, Error });
const rpc = (f, a) => win.ComDemo.rpc(f, a).then(x => x, e => 'ERR:' + e.message);
const L = await rpc('onb_listar'); const c1 = L.casos[0];
t(L.casos.filter(x => x.estado === 'por_iniciar').length === 2 && c1.faltan.includes('rut') && c1.faltan.includes('analista_rrhh'), 'demo: caso con faltantes (RUT, analista de remuneraciones porque tiene Gestión Laboral)');
t(await rpc('onb_crear_cliente', { p_id: 1, p_actualizado: c1.actualizado }) === 'ERR:FALTAN_DATOS', 'demo: no crea con datos faltantes');
t(await rpc('onb_guardar', { p_id: 1, p_datos: { rut: '11.111.111-2' }, p_actualizado: c1.actualizado }) === 'ERR:RUT_INVALIDO', 'demo: RUT con dígito malo');
t(await rpc('onb_guardar', { p_id: 1, p_datos: { rut: '1' }, p_actualizado: 'vieja' }) === 'ERR:VERSION_CONFLICTO', 'demo: versión vieja');
const g = await rpc('onb_guardar', { p_id: 1, p_datos: { razon_social: 'X SpA', rut: '111111111', plan: 'pro', valor_uf: '3', gestion_laboral: true, fecha_inicio: '2026-12-01', analista_contable_id: '5', analista_rrhh_id: '6' }, p_actualizado: c1.actualizado });
t(g.rut === '11111111-1' && g.faltan.length === 0, 'demo: normaliza el RUT y queda listo');
const cr = await rpc('onb_crear_cliente', { p_id: 1, p_actualizado: g.actualizado });
t(cr.estado === 'cliente_creado' && cr.cliente_id, 'demo: crea el cliente');
t(await rpc('onb_descartar', { p_id: 2, p_motivo: 'no', p_actualizado: L.casos[1].actualizado }) === 'ERR:MOTIVO_OBLIGATORIO', 'demo: descartar exige motivo');
t(await rpc('com_simple_listar') === 'ERR:BASE', 'demo: el resto de las RPC pasa al demo de Prospectos');
console.log(`\nRESULTADO ${ok}/${ok + fal}`); process.exitCode = fal ? 1 : 0;
