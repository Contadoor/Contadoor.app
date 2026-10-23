/* ============================================================
   facturacion/adicional-real.js — "Facturación adicional" REAL (F1c)
   Factura puntual EXCEPCIONAL (decisión de Luciano 20-oct): el facturador la crea con motivo obligatorio,
   el Master la aprueba con la huella que vio y el facturador la emite (siempre factura exenta DTE 34).
   Motor: RPC factura_adicional_* (SQL 202610231900) · Emisión: Edge facturacion-emitir (OpenFactura).
   · PRUEBA: ambiente de pruebas de OpenFactura (sin SII, documento "sin validez tributaria").
   · PRODUCCION: bloqueado mientras facturacion_parametros.produccion_habilitada = false (el servidor lo exige igual).
   Solo se activa fuera del modo demo; en demo sigue el editor de adicional.js. Sin datos reales en este archivo.

   Rediseño visual (23-oct, pedido de Luciano tras emitir una factura REAL creyendo que era de prueba):
   · Cartera (línea MiRenta): totales, semáforo, buscador, filtros (estado, "Ocultar pruebas", cliente, creador con foto), CSV y tarjetas en celular.
   · "Nueva factura" como asistente en 3 pasos: Cliente → Detalle → Revisar. Desde la pantalla la factura nueva es SIEMPRE REAL (SII):
     la opción "Prueba" se quitó (Luciano, PR #84). El servidor sigue aceptando modo PRUEBA para las pruebas automáticas y DEV:
     para practicar se usa el entorno local/DEV. Las PRUEBAS antiguas se ven en la cartera con su chip (filtro "Ocultar pruebas").
   · Franja fija roja "FACTURA REAL · se enviará al SII" mientras se crea, revisa o emite una factura real.
   · Crear pide escribir la palabra REAL; emitir una REAL exige la palabra REAL y reescribir el total. Con la emisión desactivada
     (produccion_habilitada=false) se pueden crear y aprobar borradores, pero "Emitir" queda deshabilitado con su motivo.
   · Detalle con línea de tiempo, folio, PDF/XML, estado en Cobranza y espacio para la futura nota de crédito.
   Las RPC, los permisos y los mensajes de error son los mismos de antes: aquí cambia solo la presentación y el flujo de pantalla.
   ============================================================ */
