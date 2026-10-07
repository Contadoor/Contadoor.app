// Composición de las secciones del caso (cada una responde UNA pregunta del brief).
import { clp, mm, pct, esc } from './formato.js';
import { tarjetasResumen, cobertura } from './componentes/resumen.js';
import { barrasRealProyectado, lineas } from './componentes/graficos.js';
import { puente } from './componentes/puente.js';
import { radar } from './componentes/radar.js';
import { pendientes, decisiones } from './componentes/pendientes.js';
import { calidad, avisoPreliminar, linea } from './componentes/calidad.js';
import { escenarios } from './componentes/escenarios.js';
import { registros } from './componentes/registros.js';

const card = (titulo, cuerpo, extra = '') => `<div class="card"><div class="h"><h2>${titulo}</h2>${extra}</div>${cuerpo}</div>`;

export const SECCIONES = [
  { id: 'resumen', nombre: 'Resumen', pregunta: '¿Cuánto impuesto proyecto, cuánto tengo cubierto y qué debo revisar?' },
  { id: 'proyeccion', nombre: 'Proyección', pregunta: '¿Hacia dónde va mi renta y qué la mueve?' },
  { id: 'ppm', nombre: 'PPM', pregunta: '¿Cuánto tengo pagado y me alcanza?' },
  { id: 'escenarios', nombre: 'Escenarios', pregunta: '¿Qué pasa si tomo una decisión?' },
  { id: 'registros', nombre: 'Registros', pregunta: '¿Cómo se determina mi RLI y qué saldos tributarios estoy acumulando?' },
  { id: 'propietarios', nombre: 'Propietarios', pregunta: 'Empresa y propietarios (próximamente)' },
  { id: 'radar', nombre: 'Radar', pregunta: '¿Qué necesita mi atención?' },
  { id: 'fuentes', nombre: 'Datos y fuentes', pregunta: '¿Qué tan completa es la información?' },
  { id: 'contabilidad', nombre: 'Contabilidad', pregunta: 'Estructura interna', asesor: true },
  { id: 'conciliaciones', nombre: 'Conciliaciones', pregunta: 'Estructura interna', asesor: true },
  { id: 'tecnica', nombre: 'Revisión técnica', pregunta: 'Estructura interna', asesor: true },
];

