// Remanente de IVA del período anterior · regla única para Reporte Contable y Pre-IVA, SIN red ni DOM
// (se prueba aparte: node --test assets/remanente-anterior.test.js).
// Fail-closed: si el reporte del mes anterior NO existe y nadie registró el remanente a mano, NO se usa 0 en silencio:
// se devuelve fuente 'falta' (o 'sin_lectura' si no se pudo leer) para que la pantalla muestre la alerta y no deje validar.
//   · 'mes_anterior'            → existe el reporte del mes anterior: su iva_remanente_sig manda (como hasta hoy).
//   · 'mes_anterior_sin_validar'→ existe, pero su Pre-IVA no está validado: se usa su valor y se avisa (no bloquea).
//   · 'manual'                  → no existe el mes anterior y el analista registró el remanente (RPC registrar_remanente_anterior_manual).
//   · 'falta' / 'sin_lectura'   → monto 0 SOLO como marcador; bloquea = true.
(function (raiz) {
  'use strict';
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  function periodoAnterior(periodo) {
    var m = /^(\d{4})-(\d{2})$/.exec(String(periodo || ''));
    if (!m) return null;
    var y = Number(m[1]), mes = Number(m[2]) - 1;
    if (mes < 1) { mes = 12; y--; }
    return y + '-' + String(mes).padStart(2, '0');
  }
  function nombreMes(periodo) {
    var m = /^(\d{4})-(\d{2})$/.exec(String(periodo || ''));
    return m ? MESES[Number(m[2]) - 1] + ' ' + m[1] : String(periodo || '');
  }
  function num(x) { var v = Number(x); return isFinite(v) ? v : 0; }

  // o = { periodo, lecturaOk (bool: se pudo leer el mes anterior), filaAnterior: {ivaRemanenteSig, estadoContable} | null,
  //       ajustes: pre_f29_ajustes del reporte ACTUAL (objeto o null) }
  function resolver(o) {
    o = o || {};
    var perAnt = periodoAnterior(o.periodo);
    var mesAnt = nombreMes(perAnt);
    var fila = o.filaAnterior || null;
    if (fila) {
      var monto = Math.max(0, num(fila.ivaRemanenteSig));
      if (fila.estadoContable !== 'completado') {
        return { monto: monto, fuente: 'mes_anterior_sin_validar', bloquea: false, periodoAnterior: perAnt, manual: null,
                 aviso: 'El Pre-IVA de ' + mesAnt + ' no está validado: el remanente anterior puede estar incompleto.' };
      }
      return { monto: monto, fuente: 'mes_anterior', bloquea: false, periodoAnterior: perAnt, manual: null, aviso: '' };
    }
    var man = o.ajustes && typeof o.ajustes === 'object' ? o.ajustes.remanente_anterior_manual : null;
    if (man && man.monto !== undefined && man.monto !== null && isFinite(Number(man.monto)) && Number(man.monto) >= 0) {
      return { monto: Number(man.monto), fuente: 'manual', bloquea: false, periodoAnterior: perAnt, manual: man,
               aviso: 'Remanente ingresado a mano' + (man.usuario_nombre ? ' por ' + man.usuario_nombre : '') +
                      (man.registrado_at ? ' el ' + String(man.registrado_at).slice(0, 10).split('-').reverse().join('-') : '') +
                      (man.motivo ? ' · ' + man.motivo : '') };
    }
    if (o.lecturaOk === false) {
      return { monto: 0, fuente: 'sin_lectura', bloquea: true, periodoAnterior: perAnt, manual: null,
               aviso: 'No se pudo leer el reporte de ' + mesAnt + ': recarga la página antes de validar (el remanente anterior no se puede asumir en $0).' };
    }
    return { monto: 0, fuente: 'falta', bloquea: true, periodoAnterior: perAnt, manual: null,
             aviso: 'Falta el remanente de ' + mesAnt + ': Gestoor no tiene ese reporte. Ingrésalo desde el F29 de ' + mesAnt + ' (código 77; si no hubo, ingresa 0).' };
  }

  var api = { resolver: resolver, periodoAnterior: periodoAnterior, nombreMes: nombreMes };
  if (typeof module === 'object' && module.exports) module.exports = api; else raiz.RemanenteAnterior = api;
})(typeof window !== 'undefined' ? window : this);
