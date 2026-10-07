// Determinación y registros (R2). Separados: DETERMINACIÓN (RLI) ≠ REGISTROS EMPRESARIALES (CPTS/RAI/REX/SAC).
// Cliente: concepto primero, sigla después. Asesor: sigla primero. SAC en cliente = "Créditos disponibles" con lotes expandibles.
import { clp, esc } from '../formato.js';
const EST = { PRELIMINAR: ['Preliminar', 'lila'], SIN_DATOS: ['Sin datos', 'gris'], VALIDADO: ['Validado', 'verde'] };
const ESTLOTE = { DISPONIBLE: ['Disponible', 'verde'], PARCIAL: ['Parcial', 'ambar'], FULLY_USED: ['Utilizado', 'gris'] };
const nombre = (r, modo) => modo === 'ASESOR' ? [r.id, r.nombre] : [r.concepto, r.id];

export function determinacionYRegistros(d, abierto, modo, lotesAbiertos) {
  const rli = d.registros.find((r) => r.tipo === 'DETERMINACION'), regs = d.registros.filter((r) => r.tipo !== 'DETERMINACION');
  const [t1, t2] = nombre(rli, modo);
  const det = `<section><h2 class="titulo-sec">Determinación</h2>
    <button class="reg-card rli ${abierto === rli.id ? 'on' : ''}" data-reg="${rli.id}"><div><b>${esc(t1)}</b><small>${esc(t2)}${modo === 'ASESOR' ? '' : ' · Renta líquida imponible'}</small></div>
      <div class="rli-n"><span>Resultado contable</span><em>${clp(rli.resultadoContable)}</em></div><div class="rli-n"><span>Ajustes netos</span><em>${clp(rli.ajustesNetos)}</em></div>
      <div class="rli-n fuerte"><span>Renta imponible proyectada</span><em>${clp(rli.saldoProyectado)}</em></div></button></section>`;
  const tarjetas = `<section><h2 class="titulo-sec">Registros <span>empresariales</span></h2><div class="reg-grid">${regs.map((r) => { const [a, b] = nombre(r, modo), [et, cl] = EST[r.estado] ?? ['—', 'gris'];
    const valor = r.id === 'SAC' && modo !== 'ASESOR' ? r.disponibleHoy : r.saldoProyectado;
    return `<button class="reg-card ${abierto === r.id ? 'on' : ''}" data-reg="${r.id}"><div class="reg-top"><b>${esc(a)}</b><span class="estado ${cl}">${et}</span></div><small>${esc(b)}</small>
      <div class="reg-n fuerte"><span>${r.id === 'SAC' && modo !== 'ASESOR' ? 'Disponible hoy' : 'Saldo proyectado'}</span><em>${clp(valor)}</em></div></button>`; }).join('')}</div></section>`;
  const r = d.registros.find((x) => x.id === abierto) ?? rli;
  const detalle = r.tipo === 'DETERMINACION' ? hojaRli(r, modo) : r.id === 'SAC' ? sac(r, modo, lotesAbiertos) : registro(r, modo);
  const prop = `<div class="card futuro-card"><div class="h"><h2>Empresa y <span>propietarios</span></h2><small>Próximamente</small></div><p class="nota">Retiros, cuenta particular, distribuciones y créditos asociados por propietario, con permisos separados. Sin datos personales en el prototipo.</p></div>`;
  return `${det}${tarjetas}${detalle}${prop}`;
}

