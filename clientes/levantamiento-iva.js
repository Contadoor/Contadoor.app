/* ============================================================
   clientes/levantamiento-iva.js — «Levantamiento de IVA» en la ficha del cliente (regularizaciones, 21-11-2026).
   · Cruza mes a mes el RCV del SII (Cartapra) con lo declarado en cada F29 y estima lo que costaría rectificar.
   · Todo el cálculo está en el servidor: RPC public.sii_levantamiento_iva (solo lectura) y
     public.sii_levantamiento_pedir_historial (encola en la cola de Cartapra lo que falta). Aquí solo se pinta.
   · Botón visible para el Master y el equipo contable (UX). El permiso real lo valida la RPC (Master o analista
     contable asignado; si no → 42501 y se muestra el aviso).
   · Datos externos SIEMPRE con textContent (innerHTML solo para íconos de gIcon). El PDF se arma con texto escapado.
   · Mes sin datos = «Sin datos» (gris), nunca 0. La estimación va siempre marcada «Estimación, verificar».
   · R2 (22-11-2026): estados provisionales en ámbar (coincidencia provisional, diferencia preliminar, revisar arrastre),
     meses «condicionados» (remanente desconocido), «F29 sin montos» con el IVA del RCV, totales separados (conocido /
     provisional / no calculable: nunca se suma lo que falta), medio de declaración (día 20/12) y el PDF con el aviso
     «Estimación preliminar, no constituye determinación definitiva». Cada PDF queda en la bitácora (RPC registrar_pdf).
   · CARTAPRA-HISTORIA (20-11-2026): botón «Historia SII» dentro del diálogo (historia-sii.js: trae hasta 6 años de
     compras y ventas de Cartapra), columna «Origen» por mes (RPC public.sii_historia_origenes: sincronización diaria o
     Historia SII; si no está instalada, «—») y aviso fijo «Cartapra entrega montos de F29 solo de los últimos 6 folios».
   · Al cliente: «nuestros servicios» (nunca otra palabra).
   Uso: GestoorLevIVA.montar(elemento, {id, razon, rut}, sesion)
   ============================================================ */
