// TaxRadar · insights por categoría y nivel (URGENTE / REVISAR / INFORMATIVO). Sin alarmismo.
import { clp, esc, NIVEL } from '../formato.js';
export function radar(items, { limite = null, modo } = {}) {
  if (!items.length) return '<div class="vacio">Sin alertas: no hay información suficiente o no hay nada que destacar.</div>';
  return `<div class="radar">${items.slice(0, limite ?? items.length).map((r) => `
    <article class="ins ${NIVEL[r.nivel]}">
      <div class="ins-top"><span class="chip-cat">${esc(r.categoria)}</span><span class="chip-niv ${NIVEL[r.nivel]}">${esc(r.nivel)}</span>${r.monto !== null ? `<b class="ins-monto">${clp(r.monto)}</b>` : ''}</div>
      <h3>${esc(r.titulo)}</h3><p>${esc(r.porque)}</p>
      <div class="ins-pie"><span>Evidencia: ${esc(r.evidencia)}</span><span>→ ${esc(r.accion)}</span>${modo === 'ASESOR' ? `<span class="ins-est">${esc(r.estado)}</span>` : ''}</div>
    </article>`).join('')}</div>`;
}
