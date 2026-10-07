// Cabecera compacta (R2): una línea principal + estado. El régimen es clickeable (abre "Tu régimen tributario").
import { esc } from '../formato.js';
import { ETIQUETA_ESTADO } from '../demo-data.js';
const CLASE = { COMPLETO: 'verde', PRELIMINAR: 'lila', FALTAN_DATOS: 'ambar', RIESGO: 'rojo', SIN_INFORMACION: 'gris' };
export function cabecera(d) {
  const c = d.caso;
  return `<div class="cab-caso">
    <div class="cab-l1">
      <select class="sel sel-emp" aria-label="Empresa">${c.empresas.map((e) => `<option ${e === c.empresa ? 'selected' : ''}>${esc(e)}</option>`).join('')}</select>
      <select class="sel" aria-label="Año">${c.aniosComerciales.map((a) => `<option ${a === c.anioComercial ? 'selected' : ''}>AC ${a} · AT ${a + 1}</option>`).join('')}</select>
      <button class="regimen-btn" data-regimen>${esc(c.regimen.nombre)} · ${esc(c.regimen.articulo.replace('Art. ', ''))} <span>ⓘ</span></button>
    </div>
    <div class="cab-l2"><span class="estado ${CLASE[c.estadoAnalisis]}">● ${ETIQUETA_ESTADO[c.estadoAnalisis]}</span><span>${esc(c.corte.replace('Contabilidad al', 'datos al'))} · actualizado ${esc(c.ultimaActualizacion)}</span></div>
  </div>`;
}