function hojaRli(r, modo) {
  const g = (k) => r.partidas.filter((p) => p.grupo === k), cols = modo === 'ASESOR' ? 3 : 2;
  const fila = (p) => `<tr><td>${esc(p.concepto)}</td><td>${clp(p.monto)}</td>${modo === 'ASESOR' ? `<td class="fte">${esc(p.fuente)}</td>` : ''}</tr>`;
  const tit = (t) => `<tr class="grupo"><td colspan="${cols}">${t}</td></tr>`;
  const [t1, t2] = nombre(r, modo);
  return `<div class="card"><div class="h"><h2>${esc(t1)}</h2><small>${esc(t2)}</small></div><p class="explica">${esc(r.explicacion)}</p>
    <table class="cmp rli"><thead><tr><th>Partida</th><th>Monto</th>${modo === 'ASESOR' ? '<th>Fuente</th>' : ''}</tr></thead><tbody>
    ${g('RESULTADO').map(fila).join('')}${tit('Más: ajustes (agregados)')}${g('AGREGADOS').map(fila).join('')}${tit('Menos: deducciones')}${g('DEDUCCIONES').map(fila).join('')}
    <tr class="fuerte total-rli"><td>Renta imponible proyectada</td><td>${clp(r.saldoProyectado)}</td>${modo === 'ASESOR' ? '<td></td>' : ''}</tr></tbody></table>
    <p class="nota">Las partidas por régimen las define y valida el asesor. Una partida "No disponible" no se asume en cero.</p></div>`;
}

function registro(r, modo) {
  const [t1, t2] = nombre(r, modo);
  const filas = r.incorporaciones !== undefined ? [['Saldo inicial', r.saldoInicial], ['Incorporaciones', r.incorporaciones], ['Imputaciones', r.imputaciones], ['Saldo final / proyectado', r.saldoProyectado]]
    : [['Saldo inicial', r.saldoInicial], ['Movimientos del ejercicio', r.movimientos], ['Saldo proyectado', r.saldoProyectado]];
  return `<div class="card"><div class="h"><h2>${esc(t1)}</h2><small>${esc(t2)}</small></div><p class="explica">${esc(r.explicacion)}</p>
    <table class="cmp"><tbody>${filas.map(([t, v], i) => `<tr class="${i === filas.length - 1 ? 'fuerte' : ''}"><td>${t}</td><td>${clp(v)}</td></tr>`).join('')}</tbody></table>
    ${r.historia.length ? `<div class="hist">${r.historia.map((h) => `<div><span>${h.anio}</span><b>${clp(h.saldo)}</b></div>`).join('')}</div>` : ''}</div>`;
}

function sac(r, modo, lotesAbiertos) {
  const lotes = `<table class="cmp"><thead><tr><th>Origen</th><th>Año</th><th>Tipo</th><th>Original</th><th>Utilizado</th><th>Disponible</th><th>Estado</th></tr></thead>
    <tbody>${r.lotes.map((l) => { const [et, cl] = ESTLOTE[l.estado]; return `<tr class="${l.estado === 'FULLY_USED' ? 'usado' : ''}"><td>${esc(l.origen)}</td><td>${l.anio}</td><td>${esc(l.tipo)}</td><td>${clp(l.original)}</td><td>${clp(l.utilizado)}</td><td>${clp(l.disponible)}</td><td><span class="estado ${cl}">${et}</span></td></tr>`; }).join('')}</tbody></table>`;
  if (modo === 'ASESOR') return `<div class="card"><div class="h"><h2>SAC</h2><small>${esc(r.nombre)}</small></div>
    <table class="cmp"><tbody><tr><td>Saldo inicial</td><td>${clp(r.saldoInicial)}</td></tr><tr><td>Movimientos del ejercicio</td><td>${clp(r.movimientos)}</td></tr><tr class="fuerte"><td>Saldo proyectado</td><td>${clp(r.saldoProyectado)}</td></tr></tbody></table>
    <h3 class="sub">Lotes de crédito</h3>${lotes}</div>`;
  return `<div class="card"><div class="h"><h2>Créditos <span>disponibles</span></h2><small>SAC</small></div><p class="explica">${esc(r.explicacion)}</p>
    <div class="sac-g"><div><small>Disponible hoy</small><b>${clp(r.disponibleHoy)}</b></div><div><small>Proyectado al cierre</small><b>${clp(r.proyectadoCierre)}</b></div></div>
    <button class="link pad" data-lotes>${lotesAbiertos ? 'Ocultar lotes de crédito' : 'Ver lotes de crédito'} →</button>${lotesAbiertos ? lotes : ''}
    <p class="nota">Su uso depende del orden de imputación que determine el motor; no se promete su aplicación.</p></div>`;
}
