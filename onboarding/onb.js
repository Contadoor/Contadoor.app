/* ============================================================
   onboarding/onb.js — Onboarding O1 (Comercial → Onboarding) · BORRADOR
   Del plan ACEPTADO (Cotizaciones K1) al cliente listo: ficha, requerimientos dinámicos, bienvenida con CARTA EN PDF adjunta,
   correo aparte de la clave SII (solo explica la llamada) e incidente "clave recibida por correo".
   Conectada SOLO a las RPC de 202611101000_onboarding_o1 y a la Edge onboarding-correo (preparar · enviar · evidencia).
   Cada RPC valida el actor en el servidor; la pantalla nunca decide montos, permisos ni qué requerimiento se omite.
   Lo que se ve en la vista previa es EXACTAMENTE lo que sale: el HTML y el PDF guardados en el bucket privado, con su huella.
   La pantalla NUNCA pide, muestra ni guarda una clave: la clave SII se guarda con «Guardar clave» de la ficha del cliente
   (guardar-credencial, hoy solo el Master) y aquí solo se registra que quedó en la bóveda.
   ============================================================ */
(function(){
'use strict';
var G=window.GC, esc=G.esc, $=G.$, A=G.API;
var EDGE='onboarding-correo';

var ERR={
  SIN_PERMISO:'No tienes permiso para esta acción.',NO_EXISTE:'La ficha no existe o no es tuya.',NO_APLICA:'No aplica.',ONB_ANULADO:'El onboarding está anulado.',
  FECHA_INICIO_INVALIDA:'La fecha de inicio va entre la aceptación y 60 días después.',PARAMETROS_INVALIDOS:'Datos inválidos.',
  SIN_DESTINATARIO:'Registra primero el correo de contacto.',SIN_CONTACTO:'Falta el nombre del contacto.',
  TEXTO_ESPECIAL_INSEGURO:'El requerimiento especial no puede tener claves, contraseñas, PIN, enlaces ni números de tarjeta.',
  TEXTO_ESPECIAL_LARGO:'El requerimiento especial tiene máximo 500 caracteres.',TEXTO_ESPECIAL_CORTO:'El requerimiento especial es muy corto.',
  TEXTO_ESPECIAL_HONORARIOS:'Usa «nuestros servicios» en vez de «honorarios».',YA_ENVIADO:'Este correo ya salió (o está en revisión). Reenviar es acción del Master.',
  MAX_INTENTOS:'Hubo 3 intentos fallidos: revisa la configuración con el Master.',ENVIO_APAGADO:'El envío de correos de onboarding está APAGADO (lo enciende el Master).',
  REVISION_OBLIGATORIA:'Marca «Revisé los datos y el destinatario».',HUELLA_NO_COINCIDE:'El contenido cambió desde la vista previa. Ábrela de nuevo.',
  VISTA_PREVIA_VENCIDA:'La vista previa venció (30 min). Ábrela de nuevo.',ACEPTACION_NO_VERIFICADA:'La cotización no está aceptada con respaldo.',
  TERMINOS_NO_COINCIDEN:'Los términos no coinciden con los aceptados.',EVIDENCIA_NO_GUARDADA:'No se pudo guardar la evidencia. Inténtalo de nuevo.',
  PDF_CARACTER_NO_SOPORTADO:'Hay un carácter que la carta no puede escribir (por ejemplo, un emoji en el texto especial o en un nombre).',
  EVIDENCIA_OBLIGATORIA:'Indica el tipo de evidencia y un detalle (5 a 300 letras).',EVIDENCIA_INVALIDA:'Revisa el detalle: 5 a 300 letras y sin datos sensibles.',
  CONTACTO_INVALIDO:'Revisa los datos de contacto (sin claves ni datos sensibles).',EMAIL_INVALIDO:'El correo no es válido.',
  CONFIRMACION_INVALIDA:'Indica el medio y al menos nombre y correo.',NOTA_INSEGURA:'Describe el hecho sin copiar la clave.',
  ACCIONES_OBLIGATORIAS:'Confirma las tres acciones (no copiada, no reenviada, mensaje eliminado).',INCIDENTE_OBLIGATORIO:'Falta el incidente.',
  SIN_CLIENTE:'La clave se registra cuando el cliente ya existe en Gestoor.',BOVEDA_SIN_CONFIRMAR:'No hay una clave SII guardada por ti en las últimas 2 horas para esta empresa.',
  UF_FUENTE_INVALIDA:'La fuente «Periodos» es solo para el día 1.',UF_NO_COINCIDE:'La UF no coincide con la del Panel de Control.',
  UF_REFERENCIA_INVALIDA:'Usa la tabla oficial del SII: https://www.sii.cl/valores_y_fechas/uf/ufAAAA.htm',UF_FUERA_DE_RANGO:'La UF difiere más de 2 % de la última registrada.',
  UF_FECHA_INVALIDA:'La UF debe ser de un día entre el inicio y el fin de ese mes.',MOTIVO_OBLIGATORIO:'Escribe el motivo (10 a 300 letras).',
  NO_INCIERTO:'El correo ya no está incierto.',ANALISTA_INVALIDO:'Esa persona no tiene el rol correcto.'
};
function mErr(e){return G.msgError(e,ERR);}
function cod(x){return (String(x||'').match(/^([A-Z_]{4,60})/)||[])[1]||'ERROR';}

var REQ={CONTACTO:'Validar datos de contacto',CONTADOR_ANTERIOR:'Contador anterior',BALANCES:'Balances',REGISTROS_TRIBUTARIOS:'Registros tributarios (RAI, SAC, REX, DDAN · RLI/CPT)',
  RENTA_F22:'Última renta (F22)',F29:'Últimos F29',LIBROS_CONTABLES:'Libros contables',REMUNERACIONES:'Remuneraciones (nómina, contratos, liquidaciones, Previred, LRE)',
  CLAVE_SII:'Clave SII (por llamada; nunca por correo)',NOMBRES:'Tres nombres posibles',CAPITAL:'Capital',SOCIOS:'Datos de los socios',ACTIVIDAD:'Actividad y dirección'};
var EST_REQ={PENDIENTE:['Pendiente','ambar'],COMPLETO:['Completo','verde'],NO_APLICA:['No aplica','gris']};
var EVID={DOCUMENTO_RECIBIDO:'Documento recibido',CONFIRMADO_POR_CLIENTE:'Confirmado por el cliente',DATO_VERIFICADO_EN_GESTOOR:'Dato verificado en Gestoor',BOVEDA_VERIFICADA:'Verificada en la bóveda'};
var EST_ONB={POR_DAR_BIENVENIDA:['Por dar la bienvenida','lila'],BIENVENIDA_ENVIADA:['Bienvenida enviada','verde'],EN_CURSO:['En curso','cel'],LISTO:['Listo','verde'],ANULADO:['Anulado','gris']};
var EST_CORREO={PREPARANDO:'Preparando',PREPARADO:'Vista previa',ENVIANDO:'Enviando',ENVIADO:'Enviado',FALLIDO:'No salió',INCIERTO:'INCIERTO (revisar Enviados)',ANULADO:'Anulado'};
var TIPO_CORREO={BIENVENIDA_UNICO:'Bienvenida + carta PDF',CLAVE_SII_LLAMADA:'Clave SII por llamada',AVISO_CAMBIO_CLAVE:'Aviso: cambia tu clave SII'};

var S={yo:null,filas:[],sinFicha:[],ficha:null,err:null};

/* ── Edge ── */
function edge(body){
  var t=window._gestoorAccessToken;if(!t)return Promise.reject(new Error('GESTOOR_NO_SESSION'));
  return fetch(SB_URL+'/functions/v1/'+EDGE,{method:'POST',cache:'no-store',credentials:'omit',
    headers:{'Content-Type':'application/json','apikey':SB_KEY,'Authorization':'Bearer '+t},body:JSON.stringify(body)})
    .then(function(r){return r.json().catch(function(){return {error:'HTTP_'+r.status};});});
}
function pdfUrl(b64){var bin=atob(b64),u=new Uint8Array(bin.length);for(var i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return URL.createObjectURL(new Blob([u],{type:'application/pdf'}));}

/* ── Bandeja ── */
function cargar(){
  return A.rpc('onb_bandeja').then(function(b){S.filas=b.filas||[];S.sinFicha=b.cotizaciones_sin_ficha||[];S.yo=b.yo;render();abrirDesdeEnlace();})
    .catch(function(e){S.err=mErr(e);render();});
}
function chip(t,c){return '<span class="estado '+c+'">'+esc(t)+'</span>';}
function render(){
  var h='';
  if(S.err){$('gcApp').innerHTML='<div class="aviso rojo">'+esc(S.err)+'</div>';return;}
  if(S.sinFicha.length){
    h+='<section class="card"><h3>Planes aceptados sin ficha</h3><div class="tabla-box"><table class="gt"><thead><tr><th>Cotización</th><th>Para</th><th>Aceptada</th><th></th></tr></thead><tbody>';
    S.sinFicha.forEach(function(c){h+='<tr><td>'+esc(c.codigo)+'</td><td>'+esc(c.para)+'</td><td>'+G.fFecha(c.aceptado_at)+'</td><td><button class="btn chico" data-act="abrir" data-id="'+esc(c.id)+'">Abrir onboarding</button></td></tr>';});
    h+='</tbody></table></div></section>';
  }
  h+='<section class="card"><h3>Onboardings</h3>';
  if(!S.filas.length)h+='<div class="gc-vacio">Todavía no hay fichas de onboarding.</div>';
  else{
    h+='<div class="tabla-box"><table class="gt"><thead><tr><th>Empresa</th><th>Tipo</th><th>Inicio</th><th>Estado</th><th class="num">Pendientes</th></tr></thead><tbody>';
    S.filas.forEach(function(f){var e=EST_ONB[f.estado]||[f.estado,'gris'];
      h+='<tr class="clic" tabindex="0" data-act="ficha" data-id="'+esc(f.id)+'"><td class="cli"><b>'+esc(f.razon_social)+'</b></td><td>'+(f.tipo==='PLAN_CONSTITUCION'?'Plan + constitución':'Plan')+'</td><td>'+G.fFecha(f.fecha_inicio)+'</td><td>'+chip(e[0],e[1])+'</td><td class="num">'+esc(f.pendientes)+'</td></tr>';});
    h+='</tbody></table></div>';
  }
  h+='</section>';
  $('gcApp').innerHTML=h;
}
var ENLACE_USADO=false;
function abrirDesdeEnlace(){if(ENLACE_USADO)return;ENLACE_USADO=true;var m=/(?:^|&)id=(\d{1,18})(?:&|$)/.exec(location.search.slice(1));if(m)abrirFicha(m[1]);}

/* ── Ficha ── */
function abrirFicha(id){
  return A.rpc('onb_ficha',{p_id:Number(id)}).then(function(f){S.ficha=f;G.abrirDet(fichaHtml(f));pintarModo(f);}).catch(function(e){G.toast(mErr(e),true);});
}
function pintarModo(f){var m=$('onbModo');if(!m||!f||!f.interruptor)return;m.hidden=false;
  m.className='onb-modo'+(f.interruptor.envio_habilitado?'':' apagado');
  m.textContent=f.interruptor.envio_habilitado?(f.interruptor.modo==='REAL'?'ENVÍO REAL':'MODO PRUEBA · todo a info@'):'ENVÍO APAGADO';}
function fichaHtml(f){
  var o=f.onboarding,p=f.puede||{},e=EST_ONB[o.estado]||[o.estado,'gris'],nm=f.nombres||{};
  var h='<div class="det-cab"><div class="gc-kicker">'+esc(o.cotizacion)+' · '+esc(o.plan||'')+'</div><h2>'+esc(o.razon_social)+'</h2>'+chip(e[0],e[1])+'</div>';
  h+='<section><h4>Ficha</h4><p>Inicio del servicio: <b>'+G.fFecha(o.fecha_inicio)+'</b>'+(o.rut?' · RUT '+esc(o.rut):' · sin RUT todavía')+(o.mensual_uf!=null?' · '+esc(Number(o.mensual_uf).toLocaleString('es-CL',{minimumFractionDigits:2}))+' UF/mes exento de IVA':'')+'</p>'
    +'<p class="t3">Términos '+esc(o.terminos_version)+' · Analista contable: '+esc(nm[o.analista_contable_usuario_id]||'por asignar')+'</p></section>';
  if(p.gestionar&&o.contacto){var c=o.contacto;
    h+='<section><h4>Contacto (se muestra al cliente para confirmar)</h4><p>'+esc(c.nombre||'—')+' · '+esc(c.email||'sin correo')+' · '+esc(c.telefono||c.whatsapp||'sin teléfono')+'</p>'
      +'<button class="btn chico sec" data-act="contacto">Editar o marcar confirmado</button></section>';}
  if(f.proporcional){var k=f.proporcional;
    h+='<section><h4>Pago inicial proporcional</h4><p><b>'+esc(String(k.monto_uf).replace('.',','))+' UF</b> · '+esc(k.dias)+' de '+esc(k.dias_mes)+' días (desde el '+G.fFecha(k.fecha_inicio)+', incluido)'
      +(k.monto_clp!=null?' · '+G.clp(k.monto_clp)+' con UF '+esc(k.uf_valor):' · UF del día por registrar')+'</p><p class="t3">Factura aparte al iniciar. La mensual regular parte el '+G.fFecha(k.primera_factura_regular)+' (período F1a '+esc(k.primer_periodo_f1a_regular)+').</p>'
      +(p.factura_inicial?'<button class="btn chico sec" data-act="uf">Registrar UF del día</button>':'')+'</section>';}
  h+='<section><h4>Lo que necesitamos (solo se omite lo que tiene evidencia)</h4>';
  (f.requerimientos||[]).forEach(function(r){var er=EST_REQ[r.estado]||[r.estado,'gris'];
    h+='<div class="onb-req"><div class="q"><b>'+esc(REQ[r.codigo]||r.codigo)+'</b><small>'+(r.estado==='COMPLETO'?esc(EVID[r.evidencia&&r.evidencia.tipo]||'')+' · '+esc(r.evidencia&&r.evidencia.detalle||''):r.estado==='NO_APLICA'?esc(r.motivo||''):'Va en la carta de bienvenida')+'</small></div>'
      +chip(er[0],er[1])+(r.puede_marcar?' <button class="btn chico sec" data-act="marcar" data-c="'+esc(r.codigo)+'">Marcar</button>':'')+'</div>';});
  h+='</section>';
  h+='<section><h4>Correos al cliente</h4><div class="acciones">'
    +(p.enviar_bienvenida?'<button class="btn" data-act="preparar" data-t="BIENVENIDA_UNICO">'+G.I('correo')+' Enviar bienvenida</button>':'')
    +(p.gestionar&&o.rut?'<button class="btn sec" data-act="preparar" data-t="CLAVE_SII_LLAMADA">Correo de la clave SII</button>':'')
    +(p.registrar_incidente?'<button class="btn peligro" data-act="incidente">El cliente mandó su clave por correo</button>':'')+'</div>';
  (f.correos||[]).slice().reverse().forEach(function(x){
    h+='<div class="onb-req"><div class="q"><b>'+esc(TIPO_CORREO[x.tipo]||x.tipo)+' · '+esc(x.modo)+'</b><small>'+esc(EST_CORREO[x.estado]||x.estado)+' · a '+esc(x.destinatario_envio)+(x.enviado_at?' · '+esc(G.fHora(x.enviado_at)):'')+(x.error?' · '+esc(x.error):'')+'</small></div>'
      +(x.html_sha256?'<button class="btn chico sec" data-act="evidencia" data-id="'+esc(x.id)+'">Evidencia</button>':'')
      +(x.estado==='INCIERTO'&&p.resolver_incierto?' <button class="btn chico" data-act="incierto" data-id="'+esc(x.id)+'">Resolver</button>':'')
      +(x.estado==='ENVIADO'&&p.reenviar?' <button class="btn chico sec" data-act="reenviar" data-id="'+esc(x.id)+'" data-t="'+esc(x.tipo)+'">Reenviar</button>':'')+'</div>';});
  h+='</section>';
  if(p.clave_por_llamada)h+='<section><h4>Clave SII (transitorio hasta el enlace seguro)</h4><p class="t3">Recíbela por llamada o videollamada, guárdala con «Guardar clave» en la ficha del cliente y luego registra aquí que quedó en la bóveda. Nunca la escribas en otro lugar.</p><button class="btn chico sec" data-act="clave">Ya la guardé en la bóveda</button></section>';
  if(p.master)h+='<section><h4>Master</h4><div class="acciones"><button class="btn chico sec" data-act="interruptor">'+(f.interruptor&&f.interruptor.envio_habilitado?'Apagar el envío':'Encender el envío (PRUEBA)')+'</button><button class="btn chico peligro" data-act="anular">Anular onboarding</button></div></section>';
  return h;
}

/* ── Vista previa y envío (lo que se ve = lo que sale) ── */
function preparar(tipo,opciones){
  var pedir=tipo==='BIENVENIDA_UNICO'&&!opciones?G.modal({titulo:'Enviar bienvenida',ok:'Ver vista previa',
      html:'<p>Gestoor arma el correo breve y la <b>carta de bienvenida en PDF</b> desde la propuesta aceptada. Solo van los requerimientos que faltan.</p>'
        +'<label class="campo"><span>Requerimiento especial (opcional, máx. 500)</span><textarea id="onbEsp" maxlength="500" placeholder="Ej.: el contrato de arriendo vigente del local"></textarea></label><div class="onb-cuenta" id="onbEspN">0 / 500</div>'
        +'<p class="t3">No escribas claves, contraseñas, PIN ni enlaces: el servidor lo rechaza.</p>',
      alAbrir:function(m){var t=m.querySelector('#onbEsp');t.addEventListener('input',function(){m.querySelector('#onbEspN').textContent=t.value.length+' / 500';});},
      alAceptar:function(m){var v=m.querySelector('#onbEsp').value.trim();return vistaPrevia(tipo,v?{texto_especial:v}:{});}})
    :vistaPrevia(tipo,opciones||{}).catch(function(e){G.toast(e.message,true);});
  return pedir;
}
function vistaPrevia(tipo,op){
  return edge({accion:'preparar',onboarding_id:Number(S.ficha.onboarding.id),tipo:tipo,opciones:op}).then(function(r){
    if(r.error)throw new Error(r.error+': '+(ERR[cod(r.error)]||''));
    setTimeout(function(){mostrarPrevia(r,tipo);},0);return true;
  });
}
function mostrarPrevia(r,tipo){
  var url=r.pdf_base64?pdfUrl(r.pdf_base64):null;
  var omit=(r.omitidos||[]).map(function(x){return '<li>'+esc(REQ[x.codigo]||x.codigo)+' — '+esc(EVID[x.motivo]||x.motivo)+(x.detalle?' ('+esc(x.detalle)+')':'')+'</li>';}).join('');
  var m=G.modal({titulo:'Vista previa · '+(TIPO_CORREO[tipo]||'correo al cliente'),ok:'Confirmar y enviar',okClase:'verde',
    html:'<p><b>De:</b> Contadoor ‹'+esc(r.remitente)+'› · <b>Responder a:</b> '+esc(r.responder_a)+'<br><b>Para:</b> '+esc(r.destinatario_envio)
        +(r.modo==='PRUEBA'?' <span class="estado ambar">PRUEBA · en producción iría a '+esc(r.destinatario_real)+'</span>':'')+'<br><b>Asunto:</b> '+esc(r.asunto)+'</p>'
      +(r.envio_habilitado?'':'<div class="aviso ambar">El envío está APAGADO: puedes revisar, pero no saldrá hasta que el Master lo encienda.</div>')
      +'<div class="onb-prev"><div><h5>Correo</h5><iframe sandbox="" referrerpolicy="no-referrer" title="Correo" id="onbIfr"></iframe></div>'
      +(url?'<div><h5>Carta adjunta · '+esc(r.pdf_nombre)+'</h5><iframe title="Carta PDF" src="'+esc(url)+'"></iframe></div>':'')+'</div>'
      +(omit?'<p style="margin-top:10px"><b>Se omitió (con evidencia):</b></p><ul class="onb-lista">'+omit+'</ul>':'')
      +'<p class="onb-huella">Huella: '+esc(r.huella)+'</p>'
      +'<label class="chk"><input type="checkbox" id="onbRev"> Revisé los datos y el destinatario</label>',
    alAbrir:function(mm){var f=mm.querySelector('#onbIfr');if(f)f.srcdoc=r.html;},
    alAceptar:function(mm){
      if(!mm.querySelector('#onbRev').checked)throw new Error(ERR.REVISION_OBLIGATORIA);
      return edge({accion:'enviar',correo_id:Number(r.correo_id),huella:r.huella,revisado:true}).then(function(x){
        if(url)URL.revokeObjectURL(url);
        if(x.estado==='ENVIADO'){G.toast(x.repetido?'Ya estaba enviado.':'Enviado a '+r.destinatario_envio+'.');}
        else if(x.estado==='INCIERTO'){G.toast('INCIERTO: no se sabe si salió. No se reenvía solo; el Master lo revisa.',true);}
        else G.toast((ERR[cod(x.codigo)]||x.codigo||'No salió')+'',true);
        abrirFicha(S.ficha.onboarding.id);return true;
      });
    }});
  m.classList.add('gc-modal-ancho');m.style.width='min(1100px,96vw)';
}
function evidencia(id){
  return edge({accion:'evidencia',correo_id:Number(id)}).then(function(r){
    if(r.error){G.toast(ERR[cod(r.error)]||r.error,true);return;}
    var url=r.pdf_base64?pdfUrl(r.pdf_base64):null;
    var m=G.modal({titulo:'Evidencia del envío',ok:false,cancelar:'Cerrar',html:'<p class="onb-huella">Huella verificada: '+esc(r.huella)+' · se conserva hasta '+G.fFecha(r.retener_hasta)+'</p>'
      +'<div class="onb-prev"><div><h5>Correo</h5><iframe sandbox="" id="onbEv" title="Correo enviado"></iframe></div>'+(url?'<div><h5>'+esc(r.pdf_nombre)+'</h5><iframe title="Carta" src="'+esc(url)+'"></iframe></div>':'')+'</div>',
      alAbrir:function(mm){mm.querySelector('#onbEv').srcdoc=r.html;}});
    m.style.width='min(1100px,96vw)';
  }).catch(function(e){G.toast(mErr(e),true);});
}

/* ── Acciones ── */
function rpc(fn,args,msg){return A.rpc(fn,args).then(function(r){if(msg)G.toast(msg);abrirFicha(S.ficha.onboarding.id);cargar();return r;});}
function accion(a,b){
  var o=S.ficha&&S.ficha.onboarding;if(!o)return;var id=Number(o.id);
  if(a==='preparar')preparar(b.getAttribute('data-t'));
  else if(a==='evidencia')evidencia(b.getAttribute('data-id'));
  else if(a==='marcar'){var c=b.getAttribute('data-c');
    G.modal({titulo:'Marcar · '+(REQ[c]||c),ok:'Guardar',html:'<label class="campo"><span>Estado</span><select id="onbEst"><option value="COMPLETO">Completo</option><option value="NO_APLICA">No aplica</option><option value="PENDIENTE">Pendiente</option></select></label>'
      +'<label class="campo"><span>Evidencia (si está completo)</span><select id="onbEv"><option value="DOCUMENTO_RECIBIDO">Documento recibido</option><option value="CONFIRMADO_POR_CLIENTE">Confirmado por el cliente</option><option value="DATO_VERIFICADO_EN_GESTOOR">Dato verificado en Gestoor</option></select></label>'
      +'<label class="campo"><span>Detalle o motivo (5 a 300 letras; sin datos sensibles)</span><input id="onbDet" maxlength="300"></label>',
      alAceptar:function(m){var est=m.querySelector('#onbEst').value,det=m.querySelector('#onbDet').value.trim();
        return rpc('onb_requerimiento_marcar',{p_id:id,p_codigo:c,p_estado:est,p_evidencia:est==='COMPLETO'?{tipo:m.querySelector('#onbEv').value,detalle:det}:null,p_motivo:est==='NO_APLICA'?det:null},'Guardado.').catch(function(e){throw new Error(mErr(e));});}});}
  else if(a==='contacto'){var c2=o.contacto||{};
    G.modal({titulo:'Datos de contacto',ok:'Guardar',html:'<div class="campos2"><label class="campo"><span>Nombre</span><input id="cN" maxlength="120" value="'+esc(c2.nombre||'')+'"></label><label class="campo"><span>Correo</span><input id="cE" type="email" maxlength="120" value="'+esc(c2.email||'')+'"></label>'
      +'<label class="campo"><span>Teléfono</span><input id="cT" maxlength="40" value="'+esc(c2.telefono||'')+'"></label><label class="campo"><span>WhatsApp</span><input id="cW" maxlength="40" value="'+esc(c2.whatsapp||'')+'"></label>'
      +'<label class="campo"><span>Quién recibe los reportes</span><input id="cRN" maxlength="120" value="'+esc(c2.reportes_nombre||'')+'"></label><label class="campo"><span>Correo de reportes</span><input id="cRE" type="email" maxlength="120" value="'+esc(c2.reportes_email||'')+'"></label></div>'
      +'<label class="chk"><input type="checkbox" id="cOk"> El cliente ya confirmó estos datos</label><label class="campo"><span>¿Por dónde?</span><select id="cM"><option value="REUNION">Reunión</option><option value="CORREO">Correo</option><option value="WHATSAPP">WhatsApp</option><option value="LLAMADA">Llamada</option></select></label>',
      alAceptar:function(m){var q=function(s){return m.querySelector(s).value.trim()||null;};
        return rpc('onb_contacto_guardar',{p_id:id,p:{nombre:q('#cN'),email:q('#cE'),telefono:q('#cT'),whatsapp:q('#cW'),reportes_nombre:q('#cRN'),reportes_email:q('#cRE'),
          confirmado_por_cliente:m.querySelector('#cOk').checked,medio:m.querySelector('#cM').value}},'Contacto guardado.').catch(function(e){throw new Error(mErr(e));});}});}
  else if(a==='uf')G.modal({titulo:'UF del día de la factura inicial',ok:'Calcular',html:'<div class="campos2"><label class="campo"><span>Fecha de la UF</span><input id="uF" type="date"></label><label class="campo"><span>Valor (2 decimales)</span><input id="uV" inputmode="decimal" placeholder="41252,94"></label></div>'
      +'<label class="campo"><span>Fuente</span><select id="uS"><option value="SII_MANUAL">Tabla oficial del SII</option><option value="PERIODOS_DIA_1">Panel de Control (solo día 1)</option></select></label><label class="campo"><span>Referencia (tabla del SII)</span><input id="uR" value="https://www.sii.cl/valores_y_fechas/uf/uf'+new Date().getFullYear()+'.htm"></label>',
      alAceptar:function(m){var s=m.querySelector('#uS').value;return rpc('onb_factura_inicial_calcular',{p_id:id,p_uf_fecha:m.querySelector('#uF').value,p_uf_valor:Number(m.querySelector('#uV').value.replace(/\./g,'').replace(',','.')),
        p_uf_fuente:s,p_uf_referencia:s==='SII_MANUAL'?m.querySelector('#uR').value.trim():null},'Factura inicial calculada.').catch(function(e){throw new Error(mErr(e));});}});
  else if(a==='incidente')G.modal({titulo:'Clave recibida por un canal no seguro',ok:'Registrar incidente',okClase:'peligro',html:'<p>No la copies, no la reenvíes y elimina el mensaje. Después envía al cliente el aviso para que la cambie en el SII.</p>'
      +'<label class="campo"><span>¿Por dónde llegó?</span><select id="iT"><option value="CLAVE_RECIBIDA_POR_CORREO">Correo</option><option value="CLAVE_RECIBIDA_POR_WHATSAPP">WhatsApp</option></select></label>'
      +'<label class="chk"><input type="checkbox" id="i1"> No la copié</label><label class="chk"><input type="checkbox" id="i2"> No la reenvié</label><label class="chk"><input type="checkbox" id="i3"> Eliminé el mensaje</label>'
      +'<label class="campo"><span>Nota (opcional, sin la clave)</span><input id="iN" maxlength="300"></label>',
      alAceptar:function(m){return A.rpc('onb_incidente_registrar',{p_id:id,p_tipo:m.querySelector('#iT').value,p_nota:m.querySelector('#iN').value.trim()||null,
        p_acciones:{no_copiada:m.querySelector('#i1').checked,no_reenviada:m.querySelector('#i2').checked,mensaje_eliminado:m.querySelector('#i3').checked}})
        .then(function(r){G.toast('Incidente registrado. Ahora envía el aviso al cliente.');setTimeout(function(){vistaPrevia('AVISO_CAMBIO_CLAVE',{incidente_id:r.incidente_id}).catch(function(e){G.toast(e.message,true);});},0);return true;})
        .catch(function(e){throw new Error(mErr(e));});}});
  else if(a==='clave')G.modal({titulo:'Clave SII en la bóveda',ok:'Registrar',html:'<p>Gestoor comprueba que tú guardaste una clave SII de esta empresa en las últimas 2 horas. No se muestra ni se guarda el valor aquí.</p><label class="campo"><span>¿Cómo la recibiste?</span><select id="kM"><option value="LLAMADA">Llamada</option><option value="VIDEOLLAMADA">Videollamada</option></select></label>',
      alAceptar:function(m){return rpc('onb_clave_llamada_registrar',{p_id:id,p_medio:m.querySelector('#kM').value},'Clave registrada en la ficha.').catch(function(e){throw new Error(mErr(e));});}});
  else if(a==='incierto')G.modal({titulo:'Resolver correo incierto',ok:'Guardar',html:'<p>Busca en Enviados de comercial@ la cabecera <b>X-Gestoor-Onb</b> de este correo.</p><label class="campo"><span>Resultado</span><select id="xR"><option value="ENVIADO">Sí salió</option><option value="FALLIDO">No salió</option></select></label><label class="campo"><span>Evidencia (10 a 500 letras)</span><textarea id="xE" maxlength="500"></textarea></label>',
      alAceptar:function(m){return rpc('onb_correo_resolver_incierto',{p_correo:Number(b.getAttribute('data-id')),p_resultado:m.querySelector('#xR').value,p_evidencia:m.querySelector('#xE').value.trim()},'Resuelto.').catch(function(e){throw new Error(mErr(e));});}});
  else if(a==='reenviar')G.modal({titulo:'Reenviar (solo Master)',ok:'Ver vista previa',html:'<label class="campo"><span>Motivo (10 a 300 letras)</span><textarea id="rM" maxlength="300"></textarea></label>',
      alAceptar:function(m){return vistaPrevia(b.getAttribute('data-t'),{reenvio_de:Number(b.getAttribute('data-id')),motivo:m.querySelector('#rM').value.trim()});}});
  else if(a==='interruptor')rpc('onb_interruptor',{p_envio_habilitado:!(S.ficha.interruptor&&S.ficha.interruptor.envio_habilitado)},'Interruptor actualizado.').catch(function(e){G.toast(mErr(e),true);});
  else if(a==='anular')G.modal({titulo:'Anular onboarding',ok:'Anular',okClase:'peligro',html:'<label class="campo"><span>Motivo</span><textarea id="aM" maxlength="500"></textarea></label>',
      alAceptar:function(m){return rpc('onb_anular',{p_id:id,p_motivo:m.querySelector('#aM').value.trim()},'Anulado.').catch(function(e){throw new Error(mErr(e));});}});
}
function abrirNueva(cotId){
  G.modal({titulo:'Abrir onboarding',ok:'Abrir',html:'<p>Se abre la ficha con los requerimientos según el plan aceptado.</p><label class="campo"><span>Fecha de inicio del servicio (opcional; por defecto, el día de aceptación)</span><input id="nF" type="date"></label>'
    +'<label class="campo"><span>Régimen tributario (si lo sabes)</span><select id="nR"><option value="">No lo sé todavía</option><option value="14D3">Pro Pyme General (14 D N° 3)</option><option value="14D8">Pro Pyme Transparente (14 D N° 8)</option><option value="14A">General (14 A)</option><option value="OTRO">Otro</option></select></label>'
    +'<label class="chk"><input type="checkbox" id="nC"> Incluye constitución de empresa (aún sin RUT)</label>',
    alAceptar:function(m){var p={};var f=m.querySelector('#nF').value,r=m.querySelector('#nR').value;if(f)p.fecha_inicio=f;if(r)p.regimen=r;if(m.querySelector('#nC').checked)p.tipo='PLAN_CONSTITUCION';
      return A.rpc('onb_abrir',{p_cotizacion_id:Number(cotId),p:p}).then(function(x){cargar();setTimeout(function(){abrirFicha(x.id);},0);return true;}).catch(function(e){throw new Error(mErr(e));});}});
}

/* ── Eventos ── */
function pintar(root){(root||document).querySelectorAll('[data-gc-ic]').forEach(function(el){el.innerHTML=G.svg(el.getAttribute('data-gc-ic'));el.removeAttribute('data-gc-ic');});}
document.addEventListener('click',function(ev){
  var b=ev.target.closest('[data-act]');if(!b||b.disabled)return;var a=b.getAttribute('data-act');
  if(a==='ficha')abrirFicha(b.getAttribute('data-id'));
  else if(a==='abrir')abrirNueva(b.getAttribute('data-id'));
  else accion(a,b);
});
document.addEventListener('keydown',function(ev){if((ev.key==='Enter'||ev.key===' ')&&ev.target.tagName==='TR'&&ev.target.getAttribute('data-act')==='ficha'){ev.preventDefault();abrirFicha(ev.target.getAttribute('data-id'));}});
function iniciar(){pintar();$('gcDetCerrar').addEventListener('click',G.cerrarDet);$('gcVelo').addEventListener('click',G.cerrarDet);
  // auth.js revela la página solo si onb_yo confirma acceso (RPC_ACCESO_SERVIDOR); cada dato lo decide el servidor con el JWT.
  cargar();}   // sbFetch espera la sesión (supabase.js) y falla cerrado sin ella
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',iniciar);else iniciar();
})();
