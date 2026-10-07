// Determinación y registros (R2.1). Cuatro bloques: Determinación de la renta · Registros empresariales · Empresa y propietarios · Documentos.
// Cada registro tiene color propio (RLI morado · CPTS azul · RAI ámbar · REX teal · SAC cian). Cliente: concepto primero; Asesor: sigla primero.
// Solo presentación: todas las cifras, códigos F22 y layouts vienen de demo-data (referenciales, versionados por AT).
import { clp, esc } from '../formato.js';
const EST = { PRELIMINAR: ['Preliminar', 'lila'], SIN_DATOS: ['Sin datos', 'gris'], VALIDADO: ['Validado', 'verde'] };
const ESTLOTE = { DISPONIBLE: ['Disponible', 'verde'], PARCIAL: ['Parcial', 'ambar'], FULLY_USED: ['Utilizado', 'gris'] };
export const BLOQUES = [['det', 'Determinación de la renta'], ['reg', 'Registros empresariales'], ['prop', 'Empresa y propietarios'], ['docs', 'Documentos y exportaciones']];
const nombre = (r, modo) => modo === 'ASESOR' ? [r.id, r.nombre] : [r.concepto, r.id];
const est = (e) => { const [t, c] = EST[e] ?? ['—', 'gris']; return `<span class="estado ${c}">${t}</span>`; };

export function determinacionYRegistros(d, ctx) {
  const { modo } = ctx, blq = ctx.blq;
  const sub = `<div class="subnav blq">${BLOQUES.map(([id, n], i) => `<button class="sn ${id === blq ? 'on' : ''}" data-blq="${id}"><i>${i + 1}</i>${n}</button>`).join('')}</div>`;
  if (blq === 'prop') return sub + propietarios(d, ctx);
  if (blq === 'docs') return sub + documentos(d, modo);
  const barra = `<div class="regbar">${d.registros.map((r, i) => `${i === 1 ? '<span class="regbar-sep"></span>' : ''}<button class="rb acc-${r.id} ${r.id === ctx.regAbierto ? 'on' : ''}" data-reg="${r.id}">
      <b>${r.id}</b><small>${esc(modo === 'ASESOR' ? r.nombre : r.concepto)}</small><em>${clp(r.id === 'SAC' && modo !== 'ASESOR' ? r.disponibleHoy : r.saldoProyectado)}</em></button>`).join('')}</div>`;
  const r = d.registros.find((x) => x.id === ctx.regAbierto) ?? d.registros[0];
  const cuerpo = r.id === 'RLI' ? rli(d, r, ctx) : r.id === 'SAC' && modo !== 'ASESOR' ? sacCliente(r, ctx) : registro(r, ctx);
  return `${sub}${barra}<div class="reg-zona acc-${r.id}"><div class="reg-fijo">${r.id === 'RLI' ? '' : `<div class="franja">ESTÁS REVISANDO: <b>${r.id} · ${esc(r.concepto)}</b></div>`}${cabeza(r, ctx)}</div>${cuerpo}</div>`;
}

// Encabezado fijo (sticky) con el color del registro + Exportar / Imprimir
function cabeza(r, ctx) {
  const [t1, t2] = r.id === 'RLI' ? ['Determinación de renta', 'RLI · Renta líquida imponible'] : nombre(r, ctx.modo);
  const menu = ctx.exportar ? `<div class="exp-menu">
      <button data-doc="informe" data-docreg="${r.id}"><b>Informe MiRenta</b><small>Visual Contadoor, explicativo</small></button>
      <button data-doc="sii" data-docreg="${r.id}"><b>Formato tributario / SII</b><small>Estructura, glosas, códigos y totales del AT</small></button>
      <button disabled><b>Exportar Excel</b><small>Próximamente</small></button><button disabled><b>Vista imprimible</b><small>Próximamente</small></button></div>` : '';
  return `<div class="reg-head"><span class="reg-chip">${r.id}</span><div class="reg-tit"><b>${esc(t1)}</b><small>${esc(t2)}</small></div>${est(r.estado)}
    <div class="exp"><button class="btn sm" data-exportar>Exportar / Imprimir ▾</button>${menu}</div></div>`;
}

