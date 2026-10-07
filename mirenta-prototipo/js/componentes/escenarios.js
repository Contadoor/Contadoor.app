// ScenarioComparator · siempre desde el escenario BASE; nunca modifica la realidad.
// Ahorro permanente, diferimiento y efecto de caja van SEPARADOS (un diferimiento no es ahorro).
import { clp, esc } from '../formato.js';
const METRICAS = [['resultado', 'Resultado proyectado'], ['impuesto', 'Impuesto empresa'], ['ppm', 'PPM al cierre'], ['saldoAbril', 'Saldo abril'],
  ['cajaDespuesImpuesto', 'Caja después de impuesto'], ['ahorroPermanente', 'Ahorro permanente'], ['diferimiento', 'Diferimiento (no es ahorro)']];

export function escenarios(d, sel) {
  const base = d.escenarios[0], comp = d.escenarios.filter((e) => sel.includes(e.id) && e.id !== 'base');
  const tarjetas = d.escenarios.map((e) => `<button class="esc-card ${sel.includes(e.id) ? 'on' : ''} ${e.id === 'base' ? 'base' : ''}" data-esc="${e.id}" ${e.id === 'base' ? 'disabled' : ''}>
      <small>${e.id === 'base' ? 'Referencia' : sel.includes(e.id) ? 'Comparando' : 'Agregar a la comparación'}</small><b>${esc(e.nombre)}</b><p>${esc(e.descripcion)}</p>
      <div class="esc-num"><span>Saldo abril</span><strong>${clp(e.saldoAbril)}</strong></div></button>`).join('');
  // Color solo donde la dirección es inequívoca; diferimiento y resultado van neutros (un diferimiento NO es ahorro).
  const NEUTRO = ['resultado', 'ppm', 'diferimiento'], MENOS_ES_MEJOR = ['impuesto', 'saldoAbril'];
  const dif = (e, k) => { const v = e[k] - base[k]; if (v === 0) return '<span class="cero">—</span>';
    const cl = NEUTRO.includes(k) ? 'neutro' : (MENOS_ES_MEJOR.includes(k) ? v < 0 : v > 0) ? 'mejor' : 'peor';
    return `<span class="${cl}">${v > 0 ? '+' : ''}${clp(v)}</span>`; };
  const tabla = `<table class="cmp"><thead><tr><th>Métrica</th><th>Base</th>${comp.map((e) => `<th>${esc(e.nombre)}</th><th>Diferencia</th>`).join('')}</tr></thead>
    <tbody>${METRICAS.map(([k, t]) => `<tr class="${k === 'saldoAbril' ? 'fuerte' : ''} ${k === 'ahorroPermanente' ? 'sep' : ''}"><td>${t}</td><td>${clp(base[k])}</td>${comp.map((e) => `<td>${clp(e[k])}</td><td>${dif(e, k)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const activo = comp.find((e) => e.activo);
  const bloqueActivo = activo ? `<div class="card activo"><div class="h"><h2>Inversión: <span>${esc(activo.nombre.replace(/^A · /, ''))}</span></h2></div>
    <div class="act-g">${[['Costo activo', activo.activo.costo], ['Desembolso de caja', activo.activo.desembolso], ['Efecto tributario', activo.activo.efectoTributario],
      ['Crédito 33 bis potencial', activo.activo.credito33bis], ['Costo económico neto', activo.activo.costoNeto]].map(([t, v]) => `<div><span>${t}</span><b>${clp(v)}</b></div>`).join('')}</div>
    <p class="nota fuerte">No conviene realizar una inversión únicamente por su efecto tributario.</p></div>` : '';
  return `<div class="esc-grid">${tarjetas}<div class="esc-card nueva"><small>Próximamente</small><b>+ Crear escenario</b><p>${d.ideasEscenario.slice(0, 5).join(' · ')}…</p></div></div>
    <div class="card"><div class="h"><h2>Comparador</h2><small>Diferencias contra Base · ahorro permanente ≠ diferimiento ≠ caja</small></div>${comp.length ? tabla : '<div class="vacio">Elige uno o más escenarios para comparar contra Base.</div>'}</div>${bloqueActivo}`;
}
