// Composición de secciones (R2). Cliente: 5 secciones. Asesor: las mismas + "⚙ Revisión técnica" (capa operativa aparte).
import { clp, mm, pct, esc } from './formato.js';
import { posicion, cubierto, hoyDiciembre, caja } from './componentes/resumen.js';
import { barrasRealProyectado, lineas } from './componentes/graficos.js';
import { puente } from './componentes/puente.js';
import { radar } from './componentes/radar.js';
import { pendientes, decisiones } from './componentes/pendientes.js';
import { calidad, avisoPreliminar, linea } from './componentes/calidad.js';
import { escenarios } from './componentes/escenarios.js';
import { determinacionYRegistros } from './componentes/registros.js';

const card = (titulo, cuerpo, extra = '', cls = '') => `<div class="card ${cls}"><div class="h"><h2>${titulo}</h2>${extra}</div>${cuerpo}</div>`;

export const SECCIONES = [
  { id: 'resumen', nombre: 'Resumen', pregunta: '¿Cuánto proyecto, cuánto tengo cubierto, cuánto falta y qué revisamos?' },
  { id: 'proyeccion', nombre: 'Proyección', pregunta: '¿Hacia dónde va mi renta y qué la mueve?' },
  { id: 'escenarios', nombre: 'Escenarios', pregunta: '¿Qué pasa si tomo una decisión?' },
  { id: 'registros', nombre: 'Determinación y registros', pregunta: '¿Cómo se determina mi renta y qué saldos tributarios acumulo?' },
  { id: 'radar', nombre: 'Radar', pregunta: '¿Qué necesita mi atención?' },
  { id: 'tecnica', nombre: 'Revisión técnica', pregunta: 'Capa operativa del equipo Contadoor', asesor: true },
];
export const OCULTAS = { fuentes: { nombre: '¿Qué tan completa es esta proyección?', pregunta: 'Información disponible y pendiente' } };
const SUB_PROY = [['renta', 'Renta'], ['ppm', 'PPM y cobertura'], ['caja', 'Caja y reserva']];
const SUB_TEC = ['Contabilidad', 'Conciliaciones', 'Account Mapping', 'Fuentes', 'Incidencias', 'Reglas', 'Bitácora'];
const subnav = (items, act, attr) => `<div class="subnav">${items.map(([id, n]) => `<button class="sn ${id === act ? 'on' : ''}" ${attr}="${id}">${n}</button>`).join('')}</div>`;