(function(){
'use strict';
if(window.FX_DEMO===true)return;                       // en demo manda adicional.js
var U=window.FX_UTIL, UI=window.FX_UI;
var ic=U.ic, I=U.I, esc=U.esc, clp=U.clp;
var modal=UI.modal, toast=UI.toast, cerrarModal=UI.cerrarModal;
var EDGE=(typeof SB_URL!=='undefined'?SB_URL:'')+'/functions/v1/facturacion-emitir';
var CTX={yo:null,yoNombre:'',rol:'lectura',lista:[],clientes:{},clientesLista:[],prodHabilitada:false,ocupado:false,cargado:false,
  usuarios:{},eventos:{},vista:'cartera',detId:null,wiz:null,franjaModal:null,resaltada:null,fuera:false,
  f:{q:'',est:'todos',ocultarPruebas:true,cli:'',resp:'todos'}};
function $(id){return document.getElementById(id);}
function hoyCL(){var d=new Date(Date.now()-new Date().getTimezoneOffset()*60000);return d.toISOString().slice(0,10);}
function sumarDias(iso,n){var t=new Date(iso+'T12:00:00');t.setDate(t.getDate()+n);return t.toISOString().slice(0,10);}
function fFecha(iso){if(!iso)return '—';var p=String(iso).slice(0,10).split('-');return p[2]+'-'+p[1]+'-'+p[0];}
function fHora(iso){if(!iso)return '';var d=new Date(iso);if(isNaN(d))return '';function z(n){return (n<10?'0':'')+n;}return z(d.getDate())+'-'+z(d.getMonth()+1)+'-'+d.getFullYear()+' · '+z(d.getHours())+':'+z(d.getMinutes());}
var EMISOR_NOMBRE='Asesorías Contadoor Ltda.';   // razón social del emisor (el RUT y la dirección los pone el servidor al congelar)

var EST={BORRADOR:['Borrador','gris'],EN_REVISION:['En revisión del Master','cel'],DEVUELTA:['Devuelta','amb'],APROBADA:['Aprobada · lista para emitir','ver'],
  EMITIENDO:['Emitiendo…','cel'],INCIERTO:['Incierta · por conciliar','ama'],EMITIDA:['Emitida','ver'],ERROR:['Rechazada por OpenFactura','roj'],ANULADA:['Anulada','gris']};
/* Semáforo de la cartera (siempre con texto, nunca solo color): rojo = requiere atención · ámbar = espera una acción · verde = emitida */
var SEM={BORRADOR:['gris','Borrador'],DEVUELTA:['ambar','Devuelta'],EN_REVISION:['ambar','Por aprobar'],APROBADA:['ambar','Por emitir'],EMITIENDO:['cel','Emitiendo'],
  INCIERTO:['rojo','Incierta'],ERROR:['rojo','Con error'],EMITIDA:['verde','Emitida'],ANULADA:['gris','Anulada']};
var GRUPOS={todos:['Todos',null],borrador:['Borrador o devuelta',['BORRADOR','DEVUELTA']],revision:['Por aprobar',['EN_REVISION']],emitir:['Por emitir',['APROBADA','EMITIENDO']],
  emitidas:['Emitidas',['EMITIDA']],problemas:['Inciertas o con error',['INCIERTO','ERROR']],anuladas:['Anuladas',['ANULADA']]};
var ERR={
  SOLO_FACTURADOR:'Esta acción la hace solo el facturador (rol Pagos o módulo Facturación).',
  SOLO_MASTER:'Esta acción la hace solo el Master.',
  CAMPO_NO_PERMITIDO:'Hay un dato que no corresponde. Recarga la pantalla.',
  MOTIVO_OBLIGATORIO:'El motivo es obligatorio: explica por qué es una factura excepcional (10 a 500 caracteres).',
  MOTIVO_ANULACION:'El motivo de la anulación es obligatorio (mínimo 10 caracteres).',
  TEXTO_NO_PERMITIDO:'No uses la palabra "honorarios": escribe "nuestros servicios".',
  GLOSA_INVALIDA:'Cada glosa debe tener entre 3 y 80 caracteres.',
  DETALLE_INVALIDO:'El detalle de una línea es demasiado largo (máximo 1000).',
  CANTIDAD_INVALIDA:'La cantidad debe ser un número entero entre 1 y 1000.',
  MONTO_INVALIDO:'El precio debe ser en pesos enteros, mayor a $0.',
  LINEAS_INVALIDAS:'La factura debe tener entre 1 y 10 líneas.',
  LINEA_CAMPO_NO_PERMITIDO:'Una línea trae un dato que no corresponde. Recarga la pantalla.',
  FECHA_INVALIDA:'Revisa las fechas.',
  FECHA_EMISION_FUERA_DE_RANGO:'La fecha de emisión debe estar entre 5 días atrás y hoy (al emitir). Si cambió, el Master la devuelve y se corrige.',
  FECHA_VENCIMIENTO_OBLIGATORIA:'Con crédito indica la fecha de vencimiento.',
  FECHA_VENCIMIENTO_INVALIDA:'El vencimiento debe estar entre 1 y 90 días después de la emisión.',
  FORMA_PAGO_INVALIDA:'Elige contado o crédito.',
  CLIENTE_NO_EXISTE:'Elige un cliente de la lista.',
  FICHA_INCOMPLETA:'La ficha del cliente está incompleta.',
  NO_EDITABLE:'La factura ya no se puede modificar en su estado actual. Recarga.',
  NO_EN_REVISION:'La factura ya no está en revisión (otra persona pudo actuar). Recarga.',
  HUELLA_NO_COINCIDE:'La factura cambió desde que la abriste: recarga y revísala de nuevo antes de aprobar.',
  COMENTARIO_OBLIGATORIO:'El comentario es obligatorio (mínimo 5 caracteres).',
  NO_DEVOLVIBLE:'Ya no se puede devolver: hubo un intento de emisión.',
  NO_ANULABLE:'No se puede anular: pudo llegar a OpenFactura (concilia primero) o ya está emitida (se corrige con nota de crédito).',
  SIN_APROBACION:'Falta la aprobación del Master.',
  PRODUCCION_DESHABILITADA:'La emisión está desactivada; pide al Master activarla.',
  PRODUCCION_NO_HABILITADA_EN_EDGE:'La emisión real está apagada en el servidor (falta el GO de producción).',
  YA_EMITIDA:'Esta factura ya está emitida: no se vuelve a emitir.',
  REQUIERE_CONCILIACION:'Resultado incierto: el Master debe conciliar con OpenFactura antes de cualquier reintento.',
  EN_CURSO:'La factura ya se está emitiendo. Espera y recarga.',
  NO_INCIERTA:'Solo se concilian facturas inciertas.',
  TOKEN_INVALIDO:'El token debe tener 64 caracteres (letras a–f y números).',
  SIN_SESION:'Tu sesión no está activa. Vuelve a ingresar.',
  SOLO_FACTURACION:'No tienes acceso a la lista de clientes de Facturación (Master, Pagos, Cobranza o módulo Facturación).',
  AUTOAPROBACION_REQUIERE_CONFIRMACION:'Creaste esta factura: usa "Auto-aprobar", que pide confirmar y reescribir el total.',
  CONFIRMACION_OBLIGATORIA:'Marca la casilla: estás aprobando una factura que creaste tú.',
  TOTAL_CONFIRMADO_NO_COINCIDE:'El total que escribiste no coincide con el de la factura.',
  TOTAL_CONFIRMADO_FORMATO:'Escribe el total solo con números, por ejemplo 10000 o 10.000 (sin signo, decimales, comas ni letras).',
  TOTAL_CONFIRMADO_VACIO:'Reescribe el total de la factura para confirmar.',
  NO_ES_TUYA:'Solo puedes auto-aprobar facturas que creaste tú; esta se aprueba con "Aprobar".',
  CONFIG_DEV_INCOMPLETA:'Falta configurar el ambiente de pruebas en el servidor. Avisa a soporte.',
  // Mensajes propios de la pantalla (no vienen del motor)
  EMISION_DESACTIVADA:'La emisión está desactivada; pide al Master activarla.',
  PALABRA_REAL:'Para confirmar una factura REAL escribe la palabra REAL en el recuadro.'
};
function msg(e){
  var m=String(e&&(e.codigo||e.message)||'');
  var code=(m.match(/^([A-Z_]{4,})/)||[])[1];
  if(code==='FICHA_INCOMPLETA'){var d=m.split(':').slice(2).join(':').trim();return ERR.FICHA_INCOMPLETA+(d?' Completa en Clientes: '+d+'.':'');}
  if(code&&ERR[code])return ERR[code];
  if(m==='GESTOOR_NO_SESSION')return ERR.SIN_SESION;
  if(/Failed to fetch|NetworkError/i.test(m))return 'No hay conexión con el servidor. Revisa internet y vuelve a intentar.';
  return 'El motor rechazó la acción ('+(code||'error')+'). No se guardó nada.';
}

/* ── Datos ── */
function rpc(fn,args){
  return sbFetch('rpc/'+fn,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(args||{})}).then(function(r){
    if(r.ok)return r.status===204?null:r.json();
    return r.text().then(function(t){var j={};try{j=JSON.parse(t);}catch(x){}var e=new Error(j.message||t||('HTTP '+r.status));throw e;});
  });
}
function edge(accion,id,extra){
  var h;try{h=sbH();}catch(e){return Promise.reject(e);}   // JWT del usuario; sin sesión no se llama
  return fetch(EDGE,{method:'POST',headers:h,body:JSON.stringify(Object.assign({accion:accion,factura_id:id},extra||{}))}).then(function(r){
    return r.json().catch(function(){return {};}).then(function(j){if(!r.ok){var e=new Error(j.error||('HTTP '+r.status));e.codigo=j.error;throw e;}return j;});
  });
}
// Lectura (misma RLS fact_puede_leer). Se agregan solo columnas de fecha/autor para la línea de tiempo del detalle.
var CAMPOS='id,codigo,modo,estado,cliente_id,creado_por,auto_aprobada_master,motivo,lineas,total,fecha_emision,fecha_vencimiento,forma_pago,alertas,snapshot,snapshot_hash,comentario_devolucion,of_folio,of_track_id,total_dte,error,doc_estado,correo_estado,cobranza_documento_id,creado_at,aprobada_at,emitida_at'
  +',enviada_at,enviada_por,aprobada_por,devuelta_at,anulada_at,motivo_anulacion';
/* Enlace de los avisos de la campana: ?tab=adicional&fa=<id>. Se lee UNA vez; solo un id numérico. La factura se busca con la misma
   RLS del usuario (si no la ve, no existe para él): primero en la lista cargada y, si no está (más antigua que las 200), por id.
   Rediseño: además de resaltar su fila en la cartera, se abre directo su detalle. */
var ENLACE_FA=(function(){try{var v=new URLSearchParams(location.search).get('fa');return v&&/^[0-9]{1,18}$/.test(v)?+v:null;}catch(e){return null;}})();
if(ENLACE_FA!==null)CTX.f.ocultarPruebas=false;
function irAFacturaEnlace(){
  if(ENLACE_FA===null)return Promise.resolve();
  var id=ENLACE_FA;ENLACE_FA=null;
  var ya=CTX.lista.filter(function(x){return x.id===id;})[0];
  var p=ya?Promise.resolve(ya):sbGet('facturas_adicionales?select='+CAMPOS+'&id=eq.'+id).then(function(r){var x=r&&r[0];if(x){CTX.lista.push(x);render();}return x||null;});
  return p.then(function(x){
    if(!x){toast(I('alerta','ic-amb')+' No encontramos la factura del aviso (#'+id+'): no existe o no tienes acceso.');return;}
    // La fila queda resaltada 6 s en la cartera (el resaltado vive en el estado: sobrevive a los re-dibujos) y se abre su detalle.
    CTX.resaltada=x.id;setTimeout(function(){if(CTX.resaltada===x.id){CTX.resaltada=null;pintarTabla();}},6000);
    abrirDetalle(x.id,true);
    var el=document.querySelector('#vistaAdic [data-fa-card="'+x.id+'"]');
    if(el&&el.scrollIntoView)el.scrollIntoView({behavior:'smooth',block:'center'});
    toast(I('factura','ic-ama')+' '+esc(x.codigo)+' · '+esc((EST[x.estado]||[x.estado])[0]));
  });
}
function cargar(){
  return Promise.all([
    sbGet('facturas_adicionales?select='+CAMPOS+'&order=creado_at.desc&limit=200'),
    sbGet('facturacion_parametros?select=produccion_habilitada&id=eq.1'),
    CTX.yo!==null?Promise.resolve(null):rpc('facturacion_yo',{}).catch(function(){return null;}),
    CTX.clientesLista.length?Promise.resolve(null):rpc('fact_clientes_lista',{p_incluir_inactivos:true})   // RPC: Facturación ve todos los clientes sin abrir la RLS de clientes; el selector filtra 'activo' abajo
  ]).then(function(r){
    CTX.lista=r[0]||[];CTX.prodHabilitada=!!(r[1]&&r[1][0]&&r[1][0].produccion_habilitada);
    if(r[2]&&r[2].usuario_id!=null){CTX.yo=+r[2].usuario_id;CTX.yoNombre=r[2].nombre||'';}
    if(r[3]){CTX.clientesLista=r[3].filter(function(c){return String(c.estado||'').toLowerCase()==='activo';});r[3].forEach(function(c){CTX.clientes[c.id]=c;});}
    CTX.cargado=true;
    cargarUsuarios(CTX.lista.map(function(x){return x.creado_por;}));
  });
}
/* Nombres del equipo para la foto del creador y la línea de tiempo. Lectura con la RLS del usuario: si no puede ver a alguien,
   se muestra "Usuario #id" con un círculo neutro (nunca falla la pantalla por esto). */
function cargarUsuarios(ids){
  var falta=[];(ids||[]).forEach(function(i){i=+i;if(i&&isFinite(i)&&!(i in CTX.usuarios)&&falta.indexOf(i)<0)falta.push(i);});
  if(!falta.length||typeof sbGet!=='function')return Promise.resolve();
  falta.forEach(function(i){CTX.usuarios[i]=null;});
  return Promise.resolve().then(function(){return sbGet('usuarios_sistema?select=id,nombre&id=in.('+falta.join(',')+')');}).then(function(r){
    var cambio=false;(r||[]).forEach(function(u){if(u&&u.id!=null&&u.nombre){CTX.usuarios[+u.id]=String(u.nombre);cambio=true;}});
    if(cambio)render();
  }).catch(function(){});
}

/* ── Utilidades de vista ── */
function chipEst(e,grande){var x=EST[e]||[e,'gris'];return '<span class="fx-est '+x[1]+(grande?' grande':'')+'">'+esc(x[0])+'</span>';}
function chipTipo(modo,grande){
  return modo==='PRODUCCION'
    ?'<span class="fa-tipo real'+(grande?' grande':'')+'" title="Factura real: se emite en el SII">'+ic('factura')+'REAL</span>'
    :'<span class="fa-tipo pru'+(grande?' grande':'')+'" title="Ambiente de pruebas de OpenFactura, sin SII">'+ic('probeta')+'PRUEBA</span>';
}
function cli(id){var c=CTX.clientes[id];return c?c.razon_social:'Cliente #'+id;}
function rutCli(id){var c=CTX.clientes[id];return c?c.rut:'';}
function esF(){return CTX.rol==='facturador';}
function esM(){return CTX.rol==='master';}
function nombreUsuario(id){
  if(id==null)return '';
  if(CTX.yo!==null&&+id===CTX.yo)return CTX.yoNombre||'Tú';
  return CTX.usuarios[+id]||'';
}
function avatar(id,tam){
  var n=nombreUsuario(id), EQ=window.GEquipo;
  if(!n)return '<span class="geq-av'+(tam?' geq-'+tam:'')+' fa-av-anon" role="img" aria-label="Usuario #'+esc(id)+'">#</span>';
  if(EQ&&EQ.avatar)return EQ.avatar(n,{tam:tam});
  var p=n.split(/\s+/).filter(Boolean), ini=((p[0]||'?').charAt(0)+(p.length>1?p[p.length-1].charAt(0):'')).toUpperCase();
  return '<span class="geq-av'+(tam?' geq-'+tam:'')+'" role="img" aria-label="'+esc(n)+'">'+esc(ini)+'</span>';
}
function persona(id){
  if(id==null)return '<span class="fa-quien nd">—</span>';
  var n=nombreUsuario(id), tu=CTX.yo!==null&&+id===CTX.yo;
  return '<span class="fa-quien">'+avatar(id,'xs')+'<span>'+esc(n||('Usuario #'+id))+(tu&&n!=='Tú'?' <small>(tú)</small>':'')+'</span></span>';
}
function glosaPrincipal(x){var lin=x.lineas||[];return lin.length?lin[0].glosa+(lin.length>1?' + '+(lin.length-1)+' más':''):'—';}
/* @total-confirmado-inicio · Total reescrito en la auto-aprobación: se valida el texto COMPLETO (sin quitar caracteres).
   Formato chileno permitido: solo dígitos ("10000") o miles con punto ("10.000"); sin signo, decimales, comas, letras ni espacios
   internos; se recortan solo los espacios de los extremos. Devuelve {ok:true,valor} o {ok:false,motivo}. */
function totalConfirmadoDesdeTexto(txt){
  var t=String(txt==null?'':txt).trim();
  if(t==='')return {ok:false,motivo:'VACIO'};
  if(!/^(?:[1-9][0-9]*|[1-9][0-9]{0,2}(?:\.[0-9]{3})+)$/.test(t))return {ok:false,motivo:'FORMATO'};
  var n=Number(t.replace(/\./g,''));
  if(!Number.isSafeInteger(n)||n<=0)return {ok:false,motivo:'FORMATO'};
  return {ok:true,valor:n};
}
/* @total-confirmado-fin */
/* @palabra-real-inicio · Confirmación de una factura REAL: hay que escribir la palabra REAL (se aceptan minúsculas y espacios en los
   extremos; nada más: "REALES", "RE AL" o "sí" no sirven). */
function palabraRealOk(txt){return String(txt==null?'':txt).trim().toUpperCase()==='REAL';}
/* @palabra-real-fin */
// F1c-M (Luciano 23-oct): el Master también crea, edita, envía y emite. La aprobación sigue siendo un paso aparte.
function esOp(){return esF()||esM();}
function esMia(x){return CTX.yo!==null&&+x.creado_por===CTX.yo;}
function bot(a,id){
  return '<span class="tipw" tabindex="'+(a.ok?'-1':'0')+'" data-tip="'+esc(a.tip||'')+'"><button type="button" class="g-btn sm '+(a.cls||'')+'" data-fa="'+a.act+'" data-id="'+id+'"'+(a.ok&&!CTX.ocupado?'':' disabled')+'>'+I(a.icn,a.icc||'')+esc(a.txt)+'</button></span>';
}
/* Acciones posibles de una factura. MISMAS condiciones de permiso y estado que antes del rediseño (solo cambió cómo se dibujan). */
function accionesLista(x){
  var a=[], prod=x.modo==='PRODUCCION';
  function A(act,txt,icn,cls,ok,tip,icc){a.push({act:act,txt:txt,icn:icn,cls:cls,ok:ok,tip:tip,icc:icc});}
  if(esOp()&&(x.estado==='BORRADOR'||x.estado==='DEVUELTA')){A('editar','Editar','lapiz','',true,'');A('enviar','Enviar a aprobación','enviar','pri',true,'Congela el contenido y lo envía al Master.');}
  if(esM()&&x.estado==='EN_REVISION'&&esMia(x)){A('autoaprobar','Auto-aprobar (la creaste tú)','escudo','pri',true,'Paso aparte: confirmas y reescribes el total. Queda marcada y se avisa al equipo.');A('devolver','Devolver','devolver','',true,'');}
  else if(esM()&&x.estado==='EN_REVISION'){A('aprobar','Aprobar','aprobar','pri',true,'Apruebas exactamente lo que ves (huella).');A('devolver','Devolver','devolver','',true,'');}
  if(esM()&&x.estado==='APROBADA')A('devolver','Devolver','devolver','',true,'Solo si aún no hubo intento de emisión.');
  if(x.estado==='APROBADA'||x.estado==='ERROR'||x.estado==='EN_REVISION'||x.estado==='BORRADOR'||x.estado==='DEVUELTA'){
    var puede=esOp()&&(x.estado==='APROBADA'||x.estado==='ERROR')&&(!prod||CTX.prodHabilitada);
    var tip=!esOp()?'Emite el facturador o el Master.':(x.estado!=='APROBADA'&&x.estado!=='ERROR'?'Bloqueado: falta la aprobación del Master.':(prod&&!CTX.prodHabilitada?ERR.EMISION_DESACTIVADA:(prod?'Emite la factura REAL en el SII.':'Emite en el ambiente de pruebas de OpenFactura (sin SII).')));
    A('emitir',prod?'Emitir factura real':'Emitir (prueba)','enviar',puede?(prod?'pri fa-btn-real':'pri'):'',puede,tip);
  }
  if(esM()&&x.estado==='INCIERTO')A('conciliar','Conciliar con OpenFactura','repetir','pri',true,'Busca el documento con la misma clave; nunca emite dos veces.');
  if(x.estado==='EMITIDA'&&x.doc_estado==='OBTENIDOS'){A('pdf','PDF','bajar','',true,'PDF oficial de OpenFactura');A('xml','XML','bajar','',true,'XML firmado');}
  if(x.estado==='EMITIDA'&&x.doc_estado!=='OBTENIDOS'&&(esF()||esM()))A('documentos','Traer PDF y XML','repetir','',true,'Vuelve a pedir los documentos (no reemite).');
  if(esM()&&['BORRADOR','EN_REVISION','DEVUELTA','APROBADA','ERROR'].indexOf(x.estado)>=0)A('anular','Anular','basura','',true,'');
  return a;
}
function accionPrincipal(x){return accionesLista(x).filter(function(a){return a.ok&&/\bpri\b/.test(a.cls);})[0]||null;}
/* Con la emisión desactivada, la fila de una REAL lista para emitir muestra "Emitir" DESHABILITADO con su motivo (se ve, no se esconde). */
function accionFila(x){
  var pr=accionPrincipal(x);if(pr)return pr;
  if(x.modo==='PRODUCCION'&&!CTX.prodHabilitada&&esOp()&&(x.estado==='APROBADA'||x.estado==='ERROR'))return accionesLista(x).filter(function(a){return a.act==='emitir';})[0]||null;
  return null;
}

/* ── Vista previa tipo factura (wizard paso 4, detalle y ventanas de aprobar/emitir) ── */
function facturaHtml(o){
  var real=o.modo==='PRODUCCION';
  return '<article class="fa-doc '+(real?'real':'pru')+(o.compacta?' compacta':'')+'" aria-label="Vista previa de la factura">'
   +'<div class="fa-doc-sello">'+(real?ic('factura')+'FACTURA REAL · SII':ic('probeta')+'PRUEBA · SIN VALIDEZ TRIBUTARIA')+'</div>'
   +'<header class="fa-doc-h"><div class="fa-doc-em"><small>Emisor</small><b>'+esc(o.emisor||EMISOR_NOMBRE)+'</b>'+(o.emisorRut?'<span class="cifra">RUT '+esc(o.emisorRut)+'</span>':'')+(o.emisorDir?'<span>'+esc(o.emisorDir)+'</span>':'')+'</div>'
   +'<div class="fa-doc-caja"><span>Factura no afecta o exenta electrónica</span><b>DTE 34</b><span class="cifra">'+(o.folio?'N° '+esc(o.folio):(o.codigo?esc(o.codigo):'Folio al emitir'))+'</span></div></header>'
   +'<section class="fa-doc-rec"><small>Receptor</small><b>'+esc(o.receptor||'—')+'</b><span class="cifra">'+(o.rut?'RUT '+esc(o.rut):'')+'</span>'
   +(o.recExtra?'<span>'+esc(o.recExtra)+'</span>':'')+(o.recNota?'<span class="fa-doc-nota">'+esc(o.recNota)+'</span>':'')+'</section>'
   +'<div class="fa-doc-meta"><div><small>Emisión</small><b class="cifra">'+fFecha(o.fecha)+'</b></div><div><small>Condición de pago</small><b>'+esc(o.condicion||'—')+'</b></div>'
   +'<div><small>Vencimiento</small><b class="cifra">'+(o.venc?fFecha(o.venc):'—')+'</b></div></div>'
   +'<table class="fa-doc-lin"><thead><tr><th>Glosa</th><th class="num">Cant.</th><th class="num">Precio</th><th class="num">Monto</th></tr></thead><tbody>'
   +(o.lineas||[]).map(function(l){return '<tr><td><b>'+esc(l.glosa||'—')+'</b>'+(l.detalle?'<small>'+esc(l.detalle)+'</small>':'')+'</td><td class="num cifra">'+(l.cantidad||0)+'</td><td class="num cifra">'+clp(l.precio)+'</td><td class="num cifra">'+clp(l.monto)+'</td></tr>';}).join('')
   +'</tbody></table>'
   +'<footer class="fa-doc-tot"><span>Total exento</span><b class="cifra">'+clp(o.total)+'</b></footer>'
   +'</article>';
}
function docDeFactura(x,compacta){
  var s=x.snapshot||null, rf=s&&s.receptor_ficha||{}, em=s&&s.emisor||{};
  var lineas=s&&s.detalle?s.detalle.map(function(d){return {glosa:d.NmbItem,detalle:d.DscItem,cantidad:d.QtyItem,precio:d.PrcItem,monto:d.MontoItem};})
    :(x.lineas||[]).map(function(l){return {glosa:l.glosa,detalle:l.detalle,cantidad:l.cantidad,precio:l.precio,monto:(+l.cantidad||0)*(+l.precio||0)};});
  return facturaHtml({modo:x.modo,compacta:compacta,emisor:em.RznSoc,emisorRut:em.RUTEmisor,emisorDir:em.DirOrigen,folio:x.of_folio,codigo:x.codigo,
    receptor:rf.razon_social||cli(x.cliente_id),rut:rf.rut||rutCli(x.cliente_id),recExtra:s?[rf.giro,[rf.direccion,rf.comuna].filter(Boolean).join(', ')].filter(Boolean).join(' · '):'',
    recNota:s?'':'Giro, dirección y correo se toman de la ficha del cliente al enviar a aprobación.',
    fecha:s&&s.fecha_emision||x.fecha_emision,condicion:s&&s.termino_pago||(x.forma_pago===1?'Contado':'Crédito'),venc:x.forma_pago===1?null:x.fecha_vencimiento,
    lineas:lineas,total:s&&s.montos?+s.montos.total:+x.total});
}

/* ── Franja fija REAL / PRUEBA ── */
function modoActivo(){
  if(CTX.franjaModal)return CTX.franjaModal;
  var v=$('vistaAdic');if(CTX.fuera||!v||v.hidden)return null;
  if(CTX.vista==='nueva'&&CTX.wiz)return CTX.wiz.modo||null;
  if(CTX.vista==='detalle'){var x=porId(CTX.detId);return x?x.modo:null;}
  return null;
}
function pintarFranja(){
  var m=modoActivo(), b=document.body, f=$('faFranja');
  if(!f){f=document.createElement('div');f.id='faFranja';f.className='fa-franja';f.setAttribute('role','status');f.setAttribute('aria-live','polite');b.appendChild(f);}
  b.classList.toggle('fa-con-franja',m==='PRODUCCION');b.classList.toggle('fa-franja-real',m==='PRODUCCION');
  f.className='fa-franja'+(m==='PRODUCCION'?' real':'');   // la franja celeste de PRUEBA se quitó junto con la opción Prueba
  f.innerHTML=m==='PRODUCCION'?ic('factura')+'<b>FACTURA REAL</b><span>· se enviará al SII a nombre de '+esc(EMISOR_NOMBRE)+'</span>'
    :'';
  f.hidden=m!=='PRODUCCION';
}
// Al cambiar a los grupos FIJO/VARIABLE se quita la franja (la pestaña adicional queda oculta).
document.addEventListener('click',function(e){var b=e.target.closest('[data-vista]');if(b){CTX.fuera=b.getAttribute('data-vista')!=='ADICIONAL';pintarFranja();}},true);

/* ── Render general ── */
function porId(id){return CTX.lista.filter(function(y){return y.id===id;})[0]||null;}
function render(){
  var v=$('vistaAdic');if(!v)return;
  if(CTX.vista==='detalle'&&!porId(CTX.detId))CTX.vista='cartera';
  var foco=document.activeElement&&document.activeElement.id==='faBuscar';
  v.classList.add('fa2');
  v.innerHTML='<div id="faCartera"'+(CTX.vista==='cartera'?'':' hidden')+'>'+htmlCartera()+'</div>'
    +'<div id="faPanel">'+(CTX.vista==='nueva'?htmlWizard():(CTX.vista==='detalle'?htmlDetalle(porId(CTX.detId)):''))+'</div>';
  pintarTabla();
  renderHero();
  pintarFranja();
  if(foco){var q=$('faBuscar');if(q){q.focus();try{q.setSelectionRange(q.value.length,q.value.length);}catch(e){}}}
}
/* "Ocultar pruebas" (activado por defecto): esconde el histórico de PRUEBAS cerradas (emitidas o anuladas, p. ej. FA-0001..0003).
   Una PRUEBA que aún está en curso (borrador, en revisión, aprobada, incierta, con error) se sigue mostrando para que alguien la cierre. */
function visible(x){return !CTX.f.ocultarPruebas||x.modo!=='PRUEBA'||(x.estado!=='EMITIDA'&&x.estado!=='ANULADA');}
function listaVisible(){return CTX.lista.filter(visible);}
function nPruebasOcultas(){return CTX.lista.length-listaVisible().length;}
function totales(){
  var L=listaVisible(), mes=hoyCL().slice(0,7);
  function suma(a){return a.reduce(function(s,x){return s+ +x.total;},0);}
  var rev=L.filter(function(x){return x.estado==='EN_REVISION';}), emi=L.filter(function(x){return x.estado==='APROBADA'||x.estado==='EMITIENDO';});
  var mesE=L.filter(function(x){return x.estado==='EMITIDA'&&String(x.emitida_at||'').slice(0,7)===mes;});
  var prob=L.filter(function(x){return x.estado==='INCIERTO'||x.estado==='ERROR';});
  return {rev:rev,emi:emi,mesE:mesE,prob:prob,suma:suma};
}
function renderHero(){
  var h=$('hero');if(!h)return;
  if(CTX.vista!=='cartera'){
    var x=CTX.vista==='detalle'?porId(CTX.detId):null, w=CTX.wiz;
    h.innerHTML='<div class="hero-top"><div><small class="k">Facturación adicional</small><h2>'+(x?esc(x.codigo)+' · <span>'+esc(cli(x.cliente_id))+'</span>':(w&&w.edit?'Editar <span>'+esc(w.edit.codigo)+'</span>':'Nueva <span>factura</span>'))+'</h2>'
      +'<div class="meta"><span class="it">'+I('factura','ic-mor')+'Factura exenta <b>DTE 34</b></span><span class="it">'+I('escudo','ic-cel')+'Siempre con aprobación del Master</span></div></div>'
      +'<div class="estado-lote">'+(x?chipTipo(x.modo,true)+chipEst(x.estado,true):(w&&w.modo?chipTipo(w.modo,true):'<span class="fx-est gris grande">Tipo sin elegir</span>'))+'</div></div>';
    return;
  }
  var t=totales(), mes=t.mesE, real=mes.filter(function(x){return x.modo==='PRODUCCION';}).length;
  function k(grupo,cls,icn,icc,l,n,monto,sub){var on=CTX.f.est===grupo;
    return '<button type="button" class="fa-k '+cls+(on?' on':'')+'" data-fa-grupo="'+grupo+'" aria-pressed="'+on+'"><span class="l">'+I(icn,icc)+esc(l)+'</span><span class="v cifra">'+n+'</span><span class="m cifra">'+clp(monto)+'</span><span class="s">'+sub+'</span></button>';}
  var vivas=listaVisible().filter(function(x){return x.estado!=='ANULADA';}), nV=vivas.length||1;
  var nEm=vivas.filter(function(x){return x.estado==='EMITIDA';}).length, nPr=t.prob.length, nBo=vivas.filter(function(x){return x.estado==='BORRADOR'||x.estado==='DEVUELTA';}).length, nEs=vivas.length-nEm-nPr-nBo;
  function pc(n){return (n*100/nV).toFixed(2)+'%';}
  h.innerHTML='<div class="hero-top"><div><small class="k">Facturas excepcionales</small><h2>Facturación <span>adicional</span></h2>'
   +'<div class="meta"><span class="it">'+I('factura','ic-mor')+'Factura exenta <b>DTE 34</b></span><span class="it">'+I('escudo','ic-cel')+'Siempre con aprobación del Master</span>'
   +'<span class="it">'+I(CTX.prodHabilitada?'aprobar':'candado',CTX.prodHabilitada?'ic-ver':'ic-amb')+'Emisión real: <b style="color:'+(CTX.prodHabilitada?'var(--ver)':'var(--amb)')+'">'+(CTX.prodHabilitada?'activada':'desactivada · pide al Master activarla')+'</b></span></div></div>'
   +'<div class="estado-lote">'+(esOp()?'<button type="button" class="g-btn pri" data-fa="nueva" data-id="0">'+I('mas')+'Nueva factura</button>':'<span class="sub">Las crean Facturación o el Master; el Master las aprueba.</span>')+'</div></div>'
   +'<div class="fa-kpis">'
   +k('revision','ambar','escudo','ic-mor','Por aprobar',t.rev.length,t.suma(t.rev),'Esperan al Master')
   +k('emitir','cel','enviar','ic-cel','Por emitir',t.emi.length,t.suma(t.emi),'Aprobadas, listas para emitir')
   +k('emitidas','verde','aprobar','ic-ver','Emitidas del mes',mes.length,t.suma(mes),real+' real'+(mes.length-real?' · '+(mes.length-real)+' prueba':''))
   +k('problemas','rojo','alerta','ic-roj','Inciertas o con error',t.prob.length,t.suma(t.prob),t.prob.length?'Revisar antes de reintentar':'Sin problemas')
   +'</div>'
   +'<div class="fa-av" aria-label="Avance de las facturas vigentes"><div class="fa-av-barra"><i class="verde" style="width:'+pc(nEm)+'"></i><i class="ambar" style="width:'+pc(nEs)+'"></i><i class="rojo" style="width:'+pc(nPr)+'"></i><i class="gris" style="width:'+pc(nBo)+'"></i></div>'
   +'<div class="fa-av-ley"><span><i class="verde"></i>Emitidas <b class="cifra">'+nEm+'</b></span><span><i class="ambar"></i>En proceso <b class="cifra">'+nEs+'</b></span><span><i class="rojo"></i>Con problema <b class="cifra">'+nPr+'</b></span><span><i class="gris"></i>Borradores <b class="cifra">'+nBo+'</b></span></div></div>';
}

/* ── Cartera ── */
function filas(){
  return listaVisible().map(function(x){return {x:x,resp:nombreUsuario(x.creado_por)||('Usuario #'+x.creado_por),resp_id:x.creado_por};});
}
function pasaSinResp(f){
  var x=f.x, F=CTX.f, g=GRUPOS[F.est]||GRUPOS.todos;
  if(g[1]&&g[1].indexOf(x.estado)<0)return false;
  if(F.cli&&String(x.cliente_id)!==F.cli)return false;
  if(F.q){var q=F.q.toLowerCase(), t=(x.codigo+' '+cli(x.cliente_id)+' '+rutCli(x.cliente_id)+' '+String(rutCli(x.cliente_id)).replace(/\./g,'')+' '+glosaPrincipal(x)+' '+f.resp+' '+(x.of_folio||'')).toLowerCase();if(t.indexOf(q)<0)return false;}
  return true;
}
function pasaResp(f){var EQ=window.GEquipo;if(CTX.f.resp==='todos')return true;return EQ&&EQ.clave?EQ.clave(f.resp,f.resp_id)===CTX.f.resp:('u'+f.resp_id)===CTX.f.resp;}
function filtradas(){return filas().filter(function(f){return pasaSinResp(f)&&pasaResp(f);});}
function htmlFiltroResp(){
  var EQ=window.GEquipo, base=filas(), cuenta=base.filter(pasaSinResp);
  if(EQ&&EQ.opciones&&EQ.filtroHtml){var opts=EQ.opciones(base,function(f){return pasaSinResp(f);});return EQ.filtroHtml(opts,CTX.f.resp,cuenta.length,'Creada por');}
  var m={};base.forEach(function(f){m['u'+f.resp_id]=f.resp;});
  return '<label class="fa-sel"><span class="sr">Creada por</span><select class="geq-sel-in" aria-label="Filtrar por quien la creó"><option value="todos">Creada por: todos</option>'
    +Object.keys(m).map(function(k){return '<option value="'+esc(k)+'"'+(CTX.f.resp===k?' selected':'')+'>'+esc(m[k])+'</option>';}).join('')+'</select></label>';
}
function htmlCartera(){
  var F=CTX.f, base=filas();
  function nG(g){var e=GRUPOS[g][1];return base.filter(function(f){return !e||e.indexOf(f.x.estado)>=0;}).length;}
  var cliIds=[];CTX.lista.forEach(function(x){if(cliIds.indexOf(x.cliente_id)<0)cliIds.push(x.cliente_id);});
  cliIds.sort(function(a,b){return cli(a).localeCompare(cli(b),'es');});
  return '<div class="g-sec-h"><i class="ic placa ic-ama">'+ic('factura')+'</i><h2>Cartera de <span>facturas adicionales</span></h2><small>Factura puntual excepcional · siempre exenta (DTE 34) · motivo obligatorio y aprobación del Master</small></div>'
   +'<div class="fa-filtros">'
   +'<label class="fa-buscar"><span class="sr">Buscar por código, cliente, RUT, glosa o folio</span>'+I('buscar','ic-cel')+'<input type="search" id="faBuscar" placeholder="Buscar código, cliente, RUT, glosa o folio…" value="'+esc(F.q)+'" autocomplete="off"></label>'
   +'<label class="fa-sel"><span class="sr">Cliente</span><select id="faFCli" aria-label="Filtrar por cliente"><option value="">Cliente: todos</option>'+cliIds.map(function(id){return '<option value="'+id+'"'+(F.cli===String(id)?' selected':'')+'>'+esc(cli(id))+'</option>';}).join('')+'</select></label>'
   +'<button type="button" class="g-btn sm fa-ocultar'+(F.ocultarPruebas?' on':'')+'" data-fa-ocultar="1" role="switch" aria-checked="'+F.ocultarPruebas+'" title="Oculta las PRUEBAS ya emitidas o anuladas (histórico). Las pruebas aún en curso se siguen mostrando.">'
     +'<span class="fa-sw" aria-hidden="true"></span>Ocultar pruebas'+(nPruebasOcultas()?' <b class="cifra">'+nPruebasOcultas()+'</b>':'')+'</button>'
   +'<button type="button" class="g-btn sm" data-fa="csv" data-id="0">'+I('bajar','ic-ver')+'CSV</button>'
   +'</div>'
   +'<div class="fa-filtros"><div class="g-seg fa-seg" role="group" aria-label="Estado">'+Object.keys(GRUPOS).map(function(g){return '<button type="button" class="fb'+(F.est===g?' on':'')+'" data-fa-grupo="'+g+'" aria-pressed="'+(F.est===g)+'">'+esc(GRUPOS[g][0])+' <b class="cifra">'+nG(g)+'</b></button>';}).join('')+'</div></div>'
   +'<div class="fa-filtros fa-filtro-resp">'+htmlFiltroResp()+'</div>'
   +(CTX.cargado?'':'<p class="ninguna">Cargando…</p>')
   +'<div class="fa-tabla-box"><table class="fa-tabla"><thead><tr><th>Estado</th><th>Factura</th><th>Cliente</th><th>Tipo</th><th class="num">Monto</th><th>Creada por</th><th>Fechas</th><th><span class="sr">Acción</span></th></tr></thead>'
   +'<tbody id="faTbody"></tbody></table></div><p class="fa-pie" id="faPie"></p>';
}
function filaHtml(f){
  var x=f.x, s=SEM[x.estado]||['gris',x.estado], pr=accionFila(x), real=x.modo==='PRODUCCION';
  var res=CTX.resaltada===x.id;
  return '<tr class="fa-fila p-'+s[0]+(real?' es-real':'')+(res?' fa-resaltada':'')+'" data-fa-card="'+x.id+'"'+(res?' style="outline:2px solid var(--ama);outline-offset:3px"':'')+' tabindex="0" aria-label="'+esc(x.codigo+' · '+cli(x.cliente_id)+' · '+(real?'REAL':'PRUEBA')+' · '+s[1])+'">'
   +'<td data-l="Estado"><span class="fa-sem '+s[0]+'"><i></i>'+esc(s[1])+'</span>'+(x.auto_aprobada_master?'<small class="fa-mini">auto-aprobada</small>':'')+((x.alertas||[]).length?'<small class="fa-mini amb">'+I('alerta','ic-amb')+(x.alertas||[]).length+' alerta'+((x.alertas||[]).length>1?'s':'')+'</small>':'')+'</td>'
   +'<td data-l="Factura"><div class="fa-col"><b class="fa-cod">'+esc(x.codigo)+'</b><small>'+esc(glosaPrincipal(x))+'</small>'+(x.of_folio?'<small class="cifra">Folio N° '+esc(x.of_folio)+'</small>':'')+'</div></td>'
   +'<td data-l="Cliente"><div class="fa-col"><b>'+esc(cli(x.cliente_id))+'</b><small class="cifra">'+esc(rutCli(x.cliente_id))+'</small></div></td>'
   +'<td data-l="Tipo">'+chipTipo(x.modo)+'</td>'
   +'<td data-l="Monto" class="num"><b class="fa-monto cifra">'+clp(+x.total)+'</b></td>'
   +'<td data-l="Creada por">'+persona(x.creado_por)+'</td>'
   +'<td data-l="Fechas"><div class="fa-col"><span class="cifra">Emisión '+fFecha(x.fecha_emision)+'</span><small class="cifra">'+(x.forma_pago===1?'Contado':'Vence '+fFecha(x.fecha_vencimiento))+'</small></div></td>'
   +'<td class="fa-accs"><div class="fa-accs-in">'+(pr?bot(pr,x.id):'')+bot({act:'ver',txt:'Ver detalle',icn:'ver',icc:'ic-cel',cls:'',ok:true,tip:''},x.id)+'</div></td></tr>';
}
function pintarTabla(){
  var tb=$('faTbody');if(!tb)return;
  var fs=filtradas();
  tb.innerHTML=fs.map(filaHtml).join('')||(CTX.cargado?'<tr class="fa-vacia"><td colspan="8"><p class="ninguna">'+(CTX.lista.length?'Ninguna factura cumple los filtros.':'No hay facturas adicionales.')+'</p></td></tr>':'');
  var p=$('faPie');if(p){var tot=fs.reduce(function(s,f){return s+ +f.x.total;},0);p.innerHTML='Mostrando <b class="cifra">'+fs.length+'</b> de <b class="cifra">'+CTX.lista.length+'</b> · total <b class="cifra">'+clp(tot)+'</b> (últimas 200)'+(nPruebasOcultas()?' · <span class="sub" style="display:inline">'+nPruebasOcultas()+' prueba(s) del histórico ocultas</span>':'')
    +' · <span class="sub" style="display:inline">Para practicar se usa el entorno local/DEV, no esta pantalla.</span>';}
}
function csv(){
  var fs=filtradas();
  function c(v){v=String(v==null?'':v);return /[";\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;}
  var filasCsv=[['Código','Tipo','Estado','Cliente','RUT','Total','Emisión','Vencimiento','Condición','Creada por','Folio']].concat(fs.map(function(f){var x=f.x;
    return [x.codigo,x.modo==='PRODUCCION'?'REAL':'PRUEBA',(EST[x.estado]||[x.estado])[0],cli(x.cliente_id),rutCli(x.cliente_id),+x.total,fFecha(x.fecha_emision),fFecha(x.fecha_vencimiento),x.forma_pago===1?'Contado':'Crédito',f.resp,x.of_folio||''];}));
  var txt='﻿'+filasCsv.map(function(r){return r.map(c).join(';');}).join('\n');
  var url=URL.createObjectURL(new Blob([txt],{type:'text/csv;charset=utf-8'}));
  var a=document.createElement('a');a.href=url;a.download='facturacion-adicional-'+hoyCL()+'.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url);},4000);
}

/* ── Asistente "Nueva factura" (Cliente → Detalle → Revisar) ──
   Decisión de Luciano (23-oct, PR #84): desde la pantalla la factura nueva es SIEMPRE REAL (SII); la opción "Prueba" se quitó.
   El servidor sigue aceptando modo PRUEBA (lo usan las pruebas automáticas y DEV): para practicar se usa el entorno local/DEV,
   nunca Gestoor en producción. Los pasos internos son 2..4 (el 1 era "Tipo") para no tocar las validaciones por etapa. */
var PASOS=[[2,'Cliente'],[3,'Detalle'],[4,'Revisar']];
function wizNuevo(){var hoy=hoyCL();return {paso:2,modo:'PRODUCCION',cliente:null,qCli:'',motivo:'',fe:hoy,fp:2,fv:sumarDias(hoy,20),lineas:[{glosa:'',cantidad:1,precio:'',detalle:''}],real:'',err:'',edit:null};}
function wizEditar(x){
  return {paso:3,modo:x.modo,cliente:x.cliente_id,qCli:'',motivo:x.motivo||'',fe:String(x.fecha_emision).slice(0,10),fp:x.forma_pago===1?1:2,fv:String(x.fecha_vencimiento).slice(0,10),
    lineas:(x.lineas||[]).map(function(l){return {glosa:l.glosa||'',cantidad:l.cantidad||1,precio:l.precio||'',detalle:l.detalle||''};}),real:'',err:'',edit:x};
}
function wizTotal(w){return w.lineas.reduce(function(s,l){var q=parseInt(l.cantidad,10)||0,p=Number(l.precio)||0;return s+q*p;},0);}
function htmlWizard(){
  var w=CTX.wiz;if(!w)return '';
  var real=w.modo==='PRODUCCION', cls=w.modo?(real?' real':' pru'):'';
  var pasos='<ol class="fa-pasos" aria-label="Pasos">'+PASOS.map(function(pp,i){var k=pp[0], n=pp[1], est=k<w.paso?'hecho':(k===w.paso?'actual':'');
      var bloqueado=w.edit&&k<3, puede=k<w.paso&&!bloqueado;
      return '<li class="'+est+'"><button type="button" '+(puede?'data-fa-paso="'+k+'"':'disabled')+' aria-current="'+(k===w.paso?'step':'false')+'"><span class="n">'+(k<w.paso?ic('check'):(i+1))+'</span><span class="t">'+esc(n)+'</span></button></li>';}).join('')+'</ol>';
  var cuerpo=w.paso===2?wizPaso2(w):(w.paso===3?wizPaso3(w):wizPaso4(w));
  var atras=w.paso>2&&!(w.edit&&w.paso===3)?'<button type="button" class="g-btn sm" data-fa="wiz-atras" data-id="0">'+I('devolver','ic-cel')+'Atrás</button>':'';
  var sig;
  if(w.paso<4)sig='<button type="button" class="g-btn sm pri" data-fa="wiz-sig" data-id="0" id="faWizSig">Siguiente'+I('enviar')+'</button>';
  else sig='<button type="button" class="g-btn pri'+(real?' fa-btn-real':'')+'" data-fa="wiz-crear" data-id="0" id="faWizCrear"'+(CTX.ocupado?' disabled':'')+'>'+I(real?'factura':'probeta')+(w.edit?'Guardar cambios':(real?'Crear borrador de factura REAL':'Crear borrador de prueba'))+'</button>';
  return '<section class="fa-wiz'+cls+'" aria-label="Nueva factura adicional">'
   +'<div class="fa-wiz-h"><button type="button" class="g-btn sm" data-fa="cartera" data-id="0">'+I('devolver','ic-cel')+'Volver a la cartera</button><h3>'+(w.edit?'Editar '+esc(w.edit.codigo):'Nueva factura adicional')+'</h3>'+(w.modo?chipTipo(w.modo,true):'')+'</div>'
   +pasos
   +'<div class="fa-wiz-b">'+cuerpo+'</div>'
   +'<div class="m-err fa-wiz-err" id="faWizErr" role="alert"'+(w.err?'':' hidden')+'>'+esc(w.err)+'</div>'
   +'<div class="fa-wiz-f">'+atras+'<span class="g-espacio" style="flex:1"></span>'+sig+'</div></section>';
}
function wizPaso2(w){
  var q=String(w.qCli||'').toLowerCase().trim();
  var lista=CTX.clientesLista.filter(function(c){return !q||(c.razon_social+' '+c.rut+' '+String(c.rut).replace(/\./g,'')).toLowerCase().indexOf(q)>=0;}).slice(0,60);
  return '<h4 class="fa-wiz-t">1 · ¿A qué cliente se le factura?</h4>'
   +(CTX.prodHabilitada?'':'<div class="fa-aviso-off">'+I('candado','ic-amb')+'<span><b>La emisión está desactivada.</b> Puedes crear el borrador y enviarlo a aprobación; para emitirlo pide al Master activarla.</span></div>')
   +'<label class="fa-buscar"><span class="sr">Buscar cliente por nombre o RUT</span>'+I('buscar','ic-cel')+'<input type="search" id="faWizQ" placeholder="Buscar cliente por nombre o RUT…" value="'+esc(w.qCli)+'" autocomplete="off"></label>'
   +'<div class="fa-clis" role="radiogroup" aria-label="Cliente" id="faWizClis">'+(lista.map(function(c){var on=w.cliente===c.id;
      return '<button type="button" role="radio" class="fa-cli'+(on?' on':'')+'" data-fa-cli="'+c.id+'" aria-checked="'+on+'">'+I(on?'aprobar':'edificio',on?'ic-ver':'ic-mor')+'<span><b>'+esc(c.razon_social)+'</b><small class="cifra">'+esc(c.rut)+'</small></span></button>';}).join('')
     ||'<p class="ninguna">'+(CTX.clientesLista.length?'Ningún cliente activo coincide con la búsqueda.':'No hay clientes activos disponibles.')+'</p>')+'</div>'
   +(w.cliente?'<p class="sub">Elegido: <b>'+esc(cli(w.cliente))+'</b> · '+esc(rutCli(w.cliente))+'</p>':'');
}
function wizLinea(l,i){
  return '<div class="fa-lin" data-i="'+i+'">'
   +'<input class="fa-g" maxlength="80" placeholder="Glosa (3 a 80 caracteres)" value="'+esc(l.glosa||'')+'" aria-label="Glosa línea '+(i+1)+'">'
   +'<input class="fa-q cifra" type="number" min="1" max="1000" step="1" value="'+esc(l.cantidad||1)+'" aria-label="Cantidad línea '+(i+1)+'">'
   +'<input class="fa-p cifra" type="number" min="1" step="1" placeholder="Precio $" value="'+esc(l.precio||'')+'" aria-label="Precio unitario en pesos línea '+(i+1)+'">'
   +'<button type="button" class="g-ico" data-fa-quitar="'+i+'" aria-label="Quitar línea '+(i+1)+'">'+ic('cerrar')+'</button>'
   +'<input class="fa-d" maxlength="1000" placeholder="Detalle (opcional)" value="'+esc(l.detalle||'')+'" aria-label="Detalle línea '+(i+1)+'"></div>';
}
function wizPaso3(w){
  return '<h4 class="fa-wiz-t">2 · Detalle de la factura</h4>'
   +'<div class="fa-form">'
   +'<label>Motivo (por qué es una factura excepcional)<textarea id="faMot" rows="2" maxlength="500" placeholder="Ej.: trabajo adicional solicitado por el cliente en octubre">'+esc(w.motivo)+'</textarea></label>'
   +'<div class="fa-form-3"><label>Fecha de emisión<input id="faFe" type="date" value="'+esc(w.fe)+'"></label>'
   +'<div class="fa-fp"><span class="lbl">Condición de pago</span><div class="g-seg" role="radiogroup" aria-label="Condición de pago">'
   +'<button type="button" role="radio" class="fb'+(w.fp===2?' on':'')+'" data-fa-fp="2" aria-checked="'+(w.fp===2)+'">Crédito</button><button type="button" role="radio" class="fb'+(w.fp===1?' on':'')+'" data-fa-fp="1" aria-checked="'+(w.fp===1)+'">Contado</button></div></div>'
   +(w.fp===2?'<label>Vencimiento<input id="faFv" type="date" value="'+esc(w.fv)+'"></label>':'<div class="fa-fp"><span class="lbl">Vencimiento</span><span class="sub">Contado: vence el mismo día de emisión.</span></div>')+'</div>'
   +'<div class="fa-lin-h"><b>Líneas</b> <span class="sub">exentas · pesos enteros · máximo 10</span></div>'
   +'<div class="fa-lin-cab" aria-hidden="true"><span>Glosa</span><span>Cant.</span><span>Precio</span><span></span></div>'
   +'<div id="faLins">'+w.lineas.map(wizLinea).join('')+'</div>'
   +'<div class="fa-lin-pie"><button type="button" class="btn-link" data-fa-mas="1"'+(w.lineas.length>=10?' disabled':'')+'>'+I('mas','ic-ama')+'Agregar línea</button><span>Total exento: <b class="cifra fa-tot-vivo" id="faTot">'+clp(wizTotal(w))+'</b></span></div>'
   +'</div>';
}
function wizPaso4(w){
  var real=w.modo==='PRODUCCION', lin=w.lineas.map(function(l){var q=parseInt(l.cantidad,10)||0,p=Number(l.precio)||0;return {glosa:l.glosa,detalle:l.detalle,cantidad:q,precio:p,monto:q*p};});
  var doc=facturaHtml({modo:w.modo,codigo:w.edit?w.edit.codigo:'',receptor:cli(w.cliente),rut:rutCli(w.cliente),recNota:real?'Giro, dirección y correo se toman de la ficha del cliente al enviar a aprobación.':'En prueba, OpenFactura usa un receptor de demostración y el correo va solo a info@contadoor.cl.',
    fecha:w.fe,condicion:w.fp===1?'Contado':'Crédito',venc:w.fp===1?null:w.fv,lineas:lin,total:wizTotal(w)});
  return '<h4 class="fa-wiz-t">3 · Revisa antes de '+(w.edit?'guardar':'crear')+'</h4>'
   +'<div class="fa-rev">'+doc
   +'<aside class="fa-rev-lado"><div class="fa-rev-caja'+(real?' real':' pru')+'">'+(real
      ?'<b>'+I('factura','ic-roj')+'Esta es una FACTURA REAL</b><p>Después de crear el borrador, sigue el camino de siempre: enviar a aprobación → el Master aprueba → se emite en el SII. Emitirla pedirá otra vez la palabra REAL y el total.'+(CTX.prodHabilitada?'':' <b>Hoy la emisión está desactivada:</b> pide al Master activarla.')+'</p>'
       +'<label for="faWizReal">Escribe <b>REAL</b> para confirmar que es una factura real</label><input id="faWizReal" autocomplete="off" spellcheck="false" placeholder="REAL" value="'+esc(w.real)+'">'
      :'<b>'+I('probeta','ic-cel')+'Esta es una PRUEBA</b><p>No va al SII ni tiene validez tributaria. Igual pasa por aprobación del Master antes de emitirse en el ambiente de pruebas.</p>')
   +'</div><div class="fa-rev-mot"><small>Motivo</small><p>'+esc(w.motivo)+'</p></div>'
   +'<p class="sub">¿Algo no cuadra? Vuelve al paso que corresponda con los números de arriba.</p></aside></div>';
}
function wizSync(){
  var w=CTX.wiz;if(!w)return;
  if(w.paso===3){
    var m=$('faMot');if(m)w.motivo=m.value;var fe=$('faFe');if(fe)w.fe=fe.value;var fv=$('faFv');if(fv)w.fv=fv.value;
    var rows=document.querySelectorAll('#faLins .fa-lin');if(rows.length)w.lineas=[].map.call(rows,function(r){return {glosa:r.querySelector('.fa-g').value,cantidad:r.querySelector('.fa-q').value,precio:r.querySelector('.fa-p').value,detalle:r.querySelector('.fa-d').value};});
  }
  if(w.paso===4){var rl=$('faWizReal');if(rl)w.real=rl.value;}
  if(w.paso===2){var q=$('faWizQ');if(q)w.qCli=q.value;}
}
/* Datos para la RPC: mismos campos y mismas validaciones que el formulario anterior. */
function wizDatos(w){
  var lin=w.lineas.map(function(l){var o={glosa:String(l.glosa||'').trim(),cantidad:parseInt(l.cantidad,10),precio:Number(l.precio)};var d=String(l.detalle||'').trim();if(d)o.detalle=d;return o;});
  var o={motivo:String(w.motivo||'').trim(),fecha_emision:w.fe,forma_pago:w.fp,lineas:lin};
  if(w.fp===2)o.fecha_vencimiento=w.fv;
  return o;
}
function wizValidar(w,hasta){
  if(hasta>=2&&!w.cliente&&!w.edit)return ERR.CLIENTE_NO_EXISTE;
  if(hasta>=3){
    var o=wizDatos(w);
    if(o.motivo.length<10)return ERR.MOTIVO_OBLIGATORIO;
    if(/honorario/i.test(o.motivo+JSON.stringify(o.lineas)))return ERR.TEXTO_NO_PERMITIDO;
    for(var i=0;i<o.lineas.length;i++){var l=o.lineas[i];if(l.glosa.length<3)return ERR.GLOSA_INVALIDA;if(!(l.cantidad>=1&&l.cantidad<=1000))return ERR.CANTIDAD_INVALIDA;if(!(Number.isInteger(l.precio)&&l.precio>0))return ERR.MONTO_INVALIDO;}
  }
  if(hasta>=4&&w.modo==='PRODUCCION'&&!w.edit&&!palabraRealOk(w.real))return ERR.PALABRA_REAL;
  return '';
}
function wizError(m){var w=CTX.wiz;if(!w)return;w.err=m||'';var e=$('faWizErr');if(e){e.textContent=w.err;e.hidden=!w.err;}}
function wizIr(paso){var w=CTX.wiz;wizSync();w.err='';w.paso=paso;render();var b=document.querySelector('.fa-wiz-b');if(b){var f=b.querySelector('input,textarea,[role=radio]:not([disabled])');if(f&&f.focus)try{f.focus({preventScroll:true});}catch(e){}}
  var s=document.querySelector('.fa-wiz');if(s&&s.scrollIntoView)s.scrollIntoView({block:'start'});}
function wizSiguiente(){
  var w=CTX.wiz;if(!w)return;wizSync();
  var m=wizValidar(w,w.paso);if(m){wizError(m);return;}
  wizIr(w.paso+1);
}
function wizCrear(){
  var w=CTX.wiz;if(!w)return;wizSync();
  var m=wizValidar(w,4);if(m){wizError(m);var r=$('faWizReal');if(r&&m===ERR.PALABRA_REAL)r.focus();return;}
  var o=wizDatos(w), nuevo=!w.edit;
  if(nuevo){o.cliente_id=+w.cliente;o.modo='PRODUCCION';}   // desde la pantalla, siempre REAL
  correr(nuevo?rpc('factura_adicional_crear',{p:o}):rpc('factura_adicional_editar',{p_factura:w.edit.id,p:o}),nuevo?'Borrador de factura REAL creado. Siguiente paso: enviarlo a aprobación.':'Cambios guardados.',false,
    function(r){var id=r&&r.factura_id!=null?+r.factura_id:(w.edit?w.edit.id:null);CTX.wiz=null;if(id!=null&&porId(id))abrirDetalle(id);else irCartera();});
}
function abrirNueva(){CTX.wiz=wizNuevo();CTX.vista='nueva';render();var s=document.querySelector('.fa-wiz');if(s&&s.scrollIntoView)s.scrollIntoView({block:'start'});}
function abrirEditar(x){CTX.wiz=wizEditar(x);CTX.vista='nueva';render();}
function irCartera(){CTX.vista='cartera';CTX.wiz=null;CTX.detId=null;urlFactura(null);render();}

/* ── Detalle de una factura ── */
function urlFactura(id){
  try{var p=new URLSearchParams(location.search);if(id!=null){p.set('tab','adicional');p.set('fa',String(id));}else p.delete('fa');
    history.replaceState(null,'',location.pathname+(p.toString()?'?'+p.toString():''));}catch(e){}
}
function abrirDetalle(id,sinScroll){
  CTX.vista='detalle';CTX.detId=id;CTX.wiz=null;urlFactura(id);render();
  if(!sinScroll){var s=$('faPanel');if(s&&s.scrollIntoView)s.scrollIntoView({block:'start'});}
  if(!CTX.eventos[id])sbGet('facturas_adicionales_eventos?select=tipo,actor_usuario_id,actor,creado_at,detalle&factura_id=eq.'+id+'&order=creado_at.asc&limit=200').then(function(r){
    CTX.eventos[id]=r||[];cargarUsuarios((r||[]).map(function(e){return e.actor_usuario_id;}));if(CTX.vista==='detalle'&&CTX.detId===id)render();
  }).catch(function(){CTX.eventos[id]=[];});
}
var EVT={CREADA:['Creada','lapiz','ic-cel'],EDITADA:['Editada','lapiz','ic-cel'],ENVIADA_REVISION:['Enviada a aprobación','enviar','ic-mor'],APROBADA:['Aprobada por el Master','aprobar','ic-ver'],
  AUTO_APROBADA_MASTER:['Auto-aprobada por el Master (total reescrito)','escudo','ic-amb'],DEVUELTA:['Devuelta con comentario','devolver','ic-amb'],ANULADA:['Anulada','basura','ic-roj'],
  EMISION_RECLAMADA:['Emisión iniciada','enviar','ic-cel'],EMISION_LIBERADA:['Emisión liberada (no se envió)','repetir','ic-amb'],EMISION_INCIERTA_POR_VENCIMIENTO:['Emisión incierta (sin respuesta a tiempo)','alerta','ic-ama'],
  CONCILIACION_INICIADA:['Conciliación iniciada','repetir','ic-ama'],DOCUMENTOS_OBTENIDOS:['PDF y XML guardados','bajar','ic-ver'],DOCUMENTOS_ERROR:['No se pudieron traer PDF/XML','alerta','ic-amb'],
  CORREO_PREPARADO:['Correo preparado','correo','ic-cel'],CORREO_DESTINO_NO_PERMITIDO:['Correo bloqueado: destino no permitido','alerta','ic-amb'],
  COBRANZA_REGISTRADA:['Registrada en Cobranza','calc','ic-ver'],COBRANZA_NO_REGISTRADA:['No entró a Cobranza','alerta','ic-amb']};
function evtTxt(t){
  if(EVT[t])return EVT[t];
  if(/^EMISION_/.test(t))return [t==='EMISION_EMITIDA'?'Emitida':'Emisión: '+t.slice(8).toLowerCase().replace(/_/g,' '),'enviar',/ERROR|RECHAZ/.test(t)?'ic-roj':'ic-ver'];
  if(/^CONCILIADA_/.test(t))return ['Conciliada: '+t.slice(11).toLowerCase().replace(/_/g,' '),'repetir','ic-ver'];
  if(/^CORREO_/.test(t))return ['Correo: '+t.slice(7).toLowerCase().replace(/_/g,' '),'correo','ic-cel'];
  return [t.toLowerCase().replace(/_/g,' '),'reloj','ic-mor'];
}
function ultimoEv(ev,tipos){var r=null;(ev||[]).forEach(function(e){if(tipos.indexOf(e.tipo)>=0||tipos.some(function(t){return t.slice(-1)==='_'&&e.tipo.indexOf(t)===0;}))r=e;});return r;}
function htmlLinea(x){
  var ev=CTX.eventos[x.id]||null;
  var eEnv=ultimoEv(ev,['ENVIADA_REVISION']), eApr=ultimoEv(ev,['APROBADA','AUTO_APROBADA_MASTER']), eEmi=ultimoEv(ev,['EMISION_RECLAMADA']);
  var pasos=[
    {t:'Creada',ic:'lapiz',icc:'ic-cel',fecha:x.creado_at,quien:x.creado_por,ok:true},
    {t:'Enviada a aprobación',ic:'enviar',icc:'ic-mor',fecha:x.enviada_at||(eEnv&&eEnv.creado_at),quien:x.enviada_por!=null?x.enviada_por:(eEnv&&eEnv.actor_usuario_id),ok:!!(x.enviada_at||eEnv)&&['BORRADOR','DEVUELTA'].indexOf(x.estado)<0||['EN_REVISION','APROBADA','EMITIENDO','INCIERTO','EMITIDA','ERROR'].indexOf(x.estado)>=0},
    {t:x.auto_aprobada_master?'Auto-aprobada por el Master':'Aprobada por el Master',ic:'escudo',icc:x.auto_aprobada_master?'ic-amb':'ic-ver',fecha:x.aprobada_at||(eApr&&eApr.creado_at),quien:x.aprobada_por!=null?x.aprobada_por:(eApr&&eApr.actor_usuario_id),ok:['APROBADA','EMITIENDO','INCIERTO','EMITIDA','ERROR'].indexOf(x.estado)>=0},
    {t:'Emitida'+(x.of_folio?' · folio N° '+x.of_folio:''),ic:'factura',icc:'ic-ver',fecha:x.emitida_at,quien:eEmi&&eEmi.actor_usuario_id,ok:x.estado==='EMITIDA'}
  ];
  var actual=-1;pasos.forEach(function(p,i){if(p.ok)actual=i;});
  var desvio=x.estado==='DEVUELTA'?['amb','Devuelta por el Master',x.devuelta_at,x.comentario_devolucion]:(x.estado==='ANULADA'?['roj','Anulada',x.anulada_at,x.motivo_anulacion]:(x.estado==='INCIERTO'?['ama','Incierta: OpenFactura no confirmó el resultado',null,'No reemitir: el Master concilia.']:(x.estado==='ERROR'?['roj','Rechazada por OpenFactura',null,x.error]:(x.estado==='EMITIENDO'?['cel','Emitiendo…',null,'']:null))));
  return '<ol class="fa-tl">'+pasos.map(function(p,i){var cls=p.ok?'hecho':(i===actual+1&&!desvio?'sigue':'');
      return '<li class="'+cls+'"><span class="pto '+(p.ok?p.icc:'')+'">'+ic(p.ok?p.ic:'reloj')+'</span><div><b>'+esc(p.t)+'</b>'
        +(p.ok&&p.fecha?'<small class="cifra">'+esc(fHora(p.fecha))+'</small>':(p.ok?'':'<small>'+(i===actual+1&&!desvio?'Siguiente paso':'Pendiente')+'</small>'))
        +(p.ok&&p.quien!=null?persona(p.quien):'')+'</div></li>';}).join('')
   +(desvio?'<li class="desvio '+desvio[0]+'"><span class="pto ic-'+desvio[0]+'">'+ic('alerta')+'</span><div><b>'+esc(desvio[1])+'</b>'+(desvio[2]?'<small class="cifra">'+esc(fHora(desvio[2]))+'</small>':'')+(desvio[3]?'<p>'+esc(desvio[3])+'</p>':'')+'</div></li>':'')
   +'</ol>'
   +(ev&&ev.length?'<details class="fa-bit"><summary>Bitácora completa <b class="cifra">'+ev.length+'</b></summary><ul>'+ev.map(function(e){var t=evtTxt(e.tipo);
      return '<li>'+I(t[1],t[2])+'<span><b>'+esc(t[0])+'</b><small class="cifra">'+esc(fHora(e.creado_at))+' · '+(e.actor==='servicio'?'Sistema':esc(nombreUsuario(e.actor_usuario_id)||('Usuario #'+e.actor_usuario_id)))+'</small></span></li>';}).join('')+'</ul></details>':(ev?'':'<p class="sub">Cargando bitácora…</p>'));
}
function htmlDetalle(x){
  if(!x)return '';
  var prod=x.modo==='PRODUCCION', acc=accionesLista(x).filter(function(a){return a.act!=='pdf'&&a.act!=='xml'&&a.act!=='documentos';});
  var docs=x.estado==='EMITIDA'
    ?(x.doc_estado==='OBTENIDOS'?bot({act:'pdf',txt:'Descargar PDF',icn:'bajar',icc:'ic-ver',cls:'',ok:true,tip:'PDF oficial de OpenFactura'},x.id)+bot({act:'xml',txt:'Descargar XML',icn:'bajar',icc:'ic-cel',cls:'',ok:true,tip:'XML firmado'},x.id)
      :((esF()||esM())?bot({act:'documentos',txt:'Traer PDF y XML',icn:'repetir',icc:'ic-cel',cls:'',ok:true,tip:'Vuelve a pedir los documentos (no reemite).'},x.id):'<span class="sub">PDF y XML pendientes.</span>'))
    :'<span class="sub">Disponibles cuando la factura esté emitida.</span>';
  var cob=!prod?['gris','No aplica: las pruebas no entran a Cobranza.']:(x.estado!=='EMITIDA'?['gris','Entra a Cobranza al emitirse.']:(x.cobranza_documento_id?['ver','Registrada en Cobranza · pendiente de pago en la cartera.']:(((x.alertas||[]).some(function(a){return a.codigo==='COBRANZA_NO_REGISTRADA';}))?['amb','No entró a Cobranza: registrarla a mano.']:['gris','Sin registro en Cobranza.'])));
  var alertas=(x.alertas||[]).map(function(a){return esc({POSIBLE_DUPLICADO:'Posible duplicado (mismo cliente y monto en 30 días)',TOTAL_DTE_DIFIERE:'El total del DTE difiere del aprobado',COBRANZA_NO_REGISTRADA:'No entró a Cobranza: registrarla a mano'}[a.codigo]||a.codigo);});
  return '<section class="fa-det'+(prod?' real':' pru')+'" aria-label="Detalle de '+esc(x.codigo)+'">'
   +'<div class="fa-wiz-h"><button type="button" class="g-btn sm" data-fa="cartera" data-id="0">'+I('devolver','ic-cel')+'Volver a la cartera</button><h3>'+esc(x.codigo)+'</h3>'+chipTipo(x.modo,true)+chipEst(x.estado,true)+'</div>'
   +'<div class="fa-det-g"><div class="fa-det-doc">'+docDeFactura(x)+'<div class="fa-rev-mot"><small>Motivo</small><p>'+esc(x.motivo)+'</p></div>'
   +(x.auto_aprobada_master?'<div class="mot" style="background:rgba(92,200,255,.08)"><b>Auto-aprobada por el Master</b> (la creó y la aprobó él, con confirmación del total). Se avisó al equipo.</div>':'')
   +(x.comentario_devolucion&&x.estado==='DEVUELTA'?'<div class="mot" style="background:rgba(224,122,110,.08)"><b>Comentario del Master:</b> '+esc(x.comentario_devolucion)+'</div>':'')
   +(alertas.length?'<div class="mot" style="background:rgba(255,210,77,.08)"><b>Alertas:</b> '+alertas.join(' · ')+'</div>':'')
   +(x.estado==='INCIERTO'?'<div class="mot" style="background:rgba(255,210,77,.1)"><b>No reemitir.</b> OpenFactura no confirmó el resultado. El Master concilia: Gestoor busca el documento con la misma clave (nunca emite dos veces).</div>':'')
   +'</div><div class="fa-det-lado">'
   +'<div class="fa-caja"><h4>'+I('lista','ic-mor')+'Acciones</h4>'
     +(prod&&!CTX.prodHabilitada&&['BORRADOR','DEVUELTA','EN_REVISION','APROBADA','ERROR'].indexOf(x.estado)>=0?'<div class="fa-aviso-off">'+I('candado','ic-amb')+'<span><b>'+esc(ERR.EMISION_DESACTIVADA)+'</b> El resto del camino (enviar, aprobar, devolver) funciona igual.</span></div>':'')
     +'<div class="fa-det-acc">'+(acc.map(function(a){return bot(a,x.id);}).join('')||'<span class="sub">No hay acciones disponibles para ti en este estado.</span>')+'</div></div>'
   +'<div class="fa-caja"><h4>'+I('reloj','ic-ver')+'Línea de tiempo</h4>'+htmlLinea(x)+'</div>'
   +'<div class="fa-caja"><h4>'+I('factura','ic-ama')+'Folio y documentos</h4><div class="fa-dato"><span>Folio</span><b class="cifra">'+(x.of_folio?'N° '+esc(x.of_folio):'—')+'</b></div>'
     +(x.total_dte!=null&&+x.total_dte!==+x.total?'<div class="fa-dato"><span>Total DTE</span><span class="fx-est roj">'+clp(+x.total_dte)+' (difiere)</span></div>':'')
     +'<div class="fa-det-acc">'+docs+'</div></div>'
   +'<div class="fa-caja"><h4>'+I('calc','ic-cel')+'Cobranza</h4><p class="fa-cob '+cob[0]+'">'+esc(cob[1])+'</p></div>'
   +(window.FX_NC?window.FX_NC.cajaHtml(x,{rol:CTX.rol,yo:CTX.yo,prod:CTX.prodHabilitada}):'')   // @F1e-nc · caja reservada .fa-nc (nota-credito.js)
   +'</div></div></section>';
}

/* ── Ejecutar acciones ── */
function correr(p,ok,enModal,despues){
  if(CTX.ocupado)return;CTX.ocupado=true;var si=document.querySelector('#mFoot [data-m="si"]');if(si){si.disabled=true;si.textContent='Procesando…';}
  render();
  return p.then(function(r){CTX.ocupado=false;if(enModal)cerrarModal();toast(I('aprobar','ic-ver')+' '+esc(typeof ok==='function'?ok(r):ok));return recargar().then(function(){if(despues)despues(r);});})
   .catch(function(e){CTX.ocupado=false;var m=msg(e);if(enModal&&$('modal').classList.contains('on')){modal.error(m);var b=document.querySelector('#mFoot [data-m="si"]');if(b){b.disabled=false;b.textContent='Reintentar';}}else toast(I('alerta','ic-amb')+' '+esc(m));render();if(CTX.vista==='nueva')wizError(m);});
}
function cargarNc(){return window.FX_NC?window.FX_NC.cargar(CTX.lista.filter(function(x){return x.estado==='EMITIDA';}).map(function(x){return x.id;})):Promise.resolve();}   // @F1e-nc
function recargar(){return cargar().then(cargarNc).then(render).then(irAFacturaEnlace).then(function(){if(window.FX_NC)window.FX_NC.resaltarEnlace();}).catch(function(e){toast(I('alerta','ic-amb')+' '+esc(msg(e)));});}
if(window.FX_NC)window.FX_NC.alCambiar(function(){return recargar();});   // @F1e-nc
function resultadoEmision(r){
  if(!r)return 'Listo.';
  if(r.estado==='EMITIDA')return 'Emitida: folio N° '+r.folio+(r.documentos==='OBTENIDOS'?' · PDF y XML guardados.':' · PDF/XML pendientes (usa "Traer PDF y XML").');
  if(r.estado==='INCIERTO')return 'Resultado incierto: NO se reemite. El Master debe conciliar.';
  if(r.estado==='ERROR')return 'OpenFactura rechazó el documento ('+(r.codigo_proveedor||'')+'). No se emitió.';
  if(r.liberada)return 'No se envió a OpenFactura: '+msg({codigo:r.codigo});
  return 'Estado: '+(r.estado||'—')+(r.codigo?' ('+r.codigo+')':'');
}
function descargar(x,tipo){
  sbGet('facturas_adicionales_documentos?select='+tipo+'_b64&factura_id=eq.'+x.id).then(function(r){
    var b=r&&r[0]&&r[0][tipo+'_b64'];if(!b){toast(I('alerta','ic-amb')+' Documento no disponible.');return;}
    var bin=atob(b),u=new Uint8Array(bin.length);for(var i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);
    var url=URL.createObjectURL(new Blob([u],{type:tipo==='pdf'?'application/pdf':'application/xml'}));
    var a=document.createElement('a');a.href=url;a.download='Factura-34-'+(x.of_folio||x.codigo)+(x.modo==='PRUEBA'?'-PRUEBA':'')+'.'+tipo;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url);},4000);
  });
}
function resumenRevision(x){
  var s=x.snapshot||{};
  return '<div class="fa-modal-doc">'+docDeFactura(x,true)
   +'<div class="mot"><b>Motivo:</b> '+esc(x.motivo)+'</div>'
   +(s.correo_destino?'<div class="sub">Correo del documento a '+esc(s.correo_destino)+'</div>':'')+'</div>';
}
function anchoModal(){var mm=$('modal');if(mm){mm.classList.add('fa-ancho');mm.style.width='min(760px, calc(100% - 32px))';}}
function accion(act,id){
  var x=porId(id);
  if(act==='nueva')return abrirNueva();
  if(act==='cartera')return irCartera();
  if(act==='csv')return csv();
  if(act==='wiz-sig')return wizSiguiente();
  if(act==='wiz-atras'){wizSync();return wizIr(Math.max(1,CTX.wiz.paso-1));}
  if(act==='wiz-crear')return wizCrear();
  if(!x)return;
  if(act==='ver')return abrirDetalle(x.id);
  if(act==='editar')return abrirEditar(x);
  if(act==='enviar')return modal({t:'Enviar a aprobación',ic:'enviar',b:'<p>Se congela el contenido de <b>'+esc(x.codigo)+'</b> ('+clp(+x.total)+') y se envía al Master. Si falta algo en la ficha del cliente, se te avisará.</p><p>Tipo: '+chipTipo(x.modo)+'</p>',ok:'Enviar',cb:function(){correr(rpc('factura_adicional_enviar',{p_factura:x.id}),'Enviada al Master.',true);return false;}});
  if(act==='aprobar'){modal({t:'Aprobar factura',ic:'escudo',b:resumenRevision(x),ok:'Aprobar',cb:function(){correr(rpc('factura_adicional_aprobar',{p_factura:x.id,p_huella:x.snapshot_hash}),'Aprobada. El facturador ya puede emitir.',true);return false;}});anchoModal();return;}
  if(act==='autoaprobar'){modal({t:'Auto-aprobar factura',ic:'escudo',icc:'ic-amb',
      b:'<p style="color:var(--amb)"><b>Estás aprobando una factura que creaste tú.</b> Quedará marcada como auto-aprobada y Facturación y los demás Masters recibirán un aviso.</p>'+resumenRevision(x)
       +'<label style="display:flex;gap:8px;align-items:center;justify-content:flex-start;margin-top:10px"><input type="checkbox" id="faConf" style="width:18px;height:18px;flex:none;margin:0"> Confirmo que revisé la factura y la apruebo</label>'
       +'<label style="margin-top:8px;display:block">Reescribe el total exento (ej.: 10000 o 10.000)<input id="faTotConf" inputmode="numeric" placeholder="Ej.: 10.000" autocomplete="off"></label>',
      ok:'Auto-aprobar',cb:function(){
        if(!$('faConf').checked){modal.error(ERR.CONFIRMACION_OBLIGATORIA);return false;}
        var tc=totalConfirmadoDesdeTexto($('faTotConf').value);
        if(!tc.ok){modal.error(tc.motivo==='VACIO'?ERR.TOTAL_CONFIRMADO_VACIO:ERR.TOTAL_CONFIRMADO_FORMATO);return false;}
        var t=tc.valor;
        if(t!==Number(x.total)){modal.error(ERR.TOTAL_CONFIRMADO_NO_COINCIDE);return false;}
        correr(rpc('factura_adicional_autoaprobar',{p_factura:x.id,p_huella:x.snapshot_hash,p_total_confirmado:t,p_confirmo:true}),function(r){return 'Auto-aprobada. Se avisó a '+(r&&r.avisos||0)+' persona(s). Ahora puedes emitirla en un paso aparte.';},true);return false;}});anchoModal();return;}
  if(act==='devolver')return modal({t:'Devolver al facturador',ic:'devolver',icc:'ic-amb',b:'<label>¿Qué hay que corregir?<textarea id="faCom" rows="3" maxlength="2000"></textarea></label>',ok:'Devolver',cls:'',cb:function(){var t=$('faCom').value.trim();if(t.length<5){modal.error(ERR.COMENTARIO_OBLIGATORIO);return false;}correr(rpc('factura_adicional_devolver',{p_factura:x.id,p_comentario:t}),'Devuelta al facturador.',true);return false;}});
  if(act==='anular')return modal({t:'Anular factura',ic:'basura',icc:'ic-roj',b:'<label>Motivo de la anulación (mínimo 10 caracteres)<textarea id="faAnu" rows="3" maxlength="1000"></textarea></label>',ok:'Anular',cls:'',cb:function(){var t=$('faAnu').value.trim();if(t.length<10){modal.error(ERR.MOTIVO_ANULACION);return false;}correr(rpc('factura_adicional_anular',{p_factura:x.id,p_motivo:t}),'Anulada.',true);return false;}});
  if(act==='emitir'){
    var prod=x.modo==='PRODUCCION';
    if(prod){
      CTX.franjaModal='PRODUCCION';
      modal({t:'Emitir FACTURA REAL',ic:'factura',icc:'ic-roj',
        b:'<div class="fa-modal-real">'+I('alerta','ic-roj')+'<div><b>Atención: esta factura se emite en el SII</b> a nombre de '+esc(EMISOR_NOMBRE)+' No se puede deshacer (solo con nota de crédito).</div></div>'+resumenRevision(x)
         +'<div class="fa-confirma-real"><label for="faRealPal">1 · Escribe <b>REAL</b> para confirmar</label><input id="faRealPal" autocomplete="off" spellcheck="false" placeholder="REAL">'
         +'<label for="faRealTot">2 · Reescribe el total exento (ej.: 10000 o 10.000)</label><input id="faRealTot" inputmode="numeric" placeholder="Ej.: 10.000" autocomplete="off"></div>',
        ok:'Sí, emitir factura real',cls:'pri fa-btn-real',cb:function(){
          if(!palabraRealOk($('faRealPal').value)){modal.error(ERR.PALABRA_REAL);$('faRealPal').focus();return false;}
          var tc=totalConfirmadoDesdeTexto($('faRealTot').value);
          if(!tc.ok){modal.error(tc.motivo==='VACIO'?ERR.TOTAL_CONFIRMADO_VACIO:ERR.TOTAL_CONFIRMADO_FORMATO);$('faRealTot').focus();return false;}
          if(tc.valor!==Number(x.total)){modal.error(ERR.TOTAL_CONFIRMADO_NO_COINCIDE);$('faRealTot').focus();return false;}
          correr(edge('emitir',x.id),resultadoEmision,true);return false;}});
      anchoModal();pintarFranja();return;
    }
    modal({t:'Emitir en prueba',ic:'probeta',icc:'ic-cel',
      b:'<div class="fa-modal-prueba">'+I('probeta','ic-cel')+'<div><b>Prueba · sin validez tributaria.</b> Se emite en el ambiente de pruebas de OpenFactura: no va al SII.</div></div>'+resumenRevision(x),
      ok:'Emitir prueba',cls:'pri',cb:function(){correr(edge('emitir',x.id),resultadoEmision,true);return false;}});
    anchoModal();return;
  }
  if(act==='conciliar')return modal({t:'Conciliar con OpenFactura',ic:'repetir',icc:'ic-ama',
      b:'<p>Gestoor consulta el documento por su token o reenvía el <b>mismo</b> documento con la <b>misma</b> clave (OpenFactura nunca lo emite dos veces).</p><label>Token del documento en OpenFactura (opcional: solo si lo encontraste en su panel)<input id="faTok" maxlength="64" placeholder="64 caracteres"></label>',
      ok:'Conciliar',cb:function(){var t=$('faTok').value.trim().toLowerCase();if(t&&!/^[0-9a-f]{64}$/.test(t)){modal.error(ERR.TOKEN_INVALIDO);return false;}
        correr(edge('conciliar',x.id,t?{token:t}:{}),function(r){return r.estado==='EMITIDA'?'Conciliada: emitida con folio N° '+r.folio+'.':(r.estado==='APROBADA'?'Confirmado: NO se emitió. Ya se puede emitir de nuevo.':'Sigue incierta: '+(r.ayuda||r.codigo||''));},true);return false;}});
  if(act==='documentos')return correr(edge('documentos',x.id),function(r){return r.documentos==='OBTENIDOS'?'PDF y XML guardados.':'OpenFactura aún no entrega los documentos; intenta en unos minutos.';},false);
  if(act==='pdf')return descargar(x,'pdf');
  if(act==='xml')return descargar(x,'xml');
}

