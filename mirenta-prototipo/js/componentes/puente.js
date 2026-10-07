// ProjectionBridge · resultado contable → ajustes → base → impuesto → PPM/créditos → saldo.
// Cliente: pasos simples. Asesor: cada paso se expande con detalle y fuente.
import { clp, esc } from '../formato.js';
export function puente(d, modo) {
  return `<div class="puente">${d.puente.map((p) => {
    const signo = p.tipo === 'suma' ? '+' : p.tipo === 'resta' ? '−' : '';
    const val = p.valor === null ? clp(null) : clp(p.tipo === 'resta' ? Math.abs(p.valor) : p.valor);
    const det = modo === 'ASESOR' && (p.detalle || p.fuente) ? `<div class="p-det">
        ${(p.detalle || []).map((x) => `<div><span>${esc(x.t)}</span><b>${clp(x.v)}</b></div>`).join('')}
        ${p.fuente ? `<div class="p-fuente">Fuente: ${esc(p.fuente.nombre)} · ${esc(p.fuente.periodo)} · ${esc(p.fuente.estado)}</div>` : ''}</div>` : '';
    return `<div class="p-paso ${p.tipo}"><div class="p-l"><span class="p-signo">${signo}</span>${esc(p.etiqueta)}${p.nota ? `<small>${esc(p.nota)}</small>` : ''}</div>
      <div class="p-v">${val}</div>${det}</div>`;
  }).join('')}</div>`;
}
