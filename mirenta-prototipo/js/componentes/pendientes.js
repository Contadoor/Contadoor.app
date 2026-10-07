// "Qué debemos revisar" y decisiones para revisar (R2: decisión, impacto, cuándo revisarla, por qué apareció, acción).
import { esc, NIVEL } from '../formato.js';
export function pendientes(items, modo) {
  if (!items.length) return '<div class="vacio ok">✓ No hay pendientes.</div>';
  return `<ul class="pend">${items.map((p) => `<li><span class="dot ${NIVEL[p.nivel]}"></span><div><b>${esc(p.titulo)}</b><small>${esc(p.explicacion)}</small></div>
    <button class="btn sm">${modo === 'ASESOR' ? 'Revisar' : 'Ver explicación'}</button></li>`).join('')}</ul>`;
}
export function decisiones(items) {
  if (!items.length) return '<div class="vacio">Sin decisiones sugeridas por ahora.</div>';
  return `<div class="decis">${items.map((x) => `<div class="dec"><b>${esc(x.titulo)}</b>
    <dl><dt>Impacto</dt><dd>${esc(x.impacto)}</dd><dt>Cuándo revisarla</dt><dd>${esc(x.urgencia)}</dd><dt>Por qué apareció</dt><dd>${esc(x.evidencia)}</dd><dt>Acción</dt><dd>${esc(x.accion)}</dd></dl></div>`).join('')}</div>
    <p class="nota">Son decisiones para conversar, no órdenes automáticas.</p>`;
}
