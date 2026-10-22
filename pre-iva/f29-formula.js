// Pre-IVA · fórmula del F29 estimado, SIN acceso a red ni al DOM (se prueba aparte: node --test pre-iva/f29-formula.test.js).
// Lógica del F29 (igual que Contable en reportes-contable/index.html):
//   · IVA determinado = débito − crédito − remanente del mes anterior.
//       Si es negativo → queda como remanente a favor para el mes siguiente y el IVA a pagar es $0.
//   · Total F29 estimado = IVA a pagar (nunca negativo) + PPM.
//   · El remanente de crédito fiscal solo se imputa contra IVA: NUNCA rebaja el PPM, y el PPM NUNCA genera remanente.
// Esta pantalla no considera retenciones de honorarios ni impuesto único (eso lo valida Contable).
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

  var api = { validarMonto: validarMonto, proyectarMes: proyectarMes, calcularF29Estimado: calcularF29Estimado, calcularBasePPM: calcularBasePPM,
              calcularPPM: calcularPPM, f29DesdeEdicion: f29DesdeEdicion, accionesSugeridas: accionesSugeridas };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  raiz.PreIvaF29 = api;
})(typeof window !== 'undefined' ? window : globalThis);