export function render(id, d, ctx) {
  const { modo } = ctx;
  switch (id) {
    case 'resumen': return `${avisoPreliminar(d, modo)}${posicion(d)}
      <div class="g2">${cubierto(d)}${hoyDiciembre(d)}</div>
      <div class="g2">${caja(d)}${card('3 cosas que <span>necesitan tu atención</span>', radar(d.radar, { limite: 3, modo }), '<button class="link" data-ir="radar">Ver Radar completo →</button>', 'atencion')}</div>
      <div class="g2">${card('¿Qué debemos <span>revisar?</span>', pendientes(d.pendientes, modo))}${card('¿Qué tan completa es <span>esta proyección?</span>', calidad(d.calidad, modo), '<button class="link" data-ir="fuentes">Ver detalle →</button>')}</div>
      ${linea(d)}`;

    case 'proyeccion': {
      const sub = ctx.subProy;
      if (sub === 'ppm') { const p = d.ppm;
        return `${subnav(SUB_PROY, sub, 'data-proy')}<section><h2 class="titulo-sec">¿Tus PPM van <span>al ritmo correcto?</span></h2>
          <p class="frase">${p.pagado === null ? 'Aún no tenemos los PPM del año para responder esta pregunta.' : `Al ritmo actual, proyectamos <b>${clp(p.proyectadoDiciembre)}</b> de PPM al cierre frente a un impuesto estimado de <b>${clp(p.impuestoProyectado)}</b>. ${p.deficitEstimado > 0 ? `Quedaría una diferencia aproximada de <b>${clp(p.deficitEstimado)}</b>.` : 'Los PPM proyectados cubrirían el impuesto estimado.'}`}</p></section>
          <div class="ppm4"><div class="mk"><small>Hoy pagado</small><b>${mm(p.pagado)}</b></div><div class="mk"><small>Si sigues a este ritmo</small><b>${mm(p.proyectadoDiciembre)}</b></div>
            <div class="mk"><small>Impuesto proyectado</small><b>${mm(p.impuestoProyectado)}</b></div><div class="mk prot"><small>Diferencia al cierre</small><b>${mm(p.deficitEstimado)}</b></div></div>
          ${card('PPM <span>vs impuesto</span>', lineas(p.curva, [{ campo: 'impuestoProyectado', nombre: 'Impuesto proyectado', clase: 'imp' }, { campo: 'ppmAcumulado', nombre: 'PPM acumulado / proyectado', clase: 'ppm' }], 190))}
          ${modo === 'ASESOR' ? card('Detalle de <span>PPM</span>', `<table class="cmp"><tr><td>PPM determinado</td><td>${clp(p.determinado)}</td></tr><tr><td>PPM declarado</td><td>${clp(p.declarado)}</td></tr><tr><td>PPM pagado</td><td>${clp(p.pagado)}</td></tr><tr class="fuerte"><td>PPM efectivamente disponible</td><td>${clp(p.disponible)}</td></tr></table>`) : ''}`; }
      if (sub === 'caja') return `${subnav(SUB_PROY, sub, 'data-proy')}${caja(d, false)}${card('¿Cuánto de tu impuesto <span>ya está cubierto?</span>', `<p class="nota">${d.resumen.cobertura.porcentaje === null ? 'No disponible.' : `Tus PPM disponibles cubren ${pct(d.resumen.cobertura.porcentaje)} del impuesto proyectado.`}</p>`)}`;
      return `${subnav(SUB_PROY, 'renta', 'data-proy')}
        <div class="g2">${card('Si el año terminara <span>así…</span>', barrasRealProyectado(d.proyeccion.meses, 'resultado', 160), '<small>Resultado contable · real y proyectado</small>')}
          ${card('Evolución de la <span>proyección</span>', lineas(d.proyeccion.evolucion.concat(d.proyeccion.evolucion.length ? [{ mes: 'DIC', tipo: 'PROYECTADO', impuestoProyectado: d.proyeccion.impuestoCierre }] : []), [{ campo: 'impuestoProyectado', nombre: 'Impuesto proyectado en cada mes', clase: 'imp' }], 170), '<small>Cómo fue cambiando</small>')}</div>
        <div class="g2">${card('¿Qué está moviendo <span>el resultado?</span>', `<ol class="ranking">${d.proyeccion.motores.map((m, i) => `<li><span class="rk">${i + 1}</span><span class="m-ef">${m.efecto}</span><div><b>${esc(m.nombre)}</b><small>${esc(m.detalle)}</small></div><em class="${m.impacto > 0 ? 'mejor' : m.impacto < 0 ? 'peor' : 'cero'}">${m.impacto === null ? 'Sin cambio relevante' : 'Impacto estimado ' + (m.impacto > 0 ? '+' : '') + clp(m.impacto)}</em></li>`).join('')}</ol>`, '', 'destacada')}
          ${card('Cómo se determina <span>el impuesto</span>', puente(d, modo), `<small>${modo === 'ASESOR' ? 'Detalle, fuentes y reglas' : 'Versión simple'}</small>`)}</div>`; }

    case 'escenarios': return escenarios(d, ctx.escSel, modo, ctx.detalleEsc);
    case 'registros': return determinacionYRegistros(d, ctx.regAbierto, modo, ctx.lotes);
    case 'radar': return card('Radar <span>MiRenta</span>', radar(d.radar, { modo }), '<small>Hallazgo · por qué importa · decisión a revisar</small>') + card('Decisiones <span>para revisar</span>', decisiones(d.decisiones));
    case 'fuentes': return card('¿Qué tan completa es <span>esta proyección?</span>', calidad(d.calidad, modo)) + (modo === 'ASESOR'
      ? card('Histórico', `<table class="cmp"><thead><tr><th>Año</th><th>Resultado</th><th>Impuesto</th><th>PPM</th><th>Saldo</th><th>Tasa efectiva</th></tr></thead><tbody>${d.historico.map((h) => `<tr><td>${h.anio}${h.proyectado ? ' (proy.)' : ''}</td><td>${clp(h.resultado)}</td><td>${clp(h.impuesto)}</td><td>${clp(h.ppm)}</td><td>${clp(h.saldo)}</td><td>${pct(h.tasaEfectiva)}</td></tr>`).join('')}</tbody></table>`) : '');
    case 'tecnica': return `${subnav(SUB_TEC.map((t) => [t, t]), ctx.subTec, 'data-tec')}${card(esc(ctx.subTec), `<div class="futuro"><p>Herramienta de trabajo del asesor (estructura ya construida: fuentes con huella, conciliaciones, clasificación de cuentas, reglas y bitácora). No es parte de la vista del cliente.</p>
      <ul class="tec"><li>${esc(d.tecnico.snapshot)}</li><li>${esc(d.tecnico.conciliaciones)}</li><li>${esc(d.tecnico.completitud)}</li><li>Incidencias: ${d.tecnico.incidencias.map(esc).join(' · ')}</li></ul></div>`)}`;
    default: return '';
  }
}
