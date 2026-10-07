// Escenarios (R2): parte por "¿Qué decisión quieres evaluar?". BASE = proyección vigente, inmutable. Simulaciones aparte.
// Cliente: tabla corta (impuesto, caja, saldo, costo de la decisión) + "Ver detalle financiero y tributario". Asesor: tabla completa.
import { clp, esc } from '../formato.js';
const CORTA = [['impuesto', 'Impuesto de la empresa'], ['cajaDespuesImpuesto', 'Caja después de impuesto'], ['saldoAbril', 'Saldo abril'], ['costoDecision', 'Costo de la decisión']];
const COMPLETA = [['resultado', 'Resultado proyectado'], ['impuesto', 'Impuesto de la empresa'], ['ppm', 'PPM al cierre'], ['saldoAbril', 'Saldo abril'],
  ['cajaDespuesImpuesto', 'Caja después de impuesto'], ['costoDecision', 'Costo de la decisión'], ['ahorroPermanente', 'Ahorro permanente'], ['diferimiento', 'Diferimiento (no es ahorro)']];
const NEUTRO = ['resultado', 'ppm', 'diferimiento', 'costoDecision'], MENOS_ES_MEJOR = ['impuesto', 'saldoAbril'];

export function escenarios(d, sel, modo, detalle) {
  const base = d.escenarios[0], comp = d.escenarios.filter((e) => sel.includes(e.id) && e.id !== 'base');
  const dif = (e, k) => { const v = e[k] - base[k]; if (v === 0) return '<span class="cero">—</span>';
    const cl = NEUTRO.includes(k) ? 'neutro' : (MENOS_ES_MEJOR.includes(k) ? v < 0 : v > 0) ? 'mejor' : 'peor'; return `<span class="${cl}">${v > 0 ? '+' : ''}${clp(v)}</span>`; };
  const metricas = modo === 'ASESOR' || detalle ? COMPLETA : CORTA;
  const decide = `<section><h2 class="titulo-sec">¿Qué decisión <span>quieres evaluar?</span></h2>
    <div class="decide">${d.decisionesEvaluables.map((x) => `<button class="dch">${esc(x)}</button>`).join('')}</div>
    <p class="nota sola">Al elegir una decisión se abren sus supuestos (prototipo: los escenarios A y B ya están armados).</p></section>`;
  const tarjetas = `<div class="esc-grid"><div class="esc-card base"><small>🔒 Proyección vigente</small><b>Base</b><p>${esc(base.descripcion)}. No se modifica.</p>
      <div class="esc-num"><span>Saldo abril</span><strong>${clp(base.saldoAbril)}</strong></div></div>
    ${d.escenarios.slice(1).map((e) => `<button class="esc-card sim ${sel.includes(e.id) ? 'on' : ''}" data-esc="${e.id}"><small>Simulación${sel.includes(e.id) ? ' · comparando' : ''}</small><b>${esc(e.nombre)}</b><p>${esc(e.descripcion)}</p>
      <div class="esc-num"><span>Saldo abril</span><strong>${clp(e.saldoAbril)}</strong></div></button>`).join('')}</div>`;
  const tabla = comp.length ? `<table class="cmp"><thead><tr><th></th><th>Base</th>${comp.map((e) => `<th>${esc(e.nombre)}</th><th>Impacto</th>`).join('')}</tr></thead>
    <tbody>${metricas.map(([k, t]) => `<tr class="${k === 'saldoAbril' || k === 'costoDecision' ? 'fuerte' : ''} ${k === 'ahorroPermanente' ? 'sep' : ''}"><td>${t}</td><td>${clp(base[k])}</td>${comp.map((e) => `<td>${clp(e[k])}</td><td>${dif(e, k)}</td>`).join('')}</tr>`).join('')}</tbody></table>
    ${modo !== 'ASESOR' ? `<button class="link pad" data-detalle-esc>${detalle ? 'Ocultar detalle' : 'Ver detalle financiero y tributario'} →</button>` : ''}` : '<div class="vacio">Elige una simulación para compararla con la Base.</div>';
  const a = comp.find((e) => e.activo);
  const inv = a ? `<div class="card inversion"><div class="h"><h2>Comprar un activo: <span>¿cuánto cuesta realmente?</span></h2></div>
    <div class="inv-g"><div class="inv-prot"><small>Costo de la decisión</small><b>${clp(a.activo.costo)}</b><span>Salida de caja ${clp(-a.activo.desembolso)}</span></div>
      <div><small>Efecto tributario</small><b>${clp(a.activo.efectoTributario)}</b></div><div><small>Crédito potencial</small><b>${clp(a.activo.credito33bis)}</b></div>
      <div class="inv-neto"><small>Costo económico neto</small><b>${clp(a.activo.costoNeto)}</b></div></div>
    <p class="nota fuerte">No conviene realizar una inversión únicamente por su efecto tributario.</p>
    <p class="nota">Esta decisión reduce el impuesto, pero implica una salida de caja mayor al beneficio tributario.</p></div>` : '';
  return `${decide}${tarjetas}<div class="card"><div class="h"><h2>Comparación <span>con la Base</span></h2><small>Ahorro permanente ≠ diferimiento ≠ caja</small></div>${tabla}</div>${inv}`;
}
