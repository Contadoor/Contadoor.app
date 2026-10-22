// Pre-IVA · HORIZONTE de la proyección (función pura, sin red ni DOM; se prueba con node --test pre-iva/proyeccion.test.js).
// Hotfix 22-oct (confirmado por ChatGPT): la proyección del mes en curso termina el ÚLTIMO DÍA DEL MES TRIBUTARIO,
// no el día 20 del mes siguiente (vencimiento del F29). Antes se usaban los días hasta el vencimiento como "días restantes"
// y, por ejemplo, al 22-oct un registro de $1.000.000 se proyectaba a ~$2.272.727 en vez de ~$1.409.091.
//   · Mes en curso:  proyectado = registrado × (días del mes ÷ días transcurridos)  →  días restantes = días del mes − transcurridos.
//   · Mes cerrado (o futuro): NO se proyecta (se usa lo registrado).
//   · El vencimiento del F29 (día 20 del mes siguiente) es un dato SEPARADO: solo para "días para actuar" y las acciones.
// La fórmula del IVA/PPM/F29 (pre-iva/f29-formula.js) no cambia: aquí solo se decide cuántos días se proyectan.
(function (raiz) {
  'use strict';
  function entero(x) { var v = Number(x); return isFinite(v) && Math.floor(v) === v ? v : null; }
  function z(n) { return (n < 10 ? '0' : '') + n; }

  // o: {hoy: Date, periodo: 'AAAAMM' | 'AAAA-MM', diasTranscurridos, diasTotales}
  //   diasTranscurridos / diasTotales vienen de la pantalla (se autollenan con el día de hoy y los días del mes; el analista
  //   puede corregirlos). Si faltan o son inválidos se usan el día de hoy y los días reales del mes (nunca un 22/31 fijo).
  function horizonte(o) {
    var p = String(o.periodo || '').replace('-', ''), anio = parseInt(p.slice(0, 4), 10), mes = parseInt(p.slice(4, 6), 10);
    if (!(anio > 1900) || !(mes >= 1 && mes <= 12)) throw new Error('PERIODO_INVALIDO');
    var hoy = o.hoy instanceof Date ? o.hoy : new Date(o.hoy);
    var diasMes = new Date(anio, mes, 0).getDate();
    var esMesActual = hoy.getFullYear() === anio && hoy.getMonth() + 1 === mes;
    var tot = entero(o.diasTotales); if (!(tot >= 28 && tot <= 31)) tot = diasMes;
    var tr = entero(o.diasTranscurridos); if (!(tr >= 1)) tr = esMesActual ? hoy.getDate() : tot;
    if (tr > tot) tr = tot;
    var restantesMes = esMesActual ? Math.max(0, tot - tr) : 0;
    // Vencimiento del F29: día 20 del mes siguiente (dato separado, mismo cálculo que tenía la pantalla)
    var vm = mes === 12 ? 1 : mes + 1, va = mes === 12 ? anio + 1 : anio;
    var venc = new Date(va, vm - 1, 20);
    var diasVenc = Math.max(0, Math.ceil((venc - hoy) / 864e5));
    return { esMesActual: esMesActual, diasMes: diasMes, diasTotales: tot, diasTranscurridos: tr, diasRestantesMes: restantesMes,
             vencF29: va + '-' + z(vm) + '-20', diasVencF29: diasVenc };
  }

  var api = { horizonte: horizonte };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  raiz.PreIvaProyeccion = api;
})(typeof window !== 'undefined' ? window : globalThis);
