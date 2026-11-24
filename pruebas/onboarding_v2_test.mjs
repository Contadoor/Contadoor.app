// ONBOARDING-V2 (23-11) · pruebas del front sin navegador: node pruebas/onboarding_v2_test.mjs
import fs from 'fs'; import vm from 'vm';
let ok = 0, fal = 0; const t = (c, m) => { c ? ok++ : fal++; console.log((c ? 'OK    ' : 'FALLA ') + m); };
const R = p => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const pasosJs = R('assets/onboarding-pasos.js'), onbJs = R('prospectos/onboarding.js'), demoJs = R('prospectos/onboarding-demo.js');
t(pasosJs.includes("'onb_paso_marcar_v2'") && /p_fecha: fechaV, p_enlace: enlace/.test(pasosJs), 'lista 2: marca con onb_paso_marcar_v2 (fecha y enlace)');
t(/if \(d\.lista_version === 2\) return renderV2/.test(pasosJs), 'la lista 1 (L2) se sigue pintando con el render de siempre');
t(!/innerHTML\s*=/.test(pasosJs), 'sin innerHTML: datos con textContent e íconos con createElementNS');
t(/\/\^https:\\\/\\\/\/\.test\(p\.marca\.enlace\)/.test(pasosJs) && /noopener noreferrer/.test(pasosJs), 'el enlace del diagnóstico solo se pinta si es https y abre sin referrer');
t(/class="ic|'ic ic-'/.test(pasosJs), 'íconos de línea con color dentro de <i class="ic ic-…">');
t(!/a855f7/i.test(pasosJs + onbJs), 'sin el morado prohibido');
t(!/\b\d{7,8}-[\dkK]\b/.test(demoJs.replace(/1111111[12]-[12]|7777777-7|76086428-5|77777777-7/g, '')), 'demo: solo RUT ficticios');
t(/esV2\(cs\)&&cs\.estado==='por_iniciar'/.test(onbJs), 'Onboarding: el caso v2 muestra sus pasos desde la aceptación (antes de crear el cliente)');

function nodo(tag) { return { tagName: tag, children: [], className: '', style: {}, attrs: {}, _t: '', disabled: false, title: '', type: '', href: '', target: '', rel: '', maxLength: 0, placeholder: '', value: '',
  appendChild(n) { this.children.push(n); return n; }, removeChild(n) { this.children = this.children.filter(x => x !== n); },
  setAttribute(k, v) { this.attrs[k] = v; }, querySelector() { return null; }, focus() {},
  set textContent(v) { this._t = String(v); this.children = []; }, get textContent() { return this._t + this.children.map(c => c.textContent).join(''); } }; }
const doc = { head: nodo('head'), createElement: nodo, createElementNS: (ns, tag) => nodo(tag), createTextNode: v => ({ textContent: String(v) }), getElementById: () => null };
const win = { location: { hostname: 'localhost' }, ComDemo: { rpc: () => Promise.reject(new Error('BASE')) }, confirm: () => true };
const ctx = { window: win, document: doc, location: win.location, setTimeout, Promise, Date, JSON, Math, Number, String, Error, Object };
vm.runInNewContext(pasosJs, ctx); vm.runInNewContext(demoJs, ctx);
const rpc = (f, a) => win.ComDemo.rpc(f, a).then(x => x, e => 'ERR:' + e.message);
const botones = (n, acc = []) => { if (n.tagName === 'button') acc.push(n); (n.children || []).forEach(c => botones(c, acc)); return acc; };

const tab = await rpc('onb_tablero', {});
t(tab.casos.some(c => c.caso_id === 4 && c.lista_version === 2 && c.estado_caso === 'por_iniciar') && tab.casos.some(c => c.caso_id === 3 && c.lista_version === 1),
  'tablero demo: caso nuevo (lista 2, por iniciar) junto al caso L2 (lista 1)');
const d4 = await rpc('onb_pasos', { p_caso_id: 4 });
t(d4.pasos.length === 10 && d4.tramos.length === 2 && d4.tramos[0].dias_restantes === 3, 'caso que aceptó hoy: 10 pasos, Activación con 3 días por delante');
const c4 = nodo('div'); win.OnbPasos.render(c4, d4, { rpc }); const x4 = c4.textContent;
t(/1 de 10 listos/.test(x4) && /1 · Activación/.test(x4) && /2 · Diagnóstico/.test(x4) && /Quedan 3 días/.test(x4) && /días hábiles/.test(x4), 'render: avance de 10 y los dos tramos con su cuenta regresiva');
t(/Diagnóstico contable «Aquí partimos»/.test(x4) && /Comercial \+ Analista/.test(x4) && /Comercial \+ Master/.test(x4), 'render: nombres de pasos y responsables (Comercial + Master, Comercial + Analista)');
t(!/Pasar a activo/.test(x4), 'caso por iniciar: todavía sin botón «Pasar a activo»');
const bl = botones(c4).filter(b => b.textContent === '✓ Marcar listo');
t(bl.some(b => b.disabled && /factura de activación/.test(b.title)), '«Marcar listo» de la carta queda desactivado con el motivo (falta la factura de activación)');
t(await rpc('onb_paso_marcar_v2', { p_caso_id: 4, p_paso: 3, p_estado: 'listo', p_version: null }) === 'ERR:FALTA_FECHA', 'demo: reunión agendada sin fecha → FALTA_FECHA');
const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
const d4b = await rpc('onb_paso_marcar_v2', { p_caso_id: 4, p_paso: 3, p_estado: 'listo', p_version: null, p_fecha: hoy });
t(d4b.pasos[2].estado === 'listo' && d4b.resumen.listos === 2, 'demo: reunión agendada con fecha → listo');

const d5 = await rpc('onb_pasos', { p_caso_id: 5 });
const c5 = nodo('div'); win.OnbPasos.render(c5, d5, { rpc }); const x5 = c5.textContent;
t(d5.tramos[0].estado === 'vencido' && /Venció el/.test(x5), 'caso de hace 4 días: tramo Activación vencido');
t(/esperando al cliente · \d+ días? fuera de plazo/.test(x5) && /atrasado/.test(x5), 'distingue el atraso del cliente («esperando al cliente») del atraso del equipo');
t(/Pasar a activo/.test(x5) && botones(c5).some(b => b.textContent === '✅ Pasar a activo' && b.disabled), 'cliente creado: botón del Master visible pero desactivado hasta la reunión de entrega');
t(await rpc('onb_paso_marcar_v2', { p_caso_id: 5, p_paso: 10, p_estado: 'listo', p_version: null, p_fecha: hoy }) === 'ERR:FALTA_REQUISITO', 'demo: reunión de entrega antes del diagnóstico → FALTA_REQUISITO');
t(await rpc('onb_paso_marcar_v2', { p_caso_id: 5, p_paso: 9, p_estado: 'listo', p_version: null, p_enlace: 'http://x.test/d.pdf' }) === 'ERR:ENLACE_INVALIDO', 'demo: enlace sin https → ENLACE_INVALIDO');
let d = await rpc('onb_paso_marcar_v2', { p_caso_id: 5, p_paso: 9, p_estado: 'listo', p_version: null, p_enlace: 'https://ejemplo.test/diagnostico.pdf' });
t(d.pasos[8].estado === 'listo', 'demo: diagnóstico emitido con enlace https');
for (const p of [2, 6, 7]) d = await rpc('onb_paso_marcar_v2', { p_caso_id: 5, p_paso: p, p_estado: 'listo', p_version: null });
d = await rpc('onb_paso_marcar_v2', { p_caso_id: 5, p_paso: 5, p_estado: 'listo', p_version: d.pasos[4].marca.actualizado });
t(d.pasos[4].estado === 'listo', 'demo: pasar de «esperando al cliente» a «listo» con la versión de la marca');
d = await rpc('onb_paso_marcar_v2', { p_caso_id: 5, p_paso: 8, p_estado: 'no_aplica', p_motivo: 'El cliente no quiere portal por ahora', p_version: null });
d = await rpc('onb_paso_marcar_v2', { p_caso_id: 5, p_paso: 10, p_estado: 'listo', p_version: null, p_fecha: hoy });
t(d.listo_para_activar === true && d.tramos[1].estado === 'cumplido', 'demo: reunión de entrega realizada → listo para activar');
const c6 = nodo('div'); win.OnbPasos.render(c6, d, { rpc });
t(/Ver diagnóstico/.test(c6.textContent) && /reunión de entrega y todo está listo/.test(c6.textContent), 'render: enlace al diagnóstico y aviso de listo para activar');
const act = await rpc('onb_activar', { p_caso_id: 5, p_actualizado: d.actualizado });
t(act.activado_at && act.cliente_estado === 'activo', 'demo: el Master activa');
const comp = nodo('div'); win.OnbPasos.render(comp, d5, { rpc, compacto: true });
t(!/Aceptó la propuesta/.test(comp.textContent) && /Tramo 1/.test(comp.textContent), 'modo compacto (ficha del cliente): solo lo que falta, con los tramos');
console.log(`\nRESULTADO ${ok}/${ok + fal}`); process.exitCode = fal ? 1 : 0;
