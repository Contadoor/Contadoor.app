// Vencimientos del ciclo mensual con feriados (RRHH-VENC-1, 19-11-2026) · función pura, SIN red ni DOM salvo cargarFeriados()
// (se prueba aparte: node --test assets/vencimientos.test.js).
// Reglas de Luciano (08-11-2026, memoria calendario-vencimientos-regla):
//   · Pago de cotizaciones en Previred: día 13. Si es inhábil (sábado, domingo o feriado) → día hábil ANTERIOR.
//   · Postergación (DNP): día 10. Si es inhábil → día hábil ANTERIOR (regla interna de Contadoor, más prudente que la ley).
// Feriados: public.feriados (SELECT para authenticated). Si no se pudieron cargar los feriados del año, se corre solo por fin de
// semana y se marca sinFeriados = true para que la pantalla lo diga (nunca se inventa un feriado).
(function (raiz) {
  'use strict';
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var ANIOS_CARGADOS = {};   // { 2026: true } cuando el año vino completo desde la base
  var FERIADOS = {};         // { 'AAAA-MM-DD': true }

  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

  // feriados: objeto {iso:true}, Set o arreglo de 'AAAA-MM-DD'; si se omite usa los cargados con cargarFeriados().
  function aMapa(feriados) {
    if (!feriados) return FERIADOS;
    if (Array.isArray(feriados)) { var m = {}; feriados.forEach(function (f) { m[String(f).slice(0, 10)] = true; }); return m; }
    if (typeof feriados.has === 'function') { var s = {}; feriados.forEach(function (f) { s[String(f).slice(0, 10)] = true; }); return s; }
    return feriados;
  }

  function esHabil(d, feriados) {
    var dow = d.getDay();
    if (dow === 0 || dow === 6) return false;
    return !aMapa(feriados)[iso(d)];
  }

  // Día `dia` del mes (mes 1..12); si es inhábil, retrocede al hábil anterior (máximo 15 días: nunca se queda pegado).
  function habilAnterior(anio, mes, dia, feriados) {
    var d = new Date(anio, mes - 1, dia, 12, 0, 0);
    for (var k = 0; k < 15 && !esHabil(d, feriados); k++) d.setDate(d.getDate() - 1);
    return d;
  }

  function info(anio, mes, dia, feriados, opciones) {
    var d = habilAnterior(anio, mes, dia, feriados);
    var conMapa = !!feriados || !!ANIOS_CARGADOS[anio];
    return {
      fecha: d,
      iso: iso(d),
      dia: d.getDate(),
      movido: d.getDate() !== dia,
      texto: d.getDate() + ' de ' + MESES[d.getMonth()] + ' de ' + d.getFullYear(),
      sinFeriados: !conMapa && !(opciones && opciones.ignorarAviso)
    };
  }

  // Período de remuneraciones 'AAAA-MM' → vencimientos del mes SIGUIENTE (las cotizaciones de octubre se pagan en noviembre).
  function mesPago(periodo) {
    var m = /^(\d{4})-(\d{2})$/.exec(String(periodo || ''));
    if (!m) return null;
    var y = Number(m[1]), mes = Number(m[2]) + 1;
    if (mes > 12) { mes = 1; y++; }
    return { anio: y, mes: mes };
  }

  function previred(periodo, feriados) { var p = mesPago(periodo); return p ? info(p.anio, p.mes, 13, feriados) : null; }
  function postergacion(periodo, feriados) { var p = mesPago(periodo); return p ? info(p.anio, p.mes, 10, feriados) : null; }

  // Carga los feriados de los años pedidos desde public.feriados con sbFetch (Gestoor). Nunca rechaza: si falla, queda sin feriados.
  function cargarFeriados(anios, fetcher) {
    var f = fetcher || (typeof raiz.sbFetch === 'function' ? raiz.sbFetch : null);
    if (!f) return Promise.resolve(false);
    var lista = (anios || []).filter(function (a) { return !ANIOS_CARGADOS[a]; });
    if (!lista.length) return Promise.resolve(true);
    var min = Math.min.apply(null, lista), max = Math.max.apply(null, lista);
    return f('feriados?select=fecha&fecha=gte.' + min + '-01-01&fecha=lte.' + max + '-12-31&order=fecha', { method: 'GET' })
      .then(function (r) { return r && r.ok ? r.json() : null; })
      .then(function (filas) {
        if (!Array.isArray(filas)) return false;
        filas.forEach(function (x) { if (x && x.fecha) FERIADOS[String(x.fecha).slice(0, 10)] = true; });
        // Un año cuenta como cargado solo si trae al menos un feriado (Chile siempre tiene; 0 filas = año aún no cargado en la base).
        lista.forEach(function (a) { if (filas.some(function (x) { return String(x.fecha).slice(0, 4) === String(a); })) ANIOS_CARGADOS[a] = true; });
        return true;
      })
      .catch(function () { return false; });
  }

  var API = { esHabil: esHabil, habilAnterior: habilAnterior, previred: previred, postergacion: postergacion, mesPago: mesPago,
              cargarFeriados: cargarFeriados, _reiniciar: function () { ANIOS_CARGADOS = {}; FERIADOS = {}; } };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else raiz.GestoorVencimientos = API;
})(typeof window !== 'undefined' ? window : globalThis);
