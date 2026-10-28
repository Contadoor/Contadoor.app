/* ============================================================
   pir/preparacion.js — MiRenta · "Preparemos tu Renta 2027" (respuestas del mini-sitio contadoor.github.io/renta)
   Conectada SOLO a las RPC de la migración 202610271500_prep_renta (cada una valida rol y asignación en el servidor):
     prep_renta_cartera · prep_renta_detalle · prep_renta_aplicar · prep_renta_resolver_aplicacion ·
     prep_renta_reabrir · prep_renta_config_fijar
   + la Edge renta-cuenta-ver ("Ver número": descifra en el servidor solo para el asesor asignado o el Master y registra el acceso).
   Los analistas asignados SOLO PROPONEN cambios; el Master los aprueba (acción explícita y auditada).
   Línea Cartera → detalle (regla del sistema). Cuentas bancarias SIEMPRE enmascaradas (••••1234); el número completo se pide
   con un botón, queda en auditoría y no se guarda en la página. "Aplicar a la ficha" aplica solo lo marcado: lo NUEVO viene
   marcado (completa campos vacíos), lo CORREGIDO se muestra lado a lado y queda sin marcar hasta que el usuario lo elija.
   Modo demostración: ver preparacion-demo.js (solo ?demo=1 en localhost).
   ============================================================ */
