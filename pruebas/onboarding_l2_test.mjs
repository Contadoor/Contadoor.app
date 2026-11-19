// ONBOARDING-L2 (19-11) · pruebas del front sin navegador: node pruebas/onboarding_l2_test.mjs
import fs from 'fs'; import vm from 'vm';
let ok = 0, fal = 0; const t = (c, m) => { c ? ok++ : fal++; console.log((c ? 'OK    ' : 'FALLA ') + m); };
const R = p => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const pasosJs = R('assets/onboarding-pasos.js'), onbJs = R('prospectos/onboarding.js'), onbHtml = R('prospectos/onboarding.html'),
      fichaJs = R('clientes/onboarding-ficha.js'), cli = R('clientes/index.html');
t(/onboarding-pasos\.js[\s\S]*onboarding\.js/.test(onbHtml), 'Onboarding carga la lista de pasos antes de su script');
t(/sii-cartapra\.js[\s\S]*assets\/onboarding-pasos\.js[\s\S]*onboarding-ficha\.js/.test(cli) && /id="det-onb"/.test(cli) && /OnbFicha\.montar\(g\('det-onb'\), c\.id\)/.test(cli),
  'ficha del cliente: contenedor det-onb y montaje al abrir el detalle');
for (const f of ['onb_paso_marcar', 'onb_activar']) t(pasosJs.includes(`'${f}'`), `lista de pasos usa la RPC ${f}`);
t(onbJs.includes("'onb_pasos'") && onbJs.includes("'onb_tablero'") && fichaJs.includes("'onb_pasos_cliente'"), 'Onboarding usa onb_pasos y onb_tablero; la ficha usa onb_pasos_cliente');
t(!/innerHTML\s*=/.test(pasosJs) && !/innerHTML\s*=/.test(fichaJs), 'la lista de pasos y la ficha no usan innerHTML (datos con textContent)');
t(!/\.from\(|rest\/v1\/onb_/.test(pasosJs + fichaJs + onbJs), 'no leen tablas directo (solo RPC)');
t(/p_version: p\.marca \? p\.marca\.actualizado : null/.test(pasosJs) && /p_actualizado: d\.actualizado/.test(pasosJs), 'marcar y activar envían su versión');
t(/window\.confirm\(/.test(pasosJs) && /d\.yo && d\.yo\.master/.test(pasosJs), '«Pasar a activo»: solo se muestra al Master y pide confirmación');
t(/if \(mio !== seq \|\| !d\) return;/.test(fichaJs), 'ficha: si el cliente no vino de Onboarding (NULL) no se muestra nada');
const crudos = onbJs.split('\n').filter(l => /'\+(c|l|a|n)\.[a-z_]+(?!\w)/.test(l.replace(/esc\([^)]*\)|Number\([^)]*\)/g, '')) && !/valor_uf|faltan\.length|cliente_id/.test(l));
t(crudos.length === 0, 'Onboarding: todo dato de la base entra al HTML con esc() o Number()');

// Render con un DOM mínimo (textContent; sin innerHTML)
function nodo(tag) { return { tagName: tag, children: [], className: '', style: {}, attrs: {}, _t: '', disabled: false, title: '', type: '', href: '', maxLength: 0, placeholder: '', value: '',
  appendChild(n) { this.children.push(n); return n; }, removeChild(n) { this.children = this.children.filter(x => x !== n); },
  setAttribute(k, v) { this.attrs[k] = v; }, querySelector() { return null; }, focus() {},
  set textContent(v) { this._t = String(v); this.children = []; }, get textContent() { return this._t + this.children.map(c => c.textContent).join(''); } }; }
const doc = { head: nodo('head'), createElement: nodo, createTextNode: v => ({ textContent: String(v) }), getElementById: () => null };
const win = { location: { hostname: 'localhost' }, ComDemo: { rpc: () => Promise.reject(new Error('BASE')) } };
const ctx = { window: win, document: doc, location: win.location, setTimeout, Promise, Date, JSON, Math, Number, String, Error, Object };
vm.runInNewContext(pasosJs, ctx); vm.runInNewContext(R('prospectos/onboarding-demo.js'), ctx);
const rpc = (f, a) => win.ComDemo.rpc(f, a).then(x => x, e => 'ERR:' + e.message);
const d = await rpc('onb_pasos', { p_caso_id: 3 });
t(d.pasos.length === 15 && d.resumen.listos === 6 && d.listo_para_activar === false, 'demo: 15 pasos, 6 listos, todavía no se puede activar');
const cont = nodo('div'); win.OnbPasos.render(cont, d, { rpc });
const txt = cont.textContent;
t(/6 de 15 listos/.test(txt) && /Carta de bienvenida/.test(txt) && /Pasar a activo/.test(txt), 'render: avance, pasos y botón del Master');
t(/atrasado/.test(txt), 'render: marca los pasos atrasados');
const comp = nodo('div'); win.OnbPasos.render(comp, d, { rpc, compacto: true });
t(!/Plan aceptado/.test(comp.textContent) && /Carta de bienvenida/.test(comp.textContent), 'modo compacto (ficha): solo lo que falta');
t(await rpc('onb_paso_marcar', { p_caso_id: 3, p_paso: 4, p_estado: 'listo', p_version: null }) === 'ERR:PASO_YA_LISTO' ||
  await rpc('onb_paso_marcar', { p_caso_id: 3, p_paso: 5, p_estado: 'listo', p_version: null }) === 'ERR:PASO_AUTOMATICO', 'demo: lo automático no se marca listo a mano');
t(await rpc('onb_paso_marcar', { p_caso_id: 3, p_paso: 11, p_estado: 'no_aplica', p_motivo: 'no', p_version: null }) === 'ERR:MOTIVO_OBLIGATORIO', 'demo: «no aplica» exige motivo');
t(await rpc('onb_activar', { p_caso_id: 3, p_actualizado: d.actualizado }) === 'ERR:FALTAN_PASOS', 'demo: no activa con pasos obligatorios pendientes');
for (const [p, e, m] of [[5, 'no_aplica', 'Comuna pendiente del SII'], [6, 'no_aplica', 'Empresa nueva sin PPM'], [7, 'no_aplica', 'Empresa nueva sin F22'], [9, 'listo', null], [11, 'listo', null],
  [12, 'listo', 'Trabajo especial creado'], [13, 'listo', null], [15, 'no_aplica', 'Demo: primera entrega']]) {
  const r = await rpc('onb_paso_marcar', { p_caso_id: 3, p_paso: p, p_estado: e, p_motivo: m, p_version: null });
  if (typeof r === 'string') t(p === 15 && r === 'ERR:NO_APLICA_NO_PERMITIDO', 'demo: la primera entrega (15) no admite «no aplica»');
}
const d2 = await rpc('onb_pasos', { p_caso_id: 3 });
t(d2.resumen.obligatorios_pendientes === 1 && !d2.listo_para_activar, 'demo: falta solo la primera entrega');
console.log(`\nRESULTADO ${ok}/${ok + fal}`); process.exitCode = fal ? 1 : 0;
