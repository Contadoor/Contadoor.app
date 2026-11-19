/* ============================================================
   clientes/onboarding-ficha.js — ONBOARDING-L2 (19-11-2026): avance del onboarding en la ficha del cliente.
   · Solo para clientes que vinieron de Comercial → Onboarding. onb_pasos_cliente devuelve NULL si el cliente no vino de ahí
     o si quien mira no es Master, Comercial ni su analista asignado: en ese caso no se muestra nada.
   · Muestra solo lo que falta (modo compacto) y deja marcar los pasos del área de quien mira. Datos solo por RPC.
   Uso: OnbFicha.montar(elemento, clienteId)
   ============================================================ */
(function () {
  'use strict';
  var seq = 0;
  function rpc(fn, args) {
    if (typeof window.sbFetch !== 'function') return Promise.reject(new Error('SIN_CONEXION'));
    return window.sbFetch('rpc/' + fn, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(args || {}) }).then(function (r) {
      return r.json().catch(function () { return null; }).then(function (j) {
        if (!r.ok) { var e = new Error((j && j.message) || ('HTTP ' + r.status)); e.status = r.status; throw e; }
        return j;
      });
    });
  }
  function montar(cont, clienteId) {
    if (!cont || !window.OnbPasos) return;
    var mio = ++seq; cont.textContent = '';
    rpc('onb_pasos_cliente', { p_cliente_id: Number(clienteId) }).then(function (d) {
      if (mio !== seq || !d) return;                       // no vino de Onboarding o no corresponde: nada
      window.OnbPasos.render(cont, d, { rpc: rpc, compacto: true, enlaceCaso: true, recargar: function () { montar(cont, clienteId); } });
    }).catch(function () { /* la ficha sigue igual si el onboarding no responde */ });
  }
  window.OnbFicha = { montar: montar };
})();
