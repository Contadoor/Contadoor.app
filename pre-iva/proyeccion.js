// Pre-IVA · HORIZONTE de la proyección (función pura, sin red ni DOM; se prueba con node --test pre-iva/proyeccion.test.js).
// Hotfix 22-oct (confirmado por ChatGPT): la proyección del mes en curso termina el ÚLTIMO DÍA DEL MES TRIBUTARIO,
// no el día 20 del mes siguiente (vencimiento del F29). Antes se usaban los días hasta el vencimiento como "días restantes"
// y, por ejemplo, al 22-oct un registro de $1.000.000 se proyectaba a ~$2.272.727 en vez de ~$1.409.091.
//   · Mes en curso:  proyectado = registrado × (días del mes ÷ días transcurridos)  →  días restantes = días del mes − transcurridos.
//   · Mes cerrado (o futuro): NO se proyecta (se usa lo registrado).
//   · Días del mes: SIEMPRE los reales del período (calendario); un valor distinto escrito en pantalla se IGNORA.
//   · Días transcurridos: único dato corregible, entre 1 y los días del mes y, en el mes en curso, nunca más allá de hoy.
//   · Vencimiento del F29: referencia operativa CONFIGURABLE (CONFIG.diaVencimientoF29 = 20 del mes siguiente), no una regla
//     universal; es un dato SEPARADO que solo usan "días para actuar" y las acciones sugeridas.
// La fórmula del IVA/PPM/F29 (pre-iva/f29-formula.js) no cambia: aquí solo se decide cuántos días se proyectan.
(function (raiz) {
  'use strict';
  var CONFIG = { diaVencimientoF29: 20 };   // referencia operativa (no regla universal): día del mes siguiente
  var RE_PERIODO = /^(\d{4})-?(0[1-9]|1[0-2])$/;   // EXACTAMENTE 'AAAAMM' o 'AAAA-MM' (anclada a toda la cadena)
  function entero(x) { if (x === null || x === undefined || x === '') return null; var v = Number(x); return isFinite(v) && Math.floor(v) === v ? v : null; }
  function z(n) { return (n < 10 ? '0' : '') + n; }

  // o: {hoy: Date, periodo: 'AAAAMM' | 'AAAA-MM', diasTranscurridos, diasTotales (se ignora: solo informativo)}
  function horizonte(o) {
    var m = RE_PERIODO.exec(String(o && o.periodo != null ? o.periodo : ''));
    if (!m) throw new Error('PERIODO_INVALIDO');
    var anio = +m[1], mes = +m[2];
    var hoy = o.hoy instanceof Date ? o.hoy : new Date(o.hoy);
    var diasMes = new Date(anio, mes, 0).getDate();
    var esMesActual = hoy.getFullYear() === anio && hoy.getMonth() + 1 === mes;
    var pedidoTot = entero(o.diasTotales);
    var limite = esMesActual ? hoy.getDate() : diasMes;            // en el mes en curso, nunca más allá de hoy
    var pedidoTr = entero(o.diasTranscurridos), tr = pedidoTr;
    if (tr === null || tr < 1) tr = limite;                       // vacío, 0, negativo o con decimales → día de hoy / días del mes
    if (tr > limite) tr = limite;
    var restantesMes = esMesActual ? Math.max(0, diasMes - tr) : 0;
    var vm = mes === 12 ? 1 : mes + 1, va = mes === 12 ? anio + 1 : anio;
    var venc = new Date(va, vm - 1, CONFIG.diaVencimientoF29);
    var diasVenc = Math.max(0, Math.ceil((venc - hoy) / 864e5));
    return { esMesActual: esMesActual, diasMes: diasMes, diasTotales: diasMes, diasTranscurridos: tr, diasRestantesMes: restantesMes,
             diasTotalesIgnorado: pedidoTot !== null && pedidoTot !== diasMes, diasTranscurridosAjustado: pedidoTr !== tr,
             vencF29: va + '-' + z(vm) + '-' + z(CONFIG.diaVencimientoF29), diasVencF29: diasVenc };
  }

  var api = { horizonte: horizonte, CONFIG: CONFIG };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  raiz.PreIvaProyeccion = api;
})(typeof window !== 'undefined' ? window : globalThis);
