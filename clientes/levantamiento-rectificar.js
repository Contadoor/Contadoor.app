/* ============================================================
   clientes/levantamiento-rectificar.js — ESCENARIO «SI RECTIFICAMOS TODO» del Levantamiento de IVA (25-11-2026).
   · Se abre desde levantamiento-iva.js (botón «Si rectificamos todo», tras Calcular). Todo el cálculo está en el servidor:
       public.sii_levantamiento_rectificar_todo → cadena del remanente mes a mes (504/77/89 declarado vs corregido), categoría
       por mes, orden de rectificación, totales (impuesto, reajuste, intereses, multa), IVA pagado de más, traspaso del
       remanente y F29 posteriores al rango afectados («fuera del rango»). Deja bitácora (sin RUT ni montos).
   · «Otros cargos / multa adicional»: lo ingresa el analista (monto + motivo obligatorio) en el Levantamiento; se suma al
     total del escenario y del levantamiento, rotulado «ingresado a mano». NO se guarda en la base (solo vista y exportes).
   · Colores: gris sin cambio · ámbar solo remanente (sin pago) · rojo IVA a pagar · verde pagó de más.
   · Datos externos SIEMPRE con textContent; el PDF se arma con texto escapado. Al cliente: «nuestros servicios».
   Uso: GestoorLevRect.abrir(ctx) · escenario(ctx) · paginaPdf(esc, cliente, logo, otros) · hojaExcel(wb, esc, ctx, img)
   ============================================================ */
