/* ============================================================
   cotizaciones/cot.js — Cotizaciones K1 (Comercial → Cotizaciones)
   COTIZACIÓN = la propuesta ANTES de que el cliente acepte (plan mensual o trabajo especial).
   TRABAJO ESPECIAL = la EJECUCIÓN del trabajo ya aceptado (Gestión interna → Trabajos especiales). Una cotización de trabajo
   especial ACEPTADA origina su trabajo especial ("Ver trabajo especial TE-…"); una de plan deja al cliente listo para onboarding.
   Conectada SOLO a las RPC de la migración 202610271500_cotizaciones_k1 (+ bucket 'cotizaciones' de 1510). Cada RPC valida el rol en
   el servidor; la pantalla nunca decide precios ni aprobaciones: solo muestra lo que el servidor calcula.
     cot_yo · cot_catalogo · cot_buscar_destino · cot_bandeja · cot_ficha · cot_guardar · cot_solicitar · cot_aprobar · cot_devolver ·
     cot_marcar_enviada · cot_respaldo_registrar · cot_aceptar · cot_rechazar · cot_anular · cot_volver_a_cotizar · cot_onboarding_datos
   K1 NO envía correos al cliente (eso es K2): se descarga/imprime el PDF, se envía por el canal habitual y se marca "Enviada".
   Modo demostración: cot-demo.js (solo ?demo=1 en localhost).
   ============================================================ */
