/* ============================================================
   prospectos/crm.js — CRM de Prospectos (maqueta aprobada por Luciano · descargas/crm_prospectos/maqueta.html)
   1. 🧭 Embudo de ventas: columnas por etapa REAL de public.leads, tarjetas arrastrables (HTML5) y, para teclado y celular,
      "Mover a…" en la ficha lateral. Etapas fuera de las columnas → "Otros" (nunca se pierde un prospecto).
   2. 📅 Reuniones: semana lunes a viernes (hora de Chile) con las reservas reales de la agenda.
   3. Ficha lateral: lo que nos contó, semáforo, su empresa (leads.respuestas vía detalle_prospecto), qué viene y accesos
      a las pantallas que ya existen (simple.html, bitácora, cotizaciones, onboarding, WhatsApp).
   Datos: SOLO RPC existentes con el JWT (ComDatos.rpc): com_simple_listar, com_listar_hoy, detalle_prospecto y, para mover,
   com_ficha_guardar con los MISMOS argumentos de simple.js (ComSimple.argsFicha, con p_actualizado). La base decide qué ve y
   qué edita cada uno. Todo texto de la base pasa por esc().
   ============================================================ */
(function(root){
'use strict';
var S=root.ComSimple||{};

// ── Columnas del embudo (orden del flujo) y cerradas. id = etapa que se guarda en public.leads ──
var COLUMNAS=[
  {id:'nuevo',n:'Nuevo',c:'#5CC8FF',h:'Llegó, aún sin reunión'},
  {id:'agendado',n:'Reunión agendada',c:'#C77BC9',h:'Tiene hora en la agenda'},
  {id:'reunion_realizada',n:'Reunión hecha',c:'#E39BE5',h:'Falta enviar propuesta'},
  {id:'propuesta',n:'Propuesta enviada',c:'#FFD24D',h:'Esperando respuesta'},
  {id:'seguimiento',n:'Seguimiento',c:'#FF9F43',h:'Negociando / dudas'},
  {id:'cliente',n:'Ganado 🎉',c:'#5FCF9C',h:'Pasa a Onboarding'}];
var CERRADAS=[
  {id:'no_asistio',n:'No asistió',c:'#E07A6E',h:'Reagendar o cerrar'},
  {id:'descartado',n:'Perdido',c:'#8A7490',h:'Queda en el historial'},
  {id:'no_calificado',n:'No calificado',c:'#8A7490',h:'Sin agendar'},
  {id:'otros',n:'Otros',c:'#8F6F94',h:'Otras etapas (no se mueven aquí)'}];
// Etapas que acepta com_ficha_guardar (ck_leads_etapa). "otros" NO es una etapa: no se puede soltar ahí.
var ETAPAS_RPC=['nuevo','agendado','reunion_realizada','no_asistio','propuesta','seguimiento','cliente','emprendedor_solicitado','no_calificado','descartado'];
var CERR_FIN=['cliente','descartado','no_calificado'];   // ya no llevan "acción atrasada"
var SEM={verde:'#5FCF9C',amarillo:'#FFD24D',rojo:'#E07A6E'};
var SEM_TXT={verde:'Verde',amarillo:'Amarillo',rojo:'Rojo'};
// Mismas etiquetas legibles que la ficha completa (index.html) para leads.respuestas.
var VENTAS={hasta5:'Hasta $5M','5a20':'$5M a $20M','20a50':'$20M a $50M',mas50:'Más de $50M','20a80':'$20M a $80M',mas80:'Más de $80M'};
var TRAB={ninguno:'Sin trabajadores','1a5':'1 a 5','6a20':'6 a 20',mas20:'Más de 20'};
var CONTAB={yo:'La lleva él/ella mismo/a',externo:'Contador externo',interno:'Contador interno',nadie:'Nadie aún'};
var SINO={si:'Sí',no:'No',nose:'No está seguro'};
var EST_REU={confirmada:['ag','Agendada'],realizada:['hecha','Realizada'],no_asistio:['na','No asistió'],cancelada:['can','Cancelada'],inconsistente:['rev','Revisar en Outlook']};

function todas(){return COLUMNAS.concat(CERRADAS);}
function columnaDe(et){
  if(!et)return 'nuevo';   // sin etapa = nuevo (igual que la base: COALESCE(etapa,'nuevo'))
  var c=todas().filter(function(x){return x.id===et&&x.id!=='otros';})[0];
  return c?c.id:'otros';
}
function infoColumna(id){return todas().filter(function(x){return x.id===id;})[0]||CERRADAS[CERRADAS.length-1];}
function esDestino(et){return et!=='otros'&&ETAPAS_RPC.indexOf(et)>=0&&todas().some(function(x){return x.id===et;});}
function agrupar(lista){
  var g={};todas().forEach(function(c){g[c.id]=[];});
  (lista||[]).forEach(function(p){g[columnaDe(p.etapa)].push(p);});
  return g;
}
// Etiqueta de la etapa: la de la columna si tiene; si no, la de simple.js (ej. "Cumplimiento solicitado").
function nombreEtapa(et){var c=columnaDe(et);if(c!=='otros')return infoColumna(c).n;return S.etapaInfo?S.etapaInfo(et)[0]:String(et||'—');}
// Avance en el flujo principal: índice 0..5, o -1 si está en una cerrada.
function avance(et){var c=columnaDe(et);for(var i=0;i<COLUMNAS.length;i++)if(COLUMNAS[i].id===c)return i;return -1;}
// Argumentos de com_ficha_guardar al mover: SOLO cambia la etapa; situación, plan, motivo y próxima fecha se conservan (y la versión viaja).
function argsMover(p,etapa,motivo){
  if(!esDestino(etapa))throw new Error('ETAPA_INVALIDA');
  return S.argsFicha(p,{etapa:etapa,situacion:p.situacion||'',plan:p.plan||null,
    motivo:etapa==='descartado'?(motivo!==undefined?motivo:p.motivo_perdida):null,proxima:p.proxima_fecha||null});
}

// ── Fechas en America/Santiago ──
var TZ='America/Santiago';
function ymdDe(d){return (d instanceof Date?d:new Date(d)).toLocaleDateString('en-CA',{timeZone:TZ});}
function sumar(y,n){var p=String(y).split('-');return new Date(Date.UTC(+p[0],+p[1]-1,+p[2]+n,12)).toISOString().slice(0,10);}
function diaSem(y){return new Date(y+'T12:00:00Z').getUTCDay();}
function lunesDe(y){var w=diaSem(y);return sumar(y,w===0?-6:1-w);}
function semana(y,off){var l=sumar(lunesDe(y),7*(off||0));return [0,1,2,3,4].map(function(i){return sumar(l,i);});}
function horaDe(iso){return new Date(iso).toLocaleTimeString('es-CL',{timeZone:TZ,hour:'2-digit',minute:'2-digit',hourCycle:'h23'});}
var DIAS=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'], MESES=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
function diaCorto(y){return DIAS[diaSem(y)]+' '+Number(String(y).slice(8));}
function tituloSemana(dias){
  var a=dias[0],b=dias[4],ma=MESES[+a.slice(5,7)-1],mb=MESES[+b.slice(5,7)-1];
  return 'Semana del lunes '+Number(a.slice(8))+(ma!==mb?' de '+ma:'')+' al viernes '+Number(b.slice(8))+' de '+mb;
}

// ── Reuniones: las de la agenda (com_listar_hoy: hoy → 90 días + pasadas por cerrar) y la última de cada prospecto ──
function unirReuniones(agenda,prospectos){
  var m={},orden=[];
  function pon(r){if(!r||r.id==null)return;var k=String(r.id),x=m[k]||{};if(!m[k])orden.push(k);
    Object.keys(r).forEach(function(c){if(r[c]!=null||x[c]===undefined)x[c]=r[c];});m[k]=x;}   // un dato vacío nunca borra uno que sí venía
  (agenda||[]).forEach(function(x){var l=x.lead||{};pon({id:x.reserva_id,inicio:x.inicio,fin:x.fin,estado:x.estado,teams:x.teams||null,lead_id:l.id,nombre:l.nombre,empresa:l.empresa});});
  // La ficha del prospecto es la más fresca (tras mover de etapa la reserva puede quedar cerrada): pisa a la de la agenda.
  (prospectos||[]).forEach(function(p){var r=p.reunion;if(r)pon({id:r.id,inicio:r.inicio,fin:r.fin,estado:r.estado,teams:r.teams||null,lead_id:p.id,nombre:p.nombre,empresa:p.empresa});});
  return orden.map(function(k){return m[k];}).sort(function(a,b){return new Date(a.inicio)-new Date(b.inicio);});
}
function reunionesSemana(reus,dias){return (reus||[]).filter(function(r){return dias.indexOf(ymdDe(r.inicio))>=0;});}
// Filas del calendario: una por hora (09 a 18 como mínimo, se amplía si hay reuniones antes o después).
function horasCalendario(evs){
  var lo=9,hi=18;(evs||[]).forEach(function(r){var h=+horaDe(r.inicio).slice(0,2);if(h<lo)lo=h;if(h>hi)hi=h;});
  var out=[];for(var h=lo;h<=hi;h++)out.push((h<10?'0':'')+h);return out;
}
function claseReunion(est){return (EST_REU[est]||['ag'])[0];}
function proximaReunion(reus,leadId,ahora){
  var t=ahora||Date.now();
  return (reus||[]).filter(function(r){return Number(r.lead_id)===Number(leadId)&&r.estado==='confirmada'&&new Date(r.fin||r.inicio).getTime()>=t;})
    .sort(function(a,b){return new Date(a.inicio)-new Date(b.inicio);})[0]||null;
}
function atrasado(p,hoy,pend){
  if(CERR_FIN.indexOf(p.etapa)>=0)return false;
  if(pend&&pend[String(p.id)])return true;   // reunión que ya pasó y sigue sin cerrar
  return !!(p.proxima_fecha&&String(p.proxima_fecha)<hoy);
}
function mapaPendientes(pendientes){var m={};(pendientes||[]).forEach(function(x){m[String(x.lead_id)]=true;});return m;}
function totales(lista,reus,hoy,pendientes){
  var pend=mapaPendientes(pendientes), dias=semana(hoy,0), mes=String(hoy).slice(0,7);
  lista=lista||[];
  return {
    enProceso:lista.filter(function(p){return ['cliente','descartado','no_calificado','no_asistio'].indexOf(p.etapa)<0;}).length,
    reunionesSemana:reunionesSemana(reus,dias).filter(function(r){return r.estado!=='cancelada'&&r.estado!=='inconsistente';}).length,
    propuestas:lista.filter(function(p){return p.etapa==='propuesta';}).length,
    ganadosMes:lista.filter(function(p){return p.etapa==='cliente'&&p.actualizado&&ymdDe(p.actualizado).slice(0,7)===mes;}).length,
    atrasados:lista.filter(function(p){return atrasado(p,hoy,pend);}).length};
}
function filtrar(lista,txt){
  var t=String(txt||'').trim().toLowerCase();if(!t)return lista||[];
  return (lista||[]).filter(function(p){return (String(p.nombre||'')+' '+String(p.empresa||'')+' '+String(p.email||'')).toLowerCase().indexOf(t)>=0;});
}

root.ComCRM={COLUMNAS:COLUMNAS,CERRADAS:CERRADAS,ETAPAS_RPC:ETAPAS_RPC,columnaDe:columnaDe,esDestino:esDestino,agrupar:agrupar,nombreEtapa:nombreEtapa,
  avance:avance,argsMover:argsMover,ymdDe:ymdDe,lunesDe:lunesDe,semana:semana,horaDe:horaDe,tituloSemana:tituloSemana,unirReuniones:unirReuniones,
  reunionesSemana:reunionesSemana,horasCalendario:horasCalendario,claseReunion:claseReunion,proximaReunion:proximaReunion,atrasado:atrasado,
  totales:totales,filtrar:filtrar};

if(typeof document==='undefined'||!root.ComDatos||!document.getElementById('crmApp'))return;
// ═════════════════════════════ Pantalla ═════════════════════════════
var D=root.ComDatos, esc=D.esc, app=document.getElementById('crmApp'), dm=D.DEMO?'&demo=1':'';
var DATA=null, AGENDA=[], REUS=[], TAB='embudo', SEL=null, TXT='', OFF=0, DET={}, OCUPADO=false, ARRASTRANDO=false;

if(D.DEMO){document.documentElement.classList.remove('auth-pending');var dmo=document.getElementById('cmDemo');if(dmo)dmo.hidden=false;}
try{var q=new URLSearchParams(location.search),qi=q.get('id');if(qi&&/^\d{1,18}$/.test(qi))SEL=Number(qi);if(q.get('vista')==='reuniones')TAB='reuniones';}catch(e){}

function mensaje(e){var m=String(e&&e.message||e||''),M=S.MSJ||{};for(var k in M)if(m.indexOf(k)>=0)return M[k];return D.mensaje(e);}
function yo(){return (DATA&&DATA.yo)||{};}
function prospecto(id){return ((DATA&&DATA.prospectos)||[]).filter(function(p){return Number(p.id)===Number(id);})[0]||null;}
function reemplazar(p){if(!p)return;var l=DATA.prospectos;for(var i=0;i<l.length;i++)if(Number(l[i].id)===Number(p.id)){l[i]=p;return;}l.unshift(p);}
function guardarUrl(){try{var p=new URLSearchParams(location.search);if(SEL)p.set('id',SEL);else p.delete('id');if(TAB==='reuniones')p.set('vista','reuniones');else p.delete('vista');
  var s=p.toString();history.replaceState(null,'',location.pathname+(s?'?'+s:''));}catch(e){}}
function fechaDia(y){if(!y)return '—';return diaCorto(String(y).slice(0,10))+' '+MESES[+String(y).slice(5,7)-1].slice(0,3);}

function cargar(){
  return Promise.all([D.rpc('com_simple_listar',{}),D.rpc('com_listar_hoy',{p_dias:90}).catch(function(){return {reuniones:[]};})]).then(function(r){
    DATA=r[0]||{};DATA.prospectos=DATA.prospectos||[];DATA.pendientes=DATA.pendientes||[];AGENDA=(r[1]&&r[1].reuniones)||[];
    REUS=unirReuniones(AGENDA,DATA.prospectos);
    if(SEL&&!prospecto(SEL))SEL=null;
    pintar();
  }).catch(function(e){app.innerHTML='<div class="aviso rojo">'+esc(mensaje(e))+'</div>';});
}

function pintar(){
  if(!DATA)return;
  var Y=yo(), hoy=D.hoy(), T=totales(DATA.prospectos,REUS,hoy,DATA.pendientes);
  var h='<div class="crm-barra"><div class="crm-tabs" role="tablist" aria-label="Vista">'
    +'<button type="button" role="tab" id="tabEmb" aria-controls="crmEmbudo" aria-selected="'+(TAB==='embudo')+'" class="'+(TAB==='embudo'?'on':'')+'" data-tab="embudo">🧭 Embudo de ventas</button>'
    +'<button type="button" role="tab" id="tabReu" aria-controls="crmCal" aria-selected="'+(TAB==='reuniones')+'" class="'+(TAB==='reuniones'?'on':'')+'" data-tab="reuniones">📅 Reuniones</button></div>'
    +'<span class="crm-esp"></span><input class="crm-busca" id="crmBus" type="search" placeholder="Buscar prospecto o empresa…" aria-label="Buscar prospecto o empresa" value="'+esc(TXT)+'">'
    +(Y.escribe?'<button type="button" class="btn p" id="crmNuevo">＋ Nuevo prospecto</button>':'')+'</div>';
  h+='<div class="crm-tot">'
    +'<div class="crm-kpi"><b>'+T.enProceso+'</b>En proceso</div>'
    +'<div class="crm-kpi"><b>'+T.reunionesSemana+'</b>Reuniones esta semana</div>'
    +'<div class="crm-kpi"><b>'+T.propuestas+'</b>Propuestas por responder</div>'
    +'<div class="crm-kpi"><b>'+T.ganadosMes+'</b>Ganados este mes</div>'
    +'<div class="crm-kpi'+(T.atrasados?' atr':'')+'"><b>'+T.atrasados+'</b>⏰ Con acción atrasada</div></div>';
  if(!Y.escribe)h+='<div class="aviso cel">👀 Puedes ver el embudo. Mover prospectos de etapa es solo para el Master y el equipo Comercial.</div>';
  h+='<div class="crm-main"><section class="crm-vista">'+(TAB==='embudo'?embudoHtml():calendarioHtml())+'</section>'
    +'<aside class="crm-ficha" id="crmFicha" aria-live="polite">'+fichaHtml(prospecto(SEL))+'</aside></div>';
  app.innerHTML=h;enlazar();
}

function tarjeta(p,pend,hoy){
  var Y=yo(), atr=atrasado(p,hoy,pend), r=proximaReunion(REUS,p.id), prox='';
  if(pend[String(p.id)])prox='Cerrar la reunión';
  else if(r)prox='Reunión '+diaCorto(ymdDe(r.inicio))+' · '+horaDe(r.inicio);
  else if(p.proxima_fecha)prox=(p.proxima_accion||'Contactar')+' '+fechaDia(p.proxima_fecha);
  else if(p.etapa==='cliente')prox='Onboarding';
  var sem=p.semaforo&&SEM[p.semaforo];
  return '<div class="crm-card'+(Number(p.id)===SEL?' sel':'')+'" data-id="'+Number(p.id)+'" tabindex="0" role="button" aria-pressed="'+(Number(p.id)===SEL)+'"'
    +(Y.escribe?' draggable="true"':'')+' aria-label="'+esc(p.nombre)+' · '+esc(p.empresa||'Empresa no informada')+'">'
    +'<div class="t"><span class="crm-sem" style="background:'+(sem||'rgba(255,255,255,.18)')+'" title="Semáforo '+esc(SEM_TXT[p.semaforo]||'sin dato')+'"></span><span class="nm">'+esc(p.nombre||'Prospecto')+'</span></div>'
    +'<div class="e">'+esc(p.empresa||'Empresa no informada')+'</div>'
    +'<div class="m">'+(p.dolor?'<span class="crm-chip dol" title="'+esc(p.dolor)+'">'+esc(p.dolor)+'</span>':'')
    +(prox?'<span class="crm-chip '+(atr?'atr':'prox')+'">'+(atr?'⏰ ':'➜ ')+esc(prox)+'</span>':(atr?'<span class="crm-chip atr">⏰ Acción atrasada</span>':''))+'</div></div>';
}
function columnaHtml(c,lista,pend,hoy){
  var dest=esDestino(c.id);
  if(c.id==='otros'&&!lista.length)return '';
  return '<div class="crm-col'+(dest?'':' fija')+'" data-col="'+c.id+'"><h3><i style="background:'+c.c+'"></i>'+esc(c.n)+'<span class="n">'+lista.length+'</span></h3>'
    +(c.h?'<div class="hint">'+esc(c.h)+'</div>':'')
    +'<div class="lista">'+(lista.length?lista.map(function(p){return tarjeta(p,pend,hoy);}).join(''):'<div class="crm-vacio">Sin prospectos</div>')+'</div></div>';
}
function embudoHtml(){
  var hoy=D.hoy(), pend=mapaPendientes(DATA.pendientes), g=agrupar(filtrar(DATA.prospectos,TXT));
  return '<div id="crmEmbudo" role="tabpanel" aria-labelledby="tabEmb"><div class="crm-scroll"><div class="crm-embudo">'+COLUMNAS.map(function(c){return columnaHtml(c,g[c.id],pend,hoy);}).join('')+'</div></div>'
    +'<div class="crm-cerr-t">Cerrados</div><div class="crm-scroll"><div class="crm-cerr">'+CERRADAS.map(function(c){return columnaHtml(c,g[c.id],pend,hoy);}).join('')+'</div></div>'
    +(yo().escribe?'<p class="crm-nota">Arrastra una tarjeta a otra columna para cambiar su etapa (queda en su historial). En celular o con teclado: abre la ficha y usa «Mover a…».</p>':'')+'</div>';
}
function calendarioHtml(){
  var hoy=D.hoy(), dias=semana(hoy,OFF), t=filtrar(DATA.prospectos,TXT), ok={};t.forEach(function(p){ok[String(p.id)]=true;});
  var evs=reunionesSemana(REUS,dias).filter(function(r){return !TXT.trim()||ok[String(r.lead_id)];}), horas=horasCalendario(evs);
  var h='<div id="crmCal" role="tabpanel" aria-labelledby="tabReu"><div class="crm-ley"><span class="crm-nav"><button type="button" class="btn sm" data-sem="-1" aria-label="Semana anterior">‹</button>'
    +(OFF?'<button type="button" class="btn sm" data-sem="0">Hoy</button>':'')+'<button type="button" class="btn sm" data-sem="1" aria-label="Semana siguiente">›</button></span>'
    +'<b>'+esc(tituloSemana(dias))+'</b><span class="crm-esp"></span><span>🟪 Agendada</span><span>🟩 Realizada</span><span>🟥 No asistió</span></div>';
  if(OFF<0)h+='<p class="crm-nota">Semanas pasadas: se ven las reuniones que siguen por cerrar y la última reunión de cada prospecto.</p>';
  h+='<div class="crm-scroll"><div class="crm-cal" role="grid" aria-label="'+esc(tituloSemana(dias))+'"><div class="hd"></div>'
    +dias.map(function(d){return '<div class="hd'+(d===hoy?' hoy':'')+'" role="columnheader">'+esc(diaCorto(d))+(d===hoy?' · hoy':'')+'</div>';}).join('');
  horas.forEach(function(hr){
    h+='<div class="hr" role="rowheader">'+hr+':00</div>';
    dias.forEach(function(d){
      var en=evs.filter(function(r){return ymdDe(r.inicio)===d&&horaDe(r.inicio).slice(0,2)===hr;});
      h+='<div class="cel'+(d===hoy?' hoy':'')+'">'+(en.length?en.map(function(r){var p=prospecto(r.lead_id),e=EST_REU[r.estado]||['ag',r.estado];if(r.estado==='confirmada'&&new Date(r.fin||r.inicio).getTime()<Date.now())e=['ag','Por cerrar'];
        return '<button type="button" class="crm-ev '+e[0]+(Number(r.lead_id)===SEL?' sel':'')+'" data-id="'+Number(r.lead_id)+'" title="'+esc(e[1])+'">'
          +'<span class="hh">'+esc(horaDe(r.inicio))+' · '+esc(e[1])+'</span><b>'+esc(r.nombre||'Prospecto')+'</b>'+esc(r.empresa||'Empresa no informada')
          +(p&&p.dolor?'<small>'+esc(p.dolor)+'</small>':'')+'</button>';}).join(''):'<span class="libre">libre</span>')+'</div>';
    });
  });
  h+='</div></div>';
  if(!evs.length)h+='<p class="crm-nota">No hay reuniones esta semana.</p>';
  return h+'</div>';
}

function fila(k,v){return '<div class="crm-fila"><span>'+esc(k)+'</span><span>'+v+'</span></div>';}
function fichaHtml(p){
  if(!p)return '<div class="crm-vacio-f">👈 Selecciona un prospecto o una reunión<br>para ver lo que nos contó.</div>';
  var Y=yo(), hoy=D.hoy(), col=columnaDe(p.etapa), info=infoColumna(col), idx=avance(p.etapa), det=DET[p.id], rs=(det&&det.respuestas)||{};
  var pend=mapaPendientes(DATA.pendientes), atr=atrasado(p,hoy,pend), r=proximaReunion(REUS,p.id)||(p.reunion?REUS.filter(function(x){return Number(x.id)===Number(p.reunion.id);})[0]:null);
  var dolor=p.dolor||rs.dolor||'';
  var h='<span class="crm-etq" style="color:'+info.c+'">● '+esc(nombreEtapa(p.etapa))+'</span>'
    +'<h2>'+esc(p.nombre||'Prospecto')+'</h2><div class="emp">'+esc([p.empresa||'Empresa no informada',rs.rubro].filter(Boolean).join(' · '))+'</div>'
    +'<div class="crm-pasos" aria-hidden="true">'+COLUMNAS.map(function(c,i){return '<div class="'+(idx>=0&&i<=idx?'ok':'')+'" title="'+esc(c.n)+'"></div>';}).join('')+'</div>'
    +'<div class="crm-nota">Avance en el flujo de ventas: '+(idx>=0?(idx+1)+' de '+COLUMNAS.length:'cerrado · '+esc(nombreEtapa(p.etapa)))+'</div>';
  h+='<div class="crm-bloq"><h4>💬 Lo que nos contó</h4>'+(dolor?'<div class="crm-dolor">«'+esc(dolor)+'»</div>':'<div class="nd">No dejó un motivo en la agenda.</div>')
    +(p.situacion?'<div class="crm-sit"><b>Situación:</b> '+esc(p.situacion)+'</div>':'')
    +fila('Semáforo',p.semaforo?'<span class="crm-sem" style="display:inline-block;background:'+(SEM[p.semaforo]||'#888')+'"></span> '+esc(SEM_TXT[p.semaforo]||p.semaforo):'—')+'</div>';
  h+='<div class="crm-bloq"><h4>🏢 Su empresa</h4>'+(det===undefined?'<div class="nd">Cargando…</div>':det===null?'<div class="nd">No se pudo cargar lo que respondió en la agenda.</div>'
    :fila('Ventas al mes',esc(VENTAS[rs.ventas]||'—'))+fila('Trabajadores',esc(TRAB[rs.trabajadores]||'—'))+fila('Contabilidad hoy',esc(CONTAB[rs.contabilidad]||'—'))
      +fila('Más de una sociedad',esc(SINO[rs.sociedades]||'—'))+fila('Atrasos con el SII',esc(SINO[rs.historicos]||'—')))+'</div>';
  var plan=(S.PLANES||[]).filter(function(x){return x[0]===p.plan;})[0];
  var prox=pend[String(p.id)]?'Cerrar la reunión que ya pasó':p.proxima_fecha?(p.proxima_accion||'Contactar')+' · '+fechaDia(p.proxima_fecha):(p.proxima_accion||'—');
  h+='<div class="crm-bloq"><h4>➜ Qué viene</h4>'+fila('Próxima acción',(atr?'<span class="crm-chip atr">⏰ '+esc(prox)+'</span>':esc(prox)))
    +fila('Plan conversado',esc(plan?plan[1]:'—'));
  if(r){var e=EST_REU[r.estado]||['ag',r.estado],vig=r.estado==='confirmada'&&new Date(r.fin||r.inicio).getTime()>=Date.now();
    h+=fila('Reunión',esc(diaCorto(ymdDe(r.inicio))+' '+MESES[+ymdDe(r.inicio).slice(5,7)-1].slice(0,3)+' · '+horaDe(r.inicio)+' · '+e[1])
      +(vig&&r.teams?' <a class="btn sm" href="'+esc(r.teams)+'" target="_blank" rel="noopener">🎥 Unirme</a>':''));}
  h+=fila('Responsable',D.avatarResp(p.responsable)+(p.responsable?esc(p.responsable.nombre):'<span class="nd">Sin asignar</span>'))+'</div>';
  // Mover a… (alternativa accesible al arrastre: teclado y celular)
  var ops=todas().filter(function(c){return esDestino(c.id)&&c.id!==p.etapa;});
  h+='<div class="crm-bloq"><h4>🔀 Mover a…</h4><div class="crm-mover"><label class="sr" for="crmMover">Mover a otra etapa</label><select id="crmMover"'+(Y.escribe?'':' disabled')+'>'
    +ops.map(function(c){return '<option value="'+c.id+'">'+esc(c.n)+'</option>';}).join('')+'</select>'
    +'<button type="button" class="btn p sm" id="crmMoverBtn"'+(Y.escribe?'':' disabled')+'>Mover</button></div>'
    +(Y.escribe?'':'<p class="crm-nota">Solo el Master y el equipo Comercial pueden mover prospectos.</p>')+'<div class="crm-msg" id="crmMsg" role="status"></div></div>';
  var g=S.guionUrl?S.guionUrl(p,D.DEMO):null;
  h+='<div class="crm-acc">'
    +(p.etapa==='cliente'?'<a class="btn v" href="onboarding.html?lead='+Number(p.id)+dm+'">🚀 Ir a onboarding</a>':'')
    +'<a class="btn" href="simple.html?id='+Number(p.id)+dm+'">📝 Abrir ficha</a>'
    +(g?'<a class="btn" href="'+esc(g)+'">📋 Guion de la reunión</a>':(Y.escribe?'<button type="button" class="btn" id="crmGuion">📋 Guion de la reunión</button>':''))
    +(root.ProsWA?ProsWA.boton(p,{aviso:true}):'')
    +(['reunion_realizada','propuesta','seguimiento'].indexOf(p.etapa)>=0?'<a class="btn" href="../cotizaciones/index.html'+(D.DEMO?'?demo=1':'')+'">📄 Crear cotización</a>':'')
    +(D.DEMO?'':'<a class="btn" href="index.html?id='+Number(p.id)+'">🗂️ Vista completa</a>')
    +(root.ProsTel&&Y.escribe?ProsTel.boton({id:p.id,nombre:p.nombre,tel:p.tel},{mini:true}):'')+'</div>';
  return h;
}
function cargarDetalle(id){
  if(DET[id]!==undefined)return;
  D.rpc('detalle_prospecto',{p_id:Number(id)}).then(function(x){DET[id]=x||{};}).catch(function(){DET[id]=null;})
    .then(function(){if(Number(id)===SEL)pintarFicha();});
}
function pintarFicha(){var f=document.getElementById('crmFicha');if(!f)return;f.innerHTML=fichaHtml(prospecto(SEL));enlazarFicha();}
function seleccionar(id,desplazar){
  SEL=Number(id);guardarUrl();
  app.querySelectorAll('.crm-card,.crm-ev').forEach(function(c){var on=Number(c.getAttribute('data-id'))===SEL;c.classList.toggle('sel',on);if(c.classList.contains('crm-card'))c.setAttribute('aria-pressed',String(on));});
  pintarFicha();cargarDetalle(SEL);
  if(desplazar&&window.matchMedia&&window.matchMedia('(max-width: 980px)').matches){var f=document.getElementById('crmFicha');if(f&&f.scrollIntoView)f.scrollIntoView({behavior:'smooth',block:'start'});}
}

// ── Mover de etapa (com_ficha_guardar, igual que simple.js) ──
function mover(id,etapa){
  var p=prospecto(id);if(!p||OCUPADO||!yo().escribe)return;
  if(!esDestino(etapa)||p.etapa===etapa)return;
  if(!p.actualizado){D.toast(mensaje('FALTA_VERSION'));cargar();return;}
  if(etapa==='descartado'){pedirMotivo(p,function(m){hacerMover(p,etapa,m);});return;}
  hacerMover(p,etapa);
}
function hacerMover(p,etapa,motivo){
  var antes=p.etapa, args;
  try{args=argsMover(p,etapa,motivo);}catch(e){D.toast(mensaje(e));return;}
  OCUPADO=true;p.etapa=etapa;SEL=Number(p.id);guardarUrl();pintar();   // la tarjeta ya se ve en su nueva columna mientras guarda
  var msg=document.getElementById('crmMsg');if(msg){msg.className='crm-msg';msg.textContent='Guardando…';}
  D.rpc('com_ficha_guardar',args).then(function(n){
    OCUPADO=false;reemplazar(n);REUS=unirReuniones(AGENDA,DATA.prospectos);
    if(n&&n.reunion)DATA.pendientes=DATA.pendientes.filter(function(x){return !(Number(x.reserva_id)===Number(n.reunion.id)&&n.reunion.estado!=='confirmada');});
    pintar();cargarDetalle(SEL);
    D.toast(n&&n.etapa==='cliente'?'🎉 '+(n.nombre||'')+' ganado · sigue con «🚀 Ir a onboarding»':(n&&n.nombre||'')+' → '+nombreEtapa(n&&n.etapa)+' (queda en su historial)');
  }).catch(function(e){
    OCUPADO=false;p.etapa=antes;var t=mensaje(e);   // vuelve a su columna
    if(/VERSION_CONFLICTO|FALTA_VERSION|NO_EXISTE/.test(String(e&&e.message))){cargar().then(function(){D.toast(t);});return;}
    pintar();D.toast(t+' No se movió.');var m=document.getElementById('crmMsg');if(m){m.className='crm-msg err';m.textContent=t+' No se movió.';}
  });
}
function modal(html,alAbrir){
  var velo=document.createElement('div');velo.className='cm-velo';
  var m=document.createElement('div');m.className='cm-modal';m.setAttribute('role','dialog');m.setAttribute('aria-modal','true');m.setAttribute('aria-labelledby','crmMTit');
  m.innerHTML=html;var previo=document.activeElement;
  function cerrar(){velo.remove();m.remove();document.removeEventListener('keydown',tecla,true);try{if(previo)previo.focus();}catch(e){}}
  function tecla(e){if(e.key==='Escape'){e.preventDefault();cerrar();}}
  document.body.appendChild(velo);document.body.appendChild(m);velo.onclick=cerrar;document.addEventListener('keydown',tecla,true);
  alAbrir(m,cerrar);return m;
}
// Perdido: motivo opcional de la misma lista que simple.js (MOTIVOS = ck_leads_motivo_perdida).
function pedirMotivo(p,ok){
  modal('<h2 id="crmMTit">Marcar como Perdido</h2><p>'+esc(p.nombre||'')+' · '+esc(p.empresa||'Empresa no informada')+'. Queda en su historial.</p>'
    +'<label class="lbl" for="crmMot">Motivo (opcional)</label><select class="inp" id="crmMot"><option value="">— elegir —</option>'
    +(S.MOTIVOS||[]).map(function(m){return '<option value="'+m[0]+'"'+(p.motivo_perdida===m[0]?' selected':'')+'>'+esc(m[1])+'</option>';}).join('')+'</select>'
    +'<div class="crm-macc"><button type="button" class="btn" id="crmMNo">Cancelar</button><button type="button" class="btn p" id="crmMSi">Marcar Perdido</button></div>',
  function(m,cerrar){
    m.querySelector('#crmMNo').onclick=function(){cerrar();pintar();};
    m.querySelector('#crmMSi').onclick=function(){var v=m.querySelector('#crmMot').value||null;cerrar();ok(v);};
    m.querySelector('#crmMot').focus();
  });
}
// ＋ Nuevo prospecto: mismo flujo que "Bitácora sin reserva" de Reuniones (com_bitacora_abrir crea el prospecto y abre su bitácora).
function nuevoProspecto(){
  modal('<h2 id="crmMTit">＋ Nuevo prospecto</h2><p>Para una llamada o un WhatsApp que no pasó por la agenda. Se abre su bitácora; no se envía nada al prospecto.</p>'
    +'<label class="lbl" for="crmNNom">Nombre del contacto</label><input class="inp" id="crmNNom" maxlength="120" autocomplete="off" placeholder="Ej.: Camila Rojas">'
    +'<label class="lbl" for="crmNEmp">Empresa (opcional)</label><input class="inp" id="crmNEmp" maxlength="160" autocomplete="off" placeholder="Ej.: Ferretería Los Aromos SpA">'
    +'<div class="msg err" id="crmNMsg" role="status"></div>'
    +'<div class="crm-macc"><button type="button" class="btn" id="crmMNo">Cancelar</button><button type="button" class="btn p" id="crmMSi">📝 Crear y abrir bitácora</button></div>',
  function(m,cerrar){
    m.querySelector('#crmMNo').onclick=cerrar;
    m.querySelector('#crmMSi').onclick=function(){
      var n=m.querySelector('#crmNNom').value.trim(),msg=m.querySelector('#crmNMsg'),b=this;
      if(n.length<2){msg.textContent='Escribe el nombre (mínimo 2 letras).';return;}
      b.disabled=true;msg.className='msg';msg.textContent='Creando…';
      D.rpc('com_bitacora_abrir',{p_nombre:n,p_empresa:m.querySelector('#crmNEmp').value.trim()||null,p_guion_version:root.ComGuionVersion||'c1-2026-10-26'})
        .then(function(x){location.href='bitacora.html?id='+Number(x.id)+dm;})
        .catch(function(e){b.disabled=false;msg.className='msg err';msg.textContent=mensaje(e);});
    };
    m.querySelector('#crmNNom').focus();
  });
}
function abrirGuion(){
  var p=prospecto(SEL);if(!p)return;var b=document.getElementById('crmGuion');if(b)b.disabled=true;
  D.rpc('com_bitacora_abrir',{p_lead_id:Number(p.id),p_guion_version:root.ComGuionVersion||'c1-2026-10-26'})
    .then(function(x){location.href='bitacora.html?id='+Number(x.id)+dm;})
    .catch(function(e){if(b)b.disabled=false;var m=document.getElementById('crmMsg');if(m){m.className='crm-msg err';m.textContent=mensaje(e);}});
}

function enlazarFicha(){
  var mb=document.getElementById('crmMoverBtn'),ms=document.getElementById('crmMover');
  if(mb&&ms)mb.onclick=function(){mover(SEL,ms.value);};
  var gu=document.getElementById('crmGuion');if(gu)gu.onclick=abrirGuion;
}
function enlazar(){
  app.querySelectorAll('[data-tab]').forEach(function(b){b.onclick=function(){TAB=b.getAttribute('data-tab');guardarUrl();pintar();var t=document.querySelector('[data-tab="'+TAB+'"]');if(t)t.focus();};});
  var tabs=app.querySelector('.crm-tabs');if(tabs)tabs.onkeydown=function(e){if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();TAB=TAB==='embudo'?'reuniones':'embudo';guardarUrl();pintar();var t=document.querySelector('[data-tab="'+TAB+'"]');if(t)t.focus();}};
  var bus=document.getElementById('crmBus');if(bus)bus.oninput=function(){var pos=bus.selectionStart;TXT=bus.value;pintar();var n=document.getElementById('crmBus');n.focus();try{n.setSelectionRange(pos,pos);}catch(e){}};
  var nv=document.getElementById('crmNuevo');if(nv)nv.onclick=nuevoProspecto;
  app.querySelectorAll('[data-sem]').forEach(function(b){b.onclick=function(){var v=Number(b.getAttribute('data-sem'));OFF=v===0?0:OFF+v;pintar();};});
  app.querySelectorAll('.crm-card').forEach(function(c){
    c.onclick=function(){seleccionar(c.getAttribute('data-id'),true);};
    c.onkeydown=function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();seleccionar(c.getAttribute('data-id'),true);}};
    if(c.getAttribute('draggable')==='true'){
      c.ondragstart=function(ev){ARRASTRANDO=true;c.classList.add('arr');try{ev.dataTransfer.setData('text/plain',c.getAttribute('data-id'));ev.dataTransfer.effectAllowed='move';}catch(e){}};
      c.ondragend=function(){ARRASTRANDO=false;c.classList.remove('arr');app.querySelectorAll('.crm-col.sobre').forEach(function(x){x.classList.remove('sobre');});};
    }
  });
  if(yo().escribe)app.querySelectorAll('.crm-col').forEach(function(col){
    var et=col.getAttribute('data-col');if(!esDestino(et))return;
    col.ondragover=function(ev){ev.preventDefault();try{ev.dataTransfer.dropEffect='move';}catch(e){}col.classList.add('sobre');};
    col.ondragleave=function(ev){if(!col.contains(ev.relatedTarget))col.classList.remove('sobre');};
    col.ondrop=function(ev){ev.preventDefault();col.classList.remove('sobre');ARRASTRANDO=false;var id='';try{id=ev.dataTransfer.getData('text/plain');}catch(e){}if(/^\d{1,18}$/.test(id))mover(Number(id),et);};
  });
  app.querySelectorAll('.crm-ev').forEach(function(e){e.onclick=function(){seleccionar(e.getAttribute('data-id'),true);};});
  enlazarFicha();
  if(SEL)cargarDetalle(SEL);
}

// ✏️ Corregir teléfono (telefono.js): tras guardar se recarga para que WhatsApp use el número nuevo.
if(root.ProsTel)ProsTel.configurar({rpc:D.rpc,alGuardar:function(){delete DET[SEL];cargar();}});
D.alListo(cargar);
setInterval(function(){if(DATA&&!document.hidden&&!OCUPADO&&!ARRASTRANDO&&!document.querySelector('.wa-menu,.tel-modal,.cm-modal')&&!(document.activeElement&&/^(TEXTAREA|INPUT|SELECT)$/.test(document.activeElement.tagName)))cargar();},120000);
})(typeof window!=='undefined'?window:globalThis);
