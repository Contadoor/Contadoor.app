/* ============================================================
   trabajos-especiales/te.js — Trabajos especiales T1 (pantalla v1)
   Conectada SOLO a lo que exponen las migraciones 202610201700_trabajos_especiales_t1 + 1710 (Storage), en producción (main 49ca3629):
     Lectura (RLS te_puede_ver_trabajo: Master, Pagos, Facturación y el responsable): te_v_tablero · te_trabajos · te_cuotas ·
       te_facturas · te_pasos · te_documentos · te_eventos · te_tareas · te_parametros · servicios_adicionales (catálogo) · clientes (nombre, según su RLS)
     RPC (cada una valida el rol en el servidor): te_yo · te_cotizacion_crear · te_cotizacion_enviar_aprobacion · te_cotizacion_aprobar ·
       te_cotizacion_devolver · te_cotizacion_enviar · te_cotizacion_renovar · te_cotizacion_registrar_aceptacion · te_cotizacion_registrar_rechazo ·
       te_documento_registrar · te_factura_preparar · te_factura_aprobar · te_factura_devolver · te_trabajo_autorizar_inicio · te_trabajo_iniciar ·
       te_paso_marcar · te_paso_saltar · te_trabajo_terminar · te_trabajo_faltantes_cierre · te_trabajo_cerrar · te_trabajo_cerrar_sin_completar
     Storage: bucket privado 'trabajos-especiales' (<trabajo>/<paso-N|aceptacion|otros>/<archivo>). Suben el responsable o el Master;
       Pagos y Facturación ven, no suben. Sin borrar ni sobrescribir: un documento se reemplaza subiendo otro.
   Los pagos de las cuotas los registra SIEMPRE Cobranza (Leandro); aquí solo se ve su estado, que Cobranza sincroniza con T1.
   MODO PRUEBA: no se envía ningún aviso al cliente (la cola queda en te_avisos) y la factura va en modo PRUEBA.
   Modo demostración: te-demo.js (solo ?demo=1 en localhost).
   ============================================================ */
