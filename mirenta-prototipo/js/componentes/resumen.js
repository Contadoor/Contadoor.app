// TaxProjectionSummary + PpmCoverage · las 4 cifras principales y la cobertura de renta.
import { clp, pct, ND } from '../formato.js';
const porQue = (id) => `<button class="porque" data-traza="${id}" aria-label="¿Por qué?">¿Por qué?</button>`;

export function tarjetasResumen(d, modo) {
  const r = d.resumen, excedente = r.saldo.tipo === 'EXCEDENTE';
  return `<div class="kpis">
    <div class="kpi"><small>Base tributaria proyectada</small><b>${clp(r.baseTributaria.valor)}</b><p>${r.baseTributaria.nota ?? 'Sin información suficiente.'}</p>${porQue('base')}</div>
    <div class="kpi"><small>Impuesto proyectado (IDPC)</small><b>${clp(r.impuesto.valor)}</b>
      <p>Tasa aplicable estimada <strong>${r.impuesto.tasaAplicable === null ? ND : pct(r.impuesto.tasaAplicable)}</strong>${modo === 'ASESOR' ? ' · informada por el motor versionado' : ''}</p>${porQue('impuesto')}</div>
    <div class="kpi"><small>PPM disponibles</small><b>${clp(r.ppmDisponible.valor)}</b><p>${r.ppmDisponible.nota ?? 'Pagos provisionales reconocidos.'}</p>${porQue('ppm')}</div>
    <div class="kpi ${excedente ? 'k-verde' : 'k-saldo'}"><small>${excedente ? 'Posible excedente' : 'Saldo estimado por pagar'}</small><b>${clp(r.saldo.valor)}</b>
      <p>${excedente ? 'Excedente proyectado sujeto a validación de créditos, declaraciones y situación tributaria final.' : 'Diferencia entre el impuesto proyectado y los PPM disponibles.'}</p>${porQue('saldo')}</div>
  </div>`;
}

export function cobertura(d) {
  const r = d.resumen, p = r.cobertura.porcentaje;
  if (p === null) return `<div class="card cobertura"><div class="h"><h2>Cobertura de <span>renta</span></h2></div>
    <p class="cob-msg">La cobertura <strong>no está disponible</strong>: faltan los PPM del año. No se asume que sean cero.</p></div>`;
  const clase = p >= 90 ? 'verde' : p >= 50 ? 'ambar' : 'rojo';
  return `<div class="card cobertura"><div class="h"><h2>Cobertura de <span>renta</span></h2><small>¿Me alcanza con lo que llevo pagado?</small></div>
    <div class="cob-fila"><span>Impuesto proyectado</span><b>${clp(r.impuesto.valor)}</b></div>
    <div class="cob-fila"><span>PPM disponibles</span><b>${clp(r.ppmDisponible.valor)}</b></div>
    <div class="barra ${clase}" role="progressbar" aria-valuenow="${p}" aria-valuemin="0" aria-valuemax="100"><i style="width:${Math.min(p, 100)}%"></i><em>${pct(p)}</em></div>
    <p class="cob-msg">Tus PPM cubren actualmente <strong>${pct(p)}</strong> del impuesto proyectado.${r.cobertura.faltante ? ` Faltaría cubrir <strong>${clp(r.cobertura.faltante)}</strong>.` : ''}</p></div>`;
}