export function render(id, d, ctx) {
  const { modo } = ctx;
  switch (id) {
    case 'resumen': return `${avisoPreliminar(d)}${tarjetasResumen(d, modo)}
      <div class="g2">${cobertura(d)}${card('Si el año terminara <span>así…</span>', `${barrasRealProyectado(d.proyeccion.meses, 'resultado')}
          <div class="mini3"><div><span>Acumulado real</span><b>${mm(d.proyeccion.actualAcumulado)}</b></div><div><span>Meses restantes</span><b>${mm(d.proyeccion.mesesRestantes)}</b></div><div><span>Resultado anual</span><b>${mm(d.proyeccion.anualProyectado)}</b></div></div>`, '<small>Resultado contable mes a mes</small>')}</div>
      <div class="g2">${card('PPM <span>vs impuesto</span>', lineas(d.ppm.curva, [{ campo: 'impuestoProyectado', nombre: 'Impuesto proyectado', clase: 'imp' }, { campo: 'ppmAcumulado', nombre: 'PPM acumulado', clase: 'ppm' }]))}
        ${card('¿Qué está <span>pasando?</span>', radar(d.radar, { limite: 3, modo }), '<button class="link" data-ir="radar">Ver radar →</button>')}</div>
      <div class="g2">${card('¿Qué debemos <span>revisar?</span>', pendientes(d.pendientes, modo))}${card('Calidad de la <span>información</span>', calidad(d.calidad), '<button class="link" data-ir="fuentes">Ver fuentes →</button>')}</div>
      ${card('Dónde estamos en el <span>año</span>', linea(d))}`;

    case 'proyeccion': return `${avisoPreliminar(d)}
      <div class="g2">${card('Si el año terminara <span>así…</span>', barrasRealProyectado(d.proyeccion.meses, 'resultado', 220), '<small>Real y proyectado, sin mezclar</small>')}
        ${card('Evolución de la <span>renta proyectada</span>', lineas(d.proyeccion.evolucion.concat(d.proyeccion.evolucion.length ? [{ mes: 'DIC', tipo: 'PROYECTADO', impuestoProyectado: d.proyeccion.impuestoCierre }] : []),
          [{ campo: 'impuestoProyectado', nombre: 'Impuesto proyectado en cada mes', clase: 'imp' }], 220), '<small>Cómo fue cambiando la proyección</small>')}</div>
      <div class="g2">${card('Componentes de la <span>renta</span>', puente(d, modo), `<small>${modo === 'ASESOR' ? 'Vista asesor: pasos expandidos' : 'Vista simple'}</small>`)}
        ${card('¿Qué está moviendo el <span>resultado?</span>', `<ul class="motores">${d.proyeccion.motores.map((m) => `<li><span class="m-ef">${m.efecto}</span><div><b>${esc(m.nombre)}</b><small>${esc(m.detalle)}</small></div></li>`).join('')}</ul>`)}</div>`;

    case 'ppm': { const p = d.ppm;
      return `${avisoPreliminar(d)}<div class="ppm4">
        <div class="kpi"><small>Hoy · PPM pagado acumulado</small><b>${clp(p.pagado)}</b></div>
        <div class="kpi"><small>Proyección · PPM a diciembre</small><b>${clp(p.proyectadoDiciembre)}</b></div>
        <div class="kpi"><small>Impuesto proyectado</small><b>${clp(p.impuestoProyectado)}</b></div>
        <div class="kpi k-saldo"><small>Déficit estimado al cierre</small><b>${clp(p.deficitEstimado)}</b><p>Si sigues pagando PPM como hasta ahora (cobertura al cierre ${pct(p.coberturaCierre)}).</p></div></div>
        <div class="g2">${card('Curva PPM <span>vs impuesto</span>', lineas(p.curva, [{ campo: 'impuestoProyectado', nombre: 'Impuesto proyectado', clase: 'imp' }, { campo: 'ppmAcumulado', nombre: 'PPM acumulado / proyectado', clase: 'ppm' }], 230))}
          ${card('Reserva <span>sugerida</span>', `<div class="cob-fila"><span>Saldo esperado por pagar</span><b>${clp(d.reserva.saldoEsperado)}</b></div><div class="cob-fila"><span>Reserva acumulada</span><b>${clp(d.reserva.reservaAcumulada)}</b></div>
            <div class="cob-fila fuerte"><span>Reserva adicional sugerida</span><b>${clp(d.reserva.reservaAdicional)}</b></div>
            <p class="nota">Si la proyección se mantiene, esta sería la diferencia que convendría mantener disponible para el pago de renta.${d.reserva.formulaDisponible ? '' : ' <em>(Cálculo pendiente del motor; cifra demo.)</em>'}</p>`)}</div>
        ${modo === 'ASESOR' ? card('Detalle de <span>PPM</span>', `<table class="cmp"><tr><td>PPM determinado</td><td>${clp(p.determinado)}</td></tr><tr><td>PPM declarado</td><td>${clp(p.declarado)}</td></tr><tr><td>PPM pagado</td><td>${clp(p.pagado)}</td></tr><tr class="fuerte"><td>PPM disponible para la renta</td><td>${clp(p.disponible)}</td></tr></table><p class="nota">Fuente futura: F29 por período (no integrado).</p>`) : ''}`; }

    case 'escenarios': return escenarios(d, ctx.escSel);
    case 'registros': return `<div class="regimen"><b>Tu régimen · ${esc(d.caso.regimen.nombre)} (${esc(d.caso.regimen.articulo)})</b><span>Registros que se muestran para este régimen. Otros regímenes tendrán su propia vista.</span></div>${registros(d, ctx.regAbierto, modo)}`;
    case 'propietarios': return card('Empresa y <span>propietarios</span>', `<div class="futuro"><p>Sección futura: socios, retiros acumulados, cuenta particular, distribuciones, créditos asociados y situaciones pendientes.</p><p>Datos sensibles separados por permisos. Sin datos personales en este prototipo.</p></div>`);
    case 'radar': return card('Radar <span>MiRenta</span>', radar(d.radar, { modo }), '<small>Riesgo · oportunidad · cambio · desviación · inconsistencia · decisión</small>') + card('Decisiones para <span>revisar</span>', decisiones(d.decisiones));
    case 'fuentes': return card('Calidad de la <span>información</span>', calidad(d.calidad), '<small>Qué tan completa es la proyección</small>') +
      card('Histórico', `<table class="cmp"><thead><tr><th>Año</th><th>Resultado</th><th>Impuesto</th><th>PPM</th><th>Saldo</th><th>Tasa efectiva</th></tr></thead><tbody>${d.historico.map((h) => `<tr><td>${h.anio}${h.proyectado ? ' (proy.)' : ''}</td><td>${clp(h.resultado)}</td><td>${clp(h.impuesto)}</td><td>${clp(h.ppm)}</td><td>${clp(h.saldo)}</td><td>${pct(h.tasaEfectiva)}</td></tr>`).join('')}</tbody></table>`);
    default: return card(esc(SECCIONES.find((s) => s.id === id)?.nombre ?? id), `<div class="futuro"><p>Vista interna del equipo Contadoor (estructura ya construida: fuentes con huella, conciliaciones, clasificación de cuentas, bitácora).</p>
      <ul class="tec"><li>${esc(d.tecnico.snapshot)}</li><li>${esc(d.tecnico.conciliaciones)}</li><li>${esc(d.tecnico.completitud)}</li><li>Incidencias: ${d.tecnico.incidencias.map(esc).join(' · ')}</li></ul></div>`);
  }
}
