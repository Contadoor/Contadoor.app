// MiRentaCaseHeader · empresa, AC/AT, régimen, estado del análisis, última actualización, selectores.
import { esc } from '../formato.js';
import { ETIQUETA_ESTADO } from '../demo-data.js';
const CLASE = { COMPLETO: 'verde', PRELIMINAR: 'lila', FALTAN_DATOS: 'ambar', RIESGO: 'rojo', SIN_INFORMACION: 'gris' };
export function cabecera(d) {
  const c = d.caso;
  return `<div class="cab-caso">
    <div class="cab-izq">
      <select class="sel" aria-label="Empresa">${c.empresas.map((e) => `<option ${e === c.empresa ? 'selected' : ''}>${esc(e)}</option>`).join('')}</select>
      <div class="cab-datos"><b>Año Comercial ${c.anioComercial}</b><span>Año Tributario ${c.anioTributario}</span><span>${esc(c.regimen.nombre)} · ${esc(c.regimen.articulo)}</span></div>
    </div>
    <div class="cab-der">
      <select class="sel" aria-label="Año Comercial">${c.aniosComerciales.map((a) => `<option ${a === c.anioComercial ? 'selected' : ''}>AC ${a}</option>`).join('')}</select>
      <span class="estado ${CLASE[c.estadoAnalisis]}">● ${ETIQUETA_ESTADO[c.estadoAnalisis]}</span>
      <span class="actualizado">${esc(c.corte)} · actualizado ${esc(c.ultimaActualizacion)}</span>
    </div></div>`;
}
