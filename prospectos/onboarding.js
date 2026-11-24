/* ============================================================
   prospectos/onboarding.js — Onboarding L1 (18-11-2026, pedido de Luciano: "si lo ganamos, que pase directo a onboarding")
   · Un prospecto que queda en Ganado abre un CASO (lo hace la base, trigger trg_onb_lead_ganado). Aquí se completa lo que falta
     y se crea el cliente en estado 'onboarding'. Después: conectar Cartapra y «Completar con datos del SII» en la ficha del cliente.
   · Datos SOLO por RPC (onb_listar / onb_guardar / onb_crear_cliente / onb_descartar), con la versión del caso (no pisa lo de otro).
   · Todo texto de la base pasa por esc(); el formulario arma el HTML con valores escapados.
   · L2 (19-11): con el cliente creado, la ficha muestra los 15 pasos (assets/onboarding-pasos.js: onb_pasos / onb_paso_marcar /
     onb_activar) y la lista muestra el avance de cada uno (onb_tablero). Filtro «En marcha» = creados que aún no están activos.
   · V2 (23-11): los casos nuevos (lista 2) empiezan el onboarding al ACEPTAR la propuesta: aparecen en «En marcha» desde el día 0 (aunque el
     cliente aún no esté creado) con sus dos tramos (Activación 3 días · Diagnóstico 7 días hábiles); los casos antiguos (lista 1) siguen igual.
   ============================================================ */
