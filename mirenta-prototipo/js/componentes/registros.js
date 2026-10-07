// TaxRegisters · tarjetas por registro (adaptables por régimen) + detalle e historia. SAC con lotes (nunca se borra un lote usado).
import { clp, esc } from '../formato.js';
const EST = { PRELIMINAR: 'lila', SIN_DATOS: 'gris', VALIDADO: 'verde' };
const ESTLOTE = { DISPONIBLE: 'verde', PARCIAL: 'ambar', FULLY_USED: 'gris' };

export function registros(d, abierto, modo) {
  const tarjetas = d.registros.map((r) => `<button class="reg-card ${abierto === r.id ? 'on' : ''}" data-reg="${r.id}">
      <div class="reg-top"><b>${r.id}</b><span class="estado ${EST[r.estado] ?? 'gris'}">${r.estado === 'SIN_DATOS' ? 'Sin datos' : r.estado === 'PRELIMINAR' ? 'Preliminar' : r.estado}</span></div>
      <small>${esc(r.nombre)}</small>
      ${r.tipo === 'DETERMINACION'
        ? `<div class="reg-n"><span>Resultado contable</span><em>${clp(r.resultadoContable)}</em></div><div class="reg-n"><span>Ajustes netos</span><em>${clp(r.ajustesNetos)}</em></div>
           <div class="reg-n fuerte"><span>RLI proyectada</span><em>${clp(r.saldoProyectado)}</em></div>`
        : `<div class="reg-n"><span>Saldo inicial</span><em>${clp(r.saldoInicial)}</em></div>
      <div class="reg-n"><span>Movimientos</span><em>${clp(r.movimientos ?? r.incorporaciones)}</em></div>
      <div class="reg-n fuerte"><span>Saldo proyectado</span><em>${clp(r.saldoProyectado)}</em></div>`}
      <div class="reg-val">Última validación: ${esc(r.ultimaValidacion)}</div></button>`).join('');
  const r = d.registros.find((x) => x.id === abierto) ?? d.registros[0];
  if (r.tipo === 'DETERMINACION') return `<div class="reg-grid">${tarjetas}</div>${determinacion(r, modo)}`;
  const filas = r.incorporaciones !== undefined
    ? [['Saldo inicial', r.saldoInicial], ['Incorporaciones', r.incorporaciones], ['Imputaciones', r.imputaciones], ['Saldo final / proyectado', r.saldoProyectado]]
    : [['Saldo inicial', r.saldoInicial], ['Movimientos del ejercicio', r.movimientos], ['Saldo proyectado', r.saldoProyectado]];
  const lotes = r.lotes ? `<h3 class="sub">Lotes de crédito</h3><table class="cmp"><thead><tr><th>Origen</th><th>Año</th><th>Tipo crédito</th><th>Monto original</th><th>Utilizado</th><th>Disponible</th><th>Estado</th></tr></thead>
    <tbody>${r.lotes.map((l) => `<tr class="${l.estado === 'FULLY_USED' ? 'usado' : ''}"><td>${esc(l.origen)}</td><td>${l.anio}</td><td>${esc(l.tipo)}</td><td>${clp(l.original)}</td><td>${clp(l.utilizado)}</td><td>${clp(l.disponible)}</td>
      <td><span class="estado ${ESTLOTE[l.estado]}">${l.estado === 'FULLY_USED' ? 'Utilizado' : l.estado === 'PARCIAL' ? 'Parcial' : 'Disponible'}</span></td></tr>`).join('')}</tbody></table>` : '';
  const hist = r.historia.length ? `<h3 class="sub">Historia</h3><div class="hist">${r.historia.map((h) => `<div><span>${h.anio}</span><b>${clp(h.saldo)}</b></div>`).join('')}</div>` : '';
  return `<div class="reg-grid">${tarjetas}</div>
    <div class="card"><div class="h"><h2>${r.id} · <span>${esc(r.nombre)}</span></h2><button class="btn sm imprimir" data-imprimir>🖨 Imprimir</button></div>
      <p class="explica">${esc(r.explicacion)}</p>
      <table class="cmp"><tbody>${filas.map(([t, v], i) => `<tr class="${i === filas.length - 1 ? 'fuerte' : ''}"><td>${t}</td><td>${clp(v)}</td></tr>`).join('')}</tbody></table>
      ${lotes}${hist}
      ${modo === 'ASESOR' ? '<p class="nota">Detalle técnico: saldos iniciales desde F22/DJ AT 2026 (pendiente de integrar). Reglas de cada registro: backend versionado.</p>' : ''}</div>`;
}

// Determinación de la RLI: hoja de partidas (resultado + agregados − deducciones = RLI). Montos ya calculados por el backend (demo).
function determinacion(r, modo) {
  const g = (k) => r.partidas.filter((p) => p.grupo === k);
  const fila = (p) => `<tr><td>${esc(p.concepto)}</td><td>${clp(p.monto)}</td>${modo === 'ASESOR' ? `<td class="fte">${esc(p.fuente)}</td>` : ''}</tr>`;
  const cols = modo === 'ASESOR' ? 3 : 2;
  const titulo = (t) => `<tr class="grupo"><td colspan="${cols}">${t}</td></tr>`;
  return `<div class="card"><div class="h"><h2>RLI · <span>${esc(r.nombre)}</span></h2><button class="btn sm imprimir" data-imprimir>🖨 Imprimir</button></div>
    <p class="explica">${esc(r.explicacion)}</p>
    <table class="cmp rli"><thead><tr><th>Partida</th><th>Monto</th>${modo === 'ASESOR' ? '<th>Fuente</th>' : ''}</tr></thead><tbody>
      ${g('RESULTADO').map(fila).join('')}${titulo('Más: agregados')}${g('AGREGADOS').map(fila).join('')}${titulo('Menos: deducciones')}${g('DEDUCCIONES').map(fila).join('')}
      <tr class="fuerte total-rli"><td>Renta líquida imponible proyectada</td><td>${clp(r.saldoProyectado)}</td>${modo === 'ASESOR' ? '<td></td>' : ''}</tr></tbody></table>
    <p class="nota">Las partidas y su tratamiento por régimen los define y valida el asesor; los montos vendrán del motor versionado. Una partida "No disponible" no se asume en cero.</p>
    <h3 class="sub">Historia</h3><div class="hist">${r.historia.map((h) => `<div><span>${h.anio}</span><b>${clp(h.saldo)}</b></div>`).join('')}</div></div>`;
}
