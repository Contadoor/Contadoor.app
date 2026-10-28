// Remanente de IVA del período anterior (REM-ANT-2) · presentación única para Reporte Contable, Panel y Pre-IVA, SIN red ni DOM
// (se prueba aparte: node --test assets/remanente-anterior.test.js).
// La REGLA vive en la base: public.remanente_anterior(rut, periodo) → {estado: CONOCIDO | SIN_DATO | CONFLICTO, fuente, cod77, cod504, ...}.
//   · cód. 77 = remanente del F29 del período anterior (dato fuente, tal cual).
//   · cód. 504 = 77 reajustado por UTM (art. 27 DL 825): 77 × UTM(mes de presentación del período) ÷ UTM(mes de presentación del anterior).
// Aquí solo se traduce esa respuesta a pantalla. Fail-closed: todo lo que no sea CONOCIDO bloquea y NUNCA se usa 0 en silencio
// ("cero confirmado" = CONOCIDO con 77 = 0; "sin dato" = SIN_DATO).
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
  function pesos(n) { return '$' + Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function entero(x) { var v = Number(x); return (x !== null && x !== undefined && x !== '' && isFinite(v) && v >= 0 && v === Math.floor(v)) ? v : null; }

  var MOTIVOS = {
    SIN_MES_ANTERIOR: function (a) { return 'Falta el remanente de ' + a + ': Gestoor no tiene ese reporte. Ingresa el código 77 del F29 de ' + a + ' (si no hubo remanente, ingresa 0).'; },
    MES_ANTERIOR_SIN_VALIDAR: function (a) { return 'El Pre-IVA de ' + a + ' no está validado: valídalo primero (de ahí sale el remanente).'; },
    MES_ANTERIOR_SIN_MONTO: function (a) { return 'El reporte de ' + a + ' está validado pero sin remanente para el mes siguiente: hay que revisarlo (vacío no es $0).'; },
    SIN_UTM: function (a, i) { return 'Falta la UTM oficial de ' + ((i && i.falta_utm) || []).map(nombreMes).join(' y ') + ' para reajustar el remanente (la registra el Master desde sii.cl).'; },
    PERIODO_INVALIDO: function () { return 'Período inválido.'; }
  };

  // o = { periodo, lecturaOk (bool), info (respuesta de remanente_anterior o null) }
  function resolver(o) {
    o = o || {};
    var i = o.info || null;
    var perAnt = (i && typeof i === 'object' && /^\d{4}-\d{2}$/.test(i.periodo_anterior || '')) ? i.periodo_anterior : periodoAnterior(o.periodo), mesAnt = nombreMes(perAnt);   // manda lo que respondió la base
    var base = { monto: 0, cod77: null, cod504: null, fuente: null, estado: 'SIN_DATO', bloquea: true, periodoAnterior: perAnt, manual: null, detalle: '', aviso: '', conflicto: null };
    if (o.lecturaOk === false || (!i && o.lecturaOk !== true)) {
      base.fuente = 'sin_lectura';
      base.aviso = 'No se pudo leer el remanente anterior: recarga la página antes de validar (no se puede asumir $0).';
      return base;
    }
    if (!i) { base.fuente = 'falta'; base.aviso = MOTIVOS.SIN_MES_ANTERIOR(mesAnt); return base; }
    if (typeof i !== 'object' || Array.isArray(i) || !i.estado) {   // respuesta inesperada → no se puede asumir nada
      base.fuente = 'sin_lectura'; base.aviso = 'Respuesta inesperada al leer el remanente anterior: recarga la página antes de validar.'; return base;
    }
    base.estado = i.estado;
    var c77 = entero(i.cod77), c504 = entero(i.cod504);
    base.cod77 = c77; base.cod504 = c504;
    if ((i.estado === 'CONOCIDO' || i.estado === 'CONFLICTO') && c77 !== null && c504 !== null) {
      base.detalle = 'Cód. 77 de ' + mesAnt + ': ' + pesos(c77) + ' × UTM ' + nombreMes(i.mes_utm_destino) + ' ' + pesos(i.utm_destino) +
                     ' ÷ UTM ' + nombreMes(i.mes_utm_origen) + ' ' + pesos(i.utm_origen) + ' = cód. 504 ' + pesos(c504);
    }
    if (i.fuente === 'F29_MANUAL') {
      base.manual = i.manual || {};
    }
    if (i.estado === 'CONOCIDO' && c77 !== null && c504 !== null) {
      base.monto = c504; base.bloquea = false;
      if (i.fuente === 'F29_MANUAL') {
        base.fuente = 'manual';
        var m = base.manual;
        base.aviso = 'Remanente ingresado a mano' + (m.usuario_nombre ? ' por ' + m.usuario_nombre : '') +
          (m.registrado_at ? ' el ' + String(m.registrado_at).slice(0, 10).split('-').reverse().join('-') : '') + (m.motivo ? ' · ' + m.motivo : '') +
          (m.conflicto_decision === 'MANTENER_MANUAL' ? ' · el Master decidió mantenerlo frente al reporte de ' + mesAnt : '');
      } else {
        base.fuente = 'mes_anterior';
      }
      return base;
    }
    if (i.estado === 'CONFLICTO') {
      base.fuente = 'conflicto';
      base.conflicto = { manual: c77, mesAnterior: entero(i.mes_anterior_cod77) };
      base.aviso = 'Conflicto: el reporte de ' + mesAnt + ' trae cód. 77 ' + pesos(i.mes_anterior_cod77) + ' y el ingresado a mano es ' + pesos(c77) +
                   '. Nada se sobrescribe: el Master decide cuál manda (queda auditado).';
      return base;
    }
    base.fuente = i.motivo === 'SIN_MES_ANTERIOR' ? 'falta' : 'sin_dato';
    base.aviso = (MOTIVOS[i.motivo] || function () { return 'Remanente anterior sin confirmar (' + (i.motivo || i.estado) + ').'; })(mesAnt, i);
    return base;
  }

  var api = { resolver: resolver, periodoAnterior: periodoAnterior, nombreMes: nombreMes, pesos: pesos };
  if (typeof module === 'object' && module.exports) module.exports = api; else raiz.RemanenteAnterior = api;
})(typeof window !== 'undefined' ? window : this);
