/* ============================================================
   trabajos-especiales/te-demo.js — MODO DEMOSTRACIÓN de Trabajos especiales (datos 100 % ficticios)
   Candado 2 de 3: solo se define en localhost / 127.0.0.1 / [::1]. No se conecta a Supabase ni a Storage; nada se guarda.
   Empresas y personas inventadas; sin RUT, correos ni teléfonos reales.
   ============================================================ */
(function(){
'use strict';
var h=location.hostname;if(!(h==='localhost'||h==='127.0.0.1'||h==='[::1]'))return;
var G=window.GC, HOY=G.hoyCL();
function addD(iso,n){var d=new Date(iso+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
function ts(n){return addD(HOY,n)+'T14:00:00Z';}
function err(cod){var e=new Error(cod);e.srv={code:'P0001',message:cod,status:400};return Promise.reject(e);}
function ok(x){return new Promise(function(r){setTimeout(function(){r(x===undefined?null:JSON.parse(JSON.stringify(x)));},160);});}
var MIGUEL=7, OTRA=8;
var ROL='responsable';
var ROLES={
  master:{usuario_id:1,nombre:'Master (demo)',es_master:true,responsable:true,facturador:false,pagos:true,puede_leer:true},
  responsable:{usuario_id:MIGUEL,nombre:'Responsable (demo)',es_master:false,responsable:true,facturador:false,pagos:false,puede_leer:true},
  facturacion:{usuario_id:9,nombre:'Facturación (demo)',es_master:false,responsable:false,facturador:true,pagos:false,puede_leer:true},
  pagos:{usuario_id:10,nombre:'Pagos (demo)',es_master:false,responsable:false,facturador:true,pagos:true,puede_leer:true},
  cobranza:{usuario_id:2,nombre:'Cobranza (demo)',es_master:false,responsable:false,facturador:false,pagos:false,puede_leer:false}
};
var USU={7:'Responsable Demo',8:'Otra Analista Demo',1:'Master Demo'};
var SRV=[
  {id:'srv-demo-constitucion',nombre:'Constitución de SpA',descripcion:'Escritura, inscripción y obtención de RUT e inicio de actividades',precio:180000,precio_hasta:null,moneda:'CLP',tipo:'puntual'},
  {id:'srv-demo-modificacion',nombre:'Modificación de sociedad',descripcion:'Cambio de socios, capital o giro',precio:120000,precio_hasta:200000,moneda:'CLP',tipo:'puntual'},
  {id:'srv-demo-formalizacion',nombre:'Formalización de emprendimiento',descripcion:'Inicio de actividades y orientación tributaria',precio:90000,precio_hasta:null,moneda:'CLP',tipo:'puntual'},
  {id:'srv-demo-proyecto',nombre:'Proyecto especial por propuesta',descripcion:'Valor según alcance',precio:null,precio_hasta:null,moneda:'CLP',tipo:'por_propuesta'}];
var CLIS=[{id:201,razon_social:'Panadería Trigo Dorado SpA'},{id:202,razon_social:'Imprenta Tinta Viva Ltda.'},{id:203,razon_social:'Viñedos Cerro Alto SpA'}];
var PLANT=[['Recopilar antecedentes de socios',3,true,'Cédulas y antecedentes',true,false],['Redactar y revisar escritura',5,true,'Borrador de escritura',true,false],
  ['Firma ante notario',7,false,null,true,false],['Inscripción y obtención de RUT',10,true,'Certificado de RUT',true,false],['Entrega de carpeta al cliente',2,false,null,true,true]];
var T=[], tid=0, pid=0, did=0, cid=0, fid=0, eid=0, corr=40;
function nuevo(o){
  var s=SRV.find(function(x){return x.id===o.servicio_id;});
  var t=Object.assign({id:++tid,codigo:'TE-2026-'+String(++corr).padStart(3,'0'),cliente_id:null,prospecto_nombre:null,servicio_id:null,servicio_solicitado:null,
    descripcion_que:'Constituir la sociedad y dejarla operativa',descripcion_alcance:'Escritura, inscripción, RUT e inicio de actividades',descripcion_antecedentes:null,
    condicion_pago:'CONTADO',n_cuotas:1,valor_catalogo:s&&s.tipo==='puntual'&&!s.precio_hasta?s.precio:null,valor_base:null,descuento_pct:null,valor:null,responsable_usuario_id:MIGUEL,
    etapa:'BORRADOR',etapa_desde:ts(-1),estatus:'EN_CURSO',estatus_motivo:null,huella_revision:null,devolucion_comentario:null,vigencia_hasta:null,enviado_at:null,aceptado_at:null,
    aceptacion_medio:null,iniciado_at:null,inicio_autorizado_motivo:null,retener_entrega:false,entrega_estado:'PENDIENTE',terminado_at:null,cerrado_at:null,cierre_tipo:null,cierre_motivo:null,
    cierre_detalle:null,rechazo_motivo:null,creado_at:ts(-10),_cuotas:[],_fact:[],_pasos:[],_docs:[],_ev:[],_tareas:[],_fa:[]},o);
  ev(t,'BORRADOR_CREADO',-10);T.push(t);return t;
}
function ev(t,tipo,d){t._ev.unshift({id:++eid,tipo:tipo,actor:'usuario',creado_at:d==null?new Date().toISOString():ts(d)});}
function srvDe(t){return SRV.find(function(s){return s.id===t.servicio_id;});}
function aprobar(t,valor){t.valor=valor;t.valor_base=valor;t.huella_revision=null;t.etapa='APROBADA';ev(t,'COTIZACION_APROBADA',-6);}
function montos(v,c,n){if(c==='CONTADO')return [v];if(c==='CINCUENTA'){var b=Math.round(v/2);return [b,v-b];}var q=Math.floor(v/n),a=[];for(var i=1;i<n;i++)a.push(q);a.push(v-q*(n-1));return a;}
function aceptar(t,d){t.etapa='ACEPTADA';t.aceptado_at=ts(d);t.aceptacion_medio='CORREO';
  montos(t.valor,t.condicion_pago,t.n_cuotas).forEach(function(m,i){t._cuotas.push({id:++cid,n:i+1,cuotas_total:t.n_cuotas,es_inicio:i===0,monto:m,fecha_vencimiento:t.condicion_pago==='CINCUENTA'&&i===1?null:addD(HOY,d+5+30*i),estado:'PENDIENTE',pagada_fecha:null,pago_referencia:null});});
  t._fact.push({id:++fid,modo:'PRUEBA',tipo_dte:34,estado:'PENDIENTE',total:t.valor,snapshot_hash:null,of_folio:null,fecha_emision_dte:null,devolucion:null,creado_at:ts(d)});ev(t,'COTIZACION_ACEPTADA',d);}
var faid=0;
function faNueva(t,estado){var fa={factura_id:++faid,codigo:'FA-2026-'+String(20+faid).padStart(4,'0'),estado:estado,modo:'PRUEBA',total:t.valor,folio:null,creado_at:ts(-3),espejo:null};t._fa.unshift(fa);ev(t,'FACTURA_ADICIONAL_CREADA',-4);return fa;}
function emitir(t){var fa=faNueva(t,'EMITIDA');fa.folio=String(7000+t.id);fa.espejo='OK';var f=t._fact[0];f.estado='EMITIDA';f.of_folio=fa.folio;f.fecha_emision_dte=addD(HOY,-3);t.etapa='FACTURADA';ev(t,'FACTURA_EMITIDA',-3);}
function pagar(t,n,d){var c=t._cuotas[n-1];c.estado='PAGADA';c.pagada_fecha=addD(HOY,d);c.pago_referencia='cobranza_pagos:demo';ev(t,'CUOTA_PAGADA',d);}
function iniciar(t){t.etapa='EN_EJECUCION';t.iniciado_at=ts(-2);PLANT.forEach(function(p,i){t._pasos.push({id:++pid,orden:(i+1)*10,origen:'PLANTILLA',nombre:p[0],plazo_dias:p[1],requiere_documento:p[2],tipo_documento:p[3],obligatorio:p[4],es_entrega:p[5],avisa_cliente:i===3,estado:'PENDIENTE',hecho_at:null,saltado_motivo:null});});ev(t,'TRABAJO_INICIADO',-2);}
function hecho(t,i){var p=t._pasos[i];if(p.requiere_documento)t._docs.push({id:++did,paso_id:p.id,tipo:'PASO',storage_path:t.id+'/paso-'+p.id+'/demo-'+did+'.pdf',nombre:'documento-ficticio-'+did+'.pdf',mime:'application/pdf',bytes:1000,vigente:true,subido_at:ts(-1)});p.estado='HECHO';p.hecho_at=ts(-1);}

var a=nuevo({prospecto_nombre:'Emprendimiento Huerto Urbano',servicio_id:'srv-demo-formalizacion'});
var b=nuevo({cliente_id:201,servicio_id:'srv-demo-modificacion',condicion_pago:'CUOTAS',n_cuotas:3,etapa:'EN_APROBACION',huella_revision:'demo'});ev(b,'ENVIADA_A_APROBACION',-1);
var c=nuevo({prospecto_nombre:'Estudio de Yoga Respira',servicio_id:'srv-demo-constitucion',condicion_pago:'CINCUENTA',n_cuotas:2});aprobar(c,180000);c.etapa='ENVIADA';c.enviado_at=ts(-3);c.vigencia_hasta=addD(HOY,12);ev(c,'COTIZACION_ENVIADA',-3);
var d=nuevo({prospecto_nombre:'Cervecería Lúpulo Sur',servicio_id:'srv-demo-formalizacion'});aprobar(d,90000);d.etapa='ENVIADA';d.enviado_at=ts(-20);d.vigencia_hasta=addD(HOY,-5);
var e=nuevo({cliente_id:202,servicio_id:'srv-demo-constitucion',condicion_pago:'CINCUENTA',n_cuotas:2});aprobar(e,180000);e.enviado_at=ts(-8);e.vigencia_hasta=addD(HOY,7);aceptar(e,-2);
var f=nuevo({cliente_id:203,servicio_id:'srv-demo-constitucion'});aprobar(f,180000);f.enviado_at=ts(-12);f.vigencia_hasta=addD(HOY,3);aceptar(f,-7);emitir(f);
var g=nuevo({cliente_id:201,servicio_id:'srv-demo-constitucion',condicion_pago:'CINCUENTA',n_cuotas:2,responsable_usuario_id:MIGUEL});aprobar(g,180000);g.enviado_at=ts(-25);g.vigencia_hasta=addD(HOY,-10);aceptar(g,-20);emitir(g);pagar(g,1,-15);iniciar(g);hecho(g,0);hecho(g,1);
var i2=nuevo({prospecto_nombre:'Agencia Viajes Mundo Claro',servicio_id:'srv-demo-modificacion',responsable_usuario_id:OTRA,estatus:'EN_ESPERA',estatus_motivo:'Esperando antecedentes de un socio'});aprobar(i2,150000);i2.enviado_at=ts(-30);i2.vigencia_hasta=addD(HOY,-15);aceptar(i2,-28);emitir(i2);pagar(i2,1,-25);iniciar(i2);hecho(i2,0);
var j=nuevo({cliente_id:202,servicio_id:'srv-demo-formalizacion',condicion_pago:'CINCUENTA',n_cuotas:2,retener_entrega:true});aprobar(j,90000);j.enviado_at=ts(-40);j.vigencia_hasta=addD(HOY,-25);aceptar(j,-38);emitir(j);pagar(j,1,-35);iniciar(j);[0,1,2,3].forEach(function(k){hecho(j,k);});j.etapa='TERMINADO';j.terminado_at=ts(-1);j.entrega_estado='RETENIDA';j._cuotas[1].fecha_vencimiento=addD(HOY,-1);
var m=nuevo({cliente_id:203,servicio_id:'srv-demo-modificacion',condicion_pago:'CUOTAS',n_cuotas:3});aprobar(m,150000);m.enviado_at=ts(-6);m.vigencia_hasta=addD(HOY,9);aceptar(m,-3);faNueva(m,'EN_REVISION');
var pz=nuevo({prospecto_nombre:'Florería Pétalo Azul',servicio_id:'srv-demo-formalizacion'});aprobar(pz,90000);pz.enviado_at=ts(-5);pz.vigencia_hasta=addD(HOY,10);aceptar(pz,-1);
var k=nuevo({cliente_id:203,servicio_id:'srv-demo-formalizacion'});aprobar(k,90000);aceptar(k,-60);emitir(k);pagar(k,1,-55);iniciar(k);[0,1,2,3,4].forEach(function(x){hecho(k,x);});k.etapa='TERMINADO';k.entrega_estado='ENTREGADO';k.cerrado_at=ts(-30);k.cierre_tipo='COMPLETO';k.cierre_motivo='COMPLETO';

function saldo(t){return t._cuotas.filter(function(c){return c.estado==='PENDIENTE';}).reduce(function(s,c){return s+c.monto;},0);}
function avance(t){var p=t._pasos.filter(function(x){return x.estado!=='QUITADO';});return p.length?Math.round(100*p.filter(function(x){return x.estado==='HECHO'||x.estado==='SALTADO';}).length/p.length):null;}
function visible(t){var r=ROLES[ROL];return r.es_master||r.pagos||r.facturador||(r.responsable&&t.responsable_usuario_id===r.usuario_id);}
function fila(t){
  var s=srvDe(t),fa=t._fact.find(function(x){return x.estado!=='ANULADA';}),ini=t._cuotas.find(function(c){return c.es_inicio;}),cl=CLIS.find(function(x){return x.id===t.cliente_id;});
  return {id:t.id,codigo:t.codigo,cliente_id:t.cliente_id,cliente_nombre:cl?cl.razon_social:t.prospecto_nombre,es_prospecto:!t.cliente_id,servicio_id:t.servicio_id,servicio_nombre:s?s.nombre:t.servicio_solicitado,
    servicio_solicitado:t.servicio_solicitado,responsable_usuario_id:t.responsable_usuario_id,etapa:t.etapa,etapa_desde:t.etapa_desde,estatus:t.estatus,estatus_motivo:t.estatus_motivo,condicion_pago:t.condicion_pago,
    n_cuotas:t.n_cuotas,valor:t.valor,valor_catalogo:t.valor_catalogo,avance:avance(t),saldo:saldo(t),factura_estado:fa?fa.estado:null,factura_folio:fa?fa.of_folio:null,pago_inicio_estado:ini?ini.estado:null,
    cuotas_vencidas:t._cuotas.filter(function(c){return c.estado==='PENDIENTE'&&c.fecha_vencimiento&&c.fecha_vencimiento<HOY;}).length,alerta_aceptado_sin_facturar:t.etapa==='ACEPTADA',
    alerta_ejecucion_sin_pago_inicio:(t.etapa==='EN_EJECUCION'||t.etapa==='TERMINADO')&&ini&&ini.estado==='PENDIENTE',alerta_terminado_con_saldo:t.etapa==='TERMINADO'&&saldo(t)>0,
    cotizacion_vencida:t.etapa==='ENVIADA'&&t.vigencia_hasta<HOY,retener_entrega:t.retener_entrega,vigencia_hasta:t.vigencia_hasta,cerrado_at:t.cerrado_at,cierre_tipo:t.cierre_tipo,cierre_motivo:t.cierre_motivo};
}
function tr(id){return T.find(function(x){return x.id===Number(id);});}
function editor(t){var r=ROLES[ROL];if(r.es_master)return null;if(!(r.responsable&&t.responsable_usuario_id===r.usuario_id))return err('SOLO_RESPONSABLE');return null;}
function abierto(t){if(!t)return err('TRABAJO_NO_EXISTE');if(t.cerrado_at)return err('TRABAJO_CERRADO');return null;}
function master(){return ROLES[ROL].es_master?null:err('SOLO_MASTER');}
function etapa(t,e){t.etapa=e;t.etapa_desde=new Date().toISOString();}

function fmt(n){return '$'+String(n).replace(/\B(?=(\d{3})+(?!\d))/g,'.');}
function faViva(t){return t._fa.find(function(v){return v.estado!=='ANULADA';});}
function prellenado(t){var f=t._fact.find(function(x){return x.estado!=='ANULADA';}),fp=t.condicion_pago==='CONTADO'?1:2,ult=null,nulos=false;
  t._cuotas.forEach(function(c){if(!c.fecha_vencimiento)nulos=true;else if(!ult||c.fecha_vencimiento>ult)ult=c.fecha_vencimiento;});
  var tope=addD(HOY,90),fv=fp===1?null:(nulos||!ult||ult>tope)?tope:(ult>addD(HOY,1)?ult:addD(HOY,1));
  var cond=t.condicion_pago==='CONTADO'?'contado (100 % antes de iniciar)':t.condicion_pago==='CINCUENTA'?'50 % al inicio y 50 % al terminar':t.n_cuotas+' cuotas (la 1.ª es el inicio)';
  var plan=t._cuotas.map(function(c){return 'Cuota '+c.n+': '+fmt(c.monto)+(c.fecha_vencimiento?' vence '+c.fecha_vencimiento.split('-').reverse().join('-'):' al terminar');}).join(' · ');
  return {cliente_id:t.cliente_id,modo:f?f.modo:'PRUEBA',forma_pago:fp,fecha_emision:HOY,fecha_vencimiento:fv,
    lineas:[{glosa:(srvDe(t)||{}).nombre||'Trabajo especial',detalle:'Trabajo especial '+t.codigo+' · '+t.descripcion_que+' · Condición de pago: '+cond+' · '+plan,cantidad:1,precio:t.valor}]};}
function resumen(t){var r=ROLES[ROL],f=t._fact.find(function(x){return x.estado!=='ANULADA';}),bloq=t.cerrado_at?'TRABAJO_CERRADO':['ACEPTADA','FACTURADA','EN_EJECUCION','TERMINADO'].indexOf(t.etapa)<0?'TRABAJO_NO_ACEPTADO'
    :!f?'SIN_INSTRUCCION':f.estado==='EMITIDA'?'YA_FACTURADO':faViva(t)?'FACTURA_VINCULADA':!t.cliente_id?'PROSPECTO_SIN_FICHA':null;
  return {trabajo_id:t.id,te_factura:f?{id:f.id,estado:f.estado,modo:f.modo,total:f.total,folio:f.of_folio}:null,vinculos:t._fa,puede_crear:!bloq&&(r.es_master||r.facturador),bloqueo:bloq,prellenado:bloq?null:prellenado(t)};}
var RPC={
  te_fa_resumen:function(x){var t=tr(x.p_trabajo);if(!t||!visible(t))return err('SIN_PERMISO');return resumen(t);},
  te_fa_crear:function(x){var r=ROLES[ROL];if(!(r.es_master||r.facturador))return err('SOLO_FACTURADOR');var t=tr(x.p_trabajo),e=abierto(t);if(e)return e;var v=faViva(t);
    if(v)return {resultado:'existente',factura_id:v.factura_id,codigo:v.codigo,estado:v.estado,total:v.total};var rs=resumen(t);if(rs.bloqueo)return err(rs.bloqueo);
    var fa=faNueva(t,'BORRADOR');fa.creado_at=new Date().toISOString();t._ev[0].creado_at=fa.creado_at;return {resultado:'creada',factura_id:fa.factura_id,codigo:fa.codigo,estado:'BORRADOR',total:fa.total};},
  te_fa_espejo_reintentar:function(){return master()||{resultado:'existente'};},
  te_cotizacion_crear:function(x){var r=ROLES[ROL];if(!r.responsable)return err('SIN_MODULO');var p=x.p;
    var t=nuevo({cliente_id:p.cliente_id||null,prospecto_nombre:p.prospecto?p.prospecto.nombre:null,servicio_id:p.servicio_id||null,servicio_solicitado:p.servicio_solicitado||null,condicion_pago:p.condicion_pago,
      n_cuotas:p.condicion_pago==='CONTADO'?1:p.condicion_pago==='CINCUENTA'?2:p.n_cuotas,descripcion_que:p.que,descripcion_alcance:p.alcance,descripcion_antecedentes:p.antecedentes||null,responsable_usuario_id:r.usuario_id,creado_at:new Date().toISOString(),etapa_desde:new Date().toISOString()});
    t._ev=[];ev(t,'BORRADOR_CREADO');return {trabajo_id:t.id,codigo:t.codigo,etapa:'BORRADOR'};},
  te_cotizacion_enviar_aprobacion:function(x){var t=tr(x.p_trabajo);return abierto(t)||editor(t)||(t.etapa!=='BORRADOR'?err('NO_EN_BORRADOR'):!t.servicio_id?err('SERVICIO_NO_CREADO'):(etapa(t,'EN_APROBACION'),t.huella_revision='demo',ev(t,'ENVIADA_A_APROBACION'),{etapa:'EN_APROBACION'}));},
  te_cotizacion_aprobar:function(x){var t=tr(x.p_trabajo);var e=abierto(t)||master();if(e)return e;if(t.etapa!=='EN_APROBACION')return err('NO_EN_APROBACION');if(x.p_huella!==t.huella_revision)return err('HUELLA_NO_COINCIDE');
    var s=srvDe(t),base=s.tipo==='puntual'&&!s.precio_hasta?s.precio:x.p_valor;if(!base)return err('VALOR_OBLIGATORIO');if(s.precio_hasta&&(base<s.precio||base>s.precio_hasta))return err('VALOR_FUERA_DE_RANGO');
    t.valor_base=base;t.descuento_pct=x.p_descuento_pct;t.valor=x.p_descuento_pct?Math.round(base*(100-x.p_descuento_pct)/100):base;etapa(t,'APROBADA');ev(t,'COTIZACION_APROBADA');return {etapa:'APROBADA',valor:t.valor};},
  te_cotizacion_devolver:function(x){var t=tr(x.p_trabajo);var e=abierto(t)||master();if(e)return e;etapa(t,'BORRADOR');t.devolucion_comentario=x.p_comentario;t.huella_revision=null;ev(t,'COTIZACION_DEVUELTA');return {};},
  te_cotizacion_enviar:function(x){var t=tr(x.p_trabajo);var e=abierto(t)||editor(t);if(e)return e;if(t.etapa!=='APROBADA')return err('NO_APROBADA');etapa(t,'ENVIADA');t.enviado_at=new Date().toISOString();t.vigencia_hasta=addD(HOY,15);ev(t,'COTIZACION_ENVIADA');return {etapa:'ENVIADA',vigencia_hasta:t.vigencia_hasta};},
  te_cotizacion_renovar:function(x){var t=tr(x.p_trabajo);var e=abierto(t)||editor(t);if(e)return e;etapa(t,'BORRADOR');t.valor=null;t.vigencia_hasta=null;ev(t,'COTIZACION_RENOVADA');return {};},
  te_cotizacion_registrar_rechazo:function(x){var t=tr(x.p_trabajo);var e=abierto(t)||editor(t);if(e)return e;etapa(t,'RECHAZADA');t.rechazo_motivo=x.p_motivo;ev(t,'COTIZACION_RECHAZADA');return {};},
  te_cotizacion_registrar_aceptacion:function(x){var t=tr(x.p_trabajo);var e=abierto(t)||editor(t);if(e)return e;if(t.etapa!=='ENVIADA')return err('NO_ENVIADA');if(t.vigencia_hasta<HOY)return err('COTIZACION_VENCIDA');aceptar(t,0);t.etapa_desde=new Date().toISOString();return {etapa:'ACEPTADA'};},
  te_documento_registrar:function(x){var t=tr(x.p_trabajo);var e=abierto(t)||editor(t);if(e)return e;
    t._docs.forEach(function(dd){if(dd.vigente&&((x.p_tipo==='PASO'&&dd.paso_id===x.p_paso)||(x.p_tipo==='ACEPTACION'&&dd.tipo==='ACEPTACION')))dd.vigente=false;});
    t._docs.unshift({id:++did,paso_id:x.p_paso,tipo:x.p_tipo,storage_path:x.p_storage_path,nombre:x.p_nombre,mime:x.p_mime,bytes:x.p_bytes,vigente:true,subido_at:new Date().toISOString()});ev(t,'DOCUMENTO_SUBIDO');return {documento_id:did};},
  te_factura_preparar:function(x){if(!ROLES[ROL].facturador)return err('SOLO_FACTURADOR');var t=T.find(function(z){return z._fact.some(function(ff){return ff.id===x.p_factura;});}),fa=t._fact.find(function(ff){return ff.id===x.p_factura;});
    fa.estado='LISTA';fa.snapshot_hash='demo-'+fa.id;fa.devolucion=null;ev(t,'FACTURA_PREPARADA');return {estado:'LISTA'};},
  te_factura_aprobar:function(x){var e=master();if(e)return e;var t=T.find(function(z){return z._fact.some(function(ff){return ff.id===x.p_factura;});}),fa=t._fact.find(function(ff){return ff.id===x.p_factura;});
    if(fa.estado!=='LISTA')return err('NO_LISTA');fa.estado='APROBADA';ev(t,'FACTURA_APROBADA');
    setTimeout(function(){fa.estado='EMITIDA';fa.of_folio=String(7000+t.id);fa.fecha_emision_dte=HOY;etapa(t,'FACTURADA');ev(t,'FACTURA_EMITIDA');},50);   // la demo simula la Edge de emisión
    return {estado:'APROBADA'};},
  te_factura_devolver:function(x){var e=master();if(e)return e;var t=T.find(function(z){return z._fact.some(function(ff){return ff.id===x.p_factura;});}),fa=t._fact.find(function(ff){return ff.id===x.p_factura;});fa.estado='PENDIENTE';fa.devolucion=x.p_comentario;return {};},
  te_trabajo_autorizar_inicio:function(x){var t=tr(x.p_trabajo);var e=abierto(t)||master();if(e)return e;t.inicio_autorizado_motivo=x.p_motivo;ev(t,'INICIO_AUTORIZADO_SIN_PAGO');return {};},
  te_trabajo_iniciar:function(x){var t=tr(x.p_trabajo);var e=abierto(t)||editor(t);if(e)return e;if(t.etapa!=='FACTURADA')return err(t.etapa==='ACEPTADA'?'SIN_FACTURA':'NO_INICIABLE');
    if(t._cuotas[0].estado!=='PAGADA'&&!t.inicio_autorizado_motivo)return err('SIN_PAGO_DE_INICIO');iniciar(t);t.etapa_desde=new Date().toISOString();return {etapa:'EN_EJECUCION'};},
  te_paso_marcar:function(x){var t=T.find(function(z){return z._pasos.some(function(p){return p.id===x.p_paso;});});var e=abierto(t)||editor(t);if(e)return e;var p=t._pasos.find(function(q){return q.id===x.p_paso;});
    if(p.requiere_documento&&!t._docs.some(function(dd){return dd.paso_id===p.id&&dd.vigente;}))return err('FALTA_DOCUMENTO');
    if(p.es_entrega&&t.retener_entrega&&saldo(t)>0)return err('ENTREGA_RETENIDA');
    if(p.es_entrega&&t.etapa==='EN_EJECUCION'&&t._pasos.some(function(q){return q!==p&&q.obligatorio&&q.estado==='PENDIENTE';}))return err('PASOS_OBLIGATORIOS_PENDIENTES');
    p.estado='HECHO';p.hecho_at=new Date().toISOString();if(p.es_entrega&&t.etapa==='TERMINADO')t.entrega_estado='ENTREGADO';ev(t,'PASO_HECHO');return {avance:avance(t)};},
  te_paso_saltar:function(x){var e=master();if(e)return e;var t=T.find(function(z){return z._pasos.some(function(p){return p.id===x.p_paso;});}),p=t._pasos.find(function(q){return q.id===x.p_paso;});p.estado='SALTADO';p.saltado_motivo=x.p_motivo;ev(t,'PASO_SALTADO');return {};},
  te_trabajo_terminar:function(x){var t=tr(x.p_trabajo);var e=abierto(t)||editor(t);if(e)return e;var ret=t.retener_entrega&&saldo(t)>0;
    if(t._pasos.some(function(p){return p.obligatorio&&p.estado==='PENDIENTE'&&!(p.es_entrega&&ret);}))return err('PASOS_OBLIGATORIOS_PENDIENTES');
    etapa(t,'TERMINADO');t.entrega_estado=ret?'RETENIDA':t._pasos.some(function(p){return p.es_entrega&&p.estado==='HECHO';})?'ENTREGADO':'PENDIENTE';t._cuotas.forEach(function(c){if(!c.fecha_vencimiento)c.fecha_vencimiento=HOY;});ev(t,'TRABAJO_TERMINADO');return {entrega_retenida:ret};},
  te_trabajo_faltantes_cierre:function(x){var t=tr(x.p_trabajo),f=[];if(t.etapa!=='TERMINADO')f.push('TERMINAR');if(!t._fact.some(function(ff){return ff.estado==='EMITIDA';}))f.push('FACTURAR');if(saldo(t)>0)f.push('COBRAR');if(t.entrega_estado!=='ENTREGADO')f.push('ENTREGAR');return f;},
  te_trabajo_cerrar:function(x){var t=tr(x.p_trabajo);var e=abierto(t)||master();if(e)return e;if(RPC.te_trabajo_faltantes_cierre(x).length)return err('CIERRE_INCOMPLETO');t.cerrado_at=new Date().toISOString();t.cierre_tipo='COMPLETO';ev(t,'TRABAJO_CERRADO');return {};},
  te_trabajo_cerrar_sin_completar:function(x){var t=tr(x.p_trabajo);var e=abierto(t)||master();if(e)return e;t.cerrado_at=new Date().toISOString();t.cierre_tipo='SIN_COMPLETAR';t.cierre_motivo=x.p_motivo;t.cierre_detalle=x.p_detalle;
    t._cuotas.forEach(function(c){if(c.estado==='PENDIENTE')c.estado='ANULADA';});ev(t,'TRABAJO_CERRADO_SIN_COMPLETAR');return {};}
};

window.TE_DEMO_API={
  yo:function(){return ok(ROLES[ROL]);},
  tablero:function(){return ok({trabajos:T.filter(visible).map(fila).sort(function(x,y){return y.id-x.id;}),parametros:{modo_factura:'PRUEBA',produccion_habilitada:false,avisos_habilitados:false,avisos_modo:'PRUEBA',vigencia_cotizacion_dias:15,responsable_ve_todos:false},usuarios:USU});},
  ficha:function(id){var t=tr(id);if(!t||!visible(t))return ok({t:null});var o={};Object.keys(t).forEach(function(k){if(k[0]!=='_')o[k]=t[k];});
    return ok({t:o,cuotas:t._cuotas,facturas:t._fact,pasos:t._pasos.filter(function(p){return p.estado!=='QUITADO';}),docs:t._docs,eventos:t._ev,tareas:t._tareas,fa:resumen(t)});},
  servicios:function(){return ok(SRV);},
  clientes:function(){return ok(CLIS);},
  rpc:function(fn,args){if(!RPC[fn])return err('NO_DISPONIBLE_EN_DEMO');try{var r=RPC[fn](args);return r&&typeof r.then==='function'?r:ok(r);}catch(e){return Promise.reject(e);}},
  subir:function(ruta){var r=ROLES[ROL];if(!(r.es_master||r.responsable))return Promise.reject(new Error('new row violates row-level security policy (demo: Pagos y Facturación no suben)'));return ok(ruta);},
  urlFirmada:function(){return ok(URL.createObjectURL(new Blob(['Documento ficticio de demostración (no existe en Storage).'],{type:'text/plain'})));}
};
window.TE_DEMO_UI=function(alCambiar){
  var top=document.querySelector('.topbar');if(!top)return;var w=document.createElement('div');w.className='gc-vercomo';
  w.innerHTML='<span>Ver como</span><div class="gc-seg" role="group" aria-label="Ver como (demo)">'+[['responsable','Responsable · Miguel'],['master','Master'],['facturacion','Facturación'],['pagos','Pagos'],['cobranza','Cobranza']].map(function(r){
    return '<button type="button" class="fb'+(r[0]===ROL?' on':'')+'" data-rol="'+r[0]+'" aria-pressed="'+(r[0]===ROL)+'">'+r[1]+'</button>';}).join('')+'</div>';
  top.appendChild(w);
  w.addEventListener('click',function(e){var b=e.target.closest('[data-rol]');if(!b)return;ROL=b.getAttribute('data-rol');w.querySelectorAll('[data-rol]').forEach(function(x){var on=x===b;x.classList.toggle('on',on);x.setAttribute('aria-pressed',on);});alCambiar();});
};
})();
