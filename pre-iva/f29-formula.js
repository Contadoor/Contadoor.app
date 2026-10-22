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

  var api = { proyectarMes: proyectarMes, calcularF29Estimado: calcularF29Estimado };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  raiz.PreIvaF29 = api;
})(typeof window !== 'undefined' ? window : globalThis);