// ── RLI ─────────────────────────────────────────────────────────────────
function rli(d, r, ctx) {
  const x = d.rli, completa = ctx.modo === 'ASESOR' || ctx.rliCompleta;
  const c = x.resumenCliente;
  const resumen = `<div class="card"><div class="h"><h2>¿Cómo llegamos a <span>tu renta imponible?</span></h2></div><p class="explica">${esc(r.explicacion)}</p>
    <table class="cmp rli-sim"><tbody><tr><td>Ingresos considerados</td><td>${clp(c.ingresos)}</td></tr><tr><td>Egresos considerados</td><td>${clp(c.egresos)}</td></tr>
      <tr><td>Otros ajustes</td><td>${clp(c.otrosAjustes)}</td></tr><tr class="fuerte sep"><td>Base antes de beneficios</td><td>${clp(c.baseAntes)}</td></tr>
      <tr><td>Incentivo al ahorro</td><td>${c.incentivo ? clp(-c.incentivo) : '<span class="nd">No aplicado · </span><button class="link in" data-decide="c">evaluarlo en Escenarios</button>'}</td></tr>
      <tr class="fuerte sep total-rli"><td>Base imponible proyectada</td><td>${clp(c.baseImponible)}</td></tr></tbody></table>
    ${ctx.modo === 'ASESOR' ? '' : `<button class="link pad" data-rli-completa>${ctx.rliCompleta ? 'Ocultar determinación completa' : 'Ver determinación completa'} →</button>`}</div>`;
  if (!completa) return resumen;
  return (ctx.modo === 'ASESOR' ? '' : resumen) + hojaSii(x, ctx);
}

