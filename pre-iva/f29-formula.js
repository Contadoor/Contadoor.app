// Pre-IVA · fórmula del F29 estimado, SIN acceso a red ni al DOM (se prueba aparte: node --test pre-iva/f29-formula.test.js).
// Lógica del F29 (igual que Contable en reportes-contable/index.html):
//   · IVA determinado = débito − crédito − remanente del mes anterior.
//       Si es negativo → queda como remanente a favor para el mes siguiente y el IVA a pagar es $0.
//   · Total F29 estimado = IVA a pagar (nunca negativo) + PPM.
//   · El remanente de crédito fiscal solo se imputa contra IVA: NUNCA rebaja el PPM, y el PPM NUNCA genera remanente.
// Esta pantalla no considera retenciones de honorarios ni impuesto único (eso lo valida Contable).
// ARCHIVO COMPARTIDO (19-11): reportes-contable/calculo-f29.js usa calcularF29Completo / aplicarEdicionPPM / tasaPPMDesdeGuardado
// para que el Pre-IVA y la tarjeta «Cálculo del F29» del Reporte Contable den exactamente el mismo resultado.
(function (raiz) {
  'use strict';
  function n(x) { var v = Number(x); return isFinite(v) ? v : 0; }

  // Proyección al cierre: solo el mes en curso se proyecta con el promedio diario; un mes ya terminado usa lo registrado.
  function proyectarMes(o) {
    var debReg = n(o.debitoRegistrado), credReg = n(o.creditoRegistrado), diasT = n(o.diasTranscurridos);
    var diasProy = o.esMesActual ? Math.max(0, n(o.diasRestantes)) : 0;
    var tD = diasT > 0 ? debReg / diasT : 0, tC = diasT > 0 ? credReg / diasT : 0;
    return { debito: Math.round(debReg + tD * diasProy), credito: Math.round(credReg + tC * diasProy) };
  }

  function calcularF29Estimado(o) {
    var debito = n(o.debito), credito = n(o.credito), remanente = Math.max(0, n(o.remanente)), ppm = Math.max(0, n(o.ppm));
    var ivaDeterminado = debito - credito - remanente;
    var ivaPagar = Math.max(ivaDeterminado, 0);
    var nuevoRemanente = Math.max(-ivaDeterminado, 0);
    return { ivaDeterminado: ivaDeterminado, ivaPagar: ivaPagar, nuevoRemanente: nuevoRemanente, ppm: ppm, total: ivaPagar + ppm };
  }

  // Base del PPM (igual que Contable, reportes-contable/index.html:613-636: neto + exento de ventas):
  //   base = ingresos netos afectos + ingresos exentos + otros ingresos computables.
  //   · Neto afecto: el del libro de ventas si se conoce; si no, débito IVA ÷ 0,19 (ESTIMACIÓN, se avisa).
  //   · Exento: el del libro o el que escriba el analista; si falta, NO se asume 0 en silencio:
  //     se avisa "PPM estimado sin ventas exentas" y el PPM no es definitivo.
  //   · Otros ingresos computables: esta pantalla no los tiene (0); Contable tampoco los usa hoy.
  var TASA_IVA = 0.19;
  function conocido(x) { return x !== null && x !== undefined && x !== '' && isFinite(Number(x)); }
  function calcularBasePPM(o) {
    var netoOk = conocido(o.netoAfecto), exentoOk = conocido(o.exento);
    var netoAfecto = netoOk ? n(o.netoAfecto) : Math.round(n(o.debito) / TASA_IVA);
    var exento = exentoOk ? n(o.exento) : 0, otros = n(o.otrosIngresos);
    var avisos = [];
    if (!netoOk) avisos.push('neto afecto estimado (débito IVA ÷ 0,19)');
    if (!exentoOk) avisos.push('PPM estimado sin ventas exentas');
    return { base: netoAfecto + exento + otros, netoAfecto: netoAfecto, exento: exento, otros: otros,
             netoEstimado: !netoOk, sinExento: !exentoOk, definitivo: netoOk && exentoOk, avisos: avisos };
  }
  // Mismo redondeo que Contable: Math.round(base × tasa / 100); sin tasa o sin base → 0.
  function calcularPPM(base, tasa) { var b = n(base), t = n(tasa); return (t > 0 && b > 0) ? Math.round(b * t / 100) : 0; }

  // "Editar reporte": F29 manual > 0 se respeta; en 0 (o vacío) se recalcula con la fórmula vigente.
  function f29DesdeEdicion(o) { var m = n(o.f29Manual); return m > 0 ? m : calcularF29Estimado(o).total; }

  // Acciones sugeridas: compras y ventas solo mueven el IVA, así que se basan en el IVA a pagar (nunca en el PPM ni en el total).
  function accionesSugeridas(o) {
    var iva = n(o.ivaPagar), deb = n(o.debito), dias = n(o.diasRestantes), a = [];
    var f = typeof o.formato === 'function' ? o.formato : String;
    if (iva > 500000) a.push({ tipo: 'verde', titulo: 'Adelantar compras del mes siguiente', desc: 'Registrar facturas de proveedores del próximo mes genera crédito adicional y reduce el IVA a pagar.', monto: 'Ahorro estimado hasta ' + f(Math.round(iva * 0.13)) });
    if (dias >= 5 && deb > 0) a.push({ tipo: 'amarillo', titulo: 'Diferir facturación de fin de mes', desc: 'Facturas emitidas el 1 del mes siguiente mueven débito al período siguiente.', monto: 'Impacto posible: ' + f(Math.round(deb / 22 * 3 * 0.19)) });
    a.push({ tipo: 'morado', titulo: 'Revisar facturas de proveedores pendientes', desc: 'Documentos recibidos y aún no registrados. Cada factura suma crédito fiscal.', monto: 'Consulta con tu analista' });
    if (iva > 1000000) a.push({ tipo: 'amarillo', titulo: 'Compra de activo fijo', desc: 'Si tienes activos planificados, el IVA del activo genera crédito inmediato.', monto: 'Depende del monto del activo' });
    return a;
  }

  // Validación de un campo tributario editable (n() convierte en 0 lo inválido sin avisar; por eso se valida ANTES):
  // vacío = sin dato (válido); si no, debe ser un número entero de pesos, finito y no negativo.
  // badInput = el navegador recibió texto que no es número (input type=number lo deja en '').
  function validarMonto(raw, opts) {
    if (opts && opts.badInput) return 'no es un número válido';
    var t = String(raw == null ? '' : raw).trim();
    if (t === '') return null;
    if (!/^-?\d+(\.\d+)?$/.test(t)) return 'no es un número válido';
    var v = Number(t);
    if (!isFinite(v)) return 'no es un número válido';
    if (v < 0) return 'no puede ser negativo';
    if (Math.floor(v) !== v) return 'debe ser un monto en pesos sin decimales';
    return null;
  }

  // ── PPM editable (pedido de Luciano 19-11) ─────────────────────────────────────────────────────────────
  // Se parte del PPM calculado (base × tasa del último F29). El analista puede cambiar la TASA (%) o el MONTO, siempre con motivo.
  //   e = { tasa: número|null, monto: número|null, motivo, por, at } | null.  Monto escrito manda sobre la tasa.
  // Se guarda en preiva_historial: ppm = PPM final, tasa_ppm = tasa usada y sii_detalle.ppm_editado = e + lo calculado (sin SQL nuevo).
  var MOTIVO_PPM_MIN = 5, MOTIVO_PPM_MAX = 300;
  function hayEdicionPPM(e) { return !!e && (conocido(e.tasa) || conocido(e.monto)); }
  function aplicarEdicionPPM(base, tasaCalculada, e) {
    var tc = n(tasaCalculada), calc = calcularPPM(base, tc);
    var out = { ppm: calc, tasa: tc, calculado: calc, tasaCalculada: tc, editado: false, modo: null, motivo: null };
    if (!hayEdicionPPM(e)) return out;
    out.editado = true; out.motivo = e.motivo ? String(e.motivo) : null;
    if (conocido(e.monto)) { out.modo = 'monto'; out.ppm = Math.max(0, Math.round(n(e.monto))); out.tasa = conocido(e.tasa) ? n(e.tasa) : tc; }
    else { out.modo = 'tasa'; out.tasa = Math.max(0, n(e.tasa)); out.ppm = calcularPPM(base, out.tasa); }
    return out;
  }
  function tasaTxt(t) { return String(Math.round(n(t) * 1000) / 1000).replace('.', ','); }
  function pesosTxt(v) { return '$' + Math.round(Math.abs(n(v))).toLocaleString('es-CL'); }
  // «PPM editado (calculado: $X · tasa Y%)»
  function etiquetaPPMEditado(r) {
    if (!r || !(r.editado || r.ppmEditado)) return '';   // acepta aplicarEdicionPPM() o calcularF29Completo()
    return 'PPM editado (calculado: ' + pesosTxt(r.ppmCalculado != null ? r.ppmCalculado : r.calculado) + ' · tasa ' + tasaTxt(r.tasaCalculada) + '%)';
  }
  // Validación antes de aplicar: al menos tasa o monto; tasa 0–10 %; monto entero ≥ 0; motivo 5–300 caracteres.
  function validarEdicionPPM(o) {
    o = o || {};
    var tRaw = String(o.tasa == null ? '' : o.tasa).trim().replace(',', '.'), mRaw = String(o.monto == null ? '' : o.monto).trim().replace(/\./g, '');
    if (tRaw === '' && mRaw === '') return 'Escribe la nueva tasa (%) o el monto del PPM.';
    if (tRaw !== '') { if (!/^\d+(\.\d+)?$/.test(tRaw)) return 'La tasa debe ser un número (ej: 1,25).'; if (Number(tRaw) > 10) return 'La tasa no puede ser mayor a 10 %.'; }
    if (mRaw !== '' && !/^\d+$/.test(mRaw)) return 'El monto debe ser en pesos, sin decimales.';
    var m = String(o.motivo || '').trim();
    if (m.length < MOTIVO_PPM_MIN) return 'Escribe el motivo del cambio (mínimo ' + MOTIVO_PPM_MIN + ' caracteres).';
    if (m.length > MOTIVO_PPM_MAX) return 'El motivo puede tener como máximo ' + MOTIVO_PPM_MAX + ' caracteres.';
    return null;
  }
  // Edición tal como se guarda (valores ya validados) → objeto para sii_detalle.ppm_editado
  function edicionPPMDesdeForm(o, r) {
    var tRaw = String(o.tasa == null ? '' : o.tasa).trim().replace(',', '.'), mRaw = String(o.monto == null ? '' : o.monto).trim().replace(/\./g, '');
    return { tasa: tRaw === '' ? null : Number(tRaw), monto: mRaw === '' ? null : Number(mRaw), motivo: String(o.motivo || '').trim().slice(0, MOTIVO_PPM_MAX),
             por: o.por || null, at: o.at || null, calculado: r ? r.calculado : null, tasa_calculada: r ? r.tasaCalculada : null };
  }
  // sii_detalle guardado → edición (o null si no hay)
  function edicionPPMGuardada(det) {
    var e = det && typeof det === 'object' ? det.ppm_editado : null;
    return hayEdicionPPM(e) ? e : null;
  }
  // sii_detalle a guardar con la edición (o sin ella). null si queda vacío (la columna acepta null u objeto ≤ 4000 bytes).
  function detalleConEdicionPPM(det, e) {
    var d = det && typeof det === 'object' ? Object.assign({}, det) : {};
    delete d.ppm_editado;
    if (hayEdicionPPM(e)) d.ppm_editado = e;
    return Object.keys(d).length ? d : null;
  }
  // Tasa PPM (igual que Pre-IVA): la del Pre-IVA guardado del período → la última usada (historial) → la ficha del cliente.
  // Si el período tiene el PPM editado, la tasa de partida es la CALCULADA (la guardada en tasa_ppm puede ser la editada).
  function tasaPPMDesdeGuardado(fila, hist, fichaTasa) {
    var e = edicionPPMGuardada(fila && fila.sii_detalle);
    if (e && n(e.tasa_calculada) > 0) return { tasa: n(e.tasa_calculada), fuente: 'preiva', periodo: fila.periodo || null };
    if (fila && parseFloat(fila.tasa_ppm) > 0) return { tasa: parseFloat(fila.tasa_ppm), fuente: 'preiva', periodo: fila.periodo || null };
    var h = (hist || []).find(function (x) { return x && parseFloat(x.tasa_ppm) > 0; });
    if (h) return { tasa: parseFloat(h.tasa_ppm), fuente: 'historial', periodo: h.periodo || null };
    if (parseFloat(fichaTasa) > 0) return { tasa: parseFloat(fichaTasa), fuente: 'ficha', periodo: null };
    return { tasa: 0, fuente: null, periodo: null };
  }

  // ── Cálculo COMPLETO del F29 estimado — COMPARTIDO por Pre-IVA (calcular()) y Reporte Contable (tarjeta «Cálculo del F29») ──
  // Misma secuencia que siempre usó el Pre-IVA: proyección (solo mes en curso) → base PPM → PPM (con edición) → IVA a pagar + PPM.
  // o: { debitoRegistrado, creditoRegistrado, netoVentas (null = desconocido → débito ÷ 0,19), exentoVentas (null = sin dato),
  //      remanente (null = desconocido → sin total), tasa, edicionPPM, horizonte: {diasTranscurridos, diasRestantesMes, esMesActual} (de pre-iva/proyeccion.js) }
  // Reporte Contable suma aparte retención de honorarios e impuesto único (totalF29); Pre-IVA no los considera.
  function calcularF29Completo(o) {
    o = o || {}; var hz = o.horizonte || {};
    var debReg = n(o.debitoRegistrado), credReg = n(o.creditoRegistrado);
    var pry = proyectarMes({ debitoRegistrado: debReg, creditoRegistrado: credReg, diasTranscurridos: hz.diasTranscurridos, diasRestantes: hz.diasRestantesMes, esMesActual: hz.esMesActual });
    var b = calcularBasePPM({ debito: debReg, netoAfecto: o.netoVentas, exento: o.exentoVentas });
    var base = proyectarMes({ debitoRegistrado: b.base, creditoRegistrado: 0, diasTranscurridos: hz.diasTranscurridos, diasRestantes: hz.diasRestantesMes, esMesActual: hz.esMesActual }).debito;
    var P = aplicarEdicionPPM(base, o.tasa, o.edicionPPM);
    var r = calcularF29Estimado({ debito: pry.debito, credito: pry.credito, remanente: o.remanente, ppm: P.ppm });
    // 19-11 (Luciano): remanente null = DESCONOCIDO (el mes anterior no está declarado o falta su remanente). NUNCA se asume $0:
    // el IVA a pagar, el remanente nuevo y el total quedan null («Falta completar»); el PPM sí se calcula (no depende del remanente).
    var faltaRem = o.remanente === null;   // solo null explícito (sin el campo = 0, como antes)
    return { debito: pry.debito, credito: pry.credito, remanente: faltaRem ? null : Math.max(0, n(o.remanente)), faltaRemanente: faltaRem,
             ivaDeterminado: faltaRem ? null : r.ivaDeterminado, ivaPagar: faltaRem ? null : r.ivaPagar,
             nuevoRemanente: faltaRem ? null : r.nuevoRemanente, ppmBase: base, ppm: P.ppm, ppmCalculado: P.calculado, tasa: P.tasa, tasaCalculada: P.tasaCalculada,
             ppmEditado: P.editado, ppmModo: P.modo, ppmMotivo: P.motivo, ppmAvisos: n(P.tasa) > 0 && !(P.editado && P.modo === 'monto') ? b.avisos : [],
             sinTasa: !(n(o.tasa) > 0) && !P.editado, total: faltaRem ? null : r.total };
  }
  // Total a pagar del F29 en Reporte Contable = IVA a pagar + PPM + retención de honorarios + impuesto único (RR. HH.).
  function totalF29(r, retHon, iu) { return n(r && r.ivaPagar) + n(r && r.ppm) + n(retHon) + n(iu); }

  var api = { validarMonto: validarMonto, proyectarMes: proyectarMes, calcularF29Estimado: calcularF29Estimado, calcularBasePPM: calcularBasePPM,
              calcularPPM: calcularPPM, f29DesdeEdicion: f29DesdeEdicion, accionesSugeridas: accionesSugeridas,
              aplicarEdicionPPM: aplicarEdicionPPM, etiquetaPPMEditado: etiquetaPPMEditado, validarEdicionPPM: validarEdicionPPM,
              edicionPPMDesdeForm: edicionPPMDesdeForm, edicionPPMGuardada: edicionPPMGuardada, detalleConEdicionPPM: detalleConEdicionPPM,
              tasaPPMDesdeGuardado: tasaPPMDesdeGuardado, calcularF29Completo: calcularF29Completo, totalF29: totalF29 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  raiz.PreIvaF29 = api;
})(typeof window !== 'undefined' ? window : globalThis);
