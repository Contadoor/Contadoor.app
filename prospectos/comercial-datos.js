/* ============================================================
   prospectos/comercial-datos.js — acceso a datos y utilidades comunes de Reuniones y Bitácora (Comercial C1)
   · Datos SOLO por RPC con el JWT del usuario: sbFetch de supabase.js (nunca la clave anon como Bearer, sin sbH propio).
   · Modo demostración: solo con ?demo=1 en localhost (candado en el HTML + comercial-demo.js); nunca se conecta a Supabase.
   · Todo texto de la base pasa por esc() antes de entrar al HTML.
   ============================================================ */
(function(){
'use strict';
var H=location.hostname, LOCAL=(H==='localhost'||H==='127.0.0.1'||H==='[::1]');
var DEMO=!!(window.COM_DEMO&&LOCAL);

function rpc(fn,args){
  if(DEMO){
    if(!window.ComDemo)return Promise.reject(new Error('DEMO_NO_CARGADA'));
    return window.ComDemo.rpc(fn,args||{});
  }
  return sbFetch('rpc/'+fn,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(args||{})}).then(function(r){
    return r.json().catch(function(){return null;}).then(function(j){
      if(!r.ok){var e=new Error((j&&j.message)||('HTTP '+r.status));e.hint=j&&j.hint;e.status=r.status;throw e;}
      return j;
    });
  });
}
// Mensajes claros para Luciano y el equipo (nunca el texto técnico crudo).
var MSJ={NO_SESSION:'Tu sesión expiró. Vuelve a ingresar.',GESTOOR_NO_SESSION:'Tu sesión expiró. Vuelve a ingresar.',
  SIN_PERMISO:'Este módulo es solo para Master, Comercial y Pagos.',SIN_IDENTIDAD:'Tu usuario no está activo en Gestoor. Pídele al Master que lo revise.',
  SIN_PERMISO_ESCRITURA:'Solo el Master o el equipo Comercial pueden abrir y editar bitácoras.',NO_EXISTE:'No encontramos esa reunión (o no está asignada a ti).',
  RESERVA_NO_VIGENTE:'Esa reserva fue cancelada: no se puede abrir una bitácora.',BITACORA_CERRADA:'La bitácora ya está cerrada.',
  VERSION_CONFLICTO:'Esta bitácora se guardó desde otra pestaña o equipo.',CLAVE_PROHIBIDA:'Las claves nunca se anotan en la bitácora.',
  SII_SOLO_SI_NO:'Para el SII solo se anota si tiene acceso (sí / no).',FALTA_TEMPERATURA:'Elige la temperatura del prospecto.',
  FALTA_PROXIMO_PASO:'Falta el próximo paso y su fecha (nunca “cualquier cosa me avisas”).',FALTA_MOTIVO_PERDIDA:'Elige el motivo de pérdida.',
  FECHA_INVALIDA:'La fecha del próximo paso debe ser de hoy en adelante.',NOMBRE_INVALIDO:'Escribe el nombre del prospecto (mínimo 2 letras).',
  PARAMETROS_INVALIDOS:'Falta indicar qué reunión abrir.',NOTA_MUY_LARGA:'Una nota supera los 4.000 caracteres.'};
function mensaje(e){
  var m=String(e&&e.message||e||'');
  for(var k in MSJ)if(m.indexOf(k)>=0)return MSJ[k];
  if(/Failed to fetch|NetworkError|load failed/i.test(m))return 'Sin conexión. Reintentando…';
  return 'No se pudo completar. Intenta de nuevo.';
}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
var TZ='America/Santiago';
function ymd(d){return (d instanceof Date?d:new Date(d)).toLocaleDateString('en-CA',{timeZone:TZ});}
function hoy(){return ymd(new Date());}
function sumarDias(y,n){var p=String(y).split('-');var d=new Date(Date.UTC(+p[0],+p[1]-1,+p[2]+n,12));return d.toISOString().slice(0,10);}
function habilSiguiente(y){var d=sumarDias(y,1);for(var i=0;i<4;i++){var w=new Date(d+'T12:00:00Z').getUTCDay();if(w!==0&&w!==6)return d;d=sumarDias(d,1);}return d;}
function hora(iso){return new Date(iso).toLocaleTimeString('es-CL',{timeZone:TZ,hour:'2-digit',minute:'2-digit',hourCycle:'h23'});}
function diaLargo(y){var p=String(y).split('-');return new Date(Date.UTC(+p[0],+p[1]-1,+p[2],12)).toLocaleDateString('es-CL',{timeZone:'UTC',weekday:'long',day:'numeric',month:'short'});}
function fechaHora(iso){if(!iso)return '—';var d=new Date(iso);return d.toLocaleDateString('es-CL',{timeZone:TZ,day:'numeric',month:'short'})+' · '+hora(iso);}
function iniciales(n){var p=String(n||'').trim().split(/\s+/).filter(Boolean);if(!p.length)return '?';return ((p[0][0]||'')+(p.length>1?p[p.length-1][0]:'')).toUpperCase();}
function origen(l){
  var o=String(l&&l.origen||'').toLowerCase(), cam=l&&l.campana?String(l.campana):'';
  var base=o==='manual'?'Sin reserva':/whats/.test(o+cam.toLowerCase())?'WhatsApp':/insta|ig|manychat/.test(o+cam.toLowerCase())?'Instagram':o==='agenda'?'Agenda web':(o?o:'Sin dato');
  return {txt:base,campana:cam};
}
var ESTADO_RES={confirmada:['Confirmada','cel'],realizada:['Realizada','verde'],no_asistio:['No asistió','rojo'],cancelada:['Cancelada','gris'],inconsistente:['Revisar en Outlook','ambar']};
var TEMP={caliente:'🔥 Caliente',tibio:'🌤 Tibio',frio:'❄️ Frío'};
function toast(m){var t=document.getElementById('cmToast');if(!t){t=document.createElement('div');t.id='cmToast';t.className='cm-toast';t.setAttribute('role','status');document.body.appendChild(t);}
  t.textContent=m;t.classList.add('on');clearTimeout(t._t);t._t=setTimeout(function(){t.classList.remove('on');},2800);}
function avatarResp(r,tam){
  var n=r&&r.nombre?r.nombre:'';
  if(window.GEquipo)return window.GEquipo.avatar(n,{tam:tam||'xs'});
  return '<span class="geq-av'+(tam?' geq-'+tam:'')+'">'+esc(n?iniciales(n):'?')+'</span>';
}
// Cuando el JWT está listo (o al tiro en modo demo).
function alListo(fn){
  var hecho=false;function una(){if(hecho)return;hecho=true;fn();}
  if(DEMO){setTimeout(una,0);return;}
  window.addEventListener('gestoor-auth-ready',una,{once:true});
  if(window._sbAuthReady===true&&window._gestoorAccessToken)una();
}
window.ComDatos={DEMO:DEMO,rpc:rpc,mensaje:mensaje,esc:esc,ymd:ymd,hoy:hoy,sumarDias:sumarDias,habilSiguiente:habilSiguiente,hora:hora,diaLargo:diaLargo,
  fechaHora:fechaHora,iniciales:iniciales,origen:origen,ESTADO_RES:ESTADO_RES,TEMP:TEMP,toast:toast,avatarResp:avatarResp,alListo:alListo};
})();
