/* ============================================================
   asesorias/asesorias-demo.js — MODO DEMOSTRACIÓN de Asesorías Al Día (datos 100 % ficticios)
   Candado 2 de 3: solo se define en localhost / 127.0.0.1 / [::1]. No se conecta a Supabase; nada se guarda
   (todo vive en memoria y se pierde al recargar). Empresas y personas inventadas; RUT ficticios.
   Imita las reglas de la migración 202611281600_asesorias_al_dia (cupos, horarios, transiciones, validaciones de la minuta).
   ============================================================ */
(function(){
'use strict';
var h=location.hostname;if(!(h==='localhost'||h==='127.0.0.1'||h==='[::1]'))return;
var G=window.GC, TZ='America/Santiago';
function ok(x){return new Promise(function(r){setTimeout(function(){r(JSON.parse(JSON.stringify(x)));},160);});}
function no(cod){return ok({ok:false,codigo:cod});}
function exc(cod){var e=new Error(cod);e.srv={code:'42501',message:cod,status:403};return new Promise(function(_,rj){setTimeout(function(){rj(e);},160);});}
var fDia=new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'});
var fHora=new Intl.DateTimeFormat('en-GB',{timeZone:TZ,hour:'2-digit',minute:'2-digit',hour12:false});
function diaCL(d){return fDia.format(new Date(d));}
function addD(iso,n){var d=new Date(iso+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
/* Fecha + hora de Chile → ISO (prueba los desfases -3 y -4). */
function cl(fecha,hora){
  for(var off=3;off<=4;off++){var d=new Date(fecha+'T'+hora+':00Z');d.setUTCHours(d.getUTCHours()+off);
    if(fDia.format(d)===fecha&&fHora.format(d)===hora)return d.toISOString();}
  return new Date(fecha+'T'+hora+':00-03:00').toISOString();
}
function mas(iso,min){return new Date(new Date(iso).getTime()+min*60000).toISOString();}
var HOY=G.hoyCL();
function isodow(f){var d=new Date(f+'T12:00:00Z').getUTCDay();return d===0?7:d;}

/* ── Equipo y clientes ficticios ── */
var EQ=[{id:1,nombre:'Master Demo',iniciales:'MD',color:'#924893',master:true},{id:2,nombre:'Asesora Contable Demo',iniciales:'AC',color:'#0E8FCF'},
  {id:3,nombre:'Asesor RR. HH. Demo',iniciales:'AR',color:'#0F8A6A'}];
function dvRut(n){var s=0,m=2;String(n).split('').reverse().forEach(function(c){s+=Number(c)*m;m=m===7?2:m+1;});var r=11-(s%11);return r===11?'0':r===10?'K':String(r);}
var CLI=[[101,'Cafetería Brisa Andina SpA','estrategico'],[102,'Taller Ruedas del Sur Ltda.','asesoria'],[103,'Estudio Creativo Nube Lila SpA','cumplimiento'],
  [104,'Ferretería El Martillo Feliz EIRL','cumplimiento'],[105,'Clínica Veterinaria Patitas SpA','asesoria'],[106,'Transportes Cóndor Azul SpA','estrategico'],
  [107,'Librería Hoja Nueva Ltda.','asesoria']].map(function(c){var n=76000000+c[0]*1111;return {id:c[0],razon_social:c[1],plan:c[2],rut:n+'-'+dvRut(n),estado:'activo',contable:2,rrhh:3};});
CLI[6].rrhh=null;   // Librería Hoja Nueva: sin asesor de RR. HH. (para ver ASE_SIN_ANFITRION)
function cli(id){return CLI.find(function(c){return c.id===Number(id);});}
function eq(id){return EQ.find(function(u){return u.id===Number(id);});}
var YO=1;   // «Ver como»: 1 = Master · 2 = Asesora contable

/* ── Reuniones ficticias, relativas a hoy ── */
var R=[], MIN={}, ACU=[], EV=[], rid=500, aid=900;
function nueva(cid,tema,fecha,hora,estado,o){
  o=o||{};var ini=cl(fecha,hora), dur=o.pagada?60:30;
  var r={id:++rid,cliente_id:cid,tema:tema,motivo:o.motivo||'Revisar la situación de la empresa.',anfitrion_id:anf(cid,tema),inicio:ini,fin:mas(ini,dur),estado:estado,
    es_pagada:!!o.pagada,precio:o.pagada?35000:null,cobro_estado:o.pagada?'por_cobrar':'no_aplica',canal:o.canal||'micontadoor',solicitada_por_usuario_id:null,
    confirmada_por:null,confirmada_at:null,cancelada_por:o.cancelada_por||null,motivo_cancelacion:o.motivo_cancelacion||null,cancelada_at:null,meet_url:null,evento_id:null,
    version:1,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
  R.push(r);ev(r,'solicitada',{canal:r.canal,pagada:r.es_pagada});
  if(estado!=='solicitada'&&estado!=='cancelada')ev(r,'confirmar',{});
  return r;
}
function anf(cid,tema){var c=cli(cid);if(!c)return null;return tema==='estrategico'?1:tema==='contable'?c.contable:c.rrhh;}
function ev(r,tipo,det){EV.push({reunion_id:r.id,tipo:tipo,detalle:det||{},at:new Date().toISOString()});}
function horaRel(min){var d=new Date(Date.now()+min*60000);d.setUTCMinutes(d.getUTCMinutes()<30?0:30,0,0);return {fecha:diaCL(d),hora:fHora.format(d)};}
(function(){
  nueva(101,'estrategico',addD(HOY,3),'10:30','solicitada',{motivo:'Queremos evaluar abrir una segunda sucursal y cómo afecta los impuestos.'});
  nueva(104,'contable',addD(HOY,5),'16:30','solicitada',{pagada:true,canal:'gestoor',motivo:'Dudas sobre el cambio de régimen tributario para el próximo año.'});
  nueva(105,'rrhh',addD(HOY,4),'11:20','solicitada',{motivo:'Contratar a dos personas en enero: qué contrato conviene.'});
  var a=horaRel(120);nueva(102,'contable',a.fecha,a.hora,'confirmada',{motivo:'Revisar el balance del tercer trimestre.'});
  var b=horaRel(-180);nueva(106,'estrategico',b.fecha,b.hora,'confirmada',{motivo:'Plan de inversión 2027 y flujo de caja.'});
  var r4=nueva(107,'contable',addD(HOY,-2),'16:30','confirmada',{motivo:'Gastos rechazados en el F29 de octubre.'});
  MIN[r4.id]={reunion_id:r4.id,estado:'borrador',resumen_cliente:'Revisamos los gastos del F29 de octubre.',seguimiento:'',proxima_sugerida:'',notas_internas:'Pedir boletas de combustible.',sin_acuerdos:false,version:1};
  ACU.push({id:++aid,reunion_id:r4.id,cliente_id:107,descripcion:'Enviar boletas de combustible de octubre',responsable_tipo:'cliente',responsable_usuario_id:null,vence:addD(HOY,5),estado:'pendiente'});
  nueva(101,'estrategico',addD(HOY,-1),'17:20','realizada',{motivo:'Ver precios de la nueva carta.'});
  nueva(105,'contable',addD(HOY,8),'10:30','confirmada',{motivo:'Preparar la renta con tiempo.'});
  var c6=nueva(106,'estrategico',addD(HOY,-20),'11:20','cerrada',{motivo:'Revisión mensual.'});
  MIN[c6.id]={reunion_id:c6.id,estado:'publicada',resumen_cliente:'Conversamos sobre el flujo de caja del trimestre y la renovación de dos camiones.',seguimiento:'Te enviaremos una simulación del crédito antes del día 15.',proxima_sugerida:'En enero, para cerrar el año.',notas_internas:'El cliente evalúa leasing.',sin_acuerdos:false,publicada_at:new Date(Date.now()-19*864e5).toISOString(),version:2};
  ACU.push({id:++aid,reunion_id:c6.id,cliente_id:106,descripcion:'Enviar cotización de leasing de los camiones',responsable_tipo:'cliente',responsable_usuario_id:null,vence:addD(HOY,-3),estado:'pendiente'});
  ACU.push({id:++aid,reunion_id:c6.id,cliente_id:106,descripcion:'Simular el crédito a 36 meses',responsable_tipo:'contadoor',responsable_usuario_id:1,vence:addD(HOY,4),estado:'pendiente'});
  nueva(103,'contable',addD(HOY,-10),'16:30','cancelada',{cancelada_por:'cliente',motivo_cancelacion:'Se me cruzó con un viaje.',pagada:true}).cobro_estado='anulado';
  nueva(102,'rrhh',addD(HOY,-15),'10:30','no_asistio',{motivo:'Finiquito de un trabajador.'});
})();

/* ── Reglas (iguales a la base, simplificadas) ── */
function cupo(cid,fecha){
  var c=cli(cid), n=c.plan==='estrategico'||c.plan==='asesoria'?1:0, cada=c.plan==='asesoria'?3:1;
  var y=Number(fecha.slice(0,4)), m=Number(fecha.slice(5,7)), m0=cada===1?m:Math.floor((m-1)/cada)*cada+1;
  var desde=y+'-'+('0'+m0).slice(-2)+'-01', hd=new Date(Date.UTC(y,m0-1+cada,0)), hasta=hd.toISOString().slice(0,10);
  var us=R.filter(function(r){var d=diaCL(r.inicio);return r.cliente_id===c.id&&!r.es_pagada&&['solicitada','confirmada','realizada','cerrada'].indexOf(r.estado)>=0&&d>=desde&&d<=hasta;}).length;
  return {plan:c.plan,n:n,cada_meses:cada,desde:desde,hasta:hasta,usadas:us,disponibles:Math.max(n-us,0),precio_pagada:35000,duracion_pagada_min:60,duracion_min:30};
}
function bloqueado(f,tema){
  var w=isodow(f);if(w>5)return true;if(tema!=='estrategico'&&[2,3,4].indexOf(w)<0)return true;
  var n=0,d=f.slice(0,8)+'01';while(d<=f){if(isodow(d)<=5)n++;d=addD(d,1);}if(n<=5)return true;
  var dia=Number(f.slice(8,10));if(tema==='contable'&&dia===20)return true;if(tema==='rrhh'&&(dia>=30||dia<=8||dia===13))return true;
  return false;
}
function horarios(cid,tema){
  var a=anf(cid,tema);if(!a)return [];var out=[];
  for(var i=2;i<=21;i++){var f=addD(HOY,i);if(bloqueado(f,tema))continue;
    var vivas=R.filter(function(r){return r.anfitrion_id===a&&(r.estado==='solicitada'||r.estado==='confirmada');});
    if(vivas.filter(function(r){return diaCL(r.inicio)===f;}).length>=3)continue;
    var cu=cupo(cid,f);
    ['10:30','11:20','16:30','17:20'].forEach(function(hh){
      var dur=cu.disponibles>0?30:60;if(dur===60&&(hh==='11:20'||hh==='17:20'))return;
      var ini=cl(f,hh), t0=new Date(ini).getTime(), t1=t0+(dur+20)*60000;
      if(vivas.some(function(r){var a0=new Date(r.inicio).getTime(),a1=new Date(r.fin).getTime()+20*60000;return a0<t1&&t0<a1;}))return;
      out.push({inicio:ini,fin:mas(ini,dur),incluida:dur===30});});
  }
  return out;
}
function puedeVer(r){if(YO===1)return true;var c=cli(r.cliente_id);return r.anfitrion_id===YO||c.contable===YO||c.rrhh===YO;}
function fila(r){
  var c=cli(r.cliente_id),u=eq(r.anfitrion_id),o=JSON.parse(JSON.stringify(r));
  o.cliente={id:c.id,razon_social:c.razon_social,rut:c.rut,plan:c.plan};
  o.anfitrion=u?{id:u.id,nombre:u.nombre,iniciales:u.iniciales,color:u.color}:null;
  o.minuta_estado=MIN[r.id]?MIN[r.id].estado:null;o.cupo=cupo(r.cliente_id,diaCL(r.inicio));return o;
}
function buscar(id){return R.find(function(r){return r.id===Number(id);});}
function puedeActuar(r){return YO===1||r.anfitrion_id===YO;}

window.ASE_DEMO_API={
  agenda:function(d,h){return ok({ok:true,yo:{id:YO,master:YO===1},reuniones:R.filter(function(r){var x=diaCL(r.inicio);return x>=d&&x<=h&&puedeVer(r);})
    .sort(function(a,b){return a.inicio.localeCompare(b.inicio);}).map(fila)});},
  detalle:function(id){var r=buscar(id);if(!r||!puedeVer(r))return exc('ASE_SIN_ACCESO');
    return ok({ok:true,reunion:fila(r),minuta:MIN[r.id]||null,
      acuerdos:ACU.filter(function(a){return a.reunion_id===r.id&&a.estado!=='anulado';}),
      acuerdos_previos:ACU.filter(function(a){return a.cliente_id===r.cliente_id&&a.reunion_id!==r.id&&a.estado==='pendiente';}),
      eventos:EV.filter(function(e){return e.reunion_id===r.id;}),equipo:EQ.map(function(u){return {id:u.id,nombre:u.nombre};})});},
  cambiarEstado:function(a){
    var r=buscar(a.p_id);if(!r||!puedeActuar(r))return no('ASE_SIN_PERMISO');if(r.version!==a.p_version)return no('ASE_CAMBIO_CONCURRENTE');
    var ya=new Date(r.inicio).getTime()<=Date.now(), x=a.p_accion;
    if(x==='confirmar'&&r.estado==='solicitada'){r.estado='confirmada';r.confirmada_por=YO;}
    else if(x==='rechazar'&&(r.estado==='solicitada'||r.estado==='confirmada')){if(!a.p_motivo||a.p_motivo.trim().length<5)return no('ASE_MOTIVO');
      r.estado='cancelada';r.cancelada_por='contadoor';r.motivo_cancelacion=a.p_motivo.trim().slice(0,300);if(r.es_pagada)r.cobro_estado='anulado';}
    else if(x==='no_asistio'&&(r.estado==='confirmada'||r.estado==='solicitada')&&ya){r.estado='no_asistio';if(r.es_pagada)r.cobro_estado='anulado';}
    else if(x==='realizada'&&r.estado==='confirmada'&&ya)r.estado='realizada';
    else return no('ASE_TRANSICION');
    r.version++;ev(r,x,{motivo:a.p_motivo?String(a.p_motivo).slice(0,300):null});return ok({ok:true,id:r.id});
  },
  minutaGuardar:function(a){
    var r=buscar(a.p_id);if(!r||!puedeActuar(r))return no('ASE_SIN_PERMISO');
    if(['confirmada','realizada','cerrada'].indexOf(r.estado)<0||new Date(r.inicio).getTime()>Date.now())return no('ASE_AUN_NO');
    var acu=a.p_acuerdos||[];if(!Array.isArray(acu)||acu.length>30)return no('ASE_ACUERDOS');
    if(a.p_publicar){if((a.p_resumen||'').trim().length<40)return no('ASE_RESUMEN_CORTO');if((a.p_seguimiento||'').trim().length<5)return no('ASE_SEGUIMIENTO');
      if(!acu.length&&!a.p_sin_acuerdos)return no('ASE_ACUERDOS_O_SIN');}
    var m=MIN[r.id]||{reunion_id:r.id,version:0,estado:'borrador'};
    m.estado=a.p_publicar||m.estado==='publicada'?'publicada':'borrador';m.resumen_cliente=(a.p_resumen||'').trim();m.seguimiento=(a.p_seguimiento||'').trim();
    m.proxima_sugerida=(a.p_proxima||'').trim();m.notas_internas=(a.p_notas||'').trim();m.sin_acuerdos=!!a.p_sin_acuerdos;m.version++;
    if(a.p_publicar&&!m.publicada_at)m.publicada_at=new Date().toISOString();MIN[r.id]=m;
    ACU.forEach(function(g){if(g.reunion_id===r.id&&g.estado==='pendiente')g.estado='anulado';});
    var n=0;acu.forEach(function(x){if(!x.descripcion||x.descripcion.trim().length<3)return;n++;
      ACU.push({id:++aid,reunion_id:r.id,cliente_id:r.cliente_id,descripcion:x.descripcion.trim().slice(0,300),responsable_tipo:x.responsable==='contadoor'?'contadoor':'cliente',
        responsable_usuario_id:x.responsable==='contadoor'&&x.responsable_usuario_id?Number(x.responsable_usuario_id):null,vence:/^\d{4}-\d{2}-\d{2}$/.test(x.vence||'')?x.vence:null,estado:'pendiente'});});
    if(a.p_publicar){r.estado='cerrada';r.version++;}
    ev(r,a.p_publicar?'minuta_publicada':'minuta_borrador',{acuerdos:n});return ok({ok:true,id:r.id,acuerdos:n,publicada:!!a.p_publicar});
  },
  acuerdoMarcar:function(a){
    if(['pendiente','cumplido'].indexOf(a.p_estado)<0)return no('ASE_DATOS');
    var g=ACU.find(function(x){return x.id===Number(a.p_acuerdo);});if(!g||!puedeVer(buscar(g.reunion_id)))return no('ASE_SIN_PERMISO');
    g.estado=a.p_estado;ev(buscar(g.reunion_id),'acuerdo_'+a.p_estado,{acuerdo:g.id});return ok({ok:true});
  },
  horariosCliente:function(a){var c=cli(a.p_cliente);if(!c)return exc('ASE_SIN_ACCESO');
    var an=anf(c.id,a.p_tema);if(YO!==1&&an!==YO&&c.contable!==YO&&c.rrhh!==YO)return exc('ASE_SIN_ACCESO');
    return ok({ok:true,cupo:cupo(c.id,HOY),horarios:horarios(c.id,a.p_tema)});},
  solicitarPorCliente:function(a){
    var c=cli(a.p_cliente);if(!c)return exc('ASE_SIN_ACCESO');var an=anf(c.id,a.p_tema);if(!an)return no('ASE_SIN_ANFITRION');
    var mot=(a.p_motivo||'').trim();if(mot.length<5||mot.length>1000)return no('ASE_MOTIVO');
    if(/(clave|contrase[nñ]a|password)\s*[:=]/i.test(mot))return no('ASE_SIN_CLAVES');
    var s=horarios(c.id,a.p_tema).find(function(x){return x.inicio===a.p_inicio;});if(!s)return no('ASE_HORA_NO_DISPONIBLE');
    if(!s.incluida&&!a.p_pagada)return ok({ok:false,codigo:'ASE_SIN_CUPO',precio:35000});
    var r={id:++rid,cliente_id:c.id,tema:a.p_tema,motivo:mot,anfitrion_id:an,inicio:s.inicio,fin:s.fin,estado:'solicitada',es_pagada:!s.incluida,precio:s.incluida?null:35000,
      cobro_estado:s.incluida?'no_aplica':'por_cobrar',canal:'gestoor',solicitada_por_usuario_id:YO,version:1};
    R.push(r);ev(r,'solicitada',{canal:'gestoor',pagada:r.es_pagada});return ok({ok:true,id:r.id,inicio:r.inicio,fin:r.fin,pagada:r.es_pagada});
  },
  clientes:function(){return ok(CLI.map(function(c){return {id:c.id,rut:c.rut,razon_social:c.razon_social,plan:c.plan,estado:c.estado};}).sort(function(a,b){return a.razon_social.localeCompare(b.razon_social);}));}
};

/* Selector «Ver como» (solo demo). */
window.ASE_DEMO_UI=function(alCambiar){
  var top=document.querySelector('.topbar');if(!top)return;
  var w=document.createElement('div');w.className='gc-vercomo';
  w.innerHTML='<span>Ver como</span><div class="gc-seg" role="group" aria-label="Ver como (demo)">'+[[1,'Master'],[2,'Asesora contable']].map(function(r){
    return '<button type="button" class="fb'+(r[0]===YO?' on':'')+'" data-yo="'+r[0]+'" aria-pressed="'+(r[0]===YO)+'">'+r[1]+'</button>';}).join('')+'</div>';
  top.insertBefore(w,document.getElementById('asAgendar'));
  w.addEventListener('click',function(e){var b=e.target.closest('[data-yo]');if(!b)return;YO=Number(b.getAttribute('data-yo'));
    w.querySelectorAll('[data-yo]').forEach(function(x){var on=x===b;x.classList.toggle('on',on);x.setAttribute('aria-pressed',on);});alCambiar();});
};
})();
