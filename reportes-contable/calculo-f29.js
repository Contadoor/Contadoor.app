/* ============================================================
   reportes-contable/calculo-f29.js — tarjeta «Cálculo del F29» en el detalle del Reporte Contable (19-11). SOLO LECTURA.
   Va debajo del resumen automático del SII (docs-sii.js) y muestra cuánto sería el F29 del período:
     débito fiscal, crédito fiscal (solo compras REGISTRADAS), remanente del período anterior (cód. 77 × UTM = cód. 504, oficial
     del SII; si no está, el de Contable), IVA a pagar o remanente para el mes siguiente, PPM (tasa del último F29 del SII → último Pre-IVA × base;
     19-11: + «Cobertura de la renta», pre-iva/ppm-cobertura.js),
     retención de honorarios, impuesto único (RR. HH.) y TOTAL A PAGAR F29. Cada línea dice de dónde sale el dato.
   NO DUPLICA LA FÓRMULA: el IVA y el PPM salen de pre-iva/f29-formula.js (calcularF29Completo, el mismo que usa el Pre-IVA),
   la lectura del SII se traduce con pre-iva/sii-cartapra.js (PreIvaSii.aPantalla) y la proyección con pre-iva/proyeccion.js.
   Así el Pre-IVA y esta tarjeta dan exactamente el mismo IVA + PPM. Contable suma aparte honorarios e impuesto único.
   Si falta algo (UTM, F29 anterior, tasa PPM, RR. HH.) se muestra «Falta: …» y NO se da un total inventado.
   Datos: misma consulta sii_preiva_periodo de docs-sii.js (caché) + SELECT a preiva_historial (tasa, PPM editado, validación).
   Sin SQL nuevo, sin Edge. Todo dato se pinta con textContent.
   Uso: ContableCalculoF29.montar(slot, { clienteId, rut, periodo, cliente, rep, remContable, sbFetch })
   ============================================================ */
