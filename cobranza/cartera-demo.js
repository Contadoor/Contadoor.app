/* ============================================================
   cobranza/cartera-demo.js — MODO DEMOSTRACIÓN de Cobranza (datos 100 % ficticios)
   Candado 2 de 3: solo se define en localhost / 127.0.0.1 / [::1]. No se conecta a Supabase; nada se guarda
   (todo vive en memoria y se pierde al recargar). Nombres de empresas inventados; sin RUT ni datos de contacto.
   ============================================================ */
(function(){
'use strict';
var h=location.hostname;if(!(h==='localhost'||h==='127.0.0.1'||h==='[::1]'))return;
var G=window.GC, HOY=G.hoyCL();
function addD(iso,n){var d=new Date(iso+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
function per(iso){return iso.slice(0,7);}
function err(cod,msg){var e=new Error(cod+(msg?': '+msg:''));e.srv={code:'P0001',message:cod+(msg?': '+msg:''),status:400};return Promise.reject(e);}
function ok(x){return new Promise(function(r){setTimeout(function(){r(JSON.parse(JSON.stringify(x)));},180);});}

var ROL='master';
var ROLES={
  master:{usuario_id:1,nombre:'Master (demo)',rol:'master',es_master:true,puede_leer:true,puede_gestionar:true,puede_registrar_pagos:true,puede_decidir:true},
  cobranza:{usuario_id:2,nombre:'Cobranza (demo)',rol:'contable',es_master:false,puede_leer:true,puede_gestionar:true,puede_registrar_pagos:true,puede_decidir:false},
  pagos:{usuario_id:3,nombre:'Pagos (demo)',rol:'pagos',es_master:false,puede_leer:true,puede_gestionar:false,puede_registrar_pagos:true,puede_decidir:false},
  analista:{usuario_id:4,nombre:'Analista (demo)',rol:'contable',es_master:false,puede_leer:false,puede_gestionar:false,puede_registrar_pagos:false,puede_decidir:false}
};

/* ── Cartera ficticia (montos redondos inventados) ── */
var NOM={101:'Cafetería Brisa Andina SpA',102:'Taller Ruedas del Sur Ltda.',103:'Estudio Creativo Nube Lila SpA',104:'Ferretería El Martillo Feliz EIRL',
  105:'Clínica Veterinaria Patitas SpA',106:'Transportes Cóndor Azul SpA',107:'Librería Hoja Nueva Ltda.',108:'Constructora Piedra Firme SpA',
  109:'Agrícola Valle Sereno SpA',110:'Distribuidora Mar Abierto Ltda.'};
// RUT ficticios (cuerpo inventado 76.0xx.xxx con dígito verificador calculado).
function dvRut(n){var s=0,m=2;String(n).split('').reverse().forEach(function(c){s+=Number(c)*m;m=m===7?2:m+1;});var r=11-(s%11);return r===11?'0':r===10?'K':String(r);}
var RUTS={};Object.keys(NOM).forEach(function(k){var n=76000000+Number(k)*1111;RUTS[k]=n+'-'+dvRut(n);});
var docId=1000, DOCS=[], CLI=[], REPS=[], PAUSAS=[], TAREAS=[], PAGOS=[], AVISOS=[], GEST=[], avId=5000, pagoId=900, repId=70;
function doc(cli,origen,montoMil,venceOffset,extra){
  var v=addD(HOY,venceOffset), e=addD(v,-20), d=Object.assign({id:++docId,cliente_id:cli,origen:origen,folio:origen==='CUOTA_REPACTACION'?null:String(4000+docId),
    periodo:origen==='MENSUALIDAD'?per(addD(e,-15)):null,concepto:origen==='MENSUALIDAD'?'Mensualidad servicios contables '+per(addD(e,-15)):origen==='SALDO_INICIAL'?'Saldo inicial histórico':'Documento',
    cuota_n:null,cuotas_total:null,fecha_emision:e,fecha_vencimiento:v,monto:montoMil*1000,pagado:0,rebajado:0,estado:'PENDIENTE',te_cuota_id:null,ref_externa:null},extra||{});
  d.saldo=d.monto-d.pagado-d.rebajado;DOCS.push(d);return d;
}
function cli(id,estado,desde){CLI.push({cliente_id:id,estado:estado,estado_desde:addD(HOY,desde||-5),deuda_desde:null,suspendido:estado==='SUSPENDIDO',suspension_desde:null,suspension_sugerida_desde:estado==='SUSPENSION_PROGRAMADA'?addD(HOY,-1):null,en_termino:estado==='EN_TERMINO',ultima_evaluacion:HOY});}
function aviso(cliId,cod,diasOff,estado,motivo,gestion){AVISOS.push({id:++avId,cliente_id:cliId,codigo:cod,variante:1,es_gestion:!!gestion,dia:addD(HOY,diasOff),programado_para:addD(HOY,diasOff)+'T13:30:00Z',estado:estado||'PENDIENTE',motivo_cancelacion:motivo||null,enviado_at:null});}

doc(101,'MENSUALIDAD',95,12);cli(101,'POR_VENCER');aviso(101,'M1',8,'PENDIENTE');
doc(102,'MENSUALIDAD',120,-9);doc(102,'MENSUALIDAD',120,21);cli(102,'VENCIDO',-8);aviso(102,'V',-6,'PENDIENTE',null,true);aviso(102,'V',-1,'PENDIENTE',null,true);
doc(103,'MENSUALIDAD',85,-40);doc(103,'MENSUALIDAD',85,-9);cli(103,'RIESGO',-3);aviso(103,'RS',-2,'PENDIENTE',null,true);aviso(103,'RS',2,'PENDIENTE',null,true);
GEST.push({id:1,cliente_id:103,tipo:'LLAMADA',dia:addD(HOY,-4),nota:'Dice que paga la próxima semana'});
doc(104,'MENSUALIDAD',70,-70);doc(104,'MENSUALIDAD',70,-40);doc(104,'MENSUALIDAD',70,-9);cli(104,'SUSPENSION_PROGRAMADA',-1);
TAREAS.push({id:301,cliente_id:104,tipo:'REVISAR_OBLIGACIONES',plazo:addD(HOY,1),creada_at:addD(HOY,-2)+'T10:00:00Z'});aviso(104,'M7',-1,'PENDIENTE',null,true);
doc(105,'MENSUALIDAD',110,-9);cli(105,'VENCIDO',-8);PAUSAS.push({id:401,cliente_id:105,tipo:'RECORDATORIOS',origen:'COMPROMISO',hasta:addD(HOY,6),compromiso_fecha:addD(HOY,4),compromiso_monto:110000});
aviso(105,'P3',-2,'PENDIENTE');aviso(105,'V',-1,'CANCELADO','Pausa por compromiso de pago');
var r106=[doc(106,'MENSUALIDAD',60,-38),doc(106,'MENSUALIDAD',60,-8)];cli(106,'RIESGO',-2);
REPS.push({id:++repId,cliente_id:106,estado:'EN_VALIDACION',canal:'GESTOR',n_cuotas:3,monto_total:120000,monto_cuota:40000,monto_ultima:40000,pie_vence:addD(HOY,2),validacion_limite:addD(HOY,1)+'T15:00:00Z',solicitada_dia:HOY,pie_pagado:0,nota:'Pidió 3 cuotas por baja de ventas',motivo_rechazo:null});
aviso(106,'RQ',0,'PENDIENTE');
doc(107,'TRABAJO_ESPECIAL',90,3,{folio:'5120',concepto:'Trabajo especial TE-2026-004 · Constitución de sociedad · cuota 1 de 2',cuota_n:1,cuotas_total:2,te_cuota_id:11,ref_externa:'TE-2026-004'});cli(107,'AL_DIA');
doc(108,'SALDO_INICIAL',150,-95);doc(108,'MENSUALIDAD',130,-70);doc(108,'MENSUALIDAD',130,-40);cli(108,'SUSPENDIDO',-20);aviso(108,'M8',-20,'PENDIENTE');
doc(109,'CUOTA_REPACTACION',50,15,{concepto:'Repactación · cuota 2 de 3',cuota_n:2,cuotas_total:3,repactacion_id:69});doc(109,'CUOTA_REPACTACION',50,45,{concepto:'Repactación · cuota 3 de 3',cuota_n:3,cuotas_total:3,repactacion_id:69});
cli(109,'AL_DIA',-25);REPS.push({id:69,cliente_id:109,estado:'VIGENTE',canal:'MASTER',n_cuotas:3,monto_total:150000,monto_cuota:50000,monto_ultima:50000,pie_vence:addD(HOY,-25),validacion_limite:addD(HOY,-26)+'T15:00:00Z',solicitada_dia:addD(HOY,-27),pie_pagado:50000,nota:null,motivo_rechazo:null});
PAGOS.push({id:++pagoId,cliente_id:109,fecha_pago:addD(HOY,-25),monto:50000,monto_abono:0,referencia:'Pie repactación',estado:'VIGENTE',movimiento_id:null});
doc(110,'MENSUALIDAD',75,-3);cli(110,'VENCIDO',-2);
PAGOS.push({id:++pagoId,cliente_id:110,fecha_pago:addD(HOY,-15),monto:75000,monto_abono:0,referencia:'Transferencia',estado:'VIGENTE',movimiento_id:null});
PAGOS.push({id:++pagoId,cliente_id:101,fecha_pago:addD(HOY,-12),monto:95000,monto_abono:0,referencia:'Transferencia',estado:'VIGENTE',movimiento_id:null});
var MOVS=[{movimiento_id:8801,fecha:addD(HOY,-1),monto:75000,saldo:75000,estado:'por_conciliar',rut_origen:null,nombre_origen:'TRANSF. DISTRIBUIDORA (demo)',cliente_id:110,razon_social:NOM[110],via:'ASIGNADO',exacto:true,propuesta:[]},
  {movimiento_id:8802,fecha:addD(HOY,-2),monto:100000,saldo:100000,estado:'por_conciliar',rut_origen:null,nombre_origen:'TRANSF. TALLER (demo)',cliente_id:102,razon_social:NOM[102],via:'MEMORIA',exacto:false,propuesta:[]}];
function propuesta(m){var rest=m.saldo,p=[];DOCS.filter(function(d){return d.cliente_id===m.cliente_id&&d.estado==='PENDIENTE'&&d.saldo>0;}).sort(function(a,b){return a.fecha_vencimiento<b.fecha_vencimiento?-1:1;})
  .forEach(function(d){if(rest<=0)return;var x=Math.min(rest,d.saldo);p.push({documento_id:d.id,folio:d.folio,monto:x});rest-=x;});m.propuesta=p;}

function vencidoNoTE(id){return DOCS.filter(function(d){return d.cliente_id===id&&d.estado==='PENDIENTE'&&d.saldo>0&&d.origen!=='TRABAJO_ESPECIAL'&&d.fecha_vencimiento<HOY;});}
function recalcular(id){
  var c=CLI.find(function(x){return x.cliente_id===id;});if(!c)return;
  if(vencidoNoTE(id).length)return;
  if(c.estado==='SUSPENDIDO'||c.estado==='SUSPENSION_PROGRAMADA'){if(!TAREAS.some(function(t){return t.cliente_id===id&&t.tipo==='REACTIVAR_CLIENTE';}))TAREAS.push({id:Date.now()%100000,cliente_id:id,tipo:'REACTIVAR_CLIENTE',plazo:addD(HOY,1),creada_at:new Date().toISOString()});if(c.estado==='SUSPENDIDO')return;}
  c.estado=DOCS.some(function(d){return d.cliente_id===id&&d.estado==='PENDIENTE'&&d.saldo>0;})?'POR_VENCER':'AL_DIA';c.estado_desde=HOY;c.suspension_sugerida_desde=null;
}
function yo(){return Object.assign({modo:'PRUEBA',prueba_hasta:'2026-12-31',terminos_contractuales_vigentes:false,derivacion_externa_habilitada:false,envio_habilitado:false,arranque_fecha:addD(HOY,-30)},ROLES[ROL]);}
function exigir(campo,cod){if(!ROLES[ROL][campo])return err(cod||'SIN_PERMISO');return null;}
var claves={};

window.COB_DEMO_API={
  yo:function(){return ok(yo());},
  cartera:function(){
    var x=exigir('puede_leer');if(x)return x;
    var mes=HOY.slice(0,8)+'01';
    return ok({documentos:DOCS.filter(function(d){return d.estado==='PENDIENTE'||d.estado==='CASTIGADO';}),clientes:CLI,
      repactaciones:REPS.filter(function(r){return ['EN_VALIDACION','APROBADA','VIGENTE'].indexOf(r.estado)>=0;}),pausas:PAUSAS,tareas:TAREAS,
      pagosMes:PAGOS.filter(function(p){return p.estado==='VIGENTE'&&p.fecha_pago>=mes;}),nombres:NOM,ruts:RUTS});
  },
  indicadores:function(){
    var x=exigir('puede_decidir','SOLO_MASTER');if(x)return x;
    var meses=[];for(var i=5;i>=0;i--){var d=new Date(HOY+'T12:00:00Z');d.setUTCMonth(d.getUTCMonth()-i);var cart=[1650,1700,1580,1720,1810,1760][5-i]*1000,ven=[420,460,390,510,560,620][5-i]*1000;
      meses.push({mes:d.toISOString().slice(0,7),cartera:cart,vencido:ven,morosidad_pct:Math.round(1000*ven/cart)/10,incobrabilidad_12m_pct:i>3?null:1.2,pagado_en_el_mes_pct:[78.5,74.2,80.1,71.9,69.4,66.0][5-i],
        dias_promedio_pago:[19.5,21,18.2,23.4,24.1,25.3][5-i],recuperacion:[210,180,240,190,170,150][5-i]*1000,repactaciones_cumplidas_pct:i>2?null:100});}
    return ok({hasta:HOY,meses:meses});
  },
  movimientos:function(){var x=exigir('puede_leer');if(x)return x;MOVS.forEach(propuesta);return ok(MOVS.filter(function(m){return m.saldo>0;}));},
  avisos:function(){var x=exigir('puede_leer');if(x)return x;return ok(AVISOS.slice().sort(function(a,b){return a.programado_para<b.programado_para?1:-1;}));},
  ficha:function(id){
    var x=exigir('puede_leer');if(x)return x;id=Number(id);
    var ds=DOCS.filter(function(d){return d.cliente_id===id&&(d.estado==='PENDIENTE'||d.estado==='CASTIGADO')&&d.saldo>0;}).sort(function(a,b){return a.fecha_vencimiento<b.fecha_vencimiento?-1:1;});
    var gr={};ds.forEach(function(d){var g=d.origen==='MENSUALIDAD'||d.origen==='SALDO_INICIAL'?'MENSUALIDAD':d.origen==='TRABAJO_ESPECIAL'?'TRABAJOS_ESPECIALES':'REPACTACION';
      (gr[g]=gr[g]||[]).push({documento_id:d.id,folio:d.folio,concepto:d.concepto,periodo:d.periodo,cuota:d.cuota_n?d.cuota_n+' de '+d.cuotas_total:null,monto:d.saldo,monto_documento:d.monto,rebajado_nc:d.rebajado,vencimiento:d.fecha_vencimiento,vencido:d.fecha_vencimiento<HOY});});
    var tit={MENSUALIDAD:'Mensualidad',TRABAJOS_ESPECIALES:'Trabajos especiales',REPACTACION:'Repactación'};
    var grupos=['MENSUALIDAD','TRABAJOS_ESPECIALES','REPACTACION'].filter(function(g){return gr[g];}).map(function(g){return {tipo:g,titulo:tit[g],lineas:gr[g],subtotal:gr[g].reduce(function(s,l){return s+l.monto;},0)};});
    var deuda=ds.reduce(function(s,d){return s+d.saldo;},0),venc=ds.filter(function(d){return d.fecha_vencimiento<HOY;}).reduce(function(s,d){return s+d.saldo;},0);
    var ab=PAGOS.filter(function(p){return p.cliente_id===id&&p.estado==='VIGENTE'&&p.abono_disp>0;}).reduce(function(s,p){return s+p.abono_disp;},0);
    return ok({estado:{grupos:grupos,notas_credito:[],abonos:[],total_deuda:deuda,total_abonos:ab,total:Math.max(deuda-ab,0),total_vencido:venc,
        comentario_transferencia:ds.some(function(d){return d.folio;})?'Facturas '+ds.filter(function(d){return d.folio;}).map(function(d){return d.folio;}).join(', '):null,datos_transferencia:{},fecha:HOY},
      pagos:PAGOS.filter(function(p){return p.cliente_id===id;}).sort(function(a,b){return a.fecha_pago<b.fecha_pago?1:-1;}),
      avisos:AVISOS.filter(function(a){return a.cliente_id===id;}).sort(function(a,b){return a.programado_para<b.programado_para?1:-1;}),
      gestiones:GEST.filter(function(g){return g.cliente_id===id;}),repactaciones:REPS.filter(function(r){return r.cliente_id===id;})});
  },
  pagoRegistrar:function(a){
    var x=exigir('puede_registrar_pagos','SOLO_PAGOS');if(x)return x;
    if(claves[a.p_clave_idem])return ok({pago_id:claves[a.p_clave_idem],resultado:'existente'});
    if(!a.p_fecha_pago||a.p_fecha_pago>HOY||a.p_fecha_pago<'2026-01-01')return err('FECHA_PAGO_INVALIDA');
    if(!a.p_aplicaciones.length&&!(a.p_abono>0))return err('PAGO_VACIO');
    for(var i=0;i<a.p_aplicaciones.length;i++){var ap=a.p_aplicaciones[i],d=DOCS.find(function(z){return z.id===ap.documento_id;});
      if(!d||d.cliente_id!==a.p_cliente_id)return err('DOCUMENTO_INVALIDO');if(d.estado!=='PENDIENTE')return err('DOCUMENTO_NO_COBRABLE');if(ap.monto>d.saldo)return err('SUPERA_SALDO_DOCUMENTO');}
    var total=a.p_aplicaciones.reduce(function(s,z){return s+z.monto;},0)+(a.p_abono||0);
    if(a.p_movimiento_id){var mv=MOVS.find(function(m){return m.movimiento_id===a.p_movimiento_id;});if(!mv)return err('MOVIMIENTO_NO_EXISTE');if(total>mv.saldo)return err('SUPERA_SALDO_MOVIMIENTO');mv.saldo-=total;}
    a.p_aplicaciones.forEach(function(ap){var d=DOCS.find(function(z){return z.id===ap.documento_id;});d.pagado+=ap.monto;d.saldo=d.monto-d.pagado-d.rebajado;if(d.saldo===0)d.estado='PAGADO';});
    var id=++pagoId;claves[a.p_clave_idem]=id;
    PAGOS.push({id:id,cliente_id:a.p_cliente_id,fecha_pago:a.p_fecha_pago,monto:total,monto_abono:a.p_abono||0,abono_disp:a.p_abono||0,referencia:a.p_referencia,estado:'VIGENTE',movimiento_id:a.p_movimiento_id||null});
    var rep=REPS.find(function(r){return r.cliente_id===a.p_cliente_id&&r.estado==='APROBADA';});if(rep){rep.pie_pagado+=total;if(rep.pie_pagado>=rep.monto_cuota)rep.estado='VIGENTE';}
    recalcular(a.p_cliente_id);
    aviso(a.p_cliente_id,vencidoNoTE(a.p_cliente_id).length?'P5':'P1',0,'PENDIENTE');
    var c=CLI.find(function(z){return z.cliente_id===a.p_cliente_id;});
    return ok({pago_id:id,resultado:'aplicado',monto:total,abono:a.p_abono||0,estado_cliente:c?c.estado:null});
  },
  repactacionSolicitar:function(a){
    var x=exigir('puede_gestionar','SOLO_COBRANZA');if(x)return x;
    if(!(a.p_n_cuotas>=2&&a.p_n_cuotas<=3))return err('CUOTAS_INVALIDAS','2 a 3');
    if(REPS.some(function(r){return r.cliente_id===a.p_cliente_id&&['EN_VALIDACION','APROBADA','VIGENTE'].indexOf(r.estado)>=0;}))return err('REPACTACION_ACTIVA');
    var t=vencidoNoTE(a.p_cliente_id).reduce(function(s,d){return s+d.saldo;},0);if(t<a.p_n_cuotas)return err('SIN_DEUDA_VENCIDA');
    var c=Math.floor(t/a.p_n_cuotas),u=t-c*(a.p_n_cuotas-1);
    REPS.push({id:++repId,cliente_id:a.p_cliente_id,estado:'EN_VALIDACION',canal:ROL==='master'?'MASTER':'GESTOR',n_cuotas:a.p_n_cuotas,monto_total:t,monto_cuota:c,monto_ultima:u,pie_vence:addD(HOY,2),validacion_limite:addD(HOY,1)+'T15:00:00Z',solicitada_dia:HOY,pie_pagado:0,nota:a.p_nota,motivo_rechazo:null});
    aviso(a.p_cliente_id,'RQ',0,'PENDIENTE');
    return ok({repactacion_id:repId,estado:'EN_VALIDACION',total:t,pie:c,cuota:c,ultima:u,pie_vence:addD(HOY,2)});
  },
  repactacionValidar:function(a){
    var x=exigir('puede_decidir','SOLO_MASTER');if(x)return x;
    var r=REPS.find(function(z){return z.id===a.p_repactacion_id;});if(!r)return err('REPACTACION_NO_EXISTE');if(r.estado!=='EN_VALIDACION')return err('REPACTACION_NO_EN_VALIDACION');
    if(a.p_aprobar){r.estado='APROBADA';aviso(r.cliente_id,'R2',0,'PENDIENTE');}
    else{if(!a.p_motivo||a.p_motivo.length<10)return err('MOTIVO_OBLIGATORIO');r.estado='RECHAZADA';r.motivo_rechazo=a.p_motivo;aviso(r.cliente_id,'RX',0,'PENDIENTE');}
    return ok({repactacion_id:r.id,estado:r.estado});
  }
};

/* Selector "Ver como" (solo demo): cambia el rol simulado para revisar qué puede hacer cada persona. */
window.COB_DEMO_UI=function(alCambiar){
  var top=document.querySelector('.topbar');if(!top)return;
  var w=document.createElement('div');w.className='gc-vercomo';
  w.innerHTML='<span>Ver como</span><div class="gc-seg" role="group" aria-label="Ver como (demo)">'+[['master','Master'],['cobranza','Cobranza · Leandro'],['pagos','Pagos'],['analista','Analista sin módulo']].map(function(r){
    return '<button type="button" class="fb'+(r[0]===ROL?' on':'')+'" data-rol="'+r[0]+'" aria-pressed="'+(r[0]===ROL)+'">'+r[1]+'</button>';}).join('')+'</div>';
  top.appendChild(w);
  w.addEventListener('click',function(e){var b=e.target.closest('[data-rol]');if(!b)return;ROL=b.getAttribute('data-rol');
    w.querySelectorAll('[data-rol]').forEach(function(x){var on=x===b;x.classList.toggle('on',on);x.setAttribute('aria-pressed',on);});G.cerrarDet();alCambiar();});
};
})();
