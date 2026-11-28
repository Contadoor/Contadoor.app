/* ============================================================
   asesorias/asesorias.js — Asesorías Al Día · Parte 1 (reuniones con CLIENTES ACTIVOS; no es la agenda de ventas)
   Conectada SOLO a las RPC de la migración 202611281600_asesorias_al_dia (gestoor-backend), todas con el JWT del usuario:
     ase_agenda · ase_detalle · ase_cambiar_estado · ase_minuta_guardar · ase_acuerdo_marcar · ase_horarios_cliente ·
     ase_solicitar_por_cliente   +   clientes (lectura con RLS, solo activos) para «Agendar por el cliente».
   Quién ve qué lo decide el servidor (Master todo; el resto, sus reuniones como anfitrión o las de sus clientes asignados).
   Fail-closed: si una lectura falla se muestra el error; nunca ceros inventados.
   Parte 2 (pendiente): evento en el calendario de info@ con Meet y correos al cliente.
   Modo demostración: asesorias-demo.js (solo ?demo=1 en localhost).
   ============================================================ */
(function(){
'use strict';
var G=window.GC, esc=G.esc, I=G.I, $=G.$;
var DEMO=window.ASE_DEMO===true&&G.LOCAL&&!!window.ASE_DEMO_API;
var TZ='America/Santiago';
var PRECIO_PAGADA=35000;

/* ── Errores de negocio → textos claros ── */
var ERR={
  ASE_SIN_PERMISO:'Solo el anfitrión de la reunión o el Master pueden hacer esto.',
  ASE_CAMBIO_CONCURRENTE:'Otra persona cambió esta reunión recién. Se recargó: revisa y vuelve a intentarlo.',
  ASE_TRANSICION:'La reunión ya no está en un estado que permita esta acción (recarga la página).',
  ASE_MOTIVO:'Escribe un motivo de al menos 5 caracteres.',
  ASE_RESUMEN_CORTO:'El resumen para el cliente debe tener al menos 40 caracteres.',
  ASE_SEGUIMIENTO:'Escribe el seguimiento (al menos 5 caracteres).',
  ASE_ACUERDOS_O_SIN:'Agrega al menos un acuerdo o marca «Sin acuerdos».',
  ASE_AUN_NO:'La reunión todavía no ocurre (o no está confirmada): la minuta se escribe después.',
  ASE_ACUERDOS:'Revisa los acuerdos (máximo 30).',
  ASE_SIN_CUPO:'El cliente no tiene cupo en ese período: debe aceptarse como asesoría pagada de $35.000.',
  ASE_HORA_NO_DISPONIBLE:'Ese horario ya no está disponible. Vuelve a cargar los horarios.',
  ASE_SIN_CLAVES:'El motivo no puede incluir claves ni contraseñas.',
  ASE_SIN_ANFITRION:'El cliente no tiene asesor asignado para ese tema (revisa la ficha del cliente).',
  ASE_SIN_ACCESO:'No tienes acceso a esta reunión o a este cliente.',
  ASE_DATOS:'Datos no válidos.',SIN_SESION:'No hay una sesión activa en Gestoor.',
  ASE_RESPUESTA:'El servidor respondió algo inesperado.'
};
function mErr(e){
  if(e&&e.srv&&e.srv.code==='PGRST202')return 'Asesorías todavía no está instalada en el servidor (PGRST202).';
  return G.msgError(e,ERR);
}
function codigoErr(cod){var e=new Error(cod);e.srv={code:'NEGOCIO',message:cod,status:200};return e;}
function exigirOk(r){if(!r||r.ok!==true)throw codigoErr((r&&r.codigo)||'ASE_RESPUESTA');return r;}

/* ── Datos (real con JWT del usuario, o demostración local) ── */
var A=G.API;
var REAL={
  agenda:function(d,h){return A.rpc('ase_agenda',{p_desde:d,p_hasta:h});},
  detalle:function(id){return A.rpc('ase_detalle',{p_id:Number(id)});},
  cambiarEstado:function(a){return A.rpc('ase_cambiar_estado',a);},
  minutaGuardar:function(a){return A.rpc('ase_minuta_guardar',a);},
  acuerdoMarcar:function(a){return A.rpc('ase_acuerdo_marcar',a);},
  horariosCliente:function(a){return A.rpc('ase_horarios_cliente',a);},
  solicitarPorCliente:function(a){return A.rpc('ase_solicitar_por_cliente',a);},
  clientes:function(){return A.get('clientes?select=id,rut,razon_social,plan,estado&estado=eq.activo&order=razon_social');}
};
var D=DEMO?window.ASE_DEMO_API:REAL;

/* ── Fechas en hora de Chile ── */
var fDia=new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'});
var fHM=new Intl.DateTimeFormat('es-CL',{timeZone:TZ,hour:'2-digit',minute:'2-digit',hour12:false});
var fLargo=new Intl.DateTimeFormat('es-CL',{timeZone:TZ,weekday:'long',day:'numeric',month:'long'});
var fCorto=new Intl.DateTimeFormat('es-CL',{timeZone:TZ,weekday:'short',day:'numeric',month:'short'});
function dt(iso){var d=new Date(iso);return isNaN(d)?null:d;}
function diaCL(iso){var d=dt(iso);return d?fDia.format(d):'';}
function hm(iso){var d=dt(iso);return d?fHM.format(d):'—';}
function largo(iso){var d=dt(iso);if(!d)return '—';var s=fLargo.format(d);return s.charAt(0).toUpperCase()+s.slice(1);}
function corto(iso){var d=dt(iso);return d?fCorto.format(d):'—';}
function cuando(iso,fin){return largo(iso)+' · '+hm(iso)+(fin?'–'+hm(fin):'')+' h';}
function pasada(r){var d=dt(r.inicio);return !!d&&d.getTime()<=Date.now();}
function addDias(iso,n){var d=new Date(iso+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
function fechaCorta(iso){if(!iso)return '';var p=String(iso).slice(0,10).split('-');return p.length===3?p[2]+'-'+p[1]+'-'+p[0]:String(iso);}

/* ── Catálogos ── */
var TEMA={estrategico:['Estratégica','objetivo'],contable:['Contable','contable'],rrhh:['RR. HH.','rrhh']};
var ESTADO={solicitada:['Por confirmar','ambar'],confirmada:['Confirmada','verde'],cancelada:['Cancelada','gris'],
  realizada:['Realizada · falta minuta','cel'],no_asistio:['No asistió','naranja'],cerrada:['Cerrada · minuta publicada','lila']};
var PLAN={estrategico:'Contadoor Estratégico',asesoria:'Contadoor PRO',cumplimiento:'Cumplimiento'};
var EVENTO={solicitada:'Solicitud creada',confirmar:'Confirmada',rechazar:'Rechazada / cancelada por Contadoor',cancelada:'Cancelada por el cliente',
  no_asistio:'Marcada «No asistió» (se devuelve al cupo)',realizada:'Marcada como realizada',minuta_borrador:'Minuta guardada como borrador',
  minuta_publicada:'Minuta publicada al cliente',acuerdo_cumplido:'Acuerdo marcado cumplido',acuerdo_pendiente:'Acuerdo vuelto a pendiente'};
function temaChip(t){var x=TEMA[t]||[t,'chat'];return '<span class="as-tema '+esc(t)+'">'+I(x[1])+esc(x[0])+'</span>';}
function estadoChip(r){var x=ESTADO[r.estado]||[r.estado,'gris'];
  if(r.estado==='confirmada'&&pasada(r))x=['Confirmada · falta minuta','cel'];
  if(r.estado==='solicitada'&&pasada(r))x=['Sin confirmar · ya pasó','rojo'];
  if((r.estado==='confirmada'||r.estado==='realizada')&&r.minuta_estado==='borrador'&&pasada(r))x=['Minuta en borrador','cel'];
  return '<span class="estado '+x[1]+'">'+esc(x[0])+'</span>';}
function colorOk(c){return /^#[0-9a-fA-F]{3,8}$/.test(String(c||''))?c:'#924893';}
function avatar(a){if(!a)return '';var ini=String(a.iniciales||String(a.nombre||'?').split(/\s+/).map(function(p){return p.charAt(0);}).join('')).slice(0,3).toUpperCase();
  return '<span class="as-anf" title="Anfitrión: '+esc(a.nombre)+'"><span class="as-av" style="--c:'+colorOk(a.color)+'">'+esc(ini)+'</span>'+esc(a.nombre||'')+'</span>';}
function pagadaChip(r){return r.es_pagada?'<span class="as-pag">'+I('moneda')+'Pagada '+G.clpT(r.precio!=null?r.precio:PRECIO_PAGADA)+'</span>':'';}
function cupoTexto(c){
  if(!c)return '<span class="nd">Cupo no disponible</span>';
  if(!(c.n>0))return 'Sin reuniones incluidas en su plan · puede comprar 1 hora a '+G.clpT(c.precio_pagada||PRECIO_PAGADA);
  var per=c.cada_meses===1?'al mes':c.cada_meses===3?'por trimestre':'cada '+c.cada_meses+' meses';
  return 'Cupo '+esc(c.n)+' '+per+' · usadas '+esc(c.usadas)+' de '+esc(c.n)+' · disponibles '+esc(c.disponibles)+' <span class="t3">('+esc(fechaCorta(c.desde))+' al '+esc(fechaCorta(c.hasta))+')</span>';
}
function planTxt(p){return PLAN[p]||(p?String(p):'Sin plan definido');}

/* ── Estado ── */
var S={yo:null,reuniones:null,err:null,tab:'confirmar',det:null,detId:null,detErr:null,form:null,ocupado:false};
function hoy(){return G.hoyCL();}
function puedeActuar(r){return !!(S.yo&&r&&(S.yo.master||(r.anfitrion&&r.anfitrion.id===S.yo.id)||r.anfitrion_id===S.yo.id));}
function grupos(){
  var L=S.reuniones||[], h=hoy();
  var conf=L.filter(function(r){return r.estado==='solicitada';});
  var min=L.filter(function(r){return (r.estado==='confirmada'||r.estado==='realizada')&&pasada(r)&&r.minuta_estado!=='publicada';});
  var age=L.filter(function(r){return (r.estado==='solicitada'||r.estado==='confirmada'||r.estado==='realizada'||r.estado==='cerrada')&&diaCL(r.inicio)>=h;});
  var his=L.filter(function(r){return r.estado==='cerrada'||r.estado==='cancelada'||r.estado==='no_asistio';}).slice().sort(function(a,b){return String(b.inicio).localeCompare(String(a.inicio));});
  var deHoy=L.filter(function(r){return diaCL(r.inicio)===h&&r.estado!=='cancelada';});
  return {conf:conf,min:min,age:age,his:his,hoy:deHoy};
}

/* ── Carga ── */
function cargar(){
  S.err=null;var h=hoy();
  // Ventana: 120 días atrás (minutas pendientes e historial reciente) y 60 adelante (las solicitudes llegan con hasta 21 días).
  return D.agenda(addDias(h,-120),addDias(h,60)).then(function(r){
    exigirOk(r);if(!Array.isArray(r.reuniones))throw codigoErr('ASE_RESPUESTA');
    S.yo=r.yo||null;S.reuniones=r.reuniones;render();
  }).catch(function(e){S.err=mErr(e);S.reuniones=null;render();});
}

/* ── Pantalla principal ── */
function render(){
  var app=$('gcApp');if(!app)return;
  if(S.err){app.innerHTML='<div class="aviso rojo">'+I('alerta','ic-roj')+'<span>No se pudieron cargar las reuniones: '+esc(S.err)+'</span><button type="button" class="btn chico sec" data-act="recargar">Reintentar</button></div>';return;}
  if(!S.reuniones){app.innerHTML='<div class="aviso lila"><span class="gc-spin"></span>Cargando las reuniones…</div>';return;}
  var g=grupos();
  var h='<div class="card hero"><span class="gc-kicker">Reuniones con clientes activos</span>'
    +'<div class="gc-kpis">'
    +kpi('acc-ambar','Por confirmar',g.conf.length,'Solicitudes esperando respuesta','confirmar')
    +kpi('acc-verde','Reuniones de hoy',g.hoy.length,largo(new Date().toISOString()),'agenda')
    +kpi('acc-cel','Minutas pendientes',g.min.length,'Reuniones ya ocurridas sin minuta publicada','minutas')
    +'</div>'
    +'<details class="as-reglas" style="margin-top:12px"><summary>'+I('info','ic-cel')+'Reglas de las asesorías</summary><ul>'
    +'<li><b>Estratégico</b>: 1 reunión al mes con Luciano. <b>PRO</b>: 1 por trimestre. <b>Cumplimiento</b>: no incluye reuniones.</li>'
    +'<li>Sin cupo, el cliente puede comprar una asesoría de 1 hora a <b>$35.000</b>. Los cupos no se acumulan.</li>'
    +'<li>Si el cliente no asiste o cancela, la reunión se le devuelve (no cuenta en su cupo).</li>'
    +'<li>Horarios en hora de Chile: 10:30 · 11:20 · 16:30 · 17:20 (30 min; la pagada, 60 min).</li></ul></details></div>';
  var tabs=[['confirmar','Por confirmar',g.conf.length,'reloj'],['agenda','Agenda',g.age.length,'calendario'],['minutas','Minutas pendientes',g.min.length,'lapiz'],['historial','Historial',g.his.length,'historial']];
  h+='<nav class="gc-nav" role="tablist" aria-label="Secciones">'+tabs.map(function(t){var on=S.tab===t[0];
    return '<button type="button" class="sn'+(on?' on':'')+'" role="tab" aria-selected="'+on+'" data-act="tab" data-tab="'+t[0]+'">'+I(t[3])+esc(t[1])+'<span class="cnt">'+t[2]+'</span></button>';}).join('')+'</nav>';
  h+='<div role="tabpanel">'+(S.tab==='confirmar'?vistaConfirmar(g.conf):S.tab==='agenda'?vistaAgenda(g.age):S.tab==='minutas'?vistaLista(g.min,'No hay minutas pendientes. ¡Al día!'):vistaLista(g.his,'Aún no hay reuniones en el historial.'))+'</div>';
  app.innerHTML=h;
}
function kpi(acc,tit,n,sub,tab){return '<div class="kpi clic '+acc+'" role="button" tabindex="0" data-act="tab" data-tab="'+tab+'"><small>'+esc(tit)+'</small><b>'+esc(n)+'</b><p>'+esc(sub)+'</p></div>';}
function vistaConfirmar(L){
  if(!L.length)return '<div class="gc-vacio">No hay solicitudes por confirmar.</div>';
  return '<div class="as-lista">'+L.map(function(r){
    var puede=puedeActuar(r), ya=pasada(r);
    return '<article class="as-card'+(r.es_pagada?' pagada':'')+'">'
      +'<div class="c1"><span class="hora">'+I('calendario','ic-cel')+esc(cuando(r.inicio,r.fin))+'</span>'+estadoChip(r)+'</div>'
      +'<p class="nom">'+esc(r.cliente&&r.cliente.razon_social||'Cliente')+'</p>'
      +'<div class="meta">'+temaChip(r.tema)+pagadaChip(r)+avatar(r.anfitrion)+'<span>'+esc(r.canal==='gestoor'?'Ingresada en Gestoor':'Pedida en MiContadoor')+'</span></div>'
      +'<p class="motivo">'+esc(r.motivo)+'</p>'
      +'<div class="meta">'+cupoTexto(r.cupo)+'</div>'
      +'<div class="acciones">'
      +(puede&&!ya?'<button type="button" class="btn chico verde" data-act="confirmar" data-id="'+esc(r.id)+'">'+I('check')+'Confirmar</button>':'')
      +(puede?'<button type="button" class="btn chico peligro" data-act="rechazar" data-id="'+esc(r.id)+'">Rechazar</button>':'')
      +(puede&&ya?'<button type="button" class="btn chico sec" data-act="no_asistio" data-id="'+esc(r.id)+'">No asistió</button>':'')
      +'<button type="button" class="link" data-act="ficha" data-id="'+esc(r.id)+'">Ver ficha</button></div>'
      +(!puede?'<p class="nota">Solo el anfitrión o el Master pueden confirmarla.</p>':'')
      +'</article>';}).join('')+'</div>';
}
function fila(r){
  return '<button type="button" class="as-fila" data-act="ficha" data-id="'+esc(r.id)+'">'
    +'<span class="h">'+esc(hm(r.inicio))+'<small>'+esc(corto(r.inicio))+'</small></span>'
    +'<span class="n"><b>'+esc(r.cliente&&r.cliente.razon_social||'Cliente')+'</b><span>'+temaChip(r.tema)+pagadaChip(r)+'</span></span>'
    +'<span class="d">'+estadoChip(r)+avatar(r.anfitrion)+'</span></button>';
}
function vistaAgenda(L){
  if(!L.length)return '<div class="gc-vacio">No hay reuniones próximas.</div>';
  var h='',dia='',hy=hoy();
  L.forEach(function(r){var d=diaCL(r.inicio);
    if(d!==dia){dia=d;h+='<h3 class="as-dia'+(d===hy?' hoy':'')+'">'+I('calendario',d===hy?'ic-ver':'ic-mor')+esc(largo(r.inicio))+(d===hy?' <small>· hoy</small>':'')+'</h3>';}
    h+=fila(r);});
  return h;
}
function vistaLista(L,vacio){if(!L.length)return '<div class="gc-vacio">'+esc(vacio)+'</div>';return L.map(fila).join('');}

/* ── Ficha de la reunión ── */
function abrirFicha(id,sinUrl){
  S.detId=String(id);S.det=null;S.detErr=null;S.form=null;
  G.abrirDet('<div class="aviso lila"><span class="gc-spin"></span>Cargando la reunión…</div>');
  if(!sinUrl)urlReunion(id);
  return cargarFicha();
}
function cargarFicha(){
  var id=S.detId;
  return D.detalle(id).then(function(r){if(S.detId!==id)return;exigirOk(r);S.det=r;S.form=formDesde(r);pintarFicha();})
    .catch(function(e){if(S.detId!==id)return;S.detErr=mErr(e);pintarFicha();});
}
function urlReunion(id){try{var u=new URL(location.href);if(id)u.searchParams.set('r',id);else u.searchParams.delete('r');history.replaceState(null,'',u.toString());}catch(e){}}
function cerrarFicha(){S.detId=null;S.det=null;S.form=null;urlReunion(null);G.cerrarDet();}
function formDesde(d){
  var m=d.minuta||{}, pub=m.estado==='publicada';   // publicada: se muestran todos (solo lectura); borrador: solo los pendientes (los que se reenvían)
  return {resumen:m.resumen_cliente||'',seguimiento:m.seguimiento||'',proxima:m.proxima_sugerida||'',notas:m.notas_internas||'',sin:!!m.sin_acuerdos,
    acuerdos:(d.acuerdos||[]).filter(function(a){return pub||a.estado==='pendiente';}).map(function(a){
      return {descripcion:a.descripcion||'',responsable:a.responsable_tipo==='contadoor'?'contadoor':'cliente',uid:a.responsable_usuario_id!=null?String(a.responsable_usuario_id):'',vence:a.vence||''};})};
}
function pintarFicha(){
  var c=$('gcDetCuerpo');if(!c)return;
  if(S.detErr){c.innerHTML='<div class="aviso rojo">'+I('alerta','ic-roj')+'<span>No se pudo abrir la reunión: '+esc(S.detErr)+'</span><button type="button" class="btn chico sec" data-act="ficha-recargar">Reintentar</button></div>';return;}
  var d=S.det, r=d.reunion||{}, cli=r.cliente||{}, puede=puedeActuar(r), ya=pasada(r);
  var h='<div class="det-cab"><small>'+I(TEMA[r.tema]?TEMA[r.tema][1]:'chat')+' Reunión '+esc(TEMA[r.tema]?TEMA[r.tema][0].toLowerCase():r.tema)+'</small>'
    +'<h3>'+esc(cli.razon_social||'Cliente')+'</h3>'
    +'<div class="meta" style="display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center">'+estadoChip(r)+pagadaChip(r)+avatar(r.anfitrion)+'</div></div>';
  h+='<section><h4>Datos</h4>'
    +'<div class="cl">Fecha y hora (Chile)<b>'+esc(cuando(r.inicio,r.fin))+'</b></div>'
    +'<div class="cl">RUT<b>'+esc(cli.rut||'—')+'</b></div>'
    +'<div class="cl">Plan<b>'+esc(planTxt(cli.plan))+'</b></div>'
    +'<div class="cl">Canal<b>'+esc(r.canal==='gestoor'?'Ingresada en Gestoor':'MiContadoor')+'</b></div>'
    +(r.es_pagada?'<div class="cl">Cobro<b>'+esc({por_cobrar:'Por cobrar',cobrado:'Cobrado',anulado:'Anulado',no_aplica:'No aplica'}[r.cobro_estado]||r.cobro_estado||'—')+'</b></div>':'')
    +(r.motivo_cancelacion?'<div class="cl">Motivo de cancelación<b style="white-space:normal;text-align:right">'+esc(r.motivo_cancelacion)+'</b></div>':'')
    +'<p class="nota">'+cupoTexto(r.cupo)+'</p>'
    +(r.meet_url&&/^https:\/\/meet\.google\.com\/[a-z0-9-]{3,40}$/i.test(r.meet_url)?'<div class="cl">Sala<b><a href="'+esc(r.meet_url)+'" target="_blank" rel="noopener noreferrer">Abrir Google Meet</a></b></div>':'')
    +'<h4 style="margin-top:12px">Motivo del cliente</h4><div class="as-motivo">'+esc(r.motivo)+'</div></section>';
  // Acciones de estado
  var ac='';
  if(puede){
    if(r.estado==='solicitada'&&!ya)ac+='<button type="button" class="btn verde" data-act="confirmar" data-id="'+esc(r.id)+'">'+I('check')+'Confirmar</button>';
    if(r.estado==='solicitada'&&ya)ac+='<button type="button" class="btn sec" data-act="no_asistio" data-id="'+esc(r.id)+'">No asistió</button>';
    if(r.estado==='solicitada')ac+='<button type="button" class="btn peligro" data-act="rechazar" data-id="'+esc(r.id)+'">Rechazar</button>';
    if(r.estado==='confirmada'&&!ya)ac+='<button type="button" class="btn peligro" data-act="rechazar" data-id="'+esc(r.id)+'">Cancelar reunión</button>';
    if(r.estado==='confirmada'&&ya&&r.minuta_estado!=='publicada')ac+='<button type="button" class="btn sec" data-act="realizada" data-id="'+esc(r.id)+'">Marcar realizada</button>';
  }
  if(ac)h+='<section><h4>Acciones</h4><div class="acciones">'+ac+'</div>'+(r.estado==='solicitada'?'<p class="nota">Parte 2: al confirmar se creará el evento con Meet y se avisará al cliente. Por ahora, coordina el enlace aparte.</p>':'')+'</section>';
  else if(!puede)h+='<p class="nota">'+I('candado','ic-amb')+' Solo el anfitrión o el Master pueden cambiar esta reunión. La ves porque el cliente está asignado a ti.</p>';
  // Acuerdos previos abiertos
  var prev=d.acuerdos_previos||[];
  h+='<section><h4>Acuerdos abiertos del cliente (reuniones anteriores)</h4>'+(prev.length?'<ul class="as-prev-acu">'+prev.map(function(a){return acuerdoPrevio(a,d.equipo);}).join('')+'</ul>':'<p class="t3">No hay acuerdos abiertos de reuniones anteriores.</p>')+'</section>';
  // Minuta
  h+=seccionMinuta(d,r,puede,ya);
  // Eventos
  var ev=d.eventos||[];
  h+='<section><h4>Bitácora</h4>'+(ev.length?'<ul class="gc-tl">'+ev.map(function(e){
    var mot=e.detalle&&e.detalle.motivo?'<small>«'+esc(e.detalle.motivo)+'»</small>':'';
    return '<li><b>'+esc(EVENTO[e.tipo]||e.tipo)+'</b><small>'+esc(G.fHora(e.at))+'</small>'+mot+'</li>';}).join('')+'</ul>':'<p class="t3">Sin movimientos.</p>')+'</section>';
  c.innerHTML=h;
  pintarPrevia();
}
function nombreEquipo(eq,id){if(id==null)return null;var u=(eq||[]).find(function(x){return String(x.id)===String(id);});return u?u.nombre:null;}
function acuerdoPrevio(a,eq){
  var hy=hoy(), venc=a.vence&&a.estado==='pendiente'&&String(a.vence)<hy, cump=a.estado==='cumplido';
  var quien=a.responsable_tipo==='contadoor'?(nombreEquipo(eq,a.responsable_usuario_id)||'Contadoor'):'Cliente';
  return '<li class="'+(cump?'cumplido':'')+(venc?' vencido':'')+'"><input type="checkbox" data-act="acuerdo-marcar" data-id="'+esc(a.id)+'"'+(cump?' checked':'')+' aria-label="Cumplido"><span class="tx"><b>'+esc(a.descripcion)+'</b>'
    +'<small>'+esc(quien)+(a.vence?' · vence '+esc(fechaCorta(a.vence)):'')+(venc?' · <span class="t-rojo">vencido</span>':'')+(cump?' · cumplido':'')+'</small></span></li>';
}
function contador(n,min){return '<span class="cnt'+(n>=min?' ok':'')+'">'+n+' / mín. '+min+'</span>';}
function seccionMinuta(d,r,puede,ya){
  var publicada=r.minuta_estado==='publicada'||r.estado==='cerrada';
  var aplica=(r.estado==='confirmada'||r.estado==='realizada'||r.estado==='cerrada')&&ya;
  if(!aplica){
    if(r.estado==='solicitada'||r.estado==='confirmada')return '<section><h4>Minuta</h4><p class="t3">La minuta se escribe después de la reunión.</p></section>';
    return '';
  }
  var f=S.form;
  if(publicada||!puede){
    // Publicada (o sin permiso): solo lectura. Editar una minuta publicada queda para una próxima versión.
    return '<section><h4>Minuta '+(publicada?'publicada':d.minuta?'(borrador)':'(aún sin escribir)')+'</h4>'
      +(d.minuta&&d.minuta.publicada_at?'<p class="nota">Publicada el '+esc(G.fHora(d.minuta.publicada_at))+'.</p>':'')
      +(f.notas&&puede?'<div class="aviso ambar" style="margin-bottom:10px">'+I('candado','ic-amb')+'<span><b>Notas internas</b> (el cliente no las ve): '+esc(f.notas)+'</span></div>':'')
      +'<div id="asPrevia"></div></section>';
  }
  var eq=d.equipo||[];
  var h='<section><h4>Minuta '+(r.minuta_estado==='borrador'?'<span class="estado cel sin">borrador guardado</span>':'')+'</h4><div class="as-min">'
    +'<label class="campo"><span>Resumen para el cliente '+contador(f.resumen.trim().length,40)+'</span><textarea data-f="resumen" maxlength="3000" placeholder="Qué conversamos y qué decidimos, en palabras simples para el cliente.">'+esc(f.resumen)+'</textarea></label>'
    +'<label class="campo"><span>Seguimiento '+contador(f.seguimiento.trim().length,5)+'</span><textarea data-f="seguimiento" maxlength="2000" placeholder="Qué haremos después y cómo le avisaremos.">'+esc(f.seguimiento)+'</textarea></label>'
    +'<label class="campo"><span>Próxima reunión sugerida (opcional)</span><input data-f="proxima" maxlength="500" placeholder="Ej.: en marzo, para revisar la renta" value="'+esc(f.proxima)+'"></label>'
    +'<label class="campo as-notas"><span>Notas internas <span class="as-lock">🔒 el cliente no las ve</span></span><textarea data-f="notas" maxlength="3000" placeholder="Solo para el equipo.">'+esc(f.notas)+'</textarea></label>'
    +'<div class="campo"><span>Acuerdos</span></div><div id="asAcuerdos">'+acuerdosForm(eq)+'</div>'
    +'<div class="acciones" style="justify-content:space-between;align-items:center"><button type="button" class="btn chico sec" data-act="acu-mas"'+(f.sin?' disabled':'')+'>＋ Acuerdo</button>'
    +'<label class="chk" style="margin:0"><input type="checkbox" data-f="sin"'+(f.sin?' checked':'')+'>Sin acuerdos</label></div>'
    +'<p class="merr" id="asMinErr" role="alert"></p>'
    +'<div class="acciones fin">'
    +'<button type="button" class="btn sec peligro" data-act="no_asistio" data-id="'+esc(r.id)+'">No asistió</button>'
    +'<button type="button" class="btn sec" data-act="min-guardar">Guardar borrador</button>'
    +'<button type="button" class="btn" data-act="min-publicar">'+I('enviar')+'Publicar minuta</button></div></div></section>'
    +'<section><div id="asPrevia"></div></section>';
  return h;
}
function acuerdosForm(eq){
  var f=S.form;
  if(!f.acuerdos.length)return '<p class="t3" style="margin:4px 0">'+(f.sin?'Marcado «Sin acuerdos».':'Sin acuerdos todavía. Usa «＋ Acuerdo».')+'</p>';
  return '<div class="'+(f.sin?'as-acu-off':'')+'"><div class="as-acu-h"><span>Qué</span><span>Responsable</span><span>Persona del equipo</span><span>Fecha</span><span></span></div>'
    +f.acuerdos.map(function(a,i){
      return '<div class="as-acu" data-i="'+i+'">'
        +'<input class="d" data-a="descripcion" data-i="'+i+'" maxlength="300" placeholder="Qué se acordó" value="'+esc(a.descripcion)+'" aria-label="Acuerdo">'
        +'<select data-a="responsable" data-i="'+i+'" aria-label="Responsable"><option value="cliente"'+(a.responsable==='cliente'?' selected':'')+'>Cliente</option><option value="contadoor"'+(a.responsable==='contadoor'?' selected':'')+'>Contadoor</option></select>'
        +'<select data-a="uid" data-i="'+i+'" aria-label="Persona del equipo"'+(a.responsable!=='contadoor'?' disabled':'')+'><option value="">'+(a.responsable==='contadoor'?'Contadoor (sin persona)':'—')+'</option>'
        +eq.map(function(u){return '<option value="'+esc(u.id)+'"'+(String(u.id)===a.uid?' selected':'')+'>'+esc(u.nombre)+'</option>';}).join('')+'</select>'
        +'<input type="date" data-a="vence" data-i="'+i+'" value="'+esc(a.vence)+'" aria-label="Fecha">'
        +'<button type="button" class="x" data-act="acu-quitar" data-i="'+i+'" aria-label="Quitar acuerdo">'+I('cerrar')+'</button></div>';}).join('')+'</div>';
}
function pintarPrevia(){
  var p=$('asPrevia');if(!p||!S.det||!S.form)return;var f=S.form, eq=S.det.equipo||[];
  var acu=f.sin?[]:f.acuerdos.filter(function(a){return a.descripcion.trim().length>=3;});
  function bloque(t,v){return '<h5>'+esc(t)+'</h5><p'+(v.trim()?'':' class="vacio"')+'>'+(v.trim()?esc(v.trim()):'(vacío)')+'</p>';}
  p.innerHTML='<div class="as-prev"><small>'+I('ver')+'Así lo verá el cliente en MiContadoor</small>'
    +bloque('Resumen',f.resumen)+bloque('Seguimiento',f.seguimiento)+(f.proxima.trim()?bloque('Próxima reunión sugerida',f.proxima):'')
    +'<h5>Acuerdos</h5>'+(acu.length?'<ul class="as-prev-acu">'+acu.map(function(a){
      var quien=a.responsable==='contadoor'?(nombreEquipo(eq,a.uid)||'Contadoor'):'Tú';
      return '<li><span class="tx"><b>'+esc(a.descripcion.trim())+'</b><small>'+esc(quien)+(a.vence?' · vence '+esc(fechaCorta(a.vence)):'')+'</small></span></li>';}).join('')+'</ul>'
      :'<p class="vacio">'+(f.sin?'Sin acuerdos en esta reunión.':'(ninguno todavía)')+'</p>')
    +'<p class="nota">Las notas internas nunca se muestran al cliente.</p></div>';
}
function repintarAcuerdos(){var c=$('asAcuerdos');if(c&&S.det)c.innerHTML=acuerdosForm(S.det.equipo||[]);var b=document.querySelector('[data-act="acu-mas"]');if(b)b.disabled=!!S.form.sin;pintarPrevia();}

/* ── Acciones de estado ── */
function buscar(id){var r=(S.reuniones||[]).find(function(x){return String(x.id)===String(id);});if(S.det&&S.det.reunion&&String(S.det.reunion.id)===String(id))r=S.det.reunion;return r;}
function trasCambio(msg){G.toast(msg);var abierta=S.detId;return cargar().then(function(){if(abierta)return cargarFicha();});}
function manejarConcurrente(e){if(e&&e.message==='ASE_CAMBIO_CONCURRENTE'){var abierta=S.detId;cargar().then(function(){if(abierta)cargarFicha();});}}
function confirmar(id){
  var r=buscar(id);if(!r||S.ocupado)return;
  G.modal({titulo:'Confirmar reunión',ok:'Confirmar',okClase:'verde',
    html:'<p><b>'+esc(r.cliente&&r.cliente.razon_social||'Cliente')+'</b> · '+temaChip(r.tema)+'</p><p>'+esc(cuando(r.inicio,r.fin))+'</p>'+(r.es_pagada?'<div class="aviso ambar">'+I('moneda','ic-amb')+'<span>Asesoría pagada: quedará <b>por cobrar '+G.clpT(r.precio||PRECIO_PAGADA)+'</b>.</span></div>':'')
      +'<p class="nota">El aviso al cliente y el evento con Meet llegan en la Parte 2.</p>',
    alAceptar:function(){return D.cambiarEstado({p_id:Number(r.id),p_accion:'confirmar',p_version:r.version,p_motivo:null}).then(exigirOk).then(function(){return trasCambio('Reunión confirmada. El cliente ya ve el enlace de la sala de Meet en MiContadoor.');})
      .catch(function(e){manejarConcurrente(e);throw new Error(mErr(e));});}});
}
function rechazar(id){
  var r=buscar(id);if(!r)return;var esConf=r.estado==='confirmada';
  G.modal({titulo:esConf?'Cancelar reunión':'Rechazar solicitud',ok:esConf?'Cancelar reunión':'Rechazar',okClase:'peligro',cancelar:'Volver',
    html:'<p><b>'+esc(r.cliente&&r.cliente.razon_social||'Cliente')+'</b> · '+esc(cuando(r.inicio,r.fin))+'</p>'
      +'<label class="campo"><span>Motivo (el cliente lo verá)</span><textarea id="asMotivo" maxlength="300" placeholder="Ej.: ese día tenemos cierre; te proponemos otro horario."></textarea></label>'
      +'<p class="nota">No cuenta en el cupo del cliente'+(r.es_pagada?' y el cobro de la pagada se anula':'')+'.</p>',
    alAceptar:function(m){var mot=m.querySelector('#asMotivo').value.trim();if(mot.length<5)throw new Error(ERR.ASE_MOTIVO);
      return D.cambiarEstado({p_id:Number(r.id),p_accion:'rechazar',p_version:r.version,p_motivo:mot}).then(exigirOk).then(function(){return trasCambio(esConf?'Reunión cancelada.':'Solicitud rechazada.');})
        .catch(function(e){manejarConcurrente(e);throw new Error(mErr(e));});}});
}
function noAsistio(id){
  var r=buscar(id);if(!r)return;
  G.modal({titulo:'El cliente no asistió',ok:'Marcar «No asistió»',okClase:'peligro',cancelar:'Volver',
    html:'<p><b>'+esc(r.cliente&&r.cliente.razon_social||'Cliente')+'</b> · '+esc(cuando(r.inicio,r.fin))+'</p><p>La reunión <b>se le devuelve</b> al cliente (no cuenta en su cupo)'+(r.es_pagada?' y el cobro de la pagada se anula':'')+'. No se publica minuta.</p>'
      +'<label class="campo"><span>Comentario interno (opcional)</span><textarea id="asMotivo" maxlength="300"></textarea></label>',
    alAceptar:function(m){var mot=m.querySelector('#asMotivo').value.trim()||null;
      return D.cambiarEstado({p_id:Number(r.id),p_accion:'no_asistio',p_version:r.version,p_motivo:mot}).then(exigirOk).then(function(){return trasCambio('Marcada «No asistió».');})
        .catch(function(e){manejarConcurrente(e);throw new Error(mErr(e));});}});
}
function realizada(id){
  var r=buscar(id);if(!r||S.ocupado)return;S.ocupado=true;
  D.cambiarEstado({p_id:Number(r.id),p_accion:'realizada',p_version:r.version,p_motivo:null}).then(exigirOk).then(function(){return trasCambio('Marcada como realizada. Falta la minuta.');})
    .catch(function(e){manejarConcurrente(e);G.toast(mErr(e),true);}).then(function(){S.ocupado=false;});
}

/* ── Minuta ── */
function payloadMinuta(publicar){
  var f=S.form, r=S.det.reunion;
  var malos=f.acuerdos.filter(function(a){var t=a.descripcion.trim();return t.length>0&&t.length<3;});
  if(!f.sin&&malos.length)throw new Error('Cada acuerdo debe describir qué se acordó (al menos 3 caracteres).');
  var acu=f.sin?[]:f.acuerdos.filter(function(a){return a.descripcion.trim().length>=3;}).map(function(a){
    var o={descripcion:a.descripcion.trim(),responsable:a.responsable==='contadoor'?'contadoor':'cliente'};
    if(o.responsable==='contadoor'&&/^\d+$/.test(a.uid))o.responsable_usuario_id=Number(a.uid);
    if(/^\d{4}-\d{2}-\d{2}$/.test(a.vence))o.vence=a.vence;
    return o;});
  if(publicar){
    if(f.resumen.trim().length<40)throw new Error(ERR.ASE_RESUMEN_CORTO);
    if(f.seguimiento.trim().length<5)throw new Error(ERR.ASE_SEGUIMIENTO);
    if(!acu.length&&!f.sin)throw new Error(ERR.ASE_ACUERDOS_O_SIN);
  }
  return {p_id:Number(r.id),p_resumen:f.resumen,p_seguimiento:f.seguimiento,p_proxima:f.proxima,p_notas:f.notas,p_sin_acuerdos:!!f.sin,p_acuerdos:acu,p_publicar:!!publicar};
}
function guardarMinuta(publicar){
  var err=$('asMinErr');if(err)err.textContent='';
  var p;try{p=payloadMinuta(publicar);}catch(e){if(err)err.textContent=e.message;return;}
  if(!publicar){
    if(S.ocupado)return;S.ocupado=true;
    D.minutaGuardar(p).then(exigirOk).then(function(){return trasCambio('Borrador guardado.');})
      .catch(function(e){var t=$('asMinErr');if(t)t.textContent=mErr(e);G.toast(mErr(e),true);}).then(function(){S.ocupado=false;});
    return;
  }
  G.modal({titulo:'Publicar minuta',ok:'Publicar',
    html:'<p>El cliente verá en MiContadoor el <b>resumen</b>, el <b>seguimiento</b>, la próxima reunión sugerida y los <b>'+p.p_acuerdos.length+' acuerdo(s)</b>. Las notas internas no se publican.</p><p>La reunión quedará <b>cerrada</b>.</p>',
    alAceptar:function(){return D.minutaGuardar(p).then(exigirOk).then(function(){return trasCambio('Minuta publicada. La reunión quedó cerrada.');})
      .catch(function(e){throw new Error(mErr(e));});}});
}
function marcarAcuerdo(chk){
  var id=chk.getAttribute('data-id'), estado=chk.checked?'cumplido':'pendiente';chk.disabled=true;
  D.acuerdoMarcar({p_acuerdo:Number(id),p_estado:estado}).then(exigirOk).then(function(){
    var a=(S.det&&S.det.acuerdos_previos||[]).find(function(x){return String(x.id)===String(id);});if(a)a.estado=estado;
    var li=chk.closest('li');if(li){li.classList.toggle('cumplido',estado==='cumplido');if(estado==='cumplido')li.classList.remove('vencido');}
    chk.disabled=false;G.toast(estado==='cumplido'?'Acuerdo marcado cumplido.':'Acuerdo vuelto a pendiente.');
  }).catch(function(e){chk.checked=!chk.checked;chk.disabled=false;G.toast(mErr(e),true);});
}

/* ── Agendar por el cliente ── */
var AG={clientes:null,sel:null,horarios:null,cupo:null};
function agendar(){
  AG={clientes:null,sel:null,horarios:null,cupo:null};
  var m=G.modal({titulo:'Agendar por el cliente',ok:'Crear solicitud',
    html:'<p class="nota" style="margin-top:0">Para cuando el cliente la pide por WhatsApp o correo. Queda <b>por confirmar</b> y avisa al anfitrión.</p>'
      +'<label class="campo"><span>Cliente activo</span><input id="agBuscar" type="search" placeholder="Buscar por nombre o RUT" autocomplete="off"></label>'
      +'<select id="agCliente" size="5" aria-label="Cliente" style="width:100%;border-radius:12px;padding:6px;font-size:15px"><option disabled>Cargando clientes…</option></select>'
      +'<label class="campo"><span>Tema</span><select id="agTema"><option value="">Elige un tema</option><option value="estrategico">Estratégica (con Luciano)</option><option value="contable">Contable</option><option value="rrhh">RR. HH.</option></select></label>'
      +'<div id="agHorarios"></div>'
      +'<label class="campo"><span>Motivo (lo verá el anfitrión)</span><textarea id="agMotivo" maxlength="1000" placeholder="Qué quiere conversar el cliente. Nunca claves ni contraseñas."></textarea></label>'
      +'<div id="agPago"></div>',
    alAceptar:function(mm){
      var cli=mm.querySelector('#agCliente').value, tema=mm.querySelector('#agTema').value, mot=mm.querySelector('#agMotivo').value.trim();
      if(!cli)throw new Error('Elige el cliente.');if(!tema)throw new Error('Elige el tema.');
      if(!AG.sel)throw new Error('Elige un horario.');
      if(mot.length<5)throw new Error(ERR.ASE_MOTIVO);
      var pag=!AG.sel.incluida;
      if(pag){var ck=mm.querySelector('#agAcepto');if(!ck||!ck.checked)throw new Error('Marca la aceptación de la asesoría pagada de $35.000.');}
      return D.solicitarPorCliente({p_cliente:Number(cli),p_tema:tema,p_inicio:AG.sel.inicio,p_motivo:mot,p_pagada:pag}).then(exigirOk).then(function(res){
        G.toast('Solicitud creada. Queda por confirmar.');S.tab='confirmar';return cargar().then(function(){if(res.id!=null)abrirFicha(res.id);});
      }).catch(function(e){if(e&&e.message==='ASE_HORA_NO_DISPONIBLE')cargarHorarios(mm);throw new Error(mErr(e));});
    },
    alAbrir:function(mm){
      D.clientes().then(function(L){if(!Array.isArray(L))throw codigoErr('ASE_RESPUESTA');AG.clientes=L;pintarClientes(mm);})
        .catch(function(e){mm.querySelector('#agCliente').innerHTML='<option disabled>No se pudo cargar la lista de clientes: '+esc(mErr(e))+'</option>';});
      mm.querySelector('#agBuscar').addEventListener('input',function(){pintarClientes(mm);});
      mm.querySelector('#agCliente').addEventListener('change',function(){cargarHorarios(mm);});
      mm.querySelector('#agTema').addEventListener('change',function(){cargarHorarios(mm);});
      mm.querySelector('#agHorarios').addEventListener('click',function(ev){var b=ev.target.closest('[data-slot]');if(!b)return;
        AG.sel=AG.horarios[Number(b.getAttribute('data-slot'))];
        mm.querySelectorAll('.as-slot').forEach(function(x){x.classList.toggle('on',x===b);x.setAttribute('aria-pressed',x===b);});pintarPago(mm);});
    }});
  return m;
}
function norm(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[.\-\s]/g,'');}
function pintarClientes(mm){
  var q=norm(mm.querySelector('#agBuscar').value), sel=mm.querySelector('#agCliente'), prev=sel.value;
  var L=(AG.clientes||[]).filter(function(c){return !q||norm(c.razon_social).indexOf(q)>=0||norm(c.rut).indexOf(q)>=0;});
  sel.innerHTML=L.length?L.slice(0,300).map(function(c){return '<option value="'+esc(c.id)+'"'+(String(c.id)===prev?' selected':'')+'>'+esc(c.razon_social)+' · '+esc(c.rut||'')+' · '+esc(planTxt(c.plan))+'</option>';}).join(''):'<option disabled>Sin clientes activos que coincidan.</option>';
}
function cargarHorarios(mm){
  var cli=mm.querySelector('#agCliente').value, tema=mm.querySelector('#agTema').value, box=mm.querySelector('#agHorarios');
  AG.sel=null;AG.horarios=null;pintarPago(mm);
  if(!cli||!tema){box.innerHTML='';return;}
  box.innerHTML='<div class="aviso lila"><span class="gc-spin"></span>Buscando horarios…</div>';
  D.horariosCliente({p_cliente:Number(cli),p_tema:tema}).then(exigirOk).then(function(r){
    if(mm.querySelector('#agCliente').value!==cli||mm.querySelector('#agTema').value!==tema)return;
    AG.horarios=Array.isArray(r.horarios)?r.horarios:[];AG.cupo=r.cupo||null;
    if(!AG.horarios.length){box.innerHTML='<p class="nota">'+cupoTexto(AG.cupo)+'</p><div class="aviso ambar">'+I('calendario','ic-amb')+'<span>No hay horarios libres en los próximos 21 días para este tema (o el cliente no tiene asesor asignado).</span></div>';return;}
    var h='<p class="nota">'+cupoTexto(AG.cupo)+'</p><div class="campo"><span>Horario (hora de Chile)</span></div><div class="as-slots">',dia='';
    AG.horarios.forEach(function(s,i){var d=diaCL(s.inicio);
      if(d!==dia){if(dia)h+='</div></div>';dia=d;h+='<div><div class="dia">'+esc(largo(s.inicio))+'</div><div class="fila">';}
      h+='<button type="button" class="as-slot'+(s.incluida?'':' pag')+'" data-slot="'+i+'" aria-pressed="false">'+esc(hm(s.inicio))+(s.incluida?'':' · $35.000')+'</button>';});
    h+='</div></div></div>';box.innerHTML=h;
  }).catch(function(e){box.innerHTML='<div class="aviso rojo">'+I('alerta','ic-roj')+'<span>No se pudieron cargar los horarios: '+esc(mErr(e))+'</span></div>';});
}
function pintarPago(mm){
  var b=mm.querySelector('#agPago');if(!b)return;
  if(!AG.sel||AG.sel.incluida){b.innerHTML=AG.sel?'<div class="aviso verde">'+I('check','ic-ver')+'<span>Incluida en el plan del cliente · 30 min ('+esc(hm(AG.sel.inicio))+'–'+esc(hm(AG.sel.fin))+').</span></div>':'';return;}
  b.innerHTML='<div class="aviso ambar">'+I('moneda','ic-amb')+'<span>Este horario no está incluido en su cupo: será una <b>asesoría pagada de 1 hora a $35.000</b> ('+esc(hm(AG.sel.inicio))+'–'+esc(hm(AG.sel.fin))+'), por cobrar.</span></div>'
    +'<label class="chk"><input type="checkbox" id="agAcepto">El cliente aceptó pagar $35.000 por esta asesoría.</label>';
}

/* ── Eventos ── */
document.addEventListener('click',function(ev){
  var b=ev.target.closest('[data-act]');if(!b)return;var a=b.getAttribute('data-act');
  if(a==='acuerdo-marcar')return;   // lo maneja 'change'
  if(a==='tab'){S.tab=b.getAttribute('data-tab');render();}
  else if(a==='ficha')abrirFicha(b.getAttribute('data-id'));
  else if(a==='ficha-recargar')cargarFicha();
  else if(a==='recargar'){S.err=null;S.reuniones=null;render();cargar();}
  else if(a==='confirmar')confirmar(b.getAttribute('data-id'));
  else if(a==='rechazar')rechazar(b.getAttribute('data-id'));
  else if(a==='no_asistio')noAsistio(b.getAttribute('data-id'));
  else if(a==='realizada')realizada(b.getAttribute('data-id'));
  else if(a==='agendar')agendar();
  else if(a==='acu-mas'&&S.form){S.form.acuerdos.push({descripcion:'',responsable:'cliente',uid:'',vence:''});repintarAcuerdos();
    var ins=document.querySelectorAll('#asAcuerdos input.d');if(ins.length)ins[ins.length-1].focus();}
  else if(a==='acu-quitar'&&S.form){S.form.acuerdos.splice(Number(b.getAttribute('data-i')),1);repintarAcuerdos();}
  else if(a==='min-guardar')guardarMinuta(false);
  else if(a==='min-publicar')guardarMinuta(true);
});
document.addEventListener('keydown',function(ev){
  if(ev.key!=='Enter'&&ev.key!==' ')return;var t=ev.target;
  if(t&&t.classList&&t.classList.contains('kpi')&&t.getAttribute('data-act')==='tab'){ev.preventDefault();S.tab=t.getAttribute('data-tab');render();}
});
document.addEventListener('input',function(ev){
  var t=ev.target;if(!S.form||!t.closest||!t.closest('#gcDet'))return;
  var f=t.getAttribute('data-f'), ai=t.getAttribute('data-a');
  if(f&&f!=='sin'){S.form[f]=t.value;var lab=t.closest('.campo'),c=lab&&lab.querySelector('.cnt');
    if(c){var min=f==='resumen'?40:5,n=t.value.trim().length;c.textContent=n+' / mín. '+min;c.classList.toggle('ok',n>=min);}pintarPrevia();}
  else if(ai&&ai!=='responsable'&&ai!=='uid'){var x=S.form.acuerdos[Number(t.getAttribute('data-i'))];if(x){x[ai]=t.value;pintarPrevia();}}
});
document.addEventListener('change',function(ev){
  var t=ev.target;if(!t.getAttribute)return;
  if(t.getAttribute('data-act')==='acuerdo-marcar'){marcarAcuerdo(t);return;}
  if(!S.form||!t.closest||!t.closest('#gcDet'))return;
  if(t.getAttribute('data-f')==='sin'){S.form.sin=t.checked;repintarAcuerdos();return;}
  var ai=t.getAttribute('data-a');if(!ai)return;var x=S.form.acuerdos[Number(t.getAttribute('data-i'))];if(!x)return;
  x[ai]=t.value;if(ai==='responsable'){if(t.value!=='contadoor')x.uid='';repintarAcuerdos();}else pintarPrevia();
});

function iniciar(){
  var c=$('gcDetCerrar');if(c){c.innerHTML=I('cerrar');c.addEventListener('click',cerrarFicha);}
  var v=$('gcVelo');if(v)v.addEventListener('click',cerrarFicha);
  // Escape: gestoor-cartera.js cierra primero el modal y, si no hay, la ficha. En captura se decide ANTES de que el modal se cierre.
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&S.detId&&!document.querySelector('.gc-modal')){S.detId=null;S.det=null;S.form=null;urlReunion(null);}},true);
  var ag=$('asAgendar');if(ag)ag.innerHTML=I('plus')+'Agendar por el cliente';
  if(DEMO){$('gcDemo').hidden=false;document.documentElement.classList.remove('auth-pending');if(window.ASE_DEMO_UI)window.ASE_DEMO_UI(function(){cerrarFicha();S.reuniones=null;render();cargar();});}
  var rq=null;try{rq=new URL(location.href).searchParams.get('r');}catch(e){}
  cargar().then(function(){if(rq&&/^\d+$/.test(rq))abrirFicha(rq,true);});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',iniciar);else iniciar();
})();