(function (raiz) {
  'use strict';
  var doc = raiz.document;
  var MORADO = '#924893';
  var CAT = {
    sin_cambio: { t: 'Sin cambio', c: 'gris' },
    solo_remanente: { t: 'Solo cambia el remanente (sin pago)', c: 'amb' },
    solo_codigos: { t: 'Corrige códigos (sin pago)', c: 'amb' },
    declarar_sin_pago: { t: 'Declarar F29 original (sin pago)', c: 'amb' },
    iva_a_pagar: { t: 'Aparece IVA a pagar', c: 'roj' },
    pago_de_mas: { t: 'Baja el IVA pagado: pagó de más', c: 'ver' },
    no_calculable: { t: 'No calculable: revisar a mano', c: 'gris' },
    en_plazo: { t: 'En plazo', c: 'gris' }
  };
  var MOTIVO = {
    sin_rcv: 'sin compras y ventas del SII', sin_detalle: 'sin detalle por documento', f29_sin_montos: 'F29 sin montos',
    sin_f29_fuera_de_rango: 'sin F29 declarado'
  };
  var EXPLICACION = [
    'Este escenario muestra qué pasa si rectificamos TODOS los meses del rango, uno tras otro.',
    'Cada F29 traspasa su remanente de crédito (cód. 77) al mes siguiente como cód. 504, reajustado por UTM. Si un mes baja su remanente, el mes siguiente parte con menos crédito y puede aparecer IVA a pagar aunque ese mes estuviera bien declarado.',
    'Por eso se rectifica en orden, del mes más antiguo al más reciente, y también los F29 ya declarados después del rango si el remanente corregido los alcanza (marcados «fuera del rango»: ahí solo se aplica el efecto del remanente).',
    'Un mes que «pagó de más» no rebaja lo que hay que pagar: es una posible devolución o imputación aparte, solo informativa.'
  ];
  var NOMBRE_MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  function el(tag, cls, txt) { var e = doc.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function num(v) { return v == null || v === '' || isNaN(Number(v)) ? null : Number(v); }
  function pesos(v) { var n = num(v); return n == null ? '—' : (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString('es-CL'); }
  function conSigno(v) { var n = num(v); return n == null ? '—' : (n > 0 ? '+' : '') + pesos(n); }
  function mesTxt(p) { p = String(p || ''); return p.length === 6 ? NOMBRE_MES[Number(p.slice(4)) - 1] + ' ' + p.slice(0, 4) : p; }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function lista(ps) { return (ps || []).map(mesTxt).join(', '); }
  function cat(m) { return CAT[m.categoria] || CAT.no_calculable; }
  function catTxt(m) { var c = cat(m); return m.categoria === 'no_calculable' && MOTIVO[m.estado] ? c.t + ' (' + MOTIVO[m.estado] + ')' : c.t; }
  function errorTxt(ctx, e) { return ctx && ctx.mensajeError ? ctx.mensajeError(e) : 'No pudimos calcular ahora. Intenta de nuevo.'; }
  function noInstalado(e) { return !!e && (e.codigo === 'PGRST202' || e.codigo === '42883' || e.status === 404); }

  // ── Cálculos de presentación (sumas de lo que entrega el servidor; nunca se inventa un total) ──
  /** Cargos del mes: reajuste + intereses + multa (null si falta alguno). */
  function cargos(e) { if (!e) return null; if (e.reajuste == null || e.intereses == null || e.multa == null) return null; return Number(e.reajuste) + Number(e.intereses) + Number(e.multa); }
  /** Total del escenario + otros cargos ingresados a mano. */
  function totalEscenario(esc, otros) {
    var T = ((esc && esc.totales) || {}).todo || {}, m = otros && num(otros.monto) > 0 ? Number(otros.monto) : 0;
    var base = num(T.total);
    return {
      base: base, otros: m, total: base == null ? null : base + m, provisional: !!T.total_provisional,
      texto: base == null ? 'No calculable' + (m ? ' + ' + pesos(m) + ' ingresado a mano' : '') : pesos(base + m) + (T.total_provisional ? ' (provisional)' : '')
    };
  }
  /** Frase del traspaso del remanente (último F29 del rango). */
  function fraseTraspaso(esc) {
    var t = (esc && esc.traspaso) || {};
    if (!t.calculable) return 'No se puede calcular el remanente corregido de ' + mesTxt(t.periodo) + ' (mes sin datos suficientes): revisar a mano.';
    var d = num(t.diferencia) || 0;
    if (Math.abs(d) <= 100) return 'Al rectificar, el remanente que hoy arrastra el cliente (cód. 77 de ' + mesTxt(t.periodo) + ') no cambia: ' + pesos(t.declarado) + '.';
    return 'Al rectificar, el remanente que hoy arrastra el cliente (cód. 77 de ' + mesTxt(t.periodo) + ') pasa de ' + pesos(t.declarado) + ' a ' + pesos(t.corregido) + ' (' + conSigno(d) + ').';
  }
  /** Advertencia sobre los F29 posteriores al rango. */
  function fraseFuera(esc) {
    var f = (esc && esc.fuera_de_rango) || {}, t = (esc && esc.traspaso) || {}, d = num(t.diferencia) || 0;
    var cual = d < 0 ? 'Ese menor remanente' : 'Ese mayor remanente', af = f.afectados || [];
    var l = af.length ? cual + ' afecta los F29 ya declarados después del rango: ' + lista(af) + '. También deben rectificarse (se calcularon abajo, marcados «fuera del rango»).' : '';
    switch (f.estado) {
      case 'sin_f29_posteriores': return Math.abs(d) > 100 ? 'No hay F29 declarados después de ' + mesTxt(esc.hasta) + ': el próximo F29 que se presente debe usar el remanente corregido (' + pesos(t.corregido) + ', reajustado).' : '';
      case 'sin_efecto': return 'El cambio del remanente no alcanza a los F29 declarados después del rango.';
      case 'se_agota_antes': return (l ? l + ' ' : '') + 'El efecto se agota en ' + mesTxt(f.llega_hasta) + ': desde ahí los F29 declarados no cambian.';
      case 'afecta_hasta_ultimo_f29': return (l ? l + ' ' : '') + 'El efecto llega hasta el último F29 declarado (' + mesTxt(f.ultimo_f29_declarado) + '): el próximo F29 debe usar el remanente corregido' + (f.remanente_al_final ? ' (' + pesos(f.remanente_al_final.corregido) + ' en vez de ' + pesos(f.remanente_al_final.declarado) + ')' : '') + '.';
      case 'cadena_cortada': return (l ? l + ' ' : '') + 'La cadena se corta en ' + lista(esc.cadena_cortada_en) + ' (falta el F29 o sus montos): revisar a mano desde ese mes.';
      case 'truncado_36_meses': return (l ? l + ' ' : '') + 'El efecto sigue más allá de 36 meses después del rango: amplía el rango para verlo completo.';
      case 'no_calculable': return 'No se puede saber si afecta los F29 posteriores: el último mes del rango no se pudo calcular.';
      default: return '';
    }
  }
  function nF29(esc) { var T = ((esc && esc.totales) || {}).todo || {}; return { rect: Number(T.f29_a_rectificar || 0), decl: Number(T.f29_a_declarar || 0) }; }
  function textoF29(esc) { var n = nF29(esc); return n.rect + (n.rect === 1 ? ' F29 a rectificar' : ' F29 a rectificar') + (n.decl ? ' + ' + n.decl + (n.decl === 1 ? ' F29 original a declarar' : ' F29 originales a declarar') : ''); }

  // ── Datos ──
  var cache = typeof WeakMap === 'function' ? new WeakMap() : null;
  /** Escenario del rango COMPLETO del último cálculo (una llamada por cálculo). */
  function escenario(ctx) {
    var k = ctx.datos, c = cache && k ? cache.get(k) : null;
    if (c) return c;
    var p = ctx.rpc('sii_levantamiento_rectificar_todo', { p_cliente_id: Number(ctx.cliente.id), p_desde: ctx.desde, p_hasta: ctx.hasta, p_opciones: ctx.opciones || {} });
    if (cache && k) { cache.set(k, p); p.catch(function () { cache.delete(k); }); }
    return p;
  }
  /** Para los exportes: el escenario o null si la RPC aún no está instalada (cualquier otro error se propaga: fail-closed). */
  function escenarioOpcional(ctx) {
    return escenario(ctx).catch(function (e) { if (noInstalado(e)) return null; throw e; });
  }

  // ── Estilos ──
  function estilos() {
    if (raiz.GestoorLevIVA && raiz.GestoorLevIVA.estilos) raiz.GestoorLevIVA.estilos();
    if (doc.getElementById('livr-css')) return;
    var s = el('style'); s.id = 'livr-css';
    s.textContent = [
      '.livr-velo{position:fixed;inset:0;z-index:445;background:rgba(12,7,14,.8);display:flex;align-items:flex-start;justify-content:center;padding:16px;overflow:auto}',
      '.livr-caja{width:1180px;max-width:100%;background:#1E1222;color:#F2EAF4;border:1px solid #3A2140;border-radius:18px;padding:18px 20px;box-shadow:0 30px 80px rgba(0,0,0,.6)}',
      '.livr-cab{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.livr-cab h3{margin:0;flex:1;min-width:220px;font:800 17px var(--g-titulo,Montserrat,sans-serif)}.livr-cab h3 span{color:#E39BE5;font-weight:700;font-size:13px;display:block;margin-top:2px}',
      '.livr-exp{margin-top:12px;font-size:12.5px;line-height:1.55;color:#E9DCEB;background:rgba(146,72,147,.14);border:1px solid #4A2B50;border-radius:12px;padding:10px 14px}.livr-exp p{margin:0 0 4px}',
      '.livr-res{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin-top:14px}',
      '.livr-k{border-radius:14px;padding:10px 14px;border:1.5px solid #3A2140;background:rgba(12,7,14,.35)}.livr-k .l{font-size:10.5px;letter-spacing:.5px;text-transform:uppercase;color:#C9A8CC}',
      '.livr-k .v{font:800 20px var(--g-titulo,Montserrat,sans-serif);margin-top:3px;font-variant-numeric:tabular-nums}.livr-k small{display:block;color:#C9A8CC;font-size:11.5px;margin-top:3px;line-height:1.4}',
      '.livr-k.mor{border-color:#924893;background:linear-gradient(160deg,rgba(146,72,147,.3),rgba(30,18,34,.6))}.livr-k.roj .v{color:#FF8A7A}.livr-k.amb .v{color:#FFC85A}.livr-k.ver .v{color:#46D69A}',
      '.livr-frase{margin-top:12px;font-size:13px;line-height:1.5;padding:9px 13px;border-radius:12px;border:1px solid rgba(255,200,90,.45);color:#FFE2A6;background:rgba(255,200,90,.06)}.livr-frase b{color:#fff}',
      '.livr-tl{display:flex;gap:4px;flex-wrap:wrap;margin-top:14px}.livr-m{min-width:62px;padding:5px 7px;border-radius:9px;font-size:10.5px;font-weight:700;text-align:center;border:1.5px solid transparent;line-height:1.3}',
      '.livr-m.gris{background:rgba(201,168,204,.12);color:#C9A8CC}.livr-m.amb{background:rgba(255,200,90,.16);color:#FFC85A}.livr-m.roj{background:rgba(255,138,122,.18);color:#FF8A7A}.livr-m.ver{background:rgba(70,214,154,.16);color:#46D69A}',
      '.livr-m.fuera{border-style:dashed;border-color:currentColor}.livr-m b{display:block;font-size:12px}',
      '.livr-ley{display:flex;gap:14px;flex-wrap:wrap;margin-top:8px;font-size:11.5px;color:#C9A8CC}.livr-ley span::before{content:"";display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px;vertical-align:-1px;background:currentColor}',
      '.livr-ley .gris{color:#9a849b}.livr-ley .amb{color:#FFC85A}.livr-ley .roj{color:#FF8A7A}.livr-ley .ver{color:#46D69A}',
      '.livr-t tr.fuera td{background:repeating-linear-gradient(135deg,rgba(255,255,255,.02) 0 6px,transparent 6px 12px)}.livr-t td.ped{color:#FFC85A;font-size:11px}',
      '.livr-t td:nth-child(3),.livr-t thead tr:first-child th:nth-child(3){text-align:left}.livr-t td:first-child{text-align:center}.livr-t tfoot td{text-align:right}.livr-t tfoot td:first-child{text-align:left}',
      '.livr-t th.grp{text-align:center}.livr-nota{margin-top:8px;font-size:11.5px;color:#C9A8CC;line-height:1.5}.livr-nota.amb{color:#FFC85A}',
      '.liva-otros{margin-top:12px;display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;padding:10px 12px;border:1px dashed #6B4672;border-radius:12px}',
      '.liva-otros label{display:flex;flex-direction:column;gap:4px;font-size:11px;color:#C9A8CC}.liva-otros input{min-height:36px;border-radius:10px;border:1px solid #4A2B50;background:#140B17;color:#F3E9F4;padding:0 10px;font:inherit;font-size:13px}',
      '.liva-otros .t{flex-basis:100%;font-size:12px;font-weight:700;color:#E9DCEB}.liva-otros .t small{font-weight:400;color:#C9A8CC}.liva-otros .act{font-size:12.5px;color:#FFC85A;flex-basis:100%}'
    ].join('\n');
    doc.head.appendChild(s);
  }

  // ── Panel ──
  var panel = null;
  function cerrar() { if (panel) panel.remove(); panel = null; doc.removeEventListener('keydown', alEsc, true); }
  function alEsc(ev) { if (ev.key === 'Escape' && panel) { ev.stopPropagation(); cerrar(); } }

  function abrir(ctx) {
    cerrar(); estilos();
    var velo = el('div', 'livr-velo'); velo.id = 'livr-velo'; velo.setAttribute('role', 'dialog'); velo.setAttribute('aria-modal', 'true'); velo.setAttribute('aria-label', 'Si rectificamos todo');
    var caja = el('div', 'livr-caja'); velo.appendChild(caja);
    var cab = el('div', 'livr-cab'), h = el('h3', null, 'Si rectificamos todo · ' + mesTxt(ctx.desde) + ' a ' + mesTxt(ctx.hasta));
    h.appendChild(el('span', null, (ctx.cliente.razon || 'Cliente') + (ctx.cliente.rut ? ' · ' + ctx.cliente.rut : ''))); cab.appendChild(h);
    var LD = raiz.GestoorLevDetalle, bPdf = null, bXls = null;
    if (LD) {
      bPdf = el('button', 'liva-btn sec', 'Borradores F29 (PDF)'); bPdf.type = 'button'; bPdf.id = 'livr-pdf'; bPdf.disabled = true; cab.appendChild(bPdf);
      bXls = el('button', 'liva-btn sec', 'Exportar Excel'); bXls.type = 'button'; bXls.id = 'livr-excel'; bXls.disabled = true; cab.appendChild(bXls);
    }
    var x = el('button', 'liva-x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Cerrar'); x.addEventListener('click', cerrar); cab.appendChild(x);
    caja.appendChild(cab);
    var msg = el('div', 'liva-msg', 'Calculando el escenario: se encadena el remanente mes a mes…'); msg.id = 'livr-msg'; caja.appendChild(msg);
    var cuerpo = el('div'); cuerpo.id = 'livr-cuerpo'; caja.appendChild(cuerpo);
    velo.addEventListener('click', function (ev) { if (ev.target === velo) cerrar(); });
    doc.addEventListener('keydown', alEsc, true);
    doc.body.appendChild(velo); panel = velo;
    function aviso(t, c) { msg.className = 'liva-msg' + (c ? ' ' + c : ''); msg.textContent = t; }

    escenario(ctx).then(function (esc) {
      if (panel !== velo) return;
      h.firstChild.nodeValue = 'Si rectificamos todo · ' + mesTxt(esc.desde) + ' a ' + mesTxt(esc.hasta);   // rango que calculó el servidor
      pintar(cuerpo, esc, ctx);
      var T = totalEscenario(esc, ctx.otros);
      aviso(textoF29(esc) + ' · total estimado a pagar ' + T.texto + '. ' + (esc.aviso || ''), num(T.total) > 0 || T.total == null ? 'roj' : 'ver');
      if (bPdf) {
        bPdf.disabled = false; bXls.disabled = false;
        bPdf.addEventListener('click', function () { LD.borradorTodos(ctx, { boton: bPdf, aviso: aviso }); });
        bXls.addEventListener('click', function () { LD.exportarExcel(ctx, { boton: bXls, aviso: aviso }); });
      }
    }).catch(function (e) {
      if (panel !== velo) return;
      aviso(noInstalado(e) ? 'El escenario «Si rectificamos todo» aún no está instalado en el servidor.' : errorTxt(ctx, e), 'roj');
    });
  }

  function dato(g, etq, v, cls, sub) { var b = el('div', 'livr-k' + (cls ? ' ' + cls : '')); b.appendChild(el('div', 'l', etq)); b.appendChild(el('div', 'v', v)); if (sub) b.appendChild(el('small', null, sub)); g.appendChild(b); return b; }

  function pintar(cont, esc, ctx) {
    cont.textContent = '';
    var ex = el('div', 'livr-exp'); ex.id = 'livr-explicacion'; EXPLICACION.forEach(function (p) { ex.appendChild(el('p', null, p)); }); cont.appendChild(ex);
    var T = totalEscenario(esc, ctx.otros), To = ((esc.totales || {}).todo) || {}, tr = esc.traspaso || {}, n = nF29(esc);
    var g = el('div', 'livr-res'); g.id = 'livr-resumen';
    dato(g, 'F29 a rectificar', String(n.rect + n.decl), n.rect + n.decl ? 'amb' : 'ver',
      (n.decl ? n.rect + ' rectificatorias + ' + n.decl + ' originales fuera de plazo' : 'rectificatorias') + (esc.primer_mes_con_diferencia ? ' · desde ' + mesTxt(esc.primer_mes_con_diferencia) : ''));
    dato(g, 'Total estimado a pagar', T.texto, 'mor ' + (T.total == null || T.total > 0 ? 'roj' : 'ver'),
      'Impuesto ' + pesos(To.impuesto) + ' + reajuste ' + pesos(To.reajuste) + ' + intereses ' + pesos(To.intereses) + ' + multa ' + pesos(To.multa) +
      (T.otros ? ' + otros cargos ' + pesos(T.otros) + ' (ingresado a mano' + (ctx.otros && ctx.otros.motivo ? ': ' + ctx.otros.motivo : '') + ')' : ''));
    dato(g, 'Remanente hoy → corregido', tr.calculable ? pesos(tr.declarado) + ' → ' + pesos(tr.corregido) : 'No calculable', tr.calculable && num(tr.diferencia) < -100 ? 'amb' : null,
      tr.calculable ? 'Cód. 77 de ' + mesTxt(tr.periodo) + ' · ' + conSigno(tr.diferencia) : 'Revisar a mano');
    if (num(To.iva_pagado_de_mas) > 0) dato(g, 'IVA pagado de más', pesos(To.iva_pagado_de_mas), 'ver', 'Informativo: posible devolución o imputación aparte (no se descuenta)');
    cont.appendChild(g);
    var fr = el('div', 'livr-frase'); fr.id = 'livr-traspaso'; fr.textContent = fraseTraspaso(esc); cont.appendChild(fr);
    var ff = fraseFuera(esc); if (ff) { var fe = el('div', 'livr-frase'); fe.id = 'livr-fuera'; fe.textContent = ff; cont.appendChild(fe); }

    // Línea de tiempo (un cuadro por mes)
    var tl = el('div', 'livr-tl'); tl.id = 'livr-linea';
    (esc.meses || []).forEach(function (m) {
      var c = cat(m), b = el('div', 'livr-m ' + c.c + (m.en_rango ? '' : ' fuera')); b.setAttribute('data-periodo', m.periodo); b.setAttribute('data-categoria', m.categoria);
      b.title = mesTxt(m.periodo) + ': ' + catTxt(m) + (m.en_rango ? '' : ' · fuera del rango');
      b.appendChild(el('b', null, mesTxt(m.periodo))); b.appendChild(doc.createTextNode(m.orden ? 'Paso ' + m.orden : m.categoria === 'no_calculable' ? 'Revisar' : m.categoria === 'en_plazo' ? 'En plazo' : 'Sin cambio'));
      tl.appendChild(b);
    });
    cont.appendChild(tl);
    var ley = el('div', 'livr-ley');
    [['gris', 'Sin cambio'], ['amb', 'Solo cambia el remanente (sin pago)'], ['roj', 'Aparece IVA a pagar'], ['ver', 'Pagó de más'], ['gris', 'Borde punteado: fuera del rango']].forEach(function (x) { ley.appendChild(el('span', x[0], x[1])); });
    cont.appendChild(ley);

    // Tabla mes a mes
    var tw = el('div', 'liva-tw'), t = el('table', 'liva-t livr-t'); t.id = 'livr-tabla';
    var th = el('thead'), h1 = el('tr'), h2 = el('tr');
    [['Paso', 2], ['Mes', 2], ['Qué pasa al rectificar', 2]].forEach(function (x) { var c = el('th', null, x[0]); c.rowSpan = x[1]; h1.appendChild(c); });
    ['Cód. 504 remanente anterior', 'Cód. 77 remanente siguiente', 'Cód. 89 IVA determinado'].forEach(function (x) { var c = el('th', 'grp', x); c.colSpan = 2; h1.appendChild(c); });
    [['A pagar', 2], ['Cargos', 2], ['Total', 2]].forEach(function (x) { var c = el('th', null, x[0]); c.rowSpan = x[1]; h1.appendChild(c); });
    ['Declarado', 'Corregido', 'Declarado', 'Corregido', 'Declarado', 'Corregido'].forEach(function (x) { h2.appendChild(el('th', null, x)); });
    th.appendChild(h1); th.appendChild(h2); t.appendChild(th);
    var tb = el('tbody');
    (esc.meses || []).forEach(function (m) {
      var c = cat(m), f = el('tr', 'fila ' + c.c + (m.en_rango ? '' : ' fuera')); f.setAttribute('data-periodo', m.periodo); f.setAttribute('data-categoria', m.categoria);
      f.appendChild(el('td', null, m.orden ? String(m.orden) : '—'));
      var c0 = el('td', null, mesTxt(m.periodo)); if (!m.en_rango) c0.appendChild(el('span', 'liva-chip cond', 'Fuera del rango')); f.appendChild(c0);
      var c1 = el('td'); c1.appendChild(el('span', 'liva-chip ' + c.c, catTxt(m)));
      if (m.accion === 'declarar_original') c1.appendChild(el('span', 'liva-chip cond', 'F29 original'));
      f.appendChild(c1);
      [m.c504, m.c77, m.c89].forEach(function (p) { p = p || {}; f.appendChild(el('td', null, pesos(p.declarado))); f.appendChild(el('td', num(p.corregido) !== num(p.declarado) ? 'dif amb' : null, pesos(p.corregido))); });
      var e = m.estimacion;
      f.appendChild(el('td', m.iva_a_pagar ? 'dif roj' : null, m.iva_a_pagar ? pesos(m.iva_a_pagar) : m.iva_pagado_de_mas ? 'Pagó de más ' + pesos(m.iva_pagado_de_mas) : '—'));
      var cg = cargos(e); f.appendChild(el('td', e && cg == null ? 'ped' : null, e ? (cg == null ? 'Pendiente' : pesos(cg)) : '—'));
      f.appendChild(el('td', e && e.calidad !== 'completa' ? 'prov' : null, e ? (e.total == null ? 'No calculable' : pesos(e.total) + (e.calidad === 'provisional' ? ' (provisional)' : '')) : '—'));
      tb.appendChild(f);
      if (e) f.title = 'Vence ' + e.vencimiento + ' · ' + e.meses_atraso + ' meses de atraso · reajuste ' + pesos(e.reajuste) + ' · intereses ' + pesos(e.intereses) + ' · multa ' + Math.round(Number(e.multa_pct) * 100) + ' % = ' + pesos(e.multa);
    });
    t.appendChild(tb);
    var tf = el('tfoot'), fs = el('tr'); fs.id = 'livr-totales';
    var c0 = el('td', null, 'Totales'); c0.colSpan = 3; fs.appendChild(c0);
    for (var i = 0; i < 6; i++) fs.appendChild(el('td', null, ''));
    fs.appendChild(el('td', null, pesos(To.impuesto))); fs.appendChild(el('td', null, pesos(num(To.reajuste) + num(To.intereses) + num(To.multa)))); fs.appendChild(el('td', null, num(To.total) == null ? 'No calculable' : pesos(To.total)));
    tf.appendChild(fs);
    if (T.otros) {
      var fo = el('tr'); fo.id = 'livr-otros'; var co = el('td', null, 'Otros cargos / multa adicional · ingresado a mano' + (ctx.otros && ctx.otros.motivo ? ': ' + ctx.otros.motivo : '')); co.colSpan = 11; fo.appendChild(co);
      fo.appendChild(el('td', null, pesos(T.otros))); tf.appendChild(fo);
      var ft = el('tr'); var ct = el('td', null, 'Total con otros cargos'); ct.colSpan = 11; ft.appendChild(ct); ft.appendChild(el('td', null, T.texto)); tf.appendChild(ft);
    }
    t.appendChild(tf); tw.appendChild(t); cont.appendChild(tw);
    cont.appendChild(el('div', 'livr-nota', (esc.fuera_de_rango && esc.fuera_de_rango.nota) || ''));
    var ul = el('ul', 'liva-sup'); (esc.instrucciones || []).forEach(function (s) { ul.appendChild(el('li', null, s)); }); cont.appendChild(ul);
    cont.appendChild(el('div', 'livr-nota amb', 'Estimación preliminar, verificar: no constituye determinación definitiva; el SII calcula reajustes, intereses y multas al presentar. No incluye el costo de nuestros servicios de regularización.'));
  }

  // ── Página resumen para el PDF «Borradores F29» ──
  function paginaPdf(esc, cliente, logo, otros) {
    var T = totalEscenario(esc, otros), To = ((esc.totales || {}).todo) || {}, tr = esc.traspaso || {}, n = nF29(esc), ff = fraseFuera(esc);
    var CL = { gris: '', amb: 'amb', roj: 'rojf', ver: 'verf' };
    var filas = (esc.meses || []).map(function (m) {
      var c = cat(m), e = m.estimacion, cg = cargos(e), p4 = m.c504 || {}, p7 = m.c77 || {}, p8 = m.c89 || {};
      return '<tr class="' + CL[c.c] + '"><td>' + esc_(m.orden ? String(m.orden) : '—') + '</td><td class="g">' + esc_(mesTxt(m.periodo)) + (m.en_rango ? '' : ' <i>(fuera del rango)</i>') + '</td><td class="g">' + esc_(catTxt(m)) + '</td>' +
        '<td>' + esc_(pesos(p4.declarado)) + '</td><td>' + esc_(pesos(p4.corregido)) + '</td><td>' + esc_(pesos(p7.declarado)) + '</td><td>' + esc_(pesos(p7.corregido)) + '</td><td>' + esc_(pesos(p8.declarado)) + '</td><td>' + esc_(pesos(p8.corregido)) + '</td>' +
        '<td class="b">' + esc_(m.iva_a_pagar ? pesos(m.iva_a_pagar) : m.iva_pagado_de_mas ? 'de más ' + pesos(m.iva_pagado_de_mas) : '—') + '</td><td>' + esc_(e ? (cg == null ? 'Pendiente' : pesos(cg)) : '—') + '</td><td class="b">' + esc_(e ? (e.total == null ? 'No calculable' : pesos(e.total)) : '—') + '</td></tr>';
    }).join('');
    return '<section class="pag"><div class="hd"><img src="' + esc_(logo) + '" alt="Contadoor"><div><h1>Si rectificamos todo</h1><p>' + esc_(cliente.razon || '') + (cliente.rut ? ' · RUT ' + esc_(cliente.rut) : '') +
      ' · Rango ' + esc_(mesTxt(esc.desde)) + ' a ' + esc_(mesTxt(esc.hasta)) + '</p></div></div><p class="aviso">' + esc_(esc.aviso || '') + '</p>' +
      '<div class="ks"><div class="k"><div class="l">F29 a rectificar</div><div class="v roj">' + esc_(String(n.rect + n.decl)) + '</div></div>' +
      '<div class="k"><div class="l">Total estimado a pagar</div><div class="v">' + esc_(T.texto) + '</div></div>' +
      '<div class="k"><div class="l">Remanente hoy → corregido</div><div class="v">' + esc_(tr.calculable ? pesos(tr.declarado) + ' → ' + pesos(tr.corregido) : 'No calculable') + '</div></div>' +
      (num(To.iva_pagado_de_mas) > 0 ? '<div class="k"><div class="l">IVA pagado de más (informativo)</div><div class="v ver">' + esc_(pesos(To.iva_pagado_de_mas)) + '</div></div>' : '') + '</div>' +
      '<p class="nota"><b>' + esc_(fraseTraspaso(esc)) + '</b>' + (ff ? ' ' + esc_(ff) : '') + '</p>' +
      '<p class="nota">Desglose: impuesto ' + esc_(pesos(To.impuesto)) + ' + reajuste ' + esc_(pesos(To.reajuste)) + ' + intereses ' + esc_(pesos(To.intereses)) + ' + multa ' + esc_(pesos(To.multa)) +
      (T.otros ? ' + otros cargos ' + esc_(pesos(T.otros)) + ' (ingresado a mano: ' + esc_((otros && otros.motivo) || '') + ')' : '') + ' = ' + esc_(T.texto) + '.</p>' +
      '<table class="f29"><thead><tr><th>Paso</th><th class="g">Mes</th><th class="g">Qué pasa al rectificar</th><th>504 decl.</th><th>504 corr.</th><th>77 decl.</th><th>77 corr.</th><th>89 decl.</th><th>89 corr.</th><th>A pagar</th><th>Cargos</th><th>Total</th></tr></thead><tbody>' + filas + '</tbody></table>' +
      '<h3>Qué significa</h3><ul>' + EXPLICACION.slice(0, 3).map(function (s) { return '<li>' + esc_(s) + '</li>'; }).join('') + (esc.instrucciones || []).map(function (s) { return '<li>' + esc_(s) + '</li>'; }).join('') + '</ul>' +
      '<p class="nota">' + esc_((esc.fuera_de_rango && esc.fuera_de_rango.nota) || '') + ' Estimación preliminar, no constituye determinación definitiva. No incluye el costo de nuestros servicios de regularización.</p>' +
      '<div class="pie">Asesorías Contadoor Ltda. · contadoor.cl</div></section>';
  }
  var esc_ = esc;
  var CSS_PDF = 'table.f29 tr.amb td{background:#FFF8E8}table.f29 tr.rojf td{background:#FFF1EF}table.f29 tr.rojf td.b{color:#D34433}table.f29 tr.verf td{background:#EEF8F2}table.f29 i{color:#8A5A00;font-style:normal;font-size:7.5px}';

  // ── Hoja «Rectificar todo» del Excel (gráfica Contadoor: franja morada, colores por categoría) ──
  var X = { morado: 'FF924893', blanco: 'FFFFFFFF', tinta: 'FF2A1430', borde: 'FFE0CCE4', lila: 'FFF6ECF6',
    est: { ver: ['FFE3F4EC', 'FF28865B'], roj: ['FFFBE4E1', 'FFD34433'], amb: ['FFFFF1D6', 'FF8A5A00'], gris: ['FFF0ECF1', 'FF7A6E7C'] }, pesos: '"$"#,##0;-"$"#,##0;"$"0' };
  var FUENTE = 'Arial';
  function borde() { var b = { style: 'thin', color: { argb: X.borde } }; return { top: b, left: b, bottom: b, right: b }; }
  function hojaExcel(wb, esc, ctx, img) {
    var ws = wb.addWorksheet('Rectificar todo', { properties: { tabColor: { argb: 'FFD34433' } }, views: [{ showGridLines: false }] });
    ws.columns = [{ width: 8 }, { width: 18 }, { width: 38 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 15 }];
    for (var r = 1; r <= 4; r++) for (var c = 1; c <= 14; c++) ws.getCell(r, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: X.morado } };
    if (img != null) ws.addImage(img, { tl: { col: 0.25, row: 0.6 }, ext: { width: 200, height: 45 } });
    ws.getCell('D2').value = 'Si rectificamos todo'; ws.getCell('D2').font = { name: FUENTE, bold: true, size: 16, color: { argb: X.blanco } };
    ws.getCell('D3').value = (ctx.cliente.razon || '') + ' · ' + mesTxt(esc.desde) + ' a ' + mesTxt(esc.hasta); ws.getCell('D3').font = { name: FUENTE, size: 10, color: { argb: X.blanco } };
    var T = totalEscenario(esc, ctx.otros), To = ((esc.totales || {}).todo) || {}, tr = esc.traspaso || {}, n = nF29(esc);
    var res = [
      ['F29 a rectificar', n.rect + n.decl, n.decl ? n.rect + ' rectificatorias + ' + n.decl + ' originales fuera de plazo' : 'rectificatorias, en orden del más antiguo al más reciente'],
      ['Impuesto adicional', num(To.impuesto)], ['Reajuste', num(To.reajuste)], ['Intereses', num(To.intereses)], ['Multa', num(To.multa)],
      ['Total estimado (servidor)', To.total == null ? 'No calculable' : num(To.total), To.total_provisional ? 'provisional' : ''],
      ['Otros cargos / multa adicional', T.otros ? T.otros : null, T.otros ? 'ingresado a mano: ' + ((ctx.otros && ctx.otros.motivo) || '') : 'sin otros cargos'],
      ['Total a pagar con otros cargos', T.total == null ? 'No calculable' : T.total],
      ['IVA pagado de más (informativo)', num(To.iva_pagado_de_mas), 'posible devolución o imputación aparte; no se descuenta'],
      ['Remanente hoy (cód. 77 de ' + mesTxt(tr.periodo) + ')', tr.calculable ? num(tr.declarado) : 'No calculable'], ['Remanente corregido', tr.calculable ? num(tr.corregido) : 'No calculable'],
      ['Diferencia del remanente', tr.calculable ? num(tr.diferencia) : null]
    ];
    var fila = 5;
    res.forEach(function (x) {
      fila++; var a = ws.getCell(fila, 2), v = ws.getCell(fila, 4), s = ws.getCell(fila, 5);
      ws.mergeCells(fila, 2, fila, 3); a.value = x[0]; v.value = x[1] == null ? '—' : x[1]; if (x[2]) s.value = x[2];
      a.font = { name: FUENTE, size: 10, bold: true, color: { argb: X.tinta } }; v.font = { name: FUENTE, size: 10, bold: /^Total/.test(x[0]), color: { argb: X.tinta } };
      s.font = { name: FUENTE, size: 9, italic: true, color: { argb: 'FF7A6080' } };
      if (typeof x[1] === 'number' && x[0] !== 'F29 a rectificar') v.numFmt = X.pesos;
      a.border = borde(); v.border = borde();
    });
    fila += 2;
    [fraseTraspaso(esc), fraseFuera(esc)].filter(Boolean).forEach(function (t) {
      ws.mergeCells(fila, 2, fila, 14); var c = ws.getCell(fila, 2); c.value = t; c.font = { name: FUENTE, size: 10, bold: true, color: { argb: 'FF8A5A00' } }; c.alignment = { wrapText: true, vertical: 'middle' }; ws.getRow(fila).height = 30; fila++;
    });
    fila++;
    var cab = ['Paso', 'Mes', 'Qué pasa al rectificar', '504 declarado', '504 corregido', '77 declarado', '77 corregido', '89 declarado', '89 corregido', 'IVA a pagar', 'Reajuste', 'Intereses', 'Multa', 'Total'];
    var hr = ws.getRow(fila); cab.forEach(function (t, i) { var c = hr.getCell(i + 1); c.value = t; c.font = { name: FUENTE, bold: true, size: 10, color: { argb: X.blanco } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: X.morado } }; c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; c.border = borde(); });
    hr.height = 22; var ini = fila + 1;
    (esc.meses || []).forEach(function (m) {
      fila++; var e = m.estimacion || {}, k = cat(m), row = ws.getRow(fila);
      var vals = [m.orden || '', mesTxt(m.periodo) + (m.en_rango ? '' : ' (fuera)'), catTxt(m), num((m.c504 || {}).declarado), num((m.c504 || {}).corregido), num((m.c77 || {}).declarado), num((m.c77 || {}).corregido),
        num((m.c89 || {}).declarado), num((m.c89 || {}).corregido), m.iva_a_pagar ? num(m.iva_a_pagar) : null, num(e.reajuste), num(e.intereses), num(e.multa), m.estimacion ? (e.total == null ? 'No calculable' : num(e.total)) : null];
      vals.forEach(function (v, i) { var c = row.getCell(i + 1); c.value = v; c.font = { name: FUENTE, size: 10, color: { argb: X.tinta } }; c.border = borde(); if (i >= 3) c.numFmt = X.pesos; });
      var col = X.est[k.c] || X.est.gris, cc = row.getCell(3); cc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: col[0] } }; cc.font = { name: FUENTE, size: 10, bold: true, color: { argb: col[1] } };
      if (!m.en_rango) row.getCell(2).font = { name: FUENTE, size: 10, italic: true, color: { argb: 'FF8A5A00' } };
    });
    var fin = fila; fila++;
    var tt = ws.getRow(fila); tt.getCell(1).value = 'Totales';
    [10, 11, 12, 13, 14].forEach(function (k) {
      var col = String.fromCharCode(64 + k), suma = 0; for (var f = ini; f <= fin; f++) { var v = ws.getCell(f, k).value; if (typeof v === 'number') suma += v; }
      tt.getCell(k).value = fin >= ini ? { formula: 'SUM(' + col + ini + ':' + col + fin + ')', result: suma } : 0; tt.getCell(k).numFmt = X.pesos;
    });
    for (var j = 1; j <= 14; j++) { var cj = tt.getCell(j); cj.font = { name: FUENTE, bold: true, color: { argb: X.blanco } }; cj.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: X.morado } }; cj.border = borde(); }
    fila += 2;
    EXPLICACION.slice(0, 3).concat(esc.instrucciones || []).concat([(esc.fuera_de_rango && esc.fuera_de_rango.nota) || '', 'Estimación preliminar, verificar: no constituye determinación definitiva. No incluye el costo de nuestros servicios de regularización.']).filter(Boolean).forEach(function (t) {
      ws.mergeCells(fila, 1, fila, 14); var c = ws.getCell(fila, 1); c.value = t; c.font = { name: FUENTE, size: 9, color: { argb: 'FF5B4560' } }; c.alignment = { wrapText: true }; ws.getRow(fila).height = 26; fila++;
    });
    return ws;
  }

  raiz.GestoorLevRect = { abrir: abrir, cerrar: cerrar, escenario: escenario, escenarioOpcional: escenarioOpcional, paginaPdf: paginaPdf, CSS_PDF: CSS_PDF, hojaExcel: hojaExcel,
    totalEscenario: totalEscenario, fraseTraspaso: fraseTraspaso, fraseFuera: fraseFuera, textoF29: textoF29, CAT: CAT, estilos: estilos };
})(window);
