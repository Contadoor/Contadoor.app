// Gráficos SVG simples (solo dibujan series ya calculadas). Real = sólido · Proyectado = rayado.
import { mm } from '../formato.js';

export function barrasRealProyectado(meses, campo, alto = 180) {
  if (!meses.length) return '<div class="vacio">Sin información para graficar.</div>';
  const max = Math.max(...meses.map((m) => m[campo])) || 1;
  return `<div class="barras" style="height:${alto}px" role="img" aria-label="Real y proyectado por mes">${meses.map((m) =>
    `<div class="bcol" title="${m.mes} · ${m.tipo === 'REAL' ? 'real' : 'proyectado'} · ${mm(m[campo]).replace(/<[^>]+>/g, '')}">
       <i class="${m.tipo === 'REAL' ? 'b-real' : 'b-proy'}" style="height:${(m[campo] / max) * 100}%"></i><span>${m.mes}</span></div>`).join('')}</div>
    <div class="ley"><span><i class="l-real"></i>Real</span><span><i class="l-proy"></i>Proyectado</span></div>`;
}

// Dos líneas (p. ej. impuesto proyectado vs PPM acumulado). Tramo proyectado en línea punteada.
export function lineas(puntos, series, alto = 200) {
  if (!puntos.length) return '<div class="vacio">Sin información para graficar.</div>';
  const max = Math.max(...puntos.flatMap((p) => series.map((s) => p[s.campo] ?? 0))) * 1.1 || 1;
  const W = 600, H = alto, pad = 26, n = puntos.length;
  const X = (i) => pad + (i * (W - 2 * pad)) / (n - 1), Y = (v) => H - pad - (v / max) * (H - 2 * pad);
  const corte = puntos.findIndex((p) => p.tipo === 'PROYECTADO');
  const tramo = (s, desde, hasta) => puntos.slice(desde, hasta).map((p, k) => `${k ? 'L' : 'M'}${X(desde + k)},${Y(p[s.campo])}`).join(' ');
  const svgSeries = series.map((s) => {
    const real = tramo(s, 0, corte < 0 ? n : corte), proy = corte < 0 ? '' : tramo(s, Math.max(corte - 1, 0), n);
    return `<path d="${real}" class="ln ${s.clase}"/>${proy ? `<path d="${proy}" class="ln ${s.clase} punteada"/>` : ''}
      ${puntos.map((p, i) => `<circle cx="${X(i)}" cy="${Y(p[s.campo])}" r="3" class="pt ${s.clase}"><title>${p.mes} · ${s.nombre}: ${mm(p[s.campo]).replace(/<[^>]+>/g, '')}</title></circle>`).join('')}`;
  }).join('');
  const ejes = puntos.map((p, i) => `<text x="${X(i)}" y="${H - 6}" text-anchor="middle" class="eje">${p.mes}</text>`).join('');
  const lineaCorte = corte > 0 ? `<line x1="${(X(corte - 1) + X(corte)) / 2}" x2="${(X(corte - 1) + X(corte)) / 2}" y1="${pad / 2}" y2="${H - pad}" class="corte"/><text x="${(X(corte - 1) + X(corte)) / 2 + 4}" y="${pad}" class="eje">hoy</text>` : '';
  return `<svg class="graf" viewBox="0 0 ${W} ${H}" style="height:${alto}px" role="img" aria-label="${series.map((s) => s.nombre).join(' vs ')}">${lineaCorte}${svgSeries}${ejes}</svg>
    <div class="ley">${series.map((s) => `<span><i class="l-${s.clase}"></i>${s.nombre}</span>`).join('')}<span><i class="l-punteada"></i>Tramo proyectado</span></div>`;
}
