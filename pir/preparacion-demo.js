/* ============================================================
   pir/preparacion-demo.js — MODO DEMOSTRACIÓN LOCAL de "Preparemos tu Renta 2027"
   Empresas, personas y cuentas 100 % FICTICIAS, con la MISMA FORMA que entregan las RPC prep_renta_*.
   Solo lo carga preparacion.html con ?demo=1 Y en localhost / 127.0.0.1 / [::1]. Nunca llama a Supabase; nada se guarda.
   ?rol=contable muestra la vista del analista (sus cambios quedan pendientes del Master).
   ============================================================ */
(function(){
  'use strict';
  var h=location.hostname;
  if(!(h==='localhost'||h==='127.0.0.1'||h==='[::1]'))return;   // candado 2
  document.documentElement.classList.remove('auth-pending');
  var MASTER=!/(?:^|[?&])rol=contable(?:&|$)/.test(location.search.slice(1));
  var CFG={periodo:'AT2027',abierto:true,planes:['asesoria','estrategico']};
  function f(id,rs,rut,plan,tanda,an,anId,estado,extra){return Object.assign({cliente_id:id,razon_social:rs,rut:rut,plan:plan,tanda:tanda,regimen:'14D3',analista_id:anId,analista_nombre:an,analista_iniciales:'AD',
    correo_ok:true,habilitado:tanda===1,estado:estado,codigo_pedido_at:null,actualizada_at:null,enviada_at:null,aplicada_at:null,aplicacion_pendiente:false,objetivos:[],n_socios:null},extra||{});}
  var FILAS=[
    f(5001,'Servicios Digitales Cordillera SpA','76111111-6','asesoria',1,'Analista Demo Uno',901,'respondido',{codigo_pedido_at:'2026-11-03T12:01:00Z',actualizada_at:'2026-11-03T12:20:00Z',enviada_at:'2026-11-03T12:20:00Z',claves_pendientes:1,claves_por_promover:2,clave_empresa_por_aprobar:true,objetivos:['menos','retiros'],n_socios:3}),
    f(5002,'Ferretería Los Aromos Ltda.','76222222-1','estrategico',1,'Analista Demo Dos',902,'en_curso',{codigo_pedido_at:'2026-11-03T15:00:00Z',actualizada_at:'2026-11-03T15:10:00Z',objetivos:['bancos']}),
    f(5003,'Panadería Volcán Osorno SpA','76333333-7','asesoria',1,'Analista Demo Uno',901,'codigo_pedido',{codigo_pedido_at:'2026-11-04T10:00:00Z'}),
    f(5004,'Taller Creativo Pehuén SpA','76444444-2','estrategico',1,'',null,'sin_enviar',{correo_ok:false,habilitado:false}),
    f(5005,'Transportes Llanquihue SpA','76555555-8','cumplimiento',2,'Analista Demo Dos',902,'sin_enviar'),
    f(5006,'Clínica Dental Alerce SpA','76666666-3','asesoria',1,'Analista Demo Dos',902,'respondido',{enviada_at:'2026-11-04T18:00:00Z',actualizada_at:'2026-11-04T18:00:00Z',aplicada_at:'2026-11-05T09:30:00Z',objetivos:['regimen']})
  ];
  var R1={id:801,estado:'enviada',version:3,actualizada_at:'2026-11-03T12:20:00Z',enviada_at:'2026-11-03T12:20:00Z',aplicada_at:null,reabierta_at:null,reabierta_motivo:null,
    datos:{paso:6,bloques:{empresa:'fix',contacto:'fix',cuenta_empresa:'fix',correo:'fix'},empresa_correccion:{razon_social:'',direccion:'Av. Ejemplo 200, oficina 31',comuna:'Ñuñoa',regimen:'Pro Pyme General'},
      contacto:{nombre:'Juana Demo Pérez',cargo:'Gerenta',rut:'9876543-3',wa:'+56 9 0000 0002'},correo_oficial:{correo:'juana@cordillera.example'},sii_empresa:{misma:'no'},
      socios:[{origen:'ficha',estado:'fix',rut:'12345678-5',nombre:'Socia Demo Uno',pct:50,sueldo:'si',otros_ingresos:[{tipo:'arriendos',monto_anual:4800000},{tipo:'honorarios',monto_anual:null}],otros_ninguno:false,tgr:'no',ahorro:['apv'],sii:{autoriza:false,canal:null,vigente:'entregada'}},
        {origen:'ficha',estado:'ok',rut:'11222333-9',nombre:'Socio Demo Dos',pct:40,sueldo:'no',otros_ingresos:[],otros_ninguno:true,tgr:'nose',ahorro:[],sii:{autoriza:false,canal:null,vigente:'pendiente'}},
        {origen:'nuevo',estado:'nuevo',rut:'15999888-6',nombre:'Socio Demo Tres',pct:10,sueldo:'no',otros_ingresos:[{tipo:'sueldo_otra',monto_anual:18000000}],otros_ninguno:false,tgr:'si',ahorro:['dividendo'],sii:{autoriza:false,canal:null,vigente:'entregada'}}],
      objetivos:{lista:['menos','retiros','inversion'],menos_foco:'ambos',retiros:[{rut:'12345678-5',monto:10000000}],inversion:{tipo:'Camioneta de reparto',monto:25000000,cuando:'Diciembre'},bancos:{credito:'',monto:null}},
      contexto:{ventas:'mas',eventos:['contratacion','prestamo_socio_empresa'],eventos_detalle:'Contratamos 2 personas en agosto.',retiros_hechos:'si',retiros_monto:3000000,comentarios:''},aceptacion_uso:true,declaracion:true},
    cuentas:[{id:1,titular:'empresa',titular_rut:'76111111-6',modo:'cuenta',banco:'BancoEstado',tipo:'corriente',ultimos4:'7890',direccion_sii:null},
      {id:2,titular:'socio',titular_rut:'12345678-5',modo:'cuenta',banco:'Santander',tipo:'vista',ultimos4:'7766',direccion_sii:null},
      {id:3,titular:'socio',titular_rut:'11222333-9',modo:'sin_cuenta',banco:null,tipo:null,ultimos4:null,direccion_sii:'cambio'}]};
  var CLI={id:5001,razon_social:'Servicios Digitales Cordillera SpA',rut:'76111111-6',plan:'asesoria',regimen:'14D3',estado:'activo',contacto:'Juan Demo',wa:'+56 9 0000 0001',
    email:'contacto@cordillera.example',direccion:'Calle Ejemplo 100',comuna:null,socios:[{rut:'12345678-5',nombre:'Socia Demo Uno',pct:60},{rut:'11222333-9',nombre:'Socio Demo Dos',pct:40}]};
  var APL=[], CTAS_FICHA=[];
  // Claves SII (paquete F2): SOLO metadatos, como prep_renta_claves_estado (nunca el valor ni el sobre).
  var CLAVES={empresa:{misma:'no',id:71,estado:'por_aprobar',entregada_at:'2026-11-03T12:18:00Z',expira_at:'2026-12-03T12:20:00Z',entregas:1,resuelta_at:null,registrada:true},
    socios:[{rut:'12345678-5',nombre:'Socia Demo Uno',id:72,estado:'por_aprobar',entregada_at:'2026-11-03T12:15:00Z',expira_at:'2026-12-03T12:20:00Z',entregas:2},{rut:'11222333-9',nombre:'Socio Demo Dos',estado:'pendiente',entregada_at:null},
      {rut:'15999888-6',nombre:'Socio Demo Tres',id:73,estado:'promovida',entregada_at:'2026-11-03T12:16:00Z',resuelta_at:'2026-11-04T09:00:00Z',entregas:1}],pendientes:1,por_promover:2};
  function comparar(){
    var d=R1.datos, out=[];
    function simple(k,et,bl,act,cl){var b=d.bloques[bl], c=(cl||'').trim()||null, a=act||null;
      var t=b==='ok'?'validado':!c?'sin_dato':!a?'nuevo':a.toLowerCase()===c.toLowerCase()?'igual':'corregido';out.push({clave:k,etiqueta:et,bloque:bl,actual:a,cliente:b==='ok'?null:c,tipo:t,aplicable:t==='nuevo'||t==='corregido'});}
    simple('razon_social','Razón social','empresa',CLI.razon_social,d.empresa_correccion.razon_social);simple('direccion','Dirección','empresa',CLI.direccion,d.empresa_correccion.direccion);
    simple('comuna','Comuna','empresa',CLI.comuna,d.empresa_correccion.comuna);simple('contacto','Responsable','contacto',CLI.contacto,d.contacto.nombre);simple('wa','WhatsApp del responsable','contacto',CLI.wa,d.contacto.wa);simple('email','Correo oficial','correo',CLI.email,d.correo_oficial.correo);
    out.push({clave:'regimen',etiqueta:'Régimen (según el cliente)',bloque:'empresa',actual:CLI.regimen,cliente:d.empresa_correccion.regimen,tipo:'informativo',aplicable:false});
    out.push({clave:'cargo',etiqueta:'Cargo del responsable',bloque:'contacto',actual:null,cliente:d.contacto.cargo,tipo:'informativo',aplicable:false});
    out.push({clave:'contacto_rut',etiqueta:'RUT del responsable',bloque:'contacto',actual:null,cliente:d.contacto.rut,tipo:'informativo',aplicable:false});
    var ruts={};CLI.socios.forEach(function(s){ruts[s.rut]={f:s};});d.socios.forEach(function(s){(ruts[s.rut]=ruts[s.rut]||{}).c=s;});
    Object.keys(ruts).sort().forEach(function(r){var x=ruts[r], t=!x.c?'quitado':!x.f?'nuevo':x.c.estado==='ok'?'validado':(x.f.nombre===x.c.nombre&&x.f.pct===x.c.pct)?'igual':'corregido';
      out.push({clave:'socio',etiqueta:'Socio',bloque:'socios',rut:r,actual:x.f?{nombre:x.f.nombre,pct:x.f.pct}:null,cliente:x.c?{nombre:x.c.nombre,pct:x.c.pct}:null,tipo:t,aplicable:t==='nuevo'||t==='corregido'||t==='quitado'});});
    R1.cuentas.forEach(function(k){var cf=CTAS_FICHA.filter(function(z){return z.titular_rut===k.titular_rut;})[0];
      var t=k.modo==='vigente'?'validado':k.modo==='sin_cuenta'?'informativo':!cf?'nuevo':(cf.ultimos4===k.ultimos4&&cf.banco===k.banco)?'igual':'corregido';
      out.push({clave:'cuenta',etiqueta:k.titular==='empresa'?'Cuenta de la empresa':'Cuenta del socio',bloque:'cuentas',titular:k.titular,rut:k.titular_rut,
        actual:cf?{banco:cf.banco,tipo:cf.tipo,ultimos4:cf.ultimos4}:null,cliente:{modo:k.modo,banco:k.banco,tipo:k.tipo,ultimos4:k.ultimos4,direccion_sii:k.direccion_sii},tipo:t,aplicable:t==='nuevo'||t==='corregido'});});
    return out;
  }
  function ejecutar(a){
    var foto=JSON.stringify([CLI,CTAS_FICHA]);
    try{ejecutar2(a);}catch(e){var x=JSON.parse(foto);Object.assign(CLI,x[0]);CTAS_FICHA=x[1];throw e;}   // todo o nada, como la RPC real
  }
  function ejecutar2(a){
    var cmp=comparar(), res=[];
    a.elecciones.forEach(function(e){var it=cmp.filter(function(x){return x.clave===e.campo&&(!e.rut||x.rut===e.rut);})[0];
      if(!it||!it.aplicable)throw new Error('RP_ELECCION_NO_APLICABLE');
      if(JSON.stringify(e.antes)!==JSON.stringify(it.actual==null?null:it.actual))throw new Error('RP_CONFLICTO');
      if(e.campo==='socio'){if(it.tipo==='quitado')CLI.socios=CLI.socios.filter(function(s){return s.rut!==e.rut;});else if(it.tipo==='nuevo')CLI.socios.push({rut:e.rut,nombre:it.cliente.nombre,pct:it.cliente.pct});
        else CLI.socios.forEach(function(s){if(s.rut===e.rut){s.nombre=it.cliente.nombre;s.pct=it.cliente.pct;}});}
      else if(e.campo==='cuenta'){var k=R1.cuentas.filter(function(z){return z.titular_rut===e.rut;})[0];CTAS_FICHA=CTAS_FICHA.filter(function(z){return z.titular_rut!==e.rut;});
        CTAS_FICHA.push({id:CTAS_FICHA.length+50,titular:k.titular,titular_rut:k.titular_rut,titular_nombre:null,banco:k.banco,tipo:k.tipo,ultimos4:k.ultimos4,actualizado_at:new Date().toISOString()});}
      else CLI[e.campo]=it.cliente;
      res.push({campo:e.campo,rut:e.rut,antes:it.actual,despues:e.campo==='cuenta'?'••••'+it.cliente.ultimos4:it.cliente});});
    var suma=CLI.socios.reduce(function(s,x){return s+x.pct;},0);if(Math.abs(suma-100)>0.01)throw new Error('RP_SOCIOS_NO_SUMAN_100');
    a.estado='APLICADA';a.resultado=res;a.resuelta_por='Luciano (demo)';a.resuelta_at=new Date().toISOString();R1.aplicada_at=a.resuelta_at;FILAS[0].aplicada_at=a.resuelta_at;FILAS[0].aplicacion_pendiente=false;
  }
  var copia=function(x){return JSON.parse(JSON.stringify(x));};
  var demora=function(v){return new Promise(function(ok){setTimeout(function(){ok(copia(v));},250);});};
  var falla=function(m){return new Promise(function(_,no){setTimeout(function(){no(new Error(m));},200);});};
  window.PR_DEMO_API={edge:function(fn,b){   // demo de la Edge renta-cuenta-ver (números ficticios)
    if(fn!=='renta-cuenta-ver')return falla('ACCION_DESCONOCIDA');
    return demora({ok:true,numero:b.origen==='ficha'?'000011112222':({1:'000012347890',2:'00998877766'}[b.cuenta_id]||'0000')});
  },rpc:function(fn,a){
    try{
      switch(fn){
        case 'prep_renta_cartera':return demora({periodo:CFG.periodo,abierto:CFG.abierto,planes:CFG.planes,es_master:MASTER,yo:901,filas:MASTER?FILAS:FILAS.filter(function(x){return x.analista_id===901;})});
        case 'prep_renta_detalle':
          if(+a.p_cliente_id!==5001){var fx=FILAS.filter(function(x){return x.cliente_id===+a.p_cliente_id;})[0];if(!fx)return falla('SIN_PERMISO');
            return demora({es_master:MASTER,periodo:'AT2027',cliente:{id:fx.cliente_id,razon_social:fx.razon_social,rut:fx.rut,plan:fx.plan,regimen:fx.regimen,socios:[]},cuentas_ficha:[],respuesta:null,comparacion:[],aplicaciones:[],codigos:{n:fx.codigo_pedido_at?1:0,ultimo_at:fx.codigo_pedido_at,ultimo_envio:fx.codigo_pedido_at?'enviado':null}});}
          return demora({es_master:MASTER,periodo:'AT2027',cliente:CLI,cuentas_ficha:CTAS_FICHA,respuesta:R1,comparacion:comparar(),claves:CLAVES,aplicaciones:APL,codigos:{n:1,ultimo_at:'2026-11-03T12:01:00Z',ultimo_envio:'enviado'}});

        case 'prep_renta_aplicar':
          if(APL.some(function(x){return x.estado==='PENDIENTE';}))return falla('RP_APLICACION_PENDIENTE');
          var ap={id:APL.length+1,estado:'PENDIENTE',elecciones:a.p_elecciones,motivo:a.p_motivo,solicitada_por:MASTER?'Luciano (demo)':'Analista Demo Uno',solicitada_at:new Date().toISOString(),resultado:null};
          if(MASTER){ejecutar(ap);APL.unshift(ap);return demora({ok:true,aplicacion_id:ap.id,estado:'APLICADA',cambios:ap.resultado});}
          APL.unshift(ap);FILAS[0].aplicacion_pendiente=true;return demora({ok:true,aplicacion_id:ap.id,estado:'PENDIENTE'});
        case 'prep_renta_resolver_aplicacion':
          var p=APL.filter(function(x){return x.id===a.p_aplicacion_id&&x.estado==='PENDIENTE';})[0];if(!p)return falla('RP_APLICACION_NO_PENDIENTE');
          if(a.p_aprobar)ejecutar(p);else{p.estado='RECHAZADA';p.resuelta_por='Luciano (demo)';p.resuelta_at=new Date().toISOString();p.resolucion_motivo=a.p_motivo;FILAS[0].aplicacion_pendiente=false;}
          return demora({ok:true});
        case 'prep_renta_clave_descartar':if(!MASTER)return falla('SIN_PERMISO');if(!a.p_motivo||a.p_motivo.length<5)return falla('RP_MOTIVO_REQUERIDO');
          var kk=[CLAVES.empresa].concat(CLAVES.socios).filter(function(x){return x.id===+a.p_id;})[0];if(!kk)return falla('RP_CLAVE_NO_EXISTE');
          if(kk.estado!=='recibida'&&kk.estado!=='por_aprobar')return falla('RP_CLAVE_NO_DESCARTABLE');kk.estado='descartada';kk.resuelta_at=new Date().toISOString();
          CLAVES.por_promover=[CLAVES.empresa].concat(CLAVES.socios).filter(function(x){return x.estado==='por_aprobar';}).length;FILAS[0].claves_por_promover=CLAVES.por_promover;
          FILAS[0].clave_empresa_por_aprobar=CLAVES.empresa.estado==='por_aprobar';return demora({ok:true});
        case 'prep_renta_reabrir':if(!a.p_motivo||a.p_motivo.length<5)return falla('RP_MOTIVO_REQUERIDO');R1.estado='borrador';R1.reabierta_at=new Date().toISOString();R1.reabierta_motivo=a.p_motivo;FILAS[0].estado='en_curso';return demora({ok:true});
        case 'prep_renta_config_fijar':if(!a.p_motivo||a.p_motivo.length<5)return falla('RP_MOTIVO_REQUERIDO');if(!a.p_planes.length)return falla('RP_CONFIG_INVALIDA');CFG.abierto=a.p_abierto;CFG.planes=a.p_planes;return demora({ok:true});
      }
      return falla('ACCION_DESCONOCIDA');
    }catch(e){return falla(e.message);}
  }};
})();