(function (raiz) {
  'use strict';
  var doc = raiz.document;
  var MORADO = '#924893';
  var ESTADOS = {
    calza: { t: 'Calza', c: 'ver' }, diferencia: { t: 'Diferencia', c: 'roj' }, no_declarado: { t: 'Sin declaración encontrada', c: 'roj' },
    a_favor: { t: 'Difiere sin pago', c: 'amb' }, sin_datos: { t: 'Sin datos', c: 'gris' }, en_plazo: { t: 'En plazo', c: 'gris' },
    coincidencia_provisional: { t: 'Coincidencia provisional', c: 'amb' }, diferencia_preliminar: { t: 'Diferencia preliminar', c: 'amb' },
    revisar_arrastre: { t: 'Revisar arrastre', c: 'amb' }, f29_sin_montos: { t: 'F29 sin montos', c: 'gris' }
  };
  var MOTIVOS = {
    sin_rcv: 'Faltan las compras y ventas del SII de este mes (pide el historial a Cartapra).',
    no_disponible_cartapra: 'Cartapra no tiene las compras y ventas de este mes (respondió «no disponible»). No significa que no hubo movimiento.',
    f29_sin_montos: 'El F29 está declarado pero aún no tenemos sus montos (pide el historial a Cartapra). Se muestra el IVA del RCV, sin comparar.',
    f29_sin_montos_cartapra: 'F29 sin montos en Cartapra: el F29 está declarado, pero Cartapra no entrega sus montos para este mes. Se muestra el IVA del RCV, sin comparar.',
    sin_declaracion_en_antecedentes: 'No se encontró declaración en los antecedentes disponibles.',
    sin_conexion: 'La empresa no está conectada con el SII.'
  };
  var CALIDAD = { completa: '', provisional: ' (provisional)', no_calculable: ' (no calculable)' };
  var ALERTAS = {
    notas_credito_emitidas: 'Notas de crédito emitidas: rebajan el débito; revisar que correspondan al mes.',
    notas_credito_recibidas: 'Notas de crédito recibidas: rebajan el crédito.',
    compras_pendientes: 'Hay compras pendientes de acuse: si se aceptan pueden sumar crédito.',
    compras_reclamadas: 'Hay compras reclamadas (no dan crédito).',
    compras_no_incluir: 'Hay compras marcadas «no incluir» (no dan crédito).',
    compras_de_otro_mes: 'Facturas de meses anteriores registradas en este mes (art. 24: crédito hasta 2 períodos después).',
    sin_derecho_o_uso_comun: 'El F29 declara IVA sin derecho a crédito o de uso común (cód. 514/521/564): el RCV no trae la proporción; revisar a mano.',
    uso_comun_rcv: 'El RCV informa IVA de uso común o no recuperable: revisar la proporción.',
    creditos_no_documentales: 'Créditos que no vienen del RCV (importaciones, impuesto específico, etc.): se tomaron tal como se declararon.',
    iva_postergado: 'IVA postergado en el F29 (cód. 89 en cero).',
    retencion_cambio_sujeto: 'Retención o cambio de sujeto (cód. 587/517): revisar.',
    rectificatoria: 'El período tiene más de una declaración (rectificatoria).',
    f29_observado: 'El F29 tiene una marca del SII para revisar u observada.',
    rcv_parcial: 'La lectura del RCV quedó parcial.',
    cadena_reiniciada: 'Tras un mes sin datos, el remanente parte del declarado (cód. 504).',
    remanente_inicial_desconocido: 'No se conoce el remanente inicial: el cálculo usa el escenario conservador remanente = 0 (supuesto). Mes condicionado.',
    remanente_sin_reajuste_utm: 'Falta la UTM para reajustar el remanente: se pasó sin reajustar. Mes condicionado.',
    depende_de_supuesto: 'Este mes depende de un remanente supuesto o sin reajustar de meses anteriores (condicionado).',
    remanente_distinto: 'El remanente (cód. 504 o 77) recalculado no es el declarado: revisar el arrastre.',
    diferencia_por_arrastre: 'Débito y crédito del mes calzan: la diferencia viene del remanente arrastrado.',
    reajuste_sin_utm: 'Falta la UTM del vencimiento o del mes de pago: reajuste pendiente (el total no se calcula).',
    intereses_sin_tasa: 'Falta la tasa de interés penal del SII para un semestre: intereses pendientes.',
    vencimiento_corrido_habil: 'El vencimiento cayó en día inhábil: se corrió al siguiente día hábil.',
    feriados_no_cargados: 'No hay feriados cargados para ese año: solo se consideraron fines de semana.'
  };
  var AVISO_F29 = 'Cartapra entrega montos de F29 solo de los últimos 6 folios';
  var ORIGEN = { historia: 'Historia SII', sync: 'Sincronización diaria' };
  /** Texto del origen del RCV de un mes (ventas y compras). */
  function origenTxt(o) {
    if (!o) return '—';
    var v = o.ventas, c = o.compras;
    if (!v && !c) return '—';
    if (v && c && v !== c) return 'Mixto (Historia SII y diaria)';
    return ORIGEN[v || c] || '—';
  }
  var NOMBRE_MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  function el(tag, cls, txt) { var e = doc.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function icono(n) { var i = el('i', 'ic'); i.innerHTML = raiz.gIcon ? raiz.gIcon(n) : ''; return i; }
  function num(v) { return v == null || v === '' || isNaN(Number(v)) ? null : Number(v); }
  function pesos(v) { var n = num(v); return n == null ? '—' : (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString('es-CL'); }
  function mesTxt(p) { p = String(p || ''); return p.length === 6 ? NOMBRE_MES[Number(p.slice(4)) - 1] + ' ' + p.slice(0, 4) : p; }
  function aAAAAMM(v) { return String(v || '').replace('-', ''); }
  function aInput(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
  function fechaTxt(f) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(f || '')); return m ? m[3] + '-' + m[2] + '-' + m[1] : String(f || ''); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function puedeVer(s) { return !!s && (s.esMaster === true || s.rol === 'master' || s.rol === 'contable'); }
  /** Rango por defecto: los 36 meses que terminan el mes anterior a hoy. */
  function rangoPorDefecto(hoy) {
    var h = new Date((hoy || new Date()).getFullYear(), (hoy || new Date()).getMonth() - 1, 1);
    var d = new Date(h.getFullYear(), h.getMonth() - 35, 1);
    return { desde: aInput(d), hasta: aInput(h) };
  }

  function rpc(nombre, cuerpo) {
    var f = typeof raiz.sbFetch === 'function' ? raiz.sbFetch : null;
    if (!f) return Promise.reject({ codigo: 'SIN_SESION', mensaje: 'Tu sesión no está lista. Recarga la página.' });
    return f('rpc/' + nombre, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) }).then(function (r) {
      return r.text().then(function (t) {
        var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { /* */ }
        if (!r.ok) throw { status: r.status, codigo: (j && j.code) || '', mensaje: (j && j.message) || '' };
        return j;
      });
    });
  }
  function estadoDe(m) {
    var e = ESTADOS[m.estado] || ESTADOS.sin_datos;
    if (m.estado === 'calza' && m.calce === 'dentro_tolerancia') return { t: 'Calza (±$100)', c: 'ver' };
    return e;
  }
  function mensajeError(e) {
    var c = e && e.codigo, m = (e && e.mensaje) || '';
    if (c === '42501') return 'Solo el Master o el analista contable asignado a esta empresa pueden ver el levantamiento.';
    if (c === 'PGRST202' || c === '42883' || (e && e.status === 404)) return 'El levantamiento aún no está instalado en el servidor.';
    if (/RANGO_MAXIMO/.test(m)) return 'El rango máximo es de 60 meses.';
    if (/RANGO_INVALIDO|PERIODO_INVALIDO/.test(m)) return 'Revisa el rango: «desde» debe ser anterior o igual a «hasta».';
    if (/PERIODO_FUTURO/.test(m)) return 'No se puede pedir historial de meses futuros.';
    if (/SIN_CONEXION_SII|CONEXION_NO_ACTIVA/.test(m)) return 'La empresa no está conectada con el SII: conéctala primero.';
    if (/LIMITE_DIARIO/.test(m)) return 'Ya se pidió historial 3 veces hoy para esta empresa. Intenta mañana.';
    if (c === 'SIN_SESION' || /GESTOOR_NO_SESSION/.test(m)) return 'Tu sesión venció. Vuelve a ingresar.';
    return 'No pudimos calcular ahora. Intenta de nuevo en un momento.';
  }

  // ── Estilos (tema noche de Gestoor) ──
  function estilos() {
    if (doc.getElementById('liva-css')) return;
    var s = el('style'); s.id = 'liva-css';
    s.textContent = [
      '.liva-btn{display:inline-flex;align-items:center;gap:8px;min-height:40px;padding:0 16px;border-radius:999px;font-weight:700;font-size:13px;cursor:pointer;border:1.5px solid transparent;background:linear-gradient(160deg,#A4599C,#803889);color:#fff}',
      '.liva-btn.sec{background:transparent;border-color:#6B4672;color:#F3E9F4}.liva-btn[disabled]{opacity:.55;cursor:not-allowed}',
      '.liva-btn .g-ic{width:16px;height:16px}.liva-btn .ic{display:inline-flex;line-height:0}',
      '.liva-ficha{margin-top:14px;display:flex;align-items:center;gap:10px;flex-wrap:wrap}.liva-ficha small{color:#C9A8CC;font-size:12px}',
      '.liva-velo{position:fixed;inset:0;z-index:420;background:rgba(12,7,14,.82);display:flex;align-items:flex-start;justify-content:center;padding:16px;overflow:auto}',
      '.liva-caja{width:1180px;max-width:100%;background:#1E1222;color:#F2EAF4;border:1px solid #3A2140;border-radius:18px;padding:18px 20px;box-shadow:0 30px 80px rgba(0,0,0,.6)}',
      '.liva-cab{display:flex;align-items:center;gap:10px}.liva-cab h3{margin:0;flex:1;font:800 17px var(--g-titulo,Montserrat,sans-serif)}.liva-cab h3 span{color:#E39BE5;font-weight:700;font-size:13px;display:block;margin-top:2px}',
      '.liva-x{width:38px;height:38px;border-radius:999px;border:0;background:rgba(255,255,255,.12);color:#fff;font-size:18px;cursor:pointer}',
      '.liva-ctl{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;margin-top:14px}.liva-ctl label{display:flex;flex-direction:column;gap:4px;font-size:11px;color:#C9A8CC;letter-spacing:.3px}',
      '.liva-ctl input{min-height:38px;border-radius:10px;border:1px solid #4A2B50;background:#140B17;color:#F3E9F4;padding:0 10px;font:inherit;font-size:13px}',
      '.liva-ctl .chk{flex-direction:row;align-items:center;gap:6px;font-size:12.5px;color:#E9DCEB;min-height:38px}',
      '.liva-msg{margin-top:12px;font-size:12.5px;line-height:1.45;padding:8px 12px;border-radius:10px;border:1px solid #3A2140;background:rgba(12,7,14,.35)}',
      '.liva-msg.roj{color:#FF8A7A;border-color:rgba(255,138,122,.55)}.liva-msg.amb{color:#FFC85A;border-color:rgba(255,200,90,.45)}.liva-msg.ver{color:#46D69A;border-color:rgba(70,214,154,.4)}',
      '.liva-res{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-top:14px}',
      '.liva-dato{background:rgba(12,7,14,.35);border:1px solid #3A2140;border-radius:12px;padding:8px 10px}.liva-dato .l{font-size:10px;letter-spacing:.5px;text-transform:uppercase;color:#C9A8CC}',
      '.liva-dato .v{font-size:15px;font-weight:800;font-variant-numeric:tabular-nums;margin-top:2px}.liva-dato.roj .v{color:#FF8A7A}.liva-dato.ver .v{color:#46D69A}.liva-dato.amb .v{color:#FFC85A}',
      '.liva-tw{margin-top:14px;overflow:auto;border:1px solid #3A2140;border-radius:12px}',
      '.liva-t{width:100%;border-collapse:collapse;font-size:12px;font-variant-numeric:tabular-nums}',
      '.liva-t th{position:sticky;top:0;background:#2A1430;color:#C9A8CC;font-size:10.5px;text-transform:uppercase;letter-spacing:.4px;text-align:right;padding:7px 8px;white-space:nowrap}',
      '.liva-t th:first-child,.liva-t th:nth-child(2){text-align:left}',
      '.liva-t td{padding:6px 8px;border-top:1px solid #33203A;text-align:right;white-space:nowrap}.liva-t td:first-child,.liva-t td:nth-child(2){text-align:left}',
      '.liva-t tr.fila{cursor:pointer}.liva-t tr.fila:hover td{background:rgba(255,255,255,.03)}',
      '.liva-t tr.ver td:first-child{box-shadow:inset 3px 0 #46D69A}.liva-t tr.roj td:first-child{box-shadow:inset 3px 0 #FF8A7A}.liva-t tr.amb td:first-child{box-shadow:inset 3px 0 #FFC85A}.liva-t tr.gris td{color:#9a849b}',
      '.liva-chip{display:inline-block;padding:2px 9px;border-radius:999px;font-size:11px;font-weight:700}',
      '.liva-chip.ver{background:rgba(70,214,154,.16);color:#46D69A}.liva-chip.roj{background:rgba(255,138,122,.16);color:#FF8A7A}.liva-chip.amb{background:rgba(255,200,90,.16);color:#FFC85A}.liva-chip.gris{background:rgba(201,168,204,.12);color:#C9A8CC}',
      '.liva-t td.dif{font-weight:800}.liva-t td.dif.roj{color:#FF8A7A}.liva-t td.dif.amb{color:#FFC85A}.liva-t td .al{color:#FFC85A;font-weight:700;margin-left:4px}',
      '.liva-t tr.det td{text-align:left;white-space:normal;background:rgba(12,7,14,.4);color:#E9DCEB;font-size:12px;line-height:1.5}',
      '.liva-t tr.det ul{margin:4px 0 0;padding-left:18px}.liva-t tr.det .cods{color:#C9A8CC;font-size:11px;margin-top:6px}',
      '.liva-chip.cond{margin-left:4px;background:transparent;border:1px dashed #FFC85A;color:#FFC85A}.liva-t td.prov{color:#FFC85A}',
      '.liva-ctl select{min-height:38px;border-radius:10px;border:1px solid #4A2B50;background:#140B17;color:#F3E9F4;padding:0 10px;font:inherit;font-size:13px}',
      '.liva-aviso{margin-top:12px;font-size:11.5px;color:#FFC85A;line-height:1.5}',
      '.liva-sup{margin:6px 0 0;padding-left:18px;font-size:11.5px;color:#C9A8CC;line-height:1.5}',
      '.liva-f29{margin-top:10px;font-size:11.5px;color:#FFC85A;line-height:1.5}',
      '.liva-t td.orig{text-align:left;color:#C9A8CC;font-size:11.5px}'
    ].join('\n');
    doc.head.appendChild(s);
  }

  // ── Botón en la ficha ──
  function montar(cont, cliente, sesion) {
    if (!cont) return;
    cont.textContent = '';
    if (!cliente || !(Number(cliente.id) > 0) || !puedeVer(sesion)) return;
    estilos();
    var w = el('div', 'liva-ficha');
    var b = el('button', 'liva-btn sec'); b.type = 'button'; b.id = 'liva-abrir';
    b.appendChild(icono('iva')); b.appendChild(doc.createTextNode('Levantamiento de IVA'));
    b.addEventListener('click', function () { abrir(cliente); });
    w.appendChild(b); w.appendChild(el('small', null, 'Cruce RCV del SII vs F29 declarado, mes a mes, para regularizaciones.'));
    cont.appendChild(w);
  }

  var vista = null;   // { velo, cliente, datos, seq }
  function cerrar() { if (vista && vista.velo) vista.velo.remove(); vista = null; doc.removeEventListener('keydown', alEsc); }
  function alEsc(ev) { if (ev.key === 'Escape') cerrar(); }

  function abrir(cliente) {
    cerrar(); estilos();
    var r = rangoPorDefecto();
    var velo = el('div', 'liva-velo'); velo.setAttribute('role', 'dialog'); velo.setAttribute('aria-modal', 'true'); velo.id = 'liva-velo';
    var caja = el('div', 'liva-caja'); velo.appendChild(caja);
    var cab = el('div', 'liva-cab'); var ic = el('span'); ic.appendChild(icono('iva')); cab.appendChild(ic);
    var h = el('h3', null, 'Levantamiento de IVA'); h.appendChild(el('span', null, (cliente.razon || 'Cliente') + (cliente.rut ? ' · ' + cliente.rut : '')));
    cab.appendChild(h);
    var x = el('button', 'liva-x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Cerrar'); x.addEventListener('click', cerrar); cab.appendChild(x);
    caja.appendChild(cab);

    var ctl = el('div', 'liva-ctl');
    function campo(etq, tipo, valor, id) { var l = el('label', null, etq); var i = el('input'); i.type = tipo; i.value = valor; i.id = id; l.appendChild(i); ctl.appendChild(l); return i; }
    var iDesde = campo('Desde', 'month', r.desde, 'liva-desde'), iHasta = campo('Hasta', 'month', r.hasta, 'liva-hasta');
    var hoy = new Date(); var iPago = campo('Fecha estimada de pago', 'date', hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0') + '-' + String(hoy.getDate()).padStart(2, '0'), 'liva-pago');
    var lm = el('label', null, 'Declaración'); var iMedio = el('select'); iMedio.id = 'liva-medio';
    [['internet', 'Internet, facturador electrónico (día 20)'], ['papel', 'Papel (día 12)']].forEach(function (o) { var op = el('option', null, o[1]); op.value = o[0]; iMedio.appendChild(op); });
    lm.appendChild(iMedio); ctl.appendChild(lm);
    var lf = el('label', 'chk'); var iFisc = el('input'); iFisc.type = 'checkbox'; iFisc.id = 'liva-fisc'; lf.appendChild(iFisc); lf.appendChild(doc.createTextNode('Detectado en fiscalización')); ctl.appendChild(lf);
    function boton(txt, ico, id, sec) { var b = el('button', 'liva-btn' + (sec ? ' sec' : '')); b.type = 'button'; b.id = id; b.appendChild(icono(ico)); b.appendChild(doc.createTextNode(txt)); ctl.appendChild(b); return b; }
    var bCalc = boton('Calcular', 'grafico', 'liva-calcular');
    var bHist = boton('Pedir historial a Cartapra', 'repetir', 'liva-historial', true);
    var bPdf = boton('Exportar PDF', 'descargar', 'liva-pdf', true); bPdf.disabled = true;
    if (raiz.GestoorHistoriaSII) {   // CARTAPRA-HISTORIA: varios años de compras y ventas de una vez (abre su propio diálogo encima)
      var bHsii = boton('Historia SII', 'calendario', 'liva-historia-sii', true);
      bHsii.addEventListener('click', function () { raiz.GestoorHistoriaSII.abrir(cliente, { desde: iDesde.value, hasta: iHasta.value }); });
    }
    caja.appendChild(ctl);
    var avF29 = el('div', 'liva-f29', AVISO_F29 + ': los F29 más antiguos se muestran como «F29 sin montos» (con el IVA del RCV, sin comparar).'); avF29.id = 'liva-aviso-f29'; caja.appendChild(avF29);
    var msg = el('div', 'liva-msg', 'Elige el rango y presiona Calcular. Por defecto: los últimos 36 meses cerrados.'); msg.id = 'liva-msg'; caja.appendChild(msg);
    var res = el('div'); res.id = 'liva-res'; caja.appendChild(res);

    vista = { velo: velo, cliente: cliente, datos: null, seq: 0 };
    function aviso(t, c) { msg.className = 'liva-msg' + (c ? ' ' + c : ''); msg.textContent = t; }
    function opciones() { return { fecha_pago: iPago.value || undefined, medio: iMedio.value || 'internet', fiscalizacion: !!iFisc.checked }; }

    bCalc.addEventListener('click', function () {
      var s = ++vista.seq; bCalc.disabled = true; bPdf.disabled = true; aviso('Calculando…'); res.textContent = '';
      rpc('sii_levantamiento_iva', { p_cliente_id: Number(cliente.id), p_desde: aAAAAMM(iDesde.value), p_hasta: aAAAAMM(iHasta.value), p_opciones: opciones() })
        .then(function (d) {
          if (!vista || s !== vista.seq) return;
          vista.datos = d; bCalc.disabled = false; bPdf.disabled = false;
          pintar(res, d); aviso(textoResumen(d), claseResumen(d));
          pintarOrigenes(s, d);
        })
        .catch(function (e) { if (!vista || s !== vista.seq) return; bCalc.disabled = false; aviso(mensajeError(e), 'roj'); });
    });
    // Origen por mes (solo metadatos). Si la RPC no está o falla, la columna queda «—» (no afecta el cálculo).
    function pintarOrigenes(s, d) {
      rpc('sii_historia_origenes', { p_cliente_id: Number(cliente.id), p_desde: d.desde, p_hasta: d.hasta })
        .then(function (o) { if (!vista || s !== vista.seq) return; var m = {}; ((o && o.meses) || []).forEach(function (x) { m[x.periodo] = x; }); vista.origenes = m; llenar(m); })
        .catch(function () { if (!vista || s !== vista.seq) return; vista.origenes = null; llenar({}); });
      function llenar(m) {
        Array.prototype.forEach.call(doc.querySelectorAll('#liva-tabla tr.fila'), function (f) {
          var td = f.querySelector('td.orig'); if (td) td.textContent = origenTxt(m[f.getAttribute('data-periodo')]);
        });
      }
    }
    bHist.addEventListener('click', function () {
      bHist.disabled = true; aviso('Pidiendo a Cartapra lo que falta…');
      rpc('sii_levantamiento_pedir_historial', { p_cliente_id: Number(cliente.id), p_desde: aAAAAMM(iDesde.value), p_hasta: aAAAAMM(iHasta.value) })
        .then(function (j) {
          bHist.disabled = false;
          var om = j && Number(j.omitidos_no_disponibles) > 0 ? ' (' + j.omitidos_no_disponibles + ' lecturas no se repiten: Cartapra ya respondió que no las tiene)' : '';
          if (j && j.estado === 'encolado') aviso('Listo: se pidieron ' + j.lecturas + ' lecturas a Cartapra' + om + '. Empiezan en unos 5 minutos y toman cerca de ' + j.minutos_estimados + ' min. Te avisaremos en la campana cuando termine.', 'ver');
          else if (j && j.estado === 'ya_pedido') aviso('Ya hay un pedido de historial en curso para esta empresa. Te avisaremos en la campana cuando termine.', 'amb');
          else aviso('No falta nada que pedir para ese rango' + om + ': lo que sigue sin datos, Cartapra no lo tiene.', 'amb');
        })
        .catch(function (e) { bHist.disabled = false; aviso(mensajeError(e), 'roj'); });
    });
    // PDF: primero queda en la bitácora (quién y cuándo); si no se puede registrar, no se exporta (fail-closed).
    bPdf.addEventListener('click', function () {
      if (!vista || !vista.datos) return;
      var d = vista.datos; bPdf.disabled = true;
      rpc('sii_levantamiento_registrar_pdf', { p_cliente_id: Number(cliente.id), p_desde: d.desde, p_hasta: d.hasta })
        .then(function () { bPdf.disabled = false; imprimir(d, cliente); })
        .catch(function (e) { bPdf.disabled = false; aviso(mensajeError(e), 'roj'); });
    });
    velo.addEventListener('click', function (ev) { if (ev.target === velo) cerrar(); });
    doc.addEventListener('keydown', alEsc);
    doc.body.appendChild(velo);
  }

  function contar(d, e) { return Number((d && d.totales && d.totales.por_estado && d.totales.por_estado[e]) || 0); }
  function nm(n) { return n + (Number(n) === 1 ? ' mes' : ' meses'); }
  function nProv(d) { return contar(d, 'coincidencia_provisional') + contar(d, 'diferencia_preliminar') + contar(d, 'revisar_arrastre'); }
  function textoResumen(d) {
    var comp = contar(d, 'calza') + contar(d, 'diferencia') + contar(d, 'a_favor') + nProv(d);
    var t = contar(d, 'calza') + ' de ' + comp + ' meses comparables calzan';
    if (contar(d, 'diferencia') + contar(d, 'no_declarado')) t += ' · ' + (contar(d, 'diferencia') + contar(d, 'no_declarado')) + ' con diferencia a pagar';
    if (nProv(d)) t += ' · ' + nProv(d) + ' provisionales por revisar';
    if (d.totales && Number(d.totales.condicionados) > 0) t += ' · ' + d.totales.condicionados + ' condicionados (remanente supuesto)';
    if (contar(d, 'f29_sin_montos')) t += ' · ' + contar(d, 'f29_sin_montos') + ' con F29 sin montos';
    if (contar(d, 'sin_datos')) t += ' · ' + contar(d, 'sin_datos') + ' sin datos (puedes pedir el historial a Cartapra)';
    if (d.historial && (d.historial.estado === 'pendiente' || d.historial.estado === 'en_curso' || d.historial.estado === 'reintento'))
      t += ' · Pedido a Cartapra en curso: ' + d.historial.pendientes + ' lecturas pendientes';
    return t + '.';
  }
  function claseResumen(d) { return contar(d, 'diferencia') + contar(d, 'no_declarado') > 0 ? 'roj' : contar(d, 'sin_datos') + contar(d, 'f29_sin_montos') + nProv(d) > 0 ? 'amb' : 'ver'; }
  /** Totales V2: nunca se fabrica un total con lo que falta. */
  function totales(e) {
    var k = e.conocido || {}, p = e.provisional || {}, x = e.no_calculable || {};
    return {
      total: e.total == null ? (e.total_no_calculable ? 'No calculable' : (num(e.total_provisional) != null ? pesos(e.total_provisional) + ' (provisional)' : '—')) : pesos(e.total),
      clase: e.total == null ? 'amb' : num(e.total) > 0 ? 'roj' : 'ver',
      conocido: pesos(k.total), nConocido: Number(k.meses || 0),
      provisional: pesos(p.total), nProv: Number(p.meses || 0),
      nPend: Number(x.meses || 0), pend: (x.componentes_pendientes || []).join(', '), impPend: pesos(x.impuesto)
    };
  }
  function estimadoMes(m) {
    var es = m.estimacion; if (!es) return { t: '—', c: '' };
    if (es.total == null) return { t: 'No calculable', c: 'prov' };
    return { t: pesos(es.total) + (CALIDAD[es.calidad] || ''), c: es.calidad === 'completa' ? '' : 'prov' };
  }
  function detalleEstimacion(es) {
    var t = 'Vence ' + fechaTxt(es.vencimiento) + ' · ' + es.meses_atraso + ' meses de atraso · impuesto ' + pesos(es.impuesto) +
      ' · reajuste ' + (es.reajuste == null ? 'pendiente (falta UTM)' : pesos(es.reajuste)) +
      ' · intereses ' + (es.intereses == null ? 'pendientes (falta tasa' + ((es.semestres_sin_tasa || []).length ? ' ' + es.semestres_sin_tasa.join(', ') : '') + ')' : pesos(es.intereses) + (es.intereses_estado === 'provisional_sin_reajuste' ? ' (provisional)' : '')) +
      ' · multa ' + Math.round(Number(es.multa_pct) * 100) + ' % = ' + pesos(es.multa) + (es.multa_estado === 'provisional_sin_reajuste' ? ' (provisional)' : '');
    var tr = (es.intereses_tramos || []).map(function (x) { return x.regla === 'mensual' ? x.meses + ' mes(es) al ' + String(x.tasa_pct).replace('.', ',') + ' %' : x.dias + ' días al ' + String(x.tasa_pct).replace('.', ',') + ' % diario'; });
    if (tr.length) t += ' · tramos: ' + tr.join(' + ');
    return t + ' · ' + (es.calidad === 'completa' ? 'estimación completa' : es.calidad === 'provisional' ? 'estimación provisional' : 'total no calculable');
  }

  function dato(cont, etq, v, cls) { var b = el('div', 'liva-dato' + (cls ? ' ' + cls : '')); b.appendChild(el('div', 'l', etq)); b.appendChild(el('div', 'v', v)); cont.appendChild(b); }

  function pintar(cont, d) {
    cont.textContent = '';
    var e = d.estimacion || {};
    var g = el('div', 'liva-res');
    dato(g, 'Meses que calzan', contar(d, 'calza') + ' / ' + (d.meses || []).length, 'ver');
    dato(g, 'Con diferencia', String(contar(d, 'diferencia') + contar(d, 'no_declarado')), contar(d, 'diferencia') + contar(d, 'no_declarado') ? 'roj' : null);
    dato(g, 'Sin datos', String(contar(d, 'sin_datos')), contar(d, 'sin_datos') ? 'amb' : null);
    if (nProv(d)) dato(g, 'Provisionales', String(nProv(d)), 'amb');
    if (d.totales && Number(d.totales.condicionados) > 0) dato(g, 'Condicionados', String(d.totales.condicionados), 'amb');
    var T = totales(e);
    dato(g, 'Diferencia de impuesto', pesos(e.impuesto), num(e.impuesto) > 0 ? 'roj' : null);
    dato(g, 'Subtotal conocido (' + nm(T.nConocido) + ')', T.conocido, null);
    if (T.nProv) dato(g, 'Provisional (' + nm(T.nProv) + ')', T.provisional, 'amb');
    if (T.nPend) dato(g, 'Sin calcular (' + nm(T.nPend) + ')', 'Falta: ' + (T.pend || '—'), 'amb');
    dato(g, 'Total estimado', T.total, T.clase);
    if (num(e.posible_a_favor) > 0) dato(g, 'Posible a favor', pesos(e.posible_a_favor), 'amb');
    cont.appendChild(g);

    var tw = el('div', 'liva-tw'), t = el('table', 'liva-t'); t.id = 'liva-tabla';
    var th = el('thead'), tr = el('tr');
    ['Mes', 'Estado', 'IVA ventas RCV', 'Débito F29', 'IVA compras RCV', 'Crédito F29', 'Rem. anterior', 'IVA declarado', 'IVA recalculado', 'Diferencia', 'Estimado a pagar', 'Origen']
      .forEach(function (x) { tr.appendChild(el('th', null, x)); });
    th.appendChild(tr); t.appendChild(th);
    var tb = el('tbody');
    (d.meses || []).forEach(function (m) {
      var est = estadoDe(m);
      var f = el('tr', 'fila ' + est.c); f.setAttribute('data-periodo', m.periodo); f.setAttribute('data-estado', m.estado);
      if (m.condicionado) f.setAttribute('data-condicionado', '1');
      var c0 = el('td', null, mesTxt(m.periodo)); if ((m.alertas || []).length) c0.appendChild(el('span', 'al', '!'));
      f.appendChild(c0);
      var c1 = el('td'); c1.appendChild(el('span', 'liva-chip ' + est.c, est.t));
      if (m.condicionado) c1.appendChild(el('span', 'liva-chip cond', 'Condicionado'));
      f.appendChild(c1);
      var deb = m.debito || {}, cre = m.credito || {}, rem = m.remanente || {}, iva = m.iva || {};
      [deb.rcv, deb.declarado, cre.rcv, cre.declarado_documentos].forEach(function (v) { f.appendChild(el('td', null, pesos(v))); });
      f.appendChild(el('td', rem.anterior_supuesto != null ? 'prov' : null, rem.anterior_recalculado == null ? (rem.anterior_supuesto != null ? 'Desconocido (supuesto ' + pesos(rem.anterior_supuesto) + ')' : '—') : pesos(rem.anterior_recalculado) + (rem.anterior_declarado != null && Math.abs(rem.anterior_recalculado - rem.anterior_declarado) > 0 ? ' (decl. ' + pesos(rem.anterior_declarado) + ')' : '')));
      f.appendChild(el('td', null, pesos(iva.declarado))); f.appendChild(el('td', null, pesos(iva.recalculado)));
      var cd = el('td', 'dif' + (num(iva.diferencia) > 0 ? ' roj' : num(iva.diferencia) < 0 ? ' amb' : ''), pesos(iva.diferencia)); f.appendChild(cd);
      var em = estimadoMes(m); f.appendChild(el('td', em.c || null, em.t));
      f.appendChild(el('td', 'orig', '…'));   // se llena con sii_historia_origenes
      tb.appendChild(f);
      var det = el('tr', 'det'); det.hidden = true; var dc = el('td'); dc.colSpan = 12; det.appendChild(dc);
      if (m.motivo && MOTIVOS[m.motivo]) dc.appendChild(el('div', null, MOTIVOS[m.motivo]));
      var ul = el('ul'); (m.alertas || []).forEach(function (a) { ul.appendChild(el('li', null, ALERTAS[a] || a)); });
      if (ul.childNodes.length) dc.appendChild(ul);
      if (m.calce === 'dentro_tolerancia') dc.appendChild(el('div', null, 'Calza dentro de la tolerancia de $100: diferencia exacta de IVA ' + pesos(iva.diferencia) + '.'));
      if (m.estimacion) dc.appendChild(el('div', null, detalleEstimacion(m.estimacion)));
      if (m.f29 && m.f29.codigos) dc.appendChild(el('div', 'cods', 'F29 folio ' + m.f29.folio + ' · ' + Object.keys(m.f29.codigos).map(function (k) { return 'cód. ' + k + ': ' + pesos(m.f29.codigos[k]); }).join(' · ')));
      if (!dc.childNodes.length) dc.appendChild(el('div', null, 'Sin observaciones.'));
      tb.appendChild(det);
      f.addEventListener('click', function () { det.hidden = !det.hidden; });
    });
    t.appendChild(tb); tw.appendChild(t); cont.appendChild(tw);
    cont.appendChild(el('div', 'liva-aviso', (e.aviso || 'Estimación preliminar, verificar.') + ' Haz clic en un mes para ver sus alertas.'));
    if (d.totales && d.totales.dentro_tolerancia && Number(d.totales.dentro_tolerancia.meses) > 0)
      cont.appendChild(el('div', 'liva-aviso', d.totales.dentro_tolerancia.meses + ' meses calzan dentro de la tolerancia de $100 (diferencia acumulada de IVA ' + pesos(d.totales.dentro_tolerancia.iva_acumulado) + ').'));
    var ul = el('ul', 'liva-sup'); (e.supuestos || []).forEach(function (s) { ul.appendChild(el('li', null, s)); }); cont.appendChild(ul);
  }

  // ── PDF de marca (documento propio en iframe oculto; fondo claro, franja morada con el logo blanco) ──
  function htmlPdf(d, cliente, logoUrl) {
    var e = d.estimacion || {};
    var filas = (d.meses || []).map(function (m) {
      var est = estadoDe(m), iva = m.iva || {}, deb = m.debito || {}, cre = m.credito || {};
      return '<tr class="' + est.c + '"><td>' + esc(mesTxt(m.periodo)) + '</td><td><span class="chip ' + est.c + '">' + esc(est.t) + '</span>' + (m.condicionado ? ' <span class="chip amb">Condicionado</span>' : '') + '</td><td>' + esc(pesos(deb.rcv)) + '</td><td>' + esc(pesos(deb.declarado)) +
        '</td><td>' + esc(pesos(cre.rcv)) + '</td><td>' + esc(pesos(cre.declarado_documentos)) + '</td><td>' + esc(pesos(iva.declarado)) + '</td><td>' + esc(pesos(iva.recalculado)) +
        '</td><td class="b">' + esc(pesos(iva.diferencia)) + '</td><td class="b">' + esc(estimadoMes(m).t) + '</td></tr>';
    }).join('');
    var tarjeta = function (l, v, c) { return '<div class="k ' + (c || '') + '"><div class="l">' + esc(l) + '</div><div class="v">' + esc(v) + '</div></div>'; };
    var hoy = new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' });
    var T = totales(e);
    return '<div class="hd"><img src="' + esc(logoUrl) + '" alt="Contadoor"><div><h1>Levantamiento de IVA</h1><p>' + esc(cliente.razon || '') + (cliente.rut ? ' · RUT ' + esc(cliente.rut) : '') + '</p></div></div>' +
      '<div class="cuerpo"><p class="prel">Estimación preliminar, no constituye determinación definitiva</p><p class="sub">Período revisado: <b>' + esc(mesTxt(d.desde)) + ' a ' + esc(mesTxt(d.hasta)) + '</b> · Emitido el ' + esc(hoy) + ' · Fuente: Registro de Compras y Ventas y Formularios 29 del SII.</p>' +
      '<div class="ks">' + tarjeta('Meses revisados', String((d.meses || []).length)) + tarjeta('Meses que calzan', String(contar(d, 'calza')), 'ver') +
      tarjeta('Meses con diferencia', String(contar(d, 'diferencia') + contar(d, 'no_declarado')), 'roj') + tarjeta('Provisionales', String(nProv(d))) +
      tarjeta('Sin datos / F29 sin montos', String(contar(d, 'sin_datos') + contar(d, 'f29_sin_montos'))) + '</div>' +
      '<h2>Estimación si se rectifica</h2><div class="ks">' + tarjeta('Diferencia de impuesto', pesos(e.impuesto)) +
      tarjeta('Subtotal conocido (' + nm(T.nConocido) + ')', T.conocido) + (T.nProv ? tarjeta('Provisional (' + nm(T.nProv) + ')', T.provisional) : '') +
      (T.nPend ? tarjeta('Sin calcular (' + nm(T.nPend) + ')', 'Falta: ' + (T.pend || '—')) : '') + tarjeta('Total estimado', T.total, 'mor') + '</div>' +
      '<p class="av">ESTIMACIÓN PRELIMINAR, VERIFICAR: no constituye determinación definitiva. Montos calculados para un pago el ' + esc(fechaTxt(d.opciones && d.opciones.fecha_pago)) + '; el monto definitivo lo determina el SII/Tesorería al momento del pago y puede variar por reajustes, condonaciones u otros antecedentes. ' +
      'Esta estimación no incluye el costo de nuestros servicios de regularización, que se informa en la propuesta.</p>' +
      '<h2>Detalle mes a mes</h2><table><thead><tr><th>Mes</th><th>Estado</th><th>IVA ventas SII</th><th>Débito declarado</th><th>IVA compras SII</th><th>Crédito declarado</th><th>IVA declarado</th><th>IVA recalculado</th><th>Diferencia</th><th>Estimado</th></tr></thead><tbody>' + filas + '</tbody></table>' +
      '<h2>Supuestos</h2><ul>' + (e.supuestos || []).map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') +
      '<li>«Sin datos» significa que aún no tenemos la información del SII de ese mes; no se considera cero. «Sin declaración encontrada»: no se encontró declaración en los antecedentes disponibles.</li>' +
      '<li>' + esc(AVISO_F29) + ': los F29 más antiguos figuran como «F29 sin montos» (se muestra el IVA del RCV, sin comparar).</li>' +
      '<li>«Provisional» y «Condicionado»: el mes depende de información incompleta o de un supuesto (por ejemplo, remanente inicial desconocido tomado como 0); su monto no se suma al subtotal conocido.</li></ul>' +
      '<div class="pie">Asesorías Contadoor Ltda. · contadoor.cl</div></div>';
  }
  var CSS_PDF = '@page{size:A4 landscape;margin:8mm}*{-webkit-print-color-adjust:exact;print-color-adjust:exact;box-sizing:border-box}' +
    'body{margin:0;font-family:Inter,Arial,sans-serif;color:#2A1430;font-size:10.5px;background:#fff}' +
    '.hd{display:flex;align-items:center;gap:18px;background:' + MORADO + ';color:#fff;padding:14px 20px;border-radius:12px}.hd img{height:34px}' +
    '.hd h1{margin:0;font:800 20px Montserrat,Arial,sans-serif}.hd p{margin:2px 0 0;font-size:12px;opacity:.92}' +
    '.cuerpo{padding:8px 4px}.sub{color:#5B4560;margin:8px 0 10px}h2{font:800 13px Montserrat,Arial,sans-serif;color:' + MORADO + ';margin:14px 0 6px}' +
    '.ks{display:flex;gap:8px;flex-wrap:wrap}.k{flex:1;min-width:120px;border:1px solid #E7D6EA;border-radius:10px;padding:7px 10px;break-inside:avoid}.k .l{font-size:8.5px;text-transform:uppercase;letter-spacing:.4px;color:#7A6080}' +
    '.k .v{font:800 14px Montserrat,Arial,sans-serif;margin-top:2px}.k.ver .v{color:#28865B}.k.roj .v{color:#D34433}.k.mor{background:#F6ECF6;border-color:' + MORADO + '}.k.mor .v{color:' + MORADO + '}' +
    '.prel{margin:10px 0 0;padding:8px 12px;border:2px solid #D34433;border-radius:8px;color:#D34433;font:800 12.5px Montserrat,Arial,sans-serif;text-transform:uppercase;letter-spacing:.3px;text-align:center}' +
    '.av{margin:8px 0 0;padding:7px 10px;border-radius:8px;background:#FFF6E0;color:#7A5200;font-size:9.5px;line-height:1.45}' +
    'table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}th{background:#F6ECF6;color:#5B4560;font-size:8.5px;text-transform:uppercase;text-align:right;padding:5px 6px}' +
    'td{padding:4px 6px;border-top:1px solid #EFE3F1;text-align:right}th:nth-child(-n+2),td:nth-child(-n+2){text-align:left}tr{break-inside:avoid}td.b{font-weight:700}' +
    'tr.roj td.b{color:#D34433}tr.gris td{color:#9A8A9C}.chip{display:inline-block;padding:1px 7px;border-radius:999px;font-size:8.5px;font-weight:700}' +
    '.chip.ver{background:#E3F4EC;color:#28865B}.chip.roj{background:#FBE4E1;color:#D34433}.chip.amb{background:#FFF1D6;color:#8A5A00}.chip.gris{background:#F0ECF1;color:#7A6E7C}' +
    'ul{margin:4px 0;padding-left:16px;line-height:1.5;color:#5B4560}.pie{margin-top:12px;color:#9A8A9C;font-size:9px;text-align:right}';
  function documentoPdf(d, cliente, logoUrl) {
    var limpio = function (t) { return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 50); };
    var titulo = ['Levantamiento_IVA', limpio(cliente.razon) || 'cliente', d.desde + '-' + d.hasta].join('_');
    return '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>' + esc(titulo) + '</title>' +
      '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Montserrat:wght@700;800&display=swap" rel="stylesheet"><style>' + CSS_PDF + '</style></head><body>' +
      htmlPdf(d, cliente, logoUrl) + '</body></html>';
  }
  function imprimir(d, cliente) {
    var previo = doc.getElementById('liva-pdf-frame'); if (previo) previo.remove();
    var f = doc.createElement('iframe'); f.id = 'liva-pdf-frame'; f.setAttribute('aria-hidden', 'true');
    f.style.cssText = 'position:fixed;right:0;bottom:0;width:1100px;height:800px;border:0;opacity:0;pointer-events:none;z-index:-1';
    f.onload = function () {
      var w = f.contentWindow, dd = f.contentDocument;
      var imgs = Array.prototype.slice.call(dd.images || []);
      var esp = Promise.all(imgs.map(function (im) { return im.complete ? 1 : new Promise(function (r) { im.onload = im.onerror = r; }); }));
      Promise.race([Promise.all([esp, dd.fonts && dd.fonts.ready ? dd.fonts.ready : 1]), new Promise(function (r) { setTimeout(r, 4000); })])
        .then(function () { try { w.focus(); w.print(); } catch (e) { /* */ } });
    };
    f.srcdoc = documentoPdf(d, cliente, new URL('../assets/logo-blanco.png', raiz.location.href).href);
    doc.body.appendChild(f);
  }

  raiz.GestoorLevIVA = { montar: montar, abrir: abrir, cerrar: cerrar, puedeVer: puedeVer, rangoPorDefecto: rangoPorDefecto, documentoPdf: documentoPdf, mensajeError: mensajeError, origenTxt: origenTxt, ESTADOS: ESTADOS };
})(window);
