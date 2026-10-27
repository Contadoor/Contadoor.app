/* ============================================================
   cotizaciones/cot-demo.js — MODO DEMOSTRACIÓN de Cotizaciones (datos 100 % ficticios)
   Candado 2 de 3: solo se define en localhost / 127.0.0.1 / [::1]. No se conecta a Supabase ni a Storage; nada se guarda.
   Empresas y personas inventadas; sin RUT, correos ni teléfonos reales. Las reglas reales las aplica el servidor (aquí se imitan).
   ============================================================ */
(function(){
'use strict';
var h=location.hostname;if(!(h==='localhost'||h==='127.0.0.1'||h==='[::1]'))return;
var G=window.GC, HOY=G.hoyCL();
function addD(iso,n){var d=new Date(iso+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
function ts(n){return addD(HOY,n)+'T14:00:00Z';}
function err(cod){var e=new Error(cod);e.srv={code:'P0001',message:cod,status:400};return Promise.reject(e);}
function ok(x){return new Promise(function(r){setTimeout(function(){r(x===undefined?null:JSON.parse(JSON.stringify(x)));},140);});}
var ROLES={
  master:{usuario_id:1,nombre:'Luciano Duarte',master:true,comercial:false,te:false,puede_plan:true,puede_te:true,acceso:true,puede_leer:true},
  comercial:{usuario_id:4,nombre:'Fernanda Montero',master:false,comercial:true,te:false,puede_plan:true,puede_te:true,acceso:true,puede_leer:true},
  miguel:{usuario_id:13,nombre:'Miguel Duarte',master:false,comercial:false,te:true,puede_plan:false,puede_te:true,acceso:true,puede_leer:true}
};
var ROL='master';
var NOMBRES={1:'Luciano Duarte',4:'Fernanda Montero',13:'Miguel Duarte'};
var PLANES=[{codigo:'cumplimiento',nombre:'Cumplimiento',precio_uf:1,valor_por_trab_uf:0.39,trab_incluidos:0,por_propuesta:false},
  {codigo:'asesoria',nombre:'Contadoor PRO',precio_uf:3,valor_por_trab_uf:0.39,trab_incluidos:0,por_propuesta:false},
  {codigo:'estrategico',nombre:'Contadoor Estratégico',precio_uf:0,valor_por_trab_uf:0.39,trab_incluidos:0,por_propuesta:true},
  {codigo:'remuneraciones',nombre:'Remuneraciones',precio_uf:0,valor_por_trab_uf:0.4,trab_incluidos:0,por_propuesta:false}];
var SERV=[{id:'s-form',nombre:'Formalización e inicio de actividades',descripcion:'Constitución y alta en el SII',precio:180000,precio_hasta:null,clase:'FIJO',disponible:true},
  {id:'s-mod',nombre:'Modificación de sociedades',descripcion:'Cambios en la escritura',precio:90000,precio_hasta:250000,clase:'RANGO',disponible:true},
  {id:'s-f29',nombre:'Regularización F29',descripcion:'Por cada F29 pendiente',precio:18990,precio_hasta:null,clase:'PROPUESTA',disponible:true},
  {id:'s-giro',nombre:'Término de giro',moneda:'UF',disponible:false,motivo:'SERVICIO_NO_CLP'}];
var SOL=[{frase:'Me avisan tarde el IVA y pago multas',logra:'Pagas a tiempo y sin multas',como:'Calendario propio y aviso 5 días antes'},
  {frase:'No sé cuánto voy a pagar en abril',logra:'Llegas a la renta sin sorpresas',como:'Proyección MiRenta cada trimestre'}];
var id=100, C=[];
function nueva(o){id++;var c=Object.assign({id:id,codigo:'COT-2026-'+String(id-100).padStart(3,'0'),version:1,anterior_id:null,cliente_id:null,lead_id:null,prospecto_nombre:null,trabajadores:null,
  condicion_pago:null,n_cuotas:null,monto_propuesto:null,descuento_pct:null,motivo_cambio:null,motivos_aprobacion:[],aprobacion_regla:null,devolucion_comentario:null,snapshot:null,snapshot_hash:null,
  vigencia_hasta:null,te_trabajo:null,primer_mes:null,eventos:[],respaldos:[],creado_por:o.responsable_usuario_id,soluciones:SOL.slice(0,1),notas_internas:null,descripcion_que:null,descripcion_alcance:null},o);
  calcular(c);C.push(c);return c;}
function calcular(c){
  if(c.tipo==='PLAN'){var p=PLANES.find(function(x){return x.codigo===c.plan_codigo;})||PLANES[0];var n=c.trabajadores||0;
    c.monto_catalogo=p.por_propuesta?null:Math.round((p.precio_uf+n*p.valor_por_trab_uf)*100)/100;c.moneda='UF';c.periodicidad='MENSUAL';c.que=p.nombre+(n?' · '+n+' trab.':'');
    c.items=[{glosa:p.nombre,detalle:p.por_propuesta?'Valor por propuesta':'Mensualidad base',cantidad:1,unitario:p.precio_uf,subtotal:p.por_propuesta?null:p.precio_uf}];
    if(n&&!p.por_propuesta)c.items.push({glosa:'Gestión laboral',detalle:'Por trabajador',cantidad:n,unitario:p.valor_por_trab_uf,subtotal:Math.round(n*p.valor_por_trab_uf*100)/100});
    c.motivos_aprobacion=[];if(p.por_propuesta)c.motivos_aprobacion.push('PLAN_POR_PROPUESTA');else if(c.monto_propuesto&&c.monto_propuesto!==c.monto_catalogo)c.motivos_aprobacion.push('PRECIO_DISTINTO');
  }else{var s=SERV.find(function(x){return x.id===c.servicio_id;})||SERV[0];c.moneda='CLP';c.periodicidad='UNICO';c.que=s.nombre;
    c.monto_catalogo=s.clase==='FIJO'?s.precio:null;c.items=[{glosa:s.nombre,detalle:s.descripcion,cantidad:1,subtotal:c.monto_propuesto||c.monto_catalogo}];
    c.motivos_aprobacion=[];if(s.clase==='RANGO')c.motivos_aprobacion.push('SERVICIO_CON_RANGO');if(s.clase==='PROPUESTA')c.motivos_aprobacion.push('SERVICIO_POR_PROPUESTA');
    if(s.clase==='FIJO'&&c.monto_propuesto&&c.monto_propuesto!==s.precio)c.motivos_aprobacion.push('PRECIO_DISTINTO');if(c.condicion_pago==='CUOTAS'&&c.n_cuotas>3)c.motivos_aprobacion.push('CUOTAS_FUERA_ESTANDAR');}
  if(c.descuento_pct)c.motivos_aprobacion.push('DESCUENTO');
  var base=c.monto_propuesto||c.monto_catalogo;c.monto_final=base==null?null:(c.descuento_pct?(c.tipo==='TE'?Math.round(base*(100-c.descuento_pct)/100):Math.round(base*(100-c.descuento_pct))/100):base);
}
function ev(c,t,actor,det){c.eventos.push({tipo:t,actor:actor===null?null:NOMBRES[actor]||'Demo',detalle:det||{},at:new Date().toISOString()});}
function aprobar(c,regla,quien){c.estado='APROBADA';c.aprobacion_regla=regla;c.aprobado_por=quien;c.snapshot={codigo:c.codigo,version:c.version,tipo:c.tipo,para:{nombre:para(c)},items:c.items,moneda:c.moneda,periodicidad:c.periodicidad,
  monto_final:c.monto_final,descuento_pct:c.descuento_pct,soluciones:c.soluciones,detalle:{que:c.descripcion_que,alcance:c.descripcion_alcance},vigencia_dias:15,
  plan:c.tipo==='PLAN'?{nombre:(PLANES.find(function(x){return x.codigo===c.plan_codigo;})||{}).nombre}:null,servicio:c.tipo==='TE'?{nombre:c.que}:null,condicion:c.tipo==='TE'?{tipo:c.condicion_pago,n_cuotas:c.n_cuotas}:null};c.snapshot_hash='d3m0'+'0'.repeat(60);}
function para(c){return c.prospecto_nombre||c._para||'Prospecto';}
// Datos iniciales ficticios
(function(){
  var a=nueva({tipo:'PLAN',plan_codigo:'asesoria',trabajadores:4,_para:'Ferretería El Tornillo Ltda.',lead_id:501,responsable_usuario_id:4,estado:'BORRADOR'});ev(a,'CREADA',4);
  var b=nueva({tipo:'PLAN',plan_codigo:'asesoria',trabajadores:2,_para:'Panadería Trigo Dorado SpA',cliente_id:201,responsable_usuario_id:4,estado:'PENDIENTE_APROBACION',monto_propuesto:3.2,motivo_cambio:'Cliente antiguo de otra empresa del grupo'});
  calcular(b);b.huella_revision='h'.repeat(64);ev(b,'CREADA',4);ev(b,'ENVIADA_A_APROBACION',4);
  var c=nueva({tipo:'TE',servicio_id:'s-form',condicion_pago:'CINCUENTA',n_cuotas:2,prospecto_nombre:'Emprendedora Luna Nueva',responsable_usuario_id:13,estado:'BORRADOR',descripcion_que:'Constitución de SpA con inicio de actividades',descripcion_alcance:'Escritura, inscripción, RUT e inicio en el SII'});
  aprobar(c,'CATALOGO_SIN_CAMBIOS',13);c.estado='ENVIADA';c.vigencia_hasta=addD(HOY,2);ev(c,'CREADA',13);ev(c,'APROBADA_CATALOGO',13);ev(c,'ENVIADA',13,{medio:'WHATSAPP'});
  var d=nueva({tipo:'PLAN',plan_codigo:'cumplimiento',_para:'Imprenta Tinta Viva Ltda.',cliente_id:202,responsable_usuario_id:1,estado:'BORRADOR'});aprobar(d,'MASTER_AUTOR',1);d.estado='ACEPTADA';d.vigencia_hasta=addD(HOY,9);
  d.primer_mes={dias:5,dias_mes:31,monto_uf:0.16,mensual_uf:1};ev(d,'CREADA',1);ev(d,'AUTOAPROBADA_MASTER',1);ev(d,'ENVIADA',1);ev(d,'ACEPTADA',1,{medio:'CORREO'});d.respaldos=[{id:1,nombre:'correo-acepta.pdf',storage_path:'x',subido_at:ts(0)}];
  var e=nueva({tipo:'TE',servicio_id:'s-mod',condicion_pago:'CONTADO',n_cuotas:1,_para:'Viñedos Cerro Alto SpA',cliente_id:203,responsable_usuario_id:13,estado:'BORRADOR',monto_propuesto:150000,motivo_cambio:'Escritura con 4 socios',descripcion_que:'Cambio de administración',descripcion_alcance:'Escritura y publicación en el Diario Oficial'});
  calcular(e);aprobar(e,'APROBADA_POR_MASTER',1);e.estado='ACEPTADA';e.vigencia_hasta=addD(HOY,6);e.te_trabajo={id:2,codigo:'TE-2026-003',etapa:'ACEPTADA',factura_estado:'PENDIENTE'};ev(e,'ACEPTADA',13,{medio:'CORREO'});
  var f=nueva({tipo:'PLAN',plan_codigo:'estrategico',_para:'Transportes Ruta Sur SpA',lead_id:502,responsable_usuario_id:4,estado:'BORRADOR',monto_propuesto:6,motivo_cambio:'Dos sociedades y holding'});
  calcular(f);aprobar(f,'APROBADA_POR_MASTER',1);f.estado='VENCIDA';f.vigencia_hasta=addD(HOY,-3);ev(f,'VENCIDA',null);
})();
function vista(c){return c.estado==='ENVIADA'&&c.vigencia_hasta<HOY?'VENCIDA':c.estado;}
function suya(c){var y=ROLES[ROL];return y.master||((c.responsable_usuario_id===y.usuario_id||c.creado_por===y.usuario_id)&&(c.tipo==='TE'||y.puede_plan));}
function fila(c){return {id:c.id,codigo:c.codigo,version:c.version,tipo:c.tipo,para:para(c),es_cliente:!!c.cliente_id,lead_id:c.lead_id,que:c.que,monto:c.monto_final,moneda:c.moneda,periodicidad:c.periodicidad,
  estado:vista(c),estado_bd:c.estado,fuera_catalogo:c.motivos_aprobacion.length>0,aprobacion_regla:c.aprobacion_regla,devuelta:!!c.devolucion_comentario,responsable:{id:c.responsable_usuario_id,nombre:NOMBRES[c.responsable_usuario_id]},
  vigencia_hasta:c.vigencia_hasta,dias_para_vencer:c.estado==='ENVIADA'?G.dias(HOY,c.vigencia_hasta):null,te_trabajo:c.te_trabajo,actualizado_at:ts(0)};}
function buscar(i){return C.find(function(x){return String(x.id)===String(i);});}
window.COT_DEMO_API={
  yo:function(){return ok(ROLES[ROL]);},
  bandeja:function(){return ok({hoy:HOY,filas:C.filter(suya).filter(function(c){return !C.some(function(n){return n.anterior_id===c.id;});}).map(fila).reverse()});},
  catalogo:function(){return ok({planes:PLANES,servicios:SERV,vigencia_dias:15,responsables:ROLES[ROL].master?[{id:1,nombre:'Luciano Duarte',plan:true,te:true},{id:4,nombre:'Fernanda Montero',plan:true,te:true},{id:13,nombre:'Miguel Duarte',plan:false,te:true}]:[]});},
  buscar:function(t){t=t.toLowerCase();return ok({clientes:[{id:201,nombre:'Panadería Trigo Dorado SpA',estado:'activo'},{id:202,nombre:'Imprenta Tinta Viva Ltda.',estado:'activo'}].filter(function(x){return x.nombre.toLowerCase().indexOf(t)>=0;}),
    prospectos:[{id:501,nombre:'Ferretería El Tornillo Ltda.',etapa:'propuesta'}].filter(function(x){return x.nombre.toLowerCase().indexOf(t)>=0;})});},
  ficha:function(i){var c=buscar(i);if(!c||!suya(c))return err('NO_EXISTE');var y=ROLES[ROL],ed=suya(c),v=vista(c);
    var co=Object.assign({},c,{estado_vista:v,para:para(c),dias_para_vencer:c.estado==='ENVIADA'?G.dias(HOY,c.vigencia_hasta):null,responsable_usuario_id:c.responsable_usuario_id,
      huella_revision:c.huella_revision||null,aprobado_por:c.aprobado_por||null});
    return ok({cotizacion:co,nombres:NOMBRES,plan:c.tipo==='PLAN'?PLANES.find(function(x){return x.codigo===c.plan_codigo;}):null,servicio:c.tipo==='TE'?SERV.find(function(x){return x.id===c.servicio_id;}):null,
      te_trabajo:c.te_trabajo,eventos:c.eventos,respaldos:c.respaldos,versiones:C.filter(function(x){return x.codigo===c.codigo;}).map(function(x){return {id:x.id,version:x.version,estado:vista(x),monto:x.monto_final};}),
      puede:{editar:ed&&c.estado==='BORRADOR',solicitar:ed&&c.estado==='BORRADOR',aprobar:y.master&&c.estado==='PENDIENTE_APROBACION',devolver:y.master&&c.estado==='PENDIENTE_APROBACION',
        marcar_enviada:ed&&c.estado==='APROBADA',aceptar:ed&&v==='ENVIADA',rechazar:ed&&v==='ENVIADA',anular:ed&&['BORRADOR','PENDIENTE_APROBACION','APROBADA','ENVIADA'].indexOf(c.estado)>=0,
        volver_a_cotizar:ed&&['VENCIDA','RECHAZADA','ANULADA'].indexOf(v)>=0&&!C.some(function(n){return n.anterior_id===c.id;}),crear_cliente_onboarding:ed&&c.tipo==='PLAN'&&c.estado==='ACEPTADA'&&!c.cliente_id}});},
  rpc:function(fn,a){var y=ROLES[ROL],c=a&&a.p_id?buscar(a.p_id):null;
    if(fn==='cot_guardar'){var p=a.p;if(!c){c=nueva({tipo:p.tipo,plan_codigo:p.plan_codigo,servicio_id:p.servicio_id,responsable_usuario_id:p.responsable_usuario_id||y.usuario_id,estado:'BORRADOR'});c.creado_por=y.usuario_id;ev(c,'CREADA',y.usuario_id);}
      else ev(c,'EDITADA',y.usuario_id);
      ['plan_codigo','trabajadores','servicio_id','condicion_pago','n_cuotas','monto_propuesto','descuento_pct','motivo_cambio','soluciones','notas_internas'].forEach(function(k){if(k in p)c[k]=p[k];});
      if('que' in p)c.descripcion_que=p.que;if('alcance' in p)c.descripcion_alcance=p.alcance;if(p.prospecto){c.prospecto_nombre=p.prospecto.nombre;c.cliente_id=null;c.lead_id=null;}
      if(p.cliente_id){c.cliente_id=p.cliente_id;c._para={201:'Panadería Trigo Dorado SpA',202:'Imprenta Tinta Viva Ltda.'}[p.cliente_id];c.prospecto_nombre=null;}if(p.lead_id){c.lead_id=p.lead_id;c._para='Ferretería El Tornillo Ltda.';c.prospecto_nombre=null;}
      calcular(c);return ok({id:c.id,codigo:c.codigo,requiere_aprobacion:c.motivos_aprobacion.length>0&&!y.master,monto_final:c.monto_final});}
    if(fn==='cot_solicitar'){if(!c.soluciones||!c.soluciones.length)return err('SOLUCIONES_OBLIGATORIAS');if(c.monto_final==null)return err('VALOR_OBLIGATORIO');
      if(y.master){aprobar(c,'MASTER_AUTOR',y.usuario_id);ev(c,'AUTOAPROBADA_MASTER',y.usuario_id);return ok({estado:'APROBADA',aprobacion_regla:'MASTER_AUTOR'});}
      if(!c.motivos_aprobacion.length){aprobar(c,'CATALOGO_SIN_CAMBIOS',y.usuario_id);ev(c,'APROBADA_CATALOGO',y.usuario_id);return ok({estado:'APROBADA',aprobacion_regla:'CATALOGO_SIN_CAMBIOS'});}
      c.estado='PENDIENTE_APROBACION';c.huella_revision='h'.repeat(64);ev(c,'ENVIADA_A_APROBACION',y.usuario_id);return ok({estado:'PENDIENTE_APROBACION'});}
    if(fn==='cot_aprobar'){aprobar(c,'APROBADA_POR_MASTER',y.usuario_id);ev(c,'APROBADA_POR_MASTER',y.usuario_id);return ok({estado:'APROBADA'});}
    if(fn==='cot_devolver'){c.estado='BORRADOR';c.devolucion_comentario=a.p_comentario;c.devuelto_por=y.usuario_id;ev(c,'DEVUELTA',y.usuario_id,{comentario:a.p_comentario});return ok({estado:'BORRADOR'});}
    if(fn==='cot_marcar_enviada'){c.estado='ENVIADA';c.vigencia_hasta=addD(HOY,15);ev(c,'ENVIADA',y.usuario_id,{medio:a.p_medio});return ok({vigencia_hasta:c.vigencia_hasta});}
    if(fn==='cot_respaldo_registrar'){c.respaldos.push({id:c.respaldos.length+1,nombre:a.p_nombre,storage_path:a.p_storage_path,subido_at:new Date().toISOString()});ev(c,'RESPALDO_SUBIDO',y.usuario_id);return ok({respaldo_id:c.respaldos.length});}
    if(fn==='cot_aceptar'){c.estado='ACEPTADA';ev(c,'ACEPTADA',y.usuario_id,{medio:a.p_medio});
      if(c.tipo==='TE'){c.te_trabajo={id:9,codigo:'TE-2026-0'+(10+c.id%50),etapa:'ACEPTADA',factura_estado:'PENDIENTE'};return ok({estado:'ACEPTADA',te_codigo:c.te_trabajo.codigo});}
      c.primer_mes={dias:5,dias_mes:31,monto_uf:Math.round(c.monto_final*5/31*100)/100,mensual_uf:c.monto_final};return ok({estado:'ACEPTADA'});}
    if(fn==='cot_rechazar'){c.estado='RECHAZADA';c.rechazo_motivo=a.p_motivo;ev(c,'RECHAZADA',y.usuario_id,{motivo:a.p_motivo});return ok({});}
    if(fn==='cot_anular'){c.estado='ANULADA';c.anulacion_motivo=a.p_motivo;c.anulado_por=y.usuario_id;ev(c,'ANULADA',y.usuario_id,{motivo:a.p_motivo});return ok({});}
    if(fn==='cot_volver_a_cotizar'){if(c.estado==='ENVIADA')c.estado='VENCIDA';var o=Object.assign({},c,{version:c.version+1,anterior_id:c.id,estado:'BORRADOR',eventos:[],respaldos:[],te_trabajo:null,aprobacion_regla:null,snapshot:null,vigencia_hasta:null});delete o.id;delete o.codigo;
      var n=nueva(o);n.codigo=c.codigo;ev(n,'NUEVA_VERSION',y.usuario_id);ev(c,'RECOTIZADA',y.usuario_id);return ok({id:n.id,version:n.version});}
    return err('NO_APLICA');},
  subir:function(r){return ok(r);},
  urlFirmada:function(){return ok('about:blank');}
};
window.COT_DEMO_UI=function(recargar){
  var top=document.querySelector('.gc-top');if(!top)return;
  var w=document.createElement('label');w.className='gc-vercomo';w.innerHTML='<span>Ver como</span><select id="cotDemoRol" class="cot-sel"><option value="master">Master (Luciano)</option><option value="comercial">Comercial</option><option value="miguel">Miguel · trabajos especiales</option></select>';
  top.appendChild(w);w.querySelector('select').addEventListener('change',function(e){ROL=e.target.value;recargar();});
};
})();
