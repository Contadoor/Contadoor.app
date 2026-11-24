/* ============================================================
   prospectos/ventas-control.js — VENTAS-CONTROL en la ficha del prospecto (CRM)
   Regla de oro: todo prospecto abierto tiene próxima acción con fecha. Aquí:
     · Próxima acción (obligatoria) · «Registrar contacto» (tacha la tarea) · tareas del camino fijo con el texto sugerido para copiar
     · aviso «ya se contactó hoy» (manual o automático: agenda / asistente) · línea de tiempo ÚNICA · sugerencia «Perdido · no responde».
   Datos: SOLO RPC con el JWT (ComDatos.rpc): com_vc_ficha, com_proxima_guardar, com_contacto_registrar, com_tarea_omitir.
   Nada se envía al prospecto desde aquí: los textos se COPIAN y Benedicta los manda por su WhatsApp / correo.
   Todo texto de la base pasa por esc().
   ============================================================ */
(function(root){
'use strict';

var CANALES=[['whatsapp','WhatsApp','chat','c-ver'],['llamada','Llamada','telefono','c-cel'],['correo','Correo','correo','c-ama'],['reunion','Reunión','calendario','c-lil'],['otro','Otro','lapiz','c-azu']];
var RESULTADOS=[['enviado','Lo envié / dejé mensaje'],['respondio','Respondió / conversamos'],['sin_respuesta','No contestó']];
var MOTIVOS=[['precio','Precio'],['eligio_otro','Ya tiene contador'],['no_responde','No responde'],['no_calza','No califica'],['otro','Otro']];
var MSJ={FALTA_PROXIMA_ACCION:'Falta la próxima acción con fecha: todo prospecto abierto la necesita.',PROXIMA_INCOMPLETA:'Escribe la próxima acción y su fecha (las dos).',
  PROXIMA_INVALIDA:'La próxima acción debe tener entre 3 y 200 letras.',FECHA_INVALIDA:'La fecha debe ser de hoy en adelante (máximo un año).',
  YA_CONTACTADO_HOY:'Ya hubo un contacto hoy con este prospecto.',FALTA_RESUMEN:'Escribe en una línea qué pasó (mínimo 3 letras).',RESUMEN_MUY_LARGO:'El resumen supera los 1.000 caracteres.',
  TAREA_NO_VALIDA:'Esa tarea ya no está pendiente. Recargué la ficha.',FALTA_MOTIVO:'Escribe por qué se omite (mínimo 3 letras).',ETAPA_CERRADA:'Este prospecto ya está cerrado: no lleva próxima acción.',
  FALTA_MOTIVO_PERDIDA:'Elige el motivo de pérdida.',CANAL_INVALIDO:'Elige el canal.',RESULTADO_INVALIDO:'Elige el resultado.',SEMANA_INVALIDA:'Semana fuera de rango.'};
var TIPO_TXT={contacto:'Contacto',origen:'Llegó',reserva_agendada:'Agendó la reunión',etapa:'Cambio de etapa',perdido:'Marcado como Perdido',reserva:'Reunión',
  bitacora_abierta:'Bitácora abierta',bitacora_cerrada:'Bitácora cerrada',responsable_tomado:'Tomó el prospecto',lead_manual:'Creado a mano',tel_corregido:'Teléfono corregido',
  tarea_omitida:'Tarea omitida',agenda_confirmacion:'Correo de confirmación (agenda)',agenda_rec24:'Correo recordatorio 24 h (agenda)',agenda_rec2:'Correo recordatorio (agenda)',
  agenda_wa_confirmacion:'WhatsApp de confirmación (agenda)',agenda_wa_recordatorio:'WhatsApp recordatorio (agenda)',agenda_wa_ultimo_aviso:'WhatsApp «entrar a la reunión» (agenda)',
  agenda_wa_resp_confirmo:'WhatsApp: respuesta a «confirmo» (agenda)',agenda_wa_resp_reagendar:'WhatsApp: respuesta a «reagendar» (agenda)',agenda_wa_resp_no_vigente:'WhatsApp: respuesta automática (agenda)',
  asistente_seguimiento:'WhatsApp de seguimiento (asistente IA)',asistente_humano:'WhatsApp del equipo (bandeja)',asistente_material:'Material enviado (asistente IA)',asistente_respuesta_ia:'Respuesta del asistente IA'};
var ETAPA_TXT={nuevo:'Nuevo',agendado:'Reunión agendada',reunion_realizada:'Reunión hecha',no_asistio:'No asistió',propuesta:'Propuesta enviada',seguimiento:'Seguimiento',
  cliente:'Ganado',descartado:'Perdido',no_calificado:'No calificado',emprendedor_solicitado:'Cumplimiento solicitado'};
var CANAL_IC={whatsapp:['chat','c-ver'],llamada:['telefono','c-cel'],correo:['correo','c-ama'],reunion:['calendario','c-lil'],otro:['lapiz','c-azu']};

function ic(n,cls){return '<i class="ic '+(cls||'c-lil')+'" aria-hidden="true">'+(root.gIcon?root.gIcon(n):'')+'</i>';}
function mensaje(e){var m=String(e&&e.message||e||'');for(var k in MSJ)if(m.indexOf(k)>=0)return MSJ[k];
  var S=root.ComSimple&&root.ComSimple.MSJ||{};for(var j in S)if(m.indexOf(j)>=0)return S[j];return root.ComDatos?root.ComDatos.mensaje(e):m;}
function primerNombre(n){return String(n||'').trim().split(/\s+/)[0]||'';}
// Completa los textos sugeridos (la base guarda {nombre} {empresa} {yo} {dato}): nunca se envía nada solo.
function completar(txt,p,yo){
  var dato=p&&p.dolor?String(p.dolor).replace(/[.\s]+$/,'').replace(/^./,function(c){return c.toLowerCase();}):'[escribe aquí un dato de su diagnóstico]';
  return String(txt||'').replace(/\{nombre\}/g,primerNombre(p&&p.nombre)||'').replace(/\{empresa\}/g,(p&&p.empresa)||'tu empresa')
    .replace(/\{yo\}/g,primerNombre(yo&&yo.nombre)||'Contadoor').replace(/\{dato\}/g,dato).replace(/Hola \s*👋/,'Hola 👋').replace(/Hola ,/,'Hola,');
}
function etiquetaTipo(h){
  if(h.tipo==='etapa'&&h.detalle)return 'Etapa: '+(ETAPA_TXT[h.detalle.de]||h.detalle.de||'—')+' → '+(ETAPA_TXT[h.detalle.a]||h.detalle.a||'—');
  if(h.tipo==='contacto'){var c=CANALES.filter(function(x){return x[0]===h.canal;})[0],r=RESULTADOS.filter(function(x){return x[0]===h.resultado;})[0];return (c?c[1]:'Contacto')+' · '+(r?r[1]:'');}
  if(h.tipo==='perdido'&&h.detalle){var m=MOTIVOS.filter(function(x){return x[0]===h.detalle.motivo;})[0];return 'Perdido · '+(m?m[1]:(h.detalle.motivo||'sin motivo'));}
  if(h.tipo==='reserva'&&h.detalle)return 'Reunión: '+({realizada:'realizada',no_asistio:'no asistió',cancelada:'cancelada'}[h.detalle.estado]||h.detalle.estado||'');
  if(/^agenda_/.test(h.tipo)&&!TIPO_TXT[h.tipo])return (h.canal==='correo'?'Correo':'WhatsApp')+' automático de la agenda';
  return TIPO_TXT[h.tipo]||h.tipo;
}
function icHist(h){
  if(h.fuente==='automatico')return h.canal==='correo'?ic('correo','c-ama'):h.canal==='whatsapp'?ic('chat','c-ver'):ic('calendario','c-cel');
  if(h.tipo==='contacto'){var x=CANAL_IC[h.canal]||CANAL_IC.otro;return ic(x[0],x[1]);}
  if(h.tipo==='perdido')return ic('alerta','c-roj');
  if(h.tipo==='etapa')return ic('repetir','c-lil');
  return ic('reloj','c-azu');
}
// Lo que dice el aviso «ya se contactó hoy».
function avisoHoy(f,D){
  var ch=f&&f.contacto_hoy;if(!ch||!ch.ya_contactado)return '';
  var partes=(ch.manual||[]).map(function(k){var c=CANALES.filter(function(x){return x[0]===k.canal;})[0];return D.hora(k.t)+' · '+(c?c[1]:k.canal)+(k.por?' ('+primerNombre(k.por)+')':'');})
    .concat((ch.automatico||[]).map(function(a){return D.hora(a.t)+' · '+(TIPO_TXT[a.tipo]||'mensaje automático');}));
  return '<div class="vc-hoy" role="status">'+ic('alerta','c-amb')+'<div><b>Ya se contactó hoy.</b> Máximo un contacto por día para no pisarnos con los mensajes automáticos.<br><span>'+partes.map(D.esc).join(' · ')+'</span></div></div>';
}

root.ComVentas={CANALES:CANALES,RESULTADOS:RESULTADOS,MOTIVOS:MOTIVOS,MSJ:MSJ,completar:completar,etiquetaTipo:etiquetaTipo,mensaje:mensaje};
if(typeof document==='undefined'||!root.ComDatos)return;
var D=root.ComDatos, esc=D.esc;
var FICHA={}, CTX=null;   // FICHA[leadId] = respuesta de com_vc_ficha; CTX = {p, yo, alGuardar, moverPerdido, cont}

function cont(){return CTX&&document.getElementById(CTX.cont);}
// Monta el bloque en el contenedor indicado y carga la ficha de ventas.
function montar(o){
  CTX=o;var el=cont();if(!el)return;
  var f=FICHA[o.p.id];el.innerHTML=f?html(f):'<div class="nd">Cargando seguimiento…</div>';enlazar();
  if(!f||o.refrescar)cargar(o.p.id);
}
function cargar(id){
  return D.rpc('com_vc_ficha',{p_id:Number(id)}).then(function(f){FICHA[id]=f;if(CTX&&Number(CTX.p.id)===Number(id)){var el=cont();if(el){el.innerHTML=html(f);enlazar();}}})
    .catch(function(e){var el=cont();if(el&&CTX&&Number(CTX.p.id)===Number(id))el.innerHTML='<div class="aviso rojo">'+esc(mensaje(e))+'</div>';});
}
function puede(f){return !!(f&&f.escribe&&CTX&&CTX.yo&&CTX.yo.escribe!==false);}
function fechaCorta(y){if(!y)return '—';var s=String(y).slice(0,10);return D.diaLargo(s).replace(/^(\w+)/,function(w){return w.slice(0,3);});}

function html(f){
  var p=CTX.p, hoy=f.hoy||D.hoy(), pr=f.proxima||{}, w=puede(f), h='';
  h+='<h4>'+ic('objetivo','c-amb')+' Seguimiento</h4>';
  if(f.sugerir_perdido&&w)h+='<div class="vc-sug" role="status">'+ic('alerta','c-roj')+'<div><b>Sin respuesta tras el último contacto (día 14).</b> ¿Lo pasamos a Perdido · No responde?'
    +'<div class="vc-acc"><button type="button" class="btn sm" id="vcPerdido">Pasar a Perdido · No responde</button></div></div></div>';
  h+=avisoHoy(f,D);
  // Próxima acción
  if(f.abierta){
    var venc=pr.vencida, falta=pr.falta;
    h+='<div class="vc-prox'+(venc||falta?' rojo':'')+'"><div class="vc-prox-t">'+(falta?'<b>⚠️ Falta la próxima acción.</b> Todo prospecto abierto lleva una, con fecha.'
      :'<span class="t2">Próxima acción</span><b>'+esc(pr.accion||'Reunión agendada')+'</b><span class="'+(venc?'vc-rojo':'t2')+'">'+(pr.compromiso?esc(fechaCorta(pr.compromiso))+(venc?' · vencida hace '+Number(pr.dias_atraso||0)+' d':''):'')+'</span>')+'</div>';
    if(w)h+='<form class="vc-prox-f" id="vcProxF" autocomplete="off"><label class="sr" for="vcProxA">Próxima acción</label><input class="inp" id="vcProxA" maxlength="200" placeholder="Ej.: Llamar para resolver dudas" value="">'
      +'<label class="sr" for="vcProxD">Fecha</label><input class="inp" id="vcProxD" type="date" min="'+esc(hoy)+'" value="">'
      +'<button type="submit" class="btn p sm">Guardar</button></form><div class="crm-msg" id="vcProxMsg" role="status"></div>';
    h+='</div>';
  }else h+='<p class="crm-nota">'+(p.etapa==='cliente'?'Ganado: el seguimiento sigue en Onboarding.':'Cerrado: no lleva próxima acción.')+'</p>';
  if(w)h+='<div class="vc-acc"><button type="button" class="btn p" id="vcContacto">'+(root.gIcon?root.gIcon('check'):'')+' Registrar contacto</button></div>';
  // Tareas
  var pend=(f.tareas||[]).filter(function(t){return t.estado==='pendiente';}), cerr=(f.tareas||[]).filter(function(t){return t.estado!=='pendiente';});
  h+='<div class="vc-sub">Tareas'+(pend.length?' <span class="n">'+pend.length+'</span>':'')+'</div>';
  if(!pend.length)h+='<div class="nd">Sin tareas pendientes.</div>';
  h+=pend.map(function(t){var x=CANAL_IC[t.canal]||['lista','c-lil'];
    return '<div class="vc-tarea'+(t.vencida?' venc':'')+'" data-t="'+Number(t.id)+'">'+ic(x[0],x[1])+'<div class="vc-tt"><b>'+esc(t.titulo)+'</b>'
      +'<span class="'+(t.vencida?'vc-rojo':'t2')+'">'+(t.vencida?'⏰ venció el ':'para el ')+esc(fechaCorta(t.vence_el))+(t.origen==='manual'?' · próxima acción':'')+'</span>'
      +(t.texto?'<details><summary>Ver texto sugerido</summary><p class="vc-texto">'+esc(completar(t.texto,p,CTX.yo))+'</p></details>':'')
      +(w?'<div class="vc-acc">'+(t.texto?'<button type="button" class="btn sm" data-copiar="'+Number(t.id)+'">Copiar texto</button>':'')
        +'<button type="button" class="btn sm" data-hecha="'+Number(t.id)+'">✓ Hecha</button><button type="button" class="btn sm" data-omitir="'+Number(t.id)+'">Omitir</button></div>':'')
      +'</div></div>';}).join('');
  if(cerr.length)h+='<details class="vc-cerr"><summary>Tareas cerradas ('+cerr.length+')</summary>'+cerr.map(function(t){
    return '<div class="vc-tarea cerr"><span class="vc-est">'+(t.estado==='hecha'?'✓':'—')+'</span><div class="vc-tt"><s>'+esc(t.titulo)+'</s><span class="t3">'+(t.estado==='hecha'?'hecha':'omitida'+(t.motivo&&!/^(etapa_cerrada|cambio_etapa)$/.test(t.motivo)?': '+esc(t.motivo):t.motivo==='etapa_cerrada'?' (prospecto cerrado)':' (cambió de etapa)'))
      +(t.cerrada_at?' · '+esc(D.fechaHora(t.cerrada_at)):'')+(t.cerrada_por?' · '+esc(primerNombre(t.cerrada_por)):'')+'</span></div></div>';}).join('')+'</details>';
  // Línea de tiempo única
  var hi=f.historial||[];
  h+='<div class="vc-sub">Historial <span class="t3">automático y manual, en una sola línea</span></div><ol class="vc-tl">'
    +(hi.length?hi.slice(0,60).map(function(e){
      return '<li class="'+esc(e.fuente||'')+'">'+icHist(e)+'<div><b>'+esc(etiquetaTipo(e))+'</b>'+(e.texto?'<span class="vc-txt">'+esc(e.texto)+'</span>':'')
        +'<span class="t3">'+esc(D.fechaHora(e.t))+' · '+(e.fuente==='automatico'?'Automático':e.fuente==='manual'?'Manual':'Sistema')+(e.actor?' · '+esc(primerNombre(e.actor)):'')+'</span></div></li>';}).join('')
     :'<li class="nd">Sin movimientos todavía.</li>')+'</ol>'+(hi.length>60?'<p class="crm-nota">Se muestran los 60 más recientes.</p>':'');
  return h;
}

function tras(r){   // respuesta de una escritura: {prospecto, ficha}
  if(r&&r.ficha){FICHA[r.ficha.lead_id]=r.ficha;}
  if(r&&r.prospecto&&CTX&&CTX.alGuardar)CTX.alGuardar(r.prospecto);
  else{var el=cont();if(el&&r&&r.ficha){el.innerHTML=html(r.ficha);enlazar();}}
}
function enlazar(){
  var el=cont();if(!el)return;var f=FICHA[CTX.p.id];
  var pf=el.querySelector('#vcProxF');
  if(pf)pf.onsubmit=function(ev){ev.preventDefault();var a=el.querySelector('#vcProxA').value.trim(),d=el.querySelector('#vcProxD').value,m=el.querySelector('#vcProxMsg');
    if(a.length<3||!d){m.className='crm-msg err';m.textContent=MSJ.PROXIMA_INCOMPLETA;return;}
    m.className='crm-msg';m.textContent='Guardando…';
    D.rpc('com_proxima_guardar',{p_id:Number(CTX.p.id),p_accion:a,p_fecha:d,p_actualizado:CTX.p.actualizado}).then(function(r){D.toast('Próxima acción guardada');tras(r);})
      .catch(function(e){m.className='crm-msg err';m.textContent=mensaje(e);if(/VERSION_CONFLICTO/.test(String(e&&e.message))&&CTX.recargar)CTX.recargar();});};
  var bc=el.querySelector('#vcContacto');if(bc)bc.onclick=function(){registrar(null);};
  var bp=el.querySelector('#vcPerdido');if(bp)bp.onclick=function(){if(CTX.moverPerdido)CTX.moverPerdido('no_responde');};
  el.querySelectorAll('[data-hecha]').forEach(function(b){b.onclick=function(){registrar(Number(b.getAttribute('data-hecha')));};});
  el.querySelectorAll('[data-omitir]').forEach(function(b){b.onclick=function(){omitir(Number(b.getAttribute('data-omitir')));};});
  el.querySelectorAll('[data-copiar]').forEach(function(b){b.onclick=function(){
    var t=(f.tareas||[]).filter(function(x){return Number(x.id)===Number(b.getAttribute('data-copiar'));})[0];if(!t)return;
    var txt=completar(t.texto,CTX.p,CTX.yo);
    (navigator.clipboard&&navigator.clipboard.writeText?navigator.clipboard.writeText(txt):Promise.reject()).then(function(){D.toast('Texto copiado: pégalo en WhatsApp o en el correo');})
      .catch(function(){D.toast('No se pudo copiar: selecciónalo en «Ver texto sugerido»');});};});
}
function modal(h,alAbrir){
  var velo=document.createElement('div');velo.className='cm-velo';var m=document.createElement('div');m.className='cm-modal';m.setAttribute('role','dialog');m.setAttribute('aria-modal','true');m.setAttribute('aria-labelledby','vcMTit');
  m.innerHTML=h;var previo=document.activeElement;
  function cerrar(){velo.remove();m.remove();document.removeEventListener('keydown',tecla,true);try{if(previo)previo.focus();}catch(e){}}
  function tecla(e){if(e.key==='Escape'){e.preventDefault();cerrar();}}
  document.body.appendChild(velo);document.body.appendChild(m);velo.onclick=cerrar;document.addEventListener('keydown',tecla,true);alAbrir(m,cerrar);
}
function chips(nombre,ops,sel){return '<div class="vc-chips" role="radiogroup">'+ops.map(function(o){return '<label class="vc-chip"><input type="radio" name="'+nombre+'" value="'+o[0]+'"'+(o[0]===sel?' checked':'')+'><span>'+esc(o[1])+'</span></label>';}).join('')+'</div>';}

// Registrar contacto (opcionalmente tachando una tarea). Pide la próxima acción en el mismo formulario.
function registrar(tareaId){
  var f=FICHA[CTX.p.id]||{}, pend=(f.tareas||[]).filter(function(t){return t.estado==='pendiente';}), t=pend.filter(function(x){return Number(x.id)===tareaId;})[0];
  var otras=pend.filter(function(x){return !t||Number(x.id)!==Number(t.id);}), hoy=f.hoy||D.hoy();
  modal('<h2 id="vcMTit">Registrar contacto</h2><p>'+esc(CTX.p.nombre||'')+' · '+esc(CTX.p.empresa||'Empresa no informada')+(t?'<br>Tarea: <b>'+esc(t.titulo)+'</b>':'')+'</p>'
    +avisoHoy(f,D)
    +'<span class="lbl">Canal</span>'+chips('vcCan',CANALES,t&&t.canal||'whatsapp')
    +'<span class="lbl">Resultado</span>'+chips('vcRes',RESULTADOS,'enviado')
    +'<label class="lbl" for="vcResu">Qué pasó (una línea)</label><textarea class="inp" id="vcResu" maxlength="1000" placeholder="Ej.: Le pregunté si revisó la propuesta; queda de responder el jueves"></textarea>'
    +(!t&&pend.length?'<label class="lbl" for="vcTar">¿Corresponde a una tarea? (opcional)</label><select class="inp" id="vcTar"><option value="">— ninguna —</option>'+pend.map(function(x){return '<option value="'+Number(x.id)+'">'+esc(x.titulo)+'</option>';}).join('')+'</select>':'')
    +'<span class="lbl">Próxima acción '+(otras.length?'(opcional: ya sigue «'+esc(otras[0].titulo)+'»)':'(obligatoria)')+'</span>'
    +'<div class="vc-prox-f"><input class="inp" id="vcPA" maxlength="200" placeholder="Ej.: Llamar el jueves"><input class="inp" id="vcPD" type="date" min="'+esc(hoy)+'"></div>'
    +'<div class="msg err" id="vcMMsg" role="status"></div>'
    +'<div class="crm-macc"><button type="button" class="btn" id="vcMNo">Cancelar</button><button type="button" class="btn p" id="vcMSi">Guardar contacto</button></div>',
  function(m,cerrar){
    var mismoDia=false;
    m.querySelector('#vcMNo').onclick=cerrar;
    m.querySelector('#vcMSi').onclick=function(){
      var b=this,msg=m.querySelector('#vcMMsg'),sel=m.querySelector('#vcTar');
      var canal=(m.querySelector('input[name=vcCan]:checked')||{}).value, res=(m.querySelector('input[name=vcRes]:checked')||{}).value;
      var resu=m.querySelector('#vcResu').value.trim(), pa=m.querySelector('#vcPA').value.trim(), pd=m.querySelector('#vcPD').value;
      if(resu.length<3){msg.className='msg err';msg.textContent=MSJ.FALTA_RESUMEN;return;}
      if(!!pa!==!!pd){msg.className='msg err';msg.textContent=MSJ.PROXIMA_INCOMPLETA;return;}
      b.disabled=true;msg.className='msg';msg.textContent='Guardando…';
      D.rpc('com_contacto_registrar',{p_id:Number(CTX.p.id),p_canal:canal,p_resultado:res,p_resumen:resu,p_actualizado:CTX.p.actualizado,
        p_tarea_id:t?Number(t.id):(sel&&sel.value?Number(sel.value):null),p_proxima_accion:pa||null,p_proxima_fecha:pd||null,p_mismo_dia:mismoDia})
      .then(function(r){cerrar();D.toast('Contacto registrado'+(t?' · tarea tachada':''));tras(r);})
      .catch(function(e){b.disabled=false;var s=String(e&&e.message);
        if(/YA_CONTACTADO_HOY/.test(s)){mismoDia=true;msg.className='msg err';msg.textContent='Ya hubo un contacto hoy. Si de verdad corresponde (por ejemplo, el prospecto te llamó), presiona «Registrar igual».';b.textContent='Registrar igual';return;}
        if(/FALTA_PROXIMA_ACCION/.test(s)){msg.className='msg err';msg.textContent='Esta era la última tarea: escribe la próxima acción y su fecha.';m.querySelector('#vcPA').focus();return;}
        msg.className='msg err';msg.textContent=mensaje(e);if(/VERSION_CONFLICTO|TAREA_NO_VALIDA/.test(s)&&CTX.recargar)CTX.recargar();});
    };
    m.querySelector('#vcResu').focus();
  });
}
function omitir(tareaId){
  var f=FICHA[CTX.p.id]||{}, t=(f.tareas||[]).filter(function(x){return Number(x.id)===tareaId;})[0];if(!t)return;
  var quedan=(f.tareas||[]).filter(function(x){return x.estado==='pendiente'&&Number(x.id)!==tareaId;}).length, hoy=f.hoy||D.hoy();
  modal('<h2 id="vcMTit">Omitir tarea</h2><p><b>'+esc(t.titulo)+'</b> no se hará. Queda en el historial con el motivo.</p>'
    +'<label class="lbl" for="vcOm">Motivo</label><input class="inp" id="vcOm" maxlength="300" placeholder="Ej.: ya respondió por WhatsApp">'
    +(quedan?'':'<span class="lbl">Próxima acción (obligatoria: era la última tarea)</span><div class="vc-prox-f"><input class="inp" id="vcPA" maxlength="200"><input class="inp" id="vcPD" type="date" min="'+esc(hoy)+'"></div>')
    +'<div class="msg err" id="vcMMsg" role="status"></div><div class="crm-macc"><button type="button" class="btn" id="vcMNo">Cancelar</button><button type="button" class="btn p" id="vcMSi">Omitir</button></div>',
  function(m,cerrar){
    m.querySelector('#vcMNo').onclick=cerrar;
    m.querySelector('#vcMSi').onclick=function(){
      var b=this,msg=m.querySelector('#vcMMsg'),mo=m.querySelector('#vcOm').value.trim(),pa=m.querySelector('#vcPA'),pd=m.querySelector('#vcPD');
      if(mo.length<3){msg.textContent=MSJ.FALTA_MOTIVO;return;}
      b.disabled=true;msg.className='msg';msg.textContent='Guardando…';
      D.rpc('com_tarea_omitir',{p_tarea_id:tareaId,p_motivo:mo,p_actualizado:CTX.p.actualizado,p_proxima_accion:pa&&pa.value.trim()||null,p_proxima_fecha:pd&&pd.value||null})
        .then(function(r){cerrar();D.toast('Tarea omitida');tras(r);})
        .catch(function(e){b.disabled=false;msg.className='msg err';msg.textContent=mensaje(e);});
    };
    m.querySelector('#vcOm').focus();
  });
}
// Para el CRM: pedir la próxima acción al mover de etapa (cuando la base responde FALTA_PROXIMA_ACCION).
function pedirProxima(p,etapaTxt,ok,cancel){
  var hoy=D.hoy();
  modal('<h2 id="vcMTit">Próxima acción</h2><p>'+esc(p.nombre||'')+' pasa a <b>'+esc(etapaTxt)+'</b>. Todo prospecto abierto lleva próxima acción con fecha.</p>'
    +'<label class="lbl" for="vcPA">¿Qué sigue?</label><input class="inp" id="vcPA" maxlength="200" placeholder="Ej.: Enviar la propuesta">'
    +'<label class="lbl" for="vcPD">¿Para cuándo?</label><input class="inp" id="vcPD" type="date" min="'+esc(hoy)+'" value="'+esc(D.habilSiguiente(hoy))+'">'
    +'<div class="msg err" id="vcMMsg" role="status"></div><div class="crm-macc"><button type="button" class="btn" id="vcMNo">Cancelar</button><button type="button" class="btn p" id="vcMSi">Mover</button></div>',
  function(m,cerrar){
    m.querySelector('#vcMNo').onclick=function(){cerrar();if(cancel)cancel();};
    m.querySelector('#vcMSi').onclick=function(){var a=m.querySelector('#vcPA').value.trim(),d=m.querySelector('#vcPD').value;
      if(a.length<3||!d){m.querySelector('#vcMMsg').textContent=MSJ.PROXIMA_INCOMPLETA;return;}cerrar();ok(a,d);};
    m.querySelector('#vcPA').focus();
  });
}
root.ComVentas.montar=montar;root.ComVentas.cargar=cargar;root.ComVentas.olvidar=function(id){delete FICHA[id];};root.ComVentas.pedirProxima=pedirProxima;
})(typeof window!=='undefined'?window:globalThis);
