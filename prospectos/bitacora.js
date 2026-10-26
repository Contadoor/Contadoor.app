/* ============================================================
   prospectos/bitacora.js — Bitácora de la reunión de diagnóstico (Modo reunión · Comercial C1)
   Se abre desde Reuniones o desde el aviso ⏰ de la campana:  bitacora.html?reserva=ID  ·  ?id=ID  ·  ?lead=ID
   · Guion completo en bloques plegables (comercial-guion.js, versión guardada en la bitácora), casillas rápidas, notas por bloque,
     campos 🧩, reloj de 30 min, brújula por REGLAS (sin IA) y autoguardado con control de versión (nunca pisa otra pestaña).
   · Cierre: resultado (realizada / no asistió), temperatura, próximo paso y fecha, o perdido con motivo. Lo aplica la base en una
     sola transacción (reserva + prospecto + línea de tiempo + aviso).
   · Copia local SOLO como caché de lo no guardado (se recupera si se cayó la conexión o se cerró la pestaña).
   ============================================================ */
(function(){
'use strict';
var D=window.ComDatos, G=window.ComGuion, esc=D.esc;
var app=document.getElementById('cmApp');
var B=null, S={}, N={}, ORIG={}, PISTAS={}, VER=1, EDIT=false, BLOQ=false;
var ABIERTOS={sit:true}, C={resultado:null,temperatura:null,desenlace:'seguimiento',accion:'',fecha:'',motivo:null};
var reloj={seg:0,corre:false,t0:0,base:0,int:null}, sucio=false, guardando=false, tGuardar=null, reintento=0, ultimoOk=null;
var ETAPAS={nuevo:'Nuevo',agendado:'Reunión agendada',reunion_realizada:'Diagnóstico hecho',no_asistio:'No asistió',propuesta:'Propuesta enviada',
  seguimiento:'Negociación',cliente:'Ganado',emprendedor_solicitado:'Cumplimiento solicitado',no_calificado:'Sin agendar',descartado:'Perdido'};
var PASOS={confirmacion:'Confirmación',nutricion1:'Presentación',nutricion2:'Caso / ahorro',rec24:'Recordatorio 24 h',rec1h:'Recordatorio 1 h',post:'Agradecimiento'};
var VENTAS={hasta5:'Ventas hasta $5M','5a20':'Ventas $5M a $20M','20a50':'Ventas $20M a $50M',mas50:'Ventas sobre $50M',mas80:'Ventas sobre $80M'};
var TRAB={ninguno:'Sin trabajadores','1a5':'1 a 5 trabajadores','6a20':'6 a 20 trabajadores',mas20:'Más de 20 trabajadores'};
var CONTAB={yo:'Lleva su contabilidad',externo:'Contador externo',interno:'Contador interno',nadie:'Sin contador'};
window.ComGuionVersion=G.GUION_VERSION;

if(D.DEMO){document.documentElement.classList.remove('auth-pending');var dm=document.getElementById('cmDemo');if(dm)dm.hidden=false;
  var vv=document.getElementById('cmVolver');if(vv)vv.href='reuniones.html?demo=1';}

// ── Abrir ──
function abrir(){
  var p=new URLSearchParams(location.search), args={p_guion_version:G.GUION_VERSION};
  if(p.get('reserva'))args.p_reserva_id=Number(p.get('reserva'));
  else if(p.get('id'))args.p_bitacora_id=Number(p.get('id'));
  else if(p.get('lead'))args.p_lead_id=Number(p.get('lead'));
  else{app.innerHTML='<div class="aviso rojo">Falta indicar la reunión. Ábrela desde <a class="link" href="reuniones.html">Reuniones</a>.</div>';return;}
  D.rpc('com_bitacora_abrir',args).then(function(b){cargarBitacora(b);
    // Dejar la URL estable (?id=) para que recargar no dependa de la reserva.
    try{history.replaceState(null,'',location.pathname+'?id='+Number(b.id)+(D.DEMO?'&demo=1':''));}catch(e){}
  }).catch(function(e){app.innerHTML='<div class="aviso rojo">'+esc(D.mensaje(e))+' <a class="link" href="reuniones.html'+(D.DEMO?'?demo=1':'')+'">Volver a Reuniones</a></div>';});
}
function cargarBitacora(b){
  B=b;VER=b.version;S=JSON.parse(JSON.stringify(b.campos||{}));N=JSON.parse(JSON.stringify(b.notas||{}));
  EDIT=!!b.puede_editar;reloj.base=b.reloj_seg||0;reloj.seg=reloj.base;
  if(b.guion_version&&b.guion_version!==G.GUION_VERSION&&EDIT)D.toast('Esta bitácora usa el guion '+b.guion_version+'; se muestra con el guion vigente.');
  // Precarga desde el formulario de la agenda (solo campos vacíos; queda marcada "de la agenda").
  if(EDIT){var pc=G.precarga(b.lead&&b.lead.respuestas,b.lead&&b.lead.empresa,S);Object.keys(pc.campos).forEach(function(k){S[k]=pc.campos[k];});ORIG=pc.origen;PISTAS=pc.pistas;
    if(Object.keys(pc.campos).length)sucio=true;}
  else{var pc2=G.precarga(b.lead&&b.lead.respuestas,null,{});PISTAS=pc2.pistas;}
  // Recuperar cambios que no alcanzaron a guardarse (caché local de ESTA bitácora y de ESTA versión).
  if(EDIT){var c=leerCache();if(c&&c.v===VER&&(JSON.stringify(c.campos)!==JSON.stringify(S)||JSON.stringify(c.notas)!==JSON.stringify(N))){S=c.campos;N=c.notas;sucio=true;D.toast('Recuperamos cambios que no alcanzaron a guardarse.');}
    else if(c&&c.v!==VER)borrarCache();}
  if(b.lead&&b.lead.proxima_accion&&!C.accion)C.accion='';
  pintar();
  if(sucio&&EDIT)programar(400);
}
// ── Caché local (solo lo no guardado) ──
function kCache(){return 'gestoor.com.bitacora.'+(B&&B.id);}
function leerCache(){try{var x=JSON.parse(localStorage.getItem(kCache())||'null');return x&&typeof x==='object'?x:null;}catch(e){return null;}}
function escribirCache(){try{localStorage.setItem(kCache(),JSON.stringify({v:VER,campos:S,notas:N,ts:Date.now()}));}catch(e){}}
function borrarCache(){try{localStorage.removeItem(kCache());}catch(e){}}

// ── Pintar ──
function pintar(){
  var l=B.lead||{}, r=B.reserva, o=D.origen(l), cerrada=B.estado!=='abierta';
  var h='';
  if(BLOQ)h+='<div class="aviso rojo" id="avConf">⚠️ Esta bitácora se guardó desde otra pestaña o equipo. Para no pisar nada, dejamos de guardar aquí. <button type="button" class="btn sm" onclick="location.reload()">Recargar</button></div>';
  if(cerrada)h+='<div class="aviso lila">🏁 Reunión cerrada el '+esc(D.fechaHora(B.cerrada_at))+' · '+esc(B.resultado==='no_asistio'?'No asistió':'Realizada')+(B.desenlace==='perdido'?' · Perdido':'')+'. La bitácora queda de solo lectura.</div>';
  else if(!EDIT)h+='<div class="aviso cel">👀 Solo lectura: abrir y editar bitácoras es para el responsable, el Master o el equipo Comercial.</div>';
  // Barra fija
  h+='<div class="mr-bar"><span class="av-p" aria-hidden="true">'+esc(D.iniciales(l.nombre))+'</span>'
    +'<div class="quien"><b>'+esc(l.nombre||'Prospecto')+(l.empresa?' · '+esc(l.empresa):'')+'</b><small>'+esc(o.txt)+(o.campana?' · '+esc(o.campana):'')
    +(r?' · '+esc(D.fechaHora(r.inicio)):' · sin reserva')+' · <span class="guardado" id="guardado"></span></small></div>'
    +'<div class="reloj"><div class="t" id="reloj" aria-live="off" title="Reloj de la reunión (30 min)">30:00</div>'
    +(EDIT?'<button class="rbtn" id="btnPlay" type="button" aria-label="Iniciar o pausar el reloj">▶</button><button class="rbtn" id="btnRst" type="button" aria-label="Reiniciar el reloj" title="Reiniciar">↺</button>':'')
    +(r&&r.teams&&!cerrada?'<a class="btn sm" href="'+esc(r.teams)+'" target="_blank" rel="noopener">🎥 Teams</a>':'')+'</div>'
    +'<div class="fase" id="fase"></div></div>';
  h+='<div class="mr"><div class="mr-col">';
  // Lo que ya nos contó
  var rs=l.respuestas||{}, ch=[];
  if(VENTAS[rs.ventas])ch.push(VENTAS[rs.ventas]);if(TRAB[rs.trabajadores])ch.push(TRAB[rs.trabajadores]);if(CONTAB[rs.contabilidad])ch.push(CONTAB[rs.contabilidad]);
  if(rs.sociedades==='si')ch.push('Más de una sociedad');if(rs.sociedades==='no')ch.push('Una sociedad');if(rs.historicos==='si')ch.push('Atrasos: sí');if(rs.rubro)ch.push('Rubro: '+rs.rubro);
  h+='<div class="card acc c-cel"><div class="h"><span class="ic">📥</span><h2>Lo que ya nos contó</h2><small>'+(ch.length?'ya volcado en el guion · se puede corregir':'sin formulario de la agenda')+'</small></div>'
    +(ch.length?'<div class="ya">'+ch.map(function(x){return '<span>'+esc(x)+'</span>';}).join('')+'</div>':'<p class="nd" style="margin:0">Este prospecto no llenó el formulario de la agenda: parte por la situación actual.</p>')
    +(rs.dolor?'<p class="dolor"><b>Lo que quiere resolver:</b> “'+esc(rs.dolor)+'”</p>':'')
    +'<div class="meta" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;align-items:center"><span class="estado lila">'+esc(ETAPAS[l.etapa]||l.etapa||'—')+'</span>'
    +(l.semaforo?'<span class="estado gris"><span class="sem '+esc(l.semaforo)+'"></span> Semáforo '+esc(l.semaforo)+'</span>':'')
    +'<span class="resp" style="display:inline-flex;gap:6px;align-items:center;font-size:12px;color:var(--t2)">'+D.avatarResp(l.responsable)+(l.responsable?esc(l.responsable.nombre):'<span class="nd">Sin asignar</span>')+'</span></div></div>';
  // Guion
  var on=G.onb(S);
  h+='<div class="card" id="guion"><div class="gu-cab"><span class="ic c-lil">🗺️</span><h2 style="font:800 16px var(--tit);margin:0;color:var(--t1)">Guion de la reunión</h2>'
    +'<span class="estado gris" id="onbCount" title="Datos que alimentan el onboarding">🧩 '+on.n+'/'+on.t+'</span><span class="cm-esp"></span>'
    +'<button type="button" class="link" id="btnTodos">'+(Object.keys(ABIERTOS).length>=G.BLOQUES.length?'Contraer todo':'Abrir todo')+'</button></div>'
    +'<p class="nd" style="margin:0 0 4px">Empieza entendiendo, no ofreciendo planes. 🧩 = alimenta el onboarding si acepta.</p>'
    +G.BLOQUES.map(function(b,i){return bloqueHTML(b,i);}).join('')
    +'<div class="campo"><label for="nota_general">🗒️ Nota libre (lo que no calza en el guion) <span class="sin-claves">🔐 No registres claves aquí</span></label><textarea class="inp" id="nota_general" data-nota="general" maxlength="4000" placeholder="Ej.: decide con su socia; le preocupa la fiscalización del año pasado…"'+(EDIT?'':' disabled')+'>'+esc(N.general||'')+'</textarea></div></div>';
  // Cierre
  h+=cerrada?resumenCierre():(EDIT?cierreHTML():'');
  // Línea de tiempo
  h+='<div class="card acc c-azu"><div class="h"><span class="ic">🕒</span><h2>Línea de tiempo</h2><small>origen · agenda · reuniones · cambios</small></div><div id="tl"><button type="button" class="btn sm" id="btnTl">Ver línea de tiempo</button></div></div>';
  h+='</div>';
  // Brújula
  h+='<aside class="card acc c-lil bru" id="bru" aria-label="Brújula"><div class="h"><span class="ic">🧭</span><h2>Brújula</h2><small>reglas fijas · sin IA</small><button type="button" class="link bru-x" id="bruX">Cerrar ✕</button></div><div id="bruCont"></div></aside>';
  h+='</div><button class="fab" id="fab" type="button" aria-controls="bru">🧭 Brújula <b id="fabN">0</b></button>';
  app.innerHTML=h;
  enlazar();brujula();pintarReloj();pintarGuardado();
  if(cerrada)cargarTl();
}
function bloqueHTML(b,i){
  var av=G.avanceBloque(S,b), ab=!!ABIERTOS[b.id];
  return '<div class="bq'+(ab?' abierto':'')+'" style="--c:'+b.c+'" data-bq="'+b.id+'">'
    +'<button type="button" class="bq-h" aria-expanded="'+ab+'" aria-controls="bqb-'+b.id+'"><span class="ic" style="--c:'+b.c+'">'+b.i+'</span><span class="n">'+(i+1)+'. '+esc(b.n)+'</span>'
    +'<span class="av'+(av.ok?' ok':'')+'">'+(av.ok?'✓ ':'')+av.n+'/'+av.t+'</span><span class="fl" aria-hidden="true">▾</span></button>'
    +'<div class="bq-b" id="bqb-'+b.id+'"'+(ab?'':' hidden')+'>'+cuerpoBloque(b)+'</div></div>';
}
function cuerpoBloque(b){
  return '<div class="frase" style="--c:'+b.c+'">'+esc(b.f)+'</div>'+b.campos.map(function(c){return campoHTML(c,b.c);}).join('')
    +'<div class="campo"><label for="nota_'+b.id+'">Nota del bloque <span class="sin-claves">🔐 No registres claves aquí</span></label><textarea class="inp" id="nota_'+b.id+'" data-nota="'+b.id+'" maxlength="4000" placeholder="Apunte rápido…"'+(EDIT?'':' disabled')+'>'+esc(N[b.id]||'')+'</textarea></div>';
}
function campoHTML(c,color){
  if(!G.visible(S,c))return '';
  var dis=EDIT?'':' disabled', id='f_'+c.k;
  var lab=(c.onb?'<span class="onb" title="Alimenta el onboarding">🧩</span>':'')+esc(c.l)+(ORIG[c.k]?'<span class="pre">de la agenda</span>':'')+(PISTAS[c.k]?'<span class="pista">'+esc(PISTAS[c.k])+'</span>':'');
  var h='<div class="campo" style="--c:'+color+'" data-campo="'+c.k+'">';
  if(c.t==='op'||c.t==='chk'){
    h+='<div class="l" id="l_'+c.k+'">'+lab+'</div><div class="opts" role="group" aria-labelledby="l_'+c.k+'">'+c.o.map(function(o){
      var on=c.t==='chk'?(Array.isArray(S[c.k])&&S[c.k].indexOf(o[0])>=0):S[c.k]===o[0];
      return '<button type="button" class="op'+(on?' on':'')+'" data-k="'+c.k+'" data-t="'+c.t+'" data-o="'+esc(o[0])+'" aria-pressed="'+on+'"'+dis+'>'+(c.t==='chk'?(on?'☑ ':'☐ '):'')+esc(o[1])+'</button>';}).join('')+'</div>';
  }else if(c.t==='area'){
    h+='<label for="'+id+'">'+lab+' <span class="sin-claves">🔐 No registres claves aquí</span></label><textarea class="inp" id="'+id+'" data-k="'+c.k+'" maxlength="2000" placeholder="'+esc(c.ph||'')+'"'+dis+'>'+esc(S[c.k]||'')+'</textarea>';
  }else{
    h+='<label for="'+id+'">'+lab+'</label><input class="inp" id="'+id+'" data-k="'+c.k+'" maxlength="200" autocomplete="off" placeholder="'+esc(c.ph||'')+'" value="'+esc(S[c.k]||'')+'"'+dis+'>';
  }
  return h+'</div>';
}
function cierreHTML(){
  var op=function(k,v,t,col){var on=C[k]===v;return '<button type="button" class="op'+(on?' on':'')+'" style="--c:'+col+'" data-c="'+k+'" data-v="'+v+'" aria-pressed="'+on+'">'+t+'</button>';};
  var h='<div class="card acc c-ver" id="cierre"><div class="h"><span class="ic">🏁</span><h2>Cerrar reunión</h2><small>actualiza la reserva y el prospecto</small></div>';
  h+='<div class="campo"><div class="l">Resultado</div><div class="opts">'+op('resultado','realizada','✅ Se realizó','#5FCF9C')+op('resultado','no_asistio','🚫 No asistió','#E07A6E')+'</div></div>';
  h+='<div class="campo"><div class="l">Temperatura'+(C.resultado==='no_asistio'?' <span class="nd">(opcional)</span>':'')+'</div><div class="opts">'+op('temperatura','caliente','🔥 Caliente','#E07A6E')+op('temperatura','tibio','🌤 Tibio','#FFC85A')+op('temperatura','frio','❄️ Frío','#5CC8FF')+'</div></div>';
  h+='<div class="campo"><div class="l">¿Cómo sigue?</div><div class="opts">'+op('desenlace','seguimiento','➡️ Sigue en carrera','#C77BC9')+op('desenlace','perdido','❌ Perdido','#E07A6E')+'</div></div>';
  if(C.desenlace==='perdido'){
    h+='<div class="campo"><div class="l">Motivo de pérdida (obligatorio)</div><div class="opts">'+G.MOTIVOS.map(function(m){return op('motivo',m[0],m[1],'#E07A6E');}).join('')+'</div></div>';
  }else{
    h+='<div class="campo"><div class="l">Próximo paso (obligatorio) · nunca “cualquier cosa me avisas”</div><div class="cie-g"><input class="inp" id="cAcc" maxlength="200" placeholder="Ej.: Enviar propuesta Contadoor PRO" value="'+esc(C.accion)+'" aria-label="Próximo paso">'
      +'<input class="inp" id="cFec" type="date" min="'+D.hoy()+'" value="'+esc(C.fecha)+'" aria-label="Fecha del próximo paso"></div></div>';
  }
  var txt=C.desenlace==='perdido'?'El prospecto pasa a “Perdido” con su motivo.':C.resultado==='no_asistio'?'La reserva pasa a “no asistió” y queda el próximo paso para reagendar.':'La reserva pasa a “realizada” y el prospecto a “Diagnóstico hecho”.';
  h+='<div class="msg err" id="cMsg" role="status"></div><div class="cerrar-r"><button class="btn v xl" type="button" id="btnCerrar">🏁 Cerrar reunión</button><span>'+esc(txt)+'</span></div></div>';
  return h;
}
function resumenCierre(){
  var mot=null;G.MOTIVOS.forEach(function(m){if(m[0]===B.motivo_perdida)mot=m[1];});
  return '<div class="card acc c-ver"><div class="h"><span class="ic">🏁</span><h2>Cierre</h2><small>'+esc(D.fechaHora(B.cerrada_at))+'</small></div><dl class="resumen-c">'
    +'<dt>Resultado</dt><dd>'+(B.resultado==='no_asistio'?'🚫 No asistió':'✅ Se realizó')+'</dd>'
    +'<dt>Temperatura</dt><dd>'+esc(D.TEMP[B.temperatura]||'No disponible')+'</dd>'
    +(B.desenlace==='perdido'?'<dt>Desenlace</dt><dd>❌ Perdido · '+esc(mot||B.motivo_perdida)+'</dd>':'<dt>Próximo paso</dt><dd>'+esc(B.proxima_accion||'—')+(B.proxima_fecha?' · '+esc(D.diaLargo(B.proxima_fecha)):'')+'</dd>')
    +'<dt>Duración</dt><dd>'+Math.round((B.duracion_seg||0)/60)+' min</dd></dl></div>';
}

// ── Eventos ──
function enlazar(){
  app.querySelectorAll('.bq-h').forEach(function(bt){bt.onclick=function(){var id=bt.parentNode.getAttribute('data-bq');if(ABIERTOS[id])delete ABIERTOS[id];else ABIERTOS[id]=true;refrescarBloque(id);actualizarBtnTodos();};});
  var bt=document.getElementById('btnTodos');if(bt)bt.onclick=function(){var todos=Object.keys(ABIERTOS).length>=G.BLOQUES.length;ABIERTOS={};if(!todos)G.BLOQUES.forEach(function(b){ABIERTOS[b.id]=true;});G.BLOQUES.forEach(function(b){refrescarBloque(b.id);});actualizarBtnTodos();};
  if(app._deleg)return enlazarResto();
  app._deleg=true;
  app.addEventListener('click',function(e){
    var b=e.target.closest('.op[data-k]');
    if(b&&EDIT&&!BLOQ){var k=b.getAttribute('data-k'),o=b.getAttribute('data-o');
      if(b.getAttribute('data-t')==='chk'){var a=Array.isArray(S[k])?S[k].slice():[];var i=a.indexOf(o);
        if(i>=0)a.splice(i,1);else{a.push(o);if(o==='ninguno'||o==='ninguna')a=[o];else a=a.filter(function(x){return x!=='ninguno'&&x!=='ninguna';});}
        if(a.length)S[k]=a;else delete S[k];}
      else{if(S[k]===o)delete S[k];else S[k]=o;}
      delete ORIG[k];
      var bq=b.closest('.bq');refrescarBloque(bq.getAttribute('data-bq'));cambio();return;}
    var cb=e.target.closest('.op[data-c]');
    if(cb){var ck=cb.getAttribute('data-c'),cv=cb.getAttribute('data-v');leerCierreInputs();C[ck]=(C[ck]===cv&&ck!=='desenlace')?null:cv;
      if(ck==='resultado'){if(!C.accion||C.accion==='Enviar propuesta'||C.accion==='Reagendar reunión')C.accion=cv==='no_asistio'?'Reagendar reunión':'Enviar propuesta';if(!C.fecha)C.fecha=D.habilSiguiente(D.hoy());}
      redibujarCierre();}
  });
  app.addEventListener('input',function(e){
    var t=e.target;if(!EDIT||BLOQ)return;
    if(t.hasAttribute('data-k')){var k=t.getAttribute('data-k');if(t.value.trim())S[k]=t.value;else delete S[k];delete ORIG[k];actualizarCab(t.closest('.bq'));cambio();}
    else if(t.hasAttribute('data-nota')){var n=t.getAttribute('data-nota');if(t.value.trim())N[n]=t.value;else delete N[n];cambio();}
  });
  enlazarResto();
}
function enlazarResto(){
  var bp=document.getElementById('btnPlay');if(bp)bp.onclick=function(){if(reloj.corre)pausar();else iniciar();};
  if(bp&&reloj.corre){bp.textContent='⏸';bp.setAttribute('aria-label','Pausar el reloj');}
  var br=document.getElementById('btnRst');if(br)br.onclick=function(){if(!confirm('¿Reiniciar el reloj a 30:00?'))return;pausar();reloj.base=0;reloj.seg=0;pintarReloj();cambio();};
  var fab=document.getElementById('fab'),bru=document.getElementById('bru');
  fab.onclick=function(){bru.classList.add('on');};document.getElementById('bruX').onclick=function(){bru.classList.remove('on');};
  var btl=document.getElementById('btnTl');if(btl)btl.onclick=cargarTl;
  var bc=document.getElementById('btnCerrar');if(bc)bc.onclick=cerrar;
}
function refrescarBloque(id){
  var b=null,i=0;G.BLOQUES.forEach(function(x,j){if(x.id===id){b=x;i=j;}});if(!b)return;
  var el=app.querySelector('.bq[data-bq="'+id+'"]');if(!el)return;
  var foco=document.activeElement&&el.contains(document.activeElement)?document.activeElement.getAttribute('data-o'):null;
  var tmp=document.createElement('div');tmp.innerHTML=bloqueHTML(b,i);el.replaceWith(tmp.firstChild);
  if(foco){var nb=app.querySelector('.bq[data-bq="'+id+'"] .op[data-o="'+foco.replace(/"/g,'')+'"]');if(nb)nb.focus();}
  var nh=app.querySelector('.bq[data-bq="'+id+'"] .bq-h');nh.onclick=function(){if(ABIERTOS[id])delete ABIERTOS[id];else ABIERTOS[id]=true;refrescarBloque(id);actualizarBtnTodos();};
}
function actualizarCab(bqEl){if(!bqEl)return;var id=bqEl.getAttribute('data-bq'),b=null;G.BLOQUES.forEach(function(x){if(x.id===id)b=x;});var av=G.avanceBloque(S,b),s=bqEl.querySelector('.bq-h .av');s.className='av'+(av.ok?' ok':'');s.textContent=(av.ok?'✓ ':'')+av.n+'/'+av.t;}
function actualizarBtnTodos(){var bt=document.getElementById('btnTodos');if(bt)bt.textContent=Object.keys(ABIERTOS).length>=G.BLOQUES.length?'Contraer todo':'Abrir todo';}
function cambio(){var on=G.onb(S),oc=document.getElementById('onbCount');if(oc)oc.textContent='🧩 '+on.n+'/'+on.t;brujula();marcarSucio();}
function leerCierreInputs(){var a=document.getElementById('cAcc'),f=document.getElementById('cFec');if(a)C.accion=a.value;if(f)C.fecha=f.value;}
function redibujarCierre(){var el=document.getElementById('cierre');if(!el)return;var tmp=document.createElement('div');tmp.innerHTML=cierreHTML();el.replaceWith(tmp.firstChild);
  var bc=document.getElementById('btnCerrar');if(bc)bc.onclick=cerrar;}

// ── Brújula ──
function minuto(){return Math.floor(reloj.seg/60);}
function brujula(){
  var x=G.brujula(S,minuto()), el=document.getElementById('bruCont');if(!el)return;
  var col={cumplimiento:'linear-gradient(90deg,#3FAF7E,#5FCF9C)',pro:'linear-gradient(90deg,#9E5CA0,#E39BE5)',estrategico:'linear-gradient(90deg,#C99A35,#FFC85A)'};
  var h=x.planes.map(function(p){return '<div class="plan"><span>'+esc(p.l)+'</span><div class="b"><i style="width:'+p.pct+'%;background:'+col[p.k]+'"></i></div><b>'+p.pct+'%</b></div>';}).join('');
  h+='<div class="gana">Calza mejor: <strong>'+esc(x.gana.l)+'</strong> · '+esc(x.gana.precio)+(x.laboral_uf>0?' + Gestión Laboral '+esc(x.laboral_uf.toLocaleString('es-CL',{minimumFractionDigits:2,maximumFractionDigits:2}))+' UF':'')
    +'<br><span class="t2" style="font-size:12px">Porque: '+(x.gana.why.length?esc(x.gana.why.join(', ')):'aún faltan datos')+'.</span></div>';
  if(x.basta)h+='<div class="basta">💚 Si con cumplir le basta, recomienda Cumplimiento: genera confianza.</div>';
  h+='<h4>❓ Te falta preguntar</h4><ul>'+(x.falta.length?x.falta.slice(0,6).map(function(f){return '<li style="--c:'+f[0]+'">'+esc(f[1])+'</li>';}).join('')+(x.falta.length>6?'<li style="--c:#8F6F94">… y '+(x.falta.length-6)+' más</li>':''):'<li class="vacio">✓ Tienes lo esencial para prescribir.</li>')+'</ul>';
  h+='<h4>⚠️ Alertas</h4><ul>'+(x.alertas.length?x.alertas.map(function(a){return '<li style="--c:'+a[0]+'">'+esc(a[1])+'</li>';}).join(''):'<li class="vacio">Sin alertas por ahora.</li>')+'</ul>';
  h+='<p class="nd" style="margin:10px 0 0;font-size:11.5px">Precios de referencia del catálogo de Gestoor. La brújula orienta; la propuesta se arma después.</p>';
  el.innerHTML=h;var fn=document.getElementById('fabN');if(fn)fn.textContent=x.alertas.length+x.falta.length;
}

// ── Reloj (30 min: verde → ámbar a los 22 → rojo a los 28) ──
function iniciar(){reloj.corre=true;reloj.t0=Date.now();reloj.int=setInterval(tic,1000);var b=document.getElementById('btnPlay');if(b){b.textContent='⏸';b.setAttribute('aria-label','Pausar el reloj');}}
function pausar(){if(reloj.corre){reloj.base=reloj.seg;}reloj.corre=false;clearInterval(reloj.int);var b=document.getElementById('btnPlay');if(b){b.textContent='▶';b.setAttribute('aria-label','Iniciar el reloj');}}
function tic(){var antes=minuto();reloj.seg=Math.min(14400,reloj.base+Math.floor((Date.now()-reloj.t0)/1000));pintarReloj();if(minuto()!==antes){brujula();if(EDIT&&!BLOQ)marcarSucio(true);}}
function pintarReloj(){
  var el=document.getElementById('reloj');if(!el)return;var rest=1800-reloj.seg,neg=rest<0,a=Math.abs(rest);
  el.textContent=(neg?'+':'')+String(Math.floor(a/60)).padStart(2,'0')+':'+String(a%60).padStart(2,'0');
  var m=reloj.seg/60;el.className='t'+(m>=28?' roj':m>=22?' amb':'');
  var f=document.getElementById('fase');if(f){var i=G.fase(Math.floor(m));f.innerHTML=G.FASES.map(function(n,j){return '<span class="'+(j===i?'on':j<i?'ok':'')+'">'+(j<i?'✓ ':'')+esc(n)+'</span>';}).join('');}
}

// ── Autoguardado ──
function marcarSucio(soloReloj){sucio=true;if(!soloReloj)escribirCache();pintarGuardado();programar(soloReloj?200:1200);}
function programar(ms){clearTimeout(tGuardar);tGuardar=setTimeout(guardar,ms);}
function guardar(){
  if(!EDIT||BLOQ||!sucio)return;
  if(guardando){programar(800);return;}
  guardando=true;var foto=JSON.stringify([S,N,reloj.seg]);pintarGuardado();
  D.rpc('com_bitacora_guardar',{p_id:B.id,p_version:VER,p_campos:S,p_notas:N,p_reloj_seg:reloj.seg}).then(function(r){
    guardando=false;reintento=0;VER=r.version;ultimoOk=new Date();
    if(JSON.stringify([S,N,reloj.seg])===foto){sucio=false;borrarCache();}else{escribirCache();programar(600);}
    pintarGuardado();
  }).catch(function(e){
    guardando=false;
    if(/VERSION_CONFLICTO/.test(e.message)){BLOQ=true;escribirCache();pintarGuardado();pintar();return;}
    if(/BITACORA_CERRADA|SIN_PERMISO|NO_EXISTE|NO_SESSION/.test(e.message)){BLOQ=true;pintarGuardado(D.mensaje(e));return;}
    if(/CLAVE_PROHIBIDA|SII_SOLO|CAMPO|NOTA/.test(e.message)){pintarGuardado(D.mensaje(e));D.toast('🔐 '+D.mensaje(e));return;}
    reintento=Math.min(reintento+1,6);pintarGuardado('Sin conexión · reintentando');programar(2000*reintento);
  });
}
function pintarGuardado(err){
  var g=document.getElementById('guardado');if(!g)return;
  if(B&&B.estado!=='abierta'){g.className='guardado ok';g.textContent='✓ cerrada';return;}
  if(!EDIT){g.className='guardado';g.textContent='solo lectura';return;}
  if(BLOQ){g.className='guardado err';g.textContent=err||'⚠ no se guarda (otra pestaña)';return;}
  if(err){g.className='guardado err';g.textContent='⚠ '+err;return;}
  if(guardando||sucio){g.className='guardado pend';g.textContent='guardando…';return;}
  g.className='guardado ok';g.textContent='✓ guardado'+(ultimoOk?' '+D.hora(ultimoOk.toISOString()):'');
}
window.addEventListener('beforeunload',function(e){if(EDIT&&sucio&&!BLOQ){escribirCache();e.preventDefault();e.returnValue='';}});
document.addEventListener('visibilitychange',function(){if(document.hidden&&sucio)guardar();});
window.addEventListener('online',function(){if(sucio)programar(300);});

// ── Cerrar ──
var confirmando=0;
function cerrar(){
  leerCierreInputs();var msg=document.getElementById('cMsg'),btn=document.getElementById('btnCerrar');msg.className='msg err';
  if(!C.resultado){msg.textContent='Elige el resultado: se realizó o no asistió.';return;}
  if(C.resultado==='realizada'&&!C.temperatura){msg.textContent='Elige la temperatura del prospecto.';return;}
  if(C.desenlace==='perdido'&&!C.motivo){msg.textContent='Elige el motivo de pérdida.';return;}
  if(C.desenlace!=='perdido'&&(!C.accion.trim()||!C.fecha)){msg.textContent='Falta el próximo paso y su fecha.';return;}
  if(C.desenlace!=='perdido'&&C.fecha<D.hoy()){msg.textContent='La fecha del próximo paso debe ser de hoy en adelante.';return;}
  if(Date.now()-confirmando>5000){confirmando=Date.now();btn.textContent='¿Confirmas? Toca otra vez para cerrar';msg.textContent='';return;}
  confirmando=0;btn.disabled=true;btn.textContent='Cerrando…';msg.className='msg';msg.textContent='';
  clearTimeout(tGuardar);pausar();
  var bru=G.brujula(S,minuto());
  D.rpc('com_bitacora_cerrar',{p_id:B.id,p_version:VER,p_campos:S,p_notas:N,p_reloj_seg:reloj.seg,p_resultado:C.resultado,p_temperatura:C.temperatura,
      p_desenlace:C.desenlace,p_proxima_accion:C.desenlace==='perdido'?null:C.accion.trim(),p_proxima_fecha:C.desenlace==='perdido'?null:C.fecha,
      p_motivo_perdida:C.desenlace==='perdido'?C.motivo:null,p_brujula:bru.foto}).then(function(b){
    sucio=false;borrarCache();B=b;VER=b.version;EDIT=false;
    D.toast(b.resultado==='no_asistio'?'Listo: quedó como “no asistió” con el próximo paso para reagendar.':b.desenlace==='perdido'?'Listo: prospecto marcado como perdido.':'Listo: reunión realizada y prospecto en “Diagnóstico hecho”.');
    pintar();window.scrollTo({top:0,behavior:'smooth'});
  }).catch(function(e){
    btn.disabled=false;btn.textContent='🏁 Cerrar reunión';msg.className='msg err';msg.textContent=D.mensaje(e);
    if(/VERSION_CONFLICTO/.test(e.message)){BLOQ=true;pintar();}
  });
}

// ── Línea de tiempo ──
function cargarTl(){
  var el=document.getElementById('tl');if(!el)return;el.innerHTML='<span class="cm-spin"></span>';
  D.rpc('com_linea_tiempo',{p_lead_id:B.lead.id}).then(function(evs){el.innerHTML=tlHTML(evs||[]);}).catch(function(e){el.innerHTML='<div class="aviso rojo">'+esc(D.mensaje(e))+'</div>';});
}
function tlHTML(evs){
  if(!evs.length)return '<p class="nd">Sin movimientos todavía.</p>';
  var mot={};G.MOTIVOS.forEach(function(m){mot[m[0]]=m[1];});
  return '<div class="tl">'+evs.map(function(e){
    var d=e.detalle||{},c='#C77BC9',t='';
    if(e.tipo==='origen'){c='#7FA6FF';t='<b>📣 Llegó</b> · '+esc(D.origen(e).txt)+(e.campana?' · '+esc(e.campana):'')+(e.formulario?' · respondió el formulario':'')+(e.consentimiento?' · consentimiento registrado':'');}
    else if(e.tipo==='reserva_agendada'){c='#5CC8FF';t='<b>📅 Agendó</b> la reunión del '+esc(D.fechaHora(e.inicio))+' · '+esc((D.ESTADO_RES[e.estado]||[e.estado])[0]);}
    else if(e.tipo==='correo_agenda'){c='#FFC85A';t='<b>📧 '+esc(PASOS[e.paso]||e.paso)+'</b> enviado por la agenda';}
    else if(e.tipo==='lead_manual'){c='#E39BE5';t='<b>📞 Prospecto creado</b> sin reserva (llamada o WhatsApp)';}
    else if(e.tipo==='responsable_tomado'){c='#E39BE5';t='<b>🙋 '+esc(e.actor||'Alguien')+'</b> tomó el prospecto';}
    else if(e.tipo==='bitacora_abierta'){c='#5FCF9C';t='<b>📝 Bitácora abierta</b>'+(e.actor?' por '+esc(e.actor):'');}
    else if(e.tipo==='bitacora_cerrada'){c='#5FCF9C';t='<b>🏁 Reunión cerrada</b> · '+(d.resultado==='no_asistio'?'no asistió':'realizada')+(d.temperatura?' · '+esc(D.TEMP[d.temperatura]||d.temperatura):'')+(d.duracion_seg?' · '+Math.round(d.duracion_seg/60)+' min':'');}
    else if(e.tipo==='reserva'){c='#5CC8FF';t='<b>📅 Reserva</b> marcada “'+esc((D.ESTADO_RES[d.estado]||[d.estado])[0])+'”';}
    else if(e.tipo==='etapa'){c='#C77BC9';t='<b>➡️ Etapa</b> '+esc(ETAPAS[d.de]||d.de||'—')+' → '+esc(ETAPAS[d.a]||d.a);}
    else if(e.tipo==='perdido'){c='#E07A6E';t='<b>❌ Perdido</b> · '+esc(mot[d.motivo]||d.motivo);}
    else t='<b>'+esc(e.tipo)+'</b>';
    return '<div class="ev" style="--c:'+c+'"><small>'+esc(D.fechaHora(e.t))+'</small><p>'+t+'</p></div>';}).join('')+'</div>';
}

D.alListo(abrir);
})();
