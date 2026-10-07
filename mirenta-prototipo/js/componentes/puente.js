// Componentes de la renta. Cliente: versión reducida (incluye "× tasa" informada por el motor). Asesor: detalle, fuentes y reglas.
import { clp, pct, esc } from '../formato.js';
export function puente(d, modo) {
  if (modo !== 'ASESOR') {
    const P = (k) => d.puente.find((p) => p.id === k)?.valor ?? null;
    const ppmYCred = P('ppm') === null ? null : Math.abs(P('ppm'));   // créditos no disponibles: se informan aparte, no se suman en cero
    const filas = [['', 'Resultado contable', clp(P('resultado'))], ['+', 'Ajustes', clp(P('agregados'))], ['−', 'Deducciones', clp(P('deducciones') === null ? null : Math.abs(P('deducciones')))],
      ['=', 'Renta imponible (base)', clp(P('base')), 'p-sub'], ['×', 'Tasa estimada', pct(d.resumen.impuesto.tasaAplicable)], ['=', 'Impuesto de la empresa', clp(P('impuesto')), 'p-sub'],
      ['−', 'PPM disponibles', clp(ppmYCred)], ['−', 'Créditos', clp(null)], ['=', 'Saldo estimado', clp(P('saldo')), 'p-tot']];
    return `<div class="puente simple">${filas.map(([s, t, v, c]) => `<div class="p-paso ${c ?? ''}"><div class="p-l"><span class="p-signo">${s}</span>${t}</div><div class="p-v">${v}</div></div>`).join('')}</div>`;
  }
  return `<div class="puente">${d.puente.map((p) => {
    const signo = p.tipo === 'suma' ? '+' : p.tipo === 'resta' ? '−' : '';
    const val = p.valor === null ? clp(null) : clp(p.tipo === 'resta' ? Math.abs(p.valor) : p.valor);
    const det = (p.detalle || p.fuente) ? `<div class="p-det">${(p.detalle || []).map((x) => `<div><span>${esc(x.t)}</span><b>${clp(x.v)}</b></div>`).join('')}
        ${p.fuente ? `<div class="p-fuente">Fuente: ${esc(p.fuente.nombre)} · ${esc(p.fuente.periodo)} · ${esc(p.fuente.estado)}</div>` : ''}</div>` : '';
    return `<div class="p-paso ${p.tipo === 'subtotal' ? 'p-sub' : p.tipo === 'total' ? 'p-tot' : ''}"><div class="p-l"><span class="p-signo">${signo}</span>${esc(p.etiqueta)}${p.nota ? `<small>${esc(p.nota)}</small>` : ''}</div>
      <div class="p-v">${val}</div>${det}</div>`;
  }).join('')}</div>`;
}
