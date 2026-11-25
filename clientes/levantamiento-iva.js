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
     Historia SII; si no está instalada, «—»).
   · DETALLE + BORRADOR F29 (24-11-2026, levantamiento-detalle.js): doble clic o lupa en un mes → documentos del RCV por tipo y
     comparación por código; «Exportar Excel» (.xlsx con marca) y «Borradores F29» (PDF de los meses a rectificar). Cartapra ya
     entrega montos de TODOS los F29: se quitó el aviso fijo que limitaba los folios con montos.
   · SI RECTIFICAMOS TODO (25-11-2026, levantamiento-rectificar.js): botón que abre el escenario de rectificar todo el rango en
     cadena (RPC public.sii_levantamiento_rectificar_todo). Campo «Otros cargos / multa adicional» (monto + motivo obligatorio,
     ingresado a mano por el analista): se suma al total del levantamiento y del escenario, rotulado «ingresado a mano», y va en
     el PDF y el Excel. NO se guarda en la base (solo vista y exportes): no existe hoy una tabla del levantamiento para eso.
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
    revisar_arrastre: { t: 'Revisar arrastre', c: 'amb' }, f29_sin_montos: { t: 'F29 sin montos', c: 'gris' },
    solo_f29: { t: 'Solo F29 · falta RCV', c: 'amb' }, no_declarado_sin_rcv: { t: 'Sin F29 ni RCV', c: 'roj' }
  };
  var MOTIVOS = {
    sin_rcv: 'Faltan las compras y ventas del SII de este mes (pide el historial a Cartapra).',
    no_disponible_cartapra: 'Cartapra no tiene las compras y ventas de este mes (respondió «no disponible»). No significa que no hubo movimiento.',
    f29_sin_montos: 'El F29 está declarado pero aún no tenemos sus montos (pide el historial a Cartapra). Se muestra el IVA del RCV, sin comparar.',
    f29_sin_montos_cartapra: 'F29 sin montos en Cartapra: el F29 está declarado, pero Cartapra no entrega sus montos para este mes. Se muestra el IVA del RCV, sin comparar.',
    sin_declaracion_en_antecedentes: 'No se encontró declaración en los antecedentes disponibles.',
    sin_conexion: 'La empresa no está conectada con el SII.',
    solo_f29: 'Faltan las compras y ventas del SII de este mes: se recalculó con lo declarado en el F29 (cód. 538 y 537) y el remanente encadenado. Solo puede cambiar el arrastre.',
    solo_f29_cartapra: 'Cartapra no tiene las compras y ventas de este mes: se recalculó con lo declarado en el F29 (cód. 538 y 537) y el remanente encadenado. Solo puede cambiar el arrastre.',
    sin_f29_ni_rcv: 'No hay F29 presentado ni compras y ventas del SII de este mes, y la empresa tenía F29 antes y después: F29 no presentado. El remanente pasa con el supuesto «sin movimiento».'
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
    feriados_no_cargados: 'No hay feriados cargados para ese año: solo se consideraron fines de semana.',
    factura_compra_recibida: 'Facturas de compra recibidas (DTE 46): el IVA retenido por el comprador no va al débito (cód. 515/587; con retención parcial solo la parte no retenida, cód. 517).',
    factura_compra_emitida: 'Facturas de compra emitidas (agente retenedor): su IVA es crédito (cód. 520) y lo retenido se declara en los cód. 39/554.',
    nc_nd_factura_compra_inferida: 'Notas de crédito/débito sobre facturas de compra identificadas por su monto (el RCV no trae la referencia): revisar.',
    retencion_sin_detalle: 'Sin detalle de documentos del Registro de Ventas: no se pudo separar el IVA retenido de facturas de compra.',
    retencion_cambio_sujeto_distinta: 'La retención de cambio de sujeto declarada (cód. 515/587/517/720 o 39/554) no calza con el RCV: revisar (informativo, no suma al IVA).',
    debito_incluye_iva_retenido: 'El débito declarado (538) incluye IVA que el comprador retuvo totalmente: posible pago de más.',
    retencion_no_enterada: 'IVA retenido por cambio de sujeto según el RCV mayor que el declarado (cód. 39 + 554): diferencia a pagar aparte (art. 97 N°11).',
    prescripcion_3_anos_cumplida: 'Se cumplieron 3 años desde el vencimiento (art. 200 CT). Informativo: revisar con el analista.',
    mes_sin_datos_supuesto_sin_movimiento: 'Mes sin datos: el remanente pasa al mes siguiente con el supuesto «sin movimiento» (condiciona los meses siguientes).',
    multa_omision_97_1: 'F29 no presentado: multa art. 97 N°1 (de 1 UTM a 1 UTA). Se estima el mínimo, 1 UTM del mes de pago.',
    prescripcion_3_anos_proxima: 'Se cumplen 3 años desde el vencimiento dentro de 60 días (art. 200 CT). Informativo: revisar con el analista.'
  };
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
    // 20-11: «a_favor» no siempre es plata a favor del cliente. Si el remanente que se arrastra (77) quedó más alto que el
    // recalculado con el RCV, el cliente declaró de menos y lo absorbió el remanente: es un remanente sobredeclarado a corregir.
    if (m.estado === 'solo_f29') {
      var di = Number(m.iva && m.iva.diferencia), dr = Number(m.remanente && m.remanente.diferencia_siguiente);
      if (isFinite(di) && di > 100) return { t: 'Solo F29 · diferencia', c: 'roj' };
      if (isFinite(di) && di < -100) return { t: 'Solo F29 · a favor', c: 'ver' };
      if (isFinite(dr) && Math.abs(dr) > 100) return { t: 'Solo F29 · revisar arrastre', c: 'amb' };
      return { t: 'Solo F29 · calza', c: 'ver' };
    }
    if (m.estado === 'a_favor' || m.estado === 'revisar_arrastre') {
      var ds = Number(m.remanente && m.remanente.diferencia_siguiente);
      if (isFinite(ds) && ds < -100) return { t: 'Remanente sobredeclarado', c: 'amb' };
      if (m.estado === 'a_favor' && isFinite(ds) && ds > 100) return { t: 'A favor del cliente', c: 'ver' };
    }
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
      '.liva-t td.orig{text-align:left;color:#C9A8CC;font-size:11.5px}',
      // Separadores verticales sutiles entre columnas (encabezado un poco más marcado)
      '.liva-t th+th{border-left:1px solid rgba(201,168,204,.30)}.liva-t td+td{border-left:1px solid rgba(201,168,204,.18)}.liva-t tr.det td{border-left:0}',
      '.liva-tw{max-height:62vh}.liva-t thead th{z-index:2}.liva-t tfoot td{z-index:1;position:sticky;bottom:0;background:#2A1430;font-weight:800;border-top:2px solid #6B4672;color:#F3E9F4}',
      '.liva-t tfoot tr.est td{position:static;font-weight:600;font-size:11.5px;color:#E9DCEB;text-align:left;white-space:normal;border-top:1px solid #33203A}',
      '.liva-reg{margin-top:14px;display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:12px 16px;border-radius:14px;border:1.5px solid #924893;background:linear-gradient(160deg,rgba(146,72,147,.28),rgba(30,18,34,.6))}',
      '.liva-reg .l{font-size:12px;color:#E9DCEB;text-transform:uppercase;letter-spacing:.5px}.liva-reg .v{font:800 22px var(--g-titulo,Montserrat,sans-serif);color:#fff;font-variant-numeric:tabular-nums}.liva-reg small{color:#C9A8CC;font-size:12px}',
      '.liva-lupa{width:30px;height:30px;border-radius:8px;border:1px solid #4A2B50;background:transparent;color:#E39BE5;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;padding:0}',
      '.liva-lupa:hover,.liva-lupa:focus-visible{background:rgba(227,155,229,.12);outline:2px solid #E39BE5;outline-offset:1px}.liva-lupa .g-ic{width:15px;height:15px}.liva-t td.lupa{text-align:center}'
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
    var LD = raiz.GestoorLevDetalle, bXls = null, bBor = null;
    if (LD) {   // DETALLE + BORRADOR F29 (levantamiento-detalle.js)
      bXls = boton('Exportar Excel', 'descargar', 'liva-excel', true); bXls.disabled = true;
      bBor = boton('Borradores F29', 'factura', 'liva-borradores', true); bBor.disabled = true;
      bXls.addEventListener('click', function () { if (vista && vista.datos) LD.exportarExcel(contexto(), { boton: bXls, aviso: aviso }); });
      bBor.addEventListener('click', function () { if (vista && vista.datos) LD.borradorTodos(contexto(), { boton: bBor, aviso: aviso }); });
    }
    var LR = raiz.GestoorLevRect, bRect = null;
    if (LR) {   // SI RECTIFICAMOS TODO (levantamiento-rectificar.js)
      bRect = boton('Si rectificamos todo', 'grafico', 'liva-rectificar-todo'); bRect.disabled = true;
      bRect.addEventListener('click', function () { if (vista && vista.datos) LR.abrir(contexto()); });
    }
    if (raiz.GestoorHistoriaSII) {   // CARTAPRA-HISTORIA: varios años de compras y ventas de una vez (abre su propio diálogo encima)
      var bHsii = boton('Historia SII', 'calendario', 'liva-historia-sii', true);
      bHsii.addEventListener('click', function () { raiz.GestoorHistoriaSII.abrir(cliente, { desde: iDesde.value, hasta: iHasta.value }); });
    }
    caja.appendChild(ctl);
    var msg = el('div', 'liva-msg', 'Elige el rango y presiona Calcular. Por defecto: los últimos 36 meses cerrados.'); msg.id = 'liva-msg'; caja.appendChild(msg);
    var res = el('div'); res.id = 'liva-res'; caja.appendChild(res);

    vista = { velo: velo, cliente: cliente, datos: null, seq: 0, otros: null };
    function aviso(t, c) { msg.className = 'liva-msg' + (c ? ' ' + c : ''); msg.textContent = t; }
    function opciones() { return { fecha_pago: iPago.value || undefined, medio: iMedio.value || 'internet', fiscalizacion: !!iFisc.checked }; }
    /** Lo que necesita el detalle/borrador: cliente, rango y opciones del ÚLTIMO cálculo (no lo que diga el formulario después). */
    function contexto() { var d = vista.datos; return { cliente: cliente, desde: d.desde, hasta: d.hasta, opciones: vista.opciones, datos: d, rpc: rpc, mensajeError: mensajeError, otros: vista.otros }; }
    vista.aviso = aviso;
    vista.contexto = contexto;

    bCalc.addEventListener('click', function () {
      var s = ++vista.seq; bCalc.disabled = true; bPdf.disabled = true; if (bXls) { bXls.disabled = true; bBor.disabled = true; } if (bRect) bRect.disabled = true; aviso('Calculando…'); res.textContent = '';
      var op = opciones();
      rpc('sii_levantamiento_iva', { p_cliente_id: Number(cliente.id), p_desde: aAAAAMM(iDesde.value), p_hasta: aAAAAMM(iHasta.value), p_opciones: op })
        .then(function (d) {
          if (!vista || s !== vista.seq) return;
          vista.datos = d; vista.opciones = op; bCalc.disabled = false; bPdf.disabled = false; if (bXls) { bXls.disabled = false; bBor.disabled = false; } if (bRect) bRect.disabled = false;
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
        .then(function () { bPdf.disabled = false; imprimir(d, cliente, vista && vista.otros); })
        .catch(function (e) { bPdf.disabled = false; aviso(mensajeError(e), 'roj'); });
    });
    velo.addEventListener('click', function (ev) { if (ev.target === velo) cerrar(); });
    doc.addEventListener('keydown', alEsc);
    doc.body.appendChild(velo);
  }

  function contar(d, e) { return Number((d && d.totales && d.totales.por_estado && d.totales.por_estado[e]) || 0); }
  function nm(n) { return n + (Number(n) === 1 ? ' mes' : ' meses'); }
  function nProv(d) { return contar(d, 'coincidencia_provisional') + contar(d, 'diferencia_preliminar') + contar(d, 'revisar_arrastre'); }
  function nNoDecl(d) { return contar(d, 'no_declarado') + contar(d, 'no_declarado_sin_rcv'); }
  function textoResumen(d) {
    var comp = contar(d, 'calza') + contar(d, 'diferencia') + contar(d, 'a_favor') + nProv(d);
    var t = contar(d, 'calza') + ' de ' + comp + ' meses comparables calzan';
    if (contar(d, 'diferencia') + nNoDecl(d)) t += ' · ' + (contar(d, 'diferencia') + nNoDecl(d)) + ' con diferencia o sin declarar';
    if (contar(d, 'solo_f29')) t += ' · ' + contar(d, 'solo_f29') + ' solo con F29 (faltan compras y ventas)';
    if (nProv(d)) t += ' · ' + nProv(d) + ' provisionales por revisar';
    if (d.totales && Number(d.totales.condicionados) > 0) t += ' · ' + d.totales.condicionados + ' condicionados (remanente supuesto)';
    if (contar(d, 'f29_sin_montos')) t += ' · ' + contar(d, 'f29_sin_montos') + ' con F29 sin montos';
    if (contar(d, 'sin_datos')) t += ' · ' + contar(d, 'sin_datos') + ' sin datos (puedes pedir el historial a Cartapra)';
    if (d.historial && (d.historial.estado === 'pendiente' || d.historial.estado === 'en_curso' || d.historial.estado === 'reintento'))
      t += ' · Pedido a Cartapra en curso: ' + d.historial.pendientes + ' lecturas pendientes';
    return t + '.';
  }
  function claseResumen(d) { return contar(d, 'diferencia') + nNoDecl(d) > 0 ? 'roj' : contar(d, 'sin_datos') + contar(d, 'f29_sin_montos') + nProv(d) > 0 ? 'amb' : 'ver'; }
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
  /** «A regularizar en el período»: el total del servidor (o el provisional rotulado); nunca se fabrica uno.
      otros (opcional) = {monto, motivo} ingresado a mano por el analista: se suma y se rotula «ingresado a mano». */
  function aRegularizar(d, otros) {
    var e = d.estimacion || {}, k = e.conocido || {}, p = e.provisional || {}, x = e.no_calculable || {};
    var n = Number(k.meses || 0) + Number(p.meses || 0) + Number(x.meses || 0);
    var om = otros && num(otros.monto) > 0 ? Number(otros.monto) : 0;
    var v = e.total != null ? pesos(Number(e.total) + om) : e.total_no_calculable ? 'No calculable' + (om ? ' + ' + pesos(om) + ' ingresado a mano' : '') : num(e.total_provisional) != null ? pesos(Number(e.total_provisional) + om) + ' (provisional)' : (om ? pesos(om) + ' (solo ingresado a mano)' : '—');
    var nota = om ? 'incluye ' + pesos(om) + ' de otros cargos ingresados a mano (' + String(otros.motivo || '') + ')' : '';
    return { valor: v, meses: n, otros: om, nota: nota, texto: 'A regularizar en el período: ' + v + ' (' + nm(n) + ')' + (nota ? ' · ' + nota : '') };
  }
  /** Valida «Otros cargos / multa adicional»: monto entero positivo y motivo obligatorio. Devuelve {monto, motivo} o {error}. */
  function validarOtros(monto, motivo) {
    var t = String(monto == null ? '' : monto).replace(/[$.\s]/g, '').replace(',', '.'), n = Number(t), mo = String(motivo || '').trim();
    if (!t || !isFinite(n) || n <= 0 || Math.round(n) !== n || n > 1e12) return { error: 'Ingresa el monto de otros cargos en pesos (entero mayor que cero).' };
    if (mo.length < 3) return { error: 'El motivo es obligatorio (por ejemplo: «multa art. 97 N°1 por declaración tardía»).' };
    return { monto: n, motivo: mo.slice(0, 160) };
  }
  /** Conteo de meses por estado (del servidor: totales.por_estado). */
  function conteoEstados(d) {
    var pe = (d.totales && d.totales.por_estado) || {};
    return Object.keys(pe).filter(function (k) { return Number(pe[k]) > 0; }).map(function (k) { return pe[k] + ' ' + ((ESTADOS[k] || {}).t || k).toLowerCase(); }).join(' · ');
  }
  /** Desglose de la estimación por calidad (impuesto + reajuste + intereses + multa = total), tal como lo entrega el servidor. */
  function desglose(e) {
    var out = [], k = e.conocido || {}, p = e.provisional || {}, x = e.no_calculable || {};
    if (Number(k.meses)) out.push('Conocido (' + nm(k.meses) + '): impuesto ' + pesos(k.impuesto) + ' + reajuste ' + pesos(k.reajuste) + ' + intereses ' + pesos(k.intereses) + ' + multa ' + pesos(k.multa) + ' = ' + pesos(k.total));
    if (Number(p.meses)) out.push('Provisional (' + nm(p.meses) + '): impuesto ' + pesos(p.impuesto) + ' + reajuste ' + pesos(p.reajuste) + ' + intereses ' + pesos(p.intereses) + ' + multa ' + pesos(p.multa) + ' = ' + pesos(p.total));
    if (Number(x.meses)) out.push('Sin calcular (' + nm(x.meses) + '): impuesto ' + pesos(x.impuesto) + '; falta ' + ((x.componentes_pendientes || []).join(', ') || '—'));
    var om = e.omision_declaracion || {};
    if (Number(om.meses)) out.push('Incluye multas por F29 no presentado (art. 97 N°1, mínimo 1 UTM, ' + nm(om.meses) + '): ' + pesos(om.multa));
    var r = e.retencion_no_enterada || {};
    if (Number(r.meses)) out.push('Retención no enterada, aparte (' + nm(r.meses) + '): impuesto ' + pesos(r.impuesto) + ' + reajuste ' + pesos(r.reajuste) + ' + intereses ' + pesos(r.intereses) + ' + multa ' + pesos(r.multa) + ' = ' + (r.total == null ? 'no calculable' : pesos(r.total)));
    var cd = e.condonacion || {};
    if (Number(cd.meses) && cd.deuda_sin_condonacion != null) out.push('Con condonación (' + (cd.rotulo || 'simulación referencial') + ', tramo ' + String(cd.tramo || '').replace('_', ' a ').replace('mas a 24', 'más de 24') + ' meses): deuda ' + pesos(cd.deuda_sin_condonacion) +
      ' − intereses ' + pesos(cd.descuento_intereses) + ' − multa ' + pesos(cd.descuento_multa) + (Number(cd.descuento_adicional_pago_total) ? ' − pago total ' + pesos(cd.descuento_adicional_pago_total) : '') + ' = ' + pesos(cd.total_con_condonacion));
    return out;
  }
  function estimadoMes(m) {
    var es = m.estimacion; if (!es) return { t: '—', c: '' };
    if (es.total == null) return { t: 'No calculable', c: 'prov' };
    return { t: pesos(es.total) + (CALIDAD[es.calidad] || ''), c: es.calidad === 'completa' ? '' : 'prov' };
  }
  function detalleEstimacion(es) {
    if (es.tipo === 'omision_97_1') return 'Vence ' + fechaTxt(es.vencimiento) + ' · ' + es.meses_atraso + ' meses de atraso · F29 no presentado · multa art. 97 N°1 ' +
      (es.multa == null ? 'pendiente (falta la UTM del mes de pago)' : pesos(es.multa) + ' (mínimo: 1 UTM; rango legal 1 UTM a 1 UTA)') + ' · estimación provisional' + (es.nota && /no se sabe/.test(es.nota) ? ' · sin compras y ventas del SII no se sabe si además hubo IVA a pagar' : '');
    var t = 'Vence ' + fechaTxt(es.vencimiento) + ' · ' + es.meses_atraso + ' meses de atraso · impuesto ' + pesos(es.impuesto) +
      ' · reajuste ' + (es.reajuste == null ? 'pendiente (falta UTM)' : pesos(es.reajuste)) +
      ' · intereses ' + (es.intereses == null ? 'pendientes (falta tasa' + ((es.semestres_sin_tasa || []).length ? ' ' + es.semestres_sin_tasa.join(', ') : '') + ')' : pesos(es.intereses) + (es.intereses_estado === 'provisional_sin_reajuste' ? ' (provisional)' : '')) +
      ' · multa ' + Math.round(Number(es.multa_pct) * 100) + ' %' + (es.multa_detalle ? ' (' + es.multa_detalle.meses_calendario + ' mes(es) calendario' + (es.multa_detalle.tope_alcanzado ? ', tope' : '') + ')' : '') + ' = ' + pesos(es.multa) + (es.multa_estado === 'provisional_sin_reajuste' ? ' (provisional)' : '');
    var tr = (es.intereses_tramos || []).map(function (x) { return x.regla === 'mensual' ? x.meses + ' mes(es) al ' + String(x.tasa_pct).replace('.', ',') + ' %' : x.dias + ' días al ' + String(x.tasa_pct).replace('.', ',') + ' % diario'; });
    if (tr.length) t += ' · tramos: ' + tr.join(' + ');
    return t + ' · ' + (es.calidad === 'completa' ? 'estimación completa' : es.calidad === 'provisional' ? 'estimación provisional' : 'total no calculable');
  }

  /** Ícono lupa (SVG armado con createElementNS: sin innerHTML). */
  function lupaSvg() {
    var NS = 'http://www.w3.org/2000/svg', sv = doc.createElementNS(NS, 'svg');
    sv.setAttribute('viewBox', '0 0 24 24'); sv.setAttribute('width', '15'); sv.setAttribute('height', '15'); sv.setAttribute('aria-hidden', 'true');
    sv.setAttribute('fill', 'none'); sv.setAttribute('stroke', 'currentColor'); sv.setAttribute('stroke-width', '2'); sv.setAttribute('stroke-linecap', 'round');
    var c = doc.createElementNS(NS, 'circle'); c.setAttribute('cx', '11'); c.setAttribute('cy', '11'); c.setAttribute('r', '6.5'); sv.appendChild(c);
    var l = doc.createElementNS(NS, 'line'); l.setAttribute('x1', '16'); l.setAttribute('y1', '16'); l.setAttribute('x2', '21'); l.setAttribute('y2', '21'); sv.appendChild(l);
    return sv;
  }
  function abrirDetalle(periodo) { if (vista && vista.datos && raiz.GestoorLevDetalle) raiz.GestoorLevDetalle.abrirMes(vista.contexto(), periodo); }
  function dato(cont, etq, v, cls) { var b = el('div', 'liva-dato' + (cls ? ' ' + cls : '')); b.appendChild(el('div', 'l', etq)); b.appendChild(el('div', 'v', v)); cont.appendChild(b); }

  function pintar(cont, d) {
    cont.textContent = '';
    var e = d.estimacion || {};
    var otros = vista && vista.otros, AR = aRegularizar(d, otros), reg = el('div', 'liva-reg'); reg.id = 'liva-regularizar';
    reg.appendChild(el('div', 'l', 'A regularizar en el período')); reg.appendChild(el('div', 'v', AR.valor)); reg.appendChild(el('small', null, nm(AR.meses) + ' · ' + mesTxt(d.desde) + ' a ' + mesTxt(d.hasta) + ' · estimación preliminar, verificar' + (AR.nota ? ' · ' + AR.nota : '')));
    cont.appendChild(reg);
    cont.appendChild(campoOtros(cont, d));
    var g = el('div', 'liva-res');
    dato(g, 'Meses que calzan', contar(d, 'calza') + ' / ' + (d.meses || []).length, 'ver');
    dato(g, 'Con diferencia o sin declarar', String(contar(d, 'diferencia') + nNoDecl(d)), contar(d, 'diferencia') + nNoDecl(d) ? 'roj' : null);
    if (contar(d, 'solo_f29')) dato(g, 'Solo F29 (falta RCV)', String(contar(d, 'solo_f29')), 'amb');
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
    var conDet = !!raiz.GestoorLevDetalle;
    ['Mes', 'Estado', 'IVA ventas RCV', 'Débito F29', 'IVA compras RCV', 'Crédito F29', 'Rem. anterior', 'IVA declarado', 'IVA recalculado', 'Diferencia', 'Estimado a pagar', 'Origen']
      .concat(conDet ? ['Detalle'] : []).forEach(function (x) { tr.appendChild(el('th', null, x)); });
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
      if (conDet) {   // lupa accesible (teclado y lector de pantalla) + doble clic en la fila
        var tl = el('td', 'lupa'), lb = el('button', 'liva-lupa'); lb.type = 'button'; lb.setAttribute('data-lupa', m.periodo);
        lb.setAttribute('aria-label', 'Ver documentos de ' + mesTxt(m.periodo)); lb.title = 'Ver documentos del mes (o doble clic en la fila)';
        lb.appendChild(lupaSvg()); tl.appendChild(lb); f.appendChild(tl);
        lb.addEventListener('click', function (ev) { ev.stopPropagation(); abrirDetalle(m.periodo); });
        f.addEventListener('dblclick', function () { abrirDetalle(m.periodo); });
      }
      tb.appendChild(f);
      var det = el('tr', 'det'); det.hidden = true; var dc = el('td'); dc.colSpan = conDet ? 13 : 12; det.appendChild(dc);
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
    t.appendChild(tb);
    // Totales del período (del servidor), fijos al pie
    var tf = el('tfoot'), tt = d.totales || {}, fs = el('tr', 'sum'); fs.id = 'liva-totales';
    fs.appendChild(el('td', null, 'Totales')); fs.appendChild(el('td', null, nm((d.meses || []).length)));
    [tt.debito_rcv, tt.debito_declarado, tt.credito_rcv, tt.credito_declarado_documentos].forEach(function (v) { fs.appendChild(el('td', null, pesos(v))); });
    fs.appendChild(el('td', null, '')); fs.appendChild(el('td', null, '')); fs.appendChild(el('td', null, 'A favor ' + pesos(e.posible_a_favor)));
    fs.appendChild(el('td', 'dif' + (num(e.impuesto) > 0 ? ' roj' : ''), pesos(e.impuesto))); fs.appendChild(el('td', null, AR.valor)); fs.appendChild(el('td', null, ''));
    if (conDet) fs.appendChild(el('td', null, ''));
    tf.appendChild(fs);
    var fe = el('tr', 'est'), ce = el('td'); ce.colSpan = conDet ? 13 : 12;
    ce.textContent = conteoEstados(d) + (desglose(e).length ? ' — ' + desglose(e).join(' · ') : ''); fe.appendChild(ce); tf.appendChild(fe);
    t.appendChild(tf);
    tw.appendChild(t); cont.appendChild(tw);
    cont.appendChild(el('div', 'liva-aviso', (e.aviso || 'Estimación preliminar, verificar.') + ' Haz clic en un mes para ver sus alertas' + (conDet ? '; doble clic (o la lupa) para ver sus documentos y el borrador de F29.' : '.')));
    if (d.totales && d.totales.dentro_tolerancia && Number(d.totales.dentro_tolerancia.meses) > 0)
      cont.appendChild(el('div', 'liva-aviso', d.totales.dentro_tolerancia.meses + ' meses calzan dentro de la tolerancia de $100 (diferencia acumulada de IVA ' + pesos(d.totales.dentro_tolerancia.iva_acumulado) + ').'));
    var ul = el('ul', 'liva-sup'); (e.supuestos || []).forEach(function (s) { ul.appendChild(el('li', null, s)); }); cont.appendChild(ul);
  }

  /** Campo «Otros cargos / multa adicional» (ingresado a mano; no se guarda en la base). */
  function campoOtros(cont, d) {
    var w = el('div', 'liva-otros'); w.id = 'liva-otros';
    var t = el('div', 't', 'Otros cargos / multa adicional '); t.appendChild(el('small', null, '(opcional, ingresado a mano: p. ej. multa art. 97 N°1; se suma al total del levantamiento y del escenario; no se guarda)')); w.appendChild(t);
    var o = vista && vista.otros;
    if (o) {
      w.appendChild(el('div', 'act', 'Ingresado a mano: ' + pesos(o.monto) + ' · ' + o.motivo));
      var bq = el('button', 'liva-btn sec', 'Quitar'); bq.type = 'button'; bq.id = 'liva-otros-quitar'; w.appendChild(bq);
      bq.addEventListener('click', function () { vista.otros = null; pintar(cont, d); if (vista.aviso) vista.aviso('Se quitaron los otros cargos ingresados a mano.', 'amb'); });
      return w;
    }
    var l1 = el('label', null, 'Monto ($)'), i1 = el('input'); i1.type = 'text'; i1.inputMode = 'numeric'; i1.id = 'liva-otros-monto'; i1.placeholder = '0'; l1.appendChild(i1); w.appendChild(l1);
    var l2 = el('label', null, 'Motivo (obligatorio)'), i2 = el('input'); i2.type = 'text'; i2.id = 'liva-otros-motivo'; i2.maxLength = 160; i2.size = 40; i2.placeholder = 'Ej.: multa art. 97 N°1'; l2.appendChild(i2); w.appendChild(l2);
    var bs = el('button', 'liva-btn sec', 'Sumar al total'); bs.type = 'button'; bs.id = 'liva-otros-sumar'; w.appendChild(bs);
    bs.addEventListener('click', function () {
      var v = validarOtros(i1.value, i2.value);
      if (v.error) { if (vista.aviso) vista.aviso(v.error, 'roj'); return; }
      vista.otros = v; pintar(cont, d); if (vista.aviso) vista.aviso('Otros cargos ingresados a mano: ' + pesos(v.monto) + ' (' + v.motivo + '). Se suman al total del levantamiento y del escenario; no se guardan en la base.', 'amb');
    });
    return w;
  }

  // ── PDF de marca (documento propio en iframe oculto; fondo claro, franja morada con el logo blanco) ──
  function htmlPdf(d, cliente, logoUrl, otros) {
    var e = d.estimacion || {};
    var filas = (d.meses || []).map(function (m) {
      var est = estadoDe(m), iva = m.iva || {}, deb = m.debito || {}, cre = m.credito || {};
      return '<tr class="' + est.c + '"><td>' + esc(mesTxt(m.periodo)) + '</td><td><span class="chip ' + est.c + '">' + esc(est.t) + '</span>' + (m.condicionado ? ' <span class="chip amb">Condicionado</span>' : '') + '</td><td>' + esc(pesos(deb.rcv)) + '</td><td>' + esc(pesos(deb.declarado)) +
        '</td><td>' + esc(pesos(cre.rcv)) + '</td><td>' + esc(pesos(cre.declarado_documentos)) + '</td><td>' + esc(pesos(iva.declarado)) + '</td><td>' + esc(pesos(iva.recalculado)) +
        '</td><td class="b">' + esc(pesos(iva.diferencia)) + '</td><td class="b">' + esc(estimadoMes(m).t) + '</td></tr>';
    }).join('');
    var tarjeta = function (l, v, c) { return '<div class="k ' + (c || '') + '"><div class="l">' + esc(l) + '</div><div class="v">' + esc(v) + '</div></div>'; };
    var hoy = new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' });
    var T = totales(e), AR = aRegularizar(d, otros), tt = d.totales || {};
    var pie = '<tfoot><tr><td>Totales</td><td>' + esc(nm((d.meses || []).length)) + '</td><td>' + esc(pesos(tt.debito_rcv)) + '</td><td>' + esc(pesos(tt.debito_declarado)) + '</td><td>' + esc(pesos(tt.credito_rcv)) +
      '</td><td>' + esc(pesos(tt.credito_declarado_documentos)) + '</td><td>A favor ' + esc(pesos(e.posible_a_favor)) + '</td><td></td><td class="b">' + esc(pesos(e.impuesto)) + '</td><td class="b">' + esc(AR.valor) + '</td></tr>' +
      '<tr><td colspan="10" class="g">' + esc(conteoEstados(d)) + (desglose(e).length ? ' — ' + esc(desglose(e).join(' · ')) : '') + '</td></tr></tfoot>';
    return '<div class="hd"><img src="' + esc(logoUrl) + '" alt="Contadoor"><div><h1>Levantamiento de IVA</h1><p>' + esc(cliente.razon || '') + (cliente.rut ? ' · RUT ' + esc(cliente.rut) : '') + '</p></div></div>' +
      '<div class="cuerpo"><p class="prel">Estimación preliminar, no constituye determinación definitiva</p><p class="sub">Período revisado: <b>' + esc(mesTxt(d.desde)) + ' a ' + esc(mesTxt(d.hasta)) + '</b> · Emitido el ' + esc(hoy) + ' · Fuente: Registro de Compras y Ventas y Formularios 29 del SII.</p>' +
      '<div class="reg"><span>A regularizar en el período</span><b>' + esc(AR.valor) + '</b><em>' + esc(nm(AR.meses)) + (AR.nota ? ' · ' + esc(AR.nota) : '') + '</em></div>' +
      '<div class="ks">' + tarjeta('Meses revisados', String((d.meses || []).length)) + tarjeta('Meses que calzan', String(contar(d, 'calza')), 'ver') +
      tarjeta('Meses con diferencia', String(contar(d, 'diferencia') + nNoDecl(d)), 'roj') + tarjeta('Provisionales', String(nProv(d))) +
      tarjeta('Sin datos / F29 sin montos', String(contar(d, 'sin_datos') + contar(d, 'f29_sin_montos'))) + '</div>' +
      '<h2>Estimación si se rectifica</h2><div class="ks">' + tarjeta('Diferencia de impuesto', pesos(e.impuesto)) +
      tarjeta('Subtotal conocido (' + nm(T.nConocido) + ')', T.conocido) + (T.nProv ? tarjeta('Provisional (' + nm(T.nProv) + ')', T.provisional) : '') +
      (T.nPend ? tarjeta('Sin calcular (' + nm(T.nPend) + ')', 'Falta: ' + (T.pend || '—')) : '') + tarjeta('Total estimado', T.total, 'mor') + '</div>' +
      '<p class="av">ESTIMACIÓN PRELIMINAR, VERIFICAR: no constituye determinación definitiva. Montos calculados para un pago el ' + esc(fechaTxt(d.opciones && d.opciones.fecha_pago)) + '; el monto definitivo lo determina el SII/Tesorería al momento del pago y puede variar por reajustes, condonaciones u otros antecedentes. ' +
      'Esta estimación no incluye el costo de nuestros servicios de regularización, que se informa en la propuesta.</p>' +
      '<h2>Detalle mes a mes</h2><table><thead><tr><th>Mes</th><th>Estado</th><th>IVA ventas SII</th><th>Débito declarado</th><th>IVA compras SII</th><th>Crédito declarado</th><th>IVA declarado</th><th>IVA recalculado</th><th>Diferencia</th><th>Estimado</th></tr></thead><tbody>' + filas + '</tbody>' + pie + '</table>' +
      '<h2>Supuestos</h2><ul>' + (e.supuestos || []).map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') +
      '<li>«Sin datos» significa que aún no tenemos la información del SII de ese mes; no se considera cero. «Sin declaración encontrada»: no se encontró declaración en los antecedentes disponibles.</li>' +
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
    'td{padding:4px 6px;border-top:1px solid #EFE3F1;text-align:right}th+th{border-left:1px solid #E0CCE4}td+td{border-left:1px solid #EFE3F1}th:nth-child(-n+2),td:nth-child(-n+2){text-align:left}tr{break-inside:avoid}td.b{font-weight:700}' +
    'tr.roj td.b{color:#D34433}tr.gris td{color:#9A8A9C}.chip{display:inline-block;padding:1px 7px;border-radius:999px;font-size:8.5px;font-weight:700}' +
    '.chip.ver{background:#E3F4EC;color:#28865B}.chip.roj{background:#FBE4E1;color:#D34433}.chip.amb{background:#FFF1D6;color:#8A5A00}.chip.gris{background:#F0ECF1;color:#7A6E7C}' +
    'tfoot td{font-weight:800;background:#F6ECF6;border-top:2px solid ' + MORADO + '}tfoot td.g{font-weight:600;text-align:left;font-size:9px}' +
    '.reg{display:flex;align-items:baseline;gap:12px;margin:8px 0;padding:8px 12px;border:2px solid ' + MORADO + ';border-radius:10px;background:#F6ECF6}.reg span{font-size:9px;text-transform:uppercase;letter-spacing:.4px;color:#5B4560}.reg b{font:800 17px Montserrat,Arial,sans-serif;color:' + MORADO + '}.reg em{font-style:normal;color:#5B4560}' +
    'ul{margin:4px 0;padding-left:16px;line-height:1.5;color:#5B4560}.pie{margin-top:12px;color:#9A8A9C;font-size:9px;text-align:right}';
  function documentoPdf(d, cliente, logoUrl, otros) {
    var limpio = function (t) { return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 50); };
    var titulo = ['Levantamiento_IVA', limpio(cliente.razon) || 'cliente', d.desde + '-' + d.hasta].join('_');
    return '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>' + esc(titulo) + '</title>' +
      '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Montserrat:wght@700;800&display=swap" rel="stylesheet"><style>' + CSS_PDF + '</style></head><body>' +
      htmlPdf(d, cliente, logoUrl, otros) + '</body></html>';
  }
  function imprimir(d, cliente, otros) {
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
    f.srcdoc = documentoPdf(d, cliente, new URL('../assets/logo-blanco.png', raiz.location.href).href, otros);
    doc.body.appendChild(f);
  }

  raiz.GestoorLevIVA = { montar: montar, abrir: abrir, cerrar: cerrar, puedeVer: puedeVer, rangoPorDefecto: rangoPorDefecto, documentoPdf: documentoPdf, mensajeError: mensajeError, origenTxt: origenTxt, ESTADOS: ESTADOS, estadoDe: estadoDe, totales: totales, estimadoMes: estimadoMes, aRegularizar: aRegularizar, validarOtros: validarOtros, conteoEstados: conteoEstados, desglose: desglose, estilos: estilos };
})(window);
