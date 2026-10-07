// Escenarios (R2.1): parte por "¿Qué decisión quieres evaluar?". BASE = proyección vigente, inmutable. Simulaciones aparte.
// Nuevo: Incentivo al Ahorro (Art. 14 E) como decisión propia (no un switch) y comparador empresa + socios + consolidado.
// Cliente: tabla corta + "Ver detalle financiero y tributario". Asesor: tabla completa. Todas las cifras vienen ya calculadas (demo).
import { clp, esc } from '../formato.js';
const CORTA = [['impuesto', 'Impuesto de la empresa'], ['cajaDespuesImpuesto', 'Caja después de impuesto'], ['saldoAbril', 'Saldo abril'], ['costoDecision', 'Costo de la decisión']];
const COMPLETA = [['resultado', 'Resultado proyectado'], ['impuesto', 'Impuesto de la empresa'], ['ppm', 'PPM al cierre'], ['saldoAbril', 'Saldo abril'],
  ['cajaDespuesImpuesto', 'Caja después de impuesto'], ['costoDecision', 'Costo de la decisión'], ['ahorroPermanente', 'Ahorro permanente'], ['diferimiento', 'Diferimiento (no es ahorro)']];
const NEUTRO = ['resultado', 'ppm', 'diferimiento', 'costoDecision'], MENOS_ES_MEJOR = ['impuesto', 'saldoAbril'];

export function escenarios(d, sel, modo, detalle) {
  const base = d.escenarios[0], comp = d.escenarios.filter((e) => sel.includes(e.id) && e.id !== 'base');
  const dif = (e, k) => { if (e[k] === null || base[k] === null) return '<span class="cero">—</span>'; const v = e[k] - base[k]; if (v === 0) return '<span class="cero">—</span>';
    const cl = NEUTRO.includes(k) ? 'neutro' : (MENOS_ES_MEJOR.includes(k) ? v < 0 : v > 0) ? 'mejor' : 'peor'; return `<span class="${cl}">${v > 0 ? '+' : ''}${clp(v)}</span>`; };
  const metricas = modo === 'ASESOR' || detalle ? COMPLETA : CORTA;
  const decide = `<section><h2 class="titulo-sec">¿Qué decisión <span>quieres evaluar?</span></h2>
    <div class="decide">${d.decisionesEvaluables.map((x) => `<button class="dch ${x.nuevo ? 'nuevo' : ''} ${x.esc && sel.includes(x.esc) ? 'on' : ''}" ${x.esc ? `data-decide="${x.esc}"` : ''}>${esc(x.t)}${x.sub ? `<small>${esc(x.sub)}</small>` : ''}</button>`).join('')}</div>
    <p class="nota sola">Al elegir una decisión se abren sus supuestos (prototipo: incentivo, activo, contratación y retiro ya están armados).</p></section>`;
  const tarjetas = `<div class="esc-grid">${`<div class="esc-card base"><small>🔒 Proyección vigente</small><b>Base</b><p>${esc(base.descripcion)}. No se modifica.</p>
      <div class="esc-num"><span>Saldo abril</span><strong>${clp(base.saldoAbril)}</strong></div></div>`}
    ${d.escenarios.slice(1).map((e) => `<button class="esc-card sim ${sel.includes(e.id) ? 'on' : ''}" data-esc="${e.id}"><small>Simulación${sel.includes(e.id) ? ' · comparando' : ''}</small><b>${esc(e.nombre)}</b><p>${esc(e.descripcion)}</p>
      <div class="esc-num"><span>Saldo abril</span><strong>${clp(e.saldoAbril)}</strong></div></button>`).join('')}</div>`;
  const tabla = comp.length ? `<table class="cmp"><thead><tr><th></th><th>Base</th>${comp.map((e) => `<th>${esc(e.nombre)}</th><th>Impacto</th>`).join('')}</tr></thead>
    <tbody>${metricas.map(([k, t]) => `<tr class="${k === 'saldoAbril' || k === 'costoDecision' ? 'fuerte' : ''} ${k === 'ahorroPermanente' ? 'sep' : ''}"><td>${t}</td><td>${clp(base[k])}</td>${comp.map((e) => `<td>${e[k] === null && k === 'costoDecision' ? '<span class="nd">no aplica</span>' : clp(e[k])}</td><td>${dif(e, k)}</td>`).join('')}</tr>`).join('')}</tbody></table>
    ${modo !== 'ASESOR' ? `<button class="link pad" data-detalle-esc>${detalle ? 'Ocultar detalle' : 'Ver detalle financiero y tributario'} →</button>` : ''}` : '<div class="vacio">Elige una simulación para compararla con la Base.</div>';
  const a = comp.find((e) => e.activo);
  const inv = a ? `<div class="card inversion"><div class="h"><h2>Comprar un activo: <span>¿cuánto cuesta realmente?</span></h2></div>
    <div class="inv-g"><div class="inv-prot"><small>Costo de la decisión</small><b>${clp(a.activo.costo)}</b><span>Salida de caja ${clp(-a.activo.desembolso)}</span></div>
      <div><small>Efecto tributario</small><b>${clp(a.activo.efectoTributario)}</b></div><div><small>Crédito potencial</small><b>${clp(a.activo.credito33bis)}</b></div>
      <div class="inv-neto"><small>Costo económico neto</small><b>${clp(a.activo.costoNeto)}</b></div></div>
    <p class="nota fuerte">No conviene realizar una inversión únicamente por su efecto tributario.</p>
    <p class="nota">Esta decisión reduce el impuesto, pero implica una salida de caja mayor al beneficio tributario.</p></div>` : '';
  const inc = comp.some((e) => e.incentivo) ? incentivo(d.incentivo) : '';
  return `${decide}${tarjetas}${inc}<div class="card"><div class="h"><h2>Comparación <span>con la Base</span></h2><small>Ahorro permanente ≠ diferimiento ≠ caja</small></div>${tabla}</div>${inv}${comparador(d.comparador)}`;
}

