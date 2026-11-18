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
   fecha_inicio:new Date().toLocaleDateString('en-CA'),analista_contable_id:5,analista_rrhh_id:null,notas:null,cliente_id:null,creado_at:new Date(Date.now()-864e5).toISOString(),actualizado:ahora(),responsable:'Usuario Demo'}];
function faltan(c){var f=[];if(!c.razon_social)f.push('razon_social');if(!c.rut)f.push('rut');if(!c.plan)f.push('plan');if(!c.valor_uf)f.push('valor_uf');
  if(!c.fecha_inicio)f.push('fecha_inicio');if(!c.analista_contable_id)f.push('analista_contable');if(c.gestion_laboral&&!c.analista_rrhh_id)f.push('analista_rrhh');return f;}
function item(c){var x=JSON.parse(JSON.stringify(c));x.faltan=faltan(c);return x;}
function ok(v){return new Promise(function(r){setTimeout(function(){r(JSON.parse(JSON.stringify(v)));},120);});}
function err(code){return new Promise(function(_,j){setTimeout(function(){j(new Error(code));},120);});}
function rutOk(r){if(!/^[0-9]{7,8}-[0-9K]$/.test(r))return false;var n=r.split('-')[0],s=0,m=2;for(var i=n.length-1;i>=0;i--){s+=+n[i]*m;m=m===7?2:m+1;}var v=11-s%11;return (v===11?'0':v===10?'K':String(v))===r.split('-')[1];}
var F={
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
