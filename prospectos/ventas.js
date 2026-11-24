/* ============================================================
   prospectos/ventas.js — Tablero de ventas semanal (VENTAS-CONTROL) · SOLO LECTURA
   Embudo de la semana (agendaron → asistieron → propuestas → aceptaron), tasas (asistencia, aceptación 90 días, días al cierre),
   pendientes vencidos y sin próxima acción por responsable (en rojo), motivos de pérdida, origen / campaña y las últimas 8 semanas.
   Datos: SOLO com_tablero_ventas por RPC con el JWT (ComDatos.rpc). La base decide el alcance (Master y marca comercial: todo).
   Todo texto de la base pasa por esc().
   ============================================================ */
(function(root){
'use strict';
var MOT={precio:'Precio',eligio_otro:'Ya tiene contador',no_responde:'No responde',no_calza:'No califica',lo_hara_solo:'Lo hará por su cuenta',otro:'Otro',sin_motivo:'Sin motivo'};
var ETAPA={nuevo:'Nuevo',agendado:'Agendado',reunion_realizada:'Reunión hecha',no_asistio:'No asistió',propuesta:'Propuesta',seguimiento:'Seguimiento'};
function pct(v){return v===null||v===undefined?'—':Math.round(Number(v))+' %';}
function num(v){return v===null||v===undefined?'—':String(v).replace('.',',');}
function ancho(v,max){return max>0?Math.max(2,Math.round(100*Number(v||0)/max)):0;}
// Agrupa los pendientes por responsable (sin asignar al final).
function agrupar(pend){
  var g={},orden=[];(pend||[]).forEach(function(p){var k=p.responsable?String(p.responsable.id):'0';if(!g[k]){g[k]={nombre:p.responsable?p.responsable.nombre:'Sin asignar',items:[]};orden.push(k);}g[k].items.push(p);});
  orden.sort(function(a,b){return a==='0'?1:b==='0'?-1:g[b].items.length-g[a].items.length;});
  return orden.map(function(k){return g[k];});
}
root.ComTablero={agrupar:agrupar,pct:pct};
if(typeof document==='undefined'||!root.ComDatos||!document.getElementById('tvApp'))return;
var D=root.ComDatos, esc=D.esc, app=document.getElementById('tvApp'), dm=D.DEMO?'&demo=1':'', LUNES=null, T=null;
function ic(n,c){return '<i class="ic '+c+'" aria-hidden="true">'+(root.gIcon?root.gIcon(n):'')+'</i>';}
if(D.DEMO){document.documentElement.classList.remove('auth-pending');var dmo=document.getElementById('cmDemo');if(dmo)dmo.hidden=false;var vc=document.getElementById('tvCrm');if(vc)vc.href='crm.html?demo=1';}
try{var q=new URLSearchParams(location.search).get('semana');if(q&&/^\d{4}-\d{2}-\d{2}$/.test(q))LUNES=q;}catch(e){}

function cargar(){
  return D.rpc('com_tablero_ventas',{p_lunes:LUNES}).then(function(t){T=t;LUNES=t.lunes;pintar();})
    .catch(function(e){app.innerHTML='<div class="aviso rojo">'+esc((root.ComVentas?root.ComVentas.mensaje(e):D.mensaje(e)))+'</div>';});
}
// «Calidad de los datos»: cuántos registros quedan fuera o dudosos y por qué; cada número despliega la lista para corregirla en el CRM.
var CAL=[['sin_utm','Sin origen / campaña (UTM)','No se puede saber qué campaña los trajo (últimos 90 días).'],
  ['reunion_sin_resultado','Reuniones pasadas sin resultado','Ni «realizada» ni «no asistió»: no cuentan en la asistencia.'],
  ['propuesta_sin_fecha','Propuestas sin fecha de envío','En propuesta o seguimiento sin registro de cuándo se envió: no entran en aceptación ni días al cierre.'],
  ['ganado_sin_fecha','Ganados sin fecha','Sin registro de cuándo aceptaron: no entran en días al cierre.'],
  ['perdido_incompleto','Perdidos sin motivo o sin fecha','No cuentan en «Motivos de pérdida».']];
function calidadHtml(c){
  if(!c||!c.grupos)return '';var g=c.grupos,tot=CAL.reduce(function(a,x){return a+Number((g[x[0]]||{}).n||0);},0);
  return '<section class="card acc c-azu tv-cal"><div class="h">'+ic('ver','c-azu')+'<h2>Calidad de los datos</h2><small>'+(tot?tot+' registros por revisar':'todo en orden')
    +(c.historial_desde?' · historial confiable desde el '+esc(fechaCorta(c.historial_desde)):'')+'</small></div>'
    +CAL.map(function(x){var d=g[x[0]]||{n:0,items:[]},n=Number(d.n||0);
      return '<details class="tv-cal-g'+(n?' hay':'')+'"'+(n?'':' aria-disabled="true"')+'><summary><b class="tv-cal-n">'+n+'</b><span><b>'+esc(x[1])+'</b><br><span class="t2">'+esc(x[2])+'</span></span></summary>'
        +(n?'<ul>'+(d.items||[]).map(function(i){return '<li><a href="crm.html?lead='+Number(i.lead_id)+dm+'">'+esc(i.nombre||'Prospecto')+'</a> <span class="t2">· '+esc(i.empresa||'Empresa no informada')+' · '+esc(i.detalle||'')+'</span></li>';}).join('')
          +(n>(d.items||[]).length?'<li class="t3">… y '+(n-(d.items||[]).length)+' más</li>':'')+'</ul>':'<p class="nd">Nada por corregir.</p>')+'</details>';}).join('')+'</section>';
}
function fechaCorta(y){var p=String(y).split('-');return Number(p[2])+'-'+p[1];}
function pintar(){
  var t=T,s=t.semana||{},ta=t.tasas||{},hoySem=D.hoy()>=t.lunes&&D.hoy()<=t.domingo;
  var h='<div class="tv-nav"><button type="button" class="btn sm" data-sem="-7" aria-label="Semana anterior">‹</button>'
    +(hoySem?'':'<button type="button" class="btn sm" data-sem="0">Esta semana</button>')
    +'<button type="button" class="btn sm" data-sem="7" aria-label="Semana siguiente"'+(hoySem?' disabled':'')+'>›</button>'
    +'<b>Semana del lunes '+esc(fechaCorta(t.lunes))+' al domingo '+esc(fechaCorta(t.domingo))+'</b>'
    +(t.alcance_total?'':'<span class="crm-nota">Ves solo tus prospectos y los sin asignar.</span>')+'</div>';
  // Embudo de la semana
  var pasos=[['Agendaron','agendados','calendario','c-cel','#5CC8FF','reservas nuevas de la semana'],['Asistieron','asistieron','check','c-ver','#5FCF9C',(s.no_asistieron||0)+' no asistieron · '+(s.por_cerrar||0)+' por cerrar'],
    ['Propuestas enviadas','propuestas','enviar','c-ama','#FFD24D','pasaron a «Propuesta enviada»'],['Aceptaron','aceptaron','trofeo','c-lil','#E39BE5',(s.perdidos||0)+' perdidos en la semana']];
  var mx=Math.max.apply(null,pasos.map(function(x){return Number(s[x[1]]||0);}).concat([1]));
  h+='<div class="tv-embudo" role="list" aria-label="Embudo de la semana">'+pasos.map(function(x){
    return '<div class="tv-paso" role="listitem" style="--c:'+x[4]+'"><div class="h">'+ic(x[2],x[3])+'<span class="t2">'+esc(x[0])+'</span></div><div class="v">'+Number(s[x[1]]||0)+'</div>'
      +'<div class="s">'+esc(x[5])+'</div><div class="tv-barra" aria-hidden="true"><i style="width:'+ancho(s[x[1]],mx)+'%"></i></div></div>';}).join('')+'</div>';
  // Tasas
  h+='<div class="tv-tasas">'
    +'<div class="tv-tasa"><b>'+pct(ta.asistencia)+'</b><span>Asistencia de la semana (asistieron / asistieron + no asistieron)</span><em>n = '+Number(ta.n_asistencia||0)+' reuniones</em></div>'
    +'<div class="tv-tasa"><b>'+pct(ta.aceptacion_90d)+'</b><span>Aceptación últimos 90 días (hoy clientes / recibieron propuesta)</span><em>n = '+Number(ta.propuestas_90d||0)+' propuestas</em></div>'
    +'<div class="tv-tasa"><b>'+num(ta.dias_cierre_desde_llegada)+' d</b><span>Días promedio al cierre, desde que llegó</span><em>n = '+Number(ta.ganados_90d||0)+' ganados en 90 días</em></div>'
    +'<div class="tv-tasa"><b>'+num(ta.dias_cierre_desde_propuesta)+' d</b><span>Días promedio desde la propuesta hasta que aceptó</span><em>n = '+Number(ta.n_cierre_propuesta||0)+' ganados con propuesta registrada</em></div></div>';
  h+=calidadHtml(t.calidad);
  // Pendientes vencidos (rojo) + motivos
  var grupos=agrupar(t.pendientes), tot=(t.pendientes||[]).length, ts=t.tareas_semana||{};
  h+='<div class="tv-grid"><section class="card acc c-roj"><div class="h">'+ic('alerta','c-roj')+'<h2>Pendientes vencidos y sin próxima acción</h2><small>'+tot+' prospecto'+(tot===1?'':'s')+'</small></div>'
    +'<p class="crm-nota">Esta semana: '+Number(ts.hechas||0)+' tareas hechas · '+Number(ts.omitidas||0)+' omitidas · '+Number(ts.vencidas_hoy||0)+' tareas vencidas hoy.</p>';
  if(!tot)h+='<div class="aviso verde">✅ Todo al día: ningún prospecto abierto con la acción vencida ni sin próxima acción.</div>';
  grupos.forEach(function(g){
    h+='<div class="tv-grupo">'+D.avatarResp({nombre:g.nombre==='Sin asignar'?'':g.nombre})+esc(g.nombre)+'<span class="cnt">'+g.items.length+'</span></div><div class="tv-scroll"><table class="tv-tabla"><thead><tr><th>Prospecto</th><th>Etapa</th><th>Qué falta</th><th class="n">Atraso</th></tr></thead><tbody>'
      +g.items.map(function(p){return '<tr class="rojo"><td><a href="crm.html?lead='+Number(p.lead_id)+dm+'">'+esc(p.nombre||'Prospecto')+'</a><br><span class="t2">'+esc(p.empresa||'Empresa no informada')+'</span></td>'
        +'<td>'+esc(ETAPA[p.etapa]||p.etapa||'Nuevo')+'</td><td>'+(p.sin_proxima&&!p.fecha?'<b>Sin próxima acción</b>':esc(p.accion||'Contactar')+'<br><span class="t2">era para el '+esc(fechaCorta(p.fecha))+'</span>')+'</td>'
        +'<td class="n">'+(p.fecha&&p.dias_atraso>0?Number(p.dias_atraso)+' d':'—')+'</td></tr>';}).join('')+'</tbody></table></div>';
  });
  h+='</section><section class="card acc c-amb"><div class="h">'+ic('lista','c-amb')+'<h2>Motivos de pérdida</h2><small>semana · 90 días</small></div>';
  var mo=t.motivos||[], mm=Math.max.apply(null,mo.map(function(x){return Number(x.d90||0);}).concat([1]));
  h+=mo.length?mo.map(function(m){return '<div class="tv-mot"><span>'+esc(MOT[m.motivo]||m.motivo)+'</span><div class="tv-barra" style="--c:#FFC85A"><i style="width:'+ancho(m.d90,mm)+'%"></i></div><span class="t2">'+Number(m.semana||0)+' · '+Number(m.d90||0)+'</span></div>';}).join('')
    :'<div class="nd">Sin perdidos en los últimos 90 días.</div>';
  h+='</section></div>';
  // Últimas 8 semanas
  var se=t.series||[], ms=Math.max.apply(null,se.map(function(w){return Math.max(w.agendados||0,w.asistieron||0,w.propuestas||0,w.aceptaron||0);}).concat([1]));
  var COL=[['agendados','#5CC8FF','Agendaron'],['asistieron','#5FCF9C','Asistieron'],['propuestas','#FFD24D','Propuestas'],['aceptaron','#E39BE5','Aceptaron']];
  h+='<div class="tv-grid"><section class="card acc c-cel"><div class="h">'+ic('grafico','c-cel')+'<h2>Últimas 8 semanas</h2></div><div class="tv-serie" role="img" aria-label="Embudo de las últimas 8 semanas">'
    +se.map(function(w){return '<div class="tv-col'+(w.lunes===t.lunes?' on':'')+'" title="'+esc('Semana del '+fechaCorta(w.lunes)+': '+COL.map(function(c){return c[2]+' '+(w[c[0]]||0);}).join(' · '))+'"><div class="bs">'
      +COL.map(function(c){return '<i style="background:'+c[1]+';height:'+ancho(w[c[0]],ms)+'%"></i>';}).join('')+'</div><small>'+esc(fechaCorta(w.lunes))+'</small></div>';}).join('')
    +'</div><div class="tv-ley">'+COL.map(function(c){return '<span><i style="background:'+c[1]+'"></i>'+esc(c[2])+'</span>';}).join('')+'</div></section>';
  // Origen / campaña
  var og=t.origenes||[];
  h+='<section class="card acc c-lil"><div class="h">'+ic('objetivo','c-lil')+'<h2>Origen y campaña</h2><small>llegados en 90 días</small></div>'
    +(og.length?'<div class="tv-scroll"><table class="tv-tabla"><thead><tr><th>Origen · campaña</th><th class="n">Llegaron</th><th class="n">Asist.</th><th class="n">Prop.</th><th class="n">Ganados</th></tr></thead><tbody>'
      +og.map(function(o){return '<tr><td>'+esc(o.origen)+(o.fuente||o.campana?'<br><span class="t2">'+esc([o.fuente,o.campana].filter(Boolean).join(' · '))+'</span>':'')+'</td><td class="n">'+Number(o.llegaron||0)+(o.semana?' <span class="t2">(+'+Number(o.semana)+')</span>':'')+'</td>'
        +'<td class="n">'+Number(o.asistieron||0)+'</td><td class="n">'+Number(o.propuestas||0)+'</td><td class="n">'+Number(o.clientes||0)+'</td></tr>';}).join('')+'</tbody></table></div>'
     :'<div class="nd">Sin prospectos nuevos en 90 días.</div>')+'</section></div>';
  h+='<p class="crm-nota">Las propuestas y los ganados se cuentan desde los cambios de etapa registrados en Gestoor'+(t.calidad&&t.calidad.historial_desde?' (historial confiable desde el '+esc(fechaCorta(t.calidad.historial_desde))+')':'')+'. Solo lectura: para actuar, abre el prospecto en el CRM.</p>';
  app.innerHTML=h;
  app.querySelectorAll('[data-sem]').forEach(function(b){b.onclick=function(){var v=Number(b.getAttribute('data-sem'));LUNES=v===0?null:D.sumarDias(T.lunes,v);
    try{var u=new URLSearchParams(location.search);if(LUNES)u.set('semana',LUNES);else u.delete('semana');history.replaceState(null,'',location.pathname+(u.toString()?'?'+u.toString():''));}catch(e){}
    app.innerHTML='<div class="aviso lila"><span class="cm-spin"></span>Cargando…</div>';cargar();};});
}
D.alListo(cargar);
})(typeof window!=='undefined'?window:globalThis);