(function(){
'use strict';

var HOST=location.hostname, LOCAL=(HOST==='localhost'||HOST==='127.0.0.1'||HOST==='[::1]');
var DEMO=window.PR_DEMO===true&&LOCAL&&!!window.PR_DEMO_API;

/* ── Íconos (trazo estilo Lucide) ── */
var PX={
  'flecha-izq':'<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>','flecha-der':'<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  lupa:'<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',cerrar:'<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  info:'<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  alerta:'<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  check:'<path d="M20 6 9 17l-5-5"/>',ojo:'<path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3"/>',
  personas:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  edificio:'<rect width="16" height="20" x="4" y="2" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01"/>',
  banco:'<path d="M3 22h18"/><path d="M6 18v-7"/><path d="M10 18v-7"/><path d="M14 18v-7"/><path d="M18 18v-7"/><path d="m12 2 8 5H4z"/>',
  objetivo:'<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  calendario:'<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
  lapiz:'<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>',
  descargar:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  escudo:'<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  megafono:'<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
  deshacer:'<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>',
  portapapeles:'<rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
  llave:'<path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4"/><path d="m21 2-9.6 9.6"/><circle cx="7.5" cy="15.5" r="5.5"/>'
};
function ic(n){return PX[n]?'<svg class="g-ic" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">'+PX[n]+'</svg>':(window.gIcon?window.gIcon(n):'');}
function I(n,c){return '<i class="ic '+(c||'')+'">'+ic(n)+'</i>';}
function pintarIconos(root){(root||document).querySelectorAll('[data-ic]').forEach(function(el){el.innerHTML=ic(el.getAttribute('data-ic'));el.removeAttribute('data-ic');});}

/* ── Formato ── */
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function miles(n){return Math.round(Math.abs(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g,'.');}
function clpT(n){if(n==null||isNaN(n))return 'Sin monto';return '$'+miles(Number(n));}
function pctT(n){return n==null?'—':(Math.round(Number(n)*100)/100).toString().replace('.',',')+' %';}
function fFecha(iso){if(!iso)return '—';var p=String(iso).slice(0,10).split('-');return p[2]+'-'+p[1]+'-'+p[0];}
function fHora(iso){if(!iso)return '';var d=new Date(iso);if(isNaN(d))return '';function z(n){return (n<10?'0':'')+n;}return z(d.getDate())+'-'+z(d.getMonth()+1)+'-'+d.getFullYear()+' · '+z(d.getHours())+':'+z(d.getMinutes());}
function rutF(r){if(!r)return '—';var p=String(r).split('-');return p[0].replace(/\B(?=(\d{3})+(?!\d))/g,'.')+'-'+p[1];}
function $(id){return document.getElementById(id);}
function norm(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');}

/* ── Acceso a datos: real (supabase.js con el JWT del usuario) o demostración local ── */
function leer(r){if(!r.ok)return r.text().then(function(t){var j=null;try{j=JSON.parse(t);}catch(e){}var e=new Error((j&&j.message)||t||('HTTP '+r.status));e.code=j&&j.code;e.status=r.status;throw e;});return r.status===204?null:r.json();}
var API=DEMO?window.PR_DEMO_API:{rpc:function(fn,args){return sbFetch('rpc/'+fn,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(args||{})}).then(leer);},
  // Edge con el JWT del usuario (nunca la clave anon como Bearer): el servidor decide el permiso y registra el acceso.
  edge:function(fn,body){var t=window._gestoorAccessToken;if(!t)return Promise.reject(new Error('GESTOOR_NO_SESSION'));
    return fetch(SB_URL+'/functions/v1/'+fn,{method:'POST',headers:{'Content-Type':'application/json',apikey:SB_KEY,Authorization:'Bearer '+t},body:JSON.stringify(body||{})})
      .then(function(r){return r.json().catch(function(){return {};}).then(function(j){if(!r.ok||!j.ok){var e=new Error(j.error||('HTTP '+r.status));e.status=r.status;throw e;}return j;});});}};

var ERRORES={
  SIN_PERMISO:'No tienes permiso: Preparemos tu Renta lo ve el Master y el analista contable asignado al cliente.',
  RP_CONFLICTO:'La ficha cambió mientras revisabas (otra persona la editó). Recarga y vuelve a elegir: no se aplicó nada.',
  RP_ELECCION_NO_APLICABLE:'Uno de los cambios ya no se puede aplicar (por ejemplo, ya está igual en la ficha). Recarga la respuesta.',
  RP_ELECCION_INVALIDA:'La selección no es válida. Recarga la respuesta.',
  RP_APLICACION_PENDIENTE:'Ya hay cambios de esta respuesta esperando la aprobación del Master.',
  RP_APLICACION_NO_PENDIENTE:'Esa propuesta ya fue resuelta. Recarga la pantalla.',
  RP_SOCIOS_NO_SUMAN_100:'Con esa selección los % de los socios en la ficha no suman 100. Marca también los demás socios que cambiaron (o quita el socio que salió).',
  RP_NO_ENVIADA:'El cliente todavía no envía su respuesta.',
  RP_MOTIVO_REQUERIDO:'Escribe el motivo (al menos 5 caracteres).',
  RP_CLAVE_NO_EXISTE:'Esa clave ya no existe. Recarga la respuesta.',
  RP_CLAVE_NO_DESCARTABLE:'Esa clave ya fue promovida, descartada o caducó. Recarga la respuesta.',
  RP_EN_REVISION:'Otro Master la está promoviendo en este momento. Intenta en unos minutos.',
  RP_CORREO_INVALIDO:'El correo que escribió el cliente no tiene un formato válido: no se aplicó. Confírmalo con el cliente.',
  RP_CONFIG_INVALIDA:'Elige al menos una tanda.',
  RP_SIN_NUMERO:'Esta cuenta no tiene número (es "vigente" o "sin cuenta").',
  SIN_SESION:'Tu sesión no está activa. Vuelve a ingresar a Gestoor.',
  SIN_NUMERO:'Esta cuenta no tiene número (es "vigente" o "sin cuenta").',
  NO_DISPONIBLE:'No se pudo descifrar la cuenta en este momento (avisa al Master).',
  'Solo Master, Analista Pagos o Analista Comercial pueden crear o editar clientes':'La ficha solo la puede cambiar el Master.'
};
function textoError(e){
  var m=(e&&e.message)||String(e||''), code=e&&e.code;
  if(m==='GESTOOR_NO_SESSION'||m==='GESTOOR_SDK_TIMEOUT')return 'Tu sesión no está activa. Vuelve a ingresar a Gestoor.';
  if(code==='PGRST202'||code==='42883'||(e&&e.status===404&&/function|Could not find/i.test(m)))return 'NO_INSTALADO';
  var k=m.split(':')[0].trim();
  return ERRORES[k]||ERRORES[m]||'El servidor respondió: '+esc(m);
}

/* ── Vocabulario ── */
var ESTADOS={sin_enviar:['Sin enviar','gris',0],codigo_pedido:['Código pedido','ambar',25],en_curso:['En curso','lila',60],respondido:['Respondido','verde',100]};
var PLANES={asesoria:'PRO',estrategico:'Estratégico',cumplimiento:'Cumplimiento'};
var TIPOS={validado:['Validado','verde'],igual:['Igual','gris'],nuevo:['Nuevo','cel'],corregido:['Corregido','ambar'],quitado:['Quitado','rojo'],sin_dato:['Sin dato','gris'],informativo:['Informativo','lila']};
var OBJ={menos:'Pagar lo menos posible, dentro de la ley',retiros:'Retirar utilidades',reinvertir:'Reinvertir en la empresa',inversion:'Hacer una inversión',bancos:'Ser más solvente para los bancos',deudas:'Ordenar deudas tributarias o previsionales',regimen:'Cambiar de régimen tributario',otro:'Otro objetivo'};
var OTROS={sueldo_otra:'Sueldo en otra empresa',honorarios:'Boletas de honorarios',arriendos:'Arriendos',otras_sociedades:'Otras sociedades'};
var EVENTOS={venta_activos:'Venta de activos',socios:'Entrada o salida de socios',contratacion:'Contratación de personal',prestamo_socio_empresa:'Préstamos de socios a la empresa',prestamo_empresa_socio:'Préstamos de la empresa a socios',ninguno:'Ninguno'};
var VENTAS={mas:'Más que en 2025',igual:'Parecido a 2025',menos:'Menos que en 2025',nose:'No sabe'};
var TIPO_CTA={corriente:'Cuenta corriente',vista:'Cuenta vista / CuentaRUT',ahorro:'Cuenta de ahorro'};
var SINO={si:'Sí',no:'No',nose:'No sabe',tal_vez:'Tal vez'};

var S={vista:'cartera',d:null,cart:{filas:[],cargando:true,error:null,q:'',estado:'todos',tanda:'1',resp:window.GEquipo.leerUrl()},cfg:null,elig:{}};

function app(h){$('prApp').innerHTML=h;pintarIconos($('prApp'));}
function toast(h){var t=$('prToast');t.innerHTML=h;pintarIconos(t);t.classList.add('on');clearTimeout(toast.t);toast.t=setTimeout(function(){t.classList.remove('on');},4200);}
function modal(titulo,cuerpo,botones){
  $('prModalCuerpo').innerHTML='<h3 id="prModalTit">'+esc(titulo)+'</h3>'+cuerpo+'<p class="mrp-merr" id="prMerr" role="alert"></p><div class="mrp-acciones fin"><button type="button" class="btn sec" data-m="no">Cerrar</button>'+(botones||'')+'</div>';
  pintarIconos($('prModalCuerpo'));$('prModal').hidden=false;$('prVelo').classList.add('on');
  setTimeout(function(){var f=$('prModalCuerpo').querySelector('textarea,input:not([type=checkbox]),[data-m="no"]');if(f)f.focus();},30);
}
function cerrarModal(){$('prModal').hidden=true;$('prVelo').classList.remove('on');$('prModalCuerpo').innerHTML='';}
function urlEstado(){try{var p=new URLSearchParams(location.search);if(S.vista==='detalle'&&S.d)p.set('c',S.d.cliente.id);else p.delete('c');window.GEquipo.escribirUrl(p,S.cart.resp);
  var q=p.toString();history.replaceState(null,'',location.pathname+(q?'?'+q:''));}catch(e){}}

/* ═══ Pantalla 1 · Cartera ═══ */
function cargarCartera(){
  S.cart.cargando=true;S.cart.error=null;if(S.vista==='cartera')renderCartera();
  API.rpc('prep_renta_cartera',{}).then(function(r){
    S.cfg={periodo:r.periodo,abierto:r.abierto,planes:r.planes||[],es_master:!!r.es_master,yo:r.yo};
    S.cart.filas=(r.filas||[]).map(function(f){f.resp=f.analista_nombre||'';f.resp_id=f.analista_id;return f;});
    S.cart.cargando=false;botonCampana();if(S.vista==='cartera')renderCartera();
  },function(e){S.cart.cargando=false;S.cart.error=e;if(S.vista==='cartera')renderCartera();});
}
function botonCampana(){
  var b=$('prCampana');if(!b||!S.cfg)return;
  b.hidden=!S.cfg.es_master;
  b.querySelector('span').textContent=S.cfg.abierto?'Campaña abierta · tanda '+(S.cfg.planes.indexOf('cumplimiento')>=0?'1 y 2':'1'):'Campaña cerrada';
  b.classList.toggle('pr-cerrada',!S.cfg.abierto);
}
function pasaFiltros(f,sinEstado){
  var C=S.cart;
  if(C.tanda!=='todas'&&String(f.tanda)!==C.tanda)return false;
  if(!sinEstado&&C.estado!=='todos'){if(C.estado==='por_aplicar'){if(!(f.estado==='respondido'&&!f.aplicada_at))return false;}else if(f.estado!==C.estado)return false;}
  if(!window.GEquipo.pasa(f,C.resp))return false;
  var q=norm(C.q.trim());if(q&&norm(f.razon_social+' '+f.rut+' '+f.resp).indexOf(q)<0)return false;
  return true;
}
function renderCartera(){
  urlEstado();
  var C=S.cart, act=document.activeElement, enB=act&&act.id==='prBuscar', pos=enB?act.selectionStart:0;
  var h='<div class="mrc-cab"><div><h2 class="mrp-titulo">Preparemos tu <span>Renta 2027</span></h2><p class="mrp-preg">Socios, cuentas y objetivos que nos envía cada cliente desde contadoor.github.io/renta, para planificar antes del 31 de diciembre.</p></div>'
    +(S.cfg?'<span class="estado '+(S.cfg.abierto?'verde':'gris')+'">'+I(S.cfg.abierto?'check':'info',S.cfg.abierto?'ic-ver':'ic-cel')+(S.cfg.abierto?'Enlace abierto':'Enlace cerrado')+'</span>':'')+'</div>';
  if(C.error){var t=textoError(C.error);
    app(h+(t==='NO_INSTALADO'?'<div class="aviso ambar">'+I('alerta','ic-amb')+'<span>Preparemos tu Renta todavía no está instalado en este ambiente.</span></div>'
      :'<div class="aviso rojo fuerte">'+I('alerta','ic-roj')+'<span>'+t+'</span> <button type="button" class="btn sec chico" data-act="recargar">Reintentar</button></div>'));return;}
  if(C.cargando){app(h+'<div class="aviso lila"><span class="mrp-spin"></span>Cargando la cartera…</div>');return;}
  var EQ=window.GEquipo, baseT=C.filas.filter(function(f){return C.tanda==='todas'||String(f.tanda)===C.tanda;});
  var rOpts=EQ.opciones(baseT,function(f){var g=C.resp;C.resp=EQ.TODOS;var ok=pasaFiltros(f,true);C.resp=g;return ok;});
  if(C.resp!==EQ.TODOS&&!rOpts.some(function(x){return x.clave===C.resp;}))C.resp=EQ.TODOS;
  var rTot=rOpts.reduce(function(s,x){return s+x.n;},0);
  var vis=C.filas.filter(function(f){return pasaFiltros(f);}), base=C.filas.filter(function(f){return pasaFiltros(f,true);});
  var n=function(fn){return base.filter(fn).length;};
  var nRes=n(function(f){return f.estado==='respondido';}), nCur=n(function(f){return f.estado==='en_curso';}), nCod=n(function(f){return f.estado==='codigo_pedido';}),
      nSin=n(function(f){return f.estado==='sin_enviar';}), nApl=n(function(f){return f.estado==='respondido'&&!f.aplicada_at;}), nPend=n(function(f){return f.aplicacion_pendiente;}),
      nMail=n(function(f){return !f.correo_ok;});
  var av=base.length?Math.round(nRes/base.length*100):0;
  h+='<section class="mrc-tot pr-tot" aria-label="Totales">'
    +'<div class="mrc-k"><small>Clientes</small><b>'+base.length+'</b><span>'+(C.tanda==='1'?'tanda 1 · PRO + Estratégico':C.tanda==='2'?'tanda 2 · Cumplimiento con contabilidad':'todas las tandas')+'</span></div>'
    +'<div class="mrc-k verde"><small>Respondidos</small><b>'+nRes+'</b><span>'+nApl+' por aplicar a la ficha'+(nPend?' · '+nPend+' esperando al Master':'')+'</span></div>'
    +'<div class="mrc-k"><small>En curso</small><b>'+nCur+'</b><span>borrador guardado, sin enviar</span></div>'
    +'<div class="mrc-k ambar"><small>Código pedido</small><b>'+nCod+'</b><span>entraron con su RUT y no avanzaron</span></div>'
    +'<div class="mrc-k rojo"><small>Sin enviar</small><b>'+nSin+'</b><span>'+(nMail?nMail+' sin correo válido en la ficha':'no han entrado')+'</span></div>'
    +'<div class="mrc-k ancho"><small>Avance de respuestas</small>'+barra(av,av+' % respondido',nRes+' de '+base.length+' clientes')+'<span>Respondido = el cliente envió el formulario con la declaración aceptada.</span></div>'
    +'</section>';
  var EST=[['todos','Todos'],['respondido','Respondidos'],['por_aplicar','Por aplicar'],['en_curso','En curso'],['codigo_pedido','Código pedido'],['sin_enviar','Sin enviar']];
  h+='<div class="mrc-filtros"><label class="mrc-buscar"><span class="sr">Buscar cliente, RUT o responsable</span>'+I('lupa','ic-cel')+'<input type="search" id="prBuscar" placeholder="Buscar cliente, RUT o responsable…" value="'+esc(C.q)+'" autocomplete="off"></label>'
    +'<div class="g-seg mrc-seg" role="group" aria-label="Tanda">'+[['1','Tanda 1 · PRO + Estratégico'],['2','Tanda 2 · Cumplimiento'],['todas','Todas']].map(function(x){
      return '<button type="button" class="fb'+(C.tanda===x[0]?' on':'')+'" aria-pressed="'+(C.tanda===x[0])+'" data-tanda="'+x[0]+'">'+esc(x[1])+'</button>';}).join('')+'</div>'
    +(rOpts.length?EQ.filtroHtml(rOpts,C.resp,rTot):'')
    +'<div class="g-seg mrc-seg" role="group" aria-label="Estado">'+EST.map(function(x){var k=x[0], c=k==='todos'?null:k==='por_aplicar'?nApl:n(function(f){return f.estado===k;});
      return '<button type="button" class="fb'+(C.estado===k?' on':'')+'" aria-pressed="'+(C.estado===k)+'" data-estado="'+k+'">'+esc(x[1])+(c!=null?' <b>'+c+'</b>':'')+'</button>';}).join('')+'</div>'
    +'<button type="button" class="btn sec chico" data-act="csv">'+I('descargar','ic-ver')+'Descargar (Excel/CSV)</button></div>';
  if(!vis.length)h+='<div class="aviso gris">'+I('info','ic-cel')+'<span>'+(C.filas.length?'Ningún cliente coincide con los filtros.':'No hay clientes en tu cartera para esta campaña.')+'</span></div>';
  else h+='<div class="mrc-tabla-box"><table class="cmp mrc-tabla"><caption class="sr">Una fila por cliente</caption><thead><tr><th scope="col">Cliente</th><th scope="col">Responsable</th><th scope="col">Última actividad</th><th scope="col">Avance</th><th scope="col">Estado</th><th scope="col"><span class="sr">Acciones</span></th></tr></thead><tbody>'
    +vis.sort(function(a,b){return ESTADOS[b.estado][2]-ESTADOS[a.estado][2]||a.razon_social.localeCompare(b.razon_social,'es');}).map(filaCartera).join('')+'</tbody></table></div>';
  h+='<p class="nota">Estados: Sin enviar (no ha entrado) → Código pedido (escribió su RUT) → En curso (guardó un borrador) → Respondido (envió con la declaración). Las cuentas bancarias nunca aparecen en esta lista.</p>';
  app(h);
  if(enB){var b=$('prBuscar');if(b){b.focus();try{b.setSelectionRange(pos,pos);}catch(e){}}}
}
function barra(pct,txt,sub){
  var w=Math.max(0,Math.min(100,pct||0));
  return '<div class="mrc-cob pr-av '+(w>=100?'verde':w>=50?'ambar':'gris')+'"><div class="mrc-cob-barra" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+w+'" aria-label="Avance"><i style="width:'+w+'%"></i></div><div class="mrc-cob-txt"><b>'+esc(txt)+'</b>'+(sub?'<span>'+esc(sub)+'</span>':'')+'</div></div>';
}
function filaCartera(f){
  var e=ESTADOS[f.estado]||ESTADOS.sin_enviar, sem=f.estado==='respondido'?(f.aplicada_at?'verde':'ambar'):f.estado==='sin_enviar'?'gris':'ambar';
  var fecha=f.enviada_at?'<b>Enviado '+fFecha(f.enviada_at)+'</b>':f.actualizada_at?'<b>Borrador '+fFecha(f.actualizada_at)+'</b>':f.codigo_pedido_at?'<b>Código '+fFecha(f.codigo_pedido_at)+'</b>':'<span class="nd">Sin actividad</span>';
  if(f.aplicada_at)fecha+='<small>Aplicado a la ficha '+fFecha(f.aplicada_at)+'</small>';
  var chips='<span class="estado gris mini pr-plan">'+esc(PLANES[f.plan]||f.plan||'—')+'</span>'+(f.regimen?'<span class="estado gris mini">'+esc(f.regimen)+'</span>':'')
    +(!f.correo_ok?'<span class="estado rojo mini">'+I('alerta','ic-roj')+'Sin correo válido en la ficha</span>':'')+(f.aplicacion_pendiente?'<span class="estado ambar mini">Esperando al Master</span>':'')
    +(f.habilitado===false&&f.correo_ok?'<span class="estado gris mini">Tanda no habilitada</span>':'')
    +(f.claves_pendientes>0?'<span class="estado ambar mini">'+I('llave','ic-amb')+f.claves_pendientes+' clave'+(f.claves_pendientes===1?'':'s')+' SII pendiente'+(f.claves_pendientes===1?'':'s')+'</span>':'')
    +(f.claves_por_promover>0?'<span class="estado lila mini">'+I('llave','ic-mor')+f.claves_por_promover+' clave'+(f.claves_por_promover===1?'':'s')+' SII por promover</span>':'');
  var obj=(f.objetivos||[]).slice(0,3).map(function(k){return OBJ[k]||k;}).join(' · ');
  var bot=f.estado==='respondido'||f.estado==='en_curso'?'<button type="button" class="btn chico'+(f.estado==='respondido'&&!f.aplicada_at?' mrc-destacar':'')+'" data-act="ver" data-cli="'+f.cliente_id+'">'+I('flecha-der')+(f.estado==='respondido'?'Ver respuesta':'Ver borrador')+'</button>'
    :'<button type="button" class="btn sec chico" data-act="ver" data-cli="'+f.cliente_id+'">'+I('ojo','ic-cel')+'Ver</button>';
  return '<tr class="mrc-fila p-'+sem+'"><td data-l="Cliente"><div class="mrc-cli"><b>'+esc(f.razon_social)+'</b><small class="mrc-mot">'+rutF(f.rut)+'</small><div class="pr-chips">'+chips+'</div>'
      +(obj?'<small class="mrc-sug">'+I('objetivo','ic-ama')+esc(obj)+'</small>':'')+'</div></td>'
    +'<td data-l="Responsable">'+window.GEquipo.celda(f.resp)+'</td>'
    +'<td data-l="Última actividad"><div class="mrc-fecha">'+fecha+'</div></td>'
    +'<td data-l="Avance">'+barra(e[2],e[2]+' %','')+'</td>'
    +'<td data-l="Estado"><span class="estado '+e[1]+'">'+esc(e[0])+'</span></td>'
    +'<td class="mrc-accs"><div class="mrc-accs-in">'+bot+'</div></td></tr>';
}
function csvCelda(x){if(x==null)return '';var s=String(x);if(/^[=+\-@\t\r]/.test(s))s="'"+s;return /[;"\n\r]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;}
function descargarCsv(){
  var fs=S.cart.filas.filter(function(f){return pasaFiltros(f);}), hoy=new Date().toISOString().slice(0,10);
  var L=[['Cliente','RUT','Plan','Tanda','Responsable','Estado','Código pedido','Último borrador','Enviado','Aplicado a la ficha','Correo válido en ficha','Objetivos'].map(csvCelda).join(';')];
  fs.forEach(function(f){L.push([f.razon_social,rutF(f.rut),PLANES[f.plan]||f.plan,f.tanda,f.resp||'Sin asignar',ESTADOS[f.estado][0],fFecha(f.codigo_pedido_at),fFecha(f.actualizada_at),fFecha(f.enviada_at),fFecha(f.aplicada_at),
    f.correo_ok?'Sí':'No',(f.objetivos||[]).map(function(k){return OBJ[k]||k;}).join(' · ')].map(csvCelda).join(';'));});
  var blob=new Blob(['﻿'+L.join('\r\n')],{type:'text/csv;charset=utf-8'}), url=URL.createObjectURL(blob), a=document.createElement('a');
  a.href=url;a.download='Preparemos_tu_Renta_2027_'+hoy+'.csv';document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(url);a.remove();},500);
  toast(I('check','ic-ver')+' Lista descargada ('+fs.length+' cliente'+(fs.length===1?'':'s')+'). Sin cuentas bancarias.');
}

/* ═══ Pantalla 2 · Detalle de un cliente ═══ */
function abrirDetalle(id){
  S.vista='detalle';S.d=null;S.elig={};window.scrollTo({top:0});
  app('<button type="button" class="btn sec chico" data-act="volver">'+I('flecha-izq','ic-cel')+'Volver a la cartera</button><div class="aviso lila" style="margin-top:12px"><span class="mrp-spin"></span>Cargando la respuesta…</div>');
  API.rpc('prep_renta_detalle',{p_cliente_id:+id}).then(function(d){S.d=d;
    // Preselección: lo NUEVO (completa un campo vacío) viene marcado; lo corregido y lo quitado, sin marcar.
    (d.comparacion||[]).forEach(function(x,i){if(x.aplicable&&x.tipo==='nuevo')S.elig[i]=true;});
    renderDetalle();},function(e){app('<button type="button" class="btn sec chico" data-act="volver">'+I('flecha-izq','ic-cel')+'Volver a la cartera</button><div class="aviso rojo fuerte" style="margin-top:12px">'+I('alerta','ic-roj')+'<span>'+textoError(e)+'</span></div>');});
}
function valor(x,cual){
  var v=x[cual];
  if(v==null||v==='')return '<span class="nd">'+(cual==='actual'?'Vacío en la ficha':'—')+'</span>';
  if(x.clave==='socio')return '<b>'+esc(v.nombre||'—')+'</b><small>'+pctT(v.pct)+'</small>';
  if(x.clave==='cuenta'){
    if(cual==='cliente'&&v.modo==='vigente')return '<b>La registrada está vigente</b>';
    if(cual==='cliente'&&v.modo==='sin_cuenta')return '<b>Sin cuenta</b><small>Cheque al domicilio del SII · '+(v.direccion_sii==='cambio'?'<span class="t-ambar">la dirección cambió</span>':'dirección vigente')+'</small>';
    return '<b>'+esc(v.banco||'')+'</b><small>'+esc(TIPO_CTA[v.tipo]||v.tipo||'')+' · ••••'+esc(v.ultimos4||'')+'</small>';
  }
  return esc(v);
}
function etiqueta(x){
  if(x.clave==='socio')return 'Socio · '+rutF(x.rut);
  if(x.clave==='cuenta')return esc(x.etiqueta)+(x.titular==='socio'?' · '+rutF(x.rut):'');
  return esc(x.etiqueta);
}
function etqAplicar(n){var c=' ('+n+' cambio'+(n===1?'':'s')+')';return S.d&&S.d.es_master?'Aprobar y aplicar a la ficha'+c:'Proponer al Master'+c;}
function seleccion(){var d=S.d;return (d.comparacion||[]).map(function(x,i){return S.elig[i]&&x.aplicable?{i:i,x:x}:null;}).filter(Boolean);}
function renderDetalle(){
  var d=S.d, c=d.cliente, r=d.respuesta;urlEstado();
  var h='<div class="pr-det-top"><button type="button" class="btn sec chico" data-act="volver">'+I('flecha-izq','ic-cel')+'Volver a la cartera</button>'
    +'<button type="button" class="btn sec chico" data-act="recargar-det">'+I('deshacer','ic-cel')+'Recargar</button></div>';
  h+='<div class="mrc-cab"><div><h2 class="mrp-titulo">'+esc(c.razon_social)+'</h2><p class="mrp-preg">'+rutF(c.rut)+' · '+esc(PLANES[c.plan]||c.plan||'')+' · régimen '+esc(c.regimen||'—')+'</p></div>'
    +(r?'<span class="estado '+(r.estado==='enviada'?'verde':'lila')+'">'+(r.estado==='enviada'?'Respondido el '+fHora(r.enviada_at):'Borrador · '+fHora(r.actualizada_at))+'</span>':'<span class="estado gris">Sin respuesta</span>')+'</div>';
  if(!r){
    h+='<div class="aviso gris">'+I('info','ic-cel')+'<span>Este cliente todavía no guarda nada. '+(d.codigos&&d.codigos.n?'Pidió el código '+d.codigos.n+' vez/veces (último: '+fHora(d.codigos.ultimo_at)+', envío del correo: '+esc(d.codigos.ultimo_envio||'—')+').':'No ha pedido el código.')+'</span></div>';
    app(h);return;
  }
  if(r.reabierta_at)h+='<div class="aviso ambar">'+I('deshacer','ic-amb')+'<span>Devuelta al cliente el '+fHora(r.reabierta_at)+': '+esc(r.reabierta_motivo||'')+'</span></div>';
  // Alertas para el asesor
  var al=alertas(d);
  if(al.length)h+='<div class="aviso ambar pr-alertas">'+I('alerta','ic-amb')+'<div><b>Para revisar</b><ul>'+al.map(function(x){return '<li>'+x+'</li>';}).join('')+'</ul></div></div>';
  // Aplicación pendiente
  var pend=(d.aplicaciones||[]).filter(function(a){return a.estado==='PENDIENTE';})[0];
  if(pend)h+='<div class="aviso lila pr-pend">'+I('escudo','ic-mor')+'<span><b>Cambios esperando la aprobación del Master</b> · propuestos por '+esc(pend.solicitada_por||'—')+' el '+fHora(pend.solicitada_at)+' ('+pend.elecciones.length+' cambio'+(pend.elecciones.length===1?'':'s')+(pend.motivo?': '+esc(pend.motivo):'')+').</span>'
    +(d.es_master?'<span class="pr-pend-acc"><button type="button" class="btn chico" data-act="aprobar" data-id="'+pend.id+'">'+I('check')+'Aprobar y aplicar</button><button type="button" class="btn sec chico" data-act="rechazar" data-id="'+pend.id+'">Rechazar</button></span>':'')+'</div>';
  // Comparación con la ficha
  var cmp=d.comparacion||[], aplicables=cmp.filter(function(x){return x.aplicable;}).length;
  h+='<section class="card pr-card" style="--acc:var(--cel)"><div class="h"><h2>'+I('edificio','ic-cel')+' Comparación con la <span>ficha</span></h2><small>'+cmp.length+' datos · '+aplicables+' se pueden aplicar</small></div>'
    +'<p class="t2">Lo <b class="t-cel">nuevo</b> completa campos vacíos y viene marcado. Lo <b class="t-ambar">corregido</b> se muestra lado a lado y se aplica solo si lo marcas. Nada se aplica sin tu elección.</p>'
    +'<div class="mrc-tabla-box"><table class="cmp mrc-tabla pr-cmp"><thead><tr><th scope="col">Dato</th><th scope="col">En la ficha hoy</th><th scope="col">Lo que dice el cliente</th><th scope="col">Tipo</th><th scope="col">Aplicar</th></tr></thead><tbody>'
    +cmp.map(function(x,i){var t=TIPOS[x.tipo]||[x.tipo,'gris'];
      var ver=x.clave==='cuenta'&&x.cliente&&x.cliente.modo==='cuenta'?' <button type="button" class="link pr-ver" data-act="ver-num" data-origen="respuesta" data-rut="'+esc(x.rut)+'">'+I('ojo','ic-cel')+'Ver número</button>':'';
      return '<tr class="pr-t-'+x.tipo+'"><td data-l="Dato"><b>'+etiqueta(x)+'</b></td><td data-l="En la ficha hoy"><div class="pr-v">'+valor(x,'actual')+'</div></td>'
        +'<td data-l="Lo que dice el cliente"><div class="pr-v">'+(x.tipo==='validado'?'<span class="t-verde">'+I('check','ic-ver')+' Está correcto</span>':valor(x,'cliente'))+ver+'</div></td>'
        +'<td data-l="Tipo"><span class="estado '+t[1]+'">'+esc(t[0])+'</span></td>'
        +'<td data-l="Aplicar">'+(x.aplicable&&r.estado==='enviada'?'<label class="pr-chk"><input type="checkbox" data-elig="'+i+'"'+(S.elig[i]?' checked':'')+(pend?' disabled':'')+'><span>'+(x.tipo==='quitado'?'Quitar de la ficha':x.tipo==='corregido'?'Usar lo del cliente':'Agregar')+'</span></label>':'<span class="nd">—</span>')+'</td></tr>';}).join('')
    +'</tbody></table></div>';
  if(r.estado==='enviada'&&aplicables&&!pend){var n=seleccion().length;
    h+='<div class="mrp-acciones pr-apl"><button type="button" class="btn" data-act="aplicar"'+(n?'':' disabled')+'>'+I('check')+etqAplicar(n)+'</button>'
      +'<small class="t3">'+(d.es_master?'Tu aprobación queda registrada (quién, cuándo y qué campos) y se aplica de inmediato.':'Como analista solo propones: el Master aprueba o rechaza (se le avisa en la campana).')+'</small></div>';}
  h+='</section>';
  // Respuesta completa
  h+=resumen(d);
  // Cuentas registradas en la ficha
  if((d.cuentas_ficha||[]).length)h+='<section class="card pr-card" style="--acc:var(--verde)"><div class="h"><h2>'+I('banco','ic-ver')+' Cuentas registradas en la <span>ficha</span></h2></div><ul class="pr-lista">'
    +d.cuentas_ficha.map(function(k){return '<li><b>'+(k.titular==='empresa'?'Empresa':'Socio '+esc(k.titular_nombre||rutF(k.titular_rut)))+'</b> · '+esc(k.banco)+' · '+esc(TIPO_CTA[k.tipo]||k.tipo)+' · ••••'+esc(k.ultimos4)
      +' <button type="button" class="link pr-ver" data-act="ver-num" data-origen="ficha" data-id="'+k.id+'">'+I('ojo','ic-cel')+'Ver número</button><small class="t3"> · actualizada '+fFecha(k.actualizado_at)+'</small></li>';}).join('')+'</ul></section>';
  // Historial
  var hist=(d.aplicaciones||[]).filter(function(a){return a.estado!=='PENDIENTE';});
  if(hist.length)h+='<section class="card pr-card" style="--acc:var(--lila)"><div class="h"><h2>'+I('calendario','ic-mor')+' Registro de <span>cambios</span></h2></div><ul class="pr-lista">'
    +hist.map(function(a){return '<li><span class="estado '+(a.estado==='APLICADA'?'verde':'rojo')+' mini">'+(a.estado==='APLICADA'?'Aprobada y aplicada':'Rechazada')+'</span> '+fHora(a.resuelta_at)+' · '+(a.estado==='APLICADA'?'aprobó ':'rechazó ')+esc(a.resuelta_por||'—')
      +(a.solicitada_por&&a.solicitada_por!==a.resuelta_por?' (propuesta de '+esc(a.solicitada_por)+')':'')+(a.resolucion_motivo?' · '+esc(a.resolucion_motivo):'')
      +(a.resultado&&a.resultado.length?'<ul>'+a.resultado.map(function(z){return '<li>'+esc(z.campo==='socio'?'Socio '+rutF(z.rut):z.campo==='cuenta'?'Cuenta '+rutF(z.rut):z.campo==='email'?'Correo oficial':z.campo==='contacto'?'Responsable':z.campo)+': '+esc(txtV(z.antes))+' → '+esc(txtV(z.despues))+'</li>';}).join('')+'</ul>':'')+'</li>';}).join('')+'</ul></section>';
  if(r.estado==='enviada')h+='<div class="mrp-acciones"><button type="button" class="btn sec chico" data-act="reabrir"'+(pend?' disabled':'')+'>'+I('deshacer','ic-amb')+'Devolver al cliente para corregir</button><small class="t3">El cliente podrá editar y volver a enviar (con el mismo enlace y un código nuevo).</small></div>';
  app(h);
}
function txtV(v){if(v==null)return 'vacío';if(typeof v==='object')return (v.nombre||'')+(v.pct!=null?' '+pctT(v.pct):'');return String(v);}
// Estados de una clave SII recibida (paquete F2): sellada hasta que el Master la promueve desde su Mac. NUNCA el valor.
var EST_CLAVE={recibida:['Recibida (borrador del cliente)','gris'],por_aprobar:['Sellada · por promover','lila'],promovida:['Promovida a la bóveda','verde'],
  descartada:['Descartada','rojo'],caducada:['Caducó sin promover (30 días)','rojo'],pendiente:['Pendiente (la enviará después)','ambar'],sin_respuesta:['Sin respuesta','gris']};
function txtClave(k){var e=EST_CLAVE[k.estado]||[k.estado,'gris'];var f=k.estado==='promovida'||k.estado==='descartada'||k.estado==='caducada'?k.resuelta_at:k.entregada_at;
  return e[0]+(f?' · '+fHora(f):'')+(k.entregas>1?' · entregada '+k.entregas+' veces':'')+(k.estado==='por_aprobar'&&k.expira_at?' · caduca '+fFecha(k.expira_at):'');}
function btnDescartar(d,k){return k&&k.id&&d.es_master&&(k.estado==='recibida'||k.estado==='por_aprobar')?' <button type="button" class="link" data-act="descartar-clave" data-clave="'+k.id+'">Descartar</button>':'';}
function claveSocio(d,rut){var k=d.claves,l=k&&k.socios||[];for(var i=0;i<l.length;i++)if(l[i].rut===rut)return l[i];return null;}
function alertas(d){
  var r=d.respuesta, dt=r.datos||{}, out=[];
  (dt.socios||[]).forEach(function(s){
    var n=esc(s.nombre||rutF(s.rut));
    if(s.tgr==='si')out.push(n+': tiene deudas con la TGR (la devolución puede retenerse).');
    if(s.tgr==='nose')out.push(n+': no sabe si tiene deudas con la TGR.');
    var ks=claveSocio(d,s.rut);
    if(ks&&ks.estado==='pendiente')out.push(n+': dejó su clave SII <b>pendiente</b> (la enviará después).');
    else if(ks&&ks.estado==='caducada')out.push(n+': su clave SII <b>caducó</b> sin promoverse: hay que pedírsela de nuevo.');
    else if(!ks&&!d.claves&&(!s.sii||!s.sii.autoriza))out.push(n+': no autorizó revisar su información en el SII.');
    else if(!ks&&!d.claves&&!s.sii.canal)out.push(n+': autoriza el SII, pero falta definir el canal (enlace seguro o ya entregado).');
  });
  var ke=d.claves&&d.claves.empresa;
  var nPro=d.claves&&d.claves.por_promover||0;
  if(nPro)out.push('Hay <b>'+nPro+' clave'+(nPro===1?'':'s')+' SII sellada'+(nPro===1?'':'s')+'</b> por promover. Se promueven SOLO desde el Mac del Master con la herramienta de claves (doble clic en «Promover claves Renta»); hasta entonces el conector SII sigue con la clave anterior.');
  if(ke&&ke.estado==='caducada')out.push('La clave SII nueva de la empresa <b>caducó</b> sin promoverse: hay que pedírsela de nuevo.');
  if(dt.correo_oficial&&dt.correo_oficial.correo&&dt.correo_oficial.correo!==String(d.cliente.email||'').toLowerCase())out.push('El cliente corrigió el <b>correo oficial</b>: hasta que lo apliques, el código y todo aviso siguen yendo al correo de la ficha.');
  (r.cuentas||[]).forEach(function(k){if(k.modo==='sin_cuenta'&&k.direccion_sii==='cambio')out.push('Sin cuenta '+(k.titular==='empresa'?'de la empresa':'del socio '+rutF(k.titular_rut))+' y la dirección del SII cambió: el cheque llegaría a una dirección antigua.');});
  var ctas=(r.cuentas||[]).map(function(k){return k.titular_rut;});
  (dt.socios||[]).forEach(function(s){if(s.rut&&ctas.indexOf(s.rut)<0)out.push(esc(s.nombre||rutF(s.rut))+': sin cuenta para la devolución definida.');});
  if(dt.objetivos&&(dt.objetivos.lista||[]).indexOf('regimen')>=0)out.push('Quiere evaluar un cambio de régimen'+(dt.objetivos.regimen_por?': '+esc(dt.objetivos.regimen_por):'.'));
  return out;
}
function bloque(icono,col,titulo,cuerpo){return '<section class="card pr-card" style="--acc:var('+col+')"><div class="h"><h2>'+I(icono,col==='--ambar'?'ic-amb':col==='--verde'?'ic-ver':col==='--cel'?'ic-cel':'ic-mor')+' '+titulo+'</h2></div>'+cuerpo+'</section>';}
function kv(k,v){return '<dt>'+esc(k)+'</dt><dd>'+(v==null||v===''?'<span class="nd">Sin respuesta</span>':v)+'</dd>';}
function resumen(d){
  var r=d.respuesta, dt=r.datos||{}, h='';
  var socios=(dt.socios||[]).map(function(s){
    var otros=s.otros_ninguno?'Ninguno':(s.otros_ingresos||[]).length?(s.otros_ingresos||[]).map(function(o){return esc(OTROS[o.tipo]||o.tipo)+' <b>'+(o.monto_anual!=null?clpT(o.monto_anual)+' al año':'<span class="nd">sin monto</span>')+'</b>';}).join('<br>'):null;
    var ks=claveSocio(d,s.rut);
    var sii=ks?txtClave(ks)
      :s.rut===d.cliente.rut?'Cubierta por la clave de la empresa'
      :!s.sii||!s.sii.autoriza?'No autoriza':s.sii.canal==='enlace'?'Autoriza · enviar enlace seguro':s.sii.canal==='entregado'?'Autoriza · acceso ya entregado':'Autoriza · canal por definir';
    var k=(r.cuentas||[]).filter(function(x){return x.titular_rut===s.rut;})[0];
    return '<div class="pr-socio"><div class="pr-socio-h">'+window.GEquipo.avatar(s.nombre||'?')+'<div><b>'+esc(s.nombre||'Socio')+'</b><small>'+rutF(s.rut)+' · '+pctT(s.pct)+'</small></div><span class="estado '+(TIPOS[s.estado==='ok'?'validado':s.estado==='fix'?'corregido':'nuevo']||['', 'gris'])[1]+' mini">'+(s.estado==='ok'?'Validado':s.estado==='fix'?'Corregido':'Nuevo')+'</span></div><dl class="kv">'
      +kv('Sueldo en la empresa',SINO[s.sueldo])+kv('Otros ingresos',otros)+kv('Deudas con la TGR',SINO[s.tgr])+kv('APV / dividendo',(s.ahorro||[]).map(function(a){return a==='apv'?'APV':'Crédito hipotecario (dividendo)';}).join(' · ')||'No')
      +kv(ks?'Clave SII':'Acceso al SII',esc(sii)+(ks?btnDescartar(d,ks):''))+kv('Cuenta para la devolución',k?cuentaTxt(k):null)+'</dl></div>';}).join('');
  var ec=dt.empresa_correccion||{}, ct=dt.contacto||{}, ke=(r.cuentas||[]).filter(function(x){return x.titular==='empresa';})[0];
  h+=bloque('edificio','--cel','Empresa, responsable y <span>correo</span>','<dl class="kv">'+kv('Datos de la empresa',dt.bloques&&dt.bloques.empresa==='ok'?'Está correcto':'Corrigió (ver comparación)')
    +(ec.regimen?kv('Régimen según el cliente',esc(ec.regimen)):'')+kv('Responsable',dt.bloques&&dt.bloques.contacto==='ok'?'<span class="t-verde">Validado</span>':'<span class="t-ambar">Corregido</span> · '+esc([ct.nombre,ct.cargo,ct.rut?rutF(ct.rut):'',ct.wa].filter(Boolean).join(' · ')))
    +kv('Correo oficial',!dt.bloques||!dt.bloques.correo?null:dt.bloques.correo==='ok'?'<span class="t-verde">Validado</span> · '+esc(d.cliente.email||'')
      :'<span class="t-ambar">Corregido</span> · '+esc(d.cliente.email||'—')+' → <b>'+esc((dt.correo_oficial||{}).correo||'')+'</b> <small class="t3">(no recibe nada hasta aplicarlo)</small>')
    +kv('Cuenta de la empresa',ke?cuentaTxt(ke):null)+claveEmpresaKv(d)+'</dl>'
    +(d.claves?'<p class="t3">'+I('escudo','ic-ver')+' Las claves SII llegan selladas desde el navegador del cliente y nunca se muestran aquí. Se promueven a la bóveda solo desde el Mac del Master; una vez promovidas se ven con <b>Ver claves</b> en la ficha (queda registrado).</p>':''));
  h+=bloque('personas','--lila2','Socios <span>('+(dt.socios||[]).length+')</span>','<div class="pr-socios">'+socios+'</div>');
  var ob=dt.objetivos||{}, lis=(ob.lista||[]).map(function(k){return '<li><b>'+esc(OBJ[k]||k)+'</b>'+(detObj(k,ob,dt)?'<small>'+detObj(k,ob,dt)+'</small>':'')+'</li>';}).join('');
  h+=bloque('objetivo','--ambar','Objetivos del <span>año</span>',lis?'<ul class="pr-obj">'+lis+'</ul>':'<p class="nd">Sin objetivos marcados.</p>');
  var cx=dt.contexto||{};
  h+=bloque('calendario','--verde','Contexto del <span>año</span>','<dl class="kv">'+kv('Ventas',VENTAS[cx.ventas])+kv('Eventos',(cx.eventos||[]).map(function(e){return EVENTOS[e]||e;}).join(' · '))
    +kv('Detalle',esc(cx.eventos_detalle||''))+kv('Retiros ya hechos',cx.retiros_hechos==='si'?'Sí'+(cx.retiros_monto!=null?' · aprox. '+clpT(cx.retiros_monto):''):SINO[cx.retiros_hechos])+kv('Comentarios',esc(cx.comentarios||''))+'</dl>'
    +(r.estado==='enviada'?'<p class="t3">'+I('escudo','ic-ver')+' Aceptó el uso de la información y declaró que es completa y verdadera ('+fHora(r.enviada_at)+').</p>':''));
  return h;
}
function claveEmpresaKv(d){
  var k=d.claves&&d.claves.empresa;if(!k)return '';
  var t=k.misma==='si'?'Sigue siendo la misma':k.estado?'Cambió · '+txtClave(k):'Sin respuesta';
  return kv('Clave SII de la empresa',esc(t)+btnDescartar(d,k));
}
function descartarClave(id){
  S.descartarId=id;
  modal('¿Descartar esta clave SII?','<p class="t2">Se borra sin usarla (nunca llega a la bóveda). La clave registrada hoy no cambia. Queda en el registro y habrá que pedírsela de nuevo al cliente.</p><label class="mrp-campo"><span>Motivo</span><textarea id="prMotivo" rows="2" maxlength="300"></textarea></label>',
    '<button type="button" class="btn" data-act="descartar-clave-ok">Sí, descartar</button>');
}
function descartarClaveOk(btn){
  btn.disabled=true;
  API.rpc('prep_renta_clave_descartar',{p_id:S.descartarId,p_motivo:($('prMotivo').value||'').trim()}).then(function(){cerrarModal();toast(I('check','ic-ver')+' Clave descartada.');abrirDetalle(S.d.cliente.id);},
    function(e){btn.disabled=false;$('prMerr').innerHTML=textoError(e);});
}
function cuentaTxt(k){
  if(k.modo==='vigente')return 'Mantiene la registrada';
  if(k.modo==='sin_cuenta')return 'Sin cuenta · cheque al domicilio del SII ('+(k.direccion_sii==='cambio'?'<span class="t-ambar">dirección cambió</span>':'dirección vigente')+')';
  return esc(k.banco)+' · '+esc(TIPO_CTA[k.tipo]||k.tipo)+' · ••••'+esc(k.ultimos4);
}
function detObj(k,ob,dt){
  var nom=function(rut){var s=(dt.socios||[]).filter(function(x){return x.rut===rut;})[0];return s?s.nombre:rutF(rut);};
  switch(k){
    case 'menos':return ob.menos_foco?esc({empresa:'Impuesto de la empresa',socios:'Impuesto personal de los socios',ambos:'Ambos'}[ob.menos_foco]):'';
    case 'retiros':return (ob.retiros||[]).map(function(x){return esc(nom(x.rut))+': '+clpT(x.monto);}).join(' · ');
    case 'reinvertir':return esc(ob.reinvertir_en||'');
    case 'inversion':return [esc(ob.inversion&&ob.inversion.tipo||''),ob.inversion&&ob.inversion.monto!=null?clpT(ob.inversion.monto):'',esc(ob.inversion&&ob.inversion.cuando||'')].filter(Boolean).join(' · ');
    case 'bancos':return [ob.bancos&&ob.bancos.credito?'Crédito en 12 meses: '+(SINO[ob.bancos.credito]||''):'',ob.bancos&&ob.bancos.monto!=null?clpT(ob.bancos.monto):''].filter(Boolean).join(' · ');
    case 'deudas':return esc({tributaria:'Tributaria (SII / Tesorería)',previsional:'Previsional (cotizaciones)',ambas:'Ambas'}[ob.deudas_tipo]||'');
    case 'regimen':return esc(ob.regimen_por||'');case 'otro':return esc(ob.otro_txt||'');
  }
  return '';
}

/* ── Acciones del detalle ── */
function confirmarAplicar(){
  var sel=seleccion();if(!sel.length)return;
  var lista='<div class="mrc-tabla-box"><table class="cmp mrc-tabla pr-cmp"><thead><tr><th>Dato</th><th>Hoy</th><th>Quedará</th></tr></thead><tbody>'+sel.map(function(s){var x=s.x;
    return '<tr><td><b>'+etiqueta(x)+'</b></td><td><div class="pr-v">'+valor(x,'actual')+'</div></td><td><div class="pr-v">'+(x.tipo==='quitado'?'<span class="t-rojo">Se quita de la ficha</span>':valor(x,'cliente'))+'</div></td></tr>';}).join('')+'</tbody></table></div>';
  modal((S.d.es_master?'¿Aprobar y aplicar ':'¿Proponer ')+sel.length+' cambio'+(sel.length===1?'':'s')+' a la ficha de '+S.d.cliente.razon_social+'?',
    lista+(S.d.es_master?'<p class="t2">Al aprobar, queda registrado quién aprobó, cuándo y qué campos; se escribe con el mismo camino que la ficha de Clientes. Solo cambian los campos de esta lista.</p>':'<p class="t2">Como analista solo propones: los cambios quedan <b>pendientes</b> y se avisa al Master para que los apruebe o rechace. La ficha no cambia hasta su aprobación.</p>')
    +'<label class="mrp-campo"><span>Comentario (opcional)</span><textarea id="prMotivo" rows="2" maxlength="300"></textarea></label>',
    '<button type="button" class="btn" data-act="aplicar-ok">'+I('check')+(S.d.es_master?'Aprobar y aplicar':'Enviar propuesta al Master')+'</button>');
}
function aplicarOk(btn){
  var sel=seleccion(), d=S.d;btn.disabled=true;
  var elec=sel.map(function(s){var e={campo:s.x.clave,antes:s.x.actual==null?null:s.x.actual};if(s.x.clave==='socio'||s.x.clave==='cuenta')e.rut=s.x.rut;return e;});
  API.rpc('prep_renta_aplicar',{p_respuesta_id:d.respuesta.id,p_elecciones:elec,p_motivo:($('prMotivo').value||'').trim()||null}).then(function(r){
    cerrarModal();toast(I('check','ic-ver')+(r.estado==='APLICADA'?' Aprobado y aplicado a la ficha (queda en el registro).':' Propuesta enviada al Master para su aprobación.'));abrirDetalle(d.cliente.id);
  },function(e){btn.disabled=false;$('prMerr').innerHTML=textoError(e);});
}
function resolver(id,aprobar){
  modal(aprobar?'¿Aprobar y aplicar los cambios propuestos?':'¿Rechazar los cambios propuestos?',
    '<p class="t2">'+(aprobar?'Se aplican a la ficha tal como los propuso el analista (si la ficha cambió entretanto, no se aplica nada y se avisa).':'La ficha queda igual y se avisa al analista.')+'</p>'
    +'<label class="mrp-campo"><span>Motivo'+(aprobar?' (opcional)':'')+'</span><textarea id="prMotivo" rows="2" maxlength="300"></textarea></label>',
    '<button type="button" class="btn" data-act="resolver-ok" data-id="'+id+'" data-aprobar="'+(aprobar?1:0)+'">'+(aprobar?'Aprobar y aplicar':'Sí, rechazar')+'</button>');
}
function resolverOk(btn){
  btn.disabled=true;var ap=btn.getAttribute('data-aprobar')==='1';
  API.rpc('prep_renta_resolver_aplicacion',{p_aplicacion_id:+btn.getAttribute('data-id'),p_aprobar:ap,p_motivo:($('prMotivo').value||'').trim()||null}).then(function(){
    cerrarModal();toast(I('check','ic-ver')+(ap?' Cambios aplicados.':' Propuesta rechazada.'));abrirDetalle(S.d.cliente.id);
  },function(e){btn.disabled=false;$('prMerr').innerHTML=textoError(e);});
}
function verNumero(origen,el){
  var d=S.d, id=origen==='ficha'?+el.getAttribute('data-id'):((d.respuesta.cuentas||[]).filter(function(k){return k.titular_rut===el.getAttribute('data-rut');})[0]||{}).id;
  if(!id)return;
  API.edge('renta-cuenta-ver',{origen:origen,cuenta_id:id}).then(function(j){var n=j.numero;
    modal('Número de la cuenta','<p class="pr-num mono">'+esc(String(n).replace(/(\d{4})(?=\d)/g,'$1 '))+'</p><p class="t3">'+I('escudo','ic-ver')+' Esta consulta quedó registrada. No copies el número en correos ni chats: úsalo solo al preparar el F22. Se ocultará en 30 segundos.</p>');
    clearTimeout(verNumero.t);verNumero.t=setTimeout(function(){if(!$('prModal').hidden&&$('prModalCuerpo').querySelector('.pr-num'))cerrarModal();},30000);
  },function(e){toast(I('alerta','ic-roj')+' '+textoError(e));});
}
function reabrir(){
  modal('¿Devolver la respuesta al cliente?','<p class="t2">La respuesta vuelve a borrador para que el cliente la corrija y la envíe de nuevo. Lo ya aplicado a la ficha no se deshace.</p><label class="mrp-campo"><span>Motivo (se guarda en el registro)</span><textarea id="prMotivo" rows="2" maxlength="300"></textarea></label>',
    '<button type="button" class="btn" data-act="reabrir-ok">Sí, devolver</button>');
}
function reabrirOk(btn){
  btn.disabled=true;
  API.rpc('prep_renta_reabrir',{p_respuesta_id:S.d.respuesta.id,p_motivo:($('prMotivo').value||'').trim()}).then(function(){cerrarModal();toast(I('check','ic-ver')+' Devuelta al cliente.');abrirDetalle(S.d.cliente.id);},
    function(e){btn.disabled=false;$('prMerr').innerHTML=textoError(e);});
}
function campana(){
  var k=S.cfg;if(!k)return;
  modal('Campaña Preparemos tu Renta '+(k.periodo||''),
    '<p class="t2">Con la campaña <b>cerrada</b>, el enlace contadoor.github.io/renta no envía códigos y las sesiones abiertas dejan de funcionar.</p>'
    +'<label class="mrc-check"><input type="checkbox" id="prAbierto"'+(k.abierto?' checked':'')+'> Enlace abierto</label>'
    +'<fieldset class="pr-fs"><legend>Quiénes pueden entrar</legend>'
    +'<label class="mrc-check"><input type="checkbox" id="prT1"'+(k.planes.indexOf('asesoria')>=0?' checked':'')+'> Tanda 1 · PRO + Estratégico</label>'
    +'<label class="mrc-check"><input type="checkbox" id="prT2"'+(k.planes.indexOf('cumplimiento')>=0?' checked':'')+'> Tanda 2 · Cumplimiento con contabilidad</label></fieldset>'
    +'<label class="mrp-campo"><span>Motivo (queda en el registro)</span><textarea id="prMotivo" rows="2" maxlength="300"></textarea></label>',
    '<button type="button" class="btn" data-act="campana-ok">Guardar</button>');
}
function campanaOk(btn){
  var planes=[];if($('prT1').checked)planes.push('asesoria','estrategico');if($('prT2').checked)planes.push('cumplimiento');
  btn.disabled=true;
  API.rpc('prep_renta_config_fijar',{p_abierto:$('prAbierto').checked,p_planes:planes,p_motivo:($('prMotivo').value||'').trim()}).then(function(){cerrarModal();toast(I('check','ic-ver')+' Campaña actualizada.');cargarCartera();},
    function(e){btn.disabled=false;$('prMerr').innerHTML=textoError(e);});
}

/* ── Eventos ── */
document.addEventListener('click',function(e){
  var t=e.target.closest('[data-act],[data-tanda],[data-estado],[data-resp],[data-m]');if(!t)return;
  if(t.hasAttribute('data-m')){cerrarModal();return;}
  if(t.hasAttribute('data-tanda')){S.cart.tanda=t.getAttribute('data-tanda');renderCartera();return;}
  if(t.hasAttribute('data-estado')){S.cart.estado=t.getAttribute('data-estado');renderCartera();return;}
  if(t.hasAttribute('data-resp')&&!t.hasAttribute('data-act')){S.cart.resp=window.GEquipo.valida(t.getAttribute('data-resp'));renderCartera();return;}
  switch(t.getAttribute('data-act')){
    case 'recargar':cargarCartera();break;
    case 'csv':descargarCsv();break;
    case 'ver':abrirDetalle(t.getAttribute('data-cli'));break;
    case 'volver':S.vista='cartera';S.d=null;cargarCartera();break;
    case 'recargar-det':abrirDetalle(S.d.cliente.id);break;
    case 'aplicar':confirmarAplicar();break;
    case 'aplicar-ok':aplicarOk(t);break;
    case 'aprobar':resolver(t.getAttribute('data-id'),true);break;
    case 'rechazar':resolver(t.getAttribute('data-id'),false);break;
    case 'resolver-ok':resolverOk(t);break;
    case 'ver-num':verNumero(t.getAttribute('data-origen'),t);break;
    case 'reabrir':reabrir();break;
    case 'reabrir-ok':reabrirOk(t);break;
    case 'campana-ok':campanaOk(t);break;
    case 'descartar-clave':descartarClave(+t.getAttribute('data-clave'));break;
    case 'descartar-clave-ok':descartarClaveOk(t);break;
  }
});
document.addEventListener('input',function(e){if(e.target.id==='prBuscar'){S.cart.q=e.target.value;renderCartera();}});
document.addEventListener('change',function(e){
  var el=e.target;
  if(el.hasAttribute&&el.hasAttribute('data-elig')){S.elig[+el.getAttribute('data-elig')]=el.checked;var b=document.querySelector('[data-act="aplicar"]'),n=seleccion().length;
    if(b){b.disabled=!n;b.lastChild.textContent=etqAplicar(n);}}
  else if(el.classList&&el.classList.contains('geq-sel-in')){S.cart.resp=window.GEquipo.valida(el.value);renderCartera();}
});
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!$('prModal').hidden)cerrarModal();});
$('prVelo').addEventListener('click',cerrarModal);
$('prCampana').addEventListener('click',campana);

function iniciar(){
  pintarIconos(document);
  if(DEMO){$('prDemo').hidden=false;}
  var c=null;try{c=new URLSearchParams(location.search).get('c');}catch(e){}
  cargarCartera();
  if(c&&/^\d{1,12}$/.test(c))abrirDetalle(c);
  else renderCartera();
}
if(DEMO)iniciar();
else if(window._sbAuthReady)iniciar();
else document.addEventListener('gestoor-auth-ready',iniciar,{once:true});
})();
