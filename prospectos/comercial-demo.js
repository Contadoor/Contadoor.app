/* ============================================================
   prospectos/comercial-demo.js — MODO DEMOSTRACIÓN de Reuniones y Bitácora (datos 100 % ficticios)
   Candado 2 de 3: solo se define en localhost / 127.0.0.1 / [::1]. No se conecta a Supabase; nada se guarda
   (vive en memoria y en sessionStorage de esta pestaña). Personas y empresas inventadas; sin RUT; correos solo @ejemplo.test (dominio reservado, no existe). Teléfonos 100 % ficticios (12345678 y variantes) solo para probar el botón WhatsApp.
   Reproduce las reglas de las RPC com_* (visibilidad, versión, cierre) para probar la pantalla sin base de datos.
   ============================================================ */
(function(){
'use strict';
var h=location.hostname;if(!(h==='localhost'||h==='127.0.0.1'||h==='[::1]'))return;
var KEY='gestoor.com.demo.v3';   // v3 (COM-SIMPLE-1): + correos ficticios, situación, plan y 3 prospectos cerrados
// Teléfonos ficticios por prospecto (formatos que debe aceptar o rechazar el botón WhatsApp).
var TEL={101:'+56 9 1234 5678',102:'912345678',103:'12345678',104:'',105:'abc',106:'(9) 1234-5678',107:'+56 9 8765 4321',108:'987654321',109:'+56 9 1111 2222',110:'922223333'};
function ahoraMin(m){var d=new Date();d.setSeconds(0,0);return new Date(d.getTime()+m*60000).toISOString();}
function diaHora(dias,hh,mm){var t=new Date(Date.now()+dias*864e5);var y=t.toLocaleDateString('en-CA',{timeZone:'America/Santiago'});return new Date(y+'T'+hh+':'+mm+':00-03:00').toISOString();}
var YO={id:1,nombre:'Usuario Demo',master:true,escribe:true};
var R={1:{id:1,nombre:'Usuario Demo'},2:{id:2,nombre:'Paula Demo'},3:{id:3,nombre:'Tomás Demo'}};
function semilla(){
  var L=[
    {id:101,nombre:'Camila Rojas',empresa:'Ferretería Los Aromos SpA',semaforo:'amarillo',etapa:'agendado',origen:'agenda',campana:'meta · iva-a-tiempo',resp:1,email:'camila@ejemplo.test',
     respuestas:{ventas:'5a20',trabajadores:'1a5',contabilidad:'externo',sociedades:'no',historicos:'si',rubro:'ferretería',dolor:'Mi contador me avisa el IVA el mismo día y nunca sé cuánto voy a pagar.'}},
    {id:102,nombre:'Jorge Castillo',empresa:'Transportes Cordillera Ltda.',semaforo:'rojo',etapa:'agendado',origen:'whatsapp',campana:null,resp:2,
     respuestas:{ventas:'20a50',trabajadores:'6a20',contabilidad:'interno',sociedades:'si',historicos:'no',rubro:'transporte de carga',dolor:'Tengo dos sociedades y no sé cuál conviene.'}},
    {id:103,nombre:'Valeria Muñoz',empresa:'Estudio de Yoga Prana',semaforo:'verde',etapa:'agendado',origen:'instagram',campana:'ig · historias',resp:null,
     respuestas:{ventas:'hasta5',trabajadores:'ninguno',contabilidad:'yo',sociedades:'no',historicos:'no',rubro:'bienestar',dolor:'Solo quiero cumplir y no tener problemas con el SII.'}},
    {id:104,nombre:'Andrés Soto',empresa:'Taller Mecánico Sur',semaforo:'amarillo',etapa:'descartado',motivo:'no_responde',   // COM-SIMPLE-1 R2: Perdido con reunión pasada sin cerrar (aviso visible)
     origen:'agenda',campana:'google · contador-pyme',resp:3,respuestas:{ventas:'5a20',trabajadores:'1a5',contabilidad:'externo',rubro:'taller'}},
    {id:105,nombre:'Fernanda Díaz',empresa:'Panadería La Espiga',semaforo:'verde',etapa:'agendado',origen:'agenda',campana:'meta · iva-a-tiempo',resp:2,respuestas:{ventas:'5a20',trabajadores:'1a5',contabilidad:'externo',rubro:'panadería'}},
    {id:106,nombre:'Rodrigo Pérez',empresa:'Importadora Austral SpA',semaforo:'rojo',etapa:'agendado',origen:'whatsapp',campana:null,resp:1,respuestas:{ventas:'mas50',trabajadores:'6a20',contabilidad:'externo',sociedades:'si',rubro:'importación'}},
    {id:107,nombre:'Daniela Vega',empresa:'Clínica Dental Sonrisa',semaforo:'amarillo',etapa:'agendado',origen:'agenda',campana:'meta · renta',resp:3,respuestas:{ventas:'20a50',trabajadores:'1a5',contabilidad:'externo',rubro:'salud'}},
    {id:108,nombre:'Ignacia Fuentes',empresa:'Estudio Pétalo',semaforo:'verde',etapa:'agendado',origen:'instagram',campana:'ig · reel',resp:1,respuestas:{ventas:'hasta5',trabajadores:'ninguno',contabilidad:'nadie',rubro:'diseño'}},
    {id:109,nombre:'Martín Reyes',empresa:'Café Origen Limitada',semaforo:'verde',etapa:'agendado',origen:'agenda',campana:null,resp:2,respuestas:{ventas:'5a20',trabajadores:'1a5',contabilidad:'externo',rubro:'cafetería'}},
    {id:110,nombre:'Sofía Herrera',empresa:'Diseño Norte',semaforo:'verde',etapa:'nuevo',origen:'whatsapp',campana:null,resp:null,respuestas:null},
    // COM-SIMPLE-1: prospectos ya avanzados (propuesta, ganado, perdido) para los filtros de Prospectos simple
    {id:111,nombre:'Andrea Soto',empresa:'Estudio Soto Diseño',semaforo:'verde',etapa:'propuesta',origen:'agenda',campana:'meta · renta',resp:1,email:'andrea@ejemplo.test',plan:'pro',
     obs:'Su contador no le responde. Tiene 2 F29 atrasados y quiere saber cuánto pagará de renta.',respuestas:{ventas:'5a20',rubro:'diseño',dolor:'No sé cuánto voy a pagar de renta.'}},
    {id:112,nombre:'Felipe Lagos',empresa:'Lagos Importaciones',semaforo:'verde',etapa:'cliente',origen:'agenda',campana:'google · contador-pyme',resp:2,email:'felipe@ejemplo.test',plan:'pro',obs:'Empresa nueva, necesita partir ordenado.',respuestas:{rubro:'importación'}},
    {id:113,nombre:'Marta Díaz',empresa:'Almacén Doña Marta',semaforo:'amarillo',etapa:'descartado',origen:'instagram',campana:'ig · reel',resp:1,motivo:'precio',obs:'Buscaba solo precio, se quedó con su contador.',respuestas:{rubro:'almacén'}}
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
    {id:209,lead:109,inicio:diaHora(2,'09','30'),dur:30,estado:'cancelada'},
    {id:211,lead:111,inicio:diaHora(-6,'10','00'),dur:30,estado:'realizada'},
    {id:212,lead:112,inicio:diaHora(-8,'12','00'),dur:30,estado:'realizada'},
    {id:213,lead:113,inicio:diaHora(-10,'09','00'),dur:30,estado:'realizada'}
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
  detalle_prospecto:function(a){var l=lead(a.p_id);if(!l)return err('NO_EXISTE');return ok({id:l.id,nombre:l.nombre,empresa:l.empresa,tel:TEL[l.id]!==undefined?TEL[l.id]:null});},
  com_linea_tiempo:function(a){
    var l=lead(a.p_lead_id);if(!l)return err('NO_EXISTE');
    var out=[{t:new Date(Date.now()-3*864e5).toISOString(),tipo:'origen',origen:l.origen,campana:l.campana,formulario:!!l.respuestas,consentimiento:true}];
    DB.RS.filter(function(r){return r.lead===l.id;}).forEach(function(r){out.push({t:new Date(Date.now()-3*864e5+60000).toISOString(),tipo:'reserva_agendada',inicio:r.inicio,estado:r.estado});
      out.push({t:new Date(Date.now()-3*864e5+120000).toISOString(),tipo:'correo_agenda',paso:'confirmacion'});out.push({t:new Date(Date.now()-864e5).toISOString(),tipo:'correo_agenda',paso:'rec24'});});
    DB.E.filter(function(e){return e.lead===l.id;}).forEach(function(e){out.push({t:e.t,tipo:e.tipo,detalle:e.detalle,actor:e.actor});});
    out.sort(function(x,y){return new Date(y.t)-new Date(x.t);});return ok(out);
  }
};

// ── COM-SIMPLE-1 · Prospectos simple (mismas reglas que com_simple_listar / com_cierre_rapido / com_ficha_guardar) ──
var MOT_OK=['precio','eligio_otro','no_responde','no_calza','lo_hara_solo','otro'], PLAN_OK=['cumplimiento','pro','estrategico'];
function creado(l){return l.creado||(l.creado=new Date(Date.now()-(l.id-100)*36e5*7).toISOString());}
function actualizado(l){return l.actualizado||(l.actualizado=creado(l));}
function itemS(l){
  var rs=DB.RS.filter(function(r){return r.lead===l.id;}).sort(function(a,b){return new Date(b.inicio)-new Date(a.inicio);})[0];
  var b=rs?DB.B.filter(function(x){return x.reserva===rs.id;})[0]:null, bm=DB.B.filter(function(x){return x.lead===l.id&&x.manual&&x.estado==='abierta';})[0];
  return {id:l.id,nombre:l.nombre,empresa:l.empresa,email:l.email||null,tel:TEL[l.id]!==undefined?TEL[l.id]:null,etapa:l.etapa,semaforo:l.semaforo,
    situacion:l.obs||null,dolor:l.respuestas&&l.respuestas.dolor||null,plan:l.plan||null,motivo_perdida:l.motivo||null,proxima_fecha:l.proxima_fecha||null,
    proxima_accion:l.proxima_accion||null,creado:creado(l),actualizado:actualizado(l),origen:l.origen,campana:l.campana,responsable:l.resp?R[l.resp]:null,
    reunion:rs?{id:rs.id,inicio:rs.inicio,fin:fin(rs),estado:rs.estado,teams:'https://teams.microsoft.com/l/meetup-join/demo',bitacora:b?{id:b.id,estado:b.estado}:null}:null,
    bitacora_manual:bm?bm.id:null};
}
function tocar(l){l.actualizado=new Date().toISOString();}
function cerrarReserva(rid,res){
  var r=res?null:null;r=DB.RS.filter(function(x){return x.id===rid;})[0];if(!r)return 'NO_EXISTE';
  if(['realizada','no_asistio'].indexOf(res)<0)return 'RESULTADO_INVALIDO';
  var l=lead(r.lead),b=DB.B.filter(function(x){return x.reserva===r.id&&x.estado==='abierta';})[0];
  if(new Date(r.inicio).getTime()>Date.now())return 'RESERVA_FUTURA';
  if(new Date(fin(r)).getTime()>=Date.now())return 'RESERVA_NO_TERMINADA';
  if(r.estado==='cancelada'||r.estado==='inconsistente')return 'RESERVA_NO_VIGENTE';
  if(r.estado!=='confirmada'&&r.estado!==res)return 'RESERVA_YA_CERRADA';
  var antes=l.etapa;
  if(r.estado===res&&!b)return {ya_cerrada:true,lead:l,antes:antes};
  if(!l.resp){l.resp=YO.id;ev(l.id,'responsable_tomado',{responsable_id:YO.id,origen:'simple'});}
  if(r.estado==='confirmada'){r.estado=res;ev(l.id,'reserva',{reserva_id:r.id,estado:res,origen:'simple'},b?b.id:null);}
  if(b){Object.assign(b,{estado:'cerrada',resultado:res,desenlace:'seguimiento',duracion_seg:b.reloj_seg,cerrada_at:new Date().toISOString(),version:b.version+1});
    ev(l.id,'bitacora_cerrada',{resultado:res,desenlace:'seguimiento',origen:'simple'},b.id);}
  var e=l.etapa||'nuevo',n=res==='realizada'?(['nuevo','agendado','no_asistio','no_calificado','emprendedor_solicitado','descartado'].indexOf(e)>=0?'reunion_realizada':e)
    :(['nuevo','agendado','no_calificado','descartado'].indexOf(e)>=0?'no_asistio':e);
  if(n!==l.etapa){if(l.etapa==='descartado')l.motivo=null;ev(l.id,'etapa',{de:l.etapa,a:n,origen:'simple'},b?b.id:null);l.etapa=n;}
  tocar(l);return {ya_cerrada:false,lead:l,bitacora:b,antes:antes};
}
F.com_simple_listar=function(){
  var ahora=Date.now();
  return ok({yo:{id:YO.id,nombre:YO.nombre,alcance_comercial_total:true,escribe:YO.escribe},ahora:new Date().toISOString(),
    pendientes:DB.RS.filter(function(r){var b=DB.B.filter(function(x){return x.reserva===r.id;})[0];
        return new Date(fin(r)).getTime()<ahora&&(r.estado==='confirmada'||((r.estado==='realizada'||r.estado==='no_asistio')&&b&&b.estado==='abierta'));})
      .sort(function(a,b){return new Date(b.inicio)-new Date(a.inicio);})
      .map(function(r){var l=lead(r.lead),b=DB.B.filter(function(x){return x.reserva===r.id;})[0];
        return {reserva_id:r.id,inicio:r.inicio,fin:fin(r),estado:r.estado,lead_id:l.id,nombre:l.nombre,empresa:l.empresa,responsable:l.resp?R[l.resp]:null,bitacora:b?{id:b.id,estado:b.estado}:null};}),
    prospectos:DB.L.slice().sort(function(a,b){return new Date(creado(b))-new Date(creado(a));}).map(itemS)});
};
F.com_cierre_rapido=function(a){
  var x=cerrarReserva(Number(a.p_reserva_id),a.p_resultado);if(typeof x==='string')return err(x);
  persistir();var r=DB.RS.filter(function(y){return y.id===Number(a.p_reserva_id);})[0];
  return ok({reserva_id:r.id,reserva_estado:r.estado,lead_id:x.lead.id,etapa:x.lead.etapa,etapa_antes:x.antes,bitacora_id:x.bitacora?x.bitacora.id:null,ya_cerrada:x.ya_cerrada,prospecto:itemS(x.lead)});
};
F.com_ficha_guardar=function(a){
  var l=lead(Number(a.p_id));if(!l)return err('NO_EXISTE');
  var et=a.p_etapa,sit=String(a.p_situacion||'').trim()||null,plan=a.p_plan||null,mot=et==='descartado'?(a.p_motivo_perdida||null):null;
  if(['nuevo','agendado','reunion_realizada','no_asistio','propuesta','seguimiento','cliente','emprendedor_solicitado','no_calificado','descartado'].indexOf(et)<0)return err('ETAPA_INVALIDA');
  if(plan&&PLAN_OK.indexOf(plan)<0)return err('PLAN_INVALIDO');if(mot&&MOT_OK.indexOf(mot)<0)return err('MOTIVO_INVALIDO');
  if(sit&&sit.length>4000)return err('SITUACION_MUY_LARGA');
  if(sit&&/(clave|contrase(n|ñ)a|password|pwd|token)[^:=\n]{0,25}[:=]\s*(?=\S*\d)\S{6,}/i.test(sit))return err('CLAVE_PROHIBIDA');
  if(!a.p_actualizado)return err('FALTA_VERSION');
  if(a.p_actualizado!==actualizado(l))return err('VERSION_CONFLICTO');
  var hoy=new Date().toLocaleDateString('en-CA',{timeZone:'America/Santiago'});
  if(a.p_proxima_fecha&&a.p_proxima_fecha!==l.proxima_fecha&&a.p_proxima_fecha<hoy)return err('FECHA_INVALIDA');
  if((et==='reunion_realizada'||et==='no_asistio')&&et!==l.etapa){
    var r=DB.RS.filter(function(x){return x.lead===l.id&&x.estado==='confirmada'&&new Date(fin(x)).getTime()<Date.now();})[0];
    if(r)cerrarReserva(r.id,et==='no_asistio'?'no_asistio':'realizada');
  }
  if(!l.resp){l.resp=YO.id;ev(l.id,'responsable_tomado',{responsable_id:YO.id,origen:'simple'});}
  var antes=l.etapa,mAntes=l.motivo;
  Object.assign(l,{etapa:et,obs:sit,plan:plan,proxima_fecha:a.p_proxima_fecha||null,motivo:mot});
  if(et!==antes)ev(l.id,'etapa',{de:antes,a:et,origen:'simple'});
  if(et==='descartado'&&(antes!=='descartado'||mot!==mAntes))ev(l.id,'perdido',{motivo:mot,origen:'simple'});
  tocar(l);persistir();return ok(itemS(l));
};
window.ComDemo={rpc:function(fn,a){return F[fn]?F[fn](a||{}):err('NO_EXISTE');},reiniciar:function(){sessionStorage.removeItem(KEY);location.reload();}};
})();
