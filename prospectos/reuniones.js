/* ============================================================
   prospectos/reuniones.js — Reuniones (puerta de entrada del módulo Comercial · C1)
   Agenda de diagnósticos: hoy, mañana, la semana y las próximas, con hora, prospecto, origen, responsable, estado de la reserva,
   enlace a Teams y "Abrir bitácora" / "Continuar". Más "+ Bitácora sin reserva" (llamada o WhatsApp fuera de la agenda).
   Datos: RPC com_listar_hoy (la base decide qué ve cada uno: el Master todo; cada responsable lo suyo y lo sin asignar).
   ============================================================ */
(function(){
'use strict';
var D=window.ComDatos, esc=D.esc;
var app=document.getElementById('cmApp');
var DATA=null, VISTA='hoy', RESP=(window.GEquipo?GEquipo.leerUrl():'todos');
var VISTAS=[['hoy','Hoy'],['manana','Mañana'],['semana','7 días'],['proximas','Próximas'],['todo','Todo']];

if(D.DEMO){document.documentElement.classList.remove('auth-pending');var dm=document.getElementById('cmDemo');if(dm)dm.hidden=false;}
try{var v=new URLSearchParams(location.search).get('vista');if(VISTAS.some(function(x){return x[0]===v;}))VISTA=v;}catch(e){}

function cargar(){
  D.rpc('com_listar_hoy',{p_dias:45}).then(function(r){DATA=r||{};pintar();}).catch(function(e){
    app.innerHTML='<div class="aviso rojo">'+esc(D.mensaje(e))+'</div>';
  });
}
function filasResp(){return (DATA.reuniones||[]).map(function(x){var r=x.lead&&x.lead.responsable;return {resp:r?r.nombre:'',resp_id:r?r.id:null,x:x};});}
function grupo(x){
  var d=D.ymd(x.inicio), h=D.hoy();
  if(d<h)return porCerrar(x)?'cerrar':'pasada';
  if(d===h)return 'hoy';
  if(d===D.sumarDias(h,1))return 'manana';
  if(d<=D.sumarDias(h,7))return 'semana';
  return 'proximas';
}
// Ya terminó y sigue sin resultado (reserva confirmada o bitácora abierta).
function porCerrar(x){return new Date(x.fin).getTime()<Date.now()&&(x.estado==='confirmada'||!!(x.bitacora&&x.bitacora.estado==='abierta'));}
function enVista(g){
  if(VISTA==='todo')return g!=='pasada';
  if(VISTA==='hoy')return g==='hoy';
  if(VISTA==='manana')return g==='manana';
  if(VISTA==='semana')return g==='hoy'||g==='manana'||g==='semana';
  return g==='proximas';
}
function botonBitacora(x,grande){
  var b=x.bitacora, puede=DATA.yo&&DATA.yo.escribe, url='bitacora.html?reserva='+Number(x.reserva_id)+(D.DEMO?'&demo=1':'');
  if(b&&b.estado!=='abierta')return '<a class="btn sm" href="bitacora.html?id='+Number(b.id)+(D.DEMO?'&demo=1':'')+'">📄 Ver bitácora</a>';
  if(b)return '<a class="btn p'+(grande?' xl':' sm')+'" href="'+url+'">📝 Continuar bitácora</a>';
  if(!puede||x.estado==='cancelada'||x.estado==='inconsistente')return '';
  return '<a class="btn p'+(grande?' xl':' sm')+'" href="'+url+'">📝 Abrir bitácora</a>';
}
function reuHTML(x,g){
  var l=x.lead||{}, o=D.origen(l), est=D.ESTADO_RES[x.estado]||[x.estado,'gris'];
  var ini=new Date(x.inicio).getTime(), ahora=Date.now(), min=Math.round((ini-ahora)/60000);
  var enCurso=ahora>=ini&&ahora<=new Date(x.fin).getTime()&&x.estado==='confirmada';
  var pronto=x.estado==='confirmada'&&min>=0&&min<=30;
  var clase='reu'+((pronto||enCurso)?' ahora':'')+(porCerrar(x)?' pasada':'')+(x.estado==='cancelada'?' apagada':'');
  var r=l.responsable;
  var teams=x.teams&&x.estado==='confirmada'?'<a class="btn sm" href="'+esc(x.teams)+'" target="_blank" rel="noopener">🎥 Teams</a>':'';
  return '<div class="'+clase+'"><div class="hora">'+esc(D.hora(x.inicio))+'<small>'+(g==='cerrar'||g==='proximas'||g==='semana'?esc(D.diaLargo(D.ymd(x.inicio)).replace(/,.*/,'')+' '+D.ymd(x.inicio).slice(8)+'-'+D.ymd(x.inicio).slice(5,7)):'30 min')+'</small></div>'
    +'<div style="min-width:0"><h3>'+esc(l.nombre||'Prospecto')+'</h3><p>'+esc(l.empresa||'Empresa no informada')+'</p>'
    +'<div class="meta">'+(l.semaforo?'<span class="sem '+esc(l.semaforo)+'" title="Semáforo '+esc(l.semaforo)+'"></span>':'')
    +'<span class="estado gris" title="'+esc(o.campana)+'">'+esc(o.txt)+(o.campana?' · '+esc(o.campana):'')+'</span>'
    +'<span class="estado '+est[1]+'">'+esc(est[0])+'</span>'
    +(enCurso?'<span class="estado ambar">● En curso</span>':pronto?'<span class="estado ambar">⏰ en '+min+' min</span>':'')
    +(porCerrar(x)?'<span class="estado ambar">📝 por cerrar</span>':'')
    +(l.temperatura?'<span class="estado lila">'+esc(D.TEMP[l.temperatura]||l.temperatura)+'</span>':'')
    +'<span class="resp">'+D.avatarResp(r)+(r?esc(r.nombre.split(' ')[0]):'<span class="nd">Sin asignar</span>')+'</span>'
    +'</div></div><div class="acc">'+botonBitacora(x,pronto||enCurso)+teams+'</div></div>';
}
function pintar(){
  var yo=DATA.yo||{}, h=D.hoy();
  var filas=filasResp().filter(function(f){return !window.GEquipo||GEquipo.pasa(f,RESP);});
  var todas=filas.map(function(f){return {x:f.x,g:grupo(f.x)};});
  var cuenta=function(fn){return todas.filter(fn).length;};
  var nHoy=cuenta(function(t){return t.g==='hoy'&&t.x.estado!=='cancelada';}), nMan=cuenta(function(t){return t.g==='manana'&&t.x.estado!=='cancelada';});
  var nSem=cuenta(function(t){return (t.g==='hoy'||t.g==='manana'||t.g==='semana')&&t.x.estado!=='cancelada';});
  var nProx=cuenta(function(t){return t.g==='proximas'&&t.x.estado!=='cancelada';});
  var sinR=(DATA.sin_reserva||[]).filter(function(b){return b.estado==='abierta';});
  var nCerrar=cuenta(function(t){return porCerrar(t.x);})+sinR.length;
  var sig=todas.filter(function(t){return t.g==='hoy'&&t.x.estado==='confirmada'&&new Date(t.x.fin).getTime()>Date.now();})[0];
  var hh='';
  hh+='<div class="kpis">'
    +'<button type="button" class="kpi'+(VISTA==='hoy'?' on':'')+'" data-v="hoy"><small>Reuniones hoy</small><b>'+nHoy+'</b><p>'+(sig?'Próxima '+esc(D.hora(sig.x.inicio))+' · '+esc((sig.x.lead||{}).nombre||''):'Sin reuniones pendientes hoy')+'</p></button>'
    +'<button type="button" class="kpi'+(VISTA==='manana'?' on':'')+'" data-v="manana" style="--c:var(--cel)"><small>Mañana</small><b>'+nMan+'</b><p>'+esc(D.diaLargo(D.sumarDias(h,1)))+'</p></button>'
    +'<button type="button" class="kpi'+(VISTA==='semana'?' on':'')+'" data-v="semana" style="--c:var(--lila2)"><small>Próximos 7 días</small><b>'+nSem+'</b><p>incluye hoy y mañana</p></button>'
    +'<button type="button" class="kpi" data-v="cerrar" style="--c:var(--ambar)"><small>Por cerrar</small><b>'+nCerrar+'</b><p>'+(nCerrar?'marca resultado y próximo paso':'todo al día ✓')+'</p></button>'
    +'<button type="button" class="kpi'+(VISTA==='proximas'?' on':'')+'" data-v="proximas" style="--c:var(--verde)"><small>Más adelante</small><b>'+nProx+'</b><p>después de 7 días</p></button>'
    +'</div>';
  // Barra: vista + responsable + sin reserva
  var opts=window.GEquipo?GEquipo.opciones(filasResp(),function(){return true;}):[];
  hh+='<div class="cm-barra"><div class="cm-seg" role="group" aria-label="Periodo">'+VISTAS.map(function(v){return '<button type="button" data-v="'+v[0]+'" class="'+(VISTA===v[0]?'on':'')+'" aria-pressed="'+(VISTA===v[0])+'">'+v[1]+'</button>';}).join('')+'</div>'
    +(window.GEquipo&&opts.length>1?GEquipo.filtroHtml(opts,RESP,filasResp().length):'')
    +'<span class="cm-esp"></span>'+(yo.escribe?'<button type="button" class="btn" id="btnSinRes">＋ Bitácora sin reserva</button>':'')+'</div>';
  if(!yo.escribe)hh+='<div class="aviso cel">👀 Puedes ver la agenda. Abrir y editar bitácoras es solo para el Master y el equipo Comercial.</div>';

  // Por cerrar (siempre arriba si hay)
  var lCerrar=todas.filter(function(t){return t.g==='cerrar';});
  var col='';
  if(lCerrar.length||sinR.length){
    col+='<div class="card acc c-amb"><div class="h"><span class="ic">📝</span><h2>Por cerrar</h2><small>reuniones que ya pasaron sin resultado</small></div>'
      +lCerrar.map(function(t){return reuHTML(t.x,'cerrar');}).join('')
      +sinR.map(function(b){var l=b.lead||{};return '<div class="reu pasada"><div class="hora">📞<small>sin reserva</small></div><div style="min-width:0"><h3>'+esc(l.nombre)+'</h3><p>'+esc(l.empresa||'Empresa no informada')+' · abierta '+esc(D.fechaHora(b.iniciada_at))+'</p><div class="meta"><span class="estado ambar">📝 sin cerrar</span><span class="resp">'+D.avatarResp(l.responsable)+(l.responsable?esc(l.responsable.nombre.split(' ')[0]):'')+'</span></div></div><div class="acc"><a class="btn p sm" href="bitacora.html?id='+Number(b.id)+(D.DEMO?'&demo=1':'')+'">📝 Continuar bitácora</a></div></div>';}).join('')
      +'</div>';
  }
  // Agenda por día
  var vis=todas.filter(function(t){return enVista(t.g);}).sort(function(a,b){return new Date(a.x.inicio)-new Date(b.x.inicio);});
  var titulo={hoy:'Reuniones de hoy',manana:'Reuniones de mañana',semana:'Próximos 7 días',proximas:'Más adelante',todo:'Toda la agenda'}[VISTA];
  col+='<div class="card acc c-lil"><div class="h"><span class="ic">📅</span><h2>'+esc(titulo)+'</h2><small>diagnóstico gratuito · 30 min por Teams</small></div>';
  if(!vis.length)col+='<div class="cm-vacio">'+(VISTA==='hoy'?'No hay reuniones hoy. ':'No hay reuniones en este periodo. ')+'Revisa “Próximas” o “Todo”.</div>';
  var dia='';
  vis.forEach(function(t){var d=D.ymd(t.x.inicio);if(d!==dia){dia=d;col+='<div class="dia"><b>'+(d===h?'Hoy':d===D.sumarDias(h,1)?'Mañana':'')+'</b>'+esc(D.diaLargo(d))+'<i></i></div>';}col+=reuHTML(t.x,t.g);});
  col+='</div>';

  var lat='<div class="lat"><div class="card acc c-cel"><div class="h"><span class="ic">💡</span><h2>Cómo funciona</h2></div><ol class="pasos-l">'
    +'<li><b>Abrir bitácora</b> desde la reunión (o desde el aviso ⏰ de la campana).</li>'
    +'<li>Llega <b>precargada</b> con lo que respondió en la agenda.</li>'
    +'<li>Guion por bloques + botones rápidos + 🧭 brújula durante la llamada. Se guarda sola.</li>'
    +'<li>Al terminar, <b>Cerrar reunión</b>: resultado, temperatura y próximo paso.</li>'
    +'<li>Los datos 🧩 quedan listos para el onboarding si acepta.</li></ol>'
    +'<p class="nd" style="margin:10px 0 0">🔐 La clave SII nunca se anota: solo “¿tiene acceso? sí/no”.</p></div>'
    +'<div class="card acc c-ver"><div class="h"><span class="ic">🧭</span><h2>Accesos</h2></div>'
    +'<a class="mini" href="index.html" style="text-decoration:none;color:inherit"><span class="ic c-lil">💼</span><span><b>Cartera de prospectos</b><small>embudo, campañas y fichas</small></span></a>'
    +'<a class="mini" href="https://agenda.contadoor.cl" target="_blank" rel="noopener" style="text-decoration:none;color:inherit"><span class="ic c-cel">🗓️</span><span><b>agenda.contadoor.cl</b><small>donde agendan los prospectos</small></span></a></div></div>';

  app.innerHTML=hh+'<div class="cm-grid"><div class="lat">'+col+'</div>'+lat+'</div>';
  enlazar();
}
function enlazar(){
  app.querySelectorAll('[data-v]').forEach(function(b){b.onclick=function(){
    var v=b.getAttribute('data-v');
    if(v==='cerrar'){var c=app.querySelector('.c-amb');if(c)c.scrollIntoView({behavior:'smooth',block:'start'});else D.toast('No hay reuniones por cerrar.');return;}
    VISTA=v;guardarUrl();pintar();};});
  app.querySelectorAll('[data-resp]').forEach(function(b){b.onclick=function(){RESP=b.getAttribute('data-resp');guardarUrl();pintar();};});
  var sel=app.querySelector('select.geq-sel-in');if(sel)sel.onchange=function(){RESP=sel.value;guardarUrl();pintar();};
  var bs=document.getElementById('btnSinRes');if(bs)bs.onclick=modalSinReserva;
}
function guardarUrl(){try{var p=new URLSearchParams(location.search);if(VISTA!=='hoy')p.set('vista',VISTA);else p.delete('vista');if(window.GEquipo)GEquipo.escribirUrl(p,RESP);var s=p.toString();history.replaceState(null,'',location.pathname+(s?'?'+s:''));}catch(e){}}

// ── + Bitácora sin reserva ──
function modalSinReserva(){
  var lista=DATA.prospectos||[], elegido=null, modo='existente';
  var velo=document.createElement('div');velo.className='cm-velo';
  var m=document.createElement('div');m.className='cm-modal';m.setAttribute('role','dialog');m.setAttribute('aria-modal','true');m.setAttribute('aria-labelledby','mTit');
  function cerrar(){velo.remove();m.remove();document.removeEventListener('keydown',tecla);}
  function tecla(e){if(e.key==='Escape')cerrar();}
  function dibujar(){
    var f=(m.querySelector('#mBus')||{}).value||'';var fl=f.trim().toLowerCase();
    m.innerHTML='<h2 id="mTit">＋ Bitácora sin reserva</h2><p>Para una llamada o un WhatsApp que no pasó por la agenda. No crea una reserva ni envía correos al prospecto.</p>'
      +'<div class="cm-seg" role="group" aria-label="Tipo"><button type="button" data-m="existente" class="'+(modo==='existente'?'on':'')+'">Prospecto existente</button><button type="button" data-m="nuevo" class="'+(modo==='nuevo'?'on':'')+'">Prospecto nuevo</button></div>'
      +(modo==='existente'
        ?'<label class="lbl" for="mBus">Buscar</label><input class="inp" id="mBus" type="search" placeholder="Nombre o empresa" value="'+esc(f)+'" autocomplete="off">'
          +'<div class="cm-lista-p">'+(lista.filter(function(p){return !fl||(String(p.nombre)+' '+String(p.empresa||'')).toLowerCase().indexOf(fl)>=0;}).slice(0,60).map(function(p){
            return '<button type="button" data-id="'+Number(p.id)+'" class="'+(elegido===p.id?'on':'')+'"><span><b>'+esc(p.nombre)+'</b><br><small>'+esc(p.empresa||'Empresa no informada')+'</small></span><small>'+esc(p.etapa||'')+'</small></button>';}).join('')||'<div class="cm-vacio">Sin resultados. Usa “Prospecto nuevo”.</div>')+'</div>'
        :'<label class="lbl" for="mNom">Nombre del contacto</label><input class="inp" id="mNom" maxlength="120" autocomplete="off" placeholder="Ej.: Camila Rojas">'
          +'<label class="lbl" for="mEmp">Empresa (opcional)</label><input class="inp" id="mEmp" maxlength="160" autocomplete="off" placeholder="Ej.: Ferretería Los Aromos SpA">'
          +'<p class="nd" style="margin:8px 0 0">Solo nombre y empresa: el contacto (correo y teléfono) se completa después en la ficha.</p>')
      +'<div class="msg err" id="mMsg" role="status"></div>'
      +'<div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:10px"><button type="button" class="btn" id="mNo">Cancelar</button><button type="button" class="btn p" id="mSi">📝 Abrir bitácora</button></div>';
    m.querySelectorAll('[data-m]').forEach(function(b){b.onclick=function(){modo=b.getAttribute('data-m');dibujar();};});
    m.querySelectorAll('.cm-lista-p button[data-id]').forEach(function(b){b.onclick=function(){elegido=Number(b.getAttribute('data-id'));dibujar();};});
    var bus=m.querySelector('#mBus');if(bus){bus.oninput=function(){var pos=bus.selectionStart;dibujar();var n=m.querySelector('#mBus');n.focus();try{n.setSelectionRange(pos,pos);}catch(e){}};}
    m.querySelector('#mNo').onclick=cerrar;
    m.querySelector('#mSi').onclick=function(){
      var args={p_guion_version:window.ComGuionVersion||'c1-2026-10-26'}, msg=m.querySelector('#mMsg');
      if(modo==='existente'){if(!elegido){msg.textContent='Elige un prospecto de la lista.';return;}args.p_lead_id=elegido;}
      else{var n=m.querySelector('#mNom').value.trim();if(n.length<2){msg.textContent='Escribe el nombre (mínimo 2 letras).';return;}args.p_nombre=n;args.p_empresa=m.querySelector('#mEmp').value.trim()||null;}
      this.disabled=true;msg.className='msg';msg.textContent='Abriendo…';
      D.rpc('com_bitacora_abrir',args).then(function(b){location.href='bitacora.html?id='+Number(b.id)+(D.DEMO?'&demo=1':'');})
        .catch(function(e){msg.className='msg err';msg.textContent=D.mensaje(e);m.querySelector('#mSi').disabled=false;});
    };
  }
  document.body.appendChild(velo);document.body.appendChild(m);velo.onclick=cerrar;document.addEventListener('keydown',tecla);dibujar();
  var p=m.querySelector('#mBus');if(p)p.focus();
}

D.alListo(cargar);
setInterval(function(){if(DATA&&!document.hidden&&!document.querySelector('.cm-modal'))cargar();},120000);   // refresco suave cada 2 min
})();