function incentivo(x) {
  const n = (t, v, cls = '', nota = '') => `<div class="ia ${cls}"><small>${t}</small><b>${typeof v === 'string' ? esc(v) : clp(v)}</b>${nota ? `<span>${esc(nota)}</span>` : ''}</div>`;
  return `<div class="card incentivo"><div class="h"><h2>Incentivo <span>al Ahorro</span></h2><small>Art. 14 letra E · simulación</small></div>
    <div class="ia-g">${n('RLI antes del incentivo', x.rliAntes)}${n('Monto que permanecería invertido', x.invertido, '', x.notaInvertido)}${n('Deducción potencial', x.deduccionPotencial)}
      ${n('Tope aplicable', x.tope, '', 'Se valoriza con la UF del cierre')}${n('Deducción utilizada', x.deduccionUtilizada)}${n('Nueva base imponible', x.nuevaBase, 'fuerte')}
      ${n('IDPC sin incentivo', x.idpcSin)}${n('IDPC con incentivo', x.idpcCon)}${n('Diferencia tributaria', x.diferencia, 'prot', 'Menor impuesto de la empresa')}</div>
    <div class="ia-ef">${x.efectos.map((e) => `<div><small>${esc(e.t)}</small><p>${esc(e.d)}</p></div>`).join('')}</div>
    <p class="nota fuerte">El incentivo reduce la base imponible cuando se cumplen sus requisitos. Su conveniencia debe evaluarse junto con los retiros, distribuciones y necesidades de caja de la empresa.</p>
    <table class="cmp"><thead><tr><th>Métrica</th><th>Base</th><th>Con incentivo</th></tr></thead><tbody>
      ${x.comparacion.map((f) => `<tr class="${f.fuerte ? 'fuerte' : ''}"><td>${esc(f.t)}${f.nota ? ` <small class="meta">(${esc(f.nota)})</small>` : ''}</td><td>${f.baseTxt ?? clp(f.base)}</td><td>${f.conTxt ? `<span class="meta">${esc(f.conTxt)}</span>` : clp(f.con)}</td></tr>`).join('')}</tbody></table>
    <div class="sep3">${x.separacion.map((s) => `<div><small>${esc(s.t)}</small><b>${s.v === null ? `<em class="nd">${esc(s.txt)}</em>` : clp(s.v)}</b></div>`).join('')}</div>
    <p class="nota">${esc(x.avisoDemo)}</p></div>`;
}

function comparador(c) {
  return `<div class="card" id="comparador"><div class="h"><h2>Empresa + socios · <span>comparador consolidado</span></h2><small>¿Qué pasa si retiro, no retiro o uso el incentivo? · demo</small></div>
    <table class="cmp comp-c"><thead><tr><th></th>${c.columnas.map((x) => `<th>${esc(x)}</th>`).join('')}</tr></thead><tbody>
    ${c.grupos.map((g) => `<tr class="grupo"><td colspan="${c.columnas.length + 1}">${esc(g.g)}</td></tr>${g.filas.map((f) => `<tr class="${f.fuerte ? 'fuerte' : ''}"><td>${esc(f.t)}${f.nota ? ` <small class="meta">(${esc(f.nota)})</small>` : ''}</td>${f.v.map((v) => `<td>${clp(v)}</td>`).join('')}</tr>`).join('')}`).join('')}</tbody></table>
    <p class="nota">La carga consolidada no es IDPC + IGC: el crédito IDPC se descuenta una vez en el socio. Cifras entregadas por el motor futuro (aquí, demo).</p></div>`;
}
