/* ============================================================
   assets/enlace-directo.js — MARCHA-BLANCA (24-11-2026)
   Los avisos de la campana llevan enlace DIRECTO al registro (p. ej. /reportes-contable/index.html?reporte=123).
   GestoorEnlace.alCargar(param, intentar): lee ?param=valor UNA vez y llama intentar(valor) cada 400 ms (máx. 30 s) hasta que
   devuelva true (la página ya cargó sus datos y abrió el registro). Solo lectura: nunca aplica ni guarda nada.
   ============================================================ */
(function(){
  'use strict';
  function leer(param){
    try{ var v=new URLSearchParams(location.search).get(param); return v&&/^\d{1,18}$/.test(v)?v:null; }catch(e){ return null; }
  }
  function alCargar(param, intentar){
    var v=leer(param); if(!v||typeof intentar!=='function') return false;
    var t0=Date.now();
    (function mirar(){
      var listo=false;
      try{ listo=intentar(v)===true; }catch(e){ listo=false; }
      if(!listo&&Date.now()-t0<30000) setTimeout(mirar,400);
    })();
    return true;
  }
  window.GestoorEnlace={leer:leer, alCargar:alCargar};
})();