(function (raiz) {
  'use strict';
  var F = raiz.PreIvaF29 || (typeof require === 'function' ? require('../pre-iva/f29-formula.js') : null);
  var S = raiz.PreIvaSii || (typeof require === 'function' ? require('../pre-iva/sii-cartapra.js') : null);
  var PRY = raiz.PreIvaProyeccion || (typeof require === 'function' ? require('../pre-iva/proyeccion.js') : null);
  var COB = raiz.PreIvaPPMCobertura || (typeof require === 'function' ? require('../pre-iva/ppm-cobertura.js') : null);   // 19-11: tasa del último F29 + cobertura de la renta
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  function num(v) { if (v === null || v === undefined || v === '') return null; var x = Number(v); return isFinite(x) ? x : null; }
  function pesos(v) { var x = num(v); if (x === null) return '—'; x = Math.round(x); return (x < 0 ? '-' : '') + '$' + Math.abs(x).toLocaleString('es-CL'); }
  function perGuion(p) { p = String(p || '').replace('-', ''); return /^\d{6}$/.test(p) ? p.slice(0, 4) + '-' + p.slice(4) : ''; }
  function mesTxt(p) { p = String(p || '').replace('-', ''); return /^\d{6}$/.test(p) ? MESES[+p.slice(4) - 1] + ' ' + p.slice(0, 4) : 'el mes anterior'; }
  function mesAnt(p) { var g = perGuion(p); if (!g) return ''; var y = +g.slice(0, 4), m = +g.slice(5) - 1; if (m < 1) { m = 12; y--; } return y + '-' + (m < 10 ? '0' : '') + m; }
  function fechaCorta(iso) { if (!iso) return null; var d = new Date(iso); if (isNaN(d.getTime())) return null; return d.toLocaleDateString('es-CL', { timeZone: 'America/Santiago', day: '2-digit', month: '2-digit', year: 'numeric' }); }
  function tasaTxt(t) { return String(Math.round((Number(t) || 0) * 1000) / 1000).replace('.', ','); }

  // ── Lógica pura (pruebas: node --test reportes-contable/calculo-f29.test.js) ──────────────────────
  // o: { raw (sii_preiva_periodo), remContable {valor, fuente:'contable'|'manual'|'sin'|'error'}, fila (preiva_historial del período),
  //      hist (últimos preiva_historial, desc), fichaTasa, tieneRrhh, iuSii (null = RR. HH. pendiente), iuAt, periodo, hoy, estadoContable,
  //      ppm (PreIvaPPMCobertura.leer: F29 del año en el SII + proyección de renta; opcional) }
  function armar(o) {
    o = o || {};
    var raw = o.raw || {}, per = perGuion(o.periodo), cob = raw.cobertura || {};
    var p = S.aPantalla(raw, o.remContable || null, o.fila || null);
    var out = { conectado: p.conectado, datosAlTxt: p.datosAlTxt, periodo: per, lineas: [], faltas: [], notas: [], total: null, esMesActual: false };
    out.validacion = estadoValidacion(o.fila, o.estadoContable);
    if (!p.conectado) return out;
    var faltas = out.faltas;
    var origenSii = 'SII · Cartapra';
    // Débito y crédito (crédito = solo compras REGISTRADAS; NC restan desde la base)
    var debito = p.debito, credito = p.credito;
    if (debito == null) { if (cob.rcv_ventas === 'completa') debito = 0; else faltas.push('ventas del SII de ' + mesTxt(per) + ' (Cartapra aún no las trae)'); }
    if (credito == null) { if (cob.rcv_compras === 'completa') credito = 0; else faltas.push('compras del SII de ' + mesTxt(per) + ' (Cartapra aún no las trae)'); }
    // Remanente: oficial del SII (cód. 504) → el de Contable (como el Pre-IVA) → Falta
    // 19-11: misma decisión que el Pre-IVA (PreIvaSii.remanenteDelPeriodo): solo el mes INMEDIATAMENTE anterior, nunca $0 por defecto.
    var ra = raw.remanente_anterior || {}, rc = o.remContable || {}, rem = null, remOrigen = null, remDet = null;
    var RD = S.remanenteDelPeriodo({ periodo: per, sii: p, remContable: rc });
    out.remanenteBloqueo = RD.bloqueo || null;   // 19-11: mismo bloqueo y texto que el Pre-IVA (nunca $0)
    if (RD.origen === 'sii') { rem = RD.valor; remOrigen = 'F29 anterior · SII'; remDet = RD.texto; }
    else if (RD.origen === 'contable' || RD.origen === 'manual') {
      rem = num(rc.valor); remOrigen = rc.fuente === 'manual' ? 'F29 anterior · ingresado a mano' : 'F29 anterior · Contable';
      remDet = (rc.info && rc.info.detalle) || 'Remanente del F29 de ' + mesTxt(ra.periodo || mesAnt(per)) + ' registrado en Contable';
    } else {
      var m = mesTxt(ra.periodo || mesAnt(per));
      faltas.push(ra.fuente === 'f29_sin_montos' ? 'montos del F29 de ' + m + ' (Cartapra aún no los trae)'
        : (ra.falta_utm && ra.falta_utm.length) ? 'UTM de ' + ra.falta_utm.map(mesTxt).join(' y ') + ' en Gestoor (para reajustar el remanente)'
        : 'F29 de ' + m + ' (remanente del período anterior, cód. 77)');
    }
    // PPM: tasa del último F29 del SII (19-11) → la del último Pre-IVA guardado (o la ficha), con la edición guardada si la hay — misma regla que el Pre-IVA
    var PP = o.ppm || null, U = PP ? PP.ultimo : null;
    var T = COB ? COB.tasaPorDefecto(U, o.fila || null, o.hist || [], o.fichaTasa) : F.tasaPPMDesdeGuardado(o.fila || null, o.hist || [], o.fichaTasa);
    var ed = F.edicionPPMGuardada(o.fila && o.fila.sii_detalle);
    if (!(T.tasa > 0) && !ed) faltas.push('tasa PPM (no hay Pre-IVA anterior con tasa ni tasa en la ficha del cliente)');
    var hz = PRY.horizonte({ hoy: o.hoy || new Date(), periodo: per || '2000-01' });
    out.esMesActual = hz.esMesActual;
    var R = F.calcularF29Completo({ debitoRegistrado: debito || 0, creditoRegistrado: credito || 0,
      netoVentas: p.debito != null ? (p.netoVentas || 0) : null, exentoVentas: p.debito != null && p.exentoVentas != null ? p.exentoVentas : null,
      remanente: rem, tasa: T.tasa, edicionPPM: ed, horizonte: hz });   // rem null = sin remanente del mes anterior → IVA y total null
    out.calculo = R;
    // Retención de honorarios (boletas recibidas del SII)
    var hon = raw.honorarios && raw.honorarios.honorarios_recibidos, retHon = null;
    if (hon) retHon = num(hon.retencion) || 0;
    else if (cob.honorarios === 'completa') retHon = 0;
    else faltas.push('boletas de honorarios del SII (Cartapra aún no las trae)');
    // Impuesto único de trabajadores: siempre desde RR. HH.
    var iu = null, iuOrigen = 'RR. HH.', iuNota = null;
    if (o.tieneRrhh === false) { iu = 0; iuNota = 'No aplica: el cliente no tiene RR. HH. en Gestoor'; }
    else if (num(o.iuSii) != null) { iu = num(o.iuSii); iuNota = o.iuAt ? 'Informado por RR. HH. el ' + fechaCorta(o.iuAt) : 'Informado por RR. HH.'; }
    else faltas.push('impuesto único de trabajadores (RR. HH. aún no lo informa)');

    var L = out.lineas, faltaDeb = debito == null, faltaCred = credito == null;
    L.push({ id: 'debito', op: '', label: 'Débito fiscal', sub: 'IVA de tus ventas', valor: faltaDeb ? null : R.debito, origen: origenSii, falta: faltaDeb ? 'ventas del SII' : null });
    L.push({ id: 'credito', op: '−', label: 'Crédito fiscal', sub: 'Solo compras registradas (las pendientes no suman)', valor: faltaCred ? null : R.credito, origen: origenSii, falta: faltaCred ? 'compras del SII' : null,
      nota: p.pendientes.n > 0 ? p.pendientes.n + ' factura(s) pendiente(s) en el SII: no suman hasta aceptarlas' : null });
    L.push({ id: 'remanente', op: '−', label: 'Remanente período anterior', sub: 'Cód. 77 del F29 anterior × UTM (cód. 504)', valor: rem, origen: remOrigen || 'F29 anterior', falta: rem == null ? 'remanente anterior' : null, det: remDet,
      bloqueo: rem == null && RD.bloqueo ? RD.bloqueo.mensaje : null });
    var ivaOk = !faltaDeb && !faltaCred && rem != null;
    if (ivaOk && R.nuevoRemanente > 0) L.push({ id: 'iva', op: '=', label: 'IVA a pagar', sub: 'Queda remanente para el mes siguiente: ' + pesos(R.nuevoRemanente), valor: 0, origen: 'Cálculo', tot: true });
    else L.push({ id: 'iva', op: '=', label: 'IVA a pagar', sub: 'Débito − crédito − remanente (si da negativo, queda remanente)', valor: ivaOk ? R.ivaPagar : null, origen: 'Cálculo', tot: true, falta: ivaOk ? null : 'datos del IVA' });
    var tasaOrigen = T.fuente === 'sii' ? 'último F29 de ' + mesTxt(T.periodo) + ' · SII' : T.fuente === 'ficha' ? 'ficha del cliente' : T.fuente ? 'Pre-IVA de ' + mesTxt(T.periodo) : 'sin tasa';
    var ppmSub = R.ppmEditado ? F.etiquetaPPMEditado(R) + (R.ppmMotivo ? ' · Motivo: ' + R.ppmMotivo : '')
      : 'Base ' + pesos(R.ppmBase) + ' (neto + exento' + (hz.esMesActual ? ', proyectada al cierre' : '') + ') × tasa ' + tasaTxt(R.tasa) + '% (' + tasaOrigen + ')';
    var faltaPpm = !(T.tasa > 0) && !ed;
    L.push({ id: 'ppm', op: '+', label: 'PPM', sub: ppmSub, valor: faltaPpm || faltaDeb ? null : R.ppm, origen: R.ppmEditado ? 'Pre-IVA · editado' : origenSii + ' × tasa', falta: faltaPpm ? 'tasa PPM' : faltaDeb ? 'ventas del SII' : null,
      editado: R.ppmEditado, nota: (R.ppmAvisos || []).length ? 'PPM no definitivo: ' + R.ppmAvisos.join(' · ') : null, tasaSii: COB && U ? COB.textoTasa(U) : null, tasaU: U || null });
    if (COB && PP) out.cobertura = COB.cobertura({ meses: PP.sii.meses, siiEstado: PP.sii.estado, periodo: per, ppmMes: faltaPpm || faltaDeb ? 0 : R.ppm, baseMes: R.ppmBase, renta: PP.renta });
    L.push({ id: 'honorarios', op: '+', label: 'Retención de honorarios', sub: 'Boletas de honorarios recibidas', valor: retHon, origen: origenSii, falta: retHon == null ? 'honorarios del SII' : null });
    L.push({ id: 'iu', op: '+', label: 'Impuesto único trabajadores', sub: iuNota || 'Impuesto único de 2ª categoría', valor: iu, origen: iuOrigen, falta: iu == null ? 'RR. HH. pendiente' : null });
    out.total = faltas.length ? null : F.totalF29(R, retHon, iu);
    if (hz.esMesActual) out.notas.push('Mes en curso: débito, crédito y base del PPM proyectados a fin de mes (igual que el Pre-IVA).');
    if (p.f29) out.notas.push('Este mes ya tiene F29 presentado en el SII (folio ' + p.f29.folio + ').');
    if ((raw.avisos || []).indexOf('cobertura_incompleta') >= 0) out.notas.push('El SII aún no entrega completo este mes en Cartapra: los montos pueden cambiar.');
    return out;
  }
  // Estado de validación del Pre-IVA con lo que ya se lee (reportes_mensuales.estado_contable y preiva_historial.fecha_envio/enviado_por)
  function estadoValidacion(fila, estadoContable) {
    var f = fila && fila.fecha_envio ? fechaCorta(fila.fecha_envio) : null, por = fila && fila.enviado_por ? String(fila.enviado_por) : null;
    if (f) return { validado: true, texto: 'Pre-IVA validado el ' + f + (por ? ' por ' + por : '') };
    if (estadoContable === 'completado') return { validado: true, texto: 'Pre-IVA validado en el Reporte Contable' };
    return { validado: false, texto: 'Aún no validado' + (fila ? ' · hay un borrador guardado en Pre-IVA' : '') };
  }
  function urlPreIva(clienteId, periodo) { return '../pre-iva/index.html?periodo=' + encodeURIComponent(perGuion(periodo)) + '&cliente=' + encodeURIComponent(String(clienteId)); }

  // ── Datos (solo SELECT con el JWT del usuario) ───────────────────────────────────────────────────
  function getJson(path, f) {
    f = f || (typeof raiz.sbFetch === 'function' ? raiz.sbFetch : null);
    if (!f) return Promise.reject(new Error('SIN_CLIENTE'));
    return f(path).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
  }
  var COLS = 'periodo,tasa_ppm,ppm,f29,fecha_envio,enviado_por,sii_detalle';
  var cacheHist = {};
  function leerPreiva(rut, per, f) {
    var k = rut + '|' + per;
    if (!cacheHist[k]) cacheHist[k] = Promise.all([
      getJson('preiva_historial?cliente_rut=eq.' + encodeURIComponent(rut) + '&periodo=eq.' + encodeURIComponent(per) + '&select=' + COLS, f),
      getJson('preiva_historial?cliente_rut=eq.' + encodeURIComponent(rut) + '&order=periodo.desc&limit=12&select=' + COLS, f)
    ]).then(function (x) { return { estado: 'ok', fila: (x[0] && x[0][0]) || null, hist: x[1] || [] }; },
            function () { delete cacheHist[k]; return { estado: 'error', fila: null, hist: [] }; });
    return cacheHist[k];
  }

  // ── Pantalla ──────────────────────────────────────────────────────────────────────────────────────
  var doc = raiz.document;
  function el(tag, cls, txt) { var e = doc.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function icono(n, color) { var i = el('i', 'ic cf29-ic ' + (color || '')); i.innerHTML = raiz.gIcon ? raiz.gIcon(n) : ''; return i; }
  function estilos() {
    if (doc.getElementById('calculo-f29-css')) return;
    var s = el('style'); s.id = 'calculo-f29-css';
    s.textContent = [
      '.cf29{border:1px solid #4A2B50;border-radius:14px;background:rgba(42,20,48,.72);padding:14px 16px;color:#F3E9F4;margin:0 0 12px}',
      '.cf29-hd{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px}.cf29-hd .t{flex:1;min-width:180px}',
      '.cf29-hd b{display:block;font:800 14px var(--g-titulo,Montserrat,sans-serif)}.cf29-hd small{display:block;color:#C9A8CC;font-size:11px;margin-top:2px}',
      '.cf29-ic{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:9px;flex:0 0 30px;font-style:normal}.cf29-ic .g-ic{width:16px;height:16px}',
      '.cf29-mor{color:#E39BE5;background:rgba(227,155,229,.16)}.cf29-ver{color:#46D69A;background:rgba(70,214,154,.16)}.cf29-ama{color:#FFC85A;background:rgba(255,200,90,.16)}.cf29-cel{color:#5CC8FF;background:rgba(92,200,255,.16)}',
      '.cf29-tabla{width:100%;border-collapse:collapse;font-size:12px;font-variant-numeric:tabular-nums}',
      '.cf29-tabla td{padding:7px 6px;border-bottom:1px solid rgba(74,43,80,.6);vertical-align:top}',
      '.cf29-tabla td.op{width:14px;color:#C9A8CC;font-weight:700;text-align:center}',
      '.cf29-tabla td.v{text-align:right;white-space:nowrap;font-weight:700}',
      '.cf29-tabla .l{font-weight:700}.cf29-tabla .s{display:block;color:#C9A8CC;font-size:10.5px;margin-top:2px;line-height:1.4;overflow-wrap:anywhere}',
      '.cf29-tabla .n{display:block;color:#FFC85A;font-size:10.5px;margin-top:2px;line-height:1.4}',
      '.cf29-or{display:inline-block;margin-top:4px;padding:1px 8px;border-radius:999px;font-size:10px;font-weight:600;border:1px solid #6B4672;color:#E9DCEB;white-space:nowrap}',
      '.cf29-or.ed{border-color:rgba(255,200,90,.6);color:#FFC85A}',
      '.cf29-tabla tr.tot td{background:rgba(146,72,147,.10)}',
      '.cf29-falta{color:#FFC85A;font-weight:600;font-size:11.5px}',
      '.cf29-tabla .bq{display:block;color:#F5C2BB;font-size:10.5px;margin-top:3px;line-height:1.4;font-weight:600}',
      '.cf29-bloq{margin:0 0 10px;padding:9px 12px;border-radius:10px;border:1px solid rgba(224,122,110,.5);background:rgba(224,122,110,.10);color:#F5C2BB;font-size:12px;line-height:1.5;font-weight:600}',
      '.cf29-fin td{border-top:2px solid #924893;border-bottom:0;padding-top:10px}.cf29-fin .l{font:800 13px var(--g-titulo,Montserrat,sans-serif)}.cf29-fin td.v{font-size:16px;color:#F3E9F4}',
      '.cf29-faltas{margin:8px 0 0;padding:8px 12px;border-radius:10px;border:1px solid rgba(255,200,90,.45);background:rgba(255,200,90,.10);color:#FFC85A;font-size:11.5px;line-height:1.5}',
      '.cf29-faltas ul{margin:4px 0 0;padding-left:18px}',
      '.cf29-nota{font-size:11px;color:#C9A8CC;margin-top:6px}',
      '.cf29-pie{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:12px;padding-top:10px;border-top:1px solid rgba(74,43,80,.8)}',
      '.cf29-est{display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:600}.cf29-est .cf29-ic{width:24px;height:24px;flex-basis:24px}.cf29-est .cf29-ic .g-ic{width:13px;height:13px}',
      '.cf29-btn{display:inline-flex;align-items:center;gap:6px;min-height:36px;padding:0 16px;border-radius:999px;background:#924893;color:#fff;font:700 12.5px Inter,sans-serif;text-decoration:none;border:1px solid #924893}',
      '.cf29-btn:hover{filter:brightness(1.12)}',
      '@media (max-width:560px){.cf29{padding:12px}.cf29-tabla td{padding:6px 4px}.cf29-pie{flex-direction:column;align-items:stretch}.cf29-btn{justify-content:center}}'
    ].join('\n');
    doc.head.appendChild(s);
  }
  function pintar(slot, a, op, val) {
    slot.textContent = '';
    var box = el('div', 'cf29'), hd = el('div', 'cf29-hd'), t = el('div', 't');
    hd.appendChild(icono('iva', 'cf29-mor'));
    t.appendChild(el('b', null, 'Cálculo del F29 · ' + mesTxt(op.periodo)));
    t.appendChild(el('small', null, a && a.datosAlTxt ? 'Datos del SII al ' + a.datosAlTxt + ' (hora de Chile) · mismo cálculo del Pre-IVA' : 'Mismo cálculo del Pre-IVA'));
    hd.appendChild(t); box.appendChild(hd);
    if (!a) box.appendChild(el('div', 'cf29-nota', 'No se pudieron leer los datos del SII para calcular el F29.'));
    else if (!a.conectado) box.appendChild(el('div', 'cf29-nota', 'Esta empresa aún no está conectada al SII: el cálculo aparece cuando Cartapra traiga sus datos. Mientras tanto, revísalo en el Pre-IVA.'));
    else {
      if (a.remanenteBloqueo) box.appendChild(el('div', 'cf29-bloq', a.remanenteBloqueo.mensaje));   // 19-11: «⚠️ <mes> no está declarado…»
      var tb = el('table', 'cf29-tabla'), body = el('tbody');
      a.lineas.forEach(function (x) {
        var tr = el('tr', x.tot ? 'tot' : null);
        tr.appendChild(el('td', 'op', x.op || ''));
        var td = el('td'); td.appendChild(el('span', 'l', x.label)); if (x.sub) td.appendChild(el('span', 's', x.sub));
        if (x.det) td.appendChild(el('span', 's', x.det));
        if (x.nota) td.appendChild(el('span', 'n', x.nota));
        if (x.bloqueo) td.appendChild(el('span', 'bq', x.bloqueo));
        if (x.tasaU && COB) { var ts = el('span'); COB.pintarTasa(ts, x.tasaU); td.appendChild(ts); }   // «Tasa usada en el último F29: X % (mes, según SII)»
        if (x.origen) td.appendChild(el('span', 'cf29-or' + (x.editado ? ' ed' : ''), x.origen));
        tr.appendChild(td);
        var v = el('td', 'v'); if (x.falta) v.appendChild(el('span', 'cf29-falta', 'Falta: ' + x.falta)); else v.textContent = pesos(x.valor);
        tr.appendChild(v); body.appendChild(tr);
      });
      var fin = el('tr', 'cf29-fin'); fin.appendChild(el('td', 'op', '='));
      var tl = el('td'); tl.appendChild(el('span', 'l', 'TOTAL A PAGAR F29')); tl.appendChild(el('span', 's', 'IVA a pagar + PPM + retención de honorarios + impuesto único'));
      fin.appendChild(tl);
      var tv = el('td', 'v'); if (a.total == null) tv.appendChild(el('span', 'cf29-falta', 'Falta completar')); else tv.textContent = pesos(a.total);
      fin.appendChild(tv); body.appendChild(fin); tb.appendChild(body); box.appendChild(tb);
      if (a.cobertura && COB) { var cs = el('div', 'ppmc-slot'); COB.pintarCobertura(cs, a.cobertura); box.appendChild(cs); }
      if (a.faltas.length) {
        var fb = el('div', 'cf29-faltas'); fb.appendChild(el('b', null, 'Para el total falta:'));
        var ul = el('ul'); a.faltas.forEach(function (f) { ul.appendChild(el('li', null, 'Falta: ' + f)); }); fb.appendChild(ul); box.appendChild(fb);
      }
      a.notas.forEach(function (n) { box.appendChild(el('div', 'cf29-nota', n)); });
    }
    var pie = el('div', 'cf29-pie'), est = el('span', 'cf29-est'), v = val || { validado: false, texto: 'Aún no validado' };
    est.appendChild(icono(v.validado ? 'check' : 'reloj', v.validado ? 'cf29-ver' : 'cf29-ama')); est.appendChild(doc.createTextNode(v.texto));
    pie.appendChild(est);
    var b = el('a', 'cf29-btn', 'Revisar y validar en Pre-IVA →'); b.href = urlPreIva(op.clienteId, op.periodo);
    b.title = 'Abre el Pre-IVA de este cliente y período';
    pie.appendChild(b); box.appendChild(pie); slot.appendChild(box);
  }

  var seq = 0;
  function montar(slot, op) {
    if (!slot || !op || !(Number(op.clienteId) > 0) || !op.periodo || !F || !S || !PRY) return Promise.resolve();
    estilos();
    var n = ++seq; slot.setAttribute('data-seq', String(n));
    var lectura = raiz.ContableDocsSii ? raiz.ContableDocsSii.leerResumen(op.clienteId, op.periodo, op.sbFetch) : Promise.resolve({ estado: 'error' });
    var lppm = COB ? COB.leer(op.clienteId, op.periodo, op.sbFetch).catch(function () { return null; }) : Promise.resolve(null);
    return Promise.all([lectura, leerPreiva(op.rut, perGuion(op.periodo), op.sbFetch), lppm]).then(function (x) {
      if (slot.getAttribute('data-seq') !== String(n) || !slot.isConnected) return;
      var sii = x[0], pv = x[1], c = op.cliente || {}, rep = op.rep || {};
      var a = sii.estado === 'ok' && sii.raw ? armar({ raw: sii.raw, remContable: op.remContable, fila: pv.fila, hist: pv.hist, fichaTasa: c.ppmTasaDefault,
        tieneRrhh: c.tieneRrhh, iuSii: rep.iuSii, iuAt: rep.iuSiiActualizadoAt, periodo: op.periodo, hoy: new Date(), estadoContable: rep.estadoContable, ppm: x[2] }) : null;
      if (a && pv.estado !== 'ok') a.notas.push('No se pudo leer el Pre-IVA guardado: la tasa PPM sale de la ficha del cliente y no se ve si el PPM fue editado.');
      pintar(slot, a, op, estadoValidacion(pv.fila, rep.estadoContable));
    });
  }

  var api = { armar: armar, estadoValidacion: estadoValidacion, urlPreIva: urlPreIva, leerPreiva: leerPreiva, montar: montar, pesos: pesos,
    _limpiarCache: function () { cacheHist = {}; } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  raiz.ContableCalculoF29 = api;
})(typeof window !== 'undefined' ? window : globalThis);
