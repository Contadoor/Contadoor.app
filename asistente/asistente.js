/* ============================================================
   asistente/asistente.js — Bandeja del Asistente IA (WhatsApp) · Gestoor
   Fuente de datos:
     · E4 (Edge Function asistente-bandeja): POST con el JWT de la sesión (sbH() de supabase.js).
       Cuerpo {accion, ...}; el actor NUNCA viaja en el cuerpo (lo saca E4 del JWT).
     · Contadores: RPC asistente_bandeja_resumen() con la sesión del usuario (sbFetch).
   La base re-verifica cada permiso; aquí los botones solo se muestran u ocultan por comodidad.
   Seguridad: todo texto de terceros se escapa con esc() antes de entrar al HTML.
   ============================================================ */
(function(){
  'use strict';

  var DEMO=window.ASIS_DEMO||null;                       // solo existe en localhost con ?demo=1 (ver demo.js)
  var E4_URL=SB_URL+'/functions/v1/asistente-bandeja';
  var REFRESCO_MS=60000;   // 60 s: cada lectura de la lista queda auditada (bandeja_lista); 20 s generaba ~180 eventos por hora por pestaña
  var MAX_TEXTO=2000;
  var MAX_LEYENDA=1000;                                  // leyenda de un archivo adjunto (contrato de E4)
  var MAX_ARCHIVO=5*1024*1024;                           // 5 MB del archivo original
  var MAX_NOMBRE=120;
  var MIMES={'application/pdf':'PDF','image/jpeg':'JPG','image/png':'PNG'};
  var EXT_MIME={pdf:'application/pdf',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png'};
  // No hay ícono de clip en gestoor-menu.js: se dibuja aquí con el mismo estilo de línea (Lucide).
  var SVG_CLIP='<svg class="g-ic" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>';

  var S={
    convs:[],total:0,parcial:false,cargada:false,
    resumen:null,bloqueos:[],
    filtro:'todas',q:'',
    sel:null,det:null,firmaSel:'',cargandoDet:false,
    yo:null,ocupado:false,
    borradores:{},nombres:{},                           // solo en memoria de esta pestaña
    adjuntos:{}                                         // archivo elegido por conversación: {archivo,nombre,mime,tam} (solo en memoria)
  };

  // ── Utilidades ─────────────────────────────────────────────────────────────
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function $(id){return document.getElementById(id);}
  function ic(nombre,color,placa){return '<i class="ic ic-'+color+(placa?' placa':'')+'">'+(window.gIcon?gIcon(nombre):'')+'</i>';}
  function hora(iso){return iso?new Date(iso).toLocaleTimeString('es-CL',{timeZone:'America/Santiago',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}):'';}
  function diaClave(iso){return new Date(iso).toLocaleDateString('en-CA',{timeZone:'America/Santiago'});}
  function diaTexto(iso){
    var k=diaClave(iso),hoy=diaClave(new Date().toISOString()),ayer=diaClave(new Date(Date.now()-864e5).toISOString());
    if(k===hoy)return 'Hoy'; if(k===ayer)return 'Ayer';
    return new Date(iso).toLocaleDateString('es-CL',{timeZone:'America/Santiago',weekday:'short',day:'numeric',month:'short'});
  }
  function fechaHora(iso){if(!iso)return '—';return diaTexto(iso).toLowerCase()+' '+hora(iso);}
  function relativo(iso){
    if(!iso)return '';
    var m=Math.round((Date.now()-new Date(iso).getTime())/60000);
    if(m<1)return 'ahora'; if(m<60)return 'hace '+m+' min';
    var h=Math.round(m/60); if(h<24)return 'hace '+h+' h';
    return new Date(iso).toLocaleDateString('es-CL',{timeZone:'America/Santiago',day:'numeric',month:'short'});
  }
  function usd(n){return 'US$ '+Number(n||0).toLocaleString('es-CL',{minimumFractionDigits:2,maximumFractionDigits:2});}
  function humanizar(k){k=String(k||'').replace(/_/g,' ').trim();return k.charAt(0).toUpperCase()+k.slice(1);}
  function iniciales(n){var p=String(n||'').trim().split(/\s+/).filter(Boolean);return p.length?p.map(function(x){return x.charAt(0);}).join('').slice(0,2).toUpperCase():'';}
  function tamano(b){
    if(b<1024)return b+' B';
    if(b<1024*1024)return Math.max(1,Math.round(b/1024)).toLocaleString('es-CL')+' KB';
    return (b/1024/1024).toLocaleString('es-CL',{minimumFractionDigits:1,maximumFractionDigits:1})+' MB';
  }
  function esMaster(){var s=window._contadoorSesion;return !!(s&&(s.esMaster===true||s.rol==='master'));}

  // ── Avisos y errores ───────────────────────────────────────────────────────
  var _avisoT;
  function aviso(txt,mal){
    var a=$('as-aviso');a.textContent=txt;a.classList.toggle('mal',!!mal);a.classList.add('on');
    clearTimeout(_avisoT);_avisoT=setTimeout(function(){a.classList.remove('on');},mal?6000:3500);
  }
  function errorGeneral(txt){
    var e=$('as-err');
    if(!txt){e.classList.remove('on');e.textContent='';return;}
    e.innerHTML=ic('alerta','rojo')+'<span>'+esc(txt)+'</span>';e.classList.add('on');
  }
  function textoError(e,conAdjunto){
    var c=(e&&e.codigo)||'',st=e&&e.status;
    if(st===401||c==='NO_SESSION')return 'Tu sesión venció. Vuelve a ingresar.';
    if(c==='SIN_PERMISO'||st===403)return 'No tienes permiso para esta acción.';
    if(c==='ASISTENTE_PROPIEDAD')return 'La conversación la está atendiendo otra persona del equipo.';
    if(c==='ASISTENTE_OPT_OUT_POSIBLE')return 'Primero resuelve la posible baja (confirmar o descartar).';
    if(c==='ASISTENTE_SUPRIMIDO')return 'Esta persona pidió no recibir mensajes.';
    if(c==='ASISTENTE_TRANSICION'||c==='ASISTENTE_PROGRAMAR'||c==='ASISTENTE_BANDEJA')return 'La conversación cambió de estado. Se actualizó la vista.';
    if(c.indexOf('ASISTENTE_ENVIO')===0)return 'Ese envío ya cambió de estado. Se actualizó la vista.';
    if(c==='ASISTENTE_OPT_OUT'||c==='ASISTENTE_REACTIVAR')return 'La baja ya cambió de estado. Se actualizó la vista.';
    if(c==='ASISTENTE_BLOQUEO')return 'Ese bloqueo ya no existe.';
    if(st===400&&c==='texto')return conAdjunto?'La leyenda supera los 1.000 caracteres.':'El mensaje está vacío o supera los 2.000 caracteres.';
    if(st===400&&c==='mime')return 'Solo se pueden enviar archivos PDF, JPG o PNG.';
    if(st===400&&c==='nombre')return 'El nombre del archivo no es válido. Cámbialo e intenta de nuevo.';
    if(st===400&&c==='contenido')return 'El archivo está vacío, dañado, supera los 5 MB o no es realmente un PDF, JPG o PNG.';
    if(st===413)return 'El archivo es demasiado grande para enviarlo (máximo 5 MB).';
    if(c.indexOf('ASISTENTE_')===0)return 'La base rechazó la acción ('+c+'). Se actualizó la vista.';
    return 'No se pudo completar la acción. Revisa tu conexión e intenta de nuevo.';
  }

  // ── Acceso a datos (mismo mecanismo de sesión que supabase.js) ─────────────
  function sesionRequerida(){
    window.dispatchEvent(new CustomEvent('gestoor-session-required',{detail:{path:'functions/v1/asistente-bandeja',reason:'GESTOOR_NO_SESSION'}}));
    var e=new Error('NO_SESSION');e.status=401;e.codigo='NO_SESSION';return e;
  }
  // Espera el JWT de la sesión. Fail-closed: sin token no se llama a nadie (nunca la anon como Bearer).
  function tokenListo(){
    if(_gestoorAccessToken)return Promise.resolve();
    if(window._sbAuthReady===true)return Promise.reject(sesionRequerida());
    return _waitForAuthReady().then(function(){if(!_gestoorAccessToken)throw sesionRequerida();},function(){throw sesionRequerida();});
  }
  function e4(accion,extra){
    var cuerpo=Object.assign({},extra||{});
    delete cuerpo.actor;delete cuerpo.p_actor;              // el actor sale SOLO del JWT
    cuerpo.accion=accion;
    if(DEMO)return DEMO.e4(accion,cuerpo);
    return tokenListo().then(function(){
      return fetch(E4_URL,{method:'POST',headers:sbH(),body:JSON.stringify(cuerpo)});
    }).then(function(r){
      return r.json().catch(function(){return null;}).then(function(j){
        if(r.ok)return j||{};
        var e=new Error((j&&j.error)||('HTTP '+r.status));e.status=r.status;e.codigo=(j&&j.error)||'';
        if(r.status===401)sesionRequerida();
        throw e;
      });
    });
  }
  function rpcResumen(){
    if(DEMO)return DEMO.resumen();
    return sbFetch('rpc/asistente_bandeja_resumen',{method:'POST',body:'{}'}).then(function(r){
      return r.json().catch(function(){return null;}).then(function(j){
        if(r.ok)return j;
        var e=new Error((j&&j.message)||('HTTP '+r.status));e.status=r.status;e.codigo=(j&&j.message)||'';
        if(r.status===401)sesionRequerida();
        throw e;
      });
    });
  }
  function cargarYo(){
    if(DEMO){S.yo=DEMO.yo;return Promise.resolve();}
    var c=window._sbAuthClient;if(!c)return Promise.resolve();
    return c.auth.getSession().then(function(r){var s=r&&r.data&&r.data.session;S.yo=(s&&s.user&&s.user.id)||null;}).catch(function(){});
  }

  // ── Textos de estado ───────────────────────────────────────────────────────
  var PLAN={cumplimiento:'Cumplimiento',pro:'PRO',estrategico:'Estratégico'};
  var TIPO_ADJ={audio:'Audio recibido',imagen:'Imagen recibida',documento:'Documento recibido',material:'Material',plantilla:'Mensaje de plantilla',interno:'Nota interna'};
  var EVENTOS={
    conversacion_creada:['Llegó una conversación nueva','chat','celeste'],
    conversacion_tomada:['Una persona del equipo tomó la conversación','personal','verde'],
    conversacion_devuelta_ia:['La conversación volvió a la IA','repetir','celeste'],
    conversacion_cerrada:['Conversación cerrada','check','morado'],
    conversacion_reabierta:['La conversación se reabrió','repetir','celeste'],
    derivada_a_humano:['La IA pidió ayuda del equipo','alerta','rojo'],
    opt_out:['La persona pidió no recibir más mensajes','candado','rojo'],
    opt_out_posible:['Posible baja detectada · la IA se detuvo','alerta','ambar'],
    opt_out_posible_descartado:['Posible baja descartada','check','verde'],
    reactivacion:['Conversación reactivada','repetir','verde'],
    envio_humano_programado:['Respuesta del equipo en cola de envío','enviar','verde'],
    conversacion_suprimida:['Se borraron los datos de esta persona','basura','rojo']
  };
  var MOTIVOS={pidio_persona:'pidió hablar con una persona',pidio_precio:'preguntó por precios',fuera_del_piloto:'número fuera del piloto'};
  function etiquetaEvento(ev){
    var d=EVENTOS[ev.evento];if(!d)return null;
    var t=d[0],m=ev.datos&&ev.datos.motivo;
    if(ev.evento==='derivada_a_humano'&&m)t+=' · '+(MOTIVOS[m]||humanizar(m).toLowerCase());
    if(ev.evento==='conversacion_tomada'&&ev.datos&&ev.datos.anterior)t='Conversación reasignada a otra persona del equipo';
    if(ev.evento==='envio_humano_programado'&&ev.datos&&ev.datos.adjunto===true)t='Archivo del equipo en cola de envío';
    return {texto:t,icono:d[1],color:d[2]};
  }
  function tomadaPor(c){
    if(!c.tomada_por)return null;
    return c.tomada_por===S.yo?'Tú':'Otra persona del equipo';
  }
  function nombreConv(c,det){
    var n=(det&&det.ficha&&typeof det.ficha.nombre==='string'&&det.ficha.nombre.trim())||S.nombres[c.id]||'';
    if(c.sellada)return 'Datos borrados';
    if(n)return n+(det&&det.ficha&&det.ficha.empresa?' · '+det.ficha.empresa:'');
    if(c.telefono_mascara)return 'WhatsApp '+c.telefono_mascara;
    return 'Número sin identificar';
  }
  function avatarConv(c){
    if(c.sellada)return ic('basura','rojo');
    var n=S.nombres[c.id];
    return n?esc(iniciales(n)):ic('chat','celeste');
  }

  // ── Filtros ────────────────────────────────────────────────────────────────
  var FILTROS=[
    ['todas','Todas',function(c){return c.estado!=='cerrada';}],
    ['nec','Te necesitan',function(c){return c.estado==='esperando_humano';}],
    ['mias','Mías',function(c){return c.estado==='humano'&&!!S.yo&&c.tomada_por===S.yo;}],
    ['baja','Posible baja',function(c){return !!c.opt_out_posible;}],
    ['duda','En duda',function(c){return !!c.en_duda;}],
    ['cli','Clientes',function(c){return c.modo==='cliente';}],
    ['cerr','Cerradas',function(c){return c.estado==='cerrada';}]
  ];
  function filtroFn(k){for(var i=0;i<FILTROS.length;i++)if(FILTROS[i][0]===k)return FILTROS[i][2];return FILTROS[0][2];}

  function pintarFiltros(){
    var h='';
    FILTROS.forEach(function(f){
      var n=S.cargada?S.convs.filter(f[2]).length:null;
      h+='<button type="button" role="tab" class="as-f f-'+f[0]+(S.filtro===f[0]?' on':'')+'" aria-selected="'+(S.filtro===f[0])+'" data-f="'+f[0]+'">'+esc(f[1])+(n!=null&&f[0]!=='cerr'?'<em>'+n+'</em>':'')+'</button>';
    });
    $('as-filtros').innerHTML=h;
    var p=$('as-parcial');
    if(S.parcial){p.textContent='Se muestran las '+S.convs.length+' conversaciones más recientes de '+S.total+'. Los contadores de los filtros cubren solo las mostradas.';p.classList.add('on');}
    else p.classList.remove('on');
  }

  // ── Columna 1 · lista ──────────────────────────────────────────────────────
  // Archivo enviado por el equipo desde la bandeja: saliente, autor humano, tipo documento (PDF) o imagen (JPG/PNG).
  function esAdjuntoEquipo(m){return !!m&&m.direccion==='saliente'&&m.autor==='humano'&&(m.tipo==='documento'||m.tipo==='imagen');}
  function previa(c){
    var u=c.ultimo;
    if(!u)return {t:'Sin mensajes',vacia:true};
    if(u.suprimido)return {t:'Contenido borrado',vacia:true};
    if(u.no_descifra)return {t:'No se pudo leer el mensaje',vacia:true};
    var pre=u.autor==='ia'?'IA: ':u.autor==='humano'?'Equipo: ':u.autor==='sistema'?'Sistema: ':'';
    if(esAdjuntoEquipo(u))return {t:pre+'📎 Archivo adjunto'+(u.previa?' · '+u.previa:''),vacia:false};
    if(u.previa==null)return {t:pre+(TIPO_ADJ[u.tipo]||'Mensaje sin texto'),vacia:true};
    return {t:pre+u.previa,vacia:false};
  }
  function tagsConv(c){
    var t=[];
    if(c.sellada)t.push('<span class="t t-cerr">Datos borrados</span>');
    else if(c.opt_out)t.push('<span class="t t-nec">Pidió no recibir mensajes</span>');
    else if(c.estado==='esperando_humano')t.push('<span class="t t-nec">Te necesita</span>');
    else if(c.estado==='humano')t.push(c.tomada_por===S.yo?'<span class="t t-tu">Tomada por ti</span>':'<span class="t t-otro">Tomada por otra persona</span>');
    else if(c.estado==='ia')t.push('<span class="t t-ia">IA atendiendo</span>');
    else if(c.estado==='cerrada')t.push('<span class="t t-cerr">Cerrada</span>');
    if(c.opt_out_posible)t.push('<span class="t t-baja">Posible baja · revisar</span>');
    if(c.en_duda)t.push('<span class="t t-duda">Mensaje en duda</span>');
    if(c.modo==='cliente')t.push('<span class="t t-cli">Cliente'+(c.plan_cliente?' · '+esc(PLAN[c.plan_cliente]||c.plan_cliente):'')+'</span>');
    if(c.etapa)t.push('<span class="t t-neutro">'+esc(humanizar(c.etapa))+'</span>');
    return t.join('');
  }
  function pintarLista(){
    pintarFiltros();
    var cont=$('as-lista');
    if(!S.cargada)return;
    var f=filtroFn(S.filtro),q=S.q.toLowerCase();
    var l=S.convs.filter(function(c){
      if(!f(c))return false;
      if(!q)return true;
      var p=previa(c).t;
      return [p,c.telefono_mascara,S.nombres[c.id],c.etapa].join(' ').toLowerCase().indexOf(q)>=0;
    });
    var top=cont.scrollTop;
    if(!l.length){
      cont.innerHTML='<div class="as-vacio">'+(S.convs.length?'No hay conversaciones con este filtro.':'Todavía no hay conversaciones.')+'</div>';
      return;
    }
    cont.innerHTML=l.map(function(c){
      var p=previa(c),sel=S.sel===c.id;
      return '<button type="button" class="as-c'+(sel?' sel':'')+'" data-id="'+esc(c.id)+'"'+(sel?' aria-current="true"':'')+'>'
        +'<span class="as-av">'+avatarConv(c)+'</span>'
        +'<span class="as-cm"><span class="as-l1"><strong>'+esc(nombreConv(c))+'</strong><small>'+esc(relativo(c.last_activity_at))+'</small></span>'
        +'<span class="as-prev'+(p.vacia?' vacia':'')+'" style="display:block">'+esc(p.t)+'</span>'
        +'<span class="as-tags">'+tagsConv(c)+'</span></span></button>';
    }).join('');
    cont.scrollTop=top;
  }

  // ── Contadores y bloqueos ──────────────────────────────────────────────────
  function pintarResumen(){
    var r=S.resumen,set=function(id,v){$(id).textContent=v;};
    if(!r){['k-nec','k-hum','k-baja','k-duda','k-gasto'].forEach(function(id){set(id,'—');$(id).title='No disponible';});}
    else{
      set('k-nec',r.esperando_humano);set('k-hum',r.humano);set('k-baja',r.opt_out_posible);set('k-duda',r.envios_inciertos);
      var g=Number(r.costo_hoy_usd||0),tope=Number(r.tope_costo_usd_dia||0);
      set('k-gasto',usd(g));
      set('k-gasto-l','Gasto IA hoy'+(tope?' · tope '+usd(tope).replace(',00',''):''));
      var pct=tope?Math.min(100,Math.round(g/tope*100)):0,b=$('k-barra');
      b.querySelector('i').style.width=pct+'%';b.setAttribute('aria-valuenow',pct);
      b.classList.toggle('alta',pct>=70&&pct<100);b.classList.toggle('tope',pct>=100);
      ['k-nec','k-hum','k-baja','k-duda','k-gasto'].forEach(function(id){$(id).title='';});
    }
    // "IA atendiendo" no viene en el resumen: se cuenta en la lista cargada (con "+" si la lista es parcial).
    if(S.cargada){var n=S.convs.filter(function(c){return c.estado==='ia';}).length;set('k-ia',n+(S.parcial?'+':''));$('k-ia').title=S.parcial?'Contado sobre las conversaciones mostradas':'';}
    else set('k-ia','—');
  }
  var MOTIVO_BLOQ={consumo_anomalo:'Consumo anómalo de IA',reserva_sin_liquidar:'Reserva de consumo sin liquidar'};
  function pintarBloqueos(){
    var s=$('as-bloq'),l=S.bloqueos||[];
    if(!l.length){s.classList.remove('on');s.innerHTML='';return;}
    var m=esMaster();
    s.innerHTML='<h2>'+ic('alerta','ambar',true)+' La IA está detenida por un bloqueo de consumo</h2>'
      +l.map(function(b){
        var fecha=b.datos&&typeof b.datos.fecha==='string'?b.datos.fecha:'';
        return '<div class="as-bloq-f"><span style="flex:1;min-width:200px"><strong>'+esc(MOTIVO_BLOQ[b.motivo]||humanizar(b.motivo))+'</strong> · desde '+esc(fechaHora(b.creado_at))+(fecha?' · día '+esc(fecha):'')+'</span>'
          +(m?'<button type="button" class="as-btn sm ambar" data-acc="levantar_bloqueo" data-bloqueo="'+esc(b.id)+'">'+ic('check','ambar')+' Levantar</button>':'<small>Solo un master puede levantarlo.</small>')+'</div>';
      }).join('');
  }

  // ── Columna 2 · conversación ───────────────────────────────────────────────
  function puedeEscribir(c){
    return c.estado==='humano'&&!c.sellada&&!c.opt_out&&(c.tomada_por===S.yo||esMaster());
  }
  function botonesEstado(c){
    // Devuelve [accion, etiqueta, icono, color, clase] según el estado real de la conversación.
    var b=[],mia=c.tomada_por===S.yo,m=esMaster();
    if(c.sellada)return b;
    if(c.opt_out){b.push(['reactivar','Reactivar','repetir','verde','']);return b;}
    if(c.opt_out_posible){
      b.push(['confirmar_baja','Confirmar baja','candado','rojo','peligro']);
      b.push(['descartar_baja','No es baja','check','verde','']);
      return b;
    }
    if(c.estado==='ia'||c.estado==='esperando_humano')b.push(['tomar','Tomar conversación','personal','verde','pri']);
    if(c.estado==='humano'&&!mia&&m)b.push(['tomar','Reasignármela','personal','verde','']);
    if(c.estado==='esperando_humano'||(c.estado==='humano'&&(mia||m)))b.push(['devolver','Devolver a la IA','repetir','celeste','']);
    if(c.estado!=='cerrada'&&(c.estado!=='humano'||mia||m))b.push(['cerrar','Cerrar','check','morado','']);
    return b;
  }
  function htmlBoton(x){return '<button type="button" class="as-btn '+x[4]+'" data-acc="'+x[0]+'">'+ic(x[2],x[4]==='pri'?'blanco':x[3])+' '+esc(x[1])+'</button>';}

  function entregaMeta(m){
    var e=m.envio,st=e&&e.estado;
    if(st==='programado')return '<span class="e-prog">'+gIcon('reloj')+' En cola de envío</span>';
    if(st==='enviando')return '<span class="e-prog">'+gIcon('reloj')+' Enviando…</span>';
    if(st==='cancelado')return '<span class="e-mal">No enviado (cancelado)</span>';
    if(st==='fallido'||m.estado_entrega==='fallido')return '<span class="e-mal">'+gIcon('alerta')+' No enviado</span>';
    if(st==='incierto'||m.estado_entrega==='incierto')return '<span class="e-duda">'+gIcon('alerta')+' Sin confirmación de entrega</span>';
    if(m.estado_entrega==='leido')return '<span class="e-leido">'+gIcon('check')+' Leído</span>';
    if(m.estado_entrega==='entregado')return '<span class="e-ok">'+gIcon('check')+' Entregado</span>';
    if(m.estado_entrega==='enviado'||st==='enviado')return '<span class="e-ok">'+gIcon('check')+' Enviado</span>';
    return '';
  }
  function htmlMensaje(m){
    // Material enviado por el sistema: se muestra como evento, no como burbuja.
    if(m.direccion==='saliente'&&m.autor==='sistema'&&m.tipo==='material'&&m.texto&&!m.suprimido){
      return '<div class="as-ev">'+ic('subir','celeste')+' El sistema envió <b>'+esc(m.texto)+'</b> · '+esc(hora(m.created_at))+'</div>';
    }
    var cls=m.direccion==='entrante'?'ent':m.autor==='ia'?'ia':m.autor==='humano'?'hum':'sis';
    var duda=m.envio&&m.envio.estado==='incierto';
    var cuerpo;
    if(m.suprimido)cuerpo='<span class="nota">Contenido borrado</span>';
    else if(esAdjuntoEquipo(m)){
      // El detalle no trae el nombre del archivo: solo se indica que hubo adjunto, más la leyenda si existe.
      cuerpo='<span class="adj">📎 Archivo adjunto</span>';
      if(m.no_descifra)cuerpo+='<span class="leyenda nota">No se pudo leer la leyenda</span>';
      else if(m.texto)cuerpo+='<span class="leyenda">'+esc(m.texto)+'</span>';
    }
    else if(m.no_descifra)cuerpo='<span class="nota">No se pudo leer este mensaje</span>';
    else if(m.texto==null||m.texto==='')cuerpo='<span class="nota">'+esc(TIPO_ADJ[m.tipo]||'Mensaje sin texto')+'</span>';
    else cuerpo=esc(m.texto);                              // texto de terceros: SIEMPRE escapado
    var autor=m.autor==='ia'?'Asistente':m.autor==='humano'?'Equipo':m.autor==='sistema'?'Sistema':'';
    var meta=[autor,hora(m.created_at)].filter(Boolean).map(esc).join(' · ');
    var ent=m.direccion==='saliente'?entregaMeta(m):'';
    var h='<div class="as-m '+cls+(duda?' duda':'')+'">'+cuerpo+'<span class="meta">'+meta+(ent?' · '+ent:'')+'</span></div>';
    if(duda&&m.envio.id){
      h+='<div class="as-ev duda">'+ic('alerta','amarillo')+' WhatsApp no confirmó si este mensaje llegó.'
        +' <button type="button" class="as-btn sm" data-acc="dar_por_fallido" data-envio="'+esc(m.envio.id)+'">Dar por no enviado</button></div>';
    }
    return h;
  }
  function htmlBanners(c){
    var h='';
    if(c.sellada)h+='<div class="as-banner info">'+ic('basura','rojo')+'<span class="txt">Los datos de esta persona fueron borrados. Solo queda el registro de lo ocurrido.</span></div>';
    else if(c.opt_out)h+='<div class="as-banner cerr">'+ic('candado','rojo')+'<span class="txt"><b>Pidió no recibir más mensajes.</b> Nadie puede escribirle hasta que se reactive.</span><button type="button" class="as-btn sm" data-acc="reactivar">'+ic('repetir','verde')+' Reactivar</button></div>';
    else if(c.opt_out_posible)h+='<div class="as-banner baja">'+ic('alerta','ambar')+'<span class="txt"><b>Posible baja.</b> La IA detectó que quizás no quiere recibir más mensajes, pero no es una frase clara. Mientras decides, no sale ningún mensaje automático.</span>'
      +'<button type="button" class="as-btn sm peligro" data-acc="confirmar_baja">Confirmar baja</button><button type="button" class="as-btn sm" data-acc="descartar_baja">No es baja</button></div>';
    else if(c.estado==='esperando_humano')h+='<div class="as-banner info">'+ic('reloj','ambar')+'<span class="txt">En espera de una persona · la IA no responderá hasta que alguien la tome o la devuelva a la IA.</span></div>';
    else if(c.estado==='humano'&&c.tomada_por!==S.yo)h+='<div class="as-banner info">'+ic('personal','morado')+'<span class="txt">La atiende otra persona del equipo.'+(esMaster()?' Como master puedes reasignártela.':'')+'</span></div>';
    else if(c.estado==='cerrada')h+='<div class="as-banner info">'+ic('check','morado')+'<span class="txt">Conversación cerrada. Si la persona vuelve a escribir, se reabre.</span></div>';
    return h;
  }
  function pintarChat(){
    var cuerpo=$('as-chat-cuerpo'),comp=$('as-comp'),app=$('as-app');
    app.classList.toggle('con-sel',!!S.sel);
    if(!S.sel){
      cuerpo.innerHTML='<div class="as-placeholder">Elige una conversación de la lista para verla aquí.</div>';
      comp.hidden=true;return;
    }
    var resumenFila=S.convs.filter(function(x){return x.id===S.sel;})[0]||{id:S.sel};
    if(!S.det){
      cuerpo.innerHTML='<div class="as-chead"><button type="button" class="as-btn sm as-volver" data-volver="1">← Volver</button></div><div class="as-placeholder">'+(S.cargandoDet?'Cargando conversación…':'No se pudo abrir la conversación.')+'</div>';
      comp.hidden=true;return;
    }
    var c=S.det.conversacion,msgs=S.det.mensajes||[],evs=S.det.eventos||[];
    var o=c.origen||{};
    var sub=['WhatsApp '+(c.telefono||resumenFila.telefono_mascara||'sin número')];
    if(o.material)sub.push('llegó por «'+o.material+'»');
    var viejoMsgs=cuerpo.querySelector('.as-msgs'),abajo=true,top=0;
    if(viejoMsgs&&viejoMsgs.getAttribute('data-id')===c.id&&S.alFondo!==c.id){top=viejoMsgs.scrollTop;abajo=viejoMsgs.scrollHeight-viejoMsgs.scrollTop-viejoMsgs.clientHeight<60;}
    if(S.alFondo===c.id)S.alFondo=null;                   // tras un envío propio se muestra el último mensaje
    var h='<div class="as-chead"><button type="button" class="as-btn sm as-volver" data-volver="1">← Volver</button>'
      +'<span class="as-av">'+(c.sellada?ic('basura','rojo'):(c.ficha&&c.ficha.nombre?esc(iniciales(c.ficha.nombre)):ic('chat','celeste')))+'</span>'
      +'<div class="as-ctit"><h2>'+esc(nombreConv(c,c))+'</h2><p>'+esc(sub.join(' · '))+'</p></div>'
      +'<div class="as-acc">'+botonesEstado(c).filter(function(x){return x[0]!=='confirmar_baja'&&x[0]!=='descartar_baja'&&x[0]!=='reactivar';}).map(htmlBoton).join('')+'</div></div>';
    h+=htmlBanners(c);
    // Línea de tiempo: mensajes + eventos conocidos, por hora.
    var items=msgs.map(function(m){return {t:m.created_at,m:m};});
    evs.forEach(function(ev){var e=etiquetaEvento(ev);if(e)items.push({t:ev.created_at,e:e});});
    items.sort(function(a,b){return a.t<b.t?-1:a.t>b.t?1:(a.m?-1:1);});
    var ult='',lin='';
    if(msgs.length>=100)lin+='<div class="as-ev">'+ic('reloj','morado')+' Se muestran los últimos 100 mensajes.</div>';
    items.forEach(function(it){
      var k=diaClave(it.t);
      if(k!==ult){ult=k;lin+='<div class="as-dia">'+esc(diaTexto(it.t))+'</div>';}
      lin+=it.m?htmlMensaje(it.m):'<div class="as-ev">'+ic(it.e.icono,it.e.color)+' '+esc(it.e.texto)+' · '+esc(hora(it.t))+'</div>';
    });
    if(!items.length)lin+='<div class="as-vacio">Sin mensajes.</div>';
    h+='<div class="as-msgs" data-id="'+esc(c.id)+'">'+lin+'</div>';
    cuerpo.innerHTML=h;
    var nm=cuerpo.querySelector('.as-msgs');nm.scrollTop=abajo?nm.scrollHeight:top;
    // Caja de respuesta: solo con la conversación tomada. No se redibuja (no pisa lo escrito).
    var ta=$('as-texto');
    if(c.estado==='humano'&&!c.sellada&&!c.opt_out){
      comp.hidden=false;
      var ok=puedeEscribir(c)&&!c.opt_out_posible;
      ta.disabled=!ok;$('as-enviar').disabled=!ok||S.ocupado;$('as-adjuntar').disabled=!ok||S.ocupado;
      var nombre=c.ficha&&typeof c.ficha.nombre==='string'?c.ficha.nombre.trim().split(/\s+/)[0]:'';
      ta.placeholder=c.opt_out_posible?'Resuelve la posible baja antes de escribir':!puedeEscribir(c)?'La atiende otra persona del equipo':'Escribe tu respuesta'+(nombre?' a '+nombre:'')+'…';
      if(ta.getAttribute('data-conv')!==c.id){ta.setAttribute('data-conv',c.id);ta.value=S.borradores[c.id]||'';}
      if(!ok)delete S.adjuntos[c.id];                     // si ya no puede escribir, el archivo elegido se descarta
      pintarAdjunto();
    }else{
      comp.hidden=true;
    }
  }
  function contarTexto(){
    var ta=$('as-texto'),n=ta.value.length,c=$('as-cuenta'),adj=adjuntoActual();
    var max=adj?MAX_LEYENDA:MAX_TEXTO;
    c.textContent=(adj?'Leyenda (opcional) · ':'')+n.toLocaleString('es-CL')+' / '+max.toLocaleString('es-CL');c.classList.toggle('mal',n>max);
  }

  // ── Adjuntar archivo ───────────────────────────────────────────────────────
  function adjuntoActual(){var id=$('as-texto').getAttribute('data-conv');return id&&id===S.sel?S.adjuntos[id]||null:null;}
  function pintarAdjunto(){
    var a=adjuntoActual(),chip=$('as-chip'),ta=$('as-texto');
    // Mostrar u ocultar el chip cambia el alto del chat: si estaba al final, se mantiene al final.
    var ms=document.querySelector('#as-chat-cuerpo .as-msgs'),pegado=ms&&ms.scrollHeight-ms.scrollTop-ms.clientHeight<60;
    if(!a){chip.hidden=true;chip.innerHTML='';}
    else{
      chip.innerHTML='<i class="ic ic-celeste">'+SVG_CLIP+'</i><span class="nom" title="'+esc(a.nombre)+'">'+esc(a.nombre)+'</span>'
        +'<small>'+esc(MIMES[a.mime])+' · '+esc(tamano(a.tam))+'</small>'
        +'<button type="button" id="as-quitar" aria-label="Quitar archivo '+esc(a.nombre)+'" title="Quitar archivo"'+(S.ocupado?' disabled':'')+'>✕</button>';
      chip.hidden=false;
    }
    if(!ta.disabled){
      var c=S.det&&S.det.conversacion,nombre=c&&c.ficha&&typeof c.ficha.nombre==='string'?c.ficha.nombre.trim().split(/\s+/)[0]:'';
      ta.placeholder=a?'Leyenda opcional para el archivo…':'Escribe tu respuesta'+(nombre?' a '+nombre:'')+'…';
    }
    ta.maxLength=a?MAX_LEYENDA:MAX_TEXTO;
    contarTexto();
    if(pegado)ms.scrollTop=ms.scrollHeight;
  }
  // Recorta el nombre a 120 caracteres sin perder la extensión.
  function nombreSeguro(n){
    n=String(n||'').replace(/[\u0000-\u001f\/\\]/g,'').trim();
    if(n.length<=MAX_NOMBRE)return n;
    var p=n.lastIndexOf('.'),ext=p>0&&n.length-p<=6?n.slice(p):'';
    return n.slice(0,MAX_NOMBRE-ext.length)+ext;
  }
  function elegirArchivo(f){
    var c=S.det&&S.det.conversacion;
    if(!f||!c||!puedeEscribir(c)||c.opt_out_posible)return;
    var ext=(String(f.name).split('.').pop()||'').toLowerCase();
    var mime=MIMES[f.type]?f.type:(!f.type&&EXT_MIME[ext]?EXT_MIME[ext]:'');   // algunos sistemas no informan el tipo
    if(!mime){aviso('Ese archivo no se puede enviar: solo PDF, JPG o PNG.',true);return;}
    if(!f.size){aviso('El archivo está vacío.',true);return;}
    if(f.size>MAX_ARCHIVO){aviso('El archivo pesa '+tamano(f.size)+': el máximo es 5 MB.',true);return;}
    var nombre=nombreSeguro(f.name);
    if(!nombre){aviso('El archivo no tiene un nombre válido.',true);return;}
    S.adjuntos[c.id]={archivo:f,nombre:nombre,mime:mime,tam:f.size};
    pintarAdjunto();
    if($('as-texto').value.trim().length>MAX_LEYENDA)aviso('Con archivo, el texto es la leyenda y no puede superar los 1.000 caracteres.',true);
  }
  // Lee el archivo y devuelve su base64 SIN el prefijo data:...;base64,
  function leerBase64(f){
    return new Promise(function(res,rej){
      var r=new FileReader();
      r.onload=function(){var v=String(r.result||''),i=v.indexOf(',');res(i>=0?v.slice(i+1):'');};
      r.onerror=function(){rej(new Error('LECTURA'));};
      r.readAsDataURL(f);
    });
  }
  var _envHtml=null;
  function botonEnviando(on){
    var b=$('as-enviar');
    if(_envHtml===null)_envHtml=b.innerHTML;
    b.innerHTML=on?'Enviando…':_envHtml;
  }

  // ── Columna 3 · ficha ──────────────────────────────────────────────────────
  var ETQ_FICHA={nombre:'Nombre',empresa:'Empresa',rubro:'Rubro',empresa_activa:'Empresa funcionando',antiguedad_mas_1_anio:'Antigüedad',
    tiene_trabajadores:'Tiene trabajadores',n_trabajadores:'Trabajadores',ventas_rango:'Ventas',tiene_contador:'Contador hoy',
    busca_cambiar_contador:'Quiere cambiar de contador',problema_concreto:'Problema',es_estudiante_o_busca_empleo:'Estudiante o busca empleo',etapa:'Etapa',email:'Correo'};
  var ETQ_ORIGEN={canal:'Canal',material:'Llegó por',material_entregado:'Material entregado',utm_source:'Fuente',utm_campaign:'Campaña',utm_content:'Anuncio',utm_medium:'Medio',seguimiento:'Seguimiento'};
  function valor(k,v){
    if(v===true)return k==='antiguedad_mas_1_anio'?'Más de 1 año':'Sí';
    if(v===false)return k==='antiguedad_mas_1_anio'?'Menos de 1 año':'No';
    if(typeof v==='number')return v.toLocaleString('es-CL');
    if(typeof v==='string')return k==='canal'&&v==='whatsapp'?'WhatsApp':v;
    return null;                                           // objetos/listas no se muestran en la ficha
  }
  function dl(obj,etq,orden){
    var keys=Object.keys(obj||{});
    keys.sort(function(a,b){var ia=orden.indexOf(a),ib=orden.indexOf(b);return (ia<0?99:ia)-(ib<0?99:ib);});
    var h='';
    keys.forEach(function(k){var v=valor(k,obj[k]);if(v==null||v==='')return;h+='<dt>'+esc(etq[k]||humanizar(k))+'</dt><dd>'+esc(v)+'</dd>';});
    return h;
  }
  function pintarFicha(){
    var f=$('as-ficha');
    if(!S.sel||!S.det){
      f.innerHTML='<div class="as-sec"><p class="as-nota" style="margin:0">'+(S.sel&&S.cargandoDet?'Cargando ficha…':'Aquí verás lo que sabemos de la persona, su origen, el historial y las acciones disponibles.')+'</p></div>';
      return;
    }
    var c=S.det.conversacion,msgs=S.det.mensajes||[],evs=S.det.eventos||[],m=esMaster();
    var h='<div class="as-sec"><h3>'+ic('objetivo','morado',true)+' Lo que sabemos</h3>';
    if(c.sellada)h+='<p class="as-nota" style="margin:0">Datos borrados: no queda información de la persona.</p>';
    else{
      var tipo=c.modo==='cliente'?'Cliente'+(c.plan_cliente?' · '+(PLAN[c.plan_cliente]||c.plan_cliente):''):'Prospecto';
      var cuerpo=dl(c.ficha,ETQ_FICHA,Object.keys(ETQ_FICHA));
      h+='<dl class="as-dl"><dt>Tipo</dt><dd>'+esc(tipo)+'</dd>'+(c.telefono?'<dt>WhatsApp</dt><dd>'+esc(c.telefono)+'</dd>':'')+cuerpo+'</dl>';
      if(!cuerpo)h+='<p class="as-nota">La IA todavía no ha reunido datos de esta persona.</p>';
    }
    h+='</div>';
    h+='<div class="as-sec"><h3>'+ic('transferir','celeste',true)+' Origen y material</h3>';
    var orig=c.sellada?'':dl(c.origen,ETQ_ORIGEN,Object.keys(ETQ_ORIGEN));
    h+='<dl class="as-dl">'+orig+'<dt>Consultas técnicas</dt><dd>'+esc(Number(c.consultas_tecnicas_detectadas||0))+' detectadas</dd></dl></div>';
    var primero=msgs.length?msgs[0].created_at:null;
    var tp=tomadaPor(c);
    var EST={ia:'IA atendiendo',esperando_humano:'Esperando a una persona',humano:'En atención del equipo',cerrada:'Cerrada'};
    h+='<div class="as-sec"><h3>'+ic('reloj','ambar',true)+' Historial</h3><dl class="as-dl">'
      +'<dt>'+(msgs.length>=100?'Primer mensaje cargado':'Primer mensaje')+'</dt><dd>'+esc(fechaHora(primero))+'</dd>'
      +'<dt>Última actividad</dt><dd>'+esc(fechaHora(c.last_activity_at))+'</dd>'
      +'<dt>Estado</dt><dd>'+esc(EST[c.estado]||c.estado)+'</dd>'
      +'<dt>Tomada por</dt><dd>'+esc(tp||'— nadie aún')+'</dd></dl>';
    var ult=evs.map(function(ev){return {ev:ev,e:etiquetaEvento(ev)};}).filter(function(x){return x.e;}).slice(-6).reverse();
    if(ult.length)h+='<div class="as-hist">'+ult.map(function(x){return '<div><span>'+esc(x.e.texto)+'</span><time>'+esc(fechaHora(x.ev.created_at))+'</time></div>';}).join('')+'</div>';
    h+='</div>';
    var bs=botonesEstado(c);
    h+='<div class="as-sec"><h3>'+ic('admin','verde',true)+' Acciones</h3><div class="as-acc-v">'+bs.map(htmlBoton).join('');
    if(m&&!c.sellada)h+='<button type="button" class="as-btn peligro" data-acc="suprimir">'+ic('basura','rojo')+' Borrar datos de esta persona</button>';
    if(!bs.length&&!(m&&!c.sellada))h+='<p class="as-nota" style="margin:0">No hay acciones disponibles para esta conversación.</p>';
    h+='</div>'+(m&&!c.sellada?'<p class="as-nota">Borrar datos: solo master. Elimina mensajes, ficha y teléfono; si pidió no recibir mensajes, el bloqueo se mantiene.</p>':'')+'</div>';
    f.innerHTML=h;
  }

  function pintarTodo(){pintarResumen();pintarBloqueos();pintarLista();pintarChat();pintarFicha();bloquearBotones(S.ocupado);}
  function bloquearBotones(on){
    document.querySelectorAll('[data-acc]').forEach(function(b){b.disabled=!!on;});
    var env=$('as-enviar');if(on){env.disabled=true;$('as-adjuntar').disabled=true;}
    var q=$('as-quitar');if(q)q.disabled=!!on;
  }

  // ── Carga ──────────────────────────────────────────────────────────────────
  function firma(c){if(!c)return '';var u=c.ultimo||{};return [c.estado,c.tomada_por,c.opt_out,c.opt_out_posible,c.en_duda,c.sellada,c.last_activity_at,u.id,u.estado_entrega].join('|');}
  function cargarLista(){
    return e4('lista',{limite:200}).then(function(r){
      S.convs=Array.isArray(r.conversaciones)?r.conversaciones:[];S.total=Number(r.total)||S.convs.length;S.parcial=!!r.parcial;S.cargada=true;
    });
  }
  function cargarDetalle(id){
    S.cargandoDet=true;
    return e4('detalle',{conversacion_id:id}).then(function(d){
      if(S.sel!==id)return;                                 // el usuario ya cambió de conversación
      S.det=d;S.cargandoDet=false;
      var n=d&&d.conversacion&&d.conversacion.ficha&&d.conversacion.ficha.nombre;
      if(typeof n==='string'&&n.trim())S.nombres[id]=n.trim();
      S.firmaSel=firma(S.convs.filter(function(x){return x.id===id;})[0]);
    }).catch(function(e){
      if(S.sel!==id)return;
      S.cargandoDet=false;
      if(!S.det||S.det.conversacion.id!==id)S.det=null;
      aviso(e&&e.status===403?'No tienes permiso para ver esta conversación.':'No se pudo cargar la conversación. Intenta de nuevo.',true);
    });
  }
  var _ultimoOk=null;
  function refrescar(primera){
    var pL=cargarLista().then(function(){return null;},function(e){return e;});
    var pR=rpcResumen().then(function(r){S.resumen=r;return null;},function(e){S.resumen=null;return e;});
    var pB=e4('bloqueos').then(function(r){S.bloqueos=Array.isArray(r.bloqueos)?r.bloqueos:[];return null;},function(e){return e;});
    return Promise.all([pL,pR,pB]).then(function(errs){
      var eL=errs[0];
      if(eL){
        if(eL.status===403||eL.codigo==='SIN_PERMISO'){errorGeneral('Este módulo es solo para Master y Comercial.');S.cargada=false;$('as-lista').innerHTML='';}
        else if(primera||!S.cargada){errorGeneral('No se pudieron cargar las conversaciones. Revisa tu conexión y recarga la página.');$('as-lista').innerHTML='<div class="as-vacio">Sin datos: la carga falló.</div>';}
        else errorGeneral('No se pudo actualizar la bandeja'+(_ultimoOk?' (última actualización '+hora(_ultimoOk)+')':'')+'. Los datos pueden estar desactualizados.');
      }else{
        _ultimoOk=new Date().toISOString();errorGeneral('');
      }
      // ¿Cambió la conversación abierta? Solo entonces se vuelve a leer el detalle (cada lectura queda auditada).
      var sel=S.sel&&S.convs.filter(function(x){return x.id===S.sel;})[0];
      if(S.sel&&!eL&&sel&&firma(sel)!==S.firmaSel&&!S.ocupado)return cargarDetalle(S.sel);
    }).then(pintarTodo);
  }
  function abrir(id){
    if(S.sel===id&&S.det)return;
    var ta=$('as-texto');if(S.sel&&ta.getAttribute('data-conv')===S.sel)S.borradores[S.sel]=ta.value;
    S.sel=id;S.det=null;S.firmaSel='';
    pintarLista();pintarChat();pintarFicha();
    cargarDetalle(id).then(function(){pintarLista();pintarChat();pintarFicha();bloquearBotones(S.ocupado);
      if(window.matchMedia('(max-width:900px)').matches)window.scrollTo({top:Math.max(0,$('as-app').getBoundingClientRect().top+window.scrollY-76),behavior:'smooth'});});
  }

  // ── Acciones ───────────────────────────────────────────────────────────────
  var OK_TXT={tomar:'Conversación tomada. La IA no responderá mientras la atiendas.',devolver:'La conversación volvió a la IA.',cerrar:'Conversación cerrada.',
    confirmar_baja:'Baja confirmada. Se le enviará la confirmación y no recibirá más mensajes.',descartar_baja:'Posible baja descartada. La IA retoma la conversación.',
    reactivar:'Conversación reactivada.',dar_por_fallido:'Mensaje marcado como no enviado.',suprimir:'Datos de la persona borrados.',levantar_bloqueo:'Bloqueo levantado.'};
  function ejecutar(acc,extra){
    if(S.ocupado)return;
    S.ocupado=true;bloquearBotones(true);
    var id=S.sel,cuerpo=Object.assign({},extra||{});
    if(acc!=='levantar_bloqueo')cuerpo.conversacion_id=id;
    e4(acc,cuerpo).then(function(){
      aviso(OK_TXT[acc]||'Listo.');
    },function(e){
      aviso(textoError(e),true);
    }).then(function(){
      S.ocupado=false;S.firmaSel='';
      return Promise.all([acc!=='levantar_bloqueo'&&id?cargarDetalle(id):null,refrescar(false)]);
    }).then(pintarTodo);
  }
  function confirmar(op){
    // op: {titulo, texto, boton, peligro, palabra?} → Promise<boolean>
    return new Promise(function(res){
      var v=$('as-velo'),d=$('as-dlg'),previo=document.activeElement;
      d.innerHTML='<h2 id="as-dlg-tit">'+ic(op.peligro?'alerta':'check',op.peligro?'rojo':'morado',true)+' '+esc(op.titulo)+'</h2><p>'+esc(op.texto)+'</p>'
        +(op.palabra?'<label for="as-dlg-in" style="font-size:12.5px;color:#C9A8CC">Para confirmar, escribe <b style="color:#F3E9F4">'+esc(op.palabra)+'</b></label><input id="as-dlg-in" autocomplete="off" spellcheck="false">':'')
        +'<div class="bot"><button type="button" class="as-btn" data-r="0">Cancelar</button><button type="button" class="as-btn '+(op.peligro?'peligro':'pri')+'" data-r="1"'+(op.palabra?' disabled':'')+'>'+esc(op.boton)+'</button></div>';
      v.classList.add('on');
      var inp=$('as-dlg-in'),si=d.querySelector('[data-r="1"]');
      if(inp){inp.addEventListener('input',function(){si.disabled=inp.value.trim()!==op.palabra;});inp.focus();}else si.focus();
      function fin(r){v.classList.remove('on');d.innerHTML='';document.removeEventListener('keydown',tecla,true);if(previo&&previo.focus)previo.focus();res(r);}
      function tecla(e){if(e.key==='Escape'){e.preventDefault();fin(false);}}
      document.addEventListener('keydown',tecla,true);
      d.querySelector('[data-r="0"]').onclick=function(){fin(false);};
      si.onclick=function(){if(op.palabra&&inp.value.trim()!==op.palabra)return;fin(true);};
      v.onclick=function(e){if(e.target===v)fin(false);};
    });
  }
  function alPulsar(btn){
    var acc=btn.getAttribute('data-acc'),c=S.det&&S.det.conversacion;
    if(acc==='levantar_bloqueo'){
      var bid=Number(btn.getAttribute('data-bloqueo'));
      confirmar({titulo:'Levantar bloqueo de consumo',texto:'La IA volverá a responder. Hazlo solo si ya revisaste por qué se detuvo. Queda registrado.',boton:'Levantar bloqueo',peligro:true})
        .then(function(ok){if(ok)ejecutar('levantar_bloqueo',{bloqueo_id:bid});});
      return;
    }
    if(!c)return;
    if(acc==='tomar'||acc==='devolver'||acc==='descartar_baja'){ejecutar(acc);return;}
    if(acc==='cerrar'){confirmar({titulo:'Cerrar conversación',texto:'La conversación queda cerrada. Si la persona vuelve a escribir, se reabre.',boton:'Cerrar'}).then(function(ok){if(ok)ejecutar('cerrar');});return;}
    if(acc==='confirmar_baja'){
      if(!c.opt_out_posible_mensaje_id){aviso('No se encontró el mensaje que originó la posible baja. Actualiza la vista.',true);return;}
      confirmar({titulo:'Confirmar baja',texto:'Se le enviará a la persona el mensaje de confirmación de baja y no recibirá más mensajes (ni de la IA ni del equipo) hasta que se reactive.',boton:'Confirmar baja',peligro:true})
        .then(function(ok){if(ok)ejecutar('confirmar_baja',{mensaje_id:c.opt_out_posible_mensaje_id});});
      return;
    }
    if(acc==='reactivar'){confirmar({titulo:'Reactivar conversación',texto:'Levanta la baja: la persona podrá volver a recibir mensajes. Hazlo solo si ella lo pidió.',boton:'Reactivar'}).then(function(ok){if(ok)ejecutar('reactivar');});return;}
    if(acc==='dar_por_fallido'){
      var env=btn.getAttribute('data-envio');
      confirmar({titulo:'Dar por no enviado',texto:'Marca este mensaje como NO entregado. Úsalo solo si confirmaste que a la persona no le llegó.',boton:'Dar por no enviado'})
        .then(function(ok){if(ok)ejecutar('dar_por_fallido',{envio_id:env});});
      return;
    }
    if(acc==='suprimir'){
      confirmar({titulo:'Borrar datos de esta persona',texto:'Se borran para siempre los mensajes, la ficha y el teléfono de esta conversación. No se puede deshacer. Si pidió no recibir mensajes, el bloqueo se mantiene.',boton:'Borrar datos',peligro:true,palabra:'BORRAR'})
        .then(function(ok){if(ok)ejecutar('suprimir');});
    }
  }
  function enviarRespuesta(ev){
    ev.preventDefault();
    var c=S.det&&S.det.conversacion,ta=$('as-texto'),t=ta.value.trim();
    if(!c||!puedeEscribir(c)||c.opt_out_posible||S.ocupado)return;
    var adj=S.adjuntos[c.id]||null;
    if(adj){
      // Con archivo: responder_adjunto; el texto de la caja es la leyenda (opcional).
      if(t.length>MAX_LEYENDA){aviso('La leyenda supera los 1.000 caracteres.',true);return;}
      if(!MIMES[adj.mime]||adj.tam>MAX_ARCHIVO){aviso('Solo PDF, JPG o PNG de hasta 5 MB.',true);return;}
    }else{
      if(!t){aviso('Escribe un mensaje o adjunta un archivo antes de enviar.',true);return;}
      if(t.length>MAX_TEXTO){aviso('El mensaje supera los 2.000 caracteres.',true);return;}
    }
    var id=c.id;
    S.ocupado=true;bloquearBotones(true);botonEnviando(true);
    var envio=adj
      ?leerBase64(adj.archivo).then(function(b64){
          if(!b64){var e=new Error('contenido');e.status=400;e.codigo='contenido';throw e;}
          var cuerpo={conversacion_id:id,nombre:adj.nombre,mime:adj.mime,contenido:b64};
          if(t)cuerpo.texto=t;
          return e4('responder_adjunto',cuerpo);
        },function(){var e=new Error('LECTURA');e.codigo='LECTURA';throw e;})
      :e4('responder',{conversacion_id:id,texto:t});
    envio.then(function(){
      if(ta.getAttribute('data-conv')===id){ta.value='';}
      delete S.borradores[id];
      if(adj&&S.adjuntos[id]===adj)delete S.adjuntos[id];
      $('as-archivo').value='';
      S.alFondo=id;
      aviso(adj?'Archivo en cola de envío.':'Mensaje en cola de envío.');
    },function(e){
      aviso(e&&e.codigo==='LECTURA'?'No se pudo leer el archivo desde tu equipo. Elígelo de nuevo.':textoError(e,!!adj),true);
    }).then(function(){
      S.ocupado=false;S.firmaSel='';botonEnviando(false);pintarAdjunto();
      return Promise.all([cargarDetalle(id),refrescar(false)]);
    }).then(pintarTodo);
  }

  // ── Eventos de la página ───────────────────────────────────────────────────
  function enlazar(){
    $('as-filtros').addEventListener('click',function(e){var b=e.target.closest('[data-f]');if(!b)return;S.filtro=b.getAttribute('data-f');pintarLista();});
    $('as-q').addEventListener('input',function(){S.q=this.value.trim();pintarLista();});
    $('as-lista').addEventListener('click',function(e){var b=e.target.closest('.as-c');if(b)abrir(b.getAttribute('data-id'));});
    document.addEventListener('click',function(e){
      var v=e.target.closest('[data-volver]');
      if(v){var ta=$('as-texto');if(S.sel)S.borradores[S.sel]=ta.value;S.sel=null;S.det=null;pintarLista();pintarChat();pintarFicha();return;}
      var b=e.target.closest('[data-acc]');if(b&&!b.disabled&&!S.ocupado)alPulsar(b);
    });
    var ta=$('as-texto');
    ta.addEventListener('input',function(){var id=ta.getAttribute('data-conv');if(id)S.borradores[id]=ta.value;contarTexto();});
    ta.addEventListener('keydown',function(e){if(e.key==='Enter'&&(e.metaKey||e.ctrlKey)){e.preventDefault();$('as-comp').requestSubmit();}});
    $('as-comp').addEventListener('submit',enviarRespuesta);
    $('as-adjuntar').innerHTML=SVG_CLIP;
    $('as-adjuntar').addEventListener('click',function(){if(!this.disabled&&!S.ocupado)$('as-archivo').click();});
    $('as-archivo').addEventListener('change',function(){var f=this.files&&this.files[0];this.value='';elegirArchivo(f);});
    $('as-chip').addEventListener('click',function(e){
      if(!e.target.closest('#as-quitar')||S.ocupado)return;
      var id=$('as-texto').getAttribute('data-conv');if(id)delete S.adjuntos[id];
      pintarAdjunto();$('as-texto').focus();
    });
    document.addEventListener('visibilitychange',function(){if(!document.hidden&&S.iniciado)refrescar(false);});
  }

  // Refresco liviano: lista + contadores + bloqueos. No toca la caja de respuesta ni el buscador.
  function tic(){if(!$('as-app')||document.hidden||S.ocupado||$('as-velo').classList.contains('on'))return;refrescar(false);}

  // Aviso push → /asistente/?c=<id>: abre esa conversación (si está en la lista) y limpia la URL para que recargar no la reabra.
  function abrirDesdeAviso(){
    var m=/(?:^|[?&])c=([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:&|$)/i.exec(location.search.slice(1));
    if(!m)return;
    var id=m[1].toLowerCase();
    try{history.replaceState(null,'',location.pathname+location.search.replace(/([?&])c=[^&]*(&|$)/,function(_,a,b){return b?a:'';}).replace(/[?&]$/,'')+location.hash);}catch(e){}
    if(S.convs.some(function(x){return x.id===id;}))abrir(id);
    else aviso('Esa conversación ya no está en la bandeja (pudo cerrarse o ser atendida).',false);
  }
  function iniciar(){
    if(S.iniciado||!$('as-app'))return;                    // acceso denegado: auth.js reemplazó la página
    S.iniciado=true;
    if(DEMO)$('as-demo').classList.add('on');
    pintarFiltros();
    cargarYo().then(function(){return refrescar(true);}).then(abrirDesdeAviso);
    setInterval(tic,REFRESCO_MS);
  }

  enlazar();
  // Se empieza a leer SOLO cuando auth.js verificó la sesión y el acceso al módulo (retira auth-pending).
  var raiz=document.documentElement;
  if(!raiz.classList.contains('auth-pending'))iniciar();
  else new MutationObserver(function(_,obs){if(!raiz.classList.contains('auth-pending')){obs.disconnect();iniciar();}}).observe(raiz,{attributes:true,attributeFilter:['class']});
})();
