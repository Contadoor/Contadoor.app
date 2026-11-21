/* ============================================================
   cotizaciones/seg.js — SEG-1 · "Seguimiento del asistente" en la ficha de la cotización
   Trabajo en equipo: Luciano escribe primero al prospecto (su WhatsApp) y después le da el PASE al asistente IA con una nota.
   El asistente escribe con plantillas aprobadas por Meta (máx. 2, L–V hábil 09–19), conversa si el prospecto responde y avisa
   cada avance en la campana. Luciano puede pausar o retomar ("Ya lo llamé yo") en cualquier momento.
   Conectada SOLO a las RPC de la migración 202611061200 (backend): seg_estado · seg_preparar · seg_iniciar · seg_pausar ·
   seg_reanudar · seg_tomar. La pantalla nunca ve el teléfono completo, el wamid ni el texto de la conversación (está cifrado:
   se lee en la bandeja del asistente).
   ============================================================ */
(function(){
'use strict';
var G=window.GC, esc=G.esc, I=G.I;
var EST={programado:['Programado','lila','🗓️'],esperando:['Enviado · esperando respuesta','ambar','📨'],respondio:['Respondió','verde','💬'],
  derivado:['Respondió · te toca a ti','verde','🙋'],sin_respuesta:['Sin respuesta','gris','📵'],pausado:['En pausa','gris','⏸️'],
  tomado:['Lo tomaste tú','cel','🤝'],detenido:['Detenido','gris','⛔']};
var CAT={quiere_aceptar:'Quiere aceptar la propuesta ✅',negociar:'Quiere conversar el valor 💲',no_interesa:'No le interesa por ahora 🙅',mas_tiempo:'Pide más tiempo ⏳',
  duda:'Tiene dudas ❓',otra:'Respondió (otro tema) 💬',sin_clasificar:'Respondió (revisa la conversación) 💬'};
var MOT={cotizacion_aceptada:'la cotización fue aceptada',cotizacion_rechazada:'la cotización se marcó «No por ahora»',cotizacion_anulada:'la cotización se anuló',
  cotizacion_vencida:'la cotización venció',baja:'el prospecto pidió no recibir mensajes (BAJA)',no_entregado:'WhatsApp no entregó el mensaje',no_enviado:'el primer mensaje no alcanzó a salir',
  telefono_invalido:'el teléfono no es un celular válido',telefono_cambio:'el teléfono cambió',tope_numero:'ese número ya recibió 2 mensajes de seguimiento en 14 días',
  sin_respuesta_3_habiles:'no contestó en 3 días hábiles',sin_consentimiento:'falta el consentimiento'};
var NO_PUEDE={cotizacion_no_enviada:'El pase al asistente se da cuando la cotización está «Enviada» y vigente.',es_cliente:'El seguimiento por el asistente es para prospectos (no clientes de la cartera).',
  sin_consentimiento:'El asistente solo escribe a prospectos que aceptaron ser contactados al agendar en agenda.contadoor.cl. Este prospecto no tiene ese registro: hazle el seguimiento tú.',
  sin_celular:'El prospecto no tiene un celular chileno registrado (+56 9…). Agrégalo en Prospectos.',ya_en_curso:'Ya hay un seguimiento en curso.',ya_realizado:'El asistente ya hizo el seguimiento de esta cotización (máximo una vez).'};
var MSG={programado:'programado',enviando:'enviando',enviado:'enviado ✓',fallido:'no entregado',incierto:'sin confirmación de entrega',cancelado:'cancelado',vencido:'no alcanzó a salir'};
var ERR={SEG_SIN_CONSENTIMIENTO:'Este prospecto no tiene registrado el consentimiento de la agenda: el asistente no puede escribirle.',CAMPO_NO_PERMITIDO:'Dato no permitido en el pase.',SEG_TEMA_INVALIDO:'El tema va sin precios (3 a 60 letras).',SEG_NOTA_INVALIDA:'La nota va de 3 a 500 letras.',
  TEXTO_NO_PERMITIDO:'Usa «nuestros servicios» en vez de «honorarios».',TEXTO_CON_CREDENCIAL:'No escribas claves ni contraseñas.',SEG_YA_EN_CURSO:'Ya hay un seguimiento en curso.',
  SEG_YA_REALIZADO:'El asistente ya hizo el seguimiento de esta cotización.',SEG_SIN_CELULAR:'El prospecto no tiene un celular chileno válido.',NO_ENVIADA:'La cotización no está enviada y vigente.',
  SEG_NO_PAUSABLE:'Este seguimiento ya no se puede pausar.',SEG_NO_PAUSADO:'El seguimiento no está en pausa.',SEG_SIN_MENSAJES:'Ya salieron los 2 mensajes del seguimiento.',
  SEG_YA_TERMINADO:'El seguimiento ya terminó.',SEG_ES_CLIENTE:'El seguimiento por el asistente es para prospectos.',SEG_DIAS_INVALIDOS:'Elige entre 1 y 3 días hábiles.',
  SIN_PERMISO:'No tienes acceso a Cotizaciones.',NO_EXISTE:'La cotización no existe o no es tuya.'};
var CTX=null;   // {f, rpc, mErr, recargar}

function hora(iso){return iso?G.fHora(iso):'';}
/* dd-mm-aaaa en hora de Chile (fecha en que el prospecto aceptó el contacto al agendar). */
function fechaCL(iso){var d=new Date(iso);if(!iso||isNaN(d))return '';var p={};new Intl.DateTimeFormat('es-CL',{timeZone:'America/Santiago',day:'2-digit',month:'2-digit',year:'numeric'}).formatToParts(d).forEach(function(x){p[x.type]=x.value;});return p.day+'-'+p.month+'-'+p.year;}
function consLinea(pr){return pr&&pr.consentimiento_agenda?'<p class="seg-cons">'+I('check','ic-ver')+'<span>Aceptó contacto al agendar el <b>'+esc(fechaCL(pr.consentimiento_agenda))+'</b> (agenda.contadoor.cl).</span></p>':'';}
function html(){return '<section id="segBox" class="seg-box"><h4>🤖 Seguimiento del asistente</h4><div class="aviso lila"><span class="gc-spin"></span>Cargando…</div></section>';}

function pintar(st){
  var box=document.getElementById('segBox');if(!box)return;
  var s=st.seguimiento,pr=st.preparar||{},h='<h4>🤖 Seguimiento del asistente</h4>';
  if(st.habilitado===false||pr.habilitado===false)h+='<div class="aviso ambar">'+I('alerta','ic-amb')+'<span><b>El asistente aún no está encendido para seguimientos.</b> Puedes dejar el pase listo: no saldrá ningún mensaje mientras esté apagado.</span></div>';
  else if(pr.plantillas_aprobadas===false)h+='<div class="aviso ambar">'+I('alerta','ic-amb')+'<span><b>Las plantillas aún no están aprobadas por Meta.</b> No saldrá ningún mensaje hasta que se aprueben.</span></div>';
  if(!s){
    if(pr.puede)h+='<p class="t2">Cuando ya hayas conversado con el prospecto, dale el pase: el asistente le escribirá por WhatsApp (+56 9 4675 4390) en '+(pr.primer_envio_estimado?'<b>'+esc(hora(pr.primer_envio_estimado))+'</b>':'2 días hábiles')+', aclarará dudas y te avisará cuando conteste (o si no contesta).</p>'
      +consLinea(pr)+'<div class="acciones"><button type="button" class="btn" data-seg="pasar">'+I('enviar')+'Pasar seguimiento al asistente</button></div>';
    else h+='<div class="acciones"><button type="button" class="btn" disabled aria-disabled="true" title="'+esc(NO_PUEDE[pr.motivo]||'')+'">'+I('enviar')+'Pasar seguimiento al asistente</button></div>'
      +'<p class="t3">'+esc(NO_PUEDE[pr.motivo]||'Por ahora no se puede dar el pase.')+'</p>';
    box.innerHTML=h;return;
  }
  var e=EST[s.estado]||[s.estado,'gris',''];
  h+='<div class="seg-cab"><span class="estado '+e[1]+'">'+e[2]+' '+esc(e[0])+'</span>'+(s.categoria?'<span class="seg-cat">'+esc(CAT[s.categoria]||s.categoria)+'</span>':'')+'</div>';
  if(s.proxima_accion)h+='<p class="seg-prox"><b>Próxima acción:</b> '+esc(s.proxima_accion)+'</p>';
  if(s.motivo_fin&&(s.estado==='detenido'||s.estado==='sin_respuesta'))h+='<p class="t3">Terminó porque '+esc(MOT[s.motivo_fin]||s.motivo_fin)+(s.finalizado_at?' · '+esc(hora(s.finalizado_at)):'')+'.</p>';
  h+='<ul class="gc-tl seg-tl">';
  h+='<li><b>Pase al asistente</b><small>'+esc(hora(s.iniciado_at))+(s.iniciado_por?' · '+esc(s.iniciado_por):'')+' · tema: «'+esc(s.tema)+'»</small></li>';
  (st.mensajes||[]).forEach(function(m){
    h+='<li><b>'+(m.n===1?'1.er mensaje':'2.º y último mensaje')+' · '+esc(MSG[m.estado]||m.estado)+'</b><small>'+esc(hora(m.enviado_at||m.programado_para))+(m.motivo&&m.estado!=='enviado'?' · '+esc(m.motivo.replace(/_/g,' ')):'')+'</small></li>';});
  if(s.respondio_at)h+='<li><b>Respondió'+(s.categoria?' · '+esc(CAT[s.categoria]||s.categoria):'')+'</b><small>'+esc(hora(s.categoria_at||s.respondio_at))+'</small></li>';
  if(s.tomado_at)h+='<li><b>Lo tomaste tú</b><small>'+esc(hora(s.tomado_at))+'</small></li>';
  h+='</ul>';
  if(s.nota)h+='<p class="t2 seg-nota"><b>Tu nota para el asistente:</b> «'+esc(s.nota)+'»</p>';
  var p=st.puede||{},b='';
  if(p.pausar)b+='<button type="button" class="btn sec" data-seg="pausar">⏸️ Pausar seguimiento</button>';
  if(p.reanudar)b+='<button type="button" class="btn sec" data-seg="reanudar">▶️ Reanudar</button>';
  if(p.tomar)b+='<button type="button" class="btn" data-seg="tomar">🤝 Ya lo llamé yo / Retomar</button>';
  if(s.con_conversacion&&s.conversacion_id&&/^[0-9a-f-]{36}$/i.test(s.conversacion_id))b+='<a class="btn chico sec" href="../asistente/?c='+encodeURIComponent(s.conversacion_id)+'">Ver conversación en la bandeja →</a>';
  if(!s||['sin_respuesta','detenido','tomado'].indexOf(s.estado)>=0){if(pr.puede)b+='<button type="button" class="btn sec" data-seg="pasar">Dar un nuevo pase</button>';}
  if(b)h+='<div class="acciones">'+b+'</div>';
  h+='<p class="nota">El asistente nunca acepta la propuesta ni cambia precios: si el prospecto quiere aceptar o negociar, la conversación pasa a la bandeja y te avisa al celular.</p>';
  box.innerHTML=h;
}

function cargar(){
  if(!CTX)return;var id=Number(CTX.f.cotizacion.id);
  CTX.rpc('seg_estado',{p_cotizacion_id:id}).then(function(st){if(CTX&&Number(CTX.f.cotizacion.id)===id)pintar(st||{});})
    .catch(function(e){var box=document.getElementById('segBox');if(box)box.innerHTML='<h4>🤖 Seguimiento del asistente</h4><div class="aviso rojo">'+I('alerta','ic-roj')+'<span>'+esc(msg(e))+'</span></div>';});
}
function msg(e){var t=String(e&&e.message||e||'');for(var k in ERR)if(t.indexOf(k)>=0)return ERR[k];return CTX&&CTX.mErr?CTX.mErr(e):t;}
function correr(fn,args,ok){return CTX.rpc(fn,args).then(function(r){G.toast(typeof ok==='function'?ok(r):ok);cargar();return true;}).catch(function(e){throw new Error(msg(e));});}

function abrirPase(){
  var id=Number(CTX.f.cotizacion.id);
  CTX.rpc('seg_preparar',{p_cotizacion_id:id}).then(function(pr){
    if(!pr||!pr.puede){G.toast(NO_PUEDE[pr&&pr.motivo]||'Por ahora no se puede dar el pase.',true);return;}
    G.modal({titulo:'Pasar seguimiento al asistente',ok:'Dar el pase',
      html:'<p>El asistente le escribirá a <b>'+esc(pr.telefono)+'</b> desde el WhatsApp de Contadoor con una plantilla aprobada por Meta (sin precios). Si no contesta, manda <b>un</b> recordatorio 3 días hábiles después y te avisa.</p>'
        +'<label class="campo"><span>Tema de la propuesta (va en el mensaje, sin precios)</span><input id="segTema" maxlength="60" value="'+esc(pr.tema_sugerido||'')+'"></label>'
        +'<p class="t3" style="font-size:12px;margin:-4px 0 8px">Se verá así: «Luciano te envió la propuesta de <i id="segVista">'+esc(pr.tema_sugerido||'')+'</i>…»</p>'
        +'<label class="campo"><span>Nota para el asistente (qué hablaste con el prospecto; él no la ve)</span><textarea id="segNota" maxlength="500" placeholder="Ej.: le mandé la propuesta por WhatsApp, tiene dudas de la empresa de transporte"></textarea></label>'
        +'<label class="campo"><span>¿Cuándo escribe el asistente?</span><select id="segDias"><option value="1">En 1 día hábil</option><option value="2" selected>En 2 días hábiles (recomendado)</option><option value="3">En 3 días hábiles</option></select></label>'
        +consLinea(pr),
      alAbrir:function(m){var t=m.querySelector('#segTema'),v=m.querySelector('#segVista');t.addEventListener('input',function(){v.textContent=t.value;});},
      alAceptar:function(m){
        var tema=m.querySelector('#segTema').value.trim(),nota=m.querySelector('#segNota').value.trim();
        if(tema.length<3||/[$]|\d{3,}|(^|[^a-z])uf([^a-z]|$)/i.test(tema))throw new Error(ERR.SEG_TEMA_INVALIDO);
        if(nota&&nota.length<3)throw new Error(ERR.SEG_NOTA_INVALIDA);
        return correr('seg_iniciar',{p_cotizacion_id:id,p:{tema:tema,nota:nota||null,dias_espera:Number(m.querySelector('#segDias').value)}},
          function(r){return 'Listo: el asistente escribirá el '+hora(r&&r.programado_para)+(r&&r.habilitado===false?' (cuando lo enciendan)':'')+'.';});
      }});
  }).catch(function(e){G.toast(msg(e),true);});
}

function accion(a){
  if(!CTX)return;
  var st=document.getElementById('segBox');if(!st)return;
  if(a==='pasar')return abrirPase();
  CTX.rpc('seg_estado',{p_cotizacion_id:Number(CTX.f.cotizacion.id)}).then(function(x){
    var s=x&&x.seguimiento;if(!s)return;
    if(a==='pausar')G.modal({titulo:'Pausar seguimiento',ok:'Pausar',html:'<p>No saldrá ningún mensaje más hasta que lo reanudes. Si el prospecto escribe, el asistente igual le responde.</p>',
      alAceptar:function(){return correr('seg_pausar',{p_id:s.id},'Seguimiento en pausa.');}});
    else if(a==='reanudar')G.modal({titulo:'Reanudar seguimiento',ok:'Reanudar',html:'<p>El mensaje que falta se programa para el próximo día hábil (09:30–18:00).</p>',
      alAceptar:function(){return correr('seg_reanudar',{p_id:s.id},function(r){return 'Reanudado: escribe el '+hora(r&&r.programado_para)+'.';});}});
    else if(a==='tomar')G.modal({titulo:'Ya lo llamé yo / Retomar',ok:'Lo tomo yo',html:'<p>El asistente deja este caso: no sale ningún mensaje más y, si el prospecto escribe, la conversación queda en la <b>bandeja del asistente</b> para ti.</p>',
      alAceptar:function(){return correr('seg_tomar',{p_id:s.id},'Listo: el seguimiento es tuyo.');}});
  }).catch(function(e){G.toast(msg(e),true);});
}
document.addEventListener('click',function(ev){var b=ev.target.closest('[data-seg]');if(!b||b.disabled)return;accion(b.getAttribute('data-seg'));});

window.COT_SEG={
  html:html,
  /* cot.js lo llama después de pintar la ficha: f = ficha K1, rpc = capa de datos (real o demo), mErr = mensajes de error de K1. */
  montar:function(f,rpc,mErr){CTX={f:f,rpc:rpc,mErr:mErr};cargar();}
};
})();