(function(){
'use strict';
var G=window.GC, esc=G.esc, clp=G.clp, clpT=G.clpT, I=G.I, $=G.$;
var DEMO=window.GC_DEMO===true&&G.LOCAL&&!!window.COT_DEMO_API;
var BUCKET='cotizaciones';
var MIMES=['application/pdf','image/png','image/jpeg','image/webp'];

var ERR={
  SIN_SESION:'No hay una sesión activa.',SIN_PERMISO:'Cotizaciones es para el Master, el encargado Comercial y quien cotiza trabajos especiales.',
  SIN_PERMISO_TIPO:'Tu usuario no puede cotizar este tipo (los planes los cotiza Comercial o el Master).',SOLO_MASTER:'Solo el Master puede hacer esta acción.',
  NO_EXISTE:'La cotización no existe o no es tuya.',CAMPO_NO_PERMITIDO:'Hay un campo no permitido.',DATOS_INVALIDOS:'Datos inválidos.',TIPO_INVALIDO:'Elige plan o trabajo especial.',
  DESTINO_INVALIDO:'Indica a quién se cotiza (cliente, prospecto de Comercial o prospecto nuevo).',PROSPECTO_INVALIDO:'Revisa los datos del prospecto.',RUT_INVALIDO:'El RUT no es válido.',
  CLIENTE_NO_EXISTE:'El cliente no existe.',PROSPECTO_NO_EXISTE:'El prospecto no existe o no es tuyo.',BITACORA_NO_CORRESPONDE:'La bitácora no es de ese prospecto.',
  CATALOGO_OBLIGATORIO:'Elige un plan o servicio del catálogo (si no existe, el Master lo crea en Planes y Servicios).',PLAN_NO_EXISTE:'El plan no existe.',PLAN_INACTIVO:'El plan está inactivo.',
  MONTO_CERO:'Este plan se cobra por trabajador: indica cuántos trabajadores tiene.',SERVICIO_NO_EXISTE:'El servicio no existe.',SERVICIO_INACTIVO:'El servicio está inactivo.',
  SERVICIO_NO_CLP:'Este servicio está en UF: aún no se puede cotizar como trabajo especial (los trabajos especiales van en pesos).',SERVICIO_NO_PUNTUAL:'El servicio no es puntual.',
  SERVICIO_SIN_PRECIO:'El servicio no tiene precio válido en el catálogo.',VALOR_FUERA_DE_RANGO:'El valor está fuera del rango del catálogo.',MONTO_INVALIDO:'El valor no es válido.',
  DESCUENTO_INVALIDO:'El descuento va entre 0 y 100 % (2 decimales).',MOTIVO_OBLIGATORIO:'Explica el motivo (lo revisa el Master).',TEXTO_CON_CREDENCIAL:'No escribas claves ni contraseñas en la cotización.',
  TEXTO_NO_PERMITIDO:'Usa «nuestros servicios» en vez de «honorarios».',SOLUCIONES_INVALIDAS:'Cada solución lleva la frase del cliente y lo que logra (3 a 300 letras).',
  SOLUCIONES_OBLIGATORIAS:'Agrega al menos una solución (frase del cliente → lo que logra).',DETALLE_INCOMPLETO:'Falta qué se hará y el alcance del trabajo.',
  VALOR_OBLIGATORIO:'Falta el valor (servicio por propuesta o con rango, o plan por propuesta).',NO_EDITABLE:'Solo se edita en borrador.',NO_EN_BORRADOR:'La cotización ya no está en borrador.',
  NO_POR_APROBAR:'La cotización no está esperando aprobación.',HUELLA_NO_COINCIDE:'La cotización cambió desde que la abriste. Recarga y revísala de nuevo.',
  COMENTARIO_OBLIGATORIO:'Escribe un comentario.',NO_APROBADA:'Solo se envía una cotización aprobada.',MEDIO_INVALIDO:'Elige el medio.',NO_ENVIADA:'La cotización no está enviada y vigente.',
  COTIZACION_VENCIDA:'La cotización venció: vuelve a cotizar (versión nueva).',YA_ACEPTADA:'La cotización ya fue aceptada.',RESPALDO_OBLIGATORIO:'Adjunta el correo o pantallazo de la aceptación.',
  RUTA_INVALIDA:'La ruta del archivo no es válida.',ARCHIVO_NO_ENCONTRADO:'El archivo no quedó guardado. Vuelve a subirlo.',ARCHIVO_NO_COINCIDE:'El archivo subido no coincide (tamaño o tipo).',
  STORAGE_NO_DISPONIBLE:'El almacenamiento no está disponible.',DATOS_FACTURACION_INVALIDOS:'Revisa los datos de facturación.',EMAIL_INVALIDO:'El correo no es válido.',
  NO_ANULABLE:'Esta cotización ya no se puede anular.',NO_RECOTIZABLE:'Solo se vuelve a cotizar una vencida, rechazada o anulada.',YA_RECOTIZADA:'Ya existe la versión siguiente.',
  RESPONSABLE_INVALIDO:'Esa persona no puede cotizar este tipo.',NO_APLICA:'No aplica.',YA_ES_CLIENTE:'La cotización ya es de un cliente de la cartera.',
  TIPO_DTE_NO_PERMITIDO:'Hoy solo se permite la factura exenta (DTE 34).',COT_APROBADA_INMUTABLE:'La cotización aprobada no cambia: vuelve a cotizar.'
};
function mErr(e){return G.msgError(e,ERR);}

/* ── Datos ── */
var A=G.API;
var REAL={
  yo:function(){return A.rpc('cot_yo');},
  bandeja:function(f){return A.rpc('cot_bandeja',{p_filtros:f||{}});},
  ficha:function(id){return A.rpc('cot_ficha',{p_id:Number(id)});},
  catalogo:function(){return A.rpc('cot_catalogo');},
  buscar:function(t){return A.rpc('cot_buscar_destino',{p_texto:t});},
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
var D=DEMO?window.COT_DEMO_API:REAL;

/* ── Catálogos de texto ── */
var EST={BORRADOR:['Borrador','gris','sem-gris'],PENDIENTE_APROBACION:['Por aprobar','cel','sem-cel'],APROBADA:['Lista para enviar','lila','sem-lila'],ENVIADA:['Enviada','ambar','sem-ambar'],
  ACEPTADA:['Aceptada','verde','sem-verde'],RECHAZADA:['No por ahora','rojo','sem-rojo'],VENCIDA:['Vencida','rojo','sem-rojo'],ANULADA:['Anulada','gris','sem-gris']};
var FLUJO=[['BORRADOR','Borrador','Se arma con el catálogo'],['PENDIENTE_APROBACION','Aprobación','Solo si cambia algo'],['APROBADA','Lista','PDF listo para enviar'],
  ['ENVIADA','Enviada','Vence en 15 días'],['ACEPTADA','Aceptada','Respaldo + aviso']];
var REGLA={MASTER_AUTOR:'Autoaprobada por el Master (con registro)',CATALOGO_SIN_CAMBIOS:'Catálogo sin cambios: no requiere aprobación',APROBADA_POR_MASTER:'Aprobada por el Master'};
var MOTIVO={PRECIO_DISTINTO:'Precio distinto al catálogo',DESCUENTO:'Descuento',PLAN_POR_PROPUESTA:'Plan por propuesta (Estratégico)',SERVICIO_POR_PROPUESTA:'Servicio por propuesta',
  SERVICIO_CON_RANGO:'Servicio con rango',CUOTAS_FUERA_ESTANDAR:'Más de 3 cuotas'};
var COND={CONTADO:'Contado',CINCUENTA:'50/50 (inicio y al terminar)',CUOTAS:'Cuotas'};
var MEDIO={CORREO:'Correo',WHATSAPP:'WhatsApp',PRESENCIAL:'Presencial'};
var EV={CREADA:'Borrador creado',EDITADA:'Borrador editado',ENVIADA_A_APROBACION:'Enviada a aprobación del Master',AUTOAPROBADA_MASTER:'Autoaprobada por el Master',APROBADA_CATALOGO:'Lista (catálogo sin cambios)',
  APROBADA_POR_MASTER:'Aprobada por el Master',DEVUELTA:'Devuelta por el Master',ENVIADA:'Marcada como enviada al cliente',RESPALDO_SUBIDO:'Respaldo de aceptación subido',ACEPTADA:'Aceptada por el cliente',
  RECHAZADA:'El cliente respondió «No por ahora»',VENCIDA:'Venció sin respuesta',ANULADA:'Anulada',NUEVA_VERSION:'Versión nueva (volver a cotizar)',RECOTIZADA:'Se volvió a cotizar'};

var S={yo:null,filas:[],tab:'TODAS',estado:'',resp:'',buscar:'',hoy:G.hoyCL(),cat:null};
function uf(n){return G.esNum(n)?Number(n).toLocaleString('es-CL',{minimumFractionDigits:2,maximumFractionDigits:2})+' UF':'<span class="nd">Por definir</span>';}
function monto(m,moneda,per){if(!G.esNum(m))return '<span class="nd">Por definir</span>';return moneda==='UF'?uf(m)+(per==='MENSUAL'?'<span class="t3" style="font-size:.8em">/mes</span>':''):clp(m);}
function montoT(m,moneda,per){if(!G.esNum(m))return 'por definir';return moneda==='UF'?Number(m).toLocaleString('es-CL',{minimumFractionDigits:2,maximumFractionDigits:2})+' UF'+(per==='MENSUAL'?' al mes':''):clpT(m);}
function chip(e){var x=EST[e]||[e,'gris'];return '<span class="estado '+x[1]+'">'+esc(x[0])+'</span>';}
function av(nombre){return window.gAvatarEquipo?window.gAvatarEquipo(nombre):'';}

/* ── Carga ── */
function cargar(){
  return D.yo().then(function(yo){S.yo=yo;if(!yo.acceso){render();return;}
    return D.bandeja({}).then(function(b){S.filas=b.filas||[];S.hoy=b.hoy||S.hoy;render();abrirDesdeEnlace();});
  }).catch(function(e){S.err=mErr(e);render();});
}
var ENLACE_USADO=false;
function abrirDesdeEnlace(){
  if(ENLACE_USADO)return;ENLACE_USADO=true;
  var qs=location.search.slice(1),m=/(?:^|&)id=(\d{1,18})(?:&|$)/.exec(qs);if(m){abrirFicha(m[1]);return;}
  var n=/(?:^|&)nueva=(plan|te)(?:&|$)/.exec(qs);if(n)abrirEditor(null,n[1]==='te'?'TE':'PLAN');
}
function recargar(msg,abrirId){return D.bandeja({}).then(function(b){S.filas=b.filas||[];render();if(msg)G.toast(msg);if(abrirId)abrirFicha(abrirId);}).catch(function(e){G.toast(mErr(e),true);});}

function difHtml(){
  return '<section class="cot-dif" aria-label="Cotización y trabajo especial">'
    +'<div class="esta">'+I('lista','ic-mor')+'<div><b class="t">📄 Cotización (estás aquí)</b><p>La <b>propuesta</b> antes de que el cliente acepte: un <b>plan mensual</b> (Cumplimiento, PRO, Estratégico, Remuneraciones) o un <b>trabajo especial</b> (constitución, modificación, regularización…).</p></div></div>'
    +'<div>'+I('maletin','ic-cel')+'<div><b class="t">🛠️ Trabajo especial</b><p>La <b>ejecución</b> del trabajo puntual <b>ya aceptado</b>: etapas, checklist, factura adicional y cuotas. Nace solo cuando el cliente acepta su cotización. <a class="link" href="../trabajos-especiales/index.html">Ir a Trabajos especiales →</a></p></div></div>'
    +'</section>';
}
function render(){
  var app=$('gcApp');
  if(S.err){app.innerHTML='<div class="aviso rojo">'+I('alerta','ic-roj')+'<span>No se pudo cargar: '+esc(S.err)+'</span><button type="button" class="btn chico sec" data-act="recargar">Reintentar</button></div>';return;}
  if(!S.yo)return;
  if(!S.yo.acceso){app.innerHTML=difHtml()+'<div class="aviso ambar">'+I('candado','ic-amb')+'<span>Tu usuario no cotiza. Cotizan el Master, el encargado Comercial y quien tiene Trabajos especiales.</span></div>';return;}
  var h=difHtml()
    +'<div class="gc-prueba" role="note">'+I('escudo','ic-cel')+'<div><b>Etapa K1:</b> el cliente aún no recibe correos desde aquí. Descarga el PDF, envíalo por tu canal habitual (correo o WhatsApp), marca <b>«Enviada»</b> y, cuando acepte, registra la aceptación con el respaldo. La página pública de aceptación llega en K2.</div></div>'
    +heroHtml()+barraHtml()+tablaHtml(S.filas.filter(filtra));
  app.innerHTML=h;
}
function filtra(x){
  if(S.tab==='PLAN'&&x.tipo!=='PLAN')return false;if(S.tab==='TE'&&x.tipo!=='TE')return false;
  if(S.estado&&x.estado!==S.estado)return false;
  if(S.resp==='yo'&&!(x.responsable&&String(x.responsable.id)===String(S.yo.usuario_id)))return false;
  if(S.resp&&S.resp!=='yo'&&!(x.responsable&&String(x.responsable.id)===S.resp))return false;
  if(S.buscar){var b=S.buscar.toLowerCase();if((x.para||'').toLowerCase().indexOf(b)<0&&(x.codigo||'').toLowerCase().indexOf(b)<0&&(x.que||'').toLowerCase().indexOf(b)<0)return false;}
  return true;
}
function heroHtml(){
  var f=S.filas;function c(fn){return f.filter(fn).length;}
  var porVencer=c(function(x){return x.estado==='ENVIADA'&&x.dias_para_vencer!=null&&x.dias_para_vencer<=2;});
  var acPlan=f.filter(function(x){return x.estado==='ACEPTADA'&&x.tipo==='PLAN';}).reduce(function(s,x){return s+Number(x.monto||0);},0);
  var acTe=f.filter(function(x){return x.estado==='ACEPTADA'&&x.tipo==='TE';}).reduce(function(s,x){return s+Number(x.monto||0);},0);
  return '<section class="card hero"><div class="gc-kicker">Comercial · propuesta → aprobación (si cambia algo) → envío → aceptación → facturación</div>'
    +'<h2 class="gc-titulo">Lo que hemos <span>cotizado</span></h2><p class="nota">💡 Si cotiza el Master, sale directo. Si cotiza otra persona y es catálogo sin cambios, también. Si cambia precio, descuento, Estratégico, un servicio por propuesta o con rango, o más de 3 cuotas, la aprueba el Master. Vigencia: 15 días.</p>'
    +'<div class="gc-kpis">'
    +'<div class="kpi acc-cel clic" data-act="filtro-estado" data-e="PENDIENTE_APROBACION"><small>🛡️ Por aprobar</small><b>'+c(function(x){return x.estado==='PENDIENTE_APROBACION';})+'</b><p>esperan al Master</p></div>'
    +'<div class="kpi acc-ambar clic" data-act="filtro-estado" data-e="ENVIADA"><small>📨 Enviadas sin respuesta</small><b>'+c(function(x){return x.estado==='ENVIADA';})+'</b><p>'+porVencer+' vence(n) en 2 días o menos</p></div>'
    +'<div class="kpi acc-verde clic" data-act="filtro-estado" data-e="ACEPTADA"><small>🎉 Aceptadas</small><b>'+c(function(x){return x.estado==='ACEPTADA';})+'</b><p>'+(acPlan?Number(acPlan).toLocaleString('es-CL',{maximumFractionDigits:2})+' UF/mes en planes':'sin planes')+(acTe?' · '+clpT(acTe)+' en trabajos':'')+'</p></div>'
    +'<div class="kpi acc-rojo clic" data-act="filtro-estado" data-e="VENCIDA"><small>🕓 Vencidas</small><b>'+c(function(x){return x.estado==='VENCIDA';})+'</b><p>se vuelven a cotizar (versión nueva)</p></div>'
    +'</div></section>';
}
function barraHtml(){
  var n={TODAS:S.filas.length,PLAN:S.filas.filter(function(x){return x.tipo==='PLAN';}).length,TE:S.filas.filter(function(x){return x.tipo==='TE';}).length};
  var resps={};S.filas.forEach(function(x){if(x.responsable)resps[x.responsable.id]=x.responsable.nombre;});
  var puede=S.yo.puede_plan||S.yo.puede_te;
  return '<div class="gc-nav" role="group" aria-label="Pestañas">'
    +[['TODAS','Todas','lista'],['PLAN','Planes','calendario'],['TE','Trabajos especiales','maletin']].map(function(t){
      return '<button type="button" class="sn'+(S.tab===t[0]?' on':'')+'" data-act="tab" data-t="'+t[0]+'" aria-pressed="'+(S.tab===t[0])+'">'+I(t[2])+esc(t[1])+' <span class="cnt">'+n[t[0]]+'</span></button>';}).join('')
    +'<select class="cot-sel" id="cotEstado" aria-label="Estado"><option value="">Todos los estados</option>'+Object.keys(EST).map(function(k){return '<option value="'+k+'"'+(S.estado===k?' selected':'')+'>'+esc(EST[k][0])+'</option>';}).join('')+'</select>'
    +(S.yo.master?'<select class="cot-sel" id="cotResp" aria-label="Responsable"><option value="">Todos los responsables</option><option value="yo"'+(S.resp==='yo'?' selected':'')+'>Las mías</option>'
      +Object.keys(resps).map(function(k){return '<option value="'+esc(k)+'"'+(S.resp===k?' selected':'')+'>'+esc(resps[k])+'</option>';}).join('')+'</select>':'')
    +'<input type="search" class="gc-buscar" id="cotBuscar" placeholder="Buscar cliente, código o servicio…" value="'+esc(S.buscar)+'" aria-label="Buscar">'
    +(puede?'<button type="button" class="btn" data-act="nueva" style="margin-left:auto">'+I('plus')+'Nueva cotización</button>':'')
    +'</div>';
}
function venceHtml(x){
  if(x.estado==='ENVIADA'&&x.vigencia_hasta){var d=x.dias_para_vencer;return '<span class="cot-vence'+(d<=2?' pronto':'')+'">'+G.fFecha(x.vigencia_hasta)+'</span><span class="sub">'+(d===0?'vence hoy':d===1?'vence mañana':'en '+d+' días')+'</span>';}
  if(x.estado==='VENCIDA')return '<span class="cot-vence vencida">'+G.fFecha(x.vigencia_hasta)+'</span><span class="sub">vencida</span>';
  return '<span class="t3">—</span>';
}
function semaforo(x){
  var c=x.estado==='VENCIDA'||(x.estado==='ENVIADA'&&x.dias_para_vencer<=2)?'sem-rojo':(EST[x.estado]||[0,0,'sem-gris'])[2];
  return '<span class="gc-semaforo '+c+'" aria-hidden="true"></span>';
}
function tarjeta(x){
  return '<button type="button" class="te-card'+(x.estado==='VENCIDA'?' alerta':x.estado==='PENDIENTE_APROBACION'?' aviso-a':'')+'" data-act="ficha" data-id="'+esc(x.id)+'">'
    +'<div class="c1"><span class="cod">'+esc(x.codigo)+(x.version>1?' · v'+x.version:'')+'</span>'+chip(x.estado)+'</div>'
    +'<span class="nom">'+esc(x.para)+(x.es_cliente?'':'<span class="tag-pros">prospecto</span>')+'</span>'
    +'<span class="srv">'+(x.tipo==='PLAN'?'📅 Plan · ':'🛠️ Trabajo especial · ')+esc(x.que||'')+'</span>'
    +'<div class="c3"><span>'+esc(x.responsable?x.responsable.nombre:'')+(x.estado==='ENVIADA'?' · vence '+G.fFecha(x.vigencia_hasta):'')+'</span><b>'+montoT(x.monto,x.moneda,x.periodicidad)+'</b></div></button>';
}
function tablaHtml(lista){
  if(!lista.length)return '<section class="card"><div class="gc-vacio" style="margin-top:16px">'+(S.filas.length?'No hay cotizaciones con esos filtros.':'Aún no hay cotizaciones. Crea la primera con «Nueva cotización».')+'</div></section>';
  var h='<section class="card"><div class="tabla-box gc-tabla-d" style="margin-top:12px"><table class="gt"><thead><tr><th></th><th>Código</th><th>Para</th><th>Qué se cotiza</th><th class="num">Valor</th><th>Estado</th><th>Vence</th><th>Responsable</th><th></th></tr></thead><tbody>';
  lista.forEach(function(x){
    h+='<tr class="clic" data-act="ficha" data-id="'+esc(x.id)+'" tabindex="0"><td>'+semaforo(x)+'</td><td><b class="lila">'+esc(x.codigo)+'</b>'+(x.version>1?'<span class="sub">versión '+x.version+'</span>':'')+'</td>'
      +'<td class="cli"><b>'+esc(x.para)+'</b>'+(x.es_cliente?'<span class="sub">cliente</span>':'<span class="tag-pros">prospecto</span>')+'</td>'
      +'<td>'+(x.tipo==='PLAN'?'📅 Plan':'🛠️ Trabajo especial')+'<span class="sub">'+esc(x.que||'')+'</span>'+(x.te_trabajo?'<span class="sub t-verde">→ '+esc(x.te_trabajo.codigo)+'</span>':'')+'</td>'
      +'<td class="num">'+monto(x.monto,x.moneda,x.periodicidad)+(x.fuera_catalogo?'<span class="sub t-ambar">fuera de catálogo</span>':'')+'</td>'
      +'<td>'+chip(x.estado)+(x.devuelta&&x.estado==='BORRADOR'?'<span class="sub t-ambar">devuelta</span>':'')+'</td><td>'+venceHtml(x)+'</td>'
      +'<td><span class="cot-av">'+av(x.responsable&&x.responsable.nombre)+esc(x.responsable?x.responsable.nombre:'')+'</span></td><td><span class="link">Ver →</span></td></tr>';
  });
  h+='</tbody></table></div><div class="gc-lista-m" style="margin-top:12px">'+lista.map(tarjeta).join('')+'</div></section>';
  return h;
}

/* ── Ficha ── */
var FICHA=null;
function abrirFicha(id){
  G.abrirDet('<div class="aviso lila"><span class="gc-spin"></span>Cargando la cotización…</div>');
  D.ficha(id).then(function(f){FICHA=f;$('gcDetCuerpo').innerHTML=fichaHtml(f);})
   .catch(function(e){$('gcDetCuerpo').innerHTML='<div class="aviso rojo">'+I('alerta','ic-roj')+'<span>'+esc(mErr(e))+'</span></div>';});
}
function nom(f,id){return id==null?'':(f.nombres&&f.nombres[String(id)])||('Usuario N.º '+id);}
function fichaHtml(f){
  var c=f.cotizacion,p=f.puede,ev=c.estado_vista,idx=FLUJO.findIndex(function(x){return x[0]===ev;});
  if(ev==='VENCIDA'||ev==='RECHAZADA')idx=3;
  var h='<div class="det-cab"><small>'+esc(c.codigo)+' · versión '+c.version+' · '+(c.tipo==='PLAN'?'📅 Plan mensual':'🛠️ Trabajo especial')+'</small><h3>'+esc(c.para)+(c.cliente_id?'':'<span class="tag-pros">prospecto</span>')+'</h3>'
    +chip(ev)+(c.aprobacion_regla?' <span class="estado gris sin">'+esc(REGLA[c.aprobacion_regla])+'</span>':'')+'</div>';
  h+='<div class="te-flujo cot-flujo" style="margin-top:12px">'+FLUJO.map(function(e,i){var cl=(ev==='ACEPTADA'||i<idx)?'hecho':i===idx?'actual':'';
    if(e[0]==='PENDIENTE_APROBACION'&&c.aprobacion_regla&&c.aprobacion_regla!=='APROBADA_POR_MASTER')cl='hecho otro';
    return '<div class="te-paso '+cl+'"><span class="n">'+(i+1)+'</span><b>'+esc(e[1])+'</b><small>'+esc(e[2])+'</small></div>';}).join('')+'</div>';
  h+='<div class="gc-tri"><div><small>💰 Valor (exento)</small><b>'+monto(c.monto_final,c.moneda,c.periodicidad)+'</b></div>'
    +'<div><small>📚 Catálogo</small><b>'+(G.esNum(c.monto_catalogo)?monto(c.monto_catalogo,c.moneda,c.periodicidad):'<span class="nd">'+((c.motivos_aprobacion||[]).indexOf('SERVICIO_CON_RANGO')>=0?'Con rango':'Por propuesta')+'</span>')+'</b></div>'
    +'<div><small>⏳ Vigencia</small><b>'+(c.vigencia_hasta?G.fFecha(c.vigencia_hasta)+(c.dias_para_vencer!=null&&c.dias_para_vencer>=0?' <span class="t3" style="font-size:11px">('+c.dias_para_vencer+' d)</span>':''):'<span class="nd">Al enviar: 15 días</span>')+'</b></div></div>';
  if(c.descuento_pct)h+='<p class="nota">Descuento '+esc(c.descuento_pct)+' % sobre '+monto(c.monto_propuesto||c.monto_catalogo,c.moneda,c.periodicidad)+'.</p>';
  if((c.motivos_aprobacion||[]).length&&!c.aprobacion_regla)h+='<div class="aviso cel">'+I('escudo','ic-cel')+'<span><b>Requiere aprobación del Master</b> (si no cotiza él): '+c.motivos_aprobacion.map(function(m){return esc(MOTIVO[m]||m);}).join(' · ')+(c.motivo_cambio?'<br>Motivo: «'+esc(c.motivo_cambio)+'»':'')+'</span></div>';
  if(c.devolucion_comentario&&c.estado==='BORRADOR')h+='<div class="aviso ambar">'+I('alerta','ic-amb')+'<span>Devuelta por '+esc(nom(f,c.devuelto_por))+': «'+esc(c.devolucion_comentario)+'»</span></div>';
  if(c.rechazo_motivo)h+='<div class="aviso gris"><span>El cliente respondió «No por ahora»: «'+esc(c.rechazo_motivo)+'»</span></div>';
  if(c.anulacion_motivo)h+='<div class="aviso gris"><span>Anulada por '+esc(nom(f,c.anulado_por))+': «'+esc(c.anulacion_motivo)+'»</span></div>';
  // Vínculo con el trabajo especial (ejecución)
  if(f.te_trabajo)h+='<div class="cot-vinculo">'+I('maletin','ic-ver')+'<span style="flex:1"><b>Esta cotización originó el trabajo especial '+esc(f.te_trabajo.codigo)+'</b><br><small class="t2">Ahí sigue la ejecución: factura adicional ('+esc(f.te_trabajo.factura_estado?String(f.te_trabajo.factura_estado).toLowerCase():'—')+'), cuotas y checklist.</small></span>'
    +'<a class="btn chico" href="../trabajos-especiales/index.html?trabajo='+encodeURIComponent(f.te_trabajo.id)+'">Ver trabajo especial '+esc(f.te_trabajo.codigo)+' →</a></div>';
  if(c.tipo==='PLAN'&&c.estado==='ACEPTADA'&&c.primer_mes){var pm=c.primer_mes;
    h+='<div class="cot-vinculo">'+I('calendario','ic-ver')+'<span style="flex:1"><b>Pasa a onboarding y facturación mensual</b><br><small class="t2">Primera mensualidad prorrateada: '+esc(pm.dias)+' de '+esc(pm.dias_mes)+' días = <b>'+uf(pm.monto_uf)+'</b> (factura anticipada y exenta, vence el día 21). Desde el mes siguiente: '+uf(pm.mensual_uf)+'.</small></span>'
      +(p.crear_cliente_onboarding?'<a class="btn chico" href="../clientes/index.html?desde_cotizacion='+encodeURIComponent(c.id)+'">'+I('plus')+'Crear cliente en onboarding</a>':'')+'</div>';
  }
  h+=accionesHtml(f);
  // Qué se cotiza
  h+='<section><h4>📝 Qué se cotiza</h4>';
  if(c.tipo==='PLAN')h+='<p><b>Plan:</b> '+esc(f.plan?f.plan.nombre:c.plan_codigo)+(c.trabajadores!=null?' · '+esc(c.trabajadores)+' trabajador(es)':'')+'</p>';
  else h+='<p><b>Servicio:</b> '+esc(f.servicio?f.servicio.nombre:c.servicio_id)+' · <b>Pago:</b> '+esc(COND[c.condicion_pago]||c.condicion_pago)+(c.condicion_pago==='CUOTAS'?' '+c.n_cuotas:'')+'</p>'
    +'<p><b>Qué se hará:</b> '+esc(c.descripcion_que||'—')+'</p><p><b>Alcance:</b> '+esc(c.descripcion_alcance||'—')+'</p>';
  (c.items||[]).forEach(function(it){h+='<div class="cl"><span>'+esc(it.glosa)+(it.detalle?'<br><small class="t3">'+esc(it.detalle)+(it.cantidad>1?' · '+esc(it.cantidad)+' × '+(c.moneda==='UF'?uf(it.unitario):clpT(it.unitario)):'')+'</small>':'')+'</span><b>'+(G.esNum(it.subtotal)?(c.moneda==='UF'?uf(it.subtotal):clp(it.subtotal)):'<span class="nd">Por propuesta</span>')+'</b></div>';});
  h+='</section>';
  h+='<section><h4>💡 Soluciones <span class="t3" style="font:500 12px var(--txt)">(frase del cliente → lo que logra → cómo)</span></h4>'
    +((c.soluciones||[]).length?c.soluciones.map(function(s){return '<div class="cot-sol"><div><small>El cliente dice</small><span class="f">«'+esc(s.frase)+'»</span></div><div><small>Lo que logra</small><span>'+esc(s.logra)+'</span></div><div><small>Cómo</small><span>'+esc(s.como||'—')+'</span></div></div>';}).join(''):'<p class="t3">Sin soluciones todavía (son obligatorias para enviar).</p>')+'</section>';
  if(c.notas_internas)h+='<section><h4>🔒 Notas internas</h4><p class="t2">'+esc(c.notas_internas)+'</p></section>';
  // Respaldos
  if((f.respaldos||[]).length)h+='<section><h4>📎 Respaldo de la aceptación</h4>'+f.respaldos.map(function(r){return '<div class="te-doc">'+I('archivo','ic-mor')+'<span class="nm">'+esc(r.nombre)+'<br><small class="t3">'+G.fHora(r.subido_at)+'</small></span><button type="button" class="btn chico sec" data-act="ver-doc" data-ruta="'+esc(r.storage_path)+'">Ver</button></div>';}).join('')+'</section>';
  // Versiones
  if((f.versiones||[]).length>1)h+='<section><h4>🗂️ Versiones</h4>'+f.versiones.map(function(v){return '<div class="cl"><span>'+(String(v.id)===String(c.id)?'<b>':'<button type="button" class="link" data-act="ficha" data-id="'+esc(v.id)+'">')+'Versión '+esc(v.version)+(String(v.id)===String(c.id)?' (esta)</b>':'</button>')+' · '+chip(v.estado)+'</span><b>'+monto(v.monto,c.moneda,c.periodicidad)+'</b></div>';}).join('')+'</section>';
  h+='<section><h4>👥 Personas</h4><p class="t2">Responsable: <span class="cot-av">'+av(nom(f,c.responsable_usuario_id))+esc(nom(f,c.responsable_usuario_id))+'</span> · creó: '+esc(nom(f,c.creado_por))+(c.aprobado_por?' · aprobó: '+esc(nom(f,c.aprobado_por)):'')+'</p></section>';
  h+='<section><h4>🧭 Bitácora</h4><ul class="gc-tl">'+(f.eventos||[]).slice().reverse().map(function(e){return '<li><b>'+esc(EV[e.tipo]||e.tipo)+'</b><small>'+G.fHora(e.at)+(e.actor?' · '+esc(e.actor):' · sistema')+(e.detalle&&e.detalle.comentario?' · «'+esc(e.detalle.comentario)+'»':'')+(e.detalle&&e.detalle.motivo?' · «'+esc(e.detalle.motivo)+'»':'')+'</small></li>';}).join('')+'</ul></section>';
  return h;
}
function btn(act,txt,cls,ic){return '<button type="button" class="btn '+(cls||'')+'" data-act="'+act+'">'+(ic?I(ic):'')+esc(txt)+'</button>';}
function accionesHtml(f){
  var c=f.cotizacion,p=f.puede,b='',nota='';
  if(p.editar)b+=btn('editar','Editar','sec','lapiz');
  if(p.solicitar)b+=btn('solicitar',S.yo.master?'Aprobar y dejar lista':'Preparar para enviar','','enviar');
  if(p.aprobar)b+=btn('aprobar','Aprobar','verde','check');
  if(p.devolver)b+=btn('devolver','Devolver con comentario','sec');
  if(c.snapshot)b+=btn('pdf','Ver PDF / imprimir','sec','descargar');
  if(p.marcar_enviada)b+=btn('enviada','Marcar como enviada','','enviar');
  if(p.aceptar)b+=btn('aceptar','Registrar aceptación','verde','check');
  if(p.rechazar)b+=btn('rechazar','«No por ahora»','sec');
  if(p.volver_a_cotizar)b+=btn('recotizar','Volver a cotizar','','repetir');
  if(p.anular)b+=btn('anular','Anular','peligro');
  if(c.estado==='PENDIENTE_APROBACION'&&!p.aprobar)nota='Esperando la aprobación del Master. Te llegará el aviso a la campana.';
  if(c.estado==='APROBADA')nota='Descarga el PDF, envíalo por tu canal habitual y marca «Enviada»: desde ese día corren los 15 días de vigencia.';
  if(c.estado_vista==='ENVIADA')nota='Cuando el cliente acepte (correo, WhatsApp o en persona), registra la aceptación con el respaldo.'+(c.tipo==='TE'?' Se creará el trabajo especial con su instrucción de factura adicional.':' Pasará a onboarding y facturación mensual.');
  if(c.estado_vista==='VENCIDA')nota='Venció sin respuesta: no se reactiva. «Volver a cotizar» crea la versión siguiente con el catálogo vigente.';
  return (b?'<div class="acciones">'+b+'</div>':'')+(nota?'<p class="nota">'+esc(nota)+'</p>':'');
}

/* ── Acciones ── */
function ejecutar(fn,args,msg,abrir){
  return D.rpc(fn,args).then(function(r){var id=abrir?abrir(r):(FICHA&&FICHA.cotizacion.id);recargar(typeof msg==='function'?msg(r):msg,id);return true;}).catch(function(e){throw new Error(mErr(e));});
}
function confirmar(titulo,texto,fn,args,msg,okClase,abrir){G.modal({titulo:titulo,html:'<p>'+texto+'</p>',okClase:okClase,alAceptar:function(){return ejecutar(fn,args,msg,abrir);}});}
function conTexto(titulo,texto,etiqueta,minimo,fn,armar,msg,okClase){
  G.modal({titulo:titulo,okClase:okClase,html:'<p>'+texto+'</p><label class="campo"><span>'+esc(etiqueta)+(minimo?' (mínimo '+minimo+' letras)':'')+'</span><textarea id="cotTx" maxlength="500"></textarea></label>',
    alAceptar:function(m){var v=m.querySelector('#cotTx').value.trim();if(v.length<minimo)throw new Error('Escribe al menos '+minimo+' letras.');return ejecutar(fn,armar(v),msg);}});
}
function accion(a,el){
  var f=FICHA,c=f&&f.cotizacion;if(!c)return;
  if(a==='editar')abrirEditor(f);
  else if(a==='solicitar'){
    var dir=S.yo.master||!(c.motivos_aprobacion||[]).length;
    confirmar(dir?'Dejar lista para enviar':'Enviar a aprobación del Master',
      S.yo.master?'Como Master, tu cotización queda <b>aprobada directamente</b> (queda registrado). Se congela el contenido y el precio.'
        :dir?'Es catálogo sin cambios: queda <b>lista para enviar</b> sin aprobación. Se congela el contenido y el precio.'
        :'Tiene cambios fuera de catálogo ('+(c.motivos_aprobacion||[]).map(function(m){return esc(MOTIVO[m]||m);}).join(', ')+'): le llega al Master para aprobar.',
      'cot_solicitar',{p_id:Number(c.id)},function(r){return r&&r.estado==='APROBADA'?'Lista para enviar ('+(REGLA[r.aprobacion_regla]||'')+').':'Enviada a aprobación del Master.';});
  }
  else if(a==='aprobar')confirmar('Aprobar cotización','Apruebas <b>'+esc(c.codigo)+'</b> por <b>'+montoT(c.monto_final,c.moneda,c.periodicidad)+'</b>. Motivos: '+(c.motivos_aprobacion||[]).map(function(m){return esc(MOTIVO[m]||m);}).join(', ')+(c.motivo_cambio?'. «'+esc(c.motivo_cambio)+'»':'')+'.<br><small class="t3">Se usa la huella de lo que estás viendo: si cambió, se rechaza.</small>',
      'cot_aprobar',{p_id:Number(c.id),p_huella:c.huella_revision},'Cotización aprobada · ya se puede enviar.','verde');
  else if(a==='devolver')conTexto('Devolver con comentario','Vuelve a borrador con tu comentario y le llega el aviso al responsable.','Comentario',3,'cot_devolver',function(v){return {p_id:Number(c.id),p_comentario:v};},'Cotización devuelta.','peligro');
  else if(a==='pdf')imprimir(f);
  else if(a==='enviada')G.modal({titulo:'Marcar como enviada',ok:'Marcar enviada',html:'<p>¿Por dónde le enviaste el PDF al cliente? Desde hoy corren los <b>15 días</b> de vigencia (aviso 2 días antes).</p><label class="campo"><span>Medio</span><select id="cotMed"><option value="CORREO">Correo</option><option value="WHATSAPP">WhatsApp</option><option value="PRESENCIAL">En persona</option></select></label>',
      alAceptar:function(m){return ejecutar('cot_marcar_enviada',{p_id:Number(c.id),p_medio:m.querySelector('#cotMed').value},function(r){return 'Enviada · vence el '+G.fFecha(r&&r.vigencia_hasta)+'.';});}});
  else if(a==='aceptar')abrirAceptar(f);
  else if(a==='rechazar')conTexto('«No por ahora»','La cotización queda cerrada como no aceptada y se avisa al equipo.','Motivo (precio, lo verá más adelante, eligió otra opción…)',2,'cot_rechazar',function(v){return {p_id:Number(c.id),p_motivo:v};},'Respuesta registrada.','peligro');
  else if(a==='anular')conTexto('Anular cotización','Queda anulada (no se borra). Podrás volver a cotizar.','Motivo',5,'cot_anular',function(v){return {p_id:Number(c.id),p_motivo:v};},'Cotización anulada.','peligro');
  else if(a==='recotizar')confirmar('Volver a cotizar','Se crea la <b>versión '+(c.version+1)+'</b> de '+esc(c.codigo)+' en borrador, con el <b>precio del catálogo vigente</b>. La versión anterior queda en el historial.','cot_volver_a_cotizar',{p_id:Number(c.id)},function(r){return 'Versión '+(r&&r.version)+' creada en borrador.';},'',function(r){return r&&r.id;});
  else if(a==='ver-doc'){var ruta=el.getAttribute('data-ruta');var w=window.open('about:blank','_blank');D.urlFirmada(ruta).then(function(u){if(w){w.opener=null;w.location.href=u;}else location.href=u;}).catch(function(e){if(w)w.close();G.toast(mErr(e),true);});}
}
function nombreArchivo(n){
  var b=String(n||'respaldo').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^A-Za-z0-9._-]+/g,'-').replace(/\.{2,}/g,'.').replace(/^[._-]+/,'');
  b=b||'respaldo';var ext=(b.match(/\.[A-Za-z0-9]{1,6}$/)||[''])[0];return Date.now()+'-'+b.slice(0,150-ext.length)+(b.length>150-ext.length?ext:'');
}
function sha256(file){return file.arrayBuffer().then(function(buf){return crypto.subtle.digest('SHA-256',buf);}).then(function(h){return Array.prototype.map.call(new Uint8Array(h),function(x){return ('0'+x.toString(16)).slice(-2);}).join('');});}
function abrirAceptar(f){
  var c=f.cotizacion;
  G.modal({titulo:'Registrar aceptación del cliente',ok:'Registrar aceptación',okClase:'verde',
    html:'<p><b>'+esc(c.codigo)+'</b> · '+esc(c.para)+' · '+montoT(c.monto_final,c.moneda,c.periodicidad)+'</p>'
      +'<label class="campo"><span>¿Cómo aceptó?</span><select id="cotMedio"><option value="CORREO">Correo</option><option value="WHATSAPP">WhatsApp</option><option value="PRESENCIAL">En persona</option></select></label>'
      +'<label class="campo"><span>Respaldo (correo en PDF o pantallazo · máx. 10 MB)</span><input type="file" id="cotArch" accept=".pdf,.png,.jpg,.jpeg,.webp"></label>'
      +'<details><summary class="link">Datos para la factura (opcional, si el cliente los confirmó)</summary>'
      +'<div class="campos2"><label class="campo"><span>RUT</span><input id="dfRut" maxlength="12"></label><label class="campo"><span>Razón social</span><input id="dfRaz" maxlength="200"></label>'
      +'<label class="campo"><span>Giro</span><input id="dfGiro" maxlength="200"></label><label class="campo"><span>Correo de facturas</span><input id="dfMail" type="email" maxlength="200"></label>'
      +'<label class="campo"><span>Dirección</span><input id="dfDir" maxlength="200"></label><label class="campo"><span>Comuna</span><input id="dfCom" maxlength="80"></label></div></details>'
      +'<p class="nota">'+(c.tipo==='TE'?'Al aceptar se crea el <b>trabajo especial</b> (ejecución) con su plan de pagos y la <b>instrucción de factura adicional</b> exenta; Facturación recibe el aviso.'
        :'Al aceptar, el cliente queda listo para <b>onboarding</b> y <b>facturación mensual</b> (primer mes prorrateado, factura anticipada). Luego usa «Crear cliente en onboarding».')+' Doble clic no duplica nada.</p>',
    alAceptar:function(m){
      var file=m.querySelector('#cotArch').files[0],medio=m.querySelector('#cotMedio').value;
      if(!file)throw new Error('Adjunta el respaldo de la aceptación.');
      if(MIMES.indexOf(file.type)<0)throw new Error('Tipo no permitido: PDF, PNG, JPG o WEBP.');
      if(file.size<1||file.size>10485760)throw new Error('El archivo debe pesar menos de 10 MB.');
      var df={},k={dfRut:'rut',dfRaz:'razon_social',dfGiro:'giro',dfMail:'email',dfDir:'direccion',dfCom:'comuna'};
      Object.keys(k).forEach(function(id){var v=m.querySelector('#'+id).value.trim();if(v)df[k[id]]=v;});
      var ruta=c.id+'/respaldo/'+nombreArchivo(file.name);
      return sha256(file).then(function(h){return D.subir(ruta,file).then(function(){
        return D.rpc('cot_respaldo_registrar',{p_id:Number(c.id),p_storage_path:ruta,p_nombre:String(file.name).slice(0,200),p_mime:file.type,p_bytes:file.size,p_sha256:h});});})
      .then(function(r){return D.rpc('cot_aceptar',{p_id:Number(c.id),p_medio:medio,p_respaldo_id:Number(r.respaldo_id),p_datos_facturacion:Object.keys(df).length?df:null});})
      .then(function(r){recargar(r&&r.te_codigo?'¡Aceptada! Se creó el trabajo especial '+r.te_codigo+' y la instrucción de factura adicional.':'¡Aceptada! Avisamos al Master; sigue el onboarding.',c.id);return true;})
      .catch(function(e){throw new Error(mErr(e));});
    }});
}

/* ── Crear / editar ── */
function cargarCat(){return S.cat?Promise.resolve(S.cat):D.catalogo().then(function(c){S.cat=c;return c;});}
function abrirEditor(f,tipoInicial){
  cargarCat().then(function(cat){
    var c=f?f.cotizacion:null, tipo=c?c.tipo:(tipoInicial||(S.yo.puede_plan?'PLAN':'TE'));
    if(tipo==='PLAN'&&!S.yo.puede_plan)tipo='TE';
    var dest=c?(c.cliente_id?{t:'cli',id:c.cliente_id,nombre:c.para}:c.lead_id?{t:'lead',id:c.lead_id,nombre:c.para}:{t:'pros'}):null;
    var sols=(c&&c.soluciones&&c.soluciones.length)?c.soluciones.slice():[{frase:'',logra:'',como:''}];
    var planes=cat.planes||[],serv=(cat.servicios||[]);
    var html=(c?'':'<div class="gc-seg" role="radiogroup" aria-label="Tipo" style="margin-bottom:6px">'
        +(S.yo.puede_plan?'<button type="button" class="fb'+(tipo==='PLAN'?' on':'')+'" data-tipo="PLAN">📅 Plan mensual</button>':'')
        +(S.yo.puede_te?'<button type="button" class="fb'+(tipo==='TE'?' on':'')+'" data-tipo="TE">🛠️ Trabajo especial</button>':'')+'</div>')
      +'<div class="campo"><span>Para quién</span><div id="cotDest"></div></div>'
      +'<div id="cotBloquePlan"><div class="campos2"><label class="campo"><span>Plan del catálogo</span><select id="cotPlan"><option value="">Elige…</option>'
        +planes.map(function(p){return '<option value="'+esc(p.codigo)+'">'+esc(p.nombre)+' · '+(p.por_propuesta?'por propuesta':(Number(p.precio_uf)>0?Number(p.precio_uf).toLocaleString('es-CL')+' UF':'0 UF')+' + '+Number(p.valor_por_trab_uf).toLocaleString('es-CL')+' UF/trab.')+'</option>';}).join('')+'</select></label>'
        +'<label class="campo"><span>Trabajadores</span><input type="number" id="cotTrab" min="0" max="999" step="1" value="'+esc(c&&c.trabajadores!=null?c.trabajadores:0)+'"></label></div></div>'
      +'<div id="cotBloqueTe"><label class="campo"><span>Servicio del catálogo</span><select id="cotSrv"><option value="">Elige…</option>'
        +serv.map(function(s){return '<option value="'+esc(s.id)+'"'+(s.disponible?'':' disabled')+'>'+esc(s.nombre)+' · '+(s.disponible?(s.clase==='PROPUESTA'?'por propuesta':s.clase==='RANGO'?clpT(s.precio)+' a '+clpT(s.precio_hasta):clpT(s.precio)):'en UF: aún no disponible como trabajo especial')+'</option>';}).join('')+'</select></label>'
        +'<div class="campos2"><label class="campo"><span>Condición de pago</span><select id="cotCond"><option value="CONTADO">Contado</option><option value="CINCUENTA">50/50 (inicio y al terminar)</option><option value="CUOTAS">Cuotas</option></select></label>'
        +'<label class="campo" id="cotNW" hidden><span>N.º de cuotas (2 a 12; más de 3 requiere aprobación)</span><input type="number" id="cotN" min="2" max="12" step="1" value="'+esc(c&&c.n_cuotas>1?c.n_cuotas:3)+'"></label></div>'
        +'<label class="campo"><span>Qué se hará</span><textarea id="cotQue" maxlength="1000">'+esc(c&&c.descripcion_que||'')+'</textarea></label>'
        +'<label class="campo"><span>Alcance</span><textarea id="cotAlc" maxlength="1000">'+esc(c&&c.descripcion_alcance||'')+'</textarea></label></div>'
      +'<div class="cot-precio" id="cotPrecio"></div>'
      +'<label class="chk"><input type="checkbox" id="cotCambia"'+(c&&(c.monto_propuesto||c.descuento_pct)?' checked':'')+'> Proponer otro valor o un descuento'+(S.yo.master?'':' (lo aprueba el Master)')+'</label>'
      +'<div id="cotCambioW" hidden><div class="campos2"><label class="campo"><span id="cotMontoLbl">Valor propuesto</span><input type="number" id="cotMonto" step="0.01" min="0" value="'+esc(c&&c.monto_propuesto||'')+'"></label>'
        +'<label class="campo"><span>Descuento %</span><input type="number" id="cotDesc" min="0" max="99.99" step="0.01" value="'+esc(c&&c.descuento_pct||'')+'"></label></div>'
        +'<label class="campo"><span>Motivo del cambio'+(S.yo.master?' (opcional)':'')+'</span><input type="text" id="cotMot" maxlength="500" value="'+esc(c&&c.motivo_cambio||'')+'"></label></div>'
      +'<div class="campo"><span>💡 Soluciones · frase del cliente → lo que logra → cómo (al menos 1)</span><div id="cotSols"></div><button type="button" class="link" id="cotSolMas">+ Agregar solución</button></div>'
      +(S.yo.master&&cat.responsables&&cat.responsables.length?'<label class="campo"><span>Responsable</span><select id="cotResp2">'+cat.responsables.map(function(u){return '<option value="'+esc(u.id)+'" data-plan="'+(u.plan?1:0)+'" data-te="'+(u.te?1:0)+'">'+esc(u.nombre)+'</option>';}).join('')+'</select></label>':'')
      +'<label class="campo"><span>Notas internas (no las ve el cliente)</span><textarea id="cotNotas" maxlength="2000">'+esc(c&&c.notas_internas||'')+'</textarea></label>'
      +'<p class="nota">El precio de catálogo lo calcula el servidor. Factura siempre exenta. Escribe «nuestros servicios» (nunca «honorarios»).</p>';
    G.modal({titulo:c?'Editar '+c.codigo+' v'+c.version:'➕ Nueva cotización',ok:c?'Guardar':'Crear borrador',html:html,alAbrir:function(m){
      var q=function(s){return m.querySelector(s);};
      function pintarTipo(){q('#cotBloquePlan').hidden=tipo!=='PLAN';q('#cotBloqueTe').hidden=tipo!=='TE';q('#cotMontoLbl').textContent=tipo==='PLAN'?'Valor propuesto (UF al mes)':'Valor propuesto ($, entero)';
        q('#cotMonto').step=tipo==='PLAN'?'0.01':'1';precio();}
      function precio(){
        var t='',box=q('#cotPrecio');
        if(tipo==='PLAN'){var p=planes.find(function(x){return x.codigo===q('#cotPlan').value;});var n=Math.max(0,Number(q('#cotTrab').value||0)-Number(p&&p.trab_incluidos||0));
          if(!p)t='<span class="t3">Elige un plan.</span>';else if(p.por_propuesta)t='<small class="t3">Precio de catálogo</small><br><b>Por propuesta</b> <span class="t3">· propone el valor (requiere aprobación si no eres el Master)</span>';
          else t='<small class="t3">Precio de catálogo (referencial; lo confirma el servidor)</small><br><b>'+(Math.round((Number(p.precio_uf)+n*Number(p.valor_por_trab_uf))*100)/100).toLocaleString('es-CL',{minimumFractionDigits:2})+' UF/mes</b> <span class="t3">· '+Number(p.precio_uf).toLocaleString('es-CL')+' UF base'+(n?' + '+n+' × '+Number(p.valor_por_trab_uf).toLocaleString('es-CL')+' UF':'')+'</span>';}
        else{var s=serv.find(function(x){return x.id===q('#cotSrv').value;});
          if(!s)t='<span class="t3">Elige un servicio.</span>';else t='<small class="t3">Precio de catálogo</small><br><b>'+(s.clase==='FIJO'?clpT(s.precio):s.clase==='RANGO'?clpT(s.precio)+' a '+clpT(s.precio_hasta):'Por propuesta')+'</b>'+(s.clase!=='FIJO'?' <span class="t3">· propone el valor'+(s.clase==='RANGO'?' dentro del rango':'')+'</span>':'');}
        box.innerHTML=t;
      }
      function pintarSols(){q('#cotSols').innerHTML=sols.map(function(s,i){return '<div class="cot-sol-ed"><input placeholder="El cliente dice… «me avisan tarde el IVA»" data-s="frase" data-i="'+i+'" maxlength="300" value="'+esc(s.frase)+'">'
        +'<input placeholder="Lo que logra… «pagas a tiempo»" data-s="logra" data-i="'+i+'" maxlength="300" value="'+esc(s.logra)+'"><input placeholder="Cómo… «aviso 5 días antes»" data-s="como" data-i="'+i+'" maxlength="300" value="'+esc(s.como||'')+'">'
        +'<button type="button" class="btn chico sec" data-sq="'+i+'" aria-label="Quitar solución">'+I('cerrar')+'</button></div>';}).join('');}
      function pintarDest(){
        var w=q('#cotDest');
        if(dest&&dest.t!=='pros'&&dest.id){w.innerHTML='<div class="cot-elegido">'+(dest.t==='cli'?'🏢 Cliente':'🎯 Prospecto de Comercial')+': <b>'+esc(dest.nombre)+'</b><button type="button" class="link" id="cotDestCam" style="margin-left:auto">Cambiar</button></div>';
          q('#cotDestCam').onclick=function(){dest=null;pintarDest();};return;}
        if(dest&&dest.t==='pros'){w.innerHTML='<div class="campos2"><label class="campo"><span>Nombre o empresa</span><input id="pN" maxlength="200" value="'+esc(c&&!c.cliente_id&&!c.lead_id?c.prospecto_nombre||'':'')+'"></label><label class="campo"><span>RUT (opcional)</span><input id="pR" maxlength="12" value="'+esc(c&&c.prospecto_rut||'')+'"></label>'
          +'<label class="campo"><span>Correo</span><input id="pE" type="email" maxlength="200" value="'+esc(c&&c.prospecto_email||'')+'"></label><label class="campo"><span>Teléfono</span><input id="pT" maxlength="40" value="'+esc(c&&c.prospecto_telefono||'')+'"></label></div>'
          +'<button type="button" class="link" id="cotDestBus">← Buscar cliente o prospecto existente</button>';q('#cotDestBus').onclick=function(){dest=null;pintarDest();};return;}
        w.innerHTML='<input type="search" id="cotBus" placeholder="Escribe al menos 2 letras del cliente o prospecto…" style="min-height:42px;border-radius:12px;padding:8px 12px;width:100%;font:500 15px var(--txt)"><ul class="cot-res" id="cotRes" hidden></ul>'
          +'<button type="button" class="link" id="cotNuevoPros">+ Prospecto nuevo (aún sin ficha)</button>';
        q('#cotNuevoPros').onclick=function(){dest={t:'pros'};pintarDest();};
        var tmr=null;q('#cotBus').addEventListener('input',function(e){var v=e.target.value.trim();clearTimeout(tmr);if(v.length<2){q('#cotRes').hidden=true;return;}
          tmr=setTimeout(function(){D.buscar(v).then(function(r){var l=q('#cotRes');if(!l)return;var it=(r.clientes||[]).map(function(x){return {t:'cli',id:x.id,nombre:x.nombre,sub:'cliente · '+(x.estado||'')};})
            .concat((r.prospectos||[]).map(function(x){return {t:'lead',id:x.id,nombre:x.nombre,sub:'prospecto · '+(x.etapa||'')};}));
            l.hidden=false;l.innerHTML=it.length?it.map(function(x,i){return '<li><button type="button" data-di="'+i+'">'+esc(x.nombre)+' <small>· '+esc(x.sub)+'</small></button></li>';}).join(''):'<li><button type="button" disabled>Sin resultados</button></li>';
            l.querySelectorAll('[data-di]').forEach(function(b){b.onclick=function(){dest=it[Number(b.getAttribute('data-di'))];pintarDest();};});}).catch(function(e){G.toast(mErr(e),true);});},250);});
      }
      m.querySelectorAll('[data-tipo]').forEach(function(b){b.addEventListener('click',function(){tipo=b.getAttribute('data-tipo');m.querySelectorAll('[data-tipo]').forEach(function(x){x.classList.toggle('on',x===b);});pintarTipo();});});
      q('#cotPlan').value=c&&c.plan_codigo||'';q('#cotSrv').value=c&&c.servicio_id||'';q('#cotCond').value=c&&c.condicion_pago||'CONTADO';q('#cotNW').hidden=q('#cotCond').value!=='CUOTAS';
      ['#cotPlan','#cotTrab','#cotSrv'].forEach(function(s){q(s).addEventListener('input',precio);q(s).addEventListener('change',precio);});
      q('#cotCond').addEventListener('change',function(e){q('#cotNW').hidden=e.target.value!=='CUOTAS';});
      q('#cotCambioW').hidden=!q('#cotCambia').checked;q('#cotCambia').addEventListener('change',function(e){q('#cotCambioW').hidden=!e.target.checked;});
      q('#cotSols').addEventListener('input',function(e){var i=e.target.getAttribute('data-i');if(i!=null)sols[Number(i)][e.target.getAttribute('data-s')]=e.target.value;});
      q('#cotSols').addEventListener('click',function(e){var b=e.target.closest('[data-sq]');if(!b)return;sols.splice(Number(b.getAttribute('data-sq')),1);if(!sols.length)sols.push({frase:'',logra:'',como:''});pintarSols();});
      q('#cotSolMas').onclick=function(){if(sols.length>=8){G.toast('Máximo 8 soluciones.',true);return;}sols.push({frase:'',logra:'',como:''});pintarSols();};
      var rs=q('#cotResp2');if(rs&&c)rs.value=String(c.responsable_usuario_id);else if(rs)rs.value=String(S.yo.usuario_id);
      pintarTipo();pintarSols();pintarDest();
    },alAceptar:function(m){
      var q=function(s){return m.querySelector(s);},v=function(s){return q(s)?q(s).value.trim():'';},p={};
      if(!c)p.tipo=tipo;
      if(!dest)throw new Error('Elige para quién es la cotización (cliente, prospecto o prospecto nuevo).');
      if(dest.t==='cli')p.cliente_id=Number(dest.id);else if(dest.t==='lead')p.lead_id=Number(dest.id);
      else{if(v('#pN').length<3)throw new Error('Escribe el nombre del prospecto (mínimo 3 letras).');var em=v('#pE');if(em&&!/^[^@\s,;]+@[^@\s,;]+\.[^@\s,;]+$/.test(em))throw new Error('El correo no es válido.');
        p.prospecto={nombre:v('#pN')};if(v('#pR'))p.prospecto.rut=v('#pR');if(em)p.prospecto.email=em;if(v('#pT'))p.prospecto.telefono=v('#pT');}
      if(tipo==='PLAN'){if(!v('#cotPlan'))throw new Error('Elige el plan.');p.plan_codigo=v('#cotPlan');p.trabajadores=Number(v('#cotTrab')||0);}
      else{if(!v('#cotSrv'))throw new Error('Elige el servicio.');p.servicio_id=v('#cotSrv');p.condicion_pago=v('#cotCond');if(p.condicion_pago==='CUOTAS'){var n=Number(v('#cotN'));if(!(n>=2&&n<=12&&Math.floor(n)===n))throw new Error('Las cuotas van de 2 a 12.');p.n_cuotas=n;}
        p.que=v('#cotQue');p.alcance=v('#cotAlc');}
      if(q('#cotCambia').checked){var mo=v('#cotMonto'),de=v('#cotDesc');p.monto_propuesto=mo?Number(mo):null;p.descuento_pct=de?Number(de):null;p.motivo_cambio=v('#cotMot')||null;
        if(tipo==='TE'&&mo&&Math.floor(Number(mo))!==Number(mo))throw new Error('En pesos, el valor va sin decimales.');}
      else{p.monto_propuesto=null;p.descuento_pct=null;}
      p.soluciones=sols.filter(function(s){return (s.frase||'').trim()||(s.logra||'').trim();}).map(function(s){var o={frase:s.frase.trim(),logra:s.logra.trim()};if((s.como||'').trim())o.como=s.como.trim();return o;});
      p.notas_internas=v('#cotNotas')||null;
      var rs=q('#cotResp2');if(rs&&rs.value&&(!c||String(rs.value)!==String(c.responsable_usuario_id)))p.responsable_usuario_id=Number(rs.value);
      return D.rpc('cot_guardar',{p_id:c?Number(c.id):null,p:p}).then(function(r){
        recargar((c?'Guardado.':'Borrador '+(r&&r.codigo||'')+' creado.')+(r&&r.requiere_aprobacion?' Tiene cambios fuera de catálogo: requerirá aprobación del Master.':''),r&&r.id);return true;
      }).catch(function(e){throw new Error(mErr(e));});
    }});
  }).catch(function(e){G.toast(mErr(e),true);});
}

/* ── PDF imprimible (marca Contadoor, formato soluciones). Sale del snapshot congelado (lo mismo que se acepta). ── */
function imprimir(f){
  var c=f.cotizacion,s=c.snapshot||{},resp=nom(f,c.responsable_usuario_id);
  var filas=(s.items||[]).map(function(it){return '<tr><td>'+esc(it.glosa)+(it.detalle?'<br><small>'+esc(it.detalle)+'</small>':'')+'</td><td class="n">'+(G.esNum(it.subtotal)?(s.moneda==='UF'?Number(it.subtotal).toLocaleString('es-CL',{minimumFractionDigits:2})+' UF':clpT(it.subtotal)):'Por propuesta')+'</td></tr>';}).join('');
  var sols=(s.soluciones||[]).map(function(x){return '<div class="sol"><div class="f">«'+esc(x.frase)+'»</div><div class="l">✅ '+esc(x.logra)+'</div>'+(x.como?'<div class="c">'+esc(x.como)+'</div>':'')+'</div>';}).join('');
  var total=s.moneda==='UF'?Number(s.monto_final).toLocaleString('es-CL',{minimumFractionDigits:2})+' UF'+(s.periodicidad==='MENSUAL'?' al mes':''):clpT(s.monto_final);
  var cond=s.condicion?('<p><b>Forma de pago:</b> '+esc(COND[s.condicion.tipo]||s.condicion.tipo)+(s.condicion.tipo==='CUOTAS'?' ('+esc(s.condicion.n_cuotas)+' cuotas)':'')+'. Se factura antes de iniciar.</p>'):'<p><b>Facturación:</b> mensual y anticipada; vence el día 21 de cada mes. La primera mensualidad se prorratea según el día de inicio.</p>';
  var html='<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>'+esc(s.codigo)+' v'+esc(s.version)+' · Contadoor</title><style>'
    +'@page{size:A4;margin:16mm}body{font-family:Inter,Arial,sans-serif;color:#1A121C;margin:0;font-size:13px;line-height:1.5}'
    +'.cab{background:linear-gradient(135deg,#241030,#17091A);color:#fff;padding:22px 26px;border-radius:14px;position:relative;overflow:hidden}'
    +'.cab:after{content:"";position:absolute;right:-30px;top:-20px;width:160px;height:160px;background:repeating-linear-gradient(20deg,rgba(199,123,201,.35) 0 10px,transparent 10px 22px);border-radius:50%}'
    +'.marca{font:900 22px Montserrat,Arial,sans-serif}.marca span{color:#E39BE5}h1{font:800 20px Montserrat,Arial,sans-serif;margin:14px 0 2px}h1 span{color:#E39BE5}'
    +'.meta{color:#C9A8CC;font-size:12px}h2{font:800 15px Montserrat,Arial,sans-serif;border-left:4px solid #924893;padding-left:9px;margin:22px 0 10px}'
    +'.sol{border:1px solid #E7D5E8;border-radius:12px;padding:10px 12px;margin:8px 0;break-inside:avoid}.sol .f{color:#924893;font-style:italic;font-weight:600}.sol .c{color:#6B5A6D;font-size:12px}'
    +'table{width:100%;border-collapse:collapse}td{padding:8px 4px;border-bottom:1px solid #EEE3EF;vertical-align:top}td small{color:#6B5A6D}.n{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}'
    +'.tot{display:flex;justify-content:space-between;align-items:center;background:#F7EEF8;border-radius:12px;padding:12px 16px;margin-top:10px;font:800 16px Montserrat,Arial,sans-serif}.tot b{color:#924893;font-size:20px}'
    +'.pie{margin-top:26px;font-size:11px;color:#6B5A6D;border-top:1px solid #EEE3EF;padding-top:10px}.firma{margin-top:18px}'
    +'@media print{.noimp{display:none}}</style></head><body>'
    +'<div class="noimp" style="text-align:right;margin-bottom:10px"><button onclick="print()" style="padding:8px 16px;border-radius:999px;border:0;background:#924893;color:#fff;font-weight:700;cursor:pointer">Imprimir / guardar PDF</button></div>'
    +'<div class="cab"><div class="marca">Conta<span>door</span></div><h1>Tu propuesta de <span>'+(s.tipo==='PLAN'?'servicio mensual':'trabajo especial')+'</span></h1>'
    +'<div class="meta">'+esc(s.codigo)+' · versión '+esc(s.version)+' · para '+esc(s.para&&s.para.nombre||'')+(c.vigencia_hasta?' · vigente hasta el '+G.fFecha(c.vigencia_hasta):' · vigencia '+esc(s.vigencia_dias||15)+' días desde el envío')+'</div></div>'
    +(sols?'<h2>Lo que nos contaste y cómo lo resolvemos</h2>'+sols:'')
    +'<h2>'+(s.tipo==='PLAN'?esc(s.plan&&s.plan.nombre||'Plan'):esc(s.servicio&&s.servicio.nombre||'Trabajo especial'))+'</h2>'
    +(s.detalle&&s.detalle.que?'<p><b>Qué haremos:</b> '+esc(s.detalle.que)+'</p>':'')+(s.detalle&&s.detalle.alcance?'<p><b>Alcance:</b> '+esc(s.detalle.alcance)+'</p>':'')
    +'<table>'+filas+'</table>'+(s.descuento_pct?'<p>Descuento aplicado: '+esc(s.descuento_pct)+' %.</p>':'')
    +'<div class="tot"><span>Nuestros servicios</span><b>'+total+'</b></div>'
    +'<p style="margin-top:12px">Factura exenta de IVA emitida por <b>Asesorías Contadoor Ltda.</b> Sin permanencia.</p>'+cond
    +'<div class="firma"><b>'+esc(resp)+'</b><br><span style="color:#6B5A6D">Equipo Contadoor</span></div>'
    +'<div class="pie">Para aceptar esta propuesta, respóndenos por correo o WhatsApp antes del vencimiento. Huella del documento: '+esc(String(c.snapshot_hash||'').slice(0,16))+'…</div>'
    +'</body></html>';
  var w=window.open('','_blank');if(!w){G.toast('Permite las ventanas emergentes para ver el PDF.',true);return;}
  w.opener=null;w.document.open();w.document.write(html);w.document.close();
}

/* ── Eventos ── */
function pintar(root){(root||document).querySelectorAll('[data-gc-ic]').forEach(function(el){el.innerHTML=G.svg(el.getAttribute('data-gc-ic'));el.removeAttribute('data-gc-ic');});}
document.addEventListener('click',function(ev){
  var b=ev.target.closest('[data-act]');if(!b||b.disabled)return;var a=b.getAttribute('data-act');
  if(a==='tab'){S.tab=b.getAttribute('data-t');render();}
  else if(a==='filtro-estado'){S.estado=S.estado===b.getAttribute('data-e')?'':b.getAttribute('data-e');render();}
  else if(a==='ficha')abrirFicha(b.getAttribute('data-id'));
  else if(a==='nueva')abrirEditor(null);
  else if(a==='recargar'){S.err=null;cargar();}
  else if(FICHA)accion(a,b);
});
document.addEventListener('keydown',function(ev){if((ev.key==='Enter'||ev.key===' ')&&ev.target.tagName==='TR'&&ev.target.getAttribute('data-act')==='ficha'){ev.preventDefault();abrirFicha(ev.target.getAttribute('data-id'));}});
document.addEventListener('input',function(ev){if(ev.target.id==='cotBuscar'){S.buscar=ev.target.value.trim();var pos=ev.target.selectionStart;render();var i=$('cotBuscar');if(i){i.focus();try{i.setSelectionRange(pos,pos);}catch(e){}}}});
document.addEventListener('change',function(ev){if(ev.target.id==='cotEstado'){S.estado=ev.target.value;render();}else if(ev.target.id==='cotResp'){S.resp=ev.target.value;render();}});

function iniciar(){
  pintar();
  $('gcDetCerrar').addEventListener('click',G.cerrarDet);$('gcVelo').addEventListener('click',G.cerrarDet);
  if(DEMO){$('gcDemo').hidden=false;document.documentElement.classList.remove('auth-pending');if(window.COT_DEMO_UI)window.COT_DEMO_UI(function(){G.cerrarDet();S.cat=null;cargar();});}
  cargar();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',iniciar);else iniciar();
})();
