/* ============================================================
   assets/gestoor-cartera.js — utilidades comunes de Cobranza y Trabajos especiales
   (formato contable, escape HTML, íconos, ventana lateral, modales, aviso flotante y acceso a datos).
   · Todo texto que viene de la base o del usuario pasa por GC.esc() antes de entrar al HTML.
   · Acceso real: sbFetch (supabase.js) con el JWT del usuario; nunca la clave anon como Bearer.
   · "No disponible" nunca se muestra como $0: GC.clp(null) → "No disponible".
   ============================================================ */
(function(){
'use strict';
var HOST=location.hostname, LOCAL=(HOST==='localhost'||HOST==='127.0.0.1'||HOST==='[::1]');

var PX={
  cerrar:'<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  info:'<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  escudo:'<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  moneda:'<circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 18V6"/>',
  plus:'<path d="M5 12h14"/><path d="M12 5v14"/>',
  maletin:'<path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect width="20" height="14" x="2" y="6" rx="2"/>',
  tendencia:'<path d="M16 7h6v6"/><path d="m22 7-8.5 8.5-5-5L2 17"/>',
  persona:'<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>',
  pausa:'<rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/>',
  archivo:'<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>',
  tabla:'<path d="M12 3v18"/><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/>',
  columnas:'<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/><path d="M15 3v18"/>',
  historial:'<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>'
};
function svg(n){
  if(PX[n])return '<svg class="g-ic" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">'+PX[n]+'</svg>';
  return window.gIcon?window.gIcon(n):'';
}
function I(n,c){return '<i class="ic '+(c||'')+'">'+svg(n)+'</i>';}

function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function miles(n){return Math.round(Math.abs(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g,'.');}
function esNum(n){return n!==null&&n!==undefined&&n!==''&&isFinite(Number(n));}
function clp(n){if(!esNum(n))return '<span class="nd">No disponible</span>';n=Number(n);return (n<0?'−':'')+'$'+miles(n);}
function clpT(n){if(!esNum(n))return 'No disponible';n=Number(n);return (n<0?'−':'')+'$'+miles(n);}
function pct(x){return esNum(x)?Number(x).toLocaleString('es-CL',{maximumFractionDigits:1})+' %':'<span class="nd">No disponible</span>';}
function fFecha(iso){if(!iso)return '—';var p=String(iso).slice(0,10).split('-');return p.length===3?esc(p[2]+'-'+p[1]+'-'+p[0]):esc(iso);}
function fHora(iso){if(!iso)return '';var d=new Date(iso);if(isNaN(d))return '';function z(n){return (n<10?'0':'')+n;}return z(d.getDate())+'-'+z(d.getMonth()+1)+'-'+d.getFullYear()+' · '+z(d.getHours())+':'+z(d.getMinutes());}
/* Hoy en Chile (solo para mostrar diferencias de días; el estado lo calcula el motor en el servidor) */
function hoyCL(){
  try{var p=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());return p;}
  catch(e){var d=new Date();return d.toISOString().slice(0,10);}
}
function dias(desde,hasta){if(!desde||!hasta)return null;var a=Date.parse(String(desde).slice(0,10)+'T00:00:00Z'),b=Date.parse(String(hasta).slice(0,10)+'T00:00:00Z');if(isNaN(a)||isNaN(b))return null;return Math.round((b-a)/86400000);}
function $(id){return document.getElementById(id);}
function uuid(){
  if(window.crypto&&crypto.randomUUID)return crypto.randomUUID();
  var b=new Uint8Array(16);crypto.getRandomValues(b);b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;
  var h=Array.prototype.map.call(b,function(x){return ('0'+x.toString(16)).slice(-2);}).join('');
  return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);
}

/* ── Datos ── */
function errSrv(status,texto){
  var j=null;try{j=JSON.parse(texto);}catch(e){}
  var e=new Error((j&&j.message)||texto||('HTTP '+status));
  e.srv={code:j&&j.code,message:(j&&j.message)||texto||'',status:status};
  return e;
}
function leer(r){if(!r.ok)return r.text().then(function(t){throw errSrv(r.status,t);});return r.status===204?null:r.json();}
var API={
  get:function(path){return sbFetch(path).then(leer);},
  rpc:function(fn,args){return sbFetch('rpc/'+fn,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(args||{})}).then(leer);}
};
/* Traduce un error del servidor a un texto claro. mapa: {CODIGO: 'texto'}. Muestra el código para soporte. */
function msgError(e,mapa){
  var m=(e&&e.srv&&e.srv.message)||(e&&e.message)||'Error desconocido';
  if(m==='GESTOOR_NO_SESSION')return 'Tu sesión terminó. Vuelve a ingresar.';
  if(/Failed to fetch|NetworkError/i.test(m))return 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.';
  var cod=(m.match(/^([A-Z0-9_]{4,})/)||[])[1];
  if(cod&&mapa&&mapa[cod])return mapa[cod]+' ('+cod+')';
  if(e&&e.srv&&e.srv.status===401)return 'Tu sesión terminó. Vuelve a ingresar.';
  if(e&&e.srv&&(e.srv.code==='42501'||e.srv.status===403))return 'No tienes permiso para esta acción. '+m;
  return m;
}