/* ── Eventos de la pantalla ── */
document.addEventListener('click',function(e){
  var v=e.target.closest('#vistaAdic,#hero');if(!v||($('vistaAdic')&&$('vistaAdic').hidden))return;
  var b=e.target.closest('[data-fa]');
  if(b){if(b.disabled)return;e.stopPropagation();accion(b.getAttribute('data-fa'),+b.getAttribute('data-id'));return;}
  var g=e.target.closest('[data-fa-grupo]');if(g){var k=g.getAttribute('data-fa-grupo');CTX.f.est=CTX.f.est===k&&g.classList.contains('fa-k')?'todos':k;render();return;}
  var oc=e.target.closest('[data-fa-ocultar]');if(oc){CTX.f.ocultarPruebas=!CTX.f.ocultarPruebas;render();var b2=document.querySelector('[data-fa-ocultar]');if(b2)b2.focus();return;}
  var rp=e.target.closest('[data-resp]');if(rp){var EQ=window.GEquipo;CTX.f.resp=EQ&&EQ.valida?EQ.valida(rp.getAttribute('data-resp')):rp.getAttribute('data-resp');render();return;}
  var cl=e.target.closest('[data-fa-cli]');if(cl&&CTX.wiz){wizSync();CTX.wiz.cliente=+cl.getAttribute('data-fa-cli');CTX.wiz.err='';render();var c2=document.querySelector('[data-fa-cli="'+CTX.wiz.cliente+'"]');if(c2)c2.focus();return;}
  var fp=e.target.closest('[data-fa-fp]');if(fp&&CTX.wiz){wizSync();CTX.wiz.fp=+fp.getAttribute('data-fa-fp');render();return;}
  var ps=e.target.closest('[data-fa-paso]');if(ps&&CTX.wiz){wizIr(+ps.getAttribute('data-fa-paso'));return;}
  var mas=e.target.closest('[data-fa-mas]');if(mas&&CTX.wiz){wizSync();if(CTX.wiz.lineas.length<10)CTX.wiz.lineas.push({glosa:'',cantidad:1,precio:'',detalle:''});render();var ls=document.querySelectorAll('#faLins .fa-g');if(ls.length)ls[ls.length-1].focus();return;}
  var q=e.target.closest('[data-fa-quitar]');if(q&&CTX.wiz){wizSync();if(CTX.wiz.lineas.length>1)CTX.wiz.lineas.splice(+q.getAttribute('data-fa-quitar'),1);render();return;}
  var fila=e.target.closest('[data-fa-card]');if(fila&&!e.target.closest('.tipw,a,button,input,select')){abrirDetalle(+fila.getAttribute('data-fa-card'));return;}
});
document.addEventListener('keydown',function(e){
  var fila=e.target.closest&&e.target.closest('#vistaAdic tr[data-fa-card]');
  if(fila&&e.target===fila&&(e.key==='Enter'||e.key===' ')){e.preventDefault();abrirDetalle(+fila.getAttribute('data-fa-card'));return;}
  if(e.key==='Enter'&&CTX.vista==='nueva'&&e.target.id==='faWizReal'){e.preventDefault();wizCrear();}
});
document.addEventListener('input',function(e){
  if(!e.target.closest)return;
  if(e.target.id==='faBuscar'){CTX.f.q=e.target.value;pintarTabla();return;}
  if(e.target.id==='faWizQ'&&CTX.wiz){CTX.wiz.qCli=e.target.value;var p=e.target.selectionStart;render();var n=$('faWizQ');if(n){n.focus();try{n.setSelectionRange(p,p);}catch(x){}}return;}
  if(e.target.id==='faWizReal'&&CTX.wiz&&CTX.wiz.err===ERR.PALABRA_REAL&&palabraRealOk(e.target.value))wizError('');
  if(e.target.closest('.fa-wiz')&&CTX.wiz){wizSync();var t=$('faTot');if(t)t.textContent=clp(wizTotal(CTX.wiz));}
});
document.addEventListener('change',function(e){
  if(e.target.id==='faFCli'){CTX.f.cli=e.target.value;render();return;}
  if(e.target.classList&&e.target.classList.contains('geq-sel-in')&&e.target.closest('#vistaAdic')){var EQ=window.GEquipo;CTX.f.resp=EQ&&EQ.valida?EQ.valida(e.target.value):e.target.value;render();}
});
// Al cerrar la ventana se restaura su ancho normal y se quita la franja temporal de la emisión REAL
new MutationObserver(function(){var m=$('modal');if(m&&!m.classList.contains('on')){if(m.classList.contains('fa-ancho')){m.classList.remove('fa-ancho');m.style.width='';}if(CTX.franjaModal){CTX.franjaModal=null;pintarFranja();}}}).observe(document.body,{subtree:true,attributes:true,attributeFilter:['class']});

window.FX_ADICIONAL={
  render:function(ctx){CTX.rol=ctx&&ctx.rol||'lectura';CTX.fuera=false;render();recargar();},
  cerrar:function(){}
};
})();
