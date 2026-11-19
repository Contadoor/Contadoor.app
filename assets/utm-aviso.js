// Aviso de UTM faltante (UTM-AVISO-1, 19-11-2026) · Pre-IVA y RR. HH.
// Regla (Luciano 08-11): se trabaja con un mes de desfase y con la UTM del MES EN CURSO (en diciembre se trabaja noviembre con la
// UTM de diciembre). Si public.utm_mensual no tiene la UTM del mes en curso → aviso ROJO (los cálculos que la usan quedan
// «por confirmar»). En los últimos 5 días del mes, si falta la del mes siguiente → aviso ÁMBAR para registrarla a tiempo.
// Solo AVISA: la UTM la registra el Master en Panel de control (nunca se escribe desde aquí).
// evaluar() es pura (node --test assets/utm-aviso.test.js); montar() consulta utm_mensual con sbFetch y nunca rompe la página.
(function (raiz) {
  'use strict';
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  function mesDe(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
  function nombre(mes) { var m = /^(\d{4})-(\d{2})$/.exec(mes); return m ? MESES[Number(m[2]) - 1] + ' ' + m[1] : mes; }

  // registrados: arreglo de 'AAAA-MM'; hoy: Date (hora de Chile del navegador).
  function evaluar(registrados, hoy) {
    var set = {}; (registrados || []).forEach(function (m) { set[String(m).slice(0, 7)] = true; });
    var actual = mesDe(hoy);
    var sig = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1);
    var siguiente = mesDe(sig);
    var ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
    if (!set[actual]) return { nivel: 'falta', mes: actual, texto: 'Falta registrar la UTM de ' + nombre(actual) + '. Sin ella, el remanente y los montos en UTM quedan «por confirmar». La registra el Master en Panel de control.' };
    if (ultimoDia - hoy.getDate() < 5 && !set[siguiente]) return { nivel: 'pronto', mes: siguiente, texto: 'Pronto: falta la UTM de ' + nombre(siguiente) + '. Regístrala en Panel de control apenas se publique (SII), antes del 1.' };
    return null;
  }

  function montar(contenedor, opciones) {
    var f = (opciones && opciones.fetcher) || (typeof raiz.sbFetch === 'function' ? raiz.sbFetch : null);
    var hoy = (opciones && opciones.hoy) || new Date();
    if (!f || !contenedor) return Promise.resolve(null);
    return f('utm_mensual?select=mes&order=mes.desc&limit=24', { method: 'GET' })
      .then(function (r) { return r && r.ok ? r.json() : null; })
      .then(function (filas) {
        if (!Array.isArray(filas)) return null;            // sin datos no se afirma nada
        var a = evaluar(filas.map(function (x) { return x.mes; }), hoy);
        if (!a) return null;
        var div = document.createElement('div');
        div.className = 'utm-aviso utm-aviso-' + a.nivel;
        div.setAttribute('role', 'status');
        div.style.cssText = 'margin:0 0 12px;padding:12px 16px;border-radius:14px;font-size:13px;line-height:1.45;' +
          (a.nivel === 'falta' ? 'background:rgba(224,122,110,.14);border:1px solid rgba(224,122,110,.45);color:#F6D4CF'
                               : 'background:rgba(255,210,77,.12);border:1px solid rgba(255,210,77,.35);color:#F1E2B0');
        var b = document.createElement('strong'); b.textContent = a.nivel === 'falta' ? '⚠️ UTM pendiente · ' : '🗓️ UTM próxima · ';
        var t = document.createElement('span'); t.textContent = a.texto + ' ';
        var l = document.createElement('a'); l.href = '../panel-de-control/'; l.textContent = 'Ir a Panel de control'; l.style.cssText = 'color:inherit;font-weight:700';
        div.appendChild(b); div.appendChild(t); div.appendChild(l);
        contenedor.insertBefore(div, contenedor.firstChild);
        return a;
      })
      .catch(function () { return null; });
  }

  var API = { evaluar: evaluar, montar: montar };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else raiz.GestoorUtmAviso = API;
})(typeof window !== 'undefined' ? window : globalThis);