/* ── Aviso flotante ── */
var tt=null;
function toast(msg,err){
  var t=$('gcToast');if(!t)return;
  t.className='gc-toast on'+(err?' err':'');t.innerHTML=I(err?'alerta':'check',err?'ic-roj':'ic-ver')+'<span>'+esc(msg)+'</span>';
  clearTimeout(tt);tt=setTimeout(function(){t.className='gc-toast'+(err?' err':'');},err?7000:4200);
}

/* ── Ventana lateral de detalle ── */
var ultimoFoco=null;
function abrirDet(html){
  var d=$('gcDet'),v=$('gcVelo');ultimoFoco=document.activeElement;
  $('gcDetCuerpo').innerHTML=html;d.hidden=false;
  requestAnimationFrame(function(){d.classList.add('on');v.classList.add('on');var c=$('gcDetCerrar');if(c)c.focus();});
}
function cerrarDet(){
  var d=$('gcDet'),v=$('gcVelo');if(!d)return;d.classList.remove('on');v.classList.remove('on');
  setTimeout(function(){if(!d.classList.contains('on'))d.hidden=true;},260);
  if(ultimoFoco&&ultimoFoco.focus)try{ultimoFoco.focus();}catch(e){}
}
/* ── Modal ── opts: {titulo, html, ok, okClase, cancelar, alAceptar(cuerpo) → Promise|false} */
var modalAbierto=null;
function modal(opts){
  cerrarModal();
  var v=document.createElement('div');v.className='gc-mvelo';
  var m=document.createElement('div');m.className='gc-modal';m.setAttribute('role','dialog');m.setAttribute('aria-modal','true');m.setAttribute('aria-labelledby','gcMTit');
  m.innerHTML='<h3 id="gcMTit">'+esc(opts.titulo||'')+'</h3><div class="gc-mcuerpo">'+(opts.html||'')+'</div><p class="merr" id="gcMErr" role="alert"></p>'
    +'<div class="acciones fin"><button type="button" class="btn sec" data-m="no">'+esc(opts.cancelar||'Cancelar')+'</button>'
    +(opts.ok===false?'':'<button type="button" class="btn '+(opts.okClase||'')+'" data-m="si">'+esc(opts.ok||'Confirmar')+'</button>')+'</div>';
  document.body.appendChild(v);document.body.appendChild(m);
  modalAbierto={v:v,m:m,foco:document.activeElement};
  v.addEventListener('click',cerrarModal);
  m.querySelector('[data-m="no"]').addEventListener('click',cerrarModal);
  var si=m.querySelector('[data-m="si"]');
  if(si)si.addEventListener('click',function(){
    if(si.disabled)return;
    var err=m.querySelector('#gcMErr');err.textContent='';
    var r;try{r=opts.alAceptar?opts.alAceptar(m):null;}catch(ex){err.textContent=ex.message;return;}
    if(r===false)return;
    if(r&&typeof r.then==='function'){
      si.disabled=true;var txt=si.innerHTML;si.innerHTML='<span class="gc-spin"></span>Guardando…';
      r.then(function(ok){if(ok!==false)cerrarModal();else{si.disabled=false;si.innerHTML=txt;}})
       .catch(function(ex){si.disabled=false;si.innerHTML=txt;err.textContent=ex&&ex.message?ex.message:String(ex);});
    }else cerrarModal();
  });
  if(opts.alAbrir)opts.alAbrir(m);
  var f=m.querySelector('input,select,textarea,button.btn:not(.sec)');if(f)setTimeout(function(){f.focus();},30);
  return m;
}
function cerrarModal(){
  if(!modalAbierto)return;var a=modalAbierto;modalAbierto=null;
  a.v.remove();a.m.remove();if(a.foco&&a.foco.focus)try{a.foco.focus();}catch(e){}
}
document.addEventListener('keydown',function(e){
  if(e.key!=='Escape')return;
  if(modalAbierto){cerrarModal();return;}
  var d=$('gcDet');if(d&&d.classList.contains('on'))cerrarDet();
});

window.GC={LOCAL:LOCAL,I:I,svg:svg,esc:esc,miles:miles,esNum:esNum,clp:clp,clpT:clpT,pct:pct,fFecha:fFecha,fHora:fHora,hoyCL:hoyCL,dias:dias,
  $:$,uuid:uuid,API:API,msgError:msgError,toast:toast,abrirDet:abrirDet,cerrarDet:cerrarDet,modal:modal,cerrarModal:cerrarModal};
})();
