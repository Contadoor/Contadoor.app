// Completitud ("¿Qué tan completa es esta proyección?"), aviso corto de estado y línea del año compacta.
import { esc, ESTADO_DATO } from '../formato.js';
export function calidad(items, modo) {
  return `<ul class="calidad">${items.map((c) => { const [ic, cl] = ESTADO_DATO[c.estado];
    return `<li><span class="q-ic ${cl}">${ic}</span><b>${esc(c.fuente)}</b><em class="q-est ${cl}">${esc(c.cliente ?? '')}</em>${modo === 'ASESOR' ? `<small>${esc(c.detalle)}</small>` : ''}</li>`; }).join('')}</ul>`;
}
export function avisoPreliminar(d, modo) {
  const e = d.caso.estadoAnalisis;
  if (e === 'COMPLETO') return '';
  const t = { PRELIMINAR: ['Proyección preliminar', 'Falta conciliar la apertura y completar algunos antecedentes tributarios.', 'Ver qué falta'],
    FALTAN_DATOS: ['Faltan datos', 'Sin los PPM del año algunas cifras aparecen como "No disponible".', modo === 'ASESOR' ? 'Completar fuente' : 'Ver información faltante'],
    RIESGO: ['Atención', 'La cobertura de PPM es baja: podría existir un saldo relevante en abril.', 'Ver qué revisar'],
    SIN_INFORMACION: ['Sin información', 'Aún no hay contabilidad cargada para este año.', modo === 'ASESOR' ? 'Completar fuente' : 'Ver información faltante'] }[e];
  return `<div class="aviso ${e === 'RIESGO' ? 'rojo' : e === 'SIN_INFORMACION' ? 'gris' : 'ambar'}"><b>${t[0]}</b><span>${t[1]}</span><button class="link" data-ir="fuentes">${t[2]} →</button></div>`;
}
export function linea(d) {
  return `<div class="tl-mini">${d.timeline.map((t) => `<div class="tlm ${t.tipo.toLowerCase()}"><b>${esc(t.etapa)}</b><span>${esc(t.tipo === 'REAL' ? 'real' : t.tipo === 'PROYECTADO' ? 'proyectado' : t.texto)}</span></div>`).join('')}</div>`;
}
