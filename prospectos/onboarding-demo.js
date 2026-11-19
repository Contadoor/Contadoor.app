/* prospectos/onboarding-demo.js — MODO DEMOSTRACIÓN de Onboarding L1 (datos 100 % ficticios, solo localhost).
   Se monta sobre ComDemo (comercial-demo.js): responde las RPC onb_* con las mismas reglas que la base y delega el resto. Nada se guarda. */
(function(){
'use strict';
var h=location.hostname;if(!(h==='localhost'||h==='127.0.0.1'||h==='[::1]')||!window.ComDemo)return;
var base=window.ComDemo.rpc, sig=5000;
function ahora(){return new Date().toISOString();}
var AN=[{id:5,nombre:'Analista Contable Demo',rol:'contable'},{id:6,nombre:'Analista RRHH Demo',rol:'rrhh'},{id:1,nombre:'Usuario Demo',rol:'master'}];
var C=[
  {id:1,lead_id:201,estado:'por_iniciar',lead:{nombre:'Camila Rojas',empresa:'Ferretería Los Aromos SpA',rut:null,email:'camila@ejemplo.test',tel:'+56 9 1234 5678',plan_interes:'pro',n_trabajadores:3,situacion:'Mi contador me avisa el IVA el mismo día.'},
   razon_social:'Ferretería Los Aromos SpA',rut:null,contacto:'Camila Rojas',email:'camila@ejemplo.test',tel:'+56 9 1234 5678',plan:'pro',valor_uf:null,gestion_laboral:true,valor_trab_uf:0.39,
   fecha_inicio:null,analista_contable_id:null,analista_rrhh_id:null,notas:null,cliente_id:null,creado_at:new Date(Date.now()-36e5*3).toISOString(),actualizado:ahora(),responsable:'Usuario Demo'},
  {id:2,lead_id:202,estado:'por_iniciar',lead:{nombre:'Valeria Muñoz',empresa:'Estudio de Yoga Prana',rut:'11111111-1',email:'valeria@ejemplo.test',tel:null,plan_interes:'cumplimiento',n_trabajadores:0,situacion:'Solo quiero cumplir.'},
   razon_social:'Estudio de Yoga Prana SpA',rut:'11111111-1',contacto:'Valeria Muñoz',email:'valeria@ejemplo.test',tel:null,plan:'cumplimiento',valor_uf:1,gestion_laboral:false,valor_trab_uf:0.39,
   fecha_inicio:new Date().toLocaleDateString('en-CA'),analista_contable_id:5,analista_rrhh_id:null,notas:null,cliente_id:null,creado_at:new Date(Date.now()-864e5).toISOString(),actualizado:ahora(),responsable:'Usuario Demo'},
  {id:3,lead_id:203,estado:'cliente_creado',lead:{nombre:'Rodrigo Pérez',empresa:'Panadería La Espiga',rut:'76086428-5',email:'rodrigo@ejemplo.test',tel:'+56 9 8765 4321',plan_interes:'pro',n_trabajadores:4,situacion:'Quiero dejar de pagar multas.'},
   razon_social:'Panadería La Espiga SpA',rut:'76086428-5',contacto:'Rodrigo Pérez',email:'rodrigo@ejemplo.test',tel:'+56 9 8765 4321',plan:'pro',valor_uf:3,gestion_laboral:true,valor_trab_uf:0.39,
   fecha_inicio:new Date(Date.now()-864e5*9).toLocaleDateString('en-CA'),analista_contable_id:5,analista_rrhh_id:6,notas:null,cliente_id:5001,creado_at:new Date(Date.now()-864e5*9).toISOString(),actualizado:ahora(),responsable:'Usuario Demo'}];
// ── L2: los 15 pasos (mismas reglas que la base: lo automático no se pisa; «listo» a mano solo en 9, 11, 12 y 13; motivo para «no aplica» y «esperando al cliente») ──
var CAT=[[1,'Plan aceptado (prospecto Ganado)','comercial',0,1,0,0],[2,'Ficha con plan y valor','comercial',1,1,0,1],[3,'Analistas asignados (contable y RR. HH.)','master',2,1,0,0],
  [4,'Conectado al SII (Cartapra)','comercial',5,1,0,1],[5,'Datos de la empresa desde el SII','comercial',6,1,0,1],[6,'Tasa de PPM y remanente del último F29','contable',10,1,0,1],
  [7,'Saldos iniciales para MiRenta (F22)','contable',15,1,0,1],[8,'Contactos: correo y WhatsApp de quien recibe el reporte','comercial',3,1,0,0],[9,'Carta de bienvenida en PDF y correo','comercial',2,1,1,1],
  [10,'Previred (si tiene trabajadores)','rrhh',7,1,0,1],[11,'Antecedentes del contador anterior (balance, libros, RLI)','contable',10,1,1,1],[12,'Regularizaciones (F29 atrasados u observaciones del SII)','contable',15,1,1,1],
  [13,'Primera factura (proporcional al inicio)','facturacion',5,1,1,1],[14,'Primer pago conciliado','pagos',30,0,0,1],[15,'Primer Pre-IVA o reporte enviado','contable',30,1,0,0]];
var AUTO={1:['listo','Prospecto ganado hace 9 días'],2:['listo','Plan PRO · 3 UF'],3:['listo','Contable y RR. HH. asignados'],4:['listo','Conectado hace 8 días'],
  5:['en_curso','Falta: comuna'],6:['en_curso','F29 202610 leído; falta la tasa de PPM en la ficha'],7:['en_curso','F22 AT2026 traído del SII; falta revisar la apertura'],
  8:['listo','Correo y WhatsApp en la ficha'],9:['pendiente','Se marca a mano mientras no esté instalada la carta automática'],10:['listo','Clave de Previred guardada en la bóveda'],
  11:['pendiente','Se marca a mano al recibir balance, libros y RLI'],12:['en_curso','1 F29 por revisar; marca «listo» al crear el trabajo especial'],
  13:['pendiente','Se emite como factura adicional desde Facturación'],14:['pendiente',null],15:['pendiente',null]};
var MARCAS={}, ACT=null;
function dia(n){var d=new Date(Date.now()-864e5*9);d.setDate(d.getDate()+n);return d.toLocaleDateString('en-CA');}
function evaluar(){
  var c=C[2],hoy=new Date().toLocaleDateString('en-CA'),listos=0,pend=0,venc=0;
  var pasos=CAT.map(function(k){var a=AUTO[k[0]],m=MARCAS[k[0]],est=(a[0]==='listo'||a[0]==='no_aplica')?a[0]:(m?m.estado:a[0]);
    var vence=dia(k[3]),atr=(est==='listo'||est==='no_aplica'||est==='bloqueado_cliente'||ACT)?0:Math.max(0,Math.round((Date.parse(hoy)-Date.parse(vence))/864e5));
    if(est==='listo'||est==='no_aplica')listos++;else if(k[4])pend++;if(atr>0)venc++;
    return {paso:k[0],titulo:k[1],responsable:k[2],plazo_dias:k[3],vence:vence,obligatorio:!!k[4],manual_listo:!!k[5],permite_no_aplica:!!k[6],estado:est,estado_auto:a[0],
      fuente:m&&a[0]!=='listo'?'manual':'auto',evidencia:a[1],dias_atraso:atr,marca:m?{estado:m.estado,motivo:m.motivo,actualizado:m.actualizado,por:'Usuario Demo'}:null};});
  return {caso_id:3,estado_caso:'cliente_creado',lead_id:203,actualizado:c.actualizado,razon_social:c.razon_social,cliente_id:5001,cliente_estado:ACT?'activo':'onboarding',
    inicio:dia(0),activado_at:ACT,activado_por:ACT?'Usuario Demo':null,resumen:{listos:listos,total:15,obligatorios_pendientes:pend,vencidos:venc},
    listo_para_activar:!ACT&&pend===0,puede_activar:!ACT&&pend===0,pasos:pasos,
    yo:{id:1,nombre:'Usuario Demo',master:true,comercial:true,areas:['comercial','master','contable','rrhh','pagos','facturacion']}};}
function faltan(c){var f=[];if(!c.razon_social)f.push('razon_social');if(!c.rut)f.push('rut');if(!c.plan)f.push('plan');if(!c.valor_uf)f.push('valor_uf');
  if(!c.fecha_inicio)f.push('fecha_inicio');if(!c.analista_contable_id)f.push('analista_contable');if(c.gestion_laboral&&!c.analista_rrhh_id)f.push('analista_rrhh');return f;}
function item(c){var x=JSON.parse(JSON.stringify(c));x.faltan=faltan(c);return x;}
function ok(v){return new Promise(function(r){setTimeout(function(){r(JSON.parse(JSON.stringify(v)));},120);});}
function err(code){return new Promise(function(_,j){setTimeout(function(){j(new Error(code));},120);});}
function rutOk(r){if(!/^[0-9]{7,8}-[0-9K]$/.test(r))return false;var n=r.split('-')[0],s=0,m=2;for(var i=n.length-1;i>=0;i--){s+=+n[i]*m;m=m===7?2:m+1;}var v=11-s%11;return (v===11?'0':v===10?'K':String(v))===r.split('-')[1];}
var F={
  onb_tablero:function(){var e=evaluar();return ok({casos:[{caso_id:3,razon_social:e.razon_social,cliente_id:5001,inicio:e.inicio,activado_at:e.activado_at,resumen:e.resumen,listo_para_activar:e.listo_para_activar}]});},
  onb_pasos:function(a){return a.p_caso_id===3?ok(evaluar()):err('NO_EXISTE');},
  onb_paso_marcar:function(a){if(a.p_caso_id!==3)return err('NO_EXISTE');if(ACT)return err('CASO_CERRADO');
    var k=CAT.filter(function(x){return x[0]===a.p_paso;})[0];if(!k)return err('PASO_INVALIDO');var au=AUTO[k[0]][0],m=MARCAS[k[0]],mot=String(a.p_motivo||'').trim();
    if(a.p_estado==='listo'&&!k[5])return err('PASO_AUTOMATICO');if(a.p_estado==='no_aplica'&&!k[6])return err('NO_APLICA_NO_PERMITIDO');
    if((a.p_estado==='no_aplica'||a.p_estado==='bloqueado_cliente')&&mot.length<5)return err('MOTIVO_OBLIGATORIO');
    if(/(clave|contrase(n|ñ)a|password)\s*[:=]/i.test(mot))return err('CLAVE_PROHIBIDA');
    if((au==='listo'||au==='no_aplica')&&a.p_estado!=='pendiente')return err('PASO_YA_LISTO');
    if((m?m.actualizado:null)!==(a.p_version||null))return err('VERSION_CONFLICTO');
    if(a.p_estado==='pendiente')delete MARCAS[k[0]];else MARCAS[k[0]]={estado:a.p_estado,motivo:mot.length>=5?mot:null,actualizado:ahora()+'#'+k[0]};
    return ok(evaluar());},
  onb_activar:function(a){var e=evaluar();if(a.p_actualizado!==C[2].actualizado)return err('VERSION_CONFLICTO');if(ACT)return err('CASO_CERRADO');
    if(!e.listo_para_activar)return err('FALTAN_PASOS');ACT=ahora();C[2].actualizado=ahora();return ok(evaluar());},
  onb_listar:function(){return ok({yo:{id:1,nombre:'Usuario Demo',master:true,escribe:true},casos:C.map(item),analistas:AN});},
  onb_guardar:function(a){var c=C.filter(function(x){return x.id===a.p_id;})[0];if(!c)return err('NO_EXISTE');if(c.estado!=='por_iniciar')return err('CASO_CERRADO');
    if(a.p_actualizado!==c.actualizado)return err('VERSION_CONFLICTO');var d=a.p_datos||{};
    var rut=String(d.rut||'').toUpperCase().replace(/[^0-9K-]/g,'');if(rut&&rut.indexOf('-')<0&&rut.length>=8)rut=rut.slice(0,-1)+'-'+rut.slice(-1);
    if(rut&&!rutOk(rut))return err('RUT_INVALIDO');if(/(clave|contrase(n|ñ)a|password)/i.test(d.notas||''))return err('CLAVE_PROHIBIDA');
    if(d.valor_uf&&!(+d.valor_uf>0))return err('DATOS_INVALIDOS');
    Object.assign(c,{razon_social:d.razon_social||null,rut:rut||null,contacto:d.contacto||null,tel:d.tel||null,email:d.email||null,plan:d.plan||null,
      valor_uf:d.valor_uf?+d.valor_uf:null,gestion_laboral:!!d.gestion_laboral,valor_trab_uf:+d.valor_trab_uf||0.39,fecha_inicio:d.fecha_inicio||null,
      analista_contable_id:d.analista_contable_id?+d.analista_contable_id:null,analista_rrhh_id:d.analista_rrhh_id?+d.analista_rrhh_id:null,notas:d.notas||null,actualizado:ahora()});
    return ok(item(c));},
  onb_crear_cliente:function(a){var c=C.filter(function(x){return x.id===a.p_id;})[0];if(!c)return err('NO_EXISTE');if(c.estado!=='por_iniciar')return err('CASO_CERRADO');
    if(a.p_actualizado!==c.actualizado)return err('VERSION_CONFLICTO');if(faltan(c).length)return err('FALTAN_DATOS');
    Object.assign(c,{estado:'cliente_creado',cliente_id:sig++,actualizado:ahora(),cerrado_at:ahora()});return ok(item(c));},
  onb_descartar:function(a){var c=C.filter(function(x){return x.id===a.p_id;})[0];if(!c)return err('NO_EXISTE');var m=String(a.p_motivo||'').trim();
    if(m.length<5)return err('MOTIVO_OBLIGATORIO');Object.assign(c,{estado:'descartado',motivo_descarte:m,actualizado:ahora()});return ok(item(c));}
};
window.ComDemo.rpc=function(fn,a){return F[fn]?F[fn](a||{}):base(fn,a);};
})();