(function(){
'use strict';
var G=window.GC, esc=G.esc, clp=G.clp, clpT=G.clpT, I=G.I, $=G.$;
var DEMO=window.GC_DEMO===true&&G.LOCAL&&!!window.TE_DEMO_API;
var BUCKET='trabajos-especiales';
var MIMES=['application/pdf','image/png','image/jpeg','image/webp','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];

var ERR={
  SIN_SESION:'No hay una sesión activa.',SIN_MODULO:'Necesitas el módulo Trabajos especiales (Administración).',SOLO_MASTER:'Solo el Master puede hacer esta acción.',
  SOLO_RESPONSABLE:'Solo el responsable del trabajo (o el Master) puede hacer esta acción.',SOLO_FACTURADOR:'Solo Facturación prepara la factura (el Master aprueba).',
  PRECIO_NO_PERMITIDO:'El precio no se escribe aquí: sale del catálogo o lo fija el Master al aprobar.',CAMPO_NO_PERMITIDO:'Hay un campo no permitido.',
  CLIENTE_O_PROSPECTO:'Indica un cliente de la cartera o los datos del prospecto.',SERVICIO_O_SOLICITUD:'Elige un servicio del catálogo o describe el servicio nuevo.',
  CLIENTE_NO_EXISTE:'El cliente no existe.',SERVICIO_NO_EXISTE:'El servicio no existe.',SERVICIO_INACTIVO:'El servicio está inactivo.',SERVICIO_NO_CLP:'El servicio no está en pesos.',
  SERVICIO_NO_PUNTUAL:'El servicio no es puntual ni por propuesta.',SERVICIO_SIN_PRECIO:'El servicio no tiene un precio válido en el catálogo.',
  SERVICIO_NO_CREADO:'Primero el Master debe crear el servicio en el catálogo.',DETALLE_INCOMPLETO:'Falta qué se hará y el alcance.',
  NO_EN_BORRADOR:'La cotización ya no está en borrador.',NO_EDITABLE:'La cotización ya no se puede editar.',NO_EN_APROBACION:'La cotización no está en aprobación.',
  HUELLA_NO_COINCIDE:'La cotización cambió desde que la abriste. Recarga y revísala de nuevo.',VALOR_FIJO_DEL_CATALOGO:'El servicio tiene precio fijo del catálogo.',
  VALOR_FUERA_DE_RANGO:'El valor está fuera del rango del catálogo.',VALOR_OBLIGATORIO:'Servicio por propuesta: fija el valor.',DESCUENTO_INVALIDO:'Descuento entre 0 y 100 %.',
  TIPO_DTE_NO_PERMITIDO:'Hoy solo se permite la factura exenta DTE 34.',COMENTARIO_OBLIGATORIO:'Escribe un comentario.',NO_APROBADA:'Sin la aprobación del Master no se envía.',
  NO_RENOVABLE:'Solo se renueva una cotización aprobada sin enviar o enviada y vencida.',NO_ENVIADA:'La cotización no está enviada.',COTIZACION_VENCIDA:'La cotización venció: renuévala.',
  YA_ACEPTADA:'La cotización ya fue aceptada.',MEDIO_INVALIDO:'Elige cómo aceptó el cliente.',RESPALDO_OBLIGATORIO:'Sube primero el respaldo de la aceptación.',
  MOTIVO_OBLIGATORIO:'Escribe un motivo (mínimo 10 caracteres).',RUTA_INVALIDA:'La ruta del archivo no es válida.',PASO_NO_PENDIENTE:'El paso ya no está pendiente.',
  ARCHIVO_NO_ENCONTRADO:'El archivo no quedó en el almacenamiento. Vuelve a subirlo.',ARCHIVO_NO_COINCIDE:'El archivo subido no coincide (tamaño o tipo).',
  STORAGE_NO_DISPONIBLE:'El almacenamiento no está disponible.',FALTA_DOCUMENTO:'Sube primero el documento del paso.',ENTREGA_RETENIDA:'La entrega queda retenida hasta el pago final.',
  PASOS_OBLIGATORIOS_PENDIENTES:'Faltan pasos obligatorios del checklist.',NO_EN_EJECUCION:'El trabajo no está en ejecución.',SIN_FACTURA:'La factura DTE 34 se emite antes de iniciar.',
  SIN_PAGO_DE_INICIO:'Falta el pago de inicio (lo registra Cobranza; la excepción la autoriza el Master).',PLANTILLA_NO_PUBLICADA:'El Master debe publicar la plantilla de checklist del servicio.',
  NO_INICIABLE:'El trabajo no se puede iniciar en esta etapa.',NO_APLICA:'No aplica en esta etapa.',FACTURA_NO_EXISTE:'La factura no existe.',NO_PREPARABLE:'La factura no se puede preparar en este estado.',
  TRABAJO_NO_ACEPTADO:'El trabajo no está aceptado.',TOTAL_NO_CUADRA:'El total de la factura no cuadra con el valor aprobado.',NO_LISTA:'La factura no está lista para aprobar.',
  REVISION_OBLIGATORIA:'Marca «Revisado con el analista».',CIERRE_REQUIERE_OTRA_PERSONA:'El responsable no cierra su propio trabajo.',CIERRE_INCOMPLETO:'Faltan requisitos para cerrar.',
  NO_SALTABLE:'Ese paso no se puede saltar.',ENTREGA_NO_SE_SALTA:'El paso de entrega no se salta.',MOTIVO_INVALIDO:'Elige un motivo válido.',TRABAJO_CERRADO:'El trabajo está cerrado (solo lectura).',TRABAJO_NO_EXISTE:'El trabajo no existe.',
  DTE_33_NO_IMPLEMENTADO:'La factura afecta (DTE 33) aún no está implementada.',RESPONSABLE_SIN_MODULO:'La persona asignada no tiene el módulo.'
};
function mErr(e){return G.msgError(e,ERR);}

/* ── Datos ── */
var A=G.API;
function q(v){return encodeURIComponent(v);}
var REAL={
  yo:function(){return A.rpc('te_yo');},
  tablero:function(){
    return Promise.all([
      A.get('te_v_tablero?select=*&order=id.desc&limit=1000'),
      A.get('te_parametros?select=modo_factura,produccion_habilitada,avisos_habilitados,avisos_modo,vigencia_cotizacion_dias,responsable_ve_todos').catch(function(){return [];})
    ]).then(function(r){return {trabajos:r[0],parametros:r[1][0]||null,usuarios:{}};});
  },
  ficha:function(id){
    var i=q(id);
    return Promise.all([
      A.get('te_trabajos?id=eq.'+i+'&select=id,codigo,cliente_id,prospecto_nombre,servicio_id,servicio_solicitado,descripcion_que,descripcion_alcance,descripcion_antecedentes,condicion_pago,n_cuotas,valor_catalogo,valor_base,descuento_pct,valor,responsable_usuario_id,etapa,etapa_desde,estatus,estatus_motivo,huella_revision,devolucion_comentario,vigencia_hasta,enviado_at,aceptado_at,aceptacion_medio,iniciado_at,inicio_autorizado_motivo,retener_entrega,entrega_estado,terminado_at,cerrado_at,cierre_tipo,cierre_motivo,cierre_detalle,rechazo_motivo,creado_at'),
      A.get('te_cuotas?trabajo_id=eq.'+i+'&select=id,n,cuotas_total,es_inicio,monto,fecha_vencimiento,estado,pagada_fecha,pago_referencia&order=n.asc'),
      A.get('te_facturas?trabajo_id=eq.'+i+'&select=id,modo,tipo_dte,estado,total,snapshot_hash,of_folio,fecha_emision_dte,devolucion,creado_at&order=id.desc'),
      A.get('te_pasos?trabajo_id=eq.'+i+'&select=id,orden,origen,nombre,plazo_dias,requiere_documento,tipo_documento,obligatorio,es_entrega,avisa_cliente,estado,hecho_at,saltado_motivo&estado=neq.QUITADO&order=orden.asc'),
      A.get('te_documentos?trabajo_id=eq.'+i+'&select=id,paso_id,tipo,storage_path,nombre,mime,bytes,vigente,subido_at&order=subido_at.desc'),
      A.get('te_eventos?trabajo_id=eq.'+i+'&select=id,tipo,actor,creado_at&order=creado_at.desc&limit=40'),
      A.get('te_tareas?trabajo_id=eq.'+i+'&estado=eq.ABIERTA&select=id,tipo,creada_at')
    ]).then(function(r){return {t:r[0][0]||null,cuotas:r[1],facturas:r[2],pasos:r[3],docs:r[4],eventos:r[5],tareas:r[6]};});
  },
  servicios:function(){return A.get('servicios_adicionales?select=id,nombre,descripcion,precio,precio_hasta,moneda,tipo&activo=eq.true&moneda=eq.CLP&tipo=in.(puntual,por_propuesta)&order=nombre.asc');},
  clientes:function(){return A.get('clientes?select=id,razon_social&order=razon_social.asc&limit=3000').catch(function(){return [];});},
  rpc:function(fn,args){return A.rpc(fn,args);},
  subir:function(ruta,archivo){
    var c=window._sbAuthClient;if(!c||!c.storage)return Promise.reject(new Error('STORAGE_NO_DISPONIBLE'));
    return c.storage.from(BUCKET).upload(ruta,archivo,{upsert:false,contentType:archivo.type,cacheControl:'3600'}).then(function(r){if(r.error)throw new Error(r.error.message||'No se pudo subir el archivo');return ruta;});
  },
  urlFirmada:function(ruta){
    var c=window._sbAuthClient;if(!c||!c.storage)return Promise.reject(new Error('STORAGE_NO_DISPONIBLE'));
    return c.storage.from(BUCKET).createSignedUrl(ruta,120).then(function(r){if(r.error)throw new Error(r.error.message);return r.data.signedUrl;});
  }
};
var D=DEMO?window.TE_DEMO_API:REAL;

/* ── Catálogos ── */
var ETAPAS=[
  ['BORRADOR','1 · Borrador','Responsable'],['EN_APROBACION','2 · Aprobación','Master aprueba o devuelve'],['APROBADA','3 · Aprobada','Por enviar al cliente'],
  ['ENVIADA','4 · Enviada','Esperando aceptación'],['ACEPTADA','5 · Aceptada','Factura DTE 34 antes de iniciar'],['FACTURADA','6 · Facturada','Pago de inicio (Cobranza)'],
  ['EN_EJECUCION','7 · En ejecución','Checklist y documentos'],['TERMINADO','8 · Terminado','Entrega, cobro y cierre']];
var ET={};ETAPAS.forEach(function(e){ET[e[0]]=e;});ET.RECHAZADA=['RECHAZADA','Rechazada','El cliente no aceptó'];
var COND={CONTADO:'Contado',CINCUENTA:'50/50',CUOTAS:'Cuotas'};
var EV={BORRADOR_CREADO:'Borrador creado',BORRADOR_EDITADO:'Borrador editado',ENVIADA_A_APROBACION:'Enviada a aprobación',COTIZACION_APROBADA:'Aprobada por el Master',COTIZACION_DEVUELTA:'Devuelta por el Master',
  COTIZACION_ENVIADA:'Enviada al cliente (aviso en cola)',COTIZACION_RENOVADA:'Renovada',COTIZACION_ACEPTADA:'Aceptada',COTIZACION_RECHAZADA:'Rechazada por el cliente',FACTURA_PREPARADA:'Factura preparada',
  FACTURA_APROBADA:'Factura aprobada',FACTURA_EMITIDA:'Factura emitida',CUOTA_PAGADA:'Cuota pagada (Cobranza)',CUOTA_PAGO_REVERTIDO:'Pago de cuota revertido (Cobranza)',TRABAJO_INICIADO:'Trabajo iniciado',
  INICIO_AUTORIZADO_SIN_PAGO:'Inicio autorizado sin pago (Master)',PASO_HECHO:'Paso hecho',PASO_SALTADO:'Paso saltado',DOCUMENTO_SUBIDO:'Documento subido',DOCUMENTO_REEMPLAZADO:'Documento reemplazado',
  TRABAJO_TERMINADO:'Trabajo terminado',TRABAJO_CERRADO:'Trabajo cerrado',TRABAJO_CERRADO_SIN_COMPLETAR:'Cerrado sin completar',SERVICIO_ASIGNADO:'Servicio asignado'};
var FAC={PENDIENTE:{t:'Instrucción pendiente',c:'ambar'},LISTA:{t:'Lista · espera aprobación del Master',c:'cel'},APROBADA:{t:'Aprobada · por emitir',c:'lila'},EMITIENDO:{t:'Emitiendo',c:'cel'},
  INCIERTO:{t:'Incierto · por conciliar',c:'naranja'},EMITIDA:{t:'Emitida',c:'verde'},ERROR:{t:'Error',c:'rojo'},ANULADA:{t:'Anulada',c:'gris'}};

var S={yo:null,trab:[],par:null,usuarios:{},vista:'tablero',buscar:'',soloMios:false,hoy:G.hoyCL()};
function esEditor(t){return S.yo&&(S.yo.es_master||(S.yo.responsable&&String(t.responsable_usuario_id)===String(S.yo.usuario_id)));}
function respNombre(id){if(S.yo&&String(id)===String(S.yo.usuario_id))return 'Tú';return S.usuarios[id]||('Responsable N.º '+id);}

/* ── Carga ── */
function cargar(){
  return D.yo().then(function(yo){S.yo=yo;if(!yo.puede_leer){render();return;}
    return D.tablero().then(function(d){S.trab=d.trabajos||[];S.par=d.parametros;S.usuarios=d.usuarios||{};render();});
  }).catch(function(e){S.err=mErr(e);render();});
}
function recargar(msg,abrirId){return D.tablero().then(function(d){S.trab=d.trabajos||[];S.par=d.parametros;S.usuarios=d.usuarios||{};render();if(msg)G.toast(msg);if(abrirId)abrirFicha(abrirId);}).catch(function(e){G.toast(mErr(e),true);});}

function banner(){
  var p=S.par;
  return '<div class="gc-prueba" role="note">'+I('escudo','ic-cel')+'<div><b>'+(p&&p.avisos_habilitados&&p.avisos_modo==='PRODUCCION'?'Avisos al cliente habilitados por el Master.':'Modo prueba hasta el 31-12-2026: no se envían avisos ni se suspende.')+'</b> '
    +'Los avisos al cliente quedan en cola'+(p&&p.avisos_habilitados?'':' (envío deshabilitado)')+' y la factura va en modo '+(p?esc(p.modo_factura):'PRUEBA')+'. '
    +'Los pagos de las cuotas los registra Cobranza (Leandro).</div></div>';
}
function render(){
  var app=$('gcApp');
  if(S.err){app.innerHTML=banner()+'<div class="aviso rojo">'+I('alerta','ic-roj')+'<span>No se pudo cargar: '+esc(S.err)+'</span><button type="button" class="btn chico sec" data-act="recargar">Reintentar</button></div>';return;}
  if(!S.yo)return;
  if(!S.yo.puede_leer){app.innerHTML=banner()+'<div class="aviso ambar">'+I('candado','ic-amb')+'<span>Tu usuario no tiene acceso a Trabajos especiales. Lo ven el Master, el responsable (módulo Trabajos especiales), Pagos y Facturación.</span></div>';return;}
  var abiertos=S.trab.filter(function(t){return !t.cerrado_at;});
  var h=banner()+flujoHtml()+heroHtml(abiertos)+barraHtml(abiertos);
  var lista=abiertos.filter(filtra);
  if(S.vista==='tablero')h+=tableroHtml(lista);
  else if(S.vista==='tabla')h+=tablaHtml(lista,false);
  else h+=tablaHtml(S.trab.filter(function(t){return t.cerrado_at;}).filter(filtra),true);
  app.innerHTML=h;
}
function filtra(t){
  if(S.soloMios&&String(t.responsable_usuario_id)!==String(S.yo.usuario_id))return false;
  if(S.buscar){var b=S.buscar.toLowerCase();if((t.cliente_nombre||'').toLowerCase().indexOf(b)<0&&(t.codigo||'').toLowerCase().indexOf(b)<0&&(t.servicio_nombre||'').toLowerCase().indexOf(b)<0)return false;}
  return true;
}
function flujoHtml(){
  return '<section class="te-flujo" aria-label="Ciclo del trabajo especial">'+ETAPAS.map(function(e,i){
    return '<div class="te-paso'+(i===4||i===5?' otro':'')+'"><span class="n">'+(i+1)+'</span><b>'+esc(e[1].replace(/^\d · /,''))+'</b><small>'+esc(e[2])+'</small></div>';}).join('')+'</section>';
}
function heroHtml(ab){
  function c(f){return ab.filter(f);}
  var porAprobar=c(function(t){return t.etapa==='EN_APROBACION';}),enviadas=c(function(t){return t.etapa==='ENVIADA';}),vencidas=enviadas.filter(function(t){return t.cotizacion_vencida;}),
      curso=c(function(t){return t.etapa==='EN_EJECUCION';}),bloq=c(function(t){return t.estatus!=='EN_CURSO';}),sinFac=c(function(t){return t.alerta_aceptado_sin_facturar;}),
      pagoIni=c(function(t){return t.etapa==='FACTURADA'&&t.pago_inicio_estado==='PENDIENTE';}),sinPagoEj=c(function(t){return t.alerta_ejecucion_sin_pago_inicio;}),
      termSaldo=c(function(t){return t.alerta_terminado_con_saldo;}),cuotasV=ab.reduce(function(s,t){return s+Number(t.cuotas_vencidas||0);},0),
      saldo=ab.filter(function(t){return ['ACEPTADA','FACTURADA','EN_EJECUCION','TERMINADO'].indexOf(t.etapa)>=0;}).reduce(function(s,t){return s+Number(t.saldo||0);},0);
  var av=curso.filter(function(t){return G.esNum(t.avance);}),avP=av.length?Math.round(av.reduce(function(s,t){return s+Number(t.avance);},0)/av.length):null;
  function sum(l){return l.reduce(function(s,t){return s+Number(t.valor||0);},0);}
  return '<section class="card hero"><div class="gc-kicker">Gestión interna · cotización → aceptación → factura → pago de inicio → ejecución → cobro → cierre</div>'
    +'<h2 class="gc-titulo">Trabajos <span>especiales</span></h2><p class="nota">🧑‍💼 Constituciones, formalizaciones y modificaciones: cotiza el responsable (p. ej. Miguel), aprueba el Master, factura Facturación y los pagos los registra Cobranza.</p>'
    +'<div class="gc-kpis">'
    +'<div class="kpi acc-cel"><small>🛡️ Por aprobar (Master)</small><b>'+porAprobar.length+'</b><p>cotizaciones esperando revisión</p></div>'
    +'<div class="kpi acc-ambar"><small>📨 Enviadas sin respuesta</small><b>'+enviadas.length+'</b><p>'+vencidas.length+' vencida(s)</p></div>'
    +'<div class="kpi acc-lila"><small>🛠️ En curso</small><b>'+curso.length+'</b><p>avance promedio '+(avP!=null?avP+' %':'<span class="nd">No disponible</span>')+'</p>'+(avP!=null?'<div class="gc-avance"><i style="width:'+avP+'%"></i></div>':'')+'</div>'
    +'<div class="kpi acc-naranja"><small>⏸️ En espera / bloqueados</small><b>'+bloq.length+'</b><p>con motivo registrado</p></div>'
    +'<div class="kpi acc-rojo"><small>🧾 Aceptados sin factura</small><b>'+sinFac.length+' · '+clpT(sum(sinFac))+'</b><p>no pueden iniciar sin la factura DTE 34</p></div>'
    +'<div class="kpi acc-ambar"><small>💳 Pago de inicio pendiente</small><b>'+pagoIni.length+'</b><p>'+sinPagoEj.length+' iniciado(s) sin pago (autorizado)</p></div>'
    +'<div class="kpi acc-rojo"><small>⏰ Cuotas vencidas</small><b>'+cuotasV+'</b><p>'+termSaldo.length+' terminado(s) con saldo · las cobra Cobranza</p></div>'
    +'<div class="kpi acc-verde"><small>💰 Saldo por cobrar</small><b>'+clp(saldo)+'</b><p>cuotas pendientes de trabajos aceptados</p></div>'
    +'</div></section>';
}
function barraHtml(ab){
  var nH=S.trab.length-ab.length, puede=S.yo.responsable;
  return '<div class="gc-nav" role="group" aria-label="Vista">'
    +'<button type="button" class="sn'+(S.vista==='tablero'?' on':'')+'" data-act="vista" data-v="tablero">'+I('columnas')+'Tablero</button>'
    +'<button type="button" class="sn'+(S.vista==='tabla'?' on':'')+'" data-act="vista" data-v="tabla">'+I('tabla')+'Tabla <span class="cnt">'+ab.length+'</span></button>'
    +'<button type="button" class="sn'+(S.vista==='historial'?' on':'')+'" data-act="vista" data-v="historial">'+I('historial')+'Historial <span class="cnt">'+nH+'</span></button>'
    +'<input type="search" class="gc-buscar" id="teBuscar" placeholder="Buscar cliente, código o servicio…" value="'+esc(S.buscar)+'" aria-label="Buscar">'
    +(!(S.yo.es_master||(S.yo.responsable&&S.par&&S.par.responsable_ve_todos))?'':'<label class="chk" style="margin:0"><input type="checkbox" id="teMios"'+(S.soloMios?' checked':'')+'> Solo los míos</label>')
    +(puede?'<button type="button" class="btn" data-act="nueva" style="margin-left:auto">'+I('plus')+'Nueva cotización</button>':'')
    +'</div>';
}
function tarjeta(t){
  var al=t.alerta_aceptado_sin_facturar||t.alerta_ejecucion_sin_pago_inicio||t.alerta_terminado_con_saldo||t.cotizacion_vencida||Number(t.cuotas_vencidas)>0;
  var chipTxt=t.cotizacion_vencida?['Vencida','rojo']:t.alerta_aceptado_sin_facturar?['Sin factura','rojo']:t.alerta_ejecucion_sin_pago_inicio?['Sin pago de inicio','naranja']:
    t.estatus==='BLOQUEADO'?['Bloqueado','rojo']:t.estatus==='EN_ESPERA'?['En espera','ambar']:null;
  return '<button type="button" class="te-card'+(al?' alerta':t.estatus!=='EN_CURSO'?' aviso-a':'')+'" data-act="ficha" data-id="'+esc(t.id)+'">'
    +'<div class="c1"><span class="cod">'+esc(t.codigo)+'</span>'+(chipTxt?'<span class="estado '+chipTxt[1]+'">'+chipTxt[0]+'</span>':'')+'</div>'
    +'<span class="nom">'+esc(t.cliente_nombre||'Cliente N.º '+t.cliente_id)+(t.es_prospecto?'<span class="tag-pros">prospecto</span>':'')+'</span>'
    +'<span class="srv">'+esc(t.servicio_nombre||'Servicio por crear')+' · '+esc(COND[t.condicion_pago]||t.condicion_pago)+(t.condicion_pago==='CUOTAS'?' '+t.n_cuotas:'')+'</span>'
    +(t.etapa==='EN_EJECUCION'||t.etapa==='TERMINADO'?'<div class="gc-avance" title="Avance '+(G.esNum(t.avance)?t.avance+' %':'no disponible')+'"><i style="width:'+(Number(t.avance)||0)+'%"></i></div>':'')
    +'<div class="c3"><span>'+esc(respNombre(t.responsable_usuario_id))+' · '+diasEtapa(t)+'</span><b>'+(G.esNum(t.valor)?clpT(t.valor):(G.esNum(t.valor_catalogo)?clpT(t.valor_catalogo):'A definir'))+'</b></div></button>';
}
function diasEtapa(t){var d=G.dias(String(t.etapa_desde||'').slice(0,10),S.hoy);return d==null?'':(d===0?'hoy':d+' d en etapa');}
function tableroHtml(lista){
  var cols=ETAPAS.slice();if(lista.some(function(t){return t.etapa==='RECHAZADA';}))cols.push(ET.RECHAZADA);
  return '<div class="te-tablero">'+cols.map(function(c){
    var l=lista.filter(function(t){return t.etapa===c[0];}),conV=l.filter(function(t){return G.esNum(t.valor);}),tot=conV.reduce(function(s,t){return s+Number(t.valor);},0);
    return '<div class="te-col"><div class="te-col-h"><div><b>'+esc(c[1].replace(/^\d · /,''))+'</b><small>'+esc(c[2])+'</small></div><span class="cnt">'+l.length+'</span></div>'
      +(l.length?l.map(tarjeta).join(''):'<div class="gc-vacio" style="padding:14px">—</div>')+'<div class="te-col-f">Total: <b>'+(conV.length?clpT(tot):l.length?'A definir':'—')+'</b>'+(conV.length&&conV.length<l.length?' <span class="t3">('+(l.length-conV.length)+' a definir)</span>':'')+'</div></div>';
  }).join('')+'</div>';
}
function tablaHtml(lista,hist){
  if(!lista.length)return '<section class="card"><div class="gc-vacio" style="margin-top:16px">'+(hist?'Aún no hay trabajos cerrados.':'No hay trabajos'+(S.buscar?' con esa búsqueda':'')+'. '+(S.yo.responsable?'Crea la primera cotización con «Nueva cotización».':''))+'</div></section>';
  var h='<section class="card"><div class="tabla-box gc-tabla-d" style="margin-top:12px"><table class="gt"><thead><tr><th>Código</th><th>Cliente</th><th>Servicio</th><th>'+(hist?'Cierre':'Etapa')+'</th><th class="num">Valor</th><th class="num">Saldo</th><th>Factura</th><th>Responsable</th></tr></thead><tbody>';
  lista.forEach(function(t){
    h+='<tr class="clic" data-act="ficha" data-id="'+esc(t.id)+'" tabindex="0"><td><b class="lila">'+esc(t.codigo)+'</b></td><td class="cli"><b>'+esc(t.cliente_nombre||'—')+'</b>'+(t.es_prospecto?'<span class="tag-pros">prospecto</span>':'')+'</td>'
      +'<td>'+esc(t.servicio_nombre||'Servicio por crear')+'<span class="sub">'+esc(COND[t.condicion_pago]||'')+'</span></td>'
      +'<td>'+(hist?'<span class="estado '+(t.cierre_tipo==='COMPLETO'?'verde':'gris')+'">'+(t.cierre_tipo==='COMPLETO'?'Completo':'Sin completar')+'</span><span class="sub">'+G.fFecha(t.cerrado_at)+'</span>':'<span class="estado lila sin">'+esc((ET[t.etapa]||[0,t.etapa])[1])+'</span>')+'</td>'
      +'<td class="num">'+(G.esNum(t.valor)?clp(t.valor):'<span class="t3">A definir</span>')+'</td><td class="num">'+(['ACEPTADA','FACTURADA','EN_EJECUCION','TERMINADO'].indexOf(t.etapa)>=0||(hist&&t.cierre_tipo==='COMPLETO')?clp(t.saldo):'<span class="t3">—</span>')+'</td>'
      +'<td>'+(t.factura_estado?'<span class="estado '+(FAC[t.factura_estado]||{c:'gris'}).c+'">'+esc((FAC[t.factura_estado]||{t:t.factura_estado}).t)+'</span>':'<span class="t3">—</span>')+'</td><td>'+esc(respNombre(t.responsable_usuario_id))+'</td></tr>';
  });
  h+='</tbody></table></div><div class="gc-lista-m" style="margin-top:12px">'+lista.map(tarjeta).join('')+'</div></section>';
  return h;
}

/* ── Ficha del trabajo ── */
var FICHA=null;
function abrirFicha(id){
  G.abrirDet('<div class="aviso lila"><span class="gc-spin"></span>Cargando el trabajo…</div>');
  D.ficha(id).then(function(f){
    if(!f.t){$('gcDetCuerpo').innerHTML='<div class="aviso ambar"><span>No tienes acceso a este trabajo o ya no existe.</span></div>';return;}
    FICHA=f;FICHA.tab=S.trab.find(function(x){return String(x.id)===String(id);})||{};$('gcDetCuerpo').innerHTML=fichaHtml(f);
  }).catch(function(e){$('gcDetCuerpo').innerHTML='<div class="aviso rojo">'+I('alerta','ic-roj')+'<span>'+esc(mErr(e))+'</span></div>';});
}
function fichaHtml(f){
  var t=f.t, tb=f.tab, ed=esEditor(t), yo=S.yo, cerr=!!t.cerrado_at, fac=f.facturas.find(function(x){return x.estado!=='ANULADA';});
  var idx=ETAPAS.findIndex(function(e){return e[0]===t.etapa;});
  var h='<div class="det-cab"><small>'+esc(t.codigo)+' · '+esc(respNombre(t.responsable_usuario_id))+'</small><h3>'+esc(tb.cliente_nombre||t.prospecto_nombre||'Cliente N.º '+t.cliente_id)+(t.cliente_id?'':'<span class="tag-pros">prospecto</span>')+'</h3>'
    +'<span class="estado lila">'+esc((ET[t.etapa]||[0,t.etapa])[1])+'</span> '+(t.estatus!=='EN_CURSO'?'<span class="estado '+(t.estatus==='BLOQUEADO'?'rojo':'ambar')+'">'+(t.estatus==='BLOQUEADO'?'Bloqueado':'En espera')+(t.estatus_motivo?': '+esc(t.estatus_motivo):'')+'</span>':'')
    +(cerr?' <span class="estado gris">Cerrado '+(t.cierre_tipo==='COMPLETO'?'completo':'sin completar')+' · solo lectura</span>':'')+'</div>';
  h+='<div class="te-flujo" style="margin-top:12px">'+ETAPAS.map(function(e,i){return '<div class="te-paso '+(cerr||i<idx?'hecho':i===idx?'actual':'')+'"><span class="n">'+(i+1)+'</span><b>'+esc(e[1].replace(/^\d · /,''))+'</b></div>';}).join('')+'</div>';
  h+='<div class="gc-tri"><div><small>💰 Valor</small><b>'+(G.esNum(t.valor)?clp(t.valor):(G.esNum(t.valor_catalogo)?clpT(t.valor_catalogo)+' <span class="t3" style="font-size:11px">catálogo</span>':'<span class="nd">A definir por el Master</span>'))+'</b></div>'
    +'<div><small>🧾 Pago</small><b>'+esc(COND[t.condicion_pago]||t.condicion_pago)+(t.condicion_pago==='CUOTAS'?' · '+t.n_cuotas:'')+'</b></div><div><small>📊 Saldo</small><b>'+(f.cuotas.length?clp(tb.saldo):'<span class="nd">Sin plan aún</span>')+'</b></div></div>';
  if(t.descuento_pct)h+='<p class="nota">Valor base '+clpT(t.valor_base)+' · descuento '+esc(t.descuento_pct)+' % (Master) · exento DTE 34.</p>';
  if(t.devolucion_comentario&&t.etapa==='BORRADOR')h+='<div class="aviso ambar">'+I('alerta','ic-amb')+'<span>Devuelta por el Master: «'+esc(t.devolucion_comentario)+'»</span></div>';
  if(t.rechazo_motivo)h+='<div class="aviso gris"><span>Rechazo del cliente: «'+esc(t.rechazo_motivo)+'»</span></div>';
  h+=accionesHtml(f,ed,fac);
  h+='<section><h4>📝 Detalle</h4><p><b>Servicio:</b> '+esc(tb.servicio_nombre||t.servicio_solicitado||'—')+(t.servicio_id?'':' <span class="estado ambar">Servicio nuevo solicitado al Master</span>')+'</p>'
    +'<p><b>Qué se hará:</b> '+esc(t.descripcion_que||'—')+'</p><p><b>Alcance:</b> '+esc(t.descripcion_alcance||'—')+'</p>'+(t.descripcion_antecedentes?'<p><b>Antecedentes:</b> '+esc(t.descripcion_antecedentes)+'</p>':'')
    +(t.vigencia_hasta?'<p class="nota">Vigencia de la cotización: hasta el '+G.fFecha(t.vigencia_hasta)+'</p>':'')+'</section>';
  // Cuotas (estado sincronizado desde Cobranza)
  h+='<section><h4>💳 Cuotas · las cobra Cobranza</h4>';
  if(!f.cuotas.length)h+='<p class="t3">El plan de cuotas se crea al registrar la aceptación del cliente.</p>';
  else h+=f.cuotas.map(function(c){var venc=c.estado==='PENDIENTE'&&c.fecha_vencimiento&&c.fecha_vencimiento<S.hoy;
    return '<div class="cl"><span><span class="gc-semaforo '+(c.estado==='PAGADA'?'sem-verde':c.estado==='ANULADA'?'sem-gris':venc?'sem-rojo':'sem-ambar')+'"></span> Cuota '+c.n+' de '+c.cuotas_total+(c.es_inicio?' · <b>pago de inicio</b>':'')
      +'<br><small class="t3">'+(c.estado==='PAGADA'?'Pagada el '+G.fFecha(c.pagada_fecha)+' · registrada por Cobranza':c.estado==='ANULADA'?'Anulada':(c.fecha_vencimiento?(venc?'Vencida el ':'Vence el ')+G.fFecha(c.fecha_vencimiento):'Vence al terminar el trabajo'))+'</small></span><b class="'+(c.estado==='PAGADA'?'t-verde':venc?'t-rojo':'')+'">'+clp(c.monto)+'</b></div>';}).join('')
    +'<p class="nota">Las cuotas entran a la cartera de Cobranza cuando la factura está emitida en producción. Al registrar el pago, Cobranza marca la cuota aquí; el pago nunca inicia ni entrega solo (crea una tarea).</p>';
  h+='</section>';
  // Factura
  h+='<section><h4>🧾 Factura DTE 34 (exenta)</h4>';
  if(!fac)h+='<p class="t3">La instrucción de facturación se crea al aceptar la cotización.</p>';
  else h+='<div class="cl"><span>'+'<span class="estado '+(FAC[fac.estado]||{c:'gris'}).c+'">'+esc((FAC[fac.estado]||{t:fac.estado}).t)+'</span> · modo '+esc(fac.modo)+(fac.of_folio?' · folio '+esc(fac.of_folio)+' del '+G.fFecha(fac.fecha_emision_dte):'')+(fac.devolucion?'<br><small class="t-ambar">Devuelta: '+esc(fac.devolucion)+'</small>':'')+'</span><b>'+clp(fac.total)+'</b></div>'
    +(fac.estado==='APROBADA'?'<p class="nota">La emisión la hace la Edge de Facturación (F1c), paquete aparte. Hasta entonces el trabajo no pasa a «Facturada».</p>':'');
  h+='</section>';
  // Checklist
  if(f.pasos.length){
    var puedeMarcar=ed&&!cerr&&(t.etapa==='EN_EJECUCION'||t.etapa==='TERMINADO');
    h+='<section><h4>✅ Checklist · avance '+(G.esNum(tb.avance)?tb.avance+' %':'—')+'</h4><div class="gc-avance"><i style="width:'+(Number(tb.avance)||0)+'%"></i></div><ul class="te-check">';
    f.pasos.forEach(function(p){
      var doc=f.docs.find(function(d){return String(d.paso_id)===String(p.id)&&d.vigente;});
      var ac='';
      if(puedeMarcar&&p.estado==='PENDIENTE'&&(t.etapa==='EN_EJECUCION'||p.es_entrega)){
        if(p.requiere_documento)ac+='<button type="button" class="btn chico sec" data-act="subir-paso" data-paso="'+esc(p.id)+'">'+I('subir')+(doc?'Reemplazar':'Subir')+'</button>';
        ac+='<button type="button" class="btn chico verde" data-act="marcar" data-paso="'+esc(p.id)+'"'+(p.requiere_documento&&!doc?' disabled title="Sube primero el documento"':'')+'>Hecho</button>';
        if(t.etapa==='EN_EJECUCION'&&!p.es_entrega&&(yo.es_master||!p.obligatorio))ac+='<button type="button" class="btn chico peligro" data-act="saltar" data-paso="'+esc(p.id)+'">Saltar</button>';
      }
      h+='<li class="'+(p.estado==='HECHO'?'hecho':p.estado==='SALTADO'?'saltado':'')+'"><span class="mk">'+(p.estado==='HECHO'?G.svg('check'):'')+'</span><div class="tx"><b>'+esc(p.nombre)+(p.es_entrega?' 📦':'')+'</b>'
        +'<small>'+(p.obligatorio?'Obligatorio':'Opcional')+' · plazo '+p.plazo_dias+' d'+(p.requiere_documento?' · documento: '+esc(p.tipo_documento):'')+(p.avisa_cliente?' · avisa al cliente (en cola)':'')+(p.estado==='SALTADO'?' · saltado: '+esc(p.saltado_motivo):'')+'</small>'
        +(doc?'<small>📎 <button type="button" class="link" data-act="ver-doc" data-ruta="'+esc(doc.storage_path)+'">'+esc(doc.nombre)+'</button></small>':'')+'</div><div class="ac">'+ac+'</div></li>';
    });
    h+='</ul></section>';
  }
  // Documentos
  var otros=f.docs.filter(function(d){return d.tipo!=='PASO';});
  h+='<section><h4>📎 Documentos</h4>';
  if(!f.docs.length)h+='<p class="t3">Sin documentos.</p>';
  h+=otros.map(function(d){return '<div class="te-doc">'+I('archivo','ic-mor')+'<span class="nm">'+esc(d.nombre)+'<br><small class="t3">'+(d.tipo==='ACEPTACION'?'Respaldo de aceptación':'Otro')+' · '+G.fHora(d.subido_at)+(d.vigente?'':' · reemplazado')+'</small></span><button type="button" class="btn chico sec" data-act="ver-doc" data-ruta="'+esc(d.storage_path)+'">Ver</button></div>';}).join('');
  if(ed&&!cerr)h+='<div class="acciones"><button type="button" class="btn chico sec" data-act="subir-otro">'+I('subir')+'Subir otro documento</button></div>';
  else if(!cerr)h+='<p class="nota">Pagos y Facturación ven los documentos; los sube el responsable o el Master.</p>';
  h+='</section>';
  if(f.tareas.length)h+='<section><h4>📋 Tareas abiertas</h4>'+f.tareas.map(function(x){return '<div class="aviso lila"><span>'+(x.tipo==='INICIAR'?'▶️ Iniciar el trabajo (el pago de inicio ya está confirmado)':'📦 Entregar (el pago final ya está confirmado)')+'</span></div>';}).join('')+'</section>';
  h+='<section><h4>🗂️ Bitácora</h4><ul class="gc-tl">'+f.eventos.map(function(e){return '<li><b>'+esc(EV[e.tipo]||e.tipo)+'</b><small>'+G.fHora(e.creado_at)+(e.actor==='cliente'?' · por el cliente':e.actor==='servicio'?' · sistema':'')+'</small></li>';}).join('')+'</ul></section>';
  return h;
}
function btn(act,txt,cls,ic){return '<button type="button" class="btn '+(cls||'')+'" data-act="'+act+'">'+(ic?I(ic):'')+esc(txt)+'</button>';}
function accionesHtml(f,ed,fac){
  var t=f.t,yo=S.yo,b='',nota='';
  if(t.cerrado_at)return '';
  switch(t.etapa){
    case 'BORRADOR':if(ed)b+=btn('enviar-aprob','Enviar a aprobación','', 'enviar');else nota='Borrador del responsable.';if(!t.servicio_id)nota='Falta que el Master cree el servicio solicitado en el catálogo (Planes y Servicios).';break;
    case 'EN_APROBACION':if(yo.es_master)b+=btn('aprobar','Aprobar','verde','check')+btn('devolver','Devolver con comentario','sec');else nota='Esperando la aprobación del Master.';break;
    case 'APROBADA':if(ed)b+=btn('enviar-cli','Enviar al cliente','','enviar')+btn('renovar','Volver a borrador','sec');nota='En modo prueba el aviso al cliente queda en cola (no se envía). Comparte la cotización por tu canal habitual y registra su respuesta.';break;
    case 'ENVIADA':if(ed){if(tbVencida(f))b+=btn('renovar','Renovar (vencida)','');else b+=btn('aceptacion','Registrar aceptación','verde','check');b+=btn('rechazo','Registrar rechazo','peligro');}else nota='Esperando la respuesta del cliente.';break;
    case 'ACEPTADA':
      if(fac&&(fac.estado==='PENDIENTE')&&yo.facturador)b+=btn('fac-preparar','Preparar factura','','factura');
      if(fac&&fac.estado==='LISTA'&&yo.es_master)b+=btn('fac-aprobar','Aprobar factura','verde','check')+btn('fac-devolver','Devolver factura','sec');
      if(yo.es_master&&f.cuotas.some(function(c){return c.es_inicio&&c.estado==='PENDIENTE';})&&!t.inicio_autorizado_motivo)b+=btn('autorizar','Autorizar inicio sin pago','sec');
      nota='La factura DTE 34 se emite antes de iniciar: Facturación prepara, el Master aprueba y la Edge emite (paquete aparte).';break;
    case 'FACTURADA':
      if(ed)b+=btn('iniciar','Iniciar trabajo','verde','check');
      if(yo.es_master&&!t.inicio_autorizado_motivo&&f.cuotas.some(function(c){return c.es_inicio&&c.estado==='PENDIENTE';}))b+=btn('autorizar','Autorizar inicio sin pago','sec');
      nota='Iniciar exige el pago de inicio confirmado por Cobranza (o la autorización del Master con motivo).'+(t.inicio_autorizado_motivo?' Autorizado: «'+t.inicio_autorizado_motivo+'».':'');break;
    case 'EN_EJECUCION':if(ed)b+=btn('terminar','Marcar terminado','verde','check');break;
    case 'TERMINADO':if(yo.es_master&&String(t.responsable_usuario_id)!==String(yo.usuario_id))b+=btn('cerrar','Cerrar trabajo','verde','check');nota='Entrega: '+({PENDIENTE:'pendiente',RETENIDA:'retenida hasta el pago final',ENTREGADO:'entregado'}[t.entrega_estado]||t.entrega_estado)+'. El cierre lo hace el Master revisado con el analista.';break;
  }
  if(yo.es_master)b+=btn('cerrar-sin','Cerrar sin completar','peligro');
  return (b?'<div class="acciones">'+b+'</div>':'')+(nota?'<p class="nota">'+esc(nota)+'</p>':'');
}
function tbVencida(f){return f.t.etapa==='ENVIADA'&&f.t.vigencia_hasta&&f.t.vigencia_hasta<S.hoy;}

/* ── Acciones ── */
function ejecutar(fn,args,msg){
  return D.rpc(fn,args).then(function(r){var id=FICHA&&FICHA.t.id;recargar(typeof msg==='function'?msg(r):msg,id);return true;}).catch(function(e){throw new Error(mErr(e));});
}
function confirmar(titulo,texto,fn,args,msg,okClase){G.modal({titulo:titulo,html:'<p>'+texto+'</p>',okClase:okClase,alAceptar:function(){return ejecutar(fn,args,msg);}});}
function conMotivo(titulo,texto,minimo,fn,armar,msg,okClase){
  G.modal({titulo:titulo,okClase:okClase,html:'<p>'+texto+'</p><label class="campo"><span>Motivo'+(minimo?' (mínimo '+minimo+' caracteres)':'')+'</span><textarea id="teMot" maxlength="1000"></textarea></label>',
    alAceptar:function(m){var v=m.querySelector('#teMot').value.trim();if(v.length<minimo)throw new Error('Escribe al menos '+minimo+' caracteres.');return ejecutar(fn,armar(v),msg);}});
}
function nombreArchivo(n){
  var b=String(n||'archivo').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^A-Za-z0-9._-]+/g,'-').replace(/\.{2,}/g,'.').replace(/^[._-]+/,'');
  b=b||'archivo';var ext=(b.match(/\.[A-Za-z0-9]{1,6}$/)||[''])[0];return Date.now()+'-'+b.slice(0,150-ext.length)+(b.length>150-ext.length?ext:'');
}
function sha256(file){return file.arrayBuffer().then(function(buf){return crypto.subtle.digest('SHA-256',buf);}).then(function(h){return Array.prototype.map.call(new Uint8Array(h),function(x){return ('0'+x.toString(16)).slice(-2);}).join('');});}
function validarArchivo(file){
  if(!file)throw new Error('Elige un archivo.');
  if(MIMES.indexOf(file.type)<0)throw new Error('Tipo no permitido: PDF, PNG, JPG, WEBP, DOCX o XLSX.');
  if(file.size<1||file.size>20971520)throw new Error('El archivo debe pesar menos de 20 MB.');
}
/* Sube al bucket y registra el documento. tipo: PASO | ACEPTACION | OTRO */
function subirYRegistrar(t,tipo,pasoId,file){
  validarArchivo(file);
  var carpeta=tipo==='PASO'?'paso-'+pasoId:tipo==='ACEPTACION'?'aceptacion':'otros', ruta=t.id+'/'+carpeta+'/'+nombreArchivo(file.name);
  return sha256(file).then(function(h){return D.subir(ruta,file).then(function(){
    return D.rpc('te_documento_registrar',{p_trabajo:Number(t.id),p_paso:pasoId?Number(pasoId):null,p_tipo:tipo,p_storage_path:ruta,p_nombre:String(file.name).slice(0,200),p_mime:file.type,p_bytes:file.size,p_sha256:h,p_visible_cliente:false});
  });});
}
var campoArchivo='<label class="campo"><span>Archivo (PDF, imagen, DOCX o XLSX · máx. 20 MB)</span><input type="file" id="teArch" accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx"></label>';

function accion(a,el){
  var f=FICHA, t=f&&f.t;
  if(a==='enviar-aprob')confirmar('Enviar a aprobación','El Master revisará la cotización '+esc(t.codigo)+'. El valor sale del catálogo o lo fija el Master.','te_cotizacion_enviar_aprobacion',{p_trabajo:Number(t.id)},'Cotización enviada a aprobación.');
  else if(a==='aprobar')abrirAprobar(f);
  else if(a==='devolver')conMotivo('Devolver al responsable','La cotización vuelve a borrador con tu comentario.',3,'te_cotizacion_devolver',function(v){return {p_trabajo:Number(t.id),p_comentario:v};},'Cotización devuelta.','peligro');
  else if(a==='enviar-cli')confirmar('Enviar al cliente','Se fija la vigencia y el aviso queda en cola. <b>En modo prueba no se envía nada al cliente.</b>','te_cotizacion_enviar',{p_trabajo:Number(t.id)},function(r){return 'Cotización marcada como enviada · vigente hasta el '+G.fFecha(r&&r.vigencia_hasta)+'.';});
  else if(a==='renovar')confirmar('Volver a borrador','La cotización vuelve a borrador y deberá pasar otra vez por el Master.','te_cotizacion_renovar',{p_trabajo:Number(t.id)},'Cotización de vuelta en borrador.');
  else if(a==='rechazo')conMotivo('Registrar rechazo del cliente','El trabajo queda como rechazado.',2,'te_cotizacion_registrar_rechazo',function(v){return {p_trabajo:Number(t.id),p_motivo:v};},'Rechazo registrado.','peligro');
  else if(a==='aceptacion')abrirAceptacion(t);
  else if(a==='fac-preparar')confirmar('Preparar factura','Se arma el borrador de la factura DTE 34 por '+clpT(t.valor)+' para que el Master la apruebe.','te_factura_preparar',{p_factura:Number(facVig(f).id)},'Factura preparada: espera la aprobación del Master.');
  else if(a==='fac-aprobar'){var fa=facVig(f);confirmar('Aprobar factura','Apruebas la factura DTE 34 por '+clpT(fa.total)+' (modo '+esc(fa.modo)+'). La emisión la hace Facturación con la Edge.','te_factura_aprobar',{p_factura:Number(fa.id),p_huella:fa.snapshot_hash},'Factura aprobada.','verde');}
  else if(a==='fac-devolver')conMotivo('Devolver factura','Facturación la vuelve a preparar.',3,'te_factura_devolver',function(v){return {p_factura:Number(facVig(f).id),p_comentario:v};},'Factura devuelta.','peligro');
  else if(a==='autorizar')conMotivo('Autorizar inicio sin pago de inicio','Excepción del Master: queda una alerta «en ejecución sin pago de inicio».',10,'te_trabajo_autorizar_inicio',function(v){return {p_trabajo:Number(t.id),p_motivo:v};},'Inicio autorizado sin pago.');
  else if(a==='iniciar')confirmar('Iniciar trabajo','Se copia el checklist vigente del servicio (versión congelada) y el aviso de inicio queda en cola.','te_trabajo_iniciar',{p_trabajo:Number(t.id)},'Trabajo iniciado.','verde');
  else if(a==='terminar')confirmar('Marcar terminado','Exige los pasos obligatorios hechos. En 50/50, el 50 % final vence hoy y lo cobra Cobranza.','te_trabajo_terminar',{p_trabajo:Number(t.id)},function(r){return r&&r.entrega_retenida?'Terminado · entrega retenida hasta el pago final.':'Trabajo terminado.';},'verde');
  else if(a==='cerrar')abrirCerrar(t);
  else if(a==='cerrar-sin')abrirCerrarSin(t);
  else if(a==='marcar'){var p=f.pasos.find(function(x){return String(x.id)===el.getAttribute('data-paso');});confirmar('Marcar paso hecho','«'+esc(p.nombre)+'»'+(p.avisa_cliente?' · el aviso al cliente queda en cola.':''),'te_paso_marcar',{p_paso:Number(p.id)},'Paso marcado.','verde');}
  else if(a==='saltar'){var ps=el.getAttribute('data-paso');conMotivo('Saltar paso (Master)','El paso queda saltado con tu motivo en la bitácora.',10,'te_paso_saltar',function(v){return {p_paso:Number(ps),p_motivo:v};},'Paso saltado.','peligro');}
  else if(a==='subir-paso'){var pid=el.getAttribute('data-paso'),pp=f.pasos.find(function(x){return String(x.id)===pid;});
    G.modal({titulo:'Subir documento del paso',ok:'Subir',html:'<p>«'+esc(pp.nombre)+'» · '+esc(pp.tipo_documento||'')+'</p>'+campoArchivo+'<p class="nota">No se borra ni se sobrescribe: si ya había uno, queda como reemplazado.</p>',
      alAceptar:function(m){var file=m.querySelector('#teArch').files[0];validarArchivo(file);return subirYRegistrar(t,'PASO',pid,file).then(function(){recargar('Documento subido.',t.id);return true;}).catch(function(e){throw new Error(mErr(e));});}});}
  else if(a==='subir-otro')G.modal({titulo:'Subir otro documento',ok:'Subir',html:campoArchivo,alAceptar:function(m){var file=m.querySelector('#teArch').files[0];validarArchivo(file);return subirYRegistrar(t,'OTRO',null,file).then(function(){recargar('Documento subido.',t.id);return true;}).catch(function(e){throw new Error(mErr(e));});}});
  else if(a==='ver-doc'){var ruta=el.getAttribute('data-ruta');var w=window.open('about:blank','_blank');D.urlFirmada(ruta).then(function(u){if(w){w.opener=null;w.location.href=u;}else location.href=u;}).catch(function(e){if(w)w.close();G.toast(mErr(e),true);});}
}
function facVig(f){return f.facturas.find(function(x){return x.estado!=='ANULADA';});}

function abrirAprobar(f){
  var t=f.t, srv=null;
  D.servicios().then(function(l){srv=(l||[]).find(function(s){return s.id===t.servicio_id;});}).catch(function(){}).then(function(){
    if(!srv){G.toast('El servicio de esta cotización no está activo en el catálogo (Planes y Servicios). Actívalo o devuelve la cotización.',true);return;}
    var fijo=srv&&srv.tipo==='puntual'&&(!srv.precio_hasta||Number(srv.precio_hasta)===Number(srv.precio)), rango=srv&&srv.tipo==='puntual'&&srv.precio_hasta&&Number(srv.precio_hasta)>Number(srv.precio);
    var html='<p><b>'+esc(t.codigo)+'</b> · '+esc(srv?srv.nombre:'Servicio')+' · '+esc(COND[t.condicion_pago])+(t.condicion_pago==='CUOTAS'?' '+t.n_cuotas:'')+'</p>'
      +(fijo?'<div class="cl"><span>Precio fijo del catálogo</span><b>'+clpT(srv.precio)+'</b></div>':'<label class="campo"><span>Valor ($, exento)'+(rango?' entre '+clpT(srv.precio)+' y '+clpT(srv.precio_hasta):' · servicio por propuesta')+'</span><input type="number" id="teVal" step="1"'+(rango?' min="'+esc(srv.precio)+'" max="'+esc(srv.precio_hasta)+'"':' min="1"')+'></label>')
      +'<label class="campo"><span>Descuento % (opcional, solo el Master)</span><input type="number" id="teDesc" min="0" max="99.99" step="0.01" placeholder="0"></label>'
      +'<p class="nota">Al aprobar se congela la cotización (snapshot con huella) y se calcula el plan de cuotas. Usa la huella de lo que estás viendo: si el responsable la cambió, se rechaza.</p>';
    G.modal({titulo:'Aprobar cotización',ok:'Aprobar',okClase:'verde',html:html,alAceptar:function(m){
      var v=fijo?null:Number(m.querySelector('#teVal').value), d=Number(m.querySelector('#teDesc').value)>0?Number(m.querySelector('#teDesc').value):null;
      if(!fijo&&!(v>0&&Math.floor(v)===v))throw new Error('Fija un valor entero mayor que 0.');
      if(rango&&(v<Number(srv.precio)||v>Number(srv.precio_hasta)))throw new Error('El valor debe estar dentro del rango del catálogo.');
      if(d!=null&&!(d>0&&d<100))throw new Error('El descuento va entre 0 y 100 %.');
      return ejecutar('te_cotizacion_aprobar',{p_trabajo:Number(t.id),p_huella:t.huella_revision,p_valor:v,p_descuento_pct:d},function(r){return 'Cotización aprobada por '+clpT(r&&r.valor)+'.';});
    }});
  });
}
function abrirAceptacion(t){
  G.modal({titulo:'Registrar aceptación del cliente',ok:'Registrar aceptación',okClase:'verde',
    html:'<label class="campo"><span>¿Cómo aceptó?</span><select id="teMedio"><option value="CORREO">Correo</option><option value="WHATSAPP">WhatsApp</option><option value="PRESENCIAL">Presencial</option></select></label>'
      +campoArchivo.replace('Archivo','Respaldo de la aceptación')+'<p class="nota">Se crea el plan de cuotas y la instrucción de facturación (DTE 34).</p>',
    alAceptar:function(m){var file=m.querySelector('#teArch').files[0],medio=m.querySelector('#teMedio').value;validarArchivo(file);
      return subirYRegistrar(t,'ACEPTACION',null,file).then(function(r){return D.rpc('te_cotizacion_registrar_aceptacion',{p_trabajo:Number(t.id),p_medio:medio,p_documento_id:Number(r.documento_id)});})
        .then(function(){recargar('Aceptación registrada: plan de cuotas e instrucción de facturación creados.',t.id);return true;}).catch(function(e){throw new Error(mErr(e));});}});
}
function abrirCerrar(t){
  var NOM={TERMINAR:'Terminar el trabajo',FACTURAR:'Factura emitida',COBRAR:'Todas las cuotas pagadas',ENTREGAR:'Entrega hecha',RESOLVER_BONIFICACION:'Bonificación liquidada'};
  D.rpc('te_trabajo_faltantes_cierre',{p_trabajo:Number(t.id)}).then(function(falt){
    falt=falt||[];
    G.modal({titulo:'Cerrar trabajo',ok:'Cerrar',okClase:'verde',
      html:(falt.length?'<div class="aviso ambar"><span>Falta: '+falt.map(function(x){return esc(NOM[x]||x);}).join(' · ')+'</span></div>':'<div class="aviso verde"><span>Cumple todo para cerrar.</span></div>')
        +'<label class="chk"><input type="checkbox" id="teRev"> Revisado con el analista responsable</label><p class="nota">El responsable no cierra su propio trabajo. Cerrado, pasa al Historial en solo lectura.</p>',
      alAceptar:function(m){if(falt.length)throw new Error('Aún faltan requisitos.');if(!m.querySelector('#teRev').checked)throw new Error('Marca «Revisado con el analista».');
        return D.rpc('te_trabajo_cerrar',{p_trabajo:Number(t.id),p_revisado_con_analista:true}).then(function(){G.cerrarDet();recargar('Trabajo cerrado.');return true;}).catch(function(e){throw new Error(mErr(e));});}});
  }).catch(function(e){G.toast(mErr(e),true);});
}
function abrirCerrarSin(t){
  G.modal({titulo:'Cerrar sin completar',ok:'Cerrar sin completar',okClase:'peligro',
    html:'<label class="campo"><span>Motivo</span><select id="teCM"><option value="COTIZACION_RECHAZADA">Cotización rechazada</option><option value="COTIZACION_VENCIDA">Cotización vencida</option><option value="TRABAJO_CANCELADO">Trabajo cancelado</option><option value="OTRO">Otro</option></select></label>'
      +'<label class="campo"><span>Detalle (mínimo 10 caracteres)</span><textarea id="teCD" maxlength="1000"></textarea></label><p class="nota">Se anulan las cuotas pendientes (Cobranza deja de verlas). Si la factura ya estaba emitida, queda la alerta «requiere nota de crédito».</p>',
    alAceptar:function(m){var d=m.querySelector('#teCD').value.trim();if(d.length<10)throw new Error('Escribe un detalle de al menos 10 caracteres.');
      return D.rpc('te_trabajo_cerrar_sin_completar',{p_trabajo:Number(t.id),p_motivo:m.querySelector('#teCM').value,p_detalle:d}).then(function(){G.cerrarDet();recargar('Trabajo cerrado sin completar.');return true;}).catch(function(e){throw new Error(mErr(e));});}});
}

/* ── Nueva cotización (responsable con módulo o Master) ── */
function abrirNueva(){
  Promise.all([D.servicios().catch(function(){return [];}),D.clientes()]).then(function(r){
    var srv=r[0]||[], cli=r[1]||[];
    var html='<div class="gc-seg" role="radiogroup" aria-label="Para quién" style="margin-bottom:6px"><button type="button" class="fb on" data-para="cli" role="radio" aria-checked="true">Cliente de la cartera</button><button type="button" class="fb" data-para="pros" role="radio" aria-checked="false">Prospecto</button></div>'
      +'<div id="teParaCli"><label class="campo"><span>Cliente</span><select id="teCli"><option value="">Elige…</option>'+cli.map(function(c){return '<option value="'+esc(c.id)+'">'+esc(c.razon_social)+'</option>';}).join('')+'</select></label>'
      +(cli.length?'':'<p class="nota">No ves clientes con tu permiso: usa «Prospecto» o pide al Master que lo cree.</p>')+'</div>'
      +'<div id="teParaPros" hidden><label class="campo"><span>Nombre del prospecto o empresa por constituir</span><input type="text" id="tePN" maxlength="200"></label><div class="campos2"><label class="campo"><span>Correo</span><input type="email" id="tePE" maxlength="200"></label><label class="campo"><span>Teléfono</span><input type="tel" id="tePT" maxlength="40"></label></div></div>'
      +'<label class="campo"><span>Servicio del catálogo</span><select id="teSrv"><option value="">Elige…</option>'+srv.map(function(s){return '<option value="'+esc(s.id)+'">'+esc(s.nombre)+' · '+(s.tipo==='por_propuesta'?'por propuesta':s.precio_hasta&&Number(s.precio_hasta)>Number(s.precio)?clpT(s.precio)+' a '+clpT(s.precio_hasta):clpT(s.precio))+'</option>';}).join('')+'<option value="__nuevo">➕ No está en el catálogo (solicitar al Master)</option></select></label>'
      +'<div id="teSrvInfo" class="nota">El valor sale del catálogo (solo lectura) o lo fija el Master al aprobar.</div>'
      +'<label class="campo" id="teSolW" hidden><span>Describe el servicio nuevo (mínimo 5 caracteres)</span><textarea id="teSol" maxlength="500"></textarea></label>'
      +'<div class="campos2"><label class="campo"><span>Condición de pago</span><select id="teCond"><option value="CONTADO">Contado</option><option value="CINCUENTA">50/50 (inicio y al terminar)</option><option value="CUOTAS">Cuotas</option></select></label>'
      +'<label class="campo" id="teNW" hidden><span>N.º de cuotas (2 a 12)</span><input type="number" id="teN" min="2" max="12" step="1" value="3"></label></div>'
      +'<label class="campo"><span>Qué se hará</span><textarea id="teQue" maxlength="1000"></textarea></label><label class="campo"><span>Alcance</span><textarea id="teAlc" maxlength="1000"></textarea></label>'
      +'<label class="campo"><span>Antecedentes (opcional)</span><textarea id="teAnt" maxlength="2000"></textarea></label>';
    var para='cli';
    G.modal({titulo:'➕ Nueva cotización',ok:'Crear borrador',html:html,alAbrir:function(m){
      m.querySelectorAll('[data-para]').forEach(function(b){b.addEventListener('click',function(){para=b.getAttribute('data-para');m.querySelectorAll('[data-para]').forEach(function(x){var on=x===b;x.classList.toggle('on',on);x.setAttribute('aria-checked',on);});
        m.querySelector('#teParaCli').hidden=para!=='cli';m.querySelector('#teParaPros').hidden=para!=='pros';});});
      m.querySelector('#teSrv').addEventListener('change',function(e){var v=e.target.value,s=srv.find(function(x){return x.id===v;});m.querySelector('#teSolW').hidden=v!=='__nuevo';
        m.querySelector('#teSrvInfo').textContent=s?(s.descripcion||'')+' · '+(s.tipo==='por_propuesta'?'El Master fija el valor al aprobar.':'Valor del catálogo: '+clpT(s.precio)+(s.precio_hasta&&Number(s.precio_hasta)>Number(s.precio)?' a '+clpT(s.precio_hasta)+' (el Master fija el valor dentro del rango)':'')):'El Master creará el servicio en el catálogo antes de enviar a aprobación.';});
      m.querySelector('#teCond').addEventListener('change',function(e){m.querySelector('#teNW').hidden=e.target.value!=='CUOTAS';});
    },alAceptar:function(m){
      var p={},v=function(id){return m.querySelector(id).value.trim();};
      if(para==='cli'){if(!v('#teCli'))throw new Error('Elige el cliente.');p.cliente_id=Number(v('#teCli'));}
      else{if(v('#tePN').length<3)throw new Error('Escribe el nombre del prospecto (mínimo 3 caracteres).');var em=v('#tePE');if(em&&!/^[^@\s,;]+@[^@\s,;]+\.[^@\s,;]+$/.test(em))throw new Error('El correo no es válido.');
        p.prospecto={nombre:v('#tePN')};if(em)p.prospecto.email=em;if(v('#tePT'))p.prospecto.telefono=v('#tePT');}
      var s=v('#teSrv');if(!s)throw new Error('Elige el servicio.');
      if(s==='__nuevo'){if(v('#teSol').length<5)throw new Error('Describe el servicio nuevo (mínimo 5 caracteres).');p.servicio_solicitado=v('#teSol');}else p.servicio_id=s;
      p.condicion_pago=v('#teCond');if(p.condicion_pago==='CUOTAS'){var n=Number(v('#teN'));if(!(n>=2&&n<=12&&Math.floor(n)===n))throw new Error('Las cuotas van de 2 a 12.');p.n_cuotas=n;}
      if(v('#teQue').length<3||v('#teAlc').length<3)throw new Error('Completa qué se hará y el alcance.');
      p.que=v('#teQue');p.alcance=v('#teAlc');if(v('#teAnt'))p.antecedentes=v('#teAnt');
      return D.rpc('te_cotizacion_crear',{p:p}).then(function(r){recargar('Borrador '+(r&&r.codigo||'')+' creado.',r&&r.trabajo_id);return true;}).catch(function(e){throw new Error(mErr(e));});
    }});
  });
}

/* ── Eventos ── */
function pintar(root){(root||document).querySelectorAll('[data-gc-ic]').forEach(function(el){el.innerHTML=G.svg(el.getAttribute('data-gc-ic'));el.removeAttribute('data-gc-ic');});}
document.addEventListener('click',function(ev){
  var b=ev.target.closest('[data-act]');if(!b||b.disabled)return;var a=b.getAttribute('data-act');
  if(a==='vista'){S.vista=b.getAttribute('data-v');render();}
  else if(a==='ficha')abrirFicha(b.getAttribute('data-id'));
  else if(a==='nueva')abrirNueva();
  else if(a==='recargar'){S.err=null;cargar();}
  else if(FICHA)accion(a,b);
});
document.addEventListener('keydown',function(ev){if((ev.key==='Enter'||ev.key===' ')&&ev.target.tagName==='TR'&&ev.target.getAttribute('data-act')==='ficha'){ev.preventDefault();abrirFicha(ev.target.getAttribute('data-id'));}});
document.addEventListener('input',function(ev){if(ev.target.id==='teBuscar'){S.buscar=ev.target.value.trim();var pos=ev.target.selectionStart;render();var i=$('teBuscar');if(i){i.focus();try{i.setSelectionRange(pos,pos);}catch(e){}}}});
document.addEventListener('change',function(ev){if(ev.target.id==='teMios'){S.soloMios=ev.target.checked;render();}});

function iniciar(){
  pintar();
  $('gcDetCerrar').addEventListener('click',G.cerrarDet);$('gcVelo').addEventListener('click',G.cerrarDet);
  if(DEMO){$('gcDemo').hidden=false;document.documentElement.classList.remove('auth-pending');if(window.TE_DEMO_UI)window.TE_DEMO_UI(function(){G.cerrarDet();cargar();});}
  cargar();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',iniciar);else iniciar();
})();