const ESTP = { OK: ['OK', 'verde'], PENDIENTE: ['Pendiente', 'gris'], REVISAR: ['Revisar', 'ambar'] };
function hojaSii(x, ctx) {
  const cod = ctx.codigos, ab = ctx.rliGrupos, cols = cod ? 5 : 4;
  const fila = (p) => { const [et, cl] = ESTP[p.estado] ?? ESTP.OK;
    return `<tr><td>${esc(p.glosa)}</td>${cod ? `<td class="cod">${p.codigo ?? '<span class="nd">por certificar</span>'}</td>` : ''}<td>${clp(p.monto)}</td><td class="ep"><span class="estado ${cl}">${et}</span></td><td class="fte">${esc(p.fuente)}</td></tr>`; };
  const cuenta = (ps) => { const n = (e) => ps.filter((p) => p.estado === e).length, pe = n('PENDIENTE'), re = n('REVISAR');
    return [pe ? `<span class="estado gris">${pe} pendiente${pe > 1 ? 's' : ''}</span>` : '', re ? `<span class="estado ambar">${re} por revisar</span>` : '', !pe && !re ? '<span class="estado verde">Todo OK</span>' : ''].join(''); };
  // grupo colapsable: la cabecera muestra nombre, estados y SUBTOTAL siempre visible
  const grupo = (id, titulo, partidas, subtotal, codSub = null) => `<tbody class="grp ${ab.includes(id) ? 'abierto' : ''}">
      <tr class="grp-h" data-grupo="${id}"><td><span class="flecha">${ab.includes(id) ? '▾' : '▸'}</span>${titulo} <small class="meta">${partidas.length} partidas</small></td>${cod ? `<td class="cod">${codSub ?? ''}</td>` : ''}<td class="sub">${clp(subtotal)}</td><td class="ep" colspan="2">${cuenta(partidas)}</td></tr>
      ${ab.includes(id) ? partidas.map(fila).join('') : ''}</tbody>`;
  const ben = x.beneficios.map((b) => ({ glosa: b.glosa, monto: b.monto ? -b.monto : null, codigo: b.codigo, fuente: b.nota, estado: 'OK', noAplica: !b.monto }));
  const filaBen = (b) => `<tr><td>${esc(b.glosa)}</td>${cod ? `<td class="cod">${b.codigo ?? ''}</td>` : ''}<td>${b.noAplica ? '<span class="nd">No aplicado</span>' : clp(b.monto)}</td><td class="ep"></td><td class="fte">${esc(b.fuente)}</td></tr>`;
  const todos = ['ing', 'egr', 'ben', 'fin'], todoAbierto = todos.every((g) => ab.includes(g));
  return `<div class="card"><div class="h"><h2>Determinación de la <span>Base Imponible</span></h2>
      <button class="btn sm" data-grupo="${todoAbierto ? 'cerrar-todo' : 'abrir-todo'}">${todoAbierto ? 'Contraer todo' : 'Expandir todo'}</button>
      <button class="btn sm" data-codigos>${cod ? 'Ocultar' : 'Mostrar'} código F22</button></div>
    <div class="layout-tag">${esc(x.layout.estado)} · ${esc(x.layout.registro_layout_version)} · Régimen ${esc(x.layout.regimen)} · AT ${x.layout.anio_tributario}</div>
    <table class="cmp hoja grupos"><thead><tr><th>Partida</th>${cod ? '<th class="cod">Código F22</th>' : ''}<th>Monto</th><th class="ep">Estado</th><th>Fuente</th></tr></thead>
      ${grupo('ing', 'Ingresos', x.ingresos, x.totalIngresos)}
      ${grupo('egr', 'Egresos', x.egresos.map((p) => ({ ...p, monto: p.monto === null ? null : (p.monto ? -p.monto : 0) })), -x.totalEgresos)}
      <tbody class="grp"><tr class="grp-h fijo"><td>Base antes de incentivo al ahorro</td>${cod ? '<td></td>' : ''}<td class="sub">${clp(x.baseAntesIncentivo)}</td><td class="ep" colspan="2"><small class="meta">Ingresos − egresos ± partidas que correspondan (${clp(x.otrasPartidas)})</small></td></tr></tbody>
      <tbody class="grp ${ab.includes('ben') ? 'abierto' : ''}"><tr class="grp-h" data-grupo="ben"><td><span class="flecha">${ab.includes('ben') ? '▾' : '▸'}</span>Beneficios <small class="meta">no son gastos ordinarios</small></td>${cod ? '<td></td>' : ''}<td class="sub">${clp(x.baseImponible - x.baseAntesIncentivo)}</td><td class="ep" colspan="2"><span class="estado gris">No aplicados en la Base</span></td></tr>
        ${ab.includes('ben') ? ben.map(filaBen).join('') : ''}</tbody>
      <tbody class="grp final"><tr class="grp-h fijo total"><td>Resultado final · Base imponible afecta a IDPC / pérdida tributaria</td>${cod ? `<td class="cod">${x.codigoBase}</td>` : ''}<td class="sub">${clp(x.baseImponible)}</td><td class="ep" colspan="2">${cuenta([...x.ingresos, ...x.egresos])}</td></tr></tbody></table>
    <p class="nota">Los subtotales siempre están visibles; abre cada grupo para ver sus partidas. "No disponible" no se asume en cero: el total es preliminar mientras haya partidas pendientes. Códigos F22 referenciales, versionados por AT.</p></div>`;
}

