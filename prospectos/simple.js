/* ============================================================
   prospectos/simple.js — Prospectos simple (COM-SIMPLE-1 · maqueta aprobada por Luciano el 12-nov)
   1. "Reuniones pasadas sin cerrar": ✅ Se hizo / 🚫 No asistió con UN toque (RPC com_cierre_rapido: reserva + prospecto + bitácora abierta).
   2. Filtros: Todos · Agendadas · Propuesta enviada · Ganados · Perdidos (con conteo).
   3. Ficha de una pantalla: contacto (WhatsApp y teléfono con whatsapp.js / telefono.js), estado con un toque, UNA caja "Situación",
      plan, próximo contacto OPCIONAL, historial (com_linea_tiempo) y "Ver guion (opcional)" = la bitácora de siempre.
   Datos: com_simple_listar / com_cierre_rapido / com_ficha_guardar, SOLO por RPC con el JWT (ComDatos.rpc). La base decide qué ve y
   qué edita cada uno (Master y marca 'comercial': todo). Todo texto de la base pasa por esc().
   ============================================================ */
(function(root){
'use strict';

// Estado de la pantalla ↔ etapa real de public.leads (ver MAPEO en el expediente COM-SIMPLE-1).
var ESTADOS=[ // [etapa que se guarda, etiqueta, clase] — los 6 botones de "¿En qué está?"
  ['agendado','Agendada','e-ag'],['reunion_realizada','Reunión hecha','e-hecha'],['no_asistio','No asistió','e-na'],
  ['propuesta','Propuesta enviada','e-prop'],['cliente','Ganado','e-gan'],['descartado','Perdido','e-per']];
var OTRAS={nuevo:['Nuevo · sin reunión','e-otro'],seguimiento:['Seguimiento','e-prop'],no_calificado:['Sin agendar','e-otro'],
  emprendedor_solicitado:['Cumplimiento solicitado','e-otro']};
var FILTROS=[['todos','Todos',null],['ag','Agendadas',['agendado']],['prop','Propuesta enviada',['propuesta','seguimiento']],
  ['gan','Ganados',['cliente']],['per','Perdidos',['descartado']]];
var MOTIVOS=[['precio','Precio'],['eligio_otro','Se quedó con su contador / eligió otro'],['no_responde','No respondió'],
  ['no_calza','No califica'],['lo_hara_solo','Lo hará por su cuenta'],['otro','Otro']];
var PLANES=[['cumplimiento','Cumplimiento'],['pro','PRO'],['estrategico','Estratégico']];
var MSJ={RESERVA_FUTURA:'Esa reunión todavía no ocurre.',RESERVA_NO_TERMINADA:'Esa reunión todavía no termina: ciérrala cuando acabe.',
  FALTA_VERSION:'Faltan los datos de la ficha. Recargué la lista: vuelve a guardar.',SIN_IDENTIDAD:'Tu usuario no está activo en Gestoor. Pídele al Master que lo revise.',RESERVA_YA_CERRADA:'Esa reunión ya estaba cerrada con otro resultado. Recargué la lista.',
  RESERVA_NO_VIGENTE:'Esa reserva fue cancelada.',RESULTADO_INVALIDO:'Resultado no válido.',PLAN_INVALIDO:'Elige un plan de la lista.',
  MOTIVO_INVALIDO:'Elige un motivo de la lista.',FALTA_MOTIVO_PERDIDA:'Para marcar Perdido elige el motivo (obligatorio).',SITUACION_MUY_LARGA:'La situación supera los 4.000 caracteres.',ETAPA_INVALIDA:'Estado no válido.',
  VERSION_CONFLICTO:'Otra persona guardó esta ficha recién. Recargué sus datos: revisa y vuelve a guardar.',
  CLAVE_PROHIBIDA:'No escribas claves ni contraseñas aquí: bórrala para poder guardar.',
  FECHA_INVALIDA:'El próximo contacto debe ser de hoy en adelante (máximo un año).',
  SIN_PERMISO_ESCRITURA:'Puedes ver, pero editar es solo para el Master y el equipo Comercial.',NO_EXISTE:'No encontramos ese prospecto (o no está a tu cargo).'};

function etapaInfo(et){
  for(var i=0;i<ESTADOS.length;i++)if(ESTADOS[i][0]===et)return [ESTADOS[i][1],ESTADOS[i][2]];
  return OTRAS[et]||[et||'—','e-otro'];
}
function pasaFiltro(p,f){var x=FILTROS.filter(function(y){return y[0]===f;})[0];return !x||!x[2]||x[2].indexOf(p.etapa)>=0;}
function cuenta(lista,f){return lista.filter(function(p){return pasaFiltro(p,f);}).length;}
// "Ver guion (opcional)": la bitácora de siempre (no se borra). Devuelve la URL o null (→ abrir una sin reserva).
function guionUrl(p,demo){
  var s=demo?'&demo=1':'', r=p&&p.reunion;
  if(r&&r.bitacora)return 'bitacora.html?id='+Number(r.bitacora.id)+s;
  if(p&&p.bitacora_manual)return 'bitacora.html?id='+Number(p.bitacora_manual)+s;
  if(r&&r.estado!=='cancelada'&&r.estado!=='inconsistente')return 'bitacora.html?reserva='+Number(r.id)+s;
  return null;
}
// Argumentos de com_ficha_guardar a partir de la ficha (todo junto; solo el estado es obligatorio).
function argsFicha(p,v){
  return {p_id:Number(p.id),p_etapa:v.etapa,p_situacion:v.situacion||'',p_plan:v.plan||null,
    p_motivo_perdida:v.etapa==='descartado'?(v.motivo||null):null,p_proxima_fecha:v.proxima||null,p_actualizado:p.actualizado};   // R2 H1: obligatoria
}
root.ComSimple={ESTADOS:ESTADOS,OTRAS:OTRAS,FILTROS:FILTROS,MOTIVOS:MOTIVOS,PLANES:PLANES,etapaInfo:etapaInfo,pasaFiltro:pasaFiltro,
  cuenta:cuenta,guionUrl:guionUrl,argsFicha:argsFicha,MSJ:MSJ};   // MSJ: también lo usa crm.js (mismos mensajes al mover de etapa)

if(typeof document==='undefined'||!root.ComDatos||!document.getElementById('csApp'))return;
var D=root.ComDatos, esc=D.esc, app=document.getElementById('csApp');
var DATA=null, FILTRO='todos', SEL=null, TXT='', HIST={};

if(D.DEMO){document.documentElement.classList.remove('auth-pending');var dm=document.getElementById('cmDemo');if(dm)dm.hidden=false;}
try{var q=new URLSearchParams(location.search),qi=q.get('id');if(qi&&/^\d{1,18}$/.test(qi))SEL=Number(qi);
  var qf=q.get('f');if(FILTROS.some(function(x){return x[0]===qf;}))FILTRO=qf;}catch(e){}

function mensaje(e){var m=String(e&&e.message||e||'');for(var k in MSJ)if(m.indexOf(k)>=0)return MSJ[k];return D.mensaje(e);}
function fechaCorta(iso){if(!iso)return '—';return D.diaLargo(D.ymd(iso)).replace(/,.*/,'').slice(0,3)+' '+D.ymd(iso).slice(8)+'-'+D.ymd(iso).slice(5,7)+' '+D.hora(iso);}
function chip(et){var i=etapaInfo(et);return '<span class="cs-est '+i[1]+'">'+esc(i[0])+'</span>';}
function yo(){return (DATA&&DATA.yo)||{};}
function perdido(id){var p=prospecto(id);return !!(p&&p.etapa==='descartado');}
function prospecto(id){return (DATA.prospectos||[]).filter(function(p){return Number(p.id)===Number(id);})[0]||null;}
function reemplazar(p){if(!p)return;var l=DATA.prospectos||[];for(var i=0;i<l.length;i++)if(Number(l[i].id)===Number(p.id)){l[i]=p;return;}l.unshift(p);}
function guardarUrl(){try{var p=new URLSearchParams(location.search);if(SEL)p.set('id',SEL);else p.delete('id');if(FILTRO!=='todos')p.set('f',FILTRO);else p.delete('f');
  var s=p.toString();history.replaceState(null,'',location.pathname+(s?'?'+s:''));}catch(e){}}

function cargar(){
  return D.rpc('com_simple_listar',{}).then(function(r){
    DATA=r||{};DATA.prospectos=DATA.prospectos||[];DATA.pendientes=DATA.pendientes||[];
    if(SEL&&!prospecto(SEL))SEL=null;
    if(!SEL&&DATA.prospectos.length)SEL=Number(DATA.prospectos[0].id);
    pintar();
  }).catch(function(e){app.innerHTML='<div class="aviso rojo">'+esc(mensaje(e))+'</div>';});
}

function pintar(){
  var Y=yo(), pend=DATA.pendientes, lista=DATA.prospectos, t=TXT.trim().toLowerCase();
  var h='<div class="cs-wrap"><div style="min-width:0">';
  if(pend.length){
    h+='<div class="cs-aviso" id="csPend"><p>⏰ <b>Reuniones pasadas sin cerrar</b> · ciérralas con un toque</p>'
      +pend.map(function(x){return '<div class="cs-pend" data-rid="'+Number(x.reserva_id)+'"><span><b>'+esc(x.nombre)+'</b> · '+esc(x.empresa||'Empresa no informada')+' · '+esc(fechaCorta(x.inicio))
        +(x.bitacora&&x.bitacora.estado==='abierta'?' · <i>bitácora abierta</i>':'')
        +(perdido(x.lead_id)?'<br><small class="cs-alerta">⚠️ Hoy está <b>Perdido</b>: al cerrar esta reunión sale de Perdido (queda en el historial).</small>':'')+'</span>'
        +'<span class="cs-acc">'+(Y.escribe
          ?'<button type="button" class="btn sm cs-ok" data-cerrar="'+Number(x.reserva_id)+'" data-res="realizada">✅ Se hizo</button><button type="button" class="btn sm cs-no" data-cerrar="'+Number(x.reserva_id)+'" data-res="no_asistio">🚫 No asistió</button>'
          :'<span class="nd">solo lectura</span>')+'</span></div>';}).join('')+'</div>';
  }
  h+='<div class="cs-chips" role="group" aria-label="Filtrar por estado">'+FILTROS.map(function(f){
      return '<button type="button" class="cs-chip'+(FILTRO===f[0]?' on':'')+'" data-f="'+f[0]+'" aria-pressed="'+(FILTRO===f[0])+'">'+esc(f[1])+'<i>'+cuenta(lista,f[0])+'</i></button>';}).join('')
    +'<input class="cs-buscar" id="csBus" type="search" placeholder="Buscar nombre o empresa" aria-label="Buscar" value="'+esc(TXT)+'"></div>';
  var vis=lista.filter(function(p){return pasaFiltro(p,FILTRO)&&(!t||(String(p.nombre||'')+' '+String(p.empresa||'')+' '+String(p.email||'')).toLowerCase().indexOf(t)>=0);});
  h+='<div class="cs-lista" id="csLista">'+(vis.length?vis.map(function(p){var r=p.reunion;
      return '<button type="button" class="cs-row'+(Number(p.id)===SEL?' sel':'')+'" data-id="'+Number(p.id)+'"><span><b>'+esc(p.nombre)+'</b><small>'+esc(p.empresa||'Empresa no informada')+'</small></span>'
        +'<span class="oc"><small>'+esc(p.tel||p.email||'Sin contacto')+'</small></span>'
        +'<span class="oc"><small>'+(r?'📅 '+esc(fechaCorta(r.inicio)):'Sin reunión')+'</small></span><span>'+chip(p.etapa)+'</span></button>';}).join('')
    :'<div class="cs-vacio">No hay prospectos con este filtro.</div>')+'</div></div>';
  h+='<aside class="cs-ficha" id="csFicha" aria-live="polite">'+fichaHtml(prospecto(SEL))+'</aside></div>';
  app.innerHTML=h;enlazar();
}

function fichaHtml(p){
  if(!p)return '<p class="cs-vacio">Elige un prospecto de la lista.</p>';
  var Y=yo(), dis=Y.escribe?'':' disabled', r=p.reunion, url=guionUrl(p,D.DEMO);
  var h='<h2 id="csNom">'+esc(p.nombre)+'</h2><div class="cs-sub">'+esc(p.empresa||'Empresa no informada')+(r?' · reunión '+esc(fechaCorta(r.inicio)):'')+'</div>';
  h+='<span class="cs-l">Contacto</span><div class="cs-contacto">'
    +'<span>📞 '+(p.tel?'<a href="tel:'+esc(String(p.tel).replace(/[^+\d]/g,''))+'">'+esc(p.tel)+'</a>':'<span class="nd">sin teléfono</span>')+'</span>'
    +'<span>✉️ '+(p.email?'<a href="mailto:'+esc(p.email)+'">'+esc(p.email)+'</a>':'<span class="nd">sin correo</span>')+'</span></div>'
    +'<div class="cs-fila" style="margin-top:8px" id="csWa">'+(root.ProsWA?ProsWA.boton(p,{aviso:true}):'')
    +(p.email?'<a class="btn sm" href="mailto:'+esc(p.email)+'">✉️ Correo</a>':'')
    +(root.ProsTel&&Y.escribe?ProsTel.boton({id:p.id,nombre:p.nombre,tel:p.tel},{mini:true}):'')+'</div>';
  h+='<span class="cs-l">¿En qué está?</span><div class="cs-estados" role="group" aria-label="Estado">'+ESTADOS.map(function(e){
      return '<button type="button" class="cs-chip'+(p.etapa===e[0]?' on':'')+'" data-et="'+e[0]+'" aria-pressed="'+(p.etapa===e[0])+'"'+dis+'>'+esc(e[1])+'</button>';}).join('')+'</div>';
  if(OTRAS[p.etapa]||!p.etapa)h+='<p class="cs-nota">Hoy: '+chip(p.etapa)+' · elige uno de arriba para cambiarlo.</p>';
  if(p.etapa==='descartado'||PIDE_MOT===Number(p.id))h+='<label class="cs-l" for="csMot">Motivo (obligatorio)</label><select id="csMot"'+dis+'><option value="">— elegir —</option>'
    +MOTIVOS.map(function(m){return '<option value="'+m[0]+'"'+(p.motivo_perdida===m[0]?' selected':'')+'>'+esc(m[1])+'</option>';}).join('')+'</select>';
  h+='<label class="cs-l" for="csSit">Situación · lo que le pasa y lo que busca</label><textarea id="csSit" maxlength="4000" placeholder="Escríbelo en tus palabras, general."'+dis+'>'+esc(p.situacion||'')+'</textarea>'
    +(p.dolor?'<p class="cs-dolor"><b>En la agenda escribió:</b> '+esc(p.dolor)+'</p>':'');
  h+='<div class="cs-dos"><div><label class="cs-l" for="csPlan">Plan</label><select id="csPlan"'+dis+'><option value="">— sin definir —</option>'
    +PLANES.map(function(x){return '<option value="'+x[0]+'"'+(p.plan===x[0]?' selected':'')+'>'+esc(x[1])+'</option>';}).join('')+'</select></div>'
    +'<div><label class="cs-l" for="csProx">Próximo contacto (opcional)</label><input id="csProx" type="date" value="'+esc(p.proxima_fecha||'')+'"'+dis+'></div></div>';
  h+='<span class="cs-l">Responsable</span><span class="cs-resp">'+D.avatarResp(p.responsable)+(p.responsable?esc(p.responsable.nombre):'<span class="nd">Sin asignar · lo toma quien guarde</span>')+'</span>'
    +'<p class="cs-nota">Luciano y el equipo Comercial ven y editan todo.</p>';
  h+='<div class="cs-acc">'+(Y.escribe?'<button type="button" class="btn p" id="csGuardar">Guardar</button>':'')
    +(p.etapa==='reunion_realizada'||p.etapa==='propuesta'?'<a class="btn" href="../cotizaciones/index.html'+(D.DEMO?'?demo=1':'')+'">📄 Enviar propuesta</a>':'')
    +(p.etapa==='cliente'?'<a class="btn cs-onb" href="onboarding.html?lead='+Number(p.id)+(D.DEMO?'&demo=1':'')+'">🚀 Ir a onboarding</a>':'')
    +(url?'<a class="btn" href="'+esc(url)+'">📋 Ver guion (opcional)</a>':(Y.escribe?'<button type="button" class="btn" id="csGuion">📋 Ver guion (opcional)</button>':''))+'</div>'
    +'<div class="cs-msg" id="csMsg" role="status"></div>';
  h+='<div class="cs-hist" id="csHist"><div>🕑 Historial</div><div class="nd">Cargando…</div></div>';
  return h;
}

var ETQ_HIST={origen:'Llegó',reserva_agendada:'Agendó por la web',lead_manual:'Creado a mano',responsable_tomado:'Lo tomó',bitacora_abierta:'Abrió la bitácora',
  bitacora_cerrada:'Cerró la reunión',reserva:'Reunión marcada',etapa:'Estado',perdido:'Perdido',tel_corregido:'Teléfono corregido'};
function histTexto(e){
  var d=e.detalle||{}, base=ETQ_HIST[e.tipo]||e.tipo;
  if(e.tipo==='etapa')return base+': '+(d.de?etapaInfo(d.de)[0]+' → ':'')+etapaInfo(d.a)[0];
  if(e.tipo==='reserva')return base+' '+(d.estado==='realizada'?'como hecha':d.estado==='no_asistio'?'como no asistió':String(d.estado||''));
  if(e.tipo==='bitacora_cerrada')return base+(d.resultado==='no_asistio'?' · no asistió':' · se hizo');
  if(e.tipo==='perdido'){var m=MOTIVOS.filter(function(x){return x[0]===d.motivo;})[0];return base+(m?' · '+m[1]:'');}
  if(e.tipo==='reserva_agendada')return base+' · '+fechaCorta(e.inicio);
  if(e.tipo==='origen')return base+(e.campana?' · '+e.campana:'');
  return base;
}
function pintarHist(id){
  var c=document.getElementById('csHist');if(!c||Number(id)!==SEL)return;
  var l=(HIST[id]||[]).filter(function(e){return e.tipo!=='correo_agenda';}).slice(0,12);
  c.innerHTML='<div>🕑 Historial</div>'+(l.length?l.map(function(e){return '<div>• '+esc(histTexto(e))+(e.actor?' <small>· '+esc(e.actor)+'</small>':'')+' <small>· '+esc(D.fechaHora(e.t))+'</small></div>';}).join('')
    :'<div class="nd">Sin movimientos todavía.</div>');
}
function cargarHist(id,forzar){
  if(HIST[id]&&!forzar){pintarHist(id);return;}
  D.rpc('com_linea_tiempo',{p_lead_id:Number(id)}).then(function(r){HIST[id]=Array.isArray(r)?r:[];pintarHist(id);})
    .catch(function(){var c=document.getElementById('csHist');if(c&&Number(id)===SEL)c.innerHTML='<div>🕑 Historial</div><div class="nd">No se pudo cargar el historial.</div>';});
}

function valores(p,etapa){
  var g=function(i){var e=document.getElementById(i);return e?e.value:'';};
  return {etapa:etapa||p.etapa,situacion:g('csSit'),plan:g('csPlan'),motivo:g('csMot')||(etapa==='descartado'?p.motivo_perdida:''),proxima:g('csProx')};
}
var ocupado=false, SUCIO=false, PIDE_MOT=null;   // PIDE_MOT (VENTAS-CONTROL): Perdido pide motivo antes de guardar   // SUCIO: hay texto sin guardar en la ficha (el refresco automático no la pisa)
function guardar(etapa){
  var p=prospecto(SEL);if(!p||ocupado)return;
  var msg=document.getElementById('csMsg');
  if(!p.actualizado){if(msg){msg.className='cs-msg err';msg.textContent=MSJ.FALTA_VERSION;}cargar();return;}   // R2 H1: la versión viaja siempre
  // VENTAS-CONTROL (Luciano 23-11): Perdido exige motivo también aquí (la base lo rechaza con FALTA_MOTIVO_PERDIDA). Se pide antes de guardar.
  if((etapa||p.etapa)==='descartado'&&!valores(p,etapa).motivo){PIDE_MOT=Number(p.id);pintar();var mm=document.getElementById('csMsg');
    if(mm){mm.className='cs-msg err';mm.textContent=MSJ.FALTA_MOTIVO_PERDIDA;}var sm=document.getElementById('csMot');if(sm)sm.focus();return;}
  PIDE_MOT=null;
  ocupado=true;
  app.querySelectorAll('#csFicha button,#csFicha select,#csFicha textarea,#csFicha input').forEach(function(x){x.disabled=true;});
  if(msg){msg.className='cs-msg';msg.textContent='Guardando…';}
  D.rpc('com_ficha_guardar',argsFicha(p,valores(p,etapa))).then(function(n){
    ocupado=false;SUCIO=false;reemplazar(n);
    // Si el cambio cerró una reunión pasada, sale de "sin cerrar".
    if(n&&n.reunion)DATA.pendientes=DATA.pendientes.filter(function(x){return !(Number(x.reserva_id)===Number(n.reunion.id)&&n.reunion.estado!=='confirmada'&&!(n.reunion.bitacora&&n.reunion.bitacora.estado==='abierta'));});
    pintar();delete HIST[SEL];cargarHist(SEL,true);
    var m=document.getElementById('csMsg');if(m){m.className='cs-msg ok';m.textContent='Guardado · '+etapaInfo(n.etapa)[0];}
  }).catch(function(e){
    ocupado=false;var t=mensaje(e);
    if(/VERSION_CONFLICTO|FALTA_VERSION/.test(String(e&&e.message))){cargar().then(function(){var m=document.getElementById('csMsg');if(m){m.className='cs-msg err';m.textContent=t;}});return;}
    app.querySelectorAll('#csFicha button,#csFicha select,#csFicha textarea,#csFicha input').forEach(function(x){x.disabled=!yo().escribe;});
    var m=document.getElementById('csMsg');if(m){m.className='cs-msg err';m.textContent=t+' No se guardó ningún cambio.';}
  });
}
function cerrarRapido(rid,res,btn){
  var fila=btn.closest('.cs-pend');if(fila)fila.querySelectorAll('button').forEach(function(b){b.disabled=true;});
  D.rpc('com_cierre_rapido',{p_reserva_id:Number(rid),p_resultado:res}).then(function(r){
    DATA.pendientes=DATA.pendientes.filter(function(x){return Number(x.reserva_id)!==Number(rid);});
    if(r&&r.prospecto){reemplazar(r.prospecto);SEL=Number(r.prospecto.id);delete HIST[SEL];}
    guardarUrl();pintar();
    D.toast((res==='realizada'?'✅ Reunión hecha':'🚫 No asistió')+(r&&r.prospecto?' · '+r.prospecto.nombre:'')
      +(r&&r.etapa_antes==='descartado'&&r.etapa!=='descartado'?' · salió de Perdido → '+etapaInfo(r.etapa)[0]:''));
  }).catch(function(e){
    D.toast(mensaje(e));
    if(/RESERVA_YA_CERRADA|NO_EXISTE|RESERVA_NO_VIGENTE/.test(String(e&&e.message)))cargar();
    else if(fila)fila.querySelectorAll('button').forEach(function(b){b.disabled=false;});
  });
}
function abrirGuion(){
  var p=prospecto(SEL);if(!p)return;var b=document.getElementById('csGuion');if(b)b.disabled=true;
  D.rpc('com_bitacora_abrir',{p_lead_id:Number(p.id),p_guion_version:root.ComGuionVersion||'c2-2026-11-19'})
    .then(function(x){location.href='bitacora.html?id='+Number(x.id)+(D.DEMO?'&demo=1':'');})
    .catch(function(e){if(b)b.disabled=false;var m=document.getElementById('csMsg');if(m){m.className='cs-msg err';m.textContent=mensaje(e);}});
}

function enlazar(){
  app.querySelectorAll('[data-cerrar]').forEach(function(b){b.onclick=function(){cerrarRapido(b.getAttribute('data-cerrar'),b.getAttribute('data-res'),b);};});
  app.querySelectorAll('[data-f]').forEach(function(b){b.onclick=function(){FILTRO=b.getAttribute('data-f');guardarUrl();pintar();};});
  var bus=document.getElementById('csBus');if(bus)bus.oninput=function(){var pos=bus.selectionStart;TXT=bus.value;pintar();var n=document.getElementById('csBus');n.focus();try{n.setSelectionRange(pos,pos);}catch(e){}};
  app.querySelectorAll('.cs-row[data-id]').forEach(function(b){b.onclick=function(){
    SEL=Number(b.getAttribute('data-id'));SUCIO=false;guardarUrl();pintar();
    if(window.matchMedia&&window.matchMedia('(max-width: 980px)').matches){var f=document.getElementById('csFicha');if(f&&f.scrollIntoView)f.scrollIntoView({behavior:'smooth',block:'start'});}};});
  app.querySelectorAll('#csFicha [data-et]').forEach(function(b){b.onclick=function(){guardar(b.getAttribute('data-et'));};});   // estado = un toque (guarda)
  var mot=document.getElementById('csMot');if(mot)mot.onchange=function(){guardar('descartado');};
  var g=document.getElementById('csGuardar');if(g)g.onclick=function(){guardar();};
  ['csSit','csPlan','csProx'].forEach(function(i){var e=document.getElementById(i);if(e)e.addEventListener('input',function(){SUCIO=true;});});
  var sit=document.getElementById('csSit');if(sit)sit.onkeydown=function(e){if(e.key==='Enter'&&(e.metaKey||e.ctrlKey)){e.preventDefault();guardar();}};
  var gu=document.getElementById('csGuion');if(gu)gu.onclick=abrirGuion;
  if(SEL)cargarHist(SEL);
}

// ✏️ Corregir teléfono (telefono.js): tras guardar, se recarga la lista para que WhatsApp use el número nuevo.
if(root.ProsTel)ProsTel.configurar({rpc:D.rpc,alGuardar:function(){delete HIST[SEL];cargar();}});
D.alListo(cargar);
setInterval(function(){if(DATA&&!document.hidden&&!ocupado&&!SUCIO&&!document.querySelector('.wa-menu,.tel-modal')&&document.activeElement&&!/^(TEXTAREA|INPUT|SELECT)$/.test(document.activeElement.tagName))cargar();},120000);
})(typeof window!=='undefined'?window:globalThis);
