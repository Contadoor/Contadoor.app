/* prospectos/onboarding-demo.js — MODO DEMOSTRACIÓN de Onboarding L1/L2/V2 (datos 100 % ficticios, solo localhost).
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
// ── V2 (23-11): lista 2 = 10 pasos en dos tramos desde la ACEPTACIÓN (mismas reglas que la base: «listo» pide fecha o enlace https;
//    requisitos previos; «esperando al cliente» sigue contando plazo). Caso 4: aceptó hoy (por iniciar). Caso 5: aceptó hace 4 días, cliente creado.
var FER=['2026-12-08','2026-12-25','2027-01-01','2027-03-26','2027-03-27','2027-05-01','2027-05-21','2027-06-21','2027-06-28','2027-07-16','2027-08-15',
  '2027-09-17','2027-09-18','2027-09-19','2027-10-11','2027-10-31','2027-11-01','2027-12-08','2027-12-25'];
function sumar(y,n){var p=String(y).split('-');return new Date(Date.UTC(+p[0],+p[1]-1,+p[2]+n,12)).toISOString().slice(0,10);}
function habil(y){var w=new Date(y+'T12:00:00Z').getUTCDay();return w!==0&&w!==6&&FER.indexOf(y)<0;}
function habiles(y,n){var x=y,k=0;while(k<n){x=sumar(x,1);if(habil(x))k++;}return x;}
function hoyY(){return new Date().toLocaleDateString('en-CA',{timeZone:'America/Santiago'});}
function difD(a,b){return Math.round((Date.parse(a+'T12:00:00Z')-Date.parse(b+'T12:00:00Z'))/864e5);}
var CAT2=[ // paso, clave, título, tramo, responsable(s), texto, plazo, tipo, manual_listo, no_aplica, requiere
  [1,'acepto','Aceptó la propuesta (se abre el onboarding)',1,['comercial'],'Comercial',0,'corridos',0,0,null],
  [2,'bienvenida','Carta de bienvenida con plan de trabajo, solicitud de información y factura de activación',1,['comercial'],'Comercial',0,'corridos',1,0,null],
  [3,'reunion_agendada','Reunión de entrega del diagnóstico agendada',1,['comercial'],'Comercial',0,'corridos',1,0,'fecha'],
  [4,'pago','Pago recibido (conciliado)',1,['pagos'],'Pagos',1,'corridos',0,0,null],
  [5,'claves_balances','Claves de acceso y balances anteriores recibidos',1,['comercial'],'Comercial',1,'corridos',1,0,null],
  [6,'cliente_creado','Cliente creado: ficha, carpeta de respaldo y analistas asignados',1,['comercial','master'],'Comercial + Master',1,'corridos',1,0,null],
  [7,'cartapra_obs','Conectado a Cartapra y observaciones del SII revisadas (aviso al analista o propuesta de regularización)',1,['comercial'],'Comercial',2,'corridos',1,0,null],
  [8,'micontadoor','Acceso a MiContadoor creado con el cliente',1,['comercial'],'Comercial',3,'corridos',0,1,null],
  [9,'diagnostico','Diagnóstico contable «Aquí partimos» emitido (firma Contadoor + analista a cargo)',2,['contable'],'Analista',5,'habiles',1,0,'enlace'],
  [10,'reunion_entrega','Reunión de entrega del diagnóstico realizada → cliente activo',2,['comercial','contable'],'Comercial + Analista',7,'habiles',1,0,'fecha']];
var V2={4:{base:hoyY(),marcas:{},act:null,
           auto:{1:['listo','Aceptó hoy · prospecto #204'],2:['pendiente','La factura de activación se emite al crear el cliente, el mismo día de la aceptación',0,'Primero se emite la factura de activación (Facturación)'],
                 4:['pendiente','Se marca solo cuando Pagos concilia el pago en Conciliación'],5:['pendiente','Las claves se guardan en la bóveda de la ficha, después de crear el cliente',0,'Las claves se guardan en la bóveda de la ficha, después de crear el cliente'],
                 6:['pendiente','Completa la ficha de onboarding y crea el cliente',0,'Primero crea el cliente con sus analistas asignados'],7:['pendiente','Se conecta desde la ficha del cliente (Cartapra)',0,'Primero conecta el SII (Cartapra) desde la ficha del cliente'],
                 8:['pendiente','Se crea desde la ficha del cliente, después de crearlo']}},
        5:{base:sumar(hoyY(),-4),marcas:{5:{estado:'bloqueado_cliente',motivo:'Falta el balance 2025 del contador anterior',actualizado:'2026-01-01T00:00:00Z#5'}},act:null,
           auto:{1:['listo','Aceptó hace 4 días · prospecto #205'],2:['en_curso','Factura de activación folio 1001 emitida el mismo día; marca «listo» al enviar la carta con el plan de trabajo y la solicitud de información'],
                 3:['listo','En la agenda: reunión de entrega en 3 días'],4:['listo','Pago conciliado'],5:['en_curso','Claves en la bóveda; marca «listo» al recibir los balances anteriores'],
                 6:['en_curso','Ficha creada con analista contable; marca «listo» al crear la carpeta de respaldo'],7:['en_curso','1 F29 por revisar; marca «listo» al avisar al analista o enviar la propuesta de regularización'],
                 8:['en_curso','Invitación enviada; falta que el cliente entre'],9:['pendiente','Se marca con el enlace del diagnóstico emitido (firma Contadoor + analista a cargo)'],10:['pendiente','Se marca con la fecha en que se realizó la reunión de entrega']}}};
function evaluar2(id){
  var K=V2[id],cs=C.filter(function(x){return x.id===id;})[0],hoy=hoyY(),listos=0,pend=0,venc=0,vcli=0,est={},tl=[0,0],tt=[0,0];
  var tv=[sumar(K.base,3),habiles(K.base,7)],cerr=!!K.act;
  var pasos=CAT2.map(function(k){var a=K.auto[k[0]]||['pendiente',null],m=K.marcas[k[0]],fin=(a[0]==='listo'||a[0]==='no_aplica')?a[0]:(m?m.estado:a[0]);
    var puede=!!k[8]&&a[2]!==0,falta=a[3]||null;
    if(k[0]===10&&est[9]!=='listo'){puede=false;falta='Primero se emite el diagnóstico (paso 9)';}
    if(fin==='listo'||fin==='no_aplica'){puede=false;falta=null;}
    var evid=a[1];if(k[0]===9&&fin==='listo')evid='Diagnóstico emitido';if(k[0]===10&&fin==='listo'&&m)evid='Reunión de entrega realizada el '+String(m.fecha||'').slice(8,10)+'-'+String(m.fecha||'').slice(5,7);
    var vence=k[7]==='habiles'?habiles(K.base,k[6]):sumar(K.base,k[6]),atr=(fin==='listo'||fin==='no_aplica'||cerr)?0:Math.max(0,difD(hoy,vence)),acli=atr>0&&fin==='bloqueado_cliente';
    est[k[0]]=fin;if(fin==='listo'||fin==='no_aplica'){listos++;tl[k[3]-1]++;}else pend++;tt[k[3]-1]++;if(atr>0&&!acli)venc++;if(acli)vcli++;
    return {paso:k[0],clave:k[1],titulo:k[2],tramo:k[3],responsable:k[4][0],responsables:k[4],responsable_txt:k[5],plazo_dias:k[6],plazo_tipo:k[7],vence:vence,obligatorio:true,
      manual_listo:!!k[8],permite_no_aplica:!!k[9],requiere:k[10],estado:fin,estado_auto:a[0],fuente:m&&a[0]!=='listo'?'manual':'auto',evidencia:evid,dias_atraso:atr,atraso_cliente:acli,
      puede_listo:puede,falta_para_listo:falta,marca:m?{estado:m.estado,motivo:m.motivo||null,fecha:m.fecha||null,enlace:m.enlace||null,actualizado:m.actualizado,por:'Usuario Demo'}:null};});
  function hr(v){if(hoy>=v)return 0;var n=0,x=hoy;while(x<v){x=sumar(x,1);if(habil(x))n++;}return n;}
  function tr(i,nom,pl){var e=tl[i]===tt[i]?'cumplido':cerr?'cerrado':hoy>tv[i]?'vencido':'a_tiempo';
    var o={tramo:i+1,nombre:nom,plazo:pl,vence:tv[i],listos:tl[i],total:tt[i],dias_restantes:difD(tv[i],hoy),estado:e};if(i===1)o.habiles_restantes=hr(tv[i]);return o;}
  var creado=cs.estado==='cliente_creado';
  return {caso_id:id,lista_version:2,estado_caso:cs.estado,lead_id:cs.lead_id,actualizado:cs.actualizado,razon_social:cs.razon_social,cliente_id:cs.cliente_id,
    cliente_estado:creado?(K.act?'activo':'onboarding'):null,inicio:K.base,activado_at:K.act,activado_por:K.act?'Usuario Demo':null,fecha_reunion:id===5?sumar(hoy,3):null,calendario_ok:true,
    tramos:[tr(0,'Activación','3 días corridos'),tr(1,'Diagnóstico','7 días hábiles')],
    resumen:{listos:listos,total:10,obligatorios_pendientes:pend,vencidos:venc,vencidos_cliente:vcli},
    listo_para_activar:creado&&!K.act&&pend===0,puede_activar:creado&&!K.act&&pend===0,pasos:pasos,
    yo:{id:1,nombre:'Usuario Demo',master:true,comercial:true,areas:['comercial','master','contable','rrhh','pagos','facturacion']}};}
function marcar2(a){var K=V2[a.p_caso_id];if(!K)return err('NO_EXISTE');if(K.act)return err('CASO_CERRADO');
  var k=CAT2.filter(function(x){return x[0]===a.p_paso;})[0];if(!k)return err('PASO_INVALIDO');
  var e=evaluar2(a.p_caso_id),p=e.pasos[k[0]-1],mot=String(a.p_motivo||'').trim(),m=K.marcas[k[0]],en=String(a.p_enlace||'').trim();
  if(a.p_estado==='listo'&&!k[8])return err('PASO_AUTOMATICO');if(a.p_estado==='no_aplica'&&!k[9])return err('NO_APLICA_NO_PERMITIDO');
  if((a.p_estado==='no_aplica'||a.p_estado==='bloqueado_cliente')&&mot.length<5)return err('MOTIVO_OBLIGATORIO');
  if(/(clave|contrase(n|ñ)a|password)\s*[:=]/i.test(mot+' '+en))return err('CLAVE_PROHIBIDA');
  if((a.p_fecha&&(a.p_estado!=='listo'||k[10]!=='fecha'))||(en&&(a.p_estado!=='listo'||k[10]!=='enlace')))return err('DATOS_INVALIDOS');
  if(a.p_estado==='listo'&&k[10]==='fecha'&&!a.p_fecha)return err('FALTA_FECHA');
  if(a.p_fecha&&(a.p_fecha<K.base||(k[0]===10&&a.p_fecha>hoyY())))return err('FECHA_INVALIDA');
  if(a.p_estado==='listo'&&k[10]==='enlace'&&!en)return err('FALTA_ENLACE');if(en&&!/^https:\/\/[^\s<>"]+$/.test(en))return err('ENLACE_INVALIDO');
  if((p.estado_auto==='listo'||p.estado_auto==='no_aplica')&&a.p_estado!=='pendiente')return err('PASO_YA_LISTO');
  if(a.p_estado==='listo'&&!p.puede_listo)return err('FALTA_REQUISITO');
  if((m?m.actualizado:null)!==(a.p_version||null))return err('VERSION_CONFLICTO');
  if(a.p_estado==='pendiente')delete K.marcas[k[0]];else K.marcas[k[0]]={estado:a.p_estado,motivo:mot.length>=5?mot:null,fecha:a.p_fecha||null,enlace:en||null,actualizado:ahora()+'#'+k[0]};
  return ok(evaluar2(a.p_caso_id));}
C.push({id:4,lead_id:204,estado:'por_iniciar',lead:{nombre:'Tomás Fuentes',empresa:'Cafetería El Molino SpA',rut:null,email:'tomas@ejemplo.test',tel:'+56 9 5555 1234',plan_interes:'pro',n_trabajadores:2,situacion:'Quiero saber cómo parto.'},
   razon_social:'Cafetería El Molino SpA',rut:null,contacto:'Tomás Fuentes',email:'tomas@ejemplo.test',tel:'+56 9 5555 1234',plan:'pro',valor_uf:null,gestion_laboral:true,valor_trab_uf:0.39,
   fecha_inicio:null,analista_contable_id:null,analista_rrhh_id:null,notas:null,cliente_id:null,creado_at:new Date(Date.now()-36e5).toISOString(),actualizado:ahora(),responsable:'Usuario Demo'},
  {id:5,lead_id:205,estado:'cliente_creado',lead:{nombre:'Josefa Herrera',empresa:'Taller Herrera Ltda.',rut:'77777777-7',email:'josefa@ejemplo.test',tel:'+56 9 4444 9876',plan_interes:'cumplimiento',n_trabajadores:0,situacion:'Tengo observaciones en el SII.'},
   razon_social:'Taller Herrera Ltda.',rut:'77777777-7',contacto:'Josefa Herrera',email:'josefa@ejemplo.test',tel:'+56 9 4444 9876',plan:'cumplimiento',valor_uf:1.5,gestion_laboral:false,valor_trab_uf:0.39,
   fecha_inicio:sumar(hoyY(),-4),analista_contable_id:5,analista_rrhh_id:null,notas:null,cliente_id:5002,creado_at:new Date(Date.now()-864e5*4).toISOString(),actualizado:ahora(),responsable:'Usuario Demo'});
function tab2(id){var e=evaluar2(id);return {caso_id:id,razon_social:e.razon_social,cliente_id:e.cliente_id,inicio:e.inicio,activado_at:e.activado_at,resumen:e.resumen,
  listo_para_activar:e.listo_para_activar,lista_version:2,estado_caso:e.estado_caso,tramos:e.tramos,calendario_ok:true};}
var F={
  onb_tablero:function(){var e=evaluar();return ok({casos:[{caso_id:3,razon_social:e.razon_social,cliente_id:5001,inicio:e.inicio,activado_at:e.activado_at,resumen:e.resumen,listo_para_activar:e.listo_para_activar,lista_version:1,estado_caso:'cliente_creado'}]
    .concat(C.filter(function(x){return V2[x.id]&&x.estado!=='descartado';}).map(function(x){return tab2(x.id);}))});},
  onb_pasos:function(a){return a.p_caso_id===3?ok(Object.assign(evaluar(),{lista_version:1})):V2[a.p_caso_id]?ok(evaluar2(a.p_caso_id)):err('NO_EXISTE');},
  onb_paso_marcar_v2:function(a){return V2[a.p_caso_id]?marcar2(a):F.onb_paso_marcar(a);},
  onb_paso_marcar:function(a){if(a.p_caso_id!==3)return err('NO_EXISTE');if(ACT)return err('CASO_CERRADO');
    var k=CAT.filter(function(x){return x[0]===a.p_paso;})[0];if(!k)return err('PASO_INVALIDO');var au=AUTO[k[0]][0],m=MARCAS[k[0]],mot=String(a.p_motivo||'').trim();
    if(a.p_estado==='listo'&&!k[5])return err('PASO_AUTOMATICO');if(a.p_estado==='no_aplica'&&!k[6])return err('NO_APLICA_NO_PERMITIDO');
    if((a.p_estado==='no_aplica'||a.p_estado==='bloqueado_cliente')&&mot.length<5)return err('MOTIVO_OBLIGATORIO');
    if(/(clave|contrase(n|ñ)a|password)\s*[:=]/i.test(mot))return err('CLAVE_PROHIBIDA');
    if((au==='listo'||au==='no_aplica')&&a.p_estado!=='pendiente')return err('PASO_YA_LISTO');
    if((m?m.actualizado:null)!==(a.p_version||null))return err('VERSION_CONFLICTO');
    if(a.p_estado==='pendiente')delete MARCAS[k[0]];else MARCAS[k[0]]={estado:a.p_estado,motivo:mot.length>=5?mot:null,actualizado:ahora()+'#'+k[0]};
    return ok(evaluar());},
  onb_activar:function(a){if(V2[a.p_caso_id]){var c2=C.filter(function(x){return x.id===a.p_caso_id;})[0],e2=evaluar2(a.p_caso_id);if(a.p_actualizado!==c2.actualizado)return err('VERSION_CONFLICTO');
    if(V2[a.p_caso_id].act)return err('CASO_CERRADO');if(!e2.listo_para_activar)return err('FALTAN_PASOS');V2[a.p_caso_id].act=ahora();c2.actualizado=ahora();return ok(evaluar2(a.p_caso_id));}
    var e=evaluar();if(a.p_actualizado!==C[2].actualizado)return err('VERSION_CONFLICTO');if(ACT)return err('CASO_CERRADO');
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
    Object.assign(c,{estado:'cliente_creado',cliente_id:sig++,actualizado:ahora(),cerrado_at:ahora()});
    if(V2[c.id]){var au=V2[c.id].auto;au[6]=['en_curso','Ficha creada con analista contable; marca «listo» al crear la carpeta de respaldo'];au[5]=['pendiente','Falta en la bóveda: clave del SII',0,'Primero guarda en la bóveda: clave del SII'];
      au[2]=['pendiente','Falta emitir la factura de activación (el mismo día de la aceptación) y enviar la carta',0,'Primero se emite la factura de activación (Facturación)'];au[7]=['pendiente','Se conecta desde la ficha del cliente (Cartapra)',0,'Primero conecta el SII (Cartapra) desde la ficha del cliente'];au[8]=['pendiente','Crea el acceso desde la ficha del cliente (MiContadoor), junto al cliente'];}
    return ok(item(c));},
  onb_descartar:function(a){var c=C.filter(function(x){return x.id===a.p_id;})[0];if(!c)return err('NO_EXISTE');var m=String(a.p_motivo||'').trim();
    if(m.length<5)return err('MOTIVO_OBLIGATORIO');Object.assign(c,{estado:'descartado',motivo_descarte:m,actualizado:ahora()});return ok(item(c));}
};
window.ComDemo.rpc=function(fn,a){return F[fn]?F[fn](a||{}):base(fn,a);};
})();
