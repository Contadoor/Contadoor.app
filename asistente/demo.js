/* ============================================================
   asistente/demo.js — MODO DEMO SOLO LOCAL de la bandeja del Asistente IA
   Se activa ÚNICAMENTE si el host es localhost / 127.0.0.1 y la URL trae ?demo=1.
   En cualquier otro caso (gestoor.contadoor.cl incluido) este archivo no hace nada.
   - Todos los datos son FICTICIOS (nombres inventados, teléfonos 0000).
   - No hace ninguna llamada de red: simula E4 y la RPC de contadores en memoria.
   - Va ANTES de supabase.js: marca el SDK como "listo" con un cliente de mentira
     para que auth.js muestre la página sin sesión real (no hay JWT: ninguna
     consulta real a Supabase puede salir desde este modo).
   ============================================================ */
(function(){
  var h=location.hostname;
  var esLocal=(h==='localhost'||h==='127.0.0.1');
  var pideDemo=/(?:^|[?&])demo=1(?:&|$)/.test(location.search.slice(1));
  if(!esLocal||!pideDemo) return;

  var YO='00000000-0000-4000-8000-000000000001';
  var OTRA='00000000-0000-4000-8000-000000000002';
  var perfilDemo={id:0,nombre:'Usuario Demo',iniciales:'UD',rol:'master',rol_label:'Master (demo)',es_master:true,activo:true,modulos:[],wa:'',email:'demo@ejemplo.invalid'};

  // Cliente de Auth de mentira (solo lo que auth.js usa). Sin token: sbFetch nunca sale a la red.
  window._sbAuthReady=true;
  window._sbAuthClient={
    auth:{
      getUser:function(){return Promise.resolve({data:{user:{id:YO,email:perfilDemo.email}},error:null});},
      getSession:function(){return Promise.resolve({data:{session:{user:{id:YO}}}});},
      onAuthStateChange:function(){},
      signOut:function(){return Promise.resolve();}
    },
    from:function(){var q={select:function(){return q;},eq:function(){return q;},single:function(){return Promise.resolve({data:perfilDemo,error:null});}};return q;}
  };
  // Otros scripts compartidos (p. ej. notificaciones) piden datos sin sesión: en demo no se cierra la "sesión".
  window.addEventListener('gestoor-session-required',function(e){e.stopImmediatePropagation();},true);

  // ── Datos ficticios ──────────────────────────────────────────────────────
  function hace(min){return new Date(Date.now()-min*60000).toISOString();}
  function uid(n){return '00000000-0000-4000-9000-'+String(n).padStart(12,'0');}
  var seq=100;
  var convs=[
    {id:uid(1),estado:'humano',tomada_por:YO,modo:'prospecto',plan_cliente:null,opt_out:false,opt_out_posible:false,sellada:false,en_duda:true,etapa:'cambio_contador',
     tel:'+56900001937',ficha:{nombre:'Carolina',empresa:'Estudio Norte (ficticio)',rubro:'Arquitectura',antiguedad_mas_1_anio:true,n_trabajadores:3,tiene_contador:true,busca_cambiar_contador:true,problema_concreto:'Notificación del SII'},
     origen:{canal:'whatsapp',material:'Guía Gastos PYME',material_entregado:'Gastos PYME v1'},consultas:2,
     mensajes:[
       ['entrante','persona','texto','Hola, quiero la guía de gastos PYME',40,null],
       ['saliente','sistema','material','Guía de gastos PYME (PDF)',39,'entregado'],
       ['saliente','ia','texto','¡Hola! Ahí te dejé la guía. Cuéntame, ¿ya tienes una empresa funcionando o estás viendo cómo partir?',38,'leido'],
       ['entrante','persona','texto','Tengo un estudio de arquitectura hace 4 años. Mi contador no me avisa nada y me llegó una notificación del SII',36,null],
       ['saliente','ia','texto','Entiendo que eso inquiete. Una notificación del SII no siempre es grave, pero conviene revisarla pronto. ¿Sabes a qué formulario se refiere?',34,'incierto','incierto'],
       ['entrante','persona','texto','¿Y eso cuánto me saldría al mes? <b>prueba de escape</b>',2,null]
     ],
     eventos:[['conversacion_creada',40,{}],['derivada_a_humano',3,{motivo:'pidio_precio'}],['conversacion_tomada',2.5,{desde:'esperando_humano'}]]},
    {id:uid(2),estado:'esperando_humano',tomada_por:null,modo:'prospecto',plan_cliente:null,opt_out:false,opt_out_posible:false,sellada:false,en_duda:false,etapa:null,
     tel:'+56900004521',ficha:{nombre:'Juan Pablo'},origen:{canal:'whatsapp'},consultas:0,
     mensajes:[['entrante','persona','texto','Hola, tengo dudas con mi empresa',15,null],['saliente','ia','texto','¡Hola! Qué bueno que nos escribes. ¿Qué estás tratando de resolver?',14,'leido'],['entrante','persona','texto','Prefiero hablar con alguien del equipo',11,null]],
     eventos:[['conversacion_creada',15,{}],['derivada_a_humano',11,{motivo:'pidio_persona'}]]},
    {id:uid(3),estado:'esperando_humano',tomada_por:null,modo:'prospecto',plan_cliente:null,opt_out:false,opt_out_posible:true,sellada:false,en_duda:false,etapa:null,
     tel:'+56900004410',ficha:{nombre:'Valentina',rubro:'Comercio',tiene_contador:null},origen:{canal:'whatsapp',material:'Guía IVA sin errores',material_entregado:'IVA sin errores v1'},consultas:0,
     mensajes:[['entrante','persona','texto','Hola, ¿me mandan la guía de IVA?',60,null],['saliente','sistema','material','Guía IVA sin errores (PDF)',59,'entregado'],['saliente','ia','texto','¡Hola! Te dejé la guía. ¿Llevas tú el IVA de tu negocio o lo ve un contador?',58,'entregado'],['entrante','persona','texto','Ya no me interesa, olvídense de mí',18,null]],
     eventos:[['conversacion_creada',60,{}],['opt_out_posible',18,{}]],bajaIdx:3},
    {id:uid(4),estado:'ia',tomada_por:null,modo:'cliente',plan_cliente:'cumplimiento',opt_out:false,opt_out_posible:false,sellada:false,en_duda:true,etapa:null,
     tel:'+56900007788',ficha:{nombre:'Andrea',empresa:'Panadería Sol (ficticia)'},origen:{canal:'whatsapp'},consultas:1,
     mensajes:[['entrante','persona','texto','¿Me pueden mandar la guía de nuevo?',25,null],['saliente','ia','texto','¡Claro! Te la reenvío ahora mismo.',24,'incierto','incierto']],
     eventos:[['conversacion_creada',300,{}]]},
    {id:uid(5),estado:'esperando_humano',tomada_por:null,modo:'prospecto',plan_cliente:null,opt_out:false,opt_out_posible:false,sellada:false,en_duda:false,etapa:null,
     tel:'+56900000056',ficha:{},origen:{canal:'whatsapp'},consultas:0,
     mensajes:[['entrante','persona','texto','Hola, quiero información',40,null]],eventos:[['conversacion_creada',40,{}],['derivada_a_humano',40,{motivo:'fuera_del_piloto'}]]},
    {id:uid(6),estado:'ia',tomada_por:null,modo:'prospecto',plan_cliente:null,opt_out:false,opt_out_posible:false,sellada:false,en_duda:false,etapa:'agenda',
     tel:'+56900003321',ficha:{nombre:'Matías',empresa:'Agencia Lumen (ficticia)'},origen:{canal:'whatsapp'},consultas:1,
     mensajes:[['entrante','persona','texto','¿Tienen hora para el jueves?',70,null],['saliente','ia','texto','Sí, te dejo el enlace para reservar la reunión de diagnóstico.',69,'leido'],['entrante','persona','texto','¡Listo! Ya reservé para el jueves',60,null]],
     eventos:[['conversacion_creada',80,{}]]},
    {id:uid(7),estado:'humano',tomada_por:OTRA,modo:'prospecto',plan_cliente:null,opt_out:false,opt_out_posible:false,sellada:false,en_duda:false,etapa:null,
     tel:'+56900009012',ficha:{nombre:'Rodrigo'},origen:{canal:'whatsapp'},consultas:0,
     mensajes:[['entrante','persona','texto','Necesito ayuda con mis cotizaciones',120,null],['saliente','humano','texto','Hola Rodrigo, te ayudo con eso. ¿Cuántos trabajadores tienes?',110,'entregado']],
     eventos:[['conversacion_creada',125,{}],['conversacion_tomada',115,{desde:'esperando_humano'}]]},
    {id:uid(8),estado:'cerrada',tomada_por:null,modo:'prospecto',plan_cliente:null,opt_out:true,opt_out_posible:false,sellada:false,en_duda:false,etapa:null,
     tel:'+56900006655',ficha:{nombre:'Sofía'},origen:{canal:'whatsapp'},consultas:0,
     mensajes:[['entrante','persona','texto','No me escriban más, gracias',1500,null],['saliente','sistema','plantilla','Listo, no te enviaremos más mensajes. Si cambias de opinión, escríbenos.',1499,'entregado']],
     eventos:[['conversacion_creada',1600,{}],['opt_out',1500,{origen:'deterministico'}]]},
    {id:uid(9),estado:'cerrada',tomada_por:null,modo:'prospecto',plan_cliente:null,opt_out:false,opt_out_posible:false,sellada:true,en_duda:false,etapa:null,
     tel:null,ficha:{},origen:{},consultas:0,
     mensajes:[['entrante','persona','texto',null,3000,null]],eventos:[['conversacion_suprimida',2900,null]]}
  ];
  // Materializa mensajes y envíos con ids.
  convs.forEach(function(c){
    c.last_activity_at=hace(c.mensajes[c.mensajes.length-1][4]);
    c.msgs=c.mensajes.map(function(m,i){
      var id=uid(1000+(seq++));
      var o={id:id,direccion:m[0],autor:m[1],tipo:m[2],texto:m[3],estado_entrega:m[5],suprimido:!!c.sellada,no_descifra:false,created_at:hace(m[4]),envio:null};
      if(m[0]==='saliente'&&m[1]!=='persona') o.envio={id:uid(5000+(seq++)),tipo:m[1]==='humano'?'humano':(m[1]==='sistema'?(m[2]==='material'?'material':'opt_out_confirmacion'):'respuesta_ia'),estado:m[6]||'enviado',motivo:null,programado_para:null};
      if(c.sellada){o.texto=null;}
      return o;
    });
    c.opt_out_posible_mensaje_id=c.opt_out_posible?c.msgs[c.bajaIdx].id:null;
    c.evs=c.eventos.map(function(e){return {evento:e[0],datos:e[2],actor:e[0].indexOf('conversacion_')===0&&e[0]!=='conversacion_creada'?'humano':'sistema',created_at:hace(e[1])};});
  });
  var bloqueos=[{id:1,motivo:'reserva_sin_liquidar',datos:{fecha:new Date().toISOString().slice(0,10)},creado_at:hace(90)}];

  function buscar(id){for(var i=0;i<convs.length;i++)if(convs[i].id===id)return convs[i];return null;}
  function err(status,codigo){var e=new Error(codigo);e.status=status;e.codigo=codigo;return Promise.reject(e);}
  function evento(c,nombre,datos){c.evs.push({evento:nombre,datos:datos||{},actor:'humano',created_at:new Date().toISOString()});c.last_activity_at=new Date().toISOString();}
  function enDuda(c){return c.msgs.some(function(m){return m.envio&&m.envio.estado==='incierto';});}
  function mascara(t){return t?'•••• '+t.slice(-4):null;}

  function e4(accion,b){
    var c=b&&b.conversacion_id?buscar(b.conversacion_id):null;
    var r;
    switch(accion){
      case 'lista':
        var orden=convs.slice().sort(function(a,z){return (z.estado==='esperando_humano')-(a.estado==='esperando_humano')||(z.last_activity_at<a.last_activity_at?-1:1);});
        r={conversaciones:orden.map(function(x){var u=x.msgs[x.msgs.length-1];return {id:x.id,estado:x.estado,modo:x.modo,plan_cliente:x.plan_cliente,tomada_por:x.tomada_por,opt_out:x.opt_out,opt_out_posible:x.opt_out_posible,sellada:x.sellada,
          consultas_tecnicas_detectadas:x.consultas,etapa:x.etapa,last_activity_at:x.last_activity_at,en_duda:enDuda(x),telefono_mascara:mascara(x.tel),
          ultimo:{id:u.id,direccion:u.direccion,autor:u.autor,tipo:u.tipo,suprimido:u.suprimido,estado_entrega:u.estado_entrega,created_at:u.created_at,previa:u.texto==null?null:u.texto.slice(0,120),no_descifra:false}};}),total:convs.length,parcial:false};
        break;
      case 'detalle':
        if(!c) return err(409,'ASISTENTE_BANDEJA');
        r={conversacion:{id:c.id,estado:c.estado,modo:c.modo,plan_cliente:c.plan_cliente,tomada_por:c.tomada_por,opt_out:c.opt_out,opt_out_posible:c.opt_out_posible,opt_out_posible_mensaje_id:c.opt_out_posible_mensaje_id,
          sellada:c.sellada,ficha:c.sellada?null:c.ficha,origen:c.sellada?null:c.origen,consultas_tecnicas_detectadas:c.consultas,version:1,last_activity_at:c.last_activity_at,telefono:c.sellada?null:c.tel},
          mensajes:c.msgs,eventos:c.evs.map(function(e){return c.sellada?{evento:e.evento,datos:null,actor:e.actor,created_at:e.created_at}:e;})};
        break;
      case 'tomar':
        if(c.estado==='cerrada') return err(409,'ASISTENTE_TRANSICION');
        evento(c,'conversacion_tomada',{desde:c.estado});c.estado='humano';c.tomada_por=YO;r={ok:true};break;
      case 'devolver':
        if(c.opt_out_posible||c.opt_out) return err(409,'ASISTENTE_TRANSICION');
        evento(c,'conversacion_devuelta_ia',{});c.estado='ia';c.tomada_por=null;r={ok:true};break;
      case 'cerrar':
        if(c.opt_out_posible) return err(409,'ASISTENTE_OPT_OUT_POSIBLE');
        evento(c,'conversacion_cerrada',{});c.estado='cerrada';c.tomada_por=null;r={ok:true};break;
      case 'responder':
        if(c.estado!=='humano') return err(409,'ASISTENTE_PROGRAMAR');
        var t=String(b.texto||'').trim(); if(!t||t.length>2000) return err(400,'texto');
        var env=uid(9000+(seq++));
        c.msgs.push({id:uid(8000+(seq++)),direccion:'saliente',autor:'humano',tipo:'texto',texto:t,estado_entrega:null,suprimido:false,no_descifra:false,created_at:new Date().toISOString(),envio:{id:env,tipo:'humano',estado:'programado',motivo:null,programado_para:null}});
        evento(c,'envio_humano_programado',{envio_id:env});r={ok:true,envio_id:env};break;
      case 'confirmar_baja':
        if(!c.opt_out_posible||b.mensaje_id!==c.opt_out_posible_mensaje_id) return err(409,'ASISTENTE_OPT_OUT');
        c.opt_out=true;c.opt_out_posible=false;c.opt_out_posible_mensaje_id=null;c.estado='cerrada';c.tomada_por=null;
        c.msgs.push({id:uid(8000+(seq++)),direccion:'saliente',autor:'sistema',tipo:'plantilla',texto:'Listo, no te enviaremos más mensajes. Si cambias de opinión, escríbenos.',estado_entrega:null,suprimido:false,no_descifra:false,created_at:new Date().toISOString(),envio:{id:uid(9000+(seq++)),tipo:'opt_out_confirmacion',estado:'programado'}});
        evento(c,'opt_out',{origen:'confirmado'});r={ok:true};break;
      case 'descartar_baja':
        if(!c.opt_out_posible) return err(409,'ASISTENTE_OPT_OUT');
        c.opt_out_posible=false;c.opt_out_posible_mensaje_id=null;c.estado='ia';c.tomada_por=null;evento(c,'opt_out_posible_descartado',{});r={ok:true};break;
      case 'reactivar':
        if(!c.opt_out) return err(409,'ASISTENTE_REACTIVAR');
        c.opt_out=false;c.estado='ia';evento(c,'reactivacion',{origen:'humano'});r={ok:true};break;
      case 'dar_por_fallido':
        var ok=false;c.msgs.forEach(function(m){if(m.envio&&m.envio.id===b.envio_id&&m.envio.estado==='incierto'){m.envio.estado='fallido';m.estado_entrega='fallido';ok=true;}});
        if(!ok) return err(409,'ASISTENTE_ENVIO_TRANSICION');r={ok:true};break;
      case 'suprimir':
        c.sellada=true;c.estado='cerrada';c.tomada_por=null;c.tel=null;c.ficha={};c.origen={};c.msgs.forEach(function(m){m.texto=null;m.suprimido=true;});
        evento(c,'conversacion_suprimida',{});r={ya_suprimida:false};break;
      case 'bloqueos': r={bloqueos:bloqueos.slice()};break;
      case 'levantar_bloqueo': bloqueos=bloqueos.filter(function(x){return x.id!==b.bloqueo_id;});r={ya_levantado:false};break;
      default: return err(400,'accion');
    }
    // Copia profunda: la página no puede mutar el "servidor" de mentira.
    return new Promise(function(res){setTimeout(function(){res(JSON.parse(JSON.stringify(r)));},180);});
  }
  function resumen(){
    var n=function(f){return convs.filter(f).length;};
    var inc=0;convs.forEach(function(c){c.msgs.forEach(function(m){if(m.envio&&m.envio.estado==='incierto')inc++;});});
    return Promise.resolve({esperando_humano:n(function(c){return c.estado==='esperando_humano';}),humano:n(function(c){return c.estado==='humano';}),
      opt_out_posible:n(function(c){return c.opt_out_posible;}),envios_inciertos:inc,procesos_error:0,costo_hoy_usd:1.2,tope_costo_usd_dia:5});
  }

  window.ASIS_DEMO={e4:e4,resumen:resumen,yo:YO};
})();
