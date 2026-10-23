/* ============================================================
   facturacion/adicional.js — "Facturación adicional" (F1b)
   Facturas fuera de los grupos mensuales: desde cotización aprobada (camino normal)
   o manual (excepción, con motivo obligatorio). Siempre factura exenta DTE 34.
   NO HAY MOTOR SQL TODAVÍA: en producción la sección se muestra como "Próximamente"
   y no hace ninguna llamada. El editor completo solo funciona en el modo demostración
   local (?demo=1 en localhost), con datos ficticios de demo-datos.js. Nada se guarda.
   Pendiente (etapa SQL aparte): tablas y RPC descritas en FACTURACION_F1B_IMPLEMENTACION.md.
   ============================================================ */
(function(){
'use strict';
var U=window.FX_UTIL, UI=window.FX_UI;
var ic=U.ic, I=U.I, esc=U.esc, clp=U.clp, ufFmt=U.ufFmt, dec=U.dec;
var btn=UI.btn, modal=UI.modal, toast=UI.toast, cerrarModal=UI.cerrarModal;
var D=window.FX_DEMO===true?(window.FX_DEMO_ADIC||null):null;
var CTX={demo:false,rol:'lectura',uf:null};
var HOY=D?D.HOY:'', CLIENTES_AD=D?D.CLIENTES:[], SERVICIOS_AD=D?D.SERVICIOS:[], IND=D?D.FACTURAS:[], L=D?D.L:function(){return null;};
var LOGO='../assets/firma/contadoor-logo-blanco-firma.png';   // logo blanco sobre fondo oscuro (regla de marca)
function UFD(){return CTX.uf||0;}
function $(id){return document.getElementById(id);}
var CAT_AD={tributario:'Tributario',laboral:'Laboral',societario:'Societario',contable:'Contable',otro:'Otro'};
var EST_IND={BORRADOR:['Borrador','fx-est gris'],INSTRUCCION:['Instrucción recibida','fx-est cel'],EN_REVISION:['En revisión del Master','fx-est mor'],APROBADA:['Aprobada','fx-est ver'],DEVUELTA:['Devuelta','fx-est amb']};

/* ── Cálculo de la factura (exenta: sin IVA; redondeo a peso entero por línea) ── */
function cliAd(id){return CLIENTES_AD.filter(function(c){return c.id===id;})[0]||null;}
function linCalc(l){var bruto=Math.round((+l.cant||0)*(+l.precio||0)*(l.mon==='UF'?UFD():1));var d=Math.round(bruto*Math.min(100,Math.max(0,+l.descPct||0))/100);return {bruto:bruto,desc:d,tot:bruto-d};}
function facCalc(f){
  var bruto=0,dl=0;f.lineas.forEach(function(l){var c=linCalc(l);bruto+=c.bruto;dl+=c.desc;});
  var neto=bruto-dl, dg=f.descG.t==='%'?Math.round(neto*Math.min(100,Math.max(0,+f.descG.v||0))/100):Math.min(neto,Math.max(0,Math.round(+f.descG.v||0)));
  return {bruto:bruto,descLineas:dl,descG:dg,total:Math.max(0,neto-dg)};
}
function faltanFicha(c){if(!c)return ['cliente'];var m=[];if(!c.giro)m.push('giro');if(!c.direccion)m.push('dirección');if(!c.comuna)m.push('comuna');if(!c.correo_facturacion)m.push('correo de facturación');return m;}
function sumarDias(iso,d){var t=new Date(iso+'T12:00:00');t.setDate(t.getDate()+d);return t.toISOString().slice(0,10);}
function fFecha(iso){if(!iso)return '—';var p=iso.split('-');return p[2]+'-'+p[1]+'-'+p[0];}
function tituloFac(f){return f.lineas.length?f.lineas[0].desc+(f.lineas.length>1?' + '+(f.lineas.length-1)+' más':''):'Factura sin servicios';}

/* ── Tarjetas de la sección ── */
function cardInd(x){
  var c=cliAd(x.cliId), t=facCalc(x), es=EST_IND[x.estado], f=CTX.rol==='facturador';
  var edit=f&&(x.estado==='BORRADOR'||x.estado==='INSTRUCCION'||x.estado==='DEVUELTA'), rev=!f&&x.estado==='EN_REVISION';
  var txt=edit?(x.estado==='INSTRUCCION'?'Preparar factura':'Editar factura'):(rev?'Revisar factura':'Ver factura');
  return '<div class="cot'+(x.origen==='MANUAL'?' manual':'')+'"><div class="h">'
   +(x.origen==='MANUAL'?'<span class="chip c-manualf" title="Factura manual: excepción, queda marcada y en la bitácora">MANUAL</span>':'<span class="num">'+esc(x.cot)+'</span>')
   +'<span class="'+es[1]+'">'+es[0]+'</span></div>'
   +'<b class="sv">'+esc(tituloFac(x))+'</b>'
   +'<div class="fila"><span>Cliente</span><span>'+esc(c?c.razon_social:'Sin cliente')+'<span class="sub">'+esc(c?c.rut:'')+'</span></span></div>'
   +'<div class="fila"><span>Condiciones de pago</span><span>'+esc(x.cond||'—')+'</span></div>'
   +'<div class="fila"><span>Tipo de documento</span><span>Factura exenta (DTE 34)</span></div>'
   +'<div class="fila"><span>Monto exento</span><span class="monto cifra">'+clp(t.total)+'</span></div>'
   +(x.motivo?'<div class="mot"><b>Motivo (sin cotización):</b> '+esc(x.motivo)+'</div>':'')
   +(x.coment?'<div class="mot" style="background:rgba(224,122,110,.08)"><b>Comentario del Master:</b> '+esc(x.coment)+'</div>':'')
   +'<div class="acc"><button type="button" class="g-btn sm'+(edit||rev?' pri':'')+'" data-act="ind-abrir" data-id="'+x.id+'">'+I(edit?'lapiz':(rev?'escudo':'ver'),edit||rev?'':'ic-mor')+txt+'</button></div></div>';
}
function renderIndiv(){
  var cot=IND.filter(function(x){return x.origen==='COT';}), man=IND.filter(function(x){return x.origen==='MANUAL';});
  document.getElementById('cotGrid').innerHTML=cot.map(cardInd).join('');
  document.getElementById('manGrid').innerHTML=man.map(cardInd).join('')||'<p class="ninguna" style="padding:0 0 4px">No hay facturas manuales este mes.</p>';
  var f=CTX.rol==='facturador';
  document.getElementById('sepManual').innerHTML='<span><b style="color:var(--t1)">Facturas manuales</b> · solo como excepción, cuando el servicio no viene de una cotización.</span>'
   +'<span class="tipw" style="margin-left:auto" data-tip="'+esc(f?'Abre el editor completo. Pide un motivo obligatorio y pasa por la aprobación del Master.':'Las facturas manuales las prepara el facturador; el Master las aprueba o devuelve.')+'"><button type="button" class="btn-link" data-act="ind-manual"'+(f?'':' disabled')+'>'+I('mas',f?'ic-amb':'')+'Factura manual (excepción)</button></span>';
}
function renderHeroAdic(){
  var man=IND.filter(function(x){return x.origen==='MANUAL';}), cot=IND.filter(function(x){return x.origen==='COT';});
  var rev=IND.filter(function(x){return x.estado==='EN_REVISION';}).length;
  var monto=IND.reduce(function(a,x){return a+facCalc(x).total;},0);
  document.getElementById('hero').innerHTML=
   '<div class="hero-top"><div><small class="k">Período contable</small><h2>Octubre 2026 · <span>Facturación adicional</span></h2>'
   +'<div class="meta"><span class="it">'+I('lista','ic-ama')+'Servicios puntuales, fuera de los grupos mensuales</span>'
   +'<span class="it">'+I('factura','ic-mor')+'Factura exenta <b>DTE 34</b></span><span class="it">'+I('escudo','ic-cel')+'Siempre con aprobación del Master</span></div></div>'
   +'<div class="estado-lote"><span class="prox">'+ic('reloj')+'Próximamente</span><span class="prueba">'+ic('probeta')+'MODO PRUEBA</span></div></div>'
   +'<div class="fx-kpis">'
   +'<div class="fx-kpi"><span class="l">Manuales este mes</span><span class="v cifra" style="color:var(--amb)">'+man.length+'</span><span class="s">Excepción · motivo obligatorio</span></div>'
   +'<div class="fx-kpi"><span class="l">Desde cotización</span><span class="v cifra">'+cot.length+'</span><span class="s">El camino normal</span></div>'
   +'<div class="fx-kpi"><span class="l">En revisión del Master</span><span class="v cifra">'+rev+'</span><span class="s">Esperan aprobar o devolver</span></div>'
   +'<div class="fx-kpi"><span class="l">Monto exento del mes</span><span class="v cifra">'+clp(monto)+'</span><span class="s">Suma de las facturas adicionales</span></div>'
   +'</div>'
   +'<div class="desfase">'+I('alerta','ic-cel')+'<span>Sin motor todavía: esta sección es una vista previa con datos de ejemplo. Nada se guarda.</span></div>';
}

/* ── Editor completo ── */
var ED=null, ED_ORIG=null, ED_SUG=false;
function edEditable(){return CTX.rol==='facturador'&&ED&&(ED.estado==='BORRADOR'||ED.estado==='INSTRUCCION'||ED.estado==='DEVUELTA');}
function abrirEditor(f,nuevo){
  ED=JSON.parse(JSON.stringify(f));ED_ORIG=nuevo?null:f;ED_SUG=false;
  renderEditor();var el=document.getElementById('ed');el.classList.add('on');document.body.style.overflow='hidden';
  var x=el.querySelector('[data-ed="cerrar"]');if(x)x.focus();
}
function cerrarEditor(){document.getElementById('ed').classList.remove('on');document.body.style.overflow='';ED=null;}
function nuevaManual(){
  abrirEditor({id:'m'+(IND.length+1)+'-'+Date.now().toString(36),origen:'MANUAL',cot:null,cliId:null,fEm:HOY,fVen:sumarDias(HOY,20),forma:'CREDITO',ref:'',cond:'',lineas:[],descG:{t:'%',v:0},obs:'',estado:'BORRADOR',motivo:''},true);
}
function dis(){return edEditable()?'':' disabled';}
function renderEditor(){
  var f=ED, es=EST_IND[f.estado], c=cliAd(f.cliId), falta=faltanFicha(c), ok=edEditable();
  document.getElementById('edHead').innerHTML=
    '<button type="button" class="g-ico" data-ed="cerrar" aria-label="Volver a Facturación adicional">'+I('devolver','ic-mor')+'</button>'
   +'<div><small class="k" style="font:700 11px var(--g-texto);letter-spacing:1.2px;color:var(--t2);text-transform:uppercase">'+(f.origen==='MANUAL'?'Factura manual · excepción':'Factura desde cotización')+'</small>'
   +'<h2 id="edTitulo">'+(f.origen==='MANUAL'?'Factura <span>manual</span>':'Factura de <span>'+esc(f.cot)+'</span>')+'</h2></div>'
   +'<span class="'+es[1]+'">'+es[0]+'</span>'+(f.origen==='MANUAL'?'<span class="chip c-manualf">MANUAL</span>':'')
   +'<span class="g-espacio"></span><span class="prox">'+ic('reloj')+'Próximamente · sin motor</span><span class="prueba">'+ic('probeta')+'MODO PRUEBA</span>';
  var h='';
  if(f.coment)h+='<div class="fx-aviso" style="margin:0;background:rgba(255,200,90,.08);border-color:rgba(255,200,90,.4)">'+I('devolver','placa ic-amb')+'<div><b>Devuelta por el Master</b><p>'+esc(f.coment)+'</p></div></div>';
  if(!ok)h+='<div class="fx-aviso" style="margin:0">'+I('candado','placa ic-cel')+'<div><b>'+(CTX.rol==='master'?'Vista del Master: solo lectura.':'Factura no editable en este estado.')+'</b><p>'+(CTX.rol==='master'?'Revisas la factura tal como la verá el cliente. Puedes aprobarla o devolverla con un comentario. El Master nunca emite.':'Solo se edita en Borrador, Instrucción recibida o Devuelta.')+'</p></div></div>';
  if(f.origen==='MANUAL')h+='<div class="g-card ed-card motivo-card"><h3>'+I('alerta','ic-amb')+'Motivo de la factura manual <small>Obligatorio · queda en la bitácora</small></h3>'
    +'<div class="fld"><label for="edMotivo">¿Por qué esta factura no viene de una cotización aprobada?</label><textarea class="inp" id="edMotivo" data-f="motivo" placeholder="Ej.: trabajo urgente acordado por teléfono"'+dis()+'>'+esc(f.motivo||'')+'</textarea></div></div>';
  /* 1 · Encabezado */
  h+='<div class="ed-grid">'
   +'<div class="g-card ed-card"><h3>'+I('edificio','ic-mor')+'Emisor <small>Solo lectura</small></h3>'
   +'<div class="emisor">'+I('edificio','placa ic-mor')+'<div><b>Asesorías Contadoor Ltda</b><small>RUT, giro, dirección y actividad económica desde la configuración del emisor (OpenFactura).</small></div></div>'
   +'<div class="fld" style="margin-top:14px"><label>Tipo de documento</label><div class="tipo-fijo">'+I('factura','ic-roj')+'Factura exenta electrónica (DTE 34)</div></div></div>'
   +'<div class="g-card ed-card"><h3>'+I('clientes','ic-cel')+'Cliente <small>Desde la ficha de Clientes</small></h3>'
   +'<div class="fld buscador"><label for="edCli">Buscar cliente por razón social o RUT</label><input class="inp" id="edCli" autocomplete="off" placeholder="Escribe al menos 2 letras" value="'+esc(c?c.razon_social:'')+'"'+dis()+'><div class="sug" id="edSug" hidden></div></div>'
   +(c?'<div class="ficha">'
     +'<div><span>Razón social</span>'+esc(c.razon_social)+'</div><div><span>RUT</span>'+esc(c.rut)+'</div>'
     +'<div><span>Giro</span>'+(c.giro?esc(c.giro):'<b class="falta">Falta en la ficha</b>')+'</div>'
     +'<div><span>Dirección</span>'+(c.direccion?esc(c.direccion):'<b class="falta">Falta en la ficha</b>')+'</div>'
     +'<div><span>Comuna</span>'+(c.comuna?esc(c.comuna):'<b class="falta">Falta en la ficha</b>')+'</div>'
     +'<div><span>Correo de facturación</span>'+(c.correo_facturacion?esc(c.correo_facturacion):'<b class="falta">Falta en la ficha</b>')+'</div></div>'
     +(falta.length?'<div class="aviso-m" style="margin:10px 0 0">'+I('alerta','ic-amb')+'<span><b>Ficha incompleta:</b> falta '+esc(falta.join(', '))+'. Complétala en Clientes antes de enviar (el SII exige los datos del receptor).</span></div>':'')
     :'<p class="ninguna" style="margin:6px 0 0">Elige un cliente: se traen sus datos desde la ficha.</p>')
   +'</div></div>';
  h+='<div class="g-card ed-card"><h3>'+I('calendario','ic-ver')+'Fechas y pago</h3><div class="fila2">'
   +'<div class="fld"><label for="edFEm">Fecha de emisión</label><input class="inp" type="date" id="edFEm" data-f="fEm" value="'+f.fEm+'"'+dis()+'></div>'
   +'<div class="fld"><label for="edFVen">Vencimiento <span class="sub" style="display:inline">(por defecto +'+(c?c.dias_pago:20)+' días'+(c?' · condición del cliente':'')+')</span></label><input class="inp" type="date" id="edFVen" data-f="fVen" value="'+f.fVen+'"'+dis()+'></div>'
   +'<div class="fld"><label for="edForma">Forma de pago</label><select class="inp" id="edForma" data-f="forma"'+dis()+'><option value="CONTADO"'+(f.forma==='CONTADO'?' selected':'')+'>Contado</option><option value="CREDITO"'+(f.forma==='CREDITO'?' selected':'')+'>Crédito</option></select></div>'
   +'<div class="fld"><label for="edRef">Período o referencia</label><input class="inp" id="edRef" data-f="ref" placeholder="Ej.: octubre 2026 o N° de cotización" value="'+esc(f.ref||'')+'"'+dis()+'></div>'
   +'</div></div>';
  /* 2 · Detalle */
  h+='<div class="g-card ed-card"><h3>'+I('lista','ic-mor')+'Detalle de servicios <small>UF del día $'+ufFmt(UFD())+' · redondeo a peso por línea</small></h3><div id="edLineas"></div></div>';
  /* 3-4 · Totales, observaciones y correo */
  h+='<div class="tot-wrap">'
   +'<div class="g-card ed-card"><h3>'+I('correo','ic-cel')+'Observaciones y envío</h3>'
   +'<div class="fld"><label for="edObs">Observaciones / glosa general (sale en el PDF)</label><textarea class="inp" id="edObs" data-f="obs" placeholder="Ej.: servicio prestado según cotización aprobada"'+dis()+'>'+esc(f.obs||'')+'</textarea></div>'
   +'<div class="fld"><label>Correo de destino</label><div class="ro">'+I('correo','ic-cel')+'info@contadoor.cl</div></div>'
   +'<div class="aviso-m">'+I('probeta','ic-amb')+'<span><b>MODO PRUEBA:</b> el correo va siempre a info@contadoor.cl. '+(c&&c.correo_facturacion?'El correo real de la ficha ('+esc(c.correo_facturacion)+') se usará desde F1d.':'El correo real sale de la ficha del cliente desde F1d.')+'</span></div></div>'
   +'<div class="g-card ed-card" id="edTot"></div></div>';
  document.getElementById('edDoc').innerHTML=h;
  renderLineas();renderTot();renderEdFoot();
}
function renderLineas(){
  var f=ED, ok=edEditable(), h='';
  if(!f.lineas.length)h='<div class="vacio">Aún no hay servicios. Usa <b>Agregar servicio</b> para elegir del catálogo de Planes y Servicios o escribir una línea libre.</div>';
  else{
    h='<div class="lin-box"><table class="lin-t"><thead><tr><th>#</th><th style="width:36%">Descripción y detalle</th><th class="num" style="width:80px">Cant.</th><th style="width:200px">Precio unitario</th><th class="num" style="width:90px">Desc. %</th><th class="num" style="width:130px">Subtotal</th><th></th></tr></thead><tbody>';
    f.lineas.forEach(function(l,i){var c=linCalc(l), d=ok?'':' disabled';
      h+='<tr><td><span class="lin-n">'+(i+1)+'</span></td>'
       +'<td><input class="inp" data-l="'+i+'" data-k="desc" aria-label="Descripción línea '+(i+1)+'" placeholder="Descripción del servicio" value="'+esc(l.desc)+'"'+d+'>'
       +'<textarea class="inp" data-l="'+i+'" data-k="det" aria-label="Detalle opcional línea '+(i+1)+'" placeholder="Detalle opcional"'+d+'>'+esc(l.det)+'</textarea>'
       +(l.svc?'<span class="conv">Del catálogo de Planes y Servicios</span>':'<span class="conv">Línea libre</span>')+'</td>'
       +'<td><input class="inp cifra" style="text-align:right" type="number" min="0" step="any" inputmode="decimal" data-l="'+i+'" data-k="cant" aria-label="Cantidad línea '+(i+1)+'" value="'+l.cant+'"'+d+'></td>'
       +'<td><div class="precio"><select class="inp" data-l="'+i+'" data-k="mon" aria-label="Moneda línea '+(i+1)+'"'+d+'><option'+(l.mon==='CLP'?' selected':'')+'>CLP</option><option'+(l.mon==='UF'?' selected':'')+'>UF</option></select>'
       +'<input class="inp cifra" style="text-align:right" type="number" min="0" step="any" inputmode="decimal" data-l="'+i+'" data-k="precio" aria-label="Precio unitario línea '+(i+1)+'" value="'+l.precio+'"'+d+'></div>'
       +'<span class="conv" data-conv="'+i+'">'+(l.mon==='UF'?'≈ '+clp(Math.round((+l.precio||0)*UFD()))+' c/u (UF $'+ufFmt(UFD())+')':'Pesos chilenos')+'</span></td>'
       +'<td><input class="inp cifra" style="text-align:right" type="number" min="0" max="100" step="any" inputmode="decimal" data-l="'+i+'" data-k="descPct" aria-label="Descuento línea '+(i+1)+'" value="'+(l.descPct||0)+'"'+d+'></td>'
       +'<td><span class="sub-l" data-sub="'+i+'">'+clp(c.tot)+(c.desc?'<small>−'+clp(c.desc)+' desc.</small>':'')+'</span></td>'
       +'<td><div class="lin-acc">'
       +'<button type="button" class="g-ico" data-ed="subir" data-i="'+i+'" aria-label="Subir línea '+(i+1)+'"'+(ok&&i>0?'':' disabled')+'>'+I('subir',ok&&i>0?'ic-cel':'')+'</button>'
       +'<button type="button" class="g-ico" data-ed="bajar" data-i="'+i+'" aria-label="Bajar línea '+(i+1)+'"'+(ok&&i<f.lineas.length-1?'':' disabled')+'>'+I('bajar',ok&&i<f.lineas.length-1?'ic-cel':'')+'</button>'
       +'<button type="button" class="g-ico" data-ed="quitar" data-i="'+i+'" aria-label="Quitar línea '+(i+1)+'"'+(ok?'':' disabled')+'>'+I('basura',ok?'ic-roj':'')+'</button>'
       +'</div></td></tr>';});
    h+='</tbody></table></div>';
  }
  h+='<div class="lin-pie"><button type="button" class="g-btn sm" data-ed="agregar"'+(ok?'':' disabled')+'>'+I('mas',ok?'ic-ver':'')+'Agregar servicio</button>'
   +'<span class="sub" style="display:inline">Del catálogo de <b>Planes y Servicios</b> (solo servicios activos) o como línea libre.</span></div>';
  document.getElementById('edLineas').innerHTML=h;
}
function renderTot(){
  var f=ED,t=facCalc(f),ok=edEditable();
  document.getElementById('edTot').innerHTML='<h3>'+I('calc','ic-ver')+'Totales</h3>'
   +'<div class="tot-row"><span>Suma de servicios</span><span>'+clp(t.bruto)+'</span></div>'
   +(t.descLineas?'<div class="tot-row"><span>Descuentos por línea</span><span class="baja">−'+clp(t.descLineas)+'</span></div>':'')
   +'<div class="tot-row"><span><label for="edDG">Descuento global</label></span><span class="desc-g"><select class="inp" data-g="t" aria-label="Tipo de descuento global"'+(ok?'':' disabled')+'><option value="%"'+(f.descG.t==='%'?' selected':'')+'>%</option><option value="$"'+(f.descG.t==='$'?' selected':'')+'>$</option></select><input class="inp cifra" id="edDG" style="width:110px;text-align:right" type="number" min="0" step="any" inputmode="decimal" data-g="v" value="'+(f.descG.v||0)+'"'+(ok?'':' disabled')+'></span></div>'
   +(t.descG?'<div class="tot-row"><span>Descuento global aplicado</span><span class="baja">−'+clp(t.descG)+'</span></div>':'')
   +'<div class="tot-row"><span>Monto exento</span><span>'+clp(t.total)+'</span></div>'
   +'<div class="tot-row"><span>IVA</span><span class="neutro">No aplica</span></div>'
   +'<div class="tot-row big"><span>Total</span><span class="cifra">'+clp(t.total)+'</span></div>'
   +'<span class="exenta">'+ic('check')+'Factura exenta · sin IVA</span>';
}
function actualizarNumeros(){
  ED.lineas.forEach(function(l,i){var c=linCalc(l);var s=document.querySelector('[data-sub="'+i+'"]');if(s)s.innerHTML=clp(c.tot)+(c.desc?'<small>−'+clp(c.desc)+' desc.</small>':'');
    var v=document.querySelector('[data-conv="'+i+'"]');if(v)v.textContent=l.mon==='UF'?'≈ '+clp(Math.round((+l.precio||0)*UFD()))+' c/u (UF $'+ufFmt(UFD())+')':'Pesos chilenos';});
  var a=document.activeElement, id=a&&a.id;renderTot();if(id==='edDG'){var n=document.getElementById('edDG');n.focus();var v=n.value;n.value='';n.value=v;}
}
function renderEdFoot(){
  var f=ED, h='', ok=edEditable();
  if(CTX.rol==='facturador'){
    h+=btn({txt:'Guardar borrador',ic:'check',icc:'ic-ver',ok:ok,act:'ed-guardar',tip:ok?'Guarda los cambios sin enviar (maqueta: no se guarda nada).':'Solo se guarda en Borrador, Instrucción recibida o Devuelta.'});
    h+=btn({txt:'Vista previa PDF',ic:'ver',icc:'ic-cel',ok:true,act:'ed-pdf',tip:'Muestra cómo se verá el PDF, con la marca Contadoor.'});
    h+=btn({txt:'Enviar a aprobación',ic:'enviar',cls:'pri',ok:ok,act:'ed-enviar',tip:ok?'Revisa que esté completa y la manda al Master (aviso push).':'Ya fue enviada o aprobada.'});
    h+=btn({txt:'Emitir',ic:'candado',icc:'ic-amb',ok:false,act:'ed-emitir',tip:'Bloqueado hasta F1c/F1d. Además, solo se emite una factura aprobada por el Master.'});
  }else{
    var rev=f.estado==='EN_REVISION';
    h+=btn({txt:'Vista previa PDF',ic:'ver',icc:'ic-cel',ok:true,act:'ed-pdf',tip:'Muestra cómo se verá el PDF, con la marca Contadoor.'});
    h+=btn({txt:'Devolver',ic:'devolver',icc:'ic-amb',ok:rev,act:'ed-devolver',tip:rev?'Devuelve al facturador con un comentario obligatorio.':'Solo se devuelve una factura "En revisión".'});
    h+=btn({txt:'Aprobar',ic:'aprobar',cls:'pri',ok:rev,act:'ed-aprobar',tip:rev?'Aprueba la factura tal como la ves.':'Solo se aprueba una factura "En revisión".'});
  }
  var quien=CTX.rol==='facturador'?I('factura','ic-ama')+'<span><b>Facturador</b>: arma la factura, guarda y envía a aprobación.</span>':I('escudo','ic-cel')+'<span><b>Master</b>: aprueba o devuelve. Nunca emite.</span>';
  document.getElementById('edFoot').innerHTML='<div class="quien">'+quien+'</div>'+h;
}
function sugerir(q){
  var box=document.getElementById('edSug');q=(q||'').trim().toLowerCase();
  if(q.length<2){box.hidden=true;return;}
  var r=CLIENTES_AD.filter(function(c){return c.razon_social.toLowerCase().indexOf(q)>=0||c.rut.replace(/\./g,'').indexOf(q.replace(/\./g,''))>=0;}).slice(0,8);
  box.innerHTML=r.length?r.map(function(c){var fa=faltanFicha(c);return '<button type="button" data-cli="'+c.id+'">'+esc(c.razon_social)+'<small>'+esc(c.rut)+(fa.length?' · ficha incompleta: falta '+esc(fa.join(', ')):'')+'</small></button>';}).join(''):'<p class="ninguna" style="padding:10px 12px;margin:0">Sin resultados. El cliente debe existir en Clientes.</p>';
  box.hidden=false;
}
function elegirCliente(id){
  var c=cliAd(id);ED.cliId=id;ED.fVen=sumarDias(ED.fEm,c.dias_pago||20);
  if(!ED.cond)ED.cond='Paga a '+(c.dias_pago||20)+' días';renderEditor();
}
function catalogo(){
  var act=SERVICIOS_AD.filter(function(s){return s.activo;});
  function lista(q){q=(q||'').toLowerCase();return act.filter(function(s){return !q||(s.nombre+' '+s.descripcion+' '+(CAT_AD[s.categoria]||'')).toLowerCase().indexOf(q)>=0;}).map(function(s){
    var pr=s.moneda==='UF'?dec(s.precio)+' UF<small>≈ '+clp(Math.round(s.precio*UFD()))+'</small>':clp(s.precio);
    return '<button type="button" class="cat-it" data-cat="'+esc(s.id)+'">'+I('lista','placa ic-mor')+'<span><b>'+esc(s.nombre)+'</b><small>'+esc(CAT_AD[s.categoria]||s.categoria)+' · '+esc(s.descripcion)+'</small></span><span class="pr">'+pr+'</span></button>';}).join('')||'<p class="ninguna">Sin servicios que coincidan.</p>';}
  modal({t:'Agregar servicio',ic:'lista',icc:'ic-mor',ok:'Agregar línea libre',
    b:'<p>Servicios activos del catálogo de <b>Planes y Servicios</b>. Los precios en UF se convierten a la UF del día ($'+ufFmt(UFD())+').</p>'
     +'<label for="catQ">Buscar servicio</label><input id="catQ" placeholder="Ej.: renta, sociedad, finiquito" autocomplete="off">'
     +'<div class="cat-list" id="catList" style="margin-top:10px">'+lista('')+'</div>',
    cb:function(){ED.lineas.push(L('','',1,'CLP',0,null));renderLineas();renderTot();setTimeout(function(){var n=document.querySelector('[data-l="'+(ED.lineas.length-1)+'"][data-k="desc"]');if(n)n.focus();},30);}});
  var q=document.getElementById('catQ');
  q.addEventListener('input',function(){document.getElementById('catList').innerHTML=lista(q.value);});
}
function validarFactura(f){
  var e=[], c=cliAd(f.cliId);
  if(!c)e.push('Elige un cliente.');else{var fa=faltanFicha(c);if(fa.length)e.push('Completa la ficha del cliente en Clientes: falta '+fa.join(', ')+'.');}
  if(!f.lineas.length)e.push('Agrega al menos un servicio.');
  f.lineas.forEach(function(l,i){if(!String(l.desc).trim())e.push('La línea '+(i+1)+' no tiene descripción.');if(!(+l.cant>0))e.push('La línea '+(i+1)+' necesita una cantidad mayor a 0.');if(!(+l.precio>0))e.push('La línea '+(i+1)+' necesita un precio mayor a 0.');});
  if(f.lineas.length&&!(facCalc(f).total>0))e.push('El total debe ser mayor a $0.');
  if(!f.fEm||!f.fVen)e.push('Completa la fecha de emisión y el vencimiento.');else if(f.fVen<f.fEm)e.push('El vencimiento no puede ser anterior a la emisión.');
  if(f.origen==='MANUAL'&&!String(f.motivo||'').trim())e.push('En una factura manual el motivo es obligatorio.');
  return e;
}
function guardarED(estado){
  if(estado)ED.estado=estado;
  var i=IND.map(function(x){return x.id;}).indexOf(ED.id);
  var copia=JSON.parse(JSON.stringify(ED));if(i>=0)IND[i]=copia;else IND.push(copia);
}
function verPDF(){
  var f=ED, c=cliAd(f.cliId), t=facCalc(f);
  var filas=f.lineas.map(function(l,i){var k=linCalc(l);return '<tr><td>'+(i+1)+'</td><td><b>'+esc(l.desc||'(sin descripción)')+'</b>'+(l.det?'<small>'+esc(l.det)+'</small>':'')+'</td><td class="num">'+dec(+l.cant||0)+'</td><td class="num">'+(l.mon==='UF'?dec(+l.precio||0)+' UF<small>$'+ufFmt((+l.precio||0)*UFD())+'</small>':clp(+l.precio||0))+'</td><td class="num">'+(k.desc?'−'+clp(k.desc):'—')+'</td><td class="num"><b>'+clp(k.tot)+'</b></td></tr>';}).join('')||'<tr><td colspan="6" style="text-align:center;color:#8A6F8F">Sin servicios</td></tr>';
  document.getElementById('hoja').innerHTML=
    '<div class="hoja-h"><div><img src="'+LOGO+'" alt="Contadoor"><div class="emi"><b>Asesorías Contadoor Ltda</b><br>Giro, dirección y RUT desde la configuración del emisor</div></div>'
   +'<div class="caja-sii">R.U.T.: del emisor<br>FACTURA NO AFECTA O EXENTA<br>ELECTRÓNICA<br>N° '+(f.folio||'se asigna al emitir')+'</div></div>'
   +'<div class="hoja-b">'
   +'<div class="hoja-rec"><div><span>Señor(es)</span>'+esc(c?c.razon_social:'—')+'</div><div><span>RUT</span>'+esc(c?c.rut:'—')+'</div>'
   +'<div><span>Giro</span>'+esc(c&&c.giro||'—')+'</div><div><span>Dirección</span>'+esc(c?(c.direccion||'—')+(c.comuna?', '+c.comuna:''):'—')+'</div>'
   +'<div><span>Fecha de emisión</span>'+fFecha(f.fEm)+'</div><div><span>Vencimiento</span>'+fFecha(f.fVen)+'</div>'
   +'<div><span>Forma de pago</span>'+(f.forma==='CONTADO'?'Contado':'Crédito')+'</div><div><span>Referencia</span>'+esc(f.ref||'—')+'</div></div>'
   +'<table><thead><tr><th>#</th><th>Descripción</th><th class="num">Cant.</th><th class="num">Precio unit.</th><th class="num">Desc.</th><th class="num">Valor</th></tr></thead><tbody>'+filas+'</tbody></table>'
   +'<div class="hoja-tot"><div class="timbre">Timbre electrónico SII<br>(se agrega al emitir)</div><table>'
   +(t.descG?'<tr><td>Descuento global</td><td class="num">−'+clp(t.descG)+'</td></tr>':'')
   +'<tr><td>Monto exento</td><td class="num">'+clp(t.total)+'</td></tr><tr><td>IVA</td><td class="num">No aplica</td></tr><tr class="t"><td>Total</td><td class="num">'+clp(t.total)+'</td></tr></table></div>'
   +(f.obs?'<div class="hoja-obs"><b>Observaciones:</b> '+esc(f.obs)+'</div>':'')
   +'</div><div class="hoja-pie"><span>Factura exenta de IVA · DTE 34</span><span>contadoor.cl</span></div>';
  document.getElementById('pdf').classList.add('on');document.getElementById('pdfCerrar').focus();
}
function accionEd(act){
  if(act==='ed-pdf'){verPDF();return;}
  if(act==='ed-guardar'){guardarED(ED.estado==='INSTRUCCION'?'BORRADOR':null);renderTodo();toast(I('check','ic-ver')+' Demo: borrador guardado solo en esta vista (no se guarda nada).');return;}
  if(act==='ed-enviar'){var e=validarFactura(ED);
    if(e.length){modal({t:'Falta completar la factura',ic:'alerta',icc:'ic-amb',ok:'Entendido',b:'<ul class="err-list">'+e.map(function(x){return '<li>'+esc(x)+'</li>';}).join('')+'</ul>',cb:function(){}});return;}
    var t=facCalc(ED),c=cliAd(ED.cliId);
    modal({t:'Enviar a aprobación',ic:'enviar',icc:'ic-mor',ok:'Enviar al Master',b:'<p>Factura exenta (DTE 34) para <b>'+esc(c.razon_social)+'</b> por <b>'+clp(t.total)+'</b>, '+ED.lineas.length+' servicio(s).</p>'+(ED.origen==='MANUAL'?'<div class="aviso-m">'+I('alerta','ic-amb')+'<span>Es una factura <b>MANUAL</b>. Motivo: '+esc(ED.motivo)+'</span></div>':'')+'<p>El Master recibirá un aviso push.</p>',
      cb:function(){ED.coment=null;guardarED('EN_REVISION');renderTodo();toast(I('enviar','ic-mor')+' Demo: factura enviada al Master.');}});return;}
  if(act==='ed-aprobar'){var t2=facCalc(ED),c2=cliAd(ED.cliId);
    modal({t:'Aprobar factura',ic:'aprobar',icc:'ic-ver',ok:'Aprobar',b:'<p><b>'+esc(tituloFac(ED))+'</b> para <b>'+esc(c2?c2.razon_social:'')+'</b> por <b>'+clp(t2.total)+'</b> (exenta, DTE 34).</p>'+(ED.origen==='MANUAL'?'<div class="aviso-m">'+I('alerta','ic-amb')+'<span>Es una factura <b>MANUAL</b>. Motivo: '+esc(ED.motivo)+'</span></div>':''),
      cb:function(){guardarED('APROBADA');renderTodo();toast(I('aprobar','ic-ver')+' Demo: factura aprobada. Aviso al facturador.');}});return;}
  if(act==='ed-devolver'){modal({t:'Devolver factura',ic:'devolver',icc:'ic-amb',ok:'Devolver al facturador',b:'<label for="mCom2">Comentario (obligatorio)</label><textarea id="mCom2" placeholder="Ej.: confirmar el monto con la cotización"></textarea>',
      cb:function(){var v=document.getElementById('mCom2').value.trim();if(!v){toast(I('alerta','ic-amb')+' El comentario es obligatorio.');return false;}ED.coment=v;guardarED('DEVUELTA');renderTodo();toast(I('devolver','ic-amb')+' Demo: factura devuelta.');}});return;}
}
function accionInd(act,id){
  if(act==='ind-abrir'){abrirEditor(IND.filter(function(y){return y.id===id;})[0]);return;}
  if(act==='ind-manual'){nuevaManual();return;}
  if(act.indexOf('ed-')===0)accionEd(act);
}
/* eventos del editor */
(function(){
  var ed=document.getElementById('ed');
  ed.addEventListener('input',function(e){
    var t=e.target;if(!ED||!edEditable())return;
    if(t.id==='edCli'){sugerir(t.value);return;}
    var fk=t.getAttribute('data-f');if(fk){ED[fk]=t.value;return;}
    var li=t.getAttribute('data-l');if(li!=null){var k=t.getAttribute('data-k');ED.lineas[+li][k]=(k==='desc'||k==='det'||k==='mon')?t.value:t.value;actualizarNumeros();return;}
    var g=t.getAttribute('data-g');if(g){ED.descG[g]=t.value;actualizarNumeros();}
  });
  ed.addEventListener('change',function(e){var t=e.target;if(!ED||!edEditable())return;
    if(t.getAttribute('data-f')==='fEm'&&ED.cliId){var c=cliAd(ED.cliId);ED.fVen=sumarDias(ED.fEm,c.dias_pago||20);var v=document.getElementById('edFVen');if(v)v.value=ED.fVen;}
    if(t.getAttribute('data-g')==='t'){ED.descG.t=t.value;renderTot();}});
  ed.addEventListener('click',function(e){
    var cl=e.target.closest('[data-cli]');if(cl){elegirCliente(cl.getAttribute('data-cli'));return;}
    var b=e.target.closest('[data-ed]');if(!b||b.disabled)return;var a=b.getAttribute('data-ed'),i=+b.getAttribute('data-i');
    if(a==='cerrar'){cerrarEditor();return;}
    if(a==='agregar'){catalogo();return;}
    if(a==='quitar'){ED.lineas.splice(i,1);}
    if(a==='subir'&&i>0){var x=ED.lineas.splice(i,1)[0];ED.lineas.splice(i-1,0,x);}
    if(a==='bajar'&&i<ED.lineas.length-1){var y=ED.lineas.splice(i,1)[0];ED.lineas.splice(i+1,0,y);}
    renderLineas();renderTot();
  });
  document.getElementById('mBody').addEventListener('click',function(e){var b=e.target.closest('[data-cat]');if(!b||!ED)return;
    var s=SERVICIOS_AD.filter(function(x){return x.id===b.getAttribute('data-cat');})[0];
    ED.lineas.push(L(s.nombre,s.descripcion,1,s.moneda,s.precio,s.id));cerrarModal();renderLineas();renderTot();toast(I('mas','ic-ver')+' Servicio agregado: '+esc(s.nombre));});
  document.getElementById('pdfCerrar').addEventListener('click',function(){document.getElementById('pdf').classList.remove('on');});
  document.addEventListener('click',function(e){if(!e.target.closest('.buscador')){var s=document.getElementById('edSug');if(s)s.hidden=true;}});
})();

/* ── Producción: sin motor → "Próximamente", sin datos ni llamadas ── */
function renderProximamente(){
  $('hero').innerHTML='<div class="hero-top"><div><small class="k">Período contable</small><h2>Facturación <span>adicional</span></h2>'
   +'<div class="meta"><span class="it">'+I('lista','ic-ama')+'Servicios puntuales, fuera de los grupos mensuales</span><span class="it">'+I('factura','ic-mor')+'Factura exenta <b>DTE 34</b></span><span class="it">'+I('escudo','ic-cel')+'Siempre con aprobación del Master</span></div></div>'
   +'<div class="estado-lote"><span class="prox">'+ic('reloj')+'Próximamente</span><span class="prueba">'+ic('probeta')+'MODO PRUEBA</span></div></div>'
   +'<div class="fx-kpis">'
   +'<div class="fx-kpi"><span class="l">Manuales este mes</span><span class="v cifra" style="color:var(--amb)">—</span><span class="s">Excepción · motivo obligatorio</span></div>'
   +'<div class="fx-kpi"><span class="l">Desde cotización</span><span class="v cifra">—</span><span class="s">El camino normal</span></div>'
   +'<div class="fx-kpi"><span class="l">En revisión del Master</span><span class="v cifra">—</span><span class="s">Esperan aprobar o devolver</span></div>'
   +'<div class="fx-kpi"><span class="l">Monto exento del mes</span><span class="v cifra">—</span><span class="s">Suma de las facturas adicionales</span></div></div>'
   +'<div class="desfase">'+I('alerta','ic-cel')+'<span>Esta sección se habilita cuando exista su motor SQL (etapa aparte). Hoy no guarda ni muestra datos.</span></div>';
  $('cotGrid').innerHTML='<div class="cot" style="grid-column:1/-1"><b class="sv">Próximamente</b><div class="fila"><span>Al aprobarse una cotización, aquí llegará su instrucción de facturación con las condiciones de pago, para armarla en el editor completo y enviarla al Master.</span></div></div>';
  $('manGrid').innerHTML='';
  $('sepManual').innerHTML='<span><b style="color:var(--t1)">Facturas manuales</b> · solo como excepción, con motivo obligatorio y aprobación del Master.</span>'
   +'<span class="tipw" style="margin-left:auto" data-tip="Próximamente: falta el motor SQL de facturas adicionales."><button type="button" class="btn-link" disabled>'+I('mas')+'Factura manual (excepción)</button></span>';
}
function renderTodo(){if(!CTX.demo||!D){renderProximamente();return;}renderHeroAdic();renderIndiv();if(ED)renderEditor();}
window.FX_ADICIONAL={
  render:function(ctx){CTX.demo=!!(ctx&&ctx.demo)&&!!D;CTX.rol=ctx&&ctx.rol||'lectura';CTX.uf=ctx&&ctx.uf||CTX.uf;renderTodo();},
  cerrar:function(){if(ED)cerrarEditor();}
};
/* Botones de la sección y del editor (el despachador general de facturacion.js no los toma) */
document.addEventListener('click',function(e){
  if(!CTX.demo)return;
  var b=e.target.closest('#vistaAdic [data-act],#ed [data-act]');
  if(!b||b.disabled)return;
  e.stopPropagation();accionInd(b.getAttribute('data-act'),b.getAttribute('data-id'));
});
})();
