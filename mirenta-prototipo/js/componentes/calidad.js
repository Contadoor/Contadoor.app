// DataQuality · "Calidad de la información" (qué tan completa es la proyección).
import { esc, ESTADO_DATO } from '../formato.js';
export function calidad(items) {
  return `<ul class="calidad">${items.map((c) => { const [ic, cl] = ESTADO_DATO[c.estado];
    return `<li><span class="q-ic ${cl}">${ic}</span><b>${esc(c.fuente)}</b><small>${esc(c.detalle)}</small></li>`; }).join('')}</ul>`;
}
export function avisoPreliminar(d) {
  const e = d.caso.estadoAnalisis;
  if (e === 'COMPLETO') return '';
  const txt = { PRELIMINAR: 'Esta estimación todavía no incorpora el saldo inicial conciliado ni todos los antecedentes tributarios.',
    FALTAN_DATOS: 'Faltan datos críticos (PPM del año): algunas cifras se muestran como "No disponible".',
    RIESGO: 'La cobertura de PPM es baja: podría existir un saldo relevante en abril.',
    SIN_INFORMACION: 'Aún no hay contabilidad cargada para este año: no es posible proyectar.' }[e];
  return `<div class="aviso ${e === 'RIESGO' ? 'rojo' : e === 'SIN_INFORMACION' ? 'gris' : 'ambar'}"><b>${e === 'RIESGO' ? 'Atención' : 'Proyección preliminar'}</b> · ${txt}</div>`;
}
export function linea(d) {
  return `<div class="timeline">${d.timeline.map((t) => `<div class="tl ${t.tipo.toLowerCase()}"><b>${esc(t.etapa)}</b><span>${esc(t.texto)}</span></div>`).join('')}</div>`;
}