// ── CPTS / RAI / REX / SAC ──────────────────────────────────────────────
function registro(r, ctx) {
  const movimientos = r.incorporaciones !== undefined ? (r.incorporaciones === null ? null : r.incorporaciones + (r.imputaciones ?? 0)) : r.movimientos;
  const ficha = `<div class="card"><div class="ficha">
      <div class="f-txt"><small>Qué es</small><p>${esc(r.explicacion)}</p><small>Por qué importa</small><p>${esc(r.porQue)}</p></div>
      <div class="f-num"><div><small>Saldo inicial</small><b>${clp(r.saldoInicial)}</b></div><div><small>Movimientos del ejercicio</small><b>${clp(movimientos)}</b></div>
        <div class="fin"><small>Saldo final / proyectado</small><b>${clp(r.saldoProyectado)}</b></div><div><small>Estado</small>${est(r.estado)}</div><div><small>Última validación</small><span class="meta">${esc(r.ultimaValidacion)}</span></div></div></div>
    <button class="link pad" data-estr>${ctx.estr ? 'Ocultar' : 'Ver'} estructura tributaria →</button>${ctx.estr ? estructura(r, ctx.modo) : ''}</div>`;
  const lotes = r.id === 'SAC' ? `<div class="card"><div class="h"><h2>Lotes <span>de crédito</span></h2></div>${tablaLotes(r)}</div>` : '';
  return ficha + lotes;
}
const estructura = (r, modo) => `<table class="cmp hoja"><thead><tr><th>Glosa</th><th>Monto</th>${modo === 'ASESOR' ? '<th>Fuente</th>' : ''}</tr></thead><tbody>
  ${r.estructura.map((p, i) => `<tr class="${i === r.estructura.length - 1 ? 'fuerte sep' : ''}"><td>${esc(p.glosa)}</td><td>${clp(p.monto)}</td>${modo === 'ASESOR' ? `<td class="fte">${esc(p.fuente)}</td>` : ''}</tr>`).join('')}</tbody></table>
  <p class="nota">Estructura referencial (demo): el formato oficial por régimen y AT se certifica antes del motor.</p>`;
const tablaLotes = (r) => `<table class="cmp"><thead><tr><th>Origen</th><th>Año</th><th>Tipo</th><th>Original</th><th>Utilizado</th><th>Disponible</th><th>Estado</th></tr></thead>
  <tbody>${r.lotes.map((l) => { const [et, cl] = ESTLOTE[l.estado]; return `<tr class="${l.estado === 'FULLY_USED' ? 'usado' : ''}"><td>${esc(l.origen)}</td><td>${l.anio}</td><td>${esc(l.tipo)}</td><td>${clp(l.original)}</td><td>${clp(l.utilizado)}</td><td>${clp(l.disponible)}</td><td><span class="estado ${cl}">${et}</span></td></tr>`; }).join('')}</tbody></table>`;

function sacCliente(r, ctx) {
  return `<div class="card"><p class="explica">${esc(r.explicacion)}</p>
    <div class="sac-g"><div><small>Disponible hoy</small><b>${clp(r.disponibleHoy)}</b></div><div><small>Proyectado al cierre</small><b>${clp(r.proyectadoCierre)}</b></div></div>
    <button class="link pad" data-lotes>${ctx.lotes ? 'Ocultar lotes de crédito' : 'Ver lotes de crédito'} →</button>${ctx.lotes ? tablaLotes(r) : ''}
    <button class="link pad" data-estr>${ctx.estr ? 'Ocultar' : 'Ver'} estructura tributaria →</button>${ctx.estr ? estructura(r, ctx.modo) : ''}
    <p class="nota">Su uso depende del orden de imputación que determine el motor; no se promete su aplicación.</p></div>`;
}

