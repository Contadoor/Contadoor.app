// PendingReviews ("Qué debemos revisar") y decisiones para revisar ("Qué podemos hacer").
import { esc, NIVEL } from '../formato.js';
export function pendientes(items, modo) {
  if (!items.length) return '<div class="vacio ok">✓ No hay pendientes.</div>';
  return `<ul class="pend">${items.map((p) => `<li><span class="dot ${NIVEL[p.nivel]}"></span><div><b>${esc(p.titulo)}</b><small>${esc(p.explicacion)}</small></div>
    <button class="btn sm">${modo === 'ASESOR' ? 'Revisar' : 'Ver explicación'}</button></li>`).join('')}</ul>`;
}
export function decisiones(items) {
  if (!items.length) return '<div class="vacio">Sin decisiones sugeridas por ahora.</div>';
  return `<div class="decis">${items.map((x) => `<div class="dec"><b>${esc(x.titulo)}</b>
    <div class="dec-g"><span>Impacto<em>${esc(x.impacto)}</em></span><span>Urgencia<em>${esc(x.urgencia)}</em></span><span>Evidencia<em>${esc(x.evidencia)}</em></span><span>Acción<em>${esc(x.accion)}</em></span></div></div>`).join('')}</div>
    <p class="nota">Son decisiones para conversar, no órdenes automáticas.</p>`;
}