(function(){
'use strict';
var D=window.ComDatos, esc=D.esc;
var PLANES=[['cumplimiento','Cumplimiento'],['pro','Contadoor PRO'],['estrategico','Contadoor Estratégico']];
var FALTA={razon_social:'Razón social',rut:'RUT',plan:'Plan',valor_uf:'Valor mensual (UF)',fecha_inicio:'Fecha de inicio',analista_contable:'Analista contable',analista_rrhh:'Analista de remuneraciones'};
var MSJ={RUT_INVALIDO:'El RUT no es válido (revisa el dígito verificador).',RUT_YA_ES_CLIENTE:'Ese RUT ya es cliente en Gestoor: búscalo en Clientes.',
  FALTAN_DATOS:'Faltan datos para crear el cliente.',CASO_CERRADO:'Este caso ya se cerró.',VERSION_CONFLICTO:'Otra persona guardó este caso recién. Recargamos los datos.',
  DATOS_INVALIDOS:'Hay un dato con formato inválido.',ANALISTA_INVALIDO:'El analista elegido no corresponde a esa área.',MOTIVO_OBLIGATORIO:'Escribe el motivo (mínimo 5 letras).',
  CLAVE_PROHIBIDA:'No anotes claves aquí: la clave del SII se conecta con Cartapra desde la ficha del cliente.',SIN_PERMISO:'Onboarding es solo para el Master y el equipo Comercial.',
  SIN_PERMISO_ESCRITURA:'Tu usuario puede ver pero no editar.',NO_EXISTE:'No encontramos ese caso.'};
function msg(e){var m=String(e&&e.message||e||'');for(var k in MSJ)if(m.indexOf(k)>=0)return MSJ[k];return D.mensaje(e);}
var S={casos:[],analistas:[],yo:null,sel:null,filtro:'por_iniciar',tab:{}};
var app=function(){return document.getElementById('csApp');};
function q(){try{return new URLSearchParams(location.search);}catch(e){return new URLSearchParams('');}}
function caso(id){return S.casos.filter(function(c){return c.id===id;})[0]||null;}
function rutFmt(r){if(!r)return '';var p=String(r).split('-');return p[0].replace(/\B(?=(\d{3})+(?!\d))/g,'.')+'-'+(p[1]||'');}
function planTxt(v){var x=PLANES.filter(function(p){return p[0]===v;})[0];return x?x[1]:'Sin plan';}
function hoyMas(n){return D.sumarDias(D.hoy(),n);}

function cargar(seleccion){
  return Promise.all([D.rpc('onb_listar',{}),D.rpc('onb_tablero',{}).catch(function(){return {casos:[]};})]).then(function(rr){
    var r=rr[0];S.casos=r.casos||[];S.analistas=r.analistas||[];S.yo=r.yo||{};
    S.tab={};((rr[1]&&rr[1].casos)||[]).forEach(function(t){S.tab[Number(t.caso_id)]=t;});
    var p=q(), c=Number(p.get('caso'))||null, l=Number(p.get('lead'))||null;
    if(seleccion)S.sel=seleccion;
    else if(c&&caso(c))S.sel=c;
    else if(l){var x=S.casos.filter(function(y){return y.lead_id===l&&y.estado!=='descartado';})[0];S.sel=x?x.id:null;}
    if(S.sel&&caso(S.sel)&&caso(S.sel).estado!=='por_iniciar')S.filtro=enMarcha(caso(S.sel))?'en_marcha':'todos';
    if(!S.sel){var f=S.casos.filter(function(y){return y.estado==='por_iniciar';})[0]||S.casos.filter(enMarcha)[0];S.sel=f?f.id:null;if(f&&enMarcha(f))S.filtro='en_marcha';}
    pintar();
  }).catch(function(e){app().innerHTML='<div class="aviso rojo">'+esc(msg(e))+'</div>';});
}
function esV2(c){var t=S.tab[Number(c.id)];return !!t&&Number(t.lista_version)===2;}
function enMarcha(c){var t=S.tab[Number(c.id)];return !!t&&!t.activado_at&&(c.estado==='cliente_creado'||(esV2(c)&&c.estado==='por_iniciar'));}
function tramoTxt(t){var x=(t.tramos||[]).filter(function(y){return y.estado!=='cumplido';})[0];if(!x)return '';
  if(x.estado==='vencido')return ' · '+x.nombre+' vencida';if(x.tramo===2&&x.habiles_restantes!=null)return ' · '+x.nombre+': '+Number(x.habiles_restantes)+' d háb.';return ' · '+x.nombre+': '+Number(x.dias_restantes)+' d';}
function chipEst(c){
  var t=S.tab[Number(c.id)];
  if(c.estado==='cliente_creado'&&t&&t.activado_at)return '<span class="estado verde">✅ Activo</span>';
  if((c.estado==='cliente_creado'||esV2(c)&&c.estado==='por_iniciar')&&t)return '<span class="estado '+(t.resumen&&t.resumen.vencidos>0?'ambar':'cel')+'">🚀 '+Number(t.resumen.listos)+'/'+Number(t.resumen.total||15)+esc(tramoTxt(t))+(t.resumen.vencidos>0?' · ⏰':'')+'</span>';
  if(c.estado==='cliente_creado')return '<span class="estado verde">✅ Cliente creado</span>';
  if(c.estado==='descartado')return '<span class="estado gris">Descartado</span>';
  return c.faltan&&c.faltan.length?'<span class="estado ambar">Faltan '+c.faltan.length+'</span>':'<span class="estado cel">Listo ✓</span>';
}
function pintar(){
  var por=S.casos.filter(function(c){return c.estado==='por_iniciar';});
  var mar=S.casos.filter(enMarcha);
  var vis=S.filtro==='todos'?S.casos:S.filtro==='en_marcha'?mar:por;
  var h='<div class="cs-wrap"><div>';
  h+='<div class="cs-chips"><button type="button" class="cs-chip'+(S.filtro==='por_iniciar'?' on':'')+'" data-f="por_iniciar">Por iniciar<i>'+por.length+'</i></button>'
    +'<button type="button" class="cs-chip'+(S.filtro==='en_marcha'?' on':'')+'" data-f="en_marcha">En marcha<i>'+mar.length+'</i></button>'
    +'<button type="button" class="cs-chip'+(S.filtro==='todos'?' on':'')+'" data-f="todos">Todos<i>'+S.casos.length+'</i></button></div>';
  if(!vis.length&&S.filtro==='en_marcha')h+='<div class="cs-lista"><div class="onb-vacio">No hay clientes en onboarding.<small>Cuando un cliente acepta la propuesta, su onboarding aparece aquí con sus dos tramos.</small></div></div>';
  else if(!vis.length)h+='<div class="cs-lista"><div class="onb-vacio">🎉 No hay clientes por iniciar.<small>Cuando marques un prospecto como <b>Ganado</b>, aparece aquí solo.</small></div></div>';
  else h+='<div class="cs-lista">'+vis.map(function(c){var l=c.lead||{};
    return '<button type="button" class="cs-row onb-row'+(c.id===S.sel?' sel':'')+'" data-id="'+Number(c.id)+'"><span><b>'+esc(c.razon_social||l.empresa||l.nombre||('Prospecto #'+c.lead_id))+'</b><small>'+esc(l.nombre||'')+(c.responsable?' · ganado con '+esc(c.responsable.split(' ')[0]):'')+'</small></span>'
      +'<span><small>'+esc(planTxt(c.plan))+(c.valor_uf?' · '+esc(String(c.valor_uf).replace('.',','))+' UF':'')+'</small></span>'
      +'<span><small>📅 '+esc(D.fechaHora(c.creado_at))+'</small></span><span>'+chipEst(c)+'</span></button>';}).join('')+'</div>';
  h+='</div><aside class="cs-ficha" id="onbFicha" aria-live="polite">'+ficha(caso(S.sel))+'</aside></div>';
  app().innerHTML=h;
  app().querySelectorAll('[data-f]').forEach(function(b){b.onclick=function(){S.filtro=b.getAttribute('data-f');pintar();};});
  app().querySelectorAll('.onb-row').forEach(function(b){b.onclick=function(){S.sel=Number(b.getAttribute('data-id'));pintar();
    if(window.innerWidth<=980){var f=document.getElementById('onbFicha');if(f)f.scrollIntoView({block:'start'});}};});
  enlazar();
  var cs=caso(S.sel);if(cs&&(cs.estado==='cliente_creado'||esV2(cs)&&cs.estado==='por_iniciar'))cargarPasos(cs.id);
}
function cargarPasos(id){
  var box=document.getElementById('onbPasos');if(!box||!window.OnbPasos)return;
  D.rpc('onb_pasos',{p_caso_id:id}).then(function(d){
    if(S.sel!==id)return;
    window.OnbPasos.render(box,d,{rpc:D.rpc,recargar:function(){cargar(id);},alCambiar:function(n){
      var t=S.tab[id]||{};t.resumen=n.resumen;t.activado_at=n.activado_at;S.tab[id]=t;
      var fila=app().querySelector('.onb-row[data-id="'+Number(id)+'"] span:last-child');if(fila)fila.innerHTML=chipEst(caso(id));}});
  }).catch(function(e){box.innerHTML='<p class="onb-faltan">'+esc(msg(e))+'</p>';});
}
function opt(v,txt,sel){return '<option value="'+esc(v)+'"'+(String(sel)===String(v)?' selected':'')+'>'+esc(txt)+'</option>';}
function ficha(c){
  if(!c)return '<p class="nd">Elige un cliente de la lista.</p>';
  var l=c.lead||{}, cerrado=c.estado!=='por_iniciar', dis=cerrado||!S.yo.escribe?' disabled':'';
  var h='<h2>'+esc(c.razon_social||l.empresa||l.nombre||'Cliente')+'</h2><p class="cs-sub">'+chipEst(c)+'</p>';
  h+='<div class="onb-lead"><span class="cs-l" style="margin-top:0">Lo que sabemos del prospecto</span>'
    +'<p><b>'+esc(l.nombre||'—')+'</b>'+(l.empresa?' · '+esc(l.empresa):'')+'</p>'
    +'<p class="nd">'+[l.email,l.tel,l.rut?('RUT '+rutFmt(l.rut)):null,l.n_trabajadores?(l.n_trabajadores+' trabajador(es)'):null].filter(Boolean).map(esc).join(' · ')+'</p>'
    +(l.situacion?'<p class="onb-sit">«'+esc(l.situacion)+'»</p>':'')
    +(c.lead_id?'<p><a class="btn sm" href="crm.html?lead='+Number(c.lead_id)+(D.DEMO?'&demo=1':'')+'">📝 Ficha del prospecto</a></p>':'')+'</div>';
  if(c.estado==='cliente_creado'){
    h+='<div class="onb-ok"><b>✅ Cliente creado en Gestoor</b><p>Sigue los pasos de abajo: casi todos se marcan solos. En su ficha: <b>🔌 conectar el SII</b> (Cartapra) y luego <b>«Completar con datos del SII»</b>.</p>'
      +'<a class="btn p" href="../clientes/index.html?abrir='+Number(c.cliente_id)+'">Abrir ficha del cliente</a></div>'
      +'<div id="onbPasos"><p class="nd">Cargando los pasos…</p></div>';
  }else if(c.estado==='descartado'){
    h+='<p class="cs-nota">Descartado: '+esc(c.motivo_descarte||'')+'</p>';
  }
  var anC=S.analistas.filter(function(a){return a.rol==='contable'||a.rol==='master';}), anR=S.analistas.filter(function(a){return a.rol==='rrhh'||a.rol==='master';});
  h+='<span class="cs-l">Empresa</span><div class="cs-dos"><div><label class="onb-sl" for="oRaz">Razón social</label><input id="oRaz" maxlength="200" value="'+esc(c.razon_social||'')+'"'+dis+'></div>'
    +'<div><label class="onb-sl" for="oRut">RUT</label><input id="oRut" maxlength="12" placeholder="76.123.456-7" value="'+esc(rutFmt(c.rut))+'"'+dis+'></div></div>';
  h+='<span class="cs-l">Contacto</span><div class="cs-dos"><div><label class="onb-sl" for="oCon">Nombre</label><input id="oCon" maxlength="120" value="'+esc(c.contacto||'')+'"'+dis+'></div>'
    +'<div><label class="onb-sl" for="oTel">Teléfono</label><input id="oTel" maxlength="16" value="'+esc(c.tel||'')+'"'+dis+'></div></div>'
    +'<label class="onb-sl" for="oMail">Correo</label><input id="oMail" type="email" maxlength="200" value="'+esc(c.email||'')+'"'+dis+'>';
  h+='<span class="cs-l">Plan</span><div class="cs-dos"><div><label class="onb-sl" for="oPlan">Plan</label><select id="oPlan"'+dis+'>'+opt('','— elegir —',c.plan||'')+PLANES.map(function(p){return opt(p[0],p[1],c.plan||'');}).join('')+'</select></div>'
    +'<div><label class="onb-sl" for="oUf">Valor mensual (UF)</label><input id="oUf" inputmode="decimal" placeholder="3" value="'+esc(c.valor_uf!=null?String(c.valor_uf).replace('.',','):'')+'"'+dis+'></div></div>'
    +'<label class="onb-check"><input type="checkbox" id="oLab"'+(c.gestion_laboral?' checked':'')+dis+'> Gestión Laboral <span class="nd">· </span><input id="oTrab" class="onb-mini" inputmode="decimal" value="'+esc(String(c.valor_trab_uf!=null?c.valor_trab_uf:0.39).replace('.',','))+'"'+dis+'> UF por trabajador</label>';
  h+='<span class="cs-l">Inicio y equipo</span><div class="cs-dos"><div><label class="onb-sl" for="oIni">Fecha de inicio</label><input id="oIni" type="date" value="'+esc(c.fecha_inicio||'')+'"'+dis+'></div>'
    +'<div><label class="onb-sl" for="oAc">Analista contable</label><select id="oAc"'+dis+'>'+opt('','— elegir —',c.analista_contable_id||'')+anC.map(function(a){return opt(a.id,a.nombre,c.analista_contable_id||'');}).join('')+'</select></div></div>'
    +'<div id="oRrBox"'+(c.gestion_laboral?'':' hidden')+'><label class="onb-sl" for="oAr">Analista de remuneraciones</label><select id="oAr"'+dis+'>'+opt('','— elegir —',c.analista_rrhh_id||'')+anR.map(function(a){return opt(a.id,a.nombre,c.analista_rrhh_id||'');}).join('')+'</select></div>';
  h+='<label class="cs-l" for="oNot">Notas (opcional)</label><textarea id="oNot" maxlength="2000" placeholder="Acuerdos de la reunión, descuentos, lo que no hay que olvidar…"'+dis+'>'+esc(c.notas||'')+'</textarea>';
  if(!cerrado&&c.faltan&&c.faltan.length)h+='<p class="onb-faltan">Falta para crear el cliente: <b>'+c.faltan.map(function(f){return esc(FALTA[f]||f);}).join(' · ')+'</b></p>';
  if(!cerrado&&S.yo.escribe){
    h+='<div class="cs-acc"><button type="button" class="btn" id="oGuardar">Guardar</button>'
      +'<button type="button" class="btn p" id="oCrear"'+(c.faltan&&c.faltan.length?' disabled title="Completa y guarda lo que falta"':'')+'>✅ Crear cliente</button>'
      +'<button type="button" class="btn onb-desc" id="oDesc">Descartar</button></div>';
  }
  h+='<div class="cs-msg" id="oMsg" role="status"></div>';
  if(c.estado==='por_iniciar'&&esV2(c))h+='<div id="onbPasos"><p class="nd">Cargando los pasos…</p></div>';
  return h;
}
function val(id){var e=document.getElementById(id);return e?e.value.trim():'';}
function datos(){
  var uf=val('oUf').replace(/\./g,'').replace(',','.'), tr=val('oTrab').replace(',','.');
  var lab=document.getElementById('oLab');
  return {razon_social:val('oRaz'),rut:val('oRut'),contacto:val('oCon'),tel:val('oTel'),email:val('oMail'),plan:val('oPlan'),valor_uf:uf,
    gestion_laboral:!!(lab&&lab.checked),valor_trab_uf:tr||'0.39',fecha_inicio:val('oIni'),analista_contable_id:val('oAc'),
    analista_rrhh_id:lab&&lab.checked?val('oAr'):'',notas:val('oNot')};
}
function aviso(t,cls){var m=document.getElementById('oMsg');if(m){m.className='cs-msg '+(cls||'');m.textContent=t;}}
function guardar(){
  var c=caso(S.sel);if(!c)return Promise.resolve(null);
  aviso('Guardando…');
  return D.rpc('onb_guardar',{p_id:c.id,p_datos:datos(),p_actualizado:c.actualizado}).then(function(n){
    S.casos=S.casos.map(function(x){return x.id===n.id?n:x;});pintar();aviso(n.faltan.length?'Guardado. Aún falta: '+n.faltan.map(function(f){return FALTA[f]||f;}).join(', ')+'.':'Guardado ✓ · ya puedes crear el cliente.','ok');return n;
  }).catch(function(e){aviso(msg(e),'err');if(/VERSION_CONFLICTO/.test(String(e&&e.message)))cargar(c.id);return null;});
}
function enlazar(){
  var lab=document.getElementById('oLab');if(lab)lab.onchange=function(){var b=document.getElementById('oRrBox');if(b)b.hidden=!lab.checked;};
  var g=document.getElementById('oGuardar');if(g)g.onclick=function(){g.disabled=true;guardar().then(function(){g.disabled=false;});};
  var cr=document.getElementById('oCrear');
  if(cr)cr.onclick=function(){
    var c=caso(S.sel);if(!c)return;
    var nombre=c.razon_social||'el cliente';
    if(!window.confirm('¿Crear a '+nombre+' como cliente en Gestoor?\n\nQueda en estado «Onboarding», con su plan, valor y analistas. Entra a la nómina del período activo.'))return;
    cr.disabled=true;aviso('Creando cliente…');
    D.rpc('onb_crear_cliente',{p_id:c.id,p_actualizado:c.actualizado}).then(function(n){
      S.casos=S.casos.map(function(x){return x.id===n.id?n:x;});S.filtro='todos';pintar();aviso('✅ Cliente creado. Abre su ficha para conectar el SII.','ok');D.toast('Cliente creado en Gestoor');
    }).catch(function(e){cr.disabled=false;aviso(msg(e),'err');if(/VERSION_CONFLICTO/.test(String(e&&e.message)))cargar(c.id);});
  };
  var ds=document.getElementById('oDesc');
  if(ds)ds.onclick=function(){
    var c=caso(S.sel);if(!c)return;
    var m=window.prompt('¿Por qué se descarta? (por ejemplo: se arrepintió antes de partir)');if(m==null)return;
    D.rpc('onb_descartar',{p_id:c.id,p_motivo:m,p_actualizado:c.actualizado}).then(function(n){
      S.casos=S.casos.map(function(x){return x.id===n.id?n:x;});pintar();D.toast('Caso descartado');
    }).catch(function(e){aviso(msg(e),'err');});
  };
}
D.alListo(function(){
  if(D.DEMO){var b=document.getElementById('cmDemo');if(b)b.hidden=false;document.documentElement.classList.remove('auth-pending');}
  cargar();
});
})();