// ── Empresa y propietarios + Global Complementario + consolidado ────────
function propietarios(d, ctx) {
  const { modo } = ctx, s = d.propietarios.find((x) => x.id === ctx.socio) ?? d.propietarios[0], g = s.gc;
  const tabla = `<div class="card"><div class="h"><h2>Empresa y <span>propietarios</span></h2><small>Sin datos personales en el prototipo · acceso según permisos</small></div>
    <table class="cmp"><thead><tr><th>Propietario</th><th>Participación</th><th>Retiros / distribuciones proyectados</th><th>Rentas asignadas</th><th>Créditos asociados</th><th>Tipo de crédito</th><th>Estado</th></tr></thead>
    <tbody>${d.propietarios.map((x) => `<tr class="${x.id === s.id ? 'sel-fila' : ''}"><td><b>${esc(x.nombre)}</b><br><small class="meta">${esc(x.tipo)}</small></td><td>${x.participacion} %</td><td>${clp(x.retiros)}</td><td>${clp(x.rentasAsignadas)}</td><td>${clp(x.creditos)}</td><td class="fte">${esc(x.tipoCredito)}</td><td>${est(x.estado)}</td></tr>`).join('')}</tbody></table></div>`;
  const chips = `<div class="subnav socios">${d.propietarios.map((x) => `<button class="sn ${x.id === s.id ? 'on' : ''}" data-socio="${x.id}">${esc(x.nombre)}</button>`).join('')}</div>`;
  const res = g.resultado, credDisp = -(g.creditoIdpc + g.retenciones + g.otrosCreditos + g.ppmPersonales);
  const resTxt = res.tipo === 'EXCEDENTE' ? 'Excedente estimado' : 'Saldo por pagar';
  const personal = `<div class="card"><div class="h"><h2>${modo === 'ASESOR' ? `Impuesto personal proyectado · <span>${esc(s.nombre)}</span>` : `Tu posición <span>personal estimada</span> · ${esc(s.nombre)}`}</h2><small>Global Complementario · AT 2027 · demo</small></div>
    <div class="pers-g"><div><small>Rentas consideradas</small><b>${clp(g.base)}</b></div><div><small>Impuesto estimado (IGC)</small><b>${clp(g.igcDeterminado)}</b></div>
      <div><small>Créditos disponibles</small><b>${clp(credDisp)}</b></div><div class="prot ${g.posibleDevolucion === null ? 'neutro' : 'ok'}"><small>${resTxt}</small><b>${clp(res.valor)}</b><span>Posible devolución: ${g.posibleDevolucion === null ? '<em>por determinar</em>' : clp(g.posibleDevolucion)}</span></div></div>
    <p class="nota">${esc(g.notaDevolucion)}</p>
    ${modo === 'ASESOR' || ctx.gcDet ? detallePersonal(g) : ''}
    ${modo === 'ASESOR' ? '' : `<button class="link pad" data-gc>${ctx.gcDet ? 'Ocultar determinación personal' : 'Ver determinación personal'} →</button>`}</div>`;
  return tabla + chips + personal + consolidado(d);
}
function detallePersonal(g) {
  const f = (t, v, cls = '', nota = '') => `<tr class="${cls}"><td>${t}</td><td>${typeof v === 'string' ? `<span class="meta">${esc(v)}</span>` : clp(v)}</td><td class="fte">${esc(nota)}</td></tr>`;
  return `<table class="cmp hoja"><thead><tr><th>Determinación personal</th><th>Monto</th><th>Nota</th></tr></thead><tbody>
    <tr class="grupo"><td colspan="3">Bases</td></tr>${g.rentas.map((x) => f(x.t, x.v)).join('')}${f('Base Global Complementario proyectada', g.base, 'fuerte sep')}
    <tr class="grupo"><td colspan="3">Impuesto</td></tr>${f('Tramo', g.tramo)}${f('Rebaja', g.rebaja, '', 'La aplica el motor con la tabla del AT')}${f('IGC determinado', g.igcDeterminado, 'fuerte')}
    <tr class="grupo"><td colspan="3">Créditos</td></tr>${f('Crédito IDPC', g.creditoIdpc)}${f('Restitución', g.restitucion, '', g.notaRestitucion)}${f('Retenciones', g.retenciones)}${f('PPM personales', g.ppmPersonales)}${f('Otros créditos', g.otrosCreditos)}
    ${f('Saldo final (negativo = excedente)', g.saldoFinal, 'fuerte sep total-rli')}</tbody></table>
    <div class="distingue"><span>IGC determinado <b>${clp(g.igcDeterminado)}</b></span><span>Créditos disponibles <b>${clp(-(g.creditoIdpc + g.retenciones))}</b></span>
      <span>Saldo por pagar <b>${clp(g.resultado.tipo === 'POR_PAGAR' ? g.resultado.valor : 0)}</b></span><span>Excedente estimado <b>${clp(g.resultado.tipo === 'EXCEDENTE' ? g.resultado.valor : 0)}</b></span>
      <span>Posible devolución <b>${g.posibleDevolucion === null ? '<em class="nd">por determinar</em>' : clp(g.posibleDevolucion)}</b></span></div>`;
}
function consolidado(d) {
  const c = d.consolidado, row = (t, v, cls = '') => `<div class="cl ${cls}"><span>${t}</span><b>${clp(v)}</b></div>`;
  const t = c.total, frase = t.carga === null ? 'Aún no tenemos información suficiente para estimar la carga consolidada de empresa y socios.'
    : `Considerando empresa y socios, la carga tributaria estimada es <b>${clp(t.carga)}</b>. Parte ya estaría cubierta por PPM, retenciones y créditos, por lo que la salida neta estimada sería <b>${clp(t.salidaNetaAbril)}</b>.`;
  return `<div class="card"><div class="h"><h2>Carga tributaria <span>consolidada</span></h2><small>Empresa + socios · demo</small></div>
    <p class="frase consol-frase">${frase}</p>
    <div class="consol"><div class="col"><h4>Empresa</h4>${row('IDPC proyectado', c.empresa.idpc)}${row('PPM disponibles al cierre', -c.empresa.ppm)}${row('Saldo empresa', c.empresa.saldo, 'fin')}</div>
      <div class="col"><h4>Socios</h4>${row('IGC proyectado', c.socios.igc)}${row('Créditos IDPC utilizables', c.socios.creditosIdpc)}${row('Restitución, si corresponde', c.socios.restitucion)}${row('Retenciones / otros créditos', c.socios.retenciones)}${row('Saldo personal estimado', c.socios.saldoPersonal, 'fin')}</div>
      <div class="col prot"><h4>Posición consolidada</h4>${row('Impuesto empresa', c.total.impuestoEmpresa)}${row('Impuesto personal neto del crédito IDPC', c.total.impuestoPersonalNeto)}${row('Carga tributaria total estimada', c.total.carga, 'fin')}
        ${row('Ya pagado / provisionado (PPM + retenciones)', -c.total.pagadoAnticipado)}<div class="cl"><span>Posible devolución socios</span><b><em class="nd">por determinar</em></b></div>${row('Salida neta de caja estimada (abril)', c.total.salidaNetaAbril, 'fin')}</div></div>
    <p class="nota">No es una suma simple de IDPC + IGC: el crédito IDPC se descuenta una sola vez en el socio. Las cifras las entrega el motor (aquí, demo).</p></div>`;
}

