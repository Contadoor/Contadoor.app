// Radar (R2): hallazgo / por qué importa / decisión a revisar, separados. Una sola etiqueta "CATEGORÍA · NIVEL".
import { clp, esc, NIVEL } from '../formato.js';
export function radar(items, { limite = null, modo } = {}) {
  if (!items.length) return '<div class="vacio">Sin alertas por ahora.</div>';
  return `<ol class="radar">${items.slice(0, limite ?? items.length).map((r, i) => `
    <li class="ins ${NIVEL[r.nivel]}">
      <div class="ins-top"><span class="num">${i + 1}</span><span class="chip-niv ${NIVEL[r.nivel]}">${esc(r.categoria)} · ${esc(r.nivel)}</span>${r.monto !== null ? `<b class="ins-monto">${clp(r.monto)}</b>` : ''}</div>
      <div class="ins-g">
        <div><small>Hallazgo</small><h3>${esc(r.titulo)}</h3></div>
        <div><small>Por qué importa</small><p>${esc(r.porque)}</p></div>
        <div class="dec-rev"><small>Decisión a revisar</small><p>${esc(r.decision ?? r.accion)}</p></div>
      </div>
      ${modo === 'ASESOR' ? `<div class="ins-pie">Evidencia: ${esc(r.evidencia)} · estado ${esc(r.estado)}</div>` : ''}
    </li>`).join('')}</ol>`;
}
