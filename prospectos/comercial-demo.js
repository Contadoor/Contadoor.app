/* ============================================================
   prospectos/comercial-demo.js — MODO DEMOSTRACIÓN de Reuniones y Bitácora (datos 100 % ficticios)
   Candado 2 de 3: solo se define en localhost / 127.0.0.1 / [::1]. No se conecta a Supabase; nada se guarda
   (vive en memoria y en sessionStorage de esta pestaña). Personas y empresas inventadas; sin RUT, correos ni teléfonos.
   Reproduce las reglas de las RPC com_* (visibilidad, versión, cierre) para probar la pantalla sin base de datos.
   ============================================================ */
(function(){
'use strict';
var h=location.hostname;if(!(h==='localhost'||h==='127.0.0.1'||h==='[::1]'))return;
var KEY='gestoor.com.demo.v1';
function ahoraMin(m){var d=new Date();d.setSeconds(0,0);return new Date(d.getTime()+m*60000).toISOString();}
function diaHora(dias,hh,mm){var t=new Date(Date.now()+dias*864e5);var y=t.toLocaleDateString('en-CA',{timeZone:'America/Santiago'});return new Date(y+'T'+hh+':'+mm+':00-03:00').toISOString();}
var YO={id:1,nombre:'Usuario Demo',master:true,escribe:true};
var R={1:{id:1,nombre:'Usuario Demo'},2:{id:2,nombre:'Paula Demo'},3:{id:3,nombre:'Tomás Demo'}};
function semilla(){
  var L=[
    {id:101,nombre:'Camila Rojas',empresa:'Ferretería Los Aromos SpA',semaforo:'amarillo',etapa:'agendado',origen:'agenda',campana:'meta · iva-a-tiempo',resp:1,
     respuestas:{ventas:'5a20',trabajadores:'1a5',contabilidad:'externo',sociedades:'no',historicos:'si',rubro:'ferretería',dolor:'Mi contador me avisa el IVA el mismo día y nunca sé cuánto voy a pagar.'}},
    {id:102,nombre:'Jorge Castillo',empresa:'Transportes Cordillera Ltda.',semaforo:'rojo',etapa:'agendado',origen:'whatsapp',campana:null,resp:2,
     respuestas:{ventas:'20a50',trabajadores:'6a20',contabilidad:'interno',sociedades:'si',historicos:'no',rubro:'transporte de carga',dolor:'Tengo dos sociedades y no sé cuál conviene.'}},
    {id:103,nombre:'Valeria Muñoz',empresa:'Estudio de Yoga Prana',semaforo:'verde',etapa:'agendado',origen:'instagram',campana:'ig · historias',resp:null,
     respuestas:{ventas:'hasta5',trabajadores:'ninguno',contabilidad:'yo',sociedades:'no',historicos:'no',rubro:'bienestar',dolor:'Solo quiero cumplir y no tener problemas con el SII.'}},
    {id:104,nombre:'Andrés Soto',empresa:'Taller Mecánico Sur',semaforo:'amarillo',etapa:'agendado',origen:'agenda',campana:'google · contador-pyme',resp:3,respuestas:{ventas:'5a20',trabajadores:'1a5',contabilidad:'externo',rubro:'taller'}},
    {id:105,nombre:'Fernanda Díaz',empresa:'Panadería La Espiga',semaforo:'verde',etapa:'agendado',origen:'agenda',campana:'meta · iva-a-tiempo',resp:2,respuestas:{ventas:'5a20',trabajadores:'1a5',contabilidad:'externo',rubro:'panadería'}},
    {id:106,nombre:'Rodrigo Pérez',empresa:'Importadora Austral SpA',semaforo:'rojo',etapa:'agendado',origen:'whatsapp',campana:null,resp:1,respuestas:{ventas:'mas50',trabajadores:'6a20',contabilidad:'externo',sociedades:'si',rubro:'importación'}},
    {id:107,nombre:'Daniela Vega',empresa:'Clínica Dental Sonrisa',semaforo:'amarillo',etapa:'agendado',origen:'agenda',campana:'meta · renta',resp:3,respuestas:{ventas:'20a50',trabajadores:'1a5',contabilidad:'externo',rubro:'salud'}},
    {id:108,nombre:'Ignacia Fuentes',empresa:'Estudio Pétalo',semaforo:'verde',etapa:'agendado',origen:'instagram',campana:'ig · reel',resp:1,respuestas:{ventas:'hasta5',trabajadores:'ninguno',contabilidad:'nadie',rubro:'diseño'}},
    {id:109,nombre:'Martín Reyes',empresa:'Café Origen Limitada',semaforo:'verde',etapa:'agendado',origen:'agenda',campana:null,resp:2,respuestas:{ventas:'5a20',trabajadores:'1a5',contabilidad:'externo',rubro:'cafetería'}},
    {id:110,nombre:'Sofía Herrera',empresa:'Diseño Norte',semaforo:'verde',etapa:'nuevo',origen:'whatsapp',campana:null,resp:null,respuestas:null}
  ];
  var RS=[
    {id:201,lead:101,inicio:ahoraMin(9),dur:30,estado:'confirmada'},
    {id:202,lead:102,inicio:diaHora(0,'16','30'),dur:30,estado:'confirmada'},
    {id:203,lead:103,inicio:ahoraMin(-100),dur:30,estado:'confirmada'},
    {id:204,lead:104,inicio:diaHora(-1,'16','30'),dur:30,estado:'confirmada'},
    {id:205,lead:105,inicio:diaHora(1,'11','00'),dur:30,estado:'confirmada'},
    {id:206,lead:106,inicio:diaHora(3,'15','00'),dur:30,estado:'confirmada'},
    {id:207,lead:107,inicio:diaHora(4,'10','30'),dur:30,estado:'confirmada'},
    {id:208,lead:108,inicio:diaHora(12,'12','00'),dur:30,estado:'confirmada'},
    {id:209,lead:109,inicio:diaHora(2,'09','30'),dur:30,estado:'cancelada'}
  ];
  return {L:L,RS:RS,B:[],E:[],seq:300};
}
var DB;try{DB=JSON.parse(sessionStorage.getItem(KEY)||'null');}catch(e){DB=null;}
if(!DB)DB=semilla();
function persistir(){try{sessionStorage.setItem(KEY,JSON.stringify(DB));}catch(e){}}
function clon(x){return JSON.parse(JSON.stringify(x));}
function ok(x){return new Promise(function(r){setTimeout(function(){r(clon(x));},160);});}
function err(c){return new Promise(function(_,j){setTimeout(function(){j(new Error(c));},160);});}
function lead(id){return DB.L.filter(function(l){return l.id===id;})[0];}
function res(id){return DB.RS.filter(function(r){return r.id===id;})[0];}
function bit(id){return DB.B.filter(function(b){return b.id===id;})[0];}
function fin(r){return new Date(new Date(r.inicio).getTime()+r.dur*60000).toISOString();}
function leadJ(l){return {id:l.id,nombre:l.nombre,empresa:l.empresa,semaforo:l.semaforo,etapa:l.etapa,temperatura:l.temperatura||null,origen:l.origen,campana:l.campana,
  respuestas:l.respuestas,proxima_accion:l.proxima_accion||null,proxima_fecha:l.proxima_fecha||null,responsable:l.resp?R[l.resp]:null};}
function payload(b){var l=lead(b.lead),r=b.reserva?res(b.reserva):null;
  return Object.assign({},b,{lead:leadJ(l),reserva:r?{id:r.id,inicio:r.inicio,fin:fin(r),estado:r.estado,teams:'https://teams.microsoft.com/l/meetup-join/demo'}:null,
    puede_editar:b.estado==='abierta'&&YO.escribe});}
function ev(l,tipo,det,b){DB.E.push({lead:l,tipo:tipo,detalle:det||{},b:b||null,t:new Date().toISOString(),actor:YO.nombre});}

var F={
  com_listar_hoy:function(){
    return ok({yo:YO,hoy:new Date().toLocaleDateString('en-CA',{timeZone:'America/Santiago'}),ahora:new Date().toISOString(),
      reuniones:DB.RS.map(function(r){var l=lead(r.lead),b=DB.B.filter(function(x){return x.reserva===r.id;})[0];
        return {reserva_id:r.id,inicio:r.inicio,fin:fin(r),estado:r.estado,teams:'https://teams.microsoft.com/l/meetup-join/demo',lead:leadJ(l),bitacora:b?{id:b.id,estado:b.estado,resultado:b.resultado||null}:null};}),
      sin_reserva:DB.B.filter(function(b){return b.manual;}).map(function(b){return {id:b.id,iniciada_at:b.iniciada_at,estado:b.estado,lead:leadJ(lead(b.lead))};}),
      prospectos:DB.L.map(function(l){return {id:l.id,nombre:l.nombre,empresa:l.empresa,etapa:l.etapa};})});
  },
  com_bitacora_abrir:function(a){
    var b;
    if(a.p_bitacora_id){b=bit(a.p_bitacora_id);return b?ok(payload(b)):err('NO_EXISTE');}
    if(a.p_reserva_id){var r=res(a.p_reserva_id);if(!r)return err('NO_EXISTE');b=DB.B.filter(function(x){return x.reserva===r.id;})[0];if(b)return ok(payload(b));
      if(r.estado==='cancelada')return err('RESERVA_NO_VIGENTE');
      b={id:++DB.seq,lead:r.lead,reserva:r.id,manual:false};}
    else if(a.p_lead_id){b=DB.B.filter(function(x){return x.lead===a.p_lead_id&&x.manual&&x.estado==='abierta';})[0];if(b)return ok(payload(b));b={id:++DB.seq,lead:a.p_lead_id,reserva:null,manual:true};}
    else{if(!a.p_nombre||a.p_nombre.trim().length<2)return err('NOMBRE_INVALIDO');var nl={id:++DB.seq,nombre:a.p_nombre.trim(),empresa:a.p_empresa||null,semaforo:null,etapa:'nuevo',origen:'manual',campana:null,resp:YO.id,respuestas:null};
      DB.L.push(nl);ev(nl.id,'lead_manual',{origen:'manual'});b={id:++DB.seq,lead:nl.id,reserva:null,manual:true};}
    var l=lead(b.lead);if(!l.resp){l.resp=YO.id;ev(l.id,'responsable_tomado',{responsable_id:YO.id});}
    Object.assign(b,{estado:'abierta',version:1,guion_version:a.p_guion_version,campos:{},notas:{},reloj_seg:0,iniciada_at:new Date().toISOString(),cerrada_at:null,
      resultado:null,desenlace:null,temperatura:null,proxima_accion:null,proxima_fecha:null,motivo_perdida:null,duracion_seg:null});
    DB.B.push(b);ev(l.id,'bitacora_abierta',{reserva_id:b.reserva},b.id);persistir();return ok(payload(b));
  },
  com_bitacora_guardar:function(a){
    var b=bit(a.p_id);if(!b)return err('NO_EXISTE');if(b.estado!=='abierta')return err('BITACORA_CERRADA');
    var txt=JSON.stringify(a.p_campos);if(/"[a-z0-9_]*(clave|password|contrasena|previred|api_?key|token)[a-z0-9_]*"\s*:/.test(txt)||/(clave|contrase(n|ñ)a|password|pwd|token)[^:=\n]{0,25}[:=]\s*(?=\S*\d)\S{6,}|eyJ[\w-]{8,}\.[\w-]{8,}/i.test(txt+JSON.stringify(a.p_notas)))return err('CLAVE_PROHIBIDA');
    if(JSON.stringify(b.campos)===txt&&JSON.stringify(b.notas)===JSON.stringify(a.p_notas)&&b.reloj_seg===a.p_reloj_seg)return ok({id:b.id,version:b.version,sin_cambios:true});
    if(a.p_version!==b.version)return err('VERSION_CONFLICTO');
    b.campos=clon(a.p_campos);b.notas=clon(a.p_notas);b.reloj_seg=a.p_reloj_seg;b.version++;persistir();return ok({id:b.id,version:b.version,sin_cambios:false});
  },
  com_bitacora_cerrar:function(a){
    var b=bit(a.p_id);if(!b)return err('NO_EXISTE');if(b.estado!=='abierta')return err('BITACORA_CERRADA');
    if(a.p_resultado==='realizada'&&!a.p_temperatura)return err('FALTA_TEMPERATURA');
    if(a.p_desenlace==='perdido'&&!a.p_motivo_perdida)return err('FALTA_MOTIVO_PERDIDA');
    if(a.p_desenlace!=='perdido'&&(!a.p_proxima_accion||!a.p_proxima_fecha))return err('FALTA_PROXIMO_PASO');
    var l=lead(b.lead),antes=l.etapa;
    Object.assign(b,{campos:clon(a.p_campos),notas:clon(a.p_notas),reloj_seg:a.p_reloj_seg,duracion_seg:a.p_reloj_seg,estado:'cerrada',resultado:a.p_resultado,desenlace:a.p_desenlace,
      temperatura:a.p_temperatura,proxima_accion:a.p_proxima_accion,proxima_fecha:a.p_proxima_fecha,motivo_perdida:a.p_motivo_perdida,cerrada_at:new Date().toISOString(),version:b.version+1});
    var rr=b.reserva?res(b.reserva):null;if(rr&&rr.estado==='confirmada'){rr.estado=a.p_resultado==='no_asistio'?'no_asistio':'realizada';ev(l.id,'reserva',{estado:rr.estado},b.id);}
    l.etapa=a.p_desenlace==='perdido'?'descartado':a.p_resultado==='no_asistio'?'no_asistio':'reunion_realizada';l.temperatura=a.p_temperatura||l.temperatura;
    l.proxima_accion=a.p_proxima_accion;l.proxima_fecha=a.p_proxima_fecha;
    ev(l.id,'bitacora_cerrada',{resultado:a.p_resultado,temperatura:a.p_temperatura,duracion_seg:a.p_reloj_seg},b.id);
    if(antes!==l.etapa)ev(l.id,'etapa',{de:antes,a:l.etapa},b.id);
    if(a.p_desenlace==='perdido')ev(l.id,'perdido',{motivo:a.p_motivo_perdida},b.id);
    persistir();return ok(Object.assign(payload(b),{ya_cerrada:false}));
  },
  com_linea_tiempo:function(a){
    var l=lead(a.p_lead_id);if(!l)return err('NO_EXISTE');
    var out=[{t:new Date(Date.now()-3*864e5).toISOString(),tipo:'origen',origen:l.origen,campana:l.campana,formulario:!!l.respuestas,consentimiento:true}];
    DB.RS.filter(function(r){return r.lead===l.id;}).forEach(function(r){out.push({t:new Date(Date.now()-3*864e5+60000).toISOString(),tipo:'reserva_agendada',inicio:r.inicio,estado:r.estado});
      out.push({t:new Date(Date.now()-3*864e5+120000).toISOString(),tipo:'correo_agenda',paso:'confirmacion'});out.push({t:new Date(Date.now()-864e5).toISOString(),tipo:'correo_agenda',paso:'rec24'});});
    DB.E.filter(function(e){return e.lead===l.id;}).forEach(function(e){out.push({t:e.t,tipo:e.tipo,detalle:e.detalle,actor:e.actor});});
    out.sort(function(x,y){return new Date(y.t)-new Date(x.t);});return ok(out);
  }
};
window.ComDemo={rpc:function(fn,a){return F[fn]?F[fn](a||{}):err('NO_EXISTE');},reiniciar:function(){sessionStorage.removeItem(KEY);location.reload();}};
})();
