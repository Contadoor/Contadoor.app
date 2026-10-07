// Posición tributaria (R2): frase humana → saldo protagonista → impuesto / PPM / cobertura → cubierto → hoy vs diciembre → caja.
// Solo presenta cifras ya calculadas (demo/backend). Las frases son plantillas de texto, no cálculos.
import { clp, mm, pct, ND } from '../formato.js';
const porQue = (id) => `<button class="porque" data-traza="${id}">¿Por qué?</button>`;
const disp = (v) => v !== null && v !== undefined;

export function frase(d) {
  const r = d.resumen;
  if (!disp(r.impuesto.valor)) return 'Todavía no hay información suficiente para proyectar el impuesto de este año.';
  if (!disp(r.cobertura.porcentaje)) return `Con la información disponible hoy, proyectamos un impuesto anual de ${clp(r.impuesto.valor)}. Aún no tenemos los PPM del año, así que no podemos estimar cuánto está cubierto.`;
  if (r.cobertura.porcentaje >= 100) return `Con la información disponible hoy, proyectamos un impuesto anual de ${clp(r.impuesto.valor)}, que tus PPM disponibles cubrirían por completo.`;
  return `Con la información disponible hoy, proyectamos un impuesto anual de <b>${clp(r.impuesto.valor)}</b>. Tus PPM disponibles cubrirían aproximadamente un <b>${pct(r.cobertura.porcentaje)}</b>, por lo que quedarían cerca de <b>${clp(r.cobertura.faltante)}</b> por cubrir si la situación se mantiene.`;
}

export function posicion(d) {
  const r = d.resumen, exced = r.saldo.tipo === 'EXCEDENTE', p = r.cobertura.porcentaje;
  const cl = !disp(p) ? 'gris' : p >= 90 ? 'verde' : p >= 50 ? 'ambar' : 'rojo';
  return `<section class="posicion">
    <h2 class="titulo-sec">Tu posición <span>tributaria</span></h2>
    <p class="frase">${frase(d)}</p>
    <div class="pos-g">
      <div class="saldo ${exced ? 'exced' : ''} ${cl === 'rojo' ? 'riesgo' : ''}">
        <small>${exced ? 'Posible excedente' : 'Saldo estimado por pagar'}</small>
        <b>${clp(r.saldo.valor)}</b>
        <p>${exced ? 'Excedente proyectado sujeto a validación de créditos, declaraciones y situación tributaria final.' : 'Diferencia estimada entre impuesto proyectado, PPM y créditos disponibles.'}</p>${porQue('saldo')}
      </div>
      <div class="mini-kpis">
        <div class="mk"><small>Impuesto proyectado</small><b>${clp(r.impuesto.valor)}</b><span>Impuesto de la empresa · tasa estimada ${r.impuesto.tasaAplicable === null ? ND : pct(r.impuesto.tasaAplicable)}</span>${porQue('impuesto')}</div>
        <div class="mk"><small>PPM disponibles</small><b>${clp(r.ppmDisponible.valor)}</b><span>Pagos provisionales reconocidos</span>${porQue('ppm')}</div>
        <div class="mk"><small>Cobertura</small><b class="c-${cl}">${disp(p) ? pct(p) : ND}</b><span>del impuesto ya cubierto</span></div>
      </div>
    </div></section>`;
}

export function cubierto(d) {
  const r = d.resumen, p = r.cobertura.porcentaje;
  if (!disp(p)) return `<div class="card"><div class="h"><h2>¿Cuánto de tu impuesto <span>ya está cubierto?</span></h2></div>
    <p class="cob-msg">Todavía <strong>no está disponible</strong>: faltan los PPM del año. No se asume que sean cero.</p><button class="link pad" data-ir="fuentes">Ver información faltante →</button></div>`;
  const cl = p >= 90 ? 'verde' : p >= 50 ? 'ambar' : 'rojo';
  return `<div class="card"><div class="h"><h2>¿Cuánto de tu impuesto <span>ya está cubierto?</span></h2></div>
    <div class="cob-fila"><span>Impuesto proyectado</span><b>${clp(r.impuesto.valor)}</b></div>
    <div class="cob-fila"><span>PPM disponibles</span><b>${clp(r.ppmDisponible.valor)}</b></div>
    <div class="barra ${cl}"><i style="width:${Math.min(p, 100)}%"></i><em>${pct(p)} cubierto</em></div>
    <p class="cob-msg">Tus PPM disponibles cubren actualmente un <strong>${pct(p)}</strong> del impuesto proyectado.${r.cobertura.faltante ? ` Faltaría cubrir aproximadamente <strong>${clp(r.cobertura.faltante)}</strong>.` : ''}</p>
    <p class="tecnico-chico">Cobertura mediante PPM disponibles</p></div>`;
}

export function hoyDiciembre(d) {
  return `<div class="card"><div class="h"><h2>Hoy <span>vs diciembre</span></h2><small>Lo que sabemos hoy y hacia dónde vamos</small></div>
    <table class="hvd"><thead><tr><th></th><th>Hoy</th><th>Diciembre (proyectado)</th></tr></thead><tbody>
    ${d.hoyVsDiciembre.map((f) => `<tr class="${f.concepto === 'Saldo' ? 'fuerte' : ''}"><td>${f.concepto}</td><td>${mm(f.hoy)}</td><td>${mm(f.diciembre)}</td></tr>`).join('')}</tbody></table></div>`;
}

export function caja(d, compacta = true) {
  const c = d.caja;
  return `<div class="card"><div class="h"><h2>Planificación <span>${compacta ? 'de caja' : 'para el pago'}</span></h2>${compacta ? '<button class="link" data-proy="caja">Ver PPM y planificación →</button>' : ''}</div>
    <div class="cob-fila"><span>Saldo tributario proyectado</span><b>${clp(c.saldoProyectado)}</b></div>
    <div class="cob-fila"><span>Reserva considerada</span><b>${clp(c.reservaConsiderada)}</b></div>
    <div class="cob-fila fuerte"><span>Diferencia por cubrir</span><b>${clp(c.diferencia)}</b></div>
    <p class="nota">Si la proyección se mantiene, esta sería la diferencia que convendría mantener disponible.</p></div>`;
}