// ── Documentos y exportaciones ──────────────────────────────────────────
function documentos(d, modo) {
  return `<div class="card"><div class="h"><h2>Documentos y <span>exportaciones</span></h2><small>Botones de interfaz · no generan archivo todavía</small></div>
    <table class="cmp docs"><thead><tr><th>Registro</th>${modo === 'ASESOR' ? '<th>Layout</th><th>Régimen</th><th>AT</th><th>Fuente oficial</th>' : ''}<th>Salidas</th></tr></thead><tbody>
    ${d.layouts.map((l) => `<tr><td><span class="reg-chip mini acc-${l.registro}">${l.registro}</span> ${esc(d.registros.find((r) => r.id === l.registro).concepto)}</td>
      ${modo === 'ASESOR' ? `<td class="fte">${esc(l.registro_layout_version)}</td><td>${esc(l.regimen)}</td><td>${l.anio_tributario}</td><td class="fte">${esc(l.fuente_oficial)}</td>` : ''}
      <td class="salidas"><button class="btn sm" data-doc="informe" data-docreg="${l.registro}">Informe MiRenta</button><button class="btn sm" data-doc="sii" data-docreg="${l.registro}">Formato SII</button><button class="btn sm" disabled>Excel</button></td></tr>`).join('')}</tbody></table>
    <p class="nota">Cada formato se versiona por registro, régimen y Año Tributario (registro_layout_version · regimen · anio_tributario · fuente_oficial).</p></div>`;
}

// ── Vista de documento (overlay) ────────────────────────────────────────
export function vistaDocumento(d, tipo, regId) {
  const r = d.registros.find((x) => x.id === regId) ?? d.registros[0], l = d.layouts.find((x) => x.registro === r.id);
  const tabs = `<div class="doc-tabs"><button class="${tipo === 'informe' ? 'on' : ''}" data-doc="informe" data-docreg="${r.id}">Vista MiRenta</button><span>↔</span><button class="${tipo === 'sii' ? 'on' : ''}" data-doc="sii" data-docreg="${r.id}">Vista SII</button><button class="doc-x" data-cerrar-doc aria-label="Cerrar">✕</button></div>`;
  const pie = `<div class="doc-pie"><button disabled>Imprimir</button><button disabled>Exportar Excel</button><button disabled>PDF</button><span>Interfaz solamente: no genera archivo todavía.</span></div>`;
  if (tipo === 'informe') return `${tabs}<div class="hoja-doc informe"><div class="marca-doc">Contadoor · Informe MiRenta</div><h1>${esc(r.concepto)} <small>${r.id}</small></h1>
    <p>${esc(r.explicacion)}</p><p>${esc(r.porQue ?? '')}</p><p class="prox">Informe editorial en preparación: posición tributaria, proyección, PPM, escenarios, hallazgos, registros relevantes, comentario del asesor y supuestos.</p></div>${pie}`;
  const filas = r.id === 'RLI' ? filasRli(d.rli) : r.estructura.map((p, i) => [null, p.glosa, p.monto, i === r.estructura.length - 1 ? 'tot' : '']);
  return `${tabs}<div class="hoja-doc sii"><div class="marca-agua">DEMO · ESTRUCTURA REFERENCIAL</div>
    <div class="sii-cab"><div><b>FORMATO TÉCNICO · ${r.id === 'RLI' ? 'DETERMINACIÓN DE LA RENTA LÍQUIDA IMPONIBLE' : esc(r.nombre.toUpperCase())}</b><span>Asesorías Contadoor (demo) · AC ${d.caso.anioComercial} · AT ${d.caso.anioTributario}</span></div>
      <dl><dt>Régimen</dt><dd>${esc(l.regimen)}</dd><dt>Layout</dt><dd>${esc(l.registro_layout_version)}</dd><dt>Fuente oficial</dt><dd>${esc(l.fuente_oficial)}</dd></dl></div>
    <table><thead><tr><th>Código</th><th>Glosa</th><th>Monto ($)</th></tr></thead><tbody>
      ${filas.map(([c, t, v, cls]) => cls === 'sec' ? `<tr class="sec"><td></td><td colspan="2">${esc(t)}</td></tr>` : `<tr class="${cls}"><td>${c ?? ''}</td><td>${esc(t)}</td><td>${v === null || v === undefined ? 'N/D' : (v < 0 ? '(' + Math.abs(v).toLocaleString('es-CL') + ')' : v.toLocaleString('es-CL'))}</td></tr>`).join('')}</tbody></table>
    <p class="sii-nota">N/D = no disponible (no se asume cero). Negativos entre paréntesis. Mismo orden, glosas y códigos del formato aplicable al régimen y AT, sin imitar su diseño gráfico.</p></div>${pie}`;
}
function filasRli(x) {
  return [[null, 'INGRESOS', null, 'sec'], ...x.ingresos.map((p) => [p.codigo, p.glosa, p.monto, '']), [null, 'TOTAL INGRESOS ANUALES', x.totalIngresos, 'tot'],
    [null, 'EGRESOS', null, 'sec'], ...x.egresos.map((p) => [p.codigo, p.glosa, p.monto === null ? null : (p.monto ? -p.monto : 0), '']), [null, 'TOTAL EGRESOS ANUALES', -x.totalEgresos, 'tot'],
    [null, 'Partidas que correspondan', x.otrasPartidas, ''], [null, 'BASE ANTES DE INCENTIVO AL AHORRO', x.baseAntesIncentivo, 'tot'],
    ...x.beneficios.map((b) => [b.codigo, b.glosa, b.monto ? -b.monto : 0, '']), [x.codigoBase, 'BASE IMPONIBLE AFECTA A IDPC / PÉRDIDA TRIBUTARIA', x.baseImponible, 'tot fin']];
}
